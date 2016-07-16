;(function() {	
	"use strict";
	owid.namespace("App.Views.Form.DataTabView");

	var ChartTypeSectionView = require("App.Views.Form.ChartTypeSectionView"),
		AddDataSectionView = require("App.Views.Form.AddDataSectionView"),
		EntitiesSectionView = require("App.Views.Form.EntitiesSectionView"),
		TimeSectionView = require("App.Views.Form.TimeSectionView");

	App.Views.Form.DataTabView = owid.View.extend({

		el: "#form-view #data-tab",
		events: {
			"change textarea[name=description]": "onDescriptionChange",
		},

		initialize: function( options ) {			
			this.dispatcher = options.dispatcher;

			this.chartTypeSection = this.addChild(ChartTypeSectionView, { dispatcher: this.dispatcher });
			this.addDataSection = this.addChild(AddDataSectionView, { dispatcher: this.dispatcher });
			this.entitiesSection = this.addChild(EntitiesSectionView, { dispatcher: this.dispatcher });
			this.timeSection = this.addChild(TimeSectionView, { dispatcher: this.dispatcher });

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
