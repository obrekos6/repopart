import React, { useEffect } from 'react';
import './SideMenu.css';

export default function SideMenu({ open, onClose, items = [], onItemClick }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div className={`side-menu-overlay ${open ? 'is-open' : ''}`} onClick={onClose} />
      <nav className={`side-menu ${open ? 'is-open' : ''}`}>
        <ul className="side-menu-list">
          {items.map((item) => (
            <li key={item.label}>
              <button
                className="side-menu-item"
                onClick={() => onItemClick?.(item.action)}
              >
                <span className="side-menu-icon">{item.icon}</span>
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}