/* TEAMBAT — utilidades compartilhadas (API, formatação, modal, avisos, ícones) */
(function () {
  'use strict';
  var TB = (window.TB = { state: { user: null, brand: 'TeamBat', muscleGroups: [] }, views: {} });

  /* ---------- API ---------- */
  TB.api = function (method, path, body) {
    return fetch('/api' + path, {
      method: method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'teambat' },
      body: body === undefined ? undefined : JSON.stringify(body)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (res.ok) return data;
        var err = new Error(data.error || 'Não foi possível concluir. Tente novamente.');
        err.status = res.status;
        if (res.status === 401 && TB.state.user) { TB.state.user = null; TB.boot(); }
        throw err;
      });
    }, function () {
      var err = new Error('Sem conexão com o servidor.');
      err.offline = true;
      throw err;
    });
  };
  TB.get = function (p) { return TB.api('GET', p); };

  /* ---------- Texto e formatação ---------- */
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  TB.esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ESC[c]; }); };
  TB.kg = function (n) { return n == null ? '–' : String(Math.round(n * 100) / 100).replace('.', ','); };
  TB.num = function (n) { return Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 }); };
  var MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  TB.date = function (iso, withYear) {
    var d = new Date(iso);
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + (withYear || d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '');
  };
  TB.dateShort = function (iso) { var d = new Date(iso); return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2); };
  TB.time = function (iso) { var d = new Date(iso); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); };
  TB.dateTime = function (iso) { return WEEKDAYS[new Date(iso).getDay()] + ', ' + TB.date(iso) + ' · ' + TB.time(iso); };
  TB.ago = function (iso) {
    if (!iso) return 'nunca';
    var a = new Date(iso), b = new Date();
    var days = Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
    return days <= 0 ? 'hoje' : days === 1 ? 'ontem' : 'há ' + days + ' dias';
  };
  TB.duration = function (a, b) {
    if (!a || !b) return '';
    var m = Math.round((new Date(b) - new Date(a)) / 60000);
    return m < 60 ? m + ' min' : Math.floor(m / 60) + 'h' + ('0' + (m % 60)).slice(-2);
  };
  TB.greeting = function () { var h = new Date().getHours(); return h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };
  TB.firstName = function (n) { return String(n || '').trim().split(/\s+/)[0]; };
  TB.reps = function (ex) { return ex.repsMin === ex.repsMax ? String(ex.repsMin) : ex.repsMin + '–' + ex.repsMax; };
  TB.rest = function (s) { return s >= 60 ? Math.floor(s / 60) + 'min' + (s % 60 ? ' ' + (s % 60) + 's' : '') : s + 's'; };
  TB.setText = function (s) { return (s.weight == null ? '–' : TB.kg(s.weight) + ' kg') + ' × ' + (s.reps == null ? '–' : s.reps); };

  /* ---------- Ícones ---------- */
  var ICONS = {
    home: '<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>',
    dumbbell: '<path d="M7 7v10M4 9.5v5M17 7v10M20 9.5v5M7 12h10"/>',
    history: '<path d="M4 12a8 8 0 1 0 2.6-5.9M4 5v4h4M12 8v4l3 2"/>',
    chart: '<path d="M4 19h16M6 15l4-5 4 3 5-7"/>',
    user: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c.8-3.6 3.6-5.4 7-5.4s6.200 1.800 7 5.400"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    users: '<circle cx="9" cy="8.500" r="3.200"/><path d="M3 19.500c.6-3.200 3-4.800 6-4.800s5.400 1.600 6 4.800M16 5.600a3.200 3.200 0 0 1 0 5.800M17.500 14.900c1.900.5 3.100 2 3.500 4.600"/>',
    clipboard: '<rect x="5" y="4.500" width="14" height="16" rx="2"/><path d="M9 4.500V3h6v1.500M9 10h6M9 14h6M9 17.500h3"/>',
    book: '<path d="M5 4.500h10a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10"/>',
    cog: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.600 5.600l2.100 2.100M16.300 16.300l2.100 2.100M5.600 18.400l2.100-2.100M16.300 7.700l2.100-2.100"/>',
    check: '<path d="m5 12.500 4.500 4.500L19 7.500"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    up: '<path d="m6 14 6-6 6 6"/>',
    down: '<path d="m6 10 6 6 6-6"/>',
    chev: '<path d="m9 5 7 7-7 7"/>',
    left: '<path d="m15 5-7 7 7 7"/>',
    trash: '<path d="M5 7h14M10 7V4.500h4V7M7 7l1 13h8l1-13M10 11v5M14 11v5"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16zM13.500 6.500l4 4"/>',
    sync: '<path d="M20 12a8 8 0 0 1-14.300 4.900M4 12a8 8 0 0 1 14.300-4.900M18.500 3.500v4h-4M5.500 20.500v-4h4"/>',
    alert: '<path d="M12 4 3 19h18zM12 10v4M12 16.800v.2"/>',
    note: '<path d="M5 5h14v10l-4 4H5zM15 19v-4h4M8.500 9.500h7M8.500 13h4"/>',
    play: '<path d="M8 5.500v13l11-6.500z" fill="currentColor" stroke="none"/>',
    logout: '<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>'
  };
  TB.icon = function (name, cls) {
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || '') + '</svg>';
  };
  TB.bat = function (cls) { return '<svg class="' + (cls || '') + '" viewBox="0 0 120 64" aria-hidden="true"><use href="#bat"/></svg>'; };

  /* ---------- Ilustração por grupo muscular ---------- */
  var PARTS = {
    head: '<circle cx="32" cy="8" r="5.500"/>',
    shoulders: '<circle cx="19" cy="20" r="4.200"/><circle cx="45" cy="20" r="4.200"/>',
    chest: '<rect x="22.500" y="17.500" width="9" height="9.500" rx="2.500"/><rect x="32.500" y="17.500" width="9" height="9.500" rx="2.500"/>',
    abs: '<rect x="25.500" y="28.500" width="13" height="14" rx="3"/>',
    arms: '<rect x="13" y="24.500" width="6" height="13" rx="3"/><rect x="45" y="24.500" width="6" height="13" rx="3"/>',
    forearms: '<rect x="11.500" y="38.500" width="5.500" height="12" rx="2.700"/><rect x="47" y="38.500" width="5.500" height="12" rx="2.700"/>',
    hips: '<rect x="24.500" y="43.500" width="15" height="7" rx="3"/>',
    thighs: '<rect x="24" y="51.500" width="7.200" height="13.500" rx="3.400"/><rect x="32.800" y="51.500" width="7.200" height="13.500" rx="3.400"/>',
    calves: '<rect x="25" y="66" width="5.400" height="11.500" rx="2.700"/><rect x="33.600" y="66" width="5.400" height="11.500" rx="2.700"/>'
  };
  var GROUP_PARTS = {
    'Peito': ['chest'], 'Costas': ['chest', 'abs'], 'Ombros': ['shoulders'], 'Bíceps': ['arms'], 'Tríceps': ['arms'],
    'Antebraço': ['forearms'], 'Quadríceps': ['thighs'], 'Posterior de coxa': ['thighs'], 'Glúteos': ['hips'],
    'Panturrilhas': ['calves'], 'Abdômen': ['abs'], 'Outros': []
  };
  var BACK_VIEW = { 'Costas': 1, 'Tríceps': 1, 'Posterior de coxa': 1, 'Glúteos': 1, 'Panturrilhas': 1 };
  TB.figure = function (group) {
    var on = GROUP_PARTS[group] || [];
    var out = '<svg viewBox="0 0 64 80" role="img" aria-label="Ilustração: ' + TB.esc(group) + (BACK_VIEW[group] ? ' (vista posterior)' : '') + '">';
    Object.keys(PARTS).forEach(function (k) {
      var lit = on.indexOf(k) > -1;
      out += '<g fill="' + (lit ? '#A855F7' : '#241c33') + '"' + (lit ? ' style="filter:drop-shadow(0 0 3px rgba(168,85,247,.9))"' : '') + '>' + PARTS[k] + '</g>';
    });
    if (BACK_VIEW[group]) out += '<path d="M32 15v28" stroke="#0a0810" stroke-width="1.200"/>';
    return out + '</svg>';
  };
  /** Miniatura do exercício: foto cadastrada pelo treinador ou ilustração do grupo muscular */
  TB.thumb = function (ex, size) {
    return '<span class="fig' + (size ? ' fig--' + size : '') + '">' +
      (ex.image ? '<img src="' + TB.esc(ex.image) + '" alt="' + TB.esc(ex.name) + '" loading="lazy">' : TB.figure(ex.muscleGroup)) + '</span>';
  };
  TB.demoChip = function (flag) { return flag ? ' <span class="chip chip--demo" title="Dados fictícios de demonstração">DEMO</span>' : ''; };
  TB.empty = function (title, text, extra) {
    return '<div class="empty">' + TB.bat() + '<strong>' + TB.esc(title) + '</strong><p>' + TB.esc(text || '') + '</p>' + (extra || '') + '</div>';
  };
  TB.week = function (week) {
    var names = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
    return '<div class="week" role="img" aria-label="' + week.count + ' treinos nesta semana">' + week.days.map(function (d, i) {
      return '<span class="week__day' + (d.trained ? ' is-on' : '') + (d.today ? ' is-today' : '') + '"><i></i>' + names[i] + '</span>';
    }).join('') + '</div>';
  };

  /* ---------- Avisos ---------- */
  TB.toast = function (msg, type) {
    var el = document.createElement('div');
    el.className = 'toast' + (type === 'error' ? ' toast--error' : '');
    el.textContent = msg;
    document.getElementById('toasts').appendChild(el);
    setTimeout(function () { el.classList.add('is-out'); setTimeout(function () { el.remove(); }, 350); }, type === 'error' ? 4200 : 2400);
  };
  TB.fail = function (err) { TB.toast(err && err.message ? err.message : 'Algo deu errado.', 'error'); };

  /* ---------- Modal ---------- */
  TB.modal = function (opts) {
    var last = document.activeElement;
    var el = document.createElement('div');
    el.className = 'modal';
    el.innerHTML = '<div class="modal__backdrop" data-close></div>' +
      '<div class="modal__box" role="dialog" aria-modal="true" aria-label="' + TB.esc(opts.title) + '">' +
      '<div class="modal__head"><h2 class="h2">' + TB.esc(opts.title) + '</h2>' +
      '<button class="icon-btn" type="button" data-close aria-label="Fechar">' + TB.icon('x') + '</button></div>' +
      '<div class="modal__body">' + (opts.body || '') + '</div>' +
      (opts.foot ? '<div class="modal__foot">' + opts.foot + '</div>' : '') + '</div>';
    function close(value) {
      document.removeEventListener('keydown', onKey);
      el.remove();
      if (last && last.focus) last.focus();
      if (opts.onClose) opts.onClose(value);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    el.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(el);
    var focus = el.querySelector('[autofocus], .modal__body input, .modal__body select, .modal__body textarea, .modal__foot .btn--primary');
    if (focus) focus.focus();
    if (opts.onOpen) opts.onOpen(el, close);
    return close;
  };
  TB.confirm = function (title, text, okLabel, danger) {
    return new Promise(function (resolve) {
      var done = false;
      TB.modal({
        title: title,
        body: '<p class="muted">' + TB.esc(text) + '</p>',
        foot: '<button class="btn btn--ghost btn--sm" type="button" data-close>Cancelar</button>' +
          '<button class="btn btn--sm ' + (danger ? 'btn--danger' : 'btn--primary') + '" type="button" data-ok>' + TB.esc(okLabel || 'Confirmar') + '</button>',
        onOpen: function (el, close) { el.querySelector('[data-ok]').addEventListener('click', function () { done = true; close(); }); },
        onClose: function () { resolve(done); }
      });
    });
  };
  /** Formulário em modal. fields: html dos campos; onSubmit(dados, form) deve devolver uma Promise. */
  TB.formModal = function (opts) {
    return TB.modal({
      title: opts.title,
      body: '<form class="form" novalidate>' + opts.fields + '<p class="form-error" hidden></p>' +
        '<div class="row" style="justify-content:flex-end"><button class="btn btn--ghost btn--sm" type="button" data-close>Cancelar</button>' +
        '<button class="btn btn--primary btn--sm" type="submit">' + TB.esc(opts.submit || 'Salvar') + '</button></div></form>',
      onOpen: function (el, close) {
        var form = el.querySelector('form');
        if (opts.onOpen) opts.onOpen(form);
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var data = TB.formData(form), errEl = form.querySelector('.form-error'), btn = form.querySelector('[type=submit]');
          errEl.hidden = true; btn.disabled = true;
          Promise.resolve().then(function () { return opts.onSubmit(data, form); }).then(function (r) { close(); if (opts.after) opts.after(r); },
            function (err) { btn.disabled = false; errEl.textContent = err.message; errEl.hidden = false; });
        });
      }
    });
  };
  TB.formData = function (form) {
    var out = {};
    Array.prototype.forEach.call(form.elements, function (f) {
      if (!f.name) return;
      out[f.name] = f.type === 'checkbox' ? f.checked : f.value;
    });
    return out;
  };
  TB.field = function (label, name, value, attrs) {
    return '<label class="field"><span>' + TB.esc(label) + '</span><input class="input" name="' + name + '" value="' + TB.esc(value == null ? '' : value) + '" ' + (attrs || '') + '></label>';
  };
  TB.on = function (root, type, selector, handler) {
    root.addEventListener(type, function (e) {
      var t = e.target.closest(selector);
      if (t && root.contains(t)) handler(e, t);
    });
  };
  TB.go = function (path) { location.hash = '#/' + path; };
  TB.debounce = function (fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); }; };
})();
