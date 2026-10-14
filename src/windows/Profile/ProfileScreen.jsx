import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabaseClient';
import { useBackButton } from '../../lib/useBackButton';
import { LogoutIcon, BackIcon, VerifiedIcon } from '../../assets/icons/Icons';
import Avatar from '../Feed/components/post/Avatar';
import PublicationList from '../Feed/components/post/PublicationList';
import ProfileSetup from './components/ProfileSetup';
import './ProfileScreen.css';

const VERIFIED_EMAILS = ['obrekos6@gmail.com'];

export default function ProfileScreen({
  user,
  onClose,
  onOpenPost,
  initialEdit = false,
  forceSetup = false,
  onComplete,
}) {
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState(initialEdit);
  const [scrollY, setScrollY] = useState(0);

  const scrollRef = useRef(null);
  const closingRef = useRef(false);

  /* back button */
  useBackButton(() => {
    if (editing && !forceSetup) { setEditing(false); return; }
    if (!forceSetup) handleClose();
  }, true);

  /* slide up */
  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  /* load profile + posts */
  const loadProfile = useCallback(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadProfile();

    supabase
      .from('repositories')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setPosts(data || []);
        setLoading(false);
      });
  }, [user, loadProfile]);

  const handleClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setVisible(false);
    setTimeout(() => onClose?.(), 300);
  };

  const handleEditComplete = () => {
    setEditing(false);
    loadProfile();
    onComplete?.();
  };

  const handleScroll = (e) => {
    setScrollY(e.target.scrollTop);
  };

  /* hero animation */
  const progress = Math.min(1, Math.max(0, scrollY / 80));
  const avatarSize = 96 - 60 * progress;      /* 96 → 36 */
  const nameOpacity = Math.max(0, 1 - progress * 2);
  const headerTitleOpacity = Math.max(0, progress * 2 - 1);
  const heroGap = 12 - 8 * progress;

  const isVerified = user?.email && VERIFIED_EMAILS.includes(user.email);
  const displayName = profile?.display_name || profile?.username || user?.email?.split('@')[0] || 'user';
  const username = profile?.username || '';

  return createPortal(
    <div className={`profile-screen-root ${visible ? 'is-on' : ''}`}>
      <div
        className="profile-screen-backdrop"
        onClick={forceSetup ? undefined : handleClose}
      />

      <div className="profile-screen-panel">
        <header className="profile-screen-header">
          {!forceSetup && (
            <button className="profile-screen-btn" onClick={handleClose} aria-label="Назад">
              <BackIcon size={22} />
            </button>
          )}
          <div
            className="profile-screen-title"
            style={{ opacity: headerTitleOpacity }}
          >
            {displayName}
          </div>
          <button
            className="profile-screen-btn"
            onClick={async () => { await supabase.auth.signOut(); }}
            aria-label="Выйти"
          >
            <LogoutIcon size={20} />
          </button>
        </header>

        <div
          className="profile-screen-scroll"
          ref={scrollRef}
          onScroll={handleScroll}
        >
          <div className="profile-hero">
            <div
              className="profile-hero-avatar"
              style={{ width: avatarSize, height: avatarSize }}
            >
              <Avatar
                url={profile?.avatar_url}
                name={displayName}
                seed={user?.id}
                size={avatarSize}
              />
            </div>
            <div className="profile-hero-info" style={{ opacity: nameOpacity, gap: heroGap }}>
              <div className="profile-hero-name">
                {displayName}
                {isVerified && <VerifiedIcon size={16} className="profile-hero-verified" />}
              </div>
              {username && (
                <div className="profile-hero-username">@{username}</div>
              )}
            </div>
          </div>

          <div className="profile-actions">
            <button className="profile-action" onClick={() => setEditing(true)}>
              Изменить
            </button>
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
              />
            </div>
          )}
        </div>

        {/* editing bottom-sheet */}
        {editing && (
          <div className="profile-edit-sheet">
            <div className="profile-edit-sheet-handle" />
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