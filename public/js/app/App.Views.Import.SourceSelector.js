;(function() {	
	"use strict";
	owid.namespace("App.Views.Import.SourceSelector");

	App.Views.Import.SourceSelector = owid.View.extend({
		events: {
			'input [name=source_name]': "onNameChange",
			'change select.source': "onSelectSource",
			'click .btn-success': "onSaveSource"
		},

		initialize: function(variable) {
			this.variable = variable;
			
			this.sources = App.DatasetModel.getSources();
			// There must always be a new source with the default template
			if (!_.findWhere(this.sources, { name: "New source" })) {
				 this.sources.push({
					name: "New source",
					description: $(".sources-default").html()
				});
			}
			this.sourcesByName = _.indexBy(this.sources, 'name');

			if (variable.source)
				this.source = variable.source;
			else
				this.source = _.first(this.sources);

			this.setElement($(".source-selector").clone());
			this.$el.modal('show');
			this.$el.on('hidden.bs.modal', function() {
				this.$el.remove();
			}.bind(this));

			this.$select = this.$("select.source");
			this.$sourceNameInput = this.$("input[name=source_name]");
			this.$sourceDescription = this.$("textarea");
			this.$saveBtn = this.$(".btn-success");

			this.render();
		},

		render: function() {
			this.$select.empty();

			_.each(this.sources, function(source) {
				this.$select.append('<option value="' + source.name + '">' + source.name + '</option>');
			}.bind(this));			
			this.$select.val(this.source.name);

			this.$(".wysihtml5-sandbox, .wysihtml5-toolbar").remove();

			this.$sourceNameInput.val(this.source.name);
			this.$sourceDescription.html(this.source.description);

			this.$sourceDescription.wysihtml5({
				html: true,
				toolbar: {
					fa: true
				}
			});			
		},

		onSelectSource: function() {
			this.source = this.sourcesByName[this.$select.val()];
			this.render();
		},

		onNameChange: function() {
			this.source.name = this.$sourceNameInput.val();
		},

		onSaveSource: function() {
			this.variable.source = this.source;
			App.DatasetModel.trigger("change:newVariables");
			this.$el.modal('hide');
		}
	});
})();