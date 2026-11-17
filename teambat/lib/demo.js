/* Dados de DEMONSTRAÇÃO — totalmente fictícios, gerados por fórmula.
   Servem só para mostrar o app funcionando. Todas as contas criadas aqui ficam
   marcadas com is_demo = 1, aparecem com o selo "DEMO" e podem ser removidas
   de uma vez em Configurações. */
'use strict';

exports.PASSWORD = 'demo1234';

const B = (label, name, items) => ({ label, name, items });
// [exercício, séries, repMin, repMax, descanso(s), carga inicial(kg), incremento(kg), observação]
const PLANS = [
  {
    name: 'Aluno Demo A (fictício)', email: 'demo.a@teambat.demo', goal: 'Hipertrofia (exemplo)', target: 5, stopDaysAgo: 0, weekdays: [1, 2, 3, 5, 6],
    days: [
      B('A', 'Peito, ombros e tríceps', [
        ['Supino inclinado com halteres', 3, 8, 12, 120, 26, 2, 'Desça controlando por 2–3 s. Pare 1–2 repetições antes da falha.'],
        ['Supino reto com barra', 3, 6, 10, 150, 60, 2.5, ''],
        ['Elevação lateral com halteres', 4, 10, 15, 60, 8, 1, 'Sem embalo. Cotovelo levemente à frente do tronco.'],
        ['Tríceps na polia com corda', 3, 10, 15, 75, 22.5, 2.5, '']
      ]),
      B('B', 'Costas e bíceps', [
        ['Puxada alta na polia', 3, 8, 12, 120, 50, 2.5, 'Puxe com os cotovelos, peito alto.'],
        ['Remada baixa na polia', 3, 8, 12, 120, 45, 2.5, ''],
        ['Face pull', 3, 12, 15, 60, 17.5, 2.5, ''],
        ['Rosca Scott', 3, 8, 12, 90, 20, 2, '']
      ]),
      B('C', 'Pernas', [
        ['Agachamento no hack', 3, 6, 10, 180, 80, 5, 'Amplitude completa, sem tirar o quadril do encosto.'],
        ['Cadeira extensora', 3, 10, 15, 90, 45, 2.5, ''],
        ['Mesa flexora', 3, 8, 12, 90, 35, 2.5, ''],
        ['Panturrilha em pé na máquina', 4, 8, 12, 60, 60, 5, 'Pausa de 1 s alongado.']
      ])
    ]
  },
  {
    name: 'Aluno Demo B (fictício)', email: 'demo.b@teambat.demo', goal: 'Ganho de força (exemplo)', target: 4, stopDaysAgo: 1, weekdays: [1, 2, 4, 5],
    split: 'Upper/Lower',
    days: [
      B('Upper', 'Membros superiores', [
        ['Supino reto com barra', 4, 5, 8, 180, 70, 2.5, ''],
        ['Remada curvada com barra', 4, 6, 10, 150, 55, 2.5, 'Tronco firme, sem roubar com a lombar.'],
        ['Desenvolvimento com halteres', 3, 8, 12, 120, 18, 2, ''],
        ['Rosca direta com barra', 3, 8, 12, 90, 25, 2.5, '']
      ]),
      B('Lower', 'Membros inferiores', [
        ['Agachamento livre', 4, 5, 8, 180, 90, 5, 'Mesma profundidade em todas as repetições.'],
        ['Levantamento terra romeno', 3, 8, 10, 150, 80, 5, ''],
        ['Leg press 45°', 3, 10, 15, 120, 160, 10, ''],
        ['Abdominal na polia', 3, 10, 15, 60, 30, 2.5, '']
      ])
    ]
  },
  {
    name: 'Aluno Demo C (fictício)', email: 'demo.c@teambat.demo', goal: 'Condicionamento (exemplo)', target: 3, stopDaysAgo: 12, weekdays: [1, 3, 5],
    days: [
      B('A', 'Corpo inteiro 1', [
        ['Leg press 45°', 3, 10, 15, 120, 100, 10, ''],
        ['Supino inclinado na máquina', 3, 8, 12, 120, 30, 2.5, ''],
        ['Remada na máquina', 3, 8, 12, 120, 35, 2.5, '']
      ]),
      B('B', 'Corpo inteiro 2', [
        ['Cadeira flexora', 3, 10, 15, 90, 30, 2.5, ''],
        ['Desenvolvimento na máquina', 3, 8, 12, 120, 20, 2.5, ''],
        ['Puxada alta na polia', 3, 8, 12, 120, 35, 2.5, '']
      ])
    ]
  }
];

function prng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

exports.load = function load({ one, run, tx, hashPassword }) {
  const hash = hashPassword(exports.PASSWORD);
  const WEEKS = 7;
  tx(() => {
    PLANS.forEach((plan, pi) => {
      const rnd = prng(101 + pi * 37);
      const created = new Date(Date.now() - WEEKS * 7 * 86400000).toISOString();
      const student = run(`INSERT INTO users (role, name, email, pass_hash, is_demo, goal, split_name, weekly_target, created_at)
        VALUES ('student',?,?,?,1,?,?,?,?)`, plan.name, plan.email, hash, plan.goal, plan.split || '', plan.target, created).id;
      const days = plan.days.map((d, di) => {
        const dayId = run('INSERT INTO days (student_id, label, name, position) VALUES (?,?,?,?)', student, d.label, d.name, di).id;
        const items = d.items.map(([name, sets, rmin, rmax, rest, start, inc, notes], i) => {
          let ex = one('SELECT id FROM exercises WHERE name = ?', name);
          if (!ex) ex = { id: run("INSERT INTO exercises (name, muscle_group, created_at) VALUES (?, 'Outros', ?)", name, created).id };
          run('INSERT INTO day_exercises (day_id, exercise_id, position, sets, reps_min, reps_max, rest_seconds, notes) VALUES (?,?,?,?,?,?,?,?)',
            dayId, ex.id, i, sets, rmin, rmax, rest, notes);
          return { exId: ex.id, name, sets, rmin, rmax, rest, notes, inc, w: start, r: rmin + 1 };
        });
        return { id: dayId, label: d.label, name: d.name, items };
      });

      let turn = 0;
      for (let ago = WEEKS * 7; ago >= plan.stopDaysAgo; ago--) {
        const date = new Date(Date.now() - ago * 86400000);
        if (!plan.weekdays.includes(date.getUTCDay())) continue;
        if (rnd() < 0.08) continue; // falta ocasional
        const day = days[turn++ % days.length];
        const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 21, Math.floor(rnd() * 50)));
        if (start.getTime() > Date.now() - 3600000) continue;
        const wid = run('INSERT INTO workouts (student_id, day_id, day_label, day_name, started_at, finished_at) VALUES (?,?,?,?,?,?)',
          student, day.id, day.label, day.name, start.toISOString(), new Date(start.getTime() + (55 + Math.floor(rnd() * 25)) * 60000).toISOString()).id;
        day.items.forEach((it, i) => {
          const we = run(`INSERT INTO workout_exercises (workout_id, exercise_id, exercise_name, position, sets, reps_min, reps_max, rest_seconds, notes, done_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)`, wid, it.exId, it.name, i, it.sets, it.rmin, it.rmax, it.rest, it.notes, start.toISOString()).id;
          for (let s = 1; s <= it.sets; s++) {
            // fadiga entre séries: cada série tende a render um pouco menos que a anterior
            const reps = Math.max(it.rmin - 2, it.r - (s - 1) - (rnd() < 0.3 ? 1 : 0));
            run('INSERT INTO sets (workout_exercise_id, set_number, weight, reps, note, updated_at) VALUES (?,?,?,?,?,?)', we, s, it.w, reps, '', start.toISOString());
          }
          // dupla progressão: sobe repetições até o topo da faixa, depois sobe carga
          if (it.r >= it.rmax) { it.w = Math.round((it.w + it.inc) * 100) / 100; it.r = it.rmin; }
          else if (rnd() < 0.8) it.r++;
        });
      }
      run('INSERT INTO coach_notes (student_id, text, created_at) VALUES (?,?,?)', student,
        'Observação de exemplo (dados fictícios): manter a técnica antes de subir carga.', created);
    });
  });
};
