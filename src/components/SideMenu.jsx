import React, { useEffect } from 'react';
import './SideMenu.css';

const NAV_ITEMS = [
  { label: 'Репозитории', icon: '📁' },
  { label: 'Избранное', icon: '⭐' },
  { label: 'Настройки', icon: '⚙️' },
];

const SideMenu = ({ open, onClose }) => {
  // Esc закрывает панель
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  return (
    <>
      <div
        className={`side-menu-overlay ${open ? 'is-open' : ''}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <nav className={`side-menu ${open ? 'is-open' : ''}`} aria-hidden={!open}>
        <ul className="side-menu-list">
          {NAV_ITEMS.map((item) => (
            <li key={item.label}>
              <button className="side-menu-item">
                <span className="side-menu-icon" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
};

export default SideMenu;