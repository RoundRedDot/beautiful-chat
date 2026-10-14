// A fresh process for EVERY cold run. No esbuild/TypeScript imports in this process.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { samples } from './cases.mjs';
const require = createRequire(path.resolve(import.meta.dirname, '../../../package.json'));
const [mode, artifact, requested = 'typescript'] = process.argv.slice(2);
if (!global.gc) throw new Error('Run with --expose-gc');
const metrics = {};
async function memory() {
  await new Promise(resolve => setImmediate(resolve));
  global.gc(); global.gc();
  const { rss, heapUsed, external, arrayBuffers } = process.memoryUsage();
  return { rss, heapUsed, external, arrayBuffers };
}
async function timed(name, fn) {
  const t = performance.now(); const value = await fn();
  metrics[name] = performance.now() - t; return value;
}
// File read is excluded from module evaluation, just as host eval receives compiled source.
const code = readFileSync(artifact, 'utf8');
const module = { exports: {} };
await timed('moduleLoadMs', () => new Function('require', 'module', 'exports', code)(require, module, module.exports));
const idle = await memory();
let first, all, loaded;
if (mode === 'eager') {
  const handlers = new Map();
  module.exports.default({ registerSettings() {}, handle(contract, handler) { handlers.set(contract.name, handler); } });
  const handler = handlers.get('highlight.tokens');
  const request = { code: samples[requested], language: requested, dark: true };
  const answer = await timed('firstHighlightMs', () => handler(request));
  if (answer.language !== requested || !answer.lines.flat().some(t => t.color)) throw new Error('Eager handler returned plain text');
  metrics.createMs = globalThis.__p4.createMs;
  metrics.firstTokenMs = globalThis.__p4.tokenMs[0];
  // getEngine/buildEngine includes deferred package evaluation + regex factory + core registration.
  metrics.buildEngineMs = globalThis.__p4BuildEngineMs;
  metrics.deferredPackagesAndFactoryMs = metrics.buildEngineMs - metrics.createMs;
  first = await memory();
  await timed('subsequentCachedMs', () => handler(request));
  await timed('subsequentUncachedMs', () => handler({ ...request, code: request.code + '\nconst extra = 3;' }));
  metrics.perLanguageRequestMs = {};
  for (const [language, snippet] of Object.entries(samples)) {
    const t = performance.now();
    await handler({ code: snippet, language, dark: true });
    metrics.perLanguageRequestMs[language] = performance.now() - t;
  }
  all = await memory(); loaded = globalThis.__p4.highlighter.getLoadedLanguages().sort();
} else {
  const { base, loaders } = module.exports;
  const { core, regex, themes } = await timed('basePackagesMs', base);
  const h = await timed('baseCreateMs', () => core.createHighlighterCore({ themes, langs: [], engine: regex.createJavaScriptRegexEngine({ forgiving: true }) }));
  const baseMemory = await memory();
  const markdownGroup = Object.keys(samples).filter(id => !['jsx', 'toml'].includes(id));
  const group = requested === 'markdown-group' ? markdownGroup : requested === 'html' ? ['html', 'javascript', 'css'] : [requested];
  const grammars = await timed('grammarPackagesMs', () => Promise.all(group.map(id => loaders[id]())));
  await timed('loadLanguageMs', () => h.loadLanguage(...grammars));
  const registeredMemory = await memory();
  const language = requested === 'markdown-group' ? 'markdown' : requested;
  await timed('firstTokenMs', () => h.codeToTokens(samples[language], { lang: language, theme: 'github-dark-default' }));
  metrics.firstLoadMs = metrics.grammarPackagesMs + metrics.loadLanguageMs + metrics.firstTokenMs;
  metrics.firstHighlightMs = metrics.basePackagesMs + metrics.baseCreateMs + metrics.firstLoadMs;
  first = await memory();
  metrics.heapRegistrationDelta = registeredMemory.heapUsed - baseMemory.heapUsed;
  metrics.heapFirstDelta = first.heapUsed - idle.heapUsed;
  await timed('subsequentTokenMs', () => h.codeToTokens(samples[language], { lang: language, theme: 'github-dark-default' }));
  // Same supported set and markdown group; no handler/client/production implementation changes.
  await h.loadLanguage(...await Promise.all(Object.keys(samples).map(id => loaders[id]())));
  for (const [lang, snippet] of Object.entries(samples)) h.codeToTokens(snippet, { lang, theme: 'github-dark-default' });
  all = await memory(); loaded = h.getLoadedLanguages().sort();
  metrics.baseMemory = baseMemory;
}
metrics.heapFirstDelta ??= first.heapUsed - idle.heapUsed;
metrics.heapAllDelta = all.heapUsed - idle.heapUsed;
console.log(JSON.stringify({ mode, requested, pid: process.pid, metrics, memory: { idle, first, all }, loaded }));
