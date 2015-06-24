;( function() {
	
	"use strict";

	App.Views.Main = Backbone.View.extend({

		events: {},

		initialize: function() {

			this.$win = $( window );
			this.$win.on( "resize", this.onResize );
			this.onResize();
		},

		start: function() {
			//render everything for the first time
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

			//validate 
			var $validateForms = $( ".validate-form" );
			if( $validateForms.length ) {

				$validateForms.on( "submit", function( evt ) {
					var $form = $( evt.currentTarget ),
						valid = App.Utils.FormHelper.validate( $form );
					if( !valid ) {
						evt.preventDefault();
						evt.stopImmediatePropagation();
					}
				} );
			}

			//delete buttons
			$( ".delete-btn, .btn-danger" ).on( "click", function( evt ) {

				var confirm = window.confirm( "Are you sure?" );
				if( !confirm ) {
					evt.preventDefault();
				}

			});

			//chosen select
			$( ".chosen-select" ).chosen();
			
		},

		onResize: function() {

		}

	});

})();
