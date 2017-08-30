import * as React from 'react'
import * as _ from 'lodash'
import * as d3 from 'd3'
import {observer} from 'mobx-react'
import AxisBox from './AxisBox'
import evalEquation from './evalEquation'

export interface ComparisonLineConfig {
    yEquals?: string
}

@observer
export default class ComparisonLine extends React.Component<{ axisBox: AxisBox, comparisonLine: ComparisonLineConfig }> {
    render() {
        const {comparisonLine, axisBox} = this.props
        const {xScale, yScale, innerBounds} = axisBox 

        const yEquals = _.defaultTo<string>(comparisonLine.yEquals, "x")
        const yFunc = function(x: number) {
            return evalEquation(yEquals, { x: x }, x)
        }

        // Construct control data by running the equation across sample points
        const numPoints = 100
        const scale = d3.scaleLinear().domain([0, 100]).range(xScale.domain)
        const controlData: [number, number][] = []
        for (var i = 0; i < numPoints; i++) {
            const x = scale(i)
            const y = yFunc(x)

            if (xScale.scaleType == 'log' && x <= 0)
                continue
            if (yScale.scaleType == 'log' && y <= 0)
                continue
            controlData.push([x, y])
        }                
        const line = d3.line().curve(d3.curveLinear).x(d => xScale.place(d[0])).y(d => yScale.place(d[1]))

        return <g className="ComparisonLine">
            <defs>
                <clipPath id="axisBounds">
                    <rect x={innerBounds.x} y={innerBounds.y} width={innerBounds.width} height={innerBounds.height}/>
                </clipPath>
            </defs>
            <path d={line(controlData)||undefined} clipPath="url(#axisBounds)" fill="none" stroke="#ccc"/>
        </g>
    }
}