/* LineChart.tsx
 * ================
 *
 * A standard line chart.
 *
 */

import * as React from 'react'
import * as _ from 'lodash'
import * as d3 from 'd3'
import {computed, action, observable, autorun} from 'mobx'
import {observer} from 'mobx-react'
import {LineChartSeries, LineChartValue} from './LineChart'
import AxisScale from './AxisScale'
import Vector2 from './Vector2'
import {getRelativeMouse, makeSafeForCSS} from './Util'
import Bounds from './Bounds'
import DataKey from './DataKey'

export interface LinesProps {
    xScale: AxisScale,
    yScale: AxisScale,
    data: LineChartSeries[],
    focusKeys: DataKey[],
    onHoverPoint?: (target: HoverTarget) => void,
    onHoverStop?: () => void
}

interface LineRenderSeries {
    key: string,
    displayKey: string,
    color: string,
    values: Vector2[],
    isFocus: boolean
}

export interface HoverTarget {
    pos: Vector2,
    series: LineChartSeries,
    value: LineChartValue
}

@observer
export default class Lines extends React.Component<LinesProps> {
    base: SVGGElement
    @observable.ref hover: HoverTarget|null = null

    @computed get renderData(): LineRenderSeries[] {
        const {data, xScale, yScale, focusKeys} = this.props
        return _.map(data, series => {
            return {
                key: series.key,
                displayKey: "key-" + makeSafeForCSS(series.key),
                color: series.color,
                values: series.values.map(v => {
                    return new Vector2(Math.round(xScale.place(v.x)), Math.round(yScale.place(v.y)))
                }),
                isFocus: _.includes(focusKeys, series.key)
            }
        })
    }

    @computed get isFocusMode(): boolean {
        return _.some(this.renderData, d => d.isFocus)
    }

    @computed get hoverData(): HoverTarget[] {
        const {data} = this.props
        const {renderData} = this
        return _.flatten(_.map(this.renderData, (series, i) => {
            return _.map(series.values, (v, j) => {
                return {
                    pos: v,
                    series: data[i],
                    value: data[i].values[j] 
                }
            })
        }))
    }

    @action.bound onMouseMove(ev: React.MouseEvent<SVGGElement>) {
        const mouse = getRelativeMouse(this.base, ev)
        const {props, hoverData} = this

        const value = _.sortBy(hoverData, v => Vector2.distanceSq(v.pos, mouse))[0]
        if (Vector2.distance(value.pos, mouse) < 100) {
            this.hover = value
            if (this.props.onHoverPoint) this.props.onHoverPoint(value)
        } else {
            this.onMouseLeave()
        }
    }

    @action.bound onMouseLeave() {
        if (this.hover && this.props.onHoverStop) this.props.onHoverStop()
        this.hover = null
    }

    @computed get bounds() {
        const {xScale, yScale} = this.props
        return Bounds.fromCorners(new Vector2(xScale.range[0], yScale.range[0]),
                                  new Vector2(xScale.range[1], yScale.range[1]))
    }

    @computed get focusGroups() {
        return _.filter(this.renderData, g => g.isFocus)
    }

    @computed get backgroundGroups() {
        return _.filter(this.renderData, g => !g.isFocus)
    }

    renderFocusGroups() {
        return _.map(this.focusGroups, series =>
            <g className={series.displayKey}>
                <defs key={series.displayKey+'-defs'}>
                    <marker id={series.displayKey+'-circle'} viewBox="0 0 16 16"
                            refX={8} refY={8} orient="auto" fill={series.color}>
                        <circle cx={8} cy={8} r={8}/>
                    </marker>
                </defs>
                <polyline
                    key={series.key+'-line'}
                    strokeLinecap="round"
                    stroke={series.color}
                    points={_.map(series.values, v => `${v.x},${v.y}`).join(' ')}
                    fill="none"
                    strokeWidth={1}
                    opacity={1}
                    markerStart={`url(#${series.displayKey}-circle)`}
                    markerMid={`url(#${series.displayKey}-circle)`}
                    markerEnd={`url(#${series.displayKey}-circle)`}
                />
            </g>
        )
    }

    renderBackgroundGroups() {
       return _.map(this.backgroundGroups, series =>
            <polyline
                key={series.key+'-line'}
                strokeLinecap="round"
                stroke="#ccc"
                points={_.map(series.values, v => `${v.x},${v.y}`).join(' ')}
                fill="none"
                strokeWidth={1}
                opacity={1}
            />,
        )
    }

    render() {
        const {renderData, hover, bounds, isFocusMode} = this        

        return <g className="Lines" onMouseMove={this.onMouseMove} onMouseLeave={this.onMouseLeave}>
            <rect x={Math.round(bounds.x)} y={Math.round(bounds.y)} width={Math.round(bounds.width)} height={Math.round(bounds.height)} fill="rgba(255,255,255,0)" opacity={0}/>
            {this.renderBackgroundGroups()}
            {this.renderFocusGroups()}
            {hover && <circle cx={hover.pos.x} cy={hover.pos.y} r={5} fill={hover.series.color}/>}
        </g>
    }
}
