/*
 * Настройки пользователя (хранятся в браузере, на этом устройстве).
 * useSetting('liquidGlass') — значение + функция смены; меняется сразу во всех компонентах.
 */
import { useEffect, useState, useCallback } from 'react';

export const APP_VERSION = '1.4.1 beta';

const KEY = 'svyaz-settings';

export const DEFAULTS = {
  liquidGlass: true,      // настоящее жидкое стекло (только Chromium)
  textSize: 17,           // размер текста постов, px
  showTranslate: true,    // кнопка «Перевести» в меню поста
  translateTo: 'ru',      // на какой язык переводить
  lang: 'ru',             // язык интерфейса
};

let cache = null;

function read() {
  if (cache) return cache;
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { /* приватный режим */ }
  cache = { ...DEFAULTS, ...saved };
  return cache;
}

const listeners = new Set();

export function getSetting(name) {
  return read()[name];
}

export function setSetting(name, value) {
  cache = { ...read(), [name]: value };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* нет места или приватный режим */ }
  applySettings();
  listeners.forEach((fn) => fn(cache));
}

export function useSetting(name) {
  const [value, setValue] = useState(() => getSetting(name));
  useEffect(() => {
    const fn = (all) => setValue(all[name]);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, [name]);
  const update = useCallback((v) => setSetting(name, v), [name]);
  return [value, update];
}

/* применяет настройки, которые влияют на весь сайт */
export function applySettings() {
  const s = read();
  document.documentElement.style.setProperty('--post-text-size', `${s.textSize}px`);
  document.documentElement.lang = s.lang || 'ru';
}
