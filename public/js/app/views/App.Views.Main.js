;( function() {
	
	"use strict";

	App.Views.Main = Backbone.View.extend({

		events: {},

		initialize: function() {

			this.$win = $( window );
			this.$win.on( "resize", this.onResize );
			this.onResize();

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
			
			//variable select
			if( App.Views.UI.VariableSelects ) {
				var variableSelects = new App.Views.UI.VariableSelects();
				variableSelects.init();
			}
			
		},

		onResize: function() {

			//var winHeight = this.$win.height();
			//$( ".tab-content" ).height( $( ".chart-wrapper-inner" ).height() - $( ".chart-header" ).height() ); //chart-header$( ".tab-content" ).css( );
			
			//$(".content-wrapper").css( { position:"absolute", top:0 left:0, right: 0, bottom:0 } );
			//$("svg").css('height', winHeight - $('.main-header').outerHeight() - 250);

		}

	});

})();
