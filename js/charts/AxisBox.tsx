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
import VerticalAxis, {VerticalAxisView} from './VerticalAxis'
import HorizontalAxis, {HorizontalAxisView} from './HorizontalAxis'
import AxisSpec from './AxisSpec'
import ScaleType from './ScaleType'
import TextWrap from './TextWrap'

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
export class AxisGridLines extends React.Component<AxisGridLinesProps> {
    render() {
        const {orient, bounds} = this.props
        let scale = this.props.scale.extend({ range: orient == 'left' ? bounds.yRange() : bounds.xRange() })

        return <g className="AxisGridLines">
            {_.map(scale.getTickValues(), v => {
                if (orient == 'left')
                    return <line x1={bounds.left} y1={Math.round(scale.place(v))} x2={bounds.right} y2={Math.round(scale.place(v))} stroke={v == 0 ? "#ddd" : "#eee"} stroke-dasharray={v != 0 && "3,2"}/>
                else
                    return <line x1={Math.round(scale.place(v))} y1={bounds.bottom} x2={Math.round(scale.place(v))} y2={bounds.top} stroke={v == 0 ? "#ddd" : "#eee"} stroke-dasharray={v != 0 && "3,2"}/>
                
            })}    
        </g>
    }
}

export interface AxisBoxViewProps {
    axisBox: AxisBox,
    onYScaleChange: (scaleType: ScaleType) => void,
    onXScaleChange: (scaleType: ScaleType) => void,
    highlightValue?: { x: number, y: number }
}

@observer
export class AxisBoxView extends React.Component<AxisBoxViewProps> {
    render() {
        const {axisBox, onYScaleChange, onXScaleChange, highlightValue} = this.props
        const {bounds, xScale, yScale, xAxis, yAxis, innerBounds} = axisBox

        return <g className="AxisBoxView">
            <HorizontalAxisView bounds={bounds} axis={xAxis} onScaleTypeChange={onXScaleChange}/>
            <VerticalAxisView bounds={bounds} axis={yAxis} onScaleTypeChange={onYScaleChange}/>
            <AxisGridLines orient="left" scale={yScale} bounds={innerBounds}/>
            <AxisGridLines orient="bottom" scale={xScale} bounds={innerBounds}/>
        </g>
    }
}