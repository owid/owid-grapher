import * as React from 'react'
import { map, flatten, some, includes, sortBy, filter, sum, guid } from './Util'
import { computed, action, observable } from 'mobx'
import { observer } from 'mobx-react'
import { LineChartSeries, LineChartValue } from './LineChart'
import AxisScale from './AxisScale'
import Vector2 from './Vector2'
import { getRelativeMouse, makeSafeForCSS, pointsToPath } from './Util'
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
    isFocus: boolean,
    isProjection?: boolean
}

export interface HoverTarget {
    pos: Vector2,
    series: LineChartSeries,
    value: LineChartValue
}

@observer
export default class Lines extends React.Component<LinesProps> {
    base: React.RefObject<SVGGElement> = React.createRef()
    @observable.ref hover: HoverTarget | null = null

    @computed get renderUid(): number {
        return guid()
    }

    @computed get renderData(): LineRenderSeries[] {
        const { data, xScale, yScale, focusKeys } = this.props
        return map(data, series => {
            return {
                key: series.key,
                displayKey: `key-${makeSafeForCSS(series.key)}`,
                color: series.color,
                values: series.values.map(v => {
                    return new Vector2(Math.round(xScale.place(v.x)), Math.round(yScale.place(v.y)))
                }),
                isFocus: includes(focusKeys, series.key),
                isProjection: series.isProjection
            }
        })
    }

    @computed get isFocusMode(): boolean {
        return some(this.renderData, d => d.isFocus)
    }

    @computed get hoverData(): HoverTarget[] {
        const { data } = this.props
        return flatten(map(this.renderData, (series, i) => {
            return map(series.values, (v, j) => {
                return {
                    pos: v,
                    series: data[i],
                    value: data[i].values[j]
                }
            })
        }))
    }

    @action.bound onMouseMove(ev: React.MouseEvent<SVGGElement>) {
        const mouse = getRelativeMouse(this.base.current, ev)
        const { hoverData } = this

        const value = sortBy(hoverData, v => Vector2.distanceSq(v.pos, mouse))[0]
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
        const { xScale, yScale } = this.props
        return Bounds.fromCorners(new Vector2(xScale.range[0], yScale.range[0]),
            new Vector2(xScale.range[1], yScale.range[1]))
    }

    @computed get focusGroups() {
        return filter(this.renderData, g => g.isFocus)
    }

    @computed get backgroundGroups() {
        return filter(this.renderData, g => !g.isFocus)
    }

    // Don't display point markers if there are very many of them for performance reasons
    // Note that we're using circle elements instead of marker-mid because marker performance in Safari 10 is very poor for some reason
    @computed get hasMarkers(): boolean {
        return sum(this.renderData.map(g => g.values.length)) < 500
    }

    renderFocusGroups() {
        return map(this.focusGroups, series =>
            <g className={series.displayKey}>
                <path
                    stroke={series.color}
                    strokeLinecap="round"
                    d={pointsToPath(series.values.map(v => [v.x, v.y]) as [number, number][])}
                    fill="none"
                    strokeWidth={1.5}
                    stroke-dasharray={series.isProjection && "1,4"}
                />
                {this.hasMarkers && !series.isProjection && <g fill={series.color}>
                    {series.values.map(v => <circle cx={v.x} cy={v.y} r={2}/>)}
                </g>}
            </g>
        )
    }

    renderBackgroundGroups() {
        return map(this.backgroundGroups, series =>
            <g className={series.displayKey}>
                <path
                    key={series.key + '-line'}
                    strokeLinecap="round"
                    stroke="#ccc"
                    d={pointsToPath(series.values.map(v => [v.x, v.y]) as [number, number][])}
                    fill="none"
                    strokeWidth={1}
                />
            </g>
        )
    }

    render() {
        const { hover, bounds } = this

        return <g ref={this.base} className="Lines" onMouseMove={this.onMouseMove} onMouseLeave={this.onMouseLeave}>
            <rect x={Math.round(bounds.x)} y={Math.round(bounds.y)} width={Math.round(bounds.width)} height={Math.round(bounds.height)} fill="rgba(255,255,255,0)" opacity={0} />
            {this.renderBackgroundGroups()}
            {this.renderFocusGroups()}
            {hover && <circle cx={hover.pos.x} cy={hover.pos.y} r={5} fill={hover.series.color} />}
        </g>
    }
}
