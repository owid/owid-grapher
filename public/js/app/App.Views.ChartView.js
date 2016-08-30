;(function() {	
	"use strict";
	owid.namespace("owid.chart");

	owid.chart = function() {
		function chart() {}
		App.ChartView = chart;

		App.VariableData = new App.Models.VariableData();	
		App.ChartData = new App.Models.ChartData();
		App.Colors = new App.Models.Colors();
		App.ChartModel.bind();
		chart.model = App.ChartModel;
		chart.vardata = App.VariableData;
		chart.data = App.ChartData;
		chart.colors = App.Colors;

		// For tracking transient display properties we don't want to save
		var DisplayModel = Backbone.Model.extend({
			defaults: {
				screenWidth: null,
				screenHeight: null,
				renderWidth: null,
				renderHeight: null,	
				activeTab: chart.model.get('default-tab')			
			}
		});
		chart.display = new DisplayModel();

		// Change tracker
		var changes = owid.changes();
		changes.track(chart.model);
		changes.track(chart.data);
		changes.track(chart.display, 'activeTab screenWidth screenHeight');

		var $chart = window.$("#chart"),
			$ = $chart.find.bind($chart);
		chart.dom = $chart.get(0);
		chart.$ = $;

		// Initialize components
		chart.urlBinder = new App.Views.ChartURL(chart);
		chart.exporter = new App.Views.Export(chart);
		chart.header = owid.view.header(chart);
		chart.footer = new App.Views.Chart.Footer(chart);
		chart.scaleSelectors = new App.Views.Chart.ScaleSelectors(chart);
		chart.tabSelector = owid.view.tabSelector(chart);
		chart.debugHelper = new App.Views.DebugHelper(chart);

		// Initialize tabs
		chart.tabs = {};
		var tabs = _.indexBy(chart.model.get("tabs"));
		if (tabs.chart) chart.tabs.chart = owid.tab.chart(chart);
		if (tabs.data) chart.tabs.data = owid.tab.data(chart);
		if (tabs.sources) chart.tabs.sources = owid.tab.sources(chart);
		if (tabs.map) chart.tabs.map = new App.Views.Chart.MapTab(chart);
		// 

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
			jQuery(window).resize(chart.resize);

/*			jQuery(window).one("chart-loaded", function() {
				App.ChartView.onResize(function() {
					window.top.postMessage("chartLoaded", "*");
					console.log("Loaded chart: " + chart.model.get("chart-name"));
				});
			});*/

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

			if (chart.model.get("chart-name"))
				chart.$(".chart-preloader").show();

			if (window.self != window.top || App.isEditor) {
				$chart.addClass("embedded");
			}
		};

		chart.initialScale = function() {
			if (!changes.any('screenWidth screenHeight'))
				return;

			var screenWidth = chart.display.get('screenWidth'),
				screenHeight = chart.display.get('screenHeight'),
				authorWidth = App.AUTHOR_WIDTH,
				authorHeight = App.AUTHOR_HEIGHT,
				renderWidth, renderHeight;

			if (screenWidth >= screenHeight) {
				renderWidth = (screenWidth/screenHeight) * authorHeight;
				renderHeight = authorHeight;
			} else {
				renderWidth = authorWidth;
				renderHeight = (screenHeight/screenWidth) * authorWidth;
			}

			chart.dom.style.width = renderWidth + 'px';
			chart.dom.style.height = renderHeight + 'px';
			chart.dom.style.zoom = '';
			chart.dom.style.left = '';
			chart.dom.style.top = '';
			owid.transformElement(chart.dom, '');

			chart.screenWidth = screenWidth;
			chart.screenHeight = screenHeight;
			chart.authorWidth = authorWidth;
			chart.authorHeight = authorHeight;
			chart.renderWidth = renderWidth;
			chart.renderHeight = renderHeight;
			chart.display.set({ renderWidth: renderWidth, renderHeight: renderHeight });
			chart.scale = 1;
		};

		chart.displayScale = function() {
			if (!changes.any('screenWidth screenHeight'))
				return;

			var scale = Math.min(chart.screenWidth/chart.renderWidth, chart.screenHeight/chart.renderHeight);

			if (false && scale > 1 && owid.features.zoom) {
				chart.dom.style.zoom = scale;
			} else {
				chart.dom.style.left = '50%';
				chart.dom.style.top = '50%';
				chart.dom.style.bottom = 'auto';
				chart.dom.style.right = 'auto';
				owid.transformElement(chart.dom, "translate(-50%, -50%) scale(" + scale + ")");					
			}								

			chart.scale = scale;
		};

		chart.render = function() {
			if (!changes.start())
				return;
			console.trace('chart.render');
			chart.data.transformData();
			console.log(changes.get());
			if (changes.any('activeTab')) chart.tabSelector.switchTab();
			chart.initialScale();
			chart.header.render();
			chart.footer.render();
			chart.tabSelector.render();
			chart.activeTab.render();
			chart.displayScale();

			$chart.css('visibility', 'visible');			
			changes.done();
		};

		chart.getBounds = function(node) {
			var bounds = node.getBoundingClientRect(),
				untransformedBounds;

			if (false && chart.scale > 1 && owid.features.zoom) {
				untransformedBounds = bounds;
			} else {
				untransformedBounds = {
					top: bounds.top / chart.scale,
					right: bounds.right / chart.scale,
					bottom: bounds.bottom / chart.scale,
					left: bounds.left / chart.scale,
					height: bounds.height / chart.scale,
					width: bounds.width / chart.scale
				};
			}
			return untransformedBounds;
		};

		chart.resize = function() {
			chart.display.set({
				screenWidth: $chart.parent().width(),
				screenHeight: $chart.parent().height()
			});
		};

		chart.setupDOM();
		chart.resize();

		chart.model.on('change', function() {
			chart.data.ready(chart.render);
		});
		chart.display.on('change', function() {
			chart.data.ready(chart.render);
		});

		window.chart = chart;
		chart.changes = changes;
		return chart;
	};	

	App.Views.ChartView = owid.View.extend({
		activeTab: false,
		el: "#chart",

		events: {
			"click li.header-tab a": "onTabClick"
		},

		initialize: function(options) {
			App.ChartView = this;
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