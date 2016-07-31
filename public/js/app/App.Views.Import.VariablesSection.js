;(function() {	
	"use strict";
	owid.namespace("App.Views.Import.VariablesSection");

	var SourceSelector = require("App.Views.Import.SourceSelector");

	App.Views.Import.VariablesSection = owid.View.extend({
		el: ".variables-section",
		initialize: function() {
			this.listenTo(App.DatasetModel, "change:newVariables change:oldVariables", this.render.bind(this));
			this.$variableList = this.$("ol");
			this.sourceSelector = this.addChild(SourceSelector);
		},

		render: function() {
			var newVariables = App.DatasetModel.get("newVariables");

			this.$variableList.empty();

			_.each(newVariables, function(variable) {					
				var $li = this.createVariableEl(variable);
				this.$variableList.append($li);				
			}.bind(this));
		},

		createVariableEl: function(data) {
			var oldVariables = App.DatasetModel.get("oldVariables");

			data.name = data.name || '';
			data.unit = data.unit || '';
			data.description = data.description || '';
			data.coverage = data.coverage || '';
			data.timespan = data.timespan || '';

			var $li = $(
				'<li class="variable-item clearfix">' +
					'<label>Name<input name="name" class="form-control" value="' + data.name + '" placeholder="Enter variable name"/></label>' +
					'<label>Unit<input name="unit" class="form-control" value="' + data.unit + '" placeholder="e.g. % or $"/></label>' +
					'<label>Geographic Coverage<input name="coverage" class="form-control" value="' + data.coverage + '" placeholder="e.g. Global by country"/></label>' +
					'<label>Time Span<input name="description" class="form-control" value="' + data.timespan + '" placeholder="e.g. 1920-1990"/></label>' +
					'<label>Source<input name="source" type="button" value="' + (data.source ? data.source.name : 'Add source') + '" /></label>' +
					'<label>Action<span class="status"></span></label>' +
				'</li>'
			);

			var $inputName = $li.find("[name=name]"),
				$inputUnit = $li.find("[name=unit]"),
				$inputDescription = $li.find("[name=description]"),
				$inputSource = $li.find("[name=source]"),
				$inputs = $li.find("input"),
				$status = $li.find(".status");

			$inputSource.on("click", function() {
				this.sourceSelector.show(data);
			}.bind(this));

			function update() {
				data.name = $inputName.val();
				data.unit = $inputUnit.val();
				data.description = $inputDescription.val();				

				var existing = _.findWhere(oldVariables, { name: data.name });
				if (existing) {
					$status.removeClass("new");
					$status.addClass("existing");
					$status.text("Overwrite existing variable");
				} else {
					$status.removeClass("existing");
					$status.addClass("new");
					$status.text("Create new variable");
				}
			}

			update();
			$inputs.on("input, change", update);
			$inputName.on("keydown", function() {
				setTimeout(update, 100);
			});

			$inputs.on("focus", function() {
				//set flag so that values in input won't get overwritten by changes to dataset name
				this.variableNameManual = true;
			}.bind(this));

			return $li;
		},
	});
})();