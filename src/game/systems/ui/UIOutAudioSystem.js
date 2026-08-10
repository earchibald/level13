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

		// Sounds play through Web Audio: every file is fetched and decoded ONCE
		// at page setup, and a trigger hands the decoded buffer straight to the
		// audio thread. Nothing on the play path touches the network, the cache
		// or the media element stack - that is where the old per-click jank
		// lived. HTMLAudio remains only as a fallback for browsers with no Web
		// Audio at all.
		audioContext: null, // shared context; one gesture unlocks it for the whole session
		buffers: {}, // triggerID -> decoded AudioBuffer, held in memory for the session
		currentSource: null, // the playing source node, so a new sound can cut it off

		audios: {}, // fallback only: triggerID -> the one Audio element for that sound
		paths: {}, // triggerID -> file
		brokenSounds: {}, // triggerID -> true once the file has failed to load or decode

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

			this.buffers = {};
			this.audios = {};
			this.paths = {};
			this.brokenSounds = {};

			for (let key in this.elements) {
				this.paths[key] = this.elements[key].find("source").attr("src");
			}

			if (this.initAudioContext()) {
				this.loadBuffers();
			} else {
				this.initFallbackElements();
			}
		},

		initAudioContext: function () {
			if (this.audioContext) return true;

			let AudioContextImpl = window.AudioContext || window.webkitAudioContext;
			if (!AudioContextImpl) return false;

			try {
				this.audioContext = new AudioContextImpl();
			} catch (e) {
				log.w("could not create audio context: " + e, this);
				this.audioContext = null;
				return false;
			}

			// Autoplay policy starts the context suspended, and ios suspends it
			// again whenever the app is backgrounded or a call comes in. Any
			// gesture resumes it. The listeners stay attached for the whole
			// session because that re-suspension can happen at any time.
			let sys = this;
			let resume = function () {
				let ctx = sys.audioContext;
				if (ctx && ctx.state !== "running") ctx.resume();
			};
			document.addEventListener("touchend", resume, true);
			document.addEventListener("pointerdown", resume, true);
			document.addEventListener("keydown", resume, true);

			return true;
		},

		loadBuffers: function () {
			let sys = this;
			let promisesByPath = {};

			for (let key in this.paths) {
				let path = this.paths[key];

				if (!path) {
					this.brokenSounds[key] = true;
					continue;
				}

				// triggers that share a file (the click sounds) share the request
				if (!promisesByPath[path]) {
					promisesByPath[path] = fetch(path)
						.then(function (response) {
							if (!response.ok) throw new Error("http " + response.status);
							return response.arrayBuffer();
						})
						.then(function (data) {
							// callback form: the promise form of decodeAudioData is
							// missing from ios versions this game still supports
							return new Promise(function (resolve, reject) {
								sys.audioContext.decodeAudioData(data, resolve, reject);
							});
						});
				}

				(function (triggerID) {
					promisesByPath[path].then(function (buffer) {
						sys.buffers[triggerID] = buffer;
					}).catch(function (e) {
						// a file the browser cannot fetch or decode must fail once
						// here rather than on every trigger for the rest of the session
						sys.brokenSounds[triggerID] = true;
						log.w("could not load sound: " + triggerID + " (" + sys.paths[triggerID] + ") | " + e, sys);
					});
				})(key);
			}
		},

		initFallbackElements: function () {
			// no Web Audio: one media element per sound, reused for every play.
			// A new Audio() per trigger would fetch and decode the file again,
			// and on ios only an element that has already played under a gesture
			// may play without one.
			let sys = this;
			for (let key in this.paths) {
				let path = this.paths[key];
				if (!path) {
					this.brokenSounds[key] = true;
					continue;
				}
				let audio = new Audio(path);
				audio.preload = "auto";
				(function (triggerID) {
					audio.addEventListener("error", function () {
						sys.brokenSounds[triggerID] = true;
						log.w("could not load sound: " + triggerID + " (" + path + ")", sys);
					});
				})(key);
				this.audios[key] = audio;
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
				// no timer hop: the click sound starts in the same frame as the click
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

			if (GameConstants.isDebugVersion) log.i("play sound: " + soundTriggerID, this);

			let buffer = this.buffers[soundTriggerID];
			if (buffer) {
				this.playBuffer(buffer);
				this.soundTimestamps[soundTriggerID] = playTimestamp;
				return;
			}

			this.playFallback(soundTriggerID, playTimestamp);
		},

		playBuffer: function (buffer) {
			let ctx = this.audioContext;

			// waiting for the resume promise would lose the moment - a source
			// started on a suspended context plays as soon as the resume lands
			if (ctx.state !== "running") ctx.resume();

			if (this.currentSource) {
				try { this.currentSource.stop(); } catch (e) { }
			}

			// source nodes are one-shot and effectively free to create;
			// the decoded buffer is what is shared between plays
			let source = ctx.createBufferSource();
			source.buffer = buffer;
			source.connect(ctx.destination);
			source.start();
			this.currentSource = source;
		},

		playFallback: function (soundTriggerID, playTimestamp) {
			let audio = this.audios[soundTriggerID];
			if (!audio) return;

			if (this.previousSound) {
				this.previousSound.pause();
			}

			// rewind so a repeated trigger restarts the sound rather than
			// being ignored because the element is already past the end
			try { audio.currentTime = 0; } catch (e) { }

			audio.play().catch(e => {
				log.w("failed to play audio: " + soundTriggerID + " | " + e, this);
			});

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
