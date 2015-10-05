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


})();