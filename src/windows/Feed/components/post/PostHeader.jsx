import React from 'react';
import { formatTime } from '../../../../lib/formatTime';
import { VerifiedIcon } from '../../../../assets/icons/Icons';
import Avatar from './Avatar';
import './PostHeader.css';

export default function PostHeader({ author, userId, displayName, createdAt, onOpenProfile, bubble = false }) {
  const isVerified = !!author?.is_verified;

  const handleClick = (e) => {
    e.stopPropagation();
    if (onOpenProfile) onOpenProfile(userId);
  };

  // в пузыре поста: только имя жирным (аватар снаружи, время внизу)
  if (bubble) {
    return (
      <div className="post-header is-bubble" onClick={handleClick} style={{ cursor: onOpenProfile ? 'pointer' : 'default' }}>
        <span className="post-author">{displayName}</span>
        {isVerified && <VerifiedIcon size={15} className="post-verified" />}
      </div>
    );
  }

  return (
    <div className="post-header" onClick={handleClick} style={{ cursor: onOpenProfile ? 'pointer' : 'default' }}>
      <Avatar
        url={author?.avatar_url}
        name={displayName}
        seed={userId}
        size={40}
      />
      <div className="post-header-info">
        <div className="post-author-row">
          <span className="post-author">{displayName}</span>
          {isVerified && (
            <VerifiedIcon size={16} className="post-verified" />
          )}
        </div>
        <div className="post-time">{formatTime(createdAt)}</div>
      </div>
    </div>
  );
}