import React, { useState, useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../../lib/supabaseClient';
import { getProfile } from '../../../../lib/profilesCache';
import PostHeader from './PostHeader';
import PostMedia from './PostMedia';
import PostFooter from './PostFooter';
import PostContextMenu from './PostContextMenu';
import Lightbox from '../media/Lightbox';
import HtmlPreviewScreen from '../media/HtmlPreviewScreen';
import './PostCard.css';

export default function PostCard({
  post,
  currentUser,
  onOpen,
  readOnly = false,
  onRequireAuth,
}) {
  const [views, setViews] = useState(post.views || 0);
  const [likes, setLikes] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [burst, setBurst] = useState(false);
  const [preview, setPreview] = useState(null); 
  const [htmlPreview, setHtmlPreview] = useState(null); 
  const [author, setAuthor] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  
  const [hasUnreadComments, setHasUnreadComments] = useState(false);

  const uid = useId().replace(/:/g, '');
  const pendingLikeRef = useRef(false);
  const lastLocalRef = useRef(0);
  const mountedRef = useRef(true);
  const longPressRef = useRef({ timer: null, startX: 0, startY: 0 });

  const isAuthor = !!(currentUser && post.user_id === currentUser.id);
  const hasCaption = !!(post.name && post.name.trim());

  const requireAuth = () => {
    if (onRequireAuth) onRequireAuth();
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!post.user_id) return;
    let cancelled = false;
    getProfile(supabase, post.user_id).then((data) => {
      if (!cancelled && mountedRef.current && data) setAuthor(data);
    });
    return () => { cancelled = true; };
  }, [post.user_id]);

  useEffect(() => {
    if (readOnly) return;
    const load = async () => {
      if (pendingLikeRef.current) return;
      const { count } = await supabase
        .from('reactions')
        .select('*', { count: 'exact', head: true })
        .eq('repository_id', post.id);
      if (pendingLikeRef.current || !mountedRef.current) return;
      setLikes(count || 0);

      if (currentUser) {
        const { data } = await supabase
          .from('reactions')
          .select('id')
          .eq('repository_id', post.id)
          .eq('user_id', currentUser.id)
          .maybeSingle();
        if (!pendingLikeRef.current && mountedRef.current) setIsLiked(!!data);
      }
    };
    load();
  }, [post.id, currentUser, readOnly]);

  useEffect(() => {
    if (readOnly) return;
    const ch = supabase
      .channel(`post-${post.id}-${uid}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'reactions', filter: `repository_id=eq.${post.id}` },
        async () => {
          if (pendingLikeRef.current || !mountedRef.current) return;
          if (Date.now() - lastLocalRef.current < 2000) return;
          const { count } = await supabase
            .from('reactions')
            .select('*', { count: 'exact', head: true })
            .eq('repository_id', post.id);
          if (mountedRef.current) setLikes(count || 0);
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'repositories', filter: `id=eq.${post.id}` },
        (p) => { if (mountedRef.current) setViews(p.new.views || 0); })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [post.id, currentUser, uid, readOnly]);

  const handleLike = async () => {
    if (readOnly) { requireAuth(); return; }
    if (!currentUser || pendingLikeRef.current) return;
    pendingLikeRef.current = true;
    lastLocalRef.current = Date.now();

    const wasLiked = isLiked;
    const prevLikes = likes;
    setIsLiked(!wasLiked);
    setLikes(wasLiked ? prevLikes - 1 : prevLikes + 1);

    if (!wasLiked) {
      setBurst(true);
      setTimeout(() => setBurst(false), 600);
    }

    try {
      if (wasLiked) {
        await supabase.from('reactions').delete()
          .eq('repository_id', post.id).eq('user_id', currentUser.id);
      } else {
        await supabase.from('reactions').insert({
          repository_id: post.id,
          user_id: currentUser.id,
          emoji: '❤️',
        });
      }
    } catch {
      if (mountedRef.current) {
        setIsLiked(wasLiked);
        setLikes(prevLikes);
      }
    } finally {
      setTimeout(() => { pendingLikeRef.current = false; }, 500);
    }
  };

  const handleOpenComments = () => {
    if (readOnly) { requireAuth(); return; }
    setHasUnreadComments(false);
    onOpen?.(post);
  };

  const handleCardClick = (e) => {
    if (!readOnly) return;
    if (e.target.closest('button, a, input, textarea, [data-no-redirect]')) return;
    requireAuth();
  };

  const handleContextMenu = (e) => {
    if (readOnly) {
      e.preventDefault();
      requireAuth();
      return;
    }
    e.preventDefault();
    setMenuOpen(true);
  };

  const handlePointerDown = (e) => {
    if (e.pointerType === 'mouse') return;
    if (readOnly) return;
    if (e.target.closest('a')) return; // Игнорируем долгое нажатие, если это ссылка

    longPressRef.current.startX = e.clientX;
    longPressRef.current.startY = e.clientY;
    longPressRef.current.timer = setTimeout(() => {
      longPressRef.current.timer = null;
      setMenuOpen(true);
    }, 500);
  };

  const handlePointerMove = (e) => {
    if (readOnly) return;
    const s = longPressRef.current;
    if (!s.timer) return;
    if (Math.abs(e.clientX - s.startX) > 10 || Math.abs(e.clientY - s.startY) > 10) {
      clearTimeout(s.timer);
      s.timer = null;
    }
  };

  const handlePointerEnd = () => {
    if (readOnly) return;
    const s = longPressRef.current;
    if (s.timer) {
      clearTimeout(s.timer);
      s.timer = null;
    }
  };

  const handleShare = async () => {
    const postUrl = `${window.location.origin}/post/${post.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.name || 'Пост в «связь»',
          text: post.name || '',
          url: postUrl,
        });
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(postUrl);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = postUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(post.name || '');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = post.name || '';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Удалить пост? Это действие необратимо.')) return;
    try {
      const marker = '/repopart-files/';
      const paths = (post.files || [])
        .map((f) => {
          const idx = (f.url || '').indexOf(marker);
          return idx >= 0 ? f.url.slice(idx + marker.length) : null;
        })
        .filter(Boolean);

      if (paths.length) {
        await supabase.storage.from('repopart-files').remove(paths);
      }

      const { error } = await supabase.from('repositories').delete().eq('id', post.id);
      if (error) throw error;
    } catch (e) {
      alert('Ошибка удаления: ' + e.message);
    }
  };

  const fallbackName = post.author_email ? post.author_email.split('@')[0] : 'user';
  const displayName = author?.username || fallbackName;

  // Утилита для ссылок: обычный клик -> браузер, Shift+клик или долгое зажатие -> встроенный браузер
  const renderTextWithLinks = (text) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (e.shiftKey || readOnly) {
                e.preventDefault();
                e.stopPropagation();
                if (readOnly) requireAuth();
                else setHtmlPreview({ url: part, name: part });
              }
            }}
            onPointerDown={(e) => {
              if (e.pointerType !== 'mouse') {
                e.currentTarget._timer = setTimeout(() => {
                  e.currentTarget._triggered = true;
                  if (readOnly) requireAuth();
                  else setHtmlPreview({ url: part, name: part });
                }, 500);
              }
            }}
            onPointerUp={(e) => {
              clearTimeout(e.currentTarget._timer);
              if (e.currentTarget._triggered) {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget._triggered = false;
              }
            }}
            onPointerLeave={(e) => clearTimeout(e.currentTarget._timer)}
            onPointerMove={(e) => {
              if (e.currentTarget._timer) clearTimeout(e.currentTarget._timer);
            }}
            style={{ color: 'var(--accent)', textDecoration: 'none', wordBreak: 'break-all' }}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  return (
    <>
      <div
        className={`post-card ${readOnly ? 'is-preview' : ''}`}
        onClick={handleCardClick}
        onContextMenu={handleContextMenu}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <PostHeader
          author={author}
          userId={post.user_id}
          displayName={displayName}
          createdAt={post.created_at}
          authorEmail={post.author_email}
        />

        {post.files?.length > 0 && (
          <PostMedia
            files={post.files}
            postName={post.name}
            onPreview={readOnly ? requireAuth : (files, index) => setPreview({ files, index })}
            onOpenHtml={readOnly ? requireAuth : (file) => setHtmlPreview(file)}
          />
        )}

        {hasCaption && <div className="post-text">{renderTextWithLinks(post.name)}</div>}

        <PostFooter
          views={views}
          likes={likes}
          isLiked={isLiked}
          burst={burst}
          onLike={handleLike}
          files={post.files}
          postId={post.id}
          onOpenComments={handleOpenComments}
          hasUnreadComments={hasUnreadComments}
        />
      </div>

      {!readOnly && (
        <PostContextMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          onShare={handleShare}
          onCopy={handleCopy}
          onDelete={handleDelete}
          isAuthor={isAuthor}
          hasCaption={hasCaption}
        />
      )}

      {preview && !readOnly && createPortal(
        <Lightbox 
          files={preview.files} 
          initialIndex={preview.index} 
          onClose={() => setPreview(null)} 
        />,
        document.body
      )}

      {htmlPreview && !readOnly && createPortal(
        <HtmlPreviewScreen 
          file={htmlPreview} 
          onClose={() => setHtmlPreview(null)} 
        />,
        document.body
      )}
    </>
  );
}