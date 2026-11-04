/*
 * Перевод текста поста через Google Переводчик (публичный адрес без ключа).
 * Текст поста при этом уходит в Google — это написано в Настройки → Язык.
 *
 * Перед переводом прячем то, что переводить нельзя, и после возвращаем как было:
 *  • ссылки, @ники и #хэштеги;
 *  • название сайта: «связь», «связь.com», «связь апдейты» во всех формах
 *    (связи, связью…) — иначе переводчик превращает его в «connection».
 * Спрятанное заменяется метками [[0]], [[1]]… — их переводчик не трогает.
 */
const cache = new Map();

const PROTECT = [
  /https?:\/\/[^\s]+/giu,                                           // ссылки
  /[@#][\p{L}\p{N}_.]*[\p{L}\p{N}_]/gu,                             // @ники и #хэштеги
  /связ(?:ь|и|ью|ей|ям|ями|ях)(?:\.com|\s+апдейты)?(?![\p{L}\p{N}])/giu, // название сайта
];

// языки, где у слов есть падежи: туда название оставляем в той же форме, что и в оригинале
const KEEP_FORMS = new Set(['ru', 'uk', 'be']);

// «связи» / «Связью» → «связь» / «Связь» (окончание .com и «апдейты» сохраняем)
const baseForm = (m) =>
  m.replace(/^(с|С)вяз(?:ями|ью|ей|ям|ях|ь|и)/u, (_, first) => `${first}вязь`);

function protect(text, to) {
  const saved = [];
  let out = text;
  PROTECT.forEach((re, idx) => {
    out = out.replace(re, (m) => {
      const isBrand = idx === PROTECT.length - 1;
      saved.push(isBrand && !KEEP_FORMS.has(to) ? baseForm(m) : m);
      return `[[${saved.length - 1}]]`;
    });
  });
  return { out, saved };
}

function restore(text, saved) {
  // переводчик иногда добавляет пробелы внутри метки — учитываем это
  return text.replace(/\[\s*\[\s*(\d+)\s*\]\s*\]/g, (m, i) => saved[Number(i)] ?? m);
}

export async function translateText(text, to = 'ru') {
  const key = `${to}:${text}`;
  if (cache.has(key)) return cache.get(key);

  const { out, saved } = protect(text, to);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(to)}&dt=t&q=${encodeURIComponent(out)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Переводчик ответил ${res.status}`);
  const data = await res.json();
  const translated = (data?.[0] || []).map((part) => part?.[0] || '').join('');
  const result = {
    text: restore(translated, saved),
    from: data?.[2] || null, // язык оригинала, который определил переводчик
  };
  cache.set(key, result);
  return result;
}
