import { readdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');

export function packEvidence(root, sourceArchiveSha256) {
  if (!/^[a-f0-9]{64}$/.test(sourceArchiveSha256)) throw Error('verified source archive SHA256 required');
  const manifestPath = join(root, 'packing-manifest.json');
  if (existsSync(manifestPath)) throw Error('packing manifest already exists; verify it instead of repacking');
  const plans = [];
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const input = join(dir, entry.name);
      if (entry.isDirectory()) { walk(input); continue; }
      const name = relative(root, input);
      if (!/^raw\/(web|ios|web-prep-v1)\/.*\.json$/.test(name) && !/^raw\/seeds.*\.json$/.test(name) && !/^logs\/.*\.(log|txt)$/.test(name)) continue;
      if (existsSync(input + '.gz')) throw Error(`packed output already exists: ${name}`);
      const original = readFileSync(input), packed = gzipSync(original);
      if (!gunzipSync(packed).equals(original)) throw Error(`compression roundtrip failed: ${name}`);
      plans.push({ input, original, packed, record: { path: name + '.gz', uncompressedBytes: original.length, uncompressedSha256: sha(original), packedBytes: packed.length, packedSha256: sha(packed) } });
    }
  }
  walk(join(root, 'raw'));
  walk(join(root, 'logs'));
  // Keep the original bytes until every packed output has been written and read back.
  for (const item of plans) writeFileSync(item.input + '.gz', item.packed, { flag: 'wx' });
  for (const item of plans) {
    const saved = readFileSync(item.input + '.gz');
    if (sha(saved) !== item.record.packedSha256 || !gunzipSync(saved).equals(item.original)) throw Error('packed readback failed');
  }
  const manifest = { sourceArchiveSha256, roundtripVerified: true, files: plans.map(item => item.record) };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  for (const item of plans) unlinkSync(item.input);
  return manifest;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [root, archiveSha] = process.argv.slice(2);
  if (!root) throw Error('benchmark directory required');
  console.log(JSON.stringify({ packedFiles: packEvidence(resolve(root), archiveSha).files.length }));
}
