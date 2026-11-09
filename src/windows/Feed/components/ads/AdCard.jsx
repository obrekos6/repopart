import React, { useEffect, useRef, useState } from 'react';
import { useT } from '../../../../lib/i18n';
import { AD_BLOCK_ID, loadYandexAds } from '../../../../lib/ads';
import './AdCard.css';

/* Рекламный пост: выглядит как обычный пост, в углу капсула «Реклама».
   Картинку и текст объявления подставляет Рекламная сеть Яндекса.
   Если реклама не пришла (нет показов, блокировщик) — карточка не показывается. */
export default function AdCard({ slot }) {
  const t = useT();
  const boxRef = useRef(null);
  const [state, setState] = useState(AD_BLOCK_ID ? 'loading' : 'demo');
  const id = `yandex-ad-${slot}`;

  useEffect(() => {
    if (!AD_BLOCK_ID) return undefined;
    let dead = false;
    loadYandexAds()
      .then(() => {
        window.yaContextCb.push(() => {
          if (dead) return;
          window.Ya.Context.AdvManager.render({
            blockId: AD_BLOCK_ID,
            renderTo: id,
            pageNumber: slot + 1, // в ленте у каждого блока свой номер
            onRender: () => !dead && setState('ok'),
            onError: () => !dead && setState('empty'),
          }, () => !dead && setState('empty')); // нет подходящей рекламы
        });
      })
      .catch(() => !dead && setState('empty'));
    return () => { dead = true; };
  }, [id, slot]);

  if (state === 'empty') return null;
  if (state === 'demo' && !import.meta.env.DEV) return null;

  return (
    <div className={`post-card ad-card ${state === 'loading' ? 'is-loading' : ''}`}>
      <span className="ad-capsule">{t('ads.label')}</span>
      {state === 'demo' ? (
        // образец — только при разработке, пока нет ID блока
        <div className="ad-demo">
          <div className="ad-demo-title">Название рекламодателя</div>
          <div className="ad-demo-img" />
          <div className="ad-demo-text">Здесь будет текст объявления от Яндекса.</div>
        </div>
      ) : (
        <div id={id} ref={boxRef} className="ad-box" />
      )}
    </div>
  );
}
