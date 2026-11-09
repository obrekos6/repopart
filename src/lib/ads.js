// Реклама в ленте (Рекламная сеть Яндекса).
// AD_BLOCK_ID — ID блока из кабинета partner.yandex.ru, вида 'R-A-1234567-1'.
// Пока он пустой — на сайте реклама не показывается (в режиме разработки виден образец).
export const AD_BLOCK_ID = '';

// реклама после каждого N-го поста
export const AD_EVERY = 8;

let loading = null;
export function loadYandexAds() {
  if (loading) return loading;
  window.yaContextCb = window.yaContextCb || [];
  loading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://yandex.ru/ads/system/context.js';
    s.async = true;
    s.onload = resolve;
    s.onerror = reject; // блокировщик рекламы
    document.head.appendChild(s);
  });
  return loading;
}
