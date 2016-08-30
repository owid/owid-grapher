;(function() {	
	"use strict";
	owid.namespace("owid.tab.sources");

	owid.tab.sources = function(chart) {
		function sourcesTab() { }

		var $tab = chart.$("#sources-chart-tab"),
			changes = owid.changes();

		changes.track(chart.vardata, 'variables');

		sourcesTab.render = function() {
			if (!changes.start()) return;

			var sources = chart.data.transformDataForSources(),
				tabHtml = "";

			_.each(sources, function(source) {
				tabHtml += source.description;
			});

			$tab.html(tabHtml);
			changes.done();			
		};

		return sourcesTab;
	};
})();