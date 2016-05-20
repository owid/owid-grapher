;(function() {	
	"use strict";
	owid.namespace("App.Views.Chart.Footer");

	App.Views.Chart.Footer = Backbone.View.extend({
		el: "#chart-view .chart-footer",
		events: {
			"click .embed-btn": "onEmbed",
			"click .download-svg-btn": "tmpSVG"
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

			this.render();
			this.dispatcher.on("header-rendered", this.render.bind(this));
			$(window).on("query-change", this.render.bind(this));
		},

		render: function() {
			var headerText = $(".chart-header .chart-name").text(),
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

		onEmbed: function() {
			this.$embedModal.modal();
		},
	});
})();