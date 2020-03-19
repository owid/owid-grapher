import * as React from "react"

export class AxisTickMarks extends React.Component<{
    tickMarkTopPosition: number
    tickMarkXPositions: number[]
    color: string
}> {
    render() {
        const { tickMarkTopPosition, tickMarkXPositions, color } = this.props
        const tickSize = 3
        const tickBottom = tickMarkTopPosition + tickSize
        return tickMarkXPositions.map((tickMarkPosition, index) => {
            return (
                <line
                    key={index}
                    x1={tickMarkPosition}
                    y1={tickMarkTopPosition}
                    x2={tickMarkPosition}
                    y2={tickBottom}
                    stroke={color}
                />
            )
        })
    }
}
