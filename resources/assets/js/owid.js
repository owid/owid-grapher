/* OWID standalone utility functions */

;(function() {
	"use strict";

	var owid = {};

	owid.displayYear = function(year) {
		year = parseInt(year);
		if (isNaN(year)) {
			console.error("Invalid year '" + year + "'");
			return null;
		}

		if (year < 0)
			return Math.abs(year) + " BCE";
		else
			return year.toString();
	};

	owid.tryParseFloat = function(val) {
		var asFloat = parseFloat(val);
		if (isNaN(asFloat))
			return val;
		else
			return asFloat;
	};

	owid.timeRangesToString = function(timeRanges) {
		var timeRangeStrs = [];

		_.each(timeRanges, function(timeRange) {
			if (timeRange.year) 
				timeRangeStrs.push(timeRange.year.toString());
			else {
				var s = timeRange.startYear + " to " + timeRange.endYear;
				if (timeRange.interval) s += " every " + timeRange.interval;
				timeRangeStrs.push(s);
			}
		});

		return timeRangeStrs.join("; ");
	};

	owid.timeRangesToYears = function(timeRanges, first, last) {
		if (_.isEmpty(timeRanges)) {
			timeRanges = [{ startYear: 'first', endYear: 'last' }];
		}

		var outputYears = [];

		var parseYear = function(year) {
			var result;

			if (year == "first") result = parseInt(first);
			else if (year == "last") result = parseInt(last);
			else result = parseInt(year);

			if (isNaN(result))
				throw new TypeError("Couldn't parse year: " + result);

			return result;
		};

		_.each(timeRanges, function(timeRange) {
			if (timeRange.year)
				outputYears.push(parseYear(timeRange.year));
			else {
				var startYear = parseYear(timeRange.startYear);
				var endYear = parseYear(timeRange.endYear);
				var interval = timeRange.interval || 1;

				if (startYear > endYear) {
					var tmp = endYear;
					endYear = startYear;
					startYear = tmp;
				}

				for (var i = startYear; i <= endYear; i += interval) {
					outputYears.push(i);
				}
			}
		});

		return _.uniq(_.sortBy(outputYears), true);
	};

	owid.timeRangesFromString = function(timeRangesStr) {
		if (!timeRangesStr)
			return [];
		
		var timeRanges = [];
		var rangeStrs = timeRangesStr.split(';');

		var validateYear = function(yearStr) {
			if (yearStr == "first" || yearStr == "last") 
				return yearStr;
			else {
				var year = parseInt(yearStr);
				if (!year) {
					throw new RangeError("Invalid year " + yearStr);
				} else {
					return year;
				}
			}
		};

		_.each(rangeStrs, function(rangeStr) {
			var timeRange = {};
			rangeStr = $.trim(rangeStr);

			var range = rangeStr.match(/^([0-9-]+|first|last|) to ([0-9-]+|first|last)(?: every ([0-9-]+))?$/);
			if (range) {
				var startYear = validateYear(range[1]);
				var endYear = validateYear(range[2]);
				var interval = range[3] ? parseInt(range[3]) : null;

				timeRange.startYear = startYear;
				timeRange.endYear = endYear;
				if (interval) timeRange.interval = interval;
			} else if (rangeStr.match(/^([0-9-]+|first|last)$/)) {
				var year = validateYear(rangeStr);
				timeRange.year = year;
			} else {
				throw RangeError("Invalid range " + rangeStr);
			}

			timeRanges.push(timeRange);
		});

		return timeRanges;
	};

	window.owid = owid;
})();