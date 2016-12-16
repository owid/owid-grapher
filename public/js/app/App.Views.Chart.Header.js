;(function(d3) {	
	"use strict";
	owid.namespace("owid.view.header");

	owid.view.header = function() {
		var header = owid.dataflow();

		header.inputs({
			svgNode: undefined,
			bounds: { left: 0, top: 0, width: 100, height: 100 },
			titleStr: "",
			subtitleStr: "",
			logosSVG: []
		});

		header.flow('svg : svgNode', function(svgNode) {
			return d3.select(svgNode);
		});

		header.flow('g : svg', function(svg) {
			return svg.append('g').attr('class', 'header');
		});

		header.flow('g, bounds', function(g, bounds) {
			g.attr('transform', 'translate(' + bounds.left + ',' + bounds.top + ')');
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
                console.log(d);
				this.innerSVG = d.match(/<svg>(.*)<\/svg>/)[1]||d;

				var bbox = this.getBBox();
				var scale = targetHeight/bbox.height;
                offsetX -= bbox.width*scale;

				d3.select(this).attr('transform', 'translate(' + offsetX + ',' + 0 + ') scale(' + scale + ')');
                logoHeight = bbox.height*scale;
			});

			return _.extend({}, bounds, { left: bounds.left, width: offsetX - bounds.left - 10, logoHeight: logoHeight });
		});

		header.flow('title : g', function(g) {
			return g.append('text')
				.attr('class', 'title')
				.attr('dy', '1em');
		});

		header.flow('title, boundsForText', function(title, boundsForText) {
			title.attr('x', boundsForText.left)
				.attr('y', boundsForText.top);
		});

		header.flow('titleBBox : title, titleStr, boundsForText', function(title, titleStr, boundsForText) {
			owid.svgSetWrappedText(title, titleStr, boundsForText.width, { lineHeight: 1.1 });
			return title.node().getBBox();
		});

		header.flow('subtitle : g', function(g) {
			return g.append('text')
				.attr('class', 'subtitle')
				.attr('dy', '1em');
		});

		header.flow('subtitle, titleBBox, subtitleStr, boundsForText, bounds, g', function(subtitle, titleBBox, subtitleStr, boundsForText, bounds, g) {
            var width = boundsForText.width;
            if (titleBBox.height > boundsForText.logoHeight)
                width = bounds.width;

			subtitle.attr('x', boundsForText.left)
				.attr('y', boundsForText.top + titleBBox.height);
			owid.svgSetWrappedText(subtitle, subtitleStr, width, { lineHeight: 1.2 });
		});		

        header.flow('bgRect : g, boundsForText', function(g) {
            g.selectAll('.bgRect').remove();
            var bbox = g.node().getBBox();
            return g.insert('rect', '*').attr('class', 'bgRect').attr('x', 0).attr('y', 0).style('fill', 'white')
                    .attr('width', bbox.width+1).attr('height', bbox.height+10);
        });

		return header;
	};

	owid.namespace("owid.control.header");

	owid.control.header = function(chart) {
		var headerControl = owid.dataflow();

		headerControl.inputs({
			svgNode: undefined,
			bounds: { left: 0, top: 0, width: 100, height: 100 },
			titleTemplate: "",
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

		headerControl.flow('svgNode, bounds, logosSVG, titleStr, subtitleStr', function(svgNode, bounds, logosSVG, titleStr, subtitleStr) {
			header.update({
				svgNode: svgNode,
				bounds: bounds,
				logosSVG: logosSVG,
				titleStr: titleStr,
				subtitleStr: subtitleStr,
			}, function() {
                document.title = header.title.text();
            });
		});

		headerControl.render = function(done) {
			var minYear, maxYear, disclaimer="";
			if (chart.display.get('activeTab') == "map") {
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

			var linkedTitle = "<a href='" + canonicalUrl + "' target='_blank'>" + chart.model.get('chart-name') + "</a>";

			headerControl.update({
				svgNode: chart.svg,
				bounds: { left: 0, top: 0, width: chart.innerRenderWidth, height: chart.innerRenderHeight },
				titleTemplate: linkedTitle,
				subtitleTemplate: chart.model.get('chart-subname') + disclaimer,
				logosSVG: chart.model.get('logosSVG'),
				entities: chart.model.getSelectedEntities(),
				entityType: chart.model.get('entity-type'),
				minYear: minYear,
				maxYear: maxYear
			}, done);
		};

		return headerControl;
	};
})(d3v4);