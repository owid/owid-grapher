import dataflow from './owid.dataflow'
import owid from '../owid'
import _ from 'lodash'

var scaleSelector = function() {
	var scaleSelector = dataflow();

	scaleSelector.needs('containerNode', 'left', 'top');
	scaleSelector.defaults({ currentScale: 'linear' });

	scaleSelector.flow('el : containerNode', function(containerNode) {
		var el = d3.select(containerNode).append('button').attr('class', 'scaleSelector')
			.html('<i class="fa fa-cog"></i> <span></span>');

		el.on('click', function() {
			scaleSelector.now('currentScale', function(currentScale) {
				if (currentScale == "log") 
					scaleSelector.update({ currentScale : 'linear' });
				else
					scaleSelector.update({ currentScale : 'log' });
			});
		});

		return el;
	});

	scaleSelector.flow('el, currentScale', function(el, currentScale) {
		el.selectAll('span').text(_.capitalize(currentScale));
	});

	scaleSelector.flow('el, left, top', function(el, left, top) {
		el.style('left', left+'px').style('top', top+'px');
	});

	scaleSelector.beforeClean(function() {
		if (scaleSelector.el) scaleSelector.el.remove();
	});

	return scaleSelector;
};

export default function(chart) {
	var scaleSelectors = dataflow();

	var xScaleSelector = scaleSelector(),
		yScaleSelector = scaleSelector();

	xScaleSelector.flow('currentScale', function(currentScale) {
		chart.model.setAxisConfig('x-axis', "axis-scale", currentScale);
	});

	yScaleSelector.flow('currentScale', function(currentScale) {
		chart.model.setAxisConfig('y-axis', "axis-scale", currentScale);
	});

	scaleSelectors.render = function(bounds) {
        var hasXSelector = chart.model.get('x-axis-scale-selector'),
            hasYSelector = chart.model.get('y-axis-scale-selector');

        if (hasXSelector) {
			xScaleSelector.update({
				containerNode: chart.htmlNode,
				currentScale: chart.model.getAxisConfig('x-axis', 'axis-scale')
			});
        } else {
        	xScaleSelector.clean();
        }

        if (hasYSelector) {
			yScaleSelector.update({
				containerNode: chart.htmlNode,
				currentScale: chart.model.getAxisConfig('y-axis', 'axis-scale')
			});
        } else {
        	yScaleSelector.clean();
        }

		var legend = chart.tabs.chart.legend;

		if (chart.model.get('chart-type') == App.ChartType.ScatterPlot) {
			var innerBounds = chart.tabs.chart.viz.scatter.scatter.axisBox.innerBounds.scale(chart.scale);

			xScaleSelector.update({ left: innerBounds.left+innerBounds.width-50, top: innerBounds.top+innerBounds.height-15 });
			yScaleSelector.update({ left: innerBounds.left-30, top: innerBounds.top-20 });
		} else {				
			var rect = d3.select('svg').select('.nv-distWrap');
			if (rect.empty())
				rect = d3.select('svg').select('.nv-wrap > g > rect');
			if (rect.empty())
				rect = d3.select('svg').select('.nv-background > rect');

			if (!rect.empty()) {
				var rectBounds = chart.getTransformedBounds(rect.node());

				xScaleSelector.update({ left: rectBounds.left+rectBounds.width-100, top: rectBounds.height-30 });
				yScaleSelector.update({ left: rectBounds.left, top: rectBounds.top-10 });					
			}
		}
	};

	scaleSelectors.beforeClean(function() {
		xScaleSelector.clean();
		yScaleSelector.clean();
	});

	return scaleSelectors;
};
