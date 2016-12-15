;(function(d3) {
	"use strict";
	owid.namespace("owid.view.scatter");

	owid.view.scatter = function() {
		var scatter = owid.dataflow();

		scatter.inputs({
			svg: undefined,
			data: [],
			bounds: { left: 0, top: 0, width: 100, height: 100 },
			axisConfig: undefined,
			hoverKey: null,
			canHover: true
		});

		var _axisBox = owid.view.axisBox();

		scatter.flow("svgSelect : svg", function(svg) {
			return d3.select(svg.node());
		});

		scatter.flow("axisBox : svgSelect, data, bounds, axisConfig", function(svg, data, bounds, axisConfig) {
			_axisBox.update({
				svg: svg,
				bounds: bounds,
				axisConfig: axisConfig
			});

			return _axisBox;
		});

		scatter.flow("innerBounds : axisBox", function(axisBox) { return axisBox.innerBounds; });
		scatter.flow("xScale : axisBox", function(axisBox) { return axisBox.xAxis.scale; });
		scatter.flow("yScale : axisBox", function(axisBox) { return axisBox.yAxis.scale; });
		scatter.flow("g : axisBox", function(axisBox) { return axisBox.g; });

		var _sizeScale = d3.scaleLinear();
		scatter.flow("sizeScale : data", function(data) {
			_sizeScale.range([5, 10])
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

		scatter.flow("entities : g, data", function(g, data) {
			var update = g.selectAll(".entity").data(data, function(d) { return d.key; }),
				exit = update.exit().remove(),
				enter = update.enter().append("g").attr("class", function(d) { return d.key + " entity"; }),
				entities = enter.merge(update);

			enter.style('opacity', 0).transition(1000).style('opacity', 1);

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
		      .style("fill", function(d) { return d.color || _colorScale(d.key); });
		});

		scatter.flow("hovered : data, hoverKey, canHover", function(data, hoverKey, canHover) {
			if (!canHover) return false;
			else
				return _.find(data, function(d) { return d.key == hoverKey; });
		});

		scatter.flow("dots, hovered", function(dots, hovered) {
			dots.style("fill-opacity", function(d) { return d == hovered ? 1 : 0.9; });
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
				owid.tooltip(svg.node(), xScale(hovered.values[0].x), yScale(hovered.values[0].y), hovered);
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
			_fontScale.range([12, 16]).domain(sizeScale.domain());
		    return _fontScale;
		});

		// Calculate the positions of the point labels we'd like to use
		scatter.flow("labelData : data, xScale, yScale, sizeScale, fontScale", function(data, xScale, yScale, sizeScale, fontScale) {
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
					fontSize: fontScale(lastValue.size)
				};
			});
		});

		// Render the labels and filter for overlaps
		scatter.flow("labels : data, labelData, entities, xScale, yScale", function(data, labelData, entities, xScale, yScale) {			
			var labelUpdate = entities.selectAll(".label").data(function(d,i) { return [labelData[i]]; });

			var labels = labelUpdate.enter()
	            .append("text")
	            .attr("class", "label")
	            .attr('text-anchor', 'start')
	          .merge(labelUpdate)
	            .text(function(d) { return d.text; })
	            .style("font-size", function(d) { return d.fontSize; })   
	            .style("fill", function(d) { return d.color; });
		        
	        // Calculate the size of each label and ensure it's inside the bounds of the chart
	        var label_array = [];
	        labels.each(function(d) {
	            d.width = this.getBBox().width;
	            d.height = this.getBBox().height;

	        	if (d.x+d.width > xScale.range()[1])
	        		d.x -= (d.width + d.offset*2);
	        	if (d.y < yScale.range()[1])
	        		d.y += (d.height/2 + d.offset*2);

	        	label_array.push(d);
	        });

	        labels.attr("x", function(d) { return d.x; })
	              .attr("y", function(d) { return d.y; });

	        // Make sure all the labels are inside the bounds of the chart
/*	    		if (label.x < xScale.range()[0] || label.x+label.width > xScale.range()[1] || label.y < yScale.range()[1]) {
	    			label.hidden = true;
	    			continue;
	    		}*/


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

		return scatter;
	};

	owid.view.scatterold = function() {
		var scatter = {};

		var state = {
			data: [],
			bounds: { left: 0, top: 0, right: 100, bottom: 100 },
			focus: null
		};

		scatter.state = state;
		var changes = owid.changes();
		changes.track(state);

		var margin, width, height, svg, x, y, sizeScale, fontScale, xAxis, yAxis, entities;

		function initialize() {
			if (svg) svg.remove();

			margin = {top: state.bounds.top + 50, right: 50, bottom: 100, left: state.bounds.left + 50};
		    width = state.bounds.width - margin.right - 50;
		    height = state.bounds.height - margin.bottom - 50;


/*			xAxis = d3.svg.axis()
			    .scale(x)
			    .orient("bottom");

			yAxis = d3.svg.axis()
			    .scale(y)
			    .orient("left");*/

			svg = d3.select("svg")
			  .append("g")
			    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

			/*svg.append("g")
			  .attr("class", "x axis")
			  .attr("transform", "translate(0," + height + ")")
			  .call(xAxis)
			.append("text")
			  .attr("class", "label")
			  .attr("x", width)
			  .attr("y", -6)
			  .style("text-anchor", "end");
			  //.text("Sepal Width (cm)");

			svg.append("g")
			  .attr("class", "y axis")
			  .call(yAxis)
			.append("text")
			  .attr("class", "label")
			  .attr("transform", "rotate(-90)")
			  .attr("y", 6)
			  .attr("dy", ".71em")
			  .style("text-anchor", "end");*/
			  //.text("Sepal Length (cm)");

		}

		function renderData() {
			if (!changes.any('data')) return;

			x = d3.scaleLinear().range([0, width]);
			y = d3.scaleLinear().range([height, 0]);
			sizeScale = d3.scaleLinear().range([2, 4]);
			fontScale = d3.scaleLinear().range([8, 14]);

  		    x.domain([
		        d3.min(state.data, function(series) { return d3.min(series.values, function(d) { return d.x; }); }),
		        d3.max(state.data, function(series) { return d3.max(series.values, function(d) { return d.x; }); })
		    ]);

  		    y.domain([
		        d3.min(state.data, function(series) { return d3.min(series.values, function(d) { return d.y; }); }),
		        d3.max(state.data, function(series) { return d3.max(series.values, function(d) { return d.y; }); })
		    ]);

		    sizeScale.domain([
		        d3.min(state.data, function(series) { return d3.min(series.values, function(d) { return d.size; }); }),
		        d3.max(state.data, function(series) { return d3.max(series.values, function(d) { return d.size; }); })
		    ]);

		    fontScale.domain([
		        d3.min(state.data, function(series) { return d3.min(series.values, function(d) { return d.size; }); }),
		        d3.max(state.data, function(series) { return d3.max(series.values, function(d) { return d.size; }); })
		    ]);			

		    var line = d3.line()
			    .curve(d3.curveLinear)
			    .x(function(d) { return x(d.x); })
			    .y(function(d) { return y(d.y); });

			var update = svg.selectAll(".entity").data(state.data, function(d) { return d.key; }),
				exit = update.exit().remove(),
				enter = update.enter().append("g").attr("class", "entity");
			entities = enter.merge(update);

			var markers = enter.append("svg:marker")
		        .attr("stroke", "rgba(0,0,0,0)")
		        .attr("viewBox", "0 -5 10 10")
		        .attr("refX", 5)
		        .attr("refY", 0)
		        .attr("markerWidth", 4)
		        .attr("markerHeight", 4)
		        .attr("orient", "auto");

		    markers.append("svg:path")
		        .attr("d", "M0,-5L10,0L0,5");

		   	markers.merge(update)
		   	  	.attr("id", function(d) { return d.id; })
		        .attr("fill", function(d) { return d.color || _colorScale(d.key); });

		    var lineUpdate = entities.selectAll(".line").data(function(d) { return [d]; });

		    lineUpdate.enter().append("path")
				.attr("class", "line")
				.style("fill-opacity", 0)
			  .merge(lineUpdate)
			  	.transition()
				.attr("d", function(d) { return line([d.values[0], _.last(d.values)]); })				
			    .attr("marker-end", function(d) { return "url(#" + d.id + ")"; })			    
				.style("stroke", function(d) { return d.color || _colorScale(d.key); })
				.style("stroke-width", function(d) { return sizeScale(_.last(d.values).size); });

			update.exit().remove();
		}

		function renderLabels() {
			if (!changes.any('data')) return;
			var labelUpdate = entities.selectAll(".label").data(function(d) { 
				var firstValue = _.first(d.values),
					lastValue = _.last(d.values),
					xPos = xScale((lastValue.x+firstValue.x)/2),
					yPos = yScale((lastValue.y+firstValue.y)/2),
					angle = Math.atan2(yScale(lastValue.y) - yScale(firstValue.y), xScale(lastValue.x) - xScale(firstValue.x)) * 180 / Math.PI;

				// Ensure label stays the right way up when going negative
				if (lastValue.x < firstValue.x)
					angle += 180;

				return [{
					x: xPos,
					y: yPos,
					angle: angle,
					name: d.label,
					key: d.key,
					fontSize: 12//fontScale(lastValue.size)
				}];
			});

			var labels = labelUpdate.enter()
	            .append("text")
	            .attr("class", "label")
	            .attr('text-anchor', 'middle')
	          .merge(labelUpdate)
	            .text(function(d) { return d.name; })
	            .style("font-size", function(d) { return d.fontSize; })   
	            .style("fill", function(d) { return d.color; })
	            .attr("x", function(d) { return (d.x); })
	            .attr("y", function(d) { return (d.y); })	            
	            .attr("transform", function(d) { return "rotate(" + d.angle + "," + d.x + "," + d.y + ") translate(0, -2)"; });
		        
	        // Size of each label
	        var label_array = [];
	        labels.each(function(d) {
	            d.width = this.getBBox().width;
	            d.height = this.getBBox().height;
	        	label_array.push(d);
	        });

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
		}


		function renderFocus() {
			if (!changes.any('focus')) return;

			d3.select('svg').on("mousemove.scatter", function() {
				var mouse = d3.mouse(svg.node()),
					mouseX = mouse[0], mouseY = mouse[1];
					
				var d = _.sortBy(state.data, function(d) {
					var value = d.values[0],
						dx = x(value.x) - mouseX,
						dy = y(value.y) - mouseY,
						dist = dx*dx + dy*dy;
					return dist;
				})[0];

				state.focus = d.key;
				scatter.render();
			});

			entities.style('opacity', function(d) {
				return (state.focus === null || d.key == state.focus) ? 1 : 0.2;
			});

			entities.selectAll('.label').style('opacity', function(d) {
				if (state.focus !== null && d.key == state.focus)
					return 1;
				else
					return (d.hidden ? 0 : 1);
			});
		}


		scatter.render = function() {
			if (!changes.start()) return;

			if (changes.any('bounds')) initialize();

			renderData();
			renderLabels();
			renderFocus();

			var axis = owid.view.xAxis();
			axis.offsetTop(state.bounds.height - 100)
				.offsetLeft(state.bounds.left)
				.width(state.bounds.width - state.bounds.left - 100)
				.height(50)
				.scale(x)
				.svg(svg);

			changes.done();

			chart.dispatch.renderEnd();
		};

		return scatter;
	};

})(d3v4);