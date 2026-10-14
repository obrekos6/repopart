import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Logo from '../../assets/icons/Logo';
import LoginForm from './components/LoginForm';
import './AuthScreen.css';

const FAKE_DOMAIN = 'xn--b1ak2a9bn.com';

export default function AuthScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    document.body.classList.add('auth-lock-scroll');
    return () => document.body.classList.remove('auth-lock-scroll');
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('svyaz-username');
    if (saved) setUsername(saved);
  }, []);

  /* login: resolve username → email → signInWithPassword */
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const raw = username.trim().toLowerCase();
    let email = raw;

    if (!raw.includes('@')) {
      /* lookup email by username */
      const { data } = await supabase
        .from('profiles')
        .select('email')
        .ilike('username', raw)
        .maybeSingle();

      if (!data?.email) {
        setError('Юзернейм не найден');
        setLoading(false);
        return;
      }
      email = data.email;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) setError('Неверный юзернейм, почта или пароль');
    else localStorage.setItem('svyaz-username', raw);

    setLoading(false);
  };

  const handleGoogle = async () => {
    setError('');
    setLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay">
      <div className="auth-logo">
        <div className="auth-logo-cell" />
        <div className="auth-logo-glass">
          <Logo className="auth-logo-icon" />
          <span className="auth-logo-text">связь</span>
        </div>
        <div className="auth-logo-cell auth-logo-cell-right">
          <span className="auth-beta-capsule">BETA</span>
        </div>
      </div>

      <div className="auth-container">
        <LoginForm
          username={username}
          setUsername={setUsername}
          password={password}
          setPassword={setPassword}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          error={error}
          loading={loading}
          onSubmit={handleLogin}
          onGoogle={handleGoogle}
        />
      </div>
    </div>
  );
}