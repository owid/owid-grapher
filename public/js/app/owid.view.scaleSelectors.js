;(function() {	
	"use strict";
	owid.namespace("owid.view.scaleSelectors");

	owid.view.scaleSelectors = function(chart) {
		var scaleSelectors = owid.dataflow();
		return scaleSelectors;

		var xAxisScaleSelector = chart.el.select('.x-axis-scale-selector'),
			yAxisScaleSelector = chart.el.select('.y-axis-scale-selector'),
			xAxisBtn = chart.el.select(".x-axis-scale-selector .axis-scale-btn"),
			yAxisBtn = chart.el.select(".y-axis-scale-selector .axis-scale-btn");

		xAxisScaleSelector.on('click', function() {
			var currentScale = chart.model.getAxisConfig('x-axis', 'axis-scale');
			if (currentScale != "log") 
				chart.model.setAxisConfig('x-axis', "axis-scale", "log");			
			else
				chart.model.setAxisConfig('x-axis', "axis-scale", "linear");
		});

		yAxisScaleSelector.on('click', function() {
			var currentScale = chart.model.getAxisConfig('y-axis', 'axis-scale');
			if (currentScale != "log") 
				chart.model.setAxisConfig('y-axis', "axis-scale", "log");			
			else
				chart.model.setAxisConfig('y-axis', "axis-scale", "linear");
		});

		scaleSelectors.render = function() {
			var hasXSelector = chart.model.get('x-axis-scale-selector'),
				hasYSelector = chart.model.get('y-axis-scale-selector'),
				legend = chart.tabs.chart.legend;

			xAxisScaleSelector.classed('hidden', !hasXSelector);
			yAxisScaleSelector.classed('hidden', !hasYSelector);

			if (hasXSelector || hasYSelector) {
				var xScale = chart.model.getAxisConfig("x-axis", "axis-scale");
				xAxisBtn.selectAll('span').text(s.capitalize(xScale) || "Linear");

				var yScale = chart.model.getAxisConfig("y-axis", "axis-scale");
				yAxisBtn.selectAll('span').text(s.capitalize(yScale) || "Linear");

				if (chart.model.get('chart-type') == App.ChartType.ScatterPlot) {
					var innerBounds = chart.tabs.chart.viz.scatter.scatter.axisBox.innerBounds;

					xAxisScaleSelector.style('left', innerBounds.width-10).style('top', innerBounds.height-15);
					yAxisScaleSelector.style('left', innerBounds.left+10).style('top', -3);
				} else {				
					//position scale dropdowns - TODO - isn't there a better way then with timeout?
					setTimeout(function() {
						var chartRect = d3.select('svg').select('.nv-distWrap');
						if (chartRect.empty())
							chartRect = d3.select('svg').select('.nv-wrap > g > rect');
						if (chartRect.empty())
							chartRect = d3.select('svg').select('.nv-background > rect');

						var svgBounds = chart.getBounds(d3.select('svg').node()),
							chartBounds = chart.getBounds(chartRect.node()),
							offsetX = chartBounds.left - svgBounds.left + 5,
							offsetY = legend.height() + 5;

						xAxisScaleSelector.css({ left: svgBounds.width - 100, top: chartBounds.height - 30 });
						yAxisScaleSelector.css({ left: chartBounds.left - svgBounds.left + 10, top: offsetY-3 });
					}.bind(this), 250);		
				}

			}
		};

		scaleSelectors.hide = function() {
			xAxisScaleSelector.classed('hidden', true);
			yAxisScaleSelector.classed('hidden', true);
		};

		return scaleSelectors;
	};
})();