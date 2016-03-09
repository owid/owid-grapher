;( function() {
	
	"use strict";

	var App = require( "./../namespaces.js" ),
		Header = require( "./chart/App.Views.Chart.Header.js" ),
		Footer = require( "./chart/App.Views.Chart.Footer.js" ),
		ScaleSelectors = require( "./chart/App.Views.Chart.ScaleSelectors" ),
		ChartTab = require( "./chart/App.Views.Chart.ChartTab.js" ),
		LineChartTab = require("./chart/App.Views.Chart.LineChartTab.js"),
		DataTab = require( "./chart/App.Views.Chart.DataTab.js" ),
		SourcesTab = require( "./chart/App.Views.Chart.SourcesTab.js" ),
		MapTab = require( "./chart/App.Views.Chart.MapTab.js" ),
		ChartDataModel = require( "./../models/App.Models.ChartDataModel.js" ),
		Utils = require( "./../App.Utils.js" ),
		ExportPopup = require( "./ui/App.Views.UI.ExportPopup.js" );


	App.Models.ChartVardataModel = Backbone.Model.extend( {
		defaults: {},

		update: function() 	{		
			if (this.dataRequest) {
				this.dataRequest.abort();
				this.dataRequest = null;
			}

			// Get the chart dimensions and map them by variable id
			// So we can use the extra info for data transformation alter
			var dims = JSON.parse(App.ChartModel.get("chart-dimensions"));
			this.dimensions = {};
			_.each(dims, function(dim) { this.dimensions[dim.variableId] = dim; }.bind(this));

			this.set("variableData", null, { silent: true });
			this.dataRequest = $.getJSON(Global.rootUrl + "/data/variables/" + Object.keys(this.dimensions).join("+"));
			this.dataRequest.done(function(data) {
				this.dataRequest = null;
				this.set("variableData", data);
			}.bind(this));
		},

		ready: function(callback) {
			var variableData = this.get("variableData");
			if (!variableData) {
				this.on("change:variableData", function() {
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
						name: variableData.entityKey[entityId]
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
			var variableData = this.get('variableData'),
				variables = variableData.variables,
				entityKey = variableData.entityKey,
				selectedCountriesById = this.getSelectedCountriesById(),
				dimensions = this.dimensions,
				yAxis = App.ChartModel.get("y-axis"),
				localData = [];

			_.each(variables, function(variable) {
				var dimension = dimensions[variable.id],
					seriesByEntity = {};

				for (var i = 0; i < variable.years.length; i++) {
					var year = parseInt(variable.years[i]),
						value = parseFloat(variable.values[i]),
						entityId = variable.entities[i],
						entity = selectedCountriesById[entityId],
						series = seriesByEntity[entityId];

					// Not a selected entity, don't add any data for it
					if (!entity) continue;

					if (!series) {
						var key = entityKey[entityId];
						// If there are multiple variables per entity, we disambiguate the legend
						if (_.size(variables) > 1)
							key += " - " + variable.name;

						series = {
							values: [],
							key: key,
							entity: entityKey[entityId],
							id: entityId
						};
						seriesByEntity[entityId] = series;
					}


					// Omit values <= 0 from log scale data
					if (yAxis['axis-scale'] !== 'log' || value > 0)
						series.values.push({ x: year, y: value, time: year });
				}

				_.each(seriesByEntity, function(v, k) {
					localData.push(v);
				});
			});

			return localData;
		},

		transformDataForStackedArea: function() {
			if (App.ChartModel.get("group-by-variables") == false)
				return this.transformDataForLineChart();

			var variableData = this.get('variableData'),
				variables = variableData.variables,
				entityKey = variableData.entityKey,
				// Stacked area chart can only have one selected country at a time
				selectedCountry = _.values(this.getSelectedCountriesById())[0],
				dimensions = this.dimensions,
				localData = [];

			_.each(variables, function(variable) {
				var dimension = dimensions[variable.id];

				var series = {
					id: variable.id,
					key: dimension.displayName || variable.name,
					entity: selectedCountry.name,
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

			return localData;
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
			var variableData = this.get('variableData'),
				variables = variableData.variables,
				entityKey = variableData.entityKey,
				selectedCountriesById = this.getSelectedCountriesById(),
				dimensions = this.dimensions,
				seriesByEntity = {},
				// e.g. for colors { var_id: { 'Oceania': '#ff00aa' } }
				categoryTransforms = {},
				localData = [];

			_.each(variables, function(variable) {
				var dimension = dimensions[variable.id],
				    targetYear = parseInt(dimension.targetYear),
				    tolerance = parseInt(dimension.tolerance),
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
							key: entityKey[entityId],
							entity: entityKey[entityId],
							id: entityId
						};
						seriesByEntity[entityId] = series;
					}

					// Categorical data like color or shape just goes straight on the series
					if (isCategorical) {
						series[dimension.property] = categoryTransform[value];
						continue;
					}

					// Not within target year range, ignore
					if (year < targetYear-tolerance || year > targetYear+tolerance)
						continue;


					// Make sure we use the closest year within tolerance (favoring later years)
					var current = series.values[0].time[dimension.property];
					if (current && Math.abs(current - targetYear) < Math.abs(year - targetYear))
						continue;

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

			window.localData = localData;
			return localData;
		},

/*	public function createSourceDescription( $dimension, $datasource, $omitHeader = false ) {

		$displayName = ( !empty($dimension->displayName) )? $dimension->displayName: $datasource->var_name;

		$html = "";
		$html .= "<div class='datasource-wrapper'>";
			if( !$omitHeader ) {
				$html .= ( !empty( $dimension ) && isset( $dimension->name ) )? "<h2>Data for " .$dimension->name. ": </h2>": "<h2>Data: </h2>";
			}
			$html .= "<div class='datasource-header'>";
				$html .= "<h3><span class='datasource-property'>Dataset name:</span>" .$datasource->dataset_name. "</h3>";
				$html .= "<h4><span class='datasource-property'>Variable name:</span>" .$datasource->var_name. "</h4>";
			$html .= "</div>";
			$html .= "<table>";
				$html .= "<tr><td><span class='datasource-property'>Full name</span></td><td>" .$datasource->var_name. "</td></tr>";
				$html .= "<tr><td><span class='datasource-property'>Display name</span></td><td>" .$displayName. "</td></tr>";
				$html .= "<tr><td><span class='datasource-property'>Definition</span></td><td>" .$datasource->var_desc. "</td></tr>";
				$html .= "<tr><td><span class='datasource-property'>Unit</span></td><td>" .$datasource->var_unit. "</td></tr>";
				$t = strtotime( $datasource->var_created );
				$date = date('d/m/y',$t);
				$html .= "<tr><td><span class='datasource-property'>Uploaded</span></td><td>" .$date. "</td></tr>";
			$html .= "</table>";
			$html .= $datasource->description;
		$html .= "</div>";
		return $html;
	}*/

		getSourceDescHtml: function(variable) {
			var source = variable.source,
				dimension = this.dimensions[variable.id];

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
			var orderedDims = JSON.parse(App.ChartModel.get("chart-dimensions"));
			var variableIdsInOrder = _.uniq(_.map(orderedDims, function(dim) { return dim.variableId; }));

			return _.map(variableIdsInOrder, function(id) {
				var variable = variableData.variables[id],
					dimension = this.dimensions[id],
					source = _.extend({}, variable.source);

				source.description = this.getSourceDescHtml(variable);
				return source;
			}.bind(this));
		},

		transformData: function() {
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

		initialize: function () {
			App.ChartModel.on("change:chart-dimensions", this.update, this);
			this.update();
		},
	});


	App.Views.ChartView = Backbone.View.extend({

		activeTab: false,
		el: "#chart-view",
		events: {
			"click .chart-export-btn": "exportContent"
		},

		initialize: function( options ) {
			var that = this;
			//enable overriding default tab setting with tab query parameter
			this.setDefaultTabFromUrl();
			this.dispatcher = options.dispatcher;
			// Data model used for fetching variables
			// TODO - consider switching to a more client-side data processing system
			// for all the tabs, like the map uses
			this.dataModel = new ChartDataModel();
			this.vardataModel = new App.Models.ChartVardataModel();
			window.vardataModel = this.vardataModel;

			var childViewOptions = { dispatcher: this.dispatcher, parentView: this, dataModel: this.dataModel, vardataModel: this.vardataModel };
			this.header = new Header(childViewOptions);
			this.footer = new Footer(childViewOptions);
			this.scaleSelectors = new ScaleSelectors(childViewOptions);
			//tabs
			var chartType = App.ChartModel.get("chart-type");
			this.chartTab = new ChartTab(childViewOptions);
			this.dataTab = new DataTab(childViewOptions);
			this.sourcesTab = new SourcesTab(childViewOptions);
			this.mapTab = new MapTab(childViewOptions);
			this.mapTab.on("tab-ready", function() { that.header.render(); });
			this.tabs = [this.chartTab, this.dataTab, this.sourcesTab, this.mapTab];
			
			this.exportPopup = new ExportPopup( options );
			this.exportPopup.init( options );

			this.$preloader = this.$el.find( ".chart-preloader" );
			this.$error = this.$el.find( ".chart-error" );

			//setup events
			this.dataModel.on( "sync", this.onDataModelSync, this );
			this.dataModel.on( "error", this.onDataModelError, this );

			this.dispatcher.on( "dimension-export-update", this.onDimensionExportUpdate, this );
			this.dispatcher.on( "dimension-export", this.onDimensionExport, this );
			this.dispatcher.on( "dimension-export-cancel", this.onDimensionExportCancel, this );

			$("[data-toggle='tab']").on("shown.bs.tab", function(evt) {
				_.each(that.tabs, function(tab) { 
					if ($(evt.target).attr('href') === "#"+tab.$tab.attr('id')) {						
						if (that.activeTab)
							that.activeTab.off("tab-ready");
						that.activeTab = tab;
						tab.on("tab-ready", function() { 
							that.header.render();
							that.onResize(); 
						});			
						tab.activate();
					}
				});
			});

			nv.utils.windowResize(_.debounce(function() {
				that.onResize();
			}, 150));					

			var defaultTab = App.ChartModel.get("default-tab");
			$("." + defaultTab + "-header-tab a").tab('show');
		},

		setDefaultTabFromUrl: function() {
			var tab = Utils.getQueryVariable( "tab" );
			if( tab ) {
				//there is something in the url, check that it's not non-sensical value
				var tabs = [ "chart", "data", "map", "sources" ];
				if( _.contains( tabs, tab ) ) {
					App.ChartModel.set( "default-tab", tab, { silent: true } );
				}
			}
		},

		/*displayTab: function( id ) {

			console.log( "ChartView id", id );

		},*/

		onDataModelSync: function( model, response ) {
			this.$error.hide();
			this.$preloader.hide();
			this.sourcesTab.render( response );
		},

		onDataModelError: function() {
			this.$error.show();
			this.$preloader.hide();
		},

		exportContent: function( evt ) {
			
			evt.preventDefault();
			this.exportPopup.show();
			return false;

		},

		onDimensionExportUpdate: function( data ) {

			if( !this.oldWidth ) {
				this.oldWidth = this.$el.width();
				this.oldHeight = this.$el.height();
			}

			//need to account for padding
			var $chartWrapperInner = $( ".chart-wrapper-inner" ),
				paddingLeft = parseInt( $chartWrapperInner.css( "padding-left" ), 10 ),
				paddingRight = parseInt( $chartWrapperInner.css( "padding-right" ), 10 ),
				paddingTop = parseInt( $chartWrapperInner.css( "padding-top" ), 10 ),
				paddingBottom = parseInt( $chartWrapperInner.css( "padding-bottom" ), 10 );

			data.width = parseInt( data.width, 10) + (paddingLeft + paddingRight);
			data.height = parseInt( data.height, 10) + (paddingTop + paddingBottom);

			//account for different heights of html and svg header
			//data.height += 36;//56;
			//account for different heights of html and svg footer
			//data.height += 29;//49;

			this.$el.width( data.width );
			this.$el.height( data.height );
			
			this.onResize();

		},

		onDimensionExportCancel: function() {
			this.resetExportResize();
		},

		onDimensionExport: function( data ) {

			//export chart into svg or png
			var that = this,
				format = data.format,
				width = parseInt( data.width, 10 ),
				height = parseInt( data.height, 10 ),
				isSvg = ( format === "svg" )? true: false,
				exportMap = ( this.$el.find( "#map-chart-tab" ).is( ":visible" ) )? true: false,
				$chartLogoSvg = $( ".chart-logo-svg" );
			
			//http://stackoverflow.com/questions/23218174/how-do-i-save-export-an-svg-file-after-creating-an-svg-with-d3-js-ie-safari-an
			var $oldEl = this.$el,
				$newEl = $oldEl.clone();

			if( !exportMap ) {
				$oldEl.replaceWith( $newEl );
			}
			
			//grab all svg
			var $exportSvg;
			if( exportMap ) {
				$exportSvg = $( ".datamap" );
			} else {
				$exportSvg = $( "svg.nvd3-svg" );
			}
			//add printing styles
			if( exportMap ) {
				$exportSvg.attr( "class", "datamap nvd3-svg export-svg" );
				
				//for exporting map, we need to add logo
				$exportSvg.append( $chartLogoSvg );
				
			} else {
				//add classes 
				$exportSvg.attr( "class", "nvd3-svg export-svg" );
			}

			$chartLogoSvg = $( ".chart-logo-svg" );

			//position svg logo
			var $chartWrapperInner = $( ".chart-wrapper-inner" ),
				innerPaddingLeft = parseInt( $chartWrapperInner.css("padding-left"), 10),
				innerPaddingRight = parseInt( $chartWrapperInner.css("padding-right"), 10),
				margins = App.ChartModel.get( "margins" ),
				elWidth = this.$el.width() - innerPaddingLeft - innerPaddingRight,//svgWidth
				boundingRect = $chartLogoSvg.get(0).getBoundingClientRect(),
				logoSvg = boundingRect.right - boundingRect.left,
				scale = ( $chartLogoSvg.hasClass( "default-logo" ) )? 0.4: 1,
				translateX = elWidth - margins.right - logoSvg,//elWidth;
				translateY = 20;
			
			$chartLogoSvg.attr( "transform", "scale(" + scale + "," + scale + "), translate(" + translateX + "," + translateY + ")" );

			//we need to add all elements that are in html so they wouldn't be printed
			this.addTextsForExport( $exportSvg, width, height, exportMap );
			
			//inline styles for the export
			var styleSheets = document.styleSheets;
			for( var i = 0; i < styleSheets.length; i++ ) {
				Utils.inlineCssStyle( styleSheets[ i ].cssRules );
			}

			$exportSvg.width( width );
			$exportSvg.height( height );
			
			//depending whether we're creating svg or png, 
			if( isSvg ) {
				
				var cb = function( url ) {
					
					//activate click on dummy button
					var $chartSaveBtn = $( ".chart-save-btn" );
					$chartSaveBtn.attr( "href", url );
					//$chartSaveBtn.attr( "download", "ourworldindata-grapher" );
					$chartSaveBtn.get(0).click();

					//safari will ingore click event on anchor, need to have work around that opens the svg at least in the same browser
					var isSafari = navigator.userAgent.indexOf("Safari") > -1 && navigator.userAgent.indexOf("Chrome") === -1;
					//temp try to always open new window
					isSafari = true;
					if( !isSafari ) {
						setTimeout( function() {
							window.location.reload();
						}, 250 );
					} else {
						//safari workaround
						window.location = url;
					}
					
				};

				//add white background - MAX wanted to remove
				/*var $rect = $( "<rect width='" + width + "' height='" + height + "' style='fill:#ffffff;'></rect>" );
				$exportSvg.prepend( $rect );*/
				
				//remove voronoi
				$exportSvg.find(".nv-point-paths").remove();

				//remove add country button, display:none won't work in illustrator
				var $addCountryBtn = $exportSvg.find( ".nv-add-btn,.nv-remove-btn" );
				$addCountryBtn.remove();
				svgAsDataUri( $exportSvg.get( 0 ), {}, cb );
				
			} else {
				
				saveSvgAsPng( $exportSvg.get( 0 ), "chart.png" );
				setTimeout( function() {
					window.location.reload();
				}, 250 );
				
			}
			
		},

		addTextsForExport: function( $svg, width, height, exportMap ) {

			var margins = App.ChartModel.get( "margins" );

			//add elements
			var selectors = [ "chart-name", "chart-subname", "chart-sources", "chart-description" ];
			_.each( selectors, function( selector ) {

				var $el = $( "#chart-view ." + selector ),
					className = selector + "-svg",
					svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');

				//setup attributes
				svgEl.setAttribute('class', className);
				svgEl.setAttribute('dy', 0);
				svgEl.textContent = $el.text();

				$svg.append( svgEl );
				
				//fetch jquery object for use in Utils wrap
				var $svgEl = $( "." + className );
				//convert single line text into multi-line wrapped tspan
				if( selector === "chart-name" || selector === "chart-subname" ) {
					//account for logo on the right
					width -= 50;
				}
				Utils.wrap( $svgEl, width );

			} );

			//if exporting chart tab, create wrapper and put everything but logo into it, so that we can then offset it 
			var $parentEl = $svg,
				holderClass = "nvd3-print-chart-holder",
				$printHolder;

			if( !exportMap ) {
				$parentEl.append( "<g class='" + holderClass + "'></g>" );
				$printHolder = $parentEl.find( "." + holderClass );
				$printHolder.append( $( "svg.nvd3-svg > .nv-wrap" ) );
				$printHolder.append( $( ".nv-custom-legend" ) );
			} else {
				$printHolder = $svg;
			}
			
			//resize them
			var titleEl = $( ".chart-name-svg").get(0), titleRect = titleEl.getBoundingClientRect(), titleHeight = titleRect.bottom - titleRect.top,
				subTitleEl = $( ".chart-subname-svg").get(0), subTitleRect = subTitleEl.getBoundingClientRect(), subTitleHeight = subTitleRect.bottom - subTitleRect.top,
				//printHolder doesn't have height at this point, so using parentEl bounding rect as replacement here
				chartHolderEl = $printHolder.get(0), chartHolderRect = $parentEl.get(0).getBoundingClientRect(), chartHolderHeight = chartHolderRect.bottom - chartHolderRect.top,
				sourcesEl = $( ".chart-sources-svg").get(0), sourcesRect = sourcesEl.getBoundingClientRect(), sourcesHeight = sourcesRect.bottom - sourcesRect.top,
				descriptionEl = $( ".chart-description-svg").get(0), descriptionRect = descriptionEl.getBoundingClientRect(), descriptionHeight = descriptionRect.bottom - descriptionRect.top,
				left = 15,//parseInt( margins.left, 10),
				titleLeft = left + 16,
				//start with margin top and also height of first line of title, cause text contains tspans
				currY = parseInt( margins.top, 10) + 25;

			titleEl.setAttribute("transform", "translate(" + titleLeft + "," + currY + ")" );

			currY += titleHeight;
			subTitleEl.setAttribute("transform", "translate(" + titleLeft + "," + currY + ")" );

			currY += subTitleHeight;
			chartHolderEl.setAttribute("transform", "translate(" + left + "," + currY + ")" );

			currY += chartHolderHeight + parseInt( margins.bottom, 10) + 20;
			sourcesEl.setAttribute("transform", "translate(" + left + "," + currY + ")" );
			
			//possibly also map legend
			var $mapLegend = $( ".map-legend-wrapper" );
			if( $mapLegend.length ) {
				var mapLegendEl = $mapLegend.get(0),
					mapLegendRect = mapLegendEl.getBoundingClientRect(), 
					mapLegendHeight = mapLegendRect.bottom - mapLegendRect.top,
					mapLegendY = currY - mapLegendHeight - 20;
				mapLegendEl.setAttribute("transform", "translate(" + left + "," + mapLegendY + ")" );
			}

			currY += sourcesHeight;
			descriptionEl.setAttribute("transform", "translate(" + left + "," + currY + ")" );
			
		},

		resetExportResize: function() {

			//$newEl.replaceWith( $oldEl );
			this.$el.width( this.oldWidth );
			this.$el.height( this.oldHeight );
			this.onResize();

		},

		updateChart: function( data, timeType, dimensions ) {

			this.chartTab.render( data, timeType, dimensions );
		
		},
	
		onResize: function() {
			if (this.activeTab.onResize)
				this.activeTab.onResize();
		},
	});

	module.exports = App.Views.ChartView;

	//backbone router doesn't work properly with browserify, so it's directly inserted here
	/*var Router = Backbone.Router.extend({

		routes: {
				"chart": "onChartRoute",
				"data": "onDataRoute",
				"map": "onMapRoute",
				"sources": "onSourcesRoute",
				"*default": "onDefaultRoute"
		},

		onChartRoute: function() {
			this.displayTab( "chart" );
		},

		onDataRoute: function() {
			this.displayTab( "data" );
		},

		onMapRoute: function() {
			this.displayTab( "map" );
		},

		onSourcesRoute: function() {
			this.displayTab( "sources" );
		},

		onDefaultRoute: function() {
			console.log( "onDefault router" );
		},

		displayTab: function( id ) {
			console.log("displayTab",id);
			//App.View.chartView.displayTab( id );
		}

	});*/

})();