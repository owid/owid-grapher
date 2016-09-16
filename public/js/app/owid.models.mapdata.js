;(function() {	
	"use strict";
	owid.namespace("owid.models.mapdata");

	owid.models.mapdata = function(chart) {
		function mapdata() { }		
		var changes = owid.changes();
		changes.track(chart.vardata, 'variables entityKey');
		changes.track(chart.map, 'variableId targetYear timeTolerance mode');
		
		// Transforms raw variable data into datamaps format with meta information 
		// specific to the current target year + tolerance
		mapdata.update = function() {
			if (!changes.start()) return;

			var variables = chart.vardata.get("variables"),
				entityKey = chart.vardata.get("entityKey"),
				mapConfig = App.MapModel.attributes,
				targetVariable = variables[mapConfig.variableId];

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

			this.minCurrentValue = _.min(currentValues, function(d, i) { return d.value; }).value;
			this.maxCurrentValue = _.max(currentValues, function(d, i) { return d.value; }).value;
			this.minToleranceYear = _.min(currentValues, function(d, i) { return d.year; }).year;
			this.maxToleranceYear = _.max(currentValues, function(d, i) { return d.year; }).year;
			this.currentValues = currentValues;

			changes.done();
		};

		return mapdata;
	};
})();