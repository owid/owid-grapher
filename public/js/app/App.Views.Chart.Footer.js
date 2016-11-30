;(function() {	
	"use strict";
	owid.namespace("App.Views.Chart.Footer");

	App.Views.Chart.Footer = owid.View.extend({
		el: "#chart .footer-btns",
		events: {
			"click .embed-btn": "onEmbed"
		},

		initialize: function(chart) {
			this.chart = chart;
			this.$chartLinkBtn = this.$el.find(".chart-link-btn");
			this.$tweetBtn = this.$el.find(".tweet-btn");
			this.$facebookBtn = this.$el.find(".facebook-btn");
			this.$embedBtn = this.$el.find(".embed-btn");
			this.$downloadPNGButton = this.$el.find(".download-image-btn");
			this.$downloadSVGButton = this.$el.find(".download-svg-btn");
			this.$embedModal = $(".embed-modal");
			this.$embedModal.appendTo("body");			

			this.changes = owid.changes();
			this.changes.track(chart.model, 'chart-dimensions chart-description');
			this.changes.track(chart.display, 'renderWidth renderHeight');

			this.listenTo($(window), "query-change", this.updateSharingButtons.bind(this));
		},

		render: function() {
			if (!this.changes.start()) return;

			this.renderSVG();
			this.updateSharingButtons();
			this.changes.done();
		},

		renderSVG: function(callback) {
			var sources = App.ChartData.transformDataForSources(),
				sourceNames = _.uniq(_.pluck(sources, "name")),
 				chartDesc = App.ChartModel.get("chart-description"),
				footerSource = "", footerNote = "", footerLicense = "";

			// Add the Source line
			footerSource += '<a class="bold">Data source: </a>';
				
			_.each(sourceNames, function(sourceName, i) {
				if (i > 0) footerSource += ", ";
				footerSource += "<a class='source-link'>" + sourceName + "</a>";
			});

			// Add Note, if any
			if (chartDesc) {
				footerNote += '<a class="bold">Note: </a>' + chartDesc;
			}

			footerLicense = '*data-entry* • <a class="licence-link" href="http://creativecommons.org/licenses/by-sa/4.0/deed.en_US" target="_blank">CC BY-SA</a>';

			var originUrl = App.ChartModel.get("data-entry-url");

			// Make sure the link back to OWID is consistent
			if (originUrl && s.contains(originUrl, "ourworldindata.org")) {
				var a = document.createElement('a');
				a.href = originUrl;
				var path = a.pathname[0] == "/" ? a.pathname : "/" + a.pathname; // MISPY: cross-browser compat (Internet Explorer doesn't have a slash)
				var finalUrl = "https://ourworldindata.org" + path + a.search;
				footerLicense = footerLicense.replace(/\*data-entry\*/, "<a class='origin-link' target='_blank' href='" + finalUrl + "'>" + "OurWorldInData.org" + path + a.search + "</a>");					
			} else {
				footerLicense = footerLicense.replace(/\*data-entry\*/, 
					"<a class='origin-link' target='_blank' href='http://ourworldindata.org'>OurWorldInData.org</a>");					
			}

			var svg = d3.select("svg"),
				svgBounds = chart.getBounds(svg.node()),
				svgWidth = svgBounds.width,
				svgHeight = svgBounds.height;

			svg.selectAll(".chart-footer-svg").remove();
			var g = svg.append("g").attr("class", "chart-footer-svg");

			var footerSourceEl = g.append("text")
				.attr("x", 0)
				.attr("y", 0)
				.attr("dy", 0);

			owid.svgSetWrappedText(footerSourceEl, footerSource, svgWidth, { lineHeight: 1.1 });

			if (footerNote) {
				var footerNoteEl = g.append("text")
						.attr("class", "footer-note-svg")
						.attr("x", 0)
						.attr("y", chart.getBounds(footerSourceEl.node()).bottom - svgBounds.top)
						.attr("dy", "1.5em");

				owid.svgSetWrappedText(footerNoteEl, footerNote, svgWidth, { lineHeight: 1.1 });				
			}

			var footerLicenseEl = g.append("text")
					.attr("class", "footer-license-svg")
					.attr("x", 0)
					.attr("y", chart.getBounds((footerNote ? footerNoteEl : footerSourceEl).node()).bottom - svgBounds.top)
					.attr("dy", "1.5em");


			owid.svgSetWrappedText(footerLicenseEl, footerLicense, svgWidth, { lineHeight: 1.1 });

			var sourceBounds = chart.getBounds(footerSourceEl.node()),
				licenseBounds = chart.getBounds(footerLicenseEl.node());

			// Move the license stuff over to the right if there is space to do so

			if (svgBounds.width - sourceBounds.width > licenseBounds.width+10) {
				footerLicenseEl
					.attr('x', svgBounds.width)
					.attr('y', 0)
					.attr('dy', 0)
					.attr('text-anchor', 'end');
			}

			$(".chart-footer-svg .source-link").click(function(ev) {
				ev.preventDefault();
				chart.display.set({ activeTab: 'sources' });
			});

			var footerHeight = g.node().getBBox().height;
			g.insert("rect", "*")
				.attr("x", 0).attr("y", -26)			
				.attr("width", svgWidth)
				.attr("height", footerHeight + 27)
				.style("fill", "#fff");
			g.attr("transform", "translate(0, " + (svgHeight - footerHeight - $(".footer-btns").height()) + ")");

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

			var tweetHref = "https://twitter.com/intent/tweet/?text=" + encodeURIComponent(headerText) + "&url=" + encodeURIComponent(canonicalUrl);
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

			var embedCode = '<iframe src="' + canonicalUrl + '" style="width: 100%; height: 600px; border: 0px none;"></iframe>';
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