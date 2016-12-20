;(function(d3) {
    "use strict";
    owid.namespace("owid.control.mapWithTimeline");

    owid.control.mapWithTimeline = function(chart) {
        var control = owid.dataflow();

        control.requires('containerNode', 'bounds', 'colorData', 'years', 'inputYear');

        control.initial('map', function() { return owid.view.map(); });
        control.initial('timeline', function() { 
            var timeline = owid.view.timeline(); 

            timeline.flow('targetYear', function(targetYear) {
                chart.map.set('targetYear', targetYear);
            });

            return timeline;
        });

        control.flow('timeline, containerNode, bounds, years', function(timeline, containerNode, bounds, years, inputYear) {
            timeline.update({
                containerNode: containerNode,
                outerBounds: bounds,
                years: years,
                inputYear: inputYear
            });
        });

        control.flow('boundsForMap : timeline, bounds', function(timeline, bounds) {
            return { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height-timeline.bounds.height };
        });

        control.flow('map, containerNode, boundsForMap, colorData', function(map, containerNode, boundsForMap, colorData) {
            map.update({ 
                containerNode: containerNode,
                bounds: boundsForMap,
                colorData: colorData
            });
        });

        return control;
    };
})(d3v4);