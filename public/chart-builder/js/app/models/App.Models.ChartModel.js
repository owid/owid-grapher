;( function() {
		
	"use strict";

	App.Models.ChartModel = Backbone.Model.extend( {

		defaults: {
			"selected-countries": [ "France", "Germany" ],
			"y-axis": {},
			"x-axis": {}
		},

		addSelectedCountry: function( country ) {

			this.set( "selected-countries", this.get( "selected-countries" ).concat( country ) ); 

		},

		removeSelectedCountry: function( countryName ) {

			var selectedCountries = this.get( "selected-countries" ).slice( 0 );
			selectedCountries = _.filter( selectedCountries, function( value, key, list ) {
				return ( value != countryName )? true: false;
			} );
			this.set( "selected-countries", selectedCountries );

		},

		setAxisConfig: function( axisName, prop, value ) {

			var axis = this.get( axisName );
			if( axis ) {
				axis[ prop ] = value;
			}
			this.trigger( "change" );

		}


	} );

})();