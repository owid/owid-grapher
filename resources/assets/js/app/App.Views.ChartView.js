;(function() {	
	"use strict";
	owid.namespace("App.Views.ChartView");

	var Header = require("App.Views.Chart.Header"),
		Footer = require("App.Views.Chart.Footer"),
		ChartURL = require("App.Views.ChartURL"),
		ScaleSelectors = require("App.Views.Chart.ScaleSelectors"),
		ChartTab = require("App.Views.Chart.ChartTab"),
		DataTab = require("App.Views.Chart.DataTab"),
		SourcesTab = require("App.Views.Chart.SourcesTab"),
		MapTab = require("App.Views.Chart.MapTab"),
		ChartDataModel = require("App.Models.ChartDataModel"),
		Utils = require("App.Utils");
	
	App.Views.ChartView = Backbone.View.extend({
		activeTab: false,
		el: "#chart-view",

		initialize: function(options) {
			options = options || {};
			this.dispatcher = options.dispatcher || _.clone(Backbone.Events);
		
			$(document).ajaxStart(function() {
				$(".chart-preloader").show();
			});

			$(document).ajaxStop(function() {
				$(".chart-preloader").hide();
			});

			if (App.ChartModel.get("chart-name"))
				$(".chart-preloader").show();

			if (window.self != window.top) {
				$("#chart-view").addClass("embedded");
			}
			
			var that = this;

			// Data model used for fetching variables
			this.vardataModel = new ChartDataModel();
			App.DataModel = this.vardataModel;

			var childViewOptions = { dispatcher: this.dispatcher, parentView: this, vardataModel: this.vardataModel };
			this.urlBinder = new ChartURL(childViewOptions);

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
			
			this.$error = this.$el.find( ".chart-error" );

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
							that.onResize(); 
							that.dispatcher.trigger("tab-change", tab.$tab.attr('id').split("-")[0]);
						});
						App.DataModel.ready(function() {
							tab.activate();
						});
					}
				});
			});

			nv.utils.windowResize(_.debounce(function() {
				that.onResize();
			}, 150));					

			var defaultTab = App.ChartModel.get("default-tab");
			$("." + defaultTab + "-header-tab a").tab('show');

			this.header.render();
			this.footer.render();
		},


		onDimensionExport: function() {
			//export chart into svg
			var that = this,
				format = "svg",
				width = 1000,
				height = 700,
				exportMap = ( this.$el.find( "#map-chart-tab" ).is( ":visible" ) )? true: false,
				$chartLogoSvg = $( ".chart-logo-svg" );


			//http://stackoverflow.com/questions/23218174/how-do-i-save-export-an-svg-file-after-creating-an-svg-with-d3-js-ie-safari-an
			var $oldEl = this.$el,
				$newEl = $oldEl.clone();

			if( !exportMap ) {
				$oldEl.replaceWith( $newEl );
			}

			$(".chart-header").hide();
			$(".chart-footer").hide();

			
			//grab all svg
			var $exportSvg;
			if (exportMap) {
				$exportSvg = $( ".datamap" );
			} else {
				$exportSvg = $( "svg.nvd3-svg" );
			}

			//add printing styles
			if (exportMap) {
				$exportSvg.attr( "class", "datamap nvd3-svg export-svg" );
				
				//for exporting map, we need to add logo
				$exportSvg.append($chartLogoSvg);
			} else {
				//add classes 
				$exportSvg.attr("class", "nvd3-svg export-svg");
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

			//remove voronoi
			$exportSvg.find(".nv-point-paths").remove();

			//remove add country button, display:none won't work in illustrator
			var $addCountryBtn = $exportSvg.find( ".nv-add-btn,.nv-remove-btn" );
			$addCountryBtn.remove();

			$exportSvg.wrap("<div></div>");
			var svg = $exportSvg.parent().html();


			svgAsDataUri($exportSvg.get(0), {}, function(uri) {
				var svg = uri.substring('data:image/svg+xml;base64,'.length);
				window.callPhantom({ "svg": window.atob(svg) });
			});
		},

		onResize: function() {
			var isMap = this.$el.find("#map-chart-tab").is(":visible");
			var svg = isMap ? d3.select("svg.datamap") : d3.select("svg.nvd3-svg");

			this.header.onResize();
			this.footer.onResize();

			// Figure out how much space we have left for the actual tab content

			var svgBounds = svg.node().getBoundingClientRect(),
				headerBBox = svg.select(".chart-header-svg").node().getBBox(),
				tabOffsetY = headerBBox.y + headerBBox.height,
				tabHeight = svgBounds.height - headerBBox.height;
			console.log(tabOffsetY, tabHeight);

			if (this.activeTab.onResize)
				this.activeTab.onResize(tabOffsetY, tabHeight);
		},
	});

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