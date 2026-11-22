// Демо-данные из макета. Позже заменим на настоящие из базы.
export const me = { name: 'Вы', initial: 'О', color: '#3A4A8C', username: 'you' };

export const chats = [
  { id: 1, name: 'Артём', initial: 'А', color: '#2C6E5A', time: '20:24', unread: 0, messages: [
    { in: true, text: 'Привет! Ты уже сделал физику?' },
    { in: true, text: 'Там вторая задача с графиком какая-то странная' },
    { in: false, text: 'Да, скворец 20 м/с, муха 5 м/с. Встретятся через 4 с' },
    { in: true, text: 'Спасибо, сверился, сошлось' },
  ] },
  { id: 2, name: 'PartUnionDev', initial: 'P', color: '#3A4A8C', time: '19:58', unread: 3, messages: [{ in: true, text: 'Новый билд ПАРТКРАФТа готов' }] },
  { id: 3, name: 'Класс', initial: 'К', color: '#8C5A2E', time: '19:41', unread: 12, messages: [{ in: true, text: 'Кто сделал географию?' }] },
  { id: 4, name: 'Парт Пэй', initial: '₽', color: '#5B3A8C', time: '18:10', unread: 0, messages: [{ in: true, text: 'Перевод получен: 50 партов' }] },
  { id: 5, name: 'Мама', initial: 'М', color: '#8C3A4E', time: '17:32', unread: 1, messages: [{ in: true, text: 'Ужин через 10 минут' }] },
  { id: 6, name: 'Миша', initial: 'М', color: '#2E6F8C', time: '16:05', unread: 0, messages: [{ in: true, text: 'Завтра в школу к первому?' }] },
  { id: 7, name: 'Связь — новости', initial: 'С', color: '#4E4E52', time: 'Вчера', unread: 0, messages: [{ in: true, text: 'Вышло обновление 1.4' }] },
  { id: 8, name: 'Даня', initial: 'Д', color: '#6F7A2E', time: 'Вчера', unread: 0, messages: [{ in: true, text: 'Голосовое сообщение' }] },
  { id: 9, name: 'Лёша', initial: 'Л', color: '#7A2E6F', time: 'Пн', unread: 0, messages: [{ in: true, text: 'Го в роблокс' }] },
];

export const posts = [
  { id: 1, name: 'PartUnionDev', initial: 'P', color: '#3A4A8C', time: '15 мин', text: 'Вышло обновление ПАРТКРАФТа: мультиплеер, новые блоки и флаги Союза на каждом сервере.', likes: 24, comments: 6 },
  { id: 2, name: 'Парт Пэй', initial: '₽', color: '#5B3A8C', time: '1 ч', text: 'Переводы между гражданами теперь проходят мгновенно. Комиссия — 0 партов.', likes: 41, comments: 12 },
  { id: 3, name: 'Артём', initial: 'А', color: '#2C6E5A', time: '2 ч', text: 'Кто знает, как решать задачу про скворца и муху? Уже полчаса сижу.', likes: 8, comments: 15 },
  { id: 4, name: 'Связь — новости', initial: 'С', color: '#4E4E52', time: 'Вчера', text: 'Связь 1.4: новые островки внизу экрана, тёмная тема и поиск по сообщениям.', likes: 57, comments: 9 },
];

export const trends = [
  { title: 'Мультиплеер в ПАРТКРАФТе', meta: '124 поста' },
  { title: 'Выборы президента Союза', meta: '87 постов' },
  { title: 'Связь 1.4', meta: '56 постов' },
  { title: 'Курс парта', meta: '31 пост' },
];

export const follow = [
  { name: 'Парт Пэй', initial: '₽', color: '#5B3A8C', meta: 'Банк Союза' },
  { name: 'PartUnionDev', initial: 'P', color: '#3A4A8C', meta: 'Разработчики' },
  { name: 'Миша', initial: 'М', color: '#2E6F8C', meta: 'Гражданин Союза' },
];
