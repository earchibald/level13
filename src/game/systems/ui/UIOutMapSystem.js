define([
	'ash',
	'text/Text',
	'utils/FileUtils',
	'utils/MapUtils',
	'game/GameGlobals',
	'game/GlobalSignals',
	'game/constants/GameConstants',
	'game/constants/ItemConstants',
	'game/constants/LevelConstants',
	'game/constants/LocaleConstants',
	'game/constants/MovementConstants',
	'game/constants/PositionConstants',
	'game/constants/SectorConstants',
	'game/constants/TextConstants',
	'game/constants/TradeConstants',
	'game/constants/UIConstants',
	'game/constants/CanvasConstants',
	'game/nodes/PlayerLocationNode',
	'game/nodes/PlayerPositionNode',
	'game/components/common/CampComponent',
	'game/components/common/PositionComponent',
	'game/components/sector/EnemiesComponent',
	'game/components/sector/PassagesComponent',
	'game/components/sector/SectorControlComponent',
	'game/components/sector/SectorFeaturesComponent',
	'game/components/sector/SectorLocalesComponent',
	'game/components/sector/SectorStatusComponent',
	'game/components/sector/improvements/SectorImprovementsComponent',
	'game/components/sector/improvements/WorkshopComponent',
	'game/components/player/ItemsComponent',
	'game/components/type/LevelComponent',
	'game/systems/CheatSystem',
], function (Ash, Text, FileUtils, MapUtils, GameGlobals, GlobalSignals, GameConstants, ItemConstants, LevelConstants, LocaleConstants, MovementConstants, PositionConstants, SectorConstants, TextConstants, TradeConstants, UIConstants, CanvasConstants,
	PlayerLocationNode, PlayerPositionNode,
	CampComponent, PositionComponent, EnemiesComponent, PassagesComponent, SectorControlComponent, SectorFeaturesComponent, SectorLocalesComponent, SectorStatusComponent, SectorImprovementsComponent, WorkshopComponent, ItemsComponent, LevelComponent,
	CheatSystem) {

	var UIOutMapSystem = Ash.System.extend({

		context: "UIOutMapSystem",
		
		playerPositionNodes: null,
		playerLocationNodes: null,
		
		MAP_STYLE_CANVAS: "canvas",
		MAP_STYLE_ASCII: "ascii",

		wasLandscape: null, // null until the first resize, so a load is not a rotation

		constructor: function () {
			this.initElements();
			this.updateHeight();
		},

		addToEngine: function (engine) {
			this.engine = engine;
			$("#select-header-level").on("change", $.proxy(this.onLevelSelectorChanged, this));
			$("#select-header-mapmode").on("change", $.proxy(this.onMapModeSelectorChanged, this));
			$("#select-header-mapstyle").on("change", $.proxy(this.onMapStyleSelectorChanged, this));
			GameGlobals.uiMapHelper.enableScrollingForMap("mainmap");
			// delegated so the handlers survive the overlay being rebuilt (on zoom, level change etc)
			this._onSectorHoverIn = $.proxy(this.onSectorHoverIn, this);
			this._onSectorHoverMove = $.proxy(this.onSectorHoverMove, this);
			this._onSectorHoverOut = $.proxy(this.onSectorHoverOut, this);
			this._onMapScroll = $.proxy(this.hideSectorTooltip, this);
			$("#mainmap-container").on("scroll", this._onMapScroll);
			$("#mainmap-overlay, #minimap-overlay").on("mouseenter", ".map-overlay-cell", this._onSectorHoverIn);
			$("#mainmap-overlay, #minimap-overlay").on("mousemove", ".map-overlay-cell", this._onSectorHoverMove);
			$("#mainmap-overlay, #minimap-overlay").on("mouseleave", ".map-overlay-cell", this._onSectorHoverOut);
			$("#minimap-background-overlay").on("mouseenter", ".map-hint-cell", this._onSectorHoverIn);
			$("#minimap-background-overlay").on("mousemove", ".map-hint-cell", this._onSectorHoverMove);
			$("#minimap-background-overlay").on("mouseleave", ".map-hint-cell", this._onSectorHoverOut);
			// touch parity: tap shows the minimap tooltips (hover does not exist);
			// the main map needs no tap tooltip since tap opens the details panel
			if (UIConstants.isTouchScreen()) {
				this._onSectorTapTooltip = $.proxy(this.onSectorTapTooltip, this);
				this._onDocumentTapHideTooltip = $.proxy(this.onDocumentTapHideTooltip, this);
				$("#minimap-overlay").on("click", ".map-overlay-cell", this._onSectorTapTooltip);
				$("#minimap-background-overlay").on("click", ".map-hint-cell", this._onSectorTapTooltip);
				$(document).on("click", this._onDocumentTapHideTooltip);
			}
			this.playerPositionNodes = engine.getNodeList(PlayerPositionNode);
			this.playerLocationNodes = engine.getNodeList(PlayerLocationNode);
			GlobalSignals.add(this, GlobalSignals.playerPositionChangedSignal, this.hideSectorTooltip);
			GlobalSignals.add(this, GlobalSignals.tabChangedSignal, this.onTabChanged);
			GlobalSignals.add(this, GlobalSignals.gameStartedSignal, this.onGameStarted);
			GlobalSignals.add(this, GlobalSignals.windowResizedSignal, this.onResize);
			GlobalSignals.add(this, GlobalSignals.clearBubblesSignal, this.clearBubble);
		},

		removeFromEngine: function (engine) {
			this.engine = null;
			GlobalSignals.removeAll(this);
			$("#select-header-level").off("change", $.proxy(this.onLevelSelectorChanged, this));
			$("#select-header-mapmode").off("change", $.proxy(this.onMapModeSelectorChanged, this));
			$("#select-header-mapstyle").off("change", $.proxy(this.onMapStyleSelectorChanged, this));
			GameGlobals.uiMapHelper.disableScrollingForMap("mainmap");
			this.hideSectorTooltip();
			if (this._onMapScroll) $("#mainmap-container").off("scroll", this._onMapScroll);
			$("#mainmap-overlay, #minimap-overlay").off("mouseenter", ".map-overlay-cell", this._onSectorHoverIn);
			$("#mainmap-overlay, #minimap-overlay").off("mousemove", ".map-overlay-cell", this._onSectorHoverMove);
			$("#mainmap-overlay, #minimap-overlay").off("mouseleave", ".map-overlay-cell", this._onSectorHoverOut);
			$("#minimap-background-overlay").off("mouseenter", ".map-hint-cell", this._onSectorHoverIn);
			$("#minimap-background-overlay").off("mousemove", ".map-hint-cell", this._onSectorHoverMove);
			$("#minimap-background-overlay").off("mouseleave", ".map-hint-cell", this._onSectorHoverOut);
			if (this._onSectorTapTooltip) {
				$("#minimap-overlay").off("click", ".map-overlay-cell", this._onSectorTapTooltip);
				$("#minimap-background-overlay").off("click", ".map-hint-cell", this._onSectorTapTooltip);
				$(document).off("click", this._onDocumentTapHideTooltip);
			}
			if (this._onDocumentTapDeselectSector) {
				$(document).off("click", this._onDocumentTapDeselectSector);
			}
			this.playerPositionNodes = null;
			this.playerLocationNodes = null;
		},
		
		initElements: function () {
			var sys = this;
			$("#btn-cheat-teleport").click(function () {
				GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.buttonClicked);
				sys.teleport();
			});
			$("#btn-download-map").click(function () {
				GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.buttonClicked);
				sys.downloadASCIIMap();
			});
			$("#btn-mainmap-sector-details-next").click($.proxy(this.selectNextSector, this));
			$("#btn-mainmap-sector-details-previous").click($.proxy(this.selectPreviousSector, this));
			$("#btn-mainmap-sector-details-camp").click($.proxy(this.selectCampSector, this));
			$("#btn-mainmap-sector-details-unknown").click($.proxy(this.selectUnknownSector, this));
			$("#btn-mainmap-sector-details-unscouted").click($.proxy(this.selectUnscoutedLocaleSector, this));
			$("#btn-mainmap-sector-details-ingredients").click($.proxy(this.selectIngredientSector, this));
			$("#btn-mainmap-sector-details-investigate").click($.proxy(this.selectInvestigateSector, this));
			
			$("#btn-mainmap-sector-path").click($.proxy(this.showSectorPath, this));
			$("#btn-mainmap-sector-details-close").click($.proxy(this.deselectSector, this));

			// A tap anywhere closes the sector panel, the way the minimap's
			// tooltip already behaves. Delegated on the document rather than
			// bound to the map, so a tap on any other part of the screen
			// closes it too.
			//
			// Two exceptions, both by containment rather than by
			// stopPropagation on the cells: the cells' own handler is shared
			// with the minimap and must not change, and a tap inside the panel
			// is for the "(directions)" link or to scroll, not to close.
			this._onDocumentTapDeselectSector = $.proxy(this.onDocumentTapDeselectSector, this);
			$(document).on("click", this._onDocumentTapDeselectSector);

			$("#btn-mainmap-zoom-in").click($.proxy(function () {
				GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.buttonClicked);
				this.onZoomButton(1);
			}, this));
			$("#btn-mainmap-zoom-out").click($.proxy(function () {
				GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.buttonClicked);
				this.onZoomButton(-1);
			}, this));

			this.initTouchZoom();
		},

		// pinch-to-zoom on the map canvas (the container has touch-action: none)
		initTouchZoom: function () {
			let sys = this;
			let container = $("#mainmap-container")[0];
			if (!container) return;
			// tells CanvasConstants to keep touch-action: none even when the canvas
			// fits, so pinch gestures are never claimed by native page scrolling
			container.dataset.touchZoom = "true";
			let pinch = { active: false, startDist: 0 };
			let getTouchDistance = function (e) {
				let dx = e.touches[0].pageX - e.touches[1].pageX;
				let dy = e.touches[0].pageY - e.touches[1].pageY;
				return Math.sqrt(dx * dx + dy * dy);
			};
			container.addEventListener("touchstart", function (e) {
				if (e.touches.length == 2) {
					pinch.active = true;
					pinch.startDist = getTouchDistance(e);
				} else {
					pinch.active = false;
				}
			}, { passive: true });
			container.addEventListener("touchmove", function (e) {
				if (!pinch.active || e.touches.length != 2) return;
				if (sys.selectedMapStyle != sys.MAP_STYLE_CANVAS) return;
				if (!sys.playerPositionNodes || !sys.playerPositionNodes.head) return;
				e.preventDefault();
				if (pinch.startDist <= 0) return;
				let dist = getTouchDistance(e);
				let ratio = dist / pinch.startDist;
				let midX = (e.touches[0].pageX + e.touches[1].pageX) / 2;
				let midY = (e.touches[0].pageY + e.touches[1].pageY) / 2;
				if (ratio > 1.25) {
					sys.hideSectorTooltip();
					sys.zoomMap(1, midX, midY);
					pinch.startDist = dist;
				} else if (ratio < 0.8) {
					sys.hideSectorTooltip();
					sys.zoomMap(-1, midX, midY);
					pinch.startDist = dist;
				}
			}, { passive: false });
			container.addEventListener("touchend", function (e) {
				if (e.touches.length < 2) pinch.active = false;
			});
		},

		onZoomButton: function (steps) {
			if (this.selectedMapStyle != this.MAP_STYLE_CANVAS) return;
			if (!this.playerPositionNodes || !this.playerPositionNodes.head) return;
			this.hideSectorTooltip();
			// null focal point = zoom on the container center
			this.zoomMap(steps, null, null);
		},

		update: function (time) {
			if (GameGlobals.gameState.uiStatus.isHidden) return;
			this.updateBubble();
		},

		updateBubble: function () {
			let bubbleNumber = 0;
			if (!GameGlobals.gameState.hasSeenTab(GameGlobals.uiFunctions.elementIDs.tabs.map)) bubbleNumber = "!";
			GameGlobals.uiFunctions.updateBubble("#switch-map .bubble", this.bubbleNumber, bubbleNumber);
			this.bubbleNumber = bubbleNumber;
		},
		
		updateHeight: function () {
			// On the small layout the map tab is the whole column - the stylesheet
			// gives the map whatever is left of it, in portrait and in the
			// landscape map mode alike. A height measured here would only fight
			// that, and it would win: it is written inline. Landscape is where it
			// showed, because a sideways phone is 393pt tall and the chrome
			// allowance left the map its 198pt floor.
			if ($("body").hasClass("layout-small")) {
				$("#mainmap-container").css("maxHeight", "");
				return;
			}

			var maxHeight = Math.max(198, $(window).height() - 380);
			$("#mainmap-container").css("maxHeight", maxHeight + "px");
		},

		initLevelSelector: function () {
			$("#select-header-level").empty();
			var html = "";
			var surfaceLevel = GameGlobals.gameState.getSurfaceLevel();
			var groundLevel = GameGlobals.gameState.getGroundLevel();
			for (let i = surfaceLevel; i >= groundLevel; i--) {
				let label = this.getLevelSelectorOptionLabel(i);
				html += "<option value='" + i + "' id='map-level-selector-level-" + i + "'>" + label + "</option>"
			}
			$("#select-header-level").append(html);
		},
		
		initMapModeSelector: function () {
			$("#select-header-mapmode").empty();
			var html = "";
			html += "<option value='" + MapUtils.MAP_MODE_DEFAULT + "' id='map-style-selector-" + this.MAP_MODE_DEFAULT + "'>Default</option>";
			html += "<option value='" + MapUtils.MAP_MODE_HAZARDS + "' id='map-style-selector-" + this.MAP_MODE_HAZARDS + "'>Hazards</option>";
			html += "<option value='" + MapUtils.MAP_MODE_SCAVENGING + "' id='map-style-selector-" + this.MAP_MODE_SCAVENGING + "'>Scavenging</option>";
			$("#select-header-mapmode").append(html);
		},
		
		initMapStyleSelector: function () {
			$("#select-header-mapstyle").empty();
			var html = "";
			html += "<option value='" + this.MAP_STYLE_CANVAS + "' id='map-style-selector-" + this.MAP_STYLE_CANVAS + "'>Canvas</option>";
			html += "<option value='" + this.MAP_STYLE_ASCII + "' id='map-style-selector-" + this.MAP_STYLE_CANVAS + "'>ASCII</option>";
			$("#select-header-mapstyle").append(html);
		},

		updateLevelSelector: function () {
			var surfaceLevel = GameGlobals.gameState.getSurfaceLevel();
			var groundLevel = GameGlobals.gameState.getGroundLevel();
			var countVisible = 0;
			for (let i = surfaceLevel; i >= groundLevel; i--) {
				let isVisible = GameGlobals.uiMapHelper.isMapRevealed || GameGlobals.levelHelper.isVisited(i);
				let $elem = $("#map-level-selector-level-" + i);
				let levelStats = GameGlobals.levelHelper.getLevelStats(i);
				let isCleared = levelStats.percentClearedSectors >= 1;
				GameGlobals.uiFunctions.toggle($elem, isVisible);
				if (isVisible) {
					$elem.text(this.getLevelSelectorOptionLabel(i, isCleared));
					countVisible++;
				}
			}
			GameGlobals.uiFunctions.toggle($("#select-header-level"), countVisible > 1);
		},

		getLevelSelectorOptionLabel: function (level, isCleared) {
				let surfaceLevel = GameGlobals.gameState.getSurfaceLevel();
				let groundLevel = GameGlobals.gameState.getGroundLevel();

				let result = "Level " + level;
				
				if (level == surfaceLevel) result = "Surface";
				if (level == groundLevel) result = "Ground";

				if (isCleared) result += " (x)";
				else result += " (-)";

				return result;
		},

		selectLevel: function (level) {
			$("#select-header-level").val(level);
			this.selectedLevel = level;
			this.selectedSector = null;
			this.updateMap();
			this.updateSector();
			this.centerMap();
		},

		selectSector: function (level, x, y) {
			this.selectedSector = GameGlobals.levelHelper.getSectorByPosition(level, x, y);
			GameGlobals.uiMapHelper.setSelectedSector(this.map, this.selectedSector);
			this.updateSector();
		},

		// KEYBOARD CURSOR
		// The map is driven with the same eight directions the player walks with. One press
		// is one cell: the cursor never scans across a gap looking for the next drawn sector,
		// because a press that jumps an arbitrary distance reads as the cursor teleporting.

		canSelectSectorAt: function (level, x, y) {
			let sector = GameGlobals.levelHelper.getSectorByPosition(level, x, y);
			if (!sector) return false;
			// a blank cell is blank on purpose - landing on one would confirm a sector is
			// there, which is exactly what the map is withholding
			let status = GameGlobals.uiMapHelper.getSectorStatus(sector);
			if (status == SectorConstants.MAP_SECTOR_STATUS_UNVISITED_INVISIBLE) return false;
			return true;
		},

		moveSelectionInDirection: function (direction) {
			if (!this.selectedSector) {
				// nothing selected yet, so start where the player is
				return this.selectPlayerSectorIfOnLevel();
			}

			let currentPos = this.selectedSector.get(PositionComponent);
			if (!currentPos) return false;

			let nextPos = PositionConstants.getNeighbourPosition(currentPos, direction);
			if (!this.canSelectSectorAt(currentPos.level, nextPos.sectorX, nextPos.sectorY)) return false;

			this.selectSector(currentPos.level, nextPos.sectorX, nextPos.sectorY);
			this.scrollSelectionIntoView();
			return true;
		},

		selectPlayerSectorIfOnLevel: function () {
			if (!this.playerPositionNodes.head) return false;
			let playerPos = this.playerPositionNodes.head.position;
			// the level selector can be showing a level the player is not on, and there is
			// nothing of theirs to select there
			if (this.selectedLevel != playerPos.level) return false;
			if (!this.canSelectSectorAt(playerPos.level, playerPos.sectorX, playerPos.sectorY)) return false;
			this.selectSector(playerPos.level, playerPos.sectorX, playerPos.sectorY);
			this.scrollSelectionIntoView();
			return true;
		},

		// a click can only reach a cell that is already on screen, so nothing needed this
		// until the keyboard could move the selection somewhere the player is not looking
		scrollSelectionIntoView: function () {
			if (!this.selectedSector) return;
			let pos = this.selectedSector.get(PositionComponent);
			if (!pos) return;
			let $container = $("#mainmap-container");
			if ($container.length == 0) return;
			// scope to the main map: the minimap draws cells with the same data attributes,
			// and its copy is not displayed, so measuring it would give nonsense
			let $cell = $container.find(".map-overlay-cell[data-level='" + pos.level + "'][data-x='" + pos.sectorX + "'][data-y='" + pos.sectorY + "']");
			if ($cell.length == 0) return;

			// measure with bounding rects rather than position(): the cell's offset parent is
			// the scrolled content, not the container, so position() is already content
			// relative and adding scrollLeft would count the scroll twice
			let cellRect = $cell[0].getBoundingClientRect();
			let containerRect = $container[0].getBoundingClientRect();

			let deltaLeft = cellRect.left - containerRect.left;
			if (deltaLeft < 0) {
				$container.scrollLeft($container.scrollLeft() + deltaLeft);
			} else if (deltaLeft + cellRect.width > containerRect.width) {
				$container.scrollLeft($container.scrollLeft() + deltaLeft + cellRect.width - containerRect.width);
			}

			let deltaTop = cellRect.top - containerRect.top;
			if (deltaTop < 0) {
				$container.scrollTop($container.scrollTop() + deltaTop);
			} else if (deltaTop + cellRect.height > containerRect.height) {
				$container.scrollTop($container.scrollTop() + deltaTop + cellRect.height - containerRect.height);
			}
		},

		// Drops the selection, which is what hides the details - updateSector
		// toggles the content block on whether there is a selected sector. Same
		// two steps selectLevel takes, so the map redraws without its highlight.
		deselectSector: function () {
			this.selectedSector = null;
			this.updateMap();
			this.updateSector();
		},
		
		selectMapMode: function (mapMode) {
			$("#select-header-mapmode").val(mapMode);
			
			this.selectedMapMode = mapMode;
			$("#mainmap-sector-details-res-sca").closest("tr").toggleClass("current", this.selectedMapMode == MapUtils.MAP_MODE_SCAVENGING);
			$("#mainmap-sector-details-res-col").closest("tr").toggleClass("current", this.selectedMapMode == MapUtils.MAP_MODE_SCAVENGING);
			$("#mainmap-sector-details-threats").closest("tr").toggleClass("current", this.selectedMapMode == MapUtils.MAP_MODE_HAZARDS);
			$("#mainmap-sector-details-blockers").closest("tr").toggleClass("current", this.selectedMapMode == MapUtils.MAP_MODE_HAZARDS);
			$("#mainmap-sector-details-env").closest("tr").toggleClass("current", this.selectedMapMode == MapUtils.MAP_MODE_HAZARDS);
			
			this.updateHeader();
			this.updateMap();
		},
		
		selectMapStyle: function (mapStyle) {
			$("#select-header-mapstyle").val(mapStyle);
			
			this.selectedMapStyle = mapStyle;
			GameGlobals.gameState.settings.mapStyle = mapStyle;
			$("#mainmap-container-container").toggle(mapStyle == this.MAP_STYLE_CANVAS);
			$("#mainmap-sector-details-empty-text-canvas").toggle(mapStyle == this.MAP_STYLE_CANVAS);
			$("#mainmap-container-ascii").toggle(mapStyle == this.MAP_STYLE_ASCII);
			$("#mainmap-sector-details-empty-text-ascii").toggle(mapStyle == this.MAP_STYLE_ASCII);
			$("#btn-download-map").toggle(mapStyle == this.MAP_STYLE_ASCII);
			
			this.updateMap();
			this.centerMap();
		},

		updateMap: function () {
			if (!this.playerPositionNodes || !this.playerPositionNodes.head) return;
			
			let sys = this;

			// No read of the player's current sector here - the map is drawn from
			// getCurrentMapPosition, which asks the player's position. There was a
			// `playerLocationNodes.head.entity` on this line and nothing used it,
			// and the node is empty until PlayerPositionSystem has run once: on a
			// save whose last tab was the map, the first draw came before that and
			// took the game down to the "you've found a bug" popup on every load.
			let mapPosition = this.getCurrentMapPosition();
			
			let levelEntity = GameGlobals.levelHelper.getLevelEntityForPosition(mapPosition.level);
			if (!levelEntity) return;

			var hasCampOnLevel = levelEntity.get(CampComponent) !== null;
			GameGlobals.uiFunctions.toggle($("#btn-mainmap-sector-details-camp"), hasCampOnLevel);
			
			let mapStatus = GameGlobals.levelHelper.getLevelStats(this.selectedLevel);
			let hasUnknownSectors = mapStatus.percentVisitedSectors < 1 || mapStatus.countVisitedSectors > mapStatus.countScoutedSectors;
			let hasUnscoutedLocaleSectors = mapStatus.countUnscoutedLocaleSectors > 0;
			let hasIngredientSectors = mapStatus.countKnownIngredientSectors > 0;
			let hasInvestigateSectors = mapStatus.countInvestigatableSectors > 0;
			
			GameGlobals.uiFunctions.toggle($("#btn-mainmap-sector-details-unknown"), hasUnknownSectors);
			GameGlobals.uiFunctions.toggle($("#btn-mainmap-sector-details-unscouted"), hasUnscoutedLocaleSectors);
			GameGlobals.uiFunctions.toggle($("#btn-mainmap-sector-details-ingredients"), hasIngredientSectors);
			GameGlobals.uiFunctions.toggle($("#btn-mainmap-sector-details-investigate"), hasInvestigateSectors);
				
			if (this.selectedMapStyle == this.MAP_STYLE_CANVAS) {
				$("#mainmap-container-container").css("opacity", 0);
				
				setTimeout(function () {
					sys.map = GameGlobals.uiMapHelper.rebuildMap("mainmap", "mainmap-overlay", mapPosition, -1, false, sys.selectedMapMode, function (level, x, y) {
						sys.onSectorSelected(level, x, y);
					});
					$("#mainmap-container-container").css("opacity", 1);
					GameGlobals.uiMapHelper.setSelectedSector(sys.map, sys.selectedSector);
				}, 10);
			} else {
				let ascii = GameGlobals.uiMapHelper.getASCII(this.selectedMapMode, mapPosition, false);
				let rows = ascii.split("\n").length;
				rows = Math.min(rows, 25);
				rows = Math.max(rows, 5);
				$("#mainmap-container-ascii textarea").text(ascii);
				$("#mainmap-container-ascii textarea").attr("rows", rows)
				$("#mainmap-ascii-legend").text(GameGlobals.uiMapHelper.getASCIILegend(this.selectedMapMode));
			}
		},

		updateSector: function () {
			let hasSector = this.selectedSector !== null;
			let path = this.findPathTo(this.selectedSector);
			let hasPath = hasSector && path && path.length > 0;
			
			let position = hasSector ? this.selectedSector.get(PositionComponent).getPosition() : null;
			// The player's own position, not the position of the sector entity they
			// are standing on. The two agree, but the sector node is empty until
			// PlayerPositionSystem has run once - and with the map as the tab the
			// game opens on, this runs before that and took the game down. It is
			// also only needed when a sector is selected, which it never is here.
			let hasPlayerPosition = this.playerPositionNodes && this.playerPositionNodes.head;
			let levelDiff = hasSector && hasPlayerPosition ? Math.abs(position.level - this.playerPositionNodes.head.position.level) : 0;
			
			GameGlobals.uiFunctions.toggle($("#mainmap-sector-details-content-empty"), !hasSector);
			GameGlobals.uiFunctions.toggle($("#mainmap-sector-details-content"), hasSector);
			GameGlobals.uiFunctions.toggle($("#mainmap-sector-details-content-debug"), hasSector && GameConstants.isCheatsEnabled);
			GameGlobals.uiFunctions.toggle($("#btn-mainmap-sector-path"), hasSector && hasPath && levelDiff <= 1);

			if (hasSector) {
				let statusComponent = this.selectedSector.get(SectorStatusComponent);
				var isScouted = statusComponent.scouted;
				var isVisited = GameGlobals.sectorHelper.isVisited(this.selectedSector);
				var sectorFeatures = this.selectedSector.get(SectorFeaturesComponent);
				var features = GameGlobals.sectorHelper.getTextFeatures(this.selectedSector);
				var header = isVisited ? TextConstants.getSectorName(isScouted, features) : "Sector";
				$("#mainmap-sector-details-name").text(header);
				$("#mainmap-sector-details-pos").text(position.getInGameFormat(false));
				$("#mainmap-sector-details-district").text(this.getDistrictText(this.selectedSector));
				$("#mainmap-sector-details-distance").text(this.getDistanceText(this.selectedSector));
				$("#mainmap-sector-details-poi").text(this.getPOIText(this.selectedSector, isScouted));
				$("#mainmap-sector-details-res-sca").text(this.getResScaText(this.selectedSector, isScouted, statusComponent, sectorFeatures));
				$("#mainmap-sector-details-res-col").text(this.getCollectorsText(this.selectedSector, isScouted));
				$("#mainmap-sector-details-threats").text(this.getThreatsText(this.selectedSector, isScouted));
				$("#mainmap-sector-details-blockers").text(this.getBlockersHTML(this.selectedSector, isScouted));
				$("#mainmap-sector-details-env").html(this.getEnvironmentHTML(this.selectedSector, isScouted));
				$("#mainmap-sector-details-misc").html(this.getMiscHTML(this.selectedSector, isScouted));
				$("#mainmap-sector-debug-text").text("Zone: " + sectorFeatures.zone);
			}
		},

		// SECTOR HOVER TOOLTIP

		SECTOR_TOOLTIP_DELAY: 450,
		SECTOR_TOOLTIP_CURSOR_GAP: 16,
		SECTOR_TOOLTIP_EDGE_MARGIN: 8,

		MAP_HINT_LABELS: {
			"camp": "Camp",
			"passage-up": "Passage up",
			"passage-down": "Passage down",
			"water": "Nearest known water",
			"food": "Nearest known food",
			"quest": "Point of interest",
		},

		onSectorHoverIn: function (e) {
			// touch screens use the tap paths (details panel / tap tooltip); a tap's
			// synthesized mouseenter must not schedule the hover tooltip, which would
			// otherwise appear and stick (no mouseleave follows on touch)
			if (UIConstants.isTouchScreen()) return;
			let $cell = $(e.currentTarget);
			let level = parseInt($cell.attr("data-level"));
			let x = parseInt($cell.attr("data-x"));
			let y = parseInt($cell.attr("data-y"));
			let hintID = $cell.attr("data-hint-id");
			let contextLabel = hintID ? this.MAP_HINT_LABELS[hintID] : null;

			this.cancelSectorTooltip();
			this.tooltipCursor = { x: e.clientX, y: e.clientY };

			let sys = this;
			this.tooltipTimeout = setTimeout(function () {
				sys.tooltipTimeout = null;
				sys.showSectorTooltip(level, x, y, contextLabel);
			}, this.SECTOR_TOOLTIP_DELAY);
		},

		onSectorHoverMove: function (e) {
			this.tooltipCursor = { x: e.clientX, y: e.clientY };
			// once shown the pane stays put, so it does not jitter under the cursor
		},

		onDocumentTapDeselectSector: function (e) {
			if (!this.selectedSector) return;
			// Only while the map is the tab being looked at. deselectSector
			// redraws the whole canvas and its overlay, and without this the
			// tap that LEAVES the map would land that rebuild inside the first
			// frame of the tab transition - work for a screen nobody is on.
			if (GameGlobals.gameState.uiStatus.currentTab !== GameGlobals.uiFunctions.elementIDs.tabs.map) return;
			let $target = $(e.target);
			// a tap on a sector selects that one instead - its own handler has
			// already run by the time this does
			if ($target.closest(".map-overlay-cell").length > 0) return;
			// and a tap inside the panel or on the jump buttons is not a
			// request to close them
			if ($target.closest("#mainmap-sector-details").length > 0) return;
			// Nor is a tap on any of the map's other controls. The zoom
			// buttons and the level and style selects are SIBLINGS of the
			// panel rather than children of it, so containment in the panel
			// does not cover them - and zooming in to look at the sector you
			// just selected is exactly the moment the panel must survive.
			if ($target.closest("#mainmap-zoom-controls, #grid-tab-header").length > 0) return;
			this.deselectSector();
		},

		onSectorTapTooltip: function (e) {
			let $cell = $(e.currentTarget);
			let level = parseInt($cell.attr("data-level"));
			let x = parseInt($cell.attr("data-x"));
			let y = parseInt($cell.attr("data-y"));
			let hintID = $cell.attr("data-hint-id");
			let contextLabel = hintID ? this.MAP_HINT_LABELS[hintID] : null;

			this.cancelSectorTooltip();
			this.tooltipCursor = { x: e.clientX, y: e.clientY };
			this.showSectorTooltip(level, x, y, contextLabel);
			e.stopPropagation();
		},

		onDocumentTapHideTooltip: function (e) {
			if ($(e.target).closest(".map-overlay-cell, .map-hint-cell, #map-sector-tooltip").length > 0) return;
			this.hideSectorTooltip();
		},

		onSectorHoverOut: function (e) {
			this.cancelSectorTooltip();
			this.hideSectorTooltip();
		},

		cancelSectorTooltip: function () {
			if (this.tooltipTimeout) {
				clearTimeout(this.tooltipTimeout);
				this.tooltipTimeout = null;
			}
		},

		hideSectorTooltip: function () {
			this.cancelSectorTooltip();
			let $tooltip = $("#map-sector-tooltip");
			if ($tooltip.length == 0) return;
			$tooltip.hide().attr("aria-hidden", "true").empty();
		},

		showSectorTooltip: function (level, x, y, contextLabel) {
			let $tooltip = $("#map-sector-tooltip");
			if ($tooltip.length == 0) return;

			let sector = GameGlobals.levelHelper.getSectorByPosition(level, x, y);
			if (!sector) return;

			let $content = this.getSectorTooltipContent(sector);
			if (!$content) return;

			// map hints (camp, passage, water etc off the minimap) say what the hinted sector is
			if (contextLabel) {
				$content.prepend($("<div class='map-tooltip-context'></div>").text(contextLabel));
			}

			$tooltip.empty().append($content);
			// show before measuring so the pane has a real size to position against
			$tooltip.css({ left: "0px", top: "0px" }).show().attr("aria-hidden", "false");
			this.positionSectorTooltip($tooltip);
		},

		getSectorTooltipContent: function (sector) {
			let statusComponent = sector.get(SectorStatusComponent);
			let sectorFeatures = sector.get(SectorFeaturesComponent);
			let isScouted = statusComponent.scouted;
			let isVisited = GameGlobals.sectorHelper.isVisited(sector);
			let features = GameGlobals.sectorHelper.getTextFeatures(sector);
			let position = sector.get(PositionComponent).getPosition();

			let name = isVisited ? TextConstants.getSectorName(isScouted, features) : "Sector";

			let $header = $("<div class='map-tooltip-header'></div>");
			$header.append($("<span></span>").text(name));
			$header.append(" ");
			$header.append($("<span class='map-tooltip-pos'></span>").text(position.getInGameFormat(false)));

			// same fields and label keys as the click-through details panel
			let rows = [
				{ key: "ui.map.sector_detail_district_label", text: this.getDistrictText(sector) },
				{ key: "ui.map.sector_detail_distance_label", text: this.getDistanceText(sector) },
				{ key: "ui.map.sector_detail_poi_label", text: this.getPOIText(sector, isScouted) },
				{ key: "ui.map.sector_detail_scavenging_label", text: this.getResScaText(sector, isScouted, statusComponent, sectorFeatures) },
				{ key: "ui.map.sector_detail_collectors_label", text: this.getCollectorsText(sector, isScouted) },
				{ key: "ui.map.sector_detail_threats_label", text: this.getThreatsText(sector, isScouted) },
				{ key: "ui.map.sector_detail_blockers_label", text: this.getBlockersHTML(sector, isScouted) },
				{ key: "ui.map.sector_detail_environment_label", html: this.getEnvironmentHTML(sector, isScouted) },
				{ key: "ui.map.sector_detail_other_label", html: this.getMiscHTML(sector, isScouted) },
			];

			let $table = $("<table></table>");
			let numRows = 0;

			for (let i = 0; i < rows.length; i++) {
				let row = rows[i];
				let value = row.html != null ? row.html : row.text;
				// skip empty fields so the pane stays compact
				if (value == null) continue;
				let str = ("" + value).trim();
				if (str.length == 0 || str == "-") continue;

				let $tr = $("<tr></tr>");
				$tr.append($("<td class='map-tooltip-label'></td>").text(Text.t(row.key)));
				let $value = $("<td class='map-tooltip-value'></td>");
				if (row.html != null) $value.html(str); else $value.text(str);
				$tr.append($value);
				$table.append($tr);
				numRows++;
			}

			let $content = $("<div></div>");
			$content.append($header);
			if (numRows > 0) $content.append($table);

			return $content;
		},

		positionSectorTooltip: function ($tooltip) {
			let cursor = this.tooltipCursor || { x: 0, y: 0 };
			let gap = this.SECTOR_TOOLTIP_CURSOR_GAP;
			let margin = this.SECTOR_TOOLTIP_EDGE_MARGIN;

			// the visual viewport is what the player can actually see: on a phone
			// window.innerHeight includes the strip behind the browser toolbar
			let viewportW = window.visualViewport ? window.visualViewport.width : $(window).width();
			let viewportH = window.visualViewport ? window.visualViewport.height : $(window).height();

			// the pinned header, tab bar and minimap are chrome, not free space
			let topEdge = margin + GameGlobals.uiFunctions.getPinnedTopHeight();
			let bottomEdge = viewportH - margin - GameGlobals.uiFunctions.getPinnedBottomHeight();

			// a pane taller than the band between them scrolls rather than
			// hanging off the screen
			$tooltip.css("max-height", Math.max(80, Math.round(bottomEdge - topEdge)) + "px");

			let width = $tooltip.outerWidth();
			let height = $tooltip.outerHeight();

			// prefer below-right of the cursor, flip to the other side when it would not fit
			let left = cursor.x + gap;
			if (left + width > viewportW - margin) left = cursor.x - gap - width;
			if (left < margin) left = margin;
			// if it still cannot fit, pin it to the left edge rather than let it run off screen
			if (left + width > viewportW - margin) left = Math.max(margin, viewportW - margin - width);

			let top = cursor.y + gap;
			if (top + height > bottomEdge) top = cursor.y - gap - height;
			if (top < topEdge) top = topEdge;
			if (top + height > bottomEdge) top = Math.max(topEdge, bottomEdge - height);

			$tooltip.css({ left: Math.round(left) + "px", top: Math.round(top) + "px" });
		},

		zoomMap: function (steps, pageX, pageY) {
			let changed = GameGlobals.uiMapHelper.changeMapZoom(steps);
			if (!changed) return;

			let $canvas = $("#mainmap");
			let $scrollContainer = $canvas.parent();
			let containerOffset = $scrollContainer.offset();

			let oldWidth = $canvas[0].width;
			let oldHeight = $canvas[0].height;

			// point on the map that is currently under the cursor (or the center if unknown)
			let viewX = pageX != null ? pageX - containerOffset.left : $scrollContainer.width() / 2;
			let viewY = pageY != null ? pageY - containerOffset.top : $scrollContainer.height() / 2;
			let focusX = viewX + $scrollContainer.scrollLeft();
			let focusY = viewY + $scrollContainer.scrollTop();
			let ratioX = oldWidth > 0 ? focusX / oldWidth : 0.5;
			let ratioY = oldHeight > 0 ? focusY / oldHeight : 0.5;

			this.rebuildMapForZoom();

			// keep the same map point under the cursor after zooming
			let newWidth = $canvas[0].width;
			let newHeight = $canvas[0].height;
			$scrollContainer.scrollLeft(ratioX * newWidth - viewX);
			$scrollContainer.scrollTop(ratioY * newHeight - viewY);
			CanvasConstants.updateScrollIndicators("mainmap");
		},

		rebuildMapForZoom: function () {
			if (!this.playerPositionNodes || !this.playerPositionNodes.head) return;
			let sys = this;
			let mapPosition = this.getCurrentMapPosition();
			let levelEntity = GameGlobals.levelHelper.getLevelEntityForPosition(mapPosition.level);
			if (!levelEntity) return;
			this.map = GameGlobals.uiMapHelper.rebuildMap("mainmap", "mainmap-overlay", mapPosition, -1, false, this.selectedMapMode, function (level, x, y) {
				sys.onSectorSelected(level, x, y);
			});
			GameGlobals.uiMapHelper.setSelectedSector(this.map, this.selectedSector);
		},

		centerMap: function (pos, animate) {
			if (this.selectedMapStyle != this.MAP_STYLE_CANVAS) return;
			if (!this.playerPositionNodes || !this.playerPositionNodes.head) return;
			setTimeout(() => {
				let hasSelectedLevel = this.selectedLevel || this.selectedLevel == 0;
				
				let mapPosition = pos || {};
				if (!pos) {
					let playerPos = this.playerPositionNodes.head.position.getPosition();
					if (this.selectedSector) {
						mapPosition = this.selectedSector.get(PositionComponent).getPosition();
					} else if (hasSelectedLevel && this.selectedLevel != playerPos.level) {
						let campSector = GameGlobals.levelHelper.getCampSectorOnLevel(this.selectedLevel);
						if (campSector) {
							mapPosition = campSector.get(PositionComponent).getPosition();
						} else {
							mapPosition.level = this.selectedLevel;
		   					mapPosition.sectorX = 0;
		   					mapPosition.sectorY = 0;
		   				}
					} else {
						mapPosition = playerPos;
					}
				}
				
				GameGlobals.uiMapHelper.centerMapToPosition("mainmap", mapPosition, false, animate);
			}, 1);
		},
		
		selectNextSector: function () {
			let newSector = this.getNextSelectableSector(1);
			if (!newSector) return null;
			GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.buttonClicked);
			let pos = newSector.get(PositionComponent);
			this.selectSector(pos.level, pos.sectorX, pos.sectorY);
			this.centerMap(pos, true);
		},
		
		selectPreviousSector: function () {
			let newSector = this.getNextSelectableSector(-1);
			if (!newSector) return null;
			GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.buttonClicked);
			let pos = newSector.get(PositionComponent);
			this.selectSector(pos.level, pos.sectorX, pos.sectorY);
			this.centerMap(pos, true);
		},
		
		selectCampSector: function () {
			let level = this.getValidSelectedLevel();
			let campNode = GameGlobals.campHelper.getCampNodeForLevel(level);
			if (!campNode) return;
			GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.buttonClicked);
			let pos = campNode.position;
			this.selectSector(pos.level, pos.sectorX, pos.sectorY);
			this.centerMap(pos, true);
		},
		
		selectUnknownSector: function () {
			let newSector = this.getNextSelectableSector(1, (sector) => {
				let sectorStatus = GameGlobals.sectorHelper.getSectorStatus(sector);
				return sectorStatus == SectorConstants.MAP_SECTOR_STATUS_REVEALED_BY_MAP || sectorStatus == SectorConstants.MAP_SECTOR_STATUS_UNVISITED_VISIBLE || sectorStatus == SectorConstants.MAP_SECTOR_STATUS_VISITED_UNSCOUTED;
			});
			if (!newSector) return null;
			GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.buttonClicked);
			let pos = newSector.get(PositionComponent);
			this.selectSector(pos.level, pos.sectorX, pos.sectorY);
			this.centerMap(pos, true);
		},
		
		selectUnscoutedLocaleSector: function () {
			let newSector = this.getNextSelectableSector(1, (sector) => {
				let num = GameGlobals.sectorHelper.getNumVisibleUnscoutedLocales(sector);
				return num > 0;
			});
			if (!newSector) return null;
			GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.buttonClicked);
			let pos = newSector.get(PositionComponent);
			this.selectSector(pos.level, pos.sectorX, pos.sectorY);
			this.centerMap(pos, true);
		},
		
		selectIngredientSector: function () {
			let newSector = this.getNextSelectableSector(1, (sector) => {
				return GameGlobals.sectorHelper.hasSectorVisibleIngredients(sector, true);
			});
			if (!newSector) return null;
			GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.buttonClicked);
			let pos = newSector.get(PositionComponent);
			this.selectSector(pos.level, pos.sectorX, pos.sectorY);
			this.centerMap(pos, true);
		},
		
		selectInvestigateSector: function () {
			let newSector = this.getNextSelectableSector(1, (sector) => {
				let sectorFeatures = sector.get(SectorFeaturesComponent);
				return GameGlobals.sectorHelper.canBeInvestigated(sector);
			});
			if (!newSector) return null;
			GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.buttonClicked);
			let pos = newSector.get(PositionComponent);
			this.selectSector(pos.level, pos.sectorX, pos.sectorY);
			this.centerMap(pos, true);
		},
		
		getNextSelectableSector: function (offset, filter) {
			let level = this.getValidSelectedLevel();
			let sectors = GameGlobals.levelHelper.getSectorsByLevel(level);
			let currentIndex = sectors.indexOf(this.selectedSector);
			let startIndex = currentIndex >= 0 ? currentIndex : 0;
			let newIndex = startIndex;
			
			let checked = 0;
			let i = startIndex;
			while (checked < sectors.length) {
				i += offset;
				checked++;
				if (i < 0) i = sectors.length - 1;
				if (i >= sectors.length) i = 0;
				let sector = sectors[i];
				let sectorStatus = GameGlobals.sectorHelper.getSectorStatus(sector);
				if (sectorStatus == SectorConstants.MAP_SECTOR_STATUS_UNVISITED_INVISIBLE) continue;
				if (filter && !filter(sector)) continue;
				newIndex = i;
				break;
			}
			
			return newIndex == null ? null : sectors[newIndex];
		},
		
		getCurrentMapPosition: function () {
			let mapPosition = this.playerPositionNodes.head.position.getPosition();
			if (this.selectedLevel || this.selectedLevel == 0) {
				let levelEntity = GameGlobals.levelHelper.getLevelEntityForPosition(this.selectedLevel);
				if (levelEntity) {
					mapPosition.level = this.selectedLevel;
					mapPosition.sectorX = 0;
					mapPosition.sectorY = 0;
				}
			}
			return mapPosition;
		},
		
		showSectorPath: function () {
			if (!this.selectedSector) return;
			let path = this.findPathTo(this.selectedSector);
			if (!path || path.length == 0) return;
			
			let position = this.selectedSector.get(PositionComponent).getPosition();
			let startPosition = this.playerLocationNodes.head.position.getPosition();
			let includeLevel = position.level != startPosition.level;
			let title = "Directions from " + startPosition.getInGameFormat(includeLevel) + " to " + position.getInGameFormat(includeLevel);
			
			GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.buttonClicked);
			
			let stretches = [];
			let previousPos = startPosition;
			for (let i = 0; i < path.length; i++) {
				let sector = path[i];
				let pos = sector.get(PositionComponent).getPosition();
				let direction = PositionConstants.getDirectionFrom(previousPos, pos);
				
				if (stretches.length == 0) {
					stretches.push({ startPos: previousPos, endPos: pos, direction: direction, steps: 1 });
				} else {
					let previousStretch = stretches[stretches.length - 1];
					if (direction == previousStretch.direction) {
						previousStretch.endPos = pos;
						previousStretch.steps = previousStretch.steps + 1;
						
					} else {
						stretches.push({ startPos: previousPos, endPos: pos, direction: direction, steps: 1 });
					}
				}
				
				previousPos = pos;
			}
			
			let instructions = [];
			for (let i = 0; i < stretches.length; i++) {
				let stretch = stretches[i];
				let isLast = i == stretches.length - 1;
				let isLevelChange = stretch.startPos.level != stretch.endPos.level;
				
				let instructionPreface = "";
				if (stretches.length > 1) {
					if (isLast && stretches.length > 3) instructionPreface = "finally, ";
					else if (isLevelChange) instructionPreface = "then, ";
				}
				
				let isPerpendicular = i > 0 && PositionConstants.isPerpendicular(stretch.direction, stretches[i-1].direction);
				
				let goVerb = isPerpendicular ? "turn" : "move";
				let stepNoun = stretch.steps > 1 ? "steps" : "step";
				let stepsPhrase = isLevelChange ? "" : "<span class='hl-functionality'>" + stretch.steps + "</span> " + stepNoun + " ";
				let endPosition = isLevelChange ? "level " + stretch.endPos.level : stretch.endPos.getInGameFormat();
				
				let instructionBase =
					goVerb + " " +
					stepsPhrase +
					"<span class='hl-functionality'>" + PositionConstants.getDirectionName(stretch.direction) + "</span>" +
					" to " + endPosition;
				
				let instruction = instructionPreface + " " + instructionBase;
				
				instructions.push(instruction);
			}
			
			let body = instructions.join("<br/>");
			
			GameGlobals.uiFunctions.showInfoPopup(title, body, null, null, null, true, false);
		},

		updateMapCompletionHint: function () {
			let level = this.selectedLevel;
			
			let levelTypeTextVO = {};
			
			let levelComponent = GameGlobals.levelHelper.getLevelEntityForPosition(level).get(LevelComponent);
			let surfaceLevel = GameGlobals.gameState.getSurfaceLevel();
			let groundLevel = GameGlobals.gameState.getGroundLevel();
			let isTypeRevealed = GameGlobals.levelHelper.isLevelTypeRevealed(level);
			
			if (level == surfaceLevel) {
				levelTypeTextVO.textKey = "ui.map.level_type_description_surface";
			} else if (level == groundLevel) {
				levelTypeTextVO.textKey = "ui.map.level_type_description_ground";
			} else if (isTypeRevealed && !levelComponent.isCampable) {
				switch (levelComponent.notCampableReason) {
					case LevelConstants.UNCAMPABLE_LEVEL_TYPE_RADIATION:
						levelTypeTextVO.textKey = "ui.map.level_type_description_radiation";
						break;
					case LevelConstants.UNCAMPABLE_LEVEL_TYPE_POLLUTION:
						levelTypeTextVO.textKey = "ui.map.level_type_description_poison";
						break;
					default:
						levelTypeTextVO.textKey = "ui.map.level_type_description_uncampable";
						break;
				}
			} else if (isTypeRevealed && levelComponent.isCampable) {
				levelTypeTextVO.textKey = "ui.map.level_type_description_campable";
			}
			
			let mapStatusTextVO = {};

			mapStatusTextVO.textKey = "ui.map.level_status_many_unvisited_description";
			
			let mapStatus = GameGlobals.levelHelper.getLevelStats(level);
			if (mapStatus.countSeenClearedWorkshops > 0) 
				mapStatusTextVO.textKey = "ui.map.level_status_uncleared_workshop_description";
			else if (mapStatus.percentClearedSectors >= 1)
				mapStatusTextVO.textKey = "ui.map.level_status_fully_explored_description";
			else if (mapStatus.percentScoutedSectors >= 1) 
				mapStatusTextVO.textKey = "ui.map.level_status_all_sectors_scouted_description";
			else if (mapStatus.percentRevealedSectors >= 1)
				mapStatusTextVO.textKey = "ui.map.level_status_all_sectors_revealed_description";
			else if (mapStatus.percentRevealedSectors >= 0.5)
				mapStatusTextVO.textKey = "ui.map.level_status_some_unvisited_description";

			let hint = { textFragments: [ levelTypeTextVO, mapStatusTextVO ], delimiter: "ui.common.sentence_separator" };

			$("#map-completion-hint").text(Text.compose(hint));
		},
		
		getDistrictText: function (sector) {
			let sectorFeatures = sector.get(SectorFeaturesComponent);
			return sectorFeatures.isEarlyZone() ? "central" : "outer";
		},
		
		getPOIText: function (sector, isScouted) {
			if (!isScouted) return "?";
			
			var levelEntity = GameGlobals.levelHelper.getLevelEntityForPosition(sector.get(PositionComponent).level);
			var hasCampOnLevel = levelEntity.get(CampComponent) !== null;
			var sectorFeatures = sector.get(SectorFeaturesComponent);
			var sectorPassages = sector.get(PassagesComponent);
			var statusComponent = sector.get(SectorStatusComponent);
			var localesComponent = sector.get(SectorLocalesComponent);
			var improvements = sector.get(SectorImprovementsComponent);
			var unScoutedLocales = localesComponent.locales.length - statusComponent.getNumLocalesScouted();
			let numUnexaminedSpots = GameGlobals.sectorHelper.getNumUnexaminedSpots(sector);
			
			let result = [];
			if (sector.has(CampComponent)) result.push("camp");
			if (sector.has(WorkshopComponent)) {
				let workshopComponent = sector.get(WorkshopComponent);
				if (workshopComponent.isClearable) {
					let sectorControlComponent = sector.get(SectorControlComponent);
					if (sectorControlComponent.hasControlOfLocale(LocaleConstants.LOCALE_ID_WORKSHOP)) {
						result.push("workshop (cleared)");
					} else {
						result.push("workshop (not cleared)");
					}
				}
			}
			
			if (improvements.getCount(improvementNames.greenhouse)) result.push("greenhouse");
			if (!hasCampOnLevel && sectorFeatures.canHaveCamp()) result.push("good place for camp");
			if (sectorPassages.passageUp) {
				var passageUpBuilt = improvements.getCount(improvementNames.passageUpStairs) +
					improvements.getCount(improvementNames.passageUpElevator) +
					improvements.getCount(improvementNames.passageUpHole) > 0;
				result.push(TextConstants.getPassageDescription(sectorPassages.passageUp, PositionConstants.DIRECTION_UP, passageUpBuilt, true));
			}
			if (sectorPassages.passageDown) {
				var passageDownBuilt = improvements.getCount(improvementNames.passageDownStairs) +
					improvements.getCount(improvementNames.passageDownElevator) +
					improvements.getCount(improvementNames.passageDownHole) > 0;
				result.push(TextConstants.getPassageDescription(sectorPassages.passageDown, PositionConstants.DIRECTION_DOWN, passageDownBuilt, true));
			}
			if (unScoutedLocales > 0) result.push("unscouted locales");
			if (numUnexaminedSpots > 0) result.push("unexamined features");
			if (sectorFeatures.hasSpring) result.push(TextConstants.getSpringName(sectorFeatures));
			
			for (let i = 0; i < localesComponent.locales.length; i++) {
				var locale = localesComponent.locales[i];
				if (statusComponent.isLocaleScouted(i)) {
					if (locale.type == localeTypes.tradingpartner) {
						var campOrdinal = GameGlobals.gameState.getCampOrdinal(sector.get(PositionComponent).level);
						var partner = TradeConstants.getTradePartner(campOrdinal);
						if (partner) {
							result.push(partner.name + " (trade partner)");
						}
					}
				}
			}
			
			
			if (improvements.getCount(improvementNames.beacon) > 0) {
				result.push("beacon");
			}
			
			if (result.length < 1) return "-";
			else return result.join(", ");
		},
		
		getResScaText: function (sector, isScouted, statusComponent, featuresComponent) {
			let scavengedPercent = UIConstants.roundValue(statusComponent.getScavengedPercent());
			let investigatedPercent = UIConstants.roundValue(statusComponent.getInvestigatedPercent());
			
			let result = "";
			let resources = GameGlobals.sectorHelper.getLocationDiscoveredResources(sector);
			let knownResources = GameGlobals.sectorHelper.getLocationKnownResources(sector);
			let items = GameGlobals.sectorHelper.getLocationDiscoveredItems(sector);
			let knownItems = GameGlobals.sectorHelper.getLocationKnownItems(sector);
			
			let showIngredients = GameGlobals.sectorHelper.hasSectorVisibleIngredients(sector);

			if (resources.length < 1 && !showIngredients) {
				result = "-";
			} else {
				if (knownResources.length > 0) result += TextConstants.getScaResourcesString(resources, knownResources, featuresComponent.resourcesScavengable);
				if (knownResources.length > 0 && showIngredients) result += ", ";
				if (showIngredients) result += TextConstants.getScaItemString(items, knownItems, featuresComponent.itemsScavengeable);
			}
			
			result += " (" + scavengedPercent + "% scavenged) ";

			if (featuresComponent.heapResource) {
				let heapName = TextConstants.getHeapDisplayName(featuresComponent.heapResource, featuresComponent);
				let heapScavengedPercentage = Math.round(statusComponent.getHeapScavengedPercent());
				let resourceName = TextConstants.getResourceDisplayName(featuresComponent.heapResource);
				result += ", " + heapName + " (" + resourceName + ", " + heapScavengedPercentage + "% scavenged)";
			}
			
			if (investigatedPercent > 0) {
				result += " (" + investigatedPercent + "% investigated) ";
			}
			
			return result;
		},
		
		getCollectorsText: function (sector, isScouted) {
			let improvements = sector.get(SectorImprovementsComponent);
			let featuresComponent = sector.get(SectorFeaturesComponent);
			let statusComponent = sector.get(SectorStatusComponent);
			
			let hazards = GameGlobals.sectorHelper.getEffectiveHazards(featuresComponent, statusComponent);
			
			let collectorFood = improvements.getVO(improvementNames.collector_food);
			let collectorWater = improvements.getVO(improvementNames.collector_water);
			
			var result1 = [];
			var result2 = [];
			if (isScouted) {
				if (collectorFood.count === 1) result1.push("1 trap");
				if (collectorFood.count > 1) result1.push("traps");
				if (collectorFood.count == 0 && featuresComponent.resourcesCollectable.food > 0 && hazards.territory == 0) result2.push ("food")
				if (collectorWater.count === 1) result1.push("1 bucket");
				if (collectorWater.count > 1) result1.push("buckets");
				if (collectorWater.count == 0 && featuresComponent.resourcesCollectable.water > 0 && hazards.territory == 0) result2.push ("water")
			}
			
			let part1 = "-";
			if (result1.length > 0) part1 = result1.join(", ");
			
			let part2 = "";
			if (result2.length > 0) part2 = " (can collect " + result2.join(", ") + ")";
			return part1 + part2;
		},
		
		getThreatsText: function (sector, isScouted) {
			if (!isScouted) return "?";
			var sectorControlComponent = sector.get(SectorControlComponent);
			var enemiesComponent = sector.get(EnemiesComponent);
			if (enemiesComponent.hasEnemies) {
				return TextConstants.getEnemyNoun(enemiesComponent.possibleEnemies, true, true);
			} else {
				return "-"
			}
		},
		
		getBlockersHTML: function (sector, isScouted) {
			if (!isScouted) return "?";
			let result = [];
			
			let position = sector.get(PositionComponent);
			let passagesComponent = sector.get(PassagesComponent);
			for (let i in PositionConstants.getLevelDirections()) {
				let direction = PositionConstants.getLevelDirections()[i];
				let directionName = PositionConstants.getDirectionName(direction);
				let blocker = passagesComponent.getBlocker(direction);
				if (blocker) {
					let gangComponent = GameGlobals.levelHelper.getGangComponent(position, direction);
					let enemiesComponent = this.playerLocationNodes.head.entity.get(EnemiesComponent);
					let blockerName = TextConstants.getMovementBlockerName(blocker, gangComponent).toLowerCase();
					if (GameGlobals.movementHelper.isBlocked(sector, direction)) {
						let blockerType = blocker.type;
						let isGang = blockerType === MovementConstants.BLOCKER_TYPE_GANG;
						result.push(blockerName + " (" + directionName + ")");
					}
				}
			}
			
			if (result.length < 1) return "-";
			else return result.join(", ");
		},
		
		getEnvironmentHTML: function (sector, isScouted) {
			let isVisited = GameGlobals.sectorHelper.isVisited(sector);
			if (!isVisited) return "?";
			let result = [];
			let featuresComponent = sector.get(SectorFeaturesComponent);
			let statusComponent = sector.get(SectorStatusComponent);
			let itemsComponent = this.playerPositionNodes.head.entity.get(ItemsComponent);
			let hazards = GameGlobals.sectorHelper.getEffectiveHazards(featuresComponent, statusComponent);
			
			let getHazardSpan = function (label, value, isWarning) {
				if (!value) return label;
				if (!isWarning) return label + " (" + value + ")";
				return label + " (<span class='warning'>" + value + "</span>)";
			};
			
			if (featuresComponent.sunlit) result.push("sunlit");
			if (hazards.debris > 0) result.push("debris");
			if (hazards.territory > 0) result.push("gang territory");
			
			if (hazards.radiation > 0)
				result.push(getHazardSpan("radioactivity", hazards.radiation, hazards.radiation > itemsComponent.getCurrentBonus(ItemConstants.itemBonusTypes.res_radiation)));
			if (hazards.poison > 0)
				result.push(getHazardSpan("pollution", hazards.poison, hazards.poison > itemsComponent.getCurrentBonus(ItemConstants.itemBonusTypes.res_poison)));
			if (hazards.cold > 0)
				result.push(getHazardSpan("cold", hazards.cold, hazards.cold > itemsComponent.getCurrentBonus(ItemConstants.itemBonusTypes.res_cold)));
			if (hazards.flooded > 0)
				result.push(getHazardSpan("flooded", hazards.flooded, hazards.flooded > itemsComponent.getCurrentBonus(ItemConstants.itemBonusTypes.res_water)));
			
			if (result.length < 1) return "-";
			else return result.join(", ");
		},
		
		getMiscHTML: function (sector, isScouted) {
			let isVisited = GameGlobals.sectorHelper.isVisited(sector);
			if (!isVisited) return "?";
			let result = [];
			
			if (isScouted) {
				let statusComponent = sector.get(SectorStatusComponent);
				let featuresComponent = sector.get(SectorFeaturesComponent);

				if (GameGlobals.sectorHelper.canBeInvestigated(sector)) {
					result.push("can be investigated");
				}
				
				if (statusComponent.graffiti) {
					result.push("Graffiti: '" + statusComponent.graffiti + "'");
				}
			}
			
			if (result.length < 1) return "-";
			else return result.join(", ");
		},
		
		getDistanceText: function (sector) {
			var path = this.findPathTo(sector);
			var len = path ? path.length : "?";
			return len + " blocks";
		},

		getValidSelectedLevel: function () {
			if (this.selectedLevel) return this.selectedLevel;
			if (this.selectedLevel === 0) return this.selectedLevel;
			return 13;
		},
		
		findPathTo: function (sector) {
			if (!sector) return null;
			return GameGlobals.levelHelper.findPathTo(this.playerLocationNodes.head.entity, sector, { skipBlockers: true, skipUnrevealed: true });
		},
		
		downloadASCIIMap: function () {
			let mapPosition = this.getCurrentMapPosition();
			let ascii = GameGlobals.uiMapHelper.getASCII(this.selectedMapMode, mapPosition, false);
         	FileUtils.saveTextToFile("level-" + mapPosition.level, ascii);
		},
		
		teleport: function () {
			if (!GameConstants.isCheatsEnabled) return;
			if (!this.selectedSector) return;
			var targetPosition = this.selectedSector.get(PositionComponent).getPosition();
			var cheatSystem = this.engine.getSystem(CheatSystem);
			cheatSystem.applyCheat(() => {
				cheatSystem.setPlayerPosition(targetPosition.level, targetPosition.sectorX, targetPosition.sectorY, false);
			});
			GameGlobals.uiFunctions.showTab(GameGlobals.uiFunctions.elementIDs.tabs.out);
		},

		onSectorSelected: function (level, x, y) {
			// the details panel below the map takes over on click
			this.hideSectorTooltip();
			this.selectSector(level, x, y);
		},

		onGameStarted: function () {
			this.initLevelSelector();
			this.initMapModeSelector();
			this.initMapStyleSelector();
			this.updateLevelSelector();
		},
		
		onResize: function () {
			// the pane is positioned against the old viewport, so drop it rather than let it clip
			this.hideSectorTooltip();
			this.updateHeight();

			// A rotation changes the shape of the map's box, not just its size,
			// and leaves the view pointing at whatever the old geometry put
			// there. Only a rotation: an iOS URL bar sliding away is a resize too,
			// and moving the map out from under a player who just panned it would
			// be worse than the offset.
			let isLandscape = $(window).width() > $(window).height();
			let didRotate = this.wasLandscape !== null && this.wasLandscape !== isLandscape;
			this.wasLandscape = isLandscape;
			if (!didRotate) return;

			// next turn, because the layout that decides the new box is another
			// listener on this same signal and may not have run yet
			let sys = this;
			setTimeout(function () {
				if (GameGlobals.gameState.uiStatus.currentTab !== GameGlobals.uiFunctions.elementIDs.tabs.map) return;
				sys.centerMap();
			}, 0);
		},

		onTabChanged: function (tabID, tabProps) {
			this.hideSectorTooltip();
			if (tabID !== GameGlobals.uiFunctions.elementIDs.tabs.map) return;

			// framing depends only on what sits above the pane, so do it before the
			// map itself is built: the details still come into view if drawing fails
			this.scrollTabContentToTop();

			this.updateBubble();
			this.updateHeader();
			
			$("#select-header-mapmode").toggle(this.isMapModesVisible());
			
			this.selectMapStyle(GameGlobals.gameState.settings.mapStyle || this.MAP_STYLE_CANVAS);
			this.selectMapMode(GameGlobals.gameState.settings.mapMode || MapUtils.MAP_MODE_DEFAULT);
			
			var level = tabProps ? tabProps.level : this.playerPositionNodes.head.position.level;
			this.updateLevelSelector();
			this.selectLevel(level);
			if (tabProps) {
				this.selectSector(tabProps.level, tabProps.sectorX, tabProps.sectorY);
			}
			this.updateMap();
			this.centerMap();

			// start where the player is, as though they had clicked their own sector.
			// selectLevel above has already cleared selectedSector, and the tabProps branch
			// sets it when the caller asked for a specific sector - so this only fills in
			// the plain case of opening the map with nothing chosen
			if (!this.selectedSector) this.selectPlayerSectorIfOnLevel();
			this.updateMapCompletionHint();
		},

		// the room details sit under the map and land below the fold in a desktop
		// window. Parking the tab content against the top of the frame scrolls the
		// banner and the location header away and brings the details into view
		scrollTabContentToTop: function () {
			// on a phone the document is locked and the tab content is its own
			// scroller (see APP SHELL in mobile.less), so the window has nothing to
			// scroll. The map tab sets the pane to overflow: hidden rather than auto,
			// so read the layout itself instead of inferring it from the overflow
			if ($("body").hasClass("layout-small")) return;

			let $pane = $("#grid-switch-content");
			if ($pane.length == 0) return;

			$("html,body").animate({ scrollTop: $pane.offset().top }, 250);
		},

		updateHeader: function () {
			let header = Text.t("ui.map.page_header");
			if (this.isMapModesVisible()) header += " (" + this.selectedMapMode + ")";
			$("#tab-header h2").text(header);
		},
		
		isMapModesVisible: function () {
			return GameGlobals.playerHelper.hasItem("equipment_map_2");
		},

		onLevelSelectorChanged: function () {
			// the map redraws under the cursor; don't leave a stale tooltip hanging
			this.hideSectorTooltip();
			let level = parseInt($("#select-header-level").val());
			if (this.selectedLevel === level) return;
			this.selectLevel(level);
			this.updateMapCompletionHint();
		},
		
		onMapModeSelectorChanged: function () {
			// the map redraws under the cursor; don't leave a stale tooltip hanging
			this.hideSectorTooltip();
			let mapMode = $("#select-header-mapmode").val();
			if (this.selectedMapMode === mapMode) return;
			this.selectMapMode(mapMode);
		},
		
		onMapStyleSelectorChanged: function () {
			let mapStyle = $("#select-header-mapstyle").val();
			if (this.selectedMapStyle === mapStyle) return;
			this.selectMapStyle(mapStyle);
		},

	});

	return UIOutMapSystem;
});
