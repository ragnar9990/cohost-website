// GET /api/admin/templates  →  list available email templates for the composer.

import { listTemplates } from '../../lib/email.js';

export const onRequestGet = async () => {
  return new Response(JSON.stringify({ ok: true, templates: listTemplates() }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
