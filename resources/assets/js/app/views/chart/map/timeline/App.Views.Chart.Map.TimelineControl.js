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

			return;
		},

		render: function() {

			var mapConfig = App.ChartModel.get( "map-config" );
			
			this.$startYear.text( mapConfig.minYear );
			this.$endYear.text( mapConfig.maxYear );
			
			this.$sliderInput.attr( "min", mapConfig.minYear );
			this.$sliderInput.attr( "max", mapConfig.maxYear );
			//this.$sliderInput.attr( "step", mapConfig.timeInterval ); // had to disable this because wouldn't allow to chose starting and ending year outside of steo
			
			this.updateSliderInput( mapConfig.targetYear );
			
			if( isNaN( mapConfig.minYear ) || isNaN( mapConfig.maxYear ) ) {
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
				targetYear = parseInt( $this.val(), 10 );

			//make sure target year is withing allowed interval (e.g. if we start 1980 with interval 5, you shouldn't be allowed to select 1982)
			//needs to be in place because had to disable step on the timeline control
			var mapConfig = App.ChartModel.get( "map-config" ),
				diffFromMinYear = targetYear - mapConfig.minYear,
				//let's see if we're off the chosen gap
				yearsOutsideOfStep = diffFromMinYear % mapConfig.timeInterval,
				//need flag to fire change event if manually adjusting value
				manualAdjustment = false;

			if( yearsOutsideOfStep ) {
				//we're off, so we have to snap the value to closest value
				if( yearsOutsideOfStep > mapConfig.timeInterval/2 ) {
					//we're closer to the higher value, snap to it
					targetYear += mapConfig.timeInterval - yearsOutsideOfStep;
				} else {
					//we're close to the lower value, snap to it
					targetYear -= yearsOutsideOfStep;
				}
				//make sure we don't somehow go over bounds
				targetYear = Math.min( targetYear, mapConfig.maxYear );
				targetYear = Math.max( targetYear, mapConfig.minYear );

				//set flag
				manualAdjustment = true;
			}

			this.updateSliderInput( targetYear );
		
			if( manualAdjustment ) {
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
				//already has ticks, bail
				return;
			}

			var mapConfig = App.ChartModel.get( "map-config" ),
				step = parseInt( mapConfig.timeInterval, 10 ),
				max = parseInt( $input.attr( "max" ), 10 ),
				min = parseInt( $input.attr( "min" ), 10 ),
				numSteps = Math.floor( ( max - min ) / step ),
				inputWidth = this.$sliderInput.width(),
				stepSize = inputWidth / numSteps,
				currStep = min,
				htmlString = "<ol class='timeline-ticks'>";

			for( var i = 0; i <= numSteps; i++ ) {
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