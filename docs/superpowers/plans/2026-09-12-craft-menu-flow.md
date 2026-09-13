# Craft menu flow (hotkey K) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `K` craft popup as a two-level chooser menu that shares its code with the `B` Buildings menu, and fix the stale "unavailable after crafting" row.

**Architecture:** Lift the generic half of the Buildings popup out of `UIOutCampSystem.js` into a new `UIChooserPopup` helper driven by a config object. `UIOutCampSystem` and `UIOutBagSystem` each construct one instance and supply entries, row sub-text, tooltip content and the press. The craft popup's markup and CSS take the Buildings popup's shape; row classes become `chooser-popup-*`.

**Tech Stack:** RequireJS AMD modules, jQuery, Ash entity system, LESS compiled to `css/main.css`, `node build.js` bundle.

Spec: `docs/superpowers/specs/2026-09-12-craft-menu-flow-design.md`.

## Global Constraints

- Work only in `~/Worktrees/level13-gh-pages-mobile` on branch `gh-pages-mobile`. Never edit `~/work/level13` (master).
- Every JS edit ends with `node --check <file>`; after the last one run `node build.js` and commit `build/level13-app.js`.
- Edit LESS, never `css/main.css`; recompile with `npx -p less lessc css/main.less css/main.css` and commit both.
- Version `0.6.3.m129`: bump `changelog.json` top entry, `urlArgs` in `src/config.js`, the three `?v=` links in `index.html` and `changelog.html`, and `CACHE_VERSION` in `sw.js`, all in the release commit.
- Buildings menu behaviour must not change (spec `2026-09-12-camp-build-menu-flow-design.md`).
- No test framework. Verify in the browser harness (`mtest2.html`, fresh port per JS change) or with Playwright.

---

## File map

| File | Change |
|---|---|
| `src/game/helpers/ui/UIChooserPopup.js` | Create. Generic two-level chooser popup. |
| `src/game/systems/ui/UIOutCampSystem.js` | Replace lines 830-1620 (BUILDINGS POPUP section) with a config-driven use of the helper. |
| `src/game/systems/ui/UIOutBagSystem.js` | Replace lines 66-290 (craft popup) with a config-driven use of the helper. Forward `popupOpenedSignal`, `inventoryChangedSignal`, `slowUpdateSignal`. |
| `index.html` | Rebuild `#craft-popup` (lines 1123-1133) in the Buildings shape; rename `#buildings-tooltip` to `#chooser-tooltip` (line 907). |
| `css/modules/elements-special.less` | Rename `buildings-popup-*` row classes to `chooser-popup-*`; drop `craft-popup-*` rules (899-947, 1211-1215); duplicate the id-scoped rules for `#craft-popup-*`. |
| `css/modules/vis.less` | `#buildings-tooltip` → `#chooser-tooltip`, `.buildings-tooltip-header` → `.chooser-tooltip-header` (lines 108, 129, 192, 197, 201). |
| `changelog.json`, `src/config.js`, `index.html`, `changelog.html`, `sw.js` | m129 stamps. |

---

### Task 1: Create `UIChooserPopup` by lifting the Buildings code

**Files:**
- Create: `src/game/helpers/ui/UIChooserPopup.js`
- Read: `src/game/systems/ui/UIOutCampSystem.js:830-1620`

**Interfaces — Produces:**

```js
// define(['ash', 'text/Text', 'game/GameGlobals', 'game/constants/UIConstants'], ...)
// returns a constructor:
let popup = new UIChooserPopup({
	popupID: "buildings-popup",         // element ids inside are popupID + "-" + part
	screens: [ "build", "improve", "action" ],   // list screens, in menu order
	titles: { build: "Build", improve: "Improve", action: "Action" },
	verbs: { build: "build", improve: "improve", action: "do" },   // hint line verb
	menuLetters: { KeyB: 0, KeyI: 1, KeyA: 2 }, // extra chooser keys; digits are always on
	openKey: { code: "KeyB", tab: GameGlobals.uiFunctions.elementIDs.tabs.in }, // keydown opener; tab null = any
	toggleLabel: "Show unavailable",   // checkbox label prefix; "(n)" is appended
	canOpen: () => bool,               // owner guard, called after the shared guards
	beforeOpen: () => bool,            // e.g. showTabById; false aborts the open
	getEntries: (screen) => entries,   // "menu" or a list screen
	renderRowSub: (entry, screen) => html,        // sub-text under the name, "" for none
	renderRowDetail: (entry, screen) => html|null, // right column; null = costs or reason badge
	showResources: (screen) => bool,   // the stock line above the list
	emptyText: (screen) => string,
	getTooltipContent: (index, screen, entry) => $el|null, // -2 header help, -1 checkbox
	press: (entry, screen) => bool,    // false = flash unavailable
	onClosed: () => void,              // optional owner hook
});
popup.init();                 // bind DOM once, at construction of the owner
popup.open(screen);           // screen optional, defaults to "menu"
popup.close();
popup.isOpen;                 // bool
popup.screen;                 // "menu" or a list screen id
popup.renderList();           // re-render keeping cursor by key (slow update, signals)
popup.onPopupOpened(popupID); // owner forwards popupOpenedSignal
popup.onPopupClosed(popupID); // owner forwards popupClosedSignal
```

Entry shape (all screens): `{ key, name, action, available, hidden, reason, isBusy, isCooldown, cooldownLeft, ...owner fields }`. Menu entries add `{ screen, letter, count, description }`.

Generic behaviour the helper keeps from the Buildings code (names mapped: `buildingsPopupX` → `this.x`, `BuildingsPopup` → ``, `#buildings-popup-*` → `"#" + popupID + "-*"`, CSS classes `buildings-popup-*` → `chooser-popup-*`, `#buildings-tooltip` → `#chooser-tooltip`, `buildings-tooltip-header` → `chooser-tooltip-header`):

- `open`: shared guards (uiStatus.isHidden, hasOpenPopup, already open) then `canOpen()`, `beforeOpen()`; showSpecialPopup with `setupCallback`; bind `keydown.<popupID>`; the Esc keyup capture swallow.
- `close`, `onPopupClosed` (reopen pattern), `onPopupOpened` (step aside), `isVisible`.
- `showScreen`, `back`, `renderList(cursor)`, `renderResources(rows)`, `setCursor`, `getPageSize`.
- `onKeyDown`: Esc/shift-Esc, arrows, Home/End, PgUp/PgDn, Enter, Backspace/ArrowLeft back, ArrowRight open, Space toggle, `menuLetters` and digits on the menu, digits on lists.
- `toggleShowHidden`, `activateRow(retries)` (menu → `showScreen(entry.screen)`; list → `press()` then `renderList()`; false → `flashUnavailable`).
- Tooltip: `cancelTooltip`, `hideTooltip`, `showTooltip(index)` calling `getTooltipContent`; hover/mousemove/mouseleave/ⓘ click bindings; scroll hides.
- Keydown opener bound as `keydown.<popupID>open` on document: same guards as `onDocumentKeyDownBuildings` with `openKey.code` and `openKey.tab`.
- Header help text `#<popupID>-header-hint-text` set to "tap for help"/"hover for details".

Row rendering: the menu row shows `entry.letter || number` badge, name, `count` in `header-count`. List rows show number badge, name + `renderRowSub`, then `renderRowDetail` or the default (reason badge when `!available && (hidden || isBusy || isCooldown)`, else `getActionCostsSpanList(entry.action)`), then the touch ⓘ.

Keep `renderResources` as is, gated by `showResources(screen)`.

- [ ] **Step 1:** Write the module. Check syntax: `node --check src/game/helpers/ui/UIChooserPopup.js`.
- [ ] **Step 2:** Commit: `git commit -m "Add UIChooserPopup: the Buildings menu's generic half as a helper"`.

---

### Task 2: Move the Buildings menu onto the helper

**Files:**
- Modify: `src/game/systems/ui/UIOutCampSystem.js:830-1620`, signal handlers at 58-71, 132, 160-167, the `initBuildingsPopup` call in the constructor path, and the `define` list.
- Modify: `css/modules/elements-special.less` (row classes), `css/modules/vis.less` (tooltip id), `index.html:907`.

**Interfaces — Consumes:** Task 1's constructor and methods.

- [ ] **Step 1:** Add `'game/helpers/ui/UIChooserPopup'` to the define list.
- [ ] **Step 2:** Replace `initBuildingsPopup` with construction of `this.buildingsPopup = new UIChooserPopup({...})` using the config above; `getEntries: screen => this.getBuildingsPopupEntries(screen)`, `press: entry => { let $btn = entry.$btn; if (!(entry.available && $btn && $btn.length > 0 && $btn.is(":visible") && !$btn.hasClass("btn-disabled"))) return false; $btn.click(); return true; }`, `canOpen: () => this.playerLocationNodes.head && this.playerPosNodes.head && this.playerPosNodes.head.position.inCamp`, `beforeOpen: () => GameGlobals.uiFunctions.showTabById(tabs.in)`, `showResources: s => s == "build" || s == "improve"`, `emptyText` per screen, `renderRowSub` with the three sub-text branches, `renderRowDetail: () => null`, `getTooltipContent: (index, screen, entry) => this.getBuildingsTooltipContent(index, screen, entry)`.
- [ ] **Step 3:** Keep `getBuildingsMenuEntries`, `getBuildingsEntryStatus`, `getBuildingsBuildEntries`, `getBuildingsImproveEntries`, `getBuildingsActionEntries`, `getBuildingsPopupEntries`, `updateBuildingsMenuHint`. Rewrite `getBuildingsTooltipContent(index, screen, entry)` to take the entry instead of reading `this.buildingsPopupRows`, and use `chooser-tooltip-header`/`chooser-popup-*` class names. Delete everything else in the section.
- [ ] **Step 4:** `onOpenBuildingsPopup: function (screen) { this.buildingsPopup.open(screen); }`; `onPopupClosed`/`onPopupOpened` forward; slow update calls `if (this.buildingsPopup.isOpen) this.buildingsPopup.renderList();`.
- [ ] **Step 5:** CSS: in `elements-special.less` rename `.buildings-popup-row|-menu-row|-key|-item-name|-item-sub|-item-costs|-item-reason|-item-unavailable|-item-hidden|-info|-empty|-flash|-resource|-resource-amount` to `.chooser-popup-*`. Id rules (`#buildings-popup-*`) stay. In `vis.less` rename the tooltip id and header class. In `index.html:907` rename the pane id.
- [ ] **Step 6:** `node --check` both JS files; `npx -p less lessc css/main.less css/main.css`; `node build.js`.
- [ ] **Step 7:** Browser regression (spec test 8): B opens; A opens Action; B B 3 presses; Esc backs; shift-Esc closes; hover shows `#chooser-tooltip`.
- [ ] **Step 8:** Commit: `git commit -m "Buildings menu: drive the popup through UIChooserPopup"`.

---

### Task 3: Rebuild the craft popup on the helper

**Files:**
- Modify: `src/game/systems/ui/UIOutBagSystem.js:66-290`, signals at 37-44, `define` list.
- Modify: `index.html:1123-1133`.
- Modify: `css/modules/elements-special.less` (drop `craft-popup-*`, add `#craft-popup-*` id rules mirroring `#buildings-popup-*`, add `&:not(.layout-small) #craft-popup` width).

**Interfaces — Consumes:** Task 1.

- [ ] **Step 1:** `index.html`: replace `#craft-popup` with the Buildings markup, ids `craft-popup-header-row`, `craft-popup-back`, `craft-popup-header` (text "Craft" + `<span id="craft-popup-header-screen">`), `craft-popup-header-hint` + `-text`, `craft-popup-toggle-container` with `craft-popup-show-unavailable` + `-label`, `craft-popup-resources`, `craft-popup-list`, `craft-popup-hint-menu`, `craft-popup-hint-list` with `craft-popup-hint-verb`, `craft-popup-close`. Add `popup-nopause`.
- [ ] **Step 2:** `UIOutBagSystem.js`: add the helper to the define list; `GlobalSignals.add(this, GlobalSignals.popupOpenedSignal, this.onPopupOpened)`. Replace `initCraftPopup` … `openCraftConfirmation` with:

```js
CRAFT_TYPE_ORDER: Object.keys(ItemConstants.itemTypes) — computed in initCraftPopup from getCraftableItemDefinitionsByType()

initCraftPopup: function () {
	let sys = this;
	let types = Object.keys(this.getCraftableItemDefinitionsByType()).filter(t => sys.getCraftableItemDefinitionsByType()[t].length > 0);
	let titles = {}, verbs = {}, emptyTexts = {};
	for (let t of types) { titles[t] = ItemConstants.getItemTypeDisplayName(ItemConstants.itemTypes[t], true); verbs[t] = "craft"; }
	this.craftPopup = new UIChooserPopup({
		popupID: "craft-popup", screens: types, titles: titles, verbs: verbs, menuLetters: {},
		openKey: { code: "KeyK", tab: null },
		toggleLabel: "Show obsolete",
		canOpen: () => true,
		beforeOpen: () => GameGlobals.uiFunctions.showTabById(GameGlobals.uiFunctions.elementIDs.tabs.bag),
		getEntries: screen => screen == "menu" ? sys.getCraftMenuEntries() : sys.getCraftListEntries(screen),
		renderRowSub: (entry, screen) => screen == "menu" ? "" : sys.getCraftRowSub(entry),
		renderRowDetail: () => null,
		showResources: screen => screen != "menu",
		emptyText: screen => "No known recipes.",
		getTooltipContent: (index, screen, entry) => sys.getCraftTooltipContent(index, screen, entry),
		press: entry => sys.pressCraftEntry(entry),
	});
	this.craftPopup.init();
},
```

  Menu entries: for each type in `types`, the visible (unlocked, not obsolete) count; skip count 0; `{ key: "type-" + t, screen: t, letter: null, name: titles[t], count, description: "Recipes for " + name.toLowerCase(), available: true, hidden: false }`.

  List entries: recipes sorted by `UIConstants.sortItemsByRelevance`, unlocked only; status via `checkRequirements` (busy = `DISABLED_REASON_BUSY` or `_IN_PROGRESS`), `available = checkAvailability`, `hidden = isObsolete`, `reason` = "Crafting… " + timeLeft when busy on this craft, "Busy" for other busy, "obsolete" when obsolete, else the translated reason. Owned: `itemsComponent.getCountById(id, inCamp)`; equipped: `itemsComponent.getEquipped(type).some(i => i.id == id)`.

  `getCraftRowSub`: `equipped` / `owned N` / `""`.

  `pressCraftEntry`: `if (!checkAvailability(action)) return false; startAction(action, entry.itemDefinition.id); return true;`.

  `getCraftTooltipContent`: -2 help (keys), -1 checkbox text, menu entry (name, count, key), recipe (name + badge, `ItemConstants.getItemDescription`, `UIConstants.getItemBonusDescription(item, false)`, owned/equipped line, costs, blocker, key hint "N or enter: craft").

- [ ] **Step 3:** `onOpenCraftPopup: function () { this.craftPopup.open(); }`; `onPopupOpened(id)`/`onPopupClosed(id)` forward; `slowUpdate` and `onInventoryChanged` call `if (this.craftPopup.isOpen) this.craftPopup.renderList();` (before the tab guard in `onInventoryChanged`).
- [ ] **Step 4:** CSS: delete `craft-popup-*` rules; add `#craft-popup-header-row`, `-header-screen`, `-back`, `-header-hint(:hover)`, `-resources`, `-list`, `-toggle-container(.selected)` by extending the `#buildings-popup-*` selectors to comma lists; add `#craft-popup` to the `&:not(.layout-small)` width rule.
- [ ] **Step 5:** `node --check`; lessc; `node build.js`.
- [ ] **Step 6:** Browser checks (spec tests 1-7), especially: craft a lockpick, see "Crafting…", pump 3 s, see the row available with owned +1, craft again.
- [ ] **Step 7:** Commit: `git commit -m "Craft menu: two-level chooser on UIChooserPopup, no confirmation, live re-render"`.

---

### Task 4: Release m129

**Files:** `changelog.json`, `src/config.js:37`, `index.html:32-34`, `changelog.html:15-17`, `sw.js` (`CACHE_VERSION`).

- [ ] **Step 1:** Add the top `changelog.json` entry `0.6.3.m129`, released `2026-09-12`, changes: UI "The K craft menu is a two-level chooser like the Buildings menu: a number picks an item type, a number crafts a recipe, the list stays open and shows crafting time"; BUGFIX "A recipe crafted from the K menu no longer stays greyed out until the menu is reopened".
- [ ] **Step 2:** `sed -i '' 's/0\.6\.3\.m128/0.6.3.m129/g' src/config.js index.html changelog.html sw.js`; confirm with grep.
- [ ] **Step 3:** `node build.js`; commit `"Craft menu on the shared chooser popup (v0.6.3.m129)"`.
- [ ] **Step 4:** `git push origin gh-pages-mobile && git push mobile gh-pages-mobile`; poll `curl -fsS https://earchibald.github.io/level13-mobile/src/config.js | grep -o 'v=0.6.3.m[0-9]*'` until m129.
