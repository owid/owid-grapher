;(function() {	
	"use strict";
	owid.namespace("App.Views.Form.EntitiesSectionView");

	App.Views.Form.EntitiesSectionView = Backbone.View.extend({

		el: "#form-view #data-tab .entities-section",
		events: {
			"change .countries-select": "onCountriesSelect",
			"change [name='add-country-mode']": "onAddCountryModeChange"
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			//App.AvailableEntitiesCollection.on( "change add remove reset", this.render, this );
			//available entities are changing just on fetch so listen just for that
			App.AvailableEntitiesCollection.on( "reset fetched", this.render, this );
			
			this.$entitiesSelect = this.$el.find( ".countries-select" );
			this.$addCountryControlInput = this.$el.find( "[name='add-country-control']" );

			this.render();

		},

		render: function() {

			var $entitiesSelect = this.$entitiesSelect;
			$entitiesSelect.empty();
			
			//append default 
			$entitiesSelect.append( $( "<option selected disabled>Select entity</option>" ) );

			App.AvailableEntitiesCollection.each( function( model ) {
				$entitiesSelect.append( $( "<option value='" + model.get( "id" ) + "'>" + model.get( "name" ) + "</option>" ) );
			});

			var addCountryControl = App.ChartModel.get( "add-country-control" );
			this.$addCountryControlInput.prop( "checked", addCountryControl );

			//based on stored add-country-mode
			var addCountryMode = App.ChartModel.get( "add-country-mode" );
			this.$el.find( "[name='add-country-mode']" ).filter( "[value='" + addCountryMode + "']" ).prop( "checked", true );

		},

		onCountriesSelect: function( evt ) {

			var $select = $( evt.target ),
				val = $select.val(),
				$option = $select.find( "option[value=" + val + "]" ),
				text = $option.text();

			App.ChartModel.addSelectedCountry( { id: val, name: text } );

		},

		onAddCountryModeChange: function( evt ) {

			var $input = $( "[name='add-country-mode']:checked" );
			App.ChartModel.set( "add-country-mode", $input.val() );

		}


	});
})();