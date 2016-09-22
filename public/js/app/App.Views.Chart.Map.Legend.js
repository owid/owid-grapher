;(function() {	
	"use strict";
	owid.namespace("owid.map.legend");

	owid.map.legend = function(chart) {
		var legend = {};

		var changes = owid.changes();
		changes.track(chart.mapdata, 'legendData legendTitle');

		legend.update = function() {
			var svg = d3.select(chart.$('.datamap').get(0)),
				g = svg.select('.legend');

			if (!g.empty() && !changes.start()) return;

			var legendData = chart.mapdata.legendData,
				legendTitle = chart.mapdata.legendTitle,
				orientation = chart.map.get('legendOrientation') || 'portrait';

			var svgBounds = chart.svgBounds,
				mapBounds = svg.select('.datamaps-subunits').node().getBoundingClientRect(),
				viewportBox = svg.select('.map-bg').node().getBBox(),
				targetHeight = Math.min(viewportBox.height, mapBounds.height) * 0.65,
				targetWidth = Math.min(viewportBox.width, mapBounds.width) * 0.25,
				targetSize = orientation == "landscape" ? targetWidth : targetHeight,
				legendOffsetX = 15,
				legendOffsetY = 10;

			var effectiveStepSize = Math.min(50, Math.max(10, targetSize / legendData.length)),
				stepSizeWidth = effectiveStepSize,
				stepSizeHeight = effectiveStepSize,
				stepGap = Math.min(effectiveStepSize/8, 2);

			g.remove();
			g = svg.append('g')
					.attr('id', 'legend')
					.attr('class', 'legend');

			var legendSteps = g.selectAll('.legend-step').data(legendData);
			
			var legendStepsEnter = legendSteps.enter()
				.append('g')
					.attr('class', 'legend-step');
			legendStepsEnter.append("rect");
			legendStepsEnter.append("line");
			legendStepsEnter.append("text");

			var legendStepsOffsetX = legendOffsetX;
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
					currentStepOffset += stepGap*5;
				}
				step.attr("transform", "translate(" + legendStepsOffsetX + ", " + currentStepOffset + ")");
				currentStepOffset += stepSizeHeight + stepGap;

				// Position the text
				if (d.type == 'numeric') {
					if (!prevData || !_.has(prevData, 'max'))
						step.append('text').text(d.minText).attr('x', stepSizeWidth+5);
					step.append('text').text(d.maxText)
						.attr('x', stepSizeWidth+5)
						.attr('y', stepSizeHeight);
				} else if (d.type == 'categorical') {
					step.append('text').text(d.text)
						.attr('x', stepSizeWidth+5)
						.attr('y', stepSizeHeight/2+3);
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

			var descOffsetX = legendOffsetX,
				descOffsetY = currentStepOffset; 

			gDesc.attr("transform", "translate(" + descOffsetX + "," + descOffsetY + ") rotate(270)");
			owid.scaleToFit(gDesc.node(), viewportBox.width - legendOffsetX, viewportBox.height - legendOffsetY);

//			g.attr("transform", "translate(" + legendStepsOffsetX + ",0)");
//			owid.scaleToFit(g.node(), targetWidth - legendStepsOffsetX, targetHeight);

			//position legend vertically
			var legendY = viewportBox.y + viewportBox.height - legendOffsetY - currentStepOffset;
			g.attr("transform", "translate(0," + legendY + ")");

			changes.done();
		};

		return legend;
	};
})();