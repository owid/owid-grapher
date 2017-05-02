
import _ from 'lodash'
import * as d3 from 'd3'
import Bounds from './Bounds'
import dataflow from './owid.dataflow'
import owid from '../owid'

export default function() {
	var timeline = dataflow();

    timeline.requires('containerNode', 'outerBounds');

	timeline.defaults({
		years: [1900, 1920, 1940, 2000], // Range of years the timeline covers
		inputYear: 1980,
		isPlaying: false,
		isDragging: false
	});

    timeline.flow('bounds : outerBounds', function(outerBounds) {
        var height = 45;
        return new Bounds(outerBounds.left, outerBounds.top+(outerBounds.height-height), outerBounds.width, height).padWidth(outerBounds.width*0.02);
    });

	// Data processing
	timeline.flow("minYear : years", function(years) { return _.first(years); });
	timeline.flow("maxYear : years", function(years) { return _.last(years); });

	timeline.flow("inputYear : inputYear, minYear, maxYear", function(inputYear, minYear, maxYear) {
		return Math.max(Math.min(inputYear, maxYear), minYear);
	});

	// If we're not playing or dragging, lock the input to the closest year (no interpolation)
	timeline.flow('inputYear : inputYear, years, isPlaying, isDragging', function(inputYear, years, isPlaying, isDragging) {			
		if (!isPlaying && !isDragging)
			return _.sortBy(years, function(year) { return Math.abs(year-inputYear); })[0];
		else
			return inputYear;
	});

	// Find the nearest target year, favoring prior years
	timeline.flow("targetYear : inputYear, years", function(inputYear, years) {
		return _.find(
			_.sortBy(years, function(year) { return Math.abs(year-inputYear); }),
			function(year) { return year <= inputYear; }
		);
	});

		// Start building DOM
	timeline.flow('g : containerNode', function(containerNode) {
		return d3.select(containerNode).append('g').attr('class', 'timeline').style('cursor', 'pointer');
	});
	timeline.flow('g, bounds', function(g, bounds) {
		g.attr('transform', 'translate(' + bounds.left + ',' + bounds.top + ')');
	});
    // We put a rectangle in to catch mouse events
    timeline.flow('bgRect : g, bounds', function(g, bounds) {
        g.selectAll('.bgRect').remove();
        return g.insert('rect', '*').attr('class', 'bgRect')
            .attr('x', 0).attr('y', 0)
            .attr('width', bounds.width).attr('height', bounds.height)
            .style('fill', 'white');
    });

	timeline.flow('playToggle : g', function(g) {
		return g.append("text")
		  .attr('class', 'toggle')
		  .style("font-family","FontAwesome")
		  .style('font-size', '1.4em')
		  .style('cursor', 'pointer')
		  .text('\uf28c'); 
		});

		timeline.flow('playToggle, bounds', function(playToggle, bounds) {
			playToggle.attr('x', 10).attr('y', bounds.height/2).attr('dy', 1+playToggle.node().getBBox().height/4);
		});

		timeline.flow('minYearLabel, maxYearLabel : g', function(g) {
			return [
				g.append('text').attr('class', 'minYearLabel').style('font-size', '0.8em').style('fill', '#666'),
				g.append('text').attr('class', 'maxYearLabel').style('font-size', '0.8em').style('fill', '#666').attr('dy', '.3em').style('text-anchor', 'end')
			];
		});

		timeline.flow('minYearBox : minYearLabel, minYear, bounds', function(minYearLabel, minYear, bounds) {
			return Bounds.fromBBox(minYearLabel
				.text(minYear)
				.attr('x', 45)
				.attr('y', bounds.height/2)
				.attr('dy', minYearLabel.node().getBBox().height/4)
				.node().getBBox());
		});

		timeline.flow('maxYearBox : maxYearLabel, maxYear, bounds', function(maxYearLabel, maxYear, bounds) {
			return Bounds.fromBBox(maxYearLabel
				.text(maxYear)
				.attr('x', bounds.width)
				.attr('y', bounds.height/2)
				.attr('dy', maxYearLabel.node().getBBox().height/4)
				.node().getBBox());
		});

		timeline.flow('sliderBounds : minYearBox, maxYearBox, bounds', function(minYearBox, maxYearBox, bounds) {
        var sliderHeight = 12;
			var left = minYearBox.left + minYearBox.width + 15;
			return new Bounds(left, (bounds.height-sliderHeight)/2, bounds.width-maxYearBox.width-left-15, sliderHeight);
		});

		timeline.flow('xScale : years, sliderBounds', function(years, sliderBounds) {
			return d3.scaleLinear().domain(d3.extent(years)).range([sliderBounds.left, sliderBounds.left+sliderBounds.width]);
		});

		timeline.flow('sliderBackground : g', function(g) {
			return g.append('rect')
				.style('stroke-width', 0.1)
            .attr('class', 'sliderBackground');
		});

		timeline.flow('sliderBackground, sliderBounds', function(sliderBackground, sliderBounds) {
			sliderBackground
				.attr('x', sliderBounds.left-5)
				.attr('y', sliderBounds.top)
				.attr('width', sliderBounds.width+10)
				.attr('height', sliderBounds.height)
				.attr('rx', 5)
				.attr('ry', 5)
				.attr('fill', '#eee');
		});

		// Make and position the little marker that you drag around  		
		timeline.flow('sliderHandle : g', function(g) {
			var handle = g.append('g').attr('class', 'handle')
            .style('fill', '#3F9EFF');

			handle.append('circle')
				.attr('r', 8)
            .style('stroke', '#000')
            .style('stroke-width', 0.1);

			handle.append('text')  				
				.attr('y', -9)
				.style('font-size', '0.7em')
				.style('text-anchor', 'middle');

			return handle;
		});

		timeline.flow('sliderHandle, targetYear, minYear, maxYear', function(sliderHandle, targetYear, minYear, maxYear) {
        if (targetYear == minYear || targetYear == maxYear)
            sliderHandle.selectAll('text').text('');
        else
  			sliderHandle.selectAll('text').text(targetYear);
		});

		timeline.flow('sliderHandle, xScale, inputYear, sliderBounds', function(sliderHandle, xScale, inputYear, sliderBounds) {
			sliderHandle.attr('transform', 'translate(' + xScale(inputYear) + ',' + (sliderBounds.top + sliderBounds.height/2) + ')');
		});

	// Make ticks on the slider representing years with available data
    timeline.flow('ticksG : g', function(g) {
        return g.insert('g', '.sliderBackground').attr('class', 'ticks');
    });
	timeline.flow("ticks : ticksG, years, xScale, sliderBounds", function(ticksG, years, xScale, sliderBounds) {
		var ticksUpdate = ticksG.selectAll('.tick').data(years.slice(1, -1));

		var ticks = ticksUpdate.enter()
			.append('rect')
			.attr('class', 'tick')
			.attr('width', '1px')
			.style('fill', 'rgba(0,0,0,0.2)')
		  .merge(ticksUpdate)
		  	.attr('height', '0.2em')
			.attr('x', function(d) { return xScale(d); })
			.attr('y', sliderBounds.top+sliderBounds.height-1);

		ticksUpdate.exit().remove();

		return ticks;
	});

	/*timeline.flow('tickLabels : g, years, xScale, bounds', function(g, years, xScale, bounds) {
		var labelsUpdate = g.selectAll('.tickLabel').data(years.slice(1, -1));

		var labels = labelsUpdate.enter()
			.append('text')
			.attr('class', 'tickLabel')
			.style('text-anchor', 'middle')
			.style('font-size', '0.7em')
		  .merge(labelsUpdate)
			.attr('x', function(d) { return xScale(d); })
			.attr('y', bounds.height)
			.text(function(d) { return d; });				

		labelsUpdate.exit().remove();

		return labels;
	});*/

	// Allow dragging the handle around
	timeline.flow('g, sliderBackground', function(g, sliderBackground) {
		var container = d3.select(document.body),
            sliderBBox = sliderBackground.node().getBBox(),
			isDragging = false;

        var frameQueued = false;
		function onMouseMove() {
            if (frameQueued) return;
            frameQueued = true;

			var evt = d3.event;
            var mouseX = d3.mouse(g.node())[0];
            // Use animation frame so we don't overload the browser, esp. Firefox/IE
            requestAnimationFrame(function() {
                timeline.now('years, minYear, maxYear', function(years, minYear, maxYear) {
                    var fracWidth = (mouseX-sliderBBox.x) / sliderBackground.node().getBBox().width,
                        inputYear = minYear + fracWidth*(maxYear-minYear);

                    timeline.update({ isDragging: true, inputYear: inputYear });
                    frameQueued = false;
                });       
            });
            evt.preventDefault();
		}

		function onMouseUp() {
			container.on('mousemove.timeline', null);
			container.on('mouseup.timeline', null);
            container.on('touchmove.timeline', null);
            container.on('touchend.timeline', null);
			//container.on('mouseleave.timeline', null);
            requestAnimationFrame(function() {
                timeline.update({ isDragging: false });
            });
		}

        function onMouseDown() {
            var evt = d3.event;
            // Don't do mousemove if we clicked the play or pause button
            if (d3.select(evt.target).classed('toggle')) return;

            container.on('mousemove.timeline', onMouseMove);
            container.on('mouseup.timeline', onMouseUp);
            container.on('touchmove.timeline', onMouseMove);
            container.on('touchend.timeline', onMouseUp);
            //container.on('mouseleave.timeline', onMouseUp);
            onMouseMove();                
        }

		g.on('mousedown.timeline', onMouseDown);
        g.on('touchstart.timeline', onMouseDown);
	});

	// Interpolated playing animation
	timeline.flow('playToggle', function(playToggle) {
		playToggle.on('click', function() {
			timeline.update({ isPlaying: !timeline.isPlaying });
		});
	});

	var _anim;
	timeline.flow('playToggle, isPlaying', function(playToggle, isPlaying) {
		// Pause or play icon
		playToggle.text(isPlaying ? '\uf28c' : '\uf01d');

		cancelAnimationFrame(_anim);
		if (isPlaying) {
			// If we start playing from the end, reset from beginning
			timeline.now('targetYear, minYear, maxYear', function(targetYear, minYear, maxYear) {
				if (targetYear >= maxYear)
					timeline.update({ inputYear: minYear });
			});

			_anim = requestAnimationFrame(incrementLoop);
		}

		var lastTime = null, ticksPerSec = 5;
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

					timeline.update({ inputYear: inputYear+(Math.max(yearsToNext/3, 1)*elapsed*ticksPerSec/1000) });
				}

				_anim = requestAnimationFrame(incrementLoop);
			});
		}
	});

	timeline.beforeClean(function() {
		if (timeline.g) timeline.g.remove();
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
        return _.minBy(state.years, function(year) {
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