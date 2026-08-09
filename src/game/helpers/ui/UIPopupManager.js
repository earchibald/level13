// Manages showing and hiding pop-ups
define(['ash', 'text/Text', 'core/ExceptionHandler', 'game/GameGlobals', 'game/GlobalSignals', 'game/constants/UIConstants'],
function (Ash, Text, ExceptionHandler, GameGlobals, GlobalSignals, UIConstants) {

	let UIPopupManager = Ash.Class.extend({

		popupQueue: null,
		hiddenQueue: null,

		elements: {},

		showOverlayCounter: 0,
		
		constructor: function () {
			this.popupQueue = [];
			this.hiddenQueue = [];

			this.elements.overlay = $("#popup-overlay");
			
			GlobalSignals.add(this, GlobalSignals.windowResizedSignal, this.onWindowResized);
			GlobalSignals.add(this, GlobalSignals.popupResizedSignal, this.onPopupResized);

			this.elements.overlay.click(ExceptionHandler.wrapClick(function (e) {
				if (e.target == e.currentTarget) {
					GameGlobals.uiFunctions.popupManager.dismissPopups();
				}
			}));
		},
		
		// options:
		// - isMeta (bool) - default false
		// - isDismissable (bool) - default derived from other params
		// - forceShowInventoryManagement (bool) - default false
		// - setupCallback - callback to set up the popup before it's actually shown
		showPopup: function (title, msg, okButtonLabel, cancelButtonLabel, resultVO, okCallback, cancelCallback, options) {
			options = options || {};
			let isMeta = options.isMeta || false;
			let forceShowInventoryManagement = options.forceShowInventoryManagement;

			let action = options.action;
			
			// Booleans, not maybe-booleans. Both of these reach jQuery's toggleClass as
			// its second argument, and toggleClass(name, undefined) does not set the
			// class - it TOGGLES it. With no resultVO and no override both were
			// undefined, so #info-ok gained and lost inventory-selection-ok, action and
			// button-popup-escape on alternate popups: ESC worked on every other results
			// popup and did nothing on the ones in between, which is exactly how it
			// looked in play.
			let hasResult = !!resultVO;
			let showInventoryManagement = !!(hasResult || forceShowInventoryManagement);
			
			let isDismissable = options.isDismissable || (typeof options.isDismissable == 'undefined' && !showInventoryManagement && !cancelButtonLabel);
			
			if (GameGlobals.gameState.uiStatus.isHidden && !isMeta) {
				log.i("queue popup (" + title + ")", "ui");
				this.hiddenQueue.push({ title: title, msg: msg, okButtonLabel: okButtonLabel, cancelButtonLabel: cancelButtonLabel, resultVO: resultVO, okCallback: okCallback, cancelCallback: cancelCallback, options: options });
				return;
			}
			
			if (this.hasOpenPopup()) {
				log.i("queue popup (" + title + ")", "ui");
				this.popupQueue.push({ title: title, msg: msg, okButtonLabel: okButtonLabel, cancelButtonLabel: cancelButtonLabel, resultVO: resultVO, okCallback: okCallback, cancelCallback: cancelCallback, options: options });
				return;
			}
			
			log.i("show popup (" + title + ")", "ui");

			GameGlobals.gameState.uiStatus.isBusyCounter++;
			
			// use the same popup container for all popups
			let popUpManager = this;
			let $popup = $("#common-popup");
			
			// text
			GameGlobals.uiFunctions.toggle("#common-popup-input-container", false);
			$("#common-popup h3").text(title);
			$("#common-popup p#common-popup-desc").html(msg || "");
			
			// results and rewards
			GameGlobals.uiFunctions.toggle("#info-results", showInventoryManagement);
			$("#info-results").empty();
			if (showInventoryManagement) {
				let rewardDiv = GameGlobals.playerActionResultsHelper.getRewardDiv(resultVO, { forceShowInventoryManagement: forceShowInventoryManagement });
				$("#info-results").append(rewardDiv);
				GameGlobals.uiFunctions.generateInfoCallouts("#reward-div");
			}
			
			// buttons and callbacks
			var $defaultButton = null;
			$("#common-popup .buttonbox").empty();

			// a popup with neither an action nor an OK label is cancel-only; without
			// this guard it grew a button captioned "null"
			if (!action && okButtonLabel) {
				$("#common-popup .buttonbox").append("<button id='info-ok' class='action'>" + okButtonLabel + "</button>");
				$("#info-ok").attr("action", showInventoryManagement ? "accept_inventory" : null);
				$("#info-ok").toggleClass("inventory-selection-ok", showInventoryManagement);
				$("#info-ok").toggleClass("action", showInventoryManagement);
				$("#info-ok").click(ExceptionHandler.wrapClick(function (e) {
					e.stopPropagation();
					popUpManager.handleOkButton(false, okCallback);
				}));
				$defaultButton = $("#info-ok");
			}
			
			// boolean for the same reason as showInventoryManagement above
			let showTakeAll = !!(hasResult && resultVO.hasSelectable());
			if (showTakeAll) {
				// marked for ENTER the same way the fight popup's own take-all is, so the
				// key means the same thing wherever loot is being claimed. Not also
				// .inventory-selection-takeall: that class is what hides the fight
				// popup's button once there is nothing left to take, and this one is
				// built fresh per popup and has never been hidden that way
				$("#common-popup .buttonbox").append("<button id='confirmation-takeall' class='action button-popup-enter' action='take_all'>Take all</button>");
				$("#confirmation-takeall").click(ExceptionHandler.wrapClick(function (e) {
					popUpManager.handleOkButton(true, okCallback);
				}));
				$defaultButton = $("#confirmation-takeall");
			}

			if (action) {
				let baseActionID = GameGlobals.playerActionsHelper.getBaseActionID(action);
				// not every base action has a name string (crafting does not), so
				// callers may name the button themselves
				let actionName = okButtonLabel || Text.t("game.actions." + baseActionID + "_name");
				$("#common-popup .buttonbox").append("<button id='info-action' class='action' action='" + action + "'>" + actionName + "</button>");
				$("#info-action").click(ExceptionHandler.wrapClick(function (e) {
					popUpManager.handleOkButton(true, okCallback);
				}));
			}
			
			if (cancelButtonLabel) {
				$("#common-popup .buttonbox").append("<button id='confirmation-cancel'>" + cancelButtonLabel + "</button>");
				$("#confirmation-cancel").click(ExceptionHandler.wrapClick(function (e) {
					if (!GameGlobals.gameState.isPlayerInputAccepted()) return;
					popUpManager.closePopup("common-popup");
					if (cancelCallback) cancelCallback();
				}));
			}

			// a results popup can't be dismissed, but ESC still takes its safe option (continue / take selected)
			// while ENTER goes to "take all"; popups with a cancel button already give ESC something to do
			$("#info-ok").toggleClass("button-popup-escape", showInventoryManagement && !cancelButtonLabel);

			// and where there is nothing to take all, ENTER is the OK button itself. An
			// inventory popup with nothing selectable in it answered neither key: ESC had
			// this button and ENTER had no button at all, so the only way past it was the
			// mouse. Only when there is no take-all, because #info-ok is appended first
			// and would otherwise win the ENTER that belongs to "Take all".
			$("#info-ok").toggleClass("button-popup-enter", showInventoryManagement && !showTakeAll);

			if ($defaultButton == null) {
				$defaultButton = $("#confirmation-cancel");
			}

			if ($defaultButton != null) {
				$defaultButton.toggleClass("button-popup-default", true);
			}

			if (options.setupCallback) {
				options.setupCallback();
			}
			
			// overlay
			$popup.toggleClass("popup-meta", isMeta);
			$popup.toggleClass("popup-ingame", !isMeta);

			this.showOverlay(() => {
				popUpManager.repositionPopup($popup);
				
				let slideTime = GameGlobals.gameState.uiStatus.isInitialized ? UIConstants.POPUP_FADE_IN_DURATION : 0;
				
				GameGlobals.uiFunctions.slideToggleIf($popup, null, true, slideTime, slideTime, () => {
					log.i("showed popup", "ui");
					popUpManager.repositionPopup($popup);
					GlobalSignals.popupShownSignal.dispatch("common-popup");
				});

				GlobalSignals.popupOpenedSignal.dispatch("common-popup");
				
				GameGlobals.uiFunctions.createButtons("#common-popup .buttonbox");
				
				this.setDismissable($popup, isDismissable);
				GameGlobals.uiFunctions.focus($defaultButton);
				this.updatePause();

				setTimeout(() => {
					GameGlobals.gameState.uiStatus.isBusyCounter--;
				}, 200);
			});
		},

		showOverlay: function (cb) {
			this.showOverlayCounter++;

			if (this.showOverlayCounter > 1) {
				cb();
				return;
			}
			
			GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.openPopup, 100);

			this.elements.overlay.stop().fadeIn(UIConstants.POPUP_OVERLAY_FADE_IN_DURATION, cb);
		},

		hideOverlay: function () {
			this.showOverlayCounter--;

			if (this.showOverlayCounter > 0) return;
			if (this.showOverlayCounter < 0) this.showOverlayCounter = 0;
			
			GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.closePopup, 100);

			this.elements.overlay.stop().fadeOut(UIConstants.POPUP_OVERLAY_FADE_OUT_DURATION);
		},

		setDismissable: function ($popup, isDismissable) {
			$popup.attr("data-dismissable", isDismissable);
			$popup.attr("data-dismissed", "false");
		},

		updatePause: function () {
			let hasOpenPopup = this.hasOpenPopup();
			GameGlobals.gameState.isPaused = hasOpenPopup;
			
			$("body").css("overflow", hasOpenPopup ? "hidden" : "initial");
			$(".hidden-by-popups").attr("aria-hidden", hasOpenPopup);

			if (hasOpenPopup) {
				$(".hidden-by-popups").attr("inert", hasOpenPopup);
			} else {
				$(".hidden-by-popups").removeAttr("inert");
			}
		},
		
		handleOkButton: function (isTakeAll, okCallback) {
			let id = "common-popup";
			if (!GameGlobals.gameState.isPlayerInputAccepted()) return;
			if (this.isClosing(id)) {
				log.w("popup already closing: " + id)
				return;
			}
			let canClose =  !okCallback || okCallback(isTakeAll) !== false;
			if (!canClose) return;
			GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.buttonClicked);
			this.closePopup(id);
		},
		
		closePopup: function (id) {
			let popupManager = this;
			$("#" + id).data("closing", true);

			if (popupManager.popupQueue.length === 0) {
				GlobalSignals.popupClosingSignal.dispatch(id);
				$("#" + id).data("fading", true);
				GameGlobals.uiFunctions.slideToggleIf($("#" + id), null, false, UIConstants.POPUP_FADE_OUT_DURATION, UIConstants.POPUP_FADE_OUT_DURATION, function () {
					$("#" + id).data("fading", false);
					$("#" + id).data("closing", false);
					$("#" + id + "p#common-popup-desc").html("");
					popupManager.showQueuedPopup();
					popupManager.updatePause();
					setTimeout(() => { GlobalSignals.popupClosedSignal.dispatch(id); });
				});

				// ensure hideOverlay is called even if animation is stopped by another popup opening
				setTimeout(() => {
					popupManager.hideOverlay();
				}, UIConstants.POPUP_FADE_OUT_DURATION);
			} else {
				$("#" + id).data("fading", false);
				$("#" + id).data("closing", false);
				GameGlobals.uiFunctions.toggle("#" + id, false);
				popupManager.showQueuedPopup();
				popupManager.updatePause();
				popupManager.hideOverlay();
				setTimeout(() => { GlobalSignals.popupClosedSignal.dispatch(id); });
			}
		},
		
		repositionPopups: function () {
			$.each($(".popup"), function () {
				GameGlobals.uiFunctions.popupManager.repositionPopup($(this));
			});
		},

		repositionPopup: function ($popup) {
			// visualViewport tracks the area not covered by the software keyboard
			let winh = window.visualViewport ? window.visualViewport.height : $(window).height();
			let winw = window.visualViewport ? window.visualViewport.width : $(window).width();
			let isSmallLayout = winw <= UIConstants.SMALL_LAYOUT_THRESHOLD;
			let padding = isSmallLayout ? 0 : 20;

			// small layout popups are border-box with padding; content-box
			// height()/width() would under-measure by ~44px and off-center them
			let popuph = Math.min(isSmallLayout ? $popup.outerHeight() : $popup.height(), winh);
			let popupw = Math.min(isSmallLayout ? $popup.outerWidth() : $popup.width(), winw);
			$popup.css("top", Math.max(0, (winh - popuph) / 2 - padding));
			$popup.css("left", (winw - popupw) / 2);
		},
		
		closeHidden: function (ok) {
			if (this.hiddenQueue.length > 0) {
				let hidden = this.hiddenQueue.pop();
				if (ok) {
					if (hidden.okCallback) hidden.okCallback();
				} else {
					if (hidden.cancelCallback) hidden.cancelCallback();
				}
			}
		},
		
		closeAllPopups: function () {
			this.popupQueue = [];
			var popupManager = this;
			$.each($(".popup:visible"), function () {
				popupManager.closePopup($(this).attr("id"));
			});
			this.updatePause();
		},
		
		dismissPopups: function () {
			var popupManager = this;
			$.each($(".popup:visible"), function () {
				let dataDismissable = $(this).attr("data-dismissable");
				let isDismissable = dataDismissable == true || dataDismissable == "true";
				if (isDismissable) {
					popupManager.dismissPopup($(this));
				} else {
					popupManager.triggerEscapeButton($(this));
				}
			});
			this.updatePause();
		},

		// a popup that is not dismissable can still offer a safe option on ESC, such as "take selected"
		//
		// :visible, because a popup can hold several states' buttons at once and show one
		// set at a time - the fight popup keeps all six in the page and toggles them. The
		// first match won regardless of whether it was on screen, so ESC pressed over the
		// loot pressed a hidden "Flee".
		triggerEscapeButton: function ($popup) {
			if (!GameGlobals.gameState.isPlayerInputAccepted()) return;
			let $escapeButton = $popup.find(".button-popup-escape:visible").first();
			if ($escapeButton.length == 0) return;
			if ($escapeButton.hasClass("btn-disabled")) return;
			let dataDismissed = $popup.attr("data-dismissed");
			if (dataDismissed == true || dataDismissed == "true") return;
			let dataToggling = $popup.attr("data-toggling");
			if (dataToggling == true || dataToggling == "true") return;
			$popup.attr("data-dismissed", "true");
			$escapeButton.trigger("click");
		},

		// What ENTER means in the popup that is open: fight, take all, carry on. Marked in
		// the markup rather than found by id, so a popup that builds its own buttons - the
		// fight popup does - is reachable by the same key as the common one.
		getEnterButton: function () {
			return $(".popup:visible").find(".button-popup-enter:visible").first();
		},

		hasEnterButton: function () {
			let $button = this.getEnterButton();
			return $button.length > 0 && !$button.hasClass("btn-disabled");
		},

		triggerEnterButton: function () {
			if (!GameGlobals.gameState.isPlayerInputAccepted()) return;
			let $button = this.getEnterButton();
			if ($button.length == 0) return;
			if ($button.hasClass("btn-disabled")) return;
			$button.trigger("click");
		},

		dismissPopup: function ($popup) {
			if (!GameGlobals.gameState.isPlayerInputAccepted()) return;
			let dataDismissed = $popup.attr("data-dismissed");
			if (dataDismissed == true || dataDismissed == "true") return;
			let dataToggling = $popup.attr("data-toggling");
			if (dataToggling == true || dataToggling == "true") return;
			$popup.attr("data-dismissed", "true");
			// dismissing means cancelling when there is a cancel button (Esc must not confirm)
			let $cancelButton = $popup.find("#confirmation-cancel");
			if ($cancelButton.length > 0) {
				$cancelButton.trigger("click");
				return;
			}
			$popup.find(".button-popup-default").trigger("click");
		},
		
		showQueuedPopup: function () {
			if (this.popupQueue.length > 0) {
				let queued = this.popupQueue.pop();
				this.showPopup(queued.title, queued.msg, queued.okButtonLabel, queued.cancelButtonLabel, queued.resultVO, queued.okCallback, queued.cancelCallback, queued.options);
			} else {
				this.updatePause();
			}
		},

		isClosing: function (id) {
			return $("#" + id).data("closing") === true;
		},
		
		hasOpenPopup: function () {
			return $(".popup:visible").length > 0;
		},
		
		onWindowResized: function () {
			this.repositionPopups();
		},
		
		onPopupResized: function () {
			this.repositionPopups();
		},
		
	});

	return UIPopupManager;
});
