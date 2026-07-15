// src/views/sync.js — join gate, then Mine/Group panels + recommendations.
import { subscribeSync, saveGrid } from '../db.js';
import {
  decodeGrid, encodeGrid, emptyGrid, sanitizeName,
  heatDensity, topWindows, dayLabels, daysInMonth,
} from '../logic.js';
import { renderGrid } from '../components/grid.js';

export function renderSync(el, syncId) {
  let sync = null;        // latest server snapshot
  let myName = null;      // set after join gate
  let myGrid = null;      // local source of truth for own marks
  let tab = 'mine';       // mobile panel toggle
  let myDay = 0;          // active day, day-style "mine" grid
  let groupDay = 0;       // active day, day-style group grid
  let duration = 1;
  let saveTimer = null;
  let dirty = false;
  let loaded = false;

  el.innerHTML = `<div class="card muted">Loading sync…</div>`;

  const unsub = subscribeSync(syncId, data => {
    sync = data;
    if (!data) { renderNotFound(); return; }
    if (!loaded) {
      loaded = true;
      renderJoin();
    } else if (myName) {
      refreshLive();
    } else {
      renderJoin(); // still on gate; refresh chips
    }
  });

  function renderNotFound() {
    el.innerHTML = `
      <div class="app-header"><h1><a href="#/">TimeSync</a></h1></div>
      <div class="card">
        <p>Sync not found.</p>
        <p class="muted">The link may be wrong, the sync was removed, or the
        connection failed.</p>
        <div class="row">
          <button class="btn" id="nf-retry">Retry</button>
          <a class="btn" href="#/">Create a new sync</a>
        </div>
      </div>`;
    el.querySelector('#nf-retry').addEventListener('click', () => location.reload());
  }

  // ---- Join gate ----------------------------------------------------
  function renderJoin() {
    const prevInput = el.querySelector('#j-name');
    const typed = prevInput?.value ?? '';
    const wasFocused = prevInput && document.activeElement === prevInput;
    const caret = prevInput?.selectionStart ?? typed.length;
    const people = Object.keys(sync.people || {});
    const summary = [
      sync.mode === 'week' ? 'Weekly' : sync.month,
      `${sync.hourStart}:00–${sync.hourEnd}:00`,
      `${people.length} joined`,
    ].join(' · ');

    el.innerHTML = `
      <div class="app-header"><h1><a href="#/">TimeSync</a></h1></div>
      <div class="card" style="max-width: 480px; margin: 0 auto;">
        <h2 style="font-size: 16px; margin: 0 0 2px;">${esc(sync.name)}</h2>
        <p class="muted" style="margin-top: 0;">${esc(summary)}</p>
        <div class="field">
          <label class="label" for="j-name">Your name</label>
          <input type="text" id="j-name" maxlength="30" placeholder="e.g. Alice">
          <p class="muted">Entering an existing name edits that person's marks.</p>
        </div>
        <button class="btn btn-primary" id="j-go" style="width: 100%;">Continue</button>
        ${people.length ? `
          <div class="field" style="margin-top: 14px;">
            <span class="label">Already joined</span>
            <div class="chips">${people.map(p => `<button class="chip" data-n="${esc(p)}">${esc(p)}</button>`).join('')}</div>
          </div>` : ''}
      </div>`;

    const input = el.querySelector('#j-name');
    input.value = typed;
    // Re-renders fire on every live snapshot — don't steal a typing user's focus.
    if (wasFocused) { input.focus(); input.setSelectionRange(caret, caret); }
    const join = raw => {
      const name = sanitizeName(raw);
      if (!name) return;
      myName = name;
      myGrid = decodeGrid(sync.people?.[name], dayCount());
      renderMain();
    };
    el.querySelector('#j-go').addEventListener('click', () => join(input.value));
    input.addEventListener('keydown', e => { if (e.key === 'Enter') join(input.value); });
    el.querySelectorAll('.chip').forEach(c =>
      c.addEventListener('click', () => join(c.dataset.n)));
  }

  // ---- Main view -----------------------------------------------------
  function renderMain() {
    el.innerHTML = `
      <div class="app-header">
        <h1><a href="#/">TimeSync</a></h1>
        <span class="muted">${esc(sync.name)} · you are <b>${esc(myName)}</b></span>
      </div>
      <div class="stack">
        <div class="row-between">
          <div class="seg tab-toggle" id="s-tabs">
            <button type="button" data-v="mine" class="on">Mine</button>
            <button type="button" data-v="group">Group</button>
          </div>
          <div class="row">
            <span class="muted" id="s-count"></span>
            <button class="btn" id="s-copy">Copy link</button>
          </div>
        </div>
        <div class="panels" data-tab="mine">
          <div class="card panel panel-mine">
            <div class="row-between">
              <span class="label" style="margin: 0;">Your availability</span>
              <button class="btn" id="s-clear" style="padding: 4px 10px; font-size: 12px;">Clear</button>
            </div>
            <div id="s-mine-tabs"></div>
            <div id="s-mine"></div>
          </div>
          <div class="card panel panel-group">
            <span class="label">Group availability</span>
            <div id="s-group-tabs"></div>
            <div id="s-group"></div>
          </div>
        </div>
        <div class="card">
          <div class="row-between">
            <span class="label" style="margin: 0;">Top recommended times</span>
            <select id="s-dur" style="width: auto;">
              ${[1, 2, 3, 4, 5, 6, 7, 8].map(h =>
                `<option value="${h}">Duration: ${h}h</option>`).join('')}
            </select>
          </div>
          <div id="s-recs"></div>
        </div>
      </div>`;

    el.querySelector('#s-tabs').addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      tab = btn.dataset.v;
      el.querySelectorAll('#s-tabs button').forEach(b => b.classList.toggle('on', b === btn));
      el.querySelector('.panels').dataset.tab = tab;
    });

    el.querySelector('#s-copy').addEventListener('click', async e => {
      await navigator.clipboard.writeText(location.href);
      e.target.textContent = 'Copied';
      setTimeout(() => { e.target.textContent = 'Copy link'; }, 1200);
    });

    el.querySelector('#s-clear').addEventListener('click', () => {
      myGrid = emptyGrid(dayCount());
      renderMine();
      queueSave();
      refreshLive();
    });

    el.querySelector('#s-dur').addEventListener('change', e => {
      duration = Number(e.target.value);
      renderRecs();
    });

    renderMine();
    refreshLive();
  }

  function dayCount() { return sync.mode === 'month' ? daysInMonth(sync.month) : 7; }
  function style() { return sync.mode === 'month' ? 'day' : sync.gridStyle; }
  function labels() { return dayLabels(sync.mode, sync.mode === 'month' ? sync.month : null); }

  function dayTabs(container, active, onPick) {
    if (style() !== 'day') { container.innerHTML = ''; return; }
    if (sync.mode === 'month') {
      // Mini calendar: Mon-first weekday columns, offset blanks before day 1.
      const [y, m] = String(sync.month).split('-').map(Number);
      const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7;
      container.innerHTML = `<div class="cal">
        ${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(w => `<div class="cal-wd">${w}</div>`).join('')}
        ${'<div></div>'.repeat(offset)}
        ${labels().map((_, i) =>
          `<button type="button" data-d="${i}" class="${i === active ? 'on' : ''}">${i + 1}</button>`).join('')}
      </div>`;
      container.querySelector('.cal').addEventListener('click', e => {
        const btn = e.target.closest('button');
        if (btn) onPick(Number(btn.dataset.d));
      });
      return;
    }
    container.innerHTML = `<div class="seg" style="margin: 8px 0; flex-wrap: wrap;">
      ${labels().map((l, i) =>
        `<button type="button" data-d="${i}" class="${i === active ? 'on' : ''}">${l}</button>`).join('')}
    </div>`;
    container.querySelector('.seg').addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (btn) onPick(Number(btn.dataset.d));
    });
  }

  // Own grid: rendered on join/tab/day change ONLY — never from onValue,
  // so live updates can't interrupt a drag.
  function renderMine() {
    dayTabs(el.querySelector('#s-mine-tabs'), myDay, d => { myDay = d; renderMine(); });
    renderGrid(el.querySelector('#s-mine'), {
      dayLabels: labels(),
      hourStart: sync.hourStart,
      hourEnd: sync.hourEnd,
      gridStyle: style(),
      activeDay: myDay,
      grid: myGrid,
      onToggle: () => { queueSave(); refreshLive(); },
    });
  }

  // Group panel + recommendations + count: refreshed on every change.
  function refreshLive() {
    const others = Object.entries(sync.people || {})
      .filter(([n]) => n !== myName)
      .map(([, s]) => decodeGrid(s, dayCount()));
    const grids = [...others, myGrid];
    const density = heatDensity(grids);
    const total = grids.length;

    el.querySelector('#s-count').textContent =
      `${total} participant${total === 1 ? '' : 's'}`;

    dayTabs(el.querySelector('#s-group-tabs'), groupDay, d => { groupDay = d; refreshLive(); });
    renderGrid(el.querySelector('#s-group'), {
      dayLabels: labels(),
      hourStart: sync.hourStart,
      hourEnd: sync.hourEnd,
      gridStyle: style(),
      activeDay: groupDay,
      heat: { density, total },
    });

    renderRecs(density, total);
  }

  function renderRecs(density, total) {
    if (!density) {
      const others = Object.entries(sync.people || {})
        .filter(([n]) => n !== myName)
        .map(([, s]) => decodeGrid(s, dayCount()));
      const grids = [...others, myGrid];
      density = heatDensity(grids);
      total = grids.length;
    }
    const wins = topWindows(density, duration);
    const target = el.querySelector('#s-recs');
    if (!wins.length) {
      target.innerHTML = `<p class="muted">No overlapping times yet${duration > 1 ? ` for a ${duration}h window` : ''}. Mark some availability.</p>`;
      return;
    }
    const dl = labels();
    target.innerHTML = wins.map((w, i) => `
      <div class="rec-item">
        <span class="rec-rank">#${i + 1}</span>
        <span>${dl[w.day]} ${w.hour}:00–${w.hour + duration}:00</span>
        <span class="rec-count">${w.count}/${total} people</span>
      </div>`).join('');
  }

  function queueSave() {
    dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      dirty = false;
      saveGrid(syncId, myName, encodeGrid(myGrid)).catch(() => {
        // transient network failure — next toggle retries; grid stays local
      });
    }, 400);
  }

  return () => {
    unsub();
    clearTimeout(saveTimer);
    // Flush pending edits so navigating away can't lose the last 400ms.
    if (dirty && myName) saveGrid(syncId, myName, encodeGrid(myGrid)).catch(() => {});
  };
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
