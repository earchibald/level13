/*
 * Level 13 service worker.
 *
 * The point of this is as much about freshness as offline play. Installed to an
 * iOS home screen the app can hold its copy of index.html for a long time, and
 * a fix that has not reached the device looks exactly like a fix that does not
 * work. So: navigations and version metadata are network-first, and everything
 * else is cache-first, which is safe because the game asks for its own sources
 * with a ?v= stamp that changes on every release.
 *
 * CACHE_VERSION must be bumped with the release version - see changelog.json,
 * src/config.js urlArgs, and the ?v= query on the css links in index.html.
 */

var CACHE_VERSION = "0.6.3.m83";
var STATIC_CACHE = "l13-static-" + CACHE_VERSION;
var SHELL_CACHE = "l13-shell-" + CACHE_VERSION;
// unversioned on purpose: the sound files change essentially never, and the
// versioned caches are deleted on every release - keeping audio in one of
// them meant every release re-downloaded all of it
var AUDIO_CACHE = "l13-audio-v1";
var OFFLINE_URL = "offline.html";

// kept small on purpose: the game pulls a few hundred files and pre-caching all
// of them would make every release a long download on a phone
var APP_SHELL = [
	"index.html",
	"offline.html",
	"manifest.webmanifest",
	"favicon.svg",
];

// pre-cached so the first play of each sound never waits on the network;
// the game decodes these once at startup
var AUDIO_FILES = [
	"audio/UIClick_BLEEOOP_Baby_Click.wav",
	"audio/MECHSwtch_BLEEOOP_Mechanism.wav",
	"audio/UIClick_BLEEOOP_Well_Oiled.wav",
	"audio/UIClick_BLEEOOP_Old_Keycap.wav",
	"audio/footstep1.mp3",
	"audio/footstep2.mp3",
	"audio/Modern10.m4a",
];

var STATIC_PATTERN = /\.(?:css|js|png|jpg|jpeg|gif|svg|ico|woff2?|ttf)$/;
var AUDIO_PATTERN = /\.(?:mp3|m4a|ogg|wav)$/;

self.addEventListener("install", function (event) {
	event.waitUntil(
		Promise.all([
			caches.open(SHELL_CACHE).then(function (cache) {
				// one at a time: addAll rejects the whole install if any single
				// request 404s, and a failed install leaves the old worker in place
				return Promise.all(APP_SHELL.map(function (url) {
					return cache.add(url).catch(function (e) {
						console.warn("[sw] could not pre-cache " + url, e);
					});
				}));
			}),
			caches.open(AUDIO_CACHE).then(function (cache) {
				// the audio cache persists across releases, so skip anything
				// a previous install already fetched
				return Promise.all(AUDIO_FILES.map(function (url) {
					return cache.match(url).then(function (cached) {
						if (cached) return null;
						return cache.add(url).catch(function (e) {
							console.warn("[sw] could not pre-cache " + url, e);
						});
					});
				}));
			}),
		])
	);
	self.skipWaiting();
});

self.addEventListener("activate", function (event) {
	event.waitUntil(
		caches.keys().then(function (names) {
			return Promise.all(names.map(function (name) {
				if (name === STATIC_CACHE || name === SHELL_CACHE) return null;
				if (name === AUDIO_CACHE) return null;
				if (name.indexOf("l13-") !== 0) return null;
				return caches.delete(name);
			}));
		}).then(function () {
			return self.clients.claim();
		})
	);
});

self.addEventListener("message", function (event) {
	if (event.data === "skip-waiting") self.skipWaiting();
});

self.addEventListener("fetch", function (event) {
	var request = event.request;
	if (request.method !== "GET") return;

	var url;
	try {
		url = new URL(request.url);
	} catch (e) {
		return;
	}

	if (url.origin !== self.location.origin) return;

	// the page itself, and the version metadata the page reads: always try the
	// network, so a release reaches the device as soon as it is online
	if (request.mode === "navigate" || url.pathname.indexOf(".json") >= 0) {
		event.respondWith(networkFirst(request));
		return;
	}

	if (AUDIO_PATTERN.test(url.pathname)) {
		event.respondWith(cacheFirst(request, AUDIO_CACHE));
		return;
	}

	if (STATIC_PATTERN.test(url.pathname)) {
		event.respondWith(cacheFirst(request, STATIC_CACHE));
		return;
	}
});

function cacheFirst(request, cacheName) {
	return caches.match(request).then(function (cached) {
		if (cached) return cached;
		return fetch(request).then(function (response) {
			if (response && response.ok) {
				var copy = response.clone();
				caches.open(cacheName).then(function (cache) {
					cache.put(request, copy);
				});
			}
			return response;
		});
	});
}

function networkFirst(request) {
	return fetch(request).then(function (response) {
		if (response && response.ok) {
			var copy = response.clone();
			caches.open(SHELL_CACHE).then(function (cache) {
				cache.put(request, copy);
			});
		}
		return response;
	}).catch(function () {
		return caches.match(request).then(function (cached) {
			if (cached) return cached;
			// strings.json carries the same ?v= stamp as the sources, and the cache
			// keys on the whole url. So offline, one release after the copy on the
			// device, the exact match misses and the game loads with no text at all.
			// Ignore the stamp on this path only: stale strings beat none.
			return caches.match(request, { ignoreSearch: true }).then(function (stale) {
				if (stale) return stale;
				if (request.mode === "navigate") return caches.match(OFFLINE_URL);
				return Response.error();
			});
		});
	});
}
