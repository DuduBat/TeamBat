/* TEAMBAT — inicialização, login e navegação */
(function () {
  'use strict';
  var TB = window.TB, esc = TB.esc;
  var app = document.getElementById('app');

  var NAV = {
    student: [
      ['inicio', 'home', 'Início', 'Início'], ['treinos', 'dumbbell', 'Meus treinos', 'Treinos'], ['historico', 'history', 'Histórico', 'Histórico'],
      ['evolucao', 'chart', 'Minha evolução', 'Evolução'], ['perfil', 'user', 'Perfil', 'Perfil']
    ],
    admin: [
      ['dashboard', 'grid', 'Dashboard', 'Painel'], ['alunos', 'users', 'Alunos', 'Alunos'], ['montagem', 'clipboard', 'Montagem de treinos', 'Fichas'],
      ['biblioteca', 'book', 'Biblioteca de exercícios', 'Exercícios'], ['progressao', 'chart', 'Progressão', 'Progressão'], ['config', 'cog', 'Configurações', 'Ajustes']
    ]
  };
  var ALIAS = { treino: 'treinos' }; // telas internas que acendem um item do menu

  function brand() {
    return '<a class="brand" href="#/" aria-label="' + esc(TB.state.brand) + ' — início">' + TB.bat('brand__bat') + '<span class="brand__name">TEAM<span>BAT</span></span></a>';
  }

  /* ---------- Telas de entrada ---------- */
  function authScreen(inner) {
    app.innerHTML = '<main class="auth">' + TB.bat('auth__bat') + '<div class="auth__box">' +
      '<div><p class="eyebrow"><span class="dot"></span>Science Based Lifting</p><h1 class="auth__title">TEAM<span>BAT</span></h1></div>' + inner + '</div></main>';
    var form = app.querySelector('form');
    var first = form && form.querySelector('input');
    if (first) first.focus();
    return form;
  }
  function submitter(form, send, done) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = form.querySelector('.form-error'), btn = form.querySelector('[type=submit]');
      err.hidden = true; btn.disabled = true;
      send(TB.formData(form)).then(done, function (er) { btn.disabled = false; err.textContent = er.message; err.hidden = false; });
    });
  }
  function loginScreen() {
    var form = authScreen('<form class="card form" novalidate><h2 class="h2">Entrar</h2>' +
      '<label class="field"><span>E-mail</span><input class="input" type="email" name="email" autocomplete="username" inputmode="email" required></label>' +
      TB.passwordField('Senha', 'password', 'current-password', 'required') +
      '<p class="form-error" hidden></p><button class="btn btn--primary btn--block" type="submit">Entrar</button>' +
      '<p class="muted" style="font-size:.84rem">Alunos recebem o acesso do treinador. Esqueceu a senha? Peça uma nova a ele.</p></form>');
    submitter(form, function (d) { return TB.api('POST', '/login', d); }, function (r) { TB.state.user = r.user; location.hash = '#/'; start(); });
  }
  function setupScreen() {
    var form = authScreen('<form class="card form" novalidate><h2 class="h2">Configuração inicial</h2>' +
      '<p class="muted">Crie a conta do treinador. É com ela que você administra alunos, fichas e progressão.</p>' +
      '<label class="field"><span>Seu nome</span><input class="input" name="name" autocomplete="name" required maxlength="80"></label>' +
      '<label class="field"><span>E-mail</span><input class="input" type="email" name="email" autocomplete="username" required></label>' +
      TB.passwordField('Senha (mínimo 8 caracteres)', 'password', 'new-password', 'minlength="8" required') +
      '<label class="check"><input type="checkbox" name="demo" checked> Incluir 3 alunos fictícios de demonstração (marcados como DEMO, removíveis depois)</label>' +
      '<p class="form-error" hidden></p><button class="btn btn--primary btn--block" type="submit">Criar conta do treinador</button></form>');
    submitter(form, function (d) { return TB.api('POST', '/setup', d); }, function (r) { TB.state.user = r.user; location.hash = '#/'; start(); });
  }
  function firstPasswordScreen() {
    var form = authScreen('<form class="card form" novalidate><h2 class="h2">Crie sua senha</h2>' +
      '<p class="muted">Olá, ' + esc(TB.firstName(TB.state.user.name)) + '. Por segurança, troque a senha provisória por uma só sua.</p>' +
      TB.passwordField('Senha provisória', 'current', 'current-password', 'required') +
      TB.passwordField('Nova senha (mínimo 8 caracteres)', 'password', 'new-password', 'minlength="8" required') +
      '<p class="form-error" hidden></p><button class="btn btn--primary btn--block" type="submit">Salvar e entrar</button>' +
      '<button class="btn btn--ghost btn--sm" type="button" data-logout>Sair</button></form>');
    form.querySelector('[data-logout]').addEventListener('click', TB.logout);
    submitter(form, function (d) { return TB.api('POST', '/password', d); }, function () { TB.state.user.mustChangePassword = false; TB.toast('Senha criada.'); start(); });
  }

  /* ---------- Estrutura e rotas ---------- */
  function shell() {
    var u = TB.state.user, items = NAV[u.role];
    app.innerHTML = '<div class="shell">' +
      '<header class="topbar">' + brand() + '<span class="chip chip--purple">' + (u.role === 'admin' ? 'Treinador' : esc(TB.firstName(u.name))) + '</span></header>' +
      '<aside class="side">' + brand() + '<p class="mono" style="margin-top:-14px">Science Based Lifting</p>' +
      '<nav class="side__nav" aria-label="Navegação principal">' + items.map(function (it) {
        return '<a href="#/' + it[0] + '" data-nav="' + it[0] + '">' + TB.icon(it[1], 'nav-ico') + esc(it[2]) + '</a>';
      }).join('') + '</nav>' +
      '<div class="side__foot"><div class="side__user"><span class="mono">' + (u.role === 'admin' ? 'Treinador' : 'Aluno') + '</span><strong>' + esc(u.name) + '</strong></div>' +
      '<button class="btn btn--ghost btn--sm" type="button" data-logout>' + TB.icon('logout') + 'Sair</button></div></aside>' +
      '<main class="main" id="main"></main>' +
      '<nav class="tabbar" aria-label="Navegação principal">' + items.map(function (it) {
        return '<a href="#/' + it[0] + '" data-nav="' + it[0] + '">' + TB.icon(it[1]) + '<span>' + esc(it[3]) + '</span></a>';
      }).join('') + '</nav></div>';
    app.querySelector('.side [data-logout]').addEventListener('click', TB.logout);
  }
  TB.refreshShell = function () { var hash = location.hash; shell(); route(hash); };

  function route() {
    var u = TB.state.user;
    if (!u) return;
    var main = document.getElementById('main');
    if (!main) return;
    var parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    var views = TB.views[u.role], home = NAV[u.role][0][0];
    var name = parts[0] || home;
    if (!views[name]) { location.hash = '#/' + home; return; }
    var active = ALIAS[name] || name;
    app.querySelectorAll('[data-nav]').forEach(function (a) {
      var on = a.dataset.nav === active;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    // Cada navegação ganha um elemento novo: os eventos da tela anterior somem junto com ela
    var view = document.createElement('div');
    view.className = 'view';
    view.innerHTML = '<p class="muted">Carregando…</p>';
    main.innerHTML = '';
    main.appendChild(view);
    window.scrollTo(0, 0);
    views[name](view, parts.slice(1));
  }
  window.addEventListener('hashchange', route);

  function start() {
    var u = TB.state.user;
    if (!u) return loginScreen();
    if (u.mustChangePassword) return firstPasswordScreen();
    shell();
    route();
    if (u.role === 'student' && TB.flushPending) TB.flushPending();
  }

  TB.logout = function () {
    TB.api('POST', '/logout', {}).catch(function () {}).then(function () { TB.state.user = null; location.hash = ''; loginScreen(); });
  };
  TB.boot = function () {
    TB.get('/state').then(function (s) {
      TB.state.user = s.user; TB.state.brand = s.brand; TB.state.muscleGroups = s.muscleGroups;
      document.title = s.brand + ' | Science Based Lifting';
      if (s.needsSetup) setupScreen(); else start();
    }).catch(function (e) {
      app.innerHTML = '<main class="auth"><div class="auth__box"><div class="card stack"><h2 class="h2">Não foi possível conectar</h2><p class="muted">' + esc(e.message) + '</p>' +
        '<button class="btn btn--primary btn--sm" type="button" id="retry">Tentar de novo</button></div></div></main>';
      document.getElementById('retry').addEventListener('click', TB.boot);
    });
  };
  TB.boot();
})();
