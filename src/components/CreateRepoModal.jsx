import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import './Createrepomodal.css';

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.html', '.css', '.js', '.json', '.txt'];
const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'video/mp4', 'video/webm', 'video/ogg',
];

const CreateRepoModal = ({ onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

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

  const isValidFile = (file) => {
    if (file.size > MAX_FILE_SIZE) {
      alert(`Файл "${file.name}" слишком большой! Максимум: 50 МБ.`);
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
      type: file.type || 'text/plain',
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
      .upload(fileName, fileObj.file);
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

    // Проверка пароля
    const masterPassword = import.meta.env.VITE_MASTER_PASSWORD;
    if (password !== masterPassword) {
      setPasswordError('Неверный пароль');
      return;
    }

    setIsUploading(true);
    try {
      // Загружаем все файлы
      const uploadedFiles = await Promise.all(files.map(uploadToStorage));

      // Получаем текущего пользователя
      const { data: { user } } = await supabase.auth.getUser();

      // Создаём запись в БД
      const { data, error } = await supabase
        .from('repositories')
        .insert({
          name,
          description,
          password,
          files: uploadedFiles,
          user_id: user.id,
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
          <h2 className="modal-title">Новый репозиторий</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <label className="field">
            <span className="field-label">Название<span className="required">*</span></span>
            <input
              type="text" className="field-input" value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-awesome-project" required autoFocus
            />
          </label>

          <label className="field">
            <span className="field-label">Описание</span>
            <textarea
              className="field-input field-textarea" value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Коротко о проекте" maxLength={350} rows={3}
            />
            <span className="field-hint">{description.length} / 350</span>
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
                accept="image/*,video/*,.html,.css,.js,.json,.txt"
              />
              <div className="drop-zone-icon">📎</div>
              <div className="drop-zone-text">Перетащите файлы сюда или нажмите</div>
              <div className="drop-zone-subtext">
                Максимум 50 МБ · PNG, JPG, GIF, MP4, WEBM, HTML, CSS, JS, JSON, TXT
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
                        <video src={f.url} muted />
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
              {isUploading ? 'Загрузка...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateRepoModal;