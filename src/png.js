// Small, dependency-free RGB PNG encoder. PNG uses native zlib CompressionStream.
// Rendering uses pre-rasterised, trusted build assets: no remote fonts or images at runtime.
const encoder = new TextEncoder();
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const result = new Uint8Array(data.length + 12);
  const view = new DataView(result.buffer);
  view.setUint32(0, data.length);
  result.set(encoder.encode(type), 4);
  result.set(data, 8);
  view.setUint32(data.length + 8, crc(result.subarray(4, data.length + 8)));
  return result;
}
function concat(parts) {
  const result = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}
export async function inflate(data) {
  return new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
}
export async function encodePng(rgb, width, height) {
  if (rgb.length !== width * height * 3) throw new Error('Invalid RGB image dimensions');
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width); view.setUint32(4, height);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit truecolour, no interlacing.
  const scanlines = new Uint8Array((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) scanlines.set(rgb.subarray(y * width * 3, (y + 1) * width * 3), y * (width * 3 + 1) + 1);
  const compressed = new Uint8Array(await new Response(new Blob([scanlines]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
  return concat([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', new Uint8Array())]);
}
export function placeTile(base, tile, index) {
  const width = 252, height = 224, left = 60 + index * 276, top = 280;
  if (base.length !== 1200 * 630 * 3 || tile.length !== width * height * 3) throw new Error('Invalid artwork dimensions');
  for (let y = 0; y < height; y++) {
    base.set(tile.subarray(y * width * 3, (y + 1) * width * 3), ((top + y) * 1200 + left) * 3);
  }
}
export async function socialImage(ids, assets, origin) {
  const paths = ['/art/base.bin', ...ids.map(id => `/art/${id}.bin`)];
  const images = await Promise.all(paths.map(async path => {
    const response = await assets.fetch(new Request(new URL(path, origin)));
    if (!response.ok || !response.headers.get('content-type')?.includes('octet-stream')) throw new Error('Artwork unavailable. Run npm run build.');
    return inflate(await response.arrayBuffer());
  }));
  const base = images[0];
  images.slice(1).forEach((tile, i) => placeTile(base, tile, i));
  return encodePng(base, 1200, 630);
}
