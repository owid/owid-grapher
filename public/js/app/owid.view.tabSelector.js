;(function() {	
	"use strict";
	owid.namespace("owid.view.tabSelector");

	owid.view.tabSelector = function(chart) {
		function tabSelector() {}

		var changes = owid.changes();
		changes.track(chart.model, 'renderWidth renderHeight');

		tabSelector.render = function() {
			if (!changes.take()) return;

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

/*							this.$tabs.attr("style", "display: none !important;");

				_.each(tabs, function( v, i ) {
					var tab = this.$tabs.filter("." + v + "-header-tab");
					tab.show();
				}.bind(this));

				//for first visible tab, add class for border-left, cannot be done in pure css http://stackoverflow.com/questions/18765814/targeting-first-visible-element-with-pure-css
				this.$tabs.removeClass( "first" );
				this.$tabs.filter( ":visible:first" ).addClass( "first" );*/

		};

		return tabSelector;
	};

})();