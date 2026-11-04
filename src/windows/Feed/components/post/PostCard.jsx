import React, { useState, useEffect, useRef, useId } from 'react';
import { useT } from '../../../../lib/i18n';
import { createPortal } from 'react-dom';
import { supabase } from '../../../../lib/supabaseClient';
import { getProfile } from '../../../../lib/profilesCache';
import { FILES_BUCKET } from '../../../../lib/storage';
import { RichText, toPlainText } from '../../../../lib/richText';
import { translateText } from '../../../../lib/translate';
import { useSetting } from '../../../../lib/settings';
import { HeartFilledIcon } from '../../../../assets/icons/Icons';

// выше этой высоты текст поста сворачивается (≈ 12 строк по 22px)
const COLLAPSED_HEIGHT = 264;

/* подсветка найденных слов (поиск): акцентный цвет, полупрозрачный, скруглённый */
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// query — строка или список найденных слов (умный поиск подсвечивает слова с опечатками)
function highlightText(text, query) {
  const terms = (Array.isArray(query) ? query : [query]).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!terms.length || !text) return text;
  const re = new RegExp(`(${terms.map(escapeRe).join('|')})`, 'gi');
  return text.split(re).map((part, i) =>
    i % 2 === 1 ? <mark key={i} className="search-hl">{part}</mark> : part
  );
}
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
  onOpenProfile,
  highlight = '',
}) {
  const t = useT();
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
  // тап и двойной тап: один тап — меню, двойной — лайк
  const tapRef = useRef({ timer: null, last: 0 });
  const [bigHeart, setBigHeart] = useState(null);
  // перевод текста поста
  const [showTranslate] = useSetting('showTranslate');
  const [translateTo] = useSetting('translateTo');
  const [translation, setTranslation] = useState(null); // { text } | 'loading'
  
  // Для трекинга просмотров
  const cardRef = useRef(null);
  const hasTrackedView = useRef(false);

  const isAuthor = !!(currentUser && post.user_id === currentUser.id);

  // вложения поста; меняются, если удалить фото/видео из галереи
  const [files, setFiles] = useState(post.files || []);
  useEffect(() => { setFiles(post.files || []); }, [post.files]);
  const plainCaption = toPlainText(post.name || '');
  const hasCaption = !!plainCaption.trim() || (post.name || '').includes('<blockquote>');

  // «Читать далее» для длинных постов
  const textRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const check = () => setOverflowing(el.scrollHeight > COLLAPSED_HEIGHT + 22);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [post.name]);

  const requireAuth = () => {
    if (onRequireAuth) onRequireAuth();
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Трекинг просмотров (2 секунды в зоне видимости)
  useEffect(() => {
    if (readOnly || !currentUser || hasTrackedView.current) return;
    
    let timeoutId;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          timeoutId = setTimeout(async () => {
            if (hasTrackedView.current) return;
            hasTrackedView.current = true;
            
            try {
              // в базе есть функция track_view(p_post_id, p_user_id);
              // track_views_batch, которая вызывалась раньше, не существует
              const { error } = await supabase.rpc('track_view', {
                p_post_id: post.id,
                p_user_id: currentUser.id,
              });
              if (error) throw error;
              // счётчик обновит realtime (UPDATE repositories); если он не включён —
              // показываем +1 сразу, не дожидаясь
              setViews(v => v + 1);
            } catch (e) {
              console.error('Ошибка трекинга просмотра:', e);
            }
          }, 2000); // 2 секунды
        } else {
          if (timeoutId) clearTimeout(timeoutId);
        }
      },
      { threshold: 0.8 } // Пост виден на 80%
    );
    
    if (cardRef.current) observer.observe(cardRef.current);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [post.id, currentUser, readOnly]);

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
      // supabase-js не бросает исключения, ошибку нужно проверять вручную
      const { error } = wasLiked
        ? await supabase.from('reactions').delete()
            .eq('repository_id', post.id).eq('user_id', currentUser.id)
        : await supabase.from('reactions').insert({
            repository_id: post.id,
            user_id: currentUser.id,
            emoji: '❤️',
          });
      if (error) throw error;
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

  /* ---------- тапы: один — меню поста, двойной — лайк (как в Telegram) ---------- */
  const DOUBLE_TAP_MS = 280;

  const showHeart = (e) => {
    const r = cardRef.current?.getBoundingClientRect();
    if (!r) return;
    setBigHeart({ x: e.clientX - r.left, y: e.clientY - r.top, key: Date.now() });
    setTimeout(() => setBigHeart(null), 800);
  };

  /* singleAction — что сделать на одиночный тап (открыть меню или галерею) */
  const handleTap = (e, singleAction) => {
    const t = tapRef.current;
    const now = Date.now();
    if (t.timer && now - t.last < DOUBLE_TAP_MS) {
      // второй тап — лайк (двойной тап только ставит лайк, не снимает)
      clearTimeout(t.timer);
      t.timer = null;
      showHeart(e);
      if (!isLiked) handleLike();
      return;
    }
    t.last = now;
    clearTimeout(t.timer);
    t.timer = setTimeout(() => { t.timer = null; singleAction(); }, DOUBLE_TAP_MS);
  };

  useEffect(() => () => clearTimeout(tapRef.current.timer), []);

  const handleCardClick = (e) => {
    if (e.target.closest('button, a, input, textarea, [data-no-redirect], .post-header, .post-media')) return;
    if (readOnly) { requireAuth(); return; }
    // выделяли текст мышью — это не тап
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && cardRef.current?.contains(sel.anchorNode)) return;
    handleTap(e, () => setMenuOpen(true));
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

  /* ---------- перевод ---------- */
  const handleTranslate = async () => {
    if (translation && translation !== 'loading') { setTranslation(null); return; }
    setTranslation('loading');
    try {
      const res = await translateText(plainCaption, translateTo);
      setTranslation(res);
    } catch (e) {
      setTranslation(null);
      alert(t('post.translateFail') + e.message);
    }
  };

  const handleShare = async () => {
    const postUrl = `${window.location.origin}/post/${post.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: plainCaption || t('post.shareTitle'),
          text: plainCaption,
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
      await navigator.clipboard.writeText(plainCaption);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = plainCaption;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  };

  // пути файлов в хранилище: и сами файлы, и их сверхсжатые копии (thumb)
  const storagePaths = (list) => {
    const marker = `/${FILES_BUCKET}/`;
    return (list || [])
      .flatMap((f) => [f.url, f.thumb])
      .map((url) => {
        const idx = (url || '').indexOf(marker);
        return idx >= 0 ? decodeURIComponent(url.slice(idx + marker.length)) : null;
      })
      .filter(Boolean);
  };

  const deletePost = async () => {
    // Сначала удаляем пост: если не получится, файлы останутся целыми
    const { error } = await supabase.from('repositories').delete().eq('id', post.id);
    if (error) throw error;
    const paths = storagePaths(files);
    if (paths.length) await supabase.storage.from(FILES_BUCKET).remove(paths);
  };

  const handleDelete = async () => {
    if (!window.confirm(t('post.confirmDelete'))) return;
    try {
      await deletePost();
    } catch (e) {
      alert(t('post.deleteFail') + e.message);
    }
  };

  /* ---------- из галереи: поделиться и удалить одно фото/видео ---------- */
  const handleShareFile = async (file) => {
    const url = file?.url;
    if (!url) return;
    if (navigator.share) {
      try { await navigator.share({ url, title: plainCaption || t('post.shareTitle') }); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(url); alert(t('post.linkCopied')); } catch { /* нет доступа */ }
  };

  const handleDeleteFile = async (file) => {
    const rest = files.filter((f) => f.url !== file.url);
    const lastOne = rest.length === 0 && !hasCaption;
    const question = lastOne
      ? t('post.confirmDeleteLast')
      : t('post.confirmDeleteFile');
    if (!window.confirm(question)) return false;
    try {
      if (lastOne) {
        await deletePost();
      } else {
        const { error } = await supabase.from('repositories').update({ files: rest }).eq('id', post.id);
        if (error) throw error;
        const paths = storagePaths([file]);
        if (paths.length) await supabase.storage.from(FILES_BUCKET).remove(paths);
        setFiles(rest);
      }
      return true;
    } catch (e) {
      alert(t('post.deleteFileFail') + e.message);
      return false;
    }
  };

  const fallbackName = post.author_email ? post.author_email.split('@')[0] : 'user';
  const displayName = author?.display_name || author?.username || fallbackName;

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
      return <React.Fragment key={i}>{highlightText(part, highlight)}</React.Fragment>;
    });
  };

  return (
    <>
      <div
        ref={cardRef}
        className={`post-card ${readOnly ? 'is-preview' : ''}`}
        onClick={handleCardClick}
        onContextMenu={handleContextMenu}
      >
        {bigHeart && (
          <span key={bigHeart.key} className="post-big-heart" style={{ left: bigHeart.x, top: bigHeart.y }} aria-hidden>
            <HeartFilledIcon size={84} />
          </span>
        )}
        <PostHeader
          author={author}
          userId={post.user_id}
          displayName={displayName}
          createdAt={post.created_at}
          authorEmail={post.author_email}
          onOpenProfile={onOpenProfile}
        />

        {files.length > 0 && (
          <PostMedia
            files={files}
            postName={plainCaption}
            onPreview={readOnly
              ? requireAuth
              // по фото: один тап — галерея, двойной — лайк
              : (file, index, all, e) => (e ? handleTap(e, () => setPreview({ files: all, index })) : setPreview({ files: all, index }))}
            onOpenHtml={readOnly ? requireAuth : (file) => setHtmlPreview(file)}
          />
        )}

        {hasCaption && (
          <>
            <div
              ref={textRef}
              className={`post-text ${overflowing && !expanded ? 'is-collapsed' : ''}`}
              style={overflowing && !expanded ? { maxHeight: COLLAPSED_HEIGHT } : undefined}
            >
              {translation && translation !== 'loading'
                ? renderTextWithLinks(translation.text)
                : <RichText text={post.name} renderText={renderTextWithLinks} />}
            </div>
            {translation && (
              <button
                type="button"
                className="post-translate-toggle"
                data-no-redirect
                onClick={(e) => { e.stopPropagation(); if (translation !== 'loading') setTranslation(null); }}
              >
                {translation === 'loading' ? t('post.translating') : t('post.showOriginal')}
              </button>
            )}
            {overflowing && !expanded && (
              <button
                type="button"
                className="post-read-more"
                data-no-redirect
                onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
              >
                {t('post.readMore')}
              </button>
            )}
          </>
        )}

        <PostFooter
          views={views}
          likes={likes}
          isLiked={isLiked}
          burst={burst}
          onLike={handleLike}
          files={files}
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
          onTranslate={showTranslate && hasCaption ? handleTranslate : undefined}
          translated={!!translation && translation !== 'loading'}
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
          onShare={handleShareFile}
          onDelete={isAuthor ? handleDeleteFile : undefined}
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