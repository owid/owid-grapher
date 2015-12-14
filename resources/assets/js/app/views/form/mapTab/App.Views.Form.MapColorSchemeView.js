;( function() {
	
	"use strict";

	var App = require( "./../../../namespaces.js" ),
		ColorPicker = require( "./../../ui/App.Views.UI.ColorPicker.js" );

	App.Views.Form.MapColorSchemeView = Backbone.View.extend({

		el: "#form-view #map-tab .map-color-scheme-preview",
		events: {},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			
			this.$colorAutomaticClassification = $("[name='map-color-automatic-classification']");

			App.ChartModel.on( "change", this.onChartModelChange, this );

			this.$colorAutomaticClassification.on( "change", this.onAutomaticClassification.bind(this) );

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
				//get values stored in the database
				colorSchemeKeys = _.map( colorScheme, function( d, i ) {
					return i;
				} ),
				colorSchemeInterval = mapConfig.colorSchemeInterval,
				colorSchemeValues = mapConfig.colorSchemeValues;

			for( var i = 0; i < colorSchemeInterval; i++ ) {
				var key = colorSchemeKeys[ i ],
					color = ( colorScheme[ key ] )? colorScheme[ key ]: "#fff",
					value = ( colorSchemeValues && colorSchemeValues[ i ])? colorSchemeValues[ i ]: "";
				html += "<li class='clearfix'><span class='map-color-scheme-icon' style='background-color:" + color + ";' data-color='" + color + "'></span><input class='map-color-scheme-value form-control' name='map-scheme[]' type='text' placeholder='Maximum value' value='" + value + "' /></li>";
			}
			this.$el.append( $( html ) );
			
			this.$lis = this.$el.find( ".map-color-scheme-icon" );
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

			this.$el.toggleClass( "colorSchemeValuesAutomatic", mapConfig.colorSchemeValuesAutomatic );
			
			//react to user entering custom values
			this.$inputs = this.$el.find(".map-color-scheme-value");
			this.$inputs.on( "change", function( evt ) {
				that.updateSchemeValues();
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

		updateSchemeValues: function() {
			var values = [];
			$.each( this.$inputs, function( i, d ) {
				var inputValue = $( d ).val();
				if( inputValue ) {
					values.push( inputValue );
				}
			} );
			App.ChartModel.updateMapConfig( "colorSchemeValues", values );
		},

		onChartModelChange: function() {
			this.render();
		},

		onAutomaticClassification: function(evt) {
			var $target = $( evt.target ),
				checked = $target.prop( "checked" );
			this.$el.toggleClass( "automatic-values", checked );

			App.ChartModel.updateMapConfig( "colorSchemeValuesAutomatic", checked );
		}

	});
	
	module.exports = App.Views.Form.MapColorSchemeView;

})();