import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import '@fontsource/roboto/cyrillic-400.css';
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/cyrillic-400-italic.css';
import '@fontsource/roboto/latin-400-italic.css';
import '@fontsource/roboto/cyrillic-500.css';
import '@fontsource/roboto/latin-500.css';
import '@fontsource/roboto/cyrillic-700.css';
import '@fontsource/roboto/latin-700.css';
import './styles/theme.css';
import './styles/global.css';
import './styles/glass.css';
import './styles/richText.css';
import { initLiquidGlass } from './lib/liquidGlass';
import { initIosScrollbar } from './lib/iosScrollbar';
import { getSetting, applySettings } from './lib/settings';

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

// настройки с этого устройства (размер текста и т. п.)
applySettings();
// тестовый шрифт: только на localhost (файл в .gitignore)
// glob не ломает сборку, если файла нет (на GitHub его нет)
if (import.meta.env.DEV) Object.values(import.meta.glob('./styles/devFont.css')).forEach((load) => load());
initIosScrollbar();

// настоящее жидкое стекло с преломлением (в Chromium; иначе остаётся обычное).
// Его можно выключить: Настройки → Оформление → Жидкое стекло
initLiquidGlass(getSetting('liquidGlass'));