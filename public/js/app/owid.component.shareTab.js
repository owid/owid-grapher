;(function(d3) {    
    "use strict";
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

        shareMenu.flow('el', function(el) {
            el.html(
                '<button class="btn-facebook">' +
                '<button class="btn-twitter">' +
                '<button class="'
            )
        });

        return shareMenu;
    };

    owid.component.shareTab = function(chart) {
        var shareTab = owid.dataflow();

        shareTab.initial('shareMenu', function() { return owid.view.shareMenu(); });

            var headerText = d3.select("title").text().replace(" - Our World In Data", ""),
                baseUrl = Global.rootUrl + "/" + App.ChartModel.get("chart-slug"),
                queryParams = owid.getQueryParams(),
                queryStr = owid.queryParamsToStr(queryParams),              
                tab = chart.activeTabName,
                canonicalUrl = baseUrl + queryStr,
                version = App.ChartModel.get("variableCacheTag");

        shareTab.render = function(bounds) {
            shareTab.shareMenu.update({
                containerNode: chart.htmlNode,
                bounds: owid.bounds(bounds.left*chart.scale, bounds.top*chart.scale, bounds.width*chart.scale, bounds.height*chart.scale),
                title: document.title.replace(" - Our World In Data", "")
            });
        };

        return shareTab;
    };
})(d3v4);