import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useT } from '../../../../lib/i18n';
import AudioPlayer from './AudioPlayer';
import { MuteIcon, PlayIcon, FileIcon, CloseIcon } from '../../../../assets/icons/Icons';
import { computeLayout, MAX_TILES } from '../../../../lib/mediaLayout';
import './PostMedia.css';

const NO_FILES = [];
const FALLBACK_RATIO = 1;
const GIVE_UP_MS = 3500;

const isVisual = (f) => f.type?.startsWith('image/') || f.type?.startsWith('video/');
const isHtml = (f) => f.type === 'text/html' || f.name?.toLowerCase().endsWith('.html');
const isAudio = (f) => f.type?.startsWith('audio/');

const formatDuration = (s) => {
  if (!s || !isFinite(s)) return null;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
};

const imageUrl = (url, tileW) => {
  if (!url) return url;
  if (url.match(/\.(svg|gif)(\?|$)/i)) return url;
  const px = tileW >= 0.9 ? 1200 : tileW >= 0.45 ? 800 : 500;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}width=${px}&quality=80&resize=contain&format=webp`;
};

const videoUrl = (url) => (url && !url.includes('#') ? `${url}#t=0.001` : url);

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const ratioCache = new Map();

/* ---------- загрузка фото как в Telegram ----------
 * Пока скачивается полное фото, показываем его крошечную копию (file.thumb,
 * ~40px) под сильным размытием, а по центру — кольцо прогресса.
 * Фото качаем через fetch, чтобы знать, сколько байт уже пришло.
 * Готовые фото держим в памяти, чтобы при повторном показе не качать заново. */
const blobCache = new Map();

function useProgressiveImage(url, enabled) {
  const [state, setState] = useState(() =>
    blobCache.has(url) ? { src: blobCache.get(url), progress: 1 } : { src: null, progress: 0 }
  );

  useEffect(() => {
    if (!enabled || !url || state.src) return undefined;
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const total = Number(res.headers.get('content-length')) || 0;
        let blob;
        if (res.body && total) {
          const reader = res.body.getReader();
          const chunks = [];
          let got = 0;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            got += value.length;
            setState((s) => ({ ...s, progress: Math.min(0.99, got / total) }));
          }
          blob = new Blob(chunks, { type: res.headers.get('content-type') || 'image/jpeg' });
        } else {
          blob = await res.blob();
        }
        const src = URL.createObjectURL(blob);
        blobCache.set(url, src);
        setState({ src, progress: 1 });
      } catch (e) {
        if (e.name === 'AbortError') return;
        setState({ src: url, progress: 1 }); // не вышло через fetch — пусть грузит сам <img>
      }
    })();
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, enabled]);

  return state;
}

/* начать загрузку, когда плитка подъезжает к экрану (как loading="lazy") */
function useNearViewport(ref) {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return undefined;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setNear(true); io.disconnect(); }
    }, { rootMargin: '600px' });
    io.observe(el);
    // запасной вариант: если браузер не прислал событие видимости (бывает в
    // фоновых вкладках), проверяем положение плитки сами
    const check = () => {
      const r = el.getBoundingClientRect();
      if (r.bottom > -600 && r.top < window.innerHeight + 600) setNear(true);
    };
    const t = setTimeout(check, 1200);
    window.addEventListener('scroll', check, { passive: true, capture: true });
    return () => {
      io.disconnect();
      clearTimeout(t);
      window.removeEventListener('scroll', check, { capture: true });
    };
  }, [ref, near]);
  return near;
}

/* кольцо загрузки как в Telegram: тёмный круг, белая дуга прогресса, крестик */
function LoadingRing({ progress }) {
  const t = useT();
  const R = 20;
  const C = 2 * Math.PI * R;
  const shown = Math.max(0.08, progress);
  return (
    <div className="media-loader" aria-label={t('common.loading')} role="progressbar" aria-valuenow={Math.round(progress * 100)}>
      <svg className="media-loader-ring" viewBox="0 0 48 48" width="48" height="48" aria-hidden>
        <circle cx="24" cy="24" r={R} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={`${C * shown} ${C}`} transform="rotate(-90 24 24)" />
      </svg>
      <CloseIcon size={18} className="media-loader-x" />
    </div>
  );
}

function useRatios(files) {
  const [measured, setMeasured] = useState({});

  const report = useCallback((url, ratio, persist = true) => {
    if (persist) ratioCache.set(url, ratio);
    setMeasured((prev) => (prev[url] === ratio ? prev : { ...prev, [url]: ratio }));
  }, []);

  const ratios = files.map((f) => {
    if (f.width > 0 && f.height > 0) return f.width / f.height;
    return ratioCache.get(f.url) ?? measured[f.url] ?? null;
  });

  return { ratios, report };
}

function useAutoplayInView(ref, enabled) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || prefersReducedMotion()) return undefined;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) el.play().catch(() => {});
        else el.pause();
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, enabled]);
}

function MediaTile({ file, rect, style, alt, extra, onOpen, onRatio }) {
  const [loaded, setLoaded] = useState(false);
  const [duration, setDuration] = useState(null);
  const videoRef = useRef(null);
  const tileRef = useRef(null);
  const near = useNearViewport(tileRef);
  const isImage = file.type.startsWith('image/');
  const fullUrl = isImage ? imageUrl(file.url, rect.w) : null;
  const img = useProgressiveImage(fullUrl, isImage && near);

  const video = file.type.startsWith('video/');
  const hasDims = file.width > 0 && file.height > 0;
  const compact = rect.w < 0.45;

  useAutoplayInView(videoRef, video);

  const handleKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen();
    }
  };

  return (
    <div ref={tileRef} className={`post-media-tile ${compact ? 'is-compact' : ''}`} style={style}>
      <div
        className="post-media-tile-inner"
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={handleKey}
      >
        {/* сверхсжатая копия под размытием — видна, пока грузится полное фото */}
        {!loaded && file.thumb && (
          <img src={file.thumb} alt="" aria-hidden className="post-image-thumb" draggable={false} />
        )}

        {video ? (
          <video
            ref={videoRef}
            src={videoUrl(file.url)}
            muted
            loop
            playsInline
            preload="metadata"
            disablePictureInPicture
            className={`post-image ${loaded ? 'is-loaded' : ''}`}
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              setDuration(v.duration);
              if (!hasDims) {
                onRatio(file.url, v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : FALLBACK_RATIO);
              }
              setLoaded(true);
            }}
            onError={() => {
              if (!hasDims) onRatio(file.url, FALLBACK_RATIO, false);
            }}
          />
        ) : (
          img.src && <img
            src={img.src}
            alt={alt}
            decoding="async"
            draggable={false}
            className={`post-image ${loaded ? 'is-loaded' : ''}`}
            onLoad={(e) => {
              const img = e.currentTarget;
              if (!hasDims) {
                onRatio(file.url, img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : FALLBACK_RATIO);
              }
              setLoaded(true);
            }}
            onError={() => {
              if (!hasDims) onRatio(file.url, FALLBACK_RATIO, false);
            }}
          />
        )}

        {!loaded && <LoadingRing progress={video ? 0.25 : img.progress} />}

        {video && loaded && (
          <>
            <div className="post-mute">
              <MuteIcon size={14} />
            </div>
            {formatDuration(duration) && (
              <div className="post-duration">
                <PlayIcon size={12} />
                {formatDuration(duration)}
              </div>
            )}
          </>
        )}

        {extra > 0 && <div className="post-media-more">+{extra}</div>}
      </div>
    </div>
  );
}

export default function PostMedia({ files = NO_FILES, postName, onPreview, onOpenHtml }) {
  const visual = useMemo(() => files.filter(isVisual), [files]);
  const others = useMemo(() => files.filter((f) => !isVisual(f)), [files]);
  const shown = useMemo(() => visual.slice(0, MAX_TILES), [visual]);
  const hiddenCount = visual.length - shown.length;

  const { ratios, report } = useRatios(shown);
  const allKnown = ratios.every((r) => r != null);

  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    if (allKnown) return undefined;
    const t = setTimeout(() => setGaveUp(true), GIVE_UP_MS);
    return () => clearTimeout(t);
  }, [allKnown]);
  const ready = allKnown || gaveUp;

  const ratioKey = ratios.map((r) => (r == null ? '_' : r.toFixed(4))).join('|');
  const layout = useMemo(
    () => computeLayout(ratios.map((r) => r ?? FALLBACK_RATIO)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ratioKey]
  );

  if (files.length === 0) return null;

  const H = layout.height || 1;

  return (
    <div className="post-media">
      {shown.length > 0 && (
        <div
          className={`post-media-grid ${ready ? 'is-ready' : 'is-pending'}`}
          style={{ paddingBottom: `${H * 100}%` }}
        >
          <div className="post-media-grid-inner">
            {shown.map((f, i) => {
              const t = layout.tiles[i];
              if (!t) return null;
              return (
                <MediaTile
                  key={f.id || f.url || i}
                  file={f}
                  rect={t}
                  alt={shown.length === 1 ? postName || '' : ''}
                  extra={i === shown.length - 1 ? hiddenCount : 0}
                  style={{
                    left: `${t.x * 100}%`,
                    top: `${(t.y / H) * 100}%`,
                    width: `${t.w * 100}%`,
                    height: `${(t.h / H) * 100}%`,
                  }}
                  onRatio={report}
                  onOpen={(e) => onPreview?.(f, i, visual, e)}
                />
              );
            })}
          </div>
        </div>
      )}

      {others.map((f, i) => {
        if (isAudio(f)) {
          return (
            <div className="post-audio" key={f.id || f.url || `a${i}`}>
              <AudioPlayer src={f.url} name={f.name} />
            </div>
          );
        }

        const isHtmlFile = isHtml(f);

        return (
          <div
            className="post-file"
            key={f.id || f.url || `f${i}`}
            role="button"
            tabIndex={0}
            onClick={() => {
              if (isHtmlFile && onOpenHtml) onOpenHtml(f);
              else onPreview?.(f, 0, [f]);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (isHtmlFile && onOpenHtml) onOpenHtml(f);
                else onPreview?.(f, 0, [f]);
              }
            }}
          >
            <div className="post-file-icon">
              <FileIcon size={40} />
            </div>
            <div className="post-file-name">{f.name}</div>
          </div>
        );
      })}
    </div>
  );
}