/* AxisBox.tsx
 * ================
 *
 * Standard axis box layout model. Precompute before rendering and pass it around.
 * 
 * @project Our World In Data
 * @author  Jaiden Mispy
 * @created 2017-02-11
 */

import * as d3 from 'd3'
import * as _ from 'lodash'
import * as React from 'react'
import {observable, computed, action, toJS} from 'mobx'
import {observer} from 'mobx-react'
import Bounds from './Bounds'
import AxisScale, {AxisConfig} from './AxisScale'
import {HorizontalAxis, VerticalAxis, HorizontalAxisView, VerticalAxisView} from './Axis'
import AxisSpec from './AxisSpec'

interface AxisBoxProps {
    bounds: Bounds,
    xAxis: AxisSpec,
    yAxis: AxisSpec
}

// AxisBox has the important task of coordinating two axes so that they work together!
// There is a *two-way dependency* between the bounding size of each axis.
// e.g. if the y axis becomes wider because a label is present, the x axis then has less
// space to work with, and vice versa
export default class AxisBox {
    props: AxisBoxProps

    constructor(props: AxisBoxProps) {
        this.props = props
    }

    // We calculate an initial width/height for the axes in isolation
    @computed get xAxisHeight() {
        return new HorizontalAxis({
            scale: new AxisScale(this.props.xAxis).extend({ range: [0, this.props.bounds.width] }),
            labelText: this.props.xAxis.label
        }).height
    }

    @computed get yAxisWidth() {
        return new VerticalAxis({
            scale: new AxisScale(this.props.yAxis).extend({ range: [0, this.props.bounds.height] }),
            labelText: this.props.yAxis.label
        }).width
    }

    // Now we can determine the "true" inner bounds of the axis box
    @computed get innerBounds(): Bounds {
        return this.props.bounds.padBottom(this.xAxisHeight).padLeft(this.yAxisWidth)
    }

    @computed get xScale() {
        return new AxisScale(this.props.xAxis).extend({ range: this.innerBounds.xRange() })
    }

    @computed get xAxis() {
        const _this = this
        return new HorizontalAxis({
            get scale() { return _this.xScale },
            get labelText() { return _this.props.xAxis.label }
        })
    }

    @computed get yScale() {
        return new AxisScale(this.props.yAxis).extend({ range: this.innerBounds.yRange() })
    }

    @computed get yAxis() {
        const _this = this
        return new VerticalAxis({
            get scale() { return _this.yScale },
            get labelText() { return _this.props.yAxis.label }
        })
    }

    @computed get bounds() {
        return this.props.bounds
    }
}

interface AxisGridLinesProps {
    orient: 'left' | 'bottom',
    scale: AxisScale,
    bounds: Bounds
}

@observer
class AxisGridLines extends React.Component<AxisGridLinesProps, undefined> {
    render() {
        const {orient, bounds} = this.props
        let scale = this.props.scale.extend({ range: orient == 'left' ? bounds.yRange() : bounds.xRange() })

        return <g className="AxisGridLines">
            {_.map(scale.getTickValues(), v => {
                if (orient == 'left')
                    return <line x1={bounds.left} y1={scale.place(v)} x2={bounds.right} y2={scale.place(v)} stroke="#eee" stroke-dasharray="3,2"/>
                else
                    return <line x1={scale.place(v)} y1={bounds.bottom} x2={scale.place(v)} y2={bounds.top} stroke="#eee" stroke-dasharray="3,2"/>
                
            })}    
        </g>
    }
}

@observer
export class AxisBoxView extends React.Component<any, undefined> {
    render() {
        const {axisBox, onYScaleChange, onXScaleChange} = this.props
        const {bounds, xScale, yScale, xAxis, yAxis, innerBounds} = axisBox

        return <g className="AxisBoxView">
            <HorizontalAxisView bounds={bounds} axis={axisBox.xAxis} onScaleTypeChange={onYScaleChange}/>
            <VerticalAxisView bounds={bounds} axis={axisBox.yAxis} onScaleTypeChange={onXScaleChange}/>
            <AxisGridLines orient="left" scale={yScale} bounds={innerBounds}/>
            <AxisGridLines orient="bottom" scale={xScale} bounds={innerBounds}/>
        </g>
    }
}