;(function() {	
	"use strict";
	owid.namespace("App.Views.Import.ChooseDatasetSection");

	App.Views.Import.ChooseDatasetSection = owid.View.extend({
		el: ".dataset-section",

		events: {
			"change [name=existing_dataset_id]": "onDatasetChange",
			"input [name=dataset_name]": "onNameChange",
			"input [name=dataset_description]": "onDescriptionChange"
		},

		initialize: function() {
			this.$datasetSelect = this.$("[name=existing_dataset_id]");
			this.$datasetName = this.$("[name=dataset_name]");
			this.$datasetDescription = this.$("[name=dataset_description]");
			this.listenTo(App.DatasetModel, "change:id change:name change:description", this.render.bind(this));
		},

		render: function() {
			var id = App.DatasetModel.get("id"),
				name = App.DatasetModel.get("name"),
				description = App.DatasetModel.get("description");

			this.$datasetSelect.val(id);
			this.$datasetName.val(name);
			this.$datasetDescription.val(description);
		},

		onDatasetChange: function() {
			App.DatasetModel.set("id", this.$datasetSelect.val() || null);
		},

		onNameChange: function() {
			App.DatasetModel.set("name", this.$datasetName.val());
		},

		onDescriptionChange: function() {
			App.DatasetModel.set("description", this.$datasetDescription.val());
		}
	});
})();