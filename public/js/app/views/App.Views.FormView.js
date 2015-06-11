;( function() {
	
	"use strict";

	App.Views.FormView = Backbone.View.extend({

		el: "#form-view",
		events: {
			"input input[name=chart-name]": "onNameChange",
			"input textarea[name=chart-subname]": "onSubnameChange",
			"click .remove-uploaded-file-btn": "onRemoveUploadedFile",
			"submit form": "onFormSubmit",
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			
			//create related models
			App.ChartVariablesCollection = new App.Collections.ChartVariablesCollection();
			App.AvailableEntitiesCollection = new App.Collections.AvailableEntitiesCollection();
			App.ChartDimensionsModel = new App.Models.ChartDimensionsModel();
			App.AvailableTimeModel = new App.Models.AvailableTimeModel();

			//create subviews
			this.basicTabView = new App.Views.Form.BasicTabView( { dispatcher: this.dispatcher } );
			this.axisTabView = new App.Views.Form.AxisTabView( { dispatcher: this.dispatcher } );
			this.descriptionTabView = new App.Views.Form.DescriptionTabView( { dispatcher: this.dispatcher } );
			this.stylingTabView = new App.Views.Form.StylingTabView( { dispatcher: this.dispatcher } );
			this.exportTabView = new App.Views.Form.ExportTabView( { dispatcher: this.dispatcher } );

			//fetch doms
			this.$removeUploadedFileBtn = this.$el.find( ".remove-uploaded-file-btn" );
			this.$filePicker = this.$el.find( ".file-picker-wrapper [type=file]" );
			
			//update related models
			var chartTime = App.ChartModel.get( "chart-time" );
			if( $.isArray( chartTime ) && chartTime.length == 2 ) {
				App.AvailableTimeModel.set( "min", chartTime[ 0 ] );
				App.AvailableTimeModel.set( "max", chartTime[ 1 ] );
			}

			//setup events
			/*var that = this;
			CSV.begin( this.$filePicker.selector ).go( 
				function( err, data ) {
					that.onCsvSelected( err, data );
				}
			);
			
			this.$removeUploadedFileBtn.hide();*/

			this.render();

		},

		render: function() {
			
		},

		onNameChange: function( evt ) {

			var $input = $( evt.target );
			App.ChartModel.set( "chart-name", $input.val() );

		},

		onSubnameChange: function( evt ) {

			var $textarea = $( evt.target );
			App.ChartModel.set( "chart-subname", $textarea.val() );

		},

		onCsvSelected: function( err, data ) {

			if( err ) {
				console.error( err );
				return;
			}

			this.$removeUploadedFileBtn.show();

			if( data && data.rows ) {
				var mappedData = App.Utils.mapData( data.rows );
				App.ChartModel.set( "chart-data", mappedData );
			}

		},

		onRemoveUploadedFile: function( evt ) {

			this.$filePicker.replaceWith( this.$filePicker.clone() );
			//refetch dom
			this.$filePicker = this.$el.find( ".file-picker-wrapper [type=file]" );
			this.$filePicker.prop( "disabled", false);

			var that = this;
			CSV.begin( this.$filePicker.selector ).go( function( err, data ) {
					that.onCsvSelected( err, data );
			} );

			this.$removeUploadedFileBtn.hide();

		},

		onFormSubmit: function( evt ) {
			
			$.ajaxSetup( {
				headers: { 'X-CSRF-TOKEN': $('[name="_token"]').val() }
			} );

			evt.preventDefault();

			//put all changes to chart model
			var formConfig = {
				"variables-collection": App.ChartVariablesCollection.toJSON(),
				"entities-collection": App.AvailableEntitiesCollection.toJSON(),
				"dimensions": App.ChartDimensionsModel.toJSON(),
				"available-time": App.AvailableTimeModel.toJSON()
			}
			App.ChartModel.set( "form-config", formConfig, { silent: true } );

			var dispatcher = this.dispatcher;
			App.ChartModel.save( {}, {
				success: function ( model, response, options ) {
					console.log( "response", response );
					alert( "The chart saved succesfully" );
					dispatcher.trigger( "chart-saved", response.data.id, response.data.viewUrl );
					//update id of an existing model
					App.ChartModel.set( "id", response.data.id );
				},
				error: function (model, xhr, options) {
					console.error("Something went wrong while saving the model", xhr );
					alert( "Opps, there was a problem saving your chart." );
				}
			});

		}

	});

})();