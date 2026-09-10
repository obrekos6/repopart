import React, { useState } from 'react';
import logoUrl from '../assets/icons/logo.svg';
import CreateRepoModal from './Createrepomodal';
import SideMenu from './SideMenu';
import './Topbar.css';

const Topbar = ({ onCreatePublication }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleOpenCreateModal = () => {
    const userPassword = prompt("Введите пароль для создания репозитория:");
    if (!userPassword) return;

    if (userPassword === import.meta.env.VITE_MASTER_PASSWORD) {
      setModalOpen(true);
    } else {
      alert("Неверный пароль!");
    }
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
              className="icon-btn create-btn"
              aria-label="Создать репозиторий"
              onClick={handleOpenCreateModal}
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