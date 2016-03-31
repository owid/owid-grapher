;(function() {
	"use strict";

	var App = require( "./../../namespaces.js" ),
		Legend = require( "./App.Views.Chart.Legend" );

	App.Utils.ColorScheme = Backbone.Model.extend({
		initialize: function() {
			this.cachedColors = {};
		},

		assignColorFromCache: function(key) {
			//assing color frome cache
			if (this.cachedColors[key] ) {
			    return this.cachedColors[key];
			} else {
				var randomColor = App.Utils.getRandomColor();
				this.cachedColors[key] = randomColor;
				return randomColor;
			}
		},

		assignColors: function(localData) {
			var entityColors = {};
			var selectedCountries = App.ChartModel.get("selected-countries");
			var selectedCountriesByName = {};

			_.each(selectedCountries, function(entity) {
				selectedCountriesByName[entity.name] = entity;
			});

			var countryColors = {};
			_.each(localData, function(series) {
				var id = series.key;
				var entity = selectedCountriesByName[id];
				if (entity && entity.color) {
					if (!countryColors[id])
						countryColors[id] = entity.color;
					else
						countryColors[id] = d3.rgb(countryColors[id]).brighter(1).toString();					
					series.color = countryColors[id];
				} else {
					//series.color = this.assignColorFromCache(id);
				}
			}.bind(this));
		}
	});

	App.Views.Chart.LineChartTab = Backbone.View.extend({
		cachedColors: [],
		el: "#chart-view",
		events: {
			"change [name=available_entities]": "onAvailableCountries"
		},

		initialize: function( options ) {
			this.dispatcher = options.dispatcher;
			this.parentView = options.parentView;
			this.vardataModel = options.vardataModel;
			this.$tab = this.$el.find("#chart-chart-tab");
			this.$svg = this.$el.find("#chart-chart-tab svg");
			this.colorScheme = new App.Utils.ColorScheme();


			App.ChartModel.on("change", this.onChartModelChange, this);
		},

		onChartModelChange: function() {
			this.activate();
		},

		activate: function() {
			this.vardataModel.ready(function(variableData) {
				this.render(variableData);
			}.bind(this));				
		},

		getSelectedCountriesById: function() {
			var selectedCountries = App.ChartModel.get("selected-countries"),
				chartType = App.ChartModel.get("chart-type"),
				selectedCountriesById = {};

			if (_.isEmpty(selectedCountries)) {
				var countries = _.map(localData, function(d) { return { id: d.id.toString().split('-')[0], name: d.entity }; });
				var countrySet = _.uniq(countries, function(c) { return c.id; });
				var random = _.sample(countrySet, 3);
				selectedCountries = [];
				selectedCountries.push.apply(selectedCountries, random);
				App.ChartModel.set("selected-countries", selectedCountries);
			}

			_.each(selectedCountries, function(entity) {
				selectedCountriesById[entity.id] = entity;
			});

			return selectedCountriesById;
		},

		transformData: function(variableData) {
			var variables = variableData.variables,
				entityKey = variableData.entityKey,
				selectedCountriesById = this.getSelectedCountriesById(),
				localData = [];

			_.each(variables, function(variable) {
				var seriesByEntity = {};

				for (var i = 0; i < variable.years.length; i++) {
					var year = variable.years[i],
						value = variable.values[i],
						entityId = variable.entities[i],
						entity = selectedCountriesById[entityId],
						series = seriesByEntity[entityId];

					// Not a selected entity, don't add any data for it
					if (!entity) continue;

					if (!series) {
						series = {
							values: [],
							key: entityKey[entityId]
						};
						seriesByEntity[entityId] = series;
					}

					series.values.push({ x: year, y: value });
				}

				_.each(seriesByEntity, function(v, k) {
					localData.push(v);
				});
			});

			return localData;
		},

		render: function(variableData) {
			var localData = this.transformData(variableData);
			this.colorScheme.assignColors(localData);

			nv.addGraph(function() {
				var chartOptions = {
					transitionDuration: 0,
					margin: { top:0, left:50, right:30, bottom:0 },// App.ChartModel.get( "margins" ),
					showLegend: false
				};

				var lineType = App.ChartModel.get("line-type");
				if (lineType == 2) {
					chartOptions.defined = function(d) { return d.y !== 0; };					
				} else if (lineType == 0) {
					this.$el.addClass("line-dots");
				} else {
					this.$el.removeClass("line-dots");
				}

				this.chart = nv.models.lineChart().options(chartOptions);

				this.svgSelection = d3.select(this.$svg.selector)
					.datum(localData)
					.call(this.chart);			
			}.bind(this));
		},
	});

	module.exports = App.Views.Chart.LineChartTab;
})();