;(function() {	
	"use strict";

	owid.namespace("App.Views.Chart.Map.MapControls");

	App.Views.Chart.Map.MapControls = owid.View.extend({
		el: "#map-chart-tab .map-controls-header",
		events: {
			"click .region-control li": "onRegionClick",
			"click .settings-control input": "onSettingsInput",
			"click .color-blind-control": "onColorBlindClick",
		},

		initialize: function( options ) {
			this.dispatcher = options.dispatcher;
			
			//year slider
			this.$targetYearControl = this.$el.find( ".target-year-control" );
			this.$targetYearLabel = this.$targetYearControl.find( ".target-year-label" );
			this.$targetYearInput = this.$targetYearControl.find( "input" );
			
			//region selector
			this.$regionControl = this.$el.find( ".region-control" );
			this.$regionControlLabel = this.$regionControl.find( ".region-label" );
			this.$regionControlLis = this.$regionControl.find( "li" );

			//settings-control selector
			this.$settingsControl = this.$el.find( ".settings-control" );

			//color blind control selector
			this.$colorBlindControl = this.$el.find( ".color-blind-control" );
			//cache original
			this.originalColorSchemeName = App.MapModel.get("colorSchemeName");

			this.listenTo(App.MapModel, "change:projection change:mode change:isColorblind", this.render.bind(this));

			return this.render();
		},

		render: function() {
			var mode = App.MapModel.get("mode"),
				projection = App.MapModel.get("projection"),
				isColorblind = App.MapModel.get("isColorblind");

			this.$regionControlLabel.text( projection );

			this.$regionControlLis.removeClass( "highlight" );
			this.$regionControlLis.filter( "." + projection + "-projection" ).addClass( "highlight" );

			this.$settingsControl.find("input").prop("checked", mode !== "no-interpolation");
			this.$colorBlindControl.toggleClass("active", !!isColorblind);
		},

		onRegionClick: function(evt) {
			App.MapModel.set("projection", $(evt.target).text());
		},

		onSettingsInput: function(evt) {
			var $this = $(evt.target),
				currentMode = App.MapModel.get("mode"),
				mode = currentMode === "no-interpolation" ? "specific" : "no-interpolation";
			App.MapModel.set("mode", mode);
		},

		onColorBlindClick: function(evt) {
			var $this = $(evt.currentTarget);
			if (!$this.hasClass("active")) {
				App.MapModel.set("isColorblind", true);
			} else {
				App.MapModel.set("isColorblind", false);
			}
		},

	});
})();