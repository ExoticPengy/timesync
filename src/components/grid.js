// src/components/grid.js — one renderer, two arrangements.
// Paint mode mutates opts.grid in place and updates cells directly;
// callers must NOT re-render this grid on every toggle (kills drags).

export function fmtHour(h) {
  const ap = h < 12 || h === 24 ? 'AM' : 'PM';
  return `${h % 12 || 12} ${ap}`;
}

export function renderGrid(container, opts) {
  const { dayLabels, hourStart, hourEnd, gridStyle } = opts;
  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = `grid ${gridStyle === 'day' ? 'grid-day' : 'grid-week'}`;

  if (gridStyle === 'week') {
    wrap.style.gridTemplateColumns = '48px repeat(7, 1fr)';
    wrap.appendChild(div('corner'));
    dayLabels.forEach(l => wrap.appendChild(div('day-label', l)));
    for (let h = hourStart; h < hourEnd; h++) {
      wrap.appendChild(div('hour-label', fmtHour(h)));
      for (let d = 0; d < 7; d++) wrap.appendChild(makeCell(d, h, opts));
    }
  } else {
    wrap.style.gridTemplateColumns = '48px 1fr';
    const d = opts.activeDay ?? 0;
    for (let h = hourStart; h < hourEnd; h++) {
      wrap.appendChild(div('hour-label', fmtHour(h)));
      wrap.appendChild(makeCell(d, h, opts));
    }
  }

  container.appendChild(wrap);
  if (!opts.heat) attachPainting(wrap, opts);
}

// Builds one mini calendar per month; makeBtn(globalDayIndex, dayOfMonth)
// returns the button for that date. Shared by day tabs and the day picker.
export function renderMonthCals(container, months, makeBtn) {
  container.innerHTML = '';
  let d = 0;
  for (const ym of months) {
    const [y, m] = String(ym).split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    if (months.length > 1) {
      container.appendChild(div('cal-title',
        first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })));
    }
    const cal = div('cal');
    ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach(w => cal.appendChild(div('cal-wd', w)));
    const offset = (first.getDay() + 6) % 7;
    for (let i = 0; i < offset; i++) cal.appendChild(div(''));
    const total = new Date(y, m, 0).getDate();
    for (let day = 1; day <= total; day++) cal.appendChild(makeBtn(d++, day));
    container.appendChild(cal);
  }
}

// Day-only picker (month mode only): mini calendar, one button per date.
// The whole-day mark lives in grid[d][0] so the existing
// encode/decode/heat pipeline works unchanged.
export function renderDayPicker(container, opts) {
  const { months, grid, heat, onToggle } = opts;
  renderMonthCals(container, months, (d, day) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'day-pick';
    btn.textContent = String(day);
    if (heat) {
      const v = heat.density[d][0];
      if (v > 0) {
        btn.style.background = `rgba(37, 99, 235, ${(0.15 + 0.85 * v / heat.total).toFixed(3)})`;
        btn.classList.add('lit');
      }
      btn.appendChild(div('day-pick-count', `${v}/${heat.total}`));
    } else {
      if (grid[d][0]) btn.classList.add('on');
      btn.addEventListener('click', () => {
        grid[d][0] = !grid[d][0];
        btn.classList.toggle('on', grid[d][0]);
        onToggle();
      });
    }
    return btn;
  });
}

function div(cls, text) {
  const el = document.createElement('div');
  el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}

function makeCell(d, h, opts) {
  const cell = div('cell');
  cell.dataset.d = d;
  cell.dataset.h = h;
  if (opts.heat) {
    cell.classList.add('heat');
    const v = opts.heat.density[d][h];
    if (v > 0) {
      cell.style.background = `rgba(37, 99, 235, ${(0.15 + 0.85 * v / opts.heat.total).toFixed(3)})`;
    }
    cell.addEventListener('click', () => showBubble(cell, `${v}/${opts.heat.total}`));
  } else if (opts.grid[d][h]) {
    cell.classList.add('on');
  }
  return cell;
}

function attachPainting(wrap, opts) {
  let painting = false;
  let mode = true;

  const paint = el => {
    if (!el || !el.classList.contains('cell')) return;
    const d = Number(el.dataset.d);
    const h = Number(el.dataset.h);
    if (opts.grid[d][h] !== mode) {
      opts.grid[d][h] = mode;
      el.classList.toggle('on', mode);
      opts.onToggle();
    }
  };

  wrap.addEventListener('pointerdown', e => {
    const el = e.target.closest('.cell');
    if (!el) return;
    // Release implicit capture so pointermove targets real elements under
    // the finger — needed for elementFromPoint painting on touch.
    el.releasePointerCapture?.(e.pointerId);
    painting = true;
    mode = !opts.grid[Number(el.dataset.d)][Number(el.dataset.h)];
    paint(el);
  });

  wrap.addEventListener('pointermove', e => {
    if (!painting) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const cell = el && el.closest('.cell');
    // Only paint cells belonging to THIS grid — a drag can cross into the
    // sibling heatmap grid, whose cells must not leak coords into ours.
    paint(cell && wrap.contains(cell) ? cell : null);
  });

  // Listeners live on wrap — destroyed with it on re-render, no leaks.
  const end = () => { painting = false; };
  wrap.addEventListener('pointerup', end);
  wrap.addEventListener('pointercancel', end);
  wrap.addEventListener('pointerleave', end);
}

function showBubble(cell, text) {
  cell.querySelector('.bubble')?.remove();
  const b = div('bubble', text);
  cell.appendChild(b);
  setTimeout(() => b.remove(), 1200);
}
