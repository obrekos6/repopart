import React, { useState, useEffect } from 'react';
import FeedScreen from './windows/Feed/FeedScreen';
import AuthScreen from './windows/Auth/AuthScreen';
import { supabase } from './lib/supabaseClient';
import './styles/theme.css';
import './styles/global.css';

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    );
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div className="loading-screen">Загрузка...</div>;
  return session ? <FeedScreen /> : <AuthScreen />;
}