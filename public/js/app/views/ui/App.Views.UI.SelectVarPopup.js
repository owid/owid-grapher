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

			this.$win = $( window );
			this.$el = $( ".select-var-popup" );
			this.$closeBtn = this.$el.find( ".close" );
			this.$saveBtn = this.$el.find( ".btn-primary" );
			this.$cancelBtn = this.$el.find( ".btn-default" );
			
			this.$variableWrapper = this.$el.find( ".variable-wrapper" );
			this.$categorySelect = this.$el.find( "[name=category-id]" );
			this.$subcategorySelect = this.$el.find( "[name=subcategory-id]" );
				
			this.$selectWrapper = this.$el.find( ".search-input-wrapper" );
			this.$selectVarSearch = this.$el.find( "[name=select_var_search]" );
			this.$selectResults = this.$el.find( ".search-results" );
			this.$searchIcon = this.$selectWrapper.find( ".fa-search" );
			this.$preloaderIcon = this.$selectWrapper.find( ".fa-spinner" );
			this.$clearIcon = this.$selectWrapper.find( ".fa-times" );
			this.$preloaderIcon.hide();
			this.$clearIcon.hide();

			this.$chartVariable = this.$el.find( "[name=chart-variable]" );
			
			this.$closeBtn.on( "click", $.proxy( this.onCloseBtn, this ) );
			this.$saveBtn.on( "click", $.proxy( this.onSaveBtn, this ) );
			this.$cancelBtn.on( "click", $.proxy( this.onCancelBtn, this ) );
			
			this.$selectVarSearch.on( "input", $.proxy( this.onSearchInput, this ) );
			this.$selectVarSearch.on( "focusin", $.proxy( this.onSearchFocusIn, this ) );
			this.$selectVarSearch.on( "focusout", $.proxy( this.onSearchFocusOut, this ) );

			this.$clearIcon.on( "click", $.proxy( this.onClearBtn, this ) );

			App.SearchDataCollection.on( "fetched", $.proxy( this.onSearchFetched, this ) );

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
					varUnit = this.$chartVariable.find( "option:selected" ).attr( "data-unit" ),
					varName = this.$chartVariable.find( "option:selected" ).text();

				var variable = new App.Models.ChartVariableModel( { id:varId, name: varName, unit: varUnit } );
				App.ChartVariablesCollection.add( variable );
				//App.ChartModel.updateVariables( { id:varId, name: varName } );
				
				this.hide();

			}

		},

		onCancelBtn: function( evt ) {

			evt.preventDefault();
			this.hide();

		},

		onSearchInput: function( evt ) {
			
			var $input = $( evt.currentTarget ),
				searchTerm = $input.val();

			if( searchTerm.length >= 2 ) {
				
				this.$clearIcon.hide();
				this.$searchIcon.hide();
				this.$preloaderIcon.show();

				App.SearchDataCollection.search( searchTerm );

			} else {

				//clear selection
				this.$selectResults.empty();
				this.$selectResults.hide();
				
				this.$clearIcon.hide();
				this.$searchIcon.show();

			}

		},

		onSearchFetched: function( evt ) {

			this.$clearIcon.show();
			this.$searchIcon.hide();
			this.$preloaderIcon.hide();

			this.$selectResults.empty();
			this.$selectResults.show();
			
			var results = App.SearchDataCollection.models,
				htmlString = "";
			_.each( results, function( result ) {
				htmlString += "<li data-cat-id='" + result.get( "fk_dst_cat_id" ) + "' data-subcat-id='" + result.get( "fk_dst_subcat_id" ) + "' data-var-id='" + result.get( "id" ) + "'>" + result.get( "name" ) + "</li>";
			} );

			this.$selectResults.append( $( htmlString ) );
			this.$lis = this.$selectResults.find( "li" );
			
			var that = this;
			this.$lis.on( "mousedown", function( evt ) {

				that.selectItem( $( evt.currentTarget ) );
				
			} );

		},

		selectItem: function( $li ) {

			var that = this,
				varId = $li.attr( "data-var-id" ),
				catId = $li.attr( "data-cat-id" ),
				subcatId = $li.attr( "data-subcat-id" );

			that.$categorySelect.find( "option[value=" + catId + "]" ).prop( "selected", true );
			that.$categorySelect.trigger( "change" );
			that.$subcategorySelect.find( "option[value=" + subcatId + "]" ).prop( "selected", true );
			that.$subcategorySelect.trigger( "change" );

			that.$variableWrapper.show();
			that.$chartVariable.find( "option[value=" + varId + "]" ).prop( "selected", true );

		},

		onSearchFocusIn: function() {
			//show select only if some results
			if( this.$selectResults.find( "li" ).length ) {
				this.$selectResults.show();
			}
			this.$keyDownHandler = $.proxy( this.onKeyDown, this );
			this.$win.on( "keydown", this.$keyDownHandler );
		},

		onSearchFocusOut: function( evt ) {
			that.$selectResults.hide();
			this.$win.off( "keydown", this.$keyDownHandler );
		},

		onKeyDown: function( evt ) {

			if( !this.$lis || !this.$lis.length ) {
				return;
			}

			var selectedIndex = this.$lis.filter( ".selected" ).index(),
				keyCode = evt.keyCode;
			
			if( keyCode === 40 || keyCode === 38 ) {

				if( keyCode === 40 ) {
					selectedIndex++;
					if( selectedIndex >= this.$lis.length ) {
						selectedIndex = 0;
					}
				} else if( keyCode === 38 ) {
					selectedIndex--;
				}

				this.$lis.removeClass( "selected" );
				this.$lis.eq( selectedIndex ).addClass( "selected" );
			
			} else if( keyCode === 13 ) {

				this.selectItem( this.$lis.eq( selectedIndex ) );
				this.$selectResults.hide();

			}

		},

		onClearBtn: function() {
			this.$selectVarSearch.val( "" );
			this.$selectVarSearch.trigger( "input" );
		}

	};

})();
