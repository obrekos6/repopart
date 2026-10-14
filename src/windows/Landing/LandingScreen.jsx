import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import Logo from '../../assets/icons/Logo';
import { UserIcon, PlusIcon } from '../../assets/icons/Icons';
import PublicationList from '../Feed/components/post/PublicationList';
import SideMenu from '../Feed/components/layout/SideMenu';
import Tabs from '../Feed/components/layout/Tabs';
import './LandingScreen.css';

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

export default function LandingScreen({ user, loading }) {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [tab, setTab] = useState('for-you');
  const [menuOpen, setMenuOpen] = useState(false);

  const sentinelRef = useRef(null);
  const loadingRef = useRef(false);

  const authed = !loading && user;

  const goAuth = useCallback(() => navigate('/auth'), [navigate]);
  const goFeed = useCallback(() => navigate('/feed'), [navigate]);
  const guestClick = useCallback(
    () => (authed ? goFeed() : goAuth()),
    [authed, goAuth, goFeed]
  );

  const loadPosts = useCallback(async (mode, limit, offset) => {
    if (mode === 'top') {
      const { data } = await supabase
        .from('repositories')
        .select('*')
        .order('hot_score', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      return data || [];
    }

    /* both for-you and fresh — most recent first */
    const { data } = await supabase
      .from('repositories')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    return data || [];
  }, []);

  const load = useCallback(async (reset = false) => {
    if (!reset && !hasMore) return;
    if (loadingRef.current) return;

    loadingRef.current = true;
    if (reset) {
      setPosts([]);
      setPostsLoading(true);
      setHasMore(true);
    }

    const offset = reset ? 0 : posts.length;
    const data = await loadPosts(tab, POSTS_PER_PAGE, offset);

    if (reset) setPosts(data);
    else setPosts((prev) => [...prev, ...data]);

    setHasMore(data.length === POSTS_PER_PAGE);
    setPostsLoading(false);
    loadingRef.current = false;
  }, [tab, posts.length, hasMore, loadPosts]);

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) load(false);
      },
      { rootMargin: '400px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, load]);

  const handleLogoClick = useCallback(() => {
    if (window.scrollY > 5) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    load(true);
  }, [load]);

  const handleNavClick = useCallback((action) => {
    setMenuOpen(false);
    if (action === 'feed') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    guestClick();
  }, [guestClick]);

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

        <button className="fixed-logo" onClick={handleLogoClick} aria-label="связь">
          <Logo className="logo-icon" />
          <span className="logo-text">связь</span>
          <span className="logo-beta-capsule">BETA</span>
        </button>

        <div className="double-btn">
          <button
            className="double-btn-item"
            aria-label="Войти"
            title="Войти"
            onClick={guestClick}
          >
            <UserIcon size={20} />
          </button>
          <button
            className="double-btn-item"
            aria-label="Создать"
            onClick={guestClick}
          >
            <PlusIcon size={20} />
          </button>
        </div>

        <main className="main-content">
          <section className="interests-section">
            <Tabs tabs={TABS} active={tab} onChange={setTab} />

            {postsLoading && posts.length === 0 ? (
              <div className="loading-feed">Загрузка...</div>
            ) : (
              <>
                <PublicationList
                  publications={posts}
                  currentUser={null}
                  onOpenPost={guestClick}
                  readOnly={true}
                  onRequireAuth={guestClick}
                />
                {hasMore && <div ref={sentinelRef} className="load-more-sentinel" />}
              </>
            )}

            <button type="button" className="landing-more" onClick={guestClick}>
              {authed ? 'Перейти в ленту' : 'Войдите, чтобы увидеть больше'}
            </button>

            <div className="landing-links">
              <Link to="/privacy.html" className="landing-link">Политика конфиденциальности</Link>
              <span className="landing-sep">·</span>
              <Link to="/terms.html" className="landing-link">Условия использования</Link>
            </div>
          </section>
        </main>
      </div>

      <SideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={NAV_ITEMS}
        onItemClick={handleNavClick}
      />
    </>
  );
}