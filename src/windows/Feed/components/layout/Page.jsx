import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useT } from '../../../../lib/i18n';
import { createPortal } from 'react-dom';
import { useBackButton } from '../../../../lib/useBackButton';
import { usePushParallax } from '../../../../lib/usePushParallax';
import { BackIcon } from '../../../../assets/icons/Icons';
import '../media/HtmlPreviewScreen.css';
import './Sheet.css';
import './Page.css';

/*
 * Экран как в Telegram iOS (не шторка): занимает всё окно над нижней панелью,
 * въезжает справа. Сверху стеклянная кнопка «Назад», заголовок и подзаголовок.
 * pushed=false — экран вкладки (появляется без анимации, без кнопки «Назад»).
 */
export default function Page({ title, subtitle, onClose, children, header, footer, right, pushed = true, active = true, slide = 0, zIndex, parallax = false, className = '', backIcon, titleCapsule = false, onBodyScroll }) {
  const t = useT();
  const [shown, setShown] = useState(!pushed);
  const closingRef = useRef(false);
  const rootRef = useRef(null);
  // экран под окном отъезжает влево вместе с въездом окна
  const pushBack = usePushParallax(rootRef, pushed && shown);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!pushed) return undefined;
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    return () => cancelAnimationFrame(raf);
  }, [pushed]);

  useEffect(() => {
    if (!pushed) return undefined; // экран вкладки ленту не блокирует
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [pushed]);

  const handleClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (!pushed) { closingRef.current = false; onClose(); return; }
    pushBack();
    setClosing(true);
    setTimeout(() => onClose(), 350);
  }, [onClose, pushed, pushBack]);

  useBackButton(handleClose, pushed ? true : active);

  useEffect(() => {
    if (!parallax) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [parallax, handleClose]);

  return createPortal(
    <div
      ref={rootRef}
      className={`app-page ${pushed ? 'is-pushed' : 'is-tab'} ${shown && !closing ? 'is-shown' : ''} ${!pushed && !active ? 'is-inactive' : ''} ${className}`}
      style={!pushed ? { transform: `translateX(${slide * 100}%)` } : (zIndex ? { zIndex } : undefined)}
      role="dialog"
      aria-label={title}
      aria-hidden={!pushed && !active ? true : undefined}
    >
      <header className="app-page-header">
        {pushed ? (
          <button type="button" className="sheet-btn app-page-btn" onClick={handleClose} aria-label={t('common.back')}>
            {backIcon || <BackIcon size={22} />}
          </button>
        ) : (
          // экран вкладки: «Назад» выезжает из-за левого края на место поиска
          <button type="button" className="sheet-btn app-page-btn tab-back-btn" onClick={onClose} aria-label={t('common.back')} tabIndex={active ? 0 : -1}>
            <BackIcon size={22} />
          </button>
        )}
        <div className="html-preview-title">
          <span className={`html-preview-title-text ${titleCapsule ? 'sheet-btn app-page-title-capsule' : ''}`}>{title}</span>
          {subtitle && <span className="html-preview-subtitle">{subtitle}</span>}
        </div>
        {right || <div className="app-page-spacer" />}
      </header>

      {header}

      <div className="app-page-body" onScroll={onBodyScroll}>{children}</div>
      {footer}
    </div>,
    document.body
  );
}
