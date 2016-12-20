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
                bounds: boundsForMap
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


        return control;
    };
})(d3v4);