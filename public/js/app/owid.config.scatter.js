;(function(d3) {
    "use strict";

    owid.namespace("owid.config.scatter");

    owid.config.scatter = function(chart) {
        var config = owid.dataflow();

        config.inputs({
            formNode: undefined
        });

        config.flow('tab : formNode', function(formNode) {
            var form = d3.select(formNode);

            if (form.select('.scatter-item').empty()) {
                form.select('.nav-tabs').append('li')
                    .attr('class', 'nav-item scatter-item')
                    .append('a')
                      .attr('class', 'nav-link')
                      .attr('data-toggle', 'tab')
                      .attr('href', '#scatter-tab')
                      .text('Scatter');
            }

            if (form.select('#scatter-tab').empty()) {
                form.select('.tab-content').append('div')
                    .attr('id', 'scatter-tab')
                    .attr('class', 'tab-pane');
            }

            return form.select('#scatter-tab').selectAll('*').remove();
        });

        config.flow('')

        chart.model.on('change', function() {

        });
        
        return config;
    }
})(d3v4);