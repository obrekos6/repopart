import React, { useState } from 'react';
import { HeartIcon, HeartFilledIcon, DownloadIcon, EyeIcon } from '../../../../assets/icons/Icons';
import './PostFooter.css';

const formatNumber = (n) => {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n;
};

export default function PostFooter({ views, likes, isLiked, burst, onLike, files = [] }) {
  const [slide] = useState(0);

  const handleDownload = async (e) => {
    e.stopPropagation();
    const f = files[slide] || files[0];
    if (!f) return;
    try {
      const res = await fetch(f.url);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = f.name || 'download';
      a.click();
    } catch {
      window.open(f.url, '_blank');
    }
  };

  return (
    <div className="post-footer">
      <button
        className={`post-action like-btn ${isLiked ? 'is-liked' : ''} ${burst ? 'is-bursting' : ''}`}
        onClick={onLike}
        aria-label="Нравится"
      >
        <div className="like-icon-wrapper">
          {isLiked
            ? <HeartFilledIcon size={20} className="like-icon" />
            : <HeartIcon size={20} className="like-icon" />
          }
        </div>
        <span>{formatNumber(likes)}</span>
      </button>

      <div className="post-action post-views">
        <EyeIcon size={20} />
        <span>{formatNumber(views)}</span>
      </div>

      <button className="post-action post-download-btn" onClick={handleDownload} aria-label="Скачать">
        <DownloadIcon size={20} />
        <span>Скачать</span>
      </button>
    </div>
  );
}