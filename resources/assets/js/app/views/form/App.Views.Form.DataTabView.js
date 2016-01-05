;( function() {
	
	"use strict";

	var App = require( "./../../namespaces.js" ),
		ChartTypeSectionView = require( "./basicTab/App.Views.Form.ChartTypeSectionView.js" ),
		AddDataSectionView = require( "./dataTab/App.Views.Form.AddDataSectionView.js" ),
		DimensionsSectionView = require( "./dataTab/App.Views.Form.DimensionsSectionView.js" ),
		SelectedCountriesSectionView = require( "./dataTab/App.Views.Form.SelectedCountriesSectionView.js" ),
		EntitiesSectionView = require( "./dataTab/App.Views.Form.EntitiesSectionView.js" ),
		TimeSectionView = require( "./dataTab/App.Views.Form.TimeSectionView.js" );

	App.Views.Form.BasicTabView = Backbone.View.extend({

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

	module.exports = App.Views.Form.BasicTabView;

})();
