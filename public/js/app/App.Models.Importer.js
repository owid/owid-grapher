;(function() {
	"use strict";
	owid.namespace("App.Models.Importer");
		
	function indexEntity(entityName, entityKey) {
		var index = entityKey.indexOf(entityName);
		if (index != -1)
			return index;

		entityKey.push(entityName);
		return entityKey.length-1;
	}

	// TODO (Mispy): I have renovated the uploading side of the importer in isolation
	// from ImportView itself, so there's probably some unneeded duplication here.
	App.Models.Importer = Backbone.Model.extend( {
		initialize: function (options) {
			this.dispatcher = options.dispatcher;
		},

		transformSingleVariableData: function(rows) {
			var entityKey = [];
			var years = [];
			var entities = [];
			var values = [];

			var yearSet = _.map(rows[0].slice(1), function(cell) { return parseInt(cell); });			
			_.each(rows.slice(1), function(row) {
				var entityIndex = indexEntity(row[0], entityKey);

				_.each(row.slice(1), function(cell, i) {
					if (!_.isEmpty(cell)) {
						years.push(yearSet[i]);
						entities.push(entityIndex);
						values.push(owid.tryParseFloat(cell));
					}
				});				
			});

			return {
				entityKey: entityKey,
				years: years,
				entities: entities,
				values: [values]
			};
		},

		transformMultiVariableData: function(rows) {
			var entityKey = [];
			var years = [];
			var entities = [];
			var values = [];

			for (var i = 2; i < rows[0].length; i++) {
				values.push([]);
			}

			for (i = 1; i < rows.length; i++) {
				var row = rows[i];
				entities.push(indexEntity(row[0], entityKey));
				years.push(parseInt(row[1]));
				for (var j = 0; j < values.length; j++) {
					values[j].push(owid.tryParseFloat(row[2+j]));
				}
			}

			return {
				entityKey: entityKey,
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
            		// Don't set existing dataset id if it's not actually the selected option
            		if (v.name == "existing_dataset_id" && !$("[name=existing_dataset_id]").is(":visible"))
	            		return;

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
				entityKey: importData.entityKey,
				years: importData.years,
				entities: importData.entities,
				variables: variables
			};

			setTimeout(function() {
				this.dispatcher.trigger("import-progress", "Preparing import for " + variables.length*importData.years.length + " values", true, "1/2");
			}.bind(this), 100);

			$.ajax(Global.rootUrl + "/import/variables", {
				data: JSON.stringify(requestData),
				contentType: 'application/json',
				type: 'POST'			
			}).done(function(result) {
				this.dispatcher.trigger("import-progress", "Importing everything", true, "2/2", true, result.datasetId);
			}.bind(this)).fail(function(xhr) {
				this.dispatcher.trigger("import-progress", 'Error: "' + JSON.stringify(xhr.responseJSON) + '"', false, "1/2");
			}.bind(this));
		},
	});
})();