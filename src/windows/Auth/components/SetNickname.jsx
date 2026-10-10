import React, { useState } from 'react';

export default function SetNickname({ email, error, loading, onSave }) {
  const [nickname, setNickname] = useState('');
  const suggested = email ? email.split('@')[0] : 'username';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nickname.trim()) return;
    onSave(nickname.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <h2 className="auth-title">Как вас называть?</h2>
      <p className="auth-subtitle">
        Придумайте никнейм — его увидят другие пользователи.
      </p>

      <label className="auth-field">
        <span className="auth-label">Никнейм</span>
        <input
          type="text"
          className="auth-input"
          placeholder={suggested}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={30}
          autoFocus
          required
        />
      </label>

      {error && <p className="auth-error">{error}</p>}

      <button
        type="submit"
        className="auth-btn"
        disabled={loading || !nickname.trim()}
      >
        {loading ? '...' : 'Готово'}
      </button>
    </form>
  );
}