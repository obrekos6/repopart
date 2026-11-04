import React from 'react';
import Tabs from './Tabs';
import './TabBar.css';

/*
 * Нижняя панель вкладок как Tab Bar в Telegram iOS:
 * стеклянная капсула, ползунок выделения можно тянуть пальцем.
 * Снизу под панелью — мягкое размытие ленты (Scroll Edge Effect, Edge=Bottom).
 */
export default function TabBar({ items, active, onSelect }) {
  const tabs = items.map((it) => ({ id: it.action, label: it.label, icon: it.icon, iconActive: it.iconActive }));
  return (
    <nav className="tabbar-wrap" aria-label="Разделы">
      <Tabs className="tabbar" tabs={tabs} active={active} onChange={onSelect} />
    </nav>
  );
}
