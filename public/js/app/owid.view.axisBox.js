;(function(d3) {
	"use strict";
	owid.namespace("owid.view.axisBox");

	owid.view.axisBox = function() {
		var box = owid.dataflow();

		box.inputs({
			svg: undefined,
			bounds: { left: 0, top: 0, width: 100, height: 100 },
			axisConfig: {}
		});

		box.flow('g : svg', function(svg) {
			return svg.append('g').attr('class', 'axisBox');
		});

		var _xAxis = owid.view.axis();
		box.flow('xAxis : g, bounds, axisConfig', function(g, bounds, axisConfig) {
			_xAxis.update(_.extend({
				svg: g,
				bounds: bounds,
				orient: 'bottom'
			}, axisConfig.x||{}));

			return _xAxis;
		});

		box.flow("innerHeight : xAxis, bounds", function(xAxis, bounds) {
			return bounds.height - xAxis.height;
		});

		var _yAxis = owid.view.axis();
		box.flow("yAxis : g, bounds, innerHeight, axisConfig", function(g, bounds, innerHeight, axisConfig) {
			_yAxis.update(_.extend({
				svg: g,
				bounds: _.extend({}, bounds, { height: innerHeight }),
				orient: 'left'
			}, axisConfig.y||{}));

			return _yAxis;
		});

		box.flow("innerWidth : yAxis, bounds", function(yAxis, bounds) {
			return bounds.width - yAxis.width;
		});

		box.flow("innerBounds : bounds, innerWidth, innerHeight", function(bounds, innerWidth, innerHeight) {
			return { left: bounds.left + (bounds.width-innerWidth), top: bounds.top, width: innerWidth, height: innerHeight };
		});

		// Go back and rerender the x axis to match
		box.flow("xAxis, bounds, innerWidth", function(xAxis, bounds, innerWidth) {
			xAxis.update({
				bounds: _.extend({}, bounds, { left: bounds.left+(bounds.width-innerWidth), width: innerWidth })
			});
		});

		box.flow('gridlines : g', function(g) {
			return g.insert('g', '*').attr('class', 'gridlines');
		});

		// Gridlines. Here rather than in the axes themselves to make the bounding boxes more sensible.
		box.flow("xGridlines : g, gridlines, innerBounds, xAxis", function(g, gridlines, innerBounds, xAxis) {	
			var tickValues = g.selectAll('.bottom.axis .tick').data();

			var gridlinesUpdate = gridlines.selectAll('.x.gridline').data(tickValues),
				xGridlines = gridlinesUpdate
					.enter()
					  .append('line')
					  .attr('class', 'x gridline')
					.merge(gridlinesUpdate)
					  .attr('x1', function(d) { return xAxis.scale(d); })
					  .attr('x2', function(d) { return xAxis.scale(d); })
					  .attr('y1', innerBounds.top+innerBounds.height)
					  .attr('y2', innerBounds.top);

			gridlinesUpdate.exit().remove();

			return xGridlines;
		});

		box.flow("yGridlines : g, gridlines, innerBounds, yAxis", function(g, gridlines, innerBounds, yAxis) {			
			var tickValues = g.selectAll('.left.axis .tick').data();

			var gridlinesUpdate = gridlines.selectAll('.y.gridline').data(tickValues),
				yGridlines = gridlinesUpdate
					.enter()
					  .append('line')
					  .attr('class', 'y gridline')
					.merge(gridlinesUpdate)
					  .attr('x1', innerBounds.left)
					  .attr('x2', innerBounds.left+innerBounds.width)
					  .attr('y1', function(d) { return yAxis.scale(d); })
					  .attr('y2', function(d) { return yAxis.scale(d); });

			gridlinesUpdate.exit().remove();

			return yGridlines;
		});


		return box;
	};
})(d3v4);