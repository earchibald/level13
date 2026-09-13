# Auto-scavenge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** An explorer ability that keeps scavenging for the player, with a pre-update save backup popup, released as 0.7.0.m1.

**Architecture:** One new Ash system polls the scavenge cooldown and starts the action; the ability is one new enum value; the UI is one new button and one hotkey. The backup popup lives with the manage-save code.

**Tech Stack:** RequireJS AMD, Ash, jQuery, LESS.

## Global Constraints

- Work in `~/Worktrees/level13-gh-pages-mobile` only.
- Stamp 0.7.0.m1 in changelog.json, src/config.js, index.html (3 css links), changelog.html, sw.js in one commit. Keep `requiredVersion` at 0.6.1.
- Recompile `css/main.css`, rebuild `build/level13-app.js`.
- Push to `origin` and `mobile`.

### Task 1: Ability type
Files: `src/game/constants/ExplorerConstants.js`, `strings/strings.json`.
- Add `AUTO_SCAVENGE: "auto_scavenge"` under the scavenger comment.
- Map to SCAVENGER; unlock ordinal 2.
- Add name and description strings.

### Task 2: AutoScavengeSystem
Files: `src/game/systems/AutoScavengeSystem.js` (new), `src/game/GlobalSignals.js`, `src/game/GameState.js`, `src/game/level13.js`, `src/game/PlayerActionFunctions.js`.
- Signals, uiStatus flag + reset, system registration, popup skip in `scavenge`.

### Task 3: Button, hotkey, styles
Files: `index.html`, `src/game/UIFunctions.js`, `src/game/systems/ui/UIOutLevelSystem.js`, `css/modules/elements-buttons.less`.

### Task 4: Pre-update backup popup
Files: `src/game/systems/GameManager.js`, `src/game/systems/ui/UIOutManageSaveSystem.js`, `index.html`, `src/game/constants/GameConstants.js`.

### Task 5: Playwright test, release stamp, build, push
