import { guid, makeIdForHumanConsumption } from "@ourworldindata/utils"
import * as React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { DualAxis } from "../axis/Axis"
import { Color, ComparisonLineConfig } from "@ourworldindata/types"
import {
    BASE_FONT_SIZE,
    GRAPHER_TEXT_OUTLINE_FACTOR,
} from "../core/GrapherConstants"
import { Halo, TextWrap } from "@ourworldindata/components"
import { makeClipPath } from "../chart/ChartUtils"
import {
    COMPARISON_FONT_SCALE,
    COMPARISON_LINE_STYLE,
    COMPARISON_LINE_TEXT_STYLE,
} from "./ComparisonLineConstants"

@observer
export class VerticalComparisonLine extends React.Component<{
    dualAxis: DualAxis
    comparisonLine: ComparisonLineConfig
    baseFontSize?: number
    backgroundColor?: Color
}> {
    private renderUid = guid()

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

    @computed private get lineCoordinates():
        | {
              x: number
              y1: number
              y2: number
          }
        | undefined {
        const { comparisonLine, dualAxis } = this.props
        const { horizontalAxis, innerBounds } = dualAxis

        const xValue = comparisonLine.xEquals!
        const x = horizontalAxis.place(xValue)

        // Only render if the line is within the chart bounds
        if (x < innerBounds.left || x > innerBounds.right) return

        return {
            x,
            y1: innerBounds.top,
            y2: innerBounds.bottom,
        }
    }

    @computed private get placedLabel():
        | { x: number; y: number; textWrap: TextWrap; side: "left" | "right" }
        | undefined {
        const { fontSize } = this
        const { label: labelText } = this.props.comparisonLine
        if (!labelText || !this.lineCoordinates) return

        const { innerBounds } = this.props.dualAxis
        const { x } = this.lineCoordinates

        const availableWidthRight = innerBounds.right - x
        const availableWidthLeft = x - innerBounds.left

        // Prefer rendering the label to the right of the line, but render it
        // to the left if there is little space on the right
        const showLabelOnTheRight = availableWidthRight >= 60
        const side = showLabelOnTheRight ? "right" : "left"
        const availableWidth = showLabelOnTheRight
            ? availableWidthRight
            : availableWidthLeft

        const textWrap = new TextWrap({
            text: labelText,
            maxWidth: availableWidth,
            fontSize,
        })

        return { x, y: innerBounds.top, textWrap, side }
    }

    private renderLabel(): React.ReactElement | null {
        const { placedLabel, renderUid } = this

        if (!placedLabel) return null

        const { x, y, side, textWrap } = placedLabel

        const padding = side === "right" ? 4 : -4
        const textAnchor = side === "right" ? "start" : "end"

        return (
            <Halo
                id={`halo-${renderUid}`}
                outlineWidth={this.haloOutlineWidth}
                outlineColor={this.props.backgroundColor}
            >
                {textWrap.renderSVG(x + padding, y, {
                    textProps: {
                        ...COMPARISON_LINE_TEXT_STYLE,
                        textAnchor,
                        clipPath: this.clipPath.id,
                    },
                })}
            </Halo>
        )
    }

    render(): React.ReactElement | null {
        if (!this.lineCoordinates) return null

        return (
            <g id={makeIdForHumanConsumption("vertical-comparison-line")}>
                {this.clipPath.element}
                <line
                    x1={this.lineCoordinates.x}
                    y1={this.lineCoordinates.y1}
                    x2={this.lineCoordinates.x}
                    y2={this.lineCoordinates.y2}
                    clipPath={this.clipPath.id}
                    style={COMPARISON_LINE_STYLE}
                />
                {this.renderLabel()}
            </g>
        )
    }
}
