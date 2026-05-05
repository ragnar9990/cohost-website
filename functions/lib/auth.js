// HMAC-signed session cookie helpers (no DB needed).
// Cookie value: "<expiresAt>.<signature>"
// Signature: base64url(HMAC-SHA256(secret, expiresAt))
// To validate: recompute the signature, check it matches and hasn't expired.

const COOKIE_NAME = 'cohost_admin';
const SESSION_TTL = 60 * 60 * 24 * 14; // 14 days

export async function createSession(secret, ttlSec = SESSION_TTL) {
  const expires = Math.floor(Date.now() / 1000) + ttlSec;
  const sig = await hmacSign(secret, String(expires));
  return `${expires}.${sig}`;
}

export async function verifySession(token, secret) {
  if (!token || typeof token !== 'string') return false;
  const dot = token.indexOf('.');
  if (dot < 0) return false;
  const expiresStr = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expires = parseInt(expiresStr, 10);
  if (!expires || Math.floor(Date.now() / 1000) > expires) return false;
  const expected = await hmacSign(secret, expiresStr);
  return constantTimeEqual(sig, expected);
}

export function readCookie(request, name = COOKIE_NAME) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function setCookieHeader(value, opts = {}) {
  const {
    name = COOKIE_NAME,
    maxAge = SESSION_TTL,
    path = '/',
    secure = true,
    httpOnly = true,
    sameSite = 'Lax',
  } = opts;
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, `Max-Age=${maxAge}`, `SameSite=${sameSite}`];
  if (httpOnly) parts.push('HttpOnly');
  if (secure)   parts.push('Secure');
  return parts.join('; ');
}

export function clearCookieHeader(name = COOKIE_NAME) {
  return `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

async function hmacSign(secret, data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return base64url(new Uint8Array(sig));
}

function base64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
