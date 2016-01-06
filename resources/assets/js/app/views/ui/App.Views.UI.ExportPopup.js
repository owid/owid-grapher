;( function() {

	"use strict";

	var App = require( "./../../namespaces.js" );
	

	var MAX_WIDTH = 2200,
		MAX_HEIGHT = 1800;

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
			
			//sections
			this.$formatSection = this.$el.find( ".format-section" );
			this.$dimensionSection = this.$el.find( ".dimension-section" );
			this.$iframeSection = this.$el.find( ".iframe-section" );

			this.$exportFormat = this.$el.find( "[name='export-format']" );
			this.$exportWidth = this.$el.find( "[name='export-width']" );
			this.$exportHeight = this.$el.find( "[name='export-height']" );
			this.$pngConstraintLabel = this.$el.find( ".png-constraint-label" );

			this.$exportWidth.on( "input", $.proxy( this.onDimensionChange, this ) );
			this.$exportHeight.on( "input", $.proxy( this.onDimensionChange, this ) );
			this.$exportFormat.on( "change", $.proxy( this.onExportFormat, this ) );

			this.$iframeSrc = this.$iframeSection.find( "textarea" );

			this.$closeBtn.on( "click", $.proxy( this.onCloseBtn, this ) );
			this.$exportBtn.on( "click", $.proxy( this.onExportBtn, this ) );
			
			//update export code from 
			var chartId = App.ChartModel.get( "id" );
			if( chartId ) {
				var viewUrl = this.$iframeSrc.attr( "data-view-url" );
				this.generateIframeCode( chartId, viewUrl );
			}

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

			this.checkPngConstraint();
			this.dispatcher.trigger( "dimension-export-update", this.serializeForm() );

		},

		onExportBtn: function( evt ) {

			evt.preventDefault();
			if( !this.$pngConstraintLabel.is( ":visible" ) ) {
				this.dispatcher.trigger( "dimension-export", this.serializeForm() );
			}
			
		},

		onExportFormat: function( evt ) {
			this.checkPngConstraint( true );
			this.toggleSections();
		},

		checkPngConstraint: function( forceConstraint ) {
			
			if( ( this.$exportFormat.filter( ":checked" ).val() === "png" ) && ( parseInt( this.$exportWidth.val(), 10 ) > MAX_WIDTH || parseInt( this.$exportHeight.val(), 10 ) > MAX_HEIGHT ) ) {
				
				if( forceConstraint ) {
					//change dimension to maximum size available for png
					this.$exportWidth.val( MAX_WIDTH );
					this.$exportHeight.val( MAX_HEIGHT );
					this.onDimensionChange();
				} else {
					this.$pngConstraintLabel.show();
				}
				
			} else {
				this.clearPngConstraint();
			}
			
		},

		clearPngConstraint: function() {
			this.$pngConstraintLabel.hide();
		},

		toggleSections: function() {

			var format = this.$exportFormat.filter( ":checked" ).val();
			if( format === "png" || format === "svg" ) {
				this.$dimensionSection.show();
				this.$iframeSection.hide();
				//make sure the save button is visible
				this.$exportBtn.show();
			} else {
				this.$dimensionSection.hide();
				this.$iframeSection.show();
				//we don't need save button for iframe
				this.$exportBtn.hide();
			}

		},

		serializeForm: function() {
			
			var obj = { width: this.$exportWidth.val(), height: this.$exportHeight.val(), format: this.$exportFormat.filter( ":checked" ).val() };
			return obj;
			
		},

		generateIframeCode: function( id, viewUrl ) {
			//store view url
			if( viewUrl ) {
				this.viewUrl = viewUrl;
			}
			this.$iframeSrc.text( '<iframe src="' + this.viewUrl + '" style="width:' + App.ChartModel.get( "iframe-width" ) + ';height:' + App.ChartModel.get( "iframe-height" ) + '; border: 0px none;"></iframe>' );
		}

	};

	module.exports = App.Views.UI.ExportPopup;

})();
