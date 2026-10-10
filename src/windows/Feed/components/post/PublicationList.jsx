import React from 'react';
import PostCard from './PostCard';

export default function PublicationList({ publications, currentUser }) {
  if (publications.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🛰️</div>
        <p className="empty-state-text">Тут тихо...</p>
        <p className="empty-state-subtext">Загляните позже</p>
      </div>
    );
  }

  return (
    <div className="publication-list">
      {publications.map((post) => (
        <PostCard key={post.id} post={post} currentUser={currentUser} />
      ))}
    </div>
  );
}