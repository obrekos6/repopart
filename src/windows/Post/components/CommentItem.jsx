import React, { useState, useEffect, useRef } from 'react';
import { useT } from '../../../lib/i18n';
import { supabase } from '../../../lib/supabaseClient';
import { getProfile } from '../../../lib/profilesCache';
import { formatTime } from '../../../lib/formatTime';
import { withAppleEmoji } from '../../../lib/appleEmoji';
import { isAdmin } from '../../../lib/admin';
import Avatar from '../../Feed/components/post/Avatar';
import { TrashIcon, VerifiedIcon } from '../../../assets/icons/Icons';

export default function CommentItem({ comment, currentUser, onDelete, onOpenProfile }) {
  const t = useT();
  const [author, setAuthor] = useState(null);
  const mountedRef = useRef(true);

  const isAuthor = !!(currentUser && comment.user_id === currentUser.id);
  const isTemp = String(comment.id).startsWith('temp-');
  const isVerified = !!author?.is_verified;
  const canDelete = isAuthor || isAdmin(currentUser);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!comment.user_id) return;
    let cancelled = false;
    getProfile(supabase, comment.user_id).then((data) => {
      if (!cancelled && mountedRef.current && data) setAuthor(data);
    });
    return () => { cancelled = true; };
  }, [comment.user_id]);

  const fallback = comment.user_id ? comment.user_id.slice(0, 6) : 'user';
  const displayName = author?.display_name || author?.username || fallback;

  const canOpenProfile = !!(onOpenProfile && comment.user_id);

  const handleDelete = () => {
    if (!window.confirm(t('comments.confirmDelete'))) return;
    onDelete(comment.id);
  };

  const handleOpenProfile = () => {
    if (!canOpenProfile) return;
    onOpenProfile(comment.user_id);
  };

  return (
    <div className={`comment-item ${isTemp ? 'is-temp' : ''}`}>
      <button
        type="button"
        className="comment-item-avatar"
        onClick={handleOpenProfile}
        disabled={!canOpenProfile}
        aria-label={`${t('comments.openProfile')} ${displayName}`}
      >
        <Avatar
          url={author?.avatar_url}
          name={displayName}
          seed={comment.user_id}
          size={36}
        />
      </button>
      <div className="comment-body">
        <div className="comment-head">
          <button
            type="button"
            className="comment-author"
            onClick={handleOpenProfile}
            disabled={!canOpenProfile}
          >
            {displayName}
          </button>
          {isVerified && <VerifiedIcon size={14} className="comment-verified" />}
          <span className="comment-time">{formatTime(comment.created_at)}</span>
        </div>
        <div className="comment-text">{withAppleEmoji(comment.content)}</div>
      </div>
      {canDelete && !isTemp && (
        <button className="comment-delete" onClick={handleDelete} aria-label={t('comments.delete')}>
          <TrashIcon size={16} />
        </button>
      )}
    </div>
  );
}