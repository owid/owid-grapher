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

			this.formView = new App.Views.FormView( { dispatcher: dispatcher } );
			this.chartVew = new App.Views.ChartView( { dispatcher: dispatcher } );

		}

	});

})();
