# Transient messages on a phone

Date: 2026-08-04
Branch: `gh-pages-mobile`

## Problem

Two pieces of text arrive, are read once, and then only get in the way.

1. Log messages. The drawer, the pill and the unread badge work well, but a
   message that arrives while the drawer is closed is invisible. The player
   finds out only from the badge, and only later.
2. The room description. It sits in the scrolling centre column, where it
   pushes the compass and the action buttons down the page. The mobile work
   has been moving fixed, dynamic elements out of that scroll for several
   commits. This is the last large one.

A third, smaller defect is in scope: the floating log pill covers the "save"
button in the footer.

## Scope

Small layout only (`body.layout-small`). The regular layout keeps the log
column and the sector text where they are. Landscape map mode suppresses both
new elements, as it suppresses the rest of the chrome.

## 1. Log toasts

### Behaviour

A new log message appears as a card below the fixed chrome. The card stays for
3500 ms, then fades over about 400 ms and is removed. Cards stack downward in
arrival order.

At most three cards are on screen. A fourth arrival starts the oldest card's
fade at once. The newest message is therefore always visible, the stack never
grows past about a third of the screen, and a player who is moving fast never
watches a lagging feed of old news.

A tap on a card removes that card at once.

Seeing a toast does not mark the message as read. The badge on `#btn-log-toggle`
keeps counting it until the drawer opens. Nothing in the existing seen-marking
changes. The toast is purely additive.

### `src/utils/UIToastStack.js` (new)

A DOM-and-timers widget with no game knowledge, in the same spirit as
`UIList.js`. It can be reasoned about and exercised on its own.

```
UIToastStack.create($container, { lifetimeMs: 3500, max: 3 })
UIToastStack.push(stack, text)
UIToastStack.clear(stack)
```

Each card owns its own timer. `push` past `max` starts the oldest card's exit
immediately. Under `prefers-reduced-motion` a card is removed without the fade.

### Feed

`UIOutLogSystem.updateMessageList` already computes the set the stack needs:

```js
let newItems = UIList.update(this.logList, shownMessages);
let latestMessages = newItems.map(li => li.data).filter(m => !m.markedAsSeen && !m.loadedFromSave);
```

`UIList.update` returns only the items it created, so `latestMessages` is
exactly "arrived since the last pass, and not yet read". One call to the stack
is added after that line.

`updateLogListItem` renders a message through `Text.compose`,
`LogConstants.cleanupMessage` and `TextConstants.sentencify`. That sequence
moves into a `getMessageText(data)` method, which both the list item and the
toast call, so the two can never drift.

Do not reuse `#log-latest` as the toast container. `UIList.update` replaces
that list on every pass, so a second batch arriving inside the 3500 ms window
would wipe the first. The stack needs its own DOM and its own lifetimes.
`#log-latest` stays as it is.

### Container

```html
<div id="log-toasts" aria-hidden="true"></div>
```

It goes at body level, beside `#btn-log-toggle`, so no scroll container can
clip it.

`aria-hidden` is deliberate. `#log ul` carries `role="log"` and already
announces these messages. A second live region would read every message twice.

### Placement and style

Fixed. Full width less 10 px each side. `top: var(--l13-chrome-height)`.

`UIOutHeaderSystem` already publishes a measured `--l13-out-bottom-height` from
`updateBottomChromeState`. Add `--l13-chrome-height`, read from
`#mobile-chrome`, in the same function, so both values are set together and
both get the existing next-frame remeasure.

Cards match the log drawer: `--l13-mobile-bg`, 1 px `--l13-mobile-border`,
rounded corners. Message text only. The timestamp and the position stay in the
drawer, which is where a player goes to read carefully.

### Suppression

No toast is pushed when:

- `GameGlobals.gameState.uiStatus.isHidden` is true
- `body` has `log-drawer-open` — the messages are already on screen

The container carries `hidden-by-popups`, and the `vision-step-0`
`pointer-events: none` rule that `#btn-log-toggle` has.

## 2. Room name in the banner, description as a panel

### The chip

A new button joins `#grid-location-header`, after the `<h1>` and before
`#btn-adventurer`:

```html
<button id="btn-room" aria-expanded="false"><span></span></button>
```

The `<h1>` gets `flex: 0 1 auto; min-width: 0`. The chip gets `flex: 1 1 auto`
and ellipsises. "Level 13" is short enough to survive beside a truncating chip
at 393 pt, so no new text key is added. If measurement disagrees, add a short
form then.

`UIOutLevelSystem.updateSectorDescription` already builds the header string for
`#header-sector`. It writes the same string to the chip. That is one added
line. `#header-sector` hides in the small layout, so the name is never on
screen twice.

The chip shows only when the layout is small and the player is outside. In camp
the banner is exactly what it is today.

### The panel

`#room-panel` is declared empty in `index.html`. In the small layout
`UIOutHeaderSystem` moves `#out-desc` into it, and moves it back on the way
out, using the comment-marker pattern that `updateLocationHeaderPlacement`
already uses.

It is the same element, not a copy. Every existing
`this.elements.description.html(...)` write still lands and needs no change.

Geometry:

- fixed, `top: var(--l13-chrome-height)`, 10 px in from each side
- `max-height: calc(100dvh - var(--l13-chrome-height) - var(--l13-out-bottom-height) - 20px)`
- `overflow-y: auto`

It therefore never covers the compass or the pinned action bar. It carries a
close button, as the map sector panel does. `body.room-panel-open` drives it.

### When it opens by itself

`updateSectorDescription` builds an intro key for the current sector, hashes it
with a cheap 32-bit string hash, and compares the hash against the one held for
the current position. The store is a plain `Map` keyed `level.x.y`, held in
memory by the system.

The key is not the rendered description. That text carries volatile fragments —
the glowstick countdown, whether enemies are present — and hashing it would
re-open the panel on almost every tick. The key is the room's identity instead:

```js
let introKey = [
	TextConstants.getSectorHeader(hasVision, features),
	TextConstants.getSectorDescription(hasVision, features),
	isScouted ? 1 : 0,
	hasCampHere ? 1 : 0
].join("|");
```

- No entry means a first visit. Open, and store the hash.
- A different hash means the description changed. Open, and store the new hash.
- The same hash means nothing new. Stay closed.

The key covers every cause the player would notice — scouting, a vision change,
a camp built here — and ignores the ones they would not.

The panel also stays closed when the player is in camp, when the layout is not
small, when a popup is open, and when the player is down (`vision-step-0`).

The open and close mechanics live in `UIFunctions`, beside the log drawer and
adventurer toggles, which are the same kind of control. `UIOutLevelSystem` only
decides when to ask for the panel.

The map is not saved. The save format uses two-letter keys and drops falsy
values to stay small, and a per-sector hash across a whole world would cost
real bytes for a cosmetic memory. The one visible effect is that reloading
re-shows the intro for the single room you load into.

### When it closes

Any tap closes it. A delegated `click` handler on the document does this.

The chip is the exception: its handler stops propagation and toggles, so it is
the one control that can also open the panel. The close button only closes.
A tab change closes it. A popup closes it.

Because the panel never overlaps the action bar, tapping a direction both moves
the player and closes the panel, and the next room's description opens in its
place. Moving fast costs no extra taps.

### Not moved

`#out-desc-stats` — the scavenged, investigated and found table — stays in the
scroll. It is status the player checks deliberately, and it changes while they
scavenge, so it belongs where it can update in place.

## 3. The log pill covers "save"

### Root cause

`css/modules/mobile.less:1636` reserves the pill's width:

```less
body.layout-small #footer { padding-right: 84px; }
```

`css/modules/mobile.less:2560` re-homes the footer inside the scrolling pane
and sets the `padding` shorthand:

```less
body.layout-small #grid-switch-content > #footer {
	padding: 10px 4px ~"calc(10px + env(safe-area-inset-bottom))" 4px;
}
```

That selector carries two ids to the first rule's one, so it wins, and the
shorthand resets `padding-right` to 4 px. On every tab where the footer scrolls
in the pane, the reserve is gone and the fixed pill lands on "save".

### Fix

Restore the reserve in the later rule. That rule already matches only the case
where the footer is docked in the pane, which is exactly the case where the
pill is fixed.

On the out tab the footer moves into `#out-panel-meta` and the pill becomes a
sibling in the same row (`mobile.less:1243`). That case is correctly untouched.

CSS only, then recompile `main.css`.

## Files

| File | Change |
| --- | --- |
| `src/utils/UIToastStack.js` | new |
| `src/game/systems/ui/UIOutLogSystem.js` | push new messages to the stack |
| `src/game/systems/ui/UIOutHeaderSystem.js` | publish `--l13-chrome-height`; move `#out-desc`; chip visibility |
| `src/game/systems/ui/UIOutLevelSystem.js` | write the chip text; hash and decide the auto-open |
| `src/game/UIFunctions.js` | chip toggle, panel close handlers |
| `index.html` | `#log-toasts`, `#room-panel`, `#btn-room` |
| `css/modules/mobile.less` | toast stack, room panel, banner row, footer reserve |
| `css/main.css` | recompiled |
| `changelog.json`, `changelog.html`, `src/config.js`, `sw.js` | version bump |

## Verification

No test framework exists in this repository. Verification is by the browser
harness at small layout, and by the iPhone Simulator for anything that needs a
real frame time.

1. Toast timing. Add one message. Assert one card, and assert it is gone
   between 3500 ms and 4200 ms.
2. Toast stacking. Add three messages 500 ms apart. Assert three cards, and
   assert they disappear one at a time in arrival order.
3. Toast cap. Add five messages in one tick. Assert at most three cards are
   settled at any point, counting a card that is fading out as already gone,
   and assert the last message is one of the three.
4. Badge unchanged. Add a message, let the toast expire, and assert
   `#btn-log-toggle[data-unread]` still counts it. Open the drawer and assert
   it clears.
5. Drawer suppression. Open the drawer, add a message, and assert no card.
6. Room chip. Stand outside and assert the chip text equals `#header-sector`'s
   text, and that `#header-sector` is not visible.
7. Auto-open. Move to a new sector and assert the panel opens. Move back and
   assert it stays closed. Scout, and assert it opens again.
8. Dismiss. With the panel open, tap a direction. Assert the player moved and
   that the panel now holds the new room's text.
9. Clearance. With the panel open, assert its bounding rect does not intersect
   the action bar's or the compass panel's.
10. Footer. On the bag tab, scroll to the bottom, and assert the bounding rect
    of `#btn-log-toggle` does not intersect any `#game-options button`. On the
    out tab, assert the inline strip still holds the pill.

## Decisions and their reasons

| Decision | Reason |
| --- | --- |
| A toast does not mark a message read | A glance is not a read. The badge stays honest. |
| Toasts sit under the chrome, at the top | Furthest from the thumb, so directions and Scavenge stay clear. |
| Cap 3, oldest yields early | Bounds the height, and never shows stale news to a fast player. |
| One banner line, room name truncates | The mobile work has spent commits reducing chrome height. |
| Any action dismisses the intro | Every sector is a first visit, so a strict tap-to-dismiss would tax every move. |
| Prose in the panel, stats in the page | The stats change while the player scavenges. |
| The shown-description map is not saved | The save format is size-conscious. The cost is one re-shown intro per reload. |
| `#out-desc` moves, and is not copied | Every existing write into it keeps working. |
