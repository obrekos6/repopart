import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../../lib/supabaseClient';
import PostHeader from './PostHeader';
import PostMedia from './PostMedia';
import PostFooter from './PostFooter';
import Lightbox from '../media/Lightbox';
import './PostCard.css';

export default function PostCard({ post, currentUser }) {
  const [views, setViews] = useState(post.views || 0);
  const [likes, setLikes] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [burst, setBurst] = useState(false);
  const [preview, setPreview] = useState(null);
  const [author, setAuthor] = useState(null);

  const pendingLikeRef = useRef(false);
  const lastLocalRef = useRef(0);

  useEffect(() => {
    if (!post.user_id) return;
    supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', post.user_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setAuthor(data);
      });
  }, [post.user_id]);

  useEffect(() => {
    const load = async () => {
      if (pendingLikeRef.current) return;
      const { count } = await supabase
        .from('reactions')
        .select('*', { count: 'exact', head: true })
        .eq('repository_id', post.id);
      if (pendingLikeRef.current) return;
      setLikes(count || 0);

      if (currentUser) {
        const { data } = await supabase
          .from('reactions')
          .select('id')
          .eq('repository_id', post.id)
          .eq('user_id', currentUser.id)
          .maybeSingle();
        if (!pendingLikeRef.current) setIsLiked(!!data);
      }
    };
    load();
  }, [post.id, currentUser]);

  useEffect(() => {
    const ch = supabase
      .channel(`post-${post.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'reactions', filter: `repository_id=eq.${post.id}` },
        async () => {
          if (pendingLikeRef.current) return;
          if (Date.now() - lastLocalRef.current < 2000) return;
          const { count } = await supabase
            .from('reactions')
            .select('*', { count: 'exact', head: true })
            .eq('repository_id', post.id);
          setLikes(count || 0);
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'repositories', filter: `id=eq.${post.id}` },
        (p) => setViews(p.new.views || 0))
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [post.id, currentUser]);

  const handleLike = async () => {
    if (!currentUser || pendingLikeRef.current) return;
    pendingLikeRef.current = true;
    lastLocalRef.current = Date.now();

    const wasLiked = isLiked;
    const prevLikes = likes;
    setIsLiked(!wasLiked);
    setLikes(wasLiked ? prevLikes - 1 : prevLikes + 1);

    if (!wasLiked) {
      setBurst(true);
      setTimeout(() => setBurst(false), 600);
    }

    try {
      if (wasLiked) {
        await supabase.from('reactions').delete()
          .eq('repository_id', post.id).eq('user_id', currentUser.id);
      } else {
        await supabase.from('reactions').insert({
          repository_id: post.id,
          user_id: currentUser.id,
          emoji: '❤️',
        });
      }
    } catch {
      setIsLiked(wasLiked);
      setLikes(prevLikes);
    } finally {
      setTimeout(() => { pendingLikeRef.current = false; }, 500);
    }
  };

  const fallbackName = post.author_email ? post.author_email.split('@')[0] : 'user';
  const displayName = author?.username || fallbackName;

  return (
    <>
      <div className="post-card">
        <PostHeader
          author={author}
          displayName={displayName}
          createdAt={post.created_at}
          authorEmail={post.author_email}
        />

        {post.name && <div className="post-text">{post.name}</div>}

        {post.files?.length > 0 && (
          <PostMedia
            files={post.files}
            postName={post.name}
            onPreview={setPreview}
          />
        )}

        <PostFooter
          views={views}
          likes={likes}
          isLiked={isLiked}
          burst={burst}
          onLike={handleLike}
          files={post.files}
        />
      </div>

      {preview && createPortal(
        <Lightbox file={preview} onClose={() => setPreview(null)} />,
        document.body
      )}
    </>
  );
}