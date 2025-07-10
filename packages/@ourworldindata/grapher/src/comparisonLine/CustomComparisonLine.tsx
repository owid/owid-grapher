import * as React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { ObservedReactComponent, Halo } from "@ourworldindata/components"
import { line as d3_line, curveLinear } from "d3-shape"
import {
    guid,
    PointVector,
    makeIdForHumanConsumption,
} from "@ourworldindata/utils"
import { CustomComparisonLineConfig } from "@ourworldindata/types"
import { generateComparisonLinePoints } from "./ComparisonLineGenerator"
import { GRAPHER_TEXT_OUTLINE_FACTOR } from "../core/GrapherConstants"
import { ClipPath, makeClipPath } from "../chart/ChartUtils"
import {
    COMPARISON_LINE_STYLE,
    COMPARISON_LINE_LABEL_STYLE,
} from "./ComparisonLineConstants"
import { ComparisonLineProps } from "./ComparisonLine"

@observer
export class CustomComparisonLine extends ObservedReactComponent<
    ComparisonLineProps<CustomComparisonLineConfig>
> {
    private renderUid = guid()
    private pathId = `path-${this.renderUid}`

    @computed private get fontSize(): number {
        return this.observedProps.dualAxis.comparisonLineLabelFontSize
    }

    @computed private get haloOutlineWidth(): number {
        return GRAPHER_TEXT_OUTLINE_FACTOR * this.fontSize
    }

    @computed get clipPath(): ClipPath {
        return makeClipPath({
            name: "axisBounds",
            renderUid: this.renderUid,
            box: this.props.dualAxis.innerBounds,
        })
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
                    ...COMPARISON_LINE_LABEL_STYLE,
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
                        href={`#${pathId}`}
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
            <g
                id={makeIdForHumanConsumption(
                    "comparison-line",
                    this.props.comparisonLine.label
                )}
            >
                {this.clipPath.element}
                <path
                    style={COMPARISON_LINE_STYLE}
                    id={this.pathId}
                    d={this.linePath}
                    clipPath={this.clipPath.id}
                />
                {this.renderLabel()}
            </g>
        )
    }
}
