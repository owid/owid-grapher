;(function() {		
	"use strict";
	owid.namespace("App.Models.ChartData");

	App.Models.ChartData = Backbone.Model.extend({
		initialize: function() {
			App.ChartModel.on("change", function() { this.chartData = null; }.bind(this));
		},

		defaults: {
			chartData: [],
			legendData: []
		},

		ready: function(callback) {
			var variables = App.VariableData.get("variables");
			if (!variables) {
				App.VariableData.once("change:variables", function() {
					// Run this after the other handlers
					setTimeout(callback, 1);
				}.bind(this));
			} else {
				callback();
			}
		},

		transformDataForLineChart: function() {
			var dimensions = _.clone(App.ChartModel.getDimensions()).reverse(), // Keep them stacked in the same visual order as editor
				variableData = this.get('variableData'),
				variables = App.VariableData.get("variables"),
				entityKey = App.VariableData.get("entityKey"),
				timeFrom = App.ChartModel.getTimeFrom(),
				timeTo = App.ChartModel.getTimeTo(),
				selectedEntitiesById = App.ChartModel.getSelectedEntitiesById(),
				yAxis = App.ChartModel.get("y-axis"),
				addCountryMode = App.ChartModel.get("add-country-mode"),
				chartData = [], legendData = [],
				hasManyVariables = _.size(variables) > 1,
				hasManyEntities = _.size(selectedEntitiesById) > 1,
				minYear = Infinity,
				maxYear = -Infinity;

			_.each(dimensions, function(dimension) {
				var variable = variables[dimension.variableId],
					variableName = dimension.displayName || variable.name,
					seriesByEntity = {};

				for (var i = 0; i < variable.years.length; i++) {
					var year = parseInt(variable.years[i]),
						value = parseFloat(variable.values[i]),
						entityId = variable.entities[i],
						entity = selectedEntitiesById[entityId],
						series = seriesByEntity[entityId];

					// Not a selected entity, don't add any data for it
					if (!entity) continue;
					// It's possible we may be missing data for this year/entity combination
					// e.g. http://ourworldindata.org/grapher/view/101
					if (isNaN(value)) continue;
					// Values <= 0 break d3 log scales horribly
					if (yAxis['axis-scale'] === 'log' && value <= 0) continue;
					// Check for time range
					if (year < timeFrom || year > timeTo) continue;

					if (!series) {
						var key = entityKey[entityId].name,
							id = entityId;
						// If there are multiple variables per entity, we disambiguate the keys
						if (hasManyVariables) {
							id += "-" + variable.id;
							key += " - " + variableName;
						}

						series = {
							values: [],
							key: key,
							entityName: entityKey[entityId].name,
							entityId: entityId,
							variableId: variable.id,
							id: id
						};
						seriesByEntity[entityId] = series;
					}

					var prevValue = series.values[series.values.length-1];
					if (prevValue)
						prevValue.gapYearsToNext = year-prevValue.x;
					series.values.push({ x: year, y: value, time: year });
					minYear = Math.min(minYear, year);
					maxYear = Math.max(maxYear, year);
				}

				chartData = chartData.concat(_.values(seriesByEntity));
			});

			if (addCountryMode === "add-country")
				chartData = _.sortBy(chartData, function(series) { return series.entityName; });

			legendData = _.map(chartData, function(series) {
				return { label: series.key, key: series.key, entityId: series.entityId, variableId: series.variableId };
			});

			return { chartData: chartData, legendData: legendData, minYear: minYear, maxYear: maxYear };
		},

		// Ensures that every series has a value entry for every year in the data
		// Even if that value is just 0
		// Stacked area charts with incomplete data will fail to render otherwise
		zeroPadData: function(chartData) {
			var allYears = {};			
			var yearsForSeries = {};

			_.each(chartData, function(series) {
				yearsForSeries[series.id] = {};
				_.each(series.values, function(d, i) {
					allYears[d.x] = true;
					yearsForSeries[series.id][d.x] = true;
				});
			});

			_.each(chartData, function(series) {
				_.each(Object.keys(allYears), function(year) {
					year = parseInt(year);
					if (!yearsForSeries[series.id][year])
						series.values.push({ x: year, y: 0, time: year, fake: true });
				});

				series.values = _.sortBy(series.values, function(d) { return d.x; });
			});

			return chartData;
		},

		// Zero pads for every single year in the data
		zeroPadDataRange: function(chartData) {
			var minYear = Infinity, maxYear = -Infinity;
			_.each(chartData, function(series) {
				minYear = Math.min(minYear, series.values[0].x);
				maxYear = Math.max(maxYear, series.values[series.values.length-1].x);
			});

			var yearsForSeries = {};
			_.each(chartData, function(series) {
				yearsForSeries[series.id] = {};
				_.each(series.values, function(d, i) {
					yearsForSeries[series.id][d.x] = true;
				});
			});

			_.each(chartData, function(series) {
				for (var year = minYear; year <= maxYear; year++) {					
					if (!yearsForSeries[series.id][year])
						series.values.push({ x: year, y: 0, time: year, fake: true });
				}
				series.values = _.sortBy(series.values, function(d) { return d.x; });
			});

			return chartData;			
		},

		transformDataForStackedArea: function() {
			if (!App.ChartModel.get("group-by-variables")) {
				var result = this.transformDataForLineChart();
				result.chartData = this.zeroPadData(result.chartData);
				return result;
			}

			var dimensions = App.ChartModel.getDimensions(),
				variableData = this.get('variableData'),
				variables = App.VariableData.get("variables"),
				entityKey = App.VariableData.get("entityKey"),
				// Group-by-variable chart only has one selected country
				selectedCountry = _.values(App.ChartModel.getSelectedEntitiesById())[0],
				chartData = [], legendData = [],
				timeFrom = App.ChartModel.getTimeFrom(),
				timeTo = App.ChartModel.getTimeTo(),				
				minYear = Infinity,
				maxYear = -Infinity;

			_.each(dimensions, function(dimension) {
				var variable = variables[dimension.variableId];

				var series = {
					id: variable.id,
					key: dimension.displayName || variable.name,
					entityName: selectedCountry.name,
					entityId: selectedCountry.id,
					variableId: dimension.variableId,
					values: []
				};

				for (var i = 0; i < variable.years.length; i++) {
					var year = parseInt(variable.years[i]),
						value = parseFloat(variable.values[i]),
						entityId = variable.entities[i];

					if (entityId != selectedCountry.id) continue;
					if (year < timeFrom || year > timeTo) continue;

					series.values.push({ x: year, y: value, time: year });
					minYear = Math.min(minYear, year);
					maxYear = Math.max(maxYear, year);
				}

				chartData.push(series);
			});

			chartData = this.zeroPadData(chartData);

			legendData = _.map(chartData, function(series) {
				return { label: series.label, key: series.key, entityId: series.entityId, variableId: series.variableId };
			});

			return { chartData: chartData, legendData: legendData, minYear: minYear, maxYear: maxYear };
		},

		makeCategoryTransform: function(property, values) {
			var colors = [ "#aec7e8", "#ff7f0e", "#1f77b4", "#ffbb78", "#2ca02c", "#98df8a", "#d62728", "#ff9896", "#9467bd", "#c5b0d5", "#8c564b", "c49c94", "e377c2", "f7b6d2", "7f7f7f", "c7c7c7", "bcbd22", "dbdb8d", "17becf", "9edae5", "1f77b4" ];
			var shapes = [ "circle", "cross", "triangle-up", "triangle-down", "diamond", "square" ];

			var outputValues = property == "color" ? colors : shapes,
				index = 0,
				categoryTransform = {};

			_.each(_.sortBy(_.uniq(values)), function(value) { 
				categoryTransform[value] = outputValues[index];
				index += 1;
				if (index >= outputValues.length) index = 0;
			});

			return categoryTransform;
		},

		transformDataForScatterPlot: function() {
			var dimensions = App.ChartModel.getDimensions(),
				variables = App.VariableData.get("variables"),
				entityKey = App.VariableData.get("entityKey"),
				selectedEntitiesById = App.ChartModel.getSelectedEntitiesById(),
				seriesByEntity = {},
				// e.g. for colors { var_id: { 'Oceania': '#ff00aa' } }
				categoryTransforms = {},				
				chartData = [], legendData = [];

			var latestYearInData = _.max(_.map(variables, function(v) { return _.max(v.years); }));

			_.each(dimensions, function(dimension) {
				var variable = variables[dimension.variableId],
				    targetYear = parseInt(dimension.targetYear),
				    targetMode = dimension.mode,
				    tolerance = parseInt(dimension.tolerance),
				    maximumAge = parseInt(dimension.maximumAge),
				    isCategorical = _.include(['color', 'shape'], dimension.property),
				    categoryTransform = categoryTransforms[variable.id];

				if (isCategorical && !categoryTransform) {
					categoryTransform = this.makeCategoryTransform(dimension.property, variable.values);
				}

				for (var i = 0; i < variable.years.length; i++) {
					var year = parseInt(variable.years[i]),
						value = variable.values[i],
						entityId = variable.entities[i],
						entity = selectedEntitiesById[entityId],
						series = seriesByEntity[entityId];						

					// Scatterplot defaults to showing all countries if none selected
					if (!_.isEmpty(selectedEntitiesById) && !entity) continue;

					if (!series) {
						series = {
							values: [{ time: {} }],
							key: entityKey[entityId].name,
							entityName: entityKey[entityId].name,
							entityId: entityId,
							variableId: dimension.variableId,
							id: entityId
						};
						seriesByEntity[entityId] = series;
					}

					// Categorical data like color or shape just goes straight on the series
					if (isCategorical) {
						series[dimension.property] = categoryTransform[value];
						continue;
					}

					if (targetMode === "specific") {
						// Not within target year range, ignore
						if (year < targetYear-tolerance || year > targetYear+tolerance)
							continue;

						// Make sure we use the closest year within tolerance (favoring later years)
						var current = series.values[0].time[dimension.property];
						if (current && Math.abs(current - targetYear) < Math.abs(year - targetYear))
							continue;
					} else if (targetMode == "latest" && !isNaN(maximumAge)) {
						if (year < latestYearInData-maximumAge)
							continue;
					}

					// All good, put the data in. Note that a scatter plot only has one value per entity.
					var datum = series.values[0];
					datum[dimension.property] = parseFloat(value);
					datum.time[dimension.property] = year;
				}
			}.bind(this));

			// Exclude any countries which lack data for one or more variables
			_.each(seriesByEntity, function(series) {
				var isComplete = _.every(dimensions, function(dim) {
					return dim.property == "color" || series.values[0].hasOwnProperty(dim.property);
				});

				if (isComplete)
					chartData.push(series);
			}.bind(this));

			var minYear = _.min(_.map(chartData, function(entityData) {
				return _.min(_.values(entityData.values[0].time));
			}));
			var maxYear = _.max(_.map(chartData, function(entityData) {
				return _.max(_.values(entityData.values[0].time));
			}));

			legendData = _.map(chartData, function(series) {
				return { label: series.key, key: series.key, entityId: series.entityId, variableId: series.variableId };
			});

			return { chartData: chartData, minYear: minYear, maxYear: maxYear };
		},


		transformDataForDiscreteBar: function() {
			var dimensions = App.ChartModel.getDimensions(),
				variables = App.VariableData.get("variables"),
				entityKey = App.VariableData.get("entityKey"),
				timeFrom = App.ChartModel.getTimeFrom(),
				timeTo = App.ChartModel.getTimeTo(),
				selectedCountriesById = App.ChartModel.getSelectedEntitiesById(),
				targetYear,
				chartData = [], legendData = [];


			_.each(dimensions, function(dimension) {
				var variable = variables[dimension.variableId],
				    valuesByEntity = {};

				if (_.isFinite(timeTo))
				    targetYear = _.sortBy(variable.years, function(year) { return Math.abs(year-timeTo); })[0];
				else
					targetYear = _.max(variable.years);

				var series = {
					values: [],
					key: variable.name,
					id: dimension.variableId
				};

				for (var i = 0; i < variable.years.length; i++) {
					var year = parseInt(variable.years[i]),
						entityId = variable.entities[i],
						entity = selectedCountriesById[entityId];

					if (!entity) continue;

					var value = valuesByEntity[entityId];

					if (year != targetYear) continue;

					value = {
						time: year,
						x: entityKey[entityId].name,
						y: +variable.values[i],
						key: entityKey[entityId].name,
						entityId: entityId,
						variableId: dimension.variableId
					};

					valuesByEntity[entityId] = value;
				}

				_.each(valuesByEntity, function(value) {
					series.values.push(value);
				});

				series.values = _.sortBy(series.values, 'y');
				chartData.push(series);
			}.bind(this));

			if (chartData.length) {
				legendData = _.map(chartData[0].values, function(v) {
					return { label: v.x, key: v.key, entityId: v.entityId, variableId: v.variableId };
				});				
			}

			return { chartData: chartData, legendData: legendData, minYear: targetYear, maxYear: targetYear };
		},

		getSourceDescHtml: function(variable, source) {
			var html = '';
			
			html += '<div class="datasource-wrapper">' + 
				   		'<h2>' + variable.name + '</h2>';


			html += 	'<table class="variable-desc">';

			if (variable.description)
				html +=		'<tr><td>Variable description</td><td>' + variable.description + '</td>';
			if (variable.coverage)
				html += 	'<tr><td>Variable geographic coverage</td>' + variable.coverage + '</td>';
			if (variable.timespan)
				html += 	'<tr><td>Variable time span</td>' + variable.timespan + '</td>';

			html += 	'</table>';

			html +=	   	source.description +
					'</div>';


			return html;
		},

		transformDataForSources: function() {
			var variables = App.VariableData.get("variables");
			if (!variables) return [];

			var sources = _.map(App.ChartModel.getDimensions(), function(dimension) {
				var variable = variables[dimension.variableId],
					source = _.extend({}, variable.source);

				source.description = this.getSourceDescHtml(variable, variable.source);
				return source;
			}.bind(this));

			// HACK (Mispy): Ignore the default color source on scatterplots.
			sources = _.filter(sources, function(source) { return source.name != "CIA's fact book"});

			return sources;
			//return _.uniq(sources, function(source) { return source.name; });
		},

		transformData: function() {
			if (this.chartData)
				return this.get("chartData");

			var variables = App.VariableData.get("variables"),
				chartType = App.ChartModel.get("chart-type"),
				addCountryMode = App.ChartModel.get("add-country-mode"),
				result = null;

			if (!variables || !App.ChartModel.hasVariables()) return [];

			if (chartType == App.ChartType.LineChart)
				result = this.transformDataForLineChart();
			else if (chartType == App.ChartType.ScatterPlot)
				result = this.transformDataForScatterPlot();
			else if (chartType == App.ChartType.StackedArea)
				result = this.transformDataForStackedArea();	
			else if (chartType == App.ChartType.DiscreteBar)
				result = this.transformDataForDiscreteBar();
			else
				result = this.transformDataForLineChart();

			if (addCountryMode != "add-country") {			
				_.each(result.legendData, function(d) {
					d.disabled = !App.ChartModel.isLegendKeyActive(d.key);
				});
				_.each(result.chartData, function(d) {
					d.disabled = !App.ChartModel.isLegendKeyActive(d.key);
				});
			}
			App.Colors.assignColorsForLegend(result.legendData);
			App.Colors.assignColorsForChart(result.chartData);
			this.chartData = result.chartData;
			this.set(result);
			return result.chartData;
		}
	});
})();