import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../../lib/supabaseClient';
import { getProfile } from '../../../../lib/profilesCache';
import { useBackButton } from '../../../../lib/useBackButton';
import { RichText, toPlainText } from '../../../../lib/richText';
import { formatTime } from '../../../../lib/formatTime';
import { useT } from '../../../../lib/i18n';
import Avatar from '../post/Avatar';
import {
  ArrowLeftIcon,
  HeartFilledIcon,
  CommentIcon,
  ShareIcon,
  PlayIcon,
  VerifiedIcon,
} from '../../../../assets/icons/Icons';
import partsMusic from '../../../../assets/audio/parts-music.m4a';
import './PartsViewer.css';

const isVisual = (f) => f?.type?.startsWith('image/') || f?.type?.startsWith('video/');
const isVideo = (f) => f?.type?.startsWith('video/');

// есть ли в видео звуковая дорожка; undefined — браузер пока не знает
function videoHasAudio(v) {
  if (typeof v.mozHasAudio === 'boolean') return v.mozHasAudio;
  if (v.audioTracks) return v.audioTracks.length > 0;
  if (typeof v.webkitAudioDecodedByteCount === 'number') return v.webkitAudioDecodedByteCount > 0;
  return undefined;
}

const fmtCount = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n));

/* ---------- живое свечение (как ambient-режим на YouTube) ----------
   Кадр рисуется в маленький холст в том же месте, где он на экране,
   а холст сильно размыт — вокруг фото/видео мягко светятся его цвета.
   У видео кадр обновляется во время воспроизведения. */
function AmbientGlow({ live }) {
  const ref = useRef(null);

  useEffect(() => {
    const cv = ref.current;
    const src = cv?.parentElement?.querySelector('.part-media');
    if (!cv || !src) return undefined;
    const ctx = cv.getContext('2d');
    const SCALE = 0.08; // холст в ~12 раз меньше экрана — дёшево, всё равно размыт

    const draw = () => {
      const w = src.videoWidth || src.naturalWidth;
      const h = src.videoHeight || src.naturalHeight;
      const W = cv.parentElement.clientWidth;
      const H = cv.parentElement.clientHeight;
      if (!w || !h || !W || !H) return;
      cv.width = Math.max(1, Math.round(W * SCALE));
      cv.height = Math.max(1, Math.round(H * SCALE));
      const k = Math.min(W / w, H / h) * SCALE; // как object-fit: contain
      const dw = w * k;
      const dh = h * k;
      try { ctx.drawImage(src, (cv.width - dw) / 2, (cv.height - dh) / 2, dw, dh); } catch { /* кадр ещё не готов */ }
    };

    draw();
    const evs = ['load', 'loadeddata', 'seeked'];
    evs.forEach((e) => src.addEventListener(e, draw));
    let raf = 0;
    let last = 0;
    if (live) {
      const loop = (ts) => {
        if (ts - last > 120) { draw(); last = ts; } // ~8 раз в секунду хватает
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    return () => { evs.forEach((e) => src.removeEventListener(e, draw)); cancelAnimationFrame(raf); };
  }, [live]);

  return <canvas ref={ref} className="part-glow" aria-hidden />;
}

/* ---------- один пост на весь экран ---------- */
function PartSlide({ post, active, near, startMedia, currentUser, onOpenComments, onOpenProfile, onMusic }) {
  const t = useT();
  const media = (post.files || []).filter(isVisual);
  const [mediaIndex, setMediaIndex] = useState(startMedia || 0);
  const [author, setAuthor] = useState(null);
  const [likes, setLikes] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [comments, setComments] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [paused, setPaused] = useState(false);
  const [heart, setHeart] = useState(null);
  const [progress, setProgress] = useState(0);
  // вертикальное видео — на весь экран; фото всегда целиком
  const [fill, setFill] = useState({});
  const [hasSound, setHasSound] = useState({});
  const videoRefs = useRef({});
  const albumRef = useRef(null);
  const tapRef = useRef({ timer: null, last: 0 });
  const busyRef = useRef(false);

  useEffect(() => {
    if (post.user_id) getProfile(supabase, post.user_id).then((p) => p && setAuthor(p));
  }, [post.user_id]);

  // лайки и комментарии — только у постов рядом с экраном
  useEffect(() => {
    if (!near) return;
    let alive = true;
    (async () => {
      const [{ count: lc }, { count: cc }, mine] = await Promise.all([
        supabase.from('reactions').select('*', { count: 'exact', head: true }).eq('repository_id', post.id),
        supabase.from('comments').select('*', { count: 'exact', head: true }).eq('repository_id', post.id),
        currentUser
          ? supabase.from('reactions').select('id').eq('repository_id', post.id).eq('user_id', currentUser.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (!alive) return;
      setLikes(lc || 0);
      setComments(cc || 0);
      setIsLiked(!!mine?.data);
    })();
    return () => { alive = false; };
  }, [near, post.id, currentUser]);

  // начальный кадр альбома
  useEffect(() => {
    const el = albumRef.current;
    if (el && startMedia) el.scrollLeft = startMedia * el.clientWidth;
  }, [startMedia]);

  // звук поста: видео на экране, если в нём есть звук, иначе первое видео альбома со звуком
  const frame = media[mediaIndex];
  const soundSource = isVideo(frame) && hasSound[mediaIndex] === true
    ? mediaIndex
    : media.findIndex((f, i) => isVideo(f) && hasSound[i] === true);
  const soundKnown = media.every((f, i) => !isVideo(f) || hasSound[i] !== undefined);
  const prevSource = useRef(-1);

  // новый пост — все видео с начала
  useEffect(() => {
    if (!active) return;
    Object.values(videoRefs.current).forEach((v) => { if (v) v.currentTime = 0; });
    setProgress(0);
  }, [active]);

  // новый кадр — с начала, кроме видео, которое уже звучало за кадром
  useEffect(() => {
    if (!active) return;
    const v = videoRefs.current[mediaIndex];
    if (v && prevSource.current !== mediaIndex) v.currentTime = 0;
    setProgress(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaIndex]);

  useEffect(() => { prevSource.current = soundSource; }, [soundSource]);

  useEffect(() => { setPaused(false); }, [mediaIndex]);

  // играет кадр на экране и источник звука; видео, про которые ещё неизвестно,
  // есть ли в них звук, коротко и беззвучно проигрываются, чтобы это узнать
  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([key, v]) => {
      if (!v) return;
      const i = Number(key);
      const audible = i === mediaIndex || i === soundSource;
      if (active && !paused && (audible || hasSound[i] === undefined)) {
        v.muted = !audible;
        v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
      } else {
        v.pause();
      }
    });
  }, [active, mediaIndex, paused, hasSound, soundSource]);

  useEffect(() => { if (!active) setPaused(false); }, [active]);

  // наш трек — только если ни в одном видео поста нет звука
  const wantsMusic = !paused && soundKnown && soundSource === -1;
  // звук как у видео: новый пост — с начала; фото одного альбома звучат одним треком
  const musicKey = isVideo(frame) ? `${post.id}:${mediaIndex}` : post.id;
  useEffect(() => { if (active) onMusic(musicKey, wantsMusic); }, [active, musicKey, wantsMusic, onMusic]);

  const toggleLike = async (forceOn = false) => {
    if (!currentUser || busyRef.current) return;
    if (forceOn && isLiked) return;
    busyRef.current = true;
    const was = isLiked;
    setIsLiked(!was);
    setLikes((n) => n + (was ? -1 : 1));
    const { error } = was
      ? await supabase.from('reactions').delete().eq('repository_id', post.id).eq('user_id', currentUser.id)
      : await supabase.from('reactions').insert({ repository_id: post.id, user_id: currentUser.id, emoji: '❤️' });
    if (error) { setIsLiked(was); setLikes((n) => n + (was ? 1 : -1)); }
    busyRef.current = false;
  };

  // один тап — пауза видео, двойной — лайк с сердцем
  const onMediaTap = (e) => {
    const tp = tapRef.current;
    const now = Date.now();
    if (tp.timer && now - tp.last < 280) {
      clearTimeout(tp.timer);
      tp.timer = null;
      setHeart({ x: e.clientX, y: e.clientY, key: now });
      setTimeout(() => setHeart(null), 800);
      toggleLike(true);
      return;
    }
    tp.last = now;
    tp.timer = setTimeout(() => {
      tp.timer = null;
      if (isVideo(media[mediaIndex])) setPaused((p) => !p);
    }, 280);
  };

  const onAlbumScroll = (e) => {
    const el = e.currentTarget;
    const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    if (i !== mediaIndex) setMediaIndex(i);
  };

  const share = async () => {
    const url = `${window.location.origin}/post/${post.id}`;
    const title = toPlainText(post.name || '') || t('post.shareTitle');
    if (navigator.share) {
      try { await navigator.share({ title, url }); return; } catch (err) { if (err.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(url); alert(t('post.linkCopied')); } catch { /* нет доступа */ }
  };

  const verified = !!author?.is_verified;
  const name = author?.display_name || author?.username || (post.author_email ? post.author_email.split('@')[0] : 'user');
  const hasText = !!toPlainText(post.name || '').trim();

  return (
    <section className={`part ${media.length ? '' : 'is-text'}`}>
      {media.length > 0 ? (
        <div className={`part-album ${media.length === 1 ? 'is-single' : ''}`} ref={albumRef} onScroll={onAlbumScroll} onClick={onMediaTap}>
          {media.map((f, i) => (
            <div className="part-frame" key={f.url || i}>
              {near && (isVideo(f) ? (
                <>
                  <video
                    ref={(el) => { videoRefs.current[i] = el; }}
                    src={f.url}
                    className={`part-media ${fill[i] ? 'is-fill' : ''}`}
                    playsInline
                    loop
                    preload={active ? 'auto' : 'metadata'}
                    onError={() => setHasSound((m) => ({ ...m, [i]: false }))}
                    onLoadedMetadata={(e) => { const v = e.currentTarget; setFill((m) => ({ ...m, [i]: v.videoHeight / v.videoWidth > 1.3 })); }}
                    onTimeUpdate={(e) => { const v = e.currentTarget; if (i === mediaIndex && v.duration) setProgress(v.currentTime / v.duration); if (hasSound[i] === undefined && v.currentTime > 0.3) { const has = videoHasAudio(v); setHasSound((m) => ({ ...m, [i]: has ?? true })); } }}
                  />
                  {!fill[i] && <AmbientGlow live={active && i === mediaIndex} />}
                </>
              ) : (
                <>
                  <img
                    src={f.url}
                    alt=""
                    className="part-media"
                    draggable={false}
                  />
                  <AmbientGlow live={false} />
                </>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="part-textpost post-text" onClick={onMediaTap}>
          <RichText text={post.name} />
        </div>
      )}

      {paused && isVideo(media[mediaIndex]) && (
        <span className="part-paused" aria-hidden><PlayIcon size={40} /></span>
      )}

      {heart && (
        <span key={heart.key} className="part-heart" style={{ left: heart.x, top: heart.y }} aria-hidden>
          <HeartFilledIcon size={96} />
        </span>
      )}

      {media.length > 1 && (
        <div className="part-dots" aria-hidden>
          {media.map((_, i) => <span key={i} className={i === mediaIndex ? 'is-on' : ''} />)}
        </div>
      )}

      {/* действия справа */}
      <div className="part-actions">
        <button type="button" className={`part-act ${isLiked ? 'is-liked' : ''}`} onClick={() => toggleLike()} aria-label={t('post.like')}>
          <HeartFilledIcon size={30} />
          <span>{fmtCount(likes)}</span>
        </button>
        <button type="button" className="part-act" onClick={() => onOpenComments(post)} aria-label={t('post.comment')}>
          <CommentIcon size={30} className="part-comment-filled" />
          <span>{fmtCount(comments)}</span>
        </button>
        <button type="button" className="part-act" onClick={share} aria-label={t('menu.share')}>
          <ShareIcon size={28} />
        </button>
      </div>

      {/* автор и подпись снизу */}
      <div className="part-info">
        <button type="button" className="part-author" onClick={() => onOpenProfile?.(post.user_id)}>
          <Avatar url={author?.avatar_url} name={name} seed={post.user_id} size={36} />
          <span className="part-author-name">{name}</span>
          {verified && <VerifiedIcon size={16} className="part-verified" />}
          <span className="part-time">{formatTime(post.created_at)}</span>
        </button>
        {media.length > 0 && hasText && (
          <div
            className={`part-caption ${expanded ? 'is-open' : ''}`}
            onClick={() => setExpanded((v) => !v)}
          >
            <RichText text={post.name} />
          </div>
        )}
        {media.length > 0 && hasText && !expanded && (
          <button type="button" className="part-more" onClick={() => setExpanded(true)}>{t('parts.more')}</button>
        )}
      </div>

      {/* прогресс видео — тонкая полоска над полем комментария */}
      {isVideo(media[mediaIndex]) && (
        <div className="part-progress" aria-hidden><span style={{ width: `${progress * 100}%` }} /></div>
      )}

      {/* поле комментария: по нажатию открываются комментарии поста */}
      <button type="button" className="part-comment-bar" onClick={() => onOpenComments(post)}>
        {t('comments.placeholder')}
      </button>
    </section>
  );
}

/*
 * Просмотр как Parts: посты на весь экран, листаются вверх-вниз.
 * posts — лента, start — { postId, mediaIndex }.
 */
export default function PartsViewer({ posts: allPosts, start, currentUser, onClose, onOpenComments, onOpenProfile, onLoadMore, hasMore }) {
  const t = useT();
  const scrollRef = useRef(null);
  // в партсах — только посты с фото или видео
  const posts = useMemo(() => allPosts.filter((p) => (p.files || []).some(isVisual)), [allPosts]);
  const startIndex = Math.max(0, posts.findIndex((p) => p.id === start.postId));
  const [active, setActive] = useState(startIndex);
  const [visible, setVisible] = useState(false);
  const [music, setMusicOn] = useState(false);
  const [musicKey, setMusicKey] = useState(null);
  const audioRef = useRef(null);
  const playedKey = useRef(null);
  const setMusic = useCallback((key, on) => { setMusicKey(key); setMusicOn(on); }, []);

  // телефон может запретить звук без нажатия — тогда музыка начнётся с первого касания
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return undefined;
    if (musicKey !== playedKey.current) {
      playedKey.current = musicKey;
      a.currentTime = 0;
    }
    const sync = () => {
      if (music && !document.hidden) a.play().catch(() => {});
      else a.pause();
    };
    const retry = () => { if (music && a.paused && !document.hidden) sync(); };
    sync();
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pointerdown', retry, true);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('pointerdown', retry, true);
    };
  }, [music, musicKey]);

  const close = useCallback(() => {
    setVisible(false);
    setMusicOn(false);
    setTimeout(() => onClose(), 220);
  }, [onClose]);

  useBackButton(close, true);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const el = scrollRef.current;
    if (el) el.scrollTop = startIndex * el.clientHeight;
    requestAnimationFrame(() => setVisible(true));
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        el?.scrollBy({ top: (e.key === 'ArrowDown' ? 1 : -1) * el.clientHeight, behavior: 'smooth' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // какой пост сейчас на экране — по прокрутке (каждый пост ровно в высоту экрана)
  const onScroll = (e) => {
    const el = e.currentTarget;
    const i = Math.round(el.scrollTop / Math.max(1, el.clientHeight));
    if (i !== active) setActive(i);
  };

  // ближе к концу — подгружаем ещё посты ленты
  useEffect(() => {
    // allPosts.length — чтобы снова подгружать, если в новой порции не было фото/видео
    if (hasMore && active >= posts.length - 3) onLoadMore?.();
  }, [active, posts.length, allPosts.length, hasMore, onLoadMore]);

  return createPortal(
    <div className={`parts ${visible ? 'is-visible' : ''}`} role="dialog" aria-label={t('viewer.title')}>
      <audio ref={audioRef} src={partsMusic} loop preload="auto" />
      <div className="parts-scroll" ref={scrollRef} onScroll={onScroll}>
        {posts.map((post, i) => (
          <PartSlide
            key={post.id}
            post={post}
            active={i === active}
            near={Math.abs(i - active) <= 2}
            startMedia={i === startIndex ? start.mediaIndex : 0}
            currentUser={currentUser}
            onMusic={setMusic}
            onOpenComments={onOpenComments}
            onOpenProfile={(id) => { close(); onOpenProfile?.(id); }}
          />
        ))}
      </div>

      <button type="button" className="parts-back" onClick={close} aria-label={t('common.back')}>
        <ArrowLeftIcon size={24} />
      </button>
    </div>,
    document.body
  );
}
