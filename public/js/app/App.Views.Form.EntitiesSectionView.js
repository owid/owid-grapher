;(function() {	
	"use strict";
	owid.namespace("App.Views.Form.EntitiesSectionView");

	/**
	 * Responsible for the "Pick your countries" section in the editor
	 **/
	App.Views.Form.EntitiesSectionView = Backbone.View.extend({

		el: "#form-view #data-tab .entities-section",
		events: {
			"change .countries-select": "onCountriesSelect",
			"change [name='add-country-mode']": "onAddCountryModeChange"
		},

		initialize: function(options) {
			this.dispatcher = options.dispatcher;
			this.$entitiesSelect = this.$el.find(".countries-select");
			this.$addCountryControlInput = this.$el.find("[name='add-country-control']");
			App.DataModel.on("change:availableEntities", this.render.bind(this));
		},

		render: function() {
			// Fill the entity selector with default option and all the available entities
			this.$entitiesSelect.empty();
			this.$entitiesSelect.append("<option selected disabled>Select entity</option>");
			var availableEntities = App.DataModel.get("availableEntities");
			_.each(availableEntities, function(entity) {
				this.$entitiesSelect.append($("<option value='" + entity.id + "'>" + entity.name + "</option>"));
			}.bind(this));

			// Allow choosing whether or not the viewer can add their own countries
			var addCountryMode = App.ChartModel.get("add-country-mode");
			this.$el.find("[name='add-country-mode']").filter("[value='" + addCountryMode + "']").prop("checked", true);
		},

		onCountriesSelect: function(evt) {
			var selectedId = this.$entitiesSelect.val(),
				entity = App.DataModel.get("variableData").entityKey[selectedId];

			App.ChartModel.addSelectedCountry({ id: +selectedId, name: entity.name });
		},

		onAddCountryModeChange: function(evt) {
			var $input = $("[name='add-country-mode']:checked");
			App.ChartModel.set("add-country-mode", $input.val());
		}
	});
})();