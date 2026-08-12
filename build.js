/*
 * Bundle the game's modules into one file.
 *
 *   node build.js
 *
 * Run this after any change under src/, and commit build/level13-app.js with
 * the source - the same standing rule as css/main.css and the LESS it comes
 * from. Nothing checks at runtime that the bundle matches src/, so a forgotten
 * build ships the old code while the working copy looks correct.
 *
 * Why not r.js: the RequireJS optimizer parses every file to trace the
 * dependency graph, and the esprima it ships cannot read `?.` or `??`. One file
 * uses them today. Bending the source to suit the tool would mean the whole
 * codebase quietly owes a debt to a parser from 2017, payable at release time.
 *
 * So a bundle here is every module's define call given its own id. Each file is
 * wrapped in an IIFE that shadows `define` with one that inserts the id - the
 * file's own bytes are copied through untouched, so no syntax, however new, can
 * be mangled on the way in.
 *
 * Order matters, though it looks as if it should not. RequireJS 2.0.4 drains
 * its define queue in order and enables each module as it goes, so a module
 * whose dependency is defined further down the file sends a request for it
 * before reaching that definition. Sorted by filename, everything under text/,
 * utils/ and worldcreator/ - alphabetically after game/ - was still fetched one
 * by one. Dependencies are therefore emitted before the modules that need them.
 * Only the define prologue is read to get them, never the body.
 *
 * Only src/ is bundled. lib/ stays as separate requests: jquery names its own
 * define, ash and lzstring are third-party, and the json and text plugins have
 * to load before a plugin resource can be resolved. That is a handful of files
 * against the three hundred that were the problem.
 *
 * If an id here were ever wrong, RequireJS would simply not find that module in
 * the bundle and fetch it from src/ as before. A mistake costs a request, not a
 * broken game.
 */

var fs = require("fs");
var path = require("path");

var ROOT = __dirname;
var SRC = path.join(ROOT, "src");
var OUT = path.join(ROOT, "build", "level13-app.js");

// data-main bootstrap scripts, not modules: they call require.config, and
// nothing ever requires them by id
var NOT_MODULES = ["config.js", "config-meta.js", "config-tools.js"];

// loaded through the json plugin, which has no build step of its own here.
// Inlined as named plugin defines, the form the plugin's own write() emits.
var JSON_DATA = [
	"game/data/DialogueData.json",
	"game/data/EnemyData.json",
	"game/data/ItemData.json",
	"game/data/PlayerActionData.json",
	"game/data/StoryData.json",
	"game/data/UpgradeData.json",
];

function walk(dir, found) {
	found = found || [];
	fs.readdirSync(dir).forEach(function (entry) {
		var full = path.join(dir, entry);
		if (fs.statSync(full).isDirectory()) walk(full, found);
		else if (path.extname(entry) === ".js") found.push(full);
	});
	return found;
}

// Reads only the dependency array of the file's define call. A dependency that
// is not a plain string literal id would come back malformed, so every entry is
// checked and the build stops rather than emit a bundle in the wrong order.
function readDependencies(source, relative) {
	var prologue = source.match(/define\s*\(\s*\[([\s\S]*?)\]/);
	if (!prologue) return []; // define(function () {...}), no dependencies
	var literals = prologue[1].match(/['"][^'"]+['"]/g) || [];
	return literals.map(function (raw) {
		var dep = raw.slice(1, -1);
		if (!/^[A-Za-z0-9_\-!./]+$/.test(dep)) {
			throw new Error("unreadable dependency " + JSON.stringify(dep) + " in " + relative);
		}
		return dep;
	});
}

var modules = {};
var order = [];
var skipped = [];

walk(SRC).sort().forEach(function (file) {
	var relative = path.relative(SRC, file).replace(/\\/g, "/");
	if (NOT_MODULES.indexOf(relative) >= 0) {
		skipped.push(relative + " (bootstrap)");
		return;
	}

	var source = fs.readFileSync(file, "utf8");
	if (!/(^|[\s;(])define\s*\(/.test(source)) {
		skipped.push(relative + " (no define call)");
		return;
	}

	var id = relative.replace(/\.js$/, "");
	modules[id] = { id: id, source: source, deps: readDependencies(source, relative) };
	order.push(id);
});

// Depth first, dependencies emitted before the modules that need them. A
// dependency outside the bundle - jquery, ash, a plugin - is not a node here
// and is left to load itself.
var emitted = {};
var visiting = {};
var cycles = [];
var sorted = [];

function visit(id, trail) {
	if (emitted[id]) return;
	if (visiting[id]) {
		cycles.push(trail.slice(trail.indexOf(id)).concat(id).join(" -> "));
		return;
	}
	visiting[id] = true;
	modules[id].deps.forEach(function (dep) {
		if (modules[dep]) visit(dep, trail.concat(id));
	});
	visiting[id] = false;
	emitted[id] = true;
	sorted.push(id);
}

order.forEach(function (id) { visit(id, []); });

var parts = [];
var ids = [];

sorted.forEach(function (id) {
	ids.push(id);
	// The file's `define` resolves to the IIFE parameter, so its own text needs
	// no edit. A file that names its own define keeps that name.
	parts.push(
		';(function (define) {\n' +
		modules[id].source +
		'\n})(function () {\n' +
		'\tvar args = Array.prototype.slice.call(arguments);\n' +
		'\tif (typeof args[0] !== "string") args.unshift(' + JSON.stringify(id) + ');\n' +
		'\treturn define.apply(null, args);\n' +
		'});\n'
	);
});

JSON_DATA.forEach(function (resource) {
	var file = path.join(SRC, resource);
	var data = fs.readFileSync(file, "utf8");
	JSON.parse(data); // fail the build rather than ship a bundle that cannot parse
	var id = "json!" + resource;
	ids.push(id);
	parts.push('define(' + JSON.stringify(id) + ', function () { return ' + data + '; });\n');
});

var header =
	"/*\n" +
	" * Generated by build.js - do not edit. Change the files under src/ and\n" +
	" * run `node build.js` again.\n" +
	" *\n" +
	" * " + ids.length + " modules.\n" +
	" */\n";

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, header + parts.join("\n"));

console.log("wrote " + path.relative(ROOT, OUT));
console.log("  " + ids.length + " modules, " + (fs.statSync(OUT).size / 1024).toFixed(0) + " kB");
skipped.forEach(function (s) { console.log("  skipped " + s); });
// A cycle cannot be ordered, so one module in it is emitted after something
// that needs it and costs a single request. Worth seeing, not worth failing.
cycles.forEach(function (c) { console.log("  cycle " + c); });
