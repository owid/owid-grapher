;( function() {
	
	"use strict";
	
	var App = require( "./../../namespaces.js" );

	App.Views.Chart.Header = Backbone.View.extend({

		el: "#chart-view .chart-header",
		events: {},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			
			this.$logo = this.$el.find( ".logo" );
			this.$logoSvg = $( ".chart-logo-svg .logo" );

			this.$tabs = this.$el.find( ".header-tab" );
			this.render();

			//setup events
			App.ChartModel.on( "change", this.render, this );

		},

		render: function() {
			
			var that = this,
				logo = App.ChartModel.get( "logo" ),
				tabs = App.ChartModel.get( "tabs" ),
				defaultTab = App.ChartModel.get( "default-tab" ),
				openDefault = ( this.$tabs.filter( ".active" ).length )? false: true;
			
			//setup image for header
			if( logo ) {

				var fullUrl = Global.rootUrl + "/" + logo;
				this.$logo.attr( "src", fullUrl );
				this.$logo.css( "visibility", "visible" );
				this.$logoSvg.attr( "xlink:href", fullUrl );

				//after logo is loaded, resize svg image to the same 
				this.$logo.on( "load", function() {
					that.$logoSvg.attr( { "width": this.width, "height": this.height } );
				} );

			}
			
			//hide first everything
			this.$tabs.hide();

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