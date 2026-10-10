import React from 'react';

export default function RegisterForm({
  email, setEmail, password, setPassword,
  error, loading, showPassword, setShowPassword,
  onSubmit, onSwitch,
}) {
  return (
    <form onSubmit={onSubmit} className="auth-form">
      <h2 className="auth-title">Регистрация</h2>
      <p className="auth-subtitle">Создайте новый аккаунт</p>

      <label className="auth-field">
        <span className="auth-label">E-Mail</span>
        <input
          type="email"
          className="auth-input"
          placeholder="ermolich@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>

      <label className="auth-field">
        <span className="auth-label">Пароль</span>
        <div className="auth-password-wrapper">
          <input
            type={showPassword ? 'text' : 'password'}
            className="auth-input"
            placeholder="Минимум 6 символов"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <button
            type="button"
            className="auth-eye-btn"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? '🙈' : '👁'}
          </button>
        </div>
      </label>

      {error && <p className="auth-error">{error}</p>}

      <button type="submit" className="auth-btn" disabled={loading}>
        {loading ? '...' : 'Далее'}
      </button>

      <div className="auth-footer">
        Уже есть аккаунт?
        <span className="auth-footer-link" onClick={onSwitch}>Войти</span>
      </div>
    </form>
  );
}