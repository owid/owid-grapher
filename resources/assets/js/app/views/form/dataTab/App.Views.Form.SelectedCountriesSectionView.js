;( function() {
	
	"use strict";

	var App = require( "./../../../namespaces.js" ),
		ColorPicker = require( "./../../ui/App.Views.UI.ColorPicker.js" );

	App.Views.Form.SelectedCountriesSectionView = Backbone.View.extend({

		el: "#form-view #data-tab .selected-countries-box",
		events: {},

		initialize: function( options ) {
			this.dispatcher = options.dispatcher;

			App.ChartModel.on( "change:selected-countries", this.render, this );

			this.render();

		},

		render: function() {

			//remove everything
			this.$el.empty();

			var that = this,
				selectedCountries = App.ChartModel.get( "selected-countries" );

			_.each( selectedCountries, function( v, i ) {
				var $li = $( "<li class='country-label' data-id='" + v.id + "' data-name='" + v.name + "'>" + v.name + "<span class='fa fa-remove'></span></li>" );
				that.$el.append( $li );
				if( v.color ) {
					$li.css( "background-color", v.color );
				}
			} );

			var $lis = this.$el.find( ".country-label" ),
				$lisRemoveBtns = $lis.find( ".fa-remove" ),
				colorPicker = null;

			$lis.on( "click", function( evt ) {

				evt.preventDefault();

				var $countryLabel = $( evt.currentTarget );
				if( colorPicker ) {
					colorPicker.close();
				}
				colorPicker = new ColorPicker( $countryLabel );
				colorPicker.init( $countryLabel );
				colorPicker.onSelected = function( value ) {
					$countryLabel.css( "background-color", value );
					$countryLabel.attr( "data-color", value );
					App.ChartModel.updateSelectedCountry( $countryLabel.attr( "data-id" ), value );
					colorPicker.close();
					//that.$el.trigger( "change" );
				};

			} );	

			$lisRemoveBtns.on( "click", function( evt ) {

				evt.stopImmediatePropagation();
				
				var $this = $( this ),
					$parent = $this.parent(),
					countryId = $parent.attr( "data-id" );
				App.ChartModel.removeSelectedCountry( countryId );

			})	
			
		}

	});
	
	module.exports = App.Views.Form.SelectedCountriesSectionView;

})();