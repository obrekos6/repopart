import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/theme.css';
import './styles/global.css';
import './styles/glass.css';
import './styles/richText.css';
import { initLiquidGlass } from './lib/liquidGlass';
import { getSetting, applySettings } from './lib/settings';

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

// настройки с этого устройства (размер текста и т. п.)
applySettings();

// настоящее жидкое стекло с преломлением (в Chromium; иначе остаётся обычное).
// Его можно выключить: Настройки → Оформление → Жидкое стекло
initLiquidGlass(getSetting('liquidGlass'));