!( function() {

	"use strict";

	var that;

	App.Views.UI.VariableSelects = function() {

		that = this;
		this.$div = null;

	};

	App.Views.UI.VariableSelects.prototype = {

		init: function() {

			this.$el = $( ".form-variable-select-wrapper" );
			this.$categorySelect = this.$el.find( "[name=category-id]" );
			this.$subcategorySelect = this.$el.find( "[name=subcategory-id]" );
			this.$chartVariable = this.$el.find( "[name=chart-variable]" );
			
			this.$categorySelect.on( "change", $.proxy( this.onCategoryChange, this ) );
			this.$subcategorySelect.on( "change", $.proxy( this.onSubCategoryChange, this ) );

			this.$subcategorySelect.hide();
			this.$chartVariable.hide();

		},

		onCategoryChange: function( evt ) {
			
			var $input = $( evt.currentTarget );
			if( $input.val() != "" ) {
				this.$subcategorySelect.show();
				this.$subcategorySelect.css( "display", "block" );
			} else {
				this.$subcategorySelect.hide();
				this.$chartVariable.hide();
			}

			//filter subcategories select
			this.$subcategorySelect.find( "option" ).hide();
			this.$subcategorySelect.find( "option[data-category-id=" + $input.val() + "]" ).show();

		},

		onSubCategoryChange: function( evt ) {

			var $input = $( evt.currentTarget );
			if( $input.val() != "" ) {
				this.$chartVariable.show();
			} else {
				this.$chartVariable.hide();
			}
			
			//filter subcategories select
			this.$chartVariable.find( "option:not(:disabled)" ).hide();
			this.$chartVariable.find( "option[data-subcategory-id=" + $input.val() + "]" ).show();

		}

	};

})();
