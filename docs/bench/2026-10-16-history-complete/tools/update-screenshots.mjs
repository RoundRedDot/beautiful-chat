import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

const [repo, captures, captures1x] = process.argv.slice(2).map(value => resolve(value));
if (!repo || !captures || !captures1x) throw Error('repository and both capture directories required');
const assets = [
  ...['dark', 'light'].map(theme => ({ source: join(captures, theme, 'shot-hero-devices.png'), destination: `images/hero-devices-${theme}.png`, scene: 'shot-hero-devices', theme, locale: 'en-US', scale: 2 })),
  ...['thread', 'questions', 'tool-bash', 'tool-read', 'tool-edit', 'hub', 'tool-mcp', 'paseo', 'tool-thinking', 'tool-image', 'syntax', 'reasoning', 'tasks', 'checklist-window', 'table-copy-menu', 'table-selection', 'markdown-styles', 'markdown-preview-window', 'shared-image-cards', 'selection-actions', 'user'].map(name => ({ source: join(captures1x, 'dark', `shot-${name}.png`), destination: name === 'thread' ? 'images/thread.png' : `docs/images/${name}.png`, scene: `shot-${name}`, theme: 'dark', locale: 'en-US', scale: 1 })),
  ...['en-US', 'zh-CN'].flatMap(locale => [['settings-wide', 'settings'], ['settings-block-size', 'settings-tools']].map(([scene, name]) => ({ source: join(captures1x, ...(locale === 'en-US' ? [] : [locale]), 'dark', `shot-${scene}.png`), destination: `docs/images/${name}${locale === 'en-US' ? '' : '-zh'}.png`, scene: `shot-${scene}`, theme: 'dark', locale, scale: 1 }))),
];
// Validate every capture before replacing any published asset.
for (const asset of assets) {
  const bytes = readFileSync(asset.source);
  if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw Error(`invalid PNG: ${asset.source}`);
  asset.width = bytes.readUInt32BE(16);
  asset.height = bytes.readUInt32BE(20);
  if (asset.width < 100 || asset.height < 50) throw Error(`empty capture: ${asset.source}`);
  asset.sha256 = createHash('sha256').update(bytes).digest('hex');
}
for (const asset of assets) copyFileSync(asset.source, join(repo, asset.destination));
const record = {
  capturedAt: '2026-10-16',
  sourceSha: '7f01b2d95c87cb6879adf701571de3778a167060',
  surface: 'Local offline React Native Web showcase; fixture screenshots, not native device acceptance',
  sourceTrackedChangesAtStart: [],
  command: 'SHOT_SCALE=<scale> SHOT_LOCALE=<locale> node .showcase/tools/shots.mjs . <captures> <theme>',
  assets: assets.map(({ source, ...asset }) => asset),
};
const raw = join(repo, 'docs/bench/2026-10-16-history-complete/raw');
mkdirSync(raw, { recursive: true });
writeFileSync(join(raw, 'screenshots.json'), JSON.stringify(record, null, 2) + '\n');
console.log(`${assets.length} README screenshots refreshed from ${record.sourceSha}`);
