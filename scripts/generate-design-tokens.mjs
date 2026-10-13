import { readFileSync, writeFileSync } from 'node:fs';
import { URL } from 'node:url';
import process from 'node:process';
import { format, resolveConfig } from 'prettier';

// Source names stay in the JSON; slash/space become kebab-case in CSS.
const data = JSON.parse(
  readFileSync(
    new URL('../src/styles/figma-tokens.json', import.meta.url),
    'utf8',
  ),
);
const name = (value) =>
  value.replaceAll('/', '-').replaceAll(' ', '-').toLowerCase();
const color = (value) => {
  const channels = [value.r, value.g, value.b].map((v) => Math.round(v * 255));
  return value.a === 1
    ? '#' + channels.map((v) => v.toString(16).padStart(2, '0')).join('')
    : `rgb(${channels.join(' ')} / ${Math.round(value.a * 100)}%)`;
};
const declarations = data.variables.map(({ name: key, type, value }) => {
  const cssValue = value.alias
    ? `var(--${name(value.alias)})`
    : type === 'COLOR'
      ? color(value)
      : type === 'FLOAT'
        ? `${value}px`
        : JSON.stringify(value);
  return `  --${name(key)}: ${cssValue};`;
});
for (const { name: key, effects } of data.effects) {
  const cssValue = effects
    .map(
      (e) =>
        `${e.offset.x}px ${e.offset.y}px ${e.radius}px ${e.spread}px ${color(e.color)}`,
    )
    .join(', ');
  declarations.push(`  --${name(key)}: ${cssValue};`);
}
const weight = { Regular: 400, Medium: 500, SemiBold: 600, Bold: 700 };
for (const t of data.text)
  declarations.push(
    `  --type-${name(t.name)}: ${weight[t.font.style]} ${t.size}px/${t.line.value}px var(--font-family), system-ui, sans-serif;`,
  );
const utilities = data.text
  .map(
    (t) =>
      `@utility type-${name(t.name)} {\n  font: var(--type-${name(t.name)});\n}`,
  )
  .join('\n\n');
const css = await format(
  `/* Generated from figma-tokens.json. Run pnpm tokens:generate. */\n:root {\n${declarations.join('\n')}\n}\n\n${utilities}\n`,
  { ...(await resolveConfig('src/styles/tokens.css')), parser: 'css' },
);
const path = new URL('../src/styles/tokens.css', import.meta.url);
if (process.argv.includes('--check')) {
  if (readFileSync(path, 'utf8') !== css)
    throw new Error('Stale design tokens: run pnpm tokens:generate');
} else writeFileSync(path, css);
