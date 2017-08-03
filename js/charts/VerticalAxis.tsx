import * as _ from 'lodash'
import * as d3 from 'd3'
import * as React from 'react'
import {observable, computed, action} from 'mobx'
import {observer} from 'mobx-react'
import Bounds from './Bounds'
import {ScaleType} from './AxisScale'
import AxisScale from './AxisScale'
import {preInstantiate} from './Util'
import ScaleSelector from './ScaleSelector'
import TextWrap from './TextWrap'

interface VerticalAxisProps {
    scale: AxisScale,
    labelText: string
}

// Axis layout model. Computes the space needed for displaying an axis.
export default class VerticalAxis {
    @computed get label(): TextWrap|undefined {
        const {props, height} = this
        return props.labelText ? new TextWrap({ maxWidth: height, fontSize: 0.5, text: props.labelText}) : undefined
    }

    @computed get labelOffset(): number {
        return this.label ? this.label.height + 10 : 0
    }

    @computed get width() {
        const {props, labelOffset} = this
        const longestTick = _.sortBy(props.scale.getFormattedTicks(), (tick) => -tick.length)[0]
        return Bounds.forText(longestTick, { fontSize: "0.7em" }).width + labelOffset + 5
    }

    @computed get height() {
        return this.props.scale.rangeSize
    }

    props: VerticalAxisProps
    constructor(props: VerticalAxisProps) {
        this.props = props
    }

    @computed get scale() : AxisScale {
        return this.props.scale
    }

    @computed get ticks() : number[] {
        return this.scale.getTickValues()
    }
}

export class VerticalAxisView extends React.Component<{ bounds: Bounds, axis: VerticalAxis, onScaleTypeChange?: (scale: ScaleType) => void }> {
    render() {
        const {bounds, axis, onScaleTypeChange, highlightValue} = this.props
        const {scale, ticks, label, labelOffset} = axis
        const textColor = '#666'

        return <g className="VerticalAxis">
            {label && label.render(-bounds.centerY-label.width/2, bounds.left, { transform: "rotate(-90)" })}
            {_.map(ticks, tick =>
                <text x={bounds.left+axis.width-5} y={scale.place(tick)} fill={textColor} dominant-baseline="middle" textAnchor="end" fontSize={0.7+'em'}>{scale.tickFormat(tick)}</text>
            )}
            {scale.scaleTypeOptions.length > 1 && onScaleTypeChange &&
                <ScaleSelector x={bounds.left} y={bounds.top-8} scaleType={scale.scaleType} scaleTypeOptions={scale.scaleTypeOptions} onChange={onScaleTypeChange}/>}
        </g>
    }
}