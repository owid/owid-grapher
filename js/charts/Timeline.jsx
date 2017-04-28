// @flow

import * as _ from 'underscore'
import * as d3 from 'd3'
import owid from '../owid'
import Bounds from './Bounds'
import Text from './Text'
import type { SVGElement } from './Util'
import { getRelativeMouse } from './Util'
import React, {Component} from 'react'
import { observable, computed, asFlat, autorun, autorunAsync, action } from 'mobx'
import {observer} from 'mobx-react'
import { bind } from 'decko'

type TimelineProps = {
	years: number[],
	inputYear: number,
	onTimeChange: (number, number) => void,
	bounds: Bounds
};

@observer
export default class Timeline extends Component {
	props: TimelineProps

	@observable inputYear : number = 0
	@observable isPlaying : boolean = false
	@observable isDragging : boolean = false

	g: SVGElement

	constructor(props : TimelineProps) {
		super(props)
		this.inputYear = props.inputYear

		autorun(() => {
			const { isPlaying } = this

			if (isPlaying)
				this.onStartPlaying()
			else
				this.onStopPlaying()
		})

		autorunAsync(() => {
			if (this.props.onTargetChange)
                this.props.onTargetChange(this.targetYear)
		})
	}

	@computed get years(): number[] { return this.props.years }
	@computed get bounds(): Bounds { return this.props.bounds }
	@computed get minYear() : number { return _.first(this.props.years) }
	@computed get maxYear() : number { return _.last(this.props.years) }

	@computed get activeYear() : number {
		let { inputYear, isPlaying, isDragging } = this
		const { years, minYear, maxYear } = this
		inputYear = Math.max(Math.min(inputYear, maxYear), minYear);

		// If we're not playing or dragging, lock the input to the closest year (no interpolation)
		if (!isPlaying && !isDragging)
			return _.sortBy(years, function(year) { return Math.abs(year-inputYear); })[0];
		else
			return inputYear;
	}

	@computed get targetYear() : number {
		const { years, activeYear } = this

		return _.find(
			_.sortBy(years, function(year) { return Math.abs(year-activeYear); }),
			function(year) { return year <= activeYear; }
		);
	}

	@computed get minYearBox() : Bounds {
		const { minYear, bounds } = this
		const minYearBox = Bounds.forText(minYear.toString(), { fontSize: "0.8em" })
        return minYearBox.extend({ x: bounds.left+45, y: bounds.centerY-minYearBox.height/2 })
	}

	@computed get maxYearBox() : Bounds {
		const { minYear, bounds } = this
        const maxYearBox = Bounds.forText(minYear.toString(), { fontSize: "0.8em" })
		return maxYearBox.extend({ x: bounds.right-maxYearBox.width, y: bounds.centerY-maxYearBox.height/2 })
	}

	@computed get sliderBounds() : Bounds {
		const { bounds, minYearBox, maxYearBox } = this
		const sliderHeight = 12
		const left = minYearBox.left + minYearBox.width + 15
		return new Bounds(left, bounds.top + (bounds.height-sliderHeight)/2, bounds.width-maxYearBox.width-(left-bounds.left)-15, sliderHeight)
	}

	@computed get xScale() : any {
		const { years, sliderBounds } = this
		return d3.scaleLinear().domain(d3.extent(years)).range([sliderBounds.left, sliderBounds.right]);
	}

	@action componentWillReceiveProps(nextProps : TimelineProps) {
		const { isPlaying, isDragging } = this
		if (!isPlaying && !isDragging)
			this.inputYear = nextProps.inputYear
	}

	animRequest: number;

	@action onStartPlaying() {
		let lastTime = null, ticksPerSec = 5;

		const playFrame = (time : number) => {
			const { isPlaying, activeYear, targetYear, years, minYear, maxYear } = this
			if (!isPlaying) return;

			if (lastTime === null) {
				// If we start playing from the end, loop around to beginning
				if (targetYear >= maxYear)
					this.inputYear = minYear
			} else {
				const elapsed = time-lastTime;

				if (activeYear >= maxYear) {
					this.isPlaying = false
				} else {
					const nextYear = years[years.indexOf(targetYear)+1]
					const yearsToNext = nextYear-targetYear

					this.inputYear = activeYear+(Math.max(yearsToNext/3, 1)*elapsed*ticksPerSec/1000)
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


    @action.bound onMouseDown(evt : MouseEvent) {
        // Don't do mousemove if we clicked the play or pause button
        if (d3.select(evt.target).classed('toggle')) return;

        this.isDragging = true
        this.inputYear = this.getInputYearFromMouse(evt)
        evt.preventDefault()

/*        container.on('mousemove.timeline', onMouseMove);
        container.on('mouseup.timeline', onMouseUp);
        container.on('touchmove.timeline', onMouseMove);
        container.on('touchend.timeline', onMouseUp);*/
        //container.on('mouseleave.timeline', onMouseUp);
    }

	mouseFrameQueued: boolean

	@action.bound onMouseMove() {
		if (!this.isDragging || this.mouseFrameQueued) return
		const evt = d3.event

		this.mouseFrameQueued = true
		requestAnimationFrame(() => {
			this.inputYear = this.getInputYearFromMouse(evt)
	        this.mouseFrameQueued = false
	    })
	}

    @action.bound onMouseUp(evt : MouseEvent) {
    	this.isDragging = false
    }

    @computed get height() { return 45 }

    // Allow proper dragging behavior even if mouse leaves timeline area
    componentDidMount() {
    	d3.select('html').on('mouseup.timeline', this.onMouseUp)
    	d3.select('html').on('mousemove.timeline', this.onMouseMove)
    	d3.select('html').on('touchend.timeline', this.onMouseUp)
    	d3.select('html').on('touchmove.timeline', this.onMouseMove)
    }

    componentWillUnmount() {
    	d3.select('html').on('mouseup.timeline', null)
    	d3.select('html').on('mousemove.timeline', null)
    	d3.select('html').on('touchend.timeline', null)
    	d3.select('html').on('touchmove.timeline', null)
    }

  	render() {
		const { bounds, sliderBounds, targetYear, minYear, maxYear, minYearBox, maxYearBox, xScale, activeYear, years, isPlaying, height } = this

        const toggleText = isPlaying ? "\uf28c" : "\uf01d"
        const toggleTextBounds = Bounds.forText(toggleText, { fontSize: "1.4em" })

		return <g class="timeline clickable" onMouseDown={this.onMouseDown} ref={g => this.g = g}>
			<rect x={bounds.left} y={bounds.top} width={bounds.width} height={bounds.height} fill="white"></rect>
			<Text class="toggle" onClick={() => this.isPlaying = !this.isPlaying} x={bounds.left+10} y={bounds.centerY-toggleTextBounds.height/2} font-family="FontAwesome" font-size="1.4em">{toggleText}
			</Text>
			<Text class="minYearLabel" x={minYearBox.x} y={minYearBox.y} font-size="0.8em" fill="#666">{minYear}</Text>
			<Text class="maxYearLabel" x={maxYearBox.x} y={maxYearBox.y} font-size="0.8em" fill="#666">{maxYear}</Text>
			<g class="ticks">
				{_.map(years.slice(1, -1), (year) => {
					return <rect class="tick" x={xScale(year)} y={sliderBounds.top+sliderBounds.height-1} width="1px" height="0.2em" fill="rgba(0,0,0,0.2)" />
				})}
			</g>
			<rect class="sliderBackground" x={sliderBounds.left} y={sliderBounds.top} width={sliderBounds.width} height={sliderBounds.height} rx={5} ry={5} stroke-width={0.1} fill="#eee"/>
			<g class="handle" fill="#3F9EFF" transform={`translate(${xScale(activeYear)}, ${sliderBounds.centerY})`}>
				<circle r={8} stroke="#000" stroke-width={0.1}/>
				<text y={-9} font-size="0.7em" text-anchor="middle">
					{targetYear == minYear || targetYear == maxYear ? '' : targetYear}
				</text>
			</g>
		</g>
	}
}
