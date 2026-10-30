import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabaseClient';
import { useBackButton } from '../../lib/useBackButton';
import { colorFromString, initialFromString } from '../../lib/avatar';
import { LogoutIcon, BackIcon, VerifiedIcon } from '../../assets/icons/Icons';
import Avatar from '../Feed/components/post/Avatar';
import PublicationList from '../Feed/components/post/PublicationList';
import ProfileSetup from './components/ProfileSetup';
import './ProfileScreen.css';

const VERIFIED_EMAILS = ['obrekos6@gmail.com'];

const COLLAPSE_DISTANCE = 110; 
const PULL_RANGE = 180;        
const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const SHEET_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

export default function ProfileScreen({
  user,
  targetUserId,
  onClose,
  onOpenPost,
  initialEdit = false,
  forceSetup = false,
  onComplete,
}) {
  const profileId = targetUserId || user?.id;
  const isOwnProfile = !targetUserId || targetUserId === user?.id;

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState(initialEdit);
  const [mode, setMode] = useState('normal'); 

  const scrollRef = useRef(null);
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
    headerRef.current?.style.setProperty(name, value);
    heroRef.current?.style.setProperty(name, value);
  }, []);

  const setDragging = useCallback((on) => {
    [headerRef.current, heroRef.current].forEach((n) => {
      if (!n) return;
      if (on) n.setAttribute('data-dragging', '');
      else n.removeAttribute('data-dragging');
    });
  }, []);

  const applyMode = useCallback((next) => {
    modeRef.current = next;
    setMode(next);
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
  }, true);

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;

    let startY = 0;
    let anchorY = null; 
    let dragging = false;
    let lastT = 0;

    const begin = () => {
      if (dragging) return;
      dragging = true;
      setDragging(true);
    };

    const onStart = (e) => {
      if (e.touches.length !== 1) return;
      startY = e.touches[0].clientY;
      anchorY = el.scrollTop <= 0 ? startY : null;
      dragging = false;
    };

    const onMove = (e) => {
      if (e.touches.length !== 1) return;
      const y = e.touches[0].clientY;

      if (modeRef.current === 'normal') {
        if (el.scrollTop > 0) { anchorY = null; return; }
        if (anchorY === null) anchorY = y;
        const dy = y - anchorY;
        if (dy <= 0 && !dragging) return; 
        if (e.cancelable) e.preventDefault();
        begin();
        lastT = clamp(dy / PULL_RANGE);
      } else {
        const dy = y - startY;
        if (dy >= 0 && !dragging) return;
        if (e.cancelable) e.preventDefault();
        begin();
        lastT = clamp(1 + dy / PULL_RANGE);
      }
      setVar('--t', String(lastT));
    };

    const onEnd = () => {
      if (!dragging) return;
      dragging = false;
      anchorY = null;
      setDragging(false);
      const goFull = modeRef.current === 'normal' ? lastT > 0.3 : lastT > 0.7;
      applyMode(goFull ? 'full' : 'normal');
    };

    let wheelLockUntil = 0;
    const onWheel = (e) => {
      if (e.ctrlKey || Math.abs(e.deltaY) < 2) return;
      const now = performance.now();

      if (now < wheelLockUntil) {
        if (modeRef.current === 'full' || el.scrollTop <= 0) e.preventDefault();
        return;
      }

      if (modeRef.current === 'normal') {
        if (el.scrollTop > 0 || e.deltaY > 0) return; 
        e.preventDefault();
        wheelLockUntil = now + 500;
        applyMode('full');
      } else {
        e.preventDefault();
        if (e.deltaY < 0) return;
        wheelLockUntil = now + 500;
        applyMode('normal');
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [applyMode, setVar, setDragging]);

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
    if (el) {
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

  const handleScroll = (e) => {
    setVar('--p', String(clamp(e.currentTarget.scrollTop / COLLAPSE_DISTANCE)));
  };

  const isVerified = profile?.email && VERIFIED_EMAILS.includes(profile.email) || (user?.email && VERIFIED_EMAILS.includes(user.email));
  const displayName = profile?.display_name || profile?.username || 'user';
  const username = profile?.username || '';
  const avatarUrl = profile?.avatar_url;

  return createPortal(
    <div className={`profile-screen-root ${visible ? 'is-on' : ''}`}>
      <div
        className="profile-screen-backdrop"
        onClick={forceSetup ? undefined : handleClose}
      />

      <div
        ref={panelRef}
        className={`profile-screen-panel ${mode === 'full' ? 'is-full' : ''}`}
      >
        <div
          className={`profile-sheet-handle-zone ${forceSetup ? 'is-locked' : ''}`}
          onPointerDown={onPanelDragStart}
          onPointerMove={onPanelDragMove}
          onPointerUp={onPanelDragEnd}
          onPointerCancel={onPanelDragEnd}
        >
          <div className="profile-sheet-handle" />
        </div>

        <header className="profile-screen-header" ref={headerRef}>
          {!forceSetup && (
            <button className="profile-screen-btn" onClick={handleClose} aria-label="Назад">
              <BackIcon size={22} />
            </button>
          )}
          <div className="profile-screen-title">
            <Avatar url={avatarUrl} name={displayName} seed={profileId} size={28} />
            <span className="profile-screen-title-text">{displayName}</span>
          </div>
          
          {isOwnProfile ? (
            <button
              className="profile-screen-btn"
              onClick={async () => { await supabase.auth.signOut(); }}
              aria-label="Выйти"
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
          onScroll={handleScroll}
        >
          <div className="profile-hero" ref={heroRef}>
            <div className="profile-cover" aria-hidden="true">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="profile-cover-img" draggable={false} />
              ) : (
                <div
                  className="profile-cover-fallback"
                  style={{ background: colorFromString(profileId || displayName) }}
                >
                  <span>{initialFromString(displayName)}</span>
                </div>
              )}
              <div className="profile-cover-scrim" />
              <div className="profile-cover-info">
                <div className="profile-cover-name">
                  {displayName}
                  {isVerified && <VerifiedIcon size={20} />}
                </div>
                {username && <div className="profile-cover-username">@{username}</div>}
              </div>
            </div>

            <div className="profile-hero-normal">
              <div className="profile-hero-avatar">
                <Avatar url={avatarUrl} name={displayName} seed={profileId} size={96} />
              </div>
              <div className="profile-hero-info">
                <div className="profile-hero-name">
                  {displayName}
                  {isVerified && <VerifiedIcon size={16} className="profile-hero-verified" />}
                </div>
                {username && (
                  <div className="profile-hero-username">@{username}</div>
                )}
              </div>
            </div>
          </div>

          <div className="profile-actions">
            {isOwnProfile && (
              <button className="profile-action" onClick={() => setEditing(true)}>
                Изменить
              </button>
            )}
          </div>

          <div className="profile-tabs">
            <button className="profile-tab is-active">Публикации</button>
          </div>

          {loading ? (
            <div className="profile-empty">
              <div className="profile-empty-sub">Загрузка…</div>
            </div>
          ) : posts.length === 0 ? (
            <div className="profile-empty">
              <div className="profile-empty-title">Публикаций пока нет…</div>
              <div className="profile-empty-sub">
                Опубликуйте фото или видео в своём профиле
              </div>
            </div>
          ) : (
            <div className="profile-posts">
              <PublicationList
                publications={posts}
                currentUser={user}
                onOpenPost={onOpenPost}
                onOpenProfile={null} // В чужом профиле не нужно переходить по клику на аву
              />
            </div>
          )}
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
                {forceSetup ? 'Заполните профиль' : 'Редактировать профиль'}
              </h3>
              <ProfileSetup
                onComplete={handleEditComplete}
                submitLabel={forceSetup ? 'Готово' : 'Сохранить'}
              />
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}