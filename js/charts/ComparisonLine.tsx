import * as React from 'react'
import * as _ from 'lodash'
import * as d3 from 'd3'
import {observer} from 'mobx-react'
import AxisBox from './AxisBox'
import evalEquation from './evalEquation'

export interface ComparisonLineConfig {
    yEquals: string
}

@observer
export default class ComparisonLine extends React.Component<{ axisBox: AxisBox, comparisonLine: ComparisonLineConfig }, undefined> {
    render() {
        const {comparisonLine, axisBox} = this.props
        const {xScale, yScale, innerBounds} = axisBox 

        const yEquals = _.defaultTo(comparisonLine.yEquals, "x")
        const yFunc = function(x) {
            return evalEquation(yEquals, { x: x }, x)
        }

        // Construct control data by running the equation across sample points
        const numPoints = 100
        const scale = d3.scaleLinear().domain([0, 100]).range(xScale.domain)
        const controlData = []
        for (var i = 0; i < numPoints; i++) {
            const x = scale(i)
            const y = yFunc(x)
            controlData.push([x, y])
        }        
        console.log(controlData)
        const line = d3.line().curve(d3.curveLinear).x(d => xScale.place(d[0])).y(d => yScale.place(d[1]))

        return <g className="ComparisonLine">
            <defs>
                <clipPath id="axisBounds">
                    <rect x={innerBounds.x} y={innerBounds.y} width={innerBounds.width} height={innerBounds.height}/>
                </clipPath>
            </defs>
            <path d={line(controlData)} clipPath="url(#axisBounds)" fill="none" stroke="#ccc"/>
        </g>
    }
}