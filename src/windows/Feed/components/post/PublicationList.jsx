import React from 'react';
import { useT } from '../../../../lib/i18n';
import PostCard from './PostCard';

export default function PublicationList({
  publications,
  currentUser,
  onOpenPost,
  readOnly = false,
  onRequireAuth,
  onOpenProfile,
}) {
  const t = useT();
  if (publications.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🛰️</div>
        <p className="empty-state-text">{t('feed.emptyTitle')}</p>
        <p className="empty-state-subtext">{t('feed.emptySub')}</p>
      </div>
    );
  }

  return (
    <div className="publication-list">
      {publications.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUser={currentUser}
          onOpen={onOpenPost}
          readOnly={readOnly}
          onRequireAuth={onRequireAuth}
          onOpenProfile={onOpenProfile}
        />
      ))}
    </div>
  );
}