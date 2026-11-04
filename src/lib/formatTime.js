import { t } from './i18n';

/* «5 минут назад» / «5 minutes ago» — на языке интерфейса */
export function formatTime(dateString) {
  const diff = Math.floor((Date.now() - new Date(dateString)) / 1000);

  if (diff < 5) return t('time.now');
  if (diff < 60) return t('time.sec', { n: diff });

  const m = Math.floor(diff / 60);
  if (m < 60) return t('time.min', { n: m });

  const h = Math.floor(m / 60);
  if (h < 24) return t('time.hour', { n: h });

  const d = Math.floor(h / 24);
  if (d < 30) return t('time.day', { n: d });

  const mo = Math.floor(d / 30);
  if (mo < 12) return t('time.month', { n: mo });

  return t('time.year', { n: Math.floor(mo / 12) });
}
