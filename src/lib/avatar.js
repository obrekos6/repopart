const COLORS = [
  'rgb(255, 56, 60)',   // Red
  'rgb(255, 141, 40)',  // Orange
  'rgb(255, 204, 0)',   // Yellow
  'rgb(52, 199, 89)',   // Green
  'rgb(0, 200, 179)',   // Mint
  'rgb(0, 195, 208)',   // Teal
  'rgb(0, 192, 232)',   // Cyan
  'rgb(0, 136, 255)',   // Blue
  'rgb(97, 85, 245)',   // Indigo
  'rgb(203, 48, 224)',  // Purple
  'rgb(255, 45, 85)',   // Pink
  'rgb(172, 127, 94)',  // Brown
];

export const colorFromString = (str = '') => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
};

export const initialFromString = (str = '') => {
  const s = str.trim();
  return s ? s[0].toUpperCase() : '?';
};