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


})();