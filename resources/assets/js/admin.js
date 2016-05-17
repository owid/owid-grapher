/* General admin interface improvements */

;(function() {
	"use strict";

	//delete buttons
	$(".delete-btn, .btn-danger").on("click", function(evt) {
		var confirm = window.confirm("Are you sure?");
		if( !confirm ) {
			evt.preventDefault();
		}
	});

	//index variable module
	var $indexVariableModule = $(".index-variable-module");
	if ($indexVariableModule.length) {
		
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

	// MISPY: Hack for zofe/rapyd bootstrap 4 compatibility.
	$(".btn-toolbar li").each(function() {
		$(this).replaceWith("<div class='btn-group' role='group'>" + $(this).html() + "</div>");
	});
	$(".btn-toolbar .btn-group").each(function() {
		$(this).children().addClass("btn btn-default");
	});
})();