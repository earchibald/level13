# Transient Messages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a log message and a room description once, on screen, without taking a tap or a row of the scrolling page.

**Architecture:** Three independent pieces. A pure DOM-and-timers toast stack in `src/utils/`, fed by `UIOutLogSystem` with the messages it already identifies as new. A room name chip in the fixed banner, and the existing `#out-desc` element moved into a fixed panel that `UIOutLevelSystem` opens when the room's identity text changes. A one-rule CSS fix for the log pill covering "save".

**Tech Stack:** RequireJS AMD modules, jQuery (global `$`, not a module dependency), Ash entity-component-system, LESS compiled to `css/main.css`.

**Spec:** `docs/superpowers/specs/2026-08-04-transient-messages-design.md`

## Global Constraints

- **Never edit `css/main.css` by hand.** Edit `css/modules/mobile.less`, then run `npx -p less lessc css/main.less css/main.css` from the worktree root. Commit both.
- **All new CSS goes in `css/modules/mobile.less`.** It is theme-neutral and imported last, so it wins the cascade.
- **Run `node --check <file>` after the LAST edit to any JS file**, never before. A syntax error means the AMD module never defines, `GameGlobals` gets an undefined constructor, and the game shows a blank screen.
- **Scope every new rule to `body.layout-small`.** The regular layout must be byte-for-byte unchanged in behaviour.
- **Do not touch seen-marking.** `markedAsSeen`, `markLogMessagesSeen` and the `data-unread` badge keep their current behaviour exactly.
- **jQuery is a global.** New modules in `src/utils/` use `$` without declaring a dependency, the way `src/utils/UIList.js` does.
- **Tab characters for indentation** in `.js` and `.less` files, matching the surrounding code.
- The current version is `0.6.3.m51`. The version bump is Task 8 and happens once, at the end.

### Browser harness protocol

There is no test framework in this repository. Every task is verified in the browser harness. The protocol is the same each time:

1. Serve the worktree root: `python3 -m http.server 8414`
2. Open `http://localhost:8414/mtest2.html` in a browser tab. It loads `index.html?touch=1` in a 390x844 iframe and patches the iframe with a MessageChannel `requestAnimationFrame` pump. Without that pump the game loop never runs, because the automation tab always reports `document.visibilityState === "hidden"`.
3. Reach the game from the harness page:

```js
var f = document.getElementById('frame');
var w = f.contentWindow, d = w.document;
var GameGlobals = w.require('game/GameGlobals');
var GlobalSignals = w.require('game/GlobalSignals');
```

`window.app` is not exposed. Use `require` only.

4. **Force a synchronous relayout before measuring:** `GlobalSignals.windowResizedSignal.dispatch()`. `ResizeObserver` is frozen in this tab.
5. **Never return a string containing a URL query.** A `?` in a returned value blocks the whole tool result. Strip `href` and `src` from anything you return.
6. **`getComputedStyle` lies about any property that has a CSS transition** in this tab — the computed value stays pinned to the pre-change value forever. Set `element.style.transition = 'none'` before reading a transitioned property, or take a screenshot.
7. **Verify tap targets with `document.elementFromPoint`**, never by dispatching a synthetic click. A dispatched click bypasses hit-testing and hides "something invisible is on top" bugs.

7a. **`setTimeout` is clamped to about a second in this tab.** `mtest2.html` patches `requestAnimationFrame` with a MessageChannel pump and leaves `setTimeout` alone, and a hidden tab throttles it. Any timing assertion must allow for that: a nested 50ms or 400ms timer takes ~1s here. Widen the wait rather than concluding the code is slow. This is a property of the automation tab — on a visible phone the stated durations hold.
8. **A recompiled `main.css` is not picked up by reloading the iframe.** The `<link href>` carries `?v=0.6.3.m51` and is unchanged, so the browser serves the cached file. Bust it in place:

```js
var l = d.querySelector('link[href*="main.css"]');
l.setAttribute('href', 'css/main.css?bust=' + Date.now());
```

Then confirm the new rule is really loaded by reading it back out of `d.styleSheets` — and do not return the sheet's `href`.

9. **A recompiled JS module is not picked up either.** `src/config.js` sets `urlArgs: "v=0.6.3.m51"`. For JS changes, reload the harness with `window.reloadGame()` after bumping `urlArgs`, or serve from a fresh port.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/utils/UIToastStack.js` | **New.** A stack of short-lived cards. DOM and timers only. No game knowledge, so it can be exercised against a detached container. |
| `src/game/systems/ui/UIOutLogSystem.js` | Renders one message text, and hands new messages to the toast stack. |
| `src/game/systems/ui/UIOutHeaderSystem.js` | Publishes the chrome height; moves `#out-desc` into the room panel; decides when the room chip is on screen. |
| `src/game/systems/ui/UIOutLevelSystem.js` | Writes the room chip text; decides when the room panel opens by itself. |
| `src/game/UIFunctions.js` | Open, close and toggle mechanics for the room panel, beside the log drawer and adventurer toggles. |
| `index.html` | `#log-toasts`, `#room-panel`, `#btn-room`. |
| `css/modules/mobile.less` | Toast stack, room panel, banner row, footer reserve. |
| `css/main.css` | Generated. Never hand-edited. |

---

## Task 1: The footer reserves room for the floating log pill

`css/modules/mobile.less:1636` already reserves 84px on the right of the footer so the fixed log pill cannot cover "save". Two things defeat it.

1. `css/modules/mobile.less:2560` re-homes the footer inside the scrolling pane and sets the `padding` shorthand. That selector carries two ids to the first rule's one, so it wins, and the shorthand resets `padding-right` to 4px.
2. Below 568px, `css/gridism.css:142-145` sets `.unit .grid .unit { padding-left: 0 !important; padding-right: 0 !important; }`. The footer's ancestry is `#footer.unit` → `#grid-switch-content.grid` → `#unit-main.unit`, so it matches, and `!important` beats any id count. This is why the reserve at line 1636 never worked at phone widths either.

The fix therefore needs `!important` of its own. `mobile.less` already fights this same stylesheet the same way at `:1226` and `:1477`.

**Files:**
- Modify: `css/modules/mobile.less:2557-2569`
- Regenerate: `css/main.css`

**Interfaces:**
- Consumes: nothing
- Produces: nothing. This task is self-contained.

- [ ] **Step 1: Reproduce the defect**

Start the server and open the harness:

```bash
python3 -m http.server 8414
```

Open `http://localhost:8414/mtest2.html`. Wait for the game to reach the main screen. Switch to the bag tab, scroll the pane to the bottom, then run this in the harness page:

```js
var f = document.getElementById('frame');
var w = f.contentWindow, d = w.document;
var GlobalSignals = w.require('game/GlobalSignals');
d.getElementById('switch-bag').click();
var pane = d.getElementById('grid-switch-content');
pane.scrollTop = pane.scrollHeight;
GlobalSignals.windowResizedSignal.dispatch();
var pill = d.getElementById('btn-log-toggle').getBoundingClientRect();
var hits = Array.prototype.slice.call(d.querySelectorAll('#game-options button, #game-options-extended button'))
	.filter(function (b) {
		var r = b.getBoundingClientRect();
		if (r.width === 0 || r.height === 0) return false;
		return !(r.right < pill.left || r.left > pill.right || r.bottom < pill.top || r.top > pill.bottom);
	})
	.map(function (b) { return b.id; });
JSON.stringify({ pillRight: Math.round(pill.right), pillLeft: Math.round(pill.left), hits: hits });
```

Expected: `hits` is not empty. It should contain `btn-save`.

- [ ] **Step 2: Restate the reserve in the winning rule**

In `css/modules/mobile.less`, replace this block (currently at lines 2557-2569):

```less
// The footer carries save and restart, and it sat after the scrolling page.
// With the document locked it would be off-screen for good, so
// UIOutHeaderSystem moves it inside the pane, where it scrolls with the rest.
body.layout-small #grid-switch-content > #footer {
	width: 100%;
	max-width: 100%;
	margin: 12px 0 0 0;
	padding: 10px 4px ~"calc(10px + env(safe-area-inset-bottom))" 4px;
	box-sizing: border-box;
	// the exploration pane is a flex column whose sections are ordered, and an
	// unordered child sorts to the front - the footer opened the tab
	order: 99;
}
```

with:

```less
// The footer carries save and restart, and it sat after the scrolling page.
// With the document locked it would be off-screen for good, so
// UIOutHeaderSystem moves it inside the pane, where it scrolls with the rest.
//
// The 84px on the right keeps the floating log pill off "save". The reserve
// is set further up as well, and never reached the footer at phone widths:
// gridism zeroes the side padding of a .unit inside a .grid inside a .unit
// with an !important of its own below 568px, and the footer's ancestry is
// exactly that. So this carries !important too - the same fight #unit-main
// and the banner already have with the same stylesheet.
//
// It is also the only place the reserve is needed. The pill is fixed exactly
// when the footer is here; on the exploration tab both move into
// #out-panel-meta and share a row instead.
body.layout-small #grid-switch-content > #footer {
	width: 100%;
	max-width: 100%;
	margin: 12px 0 0 0;
	padding: 10px 84px ~"calc(10px + env(safe-area-inset-bottom))" 4px !important;
	box-sizing: border-box;
	// the exploration pane is a flex column whose sections are ordered, and an
	// unordered child sorts to the front - the footer opened the tab
	order: 99;
}
```

- [ ] **Step 3: Recompile the stylesheet**

```bash
npx -p less lessc css/main.less css/main.css
```

Expected: no output, exit code 0.

- [ ] **Step 4: Verify the fix**

In the harness page, bust the stylesheet cache and re-measure:

```js
var f = document.getElementById('frame');
var w = f.contentWindow, d = w.document;
var GlobalSignals = w.require('game/GlobalSignals');
d.querySelector('link[href*="main.css"]').setAttribute('href', 'css/main.css?bust=' + Date.now());
w.setTimeout(function () {
	d.getElementById('switch-bag').click();
	var pane = d.getElementById('grid-switch-content');
	pane.scrollTop = pane.scrollHeight;
	GlobalSignals.windowResizedSignal.dispatch();
	var pill = d.getElementById('btn-log-toggle').getBoundingClientRect();
	var hits = Array.prototype.slice.call(d.querySelectorAll('#game-options button, #game-options-extended button'))
		.filter(function (b) {
			var r = b.getBoundingClientRect();
			if (r.width === 0 || r.height === 0) return false;
			return !(r.right < pill.left || r.left > pill.right || r.bottom < pill.top || r.top > pill.bottom);
		})
		.map(function (b) { return b.id; });
	w.console.log('FOOTER_HITS ' + JSON.stringify(hits));
}, 400);
```

Read the console with a `FOOTER_HITS` pattern filter.

Expected: `FOOTER_HITS []`.

- [ ] **Step 5: Verify the exploration tab is unchanged**

```js
var f = document.getElementById('frame');
var w = f.contentWindow, d = w.document;
var GlobalSignals = w.require('game/GlobalSignals');
d.getElementById('switch-out').click();
GlobalSignals.windowResizedSignal.dispatch();
var footer = d.getElementById('footer');
var pill = d.getElementById('btn-log-toggle');
JSON.stringify({
	footerParent: footer.parentElement.id,
	pillParent: pill.parentElement.id,
	pillPosition: w.getComputedStyle(pill).position
});
```

Expected: `footerParent` and `pillParent` are both `out-panel-meta`, and `pillPosition` is `relative`. If scout is not yet unlocked in the save, `#out-panel-meta` does not exist and both fall back to the pane and `fixed`; that is also correct, and in that case re-run Step 4's measurement on the out tab and expect `[]`.

- [ ] **Step 6: Commit**

```bash
git add css/modules/mobile.less css/main.css
git commit -m "$(cat <<'EOF'
Keep the log pill off "save"

The 84px reserve at mobile.less:1636 is defeated by the rule that re-homes the
footer inside the scrolling pane: two ids to one, and a padding shorthand that
would drop it in any case. So on every tab where the footer scrolls, the fixed
pill landed on the save button.

Restated in the winning rule, which is also the only rule that needs it - the
pill is fixed exactly when the footer is there. On the exploration tab both
move into #out-panel-meta and share a row.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RdwYuefzDpdNimUouuhpzG
EOF
)"
```

---

## Task 2: Publish the chrome height as a CSS custom property

Both new overlays hang under the fixed top chrome. `#mobile-chrome` is built at runtime by `updateChromeGrouping`, so no stylesheet can measure it. `UIOutHeaderSystem` already publishes `--l13-out-bottom-height` the same way; this adds its opposite number.

**Files:**
- Modify: `src/game/systems/ui/UIOutHeaderSystem.js` — `updateLayout` (~line 1332), a new `updateTopChromeState`, `updateMeasurements` (~line 1380)
- Modify: `css/modules/mobile.less` — a fallback declaration
- Regenerate: `css/main.css`

**Interfaces:**
- Consumes: nothing
- Produces: `--l13-chrome-height` on `document.documentElement`, a px length. It is `0px` whenever the small-layout shell is not in force. Tasks 4 and 6 position against it.

- [ ] **Step 1: Add the fallback declaration**

In `css/modules/mobile.less`, immediately after the `body.sunlit { ... }` block that ends at line 31, insert:

```less
// UIOutHeaderSystem measures #mobile-chrome and writes this on the root - the
// chrome is built at runtime, so there is nothing here that could measure it.
// The declaration is the value used before the first measurement, and the
// value that stands in every layout that has no chrome to measure.
:root {
	--l13-chrome-height: 0px;
}
```

- [ ] **Step 2: Add the measuring method**

In `src/game/systems/ui/UIOutHeaderSystem.js`, immediately after `updateBottomChromeState` (which ends at line 1376), insert:

```js
		// The two overlays that hang under the fixed chrome - the log toasts and
		// the room panel - have to know where it ends, and #mobile-chrome is
		// built at runtime by updateChromeGrouping, so no stylesheet can measure
		// it. Published beside the bottom height and re-read on the same
		// next-frame pass, for the same reason: the chrome is often rebuilt in
		// the pass that reads it.
		updateTopChromeState: function (isShell) {
			let height = 0;
			if (isShell) {
				let $chrome = $("#mobile-chrome");
				if ($chrome.length > 0 && $chrome.is(":visible")) {
					height = Math.ceil($chrome.outerHeight());
				}
			}
			document.documentElement.style.setProperty("--l13-chrome-height", height + "px");
		},
```

- [ ] **Step 3: Call it from both measuring points**

In `updateLayout`, replace line 1332:

```js
			this.updateBottomChromeState(isShell);
```

with:

```js
			this.updateBottomChromeState(isShell);
			this.updateTopChromeState(isShell);
```

Then replace the body of `updateMeasurements` (lines 1380-1383):

```js
		updateMeasurements: function () {
			let isShell = this.elements.body.hasClass("layout-small") && this.isShellLayout();
			this.updateBottomChromeState(isShell);
		},
```

with:

```js
		updateMeasurements: function () {
			let isShell = this.elements.body.hasClass("layout-small") && this.isShellLayout();
			this.updateBottomChromeState(isShell);
			this.updateTopChromeState(isShell);
		},
```

- [ ] **Step 4: Syntax check and recompile**

```bash
node --check src/game/systems/ui/UIOutHeaderSystem.js && npx -p less lessc css/main.less css/main.css
```

Expected: no output, exit code 0.

- [ ] **Step 5: Verify the published value matches the measured chrome**

Bump `urlArgs` in `src/config.js` from `v=0.6.3.m51` to `v=0.6.3.m51a` so the harness picks up the changed module, then reload the harness page and run:

```js
var f = document.getElementById('frame');
var w = f.contentWindow, d = w.document;
var GlobalSignals = w.require('game/GlobalSignals');
GlobalSignals.windowResizedSignal.dispatch();
w.requestAnimationFrame(function () {
	var chrome = d.getElementById('mobile-chrome');
	var published = w.getComputedStyle(d.documentElement).getPropertyValue('--l13-chrome-height').trim();
	w.console.log('CHROME_HEIGHT ' + JSON.stringify({
		measured: chrome ? Math.ceil(chrome.getBoundingClientRect().height) : null,
		published: published,
		bodyClass: d.body.className.indexOf('layout-small') >= 0
	}));
});
```

Expected: `bodyClass` true, `measured` a number greater than 40, and `published` equal to `measured + "px"`.

- [ ] **Step 6: Verify it is zero on the regular layout**

Resize the harness iframe to 1200x800 with the `1200x800` button, then:

```js
var f = document.getElementById('frame');
var w = f.contentWindow, d = w.document;
w.require('game/GlobalSignals').windowResizedSignal.dispatch();
w.requestAnimationFrame(function () {
	w.console.log('CHROME_HEIGHT_WIDE ' + w.getComputedStyle(d.documentElement).getPropertyValue('--l13-chrome-height').trim());
});
```

Expected: `CHROME_HEIGHT_WIDE 0px`.

- [ ] **Step 7: Revert the temporary urlArgs bump and commit**

Set `urlArgs` in `src/config.js` back to `v=0.6.3.m51`. The real bump is Task 8.

```bash
git add src/game/systems/ui/UIOutHeaderSystem.js css/modules/mobile.less css/main.css
git commit -m "$(cat <<'EOF'
Publish the height of the top chrome

Two overlays are about to hang under it, and #mobile-chrome is assembled at
runtime by updateChromeGrouping, so there is nothing a stylesheet can measure.
It goes out as --l13-chrome-height, beside the bottom height that the floating
log pill already positions against, and is re-read on the same next-frame pass
- the chrome is usually rebuilt in the pass that measures it.

Zero whenever the small-layout shell is not in force, so the regular layout
carries a value that means "no chrome" rather than a stale one.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RdwYuefzDpdNimUouuhpzG
EOF
)"
```

---

## Task 3: The toast stack widget

A stack of short-lived cards, with no game knowledge, so it can be exercised on its own against a detached container.

**Files:**
- Create: `src/utils/UIToastStack.js`

**Interfaces:**
- Consumes: nothing. jQuery as a global `$`.
- Produces:
  - `UIToastStack.create($container, options)` → a stack object. `options` may carry `lifetimeMs` (default 3500), `fadeMs` (default 400) and `max` (default 3).
  - `UIToastStack.push(stack, text)` → the card object, or `null` if the container is missing.
  - `UIToastStack.dismiss(stack, card)` → starts a card's exit.
  - `UIToastStack.clear(stack)` → removes every card at once.
  - `UIToastStack.getSettledCount(stack)` → number of cards that are not already leaving.
  - Each card is a `<div class="log-toast">`; a card on its way out also carries `log-toast-leaving`.

- [ ] **Step 1: Write the module**

Create `src/utils/UIToastStack.js`:

```js
// A stack of short-lived cards - a log message that arrives while the drawer
// is closed is otherwise invisible until the player thinks to check the badge.
//
// DOM and timers only. It knows nothing about the game, which keeps it out of
// the way of the seen-marking rules and lets it be exercised on its own
// against a detached container.
//
// The cap is enforced by pushing the oldest card out early, not by queueing
// the new one. A queue would show a player who is moving fast a feed that
// lags further behind with every step; this way the newest message is always
// on screen and the stack never outgrows its cap.

define([], function () {

	let UIToastStack = {

		DEFAULT_LIFETIME_MS: 3500,
		DEFAULT_FADE_MS: 400,
		DEFAULT_MAX: 3,

		create: function ($container, options) {
			options = options || {};
			return {
				$container: $container,
				lifetimeMs: typeof options.lifetimeMs == "number" ? options.lifetimeMs : this.DEFAULT_LIFETIME_MS,
				fadeMs: typeof options.fadeMs == "number" ? options.fadeMs : this.DEFAULT_FADE_MS,
				max: typeof options.max == "number" ? options.max : this.DEFAULT_MAX,
				cards: [],
			};
		},

		push: function (stack, text) {
			if (!stack) return null;
			if (!stack.$container || stack.$container.length === 0) return null;

			let sys = this;
			let card = { $root: $("<div class='log-toast'></div>"), timeoutID: null, fadeTimeoutID: null, isLeaving: false };
			card.$root.text(text);
			card.$root.on("click", function () { sys.dismiss(stack, card); });

			stack.$container.append(card.$root);
			stack.cards.push(card);

			card.timeoutID = window.setTimeout(function () { sys.dismiss(stack, card); }, stack.lifetimeMs);

			// one over the cap: the oldest card that is not already on its way
			// out gives up the rest of its time
			let settled = stack.cards.filter(function (c) { return !c.isLeaving; });
			while (settled.length > stack.max) {
				sys.dismiss(stack, settled.shift());
			}

			return card;
		},

		dismiss: function (stack, card) {
			if (!stack || !card) return;
			if (card.isLeaving) return;
			card.isLeaving = true;

			if (card.timeoutID) {
				window.clearTimeout(card.timeoutID);
				card.timeoutID = null;
			}

			let sys = this;

			if (stack.fadeMs <= 0 || this.isReducedMotion()) {
				this.remove(stack, card);
				return;
			}

			card.$root.addClass("log-toast-leaving");
			card.fadeTimeoutID = window.setTimeout(function () { sys.remove(stack, card); }, stack.fadeMs);
		},

		remove: function (stack, card) {
			if (!stack || !card) return;

			// Both timers, here rather than in dismiss, because remove is
			// reached from three directions - the lifetime timer, the fade
			// timer, and clear() - and whichever arrives first has to stop
			// the others firing against a card that is already gone.
			if (card.timeoutID) {
				window.clearTimeout(card.timeoutID);
				card.timeoutID = null;
			}

			if (card.fadeTimeoutID) {
				window.clearTimeout(card.fadeTimeoutID);
				card.fadeTimeoutID = null;
			}

			card.$root.remove();
			let index = stack.cards.indexOf(card);
			if (index >= 0) stack.cards.splice(index, 1);
		},

		clear: function (stack) {
			if (!stack) return;
			for (let i = stack.cards.length - 1; i >= 0; i--) {
				this.remove(stack, stack.cards[i]);
			}
			stack.cards = [];
		},

		// a card that is fading is already gone as far as the cap - and as far
		// as anything asserting about the stack - is concerned
		getSettledCount: function (stack) {
			if (!stack) return 0;
			return stack.cards.filter(function (c) { return !c.isLeaving; }).length;
		},

		isReducedMotion: function () {
			if (!window.matchMedia) return false;
			return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		},

	};

	return UIToastStack;
});
```

- [ ] **Step 2: Syntax check**

```bash
node --check src/utils/UIToastStack.js
```

Expected: no output, exit code 0.

- [ ] **Step 3: Exercise the widget in the harness**

Bump `urlArgs` in `src/config.js` to `v=0.6.3.m51a`, reload the harness page, then run this against a detached container. Short lifetimes keep the exercise quick.

```js
var f = document.getElementById('frame');
var w = f.contentWindow;
w.require(['utils/UIToastStack'], function (S) {
	var $ = w.$;
	var $box = $("<div></div>");
	var stack = S.create($box, { lifetimeMs: 300, fadeMs: 50, max: 3 });
	var out = {};

	S.push(stack, "one");
	out.afterOne = S.getSettledCount(stack);
	out.textOne = $box.children().first().text();

	S.push(stack, "two");
	S.push(stack, "three");
	out.afterThree = S.getSettledCount(stack);

	S.push(stack, "four");
	out.afterFour = S.getSettledCount(stack);
	out.oldestIsLeaving = stack.cards[0].isLeaving;
	out.newestText = $box.children().last().text();

	// 2500ms, not 350ms-plus-a-margin: the harness tab is hidden, and a hidden
	// tab clamps setTimeout to about a second. mtest2.html patches
	// requestAnimationFrame and leaves setTimeout alone, so the widget's
	// nested fade timer takes ~1s here however small fadeMs is. That is a
	// property of the tab, not of the widget - on a visible phone the fade
	// runs at its stated 400ms.
	w.setTimeout(function () {
		out.afterLifetime = S.getSettledCount(stack);
		out.domCount = $box.children().length;
		w.console.log('TOAST_TEST ' + JSON.stringify(out));
	}, 2500);
});
```

Read the console with a `TOAST_TEST` pattern filter.

Expected exactly:

```
TOAST_TEST {"afterOne":1,"textOne":"one","afterThree":3,"afterFour":3,"oldestIsLeaving":true,"newestText":"four","afterLifetime":0,"domCount":0}
```

- [ ] **Step 4: Exercise the tap dismissal**

```js
var f = document.getElementById('frame');
var w = f.contentWindow;
w.require(['utils/UIToastStack'], function (S) {
	var $ = w.$;
	var $box = $("<div></div>");
	var stack = S.create($box, { lifetimeMs: 60000, fadeMs: 50, max: 3 });
	S.push(stack, "tap me");
	var before = S.getSettledCount(stack);
	$box.children().first().trigger("click");
	var after = S.getSettledCount(stack);
	w.setTimeout(function () {
		w.console.log('TOAST_TAP ' + JSON.stringify({ before: before, after: after, dom: $box.children().length }));
	}, 200);
});
```

Expected exactly: `TOAST_TAP {"before":1,"after":0,"dom":0}`.

- [ ] **Step 5: Exercise clear(), and prove it cancels the pending timers**

`clear` is reached from the drawer opening and from a game reset, both of which
Task 4 wires up. A cleared card whose timer still fires would mutate a card
that is already detached — flipping `isLeaving`, adding a class to an orphaned
node — so the cancellation is the thing to check, not just the emptying.

```js
var f = document.getElementById('frame');
var w = f.contentWindow;
w.require(['utils/UIToastStack'], function (S) {
	var $ = w.$;
	var $box = $("<div></div>");
	var stack = S.create($box, { lifetimeMs: 200, fadeMs: 50, max: 3 });

	var settled = S.push(stack, "settled card");
	var leaving = S.push(stack, "leaving card");
	S.dismiss(stack, leaving);

	S.clear(stack);

	var out = {
		cardsAfterClear: stack.cards.length,
		domAfterClear: $box.children().length,
		settledTimerCleared: settled.timeoutID === null,
		leavingFadeTimerCleared: leaving.fadeTimeoutID === null
	};

	// long enough for both original timers to have fired, had they survived
	w.setTimeout(function () {
		out.settledStillNotLeaving = settled.isLeaving === false;
		out.domStillEmpty = $box.children().length === 0;
		w.console.log('TOAST_CLEAR ' + JSON.stringify(out));
	}, 600);
});
```

Expected exactly:

```
TOAST_CLEAR {"cardsAfterClear":0,"domAfterClear":0,"settledTimerCleared":true,"leavingFadeTimerCleared":true,"settledStillNotLeaving":true,"domStillEmpty":true}
```

`settledStillNotLeaving` is the load-bearing assertion: it is false if the
lifetime timer survived `clear` and later called `dismiss` on a dead card.

- [ ] **Step 6: Revert the temporary urlArgs bump and commit**

Set `urlArgs` in `src/config.js` back to `v=0.6.3.m51`.

```bash
git add src/utils/UIToastStack.js
git commit -m "$(cat <<'EOF'
Add a stack of short-lived cards

DOM and timers only, so it can be exercised against a detached container and
stays out of the way of the log's own rules about what counts as read.

The cap pushes the oldest card out early rather than queueing the new one. A
queue would show a player who is moving fast a feed that falls further behind
with every step; this way the newest message is always the one on screen.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RdwYuefzDpdNimUouuhpzG
EOF
)"
```

---

## Task 4: Show new log messages as toasts

**Files:**
- Modify: `index.html:845` — add the container after `#btn-log-toggle`
- Modify: `src/game/systems/ui/UIOutLogSystem.js` — define block (lines 1-14), `initElements` (54-57), `updateMessageList` (106-148), `updateLogListItem` (159-202), a new `getMessageText` and `updateToasts`
- Modify: `css/modules/mobile.less` — a new section after the log drawer section that ends at line 1781
- Regenerate: `css/main.css`

**Interfaces:**
- Consumes: `UIToastStack.create`, `UIToastStack.push` from Task 3; `--l13-chrome-height` from Task 2
- Produces: nothing that later tasks rely on

- [ ] **Step 1: Add the container**

In `index.html`, replace line 845:

```html
	<button id="btn-log-toggle" class="hidden-by-popups hidden-when-down" aria-label="Toggle message log">log</button>
```

with:

```html
	<button id="btn-log-toggle" class="hidden-by-popups hidden-when-down" aria-label="Toggle message log">log</button>

	<!-- new log messages, shown for a few seconds each (small layout only).
	     Body level so no scroll container can clip it, and the same two
	     classes as the pill so popups and being "down" reach it too.

	     The cards go in an inner div, and that is what carries aria-hidden.
	     UIPopupManager stamps aria-hidden onto every .hidden-by-popups
	     element on each popup open AND close, so a static one on the outer
	     div would be rewritten to "false" the first time a popup closed.
	     Nothing writes to the inner div, so its hiding holds.

	     Hidden on purpose: #log ul carries role="log" and already announces
	     these messages. A second reading of the same text is noise. -->

	<div id="log-toasts" class="hidden-by-popups hidden-when-down">
		<div id="log-toasts-list" aria-hidden="true"></div>
	</div>
```

- [ ] **Step 2: Add the module dependency**

In `src/game/systems/ui/UIOutLogSystem.js`, replace lines 1-14:

```js
define([
	'ash', 
	'text/Text', 
	'utils/UIList', 
	'utils/MathUtils',
	'game/GameGlobals', 
	'game/GlobalSignals', 
	'game/constants/LogConstants',
	'game/constants/TextConstants',
	'game/nodes/LogNode', 
	'game/nodes/PlayerPositionNode', 
	'game/constants/UIConstants', 
	'game/vos/PositionVO'],
function (Ash, Text, UIList, MathUtils, GameGlobals, GlobalSignals, LogConstants, TextConstants, LogNode, PlayerPositionNode, UIConstants, PositionVO) {
```

with:

```js
define([
	'ash', 
	'text/Text', 
	'utils/UIList', 
	'utils/UIToastStack',
	'utils/MathUtils',
	'game/GameGlobals', 
	'game/GlobalSignals', 
	'game/constants/LogConstants',
	'game/constants/TextConstants',
	'game/nodes/LogNode', 
	'game/nodes/PlayerPositionNode', 
	'game/constants/UIConstants', 
	'game/vos/PositionVO'],
function (Ash, Text, UIList, UIToastStack, MathUtils, GameGlobals, GlobalSignals, LogConstants, TextConstants, LogNode, PlayerPositionNode, UIConstants, PositionVO) {
```

- [ ] **Step 3: Create the stack**

Replace `initElements` (lines 54-57):

```js
		initElements: function () {
			this.logList = UIList.create(this, $("#log ul"), this.createLogListItem, this.updateLogListItem, this.isLogListItemDataSame);
			this.logListLatest = UIList.create(this, $("#log-latest ul"), this.createLogListItem, this.updateLogListItem, this.isLogListItemDataSame);
		},
```

with:

```js
		initElements: function () {
			this.logList = UIList.create(this, $("#log ul"), this.createLogListItem, this.updateLogListItem, this.isLogListItemDataSame);
			this.logListLatest = UIList.create(this, $("#log-latest ul"), this.createLogListItem, this.updateLogListItem, this.isLogListItemDataSame);
			this.toastStack = UIToastStack.create($("#log-toasts-list"));
		},
```

- [ ] **Step 4: Give the message text one renderer**

Replace lines 181-189 inside `updateLogListItem`:

```js
			let message = "";
			
			if (data.text) message = data.text; // backwards compatibility
			
			if (data.messageTextVO) message = Text.compose(data.messageTextVO);

			message = LogConstants.cleanupMessage(message);
			message = TextConstants.sentencify(message);

			let timestamp = data.timestamp;
```

with:

```js
			let message = this.getMessageText(data);

			let timestamp = data.timestamp;
```

Then insert this method immediately after `updateLogListItem` ends (after its closing `},` at line 202):

```js
		// One rendering of a message, so the entry in the drawer and the card
		// that flashes up cannot drift apart.
		getMessageText: function (data) {
			let message = "";

			if (data.text) message = data.text; // backwards compatibility

			if (data.messageTextVO) message = Text.compose(data.messageTextVO);

			message = LogConstants.cleanupMessage(message);
			return TextConstants.sentencify(message);
		},
```

- [ ] **Step 5: Push new messages to the stack**

In `updateMessageList`, replace line 118:

```js
			UIList.update(this.logListLatest, latestMessages);
```

with:

```js
			UIList.update(this.logListLatest, latestMessages);

			this.updateToasts(latestMessages);
```

Then insert this method immediately after `updateMessageList` ends (after its closing `},` at line 148):

```js
		// A message that arrives while the drawer is closed is invisible until
		// the player thinks to look at the badge, which only says that
		// something happened. Each new one also gets a few seconds on screen.
		//
		// Nothing here touches markedAsSeen. A glance is not a read, so the
		// badge keeps counting a toasted message until the drawer opens.
		updateToasts: function (messages) {
			if (!this.toastStack) return;
			if (GameGlobals.gameState.uiStatus.isHidden) return;
			// the regular layout has the log column on screen already
			if (!$("body").hasClass("layout-small")) return;
			// so does an open drawer
			if ($("body").hasClass("log-drawer-open")) return;

			// Backwards, because this list is newest-first: updateMessages hands
			// updateMessageList a reversed list so the drawer reads newest at
			// the top. Cards read the other way - oldest at the top, each new
			// one arriving below it - and, more importantly, the cap evicts by
			// push order. Pushed newest-first, a burst of five would evict the
			// newest four and leave the three oldest on screen.
			for (let i = messages.length - 1; i >= 0; i--) {
				UIToastStack.push(this.toastStack, this.getMessageText(messages[i]));
			}
		},
```

- [ ] **Step 6: Clear the stack when the drawer opens or the game resets**

Replace `onGameReset` (lines 396-398):

```js
		onGameReset: function () {
			this.lastUpdateTimeStamp = 0;
		},
```

with:

```js
		onGameReset: function () {
			this.lastUpdateTimeStamp = 0;
			UIToastStack.clear(this.toastStack);
		},
```

Then replace `onMarkLogMessagesSeen` (lines 400-402):

```js
		onMarkLogMessagesSeen: function () {
			this.markLogMessagesSeen();
		},
```

with:

```js
		onMarkLogMessagesSeen: function () {
			this.markLogMessagesSeen();
			// the drawer is opening, so the cards would be repeating what is
			// now on screen underneath them
			UIToastStack.clear(this.toastStack);
		},
```

- [ ] **Step 7: Style the stack**

In `css/modules/mobile.less`, immediately after the log drawer section (which ends with the `body.layout-small.log-drawer-open #log { ... }` block at line 1781), insert:

```less
// ---------------------------------------------------------------------------
// LOG TOASTS
// The drawer, the pill and the badge all work, but a message that arrives
// while the drawer is closed is invisible: the badge only says that something
// happened, not what. Each new message also gets a card under the chrome for a
// few seconds - see UIOutLogSystem.updateToasts, which does not mark anything
// as read, so the badge is unaffected.
//
// Under the chrome and not above the action bar: this is the corner furthest
// from the thumb, so a card can never land under a finger already on its way
// to a direction or to Scavenge.

#log-toasts {
	display: none;
}

body.layout-small #log-toasts {
	display: block;
	position: fixed;
	top: var(--l13-chrome-height);
	left: 10px;
	right: 10px;
	// under the drawer (8) and the pill (9), over the page
	z-index: 7;
	// the container spans the width whether or not it holds anything, so the
	// gaps between cards must not eat taps meant for the page underneath
	pointer-events: none;
}

body.layout-small #log-toasts .log-toast {
	pointer-events: auto;
	margin-top: 6px;
	padding: 8px 10px;
	box-sizing: border-box;
	background: var(--l13-mobile-bg);
	border: 1px solid var(--l13-mobile-border);
	border-radius: 6px;
	box-shadow: 0 4px 14px -4px var(--l13-mobile-divider-shadow);
	font-size: 0.9rem;
	line-height: 1.25;
	opacity: 1;
	// must match UIToastStack.DEFAULT_FADE_MS, which is how long the widget
	// waits before it removes the element
	transition: opacity 400ms ease-out;
}

body.layout-small #log-toasts .log-toast-leaving {
	opacity: 0;
}

// invisible chrome must not stay tappable while the player is "down".
// .hidden-when-down on the container takes the opacity to 0; this takes the
// taps, and it goes on the cards because the container has none to give.
body.vision-step-0 #log-toasts .log-toast {
	pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
	body.layout-small #log-toasts .log-toast {
		transition: none;
	}
}

// landscape is the map and nothing else
body.landscape-map #log-toasts {
	display: none;
}
```

- [ ] **Step 8: Syntax check and recompile**

```bash
node --check src/game/systems/ui/UIOutLogSystem.js && npx -p less lessc css/main.less css/main.css
```

Expected: no output, exit code 0.

- [ ] **Step 9: Verify a message produces a card, and that the badge is unaffected**

Bump `urlArgs` in `src/config.js` to `v=0.6.3.m51a`, reload the harness page, wait for the game, then:

```js
var f = document.getElementById('frame');
var w = f.contentWindow, d = w.document;
var GameGlobals = w.require('game/GameGlobals');
var before = d.getElementById('btn-log-toggle').getAttribute('data-unread');
GameGlobals.playerHelper.addLogMessage("test_toast_1", "A test message for the toast stack.");
w.setTimeout(function () {
	var cards = d.querySelectorAll('#log-toasts .log-toast');
	var box = cards.length > 0 ? cards[0].getBoundingClientRect() : null;
	var chrome = d.getElementById('mobile-chrome').getBoundingClientRect();
	w.console.log('TOAST_LIVE ' + JSON.stringify({
		count: cards.length,
		text: cards.length > 0 ? cards[0].textContent : null,
		cardTop: box ? Math.round(box.top) : null,
		chromeBottom: Math.round(chrome.bottom),
		unreadBefore: before,
		unreadAfter: d.getElementById('btn-log-toggle').getAttribute('data-unread')
	}));
}, 500);
```

Expected: `count` 1, `text` the message, `cardTop` within 8px of `chromeBottom`, and `unreadAfter` one higher than `unreadBefore` — the badge must still count it.

- [ ] **Step 10: Verify the card goes away on its own**

```js
var f = document.getElementById('frame');
var w = f.contentWindow, d = w.document;
// 6000ms and not 3900ms: the harness tab is hidden, and a hidden tab clamps
// setTimeout to about a second, so the widget's nested fade timer takes ~1s
// here rather than its stated 400ms. A property of the tab, not of the widget.
w.setTimeout(function () {
	w.console.log('TOAST_EXPIRED ' + d.querySelectorAll('#log-toasts .log-toast').length);
}, 6000);
```

Expected: `TOAST_EXPIRED 0`. Run this within a second or two of Step 9, so the 3500ms lifetime and the fade have both elapsed.

- [ ] **Step 11: Verify the cap**

```js
var f = document.getElementById('frame');
var w = f.contentWindow, d = w.document;
var GameGlobals = w.require('game/GameGlobals');
for (var i = 1; i <= 5; i++) {
	GameGlobals.playerHelper.addLogMessage("test_toast_cap_" + i, "Cap test message number " + i + ".");
}
w.setTimeout(function () {
	var cards = Array.prototype.slice.call(d.querySelectorAll('#log-toasts .log-toast'));
	var settled = cards.filter(function (c) { return c.className.indexOf('log-toast-leaving') < 0; });
	w.console.log('TOAST_CAP ' + JSON.stringify({
		settled: settled.length,
		lastText: settled.length > 0 ? settled[settled.length - 1].textContent : null
	}));
}, 300);
```

Expected: `settled` is 3, and `lastText` ends with `number 5.` — the newest message is always one of the three, and it is the bottom card.

This is the assertion that catches a push in the wrong direction. `latestMessages` is newest-first, so a naive forward loop pushes the newest card first and the cap then evicts it, leaving the three oldest messages on screen and silently dropping the newest.

Note: the game batches log messages, so five `addLogMessage` calls in one tick may arrive as one batch. If `settled` is 3 and `lastText` is message 5, the cap works regardless of how the batch was split.

- [ ] **Step 12: Verify the drawer suppresses toasts**

```js
var f = document.getElementById('frame');
var w = f.contentWindow, d = w.document;
var GameGlobals = w.require('game/GameGlobals');
d.getElementById('btn-log-toggle').click();
w.setTimeout(function () {
	GameGlobals.playerHelper.addLogMessage("test_toast_drawer", "Should not appear as a card.");
	w.setTimeout(function () {
		w.console.log('TOAST_DRAWER ' + JSON.stringify({
			drawerOpen: d.body.className.indexOf('log-drawer-open') >= 0,
			cards: d.querySelectorAll('#log-toasts .log-toast').length
		}));
		d.getElementById('btn-log-toggle').click();
	}, 400);
}, 400);
```

Expected: `drawerOpen` true, `cards` 0.

- [ ] **Step 13: Verify the regular layout has no toasts**

Resize the harness iframe to 1200x800, then:

```js
var f = document.getElementById('frame');
var w = f.contentWindow, d = w.document;
var GameGlobals = w.require('game/GameGlobals');
w.require('game/GlobalSignals').windowResizedSignal.dispatch();
GameGlobals.playerHelper.addLogMessage("test_toast_wide", "Wide layout message.");
w.setTimeout(function () {
	w.console.log('TOAST_WIDE ' + JSON.stringify({
		small: d.body.className.indexOf('layout-small') >= 0,
		cards: d.querySelectorAll('#log-toasts .log-toast').length,
		display: w.getComputedStyle(d.getElementById('log-toasts')).display
	}));
}, 400);
```

Expected: `small` false, `cards` 0, `display` `"none"`.

- [ ] **Step 14: Revert the temporary urlArgs bump and commit**

Set `urlArgs` in `src/config.js` back to `v=0.6.3.m51`.

```bash
git add index.html src/game/systems/ui/UIOutLogSystem.js css/modules/mobile.less css/main.css
git commit -m "$(cat <<'EOF'
Let a new log message be seen when it arrives

The drawer, the pill and the badge all worked, but a message that arrived
while the drawer was closed was invisible - the badge said something had
happened, never what. Each new message now gets a card under the chrome for
3500ms, three at a time, oldest giving up its remaining time when a fourth
arrives so a player who is moving fast never reads old news.

Under the chrome and not above the action bar, which is the corner furthest
from the thumb: a card can never land under a finger on its way to a direction
or to Scavenge.

Seeing a card is not reading the log, so nothing here touches markedAsSeen.
The badge counts a toasted message until the drawer opens, exactly as before.
The messages the stack is fed are the ones UIList reports as newly created,
which the log already computes for its own "latest" list.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RdwYuefzDpdNimUouuhpzG
EOF
)"
```

---

## Task 5: The room name in the banner

**Files:**
- Modify: `index.html:203-212` — add `#btn-room` to the banner
- Modify: `src/game/systems/ui/UIOutLevelSystem.js` — constructor (~line 92), `updateSectorDescription` (~line 1258)
- Modify: `src/game/systems/ui/UIOutHeaderSystem.js` — `updateLayout` (~line 1285)
- Modify: `css/modules/mobile.less` — after the `#btn-adventurer` rules that end at line 803
- Regenerate: `css/main.css`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: `#btn-room`, a button in `#grid-location-header` whose `<span>` holds the sector header text. Task 6 gives it a click handler.

- [ ] **Step 1: Add the button**

In `index.html`, replace lines 203-212:

```html
					<div id="grid-location-header" class="unit whole vision-container">
						<div class='info-callout-target info-callout-target-side'><img id="level-icon" /></div>
						<h1>Camp</h1>
						<!-- reveals the adventurer's own stats, which the small-layout
						     header otherwise leaves off (see mobile.less). It rides in
						     the banner because the banner is on screen on every tab, in
						     camp and out. Hidden until UIOutHeaderSystem has decided the
						     layout, so the regular layout never flashes it. -->
						<button id="btn-adventurer" class="btn-meta text-key hidden-when-down" aria-expanded="false" data-text-key="ui.main.adventurer_button_label" style="display:none"></button>
					</div>
```

with:

```html
					<div id="grid-location-header" class="unit whole vision-container">
						<div class='info-callout-target info-callout-target-side'><img id="level-icon" /></div>
						<h1>Camp</h1>
						<!-- the room you are standing in, outside camp. It was an h2
						     in the scrolling page; up here it is on screen while the
						     page scrolls, and it opens the room description. Hidden
						     until UIOutHeaderSystem has decided the layout. -->
						<button id="btn-room" class="btn-meta hidden-when-down" aria-expanded="false" style="display:none"><span></span></button>
						<!-- reveals the adventurer's own stats, which the small-layout
						     header otherwise leaves off (see mobile.less). It rides in
						     the banner because the banner is on screen on every tab, in
						     camp and out. Hidden until UIOutHeaderSystem has decided the
						     layout, so the regular layout never flashes it. -->
						<button id="btn-adventurer" class="btn-meta text-key hidden-when-down" aria-expanded="false" data-text-key="ui.main.adventurer_button_label" style="display:none"></button>
					</div>
```

- [ ] **Step 2: Cache the element**

In `src/game/systems/ui/UIOutLevelSystem.js`, replace line 92:

```js
			this.elements.sectorHeader = $("#header-sector");
```

with:

```js
			this.elements.sectorHeader = $("#header-sector");
			this.elements.roomName = $("#btn-room span");
```

- [ ] **Step 3: Write the room name**

In `updateSectorDescription`, replace lines 1258-1260:

```js
			// Header
			var features = GameGlobals.sectorHelper.getTextFeatures(sector);
			this.elements.sectorHeader.text(TextConstants.getSectorHeader(hasVision, features));
```

with:

```js
			// Header. Written twice on purpose: the h2 is what the regular
			// layout reads, and the banner chip is what a phone reads. The
			// stylesheet hides whichever one this layout does not use.
			var features = GameGlobals.sectorHelper.getTextFeatures(sector);
			var sectorHeaderText = TextConstants.getSectorHeader(hasVision, features);
			this.elements.sectorHeader.text(sectorHeaderText);
			this.elements.roomName.text(sectorHeaderText);
```

- [ ] **Step 4: Decide when the chip is on screen**

In `src/game/systems/ui/UIOutHeaderSystem.js`, replace lines 1279-1286:

```js
			// The rest of the adventurer - health, the gear numbers, and vision
			// where camp leaves it out - is read deliberately rather than watched,
			// so it sits behind a button. The button was a camp thing, which left
			// no way at all to read health or the gear numbers outside, where the
			// header shows vision and stamina and nothing else. It is in the
			// location banner now, which is the one row on screen on every tab.
			GameGlobals.uiFunctions.toggle("#btn-adventurer", isSmallLayout);
			if (!isSmallLayout) this.elements.body.removeClass("adventurer-open");
```

with:

```js
			// The rest of the adventurer - health, the gear numbers, and vision
			// where camp leaves it out - is read deliberately rather than watched,
			// so it sits behind a button. The button was a camp thing, which left
			// no way at all to read health or the gear numbers outside, where the
			// header shows vision and stamina and nothing else. It is in the
			// location banner now, which is the one row on screen on every tab.
			GameGlobals.uiFunctions.toggle("#btn-adventurer", isSmallLayout);
			if (!isSmallLayout) this.elements.body.removeClass("adventurer-open");

			// The room is where you are, not which tab you are looking at, so
			// the chip stays put across tabs rather than reflowing the banner
			// on every switch. In camp the banner already names the camp.
			GameGlobals.uiFunctions.toggle("#btn-room", isSmallLayout && !isInCamp);
```

`isInCamp` is already in scope; it is set at line 1269.

- [ ] **Step 5: Style the chip**

In `css/modules/mobile.less`, immediately after the `body.vision-step-0 #btn-adventurer { ... }` block that ends at line 803, insert:

```less
// THE ROOM CHIP
// The room name was an h2 in the scrolling page, where it left the screen as
// soon as the player read anything below it. In the banner it is on screen on
// every tab, and it is the control that opens the description.
//
// It takes what the title and the adventurer chip leave, and ellipsises. A
// sector header runs as long as "A narrow dark alley with camp", and the
// alternative - a second banner row - costs a band of fixed chrome on every
// screen, which the small layout has spent several commits reclaiming.
body.layout-small #grid-location-header > #btn-room {
	flex: 1 1 auto;
	min-width: 0;
	margin: 0;
	padding: 2px 8px;
	overflow: hidden;
	text-align: left;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 0.8rem;
	line-height: 1.4;
	min-height: 0;
	border: 1px solid var(--l13-mobile-border);
	// btn-meta squares its own corners with an !important of its own
	border-radius: 11px !important;
	background: var(--l13-mobile-bg);
}

body.layout-small #grid-location-header > #btn-room > span {
	display: block;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

// open: the chip inverts, the same way the adventurer chip does. It is a
// control with a state, and underlining it would say "link" instead.
body.layout-small.room-panel-open #grid-location-header > #btn-room {
	background: var(--l13-mobile-badge-bg);
	color: var(--l13-mobile-badge-fg);
	border-color: var(--l13-mobile-badge-bg);
}

// the chip is small; the tap target is not. Up is the safe-area padding above
// the chrome. Not down - the stats row below is a callout target of its own.
body.touch #grid-location-header > #btn-room::after {
	content: "";
	position: absolute;
	inset: -9px 0 0 0;
}

// invisible chrome must not stay tappable while the player is "down"
body.vision-step-0 #btn-room {
	pointer-events: none;
}

// the name is in the banner now, so the copy in the page is a repeat
body.layout-small #header-sector {
	display: none;
}
```

- [ ] **Step 6: Syntax check and recompile**

```bash
node --check src/game/systems/ui/UIOutLevelSystem.js && node --check src/game/systems/ui/UIOutHeaderSystem.js && npx -p less lessc css/main.less css/main.css
```

Expected: no output, exit code 0.

- [ ] **Step 7: Verify the chip carries the room name and the banner stays one row**

Bump `urlArgs` in `src/config.js` to `v=0.6.3.m51a`, reload the harness page, make sure the player is outside camp on the exploration tab, then:

```js
var f = document.getElementById('frame');
var w = f.contentWindow, d = w.document;
w.require('game/GlobalSignals').windowResizedSignal.dispatch();
var chip = d.getElementById('btn-room');
var banner = d.getElementById('grid-location-header');
var h1 = banner.querySelector('h1');
var adv = d.getElementById('btn-adventurer');
JSON.stringify({
	chipText: chip.querySelector('span').textContent,
	sectorHeaderText: d.getElementById('header-sector').textContent,
	sectorHeaderDisplay: w.getComputedStyle(d.getElementById('header-sector')).display,
	bannerHeight: Math.round(banner.getBoundingClientRect().height),
	oneRow: Math.abs(h1.getBoundingClientRect().top - chip.getBoundingClientRect().top) < 6
		&& Math.abs(adv.getBoundingClientRect().top - chip.getBoundingClientRect().top) < 6
});
```

Expected: `chipText` equals `sectorHeaderText` and is not empty, `sectorHeaderDisplay` is `"none"`, `oneRow` is true, and `bannerHeight` is under 40.

- [ ] **Step 8: Verify a long room name truncates rather than wrapping**

```js
var f = document.getElementById('frame');
var w = f.contentWindow, d = w.document;
var chip = d.getElementById('btn-room');
var span = chip.querySelector('span');
var was = span.textContent;
span.textContent = "A narrow dark alley with camp and a great deal more besides";
var banner = d.getElementById('grid-location-header');
var out = {
	bannerHeight: Math.round(banner.getBoundingClientRect().height),
	clipped: span.scrollWidth > span.clientWidth,
	advVisible: d.getElementById('btn-adventurer').getBoundingClientRect().width > 0
};
span.textContent = was;
JSON.stringify(out);
```

Expected: `clipped` true, `advVisible` true, and `bannerHeight` the same value Step 7 reported.

- [ ] **Step 9: Verify the chip is gone in camp and on the regular layout**

Enter camp in the game, then:

```js
var f = document.getElementById('frame');
var w = f.contentWindow, d = w.document;
w.require('game/GlobalSignals').windowResizedSignal.dispatch();
JSON.stringify({
	inCamp: w.require('game/GameGlobals').playerHelper.isInCamp(),
	chipWidth: d.getElementById('btn-room').getBoundingClientRect().width
});
```

Expected: `inCamp` true, `chipWidth` 0.

Then resize the harness iframe to 1200x800 and, back outside camp:

```js
var f = document.getElementById('frame');
var w = f.contentWindow, d = w.document;
w.require('game/GlobalSignals').windowResizedSignal.dispatch();
JSON.stringify({
	small: d.body.className.indexOf('layout-small') >= 0,
	chipWidth: d.getElementById('btn-room').getBoundingClientRect().width,
	sectorHeaderDisplay: w.getComputedStyle(d.getElementById('header-sector')).display
});
```

Expected: `small` false, `chipWidth` 0, and `sectorHeaderDisplay` **not** `"none"` — the regular layout keeps its heading.

- [ ] **Step 10: Revert the temporary urlArgs bump and commit**

Set `urlArgs` in `src/config.js` back to `v=0.6.3.m51`.

```bash
git add index.html src/game/systems/ui/UIOutLevelSystem.js src/game/systems/ui/UIOutHeaderSystem.js css/modules/mobile.less css/main.css
git commit -m "$(cat <<'EOF'
Put the room name in the banner

It was an h2 in the scrolling page, so it left the screen as soon as the player
read anything below it. The banner is the one row on screen on every tab, and
the name belongs to where you are standing rather than to which tab you are
looking at - so the chip stays put across tabs instead of reflowing the banner
on every switch.

One row, not two. The chip takes what the title and the adventurer chip leave
and ellipsises; a sector header runs as long as "A narrow dark alley with
camp", and a second banner row would cost a band of fixed chrome on every
screen. The full text is one tap away in the next commit.

The h2 is hidden rather than moved: the regular layout still reads it, and a
button is not an h2. Both are written from the same string.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RdwYuefzDpdNimUouuhpzG
EOF
)"
```

---

## Task 6: The room description as a panel

**Files:**
- Modify: `index.html:849` — add `#room-panel` beside the map tooltip
- Modify: `src/game/systems/ui/UIOutHeaderSystem.js` — `updateLayout` (~line 1311), a new `updateRoomPanelPlacement`
- Modify: `src/game/UIFunctions.js` — after the `#btn-adventurer` handler (~line 223)
- Modify: `css/modules/mobile.less` — a new section after the room chip rules from Task 5
- Regenerate: `css/main.css`

**Interfaces:**
- Consumes: `#btn-room` from Task 5; `--l13-chrome-height` from Task 2
- Produces:
  - `GameGlobals.uiFunctions.toggleRoomPanel(show)` — sets or clears `body.room-panel-open` and the chip's `aria-expanded`. Task 7 calls it with `true`.
  - `body.room-panel-open` as the class that drives the panel.

- [ ] **Step 1: Add the panel**

In `index.html`, replace line 847-849:

```html
	<!-- map sector hover tooltip (body level so the map scroll container cannot clip it) -->

	<div id="map-sector-tooltip" role="tooltip" aria-hidden="true" style="display: none;"></div>
```

with:

```html
	<!-- map sector hover tooltip (body level so the map scroll container cannot clip it) -->

	<div id="map-sector-tooltip" role="tooltip" aria-hidden="true" style="display: none;"></div>

	<!-- the room description, on a phone (see mobile.less). UIOutHeaderSystem
	     moves #out-desc in here in the small layout and puts it back on the way
	     out - the same element, not a copy, so every existing write into it
	     still lands. -->

	<div id="room-panel" class="hidden-by-popups">
		<button id="btn-room-panel-close" class="context btn-glyph" aria-label="Close room description">&times;</button>
	</div>
```

- [ ] **Step 2: Move `#out-desc` in and out with the layout**

In `src/game/systems/ui/UIOutHeaderSystem.js`, replace line 1311:

```js
			this.updateLocationHeaderPlacement(isShell);
```

with:

```js
			this.updateLocationHeaderPlacement(isShell);
			this.updateRoomPanelPlacement(isShell);
```

Then insert this method immediately after `updateLocationHeaderPlacement` ends (after its closing `},` at line 1417):

```js
		// The room description is a panel over the top of the page on a phone,
		// not a block in the middle of the scroll. The element itself moves, and
		// is not copied, so every existing write from UIOutLevelSystem still
		// lands and nothing there has to know about the panel.
		updateRoomPanelPlacement: function (shouldDock) {
			let $desc = $("#out-desc");
			if ($desc.length === 0) return;

			if (shouldDock) {
				let $panel = $("#room-panel");
				if ($panel.length === 0) return;
				if ($desc.parent().is($panel)) return;

				// a marker where it came from, so the regular layout gets it
				// back in its own place in the order rather than at the front
				if (!this.roomPanelMarker) {
					this.roomPanelMarker = document.createComment("out-desc");
					$desc.after(this.roomPanelMarker);
				}
				$panel.append($desc);
				return;
			}

			if (!this.roomPanelMarker) return;
			if ($desc[0].nextSibling === this.roomPanelMarker) return;
			$(this.roomPanelMarker).before($desc);
			this.elements.body.removeClass("room-panel-open");
		},
```

- [ ] **Step 3: Add the open, close and toggle mechanics**

In `src/game/UIFunctions.js`, immediately after the `$("#btn-adventurer").click(...)` handler that ends at line 223, insert:

```js
			// The room description, on a phone. It opens by itself when the
			// room is new - see UIOutLevelSystem - and this is the way back to
			// it, and the way out of it.
			//
			// Any tap closes it. Every sector is a first visit, so a panel that
			// waited to be dismissed would cost a tap on almost every move; and
			// because it never covers the action bar, the tap that closes it is
			// usually the tap that does the next thing anyway.
			$("#btn-room").click(function (e) {
				// without this the document handler below closes the panel and
				// this handler opens it again, on every tap
				e.stopPropagation();
				GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.buttonClicked);
				uiFunctions.toggleRoomPanel(!$("body").hasClass("room-panel-open"));
			});

			$("#btn-room-panel-close").click(function (e) {
				e.stopPropagation();
				uiFunctions.toggleRoomPanel(false);
			});

			// This is the whole of the dismiss rule. A tab switch, a direction,
			// Scavenge and the panel itself are all clicks in the document, so
			// none of them needs a rule of its own.
			$(document).on("click", function () {
				if (!$("body").hasClass("room-panel-open")) return;
				uiFunctions.toggleRoomPanel(false);
			});
```

Then add the method itself. Insert it immediately before `toggle: function (element, show, signalParams, delay) {` at line 1767:

```js
			// One place decides whether the panel is on screen: the class drives
			// the stylesheet, and the chip says so for anything reading the
			// accessibility tree.
			toggleRoomPanel: function (show) {
				let isOpen = show === true;
				$("body").toggleClass("room-panel-open", isOpen);
				$("#btn-room").attr("aria-expanded", isOpen);
			},

```

- [ ] **Step 4: Style the panel**

In `css/modules/mobile.less`, immediately after the `body.layout-small #header-sector { display: none; }` block added in Task 5, insert:

```less
// THE ROOM PANEL
// The description was several paragraphs in the middle of the scrolling page,
// above the compass and the buttons the player reaches for between moves. It
// hangs under the chrome instead, and it is capped so it never reaches the
// bottom chrome - so the tap that closes it can be the tap that does the next
// thing. See UIFunctions.toggleRoomPanel.

#room-panel {
	display: none;
}

body.layout-small.room-panel-open #room-panel {
	display: block;
	position: fixed;
	top: var(--l13-chrome-height);
	left: 10px;
	right: 10px;
	// over the toasts (7), under the drawer (8) and the pill (9)
	z-index: 7;
	margin-top: 6px;
	padding: 8px 10px 10px 10px;
	box-sizing: border-box;
	// what is left of the screen once both bands of chrome have taken theirs
	max-height: ~"calc(100dvh - var(--l13-chrome-height) - var(--l13-out-bottom-height) - 26px)";
	overflow-y: auto;
	background: var(--l13-mobile-bg);
	border: 1px solid var(--l13-mobile-border);
	border-radius: 6px;
	box-shadow: 0 4px 14px -4px var(--l13-mobile-divider-shadow);
}

// the right margin is the room the close button needs
body.layout-small #room-panel #out-desc {
	margin: 0 20px 0 0;
}

body.layout-small #room-panel #out-desc p {
	margin: 0 0 6px 0;
}

body.layout-small #room-panel #out-desc p:last-child {
	margin-bottom: 0;
}

#btn-room-panel-close {
	display: none;
}

body.layout-small.room-panel-open #btn-room-panel-close {
	display: block;
	position: absolute;
	top: 2px;
	right: 4px;
	margin: 0;
	padding: 0 6px;
	font-size: 1.1rem;
	line-height: 1.2;
}

body.touch #btn-room-panel-close::after {
	content: "";
	position: absolute;
	inset: -10px;
}

// landscape is the map and nothing else
body.landscape-map #room-panel {
	display: none !important;
}
```

The close button is `position: absolute` against the panel, which works because a `position: fixed` element is a containing block for its absolutely positioned children.

- [ ] **Step 5: Syntax check and recompile**

```bash
node --check src/game/systems/ui/UIOutHeaderSystem.js && node --check src/game/UIFunctions.js && npx -p less lessc css/main.less css/main.css
```

Expected: no output, exit code 0.

- [ ] **Step 6: Verify the element moved, and that its writes still land**

Bump `urlArgs` in `src/config.js` to `v=0.6.3.m51a`, reload the harness page, get the player outside camp on the exploration tab, then:

```js
var f = document.getElementById('frame');
var w = f.contentWindow, d = w.document;
w.require('game/GlobalSignals').windowResizedSignal.dispatch();
var desc = d.getElementById('out-desc');
JSON.stringify({
	parent: desc.parentElement.id,
	hasText: desc.textContent.trim().length > 20,
	statsStillInPage: d.getElementById('out-desc-stats').closest('#room-panel') === null
});
```

Expected: `parent` is `room-panel`, `hasText` true, `statsStillInPage` true.

- [ ] **Step 7: Verify the chip opens and closes the panel**

```js
var f = document.getElementById('frame');
var w = f.contentWindow, d = w.document;
var panel = d.getElementById('room-panel');
var chip = d.getElementById('btn-room');
chip.click();
var opened = { display: w.getComputedStyle(panel).display, aria: chip.getAttribute('aria-expanded') };
chip.click();
var closed = { display: w.getComputedStyle(panel).display, aria: chip.getAttribute('aria-expanded') };
JSON.stringify({ opened: opened, closed: closed });
```

Expected: `opened.display` `"block"` with `aria` `"true"`; `closed.display` `"none"` with `aria` `"false"`.

- [ ] **Step 8: Verify the panel clears the bottom chrome**

```js
var f = document.getElementById('frame');
var w = f.contentWindow, d = w.document;
d.getElementById('btn-room').click();
w.requestAnimationFrame(function () {
	var panel = d.getElementById('room-panel').getBoundingClientRect();
	var bars = ['out-sector-bar', 'out-container-compass'].map(function (id) {
		var el = d.getElementById(id);
		if (!el || el.getBoundingClientRect().height === 0) return null;
		return { id: id, top: Math.round(el.getBoundingClientRect().top) };
	}).filter(Boolean);
	var overlaps = bars.filter(function (b) { return panel.bottom > b.top; }).map(function (b) { return b.id; });
	w.console.log('ROOM_CLEARANCE ' + JSON.stringify({
		panelBottom: Math.round(panel.bottom),
		bars: bars,
		overlaps: overlaps
	}));
	d.getElementById('btn-room').click();
});
```

Expected: `overlaps` is `[]`.

- [ ] **Step 9: Verify any tap closes it, and check it with hit testing**

```js
var f = document.getElementById('frame');
var w = f.contentWindow, d = w.document;
d.getElementById('btn-room').click();
var openBefore = d.body.className.indexOf('room-panel-open') >= 0;
// hit test the middle of the page, well below the panel, and click whatever
// is actually there rather than what we assume is there
var pane = d.getElementById('grid-switch-content').getBoundingClientRect();
var target = d.elementFromPoint(pane.left + pane.width / 2, pane.bottom - 20);
target.click();
JSON.stringify({
	openBefore: openBefore,
	targetTag: target.tagName,
	openAfter: d.body.className.indexOf('room-panel-open') >= 0
});
```

Expected: `openBefore` true, `openAfter` false.

- [ ] **Step 10: Verify the regular layout puts the description back**

Resize the harness iframe to 1200x800, then:

```js
var f = document.getElementById('frame');
var w = f.contentWindow, d = w.document;
w.require('game/GlobalSignals').windowResizedSignal.dispatch();
var desc = d.getElementById('out-desc');
JSON.stringify({
	small: d.body.className.indexOf('layout-small') >= 0,
	parent: desc.parentElement.className,
	previousSiblingID: desc.previousElementSibling ? desc.previousElementSibling.id : null,
	nextSiblingID: desc.nextElementSibling ? desc.nextElementSibling.id : null,
	visible: desc.getBoundingClientRect().height > 0
});
```

Expected: `small` false, `previousSiblingID` `header-sector`, `nextSiblingID` `out-desc-stats`, `visible` true. The description must be back in its own place in the reading order, not at the front.

- [ ] **Step 11: Revert the temporary urlArgs bump and commit**

Set `urlArgs` in `src/config.js` back to `v=0.6.3.m51`.

```bash
git add index.html src/game/systems/ui/UIOutHeaderSystem.js src/game/UIFunctions.js css/modules/mobile.less css/main.css
git commit -m "$(cat <<'EOF'
Make the room description a panel instead of a block in the page

It was several paragraphs in the middle of the scroll, above the compass and
the buttons a player reaches for between every move. It hangs under the chrome
now, capped so it never reaches the bottom chrome.

The element moves rather than being copied, the way the level banner and the
action bar already do, so every write UIOutLevelSystem makes into #out-desc
still lands and nothing there has to know the panel exists. A marker holds its
place in the page, so the regular layout gets it back between the header and
the stats table rather than at the front.

Any tap closes it. Because it never covers the action bar, that tap is usually
the tap that does the next thing. The chip is the exception - it stops
propagation and toggles, so it is the one control that can also open it.

The scavenged and investigated table stays in the page: it changes while the
player scavenges, so it belongs where it can update without being reopened.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RdwYuefzDpdNimUouuhpzG
EOF
)"
```

---

## Task 7: Open the panel when the room is new

**Files:**
- Modify: `src/game/systems/ui/UIOutLevelSystem.js` — `updateSectorDescription` (~line 1246), a new `updateRoomIntro` and `getStringHash`

**Interfaces:**
- Consumes: `GameGlobals.uiFunctions.toggleRoomPanel(show)` from Task 6; the local `sectorHeaderText` introduced in `updateSectorDescription` by Task 5
- Produces: nothing that later tasks rely on

- [ ] **Step 1: Add the decision**

In `src/game/systems/ui/UIOutLevelSystem.js`, at the end of `updateSectorDescription`, replace lines 1271-1273:

```js
			// Scavenged / investigated / found, as a table of its own
			this.elements.descriptionStats.html(this.getSectorStatsTable(isScouted, featuresComponent, sectorStatus));
		},
```

with:

```js
			// Scavenged / investigated / found, as a table of its own
			this.elements.descriptionStats.html(this.getSectorStatsTable(isScouted, featuresComponent, sectorStatus));

			this.updateRoomIntro(sectorHeaderText, hasVision, features, isScouted, hasCampHere);
		},

		// The description used to be on screen simply because it was in the
		// page. Now that it is a panel, something has to decide when a player
		// who has not asked for it should see it: the first time they stand
		// here, and any time the room itself has changed since.
		//
		// The key is the room's identity, NOT the rendered description. That
		// text carries the glowstick countdown and whether there are enemies
		// about, so hashing it would re-open the panel on almost every tick.
		//
		// Held in memory and not saved. The save format uses two-letter keys
		// and drops falsy values to stay small, and a hash per sector across a
		// whole world would cost real bytes for a cosmetic memory. The only
		// visible effect is that reloading re-shows the intro for the one room
		// you load into.
		updateRoomIntro: function (sectorHeaderText, hasVision, features, isScouted, hasCampHere) {
			if (!this.shownRoomIntros) this.shownRoomIntros = {};

			let position = this.playerPosNodes.head.position;
			let positionKey = position.level + "." + position.sectorX + "." + position.sectorY;

			let introKey = [
				sectorHeaderText,
				TextConstants.getSectorDescription(hasVision, features),
				isScouted ? 1 : 0,
				hasCampHere ? 1 : 0
			].join("|");

			let hash = this.getStringHash(introKey);

			if (this.shownRoomIntros[positionKey] === hash) return;

			this.shownRoomIntros[positionKey] = hash;

			// the panel is a small-layout thing, and it has nothing to say
			// about a camp, about a player who cannot see, or about a screen
			// that already has a popup on it
			if (!$("body").hasClass("layout-small")) return;
			if (position.inCamp) return;
			if ($("body").hasClass("vision-step-0")) return;
			// isPaused covers the popups too: UIPopupManager sets it from
			// hasOpenPopup() every time a popup opens or closes
			if (GameGlobals.gameState.isPaused) return;

			GameGlobals.uiFunctions.toggleRoomPanel(true);
		},

		// djb2. Short keys, thousands of sectors, and only ever compared with
		// itself - a collision costs one intro that is not shown.
		getStringHash: function (s) {
			let hash = 5381;
			for (let i = 0; i < s.length; i++) {
				hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0;
			}
			return hash;
		},
```

- [ ] **Step 2: Syntax check**

```bash
node --check src/game/systems/ui/UIOutLevelSystem.js
```

Expected: no output, exit code 0.

- [ ] **Step 3: Verify a first visit opens the panel**

Bump `urlArgs` in `src/config.js` to `v=0.6.3.m51a`, reload the harness page, get the player outside camp on the exploration tab, then move to an unvisited sector by clicking a direction button and check:

```js
var f = document.getElementById('frame');
var w = f.contentWindow, d = w.document;
var out = { before: d.body.className.indexOf('room-panel-open') >= 0 };
var move = d.querySelector('#table-out-actions-movement button:not([disabled])');
out.moveID = move ? move.id : null;
if (move) move.click();
w.setTimeout(function () {
	out.after = d.body.className.indexOf('room-panel-open') >= 0;
	out.panelText = d.getElementById('out-desc').textContent.trim().slice(0, 40);
	w.console.log('ROOM_INTRO ' + JSON.stringify(out));
}, 1200);
```

Expected: `after` true, and `panelText` non-empty.

- [ ] **Step 4: Verify a revisit stays quiet**

From that sector, move back the way you came, then move forward again. The second arrival at the first sector must not open the panel:

```js
var f = document.getElementById('frame');
var w = f.contentWindow, d = w.document;
w.require('game/GameGlobals').uiFunctions.toggleRoomPanel(false);
var moves = Array.prototype.slice.call(d.querySelectorAll('#table-out-actions-movement button:not([disabled])'));
if (moves.length > 0) moves[0].click();
w.setTimeout(function () {
	var GameGlobals = w.require('game/GameGlobals');
	GameGlobals.uiFunctions.toggleRoomPanel(false);
	var back = Array.prototype.slice.call(d.querySelectorAll('#table-out-actions-movement button:not([disabled])'));
	if (back.length > 0) back[0].click();
	w.setTimeout(function () {
		w.console.log('ROOM_REVISIT ' + JSON.stringify({
			open: d.body.className.indexOf('room-panel-open') >= 0
		}));
	}, 1200);
}, 1200);
```

Expected: `open` false. If the two clicks did not land on opposite directions, repeat with a sector that has exactly two exits.

- [ ] **Step 5: Verify a glowstick or a passing tick does not re-open it**

Stand still with the panel closed and drive the game for several seconds:

```js
var f = document.getElementById('frame');
var w = f.contentWindow, d = w.document;
w.require('game/GameGlobals').uiFunctions.toggleRoomPanel(false);
var reopened = false;
var timer = w.setInterval(function () {
	if (d.body.className.indexOf('room-panel-open') >= 0) reopened = true;
}, 200);
w.setTimeout(function () {
	w.clearInterval(timer);
	w.console.log('ROOM_STILL ' + JSON.stringify({ reopened: reopened }));
}, 8000);
```

Expected: `reopened` false. This is the check that the identity key, and not the rendered text, is what is hashed.

- [ ] **Step 6: Verify scouting re-opens it**

Close the panel, then scout the current sector:

```js
var f = document.getElementById('frame');
var w = f.contentWindow, d = w.document;
w.require('game/GameGlobals').uiFunctions.toggleRoomPanel(false);
var scout = d.getElementById('out-action-scout');
var canScout = scout && !scout.disabled && scout.getBoundingClientRect().width > 0;
if (canScout) scout.click();
w.setTimeout(function () {
	w.console.log('ROOM_SCOUT ' + JSON.stringify({
		canScout: canScout,
		open: d.body.className.indexOf('room-panel-open') >= 0
	}));
}, 2500);
```

Expected: `canScout` true and `open` true. If `canScout` is false, move to an unscouted sector first and repeat.

- [ ] **Step 7: Verify camp and the regular layout stay quiet**

Enter camp, then leave it, and check the panel never opened while in camp:

```js
var f = document.getElementById('frame');
var w = f.contentWindow, d = w.document;
var GameGlobals = w.require('game/GameGlobals');
JSON.stringify({
	inCamp: GameGlobals.playerHelper.isInCamp(),
	open: d.body.className.indexOf('room-panel-open') >= 0
});
```

Expected: `inCamp` true, `open` false.

Then resize the harness iframe to 1200x800, move to a new sector, and check:

```js
var f = document.getElementById('frame');
var w = f.contentWindow, d = w.document;
JSON.stringify({
	small: d.body.className.indexOf('layout-small') >= 0,
	open: d.body.className.indexOf('room-panel-open') >= 0
});
```

Expected: `small` false, `open` false.

- [ ] **Step 8: Revert the temporary urlArgs bump and commit**

Set `urlArgs` in `src/config.js` back to `v=0.6.3.m51`.

```bash
git add src/game/systems/ui/UIOutLevelSystem.js
git commit -m "$(cat <<'EOF'
Show the room description when the room is new

The description used to be on screen because it was in the page. Now that it
is a panel, something has to decide when a player who has not asked for it
should see it: the first time they stand somewhere, and any time the room has
changed since.

What is hashed is the room's identity - the header, the static description, the
scouted flag, whether a camp is here - and not the rendered text. That text
carries the glowstick countdown and whether enemies are about, so hashing it
would have re-opened the panel on almost every tick.

Held in memory, not saved. The save format uses two-letter keys and drops falsy
values to stay small, and a hash per sector across a whole world would cost
real bytes for a cosmetic memory. Reloading re-shows the intro for the one room
you load into, which is the whole of the cost.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RdwYuefzDpdNimUouuhpzG
EOF
)"
```

---

## Task 8: Version bump and changelog

The four cache busters are separate and all four must move together. A stale `CACHE_VERSION` serves old assets from the service worker indefinitely.

**Files:**
- Modify: `changelog.json` — new top entry
- Modify: `changelog.html` — the human-readable copy, and its three `?v=` links
- Modify: `src/config.js:30` — `urlArgs`
- Modify: `index.html:32-34` — the three `?v=` links
- Modify: `sw.js:15` — `CACHE_VERSION`

**Interfaces:**
- Consumes: everything from Tasks 1-7
- Produces: the version `0.6.3.m52`

- [ ] **Step 1: Add the changelog entry**

In `changelog.json`, insert this object as the first element of `versions`, before the `0.6.3.m51` entry:

```json
        {
            "version": "0.6.3.m52",
            "requiredVersion": "0.6.1",
            "phase": "beta",
            "final": true,
            "released": "2026-08-04",
            "changes": [
                {
                    "type": "UI",
                    "summary": "New log messages now appear as cards under the header for a few seconds, so a message can be read as it arrives instead of only counted by the badge"
                },
                {
                    "type": "UI",
                    "summary": "The room you are standing in is named in the top bar, and tapping it shows the description"
                },
                {
                    "type": "UI",
                    "summary": "The room description opens by itself the first time you stand somewhere, and closes on the next thing you do"
                },
                {
                    "type": "BUGFIX",
                    "summary": "The floating log button no longer covers the save button in the footer"
                }
            ]
        },
```

Keep `requiredVersion` a plain three-part version, keep `final: true`, and keep at least one `changes` item — `getCurrentVersion` skips entries with no changes, and `final: false` triggers an "unsupported version" popup.

- [ ] **Step 2: Add the matching entry to `changelog.html`**

Open `changelog.html`, find the block for `0.6.3.m51`, and add the same four items above it in the same markup shape that block uses.

- [ ] **Step 3: Move all four cache busters**

Replace every occurrence of `0.6.3.m51` with `0.6.3.m52` in these four places:

```bash
sed -i '' 's/0\.6\.3\.m51/0.6.3.m52/g' src/config.js sw.js index.html changelog.html
```

- [ ] **Step 4: Verify nothing was missed**

```bash
grep -rn "0\.6\.3\.m51" src/config.js sw.js index.html changelog.html changelog.json
```

Expected: only the historical `0.6.3.m51` entries inside `changelog.json` and `changelog.html`. No hit in `src/config.js`, `sw.js`, or the `<link>` tags of `index.html`.

Then confirm the four current values agree:

```bash
grep -n "urlArgs" src/config.js; grep -n "^var CACHE_VERSION" sw.js; grep -c "v=0.6.3.m52" index.html
```

Expected: `urlArgs: "v=0.6.3.m52"`, `CACHE_VERSION = "0.6.3.m52"`, and a count of `3` for `index.html`.

- [ ] **Step 5: Verify the changelog parses and the version shows**

```bash
node -e "const c=require('./changelog.json'); const t=c.versions[0]; console.log(t.version, t.final, t.changes.length, t.requiredVersion);"
```

Expected: `0.6.3.m52 true 4 0.6.1`.

Then reload the harness page and check the footer:

```js
var f = document.getElementById('frame');
var w = f.contentWindow, d = w.document;
d.getElementById('game-version').textContent;
```

Expected: it contains `0.6.3.m52`.

- [ ] **Step 6: Final pass over the whole feature**

With the harness at 390x844 and the player outside camp:

1. Move to a new sector. The room panel opens with that room's text.
2. Tap a direction. The player moves and the panel shows the new room.
3. Scavenge. The panel closes and a card appears under the chrome.
4. Wait four seconds. The card is gone and the badge still counts it.
5. Tap the log pill. The drawer opens and the badge clears.
6. Tap the log pill again, switch to the bag tab, scroll to the bottom. The pill does not cover "save".

Take a screenshot at each of steps 1, 3 and 6. Screenshots force a paint, so they are the truthful view when a measurement and the screen disagree.

- [ ] **Step 7: Commit**

```bash
git add changelog.json changelog.html src/config.js index.html sw.js
git commit -m "$(cat <<'EOF'
Release 0.6.3.m52

Log toasts, the room name in the banner, the room description as a panel, and
the log pill off the save button.

All four cache busters move together: urlArgs, the three CSS link queries in
index.html and changelog.html, and CACHE_VERSION in sw.js. A stale
CACHE_VERSION serves old assets from the service worker indefinitely.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RdwYuefzDpdNimUouuhpzG
EOF
)"
```

---

## Self-review notes

**Spec coverage.** Every section of the spec maps to a task: toast widget → Task 3; toast feed, container, placement, suppression → Task 4; the room chip → Task 5; the panel and its dismiss rules → Task 6; the auto-open rule → Task 7; the footer reserve → Task 1; the chrome height both overlays need → Task 2; the version bump → Task 8.

**Two things the spec left implicit, decided here.**

1. The toast stack is cleared when the drawer opens (Task 4, Step 6). The spec only said no new toast is pushed while the drawer is open. A card already in flight when the player opens the drawer would repeat, over the drawer, what is now listed underneath it.
2. `updateRoomPanelPlacement` clears `room-panel-open` when it moves `#out-desc` back to the page (Task 6, Step 2). Otherwise a window resized from small to wide with the panel open leaves the class on the body and the chip inverted.

**Two guards the spec named that the plan does not implement separately.**

1. "A popup closes the panel." `UIPopupManager` sets `GameGlobals.gameState.isPaused` from `hasOpenPopup()` on every popup open and close (`src/game/helpers/ui/UIPopupManager.js:200`), so the `isPaused` guard in Task 7 already covers popups. `#room-panel` also carries `hidden-by-popups`, which is what hides an already-open panel.
2. "A tab change closes it." A tab switch is a click on `#switch-tabs`, which is in the document, so the delegated document handler in Task 6 already catches it. No separate subscription.
