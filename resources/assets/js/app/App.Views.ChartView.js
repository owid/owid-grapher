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

		events: {
			"click li.header-tab a": "onTabClick"
		},

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

			nv.utils.windowResize(_.debounce(function() {
				this.onResize();
			}.bind(this), 150));			

			var defaultTabName = App.ChartModel.get("default-tab");
			this.activateTab(defaultTabName);
		},

		onTabClick: function(evt) {
			var tabName = $(evt.target).closest("li").attr("class").match(/(\w+)-header-tab/)[1];
			this.activateTab(tabName);
		},

		activateTab: function(tabName) {
			$("." + tabName + "-header-tab a").tab('show');
			var tab = this[tabName + "Tab"];
			if (this.activeTab) this.activeTab.deactivate();

			this.dispatcher.trigger("tab-change", tabName);			
			$(".chart-preloader").show();
			App.DataModel.ready(function() {
				tab.activate(function() {
					$(".chart-preloader").hide();		
					this.activeTab = tab;
					this.onResize();
				}.bind(this));
			}.bind(this));
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
			var svg = d3.select("svg");

			this.header.onResize();
			this.footer.onResize();

			// Figure out how much space we have left for the actual tab content
			var svgBounds = svg.node().getBoundingClientRect(),
				headerBounds = svg.select(".chart-header-svg").node().getBoundingClientRect(),
				footerBounds = svg.select(".chart-footer-svg").node().getBoundingClientRect(),
				tabOffsetY = headerBounds.bottom - svgBounds.top,
				tabHeight = footerBounds.top - headerBounds.bottom;

			$(".tab-content").css("margin-top", tabOffsetY);
			$(".tab-content").css("height", tabHeight);

			if ($(".chart-tabs").is(":visible")) {
				tabOffsetY += $(".chart-tabs").height();
				tabHeight -= $(".chart-tabs").height();
			}

			$(".tab-pane").css("height", "calc(100% - " + $(".tab-content > .clearfix").height() + "px)");

			if (this.activeTab.onResize)
				this.activeTab.onResize(tabOffsetY, tabHeight);
		},
	});
})();