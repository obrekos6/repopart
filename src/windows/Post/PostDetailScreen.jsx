import React, { useEffect, useState, useRef, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabaseClient';
import { useBackButton } from '../../lib/useBackButton';
import CommentList from './components/CommentList';
import CommentInput from './components/CommentInput';
import './PostDetailScreen.css';

export default function PostDetailScreen({ post, currentUser, onClose, onOpenProfile, zIndex = 250 }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  const dragRef = useRef({
    startY: 0,
    currentY: 0,
    active: false,
    pointerId: null,
    lastY: 0,
    lastT: 0,
    velocity: 0,
  });
  const panelRef = useRef(null);
  const handleZoneRef = useRef(null);

  const mediaFiles = (post.files || []).filter(
    (f) => f.type?.startsWith('image/') || f.type?.startsWith('video/')
  );
  const hasMedia = mediaFiles.length > 0;
  const firstMedia = mediaFiles[0];

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

  /* lock body scroll */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  /* esc */
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* slide up */
  useLayoutEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
  }, []);

  const handleClose = () => {
    if (closing) return;
    setClosing(true);
    setVisible(false);
    setDragging(false);
    setDragOffset(0);
    setTimeout(() => onClose(), 320);
  };

  /* android back button closes */
  useBackButton(handleClose, true);

  /* ---------- drag to close ---------- */
  const handleDragStart = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragRef.current.active = true;
    dragRef.current.startY = e.clientY;
    dragRef.current.currentY = e.clientY;
    dragRef.current.lastY = e.clientY;
    dragRef.current.lastT = performance.now();
    dragRef.current.velocity = 0;
    dragRef.current.pointerId = e.pointerId;

    setDragging(true);
    try { handleZoneRef.current?.setPointerCapture(e.pointerId); } catch {}
  };

  const handleDragMove = (e) => {
    if (!dragRef.current.active) return;
    if (e.pointerId !== dragRef.current.pointerId) return;

    const now = performance.now();
    const dt = now - dragRef.current.lastT;
    const dy = e.clientY - dragRef.current.lastY;
    if (dt > 0) {
      dragRef.current.velocity = dy / dt;
    }
    dragRef.current.lastY = e.clientY;
    dragRef.current.lastT = now;
    dragRef.current.currentY = e.clientY;

    const totalDy = e.clientY - dragRef.current.startY;
    if (totalDy < 0) {
      setDragOffset(0);
      return;
    }
    setDragOffset(totalDy);
  };

  const handleDragEnd = (e) => {
    if (!dragRef.current.active) return;
    if (e.pointerId !== dragRef.current.pointerId) return;

    try { handleZoneRef.current?.releasePointerCapture(e.pointerId); } catch {}
    dragRef.current.active = false;
    setDragging(false);

    const totalDy = dragRef.current.currentY - dragRef.current.startY;
    const v = dragRef.current.velocity;

    if (totalDy > 60 || v > 0.4) {
      handleClose();
    } else {
      setDragOffset(0);
    }
  };

  /* ---------- send ---------- */
  const handleSend = async (text) => {
    if (!currentUser || !text.trim()) return;
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      repository_id: post.id,
      user_id: currentUser.id,
      author_email: currentUser.email,
      content: text.trim(),
      created_at: new Date().toISOString(),
    };
    setComments((prev) => [optimistic, ...prev]);

    const { data, error } = await supabase
      .from('comments')
      .insert({
        repository_id: post.id,
        user_id: currentUser.id,
        author_email: currentUser.email,
        content: text.trim(),
      })
      .select()
      .single();

    if (error) {
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      alert('Не удалось отправить: ' + error.message);
      return;
    }

    setComments((prev) => prev.map((c) => (c.id === tempId ? data : c)));
  };

  const handleDeleteComment = async (id) => {
    setComments((prev) => prev.filter((c) => c.id !== id));
    const { error } = await supabase.from('comments').delete().eq('id', id);
    if (error) {
      load();
      alert('Не удалось удалить: ' + error.message);
    }
  };

  const panelStyle = dragging
    ? { transform: `translateY(${dragOffset}px)`, transition: 'none' }
    : undefined;

  return createPortal(
    <div className={`post-detail-root ${visible ? 'is-on' : ''}`} style={{ zIndex }}>
      <div className="post-detail-backdrop" onClick={handleClose} />

      <div
        ref={panelRef}
        className={`post-detail-panel ${hasMedia ? '' : 'is-solo'}`}
        style={panelStyle}
      >
        {hasMedia && firstMedia && (
          <div className="post-detail-media">
            {firstMedia.type.startsWith('video/') ? (
              <video src={firstMedia.url} autoPlay muted loop playsInline />
            ) : (
              <img src={firstMedia.url} alt={post.name || ''} draggable={false} />
            )}
          </div>
        )}

        <div className="post-detail-sheet">
          <div
            ref={handleZoneRef}
            className="post-detail-handle-zone"
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
          >
            <div className="post-detail-handle" />
          </div>

          <div className="post-detail-scroll">
            {loading ? (
              <div className="post-detail-empty">Загрузка…</div>
            ) : comments.length === 0 ? (
              <div className="post-detail-empty">Пока нет комментариев</div>
            ) : (
              <CommentList
                comments={comments}
                currentUser={currentUser}
                onDelete={handleDeleteComment}
                onOpenProfile={onOpenProfile}
              />
            )}
          </div>

          <CommentInput onSend={handleSend} disabled={!currentUser} user={currentUser} />
        </div>
      </div>
    </div>,
    document.body
  );
}