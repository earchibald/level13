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

		// Dev functions belong to local work and to nothing else. The candidate at
		// earchibald.github.io/level13-mobile used to switch them on from its path,
		// but a candidate that plays differently from the release at /level13 is not
		// testing what ships, so both deployments now run without them.
		// config.js still never needs hand-editing to get cheats while developing.
		isLocalDevBuild: function () {
			let host = window.location.hostname;
			return host === "localhost" || host === "127.0.0.1" || host === "";
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
