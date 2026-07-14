# TimeSync Redesign — Design Spec

Date: 2026-07-14
Status: Approved pending user review

## Goal

Rebuild TimeSync from a local-only demo into a shareable scheduling tool with a
mobile-first, non-generic visual design. A creator makes a "sync", shares a
link, and each participant marks availability under their own name. A live
heatmap and top-3 recommendations show the best meeting times.

## Decisions Made (with user)

| Topic | Decision |
|---|---|
| Visual direction | "Utility Tool" — light, neutral, Linear/Notion register |
| Mobile grid | Both layouts supported; creator picks per sync |
| Storage | Firebase Realtime Database (free tier) |
| Identity | None. Participant types a name; name = identity, honor system |
| Architecture | Vanilla JS + hash router; no framework |
| Hosting | Netlify static; hash routes need no redirect config |
| Credentials | Firebase web config is public by design; ships in bundle; env vars for git hygiene only |

## Routes & Views

Hash router (~20 lines, hand-rolled):

- `#/` — **Home**: sync creation form
- `#/s/<id>` — **Sync view**: name gate, then availability grid + group heatmap + recommendations
- Unknown hash or missing sync → "Sync not found" message + home link

Views are plain render functions sharing one shell. The old local-only mode is
removed: no "+ Add person" button, no person dropdown. You edit only the grid
belonging to the name you entered; the heatmap covers the group.

## Creation Form (Home)

Fields:

1. **Sync name** — text, required
2. **Schedule type** — segmented: `Weekly` | `Specific dates`
3. **Starting date** — date input, shown only in dates mode
4. **Visible hours** — two selects, `08:00`–`22:00` default (crops display only)
5. **Grid style** — segmented: `Week grid` | `Day by day`

Submit → `createSync()` → redirect to `#/s/<id>`. Sync view has a copy-link
button for sharing.

## Join Flow (Sync view, first visit)

- Shows sync name, mode summary, count + chips of people already joined
- Participant types a name (or taps an existing chip to edit that person)
- Empty or sanitized-to-empty name → Continue disabled
- Chosen name kept in memory for the session; no localStorage requirement

## Data Model (Firebase RTDB)

```
/syncs/<pushId>: {
  name:      string,
  mode:      "week" | "date",
  startDate: "YYYY-MM-DD" | null,      // date mode only
  hourStart: number,                    // visible range start (0–23)
  hourEnd:   number,                    // visible range end (1–24), > hourStart
  gridStyle: "week" | "day",
  createdAt: server timestamp,
  people: {
    <sanitizedName>: string             // grid encoding, see below
  }
}
```

- **Sync id**: Firebase `push()` key — unique, chronological, unguessable-ish
- **Grid encoding**: 7 day-strings of 24 chars (`'0'`/`'1'`), joined with `|`.
  Always full 7×24; visible-hours crops display only, so the range can be
  changed later without data loss
- **Name sanitization**: strip RTDB-forbidden key chars (`.#$/[]`), trim,
  max 30 chars. Applied on join
- **Concurrency**: last-write-wins per name; `onValue` reconciles all clients

### DB module — `src/db.js`, 3 functions

```
createSync(config)          -> Promise<syncId>
subscribeSync(id, callback) -> unsubscribe fn   (onValue on whole sync)
saveGrid(id, name, gridStr) -> Promise<void>    (set on people/<name>)
```

### Config & security

- Firebase web config via `VITE_FIREBASE_*` env vars; `.env` gitignored,
  `.env.example` committed. Config is public by design — security rules, not
  secrecy, are the enforcement layer
- Rules: open read/write under `/syncs/$id` with structure validation
  (`.validate` on field types/lengths). Accepted tradeoff: anyone with the
  link can edit any participant's marks — honor system, per user decision

### Explicit non-goals (v1)

- No timezone conversion — times are wall-clock ("14:00" means each viewer's
  own 14:00), when2meet-style
- No auth, no edit protection between participants
- No sync deletion/expiry UI (free-tier data is tiny)

## Sync View Layout

**Mobile (<1024px):** segmented toggle `[ Mine | Group ]` — one grid at a
time. Recommendations card always below.

**Desktop (≥1024px):** Mine and Group side by side; toggle hidden.

**Grid rendering — one renderer, two arrangements** (per sync `gridStyle`):

- `week`: transposed — days as columns (7 fit portrait width), visible hours
  as rows, vertical scroll. Cells min 28px tall
- `day`: day tabs on top; selected day's hours as full-width rows, ~44px tall

**Interaction (touch + mouse, one code path):**

- Pointer events: `pointerdown` starts paint (mode = inverse of first cell),
  `pointermove` + `elementFromPoint` paints cells crossed, `pointerup` ends
- `touch-action: none` on the grid element only — page scrolls normally
  outside it
- Single tap = toggle one cell
- Optimistic UI: local state renders immediately; `saveGrid` persists;
  `onValue` reconciles

**Heatmap:** same arrangement as the availability grid. Cell tint = blue
alpha scaled by count/total. Tap a cell → inline count bubble (`3/5`) —
replaces hover tooltip (no hover on touch).

**Recommendations:** duration select (1–8h) on the card; top-3 windows where
the minimum availability across the window is maximized (existing logic).
Labels follow sync mode (weekday names in week mode, dates in date mode).

## Visual System

**Kill list (from current design):** Google Fonts import, gradient text,
glassmorphism blur, glow shadows, radial gradient background, entrance
animations, emoji in headers, scale-on-hover cells.

- **Font:** system stack — zero network requests
- **Palette:** `#fafafa` page, `#ffffff` cards, `#18181b` text, `#71717a`
  muted, `#e4e4e7` hairlines; single accent `#2563eb` (selection, primary
  actions); heatmap = blue alpha ramp
- **Shape:** 6px radii, 1px borders, flat; shadow only on sticky mobile
  toggle if needed
- **Type scale:** 12/14/16/20px, weights 400/600 only
- **Motion:** none decorative
- **Buttons:** primary = solid fill; secondary = hairline outline
- **Color-scheme:** light (dark mode out of scope v1)

## Error Handling

- Sync not found → message + home link
- Firebase unreachable on load → error state with retry button, never a
  blank page
- Offline saves → SDK queues briefly; optimistic local state keeps UI honest
- Duplicate names across tabs → last write wins; `onValue` syncs all clients

## File Structure (target)

```
index.html
main.js               # shell + hash router
src/
  db.js               # Firebase: createSync / subscribeSync / saveGrid
  state.js            # session state: sync snapshot, activeName, view
  views/
    home.js           # creation form
    sync.js           # join gate + grids + recommendations
  components/
    grid.js           # one renderer, two arrangements, pointer painting
style.css             # new visual system
.env.example
```

## Testing

- Node assert script (`test/logic.test.js`, plain node, no framework):
  grid encode/decode round-trip, recommendation window logic, name sanitizer
- Manual E2E once against the real Firebase project: create → share →
  join from phone-sized viewport → paint → heatmap updates live
