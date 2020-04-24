import { sortBy } from "./Util"
import * as React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { Bounds } from "./Bounds"
import { ScaleType, AxisScale } from "./AxisScale"
import { ScaleSelector } from "./ScaleSelector"
import { TextWrap } from "./TextWrap"

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

    @computed get ticks(): number[] {
        return this.scale.getTickValues()
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
        const { scale, ticks, label } = axis
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
                        {scale.tickFormat(tick)}
                    </text>
                ))}
                {scale.scaleTypeOptions.length > 1 && onScaleTypeChange && (
                    <ScaleSelector
                        x={bounds.left}
                        y={bounds.top - 8}
                        scaleType={scale.scaleType}
                        scaleTypeOptions={scale.scaleTypeOptions}
                        onChange={onScaleTypeChange}
                    />
                )}
            </g>
        )
    }
}
