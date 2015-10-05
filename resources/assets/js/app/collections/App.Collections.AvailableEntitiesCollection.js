;( function() {
		
	"use strict";

	var App = require( "./../namespaces.js" ),
		EntityModel = require( "./../models/App.Models.EntityModel.js" );

	App.Collections.AvailableEntitiesCollection = Backbone.Collection.extend( {

		model: EntityModel,
		urlRoot: Global.rootUrl + '/data/entities',
		
		initialize: function () {

			App.ChartVariablesCollection.on( "add", this.onVariableAdd, this );
			App.ChartVariablesCollection.on( "remove", this.onVariableRemove, this );
			
		},

		parse: function( response ){
			return response.data;
		},

		onVariableAdd: function( model ) {
			this.updateEntities();
		},

		onVariableRemove: function( model ) {
			this.updateEntities();
		},

		updateEntities: function() {

			var ids = this.getVariableIds();
			this.url = this.urlRoot + "?variableIds=" + ids.join(",");

			var that = this;
			this.fetch( {
				success: function( collection, response ) {
					that.trigger( "fetched" );
				}
			});

		},

		getVariableIds: function() {

			var variables = App.ChartVariablesCollection.models,
				ids = _.map( variables, function( v, k ) {
					return v.get( "id" );
				} );
			return ids;

		}


	} );

	module.exports = App.Collections.AvailableEntitiesCollection;
	
})();