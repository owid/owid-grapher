;( function() {
	
	"use strict";

	App.Views.Chart.Header = Backbone.View.extend({

		el: "#chart-view .chart-header",
		events: {},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			
			this.$tabs = this.$el.find( ".header-tab" );
			/*this.$chartTab = this.$el.find( ".chart-header-tab" );
			this.$dataTab = this.$el.find( ".data-header-tab" );
			this.$mapTab = this.$el.find( ".map-header-tab" );
			this.$sourcesTab = this.$el.find( ".sources-header-tab" );*/

			this.render();

			
			//setup events
			App.ChartModel.on( "change", this.render, this );

		},

		render: function() {
			
			var tabs = App.ChartModel.get( "tabs" );
			
			//hide first everything
			this.$tabs.hide();

			var that = this;
			_.each( tabs, function( v, i ) {
				that.$tabs.filter( "." + v + "-header-tab" ).show();
			} );	

		}

	});

})();