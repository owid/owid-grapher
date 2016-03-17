;( function() {

	"use strict";

	var App = require( "./../../namespaces.js" );

	var that;

	App.Views.UI.ColorPicker = Backbone.View.extend({
		events: {
			"click .close-btn": "onClose",
			"click": "onClick",
			"input .hex-color": "onHexInput",
			"change .hex-color": "onChange"
		},

		initialize: function(options) {
			var $target = $(options.target),
				currentColor = options.currentColor || "",
				colors = options.colors || App.Views.UI.ColorPicker.COLOR_ARRAY;
			this.$target = $target;

			var html = "<div class='popup-picker-wrapper'><a href='#' class='close-btn pull-right'><i class='fa fa-times'></i></a><ul class='no-bullets'>"

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
			if (value && this.onSelected) {
				this.onSelected.apply(this, [value]);
				this.onClose();
			}
		},

		onClose: function() {
			$(document).off("click.colorpicker");
			this.$el.remove();
		}
	});

	//App.Views.UI.ColorPicker.COLOR_ARRAY = [ "#A52A2A", "#FF4040", "#EE3B3B", "#CD3333", "#5F9EA0", "#98F5FF", "#8EE5EE", "#7AC5CD", "#53868B", "#FFD700", "#EEC900", "#CDAD00", "#8B7500"  ];
	App.Views.UI.ColorPicker.COLOR_ARRAY = [ "#B0171F", "#DC143C", "#FF3E96", "#EE3A8C", "#DA70D6", "#FF83FA", "#8A2BE2", "#9B30FF", "#6959CD", "#473C8B", "#436EEE", "#3A5FCD", "#5CACEE", "#4F94CD", "#7AC5CD", "#53868B", "#66CDAA", "#458B74", "#43CD80", "#2E8B57", "#66CD00", "#CDCD00", "#FFEC8B", "#FFD700", "#FFC125", "#FFA500", "#FF7F50", "#FF4500", "#5B5B5B", "#8E8E8E", "#FFFFFF" ];
	
	module.exports = App.Views.UI.ColorPicker;

})();