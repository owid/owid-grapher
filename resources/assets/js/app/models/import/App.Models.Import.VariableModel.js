;( function() {
		
	"use strict";

	var App = require( "./../../namespaces.js" );
	
	App.Models.Import.VariableModel = Backbone.Model.extend( {
		
		urlRoot: Global.rootUrl + "/variable/",
		defaults: { "name": "", "variableType": "", "unit": "", "description": "" },

		import: function() {

			//strip id, so that backbone uses store 
			this.set( "id", null );

			this.url = this.urlRoot + 'import';

			this.save();

		}

	} );

	module.exports = App.Models.Import.VariableModel;

})();