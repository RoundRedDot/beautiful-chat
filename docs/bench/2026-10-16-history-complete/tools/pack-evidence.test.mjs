import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { packEvidence } from './pack-evidence.mjs';

test('evidence packing preserves exact bytes and retains summary and provenance controls', () => {
  const root = mkdtempSync(join(tmpdir(), 'bc-history-pack-'));
  try {
    for (const dir of ['raw/web', 'logs']) mkdirSync(join(root, dir), { recursive: true });
    const sample = Buffer.from('{"completed":true,"text":"原文"}\n');
    const log = Buffer.from('raw output with trailing spaces  \n\n');
    writeFileSync(join(root, 'raw/web/sample.json'), sample);
    writeFileSync(join(root, 'logs/metro.log'), log);
    writeFileSync(join(root, 'raw/summary.json'), '{"collected":80}\n');
    const result = packEvidence(root, 'a'.repeat(64));
    assert.equal(result.files.length, 2);
    assert.deepEqual(gunzipSync(readFileSync(join(root, 'raw/web/sample.json.gz'))), sample);
    assert.deepEqual(gunzipSync(readFileSync(join(root, 'logs/metro.log.gz'))), log);
    assert.equal(existsSync(join(root, 'raw/web/sample.json')), false);
    assert.equal(readFileSync(join(root, 'raw/summary.json'), 'utf8'), '{"collected":80}\n');
    assert.throws(() => packEvidence(root, 'a'.repeat(64)), /already exists/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
