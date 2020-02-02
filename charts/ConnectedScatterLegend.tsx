import { computed } from "mobx"
import * as React from "react"

import { Triangle } from "./Marks"
import { TextWrap } from "./TextWrap"
import { formatYear } from "./Util"

interface ConnectedScatterLegendProps {
    maxWidth: number
    fontSize: number
    startYear: number
    endYear: number
    endpointsOnly: boolean
}

export class ConnectedScatterLegend {
    props: ConnectedScatterLegendProps
    constructor(props: ConnectedScatterLegendProps) {
        this.props = props
    }

    @computed get fontSize(): number {
        return 0.7 * this.props.fontSize
    }
    @computed get fontColor(): string {
        return "#333"
    }
    @computed get maxLabelWidth(): number {
        return this.props.maxWidth / 3
    }

    @computed get startLabel() {
        const { props, maxLabelWidth, fontSize } = this
        return new TextWrap({
            text: formatYear(props.startYear),
            fontSize: fontSize,
            maxWidth: maxLabelWidth
        })
    }

    @computed get endLabel() {
        const { props, maxLabelWidth, fontSize } = this
        return new TextWrap({
            text: formatYear(props.endYear),
            fontSize: fontSize,
            maxWidth: maxLabelWidth
        })
    }

    @computed get width() {
        return this.props.maxWidth
    }

    @computed get height() {
        return Math.max(this.startLabel.height, this.endLabel.height)
    }

    render(
        targetX: number,
        targetY: number,
        options: React.SVGAttributes<SVGGElement> = {}
    ) {
        const { props, startLabel, endLabel, fontColor } = this

        const lineLeft = targetX + startLabel.width + 5
        const lineRight = targetX + props.maxWidth - endLabel.width - 5
        const lineY = targetY + this.height / 2 - 0.5

        return (
            <g className="ConnectedScatterLegend" {...options}>
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
                    targetX + props.maxWidth - endLabel.width,
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
                {!props.endpointsOnly && (
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
