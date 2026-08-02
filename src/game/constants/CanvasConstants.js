define(['ash', 'game/constants/UIConstants'
], function (Ash, UIConstants) {
	
	var CanvasConstants = {
	
		makeCanvasScrollable: function (canvasId) {
			$("#" + canvasId).mousedown({ helper: this }, this.onScrollableMapMouseDown);
			$("#" + canvasId).mouseup({ helper: this }, this.onScrollableMapMouseUp);
			$("#" + canvasId).mouseleave({ helper: this }, this.onScrollableMapMouseLeave);
			$("#" + canvasId).mousemove({ helper: this }, this.onScrollableMapMouseMove);

			$("#" + canvasId).addClass("scrollable");

			$("#" + canvasId).parent().wrap("<div class='scroll-position-container lvl13-box-2'></div>");
			$("#" + canvasId).parent().before("<div class='scroll-position-indicator scroll-position-indicator-vertical' data-canvasid='" + canvasId + "' />");
			$("#" + canvasId).parent().before("<div class='scroll-position-indicator scroll-position-indicator-horizontal' data-canvasid='" + canvasId + "' />");

			this.makeCanvasTouchScrollable(canvasId);
		},

		// touch drag-to-pan; bound on the scroll container so drags that start on
		// overlay cells pan too; taps without movement still click through
		makeCanvasTouchScrollable: function (canvasId) {
			let helper = this;
			let container = $("#" + canvasId).parent()[0];
			if (!container) return;

			// stop the browser from scrolling the page with touches that start on the map
			container.style.touchAction = "none";

			let state = { active: false, moved: false, startX: 0, startY: 0, startLeft: 0, startTop: 0, suppressClickUntil: 0 };

			container.addEventListener("touchstart", function (e) {
				if (e.touches.length != 1) { state.active = false; return; }
				state.active = true;
				state.moved = false;
				state.startX = e.touches[0].pageX;
				state.startY = e.touches[0].pageY;
				state.startLeft = container.scrollLeft;
				state.startTop = container.scrollTop;
			}, { passive: true });

			container.addEventListener("touchmove", function (e) {
				if (!state.active || e.touches.length != 1) return;
				let dx = e.touches[0].pageX - state.startX;
				let dy = e.touches[0].pageY - state.startY;
				if (!state.moved && Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
				state.moved = true;
				e.preventDefault();
				container.scrollLeft = state.startLeft - dx;
				container.scrollTop = state.startTop - dy;
				helper.updateScrollIndicators(canvasId);
			}, { passive: false });

			container.addEventListener("touchend", function (e) {
				if (!state.active) return;
				state.active = false;
				if (state.moved) {
					helper.snapScrollPositionToGrid(canvasId);
					helper.updateScrollIndicators(canvasId);
					state.suppressClickUntil = Date.now() + 400;
				}
			});

			container.addEventListener("touchcancel", function () {
				state.active = false;
			});

			// a click right after a drag is the tail of the drag, not a tap
			container.addEventListener("click", function (e) {
				if (Date.now() < state.suppressClickUntil) {
					e.preventDefault();
					e.stopPropagation();
				}
			}, true);
		},
		
		onScrollableMapMouseDown: function (e) {
			e.data.helper.clearPageSelection();
			e.preventDefault();
			$(this).attr("scrolling", "true");
			$(this).attr("scrollStartX", Math.floor(e.pageX));
			$(this).attr("scrollStartY", Math.floor(e.pageY));
			$(this).attr("scrollStartXScrollLeft", Math.floor($(this).parent().scrollLeft()));
			$(this).attr("scrollStartXScrollTop", Math.floor($(this).parent().scrollTop()));
		},
		
		onScrollableMapMouseUp: function (e) {
			e.data.helper.snapScrollPositionToGrid($(this).attr("id"));
			$(this).attr("scrolling", "false");
		},
		
		onScrollableMapMouseLeave: function (e) {
			if (e.data.helper.isInBounds($(this), e)) {
				return;
			}
			e.data.helper.snapScrollPositionToGrid($(this).attr("id"));
			$(this).attr("scrolling", "false");
		},
		
		onScrollableMapMouseMove: function (e) {
			var isScrolling = $(this).attr("scrolling") === "true";
			if (isScrolling) {
				let currentX = Math.floor(e.pageX);
				let currentY = Math.floor(e.pageY);
				let posX = currentX - parseInt($(this).attr("scrollStartX")) - parseInt($(this).attr("scrollStartXScrollLeft"));
				let posY = currentY - parseInt($(this).attr("scrollStartY")) - parseInt($(this).attr("scrollStartXScrollTop"));
				$(this).parent().scrollLeft(-posX);
				$(this).parent().scrollTop(-posY);
				e.data.helper.updateScrollIndicators($(this).attr("id"));
			}
		},
		
		isInBounds: function ($elem, e) {
			let $container = $elem.parent();
			let offset = $container.offset();
			if (e.pageX < offset.left) return false;
			if (e.pageX > offset.left + $container.width()) return false;
			if (e.pageY < offset.top) return false;
			if (e.pageY > offset.top + $container.height()) return false;
			return true;
		},
		
		clearPageSelection: function () {
			if (window.getSelection) {
				if (window.getSelection().empty) {
			   		window.getSelection().empty();
			 	} else if (window.getSelection().removeAllRanges) {
			   		window.getSelection().removeAllRanges();
		 		}
		   	} else if (document.selection) {
			 	document.selection.empty();
		   	}
		},
		
		updateScrollEnable: function (canvasId) {
			var scrollContainer = $("#" + canvasId).parent();
			var maxScrollPosX = Math.max(0, -(scrollContainer.width() - $("#" + canvasId).width()));
			var maxScrollPosY = Math.max(0, -(scrollContainer.height() - $("#" + canvasId).height()));
			var isScrollEnabled = maxScrollPosY > 0 || maxScrollPosX > 0;
			if (!isScrollEnabled && $("#" + canvasId).hasClass("scroll-enabled"))
				$("#" + canvasId).removeClass("scroll-enabled");
			if (isScrollEnabled && !$("#" + canvasId).hasClass("scroll-enabled"))
				$("#" + canvasId).addClass("scroll-enabled");
		},
		
		updateScrollIndicators: function (canvasId) {
			var scrollContainer = $("#" + canvasId).parent();
			var scrollIndicatorVertical = scrollContainer.siblings(".scroll-position-indicator-vertical")[0];
			var scrollIndicatorHorizontal = scrollContainer.siblings(".scroll-position-indicator-horizontal")[0];
			
			var verticalScrollHeight = Math.min(1, scrollContainer.height() / $("#" + canvasId).height());
			var verticalScrollWidth = Math.min(1, scrollContainer.width() / $("#" + canvasId).width());
			var scrollIndicatorVerticalHeight = $(scrollIndicatorVertical).parent().height() * verticalScrollHeight;
			var scrollIndicatorHorizontalWidth = $(scrollIndicatorHorizontal).parent().width() * verticalScrollWidth;
			$(scrollIndicatorVertical).css("height", scrollIndicatorVerticalHeight + "px");
			$(scrollIndicatorHorizontal).css("width", scrollIndicatorHorizontalWidth + "px");
			
			var scrollPosX = scrollContainer.scrollLeft();
			var maxScrollPosX = Math.max(0, -(scrollContainer.width() - $("#" + canvasId).width()));
			var scrollPosY = scrollContainer.scrollTop();
			var maxScrollPosY = Math.max(0, -(scrollContainer.height() - $("#" + canvasId).height()));
			var maxIndicatorTop = scrollContainer.height() - scrollIndicatorVerticalHeight;
			var maxIndicatorLeft = scrollContainer.width() - scrollIndicatorHorizontalWidth;
			$(scrollIndicatorVertical).css("top", UIConstants.SCROLL_INDICATOR_SIZE + (maxScrollPosY > 0 ? (scrollPosY / maxScrollPosY) * maxIndicatorTop : 0) + "px");
			$(scrollIndicatorHorizontal).css("left", UIConstants.SCROLL_INDICATOR_SIZE + (maxScrollPosX > 0 ? (scrollPosX / maxScrollPosX) * maxIndicatorLeft : 0) + "px");
		},
		
		snapScrollPositionToGrid: function (canvasId) {
			let scrollContainer = $("#" + canvasId).parent();
			let currentPosition = {
				x: scrollContainer.scrollLeft(),
				y: scrollContainer.scrollTop(),
			};
			let snapPosition = this.getScrollSnapPosition(currentPosition);
			scrollContainer.scrollLeft(snapPosition.x);
			scrollContainer.scrollTop(snapPosition.y);
		},
		
		getScrollSnapPosition: function (currentPosition) {
			// TODO set grid size per canvas
			return {
				x: Math.round(currentPosition.x / 20) * 20,
				y: Math.round(currentPosition.y / 20) * 20,
			}
		}
	};
	
	return CanvasConstants;
});
