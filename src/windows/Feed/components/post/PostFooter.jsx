import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import { HeartIcon, HeartFilledIcon, DownloadIcon, EyeIcon, CommentIcon } from '../../../../assets/icons/Icons';
import './PostFooter.css';

const formatNumber = (n) => {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n;
};

export default function PostFooter({ views, likes, isLiked, burst, onLike, files = [], postId, onOpenComments }) {
  const [slide] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  /* уникальный id инстанса — чтобы каналы не конфликтовали */
  const instanceIdRef = useRef(Math.random().toString(36).slice(2, 9));

  useEffect(() => {
    if (!postId) return;
    supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('repository_id', postId)
      .then(({ count }) => setCommentCount(count || 0));
  }, [postId]);

  useEffect(() => {
    if (!postId) return;
    const uid = instanceIdRef.current;
    const ch = supabase
      .channel(`comment-count-${postId}-${uid}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'comments', filter: `repository_id=eq.${postId}` },
        async () => {
          const { count } = await supabase
            .from('comments')
            .select('*', { count: 'exact', head: true })
            .eq('repository_id', postId);
          setCommentCount(count || 0);
        })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [postId]);

  const handleDownload = async (e) => {
    e.stopPropagation();
    const f = files[slide] || files[0];
    if (!f) return;
    const filename = f.name || 'download';
    try {
      const res = await fetch(f.url);
      const blob = await res.blob();
      const a = document.createElement('a');
      const objUrl = URL.createObjectURL(blob);
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
    } catch {
      window.open(f.url, '_blank');
    }
  };

  const handleComments = (e) => {
    e.stopPropagation();
    onOpenComments?.();
  };

  return (
    <div className="post-footer">
      <button
        className={`post-action like-btn ${isLiked ? 'is-liked' : ''} ${burst ? 'is-bursting' : ''}`}
        onClick={(e) => { e.stopPropagation(); onLike?.(); }}
        aria-label="Нравится"
      >
        <div className="like-icon-wrapper">
          {isLiked ? <HeartFilledIcon size={20} className="like-icon" /> : <HeartIcon size={20} className="like-icon" />}
        </div>
        <span>{formatNumber(likes)}</span>
      </button>

      <button className="post-action comment-btn" onClick={handleComments} aria-label="Комментарии">
        <CommentIcon size={20} />
        <span>{formatNumber(commentCount)}</span>
      </button>

      <div className="post-action post-views">
        <EyeIcon size={20} />
        <span>{formatNumber(views)}</span>
      </div>

      <button className="post-action post-download-btn" onClick={handleDownload} aria-label="Скачать">
        <DownloadIcon size={20} />
        <span>Скачать</span>
      </button>
    </div>
  );
}