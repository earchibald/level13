// A two-level chooser popup: a menu screen of groups, and one numbered list per
// group. Digits, letters, arrows and enter drive it; a mouse or a finger works
// too. The Buildings menu (B) and the Craft menu (K) are both instances of this.
//
// The helper owns the popup's state and DOM wiring. The owner passes a config
// with the things that differ: which screens exist, the rows of each screen,
// the sub-text under a row's name, the tooltip content, and what a press does.
// The owner forwards popupOpenedSignal, popupClosedSignal and slowUpdateSignal
// so signal setup stays in one place per system.
//
// Element ids inside the popup are popupID + "-" + part (header-row, back,
// header, header-screen, header-hint, header-hint-text, toggle-container,
// show-unavailable, show-unavailable-label, resources, list, hint-menu,
// hint-list, hint-verb, close). Row classes are chooser-popup-*; one body-level
// #chooser-tooltip pane is shared, since only one popup is ever open.
define([
	'ash',
	'text/Text',
	'game/GameGlobals',
	'game/constants/UIConstants',
], function (Ash, Text, GameGlobals, UIConstants) {

	let UIChooserPopup = Ash.Class.extend({

		MENU: "menu",
		TOOLTIP_DELAY: 450,
		TOOLTIP_CURSOR_GAP: 14,
		TOOLTIP_EDGE_MARGIN: 8,

		constructor: function (config) {
			this.config = config;
			this.popupID = config.popupID;
			this.screens = config.screens || [];
			this.isOpen = false;
			this.screen = this.MENU;
			this.cursor = 0;
			this.cursorByScreen = {};
			this.rows = [];
			this.showHiddenByScreen = {};
			this.reopen = null;
			this.swallowEscapeUp = false;
			this.tooltipTimeout = null;
			this.tooltipCursor = null;
			this.tooltipIndex = null;
		},

		id: function (part) {
			return "#" + this.popupID + "-" + part;
		},

		$: function (part) {
			return $(this.id(part));
		},

		// DOM WIRING (once, at owner construction)

		init: function () {
			let popup = this;
			let popupSelector = "#" + this.popupID;

			this.$("close").click(function () { popup.close(); });
			this.$("back").click(function () { popup.back(); });
			this.$("show-unavailable").change(function () {
				if (popup.screen == popup.MENU) return;
				popup.showHiddenByScreen[popup.screen] = $(this).is(":checked");
				popup.renderList();
			});

			this.$("header-hint-text").text(UIConstants.isTouchScreen() ? "tap for help" : "hover for details");

			let $list = this.$("list");
			$list.on("click", ".chooser-popup-row", function (e) {
				if ($(e.target).closest(".chooser-popup-info").length > 0) return;
				let index = parseInt($(this).attr("data-index"));
				if (isNaN(index)) return;
				popup.setCursor(index);
				popup.activateRow();
			});

			// tooltips: hover with a delay on a mouse, the row's info glyph on touch.
			// the checkbox line takes part as row -1, the header's help glyph as -2
			let tooltipTargets = ".chooser-popup-row, " + this.id("toggle-container") + ", " + this.id("header-hint");
			let rowIndexOf = function (el) {
				let $el = $(el);
				if ($el.is(popup.id("toggle-container"))) return -1;
				if ($el.is(popup.id("header-hint"))) return -2;
				let index = parseInt($el.attr("data-index"));
				return isNaN(index) ? null : index;
			};
			$(popupSelector).on("mouseenter", tooltipTargets, function (e) {
				if (UIConstants.isTouchScreen()) return;
				let index = rowIndexOf(this);
				if (index === null) return;
				popup.cancelTooltip();
				popup.tooltipCursor = { x: e.clientX, y: e.clientY };
				popup.tooltipTimeout = setTimeout(function () {
					popup.tooltipTimeout = null;
					popup.showTooltip(index);
				}, popup.TOOLTIP_DELAY);
			});
			$(popupSelector).on("mousemove", tooltipTargets, function (e) {
				popup.tooltipCursor = { x: e.clientX, y: e.clientY };
			});
			$(popupSelector).on("mouseleave", tooltipTargets, function () {
				if (UIConstants.isTouchScreen()) return;
				popup.hideTooltip();
			});
			$(popupSelector).on("click", ".chooser-popup-info", function (e) {
				e.stopPropagation();
				let index = rowIndexOf($(this).closest(tooltipTargets));
				if (index === null) return;
				popup.cancelTooltip();
				popup.tooltipCursor = { x: e.clientX, y: e.clientY };
				if ($("#chooser-tooltip").is(":visible") && popup.tooltipIndex === index) {
					popup.hideTooltip();
				} else {
					popup.showTooltip(index);
				}
			});
			$list.on("scroll", function () { popup.hideTooltip(); });

			// the letter's keydown opens the popup so the keys typed right after it land
			// in the menu; the owner's registered hotkey stays as the keyup fallback
			if (this.config.openKey) {
				$(document).on("keydown." + this.popupID + "open", $.proxy(this.onDocumentKeyDownOpen, this));
			}
		},

		destroy: function () {
			$(document).off("keydown." + this.popupID + "open");
			$(document).off("keydown." + this.popupID);
			if (this._onKeyUpCapture) document.removeEventListener("keyup", this._onKeyUpCapture, true);
		},

		onDocumentKeyDownOpen: function (e) {
			let oe = e.originalEvent || e;
			if (oe.repeat) return;
			if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
			if (oe.code != this.config.openKey.code) return;
			if (oe.isTextInput) return;
			if (!GameGlobals.gameState.settings.hotkeysEnabled) return;
			if (this.config.openKey.tab && GameGlobals.gameState.uiStatus.currentTab != this.config.openKey.tab) return;
			if (GameGlobals.uiFunctions.popupManager.hasOpenPopup()) return;
			let tagName = e.target ? e.target.tagName : null;
			if (tagName == "INPUT" || tagName == "TEXTAREA" || tagName == "SELECT") return;
			this.open();
		},

		// OPEN / CLOSE

		open: function (screen) {
			// the letter's keydown opens the popup and its keyup fires the registered
			// hotkey fallback before the popup reads as open, so guard with a flag
			if (this.isOpen) return;
			if (GameGlobals.gameState.uiStatus.isHidden) return;
			if (GameGlobals.uiFunctions.popupManager.hasOpenPopup()) return;
			if (this.config.canOpen && !this.config.canOpen()) return;
			if (this.config.beforeOpen && this.config.beforeOpen() === false) return;

			let popup = this;
			this.isOpen = true;
			this.swallowEscapeUp = false;

			GameGlobals.uiFunctions.showSpecialPopup(this.popupID, {
				isMeta: false,
				isDismissable: true,
				setupCallback: () => popup.showScreen(screen || popup.MENU),
			});

			// bound at open, not when the popup becomes visible: keys typed while the
			// popup is still fading in must land in the menu, not be dropped
			$(document).on("keydown." + this.popupID, $.proxy(this.onKeyDown, this));

			// Esc is consumed on keydown (back one level), but the universal "Dismiss
			// popup" hotkey fires on keyup and would close the popup anyway. A capture
			// listener stops that one keyup before jQuery's document handler sees it
			if (!this._onKeyUpCapture) {
				this._onKeyUpCapture = function (e) {
					if (e.code != "Escape") return;
					if (!popup.swallowEscapeUp) return;
					popup.swallowEscapeUp = false;
					e.stopPropagation();
				};
			}
			document.addEventListener("keyup", this._onKeyUpCapture, true);
		},

		close: function () {
			if (!this.isOpen) return;
			this.hideTooltip();
			GameGlobals.uiFunctions.popupManager.closePopup(this.popupID);
		},

		onPopupClosed: function (popupID) {
			if (popupID == this.popupID) {
				this.isOpen = false;
				$(document).off("keydown." + this.popupID);
				if (this._onKeyUpCapture) document.removeEventListener("keyup", this._onKeyUpCapture, true);
				this.hideTooltip();
				if (this.config.onClosed) this.config.onClosed();
				return;
			}
			// return to the menu after the popup a row's press raised has closed
			if (this.reopen) {
				let reopen = this.reopen;
				this.reopen = null;
				this.cursorByScreen[reopen.screen] = reopen.cursor;
				this.open(reopen.screen);
			}
		},

		// popups do not stack: when a row's press raises one (a confirmation, a result),
		// the menu steps aside and comes back on the same screen once it has closed
		onPopupOpened: function (popupID) {
			if (!this.isOpen) return;
			if (popupID == this.popupID) return;
			this.reopen = { screen: this.screen, cursor: this.cursor };
			this.close();
		},

		isVisible: function () {
			let $popup = $("#" + this.popupID);
			if (!$popup.is(":visible")) return false;
			if ($popup.attr("data-visible") != "true") return false;
			if (GameGlobals.uiFunctions.popupManager.isClosing(this.popupID)) return false;
			return true;
		},

		// SCREENS

		showScreen: function (screen) {
			if (this.screen && this.screens.indexOf(this.screen) >= 0) {
				this.cursorByScreen[this.screen] = this.cursor;
			}
			this.hideTooltip();
			this.screen = screen;
			let isMenu = screen == this.MENU;

			let title = isMenu ? "" : (this.config.titles && this.config.titles[screen]) || screen;
			this.$("header-screen").text(isMenu ? "" : " › " + title);
			GameGlobals.uiFunctions.toggle(this.id("back"), !isMenu);
			GameGlobals.uiFunctions.toggle(this.id("hint-menu"), isMenu);
			GameGlobals.uiFunctions.toggle(this.id("hint-list"), !isMenu);
			let verb = (this.config.verbs && this.config.verbs[screen]) || "do";
			this.$("hint-verb").text(verb);

			if (!isMenu) {
				this.$("show-unavailable").prop("checked", this.showHiddenByScreen[screen] == true);
			}

			let restoredCursor = isMenu ? 0 : this.cursorByScreen[screen];
			this.renderList(typeof restoredCursor == "number" ? restoredCursor : 0);
		},

		back: function () {
			if (!this.isOpen) return;
			if (this.screen == this.MENU) {
				this.close();
				return;
			}
			let previous = this.screen;
			this.showScreen(this.MENU);
			// the menu lists screens in order but may skip empty ones: find by screen id
			let index = 0;
			for (let i = 0; i < this.rows.length; i++) {
				if (this.rows[i].entry.screen == previous) { index = i; break; }
			}
			this.setCursor(index);
		},

		// RENDERING
		//
		// every entry has: key (stable id for keeping the cursor across renders), name,
		// action, available (pressing it now does something), hidden (only shown with
		// the toggle), reason (why not), isBusy, isCooldown. Menu entries add screen,
		// letter, count, description

		renderList: function (cursor) {
			if (!this.isOpen) return;
			let screen = this.screen;
			let isMenu = screen == this.MENU;
			let $list = this.$("list");
			let isTouch = UIConstants.isTouchScreen();

			let entries = this.config.getEntries(screen) || [];
			let numHidden = entries.filter(e => e.hidden).length;
			let showHidden = !isMenu && this.showHiddenByScreen[screen] == true;
			let hasToggle = !isMenu && numHidden > 0;
			GameGlobals.uiFunctions.toggle(this.id("toggle-container"), hasToggle);
			this.$("show-unavailable-label").text((this.config.toggleLabel || "Show unavailable") + " (" + numHidden + ")");

			let previousKey = null;
			if (typeof cursor != "number") {
				let previousRow = this.rows ? this.rows[this.cursor] : null;
				previousKey = previousRow ? previousRow.key : null;
				cursor = this.cursor;
			}

			let rows = [];
			let html = "";
			let infoGlyph = isTouch ? "<span class='chooser-popup-info' role='button' aria-label='Details'>&#9432;</span>" : "";
			for (let i = 0; i < entries.length; i++) {
				let entry = entries[i];
				if (entry.hidden && !showHidden) continue;
				let index = rows.length;
				rows.push({ key: entry.key, entry: entry });
				let number = index + 1;
				let numberLabel = number <= 9 ? number : number == 10 ? "0" : "";
				let keyLabel = isMenu && entry.letter ? entry.letter : numberLabel;
				let classes = "chooser-popup-row";
				if (isMenu) classes += " chooser-popup-menu-row";
				if (!entry.available) classes += " chooser-popup-item-unavailable";
				if (entry.hidden) classes += " chooser-popup-item-hidden";
				html += "<div class='" + classes + "' data-index='" + index + "' data-key='" + entry.key + "'>";
				html += "<span class='chooser-popup-key'>" + (keyLabel || "&nbsp;") + "</span>";
				html += "<span class='chooser-popup-item-name'>" + entry.name;
				let sub = isMenu ? "" : (this.config.renderRowSub ? this.config.renderRowSub(entry, screen) : "");
				if (sub) html += "<span class='chooser-popup-item-sub'>" + sub + "</span>";
				html += "</span>";
				if (isMenu) {
					html += "<span class='chooser-popup-item-costs header-count'>" + entry.count + "</span>";
				} else {
					let detail = this.config.renderRowDetail ? this.config.renderRowDetail(entry, screen) : null;
					if (detail === null || detail === undefined) {
						if (entry.reason && !entry.available && (entry.hidden || entry.isBusy || entry.isCooldown)) {
							detail = "<span class='chooser-popup-item-reason'>" + entry.reason + "</span>";
						} else {
							detail = GameGlobals.uiFunctions.getActionCostsSpanList(entry.action).join(" ");
						}
					}
					html += "<span class='chooser-popup-item-costs'>" + detail + "</span>";
				}
				html += infoGlyph;
				html += "</div>";
			}

			this.rows = rows;
			this.renderResources(rows);

			if (rows.length == 0) {
				let empty = this.config.emptyText ? this.config.emptyText(screen) : "Nothing here yet.";
				html = "<p class='p-meta chooser-popup-empty'>" + empty + "</p>";
			}
			$list.html(html);
			// the list's height changed; keep the popup centred
			GameGlobals.uiFunctions.popupManager.repositionPopup($("#" + this.popupID));

			if (previousKey) {
				for (let i = 0; i < rows.length; i++) {
					if (rows[i].key == previousKey) { cursor = i; break; }
				}
			}
			this.setCursor(cursor);
		},

		// the stock of every cost the listed rows use, in the order the costs first
		// appear, so the player can see what a press would leave without a tooltip
		renderResources: function (rows) {
			let screen = this.screen;
			let show = screen != this.MENU && rows.length > 0 && this.config.showResources && this.config.showResources(screen);
			let sector = this.config.getSector ? this.config.getSector() : null;
			show = show && !!sector;
			GameGlobals.uiFunctions.toggle(this.id("resources"), show);
			if (!show) return;

			let keys = [];
			for (let i = 0; i < rows.length; i++) {
				let costs = GameGlobals.playerActionsHelper.getCosts(rows[i].entry.action);
				for (let key in costs) {
					if (!(costs[key] > 0)) continue;
					if (keys.indexOf(key) < 0) keys.push(key);
				}
			}

			let html = "";
			for (let i = 0; i < keys.length; i++) {
				let key = keys[i];
				let owned = GameGlobals.playerActionsHelper.getCostAmountOwned(sector, key);
				let label = key.indexOf("resource_") == 0 ? UIConstants.getResourceImg(key.split("_")[1]) : UIConstants.getCostDisplayName(key).toLowerCase() + " ";
				let name = UIConstants.getCostDisplayName(key);
				html += "<span class='chooser-popup-resource' title='" + name + "'>" + label + "<span class='chooser-popup-resource-amount'>" + UIConstants.getDisplayValue(Math.floor(owned)) + "</span></span>";
			}
			this.$("resources").html(html);
		},

		setCursor: function (index) {
			let hasToggle = this.$("toggle-container").is(":visible");
			let numRows = this.rows ? this.rows.length : 0;
			let min = hasToggle ? -1 : 0;
			if (index < min) index = min;
			if (index >= numRows) index = numRows - 1;
			if (index < min) index = min;

			this.cursor = index;
			this.$("list").find(".chooser-popup-row").removeClass("selected");
			this.$("toggle-container").toggleClass("selected", index == -1);
			if (index >= 0) {
				let $row = this.$("list").find(".chooser-popup-row[data-index='" + index + "']");
				$row.addClass("selected");
				if ($row.length > 0 && $row[0].scrollIntoView) $row[0].scrollIntoView({ block: "nearest" });
			}
		},

		getPageSize: function () {
			let $list = this.$("list");
			let $row = $list.find(".chooser-popup-row").first();
			if ($row.length == 0) return 3;
			let rowHeight = $row.outerHeight(true) || 1;
			return Math.max(3, Math.floor($list.innerHeight() / rowHeight));
		},

		// KEYS

		onKeyDown: function (e) {
			if (!this.isOpen) return;
			let oe = e.originalEvent || e;
			let code = oe.code || "";
			let hasModifier = e.ctrlKey || e.altKey || e.metaKey;
			if (hasModifier) return;
			let isMenu = this.screen == this.MENU;
			let numRows = this.rows ? this.rows.length : 0;
			let lastIndex = numRows - 1;

			// any key hides the tooltip: the row under it may change
			this.hideTooltip();

			if (code == "Escape") {
				e.preventDefault();
				if (e.shiftKey || isMenu) {
					this.close();
				} else {
					this.back();
				}
				this.swallowEscapeUp = true;
				return;
			}

			if (e.shiftKey) return;

			switch (code) {
				case "ArrowDown": e.preventDefault(); this.setCursor(this.cursor + 1); return;
				case "ArrowUp": e.preventDefault(); this.setCursor(this.cursor - 1); return;
				case "Home": e.preventDefault(); this.setCursor(0); return;
				case "End": e.preventDefault(); this.setCursor(lastIndex); return;
				case "PageDown": e.preventDefault(); this.setCursor(Math.min(lastIndex, this.cursor + this.getPageSize())); return;
				case "PageUp": e.preventDefault(); this.setCursor(Math.max(0, this.cursor - this.getPageSize())); return;
				case "Enter": case "NumpadEnter": e.preventDefault(); this.activateRow(); return;
				case "Backspace": case "ArrowLeft":
					if (!isMenu) { e.preventDefault(); this.back(); }
					return;
				case "ArrowRight":
					if (isMenu) { e.preventDefault(); this.activateRow(); }
					return;
				case "Space":
					// space belongs to the toggle alone; on the menu it does nothing, so
					// the same key never means two things
					e.preventDefault();
					if (!isMenu) this.toggleShowHidden();
					return;
			}

			if (isMenu && this.config.menuLetters && this.config.menuLetters[code] !== undefined) {
				e.preventDefault();
				let index = this.config.menuLetters[code];
				if (index > lastIndex) return;
				this.setCursor(index);
				this.activateRow();
				return;
			}

			// digits pick a row: 1-9, then 0 for the tenth
			let digit = -1;
			if (code.indexOf("Digit") == 0 && code.length == 6) digit = parseInt(code.charAt(5));
			if (code.indexOf("Numpad") == 0 && code.length == 7) digit = parseInt(code.charAt(6));
			if (!isNaN(digit) && digit >= 0) {
				e.preventDefault();
				let index = digit == 0 ? 9 : digit - 1;
				if (index > lastIndex) return;
				this.setCursor(index);
				this.activateRow();
			}
		},

		toggleShowHidden: function () {
			if (!this.$("toggle-container").is(":visible")) return;
			this.$("show-unavailable").click();
		},

		activateRow: function (retries) {
			if (!this.isOpen) return;
			// the popup is not really open until showSpecialPopup's fadeIn sets data-visible;
			// a press inside that window is kept and retried rather than dropped, so a fast
			// "B A 2" lands its last key too
			if (!this.isVisible()) {
				retries = retries || 0;
				if (retries < 20) setTimeout(() => this.activateRow(retries + 1), 25);
				return;
			}

			if (this.cursor == -1) {
				this.toggleShowHidden();
				return;
			}

			let row = this.rows ? this.rows[this.cursor] : null;
			if (!row) return;

			if (this.screen == this.MENU) {
				this.showScreen(row.entry.screen);
				return;
			}

			let entry = row.entry;
			let pressed = entry.available && this.config.press(entry, this.screen);
			if (!pressed) {
				this.flashUnavailable(this.cursor);
				return;
			}

			this.hideTooltip();
			// the press changed what the list shows: counts, levels, costs, busy state
			if (this.isOpen) this.renderList();
		},

		// highlight the name and the lacking costs of an unavailable row for a moment
		flashUnavailable: function (rowIndex) {
			let $row = this.$("list").find(".chooser-popup-row[data-index='" + rowIndex + "']");
			if ($row.length == 0) return;
			$row.addClass("chooser-popup-flash");
			setTimeout(function () { $row.removeClass("chooser-popup-flash"); }, 1000);
		},

		// TOOLTIPS
		// one body-level fixed pane (#chooser-tooltip) like the upgrade tree's

		cancelTooltip: function () {
			if (this.tooltipTimeout) {
				clearTimeout(this.tooltipTimeout);
				this.tooltipTimeout = null;
			}
		},

		hideTooltip: function () {
			this.cancelTooltip();
			this.tooltipIndex = null;
			let $tooltip = $("#chooser-tooltip");
			if ($tooltip.length == 0) return;
			$tooltip.hide().attr("aria-hidden", "true").empty();
		},

		showTooltip: function (index) {
			let $tooltip = $("#chooser-tooltip");
			if ($tooltip.length == 0) return;
			let row = index >= 0 && this.rows ? this.rows[index] : null;
			if (index >= 0 && !row) return;
			let $content = this.config.getTooltipContent(index, this.screen, row ? row.entry : null);
			if (!$content) return;

			this.tooltipIndex = index;
			$tooltip.empty().append($content);
			$tooltip.css({ left: "0px", top: "0px" }).show().attr("aria-hidden", "false");
			GameGlobals.uiFunctions.positionTooltipAtCursor($tooltip, this.tooltipCursor, this.TOOLTIP_CURSOR_GAP, this.TOOLTIP_EDGE_MARGIN);
		},

		// helpers for owners' tooltip builders

		makeTooltipContent: function () {
			let $content = $("<div></div>");
			return {
				$content: $content,
				addHeader: function (name, badge) {
					let $header = $("<div class='chooser-tooltip-header'></div>");
					$header.append($("<span></span>").text(name));
					if (badge) {
						$header.append(" ");
						$header.append($("<span class='status-badge'></span>").text(badge));
					}
					$content.append($header);
				},
				addLine: function (text, cls) {
					if (!text) return;
					$content.append($("<p></p>").addClass(cls || "").text(text));
				},
				addHTML: function (html, cls) {
					if (!html) return;
					$content.append($("<p></p>").addClass(cls || "").html(html));
				},
			};
		},

		getRowKeyLabel: function (index) {
			return index + 1 <= 9 ? String(index + 1) : index + 1 == 10 ? "0" : null;
		},

	});

	return UIChooserPopup;
});
