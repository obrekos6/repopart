import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient'; // Импорт клиента Supabase
import './Createrepomodal.css';

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.html', '.css', '.js', '.json', '.txt'];
const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'video/mp4', 'video/webm', 'video/ogg'
];

const CreateRepoModal = ({ onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [password, setPassword] = useState('');
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false); // Статус загрузки
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
    const isAllowedType = ALLOWED_MIME_TYPES.includes(file.type) || ALLOWED_EXTENSIONS.includes(ext);
    if (!isAllowedType) {
      alert(`Формат файла "${file.name}" не поддерживается.`);
      return false;
    }
    return true;
  };

  const handleFiles = (newFiles) => {
    const validFiles = Array.from(newFiles).filter(isValidFile);
    const formattedFiles = validFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      name: file.name,
      size: file.size,
      type: file.type || 'text/plain',
      url: URL.createObjectURL(file) // Локальный предпросмотр до загрузки
    }));
    setFiles(prev => [...prev, ...formattedFiles]);
  };

  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  // Асинхронная отправка с загрузкой в Supabase
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsUploading(true);

    try {
      // 1. Загружаем все файлы в Supabase Storage
      const uploadedFiles = await Promise.all(
        files.map(async (f) => {
          const fileExt = f.file.name.split('.').pop();
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
          
          const { data, error } = await supabase.storage
            .from('repopart-files') // Имя твоего бакета
            .upload(fileName, f.file);

          if (error) {
            console.error('Ошибка загрузки файла:', error);
            return null;
          }

          // Получаем публичную ссылку
          const { data: { publicUrl } } = supabase.storage
            .from('repopart-files')
            .getPublicUrl(fileName);

          return {
            id: Math.random().toString(36).substr(2, 9),
            name: f.name,
            size: f.size,
            type: f.type || 'text/plain',
            url: publicUrl,
          };
        })
      );

      const validFiles = uploadedFiles.filter(file => file !== null);

      // 2. Передаем данные наверх в App.jsx
      onCreate({
        id: Math.random().toString(36).substr(2, 9),
        name,
        description,
        files: validFiles,
        createdAt: new Date().toISOString(),
      });

      onClose();
    } catch (error) {
      console.error('Ошибка при создании репозитория:', error);
      alert('Произошла ошибка при загрузке. Проверьте консоль.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Новый репозиторий</h2>
          <button className="modal-close" aria-label="Закрыть" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <label className="field">
            <span className="field-label">Название репозитория<span className="required">*</span></span>
            <input type="text" className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="my-awesome-project" required autoFocus />
          </label>

          <label className="field">
            <span className="field-label">Описание</span>
            <textarea className="field-input field-textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Коротко о проекте (необязательно)" maxLength={350} rows={3} />
            <span className="field-hint">{description.length} / 350 символов</span>
          </label>

          <label className="field">
            <span className="field-label">Пароль на запись<span className="required">*</span></span>
            <input type="password" className="field-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Только те, кто знает пароль, смогут добавлять файлы" required />
          </label>

          {/* Dashed drop zone — тот самый прямоугольник */}
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
              <input type="file" multiple ref={fileInputRef} onChange={(e) => handleFiles(e.target.files)} style={{ display: 'none' }} accept="image/*,video/*,.html,.css,.js,.json,.txt" />
              <div className="drop-zone-icon">📎</div>
              <div className="drop-zone-text">Перетащите файлы сюда или нажмите для выбора</div>
              <div className="drop-zone-subtext">Максимум 50 МБ · PNG, JPG, GIF, MP4, WEBM, HTML, CSS, JS, JSON, TXT</div>
            </div>

            {/* Превью загруженных файлов сеткой */}
            {files.length > 0 && (
              <div className="modal-file-grid">
                {files.map(f => (
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
                    <button type="button" className="modal-file-remove" onClick={() => removeFile(f.id)} aria-label="Удалить файл">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isUploading}>Отмена</button>
            <button type="submit" className="btn-primary" disabled={isUploading}>
              {isUploading ? 'Загрузка...' : 'Создать репозиторий'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateRepoModal;