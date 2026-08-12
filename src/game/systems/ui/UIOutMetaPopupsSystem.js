define([
	'ash',
	'utils/UIList',
	'game/GameGlobals',
	'game/GlobalSignals',
	'game/constants/GameConstants',
	'game/constants/LogConstants',
], function (Ash, UIList, GameGlobals, GlobalSignals, GameConstants, LogConstants) {
	
    let UIOutMetaPopupsSystem = Ash.System.extend({

        metaMessages: [],

		lastUserInputAt: null,
		lastIdleCloudCheckAt: null,
		IDLE_THRESHOLD_MS: 60000,
		IDLE_CHECK_MIN_GAP_MS: 60000,

		constructor: function () {
            this.showLanguageSelection = GameConstants.isDebugVersion;
            this.initElements();

			let sys = this;
			this.lastUserInputAt = new Date().getTime();
			// any of these means the player is still here
			$(document).on("keydown.cloudidle mousedown.cloudidle touchstart.cloudidle", function () {
				sys.lastUserInputAt = new Date().getTime();
			});

			return this;
		},

		addToEngine: function (engine) {
			GlobalSignals.add(this, GlobalSignals.popupOpenedSignal, this.onPopupOpened);
			GlobalSignals.add(this, GlobalSignals.popupClosedSignal, this.onPopupClosed);
			GlobalSignals.add(this, GlobalSignals.gameShownSignal, this.onGameShown);
			GlobalSignals.add(this, GlobalSignals.cloudSyncStateChangedSignal, this.onCloudSyncStateChanged);
		},

		removeFromEngine: function (engine) {
			GlobalSignals.removeAll(this);
			$(document).off(".cloudidle");
		},

		update: function (time) {
			this.updateIdleCloudCheck();
		},

        initElements: function () {
            this.settingsPopupHotkeysList = UIList.create(this, $("#hotkeys-list"), this.createHotkeyListItem, this.updateHotkeyListItem, this.isHotkeyListItemDataSame);

            let sys = this;
			$("#settings-checkbox-sfx-enabled").change(() => sys.onSettingToggled());
			$("#settings-checkbox-hotkeys-enabled").change(() => sys.onSettingToggled());
			$("#settings-checkbox-hotkeys-numpad").change(() => sys.onSettingToggled());
			$("#btn-settings-github-validate").click(() => sys.onGithubValidateClicked());
			$("#btn-settings-github-help").click(() => GameGlobals.uiFunctions.showSpecialPopup("github-setup-popup", { isMeta: true, isDismissable: true }));
			$("#github-setup-popup-close").click(() => GameGlobals.uiFunctions.popupManager.closePopup("github-setup-popup"));
			$("#settings-checkbox-github-auto").change(() => {
				GameGlobals.gistSaveHelper.setAutoMirrorEnabled($("#settings-checkbox-github-auto").is(":checked"));
			});
			// on change, not on a button: there is nothing to validate and nothing to go
			// wrong. setDeviceName trims and falls back, so put back what it settled on
			// rather than leaving the box showing something that was not stored
			$("#settings-github-device").change(() => {
				let stored = GameGlobals.gistSaveHelper.setDeviceName($("#settings-github-device").val());
				$("#settings-github-device").val(stored);
			});

            let languageOptions = "";
            for (var key in GameGlobals.textLoader.textSources) {
                if (key == "default") continue;
                let source = GameGlobals.textLoader.textSources[key];
                languageOptions += "<option value='" + key + "' id='language-dropdown-option-" + key + "'>" + source.name + "</option>";
            }

            $("#language-dropdown").append(languageOptions);
        },

        loadMetaMessages: function () {
			let sys = this;
			$.getJSON('messages.json', function (json) {
				sys.metaMessages = json.messages;
                sys.onMetaMessagesLoaded();
			})
			.fail(function () {
                log.w("Failed to load meta messages");
			});
        },

        showUnseenMetaMessages: function () {
            GameGlobals.metaState.seenMetaMessages = GameGlobals.metaState.seenMetaMessages || [];

            let maxCampOrdinalReached = GameGlobals.metaState.maxCampOrdinalReached || 0;
            
            for (let i = 0; i < this.metaMessages.length; i++) {
                let message = this.metaMessages[i];
                let id = message.id;
                if (!id) continue;
                if (GameGlobals.metaState.seenMetaMessages.indexOf(id) >= 0) continue;

                if (message.conditions) {
                    if (message.conditions.campOrdinalReached && maxCampOrdinalReached < message.conditions.campOrdinalReached) continue;
                }

                if (message.expires) {
                    let expires = new Date(message.expires).getTime();
                    if (expires < Date.now()) continue;
                }

                this.showMetaMessage(message);
                GameGlobals.metaState.seenMetaMessages.push(id);
                return;
            }
        },

        showMetaMessage: function (message) {
            let text = message.text;
            if (!text) return;
            GameGlobals.uiFunctions.showInfoPopup("System Message", text, "Continue");
        },

        refreshSettingsPopup: function () {
            this.updateSettingsValues();
            this.updateHotkeyList();
        },

        updateSettingsValues: function () {
            $("#settings-checkbox-sfx-enabled").prop("checked", GameGlobals.gameState.settings.sfxEnabled);
            $("#settings-checkbox-hotkeys-enabled").prop("checked", GameGlobals.gameState.settings.hotkeysEnabled);
            this.updateGithubSettings();
            $("#settings-checkbox-hotkeys-numpad").prop("checked", GameGlobals.gameState.settings.hotkeysNumpad);

            $("#settings-checkbox-hotkeys-numpad").parent().find("input").prop('disabled', !GameGlobals.gameState.settings.hotkeysEnabled);
            $("#settings-checkbox-hotkeys-numpad").parent().toggleClass("dimmed", !GameGlobals.gameState.settings.hotkeysEnabled);
            
            GameGlobals.uiFunctions.toggle($("#language-selection"), this.showLanguageSelection);
        },
        
        updateHotkeyList: function () {
            let hotkeyEntries = [];
            for (let code in GameGlobals.uiFunctions.hotkeys) {
                for (let i = 0; i < GameGlobals.uiFunctions.hotkeys[code].length; i++) {
                    let hotkey = GameGlobals.uiFunctions.hotkeys[code][i];
					if (hotkey.activeCondition && !hotkey.activeCondition()) continue;
                    if (hotkey.isUniversal) continue;
                    if (hotkey.isHiddenFromList) continue;
                    let modifier = GameGlobals.uiFunctions.getActualHotkeyModifier(hotkey.modifier);
                    if (modifier == "shiftKey") modifier = "Shift";
                    if (modifier == "ctrlKey") modifier = "Ctrl";
                    if (modifier == "altKey") modifier = "Alt";
                    let hotkeyValue = "";
                    if (modifier) hotkeyValue += modifier + " + ";
                    hotkeyValue += hotkey.displayKey;
                    let isDev = hotkey.isDev;
                    let displayName = hotkey.description;
                    let isDisabled = !GameGlobals.gameState.settings.hotkeysEnabled;
                    hotkeyEntries.push({ displayName: displayName, value: hotkeyValue, isDisabled: isDisabled, isDev: isDev });
                }
            }
			UIList.update(this.settingsPopupHotkeysList, hotkeyEntries);
        },

        createHotkeyListItem: function () {
			let li = {};
			let div = "<div class='hotkey-list-item'><span class='hotkey-list-item-label'></span><span class='hotkey-list-item-value'></span></div>";
			li.$root = $(div);
			li.$label = li.$root.find("span.hotkey-list-item-label");
			li.$value = li.$root.find("span.hotkey-list-item-value");
			return li;
        },

        updateHotkeyListItem: function (li, data) {
            li.$root.toggleClass("dimmed", data.isDisabled);
            li.$root.toggleClass("debug-info", data.isDev);
			li.$label.html(data.displayName);
			li.$value.html(data.value);
        },

        isHotkeyListItemDataSame: function (d1, d2) {
            return d1.displayName == d2.displayName && d1.value == d2.value && d1.isDisabled == d2.isDisabled;
        },

        onGithubValidateClicked: function () {
            let sys = this;
            let existingId = GameGlobals.gistSaveHelper.getGistId();
            let enteredId = ($("#settings-github-gist").val() || "").trim();

            // an empty box means "make me a new gist", which is the only path that can strand
            // saves. Joining a gist by ID never destroys anything, so it needs no confirmation.
            if (!enteredId && existingId) {
                GameGlobals.uiFunctions.showConfirmation(
                    "This will create a new gist and stop using the current one.<br/><br/><span class='p-meta'>Saves already in gist " + existingId + " stay on GitHub, but the game will no longer see them.</span>",
                    function () { sys.runGithubValidation(); }, false, true);
                return;
            }
            this.runGithubValidation();
        },

        runGithubValidation: function () {
            let sys = this;
            // a successful validation blanks the token box and never shows the token again, so
            // on a device that is already set up the box is empty every time afterwards.
            // Changing only the gist ID must not therefore fail as "No token entered": fall
            // back to the token this device already holds.
            let token = $("#settings-github-token").val() || GameGlobals.gistSaveHelper.getToken();
            let enteredId = ($("#settings-github-gist").val() || "").trim();
            let isJoiningNewGist = !!enteredId && enteredId != GameGlobals.gistSaveHelper.getGistId();
            $("#settings-github-status").text("Checking...");

            let promise = enteredId
                ? GameGlobals.gistSaveHelper.adoptGist(token, enteredId)
                : GameGlobals.gistSaveHelper.validateAndSetup(token);

            promise.then(function (result) {
                if (result.ok) {
                    // the token is never shown again, the same way GitHub treats it
                    $("#settings-github-token").val("");
                }
                sys.updateGithubSettings();
                if (!result.ok) {
                    // updateGithubSettings refills the box from storage, which silently throws
                    // away what the player typed and reads as the button doing nothing. Put it
                    // back so the failed value is there to correct.
                    $("#settings-github-gist").val(enteredId);
                    // and it reports the STORED setup, which is still fine - so a device that
                    // was already connected answers a failed attempt with "Connected" and the
                    // player never learns what went wrong
                    $("#settings-github-status").text(result.error || "Could not connect");
                }
                // a device that has just joined an existing gist is behind it by construction,
                // so ask about the save waiting there instead of making the player find it
                if (result.ok && isJoiningNewGist) sys.checkCloudSaveOnArrival();
            });
        },

		// "saved from iPhone-a3f2, 9 Aug 10:14" - the one line every cloud card and
		// prompt carries, so the player can always tell WHICH device and WHEN without
		// having to reason about it.
		//
		// The device comes from the meta file the writing device leaves in the gist.
		// A gist written before that file existed has none, so the wording falls back
		// to the gist's own timestamp and says nothing it cannot know.
		getCloudSaveDescription: function (state) {
			let manageSaveSystem = GameGlobals.uiFunctions.getManageSaveSystemForCloud();
			let when = (state.meta && state.meta.at) || state.updatedAt;
			let whenText = when;
			if (manageSaveSystem && when) {
				whenText = manageSaveSystem.getDateDisplayString(new Date(when));
			}
			let device = state.meta && state.meta.device;
			let isThisDevice = device && device === GameGlobals.gistSaveHelper.getDeviceName();
			if (!device) return "<span class='p-meta'>cloud updated: " + whenText + "</span>";
			return "<span class='p-meta'>saved from " + device + (isThisDevice ? " (this device)" : "") + ", " + whenText + "</span>";
		},

		// Anything the game does to this device's state on its own gets one of these.
		// Silent is what made the cloud saves impossible to reason about: the game
		// would adopt a revision, or load a whole save over the running game, and say
		// nothing at all about it.
		showCloudCard: function (msg) {
			GameGlobals.uiFunctions.showInfoPopup("Cloud saves", msg, "OK", null, null, false, true);
		},

		showCloudArrivalPrompt: function (state) {
			let helper = GameGlobals.gistSaveHelper;
			let slotID = GameConstants.SAVE_SLOT_DEFAULT;
			let cloudRevision = state.revision;

			let neverSynced = !helper.getLastSeenRevision();
			let device = state.meta && state.meta.device;
			let msg = neverSynced
				? "There is a save in the cloud, and this device has not synced with it yet.<br/><br/>"
				: (device
					? "A save from " + device + " is in the cloud.<br/><br/>"
					: "A save from another device is in the cloud.<br/><br/>");
			msg += this.getCloudSaveDescription(state) + "<br/><br/>";
			msg += "Load it, or keep the save on this device and carry on from here?";

			GameGlobals.uiFunctions.showQuestionPopup("Cloud saves", msg, "Load the cloud save", "Keep this device's",
				function () {
					helper.loadSlot(slotID).then(function (result) {
						if (!result.ok) {
							GameGlobals.uiFunctions.showInfoPopup("Cloud saves", "Could not load: " + result.error, "OK", null, null, false, true);
							return;
						}
						// same path as import and the Load button - see the note in
						// UIOutManageSaveSystem.cloudLoadSelectedSlot
						let manageSaveSystem = GameGlobals.uiFunctions.getManageSaveSystemForCloud();
						if (!manageSaveSystem) return;
						let saveJSON = manageSaveSystem.getSaveSystem().getSaveJSONfromCompressed(result.data);
						if (!GameGlobals.saveHelper.parseSaveJSON(saveJSON)) {
							GameGlobals.uiFunctions.showInfoPopup("Cloud saves", "That cloud save could not be read.", "OK", null, null, false, true);
							return;
						}
						helper.resolveConflict(cloudRevision);
						manageSaveSystem.loadState(saveJSON);
					});
				},
				function () {
					// accept the cloud as seen without pulling, so this device may push again
					helper.resolveConflict(cloudRevision);
				},
				false);
		},

        updateGithubSettings: function () {
            let helper = GameGlobals.gistSaveHelper;
            let isConfigured = helper.isConfigured();
            // the ID sits in the box just above, so repeating it here only costs two wrapped
            // lines of a popup that is already tight on a phone
            let status = isConfigured ? "Connected" : (helper.getLastError() || "Not set up");
            $("#settings-github-status").text(status);
            // the box doubles as the display: this is the value the player copies to a second
            // device, so it has to be selectable, not buried in a status line
            $("#settings-github-gist").val(helper.getGistId() || "");
            // getDeviceName invents one on first read, so the box is never empty and the
            // player always knows what the other device will call this one
            $("#settings-github-device").val(helper.getDeviceName());
            $("#settings-checkbox-github-auto").prop("disabled", !isConfigured);
            $("#settings-checkbox-github-auto").prop("checked", helper.isAutoMirrorEnabled());
            this.updateCloudSyncStatus();
        },

		onCloudSyncStateChanged: function (state, message) {
			this.updateCloudSyncStatus();
			// the phone hides #cloud-sync-status (the footer is a fixed row), so a
			// completed mirror confirms itself with the toast card at the top instead
			if (state == "synced" && $("body").hasClass("layout-small")) {
				GameGlobals.uiFunctions.showToast("Saved to cloud");
			}
			// only failures and conflicts are worth interrupting for. A toast every two
			// minutes for a working sync would train the player to ignore all of them,
			// including these. There is no dedicated toast channel in this game, so this
			// rides the same in-world log the player already checks for other messages;
			// a null id gets LogConstants' own generic unique id, uncapped by any cooldown,
			// and global visibility means it is not tied to wherever the player happens to be
			if (state == "failed" || state == "conflict") {
				let text = "Cloud save " + (state == "conflict" ? "needs attention" : "failed") + ": " + (message || "unknown");
				GameGlobals.playerHelper.addLogMessage(null, text, { visibility: LogConstants.MSG_VISIBILITY_GLOBAL });
			}
		},

		updateCloudSyncStatus: function () {
			let helper = GameGlobals.gistSaveHelper;
			let $el = $("#cloud-sync-status");
			if (!helper.isConfigured()) { GameGlobals.uiFunctions.toggle($el, false); return; }

			let info = helper.getSyncState();
			// the gist ID identifies WHICH cloud this device is talking to. Two devices on two
			// different gists is a silent failure - each one reads back only its own saves -
			// and comparing these two labels is the fastest way to see it. A prefix is enough
			// to tell two IDs apart and keeps the footer short.
			let gistId = helper.getGistId() || "";
			let label = "cloud " + gistId.substring(0, 8);

			let text = label + ": not synced yet";
			if (info.state == "syncing") text = label + ": saving...";
			else if (info.state == "synced") text = label + ": saved " + (info.at ? info.at.toLocaleString(navigator.language, { timeStyle: "short" }) : "");
			else if (info.state == "failed") text = label + ": failed";
			else if (info.state == "conflict") text = label + ": needs attention";

			$el.text(text);
			$el.toggleClass("warning", info.state == "failed" || info.state == "conflict");
			GameGlobals.uiFunctions.toggle($el, true);
		},

        saveSettings: function () {
            GameGlobals.gameState.settings.sfxEnabled = $("#settings-checkbox-sfx-enabled").is(':checked');
            GameGlobals.gameState.settings.hotkeysEnabled = $("#settings-checkbox-hotkeys-enabled").is(':checked');
            GameGlobals.gameState.settings.hotkeysNumpad = $("#settings-checkbox-hotkeys-numpad").is(':checked');
        
            let language = this.getSelectedValidLanguage();
            if (language) {
                GameGlobals.metaState.settings.language = language;
            }
        },

        getSelectedValidLanguage: function () {
            if (!this.showLanguageSelection) return null;
            let language = $("#language-dropdown").val();
            return GameGlobals.textLoader.isSupportedLanguage(language) ? language : null;
        },

        onSettingToggled: function () {
            this.saveSettings();
            this.updateSettingsValues();
            this.updateHotkeyList();
        },

		onPopupOpened: function (popupID) {
			if (popupID === "settings-popup") {
				this.refreshSettingsPopup();
			}
		},

        onPopupClosed: function (popupID) {
			if (popupID === "settings-popup") {
				this.saveSettings();
                GameGlobals.uiFunctions.updateHotkeyHints();
                GlobalSignals.settingsChangedSignal.dispatch();
			}
        },

        onGameShown: function () {
            this.loadMetaMessages();
			this.checkCloudSaveOnArrival();
        },

		// once per game start: if the cloud moved since this device last synced, another
		// device has been played. Loads nothing on its own - the most it does by itself
		// is accept a revision this device wrote, and it says so when it does
		checkCloudSaveOnArrival: function () {
			let sys = this;
			let helper = GameGlobals.gistSaveHelper;
			if (!helper.isConfigured()) return;

			helper.fetchGistState().then(function (state) {
				// being unable to reach GitHub is not a conflict, and must not block startup
				if (!state.ok) return;
				let lastSeen = helper.getLastSeenRevision();
				if (!state.revision) return;
				if (lastSeen && state.revision === lastSeen) {
					// nothing moved and nothing was changed, so there is nothing to report:
					// a card on every launch that only ever says "all fine" is one the
					// player stops reading, and then misses the one that matters
					helper.clearConflictIfResolved();
					return;
				}

				// no marker means this device has never synced. If the cloud already holds a
				// save, which of the two is current is genuinely unknown, so ask rather than
				// assume. An empty cloud has nothing to ask about.
				if (!lastSeen) {
					let hasAnySave = (state.fileNames || []).some(function (n) { return helper.isSaveFileName(n); });
					if (!hasAnySave) return;
				}

				// The commonest way to reach here is not another device at all: this one
				// pushed and was closed before the answer arrived, so the cloud moved and
				// the marker did not. Asking "load the save from your other device?" about
				// the player's own last autosave is the bug this checks for.
				helper.isOwnCloudState(state, GameConstants.SAVE_SLOT_DEFAULT).then(function (isOurs) {
					if (isOurs) {
						// accepting a revision changes what this device will do next - it
						// starts pushing again - so it is not nothing, and it used to happen
						// in silence
						helper.resolveConflict(state.revision);
						sys.updateCloudSyncStatus();
						sys.showCloudCard("The cloud already holds this device's own last save, so the game has caught up with it. Nothing was loaded."
							+ "<br/><br/>" + sys.getCloudSaveDescription(state));
						return;
					}
					helper.hasConflict = true;
					sys.showCloudArrivalPrompt(state);
				});
			});
		},

		// a session left sitting is the moment to look for a newer save from elsewhere: the
		// player has stopped doing anything here, so there is nothing of theirs to lose
		updateIdleCloudCheck: function () {
			let helper = GameGlobals.gistSaveHelper;
			if (!helper.isConfigured()) return;

			let now = new Date().getTime();
			if (now - this.lastUserInputAt < this.IDLE_THRESHOLD_MS) return;
			if (this.lastIdleCloudCheckAt && now - this.lastIdleCloudCheckAt < this.IDLE_CHECK_MIN_GAP_MS) return;
			if (GameGlobals.uiFunctions.popupManager.hasOpenPopup()) return;
			this.lastIdleCloudCheckAt = now;

			let sys = this;
			helper.fetchGistState().then(function (state) {
				if (!state.ok || !state.revision) return;
				let lastSeen = helper.getLastSeenRevision();
				if (lastSeen && state.revision === lastSeen) {
					helper.clearConflictIfResolved();
					return;
				}
				// as in checkCloudSaveOnArrival: a head this device made is not a finding.
				// Left unchecked this one is worse, because it repeats every idle period.
				helper.isOwnCloudState(state, GameConstants.SAVE_SLOT_DEFAULT).then(function (isOurs) {
					if (isOurs) {
						helper.resolveConflict(state.revision);
						sys.updateCloudSyncStatus();
						return;
					}
					sys.applyIdleCloudFinding(state);
				});
			});
		},

		applyIdleCloudFinding: function (state) {
			let sys = this;
			let helper = GameGlobals.gistSaveHelper;
			let cloudRevision = state.revision;
			// in conflict means this device holds progress the cloud refused, which could be
			// hours of play. Loading over it silently would destroy that, so ask.
			if (helper.isInConflict() || !helper.getLastSeenRevision()) {
				helper.hasConflict = true;
				this.showCloudArrivalPrompt(state);
				return;
			}

			// otherwise this device's state is already in the cloud, so the newer save
			// descends from it and loading loses nothing worth keeping
			let manageSaveSystem = GameGlobals.uiFunctions.getManageSaveSystemForCloud();
			if (!manageSaveSystem) return;
			helper.loadSlot(GameConstants.SAVE_SLOT_DEFAULT).then(function (result) {
				if (!result.ok) return;
				let saveJSON = manageSaveSystem.getSaveSystem().getSaveJSONfromCompressed(result.data);
				if (!GameGlobals.saveHelper.parseSaveJSON(saveJSON)) {
					// loadSlot has already moved the marker, because reading succeeded - it
					// is the CONTENT that is unusable. Saying nothing would leave the device
					// believing it is in sync with a save it cannot read, and the player with
					// no idea why the cloud had gone quiet.
					sys.showCloudCard("A newer save was found in the cloud, but it could not be read, so nothing was loaded."
						+ "<br/><br/>" + sys.getCloudSaveDescription(state));
					return;
				}
				// the REVISION, never the timestamp: this value becomes the marker every
				// later check compares against, and a timestamp there can never match a SHA,
				// so the next push would report a conflict that does not exist
				helper.resolveConflict(cloudRevision);
				manageSaveSystem.loadState(saveJSON);
				// This replaces the whole running game with another device's save. It is
				// safe - the state it overwrote is already in the cloud - but it is the
				// largest thing the game does without being asked, and it did it in
				// silence. Coming back to a session that has quietly become a different
				// one, with no way to tell what happened, is how the cloud saves came to
				// feel untrustworthy.
				sys.showCloudCard("A newer save was found in the cloud and has been loaded."
					+ "<br/><br/>" + sys.getCloudSaveDescription(state)
					+ "<br/><br/><span class='p-meta'>This device's own progress was already in the cloud, so nothing was lost.</span>");
			});
		},

        onMetaMessagesLoaded: function () {
            this.showUnseenMetaMessages();
        },


	});

	return UIOutMetaPopupsSystem;
});
