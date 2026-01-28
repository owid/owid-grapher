import * as React from "react"
import { computed, makeObservable } from "mobx"
import { Triangle } from "./Triangle"
import { TextWrap } from "@ourworldindata/components"
import { BASE_FONT_SIZE } from "../core/GrapherConstants"
import { makeIdForHumanConsumption } from "@ourworldindata/utils"
import * as _ from "lodash-es"

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
    constructor(manager: ConnectedScatterLegendManager) {
        makeObservable(this)
        this.manager = manager
    }

    @computed get fontSize(): number {
        const baseFontSize = this.manager.fontSize ?? BASE_FONT_SIZE
        const multiplier = this.manager.isStaticAndSmall ? 0.5 : 0.7
        return multiplier * baseFontSize
    }
    @computed get fontColor(): string {
        return "#333"
    }
    @computed get maxLabelWidth(): number {
        return this.manager.sidebarWidth / 3
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

    @computed get width(): number {
        return this.manager.sidebarWidth
    }

    @computed get height(): number {
        const labelHeight = Math.max(
            this.startLabel.height,
            this.endLabel.height
        )

        // Arrow line area (6px) + gap (4px) + labels height
        return 6 + 4 + labelHeight
    }

    render(
        targetX: number,
        targetY: number,
        renderOptions: React.SVGAttributes<SVGGElement> = {}
    ): React.ReactElement {
        const { manager, startLabel, endLabel, fontColor } = this

        // Arrow line spans nearly full width at top
        const lineLeft = targetX + 5
        const lineRight = targetX + manager.sidebarWidth - 5
        const lineY = targetY + 3

        // Labels below the line
        const labelY = targetY + 10

        return (
            <g
                id={makeIdForHumanConsumption("arrow-legend")}
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
                {this.renderArrowLine(lineLeft, lineRight, lineY)}
                {startLabel.renderSVG(targetX, labelY, {
                    textProps: { fill: fontColor },
                })}
                {endLabel.renderSVG(
                    targetX + manager.sidebarWidth - endLabel.width,
                    labelY,
                    { textProps: { fill: fontColor } }
                )}
            </g>
        )
    }

    // Shared arrow line rendering (circles, line, triangle)
    private renderArrowLine(
        lineLeft: number,
        lineRight: number,
        lineY: number
    ): React.ReactElement {
        const { manager } = this

        return (
            <React.Fragment>
                <line
                    x1={lineLeft}
                    y1={lineY}
                    x2={lineRight}
                    y2={lineY}
                    stroke="#666"
                    strokeWidth={1}
                />
                <circle
                    cx={lineLeft}
                    cy={lineY}
                    r={2}
                    fill="#666"
                    stroke="#ccc"
                    strokeWidth={0.2}
                />
                {!manager.compareEndPointsOnly && (
                    <React.Fragment>
                        <circle
                            cx={lineLeft + (lineRight - lineLeft) / 3}
                            cy={lineY}
                            r={2}
                            fill="#666"
                            stroke="#ccc"
                            strokeWidth={0.2}
                        />
                        <circle
                            cx={lineLeft + (2 * (lineRight - lineLeft)) / 3}
                            cy={lineY}
                            r={2}
                            fill="#666"
                            stroke="#ccc"
                            strokeWidth={0.2}
                        />
                    </React.Fragment>
                )}
                <Triangle
                    cx={lineRight}
                    cy={lineY}
                    r={3}
                    rotation={90}
                    fill="#666"
                    stroke="#ccc"
                    strokeWidth={0.2}
                />
            </React.Fragment>
        )
    }
}
