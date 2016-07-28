;(function() {	
	"use strict";
	owid.namespace("App.Views.Import.SourceSelector");

	App.Views.Import.SourceSelector = owid.View.extend({
		el: ".source-selector",
		initialize: function($variable) {
			this.$variable = $variable;
			this.$el.modal('show');

			this.$(".source-editor").wysihtml5('deepExtend', {
				parserRules: {
					tags: {
						table: {},
						tr: {},
						th: {},
						td: {}
					}
				},
				"html": true
			});
		}
	});
})();