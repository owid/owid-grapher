;(function() {		
	"use strict";

	window.App = window.App || {};
	App.Models = App.Models || {};

	/**
	 * This model handles the mass retrieval of data values associated with one
	 * or more variables, and is responsible for transforming the raw data into
	 * formats appropriate for use by the charts or other frontend systems.
	 **/
	App.Models.ChartDataModel = Backbone.Model.extend({
		defaults: {},

		initialize: function () {
			App.ChartModel.on("change:chart-dimensions", this.update.bind(this));
			App.ChartModel.on("change", function() { this.chartData = null; }.bind(this));
			this.update();
		},

		update: function() 	{	
			if (this.dataRequest) {
				this.dataRequest.abort();
				this.dataRequest = null;
			}

			var dimensions = App.ChartModel.getDimensions();
			var variableIds = _.map(dimensions, function(dim) { return dim.variableId; });
			if (_.isEmpty(variableIds)) {
				this.setEmptyData();
				return;
			}

			this.isReady = false;
			this.set("variableData", null, { silent: true });
			// There's no cache tag in the editor
			var cacheTag = App.ChartModel.get("variableCacheTag");
			if (cacheTag)
				this.dataRequest = $.get(Global.rootUrl + "/data/variables/" + variableIds.join("+") + "?v=" + App.ChartModel.get("variableCacheTag"));
			else
				this.dataRequest = $.get(Global.rootUrl + "/data/variables/" + variableIds.join("+"));
			this.dataRequest.done(function(rawData) {
				this.dataRequest = null;
				this.receiveData(rawData);
			}.bind(this));
		},

		receiveData: function(rawData) {
			var variableData = {};

			var lines = rawData.split("\r\n");

			lines.forEach(function(line, i) {
				if (i === 0) { // First line contains the basic variable metadata 
					variableData = JSON.parse(line);
				} else if (i == lines.length-1) { // Final line is entity id => name mapping
					variableData.entityKey = JSON.parse(line);
				} else {
					var points = line.split(";");
					var variable;
					points.forEach(function(d, j) {
						if (j === 0) {
							variable = variableData.variables[d];
						} else {
							var spl = d.split(",");
							variable.years.push(spl[0]);
							variable.entities.push(spl[1]);
							variable.values.push(spl[2]);
						}
					});
				}
			});

			// We calculate some basic metadata that is likely to be useful to everyone
			var startYears = _.map(variableData.variables, function(v) { return _.first(v.years); });
			var endYears = _.map(variableData.variables, function(v) { return _.last(v.years); });
			var minYear = _.min(startYears);
			var maxYear = _.max(endYears);

			var availableEntities = [];
			_.each(variableData.entityKey, function(entity, id) {
				availableEntities.push(_.extend({}, entity, { "id": +id }));
			});

			window.variableData = variableData;
			this.isReady = true;
			this.set({ variableData: variableData, minYear: minYear, maxYear: maxYear, availableEntities: availableEntities });
			this.validateEntities();
		},

		// When chart dimensions change, double check that our selected entities are valid
		// And set some new defaults if they're not or missing
		validateEntities: function() {
			var chartType = App.ChartModel.get("chart-type"),
				availableEntities = App.DataModel.get("availableEntities"),
				selectedEntities = App.ChartModel.get("selected-countries"),
				availableEntitiesById = _.indexBy(availableEntities, 'id');

			var validEntities = _.filter(selectedEntities, function(entity) {
				return availableEntitiesById[entity.id];
			});

			if (_.isEmpty(validEntities) && chartType != App.ChartType.ScatterPlot && chartType != App.ChartType.DiscreteBar) {
				// Select a few random ones
				validEntities = _.sample(availableEntities, 3);
			}

			App.ChartModel.set("selected-countries", validEntities);
		},

		// Replicates the state we would expect if there were simply no available data
		setEmptyData: function() {
			this.set({
				variableData: { variables: {}, entityKey: {} },
				minYear: Infinity,
				maxYear: -Infinity,
				availableEntities: []
			});
		},

		ready: function(callback) {
			var variableData = this.get("variableData");
			if (!variableData) {
				this.once("change:variableData", function() {
					callback(this.get("variableData"));
				}.bind(this));
			} else {
				callback(variableData);
			}
		},

		transformDataForLineChart: function() {
			var dimensions = _.clone(App.ChartModel.getDimensions()).reverse(), // Keep them stacked in the same visual order as editor
				variableData = this.get('variableData'),
				variables = variableData.variables,
				entityKey = variableData.entityKey,
				selectedCountriesById = App.ChartModel.getSelectedEntitiesById(),
				yAxis = App.ChartModel.get("y-axis"),
				chartData = [],
				hasManyVariables = _.size(variables) > 1,
				hasManyEntities = _.size(selectedCountriesById) > 1,
				minTransformedYear = Infinity,
				maxTransformedYear = -Infinity;

			_.each(dimensions, function(dimension) {
				var variable = variables[dimension.variableId],
					variableName = dimension.displayName || variable.name,
					seriesByEntity = {};

				for (var i = 0; i < variable.years.length; i++) {
					var year = parseInt(variable.years[i]),
						value = parseFloat(variable.values[i]),
						entityId = variable.entities[i],
						entity = selectedCountriesById[entityId],
						series = seriesByEntity[entityId];

					// Not a selected entity, don't add any data for it
					if (!entity) continue;
					// It's possible we may be missing data for this year/entity combination
					// e.g. http://ourworldindata.org/grapher/view/101
					if (isNaN(value)) continue;
					// Values <= 0 break d3 log scales horribly
					if (yAxis['axis-scale'] === 'log' && value <= 0) continue;

					if (!series) {
						var key = entityKey[entityId].name,
							id = entityId;
						// If there are multiple variables per entity, we disambiguate the legend
						if (hasManyVariables) {
							id += "-" + variable.id;

							if (!hasManyEntities) {
								key = variableName;
							} else {
								key += " - " + variableName;
							}
						}

						series = {
							values: [],
							key: key,
							entityName: entityKey[entityId].name,
							entityId: entityId,
							id: id
						};
						seriesByEntity[entityId] = series;
					}

					var prevValue = series.values[series.values.length-1];
					if (prevValue)
						prevValue.gapYearsToNext = year-prevValue.x;
					series.values.push({ x: year, y: value, time: year });
					minTransformedYear = Math.min(minTransformedYear, year);
					maxTransformedYear = Math.max(maxTransformedYear, year);
				}

				var sorted = _.sortBy(seriesByEntity, function(v) { return v.entityName; });
				chartData = chartData.concat(sorted);
			});

			this.minTransformedYear = minTransformedYear;
			this.maxTransformedYear = maxTransformedYear;
			return chartData;
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
			if (App.ChartModel.get("group-by-variables") == false)
				return this.zeroPadData(this.transformDataForLineChart());

			var dimensions = App.ChartModel.getDimensions(),
				variableData = this.get('variableData'),
				variables = variableData.variables,
				entityKey = variableData.entityKey,
				// Group-by-variable chart only has one selected country
				selectedCountry = _.values(App.ChartModel.getSelectedEntitiesById())[0],
				chartData = [],
				minTransformedYear = Infinity,
				maxTransformedYear = -Infinity;

			_.each(dimensions, function(dimension) {
				var variable = variables[dimension.variableId];

				var series = {
					id: variable.id,
					key: dimension.displayName || variable.name,
					entityName: selectedCountry.name,
					values: []
				};

				for (var i = 0; i < variable.years.length; i++) {
					var year = parseInt(variable.years[i]),
						value = parseFloat(variable.values[i]),
						entityId = variable.entities[i];

					if (entityId != selectedCountry.id) continue;

					series.values.push({ x: year, y: value, time: year });
					minTransformedYear = Math.min(minTransformedYear, year);
					maxTransformedYear = Math.max(maxTransformedYear, year);
				}

				chartData.push(series);
			});

			this.minTransformedYear = minTransformedYear;
			this.maxTransformedYear = maxTransformedYear;
			return this.zeroPadData(chartData);
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
				variableData = this.get('variableData'),
				variables = variableData.variables,
				entityKey = variableData.entityKey,
				selectedCountriesById = App.ChartModel.getSelectedEntitiesById(),
				seriesByEntity = {},
				// e.g. for colors { var_id: { 'Oceania': '#ff00aa' } }
				categoryTransforms = {},				
				chartData = [];

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
						entity = selectedCountriesById[entityId],
						series = seriesByEntity[entityId];						

					// Scatterplot defaults to showing all countries if none selected
					if (!_.isEmpty(selectedCountriesById) && !entity) continue;

					if (!series) {
						series = {
							values: [{ time: {} }],
							key: entityKey[entityId].name,
							entityName: entityKey[entityId].name,
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

			this.minTransformedYear = _.min(_.map(chartData, function(entityData) {
				return _.min(_.values(entityData.values[0].time));
			}));
			this.maxTransformedYear = _.max(_.map(chartData, function(entityData) {
				return _.max(_.values(entityData.values[0].time));
			}));

			return chartData;
		},


		transformDataForDiscreteBar: function() {
			var dimensions = App.ChartModel.getDimensions(),
				variableData = this.get('variableData'),
				variables = variableData.variables,
				entityKey = variableData.entityKey,
				selectedCountriesById = App.ChartModel.getSelectedEntitiesById(),
				chartData = [];

			var latestYearInData = _.max(_.map(variables, function(v) { return _.max(v.years); }));

			_.each(dimensions, function(dimension) {
				var variable = variables[dimension.variableId],
				    targetYear = parseInt(dimension.targetYear),
				    targetMode = dimension.mode,
				    tolerance = parseInt(dimension.tolerance),
				    maximumAge = parseInt(dimension.maximumAge),
				    valuesByEntity = {};

				var series = {
					values: [],
					key: variable.name,
					id: dimension.variableId
				};

				for (var i = 0; i < variable.years.length; i++) {
					var year = parseInt(variable.years[i]),
						entityId = variable.entities[i],
						entity = selectedCountriesById[entityId];

					if (!_.isEmpty(selectedCountriesById) && !entity) continue;

					var value = valuesByEntity[entityId];

					if (targetMode === "specific") {
						// Not within target year range, ignore
						if (year < targetYear-tolerance || year > targetYear+tolerance)
							continue;

						// Make sure we use the closest year within tolerance (favoring later years)
						if (value && Math.abs(value.time - targetYear) < Math.abs(year - targetYear))
							continue;
					} else if (targetMode == "latest" && !isNaN(maximumAge)) {
						if (year < latestYearInData-maximumAge)
							continue;
					}

					value = {
						time: year,
						x: entityKey[entityId].name,
						y: variable.values[i]
					};

					valuesByEntity[entityId] = value;
				}

				_.each(valuesByEntity, function(value) {
					series.values.push(value);
				});

				series.values = _.sortBy(series.values, 'y');

				chartData.push(series);
			}.bind(this));

			this.minTransformedYear = _.min(_.map(chartData, function(entityData) {
				return entityData.values[0].time;
			}));
			this.maxTransformedYear = _.max(_.map(chartData, function(entityData) {
				return entityData.values[0].time;
			}));

			return chartData;
		},

		getSourceDescHtml: function(source) {
			var html = "<div class='datasource-wrapper'>";
			html += "<h2>" + source.name + "</h2>";			
			html += source.description;
			html += "</div>";
			return html;
		},

		transformDataForSources: function() {
			var variableData = this.get("variableData");			
			if (!variableData) return [];

			var sources = _.map(App.ChartModel.getDimensions(), function(dimension) {
				var variable = variableData.variables[dimension.variableId],
					source = _.extend({}, variable.source);

				source.description = this.getSourceDescHtml(variable.source);
				return source;
			}.bind(this));

			return _.uniq(sources, function(source) { return source.name; });
		},

		transformData: function() {
			if (this.chartData)
				return this.chartData;

			var variableData = this.get("variableData");
			var result = [];

			if (variableData) {		
				var chartType = App.ChartModel.get("chart-type");
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
			}

			result = App.Colors.assignColorsForChart(result);
			this.chartData = result;
			this.trigger("transform");
			return result;
		}
	});
})();