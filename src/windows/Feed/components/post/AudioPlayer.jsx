import React, { useState, useEffect, useRef, useCallback } from 'react';
import './AudioPlayer.css';

const formatTime = (sec) => {
  if (!sec || !isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export default function AudioPlayer({ src, name }) {
  const audioRef = useRef(null);
  const waveformRef = useRef(null);

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [peaks, setPeaks] = useState([]);
  const [scrubbing, setScrubbing] = useState(false);

  const scrubRef = useRef({ active: false, pointerId: null });

  /* decode audio and extract peaks for waveform */
  useEffect(() => {
    let cancelled = false;
    let ctx = null;

    const load = async () => {
      try {
        const res = await fetch(src);
        const arrayBuffer = await res.arrayBuffer();
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
        setPeaks(extracted.map((p) => p / max));
      } catch {
        /* fallback: static peaks */
        setPeaks(Array.from({ length: 40 }, () => 0.2 + Math.random() * 0.8));
      } finally {
        if (ctx) ctx.close();
      }
    };

    load();
    return () => { cancelled = true; };
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
    <div className="audio-player">
      <button className="audio-play" onClick={toggle} aria-label={playing ? 'Пауза' : 'Воспроизвести'}>
        {playing ? (
          <svg width="22" height="22" viewBox="0 0 28 28" fill="currentColor">
            <path fillRule="evenodd" clipRule="evenodd" d="M10.2453 3C11.1654 3 11.9119 3.73906 11.9119 4.65V23.35C11.9119 24.2609 11.1654 25 10.2453 25H5.80082C4.88068 25 4.13416 24.2609 4.13416 23.35V4.65C4.13416 3.73906 4.88068 3 5.80082 3H10.2453ZM22.4675 3C23.3876 3 24.1342 3.73906 24.1342 4.65V23.35C24.1342 24.2609 23.3876 25 22.4675 25H18.023C17.1029 25 16.3564 24.2609 16.3564 23.35V4.65C16.3564 3.73906 17.1029 3 18.023 3H22.4675Z" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 28 28" fill="currentColor">
            <path fillRule="evenodd" clipRule="evenodd" d="M8.60417 3.24708L23.3566 12.5682C24.1221 13.0514 24.3632 14.0856 23.8959 14.8749C23.7605 15.1023 23.5765 15.2948 23.3566 15.4325L8.60417 24.7536C7.84075 25.2368 6.84048 24.9876 6.37312 24.196C6.21663 23.9337 6.13416 23.6297 6.13416 23.3214V4.67924C6.13416 3.75216 6.86163 3 7.75828 3C8.05645 3 8.3504 3.08527 8.60417 3.24708Z" />
          </svg>
        )}
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