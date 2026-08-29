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
		// Audio at all, and for a context that cannot be rebuilt.
		audioContext: null, // shared context; one gesture unlocks it for the whole session
		buffers: {}, // triggerID -> decoded AudioBuffer, held in memory for the session
		currentSource: null, // the playing source node, so a new sound can cut it off

		// ios takes the audio session away whenever something else wants it - a
		// call, siri, an alarm, or simply backgrounding an installed pwa long
		// enough. The context object survives in js but its audio unit does not,
		// and webkit reports the corpse as "running" while its clock stands
		// still, so every later play is silently dropped. Nothing throws and
		// nothing logs: that is the "sound just stops after a while" symptom.
		// The context is therefore watched rather than trusted, and rebuilt when
		// it stops keeping time.
		audioClockSample: null, // { ctxTime, wallTime, state } from the last watchdog tick
		audioWatchdogInterval: null,
		needsAudioContextRebuild: false,
		audioContextRebuilds: 0,
		lastAudioContextRebuildTime: 0,
		hasGestureListeners: false,
		hasLifecycleListeners: false,
		pendingPlayWhileSuspended: 0, // wall time of the oldest sound still waiting for a resume
		lastGestureTime: 0, // wall time of the last gesture, so an unlocked context can be told from a locked one
		isWebAudioAbandoned: false, // true once rebuilding has failed too often

		audios: {}, // fallback only: triggerID -> the one Audio element for that sound
		paths: {}, // triggerID -> file
		brokenSounds: {}, // triggerID -> true once the file has failed to load or decode

		// A rebuild is cheap, and a long session may legitimately need several -
		// every call and every alarm costs one. Only a burst of them says the
		// browser will not give us a working context at all, so the count is
		// what happened within one quiet period, not what happened all session.
		maxAudioContextRebuilds: 5,
		audioContextRebuildResetDelay: 1000 * 60,

		// how long a sound may sit waiting for a resume before the context
		// counts as stuck rather than slow
		stalledResumeDelay: 3000,

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
			this.stopAudioWatchdog();
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
				this.startAudioWatchdog();
			} else {
				this.initFallbackElements();
			}
		},

		initAudioContext: function () {
			if (this.audioContext) return true;
			if (this.isWebAudioAbandoned) return false;

			let AudioContextImpl = window.AudioContext || window.webkitAudioContext;
			if (!AudioContextImpl) return false;

			try {
				this.audioContext = new AudioContextImpl();
			} catch (e) {
				log.w("could not create audio context: " + e, this);
				this.audioContext = null;
				return false;
			}

			this.needsAudioContextRebuild = false;
			this.audioClockSample = null;
			this.watchAudioContextState(this.audioContext);
			this.addGestureListeners();
			this.addLifecycleListeners();

			return true;
		},

		// Autoplay policy starts the context suspended, and ios suspends it
		// again whenever the app is backgrounded or a call comes in. Any
		// gesture resumes it. The listeners stay attached for the whole
		// session because that re-suspension can happen at any time, and they
		// are attached only once because a rebuild must not stack another set.
		addGestureListeners: function () {
			if (this.hasGestureListeners) return;
			this.hasGestureListeners = true;

			let sys = this;
			let onGesture = function () {
				sys.lastGestureTime = new Date().getTime();

				// a gesture is the only moment the browser lets us build or
				// start a context, so it is where a pending rebuild is spent
				if (sys.needsAudioContextRebuild) {
					sys.rebuildAudioContext();
					return;
				}
				sys.resumeAudioContext();
			};
			document.addEventListener("touchend", onGesture, true);
			document.addEventListener("pointerdown", onGesture, true);
			document.addEventListener("keydown", onGesture, true);
		},

		// A context is not released when its page goes away, and webkit allows
		// only a few of them per process, so one left behind by the page being
		// replaced can still hold its slot while the next page builds its own.
		// That is why a reload sometimes came back silent while a second
		// reload, or a reload from origin, did not. pagehide also fires on the
		// way into the back/forward cache, where the page may yet come back -
		// the rebuild flag then makes the next gesture build a fresh context.
		addLifecycleListeners: function () {
			if (this.hasLifecycleListeners) return;
			this.hasLifecycleListeners = true;

			let sys = this;
			window.addEventListener("pagehide", function () {
				if (!sys.audioContext) return;
				sys.closeAudioContext();
				sys.needsAudioContextRebuild = true;
			});
		},

		// closing is the same three steps wherever the context is dropped: stop
		// listening to the corpse, forget everything measured about it, and let
		// the audio session go
		closeAudioContext: function () {
			let old = this.audioContext;
			this.audioContext = null;
			this.currentSource = null;
			this.audioClockSample = null;
			this.pendingPlayWhileSuspended = 0;
			if (!old) return;
			old.onstatechange = null;
			try { old.close(); } catch (e) { }
		},

		watchAudioContextState: function (ctx) {
			let sys = this;
			ctx.onstatechange = function () {
				// only the live context may set the flag; a closed predecessor
				// fires this too while it is being torn down
				if (sys.audioContext !== ctx) return;

				if (GameConstants.isDebugVersion) log.i("audio context state: " + ctx.state, sys);

				// "interrupted" is webkit-only and means the audio session is
				// gone; "closed" cannot be revived at all. Neither recovers by
				// itself here, so both mean rebuild on the next gesture.
				if (ctx.state === "interrupted" || ctx.state === "closed") {
					sys.needsAudioContextRebuild = true;
				}
			};
		},

		resumeAudioContext: function () {
			let ctx = this.audioContext;
			if (!ctx) return;
			if (ctx.state === "running") return;

			// resume rejects on a context whose session is gone, and an ignored
			// rejection is exactly how this failure used to stay invisible
			try {
				let promise = ctx.resume();
				if (promise && promise.catch) {
					let sys = this;
					promise.catch(function (e) {
						if (sys.audioContext !== ctx) return;
						log.w("could not resume audio context, will rebuild: " + e, sys);
						sys.needsAudioContextRebuild = true;
					});
				}
			} catch (e) {
				log.w("could not resume audio context, will rebuild: " + e, this);
				this.needsAudioContextRebuild = true;
			}
		},

		// The clock is the only honest report of whether audio is alive: a
		// context that claims to be running must advance currentTime with wall
		// time. Two consecutive normal-length ticks that claim "running" and do
		// not advance mean the audio unit is gone.
		startAudioWatchdog: function () {
			if (this.audioWatchdogInterval) return;
			let sys = this;
			this.audioWatchdogInterval = setInterval(function () { sys.checkAudioClock(); }, 2000);
		},

		stopAudioWatchdog: function () {
			if (!this.audioWatchdogInterval) return;
			clearInterval(this.audioWatchdogInterval);
			this.audioWatchdogInterval = null;
		},

		checkAudioClock: function () {
			let ctx = this.audioContext;
			if (!ctx) return;

			let sample = { ctxTime: ctx.currentTime, wallTime: new Date().getTime(), state: ctx.state };
			let previous = this.audioClockSample;
			this.audioClockSample = sample;

			if (!previous) return;

			// a frozen or backgrounded page does not run timers, so a long gap
			// says nothing about the audio unit - re-baseline and wait. A sound
			// queued before such a gap proves nothing either.
			let wallDelta = (sample.wallTime - previous.wallTime) / 1000;
			if (wallDelta < 1.5 || wallDelta > 8) {
				this.pendingPlayWhileSuspended = 0;
				return;
			}

			if (this.checkStalledResume(sample)) return;

			if (previous.state !== "running" || sample.state !== "running") return;

			let ctxDelta = sample.ctxTime - previous.ctxTime;
			if (ctxDelta > wallDelta * 0.25) return;

			log.w("audio context is running but its clock is stopped, will rebuild", this);
			this.needsAudioContextRebuild = true;
		},

		// A source started on a suspended context is queued and plays the
		// moment the resume lands. When the resume never lands - webkit neither
		// rejects it nor changes the state - the sound is simply lost, and the
		// clock check above cannot see it because that only judges a context
		// that claims to be running. Only a sound that was actually wanted
		// counts: a suspended context with nothing to play is ordinary power
		// saving, not a fault.
		checkStalledResume: function (sample) {
			if (sample.state === "running") {
				this.pendingPlayWhileSuspended = 0;
				return false;
			}

			if (!this.pendingPlayWhileSuspended) return false;
			if (document.visibilityState !== "visible") return false;

			// A context nobody has unlocked yet is locked, not stuck: autoplay
			// policy keeps it suspended until the first gesture, and the game
			// does play sounds before that gesture ever comes. Only a sound
			// that came after a gesture says anything about a resume, and a
			// sound from before one is forgotten rather than held against the
			// context for the rest of the session.
			if (!this.lastGestureTime) return false;
			if (this.pendingPlayWhileSuspended < this.lastGestureTime) {
				this.pendingPlayWhileSuspended = 0;
				return false;
			}
			if (sample.wallTime - this.pendingPlayWhileSuspended < this.stalledResumeDelay) return false;

			log.w("audio context did not resume for a sound that was played, will rebuild", this);
			this.pendingPlayWhileSuspended = 0;
			this.needsAudioContextRebuild = true;
			return true;
		},

		rebuildAudioContext: function () {
			if (this.isWebAudioAbandoned) return false;

			this.needsAudioContextRebuild = false;

			let now = new Date().getTime();
			let sinceLastRebuild = now - this.lastAudioContextRebuildTime;
			if (sinceLastRebuild > this.audioContextRebuildResetDelay) this.audioContextRebuilds = 0;
			this.lastAudioContextRebuildTime = now;
			this.audioContextRebuilds++;

			if (this.audioContextRebuilds > this.maxAudioContextRebuilds) {
				log.w("giving up on web audio after " + (this.audioContextRebuilds - 1) + " rebuilds, using media elements", this);
				this.abandonWebAudio();
				return false;
			}

			log.i("rebuilding audio context (" + this.audioContextRebuilds + ")", this);

			this.closeAudioContext();

			if (!this.initAudioContext()) {
				this.abandonWebAudio();
				return false;
			}

			// decoding detached the arraybuffers, so the decoded buffers are all
			// there is to carry over. An AudioBuffer is not owned by a context,
			// so the new one can play them; if this browser disagrees, reload.
			if (!this.canReuseBuffers()) {
				this.buffers = {};
				this.brokenSounds = {};
				this.loadBuffers();
			}

			this.resumeAudioContext();
			return true;
		},

		canReuseBuffers: function () {
			let ctx = this.audioContext;
			if (!ctx) return false;

			// one buffer answers for all of them: either this browser accepts a
			// buffer decoded by another context or it accepts none
			for (let key in this.buffers) {
				try {
					let source = ctx.createBufferSource();
					source.buffer = this.buffers[key];
					return true;
				} catch (e) {
					log.w("decoded buffers cannot be reused after rebuild, reloading: " + e, this);
					return false;
				}
			}

			return false; // nothing decoded yet, so there is nothing to keep
		},

		abandonWebAudio: function () {
			this.isWebAudioAbandoned = true;
			this.needsAudioContextRebuild = false;
			this.stopAudioWatchdog();

			this.closeAudioContext();

			this.buffers = {};
			this.brokenSounds = {};
			this.initFallbackElements();
		},

		loadBuffers: function () {
			let sys = this;
			let ctx = this.audioContext;
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
								ctx.decodeAudioData(data, resolve, reject);
							});
						});
				}

				(function (triggerID) {
					promisesByPath[path].then(function (buffer) {
						// a load that lands after a rebuild belongs to the dead
						// context's round and must not overwrite the new buffers
						if (sys.audioContext !== ctx) return;
						sys.buffers[triggerID] = buffer;
					}).catch(function (e) {
						if (sys.audioContext !== ctx) return;
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
				if (this.audios[key]) continue;

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

			// a trigger is usually a click, so this is the first chance to spend
			// a pending rebuild if the gesture listener has not already done it
			if (this.needsAudioContextRebuild) this.rebuildAudioContext();

			if (this.brokenSounds[soundTriggerID]) return;

			if (GameConstants.isDebugVersion) log.i("play sound: " + soundTriggerID, this);

			let buffer = this.buffers[soundTriggerID];
			if (buffer && this.audioContext) {
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
			this.resumeAudioContext();

			// remember that a sound is waiting on the resume, so the watchdog
			// can tell a resume that never lands from an idle context
			if (ctx.state === "running") {
				this.pendingPlayWhileSuspended = 0;
			} else if (!this.pendingPlayWhileSuspended) {
				this.pendingPlayWhileSuspended = new Date().getTime();
			}

			if (this.currentSource) {
				try { this.currentSource.stop(); } catch (e) { }
			}

			// source nodes are one-shot and effectively free to create;
			// the decoded buffer is what is shared between plays
			let sys = this;
			let source = null;
			try {
				source = ctx.createBufferSource();
				source.buffer = buffer;
				source.connect(ctx.destination);
				source.start();
			} catch (e) {
				// a context whose session died throws here rather than going
				// quiet; either way the answer is a new context
				log.w("could not play sound, will rebuild audio context: " + e, this);
				this.needsAudioContextRebuild = true;
				return;
			}

			// an ended node stays in the graph until it is dropped, and a session
			// of clicks leaves a long tail of them behind the destination
			source.onended = function () {
				try { source.disconnect(); } catch (e) { }
				if (sys.currentSource === source) sys.currentSource = null;
			};

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
