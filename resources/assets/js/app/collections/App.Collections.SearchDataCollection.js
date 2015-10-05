;( function() {
		
	"use strict";

	var App = require( "./../namespaces.js" );

	App.Collections.SearchDataCollection = Backbone.Collection.extend( {

		//model: App.Models.EntityModel,
		urlRoot: Global.rootUrl + '/data/search',
		
		initialize: function () {

			//App.ChartVariablesCollection.on( "add", this.onVariableAdd, this );
			//App.ChartVariablesCollection.on( "remove", this.onVariableRemove, this );
				
		},

		parse: function( response ){
			return response.data;
		},

		/*onVariableAdd: function( model ) {
			this.updateEntities();
		},

		onVariableRemove: function( model ) {
			this.updateEntities();
		},*/

		search: function( s ) {

			this.url = this.urlRoot + "?s=" + s;

			var that = this;
			this.fetch( {
				success: function( collection, response ) {
					that.trigger( "fetched" );
				}
			});

		}

	} );

	module.exports = App.Collections.SearchDataCollection;

})();