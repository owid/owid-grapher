;(function() {		
	"use strict";

	window.App = window.App || {};
	App.Models = App.Models || {};

	/**
	 * This model handles the mass retrieval of data values associated with one
	 * or more variables, and is responsible for transforming the raw data into
	 * formats appropriate for use by the charts or other frontend systems.
	 **/
	App.Models.ChartDataModel = Backbone.Model.extend( {
		defaults: {},

		initialize: function () {
			App.ChartModel.on("change:chart-dimensions", this.update, this);
			this.update();
		},

		update: function() 	{	
			if (_.isEmpty(App.ChartModel.get("chart-dimensions"))) return;

			if (this.dataRequest) {
				this.dataRequest.abort();
				this.dataRequest = null;
			}

			this.dimensions = JSON.parse(App.ChartModel.get("chart-dimensions"));
			var variableIds = _.map(this.dimensions, function(dim) { return dim.variableId; });
			if (_.isEmpty(variableIds)) {
				this.clear();
				return;
			}

			this.isReady = false;
			this.set("variableData", null, { silent: true });
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
				if (i == 0) { // First line contains the basic variable metadata 
					variableData = JSON.parse(line);
				} else if (i == lines.length-1) { // Final line is entity id => name mapping
					variableData.entityKey = JSON.parse(line);
				} else {
					var points = line.split(";");
					var variable;
					points.forEach(function(d, j) {
						if (j == 0) {
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

		getSelectedCountriesById: function() {
			var variableData = this.get("variableData"),
				selectedCountries = App.ChartModel.get("selected-countries"),				
				chartType = App.ChartModel.get("chart-type"),
				selectedCountriesById = {};

			if (chartType != App.ChartType.ScatterPlot && _.isEmpty(selectedCountries)) {
				var random = _.sample(_.uniq(Object.keys(variableData.entityKey)), 3);
				selectedCountries = [];
				_.each(random, function(entityId) {
					selectedCountries.push({
						id: entityId,
						name: variableData.entityKey[entityId].name
					});
				});
				App.ChartModel.set("selected-countries", selectedCountries);
			}

			_.each(selectedCountries, function(entity) {
				selectedCountriesById[entity.id] = entity;
			});

			return selectedCountriesById;
		},

		transformDataForLineChart: function() {
			var dimensions = this.dimensions,
				variableData = this.get('variableData'),
				variables = variableData.variables,
				entityKey = variableData.entityKey,
				selectedCountriesById = this.getSelectedCountriesById(),
				yAxis = App.ChartModel.get("y-axis"),
				localData = [],
				hasManyVariables = _.size(variables) > 1,
				hasManyEntities = _.size(selectedCountriesById) > 1;

			_.each(dimensions, function(dimension) {
				var variable = variables[dimension.variableId],
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
								key = variable.name;
							} else {
								key += " - " + variable.name;
							}
						}

						series = {
							values: [],
							key: key,
							entityName: entityKey[entityId].name,
							id: id
						};
						seriesByEntity[entityId] = series;
					}

					var prevValue = series.values[series.values.length-1];
					if (prevValue)
						prevValue.gapYearsToNext = year-prevValue.x;
					series.values.push({ x: year, y: value, time: year });
				}

				_.each(seriesByEntity, function(v, k) {
					localData.push(v);
				});
			});

			return localData;
		},

		// Ensures that every series has a value entry for every year in the data
		// Even if that value is just 0
		// Stacked area charts with incomplete data will fail to render otherwise
		zeroPadData: function(localData) {
			var allYears = {};			
			var yearsForSeries = {};

			_.each(localData, function(series) {
				yearsForSeries[series.id] = {};
				_.each(series.values, function(d, i) {
					allYears[d.x] = true;
					yearsForSeries[series.id][d.x] = true;
				});
			});

			_.each(localData, function(series) {
				_.each(Object.keys(allYears), function(year) {
					year = parseInt(year);
					if (!yearsForSeries[series.id][year])
						series.values.push({ x: year, y: 0, time: year, fake: true });
				});

				series.values = _.sortBy(series.values, function(d) { return d.x; });
			});

			return localData;
		},

		// Zero pads for every single year in the data
		zeroPadDataRange: function(localData) {
			var minYear = Infinity, maxYear = -Infinity;
			_.each(localData, function(series) {
				minYear = Math.min(minYear, series.values[0].x);
				maxYear = Math.max(maxYear, series.values[series.values.length-1].x);
			});

			var yearsForSeries = {};
			_.each(localData, function(series) {
				yearsForSeries[series.id] = {};
				_.each(series.values, function(d, i) {
					yearsForSeries[series.id][d.x] = true;
				});
			});

			_.each(localData, function(series) {
				for (var year = minYear; year <= maxYear; year++) {					
					if (!yearsForSeries[series.id][year])
						series.values.push({ x: year, y: 0, time: year, fake: true });
				}
				series.values = _.sortBy(series.values, function(d) { return d.x; });
			});

			return localData;			
		},

		transformDataForStackedArea: function() {
			if (App.ChartModel.get("group-by-variables") == false)
				return this.zeroPadData(this.transformDataForLineChart());

			var dimensions = this.dimensions,
				variableData = this.get('variableData'),
				variables = variableData.variables,
				entityKey = variableData.entityKey,
				// Group-by-variable chart only has one selected country
				selectedCountry = _.values(this.getSelectedCountriesById())[0],
				localData = [];

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
				}

				localData.push(series);
			});

			return this.zeroPadData(localData);
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
			var dimensions = this.dimensions,
				variableData = this.get('variableData'),
				variables = variableData.variables,
				entityKey = variableData.entityKey,
				selectedCountriesById = this.getSelectedCountriesById(),
				seriesByEntity = {},
				// e.g. for colors { var_id: { 'Oceania': '#ff00aa' } }
				categoryTransforms = {},				
				localData = [];

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
					localData.push(series);
			}.bind(this));

			return localData;
		},

		getSourceDescHtml: function(dimension) {
			var variableData = this.get("variableData"),
				variable = variableData.variables[dimension.variableId],
				source = variable.source;

			var displayName = _.isEmpty(dimension.displayName) ? variable.name : dimension.displayName;
			var hideDimName = _.isEmpty(dimension.name) || _.size(this.get("variableData").variables) == 1;

			var html = "<div class='datasource-wrapper'>";
			html += (hideDimName ? "<h2>Data</h2>" : "<h2>Data for " + dimension.name + ": </h2>");
			html += "<div class='datasource-header'>" +
					    "<h3><span class='datasource-property'>Dataset name:</span>" + variable.dataset_name + "</h3>" +
					    "<h4><span class='datasource-property'>Variable name:</span>" + variable.name + "</h4>" +
					"</div>";
			html += "<table>" +
					    "<tr><td><span class='datasource-property'>Full name</span></td><td>" + variable.name + "</td></tr>" +
					    "<tr><td><span class='datasource-property'>Display name</span></td><td>" + displayName + "</td></tr>" +
					    "<tr><td><span class='datasource-property'>Definition</span></td><td>" + variable.description + "</td></tr>" +
					    "<tr><td><span class='datasource-property'>Unit</span></td><td>" + variable.unit + "</td></tr>" +
					    "<tr><td><span class='datasource-property'>Uploaded</span></td><td>" + variable.created_at + "</td></tr>" +
					"</table>";
			html += source.description;
			html += "</div>"
			return html;
		},

		transformDataForSources: function() {
			var variableData = this.get("variableData");			
			if (!variableData) return [];

			return _.map(this.dimensions, function(dimension) {
				var variable = variableData.variables[dimension.variableId],
					source = _.extend({}, variable.source);

				source.description = this.getSourceDescHtml(dimension);
				return source;
			}.bind(this));
		},

		transformData: function() {
			var variableData = this.get("variableData")
			if (!variableData) return [];

			var chartType = App.ChartModel.get("chart-type");
			if (chartType == App.ChartType.LineChart)
				return this.transformDataForLineChart();
			else if (chartType == App.ChartType.ScatterPlot)
				return this.transformDataForScatterPlot();
			else if (chartType == App.ChartType.StackedArea)
				return this.transformDataForStackedArea();	
			else
				return this.transformDataForLineChart();
		},
	});
})();