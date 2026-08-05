# Landscape map and three load-time defects — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Float the landscape map's sector description over the map, and fix three defects: the chrome sliding under the status bar after a rotation, the stale banner after loading a save, and the opening log message getting no toast.

**Architecture:** Four independent changes. Task 1 is CSS only. Task 2 adds a measured safe-area value and consolidates two competing inset rules. Task 3 adds a deferred re-run of the game-shown handler. Task 4 buffers toasts that arrive while the game is hidden and stops hiding the stack while the player is "down".

**Tech Stack:** RequireJS AMD modules, jQuery as a global (never an AMD dependency), Ash entity-component-system, LESS compiled to `css/main.css`.

## Global Constraints

- **Never hand-edit `css/main.css`.** Edit `css/modules/mobile.less`, then recompile with `npx -p less lessc css/main.less css/main.css` from the repository root. The round trip is byte-identical for untouched rules.
- **jQuery is an ambient global.** Never add `"jquery"` to a `define([...])` list.
- Every JavaScript file changed must pass `node --check <file>`.
- LESS needs `~"..."` escaping around `calc(...)`, `env(...)` and `min(...)` expressions that contain operators it would otherwise try to evaluate.
- Match the surrounding comment style: comments explain *why*, wrap near 78 columns, and use a lower-case sentence or a full sentence consistently with neighbours.
- Do not bump any version number. The controller does the release.
- Small layout only. No rule may change `body.layout-regular` rendering.

---

### Task 1: The landscape map panel floats over the map

**Files:**
- Modify: `css/modules/mobile.less:3252-3298` (the LANDSCAPE MAP right-column block)
- Modify: `css/modules/mobile.less:3180-3196` (the grid columns rule)
- Regenerate: `css/main.css`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing other tasks rely on.

**Background.** The portrait map tab already floats the description over the map: `body.layout-small #mainmap-sector-details-content` (around line 2568) is `position: absolute`, anchored to the control row with `bottom: 100%`, and carries the card styling — background, border, radius, shadow, padding, and a close button. Those declarations apply in landscape too, because `body.layout-small` is set in landscape mode as well. The landscape block then reverses the placement and drops the description back into the flow of a 30% rail, where it is too narrow to read.

This task removes that reversal and shrinks the rail. Nothing is added to the card's appearance; only its placement changes.

- [ ] **Step 1: Narrow the rail and make the grid a containing block**

In `css/modules/mobile.less`, find this rule (it begins after the comment block that ends `...and the column never becomes two.`):

```less
body.landscape-map.tab-switch-map #grid-switch-content {
	display: grid;
	grid-template-columns: 70fr 30fr;
```

Replace those three lines with:

```less
body.landscape-map.tab-switch-map #grid-switch-content {
	display: grid;
	// The rail holds two selects and up to seven glyph buttons and nothing
	// else, so it takes a width rather than a share. It used to take 30% of
	// the screen for a description that has moved over the map.
	grid-template-columns: minmax(0, 1fr) 152px;
	// the containing block for the description panel below: the panel has to
	// reach across into the map's column, which it cannot do while its only
	// positioned ancestor is inside the rail
	position: relative;
```

Leave the rest of that rule (the `grid-template-rows`, `flex`, `min-height`, `overflow`, `padding` and `margin-bottom` declarations, and its inner comment about `minmax(0, 1fr)`) exactly as it is.

- [ ] **Step 2: Replace the right-column comment**

Find this comment block:

```less
// ---------------------------------------------------------------------------
// The right column: the map's own controls, then the sector.
//
// The description sits in this column rather than over the map, unlike
// portrait. The column is there for the controls whether a sector is selected
// or not, so the description costs the map nothing here - and it is the one
// place on a phone where it can be read without covering the thing it
// describes.
```

Replace it with:

```less
// ---------------------------------------------------------------------------
// The right column: the map's own controls, and nothing else.
//
// The description used to sit in this column. At 30% of a phone on its side
// that is about 250px for prose with a heading and a nine-row table, and it
// was unreadable. It floats over the map now, as it already did in portrait,
// and the column keeps only the controls - which is why it can be a narrow
// rail instead of a third of the screen.
```

- [ ] **Step 3: Float the panel over the map**

Find this rule near the end of the LANDSCAPE MAP section:

```less
// back into the flow, on a row of its own under the buttons
body.landscape-map.tab-switch-map #mainmap-sector-details-content {
	position: relative;
	order: 1;
	flex: 1 0 100%;
	left: auto;
	right: auto;
	bottom: auto;
	max-height: none;
	margin: 4px 0 0 0;
}
```

Replace the whole rule, comment included, with:

```less
// Over the map, in the bottom left of its column.
//
// Absolute, not fixed. Safari clips a fixed box that lives inside a scrolling
// container, and #mainmap-sector-details is one. An absolutely positioned box
// whose containing block sits outside that scroller is not clipped by it,
// which is why Step 1 put `position: relative` on the grid and why the details
// box must stay `position: static` here.
//
// The card itself - background, border, radius, shadow, padding, and the close
// button - comes from the portrait rules above and is not repeated.
body.landscape-map.tab-switch-map #mainmap-sector-details-content {
	position: absolute;
	order: 0;
	flex: none;
	top: auto;
	right: auto;
	left: ~"calc(env(safe-area-inset-left) + 10px)";
	bottom: ~"calc(env(safe-area-inset-bottom) + 10px)";
	width: ~"min(56%, 460px)";
	max-height: ~"calc(100% - 20px)";
	margin: 0;
	overflow-y: auto;
}
```

- [ ] **Step 4: Check the details box still anchors nothing**

Find the rule immediately above the one you just replaced:

```less
body.landscape-map.tab-switch-map #mainmap-sector-details {
```

Confirm by reading that it still contains `position: static;`. Do not change it — the new panel depends on it. If it does not contain `position: static`, stop and report BLOCKED.

- [ ] **Step 5: Recompile**

Run from the repository root:

```bash
npx -p less lessc css/main.less css/main.css
```

Expected: no output, exit status 0.

- [ ] **Step 6: Verify the compiled output**

Run:

```bash
grep -n "grid-template-columns: minmax(0, 1fr) 152px" css/main.css
grep -n "min(56%, 460px)" css/main.css
grep -c "70fr 30fr" css/main.css
```

Expected: the first two each print exactly one matching line. The third prints `0`.

- [ ] **Step 7: Commit**

```bash
git add css/modules/mobile.less css/main.css
git commit -m "Float the landscape sector description over the map"
```

---

### Task 2: One measured safe-area top inset

**Files:**
- Modify: `index.html` (add the probe element)
- Modify: `css/modules/mobile.less` (probe styling; two inset rules)
- Modify: `src/game/systems/ui/UIOutHeaderSystem.js`
- Regenerate: `css/main.css`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `--l13-safe-top`, a length in px set on `document.documentElement`. No other task reads it.

**Background.** This device reports `env(safe-area-inset-top)` as 0: iOS lays the web view out below the status bar rather than under it, so there is nothing to clear. A rotation can leave the view laid out fullscreen without the inset ever changing, and the chrome ends up behind the clock until the page is reloaded. A value measured from the viewport survives that; `env()` does not.

Two rules add the top inset today and both are live in a standalone PWA — `#mobile-header` is a child of `#mobile-chrome` in the shell layout, so a device that reported a real inset would reserve it twice. This task leaves one.

- [ ] **Step 1: Add the probe element**

In `index.html`, find this line:

```html
		<div id="log-toasts" class="hidden-by-popups hidden-when-down">
```

Insert these lines immediately **before** it, at the same indentation:

```html
		<!-- A custom property that holds env(...) reads back as the literal
		     text, not a resolved length, so the inset has to be measured off a
		     real box. See updateSafeAreaTop in UIOutHeaderSystem. -->
		<div id="safe-area-probe" aria-hidden="true"></div>
```

Do not change the `#log-toasts` line itself. Task 4 changes it.

- [ ] **Step 2: Style the probe**

In `css/modules/mobile.less`, find this rule:

```less
body.layout-small.standalone #mobile-chrome {
	padding-top: ~"env(safe-area-inset-top)";
}
```

Replace it with:

```less
// The inset the chrome reserves, in one place. It used to be added here and
// again on #mobile-header, which is a child of this element in the shell
// layout - two reserves for one status bar on any device that reported a real
// inset. It never showed, because this device reports 0.
//
// var() rather than env(), because the value is measured (see
// updateSafeAreaTop): rotation can leave iOS laying the view out fullscreen
// while env() still reads 0, and the chrome ended up behind the clock until a
// reload. The env() fallback covers the frames before the first measurement.
body.layout-small #mobile-chrome {
	padding-top: ~"var(--l13-safe-top, env(safe-area-inset-top))";
}

// what updateSafeAreaTop measures. It has to be a real box with real padding,
// and it must not take a tap or paint anything.
#safe-area-probe {
	position: fixed;
	top: 0;
	left: 0;
	width: 0;
	height: 0;
	padding-top: ~"env(safe-area-inset-top)";
	visibility: hidden;
	pointer-events: none;
	z-index: -1;
}
```

Note that `.standalone` is gone from the chrome selector. That is deliberate: in a browser tab `env()` reports the right value and the measured growth term is not applied, so the single rule is correct in both cases.

- [ ] **Step 3: Drop the second inset**

In `css/modules/mobile.less`, find this declaration inside `body.layout-small #mobile-header`:

```less
	padding: ~"calc(2px + env(safe-area-inset-top))" 0 0 0;
```

Replace it with:

```less
	// the inset is reserved once, by #mobile-chrome (see APP SHELL)
	padding: 2px 0 0 0;
```

- [ ] **Step 4: Add the measurement**

In `src/game/systems/ui/UIOutHeaderSystem.js`, find the field declaration:

```js
		currentLocationNodes: null,
```

Add this line immediately after it, at the same indentation:

```js
		baselinePortraitHeight: null,
```

- [ ] **Step 5: Add updateSafeAreaTop**

In the same file, find:

```js
		updateLayoutMode: function () {
```

Insert this method immediately **before** it, at the same indentation:

```js
		// The reserve for the status bar, measured rather than read.
		//
		// This device reports env(safe-area-inset-top) as 0 and iOS lays the
		// web view out below the status bar instead. A rotation can leave the
		// view laid out fullscreen without the inset ever changing, and the
		// chrome comes to rest behind the clock until the page is reloaded.
		//
		// So take the larger of two numbers: what env() says, and how much the
		// portrait viewport has grown since the session's first portrait
		// frame. Growth in portrait is the band iOS used to leave for the
		// status bar and has stopped leaving, which is exactly what has to be
		// reserved.
		updateSafeAreaTop: function () {
			let probe = document.getElementById("safe-area-probe");
			let measured = 0;
			if (probe) {
				measured = parseFloat(window.getComputedStyle(probe).paddingTop) || 0;
			}

			let isPortrait = window.innerHeight >= window.innerWidth;

			// taken before any rotation, and never revised: a later portrait
			// height is the thing being measured, not a new baseline
			if (isPortrait && this.baselinePortraitHeight === null) {
				this.baselinePortraitHeight = window.innerHeight;
			}

			// Held to the installed app. In a browser tab the address bar
			// collapsing also grows the viewport, and that must not be read as
			// a lost status bar.
			let growth = 0;
			let isStandalone = this.elements.body.hasClass("standalone");
			if (isStandalone && isPortrait && this.baselinePortraitHeight !== null) {
				growth = Math.max(0, window.innerHeight - this.baselinePortraitHeight);
			}

			document.documentElement.style.setProperty("--l13-safe-top", Math.max(measured, growth) + "px");
		},
```

- [ ] **Step 6: Call it before anything measures the chrome**

In the same file, find:

```js
		updateMeasurements: function () {
```

The line immediately after it begins the body. Insert this as the **first** statement of that body:

```js
			// before anything measures the chrome: the chrome's height depends
			// on the padding this sets
			this.updateSafeAreaTop();
```

Then find:

```js
		updateLayout: function () {
```

Insert the same call as the **first** statement of that body too, with this comment instead:

```js
			// a rotation arrives here, and the reserve has to be right before
			// the placement passes below read any geometry
			this.updateSafeAreaTop();
```

A note, not a step: a changed reserve resizes the chrome, and the chrome is
watched by a `ResizeObserver` that calls `updateLayout`. That loop damps itself
— `setProperty` with an unchanged value is not a style change, so the second
pass writes the same string and the observer does not fire again. The same
bounce is already recorded in the comment above `headerResizeObserver`.

- [ ] **Step 7: Syntax check**

```bash
node --check src/game/systems/ui/UIOutHeaderSystem.js
```

Expected: no output, exit status 0.

- [ ] **Step 8: Recompile and verify**

```bash
npx -p less lessc css/main.less css/main.css
grep -c "env(safe-area-inset-top)" css/main.css
grep -n "l13-safe-top" css/main.css
grep -n "safe-area-probe" css/main.css
```

Expected: the count is `2` — one in the `#mobile-chrome` fallback and one on `#safe-area-probe`. Both greps print at least one line each. If the count is not 2, list every match with `grep -n` and report which rule each belongs to before continuing.

- [ ] **Step 9: Commit**

```bash
git add index.html css/modules/mobile.less css/main.css src/game/systems/ui/UIOutHeaderSystem.js
git commit -m "Measure the status bar reserve instead of reading a stale inset"
```

---

### Task 3: Finish the game-shown pass once the world exists

**Files:**
- Modify: `src/game/systems/ui/UIOutHeaderSystem.js`

**Interfaces:**
- Consumes: nothing. Task 2 also edits this file; that task is complete before this one starts, so edit the file as you find it.
- Produces: nothing other tasks rely on.

**Background.** Load a save at phone width and `#grid-location-header h1` still reads `Camp`, the literal placeholder in `index.html`. It stays wrong after the opening popup closes and until the player changes tab or moves. `onGameShown` calls `updateHeaderTexts`, which opens with `if (!this.currentLocationNodes.head) return;` — at `gameShownSignal` the node does not exist yet, so the pass bails and nothing runs it again. Several other handlers in that same batch guard on the same node.

- [ ] **Step 1: Add the flag**

In `src/game/systems/ui/UIOutHeaderSystem.js`, find the field declaration:

```js
		baselinePortraitHeight: null,
```

Add this line immediately after it, at the same indentation:

```js
		pendingGameShownRefresh: false,
```

If that field is not present, Task 2 did not land — stop and report BLOCKED.

- [ ] **Step 2: Set the flag when the pass cannot finish**

Find:

```js
		onGameShown: function () {
			this.updateTabVisibility();
```

Replace those two lines with:

```js
		onGameShown: function () {
			// A batch of one-shot passes, several of which bail while the
			// player's location node does not exist yet - and on a load from a
			// save it does not. The banner is the one that shows: it kept the
			// placeholder from index.html until the player changed tab. Ask
			// update() to run the batch again once the world is there.
			if (!this.currentLocationNodes.head) {
				this.pendingGameShownRefresh = true;
			}

			this.updateTabVisibility();
```

Leave the rest of the handler exactly as it is.

- [ ] **Step 3: Run the batch again on the first usable tick**

Find the start of the update loop:

```js
		update: function (time) {
			if (!this.currentLocationNodes.head) return;
			if (GameGlobals.gameState.uiStatus.isHidden) return;
```

Insert this immediately after those three lines:

```js

			// Both guards above have passed, so the world is there and the
			// game is showing - which is the state onGameShown wanted and did
			// not get. Cleared first, so the re-run cannot set it again and
			// loop.
			if (this.pendingGameShownRefresh) {
				this.pendingGameShownRefresh = false;
				this.onGameShown();
			}
```

- [ ] **Step 4: Syntax check**

```bash
node --check src/game/systems/ui/UIOutHeaderSystem.js
```

Expected: no output, exit status 0.

- [ ] **Step 5: Verify the guard cannot loop**

Read the `onGameShown` handler you edited and confirm both of these by inspection, then state them in your report:

1. The flag is set **only** when `this.currentLocationNodes.head` is falsy.
2. The re-run in `update()` happens **only** after `update()` has returned early on that same node being falsy.

Together those mean the re-run cannot set the flag again. If either is not true as written, stop and report BLOCKED.

- [ ] **Step 6: Commit**

```bash
git add src/game/systems/ui/UIOutHeaderSystem.js
git commit -m "Re-run the game-shown pass once the loaded world exists"
```

---

### Task 4: The opening message gets a toast

**Files:**
- Modify: `src/game/systems/ui/UIOutLogSystem.js`
- Modify: `index.html` (`#log-toasts` class list)
- Modify: `css/modules/mobile.less` (drop the `vision-step-0` card rule)
- Regenerate: `css/main.css`

**Interfaces:**
- Consumes: `UIToastStack.push(stack, text)` and the `max` field on a stack created by `UIToastStack.create` — both already used in this file.
- Produces: nothing other tasks rely on.

**Background.** Two causes, both required.

`updateToasts` returns early while `GameGlobals.gameState.uiStatus.isHidden` is true, and the opening message is logged during start-up while the game is hidden. Dropping it is final: `latestMessages` comes from `UIList.update`, which returns only the items it *created*, so on the next pass the message already has a list item and is never new again.

Separately, `#log-toasts` carries `hidden-when-down`, which takes it to `opacity: 0`. The opening of the game is `vision-step-0` from the first frame until the player finds light, so the stack is invisible for exactly the stretch that matters most.

- [ ] **Step 1: Add the buffer field**

In `src/game/systems/ui/UIOutLogSystem.js`, find the field declaration:

```js
		currentMessages: [],
```

Add this line immediately after it, at the same indentation:

```js
		pendingToasts: [],
```

There is no `toastStack` field declaration — it is assigned in `initElements` — so this goes beside `currentMessages` with the other fields.

- [ ] **Step 2: Hold instead of dropping**

Find the `updateToasts` method. It currently reads:

```js
		updateToasts: function (messages) {
			if (!this.toastStack) return;
			if (GameGlobals.gameState.uiStatus.isHidden) return;
			// the regular layout has the log column on screen already
			if (!$("body").hasClass("layout-small")) return;
			// so does an open drawer
			if ($("body").hasClass("log-drawer-open")) return;
```

Replace those seven lines with:

```js
		updateToasts: function (messages) {
			if (!this.toastStack) return;
			// the regular layout has the log column on screen already
			if (!$("body").hasClass("layout-small")) return;
			// so does an open drawer
			if ($("body").hasClass("log-drawer-open")) return;

			// Held rather than dropped. latestMessages comes from
			// UIList.update, which returns only the items it created, so a
			// message skipped here has no second chance - which is how the
			// opening message of the game, logged while the game is still
			// hidden, never got a card at all.
			//
			// The other two guards above still drop, and should: with the
			// drawer open the message is already on screen, and outside the
			// small layout there is no stack to put it in.
			if (GameGlobals.gameState.uiStatus.isHidden) {
				for (let i = messages.length - 1; i >= 0; i--) {
					this.pendingToasts.push(this.getMessageText(messages[i]));
				}
				// the flush must not undo the cap the stack exists to enforce
				while (this.pendingToasts.length > this.toastStack.max) {
					this.pendingToasts.shift();
				}
				return;
			}
```

Leave the rest of `updateToasts` — its comment about the backwards loop, and the loop itself — exactly as it is.

- [ ] **Step 3: Add the flush**

Immediately after the closing `},` of `updateToasts`, insert this method at the same indentation:

```js
		flushPendingToasts: function () {
			let pending = this.pendingToasts;
			this.pendingToasts = [];

			if (!this.toastStack) return;
			if (pending.length === 0) return;
			// Asked again here rather than trusted from the hold: the game can
			// be hidden and shown across a resize or a layout change, and a
			// message held on a phone must not land on a desktop stack that
			// was never on screen.
			if (!$("body").hasClass("layout-small")) return;
			if ($("body").hasClass("log-drawer-open")) return;

			// oldest first, which is the order they were held in and the order
			// the cap evicts by
			for (let i = 0; i < pending.length; i++) {
				UIToastStack.push(this.toastStack, pending[i]);
			}
		},
```

- [ ] **Step 4: Flush when the game is shown**

Find this line in the constructor:

```js
			GlobalSignals.add(this, GlobalSignals.gameShownSignal, this.onWindowResized);
```

Replace it with:

```js
			GlobalSignals.add(this, GlobalSignals.gameShownSignal, this.onGameShown);
```

Then find the `onGameReset` handler. Immediately **before** it, insert:

```js
		onGameShown: function () {
			// onWindowResized is only updateOpacity, and it was what this
			// signal already ran. Keep it, and flush after it.
			//
			// The list itself is rebuilt on the next update() tick, which is
			// after this. That order is fine and matters: the held messages
			// carry their own rendered text, and by the time UIList sees them
			// they already have list items, so nothing is toasted twice.
			this.onWindowResized();
			this.flushPendingToasts();
		},

```

- [ ] **Step 5: Clear the buffer on reset**

Find the `onGameReset` handler. It contains a call to `UIToastStack.clear(this.toastStack);`. Add this line immediately after that call, at the same indentation:

```js
			this.pendingToasts = [];
```

- [ ] **Step 6: Syntax check**

```bash
node --check src/game/systems/ui/UIOutLogSystem.js
```

Expected: no output, exit status 0.

- [ ] **Step 7: Show the stack while the player is down**

In `index.html`, find:

```html
		<div id="log-toasts" class="hidden-by-popups hidden-when-down">
```

Replace it with:

```html
		<!-- not hidden-when-down. The opening of the game is vision-step-0
		     from the first frame until the player finds light, and that is the
		     stretch where a message most needs to be seen. The log pill keeps
		     the fade: that is chrome, and it leads somewhere unusable here. -->
		<div id="log-toasts" class="hidden-by-popups">
```

- [ ] **Step 8: Drop the matching card rule**

In `css/modules/mobile.less`, find this rule and its comment:

```less
// invisible chrome must not stay tappable while the player is "down".
// .hidden-when-down on the container takes the opacity to 0; this takes the
// taps, and it goes on the cards because the container has none to give.
body.vision-step-0 #log-toasts .log-toast {
	pointer-events: none;
}
```

Delete all six lines. The container is no longer hidden while down, so a card there is visible — and a visible card must be tappable.

- [ ] **Step 9: Recompile and verify**

```bash
npx -p less lessc css/main.less css/main.css
grep -c "vision-step-0 #log-toasts" css/main.css
grep -n "hidden-when-down" index.html
```

Expected: the count is `0`. The second grep still prints the other `hidden-when-down` users (`#mobile-header`, `#header-side`, `#grid-main-header`, `#btn-room`, `#btn-adventurer`, `#btn-log-toggle`, `#room-panel`) and **not** `#log-toasts`.

- [ ] **Step 10: Commit**

```bash
git add src/game/systems/ui/UIOutLogSystem.js index.html css/modules/mobile.less css/main.css
git commit -m "Give the opening log message a toast, and show the stack while down"
```
