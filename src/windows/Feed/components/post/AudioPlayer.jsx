import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PlayIcon, PauseIcon } from '../../../../assets/icons/Icons';
import './AudioPlayer.css';

/* module-level cache — survives unmount/remount of the player */
const peaksCache = new Map();

const formatTime = (sec) => {
  if (!sec || !isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export default function AudioPlayer({ src, name }) {
  const audioRef = useRef(null);
  const waveformRef = useRef(null);
  const rootRef = useRef(null);

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [peaks, setPeaks] = useState(() => peaksCache.get(src) || []);
  const [scrubbing, setScrubbing] = useState(false);

  const scrubRef = useRef({ active: false, pointerId: null });

  /* decode audio — only when the player scrolls into view, cached in memory */
  useEffect(() => {
    if (peaksCache.has(src)) {
      setPeaks(peaksCache.get(src));
      return;
    }
    setPeaks([]);

    const el = rootRef.current;
    if (!el) return;

    let cancelled = false;
    let ctx = null;

    const decode = async () => {
      try {
        const res = await fetch(src);
        const arrayBuffer = await res.arrayBuffer();
        if (cancelled) return;

        ctx = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        if (cancelled) return;

        const channel = audioBuffer.getChannelData(0);
        const blockSize = Math.floor(channel.length / 40);
        const extracted = [];

        for (let i = 0; i < 40; i++) {
          let sum = 0;
          const start = i * blockSize;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(channel[start + j] || 0);
          }
          extracted.push(sum / blockSize);
        }

        const max = Math.max(...extracted, 0.001);
        const result = extracted.map((p) => p / max);

        if (cancelled) return;
        peaksCache.set(src, result);
        setPeaks(result);
      } catch {
        if (cancelled) return;
        const fallback = Array.from({ length: 40 }, () => 0.2 + Math.random() * 0.8);
        peaksCache.set(src, fallback);
        setPeaks(fallback);
      } finally {
        if (ctx) {
          try { ctx.close(); } catch { /* ignore */ }
        }
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          io.disconnect();
          decode();
        }
      },
      { rootMargin: '200px' }
    );
    io.observe(el);

    return () => {
      cancelled = true;
      io.disconnect();
      if (ctx) {
        try { ctx.close(); } catch { /* ignore */ }
      }
    };
  }, [src]);

  /* time tracking */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => {
      if (!scrubRef.current.active) setCurrent(audio.currentTime);
    };
    const onMeta = () => setDuration(audio.duration);
    const onEnd = () => {
      setPlaying(false);
      setCurrent(0);
    };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended', onEnd);
    };
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().catch(() => {});
      setPlaying(true);
    }
  }, [playing]);

  /* ---------- scrubbing ---------- */
  const seekToX = useCallback((clientX) => {
    const el = waveformRef.current;
    const audio = audioRef.current;
    if (!el || !audio || !duration) return;

    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const ratio = x / rect.width;
    const newTime = ratio * duration;

    audio.currentTime = newTime;
    setCurrent(newTime);
  }, [duration]);

  const handleScrubDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    scrubRef.current.active = true;
    scrubRef.current.pointerId = e.pointerId;
    setScrubbing(true);
    try { waveformRef.current?.setPointerCapture(e.pointerId); } catch {}
    seekToX(e.clientX);
  };

  const handleScrubMove = (e) => {
    if (!scrubRef.current.active) return;
    if (e.pointerId !== scrubRef.current.pointerId) return;
    seekToX(e.clientX);
  };

  const handleScrubUp = (e) => {
    if (!scrubRef.current.active) return;
    if (e.pointerId !== scrubRef.current.pointerId) return;
    try { waveformRef.current?.releasePointerCapture(e.pointerId); } catch {}
    scrubRef.current.active = false;
    setScrubbing(false);
  };

  const progress = duration ? current / duration : 0;
  const activeBars = Math.floor(progress * peaks.length);

  /* single time label: total when idle, elapsed when playing or scrubbing */
  const showElapsed = playing || scrubbing || current > 0;
  const timeLabel = showElapsed
    ? `${formatTime(current)} / ${formatTime(duration)}`
    : formatTime(duration);

  return (
    <div className="audio-player" ref={rootRef}>
      <button className="audio-play" onClick={toggle} aria-label={playing ? 'Пауза' : 'Воспроизвести'}>
        {playing ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
      </button>

      <div className="audio-body">
        <div
          className={`audio-waveform ${scrubbing ? 'is-scrubbing' : ''}`}
          ref={waveformRef}
          onPointerDown={handleScrubDown}
          onPointerMove={handleScrubMove}
          onPointerUp={handleScrubUp}
          onPointerCancel={handleScrubUp}
        >
          {peaks.map((p, i) => (
            <div
              key={i}
              className={`audio-bar ${i < activeBars ? 'is-active' : ''}`}
              style={{ height: `${Math.max(15, p * 100)}%` }}
            />
          ))}
        </div>
        <div className="audio-meta">
          <span className="audio-time">{timeLabel}</span>
        </div>
      </div>

      <audio ref={audioRef} src={src} preload="metadata" />
    </div>
  );
}