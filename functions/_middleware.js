// Runs on every request. Protects /admin pages and /api/admin/* endpoints.
// Public routes (/, /login, /api/login, /api/waitlist, /api/track, etc.) pass through.

import { readCookie, verifySession } from './lib/auth.js';

export const onRequest = async ({ request, env, next }) => {
  const url = new URL(request.url);
  const isAdminPage    = url.pathname === '/admin' || url.pathname.startsWith('/admin/');
  const isAdminApi     = url.pathname.startsWith('/api/admin/');

  if (!isAdminPage && !isAdminApi) return next();

  // Session check
  const token = readCookie(request);
  const ok = token ? await verifySession(token, env.ADMIN_SECRET || '') : false;
  if (ok) return next();

  // Unauthenticated
  if (isAdminApi) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  // HTML page → bounce to login
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', url.pathname);
  return Response.redirect(loginUrl.toString(), 302);
};
