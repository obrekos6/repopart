import React, { useEffect, useState, useCallback } from 'react';
import { useT } from '../../lib/i18n';
import { supabase } from '../../lib/supabaseClient';
import Page from '../Feed/components/layout/Page';
import Avatar from '../Feed/components/post/Avatar';
import { getProfile } from '../../lib/profilesCache';
import { ArrowRightIcon } from '../../assets/icons/Icons';
import CommentList from './components/CommentList';
import CommentInput from './components/CommentInput';
import './PostDetailScreen.css';

export default function PostDetailScreen({ post, currentUser, onClose, onOpenProfile, zIndex = 250 }) {
  const t = useT();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  // автор поста — для круглой кнопки справа
  const [author, setAuthor] = useState(null);
  useEffect(() => {
    let alive = true;
    if (post.user_id) getProfile(supabase, post.user_id).then((p) => { if (alive && p) setAuthor(p); });
    return () => { alive = false; };
  }, [post.user_id]);
  const authorName = author?.display_name || author?.username || (post.author_email ? post.author_email.split('@')[0] : 'user');

  // профиль открывается вместо комментариев (иначе он оказался бы под этим окном)
  const openProfile = (id) => { onOpenProfile?.(id); onClose(); };

  /* load comments */
  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('repository_id', post.id)
      .order('created_at', { ascending: false });
    if (!error) setComments(data || []);
    setLoading(false);
  }, [post.id]);

  useEffect(() => { load(); }, [load]);

  /* realtime */
  useEffect(() => {
    const ch = supabase
      .channel(`comments-${post.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments', filter: `repository_id=eq.${post.id}` },
        (p) => setComments((prev) => {
          const tempIdx = prev.findIndex(
            (c) => String(c.id).startsWith('temp-') && c.user_id === p.new.user_id
          );
          if (tempIdx >= 0) {
            const copy = [...prev];
            copy[tempIdx] = p.new;
            return copy;
          }
          if (prev.some((c) => c.id === p.new.id)) return prev;
          return [p.new, ...prev];
        }))
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'comments', filter: `repository_id=eq.${post.id}` },
        (p) => setComments((prev) => prev.filter((c) => c.id !== p.old.id)))
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [post.id]);

  /* ---------- send ---------- */
  const handleSend = async (text) => {
    if (!currentUser || !text.trim()) return;
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      repository_id: post.id,
      user_id: currentUser.id,
      content: text.trim(),
      created_at: new Date().toISOString(),
    };
    setComments((prev) => [optimistic, ...prev]);

    const { data, error } = await supabase
      .from('comments')
      .insert({
        repository_id: post.id,
        user_id: currentUser.id,
        content: text.trim(),
      })
      .select()
      .single();

    if (error) {
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      alert(t('comments.sendFail') + error.message);
      return;
    }

    setComments((prev) => prev.map((c) => (c.id === tempId ? data : c)));
  };

  const handleDeleteComment = async (id) => {
    setComments((prev) => prev.filter((c) => c.id !== id));
    const { error } = await supabase.from('comments').delete().eq('id', id);
    if (error) {
      load();
      alert(t('comments.deleteFail') + error.message);
    }
  };

  // отдельное окно: въезжает справа, как экраны в iOS (блокировку прокрутки и «назад» делает Page)
  return (
    <Page
      title={t('comments.title')}
      onClose={onClose}
      zIndex={zIndex}
      parallax
      titleCapsule
      backIcon={<ArrowRightIcon size={22} className="app-page-back-chevron" />}
      right={(
        <button type="button" className="sheet-btn app-page-btn post-comments-author" onClick={() => openProfile(post.user_id)} aria-label={authorName}>
          <Avatar url={author?.avatar_url} name={authorName} seed={post.user_id} size={40} />
        </button>
      )}
      className="post-comments-page"
      footer={<CommentInput onSend={handleSend} disabled={!currentUser} user={currentUser} />}
    >
      {loading ? null : comments.length === 0 ? (
        <div className="post-detail-empty">{t('comments.empty')}</div>
      ) : (
        <CommentList
          comments={comments}
          currentUser={currentUser}
          onDelete={handleDeleteComment}
          onOpenProfile={openProfile}
        />
      )}
    </Page>
  );
}
