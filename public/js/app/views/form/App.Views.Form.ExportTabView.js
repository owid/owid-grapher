;( function() {
	
	"use strict";

	App.Views.Form.ExportTabView = Backbone.View.extend({

		el: "#form-view #export-tab",
		events: {
			"click [type='checkbox']": "onTabsCheck"
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			this.dispatcher.on( "chart-saved", this.onChartSaved, this );
			
			this.render();

		},

		render: function() {
			this.$checkboxes = this.$el.find( "[type='checkbox']" ); 
			this.$iframeTextArea = this.$el.find( "[name='iframe']" );

			//update from model
			var that = this,
				tabs = App.ChartModel.get( "tabs" );
			_.each( tabs, function( v, i ) {
				var $checkbox = that.$checkboxes.filter( "[value='" + v + "']" );
				$checkbox.prop( "checked", true );
			} );

		},

		onChartSaved: function( id, viewUrl ) {
			this.generateIframeCode( id, viewUrl );
		},

		onTabsCheck: function( evt ) {

			var checked = [];
			$.each( this.$checkboxes, function( i, v ) {

				var $checkbox = $( this );
				if( $checkbox.is( ":checked" ) ) {
					checked.push( $checkbox.val() );
				}

			} );

			App.ChartModel.set( "tabs", checked );

		},

		generateIframeCode: function( id, viewUrl ) {
			this.$iframeTextArea.text( '<iframe src="' + viewUrl + '" style="width: 100%; height: 100%;"></iframe>' );
		}

	});

})();