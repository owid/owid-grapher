;( function() {
		
	"use strict";

	App.Models.ChartModel = Backbone.Model.extend( {

		urlRoot: Global.rootUrl + '/charts',

		defaults: {
			"selected-countries": {},
			//"selected-countries": [ "France", "Germany" ],
			"variables": [],
			"y-axis": {},
			"x-axis": {}
		},

		addSelectedCountry: function( country ) {

			var selectedCountries = this.get( "selected-countries" );
			selectedCountries[ country.name ] = country;
			this.trigger( "change:selected-countries" );
			this.trigger( "change" );
			
			//this.set( "selected-countries", this.get( "selected-countries" ).concat( country ) ); 

		},

		updateSelectedCountry: function( countryName, color ) {

			var selectedCountries = this.get( "selected-countries" ),
				country = selectedCountries[ countryName ];
			if( country ) {
				country.color = color;
				this.trigger( "change:selected-countries" );
				this.trigger( "change" );
			} 

		},

		removeSelectedCountry: function( countryName ) {

			var selectedCountries = this.get( "selected-countries" );
			if( selectedCountries[ countryName ] ) {
				delete selectedCountries[ countryName ];
				this.trigger( "change:selected-countries" );
				this.trigger( "change" );
			}

			/*var selectedCountries = this.get( "selected-countries" ).slice( 0 );
			selectedCountries = _.filter( selectedCountries, function( value, key, list ) {
				return ( value != countryName )? true: false;
			} );
			this.set( "selected-countries", selectedCountries );*/

		},

		setAxisConfig: function( axisName, prop, value ) {

			var axis = this.get( axisName );
			if( axis ) {
				axis[ prop ] = value;
			}
			this.trigger( "change" );

		},

		updateVariables: function( newVar ) {
			//copy array
			var variables = this.get( "variables" ).slice(),
				varInArr = _.find( variables, function( v ){ return v.id == newVar.id; })

			if( !varInArr ) {
				variables.push( newVar );
				this.set( "variables", variables );
			}
		},

		removeVariable: function( varIdToRemove ) {
			//copy array
			var variables = this.get( "variables" ).slice(),
				varInArr = _.find( variables, function( v ){ return v.id == newVar.id; })

			if( !varInArr ) {
				variables.push( newVar );
				this.set( "variables", variables );
			}
		}


	} );

})();