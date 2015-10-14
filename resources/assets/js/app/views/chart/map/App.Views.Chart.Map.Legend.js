;( function() {
	
	"use strict";

	var App = require( "./../../../namespaces.js" );

	App.Views.Chart.Map.Legend = function() {

		//private
		var stepSize = 20,
			stepClass = "legend-step",
			scale;

		var formatLegendLabel = function( valueArr, i, length ) {
			
			valueArr = valueArr.map( function( d ) {
				var len = d.toString().length,
					formattedNumber = d;
				if( len > 3 ) {
					formattedNumber = d3.format( ".3r" )( d );
				}
				return formattedNumber;
			} );
			if( i < (length - 1) ) {
				return valueArr[ 0 ];
			} else {
				return valueArr.join( " &nbsp; " );
			}
		};

		function legend( selection ) {

			selection.each( function( data ) {
				
				var datamap = d3.select( ".datamap" ),
					container = d3.select( this ),
					containerHeight = datamap.node().getBoundingClientRect().height,
					legendOffset = 10,
					descriptionHeight = ( data.description && data.description.length )? 12: 0,
					stepGap = 2,
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
					.attr( "transform", function( d, i ) { return "translate(-2,-5)"; } );

				//update
				legendSteps.attr( "transform", function( d, i ) { var translateX = legendOffset + (i*(stepSize+stepGap)), translateY = containerHeight - legendOffset - stepSize - descriptionHeight; return "translate(" + translateX + "," + translateY + ")"; } );
				legendSteps.select( "rect" )
					.style( "fill", function( d, i ) {
							return d;
						} );
				legendSteps.select( "text" )
					.html( function( d, i ) { return formatLegendLabel( scale.invertExtent( d ), i, data.length ); } );

				//exit
				legendSteps.exit().remove();

				//legend description
				var gDesc = container.selectAll( ".legend-description" ).data( [data.description] );
				gDesc.enter()
					.append( "text" )
					.attr( "class", "legend-description" );
				gDesc
					.text( data.description )
					.attr( "transform", function( d, i ) { var translateX = legendOffset, translateY = containerHeight - legendOffset; return "translate(" + translateX + "," + translateY + ")"; } );
			
			} );

			return legend;

		}

		//public methods
		legend.scale = function( value ) {
			if( !arguments.length ) {
				return scale;
			} else {
				scale = value;
			}
		};

		return legend;

	};

	module.exports = App.Views.Chart.Map.Legend;

})();