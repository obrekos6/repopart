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

      <div className="auth-field">
        <label className="auth-label">E-Mail</label>
        <input
          type="email"
          className="auth-input"
          placeholder="ermolich@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="auth-field">
        <label className="auth-label">Пароль</label>
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
            {showPassword ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            )}
          </button>
        </div>
      </div>

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