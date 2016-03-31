;(function() {	
	"use strict";
	owid.namespace("App.Views.Form.DataTabView");

	var ChartTypeSectionView = require("App.Views.Form.ChartTypeSectionView"),
		AddDataSectionView = require("App.Views.Form.AddDataSectionView"),
		DimensionsSectionView = require("App.Views.Form.DimensionsSectionView"),
		SelectedCountriesSectionView = require("App.Views.Form.SelectedCountriesSectionView"),
		EntitiesSectionView = require("App.Views.Form.EntitiesSectionView"),
		TimeSectionView = require("App.Views.Form.TimeSectionView");

	App.Views.Form.DataTabView = Backbone.View.extend({

		el: "#form-view #data-tab",
		events: {
			"change textarea[name=description]": "onDescriptionChange",
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;

			this.chartTypeSection = new ChartTypeSectionView( { dispatcher: this.dispatcher } );
			this.addDataSection = new AddDataSectionView( { dispatcher: this.dispatcher } );
			this.dimensionsSection = new DimensionsSectionView( { dispatcher: this.dispatcher } );
			this.selectedCountriesSection = new SelectedCountriesSectionView( { dispatcher: this.dispatcher } );
			this.entitiesSection = new EntitiesSectionView( { dispatcher: this.dispatcher } );
			this.timeSection = new TimeSectionView( { dispatcher: this.dispatcher } );

			this.render();

		},

		render: function() {
			this.$el.find( "[name=description]" ).val( App.ChartModel.get( "chart-description" ) );
		},

		onDescriptionChange: function( evt ) {
			var $input = $( evt.target );
			App.ChartModel.set( "chart-description", $input.val() );
		}

	});
})();
