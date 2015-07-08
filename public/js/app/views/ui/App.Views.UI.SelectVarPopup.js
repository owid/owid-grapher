;( function() {

	"use strict";

	var that;

	App.Views.UI.SelectVarPopup = function() {

		that = this;
		this.$div = null;

	};

	App.Views.UI.SelectVarPopup.prototype = {

		init: function( options ) {

			this.dispatcher = options.dispatcher;

			this.$el = $( ".select-var-popup" );
			this.$closeBtn = this.$el.find( ".close" );
			this.$saveBtn = this.$el.find( ".btn-primary" );
			this.$cancelBtn = this.$el.find( ".btn-default" );

			this.$chartVariable = this.$el.find( "[name=chart-variable]" );

			this.$closeBtn.on( "click", $.proxy( this.onCloseBtn, this ) );
			this.$saveBtn.on( "click", $.proxy( this.onSaveBtn, this ) );
			this.$cancelBtn.on( "click", $.proxy( this.onCancelBtn, this ) );
		
		},

		show: function() {

			this.$el.show();

		},

		hide: function() {

			this.$el.hide();

		},

		onCloseBtn: function( evt ) {

			evt.preventDefault();
			this.hide();

		},

		onSaveBtn: function( evt ) {

			evt.preventDefault();
			
			//trigger event only if something selected
			if( this.$chartVariable.val() > 0 ) {
				
				var varId = this.$chartVariable.val(),
					varName = this.$chartVariable.find( "option:selected" ).text();

				var variable = new App.Models.ChartVariableModel( { id:varId, name: varName } );
				App.ChartVariablesCollection.add( variable );
				//App.ChartModel.updateVariables( { id:varId, name: varName } );
				
				this.hide();

			}

		},

		onCancelBtn: function( evt ) {

			evt.preventDefault();
			this.hide();

		},

	};

})();
