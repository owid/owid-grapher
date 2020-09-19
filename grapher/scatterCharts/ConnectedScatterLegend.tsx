import * as React from "react"
import { computed } from "mobx"
import { Triangle } from "./Triangle"
import { TextWrap } from "grapher/text/TextWrap"
import { BASE_FONT_SIZE } from "grapher/core/GrapherConstants"

export interface ConnectedScatterLegendOptionsProvider {
    maxLegendWidth: number
    displayStartTime: string
    displayEndTime: string
    fontSize?: number
    compareEndpointsOnly?: boolean
}

export class ConnectedScatterLegend {
    options: ConnectedScatterLegendOptionsProvider
    constructor(options: ConnectedScatterLegendOptionsProvider) {
        this.options = options
    }

    @computed get fontSize() {
        return 0.7 * (this.options.fontSize ?? BASE_FONT_SIZE)
    }
    @computed get fontColor() {
        return "#333"
    }
    @computed get maxLabelWidth() {
        return this.options.maxLegendWidth / 3
    }

    @computed get startLabel() {
        const { options, maxLabelWidth, fontSize } = this
        return new TextWrap({
            text: options.displayStartTime,
            fontSize,
            maxWidth: maxLabelWidth,
        })
    }

    @computed get endLabel() {
        const { options, maxLabelWidth, fontSize } = this
        return new TextWrap({
            text: options.displayEndTime,
            fontSize,
            maxWidth: maxLabelWidth,
        })
    }

    @computed get width() {
        return this.options.maxLegendWidth
    }

    @computed get height() {
        return Math.max(this.startLabel.height, this.endLabel.height)
    }

    render(
        targetX: number,
        targetY: number,
        renderOptions: React.SVGAttributes<SVGGElement> = {}
    ) {
        const { options, startLabel, endLabel, fontColor } = this

        const lineLeft = targetX + startLabel.width + 5
        const lineRight = targetX + options.maxLegendWidth - endLabel.width - 5
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
                    targetX + options.maxLegendWidth - endLabel.width,
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
                {!options.compareEndpointsOnly && (
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
