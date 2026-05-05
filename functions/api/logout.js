import { clearCookieHeader } from '../lib/auth.js';

const respond = () =>
  new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': clearCookieHeader(),
    },
  });

export const onRequestPost = respond;
export const onRequestGet  = respond;
