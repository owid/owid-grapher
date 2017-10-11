import { scaleLinear } from 'd3-scale'
import { line as d3_line, curveLinear } from 'd3-shape'
import { defaultTo, guid } from './Util'
import * as React from 'react'
import { computed } from 'mobx'
import { observer } from 'mobx-react'
import AxisBox from './AxisBox'
import evalEquation from './evalEquation'

export interface ComparisonLineConfig {
    yEquals?: string
}

@observer
export default class ComparisonLine extends React.Component<{ axisBox: AxisBox, comparisonLine: ComparisonLineConfig }> {
    @computed get lineData(): string | null {
        const { comparisonLine, axisBox } = this.props
        const { xScale, yScale } = axisBox

        const yEquals = defaultTo(comparisonLine.yEquals, "x")
        const yFunc = (x: number) => evalEquation(yEquals, { x: x }, x)

        // Construct control data by running the equation across sample points
        const numPoints = 100
        const scale = scaleLinear().domain([0, 100]).range(xScale.domain)
        const controlData: Array<[number, number]> = []
        for (let i = 0; i < numPoints; i++) {
            const x = scale(i)
            const y = yFunc(x)

            if (xScale.scaleType === 'log' && x <= 0)
                continue
            if (yScale.scaleType === 'log' && y <= 0)
                continue
            controlData.push([x, y])
        }
        const line = d3_line().curve(curveLinear).x(d => xScale.place(d[0])).y(d => yScale.place(d[1]))
        return line(controlData)
    }

    render() {
        const { innerBounds } = this.props.axisBox
        const { lineData } = this
        const renderUid = guid()

        return <g className="ComparisonLine">
            <defs>
                <clipPath id={`axisBounds-${renderUid}`}>
                    <rect x={innerBounds.x} y={innerBounds.y} width={innerBounds.width} height={innerBounds.height} />
                </clipPath>
            </defs>
            <path d={lineData || undefined} clipPath={`url(#axisBounds-${renderUid})`} fill="none" stroke="#ccc" />
        </g>
    }
}
