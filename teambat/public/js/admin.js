/* TEAMBAT — Painel do treinador */
(function () {
  'use strict';
  var TB = window.TB, esc = TB.esc, V = (TB.views.admin = {});

  function head(eyebrow, title, right) {
    return '<header class="view-head"><div><p class="eyebrow"><span class="dot"></span>' + esc(eyebrow) + '</p><h1 class="title">' + title + '</h1></div>' + (right || '') + '</header>';
  }
  function fail(root) { return function (e) { root.innerHTML = '<p class="form-error">' + esc(e.message) + '</p>'; }; }
  function lastChip(s) {
    if (s.daysSinceLast === null) return '<span class="chip chip--warn">sem registros</span>';
    return '<span class="chip ' + (s.daysSinceLast <= 3 ? 'chip--good' : s.daysSinceLast < 7 ? '' : 'chip--warn') + '">' + TB.ago(s.lastWorkoutAt) + '</span>';
  }
  function studentRow(s) {
    return '<li><a class="list__item" href="#/alunos/' + s.id + '"><span class="badge-day">' + esc((s.name[0] || '?').toUpperCase()) + '</span>' +
      '<span class="grow"><strong>' + esc(s.name) + '</strong>' + TB.demoChip(s.isDemo) + (s.active ? '' : ' <span class="chip chip--bad">desativado</span>') +
      '<br><span class="muted" style="font-size:.84rem">' + (s.split ? 'Divisão ' + esc(s.split) + ' · ' : '') + s.week.count + ' de ' + s.weeklyTarget + ' treinos na semana</span></span>' +
      lastChip(s) + TB.icon('chev', 'list__chev') + '</a></li>';
  }
  function secretModal(title, text, secret) {
    TB.modal({
      title: title,
      body: '<p class="muted">' + text + '</p><div class="secret"><span>' + esc(secret) + '</span><button class="btn btn--ghost btn--sm" type="button" data-copy>Copiar</button></div>' +
        '<p class="muted" style="font-size:.84rem">Esta senha só aparece agora. No primeiro acesso o aluno é convidado a trocá-la.</p>',
      foot: '<button class="btn btn--primary btn--sm" type="button" data-close>Entendi</button>',
      onOpen: function (el) {
        el.querySelector('[data-copy]').addEventListener('click', function (e) {
          navigator.clipboard.writeText(secret).then(function () { e.target.textContent = 'Copiado'; }, function () { TB.toast('Selecione e copie a senha manualmente.', 'error'); });
        });
      }
    });
  }
  function studentFields(s) {
    s = s || {};
    return TB.field('Nome', 'name', s.name, 'required maxlength="80" autocomplete="off"') +
      TB.field('E-mail de acesso', 'email', s.email, 'type="email" required maxlength="160" autocomplete="off"') +
      TB.field('Objetivo (opcional)', 'goal', s.goal, 'maxlength="200"') +
      '<div class="form__row">' + TB.field('Treinos por semana', 'weeklyTarget', s.weeklyTarget || 4, 'type="number" min="1" max="7" inputmode="numeric"') +
      TB.field('Nome da divisão (opcional)', 'splitName', s.splitName, 'maxlength="30" placeholder="Ex.: Upper/Lower"') + '</div>';
  }
  function newStudent(after) {
    TB.formModal({
      title: 'Novo aluno', submit: 'Cadastrar aluno', fields: studentFields(),
      onSubmit: function (d) { d.weeklyTarget = Number(d.weeklyTarget); return TB.api('POST', '/admin/students', d); },
      after: function (r) {
        TB.toast('Aluno cadastrado.');
        secretModal('Acesso de ' + r.student.name, 'Envie ao aluno o e-mail <strong style="color:var(--white)">' + esc(r.student.email) + '</strong> e esta senha provisória:', r.temporaryPassword);
        after(r.student);
      }
    });
  }

  /* ---------- Dashboard ---------- */
  V.dashboard = function (root) {
    TB.get('/admin/dashboard').then(function (d) {
      function tile(label, value, hint) { return '<div class="card stat"><span class="stat__label">' + label + '</span><span class="stat__value">' + value + '</span><span class="stat__hint">' + hint + '</span></div>'; }
      root.innerHTML = head('Science Based Lifting', 'Visão geral da <em>consultoria.</em>', '<a class="btn btn--primary btn--sm" href="#/alunos">' + TB.icon('users') + 'Ver alunos</a>') +
        (d.hasDemo ? '<div class="banner"><span>Há <strong>dados de demonstração (fictícios)</strong> nesta conta: os alunos com o selo DEMO entram nos números abaixo. Remova-os em <a class="link" href="#/config">Configurações</a> quando quiser.</span></div>' : '') +
        '<div class="grid grid--4">' +
        tile('Alunos ativos', d.activeStudents, d.inactiveAccounts ? d.inactiveAccounts + ' desativados' : 'contas com acesso liberado') +
        tile('Treinaram recentemente', d.trainedRecently.length, 'nos últimos ' + d.inactiveAfter + ' dias') +
        tile('Sem registros recentes', '<span class="' + (d.withoutRecent.length ? 'delta--down' : '') + '">' + d.withoutRecent.length + '</span>', 'há ' + d.inactiveAfter + ' dias ou mais sem treinar') +
        tile('Treinos na semana', d.weekWorkouts + (d.weekTarget ? ' <small>de ' + d.weekTarget + '</small>' : ''), d.weekSets + ' séries registradas' + (d.adherence !== null ? ' · adesão ' + d.adherence + '%' : '')) +
        '</div>' +
        '<div class="card"><div class="card__head"><h2 class="h2">Treinos concluídos por dia</h2><span class="mono">últimos 14 dias</span></div><div data-chart></div></div>' +
        '<div class="grid grid--2 grid--stack">' +
        '<section class="stack"><h2 class="h2">Sem registros recentes</h2>' + (d.withoutRecent.length ? '<div class="card card--flush"><ul class="list">' + d.withoutRecent.map(studentRow).join('') + '</ul></div>'
          : TB.empty('Todos em dia', 'Nenhum aluno ativo está há ' + d.inactiveAfter + ' dias ou mais sem treinar.')) + '</section>' +
        '<section class="stack"><h2 class="h2">Atividade recente</h2>' + (d.recent.length ? '<div class="card card--flush"><ul class="list">' + d.recent.map(function (w) {
          return '<li><a class="list__item" href="#/alunos/' + w.studentId + '/historico"><span class="badge-day">' + esc(w.dayLabel) + '</span><span class="grow"><strong>' + esc(w.studentName) + '</strong>' + TB.demoChip(w.isDemo) +
            '<br><span class="muted num" style="font-size:.84rem">' + TB.dateTime(w.startedAt) + ' · ' + w.setCount + ' séries</span></span>' + TB.icon('chev', 'list__chev') + '</a></li>';
        }).join('') + '</ul></div>' : TB.empty('Nenhum treino nos últimos 14 dias', 'Os treinos concluídos pelos alunos aparecem aqui.')) + '</section></div>';
      TB.barChart(root.querySelector('[data-chart]'), {
        label: 'Treinos concluídos por dia', unit: 'treinos', unitOne: 'treino',
        bars: d.perDay.map(function (p) { return { x: p.date.slice(8) + '/' + p.date.slice(5, 7), title: TB.date(p.date + 'T12:00:00', true), value: p.count }; })
      });
    }).catch(fail(root));
  };

  /* ---------- Alunos ---------- */
  V.alunos = function (root, args) {
    if (args[0]) return studentPage(root, Number(args[0]), args[1] || 'visao');
    var filter = { q: '', inactive: false };
    TB.get('/admin/students').then(function (r) {
      var students = r.students;
      root.innerHTML = head('Gerenciamento', 'Alunos da <em>consultoria.</em>', '<button class="btn btn--primary btn--sm" type="button" data-new>' + TB.icon('plus') + 'Novo aluno</button>') +
        '<div class="row"><input class="input grow" type="search" data-q placeholder="Buscar por nome ou e-mail" aria-label="Buscar aluno">' +
        '<label class="check"><input type="checkbox" data-inactive> Mostrar desativados</label></div><div data-list></div>';
      function draw() {
        var q = filter.q.toLowerCase();
        var list = students.filter(function (s) { return (filter.inactive || s.active) && (!q || (s.name + ' ' + s.email).toLowerCase().indexOf(q) > -1); });
        root.querySelector('[data-list]').innerHTML = list.length ? '<div class="card card--flush"><ul class="list">' + list.map(studentRow).join('') + '</ul></div>'
          : TB.empty(students.length ? 'Nenhum aluno encontrado' : 'Nenhum aluno cadastrado', students.length ? 'Ajuste a busca ou os filtros.' : 'Cadastre o primeiro aluno para montar a ficha dele.');
      }
      draw();
      root.querySelector('[data-q]').addEventListener('input', function (e) { filter.q = e.target.value; draw(); });
      root.querySelector('[data-inactive]').addEventListener('change', function (e) { filter.inactive = e.target.checked; draw(); });
      root.querySelector('[data-new]').addEventListener('click', function () { newStudent(function (s) { TB.go('alunos/' + s.id + '/treino'); }); });
    }).catch(fail(root));
  };

  var TABS = [['visao', 'Visão geral'], ['treino', 'Treinamento atual'], ['historico', 'Histórico de treinos'], ['progressao', 'Progressão'], ['observacoes', 'Observações do treinador']];
  function studentPage(root, id, tab) {
    TB.get('/admin/students/' + id).then(function (d) {
      var s = d.student;
      root.innerHTML = '<a class="back" href="#/alunos">' + TB.icon('left') + 'Alunos</a>' +
        head(s.goal || 'Perfil do aluno', esc(s.name) + TB.demoChip(s.isDemo),
          '<div class="row"><button class="btn btn--ghost btn--sm" type="button" data-edit>' + TB.icon('edit') + 'Editar</button>' +
          '<button class="btn btn--ghost btn--sm" type="button" data-reset>Nova senha</button>' +
          '<button class="btn btn--sm ' + (s.active ? 'btn--danger' : 'btn--primary') + '" type="button" data-active>' + (s.active ? 'Desativar' : 'Reativar') + '</button></div>') +
        (s.active ? '' : '<div class="banner"><span>Conta desativada: o aluno não consegue entrar. O histórico continua guardado.</span></div>') +
        '<nav class="tabs" aria-label="Seções do aluno">' + TABS.map(function (t) {
          return '<a class="tab' + (t[0] === tab ? ' is-active' : '') + '" href="#/alunos/' + id + '/' + t[0] + '"' + (t[0] === tab ? ' aria-current="page"' : '') + '>' + t[1] + '</a>';
        }).join('') + '</nav><div class="stack" data-tab></div>';
      var pane = root.querySelector('[data-tab]');
      ({ visao: tabOverview, treino: tabPlan, historico: tabHistory, progressao: tabProgress, observacoes: tabNotes }[tab] || tabOverview)(pane, d);

      root.querySelector('[data-edit]').addEventListener('click', function () {
        TB.formModal({
          title: 'Editar aluno', fields: studentFields(s),
          onSubmit: function (f) { f.weeklyTarget = Number(f.weeklyTarget); return TB.api('PUT', '/admin/students/' + id, f); },
          after: function () { TB.toast('Dados atualizados.'); studentPage(root, id, tab); }
        });
      });
      root.querySelector('[data-reset]').addEventListener('click', function () {
        TB.confirm('Gerar nova senha?', 'A senha atual de ' + s.name + ' deixa de funcionar e as sessões abertas são encerradas.', 'Gerar nova senha').then(function (ok) {
          if (!ok) return;
          TB.api('POST', '/admin/students/' + id + '/reset-password', {}).then(function (r) {
            secretModal('Nova senha de ' + s.name, 'Envie esta senha provisória ao aluno:', r.temporaryPassword);
          }, TB.fail);
        });
      });
      root.querySelector('[data-active]').addEventListener('click', function () {
        var p = s.active ? TB.confirm('Desativar ' + s.name + '?', 'O aluno perde o acesso imediatamente. Treinos e histórico continuam guardados e a conta pode ser reativada depois.', 'Desativar', true) : Promise.resolve(true);
        p.then(function (ok) {
          if (!ok) return;
          TB.api('PUT', '/admin/students/' + id, { active: !s.active }).then(function () { TB.toast(s.active ? 'Aluno desativado.' : 'Aluno reativado.'); studentPage(root, id, tab); }, TB.fail);
        });
      });
    }).catch(fail(root));
  }

  function tabOverview(pane, d) {
    var s = d.student, finished = d.workouts.filter(function (w) { return w.finishedAt; });
    var sets = finished.reduce(function (a, w) { return a + w.setCount; }, 0);
    pane.innerHTML = '<div class="grid grid--4">' +
      '<div class="card stat"><span class="stat__label">Último treino</span><span class="stat__value">' + (finished[0] ? esc(finished[0].dayLabel) : '–') + '</span><span class="stat__hint">' + (finished[0] ? TB.ago(finished[0].startedAt) + ' · ' + TB.date(finished[0].startedAt) : 'Nenhum treino concluído') + '</span></div>' +
      '<div class="card stat"><span class="stat__label">Frequência nesta semana</span><span class="stat__value">' + s.week.count + ' <small>de ' + s.weeklyTarget + '</small></span><span class="stat__hint">meta semanal definida por você</span></div>' +
      '<div class="card stat"><span class="stat__label">Treinos concluídos</span><span class="stat__value">' + finished.length + '</span><span class="stat__hint">' + TB.num(sets) + ' séries registradas no total</span></div>' +
      '<div class="card stat"><span class="stat__label">Divisão atual</span><span class="stat__value">' + esc(s.split || '–') + '</span><span class="stat__hint">' + d.days.length + (d.days.length === 1 ? ' treino' : ' treinos') + ' na ficha</span></div></div>' +
      '<div class="grid grid--2 grid--stack"><div class="card"><div class="card__head"><h2 class="h2">Treinos por semana</h2><span class="mono">últimas 8 semanas</span></div><div data-chart></div></div>' +
      '<div class="card stack"><h2 class="h2">Semana atual</h2>' + TB.week(s.week) +
      '<p><span class="mono">Objetivo</span><br>' + esc(s.goal || 'Não informado') + '</p><p><span class="mono">E-mail de acesso</span><br>' + esc(s.email) + '</p>' +
      '<p><span class="mono">Aluno desde</span><br>' + TB.date(s.createdAt, true) + '</p></div></div>' +
      '<section class="stack"><div class="row row--between"><h2 class="h2">Últimos treinos</h2><a class="link" href="#/alunos/' + s.id + '/historico">Ver histórico completo</a></div>' +
      (d.workouts.length ? '<div class="card card--flush"><ul class="list">' + d.workouts.slice(0, 4).map(function (w) { return TB.workoutRow(w, '#/alunos/' + s.id + '/historico/' + w.id); }).join('') + '</ul></div>'
        : TB.empty('Sem treinos registrados', 'Quando o aluno registrar o primeiro treino, o resumo aparece aqui.')) + '</section>' +
      (d.notes[0] ? '<section class="stack"><h2 class="h2">Última observação</h2><div class="note"><b>' + TB.date(d.notes[0].createdAt, true) + '</b>' + esc(d.notes[0].text) + '</div></section>' : '');
    TB.barChart(pane.querySelector('[data-chart]'), {
      label: 'Treinos por semana', unit: 'treinos', unitOne: 'treino',
      bars: d.weeks.map(function (w) { return { x: w.start.slice(8) + '/' + w.start.slice(5, 7), title: 'Semana de ' + TB.date(w.start + 'T12:00:00', true), value: w.count }; })
    });
  }
  function tabPlan(pane, d) { TB.builder(pane, d.student.id); }
  function tabHistory(pane, d) {
    var m = /historico\/(\d+)/.exec(location.hash), sid = d.student.id;
    if (m) {
      TB.get('/workouts/' + m[1]).then(function (r) {
        var w = r.workout;
        pane.innerHTML = '<a class="back" href="#/alunos/' + sid + '/historico">' + TB.icon('left') + 'Todos os treinos</a>' +
          '<div class="row row--between"><div><h2 class="h2">Treino ' + esc(w.dayLabel) + (w.dayName ? ' · ' + esc(w.dayName) : '') + '</h2><p class="muted">' + TB.dateTime(w.startedAt) +
          (w.finishedAt ? ' · duração ' + TB.duration(w.startedAt, w.finishedAt) : ' · em andamento') + '</p></div>' +
          '<button class="btn btn--danger btn--sm" type="button" data-del>' + TB.icon('trash') + 'Excluir treino</button></div>' +
          (w.notes ? '<div class="note"><b>Anotação do aluno</b>' + esc(w.notes) + '</div>' : '') + TB.workoutReadHtml(w);
        pane.querySelector('[data-del]').addEventListener('click', function () {
          TB.confirm('Excluir este treino?', 'Todas as séries deste treino saem do histórico e da progressão. Esta ação não pode ser desfeita.', 'Excluir', true).then(function (ok) {
            if (ok) TB.api('DELETE', '/workouts/' + w.id).then(function () { TB.toast('Treino excluído.'); TB.go('alunos/' + sid + '/historico'); }, TB.fail);
          });
        });
      }).catch(fail(pane));
      return;
    }
    pane.innerHTML = d.workouts.length ? '<div class="card card--flush"><ul class="list">' + d.workouts.map(function (w) { return TB.workoutRow(w, '#/alunos/' + sid + '/historico/' + w.id); }).join('') + '</ul></div>'
      : TB.empty('Sem treinos registrados', 'O histórico completo do aluno aparece aqui, com data, horário e todas as séries.');
  }
  function tabProgress(pane, d) { TB.progressView(pane, { studentId: d.student.id }); }
  function tabNotes(pane, d) {
    var notes = d.notes.slice(), sid = d.student.id;
    function draw() {
      pane.innerHTML = '<form class="card form" novalidate><label class="field"><span>Nova observação (visível só para você)</span>' +
        '<textarea class="textarea" name="text" maxlength="2000" required placeholder="Ex.: ajustar amplitude no hack; reavaliar volume de ombros na próxima ficha."></textarea></label>' +
        '<button class="btn btn--primary btn--sm" type="submit" style="justify-self:start">Salvar observação</button></form>' +
        (notes.length ? notes.map(function (n) {
          return '<div class="card row row--between" style="align-items:flex-start"><div class="grow"><p class="mono">' + TB.dateTime(n.createdAt) + '</p><p style="white-space:pre-wrap;margin-top:6px">' + esc(n.text) + '</p></div>' +
            '<button class="icon-btn" type="button" data-del="' + n.id + '" aria-label="Excluir observação">' + TB.icon('trash') + '</button></div>';
        }).join('') : TB.empty('Nenhuma observação', 'Use este espaço para anotar ajustes, lesões, combinados e pontos de atenção.'));
      pane.querySelector('form').addEventListener('submit', function (e) {
        e.preventDefault();
        var text = e.target.text.value.trim();
        if (!text) return;
        TB.api('POST', '/admin/students/' + sid + '/notes', { text: text }).then(function (r) { notes.unshift(r.note); TB.toast('Observação salva.'); draw(); }, TB.fail);
      });
    }
    draw();
    TB.on(pane, 'click', '[data-del]', function (e, b) {
      var nid = Number(b.dataset.del);
      TB.api('DELETE', '/admin/notes/' + nid).then(function () { notes = notes.filter(function (n) { return n.id !== nid; }); draw(); }, TB.fail);
    });
  }

  /* ---------- Montagem de fichas ---------- */
  function studentSelect(root, current, onPick) {
    return TB.get('/admin/students').then(function (r) {
      var list = r.students.filter(function (s) { return s.active; });
      if (!list.length) { root.insertAdjacentHTML('beforeend', TB.empty('Nenhum aluno ativo', 'Cadastre um aluno para começar.', '<a class="btn btn--primary btn--sm" href="#/alunos">Ir para Alunos</a>')); return; }
      var box = document.createElement('div');
      box.className = 'stack';
      box.innerHTML = '<label class="field"><span>Aluno</span><select class="select">' + (current ? '' : '<option value="">Selecione um aluno…</option>') + list.map(function (s) {
        return '<option value="' + s.id + '"' + (s.id === current ? ' selected' : '') + '>' + esc(s.name) + (s.split ? ' — ' + esc(s.split) : '') + '</option>';
      }).join('') + '</select></label><div data-target class="stack"></div>';
      root.appendChild(box);
      var target = box.querySelector('[data-target]');
      box.querySelector('select').addEventListener('change', function (e) { if (e.target.value) onPick(Number(e.target.value)); });
      if (current) return target;
      target.innerHTML = TB.empty('Escolha um aluno', 'Selecione acima de quem você quer ver os dados.');
      return target;
    });
  }
  V.montagem = function (root, args) {
    var sid = args[0] ? Number(args[0]) : null;
    root.innerHTML = head('Fichas de treinamento', 'Montagem de <em>treinos.</em>');
    studentSelect(root, sid, function (id) { TB.go('montagem/' + id); }).then(function (target) { if (target && sid) TB.builder(target, sid); }).catch(TB.fail);
  };

  /** Editor de ficha de um aluno (divisões A, B, C... e exercícios prescritos) */
  TB.builder = function (root, studentId) {
    var days = [], active = null, library = null;
    function setDays(list) { days = list; if (!days.some(function (d) { return d.id === active; })) active = days[0] ? days[0].id : null; draw(); }
    function call(method, path, body, msg) { return TB.api(method, path, body).then(function (r) { setDays(r.days); if (msg) TB.toast(msg); }, TB.fail); }
    function suggestLabel() { return 'ABCDEFGHIJ'.split('').filter(function (l) { return !days.some(function (d) { return d.label === l; }); })[0] || ''; }

    function draw() {
      var day = days.filter(function (d) { return d.id === active; })[0];
      var html = '<div class="row row--between"><div class="tabs" role="tablist" aria-label="Divisões">' + days.map(function (d) {
        return '<button class="tab" type="button" role="tab" data-day="' + d.id + '" aria-selected="' + (d.id === active) + '">' + esc(d.label) + '</button>';
      }).join('') + '<button class="tab" type="button" data-newday>' + '+ Novo treino</button></div>' +
        '<span class="mono">Divisão ' + esc(days.map(function (d) { return d.label; }).join('') || '–') + '</span></div>';
      if (!day) {
        html += TB.empty('Ficha vazia', 'Crie o primeiro treino (A, B, C...) e adicione os exercícios.', '<button class="btn btn--primary btn--sm" type="button" data-newday>' + TB.icon('plus') + 'Criar treino A</button>');
      } else {
        html += '<div class="card card--flush"><div class="rx"><div class="row" style="align-items:flex-end">' +
          '<label class="field" style="width:96px"><span>Divisão</span><input class="input" data-dayf="label" maxlength="12" value="' + esc(day.label) + '"></label>' +
          '<label class="field grow"><span>Nome do treino</span><input class="input" data-dayf="name" maxlength="60" placeholder="Ex.: Peito, ombros e tríceps" value="' + esc(day.name) + '"></label>' +
          '<button class="icon-btn" type="button" data-delday aria-label="Remover este treino da ficha" style="height:48px;width:48px">' + TB.icon('trash') + '</button></div></div>' +
          day.exercises.map(function (ex, i) {
            return '<div class="rx" data-item="' + ex.id + '"><div class="ex" style="align-items:center">' + TB.thumb(ex, 'sm') +
              '<div class="grow"><p class="ex__name">' + (i + 1) + '. ' + esc(ex.name) + '</p><p class="muted" style="font-size:.8rem">' + esc(ex.muscleGroup) + '</p></div>' +
              '<button class="icon-btn" type="button" data-move="-1" aria-label="Mover para cima"' + (i === 0 ? ' disabled' : '') + '>' + TB.icon('up') + '</button>' +
              '<button class="icon-btn" type="button" data-move="1" aria-label="Mover para baixo"' + (i === day.exercises.length - 1 ? ' disabled' : '') + '>' + TB.icon('down') + '</button>' +
              '<button class="icon-btn" type="button" data-remove aria-label="Remover exercício da ficha">' + TB.icon('trash') + '</button></div>' +
              '<div class="rx__fields">' +
              '<label class="field"><span>Séries</span><input class="input" type="number" inputmode="numeric" min="1" max="12" data-f="sets" value="' + ex.sets + '"></label>' +
              '<label class="field"><span>Reps mín.</span><input class="input" type="number" inputmode="numeric" min="1" max="100" data-f="repsMin" value="' + ex.repsMin + '"></label>' +
              '<label class="field"><span>Reps máx.</span><input class="input" type="number" inputmode="numeric" min="1" max="100" data-f="repsMax" value="' + ex.repsMax + '"></label>' +
              '</div>' +
              '<label class="field"><span>Observações técnicas</span><input class="input" data-f="notes" maxlength="500" placeholder="Ex.: descer em 3 s; parar a 1–2 repetições da falha" value="' + esc(ex.notes) + '"></label></div>';
          }).join('') +
          '<div class="rx"><button class="btn btn--primary btn--sm" type="button" data-addex style="justify-self:start">' + TB.icon('plus') + 'Adicionar exercício</button>' +
          (day.exercises.length ? '' : '<p class="muted">Este treino ainda não tem exercícios.</p>') + '</div></div>' +
          '<p class="muted" style="font-size:.84rem">As alterações são salvas automaticamente. Treinos já realizados guardam a prescrição da época: editar a ficha não muda o histórico do aluno.</p>';
      }
      root.innerHTML = html;
    }
    function currentDay() { return days.filter(function (d) { return d.id === active; })[0]; }
    function loadLibrary(force) {
      if (library && !force) return Promise.resolve(library);
      return TB.get('/exercises').then(function (r) { library = r.exercises.filter(function (e) { return !e.archived; }); return library; });
    }
    function openPicker() {
      loadLibrary().then(function () {
        TB.modal({
          title: 'Adicionar exercício ao treino ' + currentDay().label,
          body: '<div class="row"><input class="input grow" type="search" data-q placeholder="Pesquisar exercício" aria-label="Pesquisar exercício">' +
            '<select class="select" data-g aria-label="Grupo muscular" style="width:auto"><option value="">Todos os grupos</option>' + TB.state.muscleGroups.map(function (g) { return '<option>' + esc(g) + '</option>'; }).join('') + '</select>' +
            '<button class="btn btn--primary btn--sm" type="button" data-newex>' + TB.icon('plus') + 'Novo exercício</button></div>' +
            '<div data-results class="stack" style="gap:4px;min-height:240px"></div>',
          foot: '<button class="btn btn--ghost btn--sm" type="button" data-close>Concluir</button>',
          onOpen: function (el) {
            var q = el.querySelector('[data-q]'), g = el.querySelector('[data-g]'), out = el.querySelector('[data-results]');
            /** highlight: id de um exercício recém-cadastrado, mostrado no topo e destacado */
            function list(highlight) {
              var term = q.value.trim();
              var items = library.filter(function (e) { return (!g.value || e.muscleGroup === g.value) && TB.matches(e.name, term); });
              if (highlight) items.sort(function (a, b) { return (b.id === highlight) - (a.id === highlight); });
              out.innerHTML = items.length ? items.map(function (e) {
                var isNew = e.id === highlight;
                return '<button class="pick' + (isNew ? ' is-new' : '') + '" type="button" data-pick="' + e.id + '">' + TB.thumb(e, 'sm') + '<span class="grow"><strong>' + esc(e.name) + '</strong>' +
                  (isNew ? ' <span class="chip chip--purple">recém-cadastrado</span>' : '') + '<br><span class="muted" style="font-size:.8rem">' + esc(e.muscleGroup) + '</span></span>' + TB.icon('plus', 'list__chev') + '</button>';
              }).join('') : '<div class="empty"><strong>Nenhum exercício encontrado</strong><p>' + (term ? 'Não há "' + esc(q.value.trim()) + '" na biblioteca.' : 'Não há exercícios neste grupo.') + '</p>' +
                '<button class="btn btn--primary btn--sm" type="button" data-newex>' + TB.icon('plus') + (term ? 'Cadastrar "' + esc(q.value.trim()) + '"' : 'Novo exercício') + '</button></div>';
            }
            list();
            q.addEventListener('input', function () { list(); }); g.addEventListener('change', function () { list(); });
            // Cadastra pelo mesmo formulário da Biblioteca, pré-preenchido com a busca e o grupo escolhidos
            TB.on(el, 'click', '[data-newex]', function () {
              TB.exerciseForm(null, {
                defaults: { name: q.value.trim(), muscleGroup: g.value },
                after: function (id) {
                  loadLibrary(true).then(function () {
                    q.value = ''; g.value = '';
                    list(id);
                    var created = out.querySelector('[data-pick="' + id + '"]');
                    if (created) { created.focus(); created.scrollIntoView({ block: 'nearest' }); }
                  }, TB.fail);
                }
              });
            });
            TB.on(out, 'click', '[data-pick]', function (e, b) {
              b.disabled = true;
              TB.api('POST', '/admin/days/' + active + '/exercises', { exerciseId: Number(b.dataset.pick), sets: 3, repsMin: 8, repsMax: 12, notes: '' })
                .then(function (r) { setDays(r.days); TB.toast('Exercício adicionado ao treino ' + currentDay().label + '.'); b.disabled = false; }, function (err) { b.disabled = false; TB.fail(err); });
            });
          }
        });
      }, TB.fail);
    }

    TB.on(root, 'click', '[data-day]', function (e, b) { active = Number(b.dataset.day); draw(); });
    TB.on(root, 'click', '[data-newday]', function () {
      TB.formModal({
        title: 'Novo treino', submit: 'Criar treino',
        fields: '<div class="form__row">' + TB.field('Divisão', 'label', suggestLabel(), 'required maxlength="12" placeholder="A"') + TB.field('Nome do treino (opcional)', 'name', '', 'maxlength="60" placeholder="Ex.: Costas e bíceps"') + '</div>',
        onSubmit: function (d) { return TB.api('POST', '/admin/students/' + studentId + '/days', d); },
        after: function (r) { active = r.days[r.days.length - 1].id; setDays(r.days); TB.toast('Treino criado.'); }
      });
    });
    TB.on(root, 'change', '[data-dayf]', function () {
      var label = root.querySelector('[data-dayf=label]').value.trim(), name = root.querySelector('[data-dayf=name]').value.trim();
      if (!label) { TB.toast('A divisão precisa de um nome (A, B, C...).', 'error'); draw(); return; }
      call('PUT', '/admin/days/' + active, { label: label, name: name }, 'Treino atualizado.');
    });
    TB.on(root, 'click', '[data-delday]', function () {
      var d = currentDay();
      TB.confirm('Remover o treino ' + d.label + ' da ficha?', 'O treino sai da ficha atual do aluno. Os treinos já realizados continuam no histórico e na progressão.', 'Remover', true)
        .then(function (ok) { if (ok) call('DELETE', '/admin/days/' + d.id, undefined, 'Treino removido da ficha.'); });
    });
    TB.on(root, 'click', '[data-addex]', openPicker);
    TB.on(root, 'click', '[data-remove]', function (e, b) { call('DELETE', '/admin/day-exercises/' + b.closest('[data-item]').dataset.item, undefined, 'Exercício removido da ficha.'); });
    TB.on(root, 'click', '[data-move]', function (e, b) {
      var ids = currentDay().exercises.map(function (x) { return x.id; });
      var i = ids.indexOf(Number(b.closest('[data-item]').dataset.item)), j = i + Number(b.dataset.move);
      if (j < 0 || j >= ids.length) return;
      ids.splice(j, 0, ids.splice(i, 1)[0]);
      call('POST', '/admin/days/' + active + '/reorder', { ids: ids });
    });
    TB.on(root, 'change', '[data-item] [data-f]', function (e, input) {
      var item = input.closest('[data-item]'), body = {};
      item.querySelectorAll('[data-f]').forEach(function (f) { body[f.dataset.f] = f.dataset.f === 'notes' ? f.value : Number(f.value); });
      TB.api('PUT', '/admin/day-exercises/' + item.dataset.item, body).then(function (r) { days = r.days; TB.toast('Prescrição salva.'); }, function (err) { TB.fail(err); draw(); });
    });

    root.innerHTML = '<p class="muted">Carregando ficha…</p>';
    TB.get('/plan?student=' + studentId).then(function (r) { setDays(r.days); }, fail(root));
  };

  /* ---------- Biblioteca de exercícios ---------- */
  function resizeImage(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var scale = Math.min(1, 480 / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = function () { reject(new Error('Não foi possível ler a imagem.')); };
      img.src = url;
    });
  }
  /** Formulário de cadastro e edição de exercícios da biblioteca.
      Usado na Biblioteca e na montagem de fichas, para que exista um único cadastro.
      opts.defaults: { name, muscleGroup } pré-preenchem um exercício novo.
      opts.after(id): chamado depois de salvar, com o id do exercício. */
  TB.exerciseForm = function (ex, opts) {
    ex = ex || {}; opts = opts || {};
    var defaults = opts.defaults || {};
    var image = ex.image || null;
    TB.formModal({
      title: ex.id ? 'Editar exercício' : 'Novo exercício', submit: ex.id ? 'Salvar' : 'Cadastrar',
      fields: TB.field('Nome do exercício', 'name', ex.id ? ex.name : defaults.name, 'required maxlength="80"') +
        '<label class="field"><span>Grupo muscular</span><select class="select" name="muscleGroup">' + TB.state.muscleGroups.map(function (g) { return '<option' + (g === (ex.muscleGroup || defaults.muscleGroup) ? ' selected' : '') + '>' + esc(g) + '</option>'; }).join('') + '</select></label>' +
        '<label class="field"><span>Instruções de execução (opcional)</span><textarea class="textarea" name="instructions" maxlength="600">' + esc(ex.instructions || '') + '</textarea></label>' +
        '<div class="field"><span>Imagem demonstrativa (opcional)</span><div class="row"><span data-preview></span><div class="grow stack" style="gap:8px">' +
        '<input class="input" type="file" accept="image/png,image/jpeg,image/webp" data-file aria-label="Enviar imagem">' +
        '<button class="btn btn--ghost btn--sm" type="button" data-noimg style="justify-self:start">Usar ilustração padrão</button></div></div>' +
        '<p class="muted" style="font-size:.8rem">Sem imagem, o app mostra a ilustração do grupo muscular. Envie apenas imagens que você tem direito de usar.</p></div>' +
        (ex.id ? '<label class="check"><input type="checkbox" name="archived"' + (ex.archived ? ' checked' : '') + '> Arquivar (some da busca ao montar fichas; o histórico é mantido)</label>' : ''),
      onOpen: function (f) {
        function preview() { f.querySelector('[data-preview]').innerHTML = TB.thumb({ image: image, name: f.name.value, muscleGroup: f.muscleGroup.value }, 'lg'); }
        preview();
        f.muscleGroup.addEventListener('change', preview);
        f.querySelector('[data-file]').addEventListener('change', function (e) {
          if (e.target.files[0]) resizeImage(e.target.files[0]).then(function (d) { image = d; preview(); }, TB.fail);
        });
        f.querySelector('[data-noimg]').addEventListener('click', function () { image = null; f.querySelector('[data-file]').value = ''; preview(); });
      },
      onSubmit: function (d) {
        var body = { name: d.name, muscleGroup: d.muscleGroup, instructions: d.instructions, image: image, archived: !!d.archived };
        return ex.id ? TB.api('PUT', '/admin/exercises/' + ex.id, body) : TB.api('POST', '/admin/exercises', body);
      },
      after: function (r) {
        TB.toast(ex.id ? 'Exercício atualizado.' : 'Exercício cadastrado.');
        if (opts.after) opts.after(ex.id || r.id);
      }
    });
  };
  V.biblioteca = function (root) {
    var filter = { q: '', group: '', archived: false }, lib = [];
    function load() { return TB.get('/exercises').then(function (r) { lib = r.exercises; draw(); }); }
    function draw() {
      var items = lib.filter(function (e) { return (filter.archived || !e.archived) && (!filter.group || e.muscleGroup === filter.group) && TB.matches(e.name, filter.q); });
      var groups = {};
      items.forEach(function (e) { (groups[e.muscleGroup] = groups[e.muscleGroup] || []).push(e); });
      root.querySelector('[data-list]').innerHTML = items.length ? TB.state.muscleGroups.filter(function (g) { return groups[g]; }).map(function (g) {
        return '<section class="stack" style="gap:10px"><div class="row row--between"><h2 class="h2">' + esc(g) + '</h2><span class="mono">' + groups[g].length + (groups[g].length === 1 ? ' exercício' : ' exercícios') + '</span></div>' +
          '<div class="lib-grid">' + groups[g].map(function (e) {
            return '<button class="lib-item' + (e.archived ? ' is-archived' : '') + '" type="button" data-edit="' + e.id + '">' + TB.thumb(e, 'sm') +
              '<span class="grow"><strong>' + esc(e.name) + '</strong>' + (e.archived ? '<br><span class="chip">arquivado</span>' : '') + '</span>' + TB.icon('edit', 'list__chev') + '</button>';
          }).join('') + '</div></section>';
      }).join('') : TB.empty('Nenhum exercício encontrado', 'Ajuste a busca ou cadastre um novo movimento.');
    }
    function form(ex) { TB.exerciseForm(ex, { defaults: { muscleGroup: filter.group }, after: load }); }
    root.innerHTML = head('Movimentos por grupo muscular', 'Biblioteca de <em>exercícios.</em>', '<button class="btn btn--primary btn--sm" type="button" data-new>' + TB.icon('plus') + 'Novo exercício</button>') +
      '<div class="row"><input class="input grow" type="search" data-q placeholder="Pesquisar exercício" aria-label="Pesquisar exercício">' +
      '<label class="check"><input type="checkbox" data-arch> Mostrar arquivados</label></div>' +
      '<div class="tabs" role="tablist" aria-label="Grupo muscular"><button class="tab" type="button" data-g="" aria-selected="true">Todos</button>' +
      TB.state.muscleGroups.map(function (g) { return '<button class="tab" type="button" data-g="' + esc(g) + '" aria-selected="false">' + esc(g) + '</button>'; }).join('') + '</div><div data-list class="stack stack--lg"></div>';
    root.querySelector('[data-q]').addEventListener('input', function (e) { filter.q = e.target.value; draw(); });
    root.querySelector('[data-arch]').addEventListener('change', function (e) { filter.archived = e.target.checked; draw(); });
    root.querySelector('[data-new]').addEventListener('click', function () { form(); });
    TB.on(root, 'click', '[data-g]', function (e, b) {
      filter.group = b.dataset.g;
      root.querySelectorAll('[data-g]').forEach(function (t) { t.setAttribute('aria-selected', String(t === b)); });
      draw();
    });
    TB.on(root, 'click', '[data-edit]', function (e, b) { form(lib.filter(function (x) { return x.id === Number(b.dataset.edit); })[0]); });
    load().catch(fail(root.querySelector('[data-list]')));
  };

  /* ---------- Progressão ---------- */
  V.progressao = function (root, args) {
    var sid = args[0] ? Number(args[0]) : null;
    root.innerHTML = head('Evolução exercício por exercício', 'Progressão dos <em>alunos.</em>');
    studentSelect(root, sid, function (id) { TB.go('progressao/' + id); }).then(function (target) { if (target && sid) TB.progressView(target, { studentId: sid }); }).catch(TB.fail);
  };

  /* ---------- Configurações ---------- */
  V.config = function (root) {
    TB.get('/admin/settings').then(function (s) {
      var u = TB.state.user;
      root.innerHTML = head('Conta e consultoria', 'Configu<em>rações.</em>') +
        '<div class="grid grid--2 grid--stack">' +
        '<form class="card form" data-settings novalidate><h2 class="h2">Consultoria</h2>' + TB.field('Nome da consultoria', 'brand', s.brand, 'required maxlength="40"') +
        TB.field('Considerar "sem registros recentes" após quantos dias sem treinar', 'inactiveDays', s.inactiveDays, 'type="number" min="2" max="60" inputmode="numeric"') +
        '<p class="muted" style="font-size:.84rem">Fuso horário usado nas semanas e datas: ' + esc(s.timezone) + '.</p>' +
        '<button class="btn btn--primary btn--sm" type="submit" style="justify-self:start">Salvar</button></form>' +
        '<form class="card form" data-profile novalidate><h2 class="h2">Meu acesso</h2>' + TB.field('Nome', 'name', u.name, 'required maxlength="80"') +
        '<p><span class="mono">E-mail de login</span><br>' + esc(u.email) + '</p><button class="btn btn--ghost btn--sm" type="submit" style="justify-self:start">Salvar nome</button></form>' +
        TB.passwordCard() +
        '<div class="card stack"><h2 class="h2">Dados de demonstração</h2>' +
        '<p class="muted">Três alunos <strong style="color:var(--white)">fictícios</strong>, com fichas e cerca de sete semanas de treinos gerados por fórmula, para você ver o app funcionando. Eles aparecem com o selo <span class="chip chip--demo">DEMO</span> e não representam pessoas reais.</p>' +
        (s.demo.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Conta de demonstração</th><th>E-mail</th></tr></thead><tbody>' + s.demo.map(function (d) { return '<tr><td>' + esc(d.name) + '</td><td>' + esc(d.email) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
          '<p class="muted" style="font-size:.84rem">Para ver a área do aluno, entre com um desses e-mails e a senha <strong style="color:var(--white)">' + esc(s.demoPassword) + '</strong>. Remova estas contas antes de usar o app com alunos reais.</p>' +
          '<button class="btn btn--danger btn--sm" type="button" data-demo="remove" style="justify-self:start">' + TB.icon('trash') + 'Remover dados de demonstração</button>'
          : '<button class="btn btn--ghost btn--sm" type="button" data-demo="load" style="justify-self:start">Carregar dados de demonstração</button>') + '</div></div>' +
        '<button class="btn btn--danger btn--sm" type="button" data-logout style="justify-self:start">' + TB.icon('logout') + 'Sair da conta</button>';
      TB.bindPassword(root);
      root.querySelector('[data-logout]').addEventListener('click', TB.logout);
      root.querySelector('[data-settings]').addEventListener('submit', function (e) {
        e.preventDefault();
        var d = TB.formData(e.target);
        TB.api('PUT', '/admin/settings', { brand: d.brand, inactiveDays: Number(d.inactiveDays) }).then(function () { TB.state.brand = d.brand; TB.toast('Configurações salvas.'); }, TB.fail);
      });
      root.querySelector('[data-profile]').addEventListener('submit', function (e) {
        e.preventDefault();
        TB.api('PUT', '/profile', { name: e.target.name.value }).then(function (r) { TB.state.user = r.user; TB.toast('Nome atualizado.'); TB.refreshShell(); }, TB.fail);
      });
      root.querySelector('[data-demo]').addEventListener('click', function (e) {
        var action = e.currentTarget.dataset.demo;
        var p = action === 'remove' ? TB.confirm('Remover dados de demonstração?', 'Os três alunos fictícios e todos os treinos deles serão apagados. Seus alunos reais não são afetados.', 'Remover', true) : Promise.resolve(true);
        p.then(function (ok) {
          if (ok) TB.api('POST', '/admin/demo', { action: action }).then(function () { TB.toast(action === 'remove' ? 'Dados de demonstração removidos.' : 'Dados de demonstração carregados.'); V.config(root); }, TB.fail);
        });
      });
    }).catch(fail(root));
  };
})();
