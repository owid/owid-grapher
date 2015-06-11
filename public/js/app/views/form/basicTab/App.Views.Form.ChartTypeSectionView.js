;( function() {
	
	"use strict";

	App.Views.Form.ChartTypeSectionView = Backbone.View.extend({

		el: "#form-view #basic-tab .chart-type-section",
		events: {
			"change [name='chart-type']": "onChartTypeChange",
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			App.ChartDimensionsModel.on( "change", this.render, this );
			this.render();

		},

		render: function() {
			var $select = this.$el.find( "[name='chart-type']" ),
				selectedChartType = App.ChartModel.get( "chart-type" );
			if( selectedChartType ) {
				$select.val( selectedChartType );
			}
		},

		onChartTypeChange: function( evt ) {

			var $select = $( evt.currentTarget );
			App.ChartModel.set( "chart-type", $select.val() );
			App.ChartDimensionsModel.loadConfiguration( $select.val() );

		}

	});

})();