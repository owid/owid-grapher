;(function() {		
	"use strict";
	owid.namespace("App.Models.ChartDimensionsModel");
	
	App.Models.ChartDimensionsModel = Backbone.Model.extend( {

		urlRoot: Global.rootUrl + '/chartTypes/',

		defaults: {},

		loadConfiguration: function(chartTypeId, callback)  {
			this.set("id", chartTypeId);
			this.fetch({
				success: callback
			});
		}
	} );
})();