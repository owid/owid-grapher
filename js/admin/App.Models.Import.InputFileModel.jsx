;( function() {
		
	"use strict";

	var App = require( "./../../namespaces.js" );
	
	App.Models.Import.InputFileModel = Backbone.Model.extend( {
		
		urlRoot: Global.adminRootUrl + "/inputfile/",
		defaults: { "rawData": "", "userId": "" },

		import: function() {

			//strip id, so that backbone uses store 
			this.set( "id", null );

			this.url = this.urlRoot + 'import';

			this.save();

		}

	} );

	module.exports = App.Models.Import.InputFileModel;

})();