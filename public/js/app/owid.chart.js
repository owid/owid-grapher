var Bounds = require('./Bounds').default

;(function(d3) {	
	"use strict";
	owid.namespace("owid.chart");

	owid.chart = function() {
		var chart = owid.dataflow();
		window.chart = chart;

		// Set up models and data processors
		chart.requires('containerNode', 'chartConfig', 'outerBounds', 'activeTabName');

		chart.defaults({
			landscapeAuthorDimensions: [900, 600],
			portraitAuthorDimensions: [400, 640],
			isExport: !!window.location.pathname.match(/.export$/),
			isEmbed: window.self != window.top || App.isEditor,
			isEditor: App.isEditor,
			isMobile: d3.select('html').classed('touchevents'),
			dispatch: d3.dispatch('renderEnd')
		});

		// TODO (Mispy): A lot of this model code is old hacky stuff that's been
		// wired together to keep it working. Compatibility with the editor especially
		// since the editor code is generally much older.
		chart.flow('model : chartConfig', function(chartConfig) {
			return new App.Models.ChartModel(chartConfig);
		});

		chart.flow('vardata, data, colors : model', function(model) {
			App.ChartModel = model;
			App.VariableData = new App.Models.VariableData();	
			App.ChartData = new App.Models.ChartData();
			App.Colors = new App.Models.Colors();		

			return [App.VariableData, App.ChartData, App.Colors];
		});

		chart.flow('map : model', function(model) {			
			App.ChartModel.bind();
			return App.MapModel;
		});
		chart.flow('mapdata : map', function(map) {
			return owid.models.mapdata(chart);
		});
		chart.flow('url : model', function(model) {
			return owid.component.urlBinder(chart);
		});

		chart.flow('exporter : model', function(model) {
			return new App.Views.Export(chart);
		});

		chart.flow('debugHelper : model', function(model) {
			return new App.Views.DebugHelper(chart);
		});

		chart.flow('tooltip : model', function(model) {
			return new owid.view.tooltip(chart);
		});

		chart.flow('header : model', function() { return owid.control.header(chart); });
		chart.flow('creditsFooter : model', function() { return new owid.component.footer(chart); });
		chart.flow('controlsFooter : model', function() { return owid.view.controlsFooter(); });

		// Container setup
		chart.flow('containerNode', function(containerNode) {
			chart.setupDOM();

			d3.select(containerNode).classed('chart-container', true);

			function resize() {
				chart.now('isExport, isEmbed', function(isExport, isEmbed) {
					if (isExport) return; // Export specifies its own dimensions

					var bounds = owid.bounds(containerNode.getBoundingClientRect());
					if (isEmbed) {
						bounds = bounds.pad(1);
					} else {
						if (bounds.width < 800)
							bounds = bounds.pad(bounds.width*0.01, bounds.height*0.02);
						else
							bounds = bounds.pad(bounds.width*0.02, bounds.height*0.075);
					}

					chart.update({
						outerBounds: bounds
					});				
				});
			}

			new ResizeSensor(containerNode, resize);
			resize();
		});

		chart.flow('el : containerNode', function(containerNode) {
			return d3.select(containerNode).append('div').attr('id', 'chart');
		});
		chart.flow('dom : el', function(el) {
			return el.node();
		});
		chart.flow('htmlNode : el', function(el) {
			return el.node();
		});
		chart.flow('svg : el', function(el) {
			return el.append('svg').attr('xmlns', 'http://www.w3.org/2000/svg').attr('xmls:xlink', 'http://www.w3.org/1999/xlink').attr('version', '1.1');
		});
		chart.flow('svgNode : svg', function(svg) {
			return svg.node();
		});
		chart.flow('loadingIcon : el', function(el) {
			return el.append('div').attr('class', 'loadingIcon').html('<i class="fa fa-spinner fa-spin"></i>');
		});

		// Tabs setup
		chart.flow('tabs : model', function() {
			return {
				chart: owid.tab.chart(chart),
				data: owid.component.dataTab(chart),
				map: owid.component.mapTab(chart),
				sources: owid.component.sourcesTab(chart)
			};
		});

		// We only ever have one "active tab", but some tabs render on top of others
		chart.flow('primaryTab : tabs, activeTabName', function(tabs, activeTabName) {
			var tab = tabs[activeTabName];

			if (tab.isOverlay)
				return chart.primaryTab;

			if (chart.primaryTab && !tab.isOverlay)
				chart.primaryTab.clean();

			return tab.isOverlay ? chart.primaryTab : tab;
		});
		chart.flow('overlayTab : tabs, activeTabName', function(tabs, activeTabName) {
			var tab = tabs[activeTabName];
			if (chart.overlayTab) chart.overlayTab.clean();
			return tab.isOverlay ? tab : null;
		});

		chart.flow('isPortrait : outerBounds', function(outerBounds) {
			return outerBounds.width < outerBounds.height;
		});

		chart.flow('el, isPortrait', function(el, isPortrait) {
			el.classed('portrait', isPortrait).classed('landscape', !isPortrait);
		});

		chart.flow('el, isExport', function(el, isExport) {
			el.classed('export', isExport);
		});

		chart.flow('authorWidth, authorHeight : isPortrait, landscapeAuthorDimensions, portraitAuthorDimensions', function(isPortrait, landscapeAuthorDimensions, portraitAuthorDimensions) {
			if (isPortrait) {
            	return portraitAuthorDimensions;
			} else {
				return landscapeAuthorDimensions;
			}
		});

		// Scaling setup
		chart.flow('renderWidth, renderHeight : outerBounds, authorWidth, authorHeight', function(outerBounds, authorWidth, authorHeight) {
			return [authorWidth, authorHeight];
		});
		chart.flow('scale : outerBounds, renderWidth, renderHeight, isEditor', function(outerBounds, renderWidth, renderHeight, isEditor) {			
			if (isEditor) return 1;
			else return Math.min(outerBounds.width/renderWidth, outerBounds.height/renderHeight);
		});
		chart.flow('el, renderWidth, renderHeight, scale', function(el, renderWidth, renderHeight, scale) {
			el.style('width', renderWidth*scale + 'px').style('height', renderHeight*scale + 'px');
		});
		chart.flow('svg, renderWidth, renderHeight, scale', function(svg, renderWidth, renderHeight, scale) {
			svg.style('width', '100%')
			   .style('height', '100%')
			   .attr('viewBox', '0 0 ' + renderWidth + ' ' + renderHeight);
		});
		chart.flow('innerBounds : renderWidth, renderHeight', function(renderWidth, renderHeight) {
			return new Bounds(0, 0, renderWidth, renderHeight);
		});		
		chart.flow('el, scale', function(el, scale) {
			el.style('font-size', 16*scale + 'px');
		});

		chart.flow('primaryTab, scale', function() { 
			chart.data.ready(chart.render);
		});
		chart.flow('model, primaryTab', function(model) {
			model.on('change', function() { chart.data.ready(chart.render); });
		});
		chart.flow('map, primaryTab', function(map) {
			map.on('change', function() { chart.data.ready(chart.render); });
		});

		chart.flow('exportMode : isExport', function(isExport) {
			return isExport ? owid.component.exportMode(chart) : null;
		});

		chart.render = function() {
			requestAnimationFrame(function() {
				chart.now('el, header, controlsFooter, creditsFooter, primaryTab, overlayTab, innerBounds, scale, loadingIcon', function(el, header, controlsFooter, creditsFooter, primaryTab, overlayTab, innerBounds, scale, loadingIcon) {
					loadingIcon.classed('hidden', false);

					chart.data.transformData();
					var bounds = innerBounds.pad(15);

					header.render(bounds);
					bounds = bounds.padTop(header.view.bbox.height);

					controlsFooter.render(bounds);
					bounds = bounds.padBottom(controlsFooter.height);

		//			owid.boundsDebug(bounds);
					creditsFooter.render(bounds);

					bounds = bounds.padBottom(creditsFooter.height);

					if (primaryTab)
						primaryTab.render(bounds);

					if (overlayTab)
						overlayTab.render(innerBounds.padBottom(controlsFooter.height+2));

					loadingIcon.classed('hidden', true);
				});
			});
		};

		chart.setupDOM = function() {
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
		};

		chart.getBounds = function(node) {
			var bounds = node.getBoundingClientRect();

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
			var chartRect = chart.el.node().getBoundingClientRect(),
				nodeRect = node.getBoundingClientRect();

			return owid.bounds(
				nodeRect.left-chartRect.left,
				nodeRect.top-chartRect.top,
				nodeRect.width,
				nodeRect.height
			);
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
			var errorUpdate = chart.el.selectAll('.chart-error').data([msg]);
			errorUpdate.enter().append('div').attr('class', 'chart-error')
				.merge(errorUpdate).html(function(d) { return d; });
		};

		return chart;
	};	
})(d3v4);