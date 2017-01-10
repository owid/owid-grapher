// @flow

import * as _ from '../libs/underscore'
import * as d3 from '../libs/d3.v4'
import owid from '../owid'
import Bounds from './Bounds'
import Text from './Text'
import type { SVGElement } from './Util'
import { getRelativeMouse } from './Util'
import { h, render, Component } from 'preact'
import { observable, computed, asFlat, autorun, autorunAsync, action } from 'mobx'
import { bind } from 'decko'

type TimelineProps = {
	years: number[],
	inputYear: number,
	onTimeChange: (number, number) => void,
	bounds: Bounds
};

export default class Timeline extends Component {
	props: TimelineProps

	state: {
		inputYear: number,
		isPlaying: boolean,
		isDragging: boolean
	}

	g: SVGElement

	static calculateBounds(containerBounds : Bounds, props : any) : Bounds {
		const height = 45
		return new Bounds(containerBounds.left, containerBounds.top+(containerBounds.height-height), containerBounds.width, height).padWidth(containerBounds.width*0.02)
	}

	@observable props = asFlat({})
  	@observable state = asFlat({})

	constructor(props : TimelineProps) {
		super(props)
		this.state.inputYear = props.inputYear

		autorun(() => {
			const { isPlaying } = this

			if (isPlaying)
				this.onStartPlaying()
			else
				this.onStopPlaying()
		})

		autorunAsync(() => {
			this.props.onTargetChange(this.targetYear)
		})
	}

	@computed get years() : number[] { 
		return this.props.years
	}

	@computed get bounds() : Bounds {
		return this.props.bounds
	}

	@computed get minYear() : number {
		return _.first(this.props.years)
	}

	@computed get maxYear() : number {
		return _.last(this.props.years)
	}

	@computed get inputYear() : number {
		let { inputYear, isPlaying, isDragging } = this.state
		const { years, minYear, maxYear } = this
		inputYear = Math.max(Math.min(inputYear, maxYear), minYear);

		// If we're not playing or dragging, lock the input to the closest year (no interpolation)
		if (!isPlaying && !isDragging)
			return _.sortBy(years, function(year) { return Math.abs(year-inputYear); })[0];
		else
			return inputYear;
	}

	@computed get targetYear() : number {
		const { years, inputYear } = this

		return _.find(
			_.sortBy(years, function(year) { return Math.abs(year-inputYear); }),
			function(year) { return year <= inputYear; }
		);
	}

	@computed get minYearBox() : Bounds {
		const { minYear, bounds } = this
		return Bounds.forText(minYear.toString(), { fontSize: "0.8em" }).extend({ x: 45, y: bounds.height/2 })
	}

	@computed get maxYearBox() : Bounds {
		const { minYear, bounds } = this
		return Bounds.forText(minYear.toString(), { fontSize: "0.8em" }).extend({ x: bounds.width, y: bounds.height/2 })
	}

	@computed get sliderBounds() : Bounds {
		const { bounds, minYearBox, maxYearBox } = this
		const sliderHeight = 12
		const left = minYearBox.left + minYearBox.width + 15
		return new Bounds(left, (bounds.height-sliderHeight)/2, bounds.width-maxYearBox.width-left-15, sliderHeight)
	}

	@computed get xScale() : any {
		const { years, sliderBounds } = this
		return d3.scaleLinear().domain(d3.extent(years)).range([sliderBounds.left, sliderBounds.left+sliderBounds.width]);
	}

	@computed get isPlaying() : boolean {
		return this.state.isPlaying
	}

	@computed get isDragging() : boolean {
		return this.state.isDragging
	}

	@action componentWillReceiveProps(nextProps : TimelineProps) {
		const { isPlaying, isDragging } = this
		if (!isPlaying && !isDragging)
			this.setState({ inputYear: nextProps.inputYear })
	}

	animRequest: number;

	onStartPlaying() {
		let lastTime = null, ticksPerSec = 5;

		const playFrame = (time : number) => {
			const { isPlaying, inputYear, targetYear, years, minYear, maxYear } = this
			if (!isPlaying) return;

			if (lastTime === null) {
				// If we start playing from the end, loop around to beginning
				if (targetYear >= maxYear)
					this.setState({ inputYear: minYear })
			} else {
				const elapsed = time-lastTime;
				
				if (inputYear >= maxYear) {
					this.setState({ isPlaying: false })
				} else {
					const nextYear = years[years.indexOf(targetYear)+1]
					const yearsToNext = nextYear-targetYear

					this.setState({ inputYear: inputYear+(Math.max(yearsToNext/3, 1)*elapsed*ticksPerSec/1000) })
				}
			}


			lastTime = time;
			this.animRequest = requestAnimationFrame(playFrame)
		}

		this.animRequest = requestAnimationFrame(playFrame)
	}

	onStopPlaying() {
		cancelAnimationFrame(this.animRequest)
	}

	getInputYearFromMouse(evt: MouseEvent) {
		const { sliderBounds, minYear, maxYear, g } = this
        const mouseX = getRelativeMouse(g, evt)[0]

        var fracWidth = (mouseX-sliderBounds.x) / sliderBounds.width,
            inputYear = minYear + fracWidth*(maxYear-minYear);

        return inputYear
	}


	@bind
    onMouseDown(evt : MouseEvent) {
        // Don't do mousemove if we clicked the play or pause button
        if (d3.select(evt.target).classed('toggle')) return;

        this.setState({ 
        	isDragging: true,
        	inputYear: this.getInputYearFromMouse(evt)
        })

/*        container.on('mousemove.timeline', onMouseMove);
        container.on('mouseup.timeline', onMouseUp);
        container.on('touchmove.timeline', onMouseMove);
        container.on('touchend.timeline', onMouseUp);*/
        //container.on('mouseleave.timeline', onMouseUp);
    }

	mouseFrameQueued: boolean

	@bind
	onMouseMove(evt : MouseEvent) {
		if (!this.isDragging || this.mouseFrameQueued) return
		this.mouseFrameQueued = true
		requestAnimationFrame(() => {
			this.setState({
				inputYear: this.getInputYearFromMouse(evt)
			})
	        this.mouseFrameQueued = false
	    })
	}

    @bind onMouseUp(evt : MouseEvent) {
    	if (!this.isDragging) return
    	this.setState({ isDragging: false })
    }

  	render() {
		const { bounds, sliderBounds, targetYear, minYear, maxYear, minYearBox, maxYearBox, xScale, inputYear, years, isPlaying } = this

		const gTransform = `translate(${bounds.left}, ${bounds.top})`
		return <g class="timeline clickable" transform={gTransform} onMouseDown={this.onMouseDown} onMouseMove={this.onMouseMove} onMouseUp={this.onMouseUp} ref={g => this.g = g}>
			<rect x={0} y={0} width={bounds.width} height={bounds.height} fill="white"></rect>
			<Text class="toggle" onClick={() => this.setState({ isPlaying: !isPlaying })} x={10} y={bounds.height/2} font-family="FontAwesome" font-size="1.4em" dominant-baseline="middle">
				{isPlaying ? "\uf28c" : "\uf01d"}
			</Text>
			<Text class="minYearLabel" x={minYearBox.x} y={minYearBox.y} dominant-baseline="middle" font-size="0.8em" fill="#666">{minYear}</Text>
			<Text class="maxYearLabel" x={maxYearBox.x} y={maxYearBox.y} dominant-baseline="middle" font-size="0.8em" fill="#666" text-anchor="end">{maxYear}</Text>
			<g class="ticks">
				{_.map(years.slice(1, -1), (year) => {
					return <rect class="tick" x={xScale(year)} y={sliderBounds.top+sliderBounds.height-1} width="1px" height="0.2em" fill="rgba(0,0,0,0.2)" />
				})}
			</g>
			<rect class="sliderBackground" x={sliderBounds.left} y={sliderBounds.top} width={sliderBounds.width} height={sliderBounds.height} rx={5} ry={5} stroke-width={0.1} fill="#eee"/>			
			<g class="handle" fill="#3F9EFF" transform={`translate(${xScale(inputYear)}, ${sliderBounds.top+sliderBounds.height/2})`}>
				<circle r={8} stroke="#000" stroke-width={0.1}/>
				<text y={-9} font-size="0.7em" text-anchor="middle">
					{targetYear == minYear || targetYear == maxYear ? '' : targetYear}
				</text>
			</g>
		</g>
	}
}

/*;(function(d3) {
	"use strict";
	owid.namespace("owid.view.timeline");

	owid.view.timeline = function() {
		var timeline = owid.dataflow();

        timeline.requires('containerNode', 'outerBounds');

		timeline.defaults({
			years: [1900, 1920, 1940, 2000], // Range of years the timeline covers
			inputYear: 1980,
			isPlaying: false,
			isDragging: false
		});

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

			g.on('mousedown.timeline', onMouseDown);
            g.on('touchstart.timeline', onMouseDown);
		});

		var _anim;
		timeline.flow('playToggle, isPlaying', function(playToggle, isPlaying) {
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
})*/