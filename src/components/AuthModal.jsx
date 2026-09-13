import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import './AuthModal.css';

export default function AuthModal() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const switchMode = (m) => { setMode(m); setError(''); };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    setMode('confirm');
    setLoading(false);
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email, token: code, type: 'signup',
    });
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div className="auth-overlay">
      <div className="auth-modal">
        <div className="auth-logo">RepoPart</div>

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="auth-form">
            <h2 className="auth-title">Вход</h2>
            <input
              type="email" className="auth-input" placeholder="Почта"
              value={email} onChange={(e) => setEmail(e.target.value)} required
            />
            <input
              type="password" className="auth-input" placeholder="Пароль"
              value={password} onChange={(e) => setPassword(e.target.value)} required
            />
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" className="auth-primary" disabled={loading}>
              {loading ? '...' : 'Продолжить'}
            </button>
            <button type="button" className="auth-link" onClick={() => switchMode('register')}>
              Зарегистрироваться
            </button>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister} className="auth-form">
            <h2 className="auth-title">Регистрация</h2>
            <input
              type="email" className="auth-input" placeholder="Почта"
              value={email} onChange={(e) => setEmail(e.target.value)} required
            />
            <input
              type="password" className="auth-input" placeholder="Пароль"
              value={password} onChange={(e) => setPassword(e.target.value)}
              required minLength={6}
            />
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" className="auth-primary" disabled={loading}>
              {loading ? '...' : 'Далее'}
            </button>
            <button type="button" className="auth-link" onClick={() => switchMode('login')}>
              Вход
            </button>
          </form>
        )}

        {mode === 'confirm' && (
          <form onSubmit={handleConfirm} className="auth-form">
            <h2 className="auth-title">Подтверждение</h2>
            <p className="auth-hint">Мы отправили код на {email}</p>
            <input
              type="text" className="auth-input" placeholder="Код из письма"
              value={code} onChange={(e) => setCode(e.target.value)} required
              maxLength={6}
            />
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" className="auth-primary" disabled={loading}>
              {loading ? '...' : 'Подтвердить'}
            </button>
            <button type="button" className="auth-link" onClick={() => switchMode('login')}>
              Назад
            </button>
          </form>
        )}
      </div>
    </div>
  );
}