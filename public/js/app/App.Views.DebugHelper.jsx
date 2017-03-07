/* App.Views.DebugHelper.js                                                             
 * ================                                                             
 *
 * DebugHelper exposes various data to the console to aid in debugging.
 *
 * @project Our World In Data
 * @author  Jaiden Mispy                                                     
 * @created 2016-08-08
 */ 

import _ from 'underscore'

;(function() {
	"use strict";
	owid.namespace("App.Views.DebugHelper");

	App.Views.DebugHelper = owid.View.extend({
		initialize: function(chart) {
			this.listenTo(App.VariableData, "change", function() {
				window.variables = _.values(App.VariableData.get("variables"));
			});

			$(window).on("chart-loaded", function() {			
				window.svg = $("svg").get(0);
			});

			window.maptab = chart.mapTab;
		},
	});
})();