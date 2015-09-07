;( function() {
		
	"use strict";

	App.Models.Importer = Backbone.Model.extend( {

	
		initialize: function ( options ) {

			this.dispatcher = options.dispatcher;

		},

		uploadFormData: function( $form ) {

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

			this.set( "formData", formData );
			
			try {
				
				//start import
				this.startImport();
			
			} catch( err ) {

				console.error( "Error uploading data", err, this );
				
			}

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
					that.set( "inputFileId", resp.data.inputFileId );
					that.createDatasource();
					that.dispatcher.trigger( "import-progress", "Created input file", true );
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
					that.set( "datasourceId", resp.data.datasourceId );
					that.createDataset();
					that.dispatcher.trigger( "import-progress", "Created datasource", true );
				} else {
					that.dispatcher.trigger( "import-progress", "Error creating datasource", false );
				}

			} );
		},

		createDataset: function() {
			//create dataset
			var that = this,
				formData = this.get( "formData" ),
				datasetData = { "name": formData.new_dataset_name, "datasetTags": formData.new_dataset_tags, "description": formData.new_dataset_description, "categoryId": formData.category_id, "subcategoryId": formData.subcategory_id, "datasourceId": this.get( "datasourceId" ) },
				datasetModel = new App.Models.Import.DatasetModel( datasetData );
			
			datasetModel.import();
			datasetModel.on( "sync", function( model, resp ) {
				
				if( resp && resp.success ) {
					that.set( "datasetId", resp.data.datasetId );
					that.createVariables();
					that.dispatcher.trigger( "import-progress", "Created dataset", true );
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

				console.log( "next", len, curr );
				if( curr < len ) {

					var variableDataString = variables[ curr ],
						variableData = $.parseJSON( variableDataString );
					that.createVariable( variableData, next );
					curr++;

				} else {

					that.dispatcher.trigger( "import-progress", "Finish creating variables", true, true, that.get( "datasetId" ) );

				}

			};

			next();

		},

		createVariable: function( variableData, callback ) {

			if( variableData && variableData.values ) {

				var formData = this.get( "formData" );
				variableData.variableType = formData.variable_type.value;
				variableData.datasetId = this.get( "datasetId" );
				variableData.datasourceId = this.get( "datasourceId" );

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

				if( curr < len-1 ) {

					that.createEntity( values[ curr ], variableId, next );
					curr++;

				} else {

					that.dispatcher.trigger( "import-progress", "Finish creating entities", true );

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
			entityData.entityCheck = false;
			entityData.inputFileId = this.get( "inputFileId" );
			entityData.datasourceId = this.get( "datasourceId" );
			entityData.variableId = variableId;

			var entityModel = new App.Models.Import.EntityModel( entityData );
			entityModel.import();
			entityModel.on( "sync", function( model, resp ) {
				console.log( "finish creating entity" );
				that.dispatcher.trigger( "import-progress", "Created entity: " + entityData.name, true );
				if( callback ) {
					callback();
				}
			} );
			entityModel.on( "error", function( model, resp ) {
				that.dispatcher.trigger( "import-progress", "Error creating entity", false );
			} );

		}
			
	} );

})();