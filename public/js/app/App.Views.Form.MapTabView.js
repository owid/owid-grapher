;(function() {	
	"use strict";
	owid.namespace("App.Views.Form.MapTabView");

	var	owdProjections = App.Views.Chart.Map.Projections,
		MapColorSection = App.Views.Form.MapColorSection;

	App.Views.Form.MapTabView = owid.View.extend({
		el: "#form-view #map-tab",
		events: {
			"change [name='map-variable-id']": "onVariableIdChange",
			"change [name='map-time-tolerance']": "onTimeToleranceChange",
			"change [name='map-time-ranges']": "onTimeRangesChange",
			"change [name='map-time-mode']": "onTimeModeChange",
			"change [name='map-default-year']": "onDefaultYearChange",
			"change [name='map-default-projection']": "onDefaultProjectionChange",
			"change [name='map-legend-description']": "onLegendDescriptionChange",
			"change [name='map-legend-step-size']": "onLegendStepSizeChange",
			"change [name='map-legend-orientation']": "onLegendOrientationChange"
		},

		initialize: function(options) {
			this.dispatcher = options.dispatcher;

			this.$variableIdSelect = this.$el.find( "[name='map-variable-id']" );
			
			this.$timeToleranceInput = this.$el.find( "[name='map-time-tolerance']" );
			this.$timeRangesInput = this.$el.find( "[name='map-time-ranges']" );
			this.$defaultYearInput = this.$el.find( "[name='map-default-year']" );
			this.$timeModeSelect = this.$el.find( "[name='map-time-mode']" );

			this.$defaultProjectionSelect = this.$el.find("[name='map-default-projection']" );
			this.$legendDescription = this.$el.find("[name='map-legend-description']" );
			this.$legendStepSize = this.$el.find("[name='map-legend-step-size']" );
			this.$legendOrientation = this.$el.find("[name='map-legend-orientation']" );

			this.colorsSection = this.addChild(MapColorSection);

			//make sure we have current data
			this.updateTargetYear(true);

			App.ChartData.ready(function() {
				this.render();
			}.bind(this));

			this.listenTo(App.ChartModel, "change", this.onChartModelChange.bind(this));
			this.onChartModelChange();
		},

		render: function() {
			//populate variable select with the available ones
			this.$variableIdSelect.empty();

			var mapConfig = App.ChartModel.get( "map-config" );
				
			this.$timeToleranceInput.val( mapConfig.timeTolerance );
			this.$timeRangesInput.val( owid.timeRangesToString(mapConfig.timeRanges) );
			this.$legendDescription.val( mapConfig.legendDescription );
			var legendStepSize = ( mapConfig.legendStepSize )? mapConfig.legendStepSize: 20;
			this.$legendStepSize.val( legendStepSize );
			var legendOrientation = ( mapConfig.legendOrientation )? mapConfig.legendOrientation: "landscape";
			this.$legendOrientation.val( legendOrientation );

			this.updateDefaultYearSelect();
			this.updateDefaultProjectionSelect();
			this.updateTimelineMode();
		},

		updateDefaultYearSelect: function() {
			var mapConfig = App.ChartModel.get("map-config"),
				defaultYear = mapConfig.defaultYear,
				targetYearMode = mapConfig.targetYearMode,
				minYear = App.VariableData.get("minYear") || new Date().getFullYear(),
				maxYear = App.VariableData.get("maxYear") || new Date().getFullYear(),
				years = owid.timeRangesToYears(mapConfig.timeRanges, minYear, maxYear),
				options = [{ "title": "Earliest year", "value": "earliest" }, { "title": "Latest year", "value": "latest" }];

			_.each(years, function(year) {
				options.push({ "title": year, "value": year });
			});

			this.$defaultYearInput.empty();

			var innerHtml = "";
			$.each(options, function( i, option ) {
				innerHtml += "<option value='" + option.value + "'>" + option.title + "</option>";
			});
			this.$defaultYearInput.html( innerHtml );

			//update current value on select
			var currentValue;
			if( targetYearMode === "earliest" || targetYearMode === "latest" ) {
				currentValue = targetYearMode;
			} else {
				currentValue = defaultYear;
			}

			//select current value
			this.$defaultYearInput.val(currentValue);
		},

		updateVariableSelect: function() {
			var mapConfig = App.ChartModel.get("map-config"),
				variables = App.VariableData.get("variables"),
				html = "";

			if (!_.isEmpty(variables)) {
				html += "<option selected disabled>Select variable to display on map</option>";
			}

			_.each(variables, function(v) {
				var selected = (v.id == mapConfig.variableId) ? " selected" : "";
				html += "<option value='" + v.id + "' " + selected + ">" + v.name + "</option>";
			});

			//check for empty html
			if (!html) {
				html += "<option selected disabled>Add some variables in Data tab first</option>";
				this.$variableIdSelect.addClass("disabled");
			} else {
				this.$variableIdSelect.removeClass("disabled");
			}
			this.$variableIdSelect.html(html);

			// If we don't have a variable selected, pick first one
			if (!_.isEmpty(variables) && mapConfig.variableId <= 0) {
				var firstOption = this.$variableIdSelect.find("option").eq(1).val();
				this.$variableIdSelect.val(firstOption);
				App.ChartModel.updateMapConfig("variableId", firstOption);
			}
		},
		
		updateDefaultProjectionSelect: function() {			
			var html = "",
				mapConfig = App.ChartModel.get( "map-config" );

			this.$defaultProjectionSelect.empty();
			_.each( owdProjections, function( v, i ) {
				var selected = ( i == mapConfig.defaultProjection )? " selected": "";
				html += "<option value='" + i + "' " + selected + ">" + i + "</option>";
			} );
			this.$defaultProjectionSelect.append( $( html ) );

		},

		updateTargetYear: function() {
			var mapConfig = App.ChartModel.get( "map-config" ),
				chartTime = App.ChartModel.get( "chart-time" ),
				minYear = App.VariableData.get("minYear"),
				maxYear = App.VariableData.get("maxYear"),
				savedTargetYear = mapConfig.targetYear,
				targetYear = ( chartTime )? chartTime[0]: minYear;

			//override target year only if we don't have manually chosen custom year
			if( !savedTargetYear ) {
				App.ChartModel.updateMapConfig( "targetYear", targetYear, silent );
			}			
		},

		updateTimelineMode: function() {
			this.$timeModeSelect.val(App.MapModel.get("timelineMode"));
		},

		onVariableIdChange: function() {
			App.ChartModel.updateMapConfig("variableId", this.$variableIdSelect.val());
		},

		onTimeToleranceChange: function( evt ) {
			var $this = $( evt.target );
			App.ChartModel.updateMapConfig( "timeTolerance", parseInt( $this.val(), 10 ) );
		},

		onTimeRangesChange: function(evt) {
			var $this = $(evt.target);
			try {
				var timeRanges = owid.timeRangesFromString($this.val());
			} catch (e) {
				if (e instanceof RangeError) {
					$this.closest('.form-group').addClass('has-error');
					$this.attr('data-original-title', e.toString());
					$this.tooltip('show');
					return;
				} else {
					throw e;
				}
			}

			$this.tooltip('hide');
			$this.attr('data-original-title', '');
			$this.closest('.form-group').removeClass('has-error');
			App.ChartModel.updateMapConfig("timeRanges", timeRanges);
			this.updateDefaultYearSelect();
		},

		onDefaultYearChange: function( evt ) {
			var $this = $( evt.target ),
				mapConfig = App.ChartModel.get( "map-config" ),
				val = $this.val(),
				defaultYear, targetYearMode = "normal",
				years = owid.timeRangesToYears(mapConfig.timeRanges, mapConfig.minYear, mapConfig.maxYear);

			if( val === "earliest" ) {
				targetYearMode = val;
				defaultYear = years[0];
			} else if( val === "latest" ) {
				targetYearMode = val;
				defaultYear = years[years.length-1];
			} else {
				defaultYear = $this.val();
			}

			App.MapModel.set({
				defaultYear: defaultYear,
				targetYear: defaultYear,
				targetYearMode: targetYearMode
			});
		},

		onDefaultProjectionChange: function(evt) {
			var $this = $(evt.target);
			App.ChartModel.updateMapConfig("defaultProjection", $this.val(), true);
			App.ChartModel.updateMapConfig("projection", $this.val());
		},

		onChartModelChange: function(evt) {
			App.ChartData.ready(function() {
				this.updateTimelineMode();
				this.updateTargetYear(true);
				this.updateVariableSelect();
			}.bind(this));
		},

		onLegendOrientationChange: function( evt ) {
			var $this = $( evt.target );
			App.ChartModel.updateMapConfig( "legendOrientation", $this.val() );
		},

		onLegendDescriptionChange: function( evt ) {
			var $this = $( evt.target );
			App.ChartModel.updateMapConfig( "legendDescription", $this.val() );
		},

		onLegendStepSizeChange: function( evt ) {
			var $this = $( evt.target );
			App.ChartModel.updateMapConfig( "legendStepSize", $this.val() );
		},

		onTimeModeChange: function( evt ) {
			var $this = $( evt.target );
			App.ChartModel.updateMapConfig( "timelineMode", $this.val(), false, "change-map" );
		}

	});
})();