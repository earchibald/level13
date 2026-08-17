# Candidate-only dev functions

Dev functions turn on for the mobile candidate at `earchibald.github.io/level13-mobile`
and stay off for the release at `earchibald.github.io/level13`. Detection is at runtime
by URL path, so the two deploy branches stay byte-identical.

| Item | Decision |
|---|---|
| Flags enabled on the candidate | `isCheatsEnabled`, `isDebugOutputEnabled` |
| Flag deliberately NOT enabled | `isDebugVersion` |
| Detection | `window.location.pathname` prefix, plus localhost |
| Files changed | `src/game/constants/GameConstants.js`, `src/level13-app.js` |
| File NOT changed | `src/config.js` |
| Branch | `gh-pages-mobile` only |

## Problem

The release and the candidate are the same content. `gh-pages` and `gh-pages-mobile`
are byte-identical on purpose: promoting the candidate is a fast-forward, and the
deploy workflow header says a per-branch difference would conflict on every promotion.

Dev functions are gated by three flags in `src/config.js`. All three are `false` on both
branches, so the release is already dark. The real requirement is the inverse of the
original phrasing: light the candidate up, leave the release as it is.

A config edit on one branch cannot do this. It would break the fast-forward invariant.
The switch has to be a runtime check on where the build is deployed.

## Why `isDebugVersion` stays off

`isDebugVersion` is not a display flag. It changes how the game behaves:

- `GameManager.js:409` cuts worldgen retries from 10 to 1, so world generation differs.
- Seven `debugger` statements fire (`PlayerHelper` x2, `DialogueSystem` x3, `PopulationSystem`,
  `Text.js`). Each halts the game whenever devtools are open.
- `ChangeLogHelper.js:52` early-returns, so changelog handling diverges.
- The language selector and hidden stat categories become visible.

`gh-pages-mobile` is the release candidate. It is the build tested before the
fast-forward into the release. A candidate that generates worlds differently from the
release is not testing the release. So `isDebugVersion` stays off on both sites.

`isCheatsEnabled` and `isDebugOutputEnabled` do not have this problem. Cheats are inert
until invoked. Debug output only writes to the console.

If the `isDebugVersion` surface is wanted later, add it as an explicit opt-in — a `?dev=1`
param or a settings toggle, default off — so the candidate still behaves like the release
until deliberately switched over. That is out of scope here.

## Design

### Detection

Add one function to `src/game/constants/GameConstants.js`, after `gameURL` (line 33) and
before `getFeedbackLinksHTML`:

```js
// The candidate is deployed to earchibald.github.io/level13-mobile and the release
// to earchibald.github.io/level13. Same host, so the path is what tells them apart.
// Local work counts as a candidate, which is why config.js never needs hand-editing
// to get cheats during development.
isCandidateBuild: function () {
    let host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "") return true;
    return window.location.pathname.indexOf("/level13-mobile") === 0;
},
```

`/level13/` does not start with `/level13-mobile`, so the release does not match. The
empty-host case covers `file://`.

### Flag resolution

Change the config-to-GameConstants block in `src/level13-app.js` (lines 23-26):

```js
let isCandidateBuild = GameConstants.isCandidateBuild();

GameConstants.isDebugVersion = config.isDebugVersion;
GameConstants.isCheatsEnabled = config.isCheatsEnabled || isCandidateBuild;
GameConstants.isAutosaveEnabled = config.isAutosaveEnabled;
ConsoleLogger.logInfo = config.isDebugOutputEnabled || isCandidateBuild;
```

`isDebugVersion` keeps its plain assignment. `||` rather than assignment on the other two
means `config.js` can still force a flag on everywhere if that is ever wanted.

This block already runs before `new Level13(...)`, so `CheatSystem` registration and the
`window.app` handle read the resolved value. No ordering change is needed.

### Scope boundaries

`tools.html` is the upstream player-facing repair page, linked from the game as a help
resource. `GistSaveHelper` is a player cloud-save feature. Neither is a dev function.
Both are out of scope.

## Deployment

`src/config.js` is not edited, so both branches stay byte-identical and promotion
remains a fast-forward.

Both edited files are bundled, so `node build.js` must run and `build/level13-app.js` is
committed alongside them.

Bump the fourth digit of the top `changelog.json` entry so deploy propagation can be
confirmed.

Push order, from the deploy workflow header:

1. `git push origin gh-pages-mobile` — source of truth, deploys nothing
2. `git push mobile gh-pages-mobile` — candidate site
3. fast-forward and `git push origin gh-pages` — release site

## Out of scope

- `master` is the diverged 0.7.1 line and does not feed these deploys. It does not get
  this change.
- The uncommitted `isCheatsEnabled: true` in `master`'s working-tree `src/config.js` is
  left alone. This design makes that hand-edit unnecessary on the `gh-pages` line, but
  `master` is a separate line.

## Verification

| Where | Expected |
|---|---|
| `/level13-mobile` | `window.app` defined; `log.i` output in console |
| `/level13` | `window.app` undefined; console quiet |
| localhost | cheats on without editing `config.js` |
