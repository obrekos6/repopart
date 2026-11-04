import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useT } from '../../../../lib/i18n';
import { useBackButton } from '../../../../lib/useBackButton';
import {
  ArrowLeftIcon,
  PlayIcon,
  PauseIcon,
  ShareIcon,
  TrashIcon,
  MusicIcon,
  FileIcon,
} from '../../../../assets/icons/Icons';
import './Lightbox.css';

const isImage = (f) => f?.type?.startsWith('image/');
const isVideo = (f) => f?.type?.startsWith('video/');
const isAudio = (f) => f?.type?.startsWith('audio/');

const fmt = (s) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m.toString().padStart(2, '0')}:${sec}`;
};

/*
 * Просмотр фото и видео как галерея в Telegram (Figma: Sheets → Media Player).
 * Листается пальцем (кадр едет за пальцем), свайп вниз закрывает.
 * Элементы: «назад», пауза (у видео), дорожка перемотки, «поделиться», «удалить».
 */
export default function Lightbox({ files = [], initialIndex = 0, onClose, onShare, onDelete }) {
  const t = useT();
  const [items, setItems] = useState(files);
  const [index, setIndex] = useState(Math.min(initialIndex, Math.max(0, files.length - 1)));
  const [visible, setVisible] = useState(false);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [playing, setPlaying] = useState(true);
  const [time, setTime] = useState({ cur: 0, dur: 0 });
  const [chrome, setChrome] = useState(true); // кнопки видны
  const [seeking, setSeeking] = useState(false);

  const videoRefs = useRef({});
  const gesture = useRef(null);
  const hideTimer = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const file = items[index];
  const video = isVideo(file);

  const close = useCallback(() => {
    setVisible(false);
    setTimeout(() => onCloseRef.current?.(), 250);
  }, []);

  useBackButton(close, true);

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const go = useCallback((i) => {
    setIndex((cur) => Math.max(0, Math.min(items.length - 1, typeof i === 'function' ? i(cur) : i)));
  }, [items.length]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') go((i) => i + 1);
      if (e.key === 'ArrowLeft') go((i) => i - 1);
      if (e.key === ' ' && video) { e.preventDefault(); togglePlay(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [close, go, video]);

  /* играет только видео на текущем кадре */
  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([i, v]) => {
      if (!v) return;
      if (Number(i) === index) {
        v.currentTime = 0;
        v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      } else {
        v.pause();
      }
    });
    setTime({ cur: 0, dur: 0 });
    setChrome(true);
  }, [index]);

  /* во время воспроизведения кнопки прячутся через 3 секунды */
  useEffect(() => {
    clearTimeout(hideTimer.current);
    if (video && playing && chrome && !seeking) {
      hideTimer.current = setTimeout(() => setChrome(false), 3000);
    }
    return () => clearTimeout(hideTimer.current);
  }, [video, playing, chrome, seeking, index]);

  const currentVideo = () => videoRefs.current[index];

  function togglePlay() {
    const v = currentVideo();
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); }
    setChrome(true);
  }

  /* ---------- жесты: листание по горизонтали, закрытие свайпом вниз ---------- */
  const onPointerDown = (e) => {
    if (e.target.closest('button, .lb-scrubber')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    gesture.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, axis: null, t0: performance.now() };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* указатель уже отпущен */ }
  };

  const onPointerMove = (e) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (!g.axis && Math.hypot(dx, dy) > 8) g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (g.axis === 'x') {
      // у краёв галереи — сопротивление, как в iOS
      const edge = (index === 0 && dx > 0) || (index === items.length - 1 && dx < 0);
      setDrag({ x: edge ? dx / 3 : dx, y: 0, active: true });
    } else if (g.axis === 'y' && dy > 0) {
      setDrag({ x: 0, y: dy, active: true });
    }
  };

  const onPointerUp = (e) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    const fast = performance.now() - g.t0 < 250;
    if (g.axis === 'x') {
      const w = window.innerWidth;
      if ((dx < -w * 0.2 || (fast && dx < -40)) && index < items.length - 1) go(index + 1);
      else if ((dx > w * 0.2 || (fast && dx > 40)) && index > 0) go(index - 1);
    } else if (g.axis === 'y') {
      if (dy > 120 || (fast && dy > 60)) { close(); return; }
    } else {
      // просто нажатие: у видео — показать/спрятать кнопки
      setChrome((c) => !c);
    }
    setDrag({ x: 0, y: 0, active: false });
  };

  /* ---------- дорожка перемотки ---------- */
  const seekTo = (clientX, el) => {
    const v = currentVideo();
    if (!v || !time.dur) return;
    const r = el.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    v.currentTime = p * time.dur;
    setTime((t) => ({ ...t, cur: p * t.dur }));
  };

  const onScrubDown = (e) => {
    e.stopPropagation();
    setSeeking(true);
    const track = e.currentTarget.querySelector('.lb-track');
    seekTo(e.clientX, track);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* указатель уже отпущен */ }
  };
  const onScrubMove = (e) => {
    if (!seeking) return;
    seekTo(e.clientX, e.currentTarget.querySelector('.lb-track'));
  };
  const onScrubUp = () => setSeeking(false);

  /* ---------- удаление ---------- */
  const handleDelete = async () => {
    if (!onDelete) return;
    const ok = await onDelete(file);
    if (!ok) return;
    const next = items.filter((_, i) => i !== index);
    if (next.length === 0) { close(); return; }
    setItems(next);
    setIndex((i) => Math.min(i, next.length - 1));
  };

  if (!items.length) return null;

  const progress = time.dur ? time.cur / time.dur : 0;
  const closeProgress = Math.min(1, drag.y / 300);

  return (
    <div
      className={`lb ${visible ? 'is-visible' : ''} ${chrome ? 'is-chrome' : ''}`}
      style={{ '--lb-fade': 1 - closeProgress * 0.8 }}
      role="dialog"
      aria-label={t('viewer.title')}
    >
      <div
        className={`lb-stage ${drag.active ? 'is-dragging' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="lb-strip"
          style={{
            transform: `translate3d(calc(${-index * 100}% + ${drag.x}px), ${drag.y}px, 0) scale(${1 - closeProgress * 0.15})`,
          }}
        >
          {items.map((f, i) => (
            <div className="lb-slide" key={f.url || i} aria-hidden={i !== index}>
              {Math.abs(i - index) <= 1 && (
                isImage(f) ? (
                  <img src={f.url} alt={f.name || ''} className="lb-media" draggable={false} />
                ) : isVideo(f) ? (
                  <video
                    ref={(el) => { videoRefs.current[i] = el; }}
                    src={f.url}
                    className="lb-media"
                    playsInline
                    loop
                    preload="metadata"
                    onTimeUpdate={(e) => i === index && !seeking && setTime({ cur: e.currentTarget.currentTime, dur: e.currentTarget.duration })}
                    onLoadedMetadata={(e) => i === index && setTime({ cur: 0, dur: e.currentTarget.duration })}
                    onPlay={() => i === index && setPlaying(true)}
                    onPause={() => i === index && setPlaying(false)}
                  />
                ) : isAudio(f) ? (
                  <div className="lb-file">
                    <MusicIcon size={64} />
                    <div className="lb-file-name">{f.name}</div>
                    <audio src={f.url} controls style={{ width: '100%', marginTop: 16 }} />
                  </div>
                ) : (
                  <div className="lb-file">
                    <FileIcon size={64} />
                    <div className="lb-file-name">{f.name}</div>
                    <a href={f.url} download={f.name} className="lb-file-download">{t('viewer.download')}</a>
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      </div>

      {/* стрелка «назад» */}
      <button className="lb-btn lb-back" onClick={close} aria-label={t('common.back')}>
        <ArrowLeftIcon size={24} />
      </button>

      {/* пауза по центру — только у видео */}
      {video && (
        <button className="lb-btn lb-play" onClick={togglePlay} aria-label={playing ? t('viewer.pause') : t('viewer.play')}>
          {playing ? <PauseIcon size={36} /> : <PlayIcon size={36} />}
        </button>
      )}

      <div className="lb-bottom">
        {/* дорожка перемотки — у видео */}
        {video && (
          <div
            className="lb-scrubber"
            onPointerDown={onScrubDown}
            onPointerMove={onScrubMove}
            onPointerUp={onScrubUp}
            onPointerCancel={onScrubUp}
          >
            <span className="lb-time">{fmt(time.cur)}</span>
            <div className="lb-track">
              <div className="lb-track-fill" style={{ width: `${progress * 100}%` }} />
            </div>
            <span className="lb-time">-{fmt(time.dur - time.cur)}</span>
          </div>
        )}

        <div className="lb-actions">
          <button className="lb-btn" onClick={() => onShare?.(file)} aria-label={t('viewer.share')}>
            <ShareIcon size={22} />
          </button>
          {onDelete ? (
            <button className="lb-btn" onClick={handleDelete} aria-label={t('viewer.delete')}>
              <TrashIcon size={22} />
            </button>
          ) : <span className="lb-btn-spacer" />}
        </div>
      </div>
    </div>
  );
}
