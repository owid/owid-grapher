;(function() {		
	"use strict";
	owid.namespace("App.Collections.AvailableEntitiesCollection");

	var EntityModel = require("App.Models.EntityModel");

	App.Collections.AvailableEntitiesCollection = Backbone.Collection.extend( {
		model: EntityModel,
		urlRoot: Global.rootUrl + '/data/entities',
		
		initialize: function () {
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

/*			var variables = App.ChartVariablesCollection.models,
				ids = _.map( variables, function( v, k ) {
					return v.get( "id" );
				} );
			return ids;*/

		}


	} );
})();