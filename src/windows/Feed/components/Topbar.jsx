import React from 'react';
import Logo from '../../../assets/icons/Logo';
import { supabase } from '../../../lib/supabaseClient';

export default function Topbar({ onOpenMenu, onCreate }) {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header className="topbar">
      <div className="topbar-main">
        <div className="topbar-left">
          <button className="menu-btn" aria-label="Меню" onClick={onOpenMenu}>
            <div className="menu-btn-bg"></div>
            <div className="menu-btn-stripes">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </button>
        </div>

        <div className="topbar-logo">
          <Logo className="topbar-logo-icon" />
          <span className="topbar-logo-text">связь</span>
        </div>

        <div className="topbar-right">
          <div className="double-btn">
            <div className="double-btn-bg"></div>
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
              onClick={onCreate}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 1v14M1 8h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}