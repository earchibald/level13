# Level 13 mobile port — design

Date: 2026-08-02. Branch: `gh-pages-mobile` (based on `gh-pages`, the stable release branch).
Target: https://earchibald.github.io/level13-mobile — the game must work flexibly in a mobile
browser window with 100% feature parity against the desktop layout.

## Context

Upstream 0.6.3/0.7.0 already ships a partial small-screen mode:

- JS toggles `body.layout-small` when window width ≤ 850 (`UIConstants.SMALL_LAYOUT_THRESHOLD`).
  It swaps the fixed left sidebar and stats rows for a fixed top `#mobile-header`.
- `css/gridism.css` stacks all grid units at ≤ 568px and provides `fill-on-mobiles` for popups.
- A UA-sniffed `#mobile-overlay` blocks mobile users with "isn't optimized for mobile".

The port upgrades `layout-small` into a real phone-class experience. It does not invent a
parallel layout system. A full element inventory (7 reader lenses, 203 elements) drives the
work; its findings are baked into the checklist below.

`css/main.css` is compiled from `css/main.less` + `css/modules/*.less` + `css/themes/*.less`.
Every themed rule is emitted twice (`body.dark`, `body.sunlit`). Rule: edit LESS, recompile
with `npx -p less lessc css/main.less css/main.css`, commit both. The compile round-trip is
byte-identical, verified. New mobile rules live in a new theme-neutral module
`css/modules/mobile.less`, imported last so it wins the cascade and is emitted once.

## Deployment (implemented)

The deploy workflow travels with the branch (`.github/workflows/deploy-pages.yml`). It only
runs its job in `earchibald/level13-mobile` (`if: github.repository == ...`), where it
publishes the branch to that repo's GitHub Pages via `actions/deploy-pages` and the repo's
own `GITHUB_TOKEN`. No secrets. Publishing = pushing the branch to both remotes:

    git push origin gh-pages-mobile        # source of truth
    git push mobile  gh-pages-mobile       # hosting repo -> deploys

All asset paths are relative (verified); the site works from the `/level13-mobile/` subpath.
`GameConstants.gameURL` is derived from `location` (cherry-picked from master).

## Design principles

1. **Parity over minimalism.** Every desktop element stays reachable on a 390px touch screen.
   Features that upstream *hides* in layout-small get restored, not accepted.
2. **One source of truth per mechanism.** Keep the 850px JS threshold and the 568px CSS
   breakpoint. Add touch-specific rules under `@media (pointer: coarse)` and phone-width
   rules under ≤ 568px. No new breakpoint systems.
3. **Theme-neutral implementation.** Mobile rules are structural and live outside the
   dark/sunlit duplication. Both themes must pass verification.
4. **Additive JS.** Touch handlers extend existing code paths (`zoomMap`,
   `makeCanvasScrollable`, callout generation). No rewrites of working desktop logic.

## The seven decisions

### 1. Remove the mobile gate
`GameConstants.isMobileOverlayShown = false` always. The overlay DOM stays (harmless).
The changelog/version popups then work on mobile as on desktop.

### 2. Callouts become tappable (the information channel)
Callouts are the game's primary information channel (item stats, action costs, risks,
disabled reasons) and, for bag/explorers, an *interaction* channel (equip/discard buttons
live inside them). CSS already shows callouts on `:focus` as well as `:hover`.

- **Info callouts** (`.info-callout-target`): tap toggles a `.callout-visible` class on the
  `.callout-container`; CSS shows the callout for that class. Tap outside closes all open
  callouts. The tap-open path fires the same refresh hooks as hover
  (`elementToggledSignal`, `refreshButtonsInCallout`, `highlightItemType`) so buttons inside
  callouts stay correct. Buttons inside callouts remain tappable.
- **Action-button callouts** (`.btn-callout`): tap on an *enabled* button acts, as on
  desktop click. Long-press (~500ms, pointer events) opens the callout preview instead of
  acting. Tap on a *disabled* button opens the callout with the disabled reason — this also
  solves the vision-disabled (opacity 0.2) hover-peek with the same mechanism.
- Callout z-index rises above the fixed mobile header.

### 3. Canvas surfaces get touch pan and zoom
One shared code path (`CanvasConstants.makeCanvasScrollable`) drives the level map and the
tech tree. Add touch/pointer panning there: drag sets `scrollLeft/scrollTop` exactly like
the mouse path, `touch-action: none` on the canvas area, drag-vs-tap discrimination with a
small movement threshold, snap and scroll indicators unchanged. Pan also works when the
drag starts on an overlay cell.

Zoom (map only, fork feature): pinch on `#mainmap-container` calls the existing
`zoomMap(steps, x, y)`; on-screen `+ / −` buttons appear on the map for all pointer types.
Default zoom rises on phone widths so 11px sector cells become tappable. The sector hover
tooltip stays desktop-only; tap already opens the identical details panel (parity path).
Camp-vis building hover info becomes tap-toggled.

### 4. Popups fit the screen
One shell fix for all seven dialogs: `max-height: 100dvh`, internal `overflow-y: auto`,
sticky `.buttonbox` at the popup bottom so close/confirm stays reachable. Specific relayouts:
- **Incoming caravan**: remove the inline 170/130/130/170px column widths from HTML; CSS
  keeps desktop metrics ≥ 569px and wraps the four inventory columns into a 2×2 grid below.
- **Manage saves**: columns stack at phone width; textareas get `width: 100%` (kill
  `cols=60` intrinsic width).
- **Fight**: damage/status floaters move inside the popup bounds at phone width.
- **Settings**: hotkey list height capped; checkboxes get real label-tap behavior.

### 5. Chrome (header, tabs, footer, log) compacts and stays reachable
- **Mobile header**: tighter paddings; strips wrap as upstream does (a scroll strip
  would clip the tap callouts that open from chips inside it). Restore the parity items
  upstream commented out: equipment stats, header item list, header explorer list. The JS
  height-measure keeps padding-top correct at any header height.
- **Tab bar**: single-row horizontally scrollable strip at ≤ 568px (scroll snap, selected
  tab auto-scrolled into view). All 11 tabs keep their notification bubbles.
- **Footer**: the unconditional 95px left padding becomes layout-regular-only; the bar wraps
  at phone widths; buttons get touch padding.
- **Log**: in layout-small the log becomes reachable through a floating "log" toggle that
  opens a bottom-sheet drawer (the same `#log` element, repositioned by CSS class), instead
  of a 200px strip lost at the bottom of a long page.

### 6. Touch targets and inputs
Under `pointer: coarse` and/or ≤ 568px: buttons min-height ~44px, glyph/mini/meta buttons
padded up, checkboxes enlarged with tap-to-toggle labels, range thumb enlarged, stepper
`+/−` enlarged, stepper inputs get `inputmode="numeric"` (numeric keypad, no iOS zoom),
inputs ≥ 16px font. `registerLongTap` and the global mouse tracker convert to pointer
events, which restores trade-popup hold-to-repeat on touch. Touch hygiene:
`touch-action: manipulation` on interactive elements, transparent tap highlight,
`user-select: none` on game controls (log/story text stays selectable).

### 7. Restore features upstream hides in layout-small
100% parity forbids the existing small-layout downgrades: camp dismantle buttons
(`UIOutCampSystem`), trade sell-inventory column (`UIOutTradeSystem`), project map buttons
(`UIOutProjectsSystem`), blueprint piece display (`UIOutUpgradesSystem`). Each returns with
responsive handling (horizontal-scroll table containers at phone widths).

## Secondary surfaces and metadata

- faq.html / changelog.html / tools.html: already fluid; collapsible headers get touch
  sizing; fix the changelog.js `var html` re-declaration bug that discards the styled
  wrapper; add missing `lang` attributes.
- Head/meta: add `theme-color`, `viewport-fit=cover` + safe-area insets for the fixed
  header/footer, `apple-touch-icon` + minimal web app manifest, and fix `og:image`
  pointing at a nonexistent `favicon.png`.
- Markup bugs fixed in passing: duplicate `class` attribute on `#grid-main-header`,
  mismatched heading close tags in the log container, stray `</span>` in caravan popup
  footers, sunlit `reqs-checkmark` icon override.
- `prefers-reduced-motion: reduce` disables the global 1s opacity transitions.
- Tracking: `isTrackingEnabled: false` on this branch — a code-modified fork must not
  report errors into upstream's GlitchTip project. GoatCounter stays (hostname-keyed).

## Accepted limitations (audited)

- Item detail callouts inside the trade and reward-selection lists stay
  desktop-only: there, tap must keep its primary meaning (move the item), and
  long-press is the hold-to-repeat gesture. Item stats remain readable from
  the bag.
- The software keyboard can cover the centered input popup on iOS
  (visualViewport is not wired); the input popup is short, so the field
  itself stays visible.
- iOS rubber-band scrolling of the page behind an open popup is not fully
  suppressed (body overflow lock only) — cosmetic.
- A callout opened at the very top of the content area can slide under the
  fixed header while scrolled to the top (stacking-context limit) — rare and
  recoverable by scrolling.
- Camp-vis building sprites keep their fixed world coordinates; on very
  narrow screens far-out decorative buildings are clipped, as upstream does.

## Explicit non-goals

- No gameplay/logic changes; save compatibility unchanged.
- No visual rebranding; the existing dark/sunlit aesthetic is kept.
- Hotkey *hints* stay hidden on touch (already `hide-in-small-layout`); the hotkey system
  itself keeps working for attached keyboards, and its settings stay visible.
- The desktop layout (> 850px) must remain pixel-identical except for deliberate,
  documented improvements (map zoom buttons).

## Verification

- Local server + iframe harness at 390×844, 360×740, 320×568, 844×390, 768×1024.
- Cheat-enabled walkthrough (local config only, never committed): all 11 tabs, all 7
  popups, fight, caravan trade, map pan/zoom/select, bag equip/discard via tap callouts,
  explorer management, worker steppers, save export/import, settings, both themes,
  faq/changelog pages, console clean of errors.
- Final adversarial parity audit workflow: every inventoried element checked against the
  mobile build; blockers = not done.
