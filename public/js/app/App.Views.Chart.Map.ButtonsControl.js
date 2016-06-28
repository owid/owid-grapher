;(function() {	
	"use strict";
	owid.namespace("App.Views.Chart.Map.ButtonsControl");
	
	App.Views.Chart.Map.ButtonsControl = owid.View.extend({

		el: "#map-chart-tab .map-timeline-controls .buttons-control",
		events: {},

		initialize: function( options ) {
			this.dispatcher = options.dispatcher;
			this.$buttonsWrapper = this.$el.find( ".buttons-wrapper" );

			this.listenTo(App.ChartModel, "change", this.onChartModelChange.bind(this));
			this.listenTo(App.ChartModel, "change-map", this.onChartModelChange.bind(this));
			this.listenTo(App.ChartModel, "change-map-year", this.onChartModelChange.bind(this));
		},

		render: function() {
			var mapConfig = App.ChartModel.get( "map-config" ),
				targetYear = mapConfig.targetYear,
				minYear = App.DataModel.get("minYear"),
				maxYear = App.DataModel.get("maxYear"),
				years = owid.timeRangesToYears(mapConfig.timeRanges, minYear, maxYear);

			//create all necessary buttons
			this.$buttonsWrapper.empty();

			var htmlString = "";
			_.each(years, function(year) {
				var selected = ( year == targetYear )? "selected": "";
				htmlString += "<li data-year='" + year + "' class='year-btn " + selected + "'><a href='#' class='btn'>" + owid.displayYear(year) + "</a></li>";
			});
			
			this.$buttonsWrapper.append( $( htmlString ) );
			
			this.$buttons = this.$buttonsWrapper.find( "li" );
			this.$buttons.on( "click", $.proxy( this.onButtonClick, this ) );

		},

		onButtonClick: function( evt ) {
			evt.preventDefault();
			var $btn = $( evt.currentTarget ),
				targetYear = parseInt( $btn.attr( "data-year" ), 10 );
			App.ChartModel.updateMapConfig("targetYear", targetYear, false, "change-map-year");
		
		},

		onChartModelChange: function() {
			this.render();
		},

		show: function() {
			this.$el.css( "display", "table" );
		},

		hide: function() {
			this.$el.css( "display", "none" );
		}

	});
})();