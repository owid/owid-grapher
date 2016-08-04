;(function() {	
	"use strict";
	owid.namespace("App.Views.ImportView");

	var papaparse = require("Papa"),
		moment = require("moment"),
		Importer = require("App.Models.Importer"),
		ChooseDatasetSection = require("App.Views.Import.ChooseDatasetSection"),
		VariablesSection = require("App.Views.Import.VariablesSection"),
		CategorySection = require("App.Views.Import.CategorySection"),
		ImportProgressPopup = require("App.Views.UI.ImportProgressPopup"),
		Utils = require("App.Utils");

	App.Views.ImportView = owid.View.extend({
		isDataMultiVariant: false,
		origUploadedData: false,
		uploadedData: false,

		el: "#import-view",
		events: {
			"submit form": "onFormSubmit",
			"click .clear-settings-btn": "onClearSettings",
			"change [type=file]": "onFileChange",
			"click .remove-uploaded-file-btn": "onRemoveUploadedFile",
			"change [name=multivariant_dataset]": "onMultivariantDatasetChange",
		},

		initialize: function( options ) {	
			this.dispatcher = options.dispatcher;
			App.DatasetModel = new App.Models.Import.DatasetModel({ dispatcher: this.dispatcher });
			this.datasetSection = this.addChild(ChooseDatasetSection);
			this.variableSection = this.addChild(VariablesSection);
			this.categorySection = this.addChild(CategorySection);
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
				$(el).trigger("input");
			}.bind(this));

			// Make sure the dataset description is expanded if needed
			if (!_.isEmpty(this.$newDatasetDescription.val())) {
				this.$newDatasetDescriptionBtn.click();
			}

			// Make sure the dataset is cleared if it's a new one
			if ($("[name=new_dataset]").prop("checked")) {
				App.DatasetModel.set("id", null);
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
			this.$variableTypeSection = this.$el.find( ".variable-type-section" );
				
			//random els
			this.$clearSettingsBtn = this.$el.find(".clear-settings-btn");
			this.$newDatasetDescriptionBtn = this.$el.find(".new-dataset-description-btn");
			this.$newDatasetDescription = this.$el.find( "[name=new_dataset_description]" );
			this.$existingDatasetSelect = this.$el.find( "[name=existing_dataset_id]" );

			//import section
			this.$filePicker = this.$el.find( ".file-picker-wrapper [type=file]" );
			this.$dataInput = this.$el.find( "[name=data]" );
			
			this.$csvImportResult = this.$el.find( ".csv-import-result" );
			this.$csvImportTableWrapper = this.$el.find( "#csv-import-table-wrapper" );
			
			this.$newDatasetSection = this.$el.find( ".new-dataset-section" );
			this.$existingDatasetSection = this.$el.find( ".existing-dataset-section" );
			this.$removeUploadedFileBtn = this.$el.find( ".remove-uploaded-file-btn" );

			//hide optional elements
			this.$newDatasetDescription.hide();
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

		mapData: function() {
			//massive import version
			//var mappedData = App.Utils.mapPanelData( this.uploadedData.rows ),
			var variables = !this.isDataMultiVariant ? Utils.mapSingleVariantData(this.uploadedData.rows, App.DatasetModel.get("name")) : Utils.mapMultiVariantData(this.uploadedData.rows);

			// Set defaults for variables from their existing settings
			var oldVariablesByName = _.indexBy(App.DatasetModel.get("oldVariables"), 'name');
			_.each(variables, function(variable) {
				var oldvar = oldVariablesByName[variable.name];
				if (oldvar) {
					_.extend(variable, oldvar);
				}
			});

			App.DatasetModel.set("newVariables", variables);
			this.$removeUploadedFileBtn.show();
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
						$entitiesCells.removeClass( "alert-warning" );
						$.each( $entitiesCells, function( i, v ) {
							var $entityCell = $( this ),
								value = $entityCell.text();
								$entityCell.removeClass( "alert-warning" );
								$entityCell.addClass( "alert-success" );
							if( _.indexOf( unmatched, value ) > -1 ) {
								$entityCell.addClass( "alert-warning" );
								$entityCell.removeClass( "alert-success" );
							}
						} );

						//remove preloader
						$(".entities-loading-notice").remove();
						//result notice
						$(".entities-validation-wrapper").remove();
						var $resultNotice = (unmatched.length) ? $("<div class='entities-validation-wrapper'><p class='entities-validation-result validation-result text-warning'><i class='fa fa-warning'></i> Some countries are not using <a href='http://en.wikipedia.org/wiki/ISO_3166' target='_blank'>standardized names</a>. You may want to double check that these are the names you want to upload.</p><label>" ) : $("<p class='entities-validation-result validation-result text-success'><i class='fa fa-check-circle'></i>All countries have standardized name, well done!</p>");
						$dataTableWrapper.before($resultNotice);
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

		onFileChange: function() {
			// Clear anything that was already there
			this.$csvImportTableWrapper.empty();
			this.$csvImportResult.find(".validation-result").remove();
			App.DatasetModel.set("newVariables", []);

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
			this.$csvImportResult.find(".validation-result").remove();

			App.DatasetModel.set("newVariables", []);
			this.$removeUploadedFileBtn.hide();
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

			var $validationResults = $(".time-domain-validation-result.text-danger, .times-validation-result.text-danger, .category-validation-result, .variable-validation-result");

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
			var $form = $("#import-view > form");
			
			var importer = new Importer( { dispatcher: this.dispatcher } );
			importer.uploadFormData($form, this.origUploadedData, this.isDataMultiVariant);

			var importProgress = new ImportProgressPopup();
			importProgress.init( { dispatcher: this.dispatcher } );
			importProgress.show();

			return false;
		}
	});
})();