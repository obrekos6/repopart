import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ShareIcon, CopyIcon, TrashIcon } from '../../../../assets/icons/Icons';
import './PostContextMenu.css';

export default function PostContextMenu({
  open,
  onClose,
  onShare,
  onCopy,
  onDelete,
  isAuthor,
  hasCaption,
}) {
  const [visible, setVisible] = useState(false);
  const sheetRef = useRef(null);
  const dragRef = useRef({
    startY: 0,
    currentY: 0,
    active: false,
    pointerId: null,
  });
  const [dragOffset, setDragOffset] = useState(0);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      document.body.style.overflow = 'hidden';
    } else {
      setVisible(false);
      setDragOffset(0);
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => {
      setDragOffset(0);
      onClose();
    }, 280);
  };

  const handlePointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target.closest('.post-ctx-item');
    if (target) return;

    dragRef.current.active = true;
    dragRef.current.startY = e.clientY;
    dragRef.current.currentY = e.clientY;
    dragRef.current.pointerId = e.pointerId;

    try { sheetRef.current?.setPointerCapture(e.pointerId); } catch {}
  };

  const handlePointerMove = (e) => {
    if (!dragRef.current.active) return;
    if (e.pointerId !== dragRef.current.pointerId) return;
    const dy = e.clientY - dragRef.current.startY;
    if (dy < 0) return;
    dragRef.current.currentY = e.clientY;
    setDragOffset(dy);
  };

  const handlePointerUp = (e) => {
    if (!dragRef.current.active) return;
    if (e.pointerId !== dragRef.current.pointerId) return;

    try { sheetRef.current?.releasePointerCapture(e.pointerId); } catch {}

    dragRef.current.active = false;
    const dy = dragRef.current.currentY - dragRef.current.startY;

    if (dy > 120) {
      handleClose();
    } else {
      setDragOffset(0);
    }
  };

  if (!open) return null;

  const translateY = visible ? dragOffset : 400;

  return createPortal(
    <div
      className={`post-ctx-backdrop ${visible ? 'is-visible' : ''}`}
      onClick={handleClose}
    >
      <div
        ref={sheetRef}
        className={`post-ctx-sheet ${visible ? 'is-visible' : ''} ${dragRef.current.active ? 'is-dragging' : ''}`}
        style={{
          transform: `translate(-50%, ${translateY}px)`,
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="post-ctx-handle" />

        <div className="post-ctx-list">
          <button
            className="post-ctx-item"
            onClick={() => { handleClose(); onShare?.(); }}
          >
            <span className="post-ctx-icon"><ShareIcon size={22} /></span>
            Поделиться
          </button>

          {hasCaption && (
            <button
              className="post-ctx-item"
              onClick={() => { handleClose(); onCopy?.(); }}
            >
              <span className="post-ctx-icon"><CopyIcon size={22} /></span>
              Скопировать
            </button>
          )}

          {isAuthor && (
            <button
              className="post-ctx-item is-danger"
              onClick={() => { handleClose(); onDelete?.(); }}
            >
              <span className="post-ctx-icon"><TrashIcon size={22} /></span>
              Удалить
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}