import * as React from "react"
import { AxisBox } from "./AxisBox"
import { TextWrap } from "./TextWrap"
import { Bounds } from "./Bounds"

export class AxisBoxHighlight extends React.Component<{
    axisBox: AxisBox
    value: { x: number; y: number }
}> {
    render() {
        const { axisBox, value } = this.props
        const { xScale, yScale, bounds, innerBounds, xAxis, yAxis } = axisBox

        const xLabel = new TextWrap({
            maxWidth: bounds.width,
            fontSize: 0.7,
            text: xScale.tickFormat(value.x)
        })
        const yLabel = new TextWrap({
            maxWidth: bounds.width,
            fontSize: 0.7,
            text: yScale.tickFormat(value.y)
        })
        const highlightX = xScale.place(value.x)
        const highlightY = yScale.place(value.y)
        const xLabelBounds = new Bounds(
            highlightX - xLabel.width / 2,
            bounds.bottom - xAxis.labelOffset - xLabel.height,
            xLabel.width,
            xLabel.height
        )
        const yLabelBounds = new Bounds(
            bounds.left + yAxis.width - yLabel.width - 5,
            highlightY - yLabel.height / 2,
            yLabel.width,
            yLabel.height
        )

        return (
            <g>
                <line
                    x1={highlightX}
                    y1={innerBounds.bottom}
                    x2={highlightX}
                    y2={highlightY}
                    stroke="#000"
                    strokeDasharray="3,2"
                />
                <rect {...xLabelBounds.padWidth(-10).toProps()} fill="#fff" />
                {xLabel.render(xLabelBounds.x, xLabelBounds.y, {
                    fill: "#333",
                    fontWeight: "bold"
                })}
                <line
                    x1={innerBounds.left}
                    y1={highlightY}
                    x2={highlightX}
                    y2={highlightY}
                    stroke="#000"
                    strokeDasharray="3,2"
                />
                <rect {...yLabelBounds.padHeight(-10).toProps()} fill="#fff" />
                {yLabel.render(yLabelBounds.x, yLabelBounds.y, {
                    fill: "#333",
                    fontWeight: "bold"
                })}
            </g>
        )
    }
}
