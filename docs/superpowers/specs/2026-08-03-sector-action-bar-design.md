# Sector action bar

Date: 2026-08-03
Branch: `gh-pages-mobile`
Status: design

## Goal

Keep the five controls a player uses on every sector visit reachable without
scrolling: **scavenge**, **scout**, **refill water**, and the **bucket** and
**trap** collect actions.

Today all five live in the scrolling tab content. Reading the sector
description, or opening a locale, pushes them off screen. On a phone the
collect actions sit two screens down, under the Characters section.

Three changes deliver this.

1. A new band, `#out-sector-bar`, holds the five controls. On a phone it is a
   static child of the shell column, between the scrolling pane and the map
   panel, so it never scrolls.
2. Scout disappears once the sector is scouted.
3. A built collector drops its build button. It shows a resource icon, its fill
   level and the two collect buttons instead.

The controls **move**. They are not duplicated.

## Non-goals

- No change to the compass, the movement buttons or the map panel contents.
- No change to any action's cost, duration, reward or availability rule.
- No new hotkeys. The existing ones bind to action ids, not to elements, so
  they follow the buttons.
- Landscape (`max-height: 480px`) keeps today's flowing layout. The band is
  static there like everything else, so it needs no special rule.

## Layout

### Phone, portrait

`#unit-main` is a flex column the height of the viewport. It gains a fourth
child between the pane and the map panel.

```
┌─ scouted sector, both collectors built ──────┐
│ #mobile-chrome                               │
├──────────────────────────────────────────────┤
│ #grid-switch-content (scrolls) ─────────────┐│
│  Sector header + description                ││
│  Scavenge actions                           ││
│   [Investigate] [Examine] [scavenge heap]   ││
│   [Rest] [Wait]                             ││
│  Characters                                 ││
│  Build    Bucket · lvl 1  [▲]               ││
│           [Beacon] ×    [Camp]              ││
│  Locales                                    ││
│  footer                                     ││
├══════════════════════════════════════════════┤ ← 3px border + shadow
│  [    Scavenge    ]        [ Refill water ]  │   #out-sector-bar
│  (w) 8.4/10 [all][1]   (f) 2.0/6 [all][1]    │
│                                              │ ← no divider
│  ┌─────┐   ↖ ↑ ↗    [Enter camp]             │   #out-container-compass
│  │ map │   ← ● →    [Up]    [Down]           │
│  └─────┘   ↙ ↓ ↘    [Back to camp]           │
│  level 13 · 4,2 · 6 blocks                   │
└──────────────────────────────────────────────┘
```

The bar and the map panel share a background and have no rule between them.
They read as one block of bottom chrome. The 3px divider and its shadow move
off the map panel and onto the bar, which is now the top edge of that block.

Each row collapses when it has nothing to show. Most sectors carry no
collector, so the bar usually costs one row.

```
 unscouted, nothing built    scouted, no collectors    unscouted, bucket built
┌──────────────────────────┐┌────────────────────────┐┌────────────────────────┐
│ [  Scavenge  ] [ Scout ] ││ [       Scavenge     ] ││ [ Scavenge ] [ Scout ] │
└──────────────────────────┘└────────────────────────┘│ (w) 0.0/10 [all][1]    │
  ~47px                       ~47px                   └────────────────────────┘
                                                        ~87px
```

Both rows empty: the bar is hidden outright and the map panel keeps its own
divider.

`(w)` and `(f)` are `img/res-water.png` and `img/res-food.png`, the sprites the
bag and camp storage already use.

### Desktop

The bar is not pinned. It renders as the first block of the actions column, in
its markup home. Only the bar itself moves between layouts, never the buttons
inside it — the same pattern `#out-container-compass` already uses.

```
┌─ desktop ────────────────────────────────────────────────────────┐
│  ┌──────────┐  Sector header                                     │
│  │ minimap  │  Description ...                                   │
│  └──────────┘                                                    │
├──────────────────────────────────────────────────────────────────┤
│  Move          │ [  Scavenge  ] [ Scout ] [ Refill water ]       │
│  ↖ ↑ ↗         │ (w) 8.4/10 [collect all][1]                     │
│  ← ● →         │ (f) 2.0/6  [collect all][1]                     │
│  ↙ ↓ ↘         │ Scavenge actions                                │
│  [Enter camp]  │  [Investigate] [Examine] [scavenge heap]        │
│                │ Build    Bucket · lvl 1 [▲]   [Beacon] [Camp]   │
└──────────────────────────────────────────────────────────────────┘
```

## Visibility rules

| Element | Shown when |
|---|---|
| `#out-action-sca` | `isAwake` (unchanged) |
| `#out-action-scout` | `isAwake && playerActionsHelper.isVisible("scout")` |
| `#out-action-use-spring` | `isAwake && isScouted && featuresComponent.hasSpring` (unchanged) |
| `#out-collector-chip-water` | `collector_water` count > 0 |
| `#out-collector-chip-food` | `collector_food` count > 0 |
| `#out-action-build-bucket` | `isVisible("build_out_collector_water") && count === 0` |
| `#out-action-improve-bucket` | `count > 0 && maxLevel > 1` (unchanged) |
| `#out-improvements-collector-water` | build button shown OR improve button shown |
| `#out-sector-bar-actions` | any of scavenge / scout / spring shown |
| `#out-sector-bar-collectors` | either chip shown |
| `#out-sector-bar` | either row shown |

Trap and food mirror bucket and water throughout.

### Why `isVisible("scout")` and not `!isScouted`

`PlayerActionData.json` gives `scout` the requirement `sector.scouted: false`,
and `PlayerActionsHelper.isVisible` (`src/game/helpers/PlayerActionsHelper.js:207`)
returns `false` for `DISABLED_REASON_SCOUTED` but `true` for
`DISABLED_REASON_VISION`. That is exactly the wanted rule, already expressed in
the game's own data:

- scouted sector — hidden;
- unscouted, ready — shown, enabled;
- unscouted, too dark — shown, disabled, with its reason on tap.

The third case is the only place the game explains that scouting is what is
missing, so it stays.

The gate on `GameGlobals.gameState.unlockedFeatures.vision` in the current
toggle is dropped. `isVisible` covers it through the action's own
`vision: [30, -1]` requirement.

### Why the build button needs an explicit count check

`build_out_collector_water` requires `improvements.collector_water: [-1, 1]`.
Once built, that fails with `DISABLED_REASON_MAX_IMPROVEMENTS`, which
`isVisible` treats as *still visible*. Hiding it is therefore a deliberate
override, not a fall-out of the requirement data.

## Markup — `index.html`

### New: the bar

Insert as the first child of the `.unit-rest` unit inside
`#container-tab-two-out-actions`, immediately before `#header-out-actions`.

```html
<div id="out-sector-bar">
    <div id="out-sector-bar-actions" class="actionbox">
        <!-- moved here: #out-action-sca, #out-action-scout, #out-action-use-spring -->
    </div>
    <div id="out-sector-bar-collectors">
        <div id="out-collector-chip-water" class="collector-chip">
            <img class="collector-chip-icon" src="img/res-water.png" alt="water" />
            <span id="out-collector-fill-water" class="collector-chip-fill vision-text"></span>
            <!-- moved here: #out-action-use-bucket, #out-action-use-bucket_one -->
        </div>
        <div id="out-collector-chip-food" class="collector-chip">
            <img class="collector-chip-icon" src="img/res-food.png" alt="food" />
            <span id="out-collector-fill-food" class="collector-chip-fill vision-text"></span>
            <!-- moved here: #out-action-use-trap, #out-action-use-trap_one -->
        </div>
    </div>
</div>
```

The seven moved buttons keep their ids, `action` attributes and classes
verbatim. `UIFunctions.createButtons` runs once over `body`
(`src/game/UIFunctions.js:855`), and `UIOutElementsSystem` updates disabled
states and cooldowns unscoped, so buttons in a new container are picked up with
no registration change.

### Changed: the two collector rows

Each row loses three cells — the two `.action-use` buttons and `.list-storage`
— and gains a label cell and a `collector-row` class.

```html
<tr id="out-improvements-collector-water" class="collector-row">
    <td><button class="action action-build action-location text-key"
        action="build_out_collector_water" id="out-action-build-bucket"
        data-text-key="game.improvements.collector_water_name_default"></button></td>
    <td class="collector-row-label vision-text"><span></span></td>
    <td><button class="action action-improve btn-glyph-big"
        id="out-action-improve-bucket" action="improve_out_collector_water">▲</button></td>
</tr>
```

Row states:

```
  not built                        [ Bucket ]
  built, an upgrade path exists    Bucket · lvl 1   [▲]
  built, no upgrade path           (row hidden)
```

"No upgrade path" means `getCurrentMaxImprovementLevel` returns 1, which is the
existing condition on `#out-action-improve-bucket`. It depends on tech level,
not on the collector's own level: a collector already at the current cap keeps
its `▲` shown and disabled, with its reason on tap. That is today's behaviour
and it does not change.

The label text is
`ImprovementConstants.getImprovementDisplayName(improvementID, level)` — which
already varies with level — followed by `" · lvl " + level`. The row is only
ever visible with a built collector when an upgrade path exists, so the level
is always meaningful there and is always shown.

## JavaScript

### `src/game/systems/ui/UIOutLevelSystem.js`

**New `updateCollectors()`.** Owns everything about the two collector rows and
the two chips. Returns the number of visible rows. Reads
`SectorImprovementsComponent` and
`GameGlobals.campHelper.getCurrentMaxImprovementLevel`.

For each of water/food it sets: build button visibility, improve button
visibility, row visibility, label text and visibility, chip visibility
(the `is-built` class), and fill text (`stored / capacity`, stored floored to
one decimal — the existing formula in `updateOutImprovementsStatus`).

It also owns the bar's `has-collectors` class, because it is the function that
knows the counts:

```js
$("#out-sector-bar").toggleClass("has-collectors", hasWaterCollector || hasFoodCollector);
```

**`updateOutImprovementsList()`.** Calls `updateCollectors()` first and seeds
`numVisible` with its return value. Its generic `#out-improvements tr` loop
skips rows carrying `collector-row`, so the two logics cannot fight. It keeps
ownership of the `#header-out-improvements` toggle.

**`updateOutImprovementsStatus()`.** Calls `updateCollectors()` and keeps only
the beacon dismantle toggle. Its collector fill and improve-button code moves
into `updateCollectors()`.

Visibility can only change on build, improve or a tech upgrade, all of which
already reach `updateOutImprovementsList` or `updateAll`. So calling
`updateCollectors()` from the status path is idempotent for visibility and the
header count cannot go stale.

**`updateLevelPageActions()`.** Change the scout toggle per the table above.
The three bar conditions are currently written inline inside their `toggle()`
calls; lift them into locals and reuse them for the bar's own class:

```js
let showScavenge = isAwake;
let showScout = isAwake && GameGlobals.playerActionsHelper.isVisible("scout");
let showSpring = isAwake && isScouted && featuresComponent.hasSpring;
// ... the three existing toggle() calls, now reading the locals ...
$("#out-sector-bar").toggleClass("has-actions", showScavenge || showScout || showSpring);
```

Classes, not `GameGlobals.uiFunctions.toggle`. See *Guards* below.

### `src/game/systems/ui/UIOutHeaderSystem.js`

**New `updateSectorBarPlacement(shouldDock)`.** Mirrors
`updateMapDockPlacement`: remembers the bar's markup parent on first dock,
returns early when already in the wanted state, restores to the remembered
parent on undock.

It must place the bar **before** the map panel, because the CSS that suppresses
the panel's divider uses an adjacent-sibling selector. When `#out-container-compass`
is already a child of `#unit-main`, dock with `$map.before($bar)`; otherwise
`$unit.append($bar)`.

**`updateLayout()`.** Call `updateSectorBarPlacement(isShell)` immediately
before `updateMapDockPlacement(isShell)`.

**Measurement.** `--l13-out-map-height` is renamed `--l13-out-bottom-height`
and now means the whole pinned bottom block. Both `updateLayout` and
`updateMeasurements` sum the visible heights of `#out-sector-bar` and
`#out-container-compass`:

```js
let bottomHeight = 0;
if (isShell) {
    $("#out-sector-bar, #out-container-compass").each(function () {
        let $el = $(this);
        if (!$el.is(":visible")) return;
        bottomHeight += Math.ceil($el.outerHeight());
    });
}
document.documentElement.style.setProperty("--l13-out-bottom-height", bottomHeight + "px");
```

The existing next-frame remeasure covers the bar too: it is rebuilt in the same
pass that measures it, so a same-pass height read can be one layout behind.

**Safe area.** When scouting is not yet unlocked the map panel is hidden
(`UIOutLevelSystem.updateUnlockedFeatures`) and the bar becomes the last
element in the column. `updateLayout` sets a marker class so the bar can take
over the bottom inset:

```js
$("#unit-main").toggleClass("out-map-hidden", isShell && !$("#out-container-compass").is(":visible"));
```

## CSS — `css/modules/mobile.less`

Only the load-bearing rules are listed. Ordinary sizing and spacing follow the
file's existing conventions.

`mobile.less` is imported for every width, so a rule written there with no
`body.layout-small` prefix applies on desktop too. The bar's own structure
rules are deliberately unprefixed — the bar looks the same on both layouts.
Only its pinned form is scoped to the small layout.

**The band.**

```less
#out-sector-bar { display: none; }

#out-sector-bar.has-actions,
#out-sector-bar.has-collectors { display: flex; flex-direction: column; gap: 4px; }

#out-sector-bar-actions,
#out-sector-bar-collectors { display: none; }

#out-sector-bar.has-actions #out-sector-bar-actions,
#out-sector-bar.has-collectors #out-sector-bar-collectors {
    display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 6px;
}
```

**Pinned form** (`body.layout-small.tab-switch-out #unit-main > #out-sector-bar`):
`position: static`, `flex: 0 0 auto`, the divider and shadow moved off the map
panel, horizontal padding matching the panel, and
`padding-bottom: calc(8px + env(safe-area-inset-bottom))` under
`#unit-main.out-map-hidden`.

**One continuous surface.** The map panel drops its own top edge whenever the
bar is above it:

```less
body.layout-small.tab-switch-out #out-sector-bar.has-actions + #out-container-compass,
body.layout-small.tab-switch-out #out-sector-bar.has-collectors + #out-container-compass {
    border-top: none;
    box-shadow: none;
}
```

Keyed on the visibility classes, not on the element, so a hidden bar leaves the
panel's divider intact.

**Tab switching.** Docked on `#unit-main`, the bar is outside
`#container-tab-two-out-actions`, so `setTab` can no longer hide it. CSS does,
as it already does for the map panel:

```less
body.layout-small:not(.tab-switch-out) #unit-main > #out-sector-bar { display: none !important; }
```

**Chips.**

```less
.collector-chip { display: flex; align-items: center; gap: 4px; }
.collector-chip-icon { width: 16px; height: 16px; }
```

Chip visibility uses `.is-built`, set by `updateCollectors()`, for the same
reason the bar uses classes.

**Log pill.** `#btn-log-toggle` on the exploration tab reads
`--l13-out-bottom-height` in place of `--l13-out-map-height`. It is the only
CSS consumer of that property; update its fallback to `300px`.

**Collector rows.** The card grid block for
`#out-improvements-collector-water|food` is replaced by
`display: flex !important` with `align-items: center` and a gap. The five-cell
card no longer exists, so `grid-template-columns` and `grid-template-areas`
and the four `grid-area` rules go, along with the `td:nth-child(3) button`
width rule. The `!important` and both guard entries stay — the rows are still
toggled through jQuery, and the generic `#out-improvements tr` rule carries no
`!important` of its own.

## Guards

**Forced `display` and jQuery.** `UIFunctions.toggle` ends in jQuery
`.toggle(show)`, which writes an inline `display` that beats a stylesheet rule.
Any element with a CSS `display` other than `block` therefore needs
`!important`, and every `!important` display then needs a matching hide guard
in the `HIDE STILL MEANS HIDE` list at the end of `mobile.less`.

This design avoids that trap for all five new containers by toggling them with
**classes** rather than `UIFunctions.toggle`. No inline `display` is ever
written to `#out-sector-bar`, its two rows, or the two chips, so none of them
needs `!important` and none needs a guard entry.

The buttons moved into the bar keep using `UIFunctions.toggle`, exactly as
today. They are `inline-block`, which is what jQuery restores, so they are not
affected.

The two collector `<tr>`s keep their existing `!important` and guard entries.

**No new `position: fixed`.** The bar is a static flex child of `#unit-main`.
iOS stops honouring `position: fixed` during a momentum scroll, which is why
the shell locks the document and stacks its bands instead. A fixed bar would
reintroduce the m29 failure.

## Verification

Run `npx -p less lessc css/main.less css/main.css` and commit both the LESS and
the compiled CSS. Bump `changelog.json`, `urlArgs` in `src/config.js`, the
three `?v=` CSS query strings in `index.html` and `changelog.html`, and
`CACHE_VERSION` in `sw.js` to the same new `0.6.3.mN` string in one commit.

Check on a phone-width viewport, exploration tab:

1. Unscouted sector — bar shows Scavenge and Scout on one row. Scout vanishes
   the moment scouting completes; the bar reflows to one button.
2. Unscouted but too dark — Scout is present and disabled, and tapping it still
   gives its reason.
3. Sector with a spring, scouted — Refill water is in the bar, not in the
   scrolling section.
4. Build a bucket — the build button disappears from the Build section, the
   chip appears in the bar with `0.0 / N`, and the row either shows
   `Bucket · lvl 1 [▲]` or disappears when no upgrade is available.
5. Collect — the fill text updates without a tab switch.
6. Scroll the pane to the footer — all five controls stay put.
7. Before scouting is unlocked — no map panel, and the bar sits on the bottom
   edge with the home-indicator inset under it.
8. Asleep — the bar carries no actions; if no collector is built it is hidden
   outright and the map panel shows its own divider again.
9. Switch tabs and back — the bar is hidden on every other tab and returns
   intact.
10. Open the log — the pill sits above the bar, not over it.
11. Rotate to landscape — the rotate notice appears; on a short desktop window
    the bar flows inline with no pinning.
12. Resize a desktop window across the small-layout threshold repeatedly — the
    bar returns to its markup position and the map panel returns to its own,
    with no duplication and no wrong ordering.

`window.scrollTo(0, 400)` must still leave `window.scrollY` at 0 on
`body.layout-small`: the document stays locked.

## Risks

- **Vertical budget.** Two full rows cost about 95px of a roughly 790px
  standalone viewport, on top of about 120px of chrome and about 160px of map
  panel. The pane drops to roughly 400px in the worst case. The row-collapsing
  keeps the common case at about 47px.
- **Sibling ordering.** The divider suppression depends on the bar being the
  map panel's immediate previous sibling. `updateSectorBarPlacement` must
  handle docking in either order; item 12 above tests it.
- **Two functions writing the same elements.** `updateOutImprovementsList` and
  `updateOutImprovementsStatus` both reach the collector rows today. Routing
  both through `updateCollectors()` is what keeps them consistent; the
  `collector-row` skip in the generic loop is what stops the old path from
  overriding the new one.

## Known-limitation note

Callout placement (`UIFunctions.getPinnedBottomHeight`) counts only bottom
chrome whose computed `position` is `fixed`. In the shell layout both bottom
bands are static, so it already returns 0 for the map panel. This design does
not change that behaviour and does not add the bar to that selector. Pre-existing;
out of scope.

## Appendix

A spoiler-flagged appendix covering later-game mechanics that touch these
actions lives beside this file. It is not required reading to implement the
design.
