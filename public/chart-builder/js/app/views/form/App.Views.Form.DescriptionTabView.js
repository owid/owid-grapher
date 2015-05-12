;( function() {
	
	"use strict";

	App.Views.Form.DescriptionTabView = Backbone.View.extend({

		el: "#form-view #description-tab",
		events: {},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			var that = this;

			this.$textArea = this.$el.find( "textarea" );
			this.$textArea.wysihtml5( {
				"events": {
					"change": function( evt ) {
						that.onFormControlChange( that.$textArea );
					}
				}
			});

			this.render();

		},

		render: function() {

		},

		onFormControlChange: function( evt ) {

			console.log( "onFormControlChange" );

			var textAreaValue = this.$textArea.val();
			App.ChartModel.set( "chart-description", textAreaValue );

			/*var $control = $( evt.currentTarget ),
				controlName = $control.attr( "name" ),
				controlValue = $control.val(),
				axisName = ( controlName.indexOf( "chart-y" ) > -1 )? "y-axis": "x-axis";

			//strip control name prefix
			controlName = controlName.substring( 8 );

			App.ChartModel.setAxisConfig( axisName, controlName, controlValue );*/

		}


	});

})();