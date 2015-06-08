;( function() {
	
	"use strict";

	App.Views.Form.TimeSectionView = Backbone.View.extend({

		el: "#form-view #data-tab .time-section",
		events: {
			"change [name='dynamic-time']": "onDynamicTime"
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			App.AvailableTimeModel.on( "change", this.updateTime, this );
			
			this.$entitiesSelect = this.$el.find( ".countries-select" );

			this.render();

		},

		render: function() {
			this.$dynamicTime = this.$el.find( "[name='dynamic-time']" );

			$( "[name=chart-time]" ).ionRangeSlider({
				type: "double",
				min: 0,
				max: 2015,
				from: 1000,
				to: 1500,
				grid: true,
				onChange: function( data ) {
					App.ChartModel.set( "chart-time", [data.from, data.to] );
        		}
			});
			var that = this;
			setTimeout( function() {
				var $irs = that.$el.find( ".irs" );
				$irs.addClass( "disabled" );
			}, 250 );

		},

		updateTime: function() {

			var slider = $( "[name=chart-time]" ).data( "ionRangeSlider" );
			slider.update( {from: App.AvailableTimeModel.get( "min" ), to: App.AvailableTimeModel.get( "max" )  } );

		},

		onDynamicTime: function() {

			var $irs = this.$el.find( ".irs" );
			if( this.$dynamicTime.is( ":checked" ) ) {
				$irs.addClass( "disabled" );
			} else {
				$irs.removeClass( "disabled" );
			}
		
		}


	});

})();