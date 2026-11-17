/* TEAMBAT — Progressão por exercício (usada pelo aluno e pelo treinador).
   Cada exercício tem o próprio histórico e as comparações são sempre feitas
   série com série (1ª com 1ª, 2ª com 2ª...). */
(function () {
  'use strict';
  var TB = window.TB, esc = TB.esc;

  function pick(session, mode) {
    if (mode === 'best') {
      return session.sets.reduce(function (best, s) {
        if (s.weight == null) return best;
        if (!best || s.weight > best.weight || (s.weight === best.weight && (s.reps || 0) > (best.reps || 0))) return s;
        return best;
      }, null);
    }
    return session.sets.filter(function (s) { return s.n === mode; })[0] || null;
  }
  function delta(a, b, unit, digits) {
    if (a == null || b == null) return '<span class="delta--flat">–</span>';
    var d = Math.round((b - a) * 100) / 100;
    if (d === 0) return '<span class="delta--flat">igual</span>';
    var cls = d > 0 ? 'delta--up' : 'delta--down';
    var pct = a ? ' (' + (d > 0 ? '+' : '') + (Math.round((d / a) * 1000) / 10).toString().replace('.', ',') + '%)' : '';
    return '<span class="' + cls + '">' + (d > 0 ? '+' : '') + String(d).replace('.', ',') + (unit ? ' ' + unit : '') + (digits === false ? '' : pct) + '</span>';
  }

  function pct(a, b) {
    var p = Math.round(((b - a) / a) * 1000) / 10;
    return '<span class="' + (p > 0 ? 'delta--up' : p < 0 ? 'delta--down' : 'delta--flat') + '">' + (p > 0 ? '+' : '') + String(p).replace('.', ',') + '%</span>';
  }

  /** opts: { studentId (somente treinador), exerciseId (pré-seleção) } */
  TB.progressView = function (root, opts) {
    opts = opts || {};
    var qs = opts.studentId ? 'student=' + opts.studentId : '';
    var state = { exercises: [], exerciseId: opts.exerciseId || null, mode: 1, sessions: [], cmpA: null, cmpB: null };
    root.innerHTML = '<p class="muted">Carregando progressão…</p>';

    TB.get('/progress/exercises?' + qs).then(function (r) {
      state.exercises = r.exercises;
      if (!r.exercises.length) {
        root.innerHTML = TB.empty('Ainda não há registros', 'Assim que houver séries registradas, a evolução de cada exercício aparece aqui.');
        return;
      }
      if (!r.exercises.some(function (e) { return e.id === state.exerciseId; })) {
        state.exerciseId = r.exercises.slice().sort(function (a, b) { return b.sessions - a.sessions; })[0].id;
      }
      root.innerHTML = '<div class="stack"><label class="field"><span>Exercício</span><select class="select" data-ex></select></label>' +
        '<div data-body class="stack"></div></div>';
      var sel = root.querySelector('[data-ex]');
      var groups = {};
      r.exercises.forEach(function (e) { (groups[e.muscleGroup] = groups[e.muscleGroup] || []).push(e); });
      sel.innerHTML = Object.keys(groups).map(function (g) {
        return '<optgroup label="' + esc(g) + '">' + groups[g].map(function (e) {
          return '<option value="' + e.id + '"' + (e.id === state.exerciseId ? ' selected' : '') + '>' + esc(e.name) + ' (' + e.sessions + (e.sessions === 1 ? ' sessão' : ' sessões') + ')</option>';
        }).join('') + '</optgroup>';
      }).join('');
      sel.addEventListener('change', function () { state.exerciseId = Number(sel.value); state.mode = 1; state.cmpA = state.cmpB = null; load(); });
      load();
    }).catch(function (e) { root.innerHTML = '<p class="form-error">' + esc(e.message) + '</p>'; });

    function load() {
      var body = root.querySelector('[data-body]');
      TB.get('/progress?' + qs + '&exercise=' + state.exerciseId).then(function (r) {
        state.sessions = r.sessions;
        state.exercise = r.exercise;
        render(body);
      }).catch(function (e) { body.innerHTML = '<p class="form-error">' + esc(e.message) + '</p>'; });
    }

    function render(body) {
      var S = state.sessions;
      var maxN = S.reduce(function (m, s) { return Math.max(m, s.sets.reduce(function (a, x) { return Math.max(a, x.n); }, 0)); }, 0);
      if (state.mode !== 'best' && state.mode > maxN) state.mode = 1;
      var mode = state.mode;
      var modeName = mode === 'best' ? 'melhor série' : mode + 'ª série';

      // Indicadores
      var top = null, topReps = null;
      S.forEach(function (s) {
        s.sets.forEach(function (x) {
          if (x.weight != null && (!top || x.weight > top.weight)) top = { weight: x.weight, reps: x.reps, date: s.date };
          if (x.reps != null && (!topReps || x.reps > topReps.reps || (x.reps === topReps.reps && (x.weight || 0) > (topReps.weight || 0)))) topReps = { weight: x.weight, reps: x.reps, date: s.date };
        });
      });
      var series = S.map(function (s) { return { s: s, v: pick(s, mode) }; }).filter(function (p) { return p.v; });
      var firstP = series[0], lastP = series[series.length - 1], prevP = series[series.length - 2];

      function kpi(label, value, hint) {
        return '<div class="card stat"><span class="stat__label">' + label + '</span><span class="stat__value">' + value + '</span><span class="stat__hint">' + (hint || '&nbsp;') + '</span></div>';
      }
      var kpis = '<div class="grid grid--4">' +
        kpi('Maior carga registrada', top ? TB.kg(top.weight) + ' <small>kg</small>' : '–', top ? top.reps + ' reps · ' + TB.date(top.date) : '') +
        kpi('Melhor desempenho em repetições', topReps ? topReps.reps + ' <small>reps</small>' : '–', topReps ? 'com ' + TB.kg(topReps.weight) + ' kg · ' + TB.date(topReps.date) : '') +
        kpi('Última carga (' + modeName + ')', lastP && lastP.v.weight != null ? TB.kg(lastP.v.weight) + ' <small>kg</small>' : '–',
          lastP ? lastP.v.reps + ' reps · ' + TB.date(lastP.s.date) + (prevP ? ' · ' + delta(prevP.v.weight, lastP.v.weight, 'kg') + ' vs. anterior' : '') : '') +
        kpi('Evolução de carga (' + modeName + ')', firstP && lastP && series.length > 1 && firstP.v.weight ? pct(firstP.v.weight, lastP.v.weight) : '–', firstP && lastP && series.length > 1 ? 'de ' + TB.kg(firstP.v.weight) + ' para ' + TB.kg(lastP.v.weight) + ' kg (' + delta(firstP.v.weight, lastP.v.weight, 'kg', false) + ') em ' + series.length + ' sessões' : 'É preciso de 2 sessões para comparar') +
        '</div>';

      var tabs = '<div class="tabs" role="tablist" aria-label="Série analisada">';
      for (var n = 1; n <= maxN; n++) tabs += '<button class="tab" type="button" role="tab" data-mode="' + n + '" aria-selected="' + (mode === n) + '">Série ' + n + '</button>';
      tabs += '<button class="tab" type="button" role="tab" data-mode="best" aria-selected="' + (mode === 'best') + '">Melhor série</button></div>';

      // Comparação entre duas sessões
      if (state.cmpA == null || !S[state.cmpA]) state.cmpA = Math.max(0, S.length - 2);
      if (state.cmpB == null || !S[state.cmpB]) state.cmpB = S.length - 1;
      function sessOpts(selIdx) {
        return S.map(function (s, i) { return '<option value="' + i + '"' + (i === selIdx ? ' selected' : '') + '>' + TB.date(s.date, true) + ' · Treino ' + esc(s.dayLabel) + '</option>'; }).reverse().join('');
      }
      var A = S[state.cmpA], B = S[state.cmpB], cmpRows = '';
      for (var i = 1; i <= maxN; i++) {
        var a = pick(A, i), b = pick(B, i);
        if (!a && !b) continue;
        cmpRows += '<tr><td>Série ' + i + '</td><td>' + (a ? TB.setText(a) : '–') + '</td><td>' + (b ? TB.setText(b) : '–') + '</td><td>' +
          delta(a && a.weight, b && b.weight, 'kg') + '</td><td>' + delta(a && a.reps, b && b.reps, 'reps', false) + '</td></tr>';
      }

      // Histórico detalhado
      var head = '<tr><th>Data</th><th>Treino</th>';
      for (var c = 1; c <= maxN; c++) head += '<th>Série ' + c + '</th>';
      head += '<th>Séries concluídas</th></tr>';
      var rows = S.slice().reverse().map(function (s) {
        var isTop = top && s.sets.some(function (x) { return x.weight === top.weight; });
        var tr = '<tr' + (isTop ? ' class="is-best"' : '') + '><td>' + TB.date(s.date, true) + '</td><td>' + esc(s.dayLabel) + '</td>';
        for (var k = 1; k <= maxN; k++) { var x = pick(s, k); tr += '<td>' + (x ? TB.setText(x) : '–') + '</td>'; }
        return tr + '<td>' + s.sets.length + ' de ' + s.prescribedSets + (s.finishedAt ? '' : ' <span class="chip chip--warn">em andamento</span>') + '</td></tr>';
      }).join('');

      body.innerHTML = kpis + tabs +
        '<div class="grid grid--2 grid--stack">' +
        '<div class="card"><div class="card__head"><h3 class="h2">Evolução de carga</h3><span class="mono">kg · ' + esc(modeName) + '</span></div><div data-chart="w"></div></div>' +
        '<div class="card"><div class="card__head"><h3 class="h2">Evolução de repetições</h3><span class="mono">reps · ' + esc(modeName) + '</span></div><div data-chart="r"></div></div></div>' +
        (S.length > 1 ? '<div class="card stack"><h3 class="h2">Comparar sessões</h3><div class="form__row">' +
          '<label class="field"><span>Sessão A</span><select class="select" data-cmp="A">' + sessOpts(state.cmpA) + '</select></label>' +
          '<label class="field"><span>Sessão B</span><select class="select" data-cmp="B">' + sessOpts(state.cmpB) + '</select></label></div>' +
          '<div class="table-wrap"><table class="table"><thead><tr><th>Série</th><th>Sessão A</th><th>Sessão B</th><th>Carga (B − A)</th><th>Repetições (B − A)</th></tr></thead><tbody>' + cmpRows + '</tbody></table></div></div>' : '') +
        '<div class="stack"><div class="row row--between"><h3 class="h2">Histórico detalhado</h3><span class="mono">' + S.length + (S.length === 1 ? ' sessão' : ' sessões') + ' · ' + esc(state.exercise.name) + '</span></div>' +
        '<div class="table-wrap"><table class="table"><thead>' + head + '</thead><tbody>' + rows + '</tbody></table></div>' +
        '<p class="muted" style="font-size:.8rem">Cada célula mostra carga × repetições. A linha destacada contém a maior carga registrada.</p></div>';

      var pts = S.map(function (s) {
        var v = pick(s, mode);
        return { x: TB.dateShort(s.date), title: TB.date(s.date, true) + ' · Treino ' + s.dayLabel, w: v && v.weight, r: v && v.reps, n: v && v.n };
      });
      TB.lineChart(body.querySelector('[data-chart="w"]'), {
        label: 'Evolução de carga em kg', unit: 'kg', markMax: true,
        points: pts.map(function (p) { return { x: p.x, title: p.title, value: p.w, sub: p.r != null ? p.r + ' reps' + (mode === 'best' ? ' · série ' + p.n : '') : '' }; })
      });
      TB.lineChart(body.querySelector('[data-chart="r"]'), {
        label: 'Evolução de repetições', unit: 'reps', integer: true, markMax: true,
        points: pts.map(function (p) { return { x: p.x, title: p.title, value: p.r, sub: p.w != null ? 'com ' + TB.kg(p.w) + ' kg' : '' }; })
      });

      body.querySelectorAll('[data-mode]').forEach(function (b) {
        b.addEventListener('click', function () { state.mode = b.dataset.mode === 'best' ? 'best' : Number(b.dataset.mode); render(body); });
      });
      body.querySelectorAll('[data-cmp]').forEach(function (s) {
        s.addEventListener('change', function () { state['cmp' + s.dataset.cmp] = Number(s.value); render(body); });
      });
    }
  };
})();
