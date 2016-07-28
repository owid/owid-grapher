;(function() {	
	"use strict";
	owid.namespace("App.Views.Import.VariablesSection");

	var SourceSelector = require("App.Views.Import.SourceSelector");

	App.Views.Import.VariablesSection = owid.View.extend({
		el: ".variables-section",
		initialize: function() {
			this.listenTo(App.DatasetModel, "change:newVariables change:oldVariables", this.render.bind(this));
			this.$variableList = this.$("ol");
		},

		render: function() {
			var newVariables = App.DatasetModel.get("newVariables");

			this.$variableList.empty();

			_.each(newVariables, function(v, i) {					
				var $li = this.createVariableEl(v);
				this.$variableList.append($li);				
			}.bind(this));
		},

		createVariableEl: function(data) {
			var oldVariables = App.DatasetModel.get("oldVariables");

			data.name = data.name || '';
			data.unit = data.unit || '';
			data.description = data.description || '';

			var $li = $(
				'<li class="variable-item clearfix">' +
					'<label>Name<input name="name" class="form-control" value="' + data.name + '" placeholder="Enter variable name"/></label>' +
					'<label>Unit<input name="unit" class="form-control" value="' + data.unit + '" placeholder="Enter variable unit"/></label>' +
					'<label>Description<input name="description" class="form-control" value="' + data.description + '" placeholder="Enter variable description"/></label>' +
					'<input name="source" type="button" value="Add source" />' +
				'</li>'
			);

			var $inputName = $li.find("[name=name]"),
				$inputUnit = $li.find("[name=unit]"),
				$inputDescription = $li.find("[name=description]"),
				$inputSource = $li.find("[name=source]"),
				$inputs = $li.find("input");

			$inputSource.on("click", function() {
				var selector = new SourceSelector($li);
			});

			function checkExisting() {
				var existing = _.findWhere(oldVariables, { name: data.name });
				if (existing) {
				} else {
				}
			}

			checkExisting();
			$inputs.on("input, change", function() {
				data.name = $inputName.val();
				data.unit = $inputUnit.val();
				data.description = $inputDescription.val();				
				checkExisting();
			});

			$inputs.on("focus", function() {
				//set flag so that values in input won't get overwritten by changes to dataset name
				this.variableNameManual = true;
			}.bind(this));

			return $li;
		},
	});
})();