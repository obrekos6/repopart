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
  FullscreenIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ShareIcon,
  CopyIcon,
} from '../../../../assets/icons/Icons';
import './HtmlPreviewScreen.css';

/* домен для адресной строки: «https://www.telegram.org/x» → «telegram.org» */
const hostOf = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
};

const formatSize = (bytes) => {
  if (!bytes) return '';
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + ['B', 'KB', 'MB', 'GB'][i];
};

/*
 * Просмотр сайта или HTML-файла — шторка как «Sheet - Bot» в Telegram iOS:
 *  • ссылка на сайт (Type=Web): ✕ · адрес в капсуле · ••• и панель навигации снизу
 *  • HTML-файл (Type=App): ✕ · название и подзаголовок · •••
 */
export default function HtmlPreviewScreen({ file, onClose }) {
  const [visible, setVisible] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [showCode, setShowCode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [copied, setCopied] = useState(false);

  // счётчики переходов внутри страницы — для кнопок «Назад» / «Вперёд»
  const [canBack, setCanBack] = useState(0);
  const [canForward, setCanForward] = useState(0);
  const loadsRef = useRef(0);
  const historyMoveRef = useRef(null);

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

  const closeMenu = () => setMenuOpen(false);

  const handleDownload = async () => {
    closeMenu();
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
  };

  const handleOpenInBrowser = () => {
    closeMenu();
    window.open(file.url, '_blank', 'noopener');
  };

  const handleRefresh = () => {
    closeMenu();
    setIframeLoading(true);
    loadsRef.current = 0;
    setCanBack(0);
    setCanForward(0);
    setIframeKey(prev => prev + 1);
  };

  const handleFullscreen = () => {
    closeMenu();
    const el = iframeRef.current;
    if (!el) return;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  };

  const handleCopyLink = async () => {
    closeMenu();
    try { await navigator.clipboard.writeText(file.url); } catch { /* нет доступа к буферу */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: file.name || hostOf(file.url), url: file.url }); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    handleCopyLink();
  };

  /* переходы внутри iframe попадают в общую историю вкладки,
     поэтому «Назад» / «Вперёд» — это history.back() / forward() */
  const handleIframeLoad = () => {
    setIframeLoading(false);
    loadsRef.current += 1;
    if (loadsRef.current === 1) return; // первая загрузка — не переход
    const move = historyMoveRef.current;
    historyMoveRef.current = null;
    if (move === 'back') { setCanBack(n => Math.max(0, n - 1)); setCanForward(n => n + 1); }
    else if (move === 'forward') { setCanBack(n => n + 1); setCanForward(n => Math.max(0, n - 1)); }
    else { setCanBack(n => n + 1); setCanForward(0); }
  };

  const goBack = () => {
    if (!canBack) return;
    historyMoveRef.current = 'back';
    setIframeLoading(true);
    window.history.back();
  };

  const goForward = () => {
    if (!canForward) return;
    historyMoveRef.current = 'forward';
    setIframeLoading(true);
    window.history.forward();
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

  const title = isExternalLink ? hostOf(file.url) : (file.name || 'HTML-файл');
  const subtitle = isExternalLink
    ? null
    : ['HTML', formatSize(file.size)].filter(Boolean).join(' · ');

  return createPortal(
    <div className={`html-preview-root ${visible ? 'is-on' : ''}`}>
      <div className="html-preview-backdrop" onClick={handleClose} />

      <div className={`html-preview-panel ${isExternalLink ? 'is-web' : 'is-app'}`}>
        <header className="html-preview-header">
          <div className="html-preview-grabber" />

          <button className="sheet-btn html-preview-btn" onClick={handleClose} aria-label="Закрыть">
            <CloseIcon size={20} />
          </button>

          {isExternalLink ? (
            <button className="html-preview-url-bar" onClick={handleCopyLink} title={file.url}>
              <span className="html-preview-url-text">{copied ? 'Ссылка скопирована' : title}</span>
            </button>
          ) : (
            <div className="html-preview-title">
              <span className="html-preview-title-text">{title}</span>
              {subtitle && <span className="html-preview-subtitle">{subtitle}</span>}
            </div>
          )}

          <button
            className="sheet-btn html-preview-btn"
            onClick={() => setMenuOpen(v => !v)}
            aria-label="Ещё"
            aria-expanded={menuOpen}
          >
            <MoreIcon size={22} />
          </button>

          {iframeLoading && !loading && <div className="html-preview-progress" />}
        </header>

        {menuOpen && (
          <>
            <div className="html-preview-menu-backdrop" onClick={closeMenu} />
            <div className="sheet-menu html-preview-menu" role="menu">
              <button className="sheet-menu-item" onClick={handleRefresh}>
                <span className="sheet-menu-icon"><RefreshIcon size={20} /></span>Обновить
              </button>
              <button className="sheet-menu-item" onClick={handleCopyLink}>
                <span className="sheet-menu-icon"><CopyIcon size={20} /></span>Скопировать ссылку
              </button>
              <button className="sheet-menu-item" onClick={handleOpenInBrowser}>
                <span className="sheet-menu-icon"><ExternalLinkIcon size={20} /></span>Открыть в браузере
              </button>
              <button className="sheet-menu-item" onClick={handleFullscreen}>
                <span className="sheet-menu-icon"><FullscreenIcon size={20} /></span>На весь экран
              </button>

              {!isExternalLink && (
                <>
                  <div className="sheet-menu-separator" />
                  <button className="sheet-menu-item" onClick={() => { setShowCode(v => !v); closeMenu(); }}>
                    <span className="sheet-menu-icon">{showCode ? <EyeIcon size={20} /> : <CodeIcon size={20} />}</span>
                    {showCode ? 'Показать страницу' : 'Посмотреть код'}
                  </button>
                  <button className="sheet-menu-item" onClick={handleDownload}>
                    <span className="sheet-menu-icon"><DownloadIcon size={20} /></span>Скачать файл
                  </button>
                </>
              )}
            </div>
          </>
        )}

        <div className="html-preview-content">
          {loading ? (
            <div className="html-preview-loading">Загрузка…</div>
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
              title={title}
              // HTML из поста (srcDoc) получает адрес нашего сайта, поэтому ему НЕЛЬЗЯ
              // давать allow-same-origin: иначе его скрипты прочитают сессию пользователя.
              // Внешний сайт открывается со своим адресом — ему allow-same-origin безопасен.
              sandbox={isExternalLink
                ? 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals'
                : 'allow-scripts allow-forms allow-popups allow-modals'}
              allow="fullscreen"
              onLoad={handleIframeLoad}
            />
          )}
        </div>

        {/* панель навигации браузера (Sheet - Bot, Type=Web) */}
        {isExternalLink && (
          <nav className="html-preview-toolbar" aria-label="Навигация">
            <button onClick={goBack} disabled={!canBack} aria-label="Назад"><ArrowLeftIcon size={22} /></button>
            <button onClick={goForward} disabled={!canForward} aria-label="Вперёд"><ArrowRightIcon size={22} /></button>
            <button onClick={handleShare} aria-label="Поделиться"><ShareIcon size={22} /></button>
            <button onClick={handleOpenInBrowser} aria-label="Открыть в браузере"><ExternalLinkIcon size={22} /></button>
          </nav>
        )}
      </div>
    </div>,
    document.body
  );
}
