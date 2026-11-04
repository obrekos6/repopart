import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useT } from '../../../../lib/i18n';
import { createPortal } from 'react-dom';
import { useBackButton } from '../../../../lib/useBackButton';
import { BackIcon } from '../../../../assets/icons/Icons';
import '../media/HtmlPreviewScreen.css';
import './Sheet.css';
import './Page.css';

/*
 * Экран как в Telegram iOS (не шторка): занимает всё окно над нижней панелью,
 * въезжает справа. Сверху стеклянная кнопка «Назад», заголовок и подзаголовок.
 * pushed=false — экран вкладки (появляется без анимации, без кнопки «Назад»).
 */
export default function Page({ title, subtitle, onClose, children, header, right, pushed = true, active = true, slide = 0 }) {
  const t = useT();
  const [shown, setShown] = useState(!pushed);
  const closingRef = useRef(false);

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
    setShown(false);
    setTimeout(() => onClose(), 320);
  }, [onClose, pushed]);

  useBackButton(handleClose, pushed ? true : active);

  return createPortal(
    <div
      className={`app-page ${pushed ? 'is-pushed' : 'is-tab'} ${shown ? 'is-shown' : ''} ${!pushed && !active ? 'is-inactive' : ''}`}
      style={!pushed ? { transform: `translateX(${slide * 100}%)` } : undefined}
      role="dialog"
      aria-label={title}
      aria-hidden={!pushed && !active ? true : undefined}
    >
      <header className="app-page-header">
        {pushed ? (
          <button type="button" className="sheet-btn app-page-btn" onClick={handleClose} aria-label={t('common.back')}>
            <BackIcon size={22} />
          </button>
        ) : (
          <div className="app-page-spacer" />
        )}
        <div className="html-preview-title">
          <span className="html-preview-title-text">{title}</span>
          {subtitle && <span className="html-preview-subtitle">{subtitle}</span>}
        </div>
        {right || <div className="app-page-spacer" />}
      </header>

      {header}

      <div className="app-page-body">{children}</div>
    </div>,
    document.body
  );
}
