define([
	'ash',
	'text/Text',
	'utils/MapUtils',
	'utils/UIList',
	'utils/UIState',
	'core/ExceptionHandler',
	'game/GameGlobals',
	'game/GlobalSignals',
	'game/constants/DialogueConstants',
	'game/constants/ExplorationConstants',
	'game/constants/ImprovementConstants',
	'game/constants/PlayerStatConstants',
	'game/constants/TextConstants',
	'game/constants/LogConstants',
	'game/constants/UIConstants',
	'game/constants/PositionConstants',
	'game/constants/LocaleConstants',
	'game/constants/LevelConstants',
	'game/constants/MovementConstants',
	'game/constants/StoryConstants',
	'game/constants/TradeConstants',
	'game/constants/TribeConstants',
	'game/nodes/PlayerPositionNode',
	'game/nodes/PlayerLocationNode',
	'game/nodes/NearestCampNode',
	'game/components/player/VisionComponent',
	'game/components/player/StaminaComponent',
	'game/components/sector/PassagesComponent',
	'game/components/sector/SectorControlComponent',
	'game/components/sector/SectorFeaturesComponent',
	'game/components/sector/SectorLocalesComponent',
	'game/components/sector/MovementOptionsComponent',
	'game/components/common/PositionComponent',
	'game/components/common/CampComponent',
	'game/components/sector/improvements/SectorImprovementsComponent',
	'game/components/sector/improvements/WorkshopComponent',
	'game/components/sector/SectorStatusComponent',
	'game/components/sector/EnemiesComponent'
], function (
	Ash,
	Text, MapUtils, UIList, UIState, ExceptionHandler, GameGlobals, GlobalSignals, DialogueConstants, ExplorationConstants, ImprovementConstants, PlayerStatConstants, TextConstants,
	LogConstants, UIConstants, PositionConstants, LocaleConstants, LevelConstants, MovementConstants, StoryConstants, TradeConstants,
	TribeConstants, PlayerPositionNode, PlayerLocationNode, NearestCampNode, VisionComponent, StaminaComponent,
	PassagesComponent, SectorControlComponent, SectorFeaturesComponent, SectorLocalesComponent,
	MovementOptionsComponent, PositionComponent, CampComponent, SectorImprovementsComponent,
	WorkshopComponent, SectorStatusComponent, EnemiesComponent
) {
	// The bucket and the trap. Each has a row in the improvements table and a
	// chip in the sector bar, and the two are driven from the same numbers.
	var COLLECTOR_DEFS = [
		{
			improvementName: improvementNames.collector_water,
			resource: resourceNames.water,
			buildAction: "build_out_collector_water",
			rowID: "#out-improvements-collector-water",
			buildID: "#out-action-build-bucket",
			improveID: "#out-action-improve-bucket",
			chipID: "#out-collector-chip-water",
			fillID: "#out-collector-fill-water",
			useAllID: "#out-action-use-bucket",
			useOneID: "#out-action-use-bucket_one",
		},
		{
			improvementName: improvementNames.collector_food,
			resource: resourceNames.food,
			buildAction: "build_out_collector_food",
			rowID: "#out-improvements-collector-food",
			buildID: "#out-action-build-trap",
			improveID: "#out-action-improve-trap",
			chipID: "#out-collector-chip-food",
			fillID: "#out-collector-fill-food",
			useAllID: "#out-action-use-trap",
			useOneID: "#out-action-use-trap_one",
		},
	];

	var UIOutLevelSystem = Ash.System.extend({

		engine: null,

		playerPosNodes: null,
		playerLocationNodes: null,
		nearestCampNodes: null,

		pendingUpdateMap: true,

		// which rooms this browser has already described - see updateRoomIntro. Beside
		// the save, never in it.
		STORAGE_KEY_ROOM_INTROS: "room-intros-seen",
		shownRoomIntros: null,

		constructor: function () {
			GameGlobals.uiFunctions.toggle("#switch-out .bubble", false);

			this.elements = {};
			this.elements.sectorHeader = $("#header-sector");
			this.elements.roomName = $("#btn-room-name");
			this.elements.description = $("#out-desc");
			this.elements.descriptionStats = $("#out-desc-stats");
			this.elements.scavengedValue = $("#out-scavenged-value");
			this.elements.resourcesValue = $("#out-resources-value");
			this.elements.itemsValue = $("#out-items-value");
			this.elements.findsRow = $("#out-finds-row");
			this.elements.btnScavengeHeap = $("#out-action-scavenge-heap");
			this.elements.btnClearWorkshop = $("#out-action-clear-workshop");
			this.elements.btnNap = $("#out-action-nap");
			this.elements.btnWait = $("#out-action-wait");
			this.elements.outImprovementsTR = $("#out-improvements tr");
			
			this.initElements();

			return this;
		},

		addToEngine: function (engine) {
			this.playerPosNodes = engine.getNodeList(PlayerPositionNode);
			this.playerLocationNodes = engine.getNodeList(PlayerLocationNode);
			this.nearestCampNodes = engine.getNodeList(NearestCampNode);

			this.initListeners();

			this.engine = engine;
		},

		removeFromEngine: function (engine) {
			this.playerPosNodes = null;
			this.playerLocationNodes = null;
			this.engine = null;
		},
		
		initElements: function () {
			this.localeList = UIList.create(this, $("#table-out-actions-locales"), this.createLocaleListItem, this.updateLocaleListItem, this.isLocaleListItemDataSame);

			let makeMovementActionsTD = function (direction) {
				let normalID = "out-action-move-" + direction;
				let gritID = "out-action-move-" + direction + "-grit";
				let normalAction = "move_sector_" + direction;
				let gritAction = "move_sector_grit_" + direction;
				let textKey = "ui.map.direction_" + direction + "_name_short";

				let result = "";
				result += "<td>";
				result += "<button class='action btn-icon action-move text-key movement-action-normal' id='" + normalID + "' action='" + normalAction + "' data-text-key='" + textKey + "'></button>";
				result += "<button class='action btn-icon action-move text-key movement-action-grit btn-warning' id='" + gritID + "' action='" + gritAction + "' data-text-key='" + textKey + "'></button>";
				result += "</td>";
				return result;
			};

			let $movementActionsTable = $("#table-out-actions-movement");
			$movementActionsTable.append("<tr>");
			$movementActionsTable.append(makeMovementActionsTD("nw"));
			$movementActionsTable.append(makeMovementActionsTD("north"));
			$movementActionsTable.append(makeMovementActionsTD("ne"));
			$movementActionsTable.append("</tr>");
			$movementActionsTable.append("<tr>");
			$movementActionsTable.append(makeMovementActionsTD("west"));
			$movementActionsTable.append("<td></td>");
			$movementActionsTable.append(makeMovementActionsTD("east"));
			$movementActionsTable.append("</tr>");
			$movementActionsTable.append("<tr>");
			$movementActionsTable.append(makeMovementActionsTD("sw"));
			$movementActionsTable.append(makeMovementActionsTD("south"));
			$movementActionsTable.append(makeMovementActionsTD("se"));
			$movementActionsTable.append("</tr>");
		},

		initListeners: function () {
			var sys = this;
			GlobalSignals.playerPositionChangedSignal.add(function () {
				if (GameGlobals.gameState.uiStatus.isHidden) return;
				sys.updateAll();
			});
			GlobalSignals.improvementBuiltSignal.add(function () {
				sys.updateAll();
			});
			GlobalSignals.inventoryChangedSignal.add(function () {
				sys.updateSectorDescription();
				sys.updateOutImprovementsList();
				sys.updateMovementActions();
				sys.updateDespair();
			});
			GlobalSignals.featureUnlockedSignal.add(function () {
				sys.updateUnlockedFeatures();
			});
			GlobalSignals.fightEndedSignal.add(function () {
				sys.updateSectorDescription();
				sys.updateMovementRelatedActions();
			});
			GlobalSignals.sectorScoutedSignal.add(function () {
				sys.updateAll();
			});
			GlobalSignals.actionCompletedSignal.add(function () {
				sys.updateSectorDescription();
				sys.updateMovementActions();
			});
			GlobalSignals.visionChangedSignal.add(function () {
				sys.updateAll();
			});
			GlobalSignals.gameShownSignal.add(function () {
				sys.updateAll();
			});
			GlobalSignals.add(this, GlobalSignals.playerLeftCampSignal, this.updateAll);
			GlobalSignals.add(this, GlobalSignals.collectorCollectedSignal, this.updateOutImprovementsStatus);
			GlobalSignals.add(this, GlobalSignals.tabChangedSignal, this.onTabChanged);
			GlobalSignals.add(this, GlobalSignals.movementBlockerClearedSignal, this.updateAll);
			GlobalSignals.add(this, GlobalSignals.slowUpdateSignal, this.slowUpdate);
			GlobalSignals.add(this, GlobalSignals.popupClosedSignal, this.onPopupClosed);
			GlobalSignals.add(this, GlobalSignals.gameResetSignal, this.onGameReset);
			GlobalSignals.add(this, GlobalSignals.buttonStateChangedSignal, this.onButtonStateChanged);
			GlobalSignals.add(this, GlobalSignals.localeScoutedSignal, this.scheduleMapUpdate);
			GlobalSignals.add(this, GlobalSignals.inventoryChangedSignal, this.scheduleMapUpdate);
			GlobalSignals.add(this, GlobalSignals.equipmentChangedSignal, this.scheduleMapUpdate);
			GlobalSignals.add(this, GlobalSignals.sectorRevealedSignal, this.scheduleMapUpdate);
			GlobalSignals.add(this, GlobalSignals.themeToggledSignal, this.scheduleMapUpdate);
			this.rebuildVis();
			this.updateUnlockedFeatures();
		},

		update: function (time) {
			if (GameGlobals.gameState.isPaused) return;
			if (GameGlobals.gameState.uiStatus.currentTab !== GameGlobals.uiFunctions.elementIDs.tabs.out) return;

			var posComponent = this.playerPosNodes.head.position;

			if (!this.playerLocationNodes.head) return;

			if (!posComponent.inCamp) {
				if (this.pendingUpdateMap)
					this.rebuildVis();
			}
		},
		
		slowUpdate: function () {
			if (!this.playerLocationNodes.head) return;
			this.updateOutImprovementsStatus();
			this.updateLevelPageActionsSlow();
		},

		updateAll: function () {
			if (GameGlobals.gameState.uiStatus.isHidden) return;
			if (!this.playerLocationNodes.head) return;

			this.rebuildVis();
			this.updateLocales();
			this.updateMovementRelatedActions();
			this.updateLocationDetails();
			this.updateSectorDescription();
			this.updateLevelPageActions();
			this.updateLevelPageActionsSlow();
			this.updateUnlockedFeatures();
			this.updateOutImprovementsList();
			this.updateOutImprovementsStatus();
			this.updateMovementActions();
			this.updateCharacters();
			this.updateDespair();
		},
		
		scheduleMapUpdate: function () {
			this.pendingUpdateMap = true;
		},

		updateUnlockedFeatures: function () {
			GameGlobals.uiFunctions.toggle("#out-container-compass", GameGlobals.gameState.unlockedFeatures.scout);
			GameGlobals.uiFunctions.toggle("#out-container-compass-actions", GameGlobals.gameState.unlockedFeatures.scout);
			GameGlobals.uiFunctions.toggle("#minimap-background-container", GameGlobals.gameState.unlockedFeatures.scout);
			GameGlobals.uiFunctions.toggle("#minimap", GameGlobals.gameState.unlockedFeatures.scout);
		},

		updateLevelPageActionsSlow: function () {
			if (GameGlobals.gameState.uiStatus.isHidden) return;
			var sectorStatus = this.playerLocationNodes.head.entity.get(SectorStatusComponent);

			var hasCampHere = this.playerLocationNodes.head.entity.has(CampComponent);
			var isScouted = sectorStatus.scouted;

			this.updateNap(isScouted, hasCampHere);
			this.updateWait(hasCampHere);
			this.updateDespair();

			this.updateOutActionsHeader();
		},

		// #out-actions lost its unconditional buttons to the sector bar, so the
		// heading has to follow the box's contents.
		//
		// Read data-visible, not :visible. The direct children of #out-actions are
		// .callout-container wrappers two levels above each button. Every wrapper's
		// display is written a tick later by UIOutElementsSystem, off
		// elementToggledSignal. A :visible read here would see the previous state
		// of the toggles that ran a few lines above. data-visible is synchronous.
		updateOutActionsHeader: function () {
			let $movement = $("#container-out-actions-movement-related");
			let numVisible = $("#out-actions")
				.find("button.action")
				.not("#container-out-actions-movement-related button")
				.not("[data-visible='false']")
				.length;

			// The movement span is slide-toggled, so it carries no data-visible of
			// its own until the animation ends. Reading its `display` here works
			// only because the slide out runs at duration 0 and jQuery finishes a
			// 0-duration animation synchronously. Give that duration a value and
			// the read goes stale, and the empty box it guards stays on screen.
			// So read the condition that drives the slide instead.
			let isScouted = this.playerLocationNodes.head.entity.get(SectorStatusComponent).scouted;
			if (numVisible === 0 && $movement.children().length > 0 && isScouted) {
				numVisible++;
			}

			// Docked into the sector bar the box is one of the bar's own rows, and
			// the heading that labelled it in the pane has nothing left to label.
			// The bar shows and hides its rows with classes rather than a display
			// of their own - see SECTOR ACTION BAR in mobile.less - so the same
			// count drives has-finds there.
			let isDocked = $("#out-actions").parent().is("#out-sector-bar");

			// the box keeps .actionbox's margin and padding when empty, so it goes
			// with the heading rather than leaving a gap under it
			GameGlobals.uiFunctions.toggle("#header-out-actions", !isDocked && numVisible > 0);
			GameGlobals.uiFunctions.toggle("#out-actions", numVisible > 0);
			$("#out-sector-bar").toggleClass("has-finds", isDocked && numVisible > 0);
		},

		// setTab force-shows #out-action-sca (a .tabbutton for this tab) without
		// telling anyone, so the bar's own state has to be recomputed after it
		onTabChanged: function (tabID) {
			if (tabID !== GameGlobals.uiFunctions.elementIDs.tabs.out) return;
			if (!this.playerLocationNodes.head) return;
			this.updateLevelPageActions();
		},

		updateLevelPageActions: function (isScouted, hasCamp, hasCampHere) {
			if (GameGlobals.gameState.uiStatus.isHidden) return;
			
			var sectorStatus = this.playerLocationNodes.head.entity.get(SectorStatusComponent);
			var hasCamp = GameGlobals.levelHelper.getLevelEntityForSector(this.playerLocationNodes.head.entity).has(CampComponent);
			var hasCampHere = this.playerLocationNodes.head.entity.has(CampComponent);
			var isScouted = sectorStatus.scouted;
			let isAwake = this.playerPosNodes.head.entity.get(VisionComponent).isAwake;
			
			var sectorControlComponent = this.playerLocationNodes.head.entity.get(SectorControlComponent);
			var featuresComponent = this.playerLocationNodes.head.entity.get(SectorFeaturesComponent);
			var workshopComponent = this.playerLocationNodes.head.entity.get(WorkshopComponent);
			var improvements = this.playerLocationNodes.head.entity.get(SectorImprovementsComponent);
			var passagesComponent = this.playerLocationNodes.head.entity.get(PassagesComponent);

			var passageUpBuilt = improvements.getCount(improvementNames.passageUpStairs) +
				improvements.getCount(improvementNames.passageUpElevator) +
				improvements.getCount(improvementNames.passageUpHole) > 0;
			var passageDownBuilt = improvements.getCount(improvementNames.passageDownStairs) +
				improvements.getCount(improvementNames.passageDownElevator) +
				improvements.getCount(improvementNames.passageDownHole) > 0;

			GameGlobals.uiFunctions.toggle("#out-action-move-up", (isScouted && passagesComponent.passageUp != null) || passageUpBuilt);
			GameGlobals.uiFunctions.toggle("#out-action-move-down", (isScouted && passagesComponent.passageDown != null) || passageDownBuilt);
			GameGlobals.uiFunctions.toggle("#out-action-move-camp", hasCamp && !hasCampHere);
			GameGlobals.uiFunctions.toggle("#out-action-move-camp-details", hasCamp && !hasCampHere);

			GameGlobals.uiFunctions.toggle("#out-action-get-up", !isAwake);
			GameGlobals.uiFunctions.toggle("#out-action-enter", isAwake && hasCampHere);
			// isVisible("scout") is false once the sector is scouted (the action
			// requires sector.scouted: false, and DISABLED_REASON_SCOUTED blocks
			// visibility) but stays true when only light is missing, so an
			// unscouted dark sector still explains itself. The unlockedFeatures
			// gate stays: it is not the same test as the action's own vision
			// requirement, and keeping it makes this a pure subtraction.
			let showScavenge = isAwake;
			let showScout = isAwake && GameGlobals.gameState.unlockedFeatures.vision && GameGlobals.playerActionsHelper.isVisible("scout");
			let showSpring = isAwake && isScouted && featuresComponent.hasSpring;
			// The camp build was a row of the improvements table, and that table
			// lives inside #out-improvements, which is itself gated on vision -
			// so the vision test here is not new, it is the gate the row already
			// sat behind. The rest is the row's own rule: the table showed a row
			// when the action was visible or one was already built, and a second
			// camp cannot be built where one stands, so only the first half
			// applies.
			let showCamp = isAwake
				&& GameGlobals.gameState.unlockedFeatures.vision
				&& GameGlobals.playerActionsHelper.isVisible("build_out_camp");
			let showBeacon = isAwake
				&& GameGlobals.gameState.unlockedFeatures.vision
				&& GameGlobals.playerActionsHelper.isVisible("build_out_beacon");

			GameGlobals.uiFunctions.toggle("#out-action-sca", showScavenge);
			GameGlobals.uiFunctions.toggle("#out-action-scout", showScout);
			GameGlobals.uiFunctions.toggle("#out-action-use-spring", showSpring);
			GameGlobals.uiFunctions.toggle("#out-action-build-camp", showCamp);
			GameGlobals.uiFunctions.toggle("#out-action-build-beacon", showBeacon);
			$("#out-sector-bar").toggleClass("has-actions", showScavenge || showScout || showSpring || showCamp || showBeacon);
			GameGlobals.uiFunctions.toggle("#out-action-investigate", isAwake && this.showInvestigate());

			// examine spots
			let showExamine = featuresComponent.examineSpots.length > 0 && isScouted;
			GameGlobals.uiFunctions.toggle("#out-action-examine", showExamine);
			if (showExamine) {
				let spotID = featuresComponent.examineSpots[0];
				let spotDef = StoryConstants.getSectorExampineSpot(spotID);
				$("#out-action-examine").find(".btn-label").text("examine " + Text.t(spotDef.shortNameKey));
			}

			// workshop
			let showWorkshop = isScouted && workshopComponent != null && workshopComponent.isClearable && !sectorControlComponent.hasControlOfLocale(LocaleConstants.LOCALE_ID_WORKSHOP)
			GameGlobals.uiFunctions.toggle(this.elements.btnClearWorkshop, showWorkshop);
			if (showWorkshop) {
				let workshopName = TextConstants.getWorkshopName(workshopComponent.resource);
				this.elements.btnClearWorkshop.find(".btn-label").text("scout " + workshopName);
			}

			// resource heap
			let showHeap = isScouted && featuresComponent.heapResource != null;
			GameGlobals.uiFunctions.toggle(this.elements.btnScavengeHeap, showHeap);
			if (showHeap) {
				let heapName = TextConstants.getHeapDisplayName(featuresComponent.heapResource, featuresComponent);
				this.elements.btnScavengeHeap.find(".btn-label").text("scavenge " + heapName);
			}

			// Locales are where this sector leads on to, and they sat at the very
			// end of the tab. Docked into the bar they are one of its rows, shown
			// by class like the others - and not slid, because the bar is chrome
			// and animating its height would shove the reading pane about.
			let showLocales = this.getVisibleLocales(isScouted).length > 0;
			let localesDocked = $("#out-locales").parent().is("#out-sector-bar");
			if (localesDocked) {
				GameGlobals.uiFunctions.toggle("#out-locales", showLocales);
			} else {
				GameGlobals.uiFunctions.slideToggleIf("#out-locales", null, showLocales, 200, 0);
			}
			$("#out-sector-bar").toggleClass("has-locales", localesDocked && showLocales);

			GameGlobals.uiFunctions.slideToggleIf("#container-out-actions-movement-related", null, isScouted, 200, 0);

			GameGlobals.uiFunctions.toggle("#table-out-actions-movement", GameGlobals.gameState.isFeatureUnlocked("move"));
			GameGlobals.uiFunctions.toggle("#container-tab-two-out-actions h3", GameGlobals.gameState.isFeatureUnlocked("move"));
			GameGlobals.uiFunctions.toggle("#out-improvements", GameGlobals.gameState.unlockedFeatures.vision);
			GameGlobals.uiFunctions.toggle("#out-improvements table", GameGlobals.gameState.unlockedFeatures.vision);

			this.updateOutActionsHeader();
		},

		getVisibleLocales: function (isScouted) {
			if (!isScouted) return [];
			let sectorLocalesComponent = this.playerLocationNodes.head.entity.get(SectorLocalesComponent);
			let result = [];
			for (let i = 0; i < sectorLocalesComponent.locales.length; i++) {
				let localeVO = sectorLocalesComponent.locales[i];
				if (!this.isLocaleVisible(localeVO)) continue;;
				localeVO.index = i;
				result.push(localeVO);
			}
			return result;
		},

		isLocaleVisible: function (locale) {
			if (!locale) return false;
			return GameGlobals.sectorHelper.isLocaleVisible(this.playerLocationNodes.head.entity, locale);
		},

		updateNap: function (isScouted, hasCampHere) {
			if (hasCampHere) {
				GameGlobals.uiFunctions.toggle(this.elements.btnNap, false);
				return;
			}
			
			var staminaComponent = this.playerPosNodes.head.entity.get(StaminaComponent);
			var hasFirstCamp = GameGlobals.gameState.numCamps > 0;

			var costToCamp = GameGlobals.playerActionsHelper.getCosts("move_camp_level");
			var staminaToCamp = costToCamp.stamina || 10;
			var staminaCostToMove = staminaToCamp;
			var missingStamina = staminaCostToMove - staminaComponent.stamina;
			var lowStamina = missingStamina > 0 || staminaComponent.stamina <= PlayerStatConstants.STAMINA_GAINED_FROM_NAP;

			let blockedByTutorial = !hasFirstCamp && staminaComponent.stamina > 15;
			GameGlobals.uiFunctions.toggle(this.elements.btnNap, lowStamina && !blockedByTutorial);
		},
		
		updateWait: function (hasCampHere) {
			let hasFirstCamp = GameGlobals.gameState.numCamps > 0;
			let showWait = false;
			
			if (!hasCampHere && hasFirstCamp) {
				let maxResourcesToShowWait = 3;
				let resources = [ "food", "water" ];
				for (let i = 0; i < resources.length; i++) {
					let name = resources[i];
					if (!GameGlobals.gameState.unlockedFeatures["resource_" + name]) continue;
					if (!GameGlobals.playerHelper.hasCollectibleResource(name, false)) continue;
					let total = Math.floor(GameGlobals.playerHelper.getResouceInInventory(name)) + Math.floor(this.getResourceCurrentlyAvailableToCollect(name));
					if (total < maxResourcesToShowWait) showWait = true;
				}
			}
			
			GameGlobals.uiFunctions.toggle(this.elements.btnWait, showWait);
		},

		updateDespair: function () {
			if (GameGlobals.gameState.uiStatus.isHidden) return;

			let activeDespairType = GameGlobals.playerHelper.getActiveDespairType();
			let delay = 1250;
			
			let canMove = GameGlobals.playerHelper.canMove();
			let showCantMove = !canMove && activeDespairType;

			UIState.refreshStateDelayedFeedback(this, "cant-move", showCantMove, showCantMove ? delay : 0, () => {
				if (showCantMove) {
					let msg = LogConstants.getCantMoveMessage(activeDespairType);
					GameGlobals.playerHelper.addLogMessage(LogConstants.MSD_ID_MOVE_UNAVAILABLE, msg);
				}
			});
			
			let showDespairButton = activeDespairType != null;

			UIState.refreshStateDelayedFeedback(this, "despair-button", showDespairButton, showDespairButton ? delay : 0, () => {
				GameGlobals.uiFunctions.toggle("#out-action-despair", showDespairButton);
				if (showDespairButton) {
					log.i("show despair button:" + activeDespairType);
					let logDespair = activeDespairType == MovementConstants.DESPAIR_TYPE_STAMINA || activeDespairType == MovementConstants.DESPAIR_TYPE_MOVEMENT;
					if (logDespair) {
						let msg = LogConstants.getDespairMessage(activeDespairType);
						GameGlobals.playerHelper.addLogMessage(LogConstants.MSG_ID_DESPAIR_AVAILABLE, msg);
					}
				}
			});
		},

		showTollGatePopup: function (direction) {
			let action = "clear_gate_" + direction;
			let title = "Toll gate";
			let msg = "Some gangsters are lounging about. They want you to pay for passage.";
			GameGlobals.uiFunctions.showActionPopup(action, title, msg);
		},

		getDescription: function (entity, hasCampHere, hasCampOnLevel, hasVision, isScouted) {
			var position = entity.get(PositionComponent).getPosition();
			var passagesComponent = this.playerLocationNodes.head.entity.get(PassagesComponent);
			var workshopComponent = this.playerLocationNodes.head.entity.get(WorkshopComponent);
			var featuresComponent = this.playerLocationNodes.head.entity.get(SectorFeaturesComponent);
			var sectorStatus = this.playerLocationNodes.head.entity.get(SectorStatusComponent);
			var enemiesComponent = this.playerLocationNodes.head.entity.get(EnemiesComponent);
			var localesComponent = entity.get(SectorLocalesComponent);
			var hasEnemies = enemiesComponent.hasEnemies;

			var description = "<p>";
			description += this.getTextureDescription(hasVision, entity, position, featuresComponent, sectorStatus, localesComponent);
			description += this.getFunctionalDescription(hasVision, isScouted, featuresComponent, workshopComponent, hasCampHere, hasCampOnLevel);
			description += "</p><p>";
			description += this.getStatusDescription(hasVision, isScouted, hasEnemies, featuresComponent, passagesComponent, hasCampHere, hasCampOnLevel);
			description += this.getMovementDescription(isScouted, passagesComponent, entity);
			description += "</p>";

			// The scavenged and resources-found figures used to close this text.
			// They are a table of their own now - see getSectorStatsTable - so
			// the prose ends with the graffiti if there is one, and the empty
			// paragraph that used to trail every sector goes with them.
			if (isScouted) {
				let graffiti = sectorStatus.graffiti || featuresComponent.graffiti;
				if (graffiti) description += "<p>There is a graffiti here: " + graffiti + "</p>";
			}

			return description;
		},

		getTextureDescription: function (hasVision, sector, position, featuresComponent, sectorStatus, localesComponent) {
			var campOrdinal = GameGlobals.gameState.getCampOrdinal(position.level);
			let hasGlowStickLight = sectorStatus.glowStickSeconds > 0;
			let hasLight = hasVision || featuresComponent.sunlit || hasGlowStickLight;
			
			// sector static description
			var features = GameGlobals.sectorHelper.getTextFeatures(sector);
			var desc = TextConstants.getSectorDescription(hasVision, features) + ". ";

			// light / darkness description
			if (featuresComponent.sunlit) {
				if (hasVision) desc += "The area is swathed in relentless <span class='hl-functionality'>daylight</span>. ";
				else desc += "The area is swathed in blinding <span class='hl-functionality'>sunlight</span>. ";
			} else {
				if (sectorStatus.glowStickSeconds > -5) {
					if (sectorStatus.glowStickSeconds < 5)
						desc += "The glowstick fades out.";
					else
						desc += "A glowstick casts a sickly <span class='hl-functionality'>light</span>.";
				} else {
					if (hasVision) desc += "";
					else desc += "There is no <span class='hl-functionality'>light</span>. ";
				}
			}

			// world features
			if (hasLight && PositionConstants.isWorldPillarPosition(position)) {
				desc += "The area is dominated by a massive concrete pillar, one of the great spines of the City. ";
			}
			
			// locales / POIs description
			for (let i = 0; i < localesComponent.locales.length; i++) {
				let locale = localesComponent.locales[i];
				if (!this.isLocaleVisible(locale)) continue;
				if (sectorStatus.isLocaleScouted(i)) {
					if (locale.type == localeTypes.tradingpartner) {
						var partner = TradeConstants.getTradePartner(campOrdinal);
						if (partner) {
							desc += "<span class='hl-functionality'>" + partner.name + "</span> is located here. ";
						}
					}
				}
			}

			return desc;
		},

		// Existing improvements. Workshops. Potential improvements (camp).
		getFunctionalDescription: function (hasVision, isScouted, featuresComponent, workshopComponent, hasCampHere, hasCampOnLevel) {
			let currentSector = this.playerLocationNodes.head.entity;
			let positionComponent = currentSector.get(PositionComponent);
			let position = positionComponent.getPosition();

			var sectorControlComponent = this.playerLocationNodes.head.entity.get(SectorControlComponent);
			var sectorStatus = this.playerLocationNodes.head.entity.get(SectorStatusComponent);
			var improvements = this.playerLocationNodes.head.entity.get(SectorImprovementsComponent);

			var description = "";

			if (isScouted && featuresComponent.hasSpring) {
				description += "There is a <span class='hl-functionality'>" + TextConstants.getSpringName(featuresComponent) + "</span> here. ";
			}

			if (isScouted) {
				let canBucket = featuresComponent.resourcesCollectable.water > 0;
				let canTrap = featuresComponent.resourcesCollectable.food > 0;
				
				if (canBucket && canTrap) {
					description += "Both <span class='hl-functionality'>water</span> and <span class='hl-functionality'>food</span> can be collected here. ";
				} else if (canBucket) {
					if (featuresComponent.sunlit) {
						description += "It looks like <span class='hl-functionality'>rainwater</span> could be collected here. ";
					} else {
						description += "There is a bit of <span class='hl-functionality'>water</span> leaking here that could be collected. ";
					}
				} else if (canTrap) {
					description += "It might be worthwhile to install <span class='hl-functionality'>traps</span> here. ";
				}

				if (featuresComponent.heapResource) {
					let heapDisplayName = 
						"<span class='hl-functionality'>" +
						Text.addArticle(TextConstants.getHeapDisplayName(featuresComponent.heapResource, featuresComponent)) +
						"</span>";
					let resourceDisplayName = TextConstants.getResourceDisplayName(featuresComponent.heapResource);
					if (sectorStatus.getHeapScavengedPercent() >= 100) {
						description += "There is " + heapDisplayName + ", but it has been picked clean. ";
					} else {
						description += "There is " + heapDisplayName + ", which can be scavenged for " + resourceDisplayName + ". ";
					}
				}
			}

			if (hasCampHere) {
				let campOrdinal = GameGlobals.gameState.getCampOrdinal(position.level);
				let isOutpost = GameGlobals.campBalancingHelper.isOutpost(campOrdinal);
				let campTerm = "camp";
				if (isOutpost) campTerm = "small camp";

				description += "There is a <span class='hl-functionality'>" + campTerm + "</span> here. ";
			}

			if (isScouted && featuresComponent.examineSpots.length > 0) {
				for (let i = 0; i < featuresComponent.examineSpots.length; i++) {
					let spotID = featuresComponent.examineSpots[i];
					let spotDef = StoryConstants.getSectorExampineSpot(spotID);
					if (!spotDef) continue;
					description += "There is a " + Text.t(spotDef.nameKey) + " here. ";
				}
			}

			if (isScouted && workshopComponent && workshopComponent.isClearable) {
				var workshopName = TextConstants.getWorkshopName(workshopComponent.resource);
				var workshopControl = sectorControlComponent.hasControlOfLocale(LocaleConstants.LOCALE_ID_WORKSHOP);
				var workshopStatus = workshopControl ? "cleared for use" : "not cleared";
				description += "There is <span class='hl-functionality'>" + Text.addArticle(workshopName) + "</span> here (" + workshopStatus + "). ";
			}

			if (isScouted && improvements.getCount(improvementNames.greenhouse) > 0) {
				description += "There is a <span class='hl-functionality'>greenhouse</span> here. ";
			}
			
			let luxuryResource = GameGlobals.sectorHelper.getLuxuryResourceOnSector(this.playerLocationNodes.head.entity, true);
			if (isScouted && luxuryResource) {
				description += "There is a source of <span class='hl-functionality'>" + TribeConstants.getLuxuryDisplayName(luxuryResource) + "</span> here. ";
			}
			
			if (isScouted && GameGlobals.levelHelper.isFirstScoutedSectorWithFeatureOnLevel(this.playerLocationNodes.head.entity, "hasTradeConnectorSpot")) {
				description += "There is space here for a bigger building project. ";
			}

			return description;
		},

		// Found resources, enemies
		getStatusDescription: function (hasVision, isScouted, hasEnemies, featuresComponent, passagesComponent, hasCampHere, hasCampOnLevel) {
			let description = "";

			// Scouted status
			if (hasVision && !isScouted) {
				description += Text.t("ui.exploration.sector_status_not_scouted_description");
			}

			// Danger
			if (hasVision) {
				description += this.getDangerDescription(isScouted, featuresComponent, hasCampHere);
			}
			
			// Waymarks
			if (isScouted) {
				for (let i = 0; i < featuresComponent.waymarks.length; i++) {
					let waymark = featuresComponent.waymarks[i];
					description += this.getWaymarkText(waymark) + ". ";
				}
			}

			// Camp
			if (isScouted && hasVision && !hasCampHere && !hasCampOnLevel) {
				if (featuresComponent.canHaveCamp() && !hasEnemies && !passagesComponent.passageUp && !passagesComponent.passageDown)
					description += "This would be a good place for a <span class='hl-functionality'>camp</span>. ";
			}

			return description;
		},

		// What has been taken from this sector and what is left in it. This is
		// the one part of the sector text that is numbers rather than prose, and
		// it is what a player checks before deciding to scavenge again - so it
		// gets a table of its own and, on a phone, the top of the tab.
		getSectorStatsTable: function (isScouted, featuresComponent, statusComponent) {
			let fields = this.getSectorStatsFields(isScouted, featuresComponent, statusComponent);
			if (fields.length == 0) return "";

			let table = "<table class='sector-stats'>";
			for (let i = 0; i < fields.length; i++) {
				table += this.getSectorStatsRow(fields[i]);
			}
			table += "</table>";

			return table;
		},

		// The fields are localized as one "Label: value" string each, so the
		// split happens here and the string file keeps one entry per field. A
		// translation that drops the colon still shows - as one wide row rather
		// than two cells.
		getSectorStatsRow: function (field) {
			let separator = field.indexOf(":");
			if (separator < 0) return "<tr><td colspan='2'>" + field + "</td></tr>";

			let label = field.substring(0, separator);
			let value = field.substring(separator + 1).trim();

			return "<tr><td class='sector-stats-label'>" + label + "</td><td class='sector-stats-value'>" + value + "</td></tr>";
		},

		// How far the room is scavenged. It reads "?" until the room is
		// scouted, rather than "0%", because those are different facts: one is
		// "nobody has looked" and the other is "there is nothing here yet".
		getScavengedText: function (isScouted, statusComponent) {
			if (!statusComponent) return Text.t("ui.common.value_unknown");
			if (!isScouted) return Text.t("ui.common.value_unknown");
			if (!GameGlobals.gameState.unlockedFeatures.scavenge) return Text.t("ui.common.value_unknown");
			return Math.floor(statusComponent.getScavengedPercent()) + "%";
		},

		// The resources list, in one place. It used to be built inline in
		// getSectorStatsFields; it is its own row in the action band now, and
		// the rule for what to show when nothing is known belongs with it
		// rather than with the table it left.
		getResourcesFoundText: function (featuresComponent, statusComponent) {
			if (!featuresComponent || !statusComponent) return Text.t("ui.common.value_unknown");

			let knownResources = GameGlobals.sectorHelper.getLocationKnownResources();
			if (knownResources.length > 0) {
				let discoveredResources = GameGlobals.sectorHelper.getLocationDiscoveredResources();
				return TextConstants.getScaResourcesString(discoveredResources, knownResources, featuresComponent.resourcesScavengable);
			}

			let scavengedPercent = statusComponent.getScavengedPercent();
			if (scavengedPercent >= ExplorationConstants.THRESHOLD_SCAVENGED_PERCENT_REVEAL_NO_RESOURCES) {
				if (featuresComponent.resourcesScavengable.getTotal() > 0) return Text.t("ui.common.value_unknown");
				return Text.t("ui.common.list_template_zero");
			}

			return Text.t("ui.common.value_unknown");
		},

		// Whether there is an items line to show at all.
		//
		// The regular layout's table has always asked this, and answered by leaving the
		// line out. The phone's finds row did not, so a room that produces no items -
		// most of them - carried a permanent "Items: ?" that could never become
		// anything. One rule in one place now, so the two layouts cannot drift again.
		//
		// It flips at scouting, not while scavenging, so the row does not change height
		// under a thumb that is mid-tap.
		hasVisibleItemsToShow: function (featuresComponent) {
			if (!featuresComponent) return false;
			if (featuresComponent.itemsScavengeable.length == 0) return false;
			return GameGlobals.sectorHelper.hasSectorVisibleIngredients();
		},

		// The items list, on the same three-state rule as the resources list
		// above and deliberately not a simpler one. "There are no items here"
		// is knowledge the player has to earn: reading it off an empty list
		// before the room is scavenged would say, for free, that this room is
		// not worth the stamina. So it stays "?" until the same threshold that
		// reveals an empty resources list.
		getItemsFoundText: function (featuresComponent, statusComponent) {
			if (!featuresComponent || !statusComponent) return Text.t("ui.common.value_unknown");

			if (GameGlobals.sectorHelper.hasSectorVisibleIngredients()) {
				let discoveredItems = GameGlobals.sectorHelper.getLocationDiscoveredItems();
				let knownItems = GameGlobals.sectorHelper.getLocationKnownItems();
				return TextConstants.getScaItemString(discoveredItems, knownItems, featuresComponent.itemsScavengeable);
			}

			let scavengedPercent = statusComponent.getScavengedPercent();
			if (scavengedPercent >= ExplorationConstants.THRESHOLD_SCAVENGED_PERCENT_REVEAL_NO_RESOURCES) {
				if (featuresComponent.itemsScavengeable.length > 0) return Text.t("ui.common.value_unknown");
				return Text.t("ui.common.list_template_zero");
			}

			return Text.t("ui.common.value_unknown");
		},

		getSectorStatsFields: function (isScouted, featuresComponent, statusComponent) {
			if (!featuresComponent) return [];
			let fields = [];

			if (this.showInvestigate()) {
				let investigatedPercent = statusComponent.getInvestigatedPercent();
				let investigationComplete = investigatedPercent >= 100;
				if (investigationComplete) {
					fields.push(Text.t("ui.exploration.sector_status_investigated_percent_field_completed", Math.floor(investigatedPercent)));
				} else {
					fields.push(Text.t("ui.exploration.sector_status_investigated_percent_field_default", Math.floor(investigatedPercent)));
				}
			}

			// The phone reads these from its own row above the minimap, so the
			// table would be saying them twice. The regular layout has no such
			// band, and this table is where it has always read them - taking
			// the lines out for everyone would have quietly cost desktop the
			// resources and items lists altogether.
			// The phone's row lives in the map panel, and that panel does not
			// exist until scouting unlocks (see updateUnlockedFeatures) - so
			// until it does, the table is the only place they can go.
			let hasFindsRow = $("body").hasClass("layout-small") && GameGlobals.gameState.unlockedFeatures.scout;
			if (hasFindsRow) return fields;

			fields.push(Text.t("ui.exploration.sector_status_resources_found_field", this.getResourcesFoundText(featuresComponent, statusComponent)));

			// Only when there is something to say, which is how this table has always
			// read - and now how the phone's finds row reads too, through the same
			// predicate rather than a copy of the condition.
			if (this.hasVisibleItemsToShow(featuresComponent)) {
				let discoveredItems = GameGlobals.sectorHelper.getLocationDiscoveredItems();
				let knownItems = GameGlobals.sectorHelper.getLocationKnownItems();
				fields.push(Text.t("ui.exploration.sector_status_items_found_field", TextConstants.getScaItemString(discoveredItems, knownItems, featuresComponent.itemsScavengeable)));
			}

			return fields;
		},

		getMovementDescription: function (isScouted, passagesComponent, entity) {
			var description = "";
			var improvements = this.playerLocationNodes.head.entity.get(SectorImprovementsComponent);
			var position = entity.get(PositionComponent);

			// Passages up / down
			var passageUpBuilt = improvements.getCount(improvementNames.passageUpStairs) +
				improvements.getCount(improvementNames.passageUpElevator) +
				improvements.getCount(improvementNames.passageUpHole) > 0;
			var passageDownBuilt = improvements.getCount(improvementNames.passageDownStairs) +
				improvements.getCount(improvementNames.passageDownElevator) +
				improvements.getCount(improvementNames.passageDownHole) > 0;

			if (isScouted) {
				if (passagesComponent.passageUp)
					description += TextConstants.getPassageDescription(passagesComponent.passageUp, PositionConstants.DIRECTION_UP, passageUpBuilt) + " ";
				if (passagesComponent.passageDown)
					description += TextConstants.getPassageDescription(passagesComponent.passageDown, PositionConstants.DIRECTION_DOWN, passageDownBuilt) + " ";
			}

			// Blockers n/s/w/e
			for (let i in PositionConstants.getLevelDirections()) {
				var direction = PositionConstants.getLevelDirections()[i];
				var directionName = PositionConstants.getDirectionName(direction);
				var blocker = passagesComponent.getBlocker(direction);

				if (blocker) {
					var gangComponent = GameGlobals.levelHelper.getGangComponent(position, direction);
					var blockerName = TextConstants.getMovementBlockerName(blocker, gangComponent).toLowerCase();
					if (GameGlobals.movementHelper.isBlocked(entity, direction)) {
						switch (blocker.type) {
							case MovementConstants.BLOCKER_TYPE_DEBRIS:
							case MovementConstants.BLOCKER_TYPE_WASTE_TOXIC:
							case MovementConstants.BLOCKER_TYPE_WASTE_RADIOACTIVE:
								description += "Passage to the " + directionName + " is blocked by <span class='hl-functionality'>" + blockerName + "</span>. ";
								break;
							default:
								description += "Passage to the " + directionName + " is blocked by a <span class='hl-functionality'>" + blockerName + "</span>. ";
								break;
						}
					} else {
						var gang = GameGlobals.levelHelper.getGang(position, direction);
						if (blocker.type == MovementConstants.BLOCKER_TYPE_DEBRIS) {
							description += "Debris to the " + directionName + " has been cleared away. ";
						} else if (blocker.type == MovementConstants.BLOCKER_TYPE_EXPLOSIVES) {
							description += "Old explosives to the " + directionName + " have been cleared away. ";
						} else if (blocker.type == MovementConstants.BLOCKER_TYPE_GANG) {
							if (gang) {
								description += "A " + blockerName + " to the " + directionName + " has been " + TextConstants.getUnblockedVerb(blocker.type) + ". ";
							} else {
								log.w("gang blocker but no gang component at " + position, this);
							}
						} else {
							description += "A " + blockerName + " to the " + directionName + " has been " + TextConstants.getUnblockedVerb(blocker.type) + ". ";
						}
					}
				}
			}

			return description;
		},

		getDangerDescription: function (isScouted, featuresComponent, hasCampOnLevel) {
			let sectorControlComponent = this.playerLocationNodes.head.entity.get(SectorControlComponent);
			let sectorStatus = this.playerLocationNodes.head.entity.get(SectorStatusComponent);
			let enemiesComponent = this.playerLocationNodes.head.entity.get(EnemiesComponent);
			let hasEnemies = enemiesComponent.hasEnemies;

			let enemyDesc = "";

			if (hasEnemies) {
				if (isScouted) {
					enemyDesc = "This area is " + TextConstants.getEnemyText(enemiesComponent.possibleEnemies, sectorControlComponent).toLowerCase() + ". ";
				}
			} else if (isScouted) {
				enemyDesc += Text.t("ui.exploration.sector_status_no_enemies_description");
				enemyDesc += Text.t("ui.common.sentence_separator");
			}

			var notCampableDesc = "";
			if (isScouted) {
				if (!featuresComponent.campable) {
					var inhabited = featuresComponent.level > 10;
					switch (featuresComponent.notCampableReason) {
						case LevelConstants.UNCAMPABLE_LEVEL_TYPE_RADIATION:
							if (inhabited && featuresComponent.wear < 6)
								notCampableDesc = "Many entrances have big yellow warning signs on them, with the text 'KEEP OUT' and a <span class='hl-functionality'>radiation</span> sign. ";
							else if (inhabited && featuresComponent.buildingDensity > 5)
								notCampableDesc = "Walls are covered in graffiti warning about <span class='hl-functionality'>radiation</span>. ";
							else
								notCampableDesc = "There is an eerie air as if the place has been <span class='hl-functionality'>abandoned</span> in a hurry. ";
							break;

						case LevelConstants.UNCAMPABLE_LEVEL_TYPE_POLLUTION:
							if (inhabited && featuresComponent.wear < 6)
								notCampableDesc = "Many entrances have big red warning signs on them with a <span class='hl-functionality'>skull sign</span> and the text 'KEEP OUT'. ";
							else if (inhabited && featuresComponent.buildingDensity > 5)
								notCampableDesc = "Walls are covered in graffiti warning about some kind of <span class='hl-functionality'>pollution</span>. ";
							else
								notCampableDesc = "A <span class='hl-functionality'>noxious smell</span> hangs in the air. ";
							break;

						case LevelConstants.UNCAMPABLE_LEVEL_TYPE_SUPERSTITION:
							if (inhabited)
								notCampableDesc = "There aren't any signs of recent human <span class='hl-functionality'>habitation</span>. ";
							else
								notCampableDesc = "An unnerving <span class='hl-functionality'>silence</span> blankets the streets. ";
							break;
					}
				}
			}

			var hasHazards = GameGlobals.sectorHelper.hasHazards(featuresComponent, sectorStatus);
			var hazards = GameGlobals.sectorHelper.getEffectiveHazards(featuresComponent, sectorStatus);
			var hazardDesc = "";
			if (hasHazards) {
				if (hazards.radiation > 0) {
					hazardDesc += "This place is <span class='hl-functionality'>radioactive</span> (" + hazards.radiation + "). ";
				}
				if (hazards.poison > 0) {
					hazardDesc += "This place is dangerously <span class='hl-functionality'>polluted</span> (" + hazards.poison + "). ";
				}
				if (hazards.cold > 0) {
					let coldAdjective = hazards.cold < 20 ? "quite" : hazards.cold < 50 ? "very" : "extremely";
					hazardDesc += "It's " + coldAdjective + " <span class='hl-functionality'>cold</span> here (" + hazards.cold + "). ";
				}
				if (hazards.flooded > 0) {
					hazardDesc += "This place is <span class='hl-functionality'>flooded</span>. ";
				}
				if (hazards.debris > 0) {
					hazardDesc += "It difficult to move around here due to the amount of <span class='hl-functionality'>debris</span>.";
				}
				if (hazards.territory > 0) {
					hazardDesc += "This sector is <span class='hl-functionality'>gang territory</span>.";
				}
			}

			return enemyDesc + (hasHazards ? hazardDesc : notCampableDesc);
		},

		// What is on screen for the two collectors: the rows, the build and improve
		// buttons, and whether each bar chip exists at all.
		//
		// Split from updateCollectorFills on purpose. This half decides visibility,
		// so it must run with the code that recounts #header-out-improvements, or
		// the heading and the rows drift apart. Returns the visible row count.
		updateCollectorRows: function () {
			if (!this.playerLocationNodes.head) return 0;

			let improvements = this.playerLocationNodes.head.entity.get(SectorImprovementsComponent);
			let numVisibleRows = 0;
			let numChips = 0;

			for (let i = 0; i < COLLECTOR_DEFS.length; i++) {
				let def = COLLECTOR_DEFS[i];
				let vo = improvements.getVO(def.improvementName);
				let isBuilt = vo.count > 0;
				let level = improvements.getLevel(def.improvementName);
				let maxLevel = GameGlobals.campHelper.getCurrentMaxImprovementLevel(def.improvementName);

				// level < maxLevel, not maxLevel > 1: at the cap the game keeps the
				// arrow visible and disabled, which would leave every finished
				// collector with a permanently dead row
				let showBuild = !isBuilt && GameGlobals.playerActionsHelper.isVisible(def.buildAction);
				let showImprove = isBuilt && level < maxLevel;
				// The build button is in the chip now, so the row is left with the
				// upgrade and the name it upgrades. The two are the same condition:
				// there is nothing to upgrade until there is something built.
				let showRow = showImprove;

				GameGlobals.uiFunctions.toggle(def.buildID, showBuild);
				GameGlobals.uiFunctions.toggle(def.improveID, showImprove);
				GameGlobals.uiFunctions.toggle(def.rowID, showRow);
				if (showRow) numVisibleRows++;

				// the label names the collector beside its improve arrow, so it is
				// only worth resolving while the row is on screen
				let showLabel = showRow && isBuilt;
				let $label = $(def.rowID).find(".collector-row-label");
				GameGlobals.uiFunctions.toggle($label, showLabel);
				if (showLabel) {
					// getImprovementDisplayName resolves the id from the name itself
					$label.find("span").text(ImprovementConstants.getImprovementDisplayName(def.improvementName, level) + " · lvl " + level);
				}

				// Two states for one chip, and they cannot overlap: before it is
				// built the chip is the icon and the button that builds it, after
				// it is the fill level and the two collect actions.
				//
				// Toggled here rather than hidden by the chip's own class.
				// UIOutElementsSystem keeps a cached list of the buttons worth
				// updating and rebuilds it from what is visible, so a button that
				// css alone had hidden dropped out of that list - and the pass
				// that dropped it also left an inline hide on its container,
				// which kept it invisible after the class came back. It could
				// never earn its way in again, and sat there with whatever
				// disabled state it had when it left: a full bucket beside a
				// struck-through "all". Toggling says so out loud instead.
				GameGlobals.uiFunctions.toggle(def.useAllID, isBuilt);
				GameGlobals.uiFunctions.toggle(def.useOneID, isBuilt);

				$(def.chipID).toggleClass("is-built", isBuilt);
				$(def.chipID).toggleClass("is-buildable", showBuild);
				if (isBuilt || showBuild) numChips++;
			}

			$("#out-sector-bar").toggleClass("has-collectors", numChips > 0);

			return numVisibleRows;
		},

		// The stored/capacity numbers on the chips. These change on every collect
		// and every slow tick but never change what is visible, so they run on
		// their own and cost no requirement checks.
		updateCollectorFills: function () {
			if (!this.playerLocationNodes.head) return;
			if (GameGlobals.playerHelper.isInCamp()) return;

			let improvements = this.playerLocationNodes.head.entity.get(SectorImprovementsComponent);

			for (let i = 0; i < COLLECTOR_DEFS.length; i++) {
				let def = COLLECTOR_DEFS[i];
				let vo = improvements.getVO(def.improvementName);
				let capacity = vo.storageCapacity[def.resource] * vo.count;
				let stored = Math.floor(vo.storedResources[def.resource] * 10) / 10;
				$(def.fillID).text(capacity > 0 ? stored + " / " + capacity : "");
			}
		},

		updateOutImprovementsList: function (improvements) {
			if (!this.playerLocationNodes.head) return;
			if (GameGlobals.playerHelper.isInCamp()) return;
			var improvements = this.playerLocationNodes.head.entity.get(SectorImprovementsComponent);
			var uiFunctions = GameGlobals.uiFunctions;
			var numVisible = this.updateCollectorRows();
			this.updateCollectorFills();
			$.each(this.elements.outImprovementsTR, function () {
				// the collector rows are owned by updateCollectors
				if ($(this).hasClass("collector-row")) return;

				var actionName = $(this).attr("btn-action");

				if (!actionName) {
					actionName = $(this).find("button.action-build").attr("action");
					$(this).attr("btn-action", actionName);
				}

				if (actionName) {
					let improvementName = GameGlobals.playerActionsHelper.getImprovementNameForAction(actionName);
					if (improvementName) {
						let actionVisible = GameGlobals.playerActionsHelper.isVisible(actionName);
						let existingImprovements = improvements.getCount(improvementName);
						$(this).find(".list-amount").text(existingImprovements);

						// A row whose build button has moved to the sector bar has
						// nothing to offer until something is standing here - only
						// the dismantle is left in it. Without this the beacon row
						// would show empty wherever a beacon could be built.
						let hasBuildButton = $(this).find("button.action-build").length > 0;
						let isVisible = (hasBuildButton && actionVisible) || existingImprovements > 0;
						GameGlobals.uiFunctions.toggle($(this), isVisible);
						if (isVisible) numVisible++;
					}
				}
			});
			GameGlobals.uiFunctions.toggle("#header-out-improvements", numVisible > 0);
		},

		// live values only - anything that changes what is visible belongs in
		// updateOutImprovementsList, which owns the #header-out-improvements count
		updateOutImprovementsStatus: function () {
			if (!this.playerLocationNodes.head) return;
			var improvements = this.playerLocationNodes.head.entity.get(SectorImprovementsComponent);

			this.updateCollectorFills();

			let hasBeacon = improvements.getCount(improvementNames.beacon);
			GameGlobals.uiFunctions.toggle("#out-action-dismantle-beacon", hasBeacon);
		},

		updateLocales: function () {
			if (!this.playerLocationNodes.head) return;

			let currentSector = this.playerLocationNodes.head.entity;
			let positionComponent = currentSector.get(PositionComponent);
			let position = positionComponent.getPosition();
			let campOrdinal = GameGlobals.gameState.getCampOrdinal(position.level);
			var sectorStatus = this.playerLocationNodes.head.entity.get(SectorStatusComponent);

			var isScouted = sectorStatus.scouted;
			
			let sectorFeaturesComponent = currentSector.get(SectorFeaturesComponent);
			let sectorStatusComponent = currentSector.get(SectorStatusComponent);

			let locales = this.getVisibleLocales(isScouted);
			
			let data = locales.map((locale) => {
				let index = locale.index;
				let isScouted = sectorStatusComponent.isLocaleScouted(index);
				let result = {};
				result.campOrdinal = campOrdinal;
				result.position = position;
				result.index = index;
				result.locale = locale;
				result.isScouted = isScouted;
				result.sectorFeaturesComponent = sectorFeaturesComponent;
				return result;
			});
			
			let numNewItems = UIList.update(this.localeList, data).length;
			
			if (numNewItems > 0) {
				GameGlobals.buttonHelper.updateButtonDisabledStates("#table-out-actions-locales", true);
				GameGlobals.uiFunctions.createButtons("#table-out-actions-locales");
				GlobalSignals.elementCreatedSignal.dispatch();
			}
		},
		
		createLocaleListItem: function () {
			let li = {};
			let button = "<button class='action multiline'></button>";
			let info = "<span class='p-meta'></span";
			li.$root = $("<tr><td>" + button + "</td><td>" + info + "</td></tr>");
			li.$button = li.$root.find("button");
			li.$info = li.$root.find("span");
			return li;
		},
		
		isLocaleListItemDataSame: function (d1, d2) {
			return d1.index == d2.index && d1.position.equals(d2.position) && d1.isScouted == d2.isScouted;
		},
		
		updateLocaleListItem: function (li, data) {
			let locale = data.locale;
			
			li.$button.attr("action", "scout_locale_" + locale.getCategory() + "_" + data.index);
			li.$button.find(".btn-label").html(TextConstants.getLocaleName(locale, data.sectorFeaturesComponent));

			let isScouted = data.isScouted;
			let canBeScouted = !isScouted || LocaleConstants.canBeScoutedAgain(locale.type);
			
			let info = "";
			if (!canBeScouted) {
				if (locale.type == localeTypes.tradingpartner) {
					let partner = TradeConstants.getTradePartner(data.campOrdinal);
					if (partner) {
						info += "Already scouted (" + partner.name + ")";
					} else {
						info += "Already scouted";
					}
				} else if (locale.luxuryResource != null) {
					info += "Already scouted (" + TribeConstants.getLuxuryDisplayName(locale.luxuryResource) + ")";
				} else {
					info += "Already scouted";
				}
			}
			li.$info.html(info);
		},

		updateMovementActions: function () {
			let activeDespairType = GameGlobals.playerHelper.getActiveDespairType();
			let showGrit = activeDespairType == MovementConstants.DESPAIR_TYPE_HUNGRER || activeDespairType == MovementConstants.DESPAIR_TYPE_THIRST;
			GameGlobals.uiFunctions.toggle(".movement-action-normal", !showGrit);
			GameGlobals.uiFunctions.toggle(".movement-action-grit", showGrit);
		},

		updateCharacters: function () {
			$("#out-characters").empty();

			if (!this.playerLocationNodes.head) return;

			let sectorStatus = this.playerLocationNodes.head.entity.get(SectorStatusComponent);
			let hasCharacters = sectorStatus.currentCharacters.length > 0;
			let isScouted = sectorStatus.scouted;
			let showCharacters = hasCharacters && isScouted;

			// Same arrangement as the Search box: docked into the sector bar this
			// is one of the bar's own rows, the heading has nothing left to label,
			// and the bar shows its rows by class rather than by a display of
			// their own (see SECTOR ACTION BAR in mobile.less).
			let isDocked = $("#out-characters").parent().is("#out-sector-bar");

			GameGlobals.uiFunctions.toggle($("#header-out-characters"), !isDocked && showCharacters);
			GameGlobals.uiFunctions.toggle($("#out-characters"), showCharacters);
			$("#out-sector-bar").toggleClass("has-characters", isDocked && showCharacters);

			if (!showCharacters) return;

			for (let i = 0; i < sectorStatus.currentCharacters.length; i++) {
				let character = sectorStatus.currentCharacters[i];

				let talkAction = "start_out_npc_dialogue_" + character.instanceID;

				let randomIndex = character.randomIndex || character.instanceID || 0;
				let div = UIConstants.getNPCDiv(character.characterType, talkAction, randomIndex);
				$("#out-characters").append(div);
			}

			GameGlobals.uiFunctions.createButtons("#out-characters");
		},

		updateMovementRelatedActions: function () {
			if (!this.playerLocationNodes.head) return;
			if (GameGlobals.playerHelper.isInCamp()) return;

			var currentSector = this.playerLocationNodes.head.entity;
			var movementOptionsComponent = currentSector.get(MovementOptionsComponent);
			var enemiesComponent = currentSector.get(EnemiesComponent);
			var enemiesComponent = currentSector.get(PositionComponent);
			var position = currentSector.get(PositionComponent).getPosition();
			$("#container-out-actions-movement-related").empty();

			let sys = this;

			function addBlockerActionButton(blocker, direction) {
				if (blocker.type === MovementConstants.BLOCKER_TYPE_GAP) return;
				if (movementOptionsComponent.canMoveToDirection(direction)) return;

				let directionName = PositionConstants.getDirectionName(direction, true);

				if (blocker.type === MovementConstants.BLOCKER_TYPE_TOLL_GATE) {
					let button = $("<button>approach toll gate (" + directionName + ")</button>");
					button.data("direction", direction);
					button.click(ExceptionHandler.wrapClick((e) => sys.onApproachTollGateButtonClicked(e)));
					$("#container-out-actions-movement-related").append(button);
				} else {
					let action = blocker.actionBaseID + "_" + direction;
					let gangComponent = GameGlobals.levelHelper.getGangComponent(position, direction);
					let description = TextConstants.getMovementBlockerAction(blocker, enemiesComponent, gangComponent) + " (" + directionName + ")";
					let button = "<button class='action' action='" + action + "'>" + description + "</button>";
					$("#container-out-actions-movement-related").append(button);
				}
			}

			for (let i in PositionConstants.getLevelDirections()) {
				var direction = PositionConstants.getLevelDirections()[i];
				var directionBlocker = GameGlobals.movementHelper.getBlocker(currentSector, direction);
				if (directionBlocker && !GameGlobals.movementHelper.isProjectBlocker(directionBlocker.type)) {
					addBlockerActionButton(directionBlocker, direction);
				}
			}

			GameGlobals.uiFunctions.createButtons("#container-out-actions-movement-related");
			GameGlobals.uiFunctions.updateButtonCooldowns("#container-out-actions-movement-related");
			
			GlobalSignals.elementCreatedSignal.dispatch();
		},

		updateSectorDescription: function () {
			if (GameGlobals.gameState.uiStatus.isHidden) return;
			// every line below dereferences it, and four signal handlers call
			// this without checking first - updateLocales and updateCharacters
			// beside them already guard the same way
			if (!this.playerLocationNodes.head) return;
			var featuresComponent = this.playerLocationNodes.head.entity.get(SectorFeaturesComponent);
			var sectorStatus = this.playerLocationNodes.head.entity.get(SectorStatusComponent);

			var sector = this.playerLocationNodes.head.entity;
			var vision = this.playerPosNodes.head.entity.get(VisionComponent).value;
			var hasVision = vision > PlayerStatConstants.VISION_BASE;
			var hasCampOnLevel = GameGlobals.levelHelper.getLevelEntityForSector(this.playerLocationNodes.head.entity).has(CampComponent);
			var hasCampHere = this.playerLocationNodes.head.entity.has(CampComponent);
			var isScouted = sectorStatus.scouted;

			// Header. Written twice on purpose: the h2 is what the regular
			// layout reads, and the banner chip is what a phone reads. The
			// stylesheet hides whichever one this layout does not use.
			var features = GameGlobals.sectorHelper.getTextFeatures(sector);
			var sectorHeaderText = TextConstants.getSectorHeader(hasVision, features);
			this.elements.sectorHeader.text(sectorHeaderText);
			this.elements.roomName.text(sectorHeaderText);

			// Description
			this.elements.description.html(this.getDescription(
				sector,
				hasCampHere,
				hasCampOnLevel,
				hasVision,
				isScouted
			));

			// Investigated, as a table of its own
			this.elements.descriptionStats.html(this.getSectorStatsTable(isScouted, featuresComponent, sectorStatus));

			// The finds row, at the bottom of the phone's screen. Every value
			// is written on every pass, and each has a reading for "nothing
			// known yet", so the row keeps its shape - nothing shifts under the
			// thumb at the moment of scouting or scavenging, which is exactly
			// when the player is tapping.
			this.elements.scavengedValue.text(this.getScavengedText(isScouted, sectorStatus));
			this.elements.resourcesValue.text(this.getResourcesFoundText(featuresComponent, sectorStatus));
			this.elements.itemsValue.text(this.getItemsFoundText(featuresComponent, sectorStatus));
			// A class on the row rather than uiFunctions.toggle: toggle writes an inline
			// display, and the line is a flex container, so it would come back as a block
			// and put the label and the list on separate lines.
			this.elements.findsRow.toggleClass("no-items", !this.hasVisibleItemsToShow(featuresComponent));

			this.updateRoomIntro(isScouted, hasCampHere);
		},

		// The description used to be on screen simply because it was in the
		// page. Now that it is a panel, something has to decide when a player
		// who has not asked for it should see it: the first time they stand
		// here, and any time the room itself has changed since.
		//
		// The key is the room's identity, and NOTHING that is merely true of the
		// room right now. It used to hash the rendered header and description,
		// which is not identity at all: getSectorDescription picks between a
		// "sector-vision" and a "sector-novision" template, so the same room
		// hashed differently by lamplight than in the dark, and the text
		// features underneath it move with scavenging besides. A fresh launch
		// starts with vision low and climbing, so the stored hash almost never
		// matched and every room was described again - which is what this was
		// supposed to stop.
		//
		// What is left is what actually makes a room worth introducing twice:
		// having been scouted, and having a camp in it. Position is the key it
		// is stored under, so it does not need repeating in the value.
		//
		// Kept in the browser, NOT in the save. The save format uses two-letter
		// keys and drops falsy values to stay small, and a hash per sector
		// across a whole world would cost real bytes for what is a cosmetic
		// memory - and it would ride the cloud save to other devices, where it
		// is nobody's memory. So it sits beside the save instead: this browser
		// remembers which rooms it has already described, and a different or a
		// cleared browser describes them again, which is the right trade.
		//
		// It was in memory only, so every reload described every room the
		// player walked back through as if it were new.
		// A value stored by an earlier version is a number, and this one is a string, so
		// they never match: every room gets one more introduction and then settles. One
		// repeat is a better migration than reading someone else's format.
		updateRoomIntro: function (isScouted, hasCampHere) {
			if (!this.shownRoomIntros) this.shownRoomIntros = this.loadShownRoomIntros();

			let position = this.playerPosNodes.head.position;
			let positionKey = position.level + "." + position.sectorX + "." + position.sectorY;

			// two flags, so it is readable in storage and cannot drift with anything
			// that is not one of them
			let hash = (isScouted ? "1" : "0") + (hasCampHere ? "1" : "0");

			if (this.shownRoomIntros[positionKey] === hash) return;

			// the panel is a small-layout thing, and it has nothing to say
			// about a camp, about a player who cannot see, or about a screen
			// that already has a popup on it
			if (!$("body").hasClass("layout-small")) return;
			if (position.inCamp) return;
			if ($("body").hasClass("vision-step-0")) return;
			// isPaused covers the popups too: UIPopupManager sets it from
			// hasOpenPopup() every time a popup opens or closes
			if (GameGlobals.gameState.isPaused) return;

			// Stored only once it is actually shown. Arriving somewhere while a
			// popup is up is common - a fight, a story beat - and marking the
			// room seen there would spend its one intro on a screen the player
			// never saw. updateSectorDescription runs again on popupClosed, on
			// leaving camp and on vision changing, so the intro arrives when
			// whatever was in the way clears.
			this.shownRoomIntros[positionKey] = hash;
			this.saveShownRoomIntros();

			GameGlobals.uiFunctions.toggleRoomPanel(true);
		},

		// One world's worth, under one key, stamped with the seed it belongs to. A
		// mismatched seed is a different world - a restart, or a save from elsewhere -
		// and its rooms are not these rooms, so the memory starts empty rather than
		// silently swallowing the new world's first intros.
		//
		// Keeping only the current world also bounds what this can grow to: one entry
		// per room described, about twenty bytes each, and nothing accumulating across
		// games. Going back to an older world describes its rooms again.
		loadShownRoomIntros: function () {
			try {
				let raw = localStorage.getItem(this.STORAGE_KEY_ROOM_INTROS);
				let stored = raw ? JSON.parse(raw) : null;
				if (stored && stored.seed === GameGlobals.gameState.worldSeed && stored.rooms) return stored.rooms;
			} catch (ex) {
				log.w("could not read shown room intros: " + ex);
			}
			return {};
		},

		// Storage can be full or refused - private browsing, a quota - and none of this
		// is worth an exception on the path that shows a room description. Losing it
		// costs one repeated intro.
		saveShownRoomIntros: function () {
			try {
				localStorage.setItem(this.STORAGE_KEY_ROOM_INTROS, JSON.stringify({
					seed: GameGlobals.gameState.worldSeed,
					rooms: this.shownRoomIntros
				}));
			} catch (ex) {
				log.w("could not store shown room intros: " + ex);
			}
		},

		updateLocationDetails: function () {
			let hasFirstCamp = GameGlobals.gameState.numCamps > 0;
			let hasCampOnLevel = GameGlobals.levelHelper.getLevelEntityForSector(this.playerLocationNodes.head.entity).has(CampComponent);
			let pathToCamp = GameGlobals.playerHelper.getPathToCamp();
			let pathToCampLen = pathToCamp ? pathToCamp.length : "?";
			let canMove = GameGlobals.gameState.isFeatureUnlocked("move");
			
			$("#out-action-move-camp-details").text("(" + pathToCampLen + " blocks)");
			
			let showDistanceIndicator = hasFirstCamp && canMove;
			GameGlobals.uiFunctions.toggle($("#out-distance-indicator"), showDistanceIndicator);
			if (showDistanceIndicator) {
				if (hasCampOnLevel) {
					$("#out-distance-indicator").text(Text.t("ui.exploration.current_distance_to_camp_field", pathToCampLen));
				} else {
					let pathToPassage = GameGlobals.playerHelper.getPathToPassage();
					let pathToPassageLen = pathToPassage ? pathToPassage.length : "?";
					$("#out-distance-indicator").text(Text.t("ui.exploration.current_distance_to_passage_field", pathToPassageLen));
				}
			}
		},

		rebuildVis: function () {
			if (GameGlobals.gameState.uiStatus.isHidden) return;
			if (!this.playerLocationNodes.head) return;
			if (GameGlobals.playerHelper.isInCamp()) return;

			this.pendingUpdateMap = false;
			
			let mapPosition = this.playerLocationNodes.head.position.getPosition();
			GameGlobals.uiMapHelper.rebuildMapHints("minimap-background", "minimap", mapPosition);
			GameGlobals.uiMapHelper.rebuildMap("minimap", "minimap-overlay", mapPosition, UIConstants.MAP_MINIMAP_SIZE, true, MapUtils.MAP_MODE_DEFAULT);
		},
		
		showInvestigate: function () {
			return GameGlobals.playerActionsHelper.isVisible("investigate");
		},
		
		getResourceCurrentlyAvailableToCollect: function (resourceName) {
			var improvements = this.playerLocationNodes.head.entity.get(SectorImprovementsComponent);
			var collectorName = GameGlobals.sectorHelper.getCollectorName(resourceName);
			var collector = improvements.getVO(collectorName);
			var availableResource = collector.storedResources[resourceName];
			return availableResource || 0;
		},
		
		getWaymarkText: function (waymarkVO) {
			let pos = waymarkVO.fromPosition;
			let sector = GameGlobals.levelHelper.getSectorByPosition(pos.level, pos.sectorX, pos.sectorY);
			let sectorFeatures = GameGlobals.sectorHelper.getTextFeatures(sector);
			return TextConstants.getWaymarkText(waymarkVO, sectorFeatures);
		},

		onApproachTollGateButtonClicked: function (e) {
			GlobalSignals.triggerSoundSignal.dispatch(UIConstants.soundTriggerIDs.buttonClicked);
			let $btn = $(e.currentTarget);
			let direction = $btn.data("direction");
			this.showTollGatePopup(direction);
		},

		// The shown-intro map belongs to one world, not to the save, so a restart in
		// the same page would otherwise inherit it - same starting position, same
		// identity hash - and the new game's first room would open with no intro at
		// all. The stored copy is stamped with a world seed and would be rejected on
		// the next read anyway; this drops it now so nothing carries over in memory.
		onGameReset: function () {
			this.shownRoomIntros = {};
			this.saveShownRoomIntros();
			GameGlobals.uiFunctions.toggleRoomPanel(false);
		},

		onPopupClosed: function () {
			this.updateLocales();
			this.updateCharacters();
			// A room first described behind a popup - a fight, a story beat -
			// has had its intro held back rather than spent (see
			// updateRoomIntro). This is the pass that lets it through, and
			// without it the intro would wait for some unrelated update that
			// may never come while the player is still standing there.
			this.updateSectorDescription();
		},
		
		onButtonStateChanged: function (action, isEnabled) {
			switch (action) {
				case "use_out_collector_water":
				case "use_out_collector_water_one":
				case "use_out_collector_food":
				case "use_out_collector_food_one":
					this.updateOutImprovementsStatus();
					break;
			}
		},
	});

	return UIOutLevelSystem;
});
