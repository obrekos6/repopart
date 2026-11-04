import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useBackButton } from '../../../../lib/useBackButton';
import { CloseIcon } from '../../../../assets/icons/Icons';
// стили шторки общие с редактором поста (.modal, .rt-sheet, .modal-header…)
import '../modals/CreateRepoModal.css';
import '../media/HtmlPreviewScreen.css';
import './Sheet.css';

/*
 * Шторка в стиле Telegram iOS (Sheet - Bot, Type=App):
 * выезжает снизу, закрывается крестиком, свайпом вниз, «назад» и Esc.
 */
export default function Sheet({ title, subtitle, onClose, children, header, className = '' }) {
  const [shown, setShown] = useState(false);
  const [drag, setDrag] = useState(null);
  const closingRef = useRef(false);
  const dragRef = useRef({ active: false, startY: 0, lastY: 0, lastT: 0, velocity: 0, id: null });

  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { cancelAnimationFrame(raf); document.body.style.overflow = prev; };
  }, []);

  const handleClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setDrag(null);
    setShown(false);
    setTimeout(() => onClose(), 320);
  }, [onClose]);

  useBackButton(handleClose, true);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose]);

  const onGrabStart = (e) => {
    if (e.target.closest('button, input, textarea')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragRef.current = { active: true, startY: e.clientY, lastY: e.clientY, lastT: performance.now(), velocity: 0, id: e.pointerId };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const onGrabMove = (e) => {
    const d = dragRef.current;
    if (!d.active || e.pointerId !== d.id) return;
    const now = performance.now();
    if (now > d.lastT) d.velocity = (e.clientY - d.lastY) / (now - d.lastT);
    d.lastY = e.clientY;
    d.lastT = now;
    setDrag(Math.max(0, e.clientY - d.startY));
  };

  const onGrabEnd = (e) => {
    const d = dragRef.current;
    if (!d.active || e.pointerId !== d.id) return;
    d.active = false;
    if (e.clientY - d.startY > 100 || d.velocity > 0.5) handleClose();
    else setDrag(null);
  };

  return createPortal(
    <div className={`modal-overlay rt-overlay app-sheet-overlay ${shown ? 'is-shown' : ''}`} onClick={handleClose}>
      <div
        className={`modal rt-sheet app-sheet ${className} ${drag !== null ? 'is-grabbed' : ''}`}
        style={drag !== null ? { transform: `translateY(${drag}px)` } : undefined}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div
          className="modal-header"
          onPointerDown={onGrabStart}
          onPointerMove={onGrabMove}
          onPointerUp={onGrabEnd}
          onPointerCancel={onGrabEnd}
        >
          <div className="modal-grabber" />
          <button type="button" className="sheet-btn" onClick={handleClose} aria-label="Закрыть">
            <CloseIcon size={20} />
          </button>
          <div className="html-preview-title">
            <span className="html-preview-title-text">{title}</span>
            {subtitle && <span className="html-preview-subtitle">{subtitle}</span>}
          </div>
          {/* место справа, чтобы заголовок стоял ровно по центру */}
          <div className="app-sheet-spacer" />
        </div>

        {header}

        <div className="app-sheet-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}
