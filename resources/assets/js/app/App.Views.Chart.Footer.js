;(function() {	
	"use strict";
	owid.namespace("App.Views.Chart.Footer");

	App.Views.Chart.Footer = Backbone.View.extend({
		el: "#chart-view svg",
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

			App.ChartModel.on("change", this.renderSVG.bind(this));
			this.dispatcher.on("header-rendered", this.updateSharingButtons.bind(this));
			$(window).on("query-change", this.updateSharingButtons.bind(this));
		},

		render: function() {
			this.renderSVG();
			this.updateSharingButtons();
		},

		renderSVG: function() {
			var svg = d3.select("svg"),
				svgWidth = svg.node().getBoundingClientRect().width,
				svgHeight = svg.node().getBoundingClientRect().height;

			svg.selectAll(".chart-footer-svg").remove();
			var g = svg.append("g").attr("class", "chart-footer-svg");

			var licenseText = g.append("text")
				.attr("class", "license-svg")
				.attr("x", 0)
				.attr("y", 0)
				.attr("dy", "1rem");

			var license = "It is a long established fact that a reader will be\n\n distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using 'Content here, content here', making it look like readable English. Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for 'lorem ipsum' will uncover many web sites still in their infancy. Various versions have evolved over the years, sometimes by accident, sometimes on purpose (injected humour and the like).";

			owid.svgSetWrappedText(licenseText, license, svgWidth);

			var footerHeight = g.node().getBBox().height;
			g.attr("transform", "translate(0, " + (svgHeight - footerHeight) + ")");


/*			var sourceInfoText = g.append("text")
				.attr("class", "source-info-svg")
				.attr("x", 0)
				.text("Data obtained from:");

			sourceInfoText.attr("y", svgHeight - sourceInfoText.node().getBBox().height);
			owid.svgTextWrap(sourceInfoText, svgWidth);*/


			//owid.svgTextWrap(licenseText, svgWidth);

/*			var chartSubnameText = g.append("text")
				.attr("class", "chart-subname")
				.attr("x", 0)
				.attr("y", 0)
				.attr("dy", "2.7rem")
				.text(chartSubname)
				.style("font-size", "0.8rem");

			owid.svgTextWrap(chartSubnameText, svgWidth);*/

			/* Now for the sharing buttons, which are thankfully just HTML */
		},

		updateSharingButtons: function() {
			var headerText = d3.select(".chart-name-svg").text(),
				baseUrl = Global.rootUrl + "/" + App.ChartModel.get("chart-slug"),
				queryStr = window.location.search,
				canonicalUrl = baseUrl + queryStr;

			this.$chartLinkBtn.attr('href', canonicalUrl);

			var tweetHref = "https://twitter.com/intent/tweet/?text=" + encodeURIComponent(headerText) + "&url=" + encodeURIComponent(canonicalUrl) + "&via=MaxCRoser";
			this.$tweetBtn.attr('href', tweetHref);

			var facebookHref = "https://www.facebook.com/dialog/share?app_id=1149943818390250&display=page&href=" + encodeURIComponent(canonicalUrl);
			this.$facebookBtn.attr('href', facebookHref);

			var pngHref = baseUrl + ".png" + queryStr,
				svgHref = baseUrl + ".svg" + queryStr,
				defaultSize = "1000x700";
			this.$downloadPNGButton.attr('href', pngHref + (_.include(pngHref, "?") ? "&" : "?") + "size=" + defaultSize);
			this.$downloadSVGButton.attr('href', svgHref + (_.include(svgHref, "?") ? "&" : "?") + "size=" + defaultSize);

			var iframeWidth = App.ChartModel.get("iframe-width") || "100%";
			var iframeHeight = App.ChartModel.get("iframe-height") || "660px";
			var embedCode = '<iframe src="' + canonicalUrl + '" width="' + iframeWidth + '" height="' + iframeHeight + '"></iframe>';
			this.$embedModal.find("textarea").text(embedCode);
		},

		onResize: function() {
			this.renderSVG();
		},

		onEmbed: function() {
			this.$embedModal.modal();
		},
	});
})();