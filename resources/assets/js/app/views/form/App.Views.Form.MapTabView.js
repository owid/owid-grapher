;( function() {
	
	"use strict";

	var App = require( "./../../namespaces.js" ),
		owdProjections = require( "./../chart/map/App.Views.Chart.Map.Projections.js" ),
		ColorSchemeView = require( "./mapTab/App.Views.Form.MapColorSchemeView.js" );

	App.Views.Form.MapTabView = Backbone.View.extend({

		el: "#form-view #map-tab",
		events: {
			"change [name='map-variable-id']": "onVariableIdChange",
			"change [name='map-time-tolerance']": "onTimeToleranceChange",
			"change [name='map-time-interval']": "onTimeIntervalChange",
			"change [name='map-time-mode']": "onTimeModeChange",
			"change [name='map-target-year']": "onTargetYearChange",
			"change [name='map-color-scheme']": "onColorSchemeChange",
			"change [name='map-color-interval']": "onColorIntervalChange",
			"change [name='map-projections']": "onProjectionChange",
			"change [name='map-legend-description']": "onLegendDescriptionChange",
			"change [name='map-legend-step-size']": "onLegendStepSizeChange"
		},

		initialize: function( options ) {
			this.dispatcher = options.dispatcher;

			App.ChartVariablesCollection.on( "add remove change reset", this.onVariablesCollectionChange, this );
			App.AvailableTimeModel.on( "change", this.onAvailableTimeChange, this );
			App.ChartModel.on( "change", this.onChartModelChange, this );
			
			this.$variableIdSelect = this.$el.find( "[name='map-variable-id']" );
			
			this.$timeToleranceInput = this.$el.find( "[name='map-time-tolerance']" );
			this.$timeIntervalInput = this.$el.find( "[name='map-time-interval']" );
			this.$targetYearInput = this.$el.find( "[name='map-target-year']" );
			this.$timeModeSelect = this.$el.find( "[name='map-time-mode']" );
			
			this.$colorSchemeSelect = this.$el.find( "[name='map-color-scheme']" );
			this.$colorIntervalSelect = this.$el.find( "[name='map-color-interval']" );
			
			this.$projectionsSelect = this.$el.find( "[name='map-projections']" );
			this.$legendDescription = this.$el.find( "[name='map-legend-description']" );
			this.$legendStepSize = this.$el.find( "[name='map-legend-step-size']" );

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
			this.$timeIntervalInput.val( mapConfig.timeInterval );
			this.$legendDescription.val( mapConfig.legendDescription );
			this.$legendStepSize.val( mapConfig.legendStepSize );
			
			this.updateTargetYearSelect();
			this.updateColorSchemeSelect();
			this.updateColorIntervalSelect();
			this.updateProjectionsSelect();
			this.updateTimelineMode();

		},

		updateTargetYearSelect: function() {

			var mapConfig = App.ChartModel.get( "map-config" ),
				options = [ { "title": "Earliest year", "value": "earliest" }, { "title": "Latest year", "value": "latest" } ],
				minYear = mapConfig.minYear,
				maxYear = mapConfig.maxYear,
				targetYear = mapConfig.targetYear,
				targetYearMode = mapConfig.targetYearMode,
				interval = mapConfig.timeInterval,
				nowYear = minYear,
				loopIndex = 0;

			while( ( nowYear <= maxYear ) && ( loopIndex < 1000 ) ) {
				options.push( { "title": nowYear, "value": nowYear } );

				nowYear = nowYear + interval;
				//make sure that we don't skip over maxYear if next interval would over it
				if( (nowYear > maxYear) && (nowYear - interval) < maxYear ) {
					nowYear = maxYear;
				}

				//just safeguard for loop
				loopIndex++;
			}

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
			
			var html = "",
				mapConfig = App.ChartModel.get( "map-config" ),
				keys = _.keys( owdColorbrewer[ mapConfig.colorSchemeName ] ),
				max = parseInt( keys[ keys.length - 1 ], 10 ),
				min = parseInt( keys[ 0 ], 10 );

			this.$colorIntervalSelect.attr( "min", min );
			this.$colorIntervalSelect.attr( "max", max );

			if( mapConfig.colorSchemeInterval ) {
				this.$colorIntervalSelect.val( mapConfig.colorSchemeInterval );
				//there's not selected interval that would exist with current color scheme, select that first
				App.ChartModel.updateMapConfig( "colorSchemeInterval", this.$colorIntervalSelect.val() );
			}

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

		updateTargetYear: function( silent ) {
			var mapConfig = App.ChartModel.get( "map-config" ),
				chartTime = App.ChartModel.get( "chart-time" ),
				savedTargetYear = mapConfig.targetYear,
				targetYear = ( chartTime )? chartTime[0]: App.AvailableTimeModel.get( "min" ),
				minYear = targetYear,
				maxYear = ( chartTime )? chartTime[1]: App.AvailableTimeModel.get( "max" );

			App.ChartModel.updateMapConfig( "minYear", minYear, true );
			App.ChartModel.updateMapConfig( "maxYear", maxYear, true );
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

		onTimeIntervalChange: function( evt ) {
			var $this = $( evt.target );
			App.ChartModel.updateMapConfig( "timeInterval", parseInt( $this.val(), 10 ) );
			this.updateTargetYearSelect();
		},

		onTargetYearChange: function( evt ) {
			var $this = $( evt.target ),
				mapConfig = App.ChartModel.get( "map-config" ),
				val = $this.val(),
				targetYear, targetYearMode = "normal";

			if( val === "earliest" ) {
				targetYearMode = val;
				targetYear = mapConfig.minYear;
			} else if( val === "latest" ) {
				targetYearMode = val;
				targetYear = mapConfig.maxYear;
			} else {
				targetYear = $this.val();
			}

			App.ChartModel.updateMapConfig( "targetYear", targetYear );
			App.ChartModel.updateMapConfig( "targetYearMode", targetYearMode );
		},

		onColorSchemeChange: function( evt ) {
			var $this = $( evt.target );
			App.ChartModel.updateMapConfig( "colorSchemeName", $this.val() );
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
			this.updateColorSchemeSelect();
			this.updateTimelineMode();
			//this.updateTargetYear( true );
		},

		onAvailableTimeChange: function( evt ) {
			this.updateTargetYear( false );
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

	module.exports = App.Views.Form.MapTabView;

})();