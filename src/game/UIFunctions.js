// A class that checks raw user input from the DOM and passes game-related actions to PlayerActionFunctions
define(['ash',
	'text/Text',
	'core/ExceptionHandler',
	'game/GameGlobals',
	'game/GlobalSignals',
	'game/constants/CheatConstants',
	'game/constants/GameConstants',
	'game/constants/CampConstants',
	'game/constants/EnemyConstants',
	'game/constants/UIConstants',
	'game/constants/ItemConstants',
	'game/constants/PlayerActionConstants',
	'game/constants/PlayerStatConstants',
	'game/helpers/ui/UIPopupManager',
	'game/vos/ResourcesVO',
	'game/vos/PositionVO',
	'utils/ActionButton',
	'utils/MathUtils',
	'utils/StringUtils',
],
	function (Ash, Text, ExceptionHandler, GameGlobals, GlobalSignals, CheatConstants, GameConstants, CampConstants, EnemyConstants, UIConstants, ItemConstants, PlayerActionConstants, PlayerStatConstants, UIPopupManager, ResourcesVO, PositionVO, ActionButton, MathUtils, StringUtils) {

		// TODO separate generic utils and tabs handling to a different file

		var UIFunctions = Ash.Class.extend({

			context: "UIFunctions",
			popupManager: null,

			hotkeys: {},

			// actions the context-sensitive ENTER hotkey can trigger, in priority order
			// buttons for these actions show the hint even though the hotkey has no fixed action
			contextHotkeyActions: [ "enter_camp", "move_level_up", "move_level_down", "leave_camp" ],

			// hotkeys with custom callbacks whose buttons should still show a badge
			manualHotkeyHints: { "move_camp_level": "B" },

			texts: [],

			HOTKEY_DEFAULT_MODIFIER: "HOTKEY_DEFAULT_MODIFIER",
			HOTKEY_DEFAULT_MODIFIER_KEY: "shiftKey",

			elementIDs: {
				tabs: {
					bag: "switch-bag",
					explorers: "switch-explorers",
					projects: "switch-projects",
					map: "switch-map",
					trade: "switch-trade",
					in: "switch-in",
					out: "switch-out",
					upgrades: "switch-upgrades",
					world: "switch-world",
					milestones: "switch-milestones",
					embark: "switch-embark"
				},
			},

			constructor: function () {
				this.popupManager = new UIPopupManager(this);
			},
			
			init: function () {
				$("body").toggleClass("touch", UIConstants.isTouchScreen());
				this.updateStandaloneMode();
				this.registerHotkeys();
				this.generateElements();
				this.hideElements();
				this.registerListeners();
				this.registerGlobalMouseEvents();
				this.registerTouchAndMobileListeners();
			},

			registerListeners: function () {
				var uiFunctions = this;

				$(window).resize(this.onResize);

				// Switch tabs
				let onTabClickedInternal = function (e) {
					let target = e.currentTarget;
					if (!($(target).hasClass("disabled"))) {
						GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.buttonClicked);
						uiFunctions.onTabClicked(target.id);
					}
				};
				$.each($("#switch-tabs li"), function () {
					$(this).click(onTabClickedInternal);
					$(this).keydown((e) => uiFunctions.onButtonLikeElementKeyDown(e, onTabClickedInternal));
					$(this).append("<span class='tab-hotkey-number' aria-hidden='true'></span>");
				});

				GlobalSignals.popupClosedSignal.add(function () {
					uiFunctions.lastPopupClosedTimestamp = new Date().getTime();
				});

				// Collapsible divs
				this.registerCollapsibleContainerListeners("");

				// Steppers and stepper buttons
				this.registerStepperListeners("");

				// Meta/non-action buttons
				$("#btn-save").click(function (e) {
					GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.buttonClicked);
					GlobalSignals.saveGameSignal.dispatch(GameConstants.SAVE_SLOT_DEFAULT, true);
				});
				$("#btn-restart").click(function (e) {
					GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.buttonClicked);
					uiFunctions.onRestartButton();
				});
				$("#btn-more").click(function (e) {
					GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.buttonClicked);
					let wasVisible = $("#game-options-extended").is(":visible");
					uiFunctions.showGameOptions(!wasVisible);
				});
				$("#btn-importexport").click(function (e) {
					GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.buttonClicked);
					uiFunctions.showManageSave();
				});
				$("#btn-stats").click(function (e) {
					uiFunctions.showStatsPopup();
				});
				$("#game-stats-popup-close").click(function (e) {
					GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.buttonClicked);
					uiFunctions.popupManager.closePopup("game-stats-popup");
				});
				$("#btn-settings").click(function (e) {
					GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.buttonClicked);
					let options = { isMeta: true, isDismissable: true };
					uiFunctions.showSpecialPopup("settings-popup", options);
				});
				$("#settings-popup-close").click(function (e) {
					GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.buttonClicked);
					uiFunctions.popupManager.closePopup("settings-popup");
				});
				$("#btn-info").click(function (e) {
					GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.buttonClicked);
					uiFunctions.showInfoPopup("Level 13", uiFunctions.getGameInfoDiv(), null, null, null, true, true);
				});
				$("#out-action-fight-close").click(this.onMetaButtonClicked);
				$("#out-action-fight-continue").click(this.onMetaButtonClicked);

				$("#in-assign-workers input.amount").change(function (e) {
					var assignment = {};
					for (var key in CampConstants.workerTypes) {
						assignment[key] = parseInt($("#stepper-" + key + " input").val());
					}
					GameGlobals.playerActionFunctions.assignWorkers(null, assignment);
				});

				// Buttons: In: Other
				$("#btn-header-rename").click(function (e) {
					GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.buttonClicked);
					var prevCampName = GameGlobals.playerActionFunctions.getNearestCampName();
					uiFunctions.showInput(
						"Rename Camp",
						"Give your camp a new name",
						prevCampName,
						true,
						function (input) {
							GameGlobals.playerActionFunctions.setNearestCampName(input);
						},
						null,
						CampConstants.MAX_CAMP_NAME_LENGTH
					);
				});
				
				$(document).on("keyup", this.onKeyUp);
			},

			registerGlobalMouseEvents: function () {
				// pointer events cover both mouse and touch, so hold-to-repeat works on touch too
				GameGlobals.gameState.uiStatus.mouseDown = false;
				GameGlobals.gameState.uiStatus.mouseDownElement = null;
				$(document).on('pointerleave', function (e) {
					GameGlobals.gameState.uiStatus.mouseDown = false;
					GameGlobals.gameState.uiStatus.mouseDownElement = null;
				});
				$(document).on('pointerup pointercancel', function (e) {
					GameGlobals.gameState.uiStatus.mouseDown = false;
					GameGlobals.gameState.uiStatus.mouseDownElement = null;
				});
				$(document).on('pointerdown', function (e) {
					GameGlobals.gameState.uiStatus.mouseDown = true;
					GameGlobals.gameState.uiStatus.mouseDownElement = e.target;
				});
			},

			registerTouchAndMobileListeners: function () {
				let uiFunctions = this;
				let isTouch = UIConstants.isTouchScreen();

				// checkbox labels toggle their checkbox (all devices)
				$(document).on("click", ".checkbox-label", function () {
					let $box = $(this).prevAll("input[type='checkbox']").first();
					if ($box.length == 0 || $box.prop("disabled")) return;
					$box.prop("checked", !$box.prop("checked")).trigger("change");
				});

				// mobile log drawer toggle (small layout only, see mobile css)
				$("#btn-log-toggle").click(function () {
					GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.buttonClicked);
					let isOpening = !$("body").hasClass("log-drawer-open");
					$("body").toggleClass("log-drawer-open");
					// opening the drawer is reading the log: clear the unread
					// badge through the game's own seen-marking
					if (isOpening) GlobalSignals.markLogMessagesSeenSignal.dispatch();
				});

				// adventurer detail in camp (small layout only, see mobile css).
				// The stats it reveals are already in the header markup and
				// already current, so this only decides what is on screen.
				$("#btn-adventurer").click(function () {
					GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.buttonClicked);
					let isOpen = !$("body").hasClass("adventurer-open");
					$("body").toggleClass("adventurer-open", isOpen);
					$(this).attr("aria-expanded", isOpen);
				});

				// keep popups centered within the VISIBLE viewport (the software
				// keyboard shrinks it on phones)
				if (window.visualViewport) {
					window.visualViewport.addEventListener("resize", function () {
						uiFunctions.popupManager.repositionPopups();
						uiFunctions.reclampOpenCallout();
					});
				}

				if (!isTouch) return;

				// tap toggles info callouts (hover is not available on touch)
				$(document).on("click", ".info-callout-target", function (e) {
					if ($(e.target).closest("button, a, input, select, textarea").length > 0) return;
					// lists where tap already moves the item (trade, reward selection):
					// there the callout would fight the primary action
					if ($(this).closest(".inventorydivision, .resultlist, #resultlist-inventorymanagement").length > 0) return;
					let $container = $(this).closest(".callout-container");
					if ($container.length == 0) return;
					let wasOpen = $container.hasClass("callout-visible");
					uiFunctions.closeAllCallouts();
					if (!wasOpen) {
						uiFunctions.openCallout($container, $(this));
					}
				});

				// crafting and location scouting open a dialog instead of a callout
				// card (see showActionConfirmPopup). Capture phase, so it runs
				// before the action handler and before the callout handlers below.
				document.addEventListener("click", function (e) {
					if (!$("body").hasClass("layout-small")) return;
					if (!e.target.closest) return;
					let container = e.target.closest(".container-btn-action");
					if (!container) return;
					let button = container.querySelector("button.action");
					if (!button) return;
					let $button = $(button);
					if (!uiFunctions.isDialogActionButton($button)) return;
					// the popup's own confirm button is an action button too, and
					// it must be allowed through
					if (container.closest("#common-popup")) return;
					e.preventDefault();
					e.stopPropagation();
					uiFunctions.closeAllCallouts();
					uiFunctions.showActionConfirmPopup($button);
				}, true);

				// tap on a disabled action button shows its callout (costs + disabled
				// reason). Native disabled buttons swallow clicks, so the handler sits
				// on the wrapper and CSS gives the disabled button pointer-events:none.
				$(document).on("click", ".container-btn-action", function (e) {
					let $btn = $(this).children("button");
					if (!$btn.hasClass("btn-disabled")) return;
					if ($(e.target).closest("button:not(.btn-disabled), a").length > 0) return;
					let $container = $(this).closest(".callout-container");
					if ($container.length == 0) return;
					let wasOpen = $container.hasClass("callout-visible");
					uiFunctions.closeAllCallouts();
					if (!wasOpen) {
						uiFunctions.openCallout($container, $btn);
					}
				});

				// long-press on an enabled action button previews its callout instead of acting
				let longPressDelay = 500;
				$(document).on("pointerdown", ".container-btn-action > button", function (e) {
					if (e.pointerType === "mouse") return;
					// these buttons answer a tap with a dialog; a long-press card
					// would be the very thing that was falling off the screen
					if ($("body").hasClass("layout-small") && uiFunctions.isDialogActionButton($(this))) return;
					let btn = this;
					let $btn = $(btn);
					// a stale flag from an aborted long-press must not swallow this tap
					btn.dataset.longPressFired = "false";
					uiFunctions.cancelLongPress($btn);
					let timer = setTimeout(function () {
						btn.dataset.longPressFired = "true";
						let $container = $btn.closest(".callout-container");
						uiFunctions.closeAllCallouts();
						uiFunctions.openCallout($container, $btn);
					}, longPressDelay);
					$btn.data("long-press-timer", timer);
				});
				$(document).on("pointerup pointercancel pointerleave pointermove", ".container-btn-action > button", function (e) {
					if (e.type == "pointermove") return; // small jitter should not cancel; click suppression handles fired presses
					uiFunctions.cancelLongPress($(this));
				});
				// suppress the click that follows a long-press (capture phase runs before the action handler)
				document.addEventListener("click", function (e) {
					let btn = e.target.closest ? e.target.closest(".container-btn-action > button") : null;
					if (btn && btn.dataset.longPressFired === "true") {
						btn.dataset.longPressFired = "false";
						e.preventDefault();
						e.stopPropagation();
					}
				}, true);
				// long-press should not open the browser context menu on buttons
				$(document).on("contextmenu", ".container-btn-action", function (e) {
					e.preventDefault();
				});

				// long-press on trade/reward list items previews the item info;
				// a quick tap keeps its primary meaning there (move the item)
				let listItemSelector = ".inventorydivision li, .resultlist li, #resultlist-inventorymanagement li";
				$(document).on("pointerdown", listItemSelector, function (e) {
					if (e.pointerType === "mouse") return;
					let li = this;
					let $li = $(li);
					li.dataset.lpInfoFired = "false";
					uiFunctions.cancelLongPress($li);
					let timer = setTimeout(function () {
						let $container = $li.find(".callout-container").first();
						if ($container.length == 0) return;
						li.dataset.lpInfoFired = "true";
						uiFunctions.closeAllCallouts();
						uiFunctions.openCallout($container, $container.children(".info-callout-target").first());
					}, longPressDelay);
					$li.data("long-press-timer", timer);
				});
				$(document).on("pointerup pointercancel pointerleave", listItemSelector, function (e) {
					uiFunctions.cancelLongPress($(this));
				});
				// after an info long-press, the release click must not move the item
				document.addEventListener("click", function (e) {
					let li = e.target.closest ? e.target.closest("li") : null;
					if (li && li.dataset && li.dataset.lpInfoFired === "true") {
						li.dataset.lpInfoFired = "false";
						e.preventDefault();
						e.stopPropagation();
					}
				}, true);
				$(document).on("contextmenu", listItemSelector, function (e) {
					e.preventDefault();
				});

				// tap outside closes open callouts
				$(document).on("click", function (e) {
					if ($(e.target).closest(".callout-container").length > 0) return;
					uiFunctions.closeAllCallouts();
				});
			},

			isTouchUI: function () {
				return UIConstants.isTouchScreen();
			},

			// installed to the home screen there is no browser chrome, so the game
			// owns the whole screen: the css uses this to spend the reclaimed space
			// and to pad for the status bar and home indicator itself
			isStandalone: function () {
				if (window.navigator.standalone === true) return true; // iOS
				if (!window.matchMedia) return false;
				return window.matchMedia("(display-mode: standalone)").matches
					|| window.matchMedia("(display-mode: fullscreen)").matches
					|| window.matchMedia("(display-mode: minimal-ui)").matches;
			},

			updateStandaloneMode: function () {
				let uiFunctions = this;
				$("body").toggleClass("standalone", this.isStandalone());
				if (!window.matchMedia) return;
				let query = window.matchMedia("(display-mode: standalone)");
				if (!query.addEventListener) return;
				query.addEventListener("change", function () {
					$("body").toggleClass("standalone", uiFunctions.isStandalone());
				});
			},

			openCallout: function ($container, $target) {
				$container.addClass("callout-visible");
				// while a tap callout is open the content layer paints above the
				// fixed header (see mobile css)
				$("body").addClass("callout-open");
				// fire the same hooks hover fires so callout content and buttons refresh
				if ($target) $target.trigger("mouseenter");
				this.clampCalloutToViewport($container, $target);
				GlobalSignals.elementToggledSignal.dispatch();

				// the systems listening above fill in costs and requirement lines,
				// so the card can still grow after this frame. Measuring once
				// clamped a card that was not its final height yet.
				let uiFunctions = this;
				this.openCalloutElements = { $container: $container, $target: $target };
				requestAnimationFrame(function () {
					if (!$container.hasClass("callout-visible")) return;
					uiFunctions.clampCalloutToViewport($container, $target);
				});
			},

			// COMMITTING ACTIONS ON A PHONE
			// Crafting an item and scouting a location both cost real resources,
			// and both showed those costs on a card hanging off a button in a long
			// scrolling list, where it ran past the bottom of the screen. On small
			// layout a tap opens a dialog instead: the same costs and reasons, in a
			// box that is centred and scrollable, with an explicit confirm.

			isDialogActionButton: function ($btn) {
				let action = $btn.attr("action");
				if (!action) return false;
				if (action.indexOf("craft_") === 0) return true;
				// scouting a named location. The plain sector scout is deliberately
				// not here: it is repeated many times per excursion, so a confirm
				// on it is a tax rather than a safeguard.
				if (action.indexOf("scout_locale_") === 0) return true;
				if (action === "clear_workshop") return true;
				// research, and upgrading a camp building or a collector: one-off
				// and expensive, and their cost cards were the worst offenders in
				// a long list
				if (action.indexOf("unlock_upgrade_") === 0) return true;
				if (action.indexOf("improve_in_") === 0) return true;
				if (action.indexOf("improve_out_") === 0) return true;
				return false;
			},

			showActionConfirmPopup: function ($btn) {
				let action = $btn.attr("action");
				let title = this.getActionPopupTitle($btn, action);
				let isDisabled = $btn.hasClass("btn-disabled");
				let msg = this.getActionPopupMessage($btn);

				if (isDisabled) {
					// nothing to confirm, so the only way out is back
					this.popupManager.showPopup(title, msg, null, "Cancel", null, null, null, { isDismissable: true });
					return;
				}

				// the popup builds a real action button, so the game's own rules
				// decide what the action costs and does
				this.popupManager.showPopup(title, msg, this.getActionPopupConfirmLabel($btn, action), "Cancel", null, null, null, {
					isDismissable: true,
					action: action,
				});
			},

			// the upgrade arrow is a glyph, so it cannot name the dialog itself;
			// the row it sits in is named by its build button
			getActionPopupTitle: function ($btn, action) {
				let label = ($btn.find(".btn-label").text() || $btn.text() || "").trim();
				let isGlyph = !(label.length > 0 && /[a-z0-9]/i.test(label));
				// the upgrade arrow is a glyph and every research button just says
				// "unlock" - in both cases the row names the thing, in its first cell
				let preferRow = isGlyph || action.indexOf("unlock_upgrade_") === 0;

				if (preferRow) {
					let rowLabel = this.getRowLabel($btn);
					if (rowLabel) return rowLabel;
				}

				if (!isGlyph) return label;

				let name = this.getActionName(action);
				return name || "Confirm";
			},

			getActionPopupConfirmLabel: function ($btn, action) {
				if (action.indexOf("craft_") === 0) return "Craft";
				if (action.indexOf("scout_locale_") === 0) return "Scout";
				if (action === "clear_workshop") return "Scout";
				if (action.indexOf("unlock_upgrade_") === 0) return "Unlock";
				if (action.indexOf("improve_") === 0) return "Upgrade";
				let name = this.getActionName(action);
				if (name) return name;
				return ($btn.find(".btn-label").text() || "Confirm").trim();
			},

			// what the row calls itself: its own button's label, or its first cell
			// with the hidden callout cards stripped out (they carry the whole
			// description and cost list and would swallow the title)
			getRowLabel: function ($btn) {
				let $cell = $btn.closest("tr").children("td").first();
				if ($cell.length === 0) return null;

				let label = $cell.find(".btn-label").first().text().replace(/\s+/g, " ").trim();
				if (!label) {
					let $clone = $cell.clone();
					$clone.find("div.btn-callout, div.info-callout").remove();
					label = $clone.text().replace(/\s+/g, " ").trim();
				}

				if (!label || label.length > 40) return null;
				return label;
			},

			getActionName: function (action) {
				let baseActionID = GameGlobals.playerActionsHelper.getBaseActionID(action);
				let key = "game.actions." + baseActionID + "_name";
				let name = Text.t(key);
				return name && name !== key ? name : null;
			},

			// reuse the callout's own markup so the costs keep the colours and
			// wording the rest of the game uses for what you cannot afford
			getActionPopupMessage: function ($btn) {
				let $content = $btn.parent().siblings("div.btn-callout").children(".btn-callout-content");
				if ($content.length == 0) return "";
				let $clone = $content.clone();
				$clone.find("[id]").removeAttr("id");
				return $("<div class='action-dialog'></div>").append($clone).prop("outerHTML");
			},

			// the phone toolbars hide and show as the page scrolls, which changes
			// how much room an open card has
			reclampOpenCallout: function () {
				let open = this.openCalloutElements;
				if (!open || !open.$container || !open.$container.hasClass("callout-visible")) return;
				this.clampCalloutToViewport(open.$container, open.$target);
			},

			// callout cards anchor to their trigger element; near the screen edge
			// the card would overflow the viewport, so shift it back inside
			clampCalloutToViewport: function ($container, $target) {
				let $callout = $container.children("div.info-callout, div.btn-callout").first();
				if ($callout.length == 0) return;
				$callout.css({ "margin-left": "", "margin-top": "", "max-height": "" })
					.removeClass("callout-flipped callout-scrollable");
				let margin = 8;
				let viewportWidth = window.visualViewport ? window.visualViewport.width : window.innerWidth;
				let rect = $callout[0].getBoundingClientRect();
				if (rect.width == 0) return;
				let shift = 0;
				if (rect.right > viewportWidth - margin) shift = (viewportWidth - margin) - rect.right;
				// the left edge wins if the card is wider than the viewport
				if (rect.left + shift < margin) shift = margin - rect.left;
				if (shift != 0) $callout.css("margin-left", Math.round(shift) + "px");

				this.clampCalloutVertically($callout, $target, margin);
			},

			// cards open below their trigger, so one near the bottom of a long
			// list runs under the pinned action bar and off the screen. Flip it
			// above the trigger when there is room, otherwise slide it up.
			clampCalloutVertically: function ($callout, $target, margin) {
				let viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
				let bottomLimit = viewportHeight - this.getPinnedBottomHeight() - margin;
				let topLimit = this.getPinnedTopHeight() + margin;

				// a card taller than the whole band cannot be placed anywhere
				// without losing its end, so cap it and let it scroll instead
				$callout.css("max-height", Math.max(80, Math.round(bottomLimit - topLimit)) + "px");
				let element = $callout[0];
				$callout.toggleClass("callout-scrollable", element.scrollHeight > element.clientHeight + 1);

				let rect = $callout[0].getBoundingClientRect();
				if (rect.height == 0) return;
				if (rect.bottom <= bottomLimit) return;

				if ($target && $target.length > 0) {
					let targetRect = $target[0].getBoundingClientRect();
					let flippedTop = targetRect.top - rect.height - 6;
					if (flippedTop >= topLimit) {
						$callout.css("margin-top", Math.round(flippedTop - rect.top) + "px").addClass("callout-flipped");
						return;
					}
				}

				// no room either side: sit as low as fits without hiding the top
				let up = Math.max(bottomLimit - rect.bottom, topLimit - rect.top);
				if (up < 0) $callout.css("margin-top", Math.round(up) + "px");
			},

			// chrome pinned to the bottom of the screen: the main-action bar, and
			// the minimap on the exploration tab.
			//
			// The position test below finds only overlays. In the shell layout the
			// bottom chrome is instead a static flex band at the end of #unit-main,
			// so the test misses it and a callout low in the pane gets clipped by
			// the pane's own overflow. UIOutHeaderSystem already measures that band
			// for the log pill, so read its value rather than measuring it twice.
			getPinnedBottomHeight: function () {
				let shellBand = parseFloat(getComputedStyle(document.documentElement)
					.getPropertyValue("--l13-out-bottom-height"));
				let height = isNaN(shellBand) ? 0 : shellBand;
				$(".action-mirror, #out-container-compass").each(function () {
					let $bar = $(this);
					if ($bar.css("position") != "fixed") return;
					if (!$bar.is(":visible")) return;
					height = Math.max(height, $bar.outerHeight());
				});
				return height;
			},

			getPinnedTopHeight: function () {
				let height = 0;
				$("#mobile-header, #grid-switch").each(function () {
					let $el = $(this);
					if ($el.css("position") != "fixed") return;
					height = Math.max(height, $el[0].getBoundingClientRect().bottom);
				});
				return Math.max(0, height);
			},

			closeAllCallouts: function () {
				// fire the hover-out hooks so systems clear highlight state
				$(".callout-container.callout-visible").each(function () {
					$(this).children(".info-callout-target").trigger("mouseleave");
					$(this).children("div.info-callout, div.btn-callout")
						.css({ "margin-left": "", "margin-top": "", "max-height": "" })
						.removeClass("callout-flipped callout-scrollable");
				});
				$(".callout-container.callout-visible").removeClass("callout-visible");
				$("body").removeClass("callout-open");
			},

			cancelLongPress: function ($btn) {
				let timer = $btn.data("long-press-timer");
				if (timer) {
					clearTimeout(timer);
					$btn.data("long-press-timer", null);
				}
			},

			registerHotkeys: function () {
				let tabs = GameGlobals.uiFunctions.elementIDs.tabs;
				let defaultModifier = this.HOTKEY_DEFAULT_MODIFIER;
				this.registerHotkey("Move N", "KeyW", defaultModifier, tabs.out, false, false, "move_sector_north");
				this.registerHotkey("Move N", "Numpad8", defaultModifier, tabs.out, false, false, "move_sector_north");
				this.registerHotkey("Move W", "KeyA", defaultModifier, tabs.out, false, false, "move_sector_west");
				this.registerHotkey("Move W", "Numpad4", defaultModifier, tabs.out, false, false, "move_sector_west");
				this.registerHotkey("Move S", "KeyS", defaultModifier, tabs.out, false, false, "move_sector_south");
				this.registerHotkey("Move S", "Numpad2", defaultModifier, tabs.out, false, false, "move_sector_south");
				this.registerHotkey("Move E", "KeyD", defaultModifier, tabs.out, false, false, "move_sector_east");
				this.registerHotkey("Move E", "Numpad6", defaultModifier, tabs.out, false, false, "move_sector_east");
				this.registerHotkey("Move NW", "KeyQ", defaultModifier, tabs.out, false, false, "move_sector_nw");
				this.registerHotkey("Move NW", "Numpad7", defaultModifier, tabs.out, false, false, "move_sector_nw");
				this.registerHotkey("Move NE", "KeyE", defaultModifier, tabs.out, false, false, "move_sector_ne");
				this.registerHotkey("Move NE", "Numpad9", defaultModifier, tabs.out, false, false, "move_sector_ne");
				this.registerHotkey("Move SW", "KeyZ", defaultModifier, tabs.out, false, false, "move_sector_sw");
				this.registerHotkey("Move SW", "Numpad1", defaultModifier, tabs.out, false, false, "move_sector_sw");
				this.registerHotkey("Move SE", "KeyC", defaultModifier, tabs.out, false, false, "move_sector_se");
				this.registerHotkey("Move SE", "Numpad3", defaultModifier, tabs.out, false, false, "move_sector_se");

				this.registerHotkey("Scavenge", "KeyN", defaultModifier, tabs.out, false, false, "scavenge");
				this.registerHotkey("Scout", "KeyM", defaultModifier, tabs.out, false, false, "scout");
				this.registerHotkey("Collect water", "KeyG", defaultModifier, tabs.out, false, false, "use_out_collector_water");
				this.registerHotkey("Collect food", "KeyF", defaultModifier, tabs.out, false, false, "use_out_collector_food");
				this.registerHotkey("Collect 1 water", "KeyG", "shiftKey", tabs.out, false, false, "use_out_collector_water_one");
				this.registerHotkey("Collect 1 food", "KeyF", "shiftKey", tabs.out, false, false, "use_out_collector_food_one");
				this.registerHotkey("Refill water", "KeyH", defaultModifier, tabs.out, false, false, "use_spring");

				this.registerHotkey("Teleport home", "KeyH", defaultModifier, null, false, true, () => GlobalSignals.triggerCheatSignal.dispatch(CheatConstants.CHEAT_NAME_TELEPORT_HOME));
				this.registerHotkey("Pass time", "KeyK", defaultModifier, null, false, true, () => GlobalSignals.triggerCheatSignal.dispatch(CheatConstants.CHEAT_NAME_TIME + " " + 1));
				this.registerHotkey("Toggle map", "KeyL", defaultModifier, null, false, true, () => GlobalSignals.triggerCheatSignal.dispatch(CheatConstants.CHEAT_NAME_REVEAL_MAP));

				this.registerHotkey("Previous tab", "ArrowLeft", "shiftKey", null, false, false, () => GameGlobals.uiFunctions.showPreviousTab());
				this.registerHotkey("Next tab", "ArrowRight", "shiftKey", null, false, false, () => GameGlobals.uiFunctions.showNextTab());

				// number keys select the visible tabs in order; shown as one entry in the hotkey list
				for (let i = 1; i <= 9; i++) {
					let tabIndex = i - 1;
					let options = i == 1 ? { displayKey: "1-9" } : { isHiddenFromList: true };
					this.registerHotkey("Select tab", "Digit" + i, defaultModifier, null, false, false, () => GameGlobals.uiFunctions.showTabByNumber(tabIndex), options);
				}

				// ENTER acts on the current location: enter the camp, use a passage, or leave the camp (embark tab)
				// not shown in the hotkey list because it is location-specific; the buttons show the hint instead
				this.registerHotkey("Enter camp / use passage", "Enter", defaultModifier, tabs.out, false, false, () => GameGlobals.uiFunctions.triggerContextEnterAction(), { isHiddenFromList: true });
				this.registerHotkey("Enter camp / use passage", "NumpadEnter", defaultModifier, tabs.out, false, false, () => GameGlobals.uiFunctions.triggerContextEnterAction(), { isHiddenFromList: true });
				this.registerHotkey("Leave camp", "Enter", defaultModifier, tabs.embark, false, false, () => GameGlobals.uiFunctions.triggerContextEnterAction(), { isHiddenFromList: true });
				this.registerHotkey("Leave camp", "NumpadEnter", defaultModifier, tabs.embark, false, false, () => GameGlobals.uiFunctions.triggerContextEnterAction(), { isHiddenFromList: true });

				// asks for confirmation when available; shows the requirements when not
				this.registerHotkey("Back to camp", "KeyB", defaultModifier, tabs.out, false, false, () => GameGlobals.uiFunctions.triggerBackToCamp());

				this.registerHotkey("Dismiss popup", "Escape", null, null, true, false, () => GameGlobals.uiFunctions.popupManager.dismissPopups());

				// same path as more > settings; the popup contains the hotkey list
				this.registerHotkey("Settings & hotkeys", "Slash", "shiftKey", null, false, false, () => $("#btn-settings").click(), { displayKey: "?" });
			},

			registerHotkey: function (description, code, modifier, tab, isUniversal, isDev, cb, options) {
				if (!code) return;
				if (!cb) return;
				if (isDev && !GameConstants.isCheatsEnabled) return;

				modifier = modifier || null;
				tab = tab || null;
				isUniversal = isUniversal || false;
				options = options || {};

				let displayKey = options.displayKey || code.replace("Key", "").replace("Digit", "");
				let displayKeyShort = displayKey.replace("Numpad", "");

				let action = null;
				if (typeof cb === "string") {
					action = cb;
					cb = () => GameGlobals.playerActionFunctions.startAction(action);
				}

				let activeCondition = null;

				if (action && action.indexOf("move_") >= 0) {
					if (code.indexOf("Numpad") >= 0) {
						activeCondition = () => GameGlobals.gameState.settings.hotkeysNumpad;
					} else {
						activeCondition = () => !GameGlobals.gameState.settings.hotkeysNumpad;
					}
				}

				if (!this.hotkeys[code]) this.hotkeys[code] = [];

				let hotkey = { 
					activeCondition: activeCondition,
					code: code, 
					modifier: modifier, 
					description: description, 
					displayKey: displayKey, 
					displayKeyShort: displayKeyShort,
					tab: tab,
					isUniversal: isUniversal,
					isDev: isDev,
					isHiddenFromList: options.isHiddenFromList || false,
					action: action, 
					cb: cb 
				};
				this.hotkeys[code].push(hotkey);
			},

			getActionHotkey: function (action) {
				if (!action) return null;
				for (let code in this.hotkeys) {
					for (let i = 0; i < this.hotkeys[code].length; i++) {
						let hotkey = this.hotkeys[code][i];
						if (hotkey.activeCondition && !hotkey.activeCondition()) continue;
						if (hotkey.action == action) return hotkey;
					}
				}
				return null;
			},

			getActionHotkeyHint: function (action) {
				if (!action) return null;
				let hotkey = this.getActionHotkey(action);
				if (hotkey) {
					let modifier = this.getActualHotkeyModifier(hotkey.modifier);
					let prefix = modifier == "shiftKey" ? "&#8679;" : "";
					return prefix + hotkey.displayKeyShort;
				}
				if (this.contextHotkeyActions.indexOf(action) >= 0) return "&#9166;";
				if (this.manualHotkeyHints[action]) return this.manualHotkeyHints[action];
				return null;
			},

			triggerBackToCamp: function () {
				let action = "move_camp_level";
				let $btn = $("#out-action-move-camp");
				if (!$btn.is(":visible")) return;

				if (GameGlobals.playerActionsHelper.checkAvailability(action)) {
					this.showConfirmation("Go back to camp?", () => $btn.click(), false, true);
				} else {
					this.showBackToCampRequirementsPopup(action);
				}
			},

			showBackToCampRequirementsPopup: function (action) {
				let msg = "";

				let reqsResult = GameGlobals.playerActionsHelper.checkRequirements(action, false);
				if (reqsResult.value < 1 && reqsResult.reason) {
					msg += "<span class='btn-disabled-reason action-cost-blocker'>" + Text.t(reqsResult.reason) + "</span><br/><br/>";
				}

				let costs = GameGlobals.playerActionsHelper.getCosts(action);
				let costKeys = costs ? Object.keys(costs) : [];
				if (costKeys.length > 0) {
					msg += "<span class='p-meta'>Costs:</span><br/>";
					for (let i = 0; i < costKeys.length; i++) {
						let key = costKeys[i];
						let costFraction = GameGlobals.playerActionsHelper.checkCost(action, key);
						let costClass = costFraction < 1 ? "action-cost action-cost-blocker" : "action-cost";
						msg += "<span class='" + costClass + "'>" + UIConstants.getCostDisplayName(key).toLowerCase() + ": " + UIConstants.getDisplayValue(costs[key]) + "</span><br/>";
					}
				}

				if (msg.length == 0) msg = "Cannot go back to camp right now.";

				this.showInfoPopup("Back to camp", msg, "OK", null, null, false, true);
			},

			triggerContextEnterAction: function () {
				for (let i = 0; i < this.contextHotkeyActions.length; i++) {
					let $btn = $("button.action[action='" + this.contextHotkeyActions[i] + "']");
					if ($btn.length == 0) continue;
					if (!$btn.is(":visible")) continue;
					if ($btn.hasClass("btn-disabled")) continue;
					$btn.click();
					return;
				}
			},
			
			registerCustomButtonListeners: function (scope, btnClass, fn) {
				$.each($(scope + " button." + btnClass), function () {
					var $element = $(this);
					if ($element.hasClass("click-bound")) {
						log.w("trying to bind click twice! id: " + $element.attr("id"));
						return;
					}
					$element.addClass("click-bound");
					$element.click(ExceptionHandler.wrapClick(fn));
				});
			},
			
			updateButtonCooldowns: function (scope) {
				scope = scope || "";
				let updates = false;
				let sys = this;
				$.each($(scope + " button.action"), function () {
					var action = $(this).attr("action");
					if (action) {
						sys.updateButtonCooldown($(this), action);
						updates = true;
					}
				});
				return updates;
			},

			registerCollapsibleContainerListeners: function (scope) {
				var sys = this;
				$(scope + " .collapsible-header").click(function () {
					GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.buttonClicked);
					var wasVisible = $(this).next(".collapsible-content").is(":visible");
					sys.toggleCollapsibleContainer($(this), !wasVisible);
				});
				$.each($(scope + " .collapsible-header"), function () {
					sys.toggleCollapsibleContainer($(this), false);
				});
			},

			registerStepperListeners: function (scope) {
				var sys = this;
				$(scope + " .stepper button").click(function (e) {
					GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.buttonClicked);
					sys.onStepperButtonClicked(this, e);
				});
				$(scope + ' .stepper input.amount').change(function () {
					sys.onStepperInputChanged(this)
				});
				$(scope + " .stepper input.amount").focusin(function () {
					$(this).data('oldValue', $(this).val());
				});
				$(scope + ' .stepper input.amount').trigger("change");

				// All number inputs
				$(scope + " input.amount").keydown(this.onNumberInputKeyDown);
			},

			generateElements: function () {
				this.generateTabBubbles();
				this.generateResourceIndicators();
				this.generateSteppers("body");
				this.createButtons("body");
				this.generateInfoCallouts("body");
			},
			
			hideElements: function () {
				this.toggle($(".hidden-by-default"), false);
			},

			generateTabBubbles: function () {
				$("#switch li").append("<div class='bubble' style='display:none'>1</div>");
			},

			generateResourceIndicators: function () {
				for (let key in resourceNames) {
					let name = resourceNames[key];
					$("#statsbar-resources-regular").append(UIConstants.createResourceIndicator(name, false, "resources-camp-regular-" + name, true, true, true, true));
					$("#statsbar-resources-mobile").append(UIConstants.createResourceIndicator(name, false, "resources-camp-mobile-" + name, true, true, true, false));
					$("#bag-resources-regular").append(UIConstants.createResourceIndicator(name, false, "resources-bag-regular-" + name, true, true, false, false));
					$("#bag-resources-mobile").append(UIConstants.createResourceIndicator(name, false, "resources-bag-mobile-" + name, true, true, false, false));
				}
			},

			generateInfoCallouts: function (scope) {
				let isTouch = UIConstants.isTouchScreen();

				$.each($(scope + " .info-callout-target"), function () {
					let $target = $(this);

					// iOS Safari only synthesises a click on elements it considers
					// clickable. The tap handler is delegated from document, which
					// does not qualify a plain div or li, so tooltips on the chips
					// never opened. An empty listener bound to the element itself
					// does qualify it; the delegated handler then runs as usual.
					if (isTouch && !$target.data("tap-enabled")) {
						$target.data("tap-enabled", true);
						this.addEventListener("click", function () {});
					}

					let generated = $target.data("callout-generated") || $target.parent().hasClass("callout-container");
					if (generated) return;
					
					let isSidePosition = $target.hasClass("info-callout-target-side")
					let arrowClass = isSidePosition ? "callout-arrow-left" : "callout-arrow-up";
					
					$target.wrap('<div class="callout-container"></div>');
					$target.after(function () {
						let description = $(this).attr("description");
						let content = description;
						content = '<div class="' + arrowClass + '"></div><div class="info-callout-content">' + content + "</div>";
						let callout = '<div class="info-callout">' + content + '</div>';
						return callout;
					});

					$target.data("callout-generated", true);
					$target.hover(() => GlobalSignals.elementToggledSignal.dispatch());
				});

				GlobalSignals.calloutsGeneratedSignal.dispatch();
			},

			transition: function (transitionID, targetValue, duration, transitionElements, callbacks) {
				if (!transitionID) return;

				let currentTransition = this.currentTransition;

				if (currentTransition) {
					if (currentTransition.id == transitionID && currentTransition.targetValue == targetValue) return;

					this.completeTransition();
				}

				transitionElements = transitionElements || {};
				callbacks = callbacks || {};
				duration = duration || 1;
				
				let blockUI = duration > 100;
				let fade = duration > 300;
				let fadeOutDuration = fade ? duration * 0.4 : 0;
				let transitionDuration = fade ? duration * 0.2 : duration;
				let fadeInDuration = fade ? duration * 0.4 : 0;
				let transition = { id: transitionID, targetValue: targetValue, transitionElements: transitionElements, callbacks: callbacks };

				this.currentTransition = transition;

				$("body").toggleClass("ui-transition", true);
				if (blockUI) GameGlobals.gameState.uiStatus.isTransitioning = true;
				GlobalSignals.transitionStartedSignal.dispatch();

				if (callbacks.started) callbacks.started();

				this.transitionElementsOut(transitionElements, fadeOutDuration, transitionDuration, fadeInDuration);

				transition.currentTimeoutID = setTimeout(function () {
					GameGlobals.uiFunctions.transitionElementsIn(transitionElements, fadeOutDuration, transitionDuration, fadeInDuration);

					if (callbacks.toggled) callbacks.toggled();
					
					transition.currentTimeoutID = setTimeout(function () {
						GameGlobals.uiFunctions.completeTransition();
						if (callbacks.completed) callbacks.completed();
					}, transitionDuration + fadeOutDuration);
				}, fadeOutDuration);
			},

			transitionElementsOut: function (transitionElements, fadeOutDuration, transitionDuration, fadeInDuration) {
				log.i("transition elements out");

				if (transitionElements.$fadeInOut) {
					transitionElements.$fadeInOut.toggleClass("ui-transition-element", true);
					transitionElements.$fadeInOut.stop(true).animate({ opacity: 1 }, fadeOutDuration).delay(transitionDuration).animate({ opacity: 0 }, fadeInDuration);
				}

				if (transitionElements.$fadeOut) {
					transitionElements.$fadeOut.toggleClass("ui-transition-element", true);
					transitionElements.$fadeOut.stop(true).animate({ opacity: 0 }, fadeOutDuration);
				}

				if (transitionElements.$slideInOut) {
					$.each(transitionElements.$slideInOut, function () {
						GameGlobals.uiFunctions.slideToggleIf($(this), null, true, fadeOutDuration, fadeOutDuration);
					});
				}

				if (transitionElements.$slideOut) {
					$.each(transitionElements.$slideOut, function () {
						GameGlobals.uiFunctions.slideToggleIf($(this), null, false, fadeOutDuration, fadeOutDuration);
					});
				}
			},

			transitionElementsIn: function (transitionElements, fadeOutDuration, transitionDuration, fadeInDuration) {
				log.i("transition elements in");

				if (transitionElements.$fadeIn) {
					transitionElements.$fadeIn.toggleClass("ui-transition-element", true);
					transitionElements.$fadeIn.stop(true).animate({ opacity: 1 }, fadeInDuration);
				}

				if (transitionElements.$slideInOut) {
					$.each(transitionElements.$slideInOut, function () {
						GameGlobals.uiFunctions.slideToggleIf($(this), null, false, fadeInDuration, fadeInDuration);
					});
				}

				if (transitionElements.$slideIn) {
					$.each(transitionElements.$slideIn, function () {
						GameGlobals.uiFunctions.slideToggleIf($(this), null, true, fadeInDuration, fadeInDuration);
					});
				}
			},

			transitionElementsComplete: function (transitionElements) {
				log.i("transition elements complete");

				if (!transitionElements) return;

				if (transitionElements.$fadeInOut) {
					transitionElements.$fadeInOut.toggleClass("ui-transition-element", false);
					transitionElements.$fadeInOut.stop(true).animate({ opacity: 0 }, 1);
				}

				if (transitionElements.$fadeOut) {
					transitionElements.$fadeOut.toggleClass("ui-transition-element", false);
					transitionElements.$fadeOut.stop(true).animate({ opacity: 0 }, 1);
				}

				if (transitionElements.$fadeIn) {
					transitionElements.$fadeIn.toggleClass("ui-transition-element", false);
					transitionElements.$fadeIn.stop(true).animate({ opacity: 1 }, 1);
				}

				if (transitionElements.$slideInOut) {
					$.each(transitionElements.$slideInOut, function () {
						GameGlobals.uiFunctions.toggle($(this), false);
					});
				}

				if (transitionElements.$slideOut) {
					$.each(transitionElements.$slideOut, function () {
						GameGlobals.uiFunctions.toggle($(this), false);
					});
				}

				if (transitionElements.$slideIn) {
					$.each(transitionElements.$slideIn, function () {
						GameGlobals.uiFunctions.toggle($(this), true);
					});
				}
			},

			completeTransition: function () {
				let transition = this.currentTransition;

				this.currentTransition = null;
				$("body").toggleClass("ui-transition", false);
				GameGlobals.gameState.uiStatus.isTransitioning = false;

				if (!transition) return;

				clearTimeout(transition.timeoutID);

				this.transitionElementsComplete(transition.elements);
				
				GlobalSignals.transitionCompletedSignal.dispatch();
			},
			
			updateInfoCallouts: function (scope) {
				$.each($(scope + " .callout-container"), function () {
					var description = $(this).children(".info-callout-target").attr("description");
					if (description && description.length > 0) {
						$(this).find(".info-callout-content").html(description);
					}
				});
			},

			getSpecialReqsText: function (action) {
				let position = GameGlobals.sectorHelper.getCurrentActionPosition();
				let s = "";
				let specialReqs = GameGlobals.playerActionsHelper.getSpecialReqs(action);
				if (specialReqs) {
					for (let key in specialReqs) {
						switch (key) {
							case "improvementsOnLevel":
								let actionImprovementName = GameGlobals.playerActionsHelper.getImprovementNameForAction(action);
								if (actionImprovementName != improvementNames.camp) {
									for (let improvementID in specialReqs[key]) {
										let range = specialReqs[key][improvementID];
										let count = position ? GameGlobals.playerActionsHelper.getCurrentImprovementCountOnLevel(position.level, improvementID) : 0;
										let rangeText = UIConstants.getRangeText(range);
										let displayName = GameGlobals.playerActionsHelper.getImprovementDisplayName(improvementID);
										if (actionImprovementName == displayName) {
											displayName = "";
										}
										s += rangeText + " " + displayName + " on level (" + count + ")";
									}
								}
								break;
							default:
								s += key + ": " + specialReqs[key];
								log.w("unknown special req: " + key);
								break;
						}
					}
				}
				s.trim();
				return s;
			},

			generateSteppers: function (scope) {
				$(scope + " .stepper").append("<button type='button' class='btn-glyph' data-type='minus' data-field=''>-</button>");
				$(scope + " .stepper").append("<input class='amount' type='text' inputmode='numeric' pattern='[0-9]*' min='0' max='100' autocomplete='off' value='0' name='' tabindex='0'></input>");
				$(scope + " .stepper").append("<button type='button' class='btn-glyph' data-type='plus' data-field=''>+</button>");
				$(scope + " .stepper button").attr("data-field", function (i, val) {
					return $(this).parent().attr("id") + "-input";
				});
				$(scope + " .stepper button").attr("action", function (i, val) {
					return $(this).parent().attr("id") + "-" + $(this).attr("data-type");
				});
				$(scope + " .stepper input").attr("name", function (i, val) {
					return $(this).parent().attr("id") + "-input";
				});
			},

			createButtons: function (scope) {
				let $container = $(scope);

				$.each($container.find("button.action"), function () {
					if (ActionButton.isButton(this)) return;
					let button = ActionButton.create(this);
					if (!button) return;
					ActionButton.registerListener(button, GameGlobals.uiFunctions, GameGlobals.uiFunctions.onActionButtonClicked);
				});

				GameGlobals.buttonHelper.updateButtonDisabledStates(scope, true);
				this.updateHotkeyHints();

				GlobalSignals.calloutsGeneratedSignal.dispatch();
			},

			updateHotkeyHints: function () {
				let hotkeysEnabled = GameGlobals.gameState.settings.hotkeysEnabled;
				$(".hotkey-hint").toggleClass("hidden", !hotkeysEnabled);

				if (!hotkeysEnabled) return;

				$.each($("button.action"), function () {
					let $btn = $(this);
					let action = $btn.attr("action");
					let hint = GameGlobals.uiFunctions.getActionHotkeyHint(action);
					$btn.children(".hotkey-hint").html(hint ? hint : "");
				});
			},

			startGame: function () {
				log.i("Starting game..");
				var startTab = this.elementIDs.tabs.out;
				var playerPos = GameGlobals.playerActionFunctions.playerPositionNodes.head.position;
				if (playerPos.inCamp) startTab = this.elementIDs.tabs.in;
				this.showTabInstant(startTab);
			},

			/**
			 * Resets cooldown for an action. Should be called directly after an action is completed and any relevant popup is closed.
			 * @param {type} action action
			 */
			completeAction: function (action) {
				let baseId = GameGlobals.playerActionsHelper.getBaseActionID(action);
				let cooldown = PlayerActionConstants.getCooldown(baseId);
				if (cooldown > 0) {
					let locationKey = this.getLocationKey(action);
					GameGlobals.gameState.setActionCooldown(action, locationKey, cooldown);
					let button = $("button[action='" + action + "']");
					this.startButtonCooldown($(button), cooldown);
				}
			},

			showGame: function () {
				this.hideGameCounter = this.hideGameCounter || 1;
				this.hideGameCounter--;
				if (this.hideGameCounter > 0) return;
				log.i("[ui] show game ");
				this.setGameOverlay(false, false);
				this.setGameElementsVisibility(true);
				this.updateButtonCooldowns();
				this.setUIStatus(false, false);

				setTimeout(function () {
					GlobalSignals.gameShownSignal.dispatch();
				}, 1);
			},

			hideGame: function (showLoading, showThinking) {
				this.hideGameCounter = this.hideGameCounter || 0;
				this.hideGameCounter++;
				log.i("[ui] hide game (showLoading: " + showLoading + ", showThinking: " + showThinking + ")");
				showThinking = showThinking && !showLoading;
				this.setGameOverlay(showLoading, showThinking);
				this.setGameElementsVisibility(showThinking);
				this.setUIStatus(true, true);
			},
			
			blockGame: function () {
				this.setUIStatus(GameGlobals.gameState.uiStatus.isHidden, true);
			},
			
			unblockGame: function () {
				this.setUIStatus(GameGlobals.gameState.uiStatus.isHidden, false);
			},
			
			setUIStatus: function (isHidden, isBlocked) {
				isBlocked = isBlocked || isHidden;
				GameGlobals.gameState.uiStatus.isHidden = isHidden;
				GameGlobals.gameState.uiStatus.isBlocked = isBlocked;
			},
			
			setGameOverlay: function (isLoading, isThinking) {
				isThinking = isThinking && !isLoading;
				$(".loading-content").css("display", isLoading ? "block" : "none");
				$(".thinking-content").css("display", isThinking ? "block" : "none");
			},
			
			setGameElementsVisibility: function (visible) {
				$(".sticky-footer").css("display", visible ? "block" : "none");
				$("#grid-main").css("display", visible ? "block" : "none");
				$("#unit-main").css("display", visible ? "block" : "none");
				$(".hide-while-loading").css("display", visible ? "initial" : "none");
			},

			scrollToTabTop: function () {
				let element = $(document.getElementById("grid-location-header"));
				if (element.length == 0) return;

				// on a phone the document is locked and the tab content is its
				// own scroller (see APP SHELL in mobile.less), so scrolling the
				// window would do nothing at all
				let $pane = $("#grid-switch-content");
				if ($pane.length > 0 && $pane.css("overflow-y") == "auto") {
					let offset = element.offset().top - $pane.offset().top;
					if (offset < 0) $pane.animate({ scrollTop: $pane.scrollTop() + offset }, 250);
					return;
				}

				let elementTop = element.offset().top;
			    let offset = elementTop - $(window).scrollTop();

			    if (offset < 0) {
			        $('html,body').animate({scrollTop: elementTop}, 250);
			    }
			},

			restart: function () {
				$("#log ul").empty();
				this.onTabClicked(this.elementIDs.tabs.out);
				GlobalSignals.restartGameSignal.dispatch(true);
			},

			onResize: function () {
				GlobalSignals.windowResizedSignal.dispatch();
			},

			updateGameStatsPopup: function () {
				let stats = GameGlobals.playerHelper.getVisibleGameStats();

				let html = "<table class='fullwidth'>";
				for (let i in stats) {
					let category = stats[i];
					let isCategoryDebugVisible = !category.isVisible && GameConstants.isDebugVersion;
					let isCategoryVisible = category.isVisible || isCategoryDebugVisible;
					if (!isCategoryVisible) continue;

					html += "<th colspan=2 class='game-stat-category" + (isCategoryDebugVisible ? " debug-info" : "") + "'>";
					html += category.displayName;
					html += "</th>";

					for (let j in category.stats) {
						let stat = category.stats[j];

						let isDebugVisible = !stat.isVisible && GameConstants.isDebugVersion;
						let isVisible = stat.isVisible || isDebugVisible;
						if (!isVisible) continue;

						let divClasses = [ "game-stat-entry" ];
						if (isDebugVisible) divClasses.push("debug-info");
						if (stat.isInSubCategory) divClasses.push("game-stat-in-subcategory")

						if (stat.isSubCategory) {
							divClasses.push("game-stat-sub-category");
							html += "<tr><td colspan=2 class='" + divClasses.join(" ") + "'>" + stat.displayName + "</td></tr>";
							continue;
						}

						let displayValue = "-";
						if (stat.value) {
							if (stat.unit == GameConstants.gameStatUnits.seconds) {
								displayValue = UIConstants.getTimeToNum(stat.value)
							} else if (stat.isPercentage) {
								displayValue = UIConstants.roundValue(stat.value * 100) + "%";
							} else if (stat.unit == GameConstants.gameStatUnits.steps) {
								displayValue = UIConstants.roundValue(stat.value) + " steps";
							} else {
								displayValue = UIConstants.getDisplayValue(UIConstants.roundValue(stat.value));
							}
						}
						
						html += "<tr>";
						html += "<td class='" + divClasses.join(" ") + "'>";
						html += "<span class='game-stat-span game-stat-name'>" + Text.capitalize(stat.displayName) + "</span>";
						html += "</td>";

						html += "<td>"
						html += "<span class='game-stat-span game-stat-value'>" + displayValue + "</span> ";

						if (stat.entry) {
							let entryDisplay = stat.entry;
							if (stat.entry.hasOwnProperty("sectorX")) {
								entryDisplay = new PositionVO(stat.entry.level, stat.entry.sectorX, stat.entry.sectorY).getInGameFormat(true);
							} else if (stat.entry.hasOwnProperty("level")) {
								entryDisplay = "on level " + stat.entry.level;
							} else if (stat.entry.hasOwnProperty("name")) {
								entryDisplay = stat.entry.name;
							} else if (EnemyConstants.tryGetEnemy(stat.entry)) {
								entryDisplay = EnemyConstants.getEnemy(stat.entry).name;
							} else if(ItemConstants.getItemDefinitionByID(stat.entry, true)) {
								entryDisplay = ItemConstants.getItemDisplayNameFromID(stat.entry);
							} else if (stat.entry.hasOwnProperty("timestamp")) {
								entryDisplay = UIConstants.getTimeSinceText(stat.entry.timestamp);
							} else if (stat.entryUnit == GameConstants.gameStatUnits.level) {
								entryDisplay = "on level " + stat.entry;
							}
							html += "<span class='game-stat-span game-stat-highscore-entry'>(" + entryDisplay + ")</span>";
						}
						html += "</td>";


						html += "</tr>";
					}
				}
				html += "</table>";
				
				$("#game-stats-container").html(html);
				$("#game-stats-container").animate({ scrollTop: 0 });
			},

			getGameInfoDiv: function () {
				let html = "";
				html += "<span id='changelog-version'>version " + GameGlobals.changeLogHelper.getCurrentVersionNumber() + "<br/>updated " + GameGlobals.changeLogHelper.getCurrentVersionDate() + "</span>";
				html += "<p>Note that this game is still in development and many features are incomplete and unbalanced. Updates might break saves. Feedback and bug reports are appreciated!</p>";
				html += "<p>Feedback:<br/>" + GameConstants.getFeedbackLinksHTML() + "</p>";
				html += "<p>More info:<br/><a href='faq.html' target='faq'>faq</a> | <a href='changelog.html' target='changelog'>changelog</a></p>";
				return html;
			},

			onTabClicked: function (tabID, tabProps) {
				GameGlobals.uiFunctions.showTab(tabID, tabProps);
			},

			showTab: function (tabID, tabProps, isCampTransition) {
				if (GameGlobals.gameState.isLaunchStarted) return;
				if (GameGlobals.gameState.isLaunched) return;

				let isInCamp = GameGlobals.playerHelper.isInCamp();
				if (isInCamp && tabID == GameGlobals.uiFunctions.elementIDs.tabs.out) tabID == GameGlobals.uiFunctions.elementIDs.tabs.embark;

				let previousTabID = GameGlobals.gameState.uiStatus.currentTab;

				let transitionElements = {};
				transitionElements.$fadeOut = $(".tabelement, .tabbutton").filter("[data-tab!='" + tabID + "']");
				transitionElements.$fadeInOut = null;
				transitionElements.$fadeIn = $(".tabelement, .tabbutton").filter("[data-tab='" + tabID + "']");
				transitionElements.$slideOut = $(".tabcontainer").filter("[data-tab!='" + tabID + "']");
				transitionElements.$slideInOut = null;
				transitionElements.$slideIn = $(".tabcontainer").filter("[data-tab='" + tabID + "']");

				if (isCampTransition) {
					if (isInCamp) {
						transitionElements.$slideIn.add("#main-header-camp");
						transitionElements.$slideOut.add("#main-header-bag");
						transitionElements.$slideOut.add("#main-header-items");
					} else {
						transitionElements.$slideOut.add("#main-header-camp");
						transitionElements.$slideIn.add("#main-header-bag");
						transitionElements.$slideIn.add("#main-header-items");
					}
				}

				let callbacks = {
					started: () => GlobalSignals.tabClosedSignal.dispatch(previousTabID),
					toggled: () => GameGlobals.uiFunctions.setTab(tabID, tabProps),
					completed: () => GlobalSignals.tabOpenedSignal.dispatch(tabID),
				};
				
				GameGlobals.uiFunctions.transition("tab", tabID, 500, transitionElements, callbacks);
			},
			
			showTabInstant: function (tabID, tabProps) {
				let previousTabID = GameGlobals.gameState.uiStatus.currentTab;
				GlobalSignals.tabClosedSignal.dispatch(previousTabID);
				GameGlobals.uiFunctions.setTab(tabID, tabProps);
				GlobalSignals.tabOpenedSignal.dispatch(tabID);
			},

			setTab: function (tabID, tabProps) {
				$("#switch-tabs li").removeClass("selected");
				$("#switch-tabs li#" + tabID).addClass("selected");
				$("#tab-header h2").text(tabID);
				// mobile css keys off the active tab: it hides the camp tab's
				// duplicate title and reserves room for that tab's pinned action bar
				let $body = $("body");
				$body.removeClass(function (i, className) {
					return (className.match(/(^|\s)tab-\S+/g) || []).join(" ");
				});
				$body.addClass("tab-" + tabID);
				this.scrollTabIntoView();

				GameGlobals.gameState.uiStatus.currentTab = tabID;

				$.each($(".tabcontainer"), function () {
					GameGlobals.uiFunctions.toggle($(this), $(this).attr("data-tab") === tabID);
				});

				$.each($(".tabelement"), function () {
					GameGlobals.uiFunctions.toggle($(this), $(this).attr("data-tab") === tabID);
				});

				$.each($(".tabbutton"), function () {
					GameGlobals.uiFunctions.toggle($(this), $(this).attr("data-tab") === tabID);
				});

				GameGlobals.gameState.markSeenTab(tabID);

				log.i("tabChanged: " + tabID, "ui");

				GlobalSignals.tabChangedSignal.dispatch(tabID, tabProps);
			},

			// keep the selected tab visible when the tab bar is a horizontal scroller (small layout)
			scrollTabIntoView: function () {
				let ul = $("#switch-tabs")[0];
				let li = $("#switch-tabs li.selected")[0];
				if (!ul || !li) return;
				if (ul.scrollWidth <= ul.clientWidth + 1) return;
				let target = li.offsetLeft - (ul.clientWidth - li.offsetWidth) / 2;
				ul.scrollLeft = Math.max(0, Math.min(target, ul.scrollWidth - ul.clientWidth));
			},

			onStepperButtonClicked: function (button, e) {
				e.preventDefault();
				var fieldName = $(button).attr('data-field');
				var type = $(button).attr('data-type');
				var input = $("input[name='" + fieldName + "']");
				var currentVal = parseInt(input.val());
				if (!isNaN(currentVal)) {
					if (type == 'minus') {
						var min = input.attr('min');
						if (currentVal > min) {
							input.val(currentVal - 1).change();
						}
					} else if (type == 'plus') {
						var max = input.attr('max');
						if (currentVal < max) {
							input.val(currentVal + 1).change();
						}
					}
				} else {
					log.w("invalid stepper input value [" + fieldName + "]");
					input.val(0);
				}
			},

			onStepperInputChanged: function (input) {
				var minValue = parseInt($(input).attr('min'));
				var maxValue = parseInt($(input).attr('max'));
				var valueCurrent = parseInt($(input).val());
				var name = $(input).attr('name');

				if (isNaN(valueCurrent)) {
					let valueOld = $(this).data('oldValue');
					if (!isNaN(valueOld)) {
						$(this).val(valueOld);
						return;
					} else {
						$(this).val(0);
					}
				}

				this.updateStepperButtons("#" + $(input).parent().attr("id"));
			},
			
			onKeyUp: function (e) {
				if (e.originalEvent.isTextInput) return;
				// number inputs (steppers) don't set isTextInput; never treat typing in a field as a hotkey
				let targetTagName = e.target ? e.target.tagName : null;
				if (targetTagName == "INPUT" || targetTagName == "TEXTAREA") return;
				// Enter on a focused button already clicked it on keydown; don't also trigger the hotkey
				let code = e.originalEvent.code;
				if ((code == "Enter" || code == "NumpadEnter" || code == "Space") && $(e.target).is("button, a, [tabindex]")) return;
				if (!GameGlobals.uiFunctions.triggerHotkey(code, e)) return;
			},

			triggerHotkey: function (code, modifiers) {
				if (!this.hotkeys[code]) return false;
				let currentTab = GameGlobals.gameState.uiStatus.currentTab;
				let hasPopups = GameGlobals.uiFunctions.popupManager.hasOpenPopup();
				let hasModifier = modifiers.shiftKey || modifiers.altKey || modifiers.ctrlKey || modifiers.metaKey;
				// a popup dismissed on keydown (Enter clicks the focused button) must not leak the keyup to game hotkeys
				let msSincePopupClosed = new Date().getTime() - (this.lastPopupClosedTimestamp || 0);

				for (let i = 0; i < this.hotkeys[code].length; i++) {
					let hotkey = this.hotkeys[code][i];
					if (hotkey.tab && hotkey.tab !== currentTab) continue;
					if (!hotkey.isUniversal && hasPopups) continue;
					if (!hotkey.isUniversal && msSincePopupClosed < 300) continue;
					if (hotkey.activeCondition && !hotkey.activeCondition()) continue;
					if (!GameGlobals.gameState.settings.hotkeysEnabled && !hotkey.isUniversal) continue;

					let modifier = GameGlobals.uiFunctions.getActualHotkeyModifier(hotkey.modifier);
					if (modifier && !modifiers[modifier]) continue;
					if (!modifier && hasModifier) continue;

					log.i("[hotkey] triggered " + hotkey.code + " " + hotkey.modifier + " " + hotkey.tab);

					hotkey.cb.apply(this);
					return true;
				}

				return false;
			},

			getActualHotkeyModifier: function (modifier) {
				if (!modifier) return null;

				let result = modifier.modifier || modifier;
				if (result == GameGlobals.uiFunctions.HOTKEY_DEFAULT_MODIFIER) {
					result = null;
				}
				return result;
			},

			onMetaButtonClicked: function (e) {
				let $btn = $(e.currentTarget);
				let id = $btn.attr("id");
				
				GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.buttonClicked);

				if (id == "out-action-fight-close") {
					GameGlobals.fightHelper.endFight(false, false);
				} else if (id == "out-action-fight-continue") {
					GameGlobals.fightHelper.endFight(false, false);
				}
			},

			onActionButtonClicked: function (button) {
				var uiFunctions = this;
				var gameState = GameGlobals.gameState;

				let $btn = button.$button;
				let action = $btn.attr("action");
				let id = $btn.attr("id");

				if (!GameGlobals.gameState.isPlayerInputAccepted()) return;

				GlobalSignals.actionButtonClickedSignal.dispatch(action);

				if (id == "out-action-fight-confirm") {
					GameGlobals.fightHelper.startFight();
				} else if  (id == "out-action-fight-takeselected") {
					GameGlobals.fightHelper.endFight(false, false);
				} else if  (id == "out-action-fight-takeall") {
					GameGlobals.fightHelper.endFight(true, false);
				} else if  (id == "out-action-fight-cancel") {
					GameGlobals.fightHelper.endFight(false, true);
				} else if (action == "leave_camp") {
					gameState.uiStatus.leaveCampItems = {};
					gameState.uiStatus.leaveCampRes = {};

					let selectedResVO = new ResourcesVO();
					let selectedCurrency = 0;
					$.each($("#embark-resources tr"), function () {
						let resourceName = $(this).attr("id").split("-")[2];
						let selectedVal = parseInt($(this).children("td").children(".stepper").children("input").val());
						let isCurrency = resourceName == "currency";
						if (isCurrency) {
							selectedCurrency = selectedVal;
						} else {
							selectedResVO.setResource(resourceName, selectedVal);
						}
					});

					var selectedItems = {};
					$.each($("#embark-items tr"), function () {
						var itemID = $(this).attr("id").split("-")[2];
						var selectedVal = parseInt($(this).children("td").children(".stepper").children("input").val());
						selectedItems[itemID] = selectedVal;
					});

					GameGlobals.playerActionFunctions.updateCarriedItems(selectedItems);
					GameGlobals.resourcesHelper.moveResFromCampToBag(selectedResVO);
					GameGlobals.resourcesHelper.moveCurrencyFromCampToBag(selectedCurrency);
					GameGlobals.playerActionFunctions.leaveCamp();
				} else {
					if ($btn.hasClass("action-manual-trigger")) {
						return;
					}

					GameGlobals.gameState.uiStatus.isBusyCounter++;

					let param = null;
					let actionIDParam = GameGlobals.playerActionsHelper.getActionIDParam(action);
					if (actionIDParam) param = actionIDParam;
					let isProject = $btn.hasClass("action-level-project");
					if (isProject) param = $btn.attr("sector");
					if (!param) param = GameGlobals.playerActionsHelper.getActionDefaultParam();

					let locationKey = uiFunctions.getLocationKey(action);
					let isStarted = GameGlobals.playerActionFunctions.startAction(action, param);

					GameGlobals.gameState.uiStatus.isBusyCounter--;

					if (!isStarted) {
						uiFunctions.updateButtonCooldown($btn, action);
					} else {
						let baseId = GameGlobals.playerActionsHelper.getBaseActionID(action);
						let duration = PlayerActionConstants.getDuration(action, baseId);
						if (duration > 0) {
							GameGlobals.gameState.setActionDuration(action, locationKey, duration);
							uiFunctions.startButtonDuration($btn, duration);
						}
					}
				}
			},

			onNumberInputKeyDown: function (e) {
				// Allow: backspace, delete, tab, escape, enter and .
				if ($.inArray(e.keyCode, [46, 8, 9, 27, 13, 190]) !== -1 ||
					// Allow: Ctrl+A
					(e.keyCode == 65 && e.ctrlKey === true) ||
					// Allow: home, end, left, right
					(e.keyCode >= 35 && e.keyCode <= 39)) {
					return;
				}
				// Ensure that it's a number and stop the keypress
				if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
					e.preventDefault();
				}
			},

			onTextInputKeyDown: function (e) {
				// Allow: backspace, delete, tab, escape and enter
				if ($.inArray(e.keyCode, [46, 8, 9, 27, 13, 110]) !== -1 ||
					// Allow: Ctrl+A
					(e.keyCode == 65 && e.ctrlKey === true) ||
					// Allow: home, end, left, right
					(e.keyCode >= 35 && e.keyCode <= 39)) {
					// let it happen, don't do anything
					return;
				}
				e.originalEvent.isTextInput = true;
			},

			onTextInputKeyUp: function (e) {
				let value = $(e.target).val();
				value = StringUtils.cleanUpInput(value, $(e.target).data("max-input-length"), '_');
				$(e.target).val(value);
				e.originalEvent.isTextInput = true;
			},

			onButtonLikeElementKeyDown: function (e, cb) {
				switch (e.keyCode) {
					case 13:
					case 32:
						cb(e);
						return;
				}
			},

			onPlayerPositionChanged: function () {
				if (GameGlobals.gameState.uiStatus.isHidden) return;
				var updates = false;
				updates = this.updateButtonCooldowns("") || updates;
				if (updates) {
					GlobalSignals.updateButtonsSignal.dispatch();
				}
			},
			
			onRestartButton: function () {
				var sys = this;
				this.showConfirmation(
					"Do you want to restart the game? Your progress will be lost.",
					function () {
						sys.restart();
					},
					true
				);
			},

			slideToggleIf: function (element, replacement, show, durationIn, durationOut, cb) {
				var visible = this.isElementToggled(element);
				var toggling = ($(element).attr("data-toggling") == "true");
				var sys = this;

				if (show && (visible == false || visible == null) && !toggling) {
					if (replacement) sys.toggle(replacement, false);
					$(element).attr("data-toggling", "true");
					$(element).stop().slideToggle(durationIn, function () {
						sys.toggle(element, true);
						$(element).attr("data-toggling", "false");
						if (cb) cb();
					});
					return;
				} else if (!show && (visible == true || visible == null) && !toggling) {
					$(element).attr("data-toggling", "true");
					$(element).stop().slideToggle(durationOut, function () {
						if (replacement) sys.toggle(replacement, true);
						sys.toggle(element, false);
						$(element).attr("data-toggling", "false");
						if (cb) cb();
					});
					return;
				}

				if (cb) cb();
			},

			toggleCollapsibleContainer: function (element, show) {
				var $element = typeof (element) === "string" ? $(element) : element;
				if (show) {
					var group = $element.parents(".collapsible-container-group");
					if (group.length > 0) {
						var sys = this;
						$.each($(group).find(".collapsible-header"), function () {
							var $child = $(this);
							if ($child[0] !== $element[0]) {
								sys.toggleCollapsibleContainer($child, false);
							}
						});
					}
				}
				$element.toggleClass("collapsible-collapsed", !show);
				$element.toggleClass("collapsible-open", show);
				this.slideToggleIf($element.next(".collapsible-content"), null, show, 300, 200);
				GlobalSignals.elementToggledSignal.dispatch($element, show);
			},

			toggle: function (element, show, signalParams, delay) {
				let $element = typeof (element) === "string" ? $(element) : element;

				if (($element).length === 0)
					return;

				// The regular and the mobile header hold copies of the same stat,
				// so a class selector like .stat-indicator-rumours matches both.
				// Toggled as one set, the callout wrapper cascade below counts the
				// children of every parent at once, never sees the single child it
				// looks for, and does nothing - which left rumours and reputation
				// showing a visible value inside a wrapper that stayed hidden from
				// when the stat was still zero. Handle each element on its own.
				if (($element).length > 1) {
					let uiFunctions = this;
					$element.each(function () {
						uiFunctions.toggle($(this), show, signalParams, delay);
					});
					return;
				}

				if (typeof (show) === "undefined")
					show = false;
				if (show === null)
					show = false;
				if (!show)
					show = false;

				if (this.isElementToggled($element) === show) {
					// The element is already right, but its callout wrappers may
					// not be: hiding cascades up to them, and a later show that
					// no-ops here would leave them hidden for good (camp storage
					// disappeared from the header after leaving and re-entering).
					this.toggleParentCalloutContainer($element, ".info-callout-target", show);
					this.toggleParentCalloutContainer($element, ".callout-container", show);
					return;
				}

				this.cancelDelayedToggle($element);
				
				if (!delay || delay <= 0) {
					this.toggleInternal($element, show, signalParams);
				} else {
					let id = setTimeout(function () { GameGlobals.uiFunctions.toggleInternal($element, show, signalParams); }, delay);
					$element.attr("data-toggle-timeout", id);
				}
			},
			
			toggleInternal: function ($element, show, signalParams) {
				show = show == true;
				$element.attr("data-visible", show);
				$element.toggle(show);

				// if parent callout container exists and it has only one non-hover child (element being toggled), toggle parent too
				this.toggleParentCalloutContainer($element, ".info-callout-target", show);
				this.toggleParentCalloutContainer($element, ".callout-container", show);

				// NOTE: For some reason the element isn't immediately :visible for checks in UIOutElementsSystem without the timeout
				setTimeout(function () {
					GlobalSignals.elementToggledSignal.dispatch($element, show, signalParams);
				}, 1);
			},

			toggleParentCalloutContainer: function ($element, parentSelector, show) {
				let $parent = $element.parent(parentSelector);

				if ($parent.length === 0) return;
				
				let $children = $parent.children();
				let $countedChildren = $children.not(".info-callout");

				if ($countedChildren.length === 1) {
					this.toggle($parent, show);
				}
			},
			
			cancelDelayedToggle: function ($element) {
				// TOGO generalize for cancelling any timeout with id like "toggle-timeout"
				let id = $element.attr("data-toggle-timeout");
				if (!id) return;
				clearTimeout(id);
				$element.attr("data-toggle-timeout", 0);
			},
			
			toggleContainer: function (element, show, signalParams) {
				var $element = typeof (element) === "string" ? $(element) : element;
				this.toggle($element, show, signalParams);
				this.toggle($element.children("button"), show, signalParams);
			},

			isElementToggled: function (element) {
				var $element = typeof (element) === "string" ? $(element) : element;
				if (!$element || ($element).length === 0)
					return false;

				// if several elements, return their value if all agree, otherwise null
				if (($element).length > 1) {
					var previousIsToggled = null;
					var currentIsToggled = null;
					for (let i = 0; i < ($element).length; i++) {
						previousIsToggled = currentIsToggled;
						currentIsToggled = this.isElementToggled($(($element)[i]));
						if (i > 0 && previousIsToggled !== currentIsToggled) return null;
					}
					return currentIsToggled;
				}

				var visible = true;
				var visibletag = ($element.attr("data-visible"));

				if (typeof visibletag !== typeof undefined) {
					visible = (visibletag == "true");
				} else {
					visible = null;
				}
				return visible;
			},

			isElementVisible: function (element, skipParentsCheck) {
				var $element = typeof (element) === "string" ? $(element) : element;
				var toggled = this.isElementToggled($element);
				if (toggled === false)
					return false;
				if (!skipParentsCheck) {
					var $e = $element.parent();
					while ($e && $e.length > 0) {
						if (!$e.hasClass("collapsible-content") && !$e.hasClass("callout-container")) {
							var parentToggled = this.isElementToggled($e);
							if (parentToggled === false) {
								return false;
							}
						}
						$e = $e.parent();
					}
				}
				return (($element).is(":visible"));
			},

			setText: function (selector, key, options) {
				if (!selector) {
					log.w("invalid selector for automatic text update");
					return;
				}

				// callers pass jQuery objects as well as selector strings. Used as
				// an object key every jQuery object collapses to "[object Object]",
				// so entries overwrite each other and the refresh below throws on
				// the stringified key, leaving every later label blank.
				let entry = null;
				for (let i = 0; i < this.texts.length; i++) {
					if (this.texts[i].selector === selector) {
						entry = this.texts[i];
						break;
					}
				}
				if (!entry) {
					entry = { selector: selector };
					this.texts.push(entry);
				}
				entry.key = key;
				entry.options = options;

				this.updateText($(selector), Text.t(key, options));
			},

			updateTexts: function () {
				for (let i = 0; i < this.texts.length; i++) {
					let saved = this.texts[i];
					this.updateText($(saved.selector), Text.t(saved.key, saved.options));
				}
			},

			updateText: function ($elem, text) {
				// A selector like ".header-camp-storage .label" matches the mobile
				// and the desktop copy. Comparing the combined text would skip the
				// update as soon as one of them already had it, so check each.
				$elem.each(function () {
					let $each = $(this);
					// buttons processed by ActionButton keep their overlay children; the text lives in the label
					let $label = $each.children(".btn-label");
					let $target = $label.length > 0 ? $label : $each;
					if ($target.text() == text) return;
					$target.text(text);
				});
			},

			stopButtonCooldown: function (button) {
				$(button).children(".cooldown-action").stop(true, true);
				$(button).attr("data-hasCooldown", "false");
				$(button).children(".cooldown-action").css("display", "none");
				$(button).children(".cooldown-action").css("width", "100%");
				GlobalSignals.updateButtonsSignal.dispatch();
			},
			
			updateButtonCooldown: function (button, action) {
				let baseId = GameGlobals.playerActionsHelper.getBaseActionID(action);
				let locationKey = this.getLocationKey(action);

				cooldownTotal = PlayerActionConstants.getCooldown(baseId);
				cooldownLeft = Math.min(cooldownTotal, GameGlobals.gameState.getActionCooldown(action, locationKey, cooldownTotal));
				durationTotal = PlayerActionConstants.getDuration(action, baseId);
				durationLeft = Math.min(durationTotal, GameGlobals.gameState.getActionDuration(action, locationKey, durationTotal));

				if (cooldownLeft > 0) this.startButtonCooldown(button, cooldownTotal, cooldownLeft);
				else this.stopButtonCooldown(button);

				if (durationLeft > 0) this.startButtonDuration(button, durationTotal, durationLeft);
				else this.stopButtonDuration(button);
			},

			startButtonCooldown: function (button, cooldown, cooldownLeft) {
				if (GameGlobals.gameState.uiStatus.isHidden) return;

				let action = $(button).attr("action");
				let isAvailable = GameGlobals.playerActionsHelper.isRequirementsMet(action, null, [ PlayerActionConstants.DISABLED_REASON_BUSY ]);

				if (!isAvailable) {
					this.stopButtonCooldown(button);
					return;
				}

				if (!cooldownLeft) cooldownLeft = cooldown;
				var uiFunctions = this;
				var startingWidth = (cooldownLeft / cooldown * 100);
				$(button).attr("data-hasCooldown", "true");
				$(button).children(".cooldown-action").stop(true, false).css("display", "inherit").css("width", startingWidth + "%").animate({
						width: 0
					},
					cooldownLeft * 1000,
					'linear',
					function () {
						uiFunctions.stopButtonCooldown($(this).parent());
					}
				);
			},

			stopButtonDuration: function (button) {
				$(button).children(".cooldown-duration").stop(true, true);
				$(button).children(".cooldown-duration").css("display", "none");
				$(button).children(".cooldown-duration").css("width", "0%");
				$(button).attr("data-isInProgress", "false");
			},

			startButtonDuration: function (button, duration, durationLeft) {
				if (!durationLeft) durationLeft = duration;
				let uiFunctions = this;
				let startingWidth = (1 - durationLeft / duration) * 100;
				$(button).attr("data-isInProgress", "true");
				$(button).children(".cooldown-duration").stop(true, false).css("display", "inherit").css("width", startingWidth + "%").animate({
						width: '100%'
					},
					durationLeft * 1000,
					'linear',
					function () {
						uiFunctions.stopButtonDuration($(this).parent());
					}
				);
			},

			getLocationKey: function (action) {
				var isLocationAction = PlayerActionConstants.isLocationAction(action);
				var playerPos = GameGlobals.playerActionFunctions.playerPositionNodes.head.position;
				return GameGlobals.gameState.getActionLocationKey(isLocationAction, playerPos);
			},
			
			updateCostsSpans: function (action, costs, elements, costsStatus, displayedCosts, signalParams) {
				let playerHealth = GameGlobals.playerActionFunctions.playerStatsNodes.head.stamina.health;
				let maxRumours = GameGlobals.playerActionFunctions.playerStatsNodes.head.rumours.maxValue;
				let maxEvidence = GameGlobals.playerActionFunctions.playerStatsNodes.head.evidence.maxValue;
				let maxHope = GameGlobals.playerHelper.getMaxHope();
				let maxInsight = GameGlobals.playerActionFunctions.playerStatsNodes.head.insight.maxValue;
				let showStorage = GameGlobals.resourcesHelper.getCurrentStorageCap();

				let costsWithoutBonuses = GameGlobals.playerActionsHelper.getCostsWithoutBonuses(action);

				let maxCostCountdown = -1;
				let hasNonAccumulatingCost = false;
				
				// costs themselves
				for (let key in costs) {
					let value = costs[key];
					let valueWithoutBonuses = costsWithoutBonuses[key];
					let isNegatedByBonus = value === 0 && valueWithoutBonuses !== 0;
					let isAccumulatingCost = GameGlobals.playerActionsHelper.isAccumulatingCost(key, false);

					if (isAccumulatingCost && !hasNonAccumulatingCost) {
						let costCountdown = GameGlobals.playerActionsHelper.getCostCountdownSeconds(key, value);

						if (costCountdown < 0) {
							hasNonAccumulatingCost = true;
						}

						if (costCountdown >= 0 && costCountdown > maxCostCountdown) {
							maxCostCountdown = costCountdown;
						}
					} else {
						hasNonAccumulatingCost = true;
					}

					let $costSpan = elements.costSpans[key];
					if (!$costSpan || $costSpan.length == 0) {
						log.w("cost span missing: " + key + " " + action);
						continue;
					}
					let costFraction = GameGlobals.playerActionsHelper.checkCost(action, key);
					let isFullCostBlocker =
						(isResource(key.split("_")[1]) && value > showStorage) ||
						(key == "stamina" && value > playerHealth * PlayerStatConstants.HEALTH_TO_STAMINA_FACTOR) ||
						(key == "rumours" && value > maxRumours) ||
						(key == "evidence" && value > maxEvidence) ||
						(key == "insight" && value > maxInsight) ||
						(key == "hope" && value > maxHope);
						
					if (costsStatus) {
						if (isFullCostBlocker) {
							costsStatus.hasCostBlockers = true;
						} else if (costFraction < costsStatus.bottleneckCostFraction) {
							costsStatus.bottleneckCostFraction = costFraction;
						}
					}
					$costSpan.toggleClass("action-cost-blocker", costFraction < 1);
					$costSpan.toggleClass("action-cost-blocker-storage", isFullCostBlocker);

					let displayValue = UIConstants.getDisplayValue(value);
					if (isNegatedByBonus) {
						displayValue = "<span class='action-cost-negated'>" + UIConstants.getDisplayValue(valueWithoutBonuses) + "</span> " + displayValue;
					}
	
					if (displayValue !== displayedCosts[key]) {
						let $costSpanValue = elements.costSpanValues[key];
						let showCostSpan = valueWithoutBonuses > 0;
						$costSpanValue.html(displayValue);
						GameGlobals.uiFunctions.toggle($costSpan, showCostSpan, signalParams);
						displayedCosts[key] = displayValue;
					}
				}

				// cost countdown
				let $costsCountdown = elements.calloutCostsCountdown;
				let $costsCountdownContainer = elements.calloutCostsCountdownContainer;
				let showCostCountdown = !hasNonAccumulatingCost && maxCostCountdown >= 0 && costsStatus.bottleneckCostFraction < 1;
				GameGlobals.uiFunctions.toggle($costsCountdownContainer, showCostCountdown, signalParams);
				if (showCostCountdown) {
					$costsCountdown.text(Text.t("ui.actions.action_available_in_field", UIConstants.getTimeToNum(maxCostCountdown)));
				}
			},

			updateStepper: function (id, val, min, max) {
				var $input = $(id + " input");
				var oldVal = parseInt($input.val());
				var oldMin = parseInt($input.attr('min'));
				var oldMax = parseInt($input.attr('max'));
				if (oldVal === val && oldMin === min && oldMax === max) return;
				$input.attr("min", min);
				$input.attr("max", max);
				$input.val(val)
				this.updateStepperButtons(id);
			},

			updateStepperButtons: function (id) {
				var $input = $(id + " input");
				var name = $input.attr('name');
				var minValue = parseInt($input.attr('min'));
				var maxValue = parseInt($input.attr('max'));
				var valueCurrent = MathUtils.clamp(parseInt($input.val()), minValue, maxValue);

				var decEnabled = false;
				var incEnabled = false;
				if (valueCurrent > minValue) {
					decEnabled = true;
				} else {
					$input.val(minValue);
					
				}
				if (valueCurrent < maxValue) {
					incEnabled = true;
				} else {
					$input.val(maxValue);
				}

				var decBtn = $(".btn-glyph[data-type='minus'][data-field='" + name + "']");
				decBtn.toggleClass("btn-disabled", !decEnabled);
				decBtn.toggleClass("btn-disabled-basic", !decEnabled);
				decBtn.attr("disabled", !decEnabled);
				var incBtn = $(".btn-glyph[data-type='plus'][data-field='" + name + "']");
				incBtn.toggleClass("btn-disabled", !incEnabled);
				incBtn.toggleClass("btn-disabled-basic", !incEnabled);
				incBtn.attr("disabled", !incEnabled);
			},
			
			updateBubble: function (element, oldBubbleNumber, bubbleNumber) {
				bubbleNumber = bubbleNumber || 0;
				if (GameGlobals.gameState.isLaunchStarted) bubbleNumber = 0;
				
				if (bubbleNumber == oldBubbleNumber) return;
				
				var $element = typeof (element) === "string" ? $(element) : element;
				
				$element.text(bubbleNumber);
				GameGlobals.uiFunctions.toggle($element, bubbleNumber !== 0);
			},

			registerLongTap: function (element, callback) {
				// pointer events so hold-to-repeat works with both mouse and touch;
				// state lives in a per-element closure so timers cannot leak
				var $element = typeof (element) === "string" ? $(element) : element;
				var minTime = 1000;
				var intervalTime = 200;
				var moveCancelThreshold = 15;

				$element.each(function () {
					var el = this;
					var state = { timer: null, interval: null, startX: 0, startY: 0 };

					var cancelLongTap = function () {
						if (state.timer) clearTimeout(state.timer);
						if (state.interval) clearInterval(state.interval);
						state.timer = null;
						state.interval = null;
					};

					$(el).on('pointerdown', function (e) {
						var target = e.target;
						var $target = $(el);
						state.startX = Math.floor(e.pageX);
						state.startY = Math.floor(e.pageY);
						cancelLongTap();
						state.timer = setTimeout(function () {
							state.timer = null;
							state.interval = setInterval(function () {
								if (GameGlobals.gameState.uiStatus.mouseDown && GameGlobals.gameState.uiStatus.mouseDownElement == target) {
									callback.apply($target, e);
								} else {
									cancelLongTap();
								}
							}, intervalTime);
						}, minTime);
					});
					$(el).on('pointerleave pointercancel pointerup pointerout', function (e) {
						cancelLongTap();
					});
					$(el).on('pointermove', function (e) {
						// small jitter (finger tremor) should not cancel the hold
						if (Math.abs(e.pageX - state.startX) < moveCancelThreshold && Math.abs(e.pageY - state.startY) < moveCancelThreshold) return;
						cancelLongTap();
					});
					$(el).on('contextmenu', function (e) {
						// only suppress the long-press context menu on touch screens;
						// desktop right-click stays available
						if (UIConstants.isTouchScreen()) e.preventDefault();
					});
				});
			},

			focus: function ($element, numTries) {
				if (!$element || $element.length == 0) {
					log.w("could not find element to focus on");
					return;
				}

				let name = UIConstants.getElementName($element);

				if (numTries > 10) {
					log.w("could not focus on element (not focusable): " + name);
					return;
				}

				let e = $element[0];
				let isFocusable = UIConstants.isFocusable(e);

				if (!isFocusable) {
					setTimeout(() => { GameGlobals.uiFunctions.focus($element, numTries + 1); }, 100);
					return;
				}

				log.i("focus on " + name);
				e.focus();
			},

			showPreviousTab: function () {
				let visibleTabElements = $("#switch-tabs li").filter("[data-visible=true]");
				let currentTabElement = $("#switch-tabs li.selected")[0];
				let currentTabElementIndex = visibleTabElements.toArray().indexOf(currentTabElement);
				let previousTabElementIndex = currentTabElementIndex - 1;
				if (previousTabElementIndex < 0) previousTabElementIndex = visibleTabElements.length - 1;
				visibleTabElements[previousTabElementIndex].click();
				GameGlobals.uiFunctions.scrollToTabTop();
			},

			showNextTab: function () {
				let visibleTabElements = $("#switch-tabs li").filter("[data-visible=true]");
				let currentTabElement = $("#switch-tabs li.selected")[0];
				let currentTabElementIndex = visibleTabElements.toArray().indexOf(currentTabElement);
				let nextTabElementIndex = currentTabElementIndex + 1;
				if (nextTabElementIndex >= visibleTabElements.length) nextTabElementIndex = 0;
				visibleTabElements[nextTabElementIndex].click();
				GameGlobals.uiFunctions.scrollToTabTop();
			},

			showTabByNumber: function (index) {
				let visibleTabElements = $("#switch-tabs li").filter("[data-visible=true]");
				if (index < 0 || index >= visibleTabElements.length) return;
				visibleTabElements[index].click();
				GameGlobals.uiFunctions.scrollToTabTop();
			},

			updateTabHotkeyNumbers: function () {
				$("#switch-tabs li .tab-hotkey-number").text("");
				if (!GameGlobals.gameState.settings.hotkeysEnabled) return;
				let visibleTabElements = $("#switch-tabs li").filter("[data-visible=true]");
				for (let i = 0; i < visibleTabElements.length && i < 9; i++) {
					$(visibleTabElements[i]).find(".tab-hotkey-number").text(i + 1);
				}
			},

			showFight: function () {
				if (GameGlobals.gameState.uiStatus.isHidden) return;
				this.showSpecialPopup("fight-popup");
			},

			showIncomingCaravanPopup: function () {
				this.showSpecialPopup("incoming-caravan-popup");
			},

			showManageSave: function () {
				let options = { isMeta: true, isDismissable: true };
				this.showSpecialPopup("manage-save-popup", options);
			},

			showStatsPopup: function () {
				GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.buttonClicked);
				let options = { isMeta: true, isDismissable: true };
				this.updateGameStatsPopup();
				this.showSpecialPopup("game-stats-popup", options);
			},

			showSpecialPopup: function (popupID, options) {
				options = options || {};
				
				log.i("[ui] showSpecialPopup " + popupID);
				
				let $popup = $("#" + popupID);

				if (options.setupCallback) {
					options.setupCallback();
				}

				GameGlobals.uiFunctions.popupManager.setDismissable($popup, options.isDismissable);
				
				let uiFunctions = this;

				this.popupManager.showOverlay(function () {
					uiFunctions.popupManager.repositionPopup($popup);
					GlobalSignals.popupOpenedSignal.dispatch(popupID);
					$popup.stop().fadeIn(UIConstants.POPUP_FADE_IN_DURATION, function () {
						$popup.attr("data-toggling", false);
						uiFunctions.toggle("#" + popupID, true);
						uiFunctions.popupManager.repositionPopup($popup);
						uiFunctions.popupManager.updatePause();
						GlobalSignals.popupShownSignal.dispatch("common-popup");
						if (options.$defaultButton) GameGlobals.uiFunctions.focus(options.$defaultButton);
					});
					GlobalSignals.elementToggledSignal.dispatch(("#" + popupID), true);
				});
				
				this.generateInfoCallouts("#" + popupID);
			},

			showInfoPopup: function (title, msg, buttonLabel, resultVO, callback, isMeta, isDismissable) {
				if (!buttonLabel) buttonLabel = "Continue";
				let options = {
					isMeta: isMeta,
					isDismissable: isDismissable,
				};
				this.popupManager.showPopup(title, msg, buttonLabel, false, resultVO, callback, null, options);
			},

			showResultPopup: function (title, msg, resultVO, callback, options) {
				options = options || {};
				options.isDismissable = !resultVO || resultVO.isVisuallyEmpty();
				this.popupManager.showPopup(title, msg, "Continue", false, resultVO, callback, null, options);
			},

			showActionPopup: function (action, title, msg) {
				let options = {
					isMeta: false,
					isDismissable: true,
					action: action,
				};

				let baseActionID = GameGlobals.playerActionsHelper.getBaseActionID(action);
				let actionName = Text.t("game.actions." + baseActionID + "_name");

				title = title || actionName;
				
				this.popupManager.showPopup(title, msg, null, "Cancel", null, null, null, options);
			},

			showConfirmation: function (msg, callback, isMeta, isDismissable) {
				let uiFunctions = this;

				let okCallback = function (e) {
					uiFunctions.popupManager.closePopup("common-popup");
					callback();
				};
				let cancelCallback = function () {
					uiFunctions.popupManager.closePopup("common-popup");
				};
				let options = {
					isMeta: isMeta,
					// dismissing (Esc) triggers the cancel button, so this is safe to allow
					isDismissable: isDismissable || false,
				};
				
				this.popupManager.showPopup("Confirmation", msg, "Confirm", "Cancel", null, okCallback, cancelCallback, options);
			},

			showQuestionPopup: function (title, msg, buttonLabel, cancelButtonLabel, callbackOK, callbackNo, isMeta) {
				let uiFunctions = this;
				let okCallback = function (e) {
					uiFunctions.popupManager.closePopup("common-popup");
					callbackOK();
				};
				let cancelCallback = function () {
					uiFunctions.popupManager.closePopup("common-popup");
					if (callbackNo) callbackNo();
				};
				let options = {
					isMeta: isMeta,
					isDismissable: false,
				};
				this.popupManager.showPopup(title, msg, buttonLabel, cancelButtonLabel, null, okCallback, cancelCallback, options);
			},

			showInput: function (title, msg, defaultValue, allowCancel, confirmCallback, inputCallback, maxLength) {
				// TODO improve input validation (check and show feedback on input, not just on confirm)
				let okCallback = function () {
					let input = $("#common-popup input").val();
					input = StringUtils.cleanUpInput(input, maxLength);
					let ok = input && input.length > 0 && (inputCallback ? inputCallback(input) : true);
					if (ok) {
						confirmCallback(input);
						return true;
					} else {
						log.w("invalid input: " + input);
						return false;
					}
				};
				let cancelButtonLabel = allowCancel ? "Cancel" : null;
				let options = {
					isMeta: false,
					isDismissable: false,
					isCloseable: false,
				};
				
				this.popupManager.showPopup(title, msg, "Confirm", cancelButtonLabel, null, okCallback, null, options);

				var uiFunctions = this;
				var maxChar = 40;
				this.toggle("#common-popup-input-container", true);
				$("#common-popup-input-container input").attr("maxlength", maxChar);

				$("#common-popup input").val(defaultValue);
				$("#common-popup input").data("max-input-length", maxLength)
				$("#common-popup input").keydown(uiFunctions.onTextInputKeyDown);
				$("#common-popup input").keyup(uiFunctions.onTextInputKeyUp);
			},

			showGameOptions: function (show) {
				$("#game-options-extended").toggle(show);
				$("#btn-more").text(show ? Text.t("ui.meta.more_options_button_label") : Text.t("ui.meta.more_options_button_label"));
				GlobalSignals.elementToggledSignal.dispatch($("#game-options-extended"), show);
			},

			showResultFlyout: function (resultVO) {
				
			},
		});

		return UIFunctions;
	});
