// src/components/grid.js — one renderer, two arrangements.
// Paint mode mutates opts.grid in place and updates cells directly;
// callers must NOT re-render this grid on every toggle (kills drags).

export function renderGrid(container, opts) {
  const { dayLabels, hourStart, hourEnd, gridStyle } = opts;
  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = `grid ${gridStyle === 'day' ? 'grid-day' : 'grid-week'}`;

  if (gridStyle === 'week') {
    wrap.style.gridTemplateColumns = '36px repeat(7, 1fr)';
    wrap.appendChild(div('corner'));
    dayLabels.forEach(l => wrap.appendChild(div('day-label', l)));
    for (let h = hourStart; h < hourEnd; h++) {
      wrap.appendChild(div('hour-label', String(h)));
      for (let d = 0; d < 7; d++) wrap.appendChild(makeCell(d, h, opts));
    }
  } else {
    wrap.style.gridTemplateColumns = '48px 1fr';
    const d = opts.activeDay ?? 0;
    for (let h = hourStart; h < hourEnd; h++) {
      wrap.appendChild(div('hour-label', `${h}:00`));
      wrap.appendChild(makeCell(d, h, opts));
    }
  }

  container.appendChild(wrap);
  if (!opts.heat) attachPainting(wrap, opts);
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
