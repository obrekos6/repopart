import React from 'react';
import { useT } from '../../../../lib/i18n';
import PostCard from './PostCard';
import AdCard from '../ads/AdCard';
import { AD_EVERY } from '../../../../lib/ads';

export default function PublicationList({
  publications,
  currentUser,
  onOpenPost,
  readOnly = false,
  onRequireAuth,
  onOpenProfile,
  onOpenParts,
  withAds = false,
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
      {publications.map((post, i) => (
        <React.Fragment key={post.id}>
        <PostCard
          key={post.id}
          post={post}
          currentUser={currentUser}
          onOpen={onOpenPost}
          readOnly={readOnly}
          onRequireAuth={onRequireAuth}
          onOpenProfile={onOpenProfile}
          onOpenParts={onOpenParts}
        />
        {/* реклама после каждого AD_EVERY-го поста */}
        {withAds && (i + 1) % AD_EVERY === 0 && <AdCard slot={(i + 1) / AD_EVERY - 1} />}
        </React.Fragment>
      ))}
    </div>
  );
}