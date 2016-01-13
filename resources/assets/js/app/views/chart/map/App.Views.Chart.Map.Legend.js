;( function() {
	
	"use strict";

	var App = require( "./../../../namespaces.js" );

	App.Views.Chart.Map.Legend = function() {

		//private
		var stepSize = 20,
			stepClass = "legend-step",
			legendOffsetX = 10,
			legendOffsetY = 60,
			stepGap = 2,
			displayMinLabel = true,
			scale, minData, maxData, datamap, container, containerHeight, isOrdinalScale, descriptionHeight, g, gDesc;

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
				return "<tspan xml:space='preserve'>" + valueArr.join( "   " ) + "</tspan>";
			}

		};

		var formatOrdinalLegendLabel = function( i, scale ) {
			return scale.domain()[ i ];
		};

		var resize = function() {
			//check legend is constructed already
			if( g ) {
				//refresh container height
				containerHeight = datamap.node().getBoundingClientRect().height;
				//position legend vertically
				var legendY = containerHeight - legendOffsetY - stepSize - descriptionHeight;
				container.attr( "transform", "translate(0," + legendY + ")" );
			}
		};

		function legend( selection ) {

			selection.each( function( data ) {
				
				datamap = d3.select( ".datamap" );
				container = d3.select( this );
				isOrdinalScale = ( !scale || !scale.hasOwnProperty( "invertExtent" ) )? true: false;
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
				legendStepsEnter.append( "rect" )
					.attr( "width", stepSize + "px" )
					.attr( "height", stepSize + "px" );
				legendStepsEnter.append( "text" )
					.attr( "transform", function( d, i ) { return ( !isOrdinalScale )? "translate(-2,-5)": "translate(15,-5) rotate(270)"; } );

				//update
				legendSteps.attr( "transform", function( d, i ) { var translateX = legendOffsetX + (i*(stepSize+stepGap)), translateY = 0; return "translate(" + translateX + "," + translateY + ")"; } );
				legendSteps.select( "rect" )
					.style( "fill", function( d, i ) {
							return d;
						} );

				legendSteps.select( "text" )
					.html( function( d, i ) { return ( !isOrdinalScale )? formatLegendLabel( scale.invertExtent( d ), i, data.scheme.length ): formatOrdinalLegendLabel( i, scale ) ; } );

				//exit
				legendSteps.exit().remove();

				//legend description
				gDesc = container.selectAll( ".legend-description" ).data( [data.description] );
				gDesc.enter()
					.append( "text" )
					.attr( "class", "legend-description" );
				gDesc
					.text( data.description );
				gDesc.attr( "transform", function( d, i ) { var translateX = legendOffsetX, translateY = stepSize+descriptionHeight; return "translate(" + translateX + "," + translateY + ")"; } );

				//position legend vertically
				resize();

			} );

			return legend;

		}

		legend.resize = resize;

		//public methods
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

		return legend;

	};

	module.exports = App.Views.Chart.Map.Legend;

})();