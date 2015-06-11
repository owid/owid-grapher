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
			
			
			this.render();

		},

		render: function() {

			this.$entitiesSelect = this.$el.find( ".countries-select" );
			this.$chartTime = this.$el.find( "[name='chart-time']" );
			this.$dynamicTime = this.$el.find( "[name='dynamic-time']" );
			this.$irs = this.$el.find( ".irs" );

			this.$chartTime.ionRangeSlider({
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
				that.$irs.addClass( "disabled" );
			}, 250 );

		},

		updateTime: function() {

			var slider = $( "[name=chart-time]" ).data( "ionRangeSlider" );
			slider.update( {from: App.AvailableTimeModel.get( "min" ), to: App.AvailableTimeModel.get( "max" )  } );
			//updating slider, so have some set values and disabling dynamic table
			this.$dynamicTime.prop( "checked", false );
			this.$irs.removeClass( "disabled" );

		},

		onDynamicTime: function() {

			if( this.$dynamicTime.is( ":checked" ) ) {
				this.$irs.addClass( "disabled" );
			} else {
				this.$irs.removeClass( "disabled" );
			}
		
		}


	});

})();