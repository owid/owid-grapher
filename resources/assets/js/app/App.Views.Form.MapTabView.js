;(function() {	
	"use strict";
	owid.namespace("App.Views.Form.MapTabView");

	var	owdProjections = App.Views.Chart.Map.Projections,
		ColorSchemeView = App.Views.Form.MapColorSchemeView;

	App.Views.Form.MapTabView = Backbone.View.extend({

		el: "#form-view #map-tab",
		events: {
			"change [name='map-variable-id']": "onVariableIdChange",
			"change [name='map-time-tolerance']": "onTimeToleranceChange",
			"change [name='map-time-ranges']": "onTimeRangesChange",
			"change [name='map-time-mode']": "onTimeModeChange",
			"change [name='map-target-year']": "onTargetYearChange",
			"change [name='map-color-scheme']": "onColorSchemeChange",
			"change [name='map-color-interval']": "onColorIntervalChange",
			"change [name='map-projections']": "onProjectionChange",
			"change [name='map-legend-description']": "onLegendDescriptionChange",
			"change [name='map-legend-step-size']": "onLegendStepSizeChange",
			"change [name='map-legend-orientation']": "onLegendOrientationChange"
		},

		initialize: function( options ) {
			this.dispatcher = options.dispatcher;

			App.ChartVariablesCollection.on( "add remove change reset", this.onVariablesCollectionChange, this );
			App.ChartModel.on( "change", this.onChartModelChange, this );

			
			this.$variableIdSelect = this.$el.find( "[name='map-variable-id']" );
			
			this.$timeToleranceInput = this.$el.find( "[name='map-time-tolerance']" );
			this.$timeRangesInput = this.$el.find( "[name='map-time-ranges']" );
			this.$targetYearInput = this.$el.find( "[name='map-target-year']" );
			this.$timeModeSelect = this.$el.find( "[name='map-time-mode']" );
			
			this.$colorSchemeSelect = this.$el.find( "[name='map-color-scheme']" );
			this.$colorIntervalSelect = this.$el.find( "[name='map-color-interval']" );
			
			this.$projectionsSelect = this.$el.find( "[name='map-projections']" );
			this.$legendDescription = this.$el.find( "[name='map-legend-description']" );
			this.$legendStepSize = this.$el.find( "[name='map-legend-step-size']" );
			this.$legendOrientation = this.$el.find( "[name='map-legend-orientation']" );

			this.colorSchemeView = new ColorSchemeView( options );

			//make sure we have current data
			this.updateTargetYear( true );

			this.render();
		},

		render: function() {
			//populate variable select with the available ones
			this.$variableIdSelect.empty();

			var mapConfig = App.ChartModel.get( "map-config" );
				
			this.updateVariableSelect();

			this.$timeToleranceInput.val( mapConfig.timeTolerance );
			this.$timeRangesInput.val( owid.timeRangesToString(mapConfig.timeRanges) );
			this.$legendDescription.val( mapConfig.legendDescription );
			var legendStepSize = ( mapConfig.legendStepSize )? mapConfig.legendStepSize: 20;
			this.$legendStepSize.val( legendStepSize );
			var legendOrientation = ( mapConfig.legendOrientation )? mapConfig.legendOrientation: "landscape";
			this.$legendOrientation.val( legendOrientation );

			this.updateTargetYearSelect();
			this.updateColorSchemeSelect();
			this.updateColorIntervalSelect();
			this.updateProjectionsSelect();
			this.updateTimelineMode();
		},

		updateTargetYearSelect: function() {
			var mapConfig = App.ChartModel.get("map-config"),
				targetYear = mapConfig.targetYear,
				targetYearMode = mapConfig.targetYearMode,
				minYear = App.DataModel.get("minYear") || new Date().getFullYear(),
				maxYear = App.DataModel.get("maxYear") || new Date().getFullYear(),
				years = owid.timeRangesToYears(mapConfig.timeRanges, minYear, maxYear),
				options = [ { "title": "Earliest year", "value": "earliest" }, { "title": "Latest year", "value": "latest" } ];

			_.each(years, function(year) {
				options.push({ "title": year, "value": year });
			});

			this.$targetYearInput.empty();

			var innerHtml = "";
			$.each( options, function( i, option ) {
				innerHtml += "<option value='" + option.value + "'>" + option.title + "</option>";
			} );
			this.$targetYearInput.html( innerHtml );

			//update current value on select
			var currentValue;
			if( targetYearMode === "earliest" || targetYearMode === "latest" ) {
				currentValue = targetYearMode;
			} else {
				currentValue = targetYear;
			}

			//select current value
			this.$targetYearInput.val( currentValue );
		},

		updateVariableSelect: function() {
			var mapConfig = App.ChartModel.get( "map-config" ),
				models = App.ChartVariablesCollection.models,
				html = "";

			if( models && models.length ) {
				html += "<option selected disabled>Select variable to display on map</option>";
			}

			_.each( models, function( v, i ) {
				//if no variable selected, try to select first
				var selected = ( i == mapConfig.variableId )? " selected": "";
				html += "<option value='" + v.get( "id" ) + "' " + selected + ">" + v.get( "name" ) + "</option>";
			} );

			//check for empty html
			if( !html ) {
				html += "<option selected disabled>Add some variables in 2.Data tab first</option>";
				this.$variableIdSelect.addClass( "disabled" );
			} else {
				this.$variableIdSelect.removeClass( "disabled" );
			}
			this.$variableIdSelect.append( $( html ) );

			//check if we should select first variable
			if( models.length && !this.$variableIdSelect.val() ) {
				var firstOption = this.$variableIdSelect.find( "option" ).eq( 1 ).val();
				this.$variableIdSelect.val( firstOption );
				App.ChartModel.updateMapConfig( "variableId", firstOption );
			}
		},
		
		updateColorSchemeSelect: function() {			
			var html = "",
				mapConfig = App.ChartModel.get( "map-config" );

			this.$colorSchemeSelect.empty();
			_.each( owdColorbrewer, function( v, i ) {
				var selected = ( i == mapConfig.colorSchemeName )? " selected": "";
				html += "<option value='" + i + "' " + selected + ">" + v.name + "</option>";
			} );
			this.$colorSchemeSelect.append( $( html ) );
		},

		updateColorIntervalSelect: function() {
			var mapConfig = App.ChartModel.get("map-config");
			this.$colorIntervalSelect.val(mapConfig.colorSchemeInterval);
		},

		updateProjectionsSelect: function() {
			
			var html = "",
				mapConfig = App.ChartModel.get( "map-config" );

			this.$projectionsSelect.empty();
			_.each( owdProjections, function( v, i ) {
				var selected = ( i == mapConfig.projections )? " selected": "";
				html += "<option value='" + i + "' " + selected + ">" + i + "</option>";
			} );
			this.$projectionsSelect.append( $( html ) );

		},

		updateTargetYear: function() {
			var mapConfig = App.ChartModel.get( "map-config" ),
				chartTime = App.ChartModel.get( "chart-time" ),
				minYear = App.DataModel.get("minYear"),
				maxYear = App.DataModel.get("maxYear"),
				savedTargetYear = mapConfig.targetYear,
				targetYear = ( chartTime )? chartTime[0]: minYear;

			//override target year only if we don't have manually chosen custom year
			if( !savedTargetYear ) {
				App.ChartModel.updateMapConfig( "targetYear", targetYear, silent );
			}			
		},

		updateTimelineMode: function() {
			
			var mapConfig = App.ChartModel.get( "map-config" );
			if( mapConfig.timelineMode ) {

				this.$timeModeSelect.val( mapConfig.timelineMode );
			
			} else {
			
				//no timeline mode set
				var min = mapConfig.minYear,
					max = mapConfig.maxYear,
					step = mapConfig.timeInterval,
					numBtns = Math.floor( ( max - min ) / step );

				if( numBtns < 8 ) {
					//has limited number of buttons
					this.$timeModeSelect.val( "buttons" );
					this.$timeModeSelect.trigger( "change" );
				}

			}

		},

		onVariablesCollectionChange: function() {
			this.render();
		},

		onVariableIdChange: function( evt ) {
			var $this = $( evt.target );
			App.ChartModel.updateMapConfig( "variableId", $this.val() );
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
			this.updateTargetYearSelect();
		},

		onTargetYearChange: function( evt ) {
			var $this = $( evt.target ),
				mapConfig = App.ChartModel.get( "map-config" ),
				val = $this.val(),
				targetYear, targetYearMode = "normal",
				years = owid.timeRangesToYears(mapConfig.timeRanges, mapConfig.minYear, mapConfig.maxYear);

			if( val === "earliest" ) {
				targetYearMode = val;
				targetYear = years[0];
			} else if( val === "latest" ) {
				targetYearMode = val;
				targetYear = years[years.length-1];
			} else {
				targetYear = $this.val();
			}

			App.ChartModel.updateMapConfig( "targetYear", targetYear );
			App.ChartModel.updateMapConfig( "targetYearMode", targetYearMode );
		},

		onColorSchemeChange: function( evt ) {
			var mapConfig = App.ChartModel.get("map-config");
			var colorSchemeName = $(evt.target).val();

			// If this is the first time we switch to custom, populate custom
			// values with the current color scheme
			if (colorSchemeName == "custom" && _.isEmpty(mapConfig.customColorScheme))
				App.ChartModel.updateMapConfig("customColorScheme", owdColorbrewer.getColors(mapConfig));

			App.ChartModel.updateMapConfig("colorSchemeName", colorSchemeName);
			//need to update number of classes
			this.updateColorIntervalSelect();
		},

		onColorIntervalChange: function( evt ) {
			var $this = $( evt.target );
			App.ChartModel.updateMapConfig( "colorSchemeInterval", parseInt( $this.val(), 10 ) );
		},

		onProjectionChange: function( evt ) {
			var $this = $( evt.target );
			App.ChartModel.updateMapConfig( "projection", $this.val() );
		},

		onChartModelChange: function( evt ) {
			App.DataModel.ready(function() {
				this.updateColorSchemeSelect();
				this.updateTimelineMode();
				this.updateTargetYear(true);
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