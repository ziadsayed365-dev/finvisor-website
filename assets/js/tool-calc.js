// Shared wiring for the FinVisor App calculators. Each tool page loads this before its own script
// (pricing-tool.js, cpa-tool.js), which supplies only the math: an update function that is called
// with { read, out, drawBar } whenever any input changes.
//
// Everything runs in the browser; nothing typed into a calculator is sent anywhere. The inputs stay
// disabled until the visitor has signed up once (see early-access.js).

// `|| 0` turns the -0 that Math.round gives for tiny negatives (e.g. -0.18) into a plain 0.
const formatWhole = (value) => (Math.round(value) || 0).toLocaleString('en-US');
const formatMoney = (value) => `${value < 0 ? '−' : ''}EGP ${formatWhole(Math.abs(value))}`;
const clampNumber = (value, min, max) => Math.min(Math.max(value, min), max);

function setupToolCalculator(form, update) {
  const inputs = form.querySelectorAll('input');
  const out = (name) => form.querySelector(`[data-out="${name}"]`);

  // Blank, negative or non-numeric fields count as zero rather than breaking the result.
  const read = (name) => {
    const value = parseFloat(form.elements[name].value);
    return Number.isFinite(value) && value > 0 ? value : 0;
  };

  // Sizes each .tool-bar [data-seg] slice as its share of total, and writes the matching legend
  // figure. A negative slice is drawn as empty.
  const drawBar = (shares, total) => {
    Object.entries(shares).forEach(([name, value]) => {
      form.querySelector(`.tool-bar [data-seg="${name}"]`).style.width = total > 0 ? `${(Math.max(value, 0) / total) * 100}%` : '0';
      form.querySelector(`[data-leg="${name}"]`).textContent = formatWhole(value);
    });
  };

  // Each slider and the number box beside it stay in step, whichever one is moved. --fill paints
  // the slider's track up to the thumb.
  form.querySelectorAll('input[type="range"]').forEach((range) => {
    const box = form.elements[range.dataset.sync];
    const paint = () => {
      const fill = ((range.value - range.min) / (range.max - range.min)) * 100;
      range.style.setProperty('--fill', `${fill}%`);
    };
    range.addEventListener('input', () => { box.value = range.value; paint(); });
    box.addEventListener('input', () => { range.value = box.value; paint(); });
    paint();
  });

  const enable = () => inputs.forEach((input) => { input.disabled = false; });

  if (document.documentElement.hasAttribute('data-app-unlocked')) enable();

  // Fired by early-access.js the moment the sign-up goes through: open the calculator and drop
  // the visitor straight into the first field.
  document.addEventListener('fv:app-unlocked', () => {
    enable();
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    inputs[0].focus({ preventScroll: true });
    inputs[0].select();
  });

  const run = () => update({ read, out, drawBar });
  form.addEventListener('input', run);
  // Enter in a field would otherwise submit the form and reload the page.
  form.addEventListener('submit', (event) => event.preventDefault());

  run();
}
