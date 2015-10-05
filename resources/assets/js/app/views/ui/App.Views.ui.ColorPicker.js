;( function() {

	"use strict";

	var App = require( "./../../namespaces.js" );

	var that;

	App.Views.UI.ColorPicker = function() {
		that = this;
		this.$div = null;
	
		this.init = function( $el, data ) {

			var lisString = "",
				$lis;

			if( !data ) {
				data = App.Views.UI.ColorPicker.COLOR_ARRAY;
			}

			//DOM stuff			
			$.each( data, function( i, d ) {
				lisString += "<li data-value='" + d + "' style='background-color:" + d + "'></li>";
			} );
			this.$div = $( "<div class='" + App.Views.UI.ColorPicker.WRAPPER_CLASS + "'><ul class='no-bullets'>" + lisString + "</ul></div>" );
			$el.append( this.$div );
			$lis = this.$div.find( "li" );

			//prevent movement
			this.$div.on( "mousedown", function( evt ) {
				evt.stopImmediatePropagation();
			} );
			$lis.on( "mousedown", this.onMouseDown );
		};

		this.onMouseDown = function( evt ) {
			evt.stopImmediatePropagation();
			var value = $( this ).attr( "data-value" );
			if( that.onSelected ) {
				that.onSelected.apply( that, [ value ] );
			}
		};

		this.close = function() {
			this.$div.remove();
		};

	};

	//App.Views.UI.ColorPicker.COLOR_ARRAY = [ "#A52A2A", "#FF4040", "#EE3B3B", "#CD3333", "#5F9EA0", "#98F5FF", "#8EE5EE", "#7AC5CD", "#53868B", "#FFD700", "#EEC900", "#CDAD00", "#8B7500"  ];
	App.Views.UI.ColorPicker.COLOR_ARRAY = [ "#B0171F", "#DC143C", "#FF3E96", "#EE3A8C", "#DA70D6", "#FF83FA", "#8A2BE2", "#9B30FF", "#6959CD", "#473C8B", "#436EEE", "#3A5FCD", "#5CACEE", "#4F94CD", "#7AC5CD", "#53868B", "#66CDAA", "#458B74", "#43CD80", "#2E8B57", "#66CD00", "#CDCD00", "#FFEC8B", "#FFD700", "#FFC125", "#FFA500", "#FF7F50", "#FF4500", "#5B5B5B", "#8E8E8E" ];
	App.Views.UI.ColorPicker.WRAPPER_CLASS = "popup-picker-wrapper";
	
	module.exports = App.Views.UI.ColorPicker;

})();