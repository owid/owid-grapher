;(function() {	
	"use strict";
	owid.namespace("owid.view.tabSelector");

	owid.view.tabSelector = function(chart) {
		function tabSelector() {}

		tabSelector.render = function() {
			var svg = d3.select("svg"),
				svgBounds = svg.node().getBoundingClientRect(),
				headerBounds = svg.select(".chart-header-svg").node().getBoundingClientRect(),
				footerBounds = svg.select(".chart-footer-svg").node().getBoundingClientRect(),
				tabOffsetY = headerBounds.bottom - svgBounds.top,
				tabHeight = footerBounds.top - headerBounds.bottom;

			chart.$("nav.tabs").css({
				position: 'absolute',
				top: tabOffsetY,
				left: 0
			});

			chart.$(".tab-content").css({
				position: 'absolute',
				top: tabOffsetY + chart.$("nav.tabs").height(),
				left: 0,
				height: tabHeight - chart.$("nav.tabs").height() 
			});

		};

		return tabSelector;
	};

})();