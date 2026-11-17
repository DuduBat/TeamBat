/* ==========================================================================
   DUDUBAT — COMPORTAMENTO DO SITE
   O conteúdo editável fica em js/config.js. Aqui está só a lógica.
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.DUDUBAT || {};
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }
  function icon(id) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#' + id);
    svg.setAttribute('aria-hidden', 'true');
    svg.appendChild(use);
    return svg;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------- Tela de carregamento ---------- */
  function initLoader() {
    var loader = $('#loader');
    var done = false;
    function finish() {
      if (done) return;
      done = true;
      if (loader) loader.classList.add('is-done');
      document.body.classList.add('is-ready');
      setTimeout(function () { if (loader) loader.remove(); }, 1000);
    }
    var minTime = reduceMotion ? 150 : 1700;
    setTimeout(finish, minTime);
  }

  /* ---------- Cabeçalho, menu mobile, progresso de rolagem ---------- */
  function initHeader() {
    var header = $('#header');
    var nav = $('#nav');
    var burger = $('#burger');
    var progress = $('#scroll-progress');
    var lastY = window.scrollY;
    var ticking = false;

    function setMenu(open) {
      nav.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
      document.body.classList.toggle('is-locked', open);
      if (open) header.classList.remove('is-hidden');
    }
    burger.addEventListener('click', function () { setMenu(!nav.classList.contains('is-open')); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); burger.focus(); }
    });
    window.matchMedia('(min-width: 961px)').addEventListener('change', function () { setMenu(false); });

    function onScroll() {
      var y = window.scrollY;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      header.classList.toggle('is-scrolled', y > 20);
      // Esconde ao descer, reaparece ao subir
      if (!nav.classList.contains('is-open')) {
        if (y > lastY + 4 && y > 400) header.classList.add('is-hidden');
        else if (y < lastY - 4 || y <= 400) header.classList.remove('is-hidden');
      }
      if (progress) progress.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0) + ')';
      lastY = y;
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    }, { passive: true });
    header.addEventListener('focusin', function () { header.classList.remove('is-hidden'); });
    onScroll();

    // Destaca o link da seção visível
    var links = $$('[data-nav]');
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          links.forEach(function (a) { a.classList.remove('is-active'); a.removeAttribute('aria-current'); });
          var a = map[en.target.id];
          if (a) { a.classList.add('is-active'); a.setAttribute('aria-current', 'true'); }
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      $$('main section[id]').forEach(function (s) { io.observe(s); });
    }
  }

  /* ---------- Animações de entrada ---------- */
  function initReveal() {
    var items = $$('[data-reveal]');
    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (n) { n.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (n) { io.observe(n); });
  }

  /* ---------- Hero: profundidade, partículas e timecode ---------- */
  function initHero() {
    var hero = $('#inicio');
    if (!hero || reduceMotion) return;
    var visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(hero);
    }

    // Timecode decorativo (HH:MM:SS:FF a 24 fps)
    var tc = $('#timecode');
    var start = performance.now();

    // Profundidade com o mouse (apenas em dispositivos com ponteiro fino)
    var layers = $$('[data-depth]', hero);
    var tx = 0, ty = 0, cx = 0, cy = 0;
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      hero.addEventListener('pointermove', function (e) {
        var r = hero.getBoundingClientRect();
        tx = (e.clientX - r.left) / r.width - 0.5;
        ty = (e.clientY - r.top) / r.height - 0.5;
      });
      hero.addEventListener('pointerleave', function () { tx = 0; ty = 0; });
    }

    // Partículas
    var canvas = $('#particles');
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = 0, h = 0, dots = [];
    function resize() {
      w = hero.clientWidth; h = hero.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var count = Math.round(Math.min(70, w / 22));
      dots = [];
      for (var i = 0; i < count; i++) {
        dots.push({
          x: Math.random() * w, y: Math.random() * h,
          r: Math.random() * 1.4 + 0.4,
          vx: (Math.random() - 0.5) * 0.12, vy: -(Math.random() * 0.22 + 0.04),
          a: Math.random() * 0.5 + 0.15, p: Math.random() * 6.28
        });
      }
    }
    resize();
    var resizeTimer;
    window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 200); });

    function frame(now) {
      requestAnimationFrame(frame);
      if (!visible || document.hidden) return;

      var t = (now - start) / 1000;
      if (tc) {
        var f = Math.floor(t * 24);
        tc.textContent = pad(Math.floor(f / 86400) % 100) + ':' + pad(Math.floor(f / 1440) % 60) + ':' + pad(Math.floor(f / 24) % 60) + ':' + pad(f % 24);
      }

      cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;
      layers.forEach(function (l) {
        var d = parseFloat(l.getAttribute('data-depth'));
        l.style.transform = 'translate3d(' + (cx * d * 2).toFixed(2) + 'px,' + (cy * d * 2).toFixed(2) + 'px,0)';
      });

      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < dots.length; i++) {
        var p = dots[i];
        p.x += p.vx; p.y += p.vy;
        if (p.y < -5) { p.y = h + 5; p.x = Math.random() * w; }
        if (p.x < -5) p.x = w + 5; else if (p.x > w + 5) p.x = -5;
        ctx.globalAlpha = p.a * (0.6 + 0.4 * Math.sin(t * 0.8 + p.p));
        ctx.fillStyle = i % 4 === 0 ? '#F5F0FA' : '#C084FC';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
      }
    }
    requestAnimationFrame(frame);
  }

  /* ---------- Painel de edição decorativo ---------- */
  function initEditor() {
    var wave = $('#waveform');
    if (wave) {
      var seed = 7;
      for (var i = 0; i < 64; i++) {
        seed = (seed * 9301 + 49297) % 233280; // pseudoaleatório fixo
        var bar = document.createElement('i');
        var env = 0.55 + 0.45 * Math.sin(i / 5);
        bar.style.setProperty('--h', Math.round(18 + (seed / 233280) * 70 * env));
        wave.appendChild(bar);
      }
    }
    var tl = $('.editor__timeline');
    if (tl) {
      var set = function () { tl.style.setProperty('--travel', (tl.clientWidth - 62) + 'px'); };
      set();
      window.addEventListener('resize', set);
    }
  }

  /* ---------- Portfólio: galeria, filtros e player ---------- */
  function initPortfolio() {
    var videos = CFG.videos || [];
    var cats = CFG.categories || [];
    var gallery = $('#gallery');
    var filters = $('#filters');
    if (!gallery) return;

    var catLabel = {};
    cats.forEach(function (c) { catLabel[c.id] = c.label; });

    function ratioLabel(v) {
      var r = v.width / v.height;
      var known = [[16 / 9, '16:9'], [9 / 16, '9:16'], [4 / 3, '4:3'], [3 / 4, '3:4'], [1, '1:1'], [4 / 5, '4:5']];
      for (var i = 0; i < known.length; i++) if (Math.abs(r - known[i][0]) < 0.02) return known[i][1];
      return v.width + '×' + v.height;
    }

    var items = videos.map(function (v, i) {
      var title = v.title || ('Projeto ' + pad(i + 1));
      var r = (v.width && v.height) ? (v.width / v.height) : 16 / 9;
      var tags = (v.categories || []).map(function (c) { return catLabel[c]; }).filter(Boolean).join(' • ');

      var img = el('img', {
        src: v.thumb, alt: '', loading: 'lazy', decoding: 'async',
        width: v.width || 1280, height: v.height || 720
      });
      var card = el('button', { class: 'card', type: 'button', 'aria-label': 'Reproduzir vídeo: ' + title + (v.duration ? ' (' + v.duration + ')' : '') }, [
        el('span', { class: 'card__media' }, [img]),
        el('span', { class: 'card__top' }, [
          el('span', { class: 'mono', text: pad(i + 1) + ' — ' + ratioLabel(v) }),
          v.duration ? el('span', { class: 'mono card__dur', text: v.duration }) : null
        ]),
        el('span', { class: 'card__play' }, [icon('i-play')]),
        el('span', { class: 'card__info' }, [
          el('span', { class: 'card__title', text: title }),
          tags ? el('span', { class: 'mono card__tags', text: tags }) : null
        ]),
        el('span', { class: 'card__bar' })
      ]);
      // spans dentro do botão precisam se comportar como blocos
      $$('.card__media, .card__title, .card__tags', card).forEach(function (n) { n.style.display = 'block'; });

      var li = el('li', { class: 'gallery__item', 'data-reveal': '' }, [card]);
      li.style.setProperty('--r', r.toFixed(4));
      li.style.setProperty('--delay', (i % 3) * 0.08 + 's');
      card.addEventListener('click', function () { openPlayer(i, card); });
      gallery.appendChild(li);
      return { data: v, title: title, ratio: r, li: li, card: card };
    });

    // Filtros (só aparecem categorias com pelo menos um vídeo)
    var used = cats.filter(function (c) {
      return videos.some(function (v) { return (v.categories || []).indexOf(c.id) > -1; });
    });
    var current = 'all';
    if (filters && used.length > 1) {
      [{ id: 'all', label: 'Todos' }].concat(used).forEach(function (c) {
        var n = c.id === 'all' ? videos.length : videos.filter(function (v) { return (v.categories || []).indexOf(c.id) > -1; }).length;
        var b = el('button', { class: 'filter', type: 'button', 'aria-pressed': String(c.id === 'all'), 'data-filter': c.id });
        b.appendChild(document.createTextNode(c.label));
        b.appendChild(el('span', { text: pad(n) }));
        filters.appendChild(b);
      });
      filters.addEventListener('click', function (e) {
        var b = e.target.closest('.filter');
        if (!b) return;
        current = b.getAttribute('data-filter');
        $$('.filter', filters).forEach(function (f) { f.setAttribute('aria-pressed', String(f === b)); });
        items.forEach(function (it) {
          var show = current === 'all' || (it.data.categories || []).indexOf(current) > -1;
          it.li.classList.toggle('is-out', !show);
          if (show) it.li.classList.add('is-in');
        });
      });
    }
    function visibleIndexes() {
      return items.map(function (it, i) { return it.li.classList.contains('is-out') ? -1 : i; }).filter(function (i) { return i > -1; });
    }

    /* ----- Player ----- */
    var player = $('#player');
    var video = $('#player-video');
    var stage = $('.player__stage', player);
    var titleEl = $('#player-title');
    var countEl = $('#player-count');
    var prevBtn = $('#player-prev');
    var nextBtn = $('#player-next');
    var active = -1;
    var opener = null;

    function load(i) {
      var it = items[i];
      var list = visibleIndexes();
      active = i;
      stage.style.setProperty('--r', it.ratio.toFixed(4));
      titleEl.textContent = it.title;
      countEl.textContent = pad(list.indexOf(i) + 1) + ' / ' + pad(list.length);
      video.pause();
      video.poster = it.data.thumb;
      video.src = it.data.file;             // o arquivo só é carregado aqui
      video.setAttribute('aria-label', it.title);
      video.load();
      var p = video.play();
      if (p && p.catch) p.catch(function () { /* autoplay bloqueado: o usuário aperta play */ });
      var multiple = list.length > 1;
      prevBtn.hidden = nextBtn.hidden = !multiple;
    }
    function openPlayer(i, from) {
      opener = from || document.activeElement;
      player.hidden = false;
      document.body.classList.add('is-locked');
      load(i);
      $('.player__close', player).focus();
    }
    function closePlayer() {
      if (player.hidden) return;
      if (document.fullscreenElement) document.exitFullscreen();
      video.pause();
      video.removeAttribute('src');
      video.load();                          // libera o download em andamento
      player.hidden = true;
      document.body.classList.remove('is-locked');
      if (opener && opener.focus) opener.focus();
      active = -1;
    }
    function step(dir) {
      var list = visibleIndexes();
      if (list.length < 2) return;
      var pos = list.indexOf(active);
      load(list[(pos + dir + list.length) % list.length]);
    }

    player.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) closePlayer(); });
    prevBtn.addEventListener('click', function () { step(-1); });
    nextBtn.addEventListener('click', function () { step(1); });
    document.addEventListener('keydown', function (e) {
      if (player.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); closePlayer(); return; }
      // setas navegam entre vídeos, exceto quando o foco está no próprio vídeo (lá elas avançam/retrocedem)
      if (document.activeElement !== video) {
        if (e.key === 'ArrowRight') step(1);
        if (e.key === 'ArrowLeft') step(-1);
      }
      if (e.key === 'Tab') { // mantém o foco dentro do player
        var f = $$('button:not([hidden]), video', player);
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ---------- Sobre mim ---------- */
  function initAbout() {
    var about = CFG.about || {};
    var body = $('#about-body');
    if (body) (about.paragraphs || []).forEach(function (t) { body.appendChild(el('p', { text: t })); });
    var frame = $('#about-photo');
    if (frame && about.photo) {
      var bat = $('.viewfinder__bat', frame);
      if (bat) bat.remove();
      frame.insertBefore(el('img', { src: about.photo, alt: 'Foto de DuduBat', loading: 'lazy' }), frame.firstChild);
    }
  }

  /* ---------- Serviços ---------- */
  var SERVICE_ICONS = {
    social: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m10 9.5 5 2.5-5 2.5z"/><path d="M7 2.5h10M8 21.5h8"/>',
    vertical: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="m10.5 9.5 4 2.5-4 2.5z"/>',
    long: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 9h19M2.5 15h19M7 5v4M12 5v4M17 5v4M7 15v4M12 15v4M17 15v4"/>',
    creative: '<path d="M12 2.5 13.8 8.2 19.5 10 13.8 11.8 12 17.5 10.2 11.8 4.5 10 10.2 8.2z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8zM5 16v4M3 18h4"/>',
    color: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18"/><path d="M12 7.5a4.5 4.5 0 0 1 0 9" fill="currentColor" stroke="none"/><path d="M12 3a9 9 0 0 1 0 18" fill="currentColor" fill-opacity=".25" stroke="none"/>',
    captions: '<rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="M6.5 11.5h4M13 11.5h4.5M6.5 15h7M16 15h1.5"/>'
  };
  function initServices() {
    var list = $('#services');
    if (!list) return;
    (CFG.services || []).forEach(function (s, i) {
      var ic = el('div', { class: 'service__icon', 'aria-hidden': 'true' });
      ic.innerHTML = '<svg viewBox="0 0 24 24">' + (SERVICE_ICONS[s.icon] || SERVICE_ICONS.creative) + '</svg>';
      var tags = el('ul', {}, (s.items || []).map(function (t) { return el('li', { text: t }); }));
      var li = el('li', { 'data-reveal': '' }, [
        el('article', { class: 'service' }, [
          ic,
          el('h3', { text: s.title }),
          s.description ? el('p', { text: s.description }) : null,
          (s.items || []).length ? tags : null
        ])
      ]);
      li.style.setProperty('--delay', (i % 3) * 0.08 + 's');
      list.appendChild(li);
    });
  }

  /* ---------- Contato e redes ---------- */
  function initContact() {
    var c = CFG.contact || {};
    var wa = String(c.whatsapp || '').replace(/\D/g, '');
    var ig = String(c.instagram || '').trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '');
    var mail = String(c.email || '').trim();

    var channels = [
      {
        id: 'whatsapp', label: 'WhatsApp', hint: 'Chamar no WhatsApp', field: 'contact.whatsapp',
        href: wa ? 'https://wa.me/' + wa + (c.whatsappMessage ? '?text=' + encodeURIComponent(c.whatsappMessage) : '') : '',
        external: true
      },
      {
        id: 'instagram', label: 'Instagram', hint: ig ? '@' + ig : '', field: 'contact.instagram',
        href: ig ? 'https://www.instagram.com/' + encodeURIComponent(ig) + '/' : '',
        external: true
      },
      {
        id: 'email', label: 'E-mail', hint: mail, field: 'contact.email',
        href: mail ? 'mailto:' + mail + (c.emailSubject ? '?subject=' + encodeURIComponent(c.emailSubject) : '') : '',
        external: false
      }
    ];

    var actions = $('#contact-actions');
    var social = $('#footer-social');
    channels.forEach(function (ch) {
      var ok = !!ch.href;
      // Botão grande da seção de contato
      if (actions) {
        var inner = [
          el('span', { class: 'contact-btn__icon' }, [icon('i-' + ch.id)]),
          el('span', { class: 'contact-btn__text' }, [
            el('strong', { text: ch.label }),
            el('small', { text: ok ? ch.hint : 'Configurar em js/config.js' })
          ])
        ];
        var btn = ok
          ? el('a', { class: 'contact-btn', href: ch.href }, inner)
          : el('span', { class: 'contact-btn is-empty', role: 'link', 'aria-disabled': 'true' }, inner);
        if (ok && ch.external) { btn.target = '_blank'; btn.rel = 'noopener noreferrer'; }
        actions.appendChild(btn);
      }
      // Ícone no rodapé
      if (social) {
        var s = ok
          ? el('a', { class: 'icon-btn', href: ch.href, 'aria-label': ch.label }, [icon('i-' + ch.id)])
          : el('span', { class: 'icon-btn is-empty', role: 'link', 'aria-disabled': 'true', 'aria-label': ch.label + ' (não configurado)', title: 'Preencha ' + ch.field + ' em js/config.js' }, [icon('i-' + ch.id)]);
        if (ok && ch.external) { s.target = '_blank'; s.rel = 'noopener noreferrer'; }
        social.appendChild(el('li', {}, [s]));
      }
    });
  }

  /* ---------- Inicialização ---------- */
  function safe(fn) { try { fn(); } catch (err) { console.error('[DuduBat]', err); } }
  function init() {
    var y = $('#year');
    if (y) y.textContent = new Date().getFullYear();
    // Conteúdo gerado primeiro, para que as animações de entrada o encontrem
    [initPortfolio, initAbout, initServices, initContact, initEditor, initHeader, initReveal, initHero, initLoader].forEach(safe);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
