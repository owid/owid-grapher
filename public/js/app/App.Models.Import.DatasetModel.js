;( function() {
	"use strict";
	owid.namespace("App.Models.Import.DatasetModel");

	App.Models.Import.DatasetModel = Backbone.Model.extend({	
		defaults: {
			id: null,
			name: "",
			// Info for existing variables is retrieved if the user selects an existing dataset			
			oldVariables: [],
			// New variable metadata to be stored
			newVariables: []
		},

		initialize: function(options) {
			this.dispatcher = options.dispatcher;
			this.on("change:id", this.fetchExisting.bind(this));
		},

		fetchExisting: function() {
			var id = this.get("id");
			if (!id) return;

			$.get(Global.rootUrl + "/datasets/" + id + ".json")
				.done(function(data) { 
					this.set("oldVariables", data.variables);
				}.bind(this))
				.fail(function(err) {
					owid.reportError(err, "Unable to load dataset " + this.datasetId + " \"" + this.datasetName + "\"");
				}.bind(this));
		}
	});
})();