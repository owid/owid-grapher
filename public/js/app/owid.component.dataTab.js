;(function() {	
	"use strict";
	owid.namespace("owid.component.dataTab");

	owid.component.dataTab = function(chart) {
		var dataTab = owid.dataflow();

		dataTab.isOverlay = true;

		dataTab.requires('containerNode', 'bounds', 'downloadUrl');

		dataTab.flow('el : containerNode', function(containerNode) {
			return d3.select(containerNode).append('div').attr('class', 'dataTab');
		});

		dataTab.flow('el, bounds', function(el, bounds) {
			el.style('position', 'absolute')
			  .style('left', bounds.left+'px')
			  .style('top', bounds.top+'px')
			  .style('width', bounds.width+'px')
			  .style('height', bounds.height+'px');
		});

		dataTab.flow('el, downloadUrl', function(el, downloadUrl) {
			var filename = downloadUrl.match(/\/([^\/]*)$/)[1];
			el.html(
				'<div>' +
					'<p>A CSV file is available containing all data used in this visualization.</p>' +
					'<a href="'+downloadUrl+'" class="btn btn-primary" target="_blank"><i class="fa fa-download"></i> Download '+filename+'</a>' +
				'</div>'
			);
		});

		dataTab.render = function(bounds) {
			bounds = bounds.scale(chart.scale);

			dataTab.update({
				containerNode: chart.htmlNode,
				bounds: bounds,
				downloadUrl: Global.rootUrl+'/'+chart.model.get('chart-slug')+'.csv'
			});
		};

		dataTab.beforeClean(function() {
			if (dataTab.el) dataTab.el.remove();
		});

		return dataTab;
	};
})();