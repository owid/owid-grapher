;(function(d3) {	
	"use strict";
	owid.namespace("owid.map.legend");

	owid.view.mapLegend = function() {
		var legend = owid.dataflow();

		legend.requires('title', 'legendData', 'outerBounds', 'containerNode');

		legend.flow('g : containerNode', function(containerNode) {
			return d3.select(containerNode).append('g').attr('class', 'map-legend');
		});

		// Allow hiding items from legend
		legend.flow('legendData : legendData', function(legendData) {
			return _.filter(legendData, function(d) { return !d.hidden; });
		});

		// Work out how much of the space we want to use
		legend.flow('targetWidth, targetHeight : outerBounds', function(outerBounds) {
			return [outerBounds.width*0.2, outerBounds.height*0.7];
		});

		// Main work: the actual colored boxes part of the legend
		legend.flow('gSteps : g', function(g) {
			return g.append('g').attr('class', 'steps');
		});
		legend.flow('steps : gSteps, legendData', function(gSteps, legendData) {
			var stepsUpdate = gSteps.selectAll('.legend-step').data(legendData);
			stepsUpdate.exit().remove();

			var enter = stepsUpdate.enter().append('g').attr('class', 'legend-step');
			enter.append('rect');

			return enter.merge(stepsUpdate);
		});
		legend.flow('stepsHeight : steps, targetHeight', function(steps, targetHeight) {
			var stepSize = Math.min(30, Math.max(15, targetHeight / steps.size())),
				stepWidth = stepSize,
				stepHeight = stepSize,
				stepGap = Math.min(stepSize/8, 2);

			steps.selectAll('rect')
				.attr("width", stepWidth)
				.attr("height", stepHeight)
				.style("fill", function(d, i) { return d.color; });

			var prevData = null, currentStepOffset = 0;
			steps.selectAll('text').remove();
			steps.each(function(d) {
				var step = d3.select(this);

				// Position the step as a whole
				if (prevData && prevData.type != d.type) {
					// Spacing between numeric/categorical sections
					currentStepOffset += stepGap*3;
				}
				step.attr("transform", "translate(" + 0 + ", " + currentStepOffset + ")");
				currentStepOffset += stepHeight + stepGap;

				// Fill and position the text
				var text = d3.select(this).selectAll('text');
				if (d.type == 'categorical' || d.text) {
					step.append('text').text(d.text)
						.attr('x', stepWidth+5)
						.attr('y', stepHeight/2)
						.attr('dy', '.4em');
				} else if (d.type == 'numeric') {
					if (!prevData || !_.has(prevData, 'max'))
						step.append('text').text(d.minText).attr('x', stepWidth+5);
					step.append('text').text(d.maxText)
						.attr('x', stepWidth+5)
						.attr('y', stepHeight);
				}
				prevData = d;
			});

			return currentStepOffset;
		});


		// Create and position label, if any
		legend.flow('label : g', function(g) {
			return g.append('text').attr('class', 'label');
		});
		legend.flow('labelBBox : label, title', function(label, title) {
			label.text(title);
			return label.node().getBBox();
		});	
		legend.flow('label, labelBBox, stepsHeight, outerBounds', function(label, labelBBox, stepsHeight, outerBounds) {
			var scale = Math.min(1, outerBounds.height/labelBBox.width);
			label.attr("transform", "translate(" + (outerBounds.left + labelBBox.height/2 + 5) + "," + (outerBounds.top + outerBounds.height-11) + ") rotate(270) scale(" + scale + ")");
		});

		// Position and scale steps to fit
		legend.flow('gSteps, labelBBox, outerBounds, targetWidth, targetHeight, stepsHeight', function(gSteps, labelBBox, outerBounds, targetWidth, targetHeight, stepsHeight) {
			var bbox = gSteps.node().getBBox();
			var scale = Math.min(1, Math.min((targetWidth-labelBBox.height)/bbox.width, targetHeight/bbox.height));

			gSteps.attr('transform', 'translate(' + (outerBounds.left+labelBBox.height) + ',' + (outerBounds.top+outerBounds.height-(stepsHeight*scale)-10) + ')' + ' scale(' + scale + ')');
		});

		// Position and scale entire legend
/*		legend.flow('bbox : g, outerBounds', function(g, outerBounds) {
			return g.node().getBBox();
		});
		legend.flow('g, bbox, stepsHeight, outerBounds, targetBounds', function(g, bbox, stepsHeight, outerBounds, targetBounds) {
			g.attr("transform", "translate(" + outerBounds.left + "," + (outerBounds.top + outerBounds.height - bbox.height) + ")");

			owid.scaleToFit(g.node(), targetBounds.width, targetBounds.height);
//			var transform = d3.transform(stepsContainer.attr('transform'));
//			transform.translate = [0, currentStepOffset - currentStepOffset*transform.scale[1]];
//			stepsContainer.attr('transform', transform);
		});*/


		return legend;
	};

	owid.map.legend2 = function(chart) {
		var legend = {};

		var changes = owid.changes();
		changes.track(chart.mapdata, 'legendData legendTitle');
		changes.track(chart, 'tabBounds');

		legend.update = function(bounds) {
			var svg = d3.select(chart.$('.datamap').get(0)),
				g = svg.select('.legend');

			if (!g.empty() && !changes.start()) return;

			var legendData = chart.mapdata.legendData,
				legendTitle = chart.mapdata.legendTitle;

			// Allow hiding some things from the legend
			legendData = _.filter(legendData, function(d) { return !d.hidden; });

			var svgBounds = chart.svgBounds,
				mapBounds = chart.getBounds(svg.select('.datamaps-subunits').node()),
				viewportBox = svg.select('.map-bg').node().getBBox(),
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
			g.attr("transform", "translate(" + legendOffsetX + "," + (viewportBox.y + viewportBox.height - legendOffsetY - currentStepOffset) + ")");

			owid.scaleToFit(stepsContainer.node(), targetWidth - legendStepsOffsetX, targetHeight);
			var transform = d3.transform(stepsContainer.attr('transform'));
			transform.translate = [0, currentStepOffset - currentStepOffset*transform.scale[1]];
			stepsContainer.attr('transform', transform);

			changes.done();
		};

		return legend;
	};
})(d3v4);