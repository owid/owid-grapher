import _ from 'lodash'
import * as d3 from 'd3'
import ChartType from './ChartType'

/**
 * This model handles the assignment and distribution of colors for
 * different entities and chart types.
 */
export default class Colors {
	static basicScheme = ["#3360a9", "#ca2628", "#34983f", "#ed6c2d", "#df3c64", "#a85a4a", "#e6332e", "#6bb537", "#ffd53e", "#f07f59", "#b077b1", "#932834", "#674c98", "#5eb77e", "#f6a324", "#2a939b", "#818282", "#7ec7ce", "#fceb8c", "#cfcd1e", "#58888f", "#ce8ebd", "#9ecc8a", "#db2445", "#f9bc8f", "#d26e66", "#c8c8c8"]

	constructor(chartView) {
		const chart = chartView.chart
		this.chart = chart
		this.basicScheme = Colors.basicScheme
		this.colorScale = d3.scaleOrdinal().range(Colors.basicScheme);
		this.colorCache = {};
		this.colorIndex = 0;

		// Clear the color cache in the editor so chart creator can see the
		// true final colors on the chart
		/*if (chartView.isEditor) {
			App.ChartModel.on("change", function() {
				this.colorCache = {};
				this.colorIndex = 0;
			}.bind(this));
		}*/

		// Make sure colors stay consistent on multi-variable "change country" charts
		// e.g. https://ourworldindata.org/grapher/composition-of-tax-revenues-regional
		/*App.ChartModel.on("change:selected-countries", function() {
			var addCountryMode = chart.addCountryMode;
			if (addCountryMode != "add-country") {
				this.colorCache = {};
				this.colorIndex = 0;
			}
		}.bind(this));*/
	}

	assignColorForKey(key, color = undefined, options = undefined) {
		options = _.extend({ canVary: true }, options);
		color = color || this.colorScale(this.colorIndex);

		// Unless the color is manually fixed, we lighten on collision
		var colorIsTaken = _.includes(_.values(this.colorCache), color);
		if (colorIsTaken && options.canVary) {
			var c = d3.rgb(color),
				magnitude = (c.r+c.g+c.b)/(255*3),
				newColor;

			//if (magnitude > 0.5)
			//	newColor = d3.rgb(color).darker().toString();
			//else
				newColor = d3.rgb(color).brighter().toString();

			if (newColor != color && newColor != "#ffffff" && newColor != "#000000")
				return this.assignColorForKey(key, newColor, options);
		}

		if (!this.colorCache[key]) {
			this.colorCache[key] = color || this.colorScale(this.colorIndex);
			this.colorIndex += 1;
		}

		return this.colorCache[key];
	}

	// We set colors for the legend data separately to give more precise control
	// over the priority and ordering, since legend data doesn't move around as much.
	assignColorsForLegend(legendData) {
		const {entityColors, addCountryMode, dimensions, isMultiVariable, isMultiEntity} = this.chart

		_.each(legendData, function(group) {
			const entityColor = entityColors[group.entityId]
			const dimension = _.find(dimensions, dim => dim.variableId == group.variableId)

			if (group.color) {
				group.color = this.assignColorForKey(group.key, group.color, { canVary: false });
			} else if (entityColor) {
				group.color = this.assignColorForKey(group.key, entityColor, { canVary: isMultiVariable });
			} else if (dimension && dimension.color) {
				group.color = this.assignColorForKey(group.key, dimension.color, { canVary: isMultiEntity });
			} else if (isMultiEntity) {
				// If in multi-variable, multi-entity mode, two entity labels are colored along the same gradient
				if (this.colorCache[group.entityId])
					group.color = this.assignColorForKey(group.key, this.colorCache[group.entityId]);
				else {
					group.color = this.assignColorForKey(group.key);
					this.colorCache[group.entityId] = group.color;
				}
			} else {
				group.color = this.assignColorForKey(group.key);
			}
		}.bind(this));
	}

	assignColorsForChart(chartData) {
		const {chart} = this

		_.each(chartData, function(series) {
			if (chart.type == ChartType.DiscreteBar || chart.type == ChartType.ScatterPlot) {
				_.each(series.values, function(d) {
					d.color = this.assignColorForKey(d.key, d.color);
				}.bind(this));
			} else {
				series.color = this.assignColorForKey(series.key, series.color);
			}
		}.bind(this));

		return chartData;
	}
}
