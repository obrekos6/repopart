import React from 'react';
import Logo from './assets/icons/Logo';

/* Временная заглушка на время технических работ */
export default function Maintenance() {
  return (
    <main style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 16, padding: 24, textAlign: 'center', background: 'var(--bg-primary)', color: 'var(--text-primary)',
      fontFamily: 'var(--font-main)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--title-color, var(--text-primary))' }}>
        <Logo className="maintenance-logo" />
        <span style={{ fontSize: 24, fontWeight: 600 }}>связь</span>
      </div>
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Мы готовим новую версию</h1>
      <p style={{ margin: 0, maxWidth: 420, fontSize: 17, lineHeight: 1.45, color: 'var(--text-secondary)' }}>
        Сейчас идут технические работы — «связь» полностью обновляется.
        Скоро всё заработает снова, уже в новом виде. Спасибо, что ждёте!
      </p>
    </main>
  );
}
