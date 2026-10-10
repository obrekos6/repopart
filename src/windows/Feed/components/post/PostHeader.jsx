import React from 'react';
import { formatTime } from '../../../../lib/formatTime';
import { VerifiedIcon } from '../../../../assets/icons/Icons';
import Avatar from './Avatar';
import './PostHeader.css';

const VERIFIED_EMAILS = ['obrekos6@gmail.com'];

export default function PostHeader({ author, displayName, createdAt, authorEmail }) {
  const isVerified = authorEmail && VERIFIED_EMAILS.includes(authorEmail);

  return (
    <div className="post-header">
      <Avatar
        url={author?.avatar_url}
        name={displayName}
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
      <button className="post-menu" aria-label="Ещё">
        <span></span><span></span><span></span>
      </button>
    </div>
  );
}