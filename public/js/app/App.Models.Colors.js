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
				App.ChartModel.on("change", function() {
					this.colorCache = {};
					this.colorIndex = 0;
				}.bind(this));
			}
		},

		assignColorForKey: function(key, color, options) {
			options = _.extend({ canVary: true }, options);
			color = color || this.colorScale(this.colorIndex);

			// Unless the color is manually fixed, we lighten on collision
			var colorIsTaken = _.contains(_.values(this.colorCache), color);
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
		},

		// We set colors for the legend data separately to give more precise control
		// over the priority and ordering, since legend data doesn't move around as much.
		assignColorsForLegend: function(legendData) {
			var selectedEntitiesById = App.ChartModel.getSelectedEntitiesById(),
				addCountryMode = App.ChartModel.get("add-country-mode");

			_.each(legendData, function(group) {
				var entity = selectedEntitiesById[group.entityId],
					dimension = App.ChartModel.getDimensionById(group.variableId);

				if (group.color) {
					group.color = this.assignColorForKey(group.key, group.color, { canVary: false });
				} else if (entity && entity.color) {
					group.color = this.assignColorForKey(group.key, entity.color, { canVary: group.key != entity.name });
				} else if (dimension && dimension.color) {
					group.color = this.assignColorForKey(group.key, dimension.color, { canVary: group.key != dimension.displayName });
				} else if (addCountryMode == "add-country" || _.size(selectedEntitiesById) > 1) {
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
		},

		assignColorsForChart: function(chartData) {
			var chartType = App.ChartModel.get("chart-type");

			_.each(chartData, function(series) {
				if (chartType == App.ChartType.DiscreteBar || chartType == App.ChartType.ScatterPlot) {
					_.each(series.values, function(d) {
						d.color = this.assignColorForKey(d.key, d.color);
					}.bind(this));					
				} else {
					series.color = this.assignColorForKey(series.key, series.color);
				}
			}.bind(this));

			return chartData;
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