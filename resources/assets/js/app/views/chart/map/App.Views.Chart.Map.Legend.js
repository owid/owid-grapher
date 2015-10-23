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
				//need to use tspan with preserve to have the whitespcae
				return "<tspan xml:space='preserve'>" + valueArr.join( "   " ) + "</tspan>";
			}

		};

		var formatOrdinalLegendLabel = function( i, scale ) {
			return scale.domain()[ i ];
		};

		function legend( selection ) {

			selection.each( function( data ) {
				
				var datamap = d3.select( ".datamap" ),
					container = d3.select( this ),
					containerHeight = datamap.node().getBoundingClientRect().height,
					legendOffsetX = 10,
					legendOffsetY = 60,
					isOrdinalScale = ( !scale || !scale.hasOwnProperty( "invertExtent" ) )? true: false,
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
					.attr( "transform", function( d, i ) { return ( !isOrdinalScale )? "translate(-2,-5)": "translate(15,-5) rotate(270)"; } );

				//update
				legendSteps.attr( "transform", function( d, i ) { var translateX = legendOffsetX + (i*(stepSize+stepGap)), translateY = containerHeight - legendOffsetY - stepSize - descriptionHeight; return "translate(" + translateX + "," + translateY + ")"; } );
				legendSteps.select( "rect" )
					.style( "fill", function( d, i ) {
							return d;
						} );
				legendSteps.select( "text" )
					.html( function( d, i ) { return ( !isOrdinalScale )? formatLegendLabel( scale.invertExtent( d ), i, data.scheme.length ): formatOrdinalLegendLabel( i, scale ) ; } );

				//exit
				legendSteps.exit().remove();

				//legend description
				var gDesc = container.selectAll( ".legend-description" ).data( [data.description] );
				gDesc.enter()
					.append( "text" )
					.attr( "class", "legend-description" );
				gDesc
					.text( data.description )
					.attr( "transform", function( d, i ) { var translateX = legendOffsetX, translateY = containerHeight - legendOffsetY; return "translate(" + translateX + "," + translateY + ")"; } );
			
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