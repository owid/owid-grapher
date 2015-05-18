;( function() {
	
	"use strict";

	App.Views.ImportView = Backbone.View.extend({

		el: "#import-view",
		events: {
			"change [name=new_dataset]": "onNewDatasetChange",
			"click .remove-uploaded-file-btn": "onRemoveUploadedFile",
			"change [name=category_id]": "onCategoryChange",
			"change [name=subcategory_id]": "onSubCategoryChange",
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			this.render();
			this.initUpload();
			
		},

		render: function() {

			this.$filePicker = this.$el.find( ".file-picker-wrapper [type=file]" );
			this.$dataInput = this.$el.find( "[name=data]" );
			this.$csvImportResult = this.$el.find( ".csv-import-result" );
			this.$newDatasetSection = this.$el.find( ".new-dataset-section" );
			this.$existingDatasetSection = this.$el.find( ".existing-dataset-section" );
			this.$removeUploadedFileBtn = this.$el.find( ".remove-uploaded-file-btn" );

			//category section
			this.$categorySelect = this.$el.find( "[name=category_id]" );
			this.$subcategorySelect = this.$el.find( "[name=subcategory_id]" );

		},

		initUpload: function() {

			var that = this;
			CSV.begin( this.$filePicker.selector )
				.table( "csv-import-result", { header:1,caption:"Imported data" } )
				.go( function( err, data ) {
						that.onCsvSelected( err, data );
				} );
			this.$removeUploadedFileBtn.hide();

		},

		onNewDatasetChange: function( evt ) {

			var $input = $( evt.currentTarget ),
				inputVal = $input.val();

			if( inputVal === "0" ) {
				this.$newDatasetSection.hide();
				this.$existingDatasetSection.show();
			} else {
				this.$newDatasetSection.show();
				this.$existingDatasetSection.hide();
			}

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
			
			var mappedData = App.Utils.mapData( data.rows ),
				jsonString = JSON.stringify( mappedData );
			this.$dataInput.val( jsonString );
			this.$removeUploadedFileBtn.show();

		},

		onCategoryChange: function( evt ) {
			
			var $input = $( evt.currentTarget ),
				inputVal = $input.val();

			if( inputVal != "" ) {
				this.$subcategorySelect.show();
			} else {
				this.$subcategorySelect.hide();
			}

			//filter subcategories select
			this.$subcategorySelect.find( "option" ).hide();
			this.$subcategorySelect.find( "option[data-category-id=" + inputVal + "]" ).show();

		},

		onSubCategoryChange: function( evt ) {
			
		}


	});

})();