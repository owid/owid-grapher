;( function() {
		
	"use strict";

	App.Models.Import.EntityModel = Backbone.Model.extend( {
		
		urlRoot: Global.rootUrl + "/entity/",
		defaults: { "id": "", "name": "", "entType": 5, "values": [] },

		import: function() {

			//strip id, so that backbone uses store 
			this.set( "id", null );

			this.url = this.urlRoot + 'import';

			this.save();

		}

	} );

})();