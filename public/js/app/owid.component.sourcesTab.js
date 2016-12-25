;(function() {	
	"use strict";
	owid.namespace("owid.component.sourcesTab");

	owid.component.sourcesTab = function(chart) {
		var sourcesTab = owid.dataflow();

		sourcesTab.isOverlay = true;

		sourcesTab.needs('containerNode', 'bounds', 'sources');

		sourcesTab.flow('el : containerNode', function(containerNode) {
			return d3.select(containerNode).append('div').attr('class', 'sourcesTab');
		});

		sourcesTab.flow('el, bounds', function(el, bounds) {
			el.style('position', 'absolute')
			  .style('left', bounds.left+'px')
			  .style('top', bounds.top+'px')
			  .style('width', bounds.width+'px')
			  .style('height', bounds.height+'px');
		});

		sourcesTab.flow('innerEl : el', function(el) {
			return el.append('div');
		});

		sourcesTab.flow('innerEl, sources', function(innerEl, sources) {
			var html = "<h2>Sources</h2>";
			_.each(sources, function(source) {
				html += source.description;
			});
			innerEl.html(html);
		});

		sourcesTab.beforeClean(function() {
			if (sourcesTab.el) sourcesTab.el.remove();
		});

		sourcesTab.render = function(bounds) {
			sourcesTab.update({
				containerNode: chart.htmlNode,
				bounds: bounds.scale(chart.scale),
				sources: chart.data.transformDataForSources()
			});
		};

		return sourcesTab;
	};
})();