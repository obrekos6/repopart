/*
 * Умный поиск по постам: находит слова с опечатками, по началу слова,
 * не различает «ё» и «е» и понимает текст, набранный не в той раскладке
 * («cdzpm» → «связь»).
 */
import { toPlainText } from './richText';

const EN = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`";
const RU = 'йцукенгшщзхъфывапролджэячсмитьбюё';
const toRu = Object.fromEntries([...EN].map((c, i) => [c, RU[i]]));
const toEn = Object.fromEntries([...RU].map((c, i) => [c, EN[i]]));

const swapLayout = (s, map) => [...s].map((c) => map[c] ?? c).join('');

export const normalize = (s) =>
  (s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const words = (s) => normalize(s).split(' ').filter(Boolean);

/* расстояние Дамерау—Левенштейна (перестановка соседних букв = 1 ошибка) */
function distance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2 = new Array(b.length + 1).fill(0);
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev2[j] = prev[j];
    prev = cur;
  }
  return prev[b.length];
}

// сколько ошибок прощаем в зависимости от длины слова
const allowed = (len) => (len <= 3 ? 0 : len <= 6 ? 1 : 2);

/* насколько слово поста похоже на слово запроса: 0 — не подходит */
function wordScore(token, word) {
  if (word.includes(token)) return word.startsWith(token) ? 3 : 2.5;
  const max = allowed(token.length);
  if (!max) return 0;
  // целое слово или его начало той же длины (слово ещё дописывается)
  const d = Math.min(distance(token, word, max), distance(token, word.slice(0, token.length), max));
  return d <= max ? 2 - d * 0.5 : 0;
}

/**
 * Подходит ли текст под запрос. Все слова запроса должны найтись.
 * @returns {{ score:number, terms:string[] } | null} terms — слова поста для подсветки
 */
function matchText(text, tokens) {
  const ws = words(text);
  const original = toPlainText(text || '').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  let score = 0;
  const terms = new Set();
  for (const t of tokens) {
    let best = 0;
    let bestWord = null;
    ws.forEach((w, i) => {
      const s = wordScore(t, w);
      if (s > best) { best = s; bestWord = original[i] || w; }
    });
    if (!best) return null;
    score += best;
    if (bestWord) {
      // точное совпадение подсвечиваем как есть, похожее — всё слово целиком
      terms.add(best >= 2.5 ? t : bestWord);
    }
  }
  return { score, terms: [...terms] };
}

/**
 * Ищет посты по запросу.
 * @returns {Array<{ post, score, terms }>} отсортировано: лучшие совпадения и новые выше
 */
export function fuzzySearch(posts, query) {
  const q = normalize(query);
  if (!q) return [];
  const variants = [q, swapLayout(q, toRu), swapLayout(q, toEn)].filter((v, i, a) => a.indexOf(v) === i);

  for (const v of variants) {
    const tokens = v.split(' ').filter(Boolean);
    const found = [];
    for (const post of posts) {
      const m = matchText(toPlainText(post.name || ''), tokens);
      if (m) found.push({ post, ...m });
    }
    if (found.length) {
      return found.sort((a, b) => b.score - a.score || new Date(b.post.created_at) - new Date(a.post.created_at));
    }
  }
  return [];
}
