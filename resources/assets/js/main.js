;( function() {
	
	"use strict";

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