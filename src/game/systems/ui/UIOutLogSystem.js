define([
	'ash',
	'text/Text',
	'utils/UIList',
	'utils/UIToastStack',
	'utils/MathUtils',
	'game/GameGlobals',
	'game/GlobalSignals',
	'game/constants/LogConstants',
	'game/constants/TextConstants',
	'game/nodes/LogNode',
	'game/nodes/PlayerPositionNode',
	'game/constants/UIConstants',
	'game/vos/PositionVO'],
function (Ash, Text, UIList, UIToastStack, MathUtils, GameGlobals, GlobalSignals, LogConstants, TextConstants, LogNode, PlayerPositionNode, UIConstants, PositionVO) {

	let UIOutLogSystem = Ash.System.extend({
	
		gameState: null,
		logNodes: null,
		playerPositionNodes: null,
		
		lastUpdateTimeStamp: 0,
		updateFrequency: 1000 * 15,

		currentMessages: [],

		ambientMessagesByTrigger: {}, // trigger -> list of ids

		constructor: function () {
			this.initElements();
			this.initAmbientMessages();
		},

		addToEngine: function (engine) {
			this.logNodes = engine.getNodeList(LogNode);
			this.playerPositionNodes = engine.getNodeList(PlayerPositionNode);

			GlobalSignals.add(this, GlobalSignals.markLogMessagesSeenSignal, this.onMarkLogMessagesSeen);
			GlobalSignals.add(this, GlobalSignals.playerPositionChangedSignal, function (position) { this.onPlayerPositionChanged(position); });
			GlobalSignals.add(this, GlobalSignals.windowResizedSignal, this.onWindowResized);
			GlobalSignals.add(this, GlobalSignals.gameResetSignal, this.onGameReset);
			GlobalSignals.add(this, GlobalSignals.gameShownSignal, this.onWindowResized);
			GlobalSignals.add(this, GlobalSignals.triggerSignal, this.onTrigger);

			this.updateMessages();
		},

		removeFromEngine: function (engine) {
			this.logNodes = null;
			this.playerPositionNodes = null;
			GlobalSignals.removeAll(this);
		},

		initElements: function () {
			this.logList = UIList.create(this, $("#log ul"), this.createLogListItem, this.updateLogListItem, this.isLogListItemDataSame);
			this.logListLatest = UIList.create(this, $("#log-latest ul"), this.createLogListItem, this.updateLogListItem, this.isLogListItemDataSame);
			this.toastStack = UIToastStack.create($("#log-toasts-list"));
		},
		
		initAmbientMessages: function () {
			for (let messageID in LogConstants.ambientMessages) {
				let def = LogConstants.ambientMessages[messageID];
				def.id = messageID;
				let triggers = def.triggers;
				for (let i = 0; i < triggers.length; i++) {
					let trigger = triggers[i];
					if (!this.ambientMessagesByTrigger[trigger]) {
						this.ambientMessagesByTrigger[trigger] = [];
					}
					this.ambientMessagesByTrigger[trigger].push(def.id);
				}
			}
		},

		update: function () {
			if (GameGlobals.gameState.uiStatus.isHidden) return;
			if (GameGlobals.gameState.isPaused) return;
			
			var timeStamp = new Date().getTime();
			var isTime = timeStamp - this.lastUpdateTimeStamp > this.updateFrequency;
			
			let hasNewMessages = false;
			for (var node = this.logNodes.head; node; node = node.next) {
				hasNewMessages = hasNewMessages || node.logMessages.hasNewMessages;
				node.logMessages.hasNewMessages = false;
			}
		
			if (!hasNewMessages && !isTime) return;
			
			this.updateMessages();
			this.lastUpdateTimeStamp = timeStamp;
		},
		
		updateMessages: function () {
			this.pruneMessages();

			let messages = [];
			for (let node = this.logNodes.head; node; node = node.next) {
				messages = messages.concat(node.logMessages.messages);
				node.logMessages.hasNewMessages = false;
			}
			
			this.updateMessageList(messages.reverse());
			this.updateOpacity();
		},
	
		updateMessageList: function (messages) {
			if (!this.playerPositionNodes.head) return;

			let playerPosition = this.playerPositionNodes.head.position;

			if (!playerPosition) return;

			let shownMessages = messages.filter(m => GameGlobals.playerHelper.isLogMessageVisible(m));

			let newItems = UIList.update(this.logList, shownMessages);
			let latestMessages = newItems.map(li => li.data).filter(m => !m.markedAsSeen && !m.loadedFromSave);
			
			UIList.update(this.logListLatest, latestMessages);

			this.updateToasts(latestMessages);

			let hasNewMessages = false;

			for (let i = 0; i < shownMessages.length; i++) {
				if (!shownMessages[i].hasBeenShown) {
					log.i("mark as shown: " + shownMessages[i].message);
					shownMessages[i].hasBeenShown = true;
					hasNewMessages = true;
				}
			}

			if (hasNewMessages) {
				GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.logMessage, 300);
			}

			for (let i = 0; i < newItems.length; i++) {
				newItems[i].$root.toggle(false);
				newItems[i].$root.fadeIn(600);
			}

			this.currentMessages = shownMessages;

			// reading the log is opening the drawer, so anything that arrives
			// while it is already open counts as read straight away
			if ($("body").hasClass("log-drawer-open")) {
				this.markLogMessagesSeen();
			} else {
				this.updateLogBadge();
			}
		},

		// A message that arrives while the drawer is closed is invisible until
		// the player thinks to look at the badge, which only says that
		// something happened. Each new one also gets a few seconds on screen.
		//
		// Nothing here touches markedAsSeen. A glance is not a read, so the
		// badge keeps counting a toasted message until the drawer opens.
		updateToasts: function (messages) {
			if (!this.toastStack) return;
			if (GameGlobals.gameState.uiStatus.isHidden) return;
			// the regular layout has the log column on screen already
			if (!$("body").hasClass("layout-small")) return;
			// so does an open drawer
			if ($("body").hasClass("log-drawer-open")) return;

			// Backwards, because this list is newest-first: updateMessages hands
			// updateMessageList a reversed list so the drawer reads newest at
			// the top. Cards read the other way - oldest at the top, each new
			// one arriving below it - and, more importantly, the cap evicts by
			// push order. Pushed newest-first, a burst of five would evict the
			// newest four and leave the three oldest on screen.
			for (let i = messages.length - 1; i >= 0; i--) {
				UIToastStack.push(this.toastStack, this.getMessageText(messages[i]));
			}
		},

		createLogListItem: function () {
			let li = {};
			li.$root = $("<li class='log-entry'><span class='time'></span><span class='msg-camp-level'></span><span class='msg'></span><span class='msg-count'></span></li>");
			li.$spanTime = li.$root.find(".time");
			li.$spanLevel = li.$root.find(".msg-camp-level");
			li.$spanMsg = li.$root.find(".msg");
			return li;
		},

		updateLogListItem: function (li, data) {
			let hasPosition = data.position != null;
			let visibility = data.visibility;

			let positionText = "";
			if (visibility == LogConstants.MSG_VISIBILITY_GLOBAL) {
				positionText = "";
			} else if (visibility == LogConstants.MGS_VISIBILITY_LEVEL) {
				positionText = " (level " + data.position.level + ")";
			} else if (visibility == LogConstants.MSG_VISIBILITY_CAMP) {
				positionText += "";
			} else if (hasPosition) {
				positionText += " (";
				let campNode = GameGlobals.campHelper.getCampNodeForLevel(data.position.level);
				if (data.position.inCamp && campNode) {
					positionText += UIConstants.getCampDisplayName(campNode, true);
				} else {
					positionText += new PositionVO(data.position.level, data.position.sectorX, data.position.sectorY).getInGameFormat(true, true);
				}
				positionText += ")"
			}

			let message = this.getMessageText(data);

			let timestamp = data.timestamp;

			if (!timestamp && data.time) timestamp = data.time; // backwards compatibility

			li.$root.toggleClass("log-loaded", (data.loadedFromSave || data.markedAsSeen == true));
			li.$root.attr("data-loadedFromSave", data.loadedFromSave);
			li.$root.attr("data-hasBeenShown", data.hasBeenShown);
			li.$root.attr("data-markedAsSeen", data.markedAsSeen);
			li.$spanMsg.text(message);
			li.$spanTime.text(UIConstants.getTimeSinceText(timestamp) + " ago");
			li.$spanLevel.toggle(hasPosition);
			if (hasPosition) li.$spanLevel.text(positionText);
		},

		// One rendering of a message, so the entry in the drawer and the card
		// that flashes up cannot drift apart.
		getMessageText: function (data) {
			let message = "";

			if (data.text) message = data.text; // backwards compatibility

			if (data.messageTextVO) message = Text.compose(data.messageTextVO);

			message = LogConstants.cleanupMessage(message);
			return TextConstants.sentencify(message);
		},

		isLogListItemDataSame: function (d1, d2) {
			if (d1.logMsgID != d2.logMsgID) return false;
			if (d1.timestamp != d2.timestamp) return false;
			if (d1.time != d2.time) return false;
			if (!d1.messageTextVO || !d2.messageTextVO) return false;
			if (d1.messageTextVO.textFragments.length != d2.messageTextVO.textFragments.length) return false;
			for (let i = 0; i < d1.messageTextVO.textFragments.length; i++) {
				if (!d1.messageTextVO.textFragments[i] || !d2.messageTextVO.textFragments[i]) continue;
				if (d1.messageTextVO.textFragments[i].textKey != d2.messageTextVO.textFragments[i].textKey) return false;
			}

			return true;
		},

		markLogMessagesSeen: function () {
			if (!this.currentMessages || this.currentMessages.length == 0) return;

			for (let i = 0; i < this.currentMessages.length; i++) {
				if (!this.currentMessages[i].markedAsSeen) {
					log.i("mark as seen: " + this.currentMessages[i].message);
					this.currentMessages[i].markedAsSeen = true;
				}
			}

			this.updateLogBadge();
		},

		// On a phone the log lives behind a button, so entries arriving unread
		// are otherwise invisible. This counts the same messages the log itself
		// treats as unseen, so opening the drawer clears the badge through the
		// game's existing seen-marking rather than a counter of its own.
		updateLogBadge: function () {
			let $button = $("#btn-log-toggle");
			if ($button.length == 0) return;

			let unread = 0;
			if (this.currentMessages) {
				for (let i = 0; i < this.currentMessages.length; i++) {
					let message = this.currentMessages[i];
					if (!message.markedAsSeen && !message.loadedFromSave) unread++;
				}
			}

			if (unread <= 0) {
				$button.removeAttr("data-unread");
				return;
			}

			$button.attr("data-unread", unread > 99 ? "99+" : unread);
		},

		updateOpacity: function () {
			let fadeThreshold = 70;
			let fadeArea = 100 - fadeThreshold;

			$.each($(".log-entry"), function () {
				let entry = $(this);

				let entryPosition = entry.offset().top;
				let scrollTop = $(window).scrollTop();
				let windowHeight = $(window).height();
			
				let distanceToTop = entryPosition - scrollTop;
				let distanceToTopPercent = Math.round((distanceToTop / windowHeight) * 100);
				let distanceToFadeThreshold = MathUtils.map(distanceToTopPercent - fadeThreshold, 0, fadeArea, 0, 100);

				let opacityLevelRaw = 1 - distanceToFadeThreshold / 100;
				let opacityLevel = Math.min(1, Math.max(0, opacityLevelRaw));
				
				$(this).css("opacity", opacityLevel);
			});
		},
		
		pruneMessages: function () {
			let maxMessagesByKey = 30;

			let getVisibilityKey = function (message) {
				if (!message.position) return "global";
				if (message.visibility == LogConstants.MSG_VISIBILITY_GLOBAL) return "global";
				if (message.visibility == LogConstants.MSG_VISIBILITY_CAMP) return "camp";
				if (message.visibility == LogConstants.MGS_VISIBILITY_LEVEL) return "level-" + message.position.level;
				if (message.position.inCamp) return  "in-" + message.position.level;
				return "out";
			}

			for (let node = this.logNodes.head; node; node = node.next) {
				let nodeMessages = node.logMessages.messages;
				let messagesToPrune = [];
				let messagesByKey = {};

				for (let i = nodeMessages.length - 1; i >= 0; i--) {
					let message = nodeMessages[i];
					let k = getVisibilityKey(message);
					if (!messagesByKey[k]) messagesByKey[k] = [];

					if (messagesByKey[k].length > maxMessagesByKey) {
						messagesToPrune.push(message);
					}

					messagesByKey[k].push(message);
				}

				for (let i = 0; i < messagesToPrune.length; i++) {
					let messageToPrune = messagesToPrune[i];
					let index = nodeMessages.indexOf(messageToPrune);
					nodeMessages.splice(index, 1);
				}
			}
		},

		triggerAmbientMessages: function (triggerID, triggerParam) {
			let messageIDs = this.ambientMessagesByTrigger[triggerID];
			if (!messageIDs || messageIDs.length == 0) return;
			
			for (let i = 0; i < messageIDs.length; i++) {
				if (this.triggerAmbientMessage(messageIDs[i], triggerParam)) {
					return;
				}
			}
		},
		
		triggerAmbientMessage: function (messageID, triggerParam) {
			let def = LogConstants.ambientMessages[messageID];
			if (!def) {
				log.w("No such ambient log message found: [" + messageID + "]", this);
				return false;
			}
			
			if (!this.isAmbientMessageAvailable(messageID, triggerParam)) {
				return false;
			}

			let msgKey = def.message;

			if (def.messages && def.messages.length > 0) {
				msgKey = MathUtils.randomElement(def.messages);
			}
			
			let options = {};
			if (def.visibility) {
				options.visibility = def.visibility;
			}
			
			let msg = Text.t(msgKey);
			GameGlobals.playerHelper.addLogMessage(messageID, msg, options);
			return true;
		},

		isAmbientMessageAvailable: function (messageID, triggerParam) {
			let def = LogConstants.ambientMessages[messageID];
			if (!def) {
				return false;
			}

			let chance = def.chance || 1;
			if (Math.random() > chance) {
				return false;
			}
			
			if (this.isAmbientMessageShownRecently(messageID)) {
				return false;
			}
			
			if (!this.isAmbientMessageConditionsMet(def.conditions, triggerParam)) {
				return false;
			}
			
			return true;
		},

		isAmbientMessageShownRecently: function (messageID) {
			if (!this.currentMessages) return false;
			for (let i  = 0; i < this.currentMessages.length; i++) {
				if (this.currentMessages[i].logMsgID == messageID) return true;
			}
			return false;
		},

		isAmbientMessageConditionsMet: function (conditions, triggerParam) {
			let reqsCheck = GameGlobals.playerActionsHelper.checkGeneralRequirementaInternal(conditions);
			if (reqsCheck.value < 1) return false;

			let paramsCheck = GameGlobals.playerActionsHelper.checkTriggerParams(conditions, triggerParam);
			if (!paramsCheck) return false;

			return true;
		},
		
		onTrigger: function (triggerID, param) {
			this.triggerAmbientMessages(triggerID, param);
		},

		onGameReset: function () {
			this.lastUpdateTimeStamp = 0;
			UIToastStack.clear(this.toastStack);
		},

		onMarkLogMessagesSeen: function () {
			this.markLogMessagesSeen();
			// the drawer is opening, so the cards would be repeating what is
			// now on screen underneath them
			UIToastStack.clear(this.toastStack);
		},

		onPlayerPositionChanged: function (position) {
			this.updateMessages();
		},

		onWindowResized: function () {
			this.updateOpacity();
		}

	});

	return UIOutLogSystem;
});
