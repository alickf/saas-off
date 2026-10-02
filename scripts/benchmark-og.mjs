import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { socialImage } from '../src/png.js';
import { EXAMPLE_IDS } from '../src/catalogue.js';

// A diagnostic, not a Cloudflare Free certification: Node/process CPU and
// Cloudflare invocation CPU are different measurements. Verify a cold request
// on the actual Worker before a public campaign.
const root = path.resolve(import.meta.dirname, '../dist');
const assets = { async fetch(request) {
  const file = path.resolve(root, '.' + new URL(request.url).pathname);
  if (!file.startsWith(root + path.sep)) throw new Error('Invalid asset path');
  return new Response(await fs.readFile(file), { headers: { 'content-type': 'application/octet-stream' } });
} };
const samples = [];
for (let n = 0; n < 10; n++) {
  const start = performance.now(), cpu = process.cpuUsage();
  const png = await socialImage([...EXAMPLE_IDS].sort(), assets, 'https://saas-off.com');
  const used = process.cpuUsage(cpu);
  samples.push({ run: n + 1, wallMs: +(performance.now() - start).toFixed(2), processCpuMs: +((used.user + used.system) / 1000).toFixed(2), pngBytes: png.length });
}
console.table(samples);
console.log('Diagnostic only. Check Cloudflare invocation CPU for cold and cached image requests.');
