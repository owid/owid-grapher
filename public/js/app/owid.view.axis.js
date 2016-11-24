	;(function(d3) {
	"use strict";
	owid.namespace("owid.view");

	owid.view.axis = function() {
		var axis = owid.dataflow();

		axis.inputs({
			svg: undefined, // d3 selection
			scale: undefined, // d3 scale
			// Bounds of the chart we are putting an axis on, not the axis itself.
			// The axis is of variable size depending on config so it cannot be totally specified in advance.
			bounds: { left: 0, top: 0, width: 100, height: 100 },
			// Currently 'left' or 'bottom'
			orient: 'left',
			label: "",
			minValue: null,
			maxValue: null,
			tickFormat: function(d) { return d; }
		});

		axis.flow("g : svg", function(svg) {
			return svg.append("g");
		});

		axis.flow("g, orient", function(g, orient) {
			g.attr("class", orient + " axis");
		});

		axis.flow('d3axis : orient', function(orient) {
			if (orient == 'left')
				return d3.axisLeft();
			else
				return d3.axisBottom();
		});

		axis.flow("bbox : g, bounds, scale, label, orient, d3axis", function(g, bounds, scale, label, orient, d3axis) {
			if (orient == 'left')
				scale.range([bounds.top+bounds.height, bounds.top]);
			else
				scale.range([bounds.left, bounds.left+bounds.width]);				

			if (orient == 'left') {
				d3axis.scale(scale)
					.ticks(bounds.height / 70)
					.tickSizeOuter(0);
			} else {
				d3axis.scale(scale)
					.ticks(bounds.width / 70)
					.tickSizeOuter(0);
			}

			d3axis(g);

			var labelUpdate = g.selectAll(".axis-label").data([label]);

			if (orient == 'left') {
				labelUpdate.enter()
					.append("text")
					.attr("class", "axis-label")
					.attr("text-anchor", "middle")
					.style("fill", "black")
					.attr("transform", "rotate(-90)")
				  .merge(labelUpdate)
					.attr("x", -bounds.height/2)
					.attr("y", -25)
					.text(label);
			} else {
				labelUpdate.enter()
					.append("text")
					.attr("class", "axis-label")
					.attr("text-anchor", "middle")
					.style("fill", "black")
				  .merge(labelUpdate)
					.attr("x", bounds.width/2)
					.attr("y", 25)
					.text(label);				
			}

			labelUpdate.exit().remove();

			return g.node().getBBox();
		});

		axis.flow("width : bbox", function(bbox) { return bbox.width; });
		axis.flow("height : bbox", function(bbox) { return bbox.height; });

		axis.flow("g, bounds, width, height, orient", function(g, bounds, width, height, orient) {
			if (orient == 'left')
				g.attr('transform', 'translate(' + (bounds.left+width) + ',' + 0 + ')');
			else
				g.attr('transform', 'translate(0,' + (bounds.top+(bounds.height-height)) + ')');			
		});

		return axis;
	};

	owid.view.axisBox = function() {
		var box = owid.dataflow();

		box.inputs({
			svg: undefined,
			bounds: { left: 0, top: 0, width: 100, height: 100 },
			xScale: undefined,
			yScale: undefined,
			axisConfig: {}
		});

		box.flow('g : svg', function(svg) {
			return svg.append('g').attr('class', 'axisBox');
		});

		var _xAxis = owid.view.axis();
		box.flow('xAxis : g, bounds, xScale, axisConfig', function(g, bounds, xScale, axisConfig) {
			_xAxis.update(_.extend({
				svg: g,
				scale: xScale,
				bounds: bounds,
				orient: 'bottom'
			}, axisConfig.x||{}));

			return _xAxis;
		});

		box.flow("innerHeight : xAxis, bounds", function(xAxis, bounds) {
			return bounds.height - xAxis.height;
		});

		var _yAxis = owid.view.axis();
		box.flow("yAxis : g, bounds, yScale, innerHeight, axisConfig", function(g, bounds, yScale, innerHeight, axisConfig) {
			_yAxis.update(_.extend({
				svg: g,
				scale: yScale,
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

		return box;
	};
})(d3v4);