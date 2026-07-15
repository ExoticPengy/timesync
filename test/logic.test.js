import assert from 'node:assert/strict';
import {
  emptyGrid, encodeGrid, decodeGrid, sanitizeName,
  heatDensity, topWindows, dayLabels, daysInMonth, monthsOf,
} from '../src/logic.js';

// encode/decode round-trip
const g = emptyGrid();
g[0][8] = true;
g[6][23] = true;
const enc = encodeGrid(g);
assert.equal(enc.length, 7 * 24 + 6);
assert.equal(enc.split('|').length, 7);
assert.deepEqual(decodeGrid(enc), g);

// decode tolerates garbage and absence
assert.deepEqual(decodeGrid(undefined), emptyGrid());
assert.deepEqual(decodeGrid('not|a|grid'), emptyGrid());

// sanitizeName strips RTDB-forbidden chars, trims, caps at 30
assert.equal(sanitizeName('  Al.i#c$e/[]  '), 'Alice');
assert.equal(sanitizeName('x'.repeat(50)).length, 30);
assert.equal(sanitizeName('.#$/[]'), '');

// heatDensity counts overlaps
const a = emptyGrid(); a[1][10] = true; a[1][11] = true;
const b = emptyGrid(); b[1][10] = true;
const density = heatDensity([a, b]);
assert.equal(density[1][10], 2);
assert.equal(density[1][11], 1);
assert.equal(density[0][0], 0);

// topWindows: min-over-window, sorted by count desc then day/hour
// day 1 has 2 people for 2 consecutive hours; a 2h window there wins
const d2 = heatDensity([a, b]);
d2[2][10] = 3; // fake a taller single hour elsewhere
const wins = topWindows(d2, 2);
assert.deepEqual(wins[0], { day: 1, hour: 10, count: 1 }); // min(2,1)=1 over 10-12
// duration window never crosses midnight
const late = emptyGrid(); late[0][23] = true;
assert.deepEqual(topWindows(heatDensity([late]), 2), []);

// dayLabels: week mode fixed
assert.deepEqual(dayLabels('week', null),
  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);

// dayLabels: month mode, one label per day across the given months
const monthLabels = dayLabels('month', ['2026-07']);
assert.equal(monthLabels.length, 31);
assert.match(monthLabels[0], /Wed/);   // 2026-07-01 is a Wednesday
assert.match(monthLabels[0], /1/);
assert.match(monthLabels[30], /31/);

// dayLabels: several months concatenate, labels gain the month name
const multiLabels = dayLabels('month', ['2026-08', '2026-12']);
assert.equal(multiLabels.length, 31 + 31);
assert.equal(multiLabels[0], 'Sat Aug 1');
assert.equal(multiLabels[31], 'Tue Dec 1');

// monthsOf: normalizes legacy single-month syncs
assert.deepEqual(monthsOf({ month: '2026-07' }), ['2026-07']);
assert.deepEqual(monthsOf({ months: ['2026-07', '2026-09'] }), ['2026-07', '2026-09']);
assert.deepEqual(monthsOf({}), []);

// emptyGrid(days) — arbitrary day count, 24 wide
const g31 = emptyGrid(31);
assert.equal(g31.length, 31);
g31.forEach(day => assert.equal(day.length, 24));

// daysInMonth: "YYYY-MM" -> day count, respects leap years
assert.equal(daysInMonth('2026-02'), 28);
assert.equal(daysInMonth('2028-02'), 29); // leap year
assert.equal(daysInMonth('2026-07'), 31);

// decodeGrid(str, days): round-trip at 31 days; count mismatch rejected
const g31b = emptyGrid(31);
g31b[0][0] = true;
g31b[30][23] = true;
const enc31 = encodeGrid(g31b);
assert.deepEqual(decodeGrid(enc31, 31), g31b);
assert.deepEqual(decodeGrid(enc31, 7), emptyGrid(7)); // segment count mismatch -> empty of requested size

// heatDensity derives day count from the grids themselves
const ma = emptyGrid(31); ma[0][5] = true;
const mb = emptyGrid(31); mb[0][5] = true; mb[30][10] = true;
const monthDensity = heatDensity([ma, mb]);
assert.equal(monthDensity.length, 31);
assert.equal(monthDensity[0][5], 2);
assert.equal(monthDensity[30][10], 1);

console.log('logic.test.js: all assertions passed');
