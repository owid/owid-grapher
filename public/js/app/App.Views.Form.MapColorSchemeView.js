;(function() {	
	"use strict";
	owid.namespace("App.Views.Form.MapColorSchemeView");

	var ColorPicker = App.Views.UI.ColorPicker;

	App.Views.Form.MapColorSchemeView = owid.View.extend({
		el: "#form-view #map-tab .map-color-scheme-preview",
		events: {},

		initialize: function(options) {
			this.dispatcher = options.dispatcher;
			
			this.$colorAutomaticClassification = $("[name='map-color-automatic-classification']");
			this.listenTo(this.$colorAutomaticClassification, "change", this.onAutomaticClassification.bind(this));
			this.$colorInvert = $("[name='map-color-invert']");
			this.listenTo(this.$colorInvert, "change", this.onColorInvert.bind(this));

			this.listenTo(App.ChartModel, "change", this.onChartModelChange.bind(this));

			this.render();
		},

		onChartModelChange: function() {
			this.mapConfig = App.ChartModel.get("map-config");
			this.render();
		},

		render: function() {
			var that = this,
				mapConfig = App.ChartModel.get("map-config"),
				colorScheme = owdColorbrewer.getColors(mapConfig);
			
			this.$el.empty();

			var html = "",
				//get values stored in the database
				colorSchemeKeys = _.map( colorScheme, function( d, i ) { return i; } ),
				colorSchemeInterval = mapConfig.colorSchemeInterval,
				colorSchemeValues = mapConfig.colorSchemeValues,
				colorSchemeLabels = mapConfig.colorSchemeLabels,
				minimalColorSchemeValue = ( mapConfig.colorSchemeMinValue )? mapConfig.colorSchemeMinValue: "";

			//minimal value option
			html += "<li class='clearfix min-color-wrapper'><span>Minimal value:</span><input class='map-color-scheme-value form-control' name='min-color-scheme-value' type='text' placeholder='Minimal value' value='" + minimalColorSchemeValue + "' /></li>";

			for( var i = 0; i < colorSchemeInterval; i++ ) {
				var key = colorSchemeKeys[ i ],
					color = ( colorScheme[ key ] )? colorScheme[ key ]: "#fff",
					value = ( colorSchemeValues && colorSchemeValues[ i ] )? colorSchemeValues[ i ]: "",
					label = ( colorSchemeLabels && colorSchemeLabels[ i ] )? colorSchemeLabels[ i ]: "";
				html += "<li class='clearfix'><span class='map-color-scheme-icon' style='background-color:" + color + ";' data-color='" + color + "'></span><input class='map-color-scheme-value form-control' name='map-scheme[]' type='text' placeholder='Maximum value' value='" + value + "' /><input class='map-color-scheme-label form-control' name='map-label[]' type='text' placeholder='Category label' value='" + label + "' /></li>";
			}
			this.$el.append( $( html ) );
			
			this.$lis = this.$el.find( ".map-color-scheme-icon" );
			this.$lis.on( "click", function( evt ) {

				evt.preventDefault();

				var $country = $(evt.currentTarget);
				if (that.colorPicker)
					that.colorPicker.onClose();

				that.colorPicker = new ColorPicker({ target: $country, currentColor: $country.attr("data-color") });
				that.colorPicker.onSelected = function( value ) {
					$country.css( "background-color", value );
					$country.attr( "data-color", value );
					that.updateColorScheme();
					//App.ChartModel.updateSelectedCountry( $countryLabel.attr( "data-id" ), value );
				};

			} );

			var colorSchemeValuesAutomatic = ( mapConfig.colorSchemeValuesAutomatic !== undefined )? mapConfig.colorSchemeValuesAutomatic: true;
			this.$el.toggleClass( "automatic-values", colorSchemeValuesAutomatic );
			this.$colorAutomaticClassification.prop( "checked", colorSchemeValuesAutomatic );
			this.$colorInvert.prop("checked", mapConfig.colorSchemeInvert);

			//react to user entering custom values
			this.$inputs = this.$el.find(".map-color-scheme-value");
			this.$inputs.on( "change", function( evt ) {
				that.updateSchemeValues( evt );
			} );

			this.$labelInputs = this.$el.find(".map-color-scheme-label");
			this.$labelInputs.on( "change", function( evt ) {
				that.updateSchemeLabels( evt );
			} );

		},

		updateColorScheme: function() {
			var colors = _.map(this.$lis, function(el) {
				return $(el).attr("data-color");
			});

			if (this.mapConfig.colorSchemeInvert)
				colors.reverse();

			App.ChartModel.updateMapConfig("customColorScheme", colors, true);
			App.ChartModel.updateMapConfig("colorSchemeName", "custom");
		},

		updateSchemeValues: function( evt ) {			
			//updating minimal value?
			var $minValueInput = this.$inputs.eq( 0 );
			if( $minValueInput.get( 0 ) == evt.currentTarget ) {

				App.ChartModel.updateMapConfig( "colorSchemeMinValue", $minValueInput.val() );
				
			} else {

				//update values
				var values = [];
				$.each( this.$inputs, function( i, d ) {
					//first input is minimal value
					if( i > 0 ) {
						var inputValue = $( d ).val();
						//if( inputValue ) {
							values.push( inputValue );
						//}
					}
				} );
			
				App.ChartModel.updateMapConfig( "colorSchemeValues", values );

			}			
		},

		updateSchemeLabels: function() {
			//update values
			var values = [];
			$.each(this.$labelInputs, function( i, d ) {
				var inputValue = $( d ).val();
					values.push( inputValue );
			});


			App.ChartModel.updateMapConfig("colorSchemeLabels", values);			
		},

		onAutomaticClassification: function(evt) {
			var checked = this.$colorAutomaticClassification.prop("checked");
			this.$el.toggleClass("automatic-values", checked);
			App.ChartModel.updateMapConfig("colorSchemeValuesAutomatic", checked);
		},

		onColorInvert: function(evt) {
			var checked = this.$colorInvert.prop("checked");
			App.ChartModel.updateMapConfig("colorSchemeInvert", checked);
		}
	});
})();