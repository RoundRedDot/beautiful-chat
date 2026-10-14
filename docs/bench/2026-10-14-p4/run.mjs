import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { ids, paths, root, serverBundle, groupBundle, loadServer, clientHelpers } from './harness.mjs';

const out = path.join(import.meta.dirname, 'raw');
const temporary = '/tmp/bc-perf-p4';
mkdirSync(out, { recursive: true }); mkdirSync(temporary, { recursive: true });
const serverPath = path.join(temporary, 'server-observed.cjs');
const groupsPath = path.join(temporary, 'groups.cjs');
const server = await serverBundle();
writeFileSync(serverPath, server); writeFileSync(groupsPath, await groupBundle());
const handler = loadServer(server);
await handler({ code: 'x', language: 'typescript', dark: true });
const grammars = (await Promise.all(paths.map(p => import(p)))).flatMap(m => m.default);
const metadata = [...new Map(grammars.map(g => [g.name, g])).values()].map(g => ({ name: g.name, aliases: g.aliases ?? [], embeddedLangs: g.embeddedLangs ?? [], embeddedLangsLazy: (g.embeddedLangsLazy ?? []).filter(id => ids.includes(id)) }));
const canonical = new Map(metadata.flatMap(g => [g.name, ...g.aliases].map(name => [name, g.name])));
const markdownGroup = ['markdown', ...metadata.find(g => g.name === 'markdown').embeddedLangsLazy];
writeFileSync(path.join(out, 'grammar-metadata.json'), JSON.stringify(metadata, null, 2) + '\n');

const helpers = await clientHelpers();
const fixtureDir = path.join(root, 'test/fixtures/streams');
const sessions = [];
for (const filename of readdirSync(fixtureDir).filter(f => f.endsWith('.jsonl')).sort()) {
  const raw = readFileSync(path.join(fixtureDir, filename), 'utf8');
  const events = raw.trim().split('\n').map(line => JSON.parse(line));
  const requests = []; let current = null; let textIndex = 0;
  const seenBlocks = new Set();
  async function add(input, origin, t, scope) {
    if (!input.code) return;
    const result = await handler({ ...input, dark: true });
    requests.push({ t, origin, scope, hint: input.language ?? null, filename: input.filename ?? null,
      resolved: result.language, canonical: canonical.get(result.language) ?? null,
      bytes: Buffer.byteLength(input.code), lines: input.code.split('\n').length });
  }
  async function markdown(text, origin, t, complete) {
    function codes(tokens) {
      return tokens.flatMap(token => token.type === 'code' ? [token] :
        [...codes(token.tokens ?? []), ...(token.items ?? []).flatMap(item => codes(item.tokens ?? []))]);
    }
    for (const [index, token] of codes(helpers.lexBlock(text)).entries()) {
      const key = `${origin}:${index}`;
      if (seenBlocks.has(key)) continue;
      const raw = token.raw.trimEnd(); const marker = /^ {0,3}(`{3,}|~{3,})/.exec(raw)?.[1];
      const last = raw.slice(raw.lastIndexOf('\n') + 1).trim();
      if (!complete && marker && !(last.length >= marker.length && last[0] === marker[0] && /^(`+|~+)$/.test(last))) continue;
      seenBlocks.add(key);
      await add({ code: token.text, language: helpers.codeLanguage(token.lang) || 'plaintext' }, origin, t,
        origin.startsWith('assistant_message') ? 'default' : 'expanded');
    }
  }
  for (const event of events.slice(1)) {
    const item = event.item;
    if (current && current.type !== item.type) {
      await markdown(current.text, current.origin, event.t, true); current = null;
    }
    if (['assistant_message', 'reasoning'].includes(item.type)) {
      current ??= { type: item.type, text: '', origin: `${item.type}:${textIndex++}` };
      current.text += item.text ?? '';
      await markdown(current.text, current.origin, event.t, false);
    } else if (item.type === 'tool_call') {
      const v = helpers.classifyTool(item); const origin = `tool:${item.callId}:${item.status}`;
      if (['read', 'write'].includes(v.tool)) await add({ code: v.code || '// [Empty content or pending stream]', language: v.language ?? 'text', filename: v.filePath }, origin, event.t, 'expanded');
      else if (v.tool === 'edit') {
        const code = v.diff || v.code || '// [Edit: diff applied]';
        await add({ code, language: 'diff', filename: v.filePath }, origin, event.t, 'expanded');
        // Diff body uses filename inference independently. Empty code is enough to resolve it here.
        await add({ code: 'x', filename: v.filePath }, `${origin}:diffBody`, event.t, 'expanded');
      } else if (v.tool === 'mcp' && v.mcp) {
        await add({ code: JSON.stringify(v.mcp.arguments, null, 2), language: 'json' }, origin, event.t, 'expanded');
        if (v.mcp.result !== undefined) await add({ code: typeof v.mcp.result === 'string' ? v.mcp.result : JSON.stringify(v.mcp.result, null, 2), language: typeof v.mcp.result === 'string' ? 'typescript' : 'json' }, origin, event.t, 'expanded');
      } else if (v.tool === 'unknown' && v.input) await add({ code: JSON.stringify(v.input, null, 2), language: 'json' }, origin, event.t, 'expanded');
      else if (['plan', 'plain_text'].includes(v.tool) && v.text) await markdown(v.text, origin, event.t, true);
      else if (v.tool === 'thinking') await markdown(v.thinking?.text || v.code || v.output || '', origin, event.t, true);
      // Shell/terminal text has local colouring and does not call highlight.tokens.
    }
  }
  if (current) await markdown(current.text, current.origin, events.at(-1).t, true);
  for (const scope of ['default', 'expanded']) {
    const selected = requests.filter(r => scope === 'expanded' || r.scope === 'default');
    const order = [...new Set(selected.map(r => r.canonical).filter(Boolean))];
    const loaded = new Set(); const firstLoads = [];
    for (const id of order) {
      if (loaded.has(id)) continue;
      const group = id === 'markdown' ? markdownGroup : id === 'html' ? ['html', 'javascript', 'css'] : [id];
      firstLoads.push({ id: id === 'markdown' ? 'markdown-group' : id, newGrammars: group.filter(g => !loaded.has(g)) });
      group.forEach(g => loaded.add(g));
    }
    sessions.push({ fixture: filename, sha256: createHash('sha256').update(raw).digest('hex'), scope, order, firstLoads,
      eagerInitEvents: selected.length ? 1 : 0, lazyInitEvents: firstLoads.length,
      // Counts are potential grammar-loading first paints, not measured UI frames. Plain RPCs can still round-trip.
      requests: selected });
  }
}
writeFileSync(path.join(out, 'sessions.json'), JSON.stringify(sessions, null, 2) + '\n');

const runs = [];
function cold(mode, requested, run) {
  const artifact = mode === 'eager' ? serverPath : groupsPath;
  const stdout = execFileSync(process.execPath, ['--expose-gc', path.join(import.meta.dirname, 'worker.mjs'), mode, artifact, requested], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  const result = { run, machineLoad: os.loadavg(), ...JSON.parse(stdout) }; runs.push(result);
  writeFileSync(path.join(out, 'cold-runs.json'), JSON.stringify(runs, null, 2) + '\n');
  console.log(`${mode}/${requested} run ${run} first=${result.metrics.firstHighlightMs.toFixed(2)} ms`);
}
// Sequential: no competing benchmark subprocesses. Five A/A pairs for eager, TS and markdown group.
for (let run = 0; run < 10; run++) for (const [mode, requested] of [['eager', 'typescript'], ['group', 'typescript'], ['eager', 'markdown'], ['group', 'markdown-group']]) cold(mode, requested, run);
for (let run = 0; run < 3; run++) for (const id of ids.filter(id => id !== 'typescript')) cold('group', id, run);
const environment = { started: process.env.P4_STARTED ?? null, ended: new Date().toISOString(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  node: process.version, platform: process.platform, arch: process.arch, os: os.release(), cpu: os.cpus()[0].model,
  loadAtEnd: os.loadavg(), process: 'fresh Node --expose-gc per run; one bundled server artifact; no daemon',
  shiki: '4.4.3', groupPolicy: markdownGroup };
writeFileSync(path.join(out, 'environment.json'), JSON.stringify(environment, null, 2) + '\n');
console.log(`Saved ${runs.length} cold runs and ${sessions.length} session scenarios`);
