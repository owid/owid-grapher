;( function() {

	"use strict";

	App.Utils = {};
	
	App.Utils.mapData = function( rawData ) {

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


})();