import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Logo from '../../assets/icons/Logo';
import SideMenu from './components/SideMenu';
import CreateRepoModal from './components/CreateRepoModal';
import PublicationList from './components/PublicationList';
import './FeedScreen.css';

const POSTS_PER_PAGE = 10;

// Переключатель LiquidGlass. Сейчас false — используется CSS-стекло.
// Весь код LiquidGlass сохранён и готов к включению.
const LIQUID_GLASS_ENABLED = false;

const GLASS_CONFIGS = {
  light: {
    blurAmount: 0,
    brightness: -0.08,
    saturation: 0.05,
    tintStrength: 0.25,
    refraction: 2,
    opacity: 1,
    edgeHighlight: 0.18,
    shadowOpacity: 0.35,
  },
  dark: {
    blurAmount: 0,
    brightness: -0.35,
    saturation: -0.05,
    tintStrength: 0.55,
    refraction: 2,
    opacity: 1,
    edgeHighlight: 0.15,
    shadowOpacity: 0.45,
  },
};

export default function FeedScreen() {
  const [publications, setPublications] = useState([]);
  const [visibleCount, setVisibleCount] = useState(POSTS_PER_PAGE);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [glassReady, setGlassReady] = useState(false);

  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= 1024
  );

  const sentinelRef = useRef(null);
  const rootRef = useRef(null);
  const menuBtnRef = useRef(null);
  const doubleBtnRef = useRef(null);
  const logoRef = useRef(null);
  const glassInstance = useRef(null);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Загрузка постов + realtime
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('repositories')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) setPublications(data);
    };
    load();

    const channel = supabase
      .channel('repositories-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'repositories' },
        (payload) => {
          setPublications((prev) => [payload.new, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'repositories' },
        (payload) => {
          setPublications((prev) => prev.filter((p) => p.id !== payload.old.id));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'repositories' },
        (payload) => {
          setPublications((prev) =>
            prev.map((p) => (p.id === payload.new.id ? payload.new : p))
          );
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const getTheme = () =>
    window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';

  const applyGlassConfig = useCallback((theme) => {
    const config = GLASS_CONFIGS[theme] || GLASS_CONFIGS.dark;
    const configStr = JSON.stringify(config);
    if (menuBtnRef.current) menuBtnRef.current.dataset.config = configStr;
    if (doubleBtnRef.current) doubleBtnRef.current.dataset.config = configStr;
    if (logoRef.current) logoRef.current.dataset.config = configStr;
  }, []);

  // Init LiquidGlass (отключено флагом)
  useEffect(() => {
    if (!LIQUID_GLASS_ENABLED) return;
    if (!isMobile) return;
    if (publications.length === 0) return;

    let cancelled = false;
    let localInstance = null;
    let retryTimer = null;

    const initGlass = async () => {
      if (cancelled) return;
      if (!window.LiquidGlass) {
        retryTimer = setTimeout(initGlass, 50);
        return;
      }
      if (!rootRef.current || !menuBtnRef.current || !doubleBtnRef.current || !logoRef.current) {
        retryTimer = setTimeout(initGlass, 50);
        return;
      }

      const theme = getTheme();
      applyGlassConfig(theme);

      try {
        localInstance = await window.LiquidGlass.init({
          root: rootRef.current,
          glassElements: [menuBtnRef.current, doubleBtnRef.current, logoRef.current],
          defaults: {
            cornerRadius: 22,
            zRadius: 18,
            ...GLASS_CONFIGS[theme],
            chromAberration: 0.06,
            specular: 0.4,
            fresnel: 0.9,
            shadowSpread: 12,
            button: true,
          },
        });
        if (cancelled) {
          try { localInstance.destroy(); } catch (e) {}
          return;
        }
        glassInstance.current = localInstance;
        setGlassReady(true);
      } catch (err) {
        console.error('[LiquidGlass] init failed:', err);
      }
    };

    let raf1, raf2;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (typeof window.requestIdleCallback === 'function') {
          window.requestIdleCallback(initGlass, { timeout: 500 });
        } else {
          initGlass();
        }
      });
    });

    return () => {
      cancelled = true;
      if (raf1) cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      if (retryTimer) clearTimeout(retryTimer);
      if (localInstance) {
        try { localInstance.destroy(); } catch (e) {}
      }
      glassInstance.current = null;
      setGlassReady(false);
    };
  }, [isMobile, publications.length, applyGlassConfig]);

  // Смена темы
  useEffect(() => {
    if (!LIQUID_GLASS_ENABLED) return;
    if (!isMobile || !glassReady) return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => applyGlassConfig(getTheme());
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [isMobile, glassReady, applyGlassConfig]);

  // markChanged при изменении данных
  useEffect(() => {
    if (!LIQUID_GLASS_ENABLED) return;
    if (glassInstance.current?.markChanged) glassInstance.current.markChanged();
  }, [publications, visibleCount]);

  // markChanged при скролле с защитой от перекрытия кадров
  useEffect(() => {
    if (!LIQUID_GLASS_ENABLED) return;
    if (!isMobile || !glassReady) return;

    let rafId = null;
    let inFlight = false;

    const handleScroll = () => {
      if (inFlight || rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (inFlight) return;
        inFlight = true;
        try {
          if (glassInstance.current?.markChanged) {
            glassInstance.current.markChanged();
          }
        } finally {
          requestAnimationFrame(() => {
            inFlight = false;
          });
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isMobile, glassReady]);

  // Бесконечный скролл
  useEffect(() => {
    if (!sentinelRef.current) return;
    if (publications.length <= visibleCount) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + POSTS_PER_PAGE);
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [publications.length, visibleCount]);

  const visiblePublications = publications.slice(0, visibleCount);
  const hasMore = publications.length > visibleCount;

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const useGlass = LIQUID_GLASS_ENABLED && isMobile && glassReady;
  const menuClass = `menu-btn${useGlass ? ' glass-el' : ''}`;
  const doubleClass = `double-btn${useGlass ? ' glass-el' : ''}`;
  const logoClass = `fixed-logo${useGlass ? ' glass-el' : ''}`;

  return (
    <>
      <div className="app" ref={rootRef}>
        <div className="app-bg" />

        <main className="main-content">
          <section className="interests-section">
            <h2 className="section-title">Вот что у нас для вас есть...</h2>
            <PublicationList publications={visiblePublications} />
            {hasMore && <div ref={sentinelRef} className="load-more-sentinel" />}
          </section>
        </main>

        <div ref={logoRef} className={logoClass}>
          <Logo className="topbar-logo-icon" />
          <span className="topbar-logo-text">связь</span>
        </div>

        <button
          ref={menuBtnRef}
          className={menuClass}
          aria-label="Меню"
          onClick={() => setMenuOpen(true)}
        >
          <div className="menu-btn-stripes">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </button>

        <div ref={doubleBtnRef} className={doubleClass}>
          <button
            className="double-btn-item"
            aria-label="Выйти"
            onClick={handleLogout}
            title="Выйти"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            className="double-btn-item"
            aria-label="Создать публикацию"
            onClick={() => setModalOpen(true)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 1v14M1 8h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
      {modalOpen && (
        <CreateRepoModal onClose={() => setModalOpen(false)} onCreate={() => {}} />
      )}
    </>
  );
}