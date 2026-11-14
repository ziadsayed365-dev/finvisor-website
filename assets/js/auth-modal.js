/* FinVisor onboarding links.
   The marketing site has no popup and no login of its own. Buttons just link
   to the real app's auth page (like Invia's "Try now" -> onboarding.invia.live):

     - [data-auth-open="signup"]  (e.g. "Start Now") -> app /auth?state=signup
     - header "Sign in" button                        -> app /auth?state=signin

   The current page's tracking tags (utm_*, fbclid, ...) are forwarded to the
   app URL so a sign-up can be attributed to the ad that brought the visitor.
   Only needs: <script src="assets/js/auth-modal.js" defer></script>. */
(function () {
  'use strict';

  var APP_AUTH = 'https://app.fin-visor.com/auth';

  // Build the app auth URL for a given state, forwarding any tracking params.
  function appUrl(state) {
    var qs = (window.location.search || '').replace(/^\?/, '');
    return APP_AUTH + '?state=' + encodeURIComponent(state) + (qs ? '&' + qs : '');
  }

  // Header "Sign in" button (styled for the navy header).
  var header = document.querySelector('.site-header .header-inner');
  if (header && !header.querySelector('.fv-account')) {
    var css = [
      '.fv-account{display:flex;align-items:center;margin-left:14px;}',
      '.fv-acct-signin{font-family:inherit;font-weight:600;font-size:14px;color:#fff;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:8px 16px;text-decoration:none;display:inline-block;white-space:nowrap;}',
      '.fv-acct-signin:hover{background:rgba(255,255,255,.18);}'
    ].join('');
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    var wrap = document.createElement('div');
    wrap.className = 'fv-account';
    wrap.innerHTML = '<a class="fv-acct-signin" href="' + appUrl('signin') + '">Sign in</a>';
    var cta = header.querySelector('.header-cta');
    if (cta) header.insertBefore(wrap, cta); else header.appendChild(wrap);
  }

  // Gated buttons such as "Start Now" -> app auth, state from the attribute.
  document.querySelectorAll('[data-auth-open]').forEach(function (el) {
    var state = el.getAttribute('data-auth-open') === 'signin' ? 'signin' : 'signup';
    el.setAttribute('href', appUrl(state));
  });
})();
