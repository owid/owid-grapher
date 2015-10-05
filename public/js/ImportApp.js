(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
;( function() {
	
	"use strict";

	var Import = require( "./views/App.Views.Import.js" ),
		ChartDataModel = require( "./models/App.Models.ChartDataModel.js" );

	//setup models
	//is new chart or display old chart
	var $chartShowWrapper = $( ".chart-show-wrapper, .chart-edit-wrapper" ),
		chartId = $chartShowWrapper.attr( "data-chart-id" );

	//setup views
	App.View = new Import();

	if( $chartShowWrapper.length && chartId ) {
		
		//showing existing chart
		App.ChartModel = new App.Models.ChartModel( { id: chartId } );
		App.ChartModel.fetch( {
			success: function( data ) {
				App.View.start();
			},
			error: function( xhr ) {
				console.error( "Error loading chart model", xhr );
			}
		} );
		//find out if it's in cache
		if( !$( ".standalone-chart-viewer" ).length ) {
			//disable caching for viewing within admin
			App.ChartModel.set( "cache", false );
		}
		
	} else {

		//is new chart
		App.ChartModel = new App.Models.ChartModel();
		App.View.start();

	}

	
	

})();
},{"./models/App.Models.ChartDataModel.js":2,"./views/App.Views.Import.js":3}],2:[function(require,module,exports){
;( function() {
		
	"use strict";

	App.Models.ChartDataModel = Backbone.Model.extend( {

		defaults: {},

		urlRoot: Global.rootUrl + "/data/dimensions",
		
		/*url: function(){

			var attrs = this.attributes,
				url = this.urlRoot + "?";

			//add all attributes to url
			_.each( attrs, function( v, i ) {
				url += i + "=" + v;
				url += "&";
			} );

			return url;

		},*/

		initialize: function () {

		},

	} );

	module.exports = App.Models.ChartDataModel;

})();
},{}],3:[function(require,module,exports){
;( function() {
	
	"use strict";

	var ImportView = require( "./App.Views.ImportView.js" );
	
	App.Views.Form = Backbone.View.extend({

		events: {},

		initialize: function() {},

		start: function() {
			//render everything for the first time
			this.render();
		},

		render: function() {
			
			var dispatcher = _.clone( Backbone.Events );
			this.dispatcher = dispatcher;

			this.importView = new ImportView( {dispatcher: dispatcher } );
			
		}

	});

	module.exports = App.Views.Import;

})();

},{"./App.Views.ImportView.js":4}],4:[function(require,module,exports){
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
},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9sYXJhdmVsLWVsaXhpci1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC9JbXBvcnRBcHAuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC9tb2RlbHMvQXBwLk1vZGVscy5DaGFydERhdGFNb2RlbC5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL0FwcC5WaWV3cy5JbXBvcnQuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy9BcHAuVmlld3MuSW1wb3J0Vmlldy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiOyggZnVuY3Rpb24oKSB7XG5cdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgSW1wb3J0ID0gcmVxdWlyZSggXCIuL3ZpZXdzL0FwcC5WaWV3cy5JbXBvcnQuanNcIiApLFxuXHRcdENoYXJ0RGF0YU1vZGVsID0gcmVxdWlyZSggXCIuL21vZGVscy9BcHAuTW9kZWxzLkNoYXJ0RGF0YU1vZGVsLmpzXCIgKTtcblxuXHQvL3NldHVwIG1vZGVsc1xuXHQvL2lzIG5ldyBjaGFydCBvciBkaXNwbGF5IG9sZCBjaGFydFxuXHR2YXIgJGNoYXJ0U2hvd1dyYXBwZXIgPSAkKCBcIi5jaGFydC1zaG93LXdyYXBwZXIsIC5jaGFydC1lZGl0LXdyYXBwZXJcIiApLFxuXHRcdGNoYXJ0SWQgPSAkY2hhcnRTaG93V3JhcHBlci5hdHRyKCBcImRhdGEtY2hhcnQtaWRcIiApO1xuXG5cdC8vc2V0dXAgdmlld3Ncblx0QXBwLlZpZXcgPSBuZXcgSW1wb3J0KCk7XG5cblx0aWYoICRjaGFydFNob3dXcmFwcGVyLmxlbmd0aCAmJiBjaGFydElkICkge1xuXHRcdFxuXHRcdC8vc2hvd2luZyBleGlzdGluZyBjaGFydFxuXHRcdEFwcC5DaGFydE1vZGVsID0gbmV3IEFwcC5Nb2RlbHMuQ2hhcnRNb2RlbCggeyBpZDogY2hhcnRJZCB9ICk7XG5cdFx0QXBwLkNoYXJ0TW9kZWwuZmV0Y2goIHtcblx0XHRcdHN1Y2Nlc3M6IGZ1bmN0aW9uKCBkYXRhICkge1xuXHRcdFx0XHRBcHAuVmlldy5zdGFydCgpO1xuXHRcdFx0fSxcblx0XHRcdGVycm9yOiBmdW5jdGlvbiggeGhyICkge1xuXHRcdFx0XHRjb25zb2xlLmVycm9yKCBcIkVycm9yIGxvYWRpbmcgY2hhcnQgbW9kZWxcIiwgeGhyICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHRcdC8vZmluZCBvdXQgaWYgaXQncyBpbiBjYWNoZVxuXHRcdGlmKCAhJCggXCIuc3RhbmRhbG9uZS1jaGFydC12aWV3ZXJcIiApLmxlbmd0aCApIHtcblx0XHRcdC8vZGlzYWJsZSBjYWNoaW5nIGZvciB2aWV3aW5nIHdpdGhpbiBhZG1pblxuXHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0KCBcImNhY2hlXCIsIGZhbHNlICk7XG5cdFx0fVxuXHRcdFxuXHR9IGVsc2Uge1xuXG5cdFx0Ly9pcyBuZXcgY2hhcnRcblx0XHRBcHAuQ2hhcnRNb2RlbCA9IG5ldyBBcHAuTW9kZWxzLkNoYXJ0TW9kZWwoKTtcblx0XHRBcHAuVmlldy5zdGFydCgpO1xuXG5cdH1cblxuXHRcblx0XG5cbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdEFwcC5Nb2RlbHMuQ2hhcnREYXRhTW9kZWwgPSBCYWNrYm9uZS5Nb2RlbC5leHRlbmQoIHtcblxuXHRcdGRlZmF1bHRzOiB7fSxcblxuXHRcdHVybFJvb3Q6IEdsb2JhbC5yb290VXJsICsgXCIvZGF0YS9kaW1lbnNpb25zXCIsXG5cdFx0XG5cdFx0Lyp1cmw6IGZ1bmN0aW9uKCl7XG5cblx0XHRcdHZhciBhdHRycyA9IHRoaXMuYXR0cmlidXRlcyxcblx0XHRcdFx0dXJsID0gdGhpcy51cmxSb290ICsgXCI/XCI7XG5cblx0XHRcdC8vYWRkIGFsbCBhdHRyaWJ1dGVzIHRvIHVybFxuXHRcdFx0Xy5lYWNoKCBhdHRycywgZnVuY3Rpb24oIHYsIGkgKSB7XG5cdFx0XHRcdHVybCArPSBpICsgXCI9XCIgKyB2O1xuXHRcdFx0XHR1cmwgKz0gXCImXCI7XG5cdFx0XHR9ICk7XG5cblx0XHRcdHJldHVybiB1cmw7XG5cblx0XHR9LCovXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiAoKSB7XG5cblx0XHR9LFxuXG5cdH0gKTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5Nb2RlbHMuQ2hhcnREYXRhTW9kZWw7XG5cbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgSW1wb3J0VmlldyA9IHJlcXVpcmUoIFwiLi9BcHAuVmlld3MuSW1wb3J0Vmlldy5qc1wiICk7XG5cdFxuXHRBcHAuVmlld3MuRm9ybSA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblxuXHRcdGV2ZW50czoge30sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbigpIHt9LFxuXG5cdFx0c3RhcnQ6IGZ1bmN0aW9uKCkge1xuXHRcdFx0Ly9yZW5kZXIgZXZlcnl0aGluZyBmb3IgdGhlIGZpcnN0IHRpbWVcblx0XHRcdHRoaXMucmVuZGVyKCk7XG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcblx0XHRcdHZhciBkaXNwYXRjaGVyID0gXy5jbG9uZSggQmFja2JvbmUuRXZlbnRzICk7XG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIgPSBkaXNwYXRjaGVyO1xuXG5cdFx0XHR0aGlzLmltcG9ydFZpZXcgPSBuZXcgSW1wb3J0Vmlldygge2Rpc3BhdGNoZXI6IGRpc3BhdGNoZXIgfSApO1xuXHRcdFx0XG5cdFx0fVxuXG5cdH0pO1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkltcG9ydDtcblxufSkoKTtcbiIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0QXBwLlZpZXdzLkltcG9ydFZpZXcgPSBCYWNrYm9uZS5WaWV3LmV4dGVuZCh7XG5cblx0XHRkYXRhc2V0TmFtZTogXCJcIixcblx0XHRpc0RhdGFNdWx0aVZhcmlhbnQ6IGZhbHNlLFxuXHRcdG9yaWdVcGxvYWRlZERhdGE6IGZhbHNlLFxuXHRcdHVwbG9hZGVkRGF0YTogZmFsc2UsXG5cdFx0dmFyaWFibGVOYW1lTWFudWFsOiBmYWxzZSxcblxuXHRcdGVsOiBcIiNpbXBvcnQtdmlld1wiLFxuXHRcdGV2ZW50czoge1xuXHRcdFx0XCJzdWJtaXQgZm9ybVwiOiBcIm9uRm9ybVN1Ym1pdFwiLFxuXHRcdFx0XCJpbnB1dCBbbmFtZT1uZXdfZGF0YXNldF9uYW1lXVwiOiBcIm9uTmV3RGF0YXNldE5hbWVDaGFuZ2VcIixcblx0XHRcdFwiY2hhbmdlIFtuYW1lPW5ld19kYXRhc2V0XVwiOiBcIm9uTmV3RGF0YXNldENoYW5nZVwiLFxuXHRcdFx0XCJjbGljayAucmVtb3ZlLXVwbG9hZGVkLWZpbGUtYnRuXCI6IFwib25SZW1vdmVVcGxvYWRlZEZpbGVcIixcblx0XHRcdFwiY2hhbmdlIFtuYW1lPWNhdGVnb3J5X2lkXVwiOiBcIm9uQ2F0ZWdvcnlDaGFuZ2VcIixcblx0XHRcdFwiY2hhbmdlIFtuYW1lPWV4aXN0aW5nX2RhdGFzZXRfaWRdXCI6IFwib25FeGlzdGluZ0RhdGFzZXRDaGFuZ2VcIixcblx0XHRcdFwiY2hhbmdlIFtuYW1lPWRhdGFzb3VyY2VfaWRdXCI6IFwib25EYXRhc291cmNlQ2hhbmdlXCIsXG5cdFx0XHRcImNoYW5nZSBbbmFtZT1leGlzdGluZ192YXJpYWJsZV9pZF1cIjogXCJvbkV4aXN0aW5nVmFyaWFibGVDaGFuZ2VcIixcblx0XHRcdFwiY2hhbmdlIFtuYW1lPXN1YmNhdGVnb3J5X2lkXVwiOiBcIm9uU3ViQ2F0ZWdvcnlDaGFuZ2VcIixcblx0XHRcdFwiY2hhbmdlIFtuYW1lPW11bHRpdmFyaWFudF9kYXRhc2V0XVwiOiBcIm9uTXVsdGl2YXJpYW50RGF0YXNldENoYW5nZVwiLFxuXHRcdFx0XCJjbGljayAubmV3LWRhdGFzZXQtZGVzY3JpcHRpb24tYnRuXCI6IFwib25EYXRhc2V0RGVzY3JpcHRpb25cIlxuXHRcdH0sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdFxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gb3B0aW9ucy5kaXNwYXRjaGVyO1xuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblx0XHRcdHRoaXMuaW5pdFVwbG9hZCgpO1xuXG5cdFx0XHQvKnZhciBpbXBvcnRlciA9IG5ldyBBcHAuTW9kZWxzLkltcG9ydGVyKCk7XG5cdFx0XHRpbXBvcnRlci51cGxvYWRGb3JtRGF0YSgpOyovXG5cblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblxuXHRcdFx0Ly9zZWN0aW9uc1xuXHRcdFx0dGhpcy4kZGF0YXNldFNlY3Rpb24gPSB0aGlzLiRlbC5maW5kKCBcIi5kYXRhc2V0LXNlY3Rpb25cIiApO1xuXHRcdFx0dGhpcy4kZGF0YXNldFR5cGVTZWN0aW9uID0gdGhpcy4kZWwuZmluZCggXCIuZGF0YXNldC10eXBlLXNlY3Rpb25cIiApO1xuXHRcdFx0dGhpcy4kdXBsb2FkU2VjdGlvbiA9IHRoaXMuJGVsLmZpbmQoIFwiLnVwbG9hZC1zZWN0aW9uXCIgKTtcblx0XHRcdHRoaXMuJHZhcmlhYmxlU2VjdGlvbiA9IHRoaXMuJGVsLmZpbmQoIFwiLnZhcmlhYmxlcy1zZWN0aW9uXCIgKTtcblx0XHRcdHRoaXMuJGNhdGVnb3J5U2VjdGlvbiA9IHRoaXMuJGVsLmZpbmQoIFwiLmNhdGVnb3J5LXNlY3Rpb25cIiApO1xuXHRcdFx0dGhpcy4kdmFyaWFibGVUeXBlU2VjdGlvbiA9IHRoaXMuJGVsLmZpbmQoIFwiLnZhcmlhYmxlLXR5cGUtc2VjdGlvblwiICk7XG5cdFx0XHRcdFxuXHRcdFx0Ly9yYW5kb20gZWxzXG5cdFx0XHR0aGlzLiRuZXdEYXRhc2V0RGVzY3JpcHRpb24gPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPW5ld19kYXRhc2V0X2Rlc2NyaXB0aW9uXVwiICk7XG5cdFx0XHR0aGlzLiRleGlzdGluZ0RhdGFzZXRTZWxlY3QgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPWV4aXN0aW5nX2RhdGFzZXRfaWRdXCIgKTtcblx0XHRcdHRoaXMuJGV4aXN0aW5nVmFyaWFibGVzV3JhcHBlciA9IHRoaXMuJGVsLmZpbmQoIFwiLmV4aXN0aW5nLXZhcmlhYmxlLXdyYXBwZXJcIiApO1xuXHRcdFx0dGhpcy4kZXhpc3RpbmdWYXJpYWJsZXNTZWxlY3QgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPWV4aXN0aW5nX3ZhcmlhYmxlX2lkXVwiICk7XG5cdFx0XHR0aGlzLiR2YXJpYWJsZVNlY3Rpb25MaXN0ID0gdGhpcy4kdmFyaWFibGVTZWN0aW9uLmZpbmQoIFwib2xcIiApO1xuXG5cdFx0XHQvL2ltcG9ydCBzZWN0aW9uXG5cdFx0XHR0aGlzLiRmaWxlUGlja2VyID0gdGhpcy4kZWwuZmluZCggXCIuZmlsZS1waWNrZXItd3JhcHBlciBbdHlwZT1maWxlXVwiICk7XG5cdFx0XHR0aGlzLiRkYXRhSW5wdXQgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPWRhdGFdXCIgKTtcblx0XHRcdFxuXHRcdFx0dGhpcy4kY3N2SW1wb3J0UmVzdWx0ID0gdGhpcy4kZWwuZmluZCggXCIuY3N2LWltcG9ydC1yZXN1bHRcIiApO1xuXHRcdFx0dGhpcy4kY3N2SW1wb3J0VGFibGVXcmFwcGVyID0gdGhpcy4kZWwuZmluZCggXCIjY3N2LWltcG9ydC10YWJsZS13cmFwcGVyXCIgKTtcblx0XHRcdFxuXHRcdFx0dGhpcy4kbmV3RGF0YXNldFNlY3Rpb24gPSB0aGlzLiRlbC5maW5kKCBcIi5uZXctZGF0YXNldC1zZWN0aW9uXCIgKTtcblx0XHRcdHRoaXMuJGV4aXN0aW5nRGF0YXNldFNlY3Rpb24gPSB0aGlzLiRlbC5maW5kKCBcIi5leGlzdGluZy1kYXRhc2V0LXNlY3Rpb25cIiApO1xuXHRcdFx0dGhpcy4kcmVtb3ZlVXBsb2FkZWRGaWxlQnRuID0gdGhpcy4kZWwuZmluZCggXCIucmVtb3ZlLXVwbG9hZGVkLWZpbGUtYnRuXCIgKTtcblxuXHRcdFx0Ly9kYXRhc291cmNlIHNlY3Rpb25cblx0XHRcdHRoaXMuJG5ld0RhdGFzb3VyY2VXcmFwcGVyID0gdGhpcy4kZWwuZmluZCggXCIubmV3LWRhdGFzb3VyY2Utd3JhcHBlclwiICk7XG5cdFx0XHR0aGlzLiRzb3VyY2VEZXNjcmlwdGlvbiA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9c291cmNlX2Rlc2NyaXB0aW9uXVwiICk7XG5cblx0XHRcdC8vY2F0ZWdvcnkgc2VjdGlvblxuXHRcdFx0dGhpcy4kY2F0ZWdvcnlTZWxlY3QgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPWNhdGVnb3J5X2lkXVwiICk7XG5cdFx0XHR0aGlzLiRzdWJjYXRlZ29yeVNlbGVjdCA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9c3ViY2F0ZWdvcnlfaWRdXCIgKTtcblxuXHRcdFx0Ly9oaWRlIG9wdGlvbmFsIGVsZW1lbnRzXG5cdFx0XHR0aGlzLiRuZXdEYXRhc2V0RGVzY3JpcHRpb24uaGlkZSgpO1xuXHRcdFx0Ly90aGlzLiR2YXJpYWJsZVNlY3Rpb24uaGlkZSgpO1xuXG5cdFx0fSxcblxuXHRcdGluaXRVcGxvYWQ6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0XHR0aGlzLiRmaWxlUGlja2VyLm9uKCBcImNoYW5nZVwiLCBmdW5jdGlvbiggaSwgdiApIHtcblxuXHRcdFx0XHR2YXIgJHRoaXMgPSAkKCB0aGlzICk7XG5cdFx0XHRcdCR0aGlzLnBhcnNlKCB7XG5cdFx0XHRcdFx0Y29uZmlnOiB7XG5cdFx0XHRcdFx0XHRjb21wbGV0ZTogZnVuY3Rpb24oIG9iaiApIHtcblx0XHRcdFx0XHRcdFx0dmFyIGRhdGEgPSB7IHJvd3M6IG9iai5kYXRhIH07XG5cdFx0XHRcdFx0XHRcdHRoYXQub25Dc3ZTZWxlY3RlZCggbnVsbCwgZGF0YSApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSApO1xuXG5cdFx0XHR9ICk7XG5cblx0XHRcdC8qQ1NWLmJlZ2luKCB0aGlzLiRmaWxlUGlja2VyLnNlbGVjdG9yIClcblx0XHRcdFx0Ly8udGFibGUoIFwiY3N2LWltcG9ydC10YWJsZS13cmFwcGVyXCIsIHsgaGVhZGVyOjEsIGNhcHRpb246IFwiXCIgfSApXG5cdFx0XHRcdC5nbyggZnVuY3Rpb24oIGVyciwgZGF0YSApIHtcblx0XHRcdFx0XHR0aGF0Lm9uQ3N2U2VsZWN0ZWQoIGVyciwgZGF0YSApO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR0aGlzLiRyZW1vdmVVcGxvYWRlZEZpbGVCdG4uaGlkZSgpOyovXG5cblx0XHR9LFxuXG5cdFx0b25Dc3ZTZWxlY3RlZDogZnVuY3Rpb24oIGVyciwgZGF0YSApIHtcblx0XHRcdFxuXHRcdFx0aWYoICFkYXRhICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdC8vdGVzdGluZyBtYXNzaXZlIGltcG9ydCB2ZXJzaW9uIFx0XHRcdFxuXHRcdFx0Lyp0aGlzLnVwbG9hZGVkRGF0YSA9IGRhdGE7XG5cdFx0XHQvL3N0b3JlIGFsc28gb3JpZ2luYWwsIHRoaXMudXBsb2FkZWREYXRhIHdpbGwgYmUgbW9kaWZpZWQgd2hlbiBiZWluZyB2YWxpZGF0ZWRcblx0XHRcdHRoaXMub3JpZ1VwbG9hZGVkRGF0YSA9ICQuZXh0ZW5kKCB0cnVlLCB7fSwgdGhpcy51cGxvYWRlZERhdGEpO1xuXG5cdFx0XHR0aGlzLmNyZWF0ZURhdGFUYWJsZSggZGF0YS5yb3dzICk7XG5cdFx0XHRcblx0XHRcdHRoaXMudmFsaWRhdGVFbnRpdHlEYXRhKCBkYXRhLnJvd3MgKTtcblx0XHRcdHRoaXMudmFsaWRhdGVUaW1lRGF0YSggZGF0YS5yb3dzICk7XG5cdFx0XHRcblx0XHRcdHRoaXMubWFwRGF0YSgpOyovXG5cblx0XHRcdC8vbm9ybWFsIHZlcnNpb25cblxuXHRcdFx0Ly9kbyB3ZSBuZWVkIHRvIHRyYW5zcG9zZSBkYXRhP1xuXHRcdFx0aWYoICF0aGlzLmlzRGF0YU11bHRpVmFyaWFudCApIHtcblx0XHRcdFx0dmFyIGlzT3JpZW50ZWQgPSB0aGlzLmRldGVjdE9yaWVudGF0aW9uKCBkYXRhLnJvd3MgKTtcblx0XHRcdFx0aWYoICFpc09yaWVudGVkICkge1xuXHRcdFx0XHRcdGRhdGEucm93cyA9IEFwcC5VdGlscy50cmFuc3Bvc2UoIGRhdGEucm93cyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdHRoaXMudXBsb2FkZWREYXRhID0gZGF0YTtcblx0XHRcdC8vc3RvcmUgYWxzbyBvcmlnaW5hbCwgdGhpcy51cGxvYWRlZERhdGEgd2lsbCBiZSBtb2RpZmllZCB3aGVuIGJlaW5nIHZhbGlkYXRlZFxuXHRcdFx0dGhpcy5vcmlnVXBsb2FkZWREYXRhID0gJC5leHRlbmQoIHRydWUsIHt9LCB0aGlzLnVwbG9hZGVkRGF0YSk7XG5cdFx0XHRcblx0XHRcdHRoaXMuY3JlYXRlRGF0YVRhYmxlKCBkYXRhLnJvd3MgKTtcblxuXHRcdFx0dGhpcy52YWxpZGF0ZUVudGl0eURhdGEoIGRhdGEucm93cyApO1xuXHRcdFx0dGhpcy52YWxpZGF0ZVRpbWVEYXRhKCBkYXRhLnJvd3MgKTtcblxuXHRcdFx0dGhpcy5tYXBEYXRhKCk7XG5cblx0XHR9LFxuXG5cdFx0ZGV0ZWN0T3JpZW50YXRpb246IGZ1bmN0aW9uKCBkYXRhICkge1xuXG5cdFx0XHR2YXIgaXNPcmllbnRlZCA9IHRydWU7XG5cblx0XHRcdC8vZmlyc3Qgcm93LCBzZWNvbmQgY2VsbCwgc2hvdWxkIGJlIG51bWJlciAodGltZSlcblx0XHRcdGlmKCBkYXRhLmxlbmd0aCA+IDAgJiYgZGF0YVswXS5sZW5ndGggPiAwICkge1xuXHRcdFx0XHR2YXIgc2Vjb25kQ2VsbCA9IGRhdGFbIDAgXVsgMSBdO1xuXHRcdFx0XHRpZiggaXNOYU4oIHNlY29uZENlbGwgKSApIHtcblx0XHRcdFx0XHRpc09yaWVudGVkID0gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGlzT3JpZW50ZWQ7XG5cblx0XHR9LFxuXG5cdFx0Y3JlYXRlRGF0YVRhYmxlOiBmdW5jdGlvbiggZGF0YSApIHtcblxuXHRcdFx0dmFyIHRhYmxlU3RyaW5nID0gXCI8dGFibGU+XCI7XG5cblx0XHRcdF8uZWFjaCggZGF0YSwgZnVuY3Rpb24oIHJvd0RhdGEsIHJvd0luZGV4ICkge1xuXG5cdFx0XHRcdHZhciB0ciA9IFwiPHRyPlwiO1xuXHRcdFx0XHRfLmVhY2goIHJvd0RhdGEsIGZ1bmN0aW9uKCBjZWxsRGF0YSwgY2VsbEluZGV4ICkge1xuXHRcdFx0XHRcdC8vaWYoY2VsbERhdGEpIHtcblx0XHRcdFx0XHRcdHZhciB0ZCA9IChyb3dJbmRleCA+IDApPyBcIjx0ZD5cIiArIGNlbGxEYXRhICsgXCI8L3RkPlwiOiBcIjx0aD5cIiArIGNlbGxEYXRhICsgXCI8L3RoPlwiO1xuXHRcdFx0XHRcdFx0dHIgKz0gdGQ7XG5cdFx0XHRcdFx0Ly99XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0dHIgKz0gXCI8L3RyPlwiO1xuXHRcdFx0XHR0YWJsZVN0cmluZyArPSB0cjtcblxuXHRcdFx0fSApO1xuXG5cdFx0XHR0YWJsZVN0cmluZyArPSBcIjwvdGFibGU+XCI7XG5cblx0XHRcdHZhciAkdGFibGUgPSAkKCB0YWJsZVN0cmluZyApO1xuXHRcdFx0dGhpcy4kY3N2SW1wb3J0VGFibGVXcmFwcGVyLmFwcGVuZCggJHRhYmxlICk7XG5cblx0XHR9LFxuXG5cdFx0dXBkYXRlVmFyaWFibGVMaXN0OiBmdW5jdGlvbiggZGF0YSApIHtcblxuXHRcdFx0dmFyICRsaXN0ID0gdGhpcy4kdmFyaWFibGVTZWN0aW9uTGlzdDtcblx0XHRcdCRsaXN0LmVtcHR5KCk7XG5cdFx0XHRcblx0XHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRcdGlmKCBkYXRhICYmIGRhdGEudmFyaWFibGVzICkge1xuXHRcdFx0XHRfLmVhY2goIGRhdGEudmFyaWFibGVzLCBmdW5jdGlvbiggdiwgayApIHtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHQvL2lmIHdlJ3JlIGNyZWF0aW5nIG5ldyB2YXJpYWJsZXMgaW5qZWN0cyBpbnRvIGRhdGEgb2JqZWN0IGV4aXN0aW5nIHZhcmlhYmxlc1xuXHRcdFx0XHRcdGlmKCB0aGF0LmV4aXN0aW5nVmFyaWFibGUgJiYgdGhhdC5leGlzdGluZ1ZhcmlhYmxlLmF0dHIoIFwiZGF0YS1pZFwiICkgPiAwICkge1xuXHRcdFx0XHRcdFx0di5pZCA9IHRoYXQuZXhpc3RpbmdWYXJpYWJsZS5hdHRyKCBcImRhdGEtaWRcIiApO1xuXHRcdFx0XHRcdFx0di5uYW1lID0gdGhhdC5leGlzdGluZ1ZhcmlhYmxlLmF0dHIoIFwiZGF0YS1uYW1lXCIgKTtcblx0XHRcdFx0XHRcdHYudW5pdCA9IHRoYXQuZXhpc3RpbmdWYXJpYWJsZS5hdHRyKCBcImRhdGEtdW5pdFwiICk7XG5cdFx0XHRcdFx0XHR2LmRlc2NyaXB0aW9uID0gdGhhdC5leGlzdGluZ1ZhcmlhYmxlLmF0dHIoIFwiZGF0YS1kZXNjcmlwdGlvblwiICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHZhciAkbGkgPSB0aGF0LmNyZWF0ZVZhcmlhYmxlRWwoIHYgKTtcblx0XHRcdFx0XHQkbGlzdC5hcHBlbmQoICRsaSApO1xuXHRcdFx0XHRcblx0XHRcdFx0fSApO1xuXHRcdFx0fVxuXG5cdFx0fSxcblxuXHRcdGNyZWF0ZVZhcmlhYmxlRWw6IGZ1bmN0aW9uKCBkYXRhICkge1xuXG5cdFx0XHRpZiggIWRhdGEudW5pdCApIHtcblx0XHRcdFx0ZGF0YS51bml0ID0gXCJcIjtcblx0XHRcdH1cblx0XHRcdGlmKCAhZGF0YS5kZXNjcmlwdGlvbiApIHtcblx0XHRcdFx0ZGF0YS5kZXNjcmlwdGlvbiA9IFwiXCI7XG5cdFx0XHR9XG5cblx0XHRcdHZhciBzdHJpbmdpZmllZCA9IEpTT04uc3RyaW5naWZ5KCBkYXRhICk7XG5cdFx0XHQvL3dlaXJkIGJlaGF2aW91ciB3aGVuIHNpbmdsZSBxdW90ZSBpbnNlcnRlZCBpbnRvIGhpZGRlbiBpbnB1dFxuXHRcdFx0c3RyaW5naWZpZWQgPSBzdHJpbmdpZmllZC5yZXBsYWNlKCBcIidcIiwgXCImI3gwMDAyNztcIiApO1xuXHRcdFx0c3RyaW5naWZpZWQgPSBzdHJpbmdpZmllZC5yZXBsYWNlKCBcIidcIiwgXCImI3gwMDAyNztcIiApO1xuXHRcdFx0XG5cdFx0XHR2YXIgJGxpID0gJCggXCI8bGkgY2xhc3M9J3ZhcmlhYmxlLWl0ZW0gY2xlYXJmaXgnPjwvbGk+XCIgKSxcblx0XHRcdFx0JGlucHV0TmFtZSA9ICQoIFwiPGxhYmVsPk5hbWUqPGlucHV0IGNsYXNzPSdmb3JtLWNvbnRyb2wnIHZhbHVlPSdcIiArIGRhdGEubmFtZSArIFwiJyBwbGFjZWhvbGRlcj0nRW50ZXIgdmFyaWFibGUgbmFtZScvPjwvbGFiZWw+XCIgKSxcblx0XHRcdFx0JGlucHV0VW5pdCA9ICQoIFwiPGxhYmVsPlVuaXQ8aW5wdXQgY2xhc3M9J2Zvcm0tY29udHJvbCcgdmFsdWU9J1wiICsgZGF0YS51bml0ICsgXCInIHBsYWNlaG9sZGVyPSdFbnRlciB2YXJpYWJsZSB1bml0JyAvPjwvbGFiZWw+XCIgKSxcblx0XHRcdFx0JGlucHV0RGVzY3JpcHRpb24gPSAkKCBcIjxsYWJlbD5EZXNjcmlwdGlvbjxpbnB1dCBjbGFzcz0nZm9ybS1jb250cm9sJyB2YWx1ZT0nXCIgKyBkYXRhLmRlc2NyaXB0aW9uICsgXCInIHBsYWNlaG9sZGVyPSdFbnRlciB2YXJpYWJsZSBkZXNjcmlwdGlvbicgLz48L2xhYmVsPlwiICksXG5cdFx0XHRcdCRpbnB1dERhdGEgPSAkKCBcIjxpbnB1dCB0eXBlPSdoaWRkZW4nIG5hbWU9J3ZhcmlhYmxlc1tdJyB2YWx1ZT0nXCIgKyBzdHJpbmdpZmllZCArIFwiJyAvPlwiICk7XG5cdFx0XHRcblx0XHRcdCRsaS5hcHBlbmQoICRpbnB1dE5hbWUgKTtcblx0XHRcdCRsaS5hcHBlbmQoICRpbnB1dFVuaXQgKTtcblx0XHRcdCRsaS5hcHBlbmQoICRpbnB1dERlc2NyaXB0aW9uICk7XG5cdFx0XHQkbGkuYXBwZW5kKCAkaW5wdXREYXRhICk7XG5cdFx0XHRcdFxuXHRcdFx0dmFyIHRoYXQgPSB0aGlzLFxuXHRcdFx0XHQkaW5wdXRzID0gJGxpLmZpbmQoIFwiaW5wdXRcIiApO1xuXHRcdFx0JGlucHV0cy5vbiggXCJpbnB1dFwiLCBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0XHQvL3VwZGF0ZSBzdG9yZWQganNvblxuXHRcdFx0XHR2YXIganNvbiA9ICQucGFyc2VKU09OKCAkaW5wdXREYXRhLnZhbCgpICk7XG5cdFx0XHRcdGpzb24ubmFtZSA9ICRpbnB1dE5hbWUuZmluZCggXCJpbnB1dFwiICkudmFsKCk7XG5cdFx0XHRcdGpzb24udW5pdCA9ICRpbnB1dFVuaXQuZmluZCggXCJpbnB1dFwiICkudmFsKCk7XG5cdFx0XHRcdGpzb24uZGVzY3JpcHRpb24gPSAkaW5wdXREZXNjcmlwdGlvbi5maW5kKCBcImlucHV0XCIgKS52YWwoKTtcblx0XHRcdFx0JGlucHV0RGF0YS52YWwoIEpTT04uc3RyaW5naWZ5KCBqc29uICkgKTtcblx0XHRcdH0gKTtcblx0XHRcdCRpbnB1dHMub24oIFwiZm9jdXNcIiwgZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdFx0Ly9zZXQgZmxhZyBzbyB0aGF0IHZhbHVlcyBpbiBpbnB1dCB3b24ndCBnZXQgb3ZlcndyaXR0ZW4gYnkgY2hhbmdlcyB0byBkYXRhc2V0IG5hbWVcblx0XHRcdFx0dGhhdC52YXJpYWJsZU5hbWVNYW51YWwgPSB0cnVlO1xuXHRcdFx0fSk7XG5cblx0XHRcdHJldHVybiAkbGk7XG5cblx0XHR9LFxuXG5cdFx0bWFwRGF0YTogZnVuY3Rpb24oKSB7XG5cblx0XHRcdFxuXHRcdFx0Ly9tYXNzaXZlIGltcG9ydCB2ZXJzaW9uXG5cdFx0XHQvL3ZhciBtYXBwZWREYXRhID0gQXBwLlV0aWxzLm1hcFBhbmVsRGF0YSggdGhpcy51cGxvYWRlZERhdGEucm93cyApLFxuXHRcdFx0dmFyIG1hcHBlZERhdGEgPSAoICF0aGlzLmlzRGF0YU11bHRpVmFyaWFudCApPyAgQXBwLlV0aWxzLm1hcFNpbmdsZVZhcmlhbnREYXRhKCB0aGlzLnVwbG9hZGVkRGF0YS5yb3dzLCB0aGlzLmRhdGFzZXROYW1lICk6IEFwcC5VdGlscy5tYXBNdWx0aVZhcmlhbnREYXRhKCB0aGlzLnVwbG9hZGVkRGF0YS5yb3dzICksXG5cdFx0XHRcdGpzb24gPSB7IFwidmFyaWFibGVzXCI6IG1hcHBlZERhdGEgfSxcblx0XHRcdFx0anNvblN0cmluZyA9IEpTT04uc3RyaW5naWZ5KCBqc29uICk7XG5cblx0XHRcdHRoaXMuJGRhdGFJbnB1dC52YWwoIGpzb25TdHJpbmcgKTtcblx0XHRcdHRoaXMuJHJlbW92ZVVwbG9hZGVkRmlsZUJ0bi5zaG93KCk7XG5cblx0XHRcdHRoaXMudXBkYXRlVmFyaWFibGVMaXN0KCBqc29uICk7XG5cblx0XHR9LFxuXG5cdFx0dmFsaWRhdGVFbnRpdHlEYXRhOiBmdW5jdGlvbiggZGF0YSApIHtcblxuXHRcdFx0LyppZiggdGhpcy5pc0RhdGFNdWx0aVZhcmlhbnQgKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fSovXG5cblx0XHRcdC8vdmFsaWRhdGVFbnRpdHlEYXRhIGRvZXNuJ3QgbW9kaWZ5IHRoZSBvcmlnaW5hbCBkYXRhXG5cdFx0XHR2YXIgJGRhdGFUYWJsZVdyYXBwZXIgPSAkKCBcIi5jc3YtaW1wb3J0LXRhYmxlLXdyYXBwZXJcIiApLFxuXHRcdFx0XHQkZGF0YVRhYmxlID0gJGRhdGFUYWJsZVdyYXBwZXIuZmluZCggXCJ0YWJsZVwiICksXG5cdFx0XHRcdCRlbnRpdGllc0NlbGxzID0gJGRhdGFUYWJsZS5maW5kKCBcInRkOmZpcnN0LWNoaWxkXCIgKSxcblx0XHRcdFx0Ly8kZW50aXRpZXNDZWxscyA9ICRkYXRhVGFibGUuZmluZCggXCJ0aFwiICksXG5cdFx0XHRcdGVudGl0aWVzID0gXy5tYXAoICRlbnRpdGllc0NlbGxzLCBmdW5jdGlvbiggdiApIHsgcmV0dXJuICQoIHYgKS50ZXh0KCk7IH0gKTtcblxuXHRcdFx0Ly9tYWtlIHN1cmUgd2UncmUgbm90IHZhbGlkYXRpbmcgb25lIGVudGl0eSBtdWx0aXBsZSB0aW1lc1xuXHRcdFx0ZW50aXRpZXMgPSBfLnVuaXEoIGVudGl0aWVzICk7XG5cdFx0XHRcblx0XHRcdC8vZ2V0IHJpZCBvZiBmaXJzdCBvbmUgKHRpbWUgbGFiZWwpXG5cdFx0XHQvL2VudGl0aWVzLnNoaWZ0KCk7XG5cblx0XHRcdCQuYWpheCgge1xuXHRcdFx0XHR1cmw6IEdsb2JhbC5yb290VXJsICsgXCIvZW50aXR5SXNvTmFtZXMvdmFsaWRhdGVEYXRhXCIsXG5cdFx0XHRcdGRhdGE6IHsgXCJlbnRpdGllc1wiOiBKU09OLnN0cmluZ2lmeSggZW50aXRpZXMgKSB9LFxuXHRcdFx0XHRiZWZvcmVTZW5kOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHQkZGF0YVRhYmxlV3JhcHBlci5iZWZvcmUoIFwiPHAgY2xhc3M9J2VudGl0aWVzLWxvYWRpbmctbm90aWNlIGxvYWRpbmctbm90aWNlJz5WYWxpZGF0aW5nIGVudGl0aWVzPC9wPlwiICk7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHN1Y2Nlc3M6IGZ1bmN0aW9uKCByZXNwb25zZSApIHtcblx0XHRcdFx0XHRpZiggcmVzcG9uc2UuZGF0YSApIHtcblx0XHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHR2YXIgdW5tYXRjaGVkID0gcmVzcG9uc2UuZGF0YTtcblx0XHRcdFx0XHRcdCRlbnRpdGllc0NlbGxzLnJlbW92ZUNsYXNzKCBcImFsZXJ0LWVycm9yXCIgKTtcblx0XHRcdFx0XHRcdCQuZWFjaCggJGVudGl0aWVzQ2VsbHMsIGZ1bmN0aW9uKCBpLCB2ICkge1xuXHRcdFx0XHRcdFx0XHR2YXIgJGVudGl0eUNlbGwgPSAkKCB0aGlzICksXG5cdFx0XHRcdFx0XHRcdFx0dmFsdWUgPSAkZW50aXR5Q2VsbC50ZXh0KCk7XG5cdFx0XHRcdFx0XHRcdFx0JGVudGl0eUNlbGwucmVtb3ZlQ2xhc3MoIFwiYWxlcnQtZXJyb3JcIiApO1xuXHRcdFx0XHRcdFx0XHRcdCRlbnRpdHlDZWxsLmFkZENsYXNzKCBcImFsZXJ0LXN1Y2Nlc3NcIiApO1xuXHRcdFx0XHRcdFx0XHRpZiggXy5pbmRleE9mKCB1bm1hdGNoZWQsIHZhbHVlICkgPiAtMSApIHtcblx0XHRcdFx0XHRcdFx0XHQkZW50aXR5Q2VsbC5hZGRDbGFzcyggXCJhbGVydC1lcnJvclwiICk7XG5cdFx0XHRcdFx0XHRcdFx0JGVudGl0eUNlbGwucmVtb3ZlQ2xhc3MoIFwiYWxlcnQtc3VjY2Vzc1wiICk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0gKTtcblxuXHRcdFx0XHRcdFx0Ly9yZW1vdmUgcHJlbG9hZGVyXG5cdFx0XHRcdFx0XHQkKCBcIi5lbnRpdGllcy1sb2FkaW5nLW5vdGljZVwiICkucmVtb3ZlKCk7XG5cdFx0XHRcdFx0XHQvL3Jlc3VsdCBub3RpY2Vcblx0XHRcdFx0XHRcdCQoIFwiLmVudGl0aWVzLXZhbGlkYXRpb24td3JhcHBlclwiICkucmVtb3ZlKCk7XG5cdFx0XHRcdFx0XHR2YXIgJHJlc3VsdE5vdGljZSA9ICh1bm1hdGNoZWQubGVuZ3RoKT8gJCggXCI8ZGl2IGNsYXNzPSdlbnRpdGllcy12YWxpZGF0aW9uLXdyYXBwZXInPjxwIGNsYXNzPSdlbnRpdGllcy12YWxpZGF0aW9uLXJlc3VsdCB2YWxpZGF0aW9uLXJlc3VsdCB0ZXh0LWRhbmdlcic+PGkgY2xhc3M9J2ZhIGZhLWV4Y2xhbWF0aW9uLWNpcmNsZSc+PC9pPlNvbWUgY291bnRyaWVzIGRvIG5vdCBoYXZlIDxhIGhyZWY9J2h0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSVNPXzMxNjYnIHRhcmdldD0nX2JsYW5rJz5zdGFuZGFyZGl6ZWQgbmFtZTwvYT4hIFJlbmFtZSB0aGUgaGlnaGxpZ2h0ZWQgY291bnRyaWVzIGFuZCByZXVwbG9hZCBDU1YuPC9wPjxsYWJlbD48aW5wdXQgdHlwZT0nY2hlY2tib3gnIG5hbWU9J3ZhbGlkYXRlX2VudGl0aWVzJy8+SW1wb3J0IGNvdW50cmllcyBhbnl3YXk8L2xhYmVsPjwvZGl2PlwiICk6ICQoIFwiPHAgY2xhc3M9J2VudGl0aWVzLXZhbGlkYXRpb24tcmVzdWx0IHZhbGlkYXRpb24tcmVzdWx0IHRleHQtc3VjY2Vzcyc+PGkgY2xhc3M9J2ZhIGZhLWNoZWNrLWNpcmNsZSc+PC9pPkFsbCBjb3VudHJpZXMgaGF2ZSBzdGFuZGFyZGl6ZWQgbmFtZSwgd2VsbCBkb25lITwvcD5cIiApO1xuXHRcdFx0XHRcdFx0JGRhdGFUYWJsZVdyYXBwZXIuYmVmb3JlKCAkcmVzdWx0Tm90aWNlICk7XG5cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdFxuXHRcdH0sXG5cblx0XHR2YWxpZGF0ZVRpbWVEYXRhOiBmdW5jdGlvbiggZGF0YSApIHtcblxuXHRcdFx0dmFyICRkYXRhVGFibGVXcmFwcGVyID0gJCggXCIuY3N2LWltcG9ydC10YWJsZS13cmFwcGVyXCIgKSxcblx0XHRcdFx0JGRhdGFUYWJsZSA9ICRkYXRhVGFibGVXcmFwcGVyLmZpbmQoIFwidGFibGVcIiApLFxuXHRcdFx0XHQvL21hc3NpdmUgaW1wb3J0IHZlcnNpb25cblx0XHRcdFx0Ly90aW1lRG9tYWluID0gJGRhdGFUYWJsZS5maW5kKCBcInRoOm50aC1jaGlsZCgyKVwiICkudGV4dCgpLFxuXHRcdFx0XHR0aW1lRG9tYWluID0gKCAhdGhpcy5pc0RhdGFNdWx0aVZhcmlhbnQgKT8gJGRhdGFUYWJsZS5maW5kKCBcInRoOmZpcnN0LWNoaWxkXCIgKS50ZXh0KCk6ICRkYXRhVGFibGUuZmluZCggXCJ0aDpudGgtY2hpbGQoMilcIiApLnRleHQoKSxcblx0XHRcdFx0JHRpbWVzQ2VsbHMgPSAoICF0aGlzLmlzRGF0YU11bHRpVmFyaWFudCApPyAkZGF0YVRhYmxlLmZpbmQoIFwidGhcIiApOiAkZGF0YVRhYmxlLmZpbmQoIFwidGQ6bnRoLWNoaWxkKDIpXCIgKTsvKixcblx0XHRcdFx0Ly9tYXNzaXZlIGltcG9ydCB2ZXJzaW9uXG5cdFx0XHRcdC8vJHRpbWVzQ2VsbHMgPSAkZGF0YVRhYmxlLmZpbmQoIFwidGQ6bnRoLWNoaWxkKDIpXCIgKTsvKixcblx0XHRcdFx0dGltZXMgPSBfLm1hcCggJHRpbWVzQ2VsbHMsIGZ1bmN0aW9uKCB2ICkgeyByZXR1cm4gJCggdiApLnRleHQoKSB9ICk7Ki9cblx0XHRcdC8vZm9ybWF0IHRpbWUgZG9tYWluIG1heWJlXG5cdFx0XHRpZiggdGltZURvbWFpbiApIHtcblx0XHRcdFx0dGltZURvbWFpbiA9IHRpbWVEb21haW4udG9Mb3dlckNhc2UoKTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0Ly90aGUgZmlyc3QgY2VsbCAodGltZURvbWFpbikgc2hvdWxkbid0IGJlIHZhbGlkYXRlZFxuXHRcdFx0Ly9tYXNzaXZlIGltcG9ydCB2ZXJzaW9uIC0gY29tbWVudGVkIG91dCBuZXh0IHJvd1xuXHRcdFx0aWYoICF0aGlzLmlzRGF0YU11bHRpVmFyaWFudCApIHtcblx0XHRcdFx0JHRpbWVzQ2VsbHMgPSAkdGltZXNDZWxscy5zbGljZSggMSApO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHQvL21ha2Ugc3VyZSB0aW1lIGlzIGZyb20gZ2l2ZW4gZG9tYWluXG5cdFx0XHRpZiggXy5pbmRleE9mKCBbIFwiY2VudHVyeVwiLCBcImRlY2FkZVwiLCBcInF1YXJ0ZXIgY2VudHVyeVwiLCBcImhhbGYgY2VudHVyeVwiLCBcInllYXJcIiBdLCB0aW1lRG9tYWluICkgPT0gLTEgKSB7XG5cdFx0XHRcdHZhciAkcmVzdWx0Tm90aWNlID0gJCggXCI8cCBjbGFzcz0ndGltZS1kb21haW4tdmFsaWRhdGlvbi1yZXN1bHQgdmFsaWRhdGlvbi1yZXN1bHQgdGV4dC1kYW5nZXInPjxpIGNsYXNzPSdmYSBmYS1leGNsYW1hdGlvbi1jaXJjbGUnPjwvaT5GaXJzdCB0b3AtbGVmdCBjZWxsIHNob3VsZCBjb250YWluIHRpbWUgZG9tYWluIGluZm9tYXJ0aW9uLiBFaXRoZXIgJ2NlbnR1cnknLCBvcidkZWNhZGUnLCBvciAneWVhcicuPC9wPlwiICk7XG5cdFx0XHRcdCRkYXRhVGFibGVXcmFwcGVyLmJlZm9yZSggJHJlc3VsdE5vdGljZSApO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0XHQkLmVhY2goICR0aW1lc0NlbGxzLCBmdW5jdGlvbiggaSwgdiApIHtcblxuXHRcdFx0XHR2YXIgJHRpbWVDZWxsID0gJCggdiApO1xuXHRcdFx0XHRcblx0XHRcdFx0Ly9maW5kIGNvcnJlc3BvbmRpbmcgdmFsdWUgaW4gbG9hZGVkIGRhdGFcblx0XHRcdFx0dmFyIG5ld1ZhbHVlLFxuXHRcdFx0XHRcdC8vbWFzc2l2ZSBpbXBvcnQgdmVyc2lvblxuXHRcdFx0XHRcdC8vb3JpZ1ZhbHVlID0gZGF0YVsgaSsxIF1bIDEgXTtcblx0XHRcdFx0XHRvcmlnVmFsdWUgPSAoICF0aGF0LmlzRGF0YU11bHRpVmFyaWFudCApPyBkYXRhWyAwIF1bIGkrMSBdOiBkYXRhWyBpKzEgXVsgMSBdO1xuXHRcdFx0XHRcblx0XHRcdFx0Ly9jaGVjayB2YWx1ZSBoYXMgNCBkaWdpdHNcblx0XHRcdFx0b3JpZ1ZhbHVlID0gQXBwLlV0aWxzLmFkZFplcm9zKCBvcmlnVmFsdWUgKTtcblxuXHRcdFx0XHR2YXIgdmFsdWUgPSBvcmlnVmFsdWUsXG5cdFx0XHRcdFx0ZGF0ZSA9IG1vbWVudCggbmV3IERhdGUoIHZhbHVlICkgKTtcblx0XHRcdFx0XG5cdFx0XHRcdGlmKCAhZGF0ZS5pc1ZhbGlkKCkgKSB7XG5cblx0XHRcdFx0XHQkdGltZUNlbGwuYWRkQ2xhc3MoIFwiYWxlcnQtZXJyb3JcIiApO1xuXHRcdFx0XHRcdCR0aW1lQ2VsbC5yZW1vdmVDbGFzcyggXCJhbGVydC1zdWNjZXNzXCIgKTtcblx0XHRcdFx0XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0Ly9jb3JyZWN0IGRhdGVcblx0XHRcdFx0XHQkdGltZUNlbGwuYWRkQ2xhc3MoIFwiYWxlcnQtc3VjY2Vzc1wiICk7XG5cdFx0XHRcdFx0JHRpbWVDZWxsLnJlbW92ZUNsYXNzKCBcImFsZXJ0LWVycm9yXCIgKTtcblx0XHRcdFx0XHQvL2luc2VydCBwb3RlbnRpYWxseSBtb2RpZmllZCB2YWx1ZSBpbnRvIGNlbGxcblx0XHRcdFx0XHQkdGltZUNlbGwudGV4dCggdmFsdWUgKTtcblxuXHRcdFx0XHRcdG5ld1ZhbHVlID0geyBcImRcIjogQXBwLlV0aWxzLnJvdW5kVGltZSggZGF0ZSApLCBcImxcIjogb3JpZ1ZhbHVlIH07XG5cblx0XHRcdFx0XHRpZiggdGltZURvbWFpbiA9PSBcInllYXJcIiApIHtcblx0XHRcdFx0XHRcdFxuXHRcdFx0XHRcdFx0Ly90cnkgdG8gZ3Vlc3MgY2VudHVyeVxuXHRcdFx0XHRcdFx0dmFyIHllYXIgPSBNYXRoLmZsb29yKCBvcmlnVmFsdWUgKSxcblx0XHRcdFx0XHRcdFx0bmV4dFllYXIgPSB5ZWFyICsgMTtcblxuXHRcdFx0XHRcdFx0Ly9hZGQgemVyb3Ncblx0XHRcdFx0XHRcdHllYXIgPSBBcHAuVXRpbHMuYWRkWmVyb3MoIHllYXIgKTtcblx0XHRcdFx0XHRcdG5leHRZZWFyID0gQXBwLlV0aWxzLmFkZFplcm9zKCBuZXh0WWVhciApO1xuXHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHQvL2NvbnZlcnQgaXQgdG8gZGF0ZXRpbWUgdmFsdWVzXG5cdFx0XHRcdFx0XHR5ZWFyID0gbW9tZW50KCBuZXcgRGF0ZSggeWVhci50b1N0cmluZygpICkgKTtcblx0XHRcdFx0XHRcdG5leHRZZWFyID0gbW9tZW50KCBuZXcgRGF0ZSggbmV4dFllYXIudG9TdHJpbmcoKSApICkuc2Vjb25kcygtMSk7XG5cdFx0XHRcdFx0XHQvL21vZGlmeSB0aGUgaW5pdGlhbCB2YWx1ZVxuXHRcdFx0XHRcdFx0bmV3VmFsdWVbIFwic2RcIiBdID0gIEFwcC5VdGlscy5yb3VuZFRpbWUoIHllYXIgKTtcblx0XHRcdFx0XHRcdG5ld1ZhbHVlWyBcImVkXCIgXSA9ICBBcHAuVXRpbHMucm91bmRUaW1lKCBuZXh0WWVhciApO1xuXG5cdFx0XHRcdFx0fSBlbHNlIGlmKCB0aW1lRG9tYWluID09IFwiZGVjYWRlXCIgKSB7XG5cdFx0XHRcdFx0XHRcblx0XHRcdFx0XHRcdC8vdHJ5IHRvIGd1ZXNzIGNlbnR1cnlcblx0XHRcdFx0XHRcdHZhciBkZWNhZGUgPSBNYXRoLmZsb29yKCBvcmlnVmFsdWUgLyAxMCApICogMTAsXG5cdFx0XHRcdFx0XHRcdG5leHREZWNhZGUgPSBkZWNhZGUgKyAxMDtcblx0XHRcdFx0XHRcdFxuXHRcdFx0XHRcdFx0Ly9hZGQgemVyb3Ncblx0XHRcdFx0XHRcdGRlY2FkZSA9IEFwcC5VdGlscy5hZGRaZXJvcyggZGVjYWRlICk7XG5cdFx0XHRcdFx0XHRuZXh0RGVjYWRlID0gQXBwLlV0aWxzLmFkZFplcm9zKCBuZXh0RGVjYWRlICk7XG5cblx0XHRcdFx0XHRcdC8vY29udmVydCBpdCB0byBkYXRldGltZSB2YWx1ZXNcblx0XHRcdFx0XHRcdGRlY2FkZSA9IG1vbWVudCggbmV3IERhdGUoIGRlY2FkZS50b1N0cmluZygpICkgKTtcblx0XHRcdFx0XHRcdG5leHREZWNhZGUgPSBtb21lbnQoIG5ldyBEYXRlKCBuZXh0RGVjYWRlLnRvU3RyaW5nKCkgKSApLnNlY29uZHMoLTEpO1xuXHRcdFx0XHRcdFx0Ly9tb2RpZnkgdGhlIGluaXRpYWwgdmFsdWVcblx0XHRcdFx0XHRcdG5ld1ZhbHVlWyBcInNkXCIgXSA9ICBBcHAuVXRpbHMucm91bmRUaW1lKCBkZWNhZGUgKTtcblx0XHRcdFx0XHRcdG5ld1ZhbHVlWyBcImVkXCIgXSA9ICBBcHAuVXRpbHMucm91bmRUaW1lKCBuZXh0RGVjYWRlICk7XG5cblx0XHRcdFx0XHR9IGVsc2UgaWYoIHRpbWVEb21haW4gPT0gXCJxdWFydGVyIGNlbnR1cnlcIiApIHtcblx0XHRcdFx0XHRcdFxuXHRcdFx0XHRcdFx0Ly90cnkgdG8gZ3Vlc3MgcXVhcnRlciBjZW50dXJ5XG5cdFx0XHRcdFx0XHR2YXIgY2VudHVyeSA9IE1hdGguZmxvb3IoIG9yaWdWYWx1ZSAvIDEwMCApICogMTAwLFxuXHRcdFx0XHRcdFx0XHRtb2R1bG8gPSAoIG9yaWdWYWx1ZSAlIDEwMCApLFxuXHRcdFx0XHRcdFx0XHRxdWFydGVyQ2VudHVyeTtcblx0XHRcdFx0XHRcdFxuXHRcdFx0XHRcdFx0Ly93aGljaCBxdWFydGVyIGlzIGl0XG5cdFx0XHRcdFx0XHRpZiggbW9kdWxvIDwgMjUgKSB7XG5cdFx0XHRcdFx0XHRcdHF1YXJ0ZXJDZW50dXJ5ID0gY2VudHVyeTtcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiggbW9kdWxvIDwgNTAgKSB7XG5cdFx0XHRcdFx0XHRcdHF1YXJ0ZXJDZW50dXJ5ID0gY2VudHVyeSsyNTtcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiggbW9kdWxvIDwgNzUgKSB7XG5cdFx0XHRcdFx0XHRcdHF1YXJ0ZXJDZW50dXJ5ID0gY2VudHVyeSs1MDtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHF1YXJ0ZXJDZW50dXJ5ID0gY2VudHVyeSs3NTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHR2YXIgbmV4dFF1YXJ0ZXJDZW50dXJ5ID0gcXVhcnRlckNlbnR1cnkgKyAyNTtcblxuXHRcdFx0XHRcdFx0Ly9hZGQgemVyb3Ncblx0XHRcdFx0XHRcdHF1YXJ0ZXJDZW50dXJ5ID0gQXBwLlV0aWxzLmFkZFplcm9zKCBxdWFydGVyQ2VudHVyeSApO1xuXHRcdFx0XHRcdFx0bmV4dFF1YXJ0ZXJDZW50dXJ5ID0gQXBwLlV0aWxzLmFkZFplcm9zKCBuZXh0UXVhcnRlckNlbnR1cnkgKTtcblxuXHRcdFx0XHRcdFx0Ly9jb252ZXJ0IGl0IHRvIGRhdGV0aW1lIHZhbHVlc1xuXHRcdFx0XHRcdFx0cXVhcnRlckNlbnR1cnkgPSBtb21lbnQoIG5ldyBEYXRlKCBxdWFydGVyQ2VudHVyeS50b1N0cmluZygpICkgKTtcblx0XHRcdFx0XHRcdG5leHRRdWFydGVyQ2VudHVyeSA9IG1vbWVudCggbmV3IERhdGUoIG5leHRRdWFydGVyQ2VudHVyeS50b1N0cmluZygpICkgKS5zZWNvbmRzKC0xKTtcblx0XHRcdFx0XHRcdC8vbW9kaWZ5IHRoZSBpbml0aWFsIHZhbHVlXG5cdFx0XHRcdFx0XHRuZXdWYWx1ZVsgXCJzZFwiIF0gPSAgQXBwLlV0aWxzLnJvdW5kVGltZSggcXVhcnRlckNlbnR1cnkgKTtcblx0XHRcdFx0XHRcdG5ld1ZhbHVlWyBcImVkXCIgXSA9ICBBcHAuVXRpbHMucm91bmRUaW1lKCBuZXh0UXVhcnRlckNlbnR1cnkgKTtcblxuXHRcdFx0XHRcdH0gZWxzZSBpZiggdGltZURvbWFpbiA9PSBcImhhbGYgY2VudHVyeVwiICkge1xuXHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHQvL3RyeSB0byBndWVzcyBoYWxmIGNlbnR1cnlcblx0XHRcdFx0XHRcdHZhciBjZW50dXJ5ID0gTWF0aC5mbG9vciggb3JpZ1ZhbHVlIC8gMTAwICkgKiAxMDAsXG5cdFx0XHRcdFx0XHRcdC8vaXMgaXQgZmlyc3Qgb3Igc2Vjb25kIGhhbGY/XG5cdFx0XHRcdFx0XHRcdGhhbGZDZW50dXJ5ID0gKCBvcmlnVmFsdWUgJSAxMDAgPCA1MCApPyBjZW50dXJ5OiBjZW50dXJ5KzUwLFxuXHRcdFx0XHRcdFx0XHRuZXh0SGFsZkNlbnR1cnkgPSBoYWxmQ2VudHVyeSArIDUwO1xuXG5cdFx0XHRcdFx0XHQvL2FkZCB6ZXJvc1xuXHRcdFx0XHRcdFx0aGFsZkNlbnR1cnkgPSBBcHAuVXRpbHMuYWRkWmVyb3MoIGhhbGZDZW50dXJ5ICk7XG5cdFx0XHRcdFx0XHRuZXh0SGFsZkNlbnR1cnkgPSBBcHAuVXRpbHMuYWRkWmVyb3MoIG5leHRIYWxmQ2VudHVyeSApO1xuXG5cdFx0XHRcdFx0XHQvL2NvbnZlcnQgaXQgdG8gZGF0ZXRpbWUgdmFsdWVzXG5cdFx0XHRcdFx0XHRoYWxmQ2VudHVyeSA9IG1vbWVudCggbmV3IERhdGUoIGhhbGZDZW50dXJ5LnRvU3RyaW5nKCkgKSApO1xuXHRcdFx0XHRcdFx0bmV4dEhhbGZDZW50dXJ5ID0gbW9tZW50KCBuZXcgRGF0ZSggbmV4dEhhbGZDZW50dXJ5LnRvU3RyaW5nKCkgKSApLnNlY29uZHMoLTEpO1xuXHRcdFx0XHRcdFx0Ly9tb2RpZnkgdGhlIGluaXRpYWwgdmFsdWVcblx0XHRcdFx0XHRcdG5ld1ZhbHVlWyBcInNkXCIgXSA9ICBBcHAuVXRpbHMucm91bmRUaW1lKCBoYWxmQ2VudHVyeSApO1xuXHRcdFx0XHRcdFx0bmV3VmFsdWVbIFwiZWRcIiBdID0gIEFwcC5VdGlscy5yb3VuZFRpbWUoIG5leHRIYWxmQ2VudHVyeSApO1xuXG5cdFx0XHRcdFx0fSBlbHNlIGlmKCB0aW1lRG9tYWluID09IFwiY2VudHVyeVwiICkge1xuXHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHQvL3RyeSB0byBndWVzcyBjZW50dXJ5XG5cdFx0XHRcdFx0XHR2YXIgY2VudHVyeSA9IE1hdGguZmxvb3IoIG9yaWdWYWx1ZSAvIDEwMCApICogMTAwLFxuXHRcdFx0XHRcdFx0XHRuZXh0Q2VudHVyeSA9IGNlbnR1cnkgKyAxMDA7XG5cblx0XHRcdFx0XHRcdC8vYWRkIHplcm9zXG5cdFx0XHRcdFx0XHRjZW50dXJ5ID0gQXBwLlV0aWxzLmFkZFplcm9zKCBjZW50dXJ5ICk7XG5cdFx0XHRcdFx0XHRuZXh0Q2VudHVyeSA9IEFwcC5VdGlscy5hZGRaZXJvcyggbmV4dENlbnR1cnkgKTtcblxuXHRcdFx0XHRcdFx0Ly9jb252ZXJ0IGl0IHRvIGRhdGV0aW1lIHZhbHVlc1xuXHRcdFx0XHRcdFx0Y2VudHVyeSA9IG1vbWVudCggbmV3IERhdGUoIGNlbnR1cnkudG9TdHJpbmcoKSApICk7XG5cdFx0XHRcdFx0XHRuZXh0Q2VudHVyeSA9IG1vbWVudCggbmV3IERhdGUoIG5leHRDZW50dXJ5LnRvU3RyaW5nKCkgKSApLnNlY29uZHMoLTEpO1xuXHRcdFx0XHRcdFx0Ly9tb2RpZnkgdGhlIGluaXRpYWwgdmFsdWVcblx0XHRcdFx0XHRcdG5ld1ZhbHVlWyBcInNkXCIgXSA9IEFwcC5VdGlscy5yb3VuZFRpbWUoIGNlbnR1cnkgKTtcblx0XHRcdFx0XHRcdG5ld1ZhbHVlWyBcImVkXCIgXSA9IEFwcC5VdGlscy5yb3VuZFRpbWUoIG5leHRDZW50dXJ5ICk7XG5cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvL2luc2VydCBpbmZvIGFib3V0IHRpbWUgZG9tYWluXG5cdFx0XHRcdFx0bmV3VmFsdWVbIFwidGRcIiBdID0gdGltZURvbWFpbjtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHQvL2luaXRpYWwgd2FzIG51bWJlci9zdHJpbmcgc28gcGFzc2VkIGJ5IHZhbHVlLCBuZWVkIHRvIGluc2VydCBpdCBiYWNrIHRvIGFycmVheVxuXHRcdFx0XHRcdGlmKCAhdGhhdC5pc0RhdGFNdWx0aVZhcmlhbnQgKSB7XG5cdFx0XHRcdFx0XHRkYXRhWyAwIF1bIGkrMSBdID0gbmV3VmFsdWU7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGRhdGFbIGkrMSBdWyAxIF0gPSBuZXdWYWx1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Ly9tYXNzaXZlIGltcG9ydCB2ZXJzaW9uXG5cdFx0XHRcdFx0Ly9kYXRhWyBpKzEgXVsgMSBdID0gbmV3VmFsdWU7XG5cblx0XHRcdFx0fVxuXG5cdFx0XHR9KTtcblxuXHRcdFx0dmFyICRyZXN1bHROb3RpY2U7XG5cblx0XHRcdC8vcmVtb3ZlIGFueSBwcmV2aW91c2x5IGF0dGFjaGVkIG5vdGlmaWNhdGlvbnNcblx0XHRcdCQoIFwiLnRpbWVzLXZhbGlkYXRpb24tcmVzdWx0XCIgKS5yZW1vdmUoKTtcblxuXHRcdFx0aWYoICR0aW1lc0NlbGxzLmZpbHRlciggXCIuYWxlcnQtZXJyb3JcIiApLmxlbmd0aCApIHtcblx0XHRcdFx0XG5cdFx0XHRcdCRyZXN1bHROb3RpY2UgPSAkKCBcIjxwIGNsYXNzPSd0aW1lcy12YWxpZGF0aW9uLXJlc3VsdCB2YWxpZGF0aW9uLXJlc3VsdCB0ZXh0LWRhbmdlcic+PGkgY2xhc3M9J2ZhIGZhLWV4Y2xhbWF0aW9uLWNpcmNsZSc+PC9pPlRpbWUgaW5mb3JtYXRpb24gaW4gdGhlIHVwbG9hZGVkIGZpbGUgaXMgbm90IGluIDxhIGhyZWY9J2h0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSVNPXzg2MDEnIHRhcmdldD0nX2JsYW5rJz5zdGFuZGFyZGl6ZWQgZm9ybWF0IChZWVlZLU1NLUREKTwvYT4hIEZpeCB0aGUgaGlnaGxpZ2h0ZWQgdGltZSBpbmZvcm1hdGlvbiBhbmQgcmV1cGxvYWQgQ1NWLjwvcD5cIiApO1xuXHRcdFx0XG5cdFx0XHR9IGVsc2Uge1xuXG5cdFx0XHRcdCRyZXN1bHROb3RpY2UgPSAkKCBcIjxwIGNsYXNzPSd0aW1lcy12YWxpZGF0aW9uLXJlc3VsdCB2YWxpZGF0aW9uLXJlc3VsdCB0ZXh0LXN1Y2Nlc3MnPjxpIGNsYXNzPSdmYSBmYS1jaGVjay1jaXJjbGUnPjwvaT5UaW1lIGluZm9ybWF0aW9uIGluIHRoZSB1cGxvYWRlZCBmaWxlIGlzIGNvcnJlY3QsIHdlbGwgZG9uZSE8L3A+XCIgKTtcblxuXHRcdFx0fVxuXHRcdFx0JGRhdGFUYWJsZVdyYXBwZXIuYmVmb3JlKCAkcmVzdWx0Tm90aWNlICk7XG5cdFx0XHRcblx0XHR9LFxuXG5cdFx0b25EYXRhc2V0RGVzY3JpcHRpb246IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdHZhciAkYnRuID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKTtcblx0XHRcdFxuXHRcdFx0aWYoIHRoaXMuJG5ld0RhdGFzZXREZXNjcmlwdGlvbi5pcyggXCI6dmlzaWJsZVwiICkgKSB7XG5cdFx0XHRcdHRoaXMuJG5ld0RhdGFzZXREZXNjcmlwdGlvbi5oaWRlKCk7XG5cdFx0XHRcdCRidG4uZmluZCggXCJzcGFuXCIgKS50ZXh0KCBcIkFkZCBkYXRhc2V0IGRlc2NyaXB0aW9uLlwiICk7XG5cdFx0XHRcdCRidG4uZmluZCggXCJpXCIgKS5yZW1vdmVDbGFzcyggXCJmYS1taW51c1wiICk7XG5cdFx0XHRcdCRidG4uZmluZCggXCJpXCIgKS5hZGRDbGFzcyggXCJmYS1wbHVzXCIgKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuJG5ld0RhdGFzZXREZXNjcmlwdGlvbi5zaG93KCk7XG5cdFx0XHRcdCRidG4uZmluZCggXCJzcGFuXCIgKS50ZXh0KCBcIk5ldmVybWluZCwgbm8gZGVzY3JpcHRpb24uXCIgKTtcblx0XHRcdFx0JGJ0bi5maW5kKCBcImlcIiApLmFkZENsYXNzKCBcImZhLW1pbnVzXCIgKTtcblx0XHRcdFx0JGJ0bi5maW5kKCBcImlcIiApLnJlbW92ZUNsYXNzKCBcImZhLXBsdXNcIiApO1xuXHRcdFx0fVxuXG5cdFx0fSxcblxuXHRcdG9uTmV3RGF0YXNldENoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dmFyICRpbnB1dCA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICk7XG5cdFx0XHRpZiggJGlucHV0LnZhbCgpID09PSBcIjBcIiApIHtcblx0XHRcdFx0dGhpcy4kbmV3RGF0YXNldFNlY3Rpb24uaGlkZSgpO1xuXHRcdFx0XHR0aGlzLiRleGlzdGluZ0RhdGFzZXRTZWN0aW9uLnNob3coKTtcblx0XHRcdFx0Ly9zaG91bGQgd2UgYXBwZWFyIHZhcmlhYmxlIHNlbGVjdCBhcyB3ZWxsP1xuXHRcdFx0XHRpZiggIXRoaXMuJGV4aXN0aW5nRGF0YXNldFNlbGVjdC52YWwoKSApIHtcblx0XHRcdFx0XHR0aGlzLiRleGlzdGluZ1ZhcmlhYmxlc1dyYXBwZXIuaGlkZSgpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMuJGV4aXN0aW5nVmFyaWFibGVzV3JhcHBlci5zaG93KCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuJG5ld0RhdGFzZXRTZWN0aW9uLnNob3coKTtcblx0XHRcdFx0dGhpcy4kZXhpc3RpbmdEYXRhc2V0U2VjdGlvbi5oaWRlKCk7XG5cdFx0XHR9XG5cblx0XHR9LFxuXG5cdFx0b25OZXdEYXRhc2V0TmFtZUNoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dmFyICRpbnB1dCA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICk7XG5cdFx0XHR0aGlzLmRhdGFzZXROYW1lID0gJGlucHV0LnZhbCgpO1xuXG5cdFx0XHQvL2NoZWNrIGlmIHdlIGhhdmUgdmFsdWUgZm9yIHZhcmlhYmxlLCBlbnRlciBpZiBub3Rcblx0XHRcdHZhciAkdmFyaWFibGVJdGVtcyA9IHRoaXMuJHZhcmlhYmxlU2VjdGlvbkxpc3QuZmluZCggXCIudmFyaWFibGUtaXRlbVwiICk7XG5cdFx0XHRpZiggJHZhcmlhYmxlSXRlbXMubGVuZ3RoID09IDEgJiYgIXRoaXMudmFyaWFibGVOYW1lTWFudWFsICkge1xuXHRcdFx0XHQvL3dlIGhhdmUganVzdCBvbmUsIGNoZWNrIFxuXHRcdFx0XHR2YXIgJHZhcmlhYmxlSXRlbSA9ICR2YXJpYWJsZUl0ZW1zLmVxKCAwICksXG5cdFx0XHRcdFx0JGZpcnN0SW5wdXQgPSAkdmFyaWFibGVJdGVtLmZpbmQoIFwiaW5wdXRcIiApLmZpcnN0KCk7XG5cdFx0XHRcdCRmaXJzdElucHV0LnZhbCggdGhpcy5kYXRhc2V0TmFtZSApO1xuXHRcdFx0XHQkZmlyc3RJbnB1dC50cmlnZ2VyKCBcImlucHV0XCIgKTtcblx0XHRcdH1cblxuXHRcdH0sXG5cblx0XHRvbkV4aXN0aW5nRGF0YXNldENoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dmFyICRpbnB1dCA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICk7XG5cdFx0XHR0aGlzLmRhdGFzZXROYW1lID0gJGlucHV0LmZpbmQoICdvcHRpb246c2VsZWN0ZWQnICkudGV4dCgpO1xuXG5cdFx0XHRpZiggJGlucHV0LnZhbCgpICkge1xuXHRcdFx0XHQvL2ZpbHRlciB2YXJpYWJsZSBzZWxlY3QgdG8gc2hvdyB2YXJpYWJsZXMgb25seSBmcm9tIGdpdmVuIGRhdGFzZXRcblx0XHRcdFx0dmFyICRvcHRpb25zID0gdGhpcy4kZXhpc3RpbmdWYXJpYWJsZXNTZWxlY3QuZmluZCggXCJvcHRpb25cIiApO1xuXHRcdFx0XHQkb3B0aW9ucy5oaWRlKCk7XG5cdFx0XHRcdCRvcHRpb25zLmZpbHRlciggXCJbZGF0YS1kYXRhc2V0LWlkPVwiICsgJGlucHV0LnZhbCgpICsgXCJdXCIgKS5zaG93KCk7XG5cdFx0XHRcdC8vYXBwZWFyIGFsc28gdGhlIGZpcnN0IGRlZmF1bHRcblx0XHRcdFx0JG9wdGlvbnMuZmlyc3QoKS5zaG93KCk7XG5cdFx0XHRcdHRoaXMuJGV4aXN0aW5nVmFyaWFibGVzV3JhcHBlci5zaG93KCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLiRleGlzdGluZ1ZhcmlhYmxlc1dyYXBwZXIuaGlkZSgpO1xuXHRcdFx0fVxuXG5cdFx0fSxcblxuXHRcdG9uRXhpc3RpbmdWYXJpYWJsZUNoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dmFyICRpbnB1dCA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICk7XG5cdFx0XHR0aGlzLmV4aXN0aW5nVmFyaWFibGUgPSAkaW5wdXQuZmluZCggJ29wdGlvbjpzZWxlY3RlZCcgKTtcblx0XG5cdFx0fSxcblxuXHRcdG9uUmVtb3ZlVXBsb2FkZWRGaWxlOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHR0aGlzLiRmaWxlUGlja2VyLnJlcGxhY2VXaXRoKCB0aGlzLiRmaWxlUGlja2VyLmNsb25lKCkgKTtcblx0XHRcdC8vcmVmZXRjaCBkb21cblx0XHRcdHRoaXMuJGZpbGVQaWNrZXIgPSB0aGlzLiRlbC5maW5kKCBcIi5maWxlLXBpY2tlci13cmFwcGVyIFt0eXBlPWZpbGVdXCIgKTtcblx0XHRcdHRoaXMuJGZpbGVQaWNrZXIucHJvcCggXCJkaXNhYmxlZFwiLCBmYWxzZSk7XG5cblx0XHRcdC8vcmVzZXQgcmVsYXRlZCBjb21wb25lbnRzXG5cdFx0XHR0aGlzLiRjc3ZJbXBvcnRUYWJsZVdyYXBwZXIuZW1wdHkoKTtcblx0XHRcdHRoaXMuJGRhdGFJbnB1dC52YWwoXCJcIik7XG5cdFx0XHQvL3JlbW92ZSBub3RpZmljYXRpb25zXG5cdFx0XHR0aGlzLiRjc3ZJbXBvcnRSZXN1bHQuZmluZCggXCIudmFsaWRhdGlvbi1yZXN1bHRcIiApLnJlbW92ZSgpO1xuXG5cdFx0XHR0aGlzLmluaXRVcGxvYWQoKTtcblxuXHRcdH0sXG5cblx0XHRvbkNhdGVnb3J5Q2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0XG5cdFx0XHR2YXIgJGlucHV0ID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKTtcblx0XHRcdGlmKCAkaW5wdXQudmFsKCkgIT0gXCJcIiApIHtcblx0XHRcdFx0dGhpcy4kc3ViY2F0ZWdvcnlTZWxlY3Quc2hvdygpO1xuXHRcdFx0XHR0aGlzLiRzdWJjYXRlZ29yeVNlbGVjdC5jc3MoIFwiZGlzcGxheVwiLCBcImJsb2NrXCIgKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuJHN1YmNhdGVnb3J5U2VsZWN0LmhpZGUoKTtcblx0XHRcdH1cblxuXHRcdFx0Ly9maWx0ZXIgc3ViY2F0ZWdvcmllcyBzZWxlY3Rcblx0XHRcdHRoaXMuJHN1YmNhdGVnb3J5U2VsZWN0LmZpbmQoIFwib3B0aW9uXCIgKS5oaWRlKCk7XG5cdFx0XHR0aGlzLiRzdWJjYXRlZ29yeVNlbGVjdC5maW5kKCBcIm9wdGlvbltkYXRhLWNhdGVnb3J5LWlkPVwiICsgJGlucHV0LnZhbCgpICsgXCJdXCIgKS5zaG93KCk7XG5cblx0XHR9LFxuXG5cdFx0b25EYXRhc291cmNlQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHR2YXIgJHRhcmdldCA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICk7XG5cdFx0XHRpZiggJHRhcmdldC52YWwoKSA8IDEgKSB7XG5cdFx0XHRcdHRoaXMuJG5ld0RhdGFzb3VyY2VXcmFwcGVyLnNsaWRlRG93bigpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy4kbmV3RGF0YXNvdXJjZVdyYXBwZXIuc2xpZGVVcCgpO1xuXHRcdFx0fVxuXG5cdFx0fSxcblxuXHRcdG9uU3ViQ2F0ZWdvcnlDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHRcblx0XHR9LFxuXG5cdFx0b25NdWx0aXZhcmlhbnREYXRhc2V0Q2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHR2YXIgJGlucHV0ID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKTtcblx0XHRcdGlmKCAkaW5wdXQudmFsKCkgPT09IFwiMVwiICkge1xuXHRcdFx0XHR0aGlzLmlzRGF0YU11bHRpVmFyaWFudCA9IHRydWU7XG5cdFx0XHRcdC8vJCggXCIudmFsaWRhdGlvbi1yZXN1bHRcIiApLnJlbW92ZSgpO1xuXHRcdFx0XHQvLyQoIFwiLmVudGl0aWVzLXZhbGlkYXRpb24td3JhcHBlclwiICkucmVtb3ZlKCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmlzRGF0YU11bHRpVmFyaWFudCA9IGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiggdGhpcy51cGxvYWRlZERhdGEgJiYgdGhpcy5vcmlnVXBsb2FkZWREYXRhICkge1xuXG5cdFx0XHRcdC8vaW5zZXJ0IG9yaWdpbmFsIHVwbG9hZGVkRGF0YSBpbnRvIGFycmF5IGJlZm9yZSBwcm9jZXNzaW5nXG5cdFx0XHRcdHRoaXMudXBsb2FkZWREYXRhID0gJC5leHRlbmQoIHRydWUsIHt9LCB0aGlzLm9yaWdVcGxvYWRlZERhdGEpO1xuXHRcdFx0XHQvL3JlLXZhbGlkYXRlXG5cdFx0XHRcdHRoaXMudmFsaWRhdGVFbnRpdHlEYXRhKCB0aGlzLnVwbG9hZGVkRGF0YS5yb3dzICk7XG5cdFx0XHRcdHRoaXMudmFsaWRhdGVUaW1lRGF0YSggdGhpcy51cGxvYWRlZERhdGEucm93cyApO1xuXHRcdFx0XHR0aGlzLm1hcERhdGEoKTtcblxuXHRcdFx0fVxuXHRcdFx0XG5cdFx0fSxcblxuXHRcdG9uRm9ybVN1Ym1pdDogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cblx0XHRcdHZhciAkdmFsaWRhdGVFbnRpdGllc0NoZWNrYm94ID0gJCggXCJbbmFtZT0ndmFsaWRhdGVfZW50aXRpZXMnXVwiICksXG5cdFx0XHRcdHZhbGlkYXRlRW50aXRpZXMgPSAoICR2YWxpZGF0ZUVudGl0aWVzQ2hlY2tib3guaXMoIFwiOmNoZWNrZWRcIiApICk/IGZhbHNlOiB0cnVlLFxuXHRcdFx0XHQkdmFsaWRhdGlvblJlc3VsdHMgPSBbXTtcblxuXHRcdFx0Ly9kaXNwbGF5IHZhbGlkYXRpb24gcmVzdWx0c1xuXHRcdFx0Ly92YWxpZGF0ZSBlbnRlcmVkIGRhdGFzb3VyY2VzXG5cdFx0XHR2YXIgJHNvdXJjZURlc2NyaXB0aW9uID0gJCggXCJbbmFtZT0nc291cmNlX2Rlc2NyaXB0aW9uJ11cIiApLFxuXHRcdFx0XHRzb3VyY2VEZXNjcmlwdGlvblZhbHVlID0gJHNvdXJjZURlc2NyaXB0aW9uLnZhbCgpLFxuXHRcdFx0XHRoYXNWYWxpZFNvdXJjZSA9IHRydWU7XG5cdFx0XHRpZiggc291cmNlRGVzY3JpcHRpb25WYWx1ZS5zZWFyY2goIFwiPHRkPmUuZy5cIiApID4gLTEgfHwgc291cmNlRGVzY3JpcHRpb25WYWx1ZS5zZWFyY2goIFwiPHA+ZS5nLlwiICkgPiAtMSApIHtcblx0XHRcdFx0aGFzVmFsaWRTb3VyY2UgPSBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHZhciAkc291cmNlVmFsaWRhdGlvbk5vdGljZSA9ICQoIFwiLnNvdXJjZS12YWxpZGF0aW9uLXJlc3VsdFwiICk7XG5cdFx0XHRpZiggIWhhc1ZhbGlkU291cmNlICkge1xuXHRcdFx0XHQvL2ludmFsaWRcblx0XHRcdFx0aWYoICEkc291cmNlVmFsaWRhdGlvbk5vdGljZS5sZW5ndGggKSB7XG5cdFx0XHRcdFx0Ly9kb2Vucyd0IGhhdmUgbm90aWNlIHlldFxuXHRcdFx0XHRcdCRzb3VyY2VWYWxpZGF0aW9uTm90aWNlID0gJCggXCI8cCBjbGFzcz0nc291cmNlLXZhbGlkYXRpb24tcmVzdWx0IHZhbGlkYXRpb24tcmVzdWx0IHRleHQtZGFuZ2VyJz48aSBjbGFzcz0nZmEgZmEtZXhjbGFtYXRpb24tY2lyY2xlJz4gUGxlYXNlIHJlcGxhY2UgdGhlIHNhbXBsZSBkYXRhIHdpdGggcmVhbCBkYXRhc291cmNlIGluZm8uPC9wPlwiICk7XG5cdFx0XHRcdFx0JHNvdXJjZURlc2NyaXB0aW9uLmJlZm9yZSggJHNvdXJjZVZhbGlkYXRpb25Ob3RpY2UgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQkc291cmNlVmFsaWRhdGlvbk5vdGljZS5zaG93KCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vdmFsaWQsIG1ha2Ugc3VyZSB0aGVyZSdzIG5vdCBcblx0XHRcdFx0JHNvdXJjZVZhbGlkYXRpb25Ob3RpY2UucmVtb3ZlKCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vY2F0ZWdvcnkgdmFsaWRhdGlvblxuXHRcdFx0dmFyICRjYXRlZ29yeVZhbGlkYXRpb25Ob3RpY2UgPSAkKCBcIi5jYXRlZ29yeS12YWxpZGF0aW9uLXJlc3VsdFwiICk7XG5cdFx0XHRpZiggIXRoaXMuJGNhdGVnb3J5U2VsZWN0LnZhbCgpIHx8ICF0aGlzLiRzdWJjYXRlZ29yeVNlbGVjdC52YWwoKSApIHtcblx0XHRcdFx0aWYoICEkY2F0ZWdvcnlWYWxpZGF0aW9uTm90aWNlLmxlbmd0aCApIHtcblx0XHRcdFx0XHQkY2F0ZWdvcnlWYWxpZGF0aW9uTm90aWNlID0gJCggXCI8cCBjbGFzcz0nY2F0ZWdvcnktdmFsaWRhdGlvbi1yZXN1bHQgdmFsaWRhdGlvbi1yZXN1bHQgdGV4dC1kYW5nZXInPjxpIGNsYXNzPSdmYSBmYS1leGNsYW1hdGlvbi1jaXJjbGUnPiBQbGVhc2UgY2hvb3NlIGNhdGVnb3J5IGZvciB1cGxvYWRlZCBkYXRhLjwvcD5cIiApO1xuXHRcdFx0XHRcdHRoaXMuJGNhdGVnb3J5U2VsZWN0LmJlZm9yZSggJGNhdGVnb3J5VmFsaWRhdGlvbk5vdGljZSApO1xuXHRcdFx0XHR9IHtcblx0XHRcdFx0XHQkY2F0ZWdvcnlWYWxpZGF0aW9uTm90aWNlLnNob3coKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly92YWxpZCwgbWFrZSBzdXJlIHRvIHJlbW92ZVxuXHRcdFx0XHQkY2F0ZWdvcnlWYWxpZGF0aW9uTm90aWNlLnJlbW92ZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHQvL2RpZmZlcmVudCBzY2VuYXJpb3Mgb2YgdmFsaWRhdGlvblxuXHRcdFx0aWYoIHZhbGlkYXRlRW50aXRpZXMgKSB7XG5cdFx0XHRcdC8vdmFsaWRhdGUgYm90aCB0aW1lIGFuZCBlbnRpdGl5ZVxuXHRcdFx0XHQkdmFsaWRhdGlvblJlc3VsdHMgPSAkKCBcIi52YWxpZGF0aW9uLXJlc3VsdC50ZXh0LWRhbmdlclwiICk7XG5cdFx0XHR9IGVsc2UgaWYoICF2YWxpZGF0ZUVudGl0aWVzICkge1xuXHRcdFx0XHQvL3ZhbGlkYXRlIG9ubHkgdGltZVxuXHRcdFx0XHQkdmFsaWRhdGlvblJlc3VsdHMgPSAkKCBcIi50aW1lLWRvbWFpbi12YWxpZGF0aW9uLXJlc3VsdC50ZXh0LWRhbmdlciwgLnRpbWVzLXZhbGlkYXRpb24tcmVzdWx0LnRleHQtZGFuZ2VyLCAuc291cmNlLXZhbGlkYXRpb24tcmVzdWx0LCAuY2F0ZWdvcnktdmFsaWRhdGlvbi1yZXN1bHRcIiApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly9kbyBub3QgdmFsaWRhdGVcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0Y29uc29sZS5sb2coIFwidmFsaWRhdGlvblJlc3VsdHMubGVuZ3RoXCIsICR2YWxpZGF0aW9uUmVzdWx0cy5sZW5ndGggKTtcblxuXHRcdFx0aWYoICR2YWxpZGF0aW9uUmVzdWx0cy5sZW5ndGggKSB7XG5cdFx0XHRcdC8vZG8gbm90IHNlbmQgZm9ybSBhbmQgc2Nyb2xsIHRvIGVycm9yIG1lc3NhZ2Vcblx0XHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdCQoJ2h0bWwsIGJvZHknKS5hbmltYXRlKHtcblx0XHRcdFx0XHRzY3JvbGxUb3A6ICR2YWxpZGF0aW9uUmVzdWx0cy5vZmZzZXQoKS50b3AgLSAxOFxuXHRcdFx0XHR9LCAzMDApO1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdC8vZXZ0IFxuXHRcdFx0dmFyICRidG4gPSAkKCBcIlt0eXBlPXN1Ym1pdF1cIiApO1xuXHRcdFx0JGJ0bi5wcm9wKCBcImRpc2FibGVkXCIsIHRydWUgKTtcblx0XHRcdCRidG4uY3NzKCBcIm9wYWNpdHlcIiwgMC41ICk7XG5cblx0XHRcdCRidG4uYWZ0ZXIoIFwiPHAgY2xhc3M9J3NlbmQtbm90aWZpY2F0aW9uJz48aSBjbGFzcz0nZmEgZmEtc3Bpbm5lciBmYS1zcGluJz48L2k+U2VuZGluZyBmb3JtPC9wPlwiICk7XG5cblx0XHRcdC8vc2VyaWFsaXplIGFycmF5XG5cdFx0XHR2YXIgJGZvcm0gPSAkKCBcIiNpbXBvcnQtdmlldyA+IGZvcm1cIiApO1xuXHRcdFx0XG5cdFx0XHR2YXIgaW1wb3J0ZXIgPSBuZXcgQXBwLk1vZGVscy5JbXBvcnRlciggeyBkaXNwYXRjaGVyOiB0aGlzLmRpc3BhdGNoZXIgfSApO1xuXHRcdFx0aW1wb3J0ZXIudXBsb2FkRm9ybURhdGEoICRmb3JtLCB0aGlzLm9yaWdVcGxvYWRlZERhdGEgKTtcblxuXHRcdFx0dmFyIGltcG9ydFByb2dyZXNzID0gbmV3IEFwcC5WaWV3cy5VSS5JbXBvcnRQcm9ncmVzc1BvcHVwKCk7XG5cdFx0XHRpbXBvcnRQcm9ncmVzcy5pbml0KCB7IGRpc3BhdGNoZXI6IHRoaXMuZGlzcGF0Y2hlciB9ICk7XG5cdFx0XHRpbXBvcnRQcm9ncmVzcy5zaG93KCk7XG5cblx0XHRcdHJldHVybiBmYWxzZTtcblxuXG5cdFx0fVxuXG5cblx0fSk7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVmlld3MuSW1wb3J0VmlldztcblxufSkoKTsiXX0=
