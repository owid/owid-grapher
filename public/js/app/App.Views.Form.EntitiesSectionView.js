;(function() {	
	"use strict";
	owid.namespace("App.Views.Form.EntitiesSectionView");

	var ColorPicker = App.Views.UI.ColorPicker;

	/**
	 * Responsible for the "Pick your countries" section in the editor
	 **/
	App.Views.Form.EntitiesSectionView = owid.View.extend({
		el: "#form-view #data-tab .entities-section",
		events: {
			"change .countries-select": "onCountriesSelect",
			"change [name='add-country-mode']": "onAddCountryModeChange",			
			"click .country-label .fa-remove": "onRemoveEntity",
			"click .country-label": "onEntityColorpicker"
		},

		initialize: function(options) {
			this.dispatcher = options.dispatcher;
			this.$currentEntities = this.$el.find(".selected-countries-box");
			this.$entitiesSelect = this.$el.find(".countries-select");
			this.$addCountryControlInput = this.$el.find("[name='add-country-control']");
			this.listenTo(App.DataModel, "change:availableEntities", this.render.bind(this));
			this.listenTo(App.ChartModel, "change:selected-countries", this.render.bind(this));
			this.render();
		},

		render: function() {
			var availableEntities = App.DataModel.get("availableEntities"),
				selectedEntities = App.ChartModel.get("selected-countries"),
				selectedEntitiesById = App.ChartModel.getSelectedEntitiesById();

			// Show all the entities that are already selected
			this.$currentEntities.empty();
			_.each(selectedEntities, function(entity) {
				var $li = $("<li class='country-label'><span class='fa fa-remove'></span>" + entity.name + "</li>");
				$li.attr("data-id", entity.id);
				$li.attr("data-name", entity.name);
				if (entity.color) {
					$li.css("background-color", entity.color);
					$li.attr("data-color", entity.color);
				}
				this.$currentEntities.append($li);
			}.bind(this));

			// Fill the entity selector with default option and the available non-selected entities
			this.$entitiesSelect.empty();
			this.$entitiesSelect.append("<option selected disabled>Select entity</option>");
			_.each(availableEntities, function(entity) {
				if (!selectedEntitiesById[entity.id])
					this.$entitiesSelect.append($("<option value='" + entity.id + "'>" + entity.name + "</option>"));
			}.bind(this));

			// Allow choosing whether or not the viewer can add their own countries
			var addCountryMode = App.ChartModel.get("add-country-mode");
			this.$el.find("[name='add-country-mode']").filter("[value='" + addCountryMode + "']").prop("checked", true);
		},

		onRemoveEntity: function(evt) {
			var $li = $(evt.target).closest(".country-label");
			App.ChartModel.removeSelectedCountry($li.attr("data-name"));
		},

		onEntityColorpicker: function(evt) {
			var $li = $(evt.target).closest(".country-label");
			if (this.colorPicker) this.colorPicker.onClose();
			this.colorPicker = new ColorPicker({ target: $li, currentColor: $li.attr("data-color") });
			this.colorPicker.onSelected = function(value) {
				$li.css("background-color", value);
				$li.attr("data-color", value);
				App.ChartModel.updateSelectedCountry($li.attr("data-id"), value);
			};
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