;( function() {
		
	"use strict";

	App.Models.Import.DatasetModel = Backbone.Model.extend( {
		
		urlRoot: Global.rootUrl + "/dataset/",
		defaults: { "id": "", "name": "", "values": [] },

		import: function() {

			//strip id, so that backbone uses store 
			this.set( "id", null );

			this.url = this.urlRoot + 'import';

			this.save();

		}

	} );

})();