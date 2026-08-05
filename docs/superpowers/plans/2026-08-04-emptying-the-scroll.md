# Emptying the scrolling widget — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the scavenged percentage and the resources list out of the scrolling centre column into fixed chrome, and correct five controls that real play has found wanting.

**Architecture:** Five independent tasks. Two move content between existing elements; three are small corrections to controls built in earlier releases.

**Tech Stack:** RequireJS AMD modules, jQuery as a global (never an AMD dependency), Ash entity-component-system, LESS compiled to `css/main.css`.

## Global Constraints

- **Never hand-edit `css/main.css`.** Edit `css/modules/mobile.less`, then recompile with `npx -p less lessc css/main.less css/main.css` from the repository root.
- **jQuery is an ambient global.** Never add `"jquery"` to a `define([...])` list.
- Every JavaScript file changed must pass `node --check <file>`.
- LESS needs `~"..."` escaping around `calc(...)`, `env(...)`, `min(...)` and `var(...)` with a fallback.
- Comments explain *why*, wrap near 78 columns, and match the surrounding style. Copy this plan's comments verbatim.
- Small layout only (`body.layout-small`). No rule may change `body.layout-regular` rendering.
- Do not bump any version number. The controller does the release.

---

### Task 1: A tapped toast counts as read

**Files:**
- Modify: `src/utils/UIToastStack.js`
- Modify: `src/game/systems/ui/UIOutLogSystem.js`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `UIToastStack.push(stack, text, onTap)` — the third argument is optional and is called with no arguments when the player taps the card, before it is dismissed. It is NOT called when the lifetime timer expires.

**Background.** Tapping a card dismisses it early, but the badge kept counting that message. A deliberate tap is a read. Expiry is not — that rule is why the badge exists and it does not change.

- [ ] **Step 1: Let a card carry a tap callback**

In `src/utils/UIToastStack.js`, find:

```js
		push: function (stack, text) {
			if (!stack) return null;
			if (!stack.$container || stack.$container.length === 0) return null;

			let sys = this;
			let card = { $root: $("<div class='log-toast'></div>"), timeoutID: null, fadeTimeoutID: null, isLeaving: false };
			card.$root.text(text);
			card.$root.on("click", function () { sys.dismiss(stack, card); });
```

Replace those eight lines with:

```js
		// onTap is optional and fires only for a real tap, never for the
		// lifetime timer. A glance is not a read; reaching for the card is.
		push: function (stack, text, onTap) {
			if (!stack) return null;
			if (!stack.$container || stack.$container.length === 0) return null;

			let sys = this;
			let card = { $root: $("<div class='log-toast'></div>"), timeoutID: null, fadeTimeoutID: null, isLeaving: false };
			card.$root.text(text);
			card.$root.on("click", function () {
				if (onTap) onTap();
				sys.dismiss(stack, card);
			});
```

- [ ] **Step 2: Syntax check**

```bash
node --check src/utils/UIToastStack.js
```

Expected: no output, exit status 0.

- [ ] **Step 3: Carry the message beside its text in the buffer**

In `src/game/systems/ui/UIOutLogSystem.js`, find this block inside `updateToasts`:

```js
			if (GameGlobals.gameState.uiStatus.isHidden) {
				for (let i = messages.length - 1; i >= 0; i--) {
					this.pendingToasts.push(this.getMessageText(messages[i]));
				}
```

Replace those four lines with:

```js
			if (GameGlobals.gameState.uiStatus.isHidden) {
				for (let i = messages.length - 1; i >= 0; i--) {
					// the message travels with its text: a card flushed later
					// still has to be able to mark the right one as read
					this.pendingToasts.push({ text: this.getMessageText(messages[i]), message: messages[i] });
				}
```

- [ ] **Step 4: Mark the tapped message read on the normal path**

In the same method, find the loop at the end of `updateToasts`:

```js
			for (let i = messages.length - 1; i >= 0; i--) {
				UIToastStack.push(this.toastStack, this.getMessageText(messages[i]));
			}
		},
```

Replace those four lines with:

```js
			let sys = this;
			for (let i = messages.length - 1; i >= 0; i--) {
				let message = messages[i];
				UIToastStack.push(this.toastStack, this.getMessageText(message), function () {
					sys.markOneMessageSeen(message);
				});
			}
		},

		// One message, not the whole log. markLogMessagesSeen exists for
		// opening the drawer, which really does mean "I have read all of
		// this"; a tap on one card says nothing about the rest.
		markOneMessageSeen: function (message) {
			if (!message) return;
			if (message.markedAsSeen) return;
			message.markedAsSeen = true;
			this.updateLogBadge();
		},
```

- [ ] **Step 5: Mark the tapped message read on the flush path**

Find the loop at the end of `flushPendingToasts`:

```js
			// oldest first, which is the order they were held in and the order
			// the cap evicts by
			for (let i = 0; i < pending.length; i++) {
				UIToastStack.push(this.toastStack, pending[i]);
			}
```

Replace those five lines with:

```js
			// oldest first, which is the order they were held in and the order
			// the cap evicts by
			let sys = this;
			for (let i = 0; i < pending.length; i++) {
				let held = pending[i];
				UIToastStack.push(this.toastStack, held.text, function () {
					sys.markOneMessageSeen(held.message);
				});
			}
```

- [ ] **Step 6: Syntax check**

```bash
node --check src/game/systems/ui/UIOutLogSystem.js
```

Expected: no output, exit status 0.

- [ ] **Step 7: Check nothing else pushes to the stack**

```bash
grep -n "UIToastStack.push" src/
```

Expected: exactly two matches, both in `src/game/systems/ui/UIOutLogSystem.js`, and both now passing three arguments. If there is a third call site, stop and report BLOCKED.

- [ ] **Step 8: Commit**

```bash
git add src/utils/UIToastStack.js src/game/systems/ui/UIOutLogSystem.js
git commit -m "Mark a log message read when its card is tapped"
```

---

### Task 2: The banner carries the room name in caps and the scavenged percentage

**Files:**
- Modify: `index.html` (a second span in `#btn-room`)
- Modify: `src/game/systems/ui/UIOutLevelSystem.js`
- Modify: `css/modules/mobile.less`
- Regenerate: `css/main.css`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing other tasks rely on. Task 3 also edits `getSectorStatsFields` in the same file; this task removes the scavenged field, Task 3 removes the resources field. Task 3 runs after this one and will see the file as this task leaves it.

**Background.** The banner reads `[icon] LEVEL 11  room name  [adventurer]`. It gains the scavenged percentage after the name, and the name is set in caps to match the default client. The percentage sits outside the ellipsis so it can never be truncated; the name truncates as it already does.

- [ ] **Step 1: Add the percentage span**

In `index.html`, find:

```html
						<button id="btn-room" class="btn-meta hidden-when-down" aria-expanded="false" style="display:none"><span></span></button>
```

Replace it with:

```html
						<!-- two spans: the name ellipsises, the percentage never
						     does. A number cut in half is a wrong number. -->
						<button id="btn-room" class="btn-meta hidden-when-down" aria-expanded="false" style="display:none"><span id="btn-room-name"></span><span id="btn-room-scavenged"></span></button>
```

- [ ] **Step 2: Point the system at the new span**

In `src/game/systems/ui/UIOutLevelSystem.js`, find:

```js
			this.elements.roomName = $("#btn-room span");
```

Replace it with:

```js
			this.elements.roomName = $("#btn-room-name");
			this.elements.roomScavenged = $("#btn-room-scavenged");
```

If that line does not appear exactly, search for `roomName` in the file and report BLOCKED with what you found.

- [ ] **Step 3: Write the percentage**

In the same file, find these two lines inside `updateSectorDescription`:

```js
			this.elements.sectorHeader.text(sectorHeaderText);
			this.elements.roomName.text(sectorHeaderText);
```

Replace them with:

```js
			this.elements.sectorHeader.text(sectorHeaderText);
			this.elements.roomName.text(sectorHeaderText);

			// Scavenged, in the banner rather than in the scrolling page. It
			// reads "(?)" until the room is scouted so the banner keeps its
			// shape - nothing shifts under the thumb at the moment of
			// scouting, which is exactly when the player is tapping.
			let scavengedText = "(?)";
			if (isScouted && GameGlobals.gameState.unlockedFeatures.scavenge) {
				scavengedText = "(" + Math.floor(sectorStatus.getScavengedPercent()) + "%)";
			}
			this.elements.roomScavenged.text(scavengedText);
```

- [ ] **Step 4: Take the percentage out of the stats table**

In the same file, find this block inside `getSectorStatsFields`:

```js
			if (isScouted && GameGlobals.gameState.unlockedFeatures.scavenge) {
				fields.push(Text.t("ui.exploration.sector_status_scavenged_percent_field", UIConstants.roundValue(Math.floor(statusComponent.getScavengedPercent()))));
			}

```

Delete all four lines. The percentage is in the banner now and does not need a second home.

- [ ] **Step 5: Syntax check**

```bash
node --check src/game/systems/ui/UIOutLevelSystem.js
```

Expected: no output, exit status 0.

- [ ] **Step 6: Style the two spans**

In `css/modules/mobile.less`, find:

```less
body.layout-small #grid-location-header > #btn-room > span {
	display: block;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
```

Replace it with:

```less
// The chip is a row of two: the name, which gives up its width first, and the
// percentage, which never does.
body.layout-small #grid-location-header > #btn-room {
	display: flex;
	align-items: baseline;
	gap: 4px;
}

// Caps, as the default client sets its headers.
body.layout-small #grid-location-header > #btn-room > #btn-room-name {
	flex: 0 1 auto;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	text-transform: uppercase;
}

// A truncated number is a wrong number, so this one is never allowed to
// shrink. It is the room name that gives way.
body.layout-small #grid-location-header > #btn-room > #btn-room-scavenged {
	flex: 0 0 auto;
	white-space: nowrap;
	opacity: 0.75;
}

// empty in camp, where there is no room and no percentage
body.layout-small #grid-location-header > #btn-room > span:empty {
	display: none;
}
```

- [ ] **Step 7: Recompile and verify**

```bash
npx -p less lessc css/main.less css/main.css
grep -c "text-transform: uppercase" css/main.css
grep -c "btn-room-scavenged" css/main.css
```

Expected: both counts are at least 1. Then:

```bash
grep -c "sector_status_scavenged_percent_field" src/game/systems/ui/UIOutLevelSystem.js
```

Expected: `0`.

- [ ] **Step 8: Commit**

```bash
git add index.html src/game/systems/ui/UIOutLevelSystem.js css/modules/mobile.less css/main.css
git commit -m "Put the room name in caps and the scavenged percentage in the banner"
```

---

### Task 3: The resources list moves to the action panel

**Files:**
- Modify: `index.html` (a row at the top of `#out-container-compass`)
- Modify: `src/game/systems/ui/UIOutLevelSystem.js`
- Modify: `css/modules/mobile.less`
- Regenerate: `css/main.css`

**Interfaces:**
- Consumes: `getSectorStatsFields` as Task 2 leaves it — Task 2 has already removed the scavenged field from it. Do not re-add it.
- Produces: nothing other tasks rely on.

**Background.** `#out-container-compass` is the band that holds the minimap and the movement buttons in the small layout, below the action buttons. A single always-present row goes at the top of it. Always present, because a row that comes and goes would move the direction buttons under the player's thumb between one scavenge and the next.

- [ ] **Step 1: Add the row**

In `index.html`, find:

```html
						<div class="unit unit-compass" id="out-container-compass">
							<div id="minimap-background-container" class="canvas-container">
```

Replace those two lines with:

```html
						<div class="unit unit-compass" id="out-container-compass">
							<!-- Out of the scrolling page and into the band that
							     already holds the minimap. Always present, even
							     with nothing to say: a row that appears and
							     disappears moves the direction buttons under the
							     player's thumb between one scavenge and the next. -->
							<div id="out-resources-row"><span class="label text-key" data-text-key="ui.exploration.sector_status_resources_found_field_label">Resources</span>: <span id="out-resources-value">?</span></div>
							<div id="minimap-background-container" class="canvas-container">
```

Note: if `ui.exploration.sector_status_resources_found_field_label` does not resolve, the literal `Resources` in the span is what shows, which is correct English and acceptable. Do not add a text key to the language files.

- [ ] **Step 2: Point the system at the row**

In `src/game/systems/ui/UIOutLevelSystem.js`, find:

```js
			this.elements.descriptionStats = $("#out-desc-stats");
```

Add this line immediately after it, at the same indentation:

```js
			this.elements.resourcesValue = $("#out-resources-value");
```

- [ ] **Step 3: Extract the resources text so it has one source**

In the same file, find this block inside `getSectorStatsFields`:

```js
			let scavengedPercent = statusComponent.getScavengedPercent();
			let discoveredResources = GameGlobals.sectorHelper.getLocationDiscoveredResources();
			let knownResources = GameGlobals.sectorHelper.getLocationKnownResources();
			
			let resourcesFoundValueText = "";
			if (knownResources.length > 0) {
				resourcesFoundValueText = TextConstants.getScaResourcesString(discoveredResources, knownResources, featuresComponent.resourcesScavengable);
			} else if (scavengedPercent >= ExplorationConstants.THRESHOLD_SCAVENGED_PERCENT_REVEAL_NO_RESOURCES) {
				if (featuresComponent.resourcesScavengable.getTotal() > 0) {
					resourcesFoundValueText = Text.t("ui.common.value_unknown");
				} else {
					resourcesFoundValueText = Text.t("ui.common.list_template_zero");
				}
			} else {
				resourcesFoundValueText = Text.t("ui.common.value_unknown");
			}
			fields.push(Text.t("ui.exploration.sector_status_resources_found_field", resourcesFoundValueText));

```

Delete all of it — every line above, including the blank line at the end.

Then find the start of that method:

```js
		getSectorStatsFields: function (isScouted, featuresComponent, statusComponent) {
```

Insert this new method immediately **before** it, at the same indentation:

```js
		// The resources list, in one place. It used to be built inline in
		// getSectorStatsFields; it is its own row in the action band now, and
		// the rule for what to show when nothing is known belongs with it
		// rather than with the table it left.
		getResourcesFoundText: function (featuresComponent, statusComponent) {
			if (!featuresComponent || !statusComponent) return Text.t("ui.common.value_unknown");

			let knownResources = GameGlobals.sectorHelper.getLocationKnownResources();
			if (knownResources.length > 0) {
				let discoveredResources = GameGlobals.sectorHelper.getLocationDiscoveredResources();
				return TextConstants.getScaResourcesString(discoveredResources, knownResources, featuresComponent.resourcesScavengable);
			}

			let scavengedPercent = statusComponent.getScavengedPercent();
			if (scavengedPercent >= ExplorationConstants.THRESHOLD_SCAVENGED_PERCENT_REVEAL_NO_RESOURCES) {
				if (featuresComponent.resourcesScavengable.getTotal() > 0) return Text.t("ui.common.value_unknown");
				return Text.t("ui.common.list_template_zero");
			}

			return Text.t("ui.common.value_unknown");
		},

```

- [ ] **Step 4: Write the row**

In the same file, find this line inside `updateSectorDescription`:

```js
			this.elements.descriptionStats.html(this.getSectorStatsTable(isScouted, featuresComponent, sectorStatus));
```

Add these lines immediately after it, at the same indentation:

```js
			this.elements.resourcesValue.text(this.getResourcesFoundText(featuresComponent, sectorStatus));
```

- [ ] **Step 5: Syntax check**

```bash
node --check src/game/systems/ui/UIOutLevelSystem.js
```

Expected: no output, exit status 0.

- [ ] **Step 6: Style the row**

In `css/modules/mobile.less`, find this rule:

```less
body.layout-small #unit-main > #out-container-compass {
	position: static;
	flex: 0 0 auto;
```

Insert this rule immediately **before** that one:

```less
// The resources row, at the top of the band that holds the minimap and the
// direction buttons. One line, and it stays one line: the list is short and
// wrapping it would push the buttons down the screen.
body.layout-small #out-container-compass > #out-resources-row {
	display: block;
	padding: 4px 10px 2px 10px;
	font-size: 0.85rem;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

body.layout-small #out-container-compass > #out-resources-row > .label {
	opacity: 0.75;
}

// the regular layout keeps the list in the page, where it already was
body.layout-regular #out-resources-row {
	display: none;
}
```

- [ ] **Step 7: Recompile and verify**

```bash
npx -p less lessc css/main.less css/main.css
grep -c "out-resources-row" css/main.css
grep -c "sector_status_resources_found_field" src/game/systems/ui/UIOutLevelSystem.js
grep -c "getResourcesFoundText" src/game/systems/ui/UIOutLevelSystem.js
```

Expected: the first is at least 1; the second is `0`; the third is exactly `2` — the definition and the one call.

- [ ] **Step 8: Commit**

```bash
git add index.html src/game/systems/ui/UIOutLevelSystem.js css/modules/mobile.less css/main.css
git commit -m "Move the resources list into the action band"
```

---

### Task 4: Both close buttons go, and a tap dismisses the map panel

**Files:**
- Modify: `css/modules/mobile.less`
- Modify: `src/game/systems/ui/UIOutMapSystem.js`
- Regenerate: `css/main.css`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing other tasks rely on.

**Background.** Both panels close on a tap already, or should. A close button that duplicates "tap anywhere" earns nothing and costs a box in the corner of the text. The minimap already has tap-to-show and tap-elsewhere-to-hide; the main map is getting the same, not a second mechanism.

- [ ] **Step 1: Take the close button off the room panel**

In `css/modules/mobile.less`, find:

```less
// the right margin is the room the close button needs
body.layout-small #room-panel #out-desc {
	margin: 0 20px 0 0;
}
```

Replace it with:

```less
body.layout-small #room-panel #out-desc {
	margin: 0;
}
```

Then find:

```less
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
```

Replace both rules with:

```less
// No close button on a phone. Any tap already closes this panel, so the button
// only duplicated the gesture and cost a box in the corner of the text. The
// element stays in the markup for the regular layout, where the base rule
// keeps it hidden anyway.
```

- [ ] **Step 2: Take the close button off the map panel**

Find:

```less
body.layout-small #btn-mainmap-sector-details-close {
	display: block;
	position: absolute;
	top: 2px;
	right: 4px;
	margin: 0;
	padding: 0 6px;
	font-size: 1.1rem;
	line-height: 1.2;
}

body.touch #btn-mainmap-sector-details-close::after {
	content: "";
	position: absolute;
	inset: -10px;
}
```

Replace both rules with:

```less
// As with the room panel: a tap anywhere closes this, so the button is a
// duplicate gesture sitting on top of the text it is describing.
```

Then find this rule and check the heading no longer reserves room for it:

```less
body.layout-small #mainmap-sector-details-content h3 {
	margin: 0 24px 4px 0;
	font-size: 1rem;
}
```

Replace it with:

```less
body.layout-small #mainmap-sector-details-content h3 {
	margin: 0 0 4px 0;
	font-size: 1rem;
}
```

- [ ] **Step 3: Dismiss the map panel on a tap**

In `src/game/systems/ui/UIOutMapSystem.js`, find:

```js
			$("#btn-mainmap-sector-details-close").click($.proxy(this.deselectSector, this));
```

Add these lines immediately after it, at the same indentation:

```js
			// A tap anywhere closes the sector panel, the way the minimap's
			// tooltip already behaves. Delegated on the document rather than
			// bound to the map, so a tap on any other part of the screen
			// closes it too.
			//
			// Two exceptions, both by containment rather than by
			// stopPropagation on the cells: the cells' own handler is shared
			// with the minimap and must not change, and a tap inside the panel
			// is for the "(directions)" link or to scroll, not to close.
			this._onDocumentTapDeselectSector = $.proxy(this.onDocumentTapDeselectSector, this);
			$(document).on("click", this._onDocumentTapDeselectSector);
```

- [ ] **Step 4: Add the handler**

In the same file, find:

```js
		onSectorTapTooltip: function (e) {
```

Insert this method immediately **before** it, at the same indentation:

```js
		onDocumentTapDeselectSector: function (e) {
			if (!this.selectedSector) return;
			let $target = $(e.target);
			// a tap on a sector selects that one instead - its own handler has
			// already run by the time this does
			if ($target.closest(".map-overlay-cell").length > 0) return;
			// and a tap inside the panel or on the jump buttons is not a
			// request to close them
			if ($target.closest("#mainmap-sector-details").length > 0) return;
			this.deselectSector();
		},

```

- [ ] **Step 5: Unbind it**

Find the block that unbinds the minimap handlers:

```js
			if (this._onSectorTapTooltip) {
				$("#minimap-overlay").off("click", ".map-overlay-cell", this._onSectorTapTooltip);
				$("#minimap-background-overlay").off("click", ".map-hint-cell", this._onSectorTapTooltip);
				$(document).off("click", this._onDocumentTapHideTooltip);
			}
```

Add these lines immediately after that closing brace, at the same indentation:

```js
			if (this._onDocumentTapDeselectSector) {
				$(document).off("click", this._onDocumentTapDeselectSector);
			}
```

- [ ] **Step 6: Syntax check**

```bash
node --check src/game/systems/ui/UIOutMapSystem.js
```

Expected: no output, exit status 0.

- [ ] **Step 7: Recompile and verify**

```bash
npx -p less lessc css/main.less css/main.css
grep -c "btn-mainmap-sector-details-close" css/main.css
grep -c "btn-room-panel-close" css/main.css
```

Expected: each is exactly `1` — only the base `display: none` rule for each is left. If either is more than 1, list the matches and report which rule each belongs to before continuing.

- [ ] **Step 8: Commit**

```bash
git add css/modules/mobile.less css/main.css src/game/systems/ui/UIOutMapSystem.js
git commit -m "Close both panels with a tap instead of a button"
```

---

### Task 5: A tab is never block-level

**Files:**
- Modify: `css/modules/mobile.less`
- Regenerate: `css/main.css`

**Interfaces:**
- Consumes: nothing. Produces: nothing.

**Background.** Reported twice from play: `outside` and `bag` sit correctly on one row while `party` and `map` each take a full-width row of their own. The healthy tabs are the ones on screen since load; the broken ones are the two revealed later. A full-width tab means the `li` is block-level, and something is writing an inline display — an inline style beats a stylesheet rule, and `list-item` is what jQuery falls back to for an `li`.

The writer was not reproducible on this branch. There is exactly one correct display for a tab in this layout, so state it. The `!important` needs its own hide guard, because an important author declaration also beats jQuery's inline `display: none` — the same pairing as HIDE STILL MEANS HIDE at the end of the file.

- [ ] **Step 1: State the display**

In `css/modules/mobile.less`, find:

```less
body.layout-small ul#switch-tabs li {
	text-indent: 0;
```

Replace those two lines with:

```less
// !important because something in the load-and-unlock path writes an inline
// display on a tab, and an inline style beats a stylesheet rule. Reported
// twice from play: "outside" and "bag" correct on one row, "party" and "map"
// each taking a full-width row of their own - which is what an li does when it
// is block-level, and list-item is jQuery's fallback for an li it cannot
// restore. The writer was not reproducible here; there is one correct display
// for a tab in this layout, so it is stated rather than hoped for.
//
// Paired with the hide guard at the end of this rule set: an important author
// declaration also beats jQuery's inline `display: none`, so without it a
// hidden tab would show.
body.layout-small ul#switch-tabs li {
	display: inline-block !important;
	text-indent: 0;
```

- [ ] **Step 2: Keep hiding working**

Find the rule that immediately follows the one you just edited:

```less
body.layout-small ul#switch-tabs li.selected {
	padding-bottom: 5px;
}
```

Insert this immediately **before** it:

```less
// hide still means hide - see the section of that name at the end of the file
body.layout-small ul#switch-tabs li[style*="display: none"],
body.layout-small ul#switch-tabs li[style*="display:none"] {
	display: none !important;
}

```

- [ ] **Step 3: Recompile and verify**

```bash
npx -p less lessc css/main.less css/main.css
grep -c "switch-tabs li\[style" css/main.css
grep -n "display: inline-block !important" css/main.css | head -3
```

Expected: the first count is `2` — one rule for each of the two attribute selectors, or one rule carrying both; accept 1 or 2 and say which you got. The second prints at least one line.

- [ ] **Step 4: Commit**

```bash
git add css/modules/mobile.less css/main.css
git commit -m "Keep a tab inline-block whatever writes an inline display"
```
