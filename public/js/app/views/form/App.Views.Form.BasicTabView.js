;( function() {
	
	"use strict";

	App.Views.Form.BasicTabView = Backbone.View.extend({

		el: "#form-view #basic-tab",
		events: {
			"click .add-data-btn": "onAddDataBtn",
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;

			this.chartTypeSection = new App.Views.Form.ChartTypeSectionView( { dispatcher: this.dispatcher } );
			this.addDataSection = new App.Views.Form.AddDataSectionView( { dispatcher: this.dispatcher } );
			this.dimensionsSection = new App.Views.Form.DimensionsSectionView( { dispatcher: this.dispatcher } );
			this.selectedCountriesSection = new App.Views.Form.SelectedCountriesSectionView( { dispatcher: this.dispatcher } );
			this.entitiesSection = new App.Views.Form.EntitiesSectionView( { dispatcher: this.dispatcher } );
			this.timeSection = new App.Views.Form.TimeSectionView( { dispatcher: this.dispatcher } );

			this.render();

		},

		render: function() {
			
			this.$el.find( "[name=chart-name]" ).val( App.ChartModel.get( "chart-name" ) );
			this.$el.find( "[name=chart-subname]" ).val( App.ChartModel.get( "chart-subname" ) );

		}

	});

})();