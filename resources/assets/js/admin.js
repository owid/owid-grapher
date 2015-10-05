;( function() {
	
	"use strict";

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