define([
	'ash',
	'utils/UIList',
	'game/GameGlobals',
	'game/GlobalSignals',
	'game/constants/GameConstants',
], function (Ash, UIList, GameGlobals, GlobalSignals, GameConstants) {
	
    let UIOutMetaPopupsSystem = Ash.System.extend({

        metaMessages: [],

		constructor: function () {
            this.showLanguageSelection = GameConstants.isDebugVersion;
            this.initElements();
			return this;
		},

		addToEngine: function (engine) {
			GlobalSignals.add(this, GlobalSignals.popupOpenedSignal, this.onPopupOpened);
			GlobalSignals.add(this, GlobalSignals.popupClosedSignal, this.onPopupClosed);
			GlobalSignals.add(this, GlobalSignals.gameShownSignal, this.onGameShown);
		},

		removeFromEngine: function (engine) {
			GlobalSignals.removeAll(this);
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

		showCloudArrivalPrompt: function (cloudUpdatedAt) {
			let helper = GameGlobals.gistSaveHelper;
			let slotID = GameConstants.SAVE_SLOT_DEFAULT;

			let msg = "A save from another device is in the cloud.<br/><br/>";
			msg += "<span class='p-meta'>cloud updated: " + cloudUpdatedAt + "</span><br/><br/>";
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
						helper.resolveConflict(cloudUpdatedAt);
						manageSaveSystem.loadState(saveJSON);
					});
				},
				function () {
					// accept the cloud as seen without pulling, so this device may push again
					helper.resolveConflict(cloudUpdatedAt);
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
				let lastSeen = helper.getLastSeen();
				if (!lastSeen || !state.updatedAt) return;
				if (state.updatedAt === lastSeen) return;

				helper.hasConflict = true;
				sys.showCloudArrivalPrompt(state.updatedAt);
			});
		},

        onMetaMessagesLoaded: function () {
            this.showUnseenMetaMessages();
        },


	});

	return UIOutMetaPopupsSystem;
});
