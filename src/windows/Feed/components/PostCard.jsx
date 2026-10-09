import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../lib/supabaseClient';
import { formatTime } from '../../../lib/formatTime';
import Lightbox from './Lightbox';
import './PostCard.css';

const formatNumber = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num;
};

const transformImageUrl = (url) => {
  if (!url) return url;
  if (url.match(/\.(svg|gif)(\?|$)/i)) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}width=800&quality=70&resize=contain`;
};

export default function PostCard({ post, currentUser }) {
  const [views, setViews] = useState(post.views || 0);
  const [likes, setLikes] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [lightboxFile, setLightboxFile] = useState(null);
  const [heartBurst, setHeartBurst] = useState(false);
  const carouselRef = useRef(null);

  const likePendingRef = useRef(false);
  const lastLocalChangeRef = useRef(0);

  const authorName = post.author_email ? post.author_email.split('@')[0] : 'user';
  const files = post.files || [];

  // Первичная загрузка состояния лайков
  useEffect(() => {
    const load = async () => {
      if (likePendingRef.current) return;

      const { count } = await supabase
        .from('reactions')
        .select('*', { count: 'exact', head: true })
        .eq('repository_id', post.id);

      if (likePendingRef.current) return;
      setLikes(count || 0);

      if (currentUser) {
        const { data } = await supabase
          .from('reactions')
          .select('id')
          .eq('repository_id', post.id)
          .eq('user_id', currentUser.id)
          .maybeSingle();
        if (likePendingRef.current) return;
        setIsLiked(!!data);
      }
    };
    load();
  }, [post.id, currentUser]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`post-${post.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reactions', filter: `repository_id=eq.${post.id}` },
        async () => {
          if (likePendingRef.current) return;
          if (Date.now() - lastLocalChangeRef.current < 2000) return;

          const { count } = await supabase
            .from('reactions')
            .select('*', { count: 'exact', head: true })
            .eq('repository_id', post.id);
          setLikes(count || 0);

          if (currentUser) {
            const { data } = await supabase
              .from('reactions')
              .select('id')
              .eq('repository_id', post.id)
              .eq('user_id', currentUser.id)
              .maybeSingle();
            setIsLiked(!!data);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'repositories', filter: `id=eq.${post.id}` },
        (payload) => setViews(payload.new.views || 0)
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [post.id, currentUser]);

  // Трекинг просмотра
  useEffect(() => {
    if (!currentUser) return;
    supabase.rpc('track_view', {
      p_post_id: post.id,
      p_user_id: currentUser.id,
    });
  }, [post.id, currentUser]);

  const handleLike = async () => {
    if (!currentUser) return;
    if (likePendingRef.current) return; // ← блокируем быстрые клики

    likePendingRef.current = true;
    lastLocalChangeRef.current = Date.now();

    const wasLiked = isLiked;
    const prevLikes = likes;

    // Оптимистичное обновление UI
    setIsLiked(!wasLiked);
    setLikes(wasLiked ? prevLikes - 1 : prevLikes + 1);

    // Анимация «выстрела» сердечка только при лайке (не при снятии)
    if (!wasLiked) {
      setHeartBurst(true);
      setTimeout(() => setHeartBurst(false), 600);
    }

    try {
      if (wasLiked) {
        await supabase
          .from('reactions')
          .delete()
          .eq('repository_id', post.id)
          .eq('user_id', currentUser.id);
      } else {
        await supabase
          .from('reactions')
          .insert({
            repository_id: post.id,
            user_id: currentUser.id,
            emoji: '❤️',
          });
      }
    } catch (err) {
      // Откат при ошибке
      setIsLiked(wasLiked);
      setLikes(prevLikes);
      console.error(err);
    } finally {
      // Освобождаем блокировку через 500 мс
      setTimeout(() => {
        likePendingRef.current = false;
      }, 500);
    }
  };

  const handleCarouselScroll = () => {
    if (!carouselRef.current) return;
    const scrollLeft = carouselRef.current.scrollLeft;
    const width = carouselRef.current.offsetWidth;
    setActiveSlide(Math.round(scrollLeft / width));
  };

  const goToSlide = (index) => {
    if (!carouselRef.current) return;
    const width = carouselRef.current.offsetWidth;
    carouselRef.current.scrollTo({ left: index * width, behavior: 'smooth' });
  };

  const nextSlide = () => goToSlide(Math.min(activeSlide + 1, files.length - 1));
  const prevSlide = () => goToSlide(Math.max(activeSlide - 1, 0));

  const handleDownload = async (e) => {
    e.stopPropagation();
    const file = files[activeSlide] || files[0];
    if (!file) return;

    try {
      const res = await fetch(file.url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = file.name || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      window.open(file.url, '_blank');
    }
  };

  const openLightbox = (file) => setLightboxFile(file);

  const renderMedia = (file) => {
    if (file.type.startsWith('image/')) {
      return (
        <img
          src={transformImageUrl(file.url)}
          alt={post.name || ''}
          loading="lazy"
          decoding="async"
          onClick={() => openLightbox(file)}
          style={{ cursor: 'zoom-in' }}
        />
      );
    }
    if (file.type.startsWith('video/')) {
      return (
        <video
          src={file.url}
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          disablePictureInPicture
          onClick={() => openLightbox(file)}
          style={{ cursor: 'zoom-in' }}
        />
      );
    }
    if (file.type.startsWith('audio/')) {
      return (
        <div style={{ padding: 20 }}>
          <audio src={file.url} controls preload="none" style={{ width: '100%' }} />
        </div>
      );
    }
    return (
      <div
        onClick={() => openLightbox(file)}
        style={{ padding: '60px 20px', textAlign: 'center', cursor: 'zoom-in' }}
      >
        <div style={{ fontSize: '3rem', marginBottom: 8 }}>📄</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{file.name}</div>
      </div>
    );
  };

  return (
    <>
      <div className="post-card">
        <div className="post-header">
          <span className="post-author">{authorName}</span>
          <span className="post-time">{formatTime(post.created_at)}</span>
        </div>

        {files.length > 0 && (
          <>
            <div className="post-media-wrapper">
              {files.length > 1 ? (
                <div className="post-carousel-container">
                  {activeSlide > 0 && (
                    <button
                      className="post-carousel-arrow post-carousel-arrow-left"
                      onClick={prevSlide}
                      aria-label="Назад"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </button>
                  )}

                  <div
                    className="post-media-carousel"
                    ref={carouselRef}
                    onScroll={handleCarouselScroll}
                  >
                    {files.map((file, i) => (
                      <div key={file.id || i} className="post-media-slide">
                        {renderMedia(file)}
                      </div>
                    ))}
                  </div>

                  {activeSlide < files.length - 1 && (
                    <button
                      className="post-carousel-arrow post-carousel-arrow-right"
                      onClick={nextSlide}
                      aria-label="Вперёд"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  )}
                </div>
              ) : (
                <div className="post-media-single">{renderMedia(files[0])}</div>
              )}
            </div>

            {files.length > 1 && (
              <div className="post-media-dots">
                {files.map((_, i) => (
                  <span
                    key={i}
                    className={`post-media-dot ${i === activeSlide ? 'is-active' : ''}`}
                    onClick={() => goToSlide(i)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        <div className="post-footer">
          <div
            className={`post-stat like-btn ${isLiked ? 'is-liked' : ''} ${heartBurst ? 'is-bursting' : ''}`}
            onClick={handleLike}
          >
            <div className="like-icon-wrapper">
              <svg className="like-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </div>
            <span>{formatNumber(likes)}</span>
          </div>

          <div className="post-stat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <span>{formatNumber(views)}</span>
          </div>

          <button
            className="post-download-btn"
            onClick={handleDownload}
            aria-label="Скачать"
            title="Скачать"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </button>
        </div>

        {post.name && (
          <div className="post-caption">
            <span className="post-caption-text">{post.name}</span>
          </div>
        )}
      </div>

      {lightboxFile && createPortal(
        <Lightbox file={lightboxFile} onClose={() => setLightboxFile(null)} />,
        document.body
      )}
    </>
  );
}