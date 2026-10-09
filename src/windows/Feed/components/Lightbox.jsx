import React, { useEffect, useState } from 'react';
import './Lightbox.css';

const transformImageUrl = (url) => {
  if (!url) return url;
  if (url.match(/\.(svg|gif)(\?|$)/i)) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}width=1400&quality=85`;
};

export default function Lightbox({ file, onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKey = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 250);
  };

  const isImage = file.type?.startsWith('image/');
  const isVideo = file.type?.startsWith('video/');
  const isAudio = file.type?.startsWith('audio/');

  return (
    <div
      className={`lightbox ${visible ? 'is-visible' : ''}`}
      onClick={handleClose}
    >
      <button
        className="lightbox-close"
        onClick={handleClose}
        aria-label="Закрыть"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <div
        className="lightbox-content"
        onClick={(e) => e.stopPropagation()}
      >
        {isImage && (
          <img
            src={transformImageUrl(file.url)}
            alt={file.name}
            className="lightbox-media"
          />
        )}
        {isVideo && (
          <video
            src={file.url}
            className="lightbox-media"
            controls
            autoPlay
            loop
            playsInline
          />
        )}
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
            <a
              href={file.url}
              download={file.name}
              className="lightbox-file-download"
            >
              Скачать
            </a>
          </div>
        )}
      </div>
    </div>
  );
}