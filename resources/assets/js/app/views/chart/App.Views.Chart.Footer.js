;( function() {
	
	"use strict";
	
	var App = require( "./../../namespaces.js" );

	App.Views.Chart.Footer = Backbone.View.extend({

		el: "#chart-view .chart-footer",
		events: {},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;

			this.$chartExportBtn = this.$el.find( ".chart-export-btn" );
			this.render();
		
			$( "[data-toggle='tab']" ).on( "shown.bs.tab", $.proxy( this.onShownTab, this ) );
		
		},

		render: function() {

			var defaultTab = App.ChartModel.get( "default-tab" );
			if( defaultTab === "chart" ) {
				this.toggleFooter( true );
				this.toggleExport( true );
			} else if( defaultTab === "data" ) {
				this.toggleFooter( true );
				this.toggleExport( false );
			} else if( defaultTab === "map" ) {
				this.toggleFooter( true );
				this.toggleExport( true );
			} else {
				this.toggleFooter( false );
			}
			
		},

		toggleFooter: function( enable ) {
			if( enable ) {
				this.$el.show();
			} else {
				this.$el.hide();
			}
		},

		toggleExport: function( enable ) {
			if( enable ) {
				this.$chartExportBtn.show();
			} else {
				this.$chartExportBtn.hide();
			}
		},

		onShownTab: function( evt ) {
			
			evt.preventDefault();
			
			var $target = $( evt.currentTarget ),
				href = $target.attr( "href" );

			if( href === "#chart-chart-tab" ) {
				this.toggleFooter( true );
				this.toggleExport( true );
			} else if( href === "#data-chart-tab" || href === "#map-chart-tab" ) {
				this.toggleFooter( true );
				this.toggleExport( false );
			} else if( href === "#map-chart-tab" ) {
				this.toggleFooter( true );
				this.toggleExport( true );
			} else if( href === "#sources-chart-tab" ) {
				this.toggleFooter( true );
				this.toggleExport( false );
			}

		}

	});

	module.exports = App.Views.Chart.Footer;

})();