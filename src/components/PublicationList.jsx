import React, { useState } from 'react';
import './PublicationList.css';

const PublicationList = ({ publications }) => {
  // Храним реакции текущего пользователя: { [pubId]: { '👍': true, '❤️': false } }
  const [userReactions, setUserReactions] = useState({});
  const [previewFile, setPreviewFile] = useState(null);

  // Логика реакций (1 раз, но можно удалить)
  const toggleReaction = (pubId, emoji) => {
    const isAlreadyReacted = userReactions[pubId]?.[emoji] || false;
    
    // Обновляем состояние пользователя
    setUserReactions(prev => ({
      ...prev,
      [pubId]: {
        ...(prev[pubId] || {}),
        [emoji]: !isAlreadyReacted
      }
    }));
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

  return (
    <div className="publication-list">
      {publications.map(pub => (
        <div key={pub.id} className="publication-card">
          <div className="pub-header">
            <h3 className="pub-title">{pub.name}</h3>
            {pub.description && <p className="pub-desc">{pub.description}</p>}
          </div>

          {/* Файлы публикации */}
          {pub.files && pub.files.length > 0 && (
            <div className="pub-files-grid">
              {pub.files.map(file => (
                <div key={file.id} className="pub-file-item" onClick={() => setPreviewFile(file)}>
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

          {/* Реакции */}
          <div className="pub-reactions">
            {['👍', '❤️', '🔥', '😂'].map(emoji => {
              const isActive = userReactions[pub.id]?.[emoji];
              return (
                <button 
                  key={emoji} 
                  className={`reaction-btn ${isActive ? 'active' : ''}`}
                  onClick={() => toggleReaction(pub.id, emoji)}
                >
                  {emoji} {isActive && '1'}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Модальное окно предпросмотра */}
      {previewFile && (
        <div className="preview-modal-overlay" onClick={() => setPreviewFile(null)}>
          <div className="preview-modal-content" onClick={e => e.stopPropagation()}>
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
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>{getFileIcon(previewFile.type)}</div>
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