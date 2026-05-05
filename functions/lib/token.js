// Random URL-safe tokens for unsubscribe links etc.

export function newToken(bytes = 24) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// User-friendly URL — the static /unsubscribe page that calls the API on load.
export function unsubscribeUrl(websiteUrl, token) {
  const base = (websiteUrl || '').replace(/\/$/, '');
  return `${base}/unsubscribe?token=${encodeURIComponent(token || '')}`;
}

// API URL — used in the List-Unsubscribe header so providers (Gmail/Apple Mail)
// can do one-click unsubscribe via POST without going through the HTML page.
export function unsubscribeApiUrl(websiteUrl, token) {
  const base = (websiteUrl || '').replace(/\/$/, '');
  return `${base}/api/unsubscribe?token=${encodeURIComponent(token || '')}`;
}
