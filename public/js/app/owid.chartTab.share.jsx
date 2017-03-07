import * as d3 from 'd3'
import Bounds from './Bounds'

owid.namespace("owid.component.shareTab");

owid.view.shareMenu = function() {
    var shareMenu = owid.dataflow();

    shareMenu.requires('containerNode, bounds');

    shareMenu.flow('el : containerNode', function(containerNode) {
        return d3.select(containerNode).append('div').attr('class', 'shareMenu');
    });

    shareMenu.flow('el, bounds', function(el, bounds) {
        el.style('position', 'absolute')
          .style('left', bounds.left+'px')
          .style('top', bounds.top+'px')
          .style('width', bounds.width+'px')
          .style('height', bounds.height+'px');
    });



    return shareMenu;
};

owid.component.shareTab = function(chart) {
    var shareTab = owid.dataflow();

    shareTab.initial('shareMenu', function() { return owid.view.shareMenu(); });

    shareTab.render = function(bounds) {
        shareTab.shareMenu.update({
            containerNode: chart.htmlNode,
            bounds: new Bounds(bounds.left*chart.scale, bounds.top*chart.scale, bounds.width*chart.scale, bounds.height*chart.scale)
        });
    };

    return shareTab;
};