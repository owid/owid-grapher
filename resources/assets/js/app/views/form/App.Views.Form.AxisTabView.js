;( function() {
	
	"use strict";

	App.Views.Form.AxisTabView = Backbone.View.extend({

		el: "#form-view #axis-tab",
		events: {
			"change input.form-control, select.form-control": "onFormControlChange",
			"change [name='x-axis-scale-selector']": "onXaxisScaleSelector",
			"change [name='y-axis-scale-selector']": "onYaxisScaleSelector"
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			this.render();

		},

		render: function() {

			//setup initial values
			var that = this,
				chartXaxis = App.ChartModel.get( "x-axis" ),
				chartYaxis = App.ChartModel.get( "y-axis" );

			var $xAxisScaleSelector = this.$el.find( "[name='x-axis-scale-selector']" ),
				$yAxisScaleSelector = this.$el.find( "[name='y-axis-scale-selector']" );

			_.each( chartXaxis, function( d, i ) {
				that.$el.find( "[name='chart-x-" + i + "']" ).val( d );
			} );
			_.each( chartYaxis, function( d, i ) {
				that.$el.find( "[name='chart-y-" + i + "']" ).val( d );
			} );

			$xAxisScaleSelector.prop( "checked", App.ChartModel.get( "x-axis-scale-selector" ) );
			$yAxisScaleSelector.prop( "checked", App.ChartModel.get( "y-axis-scale-selector" ) );
			

		},

		onFormControlChange: function( evt ) {

			console.log( "onFormControlChange" );
			var $control = $( evt.currentTarget ),
				controlName = $control.attr( "name" ),
				controlValue = $control.val(),
				axisName = ( controlName.indexOf( "chart-y" ) > -1 )? "y-axis": "x-axis";

			//strip control name prefix
			controlName = controlName.substring( 8 );

			App.ChartModel.setAxisConfig( axisName, controlName, controlValue );

		},

		onXaxisScaleSelector: function( evt ) {
			var $check = $( evt.currentTarget );
			App.ChartModel.set( "x-axis-scale-selector", $check.is( ":checked" ) );
		},

		onYaxisScaleSelector: function( evt ) {
			var $check = $( evt.currentTarget );
			App.ChartModel.set( "y-axis-scale-selector", $check.is( ":checked" ) );
		}


	});
	
	module.exports = App.Views.Form.AxisTabView;

})();