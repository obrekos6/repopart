import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import { useT } from './lib/i18n';
import LandingScreen from './windows/Landing/LandingScreen';
import AuthScreen from './windows/Auth/AuthScreen';
import FeedScreen from './windows/Feed/FeedScreen';
import './styles/theme.css';
import './styles/global.css';
import './styles/glass.css';
import './styles/richText.css';

function ProtectedFeed({ user, loading }) {
  if (loading) return <div className="loading-screen" />;
  if (!user) return <Navigate to="/auth" replace />;
  return <BanGate user={user}><FeedScreen /></BanGate>;
}

// забаненный видит только этот экран; публиковать ему не даёт сама база
function BanGate({ user, children }) {
  const t = useT();
  const [banned, setBanned] = useState(false);
  useEffect(() => {
    supabase.from('profiles').select('is_banned').eq('id', user.id).maybeSingle()
      .then(({ data }) => setBanned(!!data?.is_banned));
  }, [user.id]);
  if (!banned) return children;
  return (
    <div className="banned-screen">
      <h1>{t('banned.title')}</h1>
      <p>{t('banned.text')}</p>
      <button type="button" onClick={() => supabase.auth.signOut()}>{t('st.logout')}</button>
    </div>
  );
}

function AuthRoute({ user, loading }) {
  if (loading) return <div className="loading-screen" />;
  if (user) return <Navigate to="/feed" replace />;
  return <AuthScreen />;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingScreen user={user} loading={loading} />} />
        <Route path="/auth" element={<AuthRoute user={user} loading={loading} />} />
        <Route path="/feed" element={<ProtectedFeed user={user} loading={loading} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}