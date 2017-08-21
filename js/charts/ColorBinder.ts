import * as _ from 'lodash'
import * as d3 from 'd3'
import ChartType from './ChartType'
import ChartConfig from './ChartConfig'
import {computed, reaction} from 'mobx'
import Color from './Color'

interface ColorBinderProps {
	chart: ChartConfig
	colorScheme: Color[]
}

export default class ColorBinder {
	props: ColorBinderProps
	constructor(props: ColorBinderProps) {
		this.props = props
	}

    @computed get colorScale() {
		return d3.scaleOrdinal(this.props.colorScheme)
//        return d3.scaleOrdinal().range(["#3360a9", "#ca2628", "#34983f", "#ed6c2d", "#df3c64", "#a85a4a", "#e6332e", "#6bb537", "#ffd53e", "#f07f59", "#b077b1", "#932834", "#674c98", "#5eb77e", "#f6a324", "#2a939b", "#818282", "#7ec7ce", "#fceb8c", "#cfcd1e", "#58888f", "#ce8ebd", "#9ecc8a", "#db2445", "#f9bc8f", "#d26e66", "#c8c8c8"])
    }

	getColorForKey(key: string) {
		return this.props.chart.data.keyColors[key] || this.colorScale(key)
		/*color = color || this.colorScale(this.colorIndex.toString());

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
		}*/
	}

}

/**
 * This model handles the assignment and distribution of colors for
 * different entities and chart types.
 */
/*export class ColorBinderOld {
	static basicScheme = ["#3360a9", "#ca2628", "#34983f", "#ed6c2d", "#df3c64", "#a85a4a", "#e6332e", "#6bb537", "#ffd53e", "#f07f59", "#b077b1", "#932834", "#674c98", "#5eb77e", "#f6a324", "#2a939b", "#818282", "#7ec7ce", "#fceb8c", "#cfcd1e", "#58888f", "#ce8ebd", "#9ecc8a", "#db2445", "#f9bc8f", "#d26e66", "#c8c8c8"]

    chart: ChartConfig

    @computed get colorScale() {
        return d3.scaleOrdinal().range(ColorBinder.basicScheme)
    }

   colorCache: {[key: string]: Color} = {}
   colorIndex: number = 0

	constructor(chart: ChartConfig) {
        this.chart = chart

		// Clear the color cache in the editor so chart creator can see the
		// true final colors on the chart
        if (App.isEditor) {
            reaction(
                () => chart.json,
                () => {
                    this.colorCache = {}
                    this.colorIndex = 0
                }
            )
        }

		// Make sure colors stay consistent on multi-variable "change country" charts
		// e.g. https://ourworldindata.org/grapher/composition-of-tax-revenues-regional
		App.ChartModel.on("change:selected-countries", function() {
			var addCountryMode = chart.addCountryMode;
			if (addCountryMode != "add-country") {
				this.colorCache = {};
				this.colorIndex = 0;
			}
		}.bind(this));
	}

	assignColorForKey(key: string, color?: string, options?: any) {
		options = _.extend({ canVary: true }, options);
		color = color || this.colorScale(this.colorIndex.toString());

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
			this.colorCache[key] = color || this.colorScale(this.colorIndex.toString());
			this.colorIndex += 1;
		}

		return this.colorCache[key];
	}

	// We set colors for the legend data separately to give more precise control
	// over the priority and ordering, since legend data doesn't move around as much.
	assignColorsForLegend(legendData) {
		const {keyColors, addCountryMode, dimensions, isMultiVariable, isMultiEntity} = this.chart

		_.each(legendData, function(group) {
			const entityColor = keyColors[group.key]
			const dimension = _.find(dimensions, dim => dim.variableId == group.variableId)

			if (group.color) {
				group.color = this.assignColorForKey(group.key, group.color, { canVary: false });
			} else if (entityColor) {
				group.color = this.assignColorForKey(group.key, entityColor, { canVary: isMultiVariable });
			} else if (dimension && dimension.color) {
				group.color = this.assignColorForKey(group.key, dimension.color, { canVary: isMultiEntity });
			} else if (isMultiEntity) {
				// If in multi-variable, multi-entity mode, two entity labels are colored along the same gradient
				if (this.colorCache[group.key])
					group.color = this.assignColorForKey(group.key, this.colorCache[group.key]);
				else {
					group.color = this.assignColorForKey(group.key);
					this.colorCache[group.key] = group.color;
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
}*/
