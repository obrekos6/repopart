import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import LandingScreen from './windows/Landing/LandingScreen';
import AuthScreen from './windows/Auth/AuthScreen';
import FeedScreen from './windows/Feed/FeedScreen';
import './styles/theme.css';
import './styles/global.css';

/* GH Pages 404 redirect trick: restore path after index loaded */
const savedRedirect = sessionStorage.getItem('spa-redirect');
if (savedRedirect) {
  sessionStorage.removeItem('spa-redirect');
  window.history.replaceState(null, '', savedRedirect);
}

function ProtectedFeed({ user, loading }) {
  if (loading) return <div className="loading-screen">Загрузка...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <FeedScreen />;
}

function AuthRoute({ user, loading }) {
  if (loading) return <div className="loading-screen">Загрузка...</div>;
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