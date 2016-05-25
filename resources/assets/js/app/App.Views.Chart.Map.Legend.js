;(function() {	
	"use strict";
	owid.namespace("App.Views.Chart.Map.Legend");

	App.Views.Chart.Map.Legend = function() {

		//private
		var stepSizeWidth = 20,
			stepSizeHeight = 20,
			stepClass = "legend-step",
			legendOffsetX = 15,
			legendOffsetY = 10,
			stepGap = 2,
			displayMinLabel = true,
			labels = [], 
			orientation = "landscape",
			scale, minData, maxData, datamap, container, containerHeight, isCategoricalScale, descriptionHeight, g, gDesc;

		var formatLegendLabel = function( valueArr, i, length ) {
			
			valueArr = valueArr.map( function( d ) {
				//make sure it's not undefined
				if( d ) {
					var len = d.toString().length,
						formattedNumber = d;
					if( len > 3 ) {
						formattedNumber = d3.format( ".3r" )( d );
					}
				} else {
					//see if we're suppose to display minimal value
					if( displayMinLabel ) {
						formattedNumber = ( minData )? minData: 0;
					}
				}
				return formattedNumber;
			} );
			if( i < (length - 1) ) {
				return valueArr[ 0 ];
			} else {
				//need to use tspan with preserve to have the whitespcae
				return "<tspan class='last-label-tspan'>" + valueArr[ 0 ] + "</tspan><tspan class='last-label-tspan'>" + valueArr[ 1 ] + "</tspan>";
			}

		};

		var formatCategoricalLegendLabel = function( i, scale ) {
			return scale.domain()[ i ];
		};

		var onResize = function(offsetY, availableHeight) {
			if (!g) return;

			//refresh container height
			containerHeight = datamap.node().getBoundingClientRect().height;
			//position legend vertically
			var legendY = (offsetY+availableHeight) - legendOffsetY - stepSizeHeight;
			if( orientation === "landscape" ) {
				legendY -= descriptionHeight;
			}

			var timelineControls = d3.select( ".map-timeline-controls" );
			if (!timelineControls.empty()) {
				var controlsBoundingRect = timelineControls.node().getBoundingClientRect(),
					controlsHeight = controlsBoundingRect.bottom - controlsBoundingRect.top;
				legendY -= controlsHeight;
			}

			container.attr( "transform", "translate(0," + legendY + ")" );
		};

		function legend( selection ) {
			selection.each( function( data ) {
				datamap = d3.select( ".datamap" );
				container = d3.select( this );
				isCategoricalScale = ( !scale || !scale.hasOwnProperty( "invertExtent" ) )? true: false;
				descriptionHeight = ( data.description && data.description.length )? 12: 0;
				g = container.select( ".legend" );

				if( g.empty() ) {
					g = selection.append( "g" )
							.attr( "id", "legend" )
							.attr( "class", "legend" );
				}
				
				//start with highest value
				//data.reverse();

				//data join
				var legendSteps = g.selectAll( "." + stepClass ).data( data.scheme );
				
				//enter
				var legendStepsEnter = legendSteps.enter()
					.append( "g" )
						.attr( "class", stepClass );
				legendStepsEnter.append( "rect" );
				legendStepsEnter.append( "line" );
				legendStepsEnter.append( "text" );

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
				/*legendSteps.selectAll( "line" )
					.attr( "x1", 0 ).attr( "y1", -5 )
					.attr( "x2", 0 ).attr( "y2", stepSize+5 );*/
				legendSteps.select( "rect" )
					.style( "fill", function( d, i ) {
							return d;
						} );
				
				//is there custom labeling for 
				var legendStepsTexts = legendSteps.select( "text" )
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
										return "translate(-2,-5)";
									} else {
										return "translate(" + stepSizeX + ",-5) rotate(270)";
									}
								}
							} )
							.html( function( d, i ) {
								return ( labels && labels[ i ] )? labels[ i ]:
								( !isCategoricalScale )?
									formatLegendLabel( scale.invertExtent( d ), i, data.scheme.length ):
									formatCategoricalLegendLabel( i, scale );
							} );
				
				//position last tspans
				var legendStepsTspans = legendStepsTexts.selectAll( "tspan.last-label-tspan" ),
					firstTspanLength = 0;
				legendStepsTspans.each( function( d, i ) {
					
					var dx, dy;

					if ( orientation === "landscape" ) {
						if( i === 0 ) {
							firstTspanLength = this.getComputedTextLength();
						} else {
							dx = stepSizeWidth - firstTspanLength;
							dy = 0; //need to reset possible previous offset
							d3.select( this ).attr( { "dx": dx, "dy": dy } );
						}
					} else {
						//portrait 
						if( i === 0 ) {
							firstTspanLength = this.getComputedTextLength();
						} else if( i === 1 ) {
							dx = -firstTspanLength; //need to reset possible previous offset
							dy = stepSizeHeight;
							d3.select( this ).attr( { "dx": dx, "dy": dy } );
						}
					}
				} );
				
				//exit
				legendSteps.exit().remove();

				//legend description
				gDesc = container.selectAll( ".legend-description" ).data( [data.description] );
				gDesc.enter()
					.append( "text" )
					.attr( "class", "legend-description" );
				gDesc
					.text( data.description );
				gDesc.attr( "transform", function( d, i ) { var translateX = legendOffsetX, translateY = ( orientation === "landscape" )? stepSizeHeight+descriptionHeight: stepSizeHeight; return ( orientation === "landscape" )? "translate(" + translateX + "," + translateY + ")": "translate(" + translateX + "," + translateY + ") rotate(270)"; } );

			} );

			return legend;

		}

		legend.onResize = onResize;

		//public methods
		legend.stepSizeWidth = function( value ) {
			if( !arguments.length ) {
				return stepSizeWidth;
			} else {
				stepSizeWidth = parseInt( value, 10);
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

		return legend;

	};
})();