;(function() {	
	"use strict";
	owid.namespace("App.Views.Chart.Map.TimelineControls");
	var PlayPauseControl = App.Views.Chart.Map.PlayPauseControl,
		TimelineControl = App.Views.Chart.Map.TimelineControl,
		ButtonsControl = App.Views.Chart.Map.ButtonsControl;

	App.Views.Chart.Map.TimelineControls = owid.View.extend({
		el: "#map-chart-tab .map-timeline-controls",
		events: {},

		initialize: function(options) {
			this.dispatcher = options.dispatcher;

			this.playPauseControl = this.addChild(PlayPauseControl, options);
			this.timelineControl = this.addChild(TimelineControl, options);
			this.buttonsControl = this.addChild(ButtonsControl, options);

			this.listenTo(App.MapModel, "change", this.render.bind(this));			
		},

		render: function() {
			var timelineMode = App.MapModel.get("timelineMode"),
				minYear = App.MapModel.getMinYear(),
				maxYear = App.MapModel.getMaxYear();

			this.playPauseControl.render();
			this.timelineControl.render();
			this.buttonsControl.render();

			//depending on the mode used display timeline mode or buttons mode
			if (timelineMode === "buttons") {	
				this.playPauseControl.hide();
				this.timelineControl.hide();
				this.buttonsControl.show();
			} else {
				this.playPauseControl.show();
				this.timelineControl.show();
				this.buttonsControl.hide();
			}

			if (minYear == maxYear) {
				this.$el.addClass("single-year");
			} else {
				this.$el.removeClass("single-year");
			}
		},
	});
})();