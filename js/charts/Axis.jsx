import _ from 'lodash'
import * as d3 from 'd3'
import React, {Component} from 'react'
import {observable, computed, action} from 'mobx'
import {observer} from 'mobx-react'
import Bounds from './Bounds'
import type {ScaleType} from './ScaleSelector'
import AxisScale from './AxisScale'
import Paragraph from './Paragraph'

// @flow

type AxisProps = {
    bounds: Bounds,
    orient: 'left' | 'right' | 'bottom',
    scale: AxisScale
};

@observer
export default class Axis extends Component {
    static labelPadding = 5
    static tickFontSize = "0.7em"
    static labelFontSize = "0.7em"

    static calculateBounds(containerBounds : Bounds, props : any) {
        const {orient, scale, label} = props

        if (orient == 'left') {
            // Vertical axis must account for tick length
            const longestTick = _.sortBy(scale.getFormattedTicks(), (tick) => -tick.length)[0]
            const labelWrap = label && Paragraph.wrap(label, containerBounds.height, { fontSize: Axis.labelFontSize })
            const axisWidth = Bounds.forText(longestTick, { fontSize: Axis.tickFontSize }).width + (label ? (labelWrap.height + Axis.labelPadding*2) : 0)
            return new Bounds(containerBounds.x, containerBounds.y, axisWidth, containerBounds.height)
        } else {
            const labelWrap = label && Paragraph.wrap(label, containerBounds.width, { fontSize: Axis.labelFontSize })
            const axisHeight = Bounds.forText(scale.getFormattedTicks()[0], { fontSize: Axis.tickFontSize }).height + (label ? (labelWrap.height + Axis.labelPadding*2) : 0)
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

    renderVertical() {
        const {bounds, orient, label} = this.props
        const {scale, ticks} = this
        const textColor = '#666'

        const wrapLabel = label && Paragraph.wrap(label, bounds.height, { fontSize: Axis.labelFontSize })
        const labelOffset = label ? (wrapLabel.height+Axis.labelPadding*2) : 0

        return [
            label && <Paragraph x={-bounds.centerY} y={bounds.left+wrapLabel.lines[0].height} text-anchor="middle" transform="rotate(-90)">{wrapLabel}</Paragraph>,
            _.map(ticks, tick =>
                <text x={bounds.left+labelOffset} y={scale.place(tick)} fill={textColor} dominant-baseline="middle" text-anchor="start" font-size={Axis.tickFontSize}>{scale.tickFormat(tick)}</text>
            )
        ]
    }

    renderHorizontal() {
        const {bounds, orient, label} = this.props
        const {scale, ticks} = this
        const textColor = '#666'

        const wrapLabel = label && Paragraph.wrap(label, bounds.width, { fontSize: Axis.labelFontSize })
        const labelOffset = label ? (wrapLabel.height+Axis.labelPadding*2) : 0

        return [
            label && <Paragraph x={bounds.centerX} y={bounds.bottom-wrapLabel.height} text-anchor="middle" dominant-baseline="hanging">{wrapLabel}</Paragraph>,
            _.map(ticks, tick =>
                <text x={scale.place(tick)} y={bounds.bottom-labelOffset} fill={textColor} dominant-baseline={'auto'} text-anchor="middle" font-size={Axis.tickFontSize}>{scale.tickFormat(tick)}</text>
            )
        ]
    }

    render() {
        const {bounds, orient, label} = this.props
        const {scale, ticks, isVertical} = this

        return <g className="axis">
            {isVertical ? this.renderVertical() : this.renderHorizontal() }
        </g>
    }
}
