export function formatTime(dateString) {
  const diff = Math.floor((Date.now() - new Date(dateString)) / 1000);

  if (diff < 5) return 'только что';
  if (diff < 60) return `${diff} секунд назад`;

  const plural = (n, forms) => {
    const d = n % 10, dd = n % 100;
    if (dd >= 11 && dd <= 14) return forms[2];
    if (d === 1) return forms[0];
    if (d >= 2 && d <= 4) return forms[1];
    return forms[2];
  };

  const m = Math.floor(diff / 60);
  if (m < 60) return `${m} ${plural(m, ['минуту', 'минуты', 'минут'])} назад`;

  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${plural(h, ['час', 'часа', 'часов'])} назад`;

  const d = Math.floor(h / 24);
  if (d < 30) return `${d} ${plural(d, ['день', 'дня', 'дней'])} назад`;

  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} ${plural(mo, ['месяц', 'месяца', 'месяцев'])} назад`;

  const y = Math.floor(mo / 12);
  return `${y} ${plural(y, ['год', 'года', 'лет'])} назад`;
}