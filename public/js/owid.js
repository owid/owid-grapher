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

	owid.unitFormat = function(unit, value, options) {
		unit = unit || {};
		options = options || {};
		options.noTrailingZeroes = options.noTrailingZeroes || true;

		var titlePrefix = (unit.title ? unit.title + ": " : ""),
			unitSuffix = (unit.unit ? s.trim(unit.unit) : "");

		if (!isNaN(unit.format) && unit.format >= 0) {
			var fixed = Math.min(20, parseInt(unit.format, 10));
			value = d3.format(",." + fixed + "f")(value);
		} else {
			value = d3.format(",")(value);
		}

		if (options.noTrailingZeroes) {
			var m = value.match(/([0-9,-]+.[0-9,]*?)0*$/);
			if (m) value = m[1];
			if (value[value.length-1] == ".")
				value = value.slice(0, value.length-1);
		}

		if (unitSuffix == "$" || unitSuffix == "£")
			return titlePrefix + unitSuffix + value;
		else {
			if (unitSuffix && unitSuffix[0] != "%")
				unitSuffix = " " + unitSuffix;
			return titlePrefix + value + unitSuffix;
		}
	};

	owid.scatterPlotTooltipGenerator = function(data) {
		var unitsString = App.ChartModel.get("units"),
			units = !_.isEmpty(unitsString) ? $.parseJSON(unitsString) : {},
			outputHtml = "";

		var times = data.point.time; // e.g. { x: 1990 }
		var heading = data.series[0].key; // e.g. "United Arab Emirates"
		outputHtml += "<h3>" + heading + "</h3><p>";
		_.each(data.point, function(value, key) {
			if (key == "time" || key == "series" || key == "color") return;

			var unit = _.findWhere(units, { property: key }),
				isHidden = ( unit && unit.hasOwnProperty( "visible" ) && !unit.visible )? true: false;

			if (isHidden) return;
			
			var valueString = owid.unitFormat(unit, value);
			valueString += " (in " + owid.displayYear(times[key]) + ")";
			outputHtml += "<span class='var-popup-value'>" + valueString + "</span>";
		});

		outputHtml += "</p>";
		return outputHtml;
	};
//<table><thead><tr><td colspan="3"><strong class="x-value">1890</strong></td></tr></thead><tbody><tr><td class="legend-color-guide"><div style="background-color: rgb(174, 199, 232);"></div></td><td class="key">Number of people not in extreme poverty</td><td class="value">222,681,713.8</td></tr><tr><td class="legend-color-guide"><div style="background-color: rgb(31, 119, 180);"></div></td><td class="key">Number of people living in extreme poverty</td><td class="value">1,334,533,068</td></tr></tbody></table>

	owid.getUnits = function() {
		var unitsString = App.ChartModel.get("units");
		if (_.isEmpty(unitsString))
			return [];
		else
			return $.parseJSON(unitsString);
	},

	// MISPY: The default nvd3 stacked area tooltip is nice, but we also want to add a total.
	owid.stackedAreaTooltipGenerator = function(data) {
		var unit = owid.getUnits()[0] || {},
			stackMode = App.ChartModel.get("currentStackMode"),
			html = "<table>";

		var total = 0;
		_.each(data.series, function(series) {
			total += series.value;
		});		
		total = owid.unitFormat(unit, total);

		if (stackMode == "relative")
			html += '<thead><tr><td colspan="3"><strong class="x-value">' + data.value + '</strong></td></tr></thead>';
		else
			html += '<thead><tr><td colspan="2"><strong class="x-value">' + data.value + '</strong></td><td class="value">' + total + '</tr></thead>';

		html += '<tbody>';

		_.each(data.series, function(series, i) {
			var value = series.value;		
			if (stackMode == "relative") 
				value = d3.format(".2p")(series.value);
			else
				value = owid.unitFormat(unit, series.value);

			html += '<tr>';
			html += '<td class="legend-color-guide"><div style="background-color: ' + series.color + ';"></div></td>';
			html += '<td class="key">' + series.key + '</td>';
			html += '<td class="value">' + value + '</td>';
			html += '</tr>';
		});

		html += "</tbody></table>";
		return html;
	};

	// Transform entity name to match counterpart in world.ids.json
	// Covers e.g. Cote d'Ivoire -> Cote_d_Ivoire
	owid.entityNameForMap = function(name) {
		return name.replace(/[ '&:\(\)\/]/g, "_");
	}

	owid.contentGenerator = function(data, isMapPopup) {
		//set popup
		var unitsString = App.ChartModel.get("units"),
			chartType = App.ChartModel.get("chart-type"),
			units = (!$.isEmptyObject(unitsString)) ? $.parseJSON(unitsString) : {},
			string = "",
			valuesString = "";

		if (chartType == App.ChartType.ScatterPlot)
			return owid.scatterPlotTooltipGenerator(data);
		else if (chartType == App.ChartType.StackedArea)
			return owid.stackedAreaTooltipGenerator(data);

		//find relevant values for popup and display them
		var series = data.series, key = "", timeString = "";
		if( series && series.length ) {
			var serie = series[ 0 ];
			key = serie.origKey || serie.key;

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

				if (unit) {
					if (!isHidden)
						valuesString += owid.unitFormat(unit, value);
				} else if (i === "time") {
					if (v.hasOwnProperty("map"))
						timeString = owid.displayYear(v.map);
					else
						timeString = owid.displayYear(v);
				} else if (i === "y" || (i === "x" && chartType != App.ChartType.LineChart)) {
					if (!isHidden) {
						if (valuesString !== "")
							valuesString += ", ";
						//just add plain value, omiting x value for linechart
						valuesString += owid.unitFormat(_.extend({}, unit, { unit: null, title: null }), value);
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

	owid.getQueryParams = function() {
		var queryStr = window.location.search.substring(1),
			querySplit = _.filter(queryStr.split("&"), function(s) { return !_.isEmpty(s); }),
			params = {};
		
		for (var i = 0; i < querySplit.length; i++) {
			var pair = querySplit[i].split("=");
			params[pair[0]] = pair[1];
		}

		return params;
	};

	owid.queryParamsToStr = function(params) {
		var newQueryStr = "";

		_.each(params, function(v,k) {
			if (_.isEmpty(newQueryStr)) newQueryStr += "?";
			else newQueryStr += "&";
			newQueryStr += k + '=' + v;
		});		

		return newQueryStr;
	};

	owid.setQueryVariable = function(key, val) {
		var params = owid.getQueryParams();

		if (val === null || val === undefined) {
			delete params[key];
		} else {
			params[key] = val;
		}

		owid.setQueryStr(owid.queryParamsToStr(params));
	};

	owid.setQueryStr = function(str) {
		var uri = window.location.toString();
		if (!str && s.contains(uri, "?")) {
			str = uri.substring(0, uri.indexOf("?"));
		}
		history.replaceState(null, null, str + window.location.hash);
		$(window).trigger("query-change");
	};

	/**
	 * A very simple shorthand to ensure a top-level namespace exists.
	 * e.g. owid.namespace("App.Views.UI.EmbedModal")
	 **/
	owid.namespace = function(namespace) {
		var obj = window;
		_.each(namespace.split("."), function(level) {
			obj[level] = obj[level] || {};
			obj = obj[level];
		});
	};

	var ctx;
	owid.svgSetWrappedText = function(text, content, width, options) {
		options = options || {};
		options.lineHeight = options.lineHeight || 1.3;

		if (!ctx) {
			var canvas = $("<canvas></canvas>").get(0);
			ctx = canvas.getContext("2d");
		}
		ctx.font = $(text.node()).css("font-size") + " " + $(text.node()).css("font-family");

		// Empty it out first
		text.text("");

		// Use a dummy p element to extract the link info
		var links = [],
			$p = $("<p></p>");
		$p.html(content);
		$p.find("a").each(function(i, el) {
			links.push($(el));
		});

		// Now indicate them with our own tags
		content = content.replace(/<a[^>]+>/g, " <LINKSTART> ");
		content = content.replace(/<\/a>/g, " <LINKSTOP> ");

		// Clean the content
		content = s.trim(content.replace("</br>", "\n").replace("<br>", "\n"));

		var words = s.trim(content).split(/ +/),
			x = parseFloat(text.attr("x")),
			y = parseFloat(text.attr("y")),
			currentX = x,
			currentDY = parseFloat(text.attr("dy")),
			currentLine = [],
			linkIndex = -1,
			$currentLink = null,
			lineNumber = 0,
			lineHeight = options.lineHeight,
			tspan = text.append("tspan").attr("dy", currentDY + "em"),
			word = null;

		// Terminate the current tspan and begin a new one
		var breakSpan = function(isNewLine) {
			var textContent = currentLine.join(" ");
			tspan.node().textContent = textContent;

			var container = text;
			if ($currentLink) {
				container = text.append("a")
					.attr("xlink:href", $currentLink.attr("href"))
				_.each($currentLink.get(0).attributes, function(attrib) {
					container.attr(attrib.name, attrib.value);
				});
			}
			tspan = container.append("tspan");

			if (isNewLine) {
				currentDY += lineHeight;
				currentX = x;
				tspan.attr("x", x).attr("y", y).attr("dy", currentDY + "em");
			} else {
				currentX += ctx.measureText(textContent).width;
			}

			currentLine = [];
		};

		while (word = words.shift()) {
			if (word == "<LINKSTART>") {
				linkIndex += 1;
				$currentLink = links[linkIndex];
				breakSpan();
				words.unshift(" "); // HACK (Mispy): this isn't proper whitespace handling but I'm tired of fiddly text stuff
				continue;
			} else if (word == "<LINKSTOP>") {
				$currentLink = null;
				breakSpan();
				if (words[0] && words[0] != ".")
					words.unshift(" ");
				continue;
			}

			var forceNewline = false;
			if (s.contains(word, "\n")) {
				var spl = word.split("\n");
				var beforeLine = spl.shift();
				var afterLine = spl.join("\n");

				word = beforeLine;
				if (afterLine) words.unshift(afterLine);
				forceNewline = true;
			}

			currentLine.push(word);
			var newWidth = ctx.measureText(currentLine.join(" ")).width;

			if (currentX + newWidth > width) {				
				if (forceNewline) word += "\n"; // Forced newline goes to next line if we're wrapping for other reasons

				// Since this word goes over the limit, we wrap and send it to the next line
				// If it's a single word over the limit however no wrapping can be done so we just leave it
				if (currentLine.length > 1) {
					words.unshift(currentLine.pop());
				}

				breakSpan(true);
			} else if (forceNewline) {
				breakSpan(true);
			}
		}

		breakSpan();
	};

	owid.modal = function(options) {
		options = _.extend({}, options);		
		$(".owidModal").remove();

		var html = '<div class="modal owidModal fade" role="dialog">' +
						'<div class="modal-dialog modal-lg">' +
							'<div class="modal-content">' +
								'<div class="modal-header">' +
									'<button type="button" class="close" data-dismiss="modal" aria-label="Close">' +
										'<span aria-hidden="true">&times;</span>' +
									'</button>' +
									'<h4 class="modal-title"></h4>' +
								'</div>' +
								'<div class="modal-body">' +
								'</div>' +
								'<div class="modal-footer">' +
								'</div>' +
							'</div>' +
						'</div>' +
					'</div>';

		$("body").prepend(html);			
		var $modal = $(".owidModal");
		$modal.find(".modal-title").html(options.title);
		$modal.find(".modal-body").html(options.content);
		$modal.modal("show");
		return $modal;
	};

	// A generic "this went really wrong" error handler for errors which
	// ought to be totally fatal and unrecoverable for that page
	owid.reportError = function(err, title) {
		if (err.responseText) {
			err = err.status + " " + err.statusText + "\n" + "    " + err.responseText;
		} else {
			err = err.stack;
		}
		console.error(err);

		var $modal = owid.modal();
		$modal.find(".modal-title").html(title || "Error");
		$modal.find(".modal-body").text(err);
		$modal.addClass("error");
		$modal.on('hidden.bs.modal', function() { window.location.reload(); });
		return $modal;
	};

	owid.confirm = function(options, callback) {
		if (_.isFunction(options)) {
			callback = options;
			options = {};
		}

		options = _.extend({ text: "Are you sure?" }, options);
		if (window.confirm(options.text))
			callback();
	};

	// MISPY: Extension of Backbone view to allow tracking of child views
	owid.View = Backbone.View.extend({
		addChild: function(viewClass, options) {
			this.children = this.children || [];

			var child = new viewClass(options);
			if (!_.isFunction(child.cleanup))
				console.error("Attempted to add child without cleanup method");
			this.children.push(child);
			return child;
		},

		listenTo: function(obj, name, handler) {
			if (obj.jquery) {
				this.jqueryListens = this.jqueryListens || [];
				this.jqueryListens.push({ obj: obj, name: name, handler: handler });
				obj.on(name, handler);
			} else {
				Backbone.View.prototype.listenTo.apply(this, [obj, name, handler]);
			}
		},

		cleanup: function() {
			this.children = this.children || [];
			
			this.stopListening();
			this.undelegateEvents();
			
			_.each(this.jqueryListens, function(binding) {
				binding.obj.off(binding.name, binding.handler);
			});
			this.jqueryListens = [];			

			_.each(this.children, function(child) {
				child.cleanup();
			});
			this.children = [];
		}
	});

	owid.makeSafeForCSS = function(name) {
	    return name.replace(/[^a-z0-9]/g, function(s) {
	        var c = s.charCodeAt(0);
	        if (c == 32) return '-';
	        if (c >= 65 && c <= 90) return s.toLowerCase();
	        return '__' + ('000' + c.toString(16)).slice(-4);
	    });
	};

	window.require = function(namespace) {
		var obj = window;
		_.each(namespace.split("."), function(level) {
			if (!_.isObject(obj[level]))
				throw "Failed to load " + namespace;
			obj = obj[level];
		});

		return obj;
	};

	window.owid = owid;
})();