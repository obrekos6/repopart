import React, { useState, useEffect, useRef, useId } from 'react';
import { useT } from '../../../../lib/i18n';
import { createPortal } from 'react-dom';
import { supabase } from '../../../../lib/supabaseClient';
import { getProfile } from '../../../../lib/profilesCache';
import { FILES_BUCKET } from '../../../../lib/storage';
import { RichText, toPlainText } from '../../../../lib/richText';
import { translateText } from '../../../../lib/translate';
import { withAppleEmoji } from '../../../../lib/appleEmoji';
import { useSetting } from '../../../../lib/settings';
import { HeartFilledIcon, EyeIcon } from '../../../../assets/icons/Icons';

// выше этой высоты текст поста сворачивается (≈ 12 строк по 22px)
const COLLAPSED_HEIGHT = 264;

/* подсветка найденных слов (поиск): акцентный цвет, полупрозрачный, скруглённый */
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// query — строка или список найденных слов (умный поиск подсвечивает слова с опечатками)
function highlightText(text, query) {
  const terms = (Array.isArray(query) ? query : [query]).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!terms.length || !text) return withAppleEmoji(text);
  const re = new RegExp(`(${terms.map(escapeRe).join('|')})`, 'gi');
  return text.split(re).map((part, i) =>
    i % 2 === 1 ? <mark key={i} className="search-hl">{withAppleEmoji(part)}</mark> : <React.Fragment key={i}>{withAppleEmoji(part)}</React.Fragment>
  );
}
import PostHeader from './PostHeader';
import Avatar from './Avatar';
import { formatPostTime } from '../../../../lib/formatTime';
import { isAdmin } from '../../../../lib/admin';
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
  onOpenParts,
}) {
  const t = useT();
  const [views, setViews] = useState(post.views || 0);
  // реакции эмодзи: { '❤️': 3, '🔥': 1 } и своя реакция (одна на человека)
  const [reacts, setReacts] = useState({});
  const [myEmoji, setMyEmoji] = useState(null);
  const isLiked = !!myEmoji;
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
  const canDelete = isAuthor || isAdmin(currentUser);

  // вложения поста; меняются, если удалить фото/видео из галереи
  const [files, setFiles] = useState(post.files || []);
  useEffect(() => { setFiles(post.files || []); }, [post.files]);
  const plainCaption = toPlainText(post.name || '');
  const hasCaption = !!plainCaption.trim() || (post.name || '').includes('<blockquote>');

  // «Читать далее» для длинных постов
  const textRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  // при раскрытии высота плавно растёт до полной, потом ограничение снимается
  const [openH, setOpenH] = useState(null);
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

  // все реакции поста одним запросом: считаем по эмодзи и находим свою
  const loadReactions = async () => {
    const { data } = await supabase
      .from('reactions')
      .select('emoji, user_id')
      .eq('repository_id', post.id);
    if (pendingLikeRef.current || !mountedRef.current || !data) return;
    const map = {};
    let mine = null;
    data.forEach((r) => {
      const e = r.emoji || '❤️';
      map[e] = (map[e] || 0) + 1;
      if (currentUser && r.user_id === currentUser.id) mine = e;
    });
    setReacts(map);
    setMyEmoji(mine);
  };

  useEffect(() => {
    if (readOnly) return;
    loadReactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          loadReactions();
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'repositories', filter: `id=eq.${post.id}` },
        (p) => { if (mountedRef.current) setViews(p.new.views || 0); })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [post.id, currentUser, uid, readOnly]);

  // поставить / сменить / снять реакцию (повторный выбор той же — снимает)
  const react = async (emoji = '❤️') => {
    if (readOnly) { requireAuth(); return; }
    if (!currentUser || pendingLikeRef.current) return;
    pendingLikeRef.current = true;
    lastLocalRef.current = Date.now();

    const prev = myEmoji;
    const prevMap = reacts;
    const next = prev === emoji ? null : emoji;
    const map = { ...reacts };
    if (prev) { map[prev] = (map[prev] || 1) - 1; if (map[prev] <= 0) delete map[prev]; }
    if (next) map[next] = (map[next] || 0) + 1;
    setReacts(map);
    setMyEmoji(next);
    if (next) { setBurst(true); setTimeout(() => setBurst(false), 600); }

    try {
      // supabase-js не бросает исключения, ошибку нужно проверять вручную
      const q = supabase.from('reactions');
      const { error } = !next
        ? await q.delete().eq('repository_id', post.id).eq('user_id', currentUser.id)
        : prev
          ? await q.update({ emoji: next }).eq('repository_id', post.id).eq('user_id', currentUser.id)
          : await q.insert({ repository_id: post.id, user_id: currentUser.id, emoji: next });
      if (error) throw error;
    } catch {
      if (mountedRef.current) { setReacts(prevMap); setMyEmoji(prev); }
    } finally {
      setTimeout(() => { pendingLikeRef.current = false; }, 500);
    }
  };
  const handleLike = () => react('❤️');

  // скачать первый файл поста (пункт меню)
  const handleDownload = async () => {
    const f = files[0];
    if (!f) return;
    const filename = f.name || 'download';
    try {
      const res = await fetch(f.url);
      const blob = await res.blob();
      const a = document.createElement('a');
      const objUrl = URL.createObjectURL(blob);
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
    } catch {
      window.open(f.url, '_blank');
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
    if (pressRef.current.fired) { pressRef.current.fired = false; return; } // меню уже открыто зажатием
    handleTap(e, () => setMenuOpen(true));
  };

  // зажатие: пост чуть уменьшается; через 450 мс открывается меню
  const [pressed, setPressed] = useState(false);
  const pressRef = useRef({ timer: null, x: 0, y: 0, fired: false });
  const onPressStart = (e) => {
    if (readOnly || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (e.target.closest('button, a, input, textarea, .post-media')) return;
    const p = pressRef.current;
    p.x = e.clientX; p.y = e.clientY; p.fired = false;
    setPressed(true);
    clearTimeout(p.timer);
    p.timer = setTimeout(() => {
      p.fired = true;
      clearTimeout(tapRef.current.timer);
      tapRef.current.timer = null;
      setMenuOpen(true);
      setPressed(false);
    }, 450);
  };
  const onPressMove = (e) => {
    const p = pressRef.current;
    if (p.timer && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) { clearTimeout(p.timer); p.timer = null; setPressed(false); }
  };
  const onPressEnd = () => {
    clearTimeout(pressRef.current.timer);
    pressRef.current.timer = null;
    setPressed(false);
  };
  useEffect(() => () => clearTimeout(pressRef.current.timer), []);
  // отпускание где угодно (палец ушёл с поста, прокрутка) всегда возвращает размер
  useEffect(() => {
    if (!pressed) return undefined;
    const up = () => onPressEnd();
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('scroll', up, true);
    window.addEventListener('blur', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('scroll', up, true);
      window.removeEventListener('blur', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pressed]);

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

  // время и просмотры встают в последнюю строку текста, если нет реакций и текст не свёрнут
  const postTime = formatPostTime(post.created_at);
  const hasVisual = files.some((f) => f?.type?.startsWith('image/') || f?.type?.startsWith('video/'));
  const mediaMeta = hasVisual && !hasCaption;
  const hasReacts = Object.keys(reacts).length > 0;
  // при переводе время встаёт в строку «Показать оригинал»
  const inlineMeta = hasCaption && !hasReacts && !(overflowing && !expanded);
  const metaW = Math.round((String(views).length + postTime.length + (hasVisual ? Math.min(displayName.length, 20) : 0)) * 6 + 34);

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
      {/* пост — как сообщение в канале: аватар снаружи слева внизу, пузырь с хвостиком */}
      <div
        className={`post-row ${menuOpen ? 'is-menu-open' : ''} ${pressed ? 'is-pressed' : ''}`}
        onPointerDown={onPressStart}
        onPointerUp={onPressEnd}
        onPointerCancel={onPressEnd}
        onPointerLeave={onPressEnd}
        onPointerMove={onPressMove}
      >
      <button
        type="button"
        className="post-row-avatar"
        onClick={(e) => { e.stopPropagation(); onOpenProfile?.(post.user_id); }}
        aria-label={displayName}
      >
        <Avatar url={author?.avatar_url} name={displayName} seed={post.user_id} size={36} />
      </button>
      <div className="post-bubble">
      <svg className="post-tail" width="14" height="17" viewBox="0 15 13.1 16.93" aria-hidden>
        <path d="M5.88281 15C6.13544 17.8617 6.62476 20.0067 7.5752 21.8721C8.87019 24.4135 10.7445 26.5983 13.0303 28.2598C10.1528 30.56 6.53854 31.9305 2.61328 31.9307C1.72491 31.9307 0.851596 31.8598 0 31.7246C3.19773 30.0392 5.42132 26.7525 5.60059 22.9307V15H5.88281Z" />
      </svg>
      <div
        ref={cardRef}
        className={`post-card ${readOnly ? 'is-preview' : ''} ${hasVisual ? 'no-header' : ''} ${mediaMeta ? 'media-only' : ''}`}
        onClick={handleCardClick}
        onContextMenu={handleContextMenu}
      >
        {bigHeart && (
          <span key={bigHeart.key} className="post-big-heart" style={{ left: bigHeart.x, top: bigHeart.y }} aria-hidden>
            <HeartFilledIcon size={84} />
          </span>
        )}
        {/* у постов с фото/видео имени нет — как у медиа в каналах */}
        {!hasVisual && (
          <PostHeader
            author={author}
            userId={post.user_id}
            displayName={displayName}
            createdAt={post.created_at}
            onOpenProfile={onOpenProfile}
            bubble
          />
        )}

        {files.length > 0 && (
          <div className="post-media-wrap">
          <PostMedia
            files={files}
            postName={plainCaption}
            onPreview={readOnly
              ? requireAuth
              // по фото: один тап — галерея, двойной — лайк
              // в ленте — просмотр как Parts, в остальных местах — обычная галерея
              : (file, index, all, e) => {
                  const open = onOpenParts ? () => onOpenParts(post, index) : () => setPreview({ files: all, index });
                  return e ? handleTap(e, open) : open();
                }}
            onOpenHtml={readOnly ? requireAuth : (file) => setHtmlPreview(file)}
          />
          {/* нет текста — время и просмотры капсулой поверх фото/видео */}
          {mediaMeta && (
            <span className="post-media-meta">
              <span className="post-meta-author">{displayName}</span>
              <span className="post-meta-time">{postTime}</span>
              <span className="post-meta-views"><EyeIcon size={13} /><span>{views}</span></span>
            </span>
          )}
          </div>
        )}

        {hasCaption && (
          <>
            <div
              ref={textRef}
              className={`post-text ${overflowing && !expanded ? 'is-collapsed' : ''}`}
              style={overflowing && !expanded ? { maxHeight: COLLAPSED_HEIGHT } : openH ? { maxHeight: openH } : undefined}
              onTransitionEnd={(e) => { if (e.propertyName === 'max-height') setOpenH(null); }}
            >
              {translation && translation !== 'loading'
                ? renderTextWithLinks(translation.text)
                : <RichText text={post.name} renderText={renderTextWithLinks} />}
              {/* место под время в последней строке: если строка длинная — время уйдёт ниже */}
              {inlineMeta && !translation && <span className="post-meta-spacer" style={{ width: metaW }} aria-hidden />}
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
                onClick={(e) => { e.stopPropagation(); setOpenH(textRef.current ? textRef.current.scrollHeight : null); setExpanded(true); }}
              >
                {t('post.readMore')}
              </button>
            )}
          </>
        )}

        <PostFooter
          views={views}
          time={postTime}
          inlineMeta={inlineMeta}
          hideMeta={mediaMeta}
          author={hasVisual ? displayName : ''}
          reacts={reacts}
          myEmoji={myEmoji}
          burst={burst}
          onReact={react}
          files={files}
          postId={post.id}
          onOpenComments={handleOpenComments}
          hasUnreadComments={hasUnreadComments}
        />
      </div>
      </div>
      </div>

      {!readOnly && (
        <PostContextMenu
          open={menuOpen}
          anchorRef={cardRef}
          myEmoji={myEmoji}
          onReact={react}
          onComments={handleOpenComments}
          onDownload={files.length ? handleDownload : undefined}
          onClose={() => setMenuOpen(false)}
          onShare={handleShare}
          onCopy={handleCopy}
          onTranslate={showTranslate && hasCaption ? handleTranslate : undefined}
          translated={!!translation && translation !== 'loading'}
          onDelete={handleDelete}
          isAuthor={canDelete}
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