// Wrapping in nv.addGraph allows for '0 timeout render', stores rendered charts in nv.graphs, and may do more in the future... it's NOT required
var chart;

function tooltipContent(key, y, e, graph) {
	return '<h3>' + key + '</h3>' +'<p>' + y + '$</p>' ;
}

function initChart( data, config ) {

	console.log( "initChart" );

	var x = config.x,
		y = config.y;

	nv.addGraph(function() {
		chart = nv.models.lineChart()
			.options({
				transitionDuration: 300,
				margin: { top: 100, left: 120, bottom: 20, right: 50 },
				//useInteractiveGuideline: true,
				tooltipContent: tooltipContent/*,
				x: x,
				y: y*/

			})
		;

		// chart sub-models (ie. xAxis, yAxis, etc) when accessed directly, return themselves, not the parent chart, so need to chain separately
		chart.xAxis
			//.scale( logScale )
			.axisLabel( "Year" )
			//.tickFormat( d3.format(',.2f') )
			.staggerLabels( true )
		;

		//var scale = d3.scale.linear();
		//scale.domain( [0, 200 ] );
		
		//chart.forceY( [0, 200000] );
		//chart.yDomain( [0, 300000] );

		chart.yAxis
			//.scale( scale )
			.axisLabel( "Books" )
			//.tickFormat(d3.format(',.2f'))
		;

		/*var data = sinAndCos();
		data.forEach( function( object, i, arr ) {

			object.values = object.values.filter( function( v ) {
				return true;
				//return ( v.y > .5 )? false : true;
			} );

		});*/
		
		var svgSelection = d3.select( "svg" )
			.datum(data)
			.call(chart)
			;

		nv.utils.windowResize(chart.update);

		return chart;
	});

}

var countries = [ "Great Britain", "Ireland" ],
	data = [],
	filteredData = [];

setTimeout( function() {

	//clone array
	filteredData = data.splice( 0 );
	filteredData = filteredData.filter( function( v, i, arr ) {
		return ( countries.indexOf( v.key ) > - 1 ) ? true : false;
	} );
	
	//initChart( filteredData, {} );

}, 1000 );

//testing import from local system
var onCsvSelected = function( err, data ) {

	if( err ) { 
		console.error( err );
		return;
	}

	if( data && data.rows ) {

		var mappedData = mapData( data.rows );
		initChart( mappedData, {} );

		//reset file picker
		$( "#myfilepicker" ).replaceWith( $("#myfilepicker").clone() );
		$( "#myfilepicker" ).prop( "disabled", false);
		CSV.begin( "#myfilepicker" ).go( onCsvSelected );

	} else {

		console.error( "Something wrong with upload" );

	}
	
}
CSV.begin( "#myfilepicker" ).go( onCsvSelected );


var mapData = function( rawData ) {

	var data = [],
		dataById = [],
		countryIndex = 1;

	rawData.forEach( function( row, i, Arr ) {

		var cellIndex = 0, timestamp = 0;
		for( var cellName in row ) {

			if( cellIndex !== 0 ) {
			
				var countryObj;
				if( i == 0 ) {
					
					countryObj = {
						id: cellIndex,
						key: row[cellName],
						values: []
					};
					dataById[ cellName ] = countryObj
				
				} else {

					countryObj = dataById[ cellIndex ];

					var value = +row[cellName];
					if( !isNaN( value ) && value > 0 ) {
						countryObj.values.push( { x: +timestamp, y: +row[cellName] } );
					}
					
				}
			
			} else {

				timestamp = row[ cellName ];

			}
			
			cellIndex++;
			
		}

	} );

	//map from associative array to 
	for( var countryName in dataById ) {
		data.push( dataById[ countryName ] );
	}

	return data;

}

//testing import csv
/*d3.csv( "data/books_test.csv", function( error, rawData ) {

	//remap data
	var dataByCountry = [],
		countryIndex = 1;

	rawData.forEach( function( row ) {

		var timestamp = row.century;

		for( var cellName in row ) {

			if( cellName !== "century" ) {

				var value = row[ cellName ];

				//do we have country object already
				var countryObj = dataByCountry[ cellName ];
				if( !countryObj ) {
					//create country object
					countryObj = {
						id: countryIndex,
						key: cellName,
						values: []
					};
					dataByCountry[ cellName ] = countryObj
					countryIndex++;
				}

				countryObj.values.push( { x: +timestamp, y: +value } );

			}
			
		}

	} );

	//map from associative array to 
	for( var countryName in dataByCountry ) {
		data.push( dataByCountry[ countryName ] );
	}

	initChart( data, {} );

} );*/
