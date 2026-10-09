import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Logo from '../../assets/icons/Logo';
import SideMenu from './components/SideMenu';
import CreateRepoModal from './components/CreateRepoModal';
import PublicationList from './components/PublicationList';
import './FeedScreen.css';

const POSTS_PER_PAGE = 10;

export default function FeedScreen() {
  const [publications, setPublications] = useState([]);
  const [visibleCount, setVisibleCount] = useState(POSTS_PER_PAGE);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const sentinelRef = useRef(null);

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

  return (
    <>
      <div className="app">
        <div className="app-bg" />

        {/* ЕДИНЫЙ HEADER — все три кнопки в одной сетке */}
        <header className="header">
          <button
            className="menu-btn"
            aria-label="Меню"
            onClick={() => setMenuOpen(true)}
          >
            <div className="menu-btn-stripes">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </button>

          <div className="fixed-logo">
            <Logo className="topbar-logo-icon" />
            <span className="topbar-logo-text">связь</span>
          </div>

          <div className="double-btn">
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
        </header>

        <main className="main-content">
          <section className="interests-section">
            <h2 className="section-title">Вот что у нас для вас есть...</h2>
            <PublicationList publications={visiblePublications} />
            {hasMore && <div ref={sentinelRef} className="load-more-sentinel" />}
          </section>
        </main>

        <div className="top-blur-overlay" aria-hidden="true" />
        <div className="bottom-blur-overlay" aria-hidden="true" />
      </div>

      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
      {modalOpen && (
        <CreateRepoModal onClose={() => setModalOpen(false)} onCreate={() => {}} />
      )}
    </>
  );
}