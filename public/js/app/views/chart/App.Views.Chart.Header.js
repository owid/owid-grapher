;( function() {
	
	"use strict";

	App.Views.Chart.Header = Backbone.View.extend({

		el: "#chart-view .chart-header",
		events: {},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			
			this.$tabs = this.$el.find( ".header-tab" );
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
				var tab = that.$tabs.filter( "." + v + "-header-tab" );
				tab.show();
				if( i === 0 ) {
					tab.addClass( "active" );
				}
			} );

		}

	});

})();