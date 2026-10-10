import React, { useEffect, useState } from 'react';
import './Lightbox.css';

const imageUrl = (url) => {
  if (!url) return url;
  if (url.match(/\.(svg|gif)(\?|$)/i)) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}width=1400&quality=85`;
};

export default function Lightbox({ file, onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const close = () => {
    setVisible(false);
    setTimeout(onClose, 250);
  };

  const isImage = file.type?.startsWith('image/');
  const isVideo = file.type?.startsWith('video/');
  const isAudio = file.type?.startsWith('audio/');

  return (
    <div className={`lightbox ${visible ? 'is-visible' : ''}`} onClick={close}>
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