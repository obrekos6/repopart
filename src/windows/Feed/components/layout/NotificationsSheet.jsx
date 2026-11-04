import React from 'react';
import { useT } from '../../../../lib/i18n';
import Page from './Page';
import { BellIcon } from '../../../../assets/icons/Icons';
import './Sheet.css';

/*
 * Уведомления. Пока в базе нет таблицы уведомлений, поэтому шторка
 * показывает пустое состояние. Когда появится таблица (например, notifications:
 * кто лайкнул/прокомментировал ваш пост), список подключается сюда.
 */
export default function NotificationsSheet({ onClose }) {
  const t = useT();
  return (
    <Page title={t('notif.title')} onClose={onClose}>
      <div className="sheet-empty">
        <div className="sheet-empty-icon"><BellIcon size={48} /></div>
        <div className="sheet-empty-title">{t('notif.empty')}</div>
        <div className="sheet-empty-text">{t('notif.emptySub')}</div>
      </div>
    </Page>
  );
}
