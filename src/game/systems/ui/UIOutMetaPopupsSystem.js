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
            if (existingId) {
                GameGlobals.uiFunctions.showConfirmation(
                    "This will create a new gist and stop using the current one.<br/><br/><span class='p-meta'>Saves already in gist " + existingId + " stay on GitHub, but the game will no longer see them.</span>",
                    function () { sys.runGithubValidation(); }, false, true);
                return;
            }
            this.runGithubValidation();
        },

        runGithubValidation: function () {
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

		showCloudArrivalPrompt: function (cloudRevision, cloudUpdatedAt) {
			let helper = GameGlobals.gistSaveHelper;
			let slotID = GameConstants.SAVE_SLOT_DEFAULT;

			let neverSynced = !helper.getLastSeenRevision();
			let msg = neverSynced
				? "There is a save in the cloud, and this device has not synced with it yet.<br/><br/>"
				: "A save from another device is in the cloud.<br/><br/>";
			let manageSaveSystem = GameGlobals.uiFunctions.getManageSaveSystemForCloud();
			let cloudDate = cloudUpdatedAt;
			if (manageSaveSystem && cloudUpdatedAt) {
				cloudDate = manageSaveSystem.getDateDisplayString(new Date(cloudUpdatedAt));
			}
			msg += "<span class='p-meta'>cloud updated: " + cloudDate + "</span><br/><br/>";
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
            let status = isConfigured ? "Connected. Saves go to gist " + helper.getGistId() : (helper.getLastError() || "Not set up");
            $("#settings-github-status").text(status);
            $("#settings-checkbox-github-auto").prop("disabled", !isConfigured);
            $("#settings-checkbox-github-auto").prop("checked", helper.isAutoMirrorEnabled());
            this.updateCloudSyncStatus();
        },

		onCloudSyncStateChanged: function (state, message) {
			this.updateCloudSyncStatus();
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
			let text = "cloud: not synced yet";
			if (info.state == "syncing") text = "cloud: saving...";
			else if (info.state == "synced") text = "cloud: saved " + (info.at ? info.at.toLocaleString(navigator.language, { timeStyle: "short" }) : "");
			else if (info.state == "failed") text = "cloud: failed";
			else if (info.state == "conflict") text = "cloud: needs attention";

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
		// device has been played. Never changes anything on its own
		checkCloudSaveOnArrival: function () {
			let sys = this;
			let helper = GameGlobals.gistSaveHelper;
			if (!helper.isConfigured()) return;

			helper.fetchGistState().then(function (state) {
				// being unable to reach GitHub is not a conflict, and must not block startup
				if (!state.ok) return;
				let lastSeen = helper.getLastSeenRevision();
				if (!state.revision) return;
				if (lastSeen && state.revision === lastSeen) return;

				// no marker means this device has never synced. If the cloud already holds a
				// save, which of the two is current is genuinely unknown, so ask rather than
				// assume. An empty cloud has nothing to ask about.
				if (!lastSeen) {
					let hasAnySave = (state.fileNames || []).some(function (n) { return n.indexOf("level13-") === 0 && n !== "level13-readme.txt"; });
					if (!hasAnySave) return;
				}

				helper.hasConflict = true;
				sys.showCloudArrivalPrompt(state.revision, state.updatedAt);
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
				if (lastSeen && state.revision === lastSeen) return;
				sys.applyIdleCloudFinding(state.revision, state.updatedAt);
			});
		},

		applyIdleCloudFinding: function (cloudRevision, cloudUpdatedAt) {
			let helper = GameGlobals.gistSaveHelper;
			// in conflict means this device holds progress the cloud refused, which could be
			// hours of play. Loading over it silently would destroy that, so ask.
			if (helper.isInConflict() || !helper.getLastSeenRevision()) {
				helper.hasConflict = true;
				this.showCloudArrivalPrompt(cloudRevision, cloudUpdatedAt);
				return;
			}

			// otherwise this device's state is already in the cloud, so the newer save
			// descends from it and loading loses nothing worth keeping
			let manageSaveSystem = GameGlobals.uiFunctions.getManageSaveSystemForCloud();
			if (!manageSaveSystem) return;
			helper.loadSlot(GameConstants.SAVE_SLOT_DEFAULT).then(function (result) {
				if (!result.ok) return;
				let saveJSON = manageSaveSystem.getSaveSystem().getSaveJSONfromCompressed(result.data);
				if (!GameGlobals.saveHelper.parseSaveJSON(saveJSON)) return;
				// the REVISION, never the timestamp: this value becomes the marker every
				// later check compares against, and a timestamp there can never match a SHA,
				// so the next push would report a conflict that does not exist
				helper.resolveConflict(cloudRevision);
				manageSaveSystem.loadState(saveJSON);
			});
		},

        onMetaMessagesLoaded: function () {
            this.showUnseenMetaMessages();
        },


	});

	return UIOutMetaPopupsSystem;
});
