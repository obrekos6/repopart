import React, { useState, useEffect } from 'react';
import Topbar from './components/Topbar';
import PublicationList from './components/PublicationList';
import AuthModal from './components/AuthModal.jsx';
import { supabase } from './lib/supabaseClient';
import './styles/theme.css';
import './styles/global.css';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [publications, setPublications] = useState([]);

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

  const loadPublications = async () => {
    const { data } = await supabase
      .from('repositories')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setPublications(data);
  };

  useEffect(() => {
    if (session) loadPublications();
  }, [session]);

  if (loading) {
    return <div className="loading-screen">Загрузка...</div>;
  }

  if (!session) {
    return <AuthModal onSuccess={() => {}} />;
  }

  return (
    <div className="app">
      <Topbar onCreatePublication={loadPublications} />
      <main className="main-content">
        <section className="interests-section">
          <h2 className="section-title">Вот что у нас для вас есть...</h2>
          <PublicationList
            publications={publications}
            onUpdate={loadPublications}
          />
        </section>
      </main>
    </div>
  );
}

export default App;