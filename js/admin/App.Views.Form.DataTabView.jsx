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

			this.addDataSection = this.addChild(AddDataSectionView);
			this.entitiesSection = this.addChild(EntitiesSectionView);
			this.timeSection = this.addChild(TimeSectionView);

			this.render();
		},
	});
})();
