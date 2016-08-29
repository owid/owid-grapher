;(function() {	
	"use strict";
	owid.namespace("owid.chart");

	owid.chart = function() {
		function chart() {}

		App.VariableData = new App.Models.VariableData();	
		App.ChartData = new App.Models.ChartData();
		App.Colors = new App.Models.Colors();
		App.ChartModel.bind();
		chart.model = App.ChartModel;
		chart.vardata = App.VariableData;
		chart.data = App.ChartData;
		chart.colors = App.Colors;

		var $chart = window.$("#chart-view"),
			$ = $chart.find.bind($chart);
		chart.$ = $;

		// Initialize components
		chart.urlBinder = new App.Views.ChartURL(chart);
		chart.exporter = new App.Views.Export(chart);
		chart.header = new App.Views.Chart.Header(chart);
		chart.footer = new App.Views.Chart.Footer(chart);
		chart.scaleSelectors = new App.Views.Chart.ScaleSelectors(chart);
		chart.tabSelector = owid.view.tabSelector(chart);
		chart.debugHelper = new App.Views.DebugHelper(chart);
		chart.tabs = {
			chart: new App.Views.Chart.ChartTab(chart),
			data: owid.tab.data(chart),
			sources: owid.tab.sources(chart),
			map: new App.Views.Chart.MapTab(chart)
		};


		chart.activeTab = chart.tabs.sources;

	//	var defaultTabName = chart.model.get("default-tab"),
	//		activeTab = sourcesTab;



		/*this.listenTo(App.ChartModel, "change", function() {
			// When the model changes and there's been an error, rebuild the whole current tab
			// Allows the editor to recover from failure states
			if ($(".chart-error").length) {
				this.activateTab(this.activeTabName);
			}
		}.bind(this));*/

		chart.setupDOM = function() {
			nv.utils.windowResize(_.debounce(function() {
				this.render();
			}.bind(this), 150));			

			jQuery(window).one("chart-loaded", function() {
				App.ChartView.onResize(function() {
					window.top.postMessage("chartLoaded", "*");
					console.log("Loaded chart: " + chart.model.get("chart-name"));
				});
			});

			jQuery(document).ajaxStart(function() {
				$(".chart-preloader").show();
			});

			jQuery(document).ajaxStop(function() {
				$(".chart-preloader").hide();
			});

			// Determine if we're logged in and show the edit button
			// Done here instead of PHP to allow for caching etc optimization on public-facing content
			if (Cookies.get("isAdmin")) {
				chart.$(".edit-btn-wrapper").removeClass("hidden");
			}

			if (App.ChartModel.get("chart-name"))
				chart.$(".chart-preloader").show();

			if (window.self != window.top || App.isEditor) {
				$chart.addClass("embedded");
			}
		};

		chart.render = function() {
			var view = $chart.get(0),
				screenWidth = $chart.parent().width(),
				screenHeight = $chart.parent().height(),
				authorWidth = App.AUTHOR_WIDTH,
				authorHeight = App.AUTHOR_HEIGHT,
				renderWidth, renderHeight, scale;

			if (screenWidth >= screenHeight) {
				renderWidth = (screenWidth/screenHeight) * authorHeight;
				renderHeight = authorHeight;
			} else {
				renderWidth = authorWidth;
				renderHeight = (screenHeight/screenWidth) * authorWidth;
			}

			scale = Math.min(screenWidth/renderWidth, screenHeight/renderHeight);

			if (App.isEditor) {
				renderWidth = authorWidth;
				renderHeight = authorHeight;
				scale = 1;
			}

			console.log(renderWidth, renderHeight, screenWidth, screenHeight);
			view.style.width = renderWidth + 'px';
			view.style.height = renderHeight + 'px';
			view.style.zoom = '';
			view.style.left = '';
			view.style.top = '';
			view.style.bottom = '';
			view.style.right = '';
			owid.transformElement(view, '');

			chart.header.render();
			chart.footer.render();
			chart.tabSelector.render();
			$(".sources-header-tab a").tab('show');
			chart.activeTab.render();

			if (!App.isEditor) {
				if (scale > 1) {
					//view.style.zoom = scale;
				} else {
					view.style.left = '50%';
					view.style.top = '50%';
					view.style.bottom = 'auto';
					view.style.right = 'auto';
					owid.transformElement(view, "translate(-50%, -50%) scale(" + scale + ")");					
				}					
			}
			view.style.opacity = 1;
		};

		chart.setupDOM();
		chart.data.ready(chart.render);
		window.chart = chart;
		return chart;
	};	

	App.Views.ChartView = owid.View.extend({
		activeTab: false,
		el: "#chart-view",

		events: {
			"click li.header-tab a": "onTabClick"
		},

		initialize: function(options) {
			App.ChartView = this;

		},

		renderTabSelector: function() {
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
	});
})();