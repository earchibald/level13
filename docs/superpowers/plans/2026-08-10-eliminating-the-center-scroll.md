# Eliminating the centre scroll pane — audit and migration plan

**Branch:** `gh-pages-mobile` (audited at `7a68bf37`)
**Scope:** the small layout (`body.layout-small`), portrait shell.
**Goal:** remove the centre scrollable area (`#grid-switch-content`, "the pane") from the mobile layout.

---

## Executive summary

The mobile shell locks the document and stacks four bands: top chrome, the
pane, the sector action bar, and the map panel. The pane is the only band
that scrolls. Ten earlier migrations have already emptied most of it on the
exploration tab. Five leftovers remain there. The eight management tabs
still use the pane as their whole content surface, and that is a redesign
per tab, not a migration — this plan recommends they keep the pane.

**Recommended end state:** the exploration loop never scrolls. The pane
becomes a non-scrolling, inert region on the exploration tab, the way the
map tab already treats it (`overflow: hidden`, mobile.less:2606–2612). The
management tabs keep the pane as their scroll surface.

### What is already out of the pane (exploration tab)

| Content | New home | Done by |
|---|---|---|
| Level title | Banner in `#mobile-chrome` | `updateLocationHeaderPlacement` |
| Room name (`#header-sector`) | Banner chip `#btn-room` | UIOutLevelSystem.js:1341; h2 hidden (mobile.less:920) |
| Room description (`#out-desc`) | `#room-panel` overlay | `updateRoomPanelPlacement` (element moves, not copies) |
| Scavenged %, resources, items | `#out-finds-row` in the map panel | UIOutLevelSystem.js:1360–1366 |
| Scavenge, scout, refill, camp, beacon | `#out-sector-bar` band | `updateSectorBarPlacement` |
| Collector build + collect + fill | Collector chips in the bar | `updateCollectorRows` |
| Situational actions (`#out-actions`) | Bar row (`has-finds`) | `updateOutActionsPlacement` |
| NPCs (`#out-characters`), locales (`#out-locales`) | Bar rows (`has-characters`, `has-locales`) | `updateOutActionsPlacement` |
| Movement compass, enter/up/down/camp | Map panel controls column | `updateOutControlsPlacement` |
| Minimap, position/distance | Map panel | `updateMapDockPlacement` |
| Footer (save/restart/version) + log pill | `#out-panel-meta` strip in the map panel | `updateFooterPlacement`, `updateLogButtonPlacement` |
| Log | Drawer + toasts + pill | UIOutLogSystem |

### What is still in the pane (the migration targets)

| # | Leftover | When it shows | Proposed home |
|---|---|---|---|
| 1 | Tab header strip `#grid-tab-header` | Always on the out tab; its `h2` receives the raw tab id | Hide on the out tab (camp and map tabs already do) |
| 2 | Investigated % (`#out-desc-stats`) | Investigable sectors, post-scout — the table's only remaining row | Third part of the finds row |
| 3 | Collector upgrade arrows (`#out-improvements`) | Once a bucket/trap is built | Third state of the collector chips |
| 4 | Beacon dismantle row (`#out-improvements-beacon`) | Once a beacon is built | Sector bar, beside the build-beacon slot |
| 5 | Pre-scout fallback: resources/items rows + footer in the pane | Before scout unlocks (no map panel yet) | Dock the finds row and the meta strip into the sector bar |

**Separate decision — the embark page (`switch-embark`):** the packing
tables are the page, and the Go button is already pinned. Recommend keeping
it as a scrolling page for now (it is a modal moment, not the exploration
loop); a fixed panel with internal scroll is the later option.

**Effort estimate:** items 1–2 are small (CSS rule; one JS write + one LESS
block). Items 3–4 are medium — they touch the chip lifecycle and the
button-registration trap. Item 5 is medium and is what allows the final
lock. The final lock itself is one LESS rule plus verification.

---

## Detailed plan

### Global constraints (repo conventions — apply to every task)

- Never hand-edit `css/main.css`. Edit `css/modules/mobile.less`, then
  recompile: `npx -p less lessc css/main.less css/main.css` from the repo
  root.
- jQuery is an ambient global. Never add `"jquery"` to a `define([...])`
  list.
- Every changed JavaScript file must pass `node --check <file>`.
- LESS needs `~"..."` escaping around `calc()`, `env()`, `min()` and
  `var()` with a fallback.
- Small layout only: no rule may change `body.layout-regular` rendering.
- Any new `display: ... !important` rule needs a matching guard in the
  HIDE STILL MEANS HIDE list (mobile.less:3515–3551), and the list's own
  comment must stay accurate.
- Buttons the game toggles must be toggled by JS, not hidden by CSS alone:
  `UIOutElementsSystem` rebuilds its update list from visible buttons, and
  a CSS-hidden button drops out and never returns (documented at
  mobile.less:3194–3201).
- Do not bump any version number in the tasks; the release bumps it
  (fourth digit) when it deploys.

### Task 1 — Hide the tab header strip on the exploration tab

Small. CSS only.

- `setTab` writes the raw tab id into `#tab-header h2` on every switch
  (UIFunctions.js:1628, inherited from upstream). The camp and map tabs
  already hide the h2 (mobile.less:1756–1764). The out tab does not, and no
  system overwrites the text there.
- Add beside the existing pair, with the same reasoning comment:
  `body.layout-small.tab-switch-out #tab-header h2 { display: none; }`
- Do not hide `#grid-tab-header` itself: it carries the camp rename button
  and the map selects for their own tabs, and those tabs manage it.
- Verify in play that nothing else shows in the strip on the out tab; then
  consider collapsing the whole `#grid-tab-header` row on `tab-switch-out`
  if it still costs a margin.

### Task 2 — Investigated % joins the finds row

Small-medium. One HTML span, one JS write, one LESS block.

- Today it is the only row `#out-desc-stats` renders post-scout
  (UIOutLevelSystem.js:836–844; the resources/items rows return early at
  854–855 when the finds row exists).
- Add a `finds-part finds-part-investigated` span to the first
  `.finds-line` in `index.html` (the row is at index.html:395–400).
- Write it from `updateSectorDescription` beside the other three writes
  (UIOutLevelSystem.js:1360–1366). Reuse the strings the table uses
  (`ui.exploration.sector_status_investigated_percent_field_*`), split on
  the same label/value rule as `getSectorStatsRow`.
- Respect the row's stability contract (mobile.less:2926–2932): parts must
  not appear mid-tap. Toggle the part's visibility class from
  `showInvestigate()` on location change and scout, the same timing as the
  `no-items` class (UIOutLevelSystem.js:1366).
- Keep the table code: the regular layout still reads the table, and the
  early return at 854–855 already keeps the two layouts from drifting. Gate
  the investigate field the same way (`if (hasFindsRow) return fields;`
  moves above it) so the phone table goes empty post-scout.
- The `:empty` rule (mobile.less:1302–1305) then hides `#out-desc-stats`
  with no further work.

### Task 3 — Collector upgrades join the chips

Medium. Chip lifecycle change.

- What is left in `#out-improvements` for collectors is the upgrade arrow
  per collector (index.html:502–507); the build and collect actions moved
  to the chips already (comment at index.html:500).
- Give the chip a third affordance: when `is-built`, show an upgrade arrow
  button (`improve_out_collector_water` / `_food`) after the collect
  buttons. The chip states stay driven by `updateCollectorRows`, and the
  new button must be shown/hidden there too — not by CSS — because of the
  button-registration trap (mobile.less:3194–3201).
- `improve_out_*` actions are dialog actions: their tap callouts are
  already suppressed on phones (mobile.less:110–117), so a tap opens the
  dialog. No new callout work.
- Then hide the two collector rows in the pane on the small layout by
  extending the same toggles `updateCollectorRows` already owns — again in
  JS, not CSS, and keeping the regular layout untouched.

### Task 4 — Beacon dismantle joins the sector bar

Small-medium. Same pattern as Task 3.

- The last `#out-improvements` row is the beacon: name + dismantle button
  (index.html:511–514). Build-beacon already lives in the bar
  (index.html:451).
- Add a dismantle button beside `#out-action-build-camp` /
  `#out-action-build-beacon` in `#out-sector-bar-actions`. Build and
  dismantle never show together, so the slot cost is one button.
- Toggle it from the same pass that toggles the row today
  (`updateOutImprovementsList`), and include it in the bar's `has-actions`
  count so an otherwise-empty bar row does not stay open for a hidden
  button.
- After Tasks 3 and 4 the improvements box has no visible rows on the
  small layout: hide `#out-improvements` and `#header-out-improvements`
  there via the existing count toggles (UIOutLevelSystem.js:435–436, 1136)
  extended with the docked/small condition — mirroring how
  `#header-out-actions` already asks `isDocked`
  (UIOutLevelSystem.js:316–322).

### Task 5 — Close the pre-scout gap

Medium. This is what allows the final lock.

Before scout unlocks there is no map panel, so today: the finds data
renders as table rows in the pane (UIOutLevelSystem.js:854–866), and the
footer docks into the pane (`updateFooterPlacement`,
UIOutHeaderSystem.js:1807–1827, gated by `hasOutPanel` at 1433 which
requires `unlockedFeatures.scout`).

- Let the sector bar own the finds row and the meta strip while the map
  panel is absent. The bar already knows how to be the bottom edge
  (`out-map-hidden`, mobile.less:3258–3261).
- Move `#out-finds-row` placement into a small placement helper with the
  marker-comment pattern every other dock uses: into the map panel when it
  exists, into the top of the sector bar before then.
- Drop the `scout` condition from `hasOutPanel` for the footer/pill by
  targeting the bar's meta strip when the panel is hidden —
  `getOutPanelMeta` (UIOutHeaderSystem.js:1791–1800) generalises to "the
  last visible bottom band".
- Then delete the `hasFindsRow` early-return special case
  (UIOutLevelSystem.js:854–855): the finds row exists from the start on the
  small layout, and the table never renders there.
- Decision point: if this feels heavy for a window that lasts minutes,
  the fallback is to accept pre-scout scrolling and scope the lock (Task 6)
  to post-scout. The lock rule can key on `#unit-main.out-map-hidden`.

### Task 6 — Lock the pane on the exploration tab

Small. The payoff.

- Follow the map tab precedent (mobile.less:2606–2612):
  `body.layout-small.tab-switch-out #grid-switch-content { overflow: hidden; }`
  (scoped, or keyed off the Task 5 decision).
- Keep the element: it is the tab container for every other tab, and its
  `vision-background` paints the region between the bands.
- Verify on the harness and the simulator: new game (pre-scout), scouted
  sector with investigate, built collectors, built beacon, camp-on-level
  ("back to camp" row), long locale lists, landscape map, and the
  camp/out round trip (dock/undock markers).

### Later / separate: the embark page

- Keep as a scrolling page short term. Its mirror is already pinned
  (`.action-mirror`, index.html:350, mobile.less:1205–1246), and the
  packing tables legitimately grow without bound.
- Later option: cap the tables in a fixed-height internal scroller so the
  page itself never scrolls. Do this only after the exploration tab lock
  has soaked, and as its own spec.

### Out of scope (recommended)

The management tabs — camp (`switch-in`), bag, explorers, trade, projects,
upgrades, tribe (`switch-world`), milestones — use the pane as their whole
content surface. Their content is unbounded (buildings, items, upgrades,
camps). Removing their scroll means one redesign per tab (drawers, panels,
or paged lists). Nothing in the exploration migration blocks doing that
later, tab by tab. The map tab is already scroll-free.

---

## Manifest of occurrences

### The pane and the shell

| Element | index.html | mobile.less | JS owner |
|---|---|---|---|
| `#grid-switch-content` (the pane) | 241 | scroller: 2909–2924; out-tab column: 1253–1271; map-tab lock: 2606–2612 | tab switching: UIFunctions `setTab` 1625–1642 |
| `#mobile-chrome` (top chrome) | built at runtime | 584–594, 2904–2907 | `updateChromeGrouping` UIOutHeaderSystem.js:1858–1888 |
| `#out-sector-bar` (action band) | 438–471 | 3064–3306 | `updateSectorBarPlacement` 1641–1667 |
| `#out-container-compass` (map panel) | 384–413 | 1351–1400 (grid: finds/map/controls/meta) | `updateMapDockPlacement` 1727–1741 |
| `.action-mirror` (pinned bar) | 350 (embark), 705 (projects), 804 (milestones) | 1205–1246 | `updateActionMirrorPlacement` 1763–1785 |
| `#mobile-overlays` / `#room-panel` / `#log-toasts` | 889 / 895 / 915 | 937–1034, 2067–2116 | `toggleRoomPanel` UIFunctions.js:1980; UIOutLogSystem |
| `#footer` | 850 | in-pane: 3020–3029; in-panel: 1453–1478 | `updateFooterPlacement` 1807–1827 |
| `#btn-log-toggle` | 872 | 1960–2015, docked: 1480–1490 | `updateLogButtonPlacement` 1833–1849 |
| Shell lock (document never scrolls) | — | 2848–2924 | `isShellLayout` UIOutHeaderSystem.js:1476–1480 |

### Leftover 1 — tab header strip

- `index.html:243–253` — `#grid-tab-header`: rename button (camp), map
  selects (map), `h2.noninteractive`.
- `src/game/UIFunctions.js:1628` — `$("#tab-header h2").text(tabID)` on
  every tab switch (same line exists upstream).
- `css/modules/mobile.less:1756–1764` — h2 hidden on `tab-switch-in` and
  `tab-switch-map` only. No rule for `tab-switch-out`.

### Leftover 2 — investigated %

- `src/game/systems/ui/UIOutLevelSystem.js:836–844` — the field, inside
  `getSectorStatsFields`.
- `src/game/systems/ui/UIOutLevelSystem.js:1353` — the table write
  (`descriptionStats.html(...)`) in `updateSectorDescription`.
- `src/game/systems/ui/UIOutLevelSystem.js:1516–1518` — `showInvestigate`.
- `index.html:419` — `#out-desc-stats` (comment on ordering at 417–418).
- `css/modules/mobile.less:1292–1305` — order-1 placement and the
  `:empty` hide; 1315–1343 — the `sector-stats` table styling.
- Finds row (the target): `index.html:395–400`;
  `UIOutLevelSystem.js:99–104, 1360–1366`; `mobile.less:2926–2985`.

### Leftover 3 — collector upgrade rows

- `index.html:498–507` — `#out-improvements` table, rows
  `#out-improvements-collector-water` / `-food` with
  `improve_out_collector_*` buttons (migration note in comments 500–501).
- `src/game/systems/ui/UIOutLevelSystem.js:50–70` — `COLLECTOR_DEFS`
  (`rowID` at 56 and 68); 1017 — `updateCollectorRows` (owns chip states
  `is-built` / `is-buildable`); 1100–1105 — `updateOutImprovementsList`
  calls it and owns the counts; 435–436 — box visibility toggles.
- `css/modules/mobile.less:2239–2264` — the rows as flexed cards
  (`!important` show, see guard); 3176–3234 — the chips; 3194–3201 — the
  button-registration warning; 3536–3539 — hide guards for the two rows.
- Callout suppression for `improve_out_*`: `mobile.less:110–117`.

### Leftover 4 — beacon dismantle row

- `index.html:508–514` — row `#out-improvements-beacon`
  (`btn-action="build_out_beacon"` on the row; `dismantle_out_beacon`
  button; comments 508–510 record the build's move to the bar).
- Bar target: `index.html:450–451` (`#out-action-build-camp`,
  `#out-action-build-beacon`); bar row visibility:
  `mobile.less:3075–3096`; count/toggle:
  `UIOutLevelSystem.js` `updateLevelPageActions` (`has-actions` and the
  docked heading logic at 316–323) and `updateOutImprovementsList`
  (header toggle at 1136, comment at 1015).

### Leftover 5 — pre-scout fallback

- `src/game/systems/ui/UIOutLevelSystem.js:846–866` — `hasFindsRow`
  gate (854–855) and the resources (857) and items (862–866) table rows
  that render only before scout unlocks on a phone.
- `src/game/systems/ui/UIOutHeaderSystem.js:1420–1444` — `isShell`,
  `hasOutPanel` (1432–1433, requires `unlockedFeatures.scout`), and the
  placement calls; 1791–1800 — `getOutPanelMeta`; 1807–1827 — footer to
  pane when no panel.
- `css/modules/mobile.less:3258–3261` — `out-map-hidden` (the bar as the
  bottom edge, the pre-scout state); 1592–1597 — pill clearance pre-panel.

### Embark page (decision pending)

- `index.html:348–380` — description, `#embark-resources`,
  `#embark-items`, `#embark-bag` indicator, `#embark-warning`, second
  leave button.
- `src/game/systems/ui/UIOutEmbarkSystem.js` — populates the tables
  (header write at 106, warning at 208–209).
- `css/modules/mobile.less:1205–1246` — the pinned mirror and the hidden
  in-page duplicate; 1604–1617 — pane padding and pill clearance.

### Per-tab pane inventory (the "entirely" question)

| Tab | Pane content today | Scroll-free path |
|---|---|---|
| `switch-out` | Leftovers 1–5 above | This plan |
| `switch-map` | Map column only | **Done** (mobile.less:2606–2612) |
| `switch-embark` | Packing UI (index.html:348–380) | Pending decision |
| `switch-in` (camp) | Camp vis canvas, buildings, population/workers, characters, events, demographics (index.html:257–345) | Redesign per tab — out of scope |
| `switch-bag` | Item lists, crafting (index.html:528+) |〃 |
| `switch-explorers` | Party, recruits (index.html:585+) | 〃 |
| `switch-trade` | Caravans, partners (index.html:681+) | 〃 |
| `switch-projects` | Project cards (index.html:702+; launch mirror pinned) | 〃 |
| `switch-upgrades` | Upgrade tree, blueprints (index.html:738+) | 〃 |
| `switch-world` (tribe) | Camp overview cards (index.html:779+) | 〃 |
| `switch-milestones` | Milestone lists (index.html:802+; unlock mirror pinned) | 〃 |

### Audit method

Read on `gh-pages-mobile` at `7a68bf37`: `index.html` (shell + out tab
markup), `css/modules/mobile.less` in full (the layout-small treatment
map), `UIOutHeaderSystem.js` placement/docking methods (1395–1928),
`UIOutLevelSystem.js` sector description/stats/finds paths (700–880,
1330–1370), `UIFunctions.js` tab switching and room panel. Cross-checked
against `docs/superpowers/specs/2026-08-04-emptying-the-scroll-design.md`
and the branch commit log. Line numbers are exact at `7a68bf37` and will
drift with edits — re-anchor with grep before executing.
