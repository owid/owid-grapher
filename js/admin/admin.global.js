/* General admin interface improvements */

import $ from 'jquery'
import Cookies from 'js-cookie'
import timeago from 'timeago.js'
window.Cookies = Cookies

;(function() {
	"use strict";

	$.ajaxSetup({
		beforeSend: function(xhr, settings) {
			xhr.setRequestHeader("X-CSRFToken", $('meta[name="_token"]').attr("value") )
		}
	})

	//delete buttons
	$(".delete-btn, .btn-danger").on("click", function(evt) {
		if ($(evt.target).closest("#form-view").length)
			return;
		
		var confirm = window.confirm("Are you sure?");
		if(!confirm) {
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

	// MISPY: Hack for zofe/rapyd bootstrap 4 compatibility.
	$(".btn-toolbar li").each(function() {
		$(this).replaceWith("<div class='btn-group' role='group'>" + $(this).html() + "</div>");
	});
	$(".btn-toolbar .btn-group").each(function() {
		$(this).children().addClass("btn btn-default");
	});

	// Set site-wide cookie for charts so they know to show the edit link
	Cookies.set("isAdmin", "true", { expires: 31 });
	
	timeago().render(document.querySelectorAll('.timeago'))
})();