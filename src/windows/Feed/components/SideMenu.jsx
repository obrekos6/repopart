import React, { useEffect } from 'react';

const NAV_ITEMS = [
  { label: 'Лента', icon: '📡' },
  { label: 'Мои посты', icon: '📁' },
  { label: 'Настройки', icon: '⚙️' },
];

export default function SideMenu({ open, onClose }) {
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
}