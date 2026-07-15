// src/logic.js — pure helpers, no imports, no DOM.

export function emptyGrid(days = 7) {
  return Array.from({ length: days }, () => Array(24).fill(false));
}

export function encodeGrid(grid) {
  return grid.map(day => day.map(v => (v ? '1' : '0')).join('')).join('|');
}

export function decodeGrid(str, days = 7) {
  if (typeof str !== 'string') return emptyGrid(days);
  const segs = str.split('|');
  if (segs.length !== days || segs.some(d => !/^[01]{24}$/.test(d))) return emptyGrid(days);
  return segs.map(d => [...d].map(c => c === '1'));
}

export function sanitizeName(raw) {
  return raw.replace(/[.#$/[\]]/g, '').trim().slice(0, 30);
}

export function heatDensity(grids) {
  const days = grids[0]?.length ?? 7;
  const density = Array.from({ length: days }, () => Array(24).fill(0));
  for (const g of grids) {
    g.forEach((day, d) => day.forEach((v, h) => { if (v) density[d][h]++; }));
  }
  return density;
}

// Best meeting windows: rank by the MINIMUM availability across the
// window (a slot only counts if people are free the whole time).
export function topWindows(density, duration, top = 3) {
  const slots = [];
  density.forEach((day, d) => {
    for (let h = 0; h + duration <= 24; h++) {
      let min = Infinity;
      for (let i = 0; i < duration; i++) min = Math.min(min, day[h + i]);
      if (min > 0) slots.push({ day: d, hour: h, count: min });
    }
  });
  slots.sort((x, y) => y.count - x.count || x.day - y.day || x.hour - y.hour);
  return slots.slice(0, top);
}

// Number of days in "YYYY-MM" (28..31). Day 0 of the following month is the
// last day of this month — a standard local-date trick, no UTC involved.
export function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function dayLabels(mode, months) {
  if (mode === 'week') return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  // mode === 'month': months is ["YYYY-MM", ...]. Parse as LOCAL midnight —
  // never `new Date(string)`, which parses UTC and shifts a day back in
  // negative-offset timezones. Month shown only when spanning several months.
  const multi = months.length > 1;
  const out = [];
  for (const ym of months) {
    const [y, m] = ym.split('-').map(Number);
    const total = daysInMonth(ym);
    for (let d = 1; d <= total; d++) {
      const curr = new Date(y, m - 1, d);
      const wd = curr.toLocaleDateString('en-US', { weekday: 'short' });
      out.push(multi
        ? `${wd} ${curr.toLocaleDateString('en-US', { month: 'short' })} ${d}`
        : `${wd} ${d}`);
    }
  }
  return out;
}

// Sorted list of months a sync spans; normalizes legacy single-month syncs.
export function monthsOf(sync) {
  return sync.months || (sync.month ? [sync.month] : []);
}
