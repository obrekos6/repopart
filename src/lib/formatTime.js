import { t } from './i18n';
import { getSetting } from './settings';

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

/* Время под постом: сегодня — «9:11», вчера — «вчера в 9:11»,
   на этой неделе — «пн в 9:11», раньше — «8 окт. в 9:11» (с годом, если не этот) */
export function formatPostTime(dateString) {
  const d = new Date(dateString);
  const now = new Date();
  const locale = getSetting('lang') === 'en' ? 'en-US' : 'ru-RU';
  const time = d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  const day0 = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day0(now) - day0(d)) / 86400000);
  if (days <= 0) return time;
  if (days === 1) return `${t('time.yesterday')} ${t('time.at')} ${time}`;
  if (days < 7) return `${d.toLocaleDateString(locale, { weekday: 'short' })} ${t('time.at')} ${time}`;
  const opts = { day: 'numeric', month: 'short' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return `${d.toLocaleDateString(locale, opts)} ${t('time.at')} ${time}`;
}
