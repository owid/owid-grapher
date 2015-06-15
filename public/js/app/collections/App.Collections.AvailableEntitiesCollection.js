;( function() {
		
	"use strict";

	App.Collections.AvailableEntitiesCollection = Backbone.Collection.extend( {

		model: App.Models.EntityModel,
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

		updateEntities: function( ids ) {

			var ids = this.getVariableIds();
			this.url = this.urlRoot + "?variableIds=" + ids.join(",");
			this.fetch( {
				success: function( collection, response ) {
					console.log( "response", response );
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

})();