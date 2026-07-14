# TimeSync Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild TimeSync into a mobile-first, shareable scheduler: create a sync, share a link, participants mark availability under a name, live heatmap + top-3 recommendations.

**Architecture:** Vanilla JS + Vite single-page app with a hand-rolled hash router (`#/` home, `#/s/<id>` sync view). Firebase Realtime Database stores syncs; one `onValue` subscription per open sync gives live updates. Pure logic (grid encoding, recommendations, sanitizing) lives in a dependency-free module tested with node asserts.

**Tech Stack:** Vanilla JS (ES modules), Vite 6, Firebase JS SDK (`firebase/app`, `firebase/database`), plain CSS. No framework, no test framework.

**Spec:** `docs/superpowers/specs/2026-07-14-timesync-redesign-design.md`

## Global Constraints

- Only new dependency allowed: `firebase`
- Visual system: light only; page `#fafafa`, cards `#ffffff`, text `#18181b`, muted `#71717a`, hairlines `#e4e4e7`, single accent `#2563eb`; system font stack; 6px radii; no gradients, no blur, no glow, no decorative animation, no emoji in UI copy, no Google Fonts
- Type scale 12/14/16/20px, weights 400/600 only
- Grid data always stored full 7×24 as 7 `'0'`/`'1'` strings of 24 chars joined by `|` (174 chars total)
- Names: strip `. # $ / [ ]`, trim, max 30 chars
- Times are wall-clock; never construct `new Date(string)` from `YYYY-MM-DD` (UTC pitfall) — parse via `split('-')`
- No timezone conversion, no auth, no edit protection (spec non-goals)
- Firebase web config via `VITE_FIREBASE_*` env vars; `.env` gitignored; config is public by design — do not attempt to hide it
- Commit after every task

## File Structure (target)

```
index.html               # shell (modified)
main.js                  # hash router + app boot (rewritten)
style.css                # new visual system (rewritten)
src/
  logic.js               # pure: grids, names, density, recommendations, labels
  db.js                  # Firebase: createSync / subscribeSync / saveGrid
  views/
    home.js              # creation form
    sync.js              # join gate + grids + heatmap + recommendations
  components/
    grid.js              # one renderer, two arrangements, pointer painting
test/
  logic.test.js          # node assert tests for src/logic.js
.env.example
```

Deleted at the end: `src/state.js`, `src/components/Grid.js` (old).

---

### Task 1: Pure logic module

**Files:**
- Create: `src/logic.js`
- Test: `test/logic.test.js`

**Interfaces:**
- Consumes: nothing (dependency-free)
- Produces (used by Tasks 4–6):
  - `emptyGrid() -> boolean[7][24]`
  - `encodeGrid(grid: boolean[7][24]) -> string` (7×24 chars + 6 pipes)
  - `decodeGrid(str: string|null|undefined) -> boolean[7][24]` (invalid/missing → empty grid)
  - `sanitizeName(raw: string) -> string`
  - `heatDensity(grids: boolean[7][24][]) -> number[7][24]`
  - `topWindows(density: number[7][24], duration: number, top?: number) -> {day:number, hour:number, count:number}[]`
  - `dayLabels(mode: 'week'|'date', startDate: string|null) -> string[7]`

- [ ] **Step 1: Write the failing tests**

```js
// test/logic.test.js
import assert from 'node:assert/strict';
import {
  emptyGrid, encodeGrid, decodeGrid, sanitizeName,
  heatDensity, topWindows, dayLabels,
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

// dayLabels: week mode fixed; date mode starts at startDate, local parse
assert.deepEqual(dayLabels('week', null),
  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
const dl = dayLabels('date', '2026-07-14');
assert.equal(dl.length, 7);
assert.match(dl[0], /Tue/);      // 2026-07-14 is a Tuesday, in EVERY timezone
assert.match(dl[0], /7\/14/);

console.log('logic.test.js: all assertions passed');
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test/logic.test.js`
Expected: FAIL — `Cannot find module '../src/logic.js'`

- [ ] **Step 3: Implement `src/logic.js`**

```js
// src/logic.js — pure helpers, no imports, no DOM.

export function emptyGrid() {
  return Array.from({ length: 7 }, () => Array(24).fill(false));
}

export function encodeGrid(grid) {
  return grid.map(day => day.map(v => (v ? '1' : '0')).join('')).join('|');
}

export function decodeGrid(str) {
  if (typeof str !== 'string') return emptyGrid();
  const days = str.split('|');
  if (days.length !== 7 || days.some(d => !/^[01]{24}$/.test(d))) return emptyGrid();
  return days.map(d => [...d].map(c => c === '1'));
}

export function sanitizeName(raw) {
  return raw.replace(/[.#$/[\]]/g, '').trim().slice(0, 30);
}

export function heatDensity(grids) {
  const density = Array.from({ length: 7 }, () => Array(24).fill(0));
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

export function dayLabels(mode, startDate) {
  if (mode === 'week') return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  // Parse as LOCAL midnight — new Date('YYYY-MM-DD') would parse UTC and
  // shift a day back in negative-offset timezones.
  const [y, m, d] = startDate.split('-').map(Number);
  const curr = new Date(y, m - 1, d);
  const out = [];
  for (let i = 0; i < 7; i++) {
    out.push(curr.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }));
    curr.setDate(curr.getDate() + 1);
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node test/logic.test.js`
Expected: `logic.test.js: all assertions passed`

- [ ] **Step 5: Commit**

```bash
git add src/logic.js test/logic.test.js
git commit -m "feat: pure logic module — grid codec, names, density, recommendations"
```

---

### Task 2: Visual system (style.css + index.html)

**Files:**
- Rewrite: `style.css`
- Modify: `index.html`

**Interfaces:**
- Consumes: nothing
- Produces: CSS classes used by Tasks 4–6: `.card`, `.btn`, `.btn-primary`, `.seg`, `.seg button`, `.field`, `.label`, `.error`, `.grid`, `.grid-week`, `.grid-day`, `.cell`, `.cell.on`, `.cell.heat`, `.hour-label`, `.day-label`, `.corner`, `.bubble`, `.chips`, `.chip`, `.panels`, `.panel`, `.tab-toggle`, `.rec-item`, `.rec-rank`, `.rec-count`, `.muted`, `.app-header`

No test — visual verification happens in Task 8.

- [ ] **Step 1: Rewrite `style.css`**

```css
/* TimeSync — utility-tool visual system. Light, flat, one accent. */

:root {
  --bg: #fafafa;
  --card: #ffffff;
  --text: #18181b;
  --muted: #71717a;
  --line: #e4e4e7;
  --line-soft: #f4f4f5;
  --accent: #2563eb;
  color-scheme: light;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 400 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}

#app { max-width: 1100px; margin: 0 auto; padding: 16px; }

.app-header { display: flex; align-items: baseline; gap: 12px; padding: 8px 0 16px; }
.app-header h1 { font-size: 20px; font-weight: 600; margin: 0; letter-spacing: -0.01em; }
.app-header a { color: inherit; text-decoration: none; }
.muted { color: var(--muted); font-size: 12px; }

.card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 16px;
}

/* Forms */
.field { margin-bottom: 14px; }
.label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 4px;
}
input[type="text"], input[type="date"], select {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--card);
  color: var(--text);
  font: inherit;
}
input:focus, select:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
.error { color: #dc2626; font-size: 12px; margin-top: 4px; }

/* Buttons */
.btn {
  padding: 8px 14px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--card);
  color: var(--text);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.btn:hover { border-color: var(--muted); }
.btn-primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.btn-primary:hover { background: #1d4ed8; }
.btn:disabled { opacity: 0.5; cursor: default; }

/* Segmented control */
.seg { display: inline-flex; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
.seg button {
  padding: 7px 12px;
  border: 0;
  background: var(--card);
  color: var(--muted);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.seg button.on { background: var(--text); color: #fff; }

/* Chips (joined people) */
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip {
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 12px;
  color: var(--muted);
  background: var(--card);
  cursor: pointer;
}
.chip:hover { border-color: var(--accent); color: var(--accent); }

/* Grids */
.grid { display: grid; gap: 2px; user-select: none; touch-action: none; }
.hour-label, .day-label {
  font-size: 12px;
  color: var(--muted);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 6px;
}
.day-label { justify-content: center; font-weight: 600; padding: 0 0 4px; }
.corner {}
.cell {
  background: var(--line-soft);
  border-radius: 3px;
  min-height: 28px;
  cursor: pointer;
  position: relative;
}
.grid-day .cell { min-height: 44px; }
.cell.on { background: var(--accent); }
.cell.heat { cursor: default; }
.bubble {
  position: absolute;
  top: -26px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--text);
  color: #fff;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 10;
}

/* Sync view panels */
.panels { display: grid; gap: 16px; }
.tab-toggle { margin-bottom: 12px; }
@media (min-width: 1024px) {
  .panels { grid-template-columns: 1fr 1fr; }
  .tab-toggle { display: none; }
  .panel { display: block !important; }
}
@media (max-width: 1023.98px) {
  .panels[data-tab="mine"] .panel-group { display: none; }
  .panels[data-tab="group"] .panel-mine { display: none; }
}

/* Recommendations */
.rec-item {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 8px 12px;
  margin-top: 8px;
}
.rec-rank { font-weight: 600; color: var(--accent); }
.rec-count { margin-left: auto; font-size: 12px; color: var(--muted); }

.stack { display: flex; flex-direction: column; gap: 16px; }
.row { display: flex; gap: 8px; align-items: center; }
.row-between { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
```

- [ ] **Step 2: Update `index.html`**

Replace the whole file with:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TimeSync</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/main.js"></script>
  </body>
</html>
```

(Drops the missing `vite.svg` icon reference and marketing tagline title.)

- [ ] **Step 3: Commit**

```bash
git add style.css index.html
git commit -m "feat: new utility-tool visual system, drop glassmorphism"
```

---

### Task 3: Firebase setup (db.js, env, docs)

**Files:**
- Create: `src/db.js`, `.env.example`
- Modify: `.gitignore` (create if missing), `README.md` (add setup section)
- Run: `npm install firebase`

**Interfaces:**
- Consumes: `import.meta.env.VITE_FIREBASE_*`
- Produces (used by Tasks 4–6):
  - `configured: boolean` — false when env vars absent
  - `createSync(config: {name, mode, startDate, hourStart, hourEnd, gridStyle}) -> Promise<string>` (sync id)
  - `subscribeSync(id: string, cb: (data: object|null) => void) -> () => void` (unsubscribe)
  - `saveGrid(id: string, name: string, gridStr: string) -> Promise<void>`

No unit test — this file is a thin SDK wrapper; exercised in Task 8 E2E. (Node can't run it: `import.meta.env` is Vite-only.)

- [ ] **Step 1: Install the dependency**

Run: `npm install firebase`
Expected: `firebase` appears in `package.json` dependencies, no errors.

- [ ] **Step 2: Write `src/db.js`**

```js
// src/db.js — all Firebase touchpoints. Three functions + a configured flag.
import { initializeApp } from 'firebase/app';
import {
  getDatabase, ref, push, set, onValue, serverTimestamp,
} from 'firebase/database';

const env = import.meta.env;
export const configured = Boolean(env.VITE_FIREBASE_DATABASE_URL);

let db = null;
if (configured) {
  const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: env.VITE_FIREBASE_DATABASE_URL,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  });
  db = getDatabase(app);
}

export async function createSync(config) {
  const r = push(ref(db, 'syncs'));
  await set(r, { ...config, createdAt: serverTimestamp() });
  return r.key;
}

export function subscribeSync(id, cb) {
  return onValue(
    ref(db, `syncs/${id}`),
    snap => cb(snap.val()),
    () => cb(null), // permission/network error → treat as not found
  );
}

export function saveGrid(id, name, gridStr) {
  return set(ref(db, `syncs/${id}/people/${name}`), gridStr);
}
```

- [ ] **Step 3: Write `.env.example` and gitignore `.env`**

`.env.example`:

```
# Firebase web config — public by design; kept out of git for hygiene only.
# Get values: Firebase console → Project settings → General → Your apps → Web app.
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
```

Append to `.gitignore` (create file if it doesn't exist):

```
.env
.superpowers/
```

- [ ] **Step 4: Add Firebase setup section to `README.md`**

Insert before the `## 📝 License` section:

```markdown
## 🔧 Firebase Setup

TimeSync stores syncs in a Firebase Realtime Database.

1. Create a project at https://console.firebase.google.com (free Spark plan)
2. Build → Realtime Database → Create database (locked mode)
3. Rules tab → paste and publish:

   ```json
   {
     "rules": {
       "syncs": {
         "$id": {
           ".read": true,
           ".write": true,
           "name": { ".validate": "newData.isString() && newData.val().length <= 100" },
           "people": {
             "$person": { ".validate": "newData.isString() && newData.val().length <= 200" }
           }
         }
       }
     }
   }
   ```

4. Project settings → General → Add a Web app → copy the config values
5. `cp .env.example .env` and fill in the values

Note: anyone with a sync link can read and edit that sync — by design
(no accounts, honor system). The web config values are public identifiers,
not secrets; security rules are the enforcement layer.
```

- [ ] **Step 5: Verify and commit**

Run: `git status` — confirm `.env` is NOT listed (if you created one). Run `node test/logic.test.js` — still passes.

```bash
git add src/db.js .env.example .gitignore README.md package.json package-lock.json
git commit -m "feat: firebase rtdb module, env config, setup docs"
```

---

### Task 4: Router shell + Home view (creation form)

**Files:**
- Rewrite: `main.js`
- Create: `src/views/home.js`

**Interfaces:**
- Consumes: `createSync`, `configured` from `src/db.js`
- Produces:
  - `main.js` route contract: `#/` → `renderHome(el)`, `#/s/<id>` → `renderSync(el, id)` (Task 6 provides `renderSync`; until then main.js stubs it)
  - View contract: each `render*` function may return a cleanup function; router calls it before the next render

- [ ] **Step 1: Rewrite `main.js`**

```js
import './style.css';
import { configured } from './src/db.js';
import { renderHome } from './src/views/home.js';
import { renderSync } from './src/views/sync.js';

const app = document.querySelector('#app');
let cleanup = null;

function route() {
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  app.innerHTML = '';

  if (!configured) {
    app.innerHTML = `
      <div class="app-header"><h1>TimeSync</h1></div>
      <div class="card">
        <p>Firebase is not configured.</p>
        <p class="muted">Copy <code>.env.example</code> to <code>.env</code>, fill in your
        Firebase web config, and restart the dev server. See README for setup.</p>
      </div>`;
    return;
  }

  const m = location.hash.match(/^#\/s\/([^/]+)/);
  cleanup = m ? renderSync(app, m[1]) : renderHome(app);
}

window.addEventListener('hashchange', route);
route();
```

- [ ] **Step 2: Create `src/views/sync.js` stub** (Task 6 replaces it)

```js
// src/views/sync.js — full implementation lands in the sync-view task.
export function renderSync(el, id) {
  el.innerHTML = `<div class="card">Sync view for <code>${id}</code> — coming in Task 6.</div>`;
}
```

- [ ] **Step 3: Create `src/views/home.js`**

```js
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
          <button type="button" data-v="date">Specific dates</button>
        </div>
      </div>
      <div class="field" id="f-date-wrap" style="display: none;">
        <label class="label" for="f-date">Starting date</label>
        <input type="date" id="f-date">
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
      <div class="field">
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
    $('#f-date-wrap').style.display = v === 'date' ? '' : 'none';
  });
  segWire($('#f-style'), v => { gridStyle = v; });

  $('#f-create').addEventListener('click', async () => {
    const name = $('#f-name').value.trim();
    const startDate = $('#f-date').value || null;
    const hourStart = Number($('#f-start').value);
    const hourEnd = Number($('#f-end').value);
    const err = $('#f-error');

    if (!name) { err.textContent = 'Give the sync a name.'; return; }
    if (mode === 'date' && !startDate) { err.textContent = 'Pick a starting date.'; return; }
    if (hourEnd <= hourStart) { err.textContent = 'End hour must be after start hour.'; return; }
    err.textContent = '';

    const btn = $('#f-create');
    btn.disabled = true;
    btn.textContent = 'Creating…';
    try {
      const id = await createSync({
        name, mode,
        startDate: mode === 'date' ? startDate : null,
        hourStart, hourEnd, gridStyle,
      });
      location.hash = `#/s/${id}`;
    } catch (e) {
      err.textContent = `Could not create sync: ${e.message}`;
      btn.disabled = false;
      btn.textContent = 'Create sync';
    }
  });
}
```

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`, open the printed URL.
Expected without `.env`: the "Firebase is not configured" card.
Expected with `.env`: creation form renders; empty name shows inline error; creating a sync redirects to `#/s/<id>` showing the Task 6 stub. On a ~375px viewport the form fits without horizontal scroll.

- [ ] **Step 5: Commit**

```bash
git add main.js src/views/home.js src/views/sync.js
git commit -m "feat: hash router shell and sync creation form"
```

---

### Task 5: Grid component (two arrangements, pointer painting)

**Files:**
- Create: `src/components/grid.js`

**Interfaces:**
- Consumes: nothing (pure DOM; caller supplies data)
- Produces (used by Task 6):
  - `renderGrid(container, opts)` where `opts`:
    - `dayLabels: string[7]`, `hourStart: number`, `hourEnd: number`
    - `gridStyle: 'week' | 'day'`, `activeDay: number` (day style only)
    - Paint mode: `grid: boolean[7][24]` (mutated in place), `onToggle(): void`
    - Heat mode: `heat: { density: number[7][24], total: number }` (grid/onToggle ignored)

Painting mutates `opts.grid` and flips cell classes directly — **no re-render during a drag** (re-rendering mid-drag was the original app's drag-killing bug). `onToggle` fires per changed cell so the caller can debounce saves and refresh sibling panels.

- [ ] **Step 1: Write `src/components/grid.js`**

```js
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
    paint(el && el.closest('.cell'));
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
```

- [ ] **Step 2: Verify syntax**

Run: `node --check src/components/grid.js`
Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add src/components/grid.js
git commit -m "feat: grid component — week/day arrangements, pointer painting, heat mode"
```

(Behavior is exercised through the sync view in Task 6 and E2E in Task 8.)

---

### Task 6: Sync view (join gate, panels, recommendations)

**Files:**
- Rewrite: `src/views/sync.js` (replaces Task 4 stub)

**Interfaces:**
- Consumes:
  - `subscribeSync(id, cb)`, `saveGrid(id, name, gridStr)` from `src/db.js`
  - `decodeGrid`, `encodeGrid`, `emptyGrid`, `sanitizeName`, `heatDensity`, `topWindows`, `dayLabels` from `src/logic.js`
  - `renderGrid(container, opts)` from `src/components/grid.js`
- Produces: `renderSync(el, id) -> cleanup fn` (matches Task 4 router contract)

Update strategy (drag-safety, from spec): "Mine" grid renders once per join/tab/day switch and is never re-rendered by `onValue`. `onValue` refreshes only the group panel, recommendations, and joined-count. Saves are debounced 400ms.

- [ ] **Step 1: Rewrite `src/views/sync.js`**

```js
// src/views/sync.js — join gate, then Mine/Group panels + recommendations.
import { subscribeSync, saveGrid } from '../db.js';
import {
  decodeGrid, encodeGrid, emptyGrid, sanitizeName,
  heatDensity, topWindows, dayLabels,
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
    const people = Object.keys(sync.people || {});
    const summary = [
      sync.mode === 'week' ? 'Weekly' : `From ${sync.startDate}`,
      `${sync.hourStart}:00–${sync.hourEnd}:00`,
      `${people.length} joined`,
    ].join(' · ');

    el.innerHTML = `
      <div class="app-header"><h1><a href="#/">TimeSync</a></h1></div>
      <div class="card" style="max-width: 480px; margin: 0 auto;">
        <h2 style="font-size: 16px; margin: 0 0 2px;">${esc(sync.name)}</h2>
        <p class="muted" style="margin-top: 0;">${summary}</p>
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
    const join = raw => {
      const name = sanitizeName(raw);
      if (!name) return;
      myName = name;
      myGrid = decodeGrid(sync.people?.[name]);
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
      myGrid = emptyGrid();
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

  function labels() { return dayLabels(sync.mode, sync.startDate); }

  function dayTabs(container, active, onPick) {
    if (sync.gridStyle !== 'day') { container.innerHTML = ''; return; }
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
      gridStyle: sync.gridStyle,
      activeDay: myDay,
      grid: myGrid,
      onToggle: () => { queueSave(); refreshLive(); },
    });
  }

  // Group panel + recommendations + count: refreshed on every change.
  function refreshLive() {
    const others = Object.entries(sync.people || {})
      .filter(([n]) => n !== myName)
      .map(([, s]) => decodeGrid(s));
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
      gridStyle: sync.gridStyle,
      activeDay: groupDay,
      heat: { density, total },
    });

    renderRecs(density, total);
  }

  function renderRecs(density, total) {
    if (!density) {
      const others = Object.entries(sync.people || {})
        .filter(([n]) => n !== myName)
        .map(([, s]) => decodeGrid(s));
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
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveGrid(syncId, myName, encodeGrid(myGrid)).catch(() => {
        // transient network failure — next toggle retries; grid stays local
      });
    }, 400);
  }

  return () => { unsub(); clearTimeout(saveTimer); };
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
```

- [ ] **Step 2: Verify syntax + logic tests still pass**

Run: `node --check src/views/sync.js && node test/logic.test.js`
Expected: `logic.test.js: all assertions passed`

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev` (requires `.env`). Create a sync → join as "Alice" → paint some cells → open the same URL in a second browser window → join as "Bob" → paint → both windows' Group panels and recommendations update live. Narrow window (<1024px): Mine/Group toggle appears and switches panels.

- [ ] **Step 4: Commit**

```bash
git add src/views/sync.js
git commit -m "feat: sync view — join gate, live group heatmap, recommendations"
```

---

### Task 7: Remove old implementation, update README

**Files:**
- Delete: `src/state.js`, `src/components/Grid.js` (old capital-G file; new one is `grid.js`)
- Modify: `README.md` (structure + features sections)

**Interfaces:**
- Consumes: nothing
- Produces: clean tree; no dead code

- [ ] **Step 1: Delete dead files and verify nothing references them**

```bash
git rm src/state.js src/components/Grid.js
grep -rn "state.js\|components/Grid" main.js src/ index.html || echo "no references"
```

Expected: `no references`. (Case-insensitive filesystems: confirm `src/components/grid.js` — the NEW file — still exists after `git rm`; if it vanished, restore it with `git checkout -- src/components/grid.js`.)

- [ ] **Step 2: Update README project structure and features**

Replace the `## 📂 Project Structure` code block with:

```
timesync/
├── index.html              # App shell
├── main.js                 # Hash router + boot
├── style.css               # Utility-tool visual system
├── src/
│   ├── logic.js            # Pure: grid codec, density, recommendations
│   ├── db.js               # Firebase RTDB (createSync/subscribeSync/saveGrid)
│   ├── views/
│   │   ├── home.js         # Sync creation form
│   │   └── sync.js         # Join gate, grids, heatmap, recommendations
│   └── components/
│       └── grid.js         # Grid renderer (week/day) + pointer painting
└── test/
    └── logic.test.js       # node assert tests
```

In the `## ✨ Features` table: change the "Per-Person Grids" row description to "Each participant joins by name via a shared link and marks their own hours."; change "Two Modes" description to "Weekly recurring or specific dates, chosen at creation — plus week-grid or day-by-day layout."; remove the "Glassmorphism UI" row. In `## 🧭 How It Works`, replace step 2 with "2. Share the sync link · each person joins by entering their name". In the About section, replace the last paragraph's "no backend" claims with "Built with vanilla JavaScript (ES modules) and Vite, backed by Firebase Realtime Database for live shared syncs." Remove the `backend-none` badge line.

- [ ] **Step 3: Verify and commit**

Run: `node test/logic.test.js && node --check main.js`
Expected: assertions pass, clean check.

```bash
git add -A
git commit -m "chore: remove legacy local-only implementation, update README"
```

---

### Task 8: Verification (build + E2E)

**Files:** none (verification only)

- [ ] **Step 1: Unit tests**

Run: `node test/logic.test.js`
Expected: `logic.test.js: all assertions passed`

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: `dist/` builds without errors.
Note: if node_modules was installed on another OS (win32 binaries), run `rm -rf node_modules package-lock.json && npm install` first.

- [ ] **Step 3: E2E checklist (dev server, real Firebase)**

Run `npm run dev` with a filled `.env`, then walk through — each item must pass:

1. Home renders; create sync "Test" (weekly, 8–22, week grid) → lands on `#/s/<id>`
2. Join as "Alice" → week grid: days as columns, hours 8–21 as rows
3. Drag-paint several cells in one gesture (mouse) — all painted, no stops
4. DevTools device mode (375px): Mine/Group toggle appears; drag-paint with touch emulation works; page doesn't scroll while painting inside grid; scrolls normally outside
5. Second browser window, same URL → join as "Bob" → paint → first window's Group panel and recommendations update within ~1s without reload
6. Heatmap: cell tap shows `n/total` bubble; deeper overlap = darker blue
7. Recommendations: duration 2h shows only windows where availability holds for 2 consecutive hours
8. Clear button empties Mine grid; group panel updates
9. Create a second sync in "day by day" style → day tabs render; painting works per day
10. Create a "specific dates" sync starting on a chosen date → grid columns/tabs show real dates starting exactly on that date (no off-by-one)
11. `#/s/doesnotexist` → "Sync not found" card with home link
12. Copy link button → clipboard contains the sync URL

- [ ] **Step 4: Fix anything that failed, re-run, commit fixes**

```bash
git add -A
git commit -m "fix: E2E findings"   # only if fixes were needed
```
