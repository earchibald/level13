# Sector Action Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep scavenge, scout, refill water and the two collector collect-actions reachable without scrolling, by moving them into a new band that sits above the pinned map panel on a phone.

**Architecture:** A new `#out-sector-bar` element lives in `index.html` inside the exploration tab's actions column. On the small layout `UIOutHeaderSystem` docks it onto `#unit-main` as a static flex child between the scrolling pane and `#out-container-compass`, the same way the map panel is already docked. Seven existing buttons move into it in the markup, so only the bar itself ever moves at runtime. Collector build buttons hide once built; a chip with a resource icon, fill level and the two collect buttons takes over.

**Tech Stack:** Vanilla ES5-style AMD modules, jQuery, LESS compiled to `css/main.css`, Ash-style entity/system framework.

**Spec:** `docs/superpowers/specs/2026-08-03-sector-action-bar-design.md`

## Global Constraints

- Branch is `gh-pages-mobile` in the worktree `/Users/earchibald/Worktrees/level13-gh-pages-mobile`. Do not switch branches. Do not push.
- **Never edit `css/main.css` by hand.** It is generated. Edit `css/modules/mobile.less`, then run `npx -p less lessc css/main.less css/main.css` from the worktree root and commit both files.
- `mtest2.html` and `mobile-test.html` are local-only test harnesses. Never stage or commit them.
- **No `position: fixed` on any new element in the small layout.** iOS stops honouring it during a momentum scroll. New bands are static flex children of `#unit-main`.
- **Any CSS `display` other than the browser default on an element that `GameGlobals.uiFunctions.toggle` shows or hides must be `!important`, and every such `!important` needs a matching entry in the `HIDE STILL MEANS HIDE` list at the end of `css/modules/mobile.less`.** jQuery writes an inline `display` that beats a stylesheet rule, and an `!important` rule in turn beats jQuery's inline `display: none`. This plan avoids the trap for all new containers by toggling them with **classes** instead of `uiFunctions.toggle`.
- The project has **no unit test framework**. Per-task verification is static: LESS compiles and round-trips, JS parses, and grep assertions on ids and selectors. A single browser verification pass over the whole feature happens at the end and is run by the controller, not by a task subagent.
- Version strings are bumped once, in the final task, to `0.6.3.m31`. Do not bump them in any earlier task.
- Existing code style: tabs for indentation, `var`/`let` as the surrounding function already uses, `GameGlobals.uiFunctions.toggle(selector, bool)` for showing and hiding buttons.

---

### Task 1: Move the controls into `#out-sector-bar` and rewire collector visibility

**Files:**
- Modify: `index.html` (exploration tab actions column, around lines 404-452)
- Modify: `src/game/systems/ui/UIOutLevelSystem.js` (`updateLevelPageActions` around line 239, `updateOutImprovementsList` line 791, `updateOutImprovementsStatus` line 822)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: element ids `#out-sector-bar`, `#out-sector-bar-actions`, `#out-sector-bar-collectors`, `#out-collector-chip-water`, `#out-collector-chip-food`, `#out-collector-fill-water`, `#out-collector-fill-food`; CSS classes `has-actions` and `has-collectors` on `#out-sector-bar`, `is-built` on each chip, `collector-row` on the two collector `<tr>`s; new method `UIOutLevelSystem.updateCollectors()` returning the count of visible collector rows.

- [ ] **Step 1: Add the bar markup to `index.html`**

In `index.html`, inside `<div class="grid tabcontainer" id="container-tab-two-out-actions" ...>`, in the `<div class="unit unit-rest">`, insert this block as the **first child**, immediately before `<div class="subheader" id="header-out-actions">`:

```html
							<div id="out-sector-bar">
								<div id="out-sector-bar-actions" class="actionbox">
									<button class="action action-location tabbutton" data-tab="switch-out" id="out-action-sca" action="scavenge">Scavenge</button>
									<button class="action action-location" id="out-action-scout" action="scout">Scout</button>
									<button class="action action-location" id="out-action-use-spring" action="use_spring">Refill water</button>
								</div>
								<div id="out-sector-bar-collectors">
									<div id="out-collector-chip-water" class="collector-chip">
										<img class="collector-chip-icon" src="img/res-water.png" alt="water" />
										<span id="out-collector-fill-water" class="collector-chip-fill vision-text"></span>
										<button class="action action-use action-location btn-narrow text-key" action="use_out_collector_water" id="out-action-use-bucket" data-text-key="ui.exploration.collect_all_resources_label"></button>
										<button class="action action-use action-location btn-compact" action="use_out_collector_water_one" id="out-action-use-bucket_one">1</button>
									</div>
									<div id="out-collector-chip-food" class="collector-chip">
										<img class="collector-chip-icon" src="img/res-food.png" alt="food" />
										<span id="out-collector-fill-food" class="collector-chip-fill vision-text"></span>
										<button class="action action-use action-location btn-narrow text-key" action="use_out_collector_food" id="out-action-use-trap" data-text-key="ui.exploration.collect_all_resources_label"></button>
										<button class="action action-use action-location btn-compact" action="use_out_collector_food_one" id="out-action-use-trap_one">1</button>
									</div>
								</div>
							</div>
```

- [ ] **Step 2: Delete the three moved buttons from `#out-actions`**

In the same file, delete exactly these three lines from `<div id="out-actions" class="actionbox">`:

```html
								<button class="action action-location tabbutton" data-tab="switch-out" id="out-action-sca" action="scavenge">Scavenge</button>
								<button class="action action-location" id="out-action-scout" action="scout">Scout</button>
```

and

```html
								<button class="action action-location" id="out-action-use-spring" action="use_spring">Refill water</button>
```

Every other button in `#out-actions` stays where it is.

- [ ] **Step 3: Rewrite the two collector rows**

Replace the two `<tr>` blocks `out-improvements-collector-water` and `out-improvements-collector-food` with:

```html
								<tr id="out-improvements-collector-water" class="collector-row">
									<td><button class="action action-build action-location text-key" action="build_out_collector_water" id="out-action-build-bucket" data-text-key="game.improvements.collector_water_name_default"></button></td>
									<td class="collector-row-label vision-text"><span></span></td>
									<td><button class='action action-improve btn-glyph-big' id="out-action-improve-bucket" action="improve_out_collector_water">▲</button></td>
								</tr><tr id="out-improvements-collector-food" class="collector-row">
									<td><button class="action action-build action-location text-key" action="build_out_collector_food" id="out-action-build-trap" data-text-key="game.improvements.collector_food_name_default"></button></td>
									<td class="collector-row-label vision-text"><span></span></td>
									<td><button class='action action-improve btn-glyph-big' id="out-action-improve-trap" action="improve_out_collector_food">▲</button></td>
								</tr>
```

The `out-improvements-beacon` and `out-improvements-camp` rows are unchanged.

- [ ] **Step 4: Verify the ids moved and did not duplicate**

Run:

```bash
for id in out-action-sca out-action-scout out-action-use-spring out-action-use-bucket out-action-use-bucket_one out-action-use-trap out-action-use-trap_one out-action-build-bucket out-action-improve-bucket; do
  printf '%s %s\n' "$(grep -c "id=\"$id\"" index.html)" "$id"
done
grep -c 'class="list-storage' index.html
```

Expected: every id count is `1`, and the `list-storage` count is `0`.

- [ ] **Step 5: Add `updateCollectors()` to `UIOutLevelSystem.js`**

Insert this method immediately before `updateOutImprovementsList` (currently line 791):

```javascript
		// The two collector rows and their bar chips. Both updateOutImprovementsList
		// and updateOutImprovementsStatus reach these elements, so the logic lives in
		// one place and both call it. Returns the number of visible rows so the
		// improvements header count stays right.
		updateCollectors: function () {
			if (!this.playerLocationNodes.head) return 0;

			let improvements = this.playerLocationNodes.head.entity.get(SectorImprovementsComponent);
			let numVisibleRows = 0;
			let numChips = 0;

			let defs = [
				{
					improvementName: improvementNames.collector_water,
					resource: resourceNames.water,
					buildAction: "build_out_collector_water",
					rowID: "#out-improvements-collector-water",
					buildID: "#out-action-build-bucket",
					improveID: "#out-action-improve-bucket",
					chipID: "#out-collector-chip-water",
					fillID: "#out-collector-fill-water",
				},
				{
					improvementName: improvementNames.collector_food,
					resource: resourceNames.food,
					buildAction: "build_out_collector_food",
					rowID: "#out-improvements-collector-food",
					buildID: "#out-action-build-trap",
					improveID: "#out-action-improve-trap",
					chipID: "#out-collector-chip-food",
					fillID: "#out-collector-fill-food",
				},
			];

			for (let i = 0; i < defs.length; i++) {
				let def = defs[i];
				let vo = improvements.getVO(def.improvementName);
				let count = vo.count;
				let isBuilt = count > 0;
				let level = improvements.getLevel(def.improvementName);
				let capacity = vo.storageCapacity[def.resource] * count;
				let maxLevel = GameGlobals.campHelper.getCurrentMaxImprovementLevel(def.improvementName);

				let showBuild = !isBuilt && GameGlobals.playerActionsHelper.isVisible(def.buildAction);
				let showImprove = isBuilt && maxLevel > 1;
				let showRow = showBuild || showImprove;

				GameGlobals.uiFunctions.toggle(def.buildID, showBuild);
				GameGlobals.uiFunctions.toggle(def.improveID, showImprove);
				GameGlobals.uiFunctions.toggle(def.rowID, showRow);
				if (showRow) numVisibleRows++;

				let $label = $(def.rowID).find(".collector-row-label");
				GameGlobals.uiFunctions.toggle($label, isBuilt);
				if (isBuilt) {
					// getImprovementDisplayName resolves the id from the name itself
					$label.find("span").text(ImprovementConstants.getImprovementDisplayName(def.improvementName, level) + " · lvl " + level);
				}

				$(def.chipID).toggleClass("is-built", isBuilt);
				if (isBuilt) numChips++;
				$(def.fillID).text(capacity > 0 ? (Math.floor(vo.storedResources[def.resource] * 10) / 10) + " / " + capacity : "");
			}

			$("#out-sector-bar").toggleClass("has-collectors", numChips > 0);

			return numVisibleRows;
		},

```

- [ ] **Step 6: Make `updateOutImprovementsList` delegate and skip the collector rows**

Replace the body of `updateOutImprovementsList` (currently lines 791-820) with:

```javascript
		updateOutImprovementsList: function (improvements) {
			if (!this.playerLocationNodes.head) return;
			if (GameGlobals.playerHelper.isInCamp()) return;
			var improvements = this.playerLocationNodes.head.entity.get(SectorImprovementsComponent);
			var uiFunctions = GameGlobals.uiFunctions;
			var numVisible = this.updateCollectors();
			$.each(this.elements.outImprovementsTR, function () {
				// the collector rows are owned by updateCollectors
				if ($(this).hasClass("collector-row")) return;

				var actionName = $(this).attr("btn-action");

				if (!actionName) {
					actionName = $(this).find("button.action-build").attr("action");
					$(this).attr("btn-action", actionName);
				}

				if (actionName) {
					let improvementName = GameGlobals.playerActionsHelper.getImprovementNameForAction(actionName);
					if (improvementName) {
						let actionVisible = GameGlobals.playerActionsHelper.isVisible(actionName);
						let existingImprovements = improvements.getCount(improvementName);
						$(this).find(".list-amount").text(existingImprovements);

						let isVisible = actionVisible || existingImprovements > 0;
						GameGlobals.uiFunctions.toggle($(this), isVisible);
						if (isVisible) numVisible++;
					}
				}
			});
			GameGlobals.uiFunctions.toggle("#header-out-improvements", numVisible > 0);
		},
```

The `toggle($(this).find(".action-use"), ...)` line is gone: the collect buttons are no longer inside a row, and their visibility is the chip's `is-built` class instead.

- [ ] **Step 7: Strip the collector code out of `updateOutImprovementsStatus`**

Replace the body of `updateOutImprovementsStatus` (currently lines 822-844) with:

```javascript
		updateOutImprovementsStatus: function () {
			if (!this.playerLocationNodes.head) return;
			var improvements = this.playerLocationNodes.head.entity.get(SectorImprovementsComponent);

			this.updateCollectors();

			let hasBeacon = improvements.getCount(improvementNames.beacon);
			GameGlobals.uiFunctions.toggle("#out-action-dismantle-beacon", hasBeacon);
		},
```

- [ ] **Step 8: Change the scout rule and set the bar's action class**

In `updateLevelPageActions`, replace these three lines (currently 268-270):

```javascript
			GameGlobals.uiFunctions.toggle("#out-action-sca", isAwake);
			GameGlobals.uiFunctions.toggle("#out-action-scout", isAwake && GameGlobals.gameState.unlockedFeatures.vision);
			GameGlobals.uiFunctions.toggle("#out-action-use-spring", isAwake && isScouted && featuresComponent.hasSpring);
```

with:

```javascript
			// isVisible("scout") is false once the sector is scouted (the action
			// requires sector.scouted: false, and DISABLED_REASON_SCOUTED blocks
			// visibility) but stays true when only light is missing, so an
			// unscouted dark sector still explains itself.
			let showScavenge = isAwake;
			let showScout = isAwake && GameGlobals.playerActionsHelper.isVisible("scout");
			let showSpring = isAwake && isScouted && featuresComponent.hasSpring;
			GameGlobals.uiFunctions.toggle("#out-action-sca", showScavenge);
			GameGlobals.uiFunctions.toggle("#out-action-scout", showScout);
			GameGlobals.uiFunctions.toggle("#out-action-use-spring", showSpring);
			$("#out-sector-bar").toggleClass("has-actions", showScavenge || showScout || showSpring);
```

- [ ] **Step 9: Import `ImprovementConstants`**

`updateCollectors` uses `ImprovementConstants`, which this module does not yet
import. `resourceNames` and `improvementNames` need no import — they are
implicit globals defined in `src/game/vos/ResourcesVO.js` and
`src/game/vos/ImprovementVO.js`.

The dependency array and the factory parameters are positional, so both must
change at the same index. In the `define([...])` array at the top of
`UIOutLevelSystem.js`, insert one line after `'game/constants/ExplorationConstants',`:

```javascript
	'game/constants/ImprovementConstants',
```

Then, in the factory parameter list, insert `ImprovementConstants,` immediately
after `ExplorationConstants,` on the same line, so that:

```javascript
	Text, MapUtils, UIList, UIState, ExceptionHandler, GameGlobals, GlobalSignals, DialogueConstants, ExplorationConstants, PlayerStatConstants, TextConstants,
```

becomes:

```javascript
	Text, MapUtils, UIList, UIState, ExceptionHandler, GameGlobals, GlobalSignals, DialogueConstants, ExplorationConstants, ImprovementConstants, PlayerStatConstants, TextConstants,
```

Verify the two lists still line up — the array entry and the parameter must be
at the same index, counting `'ash'`/`Ash` as index 0:

```bash
node -e "
const s=require('fs').readFileSync('src/game/systems/ui/UIOutLevelSystem.js','utf8');
const deps=s.slice(s.indexOf('define([')+8, s.indexOf(']')).split(',').map(x=>x.trim()).filter(Boolean);
const params=s.slice(s.indexOf('function ('), s.indexOf(') {')).replace('function (','').split(',').map(x=>x.trim()).filter(Boolean);
console.log('deps', deps.length, 'params', params.length);
console.log('ImprovementConstants at', deps.findIndex(d=>d.includes('ImprovementConstants')), params.indexOf('ImprovementConstants'));
"
```

Expected: `deps` and `params` counts are equal, and the two indices printed on
the second line are the same number.

- [ ] **Step 10: Verify the JS parses**

Run:

```bash
node --check src/game/systems/ui/UIOutLevelSystem.js
```

Expected: no output, exit 0.

- [ ] **Step 11: Verify the old selectors are gone**

Run:

```bash
grep -n "list-storage" src/game/systems/ui/UIOutLevelSystem.js
grep -n 'find(".action-use")' src/game/systems/ui/UIOutLevelSystem.js
```

Expected: no matches for either.

- [ ] **Step 12: Commit**

```bash
git add index.html src/game/systems/ui/UIOutLevelSystem.js
git commit -m "Move scavenge, scout, refill and collect actions into a sector action bar"
```

---

### Task 2: Style the bar, the chips and the simplified collector rows

**Files:**
- Modify: `css/modules/mobile.less` (collector card block around lines 1560-1616, plus a new section)
- Modify: `css/main.css` (generated — never hand-edited)

**Interfaces:**
- Consumes: the ids and classes produced by Task 1.
- Produces: the bar's unpinned appearance. Pinning is Task 3.

- [ ] **Step 1: Replace the collector card block**

In `css/modules/mobile.less`, find the block that begins with the comment `// COLLECTORS (bucket, trap): build + improve + collect all + collect one +`. Delete from that comment through the end of the rule for `#out-improvements-collector-food > td:nth-child(3) button` — that is, the card comment, the `display: grid` rule, the four `grid-area` rules, the `.list-storage` rule and the `td:nth-child(3) button` width rule. Replace all of it with:

```less
	// COLLECTORS (bucket, trap): the collect actions and the fill level now live
	// in the sector action bar, so the row is just the build button (before it is
	// built) or a name and level (after), plus the upgrade arrow.
	//
	// !important because these rows are shown and hidden through jQuery, which
	// writes an inline `display` that would otherwise beat this and drop the row
	// to `block`, stranding the arrow on its own line. The guard at the end of
	// the file keeps the hide working.
	#out-improvements tr#out-improvements-collector-water,
	#out-improvements tr#out-improvements-collector-food {
		display: flex !important;
		align-items: center;
		column-gap: 6px;
		padding: 3px 0;
		margin: 0;
	}

	#out-improvements-collector-water > .collector-row-label,
	#out-improvements-collector-food > .collector-row-label {
		flex: 1 1 auto;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
```

Leave the two `HIDE STILL MEANS HIDE` entries for these rows exactly as they are — the `!important` display is still there, so the guard is still needed.

- [ ] **Step 2: Add the bar's structure rules**

Append a new section to `css/modules/mobile.less`, immediately **before** the `// ---` divider that introduces `HIDE STILL MEANS HIDE`:

```less
// ---------------------------------------------------------------------------
// SECTOR ACTION BAR
//
// The five controls a player uses on every sector visit: scavenge, scout,
// refill water, and the two collectors' collect actions. Unprefixed, because
// the bar looks the same on both layouts - only its pinned form below is
// scoped to the small layout.
//
// Shown and hidden with classes rather than uiFunctions.toggle, so no inline
// `display` is ever written to it and none of these rules needs !important.

#out-sector-bar { display: none; }

#out-sector-bar.has-actions,
#out-sector-bar.has-collectors {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

#out-sector-bar-actions,
#out-sector-bar-collectors { display: none; }

#out-sector-bar.has-actions #out-sector-bar-actions,
#out-sector-bar.has-collectors #out-sector-bar-collectors {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: center;
	gap: 6px;
	margin: 0;
}

.collector-chip { display: none; }

.collector-chip.is-built {
	display: flex;
	align-items: center;
	gap: 4px;
}

.collector-chip-icon {
	width: 16px;
	height: 16px;
	flex: 0 0 auto;
}

.collector-chip-fill {
	white-space: nowrap;
	font-size: 0.85em;
}
```

- [ ] **Step 3: Compile the CSS**

Run from the worktree root:

```bash
npx -p less lessc css/main.less css/main.css
```

Expected: no output, exit 0, and `css/main.css` modified.

- [ ] **Step 4: Verify the compiled output carries the new rules**

Run:

```bash
grep -c "out-sector-bar" css/main.css
grep -c "collector-chip" css/main.css
grep -n "grid-template-areas" css/main.css | head
```

Expected: the first two counts are greater than 0. The third must not list any line mentioning `useall` or `out-improvements-collector` — the collector card grid is gone.

- [ ] **Step 5: Commit**

```bash
git add css/modules/mobile.less css/main.css
git commit -m "Style the sector action bar, collector chips and simplified collector rows"
```

---

### Task 3: Pin the bar in the shell column

**Files:**
- Modify: `src/game/systems/ui/UIOutHeaderSystem.js` (`updateLayout` around line 1156, new method beside `updateMapDockPlacement` around line 1242)
- Modify: `css/modules/mobile.less`
- Modify: `css/main.css` (generated)

**Interfaces:**
- Consumes: `#out-sector-bar` and its `has-actions` / `has-collectors` classes from Task 1.
- Produces: `UIOutHeaderSystem.updateSectorBarPlacement(shouldDock)`; the class `out-map-hidden` on `#unit-main`.

- [ ] **Step 1: Add `updateSectorBarPlacement`**

In `src/game/systems/ui/UIOutHeaderSystem.js`, insert this method immediately **before** `updateMapDockPlacement`:

```javascript
		// The action bar is the top half of the bottom chrome. Like the map panel
		// it is lifted out of the pane and hung off #unit-main, so the pane's own
		// scrolling cannot take it with it. It has to land BEFORE the map panel:
		// the css that removes the panel's top edge, so the two read as one block,
		// uses an adjacent-sibling selector.
		updateSectorBarPlacement: function (shouldDock) {
			let $bar = $("#out-sector-bar");
			let $unit = $("#unit-main");
			if ($bar.length === 0 || $unit.length === 0) return;

			let isDocked = $bar.parent().is($unit);
			if (shouldDock === isDocked) return;

			if (shouldDock) {
				if (!this.sectorBarHome) this.sectorBarHome = $bar.parent()[0];
				let $map = $("#out-container-compass");
				// the map may already be docked from an earlier pass, in which case
				// appending would put the bar after it
				if ($map.length > 0 && $map.parent().is($unit)) {
					$map.before($bar);
				} else {
					$unit.append($bar);
				}
			} else if (this.sectorBarHome) {
				$(this.sectorBarHome).prepend($bar);
			}
		},

```

- [ ] **Step 2: Call it from `updateLayout` and set the map-hidden marker**

In `updateLayout`, find:

```javascript
			this.updateOutControlsPlacement(isShell);
			this.updateMapDockPlacement(isShell);
```

Replace with:

```javascript
			this.updateOutControlsPlacement(isShell);
			this.updateSectorBarPlacement(isShell);
			this.updateMapDockPlacement(isShell);

			// before scouting is unlocked the map panel is hidden and the action bar
			// becomes the last element in the column, so it has to carry the bottom
			// inset instead
			$("#unit-main").toggleClass("out-map-hidden", isShell && !$("#out-container-compass").is(":visible"));
```

- [ ] **Step 3: Verify the JS parses**

```bash
node --check src/game/systems/ui/UIOutHeaderSystem.js
```

Expected: no output, exit 0.

- [ ] **Step 4: Add the pinned-form CSS**

In `css/modules/mobile.less`, append to the `SECTOR ACTION BAR` section added in Task 2:

```less
// Pinned form: a static band of the shell column, between the scrolling pane
// and the map panel. Static, never fixed - iOS drops a fixed element wherever a
// momentum scroll left it, which is why the shell locks the document and stacks
// its bands instead.
body.layout-small #unit-main > #out-sector-bar {
	position: static;
	flex: 0 0 auto;
	margin: 0;
	padding: 6px ~"calc(5px + env(safe-area-inset-right))" 6px ~"calc(5px + env(safe-area-inset-left))";
	box-sizing: border-box;
	background: var(--l13-mobile-bg);
	// the top edge of the whole bottom chrome; the map panel below gives up its
	// own edge so the two read as one panel
	border-top: 3px solid var(--l13-mobile-divider);
	box-shadow: 0 -5px 10px -2px var(--l13-mobile-divider-shadow);
}

// no map panel yet (scouting not unlocked), so the bar is the bottom edge
body.layout-small #unit-main.out-map-hidden > #out-sector-bar {
	padding-bottom: ~"calc(6px + env(safe-area-inset-bottom))";
}

// One continuous surface: the panel drops its own edge whenever a VISIBLE bar
// sits above it. Keyed on the visibility classes, not on the element, so a
// hidden bar leaves the panel's divider intact.
body.layout-small.tab-switch-out #out-sector-bar.has-actions + #out-container-compass,
body.layout-small.tab-switch-out #out-sector-bar.has-collectors + #out-container-compass {
	border-top: none;
	box-shadow: none;
}

// Docked on #unit-main the bar is outside the tab container, so setTab can no
// longer hide it - the same problem the map panel has, solved the same way.
body.layout-small:not(.tab-switch-out) #unit-main > #out-sector-bar {
	display: none !important;
}
```

- [ ] **Step 5: Give the bar a gap-free seam with the pane**

Still in `css/modules/mobile.less`, find the rule listing the shell column's children:

```less
body.layout-small #unit-main > #grid-switch-content,
body.layout-small #unit-main > #mobile-chrome,
body.layout-small #unit-main > #out-container-compass {
	margin-top: 0;
	margin-bottom: 0;
}
```

Add the bar to that selector list:

```less
body.layout-small #unit-main > #grid-switch-content,
body.layout-small #unit-main > #mobile-chrome,
body.layout-small #unit-main > #out-sector-bar,
body.layout-small #unit-main > #out-container-compass {
	margin-top: 0;
	margin-bottom: 0;
}
```

- [ ] **Step 6: Compile and verify**

```bash
npx -p less lessc css/main.less css/main.css
grep -c "out-sector-bar" css/main.css
```

Expected: exit 0, and a count higher than the one Task 2 produced.

- [ ] **Step 7: Commit**

```bash
git add src/game/systems/ui/UIOutHeaderSystem.js css/modules/mobile.less css/main.css
git commit -m "Pin the sector action bar above the map panel in the shell column"
```

---

### Task 4: Measure both bottom bands

**Files:**
- Modify: `src/game/systems/ui/UIOutHeaderSystem.js` (`updateLayout` around line 1177, `updateMeasurements` around line 1205)
- Modify: `css/modules/mobile.less` (comment at line 963, rule at line 1125)
- Modify: `css/main.css` (generated)

**Interfaces:**
- Consumes: `#out-sector-bar` docked by Task 3.
- Produces: the CSS custom property `--l13-out-bottom-height`, replacing `--l13-out-map-height`.

- [ ] **Step 1: Sum both bands in `updateLayout`**

In `updateLayout`, replace:

```javascript
			// nothing above needs a height: the column sorts that out. The floating
			// log pill is the one thing still positioned against the map panel.
			let $map = $("#out-container-compass");
			let mapHeight = isShell && $map.length > 0 && $map.is(":visible") ? Math.ceil($map.outerHeight()) : 0;
			document.documentElement.style.setProperty("--l13-out-map-height", mapHeight + "px");
```

with:

```javascript
			// nothing above needs a height: the column sorts that out. The floating
			// log pill is the one thing still positioned against the bottom chrome,
			// which is the action bar and the map panel together.
			document.documentElement.style.setProperty("--l13-out-bottom-height", this.getBottomChromeHeight(isShell) + "px");
```

- [ ] **Step 2: Add the shared measuring helper**

Insert immediately after `isShellLayout` in the same file:

```javascript
		// the action bar and the map panel are two separate bands of the shell
		// column, and the log pill has to clear both
		getBottomChromeHeight: function (isShell) {
			if (!isShell) return 0;
			let height = 0;
			$("#out-sector-bar, #out-container-compass").each(function () {
				let $el = $(this);
				if (!$el.is(":visible")) return;
				height += Math.ceil($el.outerHeight());
			});
			return height;
		},

```

- [ ] **Step 3: Use it in `updateMeasurements` too**

Replace the body of `updateMeasurements`:

```javascript
		updateMeasurements: function () {
			let isShell = this.elements.body.hasClass("layout-small") && this.isShellLayout();
			document.documentElement.style.setProperty("--l13-out-bottom-height", this.getBottomChromeHeight(isShell) + "px");
		},
```

- [ ] **Step 4: Verify the JS parses and the old name is gone**

```bash
node --check src/game/systems/ui/UIOutHeaderSystem.js
grep -rn "l13-out-map-height" src/
```

Expected: `node --check` exits 0; the grep returns nothing.

- [ ] **Step 5: Point the log pill at the new property**

In `css/modules/mobile.less`, replace:

```less
body.layout-small.tab-switch-out #btn-log-toggle {
	bottom: ~"calc(var(--l13-out-map-height, 240px) + 12px)";
}
```

with:

```less
body.layout-small.tab-switch-out #btn-log-toggle {
	bottom: ~"calc(var(--l13-out-bottom-height, 300px) + 12px)";
}
```

Then update the stale comment above `body.layout-small.tab-switch-out #out-container-compass` (currently around line 963). Replace:

```less
// measures it into --l13-out-map-height so the content and the log pill clear
```

with:

```less
// measures it, with the action bar, into --l13-out-bottom-height so the log
// pill clears
```

- [ ] **Step 6: Compile and verify**

```bash
npx -p less lessc css/main.less css/main.css
grep -rn "l13-out-map-height" css/
grep -n "l13-out-bottom-height" css/main.css
```

Expected: the first grep returns nothing; the second returns at least one line.

- [ ] **Step 7: Commit**

```bash
git add src/game/systems/ui/UIOutHeaderSystem.js css/modules/mobile.less css/main.css
git commit -m "Measure the action bar and map panel together as the bottom chrome"
```

---

### Task 5: Release bookkeeping for 0.6.3.m31

**Files:**
- Modify: `changelog.json`
- Modify: `src/config.js:30`
- Modify: `index.html:32-34`
- Modify: `changelog.html:15-17`
- Modify: `sw.js:15`

**Interfaces:**
- Consumes: nothing. This task is bookkeeping only and must be last.
- Produces: nothing.

Five separate cache busters must carry the same string in one commit. A stale `CACHE_VERSION` makes the service worker serve old assets indefinitely, and then a fresh deploy and a stale cache look identical.

- [ ] **Step 1: Add the changelog entry**

In `changelog.json`, insert a new object as the **first** element of the `versions` array, before the `0.6.3.m30` entry:

```json
   {
    "version": "0.6.3.m31",
    "requiredVersion": "0.6.1",
    "phase": "beta",
    "final": true,
    "released": "2026-08-03",
    "changes": [
     {
      "type": "UI",
      "summary": "Scavenge, scout, refill water and the bucket and trap collect actions moved into a bar above the map, so they never scroll away"
     },
     {
      "type": "UI",
      "summary": "Scout disappears once a sector is scouted, and a built bucket or trap shows its fill level and collect buttons instead of a build button"
     }
    ]
   },
```

Keep `final: true` and at least one `changes` item: `getCurrentVersion` skips entries with no changes, and `final: false` raises an unsupported-version popup. Keep `requiredVersion` a plain three-part version — only the first three dot-parts affect save compatibility.

- [ ] **Step 2: Bump the four other cache busters**

```bash
sed -i '' 's/0\.6\.3\.m30/0.6.3.m31/g' src/config.js index.html changelog.html sw.js
```

- [ ] **Step 3: Verify every site moved and none was missed**

```bash
grep -c "0\.6\.3\.m30" src/config.js index.html changelog.html sw.js
grep -c "0\.6\.3\.m31" src/config.js index.html changelog.html sw.js
```

Expected: the first command reports `0` for all four files. The second reports
`src/config.js:1` (`urlArgs`), `index.html:3` (the `?v=` link queries),
`changelog.html:3` (the same three), and `sw.js:1` (`CACHE_VERSION`) — eight
sites in total. `changelog.json` keeps its historical `0.6.3.m30` entry and is
not touched by the `sed`.

- [ ] **Step 4: Verify the changelog parses**

```bash
python3 -c "import json; d=json.load(open('changelog.json')); print(d['versions'][0]['version'] if isinstance(d,dict) else d[0][1][0]['version'])"
```

Expected: `0.6.3.m31`.

- [ ] **Step 5: Commit**

```bash
git add changelog.json src/config.js index.html changelog.html sw.js
git commit -m "Release 0.6.3.m31"
```

---

## Verification (controller, browser)

Not a subagent task. Run after Task 5, against the harness described in the
project memory: serve the worktree root and open `mtest2.html`, which loads
`index.html` in a sized iframe with a MessageChannel `requestAnimationFrame`
pump and a spoofed `visibilityState`. Reach the game through
`frame.contentWindow.require('game/GameGlobals')`. Dispatch
`GlobalSignals.windowResizedSignal` before measuring — `ResizeObserver` is
frozen in the automation tab. Screenshots force a paint, so they are the
truthful view when measurements disagree. Verify tap targets with
`document.elementFromPoint` across the control's visible box, never by
dispatching a synthetic click.

1. Unscouted sector — the bar shows Scavenge and Scout. Scout vanishes when
   scouting completes and the row reflows.
2. Unscouted but too dark — Scout is present, disabled, and still gives its
   reason on tap.
3. Scouted sector with a spring — Refill water is in the bar, not in the
   scrolling section.
4. Build a bucket — the build button leaves the Build section, the chip appears
   with `0.0 / N`, and the row shows `Bucket · lvl 1 [▲]` or disappears when no
   upgrade path exists.
5. Collect — the fill text updates without a tab switch.
6. Scroll the pane to the footer — all five controls stay put.
7. Scouting not yet unlocked — no map panel, and the bar sits on the bottom edge
   with the home-indicator inset beneath it.
8. Asleep with no collector built — the bar is hidden and the map panel shows
   its own divider again.
9. Switch tabs and back — the bar is hidden elsewhere and returns intact.
10. Open the log — the pill sits above the bar, not over it.
11. `window.scrollTo(0, 400)` then read `window.scrollY` — must be 0.
12. Cross the small-layout threshold repeatedly by resizing — the bar returns to
    its markup position, the map panel to its own, with no duplication and the
    bar always before the panel when docked.
