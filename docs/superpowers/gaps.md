
### Movement compass table (3x3, dual normal/grit buttons) [major]
- location: src/game/systems/ui/UIOutLevelSystem.js:92-125, index.html:378-379, css/main.css:865-867 (dark) / 3582-3584 (sunlit)
- desktop: JS-generated 3x3 table of .action-move buttons fixed at 55px width, one cell per direction; each cell holds TWO stacked buttons — a normal movement button plus a 'grit' variant (.movement-action-grit .btn-warning) toggled by availability. Movement costs/risks appear only in the hover btn-callout. Whole table hidden until the 'move' feature unlocks (UIOutLevelSystem.js:301). The merged inventory noted the .action-move 55px width rule but never the compass element itself.
- mobile risk: The single most-used control in the game and it is absent from the inventory. 55px-wide buttons at ~30px height are below comfortable touch size; the 3x3 grid must stay thumb-reachable; movement cost info is hover-only.

### Movement-blocker action buttons (#container-out-actions-movement-related) [minor]
- location: index.html:405-406, src/game/systems/ui/UIOutLevelSystem.js:969-1002
- desktop: Dynamically appended action buttons (clear blockage, bridge gap, etc.) with cooldowns, slid in/out via slideToggleIf when the sector is scouted (UIOutLevelSystem.js:299).
- mobile risk: Buttons flow inline and wrap; only the shared hover-callout dependency applies.

### Locales list (#out-locales / #table-out-actions-locales) [minor]
- location: index.html:441-447, src/game/systems/ui/UIOutLevelSystem.js:92 (UIList.create), 878-879
- desktop: UIList-driven table rows of point-of-interest scout buttons (one row per locale), rebuilt with createButtons/updateButtonDisabledStates on change.
- mobile risk: Rows are single buttons; adapts, but inherits table cell widths and hover callouts.

### NPC character sections: sector (#out-characters) and camp (#in-characters) [minor]
- location: index.html:409-414 and 276-279, src/game/systems/ui/UIOutLevelSystem.js:933-957, src/game/systems/ui/UIOutCampSystem.js:82, 503-505
- desktop: Dynamically populated NPC divs with buttons that launch the dialogue popup; camp version is a UIList in an infobox, sector version an actionbox; headers toggled with content. Distinct from the explorer/recruit UI the readers covered.
- mobile risk: Buttons are standard; npc-container min-widths (50px) are small but tappable. Mostly a parity-completeness gap, not a layout break.

### Camp events section (#in-occurrences-* containers) [minor]
- location: index.html:280-287, src/game/systems/ui/UIOutCampSystem.js:79-81 (UILists), 806-836 (outgoing caravan progress bars)
- desktop: UILists of active camp events (trader visits, raids, misc) rendered as boxes with action buttons and progress-wrap timers; outgoing-caravan progress bars appended per caravan; uses event-starting/event-ending blink classes (theme lens covered the animation but not this element).
- mobile risk: Progress bars and buttons stack fine; timer labels are 0.85rem small text.

### Camp demographics box (#in-demographics) [minor]
- location: index.html:288-319, src/game/systems/ui/UIOutCampSystem.js:940-990
- desktop: Text rows (founded date, luxury resources, raid danger/defence, disease chance, level stats) with several hover info-callout targets including a dedicated .info-icon image (index.html:294-296, css/main.css:533-540) whose content is set via updateCalloutContent; plus a .debug-info row.
- mobile risk: Text flows fine; the luxury-resources detail and raid/disease explanations are hover-only.

### Outgoing caravan planner rows (Trade tab) — the game's only range-slider instance [major]
- location: src/game/systems/ui/UIOutTradeSystem.js:108-230, index.html:608-613
- desktop: Per trade partner: a toggle button ('Send caravan') expands a hidden highlightbox table row containing a Sell <select>, an <input type=range> (step 10, 15px thumb), a live amount label, a Get <select>, and a Send action button; selections persisted in uiStatus.lastSelection. The components lens documented range-slider CSS but flagged no instance — this is it, and the whole planner is missing from the inventory.
- mobile risk: A five-widget horizontal table row cannot fit 390px; the 15px slider thumb is far below touch size; expanding rows inside a table complicate reflow.

### Trade tab in-page lists (incoming trader rows, partners table, outgoing caravans list) [minor]
- location: index.html:596-614, src/game/systems/ui/UIOutTradeSystem.js:60-105 (incoming + tab header), 115-136 (partner rows), UIOutTradeSystem.js trade bubble at 86-97
- desktop: Incoming trader row with 'trade' button (opens caravan popup), trade partners table rows, outgoing caravans <ul>, empty-state paragraphs, and available-caravans counter. Inventory covered only the popup, not the tab content.
- mobile risk: Simple rows and buttons; adapts with table-width care.

### Result-popup inventory selection behavior (UIOutPopupInventorySystem) [major]
- location: src/game/systems/ui/UIOutPopupInventorySystem.js:56-76 (dynamic OK label), 78-200 (lists + onLiClicked at 110-160), 163-170 (empty messages)
- desktop: Inside reward popups: #resultlist-inventorymanagement-found / -kept / #resultlist-loststuff-lost / #resultlist-positive lists; clicking an item/resource row moves it between 'found' and 'kept'; the confirm button re-labels itself Take selected / Leave / Continue and toggles .btn-secondary. The popups lens cited the container div but no reader cited this system or its click-to-move interaction.
- mobile risk: Tap targets are 18px icon list entries; two side-by-side inventoryboxes with ul min-width 380px in #common-popup overflow a 390px screen.

### Secondary button style (.btn-secondary) [none]
- location: css/main.css:862-864 (dark), 3579-3581 (sunlit); users: src/game/systems/ui/UIOutExplorersSystem.js:162, src/game/systems/ui/UIOutPopupInventorySystem.js:70
- desktop: De-emphasized button variant (thinner 1px border) used for Dismiss recruit and the Leave state of the inventory confirm button.
- mobile risk: None; visual only.

### Explorer recruits table (#recruits-container) [minor]
- location: index.html:524-530, src/game/systems/ui/UIOutExplorersSystem.js:141-170
- desktop: JS-built table rows: explorer div with info callout, recruit action button (with cost callout), and Dismiss (.btn-secondary); empty-state paragraph at index.html:526.
- mobile risk: Table row with explorer card + two buttons is wide; hover callouts for explorer stats and costs.

### Header player perks and statuses icon lists (.player-perks-list, .player-statuses-list) [major]
- location: index.html:52-53 (mobile), 112-113 (regular), src/game/systems/ui/UIOutHeaderSystem.js:265-266 (UIList create), 366, 691-753
- desktop: Icon lists (injuries, buffs, hunger/thirst, status effects) rendered as .item-style circles with info callouts explaining each perk; updated via UIList with animations. Present in both headers but absent from the merged inventory, which covered only stat indicators.
- mobile risk: Perk meaning is hover-only; icons are 18px tap targets; list length is unbounded and must wrap in a fixed-height mobile header.

### Equipment stats indicators (#container-equipment-stats-side, .stats-equipment-*) [major]
- location: index.html:118, src/game/systems/ui/UIOutHeaderSystem.js:232-246; mobile slot commented out at index.html:47-49
- desktop: JS-generated stat-indicator-secondary divs (fight attack/defence, scavenge bonuses) with themed icons, appended to the regular-layout sidebar only; also #stats-scavenge-bonus rows (UIOutHeaderSystem.js:248-256).
- mobile risk: Entirely absent from the small layout today (markup commented out) — a 100% parity redesign must reinstate it somewhere.

### Deity statsbar (#statsbar-deity-regular, .deity-name) [minor]
- location: index.html:134-136 (regular), 39-43 (mobile version commented out), src/game/systems/ui/UIOutHeaderSystem.js:611-613
- desktop: Deity name line in the regular stats bar, toggled visible once the player has a deity (Hope system).
- mobile risk: Missing from mobile header markup — parity gap to resolve.

### Header item and explorer icon lists (#list-header-items-regular, #list-header-explorers-regular) [major]
- location: index.html:155, 159 (regular), 67-75 (mobile counterparts commented out), src/game/systems/ui/UIOutHeaderSystem.js:618-668
- desktop: Icon lists of carried unique items and party explorers in the regular header, each with hover info callouts. Note UIOutHeaderSystem.js:618 still toggles #list-header-items-mobile, an element that does not exist in the DOM.
- mobile risk: Absent from small layout; JS references a nonexistent mobile id; parity redesign must re-home these lists and replace hover callouts.

### Dynamic tab visibility and naming system (UIOutTabBarSystem) [major]
- location: src/game/systems/ui/UIOutTabBarSystem.js:79-103 (updateTabVisibility), 105-117 (updateTabNames)
- desktop: Shows/hides the 11 tabs by game state on ~11 signals: early game has 2-3 tabs, late game up to 11; in/out tabs are mutually exclusive with camp presence; tab names get appended data (camp population). No reader cited this system — the inventory treats the tab bar as static.
- mobile risk: Any fixed mobile tab layout (bottom bar, grid) must handle a variable 2-11 tab count and growing labels without reflow bugs.

### Runtime localization system (data-text-key + UIOutTextSystem + strings/) [minor]
- location: src/game/systems/ui/UIOutTextSystem.js:24-45, strings/strings.json, strings/strings-fi.json, index.html (data-text-key on ~80 elements, e.g. 202-212 tab labels)
- desktop: Every .text-key element gets its text replaced at runtime from strings JSON; language change (settings dropdown, debug-only per UIOutMetaPopupsSystem.js:14) reloads all texts. Not mentioned by any reader.
- mobile risk: Fixed-width buttons/tabs sized to English strings can overflow with localized (Finnish) strings; mobile layouts must size to content.

### Milestone unlock button and unlocks lists [none]
- location: index.html:719, 724, 732 (#milestone-*-unlocks, #milestone-next-button-container), src/game/systems/ui/UIOutMilestonesSystem.js:106-116, 145-148
- desktop: JS-appended 'Unlock' action button (claim_milestone_N) plus generated unlock-description divs for current and next milestone; title-attribute tooltips on unlock entries (already noted elsewhere).
- mobile risk: Standard action button and flowing text; adapts fine.

### Projects tab controls: Launch button, reset-hidden meta button (.btn-meta-float) [minor]
- location: index.html:629 (#in-action-launch), 638-642 (#in-improvements-reset-hidden, hidden-projects block), css/main.css:930-932 (.btn-meta-float float:right), src/game/systems/ui/UIOutProjectsSystem.js:39
- desktop: Endgame Launch action button; a float-right 'reset' meta button that restores hidden project rows; hidden-projects message paragraph. Inventory covered the projects tables only structurally.
- mobile risk: float:right meta button can collide with the subheader on narrow widths; otherwise adapts.

### Embark overweight warning (#embark-warning) [none]
- location: index.html:350, src/game/systems/ui/UIOutEmbarkSystem.js:208-209
- desktop: Warning-red span next to the Leave camp button, toggled when the selected load is invalid.
- mobile risk: None; inline text.

### Tribe tab message line (#world-message) [none]
- location: index.html:694-695, src/game/systems/ui/UIOutTribeSystem.js:166
- desktop: Localized status paragraph above the camp overview table.
- mobile risk: None; plain text.

### Debug/cheat UI cluster [none]
- location: src/game/systems/ui/UIOutHeaderSystem.js:1125 (.debug-info toggle), css/main.css:2046-2052, index.html:318 and 588-591 (#in-demographics-debug-general, #mainmap-sector-details-content-debug + #btn-cheat-teleport), src/game/systems/ui/UIOutMapSystem.js:98 and 1030-1040, src/game/level13.js:413-415 (console cheat entry), src/game/systems/CheatSystem.js:321-338 (getCheatListDiv — no caller, dead code), src/game/systems/ui/UIOutUpgradesSystem.js:291, src/game/UIFunctions.js:214 (isDev hotkeys)
- desktop: All .debug-info elements are toggled by GameConstants.isDebugVersion (false in prod); cheats gated by isCheatsEnabled (false) and driven from the browser console; the only cheat UI reachable in a debug build is the map Teleport button. The canvas lens's line range brushed past #btn-cheat-teleport without naming it.
- mobile risk: None in production builds; keep the toggles wired for parity.

### mobile-test.html device-size harness [none]
- location: mobile-test.html:1-33 (repo root)
- desktop: Standalone test page: an iframe embedding index.html with preset size buttons (390x844, 360x740, 844x390, 768x1024, 320x568). Not referenced by any inventory entry.
- mobile risk: None — it is redesign tooling already present on this branch; the redesign team should know it exists (note: iframe width does not trigger real width media queries the way a viewport does, and matchMedia inside the iframe does respond to iframe size, but UA-based mobile detection will not fire).

### Scavenge bonus stat rows (#stats-scavenge-bonus) [minor]
- location: src/game/systems/ui/UIOutHeaderSystem.js:248-256
- desktop: JS-generated label+value rows for scavenge bonus types appended to a container inside the player-stats area; part of the sidebar stats block.
- mobile risk: Lives only in the regular-layout sidebar flow; must be re-homed in a mobile header design.

**Notes:** Cross-cutting findings for the redesign: (1) The mobile header is not a complete mirror of the regular layout — deity bar, equipment stats, header item list, and header explorer list are commented out of #mobile-header (index.html:39-49, 67-75), and UIOutHeaderSystem.js:618 still toggles the nonexistent #list-header-items-mobile. A 100% parity claim must decide where these live on small screens. (2) Several of the heaviest interactive widgets exist only in JS string templates, never in index.html — the movement compass, outgoing caravan planner (the game's sole range-slider instance), worker table, recruits table, result-popup selection lists — so any redesign audit based on index.html alone under-counts. (3) Tab count is dynamic (2-11 tabs via UIOutTabBarSystem) and tab/button labels are swapped at runtime by the data-text-key localization system (strings/strings.json, strings-fi.json); fixed-width mobile chrome must tolerate both. (4) A mobile-test.html iframe harness already exists at repo root on this branch. (5) The popups lens cites css/modules/*.less paths and one nonexistent element (#log-overlay); .less sources under css/modules/ do not exist in this worktree (only compiled main.css + gridism.css + normalize.css), so those inventory locations should be re-anchored to main.css line numbers before the design doc is written.
