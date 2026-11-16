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

  // (Header "Sign in" button removed — accounts are created by FinVisor, so
  // there is no self-serve sign-in entry point on the marketing site.)

  // Gated buttons such as "Start Now" -> app auth, state from the attribute.
  document.querySelectorAll('[data-auth-open]').forEach(function (el) {
    var state = el.getAttribute('data-auth-open') === 'signin' ? 'signin' : 'signup';
    el.setAttribute('href', appUrl(state));
  });
})();
