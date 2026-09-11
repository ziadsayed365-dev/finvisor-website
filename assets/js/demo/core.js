// Interactive FinVisor demo dashboard: the same pages, tabs and layout as a live client dashboard,
// running entirely in the browser on the sample data from demo-data.js. Nothing is sent anywhere
// and nothing is saved; a reload starts fresh.
//
// core.js owns the shell (header, routing, Sync, modals, toasts) and the event wiring. Each page
// lives in its own file and registers itself on window.Demo.pages. Pages render HTML strings;
// interactive elements declare what they do with data attributes:
//   data-act="name"   click       -> actions[name](el, event)
//   data-ch="name"    change      -> actions[name](el, event)
//   data-in="name"    input       -> actions[name](el, event)
//   data-form="name"  submit      -> actions[name](form, event)
//   data-kd="name"    keydown     -> actions[name](el, event)
//   data-bind="a.b"   input       -> state.a.b = value (add data-render to repaint)
// The page repaints after every action unless the action returns false. An action can set
// state.focusNext to an element id to move focus there after the repaint.
(function () {
  'use strict';
  const D = window.DemoData;
  const BRAND = 'Your Brand';

  /* ---------------- Formatting ---------------- */

  const esc = (v) =>
    String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmt = (n) => (Math.round(n) || 0).toLocaleString('en-US');
  const fmt2 = (n) => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const fmtEgp = (n) => fmt(n) + ' EGP';
  const fmtMoney = (n) => {
    const r = Math.round(n) || 0;
    const abs = Math.abs(r).toLocaleString('en-US');
    return r < 0 ? `(${abs})` : abs;
  };
  const pct = (num, den) => (den ? `${((num / den) * 100).toFixed(1)}%` : '—');
  const toDate = (s) => new Date((s.length === 7 ? s + '-01' : s) + 'T00:00:00Z');
  const dateText = (s, opts) => toDate(s).toLocaleDateString('en-US', { timeZone: 'UTC', ...opts });
  const fmtDay = (s) => dateText(s, { day: '2-digit', month: 'short' }); // "05 Sep"
  const fmtMonth = (s) => dateText(s, { month: 'long', year: 'numeric' }); // "September 2026"
  const fmtMonthShort = (s) => dateText(s, { month: 'short', year: '2-digit' }); // "Sep 26"
  const fmtMon = (s) => dateText(s, { month: 'short' }); // "Sep"
  const fmtMonYear = (s) => dateText(s, { month: 'short', year: 'numeric' }); // "Sep 2026"
  const fmtDateTime = (iso) => new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

  /* ---------------- State ---------------- */

  const state = {
    page: 'income-statement',
    menuOpen: false,
    perfHistory: D.initialPerfHistory(),
    records: D.initialRecords(),
    modal: null,
    toast: null,
    openMenu: null, // key of the open dropdown or combobox, if any
  };

  let seq = 900000;
  const nextId = () => ++seq;

  const getPath = (path) => path.split('.').reduce((o, k) => o[k], state);

  function setPath(path, value) {
    const keys = path.split('.');
    let o = state;
    for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
    o[keys[keys.length - 1]] = value;
  }

  const pages = {};
  const actions = {};
  const modals = {};
  const mq = window.matchMedia('(max-width: 639px)');
  const isMobile = () => mq.matches;

  /* ---------------- Shared UI pieces ---------------- */

  const ui = {
    tabs(items, active, act) {
      return `<div class="flex gap-1 overflow-x-auto border-b border-gray-200">${items
        .map(
          (t) =>
            `<button type="button" data-act="${act}" data-v="${t.key}" class="whitespace-nowrap px-4 py-2 text-sm font-medium ${
              active === t.key ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }">${esc(t.label)}</button>`
        )
        .join('')}</div>`;
    },
    arrow(dir, { act, disabled, label }) {
      return `<button type="button" data-act="${act}" data-d="${dir}" ${disabled ? 'disabled' : ''} aria-label="${label}" class="flex h-8 w-8 items-center justify-center rounded border border-gray-300 bg-white text-base text-gray-700 shadow-sm hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30">${
        dir < 0 ? '◀' : '▶'
      }</button>`;
    },
    amber(html) {
      return `<div class="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">${html}</div>`;
    },
    options(list, value) {
      return list
        .map((o) => `<option value="${esc(o.value)}"${String(o.value) === String(value) ? ' selected' : ''}>${esc(o.label)}</option>`)
        .join('');
    },
    modal({ title, body, footer = '', width = 'max-w-md' }) {
      return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-act="modal-close">
        <div class="max-h-full w-full ${width} overflow-y-auto rounded-lg bg-white p-5 shadow-xl" data-act="noop" role="dialog" aria-modal="true" aria-label="${esc(title)}">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-base font-semibold text-gray-900">${esc(title)}</h2>
            <button type="button" data-act="modal-close" class="text-gray-400 hover:text-gray-600" aria-label="Close">✕</button>
          </div>
          ${body}
          ${footer}
        </div>
      </div>`;
    },
    // The Excel-style column filter: a button that opens a checkbox list.
    multiSelect({ key, options, selected, act }) {
      const open = state.openMenu === key;
      const label = selected.length === 0 ? 'All' : `${selected.length} selected`;
      return `<div class="relative" data-menu="${key}">
        <button type="button" data-act="menu-toggle" data-key="${key}" class="w-full truncate rounded border border-gray-200 bg-white px-1.5 py-1 text-left text-xs text-gray-700">${label} ▾</button>
        ${
          open
            ? `<div class="absolute z-20 mt-1 max-h-56 w-56 overflow-y-auto rounded-md border border-gray-200 bg-white p-1 shadow-lg">
            <div class="flex justify-between px-1 py-1 text-[11px] text-gray-400">
              <button type="button" class="hover:text-gray-700" data-act="${act}" data-op="all">Select all</button>
              <button type="button" class="hover:text-gray-700" data-act="${act}" data-op="clear">Clear</button>
            </div>
            ${options
              .map(
                (o) =>
                  `<label class="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-gray-50"><input type="checkbox" data-ch="${act}" data-op="toggle" data-v="${esc(o.value)}"${
                    selected.includes(o.value) ? ' checked' : ''
                  }><span class="truncate">${esc(o.label)}</span></label>`
              )
              .join('')}
            ${options.length === 0 ? '<div class="px-1.5 py-1 text-xs text-gray-400">No values</div>' : ''}
          </div>`
            : ''
        }
      </div>`;
    },
  };

  // The new selection after a multiSelect control was used.
  function applyMultiSelect(selected, options, el) {
    const op = el.dataset.op;
    if (op === 'all') return options.map((o) => o.value);
    if (op === 'clear') return [];
    const v = el.dataset.v;
    return selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
  }

  /* ---------------- Shell ---------------- */

  const $ = (id) => document.getElementById(id);

  function headerHtml() {
    const links = D.PERMISSION_TREE.filter((p) => pages[p.key]);
    const link = (p, mobile) =>
      `<a href="#${p.key}" data-act="nav" class="${
        mobile ? 'block px-3 py-2 text-sm' : 'whitespace-nowrap px-2 py-1.5 text-[13px] xl:px-3 xl:text-sm'
      } rounded-md font-medium text-white ${state.page === p.key ? 'bg-white/20' : 'hover:bg-white/10'}"${
        state.page === p.key ? ' aria-current="page"' : ''
      }>${esc(p.label)}</a>`;
    // The full link row needs about 1000px; below that the header folds into the menu button.
    return `<div class="lg:hidden">
        <div class="flex items-center justify-between px-4 py-3">
          <span class="font-semibold text-white">${BRAND}</span>
          <div class="flex items-center gap-1">
            <button type="button" data-act="menu" aria-label="Toggle menu" aria-expanded="${state.menuOpen}" class="rounded-md p-2 text-white hover:bg-white/10">${state.menuOpen ? '✕' : '☰'}</button>
          </div>
        </div>
        ${
          state.menuOpen
            ? `<div class="space-y-1 border-t border-white/10 px-4 py-3">${links.map((p) => link(p, true)).join('')}
              <button type="button" data-act="signout" class="block w-full rounded-md px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10">Sign out</button></div>`
            : ''
        }
      </div>
      <nav class="mx-auto hidden max-w-6xl items-center gap-1 px-4 py-3 lg:flex">
        <span class="mr-4 whitespace-nowrap font-semibold text-white">${BRAND}</span>
        ${links.map((p) => link(p, false)).join('')}
        <button type="button" data-act="signout" class="ml-auto whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-white/80 hover:bg-white/10">Sign out</button>
      </nav>`;
  }

  function paintHeader() {
    $('app-header').innerHTML = headerHtml();
  }

  function paintStrip() {
    const embedded = window.self !== window.top;
    const link = embedded
      ? `<a class="font-semibold underline underline-offset-2 hover:text-amber-700" href="demo-dashboard.html#${state.page}" target="_blank" rel="noopener">Open full screen ↗</a>`
      : `<a class="font-semibold underline underline-offset-2 hover:text-amber-700" href="index.html#dashboard">← Back to FinVisor</a>`;
    $('demo-strip').innerHTML = `<strong>Demo dashboard.</strong> Sample data only, and nothing you change is saved. <span class="mx-1 text-amber-400">·</span>${link}`;
  }

  function paintToast() {
    $('app-toast').innerHTML = state.toast
      ? `<div class="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4"><div class="max-w-md rounded-lg bg-gray-900 px-4 py-2.5 text-center text-sm text-white shadow-lg">${esc(state.toast.msg)}</div></div>`
      : '';
  }

  function render() {
    // Everything is repainted from state, so remember what the user was focused on and where
    // tables were scrolled, and put both back afterwards.
    const active = document.activeElement;
    const focusId = active && active !== document.body && active.id ? active.id : null;
    let sel = null;
    if (focusId) {
      try {
        sel = [active.selectionStart, active.selectionEnd];
      } catch (_) {
        sel = null;
      }
    }
    const scrolls = [...document.querySelectorAll('[data-scroll]')].map((el) => [el.dataset.scroll, el.scrollLeft, el.scrollTop]);

    paintStrip();
    paintHeader();
    $('app-main').innerHTML = pages[state.page].render();
    $('app-modal').innerHTML = state.modal && modals[state.modal.type] ? modals[state.modal.type](state.modal) : '';
    paintToast();

    for (const [key, left, top] of scrolls) {
      const el = document.querySelector(`[data-scroll="${key}"]`);
      if (el) {
        el.scrollLeft = left;
        el.scrollTop = top;
      }
    }
    if (state.focusNext) {
      const el = $(state.focusNext);
      state.focusNext = null;
      if (el) el.focus({ preventScroll: true });
    } else if (focusId) {
      const el = $(focusId);
      if (el) {
        el.focus({ preventScroll: true });
        if (sel && sel[0] != null) {
          try {
            el.setSelectionRange(sel[0], sel[1]);
          } catch (_) {
            /* inputs without a text selection (date, number) */
          }
        }
      }
    }
  }

  let toastTimer = null;
  function toast(msg) {
    state.toast = { msg };
    paintToast();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      state.toast = null;
      paintToast();
    }, 3600);
  }

  /* ---------------- Shell actions ---------------- */

  actions.noop = () => false;
  actions['modal-close'] = () => {
    state.modal = null;
  };
  actions.menu = () => {
    state.menuOpen = !state.menuOpen;
  };
  actions.nav = () => {
    state.menuOpen = false;
    return false; // the hash change repaints
  };
  actions['menu-toggle'] = (el) => {
    state.openMenu = state.openMenu === el.dataset.key ? null : el.dataset.key;
  };
  actions.signout = () => {
    toast('Sign out is turned off in the demo.');
    return false;
  };

  /* ---------------- Events ---------------- */

  function run(fn, el, e, closedMenu) {
    if (fn && fn(el, e) !== false) render();
    else if (closedMenu) render();
  }

  document.addEventListener('click', (e) => {
    let closedMenu = false;
    if (state.openMenu && !e.target.closest(`[data-menu="${state.openMenu}"]`)) {
      state.openMenu = null;
      closedMenu = true;
    }
    const el = e.target.closest('[data-act]');
    const fn = el && !el.disabled ? actions[el.dataset.act] : null;
    if (fn && el.tagName === 'A' && el.getAttribute('href') === '#') e.preventDefault();
    run(fn, el, e, closedMenu);
  });

  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.bind) {
      setPath(t.dataset.bind, t.type === 'checkbox' ? t.checked : t.value);
      if (t.hasAttribute('data-render')) render();
      return;
    }
    const el = t.closest('[data-in]');
    if (el) run(actions[el.dataset.in], el, e, false);
  });

  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-ch]');
    if (el) run(actions[el.dataset.ch], el, e, false);
  });

  document.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-form]');
    if (!form) return;
    e.preventDefault();
    run(actions[form.dataset.form], form, e, false);
  });

  document.addEventListener('keydown', (e) => {
    const kd = e.target.closest && e.target.closest('[data-kd]');
    if (kd && actions[kd.dataset.kd]) {
      run(actions[kd.dataset.kd], kd, e, false);
      if (e.defaultPrevented) return;
    }
    if (e.key !== 'Escape') return;
    if (state.openMenu) state.openMenu = null;
    else if (state.modal) state.modal = null;
    else return;
    render();
  });

  const pageFromHash = () => {
    const key = decodeURIComponent(location.hash.slice(1));
    return pages[key] ? key : 'income-statement';
  };

  window.addEventListener('hashchange', () => {
    state.page = pageFromHash();
    state.menuOpen = false;
    state.openMenu = null;
    state.modal = null;
    render();
    window.scrollTo(0, 0);
  });

  function boot() {
    state.page = pageFromHash();
    render();
    mq.addEventListener('change', render);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);

  window.Demo = {
    D, state, pages, actions, modals, ui, render, toast, getPath, setPath, nextId, isMobile, applyMultiSelect,
    esc, fmt, fmt2, fmtEgp, fmtMoney, pct, fmtDay, fmtMonth, fmtMonthShort, fmtMon, fmtMonYear, fmtDateTime,
  };
})();
