;(function() {	
	"use strict";
	owid.namespace("App.Views.Chart.Footer");

	App.Views.Chart.Footer = Backbone.View.extend({
		el: "#chart-view .chart-footer",
		events: {
			"click .embed-btn": "onEmbed"
		},

		initialize: function(options) {
			this.dispatcher = options.dispatcher;
			this.$linkBtn = this.$el.find(".chart-link-btn");
			this.$tweetBtn = this.$el.find(".tweet-btn");
			this.$facebookBtn = this.$el.find(".facebook-btn");
			this.$embedBtn = this.$el.find(".embed-btn");
			this.$downloadImageBtn = this.$el.find(".download-image-btn");
			this.$embedModal = $(".embed-modal");

			this.render();
			this.dispatcher.on("header-rendered", this.render.bind(this));
		},

		render: function() {
			var headerText = $(".chart-header .chart-name").text(),				
				currentUrl = window.location.toString();

			var tweetHref = "https://twitter.com/intent/tweet/?text=" + encodeURIComponent(headerText) + "&url=" + encodeURIComponent(currentUrl) + "&via=MaxCRoser";
			this.$tweetBtn.attr('href', tweetHref);

			var facebookHref = "https://www.facebook.com/dialog/share?app_id=1149943818390250&display=page&href=" + encodeURIComponent(currentUrl);
			this.$facebookBtn.attr('href', facebookHref);

			var pngHref = currentUrl.replace(/($|[?])/, '.png$&'),
				defaultSize = "1000x700";
			this.$downloadImageBtn.attr('href', pngHref + (_.include(pngHref, "?") ? "&" : "?") + "size=" + defaultSize);

			var iframeWidth = App.ChartModel.get("iframe-width") || "100%";
			var iframeHeight = App.ChartModel.get("iframe-height") || "660px";
			var embedCode = '<iframe src="' + currentUrl + '" width="' + iframeWidth + '" height="' + iframeHeight + '"></iframe>';
			this.$embedModal.find("textarea").text(embedCode);
		},

		onEmbed: function() {
			this.$embedModal.modal();
		},
	});
})();