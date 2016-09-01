;(function() {	
	"use strict";
	owid.namespace("owid.view.tabSelector");

	owid.view.tabSelector = function(chart) {
		function tabSelector() {}
		var $nav = chart.$('nav.tabs');

		var changes = owid.changes();
		changes.track(chart.model, 'tabs');
		changes.track(chart.display, 'renderWidth renderHeight activeTab');

		tabSelector.switchTab = function() {
			if (!changes.any('activeTab'))
				return;

			var newTabName = chart.display.get('activeTab'),
				newTab = chart.tabs[newTabName],
				currentTab = chart.activeTab;

			if (currentTab && currentTab != newTab && currentTab.deactivate) currentTab.deactivate();
			if (currentTab != newTab && newTab.activate) newTab.activate();

			$('li[data-tab=' + newTabName + '] a').tab('show');
			chart.activeTab = newTab;
		};

		tabSelector.render = function() {
			if (!changes.start()) return;
			console.trace('tabSelector.render');

			var svg = d3.select("svg"),
				svgBounds = chart.getBounds(svg.node()),
				headerBounds = chart.getBounds(svg.select(".chart-header-svg").node()),
				footerBounds = chart.getBounds(svg.select(".chart-footer-svg").node()),
				tabOffsetY = headerBounds.bottom - svgBounds.top,
				tabHeight = footerBounds.top - headerBounds.bottom;

			$nav.css({
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

			// Show only the tabs which are active for this chart
			$nav.find('li').attr("style", "display: none !important;");
			_.each(chart.model.get('tabs'), function(tabName) {
				$nav.find('li[data-tab=' + tabName + ']').show();
			});

			//for first visible tab, add class for border-left, cannot be done in pure css http://stackoverflow.com/questions/18765814/targeting-first-visible-element-with-pure-css
			$nav.find('li').removeClass('first');
			$nav.find('li:visible:first').addClass('first');

			$nav.find('li').off('click').on('click', function(ev) {
				chart.display.set('activeTab', $(this).attr('data-tab'));
				ev.preventDefault();
			});

			changes.done();
		};

		return tabSelector;
	};

})();