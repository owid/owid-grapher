import * as React from "react"
import { uniq } from "./Util"
import { computed } from "mobx"
import { Bounds } from "./Bounds"
import { ScaleType } from "./AxisScale"
import { AxisScale } from "./AxisScale"
import { ScaleSelector } from "./ScaleSelector"
import { TextWrap } from "./TextWrap"

interface HorizontalAxisProps {
    scale: AxisScale
    labelText?: string
    fontSize: number
}

// Axis layout model. Computes the space needed for displaying an axis.
export class HorizontalAxis {
    static labelPadding = 5

    props: HorizontalAxisProps
    constructor(props: HorizontalAxisProps) {
        this.props = props
    }

    @computed get tickFontSize() {
        return 0.9 * this.props.fontSize
    }

    @computed get labelFontSize() {
        return 0.7 * this.props.fontSize
    }

    @computed get label(): TextWrap | undefined {
        const { props, width } = this
        return props.labelText
            ? new TextWrap({
                  maxWidth: width,
                  fontSize: this.labelFontSize,
                  text: props.labelText
              })
            : undefined
    }

    @computed get labelOffset(): number {
        return this.label
            ? this.label.height + HorizontalAxis.labelPadding * 2
            : 0
    }

    @computed get width() {
        return this.props.scale.rangeSize
    }

    @computed get height() {
        const { props, labelOffset } = this
        return (
            Bounds.forText(props.scale.getFormattedTicks()[0], {
                fontSize: this.tickFontSize
            }).height +
            labelOffset +
            5
        )
    }

    @computed get scale(): AxisScale {
        return this.props.scale
    }

    @computed get baseTicks(): number[] {
        const { domain } = this.scale
        let ticks = this.scale.getTickValues()
        // Make sure the start and end values are present, if they're whole numbers
        if (domain[0] % 1 === 0) ticks = [domain[0]].concat(ticks)
        if (domain[1] % 1 === 0 && this.scale.hideFractionalTicks)
            ticks = ticks.concat([domain[1]])
        return uniq(ticks)
    }

    @computed get tickPlacements() {
        const { scale, labelOffset } = this
        return this.baseTicks.map(tick => {
            const bounds = Bounds.forText(scale.tickFormat(tick), {
                fontSize: this.tickFontSize
            })
            return {
                tick: tick,
                bounds: bounds.extend({
                    x: scale.place(tick) - bounds.width / 2,
                    y: bounds.bottom - labelOffset
                }),
                isHidden: false
            }
        })
    }

    @computed get ticks(): number[] {
        const { tickPlacements } = this
        for (let i = 0; i < tickPlacements.length; i++) {
            for (let j = 1; j < tickPlacements.length; j++) {
                const t1 = tickPlacements[i],
                    t2 = tickPlacements[j]
                if (t1 === t2 || t1.isHidden || t2.isHidden) continue
                if (t1.bounds.intersects(t2.bounds.padWidth(-5))) {
                    if (i === 0) t2.isHidden = true
                    else if (j === tickPlacements.length - 1) t1.isHidden = true
                    else t2.isHidden = true
                }
            }
        }

        return tickPlacements.filter(t => !t.isHidden).map(t => t.tick)
    }
}

export class HorizontalAxisView extends React.Component<{
    bounds: Bounds
    axis: HorizontalAxis
    onScaleTypeChange?: (scale: ScaleType) => void
}> {
    render() {
        const { bounds, axis, onScaleTypeChange } = this.props
        const { scale, ticks, label, labelOffset } = axis
        const textColor = "#666"

        return (
            <g className="HorizontalAxis">
                {label &&
                    label.render(
                        bounds.centerX - label.width / 2,
                        bounds.bottom - label.height
                    )}
                {ticks.map((tick, i) => {
                    return (
                        <text
                            key={i}
                            x={scale.place(tick)}
                            y={bounds.bottom - labelOffset}
                            fill={textColor}
                            textAnchor="middle"
                            fontSize={axis.tickFontSize}
                        >
                            {scale.tickFormat(tick)}
                        </text>
                    )
                })}
                {scale.scaleTypeOptions.length > 1 && onScaleTypeChange && (
                    <ScaleSelector
                        x={bounds.right}
                        y={bounds.bottom - 5}
                        scaleType={scale.scaleType}
                        scaleTypeOptions={scale.scaleTypeOptions}
                        onChange={onScaleTypeChange}
                    />
                )}
            </g>
        )
    }
}
