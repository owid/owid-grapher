;(function() {	
	"use strict";
	owid.namespace("App.Views.Chart.Footer");

	App.Views.Chart.Footer = owid.View.extend({
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

			this.listenTo(App.ChartModel, "change:chart-dimensions change:chart-description", this.render.bind(this));
			this.listenTo($(window), "query-change", this.updateSharingButtons.bind(this));
		},

		render: function(callback) {
			this.renderSVG();
			this.updateSharingButtons();
			if (_.isFunction(callback)) callback();
		},

		renderSVG: function(callback) {
			var sources = App.ChartData.transformDataForSources(),
				sourceNames = _.uniq(_.pluck(sources, "name")),
 				chartDesc = App.ChartModel.get("chart-description"),
				footerSvgMain = "", footerSvgNote = "", footerSvgLicense = "";

			// Add the Source line
			footerSvgMain += '<a class="bold">Data source: </a>';
				
			_.each(sourceNames, function(sourceName, i) {
				if (i > 0) footerSvgMain += ", ";
				footerSvgMain += "<a class='source-link' href='#'>" + sourceName + "</a>";
			});

			// Add Note, if any
			if (chartDesc) {
				footerSvgNote += '<a class="bold">Note: </a>' + chartDesc;
			}

			// Static image export has slightly different license text
			if ($("#chart-export").length > 0)
				footerSvgLicense = 'The author Max Roser licensed this visualization under a <a class="licence-link" href="http://creativecommons.org/licenses/by-sa/4.0/deed.en_US" target="_blank">CC BY-SA license</a>. At the site - *data-entry* - you find the data for download and the empirical research on this topic that puts this visualization in context.';
			else
				footerSvgLicense = 'The author Max Roser licensed this visualization under a <a class="licence-link" href="http://creativecommons.org/licenses/by-sa/4.0/deed.en_US" target="_blank">CC BY-SA license</a>. At the site - *data-entry* - you find the empirical research on this topic that puts this visualization in context.';

			var originUrl = App.ChartModel.get("data-entry-url");

			// Make sure the link back to OWID is consistent
			if (originUrl && s.contains(originUrl, "ourworldindata.org")) {
				var a = document.createElement('a');
				a.href = originUrl;
				var path = a.pathname[0] == "/" ? a.pathname : "/" + a.pathname; // MISPY: cross-browser compat (Internet Explorer doesn't have a slash)
				var finalUrl = "https://ourworldindata.org" + path + a.search;
				footerSvgLicense = footerSvgLicense.replace(/\*data-entry\*/, "<a class='origin-link' target='_blank' href='" + finalUrl + "'>" + "OurWorldInData.org" + path + a.search + "</a>");					
			} else {
				footerSvgLicense = footerSvgLicense.replace(/\*data-entry\*/, 
					"<a class='origin-link' target='_blank' href='http://ourworldindata.org'>OurWorldInData.org</a>");					
			}

			var svg = d3.select("svg"),
				svgBounds = svg.node().getBoundingClientRect(),
				svgWidth = svgBounds.width,
				svgHeight = svgBounds.height;

			svg.selectAll(".chart-footer-svg").remove();
			var g = svg.append("g").attr("class", "chart-footer-svg");

			var footerMainText = g.append("text")
				.attr("x", 0)
				.attr("y", 0)
				.attr("dy", 0);

			owid.svgSetWrappedText(footerMainText, footerSvgMain, svgWidth, { lineHeight: 1.1 });

			if (footerSvgNote) {
				var footerNoteText = g.append("text")
						.attr("class", "footer-note-svg")
						.attr("x", 0)
						.attr("y", footerMainText.node().getBoundingClientRect().bottom - svgBounds.top)
						.attr("dy", "1.5em");

				owid.svgSetWrappedText(footerNoteText, footerSvgNote, svgWidth, { lineHeight: 1.1 });				
			}

			var footerLicenseText = g.append("text")
					.attr("class", "footer-license-svg")
					.attr("x", 0)
					.attr("y", (footerSvgNote ? footerNoteText : footerMainText).node().getBoundingClientRect().bottom - svgBounds.top)
					.attr("dy", "1.5em");

			owid.svgSetWrappedText(footerLicenseText, footerSvgLicense, svgWidth, { lineHeight: 1.1 });
	
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
			g.attr("transform", "translate(0, " + (svgHeight - footerHeight + 10) + ")");

			if (callback) callback();
		},

		updateSharingButtons: function() {
			var headerText = d3.select("title").text().replace(" - Our World In Data", ""),
				baseUrl = Global.rootUrl + "/" + App.ChartModel.get("chart-slug"),
				queryParams = owid.getQueryParams(),
				queryStr = owid.queryParamsToStr(queryParams),				
				tab = App.ChartView.activeTabName,
				canonicalUrl = baseUrl + queryStr,
				version = App.ChartModel.get("variableCacheTag");

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
					defaultTargetSize = "1200x800";
				this.$downloadPNGButton.attr('href', pngHref + (_.include(pngHref, "?") ? "&" : "?") + "size=" + defaultTargetSize + "&v=" + version);
				this.$downloadSVGButton.attr('href', svgHref + (_.include(svgHref, "?") ? "&" : "?") + "size=" + defaultTargetSize + "&v=" + version);
				this.$downloadPNGButton.show();
				this.$downloadSVGButton.show();
			}

			var embedCode = '<iframe src="' + canonicalUrl + '" style="width: 100%; height: 660px; border: 0px none;"></iframe>';
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