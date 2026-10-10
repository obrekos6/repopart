import React from 'react';

export default function LoginForm({
  email, setEmail, password, setPassword,
  error, loading, showPassword, setShowPassword,
  onSubmit, onSwitch,
}) {
  return (
    <form onSubmit={onSubmit} className="auth-form">
      <h2 className="auth-title">Вход</h2>
      <p className="auth-subtitle">Пожалуйста, введите ваши данные</p>

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
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            className="auth-eye-btn"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? '🙈' : '👁'}
          </button>
        </div>
        <div className="auth-forgot">
          <a href="#" className="auth-forgot-link">Забыли пароль?</a>
        </div>
      </label>

      {error && <p className="auth-error">{error}</p>}

      <button type="submit" className="auth-btn" disabled={loading}>
        {loading ? '...' : 'Далее'}
      </button>

      <div className="auth-footer">
        Еще нет аккаунта?
        <span className="auth-footer-link" onClick={onSwitch}>Создать аккаунт</span>
      </div>
    </form>
  );
}