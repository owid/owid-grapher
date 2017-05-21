/* General admin interface improvements */

import $ from 'jquery'
import Cookies from 'js-cookie'
window.Cookies = Cookies

;(function() {
	"use strict";

	// CSRF setup
	$.ajaxSetup({
		headers: { 'X-CSRFToken': $('meta[name="_token"]').attr("value") }
	});


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

	//chosen select
	$( ".chosen-select" ).chosen();

	// MISPY: Hack for zofe/rapyd bootstrap 4 compatibility.
	$(".btn-toolbar li").each(function() {
		$(this).replaceWith("<div class='btn-group' role='group'>" + $(this).html() + "</div>");
	});
	$(".btn-toolbar .btn-group").each(function() {
		$(this).children().addClass("btn btn-default");
	});

	// MISPY: Starring of charts from the index page.
	$("#charts-index").each(function() {
		$(this).find("a.star-toggle").click(function(ev) {
			var $toggle = $(ev.target.closest('a')),
				chartId = parseInt($toggle.attr("data-chart-id")),
				starred = $toggle.find('i').hasClass('fa-star'),
				route = Global.rootUrl + "/charts/" + chartId + "/" + (starred ? "unstar" : "star");

			$.post(route, function() {
				starred = !starred;
				// Currently only one chart starred at a time
				$("a.star-toggle > i").removeClass("fa-star");
				$("a.star-toggle > i").addClass("fa-star-o");
				if (starred) {
					$toggle.find('i').removeClass('fa-star-o');
					$toggle.find('i').addClass('fa-star');
				} else {
					$toggle.find('i').removeClass('fa-star');
					$toggle.find('i').addClass('fa-star-o');
				}
			});
		});
	});

	// Set site-wide cookie for charts so they know to show the edit link
	Cookies.set("isAdmin", "true", { expires: 31 });
	
	$(".chosen-select").chosen();
	$(".timeago").timeago();	
})();