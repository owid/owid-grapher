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