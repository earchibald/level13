# Keyboard craft dialog on the unified branch

Port the keyboard-driven craft dialog from `gh-pages` to `gh-pages-mobile`, together with
the two fast-jump hotkeys that shipped beside it. `gh-pages-mobile` is the unified branch
for mobile and desktop, so anything desktop-only that still lives on `gh-pages` is a gap.

## Summary

| Item | Decision |
|---|---|
| Scope | Craft dialog (K), Manage inventory (I), Show map (P) |
| Method | Hand-port, not cherry-pick |
| Entry points | K hotkey **and** a Craft button in the bag tab |
| Small layout | Button hidden; dialog unreachable without a keyboard |
| Code placement | `UIOutBagSystem.js`, as on `gh-pages` |
| Source commits | `7fb48154`, `b60681d1` |

## Background

`gh-pages` has nine commits that never reached `gh-pages-mobile`. This spec covers the
craft dialog and its sibling hotkeys. The rest are recorded as a backlog below.

The mobile branch already has a *different* craft dialog: commit `77027e11` makes a tap on
a craft button in the bag list open a per-item popup, gated on `layout-small`. That feature
stays exactly as it is. The two do not overlap: the ported dialog is a grouped recipe list
driven by the keyboard, the existing one is a single-item cost card driven by touch.

## Approach

Hand-port rather than cherry-pick. `src/game/systems/ui/UIOutBagSystem.js` is untouched on
this branch since the merge base `a12abd4e`, so the dialog code itself transfers verbatim.
The remaining pieces are hand-written, because `index.html` and `src/game/UIFunctions.js`
have diverged by 269 and 714 lines and the source commits carry version bumps, changelog
entries for `0.6.3.11`/`.12`, and a cache-busting change this branch already has.

## Components

### `src/game/GlobalSignals.js`

Add `openCraftPopupSignal`. This is the hotkey's only coupling to the bag system.

### `src/game/UIFunctions.js`

Three helpers, none of which exist on this branch:

- `showTabById(tabID)` — switch to a tab by id, returning `false` when the tab is not
  visible. Callers use the return value to do nothing before a feature is unlocked.
- `showInventoryContext()` — jump to the bag tab and open the manage-inventory popup.
- `getActionCostsSpanList(action)` — an action's costs as span strings, carrying
  `action-cost-blocker` on anything unaffordable, so costs read the same as in a button
  callout.

Three hotkey registrations:

| Key | Description | Behaviour |
|---|---|---|
| K | Craft | `GlobalSignals.openCraftPopupSignal.dispatch()` |
| I | Manage inventory | `showInventoryContext()` |
| P | Show map | `showTabById(tabs.map)` |

### `src/game/systems/ui/UIOutBagSystem.js`

The dialog, ported verbatim (~230 lines): `initCraftPopup`, `onOpenCraftPopup`,
`onPopupClosed`, `rebuildCraftPopupList`, `setCraftPopupCursor`, `onCraftPopupKeyDown`,
`setCraftPopupSectionCollapsed`, `activateCraftPopupRow`, `flashCraftPopupUnavailable`,
`openCraftConfirmation`. `addToEngine` subscribes to `openCraftPopupSignal` and
`popupClosedSignal`. `initElements` adds the `I` badge to `#btn-self-manage-inventory` and
wires the new Craft button.

The dialog is a closed unit. It owns `#craft-popup` and nothing outside it reads the cursor
or the row model. Its only inbound edge is `openCraftPopupSignal`; its only outbound edges
are `startAction` and the popup manager. It reuses the recipe queries the system already
has — `getCraftableItemDefinitionsByType`, `isItemUnlocked`, `isObsolete`,
`UIConstants.sortItemsByRelevance` — so the inline bag list and the dialog cannot disagree
about what is craftable.

### `index.html`

The `#craft-popup` markup: header, obsolete-toggle row, scrollable list, the key legend,
and a Close button carrying `button-popup-default`. A `Craft` button in `#self-bag-actions`
beside Manage inventory, carrying `hide-in-small-layout` and a `K` badge, the same way
Manage inventory carries `I`.

### `css/modules/elements-special.less`, recompiled into `css/main.css`

Row, header, selection, unavailable and flash styles. Edit the LESS and recompile; never
edit `main.css` by hand.

## Behaviour

**Opening.** `onOpenCraftPopup` bails when the UI is hidden, when a popup is already open,
or when `showTabById` cannot reach the bag tab. So K does nothing before the bag is
unlocked. Otherwise it switches to the bag tab for context and opens the dialog.

**Contents.** Known recipes grouped by item type, sorted by relevance. Obsolete recipes are
hidden unless the toggle is on, and the toggle only appears when something is obsolete.

**Keys.** Cursor `-1` is the obsolete toggle, `0…n-1` are rows.

| Key | Effect |
|---|---|
| Up / Down | Move the cursor and scroll it into view |
| Left / Right | Fold / unfold the section, cursor stays on the header |
| Space | At cursor `-1`, toggle obsolete |
| Enter | Header: fold. Affordable recipe: confirmation. Unaffordable: flash red for 1 s |
| Esc | Close |

Rows are also clickable, so a mouse works.

**Confirmation.** Popups do not stack. The list closes, the confirmation opens, and
`popupClosedSignal` reopens the list with the cursor preserved.

## Risks

**Enter leaking into the confirmation.** This branch never got `5640ede6`, the per-key
`keyDownHadPopup` guard that stops Enter from a popup confirmation reaching the hotkey
handler. It uses a 300 ms `lastPopupClosedTimestamp` window instead. The sequence
Enter-in-list → list closes → confirmation opens → the same keypress's keyup arrives has no
per-key guard behind it. Reading the code it is inert: with the confirmation open,
non-universal hotkeys are skipped, and the take-all Enter hotkey's `activeCondition` is
false because there is no take-all button. That makes correctness here depend on the
take-all gating, so it must be tested, not assumed. Reconciling the two Enter-leak fixes is
backlog, not this spec.

**K collides with the "Pass time" cheat.** `GameConstants.isCheatsEnabled` is `false`, so
the dev-only hotkey is never registered and K is free. `gh-pages` has the identical
collision. It bites only when debugging locally with cheats on.

**The mobile tap intercept reaches neither surface.** It fires on capture-phase clicks on
`.container-btn-action` whose action starts with `craft_`, in `layout-small`, skipping
anything inside `#common-popup`. The dialog's rows are plain divs, the new Craft button has
no `craft_` action, and the confirmation's Craft button is inside `#common-popup` and
explicitly allowed through.

**Esc is unaffected by recent work.** The craft popup is dismissable, so Esc takes
`dismissPopup` → `#craft-popup-close`. The `triggerEscapeButton` path added this session
only runs on non-dismissable popups.

## Verification

No test framework exists in this repo, so verification is browser-driven: serve the
worktree on a **fresh port** after every JS edit (modules are cached per `?v=`), seed
`usersave.txt` into `localStorage` under `save-default`, and drive `mtest2.html`.

1. K does nothing before the bag is unlocked; K opens the dialog once it is.
2. Recipes appear grouped by type, obsolete hidden, toggle present only when relevant.
3. Up/Down move the cursor, including onto the toggle at `-1`; Space toggles it.
4. Left/Right fold and unfold, and the cursor stays on the folded header.
5. Enter on an affordable recipe opens the confirmation; confirming starts the action.
6. Enter on an unaffordable recipe flashes the row for 1 s and starts nothing.
7. The confirmation round-trip reopens the list with the cursor where it was.
8. Esc closes the dialog.
9. The Craft button is hidden under `layout-small`, visible otherwise, and opens the same
   dialog as K.
10. **The Enter-leak case:** a single Enter keydown+keyup pair on an affordable recipe must
    craft exactly once, never twice.

## Out of scope

Unifying this dialog with the mobile per-item tap dialog. `getActionCostsSpanList` and the
mobile `getCraftPopupMessage` will both render costs, from the same underlying helpers.

## Backlog: the rest of the `gh-pages` gap

| Commit | What | State here |
|---|---|---|
| `0d5845eb` | Watchdogs for stuck `isTransitioning`; orphaned-timeout fix | Absent |
| `23c3e760` | Hover tooltips on the map tab controls | Absent |
| `57120794` | Hide the map tooltip on map-mode and level change | Absent |
| `7fc65d60` | `UIMapHelper` overlay churn guard (the badge CSS half is already here) | Half absent |
| `5640ede6` | Per-key `keyDownHadPopup` Enter guard | Solved differently, and the more precise of the two |
| `35a8c3f9` | Keep the sector tooltip open on sector click | Superseded by this branch's touch rewrite; needs a look, not a port |

## Release

Bump the fourth version digit in `changelog.json`, `src/config.js` `urlArgs`, and the
`main.css` query in `index.html`, so the deploy is verifiable.
