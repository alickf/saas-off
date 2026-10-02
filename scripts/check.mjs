import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
let count = 0;
async function walk(dir) { for (const entry of await fs.readdir(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); if (entry.isDirectory()) await walk(full); else if (/\.(mjs|js)$/.test(entry.name)) { const result = spawnSync(process.execPath, ['--check', full], { stdio: 'inherit' }); if (result.status !== 0) process.exit(result.status || 1); count++; } } }
for (const dir of ['src', 'public', 'scripts', 'test']) await walk(dir);
console.log(`Syntax checked ${count} JavaScript modules.`);
