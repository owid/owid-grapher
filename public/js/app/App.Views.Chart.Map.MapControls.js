;(function() {	
	"use strict";

	owid.namespace("App.Views.Chart.Map.MapControls");

	App.Views.Chart.Map.MapControls = owid.View.extend({
		el: "#map-chart-tab .map-controls-header",
		events: {
			"input .target-year-control input": "onTargetYearInput",
			"change .target-year-control input": "onTargetYearChange",
			"click .region-control li": "onRegionClick",
			"click .settings-control input": "onSettingsInput",
			"click .color-blind-control": "onColorBlindClick",
		},

		initialize: function( options ) {
			this.dispatcher = options.dispatcher;

			var mapConfig = App.ChartModel.get( "map-config" );
			
			//year slider
			this.$targetYearControl = this.$el.find( ".target-year-control" );
			this.$targetYearLabel = this.$targetYearControl.find( ".target-year-label" );
			this.$targetYearInput = this.$targetYearControl.find( "input" );
			
			//region selector
			this.$regionControl = this.$el.find( ".region-control" );
			this.$regionControlLabel = this.$regionControl.find( ".region-label" );
			this.$regionControlLis = this.$regionControl.find( "li" );

			//settings-control selector
			this.$settingsControl = this.$el.find( ".settings-control" );

			//color blind control selector
			this.$colorBlindControl = this.$el.find( ".color-blind-control" );
			//cache original
			this.originalColorSchemeName = mapConfig.colorSchemeName;

			this.listenTo(App.ChartModel, "change", this.onChartModelChange.bind(this));
			this.listenTo(App.ChartModel, "change-map", this.onChartModelChange.bind(this));

			return this.render();
		},

		render: function() {
			var mapConfig = App.ChartModel.get( "map-config" ),
				minYear = App.DataModel.get("minYear"),
				maxYear = App.DataModel.get("maxYear");
			
			this.$targetYearLabel.text( mapConfig.targetYear );
			this.$regionControlLabel.text( mapConfig.projection );

			this.$targetYearInput.attr( "min", minYear );
			this.$targetYearInput.attr( "max", maxYear );
			this.$targetYearInput.attr( "step", mapConfig.timeInterval );
			this.$targetYearInput.val( parseInt( mapConfig.targetYear, 10 ) );

			this.$regionControlLis.removeClass( "highlight" );
			this.$regionControlLis.filter( "." + mapConfig.projection + "-projection" ).addClass( "highlight" );

			this.$settingsControl.find("input").prop("checked", mapConfig.mode !== "no-interpolation");
			this.$colorBlindControl.toggleClass("active", !!mapConfig.isColorblind);

			//is interval mode display
			if( isNaN( minYear ) || isNaN( maxYear ) ) {
				this.$targetYearInput.attr( "disabled", true );
			}
		},

		onChartModelChange: function( evt ) {
			this.render();
		},
		
		onTargetYearInput: function( evt ) {
			var $this = $( evt.target ),
				targetYear = parseInt( $this.val(), 10 );
			this.$targetYearLabel.text( targetYear, false, "change-map" );
		},

		onTargetYearChange: function( evt ) {
			var $this = $( evt.target ),
				targetYear = parseInt( $this.val(), 10 );
			App.ChartModel.updateMapConfig( "targetYear", targetYear, false, "change-map" );
			this.render();
		},

		onRegionClick: function( evt ) {
			var $this = $( evt.target );
			App.ChartModel.updateMapConfig( "projection", $this.text(), false, "change-map" );
			this.render();
		},

		onSettingsInput: function(evt) {
			var $this = $(evt.target),
				currentMode = App.ChartModel.get("map-config").mode,
				mode = currentMode === "no-interpolation" ? "specific" : "no-interpolation";
			App.ChartModel.updateMapConfig("mode", mode, false, "change-map");
			this.render();
		},

		onColorBlindClick: function(evt) {
			var $this = $(evt.currentTarget);
			if (!$this.hasClass("active")) {
				App.ChartModel.updateMapConfig("isColorblind", true, false, "change-map");
			} else {
				App.ChartModel.updateMapConfig("isColorblind", false, false, "change-map");
			}
		},

	});
})();