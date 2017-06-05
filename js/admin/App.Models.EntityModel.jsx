;(function() {		
	"use strict";
	owid.namespace("App.Models.EntityModel");
	
	App.Models.EntityModel = Backbone.Model.extend({		
		urlRoot: Global.adminRootUrl + "/entity/",
		defaults: { "id": "", "name": "", "values": [] },

		import: function() {

			//strip id, so that backbone uses store 
			this.set( "id", null );

			this.url = this.urlRoot + 'import';

			this.save();

		}

	});
})();