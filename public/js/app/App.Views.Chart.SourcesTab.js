;(function() {	
	"use strict";
	owid.namespace("App.Views.Chart.SourcesTab");

	App.Views.Chart.SourcesTab = owid.View.extend( {
		el: "#chart-view",
		events: {},

		initialize: function(options) {
			this.parentView = options.parentView;
			this.dispatcher = options.dispatcher;
			this.$tab = this.$el.find("#sources-chart-tab");
		},

		activate: function(callback) {
			this.render();


			this.listenTo(App.ChartModel, "change", function() {
				App.DataModel.ready(this.render.bind(this));
			}.bind(this));

			if (callback) callback();
		},

		deactivate: function() {
			this.cleanup();
			this.$tab.empty();
		},

		render: function() {
			var sources = App.DataModel.transformDataForSources(),
				tabHtml = "";

			_.each(sources, function(source) {
				tabHtml += source.description;
			});

			this.$tab.html(tabHtml);
		},
	});
})();