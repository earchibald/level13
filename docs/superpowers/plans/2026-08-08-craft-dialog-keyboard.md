# Keyboard Craft Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the keyboard-driven craft dialog and the Manage inventory (I) and Show map (P) hotkeys from `gh-pages` onto `gh-pages-mobile`, the unified branch.

**Architecture:** A hand-port. The dialog itself transfers verbatim into `src/game/systems/ui/UIOutBagSystem.js`, which this branch has never modified since the merge base. The four supporting pieces — a signal, three `UIFunctions` helpers, the popup markup, and the LESS — are hand-written, because `index.html` and `UIFunctions.js` have diverged from `gh-pages` by 269 and 714 lines. The dialog is a closed unit: its only inbound edge is `openCraftPopupSignal`, its only outbound edges are `startAction` and the popup manager.

**Tech Stack:** Vanilla JS in AMD modules (requirejs), jQuery, Ash ECS, LESS compiled to a single `css/main.css`.

**Spec:** `docs/superpowers/specs/2026-08-08-craft-dialog-keyboard-design.md`

## Global Constraints

- **Never hand-edit `css/main.css`.** Edit the LESS under `css/modules/`, then recompile from the repo root with `npx -p less lessc css/main.less css/main.css`. Commit both.
- **Run `node --check <file>` after the LAST edit to a JS file, not before.** A syntax error means the AMD module never defines and the game shows a blank screen rather than a broken feature.
- **Serve from a fresh port after every JS or CSS edit.** Modules are cached per `?v=` value, so re-testing on a used port silently runs the old code. Assert the change is present (`fn.toString().includes("someNewIdentifier")`) before trusting any result.
- **There is no test framework.** Every check in this plan is a browser assertion run through the harness. Run it before the change to see it fail, and after to see it pass.
- Current version is `0.6.3.m57`. The final task bumps to `0.6.3.m58`.
- Do not modify the existing mobile per-item craft dialog (`showCraftPopup`, `isCraftButton`, `getCraftPopupMessage` in `UIFunctions.js`). It stays as it is.

## Harness Setup

Every task's verification uses this. Run it once per task, on a **new** port number.

```bash
cd /Users/earchibald/Worktrees/level13-gh-pages-mobile
PORT=8500   # increment for every task
python3 -m http.server $PORT --bind 127.0.0.1 >/dev/null 2>&1 &
```

Seed the save into the origin before loading the harness. Navigate a browser tab to
`http://127.0.0.1:$PORT/offline.html` and run:

```js
const x = new XMLHttpRequest(); x.open('GET','/usersave.txt',false); x.send();
localStorage.setItem('save-default', x.responseText.trim());
localStorage.setItem('save', x.responseText.trim());
```

Then navigate to `http://127.0.0.1:$PORT/mtest2.html` and **wait ~30 s** for boot. Reach the
game with:

```js
const w = document.querySelector('iframe').contentWindow;
const gg = w.require('game/GameGlobals');
gg.uiFunctions.showGame();
gg.gameState.settings.hotkeysEnabled = true;
```

The save starts outside camp on level 11 with the bag unlocked. To put the player in camp:

```js
const pos = gg.playerActionFunctions.playerPositionNodes.head.position;
pos.level = 12; pos.sectorX = -8; pos.sectorY = 3; pos.inCamp = true;
```

## File Structure

| File | Responsibility |
|---|---|
| `src/game/GlobalSignals.js` | Declare `openCraftPopupSignal`, the hotkey's only coupling to the bag system |
| `src/game/UIFunctions.js` | Tab/inventory navigation helpers, cost rendering, hotkey registration |
| `src/game/systems/ui/UIOutBagSystem.js` | The dialog: build, cursor, keys, fold, flash, confirmation |
| `index.html` | `#craft-popup` markup; the Craft button in the bag tab |
| `css/modules/elements-special.less` | Dialog row, selection and flash styles |
| `css/main.css` | Compiled output — never edited by hand |

---

### Task 1: Signal and UIFunctions helpers

None of these three helpers exist on this branch. Everything later depends on them.

**Files:**
- Modify: `src/game/GlobalSignals.js:21`
- Modify: `src/game/UIFunctions.js` (add three methods)

**Interfaces:**
- Consumes: nothing
- Produces:
  - `GlobalSignals.openCraftPopupSignal` — `Ash.Signals.Signal`, dispatched with no arguments
  - `UIFunctions.showTabById(tabID: string): boolean` — switches to the tab, returns `false` if the tab element is absent or `data-visible != "true"`
  - `UIFunctions.showInventoryContext(): void` — jumps to the bag tab and opens the manage-inventory popup
  - `UIFunctions.getActionCostsSpanList(action: string): string[]` — one `<span>` string per cost, carrying `action-cost-blocker` when unaffordable

- [ ] **Step 1: Write the failing check**

Boot the harness (new port, see Harness Setup) and run:

```js
const w = document.querySelector('iframe').contentWindow;
const gg = w.require('game/GameGlobals');
const GS = w.require('game/GlobalSignals');
({
  signal: typeof GS.openCraftPopupSignal,
  showTabById: typeof gg.uiFunctions.showTabById,
  showInventoryContext: typeof gg.uiFunctions.showInventoryContext,
  getActionCostsSpanList: typeof gg.uiFunctions.getActionCostsSpanList,
})
```

- [ ] **Step 2: Run it to confirm it fails**

Expected: `{signal: "undefined", showTabById: "undefined", showInventoryContext: "undefined", getActionCostsSpanList: "undefined"}`

- [ ] **Step 3: Add the signal**

In `src/game/GlobalSignals.js`, directly after the `popupClosedSignal` line:

```js
		openCraftPopupSignal: new Ash.Signals.Signal(),
```

- [ ] **Step 4: Add the three helpers**

In `src/game/UIFunctions.js`, immediately before `triggerBackToCamp: function () {`:

```js
			// switch to a tab by id; false when the tab is not available yet, so callers
			// can do nothing rather than jump somewhere unlocked
			showTabById: function (tabID) {
				let $tab = $("#switch-tabs li#" + tabID);
				if ($tab.length == 0) return false;
				if ($tab.attr("data-visible") != "true") return false;
				if ($("#switch-tabs li.selected")[0] != $tab[0]) {
					$tab[0].click();
				}
				this.scrollToTabTop();
				return true;
			},

			showInventoryContext: function () {
				if (this.popupManager.hasOpenPopup()) return;
				if (!this.showTabById(this.elementIDs.tabs.bag)) return;
				// same popup as the bag tab's manage inventory button
				GameGlobals.playerActionFunctions.startInventoryManagement();
			},

			// costs of an action as span strings, color coded like the button callouts
			getActionCostsSpanList: function (action) {
				let costs = GameGlobals.playerActionsHelper.getCosts(action);
				let costKeys = costs ? Object.keys(costs) : [];
				let result = [];
				for (let i = 0; i < costKeys.length; i++) {
					let key = costKeys[i];
					let costFraction = GameGlobals.playerActionsHelper.checkCost(action, key);
					let costClass = costFraction < 1 ? "action-cost action-cost-blocker" : "action-cost";
					result.push("<span class='" + costClass + "'>" + UIConstants.getCostDisplayName(key).toLowerCase() + ": " + UIConstants.getDisplayValue(costs[key]) + "</span>");
				}
				return result;
			},
```

- [ ] **Step 5: Check syntax**

```bash
node --check src/game/UIFunctions.js && node --check src/game/GlobalSignals.js && echo SYNTAX_OK
```

Expected: `SYNTAX_OK`

- [ ] **Step 6: Re-run the check on a fresh port**

The four `typeof` values must now be `"object"`, `"function"`, `"function"`, `"function"`.
Then confirm the behaviour:

```js
gg.uiFunctions.showTabById("switch-map")            // true, and the map tab opens
gg.uiFunctions.showTabById("switch-does-not-exist") // false
gg.uiFunctions.getActionCostsSpanList("craft_light_torch").length > 0  // true
```

- [ ] **Step 7: Commit**

```bash
git add src/game/GlobalSignals.js src/game/UIFunctions.js
git commit -m "Add the tab, inventory and cost helpers the craft dialog needs"
```

---

### Task 2: Dialog markup and styles

The dialog is inert until Task 3, but it must render and be styled first so Task 3 has
something to fill.

**Files:**
- Modify: `index.html` (add `#craft-popup` before `#settings-popup` at line 1067)
- Modify: `css/modules/elements-special.less` (append)
- Modify: `css/main.css` (recompiled, never hand-edited)

**Interfaces:**
- Consumes: nothing
- Produces: DOM ids `#craft-popup`, `#craft-popup-header`, `#craft-popup-obsolete-container`, `#craft-popup-show-obsolete`, `#craft-popup-list`, `#craft-popup-close`; CSS classes `craft-popup-row`, `craft-popup-header`, `header-count`, `craft-popup-item-name`, `craft-popup-item-costs`, `craft-popup-item-unavailable`, `craft-popup-flash`, and `selected` on rows and on the obsolete container

- [ ] **Step 1: Write the failing check**

```js
const w = document.querySelector('iframe').contentWindow;
({ popup: !!w.document.getElementById('craft-popup'),
   list:  !!w.document.getElementById('craft-popup-list') })
```

- [ ] **Step 2: Run it to confirm it fails**

Expected: `{popup: false, list: false}`

- [ ] **Step 3: Add the markup**

In `index.html`, immediately before the `<div id="settings-popup"` line:

```html
		<div id="craft-popup" role="dialog" class="popup fill-on-mobiles hidden-by-default popup-ingame" style="display: none" aria-labelledby="craft-popup-header" aria-modal="true">
			<h3 id="craft-popup-header" class="text-key" data-text-key="ui.inventory.craft_item_header"></h3>
			<span class="settings-entry" id="craft-popup-obsolete-container">
				<input type="checkbox" class="checkbox" id="craft-popup-show-obsolete" /><p class="checkbox-label" id="craft-popup-show-obsolete-label">Show obsolete</p>
			</span>
			<div id="craft-popup-list" class="scrollable-container"></div>
			<p class="p-meta">arrows: navigate and fold &middot; enter: craft &middot; esc: close</p>
			<div class="buttonbox">
				<button id="craft-popup-close" class="button-popup-default">Close</button>
			</div>
		</div>

```

The `ui.inventory.craft_item_header` key already exists in `strings/strings.json` and reads
"Craft". No string changes are needed.

- [ ] **Step 4: Append the styles**

At the end of `css/modules/elements-special.less`:

```less
// CRAFT POPUP (hotkey K)

#craft-popup-list {
	min-width: 280px;
	max-height: 55vh;
	overflow-y: auto;
	text-align: left;
	margin: 10px 0;
}

.craft-popup-row {
	padding: 2px 6px;
	cursor: pointer;
	border: 1px solid transparent;
}

.craft-popup-row.selected {
	border-color: @color-border-strong;
	background: @color-bg-box-1;
}

.craft-popup-header {
	font-weight: bold;
	margin-top: 4px;
}

.craft-popup-header .header-count {
	color: @color-text-meta;
	font-weight: normal;
}

.craft-popup-item-costs {
	margin-left: 8px;
	color: @color-text-meta;
	font-size: @font-size-small;
}

.craft-popup-item-unavailable .craft-popup-item-name {
	color: @color-text-meta;
}

// the show obsolete toggle is part of the keyboard navigation (cursor -1)
#craft-popup-obsolete-container {
	padding: 2px 6px;
	border: 1px solid transparent;
}

#craft-popup-obsolete-container.selected {
	border-color: @color-border-strong;
	background: @color-bg-box-1;
}

// brief highlight when trying to craft without sufficient materials
.craft-popup-row.craft-popup-flash .craft-popup-item-name,
.craft-popup-row.craft-popup-flash span.action-cost-blocker {
	color: @color-global-warning;
	font-weight: bold;
}
```

All five variables (`@color-border-strong`, `@color-bg-box-1`, `@color-text-meta`,
`@font-size-small`, `@color-global-warning`) are already defined on this branch.

- [ ] **Step 5: Recompile the CSS**

```bash
npx -p less lessc css/main.less css/main.css && grep -c "craft-popup-row" css/main.css
```

Expected: a count of at least `2` (the rules are emitted once per theme block).

- [ ] **Step 6: Verify on a fresh port**

The check from Step 1 must return `{popup: true, list: true}`. Then open the empty dialog
and confirm it is styled and centred:

```js
gg.uiFunctions.showSpecialPopup("craft-popup", { isMeta: false, isDismissable: true });
```

Take a screenshot to confirm — `getComputedStyle` lies about any property with a CSS
transition in this harness.

Close it again with `gg.uiFunctions.popupManager.closePopup("craft-popup")`.

- [ ] **Step 7: Commit**

```bash
git add index.html css/modules/elements-special.less css/main.css
git commit -m "Add the craft dialog markup and styles"
```

---

### Task 3: The dialog itself

**Files:**
- Modify: `src/game/systems/ui/UIOutBagSystem.js` (insert the ported block; extend `addToEngine` and `initElements`)

**Interfaces:**
- Consumes: `GlobalSignals.openCraftPopupSignal`, `UIFunctions.showTabById`, `UIFunctions.getActionCostsSpanList`, `UIFunctions.showSpecialPopup`, and the ids and classes from Task 2
- Produces: `UIOutBagSystem.onOpenCraftPopup()`, `UIOutBagSystem.initCraftPopup()`, and the instance state `craftPopupCursor` (number, `-1` is the obsolete toggle), `craftPopupRows` (array of `{rowType: "header"|"item", itemType: string, itemDefinition?: object}`), `craftPopupCollapsedTypes` (object keyed by item type), `craftPopupReopen` (boolean)

- [ ] **Step 1: Write the failing check**

```js
const w = document.querySelector('iframe').contentWindow;
const GS = w.require('game/GlobalSignals');
GS.openCraftPopupSignal.dispatch();
// after a moment
w.$('#craft-popup:visible').length   // want 1
```

- [ ] **Step 2: Run it to confirm it fails**

Expected: `0` — nothing listens to the signal yet.

- [ ] **Step 3: Extract the ported block**

Do not retype this by hand. Take it from git, exactly:

```bash
git show gh-pages:src/game/systems/ui/UIOutBagSystem.js | sed -n '65,271p' > /tmp/craft-block.js
wc -l /tmp/craft-block.js   # expect 207
```

That block contains, in order: `initCraftPopup`, `onOpenCraftPopup`, `onPopupClosed`,
`rebuildCraftPopupList`, `setCraftPopupCursor`, `onCraftPopupKeyDown`,
`setCraftPopupSectionCollapsed`, `activateCraftPopupRow`, `flashCraftPopupUnavailable`,
`openCraftConfirmation`.

- [ ] **Step 4: Insert it**

Paste the 207 lines into `src/game/systems/ui/UIOutBagSystem.js` immediately before
`initItemSlots: function () {`. It needs no edits: every helper it calls
(`getCraftableItemDefinitionsByType`, `isItemUnlocked`, `isObsolete`,
`UIConstants.sortItemsByRelevance`, `ItemConstants.getItemTypeDisplayName`,
`ItemConstants.getItemDisplayName`) already exists on this branch, and all six modules it
references are already in this file's `define` list.

- [ ] **Step 5: Subscribe to the two signals**

In `addToEngine`, after the `clearBubblesSignal` line:

```js
			GlobalSignals.add(this, GlobalSignals.openCraftPopupSignal, this.onOpenCraftPopup);
			GlobalSignals.add(this, GlobalSignals.popupClosedSignal, this.onPopupClosed);
```

- [ ] **Step 6: Call the initialiser**

In `initElements`, after the `#btn-bag-autoequip` line:

```js
			this.initCraftPopup();
```

- [ ] **Step 7: Check syntax**

```bash
node --check src/game/systems/ui/UIOutBagSystem.js && echo SYNTAX_OK
```

Expected: `SYNTAX_OK`

- [ ] **Step 8: Verify on a fresh port**

Confirm the new code is actually loaded before trusting anything:

```js
gg.uiFunctions.popupManager && w.require('game/GlobalSignals').openCraftPopupSignal.numListeners > 0
```

Then walk the dialog. Put the player in camp first (see Harness Setup) so recipes are
affordable.

```js
const GS = w.require('game/GlobalSignals');
const d  = w.document;
GS.openCraftPopupSignal.dispatch();
```

After the fade, check each of these:

| Check | Expected |
|---|---|
| `w.$('#craft-popup:visible').length` | `1` |
| `d.querySelectorAll('.craft-popup-row').length` | `> 0` |
| `d.querySelectorAll('.craft-popup-header').length` | `> 0`, one per item type |
| `d.querySelectorAll('.craft-popup-row.selected').length` | `1` |

Drive the keys with real events on `document`, which is where `keydown.craftpopup` is
bound:

```js
const key = (code) => d.dispatchEvent(new w.KeyboardEvent('keydown', { code, bubbles: true }));
key('ArrowDown'); // cursor moves down one row
key('ArrowUp');   // and back
key('ArrowLeft'); // folds the section under the cursor
key('ArrowRight');// unfolds it, cursor stays on the header
```

Then the three Enter cases and Esc:

- Enter on a **header** row folds it.
- Enter on an **affordable** recipe closes the list and opens the confirmation; confirming
  starts the action; cancelling reopens the list with the cursor where it was.
- Enter on an **unaffordable** recipe adds `craft-popup-flash` to that row for 1000 ms and
  starts nothing. Find one with
  `d.querySelector('.craft-popup-item-unavailable')`.
- Esc closes the dialog.

- [ ] **Step 9: Verify the Enter-leak case explicitly**

This is the one risk the spec calls out. Count `startAction` calls across a single
keydown/keyup pair on an affordable recipe:

```js
const calls = [];
const orig = gg.playerActionFunctions.startAction.bind(gg.playerActionFunctions);
gg.playerActionFunctions.startAction = (a, p) => { calls.push(a); return orig(a, p); };
// cursor on an affordable recipe, then one full keypress:
d.dispatchEvent(new w.KeyboardEvent('keydown', { code: 'Enter', keyCode: 13, bubbles: true }));
d.dispatchEvent(new w.KeyboardEvent('keyup',   { code: 'Enter', keyCode: 13, bubbles: true }));
// confirm, then:
calls.filter(a => a.indexOf('craft_') === 0).length   // MUST be 0 or 1, never 2
gg.playerActionFunctions.startAction = orig;
```

If this returns `2`, stop and report it — the fix is to port `keyDownHadPopup` from
`gh-pages` commit `5640ede6`, which is listed as backlog in the spec.

- [ ] **Step 10: Commit**

```bash
git add src/game/systems/ui/UIOutBagSystem.js
git commit -m "Port the keyboard craft dialog"
```

---

### Task 4: Hotkeys and the bag tab button

**Files:**
- Modify: `src/game/UIFunctions.js` (three `registerHotkey` calls)
- Modify: `index.html:557` (add the Craft button)
- Modify: `src/game/systems/ui/UIOutBagSystem.js` (`initElements`: two badges, one click binding)

**Interfaces:**
- Consumes: `openCraftPopupSignal`, `showTabById`, `showInventoryContext`, `onOpenCraftPopup`
- Produces: hotkeys K, I, P; DOM id `#btn-self-craft`

- [ ] **Step 1: Write the failing check**

```js
const uf = gg.uiFunctions;
({
  K: (uf.hotkeys['KeyK'] || []).map(h => h.description),
  I: (uf.hotkeys['KeyI'] || []).map(h => h.description),
  P: (uf.hotkeys['KeyP'] || []).map(h => h.description),
  button: !!w.document.getElementById('btn-self-craft'),
})
```

- [ ] **Step 2: Run it to confirm it fails**

Expected: `{K: [], I: [], P: [], button: false}`

- [ ] **Step 3: Register the hotkeys**

In `src/game/UIFunctions.js`, in `registerHotkeys`, immediately before the
`this.registerHotkey("Dismiss popup", ...)` line:

```js
				this.registerHotkey("Show map", "KeyP", defaultModifier, null, false, false, () => GameGlobals.uiFunctions.showTabById(GameGlobals.uiFunctions.elementIDs.tabs.map));
				this.registerHotkey("Craft", "KeyK", defaultModifier, null, false, false, () => GlobalSignals.openCraftPopupSignal.dispatch());
				this.registerHotkey("Manage inventory", "KeyI", defaultModifier, null, false, false, () => GameGlobals.uiFunctions.showInventoryContext());
```

`KeyK` is also the dev-only "Pass time" cheat. `GameConstants.isCheatsEnabled` is `false`,
so that hotkey is never registered and K is free. With cheats on locally, Pass time wins
because it registers first — the same as on `gh-pages`. Leave it.

- [ ] **Step 4: Add the Craft button**

In `index.html`, inside `#self-bag-actions`, after the Manage inventory button:

```html
								<button id="btn-self-craft" class="hide-in-small-layout">Craft</button>
```

- [ ] **Step 5: Wire the button and both badges**

In `src/game/systems/ui/UIOutBagSystem.js`, in `initElements`, replace the
`#btn-self-manage-inventory` click line with:

```js
			$("#btn-self-manage-inventory").click($.proxy(this.showInventoryManageemntPopup, this));
			$("#btn-self-manage-inventory").append("<div class='hotkey-hint hide-in-small-layout'>I</div>");
			$("#btn-self-craft").click($.proxy(this.onOpenCraftPopup, this));
			$("#btn-self-craft").append("<div class='hotkey-hint hide-in-small-layout'>K</div>");
```

- [ ] **Step 6: Check syntax**

```bash
node --check src/game/UIFunctions.js && node --check src/game/systems/ui/UIOutBagSystem.js && echo SYNTAX_OK
```

Expected: `SYNTAX_OK`

- [ ] **Step 7: Verify on a fresh port**

The Step 1 check must return
`{K: ["Craft"], I: ["Manage inventory"], P: ["Show map"], button: true}`.

Then, with the player in camp and `hotkeysEnabled` true:

| Check | Expected |
|---|---|
| `gg.uiFunctions.triggerHotkey('KeyP', {})` | `true`, map tab opens |
| `gg.uiFunctions.triggerHotkey('KeyK', {})` | `true`, dialog opens on the bag tab |
| `gg.uiFunctions.triggerHotkey('KeyI', {})` | `true`, manage-inventory popup opens |
| `w.document.getElementById('btn-self-craft').click()` | dialog opens, same as K |
| badges | `#btn-self-craft` shows `K`, `#btn-self-manage-inventory` shows `I` |

Confirm K does nothing before the bag is unlocked, by faking the tab away:

```js
w.$('#switch-tabs li#switch-bag').attr('data-visible', 'false');
gg.uiFunctions.triggerHotkey('KeyK', {});
w.$('#craft-popup:visible').length   // must be 0
w.$('#switch-tabs li#switch-bag').attr('data-visible', 'true');
```

Confirm the button hides on small layout, and that the mobile tap intercept does not
swallow it. The intercept fires on capture-phase clicks on `.container-btn-action` whose
button action starts with `craft_`; `#btn-self-craft` has no `action` attribute, so it must
pass through even under `layout-small`:

```js
w.$('body').addClass('layout-small');
w.getComputedStyle(w.document.getElementById('btn-self-craft')).display  // "none"
gg.uiFunctions.isCraftButton(w.$('#btn-self-craft'))                     // false
w.$('body').removeClass('layout-small');
```

Also confirm the confirmation's own Craft button still works under `layout-small` — it is
an action button with a `craft_` action, and the intercept is only meant to skip it because
it sits inside `#common-popup`. Open the dialog, press Enter on an affordable recipe, then
click Craft in the confirmation and check the action starts.

- [ ] **Step 8: Commit**

```bash
git add src/game/UIFunctions.js index.html src/game/systems/ui/UIOutBagSystem.js
git commit -m "Add the Craft, Manage inventory and Show map hotkeys"
```

---

### Task 5: Release

**Files:**
- Modify: `src/config.js:30`
- Modify: `index.html:34`
- Modify: `changelog.json`
- Modify: `changelog.html`

**Interfaces:**
- Consumes: everything above
- Produces: a deployable `0.6.3.m58`

- [ ] **Step 1: Run the full acceptance list**

On a fresh port, with the player in camp, confirm all ten items from the spec's
Verification section:

1. K does nothing before the bag is unlocked; it opens the dialog once unlocked.
2. Recipes grouped by type, obsolete hidden, toggle present only when something is obsolete.
3. Up/Down move the cursor, including onto the toggle at `-1`; Space toggles it.
4. Left/Right fold and unfold, cursor stays on the folded header.
5. Enter on an affordable recipe opens the confirmation; confirming starts the action.
6. Enter on an unaffordable recipe flashes for 1 s and starts nothing.
7. The confirmation round-trip reopens the list with the cursor preserved.
8. Esc closes the dialog.
9. The Craft button is hidden under `layout-small`, visible otherwise, and opens the same dialog as K.
10. A single Enter keydown+keyup pair crafts exactly once, never twice.

- [ ] **Step 2: Bump the version**

`src/config.js` line 30:

```js
	urlArgs: "v=0.6.3.m58",
```

`index.html` line 34:

```html
	<link rel="stylesheet" type="text/css" href="css/main.css?v=0.6.3.m58" />
```

- [ ] **Step 3: Add the changelog entry**

Insert this as the first element of the `versions` array in `changelog.json`:

```json
    {
      "version": "0.6.3.m58",
      "requiredVersion": "0.6.1",
      "phase": "beta",
      "final": true,
      "released": "2026-08-08",
      "changes": [
        {
          "type": "UI",
          "summary": "K opens a craft dialog listing every known recipe grouped by type, navigated by the arrow keys, with a Craft button in the bag tab beside it"
        },
        {
          "type": "UI",
          "summary": "I jumps to the bag and opens manage inventory; P jumps to the map"
        }
      ]
    },
```

Then mirror the same two lines into `changelog.html`, following the markup of the
`0.6.3.m57` block directly below it.

- [ ] **Step 4: Verify the version is live**

Serve on a fresh port and confirm `requirejs` is fetching modules with `?v=0.6.3.m58`, then
check the changelog renders the new entry.

- [ ] **Step 5: Commit**

```bash
git add src/config.js index.html changelog.json changelog.html
git commit -m "Release 0.6.3.m58"
```

---

## Out of scope

Do not touch: the mobile per-item tap craft dialog; `getCraftPopupMessage`; the six backlog
items listed at the end of the spec, including the `keyDownHadPopup` reconciliation unless
Task 3 Step 9 forces it.
