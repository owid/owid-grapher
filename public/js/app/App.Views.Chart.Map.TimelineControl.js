;(function() {
	"use strict";
	owid.namespace("App.Views.Chart.Map.TimelineControl");
	
	App.Views.Chart.Map.TimelineControl = Backbone.View.extend({
		el: "#map-chart-tab .map-timeline-controls .timeline-control",
		events: {
			"mousedown": "onMousedown",
			"touchstart": "onTouchstart"
		},

		initialize: function( options ) {
			this.dispatcher = options.dispatcher;
			
			var mapConfig = App.ChartModel.get( "map-config" );
			
			this.$sliderWrapper = this.$el.find( ".timeline-wrapper" );
			this.$slider = this.$el.find( ".timeline-slider" );
			this.$sliderLabel = this.$slider.find( ".timeline-slider-label" );
			this.$sliderInput = this.$sliderWrapper.find( "[type='range']" );

			this.$startYear = this.$el.find( ".timeline-start-year" );
			this.$endYear = this.$el.find( ".timeline-end-year" );

			this.dispatcher.on("increment-time", this.onIncrementTime, this);
			App.ChartModel.on("change-map", this.onChangeYear, this);
			App.ChartModel.on("change-map-year", this.onChangeYear, this);			
		},

		onMousedown: function(evt) {
			this.isDragging = true;
			$(window).one("mouseup", this.onMouseup.bind(this));
			$(window).on("mousemove.timeline", this.onMousemove.bind(this));
			this.onMousemove(evt);
		},

		onTouchstart: function(evt) {
			this.isDragging = true;
			$(window).one("touchend", this.onMouseup.bind(this));
			$(window).on("touchmove.timeline", this.onMousemove.bind(this));
			this.onMousemove(evt);			
		},

		onMouseup: function() {
			this.isDragging = false;
			$(window).off("touchend.timeline");
			$(window).off("mousemove.timeline");
		},

		onMousemove: function(evt) {
			if (!this.isDragging) return;
			evt.preventDefault();

			var pageX = evt.pageX || evt.originalEvent.touches[0].pageX,
				xPos = pageX - this.$sliderInput.offset().left,
				fracWidth = xPos / this.$sliderInput.width(),
				targetYear = this.minYear + fracWidth*(this.maxYear-this.minYear);

			this.setTargetYear(targetYear);
		},

		setTargetYear: function(targetYear) {
			// Find the closest year that is a valid selection
			var closestYear = _.min(this.years, function(year) {
				return Math.abs(year-targetYear);
			});

			App.ChartModel.updateMapConfig("targetYear", closestYear, false, "change-map-year");			
		},

		render: function() {
			var mapConfig = App.ChartModel.get("map-config"),
				minYear = App.DataModel.get("minYear"),
				maxYear = App.DataModel.get("maxYear");
			
			this.years = owid.timeRangesToYears(mapConfig.timeRanges, minYear, maxYear);
			this.minYear = this.years[0];
			this.maxYear = this.years[this.years.length-1];
			this.targetYear = mapConfig.targetYear;

			this.$startYear.text(owid.displayYear(this.minYear));
			this.$endYear.text(owid.displayYear(this.maxYear));

			if (owid.displayYear(this.minYear).length > 4) 
				this.$startYear.css('font-size', '10px');
			else
				this.$startYear.css('font-size', "");

			if (owid.displayYear(this.maxYear).length > 4) 
				this.$endYear.css('font-size', '10px');
			else
				this.$endYear.css('font-size', "");
			
			this.$sliderInput.attr( "min", this.minYear );
			this.$sliderInput.attr( "max", this.maxYear );
			
			this.updateSliderInput( this.targetYear );
			
			if (this.minYear == this.maxYear) {
				this.$sliderInput.attr("disabled", true);
			} else {
				this.$sliderInput.attr("disabled", false);
			}

			this.createTicks(this.$sliderInput);
		},

		updateSliderInput: function(time) {
			var intTime = parseInt(time, 10),
				min = parseInt( this.$sliderInput.attr( "min" ), 10 ),
				max = parseInt( this.$sliderInput.attr( "max" ), 10 ),
				newPoint = ( intTime - min ) / ( max - min );
			
			this.$sliderLabel.text(owid.displayYear(time));
			this.$slider.css("left", this.$sliderWrapper.width()*newPoint);
			this.$sliderInput.val(intTime);
			if (intTime === min || intTime === max) {
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

		onChangeYear: function() {
			var targetYear = App.ChartModel.get("map-config").targetYear;
			this.updateSliderInput(targetYear);

			if (targetYear != parseInt(this.$sliderInput.val()))
				this.$sliderInput.trigger("change");		
		},

		onIncrementTime: function( evt ) {
			var currentYear = parseInt(this.$sliderInput.val()),
				index = this.years.indexOf(currentYear);

			var nextIndex = index+1;
			if (nextIndex >= this.years.length) {
				this.dispatcher.trigger( "max-increment-time" );
				return;				
			}

			var nextYear = this.years[nextIndex];
			this.setTargetYear(nextYear);
		},

		createTicks: function( $input ) {
			if( this.$el.find( ".timeline-ticks" ).length ) {
				//this.$el.find(".timeline-ticks").remove();
				//already has ticks, bail
				return;
			}

			var min = this.minYear,
				max = this.maxYear,
				rangeSize = max-min,
				htmlString = "<ol class='timeline-ticks'>";	

			_.each(this.years, function(year, i) {
				var progress = (year-min) / rangeSize,
					percent = progress*100,
					translate = "translate(-" + percent + "%, 0)",
					tickString = "<li style='left:" + percent + "%;-webkit-transform:" + translate + ";-ms-transform:" + translate + ";transform:" + translate + "'>" + year + "</li>";
				htmlString += tickString;
			});

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
})();