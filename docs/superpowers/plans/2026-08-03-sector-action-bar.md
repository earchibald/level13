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
- Produces: element ids `#out-sector-bar`, `#out-sector-bar-actions`, `#out-sector-bar-collectors`, `#out-collector-chip-water`, `#out-collector-chip-food`, `#out-collector-fill-water`, `#out-collector-fill-food`; CSS classes `has-actions` and `has-collectors` on `#out-sector-bar`, `is-built` on each chip, `collector-row` on the two collector `<tr>`s; new methods `UIOutLevelSystem.updateCollectors()` (returns the count of visible collector rows), `UIOutLevelSystem.updateOutActionsHeader()` and `UIOutLevelSystem.onTabChanged(tabID)`.

**The bar must contain no `h3`.** `updateLevelPageActions` toggles
`#container-tab-two-out-actions h3` — every `h3` in the container — on the
`move` feature flag. An `h3` in the bar would be governed by that flag on
desktop and by nothing at all on a phone, where Task 3 re-parents the bar out
of that container.

**Move the buttons in the markup, never at runtime.** `ActionButton.create`
wraps each `button.action` in a `.callout-container` alongside a `.btn-callout`
and a `.cooldown-reqs` div, and `UIOutElementsSystem` writes its inline
`display` onto that wrapper rather than the button. Appending a button on its
own at runtime would strand its wrapper and break the disabled-reason callout
and the cooldown overlay. This is also why the flex children of the bar's rows
and of each chip are `.callout-container` divs, not `button` elements — no CSS
rule may select the bar's buttons as direct children.

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

				// level < maxLevel, not maxLevel > 1: at the cap the game keeps the
				// arrow visible and disabled, which would leave every finished
				// collector with a permanently dead row
				let showBuild = !isBuilt && GameGlobals.playerActionsHelper.isVisible(def.buildAction);
				let showImprove = isBuilt && level < maxLevel;
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
			// unscouted dark sector still explains itself. The unlockedFeatures
			// gate stays: it is not the same test as the action's own vision
			// requirement, and keeping it makes this a pure subtraction.
			let showScavenge = isAwake;
			let showScout = isAwake && GameGlobals.gameState.unlockedFeatures.vision && GameGlobals.playerActionsHelper.isVisible("scout");
			let showSpring = isAwake && isScouted && featuresComponent.hasSpring;
			GameGlobals.uiFunctions.toggle("#out-action-sca", showScavenge);
			GameGlobals.uiFunctions.toggle("#out-action-scout", showScout);
			GameGlobals.uiFunctions.toggle("#out-action-use-spring", showSpring);
			$("#out-sector-bar").toggleClass("has-actions", showScavenge || showScout || showSpring);
```

Then, at the very **end** of `updateLevelPageActions` (after the existing
`toggle("#out-improvements table", ...)` line), add:

```javascript
			this.updateOutActionsHeader();
```

- [ ] **Step 8b: Toggle the emptied Search heading**

`#out-actions` has lost its three unconditional buttons and every child left in
it is conditional, so the heading can end up over an empty box. Nothing toggles
`#header-out-actions` today. Add this method immediately after
`updateLevelPageActionsSlow`:

```javascript
		// #out-actions lost its unconditional buttons to the sector bar, so the
		// heading has to follow the box's contents. The children are
		// .callout-container wrappers, not the buttons themselves.
		updateOutActionsHeader: function () {
			GameGlobals.uiFunctions.toggle("#header-out-actions", $("#out-actions").children(":visible").length > 0);
		},

```

Rest, Wait and Despair are toggled from `updateLevelPageActionsSlow`, not from
`updateLevelPageActions`, so the header must be recomputed there too. Add the
same call as the last line of `updateLevelPageActionsSlow`:

```javascript
			this.updateOutActionsHeader();
```

- [ ] **Step 8c: Recompute on tab change**

`UIFunctions.setTab` force-shows every `.tabbutton` matching the new tab, and
`#out-action-sca` is one. Nothing in this system listens for a tab change, so
Scavenge can reappear while `has-actions` still says otherwise. Add this
listener at the end of `initListeners` (beside the existing
`GlobalSignals.add(this, GlobalSignals.collectorCollectedSignal, ...)` line):

```javascript
			GlobalSignals.add(this, GlobalSignals.tabChangedSignal, this.onTabChanged);
```

and this method immediately before `updateLevelPageActions`:

```javascript
		// setTab force-shows #out-action-sca (a .tabbutton for this tab) without
		// telling anyone, so the bar's own state has to be recomputed after it
		onTabChanged: function (tabID) {
			if (tabID !== GameGlobals.uiFunctions.elementIDs.tabs.out) return;
			if (!this.playerLocationNodes.head) return;
			this.updateLevelPageActions();
		},

```

The `tabID` guard is load-bearing: `updateLevelPageActions` dereferences
`this.playerLocationNodes.head` with no null check, and tab changes happen in
camp.

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
grep -c "updateOutActionsHeader" src/game/systems/ui/UIOutLevelSystem.js
grep -c "onTabChanged" src/game/systems/ui/UIOutLevelSystem.js
grep -c "<h3" index.html
```

Expected: no matches for the first two greps; `updateOutActionsHeader` appears
3 times (definition plus two call sites); `onTabChanged` appears 2 times
(listener plus definition). Then confirm the bar has no heading:

```bash
python3 - <<'PY'
import re
s = open('index.html').read()
i = s.index('id="out-sector-bar"')
j = s.index('id="header-out-actions"')
print('h3 inside bar:', s[i:j].count('<h3'))
PY
```

Expected: `h3 inside bar: 0`.

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

- [ ] **Step 3b: Observe the bar for resizes**

The bar changes height on its own — Scout leaves when a sector is scouted, a
chip appears when a collector is built, both rows empty while the player is
down — without resizing anything the observer already watches. Without this
the measured bottom height goes stale and the log pill sits over the bar.

In `addToEngine`, find:

```javascript
				let mapElement = document.getElementById("out-container-compass");
				if (headerElement) this.headerResizeObserver.observe(headerElement);
				if (tabsElement) this.headerResizeObserver.observe(tabsElement);
				if (mapElement) this.headerResizeObserver.observe(mapElement);
```

Replace with:

```javascript
				let mapElement = document.getElementById("out-container-compass");
				// the action bar's own height changes with the sector - scout
				// leaving, a collector chip appearing - without resizing anything
				// else, so it is a layout metric in its own right
				let barElement = document.getElementById("out-sector-bar");
				if (headerElement) this.headerResizeObserver.observe(headerElement);
				if (tabsElement) this.headerResizeObserver.observe(tabsElement);
				if (mapElement) this.headerResizeObserver.observe(mapElement);
				if (barElement) this.headerResizeObserver.observe(barElement);
```

- [ ] **Step 3c: Re-run the layout when a feature unlocks**

Unlocking scouting shows the map panel
(`UIOutLevelSystem.updateUnlockedFeatures` toggles `#out-container-compass` on
`unlockedFeatures.scout`), which changes both the shell column's shape and the
height the log pill must clear. Nothing reruns `updateLayout` at that moment,
so two things go stale until the next move or tab switch: the measured bottom
height, and the `out-map-hidden` class that gives the bar the home-indicator
inset while it is the last band. On a notched iPhone that leaves roughly 34px
of dead strip between the bar's buttons and the map.

In `initListeners`, after the existing
`GlobalSignals.add(this, GlobalSignals.levelTypeRevealedSignal, this.onLevelTypeRevealed);`
line, add:

```javascript
			GlobalSignals.add(this, GlobalSignals.featureUnlockedSignal, this.onFeatureUnlocked);
```

Then add this method immediately before `updateLayoutMode`:

```javascript
		// unlocking scouting shows the map panel, which changes the shell column's
		// shape and the height the log pill has to clear - and nothing else reruns
		// the layout at that moment
		onFeatureUnlocked: function () {
			this.updateLayout();
		},

```

- [ ] **Step 3d: Record why DOM order is load-bearing**

`#out-container-compass` carries `order: 2` and the docked override does not
reset it, while every other child of `#unit-main` is `order: 0`. The map
therefore renders last whatever the DOM order is — but the rule that suppresses
its top border is an adjacent-sibling selector, which is DOM-based. The two
agree today. If they ever diverge, the layout would still *look* right while
the seam silently grew a double border, with the position clue removed.

In `css/modules/mobile.less`, find the divider-suppression rule added by Task 3
and extend its comment. Replace:

```less
// One continuous surface: the panel drops its own edge whenever a VISIBLE bar
// sits above it. Keyed on the visibility classes, not on the element, so a
// hidden bar leaves the panel's divider intact.
```

with:

```less
// One continuous surface: the panel drops its own edge whenever a VISIBLE bar
// sits above it. Keyed on the visibility classes, not on the element, so a
// hidden bar leaves the panel's divider intact.
//
// This selector is DOM-based, but the panel's position is not: it carries
// `order: 2` while every other child of #unit-main is 0, so it renders last
// whatever the DOM says. Keep updateSectorBarPlacement inserting the bar
// BEFORE the panel - if the two ever disagree the column still looks right
// and this rule silently stops matching, leaving a double border at the seam.
```

- [ ] **Step 4: Verify the JS parses and the old name is gone**

```bash
node --check src/game/systems/ui/UIOutHeaderSystem.js
grep -rn "l13-out-map-height" src/
grep -c "headerResizeObserver.observe" src/game/systems/ui/UIOutHeaderSystem.js
grep -c "onFeatureUnlocked" src/game/systems/ui/UIOutHeaderSystem.js
grep -c "getBottomChromeHeight" src/game/systems/ui/UIOutHeaderSystem.js
```

Expected: `node --check` exits 0; the first grep returns nothing; the observe
count is `5`; `onFeatureUnlocked` appears `2` times (listener plus definition);
`getBottomChromeHeight` appears `3` times (definition plus two call sites).

The observe count is 5, not 4: `addToEngine` holds four calls after this change
(header, tabs, map, bar) and `updateChromeGrouping` holds a fifth, pre-existing
one that observes `#mobile-chrome` when it builds that wrapper.

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

### Task 6: Close the browser-pass and final-review findings

**Files:**
- Modify: `strings/strings.json` (`ui.exploration` block)
- Modify: `index.html` (the two chip collect-all buttons)
- Modify: `css/modules/mobile.less` (`SECTOR ACTION BAR` section)
- Modify: `css/modules/base-classes.less:254`
- Modify: `src/game/systems/ui/UIOutHeaderSystem.js`
- Modify: `src/game/systems/ui/UIOutLevelSystem.js`
- Modify: `css/main.css` (generated), `changelog.json`, `src/config.js`, `changelog.html`, `sw.js`

**Interfaces:**
- Consumes: everything Tasks 1-5 produced.
- Produces: string key `ui.exploration.collect_all_short_label`; method `UIOutHeaderSystem.updateBottomChromeState(isShell)`.

Six findings, then the release bump. Five come from the final whole-branch
review and the controller's browser pass; one is the user's original brief.

- [ ] **Step 1: Give the collector icons their colour**

The user's brief asked for "a blue or red icon". `img/res-water.png` and
`img/res-food.png` are monochrome by the game's art direction, so the chip
currently shows a grey dot and grey chevrons. Mask the existing sprite and let
the chip supply the colour — this keeps the game's own iconography and needs no
new art.

In `css/modules/mobile.less`, replace the `.collector-chip-icon` rule:

```less
.collector-chip-icon {
	width: 16px;
	height: 16px;
	flex: 0 0 auto;
	// the res-*.png sprites are monochrome, so a filter cannot tint them - mask
	// the sprite instead and paint the colour behind it
	-webkit-mask-image: var(--l13-chip-mask);
	mask-image: var(--l13-chip-mask);
	-webkit-mask-size: contain;
	mask-size: contain;
	-webkit-mask-repeat: no-repeat;
	mask-repeat: no-repeat;
	-webkit-mask-position: center;
	mask-position: center;
	background-color: var(--l13-chip-color);
}

// mid-tone so it reads on the dark, dusky and sunlit themes alike
#out-collector-chip-water .collector-chip-icon {
	--l13-chip-mask: url(../img/res-water.png);
	--l13-chip-color: #5a9fd4;
}

#out-collector-chip-food .collector-chip-icon {
	--l13-chip-mask: url(../img/res-food.png);
	--l13-chip-color: #c65a4a;
}
```

The `url()` is relative to `css/main.css`, so `../img/` resolves to the
repository's `img/` directory. Do not make it absolute — this fork is served
from a GitHub Pages project path.

- [ ] **Step 2: Fit the two chips on one row**

Measured on a 390px phone: each chip is 236px against 380px available, so they
wrap and the bar costs 186px instead of 120px. The cause is not the label text
— `button { width: 95pt }` is global and `button.btn-narrow { width: 80pt }`
pins the collect button at ~105px regardless of its content. Both a scoped
width override and a shorter label are needed.

First add the string. In `strings/strings.json`, in the `ui.exploration`
object, immediately after the `collect_all_resources_label` entry, add:

```json
    "collect_all_short_label": "all",
```

Match the surrounding indentation exactly. `strings/strings-fi.json` does not
define the long key either and falls back, so it needs no change.

Then in `index.html`, on **both** chip collect-all buttons —
`#out-action-use-bucket` and `#out-action-use-trap` — change

```
data-text-key="ui.exploration.collect_all_resources_label"
```

to

```
data-text-key="ui.exploration.collect_all_short_label"
```

Change nothing else about those buttons: same ids, same `action` attributes,
same classes. The full action name still appears in each button's callout.

Then in `css/modules/mobile.less`, append to the `SECTOR ACTION BAR` section:

```less
// The chip is a compact widget, but `button { width: 95pt }` (80pt via
// btn-narrow) is sized for a full-width action list and makes two chips
// impossible to fit on one phone row. Size these to their content instead.
#out-sector-bar .collector-chip button.action {
	width: auto;
	min-width: 3.5em;
	padding: 8px 10px;
	margin: 0;
}
```

- [ ] **Step 3: Make `out-map-hidden` correct by design**

`UIOutHeaderSystem` is added to the engine before `UIOutLevelSystem` and both
run at the default priority, so on `featureUnlockedSignal` the header's
`onFeatureUnlocked` → `updateLayout` runs **first** and reads
`#out-container-compass` as still hidden — stamping `out-map-hidden` on at the
one moment it should come off. Today what repairs it is an incidental
ResizeObserver bounce. Make the next-frame pass own the class too.

In `UIOutHeaderSystem.js`, add this method immediately after
`getBottomChromeHeight`:

```javascript
		// The class and the height are two views of one fact, so they are set
		// together. updateLayout runs inside the featureUnlockedSignal dispatch,
		// BEFORE UIOutLevelSystem reveals the map panel, so the first pass reads
		// the map as still hidden and the next-frame pass is what gets it right.
		// Both callers therefore run both halves.
		updateBottomChromeState: function (isShell) {
			$("#unit-main").toggleClass("out-map-hidden", isShell && !$("#out-container-compass").is(":visible"));
			document.documentElement.style.setProperty("--l13-out-bottom-height", this.getBottomChromeHeight(isShell) + "px");
		},

```

In `updateLayout`, replace these lines:

```javascript
			document.documentElement.style.setProperty("--l13-out-bottom-height", this.getBottomChromeHeight(isShell) + "px");
```

and the separate `out-map-hidden` toggle line that follows the placement calls,
with a single call:

```javascript
			this.updateBottomChromeState(isShell);
```

Keep the surrounding comment about the log pill. Then replace the body of
`updateMeasurements` so it uses the same method:

```javascript
		updateMeasurements: function () {
			let isShell = this.elements.body.hasClass("layout-small") && this.isShellLayout();
			this.updateBottomChromeState(isShell);
		},
```

- [ ] **Step 4: Hide the emptied Search box, not just its heading**

`#out-actions` carries `.actionbox`'s `margin: 6px 0; padding: 3px 0`, so an
emptied section still holds 12-18px under a hidden heading. Toggle the box with
its heading. In `UIOutLevelSystem.js`, replace the body of
`updateOutActionsHeader`:

```javascript
		updateOutActionsHeader: function () {
			let $movement = $("#container-out-actions-movement-related");
			let numVisible = $("#out-actions")
				.find("button.action")
				.not("#container-out-actions-movement-related button")
				.not("[data-visible='false']")
				.length;

			// the movement-related span is slide-toggled rather than toggled, so it
			// carries no data-visible of its own
			if (numVisible === 0 && $movement.children().length > 0 && $movement.css("display") !== "none") {
				numVisible++;
			}

			// the box keeps .actionbox's margin and padding when empty, so it goes
			// with the heading rather than leaving a gap under it
			GameGlobals.uiFunctions.toggle("#header-out-actions", numVisible > 0);
			GameGlobals.uiFunctions.toggle("#out-actions", numVisible > 0);
		},
```

- [ ] **Step 5: Delete the dead `.list-storage` rule**

The collector rows lost that cell in Task 1 and no `.list-storage` element
survives anywhere. In `css/modules/base-classes.less`, change:

```less
td.list-amount, td.list-storage {
```

to:

```less
td.list-amount {
```

Leave the declarations inside the rule untouched — `.list-amount` is still used
by the tribe, upgrades and embark tables.

- [ ] **Step 6: Record why the ResizeObserver bounce matters**

In `UIOutHeaderSystem.js`, extend the comment on the `barElement` observe call
added in Task 4:

```javascript
				// the action bar's own height changes with the sector - scout
				// leaving, a collector chip appearing - without resizing anything
				// else, so it is a layout metric in its own right.
				//
				// This also gives the shell a second layout pass whenever the bar
				// resizes, which is a self-damping single bounce: updateLayout can
				// change the bar's padding through out-map-hidden, but the next
				// pass's toggleClass is then a no-op. Do not "optimise" the second
				// pass away - see updateBottomChromeState.
				let barElement = document.getElementById("out-sector-bar");
```

- [ ] **Step 7: Verify**

```bash
node --check src/game/systems/ui/UIOutHeaderSystem.js
node --check src/game/systems/ui/UIOutLevelSystem.js
python3 -c "import json; d=json.load(open('strings/strings.json')); print(d['ui']['exploration']['collect_all_short_label'])"
grep -c "collect_all_short_label" index.html
grep -c "list-storage" css/modules/base-classes.less
grep -c "updateBottomChromeState" src/game/systems/ui/UIOutHeaderSystem.js
npx -p less lessc css/main.less css/main.css
grep -c "l13-chip-mask" css/main.css
```

Expected: both `node --check` exit 0 silently; the JSON print is `all`; the
`index.html` count is `2`; the `base-classes.less` count is `0`;
`updateBottomChromeState` appears **`4`** times — the definition, two call
sites, and the Step 6 comment that names it; `lessc` exits 0 (its two
`vision.less` deprecation warnings are pre-existing); the `l13-chip-mask` count
is greater than 0.

Also confirm the width override survived compilation, since it is what lets the
two chips share a row:

```bash
grep -c "collector-chip button.action" css/main.css
```

Expected: at least `1`.

- [ ] **Step 8: Bump to 0.6.3.m32**

Add a new first entry to the `versions` array in `changelog.json`:

```json
   {
    "version": "0.6.3.m32",
    "requiredVersion": "0.6.1",
    "phase": "beta",
    "final": true,
    "released": "2026-08-03",
    "changes": [
     {
      "type": "UI",
      "summary": "The bucket and trap now show a blue or red resource icon, and both fit on one row above the map"
     }
    ]
   },
```

Then:

```bash
sed -i '' 's/0\.6\.3\.m31/0.6.3.m32/g' src/config.js index.html changelog.html sw.js
grep -c "0\.6\.3\.m31" src/config.js index.html changelog.html sw.js
grep -c "0\.6\.3\.m32" src/config.js index.html changelog.html sw.js
```

Expected: the first grep reports `0` for all four files; the second reports
`src/config.js:1`, `index.html:3`, `changelog.html:3`, `sw.js:1`.
`changelog.json` keeps its historical `m31` entry.

The `sed` runs over `index.html`, which Step 2 also edits — run Step 2 first so
both changes land, and confirm `grep -c "collect_all_short_label" index.html`
still reports `2` afterwards.

- [ ] **Step 9: Commit**

```bash
git add strings/strings.json index.html css/modules/mobile.less css/modules/base-classes.less css/main.css src/game/systems/ui/UIOutHeaderSystem.js src/game/systems/ui/UIOutLevelSystem.js changelog.json src/config.js changelog.html sw.js
git commit -m "Colour the collector icons, fit both chips on one row, and close the review findings"
```

---

### Task 7: Actually fit the two chips, and cache-bust the strings file

**Files:**
- Modify: `css/modules/mobile.less` (`SECTOR ACTION BAR` section)
- Modify: `src/text/TextLoader.js:63-77`
- Modify: `css/main.css` (generated), `changelog.json`, `src/config.js`, `index.html`, `changelog.html`, `sw.js`

Task 6's width override was measured in the browser and is **not sufficient**:
each chip still comes out at 209px, so two need 424px against the 380px a
390px phone offers, and they still wrap. Two further savings close the gap.
A second, unrelated defect surfaced during the same measurement.

- [ ] **Step 1: Recover the wrapper margin and tighten the button**

Measured breakdown of a 209px chip: icon 16, fill readout 45, and two
`.callout-container` wrappers of 68 each. Each wrapper is a 56px button plus
12px of side margin contributed by `.container-btn-action`. That margin is
plain spacing — not a tap halo; the button itself is 56×44 and already meets
the touch target — and the chip's own `gap` already separates the controls.

In `css/modules/mobile.less`, in the `SECTOR ACTION BAR` section, replace the
rule added by Task 6:

```less
#out-sector-bar .collector-chip button.action {
	width: auto;
	min-width: 3em;
	padding: 8px 10px;
	margin: 0;
}

// Each button wrapper adds 6px of side margin, so the pair costs 24px per chip
// - which is the whole difference between the two chips sharing a row and
// wrapping onto two. The chip's own gap already separates them. Safe to drop:
// this is spacing, not a hit halo. The button stays 44px tall, and the compact
// "1" button keeps the ::after halo it already had.
#out-sector-bar .collector-chip .container-btn-action {
	margin: 0;
}

#out-sector-bar .collector-chip {
	gap: 6px;
}
```

Measured result with this rule: chip 176px, so two plus the row gap come to
358px against 380px — 22px of headroom for a wider fill readout such as
`18.5 / 40`.

- [ ] **Step 2: Cache-bust `strings/strings.json`**

`strings.json` is the only asset the game fetches with no cache-buster:
`src/config.js` `urlArgs` covers every requirejs module and the `?v=` queries
cover the CSS, but `TextLoader.loadTextsFile` calls `$.getJSON` on a bare path
and only disables caching for debug builds. Adding a new string key therefore
lands new code beside a possibly stale strings file, and the button renders its
raw key — `ui.exploration.collect_all_short_label` — instead of its text. This
was reproduced: a fresh fetch of the file has the key, the browser's cached copy
does not, and `Text.hasKey` returns false.

Reuse requirejs's own `urlArgs` so this moves with the existing release ritual
and adds no sixth thing to bump. In `src/text/TextLoader.js`, replace the body
of `loadTextsFile`:

```javascript
            loadTextsFile: function (source) {
                return new Promise((resolve, reject) => {
                    var url = source.source;
                    // The one asset requirejs does not cache-bust for us. Without
                    // this a release lands new code beside a stale strings file and
                    // any newly added key renders as its raw key on screen. Reuse
                    // the loader's own urlArgs so it moves with every version bump
                    // rather than becoming another thing to remember.
                    var urlArgs = null;
                    try {
                        urlArgs = requirejs.s.contexts._.config.urlArgs;
                    } catch (e) {
                        urlArgs = null;
                    }
                    if (urlArgs) url += (url.indexOf("?") >= 0 ? "&" : "?") + urlArgs;
                    log.i("Loading texts: " + url);
                    if (GameConstants.isDebugVersion) $.ajaxSetup({ cache: false });
                    $.getJSON(url, function (json) {
                        Text.setTexts(source.language, json);
                        resolve();
                    })
                    .fail(function (jqxhr, textStatus, error) {
                        log.e("Failed to load texts: " + error);
                        reject();
                    });
                });
            },
```

The `try`/`catch` matters: `requirejs.s` is an internal, and a missing one must
degrade to today's behaviour rather than throwing during boot.

- [ ] **Step 3: Verify**

```bash
node --check src/text/TextLoader.js
npx -p less lessc css/main.less css/main.css
grep -c "container-btn-action" css/main.css
grep -c "urlArgs" src/text/TextLoader.js
```

Expected: `node --check` exits 0 silently; `lessc` exits 0 (its two
`vision.less` deprecation warnings are pre-existing); the
`container-btn-action` count is 2 or more; the `urlArgs` count is 2.

- [ ] **Step 4: Bump to 0.6.3.m33**

Add a new first entry to the `versions` array in `changelog.json`, matching the
indentation of its neighbours:

```json
   {
    "version": "0.6.3.m33",
    "requiredVersion": "0.6.1",
    "phase": "beta",
    "final": true,
    "released": "2026-08-03",
    "changes": [
     {
      "type": "BUGFIX",
      "summary": "The bucket and trap now really do fit on one row, and a new text label can no longer show up as its raw key after an update"
     }
    ]
   },
```

Then:

```bash
sed -i '' 's/0\.6\.3\.m32/0.6.3.m33/g' src/config.js index.html changelog.html sw.js
grep -c "0\.6\.3\.m32" src/config.js index.html changelog.html sw.js
grep -c "0\.6\.3\.m33" src/config.js index.html changelog.html sw.js
```

Expected: the first grep reports `0` for all four files; the second reports
`src/config.js:1`, `index.html:3`, `changelog.html:3`, `sw.js:1`.

- [ ] **Step 5: Commit**

```bash
git add css/modules/mobile.less css/main.css src/text/TextLoader.js changelog.json src/config.js index.html changelog.html sw.js
git commit -m "Fit both collector chips on one row and cache-bust the strings file"
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
13. A hazard sector — scavenge, scout, refill and all four collect actions are
    affected by hazards while build and improve are exempt, so the whole bar
    goes disabled at once while the buttons left in the scrolling section stay
    live. Confirm that reads as deliberate rather than broken.
14. A scouted sector with nothing else to do — the "Search" heading is gone
    along with its empty box.
15. Build a collector, then take its upgrade — the row disappears once the
    collector is at the cap, rather than leaving a permanently disabled arrow.
