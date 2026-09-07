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
document.querySelectorAll('[data-count]').forEach((el) => countUpObserver.observe(el));

// Scroll reveal
document.querySelectorAll('.service-card, .stat, .case-card, .process-list li, .dash-shell, .testimonial-slider, .about-grid, .contact-grid').forEach((el) => {
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
    businessName: data.get('businessName').trim(),
    businessType: data.get('businessType').trim(),
    phone: data.get('phone').trim(),
    email: data.get('email').trim(),
    monthlyOrders: data.get('monthlyOrders') || '',
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
        em: payload.email.toLowerCase(),
        ph: payload.phone.replace(/\D/g, ''),
      });
      fbq('track', 'Lead');
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
      if (typeof fbq === 'function') fbq('track', 'Contact');
    });
  });
