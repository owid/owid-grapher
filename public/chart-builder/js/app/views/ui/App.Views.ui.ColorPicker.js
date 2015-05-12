!( function() {

	"use strict";

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

	App.Views.UI.ColorPicker.COLOR_ARRAY = [ "#A52A2A", "#FF4040", "#EE3B3B", "#CD3333", "#5F9EA0", "#98F5FF", "#8EE5EE", "#7AC5CD", "#53868B", "#FFD700", "#EEC900", "#CDAD00", "#8B7500"  ];
	App.Views.UI.ColorPicker.WRAPPER_CLASS = "popup-picker-wrapper";
	
})();