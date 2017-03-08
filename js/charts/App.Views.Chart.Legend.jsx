import owid from '../owid'

// TODO: Reactify
export default class Legend {
	constructor() {
		this.dispatch = d3.dispatch('legendClick', 'legendDblclick', 'legendMouseover', 'legendMouseout', 'stateChange', 'addEntity');
	}

	render(config) {
		var container = d3.select(config.containerNode),
			bounds = config.bounds.padLeft(35);

		var legendData = App.ChartData.get("legendData"),
			entityType = App.ChartModel.get("entity-type"),
			groupByVariables = App.ChartModel.get("group-by-variables"),
			addCountryMode = App.ChartModel.get("add-country-mode"),
			remainingEntities = App.VariableData.getRemainingEntities(),
			isAddBtnShown = (remainingEntities.length && (addCountryMode === "add-country" || addCountryMode === "change-country"));

		var offsetX = bounds.left, offsetY = bounds.top,
			spaceBetweenLabels = 22,
			spaceBetweenLines = 28;

		var wrap = container.selectAll('g.nv-custom-legend').data([1]),
			gEnter = wrap.enter().append('g').attr('class', 'nvd3 nv-custom-legend').append('g').attr('class', 'nv-legend-series-wrapper'),
			g = wrap.select('g');

		var series = g.selectAll('.nv-series')
			.data(legendData);

		var seriesEnter = series.enter().append('g').attr('class', function(d) { return 'nv-series'; } );

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
				if (addCountryMode !== "add-country") {
					App.ChartModel.toggleLegendKey(d.key);
				} else {
					App.ChartModel.removeSelectedCountry(d.entityId);						
				}
			});

		series.classed('nv-disabled', function(d) { return d.disabled; });
		series.exit().remove();

		seriesText.text(function(d) { return d.label||d.key; });

		// Position the labels
		var transformX = 0, transformY = 0;
		series.each(function(d, i) {
			var legendText = d3.select(this).select('text');
			var nodeTextLength = legendText.node().getComputedTextLength();

			if (transformX+nodeTextLength+spaceBetweenLabels > bounds.width)  {
				transformY += spaceBetweenLines;
				transformX = 0;
			}

			d3.select(this).attr("transform", "translate(" + transformX + "," + transformY + ")");

			transformX += nodeTextLength + spaceBetweenLabels;
		});

		g.attr('transform', 'translate(' + offsetX + ',' + (offsetY+12) + ')');			
		
		// Size the rectangles around the positioned text	
		seriesShape
			.attr('width', function(d,i) {
				//position remove btn
				var width = seriesText[0][i].getComputedTextLength();
				d3.select(seriesRemove[0][i]).attr('transform', 'translate(' + (width+2) + ',-3) scale(0.8)');
				return width+18;
			})
			.attr('height', 24)
			.attr('y', -12)
			.attr('x', -8);

		seriesShape.style('fill', function(d, i) {
			return d.color || nv.utils.getColor(d, i);
		}).style('stroke', function(d, i) {
			return d.color || nv.utils.getColor(d, i);
		});

		// Create and position add entity button
		var addEntityBtn = wrap.select('g.nv-add-btn'),
			isNewAddBtn = addEntityBtn.empty();

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
		if (transformX + buttonWidth > bounds.width) {
			//make sure we have button
			var addEntityDisplay = addEntityBtn.attr("display");
			if (addEntityDisplay !== "none") {
				transformX = 0;
				transformY += spaceBetweenLines;
			}
		}

		transformX += 28;
		addEntityBtn.attr("transform", "translate(" + (bounds.left+transformX-35) + "," + (bounds.top+transformY+5) + ")");
	}

	height() {
		var legend = d3.select('.nv-custom-legend');
		if (legend.node())
			return legend.node().getBBox().height;
		else
			return 0;
	}
}