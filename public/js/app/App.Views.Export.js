/* App.Views.Export.js  
 * ================                                                             
 *
 * This component is responsible for getting the chart into a nice state for phantomjs
 * to take a PNG screenshot, and serializing the SVG for export.
 *
 * @project Our World In Data
 * @author  Jaiden Mispy                                                     
 * @created 2016-08-09
 */ 

;(function() {
	"use strict";
	owid.namespace("App.Views.Export");

	App.Views.Export = owid.View.extend({
		initialize: function(options) {
			if (window.location.pathname.match(/.export$/))
				App.isExport = true;

			if (!App.isExport) return;

			$("body").attr("id", "chart-export");

			// For PNG and SVG export, we set the SVG to a fixed canonical rendering width
			// and then uniformly scale the rendered chart to the target dimensions.
			var params = owid.getQueryParams(),
				targetWidth = params.size && params.size.split("x") ? parseInt(params.size.split("x")[0]) : 1000,
				targetHeight = params.size && params.size.split("x") ? parseInt(params.size.split("x")[1]) : 700,
				canonicalWidth = 1000,
				canonicalHeight = 700;

			var renderWidth, renderHeight;
			if (targetWidth > targetHeight) {
				renderHeight = canonicalHeight;
				renderWidth = ((targetWidth-40)/(targetHeight-40)) * renderHeight;
			} else {
				renderWidth = canonicalWidth;
				renderHeight = ((targetHeight-40)/(targetWidth-40)) * renderWidth;
			}

			console.log(renderWidth, renderHeight);



			$("#chart-view").css("width", renderWidth);
			$("#chart-view").css("height", renderHeight);

			$(window).one("chart-loaded", function() {
				App.ChartView.onResize(function() {
					var svg = $("svg").get(0);
					var width = svg.getBBox().width;
					var height = svg.getBBox().height;
					svg.setAttribute("viewBox", "0 0 " + width + " " + height);
					svg.setAttribute("preserveAspectRatio", "xMinYMin meet");
					$(svg).css("width", (targetWidth-40) + "px");
	   			    $(svg).css("height", (targetHeight-40) + "px");
					$("svg").css("margin", "20px");
					$("#chart-view").css('width', targetWidth);
					$("#chart-view").css('height', targetHeight);

					if (window.callPhantom) {
						window.callPhantom({ targetWidth: targetWidth, targetHeight: targetHeight }); // Notify phantom that we're ready for PNG screenshot
						this.onSVGExport();
					}
				}.bind(this));
			}.bind(this));
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
			$("svg").css("font-size", $("#chart-view").css("font-size"));

			svgAsDataUri(svg.node(), {}, function(uri) {
				var svgData = uri.substring('data:image/svg+xml;base64,'.length);
				if (_.isFunction(window.callPhantom))
					window.callPhantom({ "svg": window.atob(svgData) });
			});
		},
	});
})();