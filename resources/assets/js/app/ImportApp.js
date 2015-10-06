;( function() {
	
	"use strict";

	var App = require( "./namespaces.js" ),
		Import = require( "./views/App.Views.Import.js" ),
		ChartModel = require( "./models/App.Models.ChartModel.js" );

	//setup models
	//is new chart or display old chart
	var $chartShowWrapper = $( ".chart-show-wrapper, .chart-edit-wrapper" ),
		chartId = $chartShowWrapper.attr( "data-chart-id" );

	//setup views
	App.View = new Import();

	if( $chartShowWrapper.length && chartId ) {
		
		//showing existing chart
		App.ChartModel = new ChartModel( { id: chartId } );
		App.ChartModel.fetch( {
			success: function( data ) {
				App.View.start();
			},
			error: function( xhr ) {
				console.error( "Error loading chart model", xhr );
			}
		} );
		//find out if it's in cache
		if( !$( ".standalone-chart-viewer" ).length ) {
			//disable caching for viewing within admin
			App.ChartModel.set( "cache", false );
		}
		
	} else {

		//is new chart
		App.ChartModel = new ChartModel();
		App.View.start();

	}

	//small bits of functionality, previously in seperate file
	var Utils = require( "./App.Utils.js" );

	$( ".datepicker" ).datepicker();

	$( ".datasource-editor" ).wysihtml5( 'deepExtend', {
				parserRules: {
					tags: {
						table: {},
						tr: {},
						th: {},
						td: {}
					}
				},
				"html": true
			});

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

	//index variable module
	var $indexVariableModule = $( ".index-variable-module" );
	if( $indexVariableModule.length ) {
		
		//get all ids of the current table and stuff it into input
		var $table = $indexVariableModule.find( "table" ),
			$tds = $table.find( "td:first-child" ),
			$valueIdsInput = $indexVariableModule.find( "[name=value_ids]" ),
			ids = $.map( $tds, function( v, i ) {
				return $( v ).text();
			} );

		$valueIdsInput.val( JSON.stringify(ids) );

	}

	//chosen select
	$( ".chosen-select" ).chosen();

	
	

})();