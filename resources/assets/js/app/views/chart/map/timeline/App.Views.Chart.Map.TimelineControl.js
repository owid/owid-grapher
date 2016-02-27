;( function() {
	
	"use strict";

	var App = require( "./../../../../namespaces.js" );

	App.Views.Chart.Map.TimelineControl = Backbone.View.extend({

		el: "#map-chart-tab .map-timeline-controls .timeline-control",
		events: {
			"input [type='range']": "onTargetYearInput",
			"change [type='range']": "onTargetYearChange",
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			
			var mapConfig = App.ChartModel.get( "map-config" );
			
			this.$win = $( window );
			this.$sliderWrapper = this.$el.find( ".timeline-wrapper" );
			this.$slider = this.$el.find( ".timeline-slider" );
			this.$sliderLabel = this.$slider.find( ".timeline-slider-label" );
			this.$sliderInput = this.$sliderWrapper.find( "[type='range']" );

			this.$startYear = this.$el.find( ".timeline-start-year" );
			this.$endYear = this.$el.find( ".timeline-end-year" );

			this.dispatcher.on( "increment-time", this.onIncrementTime, this );

			//this.$win.on( "resize", $.proxy( this.onResize, this ) );

			//year slider
			/*  App.ChartModel.on( "change", this.onChartModelChange, this );
				App.ChartModel.on( "change-map", this.onChartModelChange, this );*/

		},

		render: function() {
			var mapConfig = App.ChartModel.get( "map-config" );
			
			this.years = App.Utils.timeRangesToYears(mapConfig.timeRanges, mapConfig.minYear, mapConfig.maxYear);
			this.minYear = this.years[0];
			this.maxYear = this.years[this.years.length-1];
			this.targetYear = mapConfig.targetYear;

			this.$startYear.text(this.minYear);
			this.$endYear.text(this.maxYear);
			
			this.$sliderInput.attr( "min", this.minYear );
			this.$sliderInput.attr( "max", this.maxYear );
			//this.$sliderInput.attr( "step", mapConfig.timeInterval ); // had to disable this because wouldn't allow to chose starting and ending year outside of steo
			
			this.updateSliderInput( this.targetYear );
			
			if (this.minYear == this.maxYear) {
				this.$sliderInput.attr( "disabled", true );
			} else {
				this.$sliderInput.attr( "disabled", false );
			}

			this.createTicks( this.$sliderInput );
		},

		updateSliderInput: function( time ) {
			var intTime = parseInt( time, 10 ),
				min = parseInt( this.$sliderInput.attr( "min" ), 10 ),
				max = parseInt( this.$sliderInput.attr( "max" ), 10 ),
				newPoint = ( intTime - min ) / ( max - min );
			
			this.$sliderLabel.text( time );
			this.$slider.css( "left", this.$sliderWrapper.width()*newPoint );
			this.$sliderInput.val( intTime );
			if( intTime === min || intTime === max ) {
				this.$sliderLabel.hide();
				this.$sliderInput.removeClass( "thumb-label" );
				if( intTime === min ) {
					this.$startYear.addClass( "highlight" );
					this.$endYear.removeClass( "highlight" );
				} else {
					this.$startYear.removeClass( "highlight" );
					this.$endYear.addClass( "highlight" );
				}
			} else {
				this.$sliderLabel.show();
				this.$sliderInput.addClass( "thumb-label" );
				this.$startYear.removeClass( "highlight" );
				this.$endYear.removeClass( "highlight" );
			}
		},

		onChartModelChange: function( evt ) {
			this.render();
		},

		onTargetYearInput: function( evt ) {
			var $this = $( evt.target ),
				targetYear = parseInt($this.val());

			// Since we may have arbitrary year ranges with no consistent "step", we must instead
			// set the slider to step 1 and then lock to the nearest actual year on input
			var closestYear = _.min(this.years, function(year) {
				return Math.abs(year-targetYear);
			});

			this.updateSliderInput(closestYear);
		
			if (closestYear != targetYear) {
				this.$sliderInput.trigger("change");
			}
		},

		onTargetYearChange: function( evt ) {
			var $this = $( evt.target ),
				targetYear = parseInt( $this.val(), 10 );
			
			App.ChartModel.updateMapConfig( "targetYear", targetYear, false, "change-map" );
			this.render();
		},

		onIncrementTime: function( evt ) {

			var mapConfig = App.ChartModel.get( "map-config" ),
				nowValue = parseInt( this.$sliderInput.val(), 10 ),
				step = parseInt( mapConfig.timeInterval, 10 ),
				newValue = nowValue + step,
				max = parseInt( this.$sliderInput.attr( "max" ), 10 );

			if( nowValue === max ) {
				newValue = parseInt( this.$sliderInput.attr( "min" ), 10 );
			}

			if( newValue >= max ) {
				newValue = max;
				this.dispatcher.trigger( "max-increment-time" );
			}
			
			this.$sliderInput.val( newValue );
			this.$sliderInput.trigger( "change" );

		},

		createTicks: function( $input ) {
			if( this.$el.find( ".timeline-ticks" ).length ) {
				//this.$el.find(".timeline-ticks").remove();
				//already has ticks, bail
				return;
			}

			// Calculate the minimum step between any two years we have to show
			var step = (this.maxYear - this.minYear);
			for (var i = 1; i < this.years.length; i++) {
				step = Math.min(step, this.years[i] - this.years[i-1]);
			}

			var min = this.minYear,
				max = this.maxYear,
				numSteps = Math.floor( ( max - min ) / step ),
				inputWidth = this.$sliderInput.width(),
				stepSize = inputWidth / numSteps,
				currStep = min,
				htmlString = "<ol class='timeline-ticks'>";	

			for( i = 0; i <= numSteps; i++ ) {
				var percent = i * stepSize + "%",
					translate = "translate(-" + Math.floor( i * stepSize ) + "%, 0)",
					tickString = "<li style='left:" + percent + ";-webkit-transform:" + translate + ";-ms-transform:" + translate + ";transform:" + translate + "'>" + currStep + "</li>";
				htmlString += tickString;
				currStep += step;
			}

			htmlString += "</ol>";
			$input.after( $( htmlString ) );
		},

		show: function() {
			this.$el.css( "display", "block" );
		},

		hide: function() {
			this.$el.css( "display", "none" );
		}

	});

	module.exports = App.Views.Chart.Map.TimelineControl;

})();