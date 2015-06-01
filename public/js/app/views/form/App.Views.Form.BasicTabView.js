;( function() {
	
	"use strict";

	App.Views.Form.BasicTabView = Backbone.View.extend({

		el: "#form-view #basic-tab",
		events: {
			"click .add-data-btn": "onAddDataBtn",
			//"change [name=chart-variable]": "onChartVariableChange",
			//"change [name=category-id]": "onCategoryChange",
			//"change [name=subcategory-id]": "onSubCategoryChange",
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
			
		}


		/*onChartVariableChange: function() {

			console.log( "on chart onChartVariableChange" ); 
			App.ChartModel.set( "chart-variable", this.$chartVariable.val() );

		}*/


	});

})();