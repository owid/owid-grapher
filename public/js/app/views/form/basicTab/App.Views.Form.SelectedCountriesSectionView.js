;( function() {
	
	"use strict";

	App.Views.Form.SelectedCountriesSectionView = Backbone.View.extend({

		el: "#form-view #basic-tab .selected-countries-box",
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

			$.each( selectedCountries, function( i, v ) {
				that.$el.append( "<li class='country-label' data-name='" + v + "'>" + v + "<span class='fa fa-remove'></span></li>" );
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
				colorPicker = new App.Views.UI.ColorPicker( $countryLabel );
				colorPicker.init( $countryLabel );
				colorPicker.onSelected = function( value ) {
					$countryLabel.css( "background-color", value );
					//$el.parent().parent().attr( "data-color", value );
					colorPicker.close();
					//that.$el.trigger( "change" );
				};

			} );	

			$lisRemoveBtns.on( "click", function( evt ) {

				evt.preventDefault();
				var $this = $( this ),
					$parent = $this.parent(),
					countryName = $parent.attr( "data-name" );
				App.ChartModel.removeSelectedCountry( countryName );

			})	
			
		}


	});

})();