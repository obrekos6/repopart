import React, { useEffect, useRef } from 'react';
import { useT } from '../../../../lib/i18n';
import { useBackButton } from '../../../../lib/useBackButton';
import { SearchIcon, CloseIcon } from '../../../../assets/icons/Icons';

/*
 * Кнопка поиска в топбаре. По нажатию она плавно растягивается до другого
 * края, остальные кнопки и вкладки растворяются, внутри появляется поле ввода.
 * (Анимация — в FeedScreen.css, классы .topbar.is-searching и .topbar-search.)
 */
export default function TopbarSearch({ open, query, onQueryChange, onOpen, onClose }) {
  const t = useT();
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    // фокус после того, как кнопка начала растягиваться
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [open]);

  useBackButton(onClose, open);

  return (
    <div
      className={`menu-btn topbar-search ${open ? 'is-open' : ''}`}
      role="search"
      onClick={open ? () => inputRef.current?.focus() : onOpen}
    >
      <span className="topbar-search-icon"><SearchIcon size={24} /></span>
      {!open && <button type="button" className="topbar-search-hit" aria-label={t('top.search')} title={t('top.search')} />}
      <input
        ref={inputRef}
        className="topbar-search-input"
        type="search"
        placeholder={t('top.search')}
        value={query}
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
        aria-label={t('top.searchPosts')}
        enterKeyHint="search"
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      />
      {open && (
        <button
          type="button"
          className="topbar-search-close"
          aria-label={t('top.closeSearch')}
          onClick={(e) => { e.stopPropagation(); onClose(); }}
        >
          <CloseIcon size={16} />
        </button>
      )}
    </div>
  );
}
