;( function() {
	
	"use strict";

	var ChartModel = require( "./../models/App.Models.ChartModel.js" ),
		FormView = require( "./App.Views.FormView.js" ),
		ChartView = require( "./App.Views.ChartView.js" ),
		ImportView = require( "./App.Views.ImportView.js" ),
		VariableSelects = require( "./ui/App.Views.UI.VariableSelects.js" ),
		Utils = require( "./../App.Utils.js" );

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

			/*if( FormView ) {
				this.formView = new FormView( { dispatcher: dispatcher } );
			}*/
			if( ChartView ) {
				this.chartView = new ChartView( { dispatcher: dispatcher } );
			}
			/*if( ImportView ) {
				this.importView = new ImportView( {dispatcher: dispatcher } );
			}*/

			//variable select
			if( VariableSelects ) {
				var variableSelects = new VariableSelects();
				variableSelects.init();
			}

			//validate 
			var $validateForms = $( ".validate-form" );
			if( $validateForms.length ) {

				$validateForms.on( "submit", function( evt ) {
					var $form = $( evt.currentTarget ),
						valid = Utils.FormHelper.validate( $form );
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

	module.exports = App.Views.Main;

})();
