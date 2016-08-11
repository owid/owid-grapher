;(function() {	
	"use strict";
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
				if (formattedNumber && formattedNumber.length >= 24)
					formattedNumber = formattedNumber.match(/[0-9,.]+/)[0] || formattedNumber;
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
					mapBounds = $(".datamaps-subunits").get(0).getBBox(),
					tabBounds = $(".tab-pane.active").get(0).getBoundingClientRect(),
					targetHeight = Math.min(tabBounds.height, mapBounds.height) * 0.6,
					targetWidth = Math.min(tabBounds.width, mapBounds.width) * 0.2,
					targetSize = orientation == "landscape" ? targetWidth : targetHeight;

				var effectiveStepSize = Math.min(50, Math.max(targetSize / data.scheme.length, 10)),
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
					.attr( "transform", function( d, i ) { var translateX = ( orientation === "landscape" )? legendStepsOffsetX + (i*(stepSizeWidth+stepGap)): legendStepsOffsetX, translateY = ( orientation === "landscape" )? 0: ( -( maxDataIndex - i ) * ( stepSizeHeight + stepGap ) ); return "translate(" + translateX + "," + translateY + ")"; } );
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
						var dx = -firstTspanLength; //need to reset possible previous offset
						var dy = stepSizeHeight;
						d3.select(this).attr({ "dx": dx, "dy": dy });
					}
				} );
				
				//exit
				legendSteps.exit().remove();

				//legend description
				gDesc = container.selectAll(".legend-description").data([data.description]);
				gDesc.enter()
					.append("text")
					.attr("class", "legend-description");
				gDesc
					.text(data.description);
				gDesc.attr( "transform", function( d, i ) { var translateX = legendOffsetX, translateY = ( orientation === "landscape" )? stepSizeHeight+descriptionHeight: stepSizeHeight; return ( orientation === "landscape" )? "translate(" + translateX + "," + translateY + ")": "translate(" + translateX + "," + translateY + ") rotate(270)"; } );

				//position legend vertically
				var legendY = (tabBounds.top - svgBounds.top) + availableHeight - legendOffsetY - stepSizeHeight;
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
		legend.availableHeight = function(value) {
			if (!arguments.length)
				return availableHeight;
			else
				availableHeight = value;
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