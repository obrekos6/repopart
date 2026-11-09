import { useCallback, useEffect, useRef } from 'react';

/*
 * Переход как в iOS: новое окно въезжает справа, а экран под ним
 * одновременно уезжает влево на четверть. Только на телефонах:
 * на компьютере окна открываются в правой половине и лента остаётся на месте.
 *
 * ref — элемент окна, on — окно начало въезжать.
 * Возвращает функцию, которую окно вызывает в начале закрытия.
 */
const DURATION = 350;
const EASING = 'cubic-bezier(.32, .72, 0, 1)';
const OPTIONS = { duration: DURATION, easing: EASING, fill: 'forwards' };
const UNDER = [
  '.app .main-content',
  '.app .topbar',
  '.tabbar-wrap',
  '.app-page.is-tab:not(.is-inactive)',
  '.profile-screen-root.is-page:not(.is-pushed):not(.is-inactive)',
  '.app-page.is-pushed',
  '.profile-screen-root.is-pushed .profile-screen-panel',
].join(',');

export function usePushParallax(ref, on) {
  const animations = useRef([]);
  const started = useRef(false);

  useEffect(() => {
    const self = ref.current;
    if (!on || started.current || !self) return;
    started.current = true;
    if (window.innerWidth > 768 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const win = self.closest('.app-page, .profile-screen-root') || self;
    // окна ниже нижней панели (z 70) её не закрывают — панель остаётся на месте
    const coversTabBar = (parseInt(getComputedStyle(win).zIndex, 10) || 0) > 70;

    animations.current = [...document.querySelectorAll(UNDER)]
      .filter((el) => !el.contains(self) && !self.contains(el))
      .filter((el) => coversTabBar || !el.matches('.tabbar-wrap'))
      .map((el) => el.animate([{ translate: '0 0' }, { translate: '-25% 0' }], OPTIONS));
  }, [ref, on]);

  useEffect(() => () => {
    animations.current.forEach((a) => a.cancel());
    animations.current = [];
  }, []);

  // не reverse(): обратный проигрыш разворачивает и кривую, экран под окном
  // сначала стоял и догонял в конце. Новая анимация — та же кривая, что у окна
  return useCallback(() => {
    animations.current = animations.current.map((a) => {
      const back = a.effect.target.animate([{ translate: '-25% 0' }, { translate: '0 0' }], OPTIONS);
      a.cancel();
      return back;
    });
  }, []);
}
