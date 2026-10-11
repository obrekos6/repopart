import React, { useState, useRef, useEffect } from 'react';
import './PostMedia.css';

const formatDuration = (s) => {
  if (!s || !isFinite(s)) return null;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
};

const thumbUrl = (url) => {
  if (!url) return url;
  if (url.match(/\.(svg|gif)(\?|$)/i)) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}width=40&quality=8&blur=20&format=webp`;
};

const fullUrl = (url) => {
  if (!url) return url;
  if (url.match(/\.(svg|gif)(\?|$)/i)) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}width=800&quality=60&format=webp`;
};

function LazyImage({ file, postName, onPreview }) {
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [cancelled, setCancelled] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(null);

  const cancelRef = useRef(false);
  const intervalRef = useRef(null);
  const imgRef = useRef(null);
  const timeoutsRef = useRef([]);

  const clearAllTimers = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    timeoutsRef.current.forEach((t) => clearTimeout(t));
    timeoutsRef.current = [];
  };

  const startLoad = () => {
    clearAllTimers();
    setLoaded(false);
    setProgress(0);
    setCancelled(false);
    cancelRef.current = false;

    let p = 0;
    intervalRef.current = setInterval(() => {
      if (cancelRef.current) return;
      p += Math.random() * 10 + 3;
      if (p >= 90) p = 90;
      setProgress(p);
    }, 180);

    const img = new Image();
    img.src = fullUrl(file.url);

    img.onload = () => {
      if (cancelRef.current) return;
      clearInterval(intervalRef.current);
      setProgress(100);
      const t = setTimeout(() => setLoaded(true), 500);
      timeoutsRef.current.push(t);
    };

    img.onerror = () => {
      clearInterval(intervalRef.current);
    };

    imgRef.current = img;
  };

  useEffect(() => {
    startLoad();
    return () => {
      cancelRef.current = true;
      clearAllTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.url]);

  const handleCancel = (e) => {
    e.stopPropagation();
    cancelRef.current = true;
    clearAllTimers();
    if (imgRef.current) {
      imgRef.current.onload = null;
      imgRef.current.onerror = null;
      imgRef.current.src = '';
    }
    setCancelled(true);
  };

  const handleDownload = (e) => {
    e.stopPropagation();
    startLoad();
  };

  const handleThumbLoad = (e) => {
    const { naturalWidth, naturalHeight } = e.target;
    if (naturalWidth && naturalHeight && !aspectRatio) {
      setAspectRatio(naturalWidth / naturalHeight);
    }
  };

  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div
      className="post-image-wrap"
      style={aspectRatio ? { aspectRatio } : { aspectRatio: 1 }}
      onClick={() => loaded && onPreview(file)}
    >
      <img
        src={thumbUrl(file.url)}
        alt=""
        aria-hidden
        className={`post-image-blur ${loaded ? 'is-hidden' : ''}`}
        onLoad={handleThumbLoad}
        draggable={false}
      />

      <img
        src={fullUrl(file.url)}
        alt={postName || ''}
        className={`post-image-real ${loaded ? 'is-loaded' : ''}`}
        loading="lazy"
        decoding="async"
        draggable={false}
      />

      <div className={`post-image-overlay ${loaded ? 'is-done' : ''}`}>
        {!cancelled && (
          <div className="post-image-loader">
            <svg className="post-image-progress" viewBox="0 0 64 64">
              <circle
                className="post-image-progress-track"
                cx="32" cy="32" r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="2"
              />
              <circle
                className="post-image-progress-arc"
                cx="32" cy="32" r={radius}
                fill="none"
                stroke="#fff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                transform="rotate(-90 32 32)"
              />
            </svg>
            <button
              type="button"
              className="post-image-btn"
              onClick={handleCancel}
              aria-label="Отменить загрузку"
            >
              ✕
            </button>
          </div>
        )}
        {cancelled && (
          <div className="post-image-loader">
            <button
              type="button"
              className="post-image-btn"
              onClick={handleDownload}
              aria-label="Скачать"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MediaItem({ file, postName, onPreview }) {
  const [duration, setDuration] = useState(null);

  if (file.type.startsWith('image/')) {
    return <LazyImage file={file} postName={postName} onPreview={onPreview} />;
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
        <audio src={file.url} controls preload="none" />
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
  const [animating, setAnimating] = useState(false);

  const carouselRef = useRef(null);
  const dotsRef = useRef(null);
  const animFrameRef = useRef(null);

  const dragRef = useRef({
    active: false,
    startX: 0,
    startScroll: 0,
    moved: false,
    pointerId: null,
    history: [],
  });

  const dotsDragRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    pointerId: null,
  });

  // cancel any running scroll animation
  const cancelAnim = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setAnimating(false);
  };

  // custom smooth scroll: ease-out (fast start, slow end)
  const animateToSlide = (targetIndex) => {
    const el = carouselRef.current;
    if (!el) return;
    const w = el.offsetWidth;
    const clamped = Math.max(0, Math.min(files.length - 1, targetIndex));
    const targetLeft = clamped * w;
    const startLeft = el.scrollLeft;
    const delta = targetLeft - startLeft;

    if (Math.abs(delta) < 1) {
      setSlide(clamped);
      return;
    }

    cancelAnim();
    setAnimating(true);

    const duration = 400;
    const startTime = performance.now();
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);

    const step = (now) => {
      const t = Math.min(1, (now - startTime) / duration);
      el.scrollLeft = startLeft + delta * easeOut(t);
      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        el.scrollLeft = targetLeft;
        animFrameRef.current = null;
        setAnimating(false);
        setSlide(clamped);
      }
    };

    animFrameRef.current = requestAnimationFrame(step);
  };

  // carousel drag
  const handlePointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const el = carouselRef.current;
    if (!el) return;

    cancelAnim();
    try { el.setPointerCapture(e.pointerId); } catch {}

    dragRef.current.active = true;
    dragRef.current.startX = e.clientX;
    dragRef.current.startScroll = el.scrollLeft;
    dragRef.current.moved = false;
    dragRef.current.pointerId = e.pointerId;
    dragRef.current.history = [{ x: e.clientX, t: performance.now() }];
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

    const hist = dragRef.current.history;
    hist.push({ x: e.clientX, t: performance.now() });
    if (hist.length > 5) hist.shift();
  };

  const handlePointerUp = (e) => {
    if (!dragRef.current.active) return;
    if (e.pointerId !== dragRef.current.pointerId) return;

    const el = carouselRef.current;
    try { el?.releasePointerCapture(e.pointerId); } catch {}

    dragRef.current.active = false;
    setDragging(false);

    if (!dragRef.current.moved || !el) return;

    const w = el.offsetWidth;
    const totalDx = e.clientX - dragRef.current.startX;

    const hist = dragRef.current.history;
    let velocity = 0;
    if (hist.length >= 2) {
      const first = hist[0];
      const last = hist[hist.length - 1];
      const dt = last.t - first.t;
      if (dt > 0) velocity = (last.x - first.x) / dt;
    }

    const startIndex = Math.round(dragRef.current.startScroll / w);
    const distanceThreshold = w * 0.15;
    const velocityThreshold = 0.4;

    let targetIndex = startIndex;
    if (Math.abs(velocity) > velocityThreshold) {
      targetIndex = velocity < 0 ? startIndex + 1 : startIndex - 1;
    } else if (Math.abs(totalDx) > distanceThreshold) {
      targetIndex = totalDx < 0 ? startIndex + 1 : startIndex - 1;
    }

    animateToSlide(targetIndex);
  };

  const handleLostCapture = () => {
    dragRef.current.active = false;
    setDragging(false);
  };

  const handleClickCapture = (e) => {
    if (dragRef.current.moved) {
      e.stopPropagation();
      e.preventDefault();
      dragRef.current.moved = false;
    }
  };

  const handleScroll = () => {
    if (dragRef.current.active || dotsDragRef.current.active || animating) return;
    const el = carouselRef.current;
    if (!el) return;
    setSlide(Math.round(el.scrollLeft / el.offsetWidth));
  };

  // dots as slider
  const handleDotsPointerDown = (e) => {
    const el = dotsRef.current;
    if (!el) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    cancelAnim();
    try { el.setPointerCapture(e.pointerId); } catch {}

    dotsDragRef.current.active = true;
    dotsDragRef.current.moved = false;
    dotsDragRef.current.startX = e.clientX;
    dotsDragRef.current.pointerId = e.pointerId;
  };

  const handleDotsPointerMove = (e) => {
    if (!dotsDragRef.current.active) return;
    if (e.pointerId !== dotsDragRef.current.pointerId) return;

    const dx = Math.abs(e.clientX - dotsDragRef.current.startX);
    if (dx > 4) dotsDragRef.current.moved = true;

    const dotsEl = dotsRef.current;
    const carousel = carouselRef.current;
    if (!dotsEl || !carousel) return;

    const rect = dotsEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const t = Math.max(0, Math.min(1, x / rect.width));
    const maxScroll = carousel.scrollWidth - carousel.clientWidth;
    carousel.scrollLeft = t * maxScroll;

    const idx = Math.round(t * (files.length - 1));
    if (idx !== slide) setSlide(idx);
  };

  const handleDotsPointerUp = (e) => {
    if (!dotsDragRef.current.active) return;
    if (e.pointerId !== dotsDragRef.current.pointerId) return;

    const el = dotsRef.current;
    try { el?.releasePointerCapture(e.pointerId); } catch {}

    const wasMoved = dotsDragRef.current.moved;
    dotsDragRef.current.active = false;

    const carousel = carouselRef.current;
    const dotsEl = dotsRef.current;
    if (!carousel || !dotsEl) return;

    if (!wasMoved) {
      // click: jump to dot under pointer
      const rect = dotsEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const t = Math.max(0, Math.min(1, x / rect.width));
      const idx = Math.round(t * (files.length - 1));
      animateToSlide(idx);
    } else {
      // release after drag: snap to nearest
      const w = carousel.offsetWidth;
      const idx = Math.round(carousel.scrollLeft / w);
      animateToSlide(idx);
    }
  };

  useEffect(() => {
    return () => cancelAnim();
  }, []);

  if (files.length === 0) return null;

  const multiple = files.length > 1;

  return (
    <>
      <div className="post-media-wrapper">
        {multiple ? (
          <div
            className={`post-media-carousel ${dragging ? 'is-dragging' : ''} ${animating ? 'is-animating' : ''}`}
            ref={carouselRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onLostPointerCapture={handleLostCapture}
            onClickCapture={handleClickCapture}
            onScroll={handleScroll}
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
        <div
          className="post-media-dots"
          ref={dotsRef}
          onPointerDown={handleDotsPointerDown}
          onPointerMove={handleDotsPointerMove}
          onPointerUp={handleDotsPointerUp}
          onPointerCancel={handleDotsPointerUp}
        >
          {files.map((_, i) => (
            <span
              key={i}
              className={`post-media-dot ${i === slide ? 'is-active' : ''}`}
            />
          ))}
        </div>
      )}
    </>
  );
}