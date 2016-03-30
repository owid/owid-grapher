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


	owid.contentGenerator = function( data, isMapPopup ) {
		//set popup
		var unitsString = App.ChartModel.get( "units" ),
			chartType = App.ChartModel.get( "chart-type" ),
			units = ( !$.isEmptyObject( unitsString ) )? $.parseJSON( unitsString ): {},
			string = "",
			valuesString = "";

		if (chartType == App.ChartType.ScatterPlot)
			return App.Utils.scatterPlotContentGenerator(data);

		//find relevant values for popup and display them
		var series = data.series, key = "", timeString = "";
		if( series && series.length ) {
			var serie = series[ 0 ];
			key = serie.key;

			//get source of information
			var point = data.point;
			//begin composting string
			string = "<h3>" + key + "</h3><p>";
			valuesString = "";

			if (!isMapPopup && (chartType == App.ChartType.MultiBar || chartType == App.ChartType.HorizontalMultiBar || chartType == App.ChartType.DiscreteBar)) {
				//multibarchart has values in different format
				point = { "y": serie.value, "time": data.data.time };
			}

			$.each( point, function( i, v ) {
				//for each data point, find appropriate unit, and if we have it, display it
				var unit = _.findWhere( units, { property: i } ),
					value = v,
					isHidden = ( unit && unit.hasOwnProperty( "visible" ) && !unit.visible )? true: false;

				value = App.Utils.formatNumeric(unit, value);

				if( unit ) {
					var unitSetting = unit.unit||"";
					var titleSetting = unit.title||"";

					if( !isHidden ) {
						//try to format number
						//scatter plot has values displayed in separate rows
						if( valuesString !== "") {
							valuesString += ", ";
						}
						valuesString += (_.isEmpty(titleSetting) ? "" : titleSetting + ": ") + value + " " + unitSetting;
					}
				} else if( i === "time" ) {
					if (v.hasOwnProperty("map"))
						timeString = owid.displayYear(v.map);
					else
						timeString = owid.displayYear(v);
				} else if(i === "y" || ( i === "x" && chartType != App.ChartType.LineChart ) ) {
					if( !isHidden ) {
						if( valuesString !== "") {
							valuesString += ", ";
						}
						//just add plain value, omiting x value for linechart
						valuesString += value;
					}
				}
			} );

			if(isMapPopup || timeString) {
				valuesString += " <br /> in <br /> " + timeString;
			}

			string += valuesString;
			string += "</p>";
		}

		return string;

	};

	owid.getLengthForPoint = function(path, pointNum) {
		if (pointNum == 0) return 0;

		var points = path.getAttribute("d").split(/L/);

		var phantomPath = document.createElementNS("http://www.w3.org/2000/svg", 'path');
		phantomPath.setAttribute('d', points.slice(0, pointNum+1).join("L"));
		return phantomPath.getTotalLength();
	};


	window.owid = owid;
})();