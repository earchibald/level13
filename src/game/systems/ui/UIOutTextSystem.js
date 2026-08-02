define([
	'ash',
    'text/Text',
	'game/GameGlobals',
	'game/GlobalSignals',
	'game/constants/TextConstants',
], function (Ash, Text, GameGlobals, GlobalSignals, TextConstants) {
	
    let UIOutTextSystem = Ash.System.extend({

		constructor: function () {
			return this;
		},

		addToEngine: function (engine) {
			GlobalSignals.add(this, GlobalSignals.pageSetUpSignal, this.onPageSetup);
			GlobalSignals.add(this, GlobalSignals.settingsChangedSignal, this.onSettingsChanged);
		},

		removeFromEngine: function (engine) {
			GlobalSignals.removeAll(this);
		},

		refreshLanguage: function () {
			GameGlobals.textLoader.loadTexts()
				.then(() => this.updateTexts());
		},

		updateTexts: function () {
			$.each($(".text-key"), function () {
				let key = $(this).data("text-key");
				if (!key) {
					log.w("html element with class .text-key has no text key defined");
					return;
				}
				// buttons processed by ActionButton have overlay children (label, cooldowns, hotkey hint);
				// setting text on the button would wipe them, so the text goes into the label
				let $label = $(this).children(".btn-label");
				if ($label.length > 0) {
					$label.text(Text.t(key));
				} else {
					$(this).text(Text.t(key));
				}
			});
			GameGlobals.uiFunctions.updateTexts();
		},

		onPageSetup: function () {
			this.refreshLanguage();
		},

		onSettingsChanged: function () {
			this.refreshLanguage();
		},

	});

	return UIOutTextSystem;
});
