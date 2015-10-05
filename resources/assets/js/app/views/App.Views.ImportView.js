;( function() {
	
	"use strict";

	App.Views.ImportView = Backbone.View.extend({

		datasetName: "",
		isDataMultiVariant: false,
		origUploadedData: false,
		uploadedData: false,
		variableNameManual: false,

		el: "#import-view",
		events: {
			"submit form": "onFormSubmit",
			"input [name=new_dataset_name]": "onNewDatasetNameChange",
			"change [name=new_dataset]": "onNewDatasetChange",
			"click .remove-uploaded-file-btn": "onRemoveUploadedFile",
			"change [name=category_id]": "onCategoryChange",
			"change [name=existing_dataset_id]": "onExistingDatasetChange",
			"change [name=datasource_id]": "onDatasourceChange",
			"change [name=existing_variable_id]": "onExistingVariableChange",
			"change [name=subcategory_id]": "onSubCategoryChange",
			"change [name=multivariant_dataset]": "onMultivariantDatasetChange",
			"click .new-dataset-description-btn": "onDatasetDescription"
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			this.render();
			this.initUpload();

			/*var importer = new App.Models.Importer();
			importer.uploadFormData();*/

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
			this.$sourceDescription = this.$el.find( "[name=source_description]" );

			//category section
			this.$categorySelect = this.$el.find( "[name=category_id]" );
			this.$subcategorySelect = this.$el.find( "[name=subcategory_id]" );

			//hide optional elements
			this.$newDatasetDescription.hide();
			//this.$variableSection.hide();

		},

		initUpload: function() {

			var that = this;
			this.$filePicker.on( "change", function( i, v ) {

				var $this = $( this );
				$this.parse( {
					config: {
						complete: function( obj ) {
							var data = { rows: obj.data };
							that.onCsvSelected( null, data );
						}
					}
				} );

			} );

			/*CSV.begin( this.$filePicker.selector )
				//.table( "csv-import-table-wrapper", { header:1, caption: "" } )
				.go( function( err, data ) {
					that.onCsvSelected( err, data );
				} );
			this.$removeUploadedFileBtn.hide();*/

		},

		onCsvSelected: function( err, data ) {
			
			if( !data ) {
				return;
			}
			
			//testing massive import version 			
			/*this.uploadedData = data;
			//store also original, this.uploadedData will be modified when being validated
			this.origUploadedData = $.extend( true, {}, this.uploadedData);

			this.createDataTable( data.rows );
			
			this.validateEntityData( data.rows );
			this.validateTimeData( data.rows );
			
			this.mapData();*/

			//normal version

			//do we need to transpose data?
			if( !this.isDataMultiVariant ) {
				var isOriented = this.detectOrientation( data.rows );
				if( !isOriented ) {
					data.rows = App.Utils.transpose( data.rows );
				}
			}
			
			this.uploadedData = data;
			//store also original, this.uploadedData will be modified when being validated
			this.origUploadedData = $.extend( true, {}, this.uploadedData);
			
			this.createDataTable( data.rows );

			this.validateEntityData( data.rows );
			this.validateTimeData( data.rows );

			this.mapData();

		},

		detectOrientation: function( data ) {

			var isOriented = true;

			//first row, second cell, should be number (time)
			if( data.length > 0 && data[0].length > 0 ) {
				var secondCell = data[ 0 ][ 1 ];
				if( isNaN( secondCell ) ) {
					isOriented = false;
				}
			}

			return isOriented;

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

		updateVariableList: function( data ) {

			var $list = this.$variableSectionList;
			$list.empty();
			
			var that = this;
			if( data && data.variables ) {
				_.each( data.variables, function( v, k ) {
					
					//if we're creating new variables injects into data object existing variables
					if( that.existingVariable && that.existingVariable.attr( "data-id" ) > 0 ) {
						v.id = that.existingVariable.attr( "data-id" );
						v.name = that.existingVariable.attr( "data-name" );
						v.unit = that.existingVariable.attr( "data-unit" );
						v.description = that.existingVariable.attr( "data-description" );
					}
					var $li = that.createVariableEl( v );
					$list.append( $li );
				
				} );
			}

		},

		createVariableEl: function( data ) {

			if( !data.unit ) {
				data.unit = "";
			}
			if( !data.description ) {
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
			var mappedData = ( !this.isDataMultiVariant )?  App.Utils.mapSingleVariantData( this.uploadedData.rows, this.datasetName ): App.Utils.mapMultiVariantData( this.uploadedData.rows ),
				json = { "variables": mappedData },
				jsonString = JSON.stringify( json );

			this.$dataInput.val( jsonString );
			this.$removeUploadedFileBtn.show();

			this.updateVariableList( json );

		},

		validateEntityData: function( data ) {

			/*if( this.isDataMultiVariant ) {
				return true;
			}*/

			//validateEntityData doesn't modify the original data
			var $dataTableWrapper = $( ".csv-import-table-wrapper" ),
				$dataTable = $dataTableWrapper.find( "table" ),
				$entitiesCells = $dataTable.find( "td:first-child" ),
				//$entitiesCells = $dataTable.find( "th" ),
				entities = _.map( $entitiesCells, function( v ) { return $( v ).text(); } );

			//make sure we're not validating one entity multiple times
			entities = _.uniq( entities );
			
			//get rid of first one (time label)
			//entities.shift();

			$.ajax( {
				url: Global.rootUrl + "/entityIsoNames/validateData",
				data: { "entities": JSON.stringify( entities ) },
				beforeSend: function() {
					$dataTableWrapper.before( "<p class='entities-loading-notice loading-notice'>Validating entities</p>" );
				},
				success: function( response ) {
					if( response.data ) {
							
						var unmatched = response.data;
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
				//massive import version
				//timeDomain = $dataTable.find( "th:nth-child(2)" ).text(),
				timeDomain = ( !this.isDataMultiVariant )? $dataTable.find( "th:first-child" ).text(): $dataTable.find( "th:nth-child(2)" ).text(),
				$timesCells = ( !this.isDataMultiVariant )? $dataTable.find( "th" ): $dataTable.find( "td:nth-child(2)" );/*,
				//massive import version
				//$timesCells = $dataTable.find( "td:nth-child(2)" );/*,
				times = _.map( $timesCells, function( v ) { return $( v ).text() } );*/
			//format time domain maybe
			if( timeDomain ) {
				timeDomain = timeDomain.toLowerCase();
			}
			
			//the first cell (timeDomain) shouldn't be validated
			//massive import version - commented out next row
			if( !this.isDataMultiVariant ) {
				$timesCells = $timesCells.slice( 1 );
			}
			
			//make sure time is from given domain
			if( _.indexOf( [ "century", "decade", "quarter century", "half century", "year" ], timeDomain ) == -1 ) {
				var $resultNotice = $( "<p class='time-domain-validation-result validation-result text-danger'><i class='fa fa-exclamation-circle'></i>First top-left cell should contain time domain infomartion. Either 'century', or'decade', or 'year'.</p>" );
				$dataTableWrapper.before( $resultNotice );
			}
			
			var that = this;
			$.each( $timesCells, function( i, v ) {

				var $timeCell = $( v );
				
				//find corresponding value in loaded data
				var newValue,
					//massive import version
					//origValue = data[ i+1 ][ 1 ];
					origValue = ( !that.isDataMultiVariant )? data[ 0 ][ i+1 ]: data[ i+1 ][ 1 ];
				
				//check value has 4 digits
				origValue = App.Utils.addZeros( origValue );

				var value = origValue,
					date = moment( new Date( value ) );
				
				if( !date.isValid() ) {

					$timeCell.addClass( "alert-error" );
					$timeCell.removeClass( "alert-success" );
				
				} else {
					
					//correct date
					$timeCell.addClass( "alert-success" );
					$timeCell.removeClass( "alert-error" );
					//insert potentially modified value into cell
					$timeCell.text( value );

					newValue = { "d": App.Utils.roundTime( date ), "l": origValue };

					if( timeDomain == "year" ) {
						
						//try to guess century
						var year = Math.floor( origValue ),
							nextYear = year + 1;

						//add zeros
						year = App.Utils.addZeros( year );
						nextYear = App.Utils.addZeros( nextYear );
						
						//convert it to datetime values
						year = moment( new Date( year.toString() ) );
						nextYear = moment( new Date( nextYear.toString() ) ).seconds(-1);
						//modify the initial value
						newValue[ "sd" ] =  App.Utils.roundTime( year );
						newValue[ "ed" ] =  App.Utils.roundTime( nextYear );

					} else if( timeDomain == "decade" ) {
						
						//try to guess century
						var decade = Math.floor( origValue / 10 ) * 10,
							nextDecade = decade + 10;
						
						//add zeros
						decade = App.Utils.addZeros( decade );
						nextDecade = App.Utils.addZeros( nextDecade );

						//convert it to datetime values
						decade = moment( new Date( decade.toString() ) );
						nextDecade = moment( new Date( nextDecade.toString() ) ).seconds(-1);
						//modify the initial value
						newValue[ "sd" ] =  App.Utils.roundTime( decade );
						newValue[ "ed" ] =  App.Utils.roundTime( nextDecade );

					} else if( timeDomain == "quarter century" ) {
						
						//try to guess quarter century
						var century = Math.floor( origValue / 100 ) * 100,
							modulo = ( origValue % 100 ),
							quarterCentury;
						
						//which quarter is it
						if( modulo < 25 ) {
							quarterCentury = century;
						} else if( modulo < 50 ) {
							quarterCentury = century+25;
						} else if( modulo < 75 ) {
							quarterCentury = century+50;
						} else {
							quarterCentury = century+75;
						}
							
						var nextQuarterCentury = quarterCentury + 25;

						//add zeros
						quarterCentury = App.Utils.addZeros( quarterCentury );
						nextQuarterCentury = App.Utils.addZeros( nextQuarterCentury );

						//convert it to datetime values
						quarterCentury = moment( new Date( quarterCentury.toString() ) );
						nextQuarterCentury = moment( new Date( nextQuarterCentury.toString() ) ).seconds(-1);
						//modify the initial value
						newValue[ "sd" ] =  App.Utils.roundTime( quarterCentury );
						newValue[ "ed" ] =  App.Utils.roundTime( nextQuarterCentury );

					} else if( timeDomain == "half century" ) {
						
						//try to guess half century
						var century = Math.floor( origValue / 100 ) * 100,
							//is it first or second half?
							halfCentury = ( origValue % 100 < 50 )? century: century+50,
							nextHalfCentury = halfCentury + 50;

						//add zeros
						halfCentury = App.Utils.addZeros( halfCentury );
						nextHalfCentury = App.Utils.addZeros( nextHalfCentury );

						//convert it to datetime values
						halfCentury = moment( new Date( halfCentury.toString() ) );
						nextHalfCentury = moment( new Date( nextHalfCentury.toString() ) ).seconds(-1);
						//modify the initial value
						newValue[ "sd" ] =  App.Utils.roundTime( halfCentury );
						newValue[ "ed" ] =  App.Utils.roundTime( nextHalfCentury );

					} else if( timeDomain == "century" ) {
						
						//try to guess century
						var century = Math.floor( origValue / 100 ) * 100,
							nextCentury = century + 100;

						//add zeros
						century = App.Utils.addZeros( century );
						nextCentury = App.Utils.addZeros( nextCentury );

						//convert it to datetime values
						century = moment( new Date( century.toString() ) );
						nextCentury = moment( new Date( nextCentury.toString() ) ).seconds(-1);
						//modify the initial value
						newValue[ "sd" ] = App.Utils.roundTime( century );
						newValue[ "ed" ] = App.Utils.roundTime( nextCentury );

					}

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

		onDatasetDescription: function( evt ) {

			var $btn = $( evt.currentTarget );
			
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
			if( $input.val() === "0" ) {
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

		},

		onExistingDatasetChange: function( evt ) {

			var $input = $( evt.currentTarget );
			this.datasetName = $input.find( 'option:selected' ).text();

			if( $input.val() ) {
				//filter variable select to show variables only from given dataset
				var $options = this.$existingVariablesSelect.find( "option" );
				$options.hide();
				$options.filter( "[data-dataset-id=" + $input.val() + "]" ).show();
				//appear also the first default
				$options.first().show();
				this.$existingVariablesWrapper.show();
			} else {
				this.$existingVariablesWrapper.hide();
			}

		},

		onExistingVariableChange: function( evt ) {

			var $input = $( evt.currentTarget );
			this.existingVariable = $input.find( 'option:selected' );
	
		},

		onRemoveUploadedFile: function( evt ) {

			this.$filePicker.replaceWith( this.$filePicker.clone() );
			//refetch dom
			this.$filePicker = this.$el.find( ".file-picker-wrapper [type=file]" );
			this.$filePicker.prop( "disabled", false);

			//reset related components
			this.$csvImportTableWrapper.empty();
			this.$dataInput.val("");
			//remove notifications
			this.$csvImportResult.find( ".validation-result" ).remove();

			this.initUpload();

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

		},

		onDatasourceChange: function( evt ) {

			var $target = $( evt.currentTarget );
			if( $target.val() < 1 ) {
				this.$newDatasourceWrapper.slideDown();
			} else {
				this.$newDatasourceWrapper.slideUp();
			}

		},

		onSubCategoryChange: function( evt ) {
			
		},

		onMultivariantDatasetChange: function( evt ) {

			var $input = $( evt.currentTarget );
			if( $input.val() === "1" ) {
				this.isDataMultiVariant = true;
				//$( ".validation-result" ).remove();
				//$( ".entities-validation-wrapper" ).remove();
			} else {
				this.isDataMultiVariant = false;
			}

			if( this.uploadedData && this.origUploadedData ) {

				//insert original uploadedData into array before processing
				this.uploadedData = $.extend( true, {}, this.origUploadedData);
				//re-validate
				this.validateEntityData( this.uploadedData.rows );
				this.validateTimeData( this.uploadedData.rows );
				this.mapData();

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
			
			console.log( "validationResults.length", $validationResults.length );

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
			
			var importer = new App.Models.Importer( { dispatcher: this.dispatcher } );
			importer.uploadFormData( $form, this.origUploadedData );

			var importProgress = new App.Views.UI.ImportProgressPopup();
			importProgress.init( { dispatcher: this.dispatcher } );
			importProgress.show();

			return false;


		}


	});

	module.exports = App.Views.ImportView;

})();