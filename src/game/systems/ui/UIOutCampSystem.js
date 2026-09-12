 define([
	'ash',
	'text/Text',
	'utils/MathUtils',
	'utils/UIState',
	'utils/UIList',
	'utils/UIAnimations',
	'game/GameGlobals',
	'game/GlobalSignals',
	'game/vos/CharacterVO',
	'game/constants/CharacterConstants',
	'game/constants/GameConstants',
	'game/constants/ImprovementConstants',
	'game/constants/PlayerActionConstants',
	'game/constants/UIConstants',
	'game/constants/UpgradeConstants',
	'game/constants/OccurrenceConstants',
	'game/constants/CampConstants',
	'game/constants/DialogueConstants',
	'game/constants/TextConstants',
	'game/constants/TribeConstants',
	'game/nodes/level/PlayerLevelNode',
	'game/nodes/PlayerPositionNode',
	'game/nodes/PlayerLocationNode',
	'game/nodes/tribe/TribeUpgradesNode',
	'game/components/player/PerksComponent',
	'game/components/player/PlayerActionComponent',
	'game/components/common/CampComponent',
	'game/components/common/ResourcesComponent',
	'game/components/common/ResourceAccumulationComponent',
	'game/components/sector/OutgoingCaravansComponent',
	'game/components/sector/ReputationComponent',
	'game/components/sector/improvements/SectorImprovementsComponent',
	'game/components/sector/events/CampEventTimersComponent',
	'game/components/sector/events/RefugeesComponent',
	'game/components/sector/events/VisitorComponent',
	'text/Text'
], function (
	Ash, Text, MathUtils, UIState, UIList, UIAnimations, GameGlobals, GlobalSignals,
	CharacterVO,
	CharacterConstants, GameConstants, ImprovementConstants, PlayerActionConstants, UIConstants, UpgradeConstants, OccurrenceConstants, CampConstants, DialogueConstants, TextConstants, TribeConstants,
	PlayerLevelNode, PlayerPositionNode, PlayerLocationNode, TribeUpgradesNode,
	PerksComponent, PlayerActionComponent,
	CampComponent, ResourcesComponent, ResourceAccumulationComponent, OutgoingCaravansComponent, ReputationComponent, SectorImprovementsComponent, CampEventTimersComponent, RefugeesComponent, VisitorComponent,
	Text
) {
	let UIOutCampSystem = Ash.System.extend({
		
		context: "UIOutCampSystem",

		engine: null,

		playerPosNodes: null,
		playerLocationNodes: null,
		playerLevelNodes: null,
		tribeUpgradesNodes: null,

		bubbleNumber: -1,
		
		visibleBuildingCount: 0,
		availableBuildingCount: 0,
		lastShownVisibleBuildingCount: 0,
		lastShownAvailableBuildingCount: 0,
		currentEvents: 0,
		lastShownEvents: 0,

		elements: {
			improvementRows: [],
			steppers: {},
		},

		constructor: function () {
			this.initImprovements();
			this.initWorkers();
			this.initElements();
		},
		
		initElements: function () {
			this.campActionList = UIList.create(this, $("#in-occurrences-building-container"), this.createCampActionListItem, this.updateCampActionListItem, this.isCampActionListItemDataSame);
			this.campOccurrencesList = UIList.create(this, $("#in-occurrences-camp-container"), this.createCampActionListItem, this.updateCampOccurrenceListItem, this.isCampOccurrenceListItemDataSame);
			this.campMiscEventsList = UIList.create(this, $("#in-occurrences-misc-container"), this.createCampActionListItem, this.updateCampMiscEventListItem);
			this.characterList = UIList.create(this, $("#in-characters ul"), this.createCharacterListItem, this.updateCharacterListItem, (d1, d2) => d1.instanceID == d2.instanceID);

			this.elements.populationAutoassignedLabel = $("#in-population #in-population-autoassigned");

			// the badge on the Buildings header advertises the B menu and opens it on a tap
			$("#in-improvements-menu-hint").click(function () {
				GlobalSignals.openBuildingsPopupSignal.dispatch();
			});
			this.elements.populationAutoAssignToggle = $(".in-assign-workers-auto-toggle");
			this.elements.populationDecreaseHint = $("#in-population-decrease-hint");
			this.elements.populationDetailsContainer = $("#in-population-details");
			this.elements.populationHeader = $("#in-population h3");
			this.elements.populationProgressBar = $("#in-population-bar-next");
			this.elements.populationProgressBarLabel = $("#in-population-bar-next .progress-label");
			this.elements.populationProgressLabel = $("#in-population-next");
			this.elements.populationReputationRequirementLabel = $("#in-population-reputation");
			this.elements.populationRobotsChangeIndicator = $("#robots-change-indicator");
			this.elements.populationRobotsContainer = $("#in-population #in-population-robots");
			this.elements.populationRobotsContainer = $("#in-population-robots");
			this.elements.populationRobotsLabel = $("#in-population #in-population-robots .value");
			this.elements.populationUnassignedLabel = $("#in-population-status-free");
			this.elements.populationDisabledLabel = $("#in-population-status-disabled");
			this.elements.unassignedWorkersBubble = $("#unassigned-workers-bubble");
			this.elements.workersTable = $("#in-assign-workers");

			this.initBuildingsPopup();
		},

		addToEngine: function (engine) {
			this.engine = engine;
			this.playerLocationNodes = engine.getNodeList(PlayerLocationNode);
			this.playerPosNodes = engine.getNodeList(PlayerPositionNode);
			this.playerLevelNodes = engine.getNodeList(PlayerLevelNode);
			this.tribeUpgradesNodes = engine.getNodeList(TribeUpgradesNode);
			
			GlobalSignals.add(this, GlobalSignals.tabChangedSignal, this.onTabChanged);
			GlobalSignals.add(this, GlobalSignals.improvementBuiltSignal, this.onImprovementBuilt);
			GlobalSignals.add(this, GlobalSignals.playerPositionChangedSignal, this.onPlayerPositionChanged);
			GlobalSignals.add(this, GlobalSignals.playerLocationChangedSignal, this.onPlayerPositionChanged);
			GlobalSignals.add(this, GlobalSignals.campRenamedSignal, this.onCampRenamed);
			GlobalSignals.add(this, GlobalSignals.populationChangedSignal, this.onPopulationChanged);
			GlobalSignals.add(this, GlobalSignals.campEventStartedSignal, this.onCampEventStarted);
			GlobalSignals.add(this, GlobalSignals.campEventEndedSignal, this.onCampEventEnded);
			GlobalSignals.add(this, GlobalSignals.workersAssignedSignal, this.onWorkersAssigned);
			GlobalSignals.add(this, GlobalSignals.gameShownSignal, this.onGameShown);
			GlobalSignals.add(this, GlobalSignals.slowUpdateSignal, this.slowUpdate);
			GlobalSignals.add(this, GlobalSignals.gameStartedSignal, this.refresh);
			GlobalSignals.add(this, GlobalSignals.layoutChangedSignal, this.updateLayout);
			GlobalSignals.add(this, GlobalSignals.openBuildingsPopupSignal, this.onOpenBuildingsPopup);
			GlobalSignals.add(this, GlobalSignals.popupClosedSignal, this.onPopupClosed);
			GlobalSignals.add(this, GlobalSignals.popupOpenedSignal, this.onPopupOpened);

			this.refresh();
		},

		removeFromEngine: function (engine) {
			this.engine = null;
			this.playerLocationNodes = null;
			this.playerPosNodes = null;
			this.playerLevelNodes = null;
			this.tribeUpgradesNodes = null;

			$(document).off("keydown.buildingsopen");
			$(document).off("keydown.buildingspopup");
			if (this._onBuildingsKeyUpCapture) document.removeEventListener("keyup", this._onBuildingsKeyUpCapture, true);
			GlobalSignals.removeAll(this);
		},

		update: function () {
			let isActive = GameGlobals.gameState.uiStatus.currentTab === GameGlobals.uiFunctions.elementIDs.tabs.in;
			
			if (!this.playerLocationNodes.head) return;
			if (!this.playerPosNodes.head.position.inCamp) return;
			if (GameGlobals.gameState.uiStatus.isTransitioning) return;

			this.updateEvents(isActive);
			this.updatePopulationDisplayFast();
		},

		slowUpdate: function () {
			if (GameGlobals.gameState.uiStatus.isHidden) return;
			if (!this.playerLocationNodes.head) return;

			this.updateImprovements();
			this.updateBuildingsMenuHint();
			if (this.buildingsPopupOpen) this.renderBuildingsPopupList();
			this.updateBubble();
			this.updateStats();
			this.updatePopulationDisplaySlow();
		},

		refresh: function () {
			if (!this.playerLocationNodes.head) return;
			if (!this.playerPosNodes.head.position.inCamp) return;
			if (GameGlobals.gameState.uiStatus.isHidden) return;

			let campComponent = this.playerLocationNodes.head.entity.get(CampComponent);
			if (!campComponent) return;

			this.updateLayout();

			let position = this.playerPosNodes.head.position.getPosition();
			let campOrdinal = GameGlobals.gameState.getCampOrdinal(position.level);

			// Header
			let isOutpost = GameGlobals.campBalancingHelper.isOutpost(campOrdinal);
			let headerTextKey = "ui.camp.page_header_default";
			if (isOutpost) headerTextKey = "ui.camp.page_header_outpost";
			GameGlobals.uiFunctions.setText("#tab-header h2", headerTextKey, position.level);

			this.updateAssignedWorkers();
			this.updateWorkerMaxDescriptions();
			this.updateImprovements();
			this.updateStats();
			this.updateNews();
			this.updateBubble();
			this.updateCharactersDisplay();
			this.updatePopulationDisplaySlow();
			this.updatePopulationDisplayFast();
		},

		updateBubble: function () {
			let sector =  this.playerLocationNodes.head.entity;
			let campComponent = sector.get(CampComponent);
			if (!campComponent) return;
			let campCount = GameGlobals.gameState.numCamps;
			
			let buildingNum = this.visibleBuildingCount - this.lastShownVisibleBuildingCount;
			if (campCount == 1) {
				buildingNum = this.availableBuildingCount - this.lastShownAvailableBuildingCount;
			}
			
			let eventNum = Math.max(0, this.currentEvents - this.lastShownEvents);
			let visitorNum = GameGlobals.campHelper.hasNewEvent(sector, OccurrenceConstants.campOccurrenceTypes.visitor) ? 1 : 0;

			let freePopulation = Math.max(0, campComponent.getFreePopulation());

			let newBubbleNumber = Math.max(0, buildingNum + eventNum + visitorNum + freePopulation);
			
			GameGlobals.uiFunctions.updateBubble("#switch-in .bubble", this.bubbleNumber, newBubbleNumber);
			this.bubbleNumber = newBubbleNumber;
		},

		getCampMaxPopulation: function () {
			if (!this.playerLocationNodes.head) return;
			return GameGlobals.campHelper.getCampMaxPopulation(this.playerLocationNodes.head.entity);
		},

		updateWorkerStepper: function (campComponent, id, workerType, maxWorkers, showMax, isAutoAssigned) {
			GameGlobals.uiFunctions.toggle($(id).closest("tr"), maxWorkers > 0);

			var freePopulation = Math.max(0, campComponent.getFreePopulation()) || 0;
			var assignedWorkers = Math.max(0, campComponent.assignedWorkers[workerType]) || 0;
			var maxAssigned = Math.min(assignedWorkers + freePopulation, maxWorkers);
			GameGlobals.uiFunctions.updateStepper(id, assignedWorkers, 0, maxAssigned);
			
			let $checkbox = $("#in-assing-worker-auto-" + workerType);
			$checkbox.prop("checked", isAutoAssigned);

			$(id).parent().siblings(".in-assign-worker-limit").children(".callout-container").children(".info-callout-target").html(showMax ? "<span>/ " + maxWorkers + "</span>" : "");
		},

		updatePopulationDisplaySlow: function () {
			let isActive = GameGlobals.gameState.uiStatus.currentTab === GameGlobals.uiFunctions.elementIDs.tabs.in;
			if (!isActive) return;
			if (GameGlobals.gameState.uiStatus.isBlocked) return;

			let camp = this.playerLocationNodes.head.entity;
			let campComponent = camp.get(CampComponent);
			if (!campComponent) return;

			let currentPopulation =  Math.floor(campComponent.population);
			let maxPopulation = this.getCampMaxPopulation();
			let disabledPopulation = campComponent.getDisabledPopulation();
			
			// reputation requirements
			let reputation = camp.get(ReputationComponent).value;
			let reqRepCur = CampConstants.getRequiredReputation(Math.floor(campComponent.population));
			let reqRepNext = CampConstants.getRequiredReputation(Math.floor(campComponent.population) + 1);
			let isReputationBlocking = reqRepNext < reputation;
			GameGlobals.uiFunctions.setText(this.elements.populationReputationRequirementLabel, "ui.camp.population_reputation_status_field", { current: reqRepCur, next: reqRepNext });

			// population header
			GameGlobals.uiFunctions.slideToggleIf(this.elements.populationHeader, null, maxPopulation > 0 || campComponent.population > 0, 200, 200);
			GameGlobals.uiFunctions.setText(this.elements.populationHeader, "ui.camp.population_header", { current: currentPopulation, max: maxPopulation });

			// unassigned workers
			let freePopulation = campComponent.getFreePopulation();
			GameGlobals.uiFunctions.toggle(this.elements.unassignedWorkersBubble, freePopulation > 0);
			GameGlobals.uiFunctions.setText(this.elements.populationUnassignedLabel, "ui.camp.population_unassigned_workers_field", { value: freePopulation });
			GameGlobals.uiFunctions.toggle(this.elements.populationDisabledLabel, disabledPopulation > 0);
			GameGlobals.uiFunctions.setText(this.elements.populationDisabledLabel, "ui.camp.population_disabled_workers_field", { value: disabledPopulation });

			// auto-assigned workers
			let autoAssignedWorkers = campComponent.getAutoAssignedWorkers();
			let autoAssignedWorkersNames = autoAssignedWorkers.map(workerType => CampConstants.getWorkerDisplayName(workerType));
			let autoAssignedWorkersText = TextConstants.getListText(autoAssignedWorkersNames, 3);
			GameGlobals.uiFunctions.setText(this.elements.populationAutoassignedLabel, "ui.camp.population_auto_assigned_workers_field", { value: autoAssignedWorkersText });
			GameGlobals.uiFunctions.toggle(this.elements.populationAutoAssignToggle, GameGlobals.gameState.unlockedFeatures.workerAutoAssignment);
		},

		updatePopulationDisplayFast: function () {
			let isActive = GameGlobals.gameState.uiStatus.currentTab === GameGlobals.uiFunctions.elementIDs.tabs.in;
			if (!isActive) return;
			if (GameGlobals.gameState.uiStatus.isBlocked) return;

			let camp = this.playerLocationNodes.head.entity;
			let campComponent = camp.get(CampComponent);
			if (!campComponent) return;
			
			let maxPopulation = this.getCampMaxPopulation();

			let isPopulationMaxed = campComponent.population >= maxPopulation;
			let populationChangePerSec = campComponent.populationChangePerSec || 0;
			let populationChangePerSecWithoutCooldown = campComponent.populationChangePerSecWithoutCooldown || 0;
			let showReputationRequirement = maxPopulation > 0;
			
			let isOnPopulationDecreaseCooldown = campComponent.populationDecreaseCooldown;

			let populationProgressLabelKey = populationChangePerSec >= 0 && !isOnPopulationDecreaseCooldown ? "ui.camp.population_next_worker_progress_label" : "ui.camp.population_worker_leaving_progress_label";

			GameGlobals.uiFunctions.setText(this.elements.populationProgressLabel, populationProgressLabelKey);
			
			let isPopulationStill = populationChangePerSecWithoutCooldown === 0 && !isOnPopulationDecreaseCooldown;

			let secondsToChange = 0;
			let progress = 0;

			let populationOverflow = (campComponent.population - Math.floor(campComponent.population));
			if (populationChangePerSecWithoutCooldown > 0) {
				progress = populationOverflow;
				secondsToChange = (1 - populationOverflow) / populationChangePerSec;
			} else if (populationChangePerSec < 0 || isOnPopulationDecreaseCooldown) {
				let secondsToLoseOnePop = 1 / -populationChangePerSecWithoutCooldown + CampConstants.POPULATION_DECREASE_COOLDOWN;
				secondsToChange = (campComponent.populationDecreaseCooldown || 0) + (populationOverflow / -populationChangePerSecWithoutCooldown);
				progress = secondsToChange / secondsToLoseOnePop;

				let hint = this.getPopulationDecreaseHint();
				if (hint) {
					this.elements.populationDecreaseHint.text("People are leaving because of: " + hint);
				} else {
					this.elements.populationDecreaseHint.text("People are leaving because of: low reputation");
				}
			}

			let progressLabel = UIConstants.getTimeToNum(secondsToChange);
			
			if (populationChangePerSec === 0) progressLabel = "no change";
			if (isOnPopulationDecreaseCooldown) progressLabel = "cooldown";

			this.elements.populationProgressBar.toggleClass("warning", populationChangePerSec < 0);
			this.elements.populationProgressBar.data("progress-percent", progress * 100);
			this.elements.populationProgressBar.data("animation-length", 500);
			this.elements.populationProgressBarLabel.text(progressLabel);

			GameGlobals.uiFunctions.slideToggleIf(this.elements.populationReputationRequirementLabel, null, showReputationRequirement, 200, 200);
			GameGlobals.uiFunctions.slideToggleIf(this.elements.populationProgressBar, null, campComponent.population > 0 && !isPopulationStill, 200, 200);
			GameGlobals.uiFunctions.slideToggleIf(this.elements.populationProgressLabel, null, campComponent.population > 0 && !isPopulationStill, 200, 200);
			GameGlobals.uiFunctions.slideToggleIf(this.elements.populationDetailsContainer, null, campComponent.population >= 1, 200, 200);
			GameGlobals.uiFunctions.slideToggleIf(this.elements.populationAutoassignedLabel, null, GameGlobals.gameState.unlockedFeatures.workerAutoAssignment, 200, 200);
			GameGlobals.uiFunctions.slideToggleIf(this.elements.workersTable, null, campComponent.population >= 1, 200, 200);
			GameGlobals.uiFunctions.slideToggleIf(this.elements.populationDecreaseHint, null, populationChangePerSecWithoutCooldown < 0);
			
			this.updatePopulationDisplayRobots();
		},

		updatePopulationDisplayRobots: function () {
			let camp = this.playerLocationNodes.head.entity;
			let resources = camp.get(ResourcesComponent);

			let robots = resources.resources.robots || 0;
			let maxRobots = GameGlobals.campHelper.getRobotStorageCapacity(camp);

			GameGlobals.uiFunctions.slideToggleIf(this.elements.populationRobotsContainer, null, robots > 0, 200, 200);

			if (robots <= 0) return;

			GameGlobals.uiFunctions.updateText(this.elements.populationRobotsLabel, Math.floor(robots) + " / " + maxRobots);

			let campResourceAcc = this.playerLocationNodes.head.entity.get(ResourceAccumulationComponent);
			let robotBonus = GameGlobals.campBalancingHelper.getWorkerRobotBonus(robots);
			let robotSources = campResourceAcc.getSources(resourceNames.robots);
			
			let robotCalloutContent = "";

			for (let i in robotSources) {
				let source = robotSources[i];
				if (source.amount != 0) {
					robotCalloutContent += UIConstants.getResourceAccumulationSourceText(source) + "<br/>";
				}
			}
			
			if (robots >= 1) {
				robotCalloutContent += "<br/>worker resource production: +" + UIConstants.roundValue(robotBonus * 100, true, false) + "%";
			}
			
			UIConstants.updateCalloutContent(this.elements.populationRobotsContainer, robotCalloutContent);
			
			let robotsAccumulationRaw = campResourceAcc.getChange(resourceNames.robots);
			let robotsAccumulation = robots <= maxRobots || robotsAccumulationRaw < 0 ? robotsAccumulationRaw : 0;
			this.updateChangeIndicator(this.elements.populationRobotsChangeIndicator, robotsAccumulation);
		},

		updateChangeIndicator: function (indicator, accumulation) {
			indicator.toggleClass("indicator-increase", accumulation > 0);
			indicator.toggleClass("indicator-even", accumulation === 0);
			indicator.toggleClass("indicator-decrease", accumulation < 0);
		},

		updateAssignedWorkers: function (campComponent) {
			var campComponent = this.playerLocationNodes.head.entity.get(CampComponent);
			if (!campComponent) return;
				
			for (let key in CampConstants.workerTypes) {
				var def = CampConstants.workerTypes[key];
				UIConstants.updateCalloutContent("#in-assign-" + key + " .in-assign-worker-desc .info-callout-target", this.getWorkerDescription(def), true);
			}
			
			for (let key in CampConstants.workerTypes) {
				let def = CampConstants.workerTypes[key];
				let maxWorkers = GameGlobals.campHelper.getMaxWorkers(this.playerLocationNodes.head.entity, key);
				let showMax = maxWorkers >= 0;
				let isAutoAssigned = campComponent.autoAssignedWorkers[key] || false;
				if (maxWorkers < 0) maxWorkers = GameGlobals.campHelper.getCampMaxPopulation(this.playerLocationNodes.head.entity);
				this.updateWorkerStepper(campComponent, "#stepper-" + def.id, def.id, maxWorkers, showMax, isAutoAssigned);
			}
		},

		updateWorkerMaxDescriptions: function () {
			var improvements = this.playerLocationNodes.head.entity.get(SectorImprovementsComponent);
			var posComponent = this.playerPosNodes.head.position;
			var campOrdinal = GameGlobals.gameState.getCampOrdinal(posComponent.level);
			var workshops = GameGlobals.levelHelper.getWorkshopsByResourceForCamp(campOrdinal);
			
			for (var key in CampConstants.workerTypes) {
				var def = CampConstants.workerTypes[key];
				var maxWorkers = GameGlobals.campHelper.getMaxWorkers(this.playerLocationNodes.head.entity, key);
				if (maxWorkers <= 0) continue;
				var num = def.getLimitNum(improvements, workshops);
				var text = def.getLimitText(num);
				UIConstants.updateCalloutContent("#in-assign-" + def.id + " .in-assign-worker-limit .info-callout-target", text, true);
			}
		},

		updateCharacters: function () {
			this.updateCharactersSelection();
			this.updateCharactersDisplay();
		},

		updateCharactersSelection: function () {
			let campComponent = this.playerLocationNodes.head.entity.get(CampComponent);

			if (!campComponent) return;

			let improvements = this.playerLocationNodes.head.entity.get(SectorImprovementsComponent);
			let population = campComponent.population;
			let hasCampfire = improvements.getCount(improvementNames.campfire);

			let validCharacterTypes = GameGlobals.campHelper.getValidCampCharacters(campComponent);

			if (!hasCampfire || population < 1 || validCharacterTypes.length < 1) {
				campComponent.displayedCharacters = [];
				return;
			}

			let currentCharacters = campComponent.displayedCharacters || [];

			let isCurrentSelectionValid = currentCharacters.length > 0;

			for (let i = 0; i < currentCharacters.length; i++) {
				let currentCharacter = currentCharacters[i];
				if (validCharacterTypes.indexOf(currentCharacter.characterType) < 0) {
					isCurrentSelectionValid = false;
					break;
				}
			}

			let maxNumCharacters = 1;
			if (population > 6) maxNumCharacters = 2;
			if (population > 16) maxNumCharacters = 3;
			if (population > 32) maxNumCharacters = 4;
			if (population > 60) maxNumCharacters = 5;
			maxNumCharacters = Math.min(maxNumCharacters, validCharacterTypes.length);
			let minCharacters = Math.floor(maxNumCharacters / 2);

			if (currentCharacters.length < minCharacters || currentCharacters.length > maxNumCharacters) isCurrentSelectionValid = false;

			let timestamp = new Date().getTime();
			if (timestamp - campComponent.displayedCharactersRefreshTimestamp > 1000 * 60 * 10) isCurrentSelectionValid = false;

			if (isCurrentSelectionValid) return;

			let numCharacters = MathUtils.randomIntBetween(minCharacters, maxNumCharacters);

			let currentNumCharacters = currentCharacters.length;
			let keepNumCharacters = Math.max(0, Math.min(currentNumCharacters - 1, numCharacters - 1));

			let characters = [];
			let charactersByType = {}; // type -> num

			let canAddCharacterWithType = function (characterType) {
				if (validCharacterTypes.indexOf(characterType) < 0) return false;
				let max = GameGlobals.campHelper.getMaxCampCharacters(campComponent, characterType);
				if (charactersByType[characterType] && charactersByType[characterType] >= max) return false;
				return true;
			};

			let charactersToKeep = MathUtils.randomElements(currentCharacters, keepNumCharacters);

			for (let i = 0; i < numCharacters; i++) {
				let characterVO;
				if (charactersToKeep[i] && canAddCharacterWithType(charactersToKeep[i].characterType)) {
					characterVO = charactersToKeep[i];
				} else {
					let currentlyValidCharacterTypes = validCharacterTypes.filter(type => canAddCharacterWithType(type));
					let characterType = MathUtils.randomElement(currentlyValidCharacterTypes);
					let dialogueSourceID = CharacterConstants.getDialogueSourceID(characterType);
					characterVO = new CharacterVO(characterType, dialogueSourceID);
				}

				characters.push(characterVO);
				if (!charactersByType[characterVO.characterType]) charactersByType[characterVO.characterType] = 0;
				charactersByType[characterVO.characterType]++;
			}

			campComponent.displayedCharacters = characters;
			campComponent.displayedCharactersRefreshTimestamp = timestamp;

			log.i("selected displayed characters: " + characters.join(","));
		},

		updateCharactersDisplay: function () {
			if (GameGlobals.gameState.uiStatus.currentTab !== GameGlobals.uiFunctions.elementIDs.tabs.in) return;

			let characterData = this.getDisplayedCharacterData();
			
			GameGlobals.uiFunctions.toggle("#in-characters", characterData.length > 0);
			UIList.update(this.characterList, characterData);
			GameGlobals.uiFunctions.createButtons("#in-characters");
		},

		createCharacterListItem: function () {
			let li = {};
			let $root = $("<li>" + UIConstants.createNPCDiv() + "</li>");
			li.$root = $root;
			li.$container = $root.find("div.npc-container");
			return li;
		},

		updateCharacterListItem: function (li, data) {
			let type = data.type;
			let characterVO = data.characterVO;
			let characterType = characterVO.characterType;
			let randomIndex = characterVO.randomIndex || characterVO.instanceID || 0;
			let isTemporary = false;

			let talkActionID = "";

			switch (type) {
				case "visitor":
					talkActionID = "start_visitor_dialogue";
					isTemporary = true;
					break;
				case "refugees":
					talkActionID = "start_refugee_dialogue";
					isTemporary = true;
					break;
				default:
					talkActionID = "start_in_npc_dialogue_" + characterVO.instanceID;
					break;
			}

			let options = { isTemporary: isTemporary };
			UIConstants.updateNPCDiv(li.$container, characterType, talkActionID, randomIndex, options);
		},

		getDisplayedCharacterData: function () {
			let data = [];

			let sector = this.playerLocationNodes.head.entity;
			if (!sector) return data;

			let campComponent = sector.get(CampComponent);
			if (campComponent && campComponent.displayedCharacters) {
				for (let i = 0; i < campComponent.displayedCharacters.length; i++) {
					let characterVO = campComponent.displayedCharacters[i];
					data.push({ type: "inhabitant", characterVO: characterVO });
				}
			}

			let visitorComponent = sector.get(VisitorComponent);
			if (visitorComponent) {
				let characterVO = visitorComponent.characterVO;

				// TODO create characterVO already on event start
				if (!characterVO) {
					characterVO = new CharacterVO(visitorComponent.visitorType, visitorComponent.dialogueSource);
					visitorComponent.characterVO = characterVO;
				}

				data.push({ type: "visitor", characterVO: characterVO });
			}

			let refugeesComponent = sector.get(RefugeesComponent);
			if (refugeesComponent) {
				let characterVO = refugeesComponent.characterVO;

				// TODO create characterVO already on event start?
				if (!characterVO) {
					characterVO = new CharacterVO("settlementRefugee", refugeesComponent.dialogueSource);
					refugeesComponent.characterVO = characterVO;
				}

				data.push({ type: "refugees", characterVO: characterVO, num: refugeesComponent.num });
			}

			return data;
		},

		initImprovements: function () {
			var $table = $("#in-improvements table");
			var trs = "";
			this.elements.improvementRows = {};
			
			let improvementIDs = Object.keys(ImprovementConstants.improvements).sort(this.sortImprovements);
			
			for (let i = 0; i < improvementIDs.length; i++) {
				let key = improvementIDs[i];
				let def = ImprovementConstants.improvements[key];
				let name = improvementNames[key];
				if (getImprovementType(name) !== improvementTypes.camp) continue;
				let tds = "";
				let buildAction = "build_in_" + key;
				let improveAction = "improve_in_" + key;
				let hasImproveAction = PlayerActionConstants.hasAction(improveAction);
				let useAction = "use_in_" + key;
				let hasUseAction = PlayerActionConstants.hasAction(useAction);
				let useActionExtra = "use_in_" + key + "_2";
				let hasUseActionExtra = PlayerActionConstants.hasAction(useActionExtra);
				let dismantleAction = "dismantle_in_" + key;
				let canBeDismantled = def.canBeDismantled || false;
				
				let buildButton = "<button class='action action-build action-location' data-tab='switch-in' action='" + buildAction +"'>" + "" + "</button>";
				var useButton = "";
				if (hasUseAction) {
					useButton = "<button class='action action-use action-location btn-narrow' data-tab='switch-in' action='" + useAction + "'>" + def.useActionName + "</button>";
				}
				let useButton2 = "";
				if (hasUseActionExtra) {
					useButton2 = "<button class='action action-use2 action-location btn-narrow' data-tab='switch-in' action='" + useActionExtra + "'>" + def.useActionName2 + "</button>";
				}
				let improveButton = "";
				if (hasImproveAction) {
					improveButton = "<button class='action action-improve btn-glyph-big' data-tab='switch-in' action='" + improveAction + "'></button>";
				}
				let dismantleButton = "";
				if (canBeDismantled) {
					dismantleButton = "<button class='action action-dismantle btn-glyph-big' data-tab='switch-in' action='" + dismantleAction + "'>×</button>";
				}
				let repairButton = "<button class='action action-repair btn-narrow' data-tab='switch-in' action='repair_in_" + key + "'>Repair</button>";
				let damagedIcon = "<img src='img/eldorado/icon-gear-warning.png' class='icon-damaged icon-ui-generic icon-centered' alt='Building damaged' title='Building damaged' />"
				
				tds += "<td>" + buildButton + "</td>";
				tds += "<td><span class='improvement-badge improvement-count'>0</span></td>";
				tds += "<td style='position:relative'><span class='improvement-badge improvement-level'>0</span>";
				tds += "</td>";
				tds += "<td>" + improveButton + "" + damagedIcon + "</td>";
				tds += "<td>" + dismantleButton + "</td>";
				tds += "<td>" + useButton + "" + useButton2 + "" + repairButton + "</td>";
				trs += "<tr id='in-improvements-" + key + "'>" + tds + "</tr>";
			}
			let ths = "<tr class='header-mini'><th></th><th>count</th><th>lvl</th><th></th><th></th><th></th></tr>"
			$table.append(ths);
			$table.append(trs);
			
			// TODO save elements already in the previous loop
			let result = [];
			$.each($("#in-improvements tr"), function () {
				if ($(this).hasClass("header-mini")) return;
				var id = $(this).attr("id");
				var buildAction = $(this).find("button.action-build").attr("action");
				if (!buildAction) {
					log.w("In improvement tr without action name: #" + id);
					log.i($(this))
					return;
				}
				let improveAction = $(this).find("button.action-improve").attr("action");
				let improvementName = GameGlobals.playerActionsHelper.getImprovementNameForAction(buildAction);
				if (!improvementName) return;
				let btnBuild = $(this).find(".action-build");
				let btnUse = $(this).find(".action-use");
				let btnUse2 = $(this).find(".action-use2");
				let btnImprove = $(this).find(".action-improve");
				let btnDismantle = $(this).find(".action-dismantle");
				let btnRepair = $(this).find(".action-repair");
				let iconDamaged = $(this).find(".icon-damaged");
				let count = $(this).find(".improvement-count")
				let level = $(this).find(".improvement-level")
				result.push({ tr: $(this), btnBuild: btnBuild, btnUse: btnUse, btnUse2: btnUse2, btnImprove: btnImprove, btnDismantle: btnDismantle, btnRepair: btnRepair, iconDamaged: iconDamaged, count: count, level: level, id: id, action: buildAction, improveAction: improveAction, improvementName: improvementName });
			});
			this.elements.improvementRows = result;
		},
		
		initWorkers: function () {
			let $table = $("#in-assign-workers");
			let trs = "";
			
			for (let key in CampConstants.workerTypes) {
				let def = CampConstants.workerTypes[key];
				let tds = "";
				let displayName = CampConstants.getWorkerDisplayName(key);
				tds += "<td class='in-assign-worker-desc'><div class='info-callout-target info-callout-target-small'>" + displayName + "</div></td>";
				tds += "<td><div class='stepper' id='stepper-" + def.id + "'></div></td>";
				tds += "<td class='in-assign-worker-limit'><div class='info-callout-target info-callout-target-small'></div></td>"
				tds += "<td class='in-assign-worker-auto'><input type='checkbox' id='in-assing-worker-auto-" + def.id + "' class='in-assign-workers-auto-toggle' title='Auto-assign worker' /></td>"
				
				trs += "<tr id='in-assign-" + key + "'>" + tds + "</tr>";
			}
			
			$table.append(trs);
			
			$("#in-assign-workers .in-assign-workers-auto-toggle").change({ sys: this }, this.onAutoAssignWorkerToggled);
		},

		updateImprovements: function () {
			if (GameGlobals.gameState.uiStatus.isHidden) return;
			if (!this.playerLocationNodes.head) return;
			var isActive = GameGlobals.gameState.uiStatus.currentTab === GameGlobals.uiFunctions.elementIDs.tabs.in;
			var campCount = GameGlobals.gameState.numCamps;

			let improvements = this.playerLocationNodes.head.entity.get(SectorImprovementsComponent);
			let hasTradePost = improvements.getCount(improvementNames.tradepost) > 0;
			let hasDeity = GameGlobals.tribeHelper.hasDeity();
			let isSmallLayout = $("body").hasClass("layout-small");

			var availableBuildingCount = 0;
			var visibleBuildingCount = 0;

			for (let i = 0; i < this.elements.improvementRows.length; i++) {
				var elem = this.elements.improvementRows[i];
				var buildAction = elem.action;
				var improveAction = elem.improveAction;
				var improvementName = elem.improvementName;
				var improvementID = ImprovementConstants.getImprovementID(improvementName);
				var actionAvailable = GameGlobals.playerActionsHelper.checkAvailability(buildAction, false);
				var existingImprovements = improvements.getCount(improvementName);
				
				var useAction = "use_in_" + improvementID;
				var useActionExtra = "use_in_" + improvementID + "_2";
				var hasUseActionExtra = PlayerActionConstants.hasAction(useActionExtra);
				var useActionAvailable = GameGlobals.playerActionsHelper.isRequirementsMet(useAction, null, [ PlayerActionConstants.DISABLED_REASON_BUSY ]);
				var useAction2Available = hasUseActionExtra && GameGlobals.playerActionsHelper.isRequirementsMet(useActionExtra, null, [ PlayerActionConstants.DISABLED_REASON_BUSY ]);
				
				var improvementLevel = improvements.getLevel(improvementName);
				var maxImprovementLevel = GameGlobals.campHelper.getCurrentMaxImprovementLevel(improvementName);
				var majorImprovementLevel = GameGlobals.campHelper.getCurrentMajorImprovementLevel(improvements, improvementName);
				var isNextLevelMajor = GameGlobals.campHelper.getNextMajorImprovementLevel(improvements, improvementName) > majorImprovementLevel;
				
				elem.count.text(existingImprovements);
				elem.count.toggleClass("badge-disabled", existingImprovements < 1);
				elem.level.text(improvementLevel);
				elem.level.toggleClass("badge-disabled", existingImprovements < 1 || !improveAction || maxImprovementLevel <= 1);
				
				elem.btnBuild.find(".btn-label").text(Text.t(ImprovementConstants.getImprovementDisplayNameKey(improvementID, improvementLevel)));
				elem.btnImprove.find(".btn-label").text(isNextLevelMajor ? "▲" : "△")

				let isVisible = this.isImprovementRowVisible(elem, existingImprovements, campCount, hasTradePost, hasDeity).isVisible;
				let showUseAction2 = (useAction2Available || GameGlobals.playerActionsHelper.isInProgress(useActionExtra)) && !GameGlobals.playerActionsHelper.isInProgress(useAction);
				let showUseAction1 = useActionAvailable || !showUseAction2;
				let isDamaged = improvements.isDamaged(improvementName);
				
				GameGlobals.uiFunctions.toggle(elem.tr, isVisible);
				GameGlobals.uiFunctions.toggle(elem.btnUse, existingImprovements > 0 && showUseAction1 && !isDamaged);
				GameGlobals.uiFunctions.toggle(elem.btnUse2, existingImprovements > 0 && !showUseAction1 && !isDamaged);
				GameGlobals.uiFunctions.toggle(elem.btnImprove, existingImprovements > 0 && maxImprovementLevel > 1 && !isDamaged);
				GameGlobals.uiFunctions.toggle(elem.btnDismantle, existingImprovements > 0);
				GameGlobals.uiFunctions.toggle(elem.btnRepair, isDamaged);
				GameGlobals.uiFunctions.toggle(elem.iconDamaged, isDamaged);
				
				if (isDamaged) {
					// TODO turn it into a normal callout
					// TODO explain effect (reduced defences / production)
					let numBuilt = improvements.getCount(improvementName);
					let numDamaged = improvements.getNumDamaged(improvementName);
					let damagedSource = improvements.getVO(improvementName).damagedSource;
					let damageDescription = "Building damaged";
					if (damagedSource) {
						damageDescription += " by " + damagedSource;
					}
					if (numBuilt > 1) {
						damageDescription += " (" + numDamaged + "/" + numBuilt + ")";
					}
					elem.iconDamaged.attr("alt", damageDescription);
					elem.iconDamaged.attr("title", damageDescription);
					
				}
				
				if (isVisible) visibleBuildingCount++;
				if (actionAvailable) availableBuildingCount++;
			}

			this.availableBuildingCount = availableBuildingCount;
			if (isActive) this.lastShownAvailableBuildingCount = this.availableBuildingCount;
			this.visibleBuildingCount = visibleBuildingCount;
			if (isActive) this.lastShownVisibleBuildingCount = this.visibleBuildingCount;
		},

		// whether a building has a row in the improvements table at all: it can be built
		// now, one already stands, or it is blocked for a reason worth naming. Shared with
		// the buildings popup so the list and the table can never disagree about what the
		// camp knows how to build.
		//
		// canBuild is the narrower question the popup asks: is putting another one up a
		// thing this camp could do at all? A camp that already has its one campfire keeps
		// the table row for the count and the use buttons, but has nothing left to build
		isImprovementRowVisible: function (elem, existingImprovements, campCount, hasTradePost, hasDeity) {
			let requirementCheck = GameGlobals.playerActionsHelper.checkRequirements(elem.action, false, null);
			let buildActionEnabled = requirementCheck.value >= 1;
			let showActionDisabledReason = false;
			if (!buildActionEnabled) {
				switch (requirementCheck.reason.baseReason) {
					case PlayerActionConstants.DISABLED_REASON_LOCKED_RESOURCES:
					case PlayerActionConstants.DISABLED_REASON_NOT_REACHABLE_BY_TRADERS:
					case PlayerActionConstants.DISABLED_REASON_IN_PROGRESS:
					case PlayerActionConstants.DISABLED_REASON_EXPOSED:
					case PlayerActionConstants.DISABLEd_REASON_RAID:
						showActionDisabledReason = true;
				}
			}

			let commonVisibilityRule = (buildActionEnabled || existingImprovements > 0 || showActionDisabledReason);
			let specialVisibilityRule = true;
			// TODO get rid of these & move to requirements
			// TODO check TR ids after improvements table remake
			if (elem.id === "in-improvements-shrine") specialVisibilityRule = hasDeity;
			if (elem.id === "in-improvements-tradepost") specialVisibilityRule = campCount > 1;
			if (elem.id === "in-improvements-market") specialVisibilityRule = hasTradePost;
			if (elem.id === "in-improvements-inn") specialVisibilityRule = hasTradePost;
			return {
				isVisible: specialVisibilityRule && commonVisibilityRule,
				canBuild: specialVisibilityRule && (buildActionEnabled || showActionDisabledReason),
			};
		},

		// BUILDINGS POPUP (hotkey B)
		//
		// A two-level menu for everything a camp does with its buildings: B opens a
		// chooser (Build, Improve, Action), a letter or a digit opens one of the three
		// numbered lists, and a digit on a list presses that row. "B A 2" is the second
		// action; "B B 3" the third building. Rows do not act on their own - they press
		// the improvements table's own button, so cooldowns, durations and the busy
		// counter behave exactly as if the table were clicked.
		//
		// The menu stays open after a press, so several things can be done in one
		// visit. That is why #buildings-popup carries popup-nopause: the ordinary
		// popup pause would freeze the very timers the player is watching. Esc backs
		// out one level, Shift+Esc and the Close button leave at once.

		BUILDINGS_POPUP_SCREENS: [ "build", "improve", "action" ],
		BUILDINGS_TOOLTIP_DELAY: 450,
		BUILDINGS_TOOLTIP_CURSOR_GAP: 14,
		BUILDINGS_TOOLTIP_EDGE_MARGIN: 8,

		initBuildingsPopup: function () {
			let sys = this;
			this.buildingsPopupOpen = false;
			this.buildingsPopupScreen = "menu";
			this.buildingsPopupCursor = 0;
			this.buildingsPopupCursorByScreen = {};
			this.buildingsPopupRows = [];
			this.buildingsPopupShowUnavailable = { build: false, improve: false, action: false };
			this.buildingsPopupReopen = null;
			this.buildingsTooltipTimeout = null;
			this.buildingsTooltipCursor = null;

			$("#buildings-popup-close").click(function () {
				sys.closeBuildingsPopup();
			});
			$("#buildings-popup-back").click(function () {
				sys.onBuildingsPopupBack();
			});
			$("#buildings-popup-show-unavailable").change(function () {
				let screen = sys.buildingsPopupScreen;
				if (sys.BUILDINGS_POPUP_SCREENS.indexOf(screen) < 0) return;
				sys.buildingsPopupShowUnavailable[screen] = $(this).is(":checked");
				sys.renderBuildingsPopupList();
			});

			$("#buildings-popup-header-hint-text").text(UIConstants.isTouchScreen() ? "tap for help" : "hover for details");

			let $list = $("#buildings-popup-list");
			$list.on("click", ".buildings-popup-row", function (e) {
				if ($(e.target).closest(".buildings-popup-info").length > 0) return;
				let index = parseInt($(this).attr("data-index"));
				if (isNaN(index)) return;
				sys.setBuildingsPopupCursor(index);
				sys.activateBuildingsPopupRow();
			});

			// tooltips: hover with a delay on a mouse, the row's info glyph on touch.
			// the checkbox line takes part as row -1, like the craft popup's toggle
			let tooltipTargets = ".buildings-popup-row, #buildings-popup-toggle-container, #buildings-popup-header-hint";
			let rowIndexOf = function (el) {
				let $el = $(el);
				if ($el.is("#buildings-popup-toggle-container")) return -1;
				if ($el.is("#buildings-popup-header-hint")) return -2;
				let index = parseInt($el.attr("data-index"));
				return isNaN(index) ? null : index;
			};
			$("#buildings-popup").on("mouseenter", tooltipTargets, function (e) {
				if (UIConstants.isTouchScreen()) return;
				let index = rowIndexOf(this);
				if (index === null) return;
				sys.cancelBuildingsTooltip();
				sys.buildingsTooltipCursor = { x: e.clientX, y: e.clientY };
				sys.buildingsTooltipTimeout = setTimeout(function () {
					sys.buildingsTooltipTimeout = null;
					sys.showBuildingsTooltip(index);
				}, sys.BUILDINGS_TOOLTIP_DELAY);
			});
			$("#buildings-popup").on("mousemove", tooltipTargets, function (e) {
				sys.buildingsTooltipCursor = { x: e.clientX, y: e.clientY };
			});
			$("#buildings-popup").on("mouseleave", tooltipTargets, function () {
				if (UIConstants.isTouchScreen()) return;
				sys.hideBuildingsTooltip();
			});
			$("#buildings-popup").on("click", ".buildings-popup-info", function (e) {
				e.stopPropagation();
				let index = rowIndexOf($(this).closest(tooltipTargets));
				if (index === null) return;
				sys.cancelBuildingsTooltip();
				sys.buildingsTooltipCursor = { x: e.clientX, y: e.clientY };
				if ($("#buildings-tooltip").is(":visible") && sys.buildingsTooltipIndex === index) {
					sys.hideBuildingsTooltip();
				} else {
					sys.showBuildingsTooltip(index);
				}
			});
			$list.on("scroll", function () { sys.hideBuildingsTooltip(); });

			// the letter's keydown opens the popup so the keys typed right after it land
			// in the menu; the registered hotkey stays as the keyup fallback
			$(document).on("keydown.buildingsopen", $.proxy(this.onDocumentKeyDownBuildings, this));
		},

		onDocumentKeyDownBuildings: function (e) {
			let oe = e.originalEvent || e;
			if (oe.repeat) return;
			if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
			if (oe.code != "KeyB") return;
			if (oe.isTextInput) return;
			if (!GameGlobals.gameState.settings.hotkeysEnabled) return;
			if (GameGlobals.gameState.uiStatus.currentTab != GameGlobals.uiFunctions.elementIDs.tabs.in) return;
			if (GameGlobals.uiFunctions.popupManager.hasOpenPopup()) return;
			let tagName = e.target ? e.target.tagName : null;
			if (tagName == "INPUT" || tagName == "TEXTAREA" || tagName == "SELECT") return;
			this.onOpenBuildingsPopup();
		},

		// "B for menu" when the key works, plain "menu" on touch or with hotkeys off
		updateBuildingsMenuHint: function () {
			let hasKey = GameGlobals.gameState.settings.hotkeysEnabled && !UIConstants.isTouchScreen();
			let text = hasKey ? "B for menu" : "menu";
			let $hint = $("#in-improvements-menu-hint");
			if ($hint.text() != text) $hint.text(text);
		},

		onOpenBuildingsPopup: function (screen) {
			// the letter's keydown opens the popup and its keyup fires the registered
			// hotkey fallback before the popup reads as open, so guard with a flag
			if (this.buildingsPopupOpen) return;
			if (GameGlobals.gameState.uiStatus.isHidden) return;
			if (GameGlobals.uiFunctions.popupManager.hasOpenPopup()) return;
			if (!this.playerLocationNodes.head) return;
			if (!this.playerPosNodes.head || !this.playerPosNodes.head.position.inCamp) return;
			if (!GameGlobals.uiFunctions.showTabById(GameGlobals.uiFunctions.elementIDs.tabs.in)) return;

			let sys = this;
			this.buildingsPopupOpen = true;
			this.buildingsPopupSwallowEscapeUp = false;

			GameGlobals.uiFunctions.showSpecialPopup("buildings-popup", {
				isMeta: false,
				isDismissable: true,
				setupCallback: () => sys.showBuildingsPopupScreen(screen || "menu"),
			});

			// bound at open, not when the popup becomes visible: keys typed while the
			// popup is still fading in must land in the menu, not be dropped
			$(document).on("keydown.buildingspopup", $.proxy(this.onBuildingsPopupKeyDown, this));

			// Esc is consumed on keydown (back one level), but the universal "Dismiss
			// popup" hotkey fires on keyup and would close the popup anyway. A capture
			// listener stops that one keyup before jQuery's document handler sees it
			if (!this._onBuildingsKeyUpCapture) {
				this._onBuildingsKeyUpCapture = function (e) {
					if (e.code != "Escape") return;
					if (!sys.buildingsPopupSwallowEscapeUp) return;
					sys.buildingsPopupSwallowEscapeUp = false;
					e.stopPropagation();
				};
			}
			document.addEventListener("keyup", this._onBuildingsKeyUpCapture, true);
		},

		closeBuildingsPopup: function () {
			if (!this.buildingsPopupOpen) return;
			this.hideBuildingsTooltip();
			GameGlobals.uiFunctions.popupManager.closePopup("buildings-popup");
		},

		onPopupClosed: function (popupID) {
			if (popupID == "buildings-popup") {
				this.buildingsPopupOpen = false;
				$(document).off("keydown.buildingspopup");
				if (this._onBuildingsKeyUpCapture) document.removeEventListener("keyup", this._onBuildingsKeyUpCapture, true);
				this.hideBuildingsTooltip();
				return;
			}
			// return to the menu after the popup a row's button raised has closed
			if (this.buildingsPopupReopen) {
				let reopen = this.buildingsPopupReopen;
				this.buildingsPopupReopen = null;
				this.buildingsPopupCursorByScreen[reopen.screen] = reopen.cursor;
				this.onOpenBuildingsPopup(reopen.screen);
			}
		},

		// popups do not stack: when a row's button raises one (a confirmation, a result),
		// the menu steps aside and comes back on the same screen once it has closed
		onPopupOpened: function (popupID) {
			if (!this.buildingsPopupOpen) return;
			if (popupID == "buildings-popup") return;
			this.buildingsPopupReopen = { screen: this.buildingsPopupScreen, cursor: this.buildingsPopupCursor };
			this.closeBuildingsPopup();
		},

		isBuildingsPopupVisible: function () {
			if (!$("#buildings-popup").is(":visible")) return false;
			if ($("#buildings-popup").attr("data-visible") != "true") return false;
			if (GameGlobals.uiFunctions.popupManager.isClosing("buildings-popup")) return false;
			return true;
		},

		// SCREENS

		showBuildingsPopupScreen: function (screen) {
			if (this.buildingsPopupScreen && this.BUILDINGS_POPUP_SCREENS.indexOf(this.buildingsPopupScreen) >= 0) {
				this.buildingsPopupCursorByScreen[this.buildingsPopupScreen] = this.buildingsPopupCursor;
			}
			this.hideBuildingsTooltip();
			this.buildingsPopupScreen = screen;
			let isMenu = screen == "menu";

			let titles = { menu: "", build: "Build", improve: "Improve", action: "Action" };
			$("#buildings-popup-header-screen").text(isMenu ? "" : " › " + titles[screen]);
			GameGlobals.uiFunctions.toggle("#buildings-popup-back", !isMenu);
			GameGlobals.uiFunctions.toggle("#buildings-popup-hint-menu", isMenu);
			GameGlobals.uiFunctions.toggle("#buildings-popup-hint-list", !isMenu);
			$("#buildings-popup-hint-verb").text(screen == "build" ? "build" : screen == "improve" ? "improve" : "do");

			if (!isMenu) {
				$("#buildings-popup-show-unavailable").prop("checked", this.buildingsPopupShowUnavailable[screen] == true);
			}

			let restoredCursor = isMenu ? 0 : this.buildingsPopupCursorByScreen[screen];
			this.renderBuildingsPopupList(typeof restoredCursor == "number" ? restoredCursor : 0);
		},

		onBuildingsPopupBack: function () {
			if (!this.buildingsPopupOpen) return;
			if (this.buildingsPopupScreen == "menu") {
				this.closeBuildingsPopup();
				return;
			}
			let previous = this.buildingsPopupScreen;
			this.showBuildingsPopupScreen("menu");
			this.setBuildingsPopupCursor(Math.max(0, this.BUILDINGS_POPUP_SCREENS.indexOf(previous)));
		},

		// ENTRIES
		//
		// every entry has: key (stable id for keeping the cursor across renders), name,
		// action, $btn (the table button the row presses), available (pressing it now
		// does something), hidden (only shown with "Show unavailable"), reason (why not)

		getBuildingsMenuEntries: function () {
			let counts = {
				build: this.getBuildingsBuildEntries().filter(e => !e.hidden).length,
				improve: this.getBuildingsImproveEntries().filter(e => !e.hidden).length,
				action: this.getBuildingsActionEntries().filter(e => !e.hidden).length,
			};
			return [
				{ key: "build", screen: "build", letter: "B", name: "Build", count: counts.build, description: "Put up a new building, or another of one the camp has", available: true, hidden: false },
				{ key: "improve", screen: "improve", letter: "I", name: "Improve", count: counts.improve, description: "Raise the level of a building that stands", available: true, hidden: false },
				{ key: "action", screen: "action", letter: "A", name: "Action", count: counts.action, description: "Use a building: rest, sit down, get treatment and the like", available: true, hidden: false },
			];
		},

		// the requirement check without costs; "blocked" means blocked by something
		// other than what the player can afford, which is what "Show unavailable" hides
		getBuildingsEntryStatus: function (action, name) {
			let reqs = GameGlobals.playerActionsHelper.checkRequirements(action, false);
			let reqsMet = reqs.value >= 1;
			let available = reqsMet && GameGlobals.playerActionsHelper.checkAvailability(action);
			let reason = null;
			if (!reqsMet && reqs.reason) {
				let reasonVO = reqs.reason;
				// the requirement check leaves the name out when it is the action's own
				// building (its button already says it); a list row needs it spelled out
				if (name && reasonVO.textParams && reasonVO.textParams.name === "") {
					reasonVO = { textKey: reasonVO.textKey, textParams: { name: name } };
				}
				reason = Text.t(reasonVO);
			}
			let isBusy = !reqsMet && reqs.reason && (reqs.reason.baseReason == PlayerActionConstants.DISABLED_REASON_BUSY || reqs.reason.baseReason == PlayerActionConstants.DISABLED_REASON_IN_PROGRESS);
			return { available: available, reqsMet: reqsMet, reason: reason, isBusy: isBusy };
		},

		getBuildingsBuildEntries: function () {
			let result = [];
			if (!this.playerLocationNodes.head) return result;
			let improvements = this.playerLocationNodes.head.entity.get(SectorImprovementsComponent);
			let campCount = GameGlobals.gameState.numCamps;
			let hasTradePost = improvements.getCount(improvementNames.tradepost) > 0;
			let hasDeity = GameGlobals.tribeHelper.hasDeity();

			for (let i = 0; i < this.elements.improvementRows.length; i++) {
				let elem = this.elements.improvementRows[i];
				let improvementName = elem.improvementName;
				let improvementID = ImprovementConstants.getImprovementID(improvementName);
				let existing = improvements.getCount(improvementName);
				let visibility = this.isImprovementRowVisible(elem, existing, campCount, hasTradePost, hasDeity);
				if (!visibility.isVisible) continue;

				let level = improvements.getLevel(improvementName);
				let name = Text.t(ImprovementConstants.getImprovementDisplayNameKey(improvementID, level));
				let status = this.getBuildingsEntryStatus(elem.action, name);
				result.push({
					key: "build-" + improvementID,
					name: name,
					action: elem.action,
					$btn: elem.btnBuild,
					improvementID: improvementID,
					count: existing,
					level: level,
					available: status.available,
					// a building blocked only by costs stays in the list, dimmed
					hidden: !status.reqsMet && !status.isBusy,
					reason: status.reason,
					isBusy: status.isBusy,
				});
			}
			return result;
		},

		getBuildingsImproveEntries: function () {
			let result = [];
			if (!this.playerLocationNodes.head) return result;
			let improvements = this.playerLocationNodes.head.entity.get(SectorImprovementsComponent);

			for (let i = 0; i < this.elements.improvementRows.length; i++) {
				let elem = this.elements.improvementRows[i];
				if (!elem.improveAction) continue;
				let improvementName = elem.improvementName;
				let improvementID = ImprovementConstants.getImprovementID(improvementName);
				let existing = improvements.getCount(improvementName);
				if (existing < 1) continue;

				let level = improvements.getLevel(improvementName);
				let maxLevel = GameGlobals.campHelper.getCurrentMaxImprovementLevel(improvementName);
				let isDamaged = improvements.isDamaged(improvementName);
				let majorLevel = GameGlobals.campHelper.getCurrentMajorImprovementLevel(improvements, improvementName);
				let isNextLevelMajor = GameGlobals.campHelper.getNextMajorImprovementLevel(improvements, improvementName) > majorLevel;
				let name = Text.t(ImprovementConstants.getImprovementDisplayNameKey(improvementID, level));
				let status = this.getBuildingsEntryStatus(elem.improveAction, name);
				let reason = status.reason;
				if (isDamaged) reason = "Building damaged";
				else if (maxLevel <= 1 || level >= maxLevel) reason = reason || Text.t(PlayerActionConstants.DISABLED_REASON_MAX_IMPROVEMENT_LEVEL);
				result.push({
					key: "improve-" + improvementID,
					name: name,
					action: elem.improveAction,
					$btn: elem.btnImprove,
					improvementID: improvementID,
					count: existing,
					level: level,
					maxLevel: maxLevel,
					isNextLevelMajor: isNextLevelMajor,
					available: status.available && !isDamaged && maxLevel > 1,
					hidden: isDamaged || maxLevel <= 1 || (!status.reqsMet && !status.isBusy),
					reason: reason,
					isBusy: status.isBusy,
				});
			}
			return result;
		},

		getBuildingsActionEntries: function () {
			let result = [];
			if (!this.playerLocationNodes.head) return result;
			let improvements = this.playerLocationNodes.head.entity.get(SectorImprovementsComponent);

			for (let i = 0; i < this.elements.improvementRows.length; i++) {
				let elem = this.elements.improvementRows[i];
				let improvementName = elem.improvementName;
				let improvementID = ImprovementConstants.getImprovementID(improvementName);
				let existing = improvements.getCount(improvementName);
				if (existing < 1) continue;
				if (improvements.isDamaged(improvementName)) continue;

				let useAction = "use_in_" + improvementID;
				let useActionExtra = useAction + "_2";
				if (!PlayerActionConstants.hasAction(useAction)) continue;

				// the same rule the table uses to show one of the two use buttons
				let hasExtra = PlayerActionConstants.hasAction(useActionExtra);
				let useAvailable = GameGlobals.playerActionsHelper.isRequirementsMet(useAction, null, [ PlayerActionConstants.DISABLED_REASON_BUSY ]);
				let extraAvailable = hasExtra && GameGlobals.playerActionsHelper.isRequirementsMet(useActionExtra, null, [ PlayerActionConstants.DISABLED_REASON_BUSY ]);
				let showExtra = (extraAvailable || GameGlobals.playerActionsHelper.isInProgress(useActionExtra)) && !GameGlobals.playerActionsHelper.isInProgress(useAction);
				let showUse = useAvailable || !showExtra;

				let action = showUse ? useAction : useActionExtra;
				let $btn = showUse ? elem.btnUse : elem.btnUse2;
				let def = ImprovementConstants.improvements[improvementID] || {};
				let actionName = showUse ? def.useActionName : def.useActionName2;
				let level = improvements.getLevel(improvementName);
				let buildingName = Text.t(ImprovementConstants.getImprovementDisplayNameKey(improvementID, level));
				let status = this.getBuildingsEntryStatus(action);
				// a cooling-down action fails the availability check without a reason;
				// the row says how long is left instead of looking unaffordable
				let cooldownLeft = status.available ? 0 : GameGlobals.playerActionsHelper.getCooldownForCurrentLocation(action);
				let isCooldown = !status.available && status.reqsMet && cooldownLeft > 0;
				let reason = status.reason;
				if (isCooldown) reason = "Cooldown " + UIConstants.getTimeToNum(cooldownLeft);
				result.push({
					key: "action-" + action,
					name: actionName || Text.t(GameGlobals.playerActionsHelper.getActionDisplayNameKey(action)),
					buildingName: buildingName,
					action: action,
					$btn: $btn,
					improvementID: improvementID,
					available: status.available,
					hidden: false,
					reason: reason,
					isBusy: status.isBusy,
					isCooldown: isCooldown,
					cooldownLeft: cooldownLeft,
				});
			}
			return result;
		},

		getBuildingsPopupEntries: function (screen) {
			switch (screen) {
				case "menu": return this.getBuildingsMenuEntries();
				case "build": return this.getBuildingsBuildEntries();
				case "improve": return this.getBuildingsImproveEntries();
				case "action": return this.getBuildingsActionEntries();
			}
			return [];
		},

		// RENDERING

		renderBuildingsPopupList: function (cursor) {
			if (!this.buildingsPopupOpen) return;
			let screen = this.buildingsPopupScreen;
			let isMenu = screen == "menu";
			let $list = $("#buildings-popup-list");
			let isTouch = UIConstants.isTouchScreen();

			let entries = this.getBuildingsPopupEntries(screen);
			let numHidden = entries.filter(e => e.hidden).length;
			let showUnavailable = !isMenu && this.buildingsPopupShowUnavailable[screen] == true;
			let hasToggle = !isMenu && numHidden > 0;
			GameGlobals.uiFunctions.toggle("#buildings-popup-toggle-container", hasToggle);
			$("#buildings-popup-show-unavailable-label").text("Show unavailable (" + numHidden + ")");

			let previousKey = null;
			if (typeof cursor != "number") {
				let previousRow = this.buildingsPopupRows ? this.buildingsPopupRows[this.buildingsPopupCursor] : null;
				previousKey = previousRow ? previousRow.key : null;
				cursor = this.buildingsPopupCursor;
			}

			let rows = [];
			let html = "";
			let infoGlyph = isTouch ? "<span class='buildings-popup-info' role='button' aria-label='Details'>&#9432;</span>" : "";
			for (let i = 0; i < entries.length; i++) {
				let entry = entries[i];
				if (entry.hidden && !showUnavailable) continue;
				let index = rows.length;
				rows.push({ key: entry.key, entry: entry });
				let number = index + 1;
				let keyLabel = isMenu ? entry.letter : (number <= 9 ? number : number == 10 ? "0" : "");
				let classes = "buildings-popup-row";
				if (isMenu) classes += " buildings-popup-menu-row";
				if (!entry.available) classes += " buildings-popup-item-unavailable";
				if (entry.hidden) classes += " buildings-popup-item-hidden";
				html += "<div class='" + classes + "' data-index='" + index + "' data-key='" + entry.key + "'>";
				html += "<span class='buildings-popup-key'>" + (keyLabel || "&nbsp;") + "</span>";
				html += "<span class='buildings-popup-item-name'>" + entry.name;
				if (!isMenu && screen == "action") html += "<span class='buildings-popup-item-sub'>" + entry.buildingName + "</span>";
				if (!isMenu && screen == "build" && entry.count > 0) html += "<span class='buildings-popup-item-sub'>" + entry.count + " built" + (entry.level > 1 ? ", lvl " + entry.level : "") + "</span>";
				if (!isMenu && screen == "improve") {
					let atMax = entry.maxLevel <= 1 || entry.level >= entry.maxLevel;
					let levelText = atMax ? "lvl " + entry.level + " (max)" : "lvl " + entry.level + "/" + entry.maxLevel + " &rarr; " + (entry.level + 1) + (entry.isNextLevelMajor ? " &#9650;" : "");
					html += "<span class='buildings-popup-item-sub'>" + levelText + "</span>";
				}
				html += "</span>";
				if (isMenu) {
					html += "<span class='buildings-popup-item-costs header-count'>" + entry.count + "</span>";
				} else {
					let detail = "";
					if (entry.reason && !entry.available && (entry.hidden || entry.isBusy || entry.isCooldown)) {
						detail = "<span class='buildings-popup-item-reason'>" + entry.reason + "</span>";
					} else {
						detail = GameGlobals.uiFunctions.getActionCostsSpanList(entry.action).join(" ");
					}
					html += "<span class='buildings-popup-item-costs'>" + detail + "</span>";
				}
				html += infoGlyph;
				html += "</div>";
			}

			this.buildingsPopupRows = rows;
			this.renderBuildingsPopupResources(rows);

			if (rows.length == 0) {
				let empty = screen == "build" ? "Nothing to build here yet." : screen == "improve" ? "Nothing to improve here yet." : "Nothing to do here yet.";
				html = "<p class='p-meta buildings-popup-empty'>" + empty + "</p>";
			}
			$list.html(html);
			// the list's height changed; keep the popup centred
			GameGlobals.uiFunctions.popupManager.repositionPopup($("#buildings-popup"));

			if (previousKey) {
				for (let i = 0; i < rows.length; i++) {
					if (rows[i].key == previousKey) { cursor = i; break; }
				}
			}
			this.setBuildingsPopupCursor(cursor);
		},

		// the camp's stock of every resource the listed rows cost, in the order the
		// costs first appear, so the player can see what a build would leave without
		// opening a tooltip. Build and Improve only: actions cost time, not stock
		renderBuildingsPopupResources: function (rows) {
			let screen = this.buildingsPopupScreen;
			let show = (screen == "build" || screen == "improve") && rows.length > 0 && !!this.playerLocationNodes.head;
			GameGlobals.uiFunctions.toggle("#buildings-popup-resources", show);
			if (!show) return;

			let sector = this.playerLocationNodes.head.entity;
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
				html += "<span class='buildings-popup-resource' title='" + name + "'>" + label + "<span class='buildings-popup-resource-amount'>" + UIConstants.getDisplayValue(Math.floor(owned)) + "</span></span>";
			}
			$("#buildings-popup-resources").html(html);
		},

		setBuildingsPopupCursor: function (index) {
			let hasToggle = $("#buildings-popup-toggle-container").is(":visible");
			let numRows = this.buildingsPopupRows ? this.buildingsPopupRows.length : 0;
			let min = hasToggle ? -1 : 0;
			if (index < min) index = min;
			if (index >= numRows) index = numRows - 1;
			if (index < min) index = min;

			this.buildingsPopupCursor = index;
			$("#buildings-popup-list .buildings-popup-row").removeClass("selected");
			$("#buildings-popup-toggle-container").toggleClass("selected", index == -1);
			if (index >= 0) {
				let $row = $("#buildings-popup-list .buildings-popup-row[data-index='" + index + "']");
				$row.addClass("selected");
				if ($row.length > 0 && $row[0].scrollIntoView) $row[0].scrollIntoView({ block: "nearest" });
			}
		},

		getBuildingsPopupPageSize: function () {
			let $list = $("#buildings-popup-list");
			let $row = $list.find(".buildings-popup-row").first();
			if ($row.length == 0) return 3;
			let rowHeight = $row.outerHeight(true) || 1;
			return Math.max(3, Math.floor($list.innerHeight() / rowHeight));
		},

		// KEYS

		onBuildingsPopupKeyDown: function (e) {
			if (!this.buildingsPopupOpen) return;
			let oe = e.originalEvent || e;
			let code = oe.code || "";
			let hasModifier = e.ctrlKey || e.altKey || e.metaKey;
			if (hasModifier) return;
			let isMenu = this.buildingsPopupScreen == "menu";
			let numRows = this.buildingsPopupRows ? this.buildingsPopupRows.length : 0;
			let lastIndex = numRows - 1;

			// any key hides the tooltip: the row under it may change
			this.hideBuildingsTooltip();

			if (code == "Escape") {
				e.preventDefault();
				if (e.shiftKey || isMenu) {
					this.closeBuildingsPopup();
				} else {
					this.onBuildingsPopupBack();
				}
				this.buildingsPopupSwallowEscapeUp = true;
				return;
			}

			if (e.shiftKey) return;

			switch (code) {
				case "ArrowDown": e.preventDefault(); this.setBuildingsPopupCursor(this.buildingsPopupCursor + 1); return;
				case "ArrowUp": e.preventDefault(); this.setBuildingsPopupCursor(this.buildingsPopupCursor - 1); return;
				case "Home": e.preventDefault(); this.setBuildingsPopupCursor(0); return;
				case "End": e.preventDefault(); this.setBuildingsPopupCursor(lastIndex); return;
				case "PageDown": e.preventDefault(); this.setBuildingsPopupCursor(Math.min(lastIndex, this.buildingsPopupCursor + this.getBuildingsPopupPageSize())); return;
				case "PageUp": e.preventDefault(); this.setBuildingsPopupCursor(Math.max(0, this.buildingsPopupCursor - this.getBuildingsPopupPageSize())); return;
				case "Enter": case "NumpadEnter": e.preventDefault(); this.activateBuildingsPopupRow(); return;
				case "Backspace": case "ArrowLeft":
					if (!isMenu) { e.preventDefault(); this.onBuildingsPopupBack(); }
					return;
				case "ArrowRight":
					if (isMenu) { e.preventDefault(); this.activateBuildingsPopupRow(); }
					return;
				case "Space":
					// space belongs to the Show unavailable toggle alone; on the chooser
					// it does nothing, so the same key never means two things
					e.preventDefault();
					if (!isMenu) this.toggleBuildingsPopupShowUnavailable();
					return;
			}

			if (isMenu) {
				let letters = { KeyB: 0, KeyI: 1, KeyA: 2, Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 };
				if (letters[code] !== undefined) {
					e.preventDefault();
					this.setBuildingsPopupCursor(letters[code]);
					this.activateBuildingsPopupRow();
				}
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
				this.setBuildingsPopupCursor(index);
				this.activateBuildingsPopupRow();
			}
		},

		toggleBuildingsPopupShowUnavailable: function () {
			if (!$("#buildings-popup-toggle-container").is(":visible")) return;
			$("#buildings-popup-show-unavailable").click();
		},

		activateBuildingsPopupRow: function (retries) {
			if (!this.buildingsPopupOpen) return;
			// the popup is not really open until showSpecialPopup's fadeIn sets data-visible;
			// a press inside that window is kept and retried rather than dropped, so a fast
			// "B A 2" lands its last key too
			if (!this.isBuildingsPopupVisible()) {
				retries = retries || 0;
				if (retries < 20) setTimeout(() => this.activateBuildingsPopupRow(retries + 1), 25);
				return;
			}

			if (this.buildingsPopupCursor == -1) {
				this.toggleBuildingsPopupShowUnavailable();
				return;
			}

			let row = this.buildingsPopupRows ? this.buildingsPopupRows[this.buildingsPopupCursor] : null;
			if (!row) return;

			if (this.buildingsPopupScreen == "menu") {
				this.showBuildingsPopupScreen(row.entry.screen);
				return;
			}

			let entry = row.entry;
			let $btn = entry.$btn;
			let canPress = entry.available && $btn && $btn.length > 0 && $btn.is(":visible") && !$btn.hasClass("btn-disabled");
			if (!canPress) {
				this.flashBuildingsPopupUnavailable(this.buildingsPopupCursor);
				return;
			}

			this.hideBuildingsTooltip();
			$btn.click();
			// the press changed what the list shows: counts, levels, costs, busy state
			this.renderBuildingsPopupList();
		},

		// highlight the name and the lacking costs of an unavailable row for a moment
		flashBuildingsPopupUnavailable: function (rowIndex) {
			let $row = $("#buildings-popup-list .buildings-popup-row[data-index='" + rowIndex + "']");
			if ($row.length == 0) return;
			$row.addClass("buildings-popup-flash");
			setTimeout(function () { $row.removeClass("buildings-popup-flash"); }, 1000);
		},

		// TOOLTIPS
		// one body-level fixed pane (#buildings-tooltip) like the upgrade tree's

		cancelBuildingsTooltip: function () {
			if (this.buildingsTooltipTimeout) {
				clearTimeout(this.buildingsTooltipTimeout);
				this.buildingsTooltipTimeout = null;
			}
		},

		hideBuildingsTooltip: function () {
			this.cancelBuildingsTooltip();
			this.buildingsTooltipIndex = null;
			let $tooltip = $("#buildings-tooltip");
			if ($tooltip.length == 0) return;
			$tooltip.hide().attr("aria-hidden", "true").empty();
		},

		showBuildingsTooltip: function (index) {
			let $tooltip = $("#buildings-tooltip");
			if ($tooltip.length == 0) return;
			let $content = this.getBuildingsTooltipContent(index);
			if (!$content) return;

			this.buildingsTooltipIndex = index;
			$tooltip.empty().append($content);
			$tooltip.css({ left: "0px", top: "0px" }).show().attr("aria-hidden", "false");
			GameGlobals.uiFunctions.positionTooltipAtCursor($tooltip, this.buildingsTooltipCursor, this.BUILDINGS_TOOLTIP_CURSOR_GAP, this.BUILDINGS_TOOLTIP_EDGE_MARGIN);
		},

		getBuildingsTooltipContent: function (index) {
			let screen = this.buildingsPopupScreen;
			let $content = $("<div></div>");
			let addHeader = function (name, badge) {
				let $header = $("<div class='buildings-tooltip-header'></div>");
				$header.append($("<span></span>").text(name));
				if (badge) {
					$header.append(" ");
					$header.append($("<span class='status-badge'></span>").text(badge));
				}
				$content.append($header);
			};
			let addLine = function (text, cls) {
				if (!text) return;
				$content.append($("<p></p>").addClass(cls || "").text(text));
			};
			let addHTML = function (html, cls) {
				if (!html) return;
				$content.append($("<p></p>").addClass(cls || "").html(html));
			};

			if (index == -2) {
				let isTouch = UIConstants.isTouchScreen();
				addHeader("Buildings menu");
				addLine(isTouch ? "Tap a row's \u24d8 for what it does, what it costs and why it is blocked." : "Hover any row for what it does, what it costs and why it is blocked.");
				addHTML("<span class='meta'>B, I, A or 1-3: open a list &middot; number or enter: pick a row<br/>arrows, pgup/pgdn, home/end: move &middot; space: show unavailable<br/>esc: back &middot; &#8679;esc: close</span>");
				return $content;
			}

			if (index == -1) {
				addHeader("Show unavailable");
				let what = screen == "build" ? "buildings this camp cannot put up right now: at their limit, not yet unlocked, or damaged" : "buildings at their top level, or damaged";
				addLine("Also list " + what + ". Rows that only lack resources are always shown.");
				addHTML("<span class='meta'>space: toggle</span>");
				return $content;
			}

			let row = this.buildingsPopupRows ? this.buildingsPopupRows[index] : null;
			if (!row) return null;
			let entry = row.entry;

			if (screen == "menu") {
				addHeader(entry.name, entry.count + (entry.count == 1 ? " entry" : " entries"));
				addLine(entry.description);
				addHTML("<span class='meta'>" + entry.letter + " or " + (index + 1) + ": open</span>");
				return $content;
			}

			let badge = entry.available ? "available" : entry.isBusy ? "busy" : entry.isCooldown ? "cooldown" : entry.reason ? entry.reason : "unaffordable";
			if (screen == "build") {
				addHeader(entry.name, badge);
				addLine(ImprovementConstants.getImprovementDescription(entry.improvementID, entry.level), "buildings-tooltip-desc");
				if (entry.count > 0) addLine("Built: " + entry.count + (entry.level > 1 ? " (level " + entry.level + ")" : ""), "meta");
			} else if (screen == "improve") {
				addHeader(entry.name, badge);
				addLine("Level " + entry.level + " → " + (entry.level + 1) + (entry.isNextLevelMajor ? " (major upgrade)" : "") + (entry.maxLevel > 1 ? ", max " + entry.maxLevel : ""), "meta");
				let effect = GameGlobals.playerActionsHelper.getEffectDescription(entry.action);
				addLine(effect, "buildings-tooltip-desc");
			} else {
				addHeader(entry.name, badge);
				addLine(entry.buildingName, "meta");
				let description = GameGlobals.playerActionsHelper.getDescription(entry.action);
				addLine(description, "buildings-tooltip-desc");
				let duration = PlayerActionConstants.getDuration(entry.action);
				let cooldown = PlayerActionConstants.getCooldown(entry.action);
				let timing = [];
				if (duration > 0) timing.push("takes " + UIConstants.getTimeToNum(duration));
				if (cooldown > 0) timing.push("cooldown " + UIConstants.getTimeToNum(cooldown));
				if (timing.length > 0) addLine(timing.join(", "), "meta");
			}

			let costSpans = GameGlobals.uiFunctions.getActionCostsSpanList(entry.action);
			if (costSpans.length > 0) addHTML("Costs: " + costSpans.join(", "));
			if (!entry.available && entry.reason) addHTML("<span class='action-cost-blocker'>" + entry.reason + "</span>");
			let keyLabel = index + 1 <= 9 ? String(index + 1) : index + 1 == 10 ? "0" : null;
			if (keyLabel) addHTML("<span class='meta'>" + keyLabel + " or enter: " + (screen == "build" ? "build" : screen == "improve" ? "improve" : "do it") + "</span>");
			return $content;
		},

		updateEvents: function (isActive) {
			isActive = isActive && !GameGlobals.gameState.uiStatus.isBlocked;
			let campComponent = this.playerLocationNodes.head.entity.get(CampComponent);
			if (!campComponent) return;
			let caravansComponent = this.playerLocationNodes.head.entity.get(OutgoingCaravansComponent);

			let hasEvents = false;
			let hasOther = false;

			let showEvents = campComponent.population >= 1 || GameGlobals.gameState.numCamps > 1;
			GameGlobals.uiFunctions.toggle("#in-occurrences", showEvents);
			
			// Camp actions (buildings, projects)
			let campActions = this.getCampActionData();
			UIList.update(this.campActionList, campActions);
			if (campActions.length > 0) hasEvents = true;

			// Camp occurrences (raids, traiders, visitors)
			let campOccurrences = this.getCampOccurrencesData();
			UIList.update(this.campOccurrencesList, campOccurrences);
			if (campOccurrences.length > 0) hasEvents = true;

			// Miscellaneous
			let campMisc = this.getCampMiscEventsData();
			UIList.update(this.campMiscEventsList, campMisc);
			if (campMisc.length > 0) hasEvents = true;
			
			// Outgoing caravans
			let numCaravans = caravansComponent.outgoingCaravans.length;
			hasOther = hasOther || numCaravans > 0;
			if (isActive && showEvents) {
				GameGlobals.uiFunctions.toggle("#in-occurrences-outgoing-caravans-container", numCaravans > 0);
				UIState.refreshState(this, "outgoing-caravans-num", numCaravans, function () {
					$("#in-occurrences-outgoing-caravans-container").empty();
					for (let i = 0; i < numCaravans; i++) {
						var bar = '';
						bar += '<div id="in-occurrences-outgoing-caravans-' + i + '" class="progress-wrap progress">';
						bar += '<div class="progress-bar progress"></div>';
						bar += '<span class="progress progress-label">Outgoing caravan</span>';
						bar += '</div>';
						$("#in-occurrences-outgoing-caravans-container").append(bar);
					}
					GlobalSignals.elementCreatedSignal.dispatch();
				});
				for (let i = 0; i < numCaravans; i++) {
					let caravan = caravansComponent.outgoingCaravans[i];
					let duration = caravan.returnDuration;
					let timeLeft = GameGlobals.tribeHelper.getTimeLeftForOutgoingCaravan(caravan);
					$("#in-occurrences-outgoing-caravans-" + i).data("progress-percent", (1 - timeLeft / duration) * 100);
				}
			}

			GameGlobals.uiFunctions.toggle("#in-occurrences-empty", showEvents && !hasEvents && !hasOther && isActive);
			
			this.currentEvents = campOccurrences.length;
			if (isActive) this.lastShownEvents = this.currentEvents;
		},
		
		getCampActionData: function () {
			let playerPos = this.playerPosNodes.head.position;
			let playerActionComponent = this.playerPosNodes.head.entity.get(PlayerActionComponent);
			let actions = playerActionComponent.getAllActions();
			let result = [];
			for (let i = 0; i < actions.length; i++) {
				let actionVO = actions[i];
				let action = actionVO.action;
				if (actionVO.isBusy) continue;
				
				let baseActionID = PlayerActionConstants.getBaseActionID(action);
				if (baseActionID == "send_caravan") continue; // shown separately
				
				let improvementName = GameGlobals.playerActionsHelper.getImprovementNameForAction(action, true);
				let improvementType = getImprovementType(improvementName);
				if (improvementType == improvementTypes.camp && actionVO.level != playerPos.level) continue;
				
				let isProject = improvementName && ImprovementConstants.isProject(improvementName);
				let percent = playerActionComponent.getActionCompletionPercentage(action, actionVO.level);

				if (percent >= 100) continue;

				let displayNameTextVO = GameGlobals.playerActionsHelper.getActionDisplayNameLong(action);
				
				result.push({ action: action, improvementName: improvementName, percent: percent, displayName: displayNameTextVO });
			}
			return result;
		},

		getCampOccurrencesData: function () {
			let sector = this.playerLocationNodes.head.entity;
			let eventTimers = sector.get(CampEventTimersComponent);

			let result = [];

			for (let key in OccurrenceConstants.campOccurrenceTypes) {
				let event = OccurrenceConstants.campOccurrenceTypes[key];
				let duration = OccurrenceConstants.getDuration(event);
				if (duration <= 0) continue;
				let hasEvent = GameGlobals.campHelper.hasEvent(sector, event);
				if (!hasEvent) continue;
				let timeLeft = eventTimers.getEventTimeLeft(event);
				let isEventEnding = (duration <= 10 || timeLeft < 5) && timeLeft != OccurrenceConstants.EVENT_DURATION_INFINITE;

				let percent = eventTimers.getEventTimePercentage(event);
				if (percent < 100) {
					result.push({ event: event, percent: percent, isEnding : isEventEnding });
				}
			}

			return result;
		},

		getCampMiscEventsData: function () {
			let result = [];

			let campComponent = this.playerLocationNodes.head.entity.get(CampComponent);
			for (let i = 0; i < campComponent.disabledPopulation.length; i++) {
				let pop = campComponent.disabledPopulation[i];
				if (pop.num > 0) {
					let percent = Math.round((pop.initialTimer - pop.timer) / pop.initialTimer * 100);
					let label = "disabled workers (" + pop.num + ")";
					if (pop.reason == CampConstants.DISABLED_POPULATION_REASON_DISEASE) label = "disease (" + pop.num + ")";
					let isNegative = true;
					let hasTimer = pop.initialTimer != null;
					result.push({ id: "disabled-worker-" + i, label: label, percent: percent, isNegative: isNegative, hasTimer: hasTimer });
				}
			}
			return result;
		},

		updateStats: function () {
			var campComponent = this.playerLocationNodes.head.entity.get(CampComponent);
			if (!campComponent) return;
			
			var levelComponent = this.playerLevelNodes.head.level;
			let sector = this.playerLocationNodes.head.entity;

			var improvements = sector.get(SectorImprovementsComponent);
			var soldiers = sector.get(CampComponent).assignedWorkers.soldier || 0;
			var soldierLevel = GameGlobals.upgradeEffectsHelper.getWorkerLevel("soldier", this.tribeUpgradesNodes.head.upgrades);
			var raidDanger = GameGlobals.campHelper.getCampRaidDanger(sector);
			var raidDefence = OccurrenceConstants.getRaidDefencePoints(improvements, soldiers, soldierLevel);

			let inGameFoundingDate = UIConstants.getInGameDate(campComponent.foundedTimeStampGameTime);
			let showCalendar = this.tribeUpgradesNodes.head.upgrades.hasUpgrade(GameGlobals.upgradeEffectsHelper.getUpgradeIdForUIEffect(UpgradeConstants.upgradeUIEffects.calendar));
			$("#in-demographics-general-age .value").text(inGameFoundingDate);
			GameGlobals.uiFunctions.toggle("#in-demographics-general-age", showCalendar);
			
			let availableLuxuryResources = GameGlobals.campHelper.getAvailableLuxuryResources(sector);
			let availableLuxuryResourcesInfoText = availableLuxuryResources.map(res => TribeConstants.getLuxuryDisplayName(res)).join(", ");
			$("#in-demographics-general-luxuries .value").text(availableLuxuryResources.length);
			UIConstants.updateCalloutContent($("#in-demographics-general-luxuries .info-icon"), availableLuxuryResourcesInfoText, true);
			GameGlobals.uiFunctions.toggle("#in-demographics-general-luxuries", availableLuxuryResources.length > 0);

			let showRaid = raidDanger > 0 || raidDefence > CampConstants.CAMP_BASE_DEFENCE || campComponent.population > 1;
			if (showRaid) {
				let showRaidWarning = raidDanger > CampConstants.REPUTATION_PENALTY_DEFENCES_THRESHOLD;
				let defenceS = OccurrenceConstants.getRaidDefenceString(improvements, soldiers, soldierLevel);
				$("#in-demographics-raid-danger .value").text(Math.round(raidDanger * 100) + "%");
				$("#in-demographics-raid-danger .value").toggleClass("warning", showRaidWarning);
				UIAnimations.animateOrSetNumber($("#in-demographics-raid-defence .value"), true, raidDefence, "", false, Math.round);
				UIConstants.updateCalloutContent("#in-demographics-raid-danger", this.getRaidDangerCalloutContent());
				UIConstants.updateCalloutContent("#in-demographics-raid-defence", defenceS);
			}
			GameGlobals.uiFunctions.toggle("#in-demographics-raid", showRaid);

			let showDisease = campComponent.population > 1;
			if (showDisease) {
				let hasHerbs = GameGlobals.campHelper.hasHerbs(sector);
				let hasMedicine = GameGlobals.campHelper.hasMedicine(sector);
				let apothecaryLevel = GameGlobals.upgradeEffectsHelper.getWorkerLevel("apothecary", this.tribeUpgradesNodes.head.upgrades);
				let diseaseChance = OccurrenceConstants.getDiseaseOutbreakChance(campComponent.population, hasHerbs, hasMedicine, apothecaryLevel);
				let showDiseaseWarning = diseaseChance > CampConstants.REPUTATION_PENALTY_DEFENCES_THRESHOLD; // not related to defences but matching raid warning value
				UIConstants.updateCalloutContent("#in-demographics-disease-chance", this.getDiseaseChanceCalloutContent());
				UIAnimations.animateOrSetNumber($("#in-demographics-disease-chance .value"), true, Math.round(diseaseChance * 100), "%", false, Math.round);
				$("#in-demographics-disease-chance .value").toggleClass("warning", showDiseaseWarning);
			}
			GameGlobals.uiFunctions.toggle("#in-demographics-disease", showDisease);

			var showLevelStats = GameGlobals.gameState.numCamps > 1;
			if (showLevelStats) {
				var levelComponent = this.playerLevelNodes.head.level;
				var hasUnlockedTrade = this.hasUpgrade(GameGlobals.upgradeEffectsHelper.getUpgradeToUnlockBuilding(improvementNames.tradepost));
				$("#in-demographics-level-population .value").text(UIConstants.getFactorLabel(levelComponent.habitability));
				$("#in-demographics-level-danger .value").text(UIConstants.getFactorLabel(levelComponent.raidDangerFactor));
				$("#in-demographics-trade-network").toggle(hasUnlockedTrade);
				if (hasUnlockedTrade) {
					var hasAccessToTradeNetwork = GameGlobals.resourcesHelper.hasAccessToTradeNetwork(this.playerLocationNodes.head.entity);
					$("#in-demographics-trade-network .value").text(hasAccessToTradeNetwork ? "yes" : "no");
					$("#in-demographics-trade-network .value").toggleClass("warning", !hasAccessToTradeNetwork);
				}
			}

			GameGlobals.uiFunctions.toggle("#in-demographics-level", showLevelStats);
			GameGlobals.uiFunctions.toggle("#in-demographics", showCalendar || showRaid || showLevelStats);

			if (GameConstants.isDebugVersion) {
				let debugInfoText = "";
				let campTimers = sector.get(CampEventTimersComponent);
				for (let key in OccurrenceConstants.campOccurrenceTypes) {
					let event = OccurrenceConstants.campOccurrenceTypes[key];
					if (campTimers.eventStartTimers[event]) {
						debugInfoText += "next " + event + " in " + UIConstants.getTimeToNum(campTimers.eventStartTimers[event]) + "<br/>";
					}
					if (campTimers.eventEndTimers[event] && campTimers.eventEndTimers[event] != OccurrenceConstants.EVENT_DURATION_INFINITE) {
						debugInfoText += event + " ends in " + UIConstants.getTimeToNum(campTimers.eventEndTimers[event]) + "<br/>";
					}
				}
				$("#in-demographics-debug-general").html(debugInfoText);
			}
		},

		updateNews: function () {
			let sector = this.playerLocationNodes.head.entity;
			let campComponent = this.playerLocationNodes.head.entity.get(CampComponent);
			if (!campComponent) return;

			let lastEventDescription = null;

			if (campComponent.lastRaid && campComponent.lastRaid.isValid()) {
				lastEventDescription = this.getLastRaidDescription(sector, campComponent, campComponent.lastRaid);
			}

			if (campComponent.lastEvent && campComponent.lastEvent.isValid()) {
				if (!campComponent.lastRaid || campComponent.lastEvent.timestamp > campComponent.lastRaid.timestamp) {
					lastEventDescription = this.getLastEventDescription(sector, campComponent, campComponent.lastEvent);
				}
			}

			let hasLastEvent = lastEventDescription != null;
			lastEventDescription = lastEventDescription || "(none)";

			$("#in-demographics-raid-last .value").text(lastEventDescription);

			GameGlobals.uiFunctions.toggle("#in-demographics-raid-last", hasLastEvent);
		},

		updateLayout: function () {
			let isSmallLayout = $("body").hasClass("layout-small");
			
			$("#in-improvements .action-use").toggleClass("btn-narrow", !isSmallLayout);
			$("#in-improvements .action-use").toggleClass("btn-compact", isSmallLayout);
		},
		
		saveAutoAssignSettings: function () {
			if (!GameGlobals.gameState.unlockedFeatures.workerAutoAssignment) return;
			if (this.playerLocationNodes.head == null) return;
			let campComponent = this.playerLocationNodes.head.entity.get(CampComponent);
			for (let workerType in CampConstants.workerTypes) {
				let $checkbox = $("#in-assing-worker-auto-" + workerType);
				campComponent.autoAssignedWorkers[workerType] = $checkbox.is(':checked');
			}
		},
		
		getLastRaidDescription: function (sector, campComponent, eventVO) {
			let textFragments = [];

			textFragments.push({ textKey: "ui.camp.last_event_raid_message_start" });

			if (campComponent.lastRaid.wasVictory) {
				textFragments.push({ textKey: "ui.camp.last_event_raid_message_victory" });
			} else {
				let resourcesLost = campComponent.lastRaid.resourcesLost;
				let currencyLost = campComponent.lastRaid.currencyLost;
				if (resourcesLost && resourcesLost.getTotal() > 0 || currencyLost > 0) {
					let resourcesTextVO = TextConstants.getResourcesTextVO(resourcesLost, currencyLost);
					let resourcesText = Text.compose(resourcesTextVO);
					textFragments.push({ textKey: "ui.camp.last_raid_lost_message", textParams: { resources: resourcesText } });
				} else {
					textFragments.push({ textKey: "ui.camp.last_raid_lost_no_resources_message" });
				}
			}
			
			let defendersLost = campComponent.lastRaid.defendersLost;
			if (defendersLost > 0) {
				textFragments.push({ textKey: "ui.camp.last_event_lost_defenders_message", textParams: { num: defendersLost } });
			}

			if (eventVO.damagedBuilding != null) {
				textFragments.push(this.getDamagedBuildingDescriptionTextVO(sector, eventVO.damagedBuilding));
			}

			textFragments.push({ rawText: " (" + UIConstants.getTimeSinceText(campComponent.lastRaid.timestamp) + " ago)" });
			
			let textVO = { textFragments: textFragments, delimiter: "ui.common.sentence_separator" };
			return Text.compose(textVO);
		},
		
		getLastEventDescription: function (sector, campComponent, eventVO) {
			let textFragments = [];

			let isNegated = false;
			if (eventVO.eventType == OccurrenceConstants.campOccurrenceTypes.disaster && eventVO.damagedBuilding == null) isNegated = true;

			if (isNegated) {
				textFragments.push({ textKey: "ui.camp.last_event_" + eventVO.eventType + "_message_negated_start", textParams: { type: eventVO.eventSubType } });
			} else {
				textFragments.push({ textKey: "ui.camp.last_event_" + eventVO.eventType + "_message_start", textParams: { type: eventVO.eventSubType } });
			}

			if (eventVO.damagedBuilding != null) {
				textFragments.push(this.getDamagedBuildingDescriptionTextVO(sector, eventVO.damagedBuilding));
			}

			if (eventVO.workersDisabled > 0) {
				textFragments.push({ textKey: "ui.camp.last_event_disabled_workers_message", textParams: { num: eventVO.workersDisabled } });
			}

			textFragments.push({ rawText: " (" + UIConstants.getTimeSinceText(eventVO.timestamp) + " ago)" });
			
			let textVO = { textFragments: textFragments, delimiter: "ui.common.sentence_separator" };
			return Text.compose(textVO);
		},

		getDamagedBuildingDescriptionTextVO: function (sector, damagedBuilding) {
			let improvements = sector.get(SectorImprovementsComponent);
			let improvementID = ImprovementConstants.getImprovementID(damagedBuilding);
			let displayName = ImprovementConstants.getImprovementDisplayName(improvementID, improvements.getLevel(damagedBuilding));
			if (damagedBuilding == improvementNames.fortification) {
				return { textKey: "ui.camp.last_event_damaged_fortifications_message" };
			} else if (improvements.getCount(damagedBuilding) == 1) {
				return { textKey: "ui.camp.last_event_damaged_improvement_only_message", textParams: { improvementName: displayName }};
			} else {
				return { textKey: "ui.camp.last_event_damaged_improvement_one_message", textParams: { improvementName: displayName }};
			}
		},

		getWorkerDescription: function (def) {
			let workerLevel = GameGlobals.upgradeEffectsHelper.getWorkerLevel(def.id, this.tribeUpgradesNodes.head.upgrades);
			var improvements = this.playerLocationNodes.head.entity.get(SectorImprovementsComponent);
			var productionS = "";
			var generalConsumptionS =
				"<br/><span class='warning'>water -" + UIConstants.roundValue(GameGlobals.campHelper.getWaterConsumptionPerSecond(1), true, true) + "/s</span>" +
				"<br/><span class='warning'>food -" + UIConstants.roundValue(GameGlobals.campHelper.getFoodConsumptionPerSecond(1), true, true) + "/s</span>";
			var specialConsumptionS = "";
			switch (def.id) {
				case CampConstants.workerTypes.scavenger.id:
					productionS = "metal +" + UIConstants.roundValue(GameGlobals.campHelper.getMetalProductionPerSecond(1, improvements), true, true) + "/s";
					break;
				case CampConstants.workerTypes.trapper.id:
					productionS = "food +" + UIConstants.roundValue(GameGlobals.campHelper.getFoodProductionPerSecond(1, improvements), true, true) + "/s";
					break;
				case CampConstants.workerTypes.water.id:
					productionS = "water +" + UIConstants.roundValue(GameGlobals.campHelper.getWaterProductionPerSecond(1, improvements), true, true) + "/s";
					break;
				case CampConstants.workerTypes.ropemaker.id:
					productionS = "rope +" + UIConstants.roundValue(GameGlobals.campHelper.getRopeProductionPerSecond(1, improvements), true, true) + "/s";
					break;
				case CampConstants.workerTypes.chemist.id:
					productionS = "fuel +" + UIConstants.roundValue(GameGlobals.campHelper.getFuelProductionPerSecond(1, improvements), true, true) + "/s";
					break;
				case CampConstants.workerTypes.rubbermaker.id:
					productionS = "rubber +" + UIConstants.roundValue(GameGlobals.campHelper.getRubberProductionPerSecond(1, improvements), true, true) + "/s";
					break;
				case CampConstants.workerTypes.gardener.id:
					productionS = "herbs +" + UIConstants.roundValue(GameGlobals.campHelper.getHerbsProductionPerSecond(1, improvements), true, true) + "/s";
					break;
				case CampConstants.workerTypes.apothecary.id:
					productionS = "medicine +" + UIConstants.roundValue(GameGlobals.campHelper.getMedicineProductionPerSecond(1, improvements), true, true) + "/s";
					specialConsumptionS = "<br/><span class='warning'>herbs -" + GameGlobals.campHelper.getWorkerHerbsConsumptionPerSecond(1) + "/s</span>";
					break;
				case CampConstants.workerTypes.concrete.id:
					productionS = "concrete +" + UIConstants.roundValue(GameGlobals.campHelper.getConcreteProductionPerSecond(1, improvements), true, true) + "/s";
					specialConsumptionS = "<br/><span class='warning'>metal -" + GameGlobals.campHelper.getMetalConsumptionPerSecondConcrete(1) + "/s</span>";
					break;
				case CampConstants.workerTypes.toolsmith.id:
					productionS = "tools +" + UIConstants.roundValue(GameGlobals.campHelper.getToolsProductionPerSecond(1, improvements), true, true) + "/s";
					specialConsumptionS = "<br/><span class='warning'>metal -" + GameGlobals.campHelper.getMetalConsumptionPerSecondSmith(1) + "/s</span>";
					break;
				case CampConstants.workerTypes.robotmaker.id:
					let robotVal = GameGlobals.campHelper.getRobotsProductionPerSecond(1, improvements);
					let robotValDivisor = robotVal < 0.01 ? 10000 : null;
					productionS = "robots +" + UIConstants.roundValue(robotVal, true, true, robotValDivisor) + "/s";
					specialConsumptionS = "<br/><span class='warning'>tools -" + GameGlobals.campHelper.getToolsConsumptionPerSecondRobots(1) + "/s</span>";
					break;
				case CampConstants.workerTypes.scientist.id:
					productionS = "evidence +" + UIConstants.roundValue(GameGlobals.campHelper.getEvidenceProductionPerSecond(1, improvements), true, true, 1000) + "/s";
					break;
				case CampConstants.workerTypes.cleric.id:
					productionS = "hope +" + UIConstants.roundValue(GameGlobals.campHelper.getHopeProductionPerSecond(1, improvements), true, true, 100000) + "/s";
					break;
				case CampConstants.workerTypes.soldier.id:
					var soldierLevel = GameGlobals.upgradeEffectsHelper.getWorkerLevel("soldier", this.tribeUpgradesNodes.head.upgrades);
					let barracksLevel = improvements.getLevel(improvementNames.barracks);
					productionS = "camp defence +" + CampConstants.getSoldierDefence(soldierLevel, barracksLevel);
					break;
				default:
					log.w("no description defined for worker type: " + def.id);
					break;
			}
			return "Level " + workerLevel + "<br/>" + productionS + generalConsumptionS + specialConsumptionS;
		},

		getPopulationDecreaseHint: function () {
			let camp = this.playerLocationNodes.head.entity;
			let reputationComponent = camp.get(ReputationComponent);
			if (!reputationComponent) return null;
			if (!reputationComponent.targetValueSources) return null;
			
			let mainSource = null;
			for (let i in reputationComponent.targetValueSources) {
				let source = reputationComponent.targetValueSources[i];
				if (source.amount > 0) continue;
				if (source.source == CampConstants.REPUTATION_SOURCE_LEVEL_POP) continue;
				if (!mainSource || (mainSource.amount > source.amount) || mainSource.isStatic && !source.isStatic) {
					mainSource = source;
				}
			}

			if (!mainSource) return null;

			return mainSource.source;
		},

		getRaidDangerCalloutContent: function () {
			let levelComponent = this.playerLevelNodes.head.level;
			let sector = this.playerLocationNodes.head.entity;
			let improvements = sector.get(SectorImprovementsComponent);
			let soldiers = sector.get(CampComponent).assignedWorkers.soldier || 0;
			let soldierLevel = GameGlobals.upgradeEffectsHelper.getWorkerLevel("soldier", this.tribeUpgradesNodes.head.upgrades);

			let dangerPoints = OccurrenceConstants.getRaidDangerPoints(improvements, levelComponent.raidDangerFactor);
			let defencePoints = OccurrenceConstants.getRaidDefencePoints(improvements, soldiers, soldierLevel);

			let result = Text.t("ui.camp.raid_danger_description");
			result += "<hr/>";
			result += "Danger points: " + dangerPoints + "<br/>";
			result += "Defence points: " + defencePoints + "<br/>";

			return result;
		},

		getDiseaseChanceCalloutContent: function () {
			let sector = this.playerLocationNodes.head.entity;
			let campComponent = sector.get(CampComponent);

			let hasHerbs = GameGlobals.campHelper.hasHerbs(sector);
			let hasMedicine = GameGlobals.campHelper.hasMedicine(sector);
			let apothecaryLevel = GameGlobals.upgradeEffectsHelper.getWorkerLevel("apothecary", this.tribeUpgradesNodes.head.upgrades);

			let result = "Risk that a disease occurring in the camp turns into an outbreak";
			result += "<hr/>";
			result += "Population: " + Math.round(OccurrenceConstants.getDiseaseOutbreakChance(campComponent.population, false, false, 0) * 100) + "%<br/>";

			if (hasMedicine) {
				result += "Medicine: -" + ((1 - OccurrenceConstants.getDiseaseMedicineFactor(hasMedicine, apothecaryLevel)) * 100) + "%<br/>";
			} else if (hasHerbs) {
				result += "Herbs: -" + ((1 - OccurrenceConstants.getDiseaseHerbsFactor()) * 100) + "%<br/>";
			}

			return result;
		},

		sortImprovements: function (a, b) {
			
			let getImprovementSortScore = function (improvementID) {
				let def = ImprovementConstants.improvements[improvementID];
				
				if (def.sortScore) return def.sortScore;
				
				let useAction = "use_in_" + improvementID;
				if (PlayerActionConstants.hasAction(useAction)) return 100;
				
				let improveAction = "improve_in_" + improvementID;
				if (PlayerActionConstants.hasAction(improveAction)) return 10;
				
				var buildAction = "build_in_" + improvementID;
				let max = GameGlobals.campBalancingHelper.getMaxImprovementCountPerSector(improvementID, buildAction);
				if (max == 1) return 1;
				
				return 2;
			};
			
			let scoreA = getImprovementSortScore(a);
			let scoreB = getImprovementSortScore(b);
			
			return scoreB - scoreA;
		},
		
		createCampActionListItem: function () {
			let li = {};
			let div = "<div class='progress-wrap progress' data-animation-length='50'><div class='progress-bar progress'></div><span class='progress progress-label'></span></div>";
			li.$root = $(div);
			li.$label = li.$root.find("span.progress-label");
			return li;
		},
		
		updateCampActionListItem: function (li, data) {
			let displayName = Text.t(data.displayName);
			
			li.$root.data("progress-percent", data.percent);
			li.$label.html(displayName);
		},

		updateCampOccurrenceListItem: function (li, data) {
			let event = data.event;
			let displayName = Text.t("ui.camp.event_" + event + "_name");
			let isNegative = OccurrenceConstants.isNegative(event);
			
			li.$root.data("progress-percent", data.percent);
			li.$root.toggleClass("warning", isNegative);

			li.$label.html(displayName);
			li.$label.toggleClass("event-ending", data.isEnding);
		}, 

		updateCampMiscEventListItem: function (li, data) {
			let displayName = data.label;
			li.$root.data("progress-percent", data.percent);
			li.$root.toggleClass("warning", data.isNegative);
			li.$root.toggleClass("event-no-timer", !data.hasTimer);
			li.$label.html(displayName);
		},
		
		isCampActionListItemDataSame: function (d1, d2) {
			return d1.action == d2.action;
		},

		isCampOccurrenceListItemDataSame: function (d1, d2) {
			return d1.event == d2.event;
		},

		onTabChanged: function () {
			if (GameGlobals.gameState.uiStatus.currentTab === GameGlobals.uiFunctions.elementIDs.tabs.in) {
				this.refresh();
			}
		},

		onImprovementBuilt: function () {
			this.refresh();
		},

		onPlayerPositionChanged: function () {
			this.refresh();
			this.updateCharacters();
		},

		onCampRenamed: function () {
			this.refresh();
		},

		onPopulationChanged: function (entity) {
			if (!this.playerLocationNodes.head) return;
			if (this.playerLocationNodes.head.entity === entity) {
				this.refresh();
				this.updateCharacters();
			}
		},

		onWorkersAssigned: function (entity) {
			if (!this.playerLocationNodes.head) return;
			if (this.playerLocationNodes.head.entity === entity) {
				this.refresh();
				this.updateCharacters();
			}
		},

		onCampEventStarted: function () {
			if (!this.playerLocationNodes.head) return;
			this.refresh();
		},

		onCampEventEnded: function () {
			if (!this.playerLocationNodes.head) return;
			this.refresh();
		},
		
		onAutoAssignWorkerToggled: function (e) {
			if (!GameGlobals.gameState.unlockedFeatures.workerAutoAssignment) return;
			e.data.sys.saveAutoAssignSettings();
			e.data.sys.refresh();
		},

		onGameShown: function () {
			this.refresh();
		},

		hasUpgrade: function (upgradeID) {
			if (!upgradeID) return true;
			return this.tribeUpgradesNodes.head.upgrades.hasUpgrade(upgradeID);
		},

	});

	return UIOutCampSystem;
});
