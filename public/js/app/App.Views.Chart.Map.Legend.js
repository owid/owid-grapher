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

			console.log(legendData);

			if (g.empty()) {
				g = svg.append('g')
						.attr('id', 'legend')
						.attr('class', 'legend');
			}

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
					if (!prevData || !prevData.max)
						step.append('text').text(d.minLabel).attr('x', stepSizeWidth+5);
					step.append('text').text(d.maxLabel)
						.attr('x', stepSizeWidth+5)
						.attr('y', stepSizeHeight);
				} else if (d.type == 'categorical') {
					step.append('text').text(d.label)
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

	owid.namespace("App.Views.Chart.Map.Legend");

	App.Views.Chart.Map.Legend = function() {
		//private
		var stepSize = 20,
			stepClass = "legend-step",
			legendOffsetX = 15,
			legendOffsetY = 10,
			displayMinLabel = true,
			labels = [], 
			orientation = "landscape",
			availableHeight = 0,
			unit = {},
			scale, minData, maxData, datamap, container, containerHeight, isCategoricalScale, descriptionHeight, g, gDesc;

		var formatLegendLabel = function(text, valueArr, i, length) {
			valueArr = valueArr.map(function(d) {
				var formattedNumber;
				if (d) {
					formattedNumber = owid.unitFormat(unit, d);
				} else {
					//see if we're suppose to display minimal value
					if (displayMinLabel)
						formattedNumber = owid.unitFormat(unit, minData || 0);
				}
				// HACK (Mispy): Don't use the unit suffix if it's too long
				//if (formattedNumber && formattedNumber.length >= 24)
				//	formattedNumber = formattedNumber.match(/[0-9,.]+/)[0] || formattedNumber;
				return formattedNumber;
			} );

			if (i < (length - 1)) {
				text.text(valueArr[0]);
			} else {
				text.selectAll("tspan").remove();
				//need to use tspan with preserve to have the whitespcae (??)
				text.append("tspan")
					.attr("class", "last-label-tspan")
					.text(valueArr[0]);
				text.append("tspan")
					.attr("class", "last-label-tspan")
					.text(valueArr[1]);
			}
		};

		var formatCategoricalLegendLabel = function( i, scale ) {
			return scale.domain()[ i ];
		};

		function legend(selection) {
			selection.each(function(data) {
				var svgBounds = $("svg").get(0).getBoundingClientRect(),
					mapBounds = $(".datamaps-subunits").get(0).getBoundingClientRect(),
					viewportBox = $(".map-bg").get(0).getBBox(),
					targetHeight = Math.min(viewportBox.height, mapBounds.height) * 0.65,
					targetWidth = Math.min(viewportBox.width, mapBounds.width) * 0.25,
					targetSize = orientation == "landscape" ? targetWidth : targetHeight;

				var effectiveStepSize = Math.min(50, Math.max(10, targetSize / data.scheme.length)),
					stepSizeWidth = effectiveStepSize,
					stepSizeHeight = effectiveStepSize,
					stepGap = Math.min(effectiveStepSize/8, 2);

				datamap = d3.select(".datamap");
				container = d3.select(this);
				isCategoricalScale = ( !scale || !scale.hasOwnProperty( "invertExtent" ) )? true: false;
				descriptionHeight = ( data.description && data.description.length )? 12: 0;
				g = container.select( ".legend" );

				if (g.empty()) {
					g = selection.append( "g" )
							.attr( "id", "legend" )
							.attr( "class", "legend" );
				}

				//data join
				var legendSteps = g.selectAll("." + stepClass).data(data.scheme);
				
				//enter
				var legendStepsEnter = legendSteps.enter()
					.append( "g" )
						.attr( "class", stepClass );
				legendStepsEnter.append("rect");
				legendStepsEnter.append("line");
				legendStepsEnter.append("text");

				//vars for landscape
				var maxDataIndex = data.scheme.length - 1,
					legendStepsOffsetX = legendOffsetX;
				if( orientation === "portrait" && data.description ) {
					legendStepsOffsetX += 5;
				}
				
				//update
				legendSteps
					.attr("transform", function(d, i) { 
						var translateX = orientation == "landscape" ? (i*(stepSizeWidth+stepGap)) : 0,
							translateY = orientation === "landscape" ? 0 : -(maxDataIndex - i) * (stepSizeHeight + stepGap); 
						return "translate(" + translateX + "," + translateY + ")"; 
				});
				legendSteps.selectAll( "rect" )
					.attr( "width", stepSizeWidth + "px" )
					.attr( "height", stepSizeHeight + "px" );

				legendSteps.select( "rect" )
					.style( "fill", function( d, i ) {
							return d;
						} );
				
				//is there custom labeling for 
				var legendStepsTexts = legendSteps.select("text")
							.attr( "transform", function( d, i ) {
								var stepSizeX = stepSizeWidth/2 + 4;

								if ( orientation === "portrait" ) {
									//translate for portrait
									if( isCategoricalScale || ( labels.length && labels[i] ) ) {
										return "translate(" + (stepSizeWidth+5) + "," + (stepSizeHeight/2+3) + ")";
									} else {
										return "translate(" + (stepSizeWidth+5) + "," + (2) + ")";
									}
								} else {
									//translate for landscape
									if( !isCategoricalScale && ( !labels.length || !labels[i] ) ) {
										return "translate(-2,-5) rotate(270)";
									} else {
										return "translate(" + stepSizeX + ",-5) rotate(270)";
									}
								}
							})
							.each(function(d, i) {
								var text = d3.select(this);

								if (labels[i]) {
									text.text(labels[i]);
								} else if (isCategoricalScale) {
									text.text(formatCategoricalLegendLabel(i, scale));
								} else {
									formatLegendLabel(text, scale.invertExtent(d), i, data.scheme.length);
								}
							});
				
				//position last tspans
				var legendStepsTspans = legendStepsTexts.selectAll( "tspan.last-label-tspan" ),
					firstTspanLength = 0;
				legendStepsTspans.each(function(d, i) {
					if (i === 0) {
						firstTspanLength = this.getComputedTextLength();
					} else if (i === 1) {
						var dy = stepSizeHeight;
						d3.select(this).attr({ x: 0, dy: dy });
					}
				} );
				
				//exit
				legendSteps.exit().remove();

				// Legend description label on the side
				gDesc = container.selectAll(".legend-description").data([data.description]);
				gDesc.enter()
					.append("text")
					.attr("class", "legend-description");
				gDesc
					.text(data.description);				

				var translateX = legendOffsetX, 
					translateY = orientation === "landscape" ? stepSizeHeight+descriptionHeight : stepSizeHeight; 

				gDesc.attr("transform", function(d, i) { 
					return orientation === "landscape" ? "translate(" + translateX + "," + translateY + ")" : "translate(" + translateX + "," + translateY + ") rotate(270)";
				});

				if (orientation === "landscape")
					owid.scaleToFit(gDesc.node(), viewportBox.width - translateX, viewportBox.height - translateY);					
				else
					owid.scaleToFit(gDesc.node(), viewportBox.width - translateY, viewportBox.height - translateX);

				g.attr("transform", "translate(" + legendStepsOffsetX + ",0)");
				owid.scaleToFit(g.node(), targetWidth - legendStepsOffsetX, targetHeight);

				//position legend vertically
				var legendY = viewportBox.y + viewportBox.height - legendOffsetY - stepSizeHeight;
				if (orientation === "landscape") {
					legendY -= descriptionHeight;
				}

				container.attr("transform", "translate(0," + legendY + ")");
			});

			return legend;

		}

		//public methods
		legend.stepSize = function(value) {
			if(!arguments.length) {
				return stepSize;
			} else {
				stepSize = parseInt(value, 10);
			}
		};
		legend.scale = function( value ) {
			if( !arguments.length ) {
				return scale;
			} else {
				scale = value;
			}
		};
		legend.minData = function( value ) {
			if( !arguments.length ) {
				return minData;
			} else {
				minData = value;
			}
		};
		legend.maxData = function( value ) {
			if( !arguments.length ) {
				return maxData;
			} else {
				maxData = value;
			}
		};
		legend.displayMinLabel = function( value ) {
			if( !arguments.length ) {
				return displayMinLabel;
			} else {
				displayMinLabel = value;
			}
		};
		legend.labels = function( value ) {
			if( !arguments.length ) {
				return labels;
			} else {
				//set sensible default
				if( !value ) {
					value = [];
				}
				labels = value;
			}
		};
		legend.orientation = function( value ) {
			if( !arguments.length ) {
				return orientation;
			} else {
				orientation = value;
			}
		};
		legend.unit = function(value) {
			if (!arguments.length)
				return unit;
			else
				unit = value;
		};

		return legend;

	};
})();