const fs = require('fs');
const path = require('path');

const DIR = path.join('src', 'assets', 'icons');
const SRC = path.join(DIR, 'Icons.jsx');
const OUT = path.join(DIR, 'svg');

const code = fs.readFileSync(SRC, 'utf8');

const re = /export const (\w+) = \(\{ className, size = (\d+) \}\) => \(\s*<(IconWrapper|IconFill) size=\{size\} className=\{className\}(?: viewBox="([^"]+)")?\s*>([\s\S]*?)<\/\3>\s*\);/g;

const total = (code.match(/^export const /gm) || []).length;
const icons = [...code.matchAll(re)];

if (icons.length === 0 || icons.length !== total) {
  console.error(`Не совпало: найдено иконок ${icons.length}, а export const в файле ${total}. Ничего не изменено.`);
  process.exit(1);
}

const kebab = (name) =>
  name.replace(/Icon$/, '').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

const inner = (s) =>
  s.split('\n').map((l) => l.trim()).filter(Boolean)
    .map((l) => '  ' + l.replace(/fillRule=/g, 'fill-rule=').replace(/clipRule=/g, 'clip-rule='))
    .join('\n');

fs.mkdirSync(OUT, { recursive: true });
fs.copyFileSync(SRC, 'Icons.jsx.bak');

const imports = [];
const exportsList = [];

for (const [, name, size, kind, viewBox, body] of icons) {
  const file = kebab(name) + '.svg';
  const stroke = kind === 'IconWrapper';
  const vb = viewBox || (stroke ? '0 0 24 24' : '0 0 28 28');
  const attrs = stroke
    ? `fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"`
    : `fill="currentColor"`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" ${attrs}>\n${inner(body)}\n</svg>\n`;
  fs.writeFileSync(path.join(OUT, file), svg);

  imports.push(`import Svg${name} from './svg/${file}?react';`);
  exportsList.push(
    `export const ${name} = ({ className, size = ${size} }) => (\n` +
    `  <Svg${name} className={className} width={size} height={size} style={{ display: 'block' }} />\n);`
  );
}

fs.writeFileSync(
  SRC,
  `import React from 'react';\n${imports.join('\n')}\n\n${exportsList.join('\n\n')}\n`
);

console.log(`Готово: ${icons.length} иконок. Копия старого файла: Icons.jsx.bak`);