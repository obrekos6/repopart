// Полоса прокрутки как на iPhone: тонкая капсула поверх контента,
// появляется только во время прокрутки и плавно гаснет. Одна на всё приложение:
// следит за любой прокручиваемой областью (лента, экраны, комментарии).
// На компьютере её можно тянуть мышью.

const PAD = 3;      // отступ от краёв области
const MIN = 36;     // минимальная длина капсулы
const HIDE_MS = 900;

export function initIosScrollbar() {
  if (typeof window === 'undefined' || window.__iosScrollbar) return;
  window.__iosScrollbar = true;
  document.documentElement.classList.add('ios-scrollbar');

  const bar = document.createElement('div');
  bar.className = 'ios-scroll-thumb';
  document.body.appendChild(bar);

  let target = null; // текущая прокручиваемая область
  let hideTimer = 0;
  let drag = null;

  const isDoc = (el) => el === document.scrollingElement || el === document.documentElement || el === document.body;

  const metrics = (el) => {
    const doc = isDoc(el);
    const r = doc ? { top: 0, right: window.innerWidth } : el.getBoundingClientRect();
    return {
      top: r.top,
      right: r.right,
      height: doc ? window.innerHeight : el.clientHeight,
      scrollTop: doc ? window.scrollY : el.scrollTop,
      scrollHeight: (doc ? document.documentElement : el).scrollHeight,
    };
  };

  const place = () => {
    if (!target) return null;
    const m = metrics(target);
    const max = m.scrollHeight - m.height;
    if (max <= 1 || m.height < 80) return null;
    const track = m.height - PAD * 2;
    const len = Math.max(MIN, (m.height / m.scrollHeight) * track);
    const pos = PAD + (Math.min(Math.max(m.scrollTop, 0), max) / max) * (track - len);
    bar.style.height = `${len}px`;
    bar.style.transform = `translate(${m.right - PAD}px, ${m.top + pos}px) translateX(-100%)`;
    return { max, track, len, scrollTop: m.scrollTop };
  };

  const show = () => {
    if (!place()) { bar.classList.remove('is-on'); return; }
    bar.classList.add('is-on');
    clearTimeout(hideTimer);
    if (!drag) hideTimer = setTimeout(() => bar.classList.remove('is-on'), HIDE_MS);
  };

  document.addEventListener('scroll', (e) => {
    const el = e.target === document ? document.scrollingElement : e.target;
    if (!(el instanceof Element)) return;
    // горизонтальные ленты (альбомы, фото вбок) не трогаем — только вертикаль
    if (!isDoc(el) && el.scrollHeight <= el.clientHeight + 1) return;
    target = el;
    show();
  }, true);

  window.addEventListener('resize', () => { if (bar.classList.contains('is-on')) place(); });

  // перетаскивание мышью
  bar.addEventListener('pointerdown', (e) => {
    const g = place();
    if (!g) return;
    e.preventDefault();
    bar.setPointerCapture(e.pointerId);
    drag = { y: e.clientY, start: g.scrollTop, ratio: g.max / Math.max(1, g.track - g.len) };
    bar.classList.add('is-drag');
    clearTimeout(hideTimer);
  });
  bar.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const top = drag.start + (e.clientY - drag.y) * drag.ratio;
    if (isDoc(target)) window.scrollTo(0, top);
    else target.scrollTop = top;
  });
  const end = () => {
    if (!drag) return;
    drag = null;
    bar.classList.remove('is-drag');
    show();
  };
  bar.addEventListener('pointerup', end);
  bar.addEventListener('pointercancel', end);
}
