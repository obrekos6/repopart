import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import './PublicationList.css';

const EMOJI_OPTIONS = ['❤️', '😭', '👍', '😡', '🤔', '😂', '🔥', '💀', '😯'];

const PublicationList = ({ publications }) => {
  const [reactions, setReactions] = useState({}); // { repoId: { emoji, count } }
  const [openPickerId, setOpenPickerId] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const pickerRef = useRef(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user));
  }, []);

  const loadReactions = async () => {
    const { data } = await supabase.from('reactions').select('*');
    if (!data) return;
    const grouped = {};
    const myReactions = {};
    data.forEach((r) => {
      grouped[r.repository_id] = grouped[r.repository_id] || {};
      grouped[r.repository_id][r.emoji] = (grouped[r.repository_id][r.emoji] || 0) + 1;
      if (currentUser && r.user_id === currentUser.id) {
        myReactions[r.repository_id] = r.emoji;
      }
    });
    setReactions({ grouped, my: myReactions });
  };

  useEffect(() => {
    if (currentUser) loadReactions();
  }, [currentUser, publications]);

  // Закрытие picker по клику вне
  useEffect(() => {
    const handleClick = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setOpenPickerId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleReaction = async (repoId, emoji) => {
    if (!currentUser) return;
    const myEmoji = reactions.my?.[repoId];

    // Если такая же — удаляем
    if (myEmoji === emoji) {
      await supabase.from('reactions').delete()
        .eq('repository_id', repoId).eq('user_id', currentUser.id);
    } else {
      // Upsert — вставляем или обновляем
      await supabase.from('reactions').upsert(
        { repository_id: repoId, user_id: currentUser.id, emoji },
        { onConflict: 'repository_id,user_id' }
      );
    }
    setOpenPickerId(null);
    loadReactions();
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (type) => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎬';
    if (type.includes('html')) return '🌐';
    return '📄';
  };

  if (publications.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🛰️</div>
        <p className="empty-state-text">Тут тихо... подозрительно тихо.</p>
        <p className="empty-state-subtext">
          Показывать пока нечего — загляните позже, когда появятся репозитории.
        </p>
      </div>
    );
  }

  return (
    <div className="publication-list">
      {publications.map((pub) => {
        const myEmoji = reactions.my?.[pub.id];
        const groupedEmojis = reactions.grouped?.[pub.id] || {};
        const pickerOpen = openPickerId === pub.id;

        return (
          <div key={pub.id} className="publication-card">
            <div className="pub-header">
              <h3 className="pub-title">{pub.name}</h3>
              {pub.description && <p className="pub-desc">{pub.description}</p>}
            </div>

            {pub.files && pub.files.length > 0 && (
              <div className="pub-files-grid">
                {pub.files.map((file) => (
                  <div
                    key={file.id}
                    className="pub-file-item"
                    onClick={() => setPreviewFile(file)}
                  >
                    <div className="pub-file-thumb">
                      {file.type.startsWith('image/') ? (
                        <img src={file.url} alt={file.name} />
                      ) : file.type.startsWith('video/') ? (
                        <video src={file.url} muted />
                      ) : (
                        <span className="file-icon">{getFileIcon(file.type)}</span>
                      )}
                    </div>
                    <div className="pub-file-info">
                      <span className="pub-file-name" title={file.name}>{file.name}</span>
                      <span className="pub-file-size">{formatSize(file.size)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pub-reactions">
              {/* Отображение активных реакций */}
              {Object.entries(groupedEmojis).map(([emoji, count]) => (
                <span
                  key={emoji}
                  className={`reaction-display ${myEmoji === emoji ? 'is-mine' : ''}`}
                >
                  {emoji} {count > 0 && count}
                </span>
              ))}

              {/* Кнопка с плюсиком и выпадающим окном */}
              <div className="reaction-picker-wrap" ref={pickerOpen ? pickerRef : null}>
                <button
                  className="reaction-add-btn"
                  onClick={() => setOpenPickerId(pickerOpen ? null : pub.id)}
                >
                  +
                </button>
                {pickerOpen && (
                  <div className="reaction-picker">
                    {EMOJI_OPTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        className={`reaction-option ${myEmoji === emoji ? 'is-mine' : ''}`}
                        onClick={() => handleReaction(pub.id, emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {previewFile && (
        <div className="preview-modal-overlay" onClick={() => setPreviewFile(null)}>
          <div className="preview-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="preview-modal-close" onClick={() => setPreviewFile(null)}>✕</button>
            {previewFile.type.startsWith('image/') && (
              <img src={previewFile.url} alt={previewFile.name} className="preview-media" />
            )}
            {previewFile.type.startsWith('video/') && (
              <video src={previewFile.url} controls autoPlay className="preview-media" />
            )}
            {(previewFile.type.includes('html') || previewFile.name.endsWith('.html')) && (
              <iframe
                src={previewFile.url}
                className="preview-iframe"
                sandbox="allow-scripts allow-same-origin"
                title={previewFile.name}
              />
            )}
            {(!previewFile.type.startsWith('image/') &&
              !previewFile.type.startsWith('video/') &&
              !previewFile.type.includes('html') &&
              !previewFile.name.endsWith('.html')) && (
              <div className="preview-unavailable">
                <div className="preview-unavailable-icon">{getFileIcon(previewFile.type)}</div>
                <p>Предпросмотр недоступен.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicationList;