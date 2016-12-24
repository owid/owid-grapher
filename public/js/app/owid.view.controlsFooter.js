;(function(d3) {    
    "use strict";
    owid.namespace("owid.view.controlsFooter");

    owid.view.controlsFooter = function() {
        var footer = owid.dataflow();

        footer.requires('containerNode', 'outerBounds', 'tabNames', 'activeTabName');
        footer.defaults({ editUrl: null });

        footer.flow('el : containerNode', function(containerNode) {
            return d3.select(containerNode).append('div').attr('class', 'controlsFooter');
        });

        footer.flow('nav : el', function(el) {
            return el.append('nav').attr('class', 'tabs').append('ul');
        });

        footer.flow('tabs : nav, tabNames', function(nav, tabNames) {            
            nav.selectAll('li').remove();

            var tabs = nav.selectAll('li').data(tabNames)
                .enter()
                  .append('li')
                  .attr('class', 'tab clickable')
                  .html(function(d) { return '<a>'+d+'</a>'; });

            return tabs;
        });

        footer.flow('tabs, activeTabName', function(tabs, activeTabName) {
            tabs.classed('active', function(d) { return d == activeTabName; });
        });

        footer.flow('height : el, nav, tabs', function(el) {
            return el.node().getBoundingClientRect().height/chart.scale;
        });

        footer.flow('tabs', function(tabs) {
            tabs.on('click', function(d) { 
                chart.update({ activeTabName: d });
            });
        });

        footer.flow('editBtn : nav, tabs, editUrl', function(nav, tabs, editUrl) {
            nav.selectAll('li.edit').remove();
            if (editUrl)
                return nav.append('li').attr('class', 'edit clickable').html(
                    '<a target="_blank" href="'+editUrl+'">' +
                        '<i class="fa fa-pencil"></i>' +
                    '</a>'
                );
        });

        footer.render = function(bounds) {
            footer.update({
                containerNode: chart.el.node(),
                outerBounds: bounds,
                tabNames: chart.model.get('tabs').concat(['share']),
                activeTabName: chart.activeTabName,
                editUrl: Cookies.get('isAdmin') ? (Global.rootUrl + '/charts/' + chart.model.get('id') + '/edit') : null
            });
        };

        return footer;
    };
})(d3v4);