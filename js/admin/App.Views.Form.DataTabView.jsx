;(function() {	
	"use strict";
	owid.namespace("App.Views.Form.DataTabView");

	var ChartTypeSectionView = App.Views.Form.ChartTypeSectionView,
		AddDataSectionView = App.Views.Form.AddDataSectionView,
		EntitiesSectionView = App.Views.Form.EntitiesSectionView,
		TimeSectionView = App.Views.Form.TimeSectionView;

	App.Views.Form.DataTabView = owid.View.extend({
		el: "#form-view #data-tab",
		initialize: function( options ) {			
			this.dispatcher = options.dispatcher;

			this.addDataSection = this.addChild(AddDataSectionView, { dispatcher: this.dispatcher });
			this.entitiesSection = this.addChild(EntitiesSectionView, { dispatcher: this.dispatcher });
			this.timeSection = this.addChild(TimeSectionView, { dispatcher: this.dispatcher });

			this.render();
		},
	});
})();
