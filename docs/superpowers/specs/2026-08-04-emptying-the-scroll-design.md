# Emptying the scrolling widget

Date: 2026-08-04
Branch: `gh-pages-mobile`
Ships as: 0.6.3.m56

## Problem

The centre column is a scrolling page of text that the mobile work has been
draining for several releases. Two things still live there that belong in fixed
chrome: the scavenged percentage and the resources list. Moving them is most of
this change. The rest is a set of small corrections to controls that were built
in earlier releases and have now been used in play.

Seven changes. The seventh is a reported defect whose exact cause could not be
reproduced; what was done about that, and why, is stated in full rather than
buried.

## 1. A tapped toast counts as read

Tapping a card dismisses it early. That tap is a read, and the badge should
stop counting that message.

Seeing a toast expire on its own still does not mark it read — the rule that "a
glance is not a read" holds, and is why the badge exists. A deliberate tap is
different: the player reached for it.

`UIToastStack.push` takes a third argument, an `onTap` callback. The card's
click handler calls it before dismissing. The lifetime timer does not.

`UIOutLogSystem` passes a callback that sets `markedAsSeen` on that one message
and re-runs `updateLogBadge`. The buffer that holds messages arriving while the
game is hidden must carry the message object alongside its text, so a flushed
card can mark the right one.

## 2. The room description panel loses its close button

Any tap already closes it. A control that duplicates "tap anywhere" earns
nothing and costs a visible box in the corner of the text.

`#btn-room-panel-close` stays in the markup for the regular layout, and the
small-layout rule that reveals it goes. The heading's right margin, which
existed only to clear that button, goes with it.

## 3. The room name is upper case

To match the default client, which sets its headers in caps. CSS only:
`text-transform: uppercase` on the chip's label.

## 4. The banner carries the scavenged percentage

```
[icon] LEVEL 11  quiet industrial street (45%)  [adventurer]
```

- The percentage follows the room name, in brackets, outside the ellipsis. The
  name truncates; the percentage never does — a number cut in half is worse
  than a name cut short.
- Before the room is scouted there is no figure, so it reads `(?)`. The
  banner's shape then does not change when the player scouts, and nothing
  shifts under the thumb.
- In camp the banner is `CAMP (LEVEL 11)` and there is no chip at all, exactly
  as today.

`UIOutLevelSystem.updateSectorDescription` already computes the scavenged
percentage for the stats table. It writes it to a second span inside the chip.

The percentage leaves the stats table, because it is now on screen at all
times.

## 5. The resources list moves to the action panel

One row, immediately above the minimap and the direction buttons and below the
action buttons:

```
Resources: metal (common), food (scarce)
```

The label is plain text in the markup, not a `text-key`. The key it would have
needed does not exist in either language file, and `UIOutTextSystem` overwrites
a `.text-key` element with the key itself when the lookup fails - so the row
rendered its own selector name on every phone until this was caught.

It goes at the top of `#out-container-compass`, which is the band that already
holds the minimap and the movement controls in the small layout — so "above the
minimap" and "below the other actions" are the same place.

The row is always present, reading `Resources: ?` before anything is known.
A row that appears and disappears would move the direction buttons under the
player's thumb between one scavenge and the next.

The field leaves the stats table **on the phone, and only once the row exists
to replace it**. The regular layout has no such band and keeps reading the list
from the table; so does a phone before scouting unlocks, because the row lives
in the map panel and that panel does not exist yet. Both read the same
extracted `getResourcesFoundText`, so the two renderings cannot disagree.

Taking the field out for everyone was the first attempt and it silently cost
the desktop layout the resources list altogether.

What remains in the table besides it is the investigated percentage and the
items list, both conditional, neither on screen often enough to justify its own
band yet.

## 6. A tap dismisses a map tooltip

On the main map, in both orientations, the sector panel can only be closed with
its `×`. It should behave like the minimap, which already has this: a tap on a
sector shows that sector, a tap anywhere else hides the panel.

`UIOutMapSystem` already carries `onSectorTapTooltip` and
`onDocumentTapHideTooltip` for the minimap overlay. The main map's overlay gets
the same treatment rather than a second mechanism: a document-level handler
that deselects, and `stopPropagation` on the panel itself so a tap inside it —
on the `(directions)` link, or to scroll — does not close it.

The `×` goes, for the same reason it goes from the room panel.

## 7. The wide tabs

Reported twice. The screenshot is decisive about the shape of it: `outside` and
`bag` sit correctly on one row, while `party` and `map` each take a full-width
row of their own. The healthy tabs are the ones on screen since load; the broken
ones are the two revealed later.

A full-width tab means the `li` is block-level, and `ul.tabs li` is
`inline-block` in the stylesheet. So something writes an **inline** display on
it, and an inline style beats a stylesheet rule. `list-item` is what jQuery
falls back to for an `li` it cannot restore, and it is block-level.

Confirmed by measurement, not assumed: a healthy shown tab carries no inline
`style` at all, a hidden one carries `display: none`, and the tab `li` are not
in the `.tabelement, .tabbutton` set that `showTab` fades. So the writer is
somewhere in the load-and-unlock path.

**The exact writer was not reproduced.** A fresh early game followed by a real
import of the reporter's own save produced correct tabs (81/51/60/55 px on one
row), as did hide/show round trips and a show underneath a hidden ancestor.

So the fix is the one that holds whichever path writes it, and it is the idiom
this stylesheet already uses in five other places for the same fight:

```less
body.layout-small ul#switch-tabs li { display: inline-block !important; }
```

with the matching attribute-selector guard so that hiding a tab still hides it
— the same pairing as HIDE STILL MEANS HIDE at the end of the file, which
exists because an `!important` display also beats jQuery's inline
`display: none`.

This treats the symptom deliberately. The tab strip has exactly one correct
display in this layout, there is no case where a tab should be block-level, and
stating that is not a workaround. If the writer is found later, this rule stays
correct anyway.

## Not reproduced, and why that is recorded rather than guessed at

The import path was reproduced end to end on m55 — a fresh early game, then
`getSaveJSONfromCompressed` → `parseSaveJSON` → `loadState` with a real
later-game save — and the result was correct: four tabs on one row at 81/51/60/55
px, `location-outside` and `tab-switch-out` both set, the banner reading
`Level 11`, the chrome grouped. Nothing reproduced.

So the inline display that makes a tab block-level is written somewhere this
branch could not make happen: possibly only with real animation timing, or only
on the device. Section 7 states the correct display instead of chasing it.

That is recorded here rather than quietly fixed, because if the same writer
also touches something that has no such guard, this rule will hide the
evidence.

## 8. Retiring the scrolling widget

Not a task. It is the direction the previous six serve, and the way to make
progress on it is to keep watching what still appears in the centre column in
real play. After this change the column holds the sector description prose
(which the room panel already shows on a phone), the investigated percentage,
the items list, and the action buttons. None of those is ready to move yet:
the first is already duplicated, and the other three are conditional enough
that a permanent band would be mostly empty.

## Files

| File | Change |
| --- | --- |
| `src/utils/UIToastStack.js` | `push` takes an `onTap` callback |
| `src/game/systems/ui/UIOutLogSystem.js` | mark one message read on tap; buffer carries messages |
| `src/game/systems/ui/UIOutLevelSystem.js` | scavenged % to the chip; resources row; stats table loses two fields |
| `src/game/systems/ui/UIOutMapSystem.js` | tap to dismiss the main map panel |
| `index.html` | percentage span in the chip; the resources row |
| `css/modules/mobile.less` | caps; both close buttons; the resources row; the tab display guard |
| `css/main.css` | recompiled |
| `changelog.json`, `changelog.html`, `src/config.js`, `sw.js` | version bump |

## Verification

Browser at phone width, and the iPhone simulator for anything that has to be
seen. The simulator is the only place the engine actually ticks; see the
project memory before trusting any load-time claim.

1. Tap a toast. Assert the badge count falls by exactly one, that the card is
   gone, and that the other cards' counts are untouched.
2. Let a toast expire. Assert the badge is unchanged.
3. Assert the room panel has no visible close button and still closes on a tap.
4. Assert the chip's label is upper case and that its text still matches
   `#header-sector`.
5. Stand in an unscouted room and assert the chip reads `(?)`. Scout, and
   assert it reads a percentage.
6. Assert the resources row is present with `?` before anything is known, and
   that its bounding rect sits above the minimap's and below the action bar's.
7. Assert the stats table no longer contains the scavenged field. Assert it
   still contains the resources field in the regular layout, and on a phone
   before scouting unlocks, and does not once the row is on screen.
8. On the main map, select a sector, tap the map background, and assert the
   panel closed. Tap a sector, and assert its panel opened. Repeat in
   landscape.
9. Assert a tap inside the panel does not close it.
10. Force `display: list-item` inline on a tab and assert it still renders
    `inline-block` and on one row; then hide it with `display: none` inline and
    assert it is still hidden.

## Decisions and their reasons

| Decision | Reason |
| --- | --- |
| Only a tap marks a toast read | A glance is not a read; a reach is. |
| The percentage sits outside the ellipsis | A truncated number is a wrong number. |
| `(?)` rather than nothing before scouting | The banner keeps its shape, so nothing moves when the player scouts. |
| The resources row is always present | Otherwise the direction buttons move under the thumb between scavenges. |
| Both close buttons go | They duplicate "tap anywhere", and cost a box in the corner of the text. |
| The main map reuses the minimap's tap handlers | A second mechanism for the same gesture is how the two drift apart. |
| The tab display is stated with `!important` | There is one correct display for a tab in this layout. The writer was not reproducible, and the guard holds whichever path writes it. |
