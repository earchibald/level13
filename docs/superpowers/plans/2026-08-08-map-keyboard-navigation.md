# Map Keyboard Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the map's sector selection with the same eight direction keys the player walks with.

**Architecture:** All the cursor logic lives in `UIOutMapSystem`, which already owns the selection. `UIFunctions` gains eight hotkey registrations scoped to the map tab, and one fix to a guard that affects every hotkey. Two pre-existing defects are fixed because keyboard navigation is what makes them reachable.

**Tech Stack:** Vanilla JS in AMD (requirejs) modules, jQuery, Ash ECS.

**Spec:** `docs/superpowers/specs/2026-08-08-map-keyboard-navigation-design.md`

## Global Constraints

- Run `node --check <file>` after the LAST edit to a JS file, never before.
- Serve from a fresh port after every JS edit; modules are cached per `?v=`. Ports through 8513 are used.
- Never hand-edit `css/main.css`. There is no CSS in this plan.
- Do not change the click path's behaviour. `selectSector` keeps working exactly as it does.
- The cursor may only land on a sector that exists AND whose status is not `MAP_SECTOR_STATUS_UNVISITED_INVISIBLE`.
- Current version is `0.6.3.m60`. The final task bumps to `0.6.3.m61`.

## Harness Setup

Serve on a new port, seed `usersave.txt` into `localStorage` under `save-default` at `offline.html`, load `mtest2.html`, wait ~30 s, then:

```js
const w = document.querySelector('iframe').contentWindow;
const gg = w.require('game/GameGlobals');
gg.uiFunctions.showGame();
gg.gameState.settings.hotkeysEnabled = true;
const UIOutMapSystem = w.require('game/systems/ui/UIOutMapSystem');
const mapSys = gg.engine.getSystem(UIOutMapSystem);
```

Reach the map tab with `gg.uiFunctions.showTabById('switch-map')`, and remember the tab
transition takes 500 ms — read `currentTab` in a LATER tool call, never the same one.

## File Structure

| File | Responsibility |
|---|---|
| `src/game/systems/ui/UIOutMapSystem.js` | the cursor: which cell is next, whether it may be selected, scrolling it into view |
| `src/game/UIFunctions.js` | eight hotkey registrations, plus the `SELECT` guard fix |

---

### Task 1: The SELECT guard

Smallest and most independent piece. It is correct on its own merits and everything else depends on it.

**Files:**
- Modify: `src/game/UIFunctions.js`, in `onKeyUp`

**Interfaces:**
- Consumes: nothing
- Produces: hotkeys no longer fire while a `<select>` has focus

- [ ] **Step 1: Write the failing check**

On the map tab, with the level dropdown focused, confirm a hotkey still fires:

```js
const d = w.document;
const sel = d.getElementById('select-header-level');
sel.focus();
let reached = 0;
const orig = gg.uiFunctions.triggerHotkey.bind(gg.uiFunctions);
gg.uiFunctions.triggerHotkey = (c, m) => { reached++; return orig(c, m); };
sel.dispatchEvent(new w.KeyboardEvent('keyup', { code: 'KeyW', bubbles: true }));
gg.uiFunctions.triggerHotkey = orig;
reached
```

- [ ] **Step 2: Run it to confirm it fails**

Expected: `1` — the keyup reaches the hotkey handler even though a dropdown has focus.

- [ ] **Step 3: Add SELECT to the guard**

In `src/game/UIFunctions.js`, in `onKeyUp`, find:

```js
				let targetTagName = e.target ? e.target.tagName : null;
				if (targetTagName == "INPUT" || targetTagName == "TEXTAREA") return;
```

Replace with:

```js
				let targetTagName = e.target ? e.target.tagName : null;
				// SELECT too: a focused dropdown uses letters for type-ahead and arrows to
				// change its value, so a hotkey would fire on top of the dropdown's own
				// handling. The map tab's level and map mode dropdowns share keys with the
				// map cursor, where this is not theoretical
				if (targetTagName == "INPUT" || targetTagName == "TEXTAREA" || targetTagName == "SELECT") return;
```

- [ ] **Step 4: Check syntax**

```bash
node --check src/game/UIFunctions.js && echo SYNTAX_OK
```

- [ ] **Step 5: Verify on a fresh port**

The Step 1 check must now return `0`. Then confirm nothing else broke: with focus on `body`, `gg.uiFunctions.triggerHotkey('KeyP', {})` must still switch to the map tab, and a keyup dispatched on `body` must still reach the handler.

- [ ] **Step 6: Commit**

```bash
git add src/game/UIFunctions.js
git commit -m "Let a focused dropdown keep its own keys"
```

---

### Task 2: The cursor in UIOutMapSystem

**Files:**
- Modify: `src/game/systems/ui/UIOutMapSystem.js`

**Interfaces:**
- Consumes: existing `this.selectedSector`, `this.selectedLevel`, `this.playerPositionNodes`, `selectSector(level, x, y)`, `GameGlobals.levelHelper.getSectorByPosition`, `GameGlobals.uiMapHelper.getSectorStatus`, `PositionConstants.getNeighbourPosition`
- Produces:
  - `UIOutMapSystem.moveSelectionInDirection(direction: number): boolean` — steps one cell, returns whether it moved
  - `UIOutMapSystem.canSelectSectorAt(level, x, y): boolean`
  - `UIOutMapSystem.selectPlayerSectorIfOnLevel(): boolean`
  - `UIOutMapSystem.scrollSelectionIntoView(): void`

- [ ] **Step 1: Write the failing check**

```js
typeof mapSys.moveSelectionInDirection
```

- [ ] **Step 2: Run it to confirm it fails**

Expected: `"undefined"`.

- [ ] **Step 3: Add the four methods**

In `src/game/systems/ui/UIOutMapSystem.js`, immediately before `deselectSector: function () {`, insert. The file uses TABS; methods are indented with two tabs.

```js
		// KEYBOARD CURSOR
		// The map is driven with the same eight directions the player walks with. One press
		// is one cell: the cursor never scans across a gap looking for the next drawn sector,
		// because a press that jumps an arbitrary distance reads as the cursor teleporting.

		canSelectSectorAt: function (level, x, y) {
			let sector = GameGlobals.levelHelper.getSectorByPosition(level, x, y);
			if (!sector) return false;
			// a blank cell is blank on purpose - landing on one would confirm a sector is
			// there, which is exactly what the map is withholding
			let status = GameGlobals.uiMapHelper.getSectorStatus(sector);
			if (status == SectorConstants.MAP_SECTOR_STATUS_UNVISITED_INVISIBLE) return false;
			return true;
		},

		moveSelectionInDirection: function (direction) {
			if (!this.selectedSector) {
				// nothing selected yet, so start where the player is
				return this.selectPlayerSectorIfOnLevel();
			}

			let currentPos = this.selectedSector.get(PositionComponent);
			if (!currentPos) return false;

			let nextPos = PositionConstants.getNeighbourPosition(currentPos, direction);
			if (!this.canSelectSectorAt(currentPos.level, nextPos.sectorX, nextPos.sectorY)) return false;

			this.selectSector(currentPos.level, nextPos.sectorX, nextPos.sectorY);
			this.scrollSelectionIntoView();
			return true;
		},

		selectPlayerSectorIfOnLevel: function () {
			if (!this.playerPositionNodes.head) return false;
			let playerPos = this.playerPositionNodes.head.position;
			// the level selector can be showing a level the player is not on, and there is
			// nothing of theirs to select there
			if (this.selectedLevel != playerPos.level) return false;
			if (!this.canSelectSectorAt(playerPos.level, playerPos.sectorX, playerPos.sectorY)) return false;
			this.selectSector(playerPos.level, playerPos.sectorX, playerPos.sectorY);
			this.scrollSelectionIntoView();
			return true;
		},

		// a click can only reach a cell that is already on screen, so nothing needed this
		// until the keyboard could move the selection somewhere the player is not looking
		scrollSelectionIntoView: function () {
			if (!this.selectedSector) return;
			let pos = this.selectedSector.get(PositionComponent);
			if (!pos) return;
			let $cell = $(".map-overlay-cell[data-level='" + pos.level + "'][data-x='" + pos.sectorX + "'][data-y='" + pos.sectorY + "']");
			if ($cell.length == 0) return;
			let $container = $("#mainmap-container");
			if ($container.length == 0) return;

			// scroll the container, never the page: scrollIntoView would move the whole
			// document to bring a cell inside a scrolling pane into view
			let cellLeft = $cell.position().left + $container.scrollLeft();
			let cellTop = $cell.position().top + $container.scrollTop();
			let cellW = $cell.outerWidth();
			let cellH = $cell.outerHeight();
			let viewW = $container.width();
			let viewH = $container.height();
			let scrollL = $container.scrollLeft();
			let scrollT = $container.scrollTop();

			if (cellLeft < scrollL) $container.scrollLeft(cellLeft);
			else if (cellLeft + cellW > scrollL + viewW) $container.scrollLeft(cellLeft + cellW - viewW);

			if (cellTop < scrollT) $container.scrollTop(cellTop);
			else if (cellTop + cellH > scrollT + viewH) $container.scrollTop(cellTop + cellH - viewH);
		},

```

- [ ] **Step 4: Confirm the imports exist**

`PositionConstants`, `SectorConstants` and `PositionComponent` must already be in this file's `define` list and callback parameters. `PositionConstants` and `SectorConstants` are known to be there. Check `PositionComponent`:

```bash
grep -n "PositionComponent" src/game/systems/ui/UIOutMapSystem.js | head -3
```

If it is NOT in the define list, STOP and report BLOCKED rather than adding it — that list's order binds positionally to the callback parameters, and inserting into it wrongly hands every later module the wrong object.

- [ ] **Step 5: Check syntax**

```bash
node --check src/game/systems/ui/UIOutMapSystem.js && echo SYNTAX_OK
```

- [ ] **Step 6: Verify on a fresh port**

Open the map tab, then in a later call:

| Check | Expected |
|---|---|
| `mapSys.selectPlayerSectorIfOnLevel()` | `true`, and `mapSys.selectedSector` is the player's sector |
| `mapSys.moveSelectionInDirection(PositionConstants.DIRECTION_NORTH)` | `true` if a drawn sector is north, and the selection moves there |
| the same toward a blank cell | `false`, and `selectedSector` is unchanged |
| `mapSys.canSelectSectorAt(level, x, y)` on a `?` sector | `true` |

Find a blank neighbour by walking the player's neighbours and checking `getSectorStatus` against `MAP_SECTOR_STATUS_UNVISITED_INVISIBLE`.

- [ ] **Step 7: Commit**

```bash
git add src/game/systems/ui/UIOutMapSystem.js
git commit -m "Add a keyboard cursor to the map"
```

---

### Task 3: The hotkeys

**Files:**
- Modify: `src/game/UIFunctions.js`, in `registerHotkeys`

**Interfaces:**
- Consumes: `UIOutMapSystem.moveSelectionInDirection`, `PositionConstants` direction constants
- Produces: eight direction hotkeys on `tabs.map`, each in a letter and a Numpad variant

- [ ] **Step 1: Write the failing check**

```js
(gg.uiFunctions.hotkeys['KeyW'] || []).map(h => h.tab + ':' + h.description)
```

- [ ] **Step 2: Run it to confirm it fails**

Expected: only the out-tab movement entry, nothing for `switch-map`.

- [ ] **Step 3: Register them**

In `src/game/UIFunctions.js`, in `registerHotkeys`, immediately before the line `this.registerHotkey("Dismiss popup", "Escape", ...)`, insert:

```js
				// the map is driven with the same eight directions as walking. The movement
				// hotkeys are all scoped to tabs.out, so these letters are free here.
				// The numpad gating is NOT automatic: registerHotkey derives it from a
				// "move_" action name and these are callbacks, so it is passed explicitly
				// or both sets would be live at once and the setting would do nothing
				let mapDirections = [
					{ code: "KeyW", numpad: "Numpad8", dir: PositionConstants.DIRECTION_NORTH, name: "Map N" },
					{ code: "KeyA", numpad: "Numpad4", dir: PositionConstants.DIRECTION_WEST, name: "Map W" },
					{ code: "KeyS", numpad: "Numpad2", dir: PositionConstants.DIRECTION_SOUTH, name: "Map S" },
					{ code: "KeyD", numpad: "Numpad6", dir: PositionConstants.DIRECTION_EAST, name: "Map E" },
					{ code: "KeyQ", numpad: "Numpad7", dir: PositionConstants.DIRECTION_NW, name: "Map NW" },
					{ code: "KeyE", numpad: "Numpad9", dir: PositionConstants.DIRECTION_NE, name: "Map NE" },
					{ code: "KeyZ", numpad: "Numpad1", dir: PositionConstants.DIRECTION_SW, name: "Map SW" },
					{ code: "KeyC", numpad: "Numpad3", dir: PositionConstants.DIRECTION_SE, name: "Map SE" },
				];
				let useLetters = () => !GameGlobals.gameState.settings.hotkeysNumpad;
				let useNumpad = () => GameGlobals.gameState.settings.hotkeysNumpad;
				for (let i = 0; i < mapDirections.length; i++) {
					let entry = mapDirections[i];
					let move = () => GameGlobals.uiFunctions.moveMapSelection(entry.dir);
					let options = { isHiddenFromList: i > 0, activeCondition: useLetters };
					this.registerHotkey(entry.name, entry.code, defaultModifier, tabs.map, false, false, move, options);
					this.registerHotkey(entry.name, entry.numpad, defaultModifier, tabs.map, false, false, move, { isHiddenFromList: true, activeCondition: useNumpad });
				}
```

Only the first letter entry appears in the hotkey list, as one line reading "Map N" — eight near-identical rows would swamp it, the same way the tab number keys are collapsed to one entry.

- [ ] **Step 4: Add the bridge method**

`UIFunctions` must not reach into an Ash system directly in a hotkey callback, because the system list is not available until the engine is built. Add this method to `UIFunctions`, immediately before `triggerBackToCamp: function () {`:

```js
			// the map cursor lives in UIOutMapSystem; this is the hotkey's way in
			moveMapSelection: function (direction) {
				let system = GameGlobals.uiFunctions.getMapSystem();
				if (!system) return;
				system.moveSelectionInDirection(direction);
			},

			getMapSystem: function () {
				if (!this.mapSystem) {
					try { this.mapSystem = GameGlobals.engine.getSystem(UIOutMapSystem); }
					catch (ex) { return null; }
				}
				return this.mapSystem;
			},
```

This requires `UIOutMapSystem` in `UIFunctions`'s `define` list. Check first:

```bash
grep -n "UIOutMapSystem" src/game/UIFunctions.js | head -3
```

If it is absent, do NOT add it to the define list. Instead replace `getMapSystem` with a version that resolves the module lazily through requirejs, which avoids touching the positional list entirely:

```js
			getMapSystem: function () {
				if (!this.mapSystem) {
					try {
						let UIOutMapSystem = require("game/systems/ui/UIOutMapSystem");
						this.mapSystem = GameGlobals.engine.getSystem(UIOutMapSystem);
					} catch (ex) { return null; }
				}
				return this.mapSystem;
			},
```

Report which variant you used and why.

- [ ] **Step 5: Check syntax**

```bash
node --check src/game/UIFunctions.js && echo SYNTAX_OK
```

- [ ] **Step 6: Verify on a fresh port**

| Check | Expected |
|---|---|
| `KeyW` registrations | one for `switch-out`, one for `switch-map` |
| on the map tab, `triggerHotkey('KeyW', {})` | selection moves north |
| on the out tab, `triggerHotkey('KeyW', {})` | the player moves, map cursor unaffected |
| with `hotkeysNumpad` true, `KeyW` | inactive; `Numpad8` moves the cursor |
| with `hotkeysEnabled` false | neither does anything |
| the hotkey list in settings | one "Map N" row, not sixteen |

- [ ] **Step 7: Commit**

```bash
git add src/game/UIFunctions.js
git commit -m "Drive the map cursor with the walking keys"
```

---

### Task 4: Preselect on opening, and release

**Files:**
- Modify: `src/game/systems/ui/UIOutMapSystem.js` (the tab-opened path)
- Modify: `src/config.js`, `index.html`, `changelog.html`, `sw.js`, `changelog.json`

- [ ] **Step 1: Write the failing check**

Switch away from the map, deselect, switch back, and in a LATER call read `mapSys.selectedSector`.

- [ ] **Step 2: Run it to confirm it fails**

Expected: `null` — nothing is preselected.

- [ ] **Step 3: Preselect the player's sector**

The place is `onTabChanged`, which returns early for any tab other than the map. Find these two consecutive lines near its end:

```js
			this.updateMap();
			this.centerMap();
```

and insert immediately after them:

```js

			// start where the player is, as though they had clicked their own sector.
			// selectLevel above has already cleared selectedSector, and the tabProps branch
			// sets it when the caller asked for a specific sector - so this only fills in
			// the plain case of opening the map with nothing chosen
			if (!this.selectedSector) this.selectPlayerSectorIfOnLevel();
```

Note the ordering this depends on: `selectLevel(level)` earlier in the same method sets `this.selectedSector = null`, and the `if (tabProps)` branch sets it when a caller named a sector. Placing the preselect after both means an explicit request always wins and the plain case gets the player's sector. Do not move it earlier.

- [ ] **Step 4: Check syntax and verify**

```bash
node --check src/game/systems/ui/UIOutMapSystem.js && echo SYNTAX_OK
```

Then on a fresh port: opening the map preselects the player's sector; moving the cursor, leaving the tab and returning keeps the moved selection; and with the level selector on a different level, nothing is preselected.

- [ ] **Step 5: Run the full acceptance list**

All nine items from the spec's Verification section.

- [ ] **Step 6: Bump all four cache busters to `0.6.3.m61`**

`src/config.js` `urlArgs`, the `?v=` queries in `index.html` AND `changelog.html`, and `CACHE_VERSION` in `sw.js`.

```bash
grep -rn "0\.6\.3\.m60" --include=*.js --include=*.html . | grep -v "^./.git\|docs/"
```

Expected after the edits: no output.

- [ ] **Step 7: Add the changelog entry**

Insert as the FIRST element of the `versions` array in `changelog.json`, **as text**. Do not re-serialise the file with a JSON library; that reformats all 1600 lines.

```json
        {
            "version": "0.6.3.m61",
            "requiredVersion": "0.6.1",
            "phase": "beta",
            "final": true,
            "released": "2026-08-08",
            "changes": [
                {
                    "type": "UI",
                    "summary": "The map can be moved around with the same keys you walk with, starting from the sector you are standing in"
                }
            ]
        },
```

Validate:

```bash
python3 -c "import json; d=json.load(open('changelog.json')); print(d['versions'][0]['version'])"
git diff changelog.json | grep -c "^[+-]"
```

Expected: `0.6.3.m61`, and a diff count under 20.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Release 0.6.3.m61"
```

## Out of scope

Moving the player. Changing level with the keyboard. Any change to the details panel or to the click path.
