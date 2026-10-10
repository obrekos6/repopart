import React from 'react';

export default function ConfirmEmail({ email, token, setToken, error, loading, onVerify, onBack }) {
  return (
    <form onSubmit={onVerify} className="auth-form">
      <h2 className="auth-title">Введите код</h2>
      <p className="auth-subtitle">
        Мы отправили код подтверждения на <strong>{email}</strong>
      </p>

      <label className="auth-field">
        <span className="auth-label">Код из письма</span>
        <input
          type="text"
          className="auth-input"
          placeholder="00000000"
          value={token}
          onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
          maxLength={8}
          required
          autoFocus
          style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '8px' }}
        />
      </label>

      {error && <p className="auth-error">{error}</p>}

      <button type="submit" className="auth-btn" disabled={loading || token.length < 6}>
        {loading ? '...' : 'Подтвердить'}
      </button>

      <div className="auth-footer">
        <span className="auth-footer-link" onClick={onBack}>Назад</span>
      </div>
    </form>
  );
}