import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './PostContextMenu.css';

export default function PostContextMenu({
  open,
  onClose,
  onCopy,
  onDelete,
  isAuthor,
  hasCaption,
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      // trigger slide up after mount
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      document.body.style.overflow = 'hidden';
    } else {
      setVisible(false);
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
    setTimeout(onClose, 250);
  };

  if (!open) return null;

  return createPortal(
    <div
      className={`post-ctx-backdrop ${visible ? 'is-visible' : ''}`}
      onClick={handleClose}
    >
      <div
        className={`post-ctx-sheet ${visible ? 'is-visible' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {hasCaption && (
          <button
            className="post-ctx-item"
            onClick={() => { handleClose(); onCopy?.(); }}
          >
            Скопировать текст
          </button>
        )}
        {isAuthor && (
          <button
            className="post-ctx-item is-danger"
            onClick={() => { handleClose(); onDelete?.(); }}
          >
            Удалить
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}