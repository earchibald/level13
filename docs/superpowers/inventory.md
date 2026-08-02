
## LENS: layout

### Viewport meta + body root classes [major]
- location: index.html:19, index.html:29, css/main.css:1-9
- desktop: meta viewport width=device-width,initial-scale=1 is already present. body class="wrap wider dark" with inline style height:100%. main.css: html/body height 100%, margin 0, overflow-x hidden. Theme switches by swapping body class dark/sunlit; every layout rule is duplicated under body.dark (lines 484-3200) and body.sunlit (3201-5917), so any layout change must be made twice or hoisted out of the theme scopes.
- mobile risk: overflow-x:hidden on body masks (does not fix) horizontal overflow from fixed-width children; content is silently clipped at 390px. Duplicated dark/sunlit rules double the redesign surface.

### Mobile block overlay (#mobile-overlay) [blocker]
- location: index.html:982-985, css/main.css:2901-2913, src/level13-app.js:16-19, src/game/level13.js:184-204;263-274
- desktop: Hidden on desktop. On mobile user agents (regex Android|webOS|iPhone|iPad|iPod|BlackBerry) it is shown fullscreen (position:fixed, z-index 20) with text 'Level 13 isn't optimized for mobile' and a dismiss link; waitForMobileOverlay() polls every 500ms and delays the whole game setup until dismissed.
- mobile risk: This is the explicit anti-mobile gate. The redesign must disable GameConstants.isMobileOverlayShown (or remove the overlay) or every mobile user gets the warning wall and delayed startup.

### Gridism float grid (.grid/.unit) and width classes [minor]
- location: css/gridism.css:19-37, 55-68, 71-81
- desktop: Float-based grid: .grid .unit floats left, padding 15px (30px on first/last child), clearfix via :before/:after. Width classes: whole 100%, half 50%, one-third/two-thirds, one-quarter/three-quarters, one-fifth 20%, four-fifths 80%, golden-small 38.27%, golden-large 61.73%, unit-compass 33%, unit-rest 67%. Nested grids get padding nuked (34-37).
- mobile risk: Already handled at ≤568px: '.grid .unit { width:100% !important }' stacks all columns (gridism.css:139-145). At 390px everything is single column with 15px gutters; the risk is order (source order becomes vertical order — e.g. Buildings before Population, minimap before sector description) and the 30px first-child gutter reduced to 15px via the 850px rule (gridism.css:100).

### Page wrap max-widths (.wrap / .wider) [none]
- location: css/gridism.css:46-50, 187-203
- desktop: .wrap .grid caps content at 978px centered; at ≥1180px .wider .grid expands the cap to 1180px. Same 1180px query also caps #log to 280px and div.popup to 40% / .popup-wide to 70%.
- mobile risk: none

### Main grid container (#grid-main) and #unit-main column [major]
- location: index.html:32-33, css/main.css:10-16, src/game/systems/ui/UIOutHeaderSystem.js:1137-1139
- desktop: #grid-main height 100%; #unit-main is unit four-fifths (80% float) and starts display:none until game loads. In layout-regular #unit-main gets padding-left:95px to clear the fixed left sidebar. JS (updateLayout) sets #unit-main padding-top dynamically: 15px in regular layout, mobile-header height + 20px in small layout.
- mobile risk: Stacks to 100% at ≤568px. Padding-top depends on JS measuring #mobile-header height — a taller redesigned header must keep this measurement (or replace it with CSS) or content hides under the fixed header. Risk is the JS/CSS coupling, not the width.

### JS layout mode switch (layout-small / layout-regular at 850px) [major]
- location: src/game/systems/ui/UIOutHeaderSystem.js:1120-1140, src/game/constants/UIConstants.js:29, css/main.css:13-28
- desktop: On resize, body gets layout-small when window width ≤ 850 (SMALL_LAYOUT_THRESHOLD, comment says it must match gridism.css), else layout-regular. CSS: layout-regular hides #mobile-header; layout-small hides #header-side and #grid-main-header; layout-small also toggles #mobile-header-status (out of camp) vs #mobile-header-camp-res (in camp) via JS. Many UI systems branch on $('body').hasClass('layout-small') (trade, projects, upgrades, camp systems hide columns/buttons).
- mobile risk: A 390px phone is always layout-small, so the small-layout code path is the mobile baseline. The redesign must keep the 850px JS constant and the gridism breakpoints in sync; there are three uncoordinated breakpoint systems (JS 850, CSS 850, CSS 568).

### Fixed left sidebar (#header-side, regular layout only) [major]
- location: index.html:109-127, css/main.css:29-34, css/main.css:2304-2337
- desktop: position:fixed, width 75px, margin-left -95px (sits in the 95px padding-left of #unit-main), z-index 5. Contains player perks/statuses lists, .player-stats-container (vertical stat indicators max-width 70px, font 0.85rem), hr, equipment stats, and #notification-player-regular progress bar below it. Hidden entirely in layout-small.
- mobile risk: Hidden at 390px by design; its content is duplicated into #mobile-header. Parity requires every sidebar element (perks, statuses, stats, equipment stats, notification bar) to have a working mobile-header twin — equipment stats (#container-equipment-stats-mobile) and header items list are currently commented out in the mobile header (index.html:47-49, 67-69), so parity is already broken on small screens.

### Fixed top mobile header (#mobile-header) [major]
- location: index.html:36-107, css/main.css:35-51, css/main.css:2372-2395, src/game/systems/ui/UIOutHeaderSystem.js:1131-1139
- desktop: Shown only in layout-small: position:fixed top 0, full width, flex column centered, z-index 5, padding 10px 0, background + 5px bottom border. Sections stack vertically: tribe stats, player stats, perks/statuses (out of camp), bag (storage/currency/bag resources), camp stats (storage/reputation/population/currency), camp resources (#statsbar-resources-mobile, flex-wrap, each .stat-indicator fixed 5em wide), and a notification progress bar (width 95%). JS toggles camp vs non-camp sections and measures total height to pad #unit-main and #log-container.
- mobile risk: This is the existing mobile chrome but it can grow very tall (up to 7 stacked flex rows in camp with wrapped resource indicators), eating most of a 390px-wide viewport; stat-indicator 5em fixed widths force wrapping. No collapse/expand affordance. It is the main element the redesign must restructure.

### Regular stats-bar rows (#grid-main-header: #header-tribe-container, #header-camp-container) [major]
- location: index.html:129-190, css/main.css:2248-2275, css/main.css:110-113
- desktop: Two full-width lvl13-box-1 rows above the location header, hidden in layout-small. Row 1: #statsbar-self with tribe stats + deity, stat-indicators inline-block. Row 2: #header-camp-container display:flex with .header-section blocks — main-header-bag (bag storage, currency, bag resources, header items list), main-header-items (explorer list), main-header-camp (flex: overview stats + #statsbar-resources-regular flex-grow). JS shows bag/items sections out of camp, camp section in camp. Note: line 129 has a duplicate class attribute (class="grid" and class="vision-container hidden-when-down") — the second is ignored by HTML parsing, so vision-container/hidden-when-down never apply to this row.
- mobile risk: Hidden at 390px; parity depends on the mobile-header twins (see #header-side risk). The flex row would not fit 390px anyway. Also carries .hide-in-small-layout dependents. Duplicate-class bug should be fixed during redesign.

### Location header (#grid-location-header: level icon + H1) [minor]
- location: index.html:192-197, css/main.css:2359-2371
- desktop: Full-width unit with 2.5em level icon (info-callout-target-side hover callout) inline with the location H1 ('Camp' / sector name). padding 10px 0 0 0.
- mobile risk: Fits 390px, but the icon's info callout is hover-triggered (main.css:1052-1059) — no touch path. Long sector names wrap; H1 size is theme default.

### Tab switcher (#grid-switch > #switch > ul.tabs#switch-tabs, 11 tabs) [major]
- location: index.html:199-215, css/main.css:62-73, 1215-1257, 1556-1560, css/gridism.css:147-163
- desktop: 11 inline-block li tabs (out, embark, in, bag, explorers, map, trade, projects, upgrades, world/tribe, milestones), white-space nowrap, height 2.25em, padding 5px 10px, top:3px overlap trick with selected tab merging into the content box border, hover underline+background, tabindex=0. Notification .bubble badges absolute at top:-6px right:-6px of a tab. JS shows/hides tabs by game state.
- mobile risk: Blocker-adjacent: at 390px the ≤568px rules make tabs wrap into 3-4 rows of boxes (border-radius 0, margin 4px 0 -1px, top:0), consuming large vertical space under the fixed header; ~36px tap height is minimal; bubbles at -6px offsets can clip when rows wrap. Redesign needs a scrollable tab strip or bottom nav.

### Tab content box (#grid-switch-content .grid-content) and per-tab header row (#grid-tab-header/#tab-header) [major]
- location: index.html:217-230, css/main.css:74-79, 102-109, 2276-2279, 2684-2687, css/main.css:1291-1293
- desktop: The bordered content panel (role=main): margin 0 0 15px, padding 15px, background+2px border, z-index 1 position:relative (sits under the selected tab). #tab-header holds an empty H2 placeholder plus per-tab controls floated right via .tab-options/.context: camp rename button; map tab's three selects (mapstyle, mapmode, level) + download button.
- mobile risk: Panel itself adapts. The floated .tab-options cluster (3 selects + button) will overflow or wrap awkwardly at 390px; selects have min-width 5em each plus margins. Needs a stacked or collapsible control row.

### Tab container grids (11 .tabcontainer sections) and their column splits [minor]
- location: index.html:233-736 (vis-in 233, two-in 244, embark 324, two-out 356, two-out-actions 375, bag 452, explorers 508, map 534, trade 596, projects 617, upgrades 650, world 691, milestones 714), css/gridism.css:55-68
- desktop: Each tab is a .grid .tabcontainer toggled by data-tab. Column splits: camp = golden-large (buildings) + golden-small (population/events/demographics); embark = one-third (resources) + two-thirds (items); out = unit-compass (33%, forced 224px by main.css:2536-2540) + unit-rest (67%) twice; bag = three-quarters (equipment) + one-quarter (use/repair/craft); others are unit whole.
- mobile risk: All stack to 100% at ≤568px. Risks are ordering (buildings-then-population; minimap-then-description; movement-then-actions) and total page length — the camp tab becomes a very long scroll. Content inside (canvases, tables) belongs to other lenses.

### Camp vis strip (#tab-vis-in-container) — structural [major]
- location: index.html:233-241, css/main.css:3129-3151
- desktop: Full-width canvas-container, fixed height 100px, overflow hidden, contains canvas#campvis width=800, absolute-positioned building layer and a 16px bottom info overlay.
- mobile risk: 800px canvas inside overflow:hidden centered container: at 390px the edges of the camp vis are clipped (by design, canvas-container centers), but building hotspots near edges become unreachable. Rendering internals are the vis lens's scope; the fixed 100px height + 800px width assumption is structural.

### Minimap block (#minimap-background-container) — structural [none]
- location: index.html:356-368, css/main.css:2521-2545
- desktop: Fixed 224x224px container, margin auto; nested #minimap-container absolutely positioned at 12,12 with inline style 198x198px. Sits in the 33%/224px unit-compass column with position/distance info below.
- mobile risk: 224px fits 390px fine once stacked. Low risk structurally; canvas interaction is the map lens.

### Main map containers (#mainmap-container-container, #mainmap-sector-details) — structural [blocker]
- location: index.html:534-594, css/main.css:2549-2564, 3066-3117
- desktop: canvas#mainmap 500x500 inside .canvas-container (overflow hidden, JS-scrolled); ascii fallback textarea; sector-details box (inline style margin/padding 5px) with 7 floated .context .btn-glyph buttons (1.5em square) and a details table with nowrap .textwidth label cells. #map-sector-tooltip is body-level position:fixed, z-index 20, min-width 190px max-width 320px, pointer-events none — pure hover UI.
- mobile risk: Map canvas is JS pan (cursor all-scroll) — touch behavior unverified; 320px-wide hover tooltip has no touch trigger at all (blocker for map info parity on touch); seven 1.5em glyph buttons are ~24px tap targets, below the 44px guideline.

### Log panel (#log-container > #log.limit-height) [major]
- location: index.html:742-752, css/gridism.css:89-95, 110-125, css/main.css:52-61, 2206-2232, src/game/systems/ui/UIOutHeaderSystem.js:1138
- desktop: Right column, unit one-fifth (20%). #log has .limit-height: position:fixed, height 100%, width 22%, overflow-y hidden, overflow-x overlay (nonstandard), padding-right 50px; layout-regular caps width 25% / max-width 244px (280px at ≥1180px). JS pads container top below the header. Also #log-latest (screen-reader live region) hidden off-screen.
- mobile risk: At ≤850px .limit-height becomes position:static, max-height 200px, width 100% — the log drops to a 200px strip at the very bottom of a long page, effectively invisible during play at 390px. overflow-x:overlay is deprecated (no-op in Firefox). Redesign needs a reachable log (drawer/sheet).

### Sticky footer system (.sticky-footer-wrapper/-push/.sticky-footer + #footer) [major]
- location: index.html:31, 756, 760-777, css/main.css:80-93, 2417-2450, css/gridism.css:102-108, src/game/UIFunctions.js:678
- desktop: Classic sticky-footer: wrapper min-height 100% with margin-bottom -55px, push spacer 55px, footer height 55px, display:none until JS shows it. #footer is unit four-fifths, flex row (padding-left 95px to match sidebar), containing #game-version, #game-msg (flex-grow), and two right-floated table-display ULs of .btn-meta text buttons: extended (settings, game info, player stats, game data — hidden until 'more') and main (more, restart, save). ≤850px: footer border tweak, version/msg left 10px.
- mobile risk: The 95px padding-left is only removed via the .layout-regular scoping on line 13 but body.dark #footer (2417) hardcodes padding-left 95px unconditionally — at 390px the footer content is squeezed into ~295px; 6+ tiny text buttons (.btn-meta, padding 0 3px) in one 55px row are sub-tap-size and can overflow. Footer is not position:fixed, so it sits at page bottom after a long scroll.

### Player notification bars (#notification-player-regular / -mobile) [minor]
- location: index.html:99-106, 121-126, css/main.css:49-51, 2402-2416
- desktop: Progress bar (busy action countdown) with label; regular version sits under the fixed sidebar (unit whole inside #header-side), mobile version inside #mobile-header at width 95%. display:none until active; 2px border, 1.25em bar height.
- mobile risk: Works in mobile header; adds to fixed-header height when active (JS re-measures). Low risk.

### Popup layer (#popup-overlay + div.popup centering) [blocker]
- location: index.html:785-978, css/main.css:1258-1290, 2741-2743, 2802-2805, css/gridism.css:172-183, 201-202, src/game/helpers/ui/UIPopupManager.js:252-268
- desktop: #popup-overlay: fixed fullscreen rgba black 0.85, z-index 15 (meta variant 25). div.popup: position fixed, top/left set by JS repositionPopup() to center (padding 20 desktop, 0 when ≤850px), min-width 30%, max-width 60% (40%/70% at ≥1180px); popups: fight (min-width 35%), incoming-caravan (popup-wide, inline fixed-width inventory columns 170/130/130/170px), manage-save (width 42em, max-width 90%), game-stats, settings, dialogue, common. All carry .fill-on-mobiles: at ≤568px width/max-width 100%, margin/padding 0.
- mobile risk: fill-on-mobiles gives full width at 390px but height is uncapped — tall popups (fight, dialogue with results) can exceed viewport with no internal scroll except .scrollable-container children; caravan popup's four fixed-width columns total 600px+ and overflow (its ≤568px rule only widens ULs). JS centering with $popup.height() > winh pins top to 0 but bottom content is unreachable.

### Popup inert mechanism (.hidden-by-popups) [none]
- location: index.html:32, 199, 217, 742, 760, src/game/helpers/ui/UIPopupManager.js:199-204
- desktop: When a popup opens, JS sets aria-hidden and inert on #grid-main, #grid-switch, #grid-switch-content, #log-container, and .sticky-footer.
- mobile risk: none — works the same on touch; keep the class set on any new structural wrappers.

### Vision opacity system (.vision-step-0 … -10) [none]
- location: css/main.css:143-483, src/game/systems/ui/UIOutHeaderSystem.js:1279
- desktop: Body-level class sets opacity/grayscale of #grid-main and sub-groups (images, canvases, text) in 11 steps as the player's vision stat changes; .hidden-when-down elements (mobile-header, header-side, grid-main-header) get opacity 0 via JS when vision is 0.
- mobile risk: Theme/atmosphere system, viewport-independent. Keep the class hooks on restructured wrappers. Note the #grid-main-header duplicate-class bug means it never had vision-container behavior.

### Full-page overlays (loading, thinking, theme transition) [none]
- location: index.html:987-1004, css/main.css:2914-2987
- desktop: .loading-content/.thinking-content: fixed fullscreen z-20 half-transparent with centered 3-dot bounce spinner. #theme-transition-overlay: fixed fullscreen z-20 grey flash for dark/sunlit switch.
- mobile risk: none

### Scroll containers inventory [minor]
- location: css/main.css:1534-1540 (.scrollable-container 100vh), 2869-2872 (#game-stats-container 70vh), 1592-1601 (.infobox-scrollable 12em), 3118-3120 (#researched-upgrades-vis-container max-height 300px), css/gridism.css:89-95 (.limit-height)
- desktop: Five scroll systems: generic .scrollable-container (max-height 100vh, overflow-y scroll — used in game-stats and hotkeys list), game-stats 70vh, infobox-scrollable 12em, upgrades vis 300px, and the fixed log. Custom 11px scrollbars styled for both themes (main.css:2988-3025).
- mobile risk: 100vh inside a popup on mobile Safari overshoots (URL-bar vh problem); 11px styled scrollbars are fine (touch uses overlay scrolling). Nested scroll areas inside a scrolling page are awkward on touch but functional.

### Accessibility skeleton (hide-from-visual-layout headings, roles) [none]
- location: index.html:35, 110, 130, 141, 348, 743-748, 955, css/main.css:114-120
- desktop: Off-screen (-10000px) h1/h2/h3 headings for banner/status/stats/inventory/embark/log/dialogue; ARIA roles: banner (x2), navigation (#grid-switch), main (#grid-switch-content), log (#log-latest ul), dialog + aria-modal on popups, img roles on canvases. Note mismatched tags at index.html:743-744 (<h1>…</h2>, <h2>…</h3>).
- mobile risk: none functionally; keep the headings when restructuring and fix the mismatched closing tags.

### Audio container [none]
- location: index.html:1006-1015
- desktop: Eight hidden <audio> elements (action started/completed, button click, moves, notification, popup open/close) triggered by JS.
- mobile risk: No layout impact. Mobile browsers require a user gesture before playback — first sounds may be suppressed; not a layout concern.

### z-index layer map [minor]
- location: css/main.css:1273-1290 (popups 15/16, meta 25/26), 3066-3068 (#map-sector-tooltip 20), 2901-2923 (mobile/loading overlays 20), 2977-2981 (theme overlay 20), 29-48 (header-side/mobile-header 5), 1060-1070 (callouts 5), 2276-2279 (grid-switch-content 1), 822-826 (buttons 2)
- desktop: Layering: content 1 < buttons 2 < fixed headers & callouts 5 < popup overlay 15 < ingame popup 16 < tooltips/system overlays 20 < meta overlay 25 < meta popup 26 < dev-hud 100.
- mobile risk: Callouts (z 5) share the layer with the fixed headers — a callout opening near the top can be overlapped by the fixed mobile header. Keep the ladder documented when adding mobile drawers/sheets.

### 850px media query block (gridism) [minor]
- location: css/gridism.css:98-134
- desktop: ≤850px (matches JS SMALL_LAYOUT_THRESHOLD): first-child unit padding 15px; #footer border 2px 0; #game-version/#game-msg left 10px; .limit-height (log) becomes static 200px full-width; #log-overlay static equivalent; dl/dd tweaks for definition lists (used by stats popups).
- mobile risk: Baseline small-screen behavior the redesign inherits; the dl padding 0 10em 0 0 with dd p.p-meta right:-10em assumes ~10em free right gutter — at 390px this pushes meta text off-screen.

### 568px media query block (gridism) [major]
- location: css/gridism.css:136-184
- desktop: ≤568px: all units stack 100%, nested unit padding 0; switch-tab li restyle for wrapping; utility classes center-on-mobiles / hide-on-mobiles / fill-on-mobiles; popup inventorybox ul width 100%.
- mobile risk: This is the only true phone breakpoint and it is sparse — everything not covered here (footer buttons, tab-options selects, caravan columns, map toolbar) keeps desktop metrics at 390px. The redesign will mostly grow this block or replace it.

### Hover-dependent callout layout system (structural hooks) [blocker]
- location: css/main.css:1042-1190 (dark), 3759-3907 (sunlit)
- desktop: Sibling-selector display: .container-btn-action:hover + div.btn-callout and .info-callout-target:hover + div.info-callout show absolutely-positioned callouts (min-width 60pt, max-width 100pt; btn-callout at top:37px centered). :focus variants exist. Content generation is other lenses' scope; the positioning/trigger system is structural and pervasive (every action button and stat has one).
- mobile risk: Hover has no touch equivalent; :focus fires on tap for focusable elements but taps also activate buttons — costs/requirements callouts are effectively unreadable on touch. Central blocker the mobile redesign must solve once, system-wide (tap-and-hold, info toggles, or inline expansion).

**Notes:** Cross-cutting observations. (1) The game already has a partial small-screen mode: JS toggles body.layout-small at ≤850px (UIConstants.SMALL_LAYOUT_THRESHOLD), which swaps the fixed left sidebar + two stats-bar rows for the fixed top #mobile-header, and gridism stacks all columns at ≤568px. The mobile redesign is therefore an upgrade of layout-small, not a from-scratch layout — but three breakpoint systems (JS 850, CSS 850, CSS 568) must stay in sync. (2) Every layout rule in main.css exists twice, once under body.dark and once under body.sunlit (file is generated from main.less; sunlit block starts at main.css:3201): edit main.less/modules (layout.less) rather than the compiled CSS, or changes must be duplicated. (3) The elements named '#statuses' and '#bag-header' in the task brief do not exist in this tree; the actual resource/status bars are #statsbar-resources-regular/-mobile, #bag-resources-regular/-mobile, #statsbar-self, #statsbar-tribe-stats-*, #header-bag-storage-*, and the perks/statuses itemlists. (4) Known parity gaps already present in small layout: equipment stats, header item list, and header explorer list are commented out of #mobile-header (index.html:47-49, 67-69, 71-75), and several systems deliberately hide features when layout-small (dismantle buttons UIOutCampSystem.js:764, trade inventory column UIOutTradeSystem.js:364, project map buttons UIOutProjectsSystem.js:270, blueprint display UIOutUpgradesSystem.js:238) — '100% parity' requires restoring these, not just reflowing CSS. (5) Latent markup bugs to fix while restructuring: duplicate class attribute on #grid-main-header (index.html:129) silently drops vision-container/hidden-when-down; mismatched heading close tags at index.html:743-748; stray </span> inside <p class=\"value inventorybox-footer\"> (index.html:860, 866). (6) The three universal touch blockers that appear in every area: hover-only callouts, the mobile UA overlay gate, and uncapped popup heights with JS centering.

## LENS: components

### Base button (button) [major]
- location: css/main.css:822-848 (dark), css/main.css:3539-3565 (sunlit)
- desktop: Fixed width 95pt (~127px), padding 8px 16px (total height ~37px), margin 4px, lowercase text, 1px border. :hover changes color/border/background, :active nudges top 1px, :focus-visible 2px outline. All rules duplicated per theme under body.dark and body.sunlit.
- mobile risk: Height ~37px is under the 44px touch minimum. Fixed 95pt width means rows of 3+ buttons overflow 390px. Hover feedback is dead on touch; :active still works.

### Action button (button.action) with generated internals [major]
- location: css/main.css:853-861, src/utils/ActionButton.js:57-96, src/game/UIFunctions.js:579-593 (createButtons)
- desktop: 2px border, white-space:nowrap (except .multiline). ActionButton.create appends .btn-label span, .cooldown-action, .cooldown-duration overlays, .hotkey-hint, wraps in div.container-btn-action, then wraps that in .callout-container and appends a .btn-callout sibling. Used for every game action (scavenge, build, craft, trade...).
- mobile risk: nowrap labels can overflow narrow columns; the whole info system (costs, risks, disabled reason) lives in the hover-only callout sibling (see btn-callout entry).

### Button width variants [major]
- location: css/main.css:865-917 (.action-move 55px, .context float:right, .btn-wide 110pt, .btn-x-wide 180pt, .btn-narrow 80pt, .btn-compact, .btn-mini, .btn-glyph 1.5em, .btn-glyph-big min-width 2.5em/2em small, and index.html:398 (btn-x-wide), 423/429/435 (btn-glyph-big), 548-568 (map btn-glyph)
- desktop: Fixed-width classes in pt/px/em: .action-move 55px (compass movement grid), .btn-wide ~147px, .btn-x-wide ~240px, .btn-narrow ~107px. .btn-glyph is a 1.5em (~24px) square icon button; .btn-mini has 4px 8px padding (~27px tall); .btn-compact min-width 2.5em.
- mobile risk: .btn-glyph (~24px), .btn-mini (~27px) and .btn-compact are far below 44px touch targets; they are used for stepper +/-, improve/dismantle (▲, ×), map filter toggles, and explorer switch/dismiss. .btn-x-wide (240px) inside table rows with sibling buttons overflows 390px.

### Meta text buttons (.btn-meta) [major]
- location: css/main.css:918-935, index.html:221, 226, 578, 639, 765-774 (footer options)
- desktop: Borderless, background-none text buttons, padding 0px 3px, hover underline, .btn-meta-float floats right. Used for footer save/restart/more, rename camp, map download, (directions), reset hidden projects.
- mobile risk: Hit target is text height only (~19px), padding 3px; well under 44px. Hover underline is the only affordance and is lost on touch.

### Action button container (.container-btn-action) [minor]
- location: css/main.css:936-950, src/utils/ActionButton.js:73-80
- desktop: inline-block wrapper, margin 4px 6px (2px in tables), negative-margin button inside; also hosts the 5px-high .cooldown-reqs accumulation bar (css/main.css:954-960, 975-977) and gates hotkey-hint/callout hover (css/main.css:1033-1051).
- mobile risk: Wrapper hover states (:hover shows hint/callout) never fire on touch. Otherwise adapts.

### Cooldown / duration progress overlays (.cooldown-action, .cooldown-duration) [none]
- location: css/main.css:961-977, src/utils/ActionButton.js:61-62, src/game/UIFunctions.js:1300-1371 (start/stopButtonCooldown, start/stopButtonDuration), 621-630 (completeAction)
- desktop: Absolutely positioned full-height translucent bars inside each action button; jQuery .animate() shrinks cooldown width 100%→0 and grows duration 0→100% linearly over the action time.
- mobile risk: Visually fine at any width. Many simultaneous jQuery width animations are a battery/perf concern on phones but not a layout break.

### Disabled button states [major]
- location: css/main.css:978-1016 (.btn-disabled, .btn-disabled-basic, .btn-disabled-vision, .btn-disabled-resources, .btn-disabled-cooldown, li.disabled), state applied via GameGlobals.buttonHelper from UIFunctions.js:589
- desktop: opacity .65, line-through, grey border/text; .btn-disabled:hover keeps background. .btn-disabled-vision renders at opacity 0.2 with transparent text and only becomes readable on :hover (opacity .65).
- mobile risk: .btn-disabled-vision is effectively invisible and its hover reveal is impossible on touch — the player cannot discover vision-locked actions. Disabled reason text also only exists inside the hover callout.

### Hotkey hint badge (.hotkey-hint) [none]
- location: css/main.css:1020-1041, src/utils/ActionButton.js:68, src/game/UIFunctions.js:595-607 (updateHotkeyHints)
- desktop: 1em rounded badge absolutely positioned top-right of action buttons, shown only on .container-btn-action:hover and when hotkeys setting enabled.
- mobile risk: None — created with hide-in-small-layout class and hotkeys are keyboard-only anyway.

### Button callout (.btn-callout) — costs/risks/duration/disabled-reason tooltip [blocker]
- location: css/main.css:1042-1094 (hover/focus display rules), 1060-1080 (positioning), src/utils/ActionButton.js:92-192 (content: .action-description, .action-cost spans, .action-risk, .action-duration, .action-costs-countdown, .btn-disabled-reason), src/game/UIConstants.js:694-716 (getCostsSpans), src/game/UIFunctions.js:1379-1459 (updateCostsSpans)
- desktop: Hidden div positioned absolute top:37px, centered under the button, max-width 100pt, pointer-events:none, shown by sibling :hover/:focus. Carries ALL action information: resource costs (with blocker strike-through), injury/fight/inventory risk %, duration, 'available in X' countdown, and the reason a button is disabled.
- mobile risk: Hover-only reveal means core gameplay information is completely inaccessible on touch. Fixed top:37px also misaligns if buttons get taller. This is the single biggest parity blocker in the widget system.

### Info callout (.info-callout / .info-callout-target, -small, -side variants) [blocker]
- location: css/main.css:1044-1161, 1092-1131; generation src/game/UIFunctions.js:351-374 (generateInfoCallouts), update 522-529, src/game/UIConstants.js:933-939 (updateCalloutContent); targets created throughout UIConstants (items 93, explorers 235/298, resources 492/516, indicators 813-814) and index.html:194, 261-262, 294-310
- desktop: Generic hover tooltip: target element (cursor:help) gets wrapped in .callout-container; an absolute .info-callout with arrow (.callout-arrow-up/left, css/main.css:1162-1190) shows on :hover/:focus. Content built from the target's description attribute. Item callouts additionally contain action buttons (use/equip/repair/discard, UIConstants.js:163-199) and explorer callouts contain dismiss/add-to-party buttons (344-358).
- mobile risk: Hover-only. Item names, stats, descriptions AND interactive buttons (equip, discard, talk options) are unreachable on touch. The bag/explorer management flows break entirely.

### Action cost/effect/risk spans [blocker]
- location: css/main.css:1191-1214 (.action-effect-description, .action-risk, .action-cost-blocker, .action-cost-blocker-storage, .action-cost-negated, .action-separator), src/game/UIFunctions.js:1413-1448 (blocker classes toggled)
- desktop: Display:block spans inside btn-callout; blockers get line-through/grey; negated costs struck.
- mobile risk: Inherit the callout blocker — invisible on touch until callouts are redesigned.

### Tab bar (ul.tabs li) [blocker]
- location: css/main.css:1215-1257, index.html:199-215 (#switch-tabs, 11 tabs), src/game/UIFunctions.js:71-82 (click+keydown), 800-869 (showTab/setTab), 1587-1605 (prev/next)
- desktop: 11 inline-block li tabs, padding 5px 10px, height 2.25em (~36px), 2px border, white-space:nowrap, top:3px overlap trick, hover underline+background, .selected bold with merged bottom border. tabindex=0 with Enter/Space handling.
- mobile risk: Up to 11 nowrap tabs cannot fit 390px — they wrap into a ragged multi-row block and the selected-tab border trick breaks across rows. 36px height under 44px target. Primary navigation must be redesigned (scrollable strip, dropdown, or bottom nav).

### Tab notification bubble (.bubble) [minor]
- location: css/main.css:1541-1573 (16x16px circle, absolute top:-6px right:-6px in #switch; bubble-even/decrease/increase/fastincrease icon variants), src/game/UIFunctions.js:337-339 (generateTabBubbles), 1504-1514 (updateBubble); also index.html:258 (#unassigned-workers-bubble), UIConstants.js:264 (explorer '!')
- desktop: 16px round badge with count or trend icon, absolutely positioned on tab corners; toggled when count nonzero.
- mobile risk: Fine at 16px as a passive indicator, but its anchor (tabs) is being redesigned; must be re-attached. 0.85rem text in 16px circle is small.

### Stepper (number input with +/- buttons) [major]
- location: css/main.css:1294-1309 (.stepper, min-width 70px, rounded minus/plus), generation src/game/UIFunctions.js:564-577 (generateSteppers), listeners 307-323, logic 871-912 (onStepperButtonClicked/InputChanged), 1461-1502 (updateStepper/Buttons); input.amount css/main.css:2192-2198 (30pt wide); number key filter UIFunctions.js:1048-1061
- desktop: Composite widget: btn-glyph minus (1.5em ~24px) + 30pt text input + btn-glyph plus. Buttons disabled at min/max via .btn-disabled-basic. Used for worker assignment (index.html:266, in-assign-workers change handler UIFunctions.js:131-137) and embark resource/item selection (read in onActionButtonClicked 994-1010).
- mobile risk: ~24px +/- buttons are half the touch minimum and adjacent, causing mis-taps in the most repetitive interactions in the game (assigning workers, packing bag). Text input triggers numeric keyboard only if type/text pattern set — it is type='text', so full keyboard pops.

### Horizontal select (.horizontal-select / -title / -list / -option) [major]
- location: css/main.css:1310-1338
- desktop: Flex row of inline-block pill options, padding 1px 5px (~20px tall), border-radius 3px, hover background, .selected darker background.
- mobile risk: ~20px tall options are below touch minimum; hover affordance lost. Row does not wrap by default (flex on container).

### Stat indicator (.stat-indicator family) [major]
- location: css/main.css:1339-1380; creation src/game/UIConstants.js:805-832 (createResourceIndicator), update 839-893, callout 895-914; instances index.html:56-94 (mobile header), 144-186 (regular header), 340-345 (embark bag); per-context overrides css/main.css:2294-2296 (mobile 5em), 2318-2330 (#header-self-bar max-width 70px), 2338-2352 (-secondary)
- desktop: display:block, white-space:nowrap row of icon + label + value + change (0.75rem) + forecast + optional 35px inline progress bar. .stat-indicator-with-fill is a 13em (~208px) box whose background linear-gradient fill % is set inline from JS (UIConstants.js:880-885). Hover callout shows accumulation sources.
- mobile risk: nowrap rows overflow when label+value+forecast exceed column width; accumulation breakdown is hover-only; 0.75rem change text is small. Mobile variants already exist (#statsbar-resources-mobile) but cap width at 5em which truncates.

### Change/trend indicators (.change-indicator, .indicator-*) [none]
- location: css/main.css:1381-1412 (indicator-even/decrease/increase/fastincrease/equipped/unique), used index.html:84-89, 171-176, UIConstants.js:888-891
- desktop: 1em square background-image icons inline with stat values; opacity 0.75 (0.25 for even).
- mobile risk: None — scale with font size.

### Collapsible section (.collapsible-container / -header / -content) [minor]
- location: css/main.css:1413-1439, src/game/UIFunctions.js:295-305 (registerCollapsibleContainerListeners), 1140-1158 (toggleCollapsibleContainer, incl. accordion via .collapsible-container-group)
- desktop: Bordered box; header has pointer cursor, padding 5px 30px 5px 10px (~29px tall), arrow-circle PNG right-aligned, hover background; content slide-toggles (300ms/200ms). All start collapsed.
- mobile risk: Tap works (click handler), but 29px header height is under 44px. Hover background is the only pressed feedback.

### Progress bars (.progress / .progress-wrap / .progress-bar / .progress-label / .progress-bar-change / .progress-multibar-container / .progress-wrap-science) [none]
- location: css/main.css:1440-1496; instances index.html:100-105 & 121-126 (notification player), 269-272 (population), 725-728 (milestone, full-width), 799-820 (fight HP+shield multibars)
- desktop: width:100% max-width:300px, height 1em (1.5em full-width), grey wrap with 1px outline, absolute .progress-bar fill and centered 0.85rem .progress-label; .progress-bar-change shows pending change; .warning variant red (css/main.css:1907-1913). Fill widths set from JS.
- mobile risk: None structurally — fluid width. 0.85rem labels slightly small.

### Scrollable containers & scroll position indicator [minor]
- location: css/main.css:1497-1540 (.canvas-container, .scroll-position-container/-indicator-vertical/-horizontal, .scrollable.scroll-enabled cursor:all-scroll, .scrollable-container max-height:100vh overflow-y:scroll); UIConstants.js:27 (SCROLL_INDICATOR_SIZE)
- desktop: Bordered canvas wrappers with custom absolute scroll-position bars; drag-to-scroll cursor on maps; .scrollable-container used for game stats (index.html:928) and hotkey list (945).
- mobile risk: Drag-scroll is mouse-event based (map lens), and custom 11px webkit scrollbars (css/main.css:2991-3025) are invisible on iOS; the tiny scroll-position indicator becomes the only cue. Nested scroll areas inside popups fight page scroll.

### Item slot (.item-slot, .item-slot-big, equipment slots) [blocker]
- location: css/main.css:1701-1809 (slot 55x70px, .item-slot-image absolute at calc(55px/2-18px), .item-slot-name opacity:0, .item-slot-type-equipped 55x70 line-height 70px, per-category .item-count colors 1719-1730, .item-broken half-red gradient 1739-1742, .item-slot-lost red 1914-1917); index.html:457-467 (9 equipment slots); src/game/UIConstants.js:126-145 (getItemSlot/updateItemSlot)
- desktop: Fixed 55x70px boxes with absolutely-positioned 32px icon, count badge, type label strip; equipment grid of 9 slots (~513px inline-block row that wraps). All detail via hover callout incl. equip/unequip buttons.
- mobile risk: 55x70 exceeds 44px — good. But the row wraps to 6+3 on 390px (acceptable), and every interaction (equip/inspect) is inside the hover callout — broken on touch. .item-slot-name is opacity:0 (revealed only via slot type styling), so unlabeled.

### Item icon (.item) and resource icon (.res) with count badge [major]
- location: css/main.css:1833-1896 (.item 18px+5px pad+2px border circle w/16px img; .res 18px square w/12px img; .item-count absolute badge bottom:-0.9em 0.75rem), src/game/UIConstants.js:81-124 (getItemDiv), 489-533 (getResourceLi/getCurrencyLi), 204-223 (getItemList)
- desktop: ~32px circular item chips and ~20px square resource chips, each wrapped in an info-callout-target; comparison badge (.item-comparison-badge 10px icon at top:-11px right:-11px, css/main.css:1918-1936) overlays equippables. Used in bag list, result popups, log, trade inventories.
- mobile risk: 20-32px touch targets below minimum and packed 2px apart; all names/values hover-only; overhanging badges clip in tight containers.

### Explorer/NPC card (.npc-container, .explorer-slot, .npc-portrait, .explorer-icons, .interaction-options) [major]
- location: css/main.css:1810-1822 (#container-party-slots flex, .explorer-slot min-width 80px), 1979-2045 (npc-container min 50x50, -mini 36x36, portrait 32px, .button-row-2 button width 48px !important, .npc-type-indicator 12px, .npc-quest-indicator 10px); src/game/UIConstants.js:225-291 (getExplorerDivWithOptions), 293-312 (simple), 414-487 (NPC div/portrait)
- desktop: Inline-flex column card: 32px portrait (hover callout with full stats + action buttons), name, 1em status icon row, talk button (btn-narrow) plus a 2-cell table of 48px-wide btn-mini switch (⇵) and dismiss (×) buttons.
- mobile risk: 48px x ~27px glyph buttons under 44px height; portrait tap does nothing (callout is hover); dismiss '×' adjacent to switch invites destructive mis-taps. Party flex row (#container-party-slots) does not wrap.

### Inventory box / trade columns (.inventorybox, .inventorydivision, headers/footers) [blocker]
- location: css/main.css:1615-1689; index.html:850-873 (incoming-caravan popup: 4 inline-width columns 170+130+130+170px), css/main.css:1668-1671 (#common-popup .inventorybox ul min-width 380px), css/gridism.css:180-182 (popup inventorybox ul 100% on mobiles)
- desktop: Rounded bordered box of item-slot li chips; trade popup lays out 4 fixed-width table-cell columns (600px+ total) with sticky headers/footers inside the division.
- mobile risk: 600px of fixed inline widths inside a popup cannot fit 390px; min-width 380px on common-popup ul leaves no room for popup padding. Trade UI needs full relayout.

### Table system and fixed-width cell classes [blocker]
- location: css/main.css:605-762 (table.spacious, .borders, .updating, th.sortable cursor:pointer 651-654, .highlight-row tr:hover, th.foldable-table-header + td.folded-table-cell max-width:1px trick 658-683, td.list-amount/.list-storage min-width 30pt, td.list-ordinal 10pt, td.list-action width 100pt, td.item-name min-width 8em/6em small, td.text-overflow 6em, td.text-overflow-wide 10em); instances index.html:248 (in-improvements), 330-336 (embark), 420-439 (out-improvements: rows with 4 buttons + storage cell), 654-661 (upgrades), 697-709 (camp-overview, 12 columns)
- desktop: Dense data tables everywhere; action rows put build + improve + collect-all + collect-1 buttons plus a storage cell in one tr; camp overview has 12 columns with hide-in-small-layout on some; sortable/foldable headers via click.
- mobile risk: A single out-improvements row is ~95pt+2.5em+80pt+2.5em+text — well past 390px; tables have no horizontal-scroll wrapper so they overflow the page or crush cells. hide-in-small-layout already drops some camp-overview columns but not enough. Foldable/sortable headers work by tap but are ~20px tall.

### Checkbox (.checkbox, input[type=checkbox]) + .checkbox-label [major]
- location: css/main.css:2163-2178; instances index.html:502 (show obsolete crafting), 936-944 (settings: sfx, hotkeys, numpad)
- desktop: 1em (~16px) bordered box, margin 1px 3px, pointer cursor; label is a separate inline p not a <label>, so label taps do not toggle the box.
- mobile risk: 16px target far below 44px and the adjacent text is not tap-associated (no <label for>), making settings toggles very hard to hit.

### Range slider (input[type=range]) [major]
- location: css/main.css:2083-2162 (webkit/moz/ms variants: 5px track, 15px round thumb, 20px control height, focus outline removed)
- desktop: Custom-styled slider, 15px thumb on 5px track; focus outline suppressed (outline:none).
- mobile risk: 15px thumb is too small to drag precisely with a finger; no focus indication.

### Select dropdowns (select, .select-container) [minor]
- location: css/main.css:2179-2191 (min-width 5em, padding 1px 3px), 2184-2191 (.select-container flex); instances index.html:223-226 (map style/mode/level), 470 (autoequip type), 947 (language)
- desktop: Native selects, themed colors, ~22px tall, floated right in tab header (.tab-options, css/main.css:1291-1293).
- mobile risk: Native pickers work on touch, but the ~22px closed control is under 44px and three selects + a button floated right in the map tab header will wrap awkwardly at 390px.

### Text inputs (input.amount, #common-popup input, textareas) [major]
- location: css/main.css:2192-2198 (amount 30pt centered), 2073-2079 (base input/select/textarea theme); index.html:973 (rename input), 901/911 (save import/export textareas, cols=60); src/game/UIFunctions.js:1048-1081 (number/text key filters), 1725-1757 (showInput)
- desktop: 30pt-wide numeric text fields in steppers/embark; free text input in rename popup (maxlength 40); fixed cols=60 textareas for save import/export.
- mobile risk: type='text' gives full keyboard for numeric fields; cols=60 textarea (~480px) overflows 390px popups; on-screen keyboard will cover fixed-centered popups (popup reposition logic is transform-based).

### Badges (.improvement-badge, .improvement-upgrade-level, .status-badge, .changelog-type, .row-detail-indicator, .reqs-checkmark) [none]
- location: css/main.css:2451-2476 (improvement badge + absolute upgrade-level mini-badge top:-1px right:-1px 0.75rem), 2064-2072 (status-badge float right), 2489-2495 (changelog-type), 2578-2586 (row-detail-indicator 1.5em), 2792-2801 (reqs-checkmark 1em)
- desktop: Small rounded inline labels/counters; improvement count badge with overlaid upgrade-level corner chip; status badge floated right in upgrade details.
- mobile risk: None functionally — passive, em-based. 0.75rem corner chip is tiny but readable.

### List styles and bullets [none]
- location: css/main.css:1691-1697 (ul.buttonlist flex-wrap), 1823-1832 (ul.itemlist/ul.resultlist inline-block, list-style none), 2510-2520 (#changelog li:before custom 7px square bullet), 2674-2676 (ul.resultlist-positive li:before '+ '), 2209-2218 (#log ul plain)
- desktop: Nearly all lists suppress native bullets; changelog draws a 7px absolute square; result lists prefix '+'.
- mobile risk: None — flex/inline lists wrap naturally.

### Blueprint piece boxes (.blueprint-piece-box) [none]
- location: css/main.css:2691-2721 (2em box, found/missing variants, .layout-small img shrinks to 0.8em); UIConstants.js:535-538, 955-958
- desktop: Row of 2em bordered squares showing collected blueprint pieces, icon centered.
- mobile risk: Passive display, wraps if inline; fine. Small-layout icon already shrinks.

### Loading/thinking spinner and overlays [none]
- location: css/main.css:2914-2976 (.loading-content/.thinking-content fixed full-screen, .loading-spinner top:50%, 11px bouncing dots, sk-bouncedelay keyframes), 2977-2987 (#theme-transition-overlay); index.html:987-1004; toggled UIFunctions.js:671-675 (setGameOverlay)
- desktop: Full-viewport fixed overlays with three 11px animated dots centered vertically.
- mobile risk: None — viewport-relative.

### Mobile blocking overlay (#mobile-overlay) [blocker]
- location: css/main.css:2901-2913, index.html:982-985, src/game/level13.js:264-273 (toggled by GameConstants.isMobileOverlayShown, dismiss link)
- desktop: Fixed full-screen z-index 20 overlay stating 'Level 13 isn't optimized for mobile... many elements rely on hover effects', with a dismiss link.
- mobile risk: By design blocks mobile play. The redesign must disable isMobileOverlayShown or remove the overlay entirely.

### Notification player bar (.notification-player) [none]
- location: css/main.css:2402-2416, index.html:100-105 (mobile) and 121-126 (regular)
- desktop: Bordered strip containing a full-width 1.25em progress bar with label; shown while a timed action runs. Separate mobile instance already exists in #mobile-header.
- mobile risk: None — full-width, mobile slot exists.

### Focus states [major]
- location: css/main.css:839-841 (button:focus-visible 2px outline), 1042-1059 (callouts on :focus), 2092-2094 (range focus outline:none); index.html:202-212 (tabs tabindex=0), src/game/UIFunctions.js:1083-1090 (Enter/Space on button-like), 1562-1585 (focus()), UIConstants.js:1203-1220 (isFocusable)
- desktop: Keyboard path exists: tabs focusable, callouts open on focus, popups focus default button.
- mobile risk: Focus-based callout opening is the one non-hover path to tooltips — could be repurposed for tap, but currently tapping a non-focusable div target (most .info-callout-target are divs without tabindex) gives nothing.

### Long-tap helper (registerLongTap) [major]
- location: src/game/UIFunctions.js:1516-1560, used src/game/systems/ui/UIOutPopupTradeSystem.js:271
- desktop: Implements press-and-hold auto-repeat (1s delay, 200ms interval) for trade item transfer using mousedown/mouseup/mousemove/mouseleave and global mouse state (UIFunctions.js:159-174).
- mobile risk: Built entirely on mouse events; touch emulation fires mousemove and cancels the timer, and long-press triggers the browser context menu/text selection instead. Needs pointer/touch events plus touch-action and user-select guards.

### Steppers/selects/buttons inside table rows (embark, improvements, repair) [blocker]
- location: index.html:330-336 (embark tables), 420-439 (out-improvements 5-column button rows), 496-497 (self-repair-items table), css/main.css:942-947 (table .container-btn-action margins)
- desktop: Interactive widgets embedded in table cells; each row combines label + several fixed-width buttons/steppers.
- mobile risk: Combined fixed widths exceed 390px; table cells do not wrap, so rows overflow horizontally. Needs card-style row relayout.

### Highlight/warning text helpers [none]
- location: css/main.css:1897-1917 (.warning red incl. progress variant, .btn-warning), 565-580 (.hl-functionality, .p-meta, .dimmed, .secondary), UIConstants.js:1179-1191 (highlight/warning/meta wrappers)
- desktop: Inline span coloring system used by nearly all generated text.
- mobile risk: None.

### Layout-mode switcher (layout-regular / layout-small) [major]
- location: src/game/constants/UIConstants.js:29 (SMALL_LAYOUT_THRESHOLD 850), src/game/systems/ui/UIOutHeaderSystem.js:1121-1124 (toggles body classes on resize), css/main.css:13-28, 110-113 (.hide-in-small-layout), plus ~20 .layout-small overrides throughout main.css; gridism.css:166-183 (.center-on-mobiles/.hide-on-mobiles/.fill-on-mobiles under a media query)
- desktop: Below 850px window width the body switches to layout-small: side header and stats grid hidden, #mobile-header fixed top bar shown, log goes full-width, some columns hidden. Many JS systems branch on hasClass('layout-small').
- mobile risk: This is the existing partial mobile mode the redesign must build on — it handles headers but none of the touch-target, callout, table, or trade-popup problems. Any new breakpoint work must keep the 850px JS threshold and CSS in sync (comment at UIConstants.js:29).

### Fight damage/status floaters [minor]
- location: css/main.css:2744-2767 (.fight-damage-indicator right:-3em, .fight-status-indicator right:-5em, absolute)
- desktop: Damage numbers positioned absolutely 3-5em to the RIGHT of the name container inside the fight popup.
- mobile risk: Negative-right offsets push floaters outside a full-width mobile popup, clipping or causing horizontal scroll.

### Theme duplication (dark/sunlit) build detail [minor]
- location: css/main.css:484-3200 (body.dark) duplicated at 3201-5917 (body.sunlit); source css/main.less
- desktop: Every widget rule exists twice, once per theme, compiled from main.less.
- mobile risk: Not a runtime risk, but every mobile CSS fix must be applied to both theme blocks (or in main.less and recompiled) or one theme silently misses the redesign.

**Notes:** Cross-cutting for the mobile redesign: (1) The hover-callout system is the load-bearing information channel — btn-callout carries costs/risks/duration/disabled reasons and info-callout carries item/explorer/resource details plus real action buttons (equip, discard, dismiss, talk). CSS shows them only on :hover/:focus (main.css:1042-1059); nothing in UIFunctions adds touch/tap handling. A tap-to-open (and tap-outside-to-close) callout mode, or inlining the content, is the core of the redesign. (2) A partial small-screen mode already exists: body.layout-small below 850px (UIConstants.SMALL_LAYOUT_THRESHOLD, toggled in UIOutHeaderSystem.js:1121-1124) with a dedicated #mobile-header (index.html:36-107) and per-resource mobile indicator instances generated in UIFunctions.generateResourceIndicators (341-349); reuse it rather than adding a new breakpoint, and keep the JS constant and CSS in sync. There are also stale-looking classes layout-mobile (main.css:2667,2681) and regular-layout (1668) that don't match the toggled class names — verify before relying on them. (3) Touch-target audit summary: btn-glyph/stepper ± ~24px, btn-mini ~27px, btn-meta ~19px, checkboxes 16px, range thumb 15px, tabs 36px, base buttons ~37px, item chips 20-32px — nearly every interactive widget is below 44px; only .item-slot-big (55x70) passes. (4) Fixed-width hotspots that hard-break 390px: trade popup columns (600px inline widths, index.html:850-873), #common-popup .inventorybox ul min-width 380px, btn-x-wide 240px in table rows, out-improvements 5-widget table rows, save-export textarea cols=60, 11 nowrap tabs. (5) All theming is duplicated dark/sunlit in compiled main.css from main.less — edit the less source or patch both blocks. (6) registerLongTap and the global mouse-state tracker are mouse-only; convert to pointer events. (7) Buttons are generated at runtime (ActionButton.create via UIFunctions.createButtons) so structural button changes belong in src/utils/ActionButton.js, not HTML.

## LENS: popups

### Main level map canvas (#mainmap) [blocker]
- location: index.html:534-546, src/game/helpers/ui/UIMapHelper.js:130-158,265-331,1046-1060,1062-1137, src/game/systems/ui/UIOutMapSystem.js:129-132,240-284, css/main.css:1497-1505,2549-2555,3029-3035
- desktop: Canvas 500x500 in HTML but resized every rebuild: width/height = max(computed map size, container size). Computed size = (visibleSectors+1.5) * sectorSize * 1.85 + margins, where sectorSize = round(11px * zoom 0.6-2.4) (UIMapHelper getSectorSize 1160-1163, MapUtils.js:12-28). getCanvasMinimumWidth('mainmap') returns parent width, so canvas always at least fills the container. Container #mainmap-container is .canvas-container (overflow:hidden, position:relative, text-align:center); its max-height is set by JS to max(198, windowHeight-380) (updateHeight UIOutMapSystem.js:129-132) on resize. Viewport into a typically much larger canvas; navigation is programmatic scrollLeft/scrollTop only. Canvas fades with vision level via .vision-step-N #grid-main .canvas-container canvas opacity rules (main.css:154-480). All map CSS is duplicated under body.dark AND body.sunlit (e.g. 3029 vs 5746).
- mobile risk: A full level at zoom 1 is far wider than 390px, so most of the map is off-screen; because the container is overflow:hidden and all panning is JS mouse-event driven, touch users cannot reach it at all (see pan element). max-height = windowHeight-380 gives ~380-460px portrait but collapses to the 198px floor in landscape phones. Canvas itself resizes to parent width fine.

### Map pan / drag-scroll [blocker]
- location: src/game/constants/CanvasConstants.js:6-53,110-127, src/game/helpers/ui/UIMapHelper.js:84-97, src/game/systems/ui/UIOutMapSystem.js:59, css/main.css:1531-1533
- desktop: makeCanvasScrollable('mainmap') binds jQuery mousedown/mouseup/mouseleave/mousemove on the canvas; dragging sets parent .scrollLeft/.scrollTop (inverted grab-pan), releases snap to a 20px grid (getScrollSnapPosition). Cursor becomes all-scroll via .scrollable.scroll-enabled. mousedown does preventDefault and clears text selection. Note: drag must start on canvas background - the overlay sector cells (pointer-events:auto) sit above the canvas, so a drag starting on a sector does not pan.
- mobile risk: Mouse events only - no touchstart/touchmove/pointer events, and the container is overflow:hidden so native touch scrolling is impossible. On a touch screen the map cannot be panned at all; anything outside the initial viewport (centered on player) is unreachable. This is the single biggest mobile break in the lens. Same code path breaks the tech tree (shared CanvasConstants).

### Mouse-wheel zoom (fork feature) [blocker]
- location: src/game/systems/ui/UIOutMapSystem.js:60-61,465-515, src/game/helpers/ui/UIMapHelper.js:49-82,78-82,796-797,907-910
- desktop: wheel event on #mainmap-container: preventDefault, zoom in/out one step (MAP_ZOOM_MAIN_STEP 0.3, clamped 0.6-2.4), full map+overlay rebuild, then scroll adjusted so the map point under the cursor stays fixed (zoomMap 476-503). Icons and resource markers scale with zoom via getIconScale (icon 10px*zoom, resource squares 5px/3px*zoom); overlay hit cells are sized inline from the zoomed sectorSize. No on-screen zoom buttons, no keyboard binding - wheel is the only trigger.
- mobile risk: Wheel-only: touch devices have no wheel, no pinch handler exists, and page pinch-zoom (viewport meta allows it) zooms the whole page, not the map. Zoom is completely inaccessible on touch. Redesign needs pinch-to-zoom and/or +/- buttons calling uiMapHelper.changeMapZoom + the existing zoomMap focal-point logic.

### Sector click-target overlay (#mainmap-overlay / .map-overlay-cell) [major]
- location: index.html:540, src/game/helpers/ui/UIMapHelper.js:333-375,160-170, css/main.css:3036-3065 (dark) / 5753-5782 (sunlit)
- desktop: Absolutely-positioned div grid over the canvas; parent .canvas-overlay pointer-events:none, cells pointer-events:auto, cursor:pointer. Cell size set inline = sectorSize (11px * zoom; fork commit aa465c09), CSS fallback 11px. Click plays sound, clears other selections, adds .selected (white bg + 5px outline glow), calls sectorSelectedCallback -> details panel. :hover paints the cell white.
- mobile risk: Tap works (click event), but targets are 11px at zoom 1 - roughly a quarter of the 44px touch minimum - and sectors are ~9.4px apart, so fat-finger mis-taps on neighbouring sectors are near-certain. Max zoom 2.4 only reaches ~26px. Hover highlight is meaningless on touch. Needs bigger effective hit slop or a default higher zoom on small screens.

### Sector hover tooltip (#map-sector-tooltip, fork feature) [major]
- location: index.html:779-781, src/game/systems/ui/UIOutMapSystem.js:62-70,86-91,322-463,1044,1055-1058, css/main.css:3066-3117 (dark) / 5783-5833 (sunlit)
- desktop: Body-level position:fixed pane, z-index 20, pointer-events:none, min-width 190px / max-width 320px, max-height calc(100vh-16px), font 0.85rem. Delegated mouseenter/mousemove/mouseleave on .map-overlay-cell; shows after 450ms hover at cursor+16px, flips near viewport edges, pins with 8px margin. Content mirrors the click-through details panel (same fields/label keys, empty rows skipped). Dismissed on click, wheel, map scroll, tab change, resize, teardown.
- mobile risk: Pure hover feature - unreachable on touch (tap fires click which immediately hides/cancels it). Information parity survives because tapping a sector shows the identical fields in the details panel below the map, but the redesign must either accept the panel as the touch equivalent or add long-press to show the pane; 320px max-width also nearly fills a 390px screen.

### Sector details panel + jump buttons [minor]
- location: index.html:547-592, src/game/systems/ui/UIOutMapSystem.js:106-115,286-320,546-644,659-727, css/main.css:891-908 (btn-glyph)
- desktop: Box under the map: 7 icon glyph buttons (next/previous/camp/unknown/unscouted/investigate/ingredients) each 1.5em (~24px) square with themed img, conditionally toggled; selecting animates map centering (300ms). Details table (district/distance/POI/scavenging/collectors/threats/blockers/environment/other) with .textwidth label column; '(directions)' btn-meta opens a step-by-step path popup (showSectorPath); debug row has a Teleport cheat button. Rows highlighted .current per map mode (selectMapMode 211-223).
- mobile risk: Mostly plain DOM that reflows fine at 390px. Glyph buttons are ~24px - below touch size, and 7 in a row plus long table values (POI/scavenging strings can be long) make the panel tall but usable. Low effort: enlarge buttons, allow table label column to shrink.

### Map header controls (style/mode/level selects + download) [major]
- location: index.html:222-227, src/game/systems/ui/UIOutMapSystem.js:56-58,134-194,1068-1071,1094-1111, css/main.css:1291-1293
- desktop: Three native <select>s (#select-header-mapstyle Canvas/ASCII, #select-header-mapmode Default/Hazards/Scavenging - only visible with the map-mode item, #select-header-level one option per visited level e.g. 'Level 13 (-)') plus a 'download' button (ASCII style only), all .tab-options float:right inside the tab header row next to the h2 page header.
- mobile risk: Native selects are touch-friendly, but three floated selects plus a button competing with the h2 in one header row will wrap or overflow at 390px; float:right ordering also reverses visual order when wrapped. Needs a stacked/flex header layout. Functionality itself survives.

### ASCII map style (textarea + legend + download) [minor]
- location: index.html:543-546, src/game/systems/ui/UIOutMapSystem.js:225-238,275-283,1025-1029, src/game/helpers/ui/UIMapHelper.js:172-263, css/main.css:2556-2564,2595-2597
- desktop: Alternative map rendering: readonly monospace textarea (width:100%, rows clamped 5-25) filled by getASCII (one char per sector: ? 0 X C U D !, mode-specific variants), legend text below (#mainmap-ascii-legend), 'download' saves the text via FileUtils. Style persisted in gameState.settings.mapStyle.
- mobile risk: Wide levels produce long unwrapped lines in a 100%-width textarea - horizontal scrolling inside a textarea on touch is awkward but possible, and monospace at default size makes rows misalign if the browser wraps. Actually the most mobile-viable map style already present; consider it a fallback. File download works on modern mobile browsers.

### Scroll position indicators [minor]
- location: src/game/constants/CanvasConstants.js:14-16,77-108, css/main.css:1506-1530, src/game/constants/UIConstants.js:27
- desktop: makeCanvasScrollable wraps the scroll container in .scroll-position-container (padding 5px) and injects thin vertical/horizontal bars (.scroll-position-indicator, background #3a3a3a) whose length/position mirror viewport-vs-canvas ratio; updated on scroll/zoom/center. Applies to both mainmap and tech tree.
- mobile risk: Purely visual - renders fine at any width. Only risk is they are the sole affordance that more map exists off-screen; on mobile they must be kept (or replaced) once touch panning is added, and they are updated only by the JS pan path, so a native-scroll solution must call updateScrollIndicators.

### Map completion hint [none]
- location: index.html:536, src/game/systems/ui/UIOutMapSystem.js:729-778
- desktop: Plain <p id='map-completion-hint'> above the map; composed text describing level type + exploration status, updated on tab/level change.
- mobile risk: none

### Minimap (Out tab, #minimap) [none]
- location: index.html:355-373 (358-362), src/game/systems/ui/UIOutLevelSystem.js:223-224,1055-1065, src/game/helpers/ui/UIMapHelper.js:130-158 (centered path),1046-1060, src/utils/MapUtils.js:12-28, css/main.css:2521-2545, css/gridism.css:67,136-144
- desktop: 198x198 canvas (inline style width/height 198px on #minimap-container) nested inside 224x224 #minimap-background-container, margin:auto, in the .unit-compass column (33% width). Rebuilt via rebuildMap('minimap', null, pos, 7, true, ...) - 7x7 sectors centered on player, fixed 16px sector size, its own padding 0.75/margin 0, icons NOT zoom-scaled (getIconScale centered=1). No overlay, no pan, no zoom, not clickable; hidden until scouting unlocked. Position + distance-to-camp text (#out-position-indicator/#out-distance-indicator) below.
- mobile risk: none - fixed 224px fits 390px; the gridism 568px breakpoint stacks .unit-compass to 100% width and margin:auto keeps it centered. Only cost is ~230px of vertical space above the sector description.

### Minimap edge hints (#minimap-background) [none]
- location: index.html:359, src/game/helpers/ui/UIMapHelper.js:377-515 (rebuildMapHints/getMaphints/drawMapHint/getMapHintEdge)
- desktop: Second 224x224 canvas behind the minimap (opacity 0.75). Draws 10px blips on the frame edge pointing toward off-minimap targets: camp icon, scouted passages up/down, nearest known water (colored dot), food, and quest grove. Edge math hard-codes frame size 12 and canvas extent 224 (getMapHintEdge:498).
- mobile risk: none at current size - but the 224px extent is hard-coded in getMapHintEdge, so any redesign that resizes the minimap must also parameterize this or blips will pin to wrong edges. Icons are 10px, purely informational (not tappable).

### Camp visualisation canvas (#campvis + building divs) [minor]
- location: index.html:232-241, src/game/systems/ui/UIOutCampVisSystem.js:22-37,59-65,92-109,140-192,454-488,516-524,568-576, css/main.css:3129-3200
- desktop: Decorative camp skyline at top of Camp tab. Canvas width = parent width (min 100px), height fixed 96 (container CSS height 100px, border 2px); re-measured on windowResized/gameStarted/gameShown and tab change. Buildings drawn on canvas (per-building vector shapes, z-layers 0-4, x positions spread from container center via getXpx containerWidth/2) plus invisible absolutely-positioned 12px divs (.vis-camp-building) for hover: mouseenter shows '#vis-camp-info-overlay' 16px bottom bar with 'building (Level N)' (fortification/sundome excluded). Floor strip div 20px.
- mobile risk: Sizing adapts (recomputed from parent width on resize), so it renders at 390px, though buildings crowd toward the center and can extend past narrow edges since coordinates are camp-defined, not width-clamped. Building-name hover overlay is mouse-only; a tap on a 12px div fires simulated hover on iOS but is unreliable - acceptable loss or convert to tap. Decorative only, no game actions.

### Tech tree canvas (#researched-upgrades-vis, Upgrades tab) [blocker]
- location: index.html:650-687 (667-670), src/game/helpers/ui/UITechTreeHelper.js:133-160,162-208,219-240,334-379,435-443, src/game/systems/ui/UIOutUpgradesSystem.js:27,36,175, css/main.css:3118-3128
- desktop: Canvas rendering of the upgrade DAG: fixed cell metrics 85x22px, 20/15px gaps, 20px tree padding; canvas width = max(treeWidth, parent width), height = max(treeHeight, 100); container max-height 300px, overflow hidden. Wrapped by the same CanvasConstants mouse-drag scroll + indicators as the map. Overlay divs .upgrades-overlay-cell (85x22, text label, click selects tech -> #upgrade-details panel below; hover sets highlightedID and redraws the whole canvas dimming unrelated nodes/arrows). Node colors by status, 3px border when researchable, quadratic-curve arrows with arrowheads.
- mobile risk: Mid/late-game trees are many 105px columns wide (>>390px) and >300px tall, and the only navigation is the mouse-only drag - on touch the tree is frozen at the top-left corner: blocker. Hover dim-highlighting is unreachable on touch (informational loss). 85x22 tap cells are wide enough but only 22px tall. Text in overlay cells at 0.75rem may clip.

### Upgrade details panel (#upgrade-details) [none]
- location: index.html:671-685, src/game/systems/ui/UIOutUpgradesSystem.js:27-34
- desktop: DOM box under the tech tree; shows status badge, name, description, effect, unlocked research for the tech selected via overlay click; empty-state hint otherwise.
- mobile risk: none - plain reflowing DOM; selection via tap works once the tree itself is reachable.

### World tab map (verification: does not exist) [none]
- location: index.html:691-712
- desktop: The World tab (#container-tab-two-world, switch-world) contains no canvas or map - only #world-message and the #camp-overview table (camp/pop/rep/raid/disease/storage/production columns, with .hide-in-small-layout columns). No world-map element exists anywhere in the codebase.
- mobile risk: none for this lens - table belongs to the tables/tabs lens. Recorded here so the parity audit does not hunt for a phantom 'world map'.

### Map centering & animation [none]
- location: src/game/helpers/ui/UIMapHelper.js:99-128, src/game/systems/ui/UIOutMapSystem.js:517-544,552,561
- desktop: centerMapToPosition computes the sector's pixel position and scrolls the container so it is centered (snap to 20px grid); 300ms jQuery animate when jumping via detail buttons; invoked on tab open, level change, style change. Center target: selected sector > camp on selected level > player position.
- mobile risk: none - math is container-size-relative and works at any viewport; it is also the only thing that makes the map initially usable on mobile (player is centered), which masks the missing pan until the user tries to look elsewhere.

### Map canvas drawing internals (grid, districts, beacons, sectors, icons, resources, movement lines/blockers) [none]
- location: src/game/helpers/ui/UIMapHelper.js:265-331,581-656,658-767,769-877,879-959,961-1002, src/utils/MapElements.js:13-61, src/utils/CanvasUtils.js:1-108, src/utils/MapUtils.js:30-98
- desktop: Pure-canvas rendering per rebuild: 10-sector grid squares (2px stroke), rounded district backgrounds, beacon radius circles, hazard/sunlit borders (1-4px), sector fill by status/map-mode, 13 PNG icon pairs (normal+sunlit, natural size 10px, scaled by zoom), 5px/3px resource squares, movement lines (width sectorSize/5) with blocker glyphs (gang circle, toll gate square, X cross), player-position ring. Map modes (default/hazards/scavenging) change fills/borders/icons per MapUtils.show* flags.
- mobile risk: none intrinsically - everything derives from sectorSize so it scales with zoom; at zoom 1 the 11px sectors and 10px icons are legible-but-small on a 390px screen, arguing for a higher default zoom on mobile. Icons are raster PNGs authored at 10px, so upscaling beyond ~2x blurs (already true on desktop at zoom 2.4).

### Vision-level canvas dimming [none]
- location: css/main.css:154-480 (.vision-step-N #grid-main .canvas-container canvas + #mainmap-sector-details-content td)
- desktop: Eleven vision-step classes on body progressively change opacity/color of all .canvas-container canvases and the map details table with 3s transitions, simulating darkness while exploring.
- mobile risk: none - class-based, viewport-independent. Must simply survive any container/class restructuring in the redesign.

**Notes:** Cross-cutting: (1) Every canvas surface (mainmap, tech tree) that exceeds its viewport relies on ONE shared code path - CanvasConstants jQuery mouse drag + overflow:hidden containers (CanvasConstants.js:6-53). Adding pointer-event (touchstart/touchmove or Pointer Events) support there, or switching containers to overflow:auto with -webkit-overflow-scrolling and syncing updateScrollIndicators/snapScrollPositionToGrid, fixes both blockers at once. (2) Zoom needs a touch trigger: pinch gesture and/or on-screen +/- buttons wired to the existing zoomMap(steps, pageX, pageY) which already handles focal-point preservation; MAP_ZOOM range 0.6-2.4 step 0.3 lives in UIMapHelper.js:49-51. Consider a larger default zoom on small screens to fix the 11px tap targets simultaneously. (3) All map/canvas CSS is emitted twice (body.dark ~lines 1497-3200 and body.sunlit ~4214-5900, generated from css/main.less) - every mobile override must cover both prefixes or be written unprefixed with higher specificity; prefer editing main.less if a compile step is available. (4) Hover dependencies to resolve: sector tooltip (parity exists via tap->details panel), .map-overlay-cell:hover highlight, tech-tree highlight-connected-on-hover, campvis building name overlay, cursor affordances (all-scroll/pointer). (5) Existing responsive plumbing to reuse: viewport meta present (index.html:19, pinch not disabled), windowResizedSignal drives updateHeight/campvis reflow, gridism breakpoints at 850px and 568px stack all units to 100%, helper classes hide-on-mobiles/fill-on-mobiles/center-on-mobiles and .layout-small already exist. (6) Hard-coded sizes to watch if resizing components: minimap 224 (UIMapHelper.getMapHintEdge:498, index.html:359-361), minimap sector 16px / mainmap 11px (MapUtils.js:12-16), tech tree cell 85x22 (UITechTreeHelper.js:138-141 and .upgrades-overlay-cell css:3121-3125), campvis height 96/100px (UIOutCampVisSystem.js:30, css:3133-3139), mainmap max-height formula windowHeight-380 (UIOutMapSystem.js:130) which bottoms out at 198px in phone landscape. (7) Minor pre-existing bug noticed, not mobile-related: UIMapHelper.getMaphints:421 pushes the passage-down hint with id 'passage-up'.

## LENS: canvas

### Meta viewport [none]
- location: index.html:19
- desktop: width=device-width, initial-scale=1. No maximum-scale, no user-scalable restriction, so pinch zoom stays available. No theme-color, no apple-mobile-web-app metas, no -webkit-tap-highlight-color or touch-action rules anywhere in CSS.
- mobile risk: none for the tag itself; missing tap-highlight/touch-action polish is cosmetic. Add theme-color for browser chrome if desired.

### Mobile blocking overlay [blocker]
- location: index.html:982-985, main.css:2901-2913 (dark), main.css:5618-5630 (sunlit), src/level13-app.js:16-19, src/game/level13.js:263-274, src/game/helpers/ui/ChangeLogHelper.js:31
- desktop: Full-screen fixed overlay z-20 that appears when the UA regex matches Android/iPhone/iPad/etc. Text says the game 'isn't optimized for mobile' and 'many elements rely on hover effects'. Dismiss link #btn-dismiss-mobile-overlay sets game opacity back on. Also gates changelog display.
- mobile risk: Blocker by design: every mobile visitor hits this wall first. The redesign must remove or invert this gate (GameConstants.isMobileOverlayShown).

### Base body typography [none]
- location: main.css:484-491 (dark), 3201-3208 (sunlit); source css/main.less:10-14 and css/modules/base-typography.less:3-7
- desktop: Arial, sans-serif; font-size 1em (16px); line-height 1.35em. normalize.css:11-14 sets html line-height 1.15 and -webkit-text-size-adjust:100%.
- mobile risk: none — 16px base is fine; text-size-adjust 100% prevents iOS auto-inflation, which is correct for a controlled redesign.

### Heading typography [minor]
- location: main.css:779-795 (dark), 3496-3512 (sunlit), normalize.css:40-43, main.css:2202-2205 (faq-category h3)
- desktop: h1-h6 use 'Arial Narrow', Arial fallback; letter-spacing 0.1pt; text-transform uppercase. h1 2em via normalize. h3/h4 margin 1em 0 0.5em.
- mobile risk: minor — Arial Narrow does not exist on iOS/Android so headings render wider in plain Arial; uppercase long location headers (#grid-location-header h1) will wrap on 390px. Test with fallback font metrics.

### Small text tier 0.85rem (~13.6px) [major]
- location: main.css:17-19 (.layout-small #footer), 609-611, 750-752, 1139-1144 (callout content), 1375-1380, 1478-1486 (progress-label), 1541-1555 (.bubble), 1686-1690 (.info-detail), 1743-1770 (item-slot type labels), 2046-2050, 2304-2310 (#header-self-bar), 2402-2410 (notification-player), 2496-2500 (#changelog), 2598-2606, 2622-2629, 2741-2767 (fight indicators), 2802-2843 (save popup), 3066-3097 (map tooltip); sunlit mirrors at 3326+, source main.less:11 @font-size-small
- desktop: Secondary information layer: tooltips/callouts, progress bar labels, header side bar, log timestamps context, camp overview stats, fight damage numbers, save slots, map sector tooltip.
- mobile risk: major — 13.6px is at the floor of comfortable phone legibility and this tier carries core information (action costs in callouts, progress labels, fight feedback). Redesign should lift this tier to >=14-15px or rethink placement.

### Tiny text tier 0.75rem (12px) [major]
- location: main.css:722-735 (td.text-overflow), 1020-1032 (.hotkey-hint), 1361-1365 (stat change/forecast), 1877-1893 (.item-count), 2233-2247 (log span.time, msg-camp-level), 2327-2330 (#header-self-bar values), 2468-2476 (improvement-upgrade-level badge), 3041-3048 (canvas-overlay-cell), 3140-3151 (#vis-camp-info-overlay), 3178-3185 (vis-camp-building); sunlit mirrors; source main.less:12 @font-size-tiny
- desktop: Tertiary labels: item stack counts, stat deltas, log timestamps, upgrade-level badges on improvement buttons, map overlay cell labels, camp visualization info strip.
- mobile risk: major — 12px raster-adjacent text is illegible for many users on a 390px screen; item counts and upgrade badges convey gameplay state. Must scale up.

### Text transforms and misc typography [none]
- location: main.css:822-833 (button lowercase), 1215-1235 (tabs lowercase), 1348-1350 (stat labels lowercase), 2439-2443 (game-version/msg lowercase), 2556-2561 (#mainmap-container-ascii monospace), 2879-2883 (game-stat-category uppercase), 525-529 (strike-through), 773-778 (::selection #ccc)
- desktop: Buttons and tabs lowercase; ascii map monospace; disabled actions line-through (997-1003).
- mobile risk: none — transforms carry over; monospace ascii map textarea needs horizontal scroll handling (layout lens).

### Dual theme system body.dark / body.sunlit [major]
- location: main.css:484-3200 (entire dark block), 3201-5917 (entire sunlit block), index.html:29 (body class 'wrap wider dark'), css/main.less:24-51 (color-theme mixin), css/themes/theme-dark.less, css/themes/theme-sunlit.less
- desktop: Every themed rule is emitted twice, once under each body-class prefix. Theme is not a user setting: it follows the current sector's sunlit flag (surface levels) via UIOutHeaderSystem.updateTheme (src/game/systems/ui/UIOutHeaderSystem.js:1190-1227). forceSunlit/forceDark debug flags exist (1211-1212).
- mobile risk: none functionally, but every mobile CSS change must be made under BOTH prefixes or in the .less modules and recompiled (main.css is generated from main.less — header comment '// out: main.css'). 100% parity requires the sunlit theme to be tested on mobile too, not just dark.

### Theme color palettes [major]
- location: css/themes/theme-dark.less:1-40, css/themes/theme-sunlit.less:1-42; compiled throughout main.css (e.g. 484-486, 557-564, 3201-3203, 3274-3281)
- desktop: Dark: page #202220, box #282a28, element #2f322f, borders #3a3a3a/#555, text #fdfdfd, secondary #bbb, dimmed #666, disabled #999, warning #e64646/#E13232, accent science #358 / nature #385 / community #853. Sunlit: page #fbfbfb, box #fff, element #e6e6e6, borders #aaa/#999, text #202220, secondary #777, dimmed #999, disabled #666, accents #6af/#6fa/#fa6.
- mobile risk: minor-to-major contrast: dark .dimmed #666 on #202220 is ~3.4:1 and sunlit .dimmed #999 on #fbfbfb is ~2.7:1 — both fail WCAG AA for the small text they are applied to; worse outdoors on a phone. Redesign should bump dimmed/secondary tiers.

### JS-side color palette duplication (canvas + inline styles) [minor]
- location: src/game/constants/ColorConstants.js:1-130+ (colors.dark/colors.sunlit maps), src/game/systems/ui/UIOutHeaderSystem.js:1283-1309 (updatePageBackgroundColor sets body background inline per vision level), src/utils/MapUtils.js:39-52, src/utils/MapElements.js:20-40
- desktop: Map canvas, techtree, camp visualization, and page background colors come from JS, keyed by sunlit flag; comment says values must be kept in sync with .less. Body background is overridden inline by JS (bg_page_vision_level_0..4: #121312 to #202220 in dark).
- mobile risk: none directly, but any mobile palette change must also touch ColorConstants.js; the inline body background overrides any CSS mobile theming.

### Theme transition overlay animation [none]
- location: main.css:2977-2987 (dark), 5694-5704 (sunlit), index.html:1004, src/game/systems/ui/UIOutHeaderSystem.js:1320-1370, src/game/constants/UIConstants.js:37 (THEME_TRANSITION_DURATION 1200ms)
- desktop: Fixed full-screen #8E8F8E overlay z-20; jQuery animates opacity 0→1 (40% of 1200ms), swaps body classes, then fades back. body gets .theme-transition class during it. themeToggledSignal triggers map redraw.
- mobile risk: none — full-screen fade works on touch; keep the overlay above any new mobile chrome (z-20 vs popups z-15/16/25/26).

### Themed icon swapping (img-themed) [minor]
- location: src/game/systems/ui/UIOutHeaderSystem.js:240, 258-281, 1229-1243; icon pairs in img/eldorado/*(-dark).png, img/map/*(-sunlit).png, img/ui-level-*(-dark).png, img/open-iconic/arrow-circle-*-2x(-dark).png
- desktop: img.img-themed elements carry data-src-sunlit/data-src-dark; JS swaps src on theme change. CSS background-image variants handle indicators (main.css:1390-1412 vs 4107-4129), collapsible arrows (1419-1435 vs 4136-4152), bubbles (1561-1573 vs 4278-4290).
- mobile risk: minor — mechanism is resolution-independent; but note main.css:5509-5512 bug: sunlit .reqs-checkmark declares the sunlit icon then immediately overrides it with the -dark icon (duplicate background-image line). Preserve or fix knowingly.

### Vision step/level dimming system [major]
- location: main.css:143-483 (vision-step-0..10 classes, compiled from css/modules/vision.less), src/game/systems/ui/UIOutHeaderSystem.js:1245-1281 (toggles vision-step-N, vision-level-1..4, .hidden-when-down opacity)
- desktop: Body class per vision decile dims #grid-main (opacity 0.5-1.0), grayscales images (grayscale 1.8→0), and dims text/images at different rates. .hidden-when-down (headers) goes opacity 0 at vision level 0. Leftover LESS junk compiled as literal '@is-low-vision : 0 < 3;' declarations (143-146 etc) — inert.
- mobile risk: major for the redesign: the mobile header (#mobile-header) is a .hidden-when-down element, so at zero vision the entire mobile HUD vanishes by design; any new chrome must respect these classes. Dimmed text at opacity 0.5 over #121312 is near-invisible on dim phone screens (gameplay intent — document, don't break).

### Global 1s opacity transition on most elements [major]
- location: main.css:121-135; opt-outs .ui-transition-element 136-142, .game-opacity-controller 94-101, and per-element transition:none overrides (2233-2242, 2549-2555, 2744-2781)
- desktop: img, p, span, h1-h3, div, canvas all have transition: opacity 1s ease-in-out — this powers the vision dimming crossfade. Additionally img and td/th get transition: all 0.15s (605-608, 770-772).
- mobile risk: major performance: a universal transition on div/span/img means every opacity change triggers composited animation across thousands of nodes; low-end phones will jank, especially combined with grayscale filters (GPU-heavy). Consider scoping the transition or honoring prefers-reduced-motion (currently absent repo-wide).

### Loading/thinking spinner animation [none]
- location: main.css:2914-2976 (dark), 5631-5693 (sunlit, duplicate keyframes), index.html:987-1002
- desktop: Fixed full-screen .loading-content/.thinking-content overlays z-20 with three 11px dots, sk-bouncedelay 1.3s infinite scale keyframes.
- mobile risk: none — scales fine; dots are decorative.

### Event blink animation (event-starting/ending) [none]
- location: main.css:2722-2740 (dark), 5439-5457 (sunlit), @keyframes event-end
- desktop: 1.3s step-end infinite opacity blink to 0.4 on event progress bars when a camp event starts/ends; .event-no-timer bars at 0.5 opacity.
- mobile risk: none functionally; low frequency (0.77Hz) so no photosensitivity concern. Keep for parity.

### Button motion/feedback: active offset, hover colors, cooldown overlays [minor]
- location: main.css:822-852 (button base, hover, :active top 1px, transition color 0.2s), 954-977 (cooldown-action/duration/reqs overlays, transition all 0.1s), 1004-1009 (nbsp padding pseudo-elements), src/game/systems/ui/UIOutElementsSystem.js:267-299 (progress/cooldown jQuery animate)
- desktop: Buttons are fixed-width (95pt default; 55px action-move; 110pt/180pt/80pt variants — layout lens), depress 1px on :active, recolor on hover, and show cooldown as animated absolute overlay bars inside the button.
- mobile risk: minor within this lens: hover recolor never shows on touch (fine); :active 1px offset works as tap feedback; cooldown overlay animation is JS-driven width so it works. Hotkey-hint badge (1020-1041) is revealed only via .container-btn-action:hover — hover-only and meaningless on touch; hide it on mobile.

### Hover-revealed callouts/tooltips (motion+interaction) [blocker]
- location: main.css:1042-1190 (btn-callout/info-callout show on :hover AND :focus, absolute, min-width 60pt max-width 100pt, arrow divs), 3066-3117 (#map-sector-tooltip fixed, pointer-events none, min 190px max 320px)
- desktop: Action buttons and info icons show tooltips on hover/focus; cursor:help on targets; map tooltip follows cursor.
- mobile risk: blocker (shared with interaction lens): :hover never fires reliably on touch; :focus does fire on tap for focusable elements which partially works, but info-callout-target divs are not focusable by default. Core information (action costs, risks, item stats) lives here. The redesign needs a tap-toggle or bottom-sheet pattern.

### Vision-disabled button hover reveal [blocker]
- location: main.css:983-989 (dark), 3700-3706 (sunlit)
- desktop: button.btn-disabled-vision is opacity 0.2 with fully transparent text; only on :hover does it become opacity 0.65 readable.
- mobile risk: blocker — on touch there is no way to read what these buttons are; they are pure hover-dependent. Needs a mobile alternative (e.g. dim but readable).

### ui-anim stat pulse + number roll animations [none]
- location: main.css:814-821 (.ui-anim scale 1.15 bold, .ui-anim-negative #e64646), src/utils/UIAnimations.js:7-9 (DEFAULT_ANIM_DURATION 600, LONG_ANIM_DURATION 1500) and animateNumber/animateIcon, src/game/systems/ui/UIOutLogSystem.js:136 (log entries fadeIn 600ms)
- desktop: Stat values scale-pulse and count up/down when they change; level icon pulses on level change; log messages fade in.
- mobile risk: none — em-based, works at any size; keep for parity.

### Popup fade motion [none]
- location: src/game/helpers/ui/UIPopupManager.js:175, 186; src/game/constants/UIConstants.js:36-42 (POPUP_OVERLAY_FADE_IN 50ms, FADE_OUT 50ms, POPUP_FADE_IN 100ms, POPUP_FADE_OUT 50ms, LAUNCH_FADEOUT 1000ms); overlay colors main.css:1279-1290 rgba(0,0,0,0.85) dark / 3996-4004 rgba(215,215,215,0.85) sunlit
- desktop: Popups fade in/out fast over a fixed full-screen 85%-opacity overlay; popups centered fixed top 50% left 50%, min-width 30% max-width 60% (fill-on-mobiles class exists in gridism.css:172-178).
- mobile risk: none for motion; popup sizing is layout lens.

### Movement/tab transition fades [none]
- location: src/game/UIFunctions.js:393-484 (transitionElementsOut/In, ui-transition-element toggling, slideToggleIf)
- desktop: Sector movement and tab changes fade groups of elements out/in with 40/20/40 duration split, mirroring the theme transition.
- mobile risk: none — duration-based, resolution independent.

### Custom scrollbars [minor]
- location: main.css:2988-3025 (dark), 5705-5742 (sunlit); css/modules/scrollbar.less
- desktop: 11px webkit scrollbars, themed track/thumb, thumb hover state; Firefox scrollbar-color. Used in .scrollable-container (max-height 100vh), #game-stats-container (70vh), infobox-scrollable (12em).
- mobile risk: minor — mobile browsers use overlay scrollbars and mostly ignore this; 11px custom scrollbars are hard to drag on touch but native momentum scroll still works. Ensure -webkit-overflow-scrolling behavior is acceptable.

### Item/resource icon sprites (fixed px) [major]
- location: img/items/* (16x16), img/res-*.png (12x12), img/stat-*.png (16x16), img/status-*.png; CSS: main.css:1833-1893 (.item 18px circle + 16px img; .res 12px img), 1715-1717 (.item-slot-big 55x70), 2376-2379 (#mobile-header img.stat-icon 1em)
- desktop: Inventory icons are 16px PNGs in 18px+padding circular chips; resources 12px; item slots fixed 55x70px with absolutely positioned 36px image offset (1771-1774).
- mobile risk: major — 1x raster icons at 12-16px look blurry on 3x mobile DPR and are visually tiny; chips (~36px incl. padding/border) are near the 44px touch minimum but .res at ~14px total is far below it when used as a callout target. Redesign should scale chips up; PNGs have no 2x variants.

### Indicator/badge icons (fixed px) [major]
- location: img/eldorado/icon-*.png (40x40 source); CSS main.css:1381-1412 (.change-indicator 1em), 1541-1573 (.bubble 16px !important, 12px bg icon, badge at top -6 right -6 on #switch tabs), 1918-1936 (item-comparison-badge 10px indicator at -11px offsets), 1962-1977 (npc-quest-indicator 10px), 2792-2801 (reqs-checkmark 1em)
- desktop: Trend arrows, tab notification bubbles, item comparison badges, NPC quest markers — all fixed 10-16px with negative-offset absolute positioning.
- mobile risk: major — 10px badges carry gameplay signals (better/worse item, quest available) and are borderline invisible on phones; negative offsets risk clipping in tighter mobile containers with overflow hidden.

### Level/camp/portrait images [minor]
- location: img/ui-level-*.png (100x100, -dark variants), img/ui-camp-*.png (128x128), img/characters/* (64x64, animal_bat 512x512); CSS main.css:2367-2371 (#level-icon 2.5em), 2025-2035 (npc portraits 32px)
- desktop: Level icon 40px in location header; NPC/character portraits 32px in 36-50px npc-container boxes.
- mobile risk: minor — em-sized level icon scales; 64px sources at 32px display are effectively 2x so acceptable on mobile DPR.

### Map canvas icons (themed) [blocker]
- location: img/map/map-*{,-sunlit}.png, src/utils/MapElements.js:14-40, src/utils/MapUtils.js:39-52; overlay cells main.css:3054-3065 (11px, :hover background)
- desktop: Canvas-drawn minimap/mainmap icons with sunlit variants; DOM overlay cells 11x11px with hover highlight and click select.
- mobile risk: blocker (shared with map lens): 11px touch targets and hover highlighting on the map are unusable on touch; within this lens note the -sunlit icon variants must keep working when theme swaps mid-redesign.

### Collapsible section headers with arrow sprites [none]
- location: main.css:1413-1439 (dark), 4130-4156 (sunlit); img/open-iconic/arrow-circle-{top,bottom}-2x{,-dark}.png
- desktop: Clickable header bars with background arrow icon right 8px center, hover background change, content display toggled.
- mobile risk: none — click-based, works on touch; padding 5px 30px 5px 10px gives a full-width tap row.

### Audio SFX system [minor]
- location: index.html:1006-1015 (8 audio elements), audio/ (footstep1/2.mp3, 3 BLEEOOP .wav clicks, MECHSwtch .wav, Modern10.ogg, Minimalist1.ogg apparently unreferenced), src/game/systems/ui/UIOutAudioSystem.js:38-103, settings checkbox index.html:936-938, src/game/constants/UIConstants.js:65-74 (soundTriggerIDs)
- desktop: Event-driven SFX: action start/complete, button click, footsteps on move, notification, popup open/close. Plays via new Audio(path) each trigger, 300ms repeat throttle, skipped when tab hidden, gated by settings.sfxEnabled (off by default until user enables). No volume slider, no music playback.
- mobile risk: minor — mobile browsers require a user gesture before audio; sounds triggered by timers/signals (e.g. action completed, notification) may be rejected on iOS until first tap (already .catch-guarded, fails silently). new Audio() per play adds latency on low-end devices. Note source type attributes are all 'audio/mpeg' even for .wav/.ogg — works but is technically wrong.

### Print styles [none]
- location: none (grep '@media print' across css/ and index.html: no matches)
- desktop: No print stylesheet exists anywhere.
- mobile risk: none — nothing to port; parity requires nothing.

### CSS breakpoints and JS layout threshold [major]
- location: css/gridism.css:98-134 (max-width 850px), 136-184 (max-width 568px: stack units, center/hide/fill-on-mobiles helpers, switch-tabs restyle), 187-203 (min-width 1180px), src/game/constants/UIConstants.js:29 (SMALL_LAYOUT_THRESHOLD 850 with comment to keep in sync with gridism), src/game/systems/ui/UIOutHeaderSystem.js:1120-1129 (toggles body.layout-small/.layout-regular)
- desktop: Existing partial responsiveness: under 850px JS switches to #mobile-header layout and CSS reflows log; under 568px grid units stack. 1180px+ widens wrap.
- mobile risk: major — the 850px CSS/JS thresholds are duplicated and must stay in sync; the redesign will likely add breakpoints, and both mechanisms (media queries + body classes) must agree or the header/log flip inconsistently on rotation.

### Dead theme-scoped selectors (layout-mobile, regular-layout) [minor]
- location: main.css:2667-2669, 2681-2683 (dark), 5384-5386, 5398-5400 (sunlit) use '.layout-mobile'; main.css:1668-1671, 4385-4388 use '.regular-layout'; no JS ever applies either class (grep of src/ finds none — only layout-small/layout-regular)
- desktop: Rules like 'body.dark .layout-mobile #resultlist-inventorymanagement .inventorybox { max-width: 90vw }' and '.regular-layout #common-popup .inventorybox ul { min-width: 380px }' never match because the classes are never set.
- mobile risk: minor but a trap: these look like existing mobile support and are dead. The 90vw inventorybox rule is exactly what mobile needs — wire it to layout-small or fix the class name during the redesign. The 380px min-width popup rule would overflow 390px screens if the class ever got applied.

### Selection/scroll base rules [minor]
- location: main.css:1-9 (html/body height 100%, body overflow-x hidden), 508-517 (.unselectable user-select none), 518-520 (.noninteractive pointer-events none), gridism.css:89-95 (.limit-height fixed log column, overflow-x overlay)
- desktop: Page hides horizontal overflow globally; log column fixed-height with proprietary 'overlay' overflow value.
- mobile risk: minor — overflow-x hidden on body masks layout overflow bugs instead of surfacing them (makes 390px regressions silent); 'overflow-x: overlay' is nonstandard and ignored by Firefox/Safari. user-select:none regions block long-press copy, acceptable for game chrome.

### Warning/negative color language [none]
- location: main.css:1897-1917 (warning text #e64646, warning progress bars, li-item-negative border #E13232), 819-821 (.ui-anim-negative), 1739-1742 (.item-broken red gradient), sunlit mirrors 4614-4634
- desktop: Single red family signals danger, broken items, losses; identical in both themes.
- mobile risk: none — carries over; check #e64646 on #202220 (~4.6:1) stays legible at the reduced sizes chosen for mobile.

### Stat indicator micro-bars [minor]
- location: main.css:1339-1380 (stat-indicator, .progress 35px wide 0.5em tall inline bars, stat-indicator-with-fill 13em with 50% gradient fill), 2393-2395 (#mobile-header variant max-width 5em)
- desktop: Header stats render as label + value + 35px inline progress sliver; fill-style indicators use a background linear-gradient trick.
- mobile risk: minor within this lens — 0.5em (8px) tall bars with 0.75rem change arrows are readable but very fine; consider thickening for the mobile HUD.

### Theme-transition-sensitive inline JS styling [minor]
- location: src/game/systems/ui/UIOutHeaderSystem.js:283-301 (dynamic background items refuse to init while sunlit active), 1292-1301 (jQuery animates background-color per vision level, dark theme only)
- desktop: Certain boxes get JS-animated background colors tied to vision level in dark theme; cleared in sunlit.
- mobile risk: minor — inline styles will override any new mobile CSS backgrounds for these elements; coordinate with redesign stylesheet specificity.

**Notes:** Cross-cutting observations for the mobile redesign, typography/theming/motion lens. (1) main.css is COMPILED from css/main.less + css/modules/*.less + css/themes/*.less ('// out: main.css' directive, lessc-style); every themed rule exists twice (body.dark / body.sunlit prefix). Make mobile changes in the .less sources and recompile, or accept hand-editing ~5900 duplicated lines; parity claims must cover BOTH themes. (2) A third palette copy lives in JS (src/game/constants/ColorConstants.js) for canvas maps, techtree, camp vis, and the inline body background — color changes need three-way sync. (3) The theme is gameplay-driven (sector sunlit flag), not a user preference; there is no prefers-color-scheme and no prefers-reduced-motion support anywhere. (4) Motion inventory: global 1s opacity transition on nearly all elements (vision system), transition all 0.15s on img/td/th, 1200ms theme crossfade via #theme-transition-overlay, 1.3s loading-dot bounce, 1.3s event-end opacity blink, 600/1500ms number and icon animations (UIAnimations), 600ms log fadeIn, 50-100ms popup fades, 0.1s cooldown bar transitions, jQuery slide/fade for tab and movement transitions. The universal transition + grayscale filters are the main mobile GPU risk. (5) Type scale is exactly three tiers: 1em default, 0.85rem small, 0.75rem tiny (main.less:10-12); the two lower tiers carry real gameplay information and need to be raised for 390px screens — changing the two LESS variables uplifts everything consistently. (6) All icons are 1x PNGs (12/16/40px sources) with -dark/-sunlit theme pairs, swapped either by CSS background-image or the img-themed JS mechanism; no SVG, no 2x assets — expect blur at 3x DPR. (7) Audio is SFX-only, off by default, gesture-gated on iOS; parity is easy but keep the settings checkbox reachable on mobile. (8) No print styles exist. (9) Meta viewport already correct and zoom-friendly; the real mobile gates are #mobile-overlay (UA-sniffed blocking wall), hover-only callouts/hotkey hints/vision-disabled buttons, and the duplicated 850px breakpoint constant (gridism.css vs UIConstants.SMALL_LAYOUT_THRESHOLD). (10) Trap: '.layout-mobile' and '.regular-layout' CSS selectors are dead code — JS only ever sets 'layout-small'/'layout-regular'.

## LENS: interaction

### Mobile-UA blocking overlay (#mobile-overlay) [blocker]
- location: index.html:982-985, css/main.css:2901-2913 (dark) / 5xxx sunlit twin, src/level13-app.js:16-19, src/game/level13.js:165,185-205,263-275, src/game/helpers/ui/ChangeLogHelper.js:31-33
- desktop: Hidden on desktop. On mobile user agents (regex Android|webOS|iPhone|iPad|iPod|BlackBerry) a fixed full-screen z-index:20 panel covers the page with 'Level 13 isn't optimized for mobile' text and a dismiss link (#btn-dismiss-mobile-overlay). Game setup is suspended in a 500ms polling loop (waitForMobileOverlay) until dismissed; setGameOverlay toggles the loading spinner off while shown.
- mobile risk: This is THE gate: every phone user sees the wall and the game does not even initialize until the link is tapped. The mobile redesign must remove or invert GameConstants.isMobileOverlayShown, or all other work is invisible. Also note ChangeLogHelper suppresses version warnings while the overlay is up.

### Sticky footer bar (#footer, .sticky-footer) [major]
- location: index.html:760-777, css/main.css:13-19 (#footer padding-left:95px), css/main.css:80-93 (.sticky-footer height 55px, push/wrapper), css/main.css:2417-2450 (flex layout, game-options tables), css/gridism.css:102-108
- desktop: 55px-tall sticky footer at page bottom. #footer is display:flex with a permanent 95px left padding (to clear the fixed 75px #header-side sidebar). Contains #game-version, #game-msg (flex-grow), and two right-floated display:table ULs of text buttons.
- mobile risk: 95px left padding is applied unconditionally (selector '.layout-regular #unit-main, #footer' plus body.dark #footer padding 1px 5px 1px 95px), wasting ~25% of a 390px screen even though the sidebar it clears is hidden in small layout. Fixed 55px height cannot fit the extended options row when 'more' is expanded, so buttons clip or overflow. .layout-small only shrinks font to 0.85rem.

### Footer meta buttons (more/restart/save + extended settings/info/stats/data) [major]
- location: index.html:764-775, src/game/UIFunctions.js:91-127 (click wiring), src/game/UIFunctions.js:1759-1763 (showGameOptions), css/main.css:918-935 (btn-meta), css/main.css:2424-2438
- desktop: #game-options always shows lowercase borderless text buttons 'more | restart | save'; clicking 'more' toggles #game-options-extended (settings, info, stats, data + ':' separator li) inline to the left. btn-meta styling: background none, border 0, padding 0 3px, hover underline. All buttons play a click sound; btn-stats has no sound trigger.
- mobile risk: Touch targets are text-only, roughly 20px tall with 3px horizontal padding — far below the 44px touch minimum, and the only pressed-state affordance is :hover underline which does not exist on touch. Seven buttons plus version/msg in one 55px row cannot fit at 390px.

### #game-version and #game-msg footer indicators [minor]
- location: index.html:762-763, src/game/systems/ui/UIOutHeaderSystem.js:89-90,376,1051-1067, css/main.css:2439-2446, css/gridism.css:106-108
- desktop: Version text 'v. 0.6.3 (alpha)' set from changelog.json; #game-msg (flex-grow:1) shows transient lowercase status text: save errors, 'game saved', 'game paused', or GameConstants.systemMessage. Gridism ≤850px forces left:10px !important (legacy absolute-positioning rule, now inert under flex).
- mobile risk: Long messages compete with 5-7 buttons in the fixed 55px flex row; text truncates/wraps badly at 390px. Needs a dedicated slot (e.g. toast) in the redesign. Content itself is fine.

### Loading screen spinner (.loading-content) [none]
- location: index.html:995-1002, css/main.css:2914-2953 (+ sunlit twin ~5600s), keyframes css/main.css:2955-2976, toggled src/game/UIFunctions.js:671-675 (setGameOverlay), src/game/UIFunctions.js:677-682
- desktop: Fixed full-screen overlay (z-index 20, translucent dark background) with three 11px bouncing dots centered via top:50%; shown while game hidden/loading; #unit-main starts display:none inline (index.html:33).
- mobile risk: none — fully fluid; works at any width.

### Thinking spinner (.thinking-content) [none]
- location: index.html:987-993, css/main.css:2914-2953, src/game/UIFunctions.js:647-655
- desktop: Identical full-screen dot spinner shown for 'thinking' states (hideGame with showThinking) while game elements stay visible underneath.
- mobile risk: none.

### Theme transition overlay (#theme-transition-overlay) [none]
- location: index.html:1004, css/main.css:2977-2987
- desktop: Fixed full-screen grey overlay, opacity 0 by default, used to fade between dark/sunlit themes.
- mobile risk: none.

### Error / bug-report popup (exception handler) [minor]
- location: src/game/level13.js:373-411, rendered in #common-popup index.html:970-976, src/game/UIFunctions.js:1708-1723 (showQuestionPopup), popup base css/main.css:1258-1290, css/gridism.css:172-178 (.fill-on-mobiles ≤568px)
- desktop: On JS exception: pauses game, hides UI, opens a modal question popup 'Error' with HTML text containing an <a target=_blank> link to a prefilled GitHub new-issue URL (title, seed, position, 1000-char stacktrace) and buttons 'reload' (location.reload) and 'clear data' (restart confirmation). Related: showSaveWarning and showVersionWarning question popups in src/game/systems/GameManager.js:500-553, the latter embedding a changelog.html link.
- mobile risk: Popup itself goes full-width ≤568px via fill-on-mobiles, so it fits; the report link is small inline text (hard to tap) and opens GitHub's desktop issue form. Buttons are standard and fine. Low risk but must be kept in parity.

### GlitchTip/Sentry error tracking script [minor]
- location: index.html:1026 (sync CDN script), src/level13-app.js:26-38 (Sentry.init, dsn, 1% traces)
- desktop: Synchronous external script from browser.sentry-cdn.com loaded before RequireJS; init wrapped in try/catch so ad blockers fail soft.
- mobile risk: Render-blocking on slow cellular connections (no async/defer). Functional risk none. External absolute URL, unaffected by subpath.

### Manage saves popup (save list + slots + options column) [major]
- location: index.html:882-924, src/game/systems/ui/UIOutManageSaveSystem.js:1-120 (wiring) and 120-260 (containers), css/main.css:2802-2867, opened via src/game/UIFunctions.js:104-107,1616-1619
- desktop: Modal 42em wide (max-width 90% !important). Two-column flex: #save-list (flex .65, stacked .li-save-slot buttons with header/date/info) and #save-list-options (flex .35) that swaps between empty hint, Save/Load/Export buttons, and an export panel. 'Back to list' / 'Import' / 'Close' buttonbox at bottom.
- mobile risk: At 390px the popup is ~350px; the 35% options column is ~120px, so Save/Load/Export buttons and slot metadata (date floated right) get cramped and wrap. fill-on-mobiles fights the id-selector max-width:90% (id wins), leaving unusable margins. Needs single-column re-flow.

### Save export textarea + Copy/Download, import textarea + Paste/Load [major]
- location: index.html:899-917 (textarea-export-save rows=5; textarea-import-save rows=5 cols=60), src/game/systems/ui/UIOutManageSaveSystem.js:50-68 (paste/copy), 350-352 (navigator.clipboard.readText), 397-399 (FileUtils.saveTextToFile download), css/main.css:2806-2810
- desktop: Export shows compressed save string in a small textarea with Copy (clipboard.writeText), Download (Blob file), Back. Import view shows a cols=60 textarea with Paste (clipboard.readText) and Load buttons plus #import-save-msg feedback.
- mobile risk: cols=60 gives the import textarea an intrinsic width (~500px) wider than a 390px viewport with no width:100% CSS rule — horizontal overflow inside the popup. clipboard.readText is unsupported on Firefox and permission-gated on iOS (Paste button may silently no-op; long-press paste in the field still works). Download via Blob works but lands in iOS Files app.

### Settings popup (checkboxes, hotkey list, language select) [major]
- location: index.html:934-952, src/game/systems/ui/UIOutMetaPopupsSystem.js:30-44,96-123,126-131,147, css/main.css:2890-2900 (.settings-entry, .hotkey-list-item), css/main.css:2163-2178 (1em checkboxes), css/main.css:1534-1540 (.scrollable-container max-height:100vh)
- desktop: Modal with three checkbox rows (Enable sounds; Enable hotkeys; Use Numpad — dimmed/disabled when hotkeys off), a #hotkeys-list of ~20 flex rows (label min-width 35% + key combo) rebuilt from registered hotkeys, a hidden #language-selection native <select> (hidden-by-default), and a Close button. NO volume sliders exist anywhere — sound is a single on/off checkbox (input[type=range] styles at css/main.css:2083-2117 serve only the outgoing-caravan trade slider).
- mobile risk: Checkboxes are 1em (~16px) touch targets. #hotkeys-list max-height is 100vh, so the popup grows taller than the screen and the base .popup has no internal scroll — content below the fold is unreachable since repositionPopup only clamps top to 0. Hotkeys and numpad settings are meaningless on touch; redesign should hide or replace them but keep parity toggles.

### Game stats popup [minor]
- location: index.html:926-932, src/game/UIFunctions.js:108-114,704-785 (updateGameStatsPopup), 1621-1626, css/main.css:2869-2888
- desktop: Modal with a generated two-column stats table inside #game-stats-container (scrollable, max-height 70vh), category headers uppercase, highscore entries in parentheses; Close button.
- mobile risk: 70vh scroll container behaves; long stat names + values + '(entry)' third span can wrap awkwardly at ~350px but nothing breaks. Table cells left-aligned, no fixed widths.

### Game info popup (version, feedback, faq/changelog links) [minor]
- location: src/game/UIFunctions.js:124-127,787-794 (getGameInfoDiv), src/game/constants/GameConstants.js:35-46 (getFeedbackLinksHTML), rendered via #common-popup index.html:970-976
- desktop: Info popup showing version + updated date from changelog.json, disclaimer text, feedback links (github | reddit | discord | email with obfuscated address), and 'faq | changelog' links opening faq.html/changelog.html in named tabs.
- mobile risk: Inline pipe-separated links are small tap targets; opening subpages in new tabs is acceptable on mobile. Content fits fill-on-mobiles popup.

### faq.html page (nav row + 19 collapsible Q&A items) [minor]
- location: faq.html:19-160 (body), faq.html:25-27 (nav links), faq.html:32-155 (collapsible-container blocks), faq.html:144 (inline map icon img), src/utils/MetaUIUtils.js:9-40 (click/slideToggle logic, loaded via src/config-meta.js), css/main.css:1413-1438 (collapsible styles), css/main.css:2199-2205 (.sub-page-container, .faq-category h3), css/main.css:1608-1611 (.textbox max-width 70em)
- desktop: Static dark page: h1, 'Game | FAQ | Changelog' link row, two .textbox.faq-category sections of collapsible headers (uppercase h3, 5px 30px 5px 10px padding, arrow icon background-position right 8px, hover background #444) that slideToggle 300ms; 'Back to top' anchor. Has its own viewport meta and relative CSS/JS paths; GoatCounter async script.
- mobile risk: Layout is fluid and already usable at 390px. Risks: collapsible headers are ~30px tall tap targets with hover-only feedback; theme is hardcoded 'dark' body class with no sunlit parity; html tag lacks lang attribute; answers with external links (GitHub/Reddit/Discord) have small inline link targets.

### changelog.html page + changelog.js renderer [minor]
- location: changelog.html:19-48, changelog.html:45-47 (jQuery + src/changelog.js includes), src/changelog.js:4-34, changelog.json (repo root, 19KB), css/main.css:2489-2520 (#changelog and .changelog-type styles)
- desktop: Static dark page fetching changelog.json via relative $.getJSON and rendering one <div class='changelog-version'> per version with bold header and <ul> of <li class='changelog-{type}'> summaries into #changelog-container. Bug: 'var html' is re-declared at changelog.js:10, discarding the h4 header and the <div id='changelog' class='infobox infobox-scrollable'> wrapper opened at lines 7-8, so #changelog CSS (font 0.85rem, custom bullets, max-height scroll) never applies and a stray closing </div> is emitted; entries render as plain unstyled lists.
- mobile risk: Plain text list reflows fine at 390px; page is just very long. The lost wrapper bug means styling parity is already broken on desktop — decide whether redesign reproduces the de facto plain rendering or fixes the wrapper. Same hardcoded dark theme / missing lang attribute as faq.html.

### tools.html orphan page [minor]
- location: tools.html:1-60 (head + 'There is currently nothing here'), tools.html tail (config-tools RequireJS entry), src/config-tools.js
- desktop: Unlinked utility page (nothing in the game, faq, or changelog links to it) with same nav row; all real content (save-fix tools with paired textareas and Fix buttons) is commented out; loads src/config-tools.js.
- mobile risk: none functionally (fluid text page), but it exists — 100% parity claim must include it. Same head/meta gaps as other subpages.

### In-game links to subpages (version warning popups) [minor]
- location: src/game/systems/GameManager.js:527-553 (showVersionWarning changelog link), src/game/helpers/ui/ChangeLogHelper.js:37-47 (unsupported-version popup linking GameConstants.gameURL), src/game/constants/GameConstants.js:33
- desktop: Save-version mismatch popup embeds <a href='changelog.html' target='changelog'>; unsupported-version popup links to hardcoded absolute https://nroutasuo.github.io/level13.
- mobile risk: changelog.html link is relative — fine under /level13-mobile/. gameURL is absolute to the UPSTREAM site: on the fork this popup would bounce mobile players to the desktop deployment. Fires whenever the newest changelog.json version is not marked final. Should be repointed for the fork.

### index.html head: title, meta, og tags, viewport [minor]
- location: index.html:1-27 (lang='en' at line 2, charset 14, title 15, description/og 16, og:image 17, og:title 18, viewport 19)
- desktop: Title 'Level 13'; single combined itemprop/name/property description meta; og:image and image_src point to 'favicon.png'; viewport is width=device-width,initial-scale=1 (already mobile-correct, no user-scalable lock).
- mobile risk: favicon.png DOES NOT EXIST in the repo (only favicon.ico, favicon-16x16.png, favicon-32x32.png) → broken social-share image, and og:image is relative which most scrapers ignore anyway. Missing for a mobile deployment: theme-color, color-scheme, og:url/og:type, twitter:card, apple-mobile-web-app-capable. Viewport itself is fine.

### Favicon / app icons [minor]
- location: index.html:20,25-26; faq.html:10,15-16; changelog.html:10,15-16; tools.html:10,15-16; files favicon.ico, favicon-16x16.png, favicon-32x32.png at repo root
- desktop: shortcut icon .ico plus 16px and 32px PNG links; referenced with relative hrefs (subpath-safe).
- mobile risk: No apple-touch-icon (iOS add-to-home-screen gets a page screenshot), no web app manifest, no 180/192/512px icons, no maskable icon — a 'mobile' deployment should add these. Existing tags work under /level13-mobile/.

### System messages (messages.json → popup + footer) [none]
- location: messages.json (repo root), src/game/systems/ui/UIOutMetaPopupsSystem.js:47-90 (relative $.getJSON, showUnseenMetaMessages → showInfoPopup 'System Message'), src/game/systems/ui/UIOutHeaderSystem.js:1061-1062 (GameConstants.systemMessage in #game-msg)
- desktop: Fetches messages.json relatively; unseen messages matching conditions (campOrdinalReached, expiry) show once as a standard info popup; a GameConstants.systemMessage constant can also surface in the footer #game-msg.
- mobile risk: none — standard popup, relative fetch works under subpath.

### GoatCounter analytics snippet [none]
- location: index.html:1017-1023, faq.html:162-168, changelog.html:36-42, tools.html tail; inline window.goatcounter path config + async protocol-relative //gc.zgo.at/count.js
- desktop: Async visitor counter on every page; path built from location.hostname+pathname so subpath deployments report distinct paths automatically.
- mobile risk: none (async, external, subpath-safe). Counts will attribute to the fork's hostname — acceptable.

### Popup framework base (positioning, fill-on-mobiles) as it affects secondary popups [major]
- location: css/main.css:1258-1290 (div.popup fixed, min-width 30%, max-width 60%, padding 20px; #popup-overlay full-screen rgba .85), css/gridism.css:136-183 (≤568px .fill-on-mobiles width/max-width 100% !important), css/gridism.css:187-202 (≥1180px 40%/70%), src/game/helpers/ui/UIPopupManager.js:252-268 (repositionPopup centers via JS, padding 0 when width ≤850)
- desktop: All secondary popups (settings, manage-save, stats, common/error, dialogue) share fixed centered positioning computed in JS on open/resize; every popup in index.html carries fill-on-mobiles.
- mobile risk: Width is handled (100% ≤568px) but HEIGHT is not: no max-height/overflow on .popup, so any popup taller than the viewport (settings with hotkey list, manage-save with import open, long error text) clips below the fold with no scrolling. repositionPopup only clamps top≥0. This is the shared defect behind several popup risks above.

### Asset path relativity audit (subpath /level13-mobile/ serving) [none]
- location: index.html:20-26,1006-1015,1029; faq.html:10-16,171; changelog.html:10-16,45-47; tools.html head/tail; css/main.css (all url('../img/...') e.g. 1424, 2793); src/config.js (baseUrl 'src', urlArgs v=0.6.3); src/changelog.js:4; src/game/helpers/ui/ChangeLogHelper.js:14; src/game/systems/ui/UIOutMetaPopupsSystem.js:49; src/game/constants/UIConstants.js:34+ ('img/...' strings)
- desktop: Every stylesheet, favicon, RequireJS module, JSON fetch ($.getJSON 'changelog.json'/'messages.json'), audio <source src='audio/...'>, CSS background url('../img/...'), and runtime JS image string ('img/...') is document- or css-relative. Only absolute URLs are external services (GoatCounter, Sentry CDN, GitHub/Reddit/Discord links) and GameConstants.gameURL.
- mobile risk: none — the site works unmodified from a /level13-mobile/ project subpath. Only GameConstants.gameURL (see version-warning element) points at the upstream origin.

**Notes:** Cross-cutting observations for the redesign: (1) main.css contains ZERO @media queries — every rule is duplicated under body.dark (lines ~700-3000) and body.sunlit (~3400-5900) because it is compiled from less with two theme blocks; any mobile change must be made twice or added as a new theme-independent layer. All existing responsiveness lives in gridism.css (three breakpoints: ≤850px, ≤568px, ≥1180px) plus JS-driven body classes layout-small/layout-regular toggled at window width ≤850 (UIOutHeaderSystem.js:1122-1124, UIConstants.SMALL_LAYOUT_THRESHOLD=850) — the comment says it must stay in sync with gridism. (2) A dormant mobile header already exists (#mobile-header, index.html:36-107, shown in layout-small) — the 'mobile redesign' has scaffolding to build on. (3) The mobile UA overlay + waitForMobileOverlay polling is the single hard gate to remove. (4) Shared popup framework lacks any height/overflow handling — fixing .popup max-height + internal scroll resolves risks in settings, manage-save, stats, and error popups at once. (5) Secondary pages (faq/changelog/tools) are hardcoded to the dark theme and lack lang attributes but are otherwise already fluid; changelog.js has a pre-existing bug (re-declared var html, changelog.js:7-10) that discards its styled wrapper — decide fix vs. bug-for-bug parity. (6) og:image references a nonexistent favicon.png on all four pages; no apple-touch-icon or manifest exists anywhere. (7) There are no volume sliders — audio settings are a single checkbox; the only input[type=range] in the codebase is the outgoing-caravan trade slider (other lens). (8) All asset references are relative; subpath deployment needs no path rewrites, only GameConstants.gameURL points at the upstream origin.

## LENS: theme

### Modal blocker layer (#popup-overlay) [minor]
- location: index.html:785, css/modules/elements-common.less:278-290 (compiled: css/main.css:1279,3996), src/game/helpers/ui/UIPopupManager.js:18,23-27,165-187
- desktop: Single fixed full-screen div (top/left 0, 100% x 100%, z-index 15) that is the PARENT of all popup dialogs. Semi-transparent themed background. Faded in/out by jQuery fadeIn/fadeOut (50ms, UIConstants.js:39-42) with a showOverlayCounter so stacked popups share one blocker. Clicking the overlay itself (e.target == e.currentTarget) calls dismissPopups(), which synthesizes a click on the popup's .button-popup-default. A .popup-overlay-meta class (z-index 25) exists in CSS but is never applied by any JS - dead rule.
- mobile risk: Touch tap-outside works, but at <=568px popups are full-width (fill-on-mobiles) and tall popups cover the whole screen, so there is often zero visible overlay to tap. Dismissal then depends on the footer button or the Escape hotkey, which does not exist on touch.

### Generic popup shell (div.popup) sizing and centering [blocker]
- location: css/modules/elements-common.less:256-276, css/gridism.css:172-182,200-201, src/game/helpers/ui/UIPopupManager.js:252-268,329-335, src/game/constants/UIConstants.js:29,39-42
- desktop: position:fixed; padding 20px; min-width 30%; max-width 60% (40% at >=1180px via gridism.css:200). CSS top/left:50% is immediately overridden by JS repositionPopup(): computes pixel top/left = (windowSize - popupSize)/2, with 20px padding (0 when width <= SMALL_LAYOUT_THRESHOLD 850). Recentered only on windowResizedSignal and popupResizedSignal. At <=568px .fill-on-mobiles forces width/max-width 100%, margin/padding-left/right 0. There is NO max-height and NO overflow-y on .popup.
- mobile risk: Blocker: any popup taller than the viewport (reward lists, dialogue with rewards, long story text, fight results) overflows off-screen with no internal scroll; body scroll is locked (overflow hidden) while a popup is open, so the bottom buttons can be unreachable on 390x844. Also px-based JS centering fights the software keyboard and orientation changes; between 569-850px the JS 'small layout' (padding 0) disagrees with the CSS 568px breakpoint so popups are still max-width 60% on a 700px screen.

### Common popup (#common-popup) - shared container for info/result/confirmation/question/action popups [major]
- location: index.html:970-976, src/game/helpers/ui/UIPopupManager.js:35-163, src/game/UIFunctions.js:1660-1723
- desktop: One reusable dialog: h3 title, HTML message (#common-popup-desc), optional input row, #info-results reward div, and a .buttonbox rebuilt per popup with dynamically appended buttons: #info-ok / #confirmation-takeall ('Take all') / #info-action (action-cost button) / #confirmation-cancel (UIPopupManager.js:82-130). Default button gets .button-popup-default and keyboard focus. Toggles .popup-meta (z26) vs .popup-ingame (z16). Message HTML can contain links (bug-report, changelog).
- mobile risk: Inherits all shell risks (no scroll, min-width 30% makes narrow popups at 569-850px). Reward divs with inventory management can be very tall (see reward div row). Autofocus of default button can trigger scroll/keyboard oddities. Dead CSS: .regular-layout #common-popup .inventorybox ul { min-width:380px } (elements-common.less:765) never matches - body class is 'layout-regular', not 'regular-layout'.

### Text-input popup mode (common popup + input) [major]
- location: index.html:973, src/game/UIFunctions.js:1725-1757, callers: src/game/PlayerActionFunctions.js:2784 (Graffiti), src/game/systems/HopeSystem.js:103
- desktop: showInput() reveals #common-popup-input-container with a single text input (autofocus, maxlength 40), validates on Confirm, optional Cancel. Input styled only by generic input rules (elements-input.less:5-9), no explicit font-size.
- mobile risk: Software keyboard covers the vertically centered popup; the popup only recenters on a window resize signal, which is unreliable across mobile browsers (visualViewport not used). If effective input font-size is under 16px, iOS Safari auto-zooms the page. Autofocus pops the keyboard immediately on open.

### Fight popup (#fight-popup) [major]
- location: index.html:787-845, css/modules/elements-special.less:665-700, css/modules/elements-common.less:483-520, src/game/systems/ui/UIOutFightSystem.js:104-145,252,302-330
- desktop: min-width 35%; enemy infobox and player infobox each with .container-relative name row; floating damage (-5) and status ('dodge') indicators absolutely positioned at right:-3em and right:-5em OUTSIDE the name container with opacity transitions; two flex .progress-multibar-container HP+shield bars (.progress max-width 300px, bar segment widths set in % by JS); item/explorer icon lists (#fight-popup-items) separated by a '|' span; #fight-buttons-infightactions (dynamic in-fight item actions) plus 6 state-toggled buttons: Flee / Fight / Leave / Continue / Continue(take selected) / Take all; #fight-popup-results holds post-fight reward div.
- mobile risk: On a full-width 390px popup the -3em/-5em absolutely positioned indicators can extend past the popup edge (clipped or causing horizontal overflow). Post-fight results (rewards + Take all flow) make the popup tall with no scroll. Item icons are ~30px hover-callout targets. Fight is real-time - accidental mis-taps on Flee/Fight matter.

### Incoming caravan trade popup (#incoming-caravan-popup) [blocker]
- location: index.html:847-880 (inline widths at 850-868), css/gridism.css:180-182,202, css/modules/elements-common.less:704-782, css/modules/elements-special.less:484-488, src/game/systems/ui/UIOutPopupTradeSystem.js:47-56,230-280
- desktop: .popup-wide (max-width 70% at >=1180px). Body is an inline style='display:flex' .inventorybox with FOUR fixed-inline-width columns: Camp inventory 170px, Camp offer 130px, Trader offer 130px, Trader inventory 170px (= 600px + gaps). Columns are .inventorydivision (display:table-cell, width 49%, absolutely positioned headers/footers with value totals). Items are ~30px li slots moved between columns by click (and an already-registered long-tap, UIOutPopupTradeSystem.js:270-272); item details come from hover callouts. Trade multiplier row (flex-end), then Cancel / Reset / Trade buttons.
- mobile risk: Blocker: 600px of fixed-width flex columns cannot fit 390px; content overflows the popup horizontally with no scroll container. Item identification relies on hover callouts (broken on touch). Four side-by-side columns are unusable at phone width - needs stacked or paged layout. gridism's <=568px rule (.popup .inventorybox ul { width:100% !important }) does not fix the fixed-width parents.

### Manage saves popup (#manage-save-popup) [major]
- location: index.html:882-924, css/modules/elements-special.less:728-811, src/game/systems/ui/UIOutManageSaveSystem.js:33-128,161-206,337,370,425
- desktop: width 42em, max-width 90% !important (the ID selector beats .fill-on-mobiles' 100%, so it stays 90% wide, never full-bleed). Three exclusive views toggled by JS: (1) save list - flex #save-list-container with #save-list (flex 0.65, stacked .li-save-slot buttons with floated dates) beside #save-list-options (flex 0.35) holding Info text + Save/Load/Export buttons or the Export sub-panel (5-row textarea, Copy/Download/Back); (2) import view - #save-import-container with textarea rows=5 cols=60 plus Paste/Load; (3) footer buttons Import / Back to list / Close (.button-popup-default). Confirmations for overwrite/load nest via common popup queue.
- mobile risk: At 390px the 35% options column is ~123px - Info text, three stacked buttons, and the export textarea are crammed or overflow; cols=60 gives the import textarea an intrinsic width over 400px, causing horizontal overflow. Two-column flex needs stacking. Clipboard Copy/Paste buttons behave inconsistently on mobile browsers.

### Game stats popup (#game-stats-popup) [minor]
- location: index.html:926-932, css/modules/elements-special.less:813-840, css/modules/elements-common.less:594-600, src/game/UIFunctions.js:109-114,704-760,1621-1626
- desktop: h3 + #game-stats-container (.scrollable-container: overflow-y scroll, boxed; max-height 70vh from elements-special.less:816 overriding the class's 100vh) + Close button. Content is a JS-generated full-width table of name/value rows with category header rows; opened as meta+dismissable from the footer stats button.
- mobile risk: The only popup with proper internal scrolling, so mostly OK. Risks: 70vh content + title + button can still exceed a short landscape viewport (shell has no max-height); long stat names + values may wrap awkwardly at 390px; overflow-y:scroll shows permanent scrollbar gutter on some mobile browsers.

### Settings popup (#settings-popup) [minor]
- location: index.html:934-952, css/modules/elements-special.less:842-856, css/modules/elements-input.less:112-129, src/game/UIFunctions.js:116-123
- desktop: Three .settings-entry checkbox rows (sounds, hotkeys, numpad movement) with 1em (~13-16px) custom checkboxes; #hotkeys-list scrollable-container of flex .hotkey-list-item rows (label min-width 35%); hidden #language-selection dropdown; Close button. Opened meta+dismissable from footer.
- mobile risk: 1em checkboxes are far below the ~44px touch-target minimum (labels are not wired as click targets). The hotkeys list is meaningless on touch and wastes vertical space. Otherwise short enough to fit 390x844.

### Dialogue popup (#dialogue-popup) [minor]
- location: index.html:954-968, src/game/systems/ui/UIOutDialogueSystem.js:62-94,166-190
- desktop: Modules: title h3, character info, dialogue paragraph, meta line (.p-meta), results div (can hold reward/inventory div), plus a dynamically built .buttonbox of dialogue-option action buttons. The .dialogue-module class has NO CSS anywhere - layout is purely the generic .popup defaults (centered text, 60% max-width). Callouts generated inside (UIOutDialogueSystem.js:94).
- mobile risk: Long dialogue + results + several option buttons can exceed viewport height (no scroll, shell risk). Between 569-850px the 60% max-width squeezes text into a tall column. Hover callouts in results broken on touch. Otherwise adapts via fill-on-mobiles.

### Reward / inventory-management div inside popups (#info-results, #fight-popup-results) [major]
- location: src/game/helpers/ui/UIPopupManager.js:72-79,97-104, css/modules/elements-special.less:555-586, css/modules/elements-common.less:702-782, css/gridism.css:180-182
- desktop: PlayerActionResultsHelper.getRewardDiv injects found/lost item lists and an inventory-management two-box UI (bag vs found) with ~30px item slots, selection via click, totals, and 'Take all'. Sizing: .layout-regular #resultlist-inventorymanagement .inventorybox max-width 25vw; a .layout-mobile variant (max-width 90vw, elements-special.less:570) is DEAD - JS only ever sets body classes layout-small/layout-regular (UIOutHeaderSystem.js:1123-1124), never layout-mobile.
- mobile risk: Tall reward lists are the main driver of popup overflow (no scroll). Item slots ~30px are small touch targets and their stat details are hover-callout only. The dead .layout-mobile/.regular-layout rules mean nobody constrains these boxes on small screens - must be re-based on layout-small or media queries in the redesign.

### Popup close affordances (Escape hotkey, overlay click, default button) [major]
- location: src/game/UIFunctions.js:208, src/game/helpers/ui/UIPopupManager.js:23-27,189-192,290-310, index.html:922,930,950 (Close buttons)
- desktop: No popup has an X/close icon. Closing = footer button, Escape hotkey (registered as universal), or overlay-outside click when data-dismissable=true (which synthesizes a .button-popup-default click). Dismissability is per-popup: derived in showPopup (no result + no cancel => dismissable) or passed to showSpecialPopup (manage-save/stats/settings dismissable; fight & caravan NOT dismissable).
- mobile risk: Escape does not exist on touch keyboards, and full-width/full-height popups leave no overlay to tap, so the only close path is a small footer button that may be pushed below the fold by tall content (unreachable due to scroll lock). Redesign needs an always-visible close affordance.

### Popup pause/inert machinery (scroll lock + hidden-by-popups) [major]
- location: src/game/helpers/ui/UIPopupManager.js:194-206, index.html:32,199,217,742,760 (.hidden-by-popups)
- desktop: While any popup is open: game is paused, body overflow set to 'hidden' (scroll lock), and all .hidden-by-popups regions (main grid, tab bar, tab content, log, footer) get aria-hidden + inert.
- mobile risk: body{overflow:hidden} is unreliable on iOS Safari (touchmove can still rubber-band the page behind the popup); combined with no internal popup scrolling this is the mechanism that traps content off-screen. The redesign must move scrolling INTO the popup.

### Popup queue + hidden-queue behavior [none]
- location: src/game/helpers/ui/UIPopupManager.js:7-16,47-57,221-250,270-279,312-319
- desktop: Second showPopup while one is open queues it (LIFO via pop()); popups requested while UI is hidden go to hiddenQueue and auto-resolve their callbacks on closeHidden. closePopup skips the fade animation when the queue is non-empty.
- mobile risk: none - pure logic, works identically on mobile; must simply be preserved for parity.

### Special popup opener (showSpecialPopup) and show/hide animation path [none]
- location: src/game/UIFunctions.js:1607-1658, src/game/helpers/ui/UIPopupManager.js:140-163,221-250
- desktop: Fight, incoming-caravan, manage-save, game-stats, settings, and dialogue popups are pre-baked DOM shown via fadeIn(100ms) + repositionPopup, with setupCallback, optional default-button focus, and popupOpened/Shown/Closing/Closed signals. Common popup uses slideToggleIf instead. Sounds fired on open/close (index.html:1013-1014).
- mobile risk: none functionally, but every popup type funnels through repositionPopup's pixel centering, so fixing centering/scrolling in one place fixes all seven dialogs.

### Common-popup content catalog (all showPopup call sites) [minor]
- location: src/game/helpers/ui/ChangeLogHelper.js:41 (unsupported-version warning); src/game/UIFunctions.js:126 (About/game info); src/game/PlayerActionFunctions.js:1344,1389,2698-2758,2927 (story/level info), 1509 (action results), 1532 (Manage inventory), 2953 (Milestone), 1839,2356,2588 (confirmations); src/game/systems/GameManager.js:502,511,537 (world-gen failed, save warning, version-update Restart/Continue); src/game/systems/EndingSystem.js:63,82 (Launch, The End); src/game/systems/FaintingSystem.js:235 (Exhaustion results); src/game/systems/PlayerPositionSystem.js:405; src/game/systems/StorySystem.js:177; src/game/systems/occurrences/PlayerEventsSystem.js:37 (Darkness intro); src/game/systems/ui/UIOutMetaPopupsSystem.js:87 (System Message); src/game/systems/ui/UIOutMapSystem.js:726; src/game/level13.js:394 (JS-error popup with GitHub link + 'reload'/'clear data')
- desktop: Every one of these renders through #common-popup with title + HTML message (+ optional rewards/buttons). Includes milestone/level-up, tutorial-ish intros, version-update, error, and ending flows - there are no separate DOM popups for them.
- mobile risk: Inherit common-popup risks only. Long HTML bodies (version warning, error popup, The End) plus min-width 30%/max-width 60% between 569-850px produce tall narrow columns; some contain links that need adequate touch spacing.

### Mobile block overlay (#mobile-overlay) [blocker]
- location: index.html:982-985, css/modules/elements-special.less:858-872, src/game/level13.js:165,185-200,263-275, src/level13-app.js:16-19, src/game/helpers/ui/ChangeLogHelper.js:31
- desktop: Fixed full-screen z-20 page-colored wall shown when the user agent matches Android/webOS/iPhone/iPad/iPod/BlackBerry. Text says the game is not optimized for mobile; 'click here' link dismisses it. Game setup is actively delayed (500ms polling) until dismissed, and version warnings are suppressed while it shows.
- mobile risk: This IS the anti-mobile gate: on every phone it blocks the game behind an apology screen. The mobile redesign must remove or invert this (and its setup-delay polling) - keeping it would contradict the whole project.

### Loading overlay (.loading-content) [none]
- location: index.html:995-1002, css/modules/loader.less:1-62, src/game/UIFunctions.js:671-675
- desktop: Fixed full-screen z-20, 50%-alpha page background, three 11px bouncing dots vertically centered (top:50%). Shown during load via setGameOverlay.
- mobile risk: none - fully fluid.

### Thinking overlay (.thinking-content) [none]
- location: index.html:987-993, css/modules/loader.less:1-62, src/game/UIFunctions.js:671-675
- desktop: Identical fixed full-screen spinner overlay used for brief 'thinking' states (mutually exclusive with loading).
- mobile risk: none.

### Theme transition overlay (#theme-transition-overlay) [none]
- location: index.html:1004, css/modules/loader.less:64-76
- desktop: Fixed full-screen z-20 solid #8E8F8E layer whose opacity is animated when switching dark/sunlit themes.
- mobile risk: none.

### Hover-only info callouts inside popups [blocker]
- location: css/modules/elements-common.less:11-72, src/game/helpers/ui/UIPopupManager.js:78, src/game/UIFunctions.js:1657, src/game/systems/ui/UIOutDialogueSystem.js:94, src/game/systems/ui/UIOutPopupTradeSystem.js:274-276
- desktop: Item slots, icons, and marked targets inside popups (rewards, trade columns, fight items, dialogue results) show absolute-positioned .info-callout tooltips on :hover/:focus (display:none otherwise; min-width 60pt, max-width 100pt or 50-100% for info variants; cursor:help).
- mobile risk: Blocker for parity: touch has no hover, so item stats/descriptions inside every popup are unreachable. :focus can partially help but li slots are not focusable. Needs tap-to-toggle callouts or an inline detail pattern. (Callout styling itself may belong to the tooltip lens; the popup-internal dependence is flagged here.)

### Popup sound effects (open/close) [none]
- location: index.html:1013-1014, src/game/helpers/ui/UIPopupManager.js:173,184,217
- desktop: audio-popup-opened / audio-popup-closed wav cues dispatched from showOverlay/hideOverlay and OK-button clicks.
- mobile risk: none for layout; mobile browsers may block audio before first user gesture, which is already the case today.

### Z-index layering contract for popups and page overlays [none]
- location: css/modules/elements-common.less:270-290 (popup z16/z26, blocker z15/z25), css/modules/loader.less (z20), css/modules/elements-special.less:864 (z20), css/modules/vis.less:62 (z20)
- desktop: Layering: in-game popups 16 over blocker 15; page overlays (mobile-overlay, loading, thinking, theme transition, map tooltip) at 20; meta popups 26 (over the page overlays) with an unused meta-blocker class at 25. All popups live inside the single #popup-overlay node.
- mobile risk: none directly, but the redesign must preserve meta-popups-above-loading ordering (e.g., save-management opens over the loading screen).

### Adjacent overlays owned by other lenses (#map-sector-tooltip, #log-overlay) [major]
- location: index.html:781, css/modules/vis.less:58-79; css/modules/elements-special.less:21-27, css/gridism.css:117-125, css/gridism.css:196-198
- desktop: #map-sector-tooltip: fixed, z20, pointer-events:none, min-width 190px / max-width 320px, JS-positioned hover tooltip for map sectors. #log-overlay: pointer-events:none fade layer over the message log, repositioned by the <=850px media query.
- mobile risk: Both are hover/positioning dependent (map tooltip fits 390px width but has no touch trigger). Flagged here for completeness; detailed inventory belongs to the map and log lenses.

**Notes:** Cross-cutting facts for the redesign. (1) css/main.css is COMPILED from css/main.less: every module is emitted twice, prefixed body.dark and body.sunlit - all popup edits must go into css/modules/*.less (structural rules mostly elements-common.less 254-290 and elements-special.less) and be recompiled, or they must be made twice in main.css. (2) Three different 'small screen' definitions coexist and disagree: gridism.css media queries at 568px and 850px, JS SMALL_LAYOUT_THRESHOLD=850 (UIConstants.js:29) driving body.layout-small/.layout-regular (UIOutHeaderSystem.js:1120-1128), and a UA-sniff GameConstants.isMobile (level13-app.js:16). Pick one source of truth. (3) Dead selectors to reconcile: .layout-mobile and .regular-layout appear in CSS but are never applied as body classes; .popup-overlay-meta is never applied by JS. (4) The single biggest structural gap is that div.popup has no max-height/overflow handling while body scroll is locked - fixing repositionPopup + adding internal scroll fixes all seven dialogs at once (fight, caravan, manage-save, stats, settings, dialogue, common). (5) All 'special' popups are static DOM inside #popup-overlay in index.html:785-978; everything else funnels into #common-popup, so parity requires exactly 7 dialog layouts plus the reward-div component. (6) Touch affordances already partially exist: registerLongTap is used in the caravan popup; hover callouts and Escape-to-dismiss are the two desktop-only interaction dependencies inside popups. (7) The #mobile-overlay UA wall actively delays game setup (level13.js:185-200) and must be removed/inverted for the mobile build.

## LENS: secondary

### Info-callout tooltip system (hover-gated info + buttons) [blocker]
- location: /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/UIFunctions.js:351-374,522-529, /Users/earchibald/Worktrees/level13-gh-pages-mobile/css/modules/elements-common.less:13-20, /Users/earchibald/Worktrees/level13-gh-pages-mobile/css/main.css:1042-1090 (dark) and 3759-3806 (sunlit)
- desktop: generateInfoCallouts wraps every .info-callout-target in a position:relative .callout-container and appends an absolutely positioned .info-callout sibling (arrow-up or arrow-left variant). Display is pure CSS: '.info-callout-target:hover + div.info-callout, div.info-callout:hover, ...:focus' -> display:block. Callout width min 60pt / max 100pt (info variant min-width 50%, max-width 100%), z-index 5, font-size 0.85rem. Content is the element's description attribute, refreshed by updateInfoCallouts. Item callouts (UIConstants.getItemCallout) embed live action BUTTONS (Use/Repair/Equip/Unequip/Discard) that stay clickable because the callout itself matches :hover. UIFunctions.js:370 also dispatches elementToggledSignal on hover so systems refresh callout content.
- mobile risk: This is the game's primary information channel (item stats, worker descriptions, stat explanations) and, for the Bag tab, the ONLY path to Equip/Unequip/Use/Repair/Discard. Touch has no hover; sticky-hover tap emulation opens it unreliably, cannot close it deterministically, and the hover-in refresh (button disabled states, elementToggledSignal) never fires. Absolute-positioned callouts also overflow a 390px viewport. Parity needs tap-to-toggle (note: CSS already matches :focus, so adding tabindex to targets is a cheap path) or bottom-sheet redesign, plus outside-tap dismissal.

### Action button callout (costs/risks/duration/disabled reason) [blocker]
- location: /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/utils/ActionButton.js:86-196, /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/UIFunctions.js:1379-1459, /Users/earchibald/Worktrees/level13-gh-pages-mobile/css/main.css:1060-1080
- desktop: Every button.action is wrapped in .callout-container and gets a .btn-callout shown by 'div.container-btn-action:hover + div.btn-callout' -> display:block. Absolutely positioned top:37px, centered via translateX(-50%), max-width 100pt, pointer-events:none, opacity 0.95. Shows description, dynamic effect text, costs (with blocker highlighting), 'available in Xs' countdown, duration, special reqs, injury/fight/item-loss risk percentages, and the disabled reason when the button is disabled. Player reads this BEFORE clicking.
- mobile risk: On touch, tapping the button fires the action immediately; the player can never preview costs, risk percentages, or read why a button is disabled. This silently changes gameplay (blind scavenging/fighting). Parity requires a touch path to the same panel before committing: long-press preview, an info toggle mode, or inline cost display. pointer-events:none means the callout itself never blocks taps, but also can never be interacted with.

### Canvas drag-to-pan (main map + tech tree) [blocker]
- location: /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/constants/CanvasConstants.js:6-127, /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/helpers/ui/UIMapHelper.js:84-97, /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/helpers/ui/UITechTreeHelper.js:157-177, /Users/earchibald/Worktrees/level13-gh-pages-mobile/css/main.css:1506-1533
- desktop: makeCanvasScrollable binds mousedown/mousemove/mouseup/mouseleave on the canvas; dragging sets parent .scrollLeft/.scrollTop (parent .scroll-position-container has overflow:hidden, so no native scrolling). Cursor becomes all-scroll (main.css:1531). Position shown via absolutely positioned 5px scroll-position-indicator bars; releases snap to a 20px grid; drag start clears page text selection. Applied to #mainmap (Map tab) and the upgrades tech tree canvas.
- mobile risk: Zero touch handlers and overflow:hidden means the map and tech tree CANNOT be panned at all on touch - browsers do not synthesize mouse events for drags. Entire map/tech-tree content outside the initial viewport is unreachable. Needs touchmove/pointer-event panning (with touch-action:none on the canvas) or native overflow:auto scrolling; the snap-to-grid and indicator logic must be re-hooked to whichever is chosen.

### Map zoom via mouse wheel (only zoom input) [blocker]
- location: /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/systems/ui/UIOutMapSystem.js:60-61,465-515, /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/helpers/ui/UIMapHelper.js:51-82
- desktop: wheel event on #mainmap-container calls preventDefault and zoomMap(+-1 step of 0.3), rebuilding the canvas and overlay while keeping the point under the cursor stationary (scrollLeft/scrollTop math). No on-screen zoom buttons exist anywhere in index.html - the wheel is the sole zoom mechanism. Zoom also rescales the 11px overlay hit cells (UIMapHelper.js:353-356).
- mobile risk: Touch devices have no wheel; pinch would just zoom the page (no touch-action rules). Map zoom becomes completely unreachable - a whole feature lost. Parity requires pinch-to-zoom handling and/or visible +/- zoom buttons calling zoomMap(steps, pageX, pageY).

### Map sector hover tooltip [minor]
- location: /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/systems/ui/UIOutMapSystem.js:62-70,322-463, /Users/earchibald/Worktrees/level13-gh-pages-mobile/css/main.css:3062-3078
- desktop: Delegated mouseenter/mousemove/mouseleave on .map-overlay-cell. After a 450ms hover delay, #map-sector-tooltip (position:fixed, z-index 20, pointer-events:none, white-space:nowrap) is filled with sector name/pos plus a table of district, distance, POIs, scavenging, collectors, threats, blockers, environment, misc, and positioned near the cursor with edge flipping (16px gap, 8px margin). Hidden on scroll, wheel, hover-out, and sector click.
- mobile risk: Never appears on touch (no hover). Informational parity survives because clicking a cell shows the identical fields in the details panel below the map (onSectorSelected -> updateSector, same label keys), so the redesign can drop the tooltip on touch - but must verify the click path stays reachable and consider white-space:nowrap overflow if the tooltip is kept for hybrid devices.

### Map overlay cell tap targets (sector select) [major]
- location: /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/helpers/ui/UIMapHelper.js:333-375, /Users/earchibald/Worktrees/level13-gh-pages-mobile/css/modules/vis.less:26-56, /Users/earchibald/Worktrees/level13-gh-pages-mobile/css/main.css:3038-3061
- desktop: Click on a .map-overlay-cell (absolutely positioned div, 11px x 11px at zoom 1.0, inline-sized to sectorSize = round(11 * mapZoom)) selects the sector: plays click sound, toggles .selected (white background + 5px outline), calls sectorSelectedCallback which fills the details panel. :hover shows white background as pre-click feedback.
- mobile risk: 11px targets are far below the ~44px touch minimum; precise sector selection on a 390px screen will constantly mis-tap adjacent sectors. Hover pre-highlight feedback is also gone. Fix: enlarge hit areas (padding beyond the visual cell), raise default zoom on touch, or add next/prev sector stepping (buttons btn-mainmap-sector-details-next/previous already exist at UIOutMapSystem.js:106-112 - reuse them prominently).

### Long-tap repeat (incoming caravan trade popup) [major]
- location: /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/UIFunctions.js:1516-1560, /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/systems/ui/UIOutPopupTradeSystem.js:253-272
- desktop: registerLongTap binds mousedown on trade list <li>s: after 1000ms hold, moveItem repeats every 200ms while the global mouseDown flag (document mousedown/mouseup/mouseleave tracking, UIFunctions.js:159-174) stays true and the element matches. mousemove/mouseleave/mouseup cancel. Single click moves one item (multiplied by the 1x/10x/100x HorizontalSelect).
- mobile risk: Touch never fires a sustained mousedown (compat mouse events are synthesized only at tap end), so the hold-to-repeat never triggers; browser long-press instead opens text-selection/context UI. Bulk trading falls back to tapping once per item - tedious but the 10x/100x multiplier keeps functional parity. For full parity add touchstart/touchend equivalents with contextmenu/selection suppression on those lists.

### Keyboard hotkey system [minor]
- location: /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/UIFunctions.js:31-36,156,176-267,595-607,914-953, /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/systems/ui/UIOutMetaPopupsSystem.js:30-35,92-149, /Users/earchibald/Worktrees/level13-gh-pages-mobile/index.html:940-945
- desktop: document keyup handler. Registered: WASD/QEZC (or Numpad 1-9 via hotkeysNumpad setting) sector movement, N scavenge, M scout, G/F collect water/food (out tab only), Shift+ArrowLeft/Right previous/next tab, Escape dismiss popup (isUniversal - works even with hotkeys off), dev-only H/K/L cheats when isCheatsEnabled. Off by default (settings.hotkeysEnabled=false); toggled in settings popup plus a numpad checkbox and a generated hotkey list. Buttons show per-key .hotkey-hint badges on .container-btn-action:hover (ActionButton.js:65-70, main.css:1019-1040), already tagged hide-in-small-layout.
- mobile risk: No function is keyboard-ONLY: movement has the 3x3 button grid (UIOutLevelSystem.js:100-125), scavenge/scout are buttons, tabs are tappable, popups have close buttons and overlay-tap dismissal. Safe to leave the system dormant on touch (works if a BT keyboard attaches). Only tasks: keep the settings toggles honest (hints hidden), and ensure the settings hotkey list does not confuse touch users.

### Tab bar activation (click + Enter/Space) [none]
- location: /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/UIFunctions.js:71-82,1083-1090,1587-1605, /Users/earchibald/Worktrees/level13-gh-pages-mobile/index.html:202-212, /Users/earchibald/Worktrees/level13-gh-pages-mobile/css/modules/elements-common.less:234-240
- desktop: #switch-tabs li elements (tabindex=0) respond to click and keydown Enter/Space (onButtonLikeElementKeyDown); disabled class blocks activation; hover shows underline + background (cosmetic). showPreviousTab/showNextTab iterate visible tabs for the Shift+Arrow hotkeys and call .click().
- mobile risk: Tap works via native click. Hover styles are cosmetic only. Risk is layout (11 tabs in a row at 390px - other lens), not interaction. Keep tabindex/keydown for external keyboards.

### Number steppers (workers, embark, trade) [major]
- location: /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/UIFunctions.js:307-323,564-577,871-912,1048-1061,1461-1502, /Users/earchibald/Worktrees/level13-gh-pages-mobile/index.html:131-137 (worker assignment change handler)
- desktop: generateSteppers injects [-] button, <input class='amount' type='text' min max autocomplete=off tabindex=0>, [+] button. Plus/minus click-adjust by 1 with disabled-state styling at bounds; direct typing is filtered by onNumberInputKeyDown (keyCode whitelist: digits, numpad digits, nav keys, Ctrl+A) and validated on change (clamp, restore oldValue from focusin). No press-and-hold repeat on the +/- buttons.
- mobile risk: type='text' with no inputmode/pattern brings up the full alpha keyboard; keyCode-based filtering is unreliable on mobile IMEs (Android often reports keyCode 229), so garbage can enter until change-time clamping. The +/- glyph buttons are small text buttons. Fix: inputmode='numeric', rely on change-validation instead of keydown, enlarge +/-, and consider press-and-hold repeat since setting 50 workers means 50 taps otherwise.

### Bag item/equipment slot hover (highlight + callout button refresh) [blocker]
- location: /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/systems/ui/UIOutBagSystem.js:60-78,489-500,616-643, /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/constants/UIConstants.js:81-202
- desktop: Hovering an equipment slot or bag item calls refreshButtonsInCallout (updates disabled state of the Equip/Use/Discard buttons inside the item's info-callout before it becomes visible) and highlightItemType (adds .highlighted to comparable items/slots to show what an item would replace). Item divs also carry comparison badges (arrow up/down) that are always visible.
- mobile risk: Rides on the info-callout blocker above: without a tap-open path the buttons inside callouts are unreachable and never refreshed, so equipping/discarding breaks. The type-highlight guidance disappears too (informational only; comparison badges remain). Whatever tap-to-open mechanism is built must invoke refreshButtonsInCallout + highlightItemType at open time.

### Explorer slot/list hover highlight [minor]
- location: /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/systems/ui/UIOutExplorersSystem.js:62-73,205-215,392-410
- desktop: Hovering a party slot or an explorer in the recruit list highlights all explorers/slots of the same type (toggleClass 'highlighted'), showing which slot an explorer would occupy. Explorers also use info-callouts with option buttons (same generated callout system).
- mobile risk: Highlight guidance lost on touch (cosmetic/informational; selection itself is button-based). The explorer callouts inherit the info-callout blocker. Trigger the highlight from the same tap-open event used for callouts.

### Camp visualization building hover info [minor]
- location: /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/systems/ui/UIOutCampVisSystem.js:163-167,454-464,480-488,568-576
- desktop: Building divs in the camp vis strip get mouseenter/mouseleave (except fortification/sundome): hover shows an info overlay with building name + level (e.g. 'Hut (Level 2)'); hidden on leave. Purely supplementary flavor info - the improvements list elsewhere shows the same data.
- mobile risk: No hover on touch; sticky-hover taps may fire mouseenter but never reliably mouseleave, leaving stale overlays. Because the data is duplicated in the camp improvements table, acceptable to disable on touch or convert to tap-toggle.

### Tech tree overlay nodes (click select, hover highlight) [minor]
- location: /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/helpers/ui/UITechTreeHelper.js:219-240, /Users/earchibald/Worktrees/level13-gh-pages-mobile/css/main.css:3118-3128
- desktop: 85x22px .upgrades-overlay-cell divs over the tech tree canvas: click selects a tech (redraw + selection callback), hover sets highlightedID and repaints canvas (cosmetic emphasis). Sits inside the drag-scroll canvas container.
- mobile risk: Click works via tap; 85x22 is a marginal but workable target. Hover highlight lost (cosmetic). The real problem is the shared canvas drag-pan blocker - without panning most of the tree is unreachable.

### Popup dismissal model (overlay click / Escape / default buttons) [minor]
- location: /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/helpers/ui/UIPopupManager.js:23-27,188-193,290-310, /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/UIFunctions.js:208,1628-1658, /Users/earchibald/Worktrees/level13-gh-pages-mobile/css/gridism.css:172-178
- desktop: Clicking #popup-overlay (only when e.target is the overlay itself) dismisses dismissable popups by triggering their .button-popup-default; Escape hotkey (universal) does the same; every popup also has explicit close/OK buttons. Default button gets focus on open (UIFunctions.focus with retry).
- mobile risk: Tap on overlay works, but under 768px .fill-on-mobiles makes popups 100% width so little or no overlay remains tappable - close buttons become the only path (they exist everywhere, so parity holds). Verify buttons stay above the on-screen keyboard for input popups; keep Escape for BT keyboards.

### Text input popups (rename camp, save import) [minor]
- location: /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/UIFunctions.js:140-154,1063-1081,1725-1757
- desktop: showInput reuses #common-popup with a text input (maxlength 40, cleanup on keyup via StringUtils.cleanUpInput). onTextInputKeyDown/KeyUp mark events isTextInput so the document-level hotkey handler ignores typing. Confirm validates non-empty input.
- mobile risk: Works on touch, but the on-screen keyboard can cover the fixed-position popup/buttons; no scroll-into-view handling exists. The keyCode-based allow-list in onTextInputKeyDown is a no-op risk on mobile IMEs but cleanup happens on keyup anyway. Minor viewport/keyboard testing needed.

### Text selection & touch-CSS hygiene [major]
- location: /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/constants/CanvasConstants.js:20,65-75, /Users/earchibald/Worktrees/level13-gh-pages-mobile/css/main.css:508-517 (.unselectable), /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/helpers/PlayerActionResultsHelper.js:1135,1155, /Users/earchibald/Worktrees/level13-gh-pages-mobile/index.html:19 (viewport meta)
- desktop: Map drag clears any page selection; .unselectable (user-select:none) is applied only to inventory-management result lists and folded table cells to stop selection during rapid clicking. Viewport meta is width=device-width,initial-scale=1 with NO user-scalable constraint; nowhere in the CSS is touch-action or -webkit-tap-highlight-color set; buttons/labels are selectable.
- mobile risk: Rapid tapping (the core incremental-game gesture) triggers double-tap zoom, tap-highlight flashes, and accidental text selection/callout menus on labels and item images (no -webkit-touch-callout either). Redesign needs: touch-action:manipulation on interactive elements, tap-highlight-color transparent, user-select:none on buttons/steppers/trade lists, while keeping log/story text selectable.

### Vision-disabled button hover reveal [major]
- location: /Users/earchibald/Worktrees/level13-gh-pages-mobile/css/modules/elements-buttons.less:203-210, /Users/earchibald/Worktrees/level13-gh-pages-mobile/css/main.css:983-988,3700-3705
- desktop: button.btn-disabled-vision is rendered at opacity 0.2 with transparent text (unreadable - simulates darkness); :hover raises opacity to 0.65 so the player can peek at what the button is. Also '.container-btn-action-disabled-reason .btn-callout-empty' shows the disabled reason on hover.
- mobile risk: No hover peek on touch: vision-gated buttons stay near-invisible with no way to inspect them, and their disabled reason (in the callout) is unreachable. Needs a tap-reveal (first tap reveals, second activates) or higher base opacity on touch.

### Native title-attribute tooltips [minor]
- location: /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/systems/ui/UIOutMilestonesSystem.js:187, /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/systems/ui/UIOutCampSystem.js:627,681
- desktop: Three title= usages: milestone requirement checkmark ('checkmark'), damaged-building gear icon ('Building damaged', also has alt), and the per-worker auto-assign checkbox ('Auto-assign worker'). Browser-native hover tooltips.
- mobile risk: title never shows on touch. The damaged icon and checkmark are decorative-adjacent (context makes them readable), but 'Auto-assign worker' is the only label for that checkbox column - touch users get an unlabeled checkbox. Add a visible column header or info-callout.

### Auto-assign / settings checkboxes tap size [major]
- location: /Users/earchibald/Worktrees/level13-gh-pages-mobile/css/modules/elements-input.less:114-129, /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/systems/ui/UIOutCampSystem.js:681, /Users/earchibald/Worktrees/level13-gh-pages-mobile/index.html:937-945
- desktop: Custom-styled checkboxes are 1em x 1em (~13px) with 1px border, used in the settings popup (sounds, hotkeys, numpad) and per-worker auto-assign toggles inside the camp workers table; labels are separate non-clickable <p class='checkbox-label'> elements (no <label for=> association).
- mobile risk: 13px targets with non-tappable labels are very hard to hit on a 390px screen. Wrap in <label> or bind label clicks, and grow to 44px effective hit area.

### Horizontal select (trade multiplier 1x/10x/100x/1000x) [minor]
- location: /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/elements/HorizontalSelect.js:20-48, /Users/earchibald/Worktrees/level13-gh-pages-mobile/css/modules/elements-common.less:344-352, /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/systems/ui/UIOutPopupTradeSystem.js:279-283
- desktop: Inline <li class='horizontal-select-option'> options; click selects (toggles .selected); :hover background is cosmetic. Used in the incoming-caravan popup to multiply per-click item moves.
- mobile risk: Tap works. Only concern is option padding for touch (small text chips). Becomes MORE important on touch since it substitutes for broken long-tap repeat - keep it visible and enlarged.

### Collapsible section headers [none]
- location: /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/UIFunctions.js:295-305,1140-1158, /Users/earchibald/Worktrees/level13-gh-pages-mobile/css/modules/elements-common.less:462-470
- desktop: Click on .collapsible-header slide-toggles the sibling .collapsible-content (300/200ms), with accordion behavior inside .collapsible-container-group; :hover background is cosmetic feedback; headers start collapsed.
- mobile risk: Tap works natively. Header height should be checked for 44px but mechanism is touch-safe.

### Trade popup list rows (click to move item) [none]
- location: /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/systems/ui/UIOutPopupTradeSystem.js:253-272, /Users/earchibald/Worktrees/level13-gh-pages-mobile/css/main.css:655-657 (table.highlight-row tr:hover)
- desktop: Clicking an <li> in the four caravan lists moves one item (times multiplier) between inventory and offer; row/entry hover highlight is cosmetic. Also each item has an info-callout.
- mobile risk: Tap-to-move works. Item rows are small icons (~46px li per gridism popup rule) - borderline OK. Hover feedback loss is cosmetic. Long-tap covered separately.

### Blueprint piece hover emphasis [none]
- location: /Users/earchibald/Worktrees/level13-gh-pages-mobile/css/modules/elements-special.less:600-614, /Users/earchibald/Worktrees/level13-gh-pages-mobile/css/main.css:2686-2690
- desktop: .blueprint:hover thickens the border to 2px (cosmetic emphasis on the upgrades tab blueprint pieces, which also carry info-callouts).
- mobile risk: Cosmetic only; no info lost beyond the general callout issue.

### Native select dropdowns [none]
- location: /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/systems/ui/UIOutMapSystem.js:56-58,134-161 (level/mapmode/mapstyle), /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/systems/ui/UIOutBagSystem.js:651 (#select-bag-autoequip-type), /Users/earchibald/Worktrees/level13-gh-pages-mobile/index.html:947-949 (language-dropdown)
- desktop: Standard <select> elements with change handlers: map level selector, map mode (default/hazards/scavenging), map style (canvas/ASCII), bag auto-equip bonus type, language. select:hover is cosmetic.
- mobile risk: None - native pickers work well on touch and are arguably better there. Ensure font-size >= 16px to avoid iOS zoom-on-focus.

### Global mouse-state tracker [major]
- location: /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/UIFunctions.js:159-174
- desktop: document-level mousedown/mouseup/mouseleave keep GameGlobals.gameState.uiStatus.mouseDown and mouseDownElement current; consumed only by registerLongTap's repeat loop.
- mobile risk: Touch never sets mouseDown for a sustained press, silently disabling every consumer (currently long-tap repeat). Any touch redesign should mirror touchstart/touchend into this state or replace it with pointer events.

### Window resize handling [minor]
- location: /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/UIFunctions.js:69,700-702, /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/systems/ui/UIOutMapSystem.js:129-132, /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/systems/ui/UIOutHeaderSystem.js:1120-1139
- desktop: window.resize dispatches windowResizedSignal; consumers recompute #mainmap-container maxHeight = max(198, windowHeight - 380), reposition popups, and updateLayoutMode toggles body.layout-small/.layout-regular at width <= 850 (UIConstants.SMALL_LAYOUT_THRESHOLD), driving mobile header padding.
- mobile risk: Mobile URL-bar show/hide fires resize constantly - map rebuild/popup reposition churn possible; windowHeight - 380 leaves ~198-460px of map on phones. Use visualViewport or debounce, but mechanism itself works. Note 850px threshold already gives a 'small layout' starting point.

### Absent event types (audit result) [none]
- location: /Users/earchibald/Worktrees/level13-gh-pages-mobile/src (whole tree), /Users/earchibald/Worktrees/level13-gh-pages-mobile/index.html
- desktop: Verified by grep: NO dblclick, NO contextmenu, NO HTML5 drag/drop or draggable attrs, NO touchstart/touchend/touchmove, NO pointer events, NO inline on*= handlers in index.html, no keydown-only features outside those listed. Cheat console is JS-console-only (level13.cheat(), /Users/earchibald/Worktrees/level13-gh-pages-mobile/src/game/level13.js:413-416) and dev-gated.
- mobile risk: None directly - this is the baseline finding that the entire input layer is jQuery mouse events + CSS :hover with zero touch awareness; simulated click events are the only reason anything works on touch today.

**Notes:** Cross-cutting for the mobile redesign (repo root /Users/earchibald/Worktrees/level13-gh-pages-mobile): (1) The codebase contains zero touch/pointer handlers; taps work only via browser-synthesized click events. Everything click-bound survives on touch; everything hover-, drag-, or wheel-bound is dead. (2) The two callout systems (info-callout and btn-callout) are the game's core information channel and, for the bag/explorers, an interaction channel (buttons inside hover-only callouts). The CSS already includes :focus selectors alongside :hover (elements-common.less:13-20), so giving .info-callout-target elements tabindex=0 plus a tap handler that focuses them (and dispatches elementToggledSignal + refreshButtonsInCallout) is a low-risk tap-to-open path; btn-callouts need a different answer (pointer-events:none, and tap = activate), e.g. long-press preview or inline cost rows. (3) Canvas panning (main map, tech tree) and wheel zoom must be rebuilt with touch: touch-drag or native overflow scrolling, pinch zoom plus on-screen +/- buttons calling the existing zoomMap/changeMapZoom APIs; keep CanvasConstants' snap-to-grid and indicators in sync. (4) A JS-driven small-layout mode already exists (body.layout-small at width<=850, UIOutHeaderSystem.updateLayoutMode; gridism.css media queries at 768px incl. .fill-on-mobiles popups; hotkey hints already hide-in-small-layout) - the redesign should build on it rather than add a parallel breakpoint system, but note the 850/768 mismatch flagged in UIConstants.js:29. (5) Missing touch hygiene: no touch-action, no -webkit-tap-highlight-color, no -webkit-touch-callout, selective user-select only; rapid tapping will double-tap-zoom and select text. (6) Tap-target audit: map cells 11px, checkboxes ~13px with non-associated labels, stepper +/- glyphs, 11-item tab row - all below 44px. (7) Hotkeys are never the sole path to any function (movement grid, scavenge/scout buttons, popup close buttons all exist), so keyboard support can stay dormant-but-functional on mobile. (8) Long-tap repeat in the trade popup and the vision-disabled button hover-peek are the two subtle mouse-only behaviors easiest to miss in a parity audit.
