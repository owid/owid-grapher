;(function(d3) {	
	"use strict";
	owid.namespace("owid.view.header");

	owid.view.header = function() {
		var header = owid.dataflow();

		header.needs('containerNode', 'bounds', 'titleStr');

		header.defaults({ 
			titleLink: "",
			subtitleStr: "",
			logosSVG: []
		});

		header.initial('titleSizeScale', function() {
			return d3.scaleLinear().domain([30, 150]).range([1.5, 0.75]).clamp(true);
		});

		header.flow('g : containerNode', function(containerNode) {
			return d3.select(containerNode).append('g').attr('class', 'header');
		});

		// Render the logos first as they affect the positioning of the text

		header.flow('boundsForText : g, logosSVG, bounds', function(g, logosSVG, bounds) {
			var logoUpdate = g.selectAll('.logo').data(logosSVG);
			var logos = logoUpdate.enter().append('g').attr('class', 'logo').merge(logoUpdate);

			// Go through and position/scale the logos as needed
			var targetHeight = 50;
			var offsetX = bounds.width;
            var logoHeight;
			logos.each(function(d) {
				this.innerSVG = d.match(/<svg>(.*)<\/svg>/)[1]||d;

				var bbox = this.getBBox();
				var scale = targetHeight/bbox.height;
                offsetX -= bbox.width*scale;

				d3.select(this).attr('transform', 'translate(' + offsetX + ',' + 0 + ') scale(' + scale + ')');
                logoHeight = bbox.height*scale;
			});

			return _.extend({}, bounds, { left: 0, top: 0, width: offsetX - 10, height: bounds.height, logoHeight: logoHeight });
		});

		header.flow('titleLinkEl : g', function(g) {
			return g.append('a').attr('class', 'title').attr('target', '_blank');
		});

		header.flow('titleLinkEl, titleLink', function(titleLinkEl, titleLink) {
			titleLinkEl.attr('xlink:href', titleLink);
		});

		header.flow('title : titleLinkEl', function(titleLinkEl) {
			return titleLinkEl.append('text')
				.attr('dy', '1em');
		});

		header.flow('title, boundsForText', function(title, boundsForText) {
			title.attr('x', boundsForText.left)
				.attr('y', boundsForText.top);
		});

		header.flow('title, titleStr, titleSizeScale', function(title, titleStr, titleSizeScale) {
			title.style('font-size', titleSizeScale(s.stripTags(titleStr).length) + 'em');
		});

		header.flow('titleBBox, titleFontSize : title, titleStr, boundsForText', function(title, titleStr, boundsForText) {
			// Try to fit the title into a single line if possible-- but not if it would make the text super small
			var fontSize = 1.5;
			title.style('font-size', fontSize + 'em');
			owid.svgSetWrappedText(title, titleStr, boundsForText.width, { lineHeight: 1.1 });

			while (fontSize > 0.8 && title.selectAll('tspan').size() > 1) {
				fontSize -= 0.05;
				title.style('font-size', fontSize + 'em');
				owid.svgSetWrappedText(title, titleStr, boundsForText.width, { lineHeight: 1.1 });
			}

			return [title.node().getBBox(), fontSize];
		});

		header.flow('subtitle : g', function(g) {
			return g.append('text')
				.attr('class', 'subtitle')
				.attr('dy', '1em');
		});

		header.flow('subtitle, titleBBox, titleFontSize, subtitleStr, boundsForText, bounds, g', function(subtitle, titleBBox, titleFontSize, subtitleStr, boundsForText, bounds, g) {
            var width = boundsForText.width;
            if (titleBBox.height > boundsForText.logoHeight)
                width = bounds.width;

			subtitle.attr('x', boundsForText.left).attr('y', boundsForText.top + titleBBox.height + 2);

			// Subtitle text must always be smaller than title text. 
			var fontSize = Math.min(0.8, titleFontSize-0.3);
			subtitle.style('font-size', fontSize+'em');
			owid.svgSetWrappedText(subtitle, subtitleStr, width, { lineHeight: 1.1 });

			// Make it a little bit smaller if it still goes across many lines
			if (subtitle.selectAll('tspan').size() > 2) {
				fontSize = Math.min(0.65, fontSize);
				subtitle.style('font-size', fontSize+'em');
				owid.svgSetWrappedText(subtitle, subtitleStr, width, { lineHeight: 1.1 });				
			}
		});		

        header.flow('bbox : g, boundsForText', function(g) {
            g.selectAll('.bgRect').remove();
            var bbox = g.node().getBBox();
            g.insert('rect', '*').attr('class', 'bgRect').attr('x', 0).attr('y', 0).style('fill', 'white')
                    .attr('width', bbox.width+1).attr('height', bbox.height+10);
            return g.node().getBBox();
        });

		header.flow('g, bounds', function(g, bounds) {
			g.attr('transform', 'translate(' + bounds.left + ',' + bounds.top + ')');
		});

		return header;
	};

	owid.namespace("owid.control.header");

	owid.control.header = function(chart) {
		var headerControl = owid.dataflow();

		headerControl.inputs({
			containerNode: undefined,
			bounds: { left: 0, top: 0, width: 100, height: 100 },
			titleTemplate: "",
			titleLink: "",
			subtitleTemplate: "",
			logosSVG: [],
			entities: [],
			entityType: "",
			minYear: null,
			maxYear: null,
		});

		var header = owid.view.header();

		// Replaces things like *time* and *country* with the actual time and
		// country displayed by the current chart context
		headerControl.flow("fillTemplate : minYear, maxYear, entities, entityType", function(minYear, maxYear, entities, entityType) {
			return function(text) {
				if (s.contains(text, "*country*")) {
					var entityStr = _.pluck(entities, "name").join(', ');
					text = text.replace("*country*", entityStr || ("in selected " + entityType));
				}

				if (s.contains(text, "*time")) {
					if (!_.isFinite(minYear)) {
						text = text.replace("*time*", "over time");
					} else {
						var timeFrom = owid.displayYear(minYear),
							timeTo = owid.displayYear(maxYear),
							time = timeFrom === timeTo ? timeFrom : timeFrom + " to " + timeTo;	

						text = text.replace("*time*", time);
						text = text.replace("*timeFrom*", timeFrom);
						text = text.replace("*timeTo*", timeTo);					
					}
				}

				return text;
			};
		});

		headerControl.flow("titleStr : titleTemplate, fillTemplate", function(titleTemplate, fillTemplate) {
			return fillTemplate(titleTemplate);
		});

		headerControl.flow("subtitleStr : subtitleTemplate, fillTemplate", function(subtitleTemplate, fillTemplate) {
			return fillTemplate(subtitleTemplate);
		});

		headerControl.flow('containerNode, bounds, logosSVG, titleStr, titleLink, subtitleStr', function(containerNode, bounds, logosSVG, titleStr, titleLink, subtitleStr) {
			header.update({
				containerNode: containerNode,
				bounds: bounds,
				logosSVG: logosSVG,
				titleStr: titleStr,
				titleLink: titleLink,
				subtitleStr: subtitleStr,
			}, function() {
                document.title = header.title.text();
            });
		});

		headerControl.render = function(bounds, done) {
			var minYear, maxYear, disclaimer="";
			if (chart.activeTabName == "map") {
				chart.mapdata.update();
				
				var mapConfig = chart.map.attributes,
					timeFrom = chart.mapdata.minToleranceYear || mapConfig.targetYear,
					timeTo = chart.mapdata.maxToleranceYear || mapConfig.targetYear,
					year = mapConfig.targetYear,
					hasTargetYear = _.find(chart.mapdata.currentValues, function(d) { return d.year == year; }),
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
					disclaimer = "";
				}

				minYear = timeFrom;
				maxYear = timeTo;
			} else if (chart.model.get('chart-type') == App.ChartType.ScatterPlot) {
				minYear = (chart.model.get('chart-time')||[])[0];
				maxYear = (chart.model.get('chart-time')||[])[1];
			} else {
				minYear = chart.data.get('minYear');
				maxYear = chart.data.get('maxYear');
			}

			var baseUrl = Global.rootUrl + "/" + chart.model.get("chart-slug"),
				queryParams = owid.getQueryParams(),
				queryStr = owid.queryParamsToStr(queryParams),				
				canonicalUrl = baseUrl + queryStr;

			headerControl.update({
				containerNode: chart.svg.node(),
				bounds: bounds,
				titleTemplate: chart.model.get('chart-name'),
				titleLink: canonicalUrl,
				subtitleTemplate: chart.model.get('chart-subname') + disclaimer,
				logosSVG: chart.model.get('logosSVG'),
				entities: chart.model.getSelectedEntities(),
				entityType: chart.model.get('entity-type'),
				minYear: minYear,
				maxYear: maxYear
			}, done);
		};

		headerControl.view = header;

		return headerControl;
	};
})(d3v4);