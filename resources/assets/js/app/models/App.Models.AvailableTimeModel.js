;( function() {
		
	"use strict";

	var App = require( "./../namespaces.js" );

	App.Models.AvailableTimeModel = Backbone.Model.extend( {

		urlRoot: Global.rootUrl + '/data/times',
		
		initialize: function () {

			App.ChartVariablesCollection.on( "add", this.onVariableAdd, this );
			App.ChartVariablesCollection.on( "remove", this.onVariableRemove, this );
			
		},

		parse: function( response ) {

			//isn't it interval data?
			var max, min;
			_.some( response.data, function( d,i ) {
				if( d.fk_ttype_id === "5" ) {
					var intervalString = parseInt( d.startDate, 10 ) + "-" + parseInt( d.endDate, 10 );
					max = intervalString;
					min = intervalString;
					return true;
				}
			} );

			if( !max && !min ) {
				//is not interval data
				max = d3.max( response.data, function(d) { return parseFloat( d.label ); } );
				min = d3.min( response.data, function(d) { return parseFloat( d.label ); } );
			}
			
			this.set( { "max": max, "min": min } );
		
		},

		onVariableAdd: function( model ) {
			this.updateTime();
		},

		onVariableRemove: function( model ) {
			this.updateTime();
		},

		updateTime: function( ids ) {

			var ids = this.getVariableIds();
			this.url = this.urlRoot + "?variableIds=" + ids.join(",");
			this.fetch();

		},

		getVariableIds: function() {

			var variables = App.ChartVariablesCollection.models,
				ids = _.map( variables, function( v, k ) {
					return v.get( "id" );
				} );
			return ids;

		}


	} );

	module.exports = App.Models.AvailableTimeModel;

})();