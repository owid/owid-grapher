import * as React from "react"
import { computed, makeObservable } from "mobx"
import { Triangle } from "./Triangle"
import { TextWrap } from "@ourworldindata/components"
import { BASE_FONT_SIZE } from "../core/GrapherConstants"
import { makeFigmaId } from "@ourworldindata/utils"
import * as _ from "lodash-es"
import { GRAPHER_DARK_TEXT, GRAY_70 } from "../color/ColorConstants.js"

export interface ConnectedScatterLegendManager {
    sidebarWidth: number
    displayStartTime: string
    displayEndTime: string
    fontSize?: number
    compareEndPointsOnly?: boolean
    isStaticAndSmall?: boolean
}

export class ConnectedScatterLegend {
    manager: ConnectedScatterLegendManager

    private lineToLabelSpacing = 8
    private dotRadius = 2
    private arrowRadius = 3
    private padding = this.arrowRadius
    private textColor = GRAPHER_DARK_TEXT
    private arrowColor = GRAY_70
    private outlineColor = "#fff"
    private outlineWidth = 0.2

    constructor(manager: ConnectedScatterLegendManager) {
        makeObservable(this)
        this.manager = manager
    }

    @computed get fontSize(): number {
        const baseFontSize = this.manager.fontSize ?? BASE_FONT_SIZE
        const fontScale = this.manager.isStaticAndSmall ? 0.5 : 0.7
        return fontScale * baseFontSize
    }

    @computed get width(): number {
        return this.manager.sidebarWidth
    }

    @computed get maxLabelWidth(): number {
        return (this.width - 2) / 2
    }

    @computed get startLabel(): TextWrap {
        const { manager, maxLabelWidth, fontSize } = this
        return new TextWrap({
            text: manager.displayStartTime,
            fontSize,
            maxWidth: maxLabelWidth,
            lineHeight: 1,
        })
    }

    @computed get endLabel(): TextWrap {
        const { manager, maxLabelWidth, fontSize } = this
        return new TextWrap({
            text: manager.displayEndTime,
            fontSize,
            maxWidth: maxLabelWidth,
            lineHeight: 1,
        })
    }

    @computed get maxLabelHeight(): number {
        return Math.max(this.startLabel.height, this.endLabel.height)
    }

    @computed get height(): number {
        return this.maxLabelHeight + this.padding + this.lineToLabelSpacing
    }

    render(
        targetX: number,
        targetY: number,
        renderOptions: React.SVGAttributes<SVGGElement> = {}
    ): React.ReactElement {
        const { startLabel, endLabel, padding, lineToLabelSpacing, width } =
            this

        // Arrow line
        const lineLeft = targetX + padding
        const lineRight = targetX + width - padding
        const lineY = targetY + padding

        // Labels below the line
        const labelY = lineY + lineToLabelSpacing
        const labelStartX = targetX
        const labelEndX = targetX + width - endLabel.width
        const labelProps = { textProps: { fill: this.textColor } }

        return (
            <g
                id={makeFigmaId("arrow-legend")}
                className="ConnectedScatterLegend"
                {...renderOptions}
            >
                <rect
                    x={targetX}
                    y={targetY}
                    width={this.width}
                    height={this.height}
                    fill="#fff"
                    opacity={0}
                />
                {startLabel.renderSVG(labelStartX, labelY, labelProps)}
                {endLabel.renderSVG(labelEndX, labelY, labelProps)}
                <line
                    x1={lineLeft}
                    y1={lineY}
                    x2={lineRight}
                    y2={lineY}
                    stroke={this.arrowColor}
                    strokeWidth={1}
                />
                <circle
                    cx={lineLeft}
                    cy={lineY}
                    r={this.dotRadius}
                    fill={this.arrowColor}
                    stroke={this.outlineColor}
                    strokeWidth={this.outlineWidth}
                />
                {!this.manager.compareEndPointsOnly && (
                    <React.Fragment>
                        <circle
                            cx={lineLeft + (lineRight - lineLeft) / 3}
                            cy={lineY}
                            r={this.dotRadius}
                            fill={this.arrowColor}
                            stroke={this.outlineColor}
                            strokeWidth={this.outlineWidth}
                        />
                        <circle
                            cx={lineLeft + (2 * (lineRight - lineLeft)) / 3}
                            cy={lineY}
                            r={this.dotRadius}
                            fill={this.arrowColor}
                            stroke={this.outlineColor}
                            strokeWidth={this.outlineWidth}
                        />
                    </React.Fragment>
                )}
                <Triangle
                    cx={lineRight}
                    cy={lineY}
                    r={this.arrowRadius}
                    rotation={90}
                    fill={this.arrowColor}
                    stroke={this.outlineColor}
                    strokeWidth={this.outlineWidth}
                />
            </g>
        )
    }
}
