/*
 * Форматирование текста постов в стиле Telegram.
 *
 * Пост хранится в поле `name` как текст с тегами (как HTML-режим Telegram Bot API):
 *   <b>жирный</b> <i>курсив</i> <u>подчёркнутый</u> <s>зачёркнутый</s>
 *   <code>моноширинный</code> <spoiler>скрытый</spoiler> <blockquote>цитата</blockquote>
 * Символы < > & внутри текста экранируются: &lt; &gt; &amp;
 *
 * Показ НЕ использует innerHTML: текст разбирается в дерево и рисуется
 * React-элементами, поэтому вставить в пост чужой HTML/скрипт нельзя.
 * Старые посты без тегов показываются как обычный текст.
 */
import React, { useState } from 'react';

export const RICH_TAGS = ['b', 'i', 'u', 's', 'code', 'spoiler', 'blockquote'];

const TOKEN_RE = /<(\/?)(b|i|u|s|code|spoiler|blockquote)>|&(lt|gt|amp);/g;
const ENTITY = { lt: '<', gt: '>', amp: '&' };

/* ---------- разбор: текст с тегами → дерево ---------- */
export function parseRich(markup = '') {
  const root = { tag: null, children: [] };
  const stack = [root];
  let last = 0;

  const pushText = (str) => {
    if (!str) return;
    const kids = stack[stack.length - 1].children;
    if (typeof kids[kids.length - 1] === 'string') kids[kids.length - 1] += str;
    else kids.push(str);
  };

  markup.replace(TOKEN_RE, (match, closing, tag, entity, offset) => {
    pushText(markup.slice(last, offset));
    last = offset + match.length;

    if (entity) { pushText(ENTITY[entity]); return match; }

    if (!closing) {
      const node = { tag, children: [] };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
      return match;
    }

    // закрывающий тег: закрываем, только если такой тег открыт
    const idx = stack.map((n) => n.tag).lastIndexOf(tag);
    if (idx > 0) stack.length = idx;
    else pushText(match); // лишний закрывающий тег — показываем как текст
    return match;
  });
  pushText(markup.slice(last));
  return root.children;
}

/* ---------- обычный текст без форматирования (копирование, alt, превью) ---------- */
export function toPlainText(markup = '') {
  return (markup || '').replace(TOKEN_RE, (m, c, tag, entity) => (entity ? ENTITY[entity] : ''));
}

/* ---------- скрытый текст (спойлер) ---------- */
function Spoiler({ children }) {
  const [shown, setShown] = useState(false);
  return (
    <span
      className={`rt-spoiler ${shown ? 'is-shown' : ''}`}
      data-no-redirect
      onClick={(e) => {
        if (shown) return;
        e.preventDefault();
        e.stopPropagation();
        setShown(true);
      }}
    >
      {children}
    </span>
  );
}

/* ---------- показ дерева React-элементами ---------- */
function renderNodes(nodes, renderText, keyPrefix = '') {
  let afterQuote = false;
  return nodes.map((node, i) => {
    const key = `${keyPrefix}${i}`;
    if (typeof node === 'string') {
      // цитата — блок, она сама заканчивает строку: убираем лишний перенос после неё
      const text = afterQuote ? node.replace(/^\n/, '') : node;
      afterQuote = false;
      return <React.Fragment key={key}>{renderText ? renderText(text) : text}</React.Fragment>;
    }
    const kids = renderNodes(node.children, renderText, `${key}-`);
    afterQuote = node.tag === 'blockquote';
    switch (node.tag) {
      case 'b': return <strong key={key}>{kids}</strong>;
      case 'i': return <em key={key}>{kids}</em>;
      case 'u': return <u key={key}>{kids}</u>;
      case 's': return <s key={key}>{kids}</s>;
      case 'code': return <code key={key} className="rt-code">{kids}</code>;
      case 'spoiler': return <Spoiler key={key}>{kids}</Spoiler>;
      case 'blockquote': return <blockquote key={key} className="rt-quote">{kids}</blockquote>;
      default: return <React.Fragment key={key}>{kids}</React.Fragment>;
    }
  });
}

/**
 * @param text        текст поста с тегами
 * @param renderText  необязательно: как рисовать кусок обычного текста (например, ссылки)
 */
export function RichText({ text, renderText }) {
  return <>{renderNodes(parseRich(text || ''), renderText)}</>;
}

/* ---------- сохранение: DOM редактора → текст с тегами ---------- */
const escapeText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const BLOCK_TAGS = new Set(['DIV', 'P', 'BLOCKQUOTE', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

function tagOf(el) {
  switch (el.nodeName) {
    case 'B': case 'STRONG': return 'b';
    case 'I': case 'EM': return 'i';
    case 'U': return 'u';
    case 'S': case 'STRIKE': case 'DEL': return 's';
    case 'CODE': return 'code';
    case 'BLOCKQUOTE': return 'blockquote';
    case 'SPAN': return el.hasAttribute('data-spoiler') ? 'spoiler' : null;
    default: return null;
  }
}

function serializeChildren(parent, isBlock) {
  let out = '';
  let pendingBreak = false;
  const nodes = Array.from(parent.childNodes);

  nodes.forEach((node, idx) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.nodeValue.replace(/​/g, '');
      if (!t) return;
      if (pendingBreak) { out += '\n'; pendingBreak = false; }
      out += escapeText(t);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    if (node.nodeName === 'BR') {
      // <br> в конце блока — служебный, Chrome ставит его в пустую строку
      if (isBlock && idx === nodes.length - 1) return;
      out += '\n';
      return;
    }

    const inner = serializeChildren(node, BLOCK_TAGS.has(node.nodeName));
    const tag = tagOf(node);
    const wrapped = tag && inner ? `<${tag}>${inner}</${tag}>` : inner;

    if (BLOCK_TAGS.has(node.nodeName)) {
      // каждый блок начинается с новой строки
      if (out !== '' || pendingBreak) out += '\n';
      out += wrapped;
      pendingBreak = true;
    } else {
      if (pendingBreak && wrapped) { out += '\n'; pendingBreak = false; }
      out += wrapped;
    }
  });
  return out;
}

export function serializeEditor(root) {
  if (!root) return '';
  return serializeChildren(root, true)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
