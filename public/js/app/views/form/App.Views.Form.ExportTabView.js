;( function() {
	
	"use strict";

	App.Views.Form.ExportTabView = Backbone.View.extend({

		el: "#form-view #export-tab",
		events: {
			"click [type='checkbox']": "onTabsCheck",
			"change .embed-size-wrapper input": "onEmbedSizeChange"
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			this.dispatcher.on( "chart-saved", this.onChartSaved, this );
			
			this.render();

		},

		render: function() {
			
			this.$checkboxes = this.$el.find( "[type='checkbox']" );
			this.$widthInput = this.$el.find( "[name='iframe-width']" );
			this.$heightInput = this.$el.find( "[name='iframe-height']" );
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

			//update size from model
			this.$widthInput.val( App.ChartModel.get( "iframe-width" ) );
			this.$heightInput.val( App.ChartModel.get( "iframe-height" ) );

			//update export code from 
			var chartId = App.ChartModel.get( "id" );
			if( chartId ) {
				var viewUrl = this.$iframeTextArea.attr( "data-view-url" );
				this.generateIframeCode( chartId, viewUrl );
			}

		},

		onChartSaved: function( id, viewUrl ) {
			this.generateIframeCode( id, viewUrl );
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

		onEmbedSizeChange: function( evt ) {

			
			var $input = $( evt.currentTarget );
			//unnecessary to update everything just because generated code changed
			App.ChartModel.set( $input.attr( "name" ), $input.val(), {silent:true} );

			//if already generated code, update it
			if( this.$iframeTextArea.text() != "" ) {
				this.generateIframeCode();
			}

		},

		generateIframeCode: function( id, viewUrl ) {
			//store view url
			if( viewUrl ) {
				this.viewUrl = viewUrl;
			}
			this.$iframeTextArea.text( '<iframe src="' + this.viewUrl + '" style="width:' + App.ChartModel.get( "iframe-width" ) + ';height:' + App.ChartModel.get( "iframe-height" ) + '; border: 0px none;"></iframe>' );
		}

	});

})();