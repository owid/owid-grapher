;( function() {

	"use strict";
	var App = require( "./namespaces.js" );

	App.Utils.mapData = function( rawData, transposed ) {

		var data = [],
			dataById = [],
			countryIndex = 1;

		//do we have entities in rows and times in columns?	
		if( !transposed ) {
			//no, we have to switch rows and columns
			rawData = App.Utils.transpose( rawData );
		}
		
		//extract time column
		var timeArr = rawData.shift();
		//get rid of first item (label of time column) 
		timeArr.shift();
	
		for( var i = 0, len = rawData.length; i < len; i++ ) {

			var singleRow = rawData[ i ],
				colName = singleRow.shift();
				
			//ommit rows with no colNmae
			if( colName ) {
				var singleData = [];
				_.each( singleRow, function( value, i ) {
					//check we have value
					if( value !== "" ) {
						singleData.push( { x: timeArr[i], y: ( !isNaN( value ) )? +value: value } );
					}
				} );

				//construct entity obj
				var	entityObj = {
					id: i,
					key: colName,
					values: singleData
				};
				data.push( entityObj );
			}

		}

		return data;

	},

	App.Utils.mapSingleVariantData = function( rawData, variableName ) {

		var variable = {
			name: variableName,
			values: App.Utils.mapData( rawData, true )
		};
		return [variable];

	},

	/*App.Utils.mapMultiVariantData = function( rawData, entityName ) {
		
		//transform multivariant into standard format ( time, entity )
		var variables = [],
			transposed = rawData,//App.Utils.transpose( rawData ),
			timeArr = transposed.shift();

		//get rid of first item (label of time column) 
		//timeArr.shift();
		
		_.each( transposed, function( values, key, list ) {

			//get variable name from first cell of columns
			var variableName = values.shift();
			//add entity name as first cell
			values.unshift( entityName );
			//construct array for mapping, need to deep copy timeArr
			var localTimeArr = $.extend( true, [], timeArr);
			var dataToMap = [ localTimeArr, values ];
			//construct object
			var variable = {
				name: variableName,
				values: App.Utils.mapData( dataToMap, true )
			};
			variables.push( variable );

		} );

		return variables;

	},*/

	App.Utils.mapMultiVariantData = function( rawData ) {
		
		var variables = [],
			transposed = rawData,
			headerArr = transposed.shift();

		//get rid of entity and year column name
		headerArr = headerArr.slice( 2 );

		var varPerRowData = App.Utils.transpose( transposed ),
			entitiesRow = varPerRowData.shift(),
			timesRow = varPerRowData.shift();

		_.each( varPerRowData, function( values, varIndex ) {
			
			var entities = {};
			//iterate through all values for given variable
			_.each( values, function( value, key ) {
				var entity = entitiesRow[ key ],
					time = timesRow[ key ];
				if( entity && time ) {
					//do have already entity defined?
					if( !entities[ entity ] ) {
						entities[ entity ] = {
							id: key,
							key: entity,
							values: []
						};
					}
					entities[ entity ].values.push( { x: time, y: ( !isNaN( value ) )? +value: value } );
				}
			} );

			//have data for all entities, just convert them to array
			var varValues = _.map( entities, function( value ) { return value; } );
			
			var variable = {
				name: headerArr[ varIndex ],
				values: varValues
			};
			variables.push( variable );

		} );

		return variables;
	},

	App.Utils.timeRangesToString = function(timeRanges) {
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
	},

	App.Utils.timeRangesToYears = function(timeRanges, first, last) {
		if (_.isEmpty(timeRanges)) {
			timeRanges = [{ startYear: 'first', endYear: 'last' }];
		}

		var outputYears = [];

		var parseYear = function(year) {
			if (year == "first") return first;
			else if (year == "last") return last;
			else return parseInt(year);
		};

		_.each(timeRanges, function(timeRange) {
			if (timeRange.year)
				outputYears.push(parseYear(timeRange.year));
			else {
				var startYear = parseYear(timeRange.startYear);
				var endYear = parseYear(timeRange.endYear);
				var interval = timeRange.interval || 1;

				if (startYear > endYear) {
					var tmp = startYear;
					endYear = tmp;
					startYear = endYear;
				}

				for (var i = startYear; i <= endYear; i += interval) {
					outputYears.push(i);
				}
			}
		});

		return _.uniq(_.sortBy(outputYears), true);
	},

	App.Utils.timeRangesFromString = function(timeRangesStr) {
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
					throw RangeError("Invalid year " + yearStr);
				} else {
					return year;
				}
			}
		};

		_.each(rangeStrs, function(rangeStr) {
			var timeRange = {};
			rangeStr = $.trim(rangeStr);

			var range = rangeStr.match(/^(\d+|first|last|) to (\d+|first|last)(?: every (\d+))?$/);
			if (range) {
				var startYear = validateYear(range[1]);
				var endYear = validateYear(range[2]);
				var interval = range[3] ? parseInt(range[3]) : null;

				timeRange.startYear = startYear;
				timeRange.endYear = endYear;
				if (interval) timeRange.interval = interval;
			} else if (rangeStr.match(/^(\d+|first|last)$/)) {
				var year = validateYear(rangeStr);
				timeRange.year = year;
			} else {
				throw RangeError("Invalid range " + rangeStr);
			}

			timeRanges.push(timeRange);
		});

		return timeRanges;
	},

	App.Utils.transpose = function( arr ) {
		var keys = _.keys( arr[0] );
		return _.map( keys, function (c) {
			return _.map( arr, function( r ) {
				return r[c];
			} );
		});
	},

	App.Utils.transform = function() {

		console.log( "app.utils.transform" );

	},

	App.Utils.encodeSvgToPng = function( html ) {

		console.log( html );
		var imgSrc = "data:image/svg+xml;base64," + btoa(html),
			img = "<img src='" + imgSrc + "'>"; 
		
		//d3.select( "#svgdataurl" ).html( img );

		$( ".chart-wrapper-inner" ).html( img );

		/*var canvas = document.querySelector( "canvas" ),
			context = canvas.getContext( "2d" );

		var image = new Image;
		image.src = imgsrc;
		image.onload = function() {
			context.drawImage(image, 0, 0);
			var canvasData = canvas.toDataURL( "image/png" );
			var pngImg = '<img src="' + canvasData + '">'; 
			d3.select("#pngdataurl").html(pngimg);

			var a = document.createElement("a");
			a.download = "sample.png";
			a.href = canvasdata;
			a.click();
		};*/


	};

	/**
	*	TIME RELATED FUNCTIONS
	**/

	App.Utils.nth = function ( d ) {
		//conver to number just in case
		d = +d;
		if( d > 3 && d < 21 ) return 'th'; // thanks kennebec
		switch( d % 10 ) {
			case 1:  return "st";
			case 2:  return "nd";
			case 3:  return "rd";
			default: return "th";
		}
	}

	App.Utils.centuryString = function ( d ) {
		//conver to number just in case
		d = +d;
		
		var centuryNum = Math.floor(d / 100) + 1,
			centuryString = centuryNum.toString(),
			nth = App.Utils.nth( centuryString );

		return centuryString + nth + " century";
	}

	App.Utils.addZeros = function ( value ) {

		value = value.toString();
		if( value.length < 4 ) {
			//insert missing zeros
			var valueLen = value.length;
			for( var y = 0; y < 4 - valueLen; y++ ) {
				value = "0" + value;
			}
		}
		return value;
		
	}

	App.Utils.roundTime = function( momentTime ) {

		if( typeof momentTime.format === "function" ) {
			//use short format mysql expects - http://stackoverflow.com/questions/10539154/insert-into-db-datetime-string
			return momentTime.format( "YYYY-MM-DD" );
		}
		return momentTime;

	}

	/** 
	* FORM HELPER
	**/
	App.Utils.FormHelper.validate = function( $form ) {
		
		var missingErrorLabel = "Please enter value.",
			emailErrorLabel =  "Please enter valide email.",
			numberErrorLabel = "Please ente valid number."; 

		var invalidInputs = [];
		
		//gather all fields requiring validation
		var $requiredInputs = $form.find( ".required" );
		if( $requiredInputs.length ) {

			$.each( $requiredInputs, function( i, v ) {

				var $input = $( this );
				
				//filter only visible
				if( !$input.is( ":visible" ) ) {
					return;
				}

				//check for empty
				var inputValid = App.Utils.FormHelper.validateRequiredField( $input );
				if( !inputValid ) {
				
					App.Utils.FormHelper.addError( $input, missingErrorLabel );
					invalidInputs.push( $input );
				
				} else {
					
					App.Utils.FormHelper.removeError( $input );

					//check for digit
					if( $input.hasClass( "required-number" ) ) {
						inputValid = App.Utils.FormHelper.validateNumberField( $input );
						if( !inputValid ) {
							App.Utils.FormHelper.addError( $input, numberErrorLabel );
							invalidInputs.push( $input );
						} else {
							App.Utils.FormHelper.removeError( $input );
						}
					}

					//check for mail
					if( $input.hasClass( "required-mail" ) ) {
						inputValid = FormHelper.validateEmailField( $input );
						if( !inputValid ) {
							App.Utils.FormHelper.addError( $input, emailErrorLabel );
							invalidInputs.push( $input );
						} else {
							App.Utils.FormHelper.removeError( $input );
						}
					}

					//check for checkbox
					if( $input.hasClass( "required-checkbox" ) ) {

						inputValid = FormHelper.validateCheckbox( $input );
						if( !inputValid ) {
							App.Utils.FormHelper.addError( $input, missingErrorLabel );
							invalidInputs.push( $input );
						} else {
							App.Utils.FormHelper.removeError( $input );
						}

					}

				}
	
			} );

		}


		if( invalidInputs.length ) {

			//take first element and scroll to it
			var $firstInvalidInput = invalidInputs[0];
			$('html, body').animate( {
				scrollTop: $firstInvalidInput.offset().top - 25
			}, 250);

			return false;
			
		}

		return true; 

	};

	App.Utils.FormHelper.validateRequiredField = function( $input ) {

		return ( $input.val() === "" ) ? false : true;

	};

	App.Utils.FormHelper.validateEmailField = function( $input ) {

		var email = $input.val();
		var regex = /^([\w-\.]+@([\w-]+\.)+[\w-]{2,6})?$/;
		return regex.test( email );

	};

	App.Utils.FormHelper.validateNumberField = function( $input ) {

		return ( isNaN( $input.val() ) ) ? false : true;

	};

	App.Utils.FormHelper.validateCheckbox = function( $input ) {

		return ( $input.is(':checked') ) ? true : false;

	};


	App.Utils.FormHelper.addError = function( $el, $msg ) {

		if( $el ) {
			if( !$el.hasClass( "error" ) ) {
				$el.addClass( "error" );
				$el.before( "<p class='error-label'>" + $msg + "</p>" );
			}
		}

	};

	App.Utils.FormHelper.removeError = function( $el ) {

		if( $el ) {
			$el.removeClass( "error" );
			var $parent = $el.parent();
			var $errorLabel = $parent.find( ".error-label" );
			if( $errorLabel.length ) {
				$errorLabel.remove();
			}
		}
		
	};

	App.Utils.wrap = function( $el, width ) {
		
		//get rid of potential tspans and get pure content (including hyperlinks)
		var textContent = "",
			$tspans = $el.find( "tspan" );
		if( $tspans.length ) {
			$.each( $tspans, function( i, v ) {
				if( i > 0 ) {
					textContent += " ";
				}
				textContent += $(v).text();
			} );	
		} else {
			//element has no tspans, possibly first run
			textContent = $el.text();
		}
		
		//append to element
		if( textContent ) {
			$el.text( textContent );
		}
		
		var isVisible = $el.is( ":visible" );

		//make el visible for the time of being computed, otherwise getComputedTextLength returns 0
		$el.show();

		var text = d3.select( $el.selector );
		text.each( function() {
			var text = d3.select(this),
				string = $.trim(text.text()),
				regex = /\s+/,
				words = string.split(regex).reverse();

			var word,
				line = [],
				lineNumber = 0,
				lineHeight = 1.4, // ems
				y = text.attr("y"),
				dy = parseFloat(text.attr("dy")),
				tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");
			
			while( word = words.pop() ) {
				line.push(word);
				tspan.html(line.join(" "));
				if( tspan.node().getComputedTextLength() > width ) {
					line.pop();
					tspan.text(line.join(" "));
					line = [word];
					tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
				}
			}
			
		} );

		//cache element height while it's still visible
		var elBoundingBox = $el.get(0).getBoundingClientRect(),
			elHeight = elBoundingBox.bottom - elBoundingBox.top;

		//done with the dimension computations, hide element again, if it was invisible
		if( !isVisible ) {
			$el.hide();	
		}

		//in some user cases, can be useful to return height
		return elHeight;

	};

	/**
	* Convert a string to HTML entities
	*/
	App.Utils.toHtmlEntities = function(string) {
		return string.replace(/./gm, function(s) {
			return "&#" + s.charCodeAt(0) + ";";
		});
	};

	/**
	 * Create string from HTML entities
	 */
	App.Utils.fromHtmlEntities = function(string) {
		return (string+"").replace(/&#\d+;/gm,function(s) {
			return String.fromCharCode(s.match(/\d+/gm)[0]);
		})
	};

	App.Utils.getRandomColor = function () {
		var letters = '0123456789ABCDEF'.split('');
		var color = '#';
		for (var i = 0; i < 6; i++ ) {
			color += letters[Math.floor(Math.random() * 16)];
		}
		return color;
	};

	App.Utils.getPropertyByVariableId = function( model, variableId ) {

		if( model && model.get( "chart-dimensions" ) ) {

			var chartDimensionsString = model.get( "chart-dimensions" ),
				chartDimensions = $.parseJSON( chartDimensionsString ),
				dimension = _.where( chartDimensions, { "variableId": variableId } );
			if( dimension && dimension.length ) {
				return dimension[0].property;
			}

		}

		return false;
		
	};

	App.Utils.scatterPlotContentGenerator = function(data) {
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
			
			value = App.Utils.formatNumeric(unit, value);

			var unitSetting = (unit && unit.unit)||"";
			var titleSetting = (unit && unit.title)||"";

			var valueString = (_.isEmpty(titleSetting) ? "" : titleSetting + ": ") + value + " " + unitSetting;
			valueString += " (in " + times[key] + ")";
			outputHtml += "<span class='var-popup-value'>" + valueString + "</span>";
		});

		outputHtml += "</p>";
		return outputHtml;
	}

	App.Utils.formatNumeric = function(unit, value) {
		//format number
		if( unit && !isNaN( unit.format ) && unit.format >= 0 ) {
			//fixed format
			var fixed = Math.min( 20, parseInt( unit.format, 10 ) );
			return d3.format( ",." + fixed + "f" )( value );
		} else {
			//add thousands separator
			if( !isNaN( value ) ) {
				return d3.format( "," )( value );
			}
		}
	}


	App.Utils.contentGenerator = function( data, isMapPopup ) {
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
						timeString = v.map.toString();
					else
						timeString = v;
				} else if( i !== "color" && i !== "series" && ( i !== "x" || chartType != App.ChartType.LineChart ) ) {
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


	App.Utils.formatTimeLabel = function( type, d, xAxisPrefix, xAxisSuffix, format ) {
		//depending on type format label
		var label;
		switch( type ) {
			
			case "Decade":
				
				var decadeString = d.toString();
				decadeString = decadeString.substring( 0, decadeString.length - 1);
				decadeString = decadeString + "0s";
				label = decadeString;

				break;

			case "Quarter Century":
				
				var quarterString = "",
					quarter = d % 100;
				
				if( quarter < 25 ) {
					quarterString = "1st quarter of the";
				} else if( quarter < 50 ) {
					quarterString = "half of the";
				} else if( quarter < 75 ) {
					quarterString = "3rd quarter of the";
				} else {
					quarterString = "4th quarter of the";
				}
					
				var centuryString = App.Utils.centuryString( d );

				label = quarterString + " " + centuryString;

				break;

			case "Half Century":
				
				var halfString = "",
					half = d % 100;
				
				if( half < 50 ) {
					halfString = "1st half of the";
				} else {
					halfString = "2nd half of the";
				}
					
				var centuryString = App.Utils.centuryString( d );

				label = halfString + " " + centuryString;

				break;

			case "Century":
				
				label = App.Utils.centuryString( d );

				break;

			default:

				label = App.Utils.formatValue( d, format );
				
				break;
		}
		return xAxisPrefix + label + xAxisSuffix;
	};

	App.Utils.inlineCssStyle = function( rules ) {
		//http://devintorr.es/blog/2010/05/26/turn-css-rules-into-inline-style-attributes-using-jquery/
		for (var idx = 0, len = rules.length; idx < len; idx++) {
			//in Safari - Error: Syntax error, unrecognized expression: input[type="number"]::-webkit-inner-spin-button, input[type="number"]::-webkit-outer-spin-button]
			try {
				$(rules[idx].selectorText).each(function (i, elem) {
					elem.style.cssText += rules[idx].style.cssText;
				});	
			} catch(err) {}
		}
	};

	App.Utils.checkValidDimensions = function( dimensions, chartType ) {
			
		var validDimensions = false,
			xDimension, yDimension;
		
		switch( chartType ) {
			case "1":
			case "4":
			case "5":
			case "6":
				//check that dimensions have y property
				yDimension = _.find( dimensions, function( dimension ) {
					return dimension.property === "y";
				} );
				if( yDimension ) {
					validDimensions = true;
				}
				break;
			case "2":
				//check that dimensions have x property
				xDimension = _.find( dimensions, function( dimension ) {
					return dimension.property === "x";
				} );
				yDimension = _.find( dimensions, function( dimension ) {
					return dimension.property === "y";
				} );
				if( xDimension && yDimension ) {
					validDimensions = true;
				}
				break;
			case "3":
				//check that dimensions have y property
				yDimension = _.find( dimensions, function( dimension ) {
					return dimension.property === "y";
				} );
				if( yDimension ) {
					validDimensions = true;
				}
				break;
		}
		return validDimensions;

	};

	App.Utils.formatValue = function( value, format ) {
		//make sure we do this on number
		if( value && !isNaN( value ) ) {
			if( format && !isNaN( format ) ) {
				var fixed = Math.min( 20, parseInt( format, 10 ) );
				value = value.toFixed( fixed );
			} else {
				//no format 
				value = value.toString();
			}
		}
		return value;
	};

	App.Utils.getQueryVariable = function( variable ) {
		var query = window.location.search.substring(1);
		var vars = query.split("&");
		for (var i=0;i<vars.length;i++) {
			var pair = vars[i].split("=");
			if(pair[0] == variable){return pair[1];}
		}
		return(false);
	};

	module.exports = App.Utils;
	
})();