import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const raw = path.join(import.meta.dirname, 'raw');
const runs = JSON.parse(readFileSync(path.join(raw, 'cold-runs.json'), 'utf8'));
const sessions = JSON.parse(readFileSync(path.join(raw, 'sessions.json'), 'utf8'));
export function stats(values) {
  const sorted = values.toSorted((a, b) => a - b);
  return { n: sorted.length, median: (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2, min: sorted[0], max: sorted.at(-1) };
}
const groups = {};
for (const run of runs) (groups[`${run.mode}/${run.requested}`] ??= []).push(run);
const summary = {};
for (const [key, rows] of Object.entries(groups)) {
  const metrics = {};
  for (const field of Object.keys(rows[0].metrics)) {
    if (typeof rows[0].metrics[field] === 'number') metrics[field] = stats(rows.map(row => row.metrics[field]));
  }
  if (key.startsWith('group/')) metrics.grammarInitMs = stats(rows.map(row => row.metrics.grammarPackagesMs + row.metrics.loadLanguageMs));
  const memory = {};
  for (const stage of ['idle', 'first', 'all']) {
    memory[stage] = {};
    for (const field of ['rss', 'heapUsed', 'external', 'arrayBuffers']) memory[stage][field] = stats(rows.map(row => row.memory[stage][field]));
  }
  const aa = {};
  if (rows.length === 10) for (const field of ['firstHighlightMs', 'buildEngineMs', 'heapFirstDelta', 'heapAllDelta']) {
    if (!metrics[field]) continue;
    const pairs = [];
    for (let i = 0; i < 10; i += 2) {
      const a = rows[i].metrics[field], b = rows[i + 1].metrics[field];
      pairs.push({ a, b, difference: b - a, percent: 100 * (b - a) / a });
    }
    aa[field] = { pairs, maxAbsoluteDifference: Math.max(...pairs.map(p => Math.abs(p.difference))) };
  }
  summary[key] = { metrics, memory, aa };
}
const eagerInit = summary['eager/typescript'].metrics.buildEngineMs;
const base = stats(groups['group/typescript'].map(row => row.metrics.basePackagesMs + row.metrics.baseCreateMs));
const dispersion = sessions.map(session => {
  const costs = session.firstLoads.map(load => summary[`group/${load.id}`].metrics);
  return { ...session, requests: undefined,
    eagerInitMs: session.eagerInitEvents ? eagerInit : stats([0]),
    lazyGrammarSumMs: {
      median: costs.reduce((n, c) => n + c.grammarInitMs.median, 0),
      min: costs.reduce((n, c) => n + c.grammarInitMs.min, 0),
      max: costs.reduce((n, c) => n + c.grammarInitMs.max, 0),
    },
    lazyWithBaseMs: costs.length ? {
      median: base.median + costs.reduce((n, c) => n + c.grammarInitMs.median, 0),
      min: base.min + costs.reduce((n, c) => n + c.grammarInitMs.min, 0),
      max: base.max + costs.reduce((n, c) => n + c.grammarInitMs.max, 0),
    } : { median: 0, min: 0, max: 0 },
    lazyFirstLoadIncludingTokenSumMs: {
      median: costs.reduce((n, c) => n + c.firstLoadMs.median, 0),
      min: costs.reduce((n, c) => n + c.firstLoadMs.min, 0),
      max: costs.reduce((n, c) => n + c.firstLoadMs.max, 0),
    },
  };
});
const comparisons = {};
for (const [name, eager, candidate] of [['typescript', 'eager/typescript', 'group/typescript'], ['markdown', 'eager/markdown', 'group/markdown-group']]) {
  comparisons[name] = {};
  for (const field of ['firstHighlightMs', 'heapFirstDelta']) {
    comparisons[name][field] = stats(groups[eager].map((row, index) => groups[candidate][index].metrics[field] - row.metrics[field]));
  }
  // Init excludes first tokenisation; model base once, then package evaluation + loadLanguage.
  comparisons[name].initDeltaMs = stats(groups[eager].map((row, index) => {
    const m = groups[candidate][index].metrics;
    return m.basePackagesMs + m.baseCreateMs + m.grammarPackagesMs + m.loadLanguageMs - row.metrics.buildEngineMs;
  }));
}
writeFileSync(path.join(raw, 'summary.json'), JSON.stringify({ summary, base, dispersion, comparisons }, null, 2) + '\n');
console.log(JSON.stringify({ eagerInit, base, comparisons, dispersion: dispersion.map(({fixture,scope,order,lazyGrammarSumMs,lazyWithBaseMs,eagerInitEvents,lazyInitEvents})=>({fixture,scope,order,lazyGrammarSumMs,lazyWithBaseMs,eagerInitEvents,lazyInitEvents})) }, null, 2));
