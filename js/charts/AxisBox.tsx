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
import Bounds from './Bounds'
import AxisScale, {AxisConfig} from './AxisScale'
import Axis from './Axis'

interface AxisBoxProps {
    bounds: Bounds,
    xAxisConfig: AxisConfig,
    yAxisConfig: AxisConfig
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
    @observable.ref xAxisConfig: AxisConfig
    @observable.ref yAxisConfig: AxisConfig

    @computed get xAxisBounds(): Bounds {
        return Axis.calculateBounds(this.bounds, { orient: 'bottom', scale: new AxisScale(this.xAxisConfig), label: this.xAxisConfig.label })
    }

    @computed get yAxisBounds(): Bounds {
        return Axis.calculateBounds(this.bounds, { orient: 'left', scale: new AxisScale(this.yAxisConfig), label: this.yAxisConfig.label })
    }

    @computed get innerBounds(): Bounds {
        return this.bounds.padBottom(this.xAxisBounds.height).padLeft(this.yAxisBounds.width)
    }

    @computed get xScale(): AxisScale {
        return new AxisScale(_.extend(this.xAxisConfig, { range: this.innerBounds.xRange() }))
    }

    @computed get yScale(): AxisScale {
        return new AxisScale(_.extend(this.yAxisConfig, { range: this.innerBounds.yRange() }))        
    }

    constructor(props: AxisBoxProps) {
        this.bounds = props.bounds
        this.xAxisConfig = props.xAxisConfig
        this.yAxisConfig = props.yAxisConfig

    }

    @computed get rendered() {
        const {bounds} = this
        return [
            <AxisGrid orient="left" scale={yScale} bounds={innerBounds}/>,
            <AxisGrid orient="bottom" scale={xScale} bounds={innerBounds}/>    
        ]
        return <line x1={bounds.left} y1={bounds.bottom} x2={bounds.right} y2={bounds.top} stroke="#ccc"/>
    }
}

class AxisGrid extends React.Component<AxisGridProps, null> {
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

export class AxisBoxView extends React.Component<any, undefined> {
    render() {
        const {axisBox, onYScaleChange, onXScaleChange} = this.props
        const {bounds, xScale, yScale, xAxisConfig, yAxisConfig, xAxisBounds, yAxisBounds, innerBounds} = axisBox

        return <g className="axisBox">
            <Axis orient="left" scale={yScale} labelText={yAxisConfig.label} bounds={bounds.padBottom(xAxisBounds.height)} onScaleTypeChange={onYScaleChange}/>
            <Axis orient="bottom" scale={xScale} labelText={xAxisConfig.label} bounds={bounds.padLeft(yAxisBounds.width)} onScaleTypeChange={onXScaleChange}/>
            <AxisGrid orient="left" scale={yScale} bounds={innerBounds}/>
            <AxisGrid orient="bottom" scale={xScale} bounds={innerBounds}/>
        </g>
    }
}