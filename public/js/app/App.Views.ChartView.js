;(function() {	
	"use strict";
	owid.namespace("App.Views.ChartView");

	var Header = require("App.Views.Chart.Header"),
		Footer = require("App.Views.Chart.Footer"),
		ChartURL = require("App.Views.ChartURL"),
		DebugHelper = require("App.Views.DebugHelper"),
		ScaleSelectors = require("App.Views.Chart.ScaleSelectors"),
		ChartTab = require("App.Views.Chart.ChartTab"),
		DataTab = require("App.Views.Chart.DataTab"),
		SourcesTab = require("App.Views.Chart.SourcesTab"),
		MapTab = require("App.Views.Chart.MapTab"),
		VariableData = require("App.Models.VariableData"),
		ChartData = require("App.Models.ChartData"),		
		Colors = require("App.Models.Colors"),
		Utils = require("App.Utils");
	
	App.Views.ChartView = owid.View.extend({
		activeTab: false,
		el: "#chart-view",

		events: {
			"click li.header-tab a": "onTabClick"
		},

		initialize: function(options) {
			App.ChartView = this;

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
			
			// Determine if we're logged in and show the edit button
			// Done here instead of PHP to allow for caching etc optimization on public-facing content
			if (Cookies.get("isAdmin")) {
				$(".edit-btn-wrapper").removeClass("hidden");
			}
			
			var that = this;

			// Data model used for fetching variables
			App.VariableData = new VariableData();	
			App.ChartData = new ChartData();
			App.Colors = new Colors();
			var childViewOptions = { dispatcher: this.dispatcher, parentView: this };
			this.urlBinder = new ChartURL(childViewOptions);
			this.header = new Header(childViewOptions);
			this.footer = new Footer(childViewOptions);
			this.scaleSelectors = new ScaleSelectors(childViewOptions);
			this.debugHelper = new DebugHelper(childViewOptions);
			//tabs
			var chartType = App.ChartModel.get("chart-type");
			this.chartTab = new ChartTab(childViewOptions);
			this.dataTab = new DataTab(childViewOptions);
			this.sourcesTab = new SourcesTab(childViewOptions);
			this.mapTab = new MapTab(childViewOptions);
			this.tabs = [this.chartTab, this.dataTab, this.sourcesTab, this.mapTab];

			nv.utils.windowResize(_.debounce(function() {
				this.onResize();
			}.bind(this), 150));			

			var defaultTabName = App.ChartModel.get("default-tab");
			this.activateTab(defaultTabName);

			this.listenTo(App.ChartModel, "change", function() {
				// When the model changes and there's been an error, rebuild the whole current tab
				// Allows the editor to recover from failure states
				if ($(".chart-error").length) {
					this.activateTab(this.activeTabName);
				}
			}.bind(this));
		},

		onTabClick: function(ev) {
			ev.preventDefault();
			ev.stopPropagation();
			var tabName = $(ev.target).closest("li").attr("class").match(/(\w+)-header-tab/)[1];
			this.activateTab(tabName);
		},

		activateTab: function(tabName) {
			$(".chart-error").remove();

			$("." + tabName + "-header-tab a").tab('show');
			var tab = this[tabName + "Tab"];
			if (this.activeTab) {
				this.activeTab.deactivate();
				this.activeTab = null;
			} else if (this.loadingTab) {
				this.loadingTab.deactivate();				
			}

			this.loadingTab = tab;
			this.activeTabName = tabName;
			this.dispatcher.trigger("tab-change", tabName);		
			if (!_.isEmpty(App.ChartModel.getDimensions()))
				$(".chart-preloader").show();			
			App.ChartData.ready(function() {
				try {
					tab.activate(function() {
						$(".chart-preloader").hide();							
							this.loadingTab = null;
							this.activeTab = tab;
						this.onResize();
					}.bind(this));					
				} catch (err) {
					App.ChartView.handleError(err);
				}
			}.bind(this));
		},

		handleError: function(err, isCritical) {
			if (isCritical !== false) isCritical = true;

			if (err.responseText) {
				err = err.status + " " + err.statusText + "\n" + "    " + err.responseText;
			} else if (err.stack) {
				err = err.stack;
			}
			console.error(err);
			var tab = this.activeTab || this.loadingTab;
			if (tab)
				tab.deactivate();
			this.activeTab = null;
			this.loadingTab = null;
			this.$(".chart-preloader").hide();
			if (isCritical) {
				this.$(".tab-pane.active").prepend('<div class="chart-error critical"><pre>' + err + '</pre></div>');
			} else {
				this.showMessage(err);
			}
		},

		showMessage: function(msg) {
			this.$(".tab-pane.active").prepend('<div class="chart-error"><div>' + msg + '</div></div>');			
		},

		onSVGExport: function() {	
			var svg = d3.select("svg");

			// Remove SVG UI elements that aren't needed for export
			svg.selectAll(".nv-add-btn, .nv-controlsWrap").remove();

			// Inline the CSS styles, since the exported SVG won't have a stylesheet
			var styleSheets = document.styleSheets;
			_.each(document.styleSheets, function(styleSheet) {
				_.each(styleSheet.cssRules, function(rule) {
					try {
						$(rule.selectorText).each(function(i, elem) {
							if ($(elem).parent().closest("svg").length)
								elem.style.cssText += rule.style.cssText;
						});	
					} catch (e) {}						
				});
			});		

			// MISPY: Need to propagate a few additional styles from the external document into the SVG
			$("svg").css("font-size", $("html").css("font-size"));	
			$("svg").css("margin", "10px");

			svgAsDataUri(svg.node(), {}, function(uri) {
				var svg = uri.substring('data:image/svg+xml;base64,'.length);
				if (_.isFunction(window.callPhantom))
					window.callPhantom({ "svg": window.atob(svg) });
			});
		},

		onResize: function(callback, isRepeat) {
			var $wrapper = this.$el.find(".chart-wrapper-inner"),
				svg = d3.select("svg");
			if (!isRepeat) {
				$wrapper.css("height", "calc(100% - 24px)");
			}

			async.series([this.header.onResize.bind(this.header), 
						 this.footer.onResize.bind(this.footer)], 
			function() {
				// Figure out how much space we have left for the actual tab content
				var svgBounds = svg.node().getBoundingClientRect(),
					headerBounds = svg.select(".chart-header-svg").node().getBoundingClientRect(),
					footerBounds = svg.select(".chart-footer-svg").node().getBoundingClientRect(),
					tabOffsetY = headerBounds.bottom - svgBounds.top,
					tabHeight = footerBounds.top - headerBounds.bottom;

				// MISPY: Ideally we want to fit all of our contents into the space that we are given.
				// However, if there is much header and footer text and the screen is small then we may
				// need to demand extra scrollable height so that the user can actually see the chart.
				var minHeight = 300;
				if (tabHeight < minHeight) {
					//svg.style("height", svgBounds.height + (minHeight-tabHeight) + "px");
					$wrapper.css("height", $wrapper.height() + (minHeight-tabHeight) + 10 + "px");
					this.onResize(callback, true);
					return;
				}

				this.$el.find(".tab-content").css("margin-top", tabOffsetY);
				this.$el.find(".tab-content").css("height", tabHeight);

				if (this.$el.find(".chart-tabs").is(":visible")) {
					tabOffsetY += this.$el.find(".chart-tabs").height();
					tabHeight -= this.$el.find(".chart-tabs").height();
				}

				this.$el.find(".tab-pane").css("height", "calc(100% - " + $(".tab-content > .clearfix").height() + "px)");

				if (this.activeTab && this.activeTab.onResize) {
					try {
						this.activeTab.onResize(callback);
					} catch (err) {
						App.ChartView.handleError(err);
					}
				} else
					if (callback) callback();
			}.bind(this));
		},
	});
})();