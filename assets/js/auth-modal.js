/* FinVisor sign-up / sign-in modal.
   Self-contained: injects its own styles + markup, so a page only needs
   <script src="assets/js/auth-modal.js" defer></script>.

   - Opens once per browsing session on first page load.
   - Opens on demand for any element with [data-auth-open] (e.g. "Start Now").
   - "Sign up" sends a request-to-connect to the same Google Sheet as the
     contact form, or the visitor can reach us on WhatsApp.
   - "Sign in" points existing customers to their live dashboard.
   - Closeable with the X, the Esc key, or a click on the backdrop. */
(function () {
  'use strict';

  var WHATSAPP = 'https://wa.me/201270017382';
  var WA_SIGNUP = WHATSAPP + '?text=' + encodeURIComponent("Hi FinVisor, I'd like to connect my store to the Ad Profit Tracker.");
  var WA_HELP = WHATSAPP + '?text=' + encodeURIComponent('Hi FinVisor, I need help signing in to my dashboard.');
  var APP_URL = 'https://app.fin-visor.com';
  var SHEET_URL = 'https://script.google.com/macros/s/AKfycbwDqZTakq2zi9HbN_8rJxjsdVJFDq0wZUHLUcwrVCGTzIEvXCf-wV8FsIgD40qjtvQ/exec';
  var SEEN_KEY = 'fv_auth_modal_seen';

  var WA_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" width="17" height="17" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.06-1.33A10 10 0 1 0 12 2zm0 18.06a8 8 0 0 1-4.08-1.12l-.29-.17-3 .79.8-2.93-.19-.3A8.06 8.06 0 1 1 12 20.06zm4.4-5.93c-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1-.37-1.9-1.18-.7-.62-1.18-1.39-1.32-1.63-.14-.24-.01-.37.11-.49.12-.12.27-.31.4-.47.13-.16.18-.27.27-.45.09-.18.04-.33-.04-.45-.08-.12-.68-1.64-.93-2.24-.24-.58-.49-.5-.68-.51h-.58c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.43-.59 1.63-1.15.2-.57.2-1.05.14-1.15-.06-.1-.22-.16-.46-.28z"/></svg>';

  var css = [
    '.fv-modal-overlay{position:fixed;inset:0;z-index:4000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(10,15,48,.6);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);opacity:0;visibility:hidden;transition:opacity .25s ease,visibility .25s ease;}',
    '.fv-modal-overlay.is-open{opacity:1;visibility:visible;}',
    ".fv-modal{position:relative;width:100%;max-width:430px;background:#fff;border-radius:18px;padding:30px 28px 26px;box-shadow:0 30px 70px -20px rgba(10,15,48,.55);transform:translateY(12px) scale(.98);transition:transform .25s ease;max-height:calc(100vh - 40px);overflow-y:auto;font-family:'Inter',sans-serif;}",
    '.fv-modal-overlay.is-open .fv-modal{transform:none;}',
    '.fv-modal-close{position:absolute;top:13px;right:13px;width:34px;height:34px;border:none;background:#f1f2f7;color:#0a0f30;border-radius:9px;font-size:20px;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;}',
    '.fv-modal-close:hover{background:#e4e6f0;}',
    '.fv-modal-logo{display:block;height:32px;width:auto;margin:0 auto 14px;border-radius:6px;}',
    ".fv-modal h2{font-family:'Montserrat',sans-serif;font-size:21px;font-weight:800;color:#0a0f30;text-align:center;margin:0 0 6px;}",
    '.fv-modal .fv-sub{font-size:14px;color:#515a7a;text-align:center;margin:0 0 20px;line-height:1.5;}',
    '.fv-tabs{display:flex;gap:4px;background:#f1f2f7;border-radius:11px;padding:4px;margin-bottom:20px;}',
    '.fv-tab{flex:1;border:none;background:transparent;font:inherit;font-size:14px;font-weight:600;color:#515a7a;padding:9px;border-radius:8px;cursor:pointer;}',
    '.fv-tab.is-active{background:#fff;color:#4338ca;box-shadow:0 2px 6px -2px rgba(10,15,48,.2);}',
    '.fv-panel{display:none;}',
    '.fv-panel.is-active{display:block;}',
    '.fv-field{margin-bottom:12px;}',
    '.fv-field label{display:block;font-size:12.5px;font-weight:600;color:#515a7a;margin-bottom:5px;}',
    '.fv-field input{width:100%;font:inherit;font-size:14px;color:#0a0f30;padding:10px 12px;border:1px solid #e4e6f0;border-radius:9px;background:#fff;}',
    '.fv-field input:focus{outline:none;border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,.15);}',
    '.fv-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;font:inherit;font-size:14px;font-weight:700;padding:12px;border-radius:10px;border:none;cursor:pointer;text-decoration:none;box-sizing:border-box;}',
    '.fv-btn[disabled]{opacity:.6;cursor:default;}',
    '.fv-btn-primary{background:linear-gradient(135deg,#4f46e5,#4338ca);color:#fff;}',
    '.fv-btn-primary:hover{filter:brightness(1.06);}',
    '.fv-btn-wa{background:#25d366;color:#fff;}',
    '.fv-btn-wa:hover{filter:brightness(1.04);}',
    '.fv-or{display:flex;align-items:center;gap:10px;color:#9aa0b8;font-size:12px;margin:14px 0;}',
    '.fv-or::before,.fv-or::after{content:"";flex:1;height:1px;background:#e4e6f0;}',
    '.fv-note{font-size:13px;text-align:center;margin-top:10px;min-height:1.2em;line-height:1.4;}',
    '.fv-note.is-success{color:#16a34a;}',
    '.fv-note.is-error{color:#dc2626;}',
    '.fv-signin-text{font-size:14px;color:#515a7a;text-align:center;margin:0 0 16px;line-height:1.5;}',
    '.fv-btn + .fv-btn{margin-top:10px;}',
    '@media(max-width:480px){.fv-modal{padding:26px 20px 22px;}}'
  ].join('');

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var overlay = document.createElement('div');
  overlay.className = 'fv-modal-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = [
    '<div class="fv-modal" role="dialog" aria-modal="true" aria-labelledby="fvModalTitle">',
    '  <button class="fv-modal-close" data-fv-close aria-label="Close">&times;</button>',
    '  <img class="fv-modal-logo" src="assets/img/logo.jpg" alt="FinVisor">',
    '  <h2 id="fvModalTitle">Get started with FinVisor</h2>',
    '  <p class="fv-sub">Create your account or sign in to your dashboard.</p>',
    '  <div class="fv-tabs" role="tablist">',
    '    <button type="button" class="fv-tab is-active" data-fv-tab="signup">Sign up</button>',
    '    <button type="button" class="fv-tab" data-fv-tab="signin">Sign in</button>',
    '  </div>',
    '  <div class="fv-panel is-active" data-fv-panel="signup">',
    '    <form class="fv-form" novalidate>',
    '      <div class="fv-field"><label for="fvName">Full name</label><input id="fvName" name="fullName" type="text" autocomplete="name" required></div>',
    '      <div class="fv-field"><label for="fvStore">Store website</label><input id="fvStore" name="storeWebsite" type="text" placeholder="yourstore.com" required></div>',
    '      <div class="fv-field"><label for="fvPhone">WhatsApp / phone</label><input id="fvPhone" name="phone" type="tel" autocomplete="tel" required></div>',
    '      <button type="submit" class="fv-btn fv-btn-primary">Send a request to connect</button>',
    '      <p class="fv-note" data-fv-note></p>',
    '    </form>',
    '    <div class="fv-or">or</div>',
    '    <a class="fv-btn fv-btn-wa" href="' + WA_SIGNUP + '" target="_blank" rel="noopener">' + WA_ICON + 'Contact us on WhatsApp</a>',
    '  </div>',
    '  <div class="fv-panel" data-fv-panel="signin">',
    '    <p class="fv-signin-text">Already a customer? Open your live dashboard to see your campaign profit.</p>',
    '    <a class="fv-btn fv-btn-primary" href="' + APP_URL + '" target="_blank" rel="noopener">Open my dashboard</a>',
    '    <a class="fv-btn fv-btn-wa" href="' + WA_HELP + '" target="_blank" rel="noopener">' + WA_ICON + 'Need help? WhatsApp us</a>',
    '  </div>',
    '</div>'
  ].join('');
  document.body.appendChild(overlay);

  var modal = overlay.querySelector('.fv-modal');

  function open(tab) {
    if (tab) switchTab(tab);
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    try { sessionStorage.setItem(SEEN_KEY, '1'); } catch (e) {}
  }
  function close() {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    try { sessionStorage.setItem(SEEN_KEY, '1'); } catch (e) {}
  }
  function switchTab(name) {
    overlay.querySelectorAll('.fv-tab').forEach(function (t) {
      t.classList.toggle('is-active', t.getAttribute('data-fv-tab') === name);
    });
    overlay.querySelectorAll('.fv-panel').forEach(function (p) {
      p.classList.toggle('is-active', p.getAttribute('data-fv-panel') === name);
    });
  }

  overlay.addEventListener('click', function (e) {
    if (e.target === overlay || e.target.closest('[data-fv-close]')) close();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) close();
  });
  overlay.querySelectorAll('.fv-tab').forEach(function (t) {
    t.addEventListener('click', function () { switchTab(t.getAttribute('data-fv-tab')); });
  });

  // "Sign up" -> request to connect, into the same sheet as the contact form.
  var form = overlay.querySelector('.fv-form');
  var note = overlay.querySelector('[data-fv-note]');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!form.checkValidity()) {
      note.textContent = 'Please fill in your name, store and phone.';
      note.className = 'fv-note is-error';
      form.reportValidity();
      return;
    }
    var data = new FormData(form);
    var payload = {
      fullName: (data.get('fullName') || '').trim(),
      storeWebsite: (data.get('storeWebsite') || '').trim(),
      phone: (data.get('phone') || '').trim(),
      source: 'Sign-up Modal'
    };
    var btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    note.textContent = 'Sending your request…';
    note.className = 'fv-note';
    fetch(SHEET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      mode: 'no-cors'
    }).then(function () {
      note.textContent = "Thanks! We've got your request and will reach out to connect your store.";
      note.className = 'fv-note is-success';
      form.reset();
    }).catch(function () {
      note.textContent = 'Something went wrong. Please try WhatsApp instead.';
      note.className = 'fv-note is-error';
    }).then(function () {
      btn.disabled = false;
    });
  });

  // Gate buttons such as "Start Now": open the modal instead of navigating.
  document.querySelectorAll('[data-auth-open]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      open(el.getAttribute('data-auth-open') || 'signup');
    });
  });

  // Auto-open once per session on first load.
  var seen = null;
  try { seen = sessionStorage.getItem(SEEN_KEY); } catch (e) {}
  if (!seen) {
    window.setTimeout(function () { open('signup'); }, 700);
  }
})();
