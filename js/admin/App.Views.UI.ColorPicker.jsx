

;(function() {
	"use strict";
	owid.namespace("App.Views.UI.ColorPicker");

	App.Views.UI.ColorPicker = owid.View.extend({
		events: {
			"click .close-btn": "onClose",
			"click": "onClick",
			"input .hex-color": "onHexInput",
			"change .hex-color": "onChange"
		},

		initialize: function(options) {
			var $target = $(options.target),
				currentColor = options.currentColor || "",
				colors = options.colors || App.Colors.basicScheme;
			this.$target = $target;

			var html = "<div class='popup-picker-wrapper'><a href='#' class='close-btn pull-right'><i class='fa fa-times'></i></a><ul class='no-bullets'>";

			_.each(colors, function(color) {
				html += "<li data-value='" + color + "' style='background-color: " + color + "'></li>";
			});

			html += "</ul>";

			html += "<input style='width: 100%;' class='hex-color' title='RGB hex color code' type='text' value='" + currentColor + "'>";
					
			html += "</div>";
			this.setElement($(html).appendTo($target));

			// Clicking outside the colorpicker dismisses it
			setTimeout(function() {
				$(document).on("click.colorpicker", function(evt) {				
					if (!$(evt.target).closest(".popup-picker-wrapper").length)
						this.onClose();
				}.bind(this));
			}.bind(this), 0)
		},

		onHexInput: function(evt) {
			var value = $(evt.target).val();
			this.$target.css("background-color", value);
		},

		onClick: function(evt) {
			evt.stopImmediatePropagation();			
			if ($(evt.target).attr("data-value"))
				this.onChange(evt);
		},

		onChange: function(evt) {
			var value = $(evt.target).val() || $(evt.target).attr("data-value");
			if (this.onSelected) {
				this.onSelected.apply(this, [value]);
				this.onClose();
			}
		},

		onClose: function() {
			$(document).off("click.colorpicker");
			this.$el.remove();
		}
	});
	
})();