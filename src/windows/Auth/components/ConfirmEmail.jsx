import React from 'react';

export default function ConfirmEmail({ email, onBack }) {
  return (
    <div className="auth-form">
      <h2 className="auth-title">Подтверждение</h2>
      <p className="auth-subtitle">
        Мы отправили ссылку для подтверждения на <strong>{email}</strong>.
        Перейдите по ней, а затем вернитесь сюда и войдите.
      </p>
      <button type="button" className="auth-btn" onClick={onBack}>
        Войти
      </button>
    </div>
  );
}