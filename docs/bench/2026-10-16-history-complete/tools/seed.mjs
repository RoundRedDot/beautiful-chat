// Untimed synthetic preparation. Credentials never leave this process.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const root = process.env.BC_ROOT;
const home = process.env.BC_BENCH_HOME;
const cli = process.env.BC_PASEO_BIN;
if (!root || !home?.includes('bench') || !cli) throw Error('explicit private environment required');
const paseo = (...args) => execFileSync(cli, ['--home', home, ...args], { encoding: 'utf8', timeout: 180000 }).trim();
const require = createRequire('/tmp/bc-m0-o1/candidate/tools/bench-provider/package.json');
const { DaemonClient } = await import(pathToFileURL(require.resolve('@getpaseo/client/internal/daemon-client')).href);
const WebSocket = require('ws');
const client = new DaemonClient({ url: 'ws://127.0.0.1:6871/ws', clientId: 'ios-history-seed', clientType: 'cli',
  localCredential: () => readFileSync(`${home}/local-credential`, 'utf8').trim(), reconnect: { enabled: false },
  webSocketFactory: (url, config) => new WebSocket(url, config?.protocols, { headers: config?.headers }) });
const boundary = [
  { kind: 'meta', name: 'history-complete-boundary', description: 'Synthetic canonical turn boundary', scenario: 'Untimed history preparation' },
  { t: 0, mode: 'append', item: { type: 'user_message', text: 'Synthetic canonical history boundary prompt.' } },
  { t: 1, mode: 'append', item: { type: 'assistant_message', text: 'Synthetic canonical history boundary reply.' } },
].map(row => JSON.stringify(row)).join('\n') + '\n';
const fixtureDir = '/tmp/bc-v5/latest/test/fixtures/streams';
copyFileSync(`${root}/fixture.jsonl`, `${fixtureDir}/history-complete-v1.jsonl`);
writeFileSync(`${fixtureDir}/history-complete-boundary.jsonl`, boundary);
const build = createRequire(`${root}/candidate/package.json`)('esbuild').buildSync;
const code = build({ entryPoints: [`${root}/candidate/client/state/turn-duration.ts`], bundle: true, platform: 'neutral', format: 'esm', write: false }).outputFiles[0].text;
const { completedTurnFooters } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const results = [];
const scenarios = process.argv[2] ? [process.argv[2]] : ['incident', 'multi-turn'];
if (scenarios.some(value => !['incident', 'multi-turn'].includes(value))) throw Error('invalid scenario');
const output = `${root}/raw/seeds${process.env.BC_SEED_LABEL ? `-${process.env.BC_SEED_LABEL}` : ''}.json`;
if (existsSync(output)) throw Error(`refusing to overwrite ${output}`);
try {
  await client.connect();
  for (const scenario of scenarios) {
    const id = paseo('run', '-d', '-q', '--provider', 'bc-bench', '--workspace', process.env.BC_WORKSPACE,
      '--title', `ios-history-${scenario}`, scenario === 'incident' ? 'fixture:history-complete-v1 speed:max' : 'fixture:history-complete-boundary speed:max').split('\n').pop();
    paseo('wait', id, '--timeout', '120');
    if (scenario === 'multi-turn') {
      for (let turn = 2; turn <= 11; turn++) {
        paseo('send', id, 'fixture:history-complete-boundary speed:max');
        paseo('wait', id, '--timeout', '120');
      }
      paseo('send', id, 'fixture:history-complete-v1 speed:max');
      paseo('wait', id, '--timeout', '120');
    }
    let page = await client.fetchAgentTimeline(id, { direction: 'tail', projection: 'projected', limit: 200 });
    let entries = page.entries;
    const pages = [];
    while (true) {
      pages.push({ requested: 200, returned: page.entries.length, hasOlder: page.hasOlder, startCursor: page.startCursor, endCursor: page.endCursor });
      if (page.error || page.gap || page.staleCursor || !page.entries.length) throw Error('invalid synthetic readback');
      if (!page.hasOlder) break;
      page = await client.fetchAgentTimeline(id, { direction: 'before', projection: 'projected', limit: 200, cursor: page.startCursor });
      entries = [...page.entries, ...entries];
    }
    const turns = {}, kinds = {};
    for (const entry of entries) {
      kinds[entry.item.type] = (kinds[entry.item.type] ?? 0) + 1;
      turns[entry.turnId] = (turns[entry.turnId] ?? 0) + 1;
    }
    const footers = completedTurnFooters(entries, false, null);
    if (entries.length !== (scenario === 'incident' ? 810 : 832) || footers.length !== (scenario === 'incident' ? 1 : 12)) throw Error('canonical shape mismatch');
    results.push({ scenario, agentId: id, entries: entries.length, turns, kinds, pages,
      footers: footers.length, longReplyChars: Math.max(...entries.filter(e => e.item.type === 'assistant_message').map(e => e.item.text.length)),
      fixtureSha256: createHash('sha256').update(readFileSync(`${fixtureDir}/history-complete-v1.jsonl`)).digest('hex') });
    console.log(`${scenario}: ${id} entries=${entries.length} canonicalTurns=${Object.keys(turns).length} footers=${footers.length}`);
    writeFileSync(output, JSON.stringify(results, null, 2));
  }
} finally { await client.close(); }
