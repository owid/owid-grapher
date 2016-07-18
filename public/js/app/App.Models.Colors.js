;(function() {		
	"use strict";
	owid.namespace("App.Models.Colors");

	/**
	 * This model handles the assignment and distribution of colors for
	 * different entities and chart types.
	 */
	App.Models.Colors = Backbone.Model.extend({
		basicScheme: ["#3360a9", "#ca2628", "#34983f", "#ed6c2d", "#df3c64", "#a85a4a", "#e6332e", "#6bb537", "#ffd53e", "#f07f59", "#b077b1", "#932834", "#674c98", "#5eb77e", "#f6a324", "#2a939b", "#818282", "#7ec7ce", "#fceb8c", "#cfcd1e", "#58888f", "#ce8ebd", "#9ecc8a", "#db2445", "#f9bc8f", "#d26e66", "#c8c8c8"],
 
		initialize: function() {
			this.colorScale = d3.scale.ordinal().range(this.basicScheme);
			this.colorCache = {};
			this.colorIndex = 0;

			// Clear the color cache in the editor so chart creator can see the
			// true final colors on the chart
			if (App.isEditor) {
				App.ChartModel.on("change:selected-countries", function() {
					this.colorCache = {};
					this.colorIndex = 0;
				}.bind(this));				
			}
		},

		assignColor: function(key, color) {
			if (!this.colorCache[key]) {
				this.colorCache[key] = color || this.colorScale(this.colorIndex);
				this.colorIndex += 1;
			}

			return this.colorCache[key];
		},

		assignColorsForChart: function(localData) {
			var chartType = App.ChartModel.get("chart-type"),
				selectedEntitiesById = App.ChartModel.getSelectedEntitiesById();

			if (chartType == App.ChartType.DiscreteBar) {
				_.each(localData, function(series) {
					_.each(series.values, function(value) {
						var entity = selectedEntitiesById[value.entityId];						
						if (value.color) {
							return;
						} else if (entity && entity.color) {
							value.color = this.assignColor(value.entityId, entity.color);
						} else {
							value.color = this.assignColor(value.entityId);
						}
					}.bind(this));
				}.bind(this));
			} else {
				_.each(localData, function(series) {
					var entity = selectedEntitiesById[series.entityId];
					if (series.color) {
						return;
					} else if (entity && entity.color && series.key == entity.name) {
						series.color = this.assignColor(series.key, entity.color);
					} else {					
						series.color = this.assignColor(series.key);
					}
				}.bind(this));
			}

			return localData;
		}
	});

/*			if( selectedCountries && selectedCountriesIds.length && !App.ChartModel.get( "group-by-variables" ) ) {
				//set local copy of countries color, to be able to create brighter
				var countriesColors = [];
				_.each( localData, function( value, key, list ) {
					//set color while in the loop
					var id = value.id.toString();
					//need to check for special case, when we have more variables for the same countries (the ids will be then 21-1, 22-1, etc.)
					if( id.indexOf( "-" ) > 0 ) {
						id = parseInt( id.split( "-" )[ 0 ], 10 );
					} else {
						id = parseInt( id, 10 );
					}

					var country = selectedCountriesById[ id ];
					if( country && country.color ) {
						if( !countriesColors[ id ] ) {
							countriesColors[ id ] = country.color;
						} else {
							//there is already color for country (multivariant dataset) - create brighter color
							countriesColors[ id ] = d3.rgb( countriesColors[ id ] ).brighter( 1 ).toString();
						}
						value.color = countriesColors[ id ];

					} else {
						value = that.assignColorFromCache( value );
					}
				} );
			} else {
				//TODO - nonsense? convert associative array to array, assign colors from cache
				localData = _.map( localData, function( value ) {
					value = that.assignColorFromCache( value );
					return value;
				} );
			}



				
				var chartDimensions = App.ChartModel.getDimensions();
				if (!_.findWhere(chartDimensions, { property: 'color' })) {
					//check if string does not contain "property":"color"
					that.cacheColors( localData );
				}


		cacheColors: function(data) {
			if( !this.cachedColors.length ) {
				var that = this;
				_.each( data, function( v, i ) {
					that.cachedColors[ v.id ] = v.color;
				} );
			}
		},

		assignColorFromCache: function( value ) {
			this.cachedColors = this.cachedColors || {};
			if( this.cachedColors.length ) {
				//assing color frome cache
				if( this.cachedColors[ value.id ] ) {
					value.color = this.cachedColors[ value.id ];
				} else {
					var randomColor = App.Utils.getRandomColor();
					value.color = randomColor;
					this.cachedColors[ value.id ] = randomColor;
				}
			} else if (!value.color && App.ChartModel.get("chart-type") == App.ChartType.LineChart) {
				this.colorScale = this.colorScale || nv.utils.getColor(d3.scale.category20().range());
				this.colorIndex = this.colorIndex || 0;
				value.color = this.colorScale(this.colorIndex += 1);	
			}
			return value;
		},

			*/

})();