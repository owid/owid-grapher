import * as React from 'react'
import * as _ from 'lodash'
import {observer} from 'mobx-react'
import AxisBox from './AxisBox'

export interface ComparisonLineConfig {
    x1?: number,
    y1?: number,
    x2?: number,
    y2?: number
}

@observer
export default class ComparisonLine extends React.Component<{ axisBox: AxisBox, comparisonLine: ComparisonLineConfig }, undefined> {
    render() {
        const {comparisonLine, axisBox} = this.props
        const {xScale, yScale} = axisBox 

        const x1 = _.defaultTo(comparisonLine.x1, xScale.domain[0])
        const y1 = _.defaultTo(comparisonLine.y1, yScale.domain[0])
        const x2 = _.defaultTo(comparisonLine.x2, xScale.domain[1])
        const y2 = _.defaultTo(comparisonLine.y2, yScale.domain[1])

        return <line x1={xScale.place(x1)}
                     y1={yScale.place(y1)}
                     x2={xScale.place(x2)}
                     y2={yScale.place(y2)}
                     stroke="#ccc"/>
    }
}