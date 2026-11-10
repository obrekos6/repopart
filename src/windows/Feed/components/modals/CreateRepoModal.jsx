import React, { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import { useBackButton } from '../../../../lib/useBackButton';
import { FILES_BUCKET } from '../../../../lib/storage';
import { serializeEditor, toPlainText, applyMarkdown } from '../../../../lib/richText';
import { useT } from '../../../../lib/i18n';
import { CloseIcon, ArrowUpIcon, MoreIcon, PaperclipIcon, ImageIcon, VideoIcon, MusicIcon, FileIcon } from '../../../../assets/icons/Icons';
import './CreateRepoModal.css';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const formatSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + ['B', 'KB', 'MB', 'GB'][i];
};

const renderFileIcon = (type, size = 24) => {
  if (type.startsWith('image/')) return <ImageIcon size={size} />;
  if (type.startsWith('video/')) return <VideoIcon size={size} />;
  if (type.startsWith('audio/')) return <MusicIcon size={size} />;
  return <FileIcon size={size} />;
};

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

const MAX_CHARS = 4096; // как у сообщения в Telegram

/* Размер фото и сверхсжатая копия (~40px) для загрузки как в Telegram:
   в ленте она показывается под размытием, пока качается полное фото */
const makeThumb = (file) => {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { naturalWidth: w, naturalHeight: h } = img;
      const k = 40 / Math.max(w, h);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(w * k));
      canvas.height = Math.max(1, Math.round(h * k));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => resolve({ width: w, height: h, thumb: blob }),
        'image/jpeg',
        0.5
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
};

export default function CreateRepoModal({ onClose, onCreate }) {
  const t = useT();
  const [markup, setMarkup] = useState('');
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef(null);
  const editorRef = useRef(null);

  /* ---------- шторка: выезжает снизу, закрывается свайпом вниз (как комментарии) ---------- */
  const [shown, setShown] = useState(false);
  const [sheetDrag, setSheetDrag] = useState(null); // смещение пальцем, px
  const closingRef = useRef(false);
  const dragRef = useRef({ active: false, startY: 0, lastY: 0, lastT: 0, velocity: 0, id: null });

  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleClose = useCallback(() => {
    if (closingRef.current || uploading) return;
    closingRef.current = true;
    setSheetDrag(null);
    setShown(false);
    setTimeout(() => onClose(), 320);
  }, [onClose, uploading]);

  useBackButton(handleClose, !uploading);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose]);

  const onGrabStart = (e) => {
    if (e.target.closest('button, .sheet-menu')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragRef.current = { active: true, startY: e.clientY, lastY: e.clientY, lastT: performance.now(), velocity: 0, id: e.pointerId };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const onGrabMove = (e) => {
    const d = dragRef.current;
    if (!d.active || e.pointerId !== d.id) return;
    const now = performance.now();
    if (now > d.lastT) d.velocity = (e.clientY - d.lastY) / (now - d.lastT);
    d.lastY = e.clientY;
    d.lastT = now;
    setSheetDrag(Math.max(0, e.clientY - d.startY));
  };

  const onGrabEnd = (e) => {
    const d = dragRef.current;
    if (!d.active || e.pointerId !== d.id) return;
    d.active = false;
    const dy = e.clientY - d.startY;
    if (dy > 100 || d.velocity > 0.5) handleClose();
    else setSheetDrag(null);
  };

  const plainLength = toPlainText(markup).trim().length;
  const isEmpty = plainLength === 0 && !markup.includes('<blockquote>');
  const tooLong = plainLength > MAX_CHARS;
  const canSend = !uploading && !tooLong && (!isEmpty || files.length > 0);

  const plural = (n, forms) => {
    const d = n % 10, dd = n % 100;
    if (dd >= 11 && dd <= 14) return forms[2];
    if (d === 1) return forms[0];
    if (d >= 2 && d <= 4) return forms[1];
    return forms[2];
  };
  const subtitle = uploading
    ? t('ed.publishing')
    : [
        files.length ? t('ed.files', { n: files.length }) : '',
        plainLength ? t('ed.chars', { n: plainLength }) : '',
      ].filter(Boolean).join(' · ') || t('ed.toFeed');

  /* фокус в поле при открытии */
  useEffect(() => {
    const t = setTimeout(() => editorRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  // форматирование пишется символами, как в Telegram, и применяется при публикации
  const composeMarkup = () => applyMarkdown(serializeEditor(editorRef.current));
  const syncMarkup = () => setMarkup(composeMarkup());

  const runHistory = (cmd) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, null);
    syncMarkup();
  };

  /* ---------- ввод ---------- */
  const handlePaste = (e) => {
    // вставляем только текст, без чужого оформления
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (text) document.execCommand('insertText', false, text);
    if (e.clipboardData.files?.length) addFiles(e.clipboardData.files);
  };

  const handleKeyDown = (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.closest('form')?.requestSubmit();
      return;
    }
    // браузер не оформляет текст сам: форматирование только символами
    if (['KeyB', 'KeyI', 'KeyU'].includes(e.code)) e.preventDefault();
  };

  /* ---------- файлы ---------- */
  const addFiles = async (newFiles) => {
    const incoming = Array.from(newFiles).filter((f) => {
      if (f.size > MAX_FILE_SIZE) {
        alert(t('ed.fileTooBig', { name: f.name, size: formatSize(MAX_FILE_SIZE) }));
        return false;
      }
      return true;
    });

    const entries = [];
    for (const file of incoming) {
      const compressed = await compressImage(file);
      const meta = await makeThumb(compressed);
      entries.push({
        width: meta?.width,
        height: meta?.height,
        thumbBlob: meta?.thumb || null,
        id: Math.random().toString(36).slice(2, 9),
        file: compressed,
        name: file.name,
        size: compressed.size,
        originalSize: file.size,
        type: compressed.type || file.type || 'application/octet-stream',
        url: URL.createObjectURL(compressed),
      });
    }

    setFiles((prev) => [...prev, ...entries]);
  };

  const removeFile = (id) => setFiles((prev) => {
    const target = prev.find((f) => f.id === id);
    if (target) URL.revokeObjectURL(target.url);
    return prev.filter((f) => f.id !== id);
  });

  const upload = async (obj) => {
    const dot = obj.file.name.lastIndexOf('.');
    const ext = dot > 0 ? obj.file.name.slice(dot + 1).toLowerCase() : 'bin';
    const storageName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from(FILES_BUCKET)
      .upload(storageName, obj.file, {
        cacheControl: '31536000',
        contentType: obj.type,
      });
    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(FILES_BUCKET)
      .getPublicUrl(storageName);

    // вторая, сверхсжатая версия фото — для размытого превью при загрузке
    let thumb;
    if (obj.thumbBlob) {
      const thumbName = storageName.replace(/\.[^.]+$/, '') + '_thumb.jpg';
      const { error: thumbError } = await supabase.storage
        .from(FILES_BUCKET)
        .upload(thumbName, obj.thumbBlob, { cacheControl: '31536000', contentType: 'image/jpeg' });
      if (!thumbError) {
        thumb = supabase.storage.from(FILES_BUCKET).getPublicUrl(thumbName).data.publicUrl;
      }
    }

    return {
      id: obj.id,
      name: obj.name,
      size: obj.size,
      type: obj.type,
      url: publicUrl,
      ...(obj.width && obj.height ? { width: obj.width, height: obj.height } : {}),
      ...(thumb ? { thumb } : {}),
    };
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!canSend) return;

    const text = composeMarkup();

    setUploading(true);

    try {
      const uploaded = await Promise.all(files.map(upload));

      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('repositories')
        .insert({
          name: text,
          description: '',
          files: uploaded,
          user_id: user.id,
          views: 0,
        })
        .select()
        .single();

      if (error) throw error;

      onCreate?.(data);
      // пост опубликован — шторка уезжает вниз (handleClose тут не подходит:
      // он не закрывает окно, пока идёт загрузка)
      closingRef.current = true;
      setShown(false);
      setTimeout(() => onClose(), 320);
    } catch (err) {
      alert(t('ed.error') + err.message);
      setUploading(false);
    }
  };

  const keepSelection = (e) => e.preventDefault(); // кнопки не сбивают выделение

  return (
    <div className={`modal-overlay rt-overlay ${shown ? 'is-shown' : ''}`} onClick={handleClose}>
      {/* редактор как Rich Text Editor в Telegram: шторка на весь экран */}
      <form
        className={`modal rt-sheet ${dragging ? 'is-dragging' : ''} ${sheetDrag !== null ? 'is-grabbed' : ''}`}
        style={sheetDrag !== null ? { transform: `translateY(${sheetDrag}px)` } : undefined}
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
      >
        <div
          className="modal-header"
          onPointerDown={onGrabStart}
          onPointerMove={onGrabMove}
          onPointerUp={onGrabEnd}
          onPointerCancel={onGrabEnd}
        >
          <div className="modal-grabber" />
          <button
            type="button"
            className="sheet-btn"
            onClick={handleClose}
            disabled={uploading}
            aria-label={t('ed.close')}
          >
            <CloseIcon size={20} />
          </button>

          <div className="html-preview-title">
            <span className="html-preview-title-text">{t('ed.newPost')}</span>
            <span className="html-preview-subtitle">{subtitle}</span>
          </div>

          <button
            type="button"
            className="sheet-btn"
            onMouseDown={keepSelection}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={t('common.more')}
            aria-expanded={menuOpen}
          >
            <MoreIcon size={22} />
          </button>

          {menuOpen && (
            <>
              <div className="rt-menu-backdrop" onMouseDown={keepSelection} onClick={() => setMenuOpen(false)} />
              {/* у «Отменить» / «Повторить» пока нет иконок в проекте — нужны undo/redo из Telegram iOS kit */}
              <div className="sheet-menu rt-menu" role="menu">
                <button type="button" className="sheet-menu-item" onMouseDown={keepSelection} onClick={() => { setMenuOpen(false); runHistory('undo'); }}>
                  <span className="sheet-menu-icon" />{t('ed.undo')}
                </button>
                <button type="button" className="sheet-menu-item" onMouseDown={keepSelection} onClick={() => { setMenuOpen(false); runHistory('redo'); }}>
                  <span className="sheet-menu-icon" />{t('ed.redo')}
                </button>
                <div className="sheet-menu-separator" />
                <button type="button" className="sheet-menu-item" onClick={() => { setMenuOpen(false); inputRef.current?.click(); }}>
                  <span className="sheet-menu-icon"><PaperclipIcon size={20} /></span>{t('ed.attach')}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="rt-scroll">
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
                      <span className="modal-file-icon" style={{ color: 'var(--accent)' }}>
                        {renderFileIcon(f.type, 32)}
                      </span>
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
                  <button type="button" className="modal-file-remove" onClick={() => removeFile(f.id)} aria-label={t('ed.removeFile')}>
                    <CloseIcon size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div
            ref={editorRef}
            className={`rt-input post-text ${isEmpty ? 'is-empty' : ''}`}
            contentEditable={!uploading}
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label={t('ed.text')}
            data-placeholder={t('ed.placeholder')}
            onInput={syncMarkup}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="rt-bottom">
          {plainLength > MAX_CHARS - 200 && (
            <div className={`rt-counter ${tooLong ? 'is-over' : ''}`}>{MAX_CHARS - plainLength}</div>
          )}

          <button
            type="button"
            className="sheet-btn rt-attach"
            onMouseDown={keepSelection}
            onClick={() => inputRef.current?.click()}
            aria-label={t('ed.attach')}
            title={t('ed.attachMax', { size: formatSize(MAX_FILE_SIZE) })}
          >
            <PaperclipIcon size={22} />
          </button>

          <span className="rt-spacer" />

          <button
            type="submit"
            className="sheet-btn is-accent rt-send"
            disabled={!canSend}
            aria-label={t('ed.publish')}
            title={t('ed.publishKey')}
          >
            {uploading ? <span className="sheet-spinner" /> : <ArrowUpIcon size={22} />}
          </button>
        </div>

        <input
          type="file"
          multiple
          ref={inputRef}
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
          style={{ display: 'none' }}
        />
      </form>
    </div>
  );
}
