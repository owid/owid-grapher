import * as d3 from 'd3'
import _ from 'underscore'
import dataflow from './owid.dataflow'
import owid from '../owid'
import AxisBox from './owid.view.axisBox'

export default function() {
	var scatter = dataflow();

	scatter.needs('containerNode', 'bounds', 'axisConfig');

	scatter.defaults({
		data: [],
		hoverKey: null,
		canHover: true
	});

	var _axisBox = AxisBox();

	scatter.flow("svg : containerNode", function(containerNode) {
		return d3.select(containerNode);
	});

	// Calculate defaults for domain as needed
	scatter.flow('xDomainDefault, yDomainDefault : data', function(data) {
		return [
			d3.extent(data, function(series) { return series.values[0].x; }),
			d3.extent(data, function(series) { return series.values[0].y; })
		];
	});

	scatter.flow('scatterAxis : axisConfig, xDomainDefault, yDomainDefault', function(axisConfig, xDomainDefault, yDomainDefault) {
		var xDomain = _.extend([], xDomainDefault, axisConfig.x.domain);
		var yDomain = _.extend([], yDomainDefault, axisConfig.y.domain);

		return {
			x: _.extend({}, axisConfig.x, { domain: xDomain }),
			y: _.extend({}, axisConfig.y, { domain: yDomain })
		};
	});

	scatter.flow("axisBox : svg, data, bounds, scatterAxis", function(svg, data, bounds, scatterAxis) {
		_axisBox.update({
			containerNode: svg.node(),
			bounds: bounds,
			axisConfig: scatterAxis
		});

		return _axisBox;
	});

	scatter.flow("innerBounds : axisBox", function(axisBox) { return axisBox.innerBounds; });
	scatter.flow("xScale : axisBox", function(axisBox) { return axisBox.xAxis.scale; });
	scatter.flow("yScale : axisBox", function(axisBox) { return axisBox.yAxis.scale; });
	scatter.flow("g : axisBox", function(axisBox) { axisBox.g.classed('scatter', true); return axisBox.g; });

	var _sizeScale = d3.scaleLinear();
	scatter.flow("sizeScale : data", function(data) {
		_sizeScale.range([6, 18])
			.domain([
	        	d3.min(data, function(series) { return d3.min(series.values, function(d) { return d.size||1; }); }),
	       	    d3.max(data, function(series) { return d3.max(series.values, function(d) { return d.size||1; }); })
	        ]);

	    return _sizeScale;
	});

	/*scatter.flow("line : xScale, yScale", function(xScale, yScale) {
	    return d3.line()
		    .curve(d3.curveLinear)
		    .x(function(d) { return xScale(d.x); })
		    .y(function(d) { return yScale(d.y); });
	});*/

	// Filter data to remove anything that is outside the domain
	scatter.flow('data : data, xScale, yScale', function(data, xScale, yScale) {
		var xDomain = xScale.domain(), yDomain = yScale.domain();
		return _.filter(data, function(d) {
			var x = d.values[0].x, y = d.values[0].y;
			return x >= xDomain[0] && x <= xDomain[1] && y >= yDomain[0] && y <= yDomain[1];
		});
	});

	scatter.flow("entities : g, data", function(g, data) {
		var update = g.selectAll(".entity").data(data, function(d) { return d.key; }),
			exit = update.exit().remove(),
			enter = update.enter().append("g").attr("class", function(d) { return "key-" + owid.makeSafeForCSS(d.key) + " entity"; }),
			entities = enter.merge(update);

		enter.style('opacity', 0).transition(1000).style('opacity', null);

/*			entities.style('opacity', function(d) {				
        	return d.key == "Austria" ? 1 : 0;
		});*/
		return entities;
	});

	scatter.flow("dots : entities, data", function(entities) {
	    var dotUpdate = entities.selectAll(".dot").data(function(d) { return [d]; });
	    return dotUpdate.enter().append("circle").attr("class", "dot").merge(dotUpdate);
	});

	var _colorScale = d3.scaleOrdinal().range(d3.schemeCategory20);
	scatter.flow("dots, xScale, yScale, data", function(dots, xScale, yScale) {
		dots
	      .attr("cx", function(d) { return xScale(d.values[0].x); })
	      .attr("cy", function(d) { return yScale(d.values[0].y); })
	      .style("fill", function(d) { return d.color || _colorScale(d.key); })
	      .style("stroke", "#000")
	      .style("stroke-width", "0.3px");
//		      .style('cursor', 'pointer');
	});

	scatter.flow("hovered : data, hoverKey, canHover", function(data, hoverKey, canHover) {
		if (!canHover) return false;
		else
			return _.find(data, function(d) { return d.key == hoverKey; });
	});

	scatter.flow("dots, hovered", function(dots, hovered) {
		dots.style("fill-opacity", function(d) { return d == hovered ? 1 : 0.7; });
	});

	scatter.flow("dots, sizeScale, hovered", function(dots, sizeScale, hovered) {
		dots.attr("r", function(d) { 
			return sizeScale(d.values[0].size||1) * (hovered == d ? 1.5 : 1);
		});
	});

	// Little lines that point to the axis when you hover a data point
	scatter.flow("g, data, xScale, yScale, hovered", function(g, data, xScale, yScale, hovered) {
		g.selectAll('.focusLine').remove();
		if (!hovered) return;

		g.selectAll('.x.focusLine')
			.data([hovered])
			.enter()
			.append('line')
			.attr('class', 'x focusLine')
			.attr('x1', function(d) { return xScale.range()[0]; })
			.attr('x2', function(d) { return xScale(d.values[0].x); })
			.attr('y1', function(d) { return yScale(d.values[0].y); })
			.attr('y2', function(d) { return yScale(d.values[0].y); })
			.style('stroke', function(d) { return d.color || _colorScale(d.key); });

		g.selectAll('.y.focusLine')
			.data([hovered])
			.enter()
			.append('line')
			.attr('class', 'y focusLine')
			.attr('x1', function(d) { return xScale(d.values[0].x); })
			.attr('x2', function(d) { return xScale(d.values[0].x); })
			.attr('y1', function(d) { return yScale.range()[0]; })
			.attr('y2', function(d) { return yScale(d.values[0].y); })
			.style('stroke', function(d) { return d.color || _colorScale(d.key); });
	});

	// Tooltip
	scatter.flow("svg, hovered, xScale, yScale", function tooltip(svg, hovered, xScale, yScale) {
		if (!hovered)
			owid.tooltipHide(svg.node());
		else
			owid.tooltip(svg.node(), xScale(hovered.values[0].x)+20, yScale(hovered.values[0].y), hovered);
	});

	// Set up hover interactivity
	scatter.flow("svg, xScale, yScale, sizeScale, data", function mousebind(svg, xScale, yScale, sizeScale, data) {
		svg = d3.select(svg.node());
		svg.on("mousemove.scatter", function() {
			var mouse = d3.mouse(svg.node()),
				mouseX = mouse[0], mouseY = mouse[1];

			// Find the closest data point to the mouse
			var distances = {};
			var d = _.sortBy(data, function(d) {
				var value = d.values[0],
					dx = xScale(value.x) - mouseX,
					dy = yScale(value.y) - mouseY,
					dist = dx*dx + dy*dy;
				distances[d.key] = dist;
				return dist;
			})[0];

			if (d) {
				if (Math.sqrt(distances[d.key]) < sizeScale(d.values[0].size||1)*6)
					scatter.update({ hoverKey: d.key });
				else
					scatter.update({ hoverKey: null });					
			}
		});
	});

	var _fontScale = d3.scaleLinear();
	scatter.flow("fontScale : sizeScale", function(sizeScale) {
		_fontScale.range([13, 19]).domain(sizeScale.domain());
	    return _fontScale;
	});

	// Calculate the positions of the point labels we'd like to use
	scatter.flow("labelData : data, xScale, yScale, sizeScale, fontScale, hovered", function(data, xScale, yScale, sizeScale, fontScale, hovered) {
		return _.map(data, function(d) {
			var firstValue = _.first(d.values),
				lastValue = _.last(d.values),
				xPos = xScale((lastValue.x+firstValue.x)/2),
				yPos = yScale((lastValue.y+firstValue.y)/2),
				offset = Math.sqrt(Math.pow(sizeScale(firstValue.size||1), 2)/2)+1;

			return {
				x: xPos + offset,
				y: yPos - offset,
				offset: offset,
				color: "#333",
				text: d.label,
				key: d.key,
				fontSize: fontScale(lastValue.size||1)*(d==hovered ? 1.3 : 1)
			};
		});
	});

	// Calculating bboxes for many labels each frame is expensive
	// So we cache width and height unless the label size changes
	var labelSizeCache = {};
	function updateLabelSize(d, label) {
		var cache = labelSizeCache[d.text];

		if (!cache || cache.fontSize != d.fontSize) {
			cache = {
				fontSize: d.fontSize,
				bbox: label.getBBox()
			};

			labelSizeCache[d.text] = cache;
		}

		d.width = cache.bbox.width;
		d.height = cache.bbox.height;
	}

	// Render the labels and filter for overlaps
	scatter.flow("labels : g, data, labelData, xScale, yScale", function(g,  data, labelData, xScale, yScale) {			
		var labelUpdate = g.selectAll(".scatter-label").data(labelData);

		var labels = labelUpdate.enter()
            .append("text")
            .attr("class", "scatter-label")
            .attr('text-anchor', 'start')
          .merge(labelUpdate)
            .text(function(d) { return d.text; })
            .style("font-size", function(d) { return d.fontSize+'px'; })   
            .style("fill", function(d) { return d.color; })
            .style('cursor', 'default');	            

        labelUpdate.exit().remove();
	        
        // Calculate the size of each label and ensure it's inside the bounds of the chart
        var label_array = [];
        labels.each(function(d) {
        	updateLabelSize(d, this);

        	if (d.x+d.width > xScale.range()[1])
        		d.x -= (d.width + d.offset*2);
        	if (d.y < yScale.range()[1])
        		d.y += (d.height/2 + d.offset*2);

        	label_array.push(d);
        });

        labels.attr("x", function(d) { return d.x; })
              .attr("y", function(d) { return d.y; });

        // Now do collision detection and hide overlaps
        function collide(l1, l2) {
        	var r1 = { left: l1.x, top: l1.y, right: l1.x+l1.width, bottom: l1.y+l1.height };
        	var r2 = { left: l2.x, top: l2.y, right: l2.x+l2.width, bottom: l2.y+l2.height };
			    
			    return !(r2.left > r1.right || 
		             r2.right < r1.left || 
		             r2.top > r1.bottom ||
		             r2.bottom < r1.top);
        }

        while (true) {
        	var overlaps = false;
	        for (var i = 0; i < label_array.length; i++) {
	        	var l1 = label_array[i];
	        	if (l1.hidden) continue;

	        	for (var j = 0; j < label_array.length; j++) {
	        		var l2 = label_array[j];
	        		if (l1 == l2 || l2.hidden) continue;

	        		if (collide(l1, l2)) {
	        			if (l1.fontSize > l2.fontSize)
	        				l2.hidden = true;
	        			else
	        				l1.hidden = true;
	        			overlaps = true;
	        		}
	        	}
	        }	        	

	        if (!overlaps) break;
        }
		
        labels.style("opacity", function(d) { return d.hidden ? 0 : 1; });
	});

	scatter.beforeClean(function() {
		if (scatter.g) scatter.g.remove();
	});

	return scatter;
};