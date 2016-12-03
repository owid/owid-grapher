;(function(d3) {
	"use strict";
	owid.namespace("owid.view.timeline");

	owid.view.timeline = function() {
		var timeline = owid.dataflow();

		timeline.inputs({
			containerNode: undefined,
			bounds: { left: 0, top: 0, width: 100, height: 100 },
			years: [1900, 1920, 1940, 2000], // Range of years the timeline covers
			targetYear: 1980,
			isPlaying: false
		});

		timeline.flow("minYear : years", function(years) { return _.first(years); });
		timeline.flow("maxYear : years", function(years) { return _.last(years); });

		timeline.flow("el : containerNode", function(containerNode) {
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

			return elUpdate.data([this.state])
				.enter()
					.append('div')
					.attr('class', 'timeline noselect')
					.html(html)
				.merge(elUpdate);
		});

		timeline.flow("el, bounds", function(el, bounds) {
			el.style('position', 'absolute')
				.style('left', bounds.left+'px')
				.style('top', bounds.top+'px')
				.style('width', bounds.width+'px')
				.style('height', bounds.height+'px');
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

		timeline.flow('el, targetYear, minYear, maxYear', function updateSlider(el, targetYear, minYear, maxYear) {
			var fracWidth = (targetYear - minYear) / (maxYear - minYear);

			el.selectAll('.timeline-marker')
				.style('left', (fracWidth*100)+'%');

			el.selectAll('.timeline-label')
				.text(targetYear);
		});

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
						inputYear = minYear + fracWidth*(maxYear-minYear),
						targetYear = _.min(years, function(year) {
					        return Math.abs(year-inputYear);
					    });

					timeline.update({ targetYear: targetYear });
					evt.preventDefault();
				});
			}

			function onMouseUp() {
				container.on('mousemove.timeline', null);
				container.on('mouseup.timeline', null);
				//container.on('mouseleave.timeline', null);
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

		var _anim;
		timeline.flow('el, isPlaying', function togglePlaying(el, isPlaying) {
			el.select('.play-btn').classed('hidden', isPlaying);
			el.select('.pause-btn').classed('hidden', !isPlaying);

			cancelAnimationFrame(_anim);
			if (isPlaying) {
				// If we start playing from the end, reset from beginning
				timeline.now('targetYear, minYear, maxYear', function(targetYear, minYear, maxYear) {
					if (targetYear >= maxYear)
						timeline.update({ targetYear: minYear });
				});

				_anim = requestAnimationFrame(incrementLoop);
			}

			var interval = 500, lastTime = null, countdown = interval;
			function incrementLoop(time) {
				if (lastTime !== null)
					countdown -= (time-lastTime);
				lastTime = time;

				if (countdown > 0) {
					_anim = requestAnimationFrame(incrementLoop);
					return;
				}

				countdown = interval;
				timeline.now('isPlaying, years, targetYear, maxYear', function(isPlaying, years, targetYear, maxYear) {
					if (!isPlaying) return;
					
					if (targetYear >= maxYear) {
						timeline.update({ isPlaying: false });
					} else {
						var index = years.indexOf(targetYear);
						timeline.update({ targetYear: years[index+1] });
						_anim = requestAnimationFrame(incrementLoop);
					}
				});
			}
		});

		timeline.flow('el', function setupPlayBtn(el) {
			el.select('.play-btn').on('click', function() {
				timeline.update({ isPlaying: true });
			});

			el.select('.pause-btn').on('click', function() {
				timeline.update({ isPlaying: false });
			});
		});

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