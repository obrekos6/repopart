/*
 * Liquid Glass — стекло как у Telegram (подобрано покадрово по видео Telegram Android).
 *
 * Как это работает:
 *  1. Для каждого элемента на canvas рисуется карта смещений. Кромка шириной
 *     ~0.4 радиуса работает как зеркало: у самого края стекло показывает фон
 *     с противоположной стороны (верх отражает низ и наоборот), к середине
 *     отражение плавно гаснет. Красный канал = сдвиг по X, зелёный = по Y.
 *  2. SVG-фильтр сдвигает пиксели фона по этой карте (feDisplacementMap),
 *     потом слегка размывает — той же силой, что обычное стекло в glass.css.
 *  3. Фильтр подключается через `backdrop-filter: url(#id)`.
 *
 * Работает только в браузерах на Chromium (Chrome, Edge, Яндекс, Android).
 * В Safari и Firefox остаётся обычное стекло с размытием из glass.css.
 */

// какие элементы получают жидкое стекло
const SELECTOR = [
  '.menu-btn',
  '.double-btn',
  '.sheet-btn:not(.is-accent)',
  '.parts-back',
  '.tabs',
  '.rt-toolbar',
  '.html-preview-toolbar',
  '.html-preview-url-bar',
  '.html-preview-btn',
  '.app-page-btn',
  '.app-page-title-capsule',
  '.post-ctx-sheet',
  '.sheet-menu',
].join(',');

const GLASS_BLUR = 2.5;       // размытие; то же число, что --glass-blur-px в glass.css
const MIRROR_BAND = 0.4;      // ширина отражающей кромки, доля от радиуса
const MIRROR_FALL = 2;        // как быстро отражение гаснет к середине
                              // (подобрано покадрово по видео Telegram Android)
const MAP_DPR = 2;            // карту смещений считаем в 2× — край без лесенки

const SVG_NS = 'http://www.w3.org/2000/svg';

export function isLiquidGlassSupported() {
  if (typeof navigator === 'undefined' || typeof CSS === 'undefined') return false;
  const ua = navigator.userAgent;
  // backdrop-filter: url() есть только в Chromium; Chrome на iPhone (CriOS) — это WebKit
  return /Chrome\/\d+/.test(ua) && !/CriOS|FxiOS/.test(ua) && CSS.supports('backdrop-filter', 'blur(1px)');
}

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

// Кромка-зеркало, как у Telegram: у края стекло показывает фон с противоположной
// стороны (верх отражает низ и наоборот), к середине отражение плавно гаснет.
// Сдвиг нормирован на scale = 2 * radius.
function buildMaps(w, h, radius) {
  const band = radius * MIRROR_BAND;
  const k = MAP_DPR;
  const W = Math.max(1, Math.round(w * k));
  const H = Math.max(1, Math.round(h * k));
  const disp = document.createElement('canvas');
  disp.width = W;
  disp.height = H;
  const dctx = disp.getContext('2d');
  const D = dctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const f = roundedRectField((x + 0.5) / k, (y + 0.5) / k, w, h, radius);
      let dx = 0;
      let dy = 0;
      if (f.inside > 0 && f.inside < band) {
        const fall = Math.pow(1 - f.inside / band, MIRROR_FALL);
        const d = (2 * radius - 2 * f.inside) * fall / (2 * radius);
        dx = -f.nx * d;
        dy = -f.ny * d;
      }
      D.data[i] = 128 + dx * 255;
      D.data[i + 1] = 128 + dy * 255;
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

function buildFilter(id, w, h, maps, scale) {
  const filter = el('filter', {
    id,
    x: 0, y: 0, width: w, height: h,
    filterUnits: 'userSpaceOnUse',
    primitiveUnits: 'userSpaceOnUse',
    'color-interpolation-filters': 'sRGB',
  });
  const box = { x: 0, y: 0, width: w, height: h, preserveAspectRatio: 'none' };

  filter.appendChild(el('feImage', { ...box, href: maps.disp, result: 'map' }));
  // сначала преломляем резкий фон, потом слегка размываем
  filter.appendChild(el('feDisplacementMap', {
    in: 'SourceGraphic', in2: 'map', scale: scale.toFixed(2),
    xChannelSelector: 'R', yChannelSelector: 'G', result: 'bent',
  }));
  filter.appendChild(el('feGaussianBlur', {
    in: 'bent', stdDeviation: GLASS_BLUR, edgeMode: 'duplicate',
  }));
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
  const r = Math.max(6, radius || 16);
  const scale = 2 * r;

  const maps = buildMaps(w, h, r);
  const filter = buildFilter(state.id, w, h, maps, scale);
  if (state.filter) state.filter.replaceWith(filter);
  else ensureSvg().appendChild(filter);
  state.filter = filter;

  node.style.backdropFilter = `url(#${state.id}) saturate(1.6)`;
  node.style.webkitBackdropFilter = `url(#${state.id}) saturate(1.6)`;
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
