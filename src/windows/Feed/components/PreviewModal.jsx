import React from 'react';

export default function PreviewModal({ file, onClose }) {
  const getFileIcon = (type) => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎬';
    if (type.includes('html')) return '🌐';
    return '📄';
  };

  return (
    <div className="preview-modal-overlay" onClick={onClose}>
      <div className="preview-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="preview-modal-close" onClick={onClose}>✕</button>
        {file.type.startsWith('image/') && (
          <img src={file.url} alt={file.name} className="preview-media" />
        )}
        {file.type.startsWith('video/') && (
          <video src={file.url} controls autoPlay className="preview-media" />
        )}
        {(file.type.includes('html') || file.name.endsWith('.html')) && (
          <iframe
            src={file.url}
            className="preview-iframe"
            sandbox="allow-scripts allow-same-origin"
            title={file.name}
          />
        )}
        {(!file.type.startsWith('image/') &&
          !file.type.startsWith('video/') &&
          !file.type.includes('html') &&
          !file.name.endsWith('.html')) && (
          <div className="preview-unavailable">
            <div className="preview-unavailable-icon">{getFileIcon(file.type)}</div>
            <p>Предпросмотр недоступен.</p>
          </div>
        )}
      </div>
    </div>
  );
}