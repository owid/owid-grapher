;( function() {
		
	"use strict";

	App.Models.Importer = Backbone.Model.extend( {

		numSteps: 0,
		nowStep: 0,
		nowVariableName: "",

		initialize: function ( options ) {

			this.dispatcher = options.dispatcher;

		},

		uploadFormData: function( $form, origUploadedData ) {

			if( !$form || !$form.length ) {
				return false;
			}

			$.ajaxSetup( {
				headers: { 'X-CSRF-TOKEN': $('[name="_token"]').val() }
			} );

			//serialized 
			var serializedArr = $form.serializeArray();
			var formData = {};
			$.each( serializedArr, function( i, v ) {
				if( v.name !== "variables[]" ) {
					//simple case, straight forward copying
					formData[ v.name ] = v.value;
				} else {
					if( !formData[ "variables" ] ) {
						formData[ "variables" ] = [];
					}
					formData[ "variables" ].push( v.value );
				}
			} );

			var entityCheck = ( formData[ "validate_entities" ] == "on" )? false: true;

			this.set( "entityCheck", entityCheck );
			this.set( "formData", formData );
			
			//store number of steps needed
			this.numSteps = this.getNumberOfSteps( formData );//( origUploadedData && origUploadedData.rows && origUploadedData.rows.length)? origUploadedData.rows.length : 0;
			//add extra steps
			this.numSteps += 3;

			try {
				
				//start import
				this.startImport();
			
			} catch( err ) {

				console.error( "Error uploading data", err, this );
				
			}

		},

		getNumberOfSteps: function( formData ) {
			var numSteps = 0;
			if( formData && formData.variables ) {
				_.each( formData.variables, function( v, i ) {
					numSteps++;
					var varData = $.parseJSON( v )
					if( varData && varData.values ) {
						console.log( "varData", varData, varData.values );
						numSteps += varData.values.length;
					}
				} );
			}
			return numSteps;

		},

		startImport: function() {
			this.createInputFile();
		},

		createInputFile: function() {

			//create import
			var that = this,
				formData = this.get( "formData" ),
				userId = formData.user_id,
				stringifiedVarData = JSON.stringify( formData["variables[]"] ),
				inputFileData = { "rawData": JSON.stringify( stringifiedVarData ), "userId": userId },
				inputFileModel = new App.Models.Import.InputFileModel( inputFileData );
			
			inputFileModel.import();
			inputFileModel.on( "sync", function( model, resp ) {
				
				if( resp && resp.success ) {
					that.nowStep++;
					that.set( "inputFileId", resp.data.inputFileId );
					that.createDatasource();
					that.dispatcher.trigger( "import-progress", "Created input file", true, that.nowStep + "/" + that.numSteps );
				} else {
					that.dispatcher.trigger( "import-progress", "Error creating input file", false );
				}

			} );

		},

		createDatasource: function() {
			//create datasource
			var that = this,
				formData = this.get( "formData" ),
				datasourceData = { "name": formData.source_name, "link": "", "description": formData.source_description },
				datasourceModel = new App.Models.Import.DatasourceModel( datasourceData );
			
			datasourceModel.import();
			datasourceModel.on( "sync", function( model, resp ) {
				
				if( resp && resp.success ) {
					that.nowStep++;
					that.set( "datasourceId", resp.data.datasourceId );
					that.createDataset();
					that.dispatcher.trigger( "import-progress", "Created datasource", true, that.nowStep + "/" + that.numSteps );
				} else {
					that.dispatcher.trigger( "import-progress", "Error creating datasource", false );
				}

			} );
		},

		createDataset: function() {
			//create dataset
			var that = this,
				formData = this.get( "formData" ),
				datasetData = { "name": formData.new_dataset_name, "datasetTags": formData.new_dataset_tags, "description": formData.new_dataset_description, "categoryId": formData.category_id, "subcategoryId": formData.subcategory_id, "datasourceId": this.get( "datasourceId" ),
				"new_dataset": formData.new_dataset, "existing_dataset_id": formData.existing_dataset_id },
				datasetModel = new App.Models.Import.DatasetModel( datasetData );
			
			datasetModel.import();
			datasetModel.on( "sync", function( model, resp ) {
				
				if( resp && resp.success ) {
					that.nowStep++;
					that.set( "datasetId", resp.data.datasetId );
					that.createVariables();
					that.dispatcher.trigger( "import-progress", "Created dataset", true, that.nowStep + "/" + that.numSteps );
				} else {
					that.dispatcher.trigger( "import-progress", "Error creating dataset", false );
				}
			
			} );
		},

		createVariables: function() {

			var that = this,
				formData = this.get( "formData" ),
				variables = formData.variables,
				len = variables.length,
				curr = 0;

			/*$.each( variables, function( i, variableDataString ) {

				var variableData = $.parseJSON( variableDataString );
				that.createVariable( variableData );

			} );*/

			var next = function() {

				if( curr < len ) {

					var variableDataString = variables[ curr ],
						variableData = $.parseJSON( variableDataString );
					that.createVariable( variableData, next );
					curr++;

				} else {

					that.dispatcher.trigger( "import-progress", "Finish creating variables", true, that.nowStep + "/" + that.numSteps, true, that.get( "datasetId" ) );

				}

			};

			next();

		},

		createVariable: function( variableData, callback ) {

			if( variableData && variableData.values ) {

				var formData = this.get( "formData" );
				
				//transform variable id
				variableData.varId = variableData.id;

				variableData.variableType = formData.variable_type.value;
				variableData.datasetId = this.get( "datasetId" );
				variableData.datasourceId = this.get( "datasourceId" );

				//store variable name
				this.nowVariableName = variableData.name;

				var that = this,
					variableModel = new App.Models.Import.VariableModel( variableData );
				
				variableModel.import();
				variableModel.on( "sync", function( model, resp ) {
			
					if( resp && resp.success ) {
						var variableId = resp.data.variableId;
						that.createEntities( variableData.values, variableId, callback );
						that.dispatcher.trigger( "import-progress", "Created variable: " + variableData.name, true );
					} else {
						that.dispatcher.trigger( "import-progress", "Error creating variable", false );
					}
				
				} );

			}
			
		},

		createEntities: function( values, variableId, callback ) {

			var that = this,
				len = values.length,
				curr = 0;

			var next = function() {

				if( curr < len ) {

					that.createEntity( values[ curr ], variableId, next );
					curr++;

				} else {

					that.nowStep++;
					that.dispatcher.trigger( "import-progress", "Finish creating entities", true, that.nowStep + "/" + that.numSteps );

					if( callback ) {
						callback();
					}

				}

			};

			next();

		},

		createEntity: function( entityData, variableId, callback ) {

			var that = this;

			//insert all values that are necessary
			entityData.name = entityData.key;
			entityData.entityCheck = this.get( "entityCheck" );
			entityData.inputFileId = this.get( "inputFileId" );
			entityData.datasourceId = this.get( "datasourceId" );
			entityData.variableId = variableId;

			var entityModel = new App.Models.Import.EntityModel( entityData );
			entityModel.import();
			entityModel.on( "sync", function( model, resp ) {
				that.nowStep++;
				that.dispatcher.trigger( "import-progress", "Importing " + that.nowVariableName + " for " + entityData.name, true, that.nowStep + "/" + that.numSteps );
				if( callback ) {
					callback();
				}
			} );
			entityModel.on( "error", function( model, resp ) {
				that.dispatcher.trigger( "import-progress", "Error creating entity", false );
			} );

		}
			
	} );

	module.exports = App.Models.Importer;

})();