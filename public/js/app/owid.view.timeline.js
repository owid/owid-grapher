;(function(d3) {
	"use strict";
	owid.namespace("owid.view.timeline");

	owid.view.timeline = function() {
		var timeline = owid.dataflow();

		timeline.inputs({
			containerNode: undefined,
			bounds: { left: 0, top: 0, width: 100, height: 100 },
			years: [1900, 1920, 1940, 2000], // Range of years the timeline covers
			inputYear: 1980,
			isPlaying: false,
			isDragging: false
		});

		timeline.flow("minYear : years", function(years) { return _.first(years); });
		timeline.flow("maxYear : years", function(years) { return _.last(years); });

		timeline.flow("inputYear : inputYear, minYear, maxYear", function(inputYear, minYear, maxYear) {
			return Math.max(Math.min(inputYear, maxYear), minYear);
		});

		// Find the closest available year to the input year
		timeline.flow("targetYear : inputYear, years", function(inputYear, years) {
			return _.find(
				_.sortBy(years, function(year) { return Math.abs(year-inputYear); }),
				function(year) { return year <= inputYear; }
			);
		});

		// If we're not playing or dragging, lock the input to an actual year (no interpolation)
		timeline.flow('inputYear : inputYear, targetYear, isPlaying, isDragging', function(inputYear, targetYear, isPlaying, isDragging) {			
			if (!isPlaying && !isDragging)
				return targetYear;
			else
				return inputYear;
		});

		// How far along the timeline marker is as fraction of slider width
		timeline.flow("fracWidth : inputYear, minYear, maxYear", function(inputYear, minYear, maxYear) {
			return (inputYear - minYear) / (maxYear - minYear);
		});

		timeline.flow("el : containerNode, years", function(containerNode, years) {
			var html = '<div class="play-pause-control control">' +
				'	<a class="play-btn btn"><i class="fa fa-play-circle-o"></i></a>' +
				'	<a class="pause-btn btn hidden"><i class="fa fa-pause-circle-o"></i></a>' +
				'</div>' +
				'<div class="timeline-min-year">1950</div>' +
				'<div class="timeline-slider">' +
				'	<div class="timeline-marker start">' +
				'		<div class="timeline-label">1950</div>' +
				'	</div>' +
				'	<div class="timeline-range"></div>' +
				'	<div class="timeline-marker end">' +
				'		<div class="timeline-label">2000</div>' +
				'	</div>' +
				'</div>' +
				'<div class="timeline-max-year">2000</div>';

			var elUpdate = d3.select(containerNode).selectAll('.timeline');

			if (years.length <= 1) {
				// Don't need a timeline with no years...
				return elUpdate.remove();
			} else {
				return elUpdate.data([this.state])
					.enter()
						.append('div')
						.attr('class', 'timeline noselect')
						.html(html)
					.merge(elUpdate);				
			}
		});

		timeline.flow("el, bounds", function(el, bounds) {
			el.style('position', 'absolute')
				.style('left', bounds.left+'px')
				.style('top', bounds.top+'px')
				.style('width', bounds.width+'px')
				.style('height', bounds.height+'px');
		});

		// Make ticks on the slider representing years with available data
		timeline.flow("ticks : el, years, minYear, maxYear", function(el, years, minYear, maxYear) {
			var ticksUpdate = el.select('.timeline-slider')
				.selectAll('.tick')
				.data(years.slice(1, -1));

			ticksUpdate.enter()
				.append('div')
				.style('position', 'absolute')
				.style('width', '1px')
				.style('height', '100%')
				.style('background-color', 'white')
				.style('border-radius', '5px')
			  .merge(ticksUpdate)
			  	.style('left', function(d) { return ((d-minYear)/(maxYear-minYear))*100 + '%' });
		});

		// Fill out the year labels
		timeline.flow("el, targetYear", function(el, targetYear) {
			el.selectAll('.timeline-label').text(targetYear);
		});

		timeline.flow("el, minYear", function(el, minYear) {
			el.select('.timeline-min-year').text(minYear);
		});		

		timeline.flow("el, minYear, targetYear", function(el, minYear, targetYear) {
			el.classed('min-active', minYear == targetYear);
		});

		timeline.flow("el, maxYear", function(el, maxYear) {
			el.select('.timeline-max-year').text(maxYear);
		});

		timeline.flow("el, maxYear, targetYear", function(el, maxYear, targetYear) {
			el.classed('max-active', maxYear == targetYear);
		});

		timeline.flow('handle : el', function(el) {
			return el.selectAll('.timeline-marker');
		})

		// Position the slider handle
		timeline.flow('handle, fracWidth', function(handle, fracWidth) {
			handle.style('left', (fracWidth*100)+'%');
		});		

		// Allow dragging the handle around
		timeline.flow('el', function bindSlider(el) {
			var slider = el.select('.timeline-slider'),
				container = d3.select(document.body),
				isDragging = false;

			function onMouseMove() {
				var evt = d3.event;
				timeline.now('years, minYear, maxYear', function(years, minYear, maxYear) {
					var sliderBounds = chart.getTransformedBounds(slider.node()),
						mouseX = _.isNumber(evt.pageX) ? evt.pageX : evt.touches[0].pageX,
						fracWidth = (mouseX-sliderBounds.left) / sliderBounds.width,
						inputYear = minYear + fracWidth*(maxYear-minYear);

					timeline.update({ isDragging: true, inputYear: inputYear });
					evt.preventDefault();
				});
			}

			function onMouseUp() {
				container.on('mousemove.timeline', null);
				container.on('mouseup.timeline', null);
				//container.on('mouseleave.timeline', null);
				timeline.update({ isDragging: false });
			}

			el.on('mousedown.timeline', function() {
				var evt = d3.event;
				// Don't do mousemove if we clicked the play or pause button
				if (d3.select(evt.target).classed('fa')) return;

				container.on('mousemove.timeline', onMouseMove);
				container.on('mouseup.timeline', onMouseUp);
				//container.on('mouseleave.timeline', onMouseUp);
				onMouseMove();
			});
		});

		// Interpolated playing animation
		timeline.flow('el', function setupPlayBtn(el) {
			el.select('.play-btn').on('click', function() {
				timeline.update({ isPlaying: true });
			});

			el.select('.pause-btn').on('click', function() {
				timeline.update({ isPlaying: false });
			});
		});

		var _anim;
		timeline.flow('el, isPlaying', function togglePlaying(el, isPlaying) {
			el.select('.play-btn').classed('hidden', isPlaying);
			el.select('.pause-btn').classed('hidden', !isPlaying);

			cancelAnimationFrame(_anim);
			if (isPlaying) {
				// If we start playing from the end, reset from beginning
				timeline.now('targetYear, minYear, maxYear', function(targetYear, minYear, maxYear) {
					if (targetYear >= maxYear)
						timeline.update({ inputYear: minYear });
				});

				_anim = requestAnimationFrame(incrementLoop);
			}

			var lastTime = null, ticksPerSec = 3;
			function incrementLoop(time) {
				var elapsed = lastTime ? time-lastTime : 0;
				lastTime = time;

				timeline.now('isPlaying, inputYear, targetYear, years, maxYear', function(isPlaying, inputYear, targetYear, years, maxYear) {
					if (!isPlaying) return;
					
					if (inputYear >= maxYear) {
						timeline.update({ isPlaying: false });
					} else {
						var nextYear = years[years.indexOf(targetYear)+1],
							yearsToNext = nextYear-targetYear;

						timeline.update({ inputYear: inputYear+(Math.max(yearsToNext/2, 1)*elapsed*ticksPerSec/1000) });
					}

					_anim = requestAnimationFrame(incrementLoop);
				});
			}
		});


		timeline.remove = function() {
			timeline.now('el', function(el) {
				el.remove();
			});
		};

		return timeline;
	};

	owid.view.timelineold = function(chart, containerNode) {
		var timeline = {};

		var state = {
			years: [1900, 1920, 1940, 2000], // Series of selectable years
			startYear: 1960, // Selected start year for range
			endYear: 1980 // Selected end year for range
		};
		timeline.state = state;

		timeline.dispatch = d3.dispatch('change');

		var changes = owid.changes();
		changes.track(state);

		var minYear, maxYear;

		// The raw calculated values from the slider input which may not correspond to an actual year
		// We keep these around in order to keep the range distance consistent while moving
		var startInputYear, endInputYear;

		var $container = $(containerNode),
			$el, $sliderWrapper, $slider, $sliderLabel, $sliderInput, $minYear, $maxYear,
			$startYearMarker, $endYearMarker, $startYearLabel, $endYearLabel, $rangeMarker;

		var dragTarget;

		function onMousedown(evt) {
			var $marker = $(evt.target).closest('.timeline-marker');

			if (!$marker.length)
				dragTarget = 'range';
			else if ($marker.is('.start'))
				dragTarget = 'start';
			else if ($marker.is('.end'))
				dragTarget = 'end';	

			$(window).one("mouseup", onMouseup);
			$(window).on("mousemove.timeline", onMousemove);
			onMousemove(evt); // To allow clicking as well as dragging
		}

		function onMouseup(evt) {
			dragTarget = null;
			$(window).off("touchend.timeline");
			$(window).off("mousemove.timeline");
		}

		function onMousemove(evt) {
			evt.preventDefault();

			var pageX = evt.pageX || evt.originalEvent.touches[0].pageX,
				xPos = pageX - $slider.offset().left*(owid.features.zoom && chart.scale > 1 ? chart.scale : 1),
				fracWidth = xPos / ($slider.width()*chart.scale),
				inputYear = minYear + fracWidth*(maxYear-minYear);

			inputYear = Math.max(minYear, Math.min(maxYear, inputYear));

			if (dragTarget == 'start') {
				if (inputYear > endInputYear)
					startInputYear = state.endYear;
				else
					startInputYear = inputYear;
			} else if (dragTarget == 'end') {
				if (inputYear < state.startYear)
					endInputYear = state.startYear;
				else
					endInputYear = inputYear;
			} else if (dragTarget == 'range') {
				var centerYear = startInputYear + (endInputYear-startInputYear)/2,
					diff = inputYear-centerYear;

				if (startInputYear+diff < minYear)
					diff = minYear-startInputYear;
				if (endInputYear+diff > maxYear)
					diff = maxYear-endInputYear;

				startInputYear += diff;
				endInputYear += diff;
			}

			state.startYear = getClosestYear(startInputYear);
			state.endYear = getClosestYear(endInputYear);

			// Lock to a single year
			if (state.startYear == state.endYear && dragTarget != 'range')
				startInputYear = endInputYear;

			timeline.dispatch.change();
			timeline.render();
		}

		function initialize() {
			if ($el && $el.length !== 0) return;

			$el = chart.$(".timeline").clone();
			timeline.$el = $el;
			$container.append($el);
			$slider = $el.find(".timeline-slider");
			$sliderLabel = $slider.find(".timeline-slider-label");
			$minYear = $el.find(".timeline-min-year");
			$maxYear = $el.find(".timeline-max-year");

			$startYearMarker = $el.find(".timeline-marker.start");
			$startYearLabel = $startYearMarker.find('.timeline-label');
			$endYearMarker = $el.find(".timeline-marker.end");
			$endYearLabel = $endYearMarker.find('.timeline-label');
			$rangeMarker = $el.find(".timeline-range");

			startInputYear = state.startYear;
			endInputYear = state.endYear;

			$el.off('mousedown').on('mousedown', onMousedown);
		}

		// Find closest year in configured points to any given year
		function getClosestYear(targetYear) {
            return _.min(state.years, function(year) {
                return Math.abs(year-targetYear);
            });
		}

		timeline.node = function() {
			return $el.get(0);
		};

		timeline.render = function() {
			if (!changes.start()) return;

			initialize();

			if (changes.any('years')) {
				minYear = _.first(state.years);
				maxYear = _.last(state.years);

				$minYear.text(owid.displayYear(minYear));
				$maxYear.text(owid.displayYear(maxYear));

				if (owid.displayYear(minYear).length > 4) 
					$minYear.css('font-size', '10px');
				else
					$minYear.css('font-size', "");

				if (owid.displayYear(maxYear).length > 4) 
					$maxYear.css('font-size', '10px');
				else
					$maxYear.css('font-size', "");
			}
	
			if (changes.any('startYear endYear')) {
				var startYear = getClosestYear(state.startYear), endYear = getClosestYear(state.endYear);
				$el.toggleClass('min-active', startYear == minYear);
				$el.toggleClass('max-active', endYear == maxYear);

				var startYearFrac = (startYear-minYear)/(maxYear-minYear);	
				$startYearMarker.css('left', 'calc(' + (startYearFrac*100) + '% - 0.5em)');
				var endYearFrac = (endYear-minYear)/(maxYear-minYear);	
				$endYearMarker.css('left', 'calc(' + (endYearFrac*100) + '% - 0.5em)');

				$rangeMarker.css('left', (startYearFrac*100) + '%');
				$rangeMarker.css('width', (endYearFrac-startYearFrac)*100 + '%');

				$startYearLabel.text(startYear);
				$endYearLabel.text(endYear);
			}	

			changes.done();
		};

		return timeline;
	};
})(d3v4);