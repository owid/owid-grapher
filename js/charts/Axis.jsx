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

//      if (orient == 'left' || orient == 'right') {
            const longestTick = _.sortBy(_.map(scale.ticks(6), props.tickFormat), (tick) => -tick.length)[0]
            const axisWidth = Bounds.forText(longestTick).width
            if (orient == "left")
                return new Bounds(containerBounds.x, containerBounds.y, axisWidth, containerBounds.height)
            else
                return new Bounds(containerBounds.x+(containerBounds.width-axisWidth), containerBounds.y, axisWidth, containerBounds.height)
//      } else {
//          return new Bounds(containerBounds.x, containerBounds.y, 0, containerBounds.height)
//      }
    }

    props: AxisProps

    @computed get ticks() {
        return this.props.scale.getTicks()
    }

    render() {
        const {bounds, scale, orient} = this.props
        const {ticks} = this
        const textColor = '#666'

        return <g className="axis" font-size="0.8em">
            {_.map(ticks, (tick) => {
                if (orient == 'left' || orient == 'right')
                    return <text x={orient == 'left' ? bounds.left : bounds.right} y={scale.place(tick)} fill={textColor} dominant-baseline="middle" text-anchor={orient == 'left' ? 'start' : 'end'}>{scale.tickFormat(tick)}</text>
                else if (orient == 'top' || orient == 'bottom')
                    return <text x={scale.place(tick)} y={orient == 'top' ? bounds.top : bounds.bottom} fill={textColor} dominant-baseline={orient == 'top' ? 'auto' : 'hanging'} text-anchor="middle">{scale.tickFormat(tick)}</text>
            })}
        </g>        
    }
}
