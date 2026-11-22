/* ==========================================================================
   TEAMBAT — SERVIDOR
   Node.js puro (sem dependências): HTTP + SQLite nativo (node:sqlite).
   - Autenticação por sessão (cookie HttpOnly) e senhas com scrypt
   - Permissões: aluno só acessa os próprios dados; treinador acessa todos
   - API JSON em /api/* e arquivos estáticos em /public
   ========================================================================== */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { MUSCLE_GROUPS, DEFAULT_EXERCISES } = require('./lib/library');
const demo = require('./lib/demo');

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, 'teambat.db');
const PUBLIC_DIR = path.join(__dirname, 'public');
const TIMEZONE = process.env.APP_TIMEZONE || 'America/Sao_Paulo';
const SESSION_DAYS = 30;

/* ---------- Banco de dados ---------- */
if (DB_FILE !== ':memory:') fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL CHECK (role IN ('admin','student')),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  is_demo INTEGER NOT NULL DEFAULT 0,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  goal TEXT NOT NULL DEFAULT '',
  split_name TEXT NOT NULL DEFAULT '',
  weekly_target INTEGER NOT NULL DEFAULT 4,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  muscle_group TEXT NOT NULL,
  instructions TEXT NOT NULL DEFAULT '',
  image TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS day_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day_id INTEGER NOT NULL REFERENCES days(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  position INTEGER NOT NULL DEFAULT 0,
  sets INTEGER NOT NULL DEFAULT 3,
  reps_min INTEGER NOT NULL DEFAULT 8,
  reps_max INTEGER NOT NULL DEFAULT 12,
  notes TEXT NOT NULL DEFAULT ''
);
-- Os treinos guardam uma cópia da prescrição do dia: editar a ficha depois
-- não altera nem apaga o histórico.
CREATE TABLE IF NOT EXISTS workouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_id INTEGER REFERENCES days(id) ON DELETE SET NULL,
  day_label TEXT NOT NULL,
  day_name TEXT NOT NULL DEFAULT '',
  started_at TEXT NOT NULL,
  finished_at TEXT,
  notes TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS workout_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  exercise_name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  sets INTEGER NOT NULL,
  reps_min INTEGER NOT NULL,
  reps_max INTEGER NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  done_at TEXT
);
CREATE TABLE IF NOT EXISTS sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_exercise_id INTEGER NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  weight REAL,
  reps INTEGER,
  note TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  UNIQUE (workout_exercise_id, set_number)
);
CREATE TABLE IF NOT EXISTS coach_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_workouts_student ON workouts(student_id, started_at);
CREATE INDEX IF NOT EXISTS idx_we_workout ON workout_exercises(workout_id);
CREATE INDEX IF NOT EXISTS idx_we_exercise ON workout_exercises(exercise_id);
CREATE INDEX IF NOT EXISTS idx_sets_we ON sets(workout_exercise_id);
CREATE INDEX IF NOT EXISTS idx_days_student ON days(student_id);
`);

// Migração: a funcionalidade de descanso foi removida; bancos antigos perdem a coluna.
for (const table of ['day_exercises', 'workout_exercises']) {
  if (db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === 'rest_seconds')) {
    db.exec(`ALTER TABLE ${table} DROP COLUMN rest_seconds`);
  }
}

const stmts = new Map();
function prep(sql) { let s = stmts.get(sql); if (!s) { s = db.prepare(sql); stmts.set(sql, s); } return s; }
const all = (sql, ...a) => prep(sql).all(...a);
const one = (sql, ...a) => prep(sql).get(...a);
const run = (sql, ...a) => { const r = prep(sql).run(...a); return { id: Number(r.lastInsertRowid), changes: Number(r.changes) }; };
function tx(fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
}
const now = () => new Date().toISOString();

if (!one('SELECT 1 AS x FROM exercises LIMIT 1')) {
  tx(() => DEFAULT_EXERCISES.forEach(([name, group]) =>
    run('INSERT INTO exercises (name, muscle_group, created_at) VALUES (?,?,?)', name, group, now())));
}
function getSetting(key, fallback) { const r = one('SELECT value FROM settings WHERE key = ?', key); return r ? r.value : fallback; }
function setSetting(key, value) { run('INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, String(value)); }

/* ---------- Utilidades ---------- */
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const bad = (msg) => new HttpError(400, msg);

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return 'scrypt$' + salt.toString('hex') + '$' + hash.toString('hex');
}
function verifyPassword(password, stored) {
  const [, saltHex, hashHex] = String(stored).split('$');
  if (!saltHex || !hashHex) return false;
  const hash = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), 64);
  const expected = Buffer.from(hashHex, 'hex');
  return hash.length === expected.length && crypto.timingSafeEqual(hash, expected);
}
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
function tempPassword() {
  const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.randomBytes(10), (b) => abc[b % abc.length]).join('');
}
function str(v, max, field, required) {
  const s = (v == null ? '' : String(v)).trim();
  if (required && !s) throw bad(`Preencha o campo "${field}".`);
  if (s.length > max) throw bad(`O campo "${field}" é longo demais.`);
  return s;
}
function int(v, min, max, field) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw bad(`Valor inválido em "${field}".`);
  return n;
}
function email(v) {
  const s = str(v, 160, 'E-mail', true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw bad('E-mail inválido.');
  return s;
}
function password(v) {
  const s = v == null ? '' : String(v);
  if (s.length < 8) throw bad('A senha precisa ter pelo menos 8 caracteres.');
  if (s.length > 200) throw bad('Senha longa demais.');
  return s;
}

/* Datas no fuso da consultoria */
const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const localDate = (iso) => dateFmt.format(new Date(iso));
function addDays(dateStr, n) { const d = new Date(dateStr + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function weekStart(dateStr) { const d = new Date(dateStr + 'T12:00:00Z'); return addDays(dateStr, -((d.getUTCDay() + 6) % 7)); }
function daysBetween(a, b) { return Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000); }

/* ---------- Regras de acesso ---------- */
function publicUser(u) {
  return {
    id: u.id, role: u.role, name: u.name, email: u.email, active: !!u.active, isDemo: !!u.is_demo,
    mustChangePassword: !!u.must_change_password, goal: u.goal, splitName: u.split_name,
    weeklyTarget: u.weekly_target, createdAt: u.created_at
  };
}
/** Aluno: sempre o próprio id. Treinador: o aluno pedido em ?student= */
function targetStudent(ctx) {
  if (ctx.user.role === 'student') {
    if (ctx.query.student && Number(ctx.query.student) !== ctx.user.id) throw new HttpError(403, 'Acesso negado.');
    return ctx.user;
  }
  const s = one("SELECT * FROM users WHERE id = ? AND role = 'student'", Number(ctx.query.student));
  if (!s) throw new HttpError(404, 'Aluno não encontrado.');
  return s;
}
function getStudent(id) {
  const s = one("SELECT * FROM users WHERE id = ? AND role = 'student'", Number(id));
  if (!s) throw new HttpError(404, 'Aluno não encontrado.');
  return s;
}
function getWorkout(ctx, id, { write } = {}) {
  const w = one('SELECT * FROM workouts WHERE id = ?', Number(id));
  if (!w || (ctx.user.role === 'student' && w.student_id !== ctx.user.id)) throw new HttpError(404, 'Treino não encontrado.');
  if (write && ctx.user.role !== 'student') throw new HttpError(403, 'Somente o aluno registra o próprio treino.');
  return w;
}

/* ---------- Consultas compartilhadas ---------- */
function planFor(studentId) {
  const days = all('SELECT id, label, name, position FROM days WHERE student_id = ? AND archived = 0 ORDER BY position, id', studentId);
  const rows = all(`SELECT de.id, de.day_id AS dayId, de.exercise_id AS exerciseId, de.position, de.sets, de.reps_min AS repsMin,
      de.reps_max AS repsMax, de.notes, e.name, e.muscle_group AS muscleGroup,
      e.instructions, e.image
    FROM day_exercises de JOIN exercises e ON e.id = de.exercise_id JOIN days d ON d.id = de.day_id
    WHERE d.student_id = ? AND d.archived = 0 ORDER BY de.position, de.id`, studentId);
  return days.map((d) => ({ ...d, exercises: rows.filter((r) => r.dayId === d.id) }));
}
function splitLabel(student, days) {
  return student.split_name || days.map((d) => d.label).join('') || '';
}
function workoutSummaries(studentId, limit) {
  return all(`SELECT w.id, w.day_id AS dayId, w.day_label AS dayLabel, w.day_name AS dayName, w.started_at AS startedAt,
      w.finished_at AS finishedAt, w.notes,
      (SELECT COUNT(*) FROM workout_exercises we WHERE we.workout_id = w.id) AS exerciseCount,
      (SELECT COUNT(*) FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id
        WHERE we.workout_id = w.id AND s.reps IS NOT NULL) AS setCount,
      (SELECT COALESCE(SUM(s.weight * s.reps), 0) FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id
        WHERE we.workout_id = w.id AND s.weight IS NOT NULL AND s.reps IS NOT NULL) AS volume
    FROM workouts w WHERE w.student_id = ? ORDER BY w.started_at DESC LIMIT ?`, studentId, limit || 500);
}
function weekInfo(studentId, target) {
  const today = localDate(now());
  const monday = weekStart(today);
  const rows = all('SELECT started_at FROM workouts WHERE student_id = ? AND finished_at IS NOT NULL AND started_at >= ?',
    studentId, new Date(new Date(monday + 'T00:00:00Z').getTime() - 86400000).toISOString());
  const trained = new Set(rows.map((r) => localDate(r.started_at)).filter((d) => d >= monday));
  const days = Array.from({ length: 7 }, (_, i) => { const date = addDays(monday, i); return { date, trained: trained.has(date), today: date === today }; });
  const count = rows.filter((r) => localDate(r.started_at) >= monday).length;
  return { days, count, target };
}
function workoutDetail(w) {
  const exercises = all(`SELECT we.id, we.exercise_id AS exerciseId, we.exercise_name AS name, we.position, we.sets, we.reps_min AS repsMin,
      we.reps_max AS repsMax, we.notes, we.done_at AS doneAt,
      e.muscle_group AS muscleGroup, e.instructions, e.image
    FROM workout_exercises we JOIN exercises e ON e.id = we.exercise_id WHERE we.workout_id = ? ORDER BY we.position, we.id`, w.id);
  const sets = all(`SELECT s.workout_exercise_id AS weId, s.set_number AS n, s.weight, s.reps, s.note, s.updated_at AS updatedAt
    FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id WHERE we.workout_id = ? ORDER BY s.set_number`, w.id);
  for (const ex of exercises) {
    ex.logged = sets.filter((s) => s.weId === ex.id).map(({ weId, ...s }) => s);
    // Última sessão anterior do MESMO exercício (para comparar série com série)
    const prev = one(`SELECT we.id, w.started_at AS date FROM workout_exercises we JOIN workouts w ON w.id = we.workout_id
      WHERE w.student_id = ? AND we.exercise_id = ? AND w.started_at < ? AND w.id <> ?
        AND EXISTS (SELECT 1 FROM sets s WHERE s.workout_exercise_id = we.id AND s.reps IS NOT NULL)
      ORDER BY w.started_at DESC LIMIT 1`, w.student_id, ex.exerciseId, w.started_at, w.id);
    ex.previous = prev ? { date: prev.date, sets: all('SELECT set_number AS n, weight, reps FROM sets WHERE workout_exercise_id = ? ORDER BY set_number', prev.id) } : null;
  }
  return {
    id: w.id, studentId: w.student_id, dayId: w.day_id, dayLabel: w.day_label, dayName: w.day_name,
    startedAt: w.started_at, finishedAt: w.finished_at, notes: w.notes, exercises
  };
}
function progressFor(studentId, exerciseId) {
  const rows = all(`SELECT we.id AS weId, w.id AS workoutId, w.started_at AS date, w.finished_at AS finishedAt, w.day_label AS dayLabel,
      we.sets AS prescribedSets, we.reps_min AS repsMin, we.reps_max AS repsMax
    FROM workout_exercises we JOIN workouts w ON w.id = we.workout_id
    WHERE w.student_id = ? AND we.exercise_id = ? ORDER BY w.started_at`, studentId, exerciseId);
  const sets = all(`SELECT s.workout_exercise_id AS weId, s.set_number AS n, s.weight, s.reps, s.note
    FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id JOIN workouts w ON w.id = we.workout_id
    WHERE w.student_id = ? AND we.exercise_id = ? AND s.reps IS NOT NULL ORDER BY s.set_number`, studentId, exerciseId);
  return rows.map((r) => ({ ...r, sets: sets.filter((s) => s.weId === r.weId).map(({ weId, ...s }) => s) }))
    .filter((r) => r.sets.length);
}
function studentCard(s) {
  const days = all('SELECT label FROM days WHERE student_id = ? AND archived = 0 ORDER BY position, id', s.id);
  const last = one('SELECT started_at FROM workouts WHERE student_id = ? AND finished_at IS NOT NULL ORDER BY started_at DESC LIMIT 1', s.id);
  const total = one('SELECT COUNT(*) AS n FROM workouts WHERE student_id = ? AND finished_at IS NOT NULL', s.id).n;
  const today = localDate(now());
  return {
    ...publicUser(s), split: splitLabel(s, days), lastWorkoutAt: last ? last.started_at : null,
    daysSinceLast: last ? daysBetween(localDate(last.started_at), today) : null,
    totalWorkouts: total, week: weekInfo(s.id, s.weekly_target)
  };
}

/* ---------- Rotas ---------- */
const routes = [];
const route = (method, pattern, role, handler) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '(\\d+)'; }) + '$');
  routes.push({ method, re, keys, role, handler });
};
const ANY = 'any', ADMIN = 'admin', STUDENT = 'student', PUBLIC = 'public';

/* -- Sessão -- */
const loginAttempts = new Map();
function throttle(key) {
  const t = Date.now();
  const list = (loginAttempts.get(key) || []).filter((x) => t - x < 15 * 60000);
  if (list.length >= 10) throw new HttpError(429, 'Muitas tentativas. Aguarde alguns minutos e tente de novo.');
  list.push(t); loginAttempts.set(key, list);
}
function startSession(ctx, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  run('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?,?,?,?)', sha256(token), userId, now(), expires.toISOString());
  ctx.setCookie = `tb_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${ctx.secure ? '; Secure' : ''}`;
}
const needsSetup = () => !one("SELECT 1 AS x FROM users WHERE role = 'admin' LIMIT 1");

route('GET', '/api/state', PUBLIC, (ctx) => ({
  needsSetup: needsSetup(), user: ctx.user ? publicUser(ctx.user) : null,
  brand: getSetting('brand', 'TeamBat'), muscleGroups: MUSCLE_GROUPS
}));

route('POST', '/api/setup', PUBLIC, (ctx) => {
  if (!needsSetup()) throw new HttpError(403, 'A configuração inicial já foi feita.');
  const name = str(ctx.body.name, 80, 'Nome', true);
  const mail = email(ctx.body.email);
  const pass = password(ctx.body.password);
  const { id } = run("INSERT INTO users (role, name, email, pass_hash, created_at) VALUES ('admin',?,?,?,?)", name, mail, hashPassword(pass), now());
  if (ctx.body.demo) demo.load({ all, one, run, tx, hashPassword });
  startSession(ctx, id);
  return { user: publicUser(one('SELECT * FROM users WHERE id = ?', id)) };
});

route('POST', '/api/login', PUBLIC, (ctx) => {
  const mail = String(ctx.body.email || '').trim().toLowerCase();
  throttle(ctx.ip + '|' + mail);
  const u = one('SELECT * FROM users WHERE email = ?', mail);
  // Mesmo custo e mesma mensagem para e-mail inexistente e senha errada
  const ok = verifyPassword(String(ctx.body.password || ''), u ? u.pass_hash : 'scrypt$00$00') && !!u;
  if (!ok) throw new HttpError(401, 'E-mail ou senha incorretos.');
  if (!u.active) throw new HttpError(403, 'Esta conta está desativada. Fale com o seu treinador.');
  loginAttempts.delete(ctx.ip + '|' + mail);
  startSession(ctx, u.id);
  return { user: publicUser(u) };
});

route('POST', '/api/logout', PUBLIC, (ctx) => {
  if (ctx.token) run('DELETE FROM sessions WHERE token_hash = ?', sha256(ctx.token));
  ctx.setCookie = 'tb_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
  return { ok: true };
});

route('POST', '/api/password', ANY, (ctx) => {
  if (!verifyPassword(String(ctx.body.current || ''), ctx.user.pass_hash)) throw bad('A senha atual está incorreta.');
  const pass = password(ctx.body.password);
  run('UPDATE users SET pass_hash = ?, must_change_password = 0 WHERE id = ?', hashPassword(pass), ctx.user.id);
  // Encerra as outras sessões desta conta
  run('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?', ctx.user.id, sha256(ctx.token));
  return { ok: true };
});

route('PUT', '/api/profile', ANY, (ctx) => {
  run('UPDATE users SET name = ? WHERE id = ?', str(ctx.body.name, 80, 'Nome', true), ctx.user.id);
  return { user: publicUser(one('SELECT * FROM users WHERE id = ?', ctx.user.id)) };
});

/* -- Aluno (e treinador com ?student=) -- */
route('GET', '/api/home', STUDENT, (ctx) => {
  const u = ctx.user;
  const days = planFor(u.id);
  const list = workoutSummaries(u.id, 30);
  const open = list.find((w) => !w.finishedAt) || null;
  const last = list.find((w) => w.finishedAt) || null;
  let next = days[0] || null;
  if (last && days.length) {
    const i = days.findIndex((d) => d.id === last.dayId);
    next = days[(i + 1) % days.length];
  }
  return {
    days, split: splitLabel(u, days), openWorkout: open, lastWorkout: last,
    nextDayId: open ? open.dayId : next ? next.id : null, week: weekInfo(u.id, u.weekly_target)
  };
});

route('GET', '/api/plan', ANY, (ctx) => {
  const s = targetStudent(ctx);
  const days = planFor(s.id);
  return { days, split: splitLabel(s, days) };
});

route('GET', '/api/workouts', ANY, (ctx) => ({ workouts: workoutSummaries(targetStudent(ctx).id) }));

route('POST', '/api/workouts', STUDENT, (ctx) => {
  const day = one('SELECT * FROM days WHERE id = ? AND student_id = ? AND archived = 0', Number(ctx.body.dayId), ctx.user.id);
  if (!day) throw new HttpError(404, 'Treino não encontrado na sua ficha.');
  const open = one('SELECT * FROM workouts WHERE student_id = ? AND finished_at IS NULL', ctx.user.id);
  if (open) {
    if (open.day_id === day.id) return { workout: workoutDetail(open), resumed: true };
    throw new HttpError(409, `Você tem o treino ${open.day_label} em andamento. Conclua ou descarte antes de iniciar outro.`);
  }
  const items = all(`SELECT de.*, e.name FROM day_exercises de JOIN exercises e ON e.id = de.exercise_id WHERE de.day_id = ? ORDER BY de.position, de.id`, day.id);
  if (!items.length) throw bad('Este treino ainda não tem exercícios cadastrados.');
  const id = tx(() => {
    const w = run('INSERT INTO workouts (student_id, day_id, day_label, day_name, started_at) VALUES (?,?,?,?,?)', ctx.user.id, day.id, day.label, day.name, now());
    items.forEach((it, i) => run(`INSERT INTO workout_exercises (workout_id, exercise_id, exercise_name, position, sets, reps_min, reps_max, notes)
      VALUES (?,?,?,?,?,?,?,?)`, w.id, it.exercise_id, it.name, i, it.sets, it.reps_min, it.reps_max, it.notes));
    return w.id;
  });
  return { workout: workoutDetail(one('SELECT * FROM workouts WHERE id = ?', id)) };
});

route('GET', '/api/workouts/:id', ANY, (ctx) => ({ workout: workoutDetail(getWorkout(ctx, ctx.params.id)) }));

function ownExercise(w, weId) {
  const we = one('SELECT * FROM workout_exercises WHERE id = ? AND workout_id = ?', Number(weId), w.id);
  if (!we) throw new HttpError(404, 'Exercício não encontrado neste treino.');
  return we;
}
route('PUT', '/api/workouts/:id/exercises/:weId/sets/:n', STUDENT, (ctx) => {
  const w = getWorkout(ctx, ctx.params.id, { write: true });
  const we = ownExercise(w, ctx.params.weId);
  const n = int(ctx.params.n, 1, 15, 'Série');
  const b = ctx.body;
  const weight = b.weight === null || b.weight === '' || b.weight === undefined ? null : Number(String(b.weight).replace(',', '.'));
  const reps = b.reps === null || b.reps === '' || b.reps === undefined ? null : Number(b.reps);
  if (weight !== null && !(weight >= 0 && weight <= 1000)) throw bad('Carga inválida.');
  if (reps !== null && !(Number.isInteger(reps) && reps >= 0 && reps <= 300)) throw bad('Número de repetições inválido.');
  const note = str(b.note, 300, 'Observação');
  if (weight === null && reps === null && !note) {
    run('DELETE FROM sets WHERE workout_exercise_id = ? AND set_number = ?', we.id, n);
    return { set: null };
  }
  run(`INSERT INTO sets (workout_exercise_id, set_number, weight, reps, note, updated_at) VALUES (?,?,?,?,?,?)
    ON CONFLICT(workout_exercise_id, set_number) DO UPDATE SET weight = excluded.weight, reps = excluded.reps, note = excluded.note, updated_at = excluded.updated_at`,
    we.id, n, weight, reps, note, now());
  return { set: { n, weight, reps, note } };
});

route('POST', '/api/workouts/:id/exercises/:weId/done', STUDENT, (ctx) => {
  const w = getWorkout(ctx, ctx.params.id, { write: true });
  const we = ownExercise(w, ctx.params.weId);
  run('UPDATE workout_exercises SET done_at = ? WHERE id = ?', ctx.body.done === false ? null : now(), we.id);
  return { ok: true };
});

route('POST', '/api/workouts/:id/finish', STUDENT, (ctx) => {
  const w = getWorkout(ctx, ctx.params.id, { write: true });
  const n = one(`SELECT COUNT(*) AS n FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id WHERE we.workout_id = ? AND s.reps IS NOT NULL`, w.id).n;
  if (!n) throw bad('Registre pelo menos uma série antes de concluir o treino.');
  run('UPDATE workouts SET finished_at = COALESCE(finished_at, ?), notes = ? WHERE id = ?', now(), str(ctx.body.notes, 500, 'Observações'), w.id);
  return { workout: workoutDetail(one('SELECT * FROM workouts WHERE id = ?', w.id)) };
});

route('DELETE', '/api/workouts/:id', ANY, (ctx) => {
  const w = getWorkout(ctx, ctx.params.id);
  if (ctx.user.role === 'student' && w.finished_at) throw new HttpError(403, 'Treinos concluídos só podem ser removidos pelo treinador.');
  run('DELETE FROM workouts WHERE id = ?', w.id);
  return { ok: true };
});

route('GET', '/api/progress/exercises', ANY, (ctx) => {
  const s = targetStudent(ctx);
  return {
    exercises: all(`SELECT e.id, e.name, e.muscle_group AS muscleGroup, COUNT(DISTINCT w.id) AS sessions, MAX(w.started_at) AS lastAt
      FROM workout_exercises we JOIN workouts w ON w.id = we.workout_id JOIN exercises e ON e.id = we.exercise_id
      WHERE w.student_id = ? AND EXISTS (SELECT 1 FROM sets s WHERE s.workout_exercise_id = we.id AND s.reps IS NOT NULL)
      GROUP BY e.id ORDER BY e.muscle_group, e.name`, s.id)
  };
});
route('GET', '/api/progress', ANY, (ctx) => {
  const s = targetStudent(ctx);
  const ex = one('SELECT id, name, muscle_group AS muscleGroup FROM exercises WHERE id = ?', Number(ctx.query.exercise));
  if (!ex) throw new HttpError(404, 'Exercício não encontrado.');
  return { exercise: ex, sessions: progressFor(s.id, ex.id) };
});

route('GET', '/api/exercises', ANY, () => ({
  exercises: all('SELECT id, name, muscle_group AS muscleGroup, instructions, image, archived FROM exercises ORDER BY muscle_group, name')
}));

/* -- Treinador -- */
route('GET', '/api/admin/dashboard', ADMIN, () => {
  const inactiveAfter = Number(getSetting('inactive_days', '7'));
  const students = all("SELECT * FROM users WHERE role = 'student' AND active = 1 ORDER BY name").map(studentCard);
  const today = localDate(now());
  const monday = weekStart(today);
  const since = addDays(today, -13);
  const recent = all(`SELECT w.id, w.student_id AS studentId, u.name AS studentName, u.is_demo AS isDemo, w.day_label AS dayLabel, w.day_name AS dayName,
      w.started_at AS startedAt, w.finished_at AS finishedAt,
      (SELECT COUNT(*) FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id WHERE we.workout_id = w.id AND s.reps IS NOT NULL) AS setCount
    FROM workouts w JOIN users u ON u.id = w.student_id
    WHERE w.finished_at IS NOT NULL AND u.active = 1 AND w.started_at >= ? ORDER BY w.started_at DESC`,
    new Date(new Date(since + 'T00:00:00Z').getTime() - 86400000).toISOString());
  const perDay = Array.from({ length: 14 }, (_, i) => ({ date: addDays(since, i), count: 0 }));
  recent.forEach((w) => { const d = perDay.find((p) => p.date === localDate(w.startedAt)); if (d) d.count++; });
  const weekWorkouts = recent.filter((w) => localDate(w.startedAt) >= monday);
  const target = students.reduce((a, s) => a + s.weeklyTarget, 0);
  return {
    inactiveAfter, activeStudents: students.length,
    inactiveAccounts: one("SELECT COUNT(*) AS n FROM users WHERE role = 'student' AND active = 0").n,
    trainedRecently: students.filter((s) => s.daysSinceLast !== null && s.daysSinceLast < inactiveAfter),
    withoutRecent: students.filter((s) => s.daysSinceLast === null || s.daysSinceLast >= inactiveAfter),
    weekWorkouts: weekWorkouts.length, weekSets: weekWorkouts.reduce((a, w) => a + w.setCount, 0),
    weekTarget: target, adherence: target ? Math.round((students.reduce((a, s) => a + Math.min(s.week.count, s.weeklyTarget), 0) / target) * 100) : null,
    perDay, recent: recent.slice(0, 12), hasDemo: !!one('SELECT 1 AS x FROM users WHERE is_demo = 1 LIMIT 1')
  };
});

route('GET', '/api/admin/students', ADMIN, () => ({
  students: all("SELECT * FROM users WHERE role = 'student' ORDER BY active DESC, name").map(studentCard)
}));

route('POST', '/api/admin/students', ADMIN, (ctx) => {
  const b = ctx.body;
  const mail = email(b.email);
  if (one('SELECT 1 AS x FROM users WHERE email = ?', mail)) throw bad('Já existe uma conta com este e-mail.');
  const pass = b.password ? password(b.password) : tempPassword();
  const { id } = run(`INSERT INTO users (role, name, email, pass_hash, must_change_password, goal, split_name, weekly_target, created_at)
    VALUES ('student',?,?,?,1,?,?,?,?)`, str(b.name, 80, 'Nome', true), mail, hashPassword(pass), str(b.goal, 200, 'Objetivo'),
    str(b.splitName, 30, 'Divisão'), b.weeklyTarget == null || b.weeklyTarget === '' ? 4 : int(b.weeklyTarget, 1, 7, 'Treinos por semana'), now());
  return { student: studentCard(getStudent(id)), temporaryPassword: pass };
});

route('GET', '/api/admin/students/:id', ADMIN, (ctx) => {
  const s = getStudent(ctx.params.id);
  const workouts = workoutSummaries(s.id);
  const finished = workouts.filter((w) => w.finishedAt);
  const today = localDate(now());
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = addDays(weekStart(today), -7 * (7 - i));
    return { start, count: finished.filter((w) => { const d = localDate(w.startedAt); return d >= start && d < addDays(start, 7); }).length };
  });
  return {
    student: studentCard(s), days: planFor(s.id), workouts, weeks,
    notes: all('SELECT id, text, created_at AS createdAt FROM coach_notes WHERE student_id = ? ORDER BY created_at DESC', s.id)
  };
});

route('PUT', '/api/admin/students/:id', ADMIN, (ctx) => {
  const s = getStudent(ctx.params.id);
  const b = ctx.body;
  const mail = b.email === undefined ? s.email : email(b.email);
  if (mail !== s.email && one('SELECT 1 AS x FROM users WHERE email = ?', mail)) throw bad('Já existe uma conta com este e-mail.');
  const active = b.active === undefined ? s.active : b.active ? 1 : 0;
  run('UPDATE users SET name = ?, email = ?, goal = ?, split_name = ?, weekly_target = ?, active = ? WHERE id = ?',
    b.name === undefined ? s.name : str(b.name, 80, 'Nome', true), mail,
    b.goal === undefined ? s.goal : str(b.goal, 200, 'Objetivo'),
    b.splitName === undefined ? s.split_name : str(b.splitName, 30, 'Divisão'),
    b.weeklyTarget === undefined ? s.weekly_target : int(b.weeklyTarget, 1, 7, 'Treinos por semana'), active, s.id);
  if (!active) run('DELETE FROM sessions WHERE user_id = ?', s.id); // desativar derruba o acesso na hora
  return { student: studentCard(getStudent(s.id)) };
});

route('POST', '/api/admin/students/:id/reset-password', ADMIN, (ctx) => {
  const s = getStudent(ctx.params.id);
  const pass = tempPassword();
  run('UPDATE users SET pass_hash = ?, must_change_password = 1 WHERE id = ?', hashPassword(pass), s.id);
  run('DELETE FROM sessions WHERE user_id = ?', s.id);
  return { temporaryPassword: pass };
});

route('POST', '/api/admin/students/:id/notes', ADMIN, (ctx) => {
  const s = getStudent(ctx.params.id);
  const { id } = run('INSERT INTO coach_notes (student_id, text, created_at) VALUES (?,?,?)', s.id, str(ctx.body.text, 2000, 'Observação', true), now());
  return { note: one('SELECT id, text, created_at AS createdAt FROM coach_notes WHERE id = ?', id) };
});
route('DELETE', '/api/admin/notes/:id', ADMIN, (ctx) => { run('DELETE FROM coach_notes WHERE id = ?', Number(ctx.params.id)); return { ok: true }; });

/* Fichas */
route('POST', '/api/admin/students/:id/days', ADMIN, (ctx) => {
  const s = getStudent(ctx.params.id);
  const pos = one('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM days WHERE student_id = ?', s.id).p;
  run('INSERT INTO days (student_id, label, name, position) VALUES (?,?,?,?)', s.id, str(ctx.body.label, 12, 'Divisão', true), str(ctx.body.name, 60, 'Nome do treino'), pos);
  return { days: planFor(s.id) };
});
function getDay(id) {
  const d = one('SELECT * FROM days WHERE id = ? AND archived = 0', Number(id));
  if (!d) throw new HttpError(404, 'Treino não encontrado.');
  return d;
}
route('PUT', '/api/admin/days/:id', ADMIN, (ctx) => {
  const d = getDay(ctx.params.id);
  run('UPDATE days SET label = ?, name = ? WHERE id = ?', str(ctx.body.label, 12, 'Divisão', true), str(ctx.body.name, 60, 'Nome do treino'), d.id);
  return { days: planFor(d.student_id) };
});
route('DELETE', '/api/admin/days/:id', ADMIN, (ctx) => {
  const d = getDay(ctx.params.id);
  run('UPDATE days SET archived = 1 WHERE id = ?', d.id); // arquiva: o histórico continua intacto
  return { days: planFor(d.student_id) };
});
function prescription(b, base) {
  const p = {
    sets: b.sets === undefined && base ? base.sets : int(b.sets, 1, 12, 'Séries'),
    repsMin: b.repsMin === undefined && base ? base.reps_min : int(b.repsMin, 1, 100, 'Repetições (mínimo)'),
    repsMax: b.repsMax === undefined && base ? base.reps_max : int(b.repsMax, 1, 100, 'Repetições (máximo)'),
    notes: b.notes === undefined && base ? base.notes : str(b.notes, 500, 'Observações')
  };
  if (p.repsMax < p.repsMin) throw bad('O máximo de repetições não pode ser menor que o mínimo.');
  return p;
}
route('POST', '/api/admin/days/:id/exercises', ADMIN, (ctx) => {
  const d = getDay(ctx.params.id);
  const ex = one('SELECT id FROM exercises WHERE id = ? AND archived = 0', Number(ctx.body.exerciseId));
  if (!ex) throw new HttpError(404, 'Exercício não encontrado na biblioteca.');
  const p = prescription(ctx.body);
  const pos = one('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM day_exercises WHERE day_id = ?', d.id).p;
  run('INSERT INTO day_exercises (day_id, exercise_id, position, sets, reps_min, reps_max, notes) VALUES (?,?,?,?,?,?,?)',
    d.id, ex.id, pos, p.sets, p.repsMin, p.repsMax, p.notes);
  return { days: planFor(d.student_id) };
});
function getDayExercise(id) {
  const de = one('SELECT de.*, d.student_id FROM day_exercises de JOIN days d ON d.id = de.day_id WHERE de.id = ?', Number(id));
  if (!de) throw new HttpError(404, 'Item da ficha não encontrado.');
  return de;
}
route('PUT', '/api/admin/day-exercises/:id', ADMIN, (ctx) => {
  const de = getDayExercise(ctx.params.id);
  const p = prescription(ctx.body, de);
  run('UPDATE day_exercises SET sets = ?, reps_min = ?, reps_max = ?, notes = ? WHERE id = ?', p.sets, p.repsMin, p.repsMax, p.notes, de.id);
  return { days: planFor(de.student_id) };
});
route('DELETE', '/api/admin/day-exercises/:id', ADMIN, (ctx) => {
  const de = getDayExercise(ctx.params.id);
  run('DELETE FROM day_exercises WHERE id = ?', de.id);
  return { days: planFor(de.student_id) };
});
route('POST', '/api/admin/days/:id/reorder', ADMIN, (ctx) => {
  const d = getDay(ctx.params.id);
  const ids = Array.isArray(ctx.body.ids) ? ctx.body.ids.map(Number) : [];
  tx(() => ids.forEach((id, i) => run('UPDATE day_exercises SET position = ? WHERE id = ? AND day_id = ?', i, id, d.id)));
  return { days: planFor(d.student_id) };
});

/* Biblioteca */
function exerciseFields(b) {
  const group = str(b.muscleGroup, 40, 'Grupo muscular', true);
  if (!MUSCLE_GROUPS.includes(group)) throw bad('Grupo muscular inválido.');
  let image = b.image == null || b.image === '' ? null : String(b.image);
  if (image && (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image) || image.length > 700000)) throw bad('Imagem inválida ou grande demais.');
  return { name: str(b.name, 80, 'Nome do exercício', true), group, instructions: str(b.instructions, 600, 'Instruções'), image };
}
route('POST', '/api/admin/exercises', ADMIN, (ctx) => {
  const f = exerciseFields(ctx.body);
  const { id } = run('INSERT INTO exercises (name, muscle_group, instructions, image, created_at) VALUES (?,?,?,?,?)', f.name, f.group, f.instructions, f.image, now());
  return { id };
});
route('PUT', '/api/admin/exercises/:id', ADMIN, (ctx) => {
  const ex = one('SELECT * FROM exercises WHERE id = ?', Number(ctx.params.id));
  if (!ex) throw new HttpError(404, 'Exercício não encontrado.');
  const f = exerciseFields({ ...ctx.body, image: ctx.body.image === undefined ? ex.image : ctx.body.image });
  run('UPDATE exercises SET name = ?, muscle_group = ?, instructions = ?, image = ?, archived = ? WHERE id = ?',
    f.name, f.group, f.instructions, f.image, ctx.body.archived ? 1 : 0, ex.id);
  return { ok: true };
});

/* Configurações e dados de demonstração */
route('GET', '/api/admin/settings', ADMIN, () => ({
  brand: getSetting('brand', 'TeamBat'), inactiveDays: Number(getSetting('inactive_days', '7')), timezone: TIMEZONE,
  demo: all('SELECT id, name, email FROM users WHERE is_demo = 1 ORDER BY name'), demoPassword: demo.PASSWORD
}));
route('PUT', '/api/admin/settings', ADMIN, (ctx) => {
  if (ctx.body.brand !== undefined) setSetting('brand', str(ctx.body.brand, 40, 'Nome da consultoria', true));
  if (ctx.body.inactiveDays !== undefined) setSetting('inactive_days', int(ctx.body.inactiveDays, 2, 60, 'Dias sem treinar'));
  return { ok: true };
});
route('POST', '/api/admin/demo', ADMIN, (ctx) => {
  if (ctx.body.action === 'remove') run('DELETE FROM users WHERE is_demo = 1');
  else if (!one('SELECT 1 AS x FROM users WHERE is_demo = 1 LIMIT 1')) demo.load({ all, one, run, tx, hashPassword });
  return { ok: true };
});

/* ---------- Servidor HTTP ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon'
};
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > 1.5e6) { reject(new HttpError(413, 'Conteúdo grande demais.')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { const v = JSON.parse(Buffer.concat(chunks).toString('utf8')); resolve(v && typeof v === 'object' ? v : {}); }
      catch { reject(bad('JSON inválido.')); }
    });
    req.on('error', reject);
  });
}
function sendJson(res, status, data, extra) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS, ...extra });
  res.end(JSON.stringify(data));
}
function serveStatic(req, res, pathname) {
  let file = path.normalize(path.join(PUBLIC_DIR, decodeURIComponent(pathname)));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC_DIR, 'index.html');
  const ext = path.extname(file);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': ext === '.woff2' ? 'public, max-age=31536000, immutable' : 'no-cache', ...SECURITY_HEADERS
  });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

async function handleApi(req, res, url) {
  const ctx = {
    query: Object.fromEntries(url.searchParams), body: {}, params: {}, user: null, token: null,
    ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '',
    secure: req.headers['x-forwarded-proto'] === 'https' || process.env.COOKIE_SECURE === '1'
  };
  try {
    const m = /(?:^|;\s*)tb_session=([^;]+)/.exec(req.headers.cookie || '');
    if (m) {
      const s = one(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1`, sha256(m[1]), now());
      if (s) { ctx.user = s; ctx.token = m[1]; }
    }
    let match = null;
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const mm = r.re.exec(url.pathname);
      if (mm) { match = r; r.keys.forEach((k, i) => { ctx.params[k] = mm[i + 1]; }); break; }
    }
    if (!match) throw new HttpError(404, 'Rota não encontrada.');
    if (req.method !== 'GET') {
      // Proteção contra CSRF: só aceitamos chamadas feitas pelo próprio app
      if (req.headers['x-requested-with'] !== 'teambat') throw new HttpError(403, 'Requisição não autorizada.');
      ctx.body = await readBody(req);
    }
    if (match.role !== PUBLIC) {
      if (!ctx.user) throw new HttpError(401, 'Faça login para continuar.');
      if (match.role !== ANY && match.role !== ctx.user.role) throw new HttpError(403, 'Acesso negado.');
    }
    const data = match.handler(ctx);
    sendJson(res, 200, data, ctx.setCookie ? { 'Set-Cookie': ctx.setCookie } : undefined);
  } catch (e) {
    if (!(e instanceof HttpError)) console.error('[erro]', req.method, url.pathname, e);
    sendJson(res, e instanceof HttpError ? e.status : 500, { error: e instanceof HttpError ? e.message : 'Erro interno. Tente novamente.' });
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) return void handleApi(req, res, url);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  serveStatic(req, res, url.pathname);
});

setInterval(() => run('DELETE FROM sessions WHERE expires_at < ?', now()), 6 * 3600000).unref();

if (require.main === module) {
  server.listen(PORT, () => console.log(`TeamBat rodando em http://localhost:${PORT}  (banco: ${DB_FILE})`));
}
module.exports = { server, db };
