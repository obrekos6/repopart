import React from 'react';
import './appleEmoji.css';

/*
 * Эмодзи картинками (шрифтом нельзя: цветной шрифт слишком тяжёлый для браузера).
 * Картинки грузятся из публичного набора emoji-datasource-apple.
 */
const ENABLED = true;
const BASE = 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@16.0.0/img/apple/64/';

const EMOJI_RE = /\p{Regional_Indicator}{2}|[0-9#*]️?⃣|\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?(?:‍\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?)*/gu;

const toCode = (emoji) => [...emoji].map((c) => c.codePointAt(0).toString(16)).join('-');

// в наборе имя файла бывает и с fe0f, и без: если не нашлось — пробуем другой вариант,
// если и его нет — показываем обычный системный эмодзи
function onImgError(e) {
  const img = e.currentTarget;
  if (!img.dataset.retried) {
    img.dataset.retried = '1';
    const code = img.dataset.code;
    img.src = `${BASE}${code.includes('-fe0f') ? code.replace(/-fe0f/g, '') : `${code}-fe0f`}.png`;
    return;
  }
  img.replaceWith(document.createTextNode(img.alt));
}

export function AppleEmoji({ emoji, className = '' }) {
  if (!ENABLED) return <>{emoji}</>;
  const code = toCode(emoji);
  return (
    <img
      src={`${BASE}${code}.png`}
      data-code={code}
      alt={emoji}
      className={`apple-emoji ${className}`}
      draggable={false}
      loading="lazy"
      onError={onImgError}
    />
  );
}

/* строка → строка с эмодзи-картинками */
export function withAppleEmoji(text) {
  if (!ENABLED || typeof text !== 'string' || !text) return text;
  const out = [];
  let last = 0;
  for (const m of text.matchAll(EMOJI_RE)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<AppleEmoji key={m.index} emoji={m[0]} />);
    last = m.index + m[0].length;
  }
  if (!out.length) return text;
  if (last < text.length) out.push(text.slice(last));
  return out;
}
