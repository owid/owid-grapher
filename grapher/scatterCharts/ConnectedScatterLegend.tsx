import React from "react"
import { computed, makeObservable } from "mobx"
import { Triangle } from "./Triangle.js"
import { TextWrap } from "../text/TextWrap.js"
import { BASE_FONT_SIZE } from "../core/GrapherConstants.js"

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
        makeObservable(this, {
            fontSize: computed,
            fontColor: computed,
            maxLabelWidth: computed,
            startLabel: computed,
            endLabel: computed,
            width: computed,
            height: computed,
        })

        this.manager = manager
    }

    get fontSize(): number {
        return 0.7 * (this.manager.fontSize ?? BASE_FONT_SIZE)
    }
    get fontColor(): string {
        return "#333"
    }
    get maxLabelWidth(): number {
        return this.manager.sidebarWidth / 3
    }

    get startLabel(): TextWrap {
        const { manager, maxLabelWidth, fontSize } = this
        return new TextWrap({
            text: manager.displayStartTime,
            fontSize,
            maxWidth: maxLabelWidth,
            lineHeight: 1,
        })
    }

    get endLabel(): TextWrap {
        const { manager, maxLabelWidth, fontSize } = this
        return new TextWrap({
            text: manager.displayEndTime,
            fontSize,
            maxWidth: maxLabelWidth,
            lineHeight: 1,
        })
    }

    get width(): number {
        return this.manager.sidebarWidth
    }

    get height(): number {
        return Math.max(this.startLabel.height, this.endLabel.height)
    }

    render(
        targetX: number,
        targetY: number,
        renderOptions: React.SVGAttributes<SVGGElement> = {}
    ): JSX.Element {
        const { manager, startLabel, endLabel, fontColor } = this

        const lineLeft = targetX + startLabel.width + 5
        const lineRight = targetX + manager.sidebarWidth - endLabel.width - 5
        const lineY = targetY + this.height / 2 - 0.5

        return (
            <g className="ConnectedScatterLegend" {...renderOptions}>
                <rect
                    x={targetX}
                    y={targetY}
                    width={this.width}
                    height={this.height}
                    fill="#fff"
                    opacity={0}
                />
                {startLabel.render(targetX, targetY, { fill: fontColor })}
                {endLabel.render(
                    targetX + manager.sidebarWidth - endLabel.width,
                    targetY,
                    { fill: fontColor }
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
