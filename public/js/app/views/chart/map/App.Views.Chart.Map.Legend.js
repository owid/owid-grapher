;( function() {
	
	"use strict";

	App.Views.Chart.Map.Legend = function() {

		//private
		var stepSize = 20,
			stepClass = "legend-step",
			scale;

		function legend( selection ) {

			selection.each( function( data ) {

				var container = d3.select( this ),
					g = container.select( ".colorbar" );

				if( g.empty() ) {
					g = selection.append( "g" )
							.attr( "id", "colorBar" )
							.attr( "class", "colorbar" );
				}
				
				//data join
				var legendSteps = g.selectAll( "." + stepClass ).data( data );
				
				//enter
				var legendStepsEnter = legendSteps.enter()
					.append( "g" )
						.attr( "class", stepClass )
						.attr( "transform", function( d, i ) { return "translate(0," + i*stepSize + ")"; } );
				legendStepsEnter.append( "rect" )
					.attr( "width", stepSize + "px" )
					.attr( "height", stepSize + "px" );
				legendStepsEnter.append( "text" )
					.attr( "transform", function( d, i ) { return "translate( " + (parseInt( stepSize, 10 ) + 10) + ", 0 )"; } );

				//update
				legendSteps.select( "rect" )
					.style( "fill", function( d, i ) {
							return d;
						} );
				legendSteps.select( "text" )
					.text( function( d, i ) { return scale.invertExtent( d ); } );

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