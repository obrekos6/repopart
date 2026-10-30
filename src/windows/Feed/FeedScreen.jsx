import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Logo from '../../assets/icons/Logo';
import { LogoutIcon, PlusIcon } from '../../assets/icons/Icons';
import SideMenu from './components/layout/SideMenu';
import Tabs from './components/layout/Tabs';
import CreateRepoModal from './components/modals/CreateRepoModal';
import PublicationList from './components/post/PublicationList';
import PostDetailScreen from '../Post/PostDetailScreen';
import ProfileScreen from '../Profile/ProfileScreen';
import './FeedScreen.css';

const POSTS_PER_PAGE = 10;

const NAV_ITEMS = [
  { label: 'Лента', icon: '📡', action: 'feed' },
  { label: 'Профиль', icon: '👤', action: 'profile' },
  { label: 'Мои посты', icon: '📁', action: 'my' },
  { label: 'Настройки', icon: '⚙️', action: 'settings' },
];

const TABS = [
  { id: 'for-you', label: 'Для вас' },
  { id: 'fresh', label: 'Свежее' },
  { id: 'top', label: 'Топ' },
];

export default function FeedScreen() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [tab, setTab] = useState('for-you');
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [openPost, setOpenPost] = useState(null);
  
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileUserId, setProfileUserId] = useState(null); // Для чужих профилей
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);

  const sentinelRef = useRef(null);
  const loadingRef = useRef(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user));
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    supabase
      .from('profiles')
      .select('username')
      .eq('id', currentUser.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data?.username) setNeedsProfileSetup(true);
      });
  }, [currentUser]);

  const loadPosts = useCallback(async (mode, limit, offset) => {
    if (mode === 'for-you') {
      const { data, error } = await supabase.rpc('get_recommended_feed', {
        p_user_id: currentUser?.id || null,
        p_limit: limit,
        p_offset: offset,
      });
      if (error) return [];
      return data || [];
    }

    if (mode === 'top') {
      const { data } = await supabase
        .from('repositories')
        .select('*')
        .order('hot_score', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      return data || [];
    }

    const { data } = await supabase
      .from('repositories')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    return data || [];
  }, [currentUser]);

  const load = useCallback(async (reset = false) => {
    if (!reset && !hasMore) return;

    const reqId = ++requestIdRef.current;

    if (reset) {
      loadingRef.current = true;
      setPosts([]);
      setHasMore(true);
      setLoading(true);
    } else {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
    }

    const offset = reset ? 0 : posts.length;
    const data = await loadPosts(tab, POSTS_PER_PAGE, offset);

    if (reqId !== requestIdRef.current) return;

    if (reset) {
      setPosts(data);
    } else {
      setPosts((prev) => [...prev, ...data]);
    }

    setHasMore(data.length === POSTS_PER_PAGE);
    setLoading(false);
    loadingRef.current = false;
  }, [tab, posts.length, hasMore, loadPosts]);

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, currentUser]);

  const handleLogoClick = useCallback(async () => {
    if (refreshing) return;
    const isAtTop = window.scrollY < 5;

    if (!isAtTop) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setRefreshing(true);
    const reqId = ++requestIdRef.current;

    try {
      const data = await loadPosts(tab, POSTS_PER_PAGE, 0);
      if (reqId !== requestIdRef.current) return;
      setPosts(data);
      setHasMore(data.length === POSTS_PER_PAGE);
    } catch {}

    await new Promise((r) => setTimeout(r, 600));
    setRefreshing(false);
  }, [refreshing, tab, loadPosts]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    if (!hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) load(false);
      },
      { rootMargin: '400px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, load, tab]);

  useEffect(() => {
    const channel = supabase
      .channel('repositories-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'repositories' },
        (p) => setPosts((prev) => [p.new, ...prev]))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'repositories' },
        (p) => setPosts((prev) => prev.filter((x) => x.id !== p.old.id)))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'repositories' },
        (p) => setPosts((prev) => prev.map((x) => x.id === p.new.id ? p.new : x)))
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleNavClick = (action) => {
    if (action === 'profile') {
      setProfileUserId(null);
      setProfileOpen(true);
    }
    setMenuOpen(false);
  };

  const handleOpenPost = (post) => {
    setOpenPost(post);
  };

  const handleOpenProfile = (userId) => {
    if (userId === currentUser?.id) {
      setProfileUserId(null);
      setProfileOpen(true);
    } else {
      setProfileUserId(userId);
    }
  };

  return (
    <>
      <div className="app">
        <div className="app-bg" />

        <aside className="desktop-sidebar">
          <ul className="side-menu-list">
            {NAV_ITEMS.map((item) => (
              <li key={item.label}>
                <button
                  className="side-menu-item"
                  onClick={() => handleNavClick(item.action)}
                >
                  <span className="side-menu-icon">{item.icon}</span>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <button className="menu-btn" aria-label="Меню" onClick={() => setMenuOpen(true)}>
          <div className="menu-btn-stripes">
            <span></span><span></span><span></span>
          </div>
        </button>

        <button className="fixed-logo" onClick={handleLogoClick} aria-label="Обновить ленту">
          <Logo className="logo-icon" />
          <span className="logo-text">связь</span>
          <span className="logo-beta-capsule">BETA</span>
        </button>

        <div className="double-btn">
          <button className="double-btn-item" aria-label="Выйти" onClick={handleLogout} title="Выйти">
            <LogoutIcon size={20} />
          </button>
          <button className="double-btn-item" aria-label="Создать" onClick={() => setModalOpen(true)}>
            <PlusIcon size={20} />
          </button>
        </div>

        <main className="main-content">
          <section className="interests-section">
            <Tabs tabs={TABS} active={tab} onChange={setTab} />

            {refreshing && (
              <div className="refresh-overlay">
                <div className="refresh-text">Обновляем рекомендации...</div>
              </div>
            )}

            {loading && posts.length === 0 ? (
              <div className="loading-feed">Загрузка...</div>
            ) : (
              <>
                <PublicationList
                  publications={posts}
                  currentUser={currentUser}
                  onOpenPost={handleOpenPost}
                  onOpenProfile={handleOpenProfile}
                />
                {hasMore && <div ref={sentinelRef} className="load-more-sentinel" />}
              </>
            )}
          </section>
        </main>
      </div>

      <SideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={NAV_ITEMS}
        onItemClick={handleNavClick}
      />

      {modalOpen && (
        <CreateRepoModal onClose={() => setModalOpen(false)} onCreate={() => load(true)} />
      )}

      {openPost && currentUser && (
        <PostDetailScreen
          post={openPost}
          currentUser={currentUser}
          onClose={() => setOpenPost(null)}
          onOpenProfile={handleOpenProfile}
        />
      )}

      {needsProfileSetup && currentUser ? (
        <ProfileScreen
          user={currentUser}
          initialEdit={true}
          forceSetup={true}
          onClose={() => {}}
          onComplete={() => setNeedsProfileSetup(false)}
        />
      ) : profileOpen && currentUser ? (
        <ProfileScreen
          user={currentUser}
          onClose={() => setProfileOpen(false)}
          onOpenPost={handleOpenPost}
        />
      ) : profileUserId ? (
        <ProfileScreen
          user={currentUser}
          targetUserId={profileUserId}
          onClose={() => setProfileUserId(null)}
          onOpenPost={handleOpenPost}
        />
      ) : null}
    </>
  );
}