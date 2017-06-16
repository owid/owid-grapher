/* AxisGrid.tsx
 * ================
 *
 * Makes the little dotted axis lines that go across a chart
 *
 * @project Our World In Data
 * @author  Jaiden Mispy
 * @created 2017-05-19
 */

import * as _ from 'lodash'
import * as d3 from 'd3'
import * as React from 'react'
import {observable, computed, action, autorun} from 'mobx'
import {observer} from 'mobx-react'
import Bounds from './Bounds'
import AxisScale from './AxisScale'

export default class AxisGrid extends React.Component<AxisGridProps, null> {
    render() {
        const {orient, bounds} = this.props
        let scale = this.props.scale.extend({ range: orient == 'left' ? bounds.yRange() : bounds.xRange() })

        return <g className="axisGrid">
            {_.map(scale.getTickValues(), v => {
                if (orient == 'left')
                    return <line x1={bounds.left} y1={scale.place(v)} x2={bounds.right} y2={scale.place(v)} stroke="#eee" stroke-dasharray="3,2"/>
                else
                    return <line x1={scale.place(v)} y1={bounds.bottom} x2={scale.place(v)} y2={bounds.top} stroke="#eee" stroke-dasharray="3,2"/>
                
            })}    
        </g>
    }
}