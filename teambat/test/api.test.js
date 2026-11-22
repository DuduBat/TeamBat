/* Testes da API: fluxos principais e regras de permissão.
   Rodar com:  npm test   (usa um banco em memória, não toca nos dados reais) */
'use strict';
process.env.DB_FILE = ':memory:';
const test = require('node:test');
const assert = require('node:assert/strict');
const { server } = require('../server');

let base;
function client() {
  let cookie = '';
  return async (method, path, body, headers) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'teambat', ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, data: await res.json() };
  };
}
test.before(() => new Promise((r) => server.listen(0, () => { base = 'http://127.0.0.1:' + server.address().port; r(); })));
test.after(() => new Promise((r) => server.close(r)));

const admin = client(), ana = client(), bia = client(), anon = client();
const ctx = {};

test('configuração inicial cria o treinador e só funciona uma vez', async () => {
  assert.equal((await anon('GET', '/api/state')).data.needsSetup, true);
  const r = await admin('POST', '/api/setup', { name: 'Treinador', email: 'coach@test.dev', password: 'senha-forte-1' });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.role, 'admin');
  assert.equal((await anon('POST', '/api/setup', { name: 'X', email: 'x@test.dev', password: 'senha-forte-2' })).status, 403);
});

test('rotas exigem login e o cabeçalho anti-CSRF', async () => {
  assert.equal((await anon('GET', '/api/admin/students')).status, 401);
  assert.equal((await admin('POST', '/api/admin/students', { name: 'Z', email: 'z@test.dev' }, { 'X-Requested-With': '' })).status, 403);
});

test('1. treinador cadastra alunos', async () => {
  const a = await admin('POST', '/api/admin/students', { name: 'Ana Teste', email: 'ana@test.dev', weeklyTarget: 3 });
  const b = await admin('POST', '/api/admin/students', { name: 'Bia Teste', email: 'bia@test.dev' });
  assert.equal(a.status, 200);
  assert.ok(a.data.temporaryPassword.length >= 8);
  ctx.ana = a.data.student.id; ctx.anaPass = a.data.temporaryPassword;
  ctx.bia = b.data.student.id; ctx.biaPass = b.data.temporaryPassword;
  assert.equal((await admin('POST', '/api/admin/students', { name: 'Dup', email: 'ana@test.dev' })).status, 400);
});

test('2. treinador monta a ficha', async () => {
  const lib = (await admin('GET', '/api/exercises')).data.exercises;
  ctx.supino = lib.find((e) => e.name === 'Supino inclinado com halteres').id;
  ctx.puxada = lib.find((e) => e.name === 'Puxada alta na polia').id;
  let r = await admin('POST', `/api/admin/students/${ctx.ana}/days`, { label: 'A', name: 'Peito' });
  ctx.dayA = r.data.days[0].id;
  r = await admin('POST', `/api/admin/days/${ctx.dayA}/exercises`, { exerciseId: ctx.supino, sets: 3, repsMin: 8, repsMax: 12, notes: 'Controle a descida' });
  r = await admin('POST', `/api/admin/days/${ctx.dayA}/exercises`, { exerciseId: ctx.puxada, sets: 2, repsMin: 10, repsMax: 12, notes: '' });
  assert.equal(r.data.days[0].exercises.length, 2);
  const ids = r.data.days[0].exercises.map((e) => e.id).reverse();
  r = await admin('POST', `/api/admin/days/${ctx.dayA}/reorder`, { ids });
  assert.equal(r.data.days[0].exercises[0].exerciseId, ctx.puxada);
  r = await admin('POST', `/api/admin/days/${ctx.dayA}/reorder`, { ids: ids.reverse() });
  assert.equal(r.data.days[0].exercises[0].exerciseId, ctx.supino);
  assert.equal((await admin('POST', `/api/admin/days/${ctx.dayA}/exercises`, { exerciseId: ctx.supino, sets: 3, repsMin: 12, repsMax: 8 })).status, 400);
  // ficha da Bia
  r = await admin('POST', `/api/admin/students/${ctx.bia}/days`, { label: 'A', name: 'Geral' });
  ctx.biaDay = r.data.days[0].id;
  await admin('POST', `/api/admin/days/${ctx.biaDay}/exercises`, { exerciseId: ctx.supino, sets: 3, repsMin: 8, repsMax: 12 });
});

test('3. aluno faz login e vê a própria ficha', async () => {
  assert.equal((await ana('POST', '/api/login', { email: 'ana@test.dev', password: 'errada' })).status, 401);
  const r = await ana('POST', '/api/login', { email: 'ANA@test.dev', password: ctx.anaPass });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.mustChangePassword, true);
  await bia('POST', '/api/login', { email: 'bia@test.dev', password: ctx.biaPass });
  const home = (await ana('GET', '/api/home')).data;
  assert.equal(home.days.length, 1);
  assert.equal(home.days[0].exercises[0].name, 'Supino inclinado com halteres');
  assert.equal(home.days[0].exercises[0].notes, 'Controle a descida');
  assert.equal('restSeconds' in home.days[0].exercises[0], false); // descanso removido do sistema
  assert.equal(home.nextDayId, ctx.dayA);
});

test('4 e 5. aluno registra carga e repetições por série e os dados ficam salvos', async () => {
  let r = await ana('POST', '/api/workouts', { dayId: ctx.dayA });
  assert.equal(r.status, 200);
  const w = r.data.workout; ctx.w1 = w.id; ctx.we1 = w.exercises[0].id;
  assert.equal((await ana('POST', `/api/workouts/${w.id}/finish`, {})).status, 400); // sem séries
  await ana('PUT', `/api/workouts/${w.id}/exercises/${ctx.we1}/sets/1`, { weight: 30, reps: 12 });
  await ana('PUT', `/api/workouts/${w.id}/exercises/${ctx.we1}/sets/2`, { weight: '32,5', reps: 10, note: 'pesado' });
  await ana('PUT', `/api/workouts/${w.id}/exercises/${ctx.we1}/sets/3`, { weight: 32, reps: 9 });
  await ana('PUT', `/api/workouts/${w.id}/exercises/${ctx.we1}/sets/2`, { weight: 32, reps: 10, note: 'pesado' }); // edição
  assert.equal((await ana('PUT', `/api/workouts/${w.id}/exercises/${ctx.we1}/sets/1`, { weight: -5, reps: 12 })).status, 400);
  await ana('POST', `/api/workouts/${w.id}/exercises/${ctx.we1}/done`, { done: true });
  // "fechou o app": uma nova leitura traz tudo de volta
  r = await ana('POST', '/api/workouts', { dayId: ctx.dayA });
  assert.equal(r.data.resumed, true);
  assert.deepEqual(r.data.workout.exercises[0].logged.map((s) => [s.n, s.weight, s.reps]), [[1, 30, 12], [2, 32, 10], [3, 32, 9]]);
  assert.ok(r.data.workout.exercises[0].doneAt);
  r = await ana('POST', `/api/workouts/${w.id}/finish`, { notes: 'bom treino' });
  assert.ok(r.data.workout.finishedAt);
});

test('6. histórico e comparação com a sessão anterior (série a série)', async () => {
  const list = (await ana('GET', '/api/workouts')).data.workouts;
  assert.equal(list.length, 1);
  assert.equal(list[0].setCount, 3);
  assert.equal(list[0].volume, 30 * 12 + 32 * 10 + 32 * 9);
  await new Promise((r) => setTimeout(r, 15));
  const r = await ana('POST', '/api/workouts', { dayId: ctx.dayA });
  const ex = r.data.workout.exercises[0];
  ctx.w2 = r.data.workout.id;
  assert.deepEqual(ex.previous.sets.map((s) => [s.n, s.weight, s.reps]), [[1, 30, 12], [2, 32, 10], [3, 32, 9]]);
  assert.equal(r.data.workout.exercises[1].previous, null); // exercícios diferentes não se misturam
  await ana('PUT', `/api/workouts/${ctx.w2}/exercises/${ex.id}/sets/1`, { weight: 32, reps: 12 });
  await ana('POST', `/api/workouts/${ctx.w2}/finish`, {});
});

test('7. treinador vê a progressão por exercício', async () => {
  const exs = (await admin('GET', `/api/progress/exercises?student=${ctx.ana}`)).data.exercises;
  assert.deepEqual(exs.map((e) => e.name), ['Supino inclinado com halteres']);
  const p = (await admin('GET', `/api/progress?student=${ctx.ana}&exercise=${ctx.supino}`)).data;
  assert.equal(p.sessions.length, 2);
  assert.equal(p.sessions[0].sets.length, 3);
  assert.equal(p.sessions[1].sets[0].weight, 32);
  const detail = (await admin('GET', `/api/admin/students/${ctx.ana}`)).data;
  assert.equal(detail.workouts.length, 2);
  const dash = (await admin('GET', '/api/admin/dashboard')).data;
  assert.equal(dash.activeStudents, 2);
  assert.equal(dash.weekWorkouts, 2);
  assert.equal(dash.withoutRecent.length, 1);
});

test('editar a ficha não altera o histórico', async () => {
  const days = (await admin('GET', `/api/plan?student=${ctx.ana}`)).data.days;
  const item = days[0].exercises[0];
  await admin('PUT', `/api/admin/day-exercises/${item.id}`, { sets: 5, repsMin: 5, repsMax: 6, notes: 'novo' });
  await admin('DELETE', `/api/admin/day-exercises/${days[0].exercises[1].id}`);
  const old = (await admin('GET', `/api/workouts/${ctx.w1}`)).data.workout;
  assert.equal(old.exercises.length, 2);
  assert.equal(old.exercises[0].sets, 3);
  assert.equal(old.exercises[0].logged.length, 3);
  await admin('DELETE', `/api/admin/days/${ctx.dayA}`);
  assert.equal((await admin('GET', `/api/workouts?student=${ctx.ana}`)).data.workouts.length, 2);
  assert.equal((await admin('GET', `/api/progress?student=${ctx.ana}&exercise=${ctx.supino}`)).data.sessions.length, 2);
});

test('um aluno não acessa dados de outro nem rotas do treinador', async () => {
  assert.equal((await bia('GET', `/api/workouts/${ctx.w1}`)).status, 404);
  assert.equal((await bia('GET', `/api/workouts?student=${ctx.ana}`)).status, 403);
  assert.equal((await bia('GET', `/api/progress?student=${ctx.ana}&exercise=${ctx.supino}`)).status, 403);
  assert.equal((await bia('GET', `/api/plan?student=${ctx.ana}`)).status, 403);
  assert.equal((await bia('PUT', `/api/workouts/${ctx.w1}/exercises/${ctx.we1}/sets/1`, { weight: 1, reps: 1 })).status, 404);
  assert.equal((await bia('DELETE', `/api/workouts/${ctx.w1}`)).status, 404);
  assert.equal((await bia('POST', '/api/workouts', { dayId: ctx.dayA })).status, 404);
  assert.equal((await bia('GET', '/api/admin/students')).status, 403);
  assert.equal((await bia('GET', `/api/admin/students/${ctx.ana}`)).status, 403);
  assert.equal((await bia('POST', '/api/admin/students', { name: 'H', email: 'h@test.dev' })).status, 403);
  assert.equal((await bia('GET', '/api/workouts')).data.workouts.length, 0);
  assert.equal((await ana('DELETE', `/api/workouts/${ctx.w1}`)).status, 403); // concluído: só o treinador remove
});

test('troca de senha, redefinição e desativação', async () => {
  assert.equal((await ana('POST', '/api/password', { current: 'x', password: 'nova-senha-1' })).status, 400);
  assert.equal((await ana('POST', '/api/password', { current: ctx.anaPass, password: 'curta' })).status, 400);
  assert.equal((await ana('POST', '/api/password', { current: ctx.anaPass, password: 'nova-senha-1' })).status, 200);
  assert.equal((await anon('GET', '/api/state')).data.user, null);
  await admin('PUT', `/api/admin/students/${ctx.bia}`, { active: false });
  assert.equal((await bia('GET', '/api/home')).status, 401); // sessão derrubada
  assert.equal((await bia('POST', '/api/login', { email: 'bia@test.dev', password: ctx.biaPass })).status, 403);
  await admin('PUT', `/api/admin/students/${ctx.bia}`, { active: true });
  const reset = await admin('POST', `/api/admin/students/${ctx.bia}/reset-password`, {});
  assert.equal((await bia('POST', '/api/login', { email: 'bia@test.dev', password: reset.data.temporaryPassword })).status, 200);
});

test('exercício cadastrado na montagem da ficha entra na biblioteca e na ficha do aluno', async () => {
  const created = await admin('POST', '/api/admin/exercises', { name: 'Supino declinado na máquina', muscleGroup: 'Peito', instructions: 'Teste' });
  assert.equal(created.status, 200);
  const lib = (await admin('GET', '/api/exercises')).data.exercises;
  assert.ok(lib.some((e) => e.id === created.data.id && !e.archived && e.muscleGroup === 'Peito'));
  const r = await admin('POST', `/api/admin/days/${ctx.biaDay}/exercises`, { exerciseId: created.data.id, sets: 3, repsMin: 8, repsMax: 12, notes: '' });
  assert.equal(r.status, 200);
  const plan = (await bia('GET', '/api/plan')).data.days[0];
  const item = plan.exercises.find((e) => e.exerciseId === created.data.id);
  assert.equal(item.name, 'Supino declinado na máquina');
  assert.equal(item.instructions, 'Teste');
  // mesmas validações do cadastro da Biblioteca
  assert.equal((await admin('POST', '/api/admin/exercises', { name: '', muscleGroup: 'Peito' })).status, 400);
  assert.equal((await bia('POST', '/api/admin/exercises', { name: 'X', muscleGroup: 'Peito' })).status, 403);
});

test('biblioteca, observações e dados de demonstração', async () => {
  const r = await admin('POST', '/api/admin/exercises', { name: 'Remada cavalinho', muscleGroup: 'Costas', instructions: '' });
  assert.equal(r.status, 200);
  assert.equal((await admin('POST', '/api/admin/exercises', { name: 'X', muscleGroup: 'Inexistente' })).status, 400);
  assert.equal((await admin('PUT', `/api/admin/exercises/${r.data.id}`, { name: 'Remada cavalinho', muscleGroup: 'Costas', archived: true })).status, 200);
  const n = await admin('POST', `/api/admin/students/${ctx.ana}/notes`, { text: 'Evoluindo bem' });
  assert.equal(n.status, 200);
  await admin('POST', '/api/admin/demo', { action: 'load' });
  let list = (await admin('GET', '/api/admin/students')).data.students;
  assert.equal(list.filter((s) => s.isDemo).length, 3);
  assert.ok(list.filter((s) => s.isDemo).every((s) => s.totalWorkouts > 5));
  await admin('POST', '/api/admin/demo', { action: 'remove' });
  list = (await admin('GET', '/api/admin/students')).data.students;
  assert.equal(list.filter((s) => s.isDemo).length, 0);
  assert.equal(list.length, 2);
});
