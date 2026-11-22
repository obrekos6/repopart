import React from 'react';
import ReactDOM from 'react-dom/client';
// на время работ вместо приложения — заглушка (вернуть: App вместо Maintenance)
import Maintenance from './Maintenance.jsx';
import './styles/theme.css';
import './styles/global.css';
import './styles/glass.css';
import './styles/richText.css';
import { initLiquidGlass } from './lib/liquidGlass';
import { initIosScrollbar } from './lib/iosScrollbar';
import { getSetting, applySettings } from './lib/settings';

ReactDOM.createRoot(document.getElementById('root')).render(<Maintenance />);

// настройки с этого устройства (размер текста и т. п.)
applySettings();
initIosScrollbar();

// настоящее жидкое стекло с преломлением (в Chromium; иначе остаётся обычное).
// Его можно выключить: Настройки → Оформление → Жидкое стекло
initLiquidGlass(getSetting('liquidGlass'));