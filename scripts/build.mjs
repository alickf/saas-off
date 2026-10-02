import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { deflateSync } from 'node:zlib';
import { APPS } from '../src/catalogue.js';
import { escapeHtml as esc } from '../src/domain.js';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const brands = require('@fortawesome/free-brands-svg-icons');
const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const cache = path.join(root, '.cache', 'icons');
await fs.rm(dist, { recursive: true, force: true });
await fs.mkdir(path.join(dist, 'icons'), { recursive: true });
await fs.mkdir(path.join(dist, 'art'), { recursive: true });
await fs.mkdir(cache, { recursive: true });
await fs.cp(path.join(root, 'public'), dist, { recursive: true });
for (const file of ['catalogue.js', 'domain.js']) await fs.copyFile(path.join(root, 'src', file), path.join(dist, file));
const svg = (body, w, h) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`);
const text = (value, x, y, size, weight = 400, fill = '#20231D', anchor = 'start') => `<text x="${x}" y="${y}" font-family="DejaVu Sans,Arial,sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(value)}</text>`;
function icoData(input) {
  if (input.length < 6 || input.readUInt16LE(0) !== 0 || input.readUInt16LE(2) !== 1) return input;
  const entries = [];
  for (let i = 0; i < Math.min(input.readUInt16LE(4), 256); i++) {
    const at = 6 + i * 16;
    if (at + 16 > input.length) break;
    const length = input.readUInt32LE(at + 8), offset = input.readUInt32LE(at + 12);
    if (offset + length <= input.length && length > 0) entries.push({ size: input[at] || 256, data: input.subarray(offset, offset + length) });
  }
  entries.sort((a, b) => b.size - a.size);
  for (const entry of entries) if (entry.data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return entry.data;
  // Legacy 32-bit ICO DIB, bottom-up BGRA; alpha channel is retained.
  for (const { data } of entries) {
    if (data.length < 40 || data.readUInt32LE(0) !== 40 || data.readUInt16LE(14) !== 32 || data.readUInt32LE(16) !== 0) continue;
    const width = data.readInt32LE(4), height = data.readInt32LE(8) / 2;
    if (width < 1 || height < 1 || width > 256 || height > 256 || 40 + width * height * 4 > data.length) continue;
    const rgba = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const source = 40 + ((height - y - 1) * width + x) * 4, target = (y * width + x) * 4;
      rgba[target] = data[source + 2]; rgba[target + 1] = data[source + 1]; rgba[target + 2] = data[source]; rgba[target + 3] = data[source + 3];
    }
    return { rgba, width, height };
  }
  throw new Error('Unsupported ICO encoding');
}
async function normaliseIcon(bytes) {
  const data = icoData(bytes);
  if (Buffer.isBuffer(data) && data.toString('utf8', 0, Math.min(data.length, 300)).includes('<')) {
    const source = data.toString('utf8');
    if (!source.includes('<svg') || /<!DOCTYPE|<!ENTITY|(?:href|xlink:href)\s*=\s*["'](?!#|data:)|url\(/i.test(source)) throw new Error('Unsafe or unsupported SVG');
  }
  const image = Buffer.isBuffer(data) ? sharp(data, { limitInputPixels: 16000000 }) : sharp(data.rgba, { raw: { width: data.width, height: data.height, channels: 4 } });
  return image.resize(128, 128, { fit: 'contain', background: '#ffffff00' }).png().toBuffer();
}
async function fetchIcon(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(6500), headers: { 'User-Agent': 'SaaS-Off catalogue build (+https://github.com/alickf/saas-off)' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (Number(response.headers.get('content-length') || 0) > 1000000) throw new Error('Icon too large');
  const reader = response.body.getReader(); let size = 0; const chunks = [];
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 1000000) { await reader.cancel(); throw new Error('Icon too large'); } chunks.push(value); }
  return normaliseIcon(Buffer.concat(chunks));
}
async function fallbackIcon(app) {
  if (app.id === 'netlify') return normaliseIcon(await fs.readFile(path.join(root, 'scripts/assets/netlify.svg')));
  const brand = brands[app.fallback];
  if (brand) {
    const [w, h, , , data] = brand.icon;
    return normaliseIcon(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 ${w} ${h}">${(Array.isArray(data) ? data : [data]).map(d => `<path fill="${app.colour}" d="${d}"/>`).join('')}</svg>`));
  }
  const initials = app.name.split(/\s+/).map(s => s[0]).slice(0, 2).join('');
  return normaliseIcon(svg(`<rect x="5" y="5" width="118" height="118" rx="28" fill="${app.colour}"/>${text(initials,64,86,64,700,'white','middle')}`,128,128));
}
const report = [];
async function makeApp(app) {
  const cachePath = path.join(cache, app.id + '.png');
  let icon, source = 'fallback';
  if (!process.env.REFRESH_ICONS) { try { icon = await fs.readFile(cachePath); source = 'cached first-party'; } catch {} }
  if (!icon && !process.env.SKIP_ICON_FETCH) for (const url of app.iconSources) {
    try { icon = await fetchIcon(url); source = url; await fs.writeFile(cachePath, icon); break; } catch { /* Continue through the curated fallbacks. */ }
  }
  if (!icon) icon = await fallbackIcon(app);
  await fs.writeFile(path.join(dist, 'icons', app.id + '.png'), icon);
  const fontSize = app.name.length > 14 ? 20 : app.name.length > 11 ? 22 : 25;
  const image = icon.toString('base64');
  const tile = svg(`<rect x="0.5" y="0.5" width="251" height="223" rx="17" fill="white" stroke="#D7DFCA"/><image href="data:image/png;base64,${image}" x="83" y="38" width="86" height="86"/>${text(app.name,126,170,fontSize,700,'#20231D','middle')}${text(app.category,126,197,11,400,'#7A836C','middle')}`,252,224);
  const raw = await sharp(tile).flatten({ background: '#F7F8F2' }).removeAlpha().raw().toBuffer();
  await fs.writeFile(path.join(dist, 'art', app.id + '.bin'), deflateSync(raw));
  report.push({ id: app.id, source });
}
const base = svg(`<rect width="1200" height="630" fill="#F7F8F2"/><rect x="60" y="40" width="40" height="40" rx="10" fill="#D8F36A"/><g fill="#20231D"><rect x="69" y="49" width="8" height="8" rx="1"/><rect x="83" y="49" width="8" height="8" rx="1"/><rect x="69" y="63" width="8" height="8" rx="1"/><rect x="83" y="63" width="8" height="8" rx="1" transform="rotate(-12 87 67)"/></g>${text('SaaS-Off.',114,71,30,700)}${text('MY EVERYDAY FOUR',1140,65,13,700,'#68705F','end')}<rect x="410" y="172" width="560" height="22" fill="#D8F36A"/>${text('Four tabs. One stack.',60,192,65,700)}${text('The apps I practically live in. What are yours?',60,239,22,400,'#68705F')}<line x1="60" y1="551" x2="1140" y2="551" stroke="#D7DFCA"/>${text('SHOW YOUR STACK. FIND YOUR PEOPLE.',60,592,13,700,'#68705F')}${text('No sign-up. Just your four.',1140,592,15,400,'#68705F','end')}`,1200,630);
const baseRaw = await sharp(base).removeAlpha().raw().toBuffer();
await fs.writeFile(path.join(dist, 'art', 'base.bin'), deflateSync(baseRaw));
let next = 0;
await Promise.all(Array.from({ length: 6 }, async () => { while (next < APPS.length) await makeApp(APPS[next++]); }));
await fs.writeFile(path.join(dist, 'icon-provenance.json'), JSON.stringify(report.sort((a,b) => a.id.localeCompare(b.id)), null, 2));
const fallbackCount = report.filter(r => r.source === 'fallback').length;
console.log(`Built ${APPS.length} apps, first-party icon cache and pre-rendered OG tiles. ${fallbackCount} fallback icons used.`);
if (fallbackCount) console.log('Review dist/icon-provenance.json before launch. REFRESH_ICONS=1 npm run build refreshes icons.');
