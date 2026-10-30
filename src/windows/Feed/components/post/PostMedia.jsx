import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import AudioPlayer from './AudioPlayer';
import { MuteIcon, PlayIcon, FileIcon } from '../../../../assets/icons/Icons';
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
    <div className={`post-media-tile ${compact ? 'is-compact' : ''}`} style={style}>
      <div
        className="post-media-tile-inner"
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={handleKey}
      >
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
          <img
            src={imageUrl(file.url, rect.w)}
            alt={alt}
            loading="lazy"
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
                  onOpen={() => onPreview?.(f, i, visual)}
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