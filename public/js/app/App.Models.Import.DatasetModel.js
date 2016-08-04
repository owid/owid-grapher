;( function() {
	"use strict";
	owid.namespace("App.Models.Import.DatasetModel");

	App.Models.Import.DatasetModel = Backbone.Model.extend({	
		defaults: {
			id: null,
			name: "",
			description: "",
			categoryId: null,
			subcategoryId: null,
			// Info for existing variables is retrieved if the user selects an existing dataset			
			oldVariables: [],
			// New variable metadata to be stored
			newVariables: []
		},

		initialize: function(options) {
			this.dispatcher = options.dispatcher;
			this.on("change:id", this.fetchExisting.bind(this));
			this.on("change:newVariables", this.setDefaultSources.bind(this));
		},

		getSources: function() {
			var sources = _.filter(_.map(this.get("oldVariables").concat(this.get("newVariables")), function(variable) {
				return variable.source;
			}), function(source) {
				return !!source;
			});

			return _.uniq(sources, function(source) { return source.name; });
		},

		// When at least one source becomes available, all variables without a source
		// set inherit that as their default. This is either the first source in the dataset
		// if it already exists, or the first source the user enters in the importer.
		setDefaultSources: function() {
			var sources = this.getSources();
			if (!sources.length) return;

			_.each(this.get("newVariables"), function(variable) {
				if (!variable.source) variable.source = sources[0];
			});
		},

		fetchExisting: function() {
			var id = this.get("id");
			if (!id) {
				if (this.req) this.req.abort();
				this.set("name", "");
				this.set("description", "");
				this.set("oldVariables", []);
				return;
			}

			this.req = $.get(Global.rootUrl + "/datasets/" + id + ".json")
				.done(function(data) { 
					this.set(_.omit(data, 'variables'));
					this.set("oldVariables", data.variables);
				}.bind(this))
				.fail(function(err) {
					if (err.statusText == "abort") return;
					owid.reportError(err, "Unable to load dataset " + this.datasetId + " \"" + this.datasetName + "\"");
				}.bind(this));
		}
	});
})();