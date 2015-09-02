;( function() {
		
	"use strict";

	App.Models.Import.VariableModel = Backbone.Model.extend( {
		
		urlRoot: Global.rootUrl + "/variable/",
		defaults: { "id": "", "name": "", "values": [] },

		import: function() {

			//strip id, so that backbone uses store 
			this.set( "id", null );

			this.url = this.urlRoot + 'import';

			this.save();

		}

	} );

})();