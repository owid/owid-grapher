;( function() {	
	"use strict";

	window.App = window.App || {};
	App.Views = App.Views || {};
	App.Views.Chart = App.Views.Chart || {};	

	App.Views.Chart.Header = owid.View.extend({
		DEFAULT_LOGO_URL: "uploads/26538.png",

		el: "#chart-view .chart-header",
		events: {},

		initialize: function( options ) {
			this.dispatcher = options.dispatcher;
			this.parentView = options.parentView;

			this.logo = d3.select(".logo-svg");
			this.partnerLogo = d3.select(".partner-logo-svg");
			this.$tabs = $(".header-tab");

			this.listenTo(App.ChartModel, "change", this.render.bind(this));
			this.listenTo(App.ChartData, "change", this.render.bind(this));
		},

		render: function(callback) {
			var chartName = App.ChartModel.get("chart-name"),
				chartSubname = App.ChartModel.get("chart-subname"),
				addCountryMode = App.ChartModel.get("add-country-mode"),
				selectedCountries = App.ChartModel.get("selected-countries"),
				logoPath = App.ChartModel.get("logo"),
				partnerLogoPath = App.ChartModel.get("second-logo"),
				partnerLogoUrl = partnerLogoPath && Global.rootUrl + "/" + partnerLogoPath,
				tabs = App.ChartModel.get("tabs");

			// Figure out the header text we're going to display

			this.updateTime();
			chartName = this.replaceContextPlaceholders(chartName);
			chartSubname = this.replaceContextPlaceholders(chartSubname);
			if (this.mapDisclaimer) chartSubname += this.mapDisclaimer;

			/* Position the logos first, because we shall need to wrap the text around them.
			   Currently our logo is SVG but we must use image uris for the partner logos.
			   TODO: Convert partner logos to SVG too, so that they can be scaled. */

			var svg = d3.select("svg"),
				svgBounds = svg.node().getBoundingClientRect(),
				svgWidth = svgBounds.width,
				svgHeight = svgBounds.height,
				g = svg.select(".chart-header-svg");

			var logoWidth = this.logo.node().getBBox().width,
				scaleFactor =  0.3,
				logoX = svgWidth - logoWidth*scaleFactor;
			this.logo.attr("transform", "translate(" + logoX + ", 5) scale(" + scaleFactor + ", " + scaleFactor + ")");
			this.logo.style("visibility", "inherit");

			var renderText = function(availableWidth) {
				var chartNameText = g.select(".chart-name-svg");
				var baseUrl = Global.rootUrl + "/" + App.ChartModel.get("chart-slug"),
					queryParams = owid.getQueryParams(),
					queryStr = owid.queryParamsToStr(queryParams),				
					canonicalUrl = baseUrl + queryStr;

				var linkedName = "<a href='" + canonicalUrl + "' target='_blank'>" + chartName + "</a>";
				owid.svgSetWrappedText(chartNameText, linkedName, availableWidth - 10, { lineHeight: 1.1 });
				document.title = chartName + " - Our World In Data";

				var chartSubnameText = g.select(".chart-subname-svg")
					.attr("y", chartNameText.node().getBoundingClientRect().bottom - svgBounds.top);

				owid.svgSetWrappedText(chartSubnameText, chartSubname, availableWidth - 10, { lineHeight: 1.3 });

				g.select(".header-bg-svg").remove();
				var bgHeight = g.node().getBoundingClientRect().height + 20;
				g.insert("rect", "*")
					.attr("class", "header-bg-svg")
					.attr("x", 0)
					.attr("y", 0)
					.style("fill", "#fff")
					.attr("width", svgWidth)
					.attr("height", bgHeight);
				this.$tabs.attr("style", "display: none !important;");

				_.each(tabs, function( v, i ) {
					var tab = this.$tabs.filter("." + v + "-header-tab");
					tab.show();
				}.bind(this));

				//for first visible tab, add class for border-left, cannot be done in pure css http://stackoverflow.com/questions/18765814/targeting-first-visible-element-with-pure-css
				this.$tabs.removeClass( "first" );
				this.$tabs.filter( ":visible:first" ).addClass( "first" );

				this.dispatcher.trigger("header-rendered");			
				if (_.isFunction(callback)) callback();					
			}.bind(this);

			if (partnerLogoUrl) {
				// HACK (Mispy): Since SVG image elements aren't autosized, any partner logo needs to 
				// be loaded separately in HTML and then the width and height extracted
				var img = new Image();
				img.onload = function() {
					this.partnerLogo.attr('width', img.width);
					this.partnerLogo.attr('height', img.height);
		
					var partnerLogoX = logoX - img.width - 5;
					this.partnerLogo.node().setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", partnerLogoUrl);
					this.partnerLogo.attr("transform", "translate(" + partnerLogoX + ", 5)");				
					this.partnerLogo.style("visibility", "inherit");

					renderText(partnerLogoX);
				}.bind(this);
				img.src = partnerLogoUrl;
			} else {
				renderText(logoX);
			}
		},

		onResize: function(callback) {
			this.render(callback);
		},

		// Replaces things like *time* and *country* with the actual time and
		// country displayed by the current chart context
		replaceContextPlaceholders: function(text) {
			if (s.contains(text, "*country*")) {
				var selectedEntities = App.ChartModel.get("selected-countries"),
					entityText = _.pluck(selectedEntities, "name");

				text = text.replace("*country*", entityText || ("in selected " + App.ChartModel.get("entity-type")));
			}

			if (s.contains(text, "*time")) {
				if (!_.isFinite(this.selectedTimeFrom)) {
					text = text.replace("*time*", "over time");
				} else {
					var timeFrom = owid.displayYear(this.selectedTimeFrom),
						timeTo = owid.displayYear(this.selectedTimeTo),
						time = this.targetYear || (timeFrom === timeTo ? timeFrom : timeFrom + " to " + timeTo);				

					text = text.replace("*time*", time);
					text = text.replace("*timeFrom*", timeFrom);
					text = text.replace("*timeTo*", timeTo);					
				}
			}

			return text;
		},

		updateTime: function() {
			var tabs =	App.ChartModel.get( "tabs" ),
				activeTab = _.find(tabs, function(tab) { return this.$tabs.filter("." + tab + "-header-tab.active").length > 0}.bind(this));

			if (activeTab == "map") {
				if (this.parentView.mapTab.mapConfig)
					this.updateTimeFromMap(this.parentView.mapTab);
			} else {
				if (this.parentView.chartTab && this.parentView.chartTab.localData)
					this.updateTimeFromChart();
			}
		},

		updateTimeFromChart: function() {
			this.selectedTimeFrom = App.ChartData.get("minYear");
			this.selectedTimeTo = App.ChartData.get("maxYear");
			this.mapDisclaimer = null;
			this.targetYear = null;
		},

		updateTimeFromMap: function(map) {			
			var timeFrom = map.minToleranceYear || map.mapConfig.targetYear,
				timeTo = map.maxToleranceYear || map.mapConfig.targetYear,
				targetYear = map.mapConfig.targetYear,
				hasTargetYear = _.find(map.mapData, function(d) { return d.year == targetYear; }),
				d = owid.displayYear;

			if (hasTargetYear && timeFrom != timeTo) {
				// The target year is in the data but we're displaying a range, meaning not available for all countries
				this.mapDisclaimer = " Since some observations for " + d(targetYear) + " are not available the map displays the closest available data (" + d(timeFrom) + " to " + d(timeTo) + ").";
			} else if (!hasTargetYear && timeFrom != timeTo) {
				// The target year isn't in the data at all and we're displaying a range of other nearby values
				this.mapDisclaimer = " Since observations for " + d(targetYear) + " are not available the map displays the closest available data (" + d(timeFrom) + " to " + d(timeTo) + ").";
			} else if (!hasTargetYear && timeFrom == timeTo && timeFrom != targetYear) {
				// The target year isn't in the data and we're displaying some other single year
				this.mapDisclaimer = " Since observations for " + d(targetYear) + " are not available the map displays the closest available data (from " + d(timeFrom) + ").";
			} else if (!hasTargetYear) {
				this.mapDisclaimer = " No observations are available for this year.";
			} else {
//				this.mapDisclaimer = "<span style='visibility: hidden;'>A rather long placeholder to ensure that the text flow remains the same when changing between various years.</span>";
				this.mapDisclaimer = null;
			}

			this.selectedTimeFrom = timeFrom;
			this.selectedTimeTo = timeTo;
			this.timeGoesToLatest = false;
			this.targetYear = targetYear;
		},

	});

})();