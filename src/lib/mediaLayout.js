/*
 * Раскладка медиа-альбома в стиле Telegram.
 *
 * Все размеры в «ширинах контейнера»: контейнер имеет ширину 1,
 * плитка = { x, y, w, h }, где x и w — доля ширины, а y и h — в тех же единицах
 * (высота 1.2 означает 1.2 × ширина контейнера).
 *
 * Промежутки между плитками в математику НЕ входят — их рисует CSS через padding.
 * Поэтому раскладка не зависит от реальной ширины экрана и считается один раз.
 */

export const MAX_TILES = 10;

const MAX_H = 1.2;          // потолок высоты для раскладок «сверху + ряд»
const SQUARE_H = 1.0;       // базовая высота составных раскладок (3 и 4 фото)
const OPTIMAL_H = 1.1;      // к какой общей высоте стремится раскладка из 5+ фото
const ROW_MAX_H = 1.0;      // потолок высоты одного ряда
const ROW_MIN_H = 0.25;     // ряды тоньше этого считаем «полосками» и штрафуем
const ROW_MIN_COUNT = 2;    // в ряду альбома 5+ фото: не меньше 2 плиток…
const ROW_MAX_COUNT = 4;    // …и не больше 4 (иначе мелко)
const TWO_MIN_H = 0.5;      // минимальная высота пары разных по форме фото
const TOTAL_SOFT_MAX = 1.4; // выше этого альбом из 5+ фото слишком длинный для ленты
const MIN_W = 0.22;         // минимальная доля ширины плитки в ряду
const MIN_SHARE = 0.2;      // минимальная доля высоты плитки в колонке
const R_MIN = 0.5;          // самое «высокое» фото, которое учитываем (1:2)
const R_MAX = 2;            // самое «широкое» фото, которое учитываем (2:1)
const SINGLE_MIN = 0.75;    // одиночное фото: не выше 3:4
const SINGLE_MAX = 2;       // одиночное фото: не шире 2:1

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const sum = (a) => a.reduce((s, v) => s + v, 0);
const rect = (x, y, w, h) => ({ x, y, w, h });

/* Ряд: ширины пропорциональны соотношению сторон, высота общая */
function row(rs, y, maxH = ROW_MAX_H, minH = 0) {
  const total = sum(rs);
  const raw = rs.map((v) => Math.max(v / total, MIN_W));
  const k = sum(raw);
  const h = clamp(1 / total, minH, maxH);
  let x = 0;
  return raw.map((v, i) => {
    const w = i === raw.length - 1 ? 1 - x : v / k;
    const t = rect(x, y, w, h);
    x += w;
    return t;
  });
}

/* Колонка: высоты обратно пропорциональны соотношению сторон, сумма = H */
function column(rs, x, w, y, H) {
  const inv = rs.map((v) => 1 / v);
  const total = sum(inv);
  const shares = inv.map((v) => Math.max(v / total, MIN_SHARE));
  const k = sum(shares);
  let yy = y;
  return shares.map((s, i) => {
    const h = i === shares.length - 1 ? y + H - yy : (s / k) * H;
    const t = rect(x, yy, w, h);
    yy += h;
    return t;
  });
}

function two(r, kinds) {
  const avg = (r[0] + r[1]) / 2;

  /* две широкие и почти одинаковые → друг под другом */
  if (kinds === 'ww' && avg > 1.4 && Math.abs(r[0] - r[1]) < 0.2) {
    const h = Math.min(1 / avg, MAX_H / 2);
    return [rect(0, 0, 1, h), rect(0, h, 1, h)];
  }

  /* похожие по форме → две равные колонки */
  if (kinds === 'ww' || kinds === 'qq') {
    const h = Math.min(0.5 / avg, MAX_H);
    return [rect(0, 0, 0.5, h), rect(0.5, 0, 0.5, h)];
  }

  /* разные → ширины пропорциональны формам; снизу ограничиваем высоту,
     чтобы пара «портрет + пейзаж» не превращалась в тонкую полоску */
  return row(r, 0, MAX_H, TWO_MIN_H);
}

function three(r, kinds) {
  /* первое высокое → слева оно на всю высоту, справа два друг под другом */
  if (kinds[0] === 'n') {
    const H = SQUARE_H;
    const h3 = clamp((H * r[1]) / (r[1] + r[2]), 0.3 * H, 0.7 * H);
    const h2 = H - h3;
    const rightW = clamp(Math.min(h3 * r[2], h2 * r[1]), MIN_W, 0.5);
    const leftW = 1 - rightW;
    return [rect(0, 0, leftW, H), rect(leftW, 0, rightW, h2), rect(leftW, h2, rightW, h3)];
  }

  /* иначе: первое сверху на всю ширину, два снизу рядом */
  const firstH = Math.min(1 / r[0], MAX_H * 0.66);
  return [rect(0, 0, 1, firstH), ...row([r[1], r[2]], firstH, MAX_H - firstH)];
}

function four(r, kinds) {
  /* первое широкое → сверху, три в ряд снизу */
  if (kinds[0] === 'w') {
    const firstH = Math.min(1 / r[0], MAX_H * 0.66);
    return [rect(0, 0, 1, firstH), ...row(r.slice(1), firstH, MAX_H - firstH)];
  }

  /* иначе: большое слева, три друг под другом справа */
  const H = SQUARE_H;
  const leftW = clamp(r[0] * H, 0.4, 0.66);
  return [rect(0, 0, leftW, H), ...column(r.slice(1), leftW, 1 - leftW, 0, H)];
}

/* 5+ фото: перебираем разбиения на 1–3 ряда и берём то, что ближе к OPTIMAL_H */
function rows(r) {
  const n = r.length;
  const rowH = (a, b) => Math.min(1 / sum(r.slice(a, b)), ROW_MAX_H);

  /* все разбиения на 1–3 ряда, в каждом ряду от 2 до 4 плиток */
  const ok = (c) => c >= ROW_MIN_COUNT && c <= ROW_MAX_COUNT;
  const attempts = [];
  if (ok(n)) attempts.push([n]);
  for (let a = ROW_MIN_COUNT; a <= ROW_MAX_COUNT; a++) {
    if (ok(n - a)) attempts.push([a, n - a]);
    for (let b = ROW_MIN_COUNT; b <= ROW_MAX_COUNT; b++) {
      if (ok(n - a - b)) attempts.push([a, b, n - a - b]);
    }
  }

  let best = attempts[0];
  let bestScore = Infinity;
  for (const counts of attempts) {
    let from = 0;
    let total = 0;
    let thinnest = Infinity;
    for (const c of counts) {
      const h = rowH(from, from + c);
      total += h;
      thinnest = Math.min(thinnest, h);
      from += c;
    }
    let score = Math.abs(total - OPTIMAL_H);
    /* верхние ряды не должны быть «плотнее» нижних — так выглядит аккуратнее */
    if (counts.length > 1 && (counts[0] > counts[1] || (counts.length > 2 && counts[1] > counts[2]))) {
      score *= 1.1;
    }
    /* штрафы: ряд-полоска и слишком длинный альбом */
    if (thinnest < ROW_MIN_H) score += (ROW_MIN_H - thinnest) * 8;
    if (total > TOTAL_SOFT_MAX) score += (total - TOTAL_SOFT_MAX) * 3;
    if (score < bestScore) {
      bestScore = score;
      best = counts;
    }
  }

  const tiles = [];
  let from = 0;
  let y = 0;
  for (const c of best) {
    const slice = r.slice(from, from + c);
    tiles.push(...row(slice, y));
    y += rowH(from, from + c);
    from += c;
  }
  return tiles;
}

/**
 * @param {number[]} ratios  ширина / высота каждого медиа (1–MAX_TILES штук)
 * @returns {{ height: number, tiles: {x:number,y:number,w:number,h:number}[] }}
 */
export function computeLayout(ratios) {
  const n = ratios.length;
  if (n === 0) return { height: 0, tiles: [] };

  /* одиночное: показываем как есть, режем только совсем экстремальное */
  if (n === 1) {
    const r = clamp(ratios[0] || 1, SINGLE_MIN, SINGLE_MAX);
    return { height: 1 / r, tiles: [rect(0, 0, 1, 1 / r)] };
  }

  const r = ratios.map((v) => clamp(v || 1, R_MIN, R_MAX));
  const kinds = r.map((v) => (v > 1.2 ? 'w' : v < 0.8 ? 'n' : 'q')).join('');

  let tiles;
  if (n === 2) tiles = two(r, kinds);
  else if (n === 3) tiles = three(r, kinds);
  else if (n === 4) tiles = four(r, kinds);
  else tiles = rows(r);

  return { height: Math.max(...tiles.map((t) => t.y + t.h)), tiles };
}