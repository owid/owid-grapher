;(function() {	
	"use strict";
	owid.namespace("App.Views.Chart.Legend");

	// HACK (Mispy): Avoid duplication in legend when there are multiple
	// split series for styling purposes.
	function getData(data) {
		if (data.length == 0 || !data[0].origKey)
			return data;
		return _.filter(data, function(series) { return !series.isCopy; });
	}

	App.Views.Chart.Legend = owid.View.extend({
		initialize: function() {
			this.dispatch = d3.dispatch('legendClick', 'legendDblclick', 'legendMouseover', 'legendMouseout', 'stateChange', 'addEntity');
		},

		render: function() {
			var localData = App.DataModel.transformData(),
				entityType = App.ChartModel.get("entity-type"),
				addCountryMode = App.ChartModel.get("add-country-mode"),
				groupByVariables = App.ChartModel.get("group-by-variables");

			var $svg = $("svg.nvd3-svg"),
				container = d3.select($svg[0]),
				offsetX = 35, offsetY = 0,
				availableWidth = $svg.width() - offsetX,
				spaceBetweenLabels = 38,
				spaceBetweenLines = 32;

			var wrap = container.selectAll('g.nv-custom-legend').data([1]),
				gEnter = wrap.enter().append('g').attr('class', 'nvd3 nv-custom-legend').append('g').attr('class', 'nv-legend-series-wrapper'),
				g = wrap.select('g');

			var series = g.selectAll('.nv-series')
				.data(localData);

			var seriesEnter = series.enter().append('g').attr('class', function(d) { return 'nv-series nv-series-' + d.id; } );

			seriesEnter.append('rect')
				.style('stroke-width', 2)
				.attr('class','nv-legend-symbol');

			if (addCountryMode == "add-country" && !groupByVariables) {
				var removeBtns = seriesEnter.append('g')
					.attr('class', 'nv-remove-btn')
					.attr('transform', 'translate(10,10)');
				removeBtns.append('path').attr({ 'd': 'M0,0 L7,7', 'class': 'nv-box' });
				removeBtns.append('path').attr({ 'd': 'M7,0 L0,7', 'class': 'nv-box' });
			}
				
			seriesEnter.append('text')
				.attr('text-anchor', 'start')
				.attr('class','nv-legend-text')
				.attr('dy', '.32em')
				.attr('dx', '0');

			var seriesShape = series.select('.nv-legend-symbol'),
				seriesText = series.select('text.nv-legend-text'),
				seriesRemove = series.select('.nv-remove-btn');

			series
				.on('click', function(d,i) {
					if (App.ChartModel.get("group-by-variables") || addCountryMode !== "add-country") {
						return;
					} 
					App.ChartModel.removeSelectedCountry(d.entityName);
				});

			series.exit().remove();

			seriesText.text(function(d) { return d.key; });

			// Position the labels
			var transformX = 0, transformY = 0;
			series.each(function(d, i) {
				var legendText = d3.select(this).select('text');
				var nodeTextLength = legendText.node().getComputedTextLength();

				if (transformX+nodeTextLength+spaceBetweenLabels > availableWidth)  {
					transformY += spaceBetweenLines;
					transformX = 0;
				}

				d3.select(this).attr("transform", "translate(" + transformX + "," + transformY + ")");

				transformX += nodeTextLength + spaceBetweenLabels;
			});

			g.attr('transform', 'translate(' + offsetX + ',' + offsetY + ')');			
			
			// Size the rectangles around the positioned text	
			seriesShape
				.attr('width', function(d,i) {
					//position remove btn
					var width = seriesText[0][i].getComputedTextLength() + 5;
					d3.select(seriesRemove[0][i]).attr('transform', 'translate(' + width + ',-3)');
					return width+29;
				})
				.attr('height', 26)
				.attr('y', -13)
				.attr('x', -13);

			seriesShape.style('fill', function(d, i) {
				return d.color || nv.utils.getColor(d, i);
			});

			// Create and position add entity button
			var addEntityBtn = wrap.select('g.nv-add-btn'),
				isNewAddBtn = addEntityBtn.empty(),
				isAddBtnShown = (addCountryMode === "add-country" || addCountryMode === "change-country");

			if (isNewAddBtn) {
				addEntityBtn = wrap.append('g').attr('class', 'nv-add-btn');
				var addEntityBtnG = addEntityBtn.append('g').attr({ 'class': 'add-btn-path' });
				addEntityBtnG.append('path').attr({ 'd': 'M15,0 L15,14', 'class': 'nv-box' });
				addEntityBtnG.append('path').attr({ 'd': 'M8,7 L22,7', 'class': 'nv-box' });
				//http://android-ui-utils.googlecode.com/hg-history/ac955e6376470d9599ead07b4599ef937824f919/asset-studio/dist/res/clipart/icons/refresh.svg?r=ac955e6376470d9599ead07b4599ef937824f919
				addEntityBtn.append('path').attr({ 'd': 'M160.469,242.194c0-44.414,36.023-80.438,80.438-80.438c19.188,0,36.711,6.844,50.5,18.078L259.78,209.93l99.945,11.367    l0.805-107.242l-30.766,29.289c-23.546-21.203-54.624-34.164-88.804-34.164c-73.469,0-133.023,59.562-133.023,133.016    c0,2.742,0.242-2.266,0.414,0.445l53.68,7.555C161.03,245.108,160.469,247.562,160.469,242.194z M371.647,237.375l-53.681-7.555    c1.017,5.086,1.556,2.617,1.556,7.992c0,44.414-36.008,80.431-80.43,80.431c-19.133,0-36.602-6.798-50.383-17.97l31.595-30.078    l-99.93-11.366l-0.812,107.25l30.789-29.312c23.531,21.141,54.57,34.055,88.688,34.055c73.468,0,133.023-59.555,133.023-133.008    C372.062,235.078,371.812,240.085,371.647,237.375z', 'class': 'nv-box change-btn-path', 'transform': 'scale(.04) translate(150,-50)' });
				addEntityBtn.append('text').attr({'x':28,'y':11});
				addEntityBtn.on('click', function(d, i) {
					this.dispatch.addEntity();
					d3.event.stopImmediatePropagation();
				}.bind(this));
				addEntityBtn.insert('rect', '*').attr('class', 'add-btn-bg');
			}

			if (addCountryMode === "add-country") {
				addEntityBtn.select("text").text("Add " + entityType);
				addEntityBtn.select(".add-btn-path" ).attr( "display", "block");
				addEntityBtn.select(".change-btn-path" ).attr( "display", "none");
			} else if (addCountryMode === "change-country") {
				addEntityBtn.select(".add-btn-path").attr("display", "none");
				addEntityBtn.select(".change-btn-path").attr("display", "block");
				addEntityBtn.select("text").text("Change " + entityType);
			}

			if (isAddBtnShown) {
				addEntityBtn.attr("display", "block");
			} else {
				addEntityBtn.attr("display", "none");
			}

			if (isNewAddBtn) {
				addEntityBtn.select("rect")
					.attr({ width: addEntityBtn.node().getBoundingClientRect().width + 15, height: '25', transform: 'translate(0,-5)' });
			}

			var buttonWidth = 120;
			if (transformX + buttonWidth > availableWidth) {
				//make sure we have button
				var addEntityDisplay = addEntityBtn.attr("display");
				if (addEntityDisplay !== "none") {
					transformX = 0;
					transformY += spaceBetweenLines;
				}
			}

			transformY -= 7;
			transformX += 22;
			addEntityBtn.attr("transform", "translate(" + transformX + "," + transformY + ")");
		},

		height: function() {
			return d3.select(".nv-custom-legend").node().getBBox().height;
		}
	});

	/*App.Views.Chart.Legend2 = function(chartLegend) {
	
		//based on https://github.com/novus/nvd3/blob/master/src/models/legend.js

		//============================================================
		// Public Variables with Default Settings
		//------------------------------------------------------------

		var chartType = App.ChartModel.get( "chart-type" )
			, margin = {top: 5, right: 50, bottom: 5, left: 40}
			, width = 800
			, height = 20
			, getKey = function(d) { return d.origKey || d.key }
			, color = nv.utils.getColor()
			, padding = 40 //define how much space between legend items. - recommend 32 for furious version
			, rightAlign = false
			, updateState = true   //If true, legend will update data.disabled and trigger a 'stateChange' dispatch.
			, radioButtonMode = false   //If true, clicking legend items will cause it to behave like a radio button. (only one can be selected at a time)
			, expanded = false
			;

		function chart(selection) {			
			selection.each(function(data) {
				var $svg = $( "svg.nvd3-svg" ),
					availableWidth = $svg.width() - margin.left - margin.right,
					container = d3.select(this);
				
				nv.utils.initSVG(container);

				var bindableData = getData(data);
				
				// Setup containers and skeleton of chart
				var wrap = container.selectAll('g.nv-custom-legend').data([bindableData]),
				//var wrap = container.selectAll('g.nv-custom-legend').data([data]),
					gEnter = wrap.enter().append('g').attr('class', 'nvd3 nv-custom-legend').append('g').attr( 'class', 'nv-legend-series-wrapper' ),
					g = wrap.select('g');

				wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

				var series = g.selectAll('.nv-series')
					.data(function(d) {
						return d;						
					});

				//add entity label
				var entityLabel = wrap.select( '.nv-entity-label' ),
					entityLabelText = entityLabel.select( 'text' ),
					entityLabelWidth = 0,
					entityType = App.ChartModel.get("entity-type");

				//if not existing, add nv-add-btn, if not grouping by variables
				var addEntityBtn =  wrap.select('g.nv-add-btn'),
					isNewAddBtn = addEntityBtn.empty();
				if (isNewAddBtn) {
					addEntityBtn = wrap.append('g').attr('class', 'nv-add-btn');
					var addEntityBtnG = addEntityBtn.append('g').attr( { 'class': 'add-btn-path' } );
					addEntityBtnG.append('path').attr( { 'd': 'M15,0 L15,14', 'class': 'nv-box' } );
					addEntityBtnG.append('path').attr( { 'd': 'M8,7 L22,7', 'class': 'nv-box' } );
					//http://android-ui-utils.googlecode.com/hg-history/ac955e6376470d9599ead07b4599ef937824f919/asset-studio/dist/res/clipart/icons/refresh.svg?r=ac955e6376470d9599ead07b4599ef937824f919
					addEntityBtn.append('path').attr( { 'd': 'M160.469,242.194c0-44.414,36.023-80.438,80.438-80.438c19.188,0,36.711,6.844,50.5,18.078L259.78,209.93l99.945,11.367    l0.805-107.242l-30.766,29.289c-23.546-21.203-54.624-34.164-88.804-34.164c-73.469,0-133.023,59.562-133.023,133.016    c0,2.742,0.242-2.266,0.414,0.445l53.68,7.555C161.03,245.108,160.469,247.562,160.469,242.194z M371.647,237.375l-53.681-7.555    c1.017,5.086,1.556,2.617,1.556,7.992c0,44.414-36.008,80.431-80.43,80.431c-19.133,0-36.602-6.798-50.383-17.97l31.595-30.078    l-99.93-11.366l-0.812,107.25l30.789-29.312c23.531,21.141,54.57,34.055,88.688,34.055c73.468,0,133.023-59.555,133.023-133.008    C372.062,235.078,371.812,240.085,371.647,237.375z', 'class': 'nv-box change-btn-path', 'transform': 'scale(.04) translate(150,-50)' } );
					addEntityBtn.append('text').attr( {'x':28,'y':11} ).text('Add ' + entityType);
					addEntityBtn.on('click', function(d, i) {
						dispatch.addEntity();
						d3.event.stopImmediatePropagation();
					});
					addEntityBtn.insert('rect', '*').attr('class', 'add-btn-bg');
				}

				//based on selected countries selection hide or show addEntityBtn
				if (_.isEmpty(App.ChartModel.get("selected-countries"))) {
					addEntityBtn.attr( "display", "none" );
				} else {
					addEntityBtn.attr( "display", "block" );
				}

				var addCountryMode = App.ChartModel.get( "add-country-mode" );
				if (addCountryMode === "add-country") {
					addEntityBtn.select("text" ).text("Add " + entityType);
					addEntityBtn.select(".add-btn-path" ).attr( "display", "block");
					addEntityBtn.select(".change-btn-path" ).attr( "display", "none");
					addEntityBtn.attr( "display", "block" );
				} else if (addCountryMode === "change-country") {
					addEntityBtn.select(".add-btn-path").attr("display", "none");
					addEntityBtn.select(".change-btn-path").attr("display", "block");
					addEntityBtn.select("text").text("Change " + entityType);
					addEntityBtn.attr("display", "block");
				} else {
					addEntityBtn.attr("display", "none");
				}

				if (isNewAddBtn) {
					addEntityBtn.select("rect")
						.attr({ width: addEntityBtn.node().getBoundingClientRect().width + 15, height: '25', transform: 'translate(0,-5)' });
				}
					
				var seriesEnter = series.enter().append('g').attr('class', function(d) { return 'nv-series nv-series-' + d.id; } ),
					seriesShape, seriesRemove;

				var versPadding = 30;
				seriesEnter.append('rect')
					.style('stroke-width', 2)
					.attr('class','nv-legend-symbol');

				//enable removing countries only if Add/Replace country button present
				if( addCountryMode == "add-country" && !App.ChartModel.get( "group-by-variables" ) ) {
					var removeBtns = seriesEnter.append('g')
						.attr('class', 'nv-remove-btn')
						.attr('transform', 'translate(10,10)');
					removeBtns.append('path').attr( { 'd': 'M0,0 L7,7', 'class': 'nv-box' } );
					removeBtns.append('path').attr( { 'd': 'M7,0 L0,7', 'class': 'nv-box' } );
				}
				
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
						if (App.ChartModel.get("group-by-variables") || addCountryMode !== "add-country") {
							//if displaying variables, instead of removing, use original version just to turn stuff off
							chartLegend.dispatch.legendClick(d,i);
							// make sure we re-get data in case it was modified
							var data = getData(series.data());
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
									disabled: data.map(function(d) { return !!d.disabled; }),
									disengaged: data.map(function(d) { return !!d.disengaged; })
								});
							}
							return false;
						} else {
							//when clicking country label, remove the country
							d3.event.stopImmediatePropagation();
							//remove series straight away, so we don't have to wait for response from server
							series[0][i].remove();
							
							var id = d.id;
							//in case of multivarient chart
							//id could be string or integer
							if (id.indexOf && id.indexOf("-") > 0 ) {
								id = parseInt( id.split( "-" )[ 0 ], 10 );
							} else {
								id = parseInt( id, 10 );
							}
							App.ChartModel.removeSelectedCountry(d.entityName);
							return false;
						}
					});

				series.classed('nv-disabled', function(d) { return d.userDisabled; });
				series.exit().remove();

				seriesText
					.attr('fill', setTextColor)
					.text(getKey);

				var transformX = 0, transformY = 0;
				series.each(function(d, i) {
					var legendText = d3.select(this).select('text');
					var nodeTextLength = legendText.node().getComputedTextLength();

					if (transformX+nodeTextLength > availableWidth)  {
						transformY += versPadding;
						transformX = 0;
					}

					d3.select(this).attr("transform", "translate(" + transformX + "," + transformY + ")");

					transformX += nodeTextLength + padding;
				});
				var legendWidth = availableWidth;

				//position legend as far right as possible within the total width
				if (rightAlign) {
					g.attr('transform', 'translate(' + (width - margin.right - legendWidth) + ',' + margin.top + ')');
				}
				else {
					g.attr('transform', 'translate(' + entityLabelWidth + ',' + margin.top + ')');
				}

				height = margin.top + margin.bottom + transformY + versPadding;// + (Math.ceil(seriesWidths.length / seriesPerRow) * versPadding);

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
					.attr('height', height )
					.attr('y', -margin.top - 10)
					.attr('opacity', expanded ? 1 : 0);

				seriesShape
					.style('fill', setBGColor)
					.style('fill-opacity', setBGOpacity)
					.style('stroke', setBGColor);

				//position add btn
				if (series.size()) {
					var seriesArr = series[0];
					if( seriesArr && seriesArr.length ) {
						//fetch last element to know its width
						var lastEl = seriesArr[ seriesArr.length-1 ],
							//need rect inside element that has set width
							lastRect = d3.select( lastEl ).select( "rect" ),
							lastRectWidth = lastRect.attr( "width" );
						//position add btn
						transformX -= 3;
						//centering
						transformY = +transformY - 3;
						//check for right edge
						var buttonWidth = 120, buttonHeight = 35;
						if( ( transformX + buttonWidth ) > availableWidth ) {
							//make sure we have button
							var addEntityDisplay = addEntityBtn.attr( "display" );
							if( addEntityDisplay !== "none" ) {
								transformX = 0;//availableWidth - buttonWidth;
								transformY += buttonHeight;
								//update whole chart height as well
								height += buttonHeight;
							}
						}
						addEntityBtn.attr( "transform", "translate( " + transformX + ", " + transformY + ")" );
					}
				}
			});
			
			function setTextColor(d,i) {
				if(expanded) {
					return d.disengaged ? '#000' : '#fff';
				} else if (!expanded) {
					if(!d.color) d.color = color(d,i);
					return !!d.disabled ? '#666' : '#fff';
					//return !!d.disabled ? d.color : '#fff';
				}
			}

			function setBGColor(d,i) {
				if (expanded) {
					return d.disengaged ? '#eee' : d.color || color(d,i);
				} else {
					return d.color || color(d,i);
				}
			}


			function setBGOpacity(d,i) {
				if (expanded) {
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
			rightAlign:    {get: function(){return rightAlign;}, set: function(_){rightAlign=_;}},
			padding:       {get: function(){return padding;}, set: function(_){padding=_;}},
			updateState:   {get: function(){return updateState;}, set: function(_){updateState=_;}},
			radioButtonMode:    {get: function(){return radioButtonMode;}, set: function(_){radioButtonMode=_;}},
			expanded:   {get: function(){return expanded;}, set: function(_){expanded=_;}},

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

		chart.highlightPoint = function(evt) {
			chart.clearHighlight();
			var id = ( evt && evt.point )? evt.point.id: "";
			if( id ) {
				d3.selectAll( ".nv-custom-legend .nv-series-" + id ).classed( "highlight", true );
			}
		};
		chart.clearHighlight = function(evt) {
			d3.selectAll( ".nv-custom-legend .nv-series" ).classed( "highlight", false );
		};

		nv.utils.initOptions(chart);

		return chart;
	};*/
})();