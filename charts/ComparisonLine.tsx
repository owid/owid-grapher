import { scaleLinear } from "d3-scale"
import { curveLinear, line as d3_line } from "d3-shape"
import { computed } from "mobx"
import { observer } from "mobx-react"
import * as React from "react"

import { AxisBox } from "./AxisBox"
import { Bounds } from "./Bounds"
import { evalEquation } from "./evalEquation"
import { defaultTo, guid } from "./Util"
import { Vector2 } from "./Vector2"

export interface ComparisonLineConfig {
    label?: string
    yEquals?: string
}

@observer
export class ComparisonLine extends React.Component<{
    axisBox: AxisBox
    comparisonLine: ComparisonLineConfig
}> {
    @computed get controlData(): [number, number][] {
        const { comparisonLine, axisBox } = this.props
        const { xScale, yScale } = axisBox

        const yEquals = defaultTo(comparisonLine.yEquals, "x")
        const yFunc = (x: number) =>
            evalEquation(yEquals, { x: x, e: Math.E, pi: Math.PI }, x)

        // Construct control data by running the equation across sample points
        const numPoints = 100
        const scale = scaleLinear()
            .domain([0, 100])
            .range(xScale.domain)
        const controlData: Array<[number, number]> = []
        for (let i = 0; i < numPoints; i++) {
            const x = scale(i)
            const y = yFunc(x)

            if (xScale.scaleType === "log" && x <= 0) continue
            if (yScale.scaleType === "log" && y <= 0) continue
            controlData.push([x, y])
        }

        return controlData
    }

    @computed get linePath(): string | null {
        const { controlData } = this
        const { xScale, yScale } = this.props.axisBox
        const line = d3_line()
            .curve(curveLinear)
            .x(d => xScale.place(d[0]))
            .y(d => yScale.place(d[1]))
        return line(controlData)
    }

    @computed get placedLabel():
        | { x: number; y: number; bounds: Bounds; angle: number; text: string }
        | undefined {
        const { label } = this.props.comparisonLine
        if (!label) return

        const { controlData } = this
        const { xScale, yScale, innerBounds } = this.props.axisBox

        // Find the points of the line that are actually placeable on the chart
        const linePoints = controlData
            .map(d => new Vector2(xScale.place(d[0]), yScale.place(d[1])))
            .filter(p => innerBounds.contains(p))
        if (!linePoints.length) return

        const midPoint = linePoints[Math.floor(linePoints.length / 2)]
        const p1 = linePoints[0]
        const p2 = linePoints[linePoints.length - 1]
        const angle = (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI
        const bounds = Bounds.forText(label)
        return {
            x: midPoint.x,
            y: midPoint.y,
            bounds: bounds,
            angle: angle,
            text: label
        }
    }

    renderUid!: number
    componentWillMount() {
        this.renderUid = guid()
    }

    render() {
        const { innerBounds } = this.props.axisBox
        const { linePath, renderUid, placedLabel } = this

        return (
            <g className="ComparisonLine">
                <defs>
                    <clipPath id={`axisBounds-${renderUid}`}>
                        <rect
                            x={innerBounds.x}
                            y={innerBounds.y}
                            width={innerBounds.width}
                            height={innerBounds.height}
                        />
                    </clipPath>
                </defs>
                <path
                    d={linePath || undefined}
                    clipPath={`url(#axisBounds-${renderUid})`}
                    fill="none"
                    stroke="#ccc"
                />
                {placedLabel && (
                    <text
                        x={placedLabel.x - placedLabel.bounds.width / 2}
                        y={placedLabel.y - 3}
                        fill="#999"
                        transform={`rotate(${placedLabel.angle},${
                            placedLabel.x
                        },${placedLabel.y - 3})`}
                        clipPath={`url(#axisBounds-${renderUid})`}
                    >
                        {placedLabel.text}
                    </text>
                )}
            </g>
        )
    }
}
