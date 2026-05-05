// Cohost admin — dashboard + campaigns.
// Auth is enforced by the middleware; if our session expired, the API will
// 401 and we bounce back to /login.

(function () {
  const $  = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // ── Common ──
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' }).catch(() => {});
    location.href = '/login';
  });
  document.getElementById('refreshBtn')?.addEventListener('click', () => {
    if (currentTab === 'dashboard') loadStats(true);
    else loadCampaigns();
  });

  // ── Tabs ──
  let currentTab = location.hash === '#campaigns' ? 'campaigns' : 'dashboard';
  function switchTab(name) {
    currentTab = name;
    $$('.tab').forEach(b => b.classList.toggle('is-active', b.dataset.tab === name));
    $$('.view').forEach(v => v.classList.toggle('is-hidden', v.dataset.view !== name));
    history.replaceState(null, '', name === 'campaigns' ? '#campaigns' : '#');
    if (name === 'campaigns') loadCampaigns();
    else loadStats();
  }
  $$('.tab').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

  // ════════════════════ DASHBOARD ════════════════════

  async function loadStats(forceVisualRefresh = false) {
    if (forceVisualRefresh) {
      document.querySelectorAll('.bar-fill').forEach(b => b.style.height = '0%');
    }
    let data;
    try {
      const res = await fetch('/api/admin/stats', { headers: { 'Accept': 'application/json' } });
      if (res.status === 401) { location.href = '/login'; return; }
      data = await res.json();
      if (!data.ok) throw new Error(data.error || 'failed');
    } catch (err) { console.error('stats error:', err); return; }
    renderStats(data);
  }

  function renderStats(data) {
    const w = data.waitlist || {};
    const v = data.visits || {};
    setText('#stat_waitlistTotal', fmt(w.total));
    setText('#stat_visitsTotal',   fmt(v.total));
    setText('#stat_todayWaitlist', fmt(w.today));
    setText('#stat_todayVisits',   fmt(v.today));
    setText('#stat_waitlistToday', `+${fmt(w.today)} today`);
    setText('#stat_visitsToday',   `+${fmt(v.today)} today`);
    renderChart(v.last7Days || []);
    renderSignups(w.recent || []);
    setText('#recentCount', `${fmt((w.recent || []).length)} shown`);
    renderRanks('#referrers', (v.topReferrers || []).map(r => ({ name: r.host, count: r.count })));
    renderRanks('#countries', (v.topCountries || []).map(r => ({ name: countryFlag(r.country) + ' ' + r.country, count: r.count })));
    renderRanks('#paths',     (v.topPaths || []).map(r => ({ name: r.path, count: r.count })));
    const sevenSum = (v.last7Days || []).reduce((a, b) => a + b.count, 0);
    setText('#chartTotal', `${fmt(sevenSum)} visits`);
    const t = new Date();
    setText('#updated', `Updated ${pad(t.getHours())}:${pad(t.getMinutes())}`);
  }

  function renderChart(days) {
    const chart = document.getElementById('chart');
    if (!chart) return;
    chart.innerHTML = '';
    const max = Math.max(1, ...days.map(d => d.count));
    days.forEach((d, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'bar-wrap';
      wrap.style.setProperty('animation-delay', `${i * 40}ms`);
      const bar = document.createElement('div'); bar.className = 'bar';
      const fill = document.createElement('div'); fill.className = 'bar-fill';
      fill.dataset.count = String(d.count);
      bar.appendChild(fill);
      const label = document.createElement('div'); label.className = 'bar-label';
      label.textContent = shortDay(d.date);
      wrap.appendChild(bar); wrap.appendChild(label);
      chart.appendChild(wrap);
      requestAnimationFrame(() => { fill.style.height = `${(d.count / max) * 100}%`; });
    });
  }

  function renderSignups(rows) {
    const tbody = document.querySelector('#signupTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="3" class="empty">No signups yet — once people start joining, they'll show here.</td></tr>`;
      return;
    }
    rows.forEach((r, i) => {
      const tr = document.createElement('tr');
      tr.setAttribute('data-fade', '');
      tr.style.setProperty('animation-delay', `${Math.min(i, 8) * 30}ms`);
      tr.innerHTML = `
        <td><span class="email">${escapeHtml(r.email)}</span></td>
        <td class="t-right"><span class="country">${r.country ? `${countryFlag(r.country)} ${escapeHtml(r.country)}` : '—'}</span></td>
        <td class="t-right"><span class="when">${escapeHtml(timeAgo(r.createdAt))}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderRanks(sel, items) {
    const ul = document.querySelector(sel);
    if (!ul) return;
    ul.innerHTML = '';
    if (!items.length) { ul.innerHTML = `<li class="empty">Not enough data yet.</li>`; return; }
    const max = Math.max(1, ...items.map(it => it.count));
    items.forEach(it => {
      const pct = (it.count / max) * 100;
      const li = document.createElement('li');
      li.className = 'rank-row';
      li.style.setProperty('--p', pct + '%');
      li.innerHTML = `
        <span class="rank-name">${escapeHtml(it.name)}</span>
        <span class="rank-count">${fmt(it.count)}</span>
      `;
      ul.appendChild(li);
    });
  }

  // ════════════════════ CAMPAIGNS ════════════════════

  let templates = [];
  let activeSubscribers = 0;
  let editingId = null;

  async function loadCampaigns() {
    if (!templates.length) await loadTemplates();
    const tbody = $('#campaignsTable tbody');
    let data;
    try {
      const res = await fetch('/api/admin/campaigns');
      if (res.status === 401) { location.href = '/login'; return; }
      data = await res.json();
      if (!data.ok) throw new Error(data.error || 'failed');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty">Couldn't load campaigns: ${escapeHtml(err.message)}</td></tr>`;
      return;
    }
    activeSubscribers = data.subscriberCount || 0;
    setText('#subscriberCount', fmt(activeSubscribers));
    setText('#campaignsCount', `${fmt(data.campaigns.length)} total`);

    if (!data.campaigns.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty">No campaigns yet. Click <strong>New campaign</strong> to compose your first.</td></tr>`;
      return;
    }
    tbody.innerHTML = '';
    data.campaigns.forEach((c, i) => {
      const tr = document.createElement('tr');
      tr.setAttribute('data-fade', '');
      tr.style.setProperty('animation-delay', `${Math.min(i, 8) * 30}ms`);
      const editable = c.status === 'draft';
      tr.innerHTML = `
        <td><span class="email">${escapeHtml(c.subject)}</span></td>
        <td><span class="country">${escapeHtml(templateLabel(c.template))}</span></td>
        <td class="t-right">${statusBadge(c.status)}</td>
        <td class="t-right"><span class="when">${c.status === 'sent' || c.status === 'sending' ? `${fmt(c.sentCount)}/${fmt(c.recipientCount)}${c.failedCount ? ` <span class="fail">(${c.failedCount} failed)</span>` : ''}` : '—'}</span></td>
        <td class="t-right"><span class="when">${escapeHtml(timeAgo(c.sentAt || c.createdAt))}</span></td>
        <td class="t-right">
          <button class="btn-ghost btn-sm" data-act="${editable ? 'edit' : 'view'}" data-id="${c.id}">${editable ? 'Edit' : 'View'}</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('button[data-act]').forEach(b => {
      b.addEventListener('click', () => openComposer(parseInt(b.dataset.id, 10)));
    });
  }

  async function loadTemplates() {
    try {
      const res = await fetch('/api/admin/templates');
      const data = await res.json();
      templates = data?.templates || [];
    } catch (_) { templates = []; }
    const sel = $('#cmp_template');
    sel.innerHTML = '';
    templates.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.label;
      opt.title = t.description;
      sel.appendChild(opt);
    });
  }

  function templateLabel(id) {
    const t = templates.find(x => x.id === id);
    return t ? t.label : id;
  }

  function statusBadge(status) {
    const map = {
      draft:   { txt: 'Draft',   cls: 'badge-draft' },
      sending: { txt: 'Sending', cls: 'badge-sending' },
      sent:    { txt: 'Sent',    cls: 'badge-sent' },
      failed:  { txt: 'Failed',  cls: 'badge-failed' },
    };
    const m = map[status] || { txt: status, cls: '' };
    return `<span class="badge ${m.cls}">${m.txt}</span>`;
  }

  // ── Composer modal ──
  $('#newCampaignBtn').addEventListener('click', () => openComposer(null));
  $('#composerCloseBtn').addEventListener('click', () => closeComposer());
  $('#composer').addEventListener('click', (e) => { if (e.target.id === 'composer') closeComposer(); });

  async function openComposer(id) {
    if (!templates.length) await loadTemplates();
    editingId = id;
    setText('#cmp_msg', '');
    if (id) {
      try {
        const res = await fetch(`/api/admin/campaigns/${id}`);
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
        const c = data.campaign;
        $('#cmp_subject').value   = c.subject || '';
        $('#cmp_template').value  = c.template || 'announcement';
        $('#cmp_preheader').value = c.preheader || '';
        $('#cmp_headline').value  = c.headline || '';
        $('#cmp_body').value      = c.bodyHtml || '';
        $('#cmp_cta_text').value  = c.ctaText || '';
        $('#cmp_cta_url').value   = c.ctaUrl || '';
        const editable = c.status === 'draft';
        setText('#composerTitle', editable ? `Edit draft #${c.id}` : `Campaign #${c.id} (${c.status})`);
        setText('#composerSub', editable ? 'Compose your email. Save as draft, send a preview, or broadcast.' : 'Read-only view of a sent campaign.');
        $('#cmp_deleteBtn').hidden = !editable;
        ['#cmp_subject','#cmp_template','#cmp_preheader','#cmp_headline','#cmp_body','#cmp_cta_text','#cmp_cta_url']
          .forEach(s => $(s).disabled = !editable);
        $('#cmp_saveBtn').disabled = !editable;
        $('#cmp_sendBtn').disabled = !editable;
      } catch (err) {
        alert(`Couldn't load campaign: ${err.message}`);
        return;
      }
    } else {
      $('#cmp_subject').value = '';
      $('#cmp_template').value = 'announcement';
      $('#cmp_preheader').value = '';
      $('#cmp_headline').value = '';
      $('#cmp_body').value = '<p>Hey — </p>\n<p>Big update for you.</p>';
      $('#cmp_cta_text').value = '';
      $('#cmp_cta_url').value = '';
      setText('#composerTitle', 'New campaign');
      setText('#composerSub', 'Compose your email. Save as draft, send a preview, or broadcast.');
      $('#cmp_deleteBtn').hidden = true;
      ['#cmp_subject','#cmp_template','#cmp_preheader','#cmp_headline','#cmp_body','#cmp_cta_text','#cmp_cta_url']
        .forEach(s => $(s).disabled = false);
      $('#cmp_saveBtn').disabled = false;
      $('#cmp_sendBtn').disabled = false;
    }
    $('#composer').classList.remove('is-hidden');
    refreshPreview();
  }

  function closeComposer() { $('#composer').classList.add('is-hidden'); editingId = null; }

  function readForm() {
    return {
      subject:   $('#cmp_subject').value.trim(),
      template:  $('#cmp_template').value,
      preheader: $('#cmp_preheader').value.trim(),
      headline:  $('#cmp_headline').value.trim(),
      body_html: $('#cmp_body').value,
      cta_text:  $('#cmp_cta_text').value.trim(),
      cta_url:   $('#cmp_cta_url').value.trim(),
    };
  }

  function refreshPreview() {
    const f = readForm();
    const html = clientPreview(f);
    const iframe = $('#cmp_preview');
    iframe.srcdoc = html;
  }
  $('#cmp_refreshPreview').addEventListener('click', refreshPreview);
  ['#cmp_subject','#cmp_template','#cmp_preheader','#cmp_headline','#cmp_body','#cmp_cta_text','#cmp_cta_url']
    .forEach(s => $(s).addEventListener('input', debounce(refreshPreview, 250)));

  // Save
  $('#cmp_saveBtn').addEventListener('click', async () => {
    const payload = readForm();
    if (!payload.subject) return setText('#cmp_msg', 'Subject required.', 'err');
    if (!payload.body_html.trim()) return setText('#cmp_msg', 'Body required.', 'err');
    setText('#cmp_msg', 'Saving…');
    try {
      const url = editingId ? `/api/admin/campaigns/${editingId}` : '/api/admin/campaigns';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'failed');
      if (!editingId && data.id) editingId = data.id;
      setText('#cmp_msg', 'Saved.', 'ok');
      loadCampaigns();
    } catch (err) {
      setText('#cmp_msg', `Save failed: ${err.message}`, 'err');
    }
  });

  // Delete
  $('#cmp_deleteBtn').addEventListener('click', async () => {
    if (!editingId) return;
    if (!confirm('Delete this draft? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/admin/campaigns/${editingId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      closeComposer();
      loadCampaigns();
    } catch (err) {
      setText('#cmp_msg', `Delete failed: ${err.message}`, 'err');
    }
  });

  // ── Test send modal ──
  $('#cmp_testBtn').addEventListener('click', async () => {
    if (!editingId) {
      setText('#cmp_msg', 'Save the draft first, then send a test.', 'err');
      return;
    }
    $('#test_email').value = '';
    setText('#test_msg', '');
    $('#testModal').classList.remove('is-hidden');
    setTimeout(() => $('#test_email').focus(), 50);
  });
  $('#testCloseBtn').addEventListener('click',  () => $('#testModal').classList.add('is-hidden'));
  $('#testCancelBtn').addEventListener('click', () => $('#testModal').classList.add('is-hidden'));
  $('#testSendBtn').addEventListener('click', async () => {
    const to = $('#test_email').value.trim();
    if (!to) return setText('#test_msg', 'Enter an email.', 'err');
    setText('#test_msg', 'Sending…');
    try {
      const res = await fetch(`/api/admin/campaigns/${editingId}/send-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setText('#test_msg', 'Sent. Check your inbox.', 'ok');
      setTimeout(() => $('#testModal').classList.add('is-hidden'), 1200);
    } catch (err) {
      setText('#test_msg', `Failed: ${err.message}`, 'err');
    }
  });

  // ── Send confirm modal ──
  $('#cmp_sendBtn').addEventListener('click', async () => {
    if (!editingId) {
      setText('#cmp_msg', 'Save the draft first, then send.', 'err');
      return;
    }
    setText('#sendCount', fmt(activeSubscribers));
    $('#sendCountS').style.display = activeSubscribers === 1 ? 'none' : '';
    $('#send_confirm').value = '';
    $('#sendConfirmBtn').disabled = true;
    setText('#send_msg', '');
    $('#sendModal').classList.remove('is-hidden');
    setTimeout(() => $('#send_confirm').focus(), 50);
  });
  $('#sendCloseBtn').addEventListener('click',  () => $('#sendModal').classList.add('is-hidden'));
  $('#sendCancelBtn').addEventListener('click', () => $('#sendModal').classList.add('is-hidden'));
  $('#send_confirm').addEventListener('input', () => {
    $('#sendConfirmBtn').disabled = $('#send_confirm').value.trim().toUpperCase() !== 'SEND';
  });
  $('#sendConfirmBtn').addEventListener('click', async () => {
    setText('#send_msg', 'Starting broadcast…');
    $('#sendConfirmBtn').disabled = true;
    try {
      const res = await fetch(`/api/admin/campaigns/${editingId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setText('#send_msg', `Sending to ${fmt(data.recipientCount)} subscribers in the background.`, 'ok');
      setTimeout(() => {
        $('#sendModal').classList.add('is-hidden');
        closeComposer();
        loadCampaigns();
      }, 1500);
    } catch (err) {
      setText('#send_msg', `Failed: ${err.message}`, 'err');
      $('#sendConfirmBtn').disabled = false;
    }
  });

  // ── Client-side preview (mirrors functions/lib/email.js shell, simplified) ──
  function clientPreview(c) {
    const subject   = c.subject || '(no subject)';
    const headline  = c.headline || subject;
    const body      = sanitize(c.body_html || '');
    const tmpl      = c.template || 'announcement';
    const badges    = {
      'announcement': { text: '★ Announcement', color: '#ef4444' },
      'feature-drop': { text: '⚡ New feature', color: '#a78bfa' },
      'weekly-update':{ text: '◷ This week',   color: '#4ade80' },
    };
    const badge = badges[tmpl];
    const badgeRow = badge ? `<div style="display:inline-block;padding:5px 12px;font-size:11px;font-weight:600;color:${badge.color};letter-spacing:.14em;text-transform:uppercase;background:${rgba(badge.color,.10)};border:1px solid ${rgba(badge.color,.30)};border-radius:999px;margin-bottom:18px;">${escapeHtml(badge.text)}</div>` : '';
    const cta = (c.cta_text && c.cta_url) ? `<div style="text-align:center;padding:32px 0 8px;"><a href="${escapeHtml(c.cta_url)}" style="display:inline-block;padding:14px 28px;background:#fafafa;color:#0a0a0a;border-radius:999px;font-size:14.5px;font-weight:600;text-decoration:none;">${escapeHtml(c.cta_text)}&nbsp;&nbsp;→</a></div>` : '';
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
      body { margin:0; padding:24px 16px; background:#050505; color:#fafafa; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; -webkit-font-smoothing:antialiased; }
      .card { max-width:560px; margin:0 auto; background:#0a0a0a; border:1px solid rgba(255,255,255,.07); border-radius:18px; overflow:hidden; box-shadow:0 30px 80px rgba(0,0,0,.5); }
      .hero { background:linear-gradient(180deg,#1a0d0d 0%,#0a0606 60%,#0a0a0a 100%); padding:42px 36px 24px; text-align:center; }
      .hero img { width:48px; height:48px; filter:drop-shadow(0 0 28px rgba(239,68,68,.4)); }
      .hero .name { margin-top:12px; font-size:15px; font-weight:600; letter-spacing:-.018em; }
      .div { height:1px; background:linear-gradient(90deg,transparent 0%,rgba(239,68,68,.6) 50%,transparent 100%); }
      .body { padding:38px 40px 8px; }
      .body h1 { margin:0; font-size:28px; font-weight:600; letter-spacing:-.028em; line-height:1.12; }
      .body .copy { padding:18px 0 0; font-size:15.5px; line-height:1.7; color:#c5c5c5; }
      .body .copy p { margin:0 0 14px; }
      .body .copy a { color:#ef4444; text-decoration:underline; }
      .body .copy ul { padding-left:20px; margin:0 0 14px; }
      .foot { padding:32px 40px 36px; border-top:1px solid rgba(255,255,255,.06); margin-top:24px; font-size:11.5px; color:#5a5a5a; line-height:1.7; }
      .foot a { color:#8a8a8a; text-decoration:underline; }
      </style></head><body>
      <div class="card">
        <div class="hero">
          <img src="assets/cohost-app-icon.png" alt="" />
          <div class="name">Cohost</div>
        </div>
        <div class="div"></div>
        <div class="body">
          ${badgeRow}
          <h1>${escapeHtml(headline)}</h1>
          <div class="copy">${body}</div>
          ${cta}
        </div>
        <div class="foot">
          <strong style="color:#fafafa;">Cohost</strong> &nbsp;·&nbsp; v0.1 · Alpha<br/>
          You're getting this because you signed up at <a href="#">cohost.live</a>. <a href="#">Unsubscribe</a>.
        </div>
      </div>
      </body></html>`;
  }

  function sanitize(html) {
    return String(html).replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/ on\w+="[^"]*"/gi,'').replace(/ on\w+='[^']*'/gi,'');
  }
  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
  }

  // ── Helpers ──
  function setText(sel, t, kind) {
    const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!el) return;
    el.textContent = t;
    if (kind && el.classList.contains('form-msg')) {
      el.classList.remove('ok', 'err');
      if (kind === 'ok')  el.classList.add('ok');
      if (kind === 'err') el.classList.add('err');
    }
  }
  function fmt(n) { return Number(n || 0).toLocaleString(); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
  function shortDay(iso) {
    try { return new Date(iso + 'T00:00:00Z').toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3); }
    catch (_) { return iso.slice(5); }
  }
  function timeAgo(iso) {
    if (!iso) return '—';
    const date = new Date(iso.replace(' ', 'T') + 'Z');
    const sec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);  if (min < 60) return `${min}m ago`;
    const hr  = Math.floor(min / 60);  if (hr < 24)  return `${hr}h ago`;
    const d   = Math.floor(hr / 24);   if (d < 7)    return `${d}d ago`;
    return date.toLocaleDateString();
  }
  function countryFlag(code) {
    if (!code || code.length !== 2) return '';
    const A = 0x1F1E6;
    const c = code.toUpperCase();
    return String.fromCodePoint(A + c.charCodeAt(0) - 65, A + c.charCodeAt(1) - 65);
  }
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  // ── Boot ──
  switchTab(currentTab);
  setInterval(() => {
    if (currentTab === 'dashboard') loadStats(false);
    else loadCampaigns();
  }, 60_000);
})();
