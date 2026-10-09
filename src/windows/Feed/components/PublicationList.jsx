import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import PostCard from './PostCard';

export default function PublicationList({ publications }) {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user));
  }, []);

  if (publications.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🛰️</div>
        <p className="empty-state-text">Тут тихо... подозрительно тихо.</p>
        <p className="empty-state-subtext">
          Показывать пока нечего — загляните позже, когда появятся посты.
        </p>
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
        />
      ))}
    </div>
  );
}