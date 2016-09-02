;( function() {	
	"use strict";
	owid.namespace("owid.view.header");

	owid.view.header = function(chart) {
		function header() { }

		var changes = owid.changes();
		changes.track(chart.model, 'chart-name chart-subname add-country-mode selected-countries logo second-logo');
		changes.track(chart.map, 'targetYear');
		changes.track(chart.data, 'minYear maxYear');
		changes.track(chart.display, 'renderHeight renderWidth activeTab');

		var minYear, maxYear, targetYear, disclaimer;

		var logo = d3.select(".logo-svg"),
			partnerLogo = d3.select(".partner-logo-svg"),
			$tabs = $(".header-tab");

		function updateTime() {
			if (!changes.any('activeTab minYear maxYear targetYear'))
				return;		

			if (chart.display.get('activeTab') == "map") {
				if (chart.tabs.map.dataMap)
					updateTimeFromMap(chart.tabs.map);
			} else {
				minYear = chart.data.get('minYear');
				maxYear = chart.data.get('maxYear');
				targetYear = null;
			}
		}


		function updateTimeFromMap(map) {
			var mapConfig = chart.map.attributes,
				timeFrom = map.minToleranceYear || mapConfig.targetYear,
				timeTo = map.maxToleranceYear || mapConfig.targetYear,
				year = mapConfig.targetYear,
				hasTargetYear = _.find(map.mapData, function(d) { return d.year == year; }),
				d = owid.displayYear;

			if (hasTargetYear && timeFrom != timeTo) {
				// The target year is in the data but we're displaying a range, meaning not available for all countries
				disclaimer = " Since some observations for " + d(year) + " are not available the map displays the closest available data (" + d(timeFrom) + " to " + d(timeTo) + ").";
			} else if (!hasTargetYear && timeFrom != timeTo) {
				// The target year isn't in the data at all and we're displaying a range of other nearby values
				disclaimer = " Since observations for " + d(year) + " are not available the map displays the closest available data (" + d(timeFrom) + " to " + d(timeTo) + ").";
			} else if (!hasTargetYear && timeFrom == timeTo && timeFrom != year) {
				// The target year isn't in the data and we're displaying some other single year
				disclaimer = " Since observations for " + d(year) + " are not available the map displays the closest available data (from " + d(timeFrom) + ").";
			} else if (!hasTargetYear) {
				disclaimer = " No observations are available for this year.";
			} else {
//				disclaimer = "<span style='visibility: hidden;'>A rather long placeholder to ensure that the text flow remains the same when changing between various years.</span>";
				disclaimer = null;
			}

			minYear = timeFrom;
			maxYear = timeTo;
			targetYear = year;
		}

		// Replaces things like *time* and *country* with the actual time and
		// country displayed by the current chart context
		function replaceContextPlaceholders(text) {
			if (s.contains(text, "*country*")) {
				var selectedEntities = chart.model.get("selected-countries"),
					entityText = _.pluck(selectedEntities, "name");

				text = text.replace("*country*", entityText || ("in selected " + chart.model.get("entity-type")));
			}

			if (s.contains(text, "*time")) {
				if (!_.isFinite(minYear)) {
					text = text.replace("*time*", "over time");
				} else {
					var timeFrom = owid.displayYear(minYear),
						timeTo = owid.displayYear(maxYear),
						time = targetYear || (timeFrom === timeTo ? timeFrom : timeFrom + " to " + timeTo);				

					text = text.replace("*time*", time);
					text = text.replace("*timeFrom*", timeFrom);
					text = text.replace("*timeTo*", timeTo);					
				}
			}

			return text;
		}

		header.render = function() {
			if (!changes.start())
				return;

			console.trace('header.render');

			var chartName = chart.model.get('chart-name'),
				chartSubname = chart.model.get('chart-subname'),
				addCountryMode = chart.model.get('add-country-mode'),
				selectedCountries = chart.model.get('selected-countries'),
				logoPath = chart.model.get('logo'),
				partnerLogoPath = chart.model.get('second-logo'),
				partnerLogoUrl = partnerLogoPath && Global.rootUrl + '/' + partnerLogoPath;

			updateTime();
			chartName = replaceContextPlaceholders(chartName);
			chartSubname = replaceContextPlaceholders(chartSubname);
			if (disclaimer) chartSubname += disclaimer;

			/* Position the logos first, because we shall need to wrap the text around them.
			   Currently our logo is SVG but we must use image uris for the partner logos.
			   TODO: Convert partner logos to SVG too, so that they can be scaled. */

			var svg = d3.select("svg"),
				svgBounds = chart.getBounds(svg.node()),
				svgWidth = svgBounds.width,
				svgHeight = svgBounds.height,
				g = svg.select(".chart-header-svg");

			var scaleFactor;
			if ($("#chart").width() > 1300) {
				scaleFactor = 0.4;
			} else {
				scaleFactor = 0.35;
			}

			var logoWidth = logo.node().getBBox().width,
				logoX = svgWidth - logoWidth*scaleFactor;
			logo.attr("transform", "translate(" + logoX + ", 5) scale(" + scaleFactor + ", " + scaleFactor + ")");
			logo.style("visibility", "inherit");
			var logoBounds = chart.getBounds(logo.node());

			// HACK (Mispy): I should do alternate logos roperly at some point
			if (logoPath != App.OWID_LOGO) {
				logoX = svgWidth;
				logoWidth = 0;
				logo.style('visibility', 'hidden');
				partnerLogoUrl = Global.rootUrl + "/" + logoPath;
			}

			var renderText = function(availableWidth) {
				var chartNameText = g.select(".chart-name-svg");
				var baseUrl = Global.rootUrl + "/" + chart.model.get("chart-slug"),
					queryParams = owid.getQueryParams(),
					queryStr = owid.queryParamsToStr(queryParams),				
					canonicalUrl = baseUrl + queryStr;

				var linkedName = "<a href='" + canonicalUrl + "' target='_blank'>" + chartName + "</a>";
				owid.svgSetWrappedText(chartNameText, linkedName, availableWidth - 10, { lineHeight: 1.1 });
				document.title = chartName + " - Our World In Data";

				var chartNameBounds = chart.getBounds(chartNameText.node());

				var chartSubnameText = g.select(".chart-subname-svg")
					.attr("x", 1)
					.attr("y", chartNameBounds.bottom - svgBounds.top);

				// If we're far enough down, go past the logo
				if (chartNameBounds.bottom > logoBounds.bottom)
					availableWidth = svgBounds.width;
				owid.svgSetWrappedText(chartSubnameText, chartSubname, availableWidth , { lineHeight: 1.2 });

				g.select(".header-bg-svg").remove();
				var bgHeight = chart.getBounds(g.node()).height + 20;
				g.insert("rect", "*")
					.attr("class", "header-bg-svg")
					.attr("x", 0)
					.attr("y", -1)
					.style("fill", "#fff")
					.attr("width", svgWidth)
					.attr("height", bgHeight+1);
				header.bounds = chart.getBounds($('.chart-header-svg').get(0));
			}.bind(this);

			if (partnerLogoUrl) {
				// HACK (Mispy): Since SVG image elements aren't autosized, any partner logo needs to 
				// be loaded separately in HTML and then the width and height extracted
				var img = new Image();
				img.onload = function() {
					partnerLogo.attr('width', img.width);
					partnerLogo.attr('height', img.height);
		
					var partnerLogoX = logoX - img.width - 5;
					partnerLogo.node().setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", partnerLogoUrl);
					partnerLogo.attr("transform", "translate(" + partnerLogoX + ", 5)");				
					partnerLogo.style("visibility", "inherit");

					renderText(partnerLogoX);
				}.bind(this);
				img.src = partnerLogoUrl;
			} else {
				partnerLogo.style('visibility', 'hidden');
				renderText(logoX-10);
			}	

			changes.done();
		};

		return header;
	};

})();