;(function(d3) {    
    "use strict";
    owid.namespace("owid.view.controlsFooter");

    owid.view.controlsFooter = function() {
        var footer = owid.dataflow();

        footer.requires('containerNode', 'tabNames', 'activeTabName', 'shareMenu');
        footer.defaults({ editUrl: null, dispatch: d3.dispatch('moreActions') });

        footer.flow('el : containerNode', function(containerNode) {
            return d3.select(containerNode).append('div').attr('class', 'controlsFooter');
        });

        footer.flow('nav : el', function(el) {
            return el.append('nav').attr('class', 'tabs').append('ul');
        });

        footer.flow('tabs : nav, tabNames', function(nav, tabNames) {            
            nav.selectAll('*').remove();

            tabNames = _.sortBy(tabNames, function(name) {
                return {
                    chart: 1,
                    map: 2                    
                }[name] || 3;
            });

            var tabs = nav.selectAll('li.tab').data(tabNames)
                .enter()
                  .append('li')
                  .attr('class', 'tab clickable')
                  .html(function(d) { return '<a>'+d+'</a>'; });

            tabs.on('click', function(d) {
                chart.update({ activeTabName: d});
            });

            var moreActions = nav.append('li').attr('class', 'clickable')
                .html('<a><i class="fa fa-ellipsis-v"></i></a>');

            moreActions.on('click', function() {
                footer.dispatch.call('moreActions');                
            });

            return tabs;
        });

        footer.flow('tabs, activeTabName', function(tabs, activeTabName) {
            tabs.classed('active', function(d) { return d == activeTabName; });
        });

        footer.flow('height : el, nav, tabs', function(el) {
            return el.node().getBoundingClientRect().height/chart.scale;
        });

        /*footer.flow('editBtn : nav, editUrl', function(nav, editUrl) {
            if (editUrl)
                return nav.append('li').attr('class', 'edit clickable').html(
                    '<a target="_blank" href="'+editUrl+'">' +
                        '<i class="fa fa-pencil"></i>' +
                    '</a>'
                );
        });*/

        var shareMenu;
        footer.render = function(bounds) {
            footer.update({
                containerNode: chart.el.node(),
                tabNames: chart.model.get('tabs'),
                activeTabName: chart.activeTabName,
            });

            footer.dispatch.on('moreActions', function() {
                footer.toggleChild('shareMenu', owid.view.shareMenu, function(shareMenu) {
                    shareMenu.update({
                        containerNode: chart.htmlNode,
                        title: document.title.replace(" - Our World In Data", ""),
                        baseUrl: Global.rootUrl + '/' + chart.model.get('chart-slug'),
                        queryStr: chart.url.lastQueryStr||"",
                        cacheTag: chart.model.get("variableCacheTag"),
                        editUrl: Cookies.get('isAdmin') ? (Global.rootUrl + '/charts/' + chart.model.get('id') + '/edit') : null,                        
                    });                    
                });
            });
        };

        return footer;
    };
})(d3v4);