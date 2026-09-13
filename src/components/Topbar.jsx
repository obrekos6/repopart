import React, { useState } from 'react';
import logoUrl from '../assets/icons/logo.svg';
import CreateRepoModal from './Createrepomodal';
import SideMenu from './SideMenu';
import { supabase } from '../lib/supabaseClient';
import './Topbar.css';

const Topbar = ({ onCreatePublication }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar-main">
          <div className="topbar-left">
            <button
              className="icon-btn menu-btn"
              aria-label="Меню"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M1 3h14M1 8h14M1 13h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>

            <div className="logo">
              <img src={logoUrl} alt="RepoPart logo" className="logo-icon" />
              <span className="logo-text">RepoPart</span>
            </div>
          </div>

          <div className="topbar-right">
            <button
              className="icon-btn"
              aria-label="Выйти"
              onClick={handleLogout}
              title="Выйти"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              className="icon-btn create-btn"
              aria-label="Создать репозиторий"
              onClick={() => setModalOpen(true)}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 1v14M1 8h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      {modalOpen && (
        <CreateRepoModal
          onClose={() => setModalOpen(false)}
          onCreate={onCreatePublication}
        />
      )}
    </>
  );
};

export default Topbar;