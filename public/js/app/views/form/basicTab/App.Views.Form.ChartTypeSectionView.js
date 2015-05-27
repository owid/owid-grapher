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

		},

		onChartTypeChange: function( evt ) {

			var $select = $( evt.currentTarget );
			App.ChartDimensionsModel.loadConfiguration( $select.val() );

		}

	});

})();