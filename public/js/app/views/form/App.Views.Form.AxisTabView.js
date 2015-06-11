;( function() {
	
	"use strict";

	App.Views.Form.AxisTabView = Backbone.View.extend({

		el: "#form-view #axis-tab",
		events: {
			"input input.form-control, select.form-control": "onFormControlChange",
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

			_.each( chartXaxis, function( d, i ) {
				that.$el.find( "[name='chart-x-" + i + "']" ).val( d );
			} );
			_.each( chartYaxis, function( d, i ) {
				that.$el.find( "[name='chart-y-" + i + "']" ).val( d );
			} );

		},

		onFormControlChange: function( evt ) {

			var $control = $( evt.currentTarget ),
				controlName = $control.attr( "name" ),
				controlValue = $control.val(),
				axisName = ( controlName.indexOf( "chart-y" ) > -1 )? "y-axis": "x-axis";

			//strip control name prefix
			controlName = controlName.substring( 8 );

			App.ChartModel.setAxisConfig( axisName, controlName, controlValue );

		}


	});

})();