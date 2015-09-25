;( function() {
	
	"use strict";

	App.Views.Chart.Map.Legend = function() {

		//private
		var stepSize = 20,
			stepClass = "legend-step",
			scale;

		var formatLegendLabel = function( valueArr ) {
			valueArr = valueArr.map( function( d ) {
				return Math.round( d );
			} );
			return valueArr.join( " – " );
		};

		function legend( selection ) {

			selection.each( function( data ) {

				var container = d3.select( this ),
					containerHeight = container.node().getBoundingClientRect().height,
					legendOffset = 10,
					stepGap = 2,
					g = container.select( ".legend" );

				if( g.empty() ) {
					g = selection.append( "g" )
							.attr( "id", "legend" )
							.attr( "class", "legend" );
				}
			
				//data join
				var legendSteps = g.selectAll( "." + stepClass ).data( data );
				
				//enter
				var legendStepsEnter = legendSteps.enter()
					.append( "g" )
						.attr( "class", stepClass )
						.attr( "transform", function( d, i ) { var translateY = containerHeight - legendOffset - stepSize - ( i*(stepSize+stepGap) ); return "translate(" + legendOffset + "," + translateY + ")"; } );
				legendStepsEnter.append( "rect" )
					.attr( "width", stepSize + "px" )
					.attr( "height", stepSize + "px" );
				legendStepsEnter.append( "text" )
					.attr( "transform", function( d, i ) { return "translate( " + (parseInt( stepSize/1.4, 10 ) + 10) + ", " + parseInt( stepSize/1.4, 10 ) + " )"; } );

				//update
				legendSteps.select( "rect" )
					.style( "fill", function( d, i ) {
							return d;
						} );
				legendSteps.select( "text" )
					.text( function( d, i ) { return formatLegendLabel( scale.invertExtent( d ) ); } );

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