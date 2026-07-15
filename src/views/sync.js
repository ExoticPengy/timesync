// src/views/sync.js — join gate, then Mine/Group panels + recommendations.
import { subscribeSync, saveGrid, updateSync } from '../db.js';
import {
  decodeGrid, encodeGrid, emptyGrid, sanitizeName,
  heatDensity, topWindows, dayLabels, daysInMonth, monthsOf,
} from '../logic.js';
import {
  renderGrid, renderDayPicker, renderMonthCals, fmtHour,
} from '../components/grid.js';

export function renderSync(el, syncId) {
  let sync = null;        // latest server snapshot
  let myName = null;      // set after join gate
  let myGrid = null;      // local source of truth for own marks
  let tab = 'mine';       // mobile panel toggle
  let myDay = 0;          // active day, day-style "mine" grid
  let groupDay = 0;       // active day, day-style group grid
  let duration = 1;
  let req = 'best';       // recommendations: 'best' effort or 'all' free
  let saveTimer = null;
  let dirty = false;
  let loaded = false;

  el.innerHTML = `<div class="card muted">Loading sync…</div>`;

  // Settings edits (name/hours/style) need a full re-render, not just the
  // live group refresh — grids and labels change shape.
  const settingsSig = s => `${s.name}|${s.hourStart}|${s.hourEnd}|${s.gridStyle}`;
  let lastSig = null;

  const unsub = subscribeSync(syncId, data => {
    sync = data;
    if (!data) { renderNotFound(); return; }
    const sig = settingsSig(data);
    if (!loaded) {
      loaded = true;
      renderJoin();
    } else if (myName) {
      if (sig !== lastSig) renderMain();
      else refreshLive();
    } else {
      renderJoin(); // still on gate; refresh chips
    }
    lastSig = sig;
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
      sync.mode === 'week' ? 'Weekly' : monthsOf(sync).join(', '),
      sync.dayOnly ? 'Day poll'
        : sync.hourStart === 0 && sync.hourEnd === 24
          ? 'All day' : `${fmtHour(sync.hourStart)}–${fmtHour(sync.hourEnd)}`,
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
            <button class="btn" id="s-edit">Edit</button>
            <button class="btn" id="s-copy">Copy link</button>
          </div>
        </div>
        <div class="card" id="s-settings" style="display: none;">
          <div class="field">
            <label class="label" for="e-name">Sync name</label>
            <input type="text" id="e-name" maxlength="100" value="${esc(sync.name)}">
          </div>
          ${sync.dayOnly ? '' : `
          <div class="field">
            <span class="label">Visible hours</span>
            <div class="row">
              <select id="e-start">${Array.from({ length: 24 }, (_, h) =>
                `<option value="${h}" ${h === sync.hourStart ? 'selected' : ''}>${fmtHour(h)}</option>`).join('')}</select>
              <span class="muted">to</span>
              <select id="e-end">${Array.from({ length: 24 }, (_, i) => i + 1).map(h =>
                `<option value="${h}" ${h === sync.hourEnd ? 'selected' : ''}>${fmtHour(h)}</option>`).join('')}</select>
            </div>
          </div>`}
          ${sync.mode === 'week' && !sync.dayOnly ? `
          <div class="field">
            <span class="label">Grid style</span>
            <div class="seg" id="e-style">
              <button type="button" data-v="week" class="${sync.gridStyle === 'week' ? 'on' : ''}">Week grid</button>
              <button type="button" data-v="day" class="${sync.gridStyle === 'day' ? 'on' : ''}">Day by day</button>
            </div>
          </div>` : ''}
          <div class="row">
            <button class="btn btn-primary" id="e-save">Save</button>
            <button class="btn" id="e-cancel">Cancel</button>
          </div>
          <div class="error" id="e-error"></div>
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
            <span class="label" style="margin: 0;">${sync.dayOnly ? 'Top days' : 'Top recommended times'}</span>
            <div class="row">
              ${sync.dayOnly ? '' : `
              <select id="s-dur" style="width: auto;">
                ${[1, 2, 3, 4, 5, 6, 7, 8].map(h =>
                  `<option value="${h}" ${h === duration ? 'selected' : ''}>Duration: ${h}h</option>`).join('')}
              </select>`}
              <select id="s-req" style="width: auto;">
                <option value="best" ${req === 'best' ? 'selected' : ''}>Best effort</option>
                <option value="all" ${req === 'all' ? 'selected' : ''}>Everyone free</option>
              </select>
            </div>
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

    const settings = el.querySelector('#s-settings');
    el.querySelector('#s-edit').addEventListener('click', () => {
      settings.style.display = settings.style.display === 'none' ? '' : 'none';
    });
    let editStyle = sync.gridStyle;
    el.querySelector('#e-style')?.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      editStyle = btn.dataset.v;
      el.querySelectorAll('#e-style button').forEach(b => b.classList.toggle('on', b === btn));
    });
    el.querySelector('#e-cancel').addEventListener('click', () => {
      settings.style.display = 'none';
    });
    el.querySelector('#e-save').addEventListener('click', async () => {
      const name = el.querySelector('#e-name').value.trim();
      const err = el.querySelector('#e-error');
      if (!name) { err.textContent = 'Give the sync a name.'; return; }
      const fields = { name };
      if (!sync.dayOnly) {
        fields.hourStart = Number(el.querySelector('#e-start').value);
        fields.hourEnd = Number(el.querySelector('#e-end').value);
        fields.gridStyle = editStyle;
        if (fields.hourEnd <= fields.hourStart) {
          err.textContent = 'End hour must be after start hour.'; return;
        }
      }
      err.textContent = '';
      try {
        // update triggers onValue → settings sig change → full re-render
        await updateSync(syncId, fields);
      } catch (e2) {
        err.textContent = `Could not save: ${e2.message}`;
      }
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

    el.querySelector('#s-dur')?.addEventListener('change', e => {
      duration = Number(e.target.value);
      renderRecs();
    });
    el.querySelector('#s-req').addEventListener('change', e => {
      req = e.target.value;
      renderRecs();
    });

    renderMine();
    refreshLive();
  }

  function dayCount() {
    return sync.mode === 'month'
      ? monthsOf(sync).reduce((a, ym) => a + daysInMonth(ym), 0) : 7;
  }
  function style() { return sync.mode === 'month' ? 'day' : sync.gridStyle; }
  function labels() { return dayLabels(sync.mode, monthsOf(sync)); }

  function dayTabs(container, active, onPick) {
    if (style() !== 'day') { container.innerHTML = ''; return; }
    if (sync.mode === 'month') {
      renderMonthCals(container, monthsOf(sync), (d, day) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = String(day);
        if (d === active) btn.classList.add('on');
        btn.addEventListener('click', () => onPick(d));
        return btn;
      });
      return;
    }
    container.innerHTML = `<div class="seg day-tabs">
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
    if (sync.dayOnly) {
      el.querySelector('#s-mine-tabs').innerHTML = '';
      renderDayPicker(el.querySelector('#s-mine'), {
        months: monthsOf(sync),
        grid: myGrid,
        onToggle: () => { queueSave(); refreshLive(); },
      });
      return;
    }
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

    if (sync.dayOnly) {
      el.querySelector('#s-group-tabs').innerHTML = '';
      renderDayPicker(el.querySelector('#s-group'), {
        months: monthsOf(sync),
        heat: { density, total },
      });
    } else {
      dayTabs(el.querySelector('#s-group-tabs'), groupDay, d => { groupDay = d; refreshLive(); });
      renderGrid(el.querySelector('#s-group'), {
        dayLabels: labels(),
        hourStart: sync.hourStart,
        hourEnd: sync.hourEnd,
        gridStyle: style(),
        activeDay: groupDay,
        heat: { density, total },
      });
    }

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
    let wins = topWindows(density, sync.dayOnly ? 1 : duration);
    if (req === 'all') wins = wins.filter(w => w.count === total);
    const target = el.querySelector('#s-recs');
    if (!wins.length) {
      target.innerHTML = req === 'all'
        ? `<p class="muted">No ${sync.dayOnly ? 'day' : 'time'} works for everyone yet. Try best effort.</p>`
        : `<p class="muted">No overlapping ${sync.dayOnly ? 'days' : 'times'} yet${!sync.dayOnly && duration > 1 ? ` for a ${duration}h window` : ''}. Mark some availability.</p>`;
      return;
    }
    const dl = labels();
    target.innerHTML = wins.map((w, i) => `
      <div class="rec-item">
        <span class="rec-rank">#${i + 1}</span>
        <span>${dl[w.day]}${sync.dayOnly ? '' : ` ${fmtHour(w.hour)}–${fmtHour(w.hour + duration)}`}</span>
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
