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

export default function(chartView, chartTab) {
	const chart = chartView.chart
	var scaleSelectors = dataflow();

	var xScaleSelector = scaleSelector(),
		yScaleSelector = scaleSelector();

	xScaleSelector.flow('currentScale', function(currentScale) {
		chart.xAxis.scaleType = currentScale
	});

	yScaleSelector.flow('currentScale', function(currentScale) {
		chart.yAxis.scaleType = currentScale
	});

	scaleSelectors.render = function(bounds) {
        if (chart.xAxis.canChangeScaleType) {
			xScaleSelector.update({
				containerNode: chart.htmlNode,
				currentScale: chart.xAxis.scaleType
			});
        } else {
        	xScaleSelector.clean();
        }

        if (chart.yAxis.canChangeScaleType) {
			yScaleSelector.update({
				containerNode: chartView.htmlNode,
				currentScale: chart.yAxis.scaleType
			});
        } else {
        	yScaleSelector.clean();
        }

		var rect = d3.select('svg').select('.nv-distWrap');
		if (rect.empty())
			rect = d3.select('svg').select('.nv-wrap > g > rect');
		if (rect.empty())
			rect = d3.select('svg').select('.nv-background > rect');

		if (!rect.empty()) {
			var rectBounds = chartView.getTransformedBounds(rect.node());

			xScaleSelector.update({ left: rectBounds.left+rectBounds.width-100, top: rectBounds.height-30 });
			yScaleSelector.update({ left: rectBounds.left, top: rectBounds.top-10 });
		}
	};

	scaleSelectors.beforeClean(function() {
		xScaleSelector.clean();
		yScaleSelector.clean();
	});

	return scaleSelectors;
};
