;( function() {
	
	"use strict";

	App.Views.Form.StylingTabView = Backbone.View.extend({

		el: "#form-view #styling-tab",
		events: {
			"change [name='line-type']": "onLineTypeChange"
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			
			this.$lineTypeRadios = this.$el.find( "[name='line-type']" );

			this.render();

		},

		render: function() {

			var lineType = App.ChartModel.get( "line-type" );
			console.log( "lineType", lineType );
			this.$lineTypeRadios.filter( "[value='" + lineType + "']" ).prop( "checked", true );

		},

		onLineTypeChange: function( evt ) {

			var $radio = $( evt.currentTarget );
			App.ChartModel.set( "line-type", $radio.val() );

		}

	});

})();