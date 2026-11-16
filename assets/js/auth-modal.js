/* FinVisor onboarding links.
   The marketing site has no popup and no login of its own. Accounts are created
   by FinVisor (admin-created in the CRM), so the primary CTA links to the app's
   PUBLIC request form — no login or sign-up required:

     - [data-auth-open="signup"]  (e.g. "Start Now") -> app /get-started
     - [data-auth-open="signin"]                       -> app /auth?state=signin

   The current page's tracking tags (utm_*, fbclid, ...) are forwarded to the
   app URL so a request can be attributed to the ad that brought the visitor.
   Only needs: <script src="assets/js/auth-modal.js" defer></script>. */
(function () {
  'use strict';

  var APP_BASE = 'https://app.fin-visor.com';

  // Append the current page's tracking params to an app path.
  function withTracking(path) {
    var qs = (window.location.search || '').replace(/^\?/, '');
    if (!qs) return APP_BASE + path;
    return APP_BASE + path + (path.indexOf('?') === -1 ? '?' : '&') + qs;
  }

  // Gated buttons such as "Start Now" -> the app's public request form
  // (/get-started, no login). A "signin" variant still points at /auth.
  document.querySelectorAll('[data-auth-open]').forEach(function (el) {
    var signin = el.getAttribute('data-auth-open') === 'signin';
    el.setAttribute('href', withTracking(signin ? '/auth?state=signin' : '/get-started'));
  });
})();
