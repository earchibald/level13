# The finds row, and a top bar that stays put

Date: 2026-08-05
Branch: `gh-pages-mobile`
Ships as: 0.6.3.m57

## Problem

Three reports, two of them a continuation of the last release.

The scavenged percentage went into the top bar in m56. In play that is the
wrong end of the screen: the player's eye and thumb are at the bottom, on the
scavenge button, and the figure they are watching is at the top. The items
list never moved at all and is still in the scrolling page.

The third is the display defect, reported for the third time. It has a new
and useful detail: the player can clear it from inside the game, with
`more > settings` and back out again, without restarting the app.

## 1. One row for what the room holds

The resources row becomes a finds row, in the same place - the band above the
minimap and the direction buttons, below the action buttons.

```
Scavenged: 3%   Resources: metal (scarce)
Items: ?
```

Two lines, always two lines, and every value written on every pass.

- The percentage leaves the top bar. `#btn-room-scavenged` and its rules go,
  and so does the `min-width` that existed to protect it.
- Each line truncates rather than wrapping. The percentage is short and exact,
  so it keeps its width; the two lists give theirs up. A truncated number is a
  wrong number. A truncated list still reads as a list.

  Nothing else on a phone shows the whole of a truncated list. The room panel
  carries the description, not this table. Two resources and one ingredient
  fit at 393px with room to spare, so this is the right trade today - but if
  the lists start running past the edge in play, the fix is somewhere to read
  them, not a different truncation order.
- The items line is present even with nothing to say. A line that appears and
  disappears moves the direction buttons under the player's thumb between one
  scavenge and the next, which is the moment they are tapping fastest.

`getScavengedText` and `getItemsFoundText` join `getResourcesFoundText`
beside it, so the three values are built in one place and by one rule.

### What "nothing to say" reads as

The items list uses the resources list's three states, and deliberately not a
simpler rule:

| State | Reads |
| --- | --- |
| Something is known | the list |
| Nothing known, and the room is scavenged past the reveal threshold | `(none)` |
| Anything else | `?` |

"There are no items here" is knowledge the player earns. An empty list shown
before the threshold would say, for free, that the room is not worth the
stamina. The threshold is `THRESHOLD_SCAVENGED_PERCENT_REVEAL_NO_RESOURCES`,
the same one the resources list already uses.

The percentage reads `?` until the room is scouted, and again until scavenging
unlocks. `0%` would be a different claim: "nobody has looked" is not "there is
nothing left".

### What the stats table keeps

Both lists leave the table on a phone, and only once the row exists to replace
them. The regular layout has no such band and keeps both. So does a phone
before scouting unlocks, because the row lives in the map panel and that panel
does not exist yet. All three read the same three methods, so the renderings
cannot disagree.

The table keeps the items line's original rule - it appears only when there is
something to say. The table can do that; the row cannot, for the reason above.

After this the centre column holds the sector description prose, which the
room panel already shows, and the investigated percentage. In an ordinary
street it is empty.

## 2. The chrome behind the clock

The installed app comes to rest with its top bar drawn over the status bar.
The screenshot is decisive: the banner sits at the very top of the screen and
the clock is printed across it.

That is `--l13-safe-top` reading 0 when it should be reserving a status bar.
The reserve is computed by `updateSafeAreaTop`, which runs from `updateLayout`
- and `updateLayout` runs on a resize.

**iOS moves the standalone viewport without always firing one.** The view
comes back from the app switcher, or settles after a rotation, and
`window.innerHeight` is simply different on a later frame with no event. The
reserve is then never recomputed, which is exactly why opening settings and
closing it again fixes it by hand: that path happens to re-measure.

Two changes.

**Poll it.** `pollViewportGeometry` reads `innerHeight` and `innerWidth` at
the top of `update()`, before its guards, and runs the measuring pass only
when one of them has changed. Two integer reads per tick. It is the only
signal that arrives in every one of those cases.

**Tell the two states apart outright.** The screen height says which one the
app is in: either iOS is keeping a band at the top and the viewport is shorter
than the screen, or it has stopped and the viewport is the whole screen. The
baseline is the tallest portrait viewport seen that was still shorter than the
screen, and the reserve is the difference.

It was "the smallest viewport seen" before. That needed no screen height, but
it took any transient short frame as normal for the rest of the session - and
polling sees the short frames that resize events used to miss.

### What it does not fix

If the app launches straight into the fullscreen state, no normal frame is
ever seen, and there is nothing to derive the size of the reserve from. It
stays 0.

This is recorded rather than guessed at. A constant would work on this phone
and could leave a permanent empty band on a phone whose status bar is a
different height. The reports all say a reload clears it, which means launch
is not the broken path.

## Files

| File | Change |
| --- | --- |
| `src/game/systems/ui/UIOutLevelSystem.js` | `getScavengedText`, `getItemsFoundText`; the finds row; the stats table loses both lists on a phone |
| `src/game/systems/ui/UIOutHeaderSystem.js` | `pollViewportGeometry`; the reserve is measured against the screen height |
| `index.html` | the finds row; the top bar loses the percentage |
| `css/modules/mobile.less` | the finds row; the top bar's chip rules |
| `css/main.css` | recompiled |
| `changelog.json`, `changelog.html`, `src/config.js`, `sw.js` | version bump |

## Verification

Browser at phone width, and the iPhone simulator for anything that has to be
seen. See the project memory before trusting any load-time claim.

1. Assert the row's rect sits above the minimap's and below the action bar's,
   and that it is two lines.
2. Give the lists more text than fits. Assert the row's height does not
   change, that the percentage is not truncated, and that a list is.
3. Assert `getItemsFoundText` returns `?` below the threshold with no items,
   `(none)` above it with no items, and `?` above it with items not yet found.
4. Assert `getScavengedText` returns `?` unscouted, `?` before scavenging
   unlocks, and a floored percentage otherwise.
5. Assert the stats table is empty of both lists on a phone with scouting
   unlocked, and holds the resources list in the regular layout and on a phone
   before scouting unlocks.
6. Assert `#btn-room-scavenged` is gone from the document.
7. A/B the reserve with the viewport stubbed: normal reads 0, fullscreen reads
   the status bar, back to normal reads 0 again, and a browser tab never
   reserves.
8. Assert a transient short frame does not become the baseline, and that the
   reserve still fires afterwards.
9. Tick the engine with no resize event dispatched. Assert the reserve is
   right on the next tick, and that an unchanged viewport costs no measuring
   passes.

## Decisions and their reasons

| Decision | Reason |
| --- | --- |
| The percentage leaves the top bar | The eye is at the bottom of the screen when it matters. |
| Two lines, always | The direction buttons must not move as finds come in. |
| The percentage never truncates; the lists do | A truncated number is a wrong number; a truncated list still reads as a list. |
| The items list uses the resources list's three states | An empty list before the threshold gives away that the room is not worth scavenging. |
| The reserve is polled | iOS moves the viewport without an event, and no other signal covers every case. |
| The two states are told apart by the screen height | It is an absolute test. The old rule inferred "normal" from session history and a transient frame could poison it. |
| The launched-broken case is left open | Sizing it would need a constant this branch cannot test on other phones. |
