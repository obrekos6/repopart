import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabaseClient';
import { useT, useLang } from '../../lib/i18n';
import { useBackButton } from '../../lib/useBackButton';
import { colorFromString, initialFromString } from '../../lib/avatar';
import { LogoutIcon, BackIcon, VerifiedIcon, CameraIcon } from '../../assets/icons/Icons';
import Avatar from '../Feed/components/post/Avatar';
import PublicationList from '../Feed/components/post/PublicationList';
import ProfileSetup from './components/ProfileSetup';
import './ProfileScreen.css';

const VERIFIED_EMAILS = ['obrekos6@gmail.com', 'andrey09012014@gmail.com'];

const COLLAPSE_DISTANCE = 110; 
const PULL_RANGE = 180;        
const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const SHEET_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

const plural = (n, forms) => {
  const d = n % 10, dd = n % 100;
  if (dd >= 11 && dd <= 14) return forms[2];
  if (d === 1) return forms[0];
  if (d >= 2 && d <= 4) return forms[1];
  return forms[2];
};

// «в связи с октября 2026»
const joinedText = (iso, lang = 'ru') => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU', { month: 'long', year: 'numeric' }).replace(' г.', '');
};

export default function ProfileScreen({
  user,
  targetUserId,
  onClose,
  onOpenPost,
  initialEdit = false,
  forceSetup = false,
  onComplete,
  // asPage — страница как в Telegram (а не шторка снизу):
  //   без pushed — вкладка «Профиль» под нижней панелью;
  //   pushed — чужой профиль, въезжает справа, слева кнопка «Назад»
  asPage = false,
  pushed = false,
  // для экрана вкладки: active — вкладка выбрана; slide — сдвиг в «ширинах экрана»
  // (−1 слева, 0 на месте, 1 справа) — так вкладки листаются, как галерея
  active = true,
  slide = 0,
}) {
  const isTabPage = asPage && !pushed;
  const t = useT();
  const lang = useLang();
  const profileId = targetUserId || user?.id;
  const isOwnProfile = !targetUserId || targetUserId === user?.id;

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState(initialEdit);
  const [mode, setMode] = useState('normal'); 

  const scrollRef = useRef(null);
  const nameRef = useRef(null);
  const headerRef = useRef(null);
  const heroRef = useRef(null);
  const closingRef = useRef(false);
  const modeRef = useRef('normal');
  const panelRef = useRef(null);
  const panelDragRef = useRef({
    active: false, pointerId: null, startY: 0, lastY: 0, lastT: 0, velocity: 0, dy: 0,
  });
  const editSheetRef = useRef(null);
  const editClosingRef = useRef(false);
  const editDragRef = useRef({
    active: false, pointerId: null, startY: 0, lastY: 0, lastT: 0, velocity: 0, dy: 0,
  });

  const setVar = useCallback((name, value) => {
    panelRef.current?.style.setProperty(name, value);
    headerRef.current?.style.setProperty(name, value);
    heroRef.current?.style.setProperty(name, value);
  }, []);

  const setDragging = useCallback((on) => {
    [panelRef.current, headerRef.current, heroRef.current].forEach((n) => {
      if (!n) return;
      if (on) n.setAttribute('data-dragging', '');
      else n.removeAttribute('data-dragging');
    });
  }, []);

  const animTimerRef = useRef(null);
  const applyMode = useCallback((next) => {
    modeRef.current = next;
    setMode(next);
    const panel = panelRef.current;
    if (panel) {
      panel.setAttribute('data-anim', '');
      clearTimeout(animTimerRef.current);
      animTimerRef.current = setTimeout(() => panel.removeAttribute('data-anim'), 380);
    }
    setVar('--t', next === 'full' ? '1' : '0');
  }, [setVar]);

  const onPanelDragStart = (e) => {
    if (forceSetup || closingRef.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const d = panelDragRef.current;
    d.active = true;
    d.pointerId = e.pointerId;
    d.startY = e.clientY;
    d.lastY = e.clientY;
    d.lastT = performance.now();
    d.velocity = 0;
    d.dy = 0;
    if (panelRef.current) panelRef.current.style.transition = 'none';
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const onPanelDragMove = (e) => {
    const d = panelDragRef.current;
    if (!d.active || e.pointerId !== d.pointerId) return;
    const now = performance.now();
    const dt = now - d.lastT;
    if (dt > 0) d.velocity = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY;
    d.lastT = now;
    d.dy = Math.max(0, e.clientY - d.startY);
    if (panelRef.current) panelRef.current.style.transform = `translateY(${d.dy}px)`;
  };

  const onPanelDragEnd = (e) => {
    const d = panelDragRef.current;
    if (!d.active || e.pointerId !== d.pointerId) return;
    d.active = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    const el = panelRef.current;
    if (d.dy > 60 || d.velocity > 0.4) {
      handleClose();
    } else if (el) {
      el.style.transition = `transform 280ms ${SHEET_EASE}`;
      el.style.transform = 'translateY(0)';
      setTimeout(() => {
        if (closingRef.current || !panelRef.current) return;
        panelRef.current.style.transition = '';
        panelRef.current.style.transform = '';
      }, 290);
    }
  };

  const closeEdit = useCallback(() => {
    if (forceSetup || editClosingRef.current) return;
    const el = editSheetRef.current;
    if (!el) { setEditing(false); return; }
    editClosingRef.current = true;
    el.style.transition = `transform 320ms ${SHEET_EASE}`;
    el.style.transform = 'translateY(100%)';
    setTimeout(() => {
      setEditing(false);
      editClosingRef.current = false;
    }, 320);
  }, [forceSetup]);

  const onEditDragStart = (e) => {
    if (forceSetup || editClosingRef.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const d = editDragRef.current;
    d.active = true;
    d.pointerId = e.pointerId;
    d.startY = e.clientY;
    d.lastY = e.clientY;
    d.lastT = performance.now();
    d.velocity = 0;
    d.dy = 0;
    if (editSheetRef.current) editSheetRef.current.style.transition = 'none';
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const onEditDragMove = (e) => {
    const d = editDragRef.current;
    if (!d.active || e.pointerId !== d.pointerId) return;
    const now = performance.now();
    const dt = now - d.lastT;
    if (dt > 0) d.velocity = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY;
    d.lastT = now;
    d.dy = Math.max(0, e.clientY - d.startY);
    if (editSheetRef.current) editSheetRef.current.style.transform = `translateY(${d.dy}px)`;
  };

  const onEditDragEnd = (e) => {
    const d = editDragRef.current;
    if (!d.active || e.pointerId !== d.pointerId) return;
    d.active = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (d.dy > 60 || d.velocity > 0.4) {
      closeEdit();
    } else if (editSheetRef.current) {
      editSheetRef.current.style.transition = `transform 280ms ${SHEET_EASE}`;
      editSheetRef.current.style.transform = 'translateY(0)';
    }
  };

  useBackButton(() => {
    if (modeRef.current === 'full') { applyMode('normal'); return; }
    if (editing && !forceSetup) { closeEdit(); return; }
    if (!forceSetup) handleClose();
  }, isTabPage ? active : true);

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    // экран вкладки живёт постоянно и прокручивается сам — ленту не блокируем
    if (isTabPage) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isTabPage]);

  /*
   * Жесты профиля — одно место, где решается, что происходит:
   *  • прокрутка → --s и --p (раз в кадр, через requestAnimationFrame);
   *  • потянуть вниз с самого верха → фото раскрывается за пальцем (--t), с сопротивлением;
   *  • в режиме фото потянуть вверх → фото сворачивается;
   *  • отпустили → доводим до ближайшего состояния плавной анимацией.
   */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;

    let raf = 0;
    const writeScroll = () => {
      raf = 0;
      const top = Math.max(0, el.scrollTop);
      setVar('--p', String(clamp(top / COLLAPSE_DISTANCE)));
      setVar('--s', `${Math.min(top, 400)}px`);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(writeScroll); };

    // потягивание пальцем
    let startY = 0;
    let pulling = false;     // палец сейчас тянет фото
    let canPull = false;     // жест начался с самого верха (или в режиме фото)
    let t = 0;

    const rubber = (x) => (x < 0 ? 0 : x > 1 ? 1 + (x - 1) * 0.25 : x); // сопротивление у краёв

    const onStart = (e) => {
      if (e.touches.length !== 1) { canPull = false; return; }
      startY = e.touches[0].clientY;
      pulling = false;
      canPull = modeRef.current === 'full' || el.scrollTop <= 0;
    };

    const onMove = (e) => {
      if (!canPull || e.touches.length !== 1) return;
      const dy = e.touches[0].clientY - startY;
      if (modeRef.current === 'normal') {
        if (!pulling && (dy <= 4 || el.scrollTop > 0)) { if (dy < -4) canPull = false; return; }
        t = rubber(dy / PULL_RANGE);
      } else {
        if (!pulling && dy >= -4) return;
        t = rubber(1 + dy / PULL_RANGE);
      }
      if (e.cancelable) e.preventDefault();
      if (!pulling) { pulling = true; setDragging(true); }
      setVar('--t', String(Math.min(1, t)));
    };

    const onEnd = () => {
      canPull = false;
      if (!pulling) return;
      pulling = false;
      setDragging(false);
      // в режим фото — если вытянули больше трети; обратно — если стянули больше трети
      const goFull = modeRef.current === 'normal' ? t > 0.33 : t > 0.67;
      if (goFull) el.scrollTop = 0;
      applyMode(goFull ? 'full' : 'normal');
    };

    // колёсико и тачпад: вверх у самого верха — фото, вниз в режиме фото — обратно
    let wheelLockUntil = 0;
    const onWheel = (e) => {
      if (e.ctrlKey || Math.abs(e.deltaY) < 2) return;
      const now = performance.now();
      if (modeRef.current === 'full') {
        e.preventDefault();
        if (now < wheelLockUntil || e.deltaY < 0) return;
        wheelLockUntil = now + 500;
        applyMode('normal');
        return;
      }
      if (el.scrollTop > 0 || e.deltaY > 0) return;
      e.preventDefault();
      if (now < wheelLockUntil) return;
      wheelLockUntil = now + 500;
      applyMode('full');
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    writeScroll();
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [applyMode, setVar, setDragging]);

  /* тап по аватарке: в свёрнутой шапке — наверх; наверху — открыть/закрыть фото */
  const onAvatarTap = () => {
    const el = scrollRef.current;
    if (modeRef.current === 'full') { applyMode('normal'); return; }
    if (el && el.scrollTop > 4) {
      el.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    applyMode('full');
  };

  const loadProfile = useCallback(() => {
    if (!profileId) return;
    supabase
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
  }, [profileId]);

  useEffect(() => {
    if (!profileId) return;
    loadProfile();

    supabase
      .from('repositories')
      .select('*')
      .eq('user_id', profileId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setPosts(data || []);
        setLoading(false);
      });
  }, [profileId, loadProfile]);

  const handleClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    const el = panelRef.current;
    if (el && !asPage) {
      el.style.transition = `transform 300ms ${SHEET_EASE}`;
      el.style.transform = 'translateY(100%)';
    }
    setVisible(false);
    setTimeout(() => onClose?.(), 300);
  };

  const handleEditComplete = () => {
    loadProfile();
    onComplete?.();
    if (forceSetup) setEditing(false);
    else closeEdit();
  };



  const isVerified = profile?.email && VERIFIED_EMAILS.includes(profile.email) || (user?.email && VERIFIED_EMAILS.includes(user.email));
  const displayName = profile?.display_name || profile?.username || 'user';
  const username = profile?.username || '';
  const avatarUrl = profile?.avatar_url;

  // ширина имени в шапке (17px) — чтобы аватарка встала ровно слева от него
  useEffect(() => {
    const el = nameRef.current;
    if (!el) return;
    const style = getComputedStyle(el);
    const font = parseFloat(style.fontSize) || 22;
    const icon = isVerified ? 24 : 0; // значок 18px + отступ 6px не масштабируются
    const w = (el.offsetWidth - icon) * (17 / font) + icon;
    setVar('--nw', `${Math.ceil(w)}px`);
  }, [displayName, isVerified, setVar]);


  return createPortal(
    <div
      className={`profile-screen-root ${visible ? 'is-on' : ''} ${asPage ? 'is-page' : ''} ${pushed ? 'is-pushed' : ''} ${isTabPage && !active ? 'is-inactive' : ''}`}
      style={isTabPage ? { transform: `translateX(${slide * 100}%)` } : undefined}
      aria-hidden={isTabPage && !active ? true : undefined}
    >
      <div
        className="profile-screen-backdrop"
        onClick={forceSetup ? undefined : handleClose}
      />

      <div
        ref={panelRef}
        className={`profile-screen-panel ${mode === 'full' ? 'is-full' : ''}`}
      >
        {!asPage && (
          <div
            className={`profile-sheet-handle-zone ${forceSetup ? 'is-locked' : ''}`}
            onPointerDown={onPanelDragStart}
            onPointerMove={onPanelDragMove}
            onPointerUp={onPanelDragEnd}
            onPointerCancel={onPanelDragEnd}
          >
            <div className="profile-sheet-handle" />
          </div>
        )}

        <header className="profile-screen-header" ref={headerRef}>
          {!forceSetup && (!asPage || pushed) ? (
            <button className="profile-screen-btn" onClick={handleClose} aria-label={t('common.back')}>
              <BackIcon size={22} />
            </button>
          ) : (
            <div style={{ width: 40 }} />
          )}
          {isOwnProfile && !asPage ? (
            <button
              className="profile-screen-btn"
              onClick={async () => { await supabase.auth.signOut(); }}
              aria-label={t('profile.logout')}
            >
              <LogoutIcon size={20} />
            </button>
          ) : (
            <div style={{ width: 40 }} /> // Пустая заглушка для выравнивания
          )}
        </header>

        <div
          className="profile-screen-scroll"
          ref={scrollRef}
        >
          {/* место под аватарку и имя; сами они — в слое .pf-morph над прокруткой */}
          <div className="profile-hero pf-hero-space" ref={heroRef} />

          {isOwnProfile && (
            <div className="pf-actions">
              <button className="pf-action" onClick={() => setEditing(true)}>
                <CameraIcon size={24} />
                <span>{t('profile.edit')}</span>
              </button>
            </div>
          )}

          <div className="pf-info">
            {username && (
              <div className="pf-info-row">
                <div className="pf-info-label">{t('profile.username')}</div>
                <div className="pf-info-value is-accent">@{username}</div>
              </div>
            )}
            {profile?.created_at && (
              <div className="pf-info-row">
                <div className="pf-info-label">{t('profile.joined')}</div>
                <div className="pf-info-value">{joinedText(profile.created_at, lang)}</div>
              </div>
            )}
          </div>

          <div className="pf-tabs">
            <span className="pf-tab is-active">{t('profile.posts')}</span>
          </div>

          {loading ? (
            <div className="profile-empty">
              <div className="profile-empty-sub">{t('profile.loading')}</div>
            </div>
          ) : posts.length === 0 ? (
            <div className="profile-empty">
              <div className="profile-empty-title">{t('profile.empty')}</div>
              <div className="profile-empty-sub">
                {t('profile.emptySub')}
              </div>
            </div>
          ) : (
            <div className="profile-posts pf-posts">
              <PublicationList
                publications={posts}
                currentUser={user}
                onOpenPost={onOpenPost}
                onOpenProfile={null} // В чужом профиле не нужно переходить по клику на аву
              />
            </div>
          )}
        </div>

        <div className="pf-morph" aria-hidden={false}>
          <button
            type="button"
            className="pf-avatar"
            onClick={onAvatarTap}
            aria-label={mode === 'full' ? t('profile.closePhoto') : t('profile.openPhoto')}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" draggable={false} />
            ) : (
              <span className="pf-avatar-fallback" style={{ background: colorFromString(profileId || displayName) }}>
                {initialFromString(displayName)}
              </span>
            )}
            <span className="pf-avatar-scrim" />
          </button>

          <div className="pf-name" ref={nameRef}>
            <span className="pf-name-text">{displayName}</span>
            {isVerified && <VerifiedIcon size={18} className="pf-verified" />}
          </div>
          <div className="pf-sub">
            {loading ? '\u00A0' : t('profile.publications', { n: posts.length })}
          </div>
        </div>

        {editing && (
          <div className="profile-edit-sheet" ref={editSheetRef}>
            <div
              className={`profile-edit-handle-zone ${forceSetup ? 'is-locked' : ''}`}
              onPointerDown={onEditDragStart}
              onPointerMove={onEditDragMove}
              onPointerUp={onEditDragEnd}
              onPointerCancel={onEditDragEnd}
            >
              <div className="profile-edit-handle" />
            </div>
            <div className="profile-edit-sheet-content">
              <h3 className="profile-edit-title">
                {forceSetup ? t('profile.fill') : t('profile.editTitle')}
              </h3>
              <ProfileSetup
                onComplete={handleEditComplete}
                submitLabel={forceSetup ? t('profile.done') : t('profile.save')}
              />
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}