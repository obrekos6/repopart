import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';

const EMOJI_OPTIONS = ['❤️', '😭', '👍', '😡', '🤔', '😂', '🔥', '💀', '😯'];

export default function ReactionPicker({
  pubId, myEmoji, groupedEmojis, currentUser, onReactionChange,
}) {
  const [openPickerId, setOpenPickerId] = useState(null);
  const pickerRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setOpenPickerId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleReaction = async (emoji) => {
    if (!currentUser) return;

    if (myEmoji === emoji) {
      await supabase.from('reactions').delete()
        .eq('repository_id', pubId).eq('user_id', currentUser.id);
    } else {
      await supabase.from('reactions').upsert(
        { repository_id: pubId, user_id: currentUser.id, emoji },
        { onConflict: 'repository_id,user_id' }
      );
    }
    setOpenPickerId(null);
    onReactionChange();
  };

  return (
    <div className="pub-reactions">
      {Object.entries(groupedEmojis).map(([emoji, count]) => (
        <span
          key={emoji}
          className={`reaction-display ${myEmoji === emoji ? 'is-mine' : ''}`}
        >
          {emoji} {count > 0 && count}
        </span>
      ))}

      <div className="reaction-picker-wrap" ref={openPickerId === pubId ? pickerRef : null}>
        <button
          className="reaction-add-btn"
          onClick={() => setOpenPickerId(openPickerId === pubId ? null : pubId)}
        >
          +
        </button>
        {openPickerId === pubId && (
          <div className="reaction-picker">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                className={`reaction-option ${myEmoji === emoji ? 'is-mine' : ''}`}
                onClick={() => handleReaction(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}