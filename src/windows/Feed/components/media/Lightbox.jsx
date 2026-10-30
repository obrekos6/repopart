import React, { useEffect, useState, useRef } from 'react';
import { useBackButton } from '../../../../lib/useBackButton';
import { CloseIcon, ArrowLeftIcon, ArrowRightIcon, MusicIcon, FileIcon } from '../../../../assets/icons/Icons';
import './Lightbox.css';

const imageUrl = (url) => {
  if (!url) return url;
  if (url.match(/\.(svg|gif)(\?|$)/i)) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}width=1600&quality=90&format=webp`;
};

export default function Lightbox({ files = [], initialIndex = 0, onClose }) {
  const [visible, setVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const touchRef = useRef({ startX: 0, startY: 0 });

  const close = () => {
    setVisible(false);
    setTimeout(() => onCloseRef.current?.(), 250);
  };

  useBackButton(close, true);

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e) => { 
      if (e.key === 'Escape') close(); 
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prevImage();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const next = () => {
    if (currentIndex < files.length - 1) setCurrentIndex(currentIndex + 1);
  };

  const prevImage = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const handleTouchStart = (e) => {
    touchRef.current.startX = e.touches[0].clientX;
    touchRef.current.startY = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const dx = endX - touchRef.current.startX;
    const dy = endY - touchRef.current.startY;

    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) prevImage();
      else next();
    }
  };

  if (!files || files.length === 0) return null;

  const file = files[currentIndex];
  const isImage = file.type?.startsWith('image/');
  const isVideo = file.type?.startsWith('video/');
  const isAudio = file.type?.startsWith('audio/');

  return (
    <div 
      className={`lightbox ${visible ? 'is-visible' : ''}`} 
      onClick={close}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        className="lightbox-close"
        onClick={(e) => { e.stopPropagation(); close(); }}
        aria-label="Закрыть"
      >
        <CloseIcon size={22} />
      </button>

      {files.length > 1 && (
        <>
          <button 
            className={`lightbox-nav lightbox-nav-prev ${currentIndex === 0 ? 'is-disabled' : ''}`}
            onClick={(e) => { e.stopPropagation(); prevImage(); }}
            aria-label="Предыдущее"
          >
            <ArrowLeftIcon size={32} />
          </button>
          <button 
            className={`lightbox-nav lightbox-nav-next ${currentIndex === files.length - 1 ? 'is-disabled' : ''}`}
            onClick={(e) => { e.stopPropagation(); next(); }}
            aria-label="Следующее"
          >
            <ArrowRightIcon size={32} />
          </button>
        </>
      )}

      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        {isImage && <img src={imageUrl(file.url)} alt={file.name} className="lightbox-media" />}
        {isVideo && <video src={file.url} className="lightbox-media" controls autoPlay loop playsInline />}
        {isAudio && (
          <div className="lightbox-audio">
            <div className="lightbox-audio-icon">
              <MusicIcon size={64} />
            </div>
            <div className="lightbox-audio-name">{file.name}</div>
            <audio src={file.url} controls autoPlay style={{ width: '100%', marginTop: 16 }} />
          </div>
        )}
        {!isImage && !isVideo && !isAudio && (
          <div className="lightbox-file">
            <div className="lightbox-file-icon">
              <FileIcon size={64} />
            </div>
            <div className="lightbox-file-name">{file.name}</div>
            <a href={file.url} download={file.name} className="lightbox-file-download">Скачать</a>
          </div>
        )}
      </div>
    </div>
  );
}