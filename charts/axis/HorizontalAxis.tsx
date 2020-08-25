import * as React from "react"
import { uniq, sortBy } from "../utils/Util"
import { computed } from "mobx"
import { Bounds } from "charts/utils/Bounds"
import { AxisScale, Tickmark } from "./AxisScale"
import { ScaleSelector } from "../controls/ScaleSelector"
import { TextWrap } from "charts/text/TextWrap"
import { AxisTickMarks } from "./AxisTickMarks"
import { ControlsOverlay } from "../controls/Controls"
import { ScaleType } from "charts/core/ChartConstants"

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

    @computed get baseTicks(): Tickmark[] {
        const { domain } = this.scale
        let ticks = this.scale
            .getTickValues()
            .filter(tick => !tick.gridLineOnly)

        // Make sure the start and end values are present, if they're whole numbers
        const startEndPrio = this.scale.scaleType === ScaleType.log ? 2 : 1
        if (domain[0] % 1 === 0)
            ticks = [
                {
                    value: domain[0],
                    priority: startEndPrio,
                    isFirstOrLastTick: true
                },
                ...ticks
            ]
        if (domain[1] % 1 === 0 && this.scale.hideFractionalTicks)
            ticks = [
                ...ticks,
                {
                    value: domain[1],
                    priority: startEndPrio,
                    isFirstOrLastTick: true
                }
            ]
        return uniq(ticks)
    }

    // calculates coordinates for ticks, sorted by priority
    @computed get tickPlacements() {
        const { scale, labelOffset } = this
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
                    x: scale.place(tick.value) - bounds.width / 2,
                    y: bounds.bottom - labelOffset
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
                if (t1.bounds.intersects(t2.bounds.padWidth(-5))) {
                    t2.isHidden = true
                }
            }
        }

        return sortBy(tickPlacements.filter(t => !t.isHidden).map(t => t.tick))
    }

    @computed get tickFormattingOptions() {
        return this.scale.getTickFormattingOptions()
    }
}

export class HorizontalAxisView extends React.Component<{
    bounds: Bounds
    axis: HorizontalAxis
    axisPosition: number
    showTickMarks?: boolean
    onScaleTypeChange?: (scale: ScaleType) => void
}> {
    render() {
        const {
            bounds,
            axis,
            onScaleTypeChange,
            axisPosition,
            showTickMarks
        } = this.props
        const { scale, ticks, label, labelOffset, tickFormattingOptions } = axis
        const textColor = "#666"

        const tickMarks = showTickMarks ? (
            <AxisTickMarks
                tickMarkTopPosition={axisPosition}
                tickMarkXPositions={ticks.map(tick => scale.place(tick))}
                color="#ccc"
            />
        ) : undefined

        return (
            <g className="HorizontalAxis">
                {label &&
                    label.render(
                        bounds.centerX - label.width / 2,
                        bounds.bottom - label.height
                    )}
                {tickMarks}
                {ticks.map((tick, i) => {
                    const label = scale.tickFormat(tick, {
                        ...tickFormattingOptions,
                        isFirstOrLastTick: i === 0 || i === ticks.length - 1
                    })
                    const rawXPosition = scale.place(tick)
                    // Ensure the first label does not exceed the chart viewing area
                    const xPosition =
                        i === 0
                            ? Bounds.getRightShiftForMiddleAlignedTextIfNeeded(
                                  label,
                                  axis.tickFontSize,
                                  rawXPosition
                              ) + rawXPosition
                            : rawXPosition
                    const element = (
                        <text
                            key={i}
                            x={xPosition}
                            y={bounds.bottom - labelOffset}
                            fill={textColor}
                            textAnchor="middle"
                            fontSize={axis.tickFontSize}
                        >
                            {label}
                        </text>
                    )

                    return element
                })}
                {scale.scaleTypeOptions.length > 1 && onScaleTypeChange && (
                    <ControlsOverlay
                        id="horizontal-scale-selector"
                        paddingBottom={10}
                    >
                        <ScaleSelector
                            x={bounds.right}
                            y={bounds.bottom}
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
