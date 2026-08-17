define( function () {

	let GameConstants = {

		gameSpeedCamp: 1,
		gameSpeedExploration: 1,
		
		isDebugVersion: false,
		isCheatsEnabled: false,
		isAutosaveEnabled: true,

		uiModeMinimialExplorationPopups: false,

		cheatModeBlueprints: false,
		cheatModeSupplies: false,
		cheatModeCampProduction: false,
		cheatModeHazards: false,

		SAVE_SLOT_DEFAULT: "default",
		SAVE_SLOT_BACKUP: "backup",
		SAVE_SLOT_LOADED: "loaded",
		SAVE_SLOT_USER_1: "user1",
		SAVE_SLOT_USER_2: "user2",
		SAVE_SLOT_USER_3: "user3",

		gameStatUnits: {
			general: "general",
			seconds: "seconds",
			steps: "steps",
			level: "level",
		},
		
		gameURL: window.location.origin + window.location.pathname.replace(/\/$/, ""),

		// The candidate is deployed to earchibald.github.io/level13-mobile and the release
		// to earchibald.github.io/level13. Same host, so the path is what tells them apart.
		// Local work counts as a candidate, which is why config.js never needs hand-editing
		// to get cheats during development.
		isCandidateBuild: function () {
			let host = window.location.hostname;
			if (host === "localhost" || host === "127.0.0.1" || host === "") return true;
			return window.location.pathname.indexOf("/level13-mobile") === 0;
		},

		getFeedbackLinksHTML: function () {
			let result = "";
			var a = [ "level13game", "gmail.com" ];
			result += "<a href='https://github.com/nroutasuo/level13' target='github'>github</a>";
			result += " | ";
			result += "<a href='https://www.reddit.com/r/level13' target='reddit'>reddit</a>";
			result += " | ";
			result += "<a href='https://discord.gg/BzMbATyKph' target='discord'>discord</a>";
			result += " | ";
			result += "<a href='mailto:" + a.join("@") + "' rel='noopener noreferrer'>email</a>";
			return result;
		}

	};
	return GameConstants;
});
