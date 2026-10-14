import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { groupBundle, root, serverBundle, loadServer } from './harness.mjs';
import { samples } from './cases.mjs';
const golden = JSON.parse(readFileSync(path.join(root, 'test/fixtures/p4-highlight/eager.json'), 'utf8'));
// Validate that timing-only instrumentation did not change ANY frozen handler answer.
const handler = loadServer(await serverBundle({ observe: false }));
for (const { input, output } of golden.cases) assert.deepEqual(await handler(input), output);
for (const { input, language } of golden.resolver) assert.equal((await handler(input)).language, language);
const module = { exports: {} };
new Function('module', 'exports', await groupBundle())(module, module.exports);
const { core, regex, themes } = await module.exports.base();
const h = await core.createHighlighterCore({ themes, langs: [], engine: regex.createJavaScriptRegexEngine({ forgiving: true }) });
const group = Object.keys(samples).filter(id => !['jsx', 'toml'].includes(id));
await h.loadLanguage(...await Promise.all(group.map(id => module.exports.loaders[id]())));
assert.equal(h.getLoadedLanguages().filter(id => Object.hasOwn(samples, id)).length, 16);
for (const dark of [true, false]) {
  const { output } = golden.cases.find(item => item.name === `markdown-${dark}`);
  const lines = h.codeToTokens(samples.markdown, { lang: 'markdown', theme: output.theme }).tokens.map(tokens =>
    tokens.filter(token => token.content).map(token => ({ text: token.content, color: token.color ?? null,
      ...((token.fontStyle & 2) ? { bold: true } : {}), ...((token.fontStyle & 1) ? { italic: true } : {}) })));
  assert.deepEqual(lines, output.lines);
}
console.log('Uninstrumented handler: 56 outputs + 192 resolver rows equal; markdown group: 16 grammars, both themes equal');
