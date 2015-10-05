(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
;( function() {

	"use strict";
	
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
		
		var text = d3.select( $el.selector );
		text.each( function() {
			var text = d3.select(this),
				regex = /\s+/,
				words = text.text().split(regex).reverse();

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


	App.Utils.contentGenerator = function( data, isMapPopup ) {
			
		//set popup
		var unitsString = App.ChartModel.get( "units" ),
			chartType = App.ChartModel.get( "chart-type" ),
			units = ( !$.isEmptyObject( unitsString ) )? $.parseJSON( unitsString ): {},
			string = "",
			valuesString = "";

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

			if( !isMapPopup && ( App.ChartModel.get( "chart-type" ) === "4" || App.ChartModel.get( "chart-type" ) === "5" || App.ChartModel.get( "chart-type" ) === "6" ) ) {
				//multibarchart has values in different format
				point = { "y": serie.value, "time": data.data.time };
			}
			
			$.each( point, function( i, v ) {
				//for each data point, find appropriate unit, and if we have it, display it
				var unit = _.findWhere( units, { property: i } ),
					value = v,
					isHidden = ( unit && unit.hasOwnProperty( "visible" ) && !unit.visible )? true: false;

				//format number
				if( unit && !isNaN( unit.format ) && unit.format >= 0 ) {
					//fixed format
					var fixed = Math.min( 20, parseInt( unit.format, 10 ) );
					value = d3.format( ",." + fixed + "f" )( value );
				} else {
					//add thousands separator
					value = d3.format( "," )( value );
				}

				if( unit ) {
					if( !isHidden ) {
						//try to format number
						//scatter plot has values displayed in separate rows
						if( valuesString !== "" && chartType != 2 ) {
							valuesString += ", ";
						}
						if( chartType == 2 ) {
							valuesString += "<span class='var-popup-value'>";
						}
						valuesString += value + " " + unit.unit;
						if( chartType == 2 ) {
							valuesString += "</span>";
						}
					}
				} else if( i === "time" ) {
					timeString = v;
				} else if( i !== "color" && i !== "series" && ( i !== "x" || chartType != 1 ) ) {
					if( !isHidden ) {
						if( valuesString !== "" && chartType != 2 ) {
							valuesString += ", ";
						}
						if( chartType == 2 ) {
							valuesString += "<span class='var-popup-value'>";
						}
						//just add plain value, omiting x value for linechart
						valuesString += value;
						if( chartType == 2 ) {
							valuesString += "</span>";
						}
					}
				}
			} );

			if( isMapPopup || ( timeString && chartType != 2 ) ) {
				valuesString += " <br /> in <br /> " + timeString;
			} else if( timeString && chartType == 2 ) {
				valuesString += "<span class='var-popup-value'>in " + timeString + "</span>";
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
			$(rules[idx].selectorText).each(function (i, elem) {
				elem.style.cssText += rules[idx].style.cssText;
			});
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

	module.exports = App.Utils;
	
})();
},{}],2:[function(require,module,exports){
;( function() {
	
	"use strict";

	var Chart = require( "./views/App.Views.Chart.js" ),
		ChartModel = require( "./models/App.Models.ChartModel.js" ),
		ChartDataModel = require( "./models/App.Models.ChartDataModel.js" );

	//setup models
	//is new chart or display old chart
	var $chartShowWrapper = $( ".chart-show-wrapper, .chart-edit-wrapper" ),
		chartId = $chartShowWrapper.attr( "data-chart-id" );

	//setup views
	App.View = new Chart();

	if( $chartShowWrapper.length && chartId ) {
		
		//showing existing chart
		App.ChartModel = new ChartModel( { id: chartId } );
		App.ChartModel.fetch( {
			success: function( data ) {
				App.View.start();
			},
			error: function( xhr ) {
				console.error( "Error loading chart model", xhr );
			}
		} );
		//find out if it's in cache
		if( !$( ".standalone-chart-viewer" ).length ) {
			//disable caching for viewing within admin
			App.ChartModel.set( "cache", false );
		}
		
	} else {

		//is new chart
		App.ChartModel = new ChartModel();
		App.View.start();

	}

	
	

})();
},{"./models/App.Models.ChartDataModel.js":3,"./models/App.Models.ChartModel.js":4,"./views/App.Views.Chart.js":5}],3:[function(require,module,exports){
;( function() {
		
	"use strict";

	App.Models.ChartDataModel = Backbone.Model.extend( {

		defaults: {},

		urlRoot: Global.rootUrl + "/data/dimensions",
		
		/*url: function(){

			var attrs = this.attributes,
				url = this.urlRoot + "?";

			//add all attributes to url
			_.each( attrs, function( v, i ) {
				url += i + "=" + v;
				url += "&";
			} );

			return url;

		},*/

		initialize: function () {

		},

	} );

	module.exports = App.Models.ChartDataModel;

})();
},{}],4:[function(require,module,exports){
;( function() {
		
	"use strict";

	App.Models.ChartModel = Backbone.Model.extend( {

		//urlRoot: Global.rootUrl + '/charts/',
		//urlRoot: Global.rootUrl + '/data/config/',
		url: function() {
			if( $("#form-view").length ) {
				if( this.id ) {
					//editing existing
					return Global.rootUrl + "/charts/" + this.id;
				} else {
					//saving new
					return Global.rootUrl + "/charts";
				}
				
			} else {
				return Global.rootUrl + "/data/config/" + this.id;
			}
		},

		defaults: {
			"cache": true,
			"selected-countries": [],
			"tabs": [ "chart", "data", "sources" ],
			"line-type": "2",
			"chart-description": "",
			"chart-dimensions": [],
			"variables": [],
			"y-axis": {},
			"x-axis": {},
			"margins": { top: 10, left: 60, bottom: 10, right: 10 },
			"units": "",
			"iframe-width": "100%",
			"iframe-height": "660px",
			"hide-legend": false,
			"group-by-variables": false,
			"add-country-mode": "add-country",
			"x-axis-scale-selector": false,
			"y-axis-scale-selector": false,
			"map-config": {
				"variableId": -1,
				"minYear": 1980,
				"maxYear": 2000,
				"targetYear": 1980,
				"mode": "specific",
				"timeTolerance": 10,
				"timeInterval": 10,
				"colorSchemeName": "BuGn",
				"colorSchemeInterval": 5,
				"projection": "World",
			}
		},

		initialize: function() {

			this.on( "sync", this.onSync, this );
		
		},

		onSync: function() {

			if( this.get( "chart-type" ) == 2 ) {
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

			//make sure we're using object, not associative array
			/*if( $.isArray( this.get( "selected-countries" ) ) ) {
				//we got empty array from db, convert to object
				this.set( "selected-countries", {} );
			}*/
			
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

		removeSelectedCountry: function( countryId ) {

			var country = this.findCountryById( countryId );
			if( country ) {
				var selectedCountries = this.get( "selected-countries" ),
					countryIndex = _.indexOf( selectedCountries, country );
				selectedCountries.splice( countryIndex, 1 );
				this.trigger( "change:selected-countries" );
				this.trigger( "change" );
			}

		},

		replaceSelectedCountry: function( country ) {
			if( country ) {
				this.set( "selected-countries", [ country ] );
			}
		},

		findCountryById: function( countryId ) {

			var selectedCountries = this.get( "selected-countries" ),
				country = _.findWhere( selectedCountries, { id: countryId.toString() } );
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

		updateMapConfig: function( propName, propValue, silent, eventName ) {

			var mapConfig = this.get( "map-config" );
			if( mapConfig.hasOwnProperty( propName ) ) {
				mapConfig[ propName ] = propValue;
				if( !silent ) {
					var evt = ( eventName )? eventName: "change";
					this.trigger( evt );
				}
			}

		}


	} );

	module.exports = App.Models.ChartModel;

})();
},{}],5:[function(require,module,exports){
;( function() {
	
	"use strict";

	var ChartView = require( "./App.Views.ChartView.js" );

	App.Views.Chart = Backbone.View.extend({

		events: {},

		initialize: function() {},

		start: function() {
			//render everything for the first time
			this.render();
		},

		render: function() {
			
			var dispatcher = _.clone( Backbone.Events );
			this.dispatcher = dispatcher;

			this.chartView = new ChartView( { dispatcher: dispatcher } );
			
		}

	});

	module.exports = App.Views.Chart;

})();

},{"./App.Views.ChartView.js":6}],6:[function(require,module,exports){
;( function() {
	
	"use strict";

	var Header = require( "./chart/App.Views.Chart.Header.js" ),
		ScaleSelectors = require( "./chart/App.Views.Chart.ScaleSelectors" ),
		ChartTab = require( "./chart/App.Views.Chart.ChartTab.js" ),
		DataTab = require( "./chart/App.Views.Chart.DataTab.js" ),
		SourcesTab = require( "./chart/App.Views.Chart.SourcesTab.js" ),
		MapTab = require( "./chart/App.Views.Chart.MapTab.js" ),
		ChartDataModel = require( "./../models/App.Models.ChartDataModel.js" ),
		Utils = require( "./../App.Utils.js" );

	App.Views.ChartView = Backbone.View.extend({

		el: "#chart-view",
		events: {
			"click .chart-save-png-btn": "exportContent",
			"click .chart-save-svg-btn": "exportContent"
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			
			var childViewOptions = { dispatcher: this.dispatcher, parentView: this };
			this.header = new Header( childViewOptions );
			this.scaleSelectors = new ScaleSelectors( childViewOptions );
			//tabs
			this.chartTab = new ChartTab( childViewOptions );
			this.dataTab = new DataTab( childViewOptions );
			this.sourcesTab = new SourcesTab( childViewOptions );
			this.mapTab = new MapTab( childViewOptions );

			//setup model that will fetch all the data for us
			this.dataModel = new ChartDataModel();
			
			//setup events
			this.dataModel.on( "sync", this.onDataModelSync, this );
			this.dataModel.on( "error", this.onDataModelError, this );
			App.ChartModel.on( "change", this.onChartModelChange, this );

			this.render();

		},

		render: function() {

			var that = this;

			this.$preloader = this.$el.find( ".chart-preloader" );
			this.$error = this.$el.find( ".chart-error" );

			//chart tab
			this.$svg = this.$el.find( "#chart-chart-tab svg" );
			this.$tabContent = this.$el.find( ".tab-content" );
			this.$tabPanes = this.$el.find( ".tab-pane" );
			this.$chartHeader = this.$el.find( ".chart-header" );
			this.$entitiesSelect = this.$el.find( "[name=available_entities]" );
			this.$chartFooter = this.$el.find( ".chart-footer" );
			this.$chartName = this.$el.find( ".chart-name" );
			this.$chartSubname = this.$el.find( ".chart-subname" );
			this.$chartDescription = this.$el.find( ".chart-description" );
			this.$chartSources = this.$el.find( ".chart-sources" );
			this.$chartFullScreen = this.$el.find( ".fancybox-iframe" );

			this.$xAxisScaleSelector = this.$el.find( ".x-axis-scale-selector" );
			this.$xAxisScale = this.$el.find( "[name=x_axis_scale]" );
			this.$yAxisScaleSelector = this.$el.find( ".y-axis-scale-selector" );
			this.$yAxisScale = this.$el.find( "[name=y_axis_scale]" );

			this.$reloadBtn = this.$el.find( ".reload-btn" );

			var chartName = App.ChartModel.get( "chart-name" ),
				addCountryMode = App.ChartModel.get( "add-country-mode" ),
				formConfig = App.ChartModel.get( "form-config" ),
				entities = ( formConfig && formConfig[ "entities-collection" ] )? formConfig[ "entities-collection" ]: [],
				selectedCountries = App.ChartModel.get( "selected-countries" ),
				selectedCountriesIds = _.map( selectedCountries, function( v ) { return (v)? +v.id: ""; } ),
				chartTime = App.ChartModel.get( "chart-time" );
				
			//might need to replace country in title, if "change country" mode
			if( addCountryMode === "change-country" ) {
				//yep, probably need replacing country in title (select first country form stored one)
				if( selectedCountries && selectedCountries.length ) {
					var country = selectedCountries[0];
					chartName = chartName.replace( "*country*", country.name );
				}
			}

			//update values
			this.$chartName.text( chartName );
			this.$chartSubname.html( App.ChartModel.get( "chart-subname" ) );

			var chartDescription = App.ChartModel.get( "chart-description" );
			//this.$chartDescription.text( App.ChartModel.get( "chart-description" ) );

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

			//update countries
			this.$entitiesSelect.empty();
			if( selectedCountriesIds.length ) {
				//append empty default option
				that.$entitiesSelect.append( "<option disabled selected>Select country</option>" );
				_.each( entities, function( d, i ) {
					//add only those entities, which are not selected already
					if( _.indexOf( selectedCountriesIds, +d.id ) == -1 ) {
						that.$entitiesSelect.append( "<option value='" + d.id + "'>" + d.name + "</option>" );
					}
				} );
			}
			//make chosen update, make sure it looses blur as well
			this.$entitiesSelect.trigger( "chosen:updated" );

			this.$chartFullScreen.on( "click", function( evt ) {
				evt.preventDefault();
				var $this = $( this );
				window.parent.openFancyBox( $this.attr( "href" ) );
			} );

			//refresh btn
			this.$reloadBtn.on( "click", function( evt ) {
				evt.preventDefault();
				window.location.reload();
			} );

			//chart tab
			this.$chartTab = this.$el.find( "#chart-chart-tab" );

			var dimensionsString = App.ChartModel.get( "chart-dimensions" ),
				validDimensions = false;
			
			//clicking anything in chart source will take you to sources tab
			this.$chartSources.on( "click", function(evt) {
				evt.preventDefault();
				var $a = $( "[href='#sources-chart-tab']" );
				$a.trigger( "click" );
			} );

			//check we have all dimensions necessary 
			if( !$.isEmptyObject( dimensionsString ) ) {
				var dimension = $.parseJSON( dimensionsString );
				validDimensions = Utils.checkValidDimensions( dimension, App.ChartModel.get( "chart-type" ));
			}

			//make sure to appear only first tab tabs that are necessary
			//appear only first tab if none visible
			if( !this.$tabPanes.filter( ".active" ).length ) {
				var tabs = App.ChartModel.get( "tabs" ),
					firstTabName = tabs[ 0 ],
					firstTabPane = this.$tabPanes.filter( "#" + firstTabName + "-chart-tab" );
				firstTabPane.addClass( "active" );
				if( firstTabName === "map" ) {
					//map tab needs special inialitization
					this.mapTab.display();
				}
			}
			
			if( !validDimensions ) {
				return false;
			}

			if( dimensionsString ) {

				this.$preloader.show();

				var dataProps = { "dimensions": dimensionsString, "chartId": App.ChartModel.get( "id" ), "chartType": App.ChartModel.get( "chart-type" ), "selectedCountries": selectedCountriesIds, "chartTime": chartTime, "cache": App.ChartModel.get( "cache" ), "groupByVariables": App.ChartModel.get( "group-by-variables" )  };
				
				this.dataModel.fetch( { data: dataProps } );

			} else {

				//clear any previous chart
				$( "svg" ).empty();

			}

		},

		onChartModelChange: function( evt ) {

			this.render();
			
		},

		onDataModelSync: function( model, response ) {
			this.$error.hide();
			this.$preloader.hide();
			if( response.data ) {
				this.updateChart( response.data, response.timeType, response.dimensions );
			}
			this.sourcesTab.render( response );
		},

		onDataModelError: function() {
			this.$error.show();
			this.$preloader.hide();
		},

		exportContent: function( evt ) {
			
			//http://stackoverflow.com/questions/23218174/how-do-i-save-export-an-svg-file-after-creating-an-svg-with-d3-js-ie-safari-an
			var $btn = $( evt.currentTarget ),
				//store pre-printing svg
				$oldEl = this.$el,
				$newEl = $oldEl.clone(),
				isSvg = ( $btn.hasClass( "chart-save-svg-btn" ) )? true: false;
			
			$oldEl.replaceWith( $newEl );

			//grab all svg
			var $svg = $newEl.find( "svg" ),
				svg = $svg.get( 0 ),
				svgString = svg.outerHTML;

			//add printing styles
			$svg.attr( "class", "nvd3-svg export-svg" );

			//inline styles for the export
			var styleSheets = document.styleSheets;
			for( var i = 0; i < styleSheets.length; i++ ) {
				Utils.inlineCssStyle( styleSheets[ i ].cssRules );
			}

			//depending whether we're creating svg or png, 
			if( isSvg ) {

				var serializer = new XMLSerializer(),
				source = serializer.serializeToString(svg);
				//add name spaces.
				if(!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){
					source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
				}
				if(!source.match(/^<svg[^>]+"http\:\/\/www\.w3\.org\/1999\/xlink"/)){
					source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
				}
				
				//add xml declaration
				source = '<?xml version="1.0" standalone="no"?>\r\n' + source;

				//convert svg source to URI data scheme.
				var url = "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(source);
				$btn.attr( "href", url );

			} else {

				var $svgCanvas = $( ".nvd3-svg" );
				if( $svgCanvas.length ) {
					
					saveSvgAsPng( $( ".nvd3-svg" ).get( 0 ), "chart.png");

					//temp hack - remove image when exporting to png
					/*var $svgLogo = $( ".chart-logo-svg" );
					$svgLogo.remove();

					saveSvgAsPng( $( ".nvd3-svg" ).get( 0 ), "chart.png");
					
					$svg.prepend( $svgLogo );*/
					
				}

			}
			
			//add back the printed svg
			$newEl.replaceWith( $oldEl );
			//refresh link
			$oldEl.find( ".chart-save-svg-btn" ).on( "click", $.proxy( this.exportContent, this ) );

		},

		updateChart: function( data, timeType, dimensions ) {

			this.chartTab.render( data, timeType, dimensions );
		
		},
	
		onResize: function() {
			
			//compute how much space for chart
			var svgWidth = this.$svg.width(),
				svgHeight = this.$svg.height(),
				chartType = App.ChartModel.get( "chart-type" ),
				$chartNameSvg = this.$el.find( ".chart-name-svg" ),
				$chartSubnameSvg = this.$el.find( ".chart-subname-svg" ),
				$chartDescriptionSvg = this.$el.find( ".chart-description-svg" ),
				$chartSourcesSvg = this.$el.find( ".chart-sources-svg" ),
				chartHeaderHeight = this.$chartHeader.height(),
				margins = App.ChartModel.get( "margins" ),
				topChartMargin = 30,
				bottomChartMargin = 60,
				currY, footerDescriptionHeight, footerSourcesHeight, chartHeight;

			this.$tabContent.height( $( ".chart-wrapper-inner" ).height() - this.$chartHeader.height() );

			//wrap header text
			Utils.wrap( $chartNameSvg, svgWidth );
			currY = parseInt( $chartNameSvg.attr( "y" ), 10 ) + $chartNameSvg.outerHeight() + 20;
			$chartSubnameSvg.attr( "y", currY );
			
			//wrap description
			Utils.wrap( $chartSubnameSvg, svgWidth );

			//start positioning the graph, according 
			currY = chartHeaderHeight;

			var translateY = currY;
			
			this.$svg.height( this.$tabContent.height() + currY );

			//update stored height
			svgHeight = this.$svg.height();

			//add height of legend
			//currY += this.chart.legend.height();
			if( !App.ChartModel.get( "hide-legend" ) ) {
				currY += this.chartTab.legend.height();
			}
			
			//position chart
			Utils.wrap( $chartDescriptionSvg, svgWidth );
			footerDescriptionHeight = $chartDescriptionSvg.height();
			Utils.wrap( $chartSourcesSvg, svgWidth );
			footerSourcesHeight = $chartSourcesSvg.height();

			var footerHeight = this.$chartFooter.height();

			//set chart height
			chartHeight = svgHeight - translateY - footerHeight - bottomChartMargin;
			if( !App.ChartModel.get( "hide-legend" ) ) {
				chartHeight -= this.chartTab.legend.height();
			}

			//reflect margin top and down in chartHeight
			chartHeight = chartHeight - margins.bottom - margins.top;

			//position footer
			$chartDescriptionSvg.attr( "y", currY + chartHeight + bottomChartMargin );
			Utils.wrap( $chartDescriptionSvg, svgWidth );
			$chartSourcesSvg.attr( "y", parseInt( $chartDescriptionSvg.attr( "y" ), 10 ) + $chartDescriptionSvg.height() + footerDescriptionHeight/3 );
			Utils.wrap( $chartSourcesSvg, svgWidth );
			
			//compute chart width
			var chartWidth = svgWidth - margins.left - margins.right;
			this.chartTab.chart.width( chartWidth );
			this.chartTab.chart.height( chartHeight );

			//need to call chart update for resizing of elements within chart
			if( this.$chartTab.is( ":visible" ) ) {
				this.chartTab.chart.update();
			}
			
			if( chartType === "3" ) {
				//for stacked area chart, need to manually adjust height
				var currIntLayerHeight = this.chartTab.chart.interactiveLayer.height(),
					//TODO - do not hardcode this
					heightAdd = 150;
				this.chartTab.chart.interactiveLayer.height( currIntLayerHeight + heightAdd );
				d3.select(".nv-interactive").call(this.chartTab.chart.interactiveLayer);
			}
			
			if( !App.ChartModel.get( "hide-legend" ) ) {
				//position legend
				var legendMargins = this.chartTab.legend.margin();
				currY = currY - this.chartTab.legend.height();
				this.translateString = "translate(" + legendMargins.left + " ," + currY + ")";
				this.$svg.find( "> .nvd3.nv-custom-legend" ).attr( "transform", this.translateString );
			}

			this.$svg.css( "transform", "translate(0,-" + chartHeaderHeight + "px)" );

			//for multibarchart, need to move controls bit higher
			if( chartType === "4" || chartType === "5" ) {
				d3.select( ".nv-controlsWrap" ).attr( "transform", "translate(0,-25)" );
			}

			//reflect margin top in currY
			if( !App.ChartModel.get( "hide-legend" ) ) {
				currY += +this.chartTab.legend.height();
			}
			currY += +margins.top;

			var $wrap = this.$svg.find( "> .nvd3.nv-wrap" );

			//manually reposition chart after update
			//this.translateString = "translate(" + margins.left + "," + currY + ")";
			this.translateString = "translate(" + margins.left + "," + currY + ")";
			$wrap.attr( "transform", this.translateString );
			
			//position scale dropdowns - TODO - isn't there a better way then with timeout?
			var that = this;
			setTimeout( function() {
			
				var wrapOffset = $wrap.offset(),
					chartTabOffset = that.$chartTab.offset(),
					marginLeft = parseInt( margins.left, 10 ),
					//dig into NVD3 chart to find background rect that has width of the actual chart
					backRectWidth = parseInt( $wrap.find( "> g > rect" ).attr( "width" ), 10 ),
					offsetDiff = wrapOffset.top - chartTabOffset.top,
					//empiric offset
					xScaleOffset = 10,
					yScaleOffset = -5;

				//fallback for scatter plot where backRectWidth has no width
				if( isNaN( backRectWidth ) ) {
					backRectWidth = parseInt( $(".nv-x.nv-axis.nvd3-svg").get(0).getBoundingClientRect().width, 10 );
				}

				that.$xAxisScaleSelector.css( { "top": offsetDiff + chartHeight, "left": marginLeft + backRectWidth + xScaleOffset } );
				that.$yAxisScaleSelector.css( { "top": offsetDiff - 15, "left": marginLeft + yScaleOffset } );
				
			}, 250 );
			
		}

	});
	
	module.exports = App.Views.ChartView;

})();
},{"./../App.Utils.js":1,"./../models/App.Models.ChartDataModel.js":3,"./chart/App.Views.Chart.ChartTab.js":7,"./chart/App.Views.Chart.DataTab.js":8,"./chart/App.Views.Chart.Header.js":9,"./chart/App.Views.Chart.MapTab.js":11,"./chart/App.Views.Chart.ScaleSelectors":12,"./chart/App.Views.Chart.SourcesTab.js":13}],7:[function(require,module,exports){
;( function() {
	
	"use strict";

	var Legend = require( "./App.Views.Chart.Legend.js" );

	App.Views.Chart.ChartTab = Backbone.View.extend( {

		cachedColors: [],
		el: "#chart-view",
		events: {
			"change [name=available_entities]": "onAvailableCountries"
		},

		initialize: function( options ) {

			this.dispatcher = options.dispatcher;
			this.parentView = options.parentView;

			this.$svg = this.$el.find( "#chart-chart-tab svg" );
			this.$entitiesSelect = this.$el.find( "[name=available_entities]" );
			
		},

		render: function( data, timeType, dimensions ) {
			
			if( !data ) {
				return;
			}
			
			var that = this;

			//make local copy of data for our filtering needs
			var localData = $.extend( true, localData, data );

			var chartType = App.ChartModel.get( "chart-type" );

			//filter data for selected countries
			var selectedCountries = App.ChartModel.get( "selected-countries" ),
				selectedCountriesById = [],
				selectedCountriesIds = _.map( selectedCountries, function(v) {
					//store 
					selectedCountriesById[ v.id ] = v;
					return +v.id;
				} );

			if( selectedCountries && selectedCountriesIds.length && !App.ChartModel.get( "group-by-variables" ) ) {
				
				//set local copy of countries color, to be able to create brighter
				var countriesColors = [];
				localData = _.filter( localData, function( value, key, list ) {
					//set color while in the loop
					var id = value.id;
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
					
					//actual filtering
					return ( _.indexOf( selectedCountriesIds, id ) > -1 );
				} );
			} else {
				//TODO - nonsense? convert associative array to array, assign colors from cache
				localData = _.map( localData, function( value ) {
					value = that.assignColorFromCache( value );
					return value;
				} );
			}

			var discreteData;
			if( chartType == "6" ) {
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
						return ( parseInt( value.time, 10 ) >= timeFrom && parseInt( value.time, 10 ) <= timeTo );
						//return ( value.x >= timeFrom && value.x <= timeTo );
					} );
					singleData.values = values;
				} );

			}

			//if legend displayed, sort data on key alphabetically (usefull when multivarian dataset)
			if( !App.ChartModel.get( "hide-legend" ) ) {
				localData = _.sortBy( localData, function( obj ) { return obj.key; } );
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

			nv.addGraph(function() {

				var chartOptions = {
					transitionDuration: 300,
					margin: { top:0, left:50, right:30, bottom:0 },// App.ChartModel.get( "margins" ),
					showLegend: false
				};

				//line type
				var lineType = App.ChartModel.get( "line-type" );
				if( lineType == 2 ) {
					chartOptions.defined = function( d ) { return d.y !== 0; };
				}
				if( lineType == 0 ) {
					that.$el.addClass( "line-dots" );
				} else {
					that.$el.removeClass( "line-dots" );
				}

				//depending on chart type create chart
				if( chartType == "1" ) {
					
					//line chart
					that.chart = nv.models.lineChart().options( chartOptions );
				
				} else if( chartType == "2" ) {
					
					//scatter plot
					var points = that.scatterBubbleSize();
					that.chart = nv.models.scatterChart().options( chartOptions ).pointRange( points ).showDistX( true ).showDistY( true );
					
				} else if( chartType == "3" ) {
					
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
						.options( chartOptions )
						.controlOptions( [ "Stacked", "Expanded" ] )
						.useInteractiveGuideline( true )
						.x( function( d ) { return d[ "x" ]; } )
						.y( function( d ) { return d[ "y" ]; } );
			
				} else if( chartType == "4" || chartType == "5" ) {

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

					if( chartType == "4" ) {
					
						that.chart = nv.models.multiBarChart().options( chartOptions );
					
					} else if(  chartType == "5" ) {
					
						that.chart = nv.models.multiBarHorizontalChart().options( chartOptions );//.showValues( true );
					
					}

				} else if( chartType == "6" ) {

					chartOptions.showValues = true;

					that.chart = nv.models.discreteBarChart()
						.x( function( d ) { return d.x; } )
						.y( function( d ) { return d.y; } )
						.options( chartOptions );

				}

				//fixed probably a bug in nvd3 with previous tooltip not being removed
				d3.select( ".xy-tooltip" ).remove();

				that.chart.xAxis
					.axisLabel( xAxis[ "axis-label" ] )
					//.staggerLabels( true )
					.axisLabelDistance( xAxisLabelDistance )
					.tickFormat( function(d) {
						if( chartType != 2 ) {
							//x axis has time information
							return App.Utils.formatTimeLabel( timeType, d, xAxisPrefix, xAxisSuffix, xAxisFormat );
						} else {
							//is scatter plot, x-axis has some other information
							return xAxisPrefix + d3.format( "," )( App.Utils.formatValue( d, xAxisFormat ) ) + xAxisSuffix;
						}
					} );

				if( timeType == "Quarter Century" ) {
					that.chart.xAxis.staggerLabels( true );
				}
				
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
				if( yAxisMin && !isNaN( yAxisMin ) ) {
					yDomain[ 0 ] = yAxisMin;
					isClamped = true;
				} else {
					//default is zero (don't do it for stack bar chart, messes up things)
					if( chartType != "3" ) {
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
						that.chart.forceX( xDomain );
						that.chart.forceY( yDomain );
					}

					/*that.chart.xDomain( xDomain );
					that.chart.yDomain( yDomain );
					that.chart.xScale().clamp( true );
					that.chart.yScale().clamp( true );*/
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
				if( chartType === "2" ) {
					//hardcode
					that.chart.xAxis.ticks( 7 );
					that.chart.yAxis.ticks( 7 );
				}
				
				var svgSelection = d3.select( that.$svg.selector )
					.datum( localData )
					.call( that.chart );
				
				if( chartType !== "3" ) {

					that.chart.tooltip.contentGenerator( App.Utils.contentGenerator );

				} else {

					//set popup
					var unitsString = App.ChartModel.get( "units" ),
						units = ( !$.isEmptyObject( unitsString ) )? $.parseJSON( unitsString ): {},
						string = "",
						valuesString = "";

					//d3.format with added params to add arbitrary string at the end
					var customFormatter = function( formatString, suffix ) {
						var func = d3.format( formatString );
						return function( d, i ) {
							return func( d ) + suffix;
						};
					};

					//different popup setup for stacked area chart
					var unit = _.findWhere( units, { property: "y" } );
					if( unit && unit.format ) {
						var fixed = Math.min( 20, parseInt( unit.format, 10 ) ),
							unitName = ( unit.unit )? " " + unit.unit: "";
						that.chart.interactiveLayer.tooltip.valueFormatter( customFormatter("." + fixed + "f", unitName ) );
						//that.chart.interactiveLayer.tooltip.valueFormatter( d3.format("." + fixed + "f" ) );
					}
					
				}
				
				//set legend
				if( !App.ChartModel.get( "hide-legend" ) ) {
					//make sure wrapper is visible
					that.$svg.find( "> .nvd3.nv-custom-legend" ).show();
					that.legend = new Legend( that.chart.legend ).vers( "owd" );
					that.legend.dispatch.on( "removeEntity", function( id ) {
						that.onRemoveEntity( id );
					} );
					that.legend.dispatch.on( "addEntity", function() {
						if( that.$entitiesSelect.data( "chosen" ) ) {
							that.$entitiesSelect.data( "chosen" ).active_field = false;
						}
						//trigger open the chosen drop down
						that.$entitiesSelect.trigger( "chosen:open" );
					} );
					svgSelection.call( that.legend );
					//put legend above chart


				} else {
					//no legend, remove what might have previously been there
					that.$svg.find( "> .nvd3.nv-custom-legend" ).hide();
				}
				
				var onResizeCallback = _.debounce( function(e) {
					//invoke resize of legend, if there's one, scatter plot doesn't have any by default
					if( that.legend ) {
						svgSelection.call( that.legend );
					}
					that.parentView.onResize();
				}, 150 );
				nv.utils.windowResize( onResizeCallback );
						
				that.parentView.onResize();

				var stateChangeEvent = ( chartType !== "6" )? "stateChange": "renderEnd";
				that.chart.dispatch.on( stateChangeEvent, function( state ) {
					//refresh legend;
					svgSelection.call( that.legend );

					//
					if( chartType === "3" ) {
						that.checkStackedAxis();
					}

					//TODO - ugly! needs timeout and reaching to chartview  
					setTimeout( function() {
						that.parentView.onResize();
					}, 1);
				} );
				that.parentView.dataTab.render( data, localData, dimensions );
				
				if( chartType == "2" ) {
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
				
				//that.scaleSelectors.initEvents();
				var chartDimensionsString = App.ChartModel.get( "chart-dimensions" );
				if( chartDimensionsString.indexOf( '"property":"color"' ) === -1 ) {
					//check if string does not contain "property":"color"
					that.cacheColors( localData );
				}

			});

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

		onRemoveEntity: function( id ) {

			var selectedCountries = App.ChartModel.get( "selected-countries" ),
				countriesIds = _.keys( selectedCountries ),
				addCountryMode = App.ChartModel.get( "add-country-mode" );

			if( countriesIds.length === 0 ) {
				//removing from empty selection, need to copy all countries available into selected countries selection
				var entitiesCollection = [],
				//var entitiesCollection = {},
					formConfig = App.ChartModel.get( "form-config" );
				if( formConfig && formConfig[ "entities-collection" ] ) {
					_.map( formConfig[ "entities-collection" ], function( d, i ) { entitiesCollection[ d.id ] = d; } );
					//deep copy array
					var entitiesCopy =  $.extend( true, [], formConfig[ "entities-collection" ] );
					App.ChartModel.set( "selected-countries", entitiesCopy );
				}
			}
			App.ChartModel.removeSelectedCountry( id );

		},

		onAvailableCountries: function( evt ) {

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

		cacheColors: function( data ) {
			if( !this.cachedColors.length ) {
				var that = this;
				_.each( data, function( v, i ) {
					that.cachedColors[ v.id ] = v.color;
				} );
			}
		},

		assignColorFromCache: function( value ) {
			if( this.cachedColors.length ) {
				//assing color frome cache
				if( this.cachedColors[ value.id ] ) {
					value.color = this.cachedColors[ value.id ];
				} else {
					var randomColor = App.Utils.getRandomColor();
					value.color = randomColor;
					this.cachedColors[ value.id ] = randomColor;
				}
			}
			return value;
		}
		
	} );

	module.exports = App.Views.Chart.ChartTab;

})();
},{"./App.Views.Chart.Legend.js":10}],8:[function(require,module,exports){
;( function() {
	
	"use strict";

	App.Views.Chart.DataTab = Backbone.View.extend( {

		el: "#chart-view",
		events: {},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;

			//data tab
			this.$dataTab = this.$el.find( "#data-chart-tab" );
			this.$downloadBtn = this.$dataTab.find( ".download-data-btn" );
			this.$dataTableWrapper = this.$dataTab.find( ".data-table-wrapper" );

		},

		render: function( data, localData, dimensions ) {
			
			this.$dataTableWrapper.empty();

			//update link
			var that = this,
				chartType = App.ChartModel.get( "chart-type" ),
				hasMultipleColumns = ( App.ChartModel.get( "group-by-variables" ) && chartType !== "3" )? true: false;/*,
				baseUrl = this.$downloadBtn.attr( "data-base-url" ),
				dimensionsUrl = encodeURIComponent( dimensionsString );*/
			//this.$downloadBtn.attr( "href", baseUrl + "?dimensions=" + dimensionsUrl + "&chartType=" + chartType + "&export=csv" );
			this.$downloadBtn.on( "click", function( evt ) {

				evt.preventDefault();

				var data = [],
					$trs = that.$el.find( "tr" );
				$.each( $trs, function( i, v ) {

					var trData = [],
						$tr = $( this ),
						$cells = $tr.find( "th, td" );
					
					$.each( $cells, function( i2, v2 ) {
						trData.push( $( v2 ).text() );
					} );

					data.push( trData );

				} );

				var csvString = "data:text/csv;charset=utf-8,";
				_.each( data, function( v, i ) {
					var dataString = v.join(",");
					csvString += ( i < data.length )? dataString+ "\n" : dataString;
				} );
				
				var encodedUri = encodeURI( csvString );
				window.open( encodedUri );

			} );

			//get all times
			var timesObj = [],
				times = [];
			_.each( data, function( entityData, entityId ) {

				var values = entityData.values,
					valuesByTime = [];

				_.each( values, function( value ) {

					//store given time as existing
					var time = value.time;
					if( !timesObj[ time ] ) {
						timesObj[ time ] = true;
						times.push( time );
					}

					//re-map values by time key
					valuesByTime[ time ] = value;

				} );

				entityData.valuesByTime = valuesByTime;

			} );

			//sort gathered times
			times = _.sortBy( times, function( v ) { return +v; } );
			
			//create first row
			var tableString = "<table class='data-table'>",
				tr = "<tr><td><strong> </strong></td>";
			_.each( times, function( time ) {

				//create column for every dimension
				_.each( dimensions, function( dimension, i ) {
					if( i === 0 || hasMultipleColumns ) {
						var th = "<th>";
						th += time;
						if( dimensions.length > 1 && hasMultipleColumns ) {
							//we have more than one dimension, need to distinguish them in 
							th += " - " + dimension.variableName;
						}
						th += "</th>";
						tr += th;
					}
				});

			} );
			tr += "</tr>";
			tableString += tr;

			_.each( data, function( entityData, entityId ) {

				var tr = "<tr>",
					//add name of entity
					td = "<td><strong>" + entityData.key + "</strong></td>";
				tr += td;

				var valuesByTime = entityData.valuesByTime;
				_.each( times, function( time ) {
					
					//create column for every dimension
					_.each( dimensions, function( dimension, i ) {
						if( i === 0 || hasMultipleColumns ) {
							var td = "<td>",
								tdValue = "";
							//is there value for given time
							if( valuesByTime[ time ] ) {
								if( !valuesByTime[ time ].fake ) {
									tdValue = valuesByTime[ time ][ dimension.property ];
								} else {
									//just dummy values for correct rendering of chart, don't add into table
									tdValue = "";
								}
								
							}
							td += tdValue;
							td += "</td>";
							tr += td;
						}
					} );
				
				} );
				
				tr += "</tr>";
				tableString += tr;

			} );

			tableString += "</table>";

			var $table = $( tableString );
			this.$dataTableWrapper.append( $table );


		}

	} );
	
	module.exports = App.Views.Chart.DataTab;

})();
},{}],9:[function(require,module,exports){
;( function() {
	
	"use strict";

	App.Views.Chart.Header = Backbone.View.extend({

		el: "#chart-view .chart-header",
		events: {},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			
			this.$tabs = this.$el.find( ".header-tab" );
			this.render();

			//setup events
			App.ChartModel.on( "change", this.render, this );

		},

		render: function() {
			
			var tabs = App.ChartModel.get( "tabs" );
			
			//hide first everything
			this.$tabs.hide();

			var that = this;
			_.each( tabs, function( v, i ) {
				var tab = that.$tabs.filter( "." + v + "-header-tab" );
				tab.show();
				if( i === 0 ) {
					tab.addClass( "active" );
				}
			} );

		}

	});

	module.exports = App.Views.Chart.Header;

})();
},{}],10:[function(require,module,exports){
;( function() {
	
	"use strict";
	
	App.Views.Chart.Legend = function( chartLegend ) {
	
		//based on https://github.com/novus/nvd3/blob/master/src/models/legend.js

		//============================================================
		// Public Variables with Default Settings
		//------------------------------------------------------------

		var chartType = App.ChartModel.get( "chart-type" )
			, margin = {top: 5, right: 50, bottom: 5, left: 62}
			, width = 800
			, height = 20
			, getKey = function(d) { return d.key }
			, color = nv.utils.getColor()
			, align = true
			, padding = 40 //define how much space between legend items. - recommend 32 for furious version
			, rightAlign = false
			, updateState = true   //If true, legend will update data.disabled and trigger a 'stateChange' dispatch.
			, radioButtonMode = false   //If true, clicking legend items will cause it to behave like a radio button. (only one can be selected at a time)
			, expanded = false
			, dispatch = d3.dispatch('legendClick', 'legendDblclick', 'legendMouseover', 'legendMouseout', 'stateChange', 'removeEntity', 'addEntity')
			, vers = 'classic' //Options are "classic" and "furious" and "owd"
			;

		function chart(selection) {
			
			selection.each(function(data) {
				
				var $svg = $( "svg.nvd3-svg" ),
					availableWidth = $svg.width() - margin.left - margin.right,
					container = d3.select(this);
				
				nv.utils.initSVG(container);

				var bindableData = data;

				//discrete bar chart needs unpack data
				if( chartType === "6" ) {
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
				
				//add entity label
				var entityLabel = wrap.select( '.nv-entity-label' ),
					entityLabelText = entityLabel.select( 'text' ),
					entityLabelWidth = 0;
				//displaying of entity label is disabled
				/*if( App.ChartModel.get( "add-country-mode" ) === "change-country" ) {
					if( entityLabel.empty() ) {
						entityLabel = wrap.append( 'g' ).attr('class', 'nv-entity-label').attr( 'transform', 'translate(0,15)' );
						entityLabelText = entityLabel.append( 'text' );
					}
					if( data && data[0] && data[0].entity ) {
						entityLabelText.text( data[0].entity + ": " );
						try {
							entityLabelWidth = entityLabelText.node().getComputedTextLength();
							// If the legendText is display:none'd (nodeTextLength == 0), simulate an error so we approximate, instead
							if( entityLabelWidth <= 0 ) throw new Error();
						} catch( e ) {
							entityLabelWidth = nv.utils.calcApproxTextWidth(entityLabelText);
						}
						//add padding for label
						entityLabelWidth += 30;
						availableWidth -= entityLabelWidth;
					}
				} else {
					//make sure there is not label left
					entityLabel.remove();
				}*/
				
				//if not existing, add nv-add-btn, if not grouping by variables
				var addEntityBtn =  wrap.select( 'g.nv-add-btn' );
				if( addEntityBtn.empty() ) {
					addEntityBtn = wrap.append('g').attr('class', 'nv-add-btn');
					addEntityBtn.append('rect').attr( { 'class': 'add-btn-bg', 'width': '100', 'height': '25', 'transform': 'translate(0,-5)' } );
					var addEntityBtnG = addEntityBtn.append('g').attr( { 'class': 'add-btn-path' } );
					addEntityBtnG.append('path').attr( { 'd': 'M15,0 L15,14', 'class': 'nv-box' } );
					addEntityBtnG.append('path').attr( { 'd': 'M8,7 L22,7', 'class': 'nv-box' } );
					//http://android-ui-utils.googlecode.com/hg-history/ac955e6376470d9599ead07b4599ef937824f919/asset-studio/dist/res/clipart/icons/refresh.svg?r=ac955e6376470d9599ead07b4599ef937824f919
					addEntityBtn.append('path').attr( { 'd': 'M160.469,242.194c0-44.414,36.023-80.438,80.438-80.438c19.188,0,36.711,6.844,50.5,18.078L259.78,209.93l99.945,11.367    l0.805-107.242l-30.766,29.289c-23.546-21.203-54.624-34.164-88.804-34.164c-73.469,0-133.023,59.562-133.023,133.016    c0,2.742,0.242-2.266,0.414,0.445l53.68,7.555C161.03,245.108,160.469,247.562,160.469,242.194z M371.647,237.375l-53.681-7.555    c1.017,5.086,1.556,2.617,1.556,7.992c0,44.414-36.008,80.431-80.43,80.431c-19.133,0-36.602-6.798-50.383-17.97l31.595-30.078    l-99.93-11.366l-0.812,107.25l30.789-29.312c23.531,21.141,54.57,34.055,88.688,34.055c73.468,0,133.023-59.555,133.023-133.008    C372.062,235.078,371.812,240.085,371.647,237.375z', 'class': 'nv-box change-btn-path', 'transform': 'scale(.04) translate(150,-50)' } );
					addEntityBtn.append('text').attr( {'x':28,'y':11} ).text('Add country');
					addEntityBtn.on( 'click', function( d, i ) {
						//group by variables
						dispatch.addEntity();
						d3.event.stopImmediatePropagation();
					} );
				}
				//based on selected countries selection hide or show addEntityBtn
				if( _.isEmpty( App.ChartModel.get( "selected-countries" ) ) ) {
					addEntityBtn.attr( "display", "none" );
				} else {
					addEntityBtn.attr( "display", "block" );
				}

				var addCountryMode = App.ChartModel.get( "add-country-mode" );
				if( addCountryMode === "add-country" ) {
				//if( App.ChartModel.get( "group-by-variables" ) ) {
					//if grouping by variable, legend will show variables instead of countries, so add country btn doesn't make sense
					//if enabling adding countries
					//addEntityBtn.attr( "display", "none" );
					addEntityBtn.select( "text" ).text( "Add country" );
					addEntityBtn.select( "rect" ).attr( "width", "100" );
					addEntityBtn.select( ".add-btn-path" ).attr( "display", "block" );
					addEntityBtn.select( ".change-btn-path" ).attr( "display", "none" );
					addEntityBtn.attr( "display", "block" );
				} else if( addCountryMode === "change-country" ) {
					addEntityBtn.select( ".add-btn-path" ).attr( "display", "none" );
					addEntityBtn.select( ".change-btn-path" ).attr( "display", "block" );
					addEntityBtn.select( "text" ).text( "Change country" );
					addEntityBtn.select( "rect" ).attr( "width", "120" );
					addEntityBtn.attr( "display", "block" );
				} else {
					addEntityBtn.attr( "display", "none" );
				}
					
				var seriesEnter = series.enter().append('g').attr('class', 'nv-series'),
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

						if( App.ChartModel.get( "group-by-variables" ) || addCountryMode !== "add-country" ) {
							//if displaying variables, instead of removing, use original version just to turn stuff off
							//original version, when clicking country label just deactivates it
							chartLegend.dispatch.legendClick(d,i);
							// make sure we re-get data in case it was modified
							var data = series.data();
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
							if( id.indexOf( "-" ) > 0 ) {
								id = parseInt( id.split( "-" )[ 0 ], 10 );
							} else {
								id = parseInt( id, 10 );
							}
							dispatch.removeEntity( id );
							return false;

						}

					})
					.on('dblclick', function(d,i) {
						if((vers == 'furious' || vers == 'owd') && expanded) return;
						chartLegend.dispatch.legendDblclick(d,i);
						if (updateState) {
							// make sure we re-get data in case it was modified
							var data = series.data();
							//the default behavior of NVD3 legends, when double clicking one,
							// is to set all other series' to false, and make the double clicked series enabled.
							data.forEach(function(series) {
								series.disabled = true;
								if(vers == 'furious' || vers == 'owd') series.userDisabled = series.disabled;
							});
							d.disabled = false;
							if(vers == 'furious' || vers == 'owd' ) d.userDisabled = d.disabled;
							chartLegend.dispatch.stateChange({
								disabled: data.map(function(d) { return !!d.disabled; })
							});
						}
					});

				seriesRemove.on( 'click', function( d, i ) {

					d3.event.stopImmediatePropagation();
					//remove series straight away, so we don't have to wait for response from server
					series[0][i].remove();
					dispatch.removeEntity( d.id );
					
				} );	

				series.classed('nv-disabled', function(d) { return d.userDisabled; });
				series.exit().remove();

				seriesText
					.attr('fill', setTextColor)
					.text(getKey);

				//TODO: implement fixed-width and max-width options (max-width is especially useful with the align option)
				// NEW ALIGNING CODE, TODO: clean up
				var legendWidth = 0,
					transformX, transformY;
				if (align) {

					var seriesWidths = [];
					series.each( function(d,i) {
						var legendText = d3.select(this).select('text');
						var nodeTextLength;
						try {
							nodeTextLength = legendText.node().getComputedTextLength();
							// If the legendText is display:none'd (nodeTextLength == 0), simulate an error so we approximate, instead
							if(nodeTextLength <= 0) throw Error();
						} catch( e ) {
							nodeTextLength = nv.utils.calcApproxTextWidth(legendText);
						}
						seriesWidths.push(nodeTextLength + padding);
					});

					var seriesPerRow = 0;
					var columnWidths = [];
					legendWidth = 0;

					while( legendWidth < availableWidth && seriesPerRow < seriesWidths.length ) {
						columnWidths[seriesPerRow] = seriesWidths[seriesPerRow];
						legendWidth += seriesWidths[seriesPerRow++];
					}
					if( seriesPerRow === 0 ) seriesPerRow = 1; //minimum of one series per row

					while( legendWidth > availableWidth && seriesPerRow > 1 ) {
						columnWidths = [];
						seriesPerRow--;

						for (var k = 0; k < seriesWidths.length; k++) {
							if (seriesWidths[k] > (columnWidths[k % seriesPerRow] || 0) )
								columnWidths[k % seriesPerRow] = seriesWidths[k];
						}

						legendWidth = columnWidths.reduce(function(prev, cur, index, array) {
							return prev + cur;
						});
					}

					var xPositions = [];
					for (var i = 0, curX = 0; i < seriesPerRow; i++) {
						xPositions[i] = curX;
						curX += columnWidths[i];
					}

					series
						.attr('transform', function(d, i) {
							transformX = xPositions[i % seriesPerRow];
							transformY = (5 + Math.floor(i / seriesPerRow) * versPadding);
							return 'translate(' + transformX + ',' + transformY + ')';
						});

					//position legend as far right as possible within the total width
					if (rightAlign) {
						g.attr('transform', 'translate(' + (width - margin.right - legendWidth) + ',' + margin.top + ')');
					}
					else {
						g.attr('transform', 'translate(' + entityLabelWidth + ',' + margin.top + ')');
					}

					height = margin.top + margin.bottom + (Math.ceil(seriesWidths.length / seriesPerRow) * versPadding);
					
				} else {

					var ypos = 5,
						newxpos = 5,
						maxwidth = 0,
						xpos;
					series
						.attr('transform', function(d, i) {
							var length = d3.select(this).select('text').node().getComputedTextLength() + padding;
							xpos = newxpos;

							if (width < margin.left + margin.right + xpos + length) {
								newxpos = xpos = 5;
								ypos += versPadding;
							}

							newxpos += length;
							if (newxpos > maxwidth) maxwidth = newxpos;

							if(legendWidth < xpos + maxwidth) {
								legendWidth = xpos + maxwidth;
							}
							return 'translate(' + xpos + ',' + ypos + ')';
						});

					//position legend as far right as possible within the total width
					g.attr('transform', 'translate(' + (width - margin.right - maxwidth) + ',' + margin.top + ')');

					height = margin.top + margin.bottom + ypos + 15;
				}

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
				if( series.size() ) {

					var seriesArr = series[0];
					if( seriesArr && seriesArr.length ) {
						//fetch last element to know its width
						var lastEl = seriesArr[ seriesArr.length-1 ],
							//need rect inside element that has set width
							lastRect = d3.select( lastEl ).select( "rect" ),
							lastRectWidth = lastRect.attr( "width" );
						//position add btn
						transformX = +transformX + parseInt( lastRectWidth, 10 ) - 3;
						transformX += entityLabelWidth;
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
			align:      {get: function(){return align;}, set: function(_){align=_;}},
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

		nv.utils.initOptions(chart);

		return chart;
	};

	module.exports = App.Views.Chart.Legend;

})();
},{}],11:[function(require,module,exports){
;( function() {
	
	"use strict";

	var MapControls = require( "./map/App.Views.Chart.Map.MapControls.js" );

	App.Views.Chart.MapTab = Backbone.View.extend({

		$tab: null,
		dataMap: null,
		mapControls: null,
		legend: null,

		events: {},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			this.mapControls = new MapControls( { dispatcher: options.dispatcher } );

			//init map only if the map tab displayed
			var that = this;
			$( "[data-toggle='tab'][href='#map-chart-tab']" ).on( "shown.bs.tab", function( evt ) {
				that.display();
			} );
			
		},

		display: function() {
			//render only if no map yet
			if( !this.dataMap ) {
				this.render();
			}
		},

		render: function() {

			var that = this;
			//fetch created dom
			this.$tab = $( "#map-chart-tab" );

			var mapConfig = App.ChartModel.get( "map-config" ),
				defaultProjection = this.getProjection( mapConfig.projection );
			
			this.dataMap = new Datamap( {
				width: that.$tab.width(),
				height: that.$tab.height(),
				responsive: true,
				element: document.getElementById( "map-chart-tab" ),
				geographyConfig: {
					dataUrl: Global.rootUrl + "/js/data/world.ids.json",
					borderWidth: 0.1,
					borderColor: '#4F4F4F',
					highlightBorderColor: 'black',
					highlightBorderWidth: 0.2,
					highlightFillColor: '#FFEC38',
					popupTemplate: that.popupTemplateGenerator
				},
				fills: {
					defaultFill: '#FFFFFF'
					//defaultFill: '#DDDDDD'
				},
				setProjection: defaultProjection,
				//wait for json to load before loading map data
				done: function() {
					that.mapDataModel = new App.Models.ChartDataModel();
					that.mapDataModel.on( "sync", function( model, response ) {
						if( response.data ) {
							that.displayData( response.data );
						}
					} );
					that.mapDataModel.on( "error", function() {
						console.error( "Error loading map data." );
					} );
					that.update();
				}
			} );

			this.legend = new App.Views.Chart.Map.Legend();
			
			App.ChartModel.on( "change", this.onChartModelChange, this );
			App.ChartModel.on( "change-map", this.onChartModelChange, this );
			App.ChartModel.on( "resize", this.onChartModelResize, this );
			
			nv.utils.windowResize( $.proxy( this.onResize, this ) );
			this.onResize();

		},

		onChartModelChange: function( evt ) {

			this.update();

		},

		popupTemplateGenerator: function( geo, data ) {
			//transform datamaps data into format close to nvd3 so that we can reuse the same popup generator
			var mapConfig = App.ChartModel.get( "map-config" );
			var propertyName = App.Utils.getPropertyByVariableId( App.ChartModel, mapConfig.variableId );
			if( !propertyName ) {
				propertyName = "y";
			}
			var obj = {
				point: {
					time: mapConfig.targetYear },
				series: [ {
					key: geo.properties.name
				} ]
			};
			obj.point[ propertyName ] = data.value;
			return [ "<div class='hoverinfo nvtooltip'>" + App.Utils.contentGenerator( obj, true ) + "</div>" ];
		},

		update: function() {
			
			//construct dimension string
			var that = this,
				mapConfig = App.ChartModel.get( "map-config" ),
				chartTime = App.ChartModel.get( "chart-time" ),
				variableId = mapConfig.variableId,
				targetYear = mapConfig.targetYear,
				mode = mapConfig.mode,
				tolerance = mapConfig.timeTolerance,
				dimensions = [{ name: "Map", property: "map", variableId: variableId, targetYear: targetYear, mode: mode, tolerance: tolerance }],
				dimensionsString = JSON.stringify( dimensions ),
				chartType = 9999,
				selectedCountries = App.ChartModel.get( "selected-countries" ),
				selectedCountriesIds = _.map( selectedCountries, function( v ) { return (v)? +v.id: ""; } );
			
			var dataProps = { "dimensions": dimensionsString, "chartId": App.ChartModel.get( "id" ), "chartType": chartType, "selectedCountries": selectedCountriesIds, "chartTime": chartTime, "cache": App.ChartModel.get( "cache" ), "groupByVariables": App.ChartModel.get( "group-by-variables" )  };
			this.mapDataModel.fetch( { data: dataProps } );

			return this;
		},

		displayData: function( data ) {
			
			var that = this,
				mapConfig = App.ChartModel.get( "map-config" ),
				dataMin = Infinity,
				dataMax = -Infinity;

			//need to extract latest time
			var latestData = data.map( function( d, i ) {

				var values = d.values,
					latestTimeValue = ( values && values.length )? values[ values.length - 1]: 0;

				//also get min max values, could use d3.min, d3.max once we have all values, but this probably saves some time
				dataMin = Math.min( dataMin, latestTimeValue );
				dataMax = Math.max( dataMax, latestTimeValue );

				//ids in world json are name countries with underscore (datamaps.js uses id for selector, so cannot have whitespace)
				return { "key": d.key.replace( " ", "_" ), "value": latestTimeValue };

			} );

			var colorScheme = ( colorbrewer[ mapConfig.colorSchemeName ] && colorbrewer[ mapConfig.colorSchemeName ][ mapConfig.colorSchemeInterval ] )? colorbrewer[ mapConfig.colorSchemeName ][ mapConfig.colorSchemeInterval ]: [];
			
			//need to create color scheme
			var colorScale = d3.scale.quantize()
				.domain( [ dataMin, dataMax ] )
				.range( colorScheme );

			//need to encode colors properties
			var mapData = {},
				colors = [];
			latestData.forEach( function( d, i ) {
				var color = colorScale( d.value );
				mapData[ d.key ] = { "key": d.key, "value": d.value, "color": color };
				colors.push( color );
			} );

			this.legend.scale( colorScale );
			if( d3.select( ".legend-wrapper" ).empty() ) {
				d3.select( ".datamap" ).append( "g" ).attr( "class", "legend-wrapper" );
			}
			d3.select( ".legend-wrapper" ).datum( colorScheme ).call( this.legend );
			//d3.select( ".datamap" ).datum( colorScheme ).call( this.legend );

			//update map
			//are we changing projections?
			var oldProjection = this.dataMap.options.setProjection,
				newProjection = this.getProjection( mapConfig.projection );
			if( oldProjection === newProjection ) {
				//projection stays the same, no need to redraw units
				//need to set all units to default color first, cause updateChopleth just updates new data leaves the old data for units no longer in dataset
				d3.selectAll( "path.datamaps-subunit" ).style( "fill", this.dataMap.options.fills.defaultFill );
				this.dataMap.updateChoropleth( mapData );
			} else {
				//changing projection, need to remove existing units, redraw everything and after done drawing, update data
				d3.selectAll('path.datamaps-subunit').remove();
				this.dataMap.options.setProjection = newProjection;
				this.dataMap.draw();
				this.dataMap.options.done = function() {
					that.dataMap.updateChoropleth( mapData );
				};
			}
			
		},

		getProjection: function( projectionName ) {

			var projections = App.Views.Chart.MapTab.projections,
				newProjection = ( projections[ projectionName ] )? projections[ projectionName ]: projections.World;
			return newProjection;
			
		},

		onResize: function() {
			if( this.dataMap ) {
				//instead of calling datamaps resize, there's modified version of the same method
				var options = this.dataMap.options,
					prefix = '-webkit-transform' in document.body.style ? '-webkit-' : '-moz-transform' in document.body.style ? '-moz-' : '-ms-transform' in document.body.style ? '-ms-' : '',
					newsize = options.element.clientWidth,
					oldsize = d3.select( options.element).select('svg').attr('data-width');
					//different selector from default datamaps implementation, doesn't scale legend
					d3.select(options.element).select('svg').selectAll('g:not(.legend-step):not(.legend)').style(prefix + 'transform', 'scale(' + (newsize / oldsize) + ')');
				//this.dataMap.resize();
			}
		},

		onChartModelResize: function() {
			this.onResize();
		}

	});

	App.Views.Chart.MapTab.projections = {
		
		"World": function(element) {
			//empiric
			var k = 6;
			var projection = d3.geo.eckert3()
				.scale(element.offsetWidth/k)
				.translate([element.offsetWidth / 2, element.offsetHeight / 2])
				.precision(.1);
			var path = d3.geo.path().projection(projection);
			return {path: path, projection: projection};
		},
		/*"World": function(element) {
			var projection = d3.geo.equirectangular()
				.scale((element.offsetWidth + 1) / 2 / Math.PI)
				.translate([element.offsetWidth / 2, element.offsetHeight / 1.8]);
			var path = d3.geo.path().projection(projection);
			return {path: path, projection: projection};
		},*/
		"Africa": function(element) {
			//empiric
			var k = 3;
			var projection = d3.geo.conicConformal()
				.rotate([-25, 0])
				.center([0, 0])
				.parallels([30, -20])
				.scale(element.offsetWidth/k)
				.translate([element.offsetWidth / 2, element.offsetHeight / 2]);
			var path = d3.geo.path().projection(projection);
			return {path: path, projection: projection};
		},
		"N.America": function(element) {
			//empiric
			var k = 3;
			var projection = d3.geo.conicConformal()
				.rotate([98, 0])
				.center([0, 38])
				.parallels([29.5, 45.5])
				.scale(element.offsetWidth/k)
				.translate([element.offsetWidth / 2, element.offsetHeight / 2]);
			var path = d3.geo.path().projection(projection);
			return {path: path, projection: projection};
		},
		"S.America": function(element) {
			//empiric
			var k = 3.4;
			var projection = d3.geo.conicConformal()
				.rotate([68, 0])
				.center([0, -14])
				.parallels([10, -30])
				.scale(element.offsetWidth/k)
				.translate([element.offsetWidth / 2, element.offsetHeight / 2]);
			var path = d3.geo.path().projection(projection);
			return {path: path, projection: projection};
		},
		"Asia": function(element) {
			//empiric
			var k = 3;
			var projection = d3.geo.conicConformal()
				.rotate([-105, 0])
				.center([0, 37])
				.parallels([10, 60])
				.scale(element.offsetWidth/k)
				.translate([element.offsetWidth / 2, element.offsetHeight / 2]);
			var path = d3.geo.path().projection(projection);
			return {path: path, projection: projection};
		},
		"Europe": function(element) {
			//empiric
			var k = 1.5;
			var projection = d3.geo.conicConformal()
				.rotate([-15, 0])
				.center([0, 55])
				.parallels([60, 40])
				.scale(element.offsetWidth/k)
				.translate([element.offsetWidth / 2, element.offsetHeight / 2]);
			var path = d3.geo.path().projection(projection);
			return {path: path, projection: projection};
		},
		"Australia": function(element) {
			//empiric
			var k = 3;
			var projection = d3.geo.conicConformal()
				.rotate([-135, 0])
				.center([0, -20])
				.parallels([-10, -30])
				.scale(element.offsetWidth/k)
				.translate([element.offsetWidth / 2, element.offsetHeight / 2]);
			var path = d3.geo.path().projection(projection);
			return {path: path, projection: projection};
		}

	};

	module.exports = App.Views.Chart.MapTab;

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
},{"./map/App.Views.Chart.Map.MapControls.js":14}],12:[function(require,module,exports){
;( function() {
	
	"use strict";

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

			this.initDropDown( this.$xAxisScale );
			this.initDropDown( this.$yAxisScale );

			this.render();

			//setup events
			App.ChartModel.on( "change", this.render, this );

		},

		/*initEvents: function() {
			this.$chartView = $( "#chart-view" );
			this.$wrap = this.$chartView.find( "svg > .nv-wrap" );
			
			var that = this;
			this.$wrap.on( "mouseover", function( evt ) {
				that.$chartView.addClass( "chart-hovered" );
			} );
			this.$wrap.on( "mouseout", function( evt ) {
				console.log( evt.currentTarget );
				that.$chartView.removeClass( "chart-hovered" );
			} );
		},*/

		initDropDown: function( $el ) {

			var $list = $el.find( "ul" ),
				$items = $list.find( "li" );

			$items.on( "click", function( evt ) {
				var $this = $( this ),
					value = $this.attr( "data-value" );
				$items.removeClass( "selected" );
				$this.addClass( "selected" );
				$this.trigger( "change" );
			} );

		},

		onAxisScaleChange: function( evt ) {

			var $li = $( evt.currentTarget ),
				$parent = $li.parent().parent().parent(),
				$div = $parent.find( "div" ),
				$btn = $parent.find( ".axis-scale-btn" ),
				$select = $parent.find( ".axis-scale" ),
				name = $div.attr( "data-name" ),
				axisName = ( name === "x-axis-scale" )? "x-axis": "y-axis",
				axisProp = "axis-scale",
				value = $li.attr( "data-value" );

			App.ChartModel.setAxisConfig( axisName, axisProp, value );
			
			$select.hide();
			//$btn.show();

		},

		onAxisScaleBtn: function( evt ) {
			
			evt.preventDefault();
			var $btn = $( evt.currentTarget ),
				$parent = $btn.parent(),
				$select = $parent.find( ".axis-scale" );

			$select.show();
			//$btn.hide();

		}

	});
	
	module.exports = App.Views.Chart.ScaleSelectors;
	
})();

},{}],13:[function(require,module,exports){
;( function() {
	
	"use strict";

	App.Views.Chart.SourcesTab = Backbone.View.extend( {

		el: "#chart-view",
		events: {},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;

			this.$chartDescription = this.$el.find( ".chart-description" );
			this.$chartSources = this.$el.find( ".chart-sources" );
			this.$sourcesTab = this.$el.find( "#sources-chart-tab" );

		},

		render: function( response ) {

			if( !response || !response.datasources ) {
				return false;
			}

			var sources = response.datasources,
				license = response.license,
				footerHtml = "",
				tabHtml = "",
				descriptionHtml = App.ChartModel.get( "chart-description" ),
				sourcesShortHtml = "Data obtained from: ",
				sourcesLongHtml = "",
				//check that we're not adding sources with the same name more times
				sourcesByName = [];
				
			//construct source html
			_.each( sources, function( sourceData, sourceIndex ) {
				//make sure we don't have source with the same name in the short description already
				if( !sourcesByName[ sourceData.name ] ) {
					if( sourceIndex > 0 ) {
						sourcesShortHtml += ", ";
					}
					if( sourceData.link ) {
						sourcesShortHtml += "<a href='" + sourceData.link + "' target='_blank'>" + sourceData.name + "</a>";
					} else {
						sourcesShortHtml += sourceData.name;
					}
					sourcesByName[ sourceData.name ] = true;
				}
				
				//sources now contain html, so no need to separate with comma
				/*if( sourceIndex > 0 && sourcesLongHtml !== "" && sourceData.description !== "" ) {
					sourcesLongHtml += ", ";
				}*/
				sourcesLongHtml += sourceData.description;
			
			} );

			footerHtml = descriptionHtml;
			tabHtml = descriptionHtml + "<br /><br />" + sourcesLongHtml;
			
			//add license info
			if( license && license.description ) {
				footerHtml = license.description + " " + footerHtml;
				tabHtml = license.description + " " + tabHtml;
			}
			
			//append to DOM
			this.$chartDescription.html( footerHtml );
			this.$chartSources.html( sourcesShortHtml );
			this.$sourcesTab.html( tabHtml );

		}

	} );
	
	module.exports = App.Views.Chart.SourcesTab;

})();
},{}],14:[function(require,module,exports){
;( function() {
	
	"use strict";

	App.Views.Chart.Map.MapControls = Backbone.View.extend({

		el: "#map-chart-tab .map-controls-header",
		events: {
			"input .target-year-control input": "onTargetYearInput",
			"change .target-year-control input": "onTargetYearChange",
			"click .region-control li": "onRegionClick",
			"click .settings-control input": "onSettingsInput",
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

			App.ChartModel.on( "change", this.onChartModelChange, this );
			App.ChartModel.on( "change-map", this.onChartModelChange, this );

			return this.render();
		},

		render: function() {
			
			var mapConfig = App.ChartModel.get( "map-config" );
			
			this.$targetYearLabel.text( mapConfig.targetYear );
			this.$regionControlLabel.text( mapConfig.projection );

			this.$targetYearInput.attr( "min", mapConfig.minYear );
			this.$targetYearInput.attr( "max", mapConfig.maxYear );
			this.$targetYearInput.attr( "step", mapConfig.timeInterval );
			this.$targetYearInput.val( parseInt( mapConfig.targetYear, 10 ) );

			this.$regionControlLis.removeClass( "highlight" );
			this.$regionControlLis.filter( "." + mapConfig.projection + "-projection" ).addClass( "highlight" );

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

		onSettingsInput: function( evt ) {
			var $this = $( evt.target ),
				mode = ( $this.is( ":checked" ) )? "specific": "no-interpolation";
			App.ChartModel.updateMapConfig( "mode", mode, false, "change-map" );
			this.render();
		}

	});

	module.exports = App.Views.Chart.Map.MapControls;

})();
},{}]},{},[2])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9sYXJhdmVsLWVsaXhpci1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC9BcHAuVXRpbHMuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC9DaGFydEFwcC5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL21vZGVscy9BcHAuTW9kZWxzLkNoYXJ0RGF0YU1vZGVsLmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvbW9kZWxzL0FwcC5Nb2RlbHMuQ2hhcnRNb2RlbC5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL0FwcC5WaWV3cy5DaGFydC5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL0FwcC5WaWV3cy5DaGFydFZpZXcuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy9jaGFydC9BcHAuVmlld3MuQ2hhcnQuQ2hhcnRUYWIuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy9jaGFydC9BcHAuVmlld3MuQ2hhcnQuRGF0YVRhYi5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL2NoYXJ0L0FwcC5WaWV3cy5DaGFydC5IZWFkZXIuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy9jaGFydC9BcHAuVmlld3MuQ2hhcnQuTGVnZW5kLmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvY2hhcnQvQXBwLlZpZXdzLkNoYXJ0Lk1hcFRhYi5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL2NoYXJ0L0FwcC5WaWV3cy5DaGFydC5TY2FsZVNlbGVjdG9ycy5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL2NoYXJ0L0FwcC5WaWV3cy5DaGFydC5Tb3VyY2VzVGFiLmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvY2hhcnQvbWFwL0FwcC5WaWV3cy5DaGFydC5NYXAuTWFwQ29udHJvbHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbnNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5YUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM2xCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcldBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiOyggZnVuY3Rpb24oKSB7XG5cblx0XCJ1c2Ugc3RyaWN0XCI7XG5cdFxuXHRBcHAuVXRpbHMubWFwRGF0YSA9IGZ1bmN0aW9uKCByYXdEYXRhLCB0cmFuc3Bvc2VkICkge1xuXG5cdFx0dmFyIGRhdGEgPSBbXSxcblx0XHRcdGRhdGFCeUlkID0gW10sXG5cdFx0XHRjb3VudHJ5SW5kZXggPSAxO1xuXG5cdFx0Ly9kbyB3ZSBoYXZlIGVudGl0aWVzIGluIHJvd3MgYW5kIHRpbWVzIGluIGNvbHVtbnM/XHRcblx0XHRpZiggIXRyYW5zcG9zZWQgKSB7XG5cdFx0XHQvL25vLCB3ZSBoYXZlIHRvIHN3aXRjaCByb3dzIGFuZCBjb2x1bW5zXG5cdFx0XHRyYXdEYXRhID0gQXBwLlV0aWxzLnRyYW5zcG9zZSggcmF3RGF0YSApO1xuXHRcdH1cblx0XHRcblx0XHQvL2V4dHJhY3QgdGltZSBjb2x1bW5cblx0XHR2YXIgdGltZUFyciA9IHJhd0RhdGEuc2hpZnQoKTtcblx0XHQvL2dldCByaWQgb2YgZmlyc3QgaXRlbSAobGFiZWwgb2YgdGltZSBjb2x1bW4pIFxuXHRcdHRpbWVBcnIuc2hpZnQoKTtcblx0XG5cdFx0Zm9yKCB2YXIgaSA9IDAsIGxlbiA9IHJhd0RhdGEubGVuZ3RoOyBpIDwgbGVuOyBpKysgKSB7XG5cblx0XHRcdHZhciBzaW5nbGVSb3cgPSByYXdEYXRhWyBpIF0sXG5cdFx0XHRcdGNvbE5hbWUgPSBzaW5nbGVSb3cuc2hpZnQoKTtcblx0XHRcdFx0XG5cdFx0XHQvL29tbWl0IHJvd3Mgd2l0aCBubyBjb2xObWFlXG5cdFx0XHRpZiggY29sTmFtZSApIHtcblx0XHRcdFx0dmFyIHNpbmdsZURhdGEgPSBbXTtcblx0XHRcdFx0Xy5lYWNoKCBzaW5nbGVSb3csIGZ1bmN0aW9uKCB2YWx1ZSwgaSApIHtcblx0XHRcdFx0XHQvL2NoZWNrIHdlIGhhdmUgdmFsdWVcblx0XHRcdFx0XHRpZiggdmFsdWUgIT09IFwiXCIgKSB7XG5cdFx0XHRcdFx0XHRzaW5nbGVEYXRhLnB1c2goIHsgeDogdGltZUFycltpXSwgeTogKCAhaXNOYU4oIHZhbHVlICkgKT8gK3ZhbHVlOiB2YWx1ZSB9ICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9ICk7XG5cblx0XHRcdFx0Ly9jb25zdHJ1Y3QgZW50aXR5IG9ialxuXHRcdFx0XHR2YXJcdGVudGl0eU9iaiA9IHtcblx0XHRcdFx0XHRpZDogaSxcblx0XHRcdFx0XHRrZXk6IGNvbE5hbWUsXG5cdFx0XHRcdFx0dmFsdWVzOiBzaW5nbGVEYXRhXG5cdFx0XHRcdH07XG5cdFx0XHRcdGRhdGEucHVzaCggZW50aXR5T2JqICk7XG5cdFx0XHR9XG5cblx0XHR9XG5cblx0XHRyZXR1cm4gZGF0YTtcblxuXHR9LFxuXG5cdEFwcC5VdGlscy5tYXBTaW5nbGVWYXJpYW50RGF0YSA9IGZ1bmN0aW9uKCByYXdEYXRhLCB2YXJpYWJsZU5hbWUgKSB7XG5cblx0XHR2YXIgdmFyaWFibGUgPSB7XG5cdFx0XHRuYW1lOiB2YXJpYWJsZU5hbWUsXG5cdFx0XHR2YWx1ZXM6IEFwcC5VdGlscy5tYXBEYXRhKCByYXdEYXRhLCB0cnVlIClcblx0XHR9O1xuXHRcdHJldHVybiBbdmFyaWFibGVdO1xuXG5cdH0sXG5cblx0LypBcHAuVXRpbHMubWFwTXVsdGlWYXJpYW50RGF0YSA9IGZ1bmN0aW9uKCByYXdEYXRhLCBlbnRpdHlOYW1lICkge1xuXHRcdFxuXHRcdC8vdHJhbnNmb3JtIG11bHRpdmFyaWFudCBpbnRvIHN0YW5kYXJkIGZvcm1hdCAoIHRpbWUsIGVudGl0eSApXG5cdFx0dmFyIHZhcmlhYmxlcyA9IFtdLFxuXHRcdFx0dHJhbnNwb3NlZCA9IHJhd0RhdGEsLy9BcHAuVXRpbHMudHJhbnNwb3NlKCByYXdEYXRhICksXG5cdFx0XHR0aW1lQXJyID0gdHJhbnNwb3NlZC5zaGlmdCgpO1xuXG5cdFx0Ly9nZXQgcmlkIG9mIGZpcnN0IGl0ZW0gKGxhYmVsIG9mIHRpbWUgY29sdW1uKSBcblx0XHQvL3RpbWVBcnIuc2hpZnQoKTtcblx0XHRcblx0XHRfLmVhY2goIHRyYW5zcG9zZWQsIGZ1bmN0aW9uKCB2YWx1ZXMsIGtleSwgbGlzdCApIHtcblxuXHRcdFx0Ly9nZXQgdmFyaWFibGUgbmFtZSBmcm9tIGZpcnN0IGNlbGwgb2YgY29sdW1uc1xuXHRcdFx0dmFyIHZhcmlhYmxlTmFtZSA9IHZhbHVlcy5zaGlmdCgpO1xuXHRcdFx0Ly9hZGQgZW50aXR5IG5hbWUgYXMgZmlyc3QgY2VsbFxuXHRcdFx0dmFsdWVzLnVuc2hpZnQoIGVudGl0eU5hbWUgKTtcblx0XHRcdC8vY29uc3RydWN0IGFycmF5IGZvciBtYXBwaW5nLCBuZWVkIHRvIGRlZXAgY29weSB0aW1lQXJyXG5cdFx0XHR2YXIgbG9jYWxUaW1lQXJyID0gJC5leHRlbmQoIHRydWUsIFtdLCB0aW1lQXJyKTtcblx0XHRcdHZhciBkYXRhVG9NYXAgPSBbIGxvY2FsVGltZUFyciwgdmFsdWVzIF07XG5cdFx0XHQvL2NvbnN0cnVjdCBvYmplY3Rcblx0XHRcdHZhciB2YXJpYWJsZSA9IHtcblx0XHRcdFx0bmFtZTogdmFyaWFibGVOYW1lLFxuXHRcdFx0XHR2YWx1ZXM6IEFwcC5VdGlscy5tYXBEYXRhKCBkYXRhVG9NYXAsIHRydWUgKVxuXHRcdFx0fTtcblx0XHRcdHZhcmlhYmxlcy5wdXNoKCB2YXJpYWJsZSApO1xuXG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIHZhcmlhYmxlcztcblxuXHR9LCovXG5cblx0QXBwLlV0aWxzLm1hcE11bHRpVmFyaWFudERhdGEgPSBmdW5jdGlvbiggcmF3RGF0YSApIHtcblx0XHRcblx0XHR2YXIgdmFyaWFibGVzID0gW10sXG5cdFx0XHR0cmFuc3Bvc2VkID0gcmF3RGF0YSxcblx0XHRcdGhlYWRlckFyciA9IHRyYW5zcG9zZWQuc2hpZnQoKTtcblxuXHRcdC8vZ2V0IHJpZCBvZiBlbnRpdHkgYW5kIHllYXIgY29sdW1uIG5hbWVcblx0XHRoZWFkZXJBcnIgPSBoZWFkZXJBcnIuc2xpY2UoIDIgKTtcblxuXHRcdHZhciB2YXJQZXJSb3dEYXRhID0gQXBwLlV0aWxzLnRyYW5zcG9zZSggdHJhbnNwb3NlZCApLFxuXHRcdFx0ZW50aXRpZXNSb3cgPSB2YXJQZXJSb3dEYXRhLnNoaWZ0KCksXG5cdFx0XHR0aW1lc1JvdyA9IHZhclBlclJvd0RhdGEuc2hpZnQoKTtcblxuXHRcdF8uZWFjaCggdmFyUGVyUm93RGF0YSwgZnVuY3Rpb24oIHZhbHVlcywgdmFySW5kZXggKSB7XG5cdFx0XHRcblx0XHRcdHZhciBlbnRpdGllcyA9IHt9O1xuXHRcdFx0Ly9pdGVyYXRlIHRocm91Z2ggYWxsIHZhbHVlcyBmb3IgZ2l2ZW4gdmFyaWFibGVcblx0XHRcdF8uZWFjaCggdmFsdWVzLCBmdW5jdGlvbiggdmFsdWUsIGtleSApIHtcblx0XHRcdFx0dmFyIGVudGl0eSA9IGVudGl0aWVzUm93WyBrZXkgXSxcblx0XHRcdFx0XHR0aW1lID0gdGltZXNSb3dbIGtleSBdO1xuXHRcdFx0XHRpZiggZW50aXR5ICYmIHRpbWUgKSB7XG5cdFx0XHRcdFx0Ly9kbyBoYXZlIGFscmVhZHkgZW50aXR5IGRlZmluZWQ/XG5cdFx0XHRcdFx0aWYoICFlbnRpdGllc1sgZW50aXR5IF0gKSB7XG5cdFx0XHRcdFx0XHRlbnRpdGllc1sgZW50aXR5IF0gPSB7XG5cdFx0XHRcdFx0XHRcdGlkOiBrZXksXG5cdFx0XHRcdFx0XHRcdGtleTogZW50aXR5LFxuXHRcdFx0XHRcdFx0XHR2YWx1ZXM6IFtdXG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbnRpdGllc1sgZW50aXR5IF0udmFsdWVzLnB1c2goIHsgeDogdGltZSwgeTogKCAhaXNOYU4oIHZhbHVlICkgKT8gK3ZhbHVlOiB2YWx1ZSB9ICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblxuXHRcdFx0Ly9oYXZlIGRhdGEgZm9yIGFsbCBlbnRpdGllcywganVzdCBjb252ZXJ0IHRoZW0gdG8gYXJyYXlcblx0XHRcdHZhciB2YXJWYWx1ZXMgPSBfLm1hcCggZW50aXRpZXMsIGZ1bmN0aW9uKCB2YWx1ZSApIHsgcmV0dXJuIHZhbHVlOyB9ICk7XG5cdFx0XHRcblx0XHRcdHZhciB2YXJpYWJsZSA9IHtcblx0XHRcdFx0bmFtZTogaGVhZGVyQXJyWyB2YXJJbmRleCBdLFxuXHRcdFx0XHR2YWx1ZXM6IHZhclZhbHVlc1xuXHRcdFx0fTtcblx0XHRcdHZhcmlhYmxlcy5wdXNoKCB2YXJpYWJsZSApO1xuXG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIHZhcmlhYmxlcztcblxuXHR9LFxuXG5cblx0QXBwLlV0aWxzLnRyYW5zcG9zZSA9IGZ1bmN0aW9uKCBhcnIgKSB7XG5cdFx0dmFyIGtleXMgPSBfLmtleXMoIGFyclswXSApO1xuXHRcdHJldHVybiBfLm1hcCgga2V5cywgZnVuY3Rpb24gKGMpIHtcblx0XHRcdHJldHVybiBfLm1hcCggYXJyLCBmdW5jdGlvbiggciApIHtcblx0XHRcdFx0cmV0dXJuIHJbY107XG5cdFx0XHR9ICk7XG5cdFx0fSk7XG5cdH0sXG5cblx0QXBwLlV0aWxzLnRyYW5zZm9ybSA9IGZ1bmN0aW9uKCkge1xuXG5cdFx0Y29uc29sZS5sb2coIFwiYXBwLnV0aWxzLnRyYW5zZm9ybVwiICk7XG5cblx0fSxcblxuXHRBcHAuVXRpbHMuZW5jb2RlU3ZnVG9QbmcgPSBmdW5jdGlvbiggaHRtbCApIHtcblxuXHRcdGNvbnNvbGUubG9nKCBodG1sICk7XG5cdFx0dmFyIGltZ1NyYyA9IFwiZGF0YTppbWFnZS9zdmcreG1sO2Jhc2U2NCxcIiArIGJ0b2EoaHRtbCksXG5cdFx0XHRpbWcgPSBcIjxpbWcgc3JjPSdcIiArIGltZ1NyYyArIFwiJz5cIjsgXG5cdFx0XG5cdFx0Ly9kMy5zZWxlY3QoIFwiI3N2Z2RhdGF1cmxcIiApLmh0bWwoIGltZyApO1xuXG5cdFx0JCggXCIuY2hhcnQtd3JhcHBlci1pbm5lclwiICkuaHRtbCggaW1nICk7XG5cblx0XHQvKnZhciBjYW52YXMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCBcImNhbnZhc1wiICksXG5cdFx0XHRjb250ZXh0ID0gY2FudmFzLmdldENvbnRleHQoIFwiMmRcIiApO1xuXG5cdFx0dmFyIGltYWdlID0gbmV3IEltYWdlO1xuXHRcdGltYWdlLnNyYyA9IGltZ3NyYztcblx0XHRpbWFnZS5vbmxvYWQgPSBmdW5jdGlvbigpIHtcblx0XHRcdGNvbnRleHQuZHJhd0ltYWdlKGltYWdlLCAwLCAwKTtcblx0XHRcdHZhciBjYW52YXNEYXRhID0gY2FudmFzLnRvRGF0YVVSTCggXCJpbWFnZS9wbmdcIiApO1xuXHRcdFx0dmFyIHBuZ0ltZyA9ICc8aW1nIHNyYz1cIicgKyBjYW52YXNEYXRhICsgJ1wiPic7IFxuXHRcdFx0ZDMuc2VsZWN0KFwiI3BuZ2RhdGF1cmxcIikuaHRtbChwbmdpbWcpO1xuXG5cdFx0XHR2YXIgYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJhXCIpO1xuXHRcdFx0YS5kb3dubG9hZCA9IFwic2FtcGxlLnBuZ1wiO1xuXHRcdFx0YS5ocmVmID0gY2FudmFzZGF0YTtcblx0XHRcdGEuY2xpY2soKTtcblx0XHR9OyovXG5cblxuXHR9O1xuXG5cdC8qKlxuXHQqXHRUSU1FIFJFTEFURUQgRlVOQ1RJT05TXG5cdCoqL1xuXG5cdEFwcC5VdGlscy5udGggPSBmdW5jdGlvbiAoIGQgKSB7XG5cdFx0Ly9jb252ZXIgdG8gbnVtYmVyIGp1c3QgaW4gY2FzZVxuXHRcdGQgPSArZDtcblx0XHRpZiggZCA+IDMgJiYgZCA8IDIxICkgcmV0dXJuICd0aCc7IC8vIHRoYW5rcyBrZW5uZWJlY1xuXHRcdHN3aXRjaCggZCAlIDEwICkge1xuXHRcdFx0Y2FzZSAxOiAgcmV0dXJuIFwic3RcIjtcblx0XHRcdGNhc2UgMjogIHJldHVybiBcIm5kXCI7XG5cdFx0XHRjYXNlIDM6ICByZXR1cm4gXCJyZFwiO1xuXHRcdFx0ZGVmYXVsdDogcmV0dXJuIFwidGhcIjtcblx0XHR9XG5cdH1cblxuXHRBcHAuVXRpbHMuY2VudHVyeVN0cmluZyA9IGZ1bmN0aW9uICggZCApIHtcblx0XHQvL2NvbnZlciB0byBudW1iZXIganVzdCBpbiBjYXNlXG5cdFx0ZCA9ICtkO1xuXHRcdFxuXHRcdHZhciBjZW50dXJ5TnVtID0gTWF0aC5mbG9vcihkIC8gMTAwKSArIDEsXG5cdFx0XHRjZW50dXJ5U3RyaW5nID0gY2VudHVyeU51bS50b1N0cmluZygpLFxuXHRcdFx0bnRoID0gQXBwLlV0aWxzLm50aCggY2VudHVyeVN0cmluZyApO1xuXG5cdFx0cmV0dXJuIGNlbnR1cnlTdHJpbmcgKyBudGggKyBcIiBjZW50dXJ5XCI7XG5cdH1cblxuXHRBcHAuVXRpbHMuYWRkWmVyb3MgPSBmdW5jdGlvbiAoIHZhbHVlICkge1xuXG5cdFx0dmFsdWUgPSB2YWx1ZS50b1N0cmluZygpO1xuXHRcdGlmKCB2YWx1ZS5sZW5ndGggPCA0ICkge1xuXHRcdFx0Ly9pbnNlcnQgbWlzc2luZyB6ZXJvc1xuXHRcdFx0dmFyIHZhbHVlTGVuID0gdmFsdWUubGVuZ3RoO1xuXHRcdFx0Zm9yKCB2YXIgeSA9IDA7IHkgPCA0IC0gdmFsdWVMZW47IHkrKyApIHtcblx0XHRcdFx0dmFsdWUgPSBcIjBcIiArIHZhbHVlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0XG5cdH1cblxuXHRBcHAuVXRpbHMucm91bmRUaW1lID0gZnVuY3Rpb24oIG1vbWVudFRpbWUgKSB7XG5cblx0XHRpZiggdHlwZW9mIG1vbWVudFRpbWUuZm9ybWF0ID09PSBcImZ1bmN0aW9uXCIgKSB7XG5cdFx0XHQvL3VzZSBzaG9ydCBmb3JtYXQgbXlzcWwgZXhwZWN0cyAtIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMTA1MzkxNTQvaW5zZXJ0LWludG8tZGItZGF0ZXRpbWUtc3RyaW5nXG5cdFx0XHRyZXR1cm4gbW9tZW50VGltZS5mb3JtYXQoIFwiWVlZWS1NTS1ERFwiICk7XG5cdFx0fVxuXHRcdHJldHVybiBtb21lbnRUaW1lO1xuXG5cdH1cblxuXHQvKiogXG5cdCogRk9STSBIRUxQRVJcblx0KiovXG5cdEFwcC5VdGlscy5Gb3JtSGVscGVyLnZhbGlkYXRlID0gZnVuY3Rpb24oICRmb3JtICkge1xuXHRcdFxuXHRcdHZhciBtaXNzaW5nRXJyb3JMYWJlbCA9IFwiUGxlYXNlIGVudGVyIHZhbHVlLlwiLFxuXHRcdFx0ZW1haWxFcnJvckxhYmVsID0gIFwiUGxlYXNlIGVudGVyIHZhbGlkZSBlbWFpbC5cIixcblx0XHRcdG51bWJlckVycm9yTGFiZWwgPSBcIlBsZWFzZSBlbnRlIHZhbGlkIG51bWJlci5cIjsgXG5cblx0XHR2YXIgaW52YWxpZElucHV0cyA9IFtdO1xuXHRcdFxuXHRcdC8vZ2F0aGVyIGFsbCBmaWVsZHMgcmVxdWlyaW5nIHZhbGlkYXRpb25cblx0XHR2YXIgJHJlcXVpcmVkSW5wdXRzID0gJGZvcm0uZmluZCggXCIucmVxdWlyZWRcIiApO1xuXHRcdGlmKCAkcmVxdWlyZWRJbnB1dHMubGVuZ3RoICkge1xuXG5cdFx0XHQkLmVhY2goICRyZXF1aXJlZElucHV0cywgZnVuY3Rpb24oIGksIHYgKSB7XG5cblx0XHRcdFx0dmFyICRpbnB1dCA9ICQoIHRoaXMgKTtcblx0XHRcdFx0XG5cdFx0XHRcdC8vZmlsdGVyIG9ubHkgdmlzaWJsZVxuXHRcdFx0XHRpZiggISRpbnB1dC5pcyggXCI6dmlzaWJsZVwiICkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly9jaGVjayBmb3IgZW1wdHlcblx0XHRcdFx0dmFyIGlucHV0VmFsaWQgPSBBcHAuVXRpbHMuRm9ybUhlbHBlci52YWxpZGF0ZVJlcXVpcmVkRmllbGQoICRpbnB1dCApO1xuXHRcdFx0XHRpZiggIWlucHV0VmFsaWQgKSB7XG5cdFx0XHRcdFxuXHRcdFx0XHRcdEFwcC5VdGlscy5Gb3JtSGVscGVyLmFkZEVycm9yKCAkaW5wdXQsIG1pc3NpbmdFcnJvckxhYmVsICk7XG5cdFx0XHRcdFx0aW52YWxpZElucHV0cy5wdXNoKCAkaW5wdXQgKTtcblx0XHRcdFx0XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0QXBwLlV0aWxzLkZvcm1IZWxwZXIucmVtb3ZlRXJyb3IoICRpbnB1dCApO1xuXG5cdFx0XHRcdFx0Ly9jaGVjayBmb3IgZGlnaXRcblx0XHRcdFx0XHRpZiggJGlucHV0Lmhhc0NsYXNzKCBcInJlcXVpcmVkLW51bWJlclwiICkgKSB7XG5cdFx0XHRcdFx0XHRpbnB1dFZhbGlkID0gQXBwLlV0aWxzLkZvcm1IZWxwZXIudmFsaWRhdGVOdW1iZXJGaWVsZCggJGlucHV0ICk7XG5cdFx0XHRcdFx0XHRpZiggIWlucHV0VmFsaWQgKSB7XG5cdFx0XHRcdFx0XHRcdEFwcC5VdGlscy5Gb3JtSGVscGVyLmFkZEVycm9yKCAkaW5wdXQsIG51bWJlckVycm9yTGFiZWwgKTtcblx0XHRcdFx0XHRcdFx0aW52YWxpZElucHV0cy5wdXNoKCAkaW5wdXQgKTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdEFwcC5VdGlscy5Gb3JtSGVscGVyLnJlbW92ZUVycm9yKCAkaW5wdXQgKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvL2NoZWNrIGZvciBtYWlsXG5cdFx0XHRcdFx0aWYoICRpbnB1dC5oYXNDbGFzcyggXCJyZXF1aXJlZC1tYWlsXCIgKSApIHtcblx0XHRcdFx0XHRcdGlucHV0VmFsaWQgPSBGb3JtSGVscGVyLnZhbGlkYXRlRW1haWxGaWVsZCggJGlucHV0ICk7XG5cdFx0XHRcdFx0XHRpZiggIWlucHV0VmFsaWQgKSB7XG5cdFx0XHRcdFx0XHRcdEFwcC5VdGlscy5Gb3JtSGVscGVyLmFkZEVycm9yKCAkaW5wdXQsIGVtYWlsRXJyb3JMYWJlbCApO1xuXHRcdFx0XHRcdFx0XHRpbnZhbGlkSW5wdXRzLnB1c2goICRpbnB1dCApO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0QXBwLlV0aWxzLkZvcm1IZWxwZXIucmVtb3ZlRXJyb3IoICRpbnB1dCApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vY2hlY2sgZm9yIGNoZWNrYm94XG5cdFx0XHRcdFx0aWYoICRpbnB1dC5oYXNDbGFzcyggXCJyZXF1aXJlZC1jaGVja2JveFwiICkgKSB7XG5cblx0XHRcdFx0XHRcdGlucHV0VmFsaWQgPSBGb3JtSGVscGVyLnZhbGlkYXRlQ2hlY2tib3goICRpbnB1dCApO1xuXHRcdFx0XHRcdFx0aWYoICFpbnB1dFZhbGlkICkge1xuXHRcdFx0XHRcdFx0XHRBcHAuVXRpbHMuRm9ybUhlbHBlci5hZGRFcnJvciggJGlucHV0LCBtaXNzaW5nRXJyb3JMYWJlbCApO1xuXHRcdFx0XHRcdFx0XHRpbnZhbGlkSW5wdXRzLnB1c2goICRpbnB1dCApO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0QXBwLlV0aWxzLkZvcm1IZWxwZXIucmVtb3ZlRXJyb3IoICRpbnB1dCApO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdH1cblx0XG5cdFx0XHR9ICk7XG5cblx0XHR9XG5cblxuXHRcdGlmKCBpbnZhbGlkSW5wdXRzLmxlbmd0aCApIHtcblxuXHRcdFx0Ly90YWtlIGZpcnN0IGVsZW1lbnQgYW5kIHNjcm9sbCB0byBpdFxuXHRcdFx0dmFyICRmaXJzdEludmFsaWRJbnB1dCA9IGludmFsaWRJbnB1dHNbMF07XG5cdFx0XHQkKCdodG1sLCBib2R5JykuYW5pbWF0ZSgge1xuXHRcdFx0XHRzY3JvbGxUb3A6ICRmaXJzdEludmFsaWRJbnB1dC5vZmZzZXQoKS50b3AgLSAyNVxuXHRcdFx0fSwgMjUwKTtcblxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7IFxuXG5cdH07XG5cblx0QXBwLlV0aWxzLkZvcm1IZWxwZXIudmFsaWRhdGVSZXF1aXJlZEZpZWxkID0gZnVuY3Rpb24oICRpbnB1dCApIHtcblxuXHRcdHJldHVybiAoICRpbnB1dC52YWwoKSA9PT0gXCJcIiApID8gZmFsc2UgOiB0cnVlO1xuXG5cdH07XG5cblx0QXBwLlV0aWxzLkZvcm1IZWxwZXIudmFsaWRhdGVFbWFpbEZpZWxkID0gZnVuY3Rpb24oICRpbnB1dCApIHtcblxuXHRcdHZhciBlbWFpbCA9ICRpbnB1dC52YWwoKTtcblx0XHR2YXIgcmVnZXggPSAvXihbXFx3LVxcLl0rQChbXFx3LV0rXFwuKStbXFx3LV17Miw2fSk/JC87XG5cdFx0cmV0dXJuIHJlZ2V4LnRlc3QoIGVtYWlsICk7XG5cblx0fTtcblxuXHRBcHAuVXRpbHMuRm9ybUhlbHBlci52YWxpZGF0ZU51bWJlckZpZWxkID0gZnVuY3Rpb24oICRpbnB1dCApIHtcblxuXHRcdHJldHVybiAoIGlzTmFOKCAkaW5wdXQudmFsKCkgKSApID8gZmFsc2UgOiB0cnVlO1xuXG5cdH07XG5cblx0QXBwLlV0aWxzLkZvcm1IZWxwZXIudmFsaWRhdGVDaGVja2JveCA9IGZ1bmN0aW9uKCAkaW5wdXQgKSB7XG5cblx0XHRyZXR1cm4gKCAkaW5wdXQuaXMoJzpjaGVja2VkJykgKSA/IHRydWUgOiBmYWxzZTtcblxuXHR9O1xuXG5cblx0QXBwLlV0aWxzLkZvcm1IZWxwZXIuYWRkRXJyb3IgPSBmdW5jdGlvbiggJGVsLCAkbXNnICkge1xuXG5cdFx0aWYoICRlbCApIHtcblx0XHRcdGlmKCAhJGVsLmhhc0NsYXNzKCBcImVycm9yXCIgKSApIHtcblx0XHRcdFx0JGVsLmFkZENsYXNzKCBcImVycm9yXCIgKTtcblx0XHRcdFx0JGVsLmJlZm9yZSggXCI8cCBjbGFzcz0nZXJyb3ItbGFiZWwnPlwiICsgJG1zZyArIFwiPC9wPlwiICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdH07XG5cblx0QXBwLlV0aWxzLkZvcm1IZWxwZXIucmVtb3ZlRXJyb3IgPSBmdW5jdGlvbiggJGVsICkge1xuXG5cdFx0aWYoICRlbCApIHtcblx0XHRcdCRlbC5yZW1vdmVDbGFzcyggXCJlcnJvclwiICk7XG5cdFx0XHR2YXIgJHBhcmVudCA9ICRlbC5wYXJlbnQoKTtcblx0XHRcdHZhciAkZXJyb3JMYWJlbCA9ICRwYXJlbnQuZmluZCggXCIuZXJyb3ItbGFiZWxcIiApO1xuXHRcdFx0aWYoICRlcnJvckxhYmVsLmxlbmd0aCApIHtcblx0XHRcdFx0JGVycm9yTGFiZWwucmVtb3ZlKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdFxuXHR9O1xuXG5cdEFwcC5VdGlscy53cmFwID0gZnVuY3Rpb24oICRlbCwgd2lkdGggKSB7XG5cdFx0XG5cdFx0Ly9nZXQgcmlkIG9mIHBvdGVudGlhbCB0c3BhbnMgYW5kIGdldCBwdXJlIGNvbnRlbnQgKGluY2x1ZGluZyBoeXBlcmxpbmtzKVxuXHRcdHZhciB0ZXh0Q29udGVudCA9IFwiXCIsXG5cdFx0XHQkdHNwYW5zID0gJGVsLmZpbmQoIFwidHNwYW5cIiApO1xuXHRcdGlmKCAkdHNwYW5zLmxlbmd0aCApIHtcblx0XHRcdCQuZWFjaCggJHRzcGFucywgZnVuY3Rpb24oIGksIHYgKSB7XG5cdFx0XHRcdGlmKCBpID4gMCApIHtcblx0XHRcdFx0XHR0ZXh0Q29udGVudCArPSBcIiBcIjtcblx0XHRcdFx0fVxuXHRcdFx0XHR0ZXh0Q29udGVudCArPSAkKHYpLnRleHQoKTtcblx0XHRcdH0gKTtcdFxuXHRcdH0gZWxzZSB7XG5cdFx0XHQvL2VsZW1lbnQgaGFzIG5vIHRzcGFucywgcG9zc2libHkgZmlyc3QgcnVuXG5cdFx0XHR0ZXh0Q29udGVudCA9ICRlbC50ZXh0KCk7XG5cdFx0fVxuXHRcdFxuXHRcdC8vYXBwZW5kIHRvIGVsZW1lbnRcblx0XHRpZiggdGV4dENvbnRlbnQgKSB7XG5cdFx0XHQkZWwudGV4dCggdGV4dENvbnRlbnQgKTtcblx0XHR9XG5cdFx0XG5cdFx0dmFyIHRleHQgPSBkMy5zZWxlY3QoICRlbC5zZWxlY3RvciApO1xuXHRcdHRleHQuZWFjaCggZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgdGV4dCA9IGQzLnNlbGVjdCh0aGlzKSxcblx0XHRcdFx0cmVnZXggPSAvXFxzKy8sXG5cdFx0XHRcdHdvcmRzID0gdGV4dC50ZXh0KCkuc3BsaXQocmVnZXgpLnJldmVyc2UoKTtcblxuXHRcdFx0dmFyIHdvcmQsXG5cdFx0XHRcdGxpbmUgPSBbXSxcblx0XHRcdFx0bGluZU51bWJlciA9IDAsXG5cdFx0XHRcdGxpbmVIZWlnaHQgPSAxLjQsIC8vIGVtc1xuXHRcdFx0XHR5ID0gdGV4dC5hdHRyKFwieVwiKSxcblx0XHRcdFx0ZHkgPSBwYXJzZUZsb2F0KHRleHQuYXR0cihcImR5XCIpKSxcblx0XHRcdFx0dHNwYW4gPSB0ZXh0LnRleHQobnVsbCkuYXBwZW5kKFwidHNwYW5cIikuYXR0cihcInhcIiwgMCkuYXR0cihcInlcIiwgeSkuYXR0cihcImR5XCIsIGR5ICsgXCJlbVwiKTtcblx0XHRcdFxuXHRcdFx0d2hpbGUoIHdvcmQgPSB3b3Jkcy5wb3AoKSApIHtcblx0XHRcdFx0bGluZS5wdXNoKHdvcmQpO1xuXHRcdFx0XHR0c3Bhbi5odG1sKGxpbmUuam9pbihcIiBcIikpO1xuXHRcdFx0XHRpZiggdHNwYW4ubm9kZSgpLmdldENvbXB1dGVkVGV4dExlbmd0aCgpID4gd2lkdGggKSB7XG5cdFx0XHRcdFx0bGluZS5wb3AoKTtcblx0XHRcdFx0XHR0c3Bhbi50ZXh0KGxpbmUuam9pbihcIiBcIikpO1xuXHRcdFx0XHRcdGxpbmUgPSBbd29yZF07XG5cdFx0XHRcdFx0dHNwYW4gPSB0ZXh0LmFwcGVuZChcInRzcGFuXCIpLmF0dHIoXCJ4XCIsIDApLmF0dHIoXCJ5XCIsIHkpLmF0dHIoXCJkeVwiLCArK2xpbmVOdW1iZXIgKiBsaW5lSGVpZ2h0ICsgZHkgKyBcImVtXCIpLnRleHQod29yZCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdH0gKTtcblxuXHRcdFxuXHR9O1xuXG5cdC8qKlxuXHQqIENvbnZlcnQgYSBzdHJpbmcgdG8gSFRNTCBlbnRpdGllc1xuXHQqL1xuXHRBcHAuVXRpbHMudG9IdG1sRW50aXRpZXMgPSBmdW5jdGlvbihzdHJpbmcpIHtcblx0XHRyZXR1cm4gc3RyaW5nLnJlcGxhY2UoLy4vZ20sIGZ1bmN0aW9uKHMpIHtcblx0XHRcdHJldHVybiBcIiYjXCIgKyBzLmNoYXJDb2RlQXQoMCkgKyBcIjtcIjtcblx0XHR9KTtcblx0fTtcblxuXHQvKipcblx0ICogQ3JlYXRlIHN0cmluZyBmcm9tIEhUTUwgZW50aXRpZXNcblx0ICovXG5cdEFwcC5VdGlscy5mcm9tSHRtbEVudGl0aWVzID0gZnVuY3Rpb24oc3RyaW5nKSB7XG5cdFx0cmV0dXJuIChzdHJpbmcrXCJcIikucmVwbGFjZSgvJiNcXGQrOy9nbSxmdW5jdGlvbihzKSB7XG5cdFx0XHRyZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZShzLm1hdGNoKC9cXGQrL2dtKVswXSk7XG5cdFx0fSlcblx0fTtcblxuXHRBcHAuVXRpbHMuZ2V0UmFuZG9tQ29sb3IgPSBmdW5jdGlvbiAoKSB7XG5cdFx0dmFyIGxldHRlcnMgPSAnMDEyMzQ1Njc4OUFCQ0RFRicuc3BsaXQoJycpO1xuXHRcdHZhciBjb2xvciA9ICcjJztcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IDY7IGkrKyApIHtcblx0XHRcdGNvbG9yICs9IGxldHRlcnNbTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTYpXTtcblx0XHR9XG5cdFx0cmV0dXJuIGNvbG9yO1xuXHR9O1xuXG5cdEFwcC5VdGlscy5nZXRQcm9wZXJ0eUJ5VmFyaWFibGVJZCA9IGZ1bmN0aW9uKCBtb2RlbCwgdmFyaWFibGVJZCApIHtcblxuXHRcdGlmKCBtb2RlbCAmJiBtb2RlbC5nZXQoIFwiY2hhcnQtZGltZW5zaW9uc1wiICkgKSB7XG5cblx0XHRcdHZhciBjaGFydERpbWVuc2lvbnNTdHJpbmcgPSBtb2RlbC5nZXQoIFwiY2hhcnQtZGltZW5zaW9uc1wiICksXG5cdFx0XHRcdGNoYXJ0RGltZW5zaW9ucyA9ICQucGFyc2VKU09OKCBjaGFydERpbWVuc2lvbnNTdHJpbmcgKSxcblx0XHRcdFx0ZGltZW5zaW9uID0gXy53aGVyZSggY2hhcnREaW1lbnNpb25zLCB7IFwidmFyaWFibGVJZFwiOiB2YXJpYWJsZUlkIH0gKTtcblx0XHRcdGlmKCBkaW1lbnNpb24gJiYgZGltZW5zaW9uLmxlbmd0aCApIHtcblx0XHRcdFx0cmV0dXJuIGRpbWVuc2lvblswXS5wcm9wZXJ0eTtcblx0XHRcdH1cblxuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0XHRcblx0fTtcblxuXG5cdEFwcC5VdGlscy5jb250ZW50R2VuZXJhdG9yID0gZnVuY3Rpb24oIGRhdGEsIGlzTWFwUG9wdXAgKSB7XG5cdFx0XHRcblx0XHQvL3NldCBwb3B1cFxuXHRcdHZhciB1bml0c1N0cmluZyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJ1bml0c1wiICksXG5cdFx0XHRjaGFydFR5cGUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdHlwZVwiICksXG5cdFx0XHR1bml0cyA9ICggISQuaXNFbXB0eU9iamVjdCggdW5pdHNTdHJpbmcgKSApPyAkLnBhcnNlSlNPTiggdW5pdHNTdHJpbmcgKToge30sXG5cdFx0XHRzdHJpbmcgPSBcIlwiLFxuXHRcdFx0dmFsdWVzU3RyaW5nID0gXCJcIjtcblxuXHRcdC8vZmluZCByZWxldmFudCB2YWx1ZXMgZm9yIHBvcHVwIGFuZCBkaXNwbGF5IHRoZW1cblx0XHR2YXIgc2VyaWVzID0gZGF0YS5zZXJpZXMsIGtleSA9IFwiXCIsIHRpbWVTdHJpbmcgPSBcIlwiO1xuXHRcdGlmKCBzZXJpZXMgJiYgc2VyaWVzLmxlbmd0aCApIHtcblx0XHRcdFxuXHRcdFx0dmFyIHNlcmllID0gc2VyaWVzWyAwIF07XG5cdFx0XHRrZXkgPSBzZXJpZS5rZXk7XG5cdFx0XHRcblx0XHRcdC8vZ2V0IHNvdXJjZSBvZiBpbmZvcm1hdGlvblxuXHRcdFx0dmFyIHBvaW50ID0gZGF0YS5wb2ludDtcblx0XHRcdC8vYmVnaW4gY29tcG9zdGluZyBzdHJpbmdcblx0XHRcdHN0cmluZyA9IFwiPGgzPlwiICsga2V5ICsgXCI8L2gzPjxwPlwiO1xuXHRcdFx0dmFsdWVzU3RyaW5nID0gXCJcIjtcblxuXHRcdFx0aWYoICFpc01hcFBvcHVwICYmICggQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LXR5cGVcIiApID09PSBcIjRcIiB8fCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdHlwZVwiICkgPT09IFwiNVwiIHx8IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10eXBlXCIgKSA9PT0gXCI2XCIgKSApIHtcblx0XHRcdFx0Ly9tdWx0aWJhcmNoYXJ0IGhhcyB2YWx1ZXMgaW4gZGlmZmVyZW50IGZvcm1hdFxuXHRcdFx0XHRwb2ludCA9IHsgXCJ5XCI6IHNlcmllLnZhbHVlLCBcInRpbWVcIjogZGF0YS5kYXRhLnRpbWUgfTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0JC5lYWNoKCBwb2ludCwgZnVuY3Rpb24oIGksIHYgKSB7XG5cdFx0XHRcdC8vZm9yIGVhY2ggZGF0YSBwb2ludCwgZmluZCBhcHByb3ByaWF0ZSB1bml0LCBhbmQgaWYgd2UgaGF2ZSBpdCwgZGlzcGxheSBpdFxuXHRcdFx0XHR2YXIgdW5pdCA9IF8uZmluZFdoZXJlKCB1bml0cywgeyBwcm9wZXJ0eTogaSB9ICksXG5cdFx0XHRcdFx0dmFsdWUgPSB2LFxuXHRcdFx0XHRcdGlzSGlkZGVuID0gKCB1bml0ICYmIHVuaXQuaGFzT3duUHJvcGVydHkoIFwidmlzaWJsZVwiICkgJiYgIXVuaXQudmlzaWJsZSApPyB0cnVlOiBmYWxzZTtcblxuXHRcdFx0XHQvL2Zvcm1hdCBudW1iZXJcblx0XHRcdFx0aWYoIHVuaXQgJiYgIWlzTmFOKCB1bml0LmZvcm1hdCApICYmIHVuaXQuZm9ybWF0ID49IDAgKSB7XG5cdFx0XHRcdFx0Ly9maXhlZCBmb3JtYXRcblx0XHRcdFx0XHR2YXIgZml4ZWQgPSBNYXRoLm1pbiggMjAsIHBhcnNlSW50KCB1bml0LmZvcm1hdCwgMTAgKSApO1xuXHRcdFx0XHRcdHZhbHVlID0gZDMuZm9ybWF0KCBcIiwuXCIgKyBmaXhlZCArIFwiZlwiICkoIHZhbHVlICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly9hZGQgdGhvdXNhbmRzIHNlcGFyYXRvclxuXHRcdFx0XHRcdHZhbHVlID0gZDMuZm9ybWF0KCBcIixcIiApKCB2YWx1ZSApO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYoIHVuaXQgKSB7XG5cdFx0XHRcdFx0aWYoICFpc0hpZGRlbiApIHtcblx0XHRcdFx0XHRcdC8vdHJ5IHRvIGZvcm1hdCBudW1iZXJcblx0XHRcdFx0XHRcdC8vc2NhdHRlciBwbG90IGhhcyB2YWx1ZXMgZGlzcGxheWVkIGluIHNlcGFyYXRlIHJvd3Ncblx0XHRcdFx0XHRcdGlmKCB2YWx1ZXNTdHJpbmcgIT09IFwiXCIgJiYgY2hhcnRUeXBlICE9IDIgKSB7XG5cdFx0XHRcdFx0XHRcdHZhbHVlc1N0cmluZyArPSBcIiwgXCI7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiggY2hhcnRUeXBlID09IDIgKSB7XG5cdFx0XHRcdFx0XHRcdHZhbHVlc1N0cmluZyArPSBcIjxzcGFuIGNsYXNzPSd2YXItcG9wdXAtdmFsdWUnPlwiO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0dmFsdWVzU3RyaW5nICs9IHZhbHVlICsgXCIgXCIgKyB1bml0LnVuaXQ7XG5cdFx0XHRcdFx0XHRpZiggY2hhcnRUeXBlID09IDIgKSB7XG5cdFx0XHRcdFx0XHRcdHZhbHVlc1N0cmluZyArPSBcIjwvc3Bhbj5cIjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSBpZiggaSA9PT0gXCJ0aW1lXCIgKSB7XG5cdFx0XHRcdFx0dGltZVN0cmluZyA9IHY7XG5cdFx0XHRcdH0gZWxzZSBpZiggaSAhPT0gXCJjb2xvclwiICYmIGkgIT09IFwic2VyaWVzXCIgJiYgKCBpICE9PSBcInhcIiB8fCBjaGFydFR5cGUgIT0gMSApICkge1xuXHRcdFx0XHRcdGlmKCAhaXNIaWRkZW4gKSB7XG5cdFx0XHRcdFx0XHRpZiggdmFsdWVzU3RyaW5nICE9PSBcIlwiICYmIGNoYXJ0VHlwZSAhPSAyICkge1xuXHRcdFx0XHRcdFx0XHR2YWx1ZXNTdHJpbmcgKz0gXCIsIFwiO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYoIGNoYXJ0VHlwZSA9PSAyICkge1xuXHRcdFx0XHRcdFx0XHR2YWx1ZXNTdHJpbmcgKz0gXCI8c3BhbiBjbGFzcz0ndmFyLXBvcHVwLXZhbHVlJz5cIjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdC8vanVzdCBhZGQgcGxhaW4gdmFsdWUsIG9taXRpbmcgeCB2YWx1ZSBmb3IgbGluZWNoYXJ0XG5cdFx0XHRcdFx0XHR2YWx1ZXNTdHJpbmcgKz0gdmFsdWU7XG5cdFx0XHRcdFx0XHRpZiggY2hhcnRUeXBlID09IDIgKSB7XG5cdFx0XHRcdFx0XHRcdHZhbHVlc1N0cmluZyArPSBcIjwvc3Bhbj5cIjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblxuXHRcdFx0aWYoIGlzTWFwUG9wdXAgfHwgKCB0aW1lU3RyaW5nICYmIGNoYXJ0VHlwZSAhPSAyICkgKSB7XG5cdFx0XHRcdHZhbHVlc1N0cmluZyArPSBcIiA8YnIgLz4gaW4gPGJyIC8+IFwiICsgdGltZVN0cmluZztcblx0XHRcdH0gZWxzZSBpZiggdGltZVN0cmluZyAmJiBjaGFydFR5cGUgPT0gMiApIHtcblx0XHRcdFx0dmFsdWVzU3RyaW5nICs9IFwiPHNwYW4gY2xhc3M9J3Zhci1wb3B1cC12YWx1ZSc+aW4gXCIgKyB0aW1lU3RyaW5nICsgXCI8L3NwYW4+XCI7XG5cdFx0XHR9XG5cdFx0XHRzdHJpbmcgKz0gdmFsdWVzU3RyaW5nO1xuXHRcdFx0c3RyaW5nICs9IFwiPC9wPlwiO1xuXG5cdFx0fVxuXG5cdFx0cmV0dXJuIHN0cmluZztcblxuXHR9O1xuXG5cblx0QXBwLlV0aWxzLmZvcm1hdFRpbWVMYWJlbCA9IGZ1bmN0aW9uKCB0eXBlLCBkLCB4QXhpc1ByZWZpeCwgeEF4aXNTdWZmaXgsIGZvcm1hdCApIHtcblx0XHQvL2RlcGVuZGluZyBvbiB0eXBlIGZvcm1hdCBsYWJlbFxuXHRcdHZhciBsYWJlbDtcblx0XHRzd2l0Y2goIHR5cGUgKSB7XG5cdFx0XHRcblx0XHRcdGNhc2UgXCJEZWNhZGVcIjpcblx0XHRcdFx0XG5cdFx0XHRcdHZhciBkZWNhZGVTdHJpbmcgPSBkLnRvU3RyaW5nKCk7XG5cdFx0XHRcdGRlY2FkZVN0cmluZyA9IGRlY2FkZVN0cmluZy5zdWJzdHJpbmcoIDAsIGRlY2FkZVN0cmluZy5sZW5ndGggLSAxKTtcblx0XHRcdFx0ZGVjYWRlU3RyaW5nID0gZGVjYWRlU3RyaW5nICsgXCIwc1wiO1xuXHRcdFx0XHRsYWJlbCA9IGRlY2FkZVN0cmluZztcblxuXHRcdFx0XHRicmVhaztcblxuXHRcdFx0Y2FzZSBcIlF1YXJ0ZXIgQ2VudHVyeVwiOlxuXHRcdFx0XHRcblx0XHRcdFx0dmFyIHF1YXJ0ZXJTdHJpbmcgPSBcIlwiLFxuXHRcdFx0XHRcdHF1YXJ0ZXIgPSBkICUgMTAwO1xuXHRcdFx0XHRcblx0XHRcdFx0aWYoIHF1YXJ0ZXIgPCAyNSApIHtcblx0XHRcdFx0XHRxdWFydGVyU3RyaW5nID0gXCIxc3QgcXVhcnRlciBvZiB0aGVcIjtcblx0XHRcdFx0fSBlbHNlIGlmKCBxdWFydGVyIDwgNTAgKSB7XG5cdFx0XHRcdFx0cXVhcnRlclN0cmluZyA9IFwiaGFsZiBvZiB0aGVcIjtcblx0XHRcdFx0fSBlbHNlIGlmKCBxdWFydGVyIDwgNzUgKSB7XG5cdFx0XHRcdFx0cXVhcnRlclN0cmluZyA9IFwiM3JkIHF1YXJ0ZXIgb2YgdGhlXCI7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cXVhcnRlclN0cmluZyA9IFwiNHRoIHF1YXJ0ZXIgb2YgdGhlXCI7XG5cdFx0XHRcdH1cblx0XHRcdFx0XHRcblx0XHRcdFx0dmFyIGNlbnR1cnlTdHJpbmcgPSBBcHAuVXRpbHMuY2VudHVyeVN0cmluZyggZCApO1xuXG5cdFx0XHRcdGxhYmVsID0gcXVhcnRlclN0cmluZyArIFwiIFwiICsgY2VudHVyeVN0cmluZztcblxuXHRcdFx0XHRicmVhaztcblxuXHRcdFx0Y2FzZSBcIkhhbGYgQ2VudHVyeVwiOlxuXHRcdFx0XHRcblx0XHRcdFx0dmFyIGhhbGZTdHJpbmcgPSBcIlwiLFxuXHRcdFx0XHRcdGhhbGYgPSBkICUgMTAwO1xuXHRcdFx0XHRcblx0XHRcdFx0aWYoIGhhbGYgPCA1MCApIHtcblx0XHRcdFx0XHRoYWxmU3RyaW5nID0gXCIxc3QgaGFsZiBvZiB0aGVcIjtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRoYWxmU3RyaW5nID0gXCIybmQgaGFsZiBvZiB0aGVcIjtcblx0XHRcdFx0fVxuXHRcdFx0XHRcdFxuXHRcdFx0XHR2YXIgY2VudHVyeVN0cmluZyA9IEFwcC5VdGlscy5jZW50dXJ5U3RyaW5nKCBkICk7XG5cblx0XHRcdFx0bGFiZWwgPSBoYWxmU3RyaW5nICsgXCIgXCIgKyBjZW50dXJ5U3RyaW5nO1xuXG5cdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRjYXNlIFwiQ2VudHVyeVwiOlxuXHRcdFx0XHRcblx0XHRcdFx0bGFiZWwgPSBBcHAuVXRpbHMuY2VudHVyeVN0cmluZyggZCApO1xuXG5cdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRkZWZhdWx0OlxuXG5cdFx0XHRcdGxhYmVsID0gQXBwLlV0aWxzLmZvcm1hdFZhbHVlKCBkLCBmb3JtYXQgKTtcblx0XHRcdFx0XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblx0XHRyZXR1cm4geEF4aXNQcmVmaXggKyBsYWJlbCArIHhBeGlzU3VmZml4O1xuXHR9O1xuXG5cdEFwcC5VdGlscy5pbmxpbmVDc3NTdHlsZSA9IGZ1bmN0aW9uKCBydWxlcyApIHtcblx0XHQvL2h0dHA6Ly9kZXZpbnRvcnIuZXMvYmxvZy8yMDEwLzA1LzI2L3R1cm4tY3NzLXJ1bGVzLWludG8taW5saW5lLXN0eWxlLWF0dHJpYnV0ZXMtdXNpbmctanF1ZXJ5L1xuXHRcdGZvciAodmFyIGlkeCA9IDAsIGxlbiA9IHJ1bGVzLmxlbmd0aDsgaWR4IDwgbGVuOyBpZHgrKykge1xuXHRcdFx0JChydWxlc1tpZHhdLnNlbGVjdG9yVGV4dCkuZWFjaChmdW5jdGlvbiAoaSwgZWxlbSkge1xuXHRcdFx0XHRlbGVtLnN0eWxlLmNzc1RleHQgKz0gcnVsZXNbaWR4XS5zdHlsZS5jc3NUZXh0O1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9O1xuXG5cdEFwcC5VdGlscy5jaGVja1ZhbGlkRGltZW5zaW9ucyA9IGZ1bmN0aW9uKCBkaW1lbnNpb25zLCBjaGFydFR5cGUgKSB7XG5cdFx0XHRcblx0XHR2YXIgdmFsaWREaW1lbnNpb25zID0gZmFsc2UsXG5cdFx0XHR4RGltZW5zaW9uLCB5RGltZW5zaW9uO1xuXHRcdFxuXHRcdHN3aXRjaCggY2hhcnRUeXBlICkge1xuXHRcdFx0Y2FzZSBcIjFcIjpcblx0XHRcdGNhc2UgXCI0XCI6XG5cdFx0XHRjYXNlIFwiNVwiOlxuXHRcdFx0Y2FzZSBcIjZcIjpcblx0XHRcdFx0Ly9jaGVjayB0aGF0IGRpbWVuc2lvbnMgaGF2ZSB5IHByb3BlcnR5XG5cdFx0XHRcdHlEaW1lbnNpb24gPSBfLmZpbmQoIGRpbWVuc2lvbnMsIGZ1bmN0aW9uKCBkaW1lbnNpb24gKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGRpbWVuc2lvbi5wcm9wZXJ0eSA9PT0gXCJ5XCI7XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0aWYoIHlEaW1lbnNpb24gKSB7XG5cdFx0XHRcdFx0dmFsaWREaW1lbnNpb25zID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgXCIyXCI6XG5cdFx0XHRcdC8vY2hlY2sgdGhhdCBkaW1lbnNpb25zIGhhdmUgeCBwcm9wZXJ0eVxuXHRcdFx0XHR4RGltZW5zaW9uID0gXy5maW5kKCBkaW1lbnNpb25zLCBmdW5jdGlvbiggZGltZW5zaW9uICkge1xuXHRcdFx0XHRcdHJldHVybiBkaW1lbnNpb24ucHJvcGVydHkgPT09IFwieFwiO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdHlEaW1lbnNpb24gPSBfLmZpbmQoIGRpbWVuc2lvbnMsIGZ1bmN0aW9uKCBkaW1lbnNpb24gKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGRpbWVuc2lvbi5wcm9wZXJ0eSA9PT0gXCJ5XCI7XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0aWYoIHhEaW1lbnNpb24gJiYgeURpbWVuc2lvbiApIHtcblx0XHRcdFx0XHR2YWxpZERpbWVuc2lvbnMgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBcIjNcIjpcblx0XHRcdFx0Ly9jaGVjayB0aGF0IGRpbWVuc2lvbnMgaGF2ZSB5IHByb3BlcnR5XG5cdFx0XHRcdHlEaW1lbnNpb24gPSBfLmZpbmQoIGRpbWVuc2lvbnMsIGZ1bmN0aW9uKCBkaW1lbnNpb24gKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGRpbWVuc2lvbi5wcm9wZXJ0eSA9PT0gXCJ5XCI7XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0aWYoIHlEaW1lbnNpb24gKSB7XG5cdFx0XHRcdFx0dmFsaWREaW1lbnNpb25zID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cdFx0cmV0dXJuIHZhbGlkRGltZW5zaW9ucztcblxuXHR9O1xuXG5cdEFwcC5VdGlscy5mb3JtYXRWYWx1ZSA9IGZ1bmN0aW9uKCB2YWx1ZSwgZm9ybWF0ICkge1xuXHRcdC8vbWFrZSBzdXJlIHdlIGRvIHRoaXMgb24gbnVtYmVyXG5cdFx0aWYoIHZhbHVlICYmICFpc05hTiggdmFsdWUgKSApIHtcblx0XHRcdGlmKCBmb3JtYXQgJiYgIWlzTmFOKCBmb3JtYXQgKSApIHtcblx0XHRcdFx0dmFyIGZpeGVkID0gTWF0aC5taW4oIDIwLCBwYXJzZUludCggZm9ybWF0LCAxMCApICk7XG5cdFx0XHRcdHZhbHVlID0gdmFsdWUudG9GaXhlZCggZml4ZWQgKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vbm8gZm9ybWF0IFxuXHRcdFx0XHR2YWx1ZSA9IHZhbHVlLnRvU3RyaW5nKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB2YWx1ZTtcblx0fTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5VdGlscztcblx0XG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIENoYXJ0ID0gcmVxdWlyZSggXCIuL3ZpZXdzL0FwcC5WaWV3cy5DaGFydC5qc1wiICksXG5cdFx0Q2hhcnRNb2RlbCA9IHJlcXVpcmUoIFwiLi9tb2RlbHMvQXBwLk1vZGVscy5DaGFydE1vZGVsLmpzXCIgKSxcblx0XHRDaGFydERhdGFNb2RlbCA9IHJlcXVpcmUoIFwiLi9tb2RlbHMvQXBwLk1vZGVscy5DaGFydERhdGFNb2RlbC5qc1wiICk7XG5cblx0Ly9zZXR1cCBtb2RlbHNcblx0Ly9pcyBuZXcgY2hhcnQgb3IgZGlzcGxheSBvbGQgY2hhcnRcblx0dmFyICRjaGFydFNob3dXcmFwcGVyID0gJCggXCIuY2hhcnQtc2hvdy13cmFwcGVyLCAuY2hhcnQtZWRpdC13cmFwcGVyXCIgKSxcblx0XHRjaGFydElkID0gJGNoYXJ0U2hvd1dyYXBwZXIuYXR0ciggXCJkYXRhLWNoYXJ0LWlkXCIgKTtcblxuXHQvL3NldHVwIHZpZXdzXG5cdEFwcC5WaWV3ID0gbmV3IENoYXJ0KCk7XG5cblx0aWYoICRjaGFydFNob3dXcmFwcGVyLmxlbmd0aCAmJiBjaGFydElkICkge1xuXHRcdFxuXHRcdC8vc2hvd2luZyBleGlzdGluZyBjaGFydFxuXHRcdEFwcC5DaGFydE1vZGVsID0gbmV3IENoYXJ0TW9kZWwoIHsgaWQ6IGNoYXJ0SWQgfSApO1xuXHRcdEFwcC5DaGFydE1vZGVsLmZldGNoKCB7XG5cdFx0XHRzdWNjZXNzOiBmdW5jdGlvbiggZGF0YSApIHtcblx0XHRcdFx0QXBwLlZpZXcuc3RhcnQoKTtcblx0XHRcdH0sXG5cdFx0XHRlcnJvcjogZnVuY3Rpb24oIHhociApIHtcblx0XHRcdFx0Y29uc29sZS5lcnJvciggXCJFcnJvciBsb2FkaW5nIGNoYXJ0IG1vZGVsXCIsIHhociApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0XHQvL2ZpbmQgb3V0IGlmIGl0J3MgaW4gY2FjaGVcblx0XHRpZiggISQoIFwiLnN0YW5kYWxvbmUtY2hhcnQtdmlld2VyXCIgKS5sZW5ndGggKSB7XG5cdFx0XHQvL2Rpc2FibGUgY2FjaGluZyBmb3Igdmlld2luZyB3aXRoaW4gYWRtaW5cblx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJjYWNoZVwiLCBmYWxzZSApO1xuXHRcdH1cblx0XHRcblx0fSBlbHNlIHtcblxuXHRcdC8vaXMgbmV3IGNoYXJ0XG5cdFx0QXBwLkNoYXJ0TW9kZWwgPSBuZXcgQ2hhcnRNb2RlbCgpO1xuXHRcdEFwcC5WaWV3LnN0YXJ0KCk7XG5cblx0fVxuXG5cdFxuXHRcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0QXBwLk1vZGVscy5DaGFydERhdGFNb2RlbCA9IEJhY2tib25lLk1vZGVsLmV4dGVuZCgge1xuXG5cdFx0ZGVmYXVsdHM6IHt9LFxuXG5cdFx0dXJsUm9vdDogR2xvYmFsLnJvb3RVcmwgKyBcIi9kYXRhL2RpbWVuc2lvbnNcIixcblx0XHRcblx0XHQvKnVybDogZnVuY3Rpb24oKXtcblxuXHRcdFx0dmFyIGF0dHJzID0gdGhpcy5hdHRyaWJ1dGVzLFxuXHRcdFx0XHR1cmwgPSB0aGlzLnVybFJvb3QgKyBcIj9cIjtcblxuXHRcdFx0Ly9hZGQgYWxsIGF0dHJpYnV0ZXMgdG8gdXJsXG5cdFx0XHRfLmVhY2goIGF0dHJzLCBmdW5jdGlvbiggdiwgaSApIHtcblx0XHRcdFx0dXJsICs9IGkgKyBcIj1cIiArIHY7XG5cdFx0XHRcdHVybCArPSBcIiZcIjtcblx0XHRcdH0gKTtcblxuXHRcdFx0cmV0dXJuIHVybDtcblxuXHRcdH0sKi9cblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uICgpIHtcblxuXHRcdH0sXG5cblx0fSApO1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLk1vZGVscy5DaGFydERhdGFNb2RlbDtcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0QXBwLk1vZGVscy5DaGFydE1vZGVsID0gQmFja2JvbmUuTW9kZWwuZXh0ZW5kKCB7XG5cblx0XHQvL3VybFJvb3Q6IEdsb2JhbC5yb290VXJsICsgJy9jaGFydHMvJyxcblx0XHQvL3VybFJvb3Q6IEdsb2JhbC5yb290VXJsICsgJy9kYXRhL2NvbmZpZy8nLFxuXHRcdHVybDogZnVuY3Rpb24oKSB7XG5cdFx0XHRpZiggJChcIiNmb3JtLXZpZXdcIikubGVuZ3RoICkge1xuXHRcdFx0XHRpZiggdGhpcy5pZCApIHtcblx0XHRcdFx0XHQvL2VkaXRpbmcgZXhpc3Rpbmdcblx0XHRcdFx0XHRyZXR1cm4gR2xvYmFsLnJvb3RVcmwgKyBcIi9jaGFydHMvXCIgKyB0aGlzLmlkO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vc2F2aW5nIG5ld1xuXHRcdFx0XHRcdHJldHVybiBHbG9iYWwucm9vdFVybCArIFwiL2NoYXJ0c1wiO1xuXHRcdFx0XHR9XG5cdFx0XHRcdFxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIEdsb2JhbC5yb290VXJsICsgXCIvZGF0YS9jb25maWcvXCIgKyB0aGlzLmlkO1xuXHRcdFx0fVxuXHRcdH0sXG5cblx0XHRkZWZhdWx0czoge1xuXHRcdFx0XCJjYWNoZVwiOiB0cnVlLFxuXHRcdFx0XCJzZWxlY3RlZC1jb3VudHJpZXNcIjogW10sXG5cdFx0XHRcInRhYnNcIjogWyBcImNoYXJ0XCIsIFwiZGF0YVwiLCBcInNvdXJjZXNcIiBdLFxuXHRcdFx0XCJsaW5lLXR5cGVcIjogXCIyXCIsXG5cdFx0XHRcImNoYXJ0LWRlc2NyaXB0aW9uXCI6IFwiXCIsXG5cdFx0XHRcImNoYXJ0LWRpbWVuc2lvbnNcIjogW10sXG5cdFx0XHRcInZhcmlhYmxlc1wiOiBbXSxcblx0XHRcdFwieS1heGlzXCI6IHt9LFxuXHRcdFx0XCJ4LWF4aXNcIjoge30sXG5cdFx0XHRcIm1hcmdpbnNcIjogeyB0b3A6IDEwLCBsZWZ0OiA2MCwgYm90dG9tOiAxMCwgcmlnaHQ6IDEwIH0sXG5cdFx0XHRcInVuaXRzXCI6IFwiXCIsXG5cdFx0XHRcImlmcmFtZS13aWR0aFwiOiBcIjEwMCVcIixcblx0XHRcdFwiaWZyYW1lLWhlaWdodFwiOiBcIjY2MHB4XCIsXG5cdFx0XHRcImhpZGUtbGVnZW5kXCI6IGZhbHNlLFxuXHRcdFx0XCJncm91cC1ieS12YXJpYWJsZXNcIjogZmFsc2UsXG5cdFx0XHRcImFkZC1jb3VudHJ5LW1vZGVcIjogXCJhZGQtY291bnRyeVwiLFxuXHRcdFx0XCJ4LWF4aXMtc2NhbGUtc2VsZWN0b3JcIjogZmFsc2UsXG5cdFx0XHRcInktYXhpcy1zY2FsZS1zZWxlY3RvclwiOiBmYWxzZSxcblx0XHRcdFwibWFwLWNvbmZpZ1wiOiB7XG5cdFx0XHRcdFwidmFyaWFibGVJZFwiOiAtMSxcblx0XHRcdFx0XCJtaW5ZZWFyXCI6IDE5ODAsXG5cdFx0XHRcdFwibWF4WWVhclwiOiAyMDAwLFxuXHRcdFx0XHRcInRhcmdldFllYXJcIjogMTk4MCxcblx0XHRcdFx0XCJtb2RlXCI6IFwic3BlY2lmaWNcIixcblx0XHRcdFx0XCJ0aW1lVG9sZXJhbmNlXCI6IDEwLFxuXHRcdFx0XHRcInRpbWVJbnRlcnZhbFwiOiAxMCxcblx0XHRcdFx0XCJjb2xvclNjaGVtZU5hbWVcIjogXCJCdUduXCIsXG5cdFx0XHRcdFwiY29sb3JTY2hlbWVJbnRlcnZhbFwiOiA1LFxuXHRcdFx0XHRcInByb2plY3Rpb25cIjogXCJXb3JsZFwiLFxuXHRcdFx0fVxuXHRcdH0sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbigpIHtcblxuXHRcdFx0dGhpcy5vbiggXCJzeW5jXCIsIHRoaXMub25TeW5jLCB0aGlzICk7XG5cdFx0XG5cdFx0fSxcblxuXHRcdG9uU3luYzogZnVuY3Rpb24oKSB7XG5cblx0XHRcdGlmKCB0aGlzLmdldCggXCJjaGFydC10eXBlXCIgKSA9PSAyICkge1xuXHRcdFx0XHQvL21ha2Ugc3VyZSBmb3Igc2NhdHRlciBwbG90LCB3ZSBoYXZlIGNvbG9yIHNldCBhcyBjb250aW5lbnRzXG5cdFx0XHRcdHZhciBjaGFydERpbWVuc2lvbnMgPSAkLnBhcnNlSlNPTiggdGhpcy5nZXQoIFwiY2hhcnQtZGltZW5zaW9uc1wiICkgKTtcblx0XHRcdFx0aWYoICFfLmZpbmRXaGVyZSggY2hhcnREaW1lbnNpb25zLCB7IFwicHJvcGVydHlcIjogXCJjb2xvclwiIH0gKSApIHtcblx0XHRcdFx0XHQvL3RoaXMgaXMgd2hlcmUgd2UgYWRkIGNvbG9yIHByb3BlcnR5XG5cdFx0XHRcdFx0dmFyIGNvbG9yUHJvcE9iaiA9IHsgXCJ2YXJpYWJsZUlkXCI6XCIxMjNcIixcInByb3BlcnR5XCI6XCJjb2xvclwiLFwidW5pdFwiOlwiXCIsXCJuYW1lXCI6XCJDb2xvclwiLFwicGVyaW9kXCI6XCJzaW5nbGVcIixcIm1vZGVcIjpcInNwZWNpZmljXCIsXCJ0YXJnZXRZZWFyXCI6XCIyMDAwXCIsXCJ0b2xlcmFuY2VcIjpcIjVcIixcIm1heGltdW1BZ2VcIjpcIjVcIn07XG5cdFx0XHRcdFx0Y2hhcnREaW1lbnNpb25zLnB1c2goIGNvbG9yUHJvcE9iaiApO1xuXHRcdFx0XHRcdHZhciBjaGFyRGltZW5zaW9uc1N0cmluZyA9IEpTT04uc3RyaW5naWZ5KCBjaGFydERpbWVuc2lvbnMgKTtcblx0XHRcdFx0XHR0aGlzLnNldCggXCJjaGFydC1kaW1lbnNpb25zXCIsIGNoYXJEaW1lbnNpb25zU3RyaW5nICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdFxuXHRcdH0sXG5cblx0XHRhZGRTZWxlY3RlZENvdW50cnk6IGZ1bmN0aW9uKCBjb3VudHJ5ICkge1xuXG5cdFx0XHQvL21ha2Ugc3VyZSB3ZSdyZSB1c2luZyBvYmplY3QsIG5vdCBhc3NvY2lhdGl2ZSBhcnJheVxuXHRcdFx0LyppZiggJC5pc0FycmF5KCB0aGlzLmdldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiApICkgKSB7XG5cdFx0XHRcdC8vd2UgZ290IGVtcHR5IGFycmF5IGZyb20gZGIsIGNvbnZlcnQgdG8gb2JqZWN0XG5cdFx0XHRcdHRoaXMuc2V0KCBcInNlbGVjdGVkLWNvdW50cmllc1wiLCB7fSApO1xuXHRcdFx0fSovXG5cdFx0XHRcblx0XHRcdHZhciBzZWxlY3RlZENvdW50cmllcyA9IHRoaXMuZ2V0KCBcInNlbGVjdGVkLWNvdW50cmllc1wiICk7XG5cblx0XHRcdC8vbWFrZSBzdXJlIHRoZSBzZWxlY3RlZCBjb250cnkgaXMgbm90IHRoZXJlIFxuXHRcdFx0aWYoICFfLmZpbmRXaGVyZSggc2VsZWN0ZWRDb3VudHJpZXMsIHsgaWQ6IGNvdW50cnkuaWQgfSApICkge1xuXHRcdFx0XG5cdFx0XHRcdHNlbGVjdGVkQ291bnRyaWVzLnB1c2goIGNvdW50cnkgKTtcblx0XHRcdFx0Ly9zZWxlY3RlZENvdW50cmllc1sgY291bnRyeS5pZCBdID0gY291bnRyeTtcblx0XHRcdFx0dGhpcy50cmlnZ2VyKCBcImNoYW5nZTpzZWxlY3RlZC1jb3VudHJpZXNcIiApO1xuXHRcdFx0XHR0aGlzLnRyaWdnZXIoIFwiY2hhbmdlXCIgKTtcblx0XHRcdFxuXHRcdFx0fVxuXHRcdFx0XG5cdFx0fSxcblxuXHRcdHVwZGF0ZVNlbGVjdGVkQ291bnRyeTogZnVuY3Rpb24oIGNvdW50cnlJZCwgY29sb3IgKSB7XG5cblx0XHRcdHZhciBjb3VudHJ5ID0gdGhpcy5maW5kQ291bnRyeUJ5SWQoIGNvdW50cnlJZCApO1xuXHRcdFx0aWYoIGNvdW50cnkgKSB7XG5cdFx0XHRcdGNvdW50cnkuY29sb3IgPSBjb2xvcjtcblx0XHRcdFx0dGhpcy50cmlnZ2VyKCBcImNoYW5nZTpzZWxlY3RlZC1jb3VudHJpZXNcIiApO1xuXHRcdFx0XHR0aGlzLnRyaWdnZXIoIFwiY2hhbmdlXCIgKTtcblx0XHRcdH1cblxuXHRcdH0sXG5cblx0XHRyZW1vdmVTZWxlY3RlZENvdW50cnk6IGZ1bmN0aW9uKCBjb3VudHJ5SWQgKSB7XG5cblx0XHRcdHZhciBjb3VudHJ5ID0gdGhpcy5maW5kQ291bnRyeUJ5SWQoIGNvdW50cnlJZCApO1xuXHRcdFx0aWYoIGNvdW50cnkgKSB7XG5cdFx0XHRcdHZhciBzZWxlY3RlZENvdW50cmllcyA9IHRoaXMuZ2V0KCBcInNlbGVjdGVkLWNvdW50cmllc1wiICksXG5cdFx0XHRcdFx0Y291bnRyeUluZGV4ID0gXy5pbmRleE9mKCBzZWxlY3RlZENvdW50cmllcywgY291bnRyeSApO1xuXHRcdFx0XHRzZWxlY3RlZENvdW50cmllcy5zcGxpY2UoIGNvdW50cnlJbmRleCwgMSApO1xuXHRcdFx0XHR0aGlzLnRyaWdnZXIoIFwiY2hhbmdlOnNlbGVjdGVkLWNvdW50cmllc1wiICk7XG5cdFx0XHRcdHRoaXMudHJpZ2dlciggXCJjaGFuZ2VcIiApO1xuXHRcdFx0fVxuXG5cdFx0fSxcblxuXHRcdHJlcGxhY2VTZWxlY3RlZENvdW50cnk6IGZ1bmN0aW9uKCBjb3VudHJ5ICkge1xuXHRcdFx0aWYoIGNvdW50cnkgKSB7XG5cdFx0XHRcdHRoaXMuc2V0KCBcInNlbGVjdGVkLWNvdW50cmllc1wiLCBbIGNvdW50cnkgXSApO1xuXHRcdFx0fVxuXHRcdH0sXG5cblx0XHRmaW5kQ291bnRyeUJ5SWQ6IGZ1bmN0aW9uKCBjb3VudHJ5SWQgKSB7XG5cblx0XHRcdHZhciBzZWxlY3RlZENvdW50cmllcyA9IHRoaXMuZ2V0KCBcInNlbGVjdGVkLWNvdW50cmllc1wiICksXG5cdFx0XHRcdGNvdW50cnkgPSBfLmZpbmRXaGVyZSggc2VsZWN0ZWRDb3VudHJpZXMsIHsgaWQ6IGNvdW50cnlJZC50b1N0cmluZygpIH0gKTtcblx0XHRcdHJldHVybiBjb3VudHJ5O1xuXG5cdFx0fSxcblxuXHRcdHNldEF4aXNDb25maWc6IGZ1bmN0aW9uKCBheGlzTmFtZSwgcHJvcCwgdmFsdWUgKSB7XG5cblx0XHRcdGlmKCAkLmlzQXJyYXkoIHRoaXMuZ2V0KCBcInktYXhpc1wiICkgKSApIHtcblx0XHRcdFx0Ly93ZSBnb3QgZW1wdHkgYXJyYXkgZnJvbSBkYiwgY29udmVydCB0byBvYmplY3Rcblx0XHRcdFx0dGhpcy5zZXQoIFwieS1heGlzXCIsIHt9ICk7XG5cdFx0XHR9XG5cdFx0XHRpZiggJC5pc0FycmF5KCB0aGlzLmdldCggXCJ4LWF4aXNcIiApICkgKSB7XG5cdFx0XHRcdC8vd2UgZ290IGVtcHR5IGFycmF5IGZyb20gZGIsIGNvbnZlcnQgdG8gb2JqZWN0XG5cdFx0XHRcdHRoaXMuc2V0KCBcIngtYXhpc1wiLCB7fSApO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHR2YXIgYXhpcyA9IHRoaXMuZ2V0KCBheGlzTmFtZSApO1xuXHRcdFx0aWYoIGF4aXMgKSB7XG5cdFx0XHRcdGF4aXNbIHByb3AgXSA9IHZhbHVlO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy50cmlnZ2VyKCBcImNoYW5nZVwiICk7XG5cblx0XHR9LFxuXG5cdFx0dXBkYXRlVmFyaWFibGVzOiBmdW5jdGlvbiggbmV3VmFyICkge1xuXHRcdFx0Ly9jb3B5IGFycmF5XG5cdFx0XHR2YXIgdmFyaWFibGVzID0gdGhpcy5nZXQoIFwidmFyaWFibGVzXCIgKS5zbGljZSgpLFxuXHRcdFx0XHR2YXJJbkFyciA9IF8uZmluZCggdmFyaWFibGVzLCBmdW5jdGlvbiggdiApeyByZXR1cm4gdi5pZCA9PSBuZXdWYXIuaWQ7IH0gKTtcblxuXHRcdFx0aWYoICF2YXJJbkFyciApIHtcblx0XHRcdFx0dmFyaWFibGVzLnB1c2goIG5ld1ZhciApO1xuXHRcdFx0XHR0aGlzLnNldCggXCJ2YXJpYWJsZXNcIiwgdmFyaWFibGVzICk7XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdHJlbW92ZVZhcmlhYmxlOiBmdW5jdGlvbiggdmFySWRUb1JlbW92ZSApIHtcblx0XHRcdC8vY29weSBhcnJheVxuXHRcdFx0dmFyIHZhcmlhYmxlcyA9IHRoaXMuZ2V0KCBcInZhcmlhYmxlc1wiICkuc2xpY2UoKSxcblx0XHRcdFx0dmFySW5BcnIgPSBfLmZpbmQoIHZhcmlhYmxlcywgZnVuY3Rpb24oIHYgKXsgcmV0dXJuIHYuaWQgPT0gbmV3VmFyLmlkOyB9ICk7XG5cblx0XHRcdGlmKCAhdmFySW5BcnIgKSB7XG5cdFx0XHRcdHZhcmlhYmxlcy5wdXNoKCBuZXdWYXIgKTtcblx0XHRcdFx0dGhpcy5zZXQoIFwidmFyaWFibGVzXCIsIHZhcmlhYmxlcyApO1xuXHRcdFx0fVxuXHRcdH0sXG5cblx0XHR1cGRhdGVNYXBDb25maWc6IGZ1bmN0aW9uKCBwcm9wTmFtZSwgcHJvcFZhbHVlLCBzaWxlbnQsIGV2ZW50TmFtZSApIHtcblxuXHRcdFx0dmFyIG1hcENvbmZpZyA9IHRoaXMuZ2V0KCBcIm1hcC1jb25maWdcIiApO1xuXHRcdFx0aWYoIG1hcENvbmZpZy5oYXNPd25Qcm9wZXJ0eSggcHJvcE5hbWUgKSApIHtcblx0XHRcdFx0bWFwQ29uZmlnWyBwcm9wTmFtZSBdID0gcHJvcFZhbHVlO1xuXHRcdFx0XHRpZiggIXNpbGVudCApIHtcblx0XHRcdFx0XHR2YXIgZXZ0ID0gKCBldmVudE5hbWUgKT8gZXZlbnROYW1lOiBcImNoYW5nZVwiO1xuXHRcdFx0XHRcdHRoaXMudHJpZ2dlciggZXZ0ICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdH1cblxuXG5cdH0gKTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5Nb2RlbHMuQ2hhcnRNb2RlbDtcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBDaGFydFZpZXcgPSByZXF1aXJlKCBcIi4vQXBwLlZpZXdzLkNoYXJ0Vmlldy5qc1wiICk7XG5cblx0QXBwLlZpZXdzLkNoYXJ0ID0gQmFja2JvbmUuVmlldy5leHRlbmQoe1xuXG5cdFx0ZXZlbnRzOiB7fSxcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKCkge30sXG5cblx0XHRzdGFydDogZnVuY3Rpb24oKSB7XG5cdFx0XHQvL3JlbmRlciBldmVyeXRoaW5nIGZvciB0aGUgZmlyc3QgdGltZVxuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdFxuXHRcdFx0dmFyIGRpc3BhdGNoZXIgPSBfLmNsb25lKCBCYWNrYm9uZS5FdmVudHMgKTtcblx0XHRcdHRoaXMuZGlzcGF0Y2hlciA9IGRpc3BhdGNoZXI7XG5cblx0XHRcdHRoaXMuY2hhcnRWaWV3ID0gbmV3IENoYXJ0VmlldyggeyBkaXNwYXRjaGVyOiBkaXNwYXRjaGVyIH0gKTtcblx0XHRcdFxuXHRcdH1cblxuXHR9KTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5DaGFydDtcblxufSkoKTtcbiIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIEhlYWRlciA9IHJlcXVpcmUoIFwiLi9jaGFydC9BcHAuVmlld3MuQ2hhcnQuSGVhZGVyLmpzXCIgKSxcblx0XHRTY2FsZVNlbGVjdG9ycyA9IHJlcXVpcmUoIFwiLi9jaGFydC9BcHAuVmlld3MuQ2hhcnQuU2NhbGVTZWxlY3RvcnNcIiApLFxuXHRcdENoYXJ0VGFiID0gcmVxdWlyZSggXCIuL2NoYXJ0L0FwcC5WaWV3cy5DaGFydC5DaGFydFRhYi5qc1wiICksXG5cdFx0RGF0YVRhYiA9IHJlcXVpcmUoIFwiLi9jaGFydC9BcHAuVmlld3MuQ2hhcnQuRGF0YVRhYi5qc1wiICksXG5cdFx0U291cmNlc1RhYiA9IHJlcXVpcmUoIFwiLi9jaGFydC9BcHAuVmlld3MuQ2hhcnQuU291cmNlc1RhYi5qc1wiICksXG5cdFx0TWFwVGFiID0gcmVxdWlyZSggXCIuL2NoYXJ0L0FwcC5WaWV3cy5DaGFydC5NYXBUYWIuanNcIiApLFxuXHRcdENoYXJ0RGF0YU1vZGVsID0gcmVxdWlyZSggXCIuLy4uL21vZGVscy9BcHAuTW9kZWxzLkNoYXJ0RGF0YU1vZGVsLmpzXCIgKSxcblx0XHRVdGlscyA9IHJlcXVpcmUoIFwiLi8uLi9BcHAuVXRpbHMuanNcIiApO1xuXG5cdEFwcC5WaWV3cy5DaGFydFZpZXcgPSBCYWNrYm9uZS5WaWV3LmV4dGVuZCh7XG5cblx0XHRlbDogXCIjY2hhcnQtdmlld1wiLFxuXHRcdGV2ZW50czoge1xuXHRcdFx0XCJjbGljayAuY2hhcnQtc2F2ZS1wbmctYnRuXCI6IFwiZXhwb3J0Q29udGVudFwiLFxuXHRcdFx0XCJjbGljayAuY2hhcnQtc2F2ZS1zdmctYnRuXCI6IFwiZXhwb3J0Q29udGVudFwiXG5cdFx0fSxcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0XG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIgPSBvcHRpb25zLmRpc3BhdGNoZXI7XG5cdFx0XHRcblx0XHRcdHZhciBjaGlsZFZpZXdPcHRpb25zID0geyBkaXNwYXRjaGVyOiB0aGlzLmRpc3BhdGNoZXIsIHBhcmVudFZpZXc6IHRoaXMgfTtcblx0XHRcdHRoaXMuaGVhZGVyID0gbmV3IEhlYWRlciggY2hpbGRWaWV3T3B0aW9ucyApO1xuXHRcdFx0dGhpcy5zY2FsZVNlbGVjdG9ycyA9IG5ldyBTY2FsZVNlbGVjdG9ycyggY2hpbGRWaWV3T3B0aW9ucyApO1xuXHRcdFx0Ly90YWJzXG5cdFx0XHR0aGlzLmNoYXJ0VGFiID0gbmV3IENoYXJ0VGFiKCBjaGlsZFZpZXdPcHRpb25zICk7XG5cdFx0XHR0aGlzLmRhdGFUYWIgPSBuZXcgRGF0YVRhYiggY2hpbGRWaWV3T3B0aW9ucyApO1xuXHRcdFx0dGhpcy5zb3VyY2VzVGFiID0gbmV3IFNvdXJjZXNUYWIoIGNoaWxkVmlld09wdGlvbnMgKTtcblx0XHRcdHRoaXMubWFwVGFiID0gbmV3IE1hcFRhYiggY2hpbGRWaWV3T3B0aW9ucyApO1xuXG5cdFx0XHQvL3NldHVwIG1vZGVsIHRoYXQgd2lsbCBmZXRjaCBhbGwgdGhlIGRhdGEgZm9yIHVzXG5cdFx0XHR0aGlzLmRhdGFNb2RlbCA9IG5ldyBDaGFydERhdGFNb2RlbCgpO1xuXHRcdFx0XG5cdFx0XHQvL3NldHVwIGV2ZW50c1xuXHRcdFx0dGhpcy5kYXRhTW9kZWwub24oIFwic3luY1wiLCB0aGlzLm9uRGF0YU1vZGVsU3luYywgdGhpcyApO1xuXHRcdFx0dGhpcy5kYXRhTW9kZWwub24oIFwiZXJyb3JcIiwgdGhpcy5vbkRhdGFNb2RlbEVycm9yLCB0aGlzICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5vbiggXCJjaGFuZ2VcIiwgdGhpcy5vbkNoYXJ0TW9kZWxDaGFuZ2UsIHRoaXMgKTtcblxuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblxuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cblx0XHRcdHRoaXMuJHByZWxvYWRlciA9IHRoaXMuJGVsLmZpbmQoIFwiLmNoYXJ0LXByZWxvYWRlclwiICk7XG5cdFx0XHR0aGlzLiRlcnJvciA9IHRoaXMuJGVsLmZpbmQoIFwiLmNoYXJ0LWVycm9yXCIgKTtcblxuXHRcdFx0Ly9jaGFydCB0YWJcblx0XHRcdHRoaXMuJHN2ZyA9IHRoaXMuJGVsLmZpbmQoIFwiI2NoYXJ0LWNoYXJ0LXRhYiBzdmdcIiApO1xuXHRcdFx0dGhpcy4kdGFiQ29udGVudCA9IHRoaXMuJGVsLmZpbmQoIFwiLnRhYi1jb250ZW50XCIgKTtcblx0XHRcdHRoaXMuJHRhYlBhbmVzID0gdGhpcy4kZWwuZmluZCggXCIudGFiLXBhbmVcIiApO1xuXHRcdFx0dGhpcy4kY2hhcnRIZWFkZXIgPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1oZWFkZXJcIiApO1xuXHRcdFx0dGhpcy4kZW50aXRpZXNTZWxlY3QgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPWF2YWlsYWJsZV9lbnRpdGllc11cIiApO1xuXHRcdFx0dGhpcy4kY2hhcnRGb290ZXIgPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1mb290ZXJcIiApO1xuXHRcdFx0dGhpcy4kY2hhcnROYW1lID0gdGhpcy4kZWwuZmluZCggXCIuY2hhcnQtbmFtZVwiICk7XG5cdFx0XHR0aGlzLiRjaGFydFN1Ym5hbWUgPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1zdWJuYW1lXCIgKTtcblx0XHRcdHRoaXMuJGNoYXJ0RGVzY3JpcHRpb24gPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1kZXNjcmlwdGlvblwiICk7XG5cdFx0XHR0aGlzLiRjaGFydFNvdXJjZXMgPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1zb3VyY2VzXCIgKTtcblx0XHRcdHRoaXMuJGNoYXJ0RnVsbFNjcmVlbiA9IHRoaXMuJGVsLmZpbmQoIFwiLmZhbmN5Ym94LWlmcmFtZVwiICk7XG5cblx0XHRcdHRoaXMuJHhBeGlzU2NhbGVTZWxlY3RvciA9IHRoaXMuJGVsLmZpbmQoIFwiLngtYXhpcy1zY2FsZS1zZWxlY3RvclwiICk7XG5cdFx0XHR0aGlzLiR4QXhpc1NjYWxlID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT14X2F4aXNfc2NhbGVdXCIgKTtcblx0XHRcdHRoaXMuJHlBeGlzU2NhbGVTZWxlY3RvciA9IHRoaXMuJGVsLmZpbmQoIFwiLnktYXhpcy1zY2FsZS1zZWxlY3RvclwiICk7XG5cdFx0XHR0aGlzLiR5QXhpc1NjYWxlID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT15X2F4aXNfc2NhbGVdXCIgKTtcblxuXHRcdFx0dGhpcy4kcmVsb2FkQnRuID0gdGhpcy4kZWwuZmluZCggXCIucmVsb2FkLWJ0blwiICk7XG5cblx0XHRcdHZhciBjaGFydE5hbWUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtbmFtZVwiICksXG5cdFx0XHRcdGFkZENvdW50cnlNb2RlID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImFkZC1jb3VudHJ5LW1vZGVcIiApLFxuXHRcdFx0XHRmb3JtQ29uZmlnID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImZvcm0tY29uZmlnXCIgKSxcblx0XHRcdFx0ZW50aXRpZXMgPSAoIGZvcm1Db25maWcgJiYgZm9ybUNvbmZpZ1sgXCJlbnRpdGllcy1jb2xsZWN0aW9uXCIgXSApPyBmb3JtQ29uZmlnWyBcImVudGl0aWVzLWNvbGxlY3Rpb25cIiBdOiBbXSxcblx0XHRcdFx0c2VsZWN0ZWRDb3VudHJpZXMgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwic2VsZWN0ZWQtY291bnRyaWVzXCIgKSxcblx0XHRcdFx0c2VsZWN0ZWRDb3VudHJpZXNJZHMgPSBfLm1hcCggc2VsZWN0ZWRDb3VudHJpZXMsIGZ1bmN0aW9uKCB2ICkgeyByZXR1cm4gKHYpPyArdi5pZDogXCJcIjsgfSApLFxuXHRcdFx0XHRjaGFydFRpbWUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdGltZVwiICk7XG5cdFx0XHRcdFxuXHRcdFx0Ly9taWdodCBuZWVkIHRvIHJlcGxhY2UgY291bnRyeSBpbiB0aXRsZSwgaWYgXCJjaGFuZ2UgY291bnRyeVwiIG1vZGVcblx0XHRcdGlmKCBhZGRDb3VudHJ5TW9kZSA9PT0gXCJjaGFuZ2UtY291bnRyeVwiICkge1xuXHRcdFx0XHQvL3llcCwgcHJvYmFibHkgbmVlZCByZXBsYWNpbmcgY291bnRyeSBpbiB0aXRsZSAoc2VsZWN0IGZpcnN0IGNvdW50cnkgZm9ybSBzdG9yZWQgb25lKVxuXHRcdFx0XHRpZiggc2VsZWN0ZWRDb3VudHJpZXMgJiYgc2VsZWN0ZWRDb3VudHJpZXMubGVuZ3RoICkge1xuXHRcdFx0XHRcdHZhciBjb3VudHJ5ID0gc2VsZWN0ZWRDb3VudHJpZXNbMF07XG5cdFx0XHRcdFx0Y2hhcnROYW1lID0gY2hhcnROYW1lLnJlcGxhY2UoIFwiKmNvdW50cnkqXCIsIGNvdW50cnkubmFtZSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vdXBkYXRlIHZhbHVlc1xuXHRcdFx0dGhpcy4kY2hhcnROYW1lLnRleHQoIGNoYXJ0TmFtZSApO1xuXHRcdFx0dGhpcy4kY2hhcnRTdWJuYW1lLmh0bWwoIEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC1zdWJuYW1lXCIgKSApO1xuXG5cdFx0XHR2YXIgY2hhcnREZXNjcmlwdGlvbiA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC1kZXNjcmlwdGlvblwiICk7XG5cdFx0XHQvL3RoaXMuJGNoYXJ0RGVzY3JpcHRpb24udGV4dCggQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LWRlc2NyaXB0aW9uXCIgKSApO1xuXG5cdFx0XHQvL3Nob3cvaGlkZSBzY2FsZSBzZWxlY3RvcnNcblx0XHRcdHZhciBzaG93WFNjYWxlU2VsZWN0b3JzID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcIngtYXhpcy1zY2FsZS1zZWxlY3RvclwiICk7XG5cdFx0XHRpZiggc2hvd1hTY2FsZVNlbGVjdG9ycyApIHtcblx0XHRcdFx0dGhpcy4keEF4aXNTY2FsZVNlbGVjdG9yLnNob3coKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuJHhBeGlzU2NhbGVTZWxlY3Rvci5oaWRlKCk7XG5cdFx0XHR9XG5cdFx0XHR2YXIgc2hvd1lTY2FsZVNlbGVjdG9ycyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJ5LWF4aXMtc2NhbGUtc2VsZWN0b3JcIiApO1xuXHRcdFx0aWYoIHNob3dZU2NhbGVTZWxlY3RvcnMgKSB7XG5cdFx0XHRcdHRoaXMuJHlBeGlzU2NhbGVTZWxlY3Rvci5zaG93KCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLiR5QXhpc1NjYWxlU2VsZWN0b3IuaGlkZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHQvL3VwZGF0ZSBjb3VudHJpZXNcblx0XHRcdHRoaXMuJGVudGl0aWVzU2VsZWN0LmVtcHR5KCk7XG5cdFx0XHRpZiggc2VsZWN0ZWRDb3VudHJpZXNJZHMubGVuZ3RoICkge1xuXHRcdFx0XHQvL2FwcGVuZCBlbXB0eSBkZWZhdWx0IG9wdGlvblxuXHRcdFx0XHR0aGF0LiRlbnRpdGllc1NlbGVjdC5hcHBlbmQoIFwiPG9wdGlvbiBkaXNhYmxlZCBzZWxlY3RlZD5TZWxlY3QgY291bnRyeTwvb3B0aW9uPlwiICk7XG5cdFx0XHRcdF8uZWFjaCggZW50aXRpZXMsIGZ1bmN0aW9uKCBkLCBpICkge1xuXHRcdFx0XHRcdC8vYWRkIG9ubHkgdGhvc2UgZW50aXRpZXMsIHdoaWNoIGFyZSBub3Qgc2VsZWN0ZWQgYWxyZWFkeVxuXHRcdFx0XHRcdGlmKCBfLmluZGV4T2YoIHNlbGVjdGVkQ291bnRyaWVzSWRzLCArZC5pZCApID09IC0xICkge1xuXHRcdFx0XHRcdFx0dGhhdC4kZW50aXRpZXNTZWxlY3QuYXBwZW5kKCBcIjxvcHRpb24gdmFsdWU9J1wiICsgZC5pZCArIFwiJz5cIiArIGQubmFtZSArIFwiPC9vcHRpb24+XCIgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gKTtcblx0XHRcdH1cblx0XHRcdC8vbWFrZSBjaG9zZW4gdXBkYXRlLCBtYWtlIHN1cmUgaXQgbG9vc2VzIGJsdXIgYXMgd2VsbFxuXHRcdFx0dGhpcy4kZW50aXRpZXNTZWxlY3QudHJpZ2dlciggXCJjaG9zZW46dXBkYXRlZFwiICk7XG5cblx0XHRcdHRoaXMuJGNoYXJ0RnVsbFNjcmVlbi5vbiggXCJjbGlja1wiLCBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0dmFyICR0aGlzID0gJCggdGhpcyApO1xuXHRcdFx0XHR3aW5kb3cucGFyZW50Lm9wZW5GYW5jeUJveCggJHRoaXMuYXR0ciggXCJocmVmXCIgKSApO1xuXHRcdFx0fSApO1xuXG5cdFx0XHQvL3JlZnJlc2ggYnRuXG5cdFx0XHR0aGlzLiRyZWxvYWRCdG4ub24oIFwiY2xpY2tcIiwgZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKTtcblx0XHRcdH0gKTtcblxuXHRcdFx0Ly9jaGFydCB0YWJcblx0XHRcdHRoaXMuJGNoYXJ0VGFiID0gdGhpcy4kZWwuZmluZCggXCIjY2hhcnQtY2hhcnQtdGFiXCIgKTtcblxuXHRcdFx0dmFyIGRpbWVuc2lvbnNTdHJpbmcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtZGltZW5zaW9uc1wiICksXG5cdFx0XHRcdHZhbGlkRGltZW5zaW9ucyA9IGZhbHNlO1xuXHRcdFx0XG5cdFx0XHQvL2NsaWNraW5nIGFueXRoaW5nIGluIGNoYXJ0IHNvdXJjZSB3aWxsIHRha2UgeW91IHRvIHNvdXJjZXMgdGFiXG5cdFx0XHR0aGlzLiRjaGFydFNvdXJjZXMub24oIFwiY2xpY2tcIiwgZnVuY3Rpb24oZXZ0KSB7XG5cdFx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHR2YXIgJGEgPSAkKCBcIltocmVmPScjc291cmNlcy1jaGFydC10YWInXVwiICk7XG5cdFx0XHRcdCRhLnRyaWdnZXIoIFwiY2xpY2tcIiApO1xuXHRcdFx0fSApO1xuXG5cdFx0XHQvL2NoZWNrIHdlIGhhdmUgYWxsIGRpbWVuc2lvbnMgbmVjZXNzYXJ5IFxuXHRcdFx0aWYoICEkLmlzRW1wdHlPYmplY3QoIGRpbWVuc2lvbnNTdHJpbmcgKSApIHtcblx0XHRcdFx0dmFyIGRpbWVuc2lvbiA9ICQucGFyc2VKU09OKCBkaW1lbnNpb25zU3RyaW5nICk7XG5cdFx0XHRcdHZhbGlkRGltZW5zaW9ucyA9IFV0aWxzLmNoZWNrVmFsaWREaW1lbnNpb25zKCBkaW1lbnNpb24sIEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10eXBlXCIgKSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vbWFrZSBzdXJlIHRvIGFwcGVhciBvbmx5IGZpcnN0IHRhYiB0YWJzIHRoYXQgYXJlIG5lY2Vzc2FyeVxuXHRcdFx0Ly9hcHBlYXIgb25seSBmaXJzdCB0YWIgaWYgbm9uZSB2aXNpYmxlXG5cdFx0XHRpZiggIXRoaXMuJHRhYlBhbmVzLmZpbHRlciggXCIuYWN0aXZlXCIgKS5sZW5ndGggKSB7XG5cdFx0XHRcdHZhciB0YWJzID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcInRhYnNcIiApLFxuXHRcdFx0XHRcdGZpcnN0VGFiTmFtZSA9IHRhYnNbIDAgXSxcblx0XHRcdFx0XHRmaXJzdFRhYlBhbmUgPSB0aGlzLiR0YWJQYW5lcy5maWx0ZXIoIFwiI1wiICsgZmlyc3RUYWJOYW1lICsgXCItY2hhcnQtdGFiXCIgKTtcblx0XHRcdFx0Zmlyc3RUYWJQYW5lLmFkZENsYXNzKCBcImFjdGl2ZVwiICk7XG5cdFx0XHRcdGlmKCBmaXJzdFRhYk5hbWUgPT09IFwibWFwXCIgKSB7XG5cdFx0XHRcdFx0Ly9tYXAgdGFiIG5lZWRzIHNwZWNpYWwgaW5pYWxpdGl6YXRpb25cblx0XHRcdFx0XHR0aGlzLm1hcFRhYi5kaXNwbGF5KCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0aWYoICF2YWxpZERpbWVuc2lvbnMgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0aWYoIGRpbWVuc2lvbnNTdHJpbmcgKSB7XG5cblx0XHRcdFx0dGhpcy4kcHJlbG9hZGVyLnNob3coKTtcblxuXHRcdFx0XHR2YXIgZGF0YVByb3BzID0geyBcImRpbWVuc2lvbnNcIjogZGltZW5zaW9uc1N0cmluZywgXCJjaGFydElkXCI6IEFwcC5DaGFydE1vZGVsLmdldCggXCJpZFwiICksIFwiY2hhcnRUeXBlXCI6IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10eXBlXCIgKSwgXCJzZWxlY3RlZENvdW50cmllc1wiOiBzZWxlY3RlZENvdW50cmllc0lkcywgXCJjaGFydFRpbWVcIjogY2hhcnRUaW1lLCBcImNhY2hlXCI6IEFwcC5DaGFydE1vZGVsLmdldCggXCJjYWNoZVwiICksIFwiZ3JvdXBCeVZhcmlhYmxlc1wiOiBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiZ3JvdXAtYnktdmFyaWFibGVzXCIgKSAgfTtcblx0XHRcdFx0XG5cdFx0XHRcdHRoaXMuZGF0YU1vZGVsLmZldGNoKCB7IGRhdGE6IGRhdGFQcm9wcyB9ICk7XG5cblx0XHRcdH0gZWxzZSB7XG5cblx0XHRcdFx0Ly9jbGVhciBhbnkgcHJldmlvdXMgY2hhcnRcblx0XHRcdFx0JCggXCJzdmdcIiApLmVtcHR5KCk7XG5cblx0XHRcdH1cblxuXHRcdH0sXG5cblx0XHRvbkNoYXJ0TW9kZWxDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdHRoaXMucmVuZGVyKCk7XG5cdFx0XHRcblx0XHR9LFxuXG5cdFx0b25EYXRhTW9kZWxTeW5jOiBmdW5jdGlvbiggbW9kZWwsIHJlc3BvbnNlICkge1xuXHRcdFx0dGhpcy4kZXJyb3IuaGlkZSgpO1xuXHRcdFx0dGhpcy4kcHJlbG9hZGVyLmhpZGUoKTtcblx0XHRcdGlmKCByZXNwb25zZS5kYXRhICkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZUNoYXJ0KCByZXNwb25zZS5kYXRhLCByZXNwb25zZS50aW1lVHlwZSwgcmVzcG9uc2UuZGltZW5zaW9ucyApO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5zb3VyY2VzVGFiLnJlbmRlciggcmVzcG9uc2UgKTtcblx0XHR9LFxuXG5cdFx0b25EYXRhTW9kZWxFcnJvcjogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLiRlcnJvci5zaG93KCk7XG5cdFx0XHR0aGlzLiRwcmVsb2FkZXIuaGlkZSgpO1xuXHRcdH0sXG5cblx0XHRleHBvcnRDb250ZW50OiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0XG5cdFx0XHQvL2h0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMjMyMTgxNzQvaG93LWRvLWktc2F2ZS1leHBvcnQtYW4tc3ZnLWZpbGUtYWZ0ZXItY3JlYXRpbmctYW4tc3ZnLXdpdGgtZDMtanMtaWUtc2FmYXJpLWFuXG5cdFx0XHR2YXIgJGJ0biA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICksXG5cdFx0XHRcdC8vc3RvcmUgcHJlLXByaW50aW5nIHN2Z1xuXHRcdFx0XHQkb2xkRWwgPSB0aGlzLiRlbCxcblx0XHRcdFx0JG5ld0VsID0gJG9sZEVsLmNsb25lKCksXG5cdFx0XHRcdGlzU3ZnID0gKCAkYnRuLmhhc0NsYXNzKCBcImNoYXJ0LXNhdmUtc3ZnLWJ0blwiICkgKT8gdHJ1ZTogZmFsc2U7XG5cdFx0XHRcblx0XHRcdCRvbGRFbC5yZXBsYWNlV2l0aCggJG5ld0VsICk7XG5cblx0XHRcdC8vZ3JhYiBhbGwgc3ZnXG5cdFx0XHR2YXIgJHN2ZyA9ICRuZXdFbC5maW5kKCBcInN2Z1wiICksXG5cdFx0XHRcdHN2ZyA9ICRzdmcuZ2V0KCAwICksXG5cdFx0XHRcdHN2Z1N0cmluZyA9IHN2Zy5vdXRlckhUTUw7XG5cblx0XHRcdC8vYWRkIHByaW50aW5nIHN0eWxlc1xuXHRcdFx0JHN2Zy5hdHRyKCBcImNsYXNzXCIsIFwibnZkMy1zdmcgZXhwb3J0LXN2Z1wiICk7XG5cblx0XHRcdC8vaW5saW5lIHN0eWxlcyBmb3IgdGhlIGV4cG9ydFxuXHRcdFx0dmFyIHN0eWxlU2hlZXRzID0gZG9jdW1lbnQuc3R5bGVTaGVldHM7XG5cdFx0XHRmb3IoIHZhciBpID0gMDsgaSA8IHN0eWxlU2hlZXRzLmxlbmd0aDsgaSsrICkge1xuXHRcdFx0XHRVdGlscy5pbmxpbmVDc3NTdHlsZSggc3R5bGVTaGVldHNbIGkgXS5jc3NSdWxlcyApO1xuXHRcdFx0fVxuXG5cdFx0XHQvL2RlcGVuZGluZyB3aGV0aGVyIHdlJ3JlIGNyZWF0aW5nIHN2ZyBvciBwbmcsIFxuXHRcdFx0aWYoIGlzU3ZnICkge1xuXG5cdFx0XHRcdHZhciBzZXJpYWxpemVyID0gbmV3IFhNTFNlcmlhbGl6ZXIoKSxcblx0XHRcdFx0c291cmNlID0gc2VyaWFsaXplci5zZXJpYWxpemVUb1N0cmluZyhzdmcpO1xuXHRcdFx0XHQvL2FkZCBuYW1lIHNwYWNlcy5cblx0XHRcdFx0aWYoIXNvdXJjZS5tYXRjaCgvXjxzdmdbXj5dK3htbG5zPVwiaHR0cFxcOlxcL1xcL3d3d1xcLnczXFwub3JnXFwvMjAwMFxcL3N2Z1wiLykpe1xuXHRcdFx0XHRcdHNvdXJjZSA9IHNvdXJjZS5yZXBsYWNlKC9ePHN2Zy8sICc8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIicpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmKCFzb3VyY2UubWF0Y2goL148c3ZnW14+XStcImh0dHBcXDpcXC9cXC93d3dcXC53M1xcLm9yZ1xcLzE5OTlcXC94bGlua1wiLykpe1xuXHRcdFx0XHRcdHNvdXJjZSA9IHNvdXJjZS5yZXBsYWNlKC9ePHN2Zy8sICc8c3ZnIHhtbG5zOnhsaW5rPVwiaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGlua1wiJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdC8vYWRkIHhtbCBkZWNsYXJhdGlvblxuXHRcdFx0XHRzb3VyY2UgPSAnPD94bWwgdmVyc2lvbj1cIjEuMFwiIHN0YW5kYWxvbmU9XCJub1wiPz5cXHJcXG4nICsgc291cmNlO1xuXG5cdFx0XHRcdC8vY29udmVydCBzdmcgc291cmNlIHRvIFVSSSBkYXRhIHNjaGVtZS5cblx0XHRcdFx0dmFyIHVybCA9IFwiZGF0YTppbWFnZS9zdmcreG1sO2NoYXJzZXQ9dXRmLTgsXCIrZW5jb2RlVVJJQ29tcG9uZW50KHNvdXJjZSk7XG5cdFx0XHRcdCRidG4uYXR0ciggXCJocmVmXCIsIHVybCApO1xuXG5cdFx0XHR9IGVsc2Uge1xuXG5cdFx0XHRcdHZhciAkc3ZnQ2FudmFzID0gJCggXCIubnZkMy1zdmdcIiApO1xuXHRcdFx0XHRpZiggJHN2Z0NhbnZhcy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0c2F2ZVN2Z0FzUG5nKCAkKCBcIi5udmQzLXN2Z1wiICkuZ2V0KCAwICksIFwiY2hhcnQucG5nXCIpO1xuXG5cdFx0XHRcdFx0Ly90ZW1wIGhhY2sgLSByZW1vdmUgaW1hZ2Ugd2hlbiBleHBvcnRpbmcgdG8gcG5nXG5cdFx0XHRcdFx0Lyp2YXIgJHN2Z0xvZ28gPSAkKCBcIi5jaGFydC1sb2dvLXN2Z1wiICk7XG5cdFx0XHRcdFx0JHN2Z0xvZ28ucmVtb3ZlKCk7XG5cblx0XHRcdFx0XHRzYXZlU3ZnQXNQbmcoICQoIFwiLm52ZDMtc3ZnXCIgKS5nZXQoIDAgKSwgXCJjaGFydC5wbmdcIik7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0JHN2Zy5wcmVwZW5kKCAkc3ZnTG9nbyApOyovXG5cdFx0XHRcdFx0XG5cdFx0XHRcdH1cblxuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHQvL2FkZCBiYWNrIHRoZSBwcmludGVkIHN2Z1xuXHRcdFx0JG5ld0VsLnJlcGxhY2VXaXRoKCAkb2xkRWwgKTtcblx0XHRcdC8vcmVmcmVzaCBsaW5rXG5cdFx0XHQkb2xkRWwuZmluZCggXCIuY2hhcnQtc2F2ZS1zdmctYnRuXCIgKS5vbiggXCJjbGlja1wiLCAkLnByb3h5KCB0aGlzLmV4cG9ydENvbnRlbnQsIHRoaXMgKSApO1xuXG5cdFx0fSxcblxuXHRcdHVwZGF0ZUNoYXJ0OiBmdW5jdGlvbiggZGF0YSwgdGltZVR5cGUsIGRpbWVuc2lvbnMgKSB7XG5cblx0XHRcdHRoaXMuY2hhcnRUYWIucmVuZGVyKCBkYXRhLCB0aW1lVHlwZSwgZGltZW5zaW9ucyApO1xuXHRcdFxuXHRcdH0sXG5cdFxuXHRcdG9uUmVzaXplOiBmdW5jdGlvbigpIHtcblx0XHRcdFxuXHRcdFx0Ly9jb21wdXRlIGhvdyBtdWNoIHNwYWNlIGZvciBjaGFydFxuXHRcdFx0dmFyIHN2Z1dpZHRoID0gdGhpcy4kc3ZnLndpZHRoKCksXG5cdFx0XHRcdHN2Z0hlaWdodCA9IHRoaXMuJHN2Zy5oZWlnaHQoKSxcblx0XHRcdFx0Y2hhcnRUeXBlID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LXR5cGVcIiApLFxuXHRcdFx0XHQkY2hhcnROYW1lU3ZnID0gdGhpcy4kZWwuZmluZCggXCIuY2hhcnQtbmFtZS1zdmdcIiApLFxuXHRcdFx0XHQkY2hhcnRTdWJuYW1lU3ZnID0gdGhpcy4kZWwuZmluZCggXCIuY2hhcnQtc3VibmFtZS1zdmdcIiApLFxuXHRcdFx0XHQkY2hhcnREZXNjcmlwdGlvblN2ZyA9IHRoaXMuJGVsLmZpbmQoIFwiLmNoYXJ0LWRlc2NyaXB0aW9uLXN2Z1wiICksXG5cdFx0XHRcdCRjaGFydFNvdXJjZXNTdmcgPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1zb3VyY2VzLXN2Z1wiICksXG5cdFx0XHRcdGNoYXJ0SGVhZGVySGVpZ2h0ID0gdGhpcy4kY2hhcnRIZWFkZXIuaGVpZ2h0KCksXG5cdFx0XHRcdG1hcmdpbnMgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwibWFyZ2luc1wiICksXG5cdFx0XHRcdHRvcENoYXJ0TWFyZ2luID0gMzAsXG5cdFx0XHRcdGJvdHRvbUNoYXJ0TWFyZ2luID0gNjAsXG5cdFx0XHRcdGN1cnJZLCBmb290ZXJEZXNjcmlwdGlvbkhlaWdodCwgZm9vdGVyU291cmNlc0hlaWdodCwgY2hhcnRIZWlnaHQ7XG5cblx0XHRcdHRoaXMuJHRhYkNvbnRlbnQuaGVpZ2h0KCAkKCBcIi5jaGFydC13cmFwcGVyLWlubmVyXCIgKS5oZWlnaHQoKSAtIHRoaXMuJGNoYXJ0SGVhZGVyLmhlaWdodCgpICk7XG5cblx0XHRcdC8vd3JhcCBoZWFkZXIgdGV4dFxuXHRcdFx0VXRpbHMud3JhcCggJGNoYXJ0TmFtZVN2Zywgc3ZnV2lkdGggKTtcblx0XHRcdGN1cnJZID0gcGFyc2VJbnQoICRjaGFydE5hbWVTdmcuYXR0ciggXCJ5XCIgKSwgMTAgKSArICRjaGFydE5hbWVTdmcub3V0ZXJIZWlnaHQoKSArIDIwO1xuXHRcdFx0JGNoYXJ0U3VibmFtZVN2Zy5hdHRyKCBcInlcIiwgY3VyclkgKTtcblx0XHRcdFxuXHRcdFx0Ly93cmFwIGRlc2NyaXB0aW9uXG5cdFx0XHRVdGlscy53cmFwKCAkY2hhcnRTdWJuYW1lU3ZnLCBzdmdXaWR0aCApO1xuXG5cdFx0XHQvL3N0YXJ0IHBvc2l0aW9uaW5nIHRoZSBncmFwaCwgYWNjb3JkaW5nIFxuXHRcdFx0Y3VyclkgPSBjaGFydEhlYWRlckhlaWdodDtcblxuXHRcdFx0dmFyIHRyYW5zbGF0ZVkgPSBjdXJyWTtcblx0XHRcdFxuXHRcdFx0dGhpcy4kc3ZnLmhlaWdodCggdGhpcy4kdGFiQ29udGVudC5oZWlnaHQoKSArIGN1cnJZICk7XG5cblx0XHRcdC8vdXBkYXRlIHN0b3JlZCBoZWlnaHRcblx0XHRcdHN2Z0hlaWdodCA9IHRoaXMuJHN2Zy5oZWlnaHQoKTtcblxuXHRcdFx0Ly9hZGQgaGVpZ2h0IG9mIGxlZ2VuZFxuXHRcdFx0Ly9jdXJyWSArPSB0aGlzLmNoYXJ0LmxlZ2VuZC5oZWlnaHQoKTtcblx0XHRcdGlmKCAhQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImhpZGUtbGVnZW5kXCIgKSApIHtcblx0XHRcdFx0Y3VyclkgKz0gdGhpcy5jaGFydFRhYi5sZWdlbmQuaGVpZ2h0KCk7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdC8vcG9zaXRpb24gY2hhcnRcblx0XHRcdFV0aWxzLndyYXAoICRjaGFydERlc2NyaXB0aW9uU3ZnLCBzdmdXaWR0aCApO1xuXHRcdFx0Zm9vdGVyRGVzY3JpcHRpb25IZWlnaHQgPSAkY2hhcnREZXNjcmlwdGlvblN2Zy5oZWlnaHQoKTtcblx0XHRcdFV0aWxzLndyYXAoICRjaGFydFNvdXJjZXNTdmcsIHN2Z1dpZHRoICk7XG5cdFx0XHRmb290ZXJTb3VyY2VzSGVpZ2h0ID0gJGNoYXJ0U291cmNlc1N2Zy5oZWlnaHQoKTtcblxuXHRcdFx0dmFyIGZvb3RlckhlaWdodCA9IHRoaXMuJGNoYXJ0Rm9vdGVyLmhlaWdodCgpO1xuXG5cdFx0XHQvL3NldCBjaGFydCBoZWlnaHRcblx0XHRcdGNoYXJ0SGVpZ2h0ID0gc3ZnSGVpZ2h0IC0gdHJhbnNsYXRlWSAtIGZvb3RlckhlaWdodCAtIGJvdHRvbUNoYXJ0TWFyZ2luO1xuXHRcdFx0aWYoICFBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiaGlkZS1sZWdlbmRcIiApICkge1xuXHRcdFx0XHRjaGFydEhlaWdodCAtPSB0aGlzLmNoYXJ0VGFiLmxlZ2VuZC5oZWlnaHQoKTtcblx0XHRcdH1cblxuXHRcdFx0Ly9yZWZsZWN0IG1hcmdpbiB0b3AgYW5kIGRvd24gaW4gY2hhcnRIZWlnaHRcblx0XHRcdGNoYXJ0SGVpZ2h0ID0gY2hhcnRIZWlnaHQgLSBtYXJnaW5zLmJvdHRvbSAtIG1hcmdpbnMudG9wO1xuXG5cdFx0XHQvL3Bvc2l0aW9uIGZvb3RlclxuXHRcdFx0JGNoYXJ0RGVzY3JpcHRpb25TdmcuYXR0ciggXCJ5XCIsIGN1cnJZICsgY2hhcnRIZWlnaHQgKyBib3R0b21DaGFydE1hcmdpbiApO1xuXHRcdFx0VXRpbHMud3JhcCggJGNoYXJ0RGVzY3JpcHRpb25TdmcsIHN2Z1dpZHRoICk7XG5cdFx0XHQkY2hhcnRTb3VyY2VzU3ZnLmF0dHIoIFwieVwiLCBwYXJzZUludCggJGNoYXJ0RGVzY3JpcHRpb25TdmcuYXR0ciggXCJ5XCIgKSwgMTAgKSArICRjaGFydERlc2NyaXB0aW9uU3ZnLmhlaWdodCgpICsgZm9vdGVyRGVzY3JpcHRpb25IZWlnaHQvMyApO1xuXHRcdFx0VXRpbHMud3JhcCggJGNoYXJ0U291cmNlc1N2Zywgc3ZnV2lkdGggKTtcblx0XHRcdFxuXHRcdFx0Ly9jb21wdXRlIGNoYXJ0IHdpZHRoXG5cdFx0XHR2YXIgY2hhcnRXaWR0aCA9IHN2Z1dpZHRoIC0gbWFyZ2lucy5sZWZ0IC0gbWFyZ2lucy5yaWdodDtcblx0XHRcdHRoaXMuY2hhcnRUYWIuY2hhcnQud2lkdGgoIGNoYXJ0V2lkdGggKTtcblx0XHRcdHRoaXMuY2hhcnRUYWIuY2hhcnQuaGVpZ2h0KCBjaGFydEhlaWdodCApO1xuXG5cdFx0XHQvL25lZWQgdG8gY2FsbCBjaGFydCB1cGRhdGUgZm9yIHJlc2l6aW5nIG9mIGVsZW1lbnRzIHdpdGhpbiBjaGFydFxuXHRcdFx0aWYoIHRoaXMuJGNoYXJ0VGFiLmlzKCBcIjp2aXNpYmxlXCIgKSApIHtcblx0XHRcdFx0dGhpcy5jaGFydFRhYi5jaGFydC51cGRhdGUoKTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0aWYoIGNoYXJ0VHlwZSA9PT0gXCIzXCIgKSB7XG5cdFx0XHRcdC8vZm9yIHN0YWNrZWQgYXJlYSBjaGFydCwgbmVlZCB0byBtYW51YWxseSBhZGp1c3QgaGVpZ2h0XG5cdFx0XHRcdHZhciBjdXJySW50TGF5ZXJIZWlnaHQgPSB0aGlzLmNoYXJ0VGFiLmNoYXJ0LmludGVyYWN0aXZlTGF5ZXIuaGVpZ2h0KCksXG5cdFx0XHRcdFx0Ly9UT0RPIC0gZG8gbm90IGhhcmRjb2RlIHRoaXNcblx0XHRcdFx0XHRoZWlnaHRBZGQgPSAxNTA7XG5cdFx0XHRcdHRoaXMuY2hhcnRUYWIuY2hhcnQuaW50ZXJhY3RpdmVMYXllci5oZWlnaHQoIGN1cnJJbnRMYXllckhlaWdodCArIGhlaWdodEFkZCApO1xuXHRcdFx0XHRkMy5zZWxlY3QoXCIubnYtaW50ZXJhY3RpdmVcIikuY2FsbCh0aGlzLmNoYXJ0VGFiLmNoYXJ0LmludGVyYWN0aXZlTGF5ZXIpO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRpZiggIUFwcC5DaGFydE1vZGVsLmdldCggXCJoaWRlLWxlZ2VuZFwiICkgKSB7XG5cdFx0XHRcdC8vcG9zaXRpb24gbGVnZW5kXG5cdFx0XHRcdHZhciBsZWdlbmRNYXJnaW5zID0gdGhpcy5jaGFydFRhYi5sZWdlbmQubWFyZ2luKCk7XG5cdFx0XHRcdGN1cnJZID0gY3VyclkgLSB0aGlzLmNoYXJ0VGFiLmxlZ2VuZC5oZWlnaHQoKTtcblx0XHRcdFx0dGhpcy50cmFuc2xhdGVTdHJpbmcgPSBcInRyYW5zbGF0ZShcIiArIGxlZ2VuZE1hcmdpbnMubGVmdCArIFwiICxcIiArIGN1cnJZICsgXCIpXCI7XG5cdFx0XHRcdHRoaXMuJHN2Zy5maW5kKCBcIj4gLm52ZDMubnYtY3VzdG9tLWxlZ2VuZFwiICkuYXR0ciggXCJ0cmFuc2Zvcm1cIiwgdGhpcy50cmFuc2xhdGVTdHJpbmcgKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy4kc3ZnLmNzcyggXCJ0cmFuc2Zvcm1cIiwgXCJ0cmFuc2xhdGUoMCwtXCIgKyBjaGFydEhlYWRlckhlaWdodCArIFwicHgpXCIgKTtcblxuXHRcdFx0Ly9mb3IgbXVsdGliYXJjaGFydCwgbmVlZCB0byBtb3ZlIGNvbnRyb2xzIGJpdCBoaWdoZXJcblx0XHRcdGlmKCBjaGFydFR5cGUgPT09IFwiNFwiIHx8IGNoYXJ0VHlwZSA9PT0gXCI1XCIgKSB7XG5cdFx0XHRcdGQzLnNlbGVjdCggXCIubnYtY29udHJvbHNXcmFwXCIgKS5hdHRyKCBcInRyYW5zZm9ybVwiLCBcInRyYW5zbGF0ZSgwLC0yNSlcIiApO1xuXHRcdFx0fVxuXG5cdFx0XHQvL3JlZmxlY3QgbWFyZ2luIHRvcCBpbiBjdXJyWVxuXHRcdFx0aWYoICFBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiaGlkZS1sZWdlbmRcIiApICkge1xuXHRcdFx0XHRjdXJyWSArPSArdGhpcy5jaGFydFRhYi5sZWdlbmQuaGVpZ2h0KCk7XG5cdFx0XHR9XG5cdFx0XHRjdXJyWSArPSArbWFyZ2lucy50b3A7XG5cblx0XHRcdHZhciAkd3JhcCA9IHRoaXMuJHN2Zy5maW5kKCBcIj4gLm52ZDMubnYtd3JhcFwiICk7XG5cblx0XHRcdC8vbWFudWFsbHkgcmVwb3NpdGlvbiBjaGFydCBhZnRlciB1cGRhdGVcblx0XHRcdC8vdGhpcy50cmFuc2xhdGVTdHJpbmcgPSBcInRyYW5zbGF0ZShcIiArIG1hcmdpbnMubGVmdCArIFwiLFwiICsgY3VyclkgKyBcIilcIjtcblx0XHRcdHRoaXMudHJhbnNsYXRlU3RyaW5nID0gXCJ0cmFuc2xhdGUoXCIgKyBtYXJnaW5zLmxlZnQgKyBcIixcIiArIGN1cnJZICsgXCIpXCI7XG5cdFx0XHQkd3JhcC5hdHRyKCBcInRyYW5zZm9ybVwiLCB0aGlzLnRyYW5zbGF0ZVN0cmluZyApO1xuXHRcdFx0XG5cdFx0XHQvL3Bvc2l0aW9uIHNjYWxlIGRyb3Bkb3ducyAtIFRPRE8gLSBpc24ndCB0aGVyZSBhIGJldHRlciB3YXkgdGhlbiB3aXRoIHRpbWVvdXQ/XG5cdFx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0XHRzZXRUaW1lb3V0KCBmdW5jdGlvbigpIHtcblx0XHRcdFxuXHRcdFx0XHR2YXIgd3JhcE9mZnNldCA9ICR3cmFwLm9mZnNldCgpLFxuXHRcdFx0XHRcdGNoYXJ0VGFiT2Zmc2V0ID0gdGhhdC4kY2hhcnRUYWIub2Zmc2V0KCksXG5cdFx0XHRcdFx0bWFyZ2luTGVmdCA9IHBhcnNlSW50KCBtYXJnaW5zLmxlZnQsIDEwICksXG5cdFx0XHRcdFx0Ly9kaWcgaW50byBOVkQzIGNoYXJ0IHRvIGZpbmQgYmFja2dyb3VuZCByZWN0IHRoYXQgaGFzIHdpZHRoIG9mIHRoZSBhY3R1YWwgY2hhcnRcblx0XHRcdFx0XHRiYWNrUmVjdFdpZHRoID0gcGFyc2VJbnQoICR3cmFwLmZpbmQoIFwiPiBnID4gcmVjdFwiICkuYXR0ciggXCJ3aWR0aFwiICksIDEwICksXG5cdFx0XHRcdFx0b2Zmc2V0RGlmZiA9IHdyYXBPZmZzZXQudG9wIC0gY2hhcnRUYWJPZmZzZXQudG9wLFxuXHRcdFx0XHRcdC8vZW1waXJpYyBvZmZzZXRcblx0XHRcdFx0XHR4U2NhbGVPZmZzZXQgPSAxMCxcblx0XHRcdFx0XHR5U2NhbGVPZmZzZXQgPSAtNTtcblxuXHRcdFx0XHQvL2ZhbGxiYWNrIGZvciBzY2F0dGVyIHBsb3Qgd2hlcmUgYmFja1JlY3RXaWR0aCBoYXMgbm8gd2lkdGhcblx0XHRcdFx0aWYoIGlzTmFOKCBiYWNrUmVjdFdpZHRoICkgKSB7XG5cdFx0XHRcdFx0YmFja1JlY3RXaWR0aCA9IHBhcnNlSW50KCAkKFwiLm52LXgubnYtYXhpcy5udmQzLXN2Z1wiKS5nZXQoMCkuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkud2lkdGgsIDEwICk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGF0LiR4QXhpc1NjYWxlU2VsZWN0b3IuY3NzKCB7IFwidG9wXCI6IG9mZnNldERpZmYgKyBjaGFydEhlaWdodCwgXCJsZWZ0XCI6IG1hcmdpbkxlZnQgKyBiYWNrUmVjdFdpZHRoICsgeFNjYWxlT2Zmc2V0IH0gKTtcblx0XHRcdFx0dGhhdC4keUF4aXNTY2FsZVNlbGVjdG9yLmNzcyggeyBcInRvcFwiOiBvZmZzZXREaWZmIC0gMTUsIFwibGVmdFwiOiBtYXJnaW5MZWZ0ICsgeVNjYWxlT2Zmc2V0IH0gKTtcblx0XHRcdFx0XG5cdFx0XHR9LCAyNTAgKTtcblx0XHRcdFxuXHRcdH1cblxuXHR9KTtcblx0XG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkNoYXJ0VmlldztcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBMZWdlbmQgPSByZXF1aXJlKCBcIi4vQXBwLlZpZXdzLkNoYXJ0LkxlZ2VuZC5qc1wiICk7XG5cblx0QXBwLlZpZXdzLkNoYXJ0LkNoYXJ0VGFiID0gQmFja2JvbmUuVmlldy5leHRlbmQoIHtcblxuXHRcdGNhY2hlZENvbG9yczogW10sXG5cdFx0ZWw6IFwiI2NoYXJ0LXZpZXdcIixcblx0XHRldmVudHM6IHtcblx0XHRcdFwiY2hhbmdlIFtuYW1lPWF2YWlsYWJsZV9lbnRpdGllc11cIjogXCJvbkF2YWlsYWJsZUNvdW50cmllc1wiXG5cdFx0fSxcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIgPSBvcHRpb25zLmRpc3BhdGNoZXI7XG5cdFx0XHR0aGlzLnBhcmVudFZpZXcgPSBvcHRpb25zLnBhcmVudFZpZXc7XG5cblx0XHRcdHRoaXMuJHN2ZyA9IHRoaXMuJGVsLmZpbmQoIFwiI2NoYXJ0LWNoYXJ0LXRhYiBzdmdcIiApO1xuXHRcdFx0dGhpcy4kZW50aXRpZXNTZWxlY3QgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPWF2YWlsYWJsZV9lbnRpdGllc11cIiApO1xuXHRcdFx0XG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oIGRhdGEsIHRpbWVUeXBlLCBkaW1lbnNpb25zICkge1xuXHRcdFx0XG5cdFx0XHRpZiggIWRhdGEgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0dmFyIHRoYXQgPSB0aGlzO1xuXG5cdFx0XHQvL21ha2UgbG9jYWwgY29weSBvZiBkYXRhIGZvciBvdXIgZmlsdGVyaW5nIG5lZWRzXG5cdFx0XHR2YXIgbG9jYWxEYXRhID0gJC5leHRlbmQoIHRydWUsIGxvY2FsRGF0YSwgZGF0YSApO1xuXG5cdFx0XHR2YXIgY2hhcnRUeXBlID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LXR5cGVcIiApO1xuXG5cdFx0XHQvL2ZpbHRlciBkYXRhIGZvciBzZWxlY3RlZCBjb3VudHJpZXNcblx0XHRcdHZhciBzZWxlY3RlZENvdW50cmllcyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiApLFxuXHRcdFx0XHRzZWxlY3RlZENvdW50cmllc0J5SWQgPSBbXSxcblx0XHRcdFx0c2VsZWN0ZWRDb3VudHJpZXNJZHMgPSBfLm1hcCggc2VsZWN0ZWRDb3VudHJpZXMsIGZ1bmN0aW9uKHYpIHtcblx0XHRcdFx0XHQvL3N0b3JlIFxuXHRcdFx0XHRcdHNlbGVjdGVkQ291bnRyaWVzQnlJZFsgdi5pZCBdID0gdjtcblx0XHRcdFx0XHRyZXR1cm4gK3YuaWQ7XG5cdFx0XHRcdH0gKTtcblxuXHRcdFx0aWYoIHNlbGVjdGVkQ291bnRyaWVzICYmIHNlbGVjdGVkQ291bnRyaWVzSWRzLmxlbmd0aCAmJiAhQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImdyb3VwLWJ5LXZhcmlhYmxlc1wiICkgKSB7XG5cdFx0XHRcdFxuXHRcdFx0XHQvL3NldCBsb2NhbCBjb3B5IG9mIGNvdW50cmllcyBjb2xvciwgdG8gYmUgYWJsZSB0byBjcmVhdGUgYnJpZ2h0ZXJcblx0XHRcdFx0dmFyIGNvdW50cmllc0NvbG9ycyA9IFtdO1xuXHRcdFx0XHRsb2NhbERhdGEgPSBfLmZpbHRlciggbG9jYWxEYXRhLCBmdW5jdGlvbiggdmFsdWUsIGtleSwgbGlzdCApIHtcblx0XHRcdFx0XHQvL3NldCBjb2xvciB3aGlsZSBpbiB0aGUgbG9vcFxuXHRcdFx0XHRcdHZhciBpZCA9IHZhbHVlLmlkO1xuXHRcdFx0XHRcdC8vbmVlZCB0byBjaGVjayBmb3Igc3BlY2lhbCBjYXNlLCB3aGVuIHdlIGhhdmUgbW9yZSB2YXJpYWJsZXMgZm9yIHRoZSBzYW1lIGNvdW50cmllcyAodGhlIGlkcyB3aWxsIGJlIHRoZW4gMjEtMSwgMjItMSwgZXRjLilcblx0XHRcdFx0XHRpZiggaWQuaW5kZXhPZiggXCItXCIgKSA+IDAgKSB7XG5cdFx0XHRcdFx0XHRpZCA9IHBhcnNlSW50KCBpZC5zcGxpdCggXCItXCIgKVsgMCBdLCAxMCApO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRpZCA9IHBhcnNlSW50KCBpZCwgMTAgKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR2YXIgY291bnRyeSA9IHNlbGVjdGVkQ291bnRyaWVzQnlJZFsgaWQgXTtcblx0XHRcdFx0XHRpZiggY291bnRyeSAmJiBjb3VudHJ5LmNvbG9yICkge1xuXHRcdFx0XHRcdFx0aWYoICFjb3VudHJpZXNDb2xvcnNbIGlkIF0gKSB7XG5cdFx0XHRcdFx0XHRcdGNvdW50cmllc0NvbG9yc1sgaWQgXSA9IGNvdW50cnkuY29sb3I7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHQvL3RoZXJlIGlzIGFscmVhZHkgY29sb3IgZm9yIGNvdW50cnkgKG11bHRpdmFyaWFudCBkYXRhc2V0KSAtIGNyZWF0ZSBicmlnaHRlciBjb2xvclxuXHRcdFx0XHRcdFx0XHRjb3VudHJpZXNDb2xvcnNbIGlkIF0gPSBkMy5yZ2IoIGNvdW50cmllc0NvbG9yc1sgaWQgXSApLmJyaWdodGVyKCAxICkudG9TdHJpbmcoKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHZhbHVlLmNvbG9yID0gY291bnRyaWVzQ29sb3JzWyBpZCBdO1xuXG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHZhbHVlID0gdGhhdC5hc3NpZ25Db2xvckZyb21DYWNoZSggdmFsdWUgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0Ly9hY3R1YWwgZmlsdGVyaW5nXG5cdFx0XHRcdFx0cmV0dXJuICggXy5pbmRleE9mKCBzZWxlY3RlZENvdW50cmllc0lkcywgaWQgKSA+IC0xICk7XG5cdFx0XHRcdH0gKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vVE9ETyAtIG5vbnNlbnNlPyBjb252ZXJ0IGFzc29jaWF0aXZlIGFycmF5IHRvIGFycmF5LCBhc3NpZ24gY29sb3JzIGZyb20gY2FjaGVcblx0XHRcdFx0bG9jYWxEYXRhID0gXy5tYXAoIGxvY2FsRGF0YSwgZnVuY3Rpb24oIHZhbHVlICkge1xuXHRcdFx0XHRcdHZhbHVlID0gdGhhdC5hc3NpZ25Db2xvckZyb21DYWNoZSggdmFsdWUgKTtcblx0XHRcdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0XHRcdH0gKTtcblx0XHRcdH1cblxuXHRcdFx0dmFyIGRpc2NyZXRlRGF0YTtcblx0XHRcdGlmKCBjaGFydFR5cGUgPT0gXCI2XCIgKSB7XG5cdFx0XHRcdHZhciBmbGF0dGVuVmFsdWVzID0gXy5tYXAoIGxvY2FsRGF0YSwgZnVuY3Rpb24oIHYgKSB7XG5cdFx0XHRcdFx0aWYoIHYgJiYgdi5jb2xvciApIHtcblx0XHRcdFx0XHRcdHYudmFsdWVzWyAwIF0uY29sb3IgPSB2LmNvbG9yO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gdi52YWx1ZXNbMF07XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0ZGlzY3JldGVEYXRhID0gW3sga2V5OiBcInZhcmlhYmxlXCIsIHZhbHVlczogZmxhdHRlblZhbHVlcyB9XTtcblx0XHRcdFx0bG9jYWxEYXRhID0gZGlzY3JldGVEYXRhO1xuXHRcdFx0fVxuXG5cdFx0XHQvL2ZpbHRlciBieSBjaGFydCB0aW1lXG5cdFx0XHR2YXIgY2hhcnRUaW1lID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LXRpbWVcIiApO1xuXHRcdFx0aWYoIGNoYXJ0VGltZSAmJiBjaGFydFRpbWUubGVuZ3RoID09IDIgKSB7XG5cdFx0XHRcdFxuXHRcdFx0XHR2YXIgdGltZUZyb20gPSBjaGFydFRpbWVbIDAgXSxcblx0XHRcdFx0XHR0aW1lVG8gPSBjaGFydFRpbWVbIDEgXTtcblx0XHRcdFx0XG5cdFx0XHRcdF8uZWFjaCggbG9jYWxEYXRhLCBmdW5jdGlvbiggc2luZ2xlRGF0YSwga2V5LCBsaXN0ICkge1xuXHRcdFx0XHRcdHZhciB2YWx1ZXMgPSBfLmNsb25lKCBzaW5nbGVEYXRhLnZhbHVlcyApO1xuXHRcdFx0XHRcdHZhbHVlcyA9IF8uZmlsdGVyKCB2YWx1ZXMsIGZ1bmN0aW9uKCB2YWx1ZSApIHtcblx0XHRcdFx0XHRcdHJldHVybiAoIHBhcnNlSW50KCB2YWx1ZS50aW1lLCAxMCApID49IHRpbWVGcm9tICYmIHBhcnNlSW50KCB2YWx1ZS50aW1lLCAxMCApIDw9IHRpbWVUbyApO1xuXHRcdFx0XHRcdFx0Ly9yZXR1cm4gKCB2YWx1ZS54ID49IHRpbWVGcm9tICYmIHZhbHVlLnggPD0gdGltZVRvICk7XG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdHNpbmdsZURhdGEudmFsdWVzID0gdmFsdWVzO1xuXHRcdFx0XHR9ICk7XG5cblx0XHRcdH1cblxuXHRcdFx0Ly9pZiBsZWdlbmQgZGlzcGxheWVkLCBzb3J0IGRhdGEgb24ga2V5IGFscGhhYmV0aWNhbGx5ICh1c2VmdWxsIHdoZW4gbXVsdGl2YXJpYW4gZGF0YXNldClcblx0XHRcdGlmKCAhQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImhpZGUtbGVnZW5kXCIgKSApIHtcblx0XHRcdFx0bG9jYWxEYXRhID0gXy5zb3J0QnkoIGxvY2FsRGF0YSwgZnVuY3Rpb24oIG9iaiApIHsgcmV0dXJuIG9iai5rZXk7IH0gKTtcblx0XHRcdH1cblxuXHRcdFx0Ly9nZXQgYXhpcyBjb25maWdzXG5cdFx0XHR2YXIgeEF4aXMgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwieC1heGlzXCIgKSxcblx0XHRcdFx0eUF4aXMgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwieS1heGlzXCIgKSxcblx0XHRcdFx0eEF4aXNQcmVmaXggPSAoIHhBeGlzWyBcImF4aXMtcHJlZml4XCIgXSB8fCBcIlwiICksXG5cdFx0XHRcdHhBeGlzU3VmZml4ID0gKCB4QXhpc1sgXCJheGlzLXN1ZmZpeFwiIF0gfHwgXCJcIiApLFxuXHRcdFx0XHR5QXhpc1ByZWZpeCA9ICggeUF4aXNbIFwiYXhpcy1wcmVmaXhcIiBdIHx8IFwiXCIgKSxcblx0XHRcdFx0eUF4aXNTdWZmaXggPSAoIHlBeGlzWyBcImF4aXMtc3VmZml4XCIgXSB8fCBcIlwiICksXG5cdFx0XHRcdHhBeGlzTGFiZWxEaXN0YW5jZSA9ICggK3hBeGlzWyBcImF4aXMtbGFiZWwtZGlzdGFuY2VcIiBdIHx8IDAgKSxcblx0XHRcdFx0eUF4aXNMYWJlbERpc3RhbmNlID0gKCAreUF4aXNbIFwiYXhpcy1sYWJlbC1kaXN0YW5jZVwiIF0gfHwgMCApLFxuXHRcdFx0XHR4QXhpc01pbiA9ICggeEF4aXNbIFwiYXhpcy1taW5cIiBdIHx8IG51bGwgKSxcblx0XHRcdFx0eEF4aXNNYXggPSAoIHhBeGlzWyBcImF4aXMtbWF4XCIgXSB8fCBudWxsICksXG5cdFx0XHRcdHlBeGlzTWluID0gKCB5QXhpc1sgXCJheGlzLW1pblwiIF0gfHwgMCApLFxuXHRcdFx0XHR5QXhpc01heCA9ICggeUF4aXNbIFwiYXhpcy1tYXhcIiBdIHx8IG51bGwgKSxcblx0XHRcdFx0eEF4aXNTY2FsZSA9ICggeEF4aXNbIFwiYXhpcy1zY2FsZVwiIF0gfHwgXCJsaW5lYXJcIiApLFxuXHRcdFx0XHR5QXhpc1NjYWxlID0gKCB5QXhpc1sgXCJheGlzLXNjYWxlXCIgXSB8fCBcImxpbmVhclwiICksXG5cdFx0XHRcdHhBeGlzRm9ybWF0ID0gKCB4QXhpc1sgXCJheGlzLWZvcm1hdFwiIF0gfHwgMCApLFxuXHRcdFx0XHR5QXhpc0Zvcm1hdCA9ICggeUF4aXNbIFwiYXhpcy1mb3JtYXRcIiBdIHx8IDAgKTtcblxuXHRcdFx0bnYuYWRkR3JhcGgoZnVuY3Rpb24oKSB7XG5cblx0XHRcdFx0dmFyIGNoYXJ0T3B0aW9ucyA9IHtcblx0XHRcdFx0XHR0cmFuc2l0aW9uRHVyYXRpb246IDMwMCxcblx0XHRcdFx0XHRtYXJnaW46IHsgdG9wOjAsIGxlZnQ6NTAsIHJpZ2h0OjMwLCBib3R0b206MCB9LC8vIEFwcC5DaGFydE1vZGVsLmdldCggXCJtYXJnaW5zXCIgKSxcblx0XHRcdFx0XHRzaG93TGVnZW5kOiBmYWxzZVxuXHRcdFx0XHR9O1xuXG5cdFx0XHRcdC8vbGluZSB0eXBlXG5cdFx0XHRcdHZhciBsaW5lVHlwZSA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJsaW5lLXR5cGVcIiApO1xuXHRcdFx0XHRpZiggbGluZVR5cGUgPT0gMiApIHtcblx0XHRcdFx0XHRjaGFydE9wdGlvbnMuZGVmaW5lZCA9IGZ1bmN0aW9uKCBkICkgeyByZXR1cm4gZC55ICE9PSAwOyB9O1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmKCBsaW5lVHlwZSA9PSAwICkge1xuXHRcdFx0XHRcdHRoYXQuJGVsLmFkZENsYXNzKCBcImxpbmUtZG90c1wiICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhhdC4kZWwucmVtb3ZlQ2xhc3MoIFwibGluZS1kb3RzXCIgKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vZGVwZW5kaW5nIG9uIGNoYXJ0IHR5cGUgY3JlYXRlIGNoYXJ0XG5cdFx0XHRcdGlmKCBjaGFydFR5cGUgPT0gXCIxXCIgKSB7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0Ly9saW5lIGNoYXJ0XG5cdFx0XHRcdFx0dGhhdC5jaGFydCA9IG52Lm1vZGVscy5saW5lQ2hhcnQoKS5vcHRpb25zKCBjaGFydE9wdGlvbnMgKTtcblx0XHRcdFx0XG5cdFx0XHRcdH0gZWxzZSBpZiggY2hhcnRUeXBlID09IFwiMlwiICkge1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdC8vc2NhdHRlciBwbG90XG5cdFx0XHRcdFx0dmFyIHBvaW50cyA9IHRoYXQuc2NhdHRlckJ1YmJsZVNpemUoKTtcblx0XHRcdFx0XHR0aGF0LmNoYXJ0ID0gbnYubW9kZWxzLnNjYXR0ZXJDaGFydCgpLm9wdGlvbnMoIGNoYXJ0T3B0aW9ucyApLnBvaW50UmFuZ2UoIHBvaW50cyApLnNob3dEaXN0WCggdHJ1ZSApLnNob3dEaXN0WSggdHJ1ZSApO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHR9IGVsc2UgaWYoIGNoYXJ0VHlwZSA9PSBcIjNcIiApIHtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHQvL3N0YWNrZWQgYXJlYSBjaGFydFxuXHRcdFx0XHRcdC8vd2UgbmVlZCB0byBtYWtlIHN1cmUgd2UgaGF2ZSBhcyBtdWNoIGRhdGEgYXMgbmVjZXNzYXJ5XG5cdFx0XHRcdFx0aWYoIGxvY2FsRGF0YS5sZW5ndGggKSB7XG5cdFx0XHRcdFx0XHR2YXIgYmFzZVNlcmllcyA9IGxvY2FsRGF0YVswXTtcblx0XHRcdFx0XHRcdF8uZWFjaCggbG9jYWxEYXRhLCBmdW5jdGlvbiggc2VyaWUsIGkgKSB7XG5cdFx0XHRcdFx0XHRcdGlmKCBpID4gMCApIHtcblx0XHRcdFx0XHRcdFx0XHQvL21ha2Ugc3VyZSB3ZSBoYXZlIHZhbHVlcyBmb3IgZ2l2ZW4gc2VyaWVzXG5cdFx0XHRcdFx0XHRcdFx0aWYoIHNlcmllLnZhbHVlcyAmJiAhc2VyaWUudmFsdWVzLmxlbmd0aCApIHtcblx0XHRcdFx0XHRcdFx0XHRcdC8vY2xvbmUgYmFzZSBzZXJpZXNcblx0XHRcdFx0XHRcdFx0XHRcdHZhciBjb3B5VmFsdWVzID0gW107XG5cdFx0XHRcdFx0XHRcdFx0XHQkLmV4dGVuZCh0cnVlLCBjb3B5VmFsdWVzLCBiYXNlU2VyaWVzLnZhbHVlcyk7XG5cdFx0XHRcdFx0XHRcdFx0XHQvL251bGxpZnkgdmFsdWVzXG5cdFx0XHRcdFx0XHRcdFx0XHRfLmVhY2goIGNvcHlWYWx1ZXMsIGZ1bmN0aW9uKCB2LCBpKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdHYueSA9IDA7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdHYuZmFrZSA9IFwidHJ1ZVwiO1xuXHRcdFx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdFx0XHRzZXJpZS52YWx1ZXMgPSBjb3B5VmFsdWVzO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcblx0XHRcdFx0XHRjaGFydE9wdGlvbnMuc2hvd1RvdGFsSW5Ub29sdGlwID0gdHJ1ZTtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHR0aGF0LmNoYXJ0ID0gbnYubW9kZWxzLnN0YWNrZWRBcmVhQ2hhcnQoKVxuXHRcdFx0XHRcdFx0Lm9wdGlvbnMoIGNoYXJ0T3B0aW9ucyApXG5cdFx0XHRcdFx0XHQuY29udHJvbE9wdGlvbnMoIFsgXCJTdGFja2VkXCIsIFwiRXhwYW5kZWRcIiBdIClcblx0XHRcdFx0XHRcdC51c2VJbnRlcmFjdGl2ZUd1aWRlbGluZSggdHJ1ZSApXG5cdFx0XHRcdFx0XHQueCggZnVuY3Rpb24oIGQgKSB7IHJldHVybiBkWyBcInhcIiBdOyB9IClcblx0XHRcdFx0XHRcdC55KCBmdW5jdGlvbiggZCApIHsgcmV0dXJuIGRbIFwieVwiIF07IH0gKTtcblx0XHRcdFxuXHRcdFx0XHR9IGVsc2UgaWYoIGNoYXJ0VHlwZSA9PSBcIjRcIiB8fCBjaGFydFR5cGUgPT0gXCI1XCIgKSB7XG5cblx0XHRcdFx0XHQvL211bHRpYmFyIGNoYXJ0XG5cdFx0XHRcdFx0Ly93ZSBuZWVkIHRvIG1ha2Ugc3VyZSB3ZSBoYXZlIGFzIG11Y2ggZGF0YSBhcyBuZWNlc3Nhcnlcblx0XHRcdFx0XHR2YXIgYWxsVGltZXMgPSBbXSxcblx0XHRcdFx0XHRcdC8vc3RvcmUgdmFsdWVzIGJ5IFtlbnRpdHldW3RpbWVdXG5cdFx0XHRcdFx0XHR2YWx1ZXNDaGVjayA9IFtdO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdC8vZXh0cmFjdCBhbGwgdGltZXNcblx0XHRcdFx0XHRfLmVhY2goIGxvY2FsRGF0YSwgZnVuY3Rpb24oIHYsIGkgKSB7XG5cdFx0XHRcdFx0XHRcdFxuXHRcdFx0XHRcdFx0dmFyIGVudGl0eURhdGEgPSBbXSxcblx0XHRcdFx0XHRcdFx0dGltZXMgPSB2LnZhbHVlcy5tYXAoIGZ1bmN0aW9uKCB2MiwgaSApIHtcblx0XHRcdFx0XHRcdFx0XHRlbnRpdHlEYXRhWyB2Mi54IF0gPSB0cnVlO1xuXHRcdFx0XHRcdFx0XHRcdHJldHVybiB2Mi54O1xuXHRcdFx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0XHR2YWx1ZXNDaGVja1sgdi5pZCBdID0gZW50aXR5RGF0YTtcblx0XHRcdFx0XHRcdGFsbFRpbWVzID0gYWxsVGltZXMuY29uY2F0KCB0aW1lcyApO1xuXHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0fSApO1xuXG5cdFx0XHRcdFx0YWxsVGltZXMgPSBfLnVuaXEoIGFsbFRpbWVzICk7XG5cdFx0XHRcdFx0YWxsVGltZXMgPSBfLnNvcnRCeSggYWxsVGltZXMgKTtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHRpZiggbG9jYWxEYXRhLmxlbmd0aCApIHtcblx0XHRcdFx0XHRcdF8uZWFjaCggbG9jYWxEYXRhLCBmdW5jdGlvbiggc2VyaWUsIHNlcmllSW5kZXggKSB7XG5cdFx0XHRcdFx0XHRcdFxuXHRcdFx0XHRcdFx0XHQvL21ha2Ugc3VyZSB3ZSBoYXZlIHZhbHVlcyBmb3IgZ2l2ZW4gc2VyaWVzXG5cdFx0XHRcdFx0XHRcdF8uZWFjaCggYWxsVGltZXMsIGZ1bmN0aW9uKCB0aW1lLCB0aW1lSW5kZXggKSB7XG5cdFx0XHRcdFx0XHRcdFx0aWYoIHZhbHVlc0NoZWNrWyBzZXJpZS5pZCBdICYmICF2YWx1ZXNDaGVja1sgc2VyaWUuaWQgXVsgdGltZSBdICkge1xuXHRcdFx0XHRcdFx0XHRcdFx0Ly90aW1lIGRvZXNuJ3QgZXhpc3RpZyBmb3IgZ2l2ZW4gZW50aXR5LCBpbnNlcnQgemVybyB2YWx1ZVxuXHRcdFx0XHRcdFx0XHRcdFx0dmFyIHplcm9PYmogPSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFwia2V5XCI6IHNlcmllLmtleSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XCJzZXJpZVwiOiBzZXJpZUluZGV4LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcInRpbWVcIjogdGltZSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XCJ4XCI6IHRpbWUsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFwieVwiOiAwLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcImZha2VcIjogdHJ1ZVxuXHRcdFx0XHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdFx0XHRcdHNlcmllLnZhbHVlcy5zcGxpY2UoIHRpbWVJbmRleCwgMCwgemVyb09iaiApO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdFx0XHRcblx0XHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiggY2hhcnRUeXBlID09IFwiNFwiICkge1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdFx0dGhhdC5jaGFydCA9IG52Lm1vZGVscy5tdWx0aUJhckNoYXJ0KCkub3B0aW9ucyggY2hhcnRPcHRpb25zICk7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0fSBlbHNlIGlmKCAgY2hhcnRUeXBlID09IFwiNVwiICkge1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdFx0dGhhdC5jaGFydCA9IG52Lm1vZGVscy5tdWx0aUJhckhvcml6b250YWxDaGFydCgpLm9wdGlvbnMoIGNoYXJ0T3B0aW9ucyApOy8vLnNob3dWYWx1ZXMoIHRydWUgKTtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0fSBlbHNlIGlmKCBjaGFydFR5cGUgPT0gXCI2XCIgKSB7XG5cblx0XHRcdFx0XHRjaGFydE9wdGlvbnMuc2hvd1ZhbHVlcyA9IHRydWU7XG5cblx0XHRcdFx0XHR0aGF0LmNoYXJ0ID0gbnYubW9kZWxzLmRpc2NyZXRlQmFyQ2hhcnQoKVxuXHRcdFx0XHRcdFx0LngoIGZ1bmN0aW9uKCBkICkgeyByZXR1cm4gZC54OyB9IClcblx0XHRcdFx0XHRcdC55KCBmdW5jdGlvbiggZCApIHsgcmV0dXJuIGQueTsgfSApXG5cdFx0XHRcdFx0XHQub3B0aW9ucyggY2hhcnRPcHRpb25zICk7XG5cblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vZml4ZWQgcHJvYmFibHkgYSBidWcgaW4gbnZkMyB3aXRoIHByZXZpb3VzIHRvb2x0aXAgbm90IGJlaW5nIHJlbW92ZWRcblx0XHRcdFx0ZDMuc2VsZWN0KCBcIi54eS10b29sdGlwXCIgKS5yZW1vdmUoKTtcblxuXHRcdFx0XHR0aGF0LmNoYXJ0LnhBeGlzXG5cdFx0XHRcdFx0LmF4aXNMYWJlbCggeEF4aXNbIFwiYXhpcy1sYWJlbFwiIF0gKVxuXHRcdFx0XHRcdC8vLnN0YWdnZXJMYWJlbHMoIHRydWUgKVxuXHRcdFx0XHRcdC5heGlzTGFiZWxEaXN0YW5jZSggeEF4aXNMYWJlbERpc3RhbmNlIClcblx0XHRcdFx0XHQudGlja0Zvcm1hdCggZnVuY3Rpb24oZCkge1xuXHRcdFx0XHRcdFx0aWYoIGNoYXJ0VHlwZSAhPSAyICkge1xuXHRcdFx0XHRcdFx0XHQvL3ggYXhpcyBoYXMgdGltZSBpbmZvcm1hdGlvblxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gQXBwLlV0aWxzLmZvcm1hdFRpbWVMYWJlbCggdGltZVR5cGUsIGQsIHhBeGlzUHJlZml4LCB4QXhpc1N1ZmZpeCwgeEF4aXNGb3JtYXQgKTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdC8vaXMgc2NhdHRlciBwbG90LCB4LWF4aXMgaGFzIHNvbWUgb3RoZXIgaW5mb3JtYXRpb25cblx0XHRcdFx0XHRcdFx0cmV0dXJuIHhBeGlzUHJlZml4ICsgZDMuZm9ybWF0KCBcIixcIiApKCBBcHAuVXRpbHMuZm9ybWF0VmFsdWUoIGQsIHhBeGlzRm9ybWF0ICkgKSArIHhBeGlzU3VmZml4O1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gKTtcblxuXHRcdFx0XHRpZiggdGltZVR5cGUgPT0gXCJRdWFydGVyIENlbnR1cnlcIiApIHtcblx0XHRcdFx0XHR0aGF0LmNoYXJ0LnhBeGlzLnN0YWdnZXJMYWJlbHMoIHRydWUgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0Ly9nZXQgZXh0ZW5kXG5cdFx0XHRcdHZhciBhbGxWYWx1ZXMgPSBbXTtcblx0XHRcdFx0Xy5lYWNoKCBsb2NhbERhdGEsIGZ1bmN0aW9uKCB2LCBpICkge1xuXHRcdFx0XHRcdGlmKCB2LnZhbHVlcyApIHtcblx0XHRcdFx0XHRcdGFsbFZhbHVlcyA9IGFsbFZhbHVlcy5jb25jYXQoIHYudmFsdWVzICk7XG5cdFx0XHRcdFx0fSBlbHNlIGlmKCAkLmlzQXJyYXkoIHYgKSApe1xuXHRcdFx0XHRcdFx0Ly9zcGVjaWFsIGNhc2UgZm9yIGRpc2NyZXRlIGJhciBjaGFydFxuXHRcdFx0XHRcdFx0YWxsVmFsdWVzID0gdjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gKTtcblxuXHRcdFx0XHQvL2RvbWFpbiBzZXR1cFxuXHRcdFx0XHR2YXIgeERvbWFpbiA9IGQzLmV4dGVudCggYWxsVmFsdWVzLm1hcCggZnVuY3Rpb24oIGQgKSB7IHJldHVybiBkLng7IH0gKSApLFxuXHRcdFx0XHRcdHlEb21haW4gPSBkMy5leHRlbnQoIGFsbFZhbHVlcy5tYXAoIGZ1bmN0aW9uKCBkICkgeyByZXR1cm4gZC55OyB9ICkgKSxcblx0XHRcdFx0XHRpc0NsYW1wZWQgPSBmYWxzZTtcblxuXHRcdFx0XHQvL2NvbnNvbGUubG9nKCBcImNoYXJ0LnN0YWNrZWQuc3R5bGUoKVwiLCB0aGF0LmNoYXJ0LnN0YWNrZWQuc3R5bGUoKSApO1xuXG5cdFx0XHRcdGlmKCB4QXhpc01pbiAmJiAhaXNOYU4oIHhBeGlzTWluICkgKSB7XG5cdFx0XHRcdFx0eERvbWFpblsgMCBdID0geEF4aXNNaW47XG5cdFx0XHRcdFx0aXNDbGFtcGVkID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiggeEF4aXNNYXggJiYgIWlzTmFOKCB4QXhpc01heCApICkge1xuXHRcdFx0XHRcdHhEb21haW5bIDEgXSA9IHhBeGlzTWF4O1xuXHRcdFx0XHRcdGlzQ2xhbXBlZCA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYoIHlBeGlzTWluICYmICFpc05hTiggeUF4aXNNaW4gKSApIHtcblx0XHRcdFx0XHR5RG9tYWluWyAwIF0gPSB5QXhpc01pbjtcblx0XHRcdFx0XHRpc0NsYW1wZWQgPSB0cnVlO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vZGVmYXVsdCBpcyB6ZXJvIChkb24ndCBkbyBpdCBmb3Igc3RhY2sgYmFyIGNoYXJ0LCBtZXNzZXMgdXAgdGhpbmdzKVxuXHRcdFx0XHRcdGlmKCBjaGFydFR5cGUgIT0gXCIzXCIgKSB7XG5cdFx0XHRcdFx0XHR5RG9tYWluWyAwIF0gPSAwO1xuXHRcdFx0XHRcdFx0aXNDbGFtcGVkID0gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYoIHlBeGlzTWF4ICYmICFpc05hTiggeUF4aXNNYXggKSApIHtcblx0XHRcdFx0XHR5RG9tYWluWyAxIF0gPSB5QXhpc01heDtcblx0XHRcdFx0XHRpc0NsYW1wZWQgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdFxuXHRcdFx0XHQvL21hbnVhbGx5IGNsYW1wIHZhbHVlc1xuXHRcdFx0XHRpZiggaXNDbGFtcGVkICkge1xuXG5cdFx0XHRcdFx0aWYoIGNoYXJ0VHlwZSAhPT0gXCI0XCIgJiYgY2hhcnRUeXBlICE9PSBcIjVcIiAmJiBjaGFydFR5cGUgIT09IFwiNlwiICkge1xuXHRcdFx0XHRcdFx0dGhhdC5jaGFydC5mb3JjZVgoIHhEb21haW4gKTtcblx0XHRcdFx0XHRcdHRoYXQuY2hhcnQuZm9yY2VZKCB5RG9tYWluICk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Lyp0aGF0LmNoYXJ0LnhEb21haW4oIHhEb21haW4gKTtcblx0XHRcdFx0XHR0aGF0LmNoYXJ0LnlEb21haW4oIHlEb21haW4gKTtcblx0XHRcdFx0XHR0aGF0LmNoYXJ0LnhTY2FsZSgpLmNsYW1wKCB0cnVlICk7XG5cdFx0XHRcdFx0dGhhdC5jaGFydC55U2NhbGUoKS5jbGFtcCggdHJ1ZSApOyovXG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvL3NldCBzY2FsZXMsIG11bHRpYmFyIGNoYXJ0XG5cdFx0XHRcdGlmKCB5QXhpc1NjYWxlID09PSBcImxpbmVhclwiICkge1xuXHRcdFx0XHRcdHRoYXQuY2hhcnQueVNjYWxlKCBkMy5zY2FsZS5saW5lYXIoKSApO1xuXHRcdFx0XHR9IGVsc2UgaWYoIHlBeGlzU2NhbGUgPT09IFwibG9nXCIgKSB7XG5cdFx0XHRcdFx0dGhhdC5jaGFydC55U2NhbGUoIGQzLnNjYWxlLmxvZygpICk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiggY2hhcnRUeXBlID09PSBcIjRcIiB8fCBjaGFydFR5cGUgPT09IFwiNVwiICkge1xuXHRcdFx0XHRcdC8vZm9yIG11bHRpYmFyIGNoYXJ0LCB4IGF4aXMgaGFzIG9yZGluYWwgc2NhbGUsIHNvIG5lZWQgdG8gc2V0dXAgZG9tYWluIHByb3Blcmx5XG5cdFx0XHRcdFx0Ly90aGF0LmNoYXJ0LnhEb21haW4oIGQzLnJhbmdlKHhEb21haW5bMF0sIHhEb21haW5bMV0gKyAxKSApO1xuXHRcdFx0XHRcdHRoYXQuY2hhcnQueERvbWFpbiggYWxsVGltZXMgKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoYXQuY2hhcnQueUF4aXNcblx0XHRcdFx0XHQuYXhpc0xhYmVsKCB5QXhpc1sgXCJheGlzLWxhYmVsXCIgXSApXG5cdFx0XHRcdFx0LmF4aXNMYWJlbERpc3RhbmNlKCB5QXhpc0xhYmVsRGlzdGFuY2UgKVxuXHRcdFx0XHRcdC50aWNrRm9ybWF0KCBmdW5jdGlvbihkKSB7IHJldHVybiB5QXhpc1ByZWZpeCArIGQzLmZvcm1hdCggXCIsXCIgKSggQXBwLlV0aWxzLmZvcm1hdFZhbHVlKCBkLCB5QXhpc0Zvcm1hdCApICkgKyB5QXhpc1N1ZmZpeDsgfSlcblx0XHRcdFx0XHQuc2hvd01heE1pbihmYWxzZSk7XG5cdFx0XHRcdFxuXHRcdFx0XHQvL3NjYXR0ZXIgcGxvdHMgbmVlZCBtb3JlIHRpY2tzXG5cdFx0XHRcdGlmKCBjaGFydFR5cGUgPT09IFwiMlwiICkge1xuXHRcdFx0XHRcdC8vaGFyZGNvZGVcblx0XHRcdFx0XHR0aGF0LmNoYXJ0LnhBeGlzLnRpY2tzKCA3ICk7XG5cdFx0XHRcdFx0dGhhdC5jaGFydC55QXhpcy50aWNrcyggNyApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdFxuXHRcdFx0XHR2YXIgc3ZnU2VsZWN0aW9uID0gZDMuc2VsZWN0KCB0aGF0LiRzdmcuc2VsZWN0b3IgKVxuXHRcdFx0XHRcdC5kYXR1bSggbG9jYWxEYXRhIClcblx0XHRcdFx0XHQuY2FsbCggdGhhdC5jaGFydCApO1xuXHRcdFx0XHRcblx0XHRcdFx0aWYoIGNoYXJ0VHlwZSAhPT0gXCIzXCIgKSB7XG5cblx0XHRcdFx0XHR0aGF0LmNoYXJ0LnRvb2x0aXAuY29udGVudEdlbmVyYXRvciggQXBwLlV0aWxzLmNvbnRlbnRHZW5lcmF0b3IgKTtcblxuXHRcdFx0XHR9IGVsc2Uge1xuXG5cdFx0XHRcdFx0Ly9zZXQgcG9wdXBcblx0XHRcdFx0XHR2YXIgdW5pdHNTdHJpbmcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwidW5pdHNcIiApLFxuXHRcdFx0XHRcdFx0dW5pdHMgPSAoICEkLmlzRW1wdHlPYmplY3QoIHVuaXRzU3RyaW5nICkgKT8gJC5wYXJzZUpTT04oIHVuaXRzU3RyaW5nICk6IHt9LFxuXHRcdFx0XHRcdFx0c3RyaW5nID0gXCJcIixcblx0XHRcdFx0XHRcdHZhbHVlc1N0cmluZyA9IFwiXCI7XG5cblx0XHRcdFx0XHQvL2QzLmZvcm1hdCB3aXRoIGFkZGVkIHBhcmFtcyB0byBhZGQgYXJiaXRyYXJ5IHN0cmluZyBhdCB0aGUgZW5kXG5cdFx0XHRcdFx0dmFyIGN1c3RvbUZvcm1hdHRlciA9IGZ1bmN0aW9uKCBmb3JtYXRTdHJpbmcsIHN1ZmZpeCApIHtcblx0XHRcdFx0XHRcdHZhciBmdW5jID0gZDMuZm9ybWF0KCBmb3JtYXRTdHJpbmcgKTtcblx0XHRcdFx0XHRcdHJldHVybiBmdW5jdGlvbiggZCwgaSApIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGZ1bmMoIGQgKSArIHN1ZmZpeDtcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0fTtcblxuXHRcdFx0XHRcdC8vZGlmZmVyZW50IHBvcHVwIHNldHVwIGZvciBzdGFja2VkIGFyZWEgY2hhcnRcblx0XHRcdFx0XHR2YXIgdW5pdCA9IF8uZmluZFdoZXJlKCB1bml0cywgeyBwcm9wZXJ0eTogXCJ5XCIgfSApO1xuXHRcdFx0XHRcdGlmKCB1bml0ICYmIHVuaXQuZm9ybWF0ICkge1xuXHRcdFx0XHRcdFx0dmFyIGZpeGVkID0gTWF0aC5taW4oIDIwLCBwYXJzZUludCggdW5pdC5mb3JtYXQsIDEwICkgKSxcblx0XHRcdFx0XHRcdFx0dW5pdE5hbWUgPSAoIHVuaXQudW5pdCApPyBcIiBcIiArIHVuaXQudW5pdDogXCJcIjtcblx0XHRcdFx0XHRcdHRoYXQuY2hhcnQuaW50ZXJhY3RpdmVMYXllci50b29sdGlwLnZhbHVlRm9ybWF0dGVyKCBjdXN0b21Gb3JtYXR0ZXIoXCIuXCIgKyBmaXhlZCArIFwiZlwiLCB1bml0TmFtZSApICk7XG5cdFx0XHRcdFx0XHQvL3RoYXQuY2hhcnQuaW50ZXJhY3RpdmVMYXllci50b29sdGlwLnZhbHVlRm9ybWF0dGVyKCBkMy5mb3JtYXQoXCIuXCIgKyBmaXhlZCArIFwiZlwiICkgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdC8vc2V0IGxlZ2VuZFxuXHRcdFx0XHRpZiggIUFwcC5DaGFydE1vZGVsLmdldCggXCJoaWRlLWxlZ2VuZFwiICkgKSB7XG5cdFx0XHRcdFx0Ly9tYWtlIHN1cmUgd3JhcHBlciBpcyB2aXNpYmxlXG5cdFx0XHRcdFx0dGhhdC4kc3ZnLmZpbmQoIFwiPiAubnZkMy5udi1jdXN0b20tbGVnZW5kXCIgKS5zaG93KCk7XG5cdFx0XHRcdFx0dGhhdC5sZWdlbmQgPSBuZXcgTGVnZW5kKCB0aGF0LmNoYXJ0LmxlZ2VuZCApLnZlcnMoIFwib3dkXCIgKTtcblx0XHRcdFx0XHR0aGF0LmxlZ2VuZC5kaXNwYXRjaC5vbiggXCJyZW1vdmVFbnRpdHlcIiwgZnVuY3Rpb24oIGlkICkge1xuXHRcdFx0XHRcdFx0dGhhdC5vblJlbW92ZUVudGl0eSggaWQgKTtcblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0dGhhdC5sZWdlbmQuZGlzcGF0Y2gub24oIFwiYWRkRW50aXR5XCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0aWYoIHRoYXQuJGVudGl0aWVzU2VsZWN0LmRhdGEoIFwiY2hvc2VuXCIgKSApIHtcblx0XHRcdFx0XHRcdFx0dGhhdC4kZW50aXRpZXNTZWxlY3QuZGF0YSggXCJjaG9zZW5cIiApLmFjdGl2ZV9maWVsZCA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Ly90cmlnZ2VyIG9wZW4gdGhlIGNob3NlbiBkcm9wIGRvd25cblx0XHRcdFx0XHRcdHRoYXQuJGVudGl0aWVzU2VsZWN0LnRyaWdnZXIoIFwiY2hvc2VuOm9wZW5cIiApO1xuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHRzdmdTZWxlY3Rpb24uY2FsbCggdGhhdC5sZWdlbmQgKTtcblx0XHRcdFx0XHQvL3B1dCBsZWdlbmQgYWJvdmUgY2hhcnRcblxuXG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly9ubyBsZWdlbmQsIHJlbW92ZSB3aGF0IG1pZ2h0IGhhdmUgcHJldmlvdXNseSBiZWVuIHRoZXJlXG5cdFx0XHRcdFx0dGhhdC4kc3ZnLmZpbmQoIFwiPiAubnZkMy5udi1jdXN0b20tbGVnZW5kXCIgKS5oaWRlKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdHZhciBvblJlc2l6ZUNhbGxiYWNrID0gXy5kZWJvdW5jZSggZnVuY3Rpb24oZSkge1xuXHRcdFx0XHRcdC8vaW52b2tlIHJlc2l6ZSBvZiBsZWdlbmQsIGlmIHRoZXJlJ3Mgb25lLCBzY2F0dGVyIHBsb3QgZG9lc24ndCBoYXZlIGFueSBieSBkZWZhdWx0XG5cdFx0XHRcdFx0aWYoIHRoYXQubGVnZW5kICkge1xuXHRcdFx0XHRcdFx0c3ZnU2VsZWN0aW9uLmNhbGwoIHRoYXQubGVnZW5kICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoYXQucGFyZW50Vmlldy5vblJlc2l6ZSgpO1xuXHRcdFx0XHR9LCAxNTAgKTtcblx0XHRcdFx0bnYudXRpbHMud2luZG93UmVzaXplKCBvblJlc2l6ZUNhbGxiYWNrICk7XG5cdFx0XHRcdFx0XHRcblx0XHRcdFx0dGhhdC5wYXJlbnRWaWV3Lm9uUmVzaXplKCk7XG5cblx0XHRcdFx0dmFyIHN0YXRlQ2hhbmdlRXZlbnQgPSAoIGNoYXJ0VHlwZSAhPT0gXCI2XCIgKT8gXCJzdGF0ZUNoYW5nZVwiOiBcInJlbmRlckVuZFwiO1xuXHRcdFx0XHR0aGF0LmNoYXJ0LmRpc3BhdGNoLm9uKCBzdGF0ZUNoYW5nZUV2ZW50LCBmdW5jdGlvbiggc3RhdGUgKSB7XG5cdFx0XHRcdFx0Ly9yZWZyZXNoIGxlZ2VuZDtcblx0XHRcdFx0XHRzdmdTZWxlY3Rpb24uY2FsbCggdGhhdC5sZWdlbmQgKTtcblxuXHRcdFx0XHRcdC8vXG5cdFx0XHRcdFx0aWYoIGNoYXJ0VHlwZSA9PT0gXCIzXCIgKSB7XG5cdFx0XHRcdFx0XHR0aGF0LmNoZWNrU3RhY2tlZEF4aXMoKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvL1RPRE8gLSB1Z2x5ISBuZWVkcyB0aW1lb3V0IGFuZCByZWFjaGluZyB0byBjaGFydHZpZXcgIFxuXHRcdFx0XHRcdHNldFRpbWVvdXQoIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0dGhhdC5wYXJlbnRWaWV3Lm9uUmVzaXplKCk7XG5cdFx0XHRcdFx0fSwgMSk7XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0dGhhdC5wYXJlbnRWaWV3LmRhdGFUYWIucmVuZGVyKCBkYXRhLCBsb2NhbERhdGEsIGRpbWVuc2lvbnMgKTtcblx0XHRcdFx0XG5cdFx0XHRcdGlmKCBjaGFydFR5cGUgPT0gXCIyXCIgKSB7XG5cdFx0XHRcdFx0Ly9uZWVkIHRvIGhhdmUgb3duIHNob3dEaXN0IGltcGxlbWVudGF0aW9uLCBjYXVzZSB0aGVyZSdzIGEgYnVnIGluIG52ZDNcblx0XHRcdFx0XHR0aGF0LnNjYXR0ZXJEaXN0KCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdC8vaWYgeSBheGlzIGhhcyB6ZXJvLCBkaXNwbGF5IHNvbGlkIGxpbmVcblx0XHRcdFx0dmFyICRwYXRoRG9tYWluID0gJCggXCIubnZkMyAubnYtYXhpcy5udi14IHBhdGguZG9tYWluXCIgKTtcblx0XHRcdFx0aWYoIHlEb21haW5bIDAgXSA9PT0gMCApIHtcblx0XHRcdFx0XHQkcGF0aERvbWFpbi5jc3MoIFwic3Ryb2tlLW9wYWNpdHlcIiwgXCIxXCIgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQkcGF0aERvbWFpbi5jc3MoIFwic3Ryb2tlLW9wYWNpdHlcIiwgXCIwXCIgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0Ly90aGF0LnNjYWxlU2VsZWN0b3JzLmluaXRFdmVudHMoKTtcblx0XHRcdFx0dmFyIGNoYXJ0RGltZW5zaW9uc1N0cmluZyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC1kaW1lbnNpb25zXCIgKTtcblx0XHRcdFx0aWYoIGNoYXJ0RGltZW5zaW9uc1N0cmluZy5pbmRleE9mKCAnXCJwcm9wZXJ0eVwiOlwiY29sb3JcIicgKSA9PT0gLTEgKSB7XG5cdFx0XHRcdFx0Ly9jaGVjayBpZiBzdHJpbmcgZG9lcyBub3QgY29udGFpbiBcInByb3BlcnR5XCI6XCJjb2xvclwiXG5cdFx0XHRcdFx0dGhhdC5jYWNoZUNvbG9ycyggbG9jYWxEYXRhICk7XG5cdFx0XHRcdH1cblxuXHRcdFx0fSk7XG5cblx0XHR9LFxuXG5cdFx0c2NhdHRlckRpc3Q6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHR2YXIgdGhhdCA9IHRoaXMsXG5cdFx0XHRcdG1hcmdpbnMgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwibWFyZ2luc1wiICksXG5cdFx0XHRcdG52RGlzdHJYID0gJCggXCIubnYtZGlzdHJpYnV0aW9uWFwiICkub2Zmc2V0KCkudG9wLFxuXHRcdFx0XHRzdmdTZWxlY3Rpb24gPSBkMy5zZWxlY3QoIFwic3ZnXCIgKTtcblxuXHRcdFx0dGhhdC5jaGFydC5zY2F0dGVyLmRpc3BhdGNoLm9uKCdlbGVtZW50TW91c2VvdmVyLnRvb2x0aXAnLCBmdW5jdGlvbihldnQpIHtcblx0XHRcdFx0dmFyIHN2Z09mZnNldCA9IHRoYXQuJHN2Zy5vZmZzZXQoKSxcblx0XHRcdFx0XHRzdmdIZWlnaHQgPSB0aGF0LiRzdmcuaGVpZ2h0KCk7XG5cdFx0XHRcdHN2Z1NlbGVjdGlvbi5zZWxlY3QoJy5udi1zZXJpZXMtJyArIGV2dC5zZXJpZXNJbmRleCArICcgLm52LWRpc3R4LScgKyBldnQucG9pbnRJbmRleClcblx0XHRcdFx0XHQuYXR0cigneTEnLCBldnQucG9zLnRvcCAtIG52RGlzdHJYICk7XG5cdFx0XHRcdHN2Z1NlbGVjdGlvbi5zZWxlY3QoJy5udi1zZXJpZXMtJyArIGV2dC5zZXJpZXNJbmRleCArICcgLm52LWRpc3R5LScgKyBldnQucG9pbnRJbmRleClcblx0XHRcdFx0XHQuYXR0cigneDInLCBldnQucG9zLmxlZnQgLSBzdmdPZmZzZXQubGVmdCAtIG1hcmdpbnMubGVmdCApO1xuXHRcdFx0XHR2YXIgcG9zaXRpb24gPSB7bGVmdDogZDMuZXZlbnQuY2xpZW50WCwgdG9wOiBkMy5ldmVudC5jbGllbnRZIH07XG5cdFx0XHRcdHRoYXQuY2hhcnQudG9vbHRpcC5wb3NpdGlvbihwb3NpdGlvbikuZGF0YShldnQpLmhpZGRlbihmYWxzZSk7XG5cdFx0XHR9KTtcblxuXHRcdH0sXG5cblx0XHRzY2F0dGVyQnViYmxlU2l6ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHQvL3NldCBzaXplIG9mIHRoZSBidWJibGVzIGRlcGVuZGluZyBvbiBicm93c2VyIHdpZHRoXG5cdFx0XHR2YXIgYnJvd3NlcldpZHRoID0gJCggd2luZG93ICkud2lkdGgoKSxcblx0XHRcdFx0YnJvd3NlckNvZWYgPSBNYXRoLm1heCggMSwgYnJvd3NlcldpZHRoIC8gMTEwMCApLFxuXHRcdFx0XHRwb2ludE1pbiA9IDEwMCAqIE1hdGgucG93KCBicm93c2VyQ29lZiwgMiApLFxuXHRcdFx0XHRwb2ludE1heCA9IDEwMDAgKiBNYXRoLnBvdyggYnJvd3NlckNvZWYsIDIgKTtcblx0XHRcdHJldHVybiBbIHBvaW50TWluLCBwb2ludE1heCBdO1xuXHRcdH0sXG5cblx0XHRjaGVja1N0YWNrZWRBeGlzOiBmdW5jdGlvbigpIHtcblxuXHRcdFx0Ly9zZXR0aW5nIHlBeGlzTWF4IGJyZWFrcyBleHBhbmRlZCBzdGFja2VkIGNoYXJ0LCBuZWVkIHRvIGNoZWNrIG1hbnVhbGx5XG5cdFx0XHR2YXIgc3RhY2tlZFN0eWxlID0gdGhpcy5jaGFydC5zdGFja2VkLnN0eWxlKCksXG5cdFx0XHRcdHlBeGlzID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcInktYXhpc1wiICksXG5cdFx0XHRcdHlBeGlzTWluID0gKCB5QXhpc1sgXCJheGlzLW1pblwiIF0gfHwgMCApLFxuXHRcdFx0XHR5QXhpc01heCA9ICggeUF4aXNbIFwiYXhpcy1tYXhcIiBdIHx8IG51bGwgKSxcblx0XHRcdFx0eURvbWFpbiA9IFsgeUF4aXNNaW4sIHlBeGlzTWF4IF07XG5cdFx0XHRpZiggeUF4aXNNYXggKSB7XG5cdFx0XHRcdC8vY2hhcnQgaGFzIHNldCB5QXhpcyB0byBtYXgsIGRlcGVuZGluZyBvbiBzdGFja2VkIHN0eWxlIHNldCBtYXhcblx0XHRcdFx0aWYoIHN0YWNrZWRTdHlsZSA9PT0gXCJleHBhbmRcIiApIHtcblx0XHRcdFx0XHR5RG9tYWluID0gWyAwLCAxIF07XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5jaGFydC55RG9tYWluKCB5RG9tYWluICk7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHR9LFxuXG5cdFx0b25SZW1vdmVFbnRpdHk6IGZ1bmN0aW9uKCBpZCApIHtcblxuXHRcdFx0dmFyIHNlbGVjdGVkQ291bnRyaWVzID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcInNlbGVjdGVkLWNvdW50cmllc1wiICksXG5cdFx0XHRcdGNvdW50cmllc0lkcyA9IF8ua2V5cyggc2VsZWN0ZWRDb3VudHJpZXMgKSxcblx0XHRcdFx0YWRkQ291bnRyeU1vZGUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiYWRkLWNvdW50cnktbW9kZVwiICk7XG5cblx0XHRcdGlmKCBjb3VudHJpZXNJZHMubGVuZ3RoID09PSAwICkge1xuXHRcdFx0XHQvL3JlbW92aW5nIGZyb20gZW1wdHkgc2VsZWN0aW9uLCBuZWVkIHRvIGNvcHkgYWxsIGNvdW50cmllcyBhdmFpbGFibGUgaW50byBzZWxlY3RlZCBjb3VudHJpZXMgc2VsZWN0aW9uXG5cdFx0XHRcdHZhciBlbnRpdGllc0NvbGxlY3Rpb24gPSBbXSxcblx0XHRcdFx0Ly92YXIgZW50aXRpZXNDb2xsZWN0aW9uID0ge30sXG5cdFx0XHRcdFx0Zm9ybUNvbmZpZyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJmb3JtLWNvbmZpZ1wiICk7XG5cdFx0XHRcdGlmKCBmb3JtQ29uZmlnICYmIGZvcm1Db25maWdbIFwiZW50aXRpZXMtY29sbGVjdGlvblwiIF0gKSB7XG5cdFx0XHRcdFx0Xy5tYXAoIGZvcm1Db25maWdbIFwiZW50aXRpZXMtY29sbGVjdGlvblwiIF0sIGZ1bmN0aW9uKCBkLCBpICkgeyBlbnRpdGllc0NvbGxlY3Rpb25bIGQuaWQgXSA9IGQ7IH0gKTtcblx0XHRcdFx0XHQvL2RlZXAgY29weSBhcnJheVxuXHRcdFx0XHRcdHZhciBlbnRpdGllc0NvcHkgPSAgJC5leHRlbmQoIHRydWUsIFtdLCBmb3JtQ29uZmlnWyBcImVudGl0aWVzLWNvbGxlY3Rpb25cIiBdICk7XG5cdFx0XHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0KCBcInNlbGVjdGVkLWNvdW50cmllc1wiLCBlbnRpdGllc0NvcHkgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0QXBwLkNoYXJ0TW9kZWwucmVtb3ZlU2VsZWN0ZWRDb3VudHJ5KCBpZCApO1xuXG5cdFx0fSxcblxuXHRcdG9uQXZhaWxhYmxlQ291bnRyaWVzOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHR2YXIgJHNlbGVjdCA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICksXG5cdFx0XHRcdHZhbCA9ICRzZWxlY3QudmFsKCksXG5cdFx0XHRcdCRvcHRpb24gPSAkc2VsZWN0LmZpbmQoIFwiW3ZhbHVlPVwiICsgdmFsICsgXCJdXCIgKSxcblx0XHRcdFx0dGV4dCA9ICRvcHRpb24udGV4dCgpO1xuXG5cdFx0XHRpZiggIUFwcC5DaGFydE1vZGVsLmdldCggXCJncm91cC1ieS12YXJpYWJsZXNcIiApICYmIEFwcC5DaGFydE1vZGVsLmdldCggXCJhZGQtY291bnRyeS1tb2RlXCIgKSA9PT0gXCJhZGQtY291bnRyeVwiICkge1xuXHRcdFx0XHRBcHAuQ2hhcnRNb2RlbC5hZGRTZWxlY3RlZENvdW50cnkoIHsgaWQ6ICRzZWxlY3QudmFsKCksIG5hbWU6IHRleHQgfSApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0QXBwLkNoYXJ0TW9kZWwucmVwbGFjZVNlbGVjdGVkQ291bnRyeSggeyBpZDogJHNlbGVjdC52YWwoKSwgbmFtZTogdGV4dCB9ICk7XG5cdFx0XHR9XG5cblx0XHRcdC8vZG91YmxlIGNoZWNrIGlmIHdlIGRvbid0IGhhdmUgZnVsbCBzZWxlY3Rpb24gb2YgY291bnRyaWVzXG5cdFx0XHR2YXIgZW50aXRpZXNDb2xsZWN0aW9uID0ge30sXG5cdFx0XHRcdGZvcm1Db25maWcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiZm9ybS1jb25maWdcIiApO1xuXHRcdFx0aWYoIGZvcm1Db25maWcgJiYgZm9ybUNvbmZpZ1sgXCJlbnRpdGllcy1jb2xsZWN0aW9uXCIgXSApIHtcblx0XHRcdFx0dmFyIHNlbGVjdGVkQ291bnRyaWVzSWRzID0gXy5rZXlzKCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwic2VsZWN0ZWQtY291bnRyaWVzXCIgKSApO1xuXHRcdFx0XHRpZiggc2VsZWN0ZWRDb3VudHJpZXNJZHMubGVuZ3RoID09IGZvcm1Db25maWdbIFwiZW50aXRpZXMtY29sbGVjdGlvblwiIF0ubGVuZ3RoICkge1xuXHRcdFx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiwgW10sIHtzaWxlbnQ6dHJ1ZX0gKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0fSxcblxuXHRcdGNhY2hlQ29sb3JzOiBmdW5jdGlvbiggZGF0YSApIHtcblx0XHRcdGlmKCAhdGhpcy5jYWNoZWRDb2xvcnMubGVuZ3RoICkge1xuXHRcdFx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0XHRcdF8uZWFjaCggZGF0YSwgZnVuY3Rpb24oIHYsIGkgKSB7XG5cdFx0XHRcdFx0dGhhdC5jYWNoZWRDb2xvcnNbIHYuaWQgXSA9IHYuY29sb3I7XG5cdFx0XHRcdH0gKTtcblx0XHRcdH1cblx0XHR9LFxuXG5cdFx0YXNzaWduQ29sb3JGcm9tQ2FjaGU6IGZ1bmN0aW9uKCB2YWx1ZSApIHtcblx0XHRcdGlmKCB0aGlzLmNhY2hlZENvbG9ycy5sZW5ndGggKSB7XG5cdFx0XHRcdC8vYXNzaW5nIGNvbG9yIGZyb21lIGNhY2hlXG5cdFx0XHRcdGlmKCB0aGlzLmNhY2hlZENvbG9yc1sgdmFsdWUuaWQgXSApIHtcblx0XHRcdFx0XHR2YWx1ZS5jb2xvciA9IHRoaXMuY2FjaGVkQ29sb3JzWyB2YWx1ZS5pZCBdO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHZhciByYW5kb21Db2xvciA9IEFwcC5VdGlscy5nZXRSYW5kb21Db2xvcigpO1xuXHRcdFx0XHRcdHZhbHVlLmNvbG9yID0gcmFuZG9tQ29sb3I7XG5cdFx0XHRcdFx0dGhpcy5jYWNoZWRDb2xvcnNbIHZhbHVlLmlkIF0gPSByYW5kb21Db2xvcjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHZhbHVlO1xuXHRcdH1cblx0XHRcblx0fSApO1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkNoYXJ0LkNoYXJ0VGFiO1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0QXBwLlZpZXdzLkNoYXJ0LkRhdGFUYWIgPSBCYWNrYm9uZS5WaWV3LmV4dGVuZCgge1xuXG5cdFx0ZWw6IFwiI2NoYXJ0LXZpZXdcIixcblx0XHRldmVudHM6IHt9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHRcblx0XHRcdHRoaXMuZGlzcGF0Y2hlciA9IG9wdGlvbnMuZGlzcGF0Y2hlcjtcblxuXHRcdFx0Ly9kYXRhIHRhYlxuXHRcdFx0dGhpcy4kZGF0YVRhYiA9IHRoaXMuJGVsLmZpbmQoIFwiI2RhdGEtY2hhcnQtdGFiXCIgKTtcblx0XHRcdHRoaXMuJGRvd25sb2FkQnRuID0gdGhpcy4kZGF0YVRhYi5maW5kKCBcIi5kb3dubG9hZC1kYXRhLWJ0blwiICk7XG5cdFx0XHR0aGlzLiRkYXRhVGFibGVXcmFwcGVyID0gdGhpcy4kZGF0YVRhYi5maW5kKCBcIi5kYXRhLXRhYmxlLXdyYXBwZXJcIiApO1xuXG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oIGRhdGEsIGxvY2FsRGF0YSwgZGltZW5zaW9ucyApIHtcblx0XHRcdFxuXHRcdFx0dGhpcy4kZGF0YVRhYmxlV3JhcHBlci5lbXB0eSgpO1xuXG5cdFx0XHQvL3VwZGF0ZSBsaW5rXG5cdFx0XHR2YXIgdGhhdCA9IHRoaXMsXG5cdFx0XHRcdGNoYXJ0VHlwZSA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10eXBlXCIgKSxcblx0XHRcdFx0aGFzTXVsdGlwbGVDb2x1bW5zID0gKCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiZ3JvdXAtYnktdmFyaWFibGVzXCIgKSAmJiBjaGFydFR5cGUgIT09IFwiM1wiICk/IHRydWU6IGZhbHNlOy8qLFxuXHRcdFx0XHRiYXNlVXJsID0gdGhpcy4kZG93bmxvYWRCdG4uYXR0ciggXCJkYXRhLWJhc2UtdXJsXCIgKSxcblx0XHRcdFx0ZGltZW5zaW9uc1VybCA9IGVuY29kZVVSSUNvbXBvbmVudCggZGltZW5zaW9uc1N0cmluZyApOyovXG5cdFx0XHQvL3RoaXMuJGRvd25sb2FkQnRuLmF0dHIoIFwiaHJlZlwiLCBiYXNlVXJsICsgXCI/ZGltZW5zaW9ucz1cIiArIGRpbWVuc2lvbnNVcmwgKyBcIiZjaGFydFR5cGU9XCIgKyBjaGFydFR5cGUgKyBcIiZleHBvcnQ9Y3N2XCIgKTtcblx0XHRcdHRoaXMuJGRvd25sb2FkQnRuLm9uKCBcImNsaWNrXCIsIGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cblx0XHRcdFx0dmFyIGRhdGEgPSBbXSxcblx0XHRcdFx0XHQkdHJzID0gdGhhdC4kZWwuZmluZCggXCJ0clwiICk7XG5cdFx0XHRcdCQuZWFjaCggJHRycywgZnVuY3Rpb24oIGksIHYgKSB7XG5cblx0XHRcdFx0XHR2YXIgdHJEYXRhID0gW10sXG5cdFx0XHRcdFx0XHQkdHIgPSAkKCB0aGlzICksXG5cdFx0XHRcdFx0XHQkY2VsbHMgPSAkdHIuZmluZCggXCJ0aCwgdGRcIiApO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdCQuZWFjaCggJGNlbGxzLCBmdW5jdGlvbiggaTIsIHYyICkge1xuXHRcdFx0XHRcdFx0dHJEYXRhLnB1c2goICQoIHYyICkudGV4dCgpICk7XG5cdFx0XHRcdFx0fSApO1xuXG5cdFx0XHRcdFx0ZGF0YS5wdXNoKCB0ckRhdGEgKTtcblxuXHRcdFx0XHR9ICk7XG5cblx0XHRcdFx0dmFyIGNzdlN0cmluZyA9IFwiZGF0YTp0ZXh0L2NzdjtjaGFyc2V0PXV0Zi04LFwiO1xuXHRcdFx0XHRfLmVhY2goIGRhdGEsIGZ1bmN0aW9uKCB2LCBpICkge1xuXHRcdFx0XHRcdHZhciBkYXRhU3RyaW5nID0gdi5qb2luKFwiLFwiKTtcblx0XHRcdFx0XHRjc3ZTdHJpbmcgKz0gKCBpIDwgZGF0YS5sZW5ndGggKT8gZGF0YVN0cmluZysgXCJcXG5cIiA6IGRhdGFTdHJpbmc7XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0XG5cdFx0XHRcdHZhciBlbmNvZGVkVXJpID0gZW5jb2RlVVJJKCBjc3ZTdHJpbmcgKTtcblx0XHRcdFx0d2luZG93Lm9wZW4oIGVuY29kZWRVcmkgKTtcblxuXHRcdFx0fSApO1xuXG5cdFx0XHQvL2dldCBhbGwgdGltZXNcblx0XHRcdHZhciB0aW1lc09iaiA9IFtdLFxuXHRcdFx0XHR0aW1lcyA9IFtdO1xuXHRcdFx0Xy5lYWNoKCBkYXRhLCBmdW5jdGlvbiggZW50aXR5RGF0YSwgZW50aXR5SWQgKSB7XG5cblx0XHRcdFx0dmFyIHZhbHVlcyA9IGVudGl0eURhdGEudmFsdWVzLFxuXHRcdFx0XHRcdHZhbHVlc0J5VGltZSA9IFtdO1xuXG5cdFx0XHRcdF8uZWFjaCggdmFsdWVzLCBmdW5jdGlvbiggdmFsdWUgKSB7XG5cblx0XHRcdFx0XHQvL3N0b3JlIGdpdmVuIHRpbWUgYXMgZXhpc3Rpbmdcblx0XHRcdFx0XHR2YXIgdGltZSA9IHZhbHVlLnRpbWU7XG5cdFx0XHRcdFx0aWYoICF0aW1lc09ialsgdGltZSBdICkge1xuXHRcdFx0XHRcdFx0dGltZXNPYmpbIHRpbWUgXSA9IHRydWU7XG5cdFx0XHRcdFx0XHR0aW1lcy5wdXNoKCB0aW1lICk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly9yZS1tYXAgdmFsdWVzIGJ5IHRpbWUga2V5XG5cdFx0XHRcdFx0dmFsdWVzQnlUaW1lWyB0aW1lIF0gPSB2YWx1ZTtcblxuXHRcdFx0XHR9ICk7XG5cblx0XHRcdFx0ZW50aXR5RGF0YS52YWx1ZXNCeVRpbWUgPSB2YWx1ZXNCeVRpbWU7XG5cblx0XHRcdH0gKTtcblxuXHRcdFx0Ly9zb3J0IGdhdGhlcmVkIHRpbWVzXG5cdFx0XHR0aW1lcyA9IF8uc29ydEJ5KCB0aW1lcywgZnVuY3Rpb24oIHYgKSB7IHJldHVybiArdjsgfSApO1xuXHRcdFx0XG5cdFx0XHQvL2NyZWF0ZSBmaXJzdCByb3dcblx0XHRcdHZhciB0YWJsZVN0cmluZyA9IFwiPHRhYmxlIGNsYXNzPSdkYXRhLXRhYmxlJz5cIixcblx0XHRcdFx0dHIgPSBcIjx0cj48dGQ+PHN0cm9uZz4gPC9zdHJvbmc+PC90ZD5cIjtcblx0XHRcdF8uZWFjaCggdGltZXMsIGZ1bmN0aW9uKCB0aW1lICkge1xuXG5cdFx0XHRcdC8vY3JlYXRlIGNvbHVtbiBmb3IgZXZlcnkgZGltZW5zaW9uXG5cdFx0XHRcdF8uZWFjaCggZGltZW5zaW9ucywgZnVuY3Rpb24oIGRpbWVuc2lvbiwgaSApIHtcblx0XHRcdFx0XHRpZiggaSA9PT0gMCB8fCBoYXNNdWx0aXBsZUNvbHVtbnMgKSB7XG5cdFx0XHRcdFx0XHR2YXIgdGggPSBcIjx0aD5cIjtcblx0XHRcdFx0XHRcdHRoICs9IHRpbWU7XG5cdFx0XHRcdFx0XHRpZiggZGltZW5zaW9ucy5sZW5ndGggPiAxICYmIGhhc011bHRpcGxlQ29sdW1ucyApIHtcblx0XHRcdFx0XHRcdFx0Ly93ZSBoYXZlIG1vcmUgdGhhbiBvbmUgZGltZW5zaW9uLCBuZWVkIHRvIGRpc3Rpbmd1aXNoIHRoZW0gaW4gXG5cdFx0XHRcdFx0XHRcdHRoICs9IFwiIC0gXCIgKyBkaW1lbnNpb24udmFyaWFibGVOYW1lO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0dGggKz0gXCI8L3RoPlwiO1xuXHRcdFx0XHRcdFx0dHIgKz0gdGg7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblxuXHRcdFx0fSApO1xuXHRcdFx0dHIgKz0gXCI8L3RyPlwiO1xuXHRcdFx0dGFibGVTdHJpbmcgKz0gdHI7XG5cblx0XHRcdF8uZWFjaCggZGF0YSwgZnVuY3Rpb24oIGVudGl0eURhdGEsIGVudGl0eUlkICkge1xuXG5cdFx0XHRcdHZhciB0ciA9IFwiPHRyPlwiLFxuXHRcdFx0XHRcdC8vYWRkIG5hbWUgb2YgZW50aXR5XG5cdFx0XHRcdFx0dGQgPSBcIjx0ZD48c3Ryb25nPlwiICsgZW50aXR5RGF0YS5rZXkgKyBcIjwvc3Ryb25nPjwvdGQ+XCI7XG5cdFx0XHRcdHRyICs9IHRkO1xuXG5cdFx0XHRcdHZhciB2YWx1ZXNCeVRpbWUgPSBlbnRpdHlEYXRhLnZhbHVlc0J5VGltZTtcblx0XHRcdFx0Xy5lYWNoKCB0aW1lcywgZnVuY3Rpb24oIHRpbWUgKSB7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0Ly9jcmVhdGUgY29sdW1uIGZvciBldmVyeSBkaW1lbnNpb25cblx0XHRcdFx0XHRfLmVhY2goIGRpbWVuc2lvbnMsIGZ1bmN0aW9uKCBkaW1lbnNpb24sIGkgKSB7XG5cdFx0XHRcdFx0XHRpZiggaSA9PT0gMCB8fCBoYXNNdWx0aXBsZUNvbHVtbnMgKSB7XG5cdFx0XHRcdFx0XHRcdHZhciB0ZCA9IFwiPHRkPlwiLFxuXHRcdFx0XHRcdFx0XHRcdHRkVmFsdWUgPSBcIlwiO1xuXHRcdFx0XHRcdFx0XHQvL2lzIHRoZXJlIHZhbHVlIGZvciBnaXZlbiB0aW1lXG5cdFx0XHRcdFx0XHRcdGlmKCB2YWx1ZXNCeVRpbWVbIHRpbWUgXSApIHtcblx0XHRcdFx0XHRcdFx0XHRpZiggIXZhbHVlc0J5VGltZVsgdGltZSBdLmZha2UgKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHR0ZFZhbHVlID0gdmFsdWVzQnlUaW1lWyB0aW1lIF1bIGRpbWVuc2lvbi5wcm9wZXJ0eSBdO1xuXHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0XHQvL2p1c3QgZHVtbXkgdmFsdWVzIGZvciBjb3JyZWN0IHJlbmRlcmluZyBvZiBjaGFydCwgZG9uJ3QgYWRkIGludG8gdGFibGVcblx0XHRcdFx0XHRcdFx0XHRcdHRkVmFsdWUgPSBcIlwiO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR0ZCArPSB0ZFZhbHVlO1xuXHRcdFx0XHRcdFx0XHR0ZCArPSBcIjwvdGQ+XCI7XG5cdFx0XHRcdFx0XHRcdHRyICs9IHRkO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0XG5cdFx0XHRcdHRyICs9IFwiPC90cj5cIjtcblx0XHRcdFx0dGFibGVTdHJpbmcgKz0gdHI7XG5cblx0XHRcdH0gKTtcblxuXHRcdFx0dGFibGVTdHJpbmcgKz0gXCI8L3RhYmxlPlwiO1xuXG5cdFx0XHR2YXIgJHRhYmxlID0gJCggdGFibGVTdHJpbmcgKTtcblx0XHRcdHRoaXMuJGRhdGFUYWJsZVdyYXBwZXIuYXBwZW5kKCAkdGFibGUgKTtcblxuXG5cdFx0fVxuXG5cdH0gKTtcblx0XG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkNoYXJ0LkRhdGFUYWI7XG5cbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHRBcHAuVmlld3MuQ2hhcnQuSGVhZGVyID0gQmFja2JvbmUuVmlldy5leHRlbmQoe1xuXG5cdFx0ZWw6IFwiI2NoYXJ0LXZpZXcgLmNoYXJ0LWhlYWRlclwiLFxuXHRcdGV2ZW50czoge30sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdFxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gb3B0aW9ucy5kaXNwYXRjaGVyO1xuXHRcdFx0XG5cdFx0XHR0aGlzLiR0YWJzID0gdGhpcy4kZWwuZmluZCggXCIuaGVhZGVyLXRhYlwiICk7XG5cdFx0XHR0aGlzLnJlbmRlcigpO1xuXG5cdFx0XHQvL3NldHVwIGV2ZW50c1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwub24oIFwiY2hhbmdlXCIsIHRoaXMucmVuZGVyLCB0aGlzICk7XG5cblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdFxuXHRcdFx0dmFyIHRhYnMgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwidGFic1wiICk7XG5cdFx0XHRcblx0XHRcdC8vaGlkZSBmaXJzdCBldmVyeXRoaW5nXG5cdFx0XHR0aGlzLiR0YWJzLmhpZGUoKTtcblxuXHRcdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdFx0Xy5lYWNoKCB0YWJzLCBmdW5jdGlvbiggdiwgaSApIHtcblx0XHRcdFx0dmFyIHRhYiA9IHRoYXQuJHRhYnMuZmlsdGVyKCBcIi5cIiArIHYgKyBcIi1oZWFkZXItdGFiXCIgKTtcblx0XHRcdFx0dGFiLnNob3coKTtcblx0XHRcdFx0aWYoIGkgPT09IDAgKSB7XG5cdFx0XHRcdFx0dGFiLmFkZENsYXNzKCBcImFjdGl2ZVwiICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblxuXHRcdH1cblxuXHR9KTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5DaGFydC5IZWFkZXI7XG5cbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFxuXHRcInVzZSBzdHJpY3RcIjtcblx0XG5cdEFwcC5WaWV3cy5DaGFydC5MZWdlbmQgPSBmdW5jdGlvbiggY2hhcnRMZWdlbmQgKSB7XG5cdFxuXHRcdC8vYmFzZWQgb24gaHR0cHM6Ly9naXRodWIuY29tL25vdnVzL252ZDMvYmxvYi9tYXN0ZXIvc3JjL21vZGVscy9sZWdlbmQuanNcblxuXHRcdC8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cdFx0Ly8gUHVibGljIFZhcmlhYmxlcyB3aXRoIERlZmF1bHQgU2V0dGluZ3Ncblx0XHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5cdFx0dmFyIGNoYXJ0VHlwZSA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10eXBlXCIgKVxuXHRcdFx0LCBtYXJnaW4gPSB7dG9wOiA1LCByaWdodDogNTAsIGJvdHRvbTogNSwgbGVmdDogNjJ9XG5cdFx0XHQsIHdpZHRoID0gODAwXG5cdFx0XHQsIGhlaWdodCA9IDIwXG5cdFx0XHQsIGdldEtleSA9IGZ1bmN0aW9uKGQpIHsgcmV0dXJuIGQua2V5IH1cblx0XHRcdCwgY29sb3IgPSBudi51dGlscy5nZXRDb2xvcigpXG5cdFx0XHQsIGFsaWduID0gdHJ1ZVxuXHRcdFx0LCBwYWRkaW5nID0gNDAgLy9kZWZpbmUgaG93IG11Y2ggc3BhY2UgYmV0d2VlbiBsZWdlbmQgaXRlbXMuIC0gcmVjb21tZW5kIDMyIGZvciBmdXJpb3VzIHZlcnNpb25cblx0XHRcdCwgcmlnaHRBbGlnbiA9IGZhbHNlXG5cdFx0XHQsIHVwZGF0ZVN0YXRlID0gdHJ1ZSAgIC8vSWYgdHJ1ZSwgbGVnZW5kIHdpbGwgdXBkYXRlIGRhdGEuZGlzYWJsZWQgYW5kIHRyaWdnZXIgYSAnc3RhdGVDaGFuZ2UnIGRpc3BhdGNoLlxuXHRcdFx0LCByYWRpb0J1dHRvbk1vZGUgPSBmYWxzZSAgIC8vSWYgdHJ1ZSwgY2xpY2tpbmcgbGVnZW5kIGl0ZW1zIHdpbGwgY2F1c2UgaXQgdG8gYmVoYXZlIGxpa2UgYSByYWRpbyBidXR0b24uIChvbmx5IG9uZSBjYW4gYmUgc2VsZWN0ZWQgYXQgYSB0aW1lKVxuXHRcdFx0LCBleHBhbmRlZCA9IGZhbHNlXG5cdFx0XHQsIGRpc3BhdGNoID0gZDMuZGlzcGF0Y2goJ2xlZ2VuZENsaWNrJywgJ2xlZ2VuZERibGNsaWNrJywgJ2xlZ2VuZE1vdXNlb3ZlcicsICdsZWdlbmRNb3VzZW91dCcsICdzdGF0ZUNoYW5nZScsICdyZW1vdmVFbnRpdHknLCAnYWRkRW50aXR5Jylcblx0XHRcdCwgdmVycyA9ICdjbGFzc2ljJyAvL09wdGlvbnMgYXJlIFwiY2xhc3NpY1wiIGFuZCBcImZ1cmlvdXNcIiBhbmQgXCJvd2RcIlxuXHRcdFx0O1xuXG5cdFx0ZnVuY3Rpb24gY2hhcnQoc2VsZWN0aW9uKSB7XG5cdFx0XHRcblx0XHRcdHNlbGVjdGlvbi5lYWNoKGZ1bmN0aW9uKGRhdGEpIHtcblx0XHRcdFx0XG5cdFx0XHRcdHZhciAkc3ZnID0gJCggXCJzdmcubnZkMy1zdmdcIiApLFxuXHRcdFx0XHRcdGF2YWlsYWJsZVdpZHRoID0gJHN2Zy53aWR0aCgpIC0gbWFyZ2luLmxlZnQgLSBtYXJnaW4ucmlnaHQsXG5cdFx0XHRcdFx0Y29udGFpbmVyID0gZDMuc2VsZWN0KHRoaXMpO1xuXHRcdFx0XHRcblx0XHRcdFx0bnYudXRpbHMuaW5pdFNWRyhjb250YWluZXIpO1xuXG5cdFx0XHRcdHZhciBiaW5kYWJsZURhdGEgPSBkYXRhO1xuXG5cdFx0XHRcdC8vZGlzY3JldGUgYmFyIGNoYXJ0IG5lZWRzIHVucGFjayBkYXRhXG5cdFx0XHRcdGlmKCBjaGFydFR5cGUgPT09IFwiNlwiICkge1xuXHRcdFx0XHRcdGlmKCBkYXRhICYmIGRhdGEubGVuZ3RoICYmIGRhdGFbMF0udmFsdWVzICkge1xuXHRcdFx0XHRcdFx0dmFyIGRpc2NyZXRlRGF0YSA9IF8ubWFwKCBkYXRhWzBdLnZhbHVlcywgZnVuY3Rpb24oIHYsIGkgKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiB7IGlkOiB2LmlkLCBrZXk6IHYueCwgY29sb3I6IHYuY29sb3IsIHZhbHVlczogdiB9O1xuXHRcdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdFx0YmluZGFibGVEYXRhID0gZGlzY3JldGVEYXRhO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0Ly8gU2V0dXAgY29udGFpbmVycyBhbmQgc2tlbGV0b24gb2YgY2hhcnRcblx0XHRcdFx0dmFyIHdyYXAgPSBjb250YWluZXIuc2VsZWN0QWxsKCdnLm52LWN1c3RvbS1sZWdlbmQnKS5kYXRhKFtiaW5kYWJsZURhdGFdKSxcblx0XHRcdFx0Ly92YXIgd3JhcCA9IGNvbnRhaW5lci5zZWxlY3RBbGwoJ2cubnYtY3VzdG9tLWxlZ2VuZCcpLmRhdGEoW2RhdGFdKSxcblx0XHRcdFx0XHRnRW50ZXIgPSB3cmFwLmVudGVyKCkuYXBwZW5kKCdnJykuYXR0cignY2xhc3MnLCAnbnZkMyBudi1jdXN0b20tbGVnZW5kJykuYXBwZW5kKCdnJykuYXR0ciggJ2NsYXNzJywgJ252LWxlZ2VuZC1zZXJpZXMtd3JhcHBlcicgKSxcblx0XHRcdFx0XHRnID0gd3JhcC5zZWxlY3QoJ2cnKTtcblxuXHRcdFx0XHR3cmFwLmF0dHIoJ3RyYW5zZm9ybScsICd0cmFuc2xhdGUoJyArIG1hcmdpbi5sZWZ0ICsgJywnICsgbWFyZ2luLnRvcCArICcpJyk7XG5cblx0XHRcdFx0dmFyIHNlcmllcyA9IGcuc2VsZWN0QWxsKCcubnYtc2VyaWVzJylcblx0XHRcdFx0XHQuZGF0YShmdW5jdGlvbihkKSB7XG5cdFx0XHRcdFx0XHRpZih2ZXJzICE9ICdmdXJpb3VzJykgcmV0dXJuIGQ7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZC5maWx0ZXIoZnVuY3Rpb24obikge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZXhwYW5kZWQgPyB0cnVlIDogIW4uZGlzZW5nYWdlZDtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcblx0XHRcdFx0Ly9hZGQgZW50aXR5IGxhYmVsXG5cdFx0XHRcdHZhciBlbnRpdHlMYWJlbCA9IHdyYXAuc2VsZWN0KCAnLm52LWVudGl0eS1sYWJlbCcgKSxcblx0XHRcdFx0XHRlbnRpdHlMYWJlbFRleHQgPSBlbnRpdHlMYWJlbC5zZWxlY3QoICd0ZXh0JyApLFxuXHRcdFx0XHRcdGVudGl0eUxhYmVsV2lkdGggPSAwO1xuXHRcdFx0XHQvL2Rpc3BsYXlpbmcgb2YgZW50aXR5IGxhYmVsIGlzIGRpc2FibGVkXG5cdFx0XHRcdC8qaWYoIEFwcC5DaGFydE1vZGVsLmdldCggXCJhZGQtY291bnRyeS1tb2RlXCIgKSA9PT0gXCJjaGFuZ2UtY291bnRyeVwiICkge1xuXHRcdFx0XHRcdGlmKCBlbnRpdHlMYWJlbC5lbXB0eSgpICkge1xuXHRcdFx0XHRcdFx0ZW50aXR5TGFiZWwgPSB3cmFwLmFwcGVuZCggJ2cnICkuYXR0cignY2xhc3MnLCAnbnYtZW50aXR5LWxhYmVsJykuYXR0ciggJ3RyYW5zZm9ybScsICd0cmFuc2xhdGUoMCwxNSknICk7XG5cdFx0XHRcdFx0XHRlbnRpdHlMYWJlbFRleHQgPSBlbnRpdHlMYWJlbC5hcHBlbmQoICd0ZXh0JyApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiggZGF0YSAmJiBkYXRhWzBdICYmIGRhdGFbMF0uZW50aXR5ICkge1xuXHRcdFx0XHRcdFx0ZW50aXR5TGFiZWxUZXh0LnRleHQoIGRhdGFbMF0uZW50aXR5ICsgXCI6IFwiICk7XG5cdFx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0XHRlbnRpdHlMYWJlbFdpZHRoID0gZW50aXR5TGFiZWxUZXh0Lm5vZGUoKS5nZXRDb21wdXRlZFRleHRMZW5ndGgoKTtcblx0XHRcdFx0XHRcdFx0Ly8gSWYgdGhlIGxlZ2VuZFRleHQgaXMgZGlzcGxheTpub25lJ2QgKG5vZGVUZXh0TGVuZ3RoID09IDApLCBzaW11bGF0ZSBhbiBlcnJvciBzbyB3ZSBhcHByb3hpbWF0ZSwgaW5zdGVhZFxuXHRcdFx0XHRcdFx0XHRpZiggZW50aXR5TGFiZWxXaWR0aCA8PSAwICkgdGhyb3cgbmV3IEVycm9yKCk7XG5cdFx0XHRcdFx0XHR9IGNhdGNoKCBlICkge1xuXHRcdFx0XHRcdFx0XHRlbnRpdHlMYWJlbFdpZHRoID0gbnYudXRpbHMuY2FsY0FwcHJveFRleHRXaWR0aChlbnRpdHlMYWJlbFRleHQpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Ly9hZGQgcGFkZGluZyBmb3IgbGFiZWxcblx0XHRcdFx0XHRcdGVudGl0eUxhYmVsV2lkdGggKz0gMzA7XG5cdFx0XHRcdFx0XHRhdmFpbGFibGVXaWR0aCAtPSBlbnRpdHlMYWJlbFdpZHRoO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvL21ha2Ugc3VyZSB0aGVyZSBpcyBub3QgbGFiZWwgbGVmdFxuXHRcdFx0XHRcdGVudGl0eUxhYmVsLnJlbW92ZSgpO1xuXHRcdFx0XHR9Ki9cblx0XHRcdFx0XG5cdFx0XHRcdC8vaWYgbm90IGV4aXN0aW5nLCBhZGQgbnYtYWRkLWJ0biwgaWYgbm90IGdyb3VwaW5nIGJ5IHZhcmlhYmxlc1xuXHRcdFx0XHR2YXIgYWRkRW50aXR5QnRuID0gIHdyYXAuc2VsZWN0KCAnZy5udi1hZGQtYnRuJyApO1xuXHRcdFx0XHRpZiggYWRkRW50aXR5QnRuLmVtcHR5KCkgKSB7XG5cdFx0XHRcdFx0YWRkRW50aXR5QnRuID0gd3JhcC5hcHBlbmQoJ2cnKS5hdHRyKCdjbGFzcycsICdudi1hZGQtYnRuJyk7XG5cdFx0XHRcdFx0YWRkRW50aXR5QnRuLmFwcGVuZCgncmVjdCcpLmF0dHIoIHsgJ2NsYXNzJzogJ2FkZC1idG4tYmcnLCAnd2lkdGgnOiAnMTAwJywgJ2hlaWdodCc6ICcyNScsICd0cmFuc2Zvcm0nOiAndHJhbnNsYXRlKDAsLTUpJyB9ICk7XG5cdFx0XHRcdFx0dmFyIGFkZEVudGl0eUJ0bkcgPSBhZGRFbnRpdHlCdG4uYXBwZW5kKCdnJykuYXR0ciggeyAnY2xhc3MnOiAnYWRkLWJ0bi1wYXRoJyB9ICk7XG5cdFx0XHRcdFx0YWRkRW50aXR5QnRuRy5hcHBlbmQoJ3BhdGgnKS5hdHRyKCB7ICdkJzogJ00xNSwwIEwxNSwxNCcsICdjbGFzcyc6ICdudi1ib3gnIH0gKTtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG5HLmFwcGVuZCgncGF0aCcpLmF0dHIoIHsgJ2QnOiAnTTgsNyBMMjIsNycsICdjbGFzcyc6ICdudi1ib3gnIH0gKTtcblx0XHRcdFx0XHQvL2h0dHA6Ly9hbmRyb2lkLXVpLXV0aWxzLmdvb2dsZWNvZGUuY29tL2hnLWhpc3RvcnkvYWM5NTVlNjM3NjQ3MGQ5NTk5ZWFkMDdiNDU5OWVmOTM3ODI0ZjkxOS9hc3NldC1zdHVkaW8vZGlzdC9yZXMvY2xpcGFydC9pY29ucy9yZWZyZXNoLnN2Zz9yPWFjOTU1ZTYzNzY0NzBkOTU5OWVhZDA3YjQ1OTllZjkzNzgyNGY5MTlcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4uYXBwZW5kKCdwYXRoJykuYXR0ciggeyAnZCc6ICdNMTYwLjQ2OSwyNDIuMTk0YzAtNDQuNDE0LDM2LjAyMy04MC40MzgsODAuNDM4LTgwLjQzOGMxOS4xODgsMCwzNi43MTEsNi44NDQsNTAuNSwxOC4wNzhMMjU5Ljc4LDIwOS45M2w5OS45NDUsMTEuMzY3ICAgIGwwLjgwNS0xMDcuMjQybC0zMC43NjYsMjkuMjg5Yy0yMy41NDYtMjEuMjAzLTU0LjYyNC0zNC4xNjQtODguODA0LTM0LjE2NGMtNzMuNDY5LDAtMTMzLjAyMyw1OS41NjItMTMzLjAyMywxMzMuMDE2ICAgIGMwLDIuNzQyLDAuMjQyLTIuMjY2LDAuNDE0LDAuNDQ1bDUzLjY4LDcuNTU1QzE2MS4wMywyNDUuMTA4LDE2MC40NjksMjQ3LjU2MiwxNjAuNDY5LDI0Mi4xOTR6IE0zNzEuNjQ3LDIzNy4zNzVsLTUzLjY4MS03LjU1NSAgICBjMS4wMTcsNS4wODYsMS41NTYsMi42MTcsMS41NTYsNy45OTJjMCw0NC40MTQtMzYuMDA4LDgwLjQzMS04MC40Myw4MC40MzFjLTE5LjEzMywwLTM2LjYwMi02Ljc5OC01MC4zODMtMTcuOTdsMzEuNTk1LTMwLjA3OCAgICBsLTk5LjkzLTExLjM2NmwtMC44MTIsMTA3LjI1bDMwLjc4OS0yOS4zMTJjMjMuNTMxLDIxLjE0MSw1NC41NywzNC4wNTUsODguNjg4LDM0LjA1NWM3My40NjgsMCwxMzMuMDIzLTU5LjU1NSwxMzMuMDIzLTEzMy4wMDggICAgQzM3Mi4wNjIsMjM1LjA3OCwzNzEuODEyLDI0MC4wODUsMzcxLjY0NywyMzcuMzc1eicsICdjbGFzcyc6ICdudi1ib3ggY2hhbmdlLWJ0bi1wYXRoJywgJ3RyYW5zZm9ybSc6ICdzY2FsZSguMDQpIHRyYW5zbGF0ZSgxNTAsLTUwKScgfSApO1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5hcHBlbmQoJ3RleHQnKS5hdHRyKCB7J3gnOjI4LCd5JzoxMX0gKS50ZXh0KCdBZGQgY291bnRyeScpO1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5vbiggJ2NsaWNrJywgZnVuY3Rpb24oIGQsIGkgKSB7XG5cdFx0XHRcdFx0XHQvL2dyb3VwIGJ5IHZhcmlhYmxlc1xuXHRcdFx0XHRcdFx0ZGlzcGF0Y2guYWRkRW50aXR5KCk7XG5cdFx0XHRcdFx0XHRkMy5ldmVudC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Ly9iYXNlZCBvbiBzZWxlY3RlZCBjb3VudHJpZXMgc2VsZWN0aW9uIGhpZGUgb3Igc2hvdyBhZGRFbnRpdHlCdG5cblx0XHRcdFx0aWYoIF8uaXNFbXB0eSggQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcInNlbGVjdGVkLWNvdW50cmllc1wiICkgKSApIHtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4uYXR0ciggXCJkaXNwbGF5XCIsIFwibm9uZVwiICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YWRkRW50aXR5QnRuLmF0dHIoIFwiZGlzcGxheVwiLCBcImJsb2NrXCIgKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHZhciBhZGRDb3VudHJ5TW9kZSA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJhZGQtY291bnRyeS1tb2RlXCIgKTtcblx0XHRcdFx0aWYoIGFkZENvdW50cnlNb2RlID09PSBcImFkZC1jb3VudHJ5XCIgKSB7XG5cdFx0XHRcdC8vaWYoIEFwcC5DaGFydE1vZGVsLmdldCggXCJncm91cC1ieS12YXJpYWJsZXNcIiApICkge1xuXHRcdFx0XHRcdC8vaWYgZ3JvdXBpbmcgYnkgdmFyaWFibGUsIGxlZ2VuZCB3aWxsIHNob3cgdmFyaWFibGVzIGluc3RlYWQgb2YgY291bnRyaWVzLCBzbyBhZGQgY291bnRyeSBidG4gZG9lc24ndCBtYWtlIHNlbnNlXG5cdFx0XHRcdFx0Ly9pZiBlbmFibGluZyBhZGRpbmcgY291bnRyaWVzXG5cdFx0XHRcdFx0Ly9hZGRFbnRpdHlCdG4uYXR0ciggXCJkaXNwbGF5XCIsIFwibm9uZVwiICk7XG5cdFx0XHRcdFx0YWRkRW50aXR5QnRuLnNlbGVjdCggXCJ0ZXh0XCIgKS50ZXh0KCBcIkFkZCBjb3VudHJ5XCIgKTtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4uc2VsZWN0KCBcInJlY3RcIiApLmF0dHIoIFwid2lkdGhcIiwgXCIxMDBcIiApO1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5zZWxlY3QoIFwiLmFkZC1idG4tcGF0aFwiICkuYXR0ciggXCJkaXNwbGF5XCIsIFwiYmxvY2tcIiApO1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5zZWxlY3QoIFwiLmNoYW5nZS1idG4tcGF0aFwiICkuYXR0ciggXCJkaXNwbGF5XCIsIFwibm9uZVwiICk7XG5cdFx0XHRcdFx0YWRkRW50aXR5QnRuLmF0dHIoIFwiZGlzcGxheVwiLCBcImJsb2NrXCIgKTtcblx0XHRcdFx0fSBlbHNlIGlmKCBhZGRDb3VudHJ5TW9kZSA9PT0gXCJjaGFuZ2UtY291bnRyeVwiICkge1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5zZWxlY3QoIFwiLmFkZC1idG4tcGF0aFwiICkuYXR0ciggXCJkaXNwbGF5XCIsIFwibm9uZVwiICk7XG5cdFx0XHRcdFx0YWRkRW50aXR5QnRuLnNlbGVjdCggXCIuY2hhbmdlLWJ0bi1wYXRoXCIgKS5hdHRyKCBcImRpc3BsYXlcIiwgXCJibG9ja1wiICk7XG5cdFx0XHRcdFx0YWRkRW50aXR5QnRuLnNlbGVjdCggXCJ0ZXh0XCIgKS50ZXh0KCBcIkNoYW5nZSBjb3VudHJ5XCIgKTtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4uc2VsZWN0KCBcInJlY3RcIiApLmF0dHIoIFwid2lkdGhcIiwgXCIxMjBcIiApO1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5hdHRyKCBcImRpc3BsYXlcIiwgXCJibG9ja1wiICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YWRkRW50aXR5QnRuLmF0dHIoIFwiZGlzcGxheVwiLCBcIm5vbmVcIiApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdFx0XG5cdFx0XHRcdHZhciBzZXJpZXNFbnRlciA9IHNlcmllcy5lbnRlcigpLmFwcGVuZCgnZycpLmF0dHIoJ2NsYXNzJywgJ252LXNlcmllcycpLFxuXHRcdFx0XHRcdHNlcmllc1NoYXBlLCBzZXJpZXNSZW1vdmU7XG5cblx0XHRcdFx0dmFyIHZlcnNQYWRkaW5nID0gMzA7XG5cdFx0XHRcdHNlcmllc0VudGVyLmFwcGVuZCgncmVjdCcpXG5cdFx0XHRcdFx0LnN0eWxlKCdzdHJva2Utd2lkdGgnLCAyKVxuXHRcdFx0XHRcdC5hdHRyKCdjbGFzcycsJ252LWxlZ2VuZC1zeW1ib2wnKTtcblxuXHRcdFx0XHQvL2VuYWJsZSByZW1vdmluZyBjb3VudHJpZXMgb25seSBpZiBBZGQvUmVwbGFjZSBjb3VudHJ5IGJ1dHRvbiBwcmVzZW50XG5cdFx0XHRcdGlmKCBhZGRDb3VudHJ5TW9kZSA9PSBcImFkZC1jb3VudHJ5XCIgJiYgIUFwcC5DaGFydE1vZGVsLmdldCggXCJncm91cC1ieS12YXJpYWJsZXNcIiApICkge1xuXHRcdFx0XHRcdHZhciByZW1vdmVCdG5zID0gc2VyaWVzRW50ZXIuYXBwZW5kKCdnJylcblx0XHRcdFx0XHRcdC5hdHRyKCdjbGFzcycsICdudi1yZW1vdmUtYnRuJylcblx0XHRcdFx0XHRcdC5hdHRyKCd0cmFuc2Zvcm0nLCAndHJhbnNsYXRlKDEwLDEwKScpO1xuXHRcdFx0XHRcdHJlbW92ZUJ0bnMuYXBwZW5kKCdwYXRoJykuYXR0ciggeyAnZCc6ICdNMCwwIEw3LDcnLCAnY2xhc3MnOiAnbnYtYm94JyB9ICk7XG5cdFx0XHRcdFx0cmVtb3ZlQnRucy5hcHBlbmQoJ3BhdGgnKS5hdHRyKCB7ICdkJzogJ003LDAgTDAsNycsICdjbGFzcyc6ICdudi1ib3gnIH0gKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0c2VyaWVzU2hhcGUgPSBzZXJpZXMuc2VsZWN0KCcubnYtbGVnZW5kLXN5bWJvbCcpO1xuXHRcdFx0XHRcblx0XHRcdFx0c2VyaWVzRW50ZXIuYXBwZW5kKCd0ZXh0Jylcblx0XHRcdFx0XHQuYXR0cigndGV4dC1hbmNob3InLCAnc3RhcnQnKVxuXHRcdFx0XHRcdC5hdHRyKCdjbGFzcycsJ252LWxlZ2VuZC10ZXh0Jylcblx0XHRcdFx0XHQuYXR0cignZHknLCAnLjMyZW0nKVxuXHRcdFx0XHRcdC5hdHRyKCdkeCcsICcwJyk7XG5cblx0XHRcdFx0dmFyIHNlcmllc1RleHQgPSBzZXJpZXMuc2VsZWN0KCd0ZXh0Lm52LWxlZ2VuZC10ZXh0JyksXG5cdFx0XHRcdFx0c2VyaWVzUmVtb3ZlID0gc2VyaWVzLnNlbGVjdCgnLm52LXJlbW92ZS1idG4nKTtcblxuXHRcdFx0XHRzZXJpZXNcblx0XHRcdFx0XHQub24oJ21vdXNlb3ZlcicsIGZ1bmN0aW9uKGQsaSkge1xuXHRcdFx0XHRcdFx0Y2hhcnRMZWdlbmQuZGlzcGF0Y2gubGVnZW5kTW91c2VvdmVyKGQsaSk7ICAvL1RPRE86IE1ha2UgY29uc2lzdGVudCB3aXRoIG90aGVyIGV2ZW50IG9iamVjdHNcblx0XHRcdFx0XHR9KVxuXHRcdFx0XHRcdC5vbignbW91c2VvdXQnLCBmdW5jdGlvbihkLGkpIHtcblx0XHRcdFx0XHRcdGNoYXJ0TGVnZW5kLmRpc3BhdGNoLmxlZ2VuZE1vdXNlb3V0KGQsaSk7XG5cdFx0XHRcdFx0fSlcblx0XHRcdFx0XHQub24oJ2NsaWNrJywgZnVuY3Rpb24oZCxpKSB7XG5cblx0XHRcdFx0XHRcdGlmKCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiZ3JvdXAtYnktdmFyaWFibGVzXCIgKSB8fCBhZGRDb3VudHJ5TW9kZSAhPT0gXCJhZGQtY291bnRyeVwiICkge1xuXHRcdFx0XHRcdFx0XHQvL2lmIGRpc3BsYXlpbmcgdmFyaWFibGVzLCBpbnN0ZWFkIG9mIHJlbW92aW5nLCB1c2Ugb3JpZ2luYWwgdmVyc2lvbiBqdXN0IHRvIHR1cm4gc3R1ZmYgb2ZmXG5cdFx0XHRcdFx0XHRcdC8vb3JpZ2luYWwgdmVyc2lvbiwgd2hlbiBjbGlja2luZyBjb3VudHJ5IGxhYmVsIGp1c3QgZGVhY3RpdmF0ZXMgaXRcblx0XHRcdFx0XHRcdFx0Y2hhcnRMZWdlbmQuZGlzcGF0Y2gubGVnZW5kQ2xpY2soZCxpKTtcblx0XHRcdFx0XHRcdFx0Ly8gbWFrZSBzdXJlIHdlIHJlLWdldCBkYXRhIGluIGNhc2UgaXQgd2FzIG1vZGlmaWVkXG5cdFx0XHRcdFx0XHRcdHZhciBkYXRhID0gc2VyaWVzLmRhdGEoKTtcblx0XHRcdFx0XHRcdFx0aWYgKHVwZGF0ZVN0YXRlKSB7XG5cdFx0XHRcdFx0XHRcdFx0aWYoZXhwYW5kZWQpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGQuZGlzZW5nYWdlZCA9ICFkLmRpc2VuZ2FnZWQ7XG5cdFx0XHRcdFx0XHRcdFx0XHRkLnVzZXJEaXNhYmxlZCA9IGQudXNlckRpc2FibGVkID09IHVuZGVmaW5lZCA/ICEhZC5kaXNhYmxlZCA6IGQudXNlckRpc2FibGVkO1xuXHRcdFx0XHRcdFx0XHRcdFx0ZC5kaXNhYmxlZCA9IGQuZGlzZW5nYWdlZCB8fCBkLnVzZXJEaXNhYmxlZDtcblx0XHRcdFx0XHRcdFx0XHR9IGVsc2UgaWYgKCFleHBhbmRlZCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0ZC5kaXNhYmxlZCA9ICFkLmRpc2FibGVkO1xuXHRcdFx0XHRcdFx0XHRcdFx0ZC51c2VyRGlzYWJsZWQgPSBkLmRpc2FibGVkO1xuXHRcdFx0XHRcdFx0XHRcdFx0dmFyIGVuZ2FnZWQgPSBkYXRhLmZpbHRlcihmdW5jdGlvbihkKSB7IHJldHVybiAhZC5kaXNlbmdhZ2VkOyB9KTtcblx0XHRcdFx0XHRcdFx0XHRcdGlmIChlbmdhZ2VkLmV2ZXJ5KGZ1bmN0aW9uKHNlcmllcykgeyByZXR1cm4gc2VyaWVzLnVzZXJEaXNhYmxlZCB9KSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHQvL3RoZSBkZWZhdWx0IGJlaGF2aW9yIG9mIE5WRDMgbGVnZW5kcyBpcywgaWYgZXZlcnkgc2luZ2xlIHNlcmllc1xuXHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBpcyBkaXNhYmxlZCwgdHVybiBhbGwgc2VyaWVzJyBiYWNrIG9uLlxuXHRcdFx0XHRcdFx0XHRcdFx0XHRkYXRhLmZvckVhY2goZnVuY3Rpb24oc2VyaWVzKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0c2VyaWVzLmRpc2FibGVkID0gc2VyaWVzLnVzZXJEaXNhYmxlZCA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0Y2hhcnRMZWdlbmQuZGlzcGF0Y2guc3RhdGVDaGFuZ2Uoe1xuXHRcdFx0XHRcdFx0XHRcdFx0ZGlzYWJsZWQ6IGRhdGEubWFwKGZ1bmN0aW9uKGQpIHsgcmV0dXJuICEhZC5kaXNhYmxlZDsgfSksXG5cdFx0XHRcdFx0XHRcdFx0XHRkaXNlbmdhZ2VkOiBkYXRhLm1hcChmdW5jdGlvbihkKSB7IHJldHVybiAhIWQuZGlzZW5nYWdlZDsgfSlcblx0XHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXG5cdFx0XHRcdFx0XHRcdC8vd2hlbiBjbGlja2luZyBjb3VudHJ5IGxhYmVsLCByZW1vdmUgdGhlIGNvdW50cnlcblx0XHRcdFx0XHRcdFx0ZDMuZXZlbnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG5cdFx0XHRcdFx0XHRcdC8vcmVtb3ZlIHNlcmllcyBzdHJhaWdodCBhd2F5LCBzbyB3ZSBkb24ndCBoYXZlIHRvIHdhaXQgZm9yIHJlc3BvbnNlIGZyb20gc2VydmVyXG5cdFx0XHRcdFx0XHRcdHNlcmllc1swXVtpXS5yZW1vdmUoKTtcblx0XHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHRcdHZhciBpZCA9IGQuaWQ7XG5cdFx0XHRcdFx0XHRcdC8vaW4gY2FzZSBvZiBtdWx0aXZhcmllbnQgY2hhcnRcblx0XHRcdFx0XHRcdFx0aWYoIGlkLmluZGV4T2YoIFwiLVwiICkgPiAwICkge1xuXHRcdFx0XHRcdFx0XHRcdGlkID0gcGFyc2VJbnQoIGlkLnNwbGl0KCBcIi1cIiApWyAwIF0sIDEwICk7XG5cdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0aWQgPSBwYXJzZUludCggaWQsIDEwICk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0ZGlzcGF0Y2gucmVtb3ZlRW50aXR5KCBpZCApO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0Lm9uKCdkYmxjbGljaycsIGZ1bmN0aW9uKGQsaSkge1xuXHRcdFx0XHRcdFx0aWYoKHZlcnMgPT0gJ2Z1cmlvdXMnIHx8IHZlcnMgPT0gJ293ZCcpICYmIGV4cGFuZGVkKSByZXR1cm47XG5cdFx0XHRcdFx0XHRjaGFydExlZ2VuZC5kaXNwYXRjaC5sZWdlbmREYmxjbGljayhkLGkpO1xuXHRcdFx0XHRcdFx0aWYgKHVwZGF0ZVN0YXRlKSB7XG5cdFx0XHRcdFx0XHRcdC8vIG1ha2Ugc3VyZSB3ZSByZS1nZXQgZGF0YSBpbiBjYXNlIGl0IHdhcyBtb2RpZmllZFxuXHRcdFx0XHRcdFx0XHR2YXIgZGF0YSA9IHNlcmllcy5kYXRhKCk7XG5cdFx0XHRcdFx0XHRcdC8vdGhlIGRlZmF1bHQgYmVoYXZpb3Igb2YgTlZEMyBsZWdlbmRzLCB3aGVuIGRvdWJsZSBjbGlja2luZyBvbmUsXG5cdFx0XHRcdFx0XHRcdC8vIGlzIHRvIHNldCBhbGwgb3RoZXIgc2VyaWVzJyB0byBmYWxzZSwgYW5kIG1ha2UgdGhlIGRvdWJsZSBjbGlja2VkIHNlcmllcyBlbmFibGVkLlxuXHRcdFx0XHRcdFx0XHRkYXRhLmZvckVhY2goZnVuY3Rpb24oc2VyaWVzKSB7XG5cdFx0XHRcdFx0XHRcdFx0c2VyaWVzLmRpc2FibGVkID0gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0XHRpZih2ZXJzID09ICdmdXJpb3VzJyB8fCB2ZXJzID09ICdvd2QnKSBzZXJpZXMudXNlckRpc2FibGVkID0gc2VyaWVzLmRpc2FibGVkO1xuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdFx0ZC5kaXNhYmxlZCA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0XHRpZih2ZXJzID09ICdmdXJpb3VzJyB8fCB2ZXJzID09ICdvd2QnICkgZC51c2VyRGlzYWJsZWQgPSBkLmRpc2FibGVkO1xuXHRcdFx0XHRcdFx0XHRjaGFydExlZ2VuZC5kaXNwYXRjaC5zdGF0ZUNoYW5nZSh7XG5cdFx0XHRcdFx0XHRcdFx0ZGlzYWJsZWQ6IGRhdGEubWFwKGZ1bmN0aW9uKGQpIHsgcmV0dXJuICEhZC5kaXNhYmxlZDsgfSlcblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0c2VyaWVzUmVtb3ZlLm9uKCAnY2xpY2snLCBmdW5jdGlvbiggZCwgaSApIHtcblxuXHRcdFx0XHRcdGQzLmV2ZW50LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHRcdC8vcmVtb3ZlIHNlcmllcyBzdHJhaWdodCBhd2F5LCBzbyB3ZSBkb24ndCBoYXZlIHRvIHdhaXQgZm9yIHJlc3BvbnNlIGZyb20gc2VydmVyXG5cdFx0XHRcdFx0c2VyaWVzWzBdW2ldLnJlbW92ZSgpO1xuXHRcdFx0XHRcdGRpc3BhdGNoLnJlbW92ZUVudGl0eSggZC5pZCApO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHR9ICk7XHRcblxuXHRcdFx0XHRzZXJpZXMuY2xhc3NlZCgnbnYtZGlzYWJsZWQnLCBmdW5jdGlvbihkKSB7IHJldHVybiBkLnVzZXJEaXNhYmxlZDsgfSk7XG5cdFx0XHRcdHNlcmllcy5leGl0KCkucmVtb3ZlKCk7XG5cblx0XHRcdFx0c2VyaWVzVGV4dFxuXHRcdFx0XHRcdC5hdHRyKCdmaWxsJywgc2V0VGV4dENvbG9yKVxuXHRcdFx0XHRcdC50ZXh0KGdldEtleSk7XG5cblx0XHRcdFx0Ly9UT0RPOiBpbXBsZW1lbnQgZml4ZWQtd2lkdGggYW5kIG1heC13aWR0aCBvcHRpb25zIChtYXgtd2lkdGggaXMgZXNwZWNpYWxseSB1c2VmdWwgd2l0aCB0aGUgYWxpZ24gb3B0aW9uKVxuXHRcdFx0XHQvLyBORVcgQUxJR05JTkcgQ09ERSwgVE9ETzogY2xlYW4gdXBcblx0XHRcdFx0dmFyIGxlZ2VuZFdpZHRoID0gMCxcblx0XHRcdFx0XHR0cmFuc2Zvcm1YLCB0cmFuc2Zvcm1ZO1xuXHRcdFx0XHRpZiAoYWxpZ24pIHtcblxuXHRcdFx0XHRcdHZhciBzZXJpZXNXaWR0aHMgPSBbXTtcblx0XHRcdFx0XHRzZXJpZXMuZWFjaCggZnVuY3Rpb24oZCxpKSB7XG5cdFx0XHRcdFx0XHR2YXIgbGVnZW5kVGV4dCA9IGQzLnNlbGVjdCh0aGlzKS5zZWxlY3QoJ3RleHQnKTtcblx0XHRcdFx0XHRcdHZhciBub2RlVGV4dExlbmd0aDtcblx0XHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRcdG5vZGVUZXh0TGVuZ3RoID0gbGVnZW5kVGV4dC5ub2RlKCkuZ2V0Q29tcHV0ZWRUZXh0TGVuZ3RoKCk7XG5cdFx0XHRcdFx0XHRcdC8vIElmIHRoZSBsZWdlbmRUZXh0IGlzIGRpc3BsYXk6bm9uZSdkIChub2RlVGV4dExlbmd0aCA9PSAwKSwgc2ltdWxhdGUgYW4gZXJyb3Igc28gd2UgYXBwcm94aW1hdGUsIGluc3RlYWRcblx0XHRcdFx0XHRcdFx0aWYobm9kZVRleHRMZW5ndGggPD0gMCkgdGhyb3cgRXJyb3IoKTtcblx0XHRcdFx0XHRcdH0gY2F0Y2goIGUgKSB7XG5cdFx0XHRcdFx0XHRcdG5vZGVUZXh0TGVuZ3RoID0gbnYudXRpbHMuY2FsY0FwcHJveFRleHRXaWR0aChsZWdlbmRUZXh0KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHNlcmllc1dpZHRocy5wdXNoKG5vZGVUZXh0TGVuZ3RoICsgcGFkZGluZyk7XG5cdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHR2YXIgc2VyaWVzUGVyUm93ID0gMDtcblx0XHRcdFx0XHR2YXIgY29sdW1uV2lkdGhzID0gW107XG5cdFx0XHRcdFx0bGVnZW5kV2lkdGggPSAwO1xuXG5cdFx0XHRcdFx0d2hpbGUoIGxlZ2VuZFdpZHRoIDwgYXZhaWxhYmxlV2lkdGggJiYgc2VyaWVzUGVyUm93IDwgc2VyaWVzV2lkdGhzLmxlbmd0aCApIHtcblx0XHRcdFx0XHRcdGNvbHVtbldpZHRoc1tzZXJpZXNQZXJSb3ddID0gc2VyaWVzV2lkdGhzW3Nlcmllc1BlclJvd107XG5cdFx0XHRcdFx0XHRsZWdlbmRXaWR0aCArPSBzZXJpZXNXaWR0aHNbc2VyaWVzUGVyUm93KytdO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiggc2VyaWVzUGVyUm93ID09PSAwICkgc2VyaWVzUGVyUm93ID0gMTsgLy9taW5pbXVtIG9mIG9uZSBzZXJpZXMgcGVyIHJvd1xuXG5cdFx0XHRcdFx0d2hpbGUoIGxlZ2VuZFdpZHRoID4gYXZhaWxhYmxlV2lkdGggJiYgc2VyaWVzUGVyUm93ID4gMSApIHtcblx0XHRcdFx0XHRcdGNvbHVtbldpZHRocyA9IFtdO1xuXHRcdFx0XHRcdFx0c2VyaWVzUGVyUm93LS07XG5cblx0XHRcdFx0XHRcdGZvciAodmFyIGsgPSAwOyBrIDwgc2VyaWVzV2lkdGhzLmxlbmd0aDsgaysrKSB7XG5cdFx0XHRcdFx0XHRcdGlmIChzZXJpZXNXaWR0aHNba10gPiAoY29sdW1uV2lkdGhzW2sgJSBzZXJpZXNQZXJSb3ddIHx8IDApIClcblx0XHRcdFx0XHRcdFx0XHRjb2x1bW5XaWR0aHNbayAlIHNlcmllc1BlclJvd10gPSBzZXJpZXNXaWR0aHNba107XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdGxlZ2VuZFdpZHRoID0gY29sdW1uV2lkdGhzLnJlZHVjZShmdW5jdGlvbihwcmV2LCBjdXIsIGluZGV4LCBhcnJheSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gcHJldiArIGN1cjtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHZhciB4UG9zaXRpb25zID0gW107XG5cdFx0XHRcdFx0Zm9yICh2YXIgaSA9IDAsIGN1clggPSAwOyBpIDwgc2VyaWVzUGVyUm93OyBpKyspIHtcblx0XHRcdFx0XHRcdHhQb3NpdGlvbnNbaV0gPSBjdXJYO1xuXHRcdFx0XHRcdFx0Y3VyWCArPSBjb2x1bW5XaWR0aHNbaV07XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0c2VyaWVzXG5cdFx0XHRcdFx0XHQuYXR0cigndHJhbnNmb3JtJywgZnVuY3Rpb24oZCwgaSkge1xuXHRcdFx0XHRcdFx0XHR0cmFuc2Zvcm1YID0geFBvc2l0aW9uc1tpICUgc2VyaWVzUGVyUm93XTtcblx0XHRcdFx0XHRcdFx0dHJhbnNmb3JtWSA9ICg1ICsgTWF0aC5mbG9vcihpIC8gc2VyaWVzUGVyUm93KSAqIHZlcnNQYWRkaW5nKTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuICd0cmFuc2xhdGUoJyArIHRyYW5zZm9ybVggKyAnLCcgKyB0cmFuc2Zvcm1ZICsgJyknO1xuXHRcdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHQvL3Bvc2l0aW9uIGxlZ2VuZCBhcyBmYXIgcmlnaHQgYXMgcG9zc2libGUgd2l0aGluIHRoZSB0b3RhbCB3aWR0aFxuXHRcdFx0XHRcdGlmIChyaWdodEFsaWduKSB7XG5cdFx0XHRcdFx0XHRnLmF0dHIoJ3RyYW5zZm9ybScsICd0cmFuc2xhdGUoJyArICh3aWR0aCAtIG1hcmdpbi5yaWdodCAtIGxlZ2VuZFdpZHRoKSArICcsJyArIG1hcmdpbi50b3AgKyAnKScpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRcdGcuYXR0cigndHJhbnNmb3JtJywgJ3RyYW5zbGF0ZSgnICsgZW50aXR5TGFiZWxXaWR0aCArICcsJyArIG1hcmdpbi50b3AgKyAnKScpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGhlaWdodCA9IG1hcmdpbi50b3AgKyBtYXJnaW4uYm90dG9tICsgKE1hdGguY2VpbChzZXJpZXNXaWR0aHMubGVuZ3RoIC8gc2VyaWVzUGVyUm93KSAqIHZlcnNQYWRkaW5nKTtcblx0XHRcdFx0XHRcblx0XHRcdFx0fSBlbHNlIHtcblxuXHRcdFx0XHRcdHZhciB5cG9zID0gNSxcblx0XHRcdFx0XHRcdG5ld3hwb3MgPSA1LFxuXHRcdFx0XHRcdFx0bWF4d2lkdGggPSAwLFxuXHRcdFx0XHRcdFx0eHBvcztcblx0XHRcdFx0XHRzZXJpZXNcblx0XHRcdFx0XHRcdC5hdHRyKCd0cmFuc2Zvcm0nLCBmdW5jdGlvbihkLCBpKSB7XG5cdFx0XHRcdFx0XHRcdHZhciBsZW5ndGggPSBkMy5zZWxlY3QodGhpcykuc2VsZWN0KCd0ZXh0Jykubm9kZSgpLmdldENvbXB1dGVkVGV4dExlbmd0aCgpICsgcGFkZGluZztcblx0XHRcdFx0XHRcdFx0eHBvcyA9IG5ld3hwb3M7XG5cblx0XHRcdFx0XHRcdFx0aWYgKHdpZHRoIDwgbWFyZ2luLmxlZnQgKyBtYXJnaW4ucmlnaHQgKyB4cG9zICsgbGVuZ3RoKSB7XG5cdFx0XHRcdFx0XHRcdFx0bmV3eHBvcyA9IHhwb3MgPSA1O1xuXHRcdFx0XHRcdFx0XHRcdHlwb3MgKz0gdmVyc1BhZGRpbmc7XG5cdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRuZXd4cG9zICs9IGxlbmd0aDtcblx0XHRcdFx0XHRcdFx0aWYgKG5ld3hwb3MgPiBtYXh3aWR0aCkgbWF4d2lkdGggPSBuZXd4cG9zO1xuXG5cdFx0XHRcdFx0XHRcdGlmKGxlZ2VuZFdpZHRoIDwgeHBvcyArIG1heHdpZHRoKSB7XG5cdFx0XHRcdFx0XHRcdFx0bGVnZW5kV2lkdGggPSB4cG9zICsgbWF4d2lkdGg7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0cmV0dXJuICd0cmFuc2xhdGUoJyArIHhwb3MgKyAnLCcgKyB5cG9zICsgJyknO1xuXHRcdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHQvL3Bvc2l0aW9uIGxlZ2VuZCBhcyBmYXIgcmlnaHQgYXMgcG9zc2libGUgd2l0aGluIHRoZSB0b3RhbCB3aWR0aFxuXHRcdFx0XHRcdGcuYXR0cigndHJhbnNmb3JtJywgJ3RyYW5zbGF0ZSgnICsgKHdpZHRoIC0gbWFyZ2luLnJpZ2h0IC0gbWF4d2lkdGgpICsgJywnICsgbWFyZ2luLnRvcCArICcpJyk7XG5cblx0XHRcdFx0XHRoZWlnaHQgPSBtYXJnaW4udG9wICsgbWFyZ2luLmJvdHRvbSArIHlwb3MgKyAxNTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFNpemUgcmVjdGFuZ2xlcyBhZnRlciB0ZXh0IGlzIHBsYWNlZFxuXHRcdFx0XHRzZXJpZXNTaGFwZVxuXHRcdFx0XHRcdC5hdHRyKCd3aWR0aCcsIGZ1bmN0aW9uKGQsaSkge1xuXHRcdFx0XHRcdFx0Ly9wb3NpdGlvbiByZW1vdmUgYnRuXG5cdFx0XHRcdFx0XHR2YXIgd2lkdGggPSBzZXJpZXNUZXh0WzBdW2ldLmdldENvbXB1dGVkVGV4dExlbmd0aCgpICsgNTtcblx0XHRcdFx0XHRcdGQzLnNlbGVjdCggc2VyaWVzUmVtb3ZlWzBdW2ldICkuYXR0ciggJ3RyYW5zZm9ybScsICd0cmFuc2xhdGUoJyArIHdpZHRoICsgJywtMyknICk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gd2lkdGgrMjU7XG5cdFx0XHRcdFx0fSlcblx0XHRcdFx0XHQuYXR0cignaGVpZ2h0JywgMjQpXG5cdFx0XHRcdFx0LmF0dHIoJ3knLCAtMTIpXG5cdFx0XHRcdFx0LmF0dHIoJ3gnLCAtMTIpO1xuXG5cdFx0XHRcdC8vIFRoZSBiYWNrZ3JvdW5kIGZvciB0aGUgZXhwYW5kZWQgbGVnZW5kIChVSSlcblx0XHRcdFx0Z0VudGVyLmluc2VydCgncmVjdCcsJzpmaXJzdC1jaGlsZCcpXG5cdFx0XHRcdFx0LmF0dHIoJ2NsYXNzJywgJ252LWxlZ2VuZC1iZycpXG5cdFx0XHRcdFx0LmF0dHIoJ2ZpbGwnLCAnI2VlZScpXG5cdFx0XHRcdFx0Ly8gLmF0dHIoJ3N0cm9rZScsICcjNDQ0Jylcblx0XHRcdFx0XHQuYXR0cignb3BhY2l0eScsMCk7XG5cblx0XHRcdFx0dmFyIHNlcmllc0JHID0gZy5zZWxlY3QoJy5udi1sZWdlbmQtYmcnKTtcblxuXHRcdFx0XHRzZXJpZXNCR1xuXHRcdFx0XHQudHJhbnNpdGlvbigpLmR1cmF0aW9uKDMwMClcblx0XHRcdFx0XHQuYXR0cigneCcsIC12ZXJzUGFkZGluZyApXG5cdFx0XHRcdFx0LmF0dHIoJ3dpZHRoJywgbGVnZW5kV2lkdGggKyB2ZXJzUGFkZGluZyAtIDEyKVxuXHRcdFx0XHRcdC5hdHRyKCdoZWlnaHQnLCBoZWlnaHQgKVxuXHRcdFx0XHRcdC5hdHRyKCd5JywgLW1hcmdpbi50b3AgLSAxMClcblx0XHRcdFx0XHQuYXR0cignb3BhY2l0eScsIGV4cGFuZGVkID8gMSA6IDApO1xuXG5cdFx0XHRcdHNlcmllc1NoYXBlXG5cdFx0XHRcdFx0LnN0eWxlKCdmaWxsJywgc2V0QkdDb2xvcilcblx0XHRcdFx0XHQuc3R5bGUoJ2ZpbGwtb3BhY2l0eScsIHNldEJHT3BhY2l0eSlcblx0XHRcdFx0XHQuc3R5bGUoJ3N0cm9rZScsIHNldEJHQ29sb3IpO1xuXG5cdFx0XHRcdC8vcG9zaXRpb24gYWRkIGJ0blxuXHRcdFx0XHRpZiggc2VyaWVzLnNpemUoKSApIHtcblxuXHRcdFx0XHRcdHZhciBzZXJpZXNBcnIgPSBzZXJpZXNbMF07XG5cdFx0XHRcdFx0aWYoIHNlcmllc0FyciAmJiBzZXJpZXNBcnIubGVuZ3RoICkge1xuXHRcdFx0XHRcdFx0Ly9mZXRjaCBsYXN0IGVsZW1lbnQgdG8ga25vdyBpdHMgd2lkdGhcblx0XHRcdFx0XHRcdHZhciBsYXN0RWwgPSBzZXJpZXNBcnJbIHNlcmllc0Fyci5sZW5ndGgtMSBdLFxuXHRcdFx0XHRcdFx0XHQvL25lZWQgcmVjdCBpbnNpZGUgZWxlbWVudCB0aGF0IGhhcyBzZXQgd2lkdGhcblx0XHRcdFx0XHRcdFx0bGFzdFJlY3QgPSBkMy5zZWxlY3QoIGxhc3RFbCApLnNlbGVjdCggXCJyZWN0XCIgKSxcblx0XHRcdFx0XHRcdFx0bGFzdFJlY3RXaWR0aCA9IGxhc3RSZWN0LmF0dHIoIFwid2lkdGhcIiApO1xuXHRcdFx0XHRcdFx0Ly9wb3NpdGlvbiBhZGQgYnRuXG5cdFx0XHRcdFx0XHR0cmFuc2Zvcm1YID0gK3RyYW5zZm9ybVggKyBwYXJzZUludCggbGFzdFJlY3RXaWR0aCwgMTAgKSAtIDM7XG5cdFx0XHRcdFx0XHR0cmFuc2Zvcm1YICs9IGVudGl0eUxhYmVsV2lkdGg7XG5cdFx0XHRcdFx0XHQvL2NlbnRlcmluZ1xuXHRcdFx0XHRcdFx0dHJhbnNmb3JtWSA9ICt0cmFuc2Zvcm1ZIC0gMztcblx0XHRcdFx0XHRcdC8vY2hlY2sgZm9yIHJpZ2h0IGVkZ2Vcblx0XHRcdFx0XHRcdHZhciBidXR0b25XaWR0aCA9IDEyMCwgYnV0dG9uSGVpZ2h0ID0gMzU7XG5cdFx0XHRcdFx0XHRpZiggKCB0cmFuc2Zvcm1YICsgYnV0dG9uV2lkdGggKSA+IGF2YWlsYWJsZVdpZHRoICkge1xuXHRcdFx0XHRcdFx0XHQvL21ha2Ugc3VyZSB3ZSBoYXZlIGJ1dHRvblxuXHRcdFx0XHRcdFx0XHR2YXIgYWRkRW50aXR5RGlzcGxheSA9IGFkZEVudGl0eUJ0bi5hdHRyKCBcImRpc3BsYXlcIiApO1xuXHRcdFx0XHRcdFx0XHRpZiggYWRkRW50aXR5RGlzcGxheSAhPT0gXCJub25lXCIgKSB7XG5cdFx0XHRcdFx0XHRcdFx0dHJhbnNmb3JtWCA9IDA7Ly9hdmFpbGFibGVXaWR0aCAtIGJ1dHRvbldpZHRoO1xuXHRcdFx0XHRcdFx0XHRcdHRyYW5zZm9ybVkgKz0gYnV0dG9uSGVpZ2h0O1xuXHRcdFx0XHRcdFx0XHRcdC8vdXBkYXRlIHdob2xlIGNoYXJ0IGhlaWdodCBhcyB3ZWxsXG5cdFx0XHRcdFx0XHRcdFx0aGVpZ2h0ICs9IGJ1dHRvbkhlaWdodDtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0YWRkRW50aXR5QnRuLmF0dHIoIFwidHJhbnNmb3JtXCIsIFwidHJhbnNsYXRlKCBcIiArIHRyYW5zZm9ybVggKyBcIiwgXCIgKyB0cmFuc2Zvcm1ZICsgXCIpXCIgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcblx0XHRcdFx0fVxuXHRcdFx0XG5cdFx0XHR9KTtcblx0XHRcdFxuXHRcdFx0ZnVuY3Rpb24gc2V0VGV4dENvbG9yKGQsaSkge1xuXHRcdFx0XHRpZih2ZXJzICE9ICdmdXJpb3VzJyAmJiB2ZXJzICE9ICdvd2QnKSByZXR1cm4gJyMwMDAnO1xuXHRcdFx0XHRpZihleHBhbmRlZCkge1xuXHRcdFx0XHRcdHJldHVybiBkLmRpc2VuZ2FnZWQgPyAnIzAwMCcgOiAnI2ZmZic7XG5cdFx0XHRcdH0gZWxzZSBpZiAoIWV4cGFuZGVkKSB7XG5cdFx0XHRcdFx0aWYoIWQuY29sb3IpIGQuY29sb3IgPSBjb2xvcihkLGkpO1xuXHRcdFx0XHRcdHJldHVybiAhIWQuZGlzYWJsZWQgPyAnIzY2NicgOiAnI2ZmZic7XG5cdFx0XHRcdFx0Ly9yZXR1cm4gISFkLmRpc2FibGVkID8gZC5jb2xvciA6ICcjZmZmJztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRmdW5jdGlvbiBzZXRCR0NvbG9yKGQsaSkge1xuXHRcdFx0XHRpZihleHBhbmRlZCAmJiAodmVycyA9PSAnZnVyaW91cycgfHwgdmVycyA9PSAnb3dkJykpIHtcblx0XHRcdFx0XHRyZXR1cm4gZC5kaXNlbmdhZ2VkID8gJyNlZWUnIDogZC5jb2xvciB8fCBjb2xvcihkLGkpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybiBkLmNvbG9yIHx8IGNvbG9yKGQsaSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXG5cdFx0XHRmdW5jdGlvbiBzZXRCR09wYWNpdHkoZCxpKSB7XG5cdFx0XHRcdGlmKGV4cGFuZGVkICYmICh2ZXJzID09ICdmdXJpb3VzJyB8fCB2ZXJzID09ICdvd2QnKSkge1xuXHRcdFx0XHRcdHJldHVybiAxO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybiAhIWQuZGlzYWJsZWQgPyAwIDogMTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gY2hhcnQ7XG5cdFx0fVxuXG5cdFx0Ly89PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblx0XHQvLyBFeHBvc2UgUHVibGljIFZhcmlhYmxlc1xuXHRcdC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cblx0XHRjaGFydC5kaXNwYXRjaCA9IGRpc3BhdGNoO1xuXHRcdGNoYXJ0Lm9wdGlvbnMgPSBudi51dGlscy5vcHRpb25zRnVuYy5iaW5kKGNoYXJ0KTtcblxuXHRcdGNoYXJ0Ll9vcHRpb25zID0gT2JqZWN0LmNyZWF0ZSh7fSwge1xuXHRcdFx0Ly8gc2ltcGxlIG9wdGlvbnMsIGp1c3QgZ2V0L3NldCB0aGUgbmVjZXNzYXJ5IHZhbHVlc1xuXHRcdFx0d2lkdGg6ICAgICAge2dldDogZnVuY3Rpb24oKXtyZXR1cm4gd2lkdGg7fSwgc2V0OiBmdW5jdGlvbihfKXt3aWR0aD1fO319LFxuXHRcdFx0aGVpZ2h0OiAgICAge2dldDogZnVuY3Rpb24oKXtyZXR1cm4gaGVpZ2h0O30sIHNldDogZnVuY3Rpb24oXyl7aGVpZ2h0PV87fX0sXG5cdFx0XHRrZXk6ICAgICAgICB7Z2V0OiBmdW5jdGlvbigpe3JldHVybiBnZXRLZXk7fSwgc2V0OiBmdW5jdGlvbihfKXtnZXRLZXk9Xzt9fSxcblx0XHRcdGFsaWduOiAgICAgIHtnZXQ6IGZ1bmN0aW9uKCl7cmV0dXJuIGFsaWduO30sIHNldDogZnVuY3Rpb24oXyl7YWxpZ249Xzt9fSxcblx0XHRcdHJpZ2h0QWxpZ246ICAgIHtnZXQ6IGZ1bmN0aW9uKCl7cmV0dXJuIHJpZ2h0QWxpZ247fSwgc2V0OiBmdW5jdGlvbihfKXtyaWdodEFsaWduPV87fX0sXG5cdFx0XHRwYWRkaW5nOiAgICAgICB7Z2V0OiBmdW5jdGlvbigpe3JldHVybiBwYWRkaW5nO30sIHNldDogZnVuY3Rpb24oXyl7cGFkZGluZz1fO319LFxuXHRcdFx0dXBkYXRlU3RhdGU6ICAge2dldDogZnVuY3Rpb24oKXtyZXR1cm4gdXBkYXRlU3RhdGU7fSwgc2V0OiBmdW5jdGlvbihfKXt1cGRhdGVTdGF0ZT1fO319LFxuXHRcdFx0cmFkaW9CdXR0b25Nb2RlOiAgICB7Z2V0OiBmdW5jdGlvbigpe3JldHVybiByYWRpb0J1dHRvbk1vZGU7fSwgc2V0OiBmdW5jdGlvbihfKXtyYWRpb0J1dHRvbk1vZGU9Xzt9fSxcblx0XHRcdGV4cGFuZGVkOiAgIHtnZXQ6IGZ1bmN0aW9uKCl7cmV0dXJuIGV4cGFuZGVkO30sIHNldDogZnVuY3Rpb24oXyl7ZXhwYW5kZWQ9Xzt9fSxcblx0XHRcdHZlcnM6ICAge2dldDogZnVuY3Rpb24oKXtyZXR1cm4gdmVyczt9LCBzZXQ6IGZ1bmN0aW9uKF8pe3ZlcnM9Xzt9fSxcblxuXHRcdFx0Ly8gb3B0aW9ucyB0aGF0IHJlcXVpcmUgZXh0cmEgbG9naWMgaW4gdGhlIHNldHRlclxuXHRcdFx0bWFyZ2luOiB7Z2V0OiBmdW5jdGlvbigpe3JldHVybiBtYXJnaW47fSwgc2V0OiBmdW5jdGlvbihfKXtcblx0XHRcdFx0bWFyZ2luLnRvcCAgICA9IF8udG9wICAgICE9PSB1bmRlZmluZWQgPyBfLnRvcCAgICA6IG1hcmdpbi50b3A7XG5cdFx0XHRcdG1hcmdpbi5yaWdodCAgPSBfLnJpZ2h0ICAhPT0gdW5kZWZpbmVkID8gXy5yaWdodCAgOiBtYXJnaW4ucmlnaHQ7XG5cdFx0XHRcdG1hcmdpbi5ib3R0b20gPSBfLmJvdHRvbSAhPT0gdW5kZWZpbmVkID8gXy5ib3R0b20gOiBtYXJnaW4uYm90dG9tO1xuXHRcdFx0XHRtYXJnaW4ubGVmdCAgID0gXy5sZWZ0ICAgIT09IHVuZGVmaW5lZCA/IF8ubGVmdCAgIDogbWFyZ2luLmxlZnQ7XG5cdFx0XHR9fSxcblx0XHRcdGNvbG9yOiAge2dldDogZnVuY3Rpb24oKXtyZXR1cm4gY29sb3I7fSwgc2V0OiBmdW5jdGlvbihfKXtcblx0XHRcdFx0Y29sb3IgPSBudi51dGlscy5nZXRDb2xvcihfKTtcblx0XHRcdH19XG5cdFx0fSk7XG5cblx0XHRudi51dGlscy5pbml0T3B0aW9ucyhjaGFydCk7XG5cblx0XHRyZXR1cm4gY2hhcnQ7XG5cdH07XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVmlld3MuQ2hhcnQuTGVnZW5kO1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIE1hcENvbnRyb2xzID0gcmVxdWlyZSggXCIuL21hcC9BcHAuVmlld3MuQ2hhcnQuTWFwLk1hcENvbnRyb2xzLmpzXCIgKTtcblxuXHRBcHAuVmlld3MuQ2hhcnQuTWFwVGFiID0gQmFja2JvbmUuVmlldy5leHRlbmQoe1xuXG5cdFx0JHRhYjogbnVsbCxcblx0XHRkYXRhTWFwOiBudWxsLFxuXHRcdG1hcENvbnRyb2xzOiBudWxsLFxuXHRcdGxlZ2VuZDogbnVsbCxcblxuXHRcdGV2ZW50czoge30sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdFxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gb3B0aW9ucy5kaXNwYXRjaGVyO1xuXHRcdFx0dGhpcy5tYXBDb250cm9scyA9IG5ldyBNYXBDb250cm9scyggeyBkaXNwYXRjaGVyOiBvcHRpb25zLmRpc3BhdGNoZXIgfSApO1xuXG5cdFx0XHQvL2luaXQgbWFwIG9ubHkgaWYgdGhlIG1hcCB0YWIgZGlzcGxheWVkXG5cdFx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0XHQkKCBcIltkYXRhLXRvZ2dsZT0ndGFiJ11baHJlZj0nI21hcC1jaGFydC10YWInXVwiICkub24oIFwic2hvd24uYnMudGFiXCIsIGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHRcdHRoYXQuZGlzcGxheSgpO1xuXHRcdFx0fSApO1xuXHRcdFx0XG5cdFx0fSxcblxuXHRcdGRpc3BsYXk6IGZ1bmN0aW9uKCkge1xuXHRcdFx0Ly9yZW5kZXIgb25seSBpZiBubyBtYXAgeWV0XG5cdFx0XHRpZiggIXRoaXMuZGF0YU1hcCApIHtcblx0XHRcdFx0dGhpcy5yZW5kZXIoKTtcblx0XHRcdH1cblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblxuXHRcdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdFx0Ly9mZXRjaCBjcmVhdGVkIGRvbVxuXHRcdFx0dGhpcy4kdGFiID0gJCggXCIjbWFwLWNoYXJ0LXRhYlwiICk7XG5cblx0XHRcdHZhciBtYXBDb25maWcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwibWFwLWNvbmZpZ1wiICksXG5cdFx0XHRcdGRlZmF1bHRQcm9qZWN0aW9uID0gdGhpcy5nZXRQcm9qZWN0aW9uKCBtYXBDb25maWcucHJvamVjdGlvbiApO1xuXHRcdFx0XG5cdFx0XHR0aGlzLmRhdGFNYXAgPSBuZXcgRGF0YW1hcCgge1xuXHRcdFx0XHR3aWR0aDogdGhhdC4kdGFiLndpZHRoKCksXG5cdFx0XHRcdGhlaWdodDogdGhhdC4kdGFiLmhlaWdodCgpLFxuXHRcdFx0XHRyZXNwb25zaXZlOiB0cnVlLFxuXHRcdFx0XHRlbGVtZW50OiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggXCJtYXAtY2hhcnQtdGFiXCIgKSxcblx0XHRcdFx0Z2VvZ3JhcGh5Q29uZmlnOiB7XG5cdFx0XHRcdFx0ZGF0YVVybDogR2xvYmFsLnJvb3RVcmwgKyBcIi9qcy9kYXRhL3dvcmxkLmlkcy5qc29uXCIsXG5cdFx0XHRcdFx0Ym9yZGVyV2lkdGg6IDAuMSxcblx0XHRcdFx0XHRib3JkZXJDb2xvcjogJyM0RjRGNEYnLFxuXHRcdFx0XHRcdGhpZ2hsaWdodEJvcmRlckNvbG9yOiAnYmxhY2snLFxuXHRcdFx0XHRcdGhpZ2hsaWdodEJvcmRlcldpZHRoOiAwLjIsXG5cdFx0XHRcdFx0aGlnaGxpZ2h0RmlsbENvbG9yOiAnI0ZGRUMzOCcsXG5cdFx0XHRcdFx0cG9wdXBUZW1wbGF0ZTogdGhhdC5wb3B1cFRlbXBsYXRlR2VuZXJhdG9yXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGZpbGxzOiB7XG5cdFx0XHRcdFx0ZGVmYXVsdEZpbGw6ICcjRkZGRkZGJ1xuXHRcdFx0XHRcdC8vZGVmYXVsdEZpbGw6ICcjREREREREJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRzZXRQcm9qZWN0aW9uOiBkZWZhdWx0UHJvamVjdGlvbixcblx0XHRcdFx0Ly93YWl0IGZvciBqc29uIHRvIGxvYWQgYmVmb3JlIGxvYWRpbmcgbWFwIGRhdGFcblx0XHRcdFx0ZG9uZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0dGhhdC5tYXBEYXRhTW9kZWwgPSBuZXcgQXBwLk1vZGVscy5DaGFydERhdGFNb2RlbCgpO1xuXHRcdFx0XHRcdHRoYXQubWFwRGF0YU1vZGVsLm9uKCBcInN5bmNcIiwgZnVuY3Rpb24oIG1vZGVsLCByZXNwb25zZSApIHtcblx0XHRcdFx0XHRcdGlmKCByZXNwb25zZS5kYXRhICkge1xuXHRcdFx0XHRcdFx0XHR0aGF0LmRpc3BsYXlEYXRhKCByZXNwb25zZS5kYXRhICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdHRoYXQubWFwRGF0YU1vZGVsLm9uKCBcImVycm9yXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0Y29uc29sZS5lcnJvciggXCJFcnJvciBsb2FkaW5nIG1hcCBkYXRhLlwiICk7XG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdHRoYXQudXBkYXRlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblxuXHRcdFx0dGhpcy5sZWdlbmQgPSBuZXcgQXBwLlZpZXdzLkNoYXJ0Lk1hcC5MZWdlbmQoKTtcblx0XHRcdFxuXHRcdFx0QXBwLkNoYXJ0TW9kZWwub24oIFwiY2hhbmdlXCIsIHRoaXMub25DaGFydE1vZGVsQ2hhbmdlLCB0aGlzICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5vbiggXCJjaGFuZ2UtbWFwXCIsIHRoaXMub25DaGFydE1vZGVsQ2hhbmdlLCB0aGlzICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5vbiggXCJyZXNpemVcIiwgdGhpcy5vbkNoYXJ0TW9kZWxSZXNpemUsIHRoaXMgKTtcblx0XHRcdFxuXHRcdFx0bnYudXRpbHMud2luZG93UmVzaXplKCAkLnByb3h5KCB0aGlzLm9uUmVzaXplLCB0aGlzICkgKTtcblx0XHRcdHRoaXMub25SZXNpemUoKTtcblxuXHRcdH0sXG5cblx0XHRvbkNoYXJ0TW9kZWxDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdHRoaXMudXBkYXRlKCk7XG5cblx0XHR9LFxuXG5cdFx0cG9wdXBUZW1wbGF0ZUdlbmVyYXRvcjogZnVuY3Rpb24oIGdlbywgZGF0YSApIHtcblx0XHRcdC8vdHJhbnNmb3JtIGRhdGFtYXBzIGRhdGEgaW50byBmb3JtYXQgY2xvc2UgdG8gbnZkMyBzbyB0aGF0IHdlIGNhbiByZXVzZSB0aGUgc2FtZSBwb3B1cCBnZW5lcmF0b3Jcblx0XHRcdHZhciBtYXBDb25maWcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwibWFwLWNvbmZpZ1wiICk7XG5cdFx0XHR2YXIgcHJvcGVydHlOYW1lID0gQXBwLlV0aWxzLmdldFByb3BlcnR5QnlWYXJpYWJsZUlkKCBBcHAuQ2hhcnRNb2RlbCwgbWFwQ29uZmlnLnZhcmlhYmxlSWQgKTtcblx0XHRcdGlmKCAhcHJvcGVydHlOYW1lICkge1xuXHRcdFx0XHRwcm9wZXJ0eU5hbWUgPSBcInlcIjtcblx0XHRcdH1cblx0XHRcdHZhciBvYmogPSB7XG5cdFx0XHRcdHBvaW50OiB7XG5cdFx0XHRcdFx0dGltZTogbWFwQ29uZmlnLnRhcmdldFllYXIgfSxcblx0XHRcdFx0c2VyaWVzOiBbIHtcblx0XHRcdFx0XHRrZXk6IGdlby5wcm9wZXJ0aWVzLm5hbWVcblx0XHRcdFx0fSBdXG5cdFx0XHR9O1xuXHRcdFx0b2JqLnBvaW50WyBwcm9wZXJ0eU5hbWUgXSA9IGRhdGEudmFsdWU7XG5cdFx0XHRyZXR1cm4gWyBcIjxkaXYgY2xhc3M9J2hvdmVyaW5mbyBudnRvb2x0aXAnPlwiICsgQXBwLlV0aWxzLmNvbnRlbnRHZW5lcmF0b3IoIG9iaiwgdHJ1ZSApICsgXCI8L2Rpdj5cIiBdO1xuXHRcdH0sXG5cblx0XHR1cGRhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XG5cdFx0XHQvL2NvbnN0cnVjdCBkaW1lbnNpb24gc3RyaW5nXG5cdFx0XHR2YXIgdGhhdCA9IHRoaXMsXG5cdFx0XHRcdG1hcENvbmZpZyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJtYXAtY29uZmlnXCIgKSxcblx0XHRcdFx0Y2hhcnRUaW1lID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LXRpbWVcIiApLFxuXHRcdFx0XHR2YXJpYWJsZUlkID0gbWFwQ29uZmlnLnZhcmlhYmxlSWQsXG5cdFx0XHRcdHRhcmdldFllYXIgPSBtYXBDb25maWcudGFyZ2V0WWVhcixcblx0XHRcdFx0bW9kZSA9IG1hcENvbmZpZy5tb2RlLFxuXHRcdFx0XHR0b2xlcmFuY2UgPSBtYXBDb25maWcudGltZVRvbGVyYW5jZSxcblx0XHRcdFx0ZGltZW5zaW9ucyA9IFt7IG5hbWU6IFwiTWFwXCIsIHByb3BlcnR5OiBcIm1hcFwiLCB2YXJpYWJsZUlkOiB2YXJpYWJsZUlkLCB0YXJnZXRZZWFyOiB0YXJnZXRZZWFyLCBtb2RlOiBtb2RlLCB0b2xlcmFuY2U6IHRvbGVyYW5jZSB9XSxcblx0XHRcdFx0ZGltZW5zaW9uc1N0cmluZyA9IEpTT04uc3RyaW5naWZ5KCBkaW1lbnNpb25zICksXG5cdFx0XHRcdGNoYXJ0VHlwZSA9IDk5OTksXG5cdFx0XHRcdHNlbGVjdGVkQ291bnRyaWVzID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcInNlbGVjdGVkLWNvdW50cmllc1wiICksXG5cdFx0XHRcdHNlbGVjdGVkQ291bnRyaWVzSWRzID0gXy5tYXAoIHNlbGVjdGVkQ291bnRyaWVzLCBmdW5jdGlvbiggdiApIHsgcmV0dXJuICh2KT8gK3YuaWQ6IFwiXCI7IH0gKTtcblx0XHRcdFxuXHRcdFx0dmFyIGRhdGFQcm9wcyA9IHsgXCJkaW1lbnNpb25zXCI6IGRpbWVuc2lvbnNTdHJpbmcsIFwiY2hhcnRJZFwiOiBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiaWRcIiApLCBcImNoYXJ0VHlwZVwiOiBjaGFydFR5cGUsIFwic2VsZWN0ZWRDb3VudHJpZXNcIjogc2VsZWN0ZWRDb3VudHJpZXNJZHMsIFwiY2hhcnRUaW1lXCI6IGNoYXJ0VGltZSwgXCJjYWNoZVwiOiBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2FjaGVcIiApLCBcImdyb3VwQnlWYXJpYWJsZXNcIjogQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImdyb3VwLWJ5LXZhcmlhYmxlc1wiICkgIH07XG5cdFx0XHR0aGlzLm1hcERhdGFNb2RlbC5mZXRjaCggeyBkYXRhOiBkYXRhUHJvcHMgfSApO1xuXG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0ZGlzcGxheURhdGE6IGZ1bmN0aW9uKCBkYXRhICkge1xuXHRcdFx0XG5cdFx0XHR2YXIgdGhhdCA9IHRoaXMsXG5cdFx0XHRcdG1hcENvbmZpZyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJtYXAtY29uZmlnXCIgKSxcblx0XHRcdFx0ZGF0YU1pbiA9IEluZmluaXR5LFxuXHRcdFx0XHRkYXRhTWF4ID0gLUluZmluaXR5O1xuXG5cdFx0XHQvL25lZWQgdG8gZXh0cmFjdCBsYXRlc3QgdGltZVxuXHRcdFx0dmFyIGxhdGVzdERhdGEgPSBkYXRhLm1hcCggZnVuY3Rpb24oIGQsIGkgKSB7XG5cblx0XHRcdFx0dmFyIHZhbHVlcyA9IGQudmFsdWVzLFxuXHRcdFx0XHRcdGxhdGVzdFRpbWVWYWx1ZSA9ICggdmFsdWVzICYmIHZhbHVlcy5sZW5ndGggKT8gdmFsdWVzWyB2YWx1ZXMubGVuZ3RoIC0gMV06IDA7XG5cblx0XHRcdFx0Ly9hbHNvIGdldCBtaW4gbWF4IHZhbHVlcywgY291bGQgdXNlIGQzLm1pbiwgZDMubWF4IG9uY2Ugd2UgaGF2ZSBhbGwgdmFsdWVzLCBidXQgdGhpcyBwcm9iYWJseSBzYXZlcyBzb21lIHRpbWVcblx0XHRcdFx0ZGF0YU1pbiA9IE1hdGgubWluKCBkYXRhTWluLCBsYXRlc3RUaW1lVmFsdWUgKTtcblx0XHRcdFx0ZGF0YU1heCA9IE1hdGgubWF4KCBkYXRhTWF4LCBsYXRlc3RUaW1lVmFsdWUgKTtcblxuXHRcdFx0XHQvL2lkcyBpbiB3b3JsZCBqc29uIGFyZSBuYW1lIGNvdW50cmllcyB3aXRoIHVuZGVyc2NvcmUgKGRhdGFtYXBzLmpzIHVzZXMgaWQgZm9yIHNlbGVjdG9yLCBzbyBjYW5ub3QgaGF2ZSB3aGl0ZXNwYWNlKVxuXHRcdFx0XHRyZXR1cm4geyBcImtleVwiOiBkLmtleS5yZXBsYWNlKCBcIiBcIiwgXCJfXCIgKSwgXCJ2YWx1ZVwiOiBsYXRlc3RUaW1lVmFsdWUgfTtcblxuXHRcdFx0fSApO1xuXG5cdFx0XHR2YXIgY29sb3JTY2hlbWUgPSAoIGNvbG9yYnJld2VyWyBtYXBDb25maWcuY29sb3JTY2hlbWVOYW1lIF0gJiYgY29sb3JicmV3ZXJbIG1hcENvbmZpZy5jb2xvclNjaGVtZU5hbWUgXVsgbWFwQ29uZmlnLmNvbG9yU2NoZW1lSW50ZXJ2YWwgXSApPyBjb2xvcmJyZXdlclsgbWFwQ29uZmlnLmNvbG9yU2NoZW1lTmFtZSBdWyBtYXBDb25maWcuY29sb3JTY2hlbWVJbnRlcnZhbCBdOiBbXTtcblx0XHRcdFxuXHRcdFx0Ly9uZWVkIHRvIGNyZWF0ZSBjb2xvciBzY2hlbWVcblx0XHRcdHZhciBjb2xvclNjYWxlID0gZDMuc2NhbGUucXVhbnRpemUoKVxuXHRcdFx0XHQuZG9tYWluKCBbIGRhdGFNaW4sIGRhdGFNYXggXSApXG5cdFx0XHRcdC5yYW5nZSggY29sb3JTY2hlbWUgKTtcblxuXHRcdFx0Ly9uZWVkIHRvIGVuY29kZSBjb2xvcnMgcHJvcGVydGllc1xuXHRcdFx0dmFyIG1hcERhdGEgPSB7fSxcblx0XHRcdFx0Y29sb3JzID0gW107XG5cdFx0XHRsYXRlc3REYXRhLmZvckVhY2goIGZ1bmN0aW9uKCBkLCBpICkge1xuXHRcdFx0XHR2YXIgY29sb3IgPSBjb2xvclNjYWxlKCBkLnZhbHVlICk7XG5cdFx0XHRcdG1hcERhdGFbIGQua2V5IF0gPSB7IFwia2V5XCI6IGQua2V5LCBcInZhbHVlXCI6IGQudmFsdWUsIFwiY29sb3JcIjogY29sb3IgfTtcblx0XHRcdFx0Y29sb3JzLnB1c2goIGNvbG9yICk7XG5cdFx0XHR9ICk7XG5cblx0XHRcdHRoaXMubGVnZW5kLnNjYWxlKCBjb2xvclNjYWxlICk7XG5cdFx0XHRpZiggZDMuc2VsZWN0KCBcIi5sZWdlbmQtd3JhcHBlclwiICkuZW1wdHkoKSApIHtcblx0XHRcdFx0ZDMuc2VsZWN0KCBcIi5kYXRhbWFwXCIgKS5hcHBlbmQoIFwiZ1wiICkuYXR0ciggXCJjbGFzc1wiLCBcImxlZ2VuZC13cmFwcGVyXCIgKTtcblx0XHRcdH1cblx0XHRcdGQzLnNlbGVjdCggXCIubGVnZW5kLXdyYXBwZXJcIiApLmRhdHVtKCBjb2xvclNjaGVtZSApLmNhbGwoIHRoaXMubGVnZW5kICk7XG5cdFx0XHQvL2QzLnNlbGVjdCggXCIuZGF0YW1hcFwiICkuZGF0dW0oIGNvbG9yU2NoZW1lICkuY2FsbCggdGhpcy5sZWdlbmQgKTtcblxuXHRcdFx0Ly91cGRhdGUgbWFwXG5cdFx0XHQvL2FyZSB3ZSBjaGFuZ2luZyBwcm9qZWN0aW9ucz9cblx0XHRcdHZhciBvbGRQcm9qZWN0aW9uID0gdGhpcy5kYXRhTWFwLm9wdGlvbnMuc2V0UHJvamVjdGlvbixcblx0XHRcdFx0bmV3UHJvamVjdGlvbiA9IHRoaXMuZ2V0UHJvamVjdGlvbiggbWFwQ29uZmlnLnByb2plY3Rpb24gKTtcblx0XHRcdGlmKCBvbGRQcm9qZWN0aW9uID09PSBuZXdQcm9qZWN0aW9uICkge1xuXHRcdFx0XHQvL3Byb2plY3Rpb24gc3RheXMgdGhlIHNhbWUsIG5vIG5lZWQgdG8gcmVkcmF3IHVuaXRzXG5cdFx0XHRcdC8vbmVlZCB0byBzZXQgYWxsIHVuaXRzIHRvIGRlZmF1bHQgY29sb3IgZmlyc3QsIGNhdXNlIHVwZGF0ZUNob3BsZXRoIGp1c3QgdXBkYXRlcyBuZXcgZGF0YSBsZWF2ZXMgdGhlIG9sZCBkYXRhIGZvciB1bml0cyBubyBsb25nZXIgaW4gZGF0YXNldFxuXHRcdFx0XHRkMy5zZWxlY3RBbGwoIFwicGF0aC5kYXRhbWFwcy1zdWJ1bml0XCIgKS5zdHlsZSggXCJmaWxsXCIsIHRoaXMuZGF0YU1hcC5vcHRpb25zLmZpbGxzLmRlZmF1bHRGaWxsICk7XG5cdFx0XHRcdHRoaXMuZGF0YU1hcC51cGRhdGVDaG9yb3BsZXRoKCBtYXBEYXRhICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvL2NoYW5naW5nIHByb2plY3Rpb24sIG5lZWQgdG8gcmVtb3ZlIGV4aXN0aW5nIHVuaXRzLCByZWRyYXcgZXZlcnl0aGluZyBhbmQgYWZ0ZXIgZG9uZSBkcmF3aW5nLCB1cGRhdGUgZGF0YVxuXHRcdFx0XHRkMy5zZWxlY3RBbGwoJ3BhdGguZGF0YW1hcHMtc3VidW5pdCcpLnJlbW92ZSgpO1xuXHRcdFx0XHR0aGlzLmRhdGFNYXAub3B0aW9ucy5zZXRQcm9qZWN0aW9uID0gbmV3UHJvamVjdGlvbjtcblx0XHRcdFx0dGhpcy5kYXRhTWFwLmRyYXcoKTtcblx0XHRcdFx0dGhpcy5kYXRhTWFwLm9wdGlvbnMuZG9uZSA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdHRoYXQuZGF0YU1hcC51cGRhdGVDaG9yb3BsZXRoKCBtYXBEYXRhICk7XG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0XHRcblx0XHR9LFxuXG5cdFx0Z2V0UHJvamVjdGlvbjogZnVuY3Rpb24oIHByb2plY3Rpb25OYW1lICkge1xuXG5cdFx0XHR2YXIgcHJvamVjdGlvbnMgPSBBcHAuVmlld3MuQ2hhcnQuTWFwVGFiLnByb2plY3Rpb25zLFxuXHRcdFx0XHRuZXdQcm9qZWN0aW9uID0gKCBwcm9qZWN0aW9uc1sgcHJvamVjdGlvbk5hbWUgXSApPyBwcm9qZWN0aW9uc1sgcHJvamVjdGlvbk5hbWUgXTogcHJvamVjdGlvbnMuV29ybGQ7XG5cdFx0XHRyZXR1cm4gbmV3UHJvamVjdGlvbjtcblx0XHRcdFxuXHRcdH0sXG5cblx0XHRvblJlc2l6ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRpZiggdGhpcy5kYXRhTWFwICkge1xuXHRcdFx0XHQvL2luc3RlYWQgb2YgY2FsbGluZyBkYXRhbWFwcyByZXNpemUsIHRoZXJlJ3MgbW9kaWZpZWQgdmVyc2lvbiBvZiB0aGUgc2FtZSBtZXRob2Rcblx0XHRcdFx0dmFyIG9wdGlvbnMgPSB0aGlzLmRhdGFNYXAub3B0aW9ucyxcblx0XHRcdFx0XHRwcmVmaXggPSAnLXdlYmtpdC10cmFuc2Zvcm0nIGluIGRvY3VtZW50LmJvZHkuc3R5bGUgPyAnLXdlYmtpdC0nIDogJy1tb3otdHJhbnNmb3JtJyBpbiBkb2N1bWVudC5ib2R5LnN0eWxlID8gJy1tb3otJyA6ICctbXMtdHJhbnNmb3JtJyBpbiBkb2N1bWVudC5ib2R5LnN0eWxlID8gJy1tcy0nIDogJycsXG5cdFx0XHRcdFx0bmV3c2l6ZSA9IG9wdGlvbnMuZWxlbWVudC5jbGllbnRXaWR0aCxcblx0XHRcdFx0XHRvbGRzaXplID0gZDMuc2VsZWN0KCBvcHRpb25zLmVsZW1lbnQpLnNlbGVjdCgnc3ZnJykuYXR0cignZGF0YS13aWR0aCcpO1xuXHRcdFx0XHRcdC8vZGlmZmVyZW50IHNlbGVjdG9yIGZyb20gZGVmYXVsdCBkYXRhbWFwcyBpbXBsZW1lbnRhdGlvbiwgZG9lc24ndCBzY2FsZSBsZWdlbmRcblx0XHRcdFx0XHRkMy5zZWxlY3Qob3B0aW9ucy5lbGVtZW50KS5zZWxlY3QoJ3N2ZycpLnNlbGVjdEFsbCgnZzpub3QoLmxlZ2VuZC1zdGVwKTpub3QoLmxlZ2VuZCknKS5zdHlsZShwcmVmaXggKyAndHJhbnNmb3JtJywgJ3NjYWxlKCcgKyAobmV3c2l6ZSAvIG9sZHNpemUpICsgJyknKTtcblx0XHRcdFx0Ly90aGlzLmRhdGFNYXAucmVzaXplKCk7XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdG9uQ2hhcnRNb2RlbFJlc2l6ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLm9uUmVzaXplKCk7XG5cdFx0fVxuXG5cdH0pO1xuXG5cdEFwcC5WaWV3cy5DaGFydC5NYXBUYWIucHJvamVjdGlvbnMgPSB7XG5cdFx0XG5cdFx0XCJXb3JsZFwiOiBmdW5jdGlvbihlbGVtZW50KSB7XG5cdFx0XHQvL2VtcGlyaWNcblx0XHRcdHZhciBrID0gNjtcblx0XHRcdHZhciBwcm9qZWN0aW9uID0gZDMuZ2VvLmVja2VydDMoKVxuXHRcdFx0XHQuc2NhbGUoZWxlbWVudC5vZmZzZXRXaWR0aC9rKVxuXHRcdFx0XHQudHJhbnNsYXRlKFtlbGVtZW50Lm9mZnNldFdpZHRoIC8gMiwgZWxlbWVudC5vZmZzZXRIZWlnaHQgLyAyXSlcblx0XHRcdFx0LnByZWNpc2lvbiguMSk7XG5cdFx0XHR2YXIgcGF0aCA9IGQzLmdlby5wYXRoKCkucHJvamVjdGlvbihwcm9qZWN0aW9uKTtcblx0XHRcdHJldHVybiB7cGF0aDogcGF0aCwgcHJvamVjdGlvbjogcHJvamVjdGlvbn07XG5cdFx0fSxcblx0XHQvKlwiV29ybGRcIjogZnVuY3Rpb24oZWxlbWVudCkge1xuXHRcdFx0dmFyIHByb2plY3Rpb24gPSBkMy5nZW8uZXF1aXJlY3Rhbmd1bGFyKClcblx0XHRcdFx0LnNjYWxlKChlbGVtZW50Lm9mZnNldFdpZHRoICsgMSkgLyAyIC8gTWF0aC5QSSlcblx0XHRcdFx0LnRyYW5zbGF0ZShbZWxlbWVudC5vZmZzZXRXaWR0aCAvIDIsIGVsZW1lbnQub2Zmc2V0SGVpZ2h0IC8gMS44XSk7XG5cdFx0XHR2YXIgcGF0aCA9IGQzLmdlby5wYXRoKCkucHJvamVjdGlvbihwcm9qZWN0aW9uKTtcblx0XHRcdHJldHVybiB7cGF0aDogcGF0aCwgcHJvamVjdGlvbjogcHJvamVjdGlvbn07XG5cdFx0fSwqL1xuXHRcdFwiQWZyaWNhXCI6IGZ1bmN0aW9uKGVsZW1lbnQpIHtcblx0XHRcdC8vZW1waXJpY1xuXHRcdFx0dmFyIGsgPSAzO1xuXHRcdFx0dmFyIHByb2plY3Rpb24gPSBkMy5nZW8uY29uaWNDb25mb3JtYWwoKVxuXHRcdFx0XHQucm90YXRlKFstMjUsIDBdKVxuXHRcdFx0XHQuY2VudGVyKFswLCAwXSlcblx0XHRcdFx0LnBhcmFsbGVscyhbMzAsIC0yMF0pXG5cdFx0XHRcdC5zY2FsZShlbGVtZW50Lm9mZnNldFdpZHRoL2spXG5cdFx0XHRcdC50cmFuc2xhdGUoW2VsZW1lbnQub2Zmc2V0V2lkdGggLyAyLCBlbGVtZW50Lm9mZnNldEhlaWdodCAvIDJdKTtcblx0XHRcdHZhciBwYXRoID0gZDMuZ2VvLnBhdGgoKS5wcm9qZWN0aW9uKHByb2plY3Rpb24pO1xuXHRcdFx0cmV0dXJuIHtwYXRoOiBwYXRoLCBwcm9qZWN0aW9uOiBwcm9qZWN0aW9ufTtcblx0XHR9LFxuXHRcdFwiTi5BbWVyaWNhXCI6IGZ1bmN0aW9uKGVsZW1lbnQpIHtcblx0XHRcdC8vZW1waXJpY1xuXHRcdFx0dmFyIGsgPSAzO1xuXHRcdFx0dmFyIHByb2plY3Rpb24gPSBkMy5nZW8uY29uaWNDb25mb3JtYWwoKVxuXHRcdFx0XHQucm90YXRlKFs5OCwgMF0pXG5cdFx0XHRcdC5jZW50ZXIoWzAsIDM4XSlcblx0XHRcdFx0LnBhcmFsbGVscyhbMjkuNSwgNDUuNV0pXG5cdFx0XHRcdC5zY2FsZShlbGVtZW50Lm9mZnNldFdpZHRoL2spXG5cdFx0XHRcdC50cmFuc2xhdGUoW2VsZW1lbnQub2Zmc2V0V2lkdGggLyAyLCBlbGVtZW50Lm9mZnNldEhlaWdodCAvIDJdKTtcblx0XHRcdHZhciBwYXRoID0gZDMuZ2VvLnBhdGgoKS5wcm9qZWN0aW9uKHByb2plY3Rpb24pO1xuXHRcdFx0cmV0dXJuIHtwYXRoOiBwYXRoLCBwcm9qZWN0aW9uOiBwcm9qZWN0aW9ufTtcblx0XHR9LFxuXHRcdFwiUy5BbWVyaWNhXCI6IGZ1bmN0aW9uKGVsZW1lbnQpIHtcblx0XHRcdC8vZW1waXJpY1xuXHRcdFx0dmFyIGsgPSAzLjQ7XG5cdFx0XHR2YXIgcHJvamVjdGlvbiA9IGQzLmdlby5jb25pY0NvbmZvcm1hbCgpXG5cdFx0XHRcdC5yb3RhdGUoWzY4LCAwXSlcblx0XHRcdFx0LmNlbnRlcihbMCwgLTE0XSlcblx0XHRcdFx0LnBhcmFsbGVscyhbMTAsIC0zMF0pXG5cdFx0XHRcdC5zY2FsZShlbGVtZW50Lm9mZnNldFdpZHRoL2spXG5cdFx0XHRcdC50cmFuc2xhdGUoW2VsZW1lbnQub2Zmc2V0V2lkdGggLyAyLCBlbGVtZW50Lm9mZnNldEhlaWdodCAvIDJdKTtcblx0XHRcdHZhciBwYXRoID0gZDMuZ2VvLnBhdGgoKS5wcm9qZWN0aW9uKHByb2plY3Rpb24pO1xuXHRcdFx0cmV0dXJuIHtwYXRoOiBwYXRoLCBwcm9qZWN0aW9uOiBwcm9qZWN0aW9ufTtcblx0XHR9LFxuXHRcdFwiQXNpYVwiOiBmdW5jdGlvbihlbGVtZW50KSB7XG5cdFx0XHQvL2VtcGlyaWNcblx0XHRcdHZhciBrID0gMztcblx0XHRcdHZhciBwcm9qZWN0aW9uID0gZDMuZ2VvLmNvbmljQ29uZm9ybWFsKClcblx0XHRcdFx0LnJvdGF0ZShbLTEwNSwgMF0pXG5cdFx0XHRcdC5jZW50ZXIoWzAsIDM3XSlcblx0XHRcdFx0LnBhcmFsbGVscyhbMTAsIDYwXSlcblx0XHRcdFx0LnNjYWxlKGVsZW1lbnQub2Zmc2V0V2lkdGgvaylcblx0XHRcdFx0LnRyYW5zbGF0ZShbZWxlbWVudC5vZmZzZXRXaWR0aCAvIDIsIGVsZW1lbnQub2Zmc2V0SGVpZ2h0IC8gMl0pO1xuXHRcdFx0dmFyIHBhdGggPSBkMy5nZW8ucGF0aCgpLnByb2plY3Rpb24ocHJvamVjdGlvbik7XG5cdFx0XHRyZXR1cm4ge3BhdGg6IHBhdGgsIHByb2plY3Rpb246IHByb2plY3Rpb259O1xuXHRcdH0sXG5cdFx0XCJFdXJvcGVcIjogZnVuY3Rpb24oZWxlbWVudCkge1xuXHRcdFx0Ly9lbXBpcmljXG5cdFx0XHR2YXIgayA9IDEuNTtcblx0XHRcdHZhciBwcm9qZWN0aW9uID0gZDMuZ2VvLmNvbmljQ29uZm9ybWFsKClcblx0XHRcdFx0LnJvdGF0ZShbLTE1LCAwXSlcblx0XHRcdFx0LmNlbnRlcihbMCwgNTVdKVxuXHRcdFx0XHQucGFyYWxsZWxzKFs2MCwgNDBdKVxuXHRcdFx0XHQuc2NhbGUoZWxlbWVudC5vZmZzZXRXaWR0aC9rKVxuXHRcdFx0XHQudHJhbnNsYXRlKFtlbGVtZW50Lm9mZnNldFdpZHRoIC8gMiwgZWxlbWVudC5vZmZzZXRIZWlnaHQgLyAyXSk7XG5cdFx0XHR2YXIgcGF0aCA9IGQzLmdlby5wYXRoKCkucHJvamVjdGlvbihwcm9qZWN0aW9uKTtcblx0XHRcdHJldHVybiB7cGF0aDogcGF0aCwgcHJvamVjdGlvbjogcHJvamVjdGlvbn07XG5cdFx0fSxcblx0XHRcIkF1c3RyYWxpYVwiOiBmdW5jdGlvbihlbGVtZW50KSB7XG5cdFx0XHQvL2VtcGlyaWNcblx0XHRcdHZhciBrID0gMztcblx0XHRcdHZhciBwcm9qZWN0aW9uID0gZDMuZ2VvLmNvbmljQ29uZm9ybWFsKClcblx0XHRcdFx0LnJvdGF0ZShbLTEzNSwgMF0pXG5cdFx0XHRcdC5jZW50ZXIoWzAsIC0yMF0pXG5cdFx0XHRcdC5wYXJhbGxlbHMoWy0xMCwgLTMwXSlcblx0XHRcdFx0LnNjYWxlKGVsZW1lbnQub2Zmc2V0V2lkdGgvaylcblx0XHRcdFx0LnRyYW5zbGF0ZShbZWxlbWVudC5vZmZzZXRXaWR0aCAvIDIsIGVsZW1lbnQub2Zmc2V0SGVpZ2h0IC8gMl0pO1xuXHRcdFx0dmFyIHBhdGggPSBkMy5nZW8ucGF0aCgpLnByb2plY3Rpb24ocHJvamVjdGlvbik7XG5cdFx0XHRyZXR1cm4ge3BhdGg6IHBhdGgsIHByb2plY3Rpb246IHByb2plY3Rpb259O1xuXHRcdH1cblxuXHR9O1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkNoYXJ0Lk1hcFRhYjtcblxufSkoKTtcblxuKGZ1bmN0aW9uKCkge1xuXHR2YXIgzrUgPSAxZS02LCDOtTIgPSDOtSAqIM61LCDPgCA9IE1hdGguUEksIGhhbGbPgCA9IM+AIC8gMiwgc3FydM+AID0gTWF0aC5zcXJ0KM+AKSwgcmFkaWFucyA9IM+AIC8gMTgwLCBkZWdyZWVzID0gMTgwIC8gz4A7XG5cdGZ1bmN0aW9uIHNpbmNpKHgpIHtcblx0XHRyZXR1cm4geCA/IHggLyBNYXRoLnNpbih4KSA6IDE7XG5cdH1cblx0ZnVuY3Rpb24gc2duKHgpIHtcblx0XHRyZXR1cm4geCA+IDAgPyAxIDogeCA8IDAgPyAtMSA6IDA7XG5cdH1cblx0ZnVuY3Rpb24gYXNpbih4KSB7XG5cdFx0cmV0dXJuIHggPiAxID8gaGFsZs+AIDogeCA8IC0xID8gLWhhbGbPgCA6IE1hdGguYXNpbih4KTtcblx0fVxuXHRmdW5jdGlvbiBhY29zKHgpIHtcblx0XHRyZXR1cm4geCA+IDEgPyAwIDogeCA8IC0xID8gz4AgOiBNYXRoLmFjb3MoeCk7XG5cdH1cblx0ZnVuY3Rpb24gYXNxcnQoeCkge1xuXHRcdHJldHVybiB4ID4gMCA/IE1hdGguc3FydCh4KSA6IDA7XG5cdH1cblx0dmFyIHByb2plY3Rpb24gPSBkMy5nZW8ucHJvamVjdGlvbjtcbiBcblx0ZnVuY3Rpb24gZWNrZXJ0MyjOuywgz4YpIHtcblx0XHR2YXIgayA9IE1hdGguc3FydCjPgCAqICg0ICsgz4ApKTtcblx0XHRyZXR1cm4gWyAyIC8gayAqIM67ICogKDEgKyBNYXRoLnNxcnQoMSAtIDQgKiDPhiAqIM+GIC8gKM+AICogz4ApKSksIDQgLyBrICogz4YgXTtcblx0fVxuXHRlY2tlcnQzLmludmVydCA9IGZ1bmN0aW9uKHgsIHkpIHtcblx0XHR2YXIgayA9IE1hdGguc3FydCjPgCAqICg0ICsgz4ApKSAvIDI7XG5cdFx0cmV0dXJuIFsgeCAqIGsgLyAoMSArIGFzcXJ0KDEgLSB5ICogeSAqICg0ICsgz4ApIC8gKDQgKiDPgCkpKSwgeSAqIGsgLyAyIF07XG5cdH07XG5cdChkMy5nZW8uZWNrZXJ0MyA9IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiBwcm9qZWN0aW9uKGVja2VydDMpO1xuXHR9KS5yYXcgPSBlY2tlcnQzO1xuXHRcbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHRBcHAuVmlld3MuQ2hhcnQuU2NhbGVTZWxlY3RvcnMgPSBCYWNrYm9uZS5WaWV3LmV4dGVuZCh7XG5cblx0XHRlbDogXCIjY2hhcnQtdmlldyAuYXhpcy1zY2FsZS1zZWxlY3RvcnMtd3JhcHBlclwiLFxuXHRcdGV2ZW50czoge1xuXHRcdFx0XCJjbGljayAuYXhpcy1zY2FsZS1idG5cIjogXCJvbkF4aXNTY2FsZUJ0blwiLFxuXHRcdFx0XCJjaGFuZ2UgLmF4aXMtc2NhbGUgbGlcIjogXCJvbkF4aXNTY2FsZUNoYW5nZVwiXG5cdFx0fSxcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0XG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIgPSBvcHRpb25zLmRpc3BhdGNoZXI7XG5cdFx0XHRcblx0XHRcdHRoaXMuJHRhYnMgPSB0aGlzLiRlbC5maW5kKCBcIi5oZWFkZXItdGFiXCIgKTtcblx0XHRcdFxuXHRcdFx0dGhpcy4keEF4aXNTY2FsZSA9IHRoaXMuJGVsLmZpbmQoIFwiW2RhdGEtbmFtZT0neC1heGlzLXNjYWxlJ11cIiApO1xuXHRcdFx0dGhpcy4keUF4aXNTY2FsZSA9IHRoaXMuJGVsLmZpbmQoIFwiW2RhdGEtbmFtZT0neS1heGlzLXNjYWxlJ11cIiApO1xuXG5cdFx0XHR0aGlzLmluaXREcm9wRG93biggdGhpcy4keEF4aXNTY2FsZSApO1xuXHRcdFx0dGhpcy5pbml0RHJvcERvd24oIHRoaXMuJHlBeGlzU2NhbGUgKTtcblxuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblxuXHRcdFx0Ly9zZXR1cCBldmVudHNcblx0XHRcdEFwcC5DaGFydE1vZGVsLm9uKCBcImNoYW5nZVwiLCB0aGlzLnJlbmRlciwgdGhpcyApO1xuXG5cdFx0fSxcblxuXHRcdC8qaW5pdEV2ZW50czogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLiRjaGFydFZpZXcgPSAkKCBcIiNjaGFydC12aWV3XCIgKTtcblx0XHRcdHRoaXMuJHdyYXAgPSB0aGlzLiRjaGFydFZpZXcuZmluZCggXCJzdmcgPiAubnYtd3JhcFwiICk7XG5cdFx0XHRcblx0XHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRcdHRoaXMuJHdyYXAub24oIFwibW91c2VvdmVyXCIsIGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHRcdHRoYXQuJGNoYXJ0Vmlldy5hZGRDbGFzcyggXCJjaGFydC1ob3ZlcmVkXCIgKTtcblx0XHRcdH0gKTtcblx0XHRcdHRoaXMuJHdyYXAub24oIFwibW91c2VvdXRcIiwgZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdFx0Y29uc29sZS5sb2coIGV2dC5jdXJyZW50VGFyZ2V0ICk7XG5cdFx0XHRcdHRoYXQuJGNoYXJ0Vmlldy5yZW1vdmVDbGFzcyggXCJjaGFydC1ob3ZlcmVkXCIgKTtcblx0XHRcdH0gKTtcblx0XHR9LCovXG5cblx0XHRpbml0RHJvcERvd246IGZ1bmN0aW9uKCAkZWwgKSB7XG5cblx0XHRcdHZhciAkbGlzdCA9ICRlbC5maW5kKCBcInVsXCIgKSxcblx0XHRcdFx0JGl0ZW1zID0gJGxpc3QuZmluZCggXCJsaVwiICk7XG5cblx0XHRcdCRpdGVtcy5vbiggXCJjbGlja1wiLCBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0XHR2YXIgJHRoaXMgPSAkKCB0aGlzICksXG5cdFx0XHRcdFx0dmFsdWUgPSAkdGhpcy5hdHRyKCBcImRhdGEtdmFsdWVcIiApO1xuXHRcdFx0XHQkaXRlbXMucmVtb3ZlQ2xhc3MoIFwic2VsZWN0ZWRcIiApO1xuXHRcdFx0XHQkdGhpcy5hZGRDbGFzcyggXCJzZWxlY3RlZFwiICk7XG5cdFx0XHRcdCR0aGlzLnRyaWdnZXIoIFwiY2hhbmdlXCIgKTtcblx0XHRcdH0gKTtcblxuXHRcdH0sXG5cblx0XHRvbkF4aXNTY2FsZUNoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dmFyICRsaSA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICksXG5cdFx0XHRcdCRwYXJlbnQgPSAkbGkucGFyZW50KCkucGFyZW50KCkucGFyZW50KCksXG5cdFx0XHRcdCRkaXYgPSAkcGFyZW50LmZpbmQoIFwiZGl2XCIgKSxcblx0XHRcdFx0JGJ0biA9ICRwYXJlbnQuZmluZCggXCIuYXhpcy1zY2FsZS1idG5cIiApLFxuXHRcdFx0XHQkc2VsZWN0ID0gJHBhcmVudC5maW5kKCBcIi5heGlzLXNjYWxlXCIgKSxcblx0XHRcdFx0bmFtZSA9ICRkaXYuYXR0ciggXCJkYXRhLW5hbWVcIiApLFxuXHRcdFx0XHRheGlzTmFtZSA9ICggbmFtZSA9PT0gXCJ4LWF4aXMtc2NhbGVcIiApPyBcIngtYXhpc1wiOiBcInktYXhpc1wiLFxuXHRcdFx0XHRheGlzUHJvcCA9IFwiYXhpcy1zY2FsZVwiLFxuXHRcdFx0XHR2YWx1ZSA9ICRsaS5hdHRyKCBcImRhdGEtdmFsdWVcIiApO1xuXG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5zZXRBeGlzQ29uZmlnKCBheGlzTmFtZSwgYXhpc1Byb3AsIHZhbHVlICk7XG5cdFx0XHRcblx0XHRcdCRzZWxlY3QuaGlkZSgpO1xuXHRcdFx0Ly8kYnRuLnNob3coKTtcblxuXHRcdH0sXG5cblx0XHRvbkF4aXNTY2FsZUJ0bjogZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdFxuXHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHR2YXIgJGJ0biA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICksXG5cdFx0XHRcdCRwYXJlbnQgPSAkYnRuLnBhcmVudCgpLFxuXHRcdFx0XHQkc2VsZWN0ID0gJHBhcmVudC5maW5kKCBcIi5heGlzLXNjYWxlXCIgKTtcblxuXHRcdFx0JHNlbGVjdC5zaG93KCk7XG5cdFx0XHQvLyRidG4uaGlkZSgpO1xuXG5cdFx0fVxuXG5cdH0pO1xuXHRcblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVmlld3MuQ2hhcnQuU2NhbGVTZWxlY3RvcnM7XG5cdFxufSkoKTtcbiIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0QXBwLlZpZXdzLkNoYXJ0LlNvdXJjZXNUYWIgPSBCYWNrYm9uZS5WaWV3LmV4dGVuZCgge1xuXG5cdFx0ZWw6IFwiI2NoYXJ0LXZpZXdcIixcblx0XHRldmVudHM6IHt9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHRcblx0XHRcdHRoaXMuZGlzcGF0Y2hlciA9IG9wdGlvbnMuZGlzcGF0Y2hlcjtcblxuXHRcdFx0dGhpcy4kY2hhcnREZXNjcmlwdGlvbiA9IHRoaXMuJGVsLmZpbmQoIFwiLmNoYXJ0LWRlc2NyaXB0aW9uXCIgKTtcblx0XHRcdHRoaXMuJGNoYXJ0U291cmNlcyA9IHRoaXMuJGVsLmZpbmQoIFwiLmNoYXJ0LXNvdXJjZXNcIiApO1xuXHRcdFx0dGhpcy4kc291cmNlc1RhYiA9IHRoaXMuJGVsLmZpbmQoIFwiI3NvdXJjZXMtY2hhcnQtdGFiXCIgKTtcblxuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCByZXNwb25zZSApIHtcblxuXHRcdFx0aWYoICFyZXNwb25zZSB8fCAhcmVzcG9uc2UuZGF0YXNvdXJjZXMgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0dmFyIHNvdXJjZXMgPSByZXNwb25zZS5kYXRhc291cmNlcyxcblx0XHRcdFx0bGljZW5zZSA9IHJlc3BvbnNlLmxpY2Vuc2UsXG5cdFx0XHRcdGZvb3Rlckh0bWwgPSBcIlwiLFxuXHRcdFx0XHR0YWJIdG1sID0gXCJcIixcblx0XHRcdFx0ZGVzY3JpcHRpb25IdG1sID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LWRlc2NyaXB0aW9uXCIgKSxcblx0XHRcdFx0c291cmNlc1Nob3J0SHRtbCA9IFwiRGF0YSBvYnRhaW5lZCBmcm9tOiBcIixcblx0XHRcdFx0c291cmNlc0xvbmdIdG1sID0gXCJcIixcblx0XHRcdFx0Ly9jaGVjayB0aGF0IHdlJ3JlIG5vdCBhZGRpbmcgc291cmNlcyB3aXRoIHRoZSBzYW1lIG5hbWUgbW9yZSB0aW1lc1xuXHRcdFx0XHRzb3VyY2VzQnlOYW1lID0gW107XG5cdFx0XHRcdFxuXHRcdFx0Ly9jb25zdHJ1Y3Qgc291cmNlIGh0bWxcblx0XHRcdF8uZWFjaCggc291cmNlcywgZnVuY3Rpb24oIHNvdXJjZURhdGEsIHNvdXJjZUluZGV4ICkge1xuXHRcdFx0XHQvL21ha2Ugc3VyZSB3ZSBkb24ndCBoYXZlIHNvdXJjZSB3aXRoIHRoZSBzYW1lIG5hbWUgaW4gdGhlIHNob3J0IGRlc2NyaXB0aW9uIGFscmVhZHlcblx0XHRcdFx0aWYoICFzb3VyY2VzQnlOYW1lWyBzb3VyY2VEYXRhLm5hbWUgXSApIHtcblx0XHRcdFx0XHRpZiggc291cmNlSW5kZXggPiAwICkge1xuXHRcdFx0XHRcdFx0c291cmNlc1Nob3J0SHRtbCArPSBcIiwgXCI7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmKCBzb3VyY2VEYXRhLmxpbmsgKSB7XG5cdFx0XHRcdFx0XHRzb3VyY2VzU2hvcnRIdG1sICs9IFwiPGEgaHJlZj0nXCIgKyBzb3VyY2VEYXRhLmxpbmsgKyBcIicgdGFyZ2V0PSdfYmxhbmsnPlwiICsgc291cmNlRGF0YS5uYW1lICsgXCI8L2E+XCI7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHNvdXJjZXNTaG9ydEh0bWwgKz0gc291cmNlRGF0YS5uYW1lO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRzb3VyY2VzQnlOYW1lWyBzb3VyY2VEYXRhLm5hbWUgXSA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdC8vc291cmNlcyBub3cgY29udGFpbiBodG1sLCBzbyBubyBuZWVkIHRvIHNlcGFyYXRlIHdpdGggY29tbWFcblx0XHRcdFx0LyppZiggc291cmNlSW5kZXggPiAwICYmIHNvdXJjZXNMb25nSHRtbCAhPT0gXCJcIiAmJiBzb3VyY2VEYXRhLmRlc2NyaXB0aW9uICE9PSBcIlwiICkge1xuXHRcdFx0XHRcdHNvdXJjZXNMb25nSHRtbCArPSBcIiwgXCI7XG5cdFx0XHRcdH0qL1xuXHRcdFx0XHRzb3VyY2VzTG9uZ0h0bWwgKz0gc291cmNlRGF0YS5kZXNjcmlwdGlvbjtcblx0XHRcdFxuXHRcdFx0fSApO1xuXG5cdFx0XHRmb290ZXJIdG1sID0gZGVzY3JpcHRpb25IdG1sO1xuXHRcdFx0dGFiSHRtbCA9IGRlc2NyaXB0aW9uSHRtbCArIFwiPGJyIC8+PGJyIC8+XCIgKyBzb3VyY2VzTG9uZ0h0bWw7XG5cdFx0XHRcblx0XHRcdC8vYWRkIGxpY2Vuc2UgaW5mb1xuXHRcdFx0aWYoIGxpY2Vuc2UgJiYgbGljZW5zZS5kZXNjcmlwdGlvbiApIHtcblx0XHRcdFx0Zm9vdGVySHRtbCA9IGxpY2Vuc2UuZGVzY3JpcHRpb24gKyBcIiBcIiArIGZvb3Rlckh0bWw7XG5cdFx0XHRcdHRhYkh0bWwgPSBsaWNlbnNlLmRlc2NyaXB0aW9uICsgXCIgXCIgKyB0YWJIdG1sO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHQvL2FwcGVuZCB0byBET01cblx0XHRcdHRoaXMuJGNoYXJ0RGVzY3JpcHRpb24uaHRtbCggZm9vdGVySHRtbCApO1xuXHRcdFx0dGhpcy4kY2hhcnRTb3VyY2VzLmh0bWwoIHNvdXJjZXNTaG9ydEh0bWwgKTtcblx0XHRcdHRoaXMuJHNvdXJjZXNUYWIuaHRtbCggdGFiSHRtbCApO1xuXG5cdFx0fVxuXG5cdH0gKTtcblx0XG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkNoYXJ0LlNvdXJjZXNUYWI7XG5cbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHRBcHAuVmlld3MuQ2hhcnQuTWFwLk1hcENvbnRyb2xzID0gQmFja2JvbmUuVmlldy5leHRlbmQoe1xuXG5cdFx0ZWw6IFwiI21hcC1jaGFydC10YWIgLm1hcC1jb250cm9scy1oZWFkZXJcIixcblx0XHRldmVudHM6IHtcblx0XHRcdFwiaW5wdXQgLnRhcmdldC15ZWFyLWNvbnRyb2wgaW5wdXRcIjogXCJvblRhcmdldFllYXJJbnB1dFwiLFxuXHRcdFx0XCJjaGFuZ2UgLnRhcmdldC15ZWFyLWNvbnRyb2wgaW5wdXRcIjogXCJvblRhcmdldFllYXJDaGFuZ2VcIixcblx0XHRcdFwiY2xpY2sgLnJlZ2lvbi1jb250cm9sIGxpXCI6IFwib25SZWdpb25DbGlja1wiLFxuXHRcdFx0XCJjbGljayAuc2V0dGluZ3MtY29udHJvbCBpbnB1dFwiOiBcIm9uU2V0dGluZ3NJbnB1dFwiLFxuXHRcdH0sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gb3B0aW9ucy5kaXNwYXRjaGVyO1xuXG5cdFx0XHR2YXIgbWFwQ29uZmlnID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcIm1hcC1jb25maWdcIiApO1xuXHRcdFx0XG5cdFx0XHQvL3llYXIgc2xpZGVyXG5cdFx0XHR0aGlzLiR0YXJnZXRZZWFyQ29udHJvbCA9IHRoaXMuJGVsLmZpbmQoIFwiLnRhcmdldC15ZWFyLWNvbnRyb2xcIiApO1xuXHRcdFx0dGhpcy4kdGFyZ2V0WWVhckxhYmVsID0gdGhpcy4kdGFyZ2V0WWVhckNvbnRyb2wuZmluZCggXCIudGFyZ2V0LXllYXItbGFiZWxcIiApO1xuXHRcdFx0dGhpcy4kdGFyZ2V0WWVhcklucHV0ID0gdGhpcy4kdGFyZ2V0WWVhckNvbnRyb2wuZmluZCggXCJpbnB1dFwiICk7XG5cdFx0XHRcblx0XHRcdC8vcmVnaW9uIHNlbGVjdG9yXG5cdFx0XHR0aGlzLiRyZWdpb25Db250cm9sID0gdGhpcy4kZWwuZmluZCggXCIucmVnaW9uLWNvbnRyb2xcIiApO1xuXHRcdFx0dGhpcy4kcmVnaW9uQ29udHJvbExhYmVsID0gdGhpcy4kcmVnaW9uQ29udHJvbC5maW5kKCBcIi5yZWdpb24tbGFiZWxcIiApO1xuXHRcdFx0dGhpcy4kcmVnaW9uQ29udHJvbExpcyA9IHRoaXMuJHJlZ2lvbkNvbnRyb2wuZmluZCggXCJsaVwiICk7XG5cblx0XHRcdEFwcC5DaGFydE1vZGVsLm9uKCBcImNoYW5nZVwiLCB0aGlzLm9uQ2hhcnRNb2RlbENoYW5nZSwgdGhpcyApO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwub24oIFwiY2hhbmdlLW1hcFwiLCB0aGlzLm9uQ2hhcnRNb2RlbENoYW5nZSwgdGhpcyApO1xuXG5cdFx0XHRyZXR1cm4gdGhpcy5yZW5kZXIoKTtcblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdFxuXHRcdFx0dmFyIG1hcENvbmZpZyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJtYXAtY29uZmlnXCIgKTtcblx0XHRcdFxuXHRcdFx0dGhpcy4kdGFyZ2V0WWVhckxhYmVsLnRleHQoIG1hcENvbmZpZy50YXJnZXRZZWFyICk7XG5cdFx0XHR0aGlzLiRyZWdpb25Db250cm9sTGFiZWwudGV4dCggbWFwQ29uZmlnLnByb2plY3Rpb24gKTtcblxuXHRcdFx0dGhpcy4kdGFyZ2V0WWVhcklucHV0LmF0dHIoIFwibWluXCIsIG1hcENvbmZpZy5taW5ZZWFyICk7XG5cdFx0XHR0aGlzLiR0YXJnZXRZZWFySW5wdXQuYXR0ciggXCJtYXhcIiwgbWFwQ29uZmlnLm1heFllYXIgKTtcblx0XHRcdHRoaXMuJHRhcmdldFllYXJJbnB1dC5hdHRyKCBcInN0ZXBcIiwgbWFwQ29uZmlnLnRpbWVJbnRlcnZhbCApO1xuXHRcdFx0dGhpcy4kdGFyZ2V0WWVhcklucHV0LnZhbCggcGFyc2VJbnQoIG1hcENvbmZpZy50YXJnZXRZZWFyLCAxMCApICk7XG5cblx0XHRcdHRoaXMuJHJlZ2lvbkNvbnRyb2xMaXMucmVtb3ZlQ2xhc3MoIFwiaGlnaGxpZ2h0XCIgKTtcblx0XHRcdHRoaXMuJHJlZ2lvbkNvbnRyb2xMaXMuZmlsdGVyKCBcIi5cIiArIG1hcENvbmZpZy5wcm9qZWN0aW9uICsgXCItcHJvamVjdGlvblwiICkuYWRkQ2xhc3MoIFwiaGlnaGxpZ2h0XCIgKTtcblxuXHRcdH0sXG5cblx0XHRvbkNoYXJ0TW9kZWxDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHR0aGlzLnJlbmRlcigpO1xuXHRcdH0sXG5cdFx0XG5cdFx0b25UYXJnZXRZZWFySW5wdXQ6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHR2YXIgJHRoaXMgPSAkKCBldnQudGFyZ2V0ICksXG5cdFx0XHRcdHRhcmdldFllYXIgPSBwYXJzZUludCggJHRoaXMudmFsKCksIDEwICk7XG5cdFx0XHR0aGlzLiR0YXJnZXRZZWFyTGFiZWwudGV4dCggdGFyZ2V0WWVhciwgZmFsc2UsIFwiY2hhbmdlLW1hcFwiICk7XG5cdFx0fSxcblxuXHRcdG9uVGFyZ2V0WWVhckNoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdHZhciAkdGhpcyA9ICQoIGV2dC50YXJnZXQgKSxcblx0XHRcdFx0dGFyZ2V0WWVhciA9IHBhcnNlSW50KCAkdGhpcy52YWwoKSwgMTAgKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnVwZGF0ZU1hcENvbmZpZyggXCJ0YXJnZXRZZWFyXCIsIHRhcmdldFllYXIsIGZhbHNlLCBcImNoYW5nZS1tYXBcIiApO1xuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblx0XHR9LFxuXG5cdFx0b25SZWdpb25DbGljazogZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdHZhciAkdGhpcyA9ICQoIGV2dC50YXJnZXQgKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnVwZGF0ZU1hcENvbmZpZyggXCJwcm9qZWN0aW9uXCIsICR0aGlzLnRleHQoKSwgZmFsc2UsIFwiY2hhbmdlLW1hcFwiICk7XG5cdFx0XHR0aGlzLnJlbmRlcigpO1xuXHRcdH0sXG5cblx0XHRvblNldHRpbmdzSW5wdXQ6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHR2YXIgJHRoaXMgPSAkKCBldnQudGFyZ2V0ICksXG5cdFx0XHRcdG1vZGUgPSAoICR0aGlzLmlzKCBcIjpjaGVja2VkXCIgKSApPyBcInNwZWNpZmljXCI6IFwibm8taW50ZXJwb2xhdGlvblwiO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwudXBkYXRlTWFwQ29uZmlnKCBcIm1vZGVcIiwgbW9kZSwgZmFsc2UsIFwiY2hhbmdlLW1hcFwiICk7XG5cdFx0XHR0aGlzLnJlbmRlcigpO1xuXHRcdH1cblxuXHR9KTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5DaGFydC5NYXAuTWFwQ29udHJvbHM7XG5cbn0pKCk7Il19
