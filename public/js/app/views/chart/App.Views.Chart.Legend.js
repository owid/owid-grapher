;( function() {
	
	"use strict";
	
	App.Views.Chart.Legend = function( chartLegend ) {
	
		//based on https://github.com/novus/nvd3/blob/master/src/models/legend.js

		//============================================================
		// Public Variables with Default Settings
		//------------------------------------------------------------

		var margin = {top: 5, right: 50, bottom: 5, left: 62}
			, width = 800
			, height = 20
			, getKey = function(d) { return d.key }
			, color = nv.utils.getColor()
			, align = true
			, padding = 40 //define how much space between legend items. - recommend 32 for furious version
			, rightAlign = false
			, updateState = true   //If true, legend will update data.disabled and trigger a 'stateChange' dispatch.
			, radioButtonMode = false   //If true, clicking legend items will cause it to behave like a radio button. (only one can be selected at a time)
			, expanded = false
			, dispatch = d3.dispatch('legendClick', 'legendDblclick', 'legendMouseover', 'legendMouseout', 'stateChange', 'removeEntity', 'addEntity')
			, vers = 'classic' //Options are "classic" and "furious" and "owd"
			;

		function chart(selection) {
			
			selection.each(function(data) {
				
				var $svg = $( "svg.nvd3-svg" ),
					availableWidth = $svg.width() - margin.left - margin.right,
					container = d3.select(this);
				
				nv.utils.initSVG(container);

				// Setup containers and skeleton of chart
				var wrap = container.selectAll('g.nv-legend').data([data]),
					gEnter = wrap.enter().append('g').attr('class', 'nvd3 nv-legend').append('g'),
					g = wrap.select('g');

				wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

				var series = g.selectAll('.nv-series')
					.data(function(d) {
						if(vers != 'furious') return d;
						return d.filter(function(n) {
							return expanded ? true : !n.disengaged;
						});
					});
				
				//if not existing, add nv-add-btn
				var addEntityBtn =  wrap.select( 'g.nv-add-btn' );
				if( addEntityBtn.empty() ) {
					addEntityBtn = wrap.append('g').attr('class', 'nv-add-btn');
					addEntityBtn.property('innerHTML','<rect class="add-btn-bg" width="100" height="25" transform="translate(0,-5)"/><path d="M16,0 L16,14" class="nv-box"></path><path d="M9,7 L22,7" class="nv-box"></path><text x="28" y="11">Add country</text>');
					addEntityBtn.on( 'click', function( d, i ) {
						dispatch.addEntity();
						d3.event.stopImmediatePropagation();
					} );
				}
				//based on selected countries selection hide or show addEntityBtn
				if( _.isEmpty( App.ChartModel.get( "selected-countries" ) ) ) {
					addEntityBtn.attr( "display", "none" );
				} else {
					addEntityBtn.attr( "display", "block" );
				}
					
				var seriesEnter = series.enter().append('g').attr('class', 'nv-series'),
					seriesShape, seriesRemove;

				var versPadding = 30;
				seriesEnter.append('rect')
					.style('stroke-width', 2)
					.attr('class','nv-legend-symbol');
				seriesEnter.append('g')
					.attr('class', 'nv-remove-btn')
					.property('innerHTML','<path d="M0,0 L7,7" class="nv-box"></path><path d="M7,0 L0,7" class="nv-box"></path>')
					.attr('transform', 'translate(10,10)');
				seriesShape = series.select('.nv-legend-symbol');
				
				seriesEnter.append('text')
					.attr('text-anchor', 'start')
					.attr('class','nv-legend-text')
					.attr('dy', '.32em')
					.attr('dx', '0');

				var seriesText = series.select('text.nv-legend-text'),
					seriesRemove = series.select('.nv-remove-btn');

				series
					.on('mouseover', function(d,i) {
						chartLegend.dispatch.legendMouseover(d,i);  //TODO: Make consistent with other event objects
					})
					.on('mouseout', function(d,i) {
						chartLegend.dispatch.legendMouseout(d,i);
					})
					.on('click', function(d,i) {
						chartLegend.dispatch.legendClick(d,i);
						// make sure we re-get data in case it was modified
						var data = series.data();
						if (updateState) {
							if(expanded) {
								d.disengaged = !d.disengaged;
								d.userDisabled = d.userDisabled == undefined ? !!d.disabled : d.userDisabled;
								d.disabled = d.disengaged || d.userDisabled;
							} else if (!expanded) {
								d.disabled = !d.disabled;
								d.userDisabled = d.disabled;
								var engaged = data.filter(function(d) { return !d.disengaged; });
								if (engaged.every(function(series) { return series.userDisabled })) {
									//the default behavior of NVD3 legends is, if every single series
									// is disabled, turn all series' back on.
									data.forEach(function(series) {
										series.disabled = series.userDisabled = false;
									});
								}
							}
							chartLegend.dispatch.stateChange({
								disabled: data.map(function(d) { return !!d.disabled }),
								disengaged: data.map(function(d) { return !!d.disengaged })
							});
						}
					})
					.on('dblclick', function(d,i) {
						if((vers == 'furious' || vers == 'owd') && expanded) return;
						chartLegend.dispatch.legendDblclick(d,i);
						if (updateState) {
							// make sure we re-get data in case it was modified
							var data = series.data();
							//the default behavior of NVD3 legends, when double clicking one,
							// is to set all other series' to false, and make the double clicked series enabled.
							data.forEach(function(series) {
								series.disabled = true;
								if(vers == 'furious' || vers == 'owd') series.userDisabled = series.disabled;
							});
							d.disabled = false;
							if(vers == 'furious' || vers == 'owd' ) d.userDisabled = d.disabled;
							chartLegend.dispatch.stateChange({
								disabled: data.map(function(d) { return !!d.disabled })
							});
						}
					});

				seriesRemove.on( 'click', function( d, i ) {

					d3.event.stopImmediatePropagation();
					//remove series straight away, so we don't have to wait for response from server
					series[0][i].remove();
					dispatch.removeEntity( d.id );
					
				} );	

				series.classed('nv-disabled', function(d) { return d.userDisabled });
				series.exit().remove();

				seriesText
					.attr('fill', setTextColor)
					.text(getKey);

				//TODO: implement fixed-width and max-width options (max-width is especially useful with the align option)
				// NEW ALIGNING CODE, TODO: clean up
				var legendWidth = 0,
					transformX, transformY;
				if (align) {

					var seriesWidths = [];
					series.each( function(d,i) {
						var legendText = d3.select(this).select('text');
						var nodeTextLength;
						try {
							nodeTextLength = legendText.node().getComputedTextLength();
							// If the legendText is display:none'd (nodeTextLength == 0), simulate an error so we approximate, instead
							if(nodeTextLength <= 0) throw Error();
						} catch( e ) {
							nodeTextLength = nv.utils.calcApproxTextWidth(legendText);
						}
						seriesWidths.push(nodeTextLength + padding);
					});

					var seriesPerRow = 0;
					var columnWidths = [];
					legendWidth = 0;

					while( legendWidth < availableWidth && seriesPerRow < seriesWidths.length ) {
						columnWidths[seriesPerRow] = seriesWidths[seriesPerRow];
						legendWidth += seriesWidths[seriesPerRow++];
					}
					if( seriesPerRow === 0 ) seriesPerRow = 1; //minimum of one series per row

					while( legendWidth > availableWidth && seriesPerRow > 1 ) {
						columnWidths = [];
						seriesPerRow--;

						for (var k = 0; k < seriesWidths.length; k++) {
							if (seriesWidths[k] > (columnWidths[k % seriesPerRow] || 0) )
								columnWidths[k % seriesPerRow] = seriesWidths[k];
						}

						legendWidth = columnWidths.reduce(function(prev, cur, index, array) {
							return prev + cur;
						});
					}

					var xPositions = [];
					for (var i = 0, curX = 0; i < seriesPerRow; i++) {
						xPositions[i] = curX;
						curX += columnWidths[i];
					}

					series
						.attr('transform', function(d, i) {
							transformX = xPositions[i % seriesPerRow];
							transformY = (5 + Math.floor(i / seriesPerRow) * versPadding);
							return 'translate(' + transformX + ',' + transformY + ')';
						});

					//position legend as far right as possible within the total width
					if (rightAlign) {
						g.attr('transform', 'translate(' + (width - margin.right - legendWidth) + ',' + margin.top + ')');
					}
					else {
						g.attr('transform', 'translate(0' + ',' + margin.top + ')');
					}

					height = margin.top + margin.bottom + (Math.ceil(seriesWidths.length / seriesPerRow) * versPadding);

				} else {

					var ypos = 5,
						newxpos = 5,
						maxwidth = 0,
						xpos;
					series
						.attr('transform', function(d, i) {
							var length = d3.select(this).select('text').node().getComputedTextLength() + padding;
							xpos = newxpos;

							if (width < margin.left + margin.right + xpos + length) {
								newxpos = xpos = 5;
								ypos += versPadding;
							}

							newxpos += length;
							if (newxpos > maxwidth) maxwidth = newxpos;

							if(legendWidth < xpos + maxwidth) {
								legendWidth = xpos + maxwidth;
							}
							return 'translate(' + xpos + ',' + ypos + ')';
						});

					//position legend as far right as possible within the total width
					g.attr('transform', 'translate(' + (width - margin.right - maxwidth) + ',' + margin.top + ')');

					height = margin.top + margin.bottom + ypos + 15;
				}

				// Size rectangles after text is placed
				seriesShape
					.attr('width', function(d,i) {
						//position remove btn
						var width = seriesText[0][i].getComputedTextLength() + 5;
						d3.select( seriesRemove[0][i] ).attr( 'transform', 'translate(' + width + ',-3)' );
						return width+25;
					})
					.attr('height', 24)
					.attr('y', -12)
					.attr('x', -12);

				// The background for the expanded legend (UI)
				gEnter.insert('rect',':first-child')
					.attr('class', 'nv-legend-bg')
					.attr('fill', '#eee')
					// .attr('stroke', '#444')
					.attr('opacity',0);

				var seriesBG = g.select('.nv-legend-bg');

				seriesBG
				.transition().duration(300)
					.attr('x', -versPadding )
					.attr('width', legendWidth + versPadding - 12)
					.attr('height', height + 10)
					.attr('y', -margin.top - 10)
					.attr('opacity', expanded ? 1 : 0);

				seriesShape
					.style('fill', setBGColor)
					.style('fill-opacity', setBGOpacity)
					.style('stroke', setBGColor);

				//position add btn
				if( series.size() ) {

					var seriesArr = series[0];
					if( seriesArr && seriesArr.length ) {
						//fetch last element to know its width
						var lastEl = seriesArr[ seriesArr.length-1 ],
							//need rect inside element that has set width
							lastRect = d3.select( lastEl ).select( "rect" ),
							lastRectWidth = lastRect.attr( "width" );
						//position add btn
						transformX = +transformX + parseInt( lastRectWidth ) - 3;
						//centering
						transformY = +transformY - 3;
						//check for right edge
						var buttonWidth = 120, buttonHeight = 35;
						if( ( transformX + buttonWidth ) > availableWidth ) {
							transformX = 0;//availableWidth - buttonWidth;
							transformY += buttonHeight;
							//update whole chart height as well
							height += buttonHeight;
						}
						addEntityBtn.attr( "transform", "translate( " + transformX + ", " + transformY + ")" );
					}
						
				}
				
			});
			
			function setTextColor(d,i) {
				if(vers != 'furious' && vers != 'owd') return '#000';
				if(expanded) {
					return d.disengaged ? '#000' : '#fff';
				} else if (!expanded) {
					if(!d.color) d.color = color(d,i);
					return !!d.disabled ? '#666' : '#fff';
					//return !!d.disabled ? d.color : '#fff';
				}
			}

			function setBGColor(d,i) {
				if(expanded && (vers == 'furious' || vers == 'owd')) {
					return d.disengaged ? '#eee' : d.color || color(d,i);
				} else {
					return d.color || color(d,i);
				}
			}


			function setBGOpacity(d,i) {
				if(expanded && (vers == 'furious' || vers == 'owd')) {
					return 1;
				} else {
					return !!d.disabled ? 0 : 1;
				}
			}

			return chart;
		}

		//============================================================
		// Expose Public Variables
		//------------------------------------------------------------

		chart.dispatch = dispatch;
		chart.options = nv.utils.optionsFunc.bind(chart);

		chart._options = Object.create({}, {
			// simple options, just get/set the necessary values
			width:      {get: function(){return width;}, set: function(_){width=_;}},
			height:     {get: function(){return height;}, set: function(_){height=_;}},
			key:        {get: function(){return getKey;}, set: function(_){getKey=_;}},
			align:      {get: function(){return align;}, set: function(_){align=_;}},
			rightAlign:    {get: function(){return rightAlign;}, set: function(_){rightAlign=_;}},
			padding:       {get: function(){return padding;}, set: function(_){padding=_;}},
			updateState:   {get: function(){return updateState;}, set: function(_){updateState=_;}},
			radioButtonMode:    {get: function(){return radioButtonMode;}, set: function(_){radioButtonMode=_;}},
			expanded:   {get: function(){return expanded;}, set: function(_){expanded=_;}},
			vers:   {get: function(){return vers;}, set: function(_){vers=_;}},

			// options that require extra logic in the setter
			margin: {get: function(){return margin;}, set: function(_){
				margin.top    = _.top    !== undefined ? _.top    : margin.top;
				margin.right  = _.right  !== undefined ? _.right  : margin.right;
				margin.bottom = _.bottom !== undefined ? _.bottom : margin.bottom;
				margin.left   = _.left   !== undefined ? _.left   : margin.left;
			}},
			color:  {get: function(){return color;}, set: function(_){
				color = nv.utils.getColor(_);
			}}
		});

		nv.utils.initOptions(chart);

		return chart;
	};

})();