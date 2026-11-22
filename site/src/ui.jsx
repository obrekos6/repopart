import React from 'react';

/* Иконки из макета — тонкие контурные */
const svg = (d, extra) => ({ size = 22, sw = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}{extra}</svg>
);
export const IconFeed = svg(<><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M8 9h8M8 13h8M8 17h5" /></>);
export const IconChats = svg(<path d="M20 11.5a7.5 7.5 0 0 1-11 6.6L4 19.5l1.4-4.6A7.5 7.5 0 1 1 20 11.5z" />);
export const IconSettings = svg(<><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></>);
export const IconProfile = svg(<><circle cx="12" cy="8" r="4" /><path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" /></>);
export const IconPlus = svg(<path d="M12 5v14M5 12h14" />);
export const IconSearch = svg(<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>);
export const IconHeart = svg(<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />);
export const IconShare = svg(<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v12M7 8l5-5 5 5" />);
export const IconUp = svg(<path d="M12 19V5M5 12l7-7 7 7" />);
export const IconBack = svg(<path d="M15 5l-7 7 7 7" />);

export function Dots() {
  return (
    <span style={{ display: 'flex', gap: 4 }} aria-hidden="true">
      {[0, 1, 2].map((i) => <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor' }} />)}
    </span>
  );
}

/** Аватар в кольце, как в макете */
export function Avatar({ who, size = 44, pad = 3, font }) {
  return (
    <span className="ava" style={{ width: size, height: size, padding: pad }}>
      <span style={{ background: who.color, fontSize: font ?? Math.round(size * 0.37) }}>{who.initial}</span>
    </span>
  );
}

export const TABS = [
  { id: 'feed', label: 'Лента', Icon: IconFeed },
  { id: 'chats', label: 'Чаты', Icon: IconChats },
  { id: 'settings', label: 'Настройки', Icon: IconSettings },
  { id: 'profile', label: 'Профиль', Icon: IconProfile },
];

export function Post({ post, liked, onLike, compactShare = true }) {
  return (
    <article className="post">
      <div className="post-head">
        <Avatar who={post} />
        <span className="post-who"><b>{post.name}</b><small>{post.time}</small></span>
      </div>
      <p>{post.text}</p>
      <div className="post-actions">
        <button className={`chip press ${liked ? 'on' : ''}`} aria-label="Нравится" aria-pressed={liked} onClick={onLike}>
          <IconHeart size={16} sw={2.2} />{post.likes + (liked ? 1 : 0)}
        </button>
        <button className="chip press" aria-label="Комментарии"><IconChats size={16} sw={2.2} />{post.comments}</button>
        {compactShare && <button className="chip round press" aria-label="Поделиться"><IconShare size={16} sw={2.2} /></button>}
      </div>
    </article>
  );
}
