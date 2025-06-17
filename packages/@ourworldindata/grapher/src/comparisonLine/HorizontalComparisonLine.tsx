import { line as d3_line, curveLinear } from "d3-shape"
import {
    guid,
    PointVector,
    makeIdForHumanConsumption,
} from "@ourworldindata/utils"
import * as React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { DualAxis } from "../axis/Axis"
import { generateComparisonLinePoints } from "./ComparisonLineGenerator"
import { Halo } from "@ourworldindata/components"
import { Color, ComparisonLineConfig } from "@ourworldindata/types"
import {
    BASE_FONT_SIZE,
    GRAPHER_TEXT_OUTLINE_FACTOR,
} from "../core/GrapherConstants"
import { makeClipPath } from "../chart/ChartUtils"
import {
    COMPARISON_FONT_SCALE,
    COMPARISON_LINE_STYLE,
    COMPARISON_LINE_TEXT_STYLE,
} from "./ComparisonLineConstants"

@observer
export class HorizontalComparisonLine extends React.Component<{
    dualAxis: DualAxis
    comparisonLine: ComparisonLineConfig
    baseFontSize?: number
    backgroundColor?: Color
}> {
    private renderUid = guid()
    private pathId = `path-${this.renderUid}`

    @computed private get baseFontSize(): number {
        return this.props.baseFontSize ?? BASE_FONT_SIZE
    }

    @computed private get fontSize(): number {
        return COMPARISON_FONT_SCALE * this.baseFontSize
    }

    @computed private get haloOutlineWidth(): number {
        return GRAPHER_TEXT_OUTLINE_FACTOR * this.fontSize
    }

    @computed get clipPath(): { id: string; element: React.ReactElement } {
        return makeClipPath(this.renderUid, this.props.dualAxis.innerBounds)
    }

    @computed private get controlData(): [number, number][] {
        const { comparisonLine, dualAxis } = this.props
        const { horizontalAxis, verticalAxis } = dualAxis

        return generateComparisonLinePoints(
            comparisonLine.yEquals,
            horizontalAxis.domain,
            verticalAxis.domain,
            horizontalAxis.scaleType,
            verticalAxis.scaleType
        )
    }

    @computed private get linePath(): string | null {
        const { controlData } = this
        const { horizontalAxis, verticalAxis } = this.props.dualAxis
        const line = d3_line()
            .curve(curveLinear)
            .x((d) => horizontalAxis.place(d[0]))
            .y((d) => verticalAxis.place(d[1]))
        return line(controlData)
    }

    @computed private get placedLabel():
        | { x: number; y: number; angle: number; text: string }
        | undefined {
        const { label } = this.props.comparisonLine
        if (!label) return

        const { controlData } = this
        const { horizontalAxis, verticalAxis, innerBounds } =
            this.props.dualAxis

        // Find the points of the line that are actually placeable on the chart
        const linePoints = controlData
            .map(
                (d) =>
                    new PointVector(
                        horizontalAxis.place(d[0]),
                        verticalAxis.place(d[1])
                    )
            )
            .filter((p) => innerBounds.contains(p))
        if (!linePoints.length) return

        // For horizontal lines, position label in the middle of the line
        const labelPosition = linePoints[Math.floor(linePoints.length / 2)]
        const p1 = linePoints[0]
        const p2 = linePoints[linePoints.length - 1]
        const angle = (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI

        return {
            x: labelPosition.x,
            y: labelPosition.y,
            angle: angle,
            text: label,
        }
    }

    private renderLabel(): React.ReactElement | null {
        const { pathId, renderUid, placedLabel } = this

        if (!placedLabel) return null

        return (
            <text
                style={{
                    ...COMPARISON_LINE_TEXT_STYLE,
                    textAnchor: "end",
                    fontSize: this.fontSize,
                }}
                clipPath={this.clipPath.id}
            >
                <Halo
                    id={`halo-${renderUid}`}
                    outlineWidth={this.haloOutlineWidth}
                    outlineColor={this.props.backgroundColor}
                >
                    <textPath
                        baselineShift="-0.2rem"
                        href={`${pathId}`}
                        startOffset="90%"
                    >
                        {placedLabel.text}
                    </textPath>
                </Halo>
            </text>
        )
    }

    render(): React.ReactElement | null {
        if (!this.linePath) return null

        return (
            <g id={makeIdForHumanConsumption("horizontal-comparison-line")}>
                {this.clipPath.element}
                <path
                    id={this.pathId}
                    d={this.linePath}
                    clipPath={this.clipPath.id}
                    style={COMPARISON_LINE_STYLE}
                />
                {this.renderLabel()}
            </g>
        )
    }
}
