import { APP_MAP } from './catalogue.js';
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function normalise(ids) {
  if (!Array.isArray(ids) || ids.length !== 4 || ids.some(id => typeof id !== 'string' || !APP_MAP.has(id))) {
    throw new HttpError(400, 'Choose exactly four apps from the catalogue.');
  }
  if (new Set(ids).size !== 4) throw new HttpError(400, 'Choose four different apps.');
  return [...ids].sort();
}
export function base64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
export async function combination(ids) {
  const apps = normalise(ids);
  const key = apps.join('|');
  // 96 bits; UNIQUE combination_key is also enforced in the database.
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return { id: base64url(hash.slice(0, 12)), key, apps };
}
export const isStackId = id => typeof id === 'string' && /^[A-Za-z0-9_-]{16}$/.test(id);
export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function publicApp(app) {
  return { id: app.id, name: app.name, category: app.category, colour: app.colour, domain: app.domain };
}
