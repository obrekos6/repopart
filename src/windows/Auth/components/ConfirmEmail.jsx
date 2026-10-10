import React from 'react';

export default function ConfirmEmail({ email, onBack }) {
  return (
    <div className="auth-form">
      <h2 className="auth-title">Подтверждение</h2>
      <p className="auth-subtitle">
        Мы отправили ссылку на <strong>{email}</strong>. Перейди по ней и вернись, чтобы войти.
      </p>
      <button className="auth-btn" onClick={onBack}>Войти</button>
    </div>
  );
}