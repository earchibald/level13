// A stack of short-lived cards - a log message that arrives while the drawer
// is closed is otherwise invisible until the player thinks to check the badge.
//
// DOM and timers only. It knows nothing about the game, which keeps it out of
// the way of the seen-marking rules and lets it be exercised on its own
// against a detached container.
//
// The cap is enforced by pushing the oldest card out early, not by queueing
// the new one. A queue would show a player who is moving fast a feed that
// lags further behind with every step; this way the newest message is always
// on screen and the stack never outgrows its cap.

define([], function () {

	let UIToastStack = {

		DEFAULT_LIFETIME_MS: 4250,
		DEFAULT_FADE_MS: 400,
		DEFAULT_MAX: 4,

		create: function ($container, options) {
			options = options || {};
			return {
				$container: $container,
				lifetimeMs: typeof options.lifetimeMs == "number" ? options.lifetimeMs : this.DEFAULT_LIFETIME_MS,
				fadeMs: typeof options.fadeMs == "number" ? options.fadeMs : this.DEFAULT_FADE_MS,
				max: typeof options.max == "number" ? options.max : this.DEFAULT_MAX,
				cards: [],
			};
		},

		push: function (stack, text) {
			if (!stack) return null;
			if (!stack.$container || stack.$container.length === 0) return null;

			let sys = this;
			let card = { $root: $("<div class='log-toast'></div>"), timeoutID: null, fadeTimeoutID: null, isLeaving: false };
			card.$root.text(text);
			card.$root.on("click", function () { sys.dismiss(stack, card); });

			stack.$container.append(card.$root);
			stack.cards.push(card);

			card.timeoutID = window.setTimeout(function () { sys.dismiss(stack, card); }, stack.lifetimeMs);

			// one over the cap: the oldest card that is not already on its way
			// out gives up the rest of its time
			let settled = stack.cards.filter(function (c) { return !c.isLeaving; });
			while (settled.length > stack.max) {
				sys.dismiss(stack, settled.shift());
			}

			return card;
		},

		dismiss: function (stack, card) {
			if (!stack || !card) return;
			if (card.isLeaving) return;
			card.isLeaving = true;

			if (card.timeoutID) {
				window.clearTimeout(card.timeoutID);
				card.timeoutID = null;
			}

			let sys = this;

			if (stack.fadeMs <= 0 || this.isReducedMotion()) {
				this.remove(stack, card);
				return;
			}

			card.$root.addClass("log-toast-leaving");
			card.fadeTimeoutID = window.setTimeout(function () { sys.remove(stack, card); }, stack.fadeMs);
		},

		remove: function (stack, card) {
			if (!stack || !card) return;

			// Both timers, here rather than in dismiss, because remove is
			// reached from three directions - the lifetime timer, the fade
			// timer, and clear() - and whichever arrives first has to stop
			// the others firing against a card that is already gone.
			if (card.timeoutID) {
				window.clearTimeout(card.timeoutID);
				card.timeoutID = null;
			}

			if (card.fadeTimeoutID) {
				window.clearTimeout(card.fadeTimeoutID);
				card.fadeTimeoutID = null;
			}

			card.$root.remove();
			let index = stack.cards.indexOf(card);
			if (index >= 0) stack.cards.splice(index, 1);
		},

		clear: function (stack) {
			if (!stack) return;
			for (let i = stack.cards.length - 1; i >= 0; i--) {
				this.remove(stack, stack.cards[i]);
			}
			stack.cards = [];
		},

		// a card that is fading is already gone as far as the cap - and as far
		// as anything asserting about the stack - is concerned
		getSettledCount: function (stack) {
			if (!stack) return 0;
			return stack.cards.filter(function (c) { return !c.isLeaving; }).length;
		},

		isReducedMotion: function () {
			if (!window.matchMedia) return false;
			return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		},

	};

	return UIToastStack;
});
