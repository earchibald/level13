define([
	'ash',
	'text/Text',
	'utils/MathUtils',
	'utils/UIList',
	'game/GameGlobals',
	'game/GlobalSignals',
	'game/constants/ColorConstants',
	'game/constants/GameConstants',
	'game/constants/CampConstants',
	'game/constants/LevelConstants',
	'game/constants/UIConstants',
	'game/constants/ExplorerConstants',
	'game/constants/ItemConstants',
	'game/constants/FightConstants',
	'game/constants/PerkConstants',
	'game/constants/UpgradeConstants',
	'game/constants/PlayerStatConstants',
	'game/systems/SaveSystem',
	'game/nodes/player/PlayerStatsNode',
	'game/nodes/PlayerLocationNode',
	'game/nodes/tribe/TribeUpgradesNode',
	'game/nodes/player/DeityNode',
	'game/components/player/BagComponent',
	'game/components/player/ItemsComponent',
	'game/components/player/PlayerActionComponent',
	'game/components/common/PositionComponent',
	'game/components/common/CampComponent',
	'game/components/common/MovementComponent',
	'game/components/sector/SectorFeaturesComponent',
	'game/components/sector/improvements/SectorImprovementsComponent',
	'game/components/sector/ReputationComponent',
	'game/components/type/LevelComponent',
	'utils/UIState',
	'utils/UIAnimations'
], function (Ash,
	Text,
	MathUtils,
	UIList, 
	GameGlobals, GlobalSignals, 
	ColorConstants, GameConstants, CampConstants, LevelConstants, UIConstants, ExplorerConstants, ItemConstants, FightConstants, PerkConstants, UpgradeConstants, PlayerStatConstants,
	SaveSystem,
	PlayerStatsNode, PlayerLocationNode, TribeUpgradesNode, DeityNode,
	BagComponent,
	ItemsComponent,
	PlayerActionComponent,
	PositionComponent,
	CampComponent,
	MovementComponent,
	SectorFeaturesComponent,
	SectorImprovementsComponent,
	ReputationComponent,
	LevelComponent,
	UIState,
	UIAnimations
) {
	let UIOutHeaderSystem = Ash.System.extend({
		
		context: "UIOutHeaderSystem",

		playerStatsNodes: null,
		deityNodes: null,
		tribeNodes: null,
		currentLocationNodes: null,
		baselinePortraitHeight: null,
		lastViewportHeight: null,
		lastViewportWidth: null,

		// one status bar, and never more - see updateSafeAreaTop
		MAX_SAFE_TOP: 60,
		pendingGameShownRefresh: false,
		engine: null,
		
		previousShownCampResAmount: {},
		previousStats: {},
		previousStatsUpdates: {},
		
		currentThemeTransitionID: null,
		currentThemeTransitionTargetValue: null,

		tabBeforeLandscapeMap: null, // the tab to go back to when the phone comes upright

		pendingResourceUpdateTime: null, // if not null, a resource update has been queued (can be used to trigger update immediately or after a delay)
		pendingResourceBarUpdateTime: null, 
		
		SCAVENGE_BONUS_TYPES: [
			{ itemBonusType: ItemConstants.itemBonusTypes.scavenge_general, displayName: "general", containerID: "scavenge-bonus-general" },
			{ itemBonusType: ItemConstants.itemBonusTypes.scavenge_ingredients, displayName: "ingredients", containerID: "scavenge-bonus-ingredients" },
			{ itemBonusType: ItemConstants.itemBonusTypes.scavenge_supplies, displayName: "supplies", containerID: "scavenge-bonus-supplies" },
		],

		constructor: function () {
			this.initElements();
			
			this.elements = {};
			this.elements.body = $("body");
			this.elements.locationHeader = $("#grid-location-header h1");
			this.elements.gameMsg = $("#game-msg")
			this.elements.gameVersion = $("#game-version");

			this.elements.statIndicatorVision = $(".stat-indicator-vision");
			this.elements.valVision = $(".stat-indicator-vision .value");
			this.elements.changeIndicatorVision = $(".change-indicator-vision");

			this.elements.statIndicatorStamina = $(".stat-indicator-stamina");
			this.elements.valStamina = $(".stat-indicator-stamina .value");
			this.elements.changeIndicatorStamina = $(".change-indicator-stamina");

			this.elements.statIndicatorHealth = $(".stat-indicator-health");
			this.elements.valHealth = $(".stat-indicator-health .value");
			this.elements.changeIndicatorHealth = $(".change-indicator-health");

			this.elements.statIndicatorEvidence = $(".stat-indicator-evidence");
			this.elements.valEvidence = $(".stat-indicator-evidence .value");
			this.elements.changeIndicatorEvidence = $(".change-indicator-evidence");

			this.elements.statIndicatorRumours = $(".stat-indicator-rumours");
			this.elements.valRumours = $(".stat-indicator-rumours .value");
			this.elements.changeIndicatorRumours = $(".change-indicator-rumours");

			this.elements.statIndicatorHope = $(".stat-indicator-hope");
			this.elements.valHope = $(".stat-indicator-hope .value");
			this.elements.changeIndicatorHope = $(".change-indicator-hope");

			this.elements.statIndicatorInsight = $(".stat-indicator-insight");
			this.elements.valInsight = $(".stat-indicator-insight .value");
			this.elements.changeIndicatorInsight = $(".change-indicator-insight");

			this.elements.valReputation = $(".header-camp-reputation .value");
			this.elements.changeIndicatorReputation = $(".header-camp-reputation .change-indicator");
			this.elements.changeIndicatorPopulation = $(".header-camp-population .change-indicator");
			
			this.elements.notificationContainer = $(".notification-player");
			this.elements.notificationBar = $(".notification-player-bar");
			this.elements.notificationLabel = $(".notification-player-bar .progress-label");

			this.pendingResourceUpdateTime = null;
			this.pendingResourceBarUpdateTime = null;
			
			this.updateLayoutMode();

			return this;
		},

		addToEngine: function (engine) {
			this.engine = engine;
			this.playerStatsNodes = engine.getNodeList(PlayerStatsNode);
			this.deityNodes = engine.getNodeList(DeityNode);
			this.tribeNodes = engine.getNodeList(TribeUpgradesNode);
			this.currentLocationNodes = engine.getNodeList(PlayerLocationNode);

			let sys = this;
			GlobalSignals.playerEnteredCampSignal.add(function () { sys.onPlayerEnteredCamp(); });
			GlobalSignals.playerLeftCampSignal.add(function () { sys.onPlayerLeftCamp(); });
			GlobalSignals.actionStartingSignal.add(function () { sys.onActionStarting(); });
			GlobalSignals.actionStartedSignal.add(function () { sys.onInventoryChanged(); });
			GlobalSignals.visionChangedSignal.add(function () { sys.onVisionChanged(); });
			GlobalSignals.tabChangedSignal.add(function () { sys.onTabChanged(); });
			GlobalSignals.healthChangedSignal.add(function () { sys.onHealthChanged(); });
			GlobalSignals.tribeStatsChangedSignal.add(function () { sys.onTribeStatsChanged(); });
			GlobalSignals.inventoryChangedSignal.add(function () { sys.onInventoryChanged(); });
			GlobalSignals.equipmentChangedSignal.add(function () { sys.onEquipmentChanged(); });
			GlobalSignals.explorersChangedSignal.add(function () { sys.onExplorersChanged(); });
			GlobalSignals.actionCompletedSignal.add(function () { sys.onPlayerActionCompleted(); });
			GlobalSignals.elementCreatedSignal.add(function () { sys.onElementCreated(); });
			GlobalSignals.slowUpdateSignal.add(function () { sys.slowUpdate(); });
			GlobalSignals.visualUpdateSignal.add(function () { sys.visualUpdate(); });
			GlobalSignals.changelogLoadedSignal.add(function () { sys.updateGameVersion(); });
			GlobalSignals.logDrawerToggledSignal.add(function () { sys.updateLayout(); });
			GlobalSignals.add(this, GlobalSignals.playerMoveStartedSignal, this.onPlayerMoveStarted);
			GlobalSignals.add(this, GlobalSignals.playerLocationChangedSignal, this.onPlayerLocationChanged);
			GlobalSignals.add(this, GlobalSignals.playerPositionChangedSignal, this.onPlayerPositionChanged);
			GlobalSignals.add(this, GlobalSignals.playerMoveCompletedSignal, this.onPlayerMoveCompleted);
			GlobalSignals.add(this, GlobalSignals.perksChangedSignal, this.onPerksChanged);
			GlobalSignals.add(this, GlobalSignals.storageCapacityChangedSignal, this.onStorageCapacityChanged);
			GlobalSignals.add(this, GlobalSignals.gameResetSignal, this.onGameReset);
			GlobalSignals.add(this, GlobalSignals.gameShownSignal, this.onGameShown);
			GlobalSignals.add(this, GlobalSignals.levelTypeRevealedSignal, this.onLevelTypeRevealed);
			GlobalSignals.add(this, GlobalSignals.improvementBuiltSignal, this.onImprovementBuilt);
			GlobalSignals.add(this, GlobalSignals.workersAssignedSignal, this.queueResourceUpdate);
			GlobalSignals.add(this, GlobalSignals.launchCompletedSignal, this.onLaunchCompleted);
			GlobalSignals.add(this, GlobalSignals.popupClosedSignal, this.onPopupClosed);
			GlobalSignals.add(this, GlobalSignals.windowResizedSignal, this.onWindowResized);
			GlobalSignals.add(this, GlobalSignals.featureUnlockedSignal, this.onFeatureUnlocked);

			this.generateStatsCallouts();
			this.updateGameVersion();
			this.updateVisionStatus();
			this.refreshPerks();
			
			this.updateLayoutMode();
			this.updateLayout();

			// the fixed header and tab bar grow and shrink as rows and tabs show
			// and hide; the content padding that clears them must follow along
			if (window.ResizeObserver) {
				this.headerResizeObserver = new ResizeObserver(function () { sys.updateLayout(); });
				let headerElement = document.getElementById("mobile-header");
				let tabsElement = document.getElementById("grid-switch");
				// the minimap pins to the bottom on the exploration tab, so its
				// height is a layout metric too (see mobile.less)
				let mapElement = document.getElementById("out-container-compass");
				// The bar's height changes with the sector: scout leaves, a collector
				// chip appears. Nothing else resizes, so it is a layout metric of
				// its own.
				//
				// This also runs a second layout pass whenever the bar resizes.
				// The bounce damps itself. updateLayout can change the bar's padding
				// through out-map-hidden, but the next pass's toggleClass is a no-op.
				// Do not "optimise" the second pass away - see updateBottomChromeState.
				let barElement = document.getElementById("out-sector-bar");
				if (headerElement) this.headerResizeObserver.observe(headerElement);
				if (tabsElement) this.headerResizeObserver.observe(tabsElement);
				if (mapElement) this.headerResizeObserver.observe(mapElement);
				if (barElement) this.headerResizeObserver.observe(barElement);
			}
		},

		removeFromEngine: function (engine) {
			if (this.headerResizeObserver) {
				this.headerResizeObserver.disconnect();
				this.headerResizeObserver = null;
			}
			GlobalSignals.removeAll(this);
			this.engine = null;
			this.playerStatsNodes = null;
			this.deityNodes = null;
			this.currentLocationNodes = null;
		},
		
		initElements: function () {
			let statDiv = "";

			// tribe stats
			let tribeStatNames = [ "evidence", "rumours", "hope", "insight" ];
			for (let i = 0; i < tribeStatNames.length; i++) {
				let tribeStatName = tribeStatNames[i];
				let playerStatTextKey = "game.stats." + tribeStatName + "_name";
				statDiv = "";
				statDiv += "<div class='info-callout-target info-callout-target-small'>";
				statDiv += "<div class='stat-indicator stat-indicator-" + tribeStatName + "'>";
				statDiv += "<span class='label text-key' data-text-key='" + playerStatTextKey + "'></span>";
				statDiv += "<span class='value'>0</span>";
				statDiv += "<span class='change-indicator change-indicator-" + tribeStatName + "'><span>";
				statDiv += "</div>";
				statDiv += "</div>";
				$(".statsbar-tribe-stats").append(statDiv);
			}

			// player stats
			let playerStatNames = [ "vision", "health", "stamina", "scavenge-bonus" ];
			for (let i = 0; i < playerStatNames.length; i++) {
				let playerStatName = playerStatNames[i];
				let playerStatTextKey = "game.stats." + playerStatName + "_name";
				if (playerStatName == "scavenge") playerStatTextKey += "_short";

				statDiv = "";
				statDiv += "<div class='info-callout-target-small'>";
				statDiv += "<div class='stat-indicator-" + playerStatName + " stat-indicator'>";
				statDiv += "<span class='label text-key' data-text-key='" + playerStatTextKey + "'></span>";
				statDiv += "<div class='stats-value-container'>";
				statDiv += "<span class='value'>0</span>";
				statDiv += "<span class='change-indicator change-indicator-" + playerStatName + "'><span>";
				statDiv += "</div>";
				statDiv += "</div>";
				statDiv += "</div>";
				$(".player-stats-container").append(statDiv);
			}

			// equipment stats
			for (var bonusKey in ItemConstants.itemBonusTypes) {
				let bonusType = ItemConstants.itemBonusTypes[bonusKey];
				if (!this.showItemBonusTypeInEquipmentStats(bonusType)) continue;
				
				let bonusName = UIConstants.getItemBonusName(bonusType);
				let icons = UIConstants.getIconOrFallback(ItemConstants.getItemBonusIcons(bonusType));
				// The gear stats are an icon and a number and nothing else - no
				// label, unlike every other stat in the header - so what they mean
				// has to come from a tooltip. updateItemStats has always computed
				// that text and handed it to updateCalloutContent, which walks up
				// to the nearest .info-callout-target to put it in; there was
				// never one here, so the text went nowhere on either layout.
				//
				// Wrapping is enough: generateInfoCallouts("body") runs from
				// uiFunctions.init, which is after the ui systems are added, so it
				// builds the callout for these along with everything else.
				let div = "";
				div += "<div class='info-callout-target info-callout-target-small'>";
				div += "<div class='stats-equipment-" + bonusKey + " stat-indicator stat-indicator-secondary'>";
				div += "<img class='stat-icon img-themed' src='" + icons.dark + "' data-src-sunlit='" + icons.sunlit + "' alt='" + bonusName + "'/>";
				div += "<span class='value'/>";
				div += "</div>";
				div += "</div>";

				$(".container-equipment-stats").append(div);
			}
		
			// scavenge stats
			let $container = $("#stats-scavenge-bonus");
			for (let i = 0; i < this.SCAVENGE_BONUS_TYPES.length; i++) {
				let bonus = this.SCAVENGE_BONUS_TYPES[i];
				let div = "<div id='" + bonus.containerID + "'>";
				div += "<span class='label'>" + bonus.displayName + "</span>";
				div += "<div class='stats-value-container'><span class='value'>0</span></div>";
				div += "</div>";
				$container.append(div)
			}
			
			// themed icons (dark/light)
			this.updateThemedIconsCache();

			// vision-based dynamic background items
			this.initDynamicBackgroundItems();

			// perks list
			this.perksListDefault = UIList.create(this, $("#player-perks-list-regular"), this.createPerkListItem, this.updatePerkListItem, this.isPerkListItemDataSame, this.isPerkListItemDataUnchanged);
			this.perksListMobile = UIList.create(this, $("#player-perks-list-mobile"), this.createPerkListItem, this.updatePerkListItem, this.isPerkListItemDataSame, this.isPerkListItemDataUnchanged);
		},

		updateThemedIconsCache: function () {
			let themedIcons = [];
			$.each($("img.img-themed"), function () {
				let pathSunlit =  $(this).attr("data-src-sunlit");
				let pathDark = $(this).attr("data-src-dark") || $(this).attr("src");
				themedIcons.push({
					$elem: $(this),
					pathSunlit: pathSunlit,
					pathDark: pathDark,
				});
			});
			
			this.themedIcons = themedIcons;
		},

		initDynamicBackgroundItems: function () {
			let isSunlit = $("body").hasClass("sunlit");
			if (isSunlit) {
				log.w("can't init dynamic background items while sunlit theme is active");
				return;
			}

			let dynamicBackgroundItems = [];
			let init = function () {
				let background =  $(this).css("background");
				if (!background || background === "none") return;
				dynamicBackgroundItems.push({
					$elem: $(this),
					originalBackgroundDark: background
				});
			};
			$.each($(".vision-background"), init);
			$.each($(".lvl13-box-1"), init);
			$.each($(".lvl13-box-2"), init);

			this.dynamicBackgroundItems = dynamicBackgroundItems;
		},

		generateStatsCallouts: function () {
			$.each($("#statsbar-self .stat-indicator"), function () {
				$(this).wrap("<div class='info-callout-target info-callout-target-small'></div>");
			});
			$.each($("#header-self-bar .stat-indicator"), function () {
				$(this).wrap("<div class='info-callout-target info-callout-target-small'></div>");
			});
			$.each($(".header-camp-storage"), function () {
				$(this).wrap("<div class='info-callout-target'></div>");
			});
			$.each($(".header-camp-reputation"), function () {
				$(this).wrap("<div class='info-callout-target'></div>");
			});
			$.each($(".header-camp-population"), function () {
				$(this).wrap("<div class='info-callout-target'></div>");
			});
		},

		update: function (time) {
			// Before the guards below, and not behind a signal: see
			// pollViewportGeometry for why nothing else asks.
			this.pollViewportGeometry();

			if (!this.currentLocationNodes.head) return;
			if (GameGlobals.gameState.uiStatus.isHidden) return;

			// Both guards above have passed, so the world is there and the
			// game is showing - which is the state onGameShown wanted and did
			// not get. Cleared first, so the re-run cannot set it again and
			// loop.
			if (this.pendingGameShownRefresh) {
				this.pendingGameShownRefresh = false;
				this.onGameShown();
			}

			if (GameGlobals.gameState.isLaunchCompleted) {
				this.updateEndingView();
				return;
			}

			this.updateGameMsg();
			this.updateNotifications();
			this.updatePerks();

			// resource update outside of the regular visual update loop (when something needs feedback immediately or after a delay)
			if (this.pendingResourceUpdateTime != null) {
				this.pendingResourceUpdateTime -= time;
				if (this.pendingResourceUpdateTime <= 0) {
					this.updateResources();
					this.pendingResourceUpdateTime = null;
				}
			}
			
			if (this.pendingResourceBarUpdateTime != null) {
				this.pendingResourceBarUpdateTime -= time;
				if (this.pendingResourceBarUpdateTime <= 0) {
					this.updateResourcesBar();
					this.pendingResourceBarUpdateTime = null;
				}
			}
		},

		slowUpdate: function () {
			if (!this.currentLocationNodes.head) return;
			if (GameGlobals.gameState.uiStatus.isHidden) return;

			var playerPosition = this.playerStatsNodes.head.entity.get(PositionComponent);
			var isInCamp = playerPosition.inCamp;
			this.updateDeity();
			this.updateItems(false, isInCamp);
			this.updateItemStats();
			
			GameGlobals.uiFunctions.updateInfoCallouts("ul.player-perks-list");
		},

		visualUpdate: function () {
			this.updateResources();
			this.updatePlayerStats();
			this.updateCurrency();
		},
		
		updateGameVersion: function () {
			this.elements.gameVersion.text("v. " + GameGlobals.changeLogHelper.getCurrentVersionNumber());
		},

		updatePlayerStats: function () {
			if (GameGlobals.uiFunctions.popupManager.hasOpenPopup()) return;
			if (!this.currentLocationNodes.head) return;
			
			var playerPosition = this.playerStatsNodes.head.entity.get(PositionComponent);
			var isInCamp = playerPosition.inCamp;
			var campComponent = this.currentLocationNodes.head.entity.get(CampComponent);
			var busyComponent = this.playerStatsNodes.head.entity.get(PlayerActionComponent);
			var playerStatsNode = this.playerStatsNodes.head;
			var playerStamina = playerStatsNode.stamina.stamina;
			var playerVision = playerStatsNode.vision.value;
			var maxVision = playerStatsNode.vision.maximum;
			var shownVision = UIConstants.roundValue(playerVision, true, false);
			var maxStamina = UIConstants.roundValue(playerStatsNode.stamina.maxStamina);
			var showStamina = UIConstants.roundValue(Math.min(playerStamina, maxStamina), true, false);
			var isResting = this.isResting();
			var isHealing = busyComponent && busyComponent.getLastActionName() == "use_in_hospital";

			// Vision and health are always in the markup and always current, and
			// which of them the small layout puts on screen is a css decision:
			// the camp header leaves both out and the adventurer button reveals
			// them. Toggling them off here instead would empty the values behind
			// the button as well, which is the one place they are wanted.
			GameGlobals.uiFunctions.toggle(this.elements.statIndicatorVision, true);
			this.elements.valVision.text(shownVision + " / " + maxVision);
			this.updateStatsCallout("Makes exploration safer and scavenging more effective", this.elements.statIndicatorVision, playerStatsNode.vision.accSources);
			this.updateChangeIndicator(this.elements.changeIndicatorVision, maxVision - shownVision, shownVision < maxVision);

			GameGlobals.uiFunctions.toggle(this.elements.statIndicatorHealth, true);
			this.elements.valHealth.text(Math.round(playerStatsNode.stamina.health));
			this.updateHealthStatCallout("Determines maximum stamina", this.elements.statIndicatorHealth);
			let healthAccumulation = playerStatsNode.stamina.healthAccumulation;
			this.updateChangeIndicator(this.elements.changeIndicatorHealth, healthAccumulation, healthAccumulation != 0, false);

			GameGlobals.uiFunctions.toggle($("#stats-stamina"), GameGlobals.gameState.unlockedFeatures.scavenge);
			this.elements.valStamina.text(showStamina + " / " + maxStamina);
			this.updateStatsCallout("Required for exploration", this.elements.statIndicatorStamina, playerStatsNode.stamina.accSources);
			this.updateChangeIndicator(this.elements.changeIndicatorStamina, playerStatsNode.stamina.accumulation, playerStamina < maxStamina, isResting || isHealing);

			this.elements.valVision.toggleClass("warning", playerVision <= 25);
			this.elements.valStamina.toggleClass("warning", playerStamina <= this.staminaWarningLimit);
			this.elements.valHealth.toggleClass("warning", playerStatsNode.stamina.health <= 25);
			
			let showEvidence = GameGlobals.gameState.unlockedFeatures.evidence;
			let showRumours = playerStatsNode.rumours.value > 0 || playerStatsNode.rumours.isAccumulating;
			let showHope = playerStatsNode.hope.hope > 0 || GameGlobals.gameState.unlockedFeatures.hope;
			let hasDeity = GameGlobals.tribeHelper.hasDeity();
			let hasInsight = playerStatsNode.insight.value > 0;
			
			this.updatePlayerStat("rumours", playerStatsNode.rumours, showRumours, playerStatsNode.rumours.value, playerStatsNode.rumours.maxValue, false, this.elements.valRumours, this.elements.changeIndicatorRumours);
			this.updatePlayerStat("evidence", playerStatsNode.evidence, showEvidence, playerStatsNode.evidence.value, playerStatsNode.evidence.maxValue, false, this.elements.valEvidence, this.elements.changeIndicatorEvidence);
			this.updatePlayerStat("hope", playerStatsNode.hope, showHope, playerStatsNode.hope.hope, playerStatsNode.hope.maxHope, false, this.elements.valHope, this.elements.changeIndicatorHope);
			this.updatePlayerStat("insight", playerStatsNode.insight, hasInsight, playerStatsNode.insight.value, playerStatsNode.insight.maxValue, false, this.elements.valInsight, this.elements.changeIndicatorInsight);

			GameGlobals.uiFunctions.toggle($(".statsbar-tribe-stats"), showEvidence || showRumours || hasDeity || hasInsight);

			var improvements = this.currentLocationNodes.head.entity.get(SectorImprovementsComponent);
			var maxPopulation = CampConstants.getHousingCap(improvements);
			var reputationComponent = this.currentLocationNodes.head.entity.get(ReputationComponent);
			if (isInCamp && campComponent && reputationComponent && maxPopulation > 0) {
				var reqReputationCurrent = CampConstants.getRequiredReputation(Math.floor(campComponent.population));
				var reqReputationNext = CampConstants.getRequiredReputation(Math.floor(campComponent.population) + 1);

				this.elements.valReputation.text(UIConstants.roundValue(reputationComponent.value, true, true) + " / " + UIConstants.roundValue(reputationComponent.targetValue, true, true));
				this.updateChangeIndicator(this.elements.changeIndicatorReputation, reputationComponent.accumulation, true);
				let reputationCalloutContent = Text.t("ui.tribe.current_reputatiion_description");
				reputationCalloutContent += "<hr>";
				for (let i in reputationComponent.targetValueSources) {
					let source = reputationComponent.targetValueSources[i];
					if (source.amount !== 0) {
						reputationCalloutContent += this.getTargetValueSourceText(source);
					}
				}
				this.elements.valReputation.toggleClass("warning", reputationComponent.value < reqReputationCurrent);
				UIConstants.updateCalloutContent($(".header-camp-reputation"), reputationCalloutContent);

				$(".header-camp-population .value").text(Math.floor(campComponent.population) + " / " + maxPopulation);
				this.updateChangeIndicator(this.elements.changeIndicatorPopulation, campComponent.populationChangePerSecWithoutCooldown, maxPopulation > 0);
				var populationCalloutContent = "Required reputation:<br/>";
				populationCalloutContent += "current: " + reqReputationCurrent + "<br/>";
				populationCalloutContent += "next: " + reqReputationNext;
				UIConstants.updateCalloutContent($(".header-camp-population"), populationCalloutContent);
				GameGlobals.uiFunctions.toggle(".header-camp-population", true);
				GameGlobals.uiFunctions.toggle(".header-camp-reputation", true);
			} else {
				GameGlobals.uiFunctions.toggle(".header-camp-population", false);
				GameGlobals.uiFunctions.toggle(".header-camp-reputation", false);
			}
			
			let isOnLevelPage = GameGlobals.gameState.uiStatus.currentTab == GameGlobals.uiFunctions.elementIDs.tabs.out;
			let showScavangeAbility = false;//GameGlobals.gameState.unlockedFeatures.scavenge && !isInCamp && isOnLevelPage;
			this.updateScavengeBonus(showScavangeAbility);
		},
		
		getTargetValueSourceText: function (source) {
			let amount = Math.round(source.amount * 10000)/10000;
			if (amount === 0 && source.amount > 0) {
				amount = "< 0.0001";
			}
			let displayValue = amount;
			if (source.isPercentage && source.percentageValue) {
				displayValue = (source.amount > 0 ? "+" : "") + Math.round(source.percentageValue) + "%";
			}
			return source.source + ": " + displayValue + "<br/>";
		},
		
		updateScavengeBonus: function (showScavangeAbility) {
			let scavengeBonusTotal = 0;
			let scavengeBonusByType = {};
			for (let i = 0; i < this.SCAVENGE_BONUS_TYPES.length; i++) {
				let val = (GameGlobals.playerHelper.getCurrentBonus(this.SCAVENGE_BONUS_TYPES[i].itemBonusType) - 1) * 100;
				scavengeBonusTotal += val;
				scavengeBonusByType[this.SCAVENGE_BONUS_TYPES[i].itemBonusType] = val;
			}
			let showScavengeBonus = showScavangeAbility && scavengeBonusTotal > 0;
			GameGlobals.uiFunctions.toggle(".stat-indicator-scavenge-bonus", showScavengeBonus);
			if (showScavengeBonus > 0) {
				let scavengeBonusCallout = "";
				for (let i = 0; i < this.SCAVENGE_BONUS_TYPES.length; i++) {
					let bonus = this.SCAVENGE_BONUS_TYPES[i];
					let value = scavengeBonusByType[bonus.itemBonusType];
					let $container = $("#" + bonus.containerID);
					GameGlobals.uiFunctions.toggle($container, value > 0);
					$container.find(".value").text(Math.round(value) + "%");
					
					let party = this.playerStatsNodes.head.explorers.getParty();
					for (let j = 0; j < party.length; j++) {
						let explorer = party[j];
						let explorerContribution = ExplorerConstants.getExplorerItemBonus(explorer, party, bonus.itemBonusType);
						if (explorerContribution > 0) {
							scavengeBonusCallout += explorer.name + ": +" + Math.round(explorerContribution * 100 - 100) + "%";
						}
					}
					scavengeBonusCallout += "";
				}
				UIConstants.updateCalloutContent($(".stat-indicator-scavenge-bonus"), scavengeBonusCallout);
			}
		},
		
		updatePlayerStat: function (stat, component, isVisible, currentValue, currentLimit, flipNegative, valueElement, changeIndicatorElement) {
			let $container = $(".stat-indicator-" + stat);
			GameGlobals.uiFunctions.toggle($container, isVisible);
			if (!isVisible) return;

			let displayValue = Math.floor(currentValue);
			
			let isSmallLayout = this.elements.body.hasClass("layout-small");
			let isAtLimit = currentLimit > 0 && currentValue >= currentLimit;
			
			let now = GameGlobals.gameState.gameTime;
			let previousValue = this.previousStats[stat] || 0;
			let previousUpdate = this.previousStatsUpdates[stat] || 0;
			// the small-layout header used to drop the limit to save width; the
			// stacked cell layout has room for it and the cap is what matters
			let suffix = currentLimit > 0 ? " / " + currentLimit : "";
		
			$container.children(".value").toggleClass("warning", isAtLimit);

			let isAnimating = UIAnimations.isActivelyAnimating(valueElement, previousUpdate, now);
			if (isAnimating) return;

			let animate = UIAnimations.shouldAnimateChange(previousValue, currentValue, previousUpdate, now, component.accumulation);
			UIAnimations.animateOrSetNumber(valueElement, animate, displayValue, suffix, flipNegative, (v) => { return Math.floor(v); });
			
			this.updateStatsCallout("", $container, component.accSources);
			this.updateChangeIndicator(changeIndicatorElement, component.accumulation, isVisible && !isAtLimit);
			this.previousStats[stat] = currentValue;
			this.previousStatsUpdates[stat] = now;
		},

		updateChangeIndicator: function (indicator, accumulation, show, showFastIncrease) {
			if (show) {
				indicator.toggleClass("indicator-fastincrease", showFastIncrease == true);
				indicator.toggleClass("indicator-increase", !showFastIncrease && accumulation > 0);
				indicator.toggleClass("indicator-even", !showFastIncrease && accumulation === 0);
				indicator.toggleClass("indicator-decrease", !showFastIncrease && accumulation < 0);
				GameGlobals.uiFunctions.toggle(indicator, true);
			} else {
				GameGlobals.uiFunctions.toggle(indicator, false);
			}
		},

		updateHealthStatCallout: function (description, $indicatorElem) {
			let perksComponent = this.playerStatsNodes.head.perks;
			let modifiers = "";
			
			let perks = perksComponent.getAll();
			for (let i = 0; i < perks.length; i++) {
				let perkVO = perks[i];
				switch (perkVO.type) {
					case PerkConstants.perkTypes.injury:
					case PerkConstants.perkTypes.health:
						modifiers += this.getPerkDescription(perkVO) + "<br/>";
						break;
				}
			}
			
			let content = description + (description && modifiers ? "<hr/>" : "") + modifiers;
			
			UIConstants.updateCalloutContent($indicatorElem, content);
		},

		updateStatsCallout: function (description, $indicatorElem, changeSources, hideNumbers) {
			var sources = "";
			var source;
			var total = 0;
			for (let i in changeSources) {
				source = changeSources[i];
				if (source.amount != 0) {
					if (hideNumbers) {
						sources += source.source + "<br/>";
					} else {
						var amount = Math.round(source.amount * 1000)/1000;
						if (amount == 0 && source.amount > 0) {
							amount = "<&nbsp;" + (1/1000);
						}
						sources += source.source + ": " + amount + "/s<br/>";
						total+= source.amount;
					}
				}
			}

			if (sources.length <= 0) {
				sources = "(no change)";
			}
			
			var content = description + (description && sources ? "<hr/>" : "") + sources;
			
			if (!hideNumbers) {
				var totals = "Total: " + Math.round(total * 10000)/10000 + "/s";
				content += (total > 0 ? ("<hr/>" + totals) : "");
			}
			
			UIConstants.updateCalloutContent($indicatorElem, content);
		},

		updateDeity: function () {
			let hasDeity = GameGlobals.tribeHelper.hasDeity();
			GameGlobals.uiFunctions.toggle(".statsbar-deity", hasDeity);
			if (hasDeity) {
				$(".deity-name").text(this.deityNodes.head.deity.deityName || "?");
			}
		},

		updateItems: function (forced, inCamp) {
			// several callers omit the flag; without this the camp header shows
			// the outside item list
			if (typeof inCamp === "undefined") inCamp = GameGlobals.playerHelper.isInCamp();
			GameGlobals.uiFunctions.toggle("#list-header-items-mobile", !inCamp);
			if (inCamp) return;

			let itemsComponent = this.playerStatsNodes.head.items;
			let items = itemsComponent.getUniqueByID(inCamp);
			
			if (forced || items.length !== this.lastItemsUpdateItemCount) {
				$("ul.list-header-items").empty();
				for (let i = 0; i < items.length; i++) {
					var item = items[i];
					var count = itemsComponent.getCount(item, inCamp);
					switch (item.type) {
						case ItemConstants.itemTypes.bag:
						case ItemConstants.itemTypes.clothing_over:
						case ItemConstants.itemTypes.clothing_upper:
						case ItemConstants.itemTypes.clothing_lower:
						case ItemConstants.itemTypes.clothing_head:
						case ItemConstants.itemTypes.clothing_hands:
						case ItemConstants.itemTypes.shoes:
						case ItemConstants.itemTypes.light:
						case ItemConstants.itemTypes.weapon:
							break;
							
						case ItemConstants.itemTypes.voucher:
						case ItemConstants.itemTypes.exploration:
						case ItemConstants.itemTypes.note:
							$("ul.list-header-items").append("<li>" + UIConstants.getItemDiv(itemsComponent, item, null, UIConstants.getItemCallout(item, true)) + "</li>");
							break;
					}
				}

				GameGlobals.uiFunctions.generateInfoCallouts("ul.list-header-items");

				this.lastItemsUpdateItemCount = items.length;
			}
		},
		
		updateExplorers: function () {
			let inCamp = GameGlobals.playerHelper.isInCamp();
			// the mobile header list would otherwise keep stale party chips in camp
			GameGlobals.uiFunctions.toggle("#list-header-explorers-mobile", !inCamp);
			if (inCamp) return;
			
			let explorersComponent = this.playerStatsNodes.head.explorers;
			let party = explorersComponent.getParty();
			
			$("ul.list-header-explorers").empty();
			for (let i = 0; i < party.length; i++) {
				let explorer = party[i];
				$("ul.list-header-explorers").append("<li>" + UIConstants.getExplorerDivSimple(explorer, true, false, true) + "</li>");
			}
			
			GameGlobals.uiFunctions.generateInfoCallouts("ul.list-header-explorers");
		},
		
		refreshPerks: function () {
			if (GameGlobals.gameState.isPaused) return;
			if (!this.playerStatsNodes.head) return;
			if (GameGlobals.gameState.uiStatus.isHidden) return;

			let isSmallLayout = this.elements.body.hasClass("layout-small");

			let perksComponent = this.playerStatsNodes.head.perks;
			let perks = perksComponent.getAll();
			let perksList = isSmallLayout ? this.perksListMobile : this.perksListDefault;
			let newItems = UIList.update(perksList, perks);

			this.handleNewPerks(newItems);
		},
		
		refreshStatuses: function () {
			// status icons that look like perks but aren't actual perks internally (derived perks)
			if (!this.playerStatsNodes.head) return;
			if (GameGlobals.gameState.uiStatus.isHidden) return;
			
			let $container = $(".player-statuses-list");
			$container.empty();
			
			let statuses = [];
			
			if (GameGlobals.playerHelper.getCurrentBonus(ItemConstants.itemBonusTypes.detect_hazards) > 0) {
				statuses.push({ name: "Hazard foresight", icon: "img/status-hazard-prediction.png", isNegative: false });
			}
			
			if (GameGlobals.playerHelper.getCurrentBonus(ItemConstants.itemBonusTypes.detect_supplies) > 0) {
				statuses.push({ name: "Supplies detection", icon: "img/status-supplies-prediction.png", isNegative: false });
			}
			
			if (GameGlobals.playerHelper.getCurrentBonus(ItemConstants.itemBonusTypes.detect_ingredients) > 0) {
				statuses.push({ name: "Ingredients detection", icon: "img/status-ingredients-prediction.png", isNegative: false });
			}
			
			if (GameGlobals.playerHelper.getCurrentBonus(ItemConstants.itemBonusTypes.detect_poi) > 0) {
				statuses.push({ name: "POI detection", icon: "img/status-poi-prediction.png", isNegative: false });
			}
			
			for (let i = 0; i < statuses.length; i++) {
				var status = statuses[i];
				var isNegative = status.isNegative;
				var liClass = isNegative ? "li-item-negative" : "li-item-positive";
				liClass += " item item-equipped";
				var li =
					"<li class='" + liClass + "'>" +
					"<div class='info-callout-target info-callout-target-side' description='" + status.name + "'>" +
					"<img src='" + status.icon + "' alt='" + status.name + "'/>" +
					"</div></li>";
				$container.append(li);
			}

			GameGlobals.uiFunctions.generateInfoCallouts(".player-statuses-list");
		},

		updatePerks: function () {
			if (GameGlobals.gameState.uiStatus.isHidden) return;

			let isSmallLayout = this.elements.body.hasClass("layout-small");

			let perksComponent = this.playerStatsNodes.head.perks;
			let perks = perksComponent.getAll();

			let perksList = isSmallLayout ? this.perksListMobile : this.perksListDefault;
			let sunlit = this.elements.body.hasClass("sunlit");
			let themeChanged = sunlit != this.lastPerkUpdateSunlit;
			let newItems = UIList.update(perksList, perks, themeChanged);

			this.handleNewPerks(newItems);

			this.lastPerkUpdateSunlit = sunlit;
		},

		handleNewPerks: function (newItems) {
			for (let i = 0; i < newItems.length; i++) {
				newItems[i].$root.toggle(false);
				newItems[i].$root.fadeIn(500);
			}

			if (newItems.length > 0) {
				GameGlobals.uiFunctions.generateInfoCallouts(".player-perks-list");
			}
		},
		
		createPerkListItem: function () {
			let li = {};
			li.$root = $("<li class='item item-equipped'><div class='info-callout-target'><img /></div></li>");
			li.$calloutTarget = li.$root.find("div");
			li.$icon = li.$root.find("img");

			return li;
		},
		
		updatePerkListItem: function (li, data) {
			let perk = data;

			let isSmallLayout = this.elements.body.hasClass("layout-small");
			let isResting = this.isResting();
			let now = new Date().getTime();
			let sunlit = this.elements.body.hasClass("sunlit");
			let isNegative = PerkConstants.isNegative(perk);
			let backgroundColor = ColorConstants.getColor(sunlit, "bg_box_1");
			
			let fillColor = isNegative ? ColorConstants.getColor(sunlit, "bg_warning_stronger") : ColorConstants.getColor(sunlit, "bg_element_1");
			let warningPercentage = perk.removeTimer > 0 ? 
				perk.effectFactor * 100:
				PerkConstants.getPerkActivePercent(perk) * 100;
			
			let backgroundValue = "conic-gradient(" + fillColor + " " + warningPercentage + "%, " + backgroundColor + " 0%)";

			li.$root.toggleClass("li-item-negative", isNegative);
			li.$root.toggleClass("li-item-positive", !isNegative);
			li.$root.attr("data-percentage", warningPercentage);
			li.$root.css("background", warningPercentage > 0 ? backgroundValue : "initial");

			let desc = this.getPerkDescription(perk, isResting);
			li.$calloutTarget.attr("description", desc);
			li.$calloutTarget.toggleClass("event-starting", perk.startTimer >= 0);
			li.$calloutTarget.toggleClass("event-ending", perk.removeTimer >= 0 && perk.removeTimer < 5);
			li.$calloutTarget.toggleClass("info-callout-target-small", isSmallLayout);
			li.$calloutTarget.toggleClass("info-callout-target-side", !isSmallLayout);

			li.$icon.attr("src", perk.icon);
			li.$icon.attr("alt", perk.name);
		},
		
		isPerkListItemDataSame: function (d1, d2) {
			return d1.id == d2.id;
		},

		isPerkListItemDataUnchanged: function (d1, d2) {
			if (d1.startTimer != d2.startTimer) return false;
			if (d1.removeTimer != d2.removeTimer) return false;
			if (d1.effectFactor != d2.effectFactor) return false;
			return true;
		},
		
		getPerkDescription: function (perk, isResting) {
			let desc = perk.name;
			let detailText = UIConstants.getPerkDetailText(perk, isResting);
			if (detailText.length > 0) desc += " (" + detailText + ")";
			return desc;
		},
		
		queueResourceUpdate: function (delay) {
			delay = delay || 0;

			if (this.pendingResourceUpdateTime == null) {
				this.pendingResourceUpdateTime = delay;
			} else {
				this.pendingResourceUpdateTime = Math.max(this.pendingResourceUpdateTime, delay);
			}
		},

		
		queueResourceBarUpdate: function () {
			this.pendingResourceBarUpdateTime = 0;
		},

		// update visibility of various containers and other less often changing elements in the resources bar but not the resources amounts themselves
		updateResourcesBar: function () {
			let playerPosition = this.playerStatsNodes.head.entity.get(PositionComponent);
			let inCamp = playerPosition.inCamp;
			let isSmallLayout = this.elements.body.hasClass("layout-small");
			
			// camp
			GameGlobals.uiFunctions.toggle(".header-camp-storage", inCamp);
			GameGlobals.uiFunctions.toggle(".statsbar-resources", inCamp);
			if (inCamp) {
				let storageCap = GameGlobals.resourcesHelper.getCurrentStorageCap();
				$(".header-camp-storage .value").text(storageCap);

				let showStorageNameKey = GameGlobals.resourcesHelper.getCurrentStorageNameKey(isSmallLayout);
				UIConstants.updateCalloutContent(".header-camp-storage", "Amount of each resource that can be stored");
				GameGlobals.uiFunctions.setText(".header-camp-storage .label", showStorageNameKey);
			}

			// out
			
			GameGlobals.uiFunctions.toggle(".header-bag-storage", !inCamp && GameGlobals.gameState.unlockedFeatures.bag);
			GameGlobals.uiFunctions.toggle(".bag-resources", !inCamp);

			if (!inCamp) {
				let bagComponent = this.playerStatsNodes.head.entity.get(BagComponent);
				let bagUsedCapacityDisplayValue = Math.floor(bagComponent.usedCapacity * 10) / 10;
				let bagCapacityDisplayValue = UIConstants.getBagCapacityDisplayValue(bagComponent, true);
				$(".header-bag-storage .value").text(bagUsedCapacityDisplayValue);
				UIAnimations.animateOrSetNumber($(".header-bag-storage .value-total"), true, bagCapacityDisplayValue);
			}
		},

		updateCurrency: function () {
			let inCamp = GameGlobals.playerHelper.isInCamp();
			let currencyComponent = GameGlobals.resourcesHelper.getCurrentCurrency();

			let currentCurrency = currencyComponent.currency || 0;
			
			GameGlobals.uiFunctions.toggle(".header-camp-currency", inCamp && currentCurrency > 0);
			GameGlobals.uiFunctions.toggle(".header-bag-currency", !inCamp && currentCurrency > 0);

			let $valueLabel = inCamp ? $(".header-camp-currency .value") : $(".header-bag-currency .value");
			UIAnimations.animateOrSetNumber($valueLabel, true, Math.round(currentCurrency || 0));
		},

		// update resource amounts in the resources bar
		// - forced: update even if update currently paused by pendingResourceUpdateTime and do not animate
		updateResources: function (forced) {
			if (!this.playerStatsNodes || !this.playerStatsNodes.head) return;
			if (!forced && this.pendingResourceUpdateTime > 0) return;
			if (!forced && GameGlobals.gameState.isPaused) return;

			let isSmallLayout = this.elements.body.hasClass("layout-small");

			var playerPosition = this.playerStatsNodes.head.entity.get(PositionComponent);
			var inCamp = playerPosition.inCamp;
			var showResources = this.getShowResources();
			var showResourceAcc = this.getShowResourceAcc();
			var storageCap = GameGlobals.resourcesHelper.getCurrentStorageCap();
			var inventoryUnlocked = false;
			let now = GameGlobals.gameState.gameTime;
			let changedPosition = inCamp != this.lastResourceUpdateInCamp || this.lastResourceUpdateLevel != playerPosition.level;

			for (let key in resourceNames) {
				let name = resourceNames[key];
				let currentAmount = showResources.getResource(name);
				let currentAccumulation = showResourceAcc.resourceChange.getResource(name);
				let isSupplies = name === resourceNames.food || name === resourceNames.water;
				let resourceUnlocked = GameGlobals.gameState.unlockedFeatures["resource_" + name] === true || currentAmount > 0 || isSupplies;
				inventoryUnlocked = inventoryUnlocked || resourceUnlocked;

				if (inCamp) {
					let isVisible = resourceUnlocked && !(currentAmount <= 0 && currentAccumulation <= 0 && this.canHideResource(name));
					let previousAmount = this.previousShownCampResAmount[name] || 0;
					let animate = !forced && !changedPosition && UIAnimations.shouldAnimateChange(previousAmount, currentAmount, this.lastCampResourceUpdate, now, currentAccumulation);
					let elemIDCamp = isSmallLayout ? "#resources-camp-mobile-" + name : "#resources-camp-regular-" + name;

					UIConstants.updateResourceIndicator(
						elemIDCamp,
						currentAmount,
						showResourceAcc == null ? 0 : Math.round(currentAccumulation * 10000) / 10000,
						storageCap,
						true,
						!isSmallLayout,
						!isSmallLayout,
						isSupplies,
						isVisible,
						animate,
						this.lastCampResourceUpdate,
						now
					);
					if (showResourceAcc) {
						// the amount and the cap are what turn the net rate into a
						// time to full or a time to empty
						UIConstants.updateResourceIndicatorCallout(elemIDCamp, name, showResourceAcc.getSources(name), currentAmount, storageCap);
					}
					this.previousShownCampResAmount[name] = currentAmount;
				} else {
					let elemIDBag = isSmallLayout ? "#resources-bag-mobile-" + name : "#resources-bag-regular-" + name;
					let animate = !forced && !changedPosition;
					UIConstants.updateResourceIndicator(
						elemIDBag,
						currentAmount,
						showResourceAcc == null ? 0 : Math.round(showResourceAcc.resourceChange.getResource(name) * 10000) / 10000,
						storageCap,
						false,
						false,
						false,
						isSupplies,
						resourceUnlocked && (name === "water" || name === "food" || showResources.getResource(name) > 0),
						animate
					);
				}
			}
			
			if (inCamp) {
				this.lastCampResourceUpdate = now;
			}

			this.lastResourceUpdateInCamp = inCamp;
			this.lastResourceUpdateLevel = playerPosition.level;
		},
		
		canHideResource: function (name) {
			switch (name) {
				case resourceNames.food:
				case resourceNames.water:
				case resourceNames.metal:
				case resourceNames.rope:
				case resourceNames.herbs:
				case resourceNames.medicine:
					return false;
			}
			return true;
		},
		
		completeResourceAnimations: function () {
			for (var key in resourceNames) {
				let name = resourceNames[key];
				UIConstants.completeResourceIndicatorAnimations("#resources-bag-regular-" + name);
				UIConstants.completeResourceIndicatorAnimations("#resources-bag-mobile-" + name);
			}
		},

		updateItemStats: function (inCamp) {
			if (!this.currentLocationNodes.head) return;
			
			let itemsComponent = this.playerStatsNodes.head.items;
			let explorersComponent = this.playerStatsNodes.head.explorers;
			let playerStamina = this.playerStatsNodes.head.stamina;
			let visibleStats = 0;
			
			for (var bonusKey in ItemConstants.itemBonusTypes) {
				let bonusType = ItemConstants.itemBonusTypes[bonusKey];
				if (!this.showItemBonusTypeInEquipmentStats(bonusType)) continue;
				let bonusName = UIConstants.getItemBonusName(bonusType);
				let bonus = GameGlobals.playerHelper.getCurrentBonus(bonusType);
				let value = bonus;
				
				let detail = GameGlobals.playerHelper.getCurrentBonusDesc(bonusType);
				let isVisible = true;
				let flipNegative = false;
				
				switch (bonusType) {
					case ItemConstants.itemBonusTypes.fight_att:
						value = FightConstants.getPlayerAtt(playerStamina, itemsComponent, explorersComponent);
						detail = FightConstants.getPlayerAttDesc(playerStamina, itemsComponent, explorersComponent);
						isVisible = GameGlobals.gameState.unlockedFeatures.fight;
						break;

					case ItemConstants.itemBonusTypes.fight_def:
						value = FightConstants.getPlayerDef(playerStamina, itemsComponent, explorersComponent);
						detail = FightConstants.getPlayerDefDesc(playerStamina, itemsComponent, explorersComponent);
						isVisible = GameGlobals.gameState.unlockedFeatures.fight;
						break;

					case ItemConstants.itemBonusTypes.fight_shield:
						value = FightConstants.getPlayerShield(playerStamina, itemsComponent, explorersComponent);
						detail = FightConstants.getPlayerShieldDesc(playerStamina, itemsComponent, explorersComponent);
						isVisible = GameGlobals.gameState.unlockedFeatures.fight;
						break;
						
					case ItemConstants.itemBonusTypes.movement:
						value *= GameGlobals.sectorHelper.getBeaconMovementBonus(this.currentLocationNodes.head.entity, this.playerStatsNodes.head.perks);
						value *= GameGlobals.sectorHelper.getHazardsMovementMalus(this.currentLocationNodes.head.entity);
						value = Math.round(value * 10) / 10;
						isVisible = GameGlobals.gameState.unlockedFeatures.camp;
						flipNegative = true;
						break;
					
					case ItemConstants.itemBonusTypes.scavenge_cost:
					case ItemConstants.itemBonusTypes.scout_cost:
						isVisible = value != 1;
						value = Math.round(value * 10) / 10;
						flipNegative = true;
						break;

					default:
						isVisible = true;
						break;
				}
				
				let indicatorClass = "stats-equipment-" + bonusKey;
				let isElementVisible = isVisible && value != 0;
				let wasElementVisible = GameGlobals.uiFunctions.isElementToggled("." + indicatorClass);
				let animating = UIAnimations.animateNumber($("." + indicatorClass + " .value"), value, "", flipNegative, (v) => { return UIConstants.roundValue(v, true, true); });
				if (animating) {
					UIAnimations.animateIcon($("#" + indicatorClass + " img"));
				}
				let toggleDelay = wasElementVisible && animating ? UIAnimations.DEFAULT_ANIM_DURATION + 300 : 0;
				GameGlobals.uiFunctions.toggle("." + indicatorClass, isElementVisible, null, toggleDelay);
				UIConstants.updateCalloutContent("." + indicatorClass, bonusName + "<hr/>" + detail);

				if (isVisible && value > 0) visibleStats++;
			}

			GameGlobals.uiFunctions.toggle("#header-self-bar > hr", visibleStats > 0);
		},

		updateGameMsg: function () {
			if (!this.engine) return;
			let gameMsgKey = "";
			let saveSystem = this.engine.getSystem(SaveSystem);
			let timeStamp = new Date().getTime();

			if (saveSystem && saveSystem.error) {
				gameMsgKey = saveSystem.error;
			} else if (saveSystem && saveSystem.lastDefaultSaveTimestamp > 0 && timeStamp - saveSystem.lastDefaultSaveTimestamp < 3 * 1000) {
				gameMsgKey = "ui.meta.game_saved_message";
			} else if (GameGlobals.gameState.isPaused) {
				gameMsgKey = "ui.meta.game_paused_message";
			} else if (GameConstants.systemMessage) {
				gameMsgKey = GameConstants.systemMessage;
			}

			if (this.lastGameMsg !== gameMsgKey) {
				this.elements.gameMsg.text(Text.t(gameMsgKey));
				this.lastGameMsg = gameMsgKey;
			}

			// On the phone the footer is a fixed row and #game-msg is hidden there,
			// so the save confirmation goes to the toast card at the top instead.
			// Boot writes lastDefaultSaveTimestamp without saving anything, so the
			// first observed value only arms the tracker.
			if (saveSystem && saveSystem.lastDefaultSaveTimestamp > 0) {
				if (!this.lastToastedSaveTimestamp) {
					this.lastToastedSaveTimestamp = saveSystem.lastDefaultSaveTimestamp;
				} else if (saveSystem.lastDefaultSaveTimestamp != this.lastToastedSaveTimestamp) {
					this.lastToastedSaveTimestamp = saveSystem.lastDefaultSaveTimestamp;
					if (this.elements.body.hasClass("layout-small")) {
						let toastKey = saveSystem.error ? saveSystem.error : "ui.meta.game_saved_message";
						GameGlobals.uiFunctions.showToast(Text.t(toastKey));
					}
				}
			}
		},

		updateNotifications: function () {
			if (GameGlobals.gameState.isPaused) return;
			let busyComponent = this.playerStatsNodes.head.entity.get(PlayerActionComponent);
			let isBusy = this.playerStatsNodes.head.entity.has(PlayerActionComponent) && busyComponent.isBusy();
			if (isBusy) {
				this.elements.notificationBar.data("progress-percent", busyComponent.getBusyPercentage());
				this.elements.notificationLabel.text(busyComponent.getBusyDescription());
			}
			GameGlobals.uiFunctions.toggle(this.elements.notificationContainer, isBusy);
		},

		updateLocation: function () {
			if (!this.currentLocationNodes.head) return;
			let playerPosition = this.playerStatsNodes.head.entity.get(PositionComponent);
			let inCamp = playerPosition.inCamp;

			this.elements.body.toggleClass("location-inside", inCamp);
			this.elements.body.toggleClass("location-outside", !inCamp);

			let featuresComponent = this.currentLocationNodes.head.entity.get(SectorFeaturesComponent);

			let hasMap = GameGlobals.playerHelper.hasItem("equipment_map");
			let positionText = "??";
			if (hasMap) {
				let showLevel = GameGlobals.gameState.unlockedFeatures.levels;
				positionText = this.currentLocationNodes.head.entity.get(PositionComponent).getPosition().getInGameFormat(showLevel, true);
			}
			$("#out-position-indicator").text("Position: " + positionText);
			
			this.updateLevelIcon();
		},
		
		updateLevelIcon: function (animate) {
			if (!this.currentLocationNodes.head) return;
			let playerPosition = this.playerStatsNodes.head.entity.get(PositionComponent);
			let inCamp = playerPosition.inCamp;
			
			let icon = this.getLevelIcon(inCamp, this.currentLocationNodes.head.entity);
			if ($("#level-icon").attr("src") !== icon.src)
				$("#level-icon").attr("src", icon.src);
			$("#level-icon").attr("alt", icon.desc);
			
			UIConstants.updateCalloutContent("#level-icon", icon.desc);
			
			if (animate) {
				UIAnimations.animateIcon($("#level-icon"), UIAnimations.LONG_ANIM_DURATION);
			}
		},

		// Unlocking scout shows the map panel and unlocking vision shows the scout
		// button, so both change the shell column's shape and the height the log
		// pill has to clear. Nothing else reruns the layout at that moment.
		//
		// Every other unlock leaves the column alone, and updateLayout is five
		// placement passes, a measure and a queued re-measure.
		onFeatureUnlocked: function (featureID) {
			if (featureID !== "scout" && featureID !== "vision") return;
			this.updateLayout();
		},

		// A sideways phone used to get a "turn me upright" notice, because the
		// portrait column does not fold: it is a stack of full-width bands and
		// there is no room for them in 393px of height. One screen does want the
		// width though - the map - so landscape hands the whole viewport to it.
		//
		// Held to phones. A short window on a desktop is just a small window, and
		// a tablet in landscape has the height for the ordinary layout.
		isLandscapeMapLayout: function () {
			if (!UIConstants.isTouchScreen()) return false;

			let width = $(window).width();
			let height = $(window).height();
			if (width <= height) return false;
			if (height > UIConstants.LANDSCAPE_MAP_MAX_HEIGHT) return false;

			// nothing to turn the phone for until the map exists
			return this.hasMapForLandscape();
		},

		// Whether the player has a map, asked of the game state.
		//
		// This used to read data-visible on #switch-map. That attribute is written by
		// UIOutTabBarSystem, so it is only true once THAT system has run - and on a
		// load from a save the layout passes run before it does. A phone already
		// sideways, or turned while the world was still loading, read "no map", showed
		// the rotate notice, and kept showing it: the mode only re-asks when something
		// changes, and the map button appearing is not a change anything reports.
		//
		// The same condition UIOutTabBarSystem uses, from the same place, so the tab
		// button and the landscape mode can no longer disagree about whether there is
		// a map. Reading :visible instead would be worse still - landscape hides the
		// whole tab bar, so the computed display says nothing about the player at all.
		hasMapForLandscape: function () {
			if (GameGlobals.uiMapHelper && GameGlobals.uiMapHelper.isMapRevealed) return true;
			// hasItem reads the player node without checking it exists, and this is
			// asked during startup, before there is one
			if (!this.playerStatsNodes || !this.playerStatsNodes.head) return false;
			return GameGlobals.playerHelper.hasItem("equipment_map");
		},

		// Landscape is the map tab and nothing else, so it switches to that tab
		// rather than reproducing the map somewhere new. Everything the portrait
		// map tab already does - the whole-column map, the details, the map
		// system's own setup in onTabChanged - comes along with it. The tab the
		// player was on comes back when the phone does.
		updateLandscapeMapMode: function (isLandscapeMap) {
			let mapTabID = GameGlobals.uiFunctions.elementIDs.tabs.map;
			let currentTabID = GameGlobals.gameState.uiStatus.currentTab;
			// No tab yet means the game is still starting up. Setting the class now
			// would leave the mode on with the map tab never opened and no tab to
			// come back to; updateLayout asks again once there is one.
			if (!currentTabID) return;

			let wasLandscapeMap = this.elements.body.hasClass("landscape-map");
			if (wasLandscapeMap === isLandscapeMap) return;

			this.elements.body.toggleClass("landscape-map", isLandscapeMap);

			if (isLandscapeMap) {
				this.tabBeforeLandscapeMap = currentTabID === mapTabID ? null : currentTabID;
				if (currentTabID !== mapTabID) GameGlobals.uiFunctions.showTab(mapTabID);
				return;
			}

			let previousTabID = this.tabBeforeLandscapeMap;
			this.tabBeforeLandscapeMap = null;
			// if something else moved the player off the map while sideways, that
			// is where they meant to be - leave them there
			if (previousTabID && currentTabID === mapTabID) GameGlobals.uiFunctions.showTab(previousTabID);
		},

		// The reserve for the status bar, measured rather than read.
		//
		// This device reports env(safe-area-inset-top) as 0 and iOS lays the
		// web view out below the status bar instead. A rotation can leave the
		// view laid out fullscreen without the inset ever changing, and the
		// chrome comes to rest behind the clock until the page is reloaded.
		//
		// So take the larger of two numbers: what env() says, and how much the
		// portrait viewport has grown since the session's first portrait
		// frame. Growth in portrait is the band iOS used to leave for the
		// status bar and has stopped leaving, which is exactly what has to be
		// reserved.
		updateSafeAreaTop: function () {
			let probe = document.getElementById("safe-area-probe");
			let measured = 0;
			if (probe) {
				measured = parseFloat(window.getComputedStyle(probe).paddingTop) || 0;
			}

			let isPortrait = window.innerHeight >= window.innerWidth;
			let screenHeight = window.screen ? window.screen.height : 0;

			// There are exactly two states, and the screen height tells them
			// apart outright: either iOS is keeping a band at the top for the
			// status bar, and the viewport is shorter than the screen, or it
			// has stopped and the viewport is the whole screen.
			//
			// The baseline is the TALLEST portrait viewport seen that was
			// still shorter than the screen - the normal layout, with the band
			// in it. Measured in the simulator: the first portrait frame
			// reports the whole screen, 852, and the viewport settles to its
			// real value only once the chrome is laid out. Reading a baseline
			// from that frame is what the screen-height test rejects.
			//
			// It was "smallest seen" before, which needed no screen height but
			// took any transient short frame as normal for the rest of the
			// session - and this is now polled every tick, so transient frames
			// are seen where they used to be missed.
			if (isPortrait && screenHeight > 0 && window.innerHeight < screenHeight) {
				if (this.baselinePortraitHeight === null || window.innerHeight > this.baselinePortraitHeight) {
					this.baselinePortraitHeight = window.innerHeight;
				}
			}

			// Held to the installed app. In a browser tab the address bar
			// collapsing also grows the viewport, and that must not be read as
			// a lost status bar.
			let growth = 0;
			let isStandalone = this.elements.body.hasClass("standalone");
			let coversWholeScreen = screenHeight > 0 && window.innerHeight >= screenHeight;
			if (isStandalone && isPortrait && coversWholeScreen && this.baselinePortraitHeight !== null) {
				growth = screenHeight - this.baselinePortraitHeight;
			}

			// A status bar is about 60px and never more, so nothing this is
			// compensating for can need more than that. The cap is what makes
			// a moving baseline safe: whatever else grows or shrinks the
			// viewport - a keyboard, a toolbar, something not thought of - the
			// worst this can do is reserve one status bar of empty space,
			// never a screenful.
			growth = Math.min(growth, this.MAX_SAFE_TOP);

			document.documentElement.style.setProperty("--l13-safe-top", Math.max(measured, growth) + "px");

			// The other half of the same problem, and the half that was missed.
			//
			// When iOS stops leaving a band for the status bar, the view is laid out over
			// the whole screen but the page can go on sizing itself to the height it had
			// before. `height: 100%` then resolves short, and the app column stops a
			// status bar's worth above the bottom of the screen with the background
			// showing through - which is what the reserve above was compensating for at
			// the top while nothing put the bottom right.
			//
			// So the shell takes its height from a measured number rather than a
			// percentage. This is recomputed on every viewport change, so unlike the
			// baseline above it cannot go stale: whatever iOS does next, the next frame
			// corrects it.
			document.documentElement.style.setProperty("--l13-viewport-height", window.innerHeight + "px");
		},

		updateLayoutMode: function () {
			let wasSmallLayout = this.elements.body.hasClass("layout-small");
			// the map layout is a small-layout thing, and a phone is wider than
			// the threshold when it is on its side (an iPhone 16 is 852pt), so it
			// has to say so itself
			let isLandscapeMap = this.isLandscapeMapLayout();
			let isSmallLayout = isLandscapeMap || $(window).width() <= UIConstants.SMALL_LAYOUT_THRESHOLD;
			this.elements.body.toggleClass("layout-small", isSmallLayout);
			this.elements.body.toggleClass("layout-regular", !isSmallLayout);
			GameGlobals.uiFunctions.toggle(".debug-info", GameConstants.isDebugVersion);
			this.updateLandscapeMapMode(isLandscapeMap);
			if (wasSmallLayout == isSmallLayout) return;
			GlobalSignals.layoutChangedSignal.dispatch();
			this.updateResources(true);
		},

		updateLayout: function () {
			// a rotation arrives here, and the reserve has to be right before
			// the placement passes below read any geometry
			this.updateSafeAreaTop();
			// The landscape map mode also asks whether the player has a map, and no
			// resize announces that. A phone that opens the game already sideways
			// asked once, before the tab bar had a map button on it, and nothing
			// asked again - so the rotate notice stayed up for the session. This
			// runs on the tab bar's own resize among other things, which is exactly
			// when the button appears.
			if (this.isLandscapeMapLayout() !== this.elements.body.hasClass("landscape-map")) {
				this.updateLayoutMode();
			}

			let isSmallLayout = this.elements.body.hasClass("layout-small");
			let isInCamp = GameGlobals.playerHelper.isInCamp();
			let isInCampTab = GameGlobals.gameState.uiStatus.currentTab === GameGlobals.uiFunctions.elementIDs.tabs.camp;
			// Perks and debuffs show wherever the player is. They were suppressed
			// in camp to save a header row, but an empty list costs no cell (see
			// the :empty rule in mobile.less), so the row only appears when there
			// is something to say - and a debuff is exactly the thing that has to
			// say it without being asked for.
			GameGlobals.uiFunctions.toggle("#mobile-header-status", isSmallLayout);
			GameGlobals.uiFunctions.toggle("#mobile-header-camp-res", isSmallLayout && isInCamp);

			// The rest of the adventurer - health, the gear numbers, and vision
			// where camp leaves it out - is read deliberately rather than watched,
			// so it sits behind a button. The button was a camp thing, which left
			// no way at all to read health or the gear numbers outside, where the
			// header shows vision and stamina and nothing else. It is in the
			// location banner now, which is the one row on screen on every tab.
			GameGlobals.uiFunctions.toggle("#btn-adventurer", isSmallLayout);
			if (!isSmallLayout) this.elements.body.removeClass("adventurer-open");

			// The room is where you are, not which tab you are looking at, so
			// the chip stays put across tabs rather than reflowing the banner
			// on every switch. In camp the banner already names the camp.
			GameGlobals.uiFunctions.toggle("#btn-room", isSmallLayout && !isInCamp);

			this.updateChromeGrouping(isSmallLayout);

			// The shell layout - chrome, scrolling pane and map panel as one flex
			// column the height of the viewport - is declared in mobile.less, and
			// --l13-shell says whether it is in force. Asking the stylesheet beats
			// re-deriving the media query here, which would drift from it.
			let isShell = isSmallLayout && this.isShellLayout();

			// The map panel is the only band that can hold anything else, and it
			// exists on one tab and only once scout is unlocked - every other tab
			// hides it outright, and before scout the game hides it itself.
			// Parking the footer or the log pill in it at any other time would
			// take save, restart and the log off the screen for good.
			//
			// unlockedFeatures rather than a visibility test: the flag is set
			// before featureUnlockedSignal fires, so this pass already reads the
			// new value, while the panel itself is still hidden until
			// UIOutLevelSystem gets its turn.
			let isOutTab = GameGlobals.gameState.uiStatus.currentTab === GameGlobals.uiFunctions.elementIDs.tabs.out;
			let hasOutPanel = isShell && isOutTab && GameGlobals.gameState.unlockedFeatures.scout === true;

			$("#unit-main").css("padding-top", isShell ? "0px" : "15px");
			$("#log-container").css("padding-top", isShell ? "25px" : "25px");
			this.updateLocationHeaderPlacement(isShell);
			this.updateRoomPanelPlacement(isShell);
			this.updateOutControlsPlacement(isShell);
			this.updateSectorBarPlacement(isShell);
			this.updateOutActionsPlacement(isShell);
			this.updateMapDockPlacement(isShell);
			this.updateActionMirrorPlacement(isShell);
			this.updateFooterPlacement(isShell, hasOutPanel);

			// The drawer is fixed over the bottom of the screen, and on the
			// exploration tab the map panel it docks into is itself a fixed,
			// z-indexed band. A stacking context cannot be escaped from the
			// inside, so a docked pill is painted under the drawer whatever
			// z-index it is given - and the pill is the only way to close the
			// drawer. Float it while the drawer is open; the drawer's bottom
			// padding is already sized to keep that corner clear.
			let isLogDrawerOpen = this.elements.body.hasClass("log-drawer-open");
			this.updateLogButtonPlacement(hasOutPanel && !isLogDrawerOpen);

			// nothing above needs a height: the column sorts that out. The floating
			// log pill is the one thing still positioned against the bottom chrome,
			// which is whichever bands the current tab ends with.
			this.updateBottomChromeState(isShell);
			this.updateTopChromeState(isShell);

			// the panel was just rebuilt in this same pass, so a height read now
			// can be one layout behind; read it again on the next frame
			if (!this.isRemeasureScheduled && typeof window.requestAnimationFrame == "function") {
				let sys = this;
				this.isRemeasureScheduled = true;
				window.requestAnimationFrame(function () {
					sys.isRemeasureScheduled = false;
					sys.updateMeasurements();
				});
			}
		},

		// the property is declared on body, not on the root, so it has to be read
		// from body - custom properties only inherit downwards
		isShellLayout: function () {
			if (!document.body) return false;
			let flag = window.getComputedStyle(document.body).getPropertyValue("--l13-shell");
			return flag.trim() === "1";
		},

		// the bands the shell column ends with: the action bar and the map panel
		// on the exploration tab, a pinned action bar on the tabs that have one.
		// The log pill has to clear whichever are there.
		getBottomChromeHeight: function (isShell) {
			if (!isShell) return 0;
			let height = 0;
			$("#out-sector-bar, #out-container-compass, #unit-main > .action-mirror").each(function () {
				let $el = $(this);
				if (!$el.is(":visible")) return;
				height += Math.ceil($el.outerHeight());
			});
			return height;
		},

		// The class and the height are two views of one fact, so they are set
		// together. updateLayout runs inside the featureUnlockedSignal dispatch,
		// BEFORE UIOutLevelSystem reveals the map panel, so the first pass reads
		// the map as still hidden and the next-frame pass is what gets it right.
		// Both callers therefore run both halves.
		updateBottomChromeState: function (isShell) {
			$("#unit-main").toggleClass("out-map-hidden", isShell && !$("#out-container-compass").is(":visible"));
			document.documentElement.style.setProperty("--l13-out-bottom-height", this.getBottomChromeHeight(isShell) + "px");
		},

		// The two overlays that hang under the fixed chrome - the log toasts and
		// the room panel - have to know where it ends, and #mobile-chrome is
		// built at runtime by updateChromeGrouping, so no stylesheet can measure
		// it. Published beside the bottom height and re-read on the same
		// next-frame pass, for the same reason: the chrome is often rebuilt in
		// the pass that reads it.
		updateTopChromeState: function (isShell) {
			let height = 0;
			if (isShell) {
				let $chrome = $("#mobile-chrome");
				if ($chrome.length > 0 && $chrome.is(":visible")) {
					height = Math.ceil($chrome.outerHeight());
				}
			}
			document.documentElement.style.setProperty("--l13-chrome-height", height + "px");
		},

		// iOS moves the standalone viewport without always firing a resize.
		// Coming back from the app switcher, or settling after a rotation, the
		// view is simply laid out over the status bar on some later frame and
		// window.innerHeight is different - with no event. The chrome then
		// sits behind the clock for the rest of the session, which is why
		// opening settings and closing it again put it right by hand: that
		// path happens to re-measure.
		//
		// Two integer reads per tick, and the measuring pass only runs when
		// one of them has changed. This is the only signal that arrives in
		// every one of those cases.
		pollViewportGeometry: function () {
			let height = window.innerHeight;
			let width = window.innerWidth;
			if (height === this.lastViewportHeight && width === this.lastViewportWidth) return;
			this.lastViewportHeight = height;
			this.lastViewportWidth = width;
			// A rotation is a viewport change, and on iOS it is often the ONLY sign
			// of one - the resize event onWindowResized listens for does not always
			// arrive. Measuring is not enough: which way up the phone is decides
			// .landscape-map, and that class is what chooses between the fullscreen
			// map and the rotate notice. Without this a sideways phone kept the
			// portrait layout laid out sideways, and a phone turned back upright
			// kept the fullscreen map.
			//
			// A mode change moves elements between the header and the banner, so it
			// takes the whole pass; a viewport that only grew or shrank needs the
			// measurements and nothing else.
			if (this.isLandscapeMapLayout() !== this.elements.body.hasClass("landscape-map")) {
				this.updateLayout();
				return;
			}
			this.updateMeasurements();
		},

		// the measuring half of updateLayout, without any of the DOM moves, so it
		// is safe to run again from a frame callback
		updateMeasurements: function () {
			// before anything measures the chrome: the chrome's height depends
			// on the padding this sets
			this.updateSafeAreaTop();
			let isShell = this.elements.body.hasClass("layout-small") && this.isShellLayout();
			this.updateBottomChromeState(isShell);
			this.updateTopChromeState(isShell);
		},

		// Which level you are on is the one thing on screen that does not change
		// while you read, and inside the pane it scrolled away with everything
		// else. It goes at the top of the chrome instead, above the stats, where
		// it reads as the page title and stays put. That costs a band of the
		// column, which is why the small layout also cuts the band down to about
		// a line - see LOCATION TITLE in mobile.less.
		updateLocationHeaderPlacement: function (shouldDock) {
			let $header = $("#grid-location");
			if ($header.length === 0) return;

			if (shouldDock) {
				let $chrome = $("#mobile-chrome");
				if ($chrome.length === 0) return;
				if ($header.parent().is($chrome)) return;

				// a marker where it came from, so the desktop layout gets it back in
				// its own place in the order rather than at the front
				if (!this.locationHeaderMarker) {
					this.locationHeaderMarker = document.createComment("grid-location");
					$header.after(this.locationHeaderMarker);
				}
				$chrome.prepend($header);
				return;
			}

			if (!this.locationHeaderMarker) return;
			// Already home. Testing the marker and not the chrome on purpose:
			// updateChromeGrouping tears the chrome down before this runs, and
			// leaves the title wherever the chrome used to be - which is not the
			// same as putting it back.
			if ($header[0].nextSibling === this.locationHeaderMarker) return;
			$(this.locationHeaderMarker).before($header);
		},

		// The room description is a panel over the top of the page on a phone,
		// not a block in the middle of the scroll. The element itself moves, and
		// is not copied, so every existing write from UIOutLevelSystem still
		// lands and nothing there has to know about the panel.
		updateRoomPanelPlacement: function (shouldDock) {
			let $desc = $("#out-desc");
			if ($desc.length === 0) return;

			if (shouldDock) {
				let $panel = $("#room-panel");
				if ($panel.length === 0) return;
				if ($desc.parent().is($panel)) return;

				// a marker where it came from, so the regular layout gets it
				// back in its own place in the order rather than at the front
				if (!this.roomPanelMarker) {
					this.roomPanelMarker = document.createComment("out-desc");
					$desc.after(this.roomPanelMarker);
				}
				$panel.append($desc);
				return;
			}

			if (!this.roomPanelMarker) return;
			if ($desc[0].nextSibling === this.roomPanelMarker) return;
			$(this.roomPanelMarker).before($desc);
			// through toggleRoomPanel, not by clearing the class here: the chip's
			// aria-expanded is the other half of "the panel is open", and a
			// resize with it open would otherwise leave the chip claiming a
			// panel that is no longer on screen
			GameGlobals.uiFunctions.toggleRoomPanel(false);
		},

		// The action bar is the top half of the bottom chrome. Like the map panel
		// it is lifted out of the pane and hung off #unit-main, so the pane's own
		// scrolling cannot take it with it. It has to land BEFORE the map panel:
		// the css that removes the panel's top edge, so the two read as one block,
		// uses an adjacent-sibling selector.
		updateSectorBarPlacement: function (shouldDock) {
			let $bar = $("#out-sector-bar");
			let $unit = $("#unit-main");
			if ($bar.length === 0 || $unit.length === 0) return;

			let isDocked = $bar.parent().is($unit);
			if (shouldDock === isDocked) return;

			if (shouldDock) {
				// a marker where it came from, so the desktop layout gets it back in
				// its own place in the order rather than at the front
				if (!this.sectorBarMarker) {
					this.sectorBarMarker = document.createComment("out-sector-bar");
					$bar.after(this.sectorBarMarker);
				}
				let $map = $("#out-container-compass");
				// the map may already be docked from an earlier pass, in which case
				// appending would put the bar after it
				if ($map.length > 0 && $map.parent().is($unit)) {
					$map.before($bar);
				} else {
					$unit.append($bar);
				}
			} else if (this.sectorBarMarker) {
				$(this.sectorBarMarker).before($bar);
			}
		},

		// Everything the exploration tab offers below the description is
		// situational: the Search actions, whoever happens to be standing here,
		// and the locales this sector leads to. Each one sat where it had to be
		// scrolled to, and each one is empty most of the time. They join the bar.
		//
		// None of them costs a permanent row. The game already shows only the few
		// buttons that apply to where the player is standing and hides each box
		// outright when none do, and they rarely coincide - so the bar's wrap is
		// what carries them. They dock in the order they are used: what you do to
		// the sector, who is here, where you can go on to, then the collectors.
		//
		// Each box keeps a comment marker where it came from, so the desktop
		// layout gets it back under its own heading rather than at the end of the
		// tab. The bar's has-* classes are what make each row visible, so undock
		// clears them all: otherwise the desktop layout gets a bar naming rows it
		// no longer holds, until the level system next recounts.
		OUT_DOCK_BOXES: [
			{ id: "#out-actions", marker: "outActionsMarker", barClass: "has-finds" },
			{ id: "#out-characters", marker: "outCharactersMarker", barClass: "has-characters" },
			{ id: "#out-locales", marker: "outLocalesMarker", barClass: "has-locales" },
		],

		updateOutActionsPlacement: function (shouldDock) {
			let $bar = $("#out-sector-bar");
			if ($bar.length === 0) return;

			for (let i = 0; i < this.OUT_DOCK_BOXES.length; i++) {
				let def = this.OUT_DOCK_BOXES[i];
				this.updateOutBoxPlacement(def, shouldDock, $bar);
				if (!shouldDock) $bar.removeClass(def.barClass);
			}
		},

		updateOutBoxPlacement: function (def, shouldDock, $bar) {
			let $box = $(def.id);
			if ($box.length === 0) return;

			let isDocked = $box.parent().is($bar);
			if (shouldDock === isDocked) return;

			if (shouldDock) {
				if (!this[def.marker]) {
					this[def.marker] = document.createComment(def.id);
					$box.after(this[def.marker]);
				}
				let $collectors = $("#out-sector-bar-collectors");
				if ($collectors.length > 0) $collectors.before($box);
				else $bar.append($box);
			} else if (this[def.marker]) {
				$(this[def.marker]).before($box);
			}
		},

		// Safari clips a position: fixed element that lives inside a scrolling
		// container, so the map panel disappeared outright once the tab content
		// became its own scroller. Lift the panel out of the pane and hang it off
		// #unit-main instead: it is fixed, so its parent costs it no layout, and
		// out there nothing can clip it.
		updateMapDockPlacement: function (shouldDock) {
			let $map = $("#out-container-compass");
			let $unit = $("#unit-main");
			if ($map.length === 0 || $unit.length === 0) return;

			let isDocked = $map.parent().is($unit);
			if (shouldDock === isDocked) return;

			if (shouldDock) {
				if (!this.mapHome) this.mapHome = $map.parent()[0];
				$unit.append($map);
			} else if (this.mapHome) {
				$(this.mapHome).append($map);
			}
		},

		// The pinned action bar belonging to the tab that is on screen. Which tabs
		// have one is the markup's business, not a list kept in here: the element
		// carries .action-mirror and its tab container carries the tab id.
		getCurrentActionMirror: function () {
			let currentTab = GameGlobals.gameState.uiStatus.currentTab;
			return $(".action-mirror").filter(function () {
				return $(this).closest(".tabcontainer").data("tab") === currentTab;
			}).first();
		},

		// Safari clips a position: fixed element that lives inside a scrolling
		// container - the same bug that made the map panel vanish. The pinned
		// action bars are the same shape, fixed and inside the pane, and on a
		// phone that left the embark page's "Go" half off the bottom of the
		// screen and untappable, with nothing to scroll to now that the page's
		// own copy of it is gone.
		//
		// So they get the map panel's treatment: lifted out of the pane and hung
		// off #unit-main as a static band of the shell column, where there is no
		// fixed positioning to lose and nothing above it that can clip it.
		updateActionMirrorPlacement: function (shouldDock) {
			let $unit = $("#unit-main");
			if ($unit.length === 0) return;

			let $wanted = shouldDock ? this.getCurrentActionMirror() : $();
			let $docked = $unit.children(".action-mirror");

			// one bar at a time: the tab changed under it, or the shell went away
			if ($docked.length > 0 && !$docked.is($wanted)) {
				if (this.actionMirrorMarker) $(this.actionMirrorMarker).before($docked);
			}

			if ($wanted.length === 0) return;
			if ($wanted.parent().is($unit)) return;

			// a marker where it came from, so it goes back to its own place in its
			// own tab rather than the front of it. The old one has done its job
			// above, and each bar has a different home.
			if (this.actionMirrorMarker) $(this.actionMirrorMarker).remove();
			this.actionMirrorMarker = document.createComment("action-mirror");
			$wanted.after(this.actionMirrorMarker);
			$unit.append($wanted);
		},

		// The strip along the bottom of the map panel: the footer at the left, the
		// log pill at the right. Built on demand, like the map column, and placed
		// by grid area rather than by document order - updateOutControlsPlacement
		// appends to the same panel and would otherwise decide what comes last.
		getOutPanelMeta: function () {
			let $panel = $("#out-container-compass");
			if ($panel.length === 0) return null;

			let $meta = $("#out-panel-meta");
			if ($meta.length === 0) $meta = $("<div id='out-panel-meta'></div>");
			if (!$meta.parent().is($panel)) $panel.append($meta);

			return $meta;
		},

		// The footer is where save, restart and the version live, and it sat after
		// the scrolling page. With the document locked that is off-screen for
		// good, so it moves: into the map panel on the exploration tab, where it
		// costs no scroll at all, and into the pane on every other tab, where
		// there is no panel and it scrolls with the page.
		updateFooterPlacement: function (isShell, dockInPanel) {
			let $footer = $("#footer");
			if ($footer.length === 0) return;

			let $target = null;
			if (dockInPanel) {
				$target = this.getOutPanelMeta();
			} else if (isShell) {
				$target = $("#grid-switch-content");
			} else if (this.footerHome) {
				$target = $(this.footerHome);
			}

			if (!$target || $target.length === 0) return;
			if ($footer.parent().is($target)) return;

			// remember where it came from, so the desktop layout gets it back
			// in its own place rather than a guessed one
			if (!this.footerHome) this.footerHome = $footer.parent()[0];
			$target.append($footer);
		},

		// The log pill floated over the scrolling pane, which on a phone means it
		// covers whatever is under it. On the exploration tab there is a panel to
		// put it in, so it goes there and stops overlapping anything. Every other
		// tab has no panel, so it floats as before.
		updateLogButtonPlacement: function (dockInPanel) {
			let $button = $("#btn-log-toggle");
			if ($button.length === 0) return;

			let $target = null;
			if (dockInPanel) {
				$target = this.getOutPanelMeta();
			} else if (this.logButtonHome) {
				$target = $(this.logButtonHome);
			}

			if (!$target || $target.length === 0) return;
			if ($button.parent().is($target)) return;

			if (!this.logButtonHome) this.logButtonHome = $button.parent()[0];
			$target.append($button);
		},

		// The stats bar and the tab bar are one block of chrome, but they were two
		// separately positioned fixed elements, with the tab bar placed from a
		// measurement of the header's height. Any lag in that measurement - the
		// header gaining a row on entering camp, say - left the tab bar sitting
		// too high, and its first row disappeared behind the header. Putting both
		// in one fixed wrapper means the tab bar is always exactly below the
		// header with nothing to measure, however many rows either of them grows.
		updateChromeGrouping: function (shouldGroup) {
			let $header = $("#mobile-header");
			let $tabs = $("#grid-switch");
			if ($header.length === 0 || $tabs.length === 0) return;

			let $chrome = $("#mobile-chrome");
			let isGrouped = $chrome.length > 0 && $header.parent().is($chrome);
			if (shouldGroup === isGrouped) return;

			if (shouldGroup) {
				if ($chrome.length === 0) {
					$chrome = $("<div id='mobile-chrome'></div>");
					// it is the element updateLayout measures, so watch it too
					if (this.headerResizeObserver) this.headerResizeObserver.observe($chrome[0]);
				}
				$header.before($chrome);
				$chrome.append($header);
				$chrome.append($tabs);
			} else {
				// back where they came from: header first, tab bar above the
				// tab content it labels
				$chrome.before($header);
				$("#grid-switch-content").before($tabs);
				// Whatever else was parked in here - the level title - is put
				// back by its own placement method later in this same pass, but
				// only if it is still in the document to be found. Removing the
				// wrapper around it would take it out for good.
				$chrome.before($chrome.children());
				$chrome.remove();
			}
		},

		// The compass and "back to camp" are what you reach for between every
		// move, and they lived in the middle of a scrolling tab. When the minimap
		// is pinned to the bottom of the screen they move into that panel, beside
		// the map, and out of the scroll entirely. They fit in the column next to
		// a 224px map, so the panel is no taller for it.
		updateOutControlsPlacement: function (shouldMove) {
			let $controls = $("#out-container-compass-actions");
			if ($controls.length === 0) return;

			let $map = $("#out-container-compass");
			if ($map.length === 0) return;

			let isMoved = $controls.parent().is($map);
			if (shouldMove === isMoved) return;

			if (shouldMove) {
				// the map and its readout become one column, so the panel is a
				// plain two-child row that cannot wrap the controls underneath
				let $column = $("#out-map-column");
				if ($column.length === 0) {
					$column = $("<div id='out-map-column'></div>");
					$map.prepend($column);
				}
				$column.append($map.children("#minimap-background-container"));
				$column.append($map.children(".infobox"));
				$map.append($controls);
			} else {
				$("#container-tab-two-out-actions").prepend($controls);
				let $column = $("#out-map-column");
				if ($column.length > 0) {
					$map.append($column.children());
					$column.remove();
				}
			}
		},

		updateTabVisibility: function () {
			var playerPosition = this.playerStatsNodes.head.entity.get(PositionComponent);
			var isInCamp = playerPosition.inCamp;
			GameGlobals.uiFunctions.toggle("#main-header-camp", isInCamp);
			GameGlobals.uiFunctions.toggle("#main-header-bag", !isInCamp);
			GameGlobals.uiFunctions.toggle("#main-header-items", !isInCamp);
			GameGlobals.gameState.uiStatus.isInCamp = isInCamp;
		},

		updateStaminaWarningLimit: function () {
			if (GameGlobals.gameState.uiStatus.isHidden) return;
			this.staminaWarningLimit = PlayerStatConstants.getStaminaWarningLimit(this.playerStatsNodes.head.stamina);
		},

		updateHeaderTexts: function () {
			if (!this.currentLocationNodes.head) return;
			let playerPosition = this.playerStatsNodes.head.entity.get(PositionComponent);
			let campComponent = this.currentLocationNodes.head.entity.get(CampComponent);
			let isInCamp = playerPosition.inCamp;
			let isGround = playerPosition.level == GameGlobals.gameState.getGroundLevel();
			let isSurface = playerPosition.level == GameGlobals.gameState.getSurfaceLevel();

			let headerText; 
			if (isInCamp && campComponent) { 
				let campCount = GameGlobals.gameState.numCamps;
				if (campCount > 1) {
					headerText = Text.t("ui.main.location_header_in_onecamp", { name: campComponent.getName(), level: playerPosition.level });
				} else {
					headerText = Text.t("ui.main.location_header_in_default", { name: campComponent.getName(), level: playerPosition.level });
				}
			} else if (isGround) {
				headerText = Text.t("ui.main.location_header_out_ground", playerPosition.level);
			} else if (isSurface) {
				headerText = Text.t("ui.main.location_header_out_surface", playerPosition.level);
			} else {
				headerText = Text.t("ui.main.location_header_out", playerPosition.level);
			}

			this.elements.locationHeader.text(headerText);

			GameGlobals.uiFunctions.toggle("#grid-tab-header", GameGlobals.gameState.uiStatus.currentTab !== GameGlobals.uiFunctions.elementIDs.tabs.out || isInCamp);
		},

		updateVisionStatus: function () {
			this.updateTheme();
			this.updateVisionLevel();
		},
		
		updateTheme: function () {
			let sunlit = false;
			
			if (this.currentLocationNodes.head) {
				let featuresComponent = this.currentLocationNodes.head.entity.get(SectorFeaturesComponent);
				sunlit = featuresComponent.sunlit;
			}
			
			if (GameGlobals.gameState.isFinished || GameGlobals.gameState.isLaunchCompleted) {
				sunlit = false;
			}
			
			if (this.playerStatsNodes.head && this.playerStatsNodes.head.entity.has(MovementComponent)) {
				let movementComponent = this.playerStatsNodes.head.entity.get(MovementComponent);
				let movementSector = GameGlobals.levelHelper.getSectorByPosition(movementComponent.level, movementComponent.sectorX, movementComponent.sectorY);
				if (movementSector) {
					let movementSectorFeaturesComponent = movementSector.get(SectorFeaturesComponent);
					sunlit = movementSectorFeaturesComponent.sunlit;
				}
			}
			
			if (GameGlobals.gameState.uiStatus.forceSunlit) sunlit = true;
			if (GameGlobals.gameState.uiStatus.forceDark) sunlit = false;

			if (GameGlobals.gameState.uiStatus.isHidden) return;
			
			this.updateThemeTo(sunlit);
		},
		
		updateThemeTo: function (sunlit) {
			let wasSunlit = this.elements.body.hasClass("sunlit");
			if (sunlit == wasSunlit) {
				return;
			}
			
			log.w("[ui] update theme to: " + (sunlit ? "sunlit" : "dark"));
			this.transitionTheme(wasSunlit, sunlit);
		},
		
		updateThemedIcons: function () {
			let sunlit = this.elements.body.hasClass("sunlit");
			for (let i = 0; i < this.themedIcons.length; i++) {
				let icon = this.themedIcons[i];
				let path = sunlit ? icon.pathSunlit : icon.pathDark;
				if (path) {
					// save paths before overriding src
					icon.$elem.attr("data-src-sunlit", icon.pathSunlit);
					icon.$elem.attr("data-src-dark", icon.pathDark);
					icon.$elem.attr("src", path);
				} else {
					log.w("no path defined for themed icon " + icon.$elem.attr("id"));
				}
			}
		},
		
		updateVisionLevel: function () {
			let visionValue = 0;
			let visionMaxValue = 0;
			
			if (this.playerStatsNodes.head) {
				visionValue = this.playerStatsNodes.head.vision.value;
				visionMaxValue = this.playerStatsNodes.head.vision.maximum;
			}
			
			let visionFactor = visionValue;
			visionFactor = Math.max(0, visionFactor);
			visionFactor = Math.min(100, visionFactor);
			let visionStep = Math.round(visionFactor / 10);
			
			UIState.refreshState(this, "vision-step", visionStep, function () {
				log.i("update vision step: " + visionStep);
				for (let i = 0; i <= 10; i++) {
					this.elements.body.toggleClass("vision-step-" + i, i == visionStep);
				}
			});

			let visionMaxFactor = visionValue;
			visionMaxFactor = Math.max(0, visionMaxFactor);
			visionMaxFactor = Math.min(100, visionMaxFactor);
			let visionLevel = Math.ceil(visionMaxFactor / 25);

			this.visionLevel = visionLevel;

			UIState.refreshState(this, "vision-level", visionLevel, function () {
				log.i("update vision level: " + visionLevel);
				this.updatePageBackgroundColor();
				for (let i = 1; i <= 4; i++) {
					this.elements.body.toggleClass("vision-level-" + i, i == visionLevel);
				}
				$(".hidden-when-down").css("opacity", visionLevel > 0 ? 1 : 0);
			});
		},

		updatePageBackgroundColor: function () {
			let visionLevel = this.visionLevel;
			let sunlit = this.elements.body.hasClass("sunlit");
			let backgroundColor = ColorConstants.getColor(sunlit, "bg_page_vision_level_" + visionLevel);

			log.i("update page background color: sunlit:" + sunlit + " | visionLevel:" + visionLevel);
			
			$("body").css("background", backgroundColor);
			
			for (let i = 0; i < this.dynamicBackgroundItems.length; i++) {
				let item = this.dynamicBackgroundItems[i];
				if (sunlit) {
					item.$elem.css("background", "");
				} else {
					let originalBackground = item.originalBackgroundDark;
					let newBackground = this.getDynamicBackgroundColor(originalBackground, visionLevel);
					item.$elem.stop().animate({ "background-color": newBackground });
				}
			}
		},

		getDynamicBackgroundColor: function (originalBackground, visionLevel) {
			let alpha = 1;
			if (visionLevel == 0) alpha = 0.6;
			if (visionLevel == 1) alpha = 0.8;
			return ColorConstants.getColorWithAlpha(originalBackground, alpha);
		},
		
		updateEndingView: function () {
			log.i("updateEndingView");
			if (GameGlobals.gameState.isFinished) {
				$(".game-opacity-controller").css("opacity", 0);
				$("#container-tab-vis-in").css("display", "none");
				$("#container-tab-two-in").css("display", "none");
			}
		},
		
		transitionTheme: function (oldValue, newValue) {
			if (oldValue == newValue) return;
			if (this.currentThemeTransitionTargetValue != null && this.currentThemeTransitionTargetValue === newValue) {
				return;
			}
			
			log.w("transitionTheme " + oldValue + " -> " + newValue + " | " + this.currentThemeTransitionID);
			
			if (this.currentThemeTransitionID) {
				clearTimeout(this.currentThemeTransitionID);
			}
			
			this.currentThemeTransitionTargetValue = newValue;
			
			$("body").toggleClass("theme-transition", true);
			
			let sys = this;

			let duration = UIConstants.THEME_TRANSITION_DURATION;
			if (!this.playerStatsNodes.head) {
				// game not started or restarting
				duration /= 3;
			}

			let fadeOutDuration = duration * 0.4;
			let transitionDuration = duration * 0.2;
			let fadeInDuration = duration * 0.4;
			
			$("#theme-transition-overlay").css("display", "block");
			$("#theme-transition-overlay").stop(true).animate({ opacity: 1 }, fadeOutDuration).delay(transitionDuration).animate({ opacity: 0 }, fadeInDuration);
			
			this.currentThemeTransitionID = setTimeout(function () {
				sys.elements.body.toggleClass("sunlit", newValue);
				sys.elements.body.toggleClass("dark", !newValue);
				// keep the browser chrome color in sync with the theme (mobile)
				$("meta[name='theme-color']").attr("content", newValue ? "#fbfbfb" : "#202220");

				sys.updatePageBackgroundColor();
				sys.updateVisionStatus();
				sys.updateThemedIcons();
				sys.updateResources(true); // resource fill progress bar color
				
				GlobalSignals.themeToggledSignal.dispatch();
				
				sys.currentThemeTransitionID = setTimeout(function () {
					$("body").toggleClass("theme-transition", false);
					$("#theme-transition-overlay").css("display", "none");
					sys.currentThemeTransitionID = null;
					sys.currentThemeTransitionTargetValue = null;
				}, transitionDuration + fadeOutDuration);
			}, fadeOutDuration);
		
		},
		
		isResting: function () {
			var busyComponent = this.playerStatsNodes.head.entity.get(PlayerActionComponent);
			return busyComponent && busyComponent.getLastActionName() == "use_in_home";
		},
		
		getLevelIcon: function (inCamp, sector) {
			let result = { src: "", desc: "" };
			let position = sector.get(PositionComponent);
			
			let levelEntity = GameGlobals.levelHelper.getLevelEntityForPosition(position.level);
			let levelComponent = levelEntity.get(LevelComponent);
			
			let path = "img/";
			let base = "";
			let desc = "";
			
			if (inCamp) {
				base = levelComponent.habitability < 1 ? "ui-camp-outpost" : "ui-camp-default";
				desc = levelComponent.habitability < 1 ? "in camp | outpost" : "in camp | regular";
			} else if (!GameGlobals.levelHelper.isLevelTypeRevealed(position.level)) {
				base = "ui-level-unknown";
				desc = "outside | unknown level";
			} else {
				var surfaceLevel = GameGlobals.gameState.getSurfaceLevel();
				var groundLevel = GameGlobals.gameState.getGroundLevel();
				if (position.level == surfaceLevel) {
					base = "ui-level-sun";
					desc = "outside | surface";
				} else if (position.level == groundLevel) {
					base = "ui-level-ground";
					desc = "outside | ground";
				} else if (!levelComponent.isCampable) {
					switch (levelComponent.notCampableReason) {
						case LevelConstants.UNCAMPABLE_LEVEL_TYPE_RADIATION:
							base = "ui-level-radiation";
							desc = "outside | radiation level";
							break;
						case LevelConstants.UNCAMPABLE_LEVEL_TYPE_POLLUTION:
							base = "ui-level-poison";
							desc = "outside | polluted level";
							break;
						default:
							base = "ui-level-empty";
							desc = "outside | uninhabitable level";
							break;
					}
				} else {
					base = "ui-level-default";
					desc = "outside | regular level";
				}
			}
			
			let featuresComponent = sector.get(SectorFeaturesComponent);
			let sunlit = featuresComponent.sunlit;
			let suffix = (sunlit ? "" : "-dark");
			result.src = path + base + suffix + ".png";
			result.desc = desc;
			return result;
		},

		getShowResources: function () {
			return GameGlobals.resourcesHelper.getCurrentStorage().resources;
		},

		getShowResourceAcc: function () {
			return GameGlobals.resourcesHelper.getCurrentStorageAccumulation(false);
		},
		
		showItemBonusTypeInEquipmentStats: function (bonusType) {
			if (bonusType == ItemConstants.itemBonusTypes.bag) return false;
			if (bonusType == ItemConstants.itemBonusTypes.fight_speed) return false;
			if (bonusType == ItemConstants.itemBonusTypes.detect_ingredients) return false;
			if (bonusType == ItemConstants.itemBonusTypes.detect_supplies) return false;
			if (bonusType == ItemConstants.itemBonusTypes.detect_hazards) return false;
			if (bonusType == ItemConstants.itemBonusTypes.detect_poi) return false;
			if (bonusType == ItemConstants.itemBonusTypes.scavenge_general) return false;
			if (bonusType == ItemConstants.itemBonusTypes.scavenge_blueprints) return false;
			if (bonusType == ItemConstants.itemBonusTypes.scavenge_ingredients) return false;
			if (bonusType == ItemConstants.itemBonusTypes.scavenge_supplies) return false;
			if (bonusType == ItemConstants.itemBonusTypes.scavenge_valuables) return false;
			if (bonusType == ItemConstants.itemBonusTypes.collector_cost) return false;
			if (bonusType == ItemConstants.itemBonusTypes.scavenge_cost) return false;
			if (bonusType == ItemConstants.itemBonusTypes.scout_cost) return false;
			return true;
		},
		
		onActionStarting: function (action) {
			this.completeResourceAnimations();
			GameGlobals.uiFunctions.showGameOptions(false);
		},

		onPlayerPositionChanged: function () {
			// update these just for setting the right visibility on containers while the player is moving already
			this.queueResourceBarUpdate();
			this.updatePlayerStats();
			this.updateTabVisibility();

			if (GameGlobals.gameState.uiStatus.isHidden) return;
			this.updateStaminaWarningLimit();
			this.updateLocation();
			this.updateHeaderTexts();
			this.queueResourceUpdate();
		},
		
		onPlayerMoveCompleted: function () {
			this.updatePlayerStats();
			this.updateLocation();
			this.updateLayout();
			this.updateItemStats();
			this.updatePageBackgroundColor();
		},
		
		onPlayerLocationChanged: function () {
			this.updateLocation();
		},
		
		onPlayerMoveStarted: function () {
			this.updateTheme();
		},
		
		onPlayerEnteredCamp: function () {
			this.queueResourceBarUpdate();
			this.updateCurrency();
			this.queueResourceUpdate(0.25);
			this.updateExplorers();
			GameGlobals.uiFunctions.scrollToTabTop();
		},
		
		onPlayerLeftCamp: function () {
			this.queueResourceBarUpdate();
			this.updateCurrency();
			this.updateItems();
			this.updateExplorers();
			GameGlobals.uiFunctions.scrollToTabTop();
		},

		onHealthChanged: function () {
			if (GameGlobals.gameState.uiStatus.isHidden) return;
			this.updateStaminaWarningLimit();
			this.updatePlayerStats();
		},
		
		onTribeStatsChanged: function () {
			if (GameGlobals.gameState.uiStatus.isHidden) return;
			this.updatePlayerStats();
		},

		onInventoryChanged: function () {
			if (GameGlobals.gameState.uiStatus.isHidden) return;
			// picking up the map is what turns a sideways phone from the rotate notice
			// into the fullscreen map, and it is the only moment that says so. The
			// notice covers the screen, so the player cannot tap anything to make the
			// ordinary layout passes run and ask again.
			if (this.isLandscapeMapLayout() !== this.elements.body.hasClass("landscape-map")) {
				this.updateLayout();
			}
			this.queueResourceUpdate();
			this.queueResourceBarUpdate();
			this.updateCurrency();
			this.updatePlayerStats();
			this.updateItems(true);
		},
		
		onEquipmentChanged: function () {
			if (GameGlobals.gameState.uiStatus.isHidden) return;
			this.queueResourceBarUpdate();
			this.updatePlayerStats();
			this.updateItemStats();
			this.refreshPerks();
		},
		
		onExplorersChanged: function () {
			if (GameGlobals.gameState.uiStatus.isHidden) return;
			this.updatePlayerStats();
			this.updateItemStats();
			this.updateExplorers();
			this.refreshStatuses();
		},
		
		onPlayerActionCompleted: function () {
			if (GameGlobals.gameState.uiStatus.isHidden) return;
			this.updatePlayerStats();
			this.queueResourceBarUpdate();
		},

		onVisionChanged: function () {
			if (GameGlobals.gameState.uiStatus.isHidden) return;
			this.updateVisionStatus();
			this.refreshPerks();
		},

		onTabChanged: function () {
			if (GameGlobals.gameState.uiStatus.isHidden) return;
			this.updateVisionStatus();
			this.updateHeaderTexts();
			this.updatePlayerStats();
			this.updateLayout();
		},

		onElementCreated: function () {
			this.updateThemedIconsCache();
			this.updateThemedIcons();
		},
		
		onPerksChanged: function () {
			this.refreshPerks();
		},
		
		onStorageCapacityChanged: function () {
			this.queueResourceBarUpdate();
		},
		
		onLevelTypeRevealed: function (level) {
			let playerPosition = this.playerStatsNodes.head.entity.get(PositionComponent);
			if (playerPosition.level == level) {
				this.updateLevelIcon(true);
			}
		},

		onImprovementBuilt: function () {
			this.queueResourceBarUpdate();
			this.queueResourceUpdate();
		},
		
		onLaunchCompleted: function () {
			this.updateTheme();
		},
		
		onGameShown: function () {
			// A batch of one-shot passes, several of which bail while the
			// player's location node does not exist yet - and on a load from a
			// save it does not. The banner is the one that shows: it kept the
			// placeholder from index.html until the player changed tab. Ask
			// update() to run the batch again once the world is there.
			if (!this.currentLocationNodes.head) {
				this.pendingGameShownRefresh = true;
			}

			this.updateTabVisibility();
			this.queueResourceBarUpdate();
			this.updateStaminaWarningLimit();
			this.updateLocation();
			this.updateHeaderTexts();
			this.queueResourceUpdate();
			this.updateVisionStatus();
			this.updatePlayerStats();
			this.refreshPerks();
			this.refreshStatuses();
			this.updateItemStats();
			this.updateExplorers();
			this.updateLayout();
			this.updatePageBackgroundColor();
		},

		onGameReset: function () {
			this.updateTheme();
			this.updatePageBackgroundColor();
		},

		onPopupClosed: function () {
			// update evidence etc immediately after scout popup
			this.updatePlayerStats();
		},

		onWindowResized: function () {
			this.updateLayoutMode();
			this.updateLayout();
		}
	});

	return UIOutHeaderSystem;
});
