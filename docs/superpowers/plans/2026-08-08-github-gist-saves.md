# GitHub Gist Cloud Saves Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mirror the game's save slots to a GitHub Gist, so a save made on one machine can be loaded on another.

**Architecture:** All GitHub work lives in one new helper, `GistSaveHelper`, which touches the network and `localStorage` and never the DOM. Three existing UI systems call into it, and `SaveSystem` calls it once, after a local save has already succeeded. The helper is the only unit that knows a gist exists.

**Tech Stack:** Vanilla JS in AMD (requirejs) modules, jQuery, Ash ECS, `fetch`, the GitHub REST API v3.

**Spec:** `docs/superpowers/specs/2026-08-08-github-gist-saves-design.md`

## Global Constraints

- **Never type a real token into any field, and never commit one.** The token is the user's to enter. Where a live token is unavailable, stub `window.fetch` and assert the calls made.
- **The local save must never be at risk from the network.** The mirror runs only after `saveDataToSlot` has returned `success === true`, and its failure must never propagate.
- **The token never enters the save file.** It lives only under the `localStorage` key `github-token`.
- Never hand-edit `css/main.css`. Edit LESS, recompile with `npx -p less lessc css/main.less css/main.css`, commit both.
- Run `node --check <file>` after the LAST edit to a JS file, never before.
- Serve from a fresh port after every JS or CSS edit; modules are cached per `?v=`. Ports up to 8507 are already used.
- Mirror only the manual slots: `default`, `user1`, `user2`, `user3`. Never `backup` or `loaded`.
- Gist files are named `level13-<slotID>.txt`.
- Current version is `0.6.3.m59`. The final task bumps to `0.6.3.m60`.

## Harness Setup

As in the previous plan. Serve on a new port, seed `usersave.txt` into `localStorage` under `save-default` at `offline.html`, then load `mtest2.html` and wait ~30 s. Reach the game with:

```js
const w = document.querySelector('iframe').contentWindow;
const gg = w.require('game/GameGlobals');
gg.uiFunctions.showGame();
```

**Stubbing the network.** Every task below that touches GitHub is verified with a stub, so no real token is needed:

```js
w.__calls = [];
w.__stubFetch = (responder) => {
  w.__origFetch = w.fetch;
  w.fetch = (url, opts) => {
    w.__calls.push({ url: String(url), method: (opts && opts.method) || 'GET', body: opts && opts.body, auth: !!(opts && opts.headers && opts.headers.Authorization) });
    return Promise.resolve(responder(String(url), opts));
  };
};
w.__json = (status, obj) => ({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(obj), text: () => Promise.resolve(JSON.stringify(obj)) });
w.__restoreFetch = () => { w.fetch = w.__origFetch; };
```

## File Structure

| File | Responsibility |
|---|---|
| `src/game/helpers/GistSaveHelper.js` | **new** — every GitHub call, token and gist-id storage, the debounce. No DOM. |
| `src/game/GameGlobalsInitializer.js` | register the helper as `GameGlobals.gistSaveHelper` |
| `index.html` | settings section, `#github-setup-popup`, two manage-save buttons |
| `src/game/systems/ui/UIOutMetaPopupsSystem.js` | settings wiring, validate, status line, setup dialog |
| `src/game/systems/ui/UIOutManageSaveSystem.js` | cloud save and load buttons |
| `src/game/systems/SaveSystem.js` | the one mirror call |
| `css/modules/elements-special.less` | styles for the new settings rows and the dialog |

---

### Task 1: GistSaveHelper

The whole GitHub surface, with no UI. Everything later calls this.

**Files:**
- Create: `src/game/helpers/GistSaveHelper.js`
- Modify: `src/game/GameGlobalsInitializer.js` (three lines: the define entry, the callback arg, the construction)

**Interfaces:**
- Consumes: nothing
- Produces `GameGlobals.gistSaveHelper` with:
  - `getToken(): string|null`, `setToken(token: string): void`, `clearToken(): void`
  - `getGistId(): string|null`
  - `isConfigured(): boolean` — true when both a token and a gist id are stored
  - `isAutoMirrorEnabled(): boolean`, `setAutoMirrorEnabled(on: boolean): void`
  - `getFileNameForSlot(slotID: string): string` — returns `"level13-" + slotID + ".txt"`
  - `isMirroredSlot(slotID: string): boolean` — true only for `default`, `user1`, `user2`, `user3`
  - `validateAndSetup(token: string): Promise<{ok: boolean, gistId?: string, error?: string}>`
  - `saveSlot(slotID: string, data: string): Promise<{ok: boolean, error?: string}>`
  - `loadSlot(slotID: string): Promise<{ok: boolean, data?: string, updatedAt?: string, error?: string}>`
  - `mirrorSlot(slotID: string, data: string): void` — debounced, never throws, never returns
  - `getLastError(): string|null`

- [ ] **Step 1: Write the failing check**

Boot the harness and run:

```js
const w = document.querySelector('iframe').contentWindow;
const gg = w.require('game/GameGlobals');
typeof gg.gistSaveHelper
```

- [ ] **Step 2: Run it to confirm it fails**

Expected: `"undefined"`.

- [ ] **Step 3: Create the helper**

Create `src/game/helpers/GistSaveHelper.js` with exactly this content. The file uses TABS.

```js
// Cloud saves through a GitHub Gist.
//
// One secret gist holds one file per save slot, named level13-<slot>.txt. Writing needs a
// fine-grained token with the account permission Gists: read and write. Reading needs no
// token at all, because a secret gist is unlisted rather than private - which is also why
// this is not a privacy feature and the UI says so.
//
// Nothing here touches the DOM, and nothing here can fail in a way that reaches the local
// save: mirrorSlot swallows everything.
define(['ash', 'game/GameGlobals', 'game/constants/GameConstants'],
function (Ash, GameGlobals, GameConstants) {

	let GistSaveHelper = Ash.Class.extend({

		STORAGE_KEY_TOKEN: "github-token",
		STORAGE_KEY_GIST_ID: "github-gist-id",
		STORAGE_KEY_AUTO_MIRROR: "github-auto-mirror",

		API_ROOT: "https://api.github.com",
		GIST_DESCRIPTION: "Level 13 saves",

		// rapid manual saves must not each become a request; autosave is every 2 minutes
		// so this only ever bites on a burst
		MIRROR_MIN_INTERVAL_MS: 10000,

		lastError: null,
		pendingMirrors: null,
		lastMirrorTimestamps: null,

		constructor: function () {
			this.pendingMirrors = {};
			this.lastMirrorTimestamps = {};
		},

		getToken: function () {
			try { return localStorage.getItem(this.STORAGE_KEY_TOKEN) || null; } catch (ex) { return null; }
		},

		setToken: function (token) {
			try { localStorage.setItem(this.STORAGE_KEY_TOKEN, token); } catch (ex) { log.w("could not store token: " + ex); }
		},

		clearToken: function () {
			try {
				localStorage.removeItem(this.STORAGE_KEY_TOKEN);
				localStorage.removeItem(this.STORAGE_KEY_GIST_ID);
			} catch (ex) { log.w("could not clear token: " + ex); }
		},

		getGistId: function () {
			try { return localStorage.getItem(this.STORAGE_KEY_GIST_ID) || null; } catch (ex) { return null; }
		},

		setGistId: function (id) {
			try { localStorage.setItem(this.STORAGE_KEY_GIST_ID, id); } catch (ex) { log.w("could not store gist id: " + ex); }
		},

		isConfigured: function () {
			return !!this.getToken() && !!this.getGistId();
		},

		isAutoMirrorEnabled: function () {
			try { return localStorage.getItem(this.STORAGE_KEY_AUTO_MIRROR) == "true"; } catch (ex) { return false; }
		},

		setAutoMirrorEnabled: function (on) {
			try { localStorage.setItem(this.STORAGE_KEY_AUTO_MIRROR, on ? "true" : "false"); } catch (ex) { log.w("could not store auto mirror flag: " + ex); }
		},

		getFileNameForSlot: function (slotID) {
			return "level13-" + slotID + ".txt";
		},

		// the internal backup and loaded slots are the game's own bookkeeping, not saves a
		// player would look for on another machine
		isMirroredSlot: function (slotID) {
			switch (slotID) {
				case GameConstants.SAVE_SLOT_DEFAULT: return true;
				case GameConstants.SAVE_SLOT_USER_1: return true;
				case GameConstants.SAVE_SLOT_USER_2: return true;
				case GameConstants.SAVE_SLOT_USER_3: return true;
				default: return false;
			}
		},

		getLastError: function () {
			return this.lastError;
		},

		// validation creates the gist, because that exercises the one permission the
		// feature needs. Checking GET /gists instead would prove nothing: it is not
		// documented for fine-grained tokens and is known to misbehave with them.
		validateAndSetup: function (token) {
			let helper = this;
			if (!token) return Promise.resolve({ ok: false, error: "No token entered" });

			let body = {
				description: this.GIST_DESCRIPTION,
				public: false,
				files: { "level13-readme.txt": { content: "Level 13 save data. Created by the game." } }
			};

			return fetch(this.API_ROOT + "/gists", {
				method: "POST",
				headers: {
					"Authorization": "Bearer " + token,
					"Accept": "application/vnd.github+json",
					"Content-Type": "application/json"
				},
				body: JSON.stringify(body)
			}).then(function (response) {
				return response.json().then(function (json) {
					if (!response.ok) {
						let msg = (json && json.message) ? json.message : ("HTTP " + response.status);
						helper.lastError = msg;
						return { ok: false, error: msg };
					}
					helper.setToken(token);
					helper.setGistId(json.id);
					helper.lastError = null;
					return { ok: true, gistId: json.id };
				});
			}).catch(function (ex) {
				let msg = "Could not reach GitHub: " + ex;
				helper.lastError = msg;
				return { ok: false, error: msg };
			});
		},

		saveSlot: function (slotID, data) {
			let helper = this;
			if (!this.isConfigured()) return Promise.resolve({ ok: false, error: "Not set up" });

			let files = {};
			files[this.getFileNameForSlot(slotID)] = { content: data };

			return fetch(this.API_ROOT + "/gists/" + this.getGistId(), {
				method: "PATCH",
				headers: {
					"Authorization": "Bearer " + this.getToken(),
					"Accept": "application/vnd.github+json",
					"Content-Type": "application/json"
				},
				body: JSON.stringify({ files: files })
			}).then(function (response) {
				if (!response.ok) {
					return response.json().then(function (json) {
						let msg = (json && json.message) ? json.message : ("HTTP " + response.status);
						helper.lastError = msg;
						return { ok: false, error: msg };
					});
				}
				helper.lastError = null;
				return { ok: true };
			}).catch(function (ex) {
				let msg = "Could not reach GitHub: " + ex;
				helper.lastError = msg;
				return { ok: false, error: msg };
			});
		},

		// no Authorization header: a secret gist is readable by id, and fine-grained tokens
		// do not document a read endpoint
		loadSlot: function (slotID) {
			let helper = this;
			let gistId = this.getGistId();
			if (!gistId) return Promise.resolve({ ok: false, error: "Not set up" });

			let fileName = this.getFileNameForSlot(slotID);

			return fetch(this.API_ROOT + "/gists/" + gistId, {
				headers: { "Accept": "application/vnd.github+json" }
			}).then(function (response) {
				return response.json().then(function (json) {
					if (!response.ok) {
						let msg = (json && json.message) ? json.message : ("HTTP " + response.status);
						helper.lastError = msg;
						return { ok: false, error: msg };
					}
					let file = json.files ? json.files[fileName] : null;
					if (!file) {
						let msg = "No cloud save for this slot";
						helper.lastError = msg;
						return { ok: false, error: msg };
					}
					// the API inlines content only below 1MB; above that it sets truncated
					// and the real content is behind raw_url
					if (file.truncated && file.raw_url) {
						return fetch(file.raw_url).then(function (raw) {
							return raw.text();
						}).then(function (text) {
							helper.lastError = null;
							return { ok: true, data: text, updatedAt: json.updated_at };
						});
					}
					helper.lastError = null;
					return { ok: true, data: file.content, updatedAt: json.updated_at };
				});
			}).catch(function (ex) {
				let msg = "Could not reach GitHub: " + ex;
				helper.lastError = msg;
				return { ok: false, error: msg };
			});
		},

		// fire and forget. Anything that goes wrong here is recorded and then dropped: the
		// local save already succeeded and gameplay must not notice the network at all.
		mirrorSlot: function (slotID, data) {
			if (!this.isAutoMirrorEnabled()) return;
			if (!this.isConfigured()) return;
			if (!this.isMirroredSlot(slotID)) return;

			let helper = this;
			let now = new Date().getTime();
			let last = this.lastMirrorTimestamps[slotID] || 0;
			let sinceLast = now - last;

			if (sinceLast < this.MIRROR_MIN_INTERVAL_MS) {
				// coalesce: keep only the newest data, and let the timer already in flight send it
				let hadPending = !!this.pendingMirrors[slotID];
				this.pendingMirrors[slotID] = data;
				if (hadPending) return;
				setTimeout(function () {
					let pending = helper.pendingMirrors[slotID];
					delete helper.pendingMirrors[slotID];
					if (pending) helper.sendMirror(slotID, pending);
				}, this.MIRROR_MIN_INTERVAL_MS - sinceLast);
				return;
			}

			this.sendMirror(slotID, data);
		},

		sendMirror: function (slotID, data) {
			let helper = this;
			this.lastMirrorTimestamps[slotID] = new Date().getTime();
			try {
				this.saveSlot(slotID, data).then(function (result) {
					if (!result.ok) log.w("cloud mirror failed for [" + slotID + "]: " + result.error);
				});
			} catch (ex) {
				helper.lastError = String(ex);
				log.w("cloud mirror threw for [" + slotID + "]: " + ex);
			}
		},

	});

	return GistSaveHelper;
});
```

- [ ] **Step 4: Register the helper**

In `src/game/GameGlobalsInitializer.js`, three edits.

Add to the define list, immediately after the line `'game/helpers/SaveHelper',`:

```js
	'game/helpers/GistSaveHelper',
```

Add to the callback parameters, immediately after `SaveHelper,`:

```js
	GistSaveHelper,
```

Add the construction, immediately after the line `GameGlobals.saveHelper = new SaveHelper();`:

```js
				GameGlobals.gistSaveHelper = new GistSaveHelper();
```

The define list order and the callback parameter order MUST match, or every module after the insertion point receives the wrong object. Check that the position of `'game/helpers/GistSaveHelper'` among the define strings equals the position of `GistSaveHelper` among the parameters.

- [ ] **Step 5: Check syntax**

```bash
node --check src/game/helpers/GistSaveHelper.js && node --check src/game/GameGlobalsInitializer.js && echo SYNTAX_OK
```

Expected: `SYNTAX_OK`

- [ ] **Step 6: Verify on a fresh port with a stubbed network**

Install the stub from Harness Setup, then:

| Check | Expected |
|---|---|
| `typeof gg.gistSaveHelper` | `"object"` |
| `gg.gistSaveHelper.getFileNameForSlot("user1")` | `"level13-user1.txt"` |
| `gg.gistSaveHelper.isMirroredSlot("default")` | `true` |
| `gg.gistSaveHelper.isMirroredSlot("backup")` | `false` |
| `gg.gistSaveHelper.isMirroredSlot("loaded")` | `false` |
| `gg.gistSaveHelper.isConfigured()` | `false` before setup |

Then exercise validation against the stub:

```js
w.__stubFetch((url, opts) => w.__json(201, { id: 'abc123' }));
gg.gistSaveHelper.validateAndSetup('fake-token-for-test').then(r => { w.__r = r; });
```

Read back in a second call: `w.__r` must be `{ok: true, gistId: 'abc123'}`, `gg.gistSaveHelper.getGistId()` must be `'abc123'`, and `w.__calls[0]` must show `method: 'POST'`, a url ending `/gists`, and `auth: true`.

Then the failure path:

```js
w.__stubFetch((url, opts) => w.__json(403, { message: 'Resource not accessible by personal access token' }));
gg.gistSaveHelper.validateAndSetup('bad').then(r => { w.__r2 = r; });
```

`w.__r2.ok` must be `false` and `w.__r2.error` must be the API's own message. Finish with `w.__restoreFetch()`.

- [ ] **Step 7: Commit**

```bash
git add src/game/helpers/GistSaveHelper.js src/game/GameGlobalsInitializer.js
git commit -m "Add a helper for cloud saves through a GitHub Gist"
```

---

### Task 2: Settings section and setup dialog

**Files:**
- Modify: `index.html` (a settings block before `#hotkeys-list`, and a new `#github-setup-popup` before `#dialogue-popup`)
- Modify: `src/game/systems/ui/UIOutMetaPopupsSystem.js`
- Modify: `css/modules/elements-special.less`, then recompile `css/main.css`

**Interfaces:**
- Consumes: `GameGlobals.gistSaveHelper` — `getToken`, `setToken`, `clearToken`, `isConfigured`, `isAutoMirrorEnabled`, `setAutoMirrorEnabled`, `validateAndSetup`
- Produces: DOM ids `#settings-github-token`, `#btn-settings-github-validate`, `#settings-github-status`, `#btn-settings-github-help`, `#settings-checkbox-github-auto`, `#github-setup-popup`, `#github-setup-popup-close`; and `UIOutMetaPopupsSystem.updateGithubSettings()`

- [ ] **Step 1: Write the failing check**

```js
const d = document.querySelector('iframe').contentWindow.document;
({ field: !!d.getElementById('settings-github-token'), dialog: !!d.getElementById('github-setup-popup') })
```

- [ ] **Step 2: Run it to confirm it fails**

Expected: `{field: false, dialog: false}`.

- [ ] **Step 3: Add the settings block**

In `index.html`, inside `#settings-popup`, immediately before the line `<div id="hotkeys-list" class="scrollable-container"></div>`:

```html
			<div id="settings-github" class="settings-group">
				<p class="settings-group-header">Cloud saves</p>
				<span class="settings-entry">
					<input type="password" id="settings-github-token" placeholder="GitHub token" autocomplete="off" />
					<button id="btn-settings-github-validate">Save and validate</button>
				</span>
				<p id="settings-github-status" class="p-meta">Not set up</p>
				<span class="settings-entry">
					<input type="checkbox" class="checkbox" id="settings-checkbox-github-auto" /><p class="checkbox-label">Mirror every save automatically</p>
				</span>
				<button id="btn-settings-github-help">How do I get a token?</button>
			</div>
```

- [ ] **Step 4: Add the setup dialog**

In `index.html`, immediately before the line beginning `<div id="dialogue-popup"`:

```html
		<div id="github-setup-popup" role="dialog" class="popup fill-on-mobiles hidden-by-default popup-ingame" style="display: none" aria-labelledby="github-setup-popup-header" aria-modal="true">
			<h3 id="github-setup-popup-header">Set up cloud saves</h3>
			<div id="github-setup-steps" class="scrollable-container">
				<p>Cloud saves keep a copy of your save in a GitHub Gist, so you can pick the game up on another machine.</p>
				<p class="warning">The gist is <em>secret</em>, which means unlisted rather than private. Anyone with the link can read it. It holds a compressed game state and nothing personal, but it is not protected.</p>
				<ol>
					<li>On GitHub, open your profile picture menu and choose <strong>Settings</strong>.</li>
					<li>In the left sidebar, choose <strong>Developer settings</strong>.</li>
					<li>Under Personal access tokens, choose <strong>Fine-grained tokens</strong>, then <strong>Generate new token</strong>.<br/><span class="p-meta">Direct link: <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com/settings/personal-access-tokens/new</a></span></li>
					<li>Give it a <strong>Token name</strong>, for example <em>level13 saves</em>.</li>
					<li>Set an <strong>Expiration</strong>. When it expires, saving stops working until you make a new one.</li>
					<li>Leave <strong>Resource owner</strong> as your own account.</li>
					<li>Open <strong>Permissions</strong>, find <strong>Account permissions</strong>, and set <strong>Gists</strong> to <strong>Read and write</strong>.</li>
					<li>Press <strong>Generate token</strong> and copy it. GitHub shows it once and never again.</li>
					<li>Paste it into the token box in Settings and press <strong>Save and validate</strong>.</li>
				</ol>
				<p class="p-meta">Validating creates one secret gist called "Level 13 saves". Each save slot becomes a file inside it.</p>
			</div>
			<div class="buttonbox">
				<button id="github-setup-popup-close" class="button-popup-default">Close</button>
			</div>
		</div>
```

- [ ] **Step 5: Wire it up**

In `src/game/systems/ui/UIOutMetaPopupsSystem.js`, in the same place the other settings inputs are bound (beside `$("#settings-checkbox-hotkeys-enabled").change(...)`), add:

```js
			$("#btn-settings-github-validate").click(() => sys.onGithubValidateClicked());
			$("#btn-settings-github-help").click(() => GameGlobals.uiFunctions.showSpecialPopup("github-setup-popup", { isMeta: true, isDismissable: true }));
			$("#github-setup-popup-close").click(() => GameGlobals.uiFunctions.popupManager.closePopup("github-setup-popup"));
			$("#settings-checkbox-github-auto").change(() => {
				GameGlobals.gistSaveHelper.setAutoMirrorEnabled($("#settings-checkbox-github-auto").is(":checked"));
			});
```

Then add these two methods to the same object, immediately before `saveSettings: function () {`:

```js
		onGithubValidateClicked: function () {
			let sys = this;
			let token = $("#settings-github-token").val();
			$("#settings-github-status").text("Checking...");
			GameGlobals.gistSaveHelper.validateAndSetup(token).then(function (result) {
				if (result.ok) {
					// the token is never shown again, the same way GitHub treats it
					$("#settings-github-token").val("");
				}
				sys.updateGithubSettings();
			});
		},

		updateGithubSettings: function () {
			let helper = GameGlobals.gistSaveHelper;
			let isConfigured = helper.isConfigured();
			let status = isConfigured ? "Connected. Saves go to gist " + helper.getGistId() : (helper.getLastError() || "Not set up");
			$("#settings-github-status").text(status);
			$("#settings-checkbox-github-auto").prop("disabled", !isConfigured);
			$("#settings-checkbox-github-auto").prop("checked", helper.isAutoMirrorEnabled());
		},
```

Finally, call `this.updateGithubSettings();` on the line immediately after the existing `$("#settings-checkbox-hotkeys-enabled").prop("checked", ...)` line, so the section is correct every time the popup opens.

- [ ] **Step 6: Add the styles**

Append to `css/modules/elements-special.less`:

```less
// CLOUD SAVES (settings section and setup dialog)

.settings-group {
	margin: 10px 0;
}

.settings-group-header {
	font-weight: bold;
	margin-bottom: 4px;
}

#settings-github-token {
	min-width: 180px;
	margin-right: 6px;
}

#settings-github-status {
	margin: 4px 0 8px 0;
	word-break: break-all;
}

#github-setup-steps {
	max-height: 55vh;
	overflow-y: auto;
	text-align: left;
}

#github-setup-steps ol {
	margin: 8px 0 8px 18px;
	list-style: decimal outside;
}

#github-setup-steps li {
	margin-bottom: 6px;
}
```

Recompile:

```bash
npx -p less lessc css/main.less css/main.css && grep -c "github-setup-steps" css/main.css
```

Expected: at least `2` (once per theme block).

- [ ] **Step 7: Check syntax**

```bash
node --check src/game/systems/ui/UIOutMetaPopupsSystem.js && echo SYNTAX_OK
```

- [ ] **Step 8: Verify on a fresh port**

| Check | Expected |
|---|---|
| the Step 1 check | `{field: true, dialog: true}` |
| open settings, read `#settings-github-status` | `Not set up` |
| `#settings-checkbox-github-auto` disabled | `true` |
| click `#btn-settings-github-help` | the dialog opens with 9 numbered steps |
| the dialog's warning paragraph | states the gist is unlisted, not private |

Then, with the stub returning `w.__json(201, {id:'abc123'})`, put a dummy string in the field and click validate: the status must become `Connected. Saves go to gist abc123`, the field must be cleared, and the auto checkbox must become enabled. With the stub returning a 403 and a `message`, the status must show that message.

- [ ] **Step 9: Commit**

```bash
git add index.html src/game/systems/ui/UIOutMetaPopupsSystem.js css/modules/elements-special.less css/main.css
git commit -m "Add the cloud saves settings section and its setup dialog"
```

---

### Task 3: Save and load buttons in manage saves

**Files:**
- Modify: `index.html` (two buttons inside `#save-list-options-selected`)
- Modify: `src/game/systems/ui/UIOutManageSaveSystem.js`

**Interfaces:**
- Consumes: `GameGlobals.gistSaveHelper` — `isConfigured`, `saveSlot`, `loadSlot`, `isMirroredSlot`; and the existing `this.selectedSaveSlot`
- Produces: DOM ids `#btn-save-list-options-cloud-save`, `#btn-save-list-options-cloud-load`

- [ ] **Step 1: Write the failing check**

```js
const d = document.querySelector('iframe').contentWindow.document;
({ save: !!d.getElementById('btn-save-list-options-cloud-save'), load: !!d.getElementById('btn-save-list-options-cloud-load') })
```

- [ ] **Step 2: Run it to confirm it fails**

Expected: `{save: false, load: false}`.

- [ ] **Step 3: Add the buttons**

In `index.html`, immediately after the line `<button id="btn-save-list-options-export">Export</button>`:

```html
						<button id="btn-save-list-options-cloud-save" class="hidden-by-default">Save to GitHub</button>
						<button id="btn-save-list-options-cloud-load" class="hidden-by-default">Load from GitHub</button>
```

- [ ] **Step 4: Wire them up**

In `src/game/systems/ui/UIOutManageSaveSystem.js`, immediately after the existing `$("#btn-save-list-options-export").click(...)` block, add:

```js
			$("#btn-save-list-options-cloud-save").click(function (e) {
				GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.buttonClicked);
				system.cloudSaveSelectedSlot();
			});
			$("#btn-save-list-options-cloud-load").click(function (e) {
				GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.buttonClicked);
				system.cloudLoadSelectedSlot();
			});
```

Then add these three methods to the same object, immediately before `refresh: function () {`:

```js
		updateCloudButtons: function () {
			let slotID = this.selectedSaveSlot;
			let helper = GameGlobals.gistSaveHelper;
			let show = !!slotID && helper.isConfigured() && helper.isMirroredSlot(slotID);
			GameGlobals.uiFunctions.toggle("#btn-save-list-options-cloud-save", show);
			GameGlobals.uiFunctions.toggle("#btn-save-list-options-cloud-load", show);
		},

		cloudSaveSelectedSlot: function () {
			let slotID = this.selectedSaveSlot;
			if (!slotID) return;
			// the raw compressed string, exactly what localStorage holds and what the gist wants
			let data = this.getSaveSystem().getDataFromSlot(slotID);
			if (!data) {
				GameGlobals.uiFunctions.showInfoPopup("Cloud save", "That slot is empty.", "OK", null, null, false, true);
				return;
			}
			GameGlobals.gistSaveHelper.saveSlot(slotID, data).then(function (result) {
				let msg = result.ok ? "Saved to GitHub." : ("Could not save: " + result.error);
				GameGlobals.uiFunctions.showInfoPopup("Cloud save", msg, "OK", null, null, false, true);
			});
		},

		// loading overwrites a local slot, so the player sees both timestamps first
		cloudLoadSelectedSlot: function () {
			let slotID = this.selectedSaveSlot;
			if (!slotID) return;
			let system = this;
			GameGlobals.gistSaveHelper.loadSlot(slotID).then(function (result) {
				if (!result.ok) {
					GameGlobals.uiFunctions.showInfoPopup("Cloud load", "Could not load: " + result.error, "OK", null, null, false, true);
					return;
				}
				let localData = system.getSaveSlotData(slotID);
				let localDate = localData && localData.date ? system.getDateDisplayString(localData.date) : "empty";
				let msg = "Overwrite this slot with the cloud save?<br/><br/>";
				msg += "<span class='p-meta'>cloud: " + result.updatedAt + "<br/>local: " + localDate + "</span>";
				GameGlobals.uiFunctions.showConfirmation(msg, function () {
					// saveDataToSlot owns the storage-key rule, including the legacy "save"
					// key the default slot also writes. Do not hand-roll those keys here.
					system.getSaveSystem().saveDataToSlot(slotID, result.data);
					system.refresh();
					GameGlobals.uiFunctions.showInfoPopup("Cloud load", "Slot updated. Load it from the list to play it.", "OK", null, null, false, true);
				}, false, true);
			});
		},
```

Then call `this.updateCloudButtons();` on the line immediately after the existing `$("#save-list-options-info").html(slotInfoText);` line, so the buttons follow the selected slot.

- [ ] **Step 5: Check syntax**

```bash
node --check src/game/systems/ui/UIOutManageSaveSystem.js && echo SYNTAX_OK
```

- [ ] **Step 6: Verify on a fresh port**

With no token stored: open manage saves, select a slot, and both cloud buttons must be hidden.

Then set up against the stub (`validateAndSetup` returning `{id:'abc123'}`), reopen, and select the `default` slot: both buttons must appear. Select an unmirrored slot if one is selectable: they must hide again.

Stub a `PATCH` returning `w.__json(200, {})` and press Save to GitHub: `w.__calls` must show `method: 'PATCH'`, a url ending `/gists/abc123`, `auth: true`, and a body whose `files` key is `level13-default.txt`.

Stub a `GET` returning `w.__json(200, { updated_at: '2026-08-08T00:00:00Z', files: { 'level13-default.txt': { content: 'CLOUDDATA' } } })` and press Load from GitHub: a confirmation must appear showing both timestamps, and confirming must set `localStorage['save-default']` to `CLOUDDATA`. Check that the `GET` call has `auth: false`.

- [ ] **Step 7: Commit**

```bash
git add index.html src/game/systems/ui/UIOutManageSaveSystem.js
git commit -m "Add cloud save and load buttons to manage saves"
```

---

### Task 4: The auto-mirror hook

**Files:**
- Modify: `src/game/systems/SaveSystem.js` (inside `save`)

**Interfaces:**
- Consumes: `GameGlobals.gistSaveHelper.mirrorSlot(slotID, data)`
- Produces: nothing new

- [ ] **Step 1: Write the failing check**

With the stub installed, auto-mirror on and a gist id stored, call a save and count the requests:

Reach the save system the same way `UIOutManageSaveSystem.getSaveSystem` does — through the
engine:

```js
const SaveSystem = w.require('game/systems/SaveSystem');
const saveSystem = gg.engine.getSystem(SaveSystem);
w.__calls = [];
gg.gistSaveHelper.setAutoMirrorEnabled(true);
saveSystem.save('default', true);   // true = player initiated, so the autosave guards are skipped
w.__calls.filter(c => c.method === 'PATCH').length
```

- [ ] **Step 2: Run it to confirm it fails**

Expected: `0` — nothing mirrors yet.

- [ ] **Step 3: Add the hook**

In `src/game/systems/SaveSystem.js`, in `save`, find these two lines:

```js
			let data = this.getCompressedSaveJSON();
			let success = this.saveDataToSlot(slotID, data);
```

and insert immediately after them:

```js

			// mirror only once the local save is safely written. The helper swallows its own
			// failures: a network problem must never reach the save the player just made
			if (success) GameGlobals.gistSaveHelper.mirrorSlot(slotID, data);
```

`GameGlobals` is already the second entry in this file's `define` list, so no import is needed. Do not add one — changing that list would reorder every callback parameter after it.

- [ ] **Step 4: Check syntax**

```bash
node --check src/game/systems/SaveSystem.js && echo SYNTAX_OK
```

- [ ] **Step 5: Verify on a fresh port**

| Check | Expected |
|---|---|
| auto-mirror OFF, save | no `PATCH` at all |
| auto-mirror ON, save `default` | exactly one `PATCH` to `/gists/abc123` |
| two saves inside 10 s | still one `PATCH`; the second coalesces |
| save the `backup` slot with auto-mirror ON | no `PATCH` |
| stub `fetch` to reject, then save | `localStorage['save-default']` still updated, no error popup, game still playable |

That last row is the one that matters most: run it deliberately, not by inspection.

- [ ] **Step 6: Commit**

```bash
git add src/game/systems/SaveSystem.js
git commit -m "Mirror a save to the cloud once it is safely on disk"
```

---

### Task 5: Release

**Files:**
- Modify: `src/config.js:30`, `index.html:34`, `changelog.html`, `sw.js:15`, `changelog.json`

- [ ] **Step 1: Run the acceptance list**

All eight items from the spec's Verification section, on a fresh port.

- [ ] **Step 2: Bump all four cache busters to `0.6.3.m60`**

`src/config.js` `urlArgs`, the `?v=` queries in `index.html` AND `changelog.html`, and `CACHE_VERSION` in `sw.js`. All four move together or the deploy serves stale modules.

```bash
grep -rn "0\.6\.3\.m59" --include=*.js --include=*.html . | grep -v "^./.git\|docs/\|changelog.json"
```

Expected after the edits: no output.

- [ ] **Step 3: Add the changelog entry**

Insert as the FIRST element of the `versions` array in `changelog.json`, by hand as text. Do NOT rewrite the file with a JSON serialiser — `json.dump` reformats all 1600 lines and buries the change.

```json
        {
            "version": "0.6.3.m60",
            "requiredVersion": "0.6.1",
            "phase": "beta",
            "final": true,
            "released": "2026-08-08",
            "changes": [
                {
                    "type": "UI",
                    "summary": "Saves can be kept in a GitHub Gist and loaded on another machine, set up with a token in settings"
                }
            ]
        },
```

Validate, and confirm the diff is small:

```bash
python3 -c "import json; print(json.load(open('changelog.json'))['versions'][0]['version'])"
git diff changelog.json | grep -c "^[+-]"
```

Expected: `0.6.3.m60`, and a diff count under 20.

- [ ] **Step 4: Commit**

```bash
git add src/config.js index.html changelog.html sw.js changelog.json
git commit -m "Release 0.6.3.m60"
```

---

## Out of scope

Encrypting the save. Conflict merging beyond the timestamp confirmation. Syncing anything other than save slots. Any non-gist backend. Do not type a real token into any field.
