import _ from 'lodash'
import * as d3 from 'd3'
import React, {Component} from 'react'
import {observable, computed, action} from 'mobx'
import {observer} from 'mobx-react'
import Bounds from './Bounds'
import type {ScaleType} from './ScaleSelector'
import AxisScale from './AxisScale'

// @flow

type AxisProps = {
    bounds: Bounds,
    orient: 'left' | 'right' | 'bottom',
    scale: AxisScale
};

@observer
export default class Axis extends Component {
    static calculateBounds(containerBounds : Bounds, props : any) {
        const {orient, scale} = props

        if (orient == 'left' || orient == 'right') {
            // Vertical axis must account for tick length
            const longestTick = _.sortBy(scale.getFormattedTicks(), (tick) => -tick.length)[0]
            const axisWidth = Bounds.forText(longestTick).width
            if (orient == "left")
                return new Bounds(containerBounds.x, containerBounds.y, axisWidth, containerBounds.height)
            else
                return new Bounds(containerBounds.x+(containerBounds.width-axisWidth), containerBounds.y, axisWidth, containerBounds.height)
        } else {
            const axisHeight = Bounds.forText(scale.getFormattedTicks()[0]).height
            if (orient == "top")
                return new Bounds(containerBounds.x, containerBounds.y, containerBounds.width, axisHeight)
            else
                return new Bounds(containerBounds.x, containerBounds.y+(containerBounds.height-axisHeight), containerBounds.width, axisHeight)
        }
    }

    props: AxisProps

    @computed get isVertical() : boolean {
        return this.props.orient == 'left' || this.props.orient == 'right'
    }

    @computed get bounds() : Bounds {
        return this.props.bounds
    }

    @computed get scale() : AxisScale {
        const {bounds, isVertical} = this
        return this.props.scale.extend({ range: isVertical ? bounds.yRange() : bounds.xRange() })
    }

    @computed get ticks() : number[] {
        return this.scale.getTickValues()
    }

    render() {
        const {bounds, orient} = this.props
        const {scale, ticks} = this
        const textColor = '#666'

        return <g className="axis" font-size="0.8em">
            {_.map(ticks, (tick) => {
                if (orient == 'left' || orient == 'right')
                    return <text x={orient == 'left' ? bounds.left : bounds.right} y={scale.place(tick)} fill={textColor} dominant-baseline="middle" text-anchor={orient == 'left' ? 'start' : 'end'}>{scale.tickFormat(tick)}</text>
                else if (orient == 'top' || orient == 'bottom')
                    return <text x={scale.place(tick)} y={orient == 'top' ? bounds.top : bounds.bottom} fill={textColor} dominant-baseline={'auto'} text-anchor="middle">{scale.tickFormat(tick)}</text>
            })}
        </g>        
    }
}
