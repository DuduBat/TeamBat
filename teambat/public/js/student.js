/* TEAMBAT — Área do aluno */
(function () {
  'use strict';
  var TB = window.TB, esc = TB.esc, V = (TB.views.student = {});

  function head(eyebrow, title, right) {
    return '<header class="view-head"><div><p class="eyebrow"><span class="dot"></span>' + esc(eyebrow) + '</p><h1 class="title">' + title + '</h1></div>' + (right || '') + '</header>';
  }
  function rxChips(ex) {
    return '<div class="ex__meta"><span class="chip chip--purple">' + ex.sets + (ex.sets === 1 ? ' série' : ' séries') + '</span>' +
      '<span class="chip">' + TB.reps(ex) + ' reps</span>' +
      '<span class="chip">' + esc(ex.muscleGroup) + '</span></div>';
  }
  function coachNote(ex) {
    return (ex.notes ? '<div class="note"><b>Orientação do treinador</b>' + esc(ex.notes) + '</div>' : '') +
      (ex.instructions ? '<div class="note"><b>Execução</b>' + esc(ex.instructions) + '</div>' : '');
  }
  function cmpChip(cur, prev) {
    if (!cur || !prev || cur.reps == null) return '';
    if (cur.weight != null && prev.weight != null && cur.weight !== prev.weight) {
      var d = Math.round((cur.weight - prev.weight) * 100) / 100;
      return '<small class="' + (d > 0 ? 'delta--up' : 'delta--down') + '">' + (d > 0 ? '+' : '') + TB.kg(d) + ' kg</small>';
    }
    if (prev.reps != null && cur.reps !== prev.reps) {
      var r = cur.reps - prev.reps;
      return '<small class="' + (r > 0 ? 'delta--up' : 'delta--down') + '">' + (r > 0 ? '+' : '') + r + ' rep' + (Math.abs(r) === 1 ? '' : 's') + '</small>';
    }
    return '<small class="delta--flat">igual</small>';
  }
  function startWorkout(dayId) {
    return TB.api('POST', '/workouts', { dayId: dayId }).then(function (r) { TB.go('treino/' + r.workout.id); }, TB.fail);
  }

  /** Treino já registrado, somente leitura (também usado no painel do treinador) */
  TB.workoutReadHtml = function (w) {
    return w.exercises.map(function (ex) {
      var rows = ex.logged.filter(function (s) { return s.reps != null || s.weight != null; }).map(function (s) {
        var prev = ex.previous && ex.previous.sets.filter(function (p) { return p.n === s.n; })[0];
        return '<tr><td>Série ' + s.n + '</td><td><strong>' + TB.setText(s) + '</strong></td><td>' + (prev ? TB.setText(prev) : '–') + '</td><td>' + (cmpChip(s, prev) || '–') + '</td>' +
          '<td class="wrap muted">' + esc(s.note) + '</td></tr>';
      }).join('');
      return '<div class="card stack"><div class="ex">' + TB.thumb(ex, 'sm') + '<div class="grow"><p class="ex__name">' + esc(ex.name) + '</p>' +
        '<p class="muted" style="font-size:.84rem">Prescrito: ' + ex.sets + ' × ' + TB.reps(ex) + '</p></div></div>' +
        (rows ? '<div class="table-wrap"><table class="table"><thead><tr><th>Série</th><th>Realizado</th><th>Sessão anterior</th><th>Diferença</th><th>Observação</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
          : '<p class="muted">Nenhuma série registrada neste exercício.</p>') + '</div>';
    }).join('');
  };
  TB.workoutRow = function (w, href) {
    return '<li><a class="list__item" href="' + href + '"><span class="badge-day">' + esc(w.dayLabel) + '</span><span class="grow"><strong>' + esc(w.dayName || 'Treino ' + w.dayLabel) + '</strong>' +
      (w.finishedAt ? '' : ' <span class="chip chip--warn">em andamento</span>') +
      '<br><span class="muted" style="font-size:.84rem">' + TB.dateTime(w.startedAt) + (w.finishedAt ? ' · ' + TB.duration(w.startedAt, w.finishedAt) : '') + '</span>' +
      '<br><span class="muted num" style="font-size:.84rem">' + w.setCount + ' séries · volume ' + TB.num(w.volume) + ' kg</span></span>' + TB.icon('chev', 'list__chev') + '</a></li>';
  };

  /* ---------- Início ---------- */
  V.inicio = function (root) {
    TB.get('/home').then(function (h) {
      var u = TB.state.user;
      var next = h.days.filter(function (d) { return d.id === h.nextDayId; })[0];
      var html = head('Science Based Lifting', esc(TB.greeting()) + ', <em>' + esc(TB.firstName(u.name)) + '.</em>');
      if (!h.days.length) {
        html += TB.empty('Sua ficha ainda não foi montada', 'Assim que o treinador cadastrar seus treinos, eles aparecem aqui.');
      } else {
        var sets = next ? next.exercises.reduce(function (a, e) { return a + e.sets; }, 0) : 0;
        html += '<section class="card card--glow today">' + TB.bat('today__bat') +
          '<p class="mono">' + (h.openWorkout ? 'Treino em andamento' : 'Treino de hoje') + '</p>' +
          '<div><div class="today__label">' + esc(next ? next.label : '–') + '</div><p class="h2" style="margin-top:10px">' + esc(next && next.name ? next.name : 'Treino ' + (next ? next.label : '')) + '</p>' +
          '<p class="muted">' + (next ? next.exercises.length + ' exercícios · ' + sets + ' séries' : '') + '</p></div>' +
          (next && next.exercises.length ? '<ul class="row" style="gap:6px">' + next.exercises.slice(0, 6).map(function (e) { return '<li class="chip">' + esc(e.name) + '</li>'; }).join('') + '</ul>' : '') +
          '<div class="row">' + (h.openWorkout
            ? '<a class="btn btn--primary" href="#/treino/' + h.openWorkout.id + '">' + TB.icon('play') + 'Continuar treino</a>'
            : next && next.exercises.length ? '<button class="btn btn--primary" type="button" data-start="' + next.id + '">' + TB.icon('play') + 'Iniciar treino</button>' : '<span class="muted">Este treino ainda não tem exercícios.</span>') +
          '<a class="btn btn--ghost" href="#/treinos">Ver ficha completa</a></div></section>';
      }
      html += '<div class="grid grid--3">' +
        '<div class="card stat"><span class="stat__label">Divisão de treinamento</span><span class="stat__value">' + esc(h.split || '–') + '</span><span class="stat__hint">' + h.days.length + (h.days.length === 1 ? ' treino' : ' treinos') + ' na ficha</span></div>' +
        '<div class="card stat"><span class="stat__label">Último treino realizado</span><span class="stat__value">' + (h.lastWorkout ? esc(h.lastWorkout.dayLabel) : '–') + '</span><span class="stat__hint">' +
          (h.lastWorkout ? TB.ago(h.lastWorkout.startedAt) + ' · ' + h.lastWorkout.setCount + ' séries' : 'Nenhum treino concluído ainda') + '</span></div>' +
        '<div class="card stack" style="gap:12px"><div class="row row--between"><span class="stat__label">Frequência semanal</span><span class="chip chip--purple num">' + h.week.count + ' de ' + h.week.target + '</span></div>' + TB.week(h.week) + '</div></div>';
      root.innerHTML = html;
      TB.on(root, 'click', '[data-start]', function (e, b) { b.disabled = true; startWorkout(Number(b.dataset.start)).then(function () { b.disabled = false; }); });
    }).catch(function (e) { root.innerHTML = '<p class="form-error">' + esc(e.message) + '</p>'; });
  };

  /* ---------- Meus treinos (ficha) ---------- */
  V.treinos = function (root) {
    Promise.all([TB.get('/plan'), TB.get('/workouts')]).then(function (res) {
      var plan = res[0], open = res[1].workouts.filter(function (w) { return !w.finishedAt; })[0];
      var html = head('Ficha de treinamento', 'Meus <em>treinos.</em>', plan.split ? '<span class="chip chip--purple">Divisão ' + esc(plan.split) + '</span>' : '');
      if (!plan.days.length) html += TB.empty('Sua ficha ainda não foi montada', 'O treinador vai cadastrar seus exercícios por aqui.');
      html += plan.days.map(function (d) {
        var isOpen = open && open.dayId === d.id;
        return '<section class="card stack"><div class="row row--between"><div class="row"><span class="badge-day">' + esc(d.label) + '</span><div><h2 class="h2">' + esc(d.name || 'Treino ' + d.label) + '</h2>' +
          '<p class="muted" style="font-size:.84rem">' + d.exercises.length + ' exercícios</p></div></div>' +
          (isOpen ? '<a class="btn btn--primary btn--sm" href="#/treino/' + open.id + '">Continuar</a>'
            : d.exercises.length ? '<button class="btn btn--primary btn--sm" type="button" data-start="' + d.id + '">' + TB.icon('play') + 'Iniciar</button>' : '') + '</div>' +
          (d.exercises.length ? '<ul class="stack">' + d.exercises.map(function (ex) {
            return '<li class="ex">' + TB.thumb(ex) + '<div class="grow"><p class="ex__name">' + esc(ex.name) + '</p>' + rxChips(ex) + coachNote(ex) + '</div></li>';
          }).join('') + '</ul>' : '<p class="muted">Sem exercícios cadastrados.</p>') + '</section>';
      }).join('');
      root.innerHTML = html;
      TB.on(root, 'click', '[data-start]', function (e, b) { b.disabled = true; startWorkout(Number(b.dataset.start)).then(function () { b.disabled = false; }); });
    }).catch(function (e) { root.innerHTML = '<p class="form-error">' + esc(e.message) + '</p>'; });
  };

  /* ---------- Registro do treino ---------- */
  // Fila local: se a conexão cair no meio do treino, as séries ficam guardadas
  // no aparelho e são reenviadas assim que o servidor responder.
  var PENDING_KEY = 'tb_pending_sets';
  function pendingAll() { try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '{}'); } catch (e) { return {}; } }
  function pendingSet(key, value) {
    try { var p = pendingAll(); if (value) p[key] = value; else delete p[key]; localStorage.setItem(PENDING_KEY, JSON.stringify(p)); } catch (e) { /* armazenamento indisponível */ }
  }
  TB.flushPending = function () {
    var p = pendingAll();
    return Promise.all(Object.keys(p).map(function (key) {
      return TB.api('PUT', key, p[key]).then(function () { pendingSet(key, null); }, function (err) { if (!err.offline) pendingSet(key, null); });
    }));
  };
  window.addEventListener('online', function () { if (TB.state.user && TB.state.user.role === 'student') TB.flushPending(); });

  V.treino = function (root, args) {
    var id = Number(args[0]);
    TB.flushPending().then(function () { return TB.get('/workouts/' + id); }).then(function (r) {
      if (r.workout.finishedAt) { TB.go('historico/' + id); return; }
      render(r.workout);
    }).catch(function (e) { root.innerHTML = '<a class="back" href="#/inicio">' + TB.icon('left') + 'Início</a><p class="form-error">' + esc(e.message) + '</p>'; });

    function render(w) {
      var extra = {}, timers = {}, chain = {}, inflight = [];
      var openId = (w.exercises.filter(function (e) { return !e.doneAt; })[0] || w.exercises[0]).id;
      function logged(ex, n) { return ex.logged.filter(function (s) { return s.n === n; })[0]; }
      function prevOf(ex, n) { return ex.previous && ex.previous.sets.filter(function (s) { return s.n === n; })[0]; }
      function filledCount(ex) { return ex.logged.filter(function (s) { return s.reps != null; }).length; }
      function rowCount(ex) { return Math.max(ex.sets, ex.logged.reduce(function (m, s) { return Math.max(m, s.n); }, 0), extra[ex.id] || 0); }

      function rowHtml(ex, n) {
        var s = logged(ex, n) || {}, p = prevOf(ex, n);
        return '<div class="set' + (s.reps != null ? ' is-filled' : '') + '" data-n="' + n + '">' +
          '<span class="set__n" aria-hidden="true">' + n + '</span>' +
          '<input class="set__in" type="text" inputmode="decimal" autocomplete="off" data-f="weight" aria-label="Carga em kg, série ' + n + '" placeholder="' + (p && p.weight != null ? TB.kg(p.weight) : 'kg') + '" value="' + (s.weight != null ? TB.kg(s.weight) : '') + '">' +
          '<input class="set__in" type="text" inputmode="numeric" autocomplete="off" data-f="reps" aria-label="Repetições, série ' + n + '" placeholder="' + (p && p.reps != null ? p.reps : 'reps') + '" value="' + (s.reps != null ? s.reps : '') + '">' +
          (p ? '<button class="set__prev" type="button" data-fill title="Usar os valores da sessão anterior"><span>' + TB.kg(p.weight) + ' × ' + (p.reps == null ? '–' : p.reps) + '</span><span data-cmp>' + cmpChip(s, p) + '</span></button>'
            : '<span class="set__prev">–</span>') +
          '<button class="set__state' + (s.reps != null || s.weight != null ? ' is-saved' : '') + '" type="button" data-note aria-label="Observação da série ' + n + '">' + TB.icon(s.reps != null || s.weight != null ? 'check' : 'note') + '</button>' +
          '<div class="set__note"' + (s.note ? '' : ' hidden') + '><input class="input" type="text" maxlength="300" data-f="note" placeholder="Observação da série (opcional)" value="' + esc(s.note || '') + '"></div></div>';
      }
      function cardHtml(ex) {
        var rows = '';
        for (var n = 1; n <= rowCount(ex); n++) rows += rowHtml(ex, n);
        return '<article class="card log' + (ex.id === openId ? ' is-open' : '') + (ex.doneAt ? ' is-done' : '') + '" data-ex="' + ex.id + '">' +
          '<button class="log__head" type="button" data-toggle aria-expanded="' + (ex.id === openId) + '">' + TB.thumb(ex) +
          '<span class="grow"><span class="ex__name">' + esc(ex.name) + '</span><br><span class="muted num" style="font-size:.84rem">' + ex.sets + ' × ' + TB.reps(ex) + '</span></span>' +
          '<span class="chip ' + (ex.doneAt ? 'chip--good' : 'chip--purple') + ' num" data-count>' + (ex.doneAt ? 'feito' : filledCount(ex) + '/' + ex.sets) + '</span></button>' +
          '<div class="log__body">' + coachNote(ex) +
          (ex.previous ? '<p class="muted" style="font-size:.8rem">Última vez: ' + TB.date(ex.previous.date) + '. Toque no valor anterior para repetir a carga.</p>' : '<p class="muted" style="font-size:.8rem">Primeiro registro deste exercício.</p>') +
          '<div class="sets"><div class="sets__head"><span>Série</span><span style="text-align:center">Carga (kg)</span><span style="text-align:center">Repetições</span><span style="text-align:center">Anterior</span><span></span></div>' + rows + '</div>' +
          '<div class="row row--between"><button class="btn btn--ghost btn--sm" type="button" data-add>' + TB.icon('plus') + 'Série extra</button>' +
          '<button class="btn ' + (ex.doneAt ? 'btn--ghost' : 'btn--primary') + ' btn--sm" type="button" data-done>' + (ex.doneAt ? 'Reabrir exercício' : TB.icon('check') + 'Finalizar exercício') + '</button></div></div></article>';
      }
      function draw() {
        var done = w.exercises.filter(function (e) { return e.doneAt; }).length;
        root.innerHTML = '<a class="back" href="#/inicio">' + TB.icon('left') + 'Início</a>' +
          head('Em andamento · iniciado às ' + TB.time(w.startedAt), 'Treino <em>' + esc(w.dayLabel) + '</em>' + (w.dayName ? ' <span style="font-size:.55em;color:var(--gray)">' + esc(w.dayName) + '</span>' : '')) +
          '<div class="stack has-finishbar" data-list>' + w.exercises.map(cardHtml).join('') +
          '<button class="btn btn--danger btn--sm" type="button" data-discard style="justify-self:start">' + TB.icon('trash') + 'Descartar treino</button></div>' +
          '<div class="finishbar"><div class="grow"><span class="mono" data-prog>' + done + ' de ' + w.exercises.length + ' exercícios</span>' +
          '<div class="finishbar__bar"><i style="width:' + (done / w.exercises.length) * 100 + '%"></i></div></div>' +
          '<button class="btn btn--primary" type="button" data-finish>Concluir treino</button></div>';
      }
      function refreshMeta(ex) {
        var card = root.querySelector('[data-ex="' + ex.id + '"]');
        if (card) card.querySelector('[data-count]').textContent = ex.doneAt ? 'feito' : filledCount(ex) + '/' + ex.sets;
        var done = w.exercises.filter(function (e) { return e.doneAt; }).length;
        root.querySelector('[data-prog]').textContent = done + ' de ' + w.exercises.length + ' exercícios';
        root.querySelector('.finishbar__bar i').style.width = (done / w.exercises.length) * 100 + '%';
      }
      function exOf(node) { var c = node.closest('[data-ex]'); return w.exercises.filter(function (e) { return e.id === Number(c.dataset.ex); })[0]; }

      // Uma gravação por vez em cada série: a resposta de um envio antigo nunca
      // sobrescreve na tela o que foi digitado depois.
      function save(row) {
        var key = exOf(row).id + ':' + row.dataset.n;
        chain[key] = (chain[key] || Promise.resolve()).then(function () { return doSave(row); });
        inflight.push(chain[key]);
        return chain[key];
      }
      function doSave(row) {
        var ex = exOf(row), n = Number(row.dataset.n);
        var raw = { weight: row.querySelector('[data-f=weight]').value.trim().replace(',', '.'), reps: row.querySelector('[data-f=reps]').value.trim(), note: row.querySelector('[data-f=note]').value.trim() };
        var body = { weight: raw.weight === '' ? null : Number(raw.weight), reps: raw.reps === '' ? null : Number(raw.reps), note: raw.note };
        var stateEl = row.querySelector('.set__state');
        if ((body.weight !== null && !(body.weight >= 0 && body.weight <= 1000)) || (body.reps !== null && !(Number.isInteger(body.reps) && body.reps >= 0 && body.reps <= 300))) {
          stateEl.className = 'set__state is-error'; stateEl.innerHTML = TB.icon('alert');
          TB.toast('Confira os valores da série ' + n + '.', 'error');
          return Promise.resolve();
        }
        var path = '/workouts/' + w.id + '/exercises/' + ex.id + '/sets/' + n;
        stateEl.className = 'set__state is-saving'; stateEl.innerHTML = TB.icon('sync');
        pendingSet(path, body);
        var req = TB.api('PUT', path, body).then(function (r) {
          pendingSet(path, null);
          ex.logged = ex.logged.filter(function (s) { return s.n !== n; });
          if (r.set) ex.logged.push(r.set);
          row.classList.toggle('is-filled', body.reps !== null);
          stateEl.className = 'set__state' + (r.set ? ' is-saved' : ''); stateEl.innerHTML = TB.icon(r.set ? 'check' : 'note');
          var cmp = row.querySelector('[data-cmp]');
          if (cmp) cmp.innerHTML = cmpChip(r.set, prevOf(ex, n));
          refreshMeta(ex);
        }, function (err) {
          stateEl.className = 'set__state is-error'; stateEl.innerHTML = TB.icon('alert');
          if (err.offline) TB.toast('Sem conexão: a série ficou guardada no aparelho e será enviada depois.', 'error');
          else { pendingSet(path, null); TB.fail(err); }
        });
        return req;
      }
      function schedule(row, delay) {
        var key = exOf(row).id + ':' + row.dataset.n;
        clearTimeout(timers[key]);
        timers[key] = setTimeout(function () { delete timers[key]; save(row); }, delay);
      }
      /** Garante que tudo que foi digitado já foi enviado */
      function settle() {
        Object.keys(timers).forEach(function (key) {
          clearTimeout(timers[key]); delete timers[key];
          var p = key.split(':');
          var row = root.querySelector('[data-ex="' + p[0] + '"] .set[data-n="' + p[1] + '"]');
          if (row) save(row);
        });
        var all = inflight; inflight = [];
        return Promise.all(all);
      }

      draw();
      TB.on(root, 'input', '.set [data-f]', function (e, input) { schedule(input.closest('.set'), 700); });
      TB.on(root, 'change', '.set [data-f]', function (e, input) { schedule(input.closest('.set'), 0); });
      TB.on(root, 'keydown', '.set__in', function (e, input) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        var inputs = Array.prototype.slice.call(input.closest('.log').querySelectorAll('.set__in'));
        var nextInput = inputs[inputs.indexOf(input) + 1];
        if (nextInput) nextInput.focus(); else input.blur();
      });
      TB.on(root, 'click', '[data-fill]', function (e, btn) {
        var row = btn.closest('.set'), ex = exOf(row), p = prevOf(ex, Number(row.dataset.n));
        var wEl = row.querySelector('[data-f=weight]'), rEl = row.querySelector('[data-f=reps]');
        if (wEl.value === '' && p.weight != null) wEl.value = TB.kg(p.weight);
        if (rEl.value === '' && p.reps != null) rEl.value = p.reps;
        schedule(row, 0);
      });
      TB.on(root, 'click', '[data-note]', function (e, btn) {
        var box = btn.closest('.set').querySelector('.set__note');
        box.hidden = !box.hidden;
        if (!box.hidden) box.querySelector('input').focus();
      });
      TB.on(root, 'click', '[data-toggle]', function (e, btn) {
        var card = btn.closest('.log'), open = !card.classList.contains('is-open');
        root.querySelectorAll('.log.is-open').forEach(function (c) { c.classList.remove('is-open'); c.querySelector('[data-toggle]').setAttribute('aria-expanded', 'false'); });
        card.classList.toggle('is-open', open); btn.setAttribute('aria-expanded', String(open));
        openId = open ? Number(card.dataset.ex) : null;
      });
      TB.on(root, 'click', '[data-add]', function (e, btn) {
        var ex = exOf(btn), n = rowCount(ex) + 1;
        if (n > 15) return;
        extra[ex.id] = n;
        btn.closest('.log').querySelector('.sets').insertAdjacentHTML('beforeend', rowHtml(ex, n));
        btn.closest('.log').querySelector('.set[data-n="' + n + '"] [data-f=weight]').focus();
      });
      TB.on(root, 'click', '[data-done]', function (e, btn) {
        var ex = exOf(btn), done = !ex.doneAt;
        btn.disabled = true;
        settle().then(function () { return TB.api('POST', '/workouts/' + w.id + '/exercises/' + ex.id + '/done', { done: done }); }).then(function () {
          ex.doneAt = done ? new Date().toISOString() : null;
          if (done) {
            var nextEx = w.exercises.filter(function (x) { return !x.doneAt; })[0];
            openId = nextEx ? nextEx.id : null;
            TB.toast(nextEx ? 'Exercício finalizado.' : 'Todos os exercícios finalizados. Conclua o treino!');
          } else openId = ex.id;
          var y = window.scrollY;
          draw();
          var target = openId && root.querySelector('[data-ex="' + openId + '"]');
          if (done && target) target.scrollIntoView({ block: 'start', behavior: 'smooth' }); else window.scrollTo(0, y);
        }).catch(function (err) { btn.disabled = false; TB.fail(err); });
      });
      TB.on(root, 'click', '[data-discard]', function () {
        TB.confirm('Descartar este treino?', 'As séries registradas neste treino em andamento serão apagadas. Esta ação não pode ser desfeita.', 'Descartar', true).then(function (ok) {
          if (!ok) return;
          Object.keys(timers).forEach(function (k) { clearTimeout(timers[k]); });
          TB.api('DELETE', '/workouts/' + w.id).then(function () { TB.toast('Treino descartado.'); TB.go('inicio'); }, TB.fail);
        });
      });
      TB.on(root, 'click', '[data-finish]', function () {
        settle().then(function () {
          var total = w.exercises.reduce(function (a, ex) { return a + filledCount(ex); }, 0);
          var planned = w.exercises.reduce(function (a, ex) { return a + ex.sets; }, 0);
          if (!total) { TB.toast('Registre pelo menos uma série antes de concluir.', 'error'); return; }
          TB.formModal({
            title: 'Concluir treino ' + w.dayLabel,
            submit: 'Concluir treino',
            fields: '<p class="muted">Você registrou <strong style="color:var(--white)">' + total + ' de ' + planned + ' séries</strong> prescritas.' + (total < planned ? ' Dá para concluir mesmo assim.' : '') + '</p>' +
              '<label class="field"><span>Como foi o treino? (opcional)</span><textarea class="textarea" name="notes" maxlength="500" placeholder="Ex.: dormi mal, senti o ombro no supino..."></textarea></label>',
            onSubmit: function (data) { return TB.api('POST', '/workouts/' + w.id + '/finish', { notes: data.notes }); },
            after: function () { TB.toast('Treino concluído e salvo.'); TB.go('historico/' + w.id); }
          });
        });
      });
    }
  };

  /* ---------- Histórico ---------- */
  V.historico = function (root, args) {
    if (args[0]) {
      TB.get('/workouts/' + Number(args[0])).then(function (r) {
        var w = r.workout;
        var sets = w.exercises.reduce(function (a, ex) { return a + ex.logged.filter(function (s) { return s.reps != null; }).length; }, 0);
        root.innerHTML = '<a class="back" href="#/historico">' + TB.icon('left') + 'Histórico</a>' +
          head(TB.dateTime(w.startedAt), 'Treino <em>' + esc(w.dayLabel) + '</em>', w.finishedAt ? '<span class="chip chip--good">concluído · ' + TB.duration(w.startedAt, w.finishedAt) + '</span>' : '<a class="btn btn--primary btn--sm" href="#/treino/' + w.id + '">Continuar treino</a>') +
          '<p class="muted">' + esc(w.dayName) + (w.dayName ? ' · ' : '') + sets + ' séries registradas</p>' +
          (w.notes ? '<div class="note"><b>Sua anotação</b>' + esc(w.notes) + '</div>' : '') + TB.workoutReadHtml(w);
      }).catch(function (e) { root.innerHTML = '<a class="back" href="#/historico">' + TB.icon('left') + 'Histórico</a><p class="form-error">' + esc(e.message) + '</p>'; });
      return;
    }
    TB.get('/workouts').then(function (r) {
      root.innerHTML = head('Treinos realizados', 'Meu <em>histórico.</em>', '<span class="chip chip--purple num">' + r.workouts.filter(function (w) { return w.finishedAt; }).length + ' concluídos</span>') +
        (r.workouts.length ? '<div class="card card--flush"><ul class="list">' + r.workouts.map(function (w) { return TB.workoutRow(w, w.finishedAt ? '#/historico/' + w.id : '#/treino/' + w.id); }).join('') + '</ul></div>'
          : TB.empty('Nenhum treino registrado', 'Quando você concluir o primeiro treino, ele aparece aqui com data, horário e todas as séries.'));
    }).catch(function (e) { root.innerHTML = '<p class="form-error">' + esc(e.message) + '</p>'; });
  };

  /* ---------- Minha evolução ---------- */
  V.evolucao = function (root) {
    root.innerHTML = head('Progressão por exercício', 'Minha <em>evolução.</em>') + '<div data-progress></div>';
    TB.progressView(root.querySelector('[data-progress]'), {});
  };

  /* ---------- Perfil ---------- */
  TB.passwordCard = function () {
    return '<form class="card form" data-password novalidate><h2 class="h2">Alterar senha</h2>' +
      TB.passwordField('Senha atual', 'current', 'current-password', 'required') +
      TB.passwordField('Nova senha (mínimo 8 caracteres)', 'password', 'new-password', 'minlength="8" required') +
      '<p class="form-error" hidden></p><button class="btn btn--ghost btn--sm" type="submit" style="justify-self:start">Salvar nova senha</button></form>';
  };
  TB.bindPassword = function (root) {
    var form = root.querySelector('[data-password]');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = form.querySelector('.form-error'); err.hidden = true;
      TB.api('POST', '/password', TB.formData(form)).then(function () {
        form.reset(); TB.state.user.mustChangePassword = false; TB.toast('Senha alterada.');
      }, function (er) { err.textContent = er.message; err.hidden = false; });
    });
  };
  V.perfil = function (root) {
    var u = TB.state.user;
    root.innerHTML = head('Minha conta', esc(u.name) + (u.isDemo ? TB.demoChip(true) : '')) +
      '<div class="grid grid--2 grid--stack"><div class="card stack"><h2 class="h2">Dados</h2>' +
      '<p><span class="mono">E-mail</span><br>' + esc(u.email) + '</p>' +
      '<p><span class="mono">Objetivo</span><br>' + esc(u.goal || 'Não informado') + '</p>' +
      '<p><span class="mono">Meta semanal</span><br>' + u.weeklyTarget + ' treinos por semana</p>' +
      '<p><span class="mono">Aluno desde</span><br>' + TB.date(u.createdAt, true) + '</p>' +
      '<p class="muted" style="font-size:.84rem">Para alterar esses dados, fale com o seu treinador.</p></div>' + TB.passwordCard() + '</div>' +
      '<button class="btn btn--danger btn--sm" type="button" data-logout style="justify-self:start">' + TB.icon('logout') + 'Sair da conta</button>';
    TB.bindPassword(root);
    root.querySelector('[data-logout]').addEventListener('click', TB.logout);
  };
})();
