;(function(d3) {
	"use strict";
	owid.namespace("owid.view.axis");

	owid.view.axis = function() {
		var axis = owid.dataflow();

		axis.inputs({
			svg: undefined, // d3 selection
			domain: undefined, // e.g. [0, 10], will be used to create scale
			scaleType: 'linear', // or 'log'
			// Bounds of the chart we are putting an axis on, not the axis itself.
			// The axis is of variable size depending on config so it cannot be totally specified in advance.
			bounds: { left: 0, top: 0, width: 100, height: 100 },
			// Currently 'left' or 'bottom'
			orient: 'left',
			label: "",
			tickFormat: function(d) { return d; }
		});

		axis.flow("scale : domain, bounds, orient, scaleType", function(domain, bounds, orient, scaleType) {
			var scale = scaleType == 'linear' ? d3.scaleLinear() : d3.scaleLog();
			scale.domain(domain);

			if (orient == 'left')
				scale.range([bounds.top+bounds.height, bounds.top]);
			else
				scale.range([bounds.left, bounds.left+bounds.width]);

			return scale;
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

		axis.flow("scaleG : g", function(g) {
			return g.append("g").attr('class', 'scale');
		});

		axis.flow("bboxNoLabel : scaleG, bounds, scale, orient, d3axis, tickFormat, scaleType", function(scaleG, bounds, scale, orient, d3axis, tickFormat, scaleType) {			
			d3axis.scale(scale)
				.ticks((orient == 'left' ? bounds.height : bounds.width) / 100)
				.tickSizeOuter(0);

			// Custom calculation of ticks for log scales as d3axis doesn't handle it
			if (scaleType == 'log') {
				var minPower10 = Math.ceil(Math.log(scale.domain()[0]) / Math.log(10));
				var maxPower10 = Math.floor(Math.log(scale.domain()[1]) / Math.log(10));

				var tickValues = [];
				for (var i = minPower10; i <= maxPower10; i++) {
					tickValues.push(Math.pow(10, i));
				}
				d3axis.tickValues(tickValues);
			} else {
				d3axis.tickValues(null);
			}

			d3axis.tickFormat(tickFormat);

			d3axis(scaleG);

			return scaleG.node().getBBox();
		});

		axis.flow("bbox : g, bounds, orient, bboxNoLabel, label", function(g, bounds, orient, bboxNoLabel, label) {
			if (!label) return bboxNoLabel;

			var labelUpdate = g.selectAll(".axis-label").data([label]);

			if (orient == 'left') {
				labelUpdate.enter()
					.append("text")
					.attr("class", "axis-label")
					.attr("text-anchor", "middle")
					.style("fill", "black")
					.attr("transform", "rotate(-90)")
				  .merge(labelUpdate)
					.attr("x", -bounds.top-bounds.height/2)
					.attr("y", -bboxNoLabel.width-10)
					.text(label);
			} else {
				labelUpdate.enter()
					.append("text")
					.attr("class", "axis-label")
					.attr("text-anchor", "middle")
					.style("fill", "black")
				  .merge(labelUpdate)
					.attr("x", bounds.left+bounds.width/2)
					.attr("y", bboxNoLabel.height+15)
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
})(d3v4);