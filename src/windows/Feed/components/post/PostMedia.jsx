import React, { useState, useRef, useEffect } from 'react';
import AudioPlayer from './AudioPlayer';
import './PostMedia.css';

const formatDuration = (s) => {
  if (!s || !isFinite(s)) return null;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
};

/* single url per image — browser caches it once */
const imageUrl = (url) => {
  if (!url) return url;
  if (url.match(/\.(svg|gif)(\?|$)/i)) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}width=1200&quality=80&resize=contain&format=webp`;
};

function MediaItem({ file, postName, onPreview }) {
  const [duration, setDuration] = useState(null);

  if (file.type.startsWith('image/')) {
    return (
      <img
        src={imageUrl(file.url)}
        alt={postName || ''}
        loading="lazy"
        decoding="async"
        draggable={false}
        className="post-image"
        onClick={() => onPreview(file)}
      />
    );
  }

  if (file.type.startsWith('video/')) {
    return (
      <>
        <video
          src={file.url}
          autoPlay muted loop playsInline
          preload="metadata"
          disablePictureInPicture
          onLoadedMetadata={(e) => setDuration(e.target.duration)}
          onClick={() => onPreview(file)}
          className="post-image"
        />
        <div className="post-mute">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        </div>
        {duration && (
          <div className="post-duration">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            {formatDuration(duration)}
          </div>
        )}
      </>
    );
  }

  if (file.type.startsWith('audio/')) {
    return (
      <div className="post-audio">
        <AudioPlayer src={file.url} name={file.name} />
      </div>
    );
  }

  return (
    <div className="post-file" onClick={() => onPreview(file)}>
      <div className="post-file-icon">📄</div>
      <div className="post-file-name">{file.name}</div>
    </div>
  );
}

export default function PostMedia({ files = [], postName, onPreview }) {
  const [slide, setSlide] = useState(0);
  const [dragging, setDragging] = useState(false);
  const carouselRef = useRef(null);

  const dragRef = useRef({
    active: false,
    startX: 0,
    startScroll: 0,
    moved: false,
    pointerId: null,
  });

  const goToSlide = (i) => {
    if (!carouselRef.current) return;
    carouselRef.current.scrollTo({
      left: i * carouselRef.current.offsetWidth,
      behavior: 'smooth',
    });
  };

  const handleClickCapture = (e) => {
    if (dragRef.current.moved) {
      e.stopPropagation();
      e.preventDefault();
      dragRef.current.moved = false;
    }
  };

  const handlePointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const el = carouselRef.current;
    if (!el) return;

    try { el.setPointerCapture(e.pointerId); } catch {}

    dragRef.current.active = true;
    dragRef.current.startX = e.clientX;
    dragRef.current.startScroll = el.scrollLeft;
    dragRef.current.moved = false;
    dragRef.current.pointerId = e.pointerId;
    setDragging(true);
  };

  const handlePointerMove = (e) => {
    if (!dragRef.current.active) return;
    if (e.pointerId !== dragRef.current.pointerId) return;
    const el = carouselRef.current;
    if (!el) return;

    const dx = e.clientX - dragRef.current.startX;
    if (Math.abs(dx) > 5) dragRef.current.moved = true;

    el.scrollLeft = dragRef.current.startScroll - dx;
  };

  const handlePointerUp = (e) => {
    if (!dragRef.current.active) return;
    if (e.pointerId !== dragRef.current.pointerId) return;

    const el = carouselRef.current;
    try { el?.releasePointerCapture(e.pointerId); } catch {}

    dragRef.current.active = false;
    setDragging(false);

    if (!el || !dragRef.current.moved) return;

    const w = el.offsetWidth;
    const targetIndex = Math.round(el.scrollLeft / w);
    el.scrollTo({ left: targetIndex * w, behavior: 'smooth' });
  };

  if (files.length === 0) return null;

  const multiple = files.length > 1;

  return (
    <>
      <div className="post-media-wrapper">
        {multiple ? (
          <div
            className={`post-media-carousel ${dragging ? 'is-dragging' : ''}`}
            ref={carouselRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onClickCapture={handleClickCapture}
            onScroll={() => {
              const el = carouselRef.current;
              if (el && !dragRef.current.active) {
                setSlide(Math.round(el.scrollLeft / el.offsetWidth));
              }
            }}
          >
            {files.map((f, i) => (
              <div key={f.id || i} className="post-media-slide">
                <MediaItem file={f} postName={postName} onPreview={onPreview} />
              </div>
            ))}
          </div>
        ) : (
          <div className="post-media-single">
            <MediaItem file={files[0]} postName={postName} onPreview={onPreview} />
          </div>
        )}
      </div>

      {multiple && (
        <div className="post-media-dots">
          {files.map((_, i) => (
            <span
              key={i}
              className={`post-media-dot ${i === slide ? 'is-active' : ''}`}
              onClick={() => goToSlide(i)}
            />
          ))}
        </div>
      )}
    </>
  );
}