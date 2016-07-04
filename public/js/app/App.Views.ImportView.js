;(function() {	
	"use strict";
	owid.namespace("App.Views.ImportView");

	var papaparse = require("Papa"),
		moment = require("moment"),
		Importer = require("App.Models.Importer"),
		ImportProgressPopup = require("App.Views.UI.ImportProgressPopup"),
		Utils = require("App.Utils");

	App.Views.ImportView = owid.View.extend({
		datasetName: "",
		isDataMultiVariant: false,
		origUploadedData: false,
		uploadedData: false,
		variableNameManual: false,
		sourceNameManual: false,
		// Info for existing variables is retrieved if the user selects an existing dataset
		existingVariables: [],
		// New variables extracted from the CSV
		newVariables: [],

		el: "#import-view",
		events: {
			"submit form": "onFormSubmit",
			"click .clear-settings-btn": "onClearSettings",
			"input [name=new_dataset_name]": "onNewDatasetNameChange",
			"change [name=new_dataset]": "onNewDatasetChange",
			"change [type=file]": "onFileChange",
			"click .remove-uploaded-file-btn": "onRemoveUploadedFile",
			"change [name=category_id]": "onCategoryChange",
			"change [name=existing_dataset_id]": "onExistingDatasetChange",
			"change [name=datasource_id]": "onDatasourceChange",
			"change [name=existing_variable_id]": "onExistingVariableChange",
			"change [name=subcategory_id]": "onSubCategoryChange",
			"change [name=multivariant_dataset]": "onMultivariantDatasetChange",
			"click .new-dataset-description-btn": "onDatasetDescription",
			"focus [name=source_name]": "onSourceNameFocus"
		},

		initialize: function( options ) {	
			this.dispatcher = options.dispatcher;
			this.render();

			// Clear any back button cache we might have and save the
			// true form defaults
			this.$el.find("form")[0].reset();
			this.defaultSettings = {};
			this.saveForm(this.defaultSettings);

			setTimeout(function() {
				if (window.localStorage.importerSaved && !_.isMatch(window.localStorage, this.defaultSettings)) {
					this.loadForm(window.localStorage);
					this.$clearSettingsBtn.show();
				}
				this.$el.find("form").on("change", function() {
					this.saveForm(window.localStorage);
				}.bind(this));
			}.bind(this), 1);
		},

		/* Save the contents of the form (barring file upload) to a (local)storage object
		 * We use this to remember input between page loads, especially handy for debugging */
		saveForm: function(storage) {
			this.$el.find("input, select, textarea").each(function(i, el) {
				var type = $(el).attr("type");
				if (type == "file" || type == "hidden") return;

				var key = "importer-" + $(el).attr('name');
				if (type == "radio") {
					key += "-" + $(el).val();
					storage[key] = JSON.stringify($(el).prop("checked"));
				} else {
					storage[key] = JSON.stringify($(el).val());
				}
			}.bind(this));

			storage.importerSaved = "true";
		},

		loadForm: function(storage) {
			this.$el.find("input, select, textarea").each(function(i, el) {
				var type = $(el).attr("type");
				if (type == "file" || type == "hidden") return;

				var key = "importer-" + $(el).attr('name');
				if (type == "radio")
					key += "-" + $(el).val();

				var data = storage[key];
				if (data == undefined || data == "undefined") return;
				var val = JSON.parse(data);

				if (type == "radio") {
					if (val)
						$(el).prop("checked", true);
				} else {
					$(el).val(val);
				}
				$(el).change();
			}.bind(this));

			// Make sure the dataset description is expanded if needed
			if (!_.isEmpty(this.$newDatasetDescription.val())) {
				this.$newDatasetDescriptionBtn.click();
			}
		},

		onClearSettings: function() {
			window.localStorage.clear();
			window.location.reload();
		},

		render: function() {
			//sections
			this.$datasetSection = this.$el.find( ".dataset-section" );
			this.$datasetTypeSection = this.$el.find( ".dataset-type-section" );
			this.$uploadSection = this.$el.find( ".upload-section" );
			this.$variableSection = this.$el.find( ".variables-section" );
			this.$categorySection = this.$el.find( ".category-section" );
			this.$variableTypeSection = this.$el.find( ".variable-type-section" );
				
			//random els
			this.$clearSettingsBtn = this.$el.find(".clear-settings-btn");
			this.$newDatasetDescriptionBtn = this.$el.find(".new-dataset-description-btn");
			this.$newDatasetDescription = this.$el.find( "[name=new_dataset_description]" );
			this.$existingDatasetSelect = this.$el.find( "[name=existing_dataset_id]" );
			this.$existingVariablesWrapper = this.$el.find( ".existing-variable-wrapper" );
			this.$existingVariablesSelect = this.$el.find( "[name=existing_variable_id]" );
			this.$variableSectionList = this.$variableSection.find( "ol" );

			//import section
			this.$filePicker = this.$el.find( ".file-picker-wrapper [type=file]" );
			this.$dataInput = this.$el.find( "[name=data]" );
			
			this.$csvImportResult = this.$el.find( ".csv-import-result" );
			this.$csvImportTableWrapper = this.$el.find( "#csv-import-table-wrapper" );
			
			this.$newDatasetSection = this.$el.find( ".new-dataset-section" );
			this.$existingDatasetSection = this.$el.find( ".existing-dataset-section" );
			this.$removeUploadedFileBtn = this.$el.find( ".remove-uploaded-file-btn" );

			//datasource section
			this.$newDatasourceWrapper = this.$el.find( ".new-datasource-wrapper" );
			this.$sourceName = this.$el.find( "[name=source_name]" );
			this.$sourceDescription = this.$el.find( "[name=source_description]" );

			//category section
			this.$categorySelect = this.$el.find( "[name=category_id]" );
			this.$subcategorySelect = this.$el.find( "[name=subcategory_id]" );

			//hide optional elements
			this.$newDatasetDescription.hide();
			//this.$variableSection.hide();

		},

		onCsvSelected: function(err, data) {
			if (!data)
				return;
			
			// Strip out rows full of empty cells
			data.rows = _.filter(data.rows, function(row) { 
				return !_.every(row, function(cell) { return _.isEmpty(cell); });
			});

			this.uploadedData = data;
			//store also original, this.uploadedData will be modified when being validated
			this.origUploadedData = $.extend( true, {}, this.uploadedData);
			this.createDataTable(data.rows);
			this.validateEntityData(data.rows);
			this.validateTimeData(data.rows);
			this.mapData();

		},

		createDataTable: function( data ) {
			var tableString = "<table>";

			_.each( data, function( rowData, rowIndex ) {

				var tr = "<tr>";
				_.each( rowData, function( cellData, cellIndex ) {
					//if(cellData) {
						var td = (rowIndex > 0)? "<td>" + cellData + "</td>": "<th>" + cellData + "</th>";
						tr += td;
					//}
				} );
				tr += "</tr>";
				tableString += tr;

			} );

			tableString += "</table>";

			var $table = $( tableString );
			this.$csvImportTableWrapper.append( $table );
		},

		updateVariableList: function() {
			var $list = this.$variableSectionList;
			$list.empty();
			
			_.each(this.newVariables, function(v, k) {					
				var $li = this.createVariableEl(v);
				$list.append($li);				
			}.bind(this));
		},

		createVariableEl: function( data ) {
			if (!data.unit) {
				data.unit = "";
			}
			if (!data.description) {
				data.description = "";
			}

			var stringified = JSON.stringify( data );
			//weird behaviour when single quote inserted into hidden input
			stringified = stringified.replace( "'", "&#x00027;" );
			stringified = stringified.replace( "'", "&#x00027;" );
			
			var $li = $( "<li class='variable-item clearfix'></li>" ),
				$inputName = $( "<label>Name*<input class='form-control' value='" + data.name + "' placeholder='Enter variable name'/></label>" ),
				$inputUnit = $( "<label>Unit<input class='form-control' value='" + data.unit + "' placeholder='Enter variable unit' /></label>" ),
				$inputDescription = $( "<label>Description<input class='form-control' value='" + data.description + "' placeholder='Enter variable description' /></label>" ),
				$inputData = $( "<input type='hidden' name='variables[]' value='" + stringified + "' />" );
			
			$li.append( $inputName );
			$li.append( $inputUnit );
			$li.append( $inputDescription );
			$li.append( $inputData );
				
			var that = this,
				$inputs = $li.find( "input" );
			$inputs.on( "input", function( evt ) {
				//update stored json
				var json = $.parseJSON( $inputData.val() );
				json.name = $inputName.find( "input" ).val();
				json.unit = $inputUnit.find( "input" ).val();
				json.description = $inputDescription.find( "input" ).val();
				$inputData.val( JSON.stringify( json ) );
			} );
			$inputs.on( "focus", function( evt ) {
				//set flag so that values in input won't get overwritten by changes to dataset name
				that.variableNameManual = true;
			});

			return $li;

		},

		mapData: function() {
			//massive import version
			//var mappedData = App.Utils.mapPanelData( this.uploadedData.rows ),
			var mappedData = ( !this.isDataMultiVariant )?  Utils.mapSingleVariantData( this.uploadedData.rows, this.datasetName ): Utils.mapMultiVariantData( this.uploadedData.rows ),
				json = { "variables": mappedData },
				jsonString = JSON.stringify( json );

			this.$dataInput.val( jsonString );
			this.$removeUploadedFileBtn.show();

			this.newVariables = json.variables;
			this.updateVariableList();
		},

		validateEntityData: function( data ) {
			//validateEntityData doesn't modify the original data
			var $dataTableWrapper = $( ".csv-import-table-wrapper" ),
				$dataTable = $dataTableWrapper.find( "table" ),
				$entitiesCells = $dataTable.find( "td:first-child" ),
				//$entitiesCells = $dataTable.find( "th" ),
				entities = _.map( $entitiesCells, function( v ) { return $( v ).text(); } );

			//make sure we're not validating one entity multiple times
			entities = _.uniq( entities );
			
			$.ajax( {
				url: Global.rootUrl + "/entityIsoNames/validate",
				data: { entities: JSON.stringify(entities) },
				contentType: 'application/json',
				type: 'GET',								
				beforeSend: function() {
					$dataTableWrapper.before( "<p class='entities-loading-notice loading-notice'>Validating entities</p>" );
				},
				success: function( response ) {
					if (response.unmatched) {							
						var unmatched = response.unmatched;
						$entitiesCells.removeClass( "alert-error" );
						$.each( $entitiesCells, function( i, v ) {
							var $entityCell = $( this ),
								value = $entityCell.text();
								$entityCell.removeClass( "alert-error" );
								$entityCell.addClass( "alert-success" );
							if( _.indexOf( unmatched, value ) > -1 ) {
								$entityCell.addClass( "alert-error" );
								$entityCell.removeClass( "alert-success" );
							}
						} );

						//remove preloader
						$( ".entities-loading-notice" ).remove();
						//result notice
						$( ".entities-validation-wrapper" ).remove();
						var $resultNotice = (unmatched.length)? $( "<div class='entities-validation-wrapper'><p class='entities-validation-result validation-result text-danger'><i class='fa fa-exclamation-circle'></i>Some countries do not have <a href='http://en.wikipedia.org/wiki/ISO_3166' target='_blank'>standardized name</a>! Rename the highlighted countries and reupload CSV.</p><label><input type='checkbox' name='validate_entities'/>Import countries anyway</label></div>" ): $( "<p class='entities-validation-result validation-result text-success'><i class='fa fa-check-circle'></i>All countries have standardized name, well done!</p>" );
						$dataTableWrapper.before( $resultNotice );

					}
				}
			} );
			
		},

		validateTimeData: function( data ) {
			var $dataTableWrapper = $( ".csv-import-table-wrapper" ),
				$dataTable = $dataTableWrapper.find( "table" ),
				timeDomain = ( !this.isDataMultiVariant )? $dataTable.find( "th:first-child" ).text(): $dataTable.find( "th:nth-child(2)" ).text(),
				$timesCells = ( !this.isDataMultiVariant )? $dataTable.find( "th" ): $dataTable.find( "td:nth-child(2)" );
			
			if( timeDomain ) {
				timeDomain = timeDomain.toLowerCase();
			}
			
			//the first cell (timeDomain) shouldn't be validated
			if( !this.isDataMultiVariant ) {
				$timesCells = $timesCells.slice( 1 );
			}
			
			//make sure time is from given domain
			if( _.indexOf( [ "century", "decade", "quarter century", "half century", "year", "years" ], timeDomain ) == -1 ) {
				var $resultNotice = $( "<p class='time-domain-validation-result validation-result text-danger'><i class='fa fa-exclamation-circle'></i>First top-left cell should contain time domain information. Either 'century', or 'decade', or 'quarter century', or 'half century' or 'year' or 'years' for time intervals.</p>" );
				$dataTableWrapper.before( $resultNotice );
			}
			
			var that = this;
			$.each( $timesCells, function( i, v ) {

				var $timeCell = $( v );
				
				//find corresponding value in loaded data
				var newValue,
					origValue = ( !that.isDataMultiVariant )? data[ 0 ][ i+1 ]: data[ i+1 ][ 1 ];
				
				var value = origValue,
					date = moment( new Date( value ) ),
					valid = false,
					timeArr, date1, date2;

				if (parseInt(value).toString() === value) {
					valid = true;
				} else {
					//remove all whitespace
					value = value.replace(/ /g,'');
					timeArr = value.split( "-" );
					if( timeArr.length === 2) {
						//validate both dates
						date1 = moment( new Date( timeArr[0] ) );
						date2 = moment( new Date( timeArr[1] ) );
						if( date1.isValid() && date2.isValid() ) {
							valid = true;
						}
					}
				}

				if( !valid ) {

					$timeCell.addClass( "alert-error" );
					$timeCell.removeClass( "alert-success" );
				
				} else {
					
					//correct date
					$timeCell.addClass( "alert-success" );
					$timeCell.removeClass( "alert-error" );
					//insert potentially modified value into cell
					$timeCell.text( value );

					newValue = { "d": Utils.roundTime( date ), "l": origValue };

					//try to guess century
					var year = Math.floor( origValue ),
						nextYear = year + 1;

					//add zeros
					year = Utils.addZeros( year );
					nextYear = Utils.addZeros( nextYear );
					
					//convert it to datetime values
					year = moment( new Date( year.toString() ) );
					nextYear = moment( new Date( nextYear.toString() ) ).seconds(-1);
					//modify the initial value
					newValue[ "sd" ] =  Utils.roundTime( year );
					newValue[ "ed" ] =  Utils.roundTime( nextYear );

					//insert info about time domain
					newValue[ "td" ] = timeDomain;
					
					//initial was number/string so passed by value, need to insert it back to arreay
					if( !that.isDataMultiVariant ) {
						data[ 0 ][ i+1 ] = newValue;
					} else {
						data[ i+1 ][ 1 ] = newValue;
					}
					//massive import version
					//data[ i+1 ][ 1 ] = newValue;

				}

			});

			var $resultNotice;

			//remove any previously attached notifications
			$( ".times-validation-result" ).remove();

			if( $timesCells.filter( ".alert-error" ).length ) {
				
				$resultNotice = $( "<p class='times-validation-result validation-result text-danger'><i class='fa fa-exclamation-circle'></i>Time information in the uploaded file is not in <a href='http://en.wikipedia.org/wiki/ISO_8601' target='_blank'>standardized format (YYYY-MM-DD)</a>! Fix the highlighted time information and reupload CSV.</p>" );
			
			} else {

				$resultNotice = $( "<p class='times-validation-result validation-result text-success'><i class='fa fa-check-circle'></i>Time information in the uploaded file is correct, well done!</p>" );

			}
			$dataTableWrapper.before( $resultNotice );
			
		},

		onDatasetDescription: function(ev) {
			ev.preventDefault();
			var $btn = $(ev.currentTarget);
			
			if( this.$newDatasetDescription.is( ":visible" ) ) {
				this.$newDatasetDescription.hide();
				$btn.find( "span" ).text( "Add dataset description." );
				$btn.find( "i" ).removeClass( "fa-minus" );
				$btn.find( "i" ).addClass( "fa-plus" );
			} else {
				this.$newDatasetDescription.show();
				$btn.find( "span" ).text( "Nevermind, no description." );
				$btn.find( "i" ).addClass( "fa-minus" );
				$btn.find( "i" ).removeClass( "fa-plus" );
			}
		},

		onNewDatasetChange: function( evt ) {
			var $input = $( evt.currentTarget );
			if (!$input.prop("checked")) return;

			if ($input.val() === "0") {
				this.$newDatasetSection.hide();
				this.$existingDatasetSection.show();
				//should we appear variable select as well?
				if( !this.$existingDatasetSelect.val() ) {
					this.$existingVariablesWrapper.hide();
				} else {
					this.$existingVariablesWrapper.show();
				}
			} else {
				this.$newDatasetSection.show();
				this.$existingDatasetSection.hide();
			}

		},

		onNewDatasetNameChange: function( evt ) {
			var $input = $( evt.currentTarget );
			this.datasetName = $input.val();

			//check if we have value for variable, enter if not
			var $variableItems = this.$variableSectionList.find( ".variable-item" );
			if( $variableItems.length == 1 && !this.variableNameManual ) {
				//we have just one, check 
				var $variableItem = $variableItems.eq( 0 ),
					$firstInput = $variableItem.find( "input" ).first();
				$firstInput.val( this.datasetName );
				$firstInput.trigger( "input" );
			}

			//check if we have value for datasource name, enter it if not
			if( !this.sourceNameManual ) {
				this.$sourceName.val( this.datasetName );
			}

		},

		onExistingDatasetChange: function() {
			var $option = this.$existingDatasetSelect.find('option:selected');
			this.datasetId = $option.val();
			this.datasetName = $option.text();

			if (!this.datasetId) return;

			$.get(Global.rootUrl + "/datasets/" + this.datasetId + ".json")
				.done(function(dataset) { 
					this.existingVariables = dataset.variables;
					this.updateVariableList();
				}.bind(this))
				.fail(function(err) {
					owid.reportError(err, "Unable to load dataset " + this.datasetId + " \"" + this.datasetName + "\"");
				}.bind(this));
		},

		onExistingVariableChange: function( evt ) {
			var $input = $( evt.currentTarget );
			this.existingVariable = $input.find( 'option:selected' );
		},

		onFileChange: function() {
			// Clear anything that was already there
			this.$csvImportTableWrapper.empty();
			this.$dataInput.val("");
			this.$csvImportResult.find(".validation-result").remove();

			var file = this.$filePicker.get(0).files[0];
			if (!file) return;				

			var filetype = 'csv';
			if (file.name.match(/\.xlsx?$/i))
				filetype = 'xls';


			var reader = new FileReader();
			
			reader.onload = function(e) {
				var data = e.target.result,
					csv = null;
				
				if (filetype == 'xls') {
					var workbook = XLSX.read(data, {type: 'binary'});
					csv = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
				} else {
					csv = data;
				}

				Papa.parse(csv, {
					skipEmptyLines: true,
					complete: function(obj) {
						var data = { rows: obj.data };
						this.onCsvSelected(null, data);
					}.bind(this)
				});
			}.bind(this);

			if (filetype == 'xls')
				reader.readAsBinaryString(file);
			else
				reader.readAsText(file);
		},

		onRemoveUploadedFile: function() {
			this.$filePicker.replaceWith(this.$filePicker.clone());
			//refetch dom
			this.$filePicker = this.$el.find( ".file-picker-wrapper [type=file]");
			this.$filePicker.prop("disabled", false);

			//reset related components
			this.$csvImportTableWrapper.empty();
			this.$dataInput.val("");
			this.$csvImportResult.find(".validation-result").remove();
		},

		onCategoryChange: function( evt ) {
			var $input = $( evt.currentTarget );
			if( $input.val() != "" ) {
				this.$subcategorySelect.show();
				this.$subcategorySelect.css( "display", "block" );
			} else {
				this.$subcategorySelect.hide();
			}

			//filter subcategories select
			this.$subcategorySelect.find( "option" ).hide();
			this.$subcategorySelect.find( "option[data-category-id=" + $input.val() + "]" ).show();
			this.$subcategorySelect.val("");
		},

		onDatasourceChange: function( evt ) {
			var $target = $( evt.currentTarget );
			if( $target.val() < 1 ) {
				this.$newDatasourceWrapper.slideDown();
			} else {
				this.$newDatasourceWrapper.slideUp();
			}
		},

		onSubCategoryChange: function(evt) {
			
		},

		onSourceNameFocus: function( evt ) {
			console.log( "onSourceNameFocus" );
			this.sourceNameManual = true;
		},

		onMultivariantDatasetChange: function( evt ) {
			var $input = $(evt.currentTarget);
			if (!$input.prop("checked")) return;

			if ($input.val() === "1" && !this.isDataMultiVariant) {
				this.isDataMultiVariant = true;
				// Trigger revalidation
				this.onFileChange();
			} else if ($input.val() === "0" && this.isDataMultiVariant) {
				this.isDataMultiVariant = false;
				this.onFileChange();
			}			
		},

		onFormSubmit: function( evt ) {
			evt.preventDefault();

			var $validateEntitiesCheckbox = $( "[name='validate_entities']" ),
				validateEntities = ( $validateEntitiesCheckbox.is( ":checked" ) )? false: true,
				$validationResults = [];

			//display validation results
			//validate entered datasources
			var $sourceDescription = $( "[name='source_description']" ),
				sourceDescriptionValue = $sourceDescription.val(),
				hasValidSource = true;
			if( sourceDescriptionValue.search( "<td>e.g." ) > -1 || sourceDescriptionValue.search( "<p>e.g." ) > -1 ) {
				hasValidSource = false;
			}
			var $sourceValidationNotice = $( ".source-validation-result" );
			if( !hasValidSource ) {
				//invalid
				if( !$sourceValidationNotice.length ) {
					//doens't have notice yet
					$sourceValidationNotice = $( "<p class='source-validation-result validation-result text-danger'><i class='fa fa-exclamation-circle'> Please replace the sample data with real datasource info.</p>" );
					$sourceDescription.before( $sourceValidationNotice );
				} else {
					$sourceValidationNotice.show();
				}
			} else {
				//valid, make sure there's not 
				$sourceValidationNotice.remove();
			}

			//category validation
			var $categoryValidationNotice = $( ".category-validation-result" );
			if( !this.$categorySelect.val() || !this.$subcategorySelect.val() ) {
				if( !$categoryValidationNotice.length ) {
					$categoryValidationNotice = $( "<p class='category-validation-result validation-result text-danger'><i class='fa fa-exclamation-circle'> Please choose category for uploaded data.</p>" );
					this.$categorySelect.before( $categoryValidationNotice );
				} {
					$categoryValidationNotice.show();
				}
			} else {
				//valid, make sure to remove
				$categoryValidationNotice.remove();
			}

			//different scenarios of validation
			if( validateEntities ) {
				//validate both time and entitiye
				$validationResults = $( ".validation-result.text-danger" );
			} else if( !validateEntities ) {
				//validate only time
				$validationResults = $( ".time-domain-validation-result.text-danger, .times-validation-result.text-danger, .source-validation-result, .category-validation-result" );
			} else {
				//do not validate
			}
			
			if( $validationResults.length ) {
				//do not send form and scroll to error message
				evt.preventDefault();
				$('html, body').animate({
					scrollTop: $validationResults.offset().top - 18
				}, 300);
				return false;
			}
			
			//evt 
			var $btn = $( "[type=submit]" );
			$btn.prop( "disabled", true );
			$btn.css( "opacity", 0.5 );

			$btn.after( "<p class='send-notification'><i class='fa fa-spinner fa-spin'></i>Sending form</p>" );

			//serialize array
			var $form = $( "#import-view > form" );
			
			var importer = new Importer( { dispatcher: this.dispatcher } );
			importer.uploadFormData( $form, this.origUploadedData, this.isDataMultiVariant );

			var importProgress = new ImportProgressPopup();
			importProgress.init( { dispatcher: this.dispatcher } );
			importProgress.show();

			return false;
		}
	});
})();