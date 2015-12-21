;( function() {
	
	"use strict";
	
	var App = require( "./../../namespaces.js" );

	App.Views.Chart.Header = Backbone.View.extend({

		el: "#chart-view .chart-header",
		events: {},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			
			this.$logo = this.$el.find( ".logo" );
			this.$tabs = this.$el.find( ".header-tab" );
			this.render();

			//setup events
			App.ChartModel.on( "change", this.render, this );

		},

		render: function() {
			
			var logo = App.ChartModel.get( "logo" ),
				tabs = App.ChartModel.get( "tabs" ),
				defaultTab = App.ChartModel.get( "default-tab" ),
				openDefault = ( this.$tabs.filter( ".active" ).length )? false: true;
			
			//setup image for header
			if( logo ) {
				this.$logo.attr( "src", Global.rootUrl + "/" + logo );
				this.$logo.css( "visibility", "visible" );
			}
			
			//hide first everything
			this.$tabs.hide();

			var that = this;
			_.each( tabs, function( v, i ) {
				var tab = that.$tabs.filter( "." + v + "-header-tab" );
				tab.show();
				if( v === defaultTab && openDefault ) {
					tab.addClass( "active" );
				}
			} );

			//for first visible tab, add class for border-left, cannot be done in pure css http://stackoverflow.com/questions/18765814/targeting-first-visible-element-with-pure-css
			this.$tabs.removeClass( "first" );
			this.$tabs.filter( ":visible:first" ).addClass( "first" );
			
		}

	});

	module.exports = App.Views.Chart.Header;

})();