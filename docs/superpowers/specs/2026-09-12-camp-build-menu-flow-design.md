# Camp build menu flow (hotkey B)

Replace the camp's flat Buildings popup with a two-level menu: `B` opens a chooser with
Build, Improve and Action. Each opens a numbered list. The player zips through it with
letters, digits, arrows and Enter, or with a mouse or a finger. The menu stays open after
an action so several things can be done in one visit.

## Summary

| Item | Decision |
|---|---|
| Entry | `B` on the camp tab (keydown, with the registered hotkey as fallback) |
| Screens | Menu → Build / Improve / Action list |
| Chooser keys | `B` `I` `A`, `1` `2` `3`, arrows + Enter, mouse |
| List keys | `1`-`9`, `0` = 10th, arrows, PgUp/PgDn, Home/End, Enter, Space (toggle) |
| Back / exit | Esc backs one level; Shift+Esc, the Close button, or the overlay exit |
| After an action | Stay on the same list; the list re-renders |
| Show unavailable | Checkbox on Build and Improve; Action always shows every row |
| Tooltips | Every row, chooser entry and the checkbox; hover on mouse, ⓘ tap on touch |
| Removed hotkeys | `S` Sit down, `T` Treatment, `R` Rest in camp, `Shift+6` Improve campfire |
| Code placement | `UIOutCampSystem.js`, replacing the existing popup code |
| Version | `0.6.3.m119` |

## Background

The current `#buildings-popup` (m5x) is a single list with Build and Improve sections that
fold with the arrow keys. It closes after any activation, has no number keys, no tooltips,
no page keys, and no place for the camp's use actions (Rest, Sit down, Treatment, ...),
which each hold a letter hotkey instead. Those letters are used up, are easy to forget, and
do not scale past three buildings.

## Interaction

### Chooser screen

```
 Buildings                                   [close]
 ┌────────────────────────────────────────────┐
 │ [B] Build                              (4) │
 │ [I] Improve                            (2) │
 │ [A] Action                             (3) │
 └────────────────────────────────────────────┘
 ↑↓ / letter / number: choose · enter: open · esc: close
```

- The count is the number of rows the list would show with the checkbox off.
- Up/Down, Home/End, PgUp/PgDn move the cursor. Enter opens the highlighted entry.
- `B`, `I`, `A` open their entry directly. `1`, `2`, `3` do the same.
- A click opens the entry.
- Esc, Shift+Esc, the Close button and a click on the overlay close the popup.

### List screens

```
 Buildings › Build                    ‹ Back  [close]
 [x] Show unavailable
 ┌────────────────────────────────────────────┐
 │ [1] Campfire               10 wood         │
 │ [2] Storage                20 wood 5 metal │
 │ [3] Hut                    40 wood         │  ← dimmed when unaffordable
 │ [4] Hospital  max level    -               │  ← only with the checkbox
 └────────────────────────────────────────────┘
 number / ↑↓ / enter: build · space: toggle · esc: back · ⇧esc: close
```

- The header reads `Buildings › Build`, `› Improve`, or `› Action`.
- Rows are numbered from 1. `1`-`9` activate that row directly; `0` activates row 10. Rows
  past 10 are reached with the arrows, page keys and mouse.
- Up/Down move one row and wrap at neither end. Home/End go to the first and last row.
  PgUp/PgDn move by the number of rows visible in the scroll container, minimum 3.
- Enter and a click activate the highlighted row.
- The checkbox is cursor index -1, as in the craft popup. Space toggles it from anywhere on
  the list screen; Enter toggles it when the cursor sits on it.
- Esc goes back to the chooser. Shift+Esc closes the popup. The Close button and a click
  on the overlay close the popup. Back goes to the chooser.

### Activating a row

A row presses the improvements table's own button, exactly as today, so cooldowns,
durations and the busy counter behave as if the table were clicked. Unlike today, the
popup stays open on the same list. The list re-renders right after the press and again on
every slow update while it is open, so counts, levels and costs track the game.

An unavailable row flashes its name and blocking costs for a second, as today.

If the pressed button opens another popup (a confirmation or a result), popups do not
stack, so the menu closes with a reopen flag and comes back on the same screen and cursor
when that popup closes. This is the craft popup's `craftPopupReopen` pattern, generalised
to any popup id.

### Which rows appear

| List | Candidates | Hidden until "Show unavailable" | Always shown, dimmed |
|---|---|---|---|
| Build | Every improvement row the table shows (`isImprovementRowVisible().isVisible`) | Rows whose build requirements fail for a reason other than costs (max count, locked, damaged) | Rows blocked only by costs |
| Improve | Rows with an improve action and at least one built | Rows at max level or damaged | Rows blocked only by costs or by busy |
| Action | Use actions of built, undamaged buildings, choosing `use_in_x` or `use_in_x_2` by the same rule the table uses to show one button | none | Rows blocked for any reason |

"Blocked only by costs" is `checkRequirements(action).value >= 1` together with
`checkAvailability(action) == false`.

Improve and Action never show the checkbox when nothing would be hidden. Build likewise.

### Tooltips

One body-level fixed pane `#buildings-tooltip`, styled and positioned like
`#upgrade-tooltip` (hover after 450 ms on a mouse, positioned by
`positionTooltipAtCursor`). On touch a small ⓘ at the right end of every row opens the
pane on tap; a tap elsewhere closes it. The row itself still activates on tap.

| Target | Content |
|---|---|
| Chooser entry | Name, what the list holds, and the keys that open it |
| Build row | Name, status badge, description, count built, costs with blockers marked |
| Improve row | Name, status badge, level → next level (major marked), effect description, costs |
| Action row | Action name, building, description, duration or cooldown, blocking reason |
| Checkbox | What "unavailable" means for this list |

Status badge values: `available`, `unaffordable`, `busy`, or the translated disabled
reason.

The tooltip hides on any key press, on scroll, and when the list re-renders.

### Opening

`B` opens the popup on keydown from a document listener, so a `B` `A` `2` burst lands each
key: the chooser is bound to keys the moment `onOpenBuildingsPopup` runs, before the fade
in completes, as the Go popup does. The registered `B` hotkey stays as the fallback for the
keyup path and for the hotkey list. Navigation keys act during the fade-in; an activation
during the fade-in is deferred with a short retry until the popup reports visible, so an
early Enter never leaves the list on screen with its overlay gone.

### Hotkeys removed

| Key | Was | Now |
|---|---|---|
| `S` (camp) | Sit down | free |
| `T` (camp) | Treatment | free |
| `R` (camp) | Rest | free; `R` outside (nap) keeps working and now shows in the list |
| `Shift+6` (camp) | Improve campfire | free |

Their button badges disappear with the registrations. `B` keeps its badge on the
Back-to-camp button outside; nothing in camp carries a `B` badge.

## Components

### `src/game/systems/ui/UIOutCampSystem.js`

The popup code between the `BUILDINGS POPUP` comment and `updateEvents` is replaced. State
lives on the system:

| Field | Meaning |
|---|---|
| `buildingsPopupOpen` | true from open to the closed signal |
| `buildingsPopupScreen` | `"menu"`, `"build"`, `"improve"`, `"action"` |
| `buildingsPopupCursor` | index into the current screen's rows; -1 is the checkbox |
| `buildingsPopupRows` | rendered rows of the current screen, each with a stable `key` |
| `buildingsPopupShowUnavailable` | one flag per list screen |
| `buildingsPopupReopen` | screen and cursor to restore after a foreign popup closes |

Functions:

- `initBuildingsPopup` binds the Close and Back buttons, row clicks, the checkbox, the ⓘ
  taps, the tooltip hover handlers and the `B` keydown opener.
- `onOpenBuildingsPopup(screen)` opens on the camp tab and shows the chooser, or the
  screen given when reopening.
- `showBuildingsPopupScreen(screen)` swaps header, hint line, checkbox visibility and list,
  then places the cursor.
- `getBuildingsMenuEntries()`, `getBuildingsBuildEntries()`, `getBuildingsImproveEntries()`,
  `getBuildingsActionEntries()` return the candidate rows with `available`, `hidden`,
  `reason` and `$btn`.
- `renderBuildingsPopupList()` draws the current screen's rows and keeps the cursor on the
  same `key` when it still exists.
- `onBuildingsPopupKeyDown(e)` handles every key in the tables above and stops the event.
- `activateBuildingsPopupRow()` presses the row's button and re-renders.
- Tooltip: `showBuildingsTooltip(rowKey)`, `hideBuildingsTooltip()`,
  `getBuildingsTooltipContent(row)`.

Slow update calls `renderBuildingsPopupList()` while the popup is open.

### Escape handling

Esc on a list screen is consumed on keydown (back to chooser). The universal "Dismiss
popup" hotkey fires on keyup and would then close the popup. The system marks the key on
keydown and a capture-phase native `keyup` listener on `document` stops that one keyup
before jQuery's document handler sees it. Shift+Esc is not marked, so it closes the popup
through the normal path. This lives in the camp system, bound while the popup is open.

### `src/game/UIFunctions.js`

Remove the four registrations. Change the outside `nap` registration to show in the list.

### `index.html`

`#buildings-popup` gains a header row with a Back button, the checkbox row, the hint
line for each screen, and the `#buildings-tooltip` pane next to `#upgrade-tooltip`.

### `css/modules/elements-special.less`

Rows become a three-part flex line: key badge, name, right-aligned costs. The badge reuses
the `.hotkey-hint` look. Selected, unavailable, hidden-until-toggle and flash states.
The tooltip pane shares the `#upgrade-tooltip` rules in `vis.less`.

## Error handling

- Opening while not in camp, while any popup is open, or while the UI is hidden does
  nothing.
- A row whose button is no longer visible (the table hid it between renders) is treated as
  unavailable and flashes.
- A list with no rows shows a one-line note and the number keys do nothing.

## Testing

No test framework. Browser assertions through `mtest2.html` on a fresh port, in camp:

1. `B` opens the chooser; `A` shows the action list; `2` presses the second action's
   button (assert the table button received a click and the popup is still open).
2. `B` `B` `3` presses the third build button; the popup stays on Build.
3. Esc on a list returns to the chooser and the popup remains open; Esc again closes it;
   Shift+Esc on a list closes it directly.
4. The checkbox hides and shows maxed rows; Space toggles it.
5. Home/End/PgUp/PgDn move the cursor as specified.
6. Hover on a row shows `#buildings-tooltip` with the row's name.
7. `S`, `T`, `R`, `Shift+6` in camp no longer start their actions; `R` outside still naps.
