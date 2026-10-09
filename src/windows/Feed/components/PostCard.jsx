import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import './PostCard.css';

const formatNumber = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num;
};

// Supabase Image Transformations — уменьшает картинку до 800px ширины, качество 70
// Это бесплатно и уменьшает трафик в 3–5 раз
const transformImageUrl = (url) => {
  if (!url) return url;
  // Не трогаем SVG и gif — у них свои особенности
  if (url.match(/\.(svg|gif)(\?|$)/i)) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}width=800&quality=70&resize=contain`;
};

export default function PostCard({ post, currentUser }) {
  const [views, setViews] = useState(post.views || 0);
  const [likes, setLikes] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const carouselRef = useRef(null);

  const authorName = post.author_email ? post.author_email.split('@')[0] : 'user';
  const files = post.files || [];

  const loadLikes = async () => {
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
  };

  useEffect(() => {
    loadLikes();
  }, [post.id, currentUser]);

  useEffect(() => {
    const channel = supabase
      .channel(`post-${post.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reactions', filter: `repository_id=eq.${post.id}` },
        () => loadLikes()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'repositories', filter: `id=eq.${post.id}` },
        (payload) => setViews(payload.new.views || 0)
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [post.id, currentUser]);

  useEffect(() => {
    const viewKey = `viewed_post_${post.id}`;
    if (localStorage.getItem(viewKey)) return;

    const incrementViews = async () => {
      await supabase
        .from('repositories')
        .update({ views: (post.views || 0) + 1 })
        .eq('id', post.id);
      localStorage.setItem(viewKey, 'true');
    };
    incrementViews();
  }, [post.id]);

  const handleLike = async () => {
    if (!currentUser) return;
    if (isLiked) {
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
      // fallback — открыть в новой вкладке
      window.open(file.url, '_blank');
    }
  };

  const renderMedia = (file) => {
    if (file.type.startsWith('image/')) {
      return (
        <img
          src={transformImageUrl(file.url)}
          alt={post.name || ''}
          loading="lazy"
          decoding="async"
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
    // Прочие файлы — показываем иконку
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 8 }}>📄</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{file.name}</div>
      </div>
    );
  };

  return (
    <div className="post-card">
      <div className="post-header">
        <span className="post-author">{authorName}</span>
        <span className="post-time">
          {new Date(post.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
        </span>
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
              <div className="post-media-single">
                {renderMedia(files[0])}
              </div>
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
          className={`post-stat ${isLiked ? 'is-liked' : ''}`}
          onClick={handleLike}
          style={{ cursor: 'pointer' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
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
  );
}