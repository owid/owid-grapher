;(function() {	
	"use strict";
	owid.namespace("App.Views.FormView");
	
	var	ChartVariablesCollection = require("App.Collections.ChartVariablesCollection"),
		AvailableEntitiesCollection = require("App.Collections.AvailableEntitiesCollection"),
		ChartDimensionsModel = require("App.Models.ChartDimensionsModel"),
		SearchDataCollection = require("App.Collections.SearchDataCollection"),
		BasicTabView = require("App.Views.Form.BasicTabView"),
		DataTabView = require("App.Views.Form.DataTabView"),
		AxisTabView = require("App.Views.Form.AxisTabView"),
		DescriptionTabView = require("App.Views.Form.DescriptionTabView"),
		StylingTabView = require("App.Views.Form.StylingTabView"),
		ExportTabView = require("App.Views.Form.ExportTabView"),
		MapTabView = require("App.Views.Form.MapTabView");

	App.Views.FormView = Backbone.View.extend({

		el: "#form-view",
		events: {
			"click .form-collapse-btn": "onFormCollapse",
			"click .remove-uploaded-file-btn": "onRemoveUploadedFile",
			"click #save-new": "onSaveNew",
			"submit form": "onFormSubmit",
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			
			var formConfig = App.ChartModel.get( "form-config" );

			//create related models, either empty (when creating new chart), or prefilled from db (when editing existing chart)
			if( formConfig && formConfig[ "variables-collection" ] ) {
				App.ChartVariablesCollection = new ChartVariablesCollection( formConfig[ "variables-collection" ] );
			} else {
				App.ChartVariablesCollection = new ChartVariablesCollection();
			}
			if( formConfig && formConfig[ "entities-collection" ] ) {
				App.AvailableEntitiesCollection = new AvailableEntitiesCollection( formConfig[ "entities-collection" ] );
			} else {
				App.AvailableEntitiesCollection = new AvailableEntitiesCollection();
			}
			if( formConfig && formConfig[ "dimensions" ] ) {
				App.ChartDimensionsModel = new ChartDimensionsModel();
				//App.ChartDimensionsModel = new App.Models.ChartDimensionsModel( formConfig[ "dimensions" ] );
			} else {
				App.ChartDimensionsModel = new ChartDimensionsModel();
			}

			//create search collection
			App.SearchDataCollection = new SearchDataCollection();
			
			//is it new or existing chart
			if( formConfig && !_.isEmpty(formConfig[ "dimensions" ]) ) {
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
			this.basicTabView = new BasicTabView( { dispatcher: this.dispatcher } );
			this.dataTabView = new DataTabView( { dispatcher: this.dispatcher } );
			this.axisTabView = new AxisTabView( { dispatcher: this.dispatcher } );
			this.descriptionTabView = new DescriptionTabView( { dispatcher: this.dispatcher } );
			this.stylingTabView = new StylingTabView( { dispatcher: this.dispatcher } );
			this.exportTabView = new ExportTabView( { dispatcher: this.dispatcher } );
			this.mapTabView = new MapTabView( { dispatcher: this.dispatcher } );

			//fetch doms
			this.$removeUploadedFileBtn = this.$el.find( ".remove-uploaded-file-btn" );
			this.$filePicker = this.$el.find( ".file-picker-wrapper [type=file]" );
			$('.nav-tabs').stickyTabs();
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
			//also triger custom event so that map can resize
			App.ChartModel.trigger( "resize" );

		},

		onSaveNew: function(evt) {
			$.ajaxSetup( {
				headers: { 'X-CSRF-TOKEN': $('[name="_token"]').val() }
			} );

			evt.preventDefault();

			//put all changes to chart model
			var formConfig = {
				"variables-collection": App.ChartVariablesCollection.toJSON(),
				"entities-collection": App.AvailableEntitiesCollection.toJSON(),
				"dimensions": App.ChartDimensionsModel.toJSON()
			};

			App.ChartModel.set( "form-config", formConfig, { silent: true } );			
			var origId = App.ChartModel.get('id');
			App.ChartModel.set("id", null, { silent: true });

			// Need to open intermediary tab before AJAX to avoid popup blockers
			var w = window.open("/", "_blank");
			App.ChartModel.save({}, {
				success: function ( model, response, options ) {
					w.location = App.ChartModel.url(response.data.id) + "/edit";
					App.ChartModel.set('id', origId);
				},
				error: function (model, xhr, options) {
					console.error("Something went wrong while saving the model", xhr );
					alert( "Oops, there was a problem saving your chart." );
				}
			});
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
			};
			App.ChartModel.set( "form-config", formConfig, { silent: true } );
			var currentId = App.ChartModel.get("id");

			var dispatcher = this.dispatcher;
			App.ChartModel.save( {}, {
				success: function ( model, response, options ) {
					if (!currentId) {
						// New chart saved, switch to edit mode
						window.location = App.ChartModel.url(response.data.id) + '/edit';
					} else {
						alert( "The chart saved successfully" );
						dispatcher.trigger( "chart-saved", response.data.id, response.data.viewUrl );						
					}
				},
				error: function (model, xhr, options) {
					console.error("Something went wrong while saving the model", xhr );
					alert( "Oops, there was a problem saving your chart." );
				}
			});

		}

	});
})();