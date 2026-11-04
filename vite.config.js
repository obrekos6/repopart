import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

export default defineConfig({
  plugins: [
    react(),
    svgr({ include: '**/*.svg?react' }),
  ],
  base: '/',
  server: {
    host: '0.0.0.0',
    port: 5173,
    // hmr не задаём: Vite сам подключается к тому же адресу и порту,
    // что открыт в браузере (иначе страница перезагружается по кругу,
    // если сервер стартовал на другом порту или открыт с телефона по IP)
  },
});