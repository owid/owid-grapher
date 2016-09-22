;(function() {	
	"use strict";
	owid.namespace("App.Views.Form.MapColorSection");

	var ColorPicker = App.Views.UI.ColorPicker;

	App.Views.Form.MapColorSection = owid.View.extend({
		el: "#form-view #map-tab .map-colors-section",
		events: {
			"change [name='map-color-scheme']": "onColorSchemeChange",
			"change [name='map-color-interval']": "onNumIntervalChange",
			"change .map-color-scheme-value": "saveValuesLabels",
			"change .map-color-scheme-label": "saveValuesLabels"
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

			this.listenTo(chart.map, "change", this.update.bind(this));
			this.update();
		},

		update: function() {
			App.ChartData.ready(function() {
				this.render();
			}.bind(this));
		},

		render: function() {
			chart.mapdata.update();
			if (!chart.mapdata.legendData) return;

			var variable = chart.map.getVariable();
			if (!variable) return;

			var legendData = chart.mapdata.legendData,
				baseColorScheme = chart.map.get('baseColorScheme'),
				customColorsActive = chart.map.get('customColorsActive'),
				colorSchemeName = customColorsActive ? 'custom' : baseColorScheme,
				colorSchemeValuesAutomatic = chart.map.get('colorSchemeValuesAutomatic'),
				colorSchemeValues = chart.map.get('colorSchemeValues'),
				colorSchemeInvert = chart.map.get('colorSchemeInvert'),
				numIntervals = chart.map.get('colorSchemeInterval'),
				minValue = chart.map.get('colorSchemeMinValue');

			if (!minValue && minValue != 0) minValue = "";

			// List the available color schemes to choose from
			this.$colorSchemeSelect.empty();
			_.each(owid.colorbrewer, function(v, k) {
				if (v.name)
					this.$colorSchemeSelect.append('<option value="' + k + '">' + v.name + '</option>');
			}.bind(this));
			this.$colorSchemeSelect.val(colorSchemeName);

			this.$numberOfIntervals.val(numIntervals);
	
			this.$preview.empty();				

			this.$numberOfIntervals.closest('label').toggle(variable.hasNumericValues);
			this.$colorAutomaticClassification.closest('label').toggle(variable.hasNumericValues && numIntervals >= 1);

			if (variable.hasNumericValues && numIntervals >= 1) {
  	        	this.$preview.append("<li class='clearfix min-color-wrapper'><span>Minimal value:</span><input class='map-color-scheme-value form-control' name='min-color-scheme-value' type='text' placeholder='Minimal value' value='" + minValue + "' /></li>");
			}

			_.each(legendData, function(l, i) {
				var $li;
				if (l.type == 'numeric') {
					$li = $('<li class="numeric clearfix">' +
								'<span class="map-color-scheme-icon" style="background-color:' + l.color + ';" data-color="' + l.color + '"></span>' +
								'<input class="map-color-scheme-value form-control" name="map-scheme[]" type="text" placeholder="Maximum value" value="' + l.max + '"/>' +
								'<input class="map-color-scheme-label form-control" name="map-label[]" type="text" placeholder="Custom label" value="' + l.label + '"/>' +
	 						'</li>');
				} else {
					$li = $('<li class="categorical clearfix">' +
								'<span class="map-color-scheme-icon" style="background-color:' + l.color + ';" data-color="' + l.color + '"></span>' +
								'<input class="map-color-scheme-value form-control" disabled name="map-scheme[]" type="text" placeholder="Category" value="' + l.value + '"/>' +
								'<input class="map-color-scheme-label form-control" name="map-label[]" type="text" placeholder="Custom label" value="' + l.label + '"/>' +
	 						'</li>');
				}

				this.$preview.append($li);
			}.bind(this));

			this.$lis = this.$("li.numeric, li.categorical");

			if (colorSchemeValuesAutomatic)
				this.$lis.find('.map-color-scheme-value').prop('disabled', true);

			this.$lis.find('.map-color-scheme-icon').on("click", function(evt) {
				evt.preventDefault();

				var $country = $(evt.currentTarget);
				if (this.colorPicker)
					this.colorPicker.onClose();

				this.colorPicker = new ColorPicker({ target: $country, currentColor: $country.attr("data-color") });
				this.colorPicker.onSelected = function(value) {
					$country.css("background-color", value);
					$country.attr("data-color", value);
					this.saveCustomColors();
				}.bind(this);
			}.bind(this));

			this.$preview.toggleClass("automatic-values", colorSchemeValuesAutomatic);
			this.$colorAutomaticClassification.prop("checked", colorSchemeValuesAutomatic);
			// Inverting colors when they're already customized has confusing results, so disable
			this.$colorInvert.closest('label').toggle(!customColorsActive);
			this.$colorInvert.prop("checked", colorSchemeInvert);
		},

		onColorSchemeChange: function() {
			var colorSchemeName = this.$colorSchemeSelect.val();

			if (colorSchemeName == 'custom') {
				chart.map.set('customColorsActive', true);
			} else {
				chart.map.set({
					customColorsActive: false,
					baseColorScheme: colorSchemeName
				});
			}
		},

		// Expand or retract the number of numeric intervals with associated colors
		onNumIntervalChange: function() {
			chart.map.set('colorSchemeInterval', this.$numberOfIntervals.val());
		},

		// Compares the selected colors to the base colors, and then saves
		// any customizations
		saveCustomColors: function() {
			var customNumericColors = [],
				customCategoryColors = {},
				seenCustom = false,
				$colorSpans = this.$lis.find('span[data-color]');

			for (var i = 0; i < chart.mapdata.legendData.length; i++) {
				var $span = $colorSpans.eq(i),
					$li = $span.closest('li'),
					bucket = chart.mapdata.legendData[i],
					color = $span.attr('data-color');

				if (color != bucket.baseColor)
					seenCustom = true;

				if ($li.hasClass('numeric'))
					customNumericColors.push(color);
				else if ($li.hasClass('categorical')) {
					var value = $li.find('.map-color-scheme-value').val();
					customCategoryColors[value] = color;
				}
			}

			var customColorsActive = chart.map.get('customColorsActive') || seenCustom;
			if (!customColorsActive) return;

			chart.map.set({
				customNumericColors: customNumericColors,
				customCategoryColors: customCategoryColors,
				customColorsActive: customColorsActive
			});
		},

		saveValuesLabels: function() {
			var colorSchemeValues = [],
				colorSchemeLabels = [],				
				customCategoryLabels = {};

			var minValue = this.$('[name=min-color-scheme-value]').val();

			_.each(this.$lis, function(el) {
				var $li = $(el);

				var value = $li.find('.map-color-scheme-value').val(),
					label = $li.find('.map-color-scheme-label').val();

				if ($li.hasClass('numeric')) {
					colorSchemeValues.push(value);
					colorSchemeLabels.push(label);
				} else if ($li.hasClass('categorical')) {
					if (label) customCategoryLabels[value] = label;
				}
			});

			chart.map.set({
				colorSchemeMinValue: minValue,
				colorSchemeValues: colorSchemeValues,
				colorSchemeLabels: colorSchemeLabels,
				customCategoryLabels: customCategoryLabels
			});
		},

		onAutomaticClassification: function(evt) {
			var checked = this.$colorAutomaticClassification.prop("checked");
			this.$el.toggleClass("automatic-values", checked);
			chart.map.set("colorSchemeValuesAutomatic", checked);
		},

		onColorInvert: function(evt) {
			var checked = this.$colorInvert.prop("checked");
			chart.map.set("colorSchemeInvert", checked);
		}
	});
})();