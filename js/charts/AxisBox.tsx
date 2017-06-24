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
import Axis from './Axis'
import AxisSpec from './AxisSpec'

interface AxisBoxProps {
    bounds: Bounds,
    xAxis: AxisSpec,
    yAxis: AxisSpec
}

function component(current: any, klass: any, props: any) {
    current = current || new klass()
    _.each(_.keys(props), key => {
        current[key] = props[key]
    })
    return current
}

export default class AxisBox {
    @observable.ref bounds: Bounds
    @observable.ref xAxis: AxisSpec
    @observable.ref yAxis: AxisSpec

    @computed get xAxisBounds(): Bounds {
        return Axis.calculateBounds(this.bounds, { orient: 'bottom', scale: new AxisScale(this.xAxis), label: this.xAxis.label })
    }

    @computed get yAxisBounds(): Bounds {
        return Axis.calculateBounds(this.bounds, { orient: 'left', scale: new AxisScale(this.yAxis), label: this.yAxis.label })
    }

    @computed get innerBounds(): Bounds {
        return this.bounds.padBottom(this.xAxisBounds.height).padLeft(this.yAxisBounds.width)
    }

    @computed get xScale(): AxisScale {
        return new AxisScale(_.extend(this.xAxis, { range: this.innerBounds.xRange() }))
    }

    @computed get yScale(): AxisScale {
        return new AxisScale(_.extend(this.yAxis, { range: this.innerBounds.yRange() }))        
    }

    constructor(props: AxisBoxProps) {
        this.bounds = props.bounds
        this.xAxis = props.xAxis
        this.yAxis = props.yAxis
    }
}

interface AxisGridLinesProps {
    orient: 'left' | 'bottom',
    scale: AxisScale,
    bounds: Bounds
}

@observer
class AxisGridLines extends React.Component<AxisGridLinesProps, null> {
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
        const {bounds, xScale, yScale, xAxis, yAxis, xAxisBounds, yAxisBounds, innerBounds} = axisBox

        return <g className="AxisBoxView">
            <Axis orient="left" scale={yScale} labelText={yAxis.label} bounds={bounds.padBottom(xAxisBounds.height)} onScaleTypeChange={onYScaleChange}/>
            <Axis orient="bottom" scale={xScale} labelText={xAxis.label} bounds={bounds.padLeft(yAxisBounds.width)} onScaleTypeChange={onXScaleChange}/>
            <AxisGridLines orient="left" scale={yScale} bounds={innerBounds}/>
            <AxisGridLines orient="bottom" scale={xScale} bounds={innerBounds}/>
        </g>
    }
}