# Mobile footer cleanup and save-toast design

Date: 2026-08-11. Branch: `gh-pages-mobile`.

| Item | Decision |
|---|---|
| Problem 1 | Footer text ("Game saved", cloud status) grows the meta row. The map panel grows with it. The direction buttons move under the thumb. |
| Problem 2 | The footer holds nine controls plus three status texts. It reads as clutter on a phone. |
| Fix 1 | A body-level toast card at the top of the screen shows save and cloud confirmations. It fades after 1250 ms. |
| Fix 2 | The phone footer becomes one fixed-height row: version, More, Save. More opens a popup with the other options. Restart moves into that popup. |
| Scope | Phone layout (`body.layout-small`) only, except the Restart relocation, which is shared markup. Desktop keeps the inline footer texts and inline More toggle. |

## Problem

On the phone shell, `UIOutHeaderSystem.updateFooterPlacement` docks `#footer` into
`#out-panel-meta`, the bottom row of `#out-container-compass`. That panel also
holds the direction buttons. Three things change the footer's height at runtime:

1. `#game-msg` — "Game saved" appears for 3 s after every save. Autosave runs
   every 2 minutes (`SaveSystem.autoSaveFrequency`).
2. `#cloud-sync-status` — appears when GitHub sync is configured, and its text
   swings between "cloud xxxxxxxx: saving..." and "cloud xxxxxxxx: saved 12:34".
3. `#game-options-extended` — the More button expands five buttons inline.

Each change wraps the footer row. The panel grows. The direction buttons jump up,
then drop back. On the other tabs the footer sits in the scroll pane, where the
same growth is harmless but still ugly.

## Design

### 1. Toast card

- New body-level element: `<div id="notification-toast" role="status" aria-live="polite">`.
- CSS (`css/modules/mobile.less`, unscoped): `position: fixed`, top
  `calc(var(--l13-safe-top, env(safe-area-inset-top)) + 8px)`, centered with
  `left: 50% / translateX(-50%)`, one line (`white-space: nowrap`, ellipsis),
  card chrome from `--l13-mobile-bg` / `--l13-mobile-border`, `z-index: 100`,
  `pointer-events: none`. Hidden state is `opacity: 0; visibility: hidden` with
  an opacity transition, so show/hide never touches inline `display`.
- JS: `UIFunctions.showToast(text)` sets the text, adds `.visible`, and arms a
  1250 ms timer that removes the class. A second call replaces the text and
  restarts the timer.

### 2. Notification routing (layout-small only)

- **Local save:** `UIOutHeaderSystem.updateGameMsg` already polls
  `SaveSystem.lastDefaultSaveTimestamp`. It gains a tracker field; the first
  observed value arms it without a toast (boot sets the timestamp without a
  save). Each later change fires `showToast(Text.t("ui.meta.game_saved_message"))`
  on the small layout, or the error text when `saveSystem.error` is set. The
  existing `#game-msg` logic stays untouched for desktop.
- **Cloud save:** `UIOutMetaPopupsSystem.onCloudSyncStateChanged` fires
  `showToast("Saved to cloud")` on `state == "synced"` on the small layout.
  The "syncing" state shows nothing. Failed/conflict keep their existing global
  log message.
- CSS hides `#game-msg` and `#cloud-sync-status` under `body.layout-small`
  (`display: none !important` — `uiFunctions.toggle` writes inline display).
  Full cloud detail stays available in the Settings popup.

### 3. Footer declutter

- The phone footer is one row that cannot change height: `flex-wrap: nowrap`,
  `overflow: hidden`, fixed `min-height`, version text truncates. The existing
  `<=568px` wrap rules change to nowrap.
- `#btn-restart` moves in `index.html` from `#game-options` to the end of
  `#game-options-extended`. Restart is destructive and sat one accidental tap
  from Save. Desktop gets it under More too — accepted.
- The `:` separator `<li>` gets `class="options-separator"`; hidden inside the
  popup and on the small layout.
- New `#more-options-popup` (standard `.popup` markup, dismissable, `isMeta`).
  On the small layout the More click moves the `#game-options-extended` node
  into the popup body and opens it (the codebase already moves the footer and
  log pill the same way; button bindings survive the move). Desktop keeps the
  inline toggle, and the desktop path re-homes the list back into `#footer`
  before toggling, which covers rotation both ways.
- A delegated click handler on the popup body closes the popup when any option
  button is tapped. The option's own handler runs first (direct binding fires
  before the bubbled one); `UIPopupManager.showOverlayCounter` keeps the
  overlay up across the overlap, so Settings/Stats/etc. open cleanly on top.
- `#more-options-popup` markup sits before `#manage-save-popup` in the DOM so
  equal z-index popups shown from it paint above it.

### Not changed

- Failed/conflict cloud states keep the in-game log route.
- `#out-panel-meta` grid placement, the log pill, and the landscape-map mode.
- The desktop (`layout-regular`) footer, other than Restart under More.

## Testing

Browser harness per `mtest2.html` procedure (rAF pump, fresh port, `?v` cache
rules). Assertions:

1. Boot to the out tab, record `#table-out-actions-movement` bounding rect.
2. Force `layout-small`, dispatch a save (`saveGameSignal`, pump), assert the
   toast becomes visible with the saved text, then hidden after the timer
   (allow harness setTimeout clamp ~1 s), and the movement rect is unchanged.
3. Dispatch `cloudSyncStateChangedSignal("syncing")` then `("synced")`; assert
   rect unchanged and toast shown once.
4. Tap More; assert the popup opens listing Settings, Game info, Player stats,
   Game data, Reload, Restart; tap Settings; assert Settings opens and the More
   popup closed; close.
5. Assert `#game-msg` and `#cloud-sync-status` are not visible in the footer
   on layout-small.

## Release

Recompile `main.css` (`npx -p less lessc css/main.less css/main.css`). Bump the
fourth version digit (`0.6.3.mN`) in `changelog.json` top entry, plus `urlArgs`
in `src/config.js`, the three `?v=` CSS links, and `CACHE_VERSION` in `sw.js`,
same commit. Push `origin gh-pages-mobile` and `mobile gh-pages-mobile:gh-pages-mobile`.
