// src/views/home.js — sync creation form.
import { createSync } from '../db.js';
import { fmtHour } from '../components/grid.js';

const HOURS = Array.from({ length: 25 }, (_, i) => i); // 0..24 for range ends

export function renderHome(el) {
  let mode = 'week';
  let gridStyle = 'week';
  let dayOnly = false;

  el.innerHTML = `
    <div class="app-header">
      <h1>TimeSync</h1>
      <span class="muted">Find a time that works for everyone.</span>
    </div>
    <div class="card" style="max-width: 480px; margin: 0 auto;">
      <div class="field">
        <label class="label" for="f-name">Sync name</label>
        <input type="text" id="f-name" maxlength="100" placeholder="Team weekly standup">
      </div>
      <div class="field">
        <span class="label">Schedule type</span>
        <div class="seg seg-preview" id="f-mode">
          <button type="button" data-v="week" class="on" title="Pick times for a generic week (Mon–Sun) that repeats">
            <svg viewBox="0 0 28 20" aria-hidden="true">
              <rect x="0" y="0" width="28" height="4" rx="1"/>
              ${[0, 1, 2, 3, 4, 5, 6].map(i => `<rect x="${i * 4}" y="6" width="3" height="14" rx="1" opacity="0.5"/>`).join('')}
            </svg>
            Weekly
            <small>Repeats every week</small>
          </button>
          <button type="button" data-v="month" title="Pick times on real dates within one chosen month">
            <svg viewBox="0 0 28 20" aria-hidden="true">
              <rect x="0" y="0" width="28" height="4" rx="1"/>
              ${[0, 1, 2].map(r => [0, 1, 2, 3, 4, 5, 6].map(c =>
                `<rect x="${c * 4}" y="${6 + r * 5}" width="3" height="4" rx="1" opacity="0.5"/>`).join('')).join('')}
            </svg>
            Specific month
            <small>Real dates</small>
          </button>
        </div>
      </div>
      <div class="field" id="f-date-wrap" style="display: none;">
        <span class="label">Months</span>
        <div class="month-pick" id="f-months">
          ${Array.from({ length: 12 }, (_, i) => {
            const d = new Date();
            d.setDate(1);
            d.setMonth(d.getMonth() + i);
            const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const l = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            return `<button type="button" data-v="${v}">${l}</button>`;
          }).join('')}
        </div>
      </div>
      <div class="field" id="f-prec-wrap" style="display: none;">
        <span class="label">Selection</span>
        <div class="seg seg-preview" id="f-prec">
          <button type="button" data-v="hours" class="on" title="Pick specific hours on each day">
            <svg viewBox="0 0 28 20" aria-hidden="true">
              ${[0, 1, 2, 3].map(r => [0, 1, 2, 3, 4, 5, 6].map(c =>
                `<rect x="${c * 4}" y="${r * 5}" width="3" height="4" rx="1" opacity="${(r + c) % 3 ? 0.5 : 1}"/>`).join('')).join('')}
            </svg>
            Times
            <small>Hour by hour</small>
          </button>
          <button type="button" data-v="days" title="Just pick which days work — no times">
            <svg viewBox="0 0 28 20" aria-hidden="true">
              ${[0, 1, 2, 3, 4, 5, 6].map(c =>
                `<rect x="${c * 4}" y="6" width="3" height="8" rx="1" opacity="${c % 3 ? 0.5 : 1}"/>`).join('')}
            </svg>
            Days only
            <small>Whole days</small>
          </button>
        </div>
      </div>
      <div class="field" id="f-hours-wrap">
        <span class="label">Visible hours</span>
        <div class="row">
          <select id="f-start">${HOURS.slice(0, 24).map(h =>
            `<option value="${h}" ${h === 8 ? 'selected' : ''}>${fmtHour(h)}</option>`).join('')}</select>
          <span class="muted">to</span>
          <select id="f-end">${HOURS.slice(1).map(h =>
            `<option value="${h}" ${h === 22 ? 'selected' : ''}>${fmtHour(h)}</option>`).join('')}</select>
        </div>
      </div>
      <div class="field" id="f-style-wrap">
        <span class="label">Grid style</span>
        <div class="seg seg-preview" id="f-style">
          <button type="button" data-v="week" class="on" title="Paint availability for all 7 days on one big grid">
            <svg viewBox="0 0 28 20" aria-hidden="true">
              ${[0, 1, 2, 3].map(r => [0, 1, 2, 3, 4, 5, 6].map(c =>
                `<rect x="${c * 4}" y="${r * 5}" width="3" height="4" rx="1" opacity="${(r + c) % 3 ? 0.5 : 1}"/>`).join('')).join('')}
            </svg>
            Week grid
            <small>All days at once</small>
          </button>
          <button type="button" data-v="day" title="Flip through days one at a time with tabs">
            <svg viewBox="0 0 28 20" aria-hidden="true">
              ${[0, 1, 2, 3].map(r =>
                `<rect x="6" y="${r * 5}" width="16" height="4" rx="1" opacity="${r % 2 ? 0.5 : 1}"/>`).join('')}
              ${[0, 1, 2, 3].map(r => `<rect x="0" y="${r * 5}" width="4" height="4" rx="1" opacity="0.3"/>`).join('')}
            </svg>
            Day by day
            <small>One day at a time</small>
          </button>
        </div>
      </div>
      <button class="btn btn-primary" id="f-create" style="width: 100%;">Create sync</button>
      <div class="error" id="f-error"></div>
      <p class="muted" style="text-align: center;">You'll get a link to share.</p>
    </div>`;

  const $ = s => el.querySelector(s);

  function segWire(segEl, onPick) {
    segEl.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      segEl.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn));
      onPick(btn.dataset.v);
    });
  }

  function updateVis() {
    const dayPoll = mode === 'month' && dayOnly;
    $('#f-date-wrap').style.display = mode === 'month' ? '' : 'none';
    $('#f-prec-wrap').style.display = mode === 'month' ? '' : 'none';
    $('#f-hours-wrap').style.display = dayPoll ? 'none' : '';
    $('#f-style-wrap').style.display = mode === 'month' ? 'none' : '';
  }
  segWire($('#f-mode'), v => { mode = v; updateVis(); });
  $('#f-months').addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (btn) btn.classList.toggle('on');
  });
  segWire($('#f-prec'), v => { dayOnly = v === 'days'; updateVis(); });
  segWire($('#f-style'), v => { gridStyle = v; });

  $('#f-create').addEventListener('click', async () => {
    const name = $('#f-name').value.trim();
    const months = [...el.querySelectorAll('#f-months .on')].map(b => b.dataset.v).sort();
    const hourStart = Number($('#f-start').value);
    const hourEnd = Number($('#f-end').value);
    const err = $('#f-error');

    if (!name) { err.textContent = 'Give the sync a name.'; return; }
    if (mode === 'month' && !months.length) { err.textContent = 'Pick at least one month.'; return; }
    if (!(mode === 'month' && dayOnly) && hourEnd <= hourStart) { err.textContent = 'End hour must be after start hour.'; return; }
    err.textContent = '';

    const btn = $('#f-create');
    btn.disabled = true;
    btn.textContent = 'Creating…';
    try {
      const id = await createSync({
        name, mode, dayOnly: mode === 'month' && dayOnly,
        months: mode === 'month' ? months : null,
        hourStart, hourEnd,
        gridStyle: mode === 'month' ? 'day' : gridStyle,
      });
      location.hash = `#/s/${id}`;
    } catch (e) {
      err.textContent = `Could not create sync: ${e.message}`;
      btn.disabled = false;
      btn.textContent = 'Create sync';
    }
  });
}
