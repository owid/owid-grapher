import * as React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { dyFromAlign, makeFigmaId, VerticalAlign } from "@ourworldindata/utils"
import {
    COMPARISON_LINE_STYLE,
    COMPARISON_LINE_LABEL_STYLE,
} from "./ComparisonLineConstants"
import { ComparisonLineProps } from "./ComparisonLine"
import {
    VerticalComparisonLineConfig,
    VerticalComparisonLineLabelPlacement,
} from "@ourworldindata/types"
import { ComparisonLines } from "./ComparisonLines"

@observer
export class VerticalComparisonLine extends React.Component<
    ComparisonLineProps<VerticalComparisonLineConfig>
> {
    constructor(props: ComparisonLineProps<VerticalComparisonLineConfig>) {
        super(props)
        makeObservable(this)
    }

    @computed private get comparisonLines(): ComparisonLines {
        return this.props.dualAxis.comparisonLines
    }

    @computed private get fontSize(): number {
        return this.comparisonLines.fontSize
    }

    @computed private get placement():
        | VerticalComparisonLineLabelPlacement
        | undefined {
        return this.comparisonLines.verticalLineLabelPlacements.get(
            this.lineConfig.xEquals
        )
    }

    @computed private get labelHeight(): number {
        // Since the label isn't wrapped, its height equals the font size
        return this.fontSize
    }

    @computed private get lineConfig(): VerticalComparisonLineConfig {
        return this.props.comparisonLine
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
        const { lineCoordinates, placement } = this

        if (!lineCoordinates || !placement) return undefined

        return {
            x: placement.x,
            y: lineCoordinates.y1,
            anchor: placement.anchor,
        }
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

    override render(): React.ReactElement | null {
        if (!this.lineCoordinates) return null

        const { x, y1, y2 } = this.lineCoordinates

        return (
            <g id={makeFigmaId("comparison-line", this.lineConfig.label)}>
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
