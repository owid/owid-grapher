;(function() {	
	"use strict";
	owid.namespace("owid.map.legend");

	owid.map.legend = function(chart) {
		var legend = {};

		var changes = owid.changes();
		changes.track(chart.mapdata, 'legendData legendTitle');
		changes.track(chart, 'tabBounds');

		legend.update = function() {
			var svg = d3.select(chart.$('.datamap').get(0)),
				g = svg.select('.legend');

			if (!g.empty() && !changes.start()) return;

			var legendData = chart.mapdata.legendData,
				legendTitle = chart.mapdata.legendTitle;

			// Allow hiding some things from the legend
			legendData = _.filter(legendData, function(d) { return !d.hidden; });

			var svgBounds = chart.svgBounds,
				mapBounds = chart.getBounds(svg.select('.datamaps-subunits').node()),
				viewportBox = chart.getBounds(svg.select('.map-bg').node()),
                targetHeight = Math.min(viewportBox.height, mapBounds.height) * 0.7,
                targetWidth = Math.min(viewportBox.width, mapBounds.width) * 0.25,
				targetSize = targetHeight,
				legendOffsetX = 15,
				legendOffsetY = 10;

			var effectiveStepSize = Math.min(30, Math.max(15, targetSize / legendData.length)),
				stepSizeWidth = effectiveStepSize,
				stepSizeHeight = effectiveStepSize,
				stepGap = Math.min(effectiveStepSize/8, 2);

			g.remove();
			g = svg.append('g')
					.attr('id', 'legend')
					.attr('class', 'legend');

			var stepsContainer = g.append('g');
			var legendSteps = stepsContainer.selectAll('.legend-step').data(legendData);
			
			var legendStepsEnter = legendSteps.enter()
				.append('g')
					.attr('class', 'legend-step');
			legendStepsEnter.append("rect");
			legendStepsEnter.append("line");
			legendStepsEnter.append("text");

			var legendStepsOffsetX = 0;
			if (legendTitle)
				legendStepsOffsetX += 5;

			legendSteps.selectAll('rect')
				.attr("width", stepSizeWidth + "px")
				.attr("height", stepSizeHeight + "px")
				.style("fill", function(d, i) { return d.color; });

			var prevData = null, currentStepOffset = 0;
			legendSteps.selectAll('text').remove();
			legendSteps.each(function(d) {
				var step = d3.select(this);

				// Position the step as a whole
				if (prevData && prevData.type != d.type) {
					// Spacing between numeric/categorical sections
					currentStepOffset += stepGap*3;
				}
				step.attr("transform", "translate(" + legendStepsOffsetX + ", " + currentStepOffset + ")");
				currentStepOffset += stepSizeHeight + stepGap;

				// Position the text
				if (d.type == 'categorical' || d.text) {
					step.append('text').text(d.text)
						.attr('x', stepSizeWidth+5)
						.attr('y', stepSizeHeight/2)
						.attr('dy', '.4em');
				} else if (d.type == 'numeric') {
					if (!prevData || !_.has(prevData, 'max'))
						step.append('text').text(d.minText).attr('x', stepSizeWidth+5);
					step.append('text').text(d.maxText)
						.attr('x', stepSizeWidth+5)
						.attr('y', stepSizeHeight);
				}
				prevData = d;
			});

			//exit
			legendSteps.exit().remove();

			// Plaace legend description label
			var gDesc = g.selectAll(".legend-description").data([legendTitle]);
			gDesc.enter()
				.append("text")
				.attr("class", "legend-description")
				.text(function(d) { return d; });				

			var descOffsetX = 0,
				descOffsetY = currentStepOffset; 

			gDesc.attr("transform", "translate(" + descOffsetX + "," + descOffsetY + ") rotate(270)");
			owid.scaleToFit(gDesc.node(), viewportBox.width - legendOffsetX, viewportBox.height - legendOffsetY - 20);

			// Position and scale legend to fit
			g.attr("transform", "translate(" + legendOffsetX + "," + ((viewportBox.top - svgBounds.top) + viewportBox.height - legendOffsetY - currentStepOffset) + ")");

			owid.scaleToFit(stepsContainer.node(), targetWidth - legendStepsOffsetX, targetHeight);
			var transform = d3.transform(stepsContainer.attr('transform'));
			transform.translate = [0, currentStepOffset - currentStepOffset*transform.scale[1]];
			stepsContainer.attr('transform', transform);

			changes.done();
		};

		return legend;
	};
})();