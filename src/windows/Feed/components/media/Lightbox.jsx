import React, { useEffect, useState, useRef } from 'react';
import { useBackButton } from '../../../../lib/useBackButton';
import './Lightbox.css';

const imageUrl = (url) => {
  if (!url) return url;
  if (url.match(/\.(svg|gif)(\?|$)/i)) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}width=1200&quality=60&format=webp`;
};

export default function Lightbox({ file, onClose }) {
  const [visible, setVisible] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const close = () => {
    setVisible(false);
    setTimeout(() => onCloseRef.current?.(), 250);
  };

  /* android back button closes */
  useBackButton(close, true);

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isImage = file.type?.startsWith('image/');
  const isVideo = file.type?.startsWith('video/');
  const isAudio = file.type?.startsWith('audio/');

  return (
    <div className={`lightbox ${visible ? 'is-visible' : ''}`} onClick={close}>
      <button
        className="lightbox-close"
        onClick={(e) => { e.stopPropagation(); close(); }}
        aria-label="Закрыть"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        {isImage && <img src={imageUrl(file.url)} alt={file.name} className="lightbox-media" />}
        {isVideo && <video src={file.url} className="lightbox-media" controls autoPlay loop playsInline />}
        {isAudio && (
          <div className="lightbox-audio">
            <div className="lightbox-audio-icon">🎵</div>
            <div className="lightbox-audio-name">{file.name}</div>
            <audio src={file.url} controls autoPlay style={{ width: '100%', marginTop: 16 }} />
          </div>
        )}
        {!isImage && !isVideo && !isAudio && (
          <div className="lightbox-file">
            <div className="lightbox-file-icon">📄</div>
            <div className="lightbox-file-name">{file.name}</div>
            <a href={file.url} download={file.name} className="lightbox-file-download">Скачать</a>
          </div>
        )}
      </div>
    </div>
  );
}