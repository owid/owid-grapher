;(function(d3) {
    "use strict";
    owid.namespace("owid.control.mapWithTimeline");

    owid.control.mapWithTimeline = function(chart) {
        var control = owid.dataflow();

        control.requires('containerNode', 'bounds', 'colorData', 'years', 'inputYear', 'legendData', 'legendTitle');

        control.initial('map', function() { return owid.view.map(); });
        control.initial('legend', function() { return owid.view.mapLegend(); });
        control.initial('timeline', function() { 
            var timeline = owid.view.timeline(); 

            timeline.flow('targetYear', function(targetYear) {
                chart.map.set('targetYear', targetYear);
            });

            return timeline;
        });
                // Open the chart tab for a country when it is clicked (but not on mobile)
/*        function onMapClick(ev) {
            if ($('#chart').hasClass('mobile') || !_.includes(chart.model.get("tabs"), "chart")) return;

            d3.select(ev.target).each(function(d) {
                var entityName = d.id,
                    availableEntities = chart.vardata.get("availableEntities"),
                    entity = _.find(availableEntities, function(e) {
                        return owid.entityNameForMap(e.name) == d.id;
                    });

                if (!entity) return;
                chart.model.set({ "selected-countries": [entity] }, { silent: true });
                chart.data.chartData = null;
                chart.display.set({ activeTab: 'chart' });
                chart.url.updateCountryParam();
            });
        }

        function onMapHover(ev) {
            chart.tooltip.fromMap(ev, ev.target);
        }

        function onMapHoverStop(ev) {
            chart.tooltip.hide();
        }

        function initializeMap() {
            svg = d3.select('svg.datamap');

            chart.$('g.datamaps-subunits').on('click', 'path', onMapClick);
            chart.$('g.datamaps-subunits').on('mouseenter', 'path', onMapHover);
            chart.$('g.datamaps-subunits').on('mouseleave', 'path', onMapHoverStop);
        }*/


        control.flow('timeline, years, inputYear, containerNode, bounds', function(timeline, years, inputYear, containerNode, bounds) {
            timeline.update({
                years: years,
                inputYear: inputYear,
                containerNode: containerNode,
                outerBounds: bounds
            });
        });

        control.flow('boundsForMap : timeline, bounds', function(timeline, bounds) {
            return { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height-timeline.bounds.height };
        });

        control.flow('map, colorData, containerNode, boundsForMap', function(map, colorData, containerNode, boundsForMap) {
            map.update({ 
                colorData: colorData,
                containerNode: containerNode,
                bounds: boundsForMap,
                onHover: onHover,
                onHoverStop: onHoverStop,
                onClick: onClick
            });
        });

        control.flow('legend, legendData, legendTitle, containerNode, boundsForMap', function(legend, legendData, legendTitle, containerNode, boundsForMap) {
            legend.update({
                legendData: legendData,
                title: legendTitle,
                containerNode: containerNode,
                outerBounds: boundsForMap
            });
        });

        function onHover(d) {
            chart.tooltip.fromMap(d, d3.event);
        }

        function onHoverStop(d) {
            chart.tooltip.hide();
        }

        function onClick() {
            if (d3.select(chart.dom).classed('mobile') || !_.includes(chart.model.get("tabs"), "chart")) return;

            d3.select(ev.target).each(function(d) {
                var entityName = d.id,
                    availableEntities = chart.vardata.get("availableEntities"),
                    entity = _.find(availableEntities, function(e) {
                        return owid.entityNameForMap(e.name) == d.id;
                    });

                if (!entity) return;
                chart.model.set({ "selected-countries": [entity] }, { silent: true });
                chart.data.chartData = null;
                chart.display.set({ activeTab: 'chart' });
                chart.url.updateCountryParam();
            });
        }

        return control;
    };
})(d3v4);