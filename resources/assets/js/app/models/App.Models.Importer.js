;(function() {
	"use strict";

	var App = require("./../namespaces.js");
		
	// TODO (Mispy): I have renovated the uploading side of the importer in isolation
	// from ImportView itself, so there's probably some unneeded duplication here.
	App.Models.Importer = Backbone.Model.extend( {
		initialize: function (options) {
			this.dispatcher = options.dispatcher;
		},

		transformSingleVariableData: function(rows) {
			var years = [];
			var entities = [];
			var values = [];

			var yearSet = rows[0].slice(1);			
			_.each(rows.slice(1), function(row) {
				_.each(row.slice(1), function(cell, i) {
					if (!_.isEmpty(cell)) {
						years.push(yearSet[i]);
						entities.push(row[0]);
						values.push(cell);						
					}
				});				
			});

			return {
				years: years,
				entities: entities,
				values: [values]
			};
		},

		transformMultiVariableData: function(rows) {
			var years = [];
			var entities = [];
			var values = [];

			for (var i = 2; i < rows[0].length; i++) {
				values.push([]);
			}

			for (i = 1; i < rows.length; i++) {
				var row = rows[i];
				entities.push(row[0]);
				years.push(row[1]);
				for (var j = 0; j < values.length; j++) {
					values[j].push(row[2+j]);
				}
			}

			return {
				years: years,
				entities: entities,
				values: values
			};
		},

		uploadFormData: function($form, origUploadedData, isMultiVariant) {
			if (!$form || !$form.length) return;

			var importData;
			if (isMultiVariant)
				importData = this.transformMultiVariableData(origUploadedData.rows);
			else
				importData = this.transformSingleVariableData(origUploadedData.rows);

            var serializedArr = $form.serializeArray();
            var formData = {};
            _.each(serializedArr, function(v, i) {
            	if (v.name !== "variables[]") {
            		formData[v.name] = v.value;
            	} else {
            		if (!formData.variables)
            			formData.variables = [];
            		formData.variables.push(v.value);
            	}
            });

			var variables = [];
			_.each(formData.variables, function(variable, i) {
				variable = JSON.parse(variable);

				variables.push({
					name: variable.name,
					description: variable.description,
					unit: variable.unit,
					typeId: formData.variable_type,
					values: importData.values[i]
				});
			});

			var requestData = {
				dataset: {
					id: formData.existing_dataset_id,
					name: formData.new_dataset_name,	
					description: formData.new_dataset_description,
					categoryId: formData.category_id,
					subcategoryId: formData.subcategory_id
				},
				source: {
					name: formData.source_name,
					description: formData.source_description
				},
				years: importData.years,
				entities: importData.entities,
				variables: variables
			};

			$.ajaxSetup({
				headers: { 'X-CSRF-TOKEN': $('[name="_token"]').val() }
			});

			$.ajax(Global.rootUrl + "/import/variables", {
				data: JSON.stringify(requestData),
				contentType: 'application/json',
				type: 'POST'			
			}).done(function(result) {
				this.dispatcher.trigger("import-progress", "Imported everything", true, "1/1", true, result.datasetId);
			}.bind(this)).fail(function(xhr) {
				this.dispatcher.trigger("import-progress", 'Error: "' + xhr.responseJSON + '"', false, "0/1");
			}.bind(this));
		},
	});

	module.exports = App.Models.Importer;

})();