export function formatTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 5) return 'только что';
  if (diff < 60) return `${diff} секунд назад`;

  const minutes = Math.floor(diff / 60);
  if (minutes < 60) {
    const lastDigit = minutes % 10;
    const lastTwo = minutes % 100;
    let word = 'минут';
    if (lastTwo >= 11 && lastTwo <= 14) word = 'минут';
    else if (lastDigit === 1) word = 'минуту';
    else if (lastDigit >= 2 && lastDigit <= 4) word = 'минуты';
    return `${minutes} ${word} назад`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const lastDigit = hours % 10;
    const lastTwo = hours % 100;
    let word = 'часов';
    if (lastTwo >= 11 && lastTwo <= 14) word = 'часов';
    else if (lastDigit === 1) word = 'час';
    else if (lastDigit >= 2 && lastDigit <= 4) word = 'часа';
    return `${hours} ${word} назад`;
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    const lastDigit = days % 10;
    const lastTwo = days % 100;
    let word = 'дней';
    if (lastTwo >= 11 && lastTwo <= 14) word = 'дней';
    else if (lastDigit === 1) word = 'день';
    else if (lastDigit >= 2 && lastDigit <= 4) word = 'дня';
    return `${days} ${word} назад`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    const lastDigit = months % 10;
    const lastTwo = months % 100;
    let word = 'месяцев';
    if (lastTwo >= 11 && lastTwo <= 14) word = 'месяцев';
    else if (lastDigit === 1) word = 'месяц';
    else if (lastDigit >= 2 && lastDigit <= 4) word = 'месяца';
    return `${months} ${word} назад`;
  }

  const years = Math.floor(months / 12);
  const lastDigit = years % 10;
  const lastTwo = years % 100;
  let word = 'лет';
  if (lastTwo >= 11 && lastTwo <= 14) word = 'лет';
  else if (lastDigit === 1) word = 'год';
  else if (lastDigit >= 2 && lastDigit <= 4) word = 'года';
  return `${years} ${word} назад`;
}