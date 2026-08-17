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
		STORAGE_KEY_LAST_SEEN: "github-gist-last-revision",
		// every revision this device is known to have made or read, and a fingerprint
		// of the last thing it tried to push. Both exist to answer one question - is
		// the cloud ahead of us because of US? - see isOwnCloudState.
		STORAGE_KEY_OWN_REVISIONS: "github-gist-own-revisions",
		STORAGE_KEY_PUSHED_PREFIX: "github-gist-pushed-",
		// what this device calls itself. Local, like the token: it says which device
		// wrote the cloud save, so "a save from another device" can name the device.
		STORAGE_KEY_DEVICE_NAME: "github-gist-device-name",

		// one small file beside the saves, rewritten with every push, holding who wrote
		// last and when. Not part of any save: nothing reads it to play the game.
		META_FILE_NAME: "level13-meta.json",
		README_FILE_NAME: "level13-readme.txt",

		// enough to cover a session's worth of writes. The list only has to outlive the
		// gap between a write and the next check, and a stale entry costs nothing: a
		// revision this device really did make is its own write however old the entry is
		MAX_OWN_REVISIONS: 30,

		API_ROOT: "https://api.github.com",
		GIST_DESCRIPTION: "Level 13 saves",

		// rapid manual saves must not each become a request; autosave is every 2 minutes
		// so this only ever bites on a burst
		MIRROR_MIN_INTERVAL_MS: 10000,

		lastError: null,
		hasConflict: false,
		syncState: "idle",
		syncStateAt: null,
		pendingMirrors: null,
		lastMirrorTimestamps: null,
		pendingMirrorTimers: null,
		writeQueue: null,

		constructor: function () {
			this.pendingMirrors = {};
			this.lastMirrorTimestamps = {};
			this.pendingMirrorTimers = {};
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

		getLastSeenRevision: function () {
			try { return localStorage.getItem(this.STORAGE_KEY_LAST_SEEN) || null; } catch (ex) { return null; }
		},

		setLastSeenRevision: function (revision) {
			try { localStorage.setItem(this.STORAGE_KEY_LAST_SEEN, revision || ""); } catch (ex) { log.w("could not store last seen: " + ex); }
		},

		// The revisions this device made. A gist revision is a commit SHA, so this is an
		// exact record of "we did that one" - no timestamps, no ordering, no guessing.
		getOwnRevisions: function () {
			try {
				let raw = localStorage.getItem(this.STORAGE_KEY_OWN_REVISIONS);
				let list = raw ? JSON.parse(raw) : [];
				return Array.isArray(list) ? list : [];
			} catch (ex) { return []; }
		},

		addOwnRevision: function (revision) {
			if (!revision) return;
			let list = this.getOwnRevisions();
			if (list.indexOf(revision) >= 0) return;
			list.push(revision);
			while (list.length > this.MAX_OWN_REVISIONS) list.shift();
			try { localStorage.setItem(this.STORAGE_KEY_OWN_REVISIONS, JSON.stringify(list)); } catch (ex) { log.w("could not store own revisions: " + ex); }
		},

		isOwnRevision: function (revision) {
			return !!revision && this.getOwnRevisions().indexOf(revision) >= 0;
		},

		// everything this device knows about what it wrote, dropped. Only for changing
		// gist: the knowledge is about one gist and means nothing about another.
		forgetOwnHistory: function () {
			let helper = this;
			try {
				localStorage.removeItem(this.STORAGE_KEY_OWN_REVISIONS);
				[GameConstants.SAVE_SLOT_DEFAULT, GameConstants.SAVE_SLOT_USER_1, GameConstants.SAVE_SLOT_USER_2, GameConstants.SAVE_SLOT_USER_3].forEach(function (slotID) {
					localStorage.removeItem(helper.STORAGE_KEY_PUSHED_PREFIX + slotID);
				});
			} catch (ex) { log.w("could not clear own history: " + ex); }
		},

		// A cheap content fingerprint. Two 32-bit FNV-1a hashes with different offset
		// bases, plus the length: enough to tell one save blob from another, and far
		// too little to reconstruct anything from. It is only ever compared with a
		// fingerprint this same device wrote.
		getFingerprint: function (text) {
			if (typeof text !== "string") return null;
			let a = 0x811c9dc5, b = 0x01000193;
			for (let i = 0; i < text.length; i++) {
				let c = text.charCodeAt(i);
				a = Math.imul(a ^ c, 0x01000193);
				b = Math.imul(b ^ c, 0x85ebca6b);
			}
			return text.length + "-" + (a >>> 0).toString(16) + "-" + (b >>> 0).toString(16);
		},

		getPushedFingerprint: function (slotID) {
			try { return localStorage.getItem(this.STORAGE_KEY_PUSHED_PREFIX + slotID) || null; } catch (ex) { return null; }
		},

		setPushedFingerprint: function (slotID, fingerprint) {
			try { localStorage.setItem(this.STORAGE_KEY_PUSHED_PREFIX + slotID, fingerprint || ""); } catch (ex) { log.w("could not store pushed fingerprint: " + ex); }
		},

		// The cloud is not where this device left it. That is only news if somebody ELSE
		// moved it, and there are three ordinary ways for this device to have moved it
		// without knowing:
		//
		//  - the write landed and the answer did not. A phone that is backgrounded, or
		//    an app closed mid-push, leaves GitHub holding a commit this device never
		//    learned the SHA of. Every check afterwards reads that as another device.
		//  - two slots pushed at once. The rate limit is per slot, so two writes can be
		//    in flight together; GitHub serialises them into two commits and whichever
		//    answer arrives last decides the marker, which can be the earlier of the two.
		//  - the read was stale. Anonymous gist reads go through a cache that can still
		//    be showing the state from before this device's own write.
		//
		// So ask whether this device made the head, rather than assuming it did not. The
		// revision list answers the last two outright. For the first there is no SHA to
		// compare, so compare the content instead: the fingerprint is recorded BEFORE
		// the push goes out, which is exactly the case where the answer never came back.
		isOwnCloudState: function (state, slotID) {
			let helper = this;
			if (!state || !state.revision) return Promise.resolve(false);
			if (this.isOwnRevision(state.revision)) return Promise.resolve(true);

			// The revision is the gist's, the fingerprint is one slot's. So a head another
			// device made by writing a DIFFERENT slot reads as ours here. That is the safe
			// way round: this device goes on writing its own slot, which was never in
			// question, and touches nothing the other device wrote.
			let pushed = this.getPushedFingerprint(slotID);
			if (!pushed) return Promise.resolve(false);

			return this.fetchSlotContent(slotID).then(function (result) {
				if (!result.ok) return false;
				let isOurs = helper.getFingerprint(result.data) === pushed;
				// remember the SHA too, so the next check costs nothing
				if (isOurs) helper.addOwnRevision(state.revision);
				return isOurs;
			}).catch(function () { return false; });
		},

		// another device has written since this one last synced
		isInConflict: function () {
			return this.hasConflict;
		},

		// the player has chosen a side, so pushing may resume
		resolveConflict: function (revision) {
			this.hasConflict = false;
			this.setLastSeenRevision(revision);
			// a revision the player has accepted is settled, and must never come back as
			// a question - so it counts as this device's own from here on
			this.addOwnRevision(revision);
			this.lastError = null;
		},

		// The conflict flag must not latch. mirrorSlot refuses to push while it is set, and
		// clearing it used to require a push to succeed - so once set it could never clear
		// itself, and a device stayed stuck long after the cloud and the marker agreed
		// again. Whenever a check observes agreement, the conflict is over by definition.
		clearConflictIfResolved: function () {
			if (!this.hasConflict) return;
			this.hasConflict = false;
			this.lastError = null;
			this.setSyncState("synced");
		},

		// A gist is readable by id without a token, so reads work whatever the token is
		// doing. Send it when there is one anyway: an anonymous read is served from a
		// cache that can still be showing the state from before this device's own write,
		// and this device then reads its own save as somebody else's.
		//
		// `cache: no-store` only governs the BROWSER's cache and cannot reach that one.
		getReadHeaders: function () {
			let headers = { "Accept": "application/vnd.github+json" };
			let token = this.getToken();
			if (token) headers["Authorization"] = "Bearer " + token;
			return headers;
		},

		// read just the gist's updated_at, for the guard and the arrival check
		fetchGistState: function () {
			let helper = this;
			let gistId = this.getGistId();
			if (!gistId) return Promise.resolve({ ok: false, error: "Not set up" });
			return fetch(this.API_ROOT + "/gists/" + gistId, {
				// always hit the network: a stale updated_at would let this device believe
				// the cloud has not moved when it has, which is the exact stomp the guard exists
				// to prevent. An installed PWA caches these hard otherwise.
				cache: "no-store",
				headers: this.getReadHeaders()
			}).then(function (response) {
				if (!response.ok) {
					return helper.getErrorMessage(response).then(function (msg) {
						return { ok: false, error: msg };
					});
				}
				return response.json().then(function (json) {
					// a gist is a git repo: history[0].version is the SHA of the current
					// revision. That is an exact identity for one state of the gist, unlike
					// a timestamp, which is only equal by assumption across endpoints
					let revision = (json.history && json.history.length > 0) ? json.history[0].version : null;
					return { ok: true, revision: revision, updatedAt: json.updated_at, meta: helper.parseMeta(json), fileNames: json.files ? Object.keys(json.files) : [] };
				});
			}).catch(function (ex) {
				return { ok: false, error: "Could not reach GitHub: " + ex };
			});
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

		// the gist holds a readme and a meta file beside the saves, and neither is one.
		// Counting them as saves is how an empty cloud looks occupied.
		isSaveFileName: function (name) {
			if (!name || name.indexOf("level13-") !== 0) return false;
			return name !== this.README_FILE_NAME && name !== this.META_FILE_NAME;
		},

		// A name for this device, so the cloud can say who wrote last. Made up on first
		// use from what the browser admits to, with a short suffix because two phones of
		// the same make would otherwise share one name. The player can rename it in
		// settings - that is the whole point of showing it.
		getDeviceName: function () {
			try {
				let stored = localStorage.getItem(this.STORAGE_KEY_DEVICE_NAME);
				if (stored) return stored;
			} catch (ex) { /* fall through to a fresh name */ }
			let name = this.getDefaultDeviceName();
			this.setDeviceName(name);
			return name;
		},

		setDeviceName: function (name) {
			name = (name || "").trim().substring(0, 40);
			if (!name) name = this.getDefaultDeviceName();
			try { localStorage.setItem(this.STORAGE_KEY_DEVICE_NAME, name); } catch (ex) { log.w("could not store device name: " + ex); }
			return name;
		},

		getDefaultDeviceName: function () {
			let ua = navigator.userAgent || "";
			let platform = "device";
			if (/iPhone/i.test(ua)) platform = "iPhone";
			else if (/iPad/i.test(ua)) platform = "iPad";
			else if (/Android/i.test(ua)) platform = "Android";
			else if (/Macintosh|Mac OS X/i.test(ua)) platform = "Mac";
			else if (/Windows/i.test(ua)) platform = "Windows";
			else if (/Linux/i.test(ua)) platform = "Linux";
			// four hex characters, so two of the same make are told apart
			let suffix = Math.floor(Math.random() * 0x10000).toString(16);
			while (suffix.length < 4) suffix = "0" + suffix;
			return platform + "-" + suffix;
		},

		getMetaFileContent: function (slotID) {
			return JSON.stringify({
				device: this.getDeviceName(),
				at: new Date().toISOString(),
				slot: slotID
			});
		},

		parseMeta: function (json) {
			let file = json && json.files ? json.files[this.META_FILE_NAME] : null;
			if (!file || !file.content) return null;
			try {
				let meta = JSON.parse(file.content);
				return meta && meta.device ? meta : null;
			} catch (ex) {
				return null;
			}
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

		// one place the UI can read, and one signal it can listen to, so the footer and any
		// toast agree about what happened
		setSyncState: function (state, message) {
			// GlobalSignals is not in this file's define list (it binds positionally to the
			// factory callback), so it is resolved lazily here instead of adding it there
			let GlobalSignals = require("game/GlobalSignals");
			this.syncState = state;
			this.syncStateAt = new Date();
			this.syncStateMessage = message || null;
			GlobalSignals.cloudSyncStateChangedSignal.dispatch(state, message || null);
		},

		getSyncState: function () {
			return { state: this.syncState, at: this.syncStateAt, message: this.syncStateMessage || null };
		},

		// GitHub's errors are usually JSON, but a proxy or a rate limiter can answer with an
		// HTML page. Reading the body as text first means a rate limit reports as a rate
		// limit instead of as a parse error dressed up as a connection problem.
		getErrorMessage: function (response) {
			return response.text().then(function (text) {
				try {
					let json = JSON.parse(text);
					if (json && json.message) return json.message;
				} catch (ex) {
					// not JSON - fall through to the status
				}
				return "HTTP " + response.status;
			}).catch(function () {
				return "HTTP " + response.status;
			});
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
				if (!response.ok) {
					return helper.getErrorMessage(response).then(function (msg) {
						helper.lastError = msg;
						return { ok: false, error: msg };
					});
				}
				return response.json().then(function (json) {
					helper.setToken(token);
					helper.setGistId(json.id);
					let revision = (json.history && json.history.length > 0) ? json.history[0].version : null;
					if (revision) {
						helper.setLastSeenRevision(revision);
						helper.addOwnRevision(revision);
					}
					helper.hasConflict = false;
					helper.lastError = null;
					return { ok: true, gistId: json.id };
				});
			}).catch(function (ex) {
				let msg = "Could not reach GitHub: " + ex;
				helper.lastError = msg;
				return { ok: false, error: msg };
			});
		},

		// Joining a gist that already exists is the whole of the two-device story. Without
		// this, every device that validates a token creates its OWN gist, and each one then
		// reads back only what it wrote - two devices, two clouds, no sharing, and no error
		// anywhere to say so.
		adoptGist: function (token, gistId) {
			let helper = this;
			if (!token) return Promise.resolve({ ok: false, error: "No token entered" });
			if (!gistId) return Promise.resolve({ ok: false, error: "No gist ID entered" });

			gistId = gistId.trim();

			return fetch(this.API_ROOT + "/gists/" + gistId, {
				cache: "no-store",
				headers: {
					"Authorization": "Bearer " + token,
					"Accept": "application/vnd.github+json"
				}
			}).then(function (response) {
				if (!response.ok) {
					return helper.getErrorMessage(response).then(function (msg) {
						if (response.status == 404) msg = "No gist with that ID, or this token cannot see it";
						helper.lastError = msg;
						return { ok: false, error: msg };
					});
				}
				return response.json().then(function (json) {
					// a mistyped ID is likely to be another of this account's gists, and the
					// token can write to those. Refuse before writing rather than dropping a
					// readme into something unrelated.
					let fileNames = json.files ? Object.keys(json.files) : [];
					let looksRight = json.description == helper.GIST_DESCRIPTION
						|| fileNames.some(function (n) { return n.indexOf("level13-") === 0; });
					if (!looksRight) {
						let msg = "That gist does not look like a Level 13 saves gist";
						helper.lastError = msg;
						return { ok: false, error: msg };
					}

					// reading proves nothing about writing, and a device that can read but not
					// push would look connected right up until the first save failed. Write the
					// readme back: unchanged content creates no revision, so this costs nothing.
					let existing = json.files ? json.files["level13-readme.txt"] : null;
					let content = (existing && existing.content) || "Level 13 save data. Created by the game.";
					let files = { "level13-readme.txt": { content: content } };

					return fetch(helper.API_ROOT + "/gists/" + gistId, {
						method: "PATCH",
						headers: {
							"Authorization": "Bearer " + token,
							"Accept": "application/vnd.github+json",
							"Content-Type": "application/json"
						},
						body: JSON.stringify({ files: files })
					}).then(function (patch) {
						if (!patch.ok) {
							return helper.getErrorMessage(patch).then(function (msg) {
								if (patch.status == 403 || patch.status == 401) msg = "This token cannot write to that gist. Check the Gists permission.";
								helper.lastError = msg;
								return { ok: false, error: msg };
							});
						}
						let isSameGist = (helper.getGistId() == gistId);
						helper.setToken(token);
						helper.setGistId(gistId);
						// deliberately NOT storing a revision, unlike validateAndSetup. A gist
						// this device just created is empty, so it is in sync by definition. One
						// it has just joined may hold another device's save, and an unset marker
						// is exactly how the arrival check knows to offer it.
						// Re-validating a new token against the gist this device already uses is
						// not joining anything, so its marker stays: clearing it would report a
						// conflict with the device's own save.
						if (!isSameGist) {
							helper.setLastSeenRevision("");
							// the revisions and fingerprints belong to the gist this device is
							// leaving. Carried across they could match the new gist's head by
							// accident and hide a real save waiting in it.
							helper.forgetOwnHistory();
						}
						helper.hasConflict = false;
						helper.lastError = null;
						return { ok: true, gistId: gistId };
					});
				});
			}).catch(function (ex) {
				let msg = "Could not reach GitHub: " + ex;
				helper.lastError = msg;
				return { ok: false, error: msg };
			});
		},

		// Writes go one at a time. The rate limit in mirrorSlot is per slot, so two slots
		// could be in flight together; GitHub then serialises them into two commits and
		// whichever answer arrives last decides the marker - which can be the earlier of
		// the two, leaving this device permanently "behind" a cloud it wrote itself.
		saveSlot: function (slotID, data) {
			let helper = this;
			let run = function () { return helper.saveSlotNow(slotID, data); };
			this.writeQueue = (this.writeQueue || Promise.resolve()).then(run, run);
			return this.writeQueue;
		},

		saveSlotNow: function (slotID, data) {
			let helper = this;
			if (!this.isConfigured()) return Promise.resolve({ ok: false, error: "Not set up" });

			this.setSyncState("syncing");

			// check the cloud has not moved under us before writing over it. Both values come
			// from GitHub, so no clock comparison between devices is involved
			return this.fetchGistState().then(function (state) {
				if (!state.ok) { helper.setSyncState("failed", state.error); return { ok: false, error: state.error }; }

				let lastSeen = helper.getLastSeenRevision();
				let fileName = helper.getFileNameForSlot(slotID);
				let hasFileAlready = (state.fileNames || []).indexOf(fileName) >= 0;
				let isBehind = !lastSeen ? hasFileAlready : (!!state.revision && state.revision !== lastSeen);

				// Behind the cloud is not the same as behind ANOTHER DEVICE - see
				// isOwnCloudState. Only the second is a conflict; the first is this
				// device catching up with its own writing, and reporting that as a
				// conflict is what stopped it saving at all.
				return (isBehind ? helper.isOwnCloudState(state, slotID) : Promise.resolve(false)).then(function (isOurs) {
					if (isBehind && isOurs) {
						// caught up: the head is ours, so take it as seen and push on
						if (state.revision) helper.setLastSeenRevision(state.revision);
						helper.hasConflict = false;
						helper.lastError = null;
					} else if (isBehind) {
						helper.hasConflict = true;
						helper.lastError = lastSeen
							? "Another device has saved since this one. Load it or keep this save, in settings."
							: "This device has not synced with the cloud yet. Load the cloud save or keep this one, in settings.";
						helper.setSyncState("conflict", helper.lastError);
						return { ok: false, error: helper.lastError, conflict: true };
					}

					return helper.pushSlot(slotID, data);
				});
			}).catch(function (ex) {
				let msg = "Could not reach GitHub: " + ex;
				helper.lastError = msg;
				helper.setSyncState("failed", msg);
				return { ok: false, error: msg };
			});
		},

		pushSlot: function (slotID, data) {
			let helper = this;
			let files = {};
			files[this.getFileNameForSlot(slotID)] = { content: data };
			// in the same request, so one write is one revision and the record of who
			// wrote it can never disagree with what was written
			files[this.META_FILE_NAME] = { content: this.getMetaFileContent(slotID) };

			// BEFORE the request, not after. If the answer never comes back - a phone
			// backgrounded mid-push, an app closed - GitHub still holds the write, and
			// this is the only record that it was ours. See isOwnCloudState.
			this.setPushedFingerprint(slotID, this.getFingerprint(data));

			return Promise.resolve().then(function () {
				return fetch(helper.API_ROOT + "/gists/" + helper.getGistId(), {
					method: "PATCH",
					headers: {
						"Authorization": "Bearer " + helper.getToken(),
						"Accept": "application/vnd.github+json",
						"Content-Type": "application/json"
					},
					body: JSON.stringify({ files: files })
				}).then(function (response) {
					if (!response.ok) {
						return helper.getErrorMessage(response).then(function (msg) {
							helper.lastError = msg;
							helper.setSyncState("failed", msg);
							return { ok: false, error: msg };
						});
					}
					return response.json().then(function (json) {
						let revision = (json.history && json.history.length > 0) ? json.history[0].version : null;
						if (revision) {
							// the write's own revision is the most correct marker: it is
							// exactly what this device just created. If another device writes
							// after us, the next guard catches it, as it should
							helper.setLastSeenRevision(revision);
							helper.addOwnRevision(revision);
							helper.hasConflict = false;
							helper.lastError = null;
							helper.setSyncState("synced");
							return { ok: true };
						}
						// the update endpoint is not documented to include history. If it did
						// not, read the revision back rather than leaving the marker stale -
						// a stale marker reads as another device having written, and stops
						// this device pushing at all
						return helper.fetchGistState().then(function (after) {
							if (after.ok && after.revision) {
								helper.setLastSeenRevision(after.revision);
								helper.addOwnRevision(after.revision);
							}
							helper.hasConflict = false;
							helper.lastError = null;
							helper.setSyncState("synced");
							return { ok: true };
						});
					});
				});
			}).catch(function (ex) {
				let msg = "Could not reach GitHub: " + ex;
				helper.lastError = msg;
				helper.setSyncState("failed", msg);
				return { ok: false, error: msg };
			});
		},

		// Read one slot and change nothing. isOwnCloudState asks this question while
		// deciding whether there is a conflict at all, so it must not move the marker or
		// clear the flag the way loadSlot does - that would answer the question by
		// erasing it.
		fetchSlotContent: function (slotID) {
			let helper = this;
			let gistId = this.getGistId();
			if (!gistId) return Promise.resolve({ ok: false, error: "Not set up" });

			let fileName = this.getFileNameForSlot(slotID);

			return fetch(this.API_ROOT + "/gists/" + gistId, {
				// see fetchGistState: these reads must not come from the browser cache
				cache: "no-store",
				headers: this.getReadHeaders()
			}).then(function (response) {
				if (!response.ok) {
					return helper.getErrorMessage(response).then(function (msg) {
						return { ok: false, error: msg };
					});
				}
				return response.json().then(function (json) {
					let file = json.files ? json.files[fileName] : null;
					if (!file) return { ok: false, error: "No cloud save for this slot" };

					let revision = (json.history && json.history.length > 0) ? json.history[0].version : null;
					// the API inlines content only below 1MB; above that it sets truncated
					// and the real content is behind raw_url
					if (file.truncated && file.raw_url) {
						return fetch(file.raw_url, { cache: "no-store" }).then(function (raw) {
							return raw.text();
						}).then(function (text) {
							return { ok: true, data: text, revision: revision, updatedAt: json.updated_at };
						});
					}
					return { ok: true, data: file.content, revision: revision, updatedAt: json.updated_at };
				});
			}).catch(function (ex) {
				return { ok: false, error: "Could not reach GitHub: " + ex };
			});
		},

		loadSlot: function (slotID) {
			let helper = this;
			return this.fetchSlotContent(slotID).then(function (result) {
				if (!result.ok) {
					helper.lastError = result.error;
					return result;
				}
				// this device now holds exactly what the cloud holds, so that revision is
				// its own as much as one it wrote itself
				if (result.revision) {
					helper.setLastSeenRevision(result.revision);
					helper.addOwnRevision(result.revision);
				}
				helper.setPushedFingerprint(slotID, helper.getFingerprint(result.data));
				helper.hasConflict = false;
				helper.lastError = null;
				return { ok: true, data: result.data, updatedAt: result.updatedAt };
			});
		},

		// fire and forget. Anything that goes wrong here is recorded and then dropped: the
		// local save already succeeded and gameplay must not notice the network at all.
		mirrorSlot: function (slotID, data) {
			if (!this.isAutoMirrorEnabled()) return;
			if (!this.isConfigured()) return;
			if (!this.isMirroredSlot(slotID)) return;

			// a refused push means another device owns the cloud right now. Retrying every
			// two minutes would just hammer the same wall until the player resolves it
			if (this.hasConflict) return;

			let helper = this;
			let now = new Date().getTime();
			let last = this.lastMirrorTimestamps[slotID] || 0;
			let sinceLast = now - last;

			if (sinceLast < this.MIRROR_MIN_INTERVAL_MS) {
				// coalesce: keep only the newest data, and let the timer already in flight send it
				let hadPending = !!this.pendingMirrorTimers[slotID];
				this.pendingMirrors[slotID] = data;
				if (hadPending) return;
				this.pendingMirrorTimers[slotID] = setTimeout(function () {
					let pending = helper.pendingMirrors[slotID];
					delete helper.pendingMirrors[slotID];
					delete helper.pendingMirrorTimers[slotID];
					if (pending) helper.sendMirror(slotID, pending);
				}, this.MIRROR_MIN_INTERVAL_MS - sinceLast);
				return;
			}

			// sending right now, so drop whatever a pending timer was holding: it is older
			// than this by construction, and letting it fire too would race two writes at the
			// gist with no ordering guarantee - the older one can land last and win
			this.cancelPendingMirror(slotID);
			this.sendMirror(slotID, data);
		},

		cancelPendingMirror: function (slotID) {
			if (this.pendingMirrorTimers[slotID]) {
				clearTimeout(this.pendingMirrorTimers[slotID]);
				delete this.pendingMirrorTimers[slotID];
			}
			delete this.pendingMirrors[slotID];
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
