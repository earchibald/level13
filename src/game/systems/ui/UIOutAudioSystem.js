define([
	'ash',
	'game/GameGlobals',
	'game/constants/GameConstants',
	'game/constants/PlayerActionConstants',
	'game/constants/UIConstants',
	'game/GlobalSignals'
], function (Ash, GameGlobals, GameConstants, PlayerActionConstants, UIConstants, GlobalSignals) {

    let UIOutAudioSystem = Ash.System.extend({

		context: "audio",

		elements: {},

		previousSound: null,

		soundTimestamps: {}, // triggerID -> timestamp

		// Sounds play through media elements, one per sound, created and
		// preloaded once at page setup and reused for every play.
		//
		// Not Web Audio. From 0.6.3.m9x to m113 sounds went through a shared
		// AudioContext, and that is the whole history of "sound stops for the
		// rest of the session": WebKit hands the audio unit to something else
		// - a backgrounded tab, a call, an alarm - and what comes back is a
		// context that still reports "running", still advances its clock, and
		// plays nothing. Nothing throws, nothing logs, and a fresh context
		// built inside a real click is just as silent, so it cannot be
		// detected, and it cannot be rebuilt out of. Four releases tried
		// (m100, m106, m107, m113). In the same broken tab a media element
		// playing the same file was audible every time. So this is the path.
		audios: {}, // triggerID -> the one Audio element for that sound
		paths: {}, // triggerID -> file
		brokenSounds: {}, // triggerID -> true once the file has failed to load

		// ios only lets an element play without a gesture once THAT element
		// has played under one. Every element is therefore primed inside the
		// first gesture - play, then pause in the same task, so nothing is
		// heard - and from then on the completion and log sounds, which do
		// not come from a tap, are allowed too.
		hasPrimedElements: false,
		hasGestureListeners: false,

		constructor: function () {
			return this;
		},

		addToEngine: function (engine) {
			GlobalSignals.add(this, GlobalSignals.pageSetUpSignal, this.onPageSetup)
			GlobalSignals.add(this, GlobalSignals.settingsChangedSignal, this.onSettingsChanged);

			GlobalSignals.add(this, GlobalSignals.triggerSoundSignal, this.onTriggerSound);

			GlobalSignals.add(this, GlobalSignals.actionStartingSignal, this.onActionStarted);
			GlobalSignals.add(this, GlobalSignals.actionCompletedSignal, () => this.triggerSound(UIConstants.soundTriggerIDs.actionCompleted));
		},

		removeFromEngine: function (engine) {
			GlobalSignals.removeAll(this);
		},

		initElements: function () {
			this.elements = {};
			this.elements[UIConstants.soundTriggerIDs.actionStarted] = $("#audio-action-started");
			this.elements[UIConstants.soundTriggerIDs.actionCompleted] = $("#audio-action-completed");
			this.elements[UIConstants.soundTriggerIDs.buttonClicked] = $("#audio-button-clicked");
			this.elements[UIConstants.soundTriggerIDs.moveTransition] = $("#audio-moved-camp");
			this.elements[UIConstants.soundTriggerIDs.moveNormal] = $("#audio-moved");
			this.elements[UIConstants.soundTriggerIDs.logMessage] = $("#audio-notification");
			this.elements[UIConstants.soundTriggerIDs.openPopup] = $("#audio-popup-opened");
			this.elements[UIConstants.soundTriggerIDs.closePopup] = $("#audio-popup-closed");

			this.audios = {};
			this.paths = {};
			this.brokenSounds = {};
			this.hasPrimedElements = false;

			let sys = this;
			for (let key in this.elements) {
				let path = this.elements[key].find("source").attr("src");
				this.paths[key] = path;

				if (!path) {
					this.brokenSounds[key] = true;
					continue;
				}

				// A new Audio() per trigger would fetch and decode the file
				// again on every button, tab and log line, and ios keeps a hard
				// limit on how many elements can exist at once. One per sound.
				let audio = new Audio(path);
				audio.preload = "auto";
				(function (triggerID) {
					// a file the browser cannot fetch or decode must fail once
					// here rather than on every trigger for the rest of the session
					audio.addEventListener("error", function () {
						sys.brokenSounds[triggerID] = true;
						log.w("could not load sound: " + triggerID + " (" + path + ")", sys);
					});
				})(key);
				this.audios[key] = audio;
			}

			this.addGestureListeners();
		},

		addGestureListeners: function () {
			if (this.hasGestureListeners) return;
			this.hasGestureListeners = true;

			let sys = this;
			let onGesture = function () { sys.primeElements(); };
			document.addEventListener("touchend", onGesture, true);
			document.addEventListener("pointerdown", onGesture, true);
			document.addEventListener("keydown", onGesture, true);
		},

		// Runs inside the first gesture. Each element is started and stopped
		// in the same task, which is enough for the browser to count it as
		// played under a gesture and short enough that no audio is rendered.
		primeElements: function () {
			if (this.hasPrimedElements) return;
			this.hasPrimedElements = true;

			for (let key in this.audios) {
				let audio = this.audios[key];
				try {
					let promise = audio.play();
					audio.pause();
					try { audio.currentTime = 0; } catch (e) { }
					if (promise && promise.catch) {
						// a refusal here only means this gesture did not count;
						// the element gets primed by the first click that plays it
						promise.catch(function () { });
					}
				} catch (e) { }
			}
		},

		triggerSound: function (soundTriggerID, delay) {
			let $soundElement = this.getSoundElement(soundTriggerID);

			if (!$soundElement || $soundElement.length === 0) {
				log.w("triggered sound but audio element not found: " + soundTriggerID, this);
				return;
			}

			let sfxEnabled = GameGlobals.gameState.settings.sfxEnabled;
			if (!sfxEnabled) return;

			if (delay && delay > 0) {
				setTimeout(() => this.playSound(soundTriggerID), delay);
			} else {
				// no timer hop: the click sound starts in the same task as the
				// click, which is also what keeps it inside the gesture on ios
				this.playSound(soundTriggerID);
			}
		},

		playSound: function (soundTriggerID) {
			if (GameGlobals.gameState.uiStatus.isHidden) {
				if (GameConstants.isDebugVersion) log.w("skip sound because game is hidden", this);
				return;
			}

			let playTimestamp = new Date().getTime();
			let previousPlayTimestamp = this.soundTimestamps[soundTriggerID] || 0;
			if (playTimestamp - previousPlayTimestamp < 300) {
				if (GameConstants.isDebugVersion) log.w("skip sound due to repetition: " + soundTriggerID, this);
				return;
			}

			if (this.brokenSounds[soundTriggerID]) return;

			let audio = this.audios[soundTriggerID];
			if (!audio) return;

			if (GameConstants.isDebugVersion) log.i("play sound: " + soundTriggerID, this);

			if (this.previousSound && this.previousSound !== audio) {
				this.previousSound.pause();
			}

			// rewind so a repeated trigger restarts the sound rather than
			// being ignored because the element is already past the end
			try { audio.currentTime = 0; } catch (e) { }

			let sys = this;
			try {
				let promise = audio.play();
				if (promise && promise.catch) {
					promise.catch(function (e) {
						// a refused play is this one sound, this once; the
						// element stays and the next trigger tries again
						if (GameConstants.isDebugVersion) log.w("failed to play audio: " + soundTriggerID + " | " + e, sys);
					});
				}
			} catch (e) {
				if (GameConstants.isDebugVersion) log.w("failed to play audio: " + soundTriggerID + " | " + e, this);
			}

			this.previousSound = audio;
			this.soundTimestamps[soundTriggerID] = playTimestamp;
		},

		getSoundElement: function (soundTriggerID) {
			return this.elements[soundTriggerID];
		},

		onTriggerSound: function (soundTriggerID, delay) {
			this.triggerSound(soundTriggerID, delay || 0);
		},

		onActionStarted: function (action) {
			let duration = PlayerActionConstants.getDuration(action);
			if (duration <= 0) return;
			this.triggerSound(UIConstants.soundTriggerIDs.actionStarted)
		},

		onPageSetup: function () {
			this.initElements();
		},

		onSettingsChanged: function () {

		},

	});

	return UIOutAudioSystem;
});
