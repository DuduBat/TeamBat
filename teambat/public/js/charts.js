/* TEAMBAT — gráficos em SVG (linha e barras), com crosshair e tooltip.
   Uma série por gráfico, um eixo por gráfico. */
(function () {
  'use strict';
  var TB = window.TB;
  var NS = 'http://www.w3.org/2000/svg';
  var uid = 0;

  function niceScale(min, max, integer) {
    if (min === max) { min -= 1; max += 1; }
    var pad = (max - min) * 0.15;
    var lo = Math.max(0, min - pad), hi = max + pad;
    var raw = (hi - lo) / 4;
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var step = [1, 2, 2.5, 5, 10].map(function (m) { return m * mag; }).filter(function (s) { return s >= raw; })[0] || 10 * mag;
    if (integer) step = Math.max(1, Math.round(step));
    lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
    var ticks = [];
    for (var v = lo; v <= hi + step / 1000; v += step) ticks.push(Math.round(v * 100) / 100);
    return { lo: lo, hi: hi, ticks: ticks };
  }
  function fmt(v) { return String(Math.round(v * 100) / 100).replace('.', ','); }
  function svgEl(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function mount(el, draw) {
    el.classList.add('chart');
    var last = 0;
    function render() {
      var w = Math.round(el.clientWidth);
      if (!w || w === last) return;
      last = w;
      el.innerHTML = '';
      draw(w);
    }
    render();
    if (window.ResizeObserver) new ResizeObserver(render).observe(el);
    else window.addEventListener('resize', render);
  }
  function tooltip(el) {
    var tip = document.createElement('div');
    tip.className = 'chart__tip';
    tip.hidden = true;
    el.appendChild(tip);
    return {
      show: function (x, y, html, w) {
        tip.innerHTML = html; tip.hidden = false;
        var half = tip.offsetWidth / 2;
        tip.style.left = Math.min(w - half - 2, Math.max(half + 2, x)) + 'px';
        tip.style.top = Math.max(tip.offsetHeight + 4, y - 12) + 'px';
      },
      hide: function () { tip.hidden = true; }
    };
  }
  function xLabels(svg, points, xOf, y, max) {
    var every = Math.max(1, Math.ceil(points.length / max));
    points.forEach(function (p, i) {
      if (i % every && i !== points.length - 1) return;
      if (i === points.length - 1 && (points.length - 1) % every && (points.length - 1) % every < every / 2) return;
      var t = svgEl('text', { x: xOf(i), y: y, 'text-anchor': 'middle' }, svg);
      t.textContent = p.x;
    });
  }

  /** points: [{ x: rótulo curto, title: rótulo completo, value: número|null, sub: texto extra }] */
  TB.lineChart = function (el, opts) {
    var points = opts.points || [];
    var valid = points.filter(function (p) { return p.value != null; });
    if (!valid.length) { el.innerHTML = '<p class="muted" style="padding:24px 0;text-align:center">Sem registros para este recorte.</p>'; return; }
    mount(el, function (W) {
      var H = opts.height || 220, m = { l: 40, r: 16, t: 22, b: 28 };
      var id = 'g' + (++uid);
      var vals = valid.map(function (p) { return p.value; });
      var sc = niceScale(Math.min.apply(null, vals), Math.max.apply(null, vals), opts.integer);
      var iw = W - m.l - m.r, ih = H - m.t - m.b;
      var xOf = function (i) { return points.length === 1 ? m.l + iw / 2 : m.l + (i / (points.length - 1)) * iw; };
      var yOf = function (v) { return m.t + ih - ((v - sc.lo) / (sc.hi - sc.lo)) * ih; };
      var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': opts.label || 'Gráfico' }, el);
      var defs = svgEl('defs', {}, svg);
      var grad = svgEl('linearGradient', { id: id, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      svgEl('stop', { offset: 0, 'stop-color': '#A855F7', 'stop-opacity': 0.28 }, grad);
      svgEl('stop', { offset: 1, 'stop-color': '#A855F7', 'stop-opacity': 0 }, grad);

      sc.ticks.forEach(function (t) {
        svgEl('line', { class: t === sc.lo ? 'axis-line' : 'grid-line', x1: m.l, x2: W - m.r, y1: yOf(t), y2: yOf(t) }, svg);
        var tx = svgEl('text', { x: m.l - 8, y: yOf(t) + 3.5, 'text-anchor': 'end' }, svg);
        tx.textContent = fmt(t);
      });
      xLabels(svg, points, xOf, H - 8, Math.max(2, Math.floor(iw / 56)));

      var d = '', first = null, lastI = null;
      points.forEach(function (p, i) {
        if (p.value == null) return;
        d += (d ? 'L' : 'M') + xOf(i).toFixed(1) + ' ' + yOf(p.value).toFixed(1);
        if (first === null) first = i;
        lastI = i;
      });
      if (valid.length > 1) {
        svgEl('path', { d: d + 'L' + xOf(lastI).toFixed(1) + ' ' + (m.t + ih) + 'L' + xOf(first).toFixed(1) + ' ' + (m.t + ih) + 'Z', fill: 'url(#' + id + ')' }, svg);
        svgEl('path', { class: 'series', d: d }, svg);
      }
      var cross = svgEl('line', { class: 'cross', y1: m.t, y2: m.t + ih, visibility: 'hidden' }, svg);
      var maxVal = Math.max.apply(null, vals), maxI = -1;
      points.forEach(function (p, i) { if (p.value === maxVal) maxI = i; }); // o mais recente entre os empates
      var dots = points.map(function (p, i) {
        if (p.value == null) return null;
        return svgEl('circle', { class: 'pt' + (opts.markMax && i === maxI ? ' pt--max' : ''), cx: xOf(i), cy: yOf(p.value), r: valid.length > 40 ? 3 : 4.5 }, svg);
      });
      if (opts.markMax && maxI > -1 && valid.length > 1) {
        var lx = Math.min(W - m.r - 30, Math.max(m.l + 30, xOf(maxI)));
        var lt = svgEl('text', { class: 'lbl-max', x: lx, y: Math.max(11, yOf(maxVal) - 10), 'text-anchor': 'middle' }, svg);
        lt.textContent = 'máx ' + fmt(maxVal) + (opts.unit ? ' ' + opts.unit : '');
      }

      var tip = tooltip(el), active = -1;
      function select(i) {
        if (i === active) return;
        if (active > -1 && dots[active]) dots[active].classList.remove('pt--hover');
        active = i;
        if (i < 0) { cross.setAttribute('visibility', 'hidden'); tip.hide(); return; }
        var p = points[i];
        dots[i].classList.add('pt--hover');
        cross.setAttribute('x1', xOf(i)); cross.setAttribute('x2', xOf(i)); cross.setAttribute('visibility', 'visible');
        tip.show(xOf(i), yOf(p.value), '<span>' + TB.esc(p.title) + '</span><b>' + fmt(p.value) + (opts.unit ? ' ' + opts.unit : '') + '</b>' + (p.sub ? '<span>' + TB.esc(p.sub) + '</span>' : ''), W);
      }
      var hit = svgEl('rect', { x: m.l - 10, y: 0, width: iw + 20, height: H, fill: 'transparent' }, svg);
      function move(e) {
        var x = e.clientX - svg.getBoundingClientRect().left, best = -1, dist = Infinity;
        points.forEach(function (p, i) { if (p.value == null) return; var dx = Math.abs(xOf(i) - x); if (dx < dist) { dist = dx; best = i; } });
        select(best);
      }
      hit.addEventListener('pointermove', move);
      hit.addEventListener('pointerdown', move);
      hit.addEventListener('pointerleave', function () { select(-1); });
    });
  };

  /** bars: [{ x: rótulo curto, title: rótulo completo, value: número }] */
  TB.barChart = function (el, opts) {
    var bars = opts.bars || [];
    mount(el, function (W) {
      var H = opts.height || 180, m = { l: 30, r: 8, t: 14, b: 26 };
      var max = Math.max.apply(null, bars.map(function (b) { return b.value; }).concat([1]));
      var sc = niceScale(0, max, true); sc.lo = 0;
      sc.ticks = sc.ticks.filter(function (t) { return t >= 0; });
      var iw = W - m.l - m.r, ih = H - m.t - m.b, slot = iw / bars.length, bw = Math.min(26, slot - 2);
      var yOf = function (v) { return m.t + ih - (v / sc.hi) * ih; };
      var xOf = function (i) { return m.l + slot * i + slot / 2; };
      var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': opts.label || 'Gráfico' }, el);
      sc.ticks.forEach(function (t) {
        svgEl('line', { class: t === 0 ? 'axis-line' : 'grid-line', x1: m.l, x2: W - m.r, y1: yOf(t), y2: yOf(t) }, svg);
        var tx = svgEl('text', { x: m.l - 8, y: yOf(t) + 3.5, 'text-anchor': 'end' }, svg);
        tx.textContent = fmt(t);
      });
      xLabels(svg, bars, xOf, H - 8, Math.max(2, Math.floor(iw / 44)));
      var tip = tooltip(el);
      bars.forEach(function (b, i) {
        var h = Math.max(b.value ? 3 : 0, m.t + ih - yOf(b.value)), x = xOf(i) - bw / 2, y = m.t + ih - h, r = Math.min(4, h);
        var rect = b.value ? svgEl('path', {
          class: 'bar',
          d: 'M' + x + ' ' + (y + h) + 'V' + (y + r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'H' + (x + bw - r) + 'Q' + (x + bw) + ' ' + y + ' ' + (x + bw) + ' ' + (y + r) + 'V' + (y + h) + 'Z'
        }, svg) : null;
        var hit = svgEl('rect', { x: m.l + slot * i, y: 0, width: slot, height: H, fill: 'transparent' }, svg);
        function on() {
          if (rect) rect.classList.add('is-hover');
          tip.show(xOf(i), y, '<span>' + TB.esc(b.title) + '</span><b>' + fmt(b.value) + ' ' + TB.esc(b.value === 1 ? opts.unitOne || opts.unit || '' : opts.unit || '') + '</b>', W);
        }
        hit.addEventListener('pointerenter', on);
        hit.addEventListener('pointerdown', on);
        hit.addEventListener('pointerleave', function () { if (rect) rect.classList.remove('is-hover'); tip.hide(); });
      });
    });
  };
})();
