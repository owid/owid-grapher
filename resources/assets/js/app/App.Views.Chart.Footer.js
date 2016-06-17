;(function() {	
	"use strict";
	owid.namespace("App.Views.Chart.Footer");

	App.Views.Chart.Footer = Backbone.View.extend({
		el: "#chart-view .footer-btns",
		events: {
			"click .embed-btn": "onEmbed"
		},

		initialize: function(options) {
			this.dispatcher = options.dispatcher;
			this.$chartLinkBtn = this.$el.find(".chart-link-btn");
			this.$tweetBtn = this.$el.find(".tweet-btn");
			this.$facebookBtn = this.$el.find(".facebook-btn");
			this.$embedBtn = this.$el.find(".embed-btn");
			this.$downloadPNGButton = this.$el.find(".download-image-btn");
			this.$downloadSVGButton = this.$el.find(".download-svg-btn");
			this.$embedModal = $(".embed-modal");
			this.$embedModal.appendTo("body");			

			App.ChartModel.on("change", this.render.bind(this));
			this.dispatcher.on("header-rendered", this.updateSharingButtons.bind(this));
			$(window).on("query-change", this.updateSharingButtons.bind(this));
		},

		render: function(callback) {
			App.DataModel.ready(function() {
				this.renderSVG();
				this.updateSharingButtons();
				if (_.isFunction(callback)) callback();
			}.bind(this));
		},

		renderSVG: function(callback) {
			var sources = App.DataModel.transformDataForSources(),
				sourceNames = _.uniq(_.pluck(sources, "name")),
 				license = App.DataModel.get("variableData").license,
 				chartDesc = App.ChartModel.get("chart-description"),
				footerSvgContent = "Data obtained from: ";
				
			_.each(sourceNames, function(sourceName, i) {
				if (i > 0) footerSvgContent += ", ";
				footerSvgContent += "<a class='source-link' href='#'>" + sourceName + "</a>";
			});

			if (license && license.description) {
				var desc = license.description;
				var originUrl = App.ChartModel.get("data-entry-url");

				// Make sure the link back to OWID is consistent
				if (originUrl && s.contains(originUrl, "ourworldindata.org")) {
					var a = document.createElement('a');
					a.href = originUrl;
					var path = a.pathname[0] == "/" ? a.pathname : "/" + a.pathname; // MISPY: cross-browser compat (Internet Explorer doesn't have a slash)
					var finalUrl = "https://ourworldindata.org" + path + a.search;
					desc = desc.replace(/\*data-entry\*/, "<a class='origin-link' target='_blank' href='" + finalUrl + "'>" + "OurWorldInData.org" + path + a.search + "</a>");					
				} else {
					desc = desc.replace(/\*data-entry\*/, 
						"<a class='origin-link' target='_blank' href='http://ourworldindata.org'>OurWorldInData.org</a>");					
				}

				footerSvgContent += "\n\n" + desc;
			}			

			// Any additional, manually inputed footer text
			if (chartDesc)
				footerSvgContent += "\n" + chartDesc;

			var svg = d3.select("svg"),
				svgWidth = svg.node().getBoundingClientRect().width,
				svgHeight = svg.node().getBoundingClientRect().height;

			svg.selectAll(".chart-footer-svg").remove();
			var g = svg.append("g").attr("class", "chart-footer-svg");

			var footerText = g.append("text")
				.attr("x", 0)
				.attr("y", 0)
				.attr("dy", 0);

			owid.svgSetWrappedText(footerText, footerSvgContent, svgWidth, { lineHeight: 1.2 });

			$(".chart-footer-svg .source-link").click(function(ev) {
				ev.preventDefault();
				App.ChartView.activateTab("sources");
			});

			var footerHeight = g.node().getBBox().height;
			g.insert("rect", "*")
				.attr("x", 0).attr("y", -25)			
				.attr("width", svgWidth)
				.attr("height", footerHeight + 25)
				.style("fill", "#fff");
			g.attr("transform", "translate(0, " + (svgHeight - footerHeight) + ")");

			if (callback) callback();
		},

		updateSharingButtons: function() {
			var headerText = d3.select("title").text().replace(" - Our World In Data", ""),
				baseUrl = Global.rootUrl + "/" + App.ChartModel.get("chart-slug"),
				queryParams = owid.getQueryParams(),
				queryStr = owid.queryParamsToStr(queryParams),				
				tab = App.ChartView.activeTabName,
				canonicalUrl = baseUrl + queryStr;

			this.$chartLinkBtn.attr('href', canonicalUrl);

			var tweetHref = "https://twitter.com/intent/tweet/?text=" + encodeURIComponent(headerText) + "&url=" + encodeURIComponent(canonicalUrl) + "&via=MaxCRoser";
			this.$tweetBtn.attr('href', tweetHref);

			var facebookHref = "https://www.facebook.com/dialog/share?app_id=1149943818390250&display=page&href=" + encodeURIComponent(canonicalUrl);
			this.$facebookBtn.attr('href', facebookHref);

			if (tab == "data" || tab == "sources") {
				this.$downloadPNGButton.hide();
				this.$downloadSVGButton.hide();
			} else {			
				var pngHref = baseUrl + ".png" + queryStr,
					svgHref = baseUrl + ".svg" + queryStr,
					defaultSize = "1000x700";
				this.$downloadPNGButton.attr('href', pngHref + (_.include(pngHref, "?") ? "&" : "?") + "size=" + defaultSize);
				this.$downloadSVGButton.attr('href', svgHref + (_.include(svgHref, "?") ? "&" : "?") + "size=" + defaultSize);
				this.$downloadPNGButton.show();
				this.$downloadSVGButton.show();
			}

			var iframeWidth = App.ChartModel.get("iframe-width") || "100%";
			var iframeHeight = App.ChartModel.get("iframe-height") || "660px";
			var embedCode = '<iframe src="' + canonicalUrl + '" width="' + iframeWidth + '" height="' + iframeHeight + '" frameborder="0"></iframe>';
			this.$embedModal.find("textarea").text(embedCode);
		},

		onResize: function(callback) {
			this.renderSVG(callback);
		},

		onEmbed: function() {
			this.$embedModal.modal();
		},
	});
})();