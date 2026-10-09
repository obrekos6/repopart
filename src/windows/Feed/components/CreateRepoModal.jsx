import React, { useState, useRef } from 'react';
import { supabase } from '../../../lib/supabaseClient';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 МБ

// Расширенные списки — почти все форматы
const ALLOWED_EXTENSIONS = [
  // Картинки
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico', '.avif', '.heic', '.heif',
  // Видео
  '.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.m4v', '.3gp', '.flv', '.wmv',
  // Аудио
  '.mp3', '.wav', '.flac', '.aac', '.m4a', '.opus', '.wma',
  // Документы
  '.pdf', '.txt', '.md', '.rtf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.csv',
  // Код
  '.html', '.css', '.js', '.jsx', '.ts', '.tsx', '.json', '.xml', '.yml', '.yaml',
  // Архивы
  '.zip', '.rar', '.7z', '.tar', '.gz',
];

const ALLOWED_MIME_TYPES = [
  // Картинки
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'image/bmp', 'image/x-icon', 'image/avif', 'image/heic', 'image/heif',
  // Видео
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo',
  'video/x-matroska', 'video/x-m4v', 'video/3gpp', 'video/x-flv', 'video/x-ms-wmv',
  // Аудио
  'audio/mpeg', 'audio/wav', 'audio/flac', 'audio/aac', 'audio/mp4',
  'audio/ogg', 'audio/opus', 'audio/x-ms-wma',
  // Документы
  'application/pdf', 'text/plain', 'text/markdown', 'application/rtf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv',
  // Код
  'text/html', 'text/css', 'application/javascript', 'application/json',
  'application/xml', 'text/xml', 'text/yaml',
  // Архивы
  'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
  'application/x-tar', 'application/gzip',
];

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
  if (type.startsWith('audio/')) return '🎵';
  if (type.includes('pdf')) return '📕';
  if (type.includes('zip') || type.includes('rar')) return '📦';
  return '📄';
};

export default function CreateRepoModal({ onClose, onCreate }) {
  const [caption, setCaption] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const isValidFile = (file) => {
    if (file.size > MAX_FILE_SIZE) {
      alert(`Файл "${file.name}" слишком большой! Максимум: ${formatSize(MAX_FILE_SIZE)}.`);
      return false;
    }
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    const isAllowed = ALLOWED_MIME_TYPES.includes(file.type) || ALLOWED_EXTENSIONS.includes(ext);
    if (!isAllowed) {
      alert(`Формат файла "${file.name}" не поддерживается.`);
      return false;
    }
    return true;
  };

  const handleFiles = (newFiles) => {
    const valid = Array.from(newFiles).filter(isValidFile);
    const formatted = valid.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      url: URL.createObjectURL(file),
    }));
    setFiles((prev) => [...prev, ...formatted]);
  };

  const removeFile = (id) => setFiles((prev) => prev.filter((f) => f.id !== id));

  const uploadToStorage = async (fileObj) => {
    const ext = fileObj.file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${ext}`;
    const { error } = await supabase.storage
      .from('repopart-files')
      .upload(fileName, fileObj.file, {
        cacheControl: '31536000', // 1 год — браузер кэширует надолго
        upsert: false,
      });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage
      .from('repopart-files')
      .getPublicUrl(fileName);
    return {
      id: fileObj.id,
      name: fileObj.name,
      size: fileObj.size,
      type: fileObj.type,
      url: publicUrl,
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');

    const masterPassword = import.meta.env.VITE_MASTER_PASSWORD;
    if (password !== masterPassword) {
      setPasswordError('Неверный пароль');
      return;
    }

    setIsUploading(true);
    try {
      const uploadedFiles = await Promise.all(files.map(uploadToStorage));
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('repositories')
        .insert({
          name: caption,
          description: '',
          password,
          files: uploadedFiles,
          user_id: user.id,
          author_email: user.email,
          views: 0,
        })
        .select()
        .single();

      if (error) throw error;

      onCreate && onCreate(data);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Ошибка при создании: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Новый пост</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <label className="field">
            <span className="field-label">Подпись</span>
            <input
              type="text" className="field-input" value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Добавить подпись..."
              autoFocus
            />
          </label>

          <label className="field">
            <span className="field-label">Пароль<span className="required">*</span></span>
            <input
              type="password"
              className={`field-input ${passwordError ? 'field-input-error' : ''}`}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPasswordError(''); }}
              placeholder="Пароль для создания"
              required
            />
            {passwordError && <span className="field-error">{passwordError}</span>}
          </label>

          <div className="field">
            <span className="field-label">Файлы</span>
            <div
              className={`modal-drop-zone ${isDragging ? 'is-dragging' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current.click()}
            >
              <input
                type="file" multiple ref={fileInputRef}
                onChange={(e) => handleFiles(e.target.files)}
                style={{ display: 'none' }}
              />
              <div className="drop-zone-icon">📎</div>
              <div className="drop-zone-text">Перетащите файлы сюда или нажмите</div>
              <div className="drop-zone-subtext">
                Максимум {formatSize(MAX_FILE_SIZE)} · Любые форматы
              </div>
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
                        <span className="modal-file-icon">{getFileIcon(f.type)}</span>
                      )}
                    </div>
                    <div className="modal-file-meta">
                      <span className="modal-file-name" title={f.name}>{f.name}</span>
                      <span className="modal-file-size">{formatSize(f.size)}</span>
                    </div>
                    <button
                      type="button" className="modal-file-remove"
                      onClick={() => removeFile(f.id)}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isUploading}>
              Отмена
            </button>
            <button type="submit" className="btn-primary" disabled={isUploading}>
              {isUploading ? 'Загрузка...' : 'Опубликовать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}