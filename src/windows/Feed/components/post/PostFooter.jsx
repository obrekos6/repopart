import React, { useState, useEffect, useRef } from 'react';
import { useT } from '../../../../lib/i18n';
import { supabase } from '../../../../lib/supabaseClient';
import { getProfile } from '../../../../lib/profilesCache';
import { EyeIcon, CommentIcon, ArrowRightIcon, DownloadIcon } from '../../../../assets/icons/Icons';
import Avatar from './Avatar';
import { AppleEmoji } from '../../../../lib/appleEmoji';
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
  time,
  inlineMeta = false,
  hideMeta = false,
  author = '',
  reacts = {},
  myEmoji,
  burst, 
  onReact,
  postId, 
  files = [],
  onOpenComments,
  hasUnreadComments 
}) {
  const t = useT();
  const [commentCount, setCommentCount] = useState(0);
  const [recentCommenters, setRecentCommenters] = useState([]);
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
    supabase
      .from('comments')
      .select('user_id')
      .eq('repository_id', postId)
      .order('created_at', { ascending: false })
      .limit(3)
      .then(async ({ data }) => {
        if (!data) return;
        const uniqueIds = [...new Set(data.map(c => c.user_id))].slice(0, 3);
        const profiles = await Promise.all(uniqueIds.map(id => getProfile(supabase, id)));
        setRecentCommenters(profiles.filter(Boolean));
      });
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
          
          const { data } = await supabase
            .from('comments')
            .select('user_id')
            .eq('repository_id', postId)
            .order('created_at', { ascending: false })
            .limit(3);
          if (data) {
            const uniqueIds = [...new Set(data.map(c => c.user_id))].slice(0, 3);
            const profiles = await Promise.all(uniqueIds.map(id => getProfile(supabase, id)));
            setRecentCommenters(profiles.filter(Boolean));
          }
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
    const f = files[0];
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

  const commentText = commentCount === 0 
    ? t('post.comment') 
    : t('post.comments', { n: commentCount });

  const hasCommenters = recentCommenters.length > 0;

  return (
    <div className="post-footer">
      
      {/* реакции капсулами слева, просмотры мелко справа — как в постах каналов iOS */}
      <div className={`post-stats-row ${inlineMeta ? 'is-inline' : ''} ${hideMeta && !Object.keys(reacts).length ? 'is-empty' : ''}`}>
        {/* реакции появляются плавно: высота растёт от нуля */}
        <div className={`post-reactions-wrap ${Object.keys(reacts).length ? 'is-shown' : ''}`}>
          <div className="post-reactions">
            {Object.entries(reacts)
              .sort((a, b) => b[1] - a[1])
              .map(([emoji, n]) => (
                <button
                  key={emoji}
                  className={`post-reaction ${myEmoji === emoji ? 'is-mine' : ''} ${burst && myEmoji === emoji ? 'is-bursting' : ''}`}
                  onClick={(e) => { e.stopPropagation(); onReact?.(emoji); }}
                >
                  <span className="post-reaction-emoji"><AppleEmoji emoji={emoji} /></span>
                  <span>{formatNumber(n)}</span>
                </button>
              ))}
          </div>
        </div>

        {!hideMeta && <div className="post-meta">
          {/* сначала дата, потом просмотры: иначе «10 пт в 23:00» читалось как дата */}
          {author && <span className="post-meta-author">{author}</span>}
          {time && <span className="post-meta-time">{time}</span>}
          <span className="post-meta-views"><EyeIcon size={15} /><span>{formatNumber(views)}</span></span>
        </div>}
      </div>

      <button className="post-comments-btn" onClick={handleComments}>
        <div className="post-comments-left">
          {hasCommenters ? (
            <div className="post-commenters-avatars">
              {recentCommenters.map((p, i) => (
                <div key={i} className="post-commenter-avatar">
                  <Avatar
                    url={p.avatar_url}
                    name={p.display_name || p.username}
                    seed={p.id}
                    size={26}
                  />
                </div>
              ))}
            </div>
          ) : (
            <span className="post-comments-icon"><CommentIcon size={24} /></span>
          )}
          <span className="post-comments-text">{commentText}</span>
          {hasUnreadComments && <span className="unread-dot" />}
        </div>
        <div className="post-comments-right">
          <ArrowRightIcon size={18} />
        </div>
      </button>

    </div>
  );
}