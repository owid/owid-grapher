;(function() {
	"use strict";
	owid.namespace("App.Views.UI.SelectVarPopup");

	App.Views.UI.SelectVarPopup = owid.View.extend({
		events: {
			"click .close": "onCloseBtn",
			"click .btn-primary": "onSaveBtn",
			"click .btn-default": "onCancelBtn"
		},

		initialize: function(options) {
			this.$el = $(".select-var-popup");
			this.$chartVariable = this.$el.find("[name=chart-variable]");
			this.$el.find(".chosen-select").chosen();			
		},

		show: function() {
			this.$el.show();
		},

		hide: function() {
			this.$el.hide();
		},

		onCloseBtn: function(evt) {
			this.hide();
		},

		onSaveBtn: function(evt) {
			if (this.$chartVariable.val() <= 0) return;

			var varId = this.$chartVariable.val(),
				varUnit = this.$chartVariable.find( "option:selected" ).attr( "data-unit" ),
				varName = this.$chartVariable.find( "option:selected" ).text(),
				variable = new App.Models.ChartVariableModel({ id: varId, name: varName, unit: varUnit });

			App.ChartVariablesCollection.add(variable);
			this.hide();
		},

		onCancelBtn: function(evt) {
			this.hide();
		},
	});
})();
