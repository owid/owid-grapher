// @flow

import * as _ from '../libs/underscore'
import * as d3 from '../libs/d3.v4'
import owid from '../owid'
import dataflow from './owid.dataflow'
import Bounds from './Bounds'
import React, { Component } from 'react'
import { render } from 'preact'
import { observable, computed, asFlat } from 'mobx'
import { bind } from 'decko'
import type ChoroplethData from './ChoroplethMap'
import type MapProjection from './ChoroplethMap'
import ChoroplethMap from './ChoroplethMap'
import Timeline from './Timeline'
import Layout from './Layout'
import {MapLegend} from './MapLegend'

type MapLegendData = any;

function layout(containerBounds : Bounds, ...children) {
    children = _.map(children, (vnode) => {
        if (vnode.nodeName.calculateBounds) {
            const bounds = vnode.nodeName.calculateBounds(containerBounds, vnode.attributes)
            if (vnode.attributes.layout == 'bottom') {
                containerBounds = containerBounds.padBottom(bounds.height)
            }
            return cloneElement(vnode, { bounds: bounds })
        } else {
            return vnode
        }
    })

    children = _.map(children, (vnode) => {
        if (!vnode.attributes.bounds) {
            return cloneElement(vnode, { bounds: containerBounds })
        } else {
            return vnode
        }
    })

    return children
}

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
        this.legend = owid.view.mapLegend()
    }

/*    @computed get boundsForMap() : Bounds {
        const { bounds } = this.props
        return new Bounds(bounds.left, bounds.top, bounds.width, bounds.height-40)
//        return new Bounds(bounds.left, bounds.top, bounds.width, bounds.height-(timeline.isClean ? 10 : timeline.bounds.height));        
    }*/

    componentDidMount() {
        this.componentDidUpdate()
    }

    componentDidUpdate() {
        const { choroplethData, projection, defaultFill, inputYear } = this.props
        const { chart } = this

        function onHover(d) {
            chart.tooltip.fromMap(d, d3.event);
        }

        function onHoverStop(d) {
            chart.tooltip.hide();
        }

        function onClick(d) {
            if (d3.select(chart.dom).classed('mobile') || !_.includes(chart.model.get("tabs"), "chart")) return;

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
        
        this.updateLegend()
    }

    updateLegend() {
        const { legendData, legendTitle } = this.props
        const { legend, g } = this

/*        legend.update({
            legendData: legendData,
            title: legendTitle,
            containerNode: g,
            outerBounds: boundsForMap
        });*/
    }

    componentDidUnmount() {        
        const { legend } = this
        legend.clean();
    }

    @bind
    onTargetChange(targetYear) {
        const { chart } = this
        chart.map.set('targetYear', targetYear)
    }

    render() {
/*        map.update({ 
            containerNode: this.g,
            colorData: choroplethData,
            bounds: boundsForMap,
            projection: projection,
            defaultFill: defaultFill,
            onHover: onHover,
            onHoverStop: onHoverStop,
            onClick: onClick
        });*/

        const { bounds, choroplethData, projection, defaultFill, years, inputYear, legendTitle, legendData } = this.props
        return <Layout bounds={bounds} class="mapTab" ref={g => this.g = g}>
            <ChoroplethMap choroplethData={choroplethData} projection={projection} defaultFill={defaultFill}/>,
            <MapLegend legendData={legendData} title={legendTitle}/>
            <Timeline layout="bottom" onTargetChange={this.onTargetChange} years={years} inputYear={inputYear}/>
        </Layout>
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
    };

    return mapTab;
};