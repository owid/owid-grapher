import _ from 'lodash'
import * as d3 from 'd3'
import React, {Component} from 'react'
import {observable, computed, action} from 'mobx'
import {observer} from 'mobx-react'
import Bounds from './Bounds'
import type {ScaleType} from './ScaleSelector'
import AxisScale from './AxisScale'
import Paragraph from './Paragraph'
import {preInstantiate} from './Util'

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
    static labelFontSize = 0.7

    static calculateBounds(containerBounds : Bounds, props : any) {
        const {orient, scale, label} = props

        if (orient == 'left') {
            // Vertical axis must account for tick length
            const longestTick = _.sortBy(scale.getFormattedTicks(), (tick) => -tick.length)[0]
            const labelWrap = label && preInstantiate(<Paragraph maxWidth={containerBounds.height} fontSize={Axis.labelFontSize}>label</Paragraph>)
            const axisWidth = Bounds.forText(longestTick, { fontSize: Axis.tickFontSize }).width + (label ? (labelWrap.height + Axis.labelPadding*2) : 0)
            return new Bounds(containerBounds.x, containerBounds.y, axisWidth, containerBounds.height)
        } else {
            const labelWrap = label && preInstantiate(<Paragraph maxWidth={containerBounds.width} fontSize={Axis.labelFontSize}>label</Paragraph>)
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

    @computed get label(): Paragraph {
        const {labelText} = this.props
        const {bounds, isVertical} = this

        if (!labelText) return null

        if (isVertical) {
            return preInstantiate(<Paragraph maxWidth={bounds.height} fontSize={Axis.labelFontSize}>{labelText}</Paragraph>)
        } else {
            return preInstantiate(<Paragraph maxWidth={bounds.width} fontSize={Axis.labelFontSize}>{labelText}</Paragraph>)
        }
    }

    @computed get labelOffset(): number {
        const {label} = this

        if (!label)
            return 0
        else
            return label.height + Axis.labelPadding*2
    }

    renderVertical() {
        const {bounds, orient} = this.props
        const {scale, ticks, label, labelOffset} = this
        const textColor = '#666'

        return [
            label && <Paragraph {...label.props} x={-bounds.centerY-label.width/2} y={bounds.left} transform="rotate(-90)"/>,
            _.map(ticks, tick =>
                <text x={bounds.left+labelOffset} y={scale.place(tick)} fill={textColor} dominant-baseline="middle" text-anchor="start" font-size={Axis.tickFontSize}>{scale.tickFormat(tick)}</text>
            )
        ]
    }

    renderHorizontal() {
        const {bounds, orient} = this.props
        const {scale, ticks, label, labelOffset} = this
        const textColor = '#666'

        return [
            label && <Paragraph {...label.props} x={bounds.centerX-label.width/2} y={bounds.bottom-label.height}/>,
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
