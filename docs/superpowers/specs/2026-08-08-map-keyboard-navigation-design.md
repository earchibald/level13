# Keyboard navigation on the map

Move the map's sector selection with the keyboard, using the same eight-direction layout
the player uses to walk. Opening the map starts with the player's own sector selected, and
each press steps the selection one cell.

## Summary

| Item | Decision |
|---|---|
| Keys | W A S D + Q E Z C, with Numpad 8/4/2/6 + 7/9/1/3 behind `hotkeysNumpad` |
| Scope | `tabs.map` only |
| Start | the player's current sector, selected as if clicked |
| Gaps | one press, one cell. No drawn neighbour means nothing happens |
| Unknown cells | reachable only if already drawn — never a blank one |
| Level | the cursor stays on the level being displayed |

## Why these keys

Movement already binds `KeyW/A/S/D` for N/W/S/E and `KeyQ/E/Z/C` for the diagonals, each
with a Numpad alternative selected by the `hotkeysNumpad` setting. Every one of those is
registered against `tabs.out`. The map tab is therefore free, and `registerHotkey` already
takes a tab argument, so the scoping needs no new mechanism. Reusing the same letters means
the map is driven by the same muscle memory as the world.

**The Numpad gating will not come for free.** `registerHotkey` derives it from the action
name — `if (action && action.indexOf("move_") >= 0)` — and the map hotkeys are callbacks
with no action string, so that branch never runs. They must pass the condition explicitly
through `options.activeCondition`: `() => GameGlobals.gameState.settings.hotkeysNumpad` for
the Numpad codes and the negation for the letters. Without this, both sets would be live at
once and the setting would do nothing on the map.

## Behaviour

**Opening the map** selects the player's current sector through the same
`UIOutMapSystem.selectSector(level, x, y)` the click path uses, so the details panel, the
highlight and everything downstream behave exactly as they do for a click. If the displayed
level is not the player's level — because the level selector was used — nothing is
preselected, since the player's sector is not on screen to select.

**A direction press** looks up the neighbour with
`PositionConstants.getNeighbourPosition(pos, direction)` and selects it only if a sector
exists there and is drawn on the map. Drawn means any status other than
`MAP_SECTOR_STATUS_UNVISITED_INVISIBLE`; the `?` cells count, because the map already shows
them. Otherwise the press does nothing.

One press moves one cell. The cursor does not scan across a gap looking for the next drawn
sector: a press that jumps an arbitrary distance reads as the cursor teleporting, and
crossing a gap should take the same route the player would have to walk.

**Blank cells are never selectable.** Landing on one would confirm that a sector exists
there, which is information the map deliberately withholds.

**The cursor stays on the displayed level.** Passages are the level selector's job.

## Two defects this exposes

Both are pre-existing and only become reachable once the keyboard can move the selection.

### The map's dropdowns swallow the keys

`UIFunctions.onKeyUp` skips hotkeys when the event target is an `INPUT` or a `TEXTAREA`, so
that typing in a field is never read as a command. A `SELECT` is neither. The map tab has
two of them, `#select-header-level` and `#select-header-mapmode`. With focus in either —
which a click leaves behind — pressing `W` would both type-ahead inside the dropdown and
move the map cursor.

Add `SELECT` to that guard. It is correct for every hotkey in the game, not only these: a
focused dropdown should consume its own keys everywhere.

### Selecting does not scroll the selection into view

`selectSector` sets `selectedSector`, calls `setSelectedSector` on the map and then
`updateSector`. Nothing scrolls. Clicking never exposed this, because a click can only
reach a cell that is already visible. The keyboard is the first thing that can move the
selection somewhere the player is not looking, so on a zoomed or large level the cursor
walks off-screen and appears to vanish.

The keyboard path must scroll the newly selected cell into view. Scope the change to the
keyboard entry point rather than to `selectSector` itself, so the click path keeps its
current behaviour exactly.

The scroll container is `#mainmap-container`, the element `UIOutMapSystem` already binds a
`scroll` handler to, and the same element `centerMapOnPosition` treats as the canvas's
scrolling parent. Scroll the selected cell's `.map-overlay-cell` into view within it rather
than calling the browser's `scrollIntoView`, which would scroll the whole page.

## Risks

- **Auto-repeat.** Holding a direction repeats the key. Each repeat is one more selection,
  which is harmless here — unlike the craft dialog earlier, no press commits anything. No
  debounce is needed, but the repeat must not queue redraws faster than they complete.
- **`hotkeysEnabled`.** These are ordinary non-universal hotkeys, so turning hotkeys off in
  settings disables them, consistent with the rest of the game.
- **Phones.** No gating needed. The feature is keyboard-only, and a phone has no keyboard.
- **The `?` cells** are selectable and their details panel must not show more than the map
  already reveals. The click path already selects them, so this introduces nothing new.

## Out of scope

Moving the player. This selects map cells only. Changing level with the keyboard. Any
change to what the details panel shows. Any change to the click path's behaviour.

## Verification

Browser-driven on a fresh port, on the map tab of a save with explored terrain.

1. Opening the map preselects the player's sector.
2. Each of the eight keys moves the selection one cell in the right direction.
3. A press toward a blank or non-existent cell does nothing, and the selection stays put.
4. A `?` cell can be selected; a blank cell cannot.
5. The keys do nothing on other tabs, and the movement keys still work on the out tab.
6. With focus in the level dropdown, a direction key changes the dropdown and does NOT also
   move the cursor.
7. A selection driven off the visible area scrolls into view.
8. With hotkeys disabled in settings, none of the keys do anything.
9. Numpad variants work when `hotkeysNumpad` is on, and the letters when it is off.
