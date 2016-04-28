;(function() {	
	"use strict";
	owid.namespace("App.Views.Chart.DataTab");

	App.Views.Chart.DataTab = Backbone.View.extend({
		el: "#chart-view",
		events: {},

		initialize: function( options ) {
			this.parentView = options.parentView;
			this.dispatcher = options.dispatcher;

			//data tab
			this.$tab = this.$el.find( "#data-chart-tab" );
			this.$downloadBtn = this.$tab.find( ".download-data-btn" );
			this.$dataTableWrapper = this.$tab.find( ".data-table-wrapper" );
		},

		activate: function() {
			this.parentView.chartTab.activate();
			this.trigger("tab-ready");
		},

		render: function( data, localData, dimensions ) {
			this.$dataTableWrapper.empty();

			//update link
			var that = this,
				chartType = App.ChartModel.get( "chart-type" ),
				hasMultipleColumns = ( App.ChartModel.get( "group-by-variables" ) && chartType != App.ChartType.StackedArea )? true: false;

			var params = owid.getQueryParams();
			delete(params.tab);
			this.$downloadBtn.attr("href", this.$downloadBtn.attr("data-base-url") + owid.queryParamsToStr(params));

			//get all times
			var timesObj = [],
				times = [];
			_.each( data, function( entityData, entityId ) {

				var values = entityData.values,
					valuesByTime = [];

				_.each( values, function( value ) {

					//store given time as existing
					var time = value.time;
					if( !timesObj[ time ] ) {
						timesObj[ time ] = true;
						times.push( time );
					}

					//re-map values by time key
					valuesByTime[ time ] = value;

				} );

				entityData.valuesByTime = valuesByTime;

			} );

			//sort gathered times
			times = _.sortBy( times, function( v ) { return +v; } );
			
			//create first row
			var tableString = "<table class='data-table'>",
				tr = "<tr><td><strong> </strong></td>";
			_.each( times, function( time ) {
				//create column for every dimension
				_.each( dimensions, function( dimension, i ) {					
					if( i === 0 || hasMultipleColumns ) {
						var th = "<th>";
						if (time.hasOwnProperty(dimension.property))
							th += time[dimension.property];
						else
							th += time;
						if( dimensions.length > 1 && hasMultipleColumns ) {
							//we have more than one dimension, need to distinguish them in 
							th += " - " + dimension.variableName;
						}
						th += "</th>";
						tr += th;
					}
				});

			} );
			tr += "</tr>";
			tableString += tr;

			_.each( data, function( entityData, entityId ) {

				var tr = "<tr>",
					//add name of entity
					td = "<td><strong>" + entityData.key + "</strong></td>";
				tr += td;

				var valuesByTime = entityData.valuesByTime;
				_.each( times, function( time ) {
					
					//create column for every dimension
					_.each( dimensions, function( dimension, i ) {
						if( i === 0 || hasMultipleColumns ) {
							var td = "<td>",
								tdValue = "";
							//is there value for given time
							if( valuesByTime[ time ] ) {
								if( !valuesByTime[ time ].fake ) {
									tdValue = valuesByTime[ time ][ dimension.property ];
								} else {
									//just dummy values for correct rendering of chart, don't add into table
									tdValue = "";
								}
								
							}
							td += tdValue;
							td += "</td>";
							tr += td;
						}
					} );
				
				} );
				
				tr += "</tr>";
				tableString += tr;

			} );

			tableString += "</table>";

			var $table = $( tableString );
			this.$dataTableWrapper.append( $table );

			this.trigger("tab-ready");
		},

		show: function() {
			this.$el.show();
		},

		hide: function() {
			this.$el.hide();
		}

	} );
})();