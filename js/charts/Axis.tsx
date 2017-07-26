import * as _ from 'lodash'
import * as d3 from 'd3'
import * as React from 'react'
import {observable, computed, action} from 'mobx'
import {observer} from 'mobx-react'
import Bounds from './Bounds'
import {ScaleType} from './AxisScale'
import AxisScale from './AxisScale'
import Paragraph from './Paragraph'
import {preInstantiate} from './Util'
import ScaleSelector from './ScaleSelector'

interface VerticalAxisProps {
    scale: AxisScale,
    labelText: string
}

// Axis layout model. Computes the space needed for displaying an axis.
export class VerticalAxis {
    static labelPadding = 5
    static tickFontSize = "0.7em"
    static labelFontSize = 0.5

    @computed get width() {
        const {scale, labelText} = this.props
        const longestTick = _.sortBy(scale.getFormattedTicks(), (tick) => -tick.length)[0]
        const labelWrap = labelText && preInstantiate(<Paragraph maxWidth={this.height} fontSize={VerticalAxis.labelFontSize}>label</Paragraph>)
        return Bounds.forText(longestTick, { fontSize: VerticalAxis.tickFontSize }).width + (labelText ? (labelWrap.height + VerticalAxis.labelPadding*2) : 0)+5
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

    @computed get label(): Paragraph|undefined {
        const {labelText} = this.props

        if (!labelText) return undefined

        return preInstantiate(<Paragraph maxWidth={this.height} fontSize={VerticalAxis.labelFontSize}>{labelText}</Paragraph>)
    }

    @computed get labelOffset(): number {
        const {label} = this

        if (!label)
            return 0
        else
            return label.height + VerticalAxis.labelPadding*2
    }
}

interface HorizontalAxisProps {
    scale: AxisScale,
    labelText: string
}

// Axis layout model. Computes the space needed for displaying an axis.
export class HorizontalAxis {
    static labelPadding = 5
    static tickFontSize = "0.7em"
    static labelFontSize = 0.5

    props: HorizontalAxisProps
    constructor(props: HorizontalAxisProps) {
        this.props = props
    }

    @computed get width() {
        return this.props.scale.rangeSize
    }

    @computed get height() {
        const {scale, labelText} = this.props
        const labelWrap = labelText && preInstantiate(<Paragraph maxWidth={this.width} fontSize={HorizontalAxis.labelFontSize}>label</Paragraph>)
        return Bounds.forText(scale.getFormattedTicks()[0], { fontSize: HorizontalAxis.tickFontSize }).height + (labelText ? (labelWrap.height + HorizontalAxis.labelPadding*2) : 0)+5
    }

    @computed get scale() : AxisScale {
        return this.props.scale
    }

    @computed get baseTicks(): number [] {
        return this.scale.getTickValues()
    }

    @computed get tickPlacements() {
        const {scale, labelOffset} = this
        return this.baseTicks.map(tick => {
            const bounds = Bounds.forText(scale.tickFormat(tick), { fontSize: HorizontalAxis.tickFontSize })
            return {
                tick: tick,
                bounds: bounds.extend({ x: scale.place(tick)-bounds.width/2, y: bounds.bottom-labelOffset }),
                isHidden: false
            }
        })
    }

    // Detect if some ticks are overlapping one another
    @computed get hasTickCollision() {
        return _.some(this.tickPlacements, t1 => _.some(this.tickPlacements, t2 => t1.bounds.intersects(t2.bounds)))
    }

    @computed get ticks() : number[] {
        const {scale, labelOffset} = this
        const ticks = scale.getTickValues()

        if (scale.isDiscrete) return ticks

        const {tickPlacements} = this
        for (let i = 0; i < tickPlacements.length; i++) {
            for (let j = 1; j < tickPlacements.length; j++) {
                const t1 = tickPlacements[i], t2 = tickPlacements[j]
                if (t1 == t2 || t1.isHidden || t2.isHidden) continue
                if (t1.bounds.intersects(t2.bounds)) {
                    if (i == 0) t2.isHidden = true
                    else if (j == tickPlacements.length-1) t1.isHidden = true
                    else t2.isHidden = true
                }
            }
        }

        return tickPlacements.filter(t => !t.isHidden).map(t => t.tick)
    }

    @computed get label(): Paragraph|undefined {
        const {labelText} = this.props

        if (!labelText) return undefined

        return preInstantiate(<Paragraph maxWidth={this.width} fontSize={HorizontalAxis.labelFontSize}>{labelText}</Paragraph>)
    }

    @computed get labelOffset(): number {
        const {label} = this

        if (!label)
            return 0
        else
            return label.height + HorizontalAxis.labelPadding*2
    }
}

export class VerticalAxisView extends React.Component<{ bounds: Bounds, axis: VerticalAxis, onScaleTypeChange?: (scale: ScaleType) => void }, undefined> {
    render() {
        const {bounds, axis, onScaleTypeChange} = this.props
        const {scale, ticks, label, labelOffset} = axis
        const textColor = '#666'

        return <g className="VerticalAxis">
            {label && <Paragraph {...label.props} x={-bounds.centerY-label.width/2} y={bounds.left} transform="rotate(-90)"/>}
            {_.map(ticks, tick =>
                <text x={bounds.left+axis.width-5} y={scale.place(tick)} fill={textColor} dominant-baseline="middle" textAnchor="end" font-size={VerticalAxis.tickFontSize}>{scale.tickFormat(tick)}</text>
            )}
            {scale.scaleTypeOptions.length > 1 && onScaleTypeChange &&
                <ScaleSelector x={bounds.left} y={bounds.top-8} scaleType={scale.scaleType} scaleTypeOptions={scale.scaleTypeOptions} onChange={onScaleTypeChange}/>}
        </g>
    }
}

export class HorizontalAxisView extends React.Component<{ bounds: Bounds, axis: HorizontalAxis, onScaleTypeChange?: (scale: ScaleType) => void }, undefined> {
    render() {
        const {bounds, axis, onScaleTypeChange} = this.props
        const {scale, ticks, label, labelOffset} = axis
        const textColor = '#666'

        return <g className="HorizontalAxis">
            {label && <Paragraph {...label.props} x={bounds.centerX-label.width/2} y={bounds.bottom-label.height}/>}
            {_.map(ticks, tick => {
                return <text x={scale.place(tick)} y={bounds.bottom-labelOffset} fill={textColor} textAnchor="middle" fontSize={HorizontalAxis.tickFontSize}>{scale.tickFormat(tick)}</text>
            })}
            {scale.scaleTypeOptions.length > 1 && onScaleTypeChange && 
                <ScaleSelector x={bounds.right} y={bounds.bottom-5} scaleType={scale.scaleType} scaleTypeOptions={scale.scaleTypeOptions} onChange={onScaleTypeChange}/>}
        </g>
    }
}