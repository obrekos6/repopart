import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Logo from '../../assets/icons/Logo';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import ConfirmEmail from './components/ConfirmEmail';
import SetNickname from './components/SetNickname'; // <-- Новый компонент
import './AuthScreen.css';

export default function AuthScreen() {
  const [mode, setMode] = useState('login'); // login | register | confirm | nickname
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('svyaz-email');
    if (saved) setEmail(saved);
  }, []);

  const switchMode = (m) => {
    setMode(m);
    setError('');
    setShowPassword(false);
    setToken('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else localStorage.setItem('svyaz-email', email);
    setLoading(false);
  };

  // Регистрация: только email + password
  const handleRegister = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);

    const { error } = await supabase.auth.signUp({ email, password });

    if (error) setError(error.message);
    else {
      localStorage.setItem('svyaz-email', email);
      setMode('confirm');
    }
    setLoading(false);
  };

  // Проверка OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);

    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup',
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // После успешной верификации переходим к вводу никнейма
      setLoading(false);
      setMode('nickname');
    }
  };

  // Сохранение никнейма в profiles
  const handleSaveNickname = async (nickname) => {
    setError(''); setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError('Пользователь не найден');
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        username: nickname.trim(),
        updated_at: new Date().toISOString(),
      });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // Если успешно — Supabase уже создал сессию, 
    // App.jsx увидит это и переключит на ленту.
  };

  const props = {
    email, setEmail, password, setPassword,
    error, loading, showPassword, setShowPassword,
  };

  return (
    <div className="auth-overlay">
      <div className="auth-logo">
        <Logo className="auth-logo-icon" />
        <span className="auth-logo-text">связь</span>
      </div>

      <div className="auth-container">
        {mode === 'login' && (
          <LoginForm {...props} onSubmit={handleLogin} onSwitch={() => switchMode('register')} />
        )}
        {mode === 'register' && (
          <RegisterForm {...props} onSubmit={handleRegister} onSwitch={() => switchMode('login')} />
        )}
        {mode === 'confirm' && (
          <ConfirmEmail
            email={email}
            token={token}
            setToken={setToken}
            error={error}
            loading={loading}
            onVerify={handleVerifyOtp}
            onBack={() => switchMode('login')}
          />
        )}
        {mode === 'nickname' && (
          <SetNickname
            email={email}
            error={error}
            loading={loading}
            onSave={handleSaveNickname}
          />
        )}
      </div>
    </div>
  );
}