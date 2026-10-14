import React from 'react';
import { Link } from 'react-router-dom';
import Logo from '../../assets/icons/Logo';
import './LandingScreen.css';

export default function LandingScreen({ user, loading }) {
  const authed = !loading && user;

  return (
    <div className="landing">
      <div className="landing-container">
        <div className="landing-logo">
          <Logo className="landing-logo-icon" />
          <span className="landing-logo-text">связь</span>
        </div>

        <h1 className="landing-title">связь</h1>
        <p className="landing-purpose">
          Социальная сеть для обмена публикациями, медиафайлами и общения.
        </p>

        <div className="landing-features">
          <div className="landing-feature">
            <div className="landing-feature-title">Публикации</div>
            <div className="landing-feature-desc">
              Делись фотографиями, видео и музыкой с друзьями.
            </div>
          </div>
          <div className="landing-feature">
            <div className="landing-feature-title">Комментарии</div>
            <div className="landing-feature-desc">
              Обсуждай посты и находи новых людей по интересам.
            </div>
          </div>
          <div className="landing-feature">
            <div className="landing-feature-title">Вход через Google</div>
            <div className="landing-feature-desc">
              Быстрый и безопасный вход в один клик.
            </div>
          </div>
        </div>

        <Link to={authed ? '/feed' : '/auth'} className="landing-btn">
          {authed ? 'Перейти в ленту' : 'Войти'}
        </Link>

        <div className="landing-compliance">
          <p>
            Приложение «связь» не использует Google API для создания
            или распространения несогласованных интимных изображений (NCII),
            в том числе сгенерированных искусственным интеллектом.
          </p>
        </div>

        <div className="landing-links">
          <Link to="/privacy.html" className="landing-link">Политика конфиденциальности</Link>
          <span className="landing-sep">·</span>
          <Link to="/terms.html" className="landing-link">Условия использования</Link>
        </div>
      </div>
    </div>
  );
}