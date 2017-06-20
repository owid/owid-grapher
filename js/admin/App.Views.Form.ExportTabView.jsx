import _ from 'underscore'
import $ from 'jquery'

;(function() {	
	"use strict";
	owid.namespace("App.Views.Form.ExportTabView");

	App.Views.Form.ExportTabView = owid.View.extend({
		el: "#form-view #export-tab",
		events: {
			"click [type='checkbox']": "onTabsCheck",
			"change [name='default-tab']": "onDefaultTabChange",
		},

		initialize: function( options ) {
			this.dispatcher = options.dispatcher;			
			this.render();
		},

		render: function() {
			
			this.$checkboxes = this.$el.find( "[type='checkbox']" );
			this.$defaultTabSelect = this.$el.find( "[name='default-tab']" );
			this.$iframeTextArea = this.$el.find( "[name='iframe']" );

			this.$mapTab = $( "[href='#map-tab']" );

			//update line-type from model
			var that = this,
				tabs = App.ChartModel.get( "tabs" );
			_.each( tabs, function( v, i ) {
				var $checkbox = that.$checkboxes.filter( "[value='" + v + "']" );
				$checkbox.prop( "checked", true );
				if( v === "map" ) {
					that.$mapTab.css( "display", "block" );
				}
			} );

			//update default tab from model
			this.$defaultTabSelect.val( App.ChartModel.get( "default-tab" ) );
		},

		onTabsCheck: function( evt ) {

			var that = this,
				checked = [];
			$.each( this.$checkboxes, function( i, v ) {

				var $checkbox = $( this );
				if( $checkbox.is( ":checked" ) ) {
					checked.push( $checkbox.val() );
				}

				if( $checkbox.val() === "map" ) {
					if( $checkbox.is( ":checked" ) ) {
						that.$mapTab.css( "display", "block" );
					} else {
						that.$mapTab.css( "display", "none" );
					}
				}
		
			} );

			App.ChartModel.set( "tabs", checked );

		},

		onDefaultTabChange: function( evt ) {
			var $input = $( evt.currentTarget );
			App.ChartModel.set( "default-tab", $input.val() );
		},
	});
})();