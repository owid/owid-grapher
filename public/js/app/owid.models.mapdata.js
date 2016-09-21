;(function() {	
	"use strict";
	owid.namespace("owid.models.mapdata");

	owid.models.mapdata = function(chart) {
		function mapdata() { }		
		var changes = owid.changes();
		changes.track(chart.vardata, 'variables entityKey');
		changes.track(chart.map, 'variableId targetYear timeTolerance mode');

		function updateLegendData() {
			// Will eventually produce something like this:
			// [{ type: 'numeric', min: 10, max: 20, color: '#faeaef' },
			//  { type: 'numeric', min: 20, max: 30, color: '#fefabc' },
			//  { type: 'categorical', value: 'Foobar', color: '#bbbbbb'}]
			var legendData = [];

			legendData = [{ type: 'numeric', min: 10, max: 20, minLabel: '10%', maxLabel: '20%', color: '#faeaef' },
			  { type: 'numeric', min: 20, max: 30, minLabel: '20%', maxLabel: '30%', color: '#fefabc' },
			  { type: 'categorical', value: '<5.0', label: 'less than 5.0', color: '#bbbbbb' }];

			mapdata.legendTitle = chart.map.get('legendDescription') || chart.map.getVariable().name;
			mapdata.legendData = legendData;
		}

		// Transforms raw variable data into datamaps format with meta information 
		// specific to the current target year + tolerance
		mapdata.update = function() {
			var targetVariable = chart.map.getVariable();
			if (!targetVariable) return;

			if (!changes.start()) return;

			var variables = chart.vardata.get("variables"),
				entityKey = chart.vardata.get("entityKey"),
				mapConfig = chart.map.attributes;

			var years = targetVariable.years,
				values = targetVariable.values,
				entities = targetVariable.entities,
				targetYear = +mapConfig.targetYear,
				tolerance = +mapConfig.timeTolerance,
			  	currentValues = {};

			if (isNaN(tolerance))
				tolerance = 0;

			if (mapConfig.mode === "no-interpolation")
				tolerance = 0;

			for (var i = 0; i < values.length; i++) {
				var year = years[i];
				if (year < targetYear-tolerance || year > targetYear+tolerance) 
					continue;

				// Make sure we use the closest year within tolerance (favoring later years)
				var existing = currentValues[entityName];
				if (existing && Math.abs(existing.year - targetYear) < Math.abs(year - targetYear))
					continue;

				var entityName = owid.entityNameForMap(entityKey[entities[i]].name);

				currentValues[entityName] = {
					value: values[i],
					year: years[i]
				};
			}

			mapdata.minCurrentValue = _.min(currentValues, function(d, i) { return d.value; }).value;
			mapdata.maxCurrentValue = _.max(currentValues, function(d, i) { return d.value; }).value;
			mapdata.minToleranceYear = _.min(currentValues, function(d, i) { return d.year; }).year;
			mapdata.maxToleranceYear = _.max(currentValues, function(d, i) { return d.year; }).year;
			mapdata.currentValues = currentValues;

			updateLegendData();
			changes.done();
		};



		return mapdata;
	};
})();