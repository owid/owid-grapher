;( function() {
	
	"use strict";

	App.Views.ImportView = Backbone.View.extend({

		datasetName: "",
		isDataMultiVariant: false,
		uploadedData: false,

		el: "#import-view",
		events: {
			"input [name=new_dataset_name]": "onNewDatasetNameChange",
			"change [name=new_dataset]": "onNewDatasetChange",
			"click .remove-uploaded-file-btn": "onRemoveUploadedFile",
			"change [name=category_id]": "onCategoryChange",
			"change [name=existing_dataset_id]": "onExistingDatasetChange",
			"change [name=subcategory_id]": "onSubCategoryChange",
			"change [name=multivariant_dataset]": "onMultivariantDatasetChange",
			"click .new-dataset-description-btn": "onDatasetDescription"
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			this.render();
			this.initUpload();
			
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
			this.$variableSectionList = this.$variableSection.find( "ul" );

			this.$filePicker = this.$el.find( ".file-picker-wrapper [type=file]" );
			this.$dataInput = this.$el.find( "[name=data]" );
			this.$csvImportResult = this.$el.find( ".csv-import-result" );
			this.$newDatasetSection = this.$el.find( ".new-dataset-section" );
			this.$existingDatasetSection = this.$el.find( ".existing-dataset-section" );
			this.$removeUploadedFileBtn = this.$el.find( ".remove-uploaded-file-btn" );

			//category section
			this.$categorySelect = this.$el.find( "[name=category_id]" );
			this.$subcategorySelect = this.$el.find( "[name=subcategory_id]" );

			//hide optional elements
			this.$newDatasetDescription.hide();
			this.$variableSection.hide();

		},

		initUpload: function() {

			var that = this;
			CSV.begin( this.$filePicker.selector )
				.table( "csv-import-result", { header:1, caption: "Imported data" } )
				.go( function( err, data ) {
						that.onCsvSelected( err, data );
				} );
			this.$removeUploadedFileBtn.hide();

		},

		updateVariableList: function( data ) {

			var $list = this.$variableSectionList;
			$list.empty();
			
			var that = this;
			if( data && data.variables ) {
				_.each( data.variables, function( v, k ) {
					var $li = that.createVariableEl( v );
					$list.append( $li );
				} );
			}

		},

		createVariableEl: function( data ) {

			//add missing properties
			data.unit = "";
			data.description = "";

			var $li = $( "<li></li>" ),
				$inputName = $( "<input value='" + data.name + "' />" ),
				$inputUnit = $( "<input value='' />" ),
				$inputDescription = $( "<input value='' />" ),
				$inputData = $( "<input type='text' name='variables[]' value='" + JSON.stringify( data ) + "' />" );
			
			$li.append( $inputName );
			$li.append( $inputUnit );
			$li.append( $inputDescription );
			$li.append( $inputData );

			var $inputs = $li.find( "input" );
			$inputs.on( "input", function( evt ) {

				//update stored json
				var json = $.parseJSON( $inputData.val() );
				json.name = $inputName.val();
				json.unit = $inputUnit.val();
				json.description = $inputDescription.val();
				$inputData.val( JSON.stringify( json ) );

			} );

			return $li;

		},

		mapData: function() {

			var mappedData = ( this.isDataMultiVariant )? App.Utils.mapMultiVariantData( this.uploadedData.rows, "World" ): App.Utils.mapSingleVariantData( this.uploadedData.rows, this.datasetName ), 
				//var mappedData =  App.Utils.mapSingleVariantData( data.rows, "test" ), 
				json = { "variables": mappedData },
				jsonString = JSON.stringify( json );

			this.$dataInput.val( jsonString );
			this.$removeUploadedFileBtn.show();

			this.updateVariableList( json );

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
				$btn.find( "i" ).removeClass( "fa-plus" );;
			}
			
		},

		onNewDatasetChange: function( evt ) {

			var $input = $( evt.currentTarget );
			if( $input.val() === "0" ) {
				this.$newDatasetSection.hide();
				this.$existingDatasetSection.show();
			} else {
				this.$newDatasetSection.show();
				this.$existingDatasetSection.hide();
			}

		},

		onNewDatasetNameChange: function( evt ) {

			var $input = $( evt.currentTarget );
			this.datasetName = $input.val();

		},

		onExistingDatasetChange: function( evt ) {

			var $input = $( evt.currentTarget );
			this.datasetName = $input.find( 'option:selected' ).text();

		},

		onRemoveUploadedFile: function( evt ) {

			this.$filePicker.replaceWith( this.$filePicker.clone() );
			//refetch dom
			this.$filePicker = this.$el.find( ".file-picker-wrapper [type=file]" );
			this.$filePicker.prop( "disabled", false);

			//reset related components
			this.$csvImportResult.empty();
			this.$dataInput.val("");

			this.initUpload();

		},

		onCsvSelected: function( err, data ) {
			
			if( !data ) {
				return;
			}

			this.uploadedData = data;
			this.mapData();

		},

		onCategoryChange: function( evt ) {
			
			var $input = $( evt.currentTarget );
			if( $input.val() != "" ) {
				this.$subcategorySelect.show();
			} else {
				this.$subcategorySelect.hide();
			}

			//filter subcategories select
			this.$subcategorySelect.find( "option" ).hide();
			this.$subcategorySelect.find( "option[data-category-id=" + $input.val() + "]" ).show();

		},

		onSubCategoryChange: function( evt ) {
			
		},

		onMultivariantDatasetChange: function( evt ) {

			var $input = $( evt.currentTarget );
			if( $input.val() === "1" ) {
				this.isDataMultiVariant = true;
				this.$variableSection.show();
			} else {
				this.isDataMultiVariant = false;
				this.$variableSection.hide();
			}

			if( this.uploadedData ) {
				this.mapData();
			}
			
		}


	});

})();