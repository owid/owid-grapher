;(function() {	
	"use strict";

	window.App = window.App || {};

	App.ChartType = {
		LineChart: 1,
		ScatterPlot: 2,
		StackedArea: 3,
		MultiBar: 4,
		HorizontalMultiBar: 5,
		DiscreteBar: 6
	};

	App.LineType = {
		WithDots: 0,
		WithoutDots: 1,
		UnjoinedIfMissing: 2,
		DashedIfMissing: 3
	}

	//export for iframe
	window.$ = jQuery;

	//export
	window.App = App;
})();


;(function() {
	"use strict";
	window.App = window.App || {};
	App.Utils = App.Utils || {};
	App.Utils.FormHelper = App.Utils.FormHelper || {};
	
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

		$("style").remove();
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
})();
;(function() {
	"use strict";
	owid.namespace("App.Models.ChartModel");

	App.Models.ChartModel = Backbone.Model.extend( {

		//urlRoot: Global.rootUrl + '/charts/',
		//urlRoot: Global.rootUrl + '/data/config/',
		url: function(id) {
			id = id || this.id;
			if( $("#form-view").length ) {
				if( id ) {
					//editing existing
					return Global.rootUrl + "/charts/" + id;
				} else {
					//saving new
					return Global.rootUrl + "/charts";
				}

			} else {
				// Pass any query parameters on to config
				return Global.rootUrl + "/data/config/" + id + window.location.search;
			}
		},

		defaults: {
			"chart-name": "",
			"chart-slug": "",
			"chart-notes": "",
			// A range of form e.g. [0, 2015] with null meaning "all of it"
			"chart-time": null,
			"cache": true,
			"selected-countries": [], // e.g. [{id: "1", name: "United Kingdom"}]
			"tabs": [ "chart", "data", "sources" ],
			"default-tab": "chart",
			"line-type": 0,
			"line-tolerance": 1,
			"chart-description": "",
			"chart-dimensions": [],
			"variables": [],
			"y-axis": {"axis-label-distance":"-10"},
			"x-axis": {},
			"margins": { top: 10, left: 60, bottom: 10, right: 10 },
			"units": "",
			"logo": "uploads/26538.png",
			"second-logo": null,
			"iframe-width": "100%",
			"iframe-height": "660px",
			"hide-legend": false,
			"group-by-variables": false,
			"add-country-mode": "add-country",
			"x-axis-scale-selector": false,
			"y-axis-scale-selector": false,
			"map-config": {
				"variableId": -1,
				"targetYear": 1980,
				"targetYearMode": "normal",
				"defaultYear": 1980,
				"mode": "specific",
				"timeTolerance": 1,
				"minYear": 1980,
				"maxYear": 2000,
				// timeRanges is a collection of objects specifying year ranges e.g.
				//
				// [
				//   { year: 1980 },
				//   { startYear: 1990, endYear: 2000, interval: 5 },
				//   { startYear: 2005, endYear: 2008 }
				// ]
				//
				// Produces the years: 1980, 1990, 1995, 2000, 2005, 2007, 2008
				"timeRanges": [],
				"timelineMode": "timeline",
				"colorSchemeName": "BuGn",
				"colorSchemeValues": false,
				"colorSchemeLabels": [],
				"colorSchemeValuesAutomatic": true,
				"colorSchemeInterval": 5,
				// Whether to reverse the color scheme on output
				"colorSchemeInvert": false,
				"colorSchemeMinValue": null,
				// e.g. ["#000", "#c00", "#0c0", "#00c", "#c0c"]
				"customColorScheme": [],
				"isColorblind": false,
				"projection": "World",
				"defaultProjection": "World",
				"legendDescription": "",
				"legendStepSize": 20,
				"legendOrientation": "portrait",
			}
		},

		initialize: function() {
			this.on( "sync", this.onSync, this );
			$(document).trigger("chart-model");
		},

		onSync: function() {
			if( this.get( "chart-type" ) == App.ChartType.ScatterPlot ) {
				//make sure for scatter plot, we have color set as continents
				var chartDimensions = $.parseJSON( this.get( "chart-dimensions" ) );
				if( !_.findWhere( chartDimensions, { "property": "color" } ) ) {
					//this is where we add color property
					var colorPropObj = { "variableId":"123","property":"color","unit":"","name":"Color","period":"single","mode":"specific","targetYear":"2000","tolerance":"5","maximumAge":"5"};
					chartDimensions.push( colorPropObj );
					var charDimensionsString = JSON.stringify( chartDimensions );
					this.set( "chart-dimensions", charDimensionsString );
				}
			}			
		},

		addSelectedCountry: function( country ) {
			var selectedCountries = this.get( "selected-countries" );

			//make sure the selected contry is not there 
			if( !_.findWhere( selectedCountries, { id: country.id } ) ) {
				selectedCountries.push( country );
				//selectedCountries[ country.id ] = country;
				this.trigger( "change:selected-countries" );
				this.trigger( "change" );
			}
		},

		updateSelectedCountry: function( countryId, color ) {
			var country = this.findCountryById( countryId );
			if( country ) {
				country.color = color;
				this.trigger( "change:selected-countries" );
				this.trigger( "change" );
			}
		},

		removeSelectedCountry: function(entityName) {
			var selectedCountries = this.get("selected-countries");
			var entity = _.findWhere(selectedCountries, { name: entityName });
			if (!entity) return;

			selectedCountries = _.filter(selectedCountries, function(entity) {
				return entity.name != entityName;
			});

			this.set("selected-countries", selectedCountries);
		},

		replaceSelectedCountry: function( country ) {
			if( country ) {
				this.set( "selected-countries", [ country ] );
			}
		},

		findCountryById: function( countryId ) {
			var selectedCountries = this.get( "selected-countries" ),
				country = _.findWhere(selectedCountries, { id: countryId });
			return country;
		},

		setAxisConfig: function( axisName, prop, value ) {
			if( $.isArray( this.get( "y-axis" ) ) ) {
				//we got empty array from db, convert to object
				this.set( "y-axis", {} );
			}
			if( $.isArray( this.get( "x-axis" ) ) ) {
				//we got empty array from db, convert to object
				this.set( "x-axis", {} );
			}

			var axis = this.get( axisName );
			if( axis ) {
				axis[ prop ] = value;
			}
			this.trigger( "change" );
		},

		getAxisConfig: function(axisName, prop) {
			var axis = this.get(axisName);
			if (axis) return axis[prop];
		},

		updateVariables: function( newVar ) {
			//copy array
			var variables = this.get( "variables" ).slice(),
				varInArr = _.find( variables, function( v ){ return v.id == newVar.id; } );

			if( !varInArr ) {
				variables.push( newVar );
				this.set( "variables", variables );
			}
		},

		removeVariable: function( varIdToRemove ) {
			//copy array
			var variables = this.get( "variables" ).slice(),
				varInArr = _.find( variables, function( v ){ return v.id == newVar.id; } );

			if( !varInArr ) {
				variables.push( newVar );
				this.set( "variables", variables );
			}
		},

		updateMapConfig: function(propName, propValue, silent, eventName) {
			var mapConfig = this.get("map-config");

			if (!_.has(this.defaults["map-config"], propName))
				console.warn("No defined default for map config property '" + propName + "'");

			//if changing colorschem interval and custom colorscheme is used, update it
			if (propName === "colorSchemeInterval" && mapConfig.colorSchemeName === "custom")
				mapConfig.customColorScheme = mapConfig.customColorScheme.slice( 0, propValue );

			mapConfig[propName] = propValue;

			if (!silent)
				this.trigger(eventName || "change");
		}
	} );

})();
;(function() {		
	"use strict";

	window.App = window.App || {};
	App.Models = App.Models || {};

	/**
	 * This model handles the mass retrieval of data values associated with one
	 * or more variables, and is responsible for transforming the raw data into
	 * formats appropriate for use by the charts or other frontend systems.
	 **/
	App.Models.ChartDataModel = Backbone.Model.extend( {
		defaults: {},

		initialize: function () {
			App.ChartModel.on("change:chart-dimensions", this.update, this);
			this.update();
		},

		update: function() 	{	
			if (_.isEmpty(App.ChartModel.get("chart-dimensions"))) return;

			if (this.dataRequest) {
				this.dataRequest.abort();
				this.dataRequest = null;
			}

			this.dimensions = JSON.parse(App.ChartModel.get("chart-dimensions"));
			var variableIds = _.map(this.dimensions, function(dim) { return dim.variableId; });
			if (_.isEmpty(variableIds)) {
				this.clear();
				return;
			}

			this.isReady = false;
			this.set("variableData", null, { silent: true });
			// There's no cache tag in the editor
			var cacheTag = App.ChartModel.get("variableCacheTag");
			if (cacheTag)
				this.dataRequest = $.get(Global.rootUrl + "/data/variables/" + variableIds.join("+") + "?v=" + App.ChartModel.get("variableCacheTag"));
			else
				this.dataRequest = $.get(Global.rootUrl + "/data/variables/" + variableIds.join("+"));
			this.dataRequest.done(function(rawData) {
				this.dataRequest = null;
				this.receiveData(rawData);
			}.bind(this));
		},

		receiveData: function(rawData) {
			var variableData = {};

			var lines = rawData.split("\r\n");

			lines.forEach(function(line, i) {
				if (i == 0) { // First line contains the basic variable metadata 
					variableData = JSON.parse(line);
				} else if (i == lines.length-1) { // Final line is entity id => name mapping
					variableData.entityKey = JSON.parse(line);
				} else {
					var points = line.split(";");
					var variable;
					points.forEach(function(d, j) {
						if (j == 0) {
							variable = variableData.variables[d];
						} else {
							var spl = d.split(",");
							variable.years.push(spl[0]);
							variable.entities.push(spl[1]);
							variable.values.push(spl[2]);
						}
					});
				}
			});

			// We calculate some basic metadata that is likely to be useful to everyone
			var startYears = _.map(variableData.variables, function(v) { return _.first(v.years); });
			var endYears = _.map(variableData.variables, function(v) { return _.last(v.years); });
			var minYear = _.min(startYears);
			var maxYear = _.max(endYears);

			var availableEntities = [];
			_.each(variableData.entityKey, function(entity, id) {
				availableEntities.push(_.extend({}, entity, { "id": +id }));
			});

			window.variableData = variableData;
			this.isReady = true;	
			this.set({ variableData: variableData, minYear: minYear, maxYear: maxYear, availableEntities: availableEntities });
		},

		ready: function(callback) {
			var variableData = this.get("variableData");
			if (!variableData) {
				this.once("change:variableData", function() {
					callback(this.get("variableData"));
				}.bind(this));
			} else {
				callback(variableData);
			}
		},

		getSelectedCountriesById: function() {
			var variableData = this.get("variableData"),
				selectedCountries = App.ChartModel.get("selected-countries"),				
				chartType = App.ChartModel.get("chart-type"),
				selectedCountriesById = {};

			if (chartType != App.ChartType.ScatterPlot && _.isEmpty(selectedCountries)) {
				var random = _.sample(_.uniq(Object.keys(variableData.entityKey)), 3);
				selectedCountries = [];
				_.each(random, function(entityId) {
					selectedCountries.push({
						id: entityId,
						name: variableData.entityKey[entityId].name
					});
				});
				App.ChartModel.set("selected-countries", selectedCountries);
			}

			_.each(selectedCountries, function(entity) {
				selectedCountriesById[entity.id] = entity;
			});

			return selectedCountriesById;
		},

		transformDataForLineChart: function() {
			var dimensions = _.clone(this.dimensions).reverse(), // Keep them stacked in the same visual order as editor
				variableData = this.get('variableData'),
				variables = variableData.variables,
				entityKey = variableData.entityKey,
				selectedCountriesById = this.getSelectedCountriesById(),
				yAxis = App.ChartModel.get("y-axis"),
				localData = [],
				hasManyVariables = _.size(variables) > 1,
				hasManyEntities = _.size(selectedCountriesById) > 1,
				minTransformedYear = Infinity,
				maxTransformedYear = -Infinity;

			_.each(dimensions, function(dimension) {
				var variable = variables[dimension.variableId],
					variableName = dimension.displayName || variable.name,
					seriesByEntity = {};

				for (var i = 0; i < variable.years.length; i++) {
					var year = parseInt(variable.years[i]),
						value = parseFloat(variable.values[i]),
						entityId = variable.entities[i],
						entity = selectedCountriesById[entityId],
						series = seriesByEntity[entityId];

					// Not a selected entity, don't add any data for it
					if (!entity) continue;
					// It's possible we may be missing data for this year/entity combination
					// e.g. http://ourworldindata.org/grapher/view/101
					if (isNaN(value)) continue;
					// Values <= 0 break d3 log scales horribly
					if (yAxis['axis-scale'] === 'log' && value <= 0) continue;

					if (!series) {
						var key = entityKey[entityId].name,
							id = entityId;
						// If there are multiple variables per entity, we disambiguate the legend
						if (hasManyVariables) {
							id += "-" + variable.id;

							if (!hasManyEntities) {
								key = variableName;
							} else {
								key += " - " + variableName;
							}
						}

						series = {
							values: [],
							key: key,
							entityName: entityKey[entityId].name,
							id: id
						};
						seriesByEntity[entityId] = series;
					}

					var prevValue = series.values[series.values.length-1];
					if (prevValue)
						prevValue.gapYearsToNext = year-prevValue.x;
					series.values.push({ x: year, y: value, time: year });
					minTransformedYear = Math.min(minTransformedYear, year);
					maxTransformedYear = Math.max(maxTransformedYear, year);
				}

				_.each(seriesByEntity, function(v, k) {
					localData.push(v);
				});
			});

			this.minTransformedYear = minTransformedYear;
			this.maxTransformedYear = maxTransformedYear;
			return localData;
		},

		// Ensures that every series has a value entry for every year in the data
		// Even if that value is just 0
		// Stacked area charts with incomplete data will fail to render otherwise
		zeroPadData: function(localData) {
			var allYears = {};			
			var yearsForSeries = {};

			_.each(localData, function(series) {
				yearsForSeries[series.id] = {};
				_.each(series.values, function(d, i) {
					allYears[d.x] = true;
					yearsForSeries[series.id][d.x] = true;
				});
			});

			_.each(localData, function(series) {
				_.each(Object.keys(allYears), function(year) {
					year = parseInt(year);
					if (!yearsForSeries[series.id][year])
						series.values.push({ x: year, y: 0, time: year, fake: true });
				});

				series.values = _.sortBy(series.values, function(d) { return d.x; });
			});

			return localData;
		},

		// Zero pads for every single year in the data
		zeroPadDataRange: function(localData) {
			var minYear = Infinity, maxYear = -Infinity;
			_.each(localData, function(series) {
				minYear = Math.min(minYear, series.values[0].x);
				maxYear = Math.max(maxYear, series.values[series.values.length-1].x);
			});

			var yearsForSeries = {};
			_.each(localData, function(series) {
				yearsForSeries[series.id] = {};
				_.each(series.values, function(d, i) {
					yearsForSeries[series.id][d.x] = true;
				});
			});

			_.each(localData, function(series) {
				for (var year = minYear; year <= maxYear; year++) {					
					if (!yearsForSeries[series.id][year])
						series.values.push({ x: year, y: 0, time: year, fake: true });
				}
				series.values = _.sortBy(series.values, function(d) { return d.x; });
			});

			return localData;			
		},

		transformDataForStackedArea: function() {
			if (App.ChartModel.get("group-by-variables") == false)
				return this.zeroPadData(this.transformDataForLineChart());

			var dimensions = this.dimensions,
				variableData = this.get('variableData'),
				variables = variableData.variables,
				entityKey = variableData.entityKey,
				// Group-by-variable chart only has one selected country
				selectedCountry = _.values(this.getSelectedCountriesById())[0],
				localData = [],
				minTransformedYear = Infinity,
				maxTransformedYear = -Infinity;

			_.each(dimensions, function(dimension) {
				var variable = variables[dimension.variableId];

				var series = {
					id: variable.id,
					key: dimension.displayName || variable.name,
					entityName: selectedCountry.name,
					values: []
				};

				for (var i = 0; i < variable.years.length; i++) {
					var year = parseInt(variable.years[i]),
						value = parseFloat(variable.values[i]),
						entityId = variable.entities[i];

					if (entityId != selectedCountry.id) continue;

					series.values.push({ x: year, y: value, time: year });
					minTransformedYear = Math.min(minTransformedYear, year);
					maxTransformedYear = Math.max(maxTransformedYear, year);
				}

				localData.push(series);
			});

			this.minTransformedYear = minTransformedYear;
			this.maxTransformedYear = maxTransformedYear;
			return this.zeroPadData(localData);
		},

		makeCategoryTransform: function(property, values) {
			var colors = [ "#aec7e8", "#ff7f0e", "#1f77b4", "#ffbb78", "#2ca02c", "#98df8a", "#d62728", "#ff9896", "#9467bd", "#c5b0d5", "#8c564b", "c49c94", "e377c2", "f7b6d2", "7f7f7f", "c7c7c7", "bcbd22", "dbdb8d", "17becf", "9edae5", "1f77b4" ];
			var shapes = [ "circle", "cross", "triangle-up", "triangle-down", "diamond", "square" ];

			var outputValues = property == "color" ? colors : shapes,
				index = 0,
				categoryTransform = {};

			_.each(_.sortBy(_.uniq(values)), function(value) { 
				categoryTransform[value] = outputValues[index];
				index += 1;
				if (index >= outputValues.length) index = 0;
			});

			return categoryTransform;
		},

		transformDataForScatterPlot: function() {
			var dimensions = this.dimensions,
				variableData = this.get('variableData'),
				variables = variableData.variables,
				entityKey = variableData.entityKey,
				selectedCountriesById = this.getSelectedCountriesById(),
				seriesByEntity = {},
				// e.g. for colors { var_id: { 'Oceania': '#ff00aa' } }
				categoryTransforms = {},				
				localData = [];

			var latestYearInData = _.max(_.map(variables, function(v) { return _.max(v.years); }));

			_.each(dimensions, function(dimension) {
				var variable = variables[dimension.variableId],
				    targetYear = parseInt(dimension.targetYear),
				    targetMode = dimension.mode,
				    tolerance = parseInt(dimension.tolerance),
				    maximumAge = parseInt(dimension.maximumAge),
				    isCategorical = _.include(['color', 'shape'], dimension.property),
				    categoryTransform = categoryTransforms[variable.id];

				if (isCategorical && !categoryTransform) {
					categoryTransform = this.makeCategoryTransform(dimension.property, variable.values);
				}

				for (var i = 0; i < variable.years.length; i++) {
					var year = parseInt(variable.years[i]),
						value = variable.values[i],
						entityId = variable.entities[i],
						entity = selectedCountriesById[entityId],
						series = seriesByEntity[entityId];						

					// Scatterplot defaults to showing all countries if none selected
					if (!_.isEmpty(selectedCountriesById) && !entity) continue;

					if (!series) {
						series = {
							values: [{ time: {} }],
							key: entityKey[entityId].name,
							entityName: entityKey[entityId].name,
							id: entityId
						};
						seriesByEntity[entityId] = series;
					}

					// Categorical data like color or shape just goes straight on the series
					if (isCategorical) {
						series[dimension.property] = categoryTransform[value];
						continue;
					}

					if (targetMode === "specific") {
						// Not within target year range, ignore
						if (year < targetYear-tolerance || year > targetYear+tolerance)
							continue;

						// Make sure we use the closest year within tolerance (favoring later years)
						var current = series.values[0].time[dimension.property];
						if (current && Math.abs(current - targetYear) < Math.abs(year - targetYear))
							continue;
					} else if (targetMode == "latest" && !isNaN(maximumAge)) {
						if (year < latestYearInData-maximumAge)
							continue;
					}

					// All good, put the data in. Note that a scatter plot only has one value per entity.
					var datum = series.values[0];
					datum[dimension.property] = parseFloat(value);
					datum.time[dimension.property] = year;
				}
			}.bind(this));

			// Exclude any countries which lack data for one or more variables
			_.each(seriesByEntity, function(series) {
				var isComplete = _.every(dimensions, function(dim) {
					return dim.property == "color" || series.values[0].hasOwnProperty(dim.property);
				});

				if (isComplete)
					localData.push(series);
			}.bind(this));

			this.minTransformedYear = _.min(_.map(localData, function(entityData) {
				return _.min(_.values(entityData.values[0].time));
			}));
			this.maxTransformedYear = _.max(_.map(localData, function(entityData) {
				return _.max(_.values(entityData.values[0].time));
			}));

			return localData;
		},

		getSourceDescHtml: function(dimension) {
			var variableData = this.get("variableData"),
				variable = variableData.variables[dimension.variableId],
				source = variable.source;

			var displayName = _.isEmpty(dimension.displayName) ? variable.name : dimension.displayName;
			var hideDimName = _.isEmpty(dimension.name) || _.size(this.get("variableData").variables) == 1;

			var html = "<div class='datasource-wrapper'>";
			html += (hideDimName ? "<h2>Data</h2>" : "<h2>Data for " + dimension.name + ": </h2>");
			html += "<div class='datasource-header'>" +
					    "<h3><span class='datasource-property'>Dataset:</span>" + variable.dataset_name + "</h3>";

			if (variable.name != variable.dataset_name)
				html += "<h4><span class='datasource-property'>Variable:</span>" + variable.name + "</h4>";

			html += "</div>";

			html += "<table>";
			if (displayName != variable.name)
				html += "<tr><td><span class='datasource-property'>Display name</span></td><td>" + displayName + "</td></tr>";
			if (variable.description)
				html += "<tr><td><span class='datasource-property'>Definition</span></td><td>" + variable.description + "</td></tr>";
			if (variable.unit)
				html += "<tr><td><span class='datasource-property'>Unit</span></td><td>" + variable.unit + "</td></tr>";
			if (variable.created_at && variable.created_at != "0000-00-00 00:00:00")
				html += "<tr><td><span class='datasource-property'>Uploaded</span></td><td>" + variable.created_at + "</td></tr>";
			html += "</table>";
			
			html += source.description;
			html += "</div>"
			return html;
		},

		transformDataForSources: function() {
			var variableData = this.get("variableData");			
			if (!variableData) return [];

			return _.map(this.dimensions, function(dimension) {
				var variable = variableData.variables[dimension.variableId],
					source = _.extend({}, variable.source);

				source.description = this.getSourceDescHtml(dimension);
				return source;
			}.bind(this));
		},

		transformData: function() {
			var variableData = this.get("variableData");
			if (!variableData) return [];

			var chartType = App.ChartModel.get("chart-type");
			if (chartType == App.ChartType.LineChart)
				return this.transformDataForLineChart();
			else if (chartType == App.ChartType.ScatterPlot)
				return this.transformDataForScatterPlot();
			else if (chartType == App.ChartType.StackedArea)
				return this.transformDataForStackedArea();	
			else
				return this.transformDataForLineChart();
		},
	});
})();
;( function() {	
	"use strict";

	window.App = window.App || {};
	App.Views = App.Views || {};
	App.Views.Chart = App.Views.Chart || {};	

	App.Views.Chart.Header = Backbone.View.extend({
		DEFAULT_LOGO_URL: "uploads/26538.png",

		el: "#chart-view .chart-header",
		events: {},

		initialize: function( options ) {
			this.dispatcher = options.dispatcher;
			this.parentView = options.parentView;

			this.logo = d3.select(".logo-svg");
			this.partnerLogo = d3.select(".partner-logo-svg");
			this.$tabs = $(".header-tab");

			App.ChartModel.on( "change", this.render, this );
		},

		render: function(callback) {
			var chartName = App.ChartModel.get( "chart-name" ),
				chartSubname = App.ChartModel.get( "chart-subname" ) || "",
				addCountryMode = App.ChartModel.get( "add-country-mode" ),
				selectedCountries = App.ChartModel.get("selected-countries"),
				logoPath = App.ChartModel.get("logo"),
				partnerLogoPath = App.ChartModel.get("second-logo"),
				partnerLogoUrl = partnerLogoPath && Global.rootUrl + "/" + partnerLogoPath,
				tabs = App.ChartModel.get( "tabs" );

			/* Figure out the final header text */

			this.updateTime();
			chartName = this.replaceContextPlaceholders(chartName);
			chartSubname = this.replaceContextPlaceholders(chartSubname);
			if (this.mapDisclaimer) chartSubname += this.mapDisclaimer;

			/* Position the logos first, because we shall need to wrap the text around them.
			   Currently our logo is SVG but we must use image uris for the partner logos.
			   TODO: Convert partner logos to SVG too, so that they can be scaled. */

			var svg = d3.select("svg"),
				svgBounds = svg.node().getBoundingClientRect(),
				svgWidth = svgBounds.width,
				svgHeight = svgBounds.height,
				g = svg.select(".chart-header-svg");

			var logoWidth = this.logo.node().getBBox().width,
				scaleFactor =  0.3,
				logoX = svgWidth - logoWidth*scaleFactor;
			this.logo.attr("transform", "translate(" + logoX + ", 5) scale(" + scaleFactor + ", " + scaleFactor + ")");
			this.logo.style("visibility", "inherit");

			var renderText = function(availableWidth) {
				var chartNameText = g.select(".chart-name-svg");
				var baseUrl = Global.rootUrl + "/" + App.ChartModel.get("chart-slug"),
					queryParams = owid.getQueryParams(),
					queryStr = owid.queryParamsToStr(queryParams),				
					canonicalUrl = baseUrl + queryStr;

				var linkedName = "<a href='" + canonicalUrl + "' target='_blank'>" + chartName + "</a>";
				owid.svgSetWrappedText(chartNameText, linkedName, availableWidth - 10, { lineHeight: 1.1 });
				document.title = chartName + " - Our World In Data";

				var chartSubnameText = g.select(".chart-subname-svg")
					.attr("y", chartNameText.node().getBoundingClientRect().bottom - svgBounds.top);

				owid.svgSetWrappedText(chartSubnameText, chartSubname, availableWidth - 10, { lineHeight: 1.3 });

				g.select(".header-bg-svg").remove();
				var bgHeight = g.node().getBoundingClientRect().height + 20;
				g.insert("rect", "*")
					.attr("class", "header-bg-svg")
					.attr("x", 0)
					.attr("y", 0)
					.style("fill", "#fff")
					.attr("width", svgWidth)
					.attr("height", bgHeight);
				this.$tabs.attr("style", "display: none !important;");

				_.each(tabs, function( v, i ) {
					var tab = this.$tabs.filter("." + v + "-header-tab");
					tab.show();
				}.bind(this));

				//for first visible tab, add class for border-left, cannot be done in pure css http://stackoverflow.com/questions/18765814/targeting-first-visible-element-with-pure-css
				this.$tabs.removeClass( "first" );
				this.$tabs.filter( ":visible:first" ).addClass( "first" );

				this.dispatcher.trigger("header-rendered");			
				if (_.isFunction(callback)) callback();					
			}.bind(this);

			if (partnerLogoUrl) {
				// HACK (Mispy): Since SVG image elements aren't autosized, any partner logo needs to 
				// be loaded separately in HTML and then the width and height extracted
				var img = new Image();
				img.onload = function() {
					this.partnerLogo.attr('width', img.width);
					this.partnerLogo.attr('height', img.height);
		
					var partnerLogoX = logoX - img.width - 5;
					this.partnerLogo.node().setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", partnerLogoUrl);
					this.partnerLogo.attr("transform", "translate(" + partnerLogoX + ", 5)");				
					this.partnerLogo.style("visibility", "inherit");

					renderText(partnerLogoX);
				}.bind(this);
				img.src = partnerLogoUrl;
			} else {
				renderText(logoX);
			}
		},

		onResize: function(callback) {
			this.render(callback);
		},

		// Replaces things like *time* and *country* with the actual time and
		// country displayed by the current chart context
		replaceContextPlaceholders: function(text) {
			if (s.contains(text, "*country*")) {
				var selectedCountries = App.ChartModel.get("selected-countries");
				text = text.replace("*country*", _.pluck(selectedCountries, "name").join(", "));
			}

			if (s.contains(text, "*time")) {
				if (!this.selectedTimeFrom) {
					text = text.replace("*time*", "over time");
				} else {
					var timeFrom = owid.displayYear(this.selectedTimeFrom),
						timeTo = owid.displayYear(this.selectedTimeTo),
						time = this.targetYear || (timeFrom === timeTo ? timeFrom : timeFrom + " to " + timeTo);				

					text = text.replace("*time*", time);
					text = text.replace("*timeFrom*", timeFrom);
					text = text.replace("*timeTo*", timeTo);					
				}
			}

			return text;
		},

		updateTime: function() {
			var tabs =	App.ChartModel.get( "tabs" ),
				activeTab = _.find(tabs, function(tab) { return this.$tabs.filter("." + tab + "-header-tab.active").length > 0}.bind(this));

			if (activeTab == "map") {
				if (this.parentView.mapTab.mapConfig)
					this.updateTimeFromMap(this.parentView.mapTab);
			} else {
				if (this.parentView.chartTab && this.parentView.chartTab.localData)
					this.updateTimeFromChart();
			}
		},

		updateTimeFromChart: function() {
			//find minimum and maximum in all displayed data
			var dimsString = App.ChartModel.get("chart-dimensions"),
				dims = $.parseJSON( dimsString ),
				latestAvailable = false,
				timeFrom = App.DataModel.minTransformedYear,
				timeTo = App.DataModel.maxTransformedYear;

			this.selectedTimeFrom = timeFrom;
			this.selectedTimeTo = timeTo;
			this.mapDisclaimer = null;
			this.targetYear = null;
		},

		updateTimeFromMap: function(map) {			
			var timeFrom = map.minToleranceYear || map.mapConfig.targetYear,
				timeTo = map.maxToleranceYear || map.mapConfig.targetYear,
				targetYear = map.mapConfig.targetYear,
				hasTargetYear = _.find(map.mapData, function(d) { return d.year == targetYear; }),
				d = owid.displayYear;

			if (hasTargetYear && timeFrom != timeTo) {
				// The target year is in the data but we're displaying a range, meaning not available for all countries
				this.mapDisclaimer = " Since some observations for " + d(targetYear) + " are not available the map displays the closest available data (" + d(timeFrom) + " to " + d(timeTo) + ").";
			} else if (!hasTargetYear && timeFrom != timeTo) {
				// The target year isn't in the data at all and we're displaying a range of other nearby values
				this.mapDisclaimer = " Since observations for " + d(targetYear) + " are not available the map displays the closest available data (" + d(timeFrom) + " to " + d(timeTo) + ").";
			} else if (!hasTargetYear && timeFrom == timeTo && timeFrom != targetYear) {
				// The target year isn't in the data and we're displaying some other single year
				this.mapDisclaimer = " Since observations for " + d(targetYear) + " are not available the map displays the closest available data (from " + d(timeFrom) + ").";
			} else if (!hasTargetYear) {
				this.mapDisclaimer = " No observations are available for this year.";
			} else {
//				this.mapDisclaimer = "<span style='visibility: hidden;'>A rather long placeholder to ensure that the text flow remains the same when changing between various years.</span>";
				this.mapDisclaimer = null;
			}

			this.selectedTimeFrom = timeFrom;
			this.selectedTimeTo = timeTo;
			this.timeGoesToLatest = false;
			this.targetYear = targetYear;
		},

	});

})();
;(function() {	
	"use strict";
	owid.namespace("App.Views.Chart.Footer");

	App.Views.Chart.Footer = Backbone.View.extend({
		el: "#chart-view .footer-btns",
		events: {
			"click .embed-btn": "onEmbed"
		},

		initialize: function(options) {
			this.dispatcher = options.dispatcher;
			this.$chartLinkBtn = this.$el.find(".chart-link-btn");
			this.$tweetBtn = this.$el.find(".tweet-btn");
			this.$facebookBtn = this.$el.find(".facebook-btn");
			this.$embedBtn = this.$el.find(".embed-btn");
			this.$downloadPNGButton = this.$el.find(".download-image-btn");
			this.$downloadSVGButton = this.$el.find(".download-svg-btn");
			this.$embedModal = $(".embed-modal");
			this.$embedModal.appendTo("body");			

			App.ChartModel.on("change", this.render.bind(this));
			this.dispatcher.on("header-rendered", this.updateSharingButtons.bind(this));
			$(window).on("query-change", this.updateSharingButtons.bind(this));
		},

		render: function(callback) {
			App.DataModel.ready(function() {
				this.renderSVG();
				this.updateSharingButtons();
				if (_.isFunction(callback)) callback();
			}.bind(this));
		},

		renderSVG: function(callback) {
			var sources = App.DataModel.transformDataForSources(),
				sourceNames = _.uniq(_.pluck(sources, "name")),
 				license = App.DataModel.get("variableData").license,
 				chartDesc = App.ChartModel.get("chart-description"),
				footerSvgContent = "Data obtained from: ";
				
			_.each(sourceNames, function(sourceName, i) {
				if (i > 0) footerSvgContent += ", ";
				footerSvgContent += "<a class='source-link' href='#'>" + sourceName + "</a>";
			});

			if (license && license.description) {
				var desc = license.description;
				var originUrl = App.ChartModel.get("data-entry-url");

				// Make sure the link back to OWID is consistent
				if (originUrl && s.contains(originUrl, "ourworldindata.org")) {
					var a = document.createElement('a');
					a.href = originUrl;
					var path = a.pathname[0] == "/" ? a.pathname : "/" + a.pathname; // MISPY: cross-browser compat (Internet Explorer doesn't have a slash)
					var finalUrl = "https://ourworldindata.org" + path + a.search;
					desc = desc.replace(/\*data-entry\*/, "<a class='origin-link' target='_blank' href='" + finalUrl + "'>" + "OurWorldInData.org" + path + a.search + "</a>");					
				} else {
					desc = desc.replace(/\*data-entry\*/, 
						"<a class='origin-link' target='_blank' href='http://ourworldindata.org'>OurWorldInData.org</a>");					
				}

				footerSvgContent += "\n\n" + desc;
			}			

			// Any additional, manually inputed footer text
			if (chartDesc)
				footerSvgContent += "\n" + chartDesc;

			var svg = d3.select("svg"),
				svgWidth = svg.node().getBoundingClientRect().width,
				svgHeight = svg.node().getBoundingClientRect().height;

			svg.selectAll(".chart-footer-svg").remove();
			var g = svg.append("g").attr("class", "chart-footer-svg");

			var footerText = g.append("text")
				.attr("x", 0)
				.attr("y", 0)
				.attr("dy", 0);

			owid.svgSetWrappedText(footerText, footerSvgContent, svgWidth, { lineHeight: 1.2 });

			$(".chart-footer-svg .source-link").click(function(ev) {
				ev.preventDefault();
				App.ChartView.activateTab("sources");
			});

			var footerHeight = g.node().getBBox().height;
			g.insert("rect", "*")
				.attr("x", 0).attr("y", -25)			
				.attr("width", svgWidth)
				.attr("height", footerHeight + 25)
				.style("fill", "#fff");
			g.attr("transform", "translate(0, " + (svgHeight - footerHeight) + ")");

			if (callback) callback();
		},

		updateSharingButtons: function() {
			var headerText = d3.select("title").text().replace(" - Our World In Data", ""),
				baseUrl = Global.rootUrl + "/" + App.ChartModel.get("chart-slug"),
				queryParams = owid.getQueryParams(),
				queryStr = owid.queryParamsToStr(queryParams),				
				tab = App.ChartView.activeTabName,
				canonicalUrl = baseUrl + queryStr,
				version = App.ChartModel.get("variableCacheTag");

			this.$chartLinkBtn.attr('href', canonicalUrl);

			var tweetHref = "https://twitter.com/intent/tweet/?text=" + encodeURIComponent(headerText) + "&url=" + encodeURIComponent(canonicalUrl) + "&via=MaxCRoser";
			this.$tweetBtn.attr('href', tweetHref);

			var facebookHref = "https://www.facebook.com/dialog/share?app_id=1149943818390250&display=page&href=" + encodeURIComponent(canonicalUrl);
			this.$facebookBtn.attr('href', facebookHref);

			if (tab == "data" || tab == "sources") {
				this.$downloadPNGButton.hide();
				this.$downloadSVGButton.hide();
			} else {			
				var pngHref = baseUrl + ".png" + queryStr,
					svgHref = baseUrl + ".svg" + queryStr,
					defaultSize = "1000x700";
				this.$downloadPNGButton.attr('href', pngHref + (_.include(pngHref, "?") ? "&" : "?") + "size=" + defaultSize + "&v=" + version);
				this.$downloadSVGButton.attr('href', svgHref + (_.include(svgHref, "?") ? "&" : "?") + "size=" + defaultSize + "&v=" + version);
				this.$downloadPNGButton.show();
				this.$downloadSVGButton.show();
			}

			var iframeWidth = App.ChartModel.get("iframe-width") || "100%";
			var iframeHeight = App.ChartModel.get("iframe-height") || "660px";
			var embedCode = '<iframe src="' + canonicalUrl + '" width="' + iframeWidth + '" height="' + iframeHeight + '" frameborder="0"></iframe>';
			this.$embedModal.find("textarea").text(embedCode);
		},

		onResize: function(callback) {
			this.renderSVG(callback);
		},

		onEmbed: function() {
			this.$embedModal.modal();
		},
	});
})();
;(function() {	
	"use strict";

	window.App = window.App || {};
	App.Views = App.Views || {};
	App.Views.Chart = App.Views.Chart || {};

	App.Views.Chart.ScaleSelectors = Backbone.View.extend({

		el: "#chart-view .axis-scale-selectors-wrapper",
		events: {
			"click .axis-scale-btn": "onAxisScaleBtn",
			"change .axis-scale li": "onAxisScaleChange"
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			
			this.$tabs = this.$el.find( ".header-tab" );
			
			this.$xAxisScale = this.$el.find( "[data-name='x-axis-scale']" );
			this.$yAxisScale = this.$el.find( "[data-name='y-axis-scale']" );
			this.$xAxisBtn = this.$el.find(".x-axis-scale-selector .axis-scale-btn");
			this.$yAxisBtn = this.$el.find(".y-axis-scale-selector .axis-scale-btn");


			this.render();
			App.ChartModel.on( "change", this.render, this );
		},

		render: function() {			
			var xScale = App.ChartModel.getAxisConfig("x-axis", "axis-scale");
			this.$xAxisBtn.find('span').text(s.capitalize(xScale));

			var yScale = App.ChartModel.getAxisConfig("y-axis", "axis-scale");
			this.$yAxisBtn.find('span').text(s.capitalize(yScale));
		},

		onAxisScaleBtn: function(evt) {			
			evt.preventDefault();

			var $btn = $(evt.currentTarget),
				$div = $btn.closest("div"),
				divName = $div.attr("data-name"),
				axisName  = (name == "x-axis-scale") ? "x-axis" : "y-axis",
				currentScale = App.ChartModel.getAxisConfig(axisName, "axis-scale");


			if (currentScale != "linear") 
				App.ChartModel.setAxisConfig(axisName, "axis-scale", "linear");
			else
				App.ChartModel.setAxisConfig(axisName, "axis-scale", "log");
		}

	});	
})();

;(function() {	
	"use strict";
	owid.namespace("App.Views.Chart.Legend");

	// HACK (Mispy): Avoid duplication in legend when there are multiple
	// split series for styling purposes.
	function getData(data) {
		if (data.length == 0 || !data[0].origKey)
			return data;
		return _.filter(data, function(series) { return !series.isCopy; });
	}

	App.Views.Chart.Legend = function( chartLegend ) {
	
		//based on https://github.com/novus/nvd3/blob/master/src/models/legend.js

		//============================================================
		// Public Variables with Default Settings
		//------------------------------------------------------------

		var chartType = App.ChartModel.get( "chart-type" )
			, margin = {top: 5, right: 50, bottom: 5, left: 40}
			, width = 800
			, height = 20
			, getKey = function(d) { return d.origKey || d.key }
			, color = nv.utils.getColor()
			, padding = 40 //define how much space between legend items. - recommend 32 for furious version
			, rightAlign = false
			, updateState = true   //If true, legend will update data.disabled and trigger a 'stateChange' dispatch.
			, radioButtonMode = false   //If true, clicking legend items will cause it to behave like a radio button. (only one can be selected at a time)
			, expanded = false
			, dispatch = d3.dispatch('legendClick', 'legendDblclick', 'legendMouseover', 'legendMouseout', 'stateChange', 'addEntity')
			, vers = 'classic' //Options are "classic" and "furious" and "owd"
			;

		function chart(selection) {			
			selection.each(function(data) {
				var $svg = $( "svg.nvd3-svg" ),
					availableWidth = $svg.width() - margin.left - margin.right,
					container = d3.select(this);
				
				nv.utils.initSVG(container);

				var bindableData = getData(data);

				//discrete bar chart needs unpack data
				if( chartType === App.ChartType.DiscreteBar ) {
					if( data && data.length && data[0].values ) {
						var discreteData = _.map( data[0].values, function( v, i ) {
							return { id: v.id, key: v.x, color: v.color, values: v };
						} );
						bindableData = discreteData;
					}
				}
				
				// Setup containers and skeleton of chart
				var wrap = container.selectAll('g.nv-custom-legend').data([bindableData]),
				//var wrap = container.selectAll('g.nv-custom-legend').data([data]),
					gEnter = wrap.enter().append('g').attr('class', 'nvd3 nv-custom-legend').append('g').attr( 'class', 'nv-legend-series-wrapper' ),
					g = wrap.select('g');

				wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

				var series = g.selectAll('.nv-series')
					.data(function(d) {
						if(vers != 'furious') return d;
						return d.filter(function(n) {
							return expanded ? true : !n.disengaged;
						});
					});

				//special styling for stacked area chart legend
				if (chartType === App.ChartType.StackedArea) {
					container.selectAll('g.nv-custom-legend').classed("transparent", true);
				}
				
				//add entity label
				var entityLabel = wrap.select( '.nv-entity-label' ),
					entityLabelText = entityLabel.select( 'text' ),
					entityLabelWidth = 0;

				//if not existing, add nv-add-btn, if not grouping by variables
				var addEntityBtn =  wrap.select('g.nv-add-btn'),
					isNewAddBtn = addEntityBtn.empty();
				if (isNewAddBtn) {
					addEntityBtn = wrap.append('g').attr('class', 'nv-add-btn');
					var addEntityBtnG = addEntityBtn.append('g').attr( { 'class': 'add-btn-path' } );
					addEntityBtnG.append('path').attr( { 'd': 'M15,0 L15,14', 'class': 'nv-box' } );
					addEntityBtnG.append('path').attr( { 'd': 'M8,7 L22,7', 'class': 'nv-box' } );
					//http://android-ui-utils.googlecode.com/hg-history/ac955e6376470d9599ead07b4599ef937824f919/asset-studio/dist/res/clipart/icons/refresh.svg?r=ac955e6376470d9599ead07b4599ef937824f919
					addEntityBtn.append('path').attr( { 'd': 'M160.469,242.194c0-44.414,36.023-80.438,80.438-80.438c19.188,0,36.711,6.844,50.5,18.078L259.78,209.93l99.945,11.367    l0.805-107.242l-30.766,29.289c-23.546-21.203-54.624-34.164-88.804-34.164c-73.469,0-133.023,59.562-133.023,133.016    c0,2.742,0.242-2.266,0.414,0.445l53.68,7.555C161.03,245.108,160.469,247.562,160.469,242.194z M371.647,237.375l-53.681-7.555    c1.017,5.086,1.556,2.617,1.556,7.992c0,44.414-36.008,80.431-80.43,80.431c-19.133,0-36.602-6.798-50.383-17.97l31.595-30.078    l-99.93-11.366l-0.812,107.25l30.789-29.312c23.531,21.141,54.57,34.055,88.688,34.055c73.468,0,133.023-59.555,133.023-133.008    C372.062,235.078,371.812,240.085,371.647,237.375z', 'class': 'nv-box change-btn-path', 'transform': 'scale(.04) translate(150,-50)' } );
					addEntityBtn.append('text').attr( {'x':28,'y':11} ).text('Add country');
					addEntityBtn.on('click', function(d, i) {
						dispatch.addEntity();
						d3.event.stopImmediatePropagation();
					});
					addEntityBtn.insert('rect', '*').attr('class', 'add-btn-bg');
				}

				//based on selected countries selection hide or show addEntityBtn
				if (_.isEmpty(App.ChartModel.get("selected-countries"))) {
					addEntityBtn.attr( "display", "none" );
				} else {
					addEntityBtn.attr( "display", "block" );
				}

				var addCountryMode = App.ChartModel.get( "add-country-mode" );
				if (addCountryMode === "add-country") {
					addEntityBtn.select("text" ).text("Add country");
					addEntityBtn.select(".add-btn-path" ).attr( "display", "block");
					addEntityBtn.select(".change-btn-path" ).attr( "display", "none");
					addEntityBtn.attr( "display", "block" );
				} else if (addCountryMode === "change-country") {
					addEntityBtn.select(".add-btn-path").attr("display", "none");
					addEntityBtn.select(".change-btn-path").attr("display", "block");
					addEntityBtn.select("text").text("Change country");
					addEntityBtn.attr("display", "block");
				} else {
					addEntityBtn.attr("display", "none");
				}

				if (isNewAddBtn) {
					addEntityBtn.select("rect")
						.attr({ width: addEntityBtn.node().getBoundingClientRect().width + 15, height: '25', transform: 'translate(0,-5)' });
				}
					
				var seriesEnter = series.enter().append('g').attr('class', function(d) { return 'nv-series nv-series-' + d.id; } ),
					seriesShape, seriesRemove;

				var versPadding = 30;
				seriesEnter.append('rect')
					.style('stroke-width', 2)
					.attr('class','nv-legend-symbol');

				//enable removing countries only if Add/Replace country button present
				if( addCountryMode == "add-country" && !App.ChartModel.get( "group-by-variables" ) ) {
					var removeBtns = seriesEnter.append('g')
						.attr('class', 'nv-remove-btn')
						.attr('transform', 'translate(10,10)');
					removeBtns.append('path').attr( { 'd': 'M0,0 L7,7', 'class': 'nv-box' } );
					removeBtns.append('path').attr( { 'd': 'M7,0 L0,7', 'class': 'nv-box' } );
				}
				
				seriesShape = series.select('.nv-legend-symbol');
				
				seriesEnter.append('text')
					.attr('text-anchor', 'start')
					.attr('class','nv-legend-text')
					.attr('dy', '.32em')
					.attr('dx', '0');

				var seriesText = series.select('text.nv-legend-text'),
					seriesRemove = series.select('.nv-remove-btn');

				series
					.on('mouseover', function(d,i) {
						chartLegend.dispatch.legendMouseover(d,i);  //TODO: Make consistent with other event objects
					})
					.on('mouseout', function(d,i) {
						chartLegend.dispatch.legendMouseout(d,i);
					})
					.on('click', function(d,i) {
						if (App.ChartModel.get("group-by-variables") || addCountryMode !== "add-country") {
							//if displaying variables, instead of removing, use original version just to turn stuff off
							//original version, when clicking country label just deactivates it
							chartLegend.dispatch.legendClick(d,i);
							// make sure we re-get data in case it was modified
							var data = getData(series.data());
							if (updateState) {
								if(expanded) {
									d.disengaged = !d.disengaged;
									d.userDisabled = d.userDisabled == undefined ? !!d.disabled : d.userDisabled;
									d.disabled = d.disengaged || d.userDisabled;
								} else if (!expanded) {
									d.disabled = !d.disabled;
									d.userDisabled = d.disabled;
									var engaged = data.filter(function(d) { return !d.disengaged; });
									if (engaged.every(function(series) { return series.userDisabled })) {
										//the default behavior of NVD3 legends is, if every single series
										// is disabled, turn all series' back on.
										data.forEach(function(series) {
											series.disabled = series.userDisabled = false;
										});
									}
								}
								chartLegend.dispatch.stateChange({
									disabled: data.map(function(d) { return !!d.disabled; }),
									disengaged: data.map(function(d) { return !!d.disengaged; })
								});
							}
							return false;
						} else {
							//when clicking country label, remove the country
							d3.event.stopImmediatePropagation();
							//remove series straight away, so we don't have to wait for response from server
							series[0][i].remove();
							
							var id = d.id;
							//in case of multivarient chart
							//id could be string or integer
							if (id.indexOf && id.indexOf("-") > 0 ) {
								id = parseInt( id.split( "-" )[ 0 ], 10 );
							} else {
								id = parseInt( id, 10 );
							}
							App.ChartModel.removeSelectedCountry(d.entityName);
							return false;
						}
					});

				series.classed('nv-disabled', function(d) { return d.userDisabled; });
				series.exit().remove();

				seriesText
					.attr('fill', setTextColor)
					.text(getKey);

				var transformX = 0, transformY = 0;
				series.each(function(d, i) {
					var legendText = d3.select(this).select('text');
					var nodeTextLength = legendText.node().getComputedTextLength();

					if (transformX+nodeTextLength > availableWidth)  {
						transformY += versPadding;
						transformX = 0;
					}

					d3.select(this).attr("transform", "translate(" + transformX + "," + transformY + ")");

					transformX += nodeTextLength + padding;
				});
				var legendWidth = availableWidth;

				//position legend as far right as possible within the total width
				if (rightAlign) {
					g.attr('transform', 'translate(' + (width - margin.right - legendWidth) + ',' + margin.top + ')');
				}
				else {
					g.attr('transform', 'translate(' + entityLabelWidth + ',' + margin.top + ')');
				}

				height = margin.top + margin.bottom + transformY + versPadding;// + (Math.ceil(seriesWidths.length / seriesPerRow) * versPadding);

				// Size rectangles after text is placed
				seriesShape
					.attr('width', function(d,i) {
						//position remove btn
						var width = seriesText[0][i].getComputedTextLength() + 5;
						d3.select( seriesRemove[0][i] ).attr( 'transform', 'translate(' + width + ',-3)' );
						return width+25;
					})
					.attr('height', 24)
					.attr('y', -12)
					.attr('x', -12);

				// The background for the expanded legend (UI)
				gEnter.insert('rect',':first-child')
					.attr('class', 'nv-legend-bg')
					.attr('fill', '#eee')
					// .attr('stroke', '#444')
					.attr('opacity',0);

				var seriesBG = g.select('.nv-legend-bg');

				seriesBG
				.transition().duration(300)
					.attr('x', -versPadding )
					.attr('width', legendWidth + versPadding - 12)
					.attr('height', height )
					.attr('y', -margin.top - 10)
					.attr('opacity', expanded ? 1 : 0);

				seriesShape
					.style('fill', setBGColor)
					.style('fill-opacity', setBGOpacity)
					.style('stroke', setBGColor);

				//position add btn
				if (series.size()) {
					var seriesArr = series[0];
					if( seriesArr && seriesArr.length ) {
						//fetch last element to know its width
						var lastEl = seriesArr[ seriesArr.length-1 ],
							//need rect inside element that has set width
							lastRect = d3.select( lastEl ).select( "rect" ),
							lastRectWidth = lastRect.attr( "width" );
						//position add btn
						transformX -= 3;
						//centering
						transformY = +transformY - 3;
						//check for right edge
						var buttonWidth = 120, buttonHeight = 35;
						if( ( transformX + buttonWidth ) > availableWidth ) {
							//make sure we have button
							var addEntityDisplay = addEntityBtn.attr( "display" );
							if( addEntityDisplay !== "none" ) {
								transformX = 0;//availableWidth - buttonWidth;
								transformY += buttonHeight;
								//update whole chart height as well
								height += buttonHeight;
							}
						}
						addEntityBtn.attr( "transform", "translate( " + transformX + ", " + transformY + ")" );
					}
				}
			});
			
			function setTextColor(d,i) {
				if(vers != 'furious' && vers != 'owd') return '#000';
				if(expanded) {
					return d.disengaged ? '#000' : '#fff';
				} else if (!expanded) {
					if(!d.color) d.color = color(d,i);
					return !!d.disabled ? '#666' : '#fff';
					//return !!d.disabled ? d.color : '#fff';
				}
			}

			function setBGColor(d,i) {
				if(expanded && (vers == 'furious' || vers == 'owd')) {
					return d.disengaged ? '#eee' : d.color || color(d,i);
				} else {
					return d.color || color(d,i);
				}
			}


			function setBGOpacity(d,i) {
				if(expanded && (vers == 'furious' || vers == 'owd')) {
					return 1;
				} else {
					return !!d.disabled ? 0 : 1;
				}
			}

			return chart;
		}

		//============================================================
		// Expose Public Variables
		//------------------------------------------------------------

		chart.dispatch = dispatch;
		chart.options = nv.utils.optionsFunc.bind(chart);

		chart._options = Object.create({}, {
			// simple options, just get/set the necessary values
			width:      {get: function(){return width;}, set: function(_){width=_;}},
			height:     {get: function(){return height;}, set: function(_){height=_;}},
			key:        {get: function(){return getKey;}, set: function(_){getKey=_;}},
			rightAlign:    {get: function(){return rightAlign;}, set: function(_){rightAlign=_;}},
			padding:       {get: function(){return padding;}, set: function(_){padding=_;}},
			updateState:   {get: function(){return updateState;}, set: function(_){updateState=_;}},
			radioButtonMode:    {get: function(){return radioButtonMode;}, set: function(_){radioButtonMode=_;}},
			expanded:   {get: function(){return expanded;}, set: function(_){expanded=_;}},
			vers:   {get: function(){return vers;}, set: function(_){vers=_;}},

			// options that require extra logic in the setter
			margin: {get: function(){return margin;}, set: function(_){
				margin.top    = _.top    !== undefined ? _.top    : margin.top;
				margin.right  = _.right  !== undefined ? _.right  : margin.right;
				margin.bottom = _.bottom !== undefined ? _.bottom : margin.bottom;
				margin.left   = _.left   !== undefined ? _.left   : margin.left;
			}},
			color:  {get: function(){return color;}, set: function(_){
				color = nv.utils.getColor(_);
			}}
		});

		chart.highlightPoint = function(evt) {
			chart.clearHighlight();
			var id = ( evt && evt.point )? evt.point.id: "";
			if( id ) {
				d3.selectAll( ".nv-custom-legend .nv-series-" + id ).classed( "highlight", true );
			}
		};
		chart.clearHighlight = function(evt) {
			d3.selectAll( ".nv-custom-legend .nv-series" ).classed( "highlight", false );
		};

		nv.utils.initOptions(chart);

		return chart;
	};
})();
;(function() {
	"use strict";
	owid.namespace("App.Views.Chart.ChartTab");

	App.Views.Chart.ChartTab = Backbone.View.extend( {

		cachedColors: [],
		el: "#chart-view",
		events: {
			"change [name=available_entities]": "onAvailableCountries"
		},

		initialize: function( options ) {
			this.dispatcher = options.dispatcher;
			this.parentView = options.parentView;
			this.$tab = this.$el.find("#chart-chart-tab");
			this.$svg = this.$el.find("svg");
		},

		onChartModelChange: function() {
			var chartType = App.ChartModel.get("chart-type");
			var needFullRender = (chartType != this.chartType);

			App.DataModel.ready(function() {
				if (needFullRender) {
					this.deactivate();
					this.activate();
				} else {
					this.render(this.onResize.bind(this));					
				}
			}.bind(this));
		},

		activate: function(callback) {
			App.ChartModel.on("change", this.onChartModelChange, this);

			this.chartType = App.ChartModel.get("chart-type");

			this.$svg = $("svg");
			this.$svg.attr("class", "nvd3-svg");
			this.$entitiesSelect = this.$el.find( "[name=available_entities]" );
			this.$xAxisScaleSelector = this.$el.find( ".x-axis-scale-selector" );
			this.$xAxisScale = this.$el.find( "[name=x_axis_scale]" );
			this.$yAxisScaleSelector = this.$el.find( ".y-axis-scale-selector" );
			this.$yAxisScale = this.$el.find( "[name=y_axis_scale]" );
			this.$reloadBtn = this.$el.find( ".reload-btn" );
			var chartTime = App.ChartModel.get("chart-time");

			//show/hide scale selectors
			var showXScaleSelectors = App.ChartModel.get( "x-axis-scale-selector" );
			if( showXScaleSelectors ) {
				this.$xAxisScaleSelector.show();
			} else {
				this.$xAxisScaleSelector.hide();
			}
			var showYScaleSelectors = App.ChartModel.get( "y-axis-scale-selector" );
			if( showYScaleSelectors ) {
				this.$yAxisScaleSelector.show();
			} else {
				this.$yAxisScaleSelector.hide();
			}

			//refresh btn
			this.$reloadBtn.on("click", function(evt) {
				evt.preventDefault();
				window.location.reload();
			});

			var dimensionsString = App.ChartModel.get( "chart-dimensions" ),
				validDimensions = false;

			//check we have all dimensions necessary 
			if( !$.isEmptyObject( dimensionsString ) ) {
				var dimension = $.parseJSON( dimensionsString );
				validDimensions = App.Utils.checkValidDimensions( dimension, App.ChartModel.get( "chart-type" ));
			}

			if( !validDimensions ) {
				return false;
			}

			this.render(callback);
		},

		deactivate: function() {
			App.ChartModel.off(null, null, this);
			d3.selectAll(".nvd3").remove();
			if (this.$yAxisScaleSelector)
				this.$yAxisScaleSelector.show();
		},

		updateAvailableCountries: function() {
			var availableEntities = App.DataModel.get("availableEntities"),
				selectedCountries = App.ChartModel.get("selected-countries"),
				selectedCountriesIds = _.map(selectedCountries, function(v) { return (v)? +v.id: ""; });

			// Fill entity selector with all entities not currently selected
			this.$entitiesSelect.empty();
			this.$entitiesSelect.append("<option disabled selected>Select country</option>");
			_.each(availableEntities, function(entity) {
				if (!_.contains(selectedCountriesIds, +entity.id)) {
					this.$entitiesSelect.append("<option value='" + entity.id + "'>" + entity.name + "</option>");
				}
			}.bind(this));

			this.$entitiesSelect.trigger("chosen:updated");
		},

		render: function(callback) {
			var localData = App.DataModel.transformData();
			var timeType = "Year";

			if (!localData) {
				return;
			}

			this.updateAvailableCountries();

			var that = this;

			var chartType = App.ChartModel.get( "chart-type" );

			//filter data for selected countries
			var selectedCountries = App.ChartModel.get("selected-countries");

			var selectedCountriesById = [],
				selectedCountriesIds = _.map( selectedCountries, function(v) {
					//store
					selectedCountriesById[ v.id ] = v;
					return +v.id;
				} );

			if( selectedCountries && selectedCountriesIds.length && !App.ChartModel.get( "group-by-variables" ) ) {
				//set local copy of countries color, to be able to create brighter
				var countriesColors = [];
				_.each( localData, function( value, key, list ) {
					//set color while in the loop
					var id = value.id.toString();
					//need to check for special case, when we have more variables for the same countries (the ids will be then 21-1, 22-1, etc.)
					if( id.indexOf( "-" ) > 0 ) {
						id = parseInt( id.split( "-" )[ 0 ], 10 );
					} else {
						id = parseInt( id, 10 );
					}

					var country = selectedCountriesById[ id ];
					if( country && country.color ) {
						if( !countriesColors[ id ] ) {
							countriesColors[ id ] = country.color;
						} else {
							//there is already color for country (multivariant dataset) - create brighter color
							countriesColors[ id ] = d3.rgb( countriesColors[ id ] ).brighter( 1 ).toString();
						}
						value.color = countriesColors[ id ];

					} else {
						value = that.assignColorFromCache( value );
					}
				} );
			} else {
				//TODO - nonsense? convert associative array to array, assign colors from cache
				localData = _.map( localData, function( value ) {
					value = that.assignColorFromCache( value );
					return value;
				} );
			}

			var discreteData;
			if( chartType == App.ChartType.DiscreteBar ) {
				var flattenValues = _.map( localData, function( v ) {
					if( v && v.color ) {
						v.values[ 0 ].color = v.color;
					}
					return v.values[0];
				} );
				discreteData = [{ key: "variable", values: flattenValues }];
				localData = discreteData;
			}

			//filter by chart time
			var chartTime = App.ChartModel.get( "chart-time" );
			if( chartTime && chartTime.length == 2 ) {
				
				var timeFrom = chartTime[ 0 ],
					timeTo = chartTime[ 1 ];
				
				_.each( localData, function( singleData, key, list ) {
					var values = _.clone( singleData.values );
					values = _.filter( values, function( value ) {
						if (_.isObject(value.time)) {
							return _.every(value.time, function(val, key) {
								return ( val >= timeFrom && val <= timeTo );
							});							
						} else {
							return ( value.x >= timeFrom && value.x <= timeTo );
						}
					} );
					singleData.values = values;
				} );

			}

			// For stacked area chart, the order of the series matters. For other chart
			// types we sort them alphabetically.
			if (chartType == App.ChartType.StackedArea) {
			} else {
				localData = _.sortBy(localData, function(obj) { return obj.key; });
			}

			//get axis configs
			var xAxis = App.ChartModel.get( "x-axis" ),
				yAxis = App.ChartModel.get( "y-axis" ),
				xAxisPrefix = ( xAxis[ "axis-prefix" ] || "" ),
				xAxisSuffix = ( xAxis[ "axis-suffix" ] || "" ),
				yAxisPrefix = ( yAxis[ "axis-prefix" ] || "" ),
				yAxisSuffix = ( yAxis[ "axis-suffix" ] || "" ),
				xAxisLabelDistance = ( +xAxis[ "axis-label-distance" ] || 0 ),
				yAxisLabelDistance = ( +yAxis[ "axis-label-distance" ] || 0 ),
				xAxisMin = ( xAxis[ "axis-min" ] || null ),
				xAxisMax = ( xAxis[ "axis-max" ] || null ),
				yAxisMin = ( yAxis[ "axis-min" ] || 0 ),
				yAxisMax = ( yAxis[ "axis-max" ] || null ),
				xAxisScale = ( xAxis[ "axis-scale" ] || "linear" ),
				yAxisScale = ( yAxis[ "axis-scale" ] || "linear" ),
				xAxisFormat = ( xAxis[ "axis-format" ] || 0 ),
				yAxisFormat = ( yAxis[ "axis-format" ] || 0 );

			//setting up nvd3 chart
			nv.addGraph(function() {
				var chartOptions = {
					margin: { top:0, left:50, right:30, bottom:0 },// App.ChartModel.get( "margins" ),
					showLegend: false
				};

				//line type
				var lineType = App.ChartModel.get( "line-type" );
				if( lineType == App.LineType.UnjoinedIfMissing ) {
					//chartOptions.defined = function( d ) { return d.y == 0; };
				}
				if( lineType == App.LineType.WithDots || lineType == App.LineType.DashedIfMissing ) {
					that.$el.addClass( "line-dots" );
				} else {
					that.$el.removeClass( "line-dots" );
				}

				//depending on chart type create chart
				if( chartType == App.ChartType.LineChart ) {
					that.chart = nv.models.lineChart().options( chartOptions );

				} else if( chartType == App.ChartType.ScatterPlot ) {
					var points = that.scatterBubbleSize();
					that.chart = nv.models.scatterChart().options( chartOptions ).pointRange( points ).showDistX( true ).showDistY( true );

				} else if( chartType == App.ChartType.StackedArea ) {
					//stacked area chart
					//we need to make sure we have as much data as necessary
					if( localData.length ) {
						var baseSeries = localData[0];
						_.each( localData, function( serie, i ) {
							if( i > 0 ) {
								//make sure we have values for given series
								if( serie.values && !serie.values.length ) {
									//clone base series
									var copyValues = [];
									$.extend(true, copyValues, baseSeries.values);
									//nullify values
									_.each( copyValues, function( v, i) {
										v.y = 0;
										v.fake = "true";
									});
									serie.values = copyValues;
								}
							}
						} );
					}

					chartOptions.showTotalInTooltip = true;

					that.chart = nv.models.stackedAreaChart()
						.options(chartOptions)
						.controlOptions(["Stacked", "Expanded"])
						.controlLabels({
							"stacked": "Absolute",
							"expanded": "Relative"
						})
						.useInteractiveGuideline(true)
						.x(function(d) { return d.x; })
						.y(function(d) { return d.y; });

					if (App.ChartModel.get("currentStackMode") == "relative")
						that.chart.style("expand");			

				} else if( chartType == App.ChartType.MultiBar || chartType == App.ChartType.HorizontalMultiBar ) {

					//multibar chart
					//we need to make sure we have as much data as necessary
					var allTimes = [],
						//store values by [entity][time]
						valuesCheck = [];

					//extract all times
					_.each( localData, function( v, i ) {
						var entityData = [],
							times = v.values.map( function( v2, i ) {
								entityData[ v2.x ] = true;
								return v2.x;
							} );
						valuesCheck[ v.id ] = entityData;
						allTimes = allTimes.concat( times );
					} );

					allTimes = _.uniq( allTimes );
					allTimes = _.sortBy( allTimes );
					
					if( localData.length ) {
						_.each( localData, function( serie, serieIndex ) {
							
							//make sure we have values for given series
							_.each( allTimes, function( time, timeIndex ) {
								if( valuesCheck[ serie.id ] && !valuesCheck[ serie.id ][ time ] ) {
									//time doesn't existig for given entity, insert zero value
									var zeroObj = {
										"key": serie.key,
										"serie": serieIndex,
										"time": time,
										"x": time,
										"y": 0,
										"fake": true
									};
									serie.values.splice( timeIndex, 0, zeroObj );
								}
							} );
							
						} );
					}

					if (chartType == App.ChartType.MultiBar) {
						that.chart = nv.models.multiBarChart().options(chartOptions);					
					} else if( App.ChartType.HorizontalMultiBar ) {
						that.chart = nv.models.multiBarHorizontalChart().options(chartOptions);					
					}

				} else if( chartType == App.ChartType.DiscreteBar ) {

					chartOptions.showValues = true;

					that.chart = nv.models.discreteBarChart()
						.x( function( d ) { return d.x; } )
						.y( function( d ) { return d.y; } )
						.options( chartOptions );

				}

				that.chart.dispatch.on("renderEnd", function(state) {
					$(window).trigger('chart-loaded');

					/* HACK (Mispy): Hijack nvd3 mode switch for stacked area charts. */
					if (chartType == App.ChartType.StackedArea) {
						d3.selectAll(".nv-controlsWrap .nv-series").on("click", function(opt) {
							if (opt.key == "Relative") {
								App.ChartModel.set("currentStackMode", "relative");
							} else {
								App.ChartModel.set("currentStackMode", "absolute");
							}
						});
	
						// Stop the tooltip from overlapping the chart controls
						d3.selectAll("svg").on("mousemove.stackedarea", function() {
							var $target = $(d3.event.target);
							if (!$target.is("rect, path") || $target.closest(".nv-custom-legend").length)
								that.chart.interactiveLayer.tooltip.hidden(true);							
						});
					}
				});				
	
				that.chart.dispatch.on("stateChange", function() {
					/* HACK (Mispy): Ensure stacked area charts maintain the correct dimensions on 
					 * transition between stacked and expanded modes. It cannot be done on renderEnd
					 * or stateChange because the delay causes the chart to jump; overriding update
					 * seems to be the only way to get it to synchronously flow into resizing. It must
					 * be re-overridden in renderEnd because the nvd3 chart render function resets it. Note
					 * that stacked area charts also pay no attention to the margin setting. */
					var origUpdate = that.chart.update;
					that.chart.update = function() {
						origUpdate.call(that.chart);
						that.onResize();
					};														
				});
	
				//fixed probably a bug in nvd3 with previous tooltip not being removed
				d3.select( ".xy-tooltip" ).remove();

				that.chart.xAxis
					.axisLabel( xAxis[ "axis-label" ] )
					//.staggerLabels( true )
					.axisLabelDistance( xAxisLabelDistance )
					.tickFormat( function(d) {
						if (chartType != App.ChartType.ScatterPlot) {
							//x axis has time information
							return App.Utils.formatTimeLabel( timeType, d, xAxisPrefix, xAxisSuffix, xAxisFormat );
						} else {
							//is scatter plot, x-axis has some other information
							return xAxisPrefix + d3.format( "," )( App.Utils.formatValue( d, xAxisFormat ) ) + xAxisSuffix;
						}
					} );

				//get extend
				var allValues = [];
				_.each( localData, function( v, i ) {
					if( v.values ) {
						allValues = allValues.concat( v.values );
					} else if( $.isArray( v ) ){
						//special case for discrete bar chart
						allValues = v;
					}
				} );

				//domain setup
				var xDomain = d3.extent( allValues.map( function( d ) { return d.x; } ) ),
					yDomain = d3.extent( allValues.map( function( d ) { return d.y; } ) ),
					isClamped = false;
				//console.log( "chart.stacked.style()", that.chart.stacked.style() );

				if( xAxisMin && !isNaN( xAxisMin ) ) {
					xDomain[ 0 ] = xAxisMin;
					isClamped = true;
				}
				if( xAxisMax && !isNaN( xAxisMax ) ) {
					xDomain[ 1 ] = xAxisMax;
					isClamped = true;
				}
				if( yAxisMin && !isNaN( yAxisMin ) && (yAxisMin > 0 || yAxisScale != "log")) {
					yDomain[ 0 ] = yAxisMin;
					isClamped = true;
				} else {
					//default is zero (don't do it for stack bar chart or log scale, messes up things)
					if( chartType != App.ChartType.StackedArea && yAxisScale != "log" ) {
						yDomain[ 0 ] = 0;
						isClamped = true;
					}
				}
				if( yAxisMax && !isNaN( yAxisMax ) ) {
					yDomain[ 1 ] = yAxisMax;
					isClamped = true;
				}

				//manually clamp values
				if( isClamped ) {
					if( chartType !== "4" && chartType !== "5" && chartType !== "6" ) {
						//version which makes sure min/max values are present, but will display values outside of the range
						that.chart.forceX( xDomain );
						that.chart.forceY( yDomain );
					}
				}

				//set scales, multibar chart
				if( yAxisScale === "linear" ) {
					that.chart.yScale( d3.scale.linear() );
				} else if( yAxisScale === "log" ) {
					that.chart.yScale( d3.scale.log() );
				}

				if( chartType === "4" || chartType === "5" ) {
					//for multibar chart, x axis has ordinal scale, so need to setup domain properly
					//that.chart.xDomain( d3.range(xDomain[0], xDomain[1] + 1) );
					that.chart.xDomain( allTimes );
				}

				that.chart.yAxis
					.axisLabel( yAxis[ "axis-label" ] )
					.axisLabelDistance( yAxisLabelDistance )
					.tickFormat( function(d) { return yAxisPrefix + d3.format( "," )( App.Utils.formatValue( d, yAxisFormat ) ) + yAxisSuffix; })
					.showMaxMin(false);

				//scatter plots need more ticks
				if( chartType === App.ChartType.ScatterPlot ) {
					//hardcode
					that.chart.xAxis.ticks( 7 );
					that.chart.yAxis.ticks( 7 );
				}

				window.localData = localData;

				var displayData = localData;
				if (chartType == App.ChartType.LineChart && (lineType == App.LineType.DashedIfMissing))// || lineType == App.LineType.UnjoinedIfMissing))
					displayData = that.splitSeriesByMissing(localData);
				window.displayData = displayData;
				that.svgSelection = d3.select( that.$svg.selector )
					.datum(displayData)
					.call( that.chart );

				if (chartType == App.ChartType.StackedArea)
					that.chart.interactiveLayer.tooltip.contentGenerator(owid.contentGenerator);
				else
					that.chart.tooltip.contentGenerator(owid.contentGenerator);
				
				//set legend
				if (!App.ChartModel.get("hide-legend")) {
					//make sure wrapper is visible
					that.$svg.find( "> .nvd3.nv-custom-legend" ).show();
					that.legend = new App.Views.Chart.Legend( that.chart.legend ).vers( "owd" );
					that.legend.dispatch.on("addEntity", function() {
						if (that.$entitiesSelect.data("chosen")) {
							that.$entitiesSelect.data("chosen").active_field = false;
						}
						//trigger open the chosen drop down
						that.$entitiesSelect.trigger("chosen:open");
					} );
					that.svgSelection.call( that.legend );
					//put legend above chart

					//if stacked area chart
					if (chartType == App.ChartType.StackedArea) {
						that.chart.stacked.dispatch.on("areaMouseover", function(evt) {
							that.legend.highlightPoint(evt);
						});
						that.chart.stacked.dispatch.on("areaMouseout", function(evt) {
							that.legend.clearHighlight();
						});
					}
				} else {
					//no legend, remove what might have previously been there
					that.$svg.find( "> .nvd3.nv-custom-legend" ).hide();
				}
				
				var dimensions = JSON.parse(App.ChartModel.get("chart-dimensions"));

				if (chartType == App.ChartType.ScatterPlot) {
					//need to have own showDist implementation, cause there's a bug in nvd3
					that.scatterDist();
				}

				//if y axis has zero, display solid line
				var $pathDomain = $( ".nvd3 .nv-axis.nv-x path.domain" );
				if( yDomain[ 0 ] === 0 ) {
					$pathDomain.css( "stroke-opacity", "1" );
				} else {
					$pathDomain.css( "stroke-opacity", "0" );
				}
				
				var chartDimensionsString = App.ChartModel.get( "chart-dimensions" );
				if( chartDimensionsString.indexOf( '"property":"color"' ) === -1 ) {
					//check if string does not contain "property":"color"
					that.cacheColors( localData );
				}

				window.chart = that.chart;
				that.onResize();
				if (callback) callback();
			});

			this.localData = localData;
		},

		show: function() {
			this.$el.show();
		},

		hide: function() {
			this.$el.hide();
		},

		scatterDist: function() {
			var that = this,
				margins = App.ChartModel.get( "margins" ),
				nvDistrX = $( ".nv-distributionX" ).offset().top,
				svgSelection = d3.select( "svg" );

			that.chart.scatter.dispatch.on('elementMouseover.tooltip', function(evt) {
				var svgOffset = that.$svg.offset(),
					svgHeight = that.$svg.height();
				svgSelection.select('.nv-series-' + evt.seriesIndex + ' .nv-distx-' + evt.pointIndex)
					.attr('y1', evt.pos.top - nvDistrX );
				svgSelection.select('.nv-series-' + evt.seriesIndex + ' .nv-disty-' + evt.pointIndex)
					.attr('x2', evt.pos.left - svgOffset.left - margins.left );
				var position = {left: d3.event.clientX, top: d3.event.clientY };
				that.chart.tooltip.position(position).data(evt).hidden(false);
			});
		},

		splitSeriesByMissing: function(localData) {
			var lineType = App.ChartModel.get("line-type"),
				lineTolerance = parseInt(App.ChartModel.get("line-tolerance")) || 1,
				newData = [];

			_.each(localData, function(series) {
				var currentSeries = null;
				var currentMissing = null;

				_.each(series.values, function(d) {
					var isMissing = (d.gapYearsToNext && d.gapYearsToNext > lineTolerance);
					if (isMissing !== currentMissing) {
						if (currentSeries !== null) {
							// There's a single overlapping value to keep the lines joined
							currentSeries.values.push(d);
							newData.push(currentSeries);
						}
						currentSeries = _.extend({}, series, { values: [] });
						if (isMissing && lineType == App.LineType.DashedIfMissing)
							currentSeries.classed = 'dashed';
						else if (isMissing)
							currentSeries.classed = 'unstroked';
						currentMissing = isMissing;
					}

					currentSeries.values.push(d);
				});
			});

			// HACK (Mispy): Mutate the keys so nvd3 actually draws the new series.
			// Kludgy but necessary for now.
			var keys = {};
			_.each(newData, function(series, i) {
				series.origKey = series.key;
				if (keys[series.key]) {
					series.key = series.key + i;
					series.id = "copy-"+series.id;
					series.isCopy = true;
				} else
					keys[series.key] = true;
			});

			return newData;
		},

		scatterBubbleSize: function() {
			//set size of the bubbles depending on browser width
			var browserWidth = $( window ).width(),
				browserCoef = Math.max( 1, browserWidth / 1100 ),
				pointMin = 100 * Math.pow( browserCoef, 2 ),
				pointMax = 1000 * Math.pow( browserCoef, 2 );
			return [ pointMin, pointMax ];
		},

		checkStackedAxis: function() {

			//setting yAxisMax breaks expanded stacked chart, need to check manually
			var stackedStyle = this.chart.stacked.style(),
				yAxis = App.ChartModel.get( "y-axis" ),
				yAxisMin = ( yAxis[ "axis-min" ] || 0 ),
				yAxisMax = ( yAxis[ "axis-max" ] || null ),
				yDomain = [ yAxisMin, yAxisMax ];
			if( yAxisMax ) {
				//chart has set yAxis to max, depending on stacked style set max
				if( stackedStyle === "expand" ) {
					yDomain = [ 0, 1 ];
				}
				this.chart.yDomain( yDomain );
			}
		},


		onAvailableCountries: function(evt) {
			var $select = $( evt.currentTarget ),
				val = $select.val(),
				$option = $select.find( "[value=" + val + "]" ),
				text = $option.text();

			if( !App.ChartModel.get( "group-by-variables" ) && App.ChartModel.get( "add-country-mode" ) === "add-country" ) {
				App.ChartModel.addSelectedCountry( { id: $select.val(), name: text } );
			} else {
				App.ChartModel.replaceSelectedCountry( { id: $select.val(), name: text } );
			}

			//double check if we don't have full selection of countries
			var entitiesCollection = {},
				formConfig = App.ChartModel.get( "form-config" );
			if( formConfig && formConfig[ "entities-collection" ] ) {
				var selectedCountriesIds = _.keys( App.ChartModel.get( "selected-countries" ) );
				if( selectedCountriesIds.length == formConfig[ "entities-collection" ].length ) {
					App.ChartModel.set( "selected-countries", [], {silent:true} );
				}
			}
		},

		cacheColors: function(data) {
			if( !this.cachedColors.length ) {
				var that = this;
				_.each( data, function( v, i ) {
					that.cachedColors[ v.id ] = v.color;
				} );
			}
		},

		assignColorFromCache: function( value ) {
			this.cachedColors = this.cachedColors || {};
			if( this.cachedColors.length ) {
				//assing color frome cache
				if( this.cachedColors[ value.id ] ) {
					value.color = this.cachedColors[ value.id ];
				} else {
					var randomColor = App.Utils.getRandomColor();
					value.color = randomColor;
					this.cachedColors[ value.id ] = randomColor;
				}
			} else if (!value.color && App.ChartModel.get("chart-type") == App.ChartType.LineChart) {
				this.colorScale = this.colorScale || nv.utils.getColor(d3.scale.category20().range());
				this.colorIndex = this.colorIndex || 0;
				value.color = this.colorScale(this.colorIndex += 1);	
			}
			return value;
		},

		onResize: function(callback) {
			if (_.isEmpty(this.localData)) {
				if (callback) callback();
				return;
			}
			
			if (this.legend) {
				this.svgSelection.call(this.legend);
			}

			//compute how much space for chart
			var margins = App.ChartModel.get("margins"),
				svg = d3.select(this.$svg[0]),
				svgBounds = svg.node().getBoundingClientRect(),
				tabBounds = $(".tab-pane.active").get(0).getBoundingClientRect(),
				chartOffsetY = tabBounds.top - svgBounds.top + parseFloat(margins.top) + 10,
				chartOffsetX = parseFloat(margins.left),
				// MISPY: The constant modifiers here are to account for nvd3 not entirely matching our specified dimensions
				chartHeight = tabBounds.height - parseFloat(margins.bottom) - parseFloat(margins.top) - 20 - 10,
				chartWidth = tabBounds.width - parseFloat(margins.left) - parseFloat(margins.right) + 60,
				chartType = App.ChartModel.get("chart-type");

			// Account for and position legend
			if (this.legend) {
				var legendMargins = this.legend.margin();
				this.translateString = "translate(" + legendMargins.left + " ," + chartOffsetY + ")";
				svg.select(".nvd3.nv-custom-legend").attr("transform", this.translateString);

				chartOffsetY += this.legend.height();
				chartHeight -= this.legend.height();
			}

			if (App.ChartModel.get("x-axis")["axis-label"]) {
				chartHeight -= 30;
			}

			// MISPY: These charts need a special offset because nvd3 doesn't seem
			// to count the controls as part of the width and height.
			if (chartType == App.ChartType.StackedArea || chartType == App.ChartType.MultiBar || chartType == App.ChartType.HorizontalMultiBar) {
				chartOffsetY += 20;
				if (chartType != App.ChartType.StackedArea)
					chartHeight -= 20;
			}

			// Make sure we actually have enough room for the chart to be visible!
			var minHeight = 150;
			if (chartHeight < minHeight) {
				var $wrapper = App.ChartView.$(".chart-wrapper-inner");
				$wrapper.css("height", $wrapper.height() + (minHeight-chartHeight) + 10 + "px");
				App.ChartView.onResize(callback, true);
				return;
			}

			// Inform nvd3 of the situation
			this.chart.width(chartWidth);
			this.chart.height(chartHeight);
			this.chart.update();

			var wrap = svg.select(".nvd3.nv-wrap");
			this.translateString = "translate(" + chartOffsetX + "," + chartOffsetY + ")";
			wrap.attr("transform", this.translateString);

			// Move controls up for multibar chart
			if (chartType == App.ChartType.MultiBar || chartType == App.ChartType.HorizontalMultiBar) {
				d3.select( ".nv-controlsWrap" ).attr( "transform", "translate(0,-30)" );
			}

			//position scale dropdowns - TODO - isn't there a better way then with timeout?
			setTimeout(function() {
				var chartRect = svg.select(".nvd3 g > rect"),
					chartBounds = chartRect.node().getBoundingClientRect(),
					offsetX = chartBounds.left - svgBounds.left,
					offsetY = 0;

				this.$xAxisScaleSelector.css({ left: offsetX + chartBounds.width, top: offsetY + chartBounds.height });
				this.$yAxisScaleSelector.css({ left: offsetX, top: offsetY });
			}.bind(this), 250);

			if (_.isFunction(callback)) callback();
		}					
	} );

})();
;(function() {	
	"use strict";
	owid.namespace("App.Views.Chart.DataTab");

	App.Views.Chart.DataTab = Backbone.View.extend({
		el: "#chart-view #data-chart-tab",
		events: {},

		initialize: function( options ) {
			this.parentView = options.parentView;
			this.dispatcher = options.dispatcher;

			this.$tab = this.$el;
			this.$downloadBtn = this.$el.find(".download-data-btn");
			this.$downloadFullBtn = this.$el.find(".download-full-btn");
			this.$dataTable = this.$el.find(".data-table");
		},

		activate: function(callback) {
			this.render(callback);
			App.ChartModel.on("change", this.render.bind(this), this);
		},

		deactivate: function() {
			App.ChartModel.off(null, null, this);
			this.$dataTable.empty();
		},

		render: function(callback) {
			var params = owid.getQueryParams();
			delete(params.tab);
			var queryStr = owid.queryParamsToStr(params),
				baseUrl = Global.rootUrl + "/" + App.ChartModel.get("chart-slug"),
				csvUrl = baseUrl + ".csv" + queryStr;

			this.$downloadBtn.attr("href", csvUrl);
			this.$downloadFullBtn.attr("href", baseUrl + ".csv" + "?country=ALL");

			$.get(csvUrl)
				.done(function(csv) {
					Papa.parse(csv, {
						complete: function(results) {
							var rowHtml = "";
							_.each(results.data, function(row) {
								rowHtml += "<tr>";
								_.each(row, function(value) {
									rowHtml += "<td>" + value + "</td>";
								});
								rowHtml += "</tr>";
							});

							this.$dataTable.html(rowHtml);
							if (_.isFunction(callback)) callback();
						}.bind(this)
					});
				}.bind(this))
				.fail(function(err) {
					App.ChartView.handleError(err);
				});
		},
	});
})();
;(function() {	
	"use strict";
	owid.namespace("App.Views.Chart.SourcesTab");

	App.Views.Chart.SourcesTab = Backbone.View.extend( {
		el: "#chart-view",
		events: {},

		initialize: function(options) {
			this.parentView = options.parentView;
			this.dispatcher = options.dispatcher;
			this.$tab = this.$el.find("#sources-chart-tab");
		},

		activate: function(callback) {
			this.render();

			App.ChartModel.on("change", function() {
				App.DataModel.ready(this.render.bind(this));								
			}.bind(this), this);

			if (callback) callback();
		},

		deactivate: function() {
			App.ChartModel.off(null, null, this);
			this.$tab.empty();
		},

		render: function() {
			var sources = App.DataModel.transformDataForSources(),
				tabHtml = "";

			_.each(sources, function(source) {
				tabHtml += source.description;
			});

			this.$tab.html(tabHtml);
		},
	});
})();
;(function() {	
	"use strict";

	owid.namespace("App.Views.Chart.Map.MapControls");

	App.Views.Chart.Map.MapControls = Backbone.View.extend({
		el: "#map-chart-tab .map-controls-header",
		events: {
			"input .target-year-control input": "onTargetYearInput",
			"change .target-year-control input": "onTargetYearChange",
			"click .region-control li": "onRegionClick",
			"click .settings-control input": "onSettingsInput",
			"click .color-blind-control": "onColorBlindClick",
		},

		initialize: function( options ) {
			this.dispatcher = options.dispatcher;

			var mapConfig = App.ChartModel.get( "map-config" );
			
			//year slider
			this.$targetYearControl = this.$el.find( ".target-year-control" );
			this.$targetYearLabel = this.$targetYearControl.find( ".target-year-label" );
			this.$targetYearInput = this.$targetYearControl.find( "input" );
			
			//region selector
			this.$regionControl = this.$el.find( ".region-control" );
			this.$regionControlLabel = this.$regionControl.find( ".region-label" );
			this.$regionControlLis = this.$regionControl.find( "li" );

			//settings-control selector
			this.$settingsControl = this.$el.find( ".settings-control" );

			//color blind control selector
			this.$colorBlindControl = this.$el.find( ".color-blind-control" );
			//cache original
			this.originalColorSchemeName = mapConfig.colorSchemeName;

			App.ChartModel.on( "change", this.onChartModelChange, this );
			App.ChartModel.on( "change-map", this.onChartModelChange, this );

			return this.render();
		},

		render: function() {
			var mapConfig = App.ChartModel.get( "map-config" ),
				minYear = App.DataModel.get("minYear"),
				maxYear = App.DataModel.get("maxYear");
			
			this.$targetYearLabel.text( mapConfig.targetYear );
			this.$regionControlLabel.text( mapConfig.projection );

			this.$targetYearInput.attr( "min", minYear );
			this.$targetYearInput.attr( "max", maxYear );
			this.$targetYearInput.attr( "step", mapConfig.timeInterval );
			this.$targetYearInput.val( parseInt( mapConfig.targetYear, 10 ) );

			this.$regionControlLis.removeClass( "highlight" );
			this.$regionControlLis.filter( "." + mapConfig.projection + "-projection" ).addClass( "highlight" );

			this.$settingsControl.find("input").prop("checked", mapConfig.mode !== "no-interpolation");
			this.$colorBlindControl.toggleClass("active", !!mapConfig.isColorblind);

			//is interval mode display
			if( isNaN( minYear ) || isNaN( maxYear ) ) {
				this.$targetYearInput.attr( "disabled", true );
			}
		},

		onChartModelChange: function( evt ) {
			this.render();
		},
		
		onTargetYearInput: function( evt ) {
			var $this = $( evt.target ),
				targetYear = parseInt( $this.val(), 10 );
			this.$targetYearLabel.text( targetYear, false, "change-map" );
		},

		onTargetYearChange: function( evt ) {
			var $this = $( evt.target ),
				targetYear = parseInt( $this.val(), 10 );
			App.ChartModel.updateMapConfig( "targetYear", targetYear, false, "change-map" );
			this.render();
		},

		onRegionClick: function( evt ) {
			var $this = $( evt.target );
			App.ChartModel.updateMapConfig( "projection", $this.text(), false, "change-map" );
			this.render();
		},

		onSettingsInput: function(evt) {
			var $this = $(evt.target),
				currentMode = App.ChartModel.get("map-config").mode,
				mode = currentMode === "no-interpolation" ? "specific" : "no-interpolation";
			App.ChartModel.updateMapConfig("mode", mode, false, "change-map");
			this.render();
		},

		onColorBlindClick: function(evt) {
			var $this = $(evt.currentTarget);
			if (!$this.hasClass("active")) {
				App.ChartModel.updateMapConfig("isColorblind", true, false, "change-map");
			} else {
				App.ChartModel.updateMapConfig("isColorblind", false, false, "change-map");
			}
		},

	});
})();
;(function() {	
	"use strict";
	owid.namespace("App.Views.Chart.Map.PlayPauseControl");

	App.Views.Chart.Map.PlayPauseControl = Backbone.View.extend({
		PLAY_INTERVAL: 500,

		el: "#map-chart-tab .map-timeline-controls .play-pause-control",
		events: {
			"click .play-btn": "onPlayClick",
			"click .pause-btn": "onPauseClick",
		},

		initialize: function( options ) {
			this.dispatcher = options.dispatcher;

			this.interval = null;
			this.$playBtn = this.$el.find( ".play-btn" );
			this.$pauseBtn = this.$el.find( ".pause-btn" );
			
			this.dispatcher.on( "max-increment-time", this.onMaxIncrement, this );
		},

		render: function() {
			
		},

		onPlayClick: function(evt) {
			if (evt)
				evt.preventDefault();

			var mapConfig = App.ChartModel.get("map-config"),
				targetYear = mapConfig.targetYear,
				minYear = mapConfig.minYear,
				maxYear = mapConfig.maxYear;

			if (targetYear == maxYear)
				App.ChartModel.updateMapConfig("targetYear", minYear, false, "change-map-year");
			
			this.startTimer();
			this.$pauseBtn.show();
			this.$playBtn.hide();
		},

		onPauseClick: function( evt ) {
			if( evt ) {
				evt.preventDefault();
			}
			this.clearTimer();

			this.$pauseBtn.hide();
			this.$playBtn.show();
		},

		startTimer: function() {
			this.clearTimer();
			var that = this;
			this.interval = setInterval( function() {
				that.incrementTime();
				}, this.PLAY_INTERVAL
			);
			that.incrementTime();
		},

		onMaxIncrement: function() {
			this.onPauseClick();
		},

		incrementTime: function() {
			this.dispatcher.trigger( "increment-time" );
		},

		clearTimer: function() {
			if( this.interval ) {
				clearInterval( this.interval );
			}
		},

		show: function() {
			this.$el.css( "display", "block" );
		},

		hide: function() {
			this.$el.css( "display", "none" );
		}

	});
})();
;(function() {
	"use strict";
	owid.namespace("App.Views.Chart.Map.TimelineControl");
	
	App.Views.Chart.Map.TimelineControl = Backbone.View.extend({
		el: "#map-chart-tab .map-timeline-controls .timeline-control",
		events: {
			"mousedown": "onMousedown",
			"touchstart": "onTouchstart"
		},

		initialize: function( options ) {
			this.dispatcher = options.dispatcher;
			
			var mapConfig = App.ChartModel.get( "map-config" );
			
			this.$sliderWrapper = this.$el.find( ".timeline-wrapper" );
			this.$slider = this.$el.find( ".timeline-slider" );
			this.$sliderLabel = this.$slider.find( ".timeline-slider-label" );
			this.$sliderInput = this.$sliderWrapper.find( "[type='range']" );

			this.$startYear = this.$el.find( ".timeline-start-year" );
			this.$endYear = this.$el.find( ".timeline-end-year" );

			this.dispatcher.on("increment-time", this.onIncrementTime, this);
			App.ChartModel.on("change-map", this.onChangeYear, this);
			App.ChartModel.on("change-map-year", this.onChangeYear, this);			
		},

		onMousedown: function(evt) {
			this.isDragging = true;
			$(window).one("mouseup", this.onMouseup.bind(this));
			$(window).on("mousemove.timeline", this.onMousemove.bind(this));
			this.onMousemove(evt);
		},

		onTouchstart: function(evt) {
			this.isDragging = true;
			$(window).one("touchend", this.onMouseup.bind(this));
			$(window).on("touchmove.timeline", this.onMousemove.bind(this));
			this.onMousemove(evt);			
		},

		onMouseup: function() {
			this.isDragging = false;
			$(window).off("touchend.timeline");
			$(window).off("mousemove.timeline");
		},

		onMousemove: function(evt) {
			if (!this.isDragging) return;
			evt.preventDefault();

			var pageX = evt.pageX || evt.originalEvent.touches[0].pageX,
				xPos = pageX - this.$sliderInput.offset().left,
				fracWidth = xPos / this.$sliderInput.width(),
				targetYear = this.minYear + fracWidth*(this.maxYear-this.minYear);

			this.setTargetYear(targetYear);
		},

		setTargetYear: function(targetYear) {
			// Find the closest year that is a valid selection
			var closestYear = _.min(this.years, function(year) {
				return Math.abs(year-targetYear);
			});

			App.ChartModel.updateMapConfig("targetYear", closestYear, false, "change-map-year");			
		},

		render: function() {
			var mapConfig = App.ChartModel.get("map-config"),
				minYear = App.DataModel.get("minYear"),
				maxYear = App.DataModel.get("maxYear");
			
			this.years = owid.timeRangesToYears(mapConfig.timeRanges, minYear, maxYear);
			this.minYear = this.years[0];
			this.maxYear = this.years[this.years.length-1];
			this.targetYear = mapConfig.targetYear;

			this.$startYear.text(owid.displayYear(this.minYear));
			this.$endYear.text(owid.displayYear(this.maxYear));

			if (owid.displayYear(this.minYear).length > 4) 
				this.$startYear.css('font-size', '10px');
			else
				this.$startYear.css('font-size', "");

			if (owid.displayYear(this.maxYear).length > 4) 
				this.$endYear.css('font-size', '10px');
			else
				this.$endYear.css('font-size', "");
			
			this.$sliderInput.attr( "min", this.minYear );
			this.$sliderInput.attr( "max", this.maxYear );
			
			this.updateSliderInput( this.targetYear );
			
			if (this.minYear == this.maxYear) {
				this.$sliderInput.attr("disabled", true);
			} else {
				this.$sliderInput.attr("disabled", false);
			}

			this.createTicks(this.$sliderInput);
		},

		updateSliderInput: function(time) {
			var intTime = parseInt(time, 10),
				min = parseInt( this.$sliderInput.attr( "min" ), 10 ),
				max = parseInt( this.$sliderInput.attr( "max" ), 10 ),
				newPoint = ( intTime - min ) / ( max - min );
			
			this.$sliderLabel.text(owid.displayYear(time));
			this.$slider.css("left", this.$sliderWrapper.width()*newPoint);
			this.$sliderInput.val(intTime);
			if (intTime === min || intTime === max) {
				this.$sliderLabel.hide();
				this.$sliderInput.removeClass( "thumb-label" );
				if( intTime === min ) {
					this.$startYear.addClass( "highlight" );
					this.$endYear.removeClass( "highlight" );
				} else {
					this.$startYear.removeClass( "highlight" );
					this.$endYear.addClass( "highlight" );
				}
			} else {
				this.$sliderLabel.show();
				this.$sliderInput.addClass( "thumb-label" );
				this.$startYear.removeClass( "highlight" );
				this.$endYear.removeClass( "highlight" );
			}
		},

		onChangeYear: function() {
			var targetYear = App.ChartModel.get("map-config").targetYear;
			this.updateSliderInput(targetYear);

			if (targetYear != parseInt(this.$sliderInput.val()))
				this.$sliderInput.trigger("change");		
		},

		onIncrementTime: function( evt ) {
			var currentYear = parseInt(this.$sliderInput.val()),
				index = this.years.indexOf(currentYear);

			var nextIndex = index+1;
			if (nextIndex >= this.years.length) {
				this.dispatcher.trigger( "max-increment-time" );
				return;				
			}

			var nextYear = this.years[nextIndex];
			this.setTargetYear(nextYear);
		},

		createTicks: function( $input ) {
			if( this.$el.find( ".timeline-ticks" ).length ) {
				//this.$el.find(".timeline-ticks").remove();
				//already has ticks, bail
				return;
			}

			var min = this.minYear,
				max = this.maxYear,
				rangeSize = max-min,
				htmlString = "<ol class='timeline-ticks'>";	

			_.each(this.years, function(year, i) {
				var progress = (year-min) / rangeSize,
					percent = progress*100,
					translate = "translate(-" + percent + "%, 0)",
					tickString = "<li style='left:" + percent + "%;-webkit-transform:" + translate + ";-ms-transform:" + translate + ";transform:" + translate + "'>" + year + "</li>";
				htmlString += tickString;
			});

			htmlString += "</ol>";
			$input.after( $( htmlString ) );
		},

		show: function() {
			this.$el.css( "display", "block" );
		},

		hide: function() {
			this.$el.css( "display", "none" );
		}

	});
})();
;(function() {	
	"use strict";
	owid.namespace("App.Views.Chart.Map.ButtonsControl");
	
	App.Views.Chart.Map.ButtonsControl = Backbone.View.extend({

		el: "#map-chart-tab .map-timeline-controls .buttons-control",
		events: {},

		initialize: function( options ) {

			this.dispatcher = options.dispatcher;
			this.$buttonsWrapper = this.$el.find( ".buttons-wrapper" );

			App.ChartModel.on( "change", this.onChartModelChange, this );
			App.ChartModel.on( "change-map", this.onChartModelChange, this );
			App.ChartModel.on( "change-map-year", this.onChartModelChange, this );
		},

		render: function() {
			var mapConfig = App.ChartModel.get( "map-config" ),
				targetYear = mapConfig.targetYear,
				minYear = App.DataModel.get("minYear"),
				maxYear = App.DataModel.get("maxYear"),
				years = owid.timeRangesToYears(mapConfig.timeRanges, minYear, maxYear);

			//create all necessary buttons
			this.$buttonsWrapper.empty();

			var htmlString = "";
			_.each(years, function(year) {
				var selected = ( year == targetYear )? "selected": "";
				htmlString += "<li data-year='" + year + "' class='year-btn " + selected + "'><a href='#' class='btn'>" + owid.displayYear(year) + "</a></li>";
			});
			
			this.$buttonsWrapper.append( $( htmlString ) );
			
			this.$buttons = this.$buttonsWrapper.find( "li" );
			this.$buttons.on( "click", $.proxy( this.onButtonClick, this ) );

		},

		onButtonClick: function( evt ) {
			evt.preventDefault();
			var $btn = $( evt.currentTarget ),
				targetYear = parseInt( $btn.attr( "data-year" ), 10 );
			App.ChartModel.updateMapConfig("targetYear", targetYear, false, "change-map-year");
		
		},

		onChartModelChange: function() {
			this.render();
		},

		show: function() {
			this.$el.css( "display", "table" );
		},

		hide: function() {
			this.$el.css( "display", "none" );
		}

	});
})();
;(function() {	
	"use strict";
	owid.namespace("App.Views.Chart.Map.TimelineControls");
	var PlayPauseControl = App.Views.Chart.Map.PlayPauseControl,
		TimelineControl = App.Views.Chart.Map.TimelineControl,
		ButtonsControl = App.Views.Chart.Map.ButtonsControl;

	App.Views.Chart.Map.TimelineControls = Backbone.View.extend({
		el: "#map-chart-tab .map-timeline-controls",
		events: {},

		initialize: function( options ) {
			this.dispatcher = options.dispatcher;

			this.playPauseControl = new PlayPauseControl( options );
			this.timelineControl = new TimelineControl( options );
			this.buttonsControl = new ButtonsControl( options );

			App.ChartModel.on( "change-map", this.onChartModelChange, this );

			return this.render();
		},

		render: function() {
			var mapConfig = App.ChartModel.get("map-config");
			
			this.playPauseControl.render();
			this.timelineControl.render();
			this.buttonsControl.render();

			//depending on the mode used display timeline mode or buttons mode
			if (mapConfig.timelineMode === "buttons") {	
				this.playPauseControl.hide();
				this.timelineControl.hide();
				this.buttonsControl.show();
			} else {
				this.playPauseControl.show();
				this.timelineControl.show();
				this.buttonsControl.hide();
			}

			//should be timline disabled
			var isRange = ( isNaN( mapConfig.minYear ) || isNaN( mapConfig.maxYear ) )? true: false,
				isSingleYear = ( !isRange && ( mapConfig.minYear == mapConfig.maxYear ) )? true: false;

			if( isRange || isSingleYear ) {
				this.$el.addClass( "single-year" );
			} else {
				this.$el.removeClass( "single-year" );
			}
		},

		onChartModelChange: function() {
			this.render();
		}

	});
})();
;(function() {
	"use strict";
	owid.namespace("App.Views.Chart.Map.Projections");

	App.Views.Chart.Map.Projections = {
		"World": function(element) {
			//empiric
			var k = 7.5;
			var projection = d3.geo.eckert3()
				.precision(0.1);
			var path = d3.geo.path().projection(projection);
			return {path: path, projection: projection };
		},
		"Africa": function(element) {
			//empiric
			var k = 3.2;
			var projection = d3.geo.conicConformal()
				.rotate([-25, 0])
				.center([0, 0])
				.parallels([30, -20]);
			var path = d3.geo.path().projection(projection);
			return {path: path, projection: projection};
		},
		"N.America": function(element) {
			//empiric
			var k = 3.2;
			var projection = d3.geo.conicConformal()
				.rotate([98, 0])
				.center([0, 38])
				.parallels([29.5, 45.5]);
			var path = d3.geo.path().projection(projection);
			return {path: path, projection: projection};
		},
		"S.America": function(element) {
			//empiric
			var k = 3.6;
			var projection = d3.geo.conicConformal()
				.rotate([68, 0])
				.center([0, -14])
				.parallels([10, -30]);
			var path = d3.geo.path().projection(projection);
			return {path: path, projection: projection};
		},
		"Asia": function(element) {
			//empiric
			var k = 3.2;
			var projection = d3.geo.conicConformal()
				.rotate([-105, 0])
				.center([0, 37])
				.parallels([10, 60]);
			var path = d3.geo.path().projection(projection);
			return {path: path, projection: projection};
		},
		"Europe": function(element) {
			//empiric
			var k = 1.7;
			var projection = d3.geo.conicConformal()
				.rotate([-15, 0])
				.center([0, 55])
				.parallels([60, 40]);
			var path = d3.geo.path().projection(projection);
			return {path: path, projection: projection};
		},
		"Australia": function(element) {
			//empiric
			var k = 3.2;
			var projection = d3.geo.conicConformal()
				.rotate([-135, 0])
				.center([0, -20])
				.parallels([-10, -30]);
			var path = d3.geo.path().projection(projection);
			return {path: path, projection: projection};
		}
	};
})();
;(function() {	
	"use strict";
	owid.namespace("App.Views.Chart.Map.Legend");

	App.Views.Chart.Map.Legend = function() {

		//private
		var stepSize = 20,
			stepClass = "legend-step",
			legendOffsetX = 15,
			legendOffsetY = 10,
			displayMinLabel = true,
			labels = [], 
			orientation = "landscape",
			availableHeight = 0,
			unit = {},
			scale, minData, maxData, datamap, container, containerHeight, isCategoricalScale, descriptionHeight, g, gDesc;

		var formatLegendLabel = function(text, valueArr, i, length) {
			valueArr = valueArr.map(function(d) {
				var formattedNumber;
				if (d) {
					formattedNumber = owid.unitFormat(unit, d);
				} else {
					//see if we're suppose to display minimal value
					if (displayMinLabel)
						formattedNumber = owid.unitFormat(unit, minData || 0);
				}
				// HACK (Mispy): Don't use the unit suffix if it's too long
				if (formattedNumber.length >= 12)
					formattedNumber = formattedNumber.match(/[0-9,.]+/)[0] || formattedNumber;
				return formattedNumber;
			} );

			if (i < (length - 1)) {
				text.text(valueArr[0]);
			} else {
				text.selectAll("tspan").remove();
				//need to use tspan with preserve to have the whitespcae (??)
				text.append("tspan")
					.attr("class", "last-label-tspan")
					.text(valueArr[0]);
				text.append("tspan")
					.attr("class", "last-label-tspan")
					.text(valueArr[1]);
			}

		};

		var formatCategoricalLegendLabel = function( i, scale ) {
			return scale.domain()[ i ];
		};

		function legend(selection) {
			selection.each(function(data) {
				var svgBounds = $("svg").get(0).getBoundingClientRect(),
					tabBounds = $(".tab-pane.active").get(0).getBoundingClientRect(),
					availableWidth = tabBounds.width,
					availableSpace = (orientation == "landscape" ? availableWidth : availableHeight) * 0.6;

				var effectiveStepSize = Math.min(30, Math.max((availableSpace / data.scheme.length) - 10, 10)),
					stepSizeWidth = effectiveStepSize,
					stepSizeHeight = effectiveStepSize,
					stepGap = Math.min(effectiveStepSize/8, 2);

				datamap = d3.select(".datamap");
				container = d3.select(this);
				isCategoricalScale = ( !scale || !scale.hasOwnProperty( "invertExtent" ) )? true: false;
				descriptionHeight = ( data.description && data.description.length )? 12: 0;
				g = container.select( ".legend" );

				if (g.empty()) {
					g = selection.append( "g" )
							.attr( "id", "legend" )
							.attr( "class", "legend" );
				}

				//data join
				var legendSteps = g.selectAll("." + stepClass).data(data.scheme);
				
				//enter
				var legendStepsEnter = legendSteps.enter()
					.append( "g" )
						.attr( "class", stepClass );
				legendStepsEnter.append("rect");
				legendStepsEnter.append("line");
				legendStepsEnter.append("text");

				//vars for landscape
				var maxDataIndex = data.scheme.length - 1,
					legendStepsOffsetX = legendOffsetX;
				if( orientation === "portrait" && data.description ) {
					legendStepsOffsetX += 5;
				}
				
				//update
				legendSteps
					.attr( "transform", function( d, i ) { var translateX = ( orientation === "landscape" )? legendStepsOffsetX + (i*(stepSizeWidth+stepGap)): legendStepsOffsetX, translateY = ( orientation === "landscape" )? 0: ( -( maxDataIndex - i ) * ( stepSizeHeight + stepGap ) ); return "translate(" + translateX + "," + translateY + ")"; } );
				legendSteps.selectAll( "rect" )
					.attr( "width", stepSizeWidth + "px" )
					.attr( "height", stepSizeHeight + "px" );

				legendSteps.select( "rect" )
					.style( "fill", function( d, i ) {
							return d;
						} );
				
				//is there custom labeling for 
				var legendStepsTexts = legendSteps.select("text")
							.attr( "transform", function( d, i ) {
								var stepSizeX = stepSizeWidth/2 + 4;

								if ( orientation === "portrait" ) {
									//translate for portrait
									if( isCategoricalScale || ( labels.length && labels[i] ) ) {
										return "translate(" + (stepSizeWidth+5) + "," + (stepSizeHeight/2+3) + ")";
									} else {
										return "translate(" + (stepSizeWidth+5) + "," + (2) + ")";
									}
								} else {
									//translate for landscape
									if( !isCategoricalScale && ( !labels.length || !labels[i] ) ) {
										return "translate(-2,-5) rotate(270)";
									} else {
										return "translate(" + stepSizeX + ",-5) rotate(270)";
									}
								}
							})
							.each(function(d, i) {
								var text = d3.select(this);

								if (labels[i]) {
									text.text(labels[i]);
								} else if (isCategoricalScale) {
									text.text(formatCategoricalLegendLabel(i, scale));
								} else {
									formatLegendLabel(text, scale.invertExtent(d), i, data.scheme.length);
								}
							});
				
				//position last tspans
				var legendStepsTspans = legendStepsTexts.selectAll( "tspan.last-label-tspan" ),
					firstTspanLength = 0;
				legendStepsTspans.each(function(d, i) {
					if (i === 0) {
						firstTspanLength = this.getComputedTextLength();
					} else if (i === 1) {
						var dx = -firstTspanLength; //need to reset possible previous offset
						var dy = stepSizeHeight;
						d3.select(this).attr({ "dx": dx, "dy": dy });
					}
				} );
				
				//exit
				legendSteps.exit().remove();

				//legend description
				gDesc = container.selectAll(".legend-description").data([data.description]);
				gDesc.enter()
					.append("text")
					.attr("class", "legend-description");
				gDesc
					.text(data.description);
				gDesc.attr( "transform", function( d, i ) { var translateX = legendOffsetX, translateY = ( orientation === "landscape" )? stepSizeHeight+descriptionHeight: stepSizeHeight; return ( orientation === "landscape" )? "translate(" + translateX + "," + translateY + ")": "translate(" + translateX + "," + translateY + ") rotate(270)"; } );

				//position legend vertically
				var legendY = (tabBounds.top - svgBounds.top) + availableHeight - legendOffsetY - stepSizeHeight;
				if (orientation === "landscape") {
					legendY -= descriptionHeight;
				}

				container.attr("transform", "translate(0," + legendY + ")");

			});

			return legend;

		}

		//public methods
		legend.stepSize = function(value) {
			if(!arguments.length) {
				return stepSize;
			} else {
				stepSize = parseInt(value, 10);
			}
		};
		legend.scale = function( value ) {
			if( !arguments.length ) {
				return scale;
			} else {
				scale = value;
			}
		};
		legend.minData = function( value ) {
			if( !arguments.length ) {
				return minData;
			} else {
				minData = value;
			}
		};
		legend.maxData = function( value ) {
			if( !arguments.length ) {
				return maxData;
			} else {
				maxData = value;
			}
		};
		legend.displayMinLabel = function( value ) {
			if( !arguments.length ) {
				return displayMinLabel;
			} else {
				displayMinLabel = value;
			}
		};
		legend.labels = function( value ) {
			if( !arguments.length ) {
				return labels;
			} else {
				//set sensible default
				if( !value ) {
					value = [];
				}
				labels = value;
			}
		};
		legend.orientation = function( value ) {
			if( !arguments.length ) {
				return orientation;
			} else {
				orientation = value;
			}
		};
		legend.availableHeight = function(value) {
			if (!arguments.length)
				return availableHeight;
			else
				availableHeight = value;
		};
		legend.unit = function(value) {
			if (!arguments.length)
				return unit;
			else
				unit = value;
		};

		return legend;

	};
})();
;(function() {
	"use strict";
	owid.namespace("App.Views.Chart.MapTab");

	var MapControls = App.Views.Chart.Map.MapControls,
		TimelineControls = App.Views.Chart.Map.TimelineControls,
		owdProjections = App.Views.Chart.Map.Projections,
		Legend = App.Views.Chart.Map.Legend,
		ChartDataModel = App.Models.ChartDataModel;

	App.Views.Chart.MapTab = Backbone.View.extend({

		BORDERS_DISCLAIMER_TEXT: "Mapped on current borders",

		el: "#chart-view",
		dataMap: null,
		mapControls: null,
		legend: null,
		bordersDisclaimer: null,
		events: {},

		initialize: function( options ) {
			this.dispatcher = options.dispatcher;
			this.parentView = options.parentView;
			this.vardataModel = options.vardataModel;
			this.$tab = this.$el.find("#map-chart-tab");
		},

		activate: function(callback) {
			if (!this.mapControls)
				this.mapControls = new MapControls( { dispatcher: this.dispatcher } );
			if (!this.timelineControls)
				this.timelineControls = new TimelineControls( { dispatcher: this.dispatcher } );

			App.ChartModel.on("change", this.update, this);
			App.ChartModel.on("change-map", function() {
				this.update();
				App.ChartView.onResize();
			}.bind(this), this);
			App.ChartModel.on("change-map-year", this.updateYearOnly, this);
			this.update(callback);
		},

		deactivate: function() {
			App.ChartModel.off(null, null, this);
			$(".datamaps-hoverover").remove();
			d3.selectAll(".datamaps-subunits, .border-disclaimer, .legend-wrapper, .map-bg").remove();			
			$("svg").removeClass("datamap");
			this.dataMap = null;
		},

		update: function(callback) {
			this.mapConfig = App.ChartModel.get("map-config");

			// We need to wait for both datamaps to finish its setup and the variable data
			// to come in before the map can be fully rendered
			var onMapReady = function() {
				$(".chart-wrapper-inner").attr("style", "");
				App.DataModel.ready(function() {
					this.render(callback);
				}.bind(this));				
			}.bind(this);

			if (!this.dataMap)
				this.initializeMap(onMapReady);
			else
				onMapReady();
		},

		// Optimized method for updating the target year with the slider
		updateYearOnly: _.throttle(function() {
			App.DataModel.ready(function(variableData) {
				this.mapData = this.transformData(variableData);
				this.applyColors(this.mapData, this.colorScale);
				this.dataMap.updateChoropleth(this.mapData, { reset: true });
				this.parentView.header.render();
			}.bind(this));
		}, 100),

		initializeMap: function(onMapReady) {
			var self = this;
			var defaultProjection = this.getProjection(this.mapConfig.projection);

			var $oldSvg = $("svg");
			this.dataMap = new Datamap({
				element: $(".chart-wrapper-inner").get(0),
				responsive: false,
				geographyConfig: {
					dataUrl: Global.rootUrl + "/build/js/data/world.ids.json",
					borderWidth: 0.3,
					borderColor: '#4b4b4b',
					highlightFillColor: '#8b8b8b',
					highlightBorderWidth: 3,
					highlightBorderColor: '#FFEC38',
					popupTemplate: self.popupTemplateGenerator,
					hideAntarctica: true
				},
				fills: {
					defaultFill: '#8b8b8b'
				},
				setProjection: defaultProjection,
				done: function() {
					// HACK (Mispy): Workaround for the fact that datamaps insists on creating
					// its own SVG element instead of injecting into an existing one.
					$oldSvg.children().appendTo($("svg.datamap"));
					$oldSvg.remove();

					d3.select("svg.datamap").insert("rect", "*")
						.attr("class", "map-bg")
						.attr("x", 0).attr("y", 0);
					onMapReady();
				}
			});

			// For maps earlier than 2011, display a disclaimer noting that data is mapped
			// on current rather than historical borders
			if (parseInt(self.mapConfig.minYear) <= 2011) {
				this.bordersDisclaimer = d3.select( ".border-disclaimer" );
				if (this.bordersDisclaimer.empty()) {
					this.bordersDisclaimer = d3.select(".datamap").append("text");
					this.bordersDisclaimer.attr("class", "border-disclaimer").text(this.BORDERS_DISCLAIMER_TEXT);
				}
			}

			// Set configurable targets from defaults
			this.mapConfig.targetYear = this.mapConfig.defaultYear || this.mapConfig.targetYear;
			this.mapConfig.projection = this.mapConfig.defaultProjection || this.mapConfig.projection;
		},

		popupTemplateGenerator: function(geo, data) {
			if (_.isEmpty(data)) return;

			//transform datamaps data into format close to nvd3 so that we can reuse the same popup generator
			var mapConfig = App.ChartModel.get( "map-config" ),
				propertyName = App.Utils.getPropertyByVariableId(App.ChartModel, mapConfig.variableId) || "y";

			var obj = {
				point: {
					time: data.year
				},
				series: [{
					key: geo.properties.name
				}]
			};
			obj.point[propertyName] = data.value;
			return ["<div class='hoverinfo nvtooltip'>" + owid.contentGenerator( obj, true ) + "</div>"];
		},

		onChartModelChange: function( evt ) {
			this.update();
		},


		/**
		 * Transforms raw variable data into datamaps format
		 * @param {Object} variableData - of the form { entities: [], values: [], years: [] }
		 * @return {Object} mapData - of the form { 'Country': { value: 120.11, year: 2006 }, ...}
		 */
		transformData: function(variableData) {
			var firstVariable = variableData.variables[this.mapConfig.variableId],
				years = firstVariable.years,
				values = firstVariable.values,
				entities = firstVariable.entities,
				entityKey = variableData.entityKey,
				targetYear = parseInt(this.mapConfig.targetYear),
				tolerance = parseInt(this.mapConfig.timeTolerance) || 1,
				mapData = {};

			if (this.mapConfig.mode === "no-interpolation")
				tolerance = 0;

			for (var i = 0; i < values.length; i++) {
				var year = years[i];
				if (year < targetYear-tolerance || year > targetYear+tolerance) 
					continue;

				// Make sure we use the closest year within tolerance (favoring later years)
				var current = mapData[entityName];
				if (current && Math.abs(current.year - targetYear) < Math.abs(year - targetYear))
					continue;


				// Transform entity name to match counterpart in world.ids.json
				// Covers e.g. Cote d'Ivoire -> Cote_d_Ivoire
				var entityName = entityKey[entities[i]].name.replace(/[ '&:\(\)\/]/g, "_");

				mapData[entityName] = {
					value: parseFloat(values[i]),
					year: years[i]
				};
			}

			this.minValue = _.min(mapData, function(d, i) { return d.value; }).value;
			this.maxValue = _.max(mapData, function(d, i) { return d.value; }).value;
			this.minToleranceYear = _.min(mapData, function(d, i) { return d.year; }).year;
			this.maxToleranceYear = _.max(mapData, function(d, i) { return d.year; }).year;
			this.variableName = firstVariable.name;


			// HACK (Mispy): Ideally these calculated values shouldn't go in mapConfig,
			// but for backwards compatibility it's easier to have them there.
			var rangeYears = owid.timeRangesToYears(this.mapConfig.timeRanges, years[0], years[years.length-1]);
			App.ChartModel.updateMapConfig("minYear", rangeYears[0], true);
			App.ChartModel.updateMapConfig("maxYear", rangeYears[rangeYears.length-1], true);


			return mapData;
		},

		applyColors: function(mapData, colorScale) {
			_.each(mapData, function(d, i) {
				d.color = colorScale(d.value);
				d.highlightFillColor = d.color;
			});
		},

		render: function(callback) {
			try {
				var variableData = App.DataModel.get("variableData");
				this.mapData = this.transformData(variableData);
				this.colorScale = this.makeColorScale();
				this.applyColors(this.mapData, this.colorScale);

				// If we've changed the projection (i.e. zooming on Africa or similar) we need
				// to redraw the datamap before injecting new data
				var oldProjection = this.dataMap.options.setProjection,
					newProjection = this.getProjection(this.mapConfig.projection);

				var self = this;
				var updateMap = function() {
					self.dataMap.updateChoropleth(self.mapData, { reset: true });
					d3.selectAll("svg.datamap").transition().each("end", function() {
						$(window).trigger("chart-loaded");
					});
					self.mapControls.render();
					self.timelineControls.render();
					if (callback) callback();
					else self.onResize();
				};

				if (oldProjection === newProjection) {
					updateMap();
				} else {
					d3.selectAll("path.datamaps-subunit").remove();
					this.dataMap.options.setProjection = newProjection;
					this.dataMap.options.done = updateMap;
					this.dataMap.draw();
				}				
			} catch (err) {
				App.ChartView.handleError(err);	
			}
		},

		makeColorScale: function() {
			var mapConfig = this.mapConfig;
			var colorScheme = owdColorbrewer.getColors(mapConfig);

			var colorScale,
				customValues = mapConfig.colorSchemeValues,
				automaticValues = mapConfig.colorSchemeValuesAutomatic;

			var categoricalScale = false;

			//use quantize, if we have numerica scale and not using automatic values, or if we're trying not to use automatic scale, but there no manually entered custom values
			if( !categoricalScale && ( automaticValues || (!automaticValues && !customValues) ) ) {
				//we have quantitave scale
				colorScale = d3.scale.quantize()
					.domain( [ this.minValue, this.maxValue ] );
			} else if( !categoricalScale && customValues && !automaticValues ) {
				//create threshold scale which divides data into buckets based on values provided
				colorScale = d3.scale.equal_threshold()
					.domain( customValues );
			} else {
/*				var keys = _.keys( keysArr );
				keys = keys.sort();
				colorScale = d3.scale.ordinal()
					.domain( _.keys( keysArr ) );*/
			}
			colorScale.range(colorScheme);

			return colorScale;
		},

		makeLegend: function(availableHeight) {
			var legend = this.legend || new Legend(),
				minValue = this.minValue,
				maxValue = this.maxValue,
				mapConfig = this.mapConfig,
				colorScale = this.colorScale;

			if (mapConfig.colorSchemeMinValue || mapConfig.colorSchemeValuesAutomatic) {
				legend.displayMinLabel(true);
			} else {
				legend.displayMinLabel(false);
			}

			var unitsString = App.ChartModel.get("units"),
				units = !_.isEmpty(unitsString) ? $.parseJSON(unitsString) : {},
				yUnit = _.findWhere(units, { property: 'y' });
			legend.unit(yUnit);
			legend.labels(mapConfig.colorSchemeLabels);

			var legendOrientation = mapConfig.legendOrientation || "portrait";
			legend.orientation(legendOrientation);
			legend.scale(colorScale);

			// Allow min value to overridden by config
			if (!isNaN(mapConfig.colorSchemeMinValue)) {
				minValue = mapConfig.colorSchemeMinValue;
			}
			legend.minData(minValue);
			legend.maxData(maxValue);
			legend.availableHeight(availableHeight);
			if (d3.select(".legend-wrapper").empty()) {
				d3.select(".datamap").append("g").attr("class", "legend-wrapper map-legend-wrapper");
			}

			var legendData = { scheme: colorScale.range(), description: mapConfig.legendDescription || this.variableName };
			d3.select(".legend-wrapper").datum(legendData).call(legend);
			return legend;
		},

		getProjection: function( projectionName ) {
			var projections = owdProjections,
				newProjection = ( projections[ projectionName ] )? projections[ projectionName ]: projections.World;
			return newProjection;
		},

		onResize: function(callback) {
			var map = d3.select(".datamaps-subunits");			
			if (!this.dataMap || map.empty()) {
				if (callback) callback();
				return;
			}

			var viewports = {
				"World": { x: 0.525, y: 0.5, width: 1, height: 1 },
				"Africa": { x: 0.48, y: 0.70, width: 0.21, height: 0.38 },
				"N.America": { x: 0.49, y: 0.40, width: 0.19, height: 0.32 },
				"S.America": { x: 0.52, y: 0.815, width: 0.10, height: 0.26 },
				"Asia": { x: 0.49, y: 0.52, width: 0.22, height: 0.38 },
				"Australia": { x: 0.51, y: 0.77, width: 0.1, height: 0.12 },
				"Europe": { x: 0.54, y: 0.54, width: 0.05, height: 0.15 },
			};

			var viewport = viewports[App.ChartModel.get("map-config").projection];

			var options = this.dataMap.options,
				prefix = "-webkit-transform" in document.body.style ? "-webkit-" : "-moz-transform" in document.body.style ? "-moz-" : "-ms-transform" in document.body.style ? "-ms-" : "";

			// Calculate our reference dimensions. All of these values are independent of the current
			// map translation and scaling-- getBBox() gives us the original, untransformed values.
			var svg = d3.select("svg"),
				svgBounds = svg.node().getBoundingClientRect(),
				$tab = $(".tab-pane.active"),
				tabBounds = $tab.get(0).getBoundingClientRect(),
				availableWidth = tabBounds.right - tabBounds.left,
				availableHeight = tabBounds.bottom - tabBounds.top,
				mapBBox = map.node().getBBox(),
				mapWidth = mapBBox.width,
				mapHeight = mapBBox.height,
				mapX = svgBounds.left + mapBBox.x + 1,
				mapY = svgBounds.top + mapBBox.y + 1,
				viewportWidth = viewport.width*mapWidth,
				viewportHeight = viewport.height*mapHeight;

			//console.log("wrapperWidth " + wrapperWidth + " wrapperHeight " + wrapperHeight + " mapWidth " + mapWidth + " mapHeight " + mapHeight);

			// Resize background
			svg.select(".map-bg")
				.attr("width", svgBounds.width)
				.attr("height", svgBounds.height);

			// Adjust availableHeight to compensate for timeline controls
			var timelineControls = d3.select(".map-timeline-controls");
			if (!timelineControls.empty()) {
				var controlsBoundingRect = timelineControls.node().getBoundingClientRect(),
					controlsHeight = controlsBoundingRect.bottom - controlsBoundingRect.top;
				availableHeight -= controlsHeight;
			}

			// Calculate what scaling should be applied to the untransformed map to match the current viewport to the container
			var scaleFactor = Math.min(availableWidth/viewportWidth, availableHeight/viewportHeight),
				scaleStr = "scale(" + scaleFactor + ")";

			// Work out how to center the map, accounting for the new scaling we've worked out
			var newWidth = mapWidth*scaleFactor,
				newHeight = mapHeight*scaleFactor,
				tabCenterX = tabBounds.left + availableWidth / 2,
				tabCenterY = tabBounds.top + availableHeight / 2,
				newCenterX = mapX + (scaleFactor-1)*mapBBox.x + viewport.x*newWidth,
				newCenterY = mapY + (scaleFactor-1)*mapBBox.y + viewport.y*newHeight,
				newOffsetX = tabCenterX - newCenterX,
				newOffsetY = tabCenterY - newCenterY,
				translateStr = "translate(" + newOffsetX + "px," + newOffsetY + "px)";

			var matrixStr = "matrix(" + scaleFactor + ",0,0," + scaleFactor + "," + newOffsetX + "," + newOffsetY + ")";
			map.style(prefix + "transform", matrixStr);

			if (this.bordersDisclaimer && !this.bordersDisclaimer.empty()) {
				var bordersDisclaimerEl = this.bordersDisclaimer.node(),
					bordersDisclaimerX = availableWidth - bordersDisclaimerEl.getComputedTextLength() - 10,
					bordersDisclaimerY = (tabBounds.top - svgBounds.top) + availableHeight - 10;
				this.bordersDisclaimer.attr("transform", "translate(" + bordersDisclaimerX + "," + bordersDisclaimerY + ")");
			}

			this.legend = this.makeLegend(availableHeight);

			if (callback) callback();
			/*wrapper.on("mousemove", function() {
				var point = d3.mouse(this);
				var rect = map.node().getBoundingClientRect();
				var wrapRect = wrapper.node().getBoundingClientRect();
				var x = point[0] - (rect.left - wrapRect.left);
				var y = point[1] - (rect.top - wrapRect.top);
				console.log([x/newWidth, y/newHeight]);
			});*/
		},

	});
})();

(function() {
	var ε = 1e-6, ε2 = ε * ε, π = Math.PI, halfπ = π / 2, sqrtπ = Math.sqrt(π), radians = π / 180, degrees = 180 / π;
	function sinci(x) {
		return x ? x / Math.sin(x) : 1;
	}
	function sgn(x) {
		return x > 0 ? 1 : x < 0 ? -1 : 0;
	}
	function asin(x) {
		return x > 1 ? halfπ : x < -1 ? -halfπ : Math.asin(x);
	}
	function acos(x) {
		return x > 1 ? 0 : x < -1 ? π : Math.acos(x);
	}
	function asqrt(x) {
		return x > 0 ? Math.sqrt(x) : 0;
	}
	var projection = d3.geo.projection;

	function eckert3(λ, φ) {
		var k = Math.sqrt(π * (4 + π));
		return [ 2 / k * λ * (1 + Math.sqrt(1 - 4 * φ * φ / (π * π))), 4 / k * φ ];
	}
	eckert3.invert = function(x, y) {
		var k = Math.sqrt(π * (4 + π)) / 2;
		return [ x * k / (1 + asqrt(1 - y * y * (4 + π) / (4 * π))), y * k / 2 ];
	};
	(d3.geo.eckert3 = function() {
		return projection(eckert3);
	}).raw = eckert3;

})();

//custom implementation of d3_treshold which uses greaterThan (by using bisectorLeft instead of bisectorRight)
d3.scale.equal_threshold = function() {
  return d3_scale_equal_threshold([0.5], [0, 1]);
};

function d3_scale_equal_threshold(domain, range) {

  function scale(x) {
    if (x <= x) return range[d3.bisectLeft(domain, x)];
  }

  scale.domain = function(_) {
    if (!arguments.length) return domain;
    domain = _;
    return scale;
  };

  scale.range = function(_) {
    if (!arguments.length) return range;
    range = _;
    return scale;
  };

  scale.invertExtent = function(y) {
    y = range.indexOf(y);
    return [domain[y - 1], domain[y]];
  };

  scale.copy = function() {
    return d3_scale_threshold(domain, range);
  };

  return scale;
}

/* App.Views.ChartURL.js                                                             
 * ================                                                             
 *
 * This view is responsible for handling data binding between the
 * the chart and url parameters, to enable nice linking support
 * for specific countries and years.
 *
 * @project Our World In Data
 * @author  Jaiden Mispy                                                     
 * @created 2016-03-31
 */ 

;(function() {
	"use strict";
	owid.namespace("App.Views.ChartURL");

	App.Views.ChartURL = Backbone.View.extend({
		initialize: function(options) {
			if (App.isEditor) return false; // No URL stuff while editing charts

			if (window.location.pathname.match(/.export$/))
				$("body").attr("id", "chart-export");
				
			$(window).one("chart-loaded", function() {
				App.ChartView.onResize(function() {
					if (window.callPhantom) {
						window.callPhantom();
						App.ChartView.onSVGExport();
					} else {
						window.top.postMessage("chartLoaded", "*");
						console.log("Loaded chart: " + App.ChartModel.get("chart-name"));
										}
				});
			});

			// Keep the query params separate between map and the other tabs
			this.lastTabName = null;
			this.mapQueryStr = "?";
			this.chartQueryStr = "?";
			this.originalDefaultTab = App.ChartModel.get("default-tab");

			$(window).on("query-change", this.onQueryChange.bind(this));
			options.dispatcher.on("tab-change", this.onTabChange, this);
			App.ChartModel.on("change:selected-countries", this.updateCountryParam, this);			
			App.ChartModel.on("change-map-year", this.updateYearParam, this);
			App.ChartModel.on("change-map", this.updateMapParams, this);
			App.ChartModel.on("change:currentStackMode", this.updateStackMode, this);
			this.populateFromURL();
		},

		/**
		 * Apply any url query parameters on chart startup
		 */
		populateFromURL: function() {
			var params = owid.getQueryParams();

			// Set tab if specified
			var tab = params.tab;
			if (tab) {
				if (!_.contains(App.ChartModel.get("tabs"), tab))
					console.error("Unexpected tab: " + tab);
				else
					App.ChartModel.set("default-tab", tab, { silent: true });
			}

			var stackMode = params.stackMode;
			if (stackMode == "relative")
				App.ChartModel.set("currentStackMode", stackMode);

			// Map stuff below

			var year = params.year;
			if (year !== undefined) {
				App.ChartModel.updateMapConfig("defaultYear", year);
			}

			var region = params.region;
			if (region !== undefined) {
				App.ChartModel.updateMapConfig("defaultProjection", region);
			}

			var colorblind = params.colorblind;
			if (colorblind == 1) {
				App.ChartModel.updateMapConfig("isColorblind", true);
			}

			var interpolate = params.interpolate;
			if (interpolate == 0) {
				App.ChartModel.updateMapConfig("mode", "no-interpolation");
			}			

			// TODO: 'country' is currently done server-side, might be more consistent
			// to do them here too - mispy
		},

		/**
		 * Save the current tab the user is on, and keep url params correctly isolated
		 */
		onTabChange: function(tabName) {
			if (this.lastTabName == "map" && tabName != "map") {
				this.mapQueryStr = window.location.search;
				owid.setQueryStr(this.chartQueryStr);
			} else if (this.lastTabName != "map" && this.lastTabName != null && tabName == "map") {				
				this.chartQueryStr = window.location.search;
				owid.setQueryStr(this.mapQueryStr);
			}
			if (tabName == this.originalDefaultTab)
				owid.setQueryVariable("tab", null);
			else
				owid.setQueryVariable("tab", tabName);
			this.lastTabName = tabName;
		},

		onQueryChange: function() {
		},

		/**
		 * Set e.g. &country=AFG+USA when user adds Afghanistan and the United States
		 * using the legend add country buttons
		 */
		updateCountryParam: function() {
			var selectedCountries = App.ChartModel.get("selected-countries"),
				entityCodes = [];

			App.DataModel.ready(function(variableData) {
				// Sort them by name so the order in the url matches the legend
				var sortedCountries = _.sortBy(selectedCountries, function(entity) {
					return entity.name;
				});

				var entityCodes = [];
				_.each(sortedCountries, function(entity) {
					var foundEntity = variableData.entityKey[entity.id];
					if (!foundEntity) return;
					entityCodes.push(encodeURIComponent(foundEntity.code || foundEntity.name));
				});

				owid.setQueryVariable("country", entityCodes.join("+"));
			});			
		},

		/**
		 * Set e.g. &year=1990 when the user uses the map slider to go to 1990
		 */
		updateYearParam: function() {
			var targetYear = App.ChartModel.get("map-config").targetYear;
			owid.setQueryVariable("year", targetYear);
		},

		/**
		 * Store current projection in URL
		 */
		updateMapParams: function() {
			var mapConfig = App.ChartModel.get("map-config");

			var projection = mapConfig.projection;
			owid.setQueryVariable("region", projection);

			var colorblind = mapConfig.isColorblind;
			if (colorblind)
				owid.setQueryVariable("colorblind", 1);
			else
				owid.setQueryVariable("colorblind", null);

			var interpolate = (mapConfig.mode !== "no-interpolation");
			if (interpolate)
				owid.setQueryVariable("interpolate", null);
			else
				owid.setQueryVariable("interpolate", 0);
		},

		/**
		 * Special config for stacked area charts
		 */
		updateStackMode: function() {
			var stackMode = App.ChartModel.get("currentStackMode");
			if (stackMode == "relative")
				owid.setQueryVariable("stackMode", "relative");
			else
				owid.setQueryVariable("stackMode", null);
		},
	});
})();
;(function() {	
	"use strict";
	owid.namespace("App.Views.ChartView");

	var Header = require("App.Views.Chart.Header"),
		Footer = require("App.Views.Chart.Footer"),
		ChartURL = require("App.Views.ChartURL"),
		ScaleSelectors = require("App.Views.Chart.ScaleSelectors"),
		ChartTab = require("App.Views.Chart.ChartTab"),
		DataTab = require("App.Views.Chart.DataTab"),
		SourcesTab = require("App.Views.Chart.SourcesTab"),
		MapTab = require("App.Views.Chart.MapTab"),
		ChartDataModel = require("App.Models.ChartDataModel"),
		Utils = require("App.Utils");
	
	App.Views.ChartView = Backbone.View.extend({
		activeTab: false,
		el: "#chart-view",

		events: {
			"click li.header-tab a": "onTabClick"
		},

		initialize: function(options) {
			App.ChartView = this;			

			options = options || {};
			this.dispatcher = options.dispatcher || _.clone(Backbone.Events);
		
			$(document).ajaxStart(function() {
				$(".chart-preloader").show();
			});

			$(document).ajaxStop(function() {
				$(".chart-preloader").hide();
			});

			if (App.ChartModel.get("chart-name"))
				$(".chart-preloader").show();

			if (window.self != window.top) {
				$("#chart-view").addClass("embedded");
			}
			
			// Determine if we're logged in and show the edit button
			// Done here instead of PHP to allow for caching etc optimization on public-facing content
			if (Cookies.get("wp-settings-11")) {
				$(".edit-btn-wrapper").removeClass("hidden");
			}
			
			var that = this;

			// Data model used for fetching variables
			App.DataModel = new ChartDataModel();			
			var childViewOptions = { dispatcher: this.dispatcher, parentView: this };
			this.urlBinder = new ChartURL(childViewOptions);
			this.header = new Header(childViewOptions);
			this.footer = new Footer(childViewOptions);
			this.scaleSelectors = new ScaleSelectors(childViewOptions);
			//tabs
			var chartType = App.ChartModel.get("chart-type");
			this.chartTab = new ChartTab(childViewOptions);
			this.dataTab = new DataTab(childViewOptions);
			this.sourcesTab = new SourcesTab(childViewOptions);
			this.mapTab = new MapTab(childViewOptions);
			this.tabs = [this.chartTab, this.dataTab, this.sourcesTab, this.mapTab];
			
			this.$error = this.$el.find( ".chart-error" );

			nv.utils.windowResize(_.debounce(function() {
				this.onResize();
			}.bind(this), 150));			

			var defaultTabName = App.ChartModel.get("default-tab");
			this.activateTab(defaultTabName);

			App.ChartModel.on("change", function() {
				// When the model changes and there's been an error, rebuild the whole current tab
				// Allows the editor to recover from failure states
				if ($(".chart-error").length != 0) {
					this.activateTab(this.activeTabName);
				}
			}.bind(this));
		},

		onTabClick: function(ev) {
			ev.preventDefault();
			ev.stopPropagation();
			var tabName = $(ev.target).closest("li").attr("class").match(/(\w+)-header-tab/)[1];
			this.activateTab(tabName);
		},

		activateTab: function(tabName) {
			$(".chart-error").remove();

			$("." + tabName + "-header-tab a").tab('show');
			var tab = this[tabName + "Tab"];
			if (this.activeTab) {
				this.activeTab.deactivate();
				this.activeTab = null;
			} else if (this.loadingTab) {
				this.loadingTab.deactivate();				
			}

			this.loadingTab = tab;
			this.activeTabName = tabName;
			this.dispatcher.trigger("tab-change", tabName);		
			if (!_.isEmpty(App.ChartModel.get("chart-dimensions")))
				$(".chart-preloader").show();			
			App.DataModel.ready(function() {
				try {
					tab.activate(function() {
						$(".chart-preloader").hide();							
							this.loadingTab = null;
							this.activeTab = tab;
						this.onResize();
					}.bind(this));					
				} catch (err) {
					App.ChartView.handleError(err);
				}
			}.bind(this));
		},

		handleError: function(err) {
			if (err.responseText) {
				err = err.status + " " + err.statusText + "\n" + "    " + err.responseText;
			} else {
				err = err.stack;
			}
			console.error(err);
			var tab = this.activeTab || this.loadingTab;
			if (tab)
				tab.deactivate();
			this.activeTab = null;
			this.loadingTab = null;
			this.$(".chart-preloader").hide();
			this.$(".tab-pane.active").prepend('<div class="chart-error"><pre>' + err + '</pre></div>');
		},

		onSVGExport: function() {	
			var svg = d3.select("svg");

			// Remove SVG UI elements that aren't needed for export
			svg.selectAll(".nv-add-btn, .nv-controlsWrap").remove();

			// Inline the CSS styles, since the exported SVG won't have a stylesheet
			var styleSheets = document.styleSheets;
			_.each(document.styleSheets, function(styleSheet) {
				_.each(styleSheet.cssRules, function(rule) {
					try {
						$(rule.selectorText).each(function(i, elem) {
							if ($(elem).parent().closest("svg").length)
								elem.style.cssText += rule.style.cssText;
						});	
					} catch (e) {}						
				});
			});		

			// MISPY: Need to propagate a few additional styles from the external document into the SVG
			$("svg").css("font-size", $("html").css("font-size"));	
			$("svg").css("margin", "10px");

			svgAsDataUri(svg.node(), {}, function(uri) {
				var svg = uri.substring('data:image/svg+xml;base64,'.length);
				if (_.isFunction(window.callPhantom))
					window.callPhantom({ "svg": window.atob(svg) });
			});
		},

		onResize: function(callback, isRepeat) {
			var $wrapper = this.$el.find(".chart-wrapper-inner"),
				svg = d3.select("svg");
			if (!isRepeat) {
				$wrapper.css("height", "calc(100% - 24px)");
			}

			async.series([this.header.onResize.bind(this.header), 
						 this.footer.onResize.bind(this.footer)], 
			function() {
				// Figure out how much space we have left for the actual tab content
				var svgBounds = svg.node().getBoundingClientRect(),
					headerBounds = svg.select(".chart-header-svg").node().getBoundingClientRect(),
					footerBounds = svg.select(".chart-footer-svg").node().getBoundingClientRect(),
					tabOffsetY = headerBounds.bottom - svgBounds.top,
					tabHeight = footerBounds.top - headerBounds.bottom;

				// MISPY: Ideally we want to fit all of our contents into the space that we are given.
				// However, if there is much header and footer text and the screen is small then we may
				// need to demand extra scrollable height so that the user can actually see the chart.
				var minHeight = 300;
				if (tabHeight < minHeight) {
					//svg.style("height", svgBounds.height + (minHeight-tabHeight) + "px");
					$wrapper.css("height", $wrapper.height() + (minHeight-tabHeight) + 10 + "px");
					this.onResize(callback, true);
					return;
				}

				this.$el.find(".tab-content").css("margin-top", tabOffsetY);
				this.$el.find(".tab-content").css("height", tabHeight);

				if (this.$el.find(".chart-tabs").is(":visible")) {
					tabOffsetY += this.$el.find(".chart-tabs").height();
					tabHeight -= this.$el.find(".chart-tabs").height();
				}

				this.$el.find(".tab-pane").css("height", "calc(100% - " + $(".tab-content > .clearfix").height() + "px)");

				if (this.activeTab && this.activeTab.onResize) {
					try {
						this.activeTab.onResize(callback);
					} catch (err) {
						App.ChartView.handleError(err);
					}
				} else
					if (callback) callback();
			}.bind(this));
		},
	});
})();

;(function() {	
	"use strict";
	owid.namespace("App.ChartView");
	App.isEditor = false;

	App.loadChart = function(chartConfig) {
		var	ChartView = App.Views.ChartView,
			ChartModel = App.Models.ChartModel,
			ChartDataModel = App.Models.ChartDataModel;

		var $chartShowWrapper = $(".chart-show-wrapper, .chart-edit-wrapper"),
			chartId = $chartShowWrapper.attr("data-chart-id");

		if (!$chartShowWrapper.length || !chartId)
			return; // No chart to show here

		App.ChartModel = new ChartModel(chartConfig);
		App.ChartView = new App.Views.ChartView();

		//find out if it's in cache
		if( !$( ".standalone-chart-viewer" ).length ) {
			//disable caching for viewing within admin
			App.ChartModel.set( "cache", false );
		}

		//chosen select
		$( ".chosen-select" ).chosen();		
	}
})();
//# sourceMappingURL=ChartApp.js.map
