;(function() {	
	"use strict";
	owid.namespace("App.Views.Import.VariablesSection");

	var SourceSelector = require("App.Views.Import.SourceSelector");

	App.Views.Import.VariablesSection = owid.View.extend({
		el: ".variables-section",
		initialize: function() {
			this.listenTo(App.DatasetModel, "change:newVariables change:oldVariables", this.render.bind(this));
			this.$variableList = this.$("ol");
			this.$validation = this.$(".variable-validation");
			this.$affectedCharts = this.$(".affected-charts");
			this.sourceSelector = this.addChild(SourceSelector);
		},

		render: function() {
			var newVariables = App.DatasetModel.get("newVariables");

			this.$variableList.empty();
			_.each(newVariables, function(variable) {
				this.addVariable(variable);
			}.bind(this));

			this.updateAffectedCharts();
		},

		addVariable: function(variable) {
			var oldVariables = App.DatasetModel.get("oldVariables");

			variable.name = variable.name || '';
			variable.unit = variable.unit || '';
			variable.description = variable.description || '';
			variable.coverage = variable.coverage || '';
			variable.timespan = variable.timespan || '';

			var $li = $(
				'<li class="variable-item clearfix">' +
					'<label>Name<input name="name" class="form-control" value="' + variable.name + '" placeholder="Enter variable name"/></label>' +
					'<label>Unit<input name="unit" class="form-control" value="' + variable.unit + '" placeholder="e.g. % or $"/></label>' +
					'<label>Geographic Coverage<input name="coverage" class="form-control" value="' + variable.coverage + '" placeholder="e.g. Global by country"/></label>' +
					'<label>Time Span<input name="description" class="form-control" value="' + variable.timespan + '" placeholder="e.g. 1920-1990"/></label>' +
					'<label>Source<input name="source" type="button" value="' + (variable.source ? variable.source.name : 'Add source') + '" /></label>' +
					'<label>Action<select class="action"></action></label>' +
				'</li>'
			);

			var $inputName = $li.find("[name=name]"),
				$inputUnit = $li.find("[name=unit]"),
				$inputDescription = $li.find("[name=description]"),
				$inputSource = $li.find("[name=source]"),
				$selectAction = $li.find(".action"),
				$inputs = $li.find("input, select");

			// Dropdown to allow overwriting any old variable with the new one
			$selectAction.prepend('<option class="create-new" value="">Create new variable</option>');
			_.each(oldVariables, function(old) {
				$selectAction.append('<option value="' + old.id + '">Overwrite ' + old.name + '</option>');
			});
			$selectAction.find('option[value=' + variable.overwriteId + ']').prop('selected', true);

			// Editing of variable source
			$inputSource.on("click", function() {
				this.sourceSelector.show(variable);
			}.bind(this));

			var update = function() {
				variable.name = $inputName.val();
				variable.unit = $inputUnit.val();
				variable.description = $inputDescription.val();

				var existing = _.findWhere(oldVariables, { name: variable.name });
				if (existing) {
					$selectAction.val(existing.id);
				}
				variable.overwriteId = $selectAction.val() || null;


				this.updateAffectedCharts();
				this.validate();
			}.bind(this);

			update();
			$inputs.on("input, change", update);

			$inputs.on("focus", function() {
				//set flag so that values in input won't get overwritten by changes to dataset name
				this.variableNameManual = true;
			}.bind(this));

			this.$variableList.append($li);
		},

		// Ensure the import operation we're about to perform actually makes sense
		validate: function() {
			this.$validation.empty();

			var newVariables = App.DatasetModel.get("newVariables"),
				oldVariables = App.DatasetModel.get("oldVariables");

			var missingName = false, missingSource = false, nameConflict = false, overwriteConflict = false, existingNameConflict = false;

			var names = {}, overwrites = {}, existingNames = _.indexBy(oldVariables, 'name');			
			_.each(newVariables, function(variable) {
				if (!variable.name) missingName = true;
				if (!variable.source) missingSource = true;
				if (names[variable.name]) nameConflict = true;
				if (existingNames[variable.name] && existingNames[variable.name].id != variable.overwriteId) existingNameConflict = true;
				names[variable.name] = true;

				if (variable.overwriteId) {
					if (overwrites[variable.overwriteId]) overwriteConflict = true;
					overwrites[variable.overwriteId] = true;
				}

			});

			if (missingName)
				this.$validation.append('<p class="variable-validation-result text-danger"><i class="fa fa-exclamation-circle">All variables must have names.</p>');
			else if (missingSource)
				this.$validation.append('<p class="variable-validation-result text-danger"><i class="fa fa-exclamation-circle">All variables must have an assigned source.</p>');
			else if (nameConflict)
				this.$validation.append('<p class="variable-validation-result text-danger"><i class="fa fa-exclamation-circle">Cannot have two variables with the same name.</p>');
			else if (existingNameConflict)
				this.$validation.append('<p class="variable-validation-result text-danger"><i class="fa fa-exclamation-circle">Cannot create new variable with same name as an existing one. Perhaps overwrite instead.</p>');
			else if (overwriteConflict)
				this.$validation.append('<p class="variable-validation-result text-danger"><i class="fa fa-exclamation-circle">Cannot overwrite the same variable twice.</p>');
		},

		updateAffectedCharts: function() {
			var newVariables = App.DatasetModel.get("newVariables"),
				oldVariables = App.DatasetModel.get("oldVariables"),
				charts = [];

			_.each(newVariables, function(variable) {
				var old = _.findWhere(oldVariables, { id: +variable.overwriteId });
				if (old && old.charts)
					charts = charts.concat(old.charts);
			});
			charts = _.uniq(charts, function(chart) { return chart.id; });
			if (_.isEmpty(charts)) {
				this.$affectedCharts.empty();
				return;
			}

			var html = '<h4>These charts will be updated</h4><ul>';
			_.each(charts, function(chart, i) {
				html += '<li><a href="' + Global.rootUrl + '/charts/' + chart.id + '/edit">' + chart.name + '</a></li>';
			});
			html += "</ul>";

			this.$affectedCharts.html(html);
		}
	});
})();