import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Logo from '../../assets/icons/Logo';
import { LogoutIcon, PlusIcon } from '../../assets/icons/Icons';
import GlassFilter from '../../components/GlassFilter';
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
  const [dragging, setDragging] = useState(false);
  const [hoveredTab, setHoveredTab] = useState(null);

  const skipClickRef = useRef(false);
  const stateRef = useRef({
    startX: 0,
    startLeft: 0,
    currentLeft: 0,
    moved: false,
    positions: [],
    capsuleWidth: 0,
    active: active,
    onChange: onChange,
  });

  stateRef.current.active = active;
  stateRef.current.onChange = onChange;
  stateRef.current.capsuleWidth = capsule.width;

  const collectPositions = useCallback(() => {
    const container = containerRef.current;
    if (!container) return [];
    return Array.from(container.querySelectorAll('.tab')).map((btn) => ({
      id: btn.dataset.tabId,
      left: btn.offsetLeft,
      width: btn.offsetWidth,
      center: btn.offsetLeft + btn.offsetWidth / 2,
    }));
  }, []);

  const snapCapsuleTo = useCallback((positions, tabId) => {
    const btn = positions.find((p) => p.id === tabId);
    if (btn) setCapsule({ left: btn.left, width: btn.width });
  }, []);

  useEffect(() => {
    const positions = collectPositions();
    stateRef.current.positions = positions;
    snapCapsuleTo(positions, active);
  }, [active, tabs, collectPositions, snapCapsuleTo]);

  useEffect(() => {
    const onResize = () => {
      const positions = collectPositions();
      stateRef.current.positions = positions;
      snapCapsuleTo(positions, stateRef.current.active);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [collectPositions, snapCapsuleTo]);

  const handlePointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const positions = collectPositions();
    stateRef.current.positions = positions;
    stateRef.current.startX = e.clientX;
    stateRef.current.startLeft = capsule.left;
    stateRef.current.currentLeft = capsule.left;
    stateRef.current.moved = false;
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e) => {
      const dx = e.clientX - stateRef.current.startX;
      if (Math.abs(dx) > 5) stateRef.current.moved = true;

      const positions = stateRef.current.positions;
      if (positions.length === 0) return;

      let newLeft = stateRef.current.startLeft + dx;
      const minLeft = positions[0].left;
      const maxLeft = positions[positions.length - 1].left;
      if (newLeft < minLeft) newLeft = minLeft;
      if (newLeft > maxLeft) newLeft = maxLeft;

      stateRef.current.currentLeft = newLeft;
      setCapsule((prev) => ({ ...prev, left: newLeft }));

      const center = newLeft + stateRef.current.capsuleWidth / 2;
      let nearest = positions[0];
      let minDist = Math.abs(center - nearest.center);
      for (const p of positions) {
        const dist = Math.abs(center - p.center);
        if (dist < minDist) {
          minDist = dist;
          nearest = p;
        }
      }
      setHoveredTab(nearest.id);
    };

    const onUp = () => {
      setDragging(false);

      const positions = stateRef.current.positions;

      if (!stateRef.current.moved) {
        setHoveredTab(null);
        if (positions.length) snapCapsuleTo(positions, stateRef.current.active);
        return;
      }

      skipClickRef.current = true;
      setTimeout(() => { skipClickRef.current = false; }, 80);

      if (positions.length === 0) {
        setHoveredTab(null);
        return;
      }

      const center = stateRef.current.currentLeft + stateRef.current.capsuleWidth / 2;
      let nearest = positions[0];
      let minDist = Math.abs(center - nearest.center);
      for (const p of positions) {
        const dist = Math.abs(center - p.center);
        if (dist < minDist) {
          minDist = dist;
          nearest = p;
        }
      }

      setHoveredTab(null);
      snapCapsuleTo(positions, nearest.id);

      if (nearest.id !== stateRef.current.active) {
        stateRef.current.onChange(nearest.id);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, snapCapsuleTo]);

  const handleClick = (tabId) => {
    if (skipClickRef.current) return;
    if (dragging) return;
    onChange(tabId);
  };

  return (
    <div
      className="tabs"
      ref={containerRef}
      onPointerDown={handlePointerDown}
    >
      <div
        className={`tabs-capsule ${dragging ? 'is-dragging' : ''}`}
        style={{
          left: `${capsule.left}px`,
          width: `${capsule.width}px`,
          transform: `scale(${dragging ? 1.08 : 1})`,
        }}
      />
      {tabs.map((t) => {
        const isVisualActive = dragging ? hoveredTab === t.id : active === t.id;
        return (
          <button
            key={t.id}
            data-tab-id={t.id}
            className={`tab ${isVisualActive ? 'is-active' : ''}`}
            onClick={() => handleClick(t.id)}
          >
            {t.label}
          </button>
        );
      })}
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
  const requestIdRef = useRef(0);

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
      <GlassFilter />
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

        <button className="menu-btn glass-btn" aria-label="Меню" onClick={() => setMenuOpen(true)}>
          <div className="menu-btn-stripes">
            <span></span><span></span><span></span>
          </div>
        </button>

        <button className="fixed-logo glass-btn" onClick={handleLogoClick} aria-label="Обновить ленту">
          <Logo className="logo-icon" />
          <span className="logo-text">связь</span>
        </button>

        <div className="double-btn glass-btn">
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