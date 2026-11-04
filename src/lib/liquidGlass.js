/*
 * Liquid Glass — настоящее преломление фона, как в iOS 26 / Telegram.
 *
 * Как это работает (по статье kube.io «Liquid Glass in the Browser» и
 * проекту rizzytoday/liquid-glass):
 *  1. Для каждого элемента на canvas рисуется карта смещений: край стекла —
 *     выпуклый «сквиркл» (y = (1 - (1 - x)^4)^(1/4)), свет преломляется по
 *     закону Снелла (воздух n=1 → стекло n=1.5). Красный канал = сдвиг по X,
 *     зелёный = сдвиг по Y.
 *  2. SVG-фильтр с feDisplacementMap сдвигает пиксели фона по этой карте.
 *     Три прохода с разной силой для R, G и B дают цветной разлом
 *     (хроматическую аберрацию) по краям.
 *  3. Фильтр подключается через `backdrop-filter: url(#id)`.
 *
 * Работает только в браузерах на Chromium (Chrome, Edge, Яндекс, Android).
 * В Safari и Firefox остаётся обычное стекло с размытием из glass.css.
 */

// какие элементы получают жидкое стекло
const SELECTOR = [
  '.menu-btn',
  '.double-btn',
  '.tabs',
  '.rt-toolbar',
  '.html-preview-toolbar',
  '.html-preview-url-bar',
  '.html-preview-btn',
  '.app-page-btn',
  '.post-ctx-sheet',
  '.sheet-menu',
].join(',');

const IOR = 1.5;              // показатель преломления стекла
const SAMPLES = 128;          // точность профиля (8-битная карта больше не различит)

const SVG_NS = 'http://www.w3.org/2000/svg';

export function isLiquidGlassSupported() {
  if (typeof navigator === 'undefined' || typeof CSS === 'undefined') return false;
  const ua = navigator.userAgent;
  // backdrop-filter: url() есть только в Chromium; Chrome на iPhone (CriOS) — это WebKit
  return /Chrome\/\d+/.test(ua) && !/CriOS|FxiOS/.test(ua) && CSS.supports('backdrop-filter', 'blur(1px)');
}

/* ---------- профиль преломления по закону Снелла ---------- */
const surface = (t) => Math.pow(1 - Math.pow(1 - t, 4), 1 / 4); // выпуклый сквиркл

const PROFILE = (() => {
  const out = new Float32Array(SAMPLES);
  const d = 0.001;
  let max = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const t = Math.min(1 - d, Math.max(d, i / (SAMPLES - 1)));
    const slope = (surface(t + d) - surface(t - d)) / (2 * d);
    const theta1 = Math.atan(slope);                       // угол падения к нормали
    const theta2 = Math.asin(Math.sin(theta1) / IOR);      // угол после преломления
    const v = Math.tan(theta1 - theta2) * surface(t);      // сдвиг ∝ толщине стекла
    out[i] = v;
    if (v > max) max = v;
  }
  for (let i = 0; i < SAMPLES; i++) out[i] /= max || 1;
  return out;
})();

/* расстояние до края скруглённого прямоугольника и направление наружу */
function roundedRectField(px, py, w, h, r) {
  const qx = Math.abs(px - w / 2) - (w / 2 - r);
  const qy = Math.abs(py - h / 2) - (h / 2 - r);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  const outside = Math.hypot(ox, oy);
  const dist = outside + Math.min(Math.max(qx, qy), 0) - r; // < 0 внутри
  let nx;
  let ny;
  if (qx > 0 && qy > 0) { nx = ox / outside; ny = oy / outside; }
  else if (qx > qy) { nx = 1; ny = 0; }
  else { nx = 0; ny = 1; }
  if (px < w / 2) nx = -nx;
  if (py < h / 2) ny = -ny;
  return { inside: -dist, nx, ny };
}

function buildMaps(w, h, radius, bezel) {
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));
  const disp = document.createElement('canvas');
  disp.width = W;
  disp.height = H;
  const dctx = disp.getContext('2d');
  const D = dctx.createImageData(W, H);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const f = roundedRectField(x + 0.5, y + 0.5, W, H, radius);
      let dx = 0;
      let dy = 0;
      if (f.inside > 0.5 && f.inside < bezel) {
        const t = f.inside / bezel;
        const mag = PROFILE[Math.min(SAMPLES - 1, Math.floor(t * (SAMPLES - 1)))];
        dx = -f.nx * mag; // свет «тянется» к центру линзы
        dy = -f.ny * mag;
      }
      D.data[i] = 128 + dx * 127;
      D.data[i + 1] = 128 + dy * 127;
      D.data[i + 2] = 128;
      D.data[i + 3] = 255;

    }
  }
  dctx.putImageData(D, 0, 0);
  return { disp: disp.toDataURL() };
}

/* ---------- SVG-фильтр ---------- */
let svgRoot = null;
let counter = 0;

function ensureSvg() {
  if (svgRoot && svgRoot.isConnected) return svgRoot;
  svgRoot = document.createElementNS(SVG_NS, 'svg');
  svgRoot.setAttribute('aria-hidden', 'true');
  svgRoot.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
  document.body.appendChild(svgRoot);
  return svgRoot;
}

const el = (tag, attrs) => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
};

// оставляет в картинке один цветовой канал
const CHANNEL = {
  r: '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0',
  g: '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0',
  b: '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0',
};

function buildFilter(id, w, h, maps, scale) {
  const filter = el('filter', {
    id,
    x: 0, y: 0, width: w, height: h,
    filterUnits: 'userSpaceOnUse',
    primitiveUnits: 'userSpaceOnUse',
    'color-interpolation-filters': 'sRGB',
  });
  const box = { x: 0, y: 0, width: w, height: h, preserveAspectRatio: 'none' };

  filter.appendChild(el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: 1.2, result: 'frost' }));
  filter.appendChild(el('feImage', { ...box, href: maps.disp, result: 'map' }));

  // цветной разлом: R, G и B преломляются чуть по-разному
  [['r', scale], ['g', scale * 1.08], ['b', scale * 1.16]].forEach(([c, s]) => {
    filter.appendChild(el('feDisplacementMap', {
      in: 'frost', in2: 'map', scale: s.toFixed(2),
      xChannelSelector: 'R', yChannelSelector: 'G', result: `d${c}`,
    }));
    filter.appendChild(el('feColorMatrix', { in: `d${c}`, type: 'matrix', values: CHANNEL[c], result: c }));
  });
  filter.appendChild(el('feBlend', { in: 'r', in2: 'g', mode: 'screen', result: 'rg' }));
  filter.appendChild(el('feBlend', { in: 'rg', in2: 'b', mode: 'screen' }));
  // блики — не в фильтре, а тонкой кромкой через box-shadow (styles/glass.css)
  return filter;
}

/* ---------- подключение к элементам ---------- */
const attached = new Map(); // элемент → { id, filter, w, h }
let resizeObserver = null;

function radiusOf(node, w, h) {
  const r = parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0;
  return Math.min(r, w / 2, h / 2);
}

function update(node) {
  const state = attached.get(node);
  if (!state) return;
  const rect = node.getBoundingClientRect();
  // getBoundingClientRect учитывает transform (анимации) — берём размер без него
  const w = node.offsetWidth || rect.width;
  const h = node.offsetHeight || rect.height;
  if (w < 4 || h < 4) return;
  if (state.w === w && state.h === h) return;
  state.w = w;
  state.h = h;

  const radius = radiusOf(node, w, h);
  const bezel = Math.max(6, Math.min(Math.min(w, h) / 2, radius || 16, 26) * 0.8);
  // плюс: край берёт фон чуть глубже изнутри — как выпуклая линза.
  // Брать фон снаружи нельзя: браузер отдаёт фильтру фон только в пределах элемента
  const scale = Math.min(40, bezel * 1.5);

  const maps = buildMaps(w, h, radius, bezel);
  const filter = buildFilter(state.id, w, h, maps, scale);
  if (state.filter) state.filter.replaceWith(filter);
  else ensureSvg().appendChild(filter);
  state.filter = filter;

  node.style.backdropFilter = `url(#${state.id}) saturate(1.5)`;
  node.style.webkitBackdropFilter = `url(#${state.id}) saturate(1.5)`;
  node.classList.add('lg-on');
}

function attach(node) {
  if (attached.has(node)) return;
  attached.set(node, { id: `lg-${++counter}`, filter: null, w: 0, h: 0 });
  resizeObserver.observe(node);
  requestAnimationFrame(() => update(node));
}

function detach(node) {
  const state = attached.get(node);
  if (!state) return;
  resizeObserver?.unobserve(node);
  state.filter?.remove();
  attached.delete(node);
  // вернуть обычное стекло из glass.css
  node.style.backdropFilter = '';
  node.style.webkitBackdropFilter = '';
  node.classList.remove('lg-on');
}

function scan(root) {
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  if (root.matches(SELECTOR)) attach(root);
  root.querySelectorAll(SELECTOR).forEach(attach);
}

let mutationObserver = null;

function start() {
  if (mutationObserver) return;
  document.documentElement.classList.add('liquid-glass');
  resizeObserver = new ResizeObserver((entries) => {
    entries.forEach((e) => update(e.target));
  });
  scan(document.body);
  mutationObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach(scan);
      if (m.removedNodes.length) {
        attached.forEach((_, node) => { if (!node.isConnected) detach(node); });
      }
    }
  });
  mutationObserver.observe(document.body, { childList: true, subtree: true });
}

function stop() {
  mutationObserver?.disconnect();
  mutationObserver = null;
  [...attached.keys()].forEach(detach);
  resizeObserver?.disconnect();
  resizeObserver = null;
  document.documentElement.classList.remove('liquid-glass');
}

/* включить/выключить жидкое стекло (настройка «Оформление → Жидкое стекло») */
export function setLiquidGlassEnabled(on) {
  if (on && isLiquidGlassSupported()) start();
  else stop();
}

export function initLiquidGlass(enabled = true) {
  setLiquidGlassEnabled(enabled);
}
