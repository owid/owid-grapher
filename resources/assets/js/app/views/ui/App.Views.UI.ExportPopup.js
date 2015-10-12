;( function() {

	"use strict";

	var App = require( "./../../namespaces.js" );
	
	var that;

	App.Views.UI.ExportPopup = function() {

		that = this;
		this.$div = null;

	};

	App.Views.UI.ExportPopup.prototype = {

		init: function( options ) {

			this.dispatcher = options.dispatcher;

			this.$el = $( ".export-popup" );
			this.$closeBtn = this.$el.find( ".close" );
			this.$exportBtn = this.$el.find( ".btn-primary" );
			
			this.$exportFormat = this.$el.find( "[name='export-format']" );
			this.$exportWidth = this.$el.find( "[name='export-width']" );
			this.$exportHeight = this.$el.find( "[name='export-height']" );

			this.$exportWidth.on( "input", $.proxy( this.onDimensionChange, this ) );
			this.$exportHeight.on( "input", $.proxy( this.onDimensionChange, this ) );
			
			this.$closeBtn.on( "click", $.proxy( this.onCloseBtn, this ) );
			this.$exportBtn.on( "click", $.proxy( this.onExportBtn, this ) );
			
		},

		show: function() {

			this.$el.show();
			this.dispatcher.trigger( "dimension-export-update", this.serializeForm() );

		},

		hide: function() {

			this.$el.hide();

		},

		onCloseBtn: function( evt ) {

			evt.preventDefault();
			this.hide();
			this.dispatcher.trigger( "dimension-export-cancel", this.serializeForm() );

		},

		onDimensionChange: function( evt ) {
			
			this.dispatcher.trigger( "dimension-export-update", this.serializeForm() );

		},

		onExportBtn: function( evt ) {

			evt.preventDefault();
			this.dispatcher.trigger( "dimension-export", this.serializeForm() );

		},

		serializeForm: function() {
			
			var obj = { width: this.$exportWidth.val(), height: this.$exportHeight.val(), format: this.$exportFormat.filter( ":checked" ).val() };
			return obj;
			
		}

	};

	module.exports = App.Views.UI.ExportPopup;

})();
