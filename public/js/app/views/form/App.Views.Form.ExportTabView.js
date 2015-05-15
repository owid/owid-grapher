;( function() {
	
	"use strict";

	App.Views.Form.ExportTabView = Backbone.View.extend({

		el: "#form-view #export-tab",
		events: {},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			this.dispatcher.on( "chart-saved", this.onChartSaved, this );
			this.render();

		},

		render: function() {
			this.$iframeTextArea = this.$el.find( "[name=iframe]" );
		},

		onChartSaved: function( id, viewUrl ) {
			this.generateIframeCode( id, viewUrl );
		},

		generateIframeCode: function( id, viewUrl ) {
			this.$iframeTextArea.text( '<iframe src="' + viewUrl + '" style="width: 100%; height: 100%;"></iframe>' );
		}

	});

})();