import React, { useState, useRef } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import './CreateRepoModal.css';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const formatSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + ['B', 'KB', 'MB', 'GB'][i];
};

const getIcon = (type) => {
  if (type.startsWith('image/')) return '🖼️';
  if (type.startsWith('video/')) return '🎬';
  if (type.startsWith('audio/')) return '🎵';
  return '📄';
};

/* compress an image via canvas, keeps original filename/extension */
const compressImage = (file, maxW = 1600, quality = 0.75) => {
  if (!file.type.startsWith('image/')) return Promise.resolve(file);
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return Promise.resolve(file);

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement('canvas');
      let { width, height } = img;

      if (width > maxW) {
        height = Math.round((height * maxW) / width);
        width = maxW;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            resolve(file);
            return;
          }
          const out = new File([blob], file.name, { type: mime });
          resolve(out);
        },
        mime,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
};

export default function CreateRepoModal({ onClose, onCreate }) {
  const [caption, setCaption] = useState('');
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const addFiles = async (newFiles) => {
    const incoming = Array.from(newFiles).filter((f) => {
      if (f.size > MAX_FILE_SIZE) {
        alert(`Файл "${f.name}" больше ${formatSize(MAX_FILE_SIZE)}`);
        return false;
      }
      return true;
    });

    const entries = [];
    for (const file of incoming) {
      const compressed = await compressImage(file);
      entries.push({
        id: Math.random().toString(36).slice(2, 9),
        file: compressed,
        name: file.name,
        size: compressed.size,
        originalSize: file.size,
        type: file.type || 'application/octet-stream',
        url: URL.createObjectURL(compressed),
      });
    }

    setFiles((prev) => [...prev, ...entries]);
  };

  const removeFile = (id) => setFiles((prev) => prev.filter((f) => f.id !== id));

  const upload = async (obj) => {
    const ext = obj.file.name.split('.').pop() || 'bin';
    const storageName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from('repopart-files')
      .upload(storageName, obj.file, {
        cacheControl: '31536000',
        contentType: obj.type,
      });
    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('repopart-files')
      .getPublicUrl(storageName);

    return {
      id: obj.id,
      name: obj.name,
      size: obj.size,
      type: obj.type,
      url: publicUrl,
    };
  };

  const submit = async (e) => {
    e.preventDefault();

    /* collapse 3+ newlines to 2, trim */
    const cleanCaption = caption.replace(/\n{3,}/g, '\n\n').trim();

    setUploading(true);

    try {
      const uploaded = await Promise.all(files.map(upload));

      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('repositories')
        .insert({
          name: cleanCaption,
          description: '',
          files: uploaded,
          user_id: user.id,
          author_email: user.email,
          views: 0,
        })
        .select()
        .single();

      if (error) throw error;

      onCreate?.(data);
      onClose();
    } catch (err) {
      alert('Ошибка: ' + err.message);
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Новый пост</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={submit} className="modal-form">
          <label className="field">
            <span className="field-label">
              Подпись <span className="field-counter">{caption.length}/500</span>
            </span>
            <textarea
              className="field-input field-textarea"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Добавить подпись..."
              maxLength={500}
              rows={3}
              autoFocus
            />
          </label>

          <div className="field">
            <span className="field-label">Файлы</span>
            <div
              className={`modal-drop-zone ${dragging ? 'is-dragging' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
              }}
              onClick={() => inputRef.current.click()}
            >
              <input
                type="file"
                multiple
                ref={inputRef}
                onChange={(e) => addFiles(e.target.files)}
                style={{ display: 'none' }}
              />
              <div className="drop-zone-icon">📎</div>
              <div className="drop-zone-text">Перетащите файлы или нажмите</div>
              <div className="drop-zone-subtext">Максимум {formatSize(MAX_FILE_SIZE)}</div>
            </div>

            {files.length > 0 && (
              <div className="modal-file-grid">
                {files.map((f) => (
                  <div key={f.id} className="modal-file-card">
                    <div className="modal-file-thumb">
                      {f.type.startsWith('image/') ? (
                        <img src={f.url} alt={f.name} />
                      ) : f.type.startsWith('video/') ? (
                        <video src={f.url} muted preload="metadata" />
                      ) : (
                        <span className="modal-file-icon">{getIcon(f.type)}</span>
                      )}
                    </div>
                    <div className="modal-file-meta">
                      <span className="modal-file-name">{f.name}</span>
                      <span className="modal-file-size">
                        {formatSize(f.size)}
                        {f.originalSize && f.originalSize !== f.size && (
                          <span className="modal-file-saved"> ← {formatSize(f.originalSize)}</span>
                        )}
                      </span>
                    </div>
                    <button type="button" className="modal-file-remove" onClick={() => removeFile(f.id)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={uploading}
            >
              Отмена
            </button>
            <button type="submit" className="btn-primary" disabled={uploading}>
              {uploading ? 'Загрузка...' : 'Опубликовать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}