import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useT } from '../../lib/i18n';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import Logo from '../../assets/icons/Logo';
import { UserIcon, PlusIcon, FeedIcon, FeedOutlineIcon, SettingsIcon, SettingsFilledIcon } from '../../assets/icons/Icons';
import PublicationList from '../Feed/components/post/PublicationList';
import TabBar from '../Feed/components/layout/TabBar';
import TopbarSearch from '../Feed/components/layout/TopbarSearch';
import SearchResults from '../Feed/components/layout/SearchResults';
import Tabs from '../Feed/components/layout/Tabs';
import './LandingScreen.css';

const POSTS_PER_PAGE = 10;

const getNav = (t) => [
  { label: t('nav.feed'), icon: <FeedOutlineIcon size={28} />, iconActive: <FeedIcon size={28} />, action: 'feed' },
  { label: t('nav.profile'), icon: <UserIcon size={24} />, action: 'profile' },
  { label: t('nav.settings'), icon: <SettingsIcon size={28} />, iconActive: <SettingsFilledIcon size={28} />, action: 'settings' },
];

const getTabs = (t) => [
  { id: 'for-you', label: t('tab.forYou') },
  { id: 'fresh', label: t('tab.fresh') },
  { id: 'top', label: t('tab.top') },
];

export default function LandingScreen({ user, loading }) {
  const t = useT();
  const NAV_ITEMS = getNav(t);
  const TABS = getTabs(t);
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [tab, setTab] = useState('for-you');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const closeSearch = () => { setSearchOpen(false); setSearchQuery(''); };

  const sentinelRef = useRef(null);
  const loadingRef = useRef(false);
  const requestIdRef = useRef(0);

  const authed = !loading && user;

  /* auto-redirect logged-in users */
  useEffect(() => {
    if (!loading && user) {
      navigate('/feed', { replace: true });
    }
  }, [loading, user, navigate]);

  const goAuth = useCallback(() => navigate('/auth'), [navigate]);
  const goFeed = useCallback(() => navigate('/feed'), [navigate]);
  const guestClick = useCallback(
    () => (authed ? goFeed() : goAuth()),
    [authed, goAuth, goFeed]
  );

  /* posts loader */
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

    const { data } = await supabase
      .from('repositories')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    return data || [];
  }, []);

  const load = useCallback(async (reset = false) => {
    if (!reset && (!hasMore || loadingRef.current)) return;

    // новый запрос (например, смена вкладки) отменяет результат старого
    const reqId = ++requestIdRef.current;
    loadingRef.current = true;

    if (reset) {
      setPosts([]);
      setPostsLoading(true);
      setHasMore(true);
    }

    const offset = reset ? 0 : posts.length;
    const data = await loadPosts(tab, POSTS_PER_PAGE, offset);

    if (reqId !== requestIdRef.current) return;

    if (reset) setPosts(data);
    else setPosts((prev) => [...prev, ...data]);

    setHasMore(data.length === POSTS_PER_PAGE);
    setPostsLoading(false);
    loadingRef.current = false;
  }, [tab, posts.length, hasMore, loadPosts]);

  // перезагружаем ленту только при смене вкладки, а не при каждом изменении load
  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  /* infinite scroll */
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
    if (action === 'feed') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    guestClick();
  }, [guestClick]);

  return (
    <>
      <div className="app landing">
        <div className="app-bg" />

        <aside className="desktop-sidebar">
          <ul className="side-menu-list">
            {NAV_ITEMS.map((item) => (
              <li key={item.label}>
                <button
                  className={`side-menu-item ${item.action === 'feed' ? 'is-active' : ''}`}
                  onClick={() => handleNavClick(item.action)}
                >
                  <span className="side-menu-icon">{item.action === 'feed' && item.iconActive ? item.iconActive : item.icon}</span>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Топбар как в ленте: 103px = 52px (кнопки) + 51px (фильтры) */}
        <header className={`topbar ${searchOpen ? 'is-searching' : ''}`}>
          <div className="topbar-row">
            <TopbarSearch
              open={searchOpen}
              query={searchQuery}
              onQueryChange={setSearchQuery}
              onOpen={() => setSearchOpen(true)}
              onClose={closeSearch}
            />

            <button className="fixed-logo" onClick={handleLogoClick} aria-label="связь">
              <Logo className="logo-icon" />
              <span className="logo-text">связь</span>
              <span className="logo-beta-capsule">BETA</span>
            </button>

            <div className="double-btn">
              <button
                className="double-btn-item"
                aria-label={t('top.login')}
                title={t('top.login')}
                onClick={guestClick}
              >
                <UserIcon size={20} />
              </button>
              <button
                className="double-btn-item"
                aria-label={t('top.create')}
                onClick={guestClick}
              >
                <PlusIcon size={20} />
              </button>
            </div>
          </div>

          <div className="topbar-filters">
            <Tabs tabs={TABS} active={tab} onChange={setTab} />
          </div>
        </header>

        <main className="main-content">
          <section className="interests-section">
            {/* seo h1 and purpose text */}
            <h1 className="landing-title" style={{ display: 'none' }}>связь</h1>
            {!searchOpen && (
              <p className="landing-purpose">
                {t('landing.purpose')}
              </p>
            )}

            {searchOpen ? (
              <SearchResults query={searchQuery} currentUser={null} readOnly onRequireAuth={guestClick} />
            ) : postsLoading && posts.length === 0 ? (
              null
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
              {authed ? t('landing.toFeed') : t('landing.signIn')}
            </button>

            <div className="landing-links">
              {/* обычные ссылки: это статичные страницы, роутер React их не знает */}
              <a href="/privacy.html" className="landing-link">{t('landing.privacy')}</a>
              <span className="landing-sep">·</span>
              <a href="/terms.html" className="landing-link">{t('landing.terms')}</a>
            </div>
          </section>
        </main>
      </div>

      <TabBar items={NAV_ITEMS} active="feed" onSelect={handleNavClick} />


    </>
  );
}
