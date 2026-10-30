import React, { useRef, useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { getProfile } from '../../../lib/profilesCache';
import { ArrowUpIcon } from '../../../assets/icons/Icons';
import Avatar from '../../Feed/components/post/Avatar';
import './Comment.css';

export default function CommentInput({ onSend, disabled, user }) {
  const [text, setText] = useState('');
  const [profile, setProfile] = useState(null);
  const taRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    getProfile(supabase, user.id).then((data) => {
      if (data) setProfile(data);
    });
  }, [user]);

  const autoGrow = (el) => {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const handleSubmit = () => {
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setText('');
    if (taRef.current) {
      taRef.current.style.height = 'auto';
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const fallbackName = user?.email ? user.email.split('@')[0] : 'user';
  const displayName = profile?.username || fallbackName;
  const canSend = !disabled && !!text.trim();

  return (
    <div className="comment-input-wrap">
      <div className="comment-input">
        <div className="comment-input-avatar">
          <Avatar
            url={profile?.avatar_url}
            name={displayName}
            seed={user?.id}
            size={36}
          />
        </div>

        <div className="comment-input-field-wrap">
          <textarea
            ref={taRef}
            className="comment-input-field"
            placeholder="Оставьте комментарий…"
            value={text}
            onChange={(e) => { setText(e.target.value); autoGrow(e.target); }}
            onKeyDown={handleKey}
            rows={1}
            maxLength={1000}
            disabled={disabled}
          />
        </div>

        <button
          type="button"
          className={`comment-input-send ${canSend ? 'is-active' : ''}`}
          onClick={handleSubmit}
          disabled={!canSend}
          aria-label="Отправить"
        >
          <ArrowUpIcon size={22} />
        </button>
      </div>
    </div>
  );
}