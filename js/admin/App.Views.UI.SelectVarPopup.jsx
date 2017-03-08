import $ from 'jquery'

;(function() {
	"use strict";
	owid.namespace("App.Views.UI.SelectVarPopup");

	App.Views.UI.SelectVarPopup = owid.View.extend({
		events: {
			"click .close": "onCloseBtn",
			"click .btn-primary": "onSaveBtn",
			"click .btn-default": "onCancelBtn",
			"change [name=database]": "onChangeDatabase"
		},

		initialize: function(options) {
			this.$el = $(".select-var-popup");
			this.$databaseSelect = this.$el.find("[name=database]");
			this.$variableSelect = this.$el.find("[name=chart-variable]");
			this.$origVariableSelect = this.$variableSelect.clone();
			this.$el.find(".chosen-select").chosen();
			this.onChangeDatabase();
		},

		onChangeDatabase: function() {
			var namespace = this.$databaseSelect.val();
			this.$variableSelect.html(this.$origVariableSelect.html());
			this.$variableSelect.find('option').not('[data-namespace=' + namespace + ']').remove();
			this.$variableSelect.trigger("chosen:updated");
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
			if (this.$variableSelect.val() <= 0) return;

			var variable = {
				variableId: this.$variableSelect.val(),
				variableName: this.$variableSelect.find("option:selected").text(),
				unit: this.$variableSelect.find("option:selected").attr("data-unit")
			};

			this.trigger("new-variable", variable);
			this.hide();
		},

		onCancelBtn: function(evt) {
			this.hide();
		},
	});
})();
