;( function() {
	
	"use strict";

	App.Views.ImportView = Backbone.View.extend({

		el: "#import-view",
		events: {},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			this.$filePicker = this.$el.find( ".file-picker-wrapper [type=file]" );
			this.$dataInput = this.$el.find( "[name=data]" );
			
			var that = this;
			CSV.begin( this.$filePicker.selector )
			    .table( "csv-import-result", { header:1,caption:"Imported data" } )
				.go( function( err, data ) {
					that.onCsvSelected( err, data );
				} );
			
			this.render();

		},

		render: function() {

		},

		onCsvSelected: function( err, data ) {
			
			var mappedData = App.Utils.mapData( data.rows ),
				jsonString = JSON.stringify( mappedData );
			this.$dataInput.val( jsonString );

		}


	});

})();