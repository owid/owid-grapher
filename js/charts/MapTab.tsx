import * as _ from 'lodash'
import * as React from 'react'
import * as d3 from 'd3'
import Bounds from './Bounds'
import {observable, computed, action} from 'mobx'
import {observer} from 'mobx-react'
import ChoroplethMap, {ChoroplethData, ChoroplethDatum, GeoFeature, MapBracket, MapEntity} from './ChoroplethMap'
import Timeline from './Timeline'
import MapLegend from './MapLegend'
import {getRelativeMouse, preInstantiate, entityNameForMap} from './Util'
import Header from './Header'
import SourcesFooter from './SourcesFooter'
import ChartConfig from './ChartConfig'
import MapConfig from './MapConfig'
import {MapLegendBin} from './MapData'
import MapProjection from './MapProjection'
import ChartView from './ChartView'
import Tooltip from './Tooltip'
import NoData from './NoData'

interface TimelineMapProps {
    bounds: Bounds,
    choroplethData: ChoroplethData,
    years: number[],
    inputYear: number,
    legendData: MapLegendBin[],
    legendTitle: string,
    projection: MapProjection,
    defaultFill: string
}

@observer
class TimelineMap extends React.Component<TimelineMapProps> {
    @observable focusEntity: any = null
    @observable.ref tooltip: React.ReactNode|null = null

    context: { chartView: ChartView, chart: ChartConfig }

    base: SVGGElement
    @action.bound onMapMouseOver(d: GeoFeature, ev: React.MouseEvent<SVGPathElement>) {
        const datum = d.id == undefined ? undefined : this.props.choroplethData[d.id]
        this.focusEntity = { id: d.id, datum: datum || { value: "No data" } }
        const {chart} = this.context

/*#chart .owid-tooltip {
    font-size: 1em;
    background: white;
    border: 1px solid rgba(0, 0, 0, 0.2);
    pointer-events: none;
}
#chart .owid-tooltip h3 {
    padding: 0.3em 0.9em;
    font-size: 1em;
    margin: 0;
    line-height: 18px;
    font-weight: normal;
    background-color: rgba(247,247,247,0.75);
    text-align: center;
    border-bottom: 1px solid #ebebeb;
}
#chart .owid-tooltip p {
    font-size: 0.8em;
    padding: 0.3em 0.9em;
    margin: 0;
}*/

        const mouse = getRelativeMouse(this.base, ev)
        if (datum) {
            this.tooltip = <Tooltip x={mouse.x} y={mouse.y}>
                <h3 style={{padding: "0.3em 0.9em", margin: 0, backgroundColor: "#fcfcfc", borderBottom: "1px solid #ebebeb", fontWeight: "normal", fontSize: "1em"}}>{datum.entity}</h3>
                <p style={{textAlign: "center", margin: 0, padding: "0.3em 0.9em", fontSize: "0.8em"}}>
                    <span>{chart.yAxis.tickFormat(datum.value as number)}</span><br/>
                    in<br/>
                    <span>{datum.year}</span>
                </p>
            </Tooltip>
        }
    }

    @action.bound onMapMouseLeave() {
        this.focusEntity = null
        //this.tooltip = null
//        this.context.chartView.tooltip.hide();
    }

    @action.bound onClick(d: GeoFeature) {
        const {chartView, chart} = this.context

        if (chartView.isMobile || !chart.hasChartTab || !d.id) return;
        const entity = this.props.choroplethData[d.id].entity
        
        chart.tab = 'chart'
        chart.data.selectedKeys = chart.data.availableKeysByEntity.get(entity)||[]
    }

    componentDidMount() {
        // Nice little intro animation
        //d3.select(this.base).attr('opacity', 0).transition().attr('opacity', 1)
    }

    componentWillUnmount() {
        this.onMapMouseLeave()
        this.onLegendMouseLeave()
    }

    @observable focusBracket: MapBracket
    @action.bound onLegendMouseOver(d: MapEntity) {
        this.focusBracket = d
    }

    @action.bound onTargetChange({targetStartYear}: {targetStartYear: number}) {
        this.context.chart.map.targetYear = targetStartYear
    }

    @action.bound onLegendMouseLeave() {
        this.focusBracket = null
    }

    @computed get timeline() {
        if (this.props.years.length <= 1 || this.context.chartView.isExport) return null

        const {years, inputYear} = this.props

        return preInstantiate(<Timeline bounds={this.props.bounds.fromBottom(35)} onTargetChange={this.onTargetChange} years={years} startYear={inputYear} endYear={inputYear} singleYearMode={true}/>)
    }

    @computed get timelineHeight() {
        return this.timeline ? this.timeline.height : 10
    }

    @computed get mapLegend() {
        const {legendData, legendTitle} = this.props
        const {focusBracket, focusEntity, timelineHeight} = this
        return preInstantiate(<MapLegend bounds={this.props.bounds.padBottom(timelineHeight+5)} legendData={legendData} title={legendTitle} focusBracket={focusBracket} focusEntity={focusEntity} onMouseOver={this.onLegendMouseOver} onMouseLeave={this.onLegendMouseLeave}/>)
    }

    render() {
        const { choroplethData, projection, defaultFill, legendTitle, legendData } = this.props
        let { bounds } = this.props
        const {focusBracket, focusEntity, timeline, timelineHeight, mapLegend, tooltip} = this
        return <g className="mapTab">
            {/*<rect x={bounds.left} y={bounds.top} width={bounds.width} height={bounds.height-timelineHeight} fill="#ecf6fc"/>*/}
            <ChoroplethMap bounds={bounds.padBottom(timelineHeight+mapLegend.height+15)} choroplethData={choroplethData} projection={projection} defaultFill={defaultFill} onHover={this.onMapMouseOver} onHoverStop={this.onMapMouseLeave} onClick={this.onClick} focusBracket={focusBracket} focusEntity={focusEntity}/>
            <MapLegend {...mapLegend.props}/>
            {timeline && <Timeline {...timeline.props}/>}
            {tooltip}
        </g>
    }
}

interface MapTabProps {
    chart: ChartConfig,
    bounds: Bounds
}

@observer
export default class MapTab extends React.Component<MapTabProps> {
    @computed get map(): MapConfig { return (this.props.chart.map as MapConfig) }

    @computed get header() {
        const _this = this
        return new Header({
            get chart() { return _this.props.chart },
            get maxWidth() { return _this.props.bounds.width },
            get minYear() { return _this.map.data.targetYear },
            get maxYear() { return _this.map.data.targetYear }
        })
    }

    @computed get footer() {
        const _this = this
        return new SourcesFooter({
            get chart() { return _this.props.chart },
            get maxWidth() { return _this.props.bounds.width }
        })
    }

    render() {
        const {map} = this
        if (!map.data.isReady)
            return <NoData bounds={this.props.bounds}/>
        
        const {bounds} = this.props
        const {header, footer} = this

        return <g className="mapTab">
            {header.render(bounds.x, bounds.y)}
            <TimelineMap
                bounds={bounds.padTop(header.height+5).padBottom(footer.height)}
                choroplethData={map.data.choroplethData}
                years={map.data.years}
                inputYear={map.data.targetYear}
                legendData={map.data.legendData}
                legendTitle={map.data.legendTitle}
                projection={map.projection}
                defaultFill={map.noDataColor}
            />
            {footer.render(bounds.x, bounds.bottom-footer.height)}
        </g>

    }
}