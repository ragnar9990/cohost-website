// Cohost landing page — production interactions
//
// Wire the waitlist form to Formspree:
//   1. Sign up at https://formspree.io (free, 50 submissions/mo)
//   2. Create a form, copy its ID (e.g. "xrgjabcd")
//   3. Replace YOUR_FORM_ID in index.html (two places)

(function () {
  // ─── Track this visit (best effort, swallow errors) ─────────────
  (function trackVisit() {
    try {
      navigator.sendBeacon
        ? navigator.sendBeacon(
            '/api/track',
            new Blob([JSON.stringify({ path: location.pathname })], { type: 'application/json' })
          )
        : fetch('/api/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: location.pathname }),
            keepalive: true,
          }).catch(() => {});
    } catch (_) { /* offline / blocked / whatever */ }
  })();

  // ─── Scroll-aware nav (subtle border + bg on scroll) ────────────
  const nav = document.getElementById('nav');
  const onScroll = () => {
    if (!nav) return;
    nav.classList.toggle('is-scrolled', window.scrollY > 8);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // ─── Hero mouse-follow glow ─────────────────────────────────────
  const heroGlow = document.getElementById('heroGlow');
  if (heroGlow && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let raf = 0, mx = 50, my = 30, tx = 50, ty = 30;
    const onMove = (e) => {
      tx = (e.clientX / window.innerWidth) * 100;
      ty = (e.clientY / window.innerHeight) * 100;
      if (!raf) raf = requestAnimationFrame(loop);
    };
    function loop() {
      // smooth interpolate toward target — gives the glow a soft "lag"
      mx += (tx - mx) * 0.15;
      my += (ty - my) * 0.15;
      heroGlow.style.setProperty('--mx', mx + '%');
      heroGlow.style.setProperty('--my', my + '%');
      if (Math.abs(tx - mx) > 0.1 || Math.abs(ty - my) > 0.1) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = 0;
      }
    }
    window.addEventListener('mousemove', onMove);
  }

  // ─── Bento card local glow follow ───────────────────────────────
  document.querySelectorAll('.bento-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 100;
      const y = ((e.clientY - r.top) / r.height) * 100;
      card.style.setProperty('--mx', x + '%');
      card.style.setProperty('--my', y + '%');
    });
  });

  // ─── Scroll reveal — IntersectionObserver ───────────────────────
  if ('IntersectionObserver' in window) {
    const reveal = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          reveal.unobserve(entry.target); // one-shot
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('[data-reveal]').forEach(el => reveal.observe(el));
  } else {
    document.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('is-visible'));
  }

  // ─── Demo video pause when off-screen (saves CPU) ──────────────
  const demoVideo = document.querySelector('.demo-video');
  if (demoVideo && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) demoVideo.play?.().catch(() => {});
        else demoVideo.pause?.();
      });
    }, { threshold: 0.15 });
    io.observe(demoVideo);
  }

  // ─── Waitlist form ─────────────────────────────────────────────
  const toast = document.getElementById('toast');
  let toastTimer = null;
  function showToast(text, ms = 4000) {
    if (!toast) return;
    toast.textContent = text;
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add('is-on'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('is-on');
      setTimeout(() => { toast.hidden = true; }, 350);
    }, ms);
  }

  function isValidEmail(s) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim());
  }

  function localStorageStash(email) {
    try {
      const stash = JSON.parse(localStorage.getItem('cohost_waitlist') || '[]');
      if (!stash.find(s => s.email === email)) {
        stash.push({ email, at: new Date().toISOString() });
        localStorage.setItem('cohost_waitlist', JSON.stringify(stash));
      }
    } catch (_) {}
  }

  async function handleSubmit(form, e) {
    e.preventDefault();
    const emailInput = form.querySelector('input[type="email"]');
    const email = (emailInput?.value || '').trim();
    if (!isValidEmail(email)) {
      showToast('Please enter a valid email');
      emailInput?.focus();
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    const label = button?.querySelector('.btn-label');
    const originalLabel = label?.textContent;
    if (label) label.textContent = 'Joining…';
    if (button) button.disabled = true;

    const action = form.getAttribute('action') || '/api/waitlist';

    try {
      const res = await fetch(action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || 'signup failed');
      }
      // Always stash locally too, in case the inbox/server is down later
      localStorageStash(email);
      showToast(`You're on the list. Check ${email} for a confirmation.`);
      form.reset();
      document.querySelectorAll('.waitlist input[type="email"]').forEach(i => { i.value = ''; });
    } catch (err) {
      // Backend not yet deployed (e.g. opened locally as file://) — keep
      // the signup in localStorage so it isn't lost.
      localStorageStash(email);
      showToast(`Saved locally. Set up the backend to email ${email}.`);
      form.reset();
    } finally {
      if (label && originalLabel) label.textContent = originalLabel;
      if (button) button.disabled = false;
    }
  }

  document.querySelectorAll('form.waitlist').forEach(form => {
    form.addEventListener('submit', e => handleSubmit(form, e));
  });

  // Coming-soon links (Terms / Privacy in footer)
  document.querySelectorAll('[data-coming-soon]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      showToast('Coming soon.');
    });
  });
})();
