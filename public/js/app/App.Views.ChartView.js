;(function() {	
	"use strict";
	owid.namespace("owid.chart");

	owid.chart = function() {
		var chart = owid.dataflow();
		App.ChartView = chart;
		window.chart = chart;

		// Set up models and data processors
		App.VariableData = new App.Models.VariableData();	
		App.ChartData = new App.Models.ChartData();
		App.Colors = new App.Models.Colors();
		App.ChartModel.bind();
		chart.model = App.ChartModel;
		chart.vardata = App.VariableData;
		chart.data = App.ChartData;
		chart.map = App.MapModel;
		chart.colors = App.Colors;

		chart.requires('containerNode', 'outerBounds', 'activeTabName');

		chart.defaults({
			authorWidth: App.AUTHOR_WIDTH,
			authorHeight: App.AUTHOR_HEIGHT
		});

		// Container setup
		chart.flow('containerNode', function(containerNode) {
			d3.select(containerNode).classed('chart-container', true);
		});
		chart.flow('el : containerNode', function(containerNode) {
			return d3.select(containerNode).append('div').attr('id', 'chart');
		});
		chart.flow('el, outerBounds', function(el, outerBounds) {
		});
		chart.flow('dom : el', function(el) {
			return el.node();
		});
		chart.flow('svg : el', function(el) {
			return el.append('svg').attr('xmlns', 'http://www.w3.org/2000/svg').attr('xmls:xlink', 'http://www.w3.org/1999/xlink').attr('version', '1.1');
		});

		// Scaling setup
		chart.flow('innerBounds : authorWidth, authorHeight', function(authorWidth, authorHeight) {
			var paddingLeft = 15, paddingTop = 15;
			return { left: paddingLeft, top: paddingTop, width: authorWidth-paddingLeft*2, height: authorHeight-paddingTop*2 };
		});
		chart.flow('scale : outerBounds, authorWidth, authorHeight', function(outerBounds, authorWidth, authorHeight) {
			return Math.min(outerBounds.width/authorWidth, outerBounds.height/authorHeight);
		});
		chart.flow('el, authorWidth, authorHeight, scale', function(el, authorWidth, authorHeight, scale) {
			el.style('width', authorWidth*scale + 'px').style('height', authorHeight*scale + 'px')
			  .style('display', 'inline-block').style('vertical-align', 'middle');
		});
		chart.flow('svg, authorWidth, authorHeight, scale', function(svg, authorWidth, authorHeight, scale) {
			svg.style('width', '100%')
			   .style('height', '100%')
			   .attr('viewBox', '0 0 ' + authorWidth + ' ' + authorHeight);
		});


		chart.render = function() {
			chart.now('innerBounds', function(bounds) {
				console.log(bounds);
				chart.data.transformData();
				chart.tabSelector.switchTab();

/*				var paddingLeft = 50,
					paddingTop = 50;

				var bounds = { left: paddingLeft, top: paddingTop, width: chart.innerRenderWidth-(paddingLeft*2), height: chart.innerRenderHeight-(paddingTop*2) };*/

				chart.header.render(bounds);

				bounds = _.extend({}, bounds, { top: bounds.top+chart.header.view.bbox.height, height: bounds.height-chart.header.view.bbox.height });
	//			owid.boundsDebug(bounds);
				chart.footer.render(bounds);

				bounds = _.extend({}, bounds, { height: bounds.height-chart.footer.height });

				// Pad the tab a little
				bounds = _.extend({}, bounds, { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height });

		//		chart.tabSelector.render();
				if (chart.activeTab) chart.activeTab.render(bounds);

				chart.el.select('.chart-inner').style('visibility', 'visible');
			});
		};

		chart.setupDOM = function() {
			jQuery(window).resize(chart.resize);

/*			jQuery(window).one("chart-loaded", function() {
				App.ChartView.onResize(function() {
					window.top.postMessage("chartLoaded", "*");
					console.log("Loaded chart: " + chart.model.get("chart-name"));
				});
			});*/

			// Pass through touch events to containing document
			// Important for presentations on mobile
			jQuery('body').on('touchstart', function(ev) {
				var touches = [];
				_.each(ev.originalEvent.touches, function(touch) {
					touches.push({
						clientX: touch.clientX,
						clientY: touch.clientY
					});
				});
				window.parent.postMessage({ event: 'touchstart', touches: touches }, "*");
			});

			jQuery('body').on('touchmove', function(ev) {
				if ($(ev.target).closest('.map-timeline-controls').length) return;
				
				var touches = [];
				_.each(ev.originalEvent.touches, function(touch) {
					touches.push({
						clientX: touch.clientX,
						clientY: touch.clientY
					});
				});
				window.parent.postMessage({ event: 'touchmove', touches: touches }, "*");
			});

			jQuery('body').on('touchend', function(ev) {
				window.parent.postMessage({ event: 'touchend' }, "*");
			});

			jQuery(document).ajaxStart(function() {
				d3.select('.chart-preloader').classed('hidden', false);
			});

			jQuery(document).ajaxStop(function() {
				d3.select('.chart-preloader').classed('hidden', true);
			});

			if (chart.model.get("chart-name"))
				d3.select('.chart-preloader').classed('hidden', false);

			if (window.self != window.top || App.isEditor) {
				$chart.addClass("embedded");
			}
		};

/*		chart.applyScale = function() {
			chart.scale = 1;

			var targetWidth = chart.targetWidth,
				targetHeight = chart.targetHeight,
				authorWidth = App.AUTHOR_WIDTH,
				authorHeight = App.AUTHOR_HEIGHT,
				renderWidth, renderHeight;

			if (App.isEditor) {
				targetWidth = authorWidth;
				targetHeight = authorHeight;
				renderWidth = authorWidth;
				renderHeight = authorHeight;
			} else {
				if (targetWidth/targetHeight >= authorWidth/authorHeight) {
					renderWidth = (targetWidth/targetHeight) * authorHeight;
					renderHeight = authorHeight;
				} else {
					renderWidth = authorWidth;
					renderHeight = (targetHeight/targetWidth) * authorWidth;
				}				
			}

			chart.authorWidth = authorWidth;
			chart.authorHeight = authorHeight;
			chart.renderWidth = renderWidth;
			chart.renderHeight = renderHeight;

			var scale = Math.min(chart.targetWidth/chart.renderWidth, chart.targetHeight/chart.renderHeight);

			// Propagate some useful information to the CSS

//			$chart.removeClass('portrait landscape downscaled upscaled space120 space140 touchscreen narrow');

			chart.el.attr('class', '');

			chart.el.classed('landscape', renderWidth >= renderHeight);
			chart.el.classed('portrait', renderWidth < renderHeight);

			if (targetWidth < authorWidth || targetHeight < authorHeight) {
				chart.el.classed('downscaled', true);
			} else if (targetWidth > authorWidth && targetHeight > authorHeight) {
				chart.el.classed('upscaled', true);
			}

			var spaceFactor = (renderWidth+renderHeight) / (authorWidth+authorHeight);

			chart.el.classed('space150', spaceFactor >= 1.5);
			chart.el.classed('mobile', navigator.userAgent.match(/Mobi/));
			chart.el.classed('narrow', renderWidth < 600);

            var paddingLeft = parseFloat(chart.el.style('padding-left')),
                paddingTop = parseFloat(chart.el.style('padding-top'));

            chart.innerRenderWidth = renderWidth-paddingLeft*2-2;
            chart.innerRenderHeight = renderHeight-paddingTop*2-2;

            chart.dom.style.width = targetWidth+'px';
            chart.dom.style.height = targetHeight+'px';

			if (App.isExport || App.isEditor)
				return;
			
			// Now do the actual scaling

			chart.svg.style.width = targetWidth-paddingLeft*2 + 'px';
			chart.svg.style.height = targetHeight-paddingTop*2+ 'px';
			chart.svg.setAttribute('viewBox', '0 0 ' + (renderWidth-paddingLeft*2) + ' ' + (renderHeight-paddingTop*2));

			chart.scale = scale;			
		};*/

		// HACK (Mispy): Workaround for the differences in getBoundingClientRect
		// depending on whether you're using zoom or transform
		chart.getBounds = function(node) {
			var bounds = node.getBoundingClientRect(),
				untransformedBounds;

			if (chart.scale > 1 && owid.features.zoom) {
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

		chart.getTransformedBounds = function(node) {
			var bounds = node.getBoundingClientRect(),
				transformedBounds;

			if (chart.scale > 1 && owid.features.zoom) {
				transformedBounds = {
					top: bounds.top * chart.scale,
					right: bounds.right * chart.scale,
					bottom: bounds.bottom * chart.scale,
					left: bounds.left * chart.scale,
					height: bounds.height * chart.scale,
					width: bounds.width * chart.scale
				};
			} else {
				transformedBounds = bounds;
			}

			return transformedBounds;			
		};

		chart.resize = function() {
			chart.now('containerNode', function(containerNode) {
				var bounds = containerNode.getBoundingClientRect();				
				var marginLeft = bounds.width*0.2, marginTop = bounds.height*0.2;

				chart.update({
					outerBounds: { left: marginLeft, top: marginTop, width: bounds.width-marginLeft, height: bounds.height-marginTop }
				});
			});
		};

		chart.handleError = function(err, isCritical) {
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
		};

		chart.showMessage = function(msg) {
			this.$(".tab-pane.active").prepend('<div class="chart-error"><div>' + msg + '</div></div>');			
		};

		chart.update({ containerNode: d3.select('body').node() });
		chart.setupDOM();
		chart.resize();

		// For events that MUST be asynchronous and global, use sparingly
		chart.dispatch = d3.dispatch('renderEnd');

		chart.mapdata = owid.models.mapdata(chart);
		// DOM setup

		// Initialize components
		chart.url = owid.view.urlBinder(chart);
		chart.exporter = new App.Views.Export(chart);
		chart.header = owid.control.header(chart);
		chart.footer = new App.Views.Chart.Footer(chart);
		chart.tabSelector = owid.view.tabSelector(chart);
		chart.debugHelper = new App.Views.DebugHelper(chart);
		chart.tooltip = new owid.view.tooltip(chart);

		// Initialize tabs
		chart.tabs = {};
		var tabs = _.indexBy(chart.model.get("tabs"));
		chart.tabs.chart = owid.tab.chart(chart);
//		chart.tabs.data = owid.tab.data(chart);
//		chart.tabs.sources = owid.tab.sources(chart);
		chart.tabs.map = owid.tab.map(chart);

		chart.model.on('change', function() {
			chart.data.ready(chart.render);
		});
		chart.map.on('change', function() {
			chart.data.ready(chart.render);
		});
		chart.data.ready(chart.render);

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
	});
})();