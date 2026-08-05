# The landscape map, and three defects the phone showed

Date: 2026-08-04
Branch: `gh-pages-mobile`
Ships as: 0.6.3.m54

## Problem

Four items, reported from real play on an iPhone PWA.

1. **The landscape map wastes its width.** A phone on its side gives the whole
   screen to the map. The sector description is squeezed into a 30% rail beside
   it, where it is too narrow to read. Portrait already floats the description
   over the map as a panel; landscape undoes that and puts it back in the flow.
2. **The chrome slides under the status bar.** Now and then the whole app moves
   up behind the clock and stays there. Only a reload puts it right. The player
   says it follows a rotation.
3. **The chrome is stale after loading a save.** The level banner keeps the
   placeholder text from `index.html`, and the tab classes are missing, so the
   page renders in its unstyled stacked form.
4. **The opening message gets no toast.** "You are alone in a massive dark
   corridor" arrives with no card, unlike every later message.

## Scope

`body.layout-small` and `body.landscape-map` only. Nothing in the regular
layout changes.

---

## A. The landscape map

### What it does now

`css/modules/mobile.less` gives the portrait map tab a panel over the map:
`#mainmap-sector-details-content` is absolute, anchored to the control row, and
grows upward out of it. The LANDSCAPE MAP section then reverses that —
`position: relative; order: 1; flex: 1 0 100%` — and the description drops back
into the flow of a `30fr` rail.

### What it does instead

The panel floats over the map in landscape too, and the rail shrinks to what
the controls actually need.

- `grid-template-columns: 70fr 30fr` becomes `minmax(0, 1fr)` and a fixed rail.
  The rail carries two selects and up to seven glyph buttons; it needs a width
  in the 130-170px band, not a third of the screen. The exact number is
  measured in the browser during implementation and written into the rule.
- `#grid-switch-content` becomes the containing block (`position: relative`).
  `#mainmap-sector-details` stays `position: static` in landscape, which it
  already is, so an absolute panel resolves against the grid and can sit over
  the left column.
- The panel is absolute, anchored to the bottom left of the map column, capped
  in width and height, and keeps the card styling and the close button that
  portrait gives it.

Not `position: fixed`. Safari clips a fixed element inside a scrolling
container, and `#mainmap-sector-details` is one (`overflow-y: auto`). An
absolute box whose containing block is outside that scroller is not clipped by
it, which is the behaviour this relies on.

### The jump buttons

No new code. `selectNextSector` and its siblings already call `selectSector`,
and `updateSector` already toggles `#mainmap-sector-details-content` on
"a sector is selected". Once the panel floats, pressing "next" moves the
selection and raises the description over the map on its own. This item is
satisfied by the CSS above, and the verification step proves it.

---

## B. The chrome slides under the status bar

### Root cause

This device reports `env(safe-area-inset-top)` as 0. iOS lays the web view out
*below* the status bar rather than under it, so there is no inset to clear —
the comment at `mobile.less:1783` records exactly this, and a 20px floor was
removed because of it.

Rotation breaks that arrangement. Sideways, iOS lays the view out fullscreen.
Coming back to portrait it does not always restore the below-the-status-bar
layout, and `env(safe-area-inset-top)` still reads 0. So the view now starts at
the top of the screen with nothing reserved, and the chrome sits behind the
clock. A reload re-establishes the layout, which is why only a reload helps.

The inset cannot be trusted, so the fix does not read it alone.

### Fix: measure the viewport, and remember portrait

`UIOutHeaderSystem` publishes `--l13-safe-top` on the root element:

```
--l13-safe-top = max(measured env inset, portrait growth)
portrait growth = max(0, current portrait innerHeight - baseline portrait innerHeight)
```

- The **measured inset** comes from a probe element carrying
  `padding-top: env(safe-area-inset-top)`, because a custom property holding
  `env(...)` reads back as the literal text, not a resolved length.
- The **baseline** is the first portrait `innerHeight` of the session, taken
  before any rotation. If the view later grows in portrait, it grew by the band
  it used to leave for the status bar, and that band is what must be reserved.

Guarded to `body.standalone`. In a Safari tab the address bar collapsing also
changes `innerHeight`, and that must not be read as a lost status bar.

### One inset, in one place

Two rules add the top inset today, and both are live in a standalone PWA:

| Line | Rule | Condition |
| --- | --- | --- |
| `mobile.less:676` | `#mobile-header` `padding: calc(2px + env(...)) 0 0 0` | any small layout |
| `mobile.less:1790` | `#mobile-chrome` `padding-top: env(...)` | standalone only |

`#mobile-header` is a child of `#mobile-chrome` in the shell layout, so on a
device that reports a real inset it is counted twice. It has never shown,
because this device reports 0. It would show the moment one did.

The inset moves to `#mobile-chrome` alone, unconditionally, as
`var(--l13-safe-top, env(safe-area-inset-top))`. `#mobile-header` keeps its 2px
and drops the inset. The fallback in the `var()` keeps the rule correct for the
frames before the first measurement lands.

### Honest limit

The mechanism above is inferred from the screenshot, the reported trigger and
the recorded behaviour of this device. It cannot be reproduced in a desktop
browser, and no iOS device is available to this branch. The fix is written to
hold whichever of the two candidate mechanisms is at work: if the inset goes
stale at 0, the viewport growth supplies the band; if the inset starts
reporting a real value, the de-duplication keeps it from doubling. Both paths
end at the same custom property.

---

## C. Stale chrome after loading a save

### Root cause, reproduced

Load a save at phone width and `#grid-location-header h1` still reads `Camp` —
the literal placeholder in `index.html:205`. It stays wrong after the opening
popup closes, and until the player changes tab or moves.

`onGameShown` calls `updateHeaderTexts`, and `updateHeaderTexts` opens with

```js
if (!this.currentLocationNodes.head) return;
```

At `gameShownSignal` the player's location node does not exist yet. The pass
bails, and nothing runs it again. Every one-shot handler in `onGameShown` that
guards on the same node has the same hole; the banner is simply the one that
shows.

### Fix: finish the pass once the world exists

`onGameShown` sets a `pendingGameShownRefresh` flag when
`currentLocationNodes.head` is missing. `update()` clears the flag and re-runs
`onGameShown` on the first tick where the node is there.

`update()` already returns early on `!this.currentLocationNodes.head` and on
`uiStatus.isHidden`, so the retry is checked after those guards and costs one
truthiness test per tick otherwise.

This is deliberately a re-run of the whole handler rather than of the banner
alone. The defect is not "the banner is wrong", it is "a batch of one-shot
passes ran before the world existed", and the batch is the unit that has to
happen again.

---

## D. The opening message gets no toast

Two separate causes. Both must go.

### D1. The message is dropped, permanently

`updateToasts` returns early while `GameGlobals.gameState.uiStatus.isHidden` is
true. The opening message is logged during start-up, while the game is hidden.

Dropping it is final. `latestMessages` comes from `UIList.update`, which
returns only the items it *created*; on the next pass the message already has a
list item, so it is never new again and never reaches the stack.

**Fix.** While the game is hidden, hold the messages instead of dropping them.
`gameShownSignal` flushes the held list into the stack. The buffer is capped at
the stack's own `max`, so a long hidden stretch cannot dump a wall of cards.
`onGameReset` empties it.

The other two guards keep dropping, and that is right: with the drawer open the
message is already on screen, and outside the small layout there is no stack.

### D2. The stack is invisible for the whole opening

`#log-toasts` carries `hidden-when-down`, which takes it to `opacity: 0`, and
`mobile.less:2021` takes the taps off its cards. The opening of the game is
`vision-step-0` from the first frame until the player finds light, so the stack
is invisible for exactly the stretch the player most needs it.

**Fix.** The toast stack leaves the `hidden-when-down` set, and the
`vision-step-0` `pointer-events: none` rule for its cards goes with it. A card
that is visible must be tappable.

`#btn-log-toggle` keeps its fade. That is chrome, and the reasoning that put it
there still holds. The toast is not chrome — it is the message.

---

## Files

| File | Change |
| --- | --- |
| `css/modules/mobile.less` | landscape panel and rail; one top inset; toast stack visible when down |
| `css/main.css` | recompiled |
| `index.html` | `#log-toasts` loses `hidden-when-down`; safe-area probe element |
| `src/game/systems/ui/UIOutHeaderSystem.js` | `--l13-safe-top`; deferred game-shown refresh |
| `src/game/systems/ui/UIOutLogSystem.js` | hold toasts while hidden, flush when shown |
| `changelog.json`, `changelog.html`, `src/config.js`, `sw.js` | version bump to 0.6.3.m54 |

## Verification

By the browser at a phone width, and by reading the compiled `main.css`. No
test framework exists in this repository.

1. **Landscape panel.** Force `body.landscape-map`, select a sector, and assert
   the panel's bounding rect overlaps the map canvas and is wider than the
   control rail.
2. **Landscape rail.** Assert the rail holds both selects and every visible
   glyph button with no horizontal overflow.
3. **Jump button.** With no sector selected, press "next" and assert a sector
   is selected and the panel is displayed.
4. **One inset.** Read the compiled `main.css` and assert exactly one rule adds
   a top safe-area inset to the chrome.
5. **Safe top published.** Assert `--l13-safe-top` is set on the root element
   and parses as a length.
6. **Portrait growth.** With `body.standalone` forced, stub the baseline lower
   than the current `innerHeight` and assert `--l13-safe-top` picks up the
   difference.
7. **Load-from-save banner.** Load a save at phone width, dismiss the opening
   popup, and assert `#grid-location-header h1` is not `Camp` and names the
   level.
8. **Deferred refresh fires once.** Assert the pending flag is cleared after
   the retry and the handler does not run again every tick.
9. **Opening toast.** Start a new game and assert a card carrying the opening
   message is in the stack, and that the stack is opaque and tappable while
   `body.vision-step-0`.
10. **No wall of cards.** Load a save with many unread messages and assert no
    toast appears — they are `loadedFromSave` and must stay filtered.

## Decisions and their reasons

| Decision | Reason |
| --- | --- |
| The landscape panel is absolute, not fixed | Safari clips a fixed box inside a scroller, and the details box is one. |
| The rail width is measured, not guessed | It has to hold two selects; a number picked by eye either clips them or wastes the map's width. |
| The jump buttons get no new code | The selection already opens the panel. The defect was the panel's placement, not the buttons. |
| The top inset is measured in JS | This device reports the inset as 0 and rotation changes the layout without changing the inset. A value read from the viewport survives that; `env()` does not. |
| The inset moves to one rule | Two live rules on nested elements double the reserve on any device that reports a real inset. |
| The whole game-shown handler re-runs | The defect is a batch of passes that ran too early, not one wrong string. |
| Held toasts are capped at the stack's `max` | The flush must not undo the cap the stack exists to enforce. |
| The toast stack stays visible when down | The fade is for chrome that must not be tapped while invisible. A message is not chrome, and the opening of the game is entirely "down". |
| The log pill keeps its fade | It is chrome, and it leads somewhere the player cannot use yet. |
