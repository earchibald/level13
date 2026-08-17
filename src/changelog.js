
var versions;

// The game asks for changelog.json with the module loader's cache-buster on it
// (see ChangeLogHelper). This page has no loader to borrow one from, and a
// changelog served from cache is a changelog missing the release the reader
// came here to check. cache: false appends a timestamp instead, so this stays
// correct without adding another thing to remember at release time.
$.ajax({ url: 'changelog.json', dataType: 'json', cache: false }).done(function (json) {
	versions = json.versions;
	
	var html = "<h4 class='infobox-scrollable-header'>Changelog</h4>";
	html += "<div id='changelog' class='infobox infobox-scrollable'>";
	
	var v;
	for (let i in versions) {
		v = versions[i];
		if (v.changes.length === 0) continue;
		html += "<div class='changelog-version'>";
		html += "<b>version " + v.version + " (" + v.phase + ")";
		if (v.final) html += " released: " + v.released + "";
		else html += " (work in progress)";
		html += "</b>";
		html += "<ul>";
		for (let j in v.changes) {
			var change = v.changes[j];
			var summary = change.summary.trim().replace(/\.$/, "");
			html += "<li class='changelog-" + change.type + "'>";
			html += "<span class='changelog-summary'>" + summary + "</span>";
			html += "</li>";
		}
		html += "</ul>";
		html += "</div>";
	}
	html += "</div>";
	
	$("#changelog-container").html(html);
})
