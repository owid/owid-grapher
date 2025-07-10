import * as React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { ObservedReactComponent } from "@ourworldindata/components"
import * as _ from "lodash-es"
import {
    Bounds,
    dyFromAlign,
    makeIdForHumanConsumption,
    VerticalAlign,
} from "@ourworldindata/utils"
import {
    COMPARISON_LINE_STYLE,
    COMPARISON_LINE_LABEL_STYLE,
} from "./ComparisonLineConstants"
import { ComparisonLineProps } from "./ComparisonLine"
import { VerticalComparisonLineConfig } from "@ourworldindata/types"
import { isValidVerticalComparisonLineConfig } from "./ComparisonLineHelpers"

@observer
export class VerticalComparisonLine extends ObservedReactComponent<
    ComparisonLineProps<VerticalComparisonLineConfig>
> {
    @computed private get fontSize(): number {
        return this.observedProps.dualAxis.comparisonLineLabelFontSize
    }

    @computed private get labelHeight(): number {
        // Since the label isn't wrapped, its height equals the font size
        return this.fontSize
    }

    @computed private get lineConfig(): VerticalComparisonLineConfig {
        return this.observedProps.comparisonLine
    }

    @computed
    private get otherVerticalComparisonLines(): VerticalComparisonLineConfig[] {
        return this.observedProps.dualAxis.comparisonLines.filter(
            (lineConfig): lineConfig is VerticalComparisonLineConfig =>
                isValidVerticalComparisonLineConfig(lineConfig) &&
                lineConfig.xEquals !== this.props.comparisonLine.xEquals
        )
    }

    /** Nearest comparison line to the left of this line */
    @computed private get closestLeftLine():
        | VerticalComparisonLineConfig
        | undefined {
        const linesOnTheLeft = this.otherVerticalComparisonLines.filter(
            (otherLine) => otherLine.xEquals < this.lineConfig.xEquals
        )
        return _.maxBy(linesOnTheLeft, (line) => line.xEquals)
    }

    /** Nearest comparison line to the right of this line */
    @computed private get closestRightLine():
        | VerticalComparisonLineConfig
        | undefined {
        const linesOnTheRight = this.otherVerticalComparisonLines.filter(
            (otherLine) => otherLine.xEquals > this.lineConfig.xEquals
        )
        return _.minBy(linesOnTheRight, (line) => line.xEquals)
    }

    /**
     * X-coordinate of the leftmost boundary for label placement.
     *
     * Either the position of the nearest comparison line on the left
     * or the chart's bound.
     */
    @computed private get leftBoundX(): number {
        const { closestLeftLine } = this
        const { innerBounds, horizontalAxis } = this.props.dualAxis

        if (!closestLeftLine) return innerBounds.left

        return Math.max(
            horizontalAxis.place(closestLeftLine.xEquals),
            innerBounds.left
        )
    }

    /**
     * X-coordinate of the rightmost boundary for label placement.
     *
     * Either the position of the nearest comparison line on the right
     * or the chart's bound.
     */
    @computed private get rightBoundX(): number {
        const { closestRightLine } = this
        const { innerBounds, horizontalAxis } = this.props.dualAxis

        if (!closestRightLine) return innerBounds.right

        return Math.min(
            horizontalAxis.place(closestRightLine.xEquals),
            innerBounds.right
        )
    }

    /** Screen coordinates for rendering the vertical line */
    @computed private get lineCoordinates():
        | { x: number; y1: number; y2: number }
        | undefined {
        const { dualAxis } = this.props
        const { horizontalAxis, innerBounds } = dualAxis
        const xValue = this.lineConfig.xEquals
        const [minX, maxX] = horizontalAxis.domain

        // Only render if the line is within the chart bounds
        const isWithinBounds = xValue >= minX && xValue <= maxX
        if (!isWithinBounds) return undefined

        return {
            x: horizontalAxis.place(xValue),
            // The line extends outside of the chart area, so that the label
            // isn't covered by any chart elements
            y1: innerBounds.top - this.labelHeight,
            y2: innerBounds.bottom,
        }
    }

    /** Calculated position and alignment for the label text */
    @computed private get labelPosition():
        | { x: number; y: number; anchor: "start" | "end" }
        | undefined {
        const { fontSize, lineCoordinates, rightBoundX, leftBoundX } = this
        const { label } = this.lineConfig

        if (!label || !lineCoordinates) return undefined

        const { x, y1: y } = lineCoordinates

        // Calculate available space on both sides
        const padding = 4 // padding between label and line
        const availableSpaceRight = rightBoundX - x - 2 * padding
        const availableSpaceLeft = x - leftBoundX - 2 * padding

        // Determine label placement:
        // - Prefer the right side if there's enough space
        // - Otherwise, try placing the label on the left side
        // - If neither side has enough space, hide the label
        const labelWidth = Bounds.forText(label, { fontSize }).width
        const side =
            labelWidth <= availableSpaceRight
                ? "right"
                : labelWidth <= availableSpaceLeft
                  ? "left"
                  : null

        // Can't fit the label
        if (side === null) return undefined

        // Add a bit of padding between label and line and determine text anchor
        const labelX = side === "right" ? x + padding : x - padding
        const anchor = side === "right" ? "start" : "end"

        return { x: labelX, y, anchor }
    }

    private renderLabel(): React.ReactElement | null {
        if (!this.labelPosition) return null

        const { x, y, anchor } = this.labelPosition

        return (
            <text
                {...COMPARISON_LINE_LABEL_STYLE}
                x={x}
                y={y}
                fontSize={this.fontSize}
                dy={dyFromAlign(VerticalAlign.bottom)}
                textAnchor={anchor}
            >
                {this.lineConfig.label}
            </text>
        )
    }

    render(): React.ReactElement | null {
        if (!this.lineCoordinates || !this.labelPosition) return null

        const { x, y1, y2 } = this.lineCoordinates

        return (
            <g
                id={makeIdForHumanConsumption(
                    "comparison-line",
                    this.lineConfig.label
                )}
            >
                <line
                    x1={x}
                    y1={y1}
                    x2={x}
                    y2={y2}
                    style={COMPARISON_LINE_STYLE}
                />
                {this.renderLabel()}
            </g>
        )
    }
}
