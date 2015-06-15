;( function() {
		
	"use strict";

	App.Models.ChartModel = Backbone.Model.extend( {

		//urlRoot: Global.rootUrl + '/charts/',
		//urlRoot: Global.rootUrl + '/data/config/',
		url: function() {
			if( $("#form-view").length ) {
				if( this.id ) {
					//editing existing
					return Global.rootUrl + "/charts/" + this.id;
				} else {
					//saving new
					return Global.rootUrl + "/charts";
				}
				
			} else {
				return Global.rootUrl + "/data/config/" + this.id;
			}
		},

		defaults: {
			"selected-countries": {},
			"tabs": [ "chart", "data", "sources" ],
			"line-type": "2",
			"chart-description": "",
			"chart-dimensions": [],
			//"selected-countries": [ "France", "Germany" ],
			"variables": [],
			"y-axis": {},
			"x-axis": {},
			"margins": { top: 100, left: 80, bottom: 100, right: 80 },
			"unit": "",
			"iframe-width": "100%",
			"iframe-height": "100%"
		},

		initialize: function() {

		},

		addSelectedCountry: function( country ) {

			//make sure we're using object, not associative array
			if( $.isArray( this.get( "selected-countries" ) ) ) {
				//we got empty array from db, convert to object
				this.set( "selected-countries", {} );
			}

			var selectedCountries = this.get( "selected-countries" );
			selectedCountries[ country.name ] = country;
			this.trigger( "change:selected-countries" );
			this.trigger( "change" );
			
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