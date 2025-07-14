import * as React from "react"
import { computed, makeObservable } from "mobx"
import { Triangle } from "./Triangle"
import { TextWrap } from "@ourworldindata/components"
import { BASE_FONT_SIZE } from "../core/GrapherConstants"
import { makeIdForHumanConsumption } from "@ourworldindata/utils"

export interface ConnectedScatterLegendManager {
    sidebarWidth: number
    displayStartTime: string
    displayEndTime: string
    fontSize?: number
    compareEndPointsOnly?: boolean
}

export class ConnectedScatterLegend {
    manager: ConnectedScatterLegendManager
    constructor(manager: ConnectedScatterLegendManager) {
        makeObservable(this)
        this.manager = manager
    }

    @computed get fontSize(): number {
        return 0.7 * (this.manager.fontSize ?? BASE_FONT_SIZE)
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
        return Math.max(this.startLabel.height, this.endLabel.height)
    }

    render(
        targetX: number,
        targetY: number,
        renderOptions: React.SVGAttributes<SVGGElement> = {}
    ): React.ReactElement {
        const { manager, startLabel, endLabel, fontColor } = this

        const lineLeft = targetX + startLabel.width + 5
        const lineRight = targetX + manager.sidebarWidth - endLabel.width - 5
        const lineY = targetY + this.height / 2 - 0.5

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
                {startLabel.renderSVG(targetX, targetY, {
                    textProps: { fill: fontColor },
                })}
                {endLabel.renderSVG(
                    targetX + manager.sidebarWidth - endLabel.width,
                    targetY,
                    { textProps: { fill: fontColor } }
                )}
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
                    fill="#666"
                    stroke="#ccc"
                    strokeWidth={0.2}
                    transform={`rotate(${90}, ${lineRight}, ${lineY})`}
                />
            </g>
        )
    }
}
