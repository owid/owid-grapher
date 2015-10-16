;( function() {
	
	"use strict";

	var App = require( "./../../../namespaces.js" ),
		ColorPicker = require( "./../../ui/App.Views.UI.ColorPicker.js" );

	App.Views.Form.MapColorSchemeView = Backbone.View.extend({

		el: "#form-view #map-tab .map-color-scheme-preview",
		events: {},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			
			App.ChartModel.on( "change", this.onChartModelChange, this );

			this.render();

		},

		render: function() {

			var that = this,
				mapConfig = App.ChartModel.get( "map-config" ),
				colorScheme;

			if( mapConfig.colorSchemeName !== "custom" ) {
				colorScheme = ( owdColorbrewer[ mapConfig.colorSchemeName ] && owdColorbrewer[ mapConfig.colorSchemeName ][ mapConfig.colorSchemeInterval ] )? owdColorbrewer[ mapConfig.colorSchemeName ][ mapConfig.colorSchemeInterval ]: [];
			} else if( mapConfig.colorSchemeName ) {
				colorScheme = mapConfig.customColorScheme;
			}
			
			this.$el.empty();

			var html = "",
				colorSchemeKeys = _.map( colorScheme, function( d, i ) {
					return i;
				} ),
				colorSchemeInterval = mapConfig.colorSchemeInterval;
			for( var i = 0; i < colorSchemeInterval; i++ ) {
				var key = colorSchemeKeys[ i ],
					color = ( colorScheme[ key ] )? colorScheme[ key ]: "#fff";
				html += "<li style='background-color:" + color + ";' data-color='" + color + "'></li>";
			}
			this.$el.append( $( html ) );
			
			this.$lis = this.$el.find( "li" );
			this.$lis.on( "click", function( evt ) {

				evt.preventDefault();

				var $country = $( evt.currentTarget );
				if( that.colorPicker ) {
					that.colorPicker.close();
				}
				that.colorPicker = new ColorPicker( $country );
				that.colorPicker.init( $country );
				that.colorPicker.onSelected = function( value ) {
					$country.css( "background-color", value );
					$country.attr( "data-color", value );
					that.updateColorScheme();
					//App.ChartModel.updateSelectedCountry( $countryLabel.attr( "data-id" ), value );
					that.colorPicker.close();
				};

			} );

		},

		updateColorScheme: function() {
			var colors = [];
			$.each( this.$lis, function( i, d ) {
				colors.push( $( d ).attr( "data-color" ) );
			} );
			App.ChartModel.updateMapConfig( "customColorScheme", colors, true );
			App.ChartModel.updateMapConfig( "colorSchemeName", "custom" );
		},

		onChartModelChange: function() {
			this.render();
		}

	});
	
	module.exports = App.Views.Form.MapColorSchemeView;

})();