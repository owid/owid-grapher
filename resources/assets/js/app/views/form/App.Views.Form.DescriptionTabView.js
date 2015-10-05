;( function() {
	
	"use strict";

	App.Views.Form.DescriptionTabView = Backbone.View.extend({

		el: "#form-view #sources-tab",
		events: {},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			var that = this;

			this.$textArea = this.$el.find( "textarea" );
			this.$textArea.val( App.ChartModel.get( "chart-description" ) );

			this.$textArea.wysihtml5( {
				"events": {
					"change": function( evt ) {
						that.onFormControlChange( that.$textArea );
					}
				}
			});

			this.render();

		},

		render: function() {

		},

		onFormControlChange: function( evt ) {

			var textAreaValue = this.$textArea.val();
			App.ChartModel.set( "chart-description", textAreaValue );

		}


	});

	module.exports = App.Views.Form.DescriptionTabView;

})();