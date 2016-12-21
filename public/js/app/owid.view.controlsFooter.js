;(function(d3) {    
    "use strict";
    owid.namespace("owid.view.controlsFooter");

    owid.view.controlsFooter = function() {
        var footer = owid.dataflow();

        footer.requires('containerNode', 'outerBounds', 'tabNames', 'activeTabName');

        footer.flow('el : containerNode', function(containerNode) {
            return d3.select(containerNode).append('div').attr('class', 'controls-footer');
        });

        footer.flow('nav : el', function(el) {
            return el.append('nav').attr('class', 'tabs');
        });

        footer.flow('tabs : nav, tabNames', function(nav, tabNames) {
            var tabsUpdate = nav.selectAll('li').data(tabNames);

            var tabs = tabsUpdate
                .enter()
                  .append('li')
                  .attr('class', 'tab clickable')
                  .merge(tabsUpdate);

            tabs.text(function(d) { return d; });

            return tabs;
        });

        footer.flow('tabs, activeTabName', function(tabs, activeTabName) {
            tabs.classed('active', function(d) { return d == activeTabName; });
        });

        footer.flow('tabs', function(tabs) {
            tabs.on('click', function(tabName) {
                footer.update({ activeTabName: tabName });
            });
        });

        footer.flow('height : el, nav, tabs', function(el) {
            return el.node().getBoundingClientRect().height;
        });

        footer.flow('activeTabName', function(activeTabName) {
            chart.update({ activeTabName: activeTabName });
        });

        footer.render = function(bounds) {
            footer.update({
                containerNode: chart.el.node(),
                outerBounds: bounds,
                tabNames: chart.model.get('tabs'),
                activeTabName: chart.activeTabName
            });
        };

        return footer;
    };
})(d3v4);