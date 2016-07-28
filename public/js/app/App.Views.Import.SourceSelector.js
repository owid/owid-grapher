;(function() {	
	"use strict";
	owid.namespace("App.Views.Import.SourceSelector");

	App.Views.Import.SourceSelector = owid.View.extend({
		el: ".source-selector",
		initialize: function($variable) {
			this.$variable = $variable;
			this.$el.modal('show');
			this.$select = this.$("select.source");
			this.$select.empty();

			this.sources = _.indexBy(App.DatasetModel.getSources(), 'name');

			_.each(this.sources, function(source) {
				this.$select.append('<option value="' + source.name + '">' + source.name + '</option>');
			}.bind(this));

			this.$(".source-editor").wysihtml5({
				html: true,
				toolbar: {
					fa: true
				}
			});
		}
	});
})();