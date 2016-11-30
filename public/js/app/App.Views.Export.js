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
			chart.$chart.addClass('export');

			var params = owid.getQueryParams(),
				targetWidth = params.size && params.size.split("x") ? parseInt(params.size.split("x")[0]) : 1200,
				targetHeight = params.size && params.size.split("x") ? parseInt(params.size.split("x")[1]) : 800,
				margin = Math.min(20*(targetWidth/App.AUTHOR_WIDTH), 20*(targetHeight/App.AUTHOR_HEIGHT));

			chart.display.set({
				targetWidth: targetWidth-(margin*2),
				targetHeight: targetHeight-(margin*2)
			});

			chart.dispatch.on('renderEnd', function() {
				setTimeout(function() {
					var svg = $("svg").get(0);
					svg.setAttribute("viewBox", "0 0 " + chart.renderWidth + " " + chart.renderHeight);
					svg.setAttribute("preserveAspectRatio", "none");
					$(svg).css("width", (targetWidth-(margin*2)) + "px");
	   			    $(svg).css("height", (targetHeight-(margin*2)) + "px");
					$("#chart").css('width', targetWidth);
					$("#chart").css('height', targetHeight);
					$(svg).css('margin', margin + 'px');

					// Remove SVG UI elements that aren't needed for export
					d3.select(svg).selectAll(".nv-add-btn, .nv-controlsWrap").remove();

					if (window.callPhantom)
						window.callPhantom({ targetWidth: targetWidth, targetHeight: targetHeight }); // Notify phantom that we're ready for PNG screenshot
					this.onSVGExport();					
				}.bind(this), 100);
			}.bind(this));
		},

		onSVGExport: function() {	
			var svg = d3.select("svg");

			// Inline the CSS styles, since the exported SVG won't have a stylesheet
			var styleSheets = document.styleSheets;
			var elems = [];
			_.each(document.styleSheets, function(styleSheet) {
				_.each(styleSheet.cssRules, function(rule) {
					try {
						$(rule.selectorText).each(function(i, elem) {			
							if (!elem.origStyle && !elem.hasChangedStyle) {
								elem.origStyle = elem.style.cssText;
								elem.style.cssText = "";
								elems.push(elem);
							}

							if ($(elem).parent().closest("svg").length) {
								elem.style.cssText += rule.style.cssText;
								elem.hasChangedStyle = true;
							}
						});
					} catch (e) {}
				});
			});

			_.each(elems, function(elem) {
				if (elem.origStyle)
					elem.style.cssText += elem.origStyle;
			});

			// MISPY: Need to propagate a few additional styles from the external document into the SVG
			$("svg").css("font-family", $("#chart").css("font-family"));
			$("svg").css("font-size", $("#chart").css("font-size"));

			svgAsDataUri(svg.node(), {}, function(uri) {
				var svgData = uri.substring('data:image/svg+xml;base64,'.length);
				if (_.isFunction(window.callPhantom))
					window.callPhantom({ "svg": svgData });
			});
		},
	});
})();