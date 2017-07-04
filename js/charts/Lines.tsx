/* LineChart.tsx
 * ================
 *
 * A standard line chart.
 *
 */

import * as React from 'react'
import * as _ from 'lodash'
import * as d3 from 'd3'
import {computed} from 'mobx'
import {observer} from 'mobx-react'
import {LineChartSeries} from './LineChart'
import AxisScale from './AxisScale'

export interface LinesProps {
    xScale: AxisScale,
    yScale: AxisScale,
    data: LineChartSeries[]
}

interface LineRenderSeries {
    key: string,
    color: string,
    values: { x: number, y: number }[]
}

@observer
export default class Lines extends React.Component<LinesProps, undefined> {
    @computed get renderData(): LineRenderSeries[] {
        const {data, xScale, yScale} = this.props
        return _.map(data, series => {
            return {
                key: series.key,
                color: series.color,
                values: series.values.map(v => {
                    return {
                        x: Math.round(xScale.place(v.x)),
                        y: Math.round(yScale.place(v.y))
                    }
                })
            }
        })
    }

    render() {
        const {renderData} = this

        return <g className="Lines">
            {_.map(renderData, series =>
                <polyline
                    key={series.key+'-line'}
                    strokeLinecap="round"
                    stroke={series.color}
                    points={_.map(series.values, v => `${v.x},${v.y}`).join(' ')}
                    fill="none"
                    strokeWidth={1}
                    opacity={1}
                />,
            )}
        </g>
    }
}
