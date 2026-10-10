import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Logo from '../../assets/icons/Logo';
import { LogoutIcon, PlusIcon } from '../../assets/icons/Icons';
import SideMenu from './components/layout/SideMenu';
import CreateRepoModal from './components/modals/CreateRepoModal';
import ProfileModal from './components/modals/ProfileModal';
import PublicationList from './components/post/PublicationList';
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

function Tabs({ tabs, active, onChange }) {
  const containerRef = useRef(null);
  const [capsule, setCapsule] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateCapsule = () => {
      const buttons = container.querySelectorAll('.tab');
      const index = tabs.findIndex((t) => t.id === active);
      const btn = buttons[index];
      if (btn) {
        setCapsule({ left: btn.offsetLeft, width: btn.offsetWidth });
      }
    };

    updateCapsule();
    window.addEventListener('resize', updateCapsule);
    return () => window.removeEventListener('resize', updateCapsule);
  }, [active, tabs]);

  return (
    <div className="tabs" ref={containerRef}>
      <div
        className="tabs-capsule"
        style={{
          transform: `translateX(${capsule.left}px)`,
          width: capsule.width,
        }}
      />
      {tabs.map((t) => (
        <button
          key={t.id}
          className={`tab ${active === t.id ? 'is-active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export default function FeedScreen() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [tab, setTab] = useState('for-you');
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const sentinelRef = useRef(null);
  const trackedIdsRef = useRef(new Set());
  const loadingRef = useRef(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user));
  }, []);

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
    if (loadingRef.current) return;
    if (!reset && !hasMore) return;

    loadingRef.current = true;
    setLoading(true);

    const offset = reset ? 0 : posts.length;
    const data = await loadPosts(tab, POSTS_PER_PAGE, offset);

    if (reset) {
      setPosts(data);
      trackedIdsRef.current = new Set();
    } else {
      setPosts((prev) => [...prev, ...data]);
    }

    setHasMore(data.length === POSTS_PER_PAGE);
    setLoading(false);
    loadingRef.current = false;
  }, [tab, posts.length, hasMore, loadPosts]);

  useEffect(() => {
    load(true);
  }, [tab, currentUser]);

  const handleLogoClick = useCallback(async () => {
    if (refreshing) return;

    const isAtTop = window.scrollY < 5;

    if (!isAtTop) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setRefreshing(true);

    try {
      const data = await loadPosts(tab, POSTS_PER_PAGE, 0);
      setPosts(data);
      trackedIdsRef.current = new Set();
      setHasMore(data.length === POSTS_PER_PAGE);
    } catch {
      // тихо игнорируем
    }

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
  }, [hasMore, load]);

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

  useEffect(() => {
    if (!currentUser || posts.length === 0) return;
    const newIds = posts.map((p) => p.id).filter((id) => !trackedIdsRef.current.has(id));
    if (newIds.length === 0) return;
    newIds.forEach((id) => trackedIdsRef.current.add(id));
    supabase.rpc('track_views_batch', { p_post_ids: newIds, p_user_id: currentUser.id });
  }, [currentUser, posts.length]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleNavClick = (action) => {
    if (action === 'profile') setProfileOpen(true);
    setMenuOpen(false);
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
                <div className="refresh-spinner" />
                <div className="refresh-text">Обновляем рекомендации...</div>
              </div>
            )}

            {loading && posts.length === 0 ? (
              <div className="loading-feed">Загрузка...</div>
            ) : (
              <>
                <PublicationList publications={posts} currentUser={currentUser} />
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
      {profileOpen && currentUser && (
        <ProfileModal user={currentUser} onClose={() => setProfileOpen(false)} />
      )}
    </>
  );
}