;( function() {
	
	"use strict";

	App.Views.FormView = Backbone.View.extend({

		el: "#form-view",
		events: {
			"click .form-collapse-btn": "onFormCollapse",
			"change input[name=chart-name]": "onNameChange",
			"change textarea[name=chart-subname]": "onSubnameChange",
			"click .remove-uploaded-file-btn": "onRemoveUploadedFile",
			"submit form": "onFormSubmit",
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			
			var formConfig = App.ChartModel.get( "form-config" );

			//create related models, either empty (when creating new chart), or prefilled from db (when editing existing chart)
			if( formConfig && formConfig[ "variables-collection" ] ) {
				App.ChartVariablesCollection = new App.Collections.ChartVariablesCollection( formConfig[ "variables-collection" ] );
			} else {
				App.ChartVariablesCollection = new App.Collections.ChartVariablesCollection();
			}
			if( formConfig && formConfig[ "entities-collection" ] ) {
				App.AvailableEntitiesCollection = new App.Collections.AvailableEntitiesCollection( formConfig[ "entities-collection" ] );
			} else {
				App.AvailableEntitiesCollection = new App.Collections.AvailableEntitiesCollection();
			}
			if( formConfig && formConfig[ "dimensions" ] ) {
				App.ChartDimensionsModel = new App.Models.ChartDimensionsModel();
				//App.ChartDimensionsModel = new App.Models.ChartDimensionsModel( formConfig[ "dimensions" ] );
			} else {
				App.ChartDimensionsModel = new App.Models.ChartDimensionsModel();
			}
			if( formConfig && formConfig[ "available-time" ] ) {
				App.AvailableTimeModel = new App.Models.AvailableTimeModel(formConfig[ "available-time" ]);
			} else {
				App.AvailableTimeModel = new App.Models.AvailableTimeModel();
			}

			//create search collection
			App.SearchDataCollection = new App.Collections.SearchDataCollection();
			
			//is it new or existing chart
			if( formConfig && formConfig[ "dimensions" ] ) {
				//existing chart, need to load fresh dimensions from database (in case we've added dimensions since creating chart)
				var that = this;
				App.ChartDimensionsModel.loadConfiguration( formConfig[ "dimensions" ].id );
				App.ChartDimensionsModel.on( "change", function() {
					that.render();
				} );
			} else {
				//new chart, can render straight away
				this.render();
			}
			
		},

		render: function() {
			
			//create subviews
			this.basicTabView = new App.Views.Form.BasicTabView( { dispatcher: this.dispatcher } );
			this.axisTabView = new App.Views.Form.AxisTabView( { dispatcher: this.dispatcher } );
			this.descriptionTabView = new App.Views.Form.DescriptionTabView( { dispatcher: this.dispatcher } );
			this.stylingTabView = new App.Views.Form.StylingTabView( { dispatcher: this.dispatcher } );
			this.exportTabView = new App.Views.Form.ExportTabView( { dispatcher: this.dispatcher } );
			this.mapTabView = new App.Views.Form.MapTabView( { dispatcher: this.dispatcher } );

			//fetch doms
			this.$removeUploadedFileBtn = this.$el.find( ".remove-uploaded-file-btn" );
			this.$filePicker = this.$el.find( ".file-picker-wrapper [type=file]" );

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


		onFormCollapse: function( evt ) {

			evt.preventDefault();
			var $parent = this.$el.parent();
			$parent.toggleClass( "form-panel-collapsed" );
			
			//trigger re-rendering of chart
			App.ChartModel.trigger( "change" );

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
			};
			App.ChartModel.set( "form-config", formConfig, { silent: true } );

			var dispatcher = this.dispatcher;
			App.ChartModel.save( {}, {
				success: function ( model, response, options ) {
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