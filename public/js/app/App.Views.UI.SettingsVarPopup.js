;(function() {
	"use strict";
	owid.namespace("App.Views.UI.SettingsVarPopup");

	App.Views.UI.SettingsVarPopup = owid.View.extend({
		init: function(options) {
			this.dispatcher = options.dispatcher;

			//will be filled when opening popup
			this.variableId = -1;

			this.$el = $(".settings-var-popup");
			this.$closeBtn = this.$el.find(".close");
			this.$saveBtn = this.$el.find(".btn-primary");
			this.$cancelBtn = this.$el.find(".btn-default");

			this.$nameInput = this.$el.find(".settings-var-name input");
			this.$advancedSettings = this.$el.find(".advanced-settings");
			this.$digitInputs = this.$el.find(".digit-input");

			this.$closeBtn.on("click", $.proxy(this.onCloseBtn, this));
			this.$el.find("form").on("submit", $.proxy(this.onSaveBtn, this));
			this.$saveBtn.on("click", $.proxy(this.onSaveBtn, this));
			this.$cancelBtn.on("click", $.proxy(this.onCancelBtn, this));
		},

		show: function($variableLabel) {
			this.variableId = $variableLabel.attr("data-variable-id");
			
			//repopulate from element
			var name = $variableLabel.attr("data-display-name"),
				targetYear = $variableLabel.attr("data-target-year"),
				tolerance = $variableLabel.attr("data-tolerance");

			var chartType = App.ChartModel.get("chart-type");
			if (chartType == App.ChartType.ScatterPlot) {
				this.$advancedSettings.show();
			} else {
				this.$advancedSettings.hide();
			}

			this.$nameInput.val(name);
//			this.$el.find("[name=single-year]").val(targetYear);
			this.$el.find("[name=tolerance]").val(tolerance);

			this.$el.show();
		},

		hide: function() {
			this.$el.hide();
		},

		onCloseBtn: function( evt) {
			evt.preventDefault();
			this.hide();
		},

		onSaveBtn: function(evt) {
			evt.preventDefault();
			var data = { variableId: this.variableId };
			data["display-name"] = this.$nameInput.val();

			//data[ "target-year" ] = this.$el.find("[name=single-year]").val();
			data.tolerance = parseFloat(this.$el.find("[name=tolerance]").val());
			this.trigger("variable-settings", data);
		},

		onCancelBtn: function(evt) {
			evt.preventDefault();
			this.hide();
		}
	});
})();
