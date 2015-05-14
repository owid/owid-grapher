;( function() {
	
	"use strict";

	App.Views.Main = Backbone.View.extend({

		events: {},

		initialize: function() {
			this.render();
		},

		render: function() {
			
			var dispatcher = _.clone( Backbone.Events );
			this.dispatcher = dispatcher;

			if( App.Views.FormView ) {
				this.formView = new App.Views.FormView( { dispatcher: dispatcher } );
			} 
			if( App.Views.ChartView ) {
				this.chartVew = new App.Views.ChartView( { dispatcher: dispatcher } );
			}
			if( App.Views.ImportView ) { 
				this.importView = new App.Views.ImportView( {dispatcher: dispatcher } );
			}
			
		}

	});

})();
