import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useT } from '../../lib/i18n';
import { supabase } from '../../lib/supabaseClient';
import Logo from '../../assets/icons/Logo';
import { PlusIcon, LogoutIcon, BellIcon, FeedIcon, FeedOutlineIcon, SettingsIcon, SettingsFilledIcon, UserIcon } from '../../assets/icons/Icons';
import { getProfile } from '../../lib/profilesCache';
import TabBar from './components/layout/TabBar';
import Page from './components/layout/Page';
import Avatar from './components/post/Avatar';
import TopbarSearch from './components/layout/TopbarSearch';
import SearchResults from './components/layout/SearchResults';
import NotificationsSheet from './components/layout/NotificationsSheet';
import Tabs from './components/layout/Tabs';
import CreateRepoModal from './components/modals/CreateRepoModal';
import PublicationList from './components/post/PublicationList';
import PostDetailScreen from '../Post/PostDetailScreen';
import ProfileScreen from '../Profile/ProfileScreen';
import SettingsScreen from '../Settings/SettingsScreen';
import './FeedScreen.css';

const POSTS_PER_PAGE = 10;



export default function FeedScreen() {
  const t = useT();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [tab, setTab] = useState('for-you');
  const [activeNav, setActiveNav] = useState('feed');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const closeSearch = () => { setSearchOpen(false); setSearchQuery(''); };
  const [notifOpen, setNotifOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [openPost, setOpenPost] = useState(null);

  const [myProfile, setMyProfile] = useState(null);
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
    // аватарка для вкладки «Профиль»
    getProfile(supabase, currentUser.id).then((p) => p && setMyProfile(p));
  }, [currentUser]);

  // вкладки нижней панели; у «Профиля» вместо иконки — ваша аватарка, как в Telegram
  const myName = myProfile?.display_name || myProfile?.username || t('nav.profile');
  const TABS = [
    { id: 'for-you', label: t('tab.forYou') },
    { id: 'fresh', label: t('tab.fresh') },
    { id: 'top', label: t('tab.top') },
  ];
  const navItems = [
    // невыбранная вкладка — контурная иконка, выбранная — залитая
    { label: t('nav.feed'), icon: <FeedOutlineIcon size={28} />, iconActive: <FeedIcon size={28} />, action: 'feed' },
    {
      label: t('nav.profile'),
      icon: currentUser
        ? <span className="tab-avatar"><Avatar url={myProfile?.avatar_url} name={myName} seed={currentUser.id} size={28} /></span>
        : <UserIcon size={24} />,
      action: 'profile',
    },
    { label: t('nav.settings'), icon: <SettingsIcon size={28} />, iconActive: <SettingsFilledIcon size={28} />, action: 'settings' },
  ];

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
        (p) => setPosts((prev) => (prev.some((x) => x.id === p.new.id) ? prev : [p.new, ...prev])))
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
    // вкладка закрывает открытые поверх экраны (поиск, уведомления, чужой профиль)
    closeSearch();
    setNotifOpen(false);
    setProfileUserId(null);
    if (action === 'feed' && activeNav === 'feed') window.scrollTo({ top: 0, behavior: 'smooth' });
    setActiveNav(action);
  };

  const backToFeed = () => setActiveNav('feed');

  // порядок вкладок: экраны стоят в ряд и сдвигаются при переключении
  const NAV_ORDER = ['feed', 'profile', 'settings'];
  const navIndex = Math.max(0, NAV_ORDER.indexOf(activeNav));

  const handleOpenPost = (post) => {
    setOpenPost(post);
  };

  const handleOpenProfile = (userId) => {
    if (userId === currentUser?.id) {
      setProfileUserId(null);
      setActiveNav('profile');
    } else {
      setProfileUserId(userId);
    }
  };

  return (
    <>
      <div
        className={`app ${activeNav !== 'feed' || notifOpen || profileUserId ? 'has-side-page' : ''}`}
        style={{ '--nav-shift': `${-navIndex * 100}%` }}
      >
        <div className="app-bg" />

        <aside className="desktop-sidebar">
          <ul className="side-menu-list">
            {navItems.map((item) => (
              <li key={item.label}>
                <button
                  className={`side-menu-item ${activeNav === item.action ? 'is-active' : ''}`}
                  onClick={() => handleNavClick(item.action)}
                >
                  <span className="side-menu-icon">{activeNav === item.action && item.iconActive ? item.iconActive : item.icon}</span>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Топбар: 103px = 52px (кнопки) + 51px (фильтры) */}
        <header className={`topbar ${searchOpen ? 'is-searching' : ''}`}>
          <div className="topbar-row">
            <TopbarSearch
              open={searchOpen}
              query={searchQuery}
              onQueryChange={setSearchQuery}
              onOpen={() => setSearchOpen(true)}
              onClose={closeSearch}
            />

            <button className="fixed-logo" onClick={handleLogoClick} aria-label={t('top.refresh')}>
              <Logo className="logo-icon" />
              <span className="logo-text">связь</span>
              <span className="logo-beta-capsule">BETA</span>
            </button>

            <div className="double-btn">
              <button className="double-btn-item" aria-label={t('top.notifications')} onClick={() => setNotifOpen(true)} title={t('top.notifications')}>
                <BellIcon size={24} />
              </button>
              <button className="double-btn-item" aria-label={t('top.create')} onClick={() => setModalOpen(true)}>
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
            {refreshing && (
              <div className="refresh-overlay">
                <div className="refresh-text">{t('feed.refreshing')}</div>
              </div>
            )}

            {searchOpen ? (
              <SearchResults
                query={searchQuery}
                currentUser={currentUser}
                onOpenPost={handleOpenPost}
                onOpenProfile={handleOpenProfile}
              />
            ) : loading && posts.length === 0 ? (
              <div className="loading-feed">{t('feed.loading')}</div>
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

      <TabBar items={navItems} active={activeNav} onSelect={handleNavClick} />

      {notifOpen && <NotificationsSheet onClose={() => setNotifOpen(false)} />}

      {/* «Настройки» — экран вкладки, как в Telegram */}
      {currentUser && (
        <SettingsScreen
          user={currentUser}
          profile={myProfile}
          active={activeNav === 'settings'}
          slide={2 - navIndex}
          onClose={backToFeed}
          onOpenProfile={() => setActiveNav('profile')}
          onOpenNotifications={() => setNotifOpen(true)}
          onLogout={handleLogout}
        />
      )}

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
      ) : (
        <>
          {/* «Профиль» — экран вкладки */}
          {currentUser && (
            <ProfileScreen
              user={currentUser}
              asPage
              active={activeNav === 'profile'}
              slide={1 - navIndex}
              onClose={backToFeed}
              onOpenPost={handleOpenPost}
            />
          )}
          {/* чужой профиль въезжает справа, с кнопкой «Назад» */}
          {profileUserId && (
            <ProfileScreen
              key={profileUserId}
              user={currentUser}
              targetUserId={profileUserId}
              asPage
              pushed
              onClose={() => setProfileUserId(null)}
              onOpenPost={handleOpenPost}
            />
          )}
        </>
      )}
    </>
  );
}