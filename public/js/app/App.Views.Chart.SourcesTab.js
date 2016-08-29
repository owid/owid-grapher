;(function() {	
	"use strict";
	owid.namespace("owid.tab.sources");

	owid.tab.sources = function(chart) {
		var $el = chart.$("#sources-chart-tab");

		function sourcesTab() { 			
			var sources = chart.data.transformDataForSources(),
				tabHtml = "";

			_.each(sources, function(source) {
				tabHtml += source.description;
			});

			$el.html(tabHtml);
		}

		sourcesTab.model = function(_) {
			return arguments.length ? (model = _) && sourcesTab : model;			
		};

		sourcesTab.el = function(_) {
			return arguments.length ? ($el = $(_)) && sourcesTab : $el && $el.get(0);
		};

		sourcesTab.render = function() {
			this.call();
		};

		sourcesTab.activate = function(callback) {
			this.render();
			if (callback) callback();
		};

		sourcesTab.deactivate = function() {
			$el.empty();
		};

		return sourcesTab;
	};

})();