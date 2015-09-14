;( function() {
	
	"use strict";

	App.Views.Form.TimeSectionView = Backbone.View.extend({

		el: "#form-view #data-tab .time-section",
		events: {
			"change [name='dynamic-time']": "onDynamicTime",
			"change [name='chart-time-from']": "onChartTimeChange",
			"change [name='chart-time-to']": "onChartTimeChange"
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			this.dispatcher.on( "dimension-update", this.onDimensionUpdate, this );
			
			App.AvailableTimeModel.on( "change", this.onAvailableTimeChange, this );

			this.render();

		},

		render: function() {

			var that = this;

			this.$entitiesSelect = this.$el.find( ".countries-select" );
			this.$chartTime = this.$el.find( "[name='chart-time']" );
			this.$dynamicTime = this.$el.find( "[name='dynamic-time']" );
			this.$irs = this.$el.find( ".irs" );

			this.$chartTimeFrom = this.$el.find( "[name='chart-time-from']" );
			this.$chartTimeTo = this.$el.find( "[name='chart-time-to']" );

			this.$chartTime.ionRangeSlider({
				type: "double",
				min: 0,
				max: 2015,
				from: 1000,
				to: 1500,
				grid: true,
				onChange: function( data ) {
					that.$chartTimeFrom.val(data.from);
					that.$chartTimeTo.val(data.to);
					App.ChartModel.set( "chart-time", [data.from, data.to] );
				}
			});
			setTimeout( function() {
				if( hasDynamicTime ) {
					that.$irs.addClass( "disabled" );
				}
			}, 250 );

			var hasDynamicTime = ( App.ChartModel.get( "chart-time" ) )? false: true;
			if( !hasDynamicTime ) {
				var chartTime = App.ChartModel.get( "chart-time" );
				this.updateTime( chartTime[ 0 ], chartTime[ 1 ] );
			} else if( App.AvailableTimeModel.get( "min" ) && App.AvailableTimeModel.get( "max" ) ) {
				this.updateTime( App.AvailableTimeModel.get( "min" ), App.AvailableTimeModel.get( "max" ) );
				if( hasDynamicTime ) {
					this.$dynamicTime.prop( "checked", true );
					this.$chartTimeFrom.prop( "readonly", true);
					this.$chartTimeTo.prop( "readonly", true);
				}
			}
			
		},

		onAvailableTimeChange: function() {
			this.updateTime( App.AvailableTimeModel.get( "min" ), App.AvailableTimeModel.get( "max" ) );
		},

		onDimensionUpdate: function() {

			var dimensionString = App.ChartModel.get( "chart-dimensions" ),
				timeFrom = Infinity,
				timeTo = -Infinity,
				limitTime = true;

			if( !$.isEmptyObject( dimensionString ) ) {

				var dimensions = $.parseJSON( dimensionString );
				$.each( dimensions, function( i, v ) {
					if( v.period === "single" && v.mode === "specific" ) {
						//get min/max local
						var year = parseInt( v.targetYear, 10 ),
							localFrom = year - parseInt( v.tolerance, 10 ),
							localTo = year + parseInt( v.tolerance, 10 );
						timeFrom = Math.min( localFrom, timeFrom );
						timeTo = Math.max( localTo, timeTo );
					} else {
						//set flag that there is some dimension that cannot be limited automaticaly
						limitTime = false;
					}
				} );

			}

			//if something has changed, set time interval only to necessary
			if( limitTime && timeFrom < Infinity && timeTo > -Infinity ) {
				this.updateTime( timeFrom, timeTo );
				App.ChartModel.set( "chart-time", [ timeFrom, timeTo ] );
			}

		},

		updateTime: function( from, to ) {

			var slider = $( "[name=chart-time]" ).data( "ionRangeSlider" );
			slider.update( {from: from, to: to } );
			//updating slider, so have some set values and disabling dynamic table
			this.$dynamicTime.prop( "checked", false );
			this.$irs.removeClass( "disabled" );
			this.$chartTimeFrom.val(from);
			this.$chartTimeTo.val(to);

		},

		onDynamicTime: function() {

			if( this.$dynamicTime.is( ":checked" ) ) {
				this.$irs.addClass( "disabled" );
				this.$chartTimeFrom.prop( "readonly", true);
				this.$chartTimeTo.prop( "readonly", true);
			} else {
				this.$irs.removeClass( "disabled" );
				this.$chartTimeFrom.prop( "readonly", false);
				this.$chartTimeTo.prop( "readonly", false);
			}
		
		},

		onChartTimeChange: function( evt ) {
			evt.preventDefault();
			var slider = $( "[name=chart-time]" ).data( "ionRangeSlider" ),
				from = this.$chartTimeFrom.val(),
				to = this.$chartTimeTo.val();
			App.ChartModel.set( "chart-time", [from, to] );
			slider.update( {from: from, to: to } );
		}


	});

})();