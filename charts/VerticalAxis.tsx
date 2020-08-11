import { sortBy } from "./Util"
import * as React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { Bounds } from "./Bounds"
import { ScaleType, AxisScale, Tickmark } from "./AxisScale"
import { ScaleSelector } from "./ScaleSelector"
import { TextWrap } from "./TextWrap"
import { ControlsOverlay } from "./Controls"

interface VerticalAxisProps {
    scale: AxisScale
    labelText: string
    fontSize: number
}

// Axis layout model. Computes the space needed for displaying an axis.
export class VerticalAxis {
    props: VerticalAxisProps
    constructor(props: VerticalAxisProps) {
        this.props = props
    }

    @computed get tickFontSize() {
        return 0.9 * this.props.fontSize
    }

    @computed get label(): TextWrap | undefined {
        const { props, height } = this
        return props.labelText
            ? new TextWrap({
                  maxWidth: height,
                  fontSize: 0.7 * props.fontSize,
                  text: props.labelText
              })
            : undefined
    }

    @computed get labelOffset(): number {
        return this.label ? this.label.height + 10 : 0
    }

    @computed get width() {
        const { props, labelOffset } = this
        const longestTick = sortBy(
            props.scale.getFormattedTicks(),
            tick => -tick.length
        )[0]
        return (
            Bounds.forText(longestTick, { fontSize: this.tickFontSize }).width +
            labelOffset +
            5
        )
    }

    @computed get height() {
        return this.props.scale.rangeSize
    }

    @computed get scale(): AxisScale {
        return this.props.scale
    }

    @computed get baseTicks(): Tickmark[] {
        return this.scale.getTickValues().filter(tick => !tick.gridLineOnly)
    }

    // calculates coordinates for ticks, sorted by priority
    @computed get tickPlacements() {
        const { scale } = this
        return sortBy(this.baseTicks, tick => tick.priority).map(tick => {
            const bounds = Bounds.forText(
                scale.tickFormat(tick.value, {
                    ...this.tickFormattingOptions,
                    isFirstOrLastTick: !!tick.isFirstOrLastTick
                }),
                {
                    fontSize: this.tickFontSize
                }
            )
            return {
                tick: tick.value,
                bounds: bounds.extend({
                    y: scale.place(tick.value),
                    // x placement doesn't really matter here, so we're using
                    // 1 for simplicity
                    x: 1
                }),
                isHidden: false
            }
        })
    }

    @computed get ticks(): number[] {
        const { tickPlacements } = this
        for (let i = 0; i < tickPlacements.length; i++) {
            for (let j = i + 1; j < tickPlacements.length; j++) {
                const t1 = tickPlacements[i],
                    t2 = tickPlacements[j]
                if (t1 === t2 || t1.isHidden || t2.isHidden) continue
                if (t1.bounds.intersects(t2.bounds)) {
                    t2.isHidden = true
                }
            }
        }

        return sortBy(
            tickPlacements.filter(t => !t.isHidden).map(t => t.tick),
            t => t
        )
    }

    @computed get tickFormattingOptions() {
        return this.scale.getTickFormattingOptions()
    }
}

@observer
export class VerticalAxisView extends React.Component<{
    bounds: Bounds
    axis: VerticalAxis
    onScaleTypeChange?: (scale: ScaleType) => void
}> {
    render() {
        const { bounds, axis, onScaleTypeChange } = this.props
        const { scale, ticks, label, tickFormattingOptions } = axis
        const textColor = "#666"

        return (
            <g className="VerticalAxis">
                {label &&
                    label.render(
                        -bounds.centerY - label.width / 2,
                        bounds.left,
                        { transform: "rotate(-90)" }
                    )}
                {ticks.map((tick, i) => (
                    <text
                        key={i}
                        x={(bounds.left + axis.width - 5).toFixed(2)}
                        y={scale.place(tick)}
                        fill={textColor}
                        dominantBaseline="middle"
                        textAnchor="end"
                        fontSize={axis.tickFontSize}
                    >
                        {scale.tickFormat(tick, tickFormattingOptions)}
                    </text>
                ))}
                {scale.scaleTypeOptions.length > 1 && onScaleTypeChange && (
                    <ControlsOverlay
                        id="vertical-scale-selector"
                        paddingTop={18}
                    >
                        <ScaleSelector
                            x={bounds.left}
                            y={bounds.top - 34}
                            scaleType={scale.scaleType}
                            scaleTypeOptions={scale.scaleTypeOptions}
                            onChange={onScaleTypeChange}
                        />
                    </ControlsOverlay>
                )}
            </g>
        )
    }
}
