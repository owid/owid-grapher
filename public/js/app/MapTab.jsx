// @flow

import * as _ from 'underscore'
import * as d3 from 'd3'
import owid from '../owid'
import dataflow from './owid.dataflow'
import Bounds from './Bounds'
import React, { Component } from 'react'
import { render } from 'preact'
import { observable, computed, asFlat, action } from 'mobx'
import {observer} from 'mobx-react'
import type ChoroplethData from './ChoroplethMap'
import type MapProjection from './ChoroplethMap'
import ChoroplethMap from './ChoroplethMap'
import Timeline from './Timeline'
import Layout from './Layout'
import MapLegend from './MapLegend'
import {preInstantiate, cacheChild} from './Util'

type MapLegendData = any;

@observer
class MapTab extends Component {
    props: {
        bounds: Bounds,
        choroplethData: ChoroplethData,
        years: number[],
        inputYear: number,
        legendData: MapLegendData,
        legendTitle: string,
        projection: MapProjection,
        defaultFill: string
    }

    legend: any
    g: any
    chart: any

    constructor() {
        super()
        let chart = window.chart
        this.chart = chart
    }

    componentDidMount() {
        this.componentDidUpdate()
    }

    componentDidUpdate() {
        const { choroplethData, projection, defaultFill, inputYear } = this.props
        const { chart } = this
    }

    @observable focusEntity
    @action.bound onMapMouseOver(d, ev) {
        this.focusEntity = this.props.choroplethData[d.id]
        this.chart.tooltip.fromMap(d, ev);
    }

    @action.bound onMapMouseLeave(d) {
        this.focusEntity = null
        this.chart.tooltip.hide();
    }

    @action.bound onClick(d) {
        const {chart} = this
        if (chart.isMobile || !_.includes(chart.model.get("tabs"), "chart")) return;

        var entityName = d.id,
            availableEntities = chart.vardata.get("availableEntities"),
            entity = _.find(availableEntities, function(e) {
                return owid.entityNameForMap(e.name) == d.id;
            });

        if (!entity) return;
        chart.model.set({ "selected-countries": [entity] }, { silent: true });
        chart.data.chartData = null;
        chart.update({ activeTabName: 'chart' });
        chart.url.updateCountryParam();
    }


    componentDidUnmount() {
        this.onMapMouseLeave()
        this.onLegendMouseLeave()
    }

    @action.bound onTargetChange(targetYear) {
        this.chart.map.set('targetYear', targetYear)
    }

    @observable focusBracket
    @action.bound onLegendMouseOver(d) {
        this.focusBracket = d
    }
    @action.bound onLegendMouseLeave() {
        this.focusBracket = null
    }


    @computed get timeline() {
        if (this.props.years.length <= 1 || window.chart.isExport) return null
        const {years, inputYear} = this.props

        return cacheChild(this, 'timeline', <Timeline bounds={this.props.bounds.fromBottom(45)} onTargetChange={this.onTargetChange} years={years} inputYear={inputYear}/>)
    }


    @computed get timelineHeight() {
        return this.timeline ? this.timeline.height : 10
    }

    @computed get mapLegend() {
        const {legendData, legendTitle} = this.props
        const {focusBracket, focusEntity, timelineHeight} = this
        return cacheChild(this, 'mapLegend', <MapLegend bounds={this.props.bounds.padBottom(timelineHeight)} legendData={legendData} title={legendTitle} focusBracket={focusBracket} focusEntity={focusEntity} onMouseOver={this.onLegendMouseOver} onMouseLeave={this.onLegendMouseLeave}/>)
    }

    render() {
        const { choroplethData, projection, defaultFill, legendTitle, legendData } = this.props
        let { bounds } = this.props
        const {focusBracket, focusEntity, timeline, timelineHeight, mapLegend} = this
        this.chart.tabs.map.timeline = timeline // XXX

        return <g class="mapTab" ref={g => this.g = g}>
            <ChoroplethMap bounds={bounds.padBottom(timelineHeight+mapLegend.height)} choroplethData={choroplethData} projection={projection} defaultFill={defaultFill} onHover={this.onMapMouseOver} onHoverStop={this.onMapMouseLeave} onClick={this.onClick} focusBracket={focusBracket}/>,
            <MapLegend instance={mapLegend} {...mapLegend.props}/>
            {timeline && <Timeline instance={timeline} />}
        </g>
    }
}

export default function(chart : any) {
    var mapTab = owid.dataflow();

    let rootNode = null

    mapTab.render = function(bounds) {
        if (!chart.map.getVariable()) {
            chart.showMessage("No variable selected for map.");
            return;
        }

        chart.mapdata.update();

        rootNode = render(<MapTab bounds={bounds} choroplethData={chart.mapdata.currentValues} years={chart.map.getYears()} inputYear={+chart.map.get('targetYear')} legendData={chart.mapdata.legendData} legendTitle={chart.mapdata.legendTitle} projection={chart.map.get('projection')} defaultFill={chart.mapdata.getNoDataColor()} />, chart.svg.node(), rootNode)
        chart.dispatch.call('renderEnd');
    };

    mapTab.beforeClean(function() {
        rootNode = render(() => null, chart.svg.node(), rootNode)
    })

    return mapTab;
};
