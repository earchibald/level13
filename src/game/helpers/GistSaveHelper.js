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
		STORAGE_KEY_LAST_SEEN: "github-gist-last-seen",

		API_ROOT: "https://api.github.com",
		GIST_DESCRIPTION: "Level 13 saves",

		// rapid manual saves must not each become a request; autosave is every 2 minutes
		// so this only ever bites on a burst
		MIRROR_MIN_INTERVAL_MS: 10000,

		lastError: null,
		hasConflict: false,
		pendingMirrors: null,
		lastMirrorTimestamps: null,
		pendingMirrorTimers: null,

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

		getLastSeen: function () {
			try { return localStorage.getItem(this.STORAGE_KEY_LAST_SEEN) || null; } catch (ex) { return null; }
		},

		setLastSeen: function (updatedAt) {
			try { localStorage.setItem(this.STORAGE_KEY_LAST_SEEN, updatedAt || ""); } catch (ex) { log.w("could not store last seen: " + ex); }
		},

		// another device has written since this one last synced
		isInConflict: function () {
			return this.hasConflict;
		},

		// the player has chosen a side, so pushing may resume
		resolveConflict: function (updatedAt) {
			this.hasConflict = false;
			this.setLastSeen(updatedAt);
			this.lastError = null;
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
				headers: { "Accept": "application/vnd.github+json" }
			}).then(function (response) {
				if (!response.ok) {
					return helper.getErrorMessage(response).then(function (msg) {
						return { ok: false, error: msg };
					});
				}
				return response.json().then(function (json) {
					return { ok: true, updatedAt: json.updated_at, fileNames: json.files ? Object.keys(json.files) : [] };
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
					helper.setLastSeen(json.updated_at);
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

		saveSlot: function (slotID, data) {
			let helper = this;
			if (!this.isConfigured()) return Promise.resolve({ ok: false, error: "Not set up" });

			// check the cloud has not moved under us before writing over it. Both values come
			// from GitHub, so no clock comparison between devices is involved
			return this.fetchGistState().then(function (state) {
				if (!state.ok) return { ok: false, error: state.error };

				let lastSeen = helper.getLastSeen();
				let fileName = helper.getFileNameForSlot(slotID);
				let hasFileAlready = (state.fileNames || []).indexOf(fileName) >= 0;

				if (!lastSeen) {
					// this device has never synced, so it cannot know whether the cloud is
					// ahead of it. Pushing anyway is how a device that predates this guard
					// overwrites someone else's newer save. Silence is not permission.
					// The one safe case is a slot the cloud has never held: nothing to lose.
					if (hasFileAlready) {
						helper.hasConflict = true;
						helper.lastError = "This device has not synced with the cloud yet. Load the cloud save or keep this one, in settings.";
						return { ok: false, error: helper.lastError, conflict: true };
					}
				} else if (state.updatedAt && state.updatedAt !== lastSeen) {
					helper.hasConflict = true;
					helper.lastError = "Another device has saved since this one. Load it or keep this save, in settings.";
					return { ok: false, error: helper.lastError, conflict: true };
				}

				let files = {};
				files[helper.getFileNameForSlot(slotID)] = { content: data };

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
							return { ok: false, error: msg };
						});
					}
					return response.json().then(function (json) {
						// straight from the write, so no second request is needed
						helper.setLastSeen(json.updated_at);
						helper.hasConflict = false;
						helper.lastError = null;
						return { ok: true };
					});
				});
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
				// see fetchGistState: these reads must not come from the browser cache
				cache: "no-store",
				headers: { "Accept": "application/vnd.github+json" }
			}).then(function (response) {
				if (!response.ok) {
					return helper.getErrorMessage(response).then(function (msg) {
						helper.lastError = msg;
						return { ok: false, error: msg };
					});
				}
				return response.json().then(function (json) {
					let file = json.files ? json.files[fileName] : null;
					if (!file) {
						let msg = "No cloud save for this slot";
						helper.lastError = msg;
						return { ok: false, error: msg };
					}
					// the API inlines content only below 1MB; above that it sets truncated
					// and the real content is behind raw_url
					if (file.truncated && file.raw_url) {
						return fetch(file.raw_url, { cache: "no-store" }).then(function (raw) {
							return raw.text();
						}).then(function (text) {
							helper.setLastSeen(json.updated_at);
							helper.hasConflict = false;
							helper.lastError = null;
							return { ok: true, data: text, updatedAt: json.updated_at };
						});
					}
					helper.setLastSeen(json.updated_at);
					helper.hasConflict = false;
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
