;( function() {
	
	"use strict";

	App.Views.ChartView = Backbone.View.extend({

		el: "#chart-view",
		events: {},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			this.render();

			//setup events
			App.ChartModel.on( "change", this.onChartModelChange, this );

		},

		render: function() {
			
			this.$el.find( ".chart-name" ).text( App.ChartModel.get( "chart-name" ) );
			this.updateChart( App.ChartModel.get( "chart-data" ) );

		},

		onChartModelChange: function( evt ) {

			this.render();

		},

		updateChart: function( data ) {

			if( !data ) {
				return;
			}

			//make local copy of data for our filtering needs
			var localData = $.extend( true, localData, data );

			//filter data for selected countries
			var selectedCountries = App.ChartModel.get( "selected-countries" );
			localData = _.filter( localData, function( value, key, list ) {
				return ( _.indexOf( selectedCountries, value.key ) > -1 );
			} );

			//filter by chart time
			var chartTime = App.ChartModel.get( "chart-time" );
			if( chartTime && chartTime.length == 2 ) {
				
				var timeFrom = chartTime[ 0 ],
					timeTo = chartTime[ 1 ];
				
				_.each( localData, function( singleData, key, list ) {
					var values = _.clone( singleData.values );
					values = _.filter( values, function( value ) {
						return ( value.x >= timeFrom && value.x <= timeTo );
					} );
					singleData.values = values
				} );

			}

			var that = this;
			nv.addGraph(function() {
				that.chart = nv.models.lineChart()
							.options({
								transitionDuration: 300,
								margin: { top: 100, left: 80, bottom: 100, right: 80 },
								tooltipContent: tooltipContent });
			
				that.chart.xAxis
					.axisLabel( "Axis X" )
					.staggerLabels( true );

				that.chart.yAxis
					.axisLabel( "Axis Y" );
					
				var svgSelection = d3.select( "svg" )
					.datum(localData)
					.call(that.chart);

				nv.utils.windowResize(that.chart.update);

			});

		}

	});

})();