;(function() {	
	"use strict";
	owid.namespace("owid.view.tabSelector");

	owid.view.tabSelector = function(chart) {
		function tabSelector() {}
		var nav = chart.el.select('nav.tabs');

		var changes = owid.changes();
		changes.track(chart.model, 'tabs chart-name chart-subname chart-dimensions chart-description');
		changes.track(chart.map, 'targetYear');
		changes.track(chart, 'renderWidth renderHeight activeTab');

		tabSelector.switchTab = function() {
			var newTabName = chart.activeTabName,
				newTab = chart.tabs[newTabName],
				currentTab = chart.activeTab;
			chart.activeTab = newTab;

			if (currentTab && currentTab != newTab && currentTab.deactivate) currentTab.deactivate();
			$('li[data-tab=' + newTabName + '] a').tab('show');
			if (currentTab != newTab && newTab && newTab.activate) newTab.activate();

		};

		tabSelector.render = function() {
			if (!changes.start()) return;

			var svg = d3.select("svg"),
				svgBounds = chart.getBounds(svg.node()),
				headerBounds = chart.getBounds(svg.select(".header").node()),
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
			$nav.find('li.header-tab').attr("style", "display: none !important;");
			_.each(chart.model.get('tabs'), function(tabName) {
				$nav.find('li.header-tab[data-tab=' + tabName + ']').show();
			});

			//for first visible tab, add class for border-left, cannot be done in pure css http://stackoverflow.com/questions/18765814/targeting-first-visible-element-with-pure-css
			$nav.find('li').removeClass('first');
			$nav.find('li:visible:first').addClass('first');

			$nav.find('li.header-tab').off('click').on('click', function(ev) {
				chart.display.set('activeTab', $(this).attr('data-tab'));
				ev.preventDefault();
			});

			chart.tabBounds = chart.getBounds($('.tab-pane.active').get(0));
			chart.svgBounds = chart.getBounds($('svg').get(0));

            // Determine if we're logged in and show the edit button
            // Done here instead of PHP to allow for caching etc optimization on public-facing content
            if (!Cookies.get("isAdmin")) return;
            chart.$(".edit-btn-wrapper").removeClass("hidden");

			changes.done();
		};

		return tabSelector;
	};

})();