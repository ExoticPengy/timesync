// src/views/home.js — sync creation form.
import { createSync } from '../db.js';

const HOURS = Array.from({ length: 25 }, (_, i) => i); // 0..24 for range ends

export function renderHome(el) {
  let mode = 'week';
  let gridStyle = 'week';

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
        <div class="seg" id="f-mode">
          <button type="button" data-v="week" class="on">Weekly</button>
          <button type="button" data-v="month">Specific month</button>
        </div>
      </div>
      <div class="field" id="f-date-wrap" style="display: none;">
        <label class="label" for="f-month">Month</label>
        <input type="month" id="f-month">
      </div>
      <div class="field">
        <span class="label">Visible hours</span>
        <div class="row">
          <select id="f-start">${HOURS.slice(0, 24).map(h =>
            `<option value="${h}" ${h === 8 ? 'selected' : ''}>${h}:00</option>`).join('')}</select>
          <span class="muted">to</span>
          <select id="f-end">${HOURS.slice(1).map(h =>
            `<option value="${h}" ${h === 22 ? 'selected' : ''}>${h}:00</option>`).join('')}</select>
        </div>
      </div>
      <div class="field" id="f-style-wrap">
        <span class="label">Grid style</span>
        <div class="seg" id="f-style">
          <button type="button" data-v="week" class="on">Week grid</button>
          <button type="button" data-v="day">Day by day</button>
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

  segWire($('#f-mode'), v => {
    mode = v;
    $('#f-date-wrap').style.display = v === 'month' ? '' : 'none';
    $('#f-style-wrap').style.display = v === 'month' ? 'none' : '';
  });
  segWire($('#f-style'), v => { gridStyle = v; });

  $('#f-create').addEventListener('click', async () => {
    const name = $('#f-name').value.trim();
    const monthValue = $('#f-month').value || null;
    const hourStart = Number($('#f-start').value);
    const hourEnd = Number($('#f-end').value);
    const err = $('#f-error');

    if (!name) { err.textContent = 'Give the sync a name.'; return; }
    if (mode === 'month' && !monthValue) { err.textContent = 'Pick a month.'; return; }
    if (hourEnd <= hourStart) { err.textContent = 'End hour must be after start hour.'; return; }
    err.textContent = '';

    const btn = $('#f-create');
    btn.disabled = true;
    btn.textContent = 'Creating…';
    try {
      const id = await createSync({
        name, mode,
        month: mode === 'month' ? monthValue : null,
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
