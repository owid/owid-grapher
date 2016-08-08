;(function() {	
	"use strict";
	owid.namespace("App.Views.Form.MapColorSection");

	var ColorPicker = App.Views.UI.ColorPicker;

	App.Views.Form.MapColorSection = owid.View.extend({
		el: "#form-view #map-tab .map-colors-section",
		events: {
			"change [name='map-color-scheme']": "onColorSchemeChange",
			"change [name='map-color-interval']": "onNumIntervalChange",
		},

		initialize: function(options) {
			this.dispatcher = options.dispatcher;
			
			this.$colorSchemeSelect = this.$("[name='map-color-scheme']");
			this.$numberOfIntervals = this.$("[name='map-color-interval']");
			this.$colorAutomaticClassification = this.$("[name='map-color-automatic-classification']");
			this.$colorInvert = this.$("[name='map-color-invert']");
			this.$preview = this.$(".map-color-scheme-preview");

			this.listenTo(this.$colorAutomaticClassification, "change", this.onAutomaticClassification.bind(this));
			this.listenTo(this.$colorInvert, "change", this.onColorInvert.bind(this));

			this.listenTo(App.MapModel, "change", this.update.bind(this));
			this.update();
		},

		update: function() {
			App.ChartData.ready(function() {
				this.render();
			}.bind(this));
		},

		render: function() {
			var variable = App.MapModel.getVariable(),
				isNumeric = variable.isNumeric,
				colorScheme = App.MapModel.getColors(),
				colorSchemeName = App.MapModel.get("colorSchemeName"),
				colorSchemeInterval = App.MapModel.get("colorSchemeInterval"),
				colorSchemeValues = App.MapModel.get("colorSchemeValues"),
				colorSchemeLabels = App.MapModel.get("colorSchemeLabels"),
				colorSchemeValuesAutomatic = App.MapModel.get("colorSchemeValuesAutomatic") || !isNumeric,
				colorSchemeInvert = App.MapModel.get("colorSchemeInvert"),
				minimalColorSchemeValue = App.MapModel.get("colorSchemeMinValue") || "",
				html = "";

			// List the available color schemes to choose from
			this.$colorSchemeSelect.empty();
			_.each(owdColorbrewer, function(v, k) {
				this.$colorSchemeSelect.append('<option value="' + k + '">' + v.name + '</option>');
			}.bind(this));
			this.$colorSchemeSelect.val(colorSchemeName);

			// Numeric data is colored by value ranges and so has more options than categorical
			if (isNumeric) {
				this.$numberOfIntervals.closest('label').show();
				this.$colorAutomaticClassification.closest('label').show();
				this.$colorInvert.closest('label').show();
			} else {
				this.$numberOfIntervals.closest('label').hide();
				this.$colorAutomaticClassification.closest('label').hide();
				this.$colorInvert.closest('label').hide();
			}
	
			this.$preview.empty();				

			//minimal value option
			this.$preview.append("<li class='clearfix min-color-wrapper'><span>Minimal value:</span><input class='map-color-scheme-value form-control' name='min-color-scheme-value' type='text' placeholder='Minimal value' value='" + minimalColorSchemeValue + "' /></li>");

			for (var i = 0; i < colorScheme.length; i++ ) {				
				var color = colorScheme[i], value, label;

				if (isNumeric) {
					value = (colorSchemeValues && colorSchemeValues[i]) ? colorSchemeValues[i] : "";
					label = (colorSchemeLabels && colorSchemeLabels[i]) ? colorSchemeLabels[i] : "";
				} else {
					value = "";
					label = variable.uniqueValues[i];
				}

				var $li = $('<li class="clearfix">' +
							'<span class="map-color-scheme-icon" style="background-color:' + color + ';" data-color="' + color + '"></span>' +
							'<input class="map-color-scheme-value form-control" name="map-scheme[]" type="text" placeholder="Maximum value" value="' + value + '"/>' +
							'<input class="map-color-scheme-label form-control" name="map-label[]" type="text" placeholder="Category label" value="' + label + '"/>' +
						'</li>');

				$li.find(".map-color-scheme-label").prop("disabled", !isNumeric);

				this.$preview.append($li);
			}
			
			this.$lis = this.$(".map-color-scheme-icon");
			this.$lis.on("click", function(evt) {
				evt.preventDefault();

				var $country = $(evt.currentTarget);
				if (this.colorPicker)
					this.colorPicker.onClose();

				this.colorPicker = new ColorPicker({ target: $country, currentColor: $country.attr("data-color") });
				this.colorPicker.onSelected = function(value) {
					$country.css("background-color", value);
					$country.attr("data-color", value);
					this.updateColorScheme();
				}.bind(this);
			}.bind(this));

			this.$preview.toggleClass("automatic-values", colorSchemeValuesAutomatic);
			this.$colorAutomaticClassification.prop("checked", colorSchemeValuesAutomatic);
			this.$colorInvert.prop("checked", colorSchemeInvert);

			//react to user entering custom values
			this.$inputs = this.$(".map-color-scheme-value");
			this.$inputs.on("change", function(evt) {
				this.updateSchemeValues(evt);
			}.bind(this));

			this.$labelInputs = this.$(".map-color-scheme-label");
			this.$labelInputs.on("change", function(evt) {
				this.updateSchemeLabels(evt);
			}.bind(this));

		},

		onColorSchemeChange: function() {
			var colorSchemeName = this.$colorSchemeSelect.val(),
				customColorScheme = App.MapModel.get("customColorScheme");

			// If this is the first time we switch to custom, populate custom
			// values with the current color scheme
			if (colorSchemeName == "custom" && _.isEmpty(customColorScheme))
				App.MapModel.set("customColorScheme", owdColorbrewer.getColors(App.MapModel.attributes), { silent: true });

			App.MapModel.set("colorSchemeName", colorSchemeName);
		},

		onNumIntervalChange: function( evt ) {
			var $this = $( evt.target );
			App.ChartModel.updateMapConfig( "colorSchemeInterval", parseInt( $this.val(), 10 ) );
		},

		updateColorScheme: function() {
			var colors = _.map(this.$lis, function(el) {
				return $(el).attr("data-color");
			});

			if (App.MapModel.get("colorSchemeInvert"))
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