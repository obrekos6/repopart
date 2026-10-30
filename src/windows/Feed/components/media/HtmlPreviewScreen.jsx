import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useBackButton } from '../../../../lib/useBackButton';
import { 
  CloseIcon, 
  DownloadIcon, 
  CodeIcon, 
  ExternalLinkIcon, 
  RefreshIcon,
  MoreIcon,
  EyeIcon,
  FullscreenIcon
} from '../../../../assets/icons/Icons';
import './HtmlPreviewScreen.css';

export default function HtmlPreviewScreen({ file, onClose }) {
  const [visible, setVisible] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [showCode, setShowCode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0); 
  
  const menuRef = useRef(null);
  const iframeRef = useRef(null);

  const isExternalLink = file.url.startsWith('http') && 
                         !file.url.includes('supabase.co') && 
                         !file.url.includes('localhost') && 
                         !file.url.includes('127.0.0.1');

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useLayoutEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    if (!file.url) return;
    
    if (isExternalLink) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(file.url)
      .then(res => res.text())
      .then(text => setCode(text))
      .catch(() => setCode('<h1 style="color:red;text-align:center;margin-top:50px;">Ошибка загрузки HTML</h1>'))
      .finally(() => setLoading(false));
  }, [file.url, isExternalLink]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onClose(), 380);
  };

  useBackButton(handleClose, true);

  const handleDownload = async () => {
    if (isExternalLink) {
      window.open(file.url, '_blank');
      setMenuOpen(false);
      return;
    }

    try {
      const res = await fetch(file.url);
      const blob = await res.blob();
      const a = document.createElement('a');
      const objUrl = URL.createObjectURL(blob);
      a.href = objUrl;
      a.download = file.name || 'download'; 
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
    } catch {
      window.open(file.url, '_blank');
    }
    setMenuOpen(false);
  };

  const handleOpenInBrowser = () => {
    window.open(file.url, '_blank');
    setMenuOpen(false);
  };

  const handleRefresh = () => {
    setIframeLoading(true);
    setIframeKey(prev => prev + 1);
    setMenuOpen(false);
  };

  const handleFullscreen = () => {
    if (iframeRef.current) {
      if (iframeRef.current.requestFullscreen) {
        iframeRef.current.requestFullscreen();
      } else if (iframeRef.current.webkitRequestFullscreen) {
        iframeRef.current.webkitRequestFullscreen();
      }
    }
    setMenuOpen(false);
  };

  let finalHtml = code;
  if (finalHtml && !finalHtml.includes('<base')) {
    const baseUrl = file.url.substring(0, file.url.lastIndexOf('/') + 1);
    if (finalHtml.includes('<head>')) {
      finalHtml = finalHtml.replace('<head>', `<head><base href="${baseUrl}">`);
    } else {
      finalHtml = `<base href="${baseUrl}">` + finalHtml;
    }
  }

  const domainName = file.name || 'Ссылка';

  return createPortal(
    <div className={`html-preview-root ${visible ? 'is-on' : ''}`}>
      <div className="html-preview-backdrop" onClick={handleClose} />
      
      <div className="html-preview-panel">
        <header className="html-preview-header">
          <button className="html-preview-btn" onClick={handleClose} aria-label="Закрыть">
            <CloseIcon size={22} />
          </button>

          <div className="html-preview-url-bar">
            <span className="html-preview-url-text">{domainName}</span>
          </div>

          <button className="html-preview-btn" onClick={() => setMenuOpen(true)} aria-label="Меню">
            <MoreIcon size={22} />
          </button>

          {iframeLoading && <div className="html-preview-progress" />}
        </header>

        {menuOpen && (
          <>
            <div className="html-preview-menu-backdrop" onClick={() => setMenuOpen(false)} />
            <div className="html-preview-menu" ref={menuRef}>
              <button className="html-preview-menu-item" onClick={handleOpenInBrowser}>
                <ExternalLinkIcon size={18} /> Открыть в браузере
              </button>
              
              <button className="html-preview-menu-item" onClick={handleRefresh}>
                <RefreshIcon size={18} /> Обновить
              </button>

              <button className="html-preview-menu-item" onClick={handleFullscreen}>
                <FullscreenIcon size={18} /> На весь экран
              </button>
              
              {!isExternalLink && (
                <>
                  <button className="html-preview-menu-item" onClick={handleDownload}>
                    <DownloadIcon size={18} /> Скачать файл
                  </button>
                  <div className="html-preview-menu-divider" />
                  <button className="html-preview-menu-item" onClick={() => { setShowCode(!showCode); setMenuOpen(false); }}>
                    {showCode ? <EyeIcon size={18} /> : <CodeIcon size={18} />}
                    {showCode ? 'Показать сайт' : 'Просмотреть код'}
                  </button>
                </>
              )}
            </div>
          </>
        )}

        <div className="html-preview-content">
          {loading ? (
            <div className="html-preview-loading">Загрузка...</div>
          ) : showCode && !isExternalLink ? (
            <pre className="html-preview-code">
              <code>{code}</code>
            </pre>
          ) : (
            <iframe
              key={iframeKey}
              ref={iframeRef}
              className="html-preview-iframe"
              src={isExternalLink ? file.url : undefined}
              srcDoc={!isExternalLink ? finalHtml : undefined}
              title={file.name}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-fullscreen"
              allow="fullscreen"
              onLoad={() => setIframeLoading(false)}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}