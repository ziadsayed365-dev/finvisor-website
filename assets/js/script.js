document.getElementById('year').textContent = new Date().getFullYear();

// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const nav = document.getElementById('nav');

navToggle.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('is-open');
  navToggle.classList.toggle('is-open', isOpen);
  navToggle.setAttribute('aria-expanded', String(isOpen));
});

nav.querySelectorAll('.nav-link').forEach((link) => {
  link.addEventListener('click', () => {
    nav.classList.remove('is-open');
    navToggle.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

// Active nav link on scroll
const sections = document.querySelectorAll('main section[id]');
const navLinks = document.querySelectorAll('.nav-link');

const setActiveLink = (id) => {
  navLinks.forEach((link) => {
    link.classList.toggle('is-active', link.getAttribute('href') === `#${id}`);
  });
};

const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) setActiveLink(entry.target.id);
    });
  },
  { rootMargin: '-45% 0px -50% 0px' }
);
sections.forEach((section) => sectionObserver.observe(section));

// "#top" targets the sticky header, which browsers treat as already in view and won't scroll to.
// Drive those links manually so Home / logo / back-to-top reliably jump to the very top.
document.querySelectorAll('a[href="#top"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setActiveLink('top');
  });
});

window.addEventListener('scroll', () => {
  if (window.scrollY < 80) setActiveLink('top');
});

// Testimonial slider
const testimonialSlider = document.getElementById('testimonialSlider');
if (testimonialSlider) {
  const slides = testimonialSlider.querySelectorAll('.testimonial');
  const dots = testimonialSlider.querySelectorAll('.testimonial-dots button');
  let current = 0;
  let timer;

  const showSlide = (index) => {
    slides[current].classList.remove('is-active');
    dots[current].classList.remove('is-active');
    current = (index + slides.length) % slides.length;
    slides[current].classList.add('is-active');
    dots[current].classList.add('is-active');
  };

  const startAutoplay = () => {
    clearInterval(timer);
    timer = setInterval(() => showSlide(current + 1), 4000);
  };

  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      showSlide(i);
      startAutoplay();
    });
  });

  testimonialSlider.addEventListener('mouseenter', () => clearInterval(timer));
  testimonialSlider.addEventListener('mouseleave', startAutoplay);

  startAutoplay();
}

// Stat count-up. Each [data-count] ticks from 0 to its target the first time it
// scrolls into view; data-prefix / data-suffix / data-decimals shape the text so
// the markup keeps the final value as its no-JS fallback.
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const formatCount = (value, decimals) =>
  decimals > 0
    ? value.toFixed(decimals)
    : Math.round(value).toLocaleString('en-US');

const runCountUp = (el) => {
  const target = parseFloat(el.dataset.count);
  if (Number.isNaN(target)) return;

  const decimals = parseInt(el.dataset.decimals || '0', 10);
  const prefix = el.dataset.prefix || '';
  const suffix = el.dataset.suffix || '';
  const render = (v) => { el.textContent = `${prefix}${formatCount(v, decimals)}${suffix}`; };

  if (prefersReducedMotion) { render(target); return; }

  // The markup still holds the final value, so measure it now and pin that width: without
  // this, "EGP 4M+" growing to "EGP 20M+" mid-count shoves whatever sits beside it. Only
  // shrink-wrapped numbers can jitter — a block-level one already owns its whole line.
  if (getComputedStyle(el).display !== 'block') {
    const settledWidth = el.getBoundingClientRect().width;
    if (settledWidth) el.style.minWidth = `${Math.ceil(settledWidth)}px`;
  }

  const duration = 1400;
  const start = performance.now();
  const tick = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    // easeOutExpo: fast off the line, settles gently on the real figure
    const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    render(target * eased);
    if (progress < 1) requestAnimationFrame(tick);
  };
  render(0);
  requestAnimationFrame(tick);
};

const countUpObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      runCountUp(entry.target);
      countUpObserver.unobserve(entry.target);
    });
  },
  { threshold: 0.5 }
);
// The hero's counters are driven by the entrance sequence below, not by scroll position —
// they are already on screen at load, so the observer would fire them behind a faded-out hero.
document.querySelectorAll('[data-count]').forEach((el) => {
  if (el.closest('.hero')) return;
  countUpObserver.observe(el);
});

// Hero headline split test. Variant A is what the markup ships with; a visitor drawn into
// variant C gets the copy parked on data-variant-c. The assignment is sticky per browser so
// a returning visitor never sees the headline change under them.
const HERO_VARIANT_KEY = 'fv_hero_variant';
let heroVariant = 'a';
try {
  heroVariant = localStorage.getItem(HERO_VARIANT_KEY) || (Math.random() < 0.5 ? 'a' : 'c');
  localStorage.setItem(HERO_VARIANT_KEY, heroVariant);
} catch (err) {
  // Private mode or blocked storage: everyone falls back to the shipped variant.
  heroVariant = 'a';
}

// Rebuilds an element's text from a small markup shorthand: "|" is a line break, *asterisks*
// mark the accented phrase, and ~tildes~ mark the phrase to be struck through. Assembled from
// real nodes rather than innerHTML.
const MARKERS = { '*': 'hl', '~': 'strike' };

const setLines = (el, text) => {
  el.textContent = '';
  text.split('|').forEach((line, index) => {
    // The space matters on phones, where the <br> is hidden: without it the words either side
    // of the break run together.
    if (index) el.append(' ', document.createElement('br'));
    line.split(/(\*[^*]+\*|~[^~]+~)/).forEach((part) => {
      if (!part) return;
      const cls = part.length > 2 && part[0] === part[part.length - 1] ? MARKERS[part[0]] : null;
      if (cls) {
        const span = document.createElement('span');
        span.className = cls;
        span.textContent = part.slice(1, -1);
        el.appendChild(span);
      } else {
        el.appendChild(document.createTextNode(part));
      }
    });
  });
};

if (heroVariant === 'c') {
  const headline = document.getElementById('heroHeadline');
  if (headline && headline.dataset.variantC) setLines(headline, headline.dataset.variantC);
}

// Hero entrance: stagger the column in, then start its counters as the proof strip lands.
const heroEl = document.querySelector('.hero');
if (heroEl) {
  const heroSteps = heroEl.querySelectorAll('.hero-anim');
  heroSteps.forEach((el, index) => el.style.setProperty('--step', index));

  // Two frames: the first lets the browser paint the starting state, so adding .is-ready in
  // the second actually transitions instead of snapping straight to the end.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => heroEl.classList.add('is-ready'));
  });

  const heroCounters = heroEl.querySelectorAll('[data-count]');
  if (heroCounters.length) {
    const countersStart = prefersReducedMotion ? 0 : heroSteps.length * 90 + 200;
    window.setTimeout(() => heroCounters.forEach(runCountUp), countersStart);
  }
}

// Scroll reveal
document.querySelectorAll('.service-card, .stat, .app-tool, .process-list li, .dash-shell, .testimonial-slider, .about-grid, .contact-grid').forEach((el) => {
  el.setAttribute('data-reveal', '');
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);
document.querySelectorAll('[data-reveal]').forEach((el) => revealObserver.observe(el));

// Contact form -> sends data to the "Finvisor Data Form" Google Sheet via an Apps Script Web App.
// Replace this with the deployment URL from Deploy > New deployment > Web app (see google-apps-script.gs).
const GOOGLE_SHEET_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwDqZTakq2zi9HbN_8rJxjsdVJFDq0wZUHLUcwrVCGTzIEvXCf-wV8FsIgD40qjtvQ/exec';

const contactForm = document.getElementById('contactForm');
const formNote = document.getElementById('formNote');
const submitBtn = contactForm.querySelector('button[type="submit"]');

contactForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!contactForm.checkValidity()) {
    formNote.textContent = 'Please fill in all fields before submitting.';
    formNote.className = 'form-note is-error';
    contactForm.reportValidity();
    return;
  }

  const data = new FormData(contactForm);
  const payload = {
    fullName: data.get('fullName').trim(),
    storeWebsite: data.get('storeWebsite').trim(),
    businessType: data.get('businessType').trim(),
    phone: data.get('phone').trim(),
    monthlyOrders: data.get('monthlyOrders') || '',
    // Fills the sheet's Source column; the app preview pages send their own value.
    source: 'Website Contact Form',
  };

  submitBtn.disabled = true;
  formNote.textContent = 'Sending...';
  formNote.className = 'form-note';

  try {
    await fetch(GOOGLE_SHEET_WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    formNote.textContent = "Thanks! We've received your details and will be in touch soon.";
    formNote.className = 'form-note is-success';
    contactForm.reset();

    // Meta Pixel: send advanced matching from the form, then fire Lead.
    // Values are passed in plaintext; the Pixel normalizes and SHA-256 hashes
    // them in the browser before sending, so raw PII never leaves the page.
    if (typeof fbq === 'function') {
      const [firstName, ...lastNameParts] = payload.fullName.split(/\s+/);
      fbq('init', '890487917437592', {
        fn: firstName || '',
        ln: lastNameParts.join(' '),
        ph: payload.phone.replace(/\D/g, ''),
      });
      // hero_variant tags the conversion with the headline this visitor saw, so the split
      // test can be read off Lead volume per variant in Events Manager.
      fbq('track', 'Lead', { hero_variant: heroVariant });
    }
  } catch (err) {
    formNote.textContent = 'Something went wrong sending your request. Please try again or contact us directly.';
    formNote.className = 'form-note is-error';
  } finally {
    submitBtn.disabled = false;
  }
});

// Meta Pixel: fire Contact when a visitor clicks a direct contact channel
// (phone, email, or WhatsApp). Guarded so it no-ops if the pixel is blocked.
document
  .querySelectorAll('a[href^="tel:"], a[href^="mailto:"], a[href*="wa.me"]')
  .forEach((link) => {
    link.addEventListener('click', () => {
      if (typeof fbq === 'function') fbq('track', 'Contact', { hero_variant: heroVariant });
    });
  });

// Services: each problem card opens a dialog listing the services that fix it. The close button,
// the booking link inside, a click on the backdrop and Esc all close it. Opens are sent to the
// Pixel so interest in each problem can be compared.
document.querySelectorAll('[data-service-open]').forEach((button) => {
  const dialog = document.getElementById(button.dataset.serviceOpen);
  if (!dialog) return;
  button.addEventListener('click', () => {
    dialog.showModal();
    if (typeof fbq === 'function') fbq('trackCustom', 'ServiceDetails', { service: button.dataset.serviceOpen });
  });
});

document.querySelectorAll('.svc-dialog').forEach((dialog) => {
  dialog.querySelectorAll('[data-close-dialog]').forEach((control) => {
    control.addEventListener('click', () => dialog.close());
  });
  // The card fills the dialog, so a click that lands on the dialog element itself is on the
  // backdrop around it.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
});

// Meta Pixel: count clicks on the FinVisor App tiles, so demand for each tool can be
// measured before the app is built.
document.querySelectorAll('.app-tool[data-tool]').forEach((tile) => {
  tile.addEventListener('click', () => {
    if (typeof fbq === 'function') fbq('trackCustom', 'AppToolInterest', { tool: tile.dataset.tool });
  });
});
