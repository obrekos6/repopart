import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import { HeartFilledIcon, EyeIcon, CommentIcon, ArrowRightIcon, DownloadIcon } from '../../../../assets/icons/Icons';
import './PostFooter.css';

const formatNumber = (n) => {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n;
};

const plural = (n, forms) => {
  const d = n % 10, dd = n % 100;
  if (dd >= 11 && dd <= 14) return forms[2];
  if (d === 1) return forms[0];
  if (d >= 2 && d <= 4) return forms[1];
  return forms[2];
};

export default function PostFooter({ 
  views, 
  likes, 
  isLiked, 
  burst, 
  onLike, 
  postId, 
  files = [],
  onOpenComments,
  hasUnreadComments 
}) {
  const [commentCount, setCommentCount] = useState(0);
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

  const handleComments = (e) => {
    e.stopPropagation();
    onOpenComments?.();
  };

  const handleDownload = async (e) => {
    e.stopPropagation();
    const f = files[0]; // скачиваем первый файл
    if (!f) return;
    
    // Используем оригинальное имя файла (с расширением)
    const filename = f.name || 'download';
    
    try {
      const res = await fetch(f.url);
      const blob = await res.blob();
      const a = document.createElement('a');
      const objUrl = URL.createObjectURL(blob);
      a.href = objUrl;
      a.download = filename; // Браузер сохранит с правильным расширением
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
    } catch {
      window.open(f.url, '_blank');
    }
  };

  const commentText = commentCount === 0 
    ? 'Прокомментировать' 
    : `${commentCount} ${plural(commentCount, ['комментарий', 'комментария', 'комментариев'])}`;

  return (
    <div className="post-footer">
      
      <div className="post-stats-row">
        <button
          className={`post-action like-btn ${isLiked ? 'is-liked' : ''} ${burst ? 'is-bursting' : ''}`}
          onClick={(e) => { e.stopPropagation(); onLike?.(); }}
          aria-label="Нравится"
        >
          <div className="like-icon-wrapper">
            <HeartFilledIcon size={20} className="like-icon" />
          </div>
          <span>{formatNumber(likes)}</span>
        </button>

        <div className="post-actions-right">
          <div className="post-action post-views">
            <EyeIcon size={20} />
            <span>{formatNumber(views)}</span>
          </div>

          {files.length > 0 && (
            <button className="post-action post-download-btn" onClick={handleDownload} aria-label="Скачать">
              <DownloadIcon size={20} />
              <span>Скачать</span>
            </button>
          )}
        </div>
      </div>

      <button className="post-comments-btn" onClick={handleComments}>
        <div className="post-comments-left">
          <CommentIcon size={20} />
          <span className="post-comments-text">{commentText}</span>
          {hasUnreadComments && <span className="unread-dot" />}
        </div>
        <div className="post-comments-right">
          <ArrowRightIcon size={16} />
        </div>
      </button>

    </div>
  );
}