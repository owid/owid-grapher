;( function() {
		
	"use strict";

	var App = require( "./../namespaces.js" );
	
	App.Models.VariableModel = Backbone.Model.extend( {
		
		urlRoot: Global.rootUrl + "/variable/",
		defaults: { "id": "", "name": "", "values": [] },

		import: function() {

			//strip id, so that backbone uses store 
			this.set( "id", null );

			this.url = this.urlRoot + 'import';

			this.save();

		}

	} );

	module.exports = App.Models.VariableModel;

})();