import React, { useState } from 'react';
import Topbar from './components/Topbar';
import PublicationList from './components/PublicationList';
import './styles/theme.css';
import './styles/global.css';

const DISCORD_STYLE_EMPTY_MESSAGES = [
  "Вампус пытался что-то найти, но отвлёкся на белку.",
  "Тут тихо... подозрительно тихо.",
  "Пока нечего показать. Даже алгоритму нужен кофе.",
  "Вайбы не найдены. Попробуйте позже!",
];

function App() {
  const [publications, setPublications] = useState([]);

  const [emptyMessage] = useState(
    () => DISCORD_STYLE_EMPTY_MESSAGES[Math.floor(Math.random() * DISCORD_STYLE_EMPTY_MESSAGES.length)]
  );

  const handleCreatePublication = (newPub) => {
    setPublications(prev => [newPub, ...prev]);
  };

  return (
    <div className="app">
      <Topbar onCreatePublication={handleCreatePublication} />
      <main className="main-content">
        <section className="interests-section">
          <h2 className="section-title">Вот что у нас для вас есть...</h2>

          {publications.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon" aria-hidden="true">🛰️</div>
              <p className="empty-state-text">{emptyMessage}</p>
              <p className="empty-state-subtext">
                Показывать пока нечего — загляните позже, когда появятся репозитории.
              </p>
            </div>
          ) : (
            <PublicationList publications={publications} />
          )}
        </section>
      </main>
    </div>
  );
}

export default App;