# Craft menu flow (hotkey K) and a shared chooser popup

Rebuild the `K` craft popup as a two-level menu with the same shape as the camp's `B`
Buildings menu: `K` opens a chooser of item types, a number opens that type's recipe
list, a number crafts a recipe. The list stays open, re-renders while the craft runs, and
shows a busy badge instead of reading as unaffordable. The generic half of the Buildings
menu moves into one shared helper so both menus run the same code.

## Summary

| Item | Decision |
|---|---|
| Entry | `K` on any tab (keydown opener, with the registered hotkey as fallback); opens the Bag tab |
| Screens | Menu (item types) → one recipe list per type |
| Chooser keys | `1`-`9`, `0` = 10th, arrows + Enter, mouse |
| List keys | `1`-`9`, `0` = 10th, arrows, PgUp/PgDn, Home/End, Enter, Space (toggle) |
| Back / exit | Esc backs one level; Shift+Esc, the Close button, or the overlay exit |
| Crafting | Number or Enter calls `startAction` directly; no confirmation dialog |
| After a craft | Stay on the same list; the list re-renders at once and on every slow update |
| Busy row | Badge "Crafting… Ns" for the craft's duration, then available again |
| Show obsolete | Checkbox per list screen; hidden when nothing would be hidden |
| Tooltips | Every row, chooser entry and the checkbox; hover on mouse, ⓘ tap on touch |
| Shared code | New `src/game/helpers/ui/UIChooserPopup.js`; Buildings menu adopts it unchanged in behaviour |
| Version | `0.6.3.m129` |

## Background

The current `#craft-popup` (m5x) is a flat list with one folding header per item type.
It has no number keys, no page keys, no tooltips, and it asks "Craft X?" in a
confirmation dialog. Crafting is a two-second busy action. The popup closes for the
dialog, reopens the moment the dialog closes, and renders the list while the craft is
still in progress, so the crafted row reads as unavailable. Nothing re-renders the list
while it is open, so the row never recovers. That is the reported bug.

The Buildings menu (m119-m125, `docs/superpowers/specs/2026-09-12-camp-build-menu-flow-design.md`)
already solves each of these. Its ~700 lines in `UIOutCampSystem.js` are mostly generic:
screens, cursor, keys, tooltip pane, flash, step-aside for foreign popups, slow-update
re-render. Only the entry providers, the row sub-text, the tooltip content and the press
are about buildings.

## Interaction

### Chooser screen

```
 Craft                                       [close]
 ┌────────────────────────────────────────────┐
 │ [1] Weapons                            (3) │
 │ [2] Light                              (1) │
 │ [3] Exploration                        (2) │
 └────────────────────────────────────────────┘
 number: open · arrows + enter: open · esc: close
```

- One row per item type that has at least one unlocked recipe, in `ItemConstants.itemTypes`
  order. Types with no unlocked recipe do not appear. The count is the number of recipes
  the list would show with the checkbox off.
- Rows are keyed `1`-`9`, then `0` for the tenth. Numbers shift as types unlock, the same
  way the Buildings lists shift.
- Up/Down, Home/End, PgUp/PgDn move the cursor. Enter and ArrowRight open the highlighted
  entry. A click opens the entry.
- Esc, Shift+Esc, the Close button and a click on the overlay close the popup.
- When no type has an unlocked recipe the chooser shows "No known recipes." and the number
  keys do nothing.

### List screens

```
 Craft › Weapons                      ‹ Back  [close]
 [ ] Show obsolete (1)
 ▪ 12 metal  ▪ 4 rope
 ┌────────────────────────────────────────────┐
 │ [1] Shiv                    2 metal        │
 │ [2] Knife       equipped    5 metal 1 rope │
 │ [3] Spear       Crafting… 2s               │  ← busy badge, name dimmed
 │ [4] Club        obsolete    3 wood         │  ← only with the checkbox
 └────────────────────────────────────────────┘
 number or enter: craft · arrows, pgup/pgdn, home/end: move · space: show obsolete · esc: back · ⇧esc: close
```

- The header reads `Craft › <type name>`, using `ItemConstants.getItemTypeDisplayName`.
- Recipes are sorted with `UIConstants.sortItemsByRelevance`, as the Bag tab sorts them.
- Rows are keyed from 1; `0` is row 10. Rows past 10 are reached with arrows, page keys
  and mouse.
- The sub-text under the name is `equipped` when the player has that item equipped,
  otherwise `owned N` when the player carries N of it, otherwise nothing.
- The right column shows the costs, or a badge when the row is busy or obsolete.
- The resources line above the list shows the player's stock of every cost key the listed
  rows use, in the order the costs first appear, so the player sees what a craft leaves.
- The checkbox is cursor index -1. Space toggles it from anywhere on a list screen; Enter
  toggles it when the cursor sits on it. Its label reads `Show obsolete (n)`.
- Esc and Backspace and ArrowLeft go back to the chooser with the cursor on the type just
  left. Shift+Esc closes. The Close button and the overlay close.

### Activating a row

A row calls `GameGlobals.playerActionFunctions.startAction("craft_<id>", "<id>")`
directly. The Bag tab's own craft buttons are inside collapsible containers that may be
folded, so pressing a button is not reliable here; the direct call is what the button's
handler does anyway. No confirmation dialog.

The popup stays open on the same list. The list re-renders right after the press and on
every slow update while it is open, so the busy badge appears at once and clears when the
craft completes. The list also re-renders on `inventoryChangedSignal`, so the owned count
and obsolete state follow the craft.

An unavailable row flashes its name and blocking costs for a second, as today.

If a press raises another popup, the menu steps aside and returns to the same screen and
cursor when that popup closes (the existing reopen pattern, now in the helper).

### Which rows appear

| Screen | Candidates | Hidden until "Show obsolete" | Always shown, dimmed |
|---|---|---|---|
| Chooser | Item types with at least one unlocked recipe | none | none |
| List | Recipes of the type where `isItemUnlocked` is true | Recipes where `isObsolete` is true | Rows blocked by costs, by busy, or by a full bag |

`isItemUnlocked` and `isObsolete` are the Bag system's existing functions. A recipe is
`available` when `checkAvailability("craft_<id>")` is true. A recipe is `busy` when
`checkRequirements` fails with `DISABLED_REASON_BUSY` or `DISABLED_REASON_IN_PROGRESS`;
its time left comes from `PlayerActionComponent.getActionTimeLeft` for the craft action
that is running, or the busy action's time left when it is another action.

### Tooltips

One body-level fixed pane `#chooser-tooltip`, replacing `#buildings-tooltip`, styled and
positioned like `#upgrade-tooltip`. Hover after 450 ms on a mouse; on touch a ⓘ at the
right end of every row opens the pane on tap.

| Target | Content |
|---|---|
| Header ⓘ | How the menu works and its keys |
| Chooser entry | Type name, recipe count, the key that opens it |
| Recipe row | Name, status badge, item description, bonus description, owned or equipped line, costs with blockers marked, blocking reason, the key that crafts it |
| Checkbox | What obsolete means: an equippable recipe the player already owns unbroken, or has something better than |

Status badge values: `available`, `unaffordable`, `busy`, `obsolete`, or the translated
disabled reason.

### Opening

`K` opens the popup on keydown from a document listener so a `K` `1` `2` burst lands each
key. The listener requires hotkeys on, no open popup, no text input focus, no modifier,
and the UI not hidden. It switches to the Bag tab (`showTabById(tabs.bag)`) as today. The
registered `K` hotkey stays as the keyup fallback and for the hotkey list. Activation
during the fade-in retries until the popup reports visible, as in the Buildings menu.

The Bag tab's `Craft` button opens the same popup. Its `K` badge stays.

## Components

### `src/game/helpers/ui/UIChooserPopup.js` (new)

An AMD module returning a constructor. One instance per owner. The owner passes a config
object; the helper owns all state and DOM wiring for the popup.

Config:

| Field | Type | Meaning |
|---|---|---|
| `popupID` | string | e.g. `"buildings-popup"`; element ids inside are `<popupID>-<part>` |
| `title` | string | Header text before the screen suffix |
| `menuScreen` | string | id of the chooser screen, `"menu"` |
| `getScreens()` | fn → `[{ id, title, verb }]` | List screens in menu order; `verb` fills the hint line ("build", "craft") |
| `getEntries(screen)` | fn → entries | Rows for a screen (see below) |
| `renderRowSub(entry, screen)` | fn → html or `""` | The sub-text under a name |
| `renderRowDetail(entry, screen)` | fn → html or `null` | Right column; `null` means the helper draws costs from `entry.action` or the reason badge |
| `getTooltipContent(index, screen, entry)` | fn → `$el` or `null` | Tooltip body; index -1 is the checkbox, -2 the header ⓘ |
| `press(entry, screen)` | fn → bool | Do the row's action; return false when it could not be done (the helper flashes) |
| `canOpen()` | fn → bool | Owner's open guard (in camp, on a tab, ...) |
| `beforeOpen()` | fn | Owner work before the popup shows (switch tab) |
| `toggle` | `{ label, describe(screen) }` | Checkbox label prefix and its tooltip text |
| `showResources(screen)` | fn → bool | Whether the resources line shows on a screen |
| `emptyText(screen)` | fn → string | The one-line note for an empty list |
| `openKey` | `{ code, tab }` | Keydown opener: key code and the tab it is scoped to (`null` = any) |
| `menuLetters` | `{ code: index }` | Extra chooser keys beyond digits (Buildings: B, I, A) |

Entries are plain objects: `key` (stable id), `name`, `action` (for costs), `available`,
`hidden`, `reason`, `isBusy`, `isCooldown`, `cooldownLeft`, plus owner fields. Chooser
entries add `screen`, `letter`, `count`, `description`.

The helper owns: `isOpen`, `screen`, `cursor`, `rows`, `cursorByScreen`,
`showHiddenByScreen`, `reopen`, `swallowEscapeUp`, tooltip timers. Its methods are the
current Buildings functions with `buildings` dropped from the names: `init`, `open(screen)`,
`close`, `showScreen`, `back`, `renderList(cursor)`, `renderResources`, `setCursor`,
`getPageSize`, `onKeyDown`, `toggleShowHidden`, `activateRow(retries)`, `flashUnavailable`,
`cancelTooltip`, `hideTooltip`, `showTooltip`, `onPopupOpened`, `onPopupClosed`. The
owner forwards `popupOpenedSignal`, `popupClosedSignal` and `slowUpdateSignal` to the
helper; the helper does not subscribe to signals itself so the owner's signal setup stays
in one place.

Row and tooltip CSS classes rename from `buildings-popup-*` to `chooser-popup-*` and
`buildings-tooltip-*` to `chooser-tooltip-*`. Element ids stay per popup and are built
from `popupID`.

### `src/game/systems/ui/UIOutCampSystem.js`

The popup code between the `BUILDINGS POPUP` comment and `updateEvents` shrinks to: the
helper construction with its config, `getBuildingsMenuEntries`,
`getBuildingsEntryStatus`, `getBuildingsBuildEntries`, `getBuildingsImproveEntries`,
`getBuildingsActionEntries`, a `renderRowSub` for the three list screens, the tooltip
content builder, the press (click `$btn`), and `updateBuildingsMenuHint`. Signal handlers
forward to the helper. `onOpenBuildingsPopup` stays as the signal target and calls
`helper.open`. Every behaviour in the Buildings spec is kept.

### `src/game/systems/ui/UIOutBagSystem.js`

The craft popup code between `initCraftPopup` and `openCraftConfirmation` inclusive is
replaced by: the helper construction with its config, `getCraftMenuEntries`,
`getCraftListEntries(type)`, `getCraftEntryStatus`, `renderCraftRowSub`, the tooltip
content builder, the press (`startAction`), and a keydown opener config for `K`.
`onOpenCraftPopup` stays as the signal target. `onInventoryChanged` re-renders the list
while open. `craftPopupReopen` and the confirmation dialog are removed.

### `src/game/UIFunctions.js`

No registration changes. The `K` hotkey stays as the keyup fallback.

### `index.html`

`#craft-popup` is rebuilt with the same parts as `#buildings-popup`: header row with
Back button, title and ⓘ, toggle line, resources line, list, one hint line per level,
and the button box. `#buildings-tooltip` becomes `#chooser-tooltip`.

### `css/modules/elements-special.less` and `css/modules/vis.less`

`buildings-popup-*` row rules become `chooser-popup-*` and apply inside both popups. The
old `craft-popup-*` rules are removed. `#buildings-tooltip` selectors in `vis.less` become
`#chooser-tooltip`. `main.css` is recompiled.

### `changelog.json`, `src/config.js`, `index.html`, `changelog.html`, `sw.js`

Version `0.6.3.m129` with the four cache-buster stamps, per the deploy rule.

## Error handling

- Opening while any popup is open or while the UI is hidden does nothing.
- A recipe whose `checkAvailability` is false when pressed flashes and does not craft.
- A list screen whose type has lost its last unlocked recipe between renders shows the
  empty note; Esc returns to the chooser.
- A chooser with no rows shows "No known recipes." and Enter does nothing.
- Every DOM lookup in the helper is by `popupID`, so a missing part degrades to a no-op
  rather than a thrown error in the render loop.

## Testing

No test framework. Browser assertions through `mtest2.html` on a fresh port with the
mid-game save, in camp with metal in the bag:

1. `K` opens the chooser on the Bag tab; the rows are the unlocked types with counts.
2. `1` opens the first type's list; the header reads `Craft › <type>`.
3. Pressing the lockpick's number crafts it: the row shows `Crafting…`, the popup stays
   open, and after the craft completes (pump the engine) the row is available again with
   the owned count raised by one. Press it again and it crafts again.
4. Esc on a list returns to the chooser with the cursor on that type; Esc again closes;
   Shift+Esc on a list closes directly.
5. The checkbox hides and shows obsolete recipes; Space toggles it.
6. Home/End/PgUp/PgDn move the cursor as specified.
7. Hover (or ⓘ tap with `touch=1`) on a row shows `#chooser-tooltip` with the row's name.
8. Regression on the Buildings menu: `B` opens the chooser, `A` opens the Action list,
   `B` `B` `3` presses the third build button and the popup stays on Build, Esc backs,
   Shift+Esc closes, hover shows the tooltip.
