import * as _ from 'lodash'
import * as React from 'react'
import * as d3 from 'd3'
import Bounds from './Bounds'
import {observable, computed, action} from 'mobx'
import {observer} from 'mobx-react'
import ChoroplethMap, {ChoroplethData, MapProjection, GeoFeature, MapBracket, MapEntity} from './ChoroplethMap'
import Timeline from './Timeline'
import MapLegend, {MapLegendBin} from './MapLegend'
import {preInstantiate, entityNameForMap} from './Util'
import Header from './Header'
import SourcesFooter from './SourcesFooter'
import ChartConfig from './ChartConfig'

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
class TimelineMap extends React.Component<TimelineMapProps, null> {
    @observable focusEntity: any = null

    @action.bound onMapMouseOver(d: GeoFeature, ev: React.MouseEvent<SVGPathElement>) {
        const datum = this.props.choroplethData[d.id]
        this.focusEntity = { id: d.id, datum: datum || { value: "No data" } }

        this.context.chartView.tooltip.fromMap(d, ev);
    }

    @action.bound onMapMouseLeave() {
        this.focusEntity = null
        this.context.chartView.tooltip.hide();
    }

    @action.bound onClick(d: GeoFeature) {
        const {chartView} = this.props
        if (chartView.isMobile || !_.includes(chartView.model.get("tabs"), "chart")) return;

        var entityName = d.id,
            availableEntities = chartView.vardata.get("availableEntities"),
            entity = _.find(availableEntities, function(e: any) {
                return entityNameForMap(e.name) == d.id;
            });

        if (!entity) return;
        chartView.model.set({ "selected-countries": [entity] }, { silent: true });
        chartView.data.chartData = null;
        chartView.update({ activeTabName: 'chart' });
        chartView.url.updateCountryParam();
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

    @action.bound onTargetChange(targetYear: number) {
        this.context.chartView.map.set('targetYear', targetYear)
    }

    @action.bound onLegendMouseLeave() {
        this.focusBracket = null
    }

    @computed get timeline() {
        if (this.props.years.length <= 1 || this.context.chartView.isExport) return null

        const {years, inputYear} = this.props

        return preInstantiate(<Timeline bounds={this.props.bounds.fromBottom(35)} onTargetChange={this.onTargetChange} years={years} inputYear={inputYear}/>)
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
        const {focusBracket, focusEntity, timeline, timelineHeight, mapLegend} = this

        return <g className="mapTab">
            {/*<rect x={bounds.left} y={bounds.top} width={bounds.width} height={bounds.height-timelineHeight} fill="#ecf6fc"/>*/}
            <ChoroplethMap bounds={bounds.padBottom(timelineHeight+mapLegend.height+15)} choroplethData={choroplethData} projection={projection} defaultFill={defaultFill} onHover={this.onMapMouseOver} onHoverStop={this.onMapMouseLeave} onClick={this.onClick} focusBracket={focusBracket} focusEntity={focusEntity}/>,
            <MapLegend {...mapLegend.props}/>
            {timeline && <Timeline {...timeline.props}/>}
        </g>
    }
}

interface MapTabProps {
    chartView: any,
    bounds: Bounds
}

export default class MapTab extends React.Component<MapTabProps, null> {
    @computed get header() {
        const {props} = this
        const {bounds, chart} = props

        const targetYear = this.context.chartView.map.get('targetYear')

        return preInstantiate(<Header
            bounds={bounds}
            titleTemplate={chart.title}
            subtitleTemplate={chart.subtitle}
            logosSVG={chart.logosSVG}
            entities={chart.selectedEntities}
            entityType={chart.entityType}
            minYear={targetYear}
            maxYear={targetYear}
        />)
    }

    @computed get footer() {
        const {props} = this
        const {chart} = props

        return preInstantiate(<SourcesFooter
            bounds={props.bounds}
            chartView={props.chartView}
            note={chart.note}
            originUrl={chart.originUrl}
         />)
    }

    render() {
        const {chartView, bounds} = this.props
        const {header, footer} = this

        return <g class="mapTab">
            <Header {...header.props}/>
            <TimelineMap
                chartView={chartView}
                bounds={bounds.padTop(header.height).padBottom(footer.height)}
                choroplethData={chartView.mapdata.currentValues}
                years={chartView.map.getYears()}
                inputYear={+chartView.map.get('targetYear')}
                legendData={chartView.mapdata.legendData}
                legendTitle={chartView.mapdata.legendTitle}
                projection={chartView.map.get('projection')}
                defaultFill={chartView.mapdata.getNoDataColor()}
            />
            <SourcesFooter {...footer.props}/>
        </g>

    }
}

/*export default function(chart : any) {
    var mapTab = dataflow();

    let rootNode = null

    mapTab.render = function(bounds) {
        if (!chart.map.getVariable()) {
            chart.showMessage("No variable selected for map.");
            return;
        }


        chart.dispatch.call('renderEnd');
    };

    mapTab.beforeClean(function() {
        rootNode = render(() => null, chart.svg.node(), rootNode)
    })

    return mapTab;
};
*/
