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
		StylingTabView = require("App.Views.Form.StylingTabView"),
		ExportTabView = require("App.Views.Form.ExportTabView"),
		MapTabView = require("App.Views.Form.MapTabView"),
		SaveButtonsView = require("App.Views.Form.SaveButtons");

	App.Views.FormView = owid.View.extend({
		el: "#form-view",
		events: {
			"click .form-collapse-btn": "onFormCollapse",
			"click .remove-uploaded-file-btn": "onRemoveUploadedFile",
		},

		initialize: function( options ) {
			this.dispatcher = options.dispatcher;
			
			var formConfig = App.ChartModel.get("form-config");

			//create related models, either empty (when creating new chart), or prefilled from db (when editing existing chart)
			if (formConfig && formConfig["variables-collection"]) {
				App.ChartVariablesCollection = new ChartVariablesCollection(formConfig["variables-collection"]);
			} else {
				App.ChartVariablesCollection = new ChartVariablesCollection();
			}
		
			if (formConfig && formConfig["entities-collection"]) {
				App.AvailableEntitiesCollection = new AvailableEntitiesCollection(formConfig["entities-collection"]);
			} else {
				App.AvailableEntitiesCollection = new AvailableEntitiesCollection();
			}
		
			if (formConfig && formConfig["dimensions"]) {
				App.ChartDimensionsModel = new ChartDimensionsModel();
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
				App.ChartDimensionsModel.on("change", function() {
					that.render();
				});
			} else {
				//new chart, can render straight away
				this.render();
			}
		},

		render: function() {
			//create subviews
			this.basicTabView = this.addChild(BasicTabView, { dispatcher: this.dispatcher });
			this.dataTabView = this.addChild(DataTabView, { dispatcher: this.dispatcher });
			this.axisTabView = this.addChild(AxisTabView, { dispatcher: this.dispatcher });
			this.stylingTabView = this.addChild(StylingTabView, { dispatcher: this.dispatcher });
			this.exportTabView = this.addChild(ExportTabView, { dispatcher: this.dispatcher });
			this.mapTabView = this.addChild(MapTabView, { dispatcher: this.dispatcher });
			this.saveButtons = this.addChild(SaveButtonsView, { dispatcher: this.dispatcher });

			//fetch doms
			this.$removeUploadedFileBtn = this.$el.find( ".remove-uploaded-file-btn" );
			this.$filePicker = this.$el.find( ".file-picker-wrapper [type=file]" );
			$('.nav-tabs').stickyTabs();
		},

		onFormCollapse: function(ev) {
			ev.preventDefault();
			var $parent = this.$el.parent();
			$parent.toggleClass("form-panel-collapsed");			
			//trigger re-rendering of chart
			App.ChartModel.trigger( "change" );
			//also triger custom event so that map can resize
			App.ChartModel.trigger( "resize" );
		},
	});
})();