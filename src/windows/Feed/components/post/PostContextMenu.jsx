import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useT } from '../../../../lib/i18n';
import { createPortal } from 'react-dom';
// у «Перевести» значка пока нет: иконки translate нет в проекте
import { ShareIcon, CopyIcon, TrashIcon, CommentIcon, DownloadIcon } from '../../../../assets/icons/Icons';
import { AppleEmoji } from '../../../../lib/appleEmoji';
import './PostContextMenu.css';

// реакции: панель листается вбок
const REACTIONS = ['🤣', '😉', '🤔', '🤫', '🫩', '😎', '🤢', '😰', '😭', '😱', '🤬', '😈', '👿', '💀', '💩', '🤡', '❤️', '💯', '👌', '✌️', '🤙', '✊', '💪', '👀', '🎉', '📞', '🥀'];

const GAP = 8;      // между панелью реакций, постом и меню
const EDGE = 12;    // отступ от краёв экрана

/*
 * Меню поста как у сообщений в iOS:
 * экран размывается, сам пост «поднимается» на месте,
 * над ним — капсула с реакциями, под ним — стеклянный список действий.
 */
export default function PostContextMenu({
  open,
  anchorRef,
  myEmoji,
  onReact,
  onComments,
  onDownload,
  onClose,
  onShare,
  onCopy,
  onTranslate,
  translated = false,
  onDelete,
  isAuthor,
  hasCaption,
}) {
  const t = useT();
  const [visible, setVisible] = useState(false);
  const [layout, setLayout] = useState(null);
  const cloneBoxRef = useRef(null);
  const barRef = useRef(null);
  const menuRef = useRef(null);

  // снимок поста и расчёт, где всё разместить:
  // меню всегда под постом; пост стоит на месте, пока меню влезает,
  // иначе поднимается ровно настолько, чтобы меню влезло целиком;
  // слишком длинный пост обрезается снизу (начиная с реакций)
  useLayoutEffect(() => {
    if (!open) { setLayout(null); return; }
    const card = anchorRef?.current;
    const box = cloneBoxRef.current;
    if (!card || !box) return;
    const row = card.closest('.post-row') || card;
    const rr = row.getBoundingClientRect();
    const cr = card.getBoundingClientRect();

    const clone = row.cloneNode(true);
    clone.classList.remove('is-menu-open', 'is-pressed');
    clone.style.width = `${rr.width}px`;
    clone.style.margin = '0';
    clone.style.left = '0';
    clone.style.position = 'static';
    clone.querySelectorAll('video').forEach((v) => { v.removeAttribute('autoplay'); v.pause?.(); });
    // у копии свои id для svg (градиенты и маски аватарок), иначе они пропадают
    const ids = {};
    clone.querySelectorAll('[id]').forEach((el) => { const n = `${el.id}-m`; ids[el.id] = n; el.id = n; });
    clone.querySelectorAll('*').forEach((el) => {
      ['clip-path', 'fill', 'mask', 'stroke', 'style'].forEach((attr) => {
        const v = el.getAttribute(attr);
        if (v && v.includes('url(#')) el.setAttribute(attr, v.replace(/url\(#([^)]+)\)/g, (m, id) => `url(#${ids[id] || id})`));
      });
    });
    box.replaceChildren(clone);

    const vh = window.innerHeight;
    const barH = barRef.current?.offsetHeight || 52;
    const menuH = menuRef.current?.offsetHeight || 220;
    const maxPost = Math.max(120, vh - EDGE * 2 - barH - menuH - GAP * 2);
    let postH = rr.height;
    let cropped = false;
    if (postH > maxPost) {
      // длинный: убираем низ (реакции, комментарии) и обрезаем
      clone.querySelectorAll('.post-footer').forEach((el) => { el.style.display = 'none'; });
      postH = maxPost;
      cropped = true;
    }
    let top = rr.top;
    // меню не влезает снизу — поднимаем пост
    const overflow = top + postH + GAP + menuH + EDGE - vh;
    if (overflow > 0) top -= overflow;
    setLayout({ rowLeft: rr.left, rowW: rr.width, cardLeft: cr.left, cardW: cr.width, top, postH, barH, cropped, from: rr.top - top });
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) { setVisible(false); return undefined; }
    const raf = 0;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // показ — только когда всё уже стоит на местах: тогда подъём поста виден как плавное движение
  useEffect(() => {
    if (!open || !layout) return undefined;
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    return () => cancelAnimationFrame(r);
  }, [open, layout]);

  const close = () => {
    setVisible(false);
    setTimeout(() => onClose(), 220);
  };

  const act = (fn) => () => { close(); fn?.(); };

  if (!open) return null;

  const L = layout;
  const menuLeft = L ? Math.max(EDGE, Math.min(L.cardLeft, window.innerWidth - EDGE - 250)) : 0;

  return createPortal(
    <div className={`pcm ${visible && L ? 'is-visible' : ''}`} onClick={close} onContextMenu={(e) => { e.preventDefault(); close(); }}>
      <div className="pcm-backdrop" />

      {/* реакции */}
      <div
        ref={barRef}
        className="pcm-reactions"
        style={L ? { left: L.cardLeft, top: Math.max(EDGE, L.top - L.barH - GAP), maxWidth: Math.min(L.cardW + 20, window.innerWidth - L.cardLeft - EDGE) } : { visibility: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="pcm-reactions-row"
          onWheel={(e) => { e.currentTarget.scrollLeft += e.deltaY + e.deltaX; }}
        >
          {REACTIONS.map((e) => (
            <button
              key={e}
              type="button"
              className={`pcm-emoji ${myEmoji === e ? 'is-mine' : ''}`}
              onClick={act(() => onReact?.(e))}
            >
              <AppleEmoji emoji={e} />
            </button>
          ))}
        </div>
                      </div>

      {/* сам пост — «приподнятая» копия на своём месте */}
      <div
        className={`pcm-post ${L?.cropped ? 'is-cropped' : ''}`}
        style={L ? { left: L.rowLeft, top: L.top, width: L.rowW, height: L.postH, '--from': `${L.from}px` } : { visibility: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div ref={cloneBoxRef} />
      </div>

      {/* действия */}
      <div
        ref={menuRef}
        className="pcm-menu"
        style={L ? { left: menuLeft, top: L.top + L.postH + GAP } : { visibility: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="pcm-item is-comments" onClick={act(onComments)}>
          <span className="pcm-icon"><CommentIcon size={22} /></span>{t('post.comment')}
        </button>
        {hasCaption && (
          <button className="pcm-item" onClick={act(onCopy)}>
            <span className="pcm-icon"><CopyIcon size={22} /></span>{t('menu.copy')}
          </button>
        )}
        {onDownload && (
          <button className="pcm-item" onClick={act(onDownload)}>
            <span className="pcm-icon"><DownloadIcon size={22} /></span>{t('post.download')}
          </button>
        )}
        <button className="pcm-item" onClick={act(onShare)}>
          <span className="pcm-icon"><ShareIcon size={22} /></span>{t('menu.share')}
        </button>
        {onTranslate && (
          <button className="pcm-item" onClick={act(onTranslate)}>
            <span className="pcm-icon" />{translated ? t('menu.showOriginal') : t('menu.translate')}
          </button>
        )}
        {isAuthor && (
          <>
            <div className="pcm-sep" />
            <button className="pcm-item is-danger" onClick={act(onDelete)}>
              <span className="pcm-icon"><TrashIcon size={22} /></span>{t('menu.delete')}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
