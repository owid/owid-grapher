// @flow

import * as _ from '../libs/underscore'
import * as d3 from '../libs/d3.v4'
import owid from '../owid'
import dataflow from './owid.dataflow'
import Bounds from './bounds'
import { h, render, Component } from 'preact'
import { observable, computed, asFlat } from 'mobx'
import type ChoroplethData from './ChoroplethMap'
import type MapProjection from './ChoroplethMap'
import ChoroplethMap from './ChoroplethMap'

type MapLegendData = any;

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

    timeline: any
    legend: any
    g: any
    chart: any

    constructor() {
        super()
        let chart = window.chart
        this.chart = chart
        this.timeline = owid.view.timeline()
        this.legend = owid.view.mapLegend()


        this.timeline.flow('targetYear', function(targetYear) {
            chart.map.set('targetYear', targetYear);
        });

        // hack to make header update disclaimer
        this.timeline.flow('isPlaying, isDragging', function(isPlaying, isDragging) {
            chart.render();
        });
    }

    @computed get boundsForMap() : Bounds {
        const { bounds } = this.props
        const { timeline } = this
        return new Bounds(bounds.left, bounds.top, bounds.width, bounds.height-(timeline.isClean ? 10 : timeline.bounds.height));        
    }

    componentDidMount() {
        this.componentDidUpdate()
    }

    componentDidUpdate() {
        const { choroplethData, projection, defaultFill, inputYear } = this.props
        const { chart, boundsForMap } = this

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
        

        const { years, bounds } = this.props
        const { timeline, g } = this
        if (years.length <= 1) {
            timeline.clean();
            return;
        }

        var changes = {
            years: years,
            containerNode: g,
            outerBounds: bounds
        };

        if (!timeline.isPlaying && !timeline.isDragging)
            changes.inputYear = inputYear;

        timeline.update(changes);     

        this.updateLegend()
    }

    updateLegend() {
        const { legendData, legendTitle } = this.props
        const { legend, g, boundsForMap } = this

        legend.update({
            legendData: legendData,
            title: legendTitle,
            containerNode: g,
            outerBounds: boundsForMap
        });
    }    

    componentDidUnmount() {        
        const { timeline, legend } = this
        timeline.clean();
        legend.clean();
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

        const { choroplethData, projection, defaultFill } = this.props
        const { boundsForMap } = this

        return <g class="mapTab" ref={g => this.g = g}>
            <ChoroplethMap choroplethData={choroplethData} bounds={boundsForMap} projection={projection} defaultFill={defaultFill}></ChoroplethMap>
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

        rootNode = render(<MapTab bounds={bounds} choroplethData={chart.mapdata.currentValues} years={chart.map.getYears()} inputYear={chart.map.get('targetYear')} legendData={chart.mapdata.legendData} legendTitle={chart.mapdata.legendTitle} projection={chart.map.get('projection')} defaultFill={chart.mapdata.getNoDataColor()} />, chart.svg.node(), rootNode)
    };

    return mapTab;
};