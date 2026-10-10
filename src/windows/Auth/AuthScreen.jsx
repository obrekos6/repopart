import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Logo from '../../assets/icons/Logo';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import ConfirmEmail from './components/ConfirmEmail';
import './AuthScreen.css';

export default function AuthScreen() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else localStorage.setItem('svyaz-email', email);
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    });
    if (error) setError(error.message);
    else {
      localStorage.setItem('svyaz-email', email);
      setMode('confirm');
    }
    setLoading(false);
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
          <ConfirmEmail email={email} onBack={() => switchMode('login')} />
        )}
      </div>
    </div>
  );
}