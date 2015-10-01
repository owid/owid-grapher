;( function() {
	
	"use strict";

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
				var legendSteps = g.selectAll( "." + stepClass ).data( data );
				
				//enter
				var legendStepsEnter = legendSteps.enter()
					.append( "g" )
						.attr( "class", stepClass )
						.attr( "transform", function( d, i ) { var translateX = legendOffset + (i*(stepSize+stepGap)), translateY = containerHeight - legendOffset - stepSize; return "translate(" + translateX + "," + translateY + ")"; } );
						//.attr( "transform", function( d, i ) { var translateY = containerHeight - legendOffset - stepSize - ( i*(stepSize+stepGap) ); return "translate(" + legendOffset + "," + translateY + ")"; } );
				legendStepsEnter.append( "rect" )
					.attr( "width", stepSize + "px" )
					.attr( "height", stepSize + "px" );
				legendStepsEnter.append( "text" )
					//.attr( "transform", function( d, i ) { return "translate( " + (parseInt( stepSize/1.4, 10 ) + 10) + ", " + parseInt( stepSize/1.4, 10 ) + " )"; } );
					.attr( "transform", function( d, i ) { return "translate(-2,-5)"; } );

				//update
				legendSteps.select( "rect" )
					.style( "fill", function( d, i ) {
							return d;
						} );
				legendSteps.select( "text" )
					.html( function( d, i ) { return formatLegendLabel( scale.invertExtent( d ), i, data.length ); } );

				//exit
				legendSteps.exit().remove();

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

})();