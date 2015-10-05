;( function() {
		
	"use strict";

	App.Models.EntityModel = Backbone.Model.extend( {
		
		urlRoot: Global.rootUrl + "/entity/",
		defaults: { "id": "", "name": "", "values": [] },

		import: function() {

			//strip id, so that backbone uses store 
			this.set( "id", null );

			this.url = this.urlRoot + 'import';

			this.save();

		}

	} );

	module.exports = App.Models.EntityModel;

})();