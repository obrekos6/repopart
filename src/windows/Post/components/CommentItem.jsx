import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { getProfile } from '../../../lib/profilesCache';
import { formatTime } from '../../../lib/formatTime';
import Avatar from '../../Feed/components/post/Avatar';
import { TrashIcon, VerifiedIcon } from '../../../assets/icons/Icons';

const VERIFIED_EMAILS = ['obrekos6@gmail.com'];

export default function CommentItem({ comment, currentUser, onDelete }) {
  const [author, setAuthor] = useState(null);
  const mountedRef = useRef(true);

  const isAuthor = !!(currentUser && comment.user_id === currentUser.id);
  const isTemp = String(comment.id).startsWith('temp-');
  const isVerified = !!(comment.author_email && VERIFIED_EMAILS.includes(comment.author_email));

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
  const displayName = author?.username || fallback;

  const handleDelete = () => {
    if (!window.confirm('Удалить комментарий?')) return;
    onDelete(comment.id);
  };

  return (
    <div className={`comment-item ${isTemp ? 'is-temp' : ''}`}>
      <div className="comment-item-avatar">
        <Avatar
          url={author?.avatar_url}
          name={displayName}
          seed={comment.user_id}
          size={36}
        />
      </div>
      <div className="comment-body">
        <div className="comment-head">
          <span className="comment-author">{displayName}</span>
          {isVerified && <VerifiedIcon size={14} className="comment-verified" />}
          <span className="comment-time">{formatTime(comment.created_at)}</span>
        </div>
        <div className="comment-text">{comment.content}</div>
      </div>
      {isAuthor && !isTemp && (
        <button className="comment-delete" onClick={handleDelete} aria-label="Удалить">
          <TrashIcon size={16} />
        </button>
      )}
    </div>
  );
}