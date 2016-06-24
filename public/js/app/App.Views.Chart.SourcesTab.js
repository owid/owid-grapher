;(function() {	
	"use strict";
	owid.namespace("App.Views.Chart.SourcesTab");

	App.Views.Chart.SourcesTab = Backbone.View.extend( {
		el: "#chart-view",
		events: {},

		initialize: function(options) {
			this.parentView = options.parentView;
			this.dispatcher = options.dispatcher;
			this.$tab = this.$el.find("#sources-chart-tab");
		},

		activate: function(callback) {
			this.render();

			App.ChartModel.on("change", function() {
				App.DataModel.ready(this.render.bind(this));								
			}.bind(this), this);

			if (callback) callback();
		},

		deactivate: function() {
			App.ChartModel.off(null, null, this);
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