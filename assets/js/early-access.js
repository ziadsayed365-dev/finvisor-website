// Sign-up gate for the FinVisor App tools. A [data-open-dialog] control opens the matching
// <dialog>, which holds the same fields as the homepage contact form. A successful submission goes
// to the same Google Sheet, tagged with the form's data-source, and unlocks the tools: the page is
// marked with data-app-unlocked (which hides the lock overlay in CSS) and fv:app-unlocked is fired
// so the tool can enable its inputs. The unlock is remembered in localStorage under
// APP_UNLOCK_KEY, so a visitor signs up once per browser; the tool page's <head> reads the same
// key back before first paint.

// The same Apps Script Web App as assets/js/script.js. If the script is ever redeployed under a
// new URL, update both files.
const GOOGLE_SHEET_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwDqZTakq2zi9HbN_8rJxjsdVJFDq0wZUHLUcwrVCGTzIEvXCf-wV8FsIgD40qjtvQ/exec';
const APP_UNLOCK_KEY = 'fv_app_unlocked';

const isAppUnlocked = () => document.documentElement.hasAttribute('data-app-unlocked');

const unlockApp = () => {
  try {
    localStorage.setItem(APP_UNLOCK_KEY, '1');
  } catch (err) {
    // Private mode or blocked storage: the tool stays unlocked for this visit only.
  }
  document.documentElement.setAttribute('data-app-unlocked', '');
  document.dispatchEvent(new CustomEvent('fv:app-unlocked'));
};

document.querySelectorAll('.ea-dialog').forEach((dialog) => {
  const form = dialog.querySelector('form');
  const note = form.querySelector('.form-note');
  const submitBtn = form.querySelector('button[type="submit"]');

  document.querySelectorAll(`[data-open-dialog="${dialog.id}"]`).forEach((control) => {
    control.addEventListener('click', (event) => {
      // Already signed up: let the control do its normal job (the hero link scrolls to the tool).
      if (isAppUnlocked()) return;
      event.preventDefault();
      note.textContent = '';
      note.className = 'form-note';
      dialog.showModal();
    });
  });

  dialog.querySelectorAll('[data-close-dialog]').forEach((button) => {
    button.addEventListener('click', () => dialog.close());
  });

  // The card fills the dialog, so a click that lands on the dialog element itself is on the
  // backdrop around it.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      note.textContent = 'Please fill in all fields before submitting.';
      note.className = 'form-note is-error';
      form.reportValidity();
      return;
    }

    const data = new FormData(form);
    const payload = {
      fullName: data.get('fullName').trim(),
      storeWebsite: data.get('storeWebsite').trim(),
      businessType: data.get('businessType').trim(),
      phone: data.get('phone').trim(),
      monthlyOrders: data.get('monthlyOrders') || '',
      source: form.dataset.source,
    };

    submitBtn.disabled = true;
    note.textContent = 'Sending...';
    note.className = 'form-note';

    try {
      await fetch(GOOGLE_SHEET_WEB_APP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
      form.reset();
      dialog.close();

      // Meta Pixel: the same advanced matching and Lead event as the homepage form, with the
      // source attached so app sign-ups can be told apart in Events Manager.
      if (typeof fbq === 'function') {
        const [firstName, ...lastNameParts] = payload.fullName.split(/\s+/);
        fbq('init', '890487917437592', {
          fn: firstName || '',
          ln: lastNameParts.join(' '),
          ph: payload.phone.replace(/\D/g, ''),
        });
        fbq('track', 'Lead', { source: payload.source });
      }

      unlockApp();
    } catch (err) {
      note.textContent = 'Something went wrong sending your request. Please try again or contact us directly.';
      note.className = 'form-note is-error';
    } finally {
      submitBtn.disabled = false;
    }
  });
});
