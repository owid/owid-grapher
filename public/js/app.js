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

	var Main = require( "./views/App.Views.Main.js" ),
		ChartDataModel = require( "./models/App.Models.ChartDataModel.js" );

	//setup models
	//is new chart or display old chart
	var $chartShowWrapper = $( ".chart-show-wrapper, .chart-edit-wrapper" ),
		chartId = $chartShowWrapper.attr( "data-chart-id" );

	//setup views
	App.View = new Main();

	if( $chartShowWrapper.length && chartId ) {
		
		//showing existing chart
		App.ChartModel = new App.Models.ChartModel( { id: chartId } );
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
		App.ChartModel = new App.Models.ChartModel();
		App.View.start();

	}

	
	

})();
},{"./models/App.Models.ChartDataModel.js":3,"./views/App.Views.Main.js":8}],3:[function(require,module,exports){
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
},{"./../App.Utils.js":1,"./../models/App.Models.ChartDataModel.js":3,"./chart/App.Views.Chart.ChartTab.js":9,"./chart/App.Views.Chart.DataTab.js":10,"./chart/App.Views.Chart.Header.js":11,"./chart/App.Views.Chart.MapTab.js":13,"./chart/App.Views.Chart.ScaleSelectors":14,"./chart/App.Views.Chart.SourcesTab.js":15}],6:[function(require,module,exports){
;( function() {
	
	"use strict";

	App.Views.FormView = Backbone.View.extend({

		el: "#form-view",
		events: {
			"click .form-collapse-btn": "onFormCollapse",
			"change input[name=chart-name]": "onNameChange",
			"change textarea[name=chart-subname]": "onSubnameChange",
			"click .remove-uploaded-file-btn": "onRemoveUploadedFile",
			"submit form": "onFormSubmit",
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			
			var formConfig = App.ChartModel.get( "form-config" );

			//create related models, either empty (when creating new chart), or prefilled from db (when editing existing chart)
			if( formConfig && formConfig[ "variables-collection" ] ) {
				App.ChartVariablesCollection = new App.Collections.ChartVariablesCollection( formConfig[ "variables-collection" ] );
			} else {
				App.ChartVariablesCollection = new App.Collections.ChartVariablesCollection();
			}
			if( formConfig && formConfig[ "entities-collection" ] ) {
				App.AvailableEntitiesCollection = new App.Collections.AvailableEntitiesCollection( formConfig[ "entities-collection" ] );
			} else {
				App.AvailableEntitiesCollection = new App.Collections.AvailableEntitiesCollection();
			}
			if( formConfig && formConfig[ "dimensions" ] ) {
				App.ChartDimensionsModel = new App.Models.ChartDimensionsModel();
				//App.ChartDimensionsModel = new App.Models.ChartDimensionsModel( formConfig[ "dimensions" ] );
			} else {
				App.ChartDimensionsModel = new App.Models.ChartDimensionsModel();
			}
			if( formConfig && formConfig[ "available-time" ] ) {
				App.AvailableTimeModel = new App.Models.AvailableTimeModel(formConfig[ "available-time" ]);
			} else {
				App.AvailableTimeModel = new App.Models.AvailableTimeModel();
			}

			//create search collection
			App.SearchDataCollection = new App.Collections.SearchDataCollection();
			
			//is it new or existing chart
			if( formConfig && formConfig[ "dimensions" ] ) {
				//existing chart, need to load fresh dimensions from database (in case we've added dimensions since creating chart)
				var that = this;
				App.ChartDimensionsModel.loadConfiguration( formConfig[ "dimensions" ].id );
				App.ChartDimensionsModel.on( "change", function() {
					that.render();
				} );
			} else {
				//new chart, can render straight away
				this.render();
			}
			
		},

		render: function() {
			
			//create subviews
			this.basicTabView = new App.Views.Form.BasicTabView( { dispatcher: this.dispatcher } );
			this.axisTabView = new App.Views.Form.AxisTabView( { dispatcher: this.dispatcher } );
			this.descriptionTabView = new App.Views.Form.DescriptionTabView( { dispatcher: this.dispatcher } );
			this.stylingTabView = new App.Views.Form.StylingTabView( { dispatcher: this.dispatcher } );
			this.exportTabView = new App.Views.Form.ExportTabView( { dispatcher: this.dispatcher } );
			this.mapTabView = new App.Views.Form.MapTabView( { dispatcher: this.dispatcher } );

			//fetch doms
			this.$removeUploadedFileBtn = this.$el.find( ".remove-uploaded-file-btn" );
			this.$filePicker = this.$el.find( ".file-picker-wrapper [type=file]" );

		},

		onNameChange: function( evt ) {

			var $input = $( evt.target );
			App.ChartModel.set( "chart-name", $input.val() );

		},

		onSubnameChange: function( evt ) {

			var $textarea = $( evt.target );
			App.ChartModel.set( "chart-subname", $textarea.val() );

		},

		onCsvSelected: function( err, data ) {

			if( err ) {
				console.error( err );
				return;
			}

			this.$removeUploadedFileBtn.show();

			if( data && data.rows ) {
				var mappedData = App.Utils.mapData( data.rows );
				App.ChartModel.set( "chart-data", mappedData );
			}

		},

		onRemoveUploadedFile: function( evt ) {

			this.$filePicker.replaceWith( this.$filePicker.clone() );
			//refetch dom
			this.$filePicker = this.$el.find( ".file-picker-wrapper [type=file]" );
			this.$filePicker.prop( "disabled", false);

			var that = this;
			CSV.begin( this.$filePicker.selector ).go( function( err, data ) {
					that.onCsvSelected( err, data );
			} );

			this.$removeUploadedFileBtn.hide();

		},


		onFormCollapse: function( evt ) {

			evt.preventDefault();
			var $parent = this.$el.parent();
			$parent.toggleClass( "form-panel-collapsed" );
			
			//trigger re-rendering of chart
			App.ChartModel.trigger( "change" );
			//also triger custom event so that map can resize
			App.ChartModel.trigger( "resize" );

		},

		onFormSubmit: function( evt ) {
			
			$.ajaxSetup( {
				headers: { 'X-CSRF-TOKEN': $('[name="_token"]').val() }
			} );

			evt.preventDefault();

			//put all changes to chart model
			var formConfig = {
				"variables-collection": App.ChartVariablesCollection.toJSON(),
				"entities-collection": App.AvailableEntitiesCollection.toJSON(),
				"dimensions": App.ChartDimensionsModel.toJSON(),
				"available-time": App.AvailableTimeModel.toJSON()
			};
			App.ChartModel.set( "form-config", formConfig, { silent: true } );

			var dispatcher = this.dispatcher;
			App.ChartModel.save( {}, {
				success: function ( model, response, options ) {
					alert( "The chart saved succesfully" );
					dispatcher.trigger( "chart-saved", response.data.id, response.data.viewUrl );
					//update id of an existing model
					App.ChartModel.set( "id", response.data.id );
				},
				error: function (model, xhr, options) {
					console.error("Something went wrong while saving the model", xhr );
					alert( "Opps, there was a problem saving your chart." );
				}
			});

		}

	});

	module.exports = App.Views.FormView;

})();
},{}],7:[function(require,module,exports){
;( function() {
	
	"use strict";

	App.Views.ImportView = Backbone.View.extend({

		datasetName: "",
		isDataMultiVariant: false,
		origUploadedData: false,
		uploadedData: false,
		variableNameManual: false,

		el: "#import-view",
		events: {
			"submit form": "onFormSubmit",
			"input [name=new_dataset_name]": "onNewDatasetNameChange",
			"change [name=new_dataset]": "onNewDatasetChange",
			"click .remove-uploaded-file-btn": "onRemoveUploadedFile",
			"change [name=category_id]": "onCategoryChange",
			"change [name=existing_dataset_id]": "onExistingDatasetChange",
			"change [name=datasource_id]": "onDatasourceChange",
			"change [name=existing_variable_id]": "onExistingVariableChange",
			"change [name=subcategory_id]": "onSubCategoryChange",
			"change [name=multivariant_dataset]": "onMultivariantDatasetChange",
			"click .new-dataset-description-btn": "onDatasetDescription"
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			this.render();
			this.initUpload();

			/*var importer = new App.Models.Importer();
			importer.uploadFormData();*/

		},

		render: function() {

			//sections
			this.$datasetSection = this.$el.find( ".dataset-section" );
			this.$datasetTypeSection = this.$el.find( ".dataset-type-section" );
			this.$uploadSection = this.$el.find( ".upload-section" );
			this.$variableSection = this.$el.find( ".variables-section" );
			this.$categorySection = this.$el.find( ".category-section" );
			this.$variableTypeSection = this.$el.find( ".variable-type-section" );
				
			//random els
			this.$newDatasetDescription = this.$el.find( "[name=new_dataset_description]" );
			this.$existingDatasetSelect = this.$el.find( "[name=existing_dataset_id]" );
			this.$existingVariablesWrapper = this.$el.find( ".existing-variable-wrapper" );
			this.$existingVariablesSelect = this.$el.find( "[name=existing_variable_id]" );
			this.$variableSectionList = this.$variableSection.find( "ol" );

			//import section
			this.$filePicker = this.$el.find( ".file-picker-wrapper [type=file]" );
			this.$dataInput = this.$el.find( "[name=data]" );
			
			this.$csvImportResult = this.$el.find( ".csv-import-result" );
			this.$csvImportTableWrapper = this.$el.find( "#csv-import-table-wrapper" );
			
			this.$newDatasetSection = this.$el.find( ".new-dataset-section" );
			this.$existingDatasetSection = this.$el.find( ".existing-dataset-section" );
			this.$removeUploadedFileBtn = this.$el.find( ".remove-uploaded-file-btn" );

			//datasource section
			this.$newDatasourceWrapper = this.$el.find( ".new-datasource-wrapper" );
			this.$sourceDescription = this.$el.find( "[name=source_description]" );

			//category section
			this.$categorySelect = this.$el.find( "[name=category_id]" );
			this.$subcategorySelect = this.$el.find( "[name=subcategory_id]" );

			//hide optional elements
			this.$newDatasetDescription.hide();
			//this.$variableSection.hide();

		},

		initUpload: function() {

			var that = this;
			this.$filePicker.on( "change", function( i, v ) {

				var $this = $( this );
				$this.parse( {
					config: {
						complete: function( obj ) {
							var data = { rows: obj.data };
							that.onCsvSelected( null, data );
						}
					}
				} );

			} );

			/*CSV.begin( this.$filePicker.selector )
				//.table( "csv-import-table-wrapper", { header:1, caption: "" } )
				.go( function( err, data ) {
					that.onCsvSelected( err, data );
				} );
			this.$removeUploadedFileBtn.hide();*/

		},

		onCsvSelected: function( err, data ) {
			
			if( !data ) {
				return;
			}
			
			//testing massive import version 			
			/*this.uploadedData = data;
			//store also original, this.uploadedData will be modified when being validated
			this.origUploadedData = $.extend( true, {}, this.uploadedData);

			this.createDataTable( data.rows );
			
			this.validateEntityData( data.rows );
			this.validateTimeData( data.rows );
			
			this.mapData();*/

			//normal version

			//do we need to transpose data?
			if( !this.isDataMultiVariant ) {
				var isOriented = this.detectOrientation( data.rows );
				if( !isOriented ) {
					data.rows = App.Utils.transpose( data.rows );
				}
			}
			
			this.uploadedData = data;
			//store also original, this.uploadedData will be modified when being validated
			this.origUploadedData = $.extend( true, {}, this.uploadedData);
			
			this.createDataTable( data.rows );

			this.validateEntityData( data.rows );
			this.validateTimeData( data.rows );

			this.mapData();

		},

		detectOrientation: function( data ) {

			var isOriented = true;

			//first row, second cell, should be number (time)
			if( data.length > 0 && data[0].length > 0 ) {
				var secondCell = data[ 0 ][ 1 ];
				if( isNaN( secondCell ) ) {
					isOriented = false;
				}
			}

			return isOriented;

		},

		createDataTable: function( data ) {

			var tableString = "<table>";

			_.each( data, function( rowData, rowIndex ) {

				var tr = "<tr>";
				_.each( rowData, function( cellData, cellIndex ) {
					//if(cellData) {
						var td = (rowIndex > 0)? "<td>" + cellData + "</td>": "<th>" + cellData + "</th>";
						tr += td;
					//}
				} );
				tr += "</tr>";
				tableString += tr;

			} );

			tableString += "</table>";

			var $table = $( tableString );
			this.$csvImportTableWrapper.append( $table );

		},

		updateVariableList: function( data ) {

			var $list = this.$variableSectionList;
			$list.empty();
			
			var that = this;
			if( data && data.variables ) {
				_.each( data.variables, function( v, k ) {
					
					//if we're creating new variables injects into data object existing variables
					if( that.existingVariable && that.existingVariable.attr( "data-id" ) > 0 ) {
						v.id = that.existingVariable.attr( "data-id" );
						v.name = that.existingVariable.attr( "data-name" );
						v.unit = that.existingVariable.attr( "data-unit" );
						v.description = that.existingVariable.attr( "data-description" );
					}
					var $li = that.createVariableEl( v );
					$list.append( $li );
				
				} );
			}

		},

		createVariableEl: function( data ) {

			if( !data.unit ) {
				data.unit = "";
			}
			if( !data.description ) {
				data.description = "";
			}

			var stringified = JSON.stringify( data );
			//weird behaviour when single quote inserted into hidden input
			stringified = stringified.replace( "'", "&#x00027;" );
			stringified = stringified.replace( "'", "&#x00027;" );
			
			var $li = $( "<li class='variable-item clearfix'></li>" ),
				$inputName = $( "<label>Name*<input class='form-control' value='" + data.name + "' placeholder='Enter variable name'/></label>" ),
				$inputUnit = $( "<label>Unit<input class='form-control' value='" + data.unit + "' placeholder='Enter variable unit' /></label>" ),
				$inputDescription = $( "<label>Description<input class='form-control' value='" + data.description + "' placeholder='Enter variable description' /></label>" ),
				$inputData = $( "<input type='hidden' name='variables[]' value='" + stringified + "' />" );
			
			$li.append( $inputName );
			$li.append( $inputUnit );
			$li.append( $inputDescription );
			$li.append( $inputData );
				
			var that = this,
				$inputs = $li.find( "input" );
			$inputs.on( "input", function( evt ) {
				//update stored json
				var json = $.parseJSON( $inputData.val() );
				json.name = $inputName.find( "input" ).val();
				json.unit = $inputUnit.find( "input" ).val();
				json.description = $inputDescription.find( "input" ).val();
				$inputData.val( JSON.stringify( json ) );
			} );
			$inputs.on( "focus", function( evt ) {
				//set flag so that values in input won't get overwritten by changes to dataset name
				that.variableNameManual = true;
			});

			return $li;

		},

		mapData: function() {

			
			//massive import version
			//var mappedData = App.Utils.mapPanelData( this.uploadedData.rows ),
			var mappedData = ( !this.isDataMultiVariant )?  App.Utils.mapSingleVariantData( this.uploadedData.rows, this.datasetName ): App.Utils.mapMultiVariantData( this.uploadedData.rows ),
				json = { "variables": mappedData },
				jsonString = JSON.stringify( json );

			this.$dataInput.val( jsonString );
			this.$removeUploadedFileBtn.show();

			this.updateVariableList( json );

		},

		validateEntityData: function( data ) {

			/*if( this.isDataMultiVariant ) {
				return true;
			}*/

			//validateEntityData doesn't modify the original data
			var $dataTableWrapper = $( ".csv-import-table-wrapper" ),
				$dataTable = $dataTableWrapper.find( "table" ),
				$entitiesCells = $dataTable.find( "td:first-child" ),
				//$entitiesCells = $dataTable.find( "th" ),
				entities = _.map( $entitiesCells, function( v ) { return $( v ).text(); } );

			//make sure we're not validating one entity multiple times
			entities = _.uniq( entities );
			
			//get rid of first one (time label)
			//entities.shift();

			$.ajax( {
				url: Global.rootUrl + "/entityIsoNames/validateData",
				data: { "entities": JSON.stringify( entities ) },
				beforeSend: function() {
					$dataTableWrapper.before( "<p class='entities-loading-notice loading-notice'>Validating entities</p>" );
				},
				success: function( response ) {
					if( response.data ) {
							
						var unmatched = response.data;
						$entitiesCells.removeClass( "alert-error" );
						$.each( $entitiesCells, function( i, v ) {
							var $entityCell = $( this ),
								value = $entityCell.text();
								$entityCell.removeClass( "alert-error" );
								$entityCell.addClass( "alert-success" );
							if( _.indexOf( unmatched, value ) > -1 ) {
								$entityCell.addClass( "alert-error" );
								$entityCell.removeClass( "alert-success" );
							}
						} );

						//remove preloader
						$( ".entities-loading-notice" ).remove();
						//result notice
						$( ".entities-validation-wrapper" ).remove();
						var $resultNotice = (unmatched.length)? $( "<div class='entities-validation-wrapper'><p class='entities-validation-result validation-result text-danger'><i class='fa fa-exclamation-circle'></i>Some countries do not have <a href='http://en.wikipedia.org/wiki/ISO_3166' target='_blank'>standardized name</a>! Rename the highlighted countries and reupload CSV.</p><label><input type='checkbox' name='validate_entities'/>Import countries anyway</label></div>" ): $( "<p class='entities-validation-result validation-result text-success'><i class='fa fa-check-circle'></i>All countries have standardized name, well done!</p>" );
						$dataTableWrapper.before( $resultNotice );

					}
				}
			} );
			
		},

		validateTimeData: function( data ) {

			var $dataTableWrapper = $( ".csv-import-table-wrapper" ),
				$dataTable = $dataTableWrapper.find( "table" ),
				//massive import version
				//timeDomain = $dataTable.find( "th:nth-child(2)" ).text(),
				timeDomain = ( !this.isDataMultiVariant )? $dataTable.find( "th:first-child" ).text(): $dataTable.find( "th:nth-child(2)" ).text(),
				$timesCells = ( !this.isDataMultiVariant )? $dataTable.find( "th" ): $dataTable.find( "td:nth-child(2)" );/*,
				//massive import version
				//$timesCells = $dataTable.find( "td:nth-child(2)" );/*,
				times = _.map( $timesCells, function( v ) { return $( v ).text() } );*/
			//format time domain maybe
			if( timeDomain ) {
				timeDomain = timeDomain.toLowerCase();
			}
			
			//the first cell (timeDomain) shouldn't be validated
			//massive import version - commented out next row
			if( !this.isDataMultiVariant ) {
				$timesCells = $timesCells.slice( 1 );
			}
			
			//make sure time is from given domain
			if( _.indexOf( [ "century", "decade", "quarter century", "half century", "year" ], timeDomain ) == -1 ) {
				var $resultNotice = $( "<p class='time-domain-validation-result validation-result text-danger'><i class='fa fa-exclamation-circle'></i>First top-left cell should contain time domain infomartion. Either 'century', or'decade', or 'year'.</p>" );
				$dataTableWrapper.before( $resultNotice );
			}
			
			var that = this;
			$.each( $timesCells, function( i, v ) {

				var $timeCell = $( v );
				
				//find corresponding value in loaded data
				var newValue,
					//massive import version
					//origValue = data[ i+1 ][ 1 ];
					origValue = ( !that.isDataMultiVariant )? data[ 0 ][ i+1 ]: data[ i+1 ][ 1 ];
				
				//check value has 4 digits
				origValue = App.Utils.addZeros( origValue );

				var value = origValue,
					date = moment( new Date( value ) );
				
				if( !date.isValid() ) {

					$timeCell.addClass( "alert-error" );
					$timeCell.removeClass( "alert-success" );
				
				} else {
					
					//correct date
					$timeCell.addClass( "alert-success" );
					$timeCell.removeClass( "alert-error" );
					//insert potentially modified value into cell
					$timeCell.text( value );

					newValue = { "d": App.Utils.roundTime( date ), "l": origValue };

					if( timeDomain == "year" ) {
						
						//try to guess century
						var year = Math.floor( origValue ),
							nextYear = year + 1;

						//add zeros
						year = App.Utils.addZeros( year );
						nextYear = App.Utils.addZeros( nextYear );
						
						//convert it to datetime values
						year = moment( new Date( year.toString() ) );
						nextYear = moment( new Date( nextYear.toString() ) ).seconds(-1);
						//modify the initial value
						newValue[ "sd" ] =  App.Utils.roundTime( year );
						newValue[ "ed" ] =  App.Utils.roundTime( nextYear );

					} else if( timeDomain == "decade" ) {
						
						//try to guess century
						var decade = Math.floor( origValue / 10 ) * 10,
							nextDecade = decade + 10;
						
						//add zeros
						decade = App.Utils.addZeros( decade );
						nextDecade = App.Utils.addZeros( nextDecade );

						//convert it to datetime values
						decade = moment( new Date( decade.toString() ) );
						nextDecade = moment( new Date( nextDecade.toString() ) ).seconds(-1);
						//modify the initial value
						newValue[ "sd" ] =  App.Utils.roundTime( decade );
						newValue[ "ed" ] =  App.Utils.roundTime( nextDecade );

					} else if( timeDomain == "quarter century" ) {
						
						//try to guess quarter century
						var century = Math.floor( origValue / 100 ) * 100,
							modulo = ( origValue % 100 ),
							quarterCentury;
						
						//which quarter is it
						if( modulo < 25 ) {
							quarterCentury = century;
						} else if( modulo < 50 ) {
							quarterCentury = century+25;
						} else if( modulo < 75 ) {
							quarterCentury = century+50;
						} else {
							quarterCentury = century+75;
						}
							
						var nextQuarterCentury = quarterCentury + 25;

						//add zeros
						quarterCentury = App.Utils.addZeros( quarterCentury );
						nextQuarterCentury = App.Utils.addZeros( nextQuarterCentury );

						//convert it to datetime values
						quarterCentury = moment( new Date( quarterCentury.toString() ) );
						nextQuarterCentury = moment( new Date( nextQuarterCentury.toString() ) ).seconds(-1);
						//modify the initial value
						newValue[ "sd" ] =  App.Utils.roundTime( quarterCentury );
						newValue[ "ed" ] =  App.Utils.roundTime( nextQuarterCentury );

					} else if( timeDomain == "half century" ) {
						
						//try to guess half century
						var century = Math.floor( origValue / 100 ) * 100,
							//is it first or second half?
							halfCentury = ( origValue % 100 < 50 )? century: century+50,
							nextHalfCentury = halfCentury + 50;

						//add zeros
						halfCentury = App.Utils.addZeros( halfCentury );
						nextHalfCentury = App.Utils.addZeros( nextHalfCentury );

						//convert it to datetime values
						halfCentury = moment( new Date( halfCentury.toString() ) );
						nextHalfCentury = moment( new Date( nextHalfCentury.toString() ) ).seconds(-1);
						//modify the initial value
						newValue[ "sd" ] =  App.Utils.roundTime( halfCentury );
						newValue[ "ed" ] =  App.Utils.roundTime( nextHalfCentury );

					} else if( timeDomain == "century" ) {
						
						//try to guess century
						var century = Math.floor( origValue / 100 ) * 100,
							nextCentury = century + 100;

						//add zeros
						century = App.Utils.addZeros( century );
						nextCentury = App.Utils.addZeros( nextCentury );

						//convert it to datetime values
						century = moment( new Date( century.toString() ) );
						nextCentury = moment( new Date( nextCentury.toString() ) ).seconds(-1);
						//modify the initial value
						newValue[ "sd" ] = App.Utils.roundTime( century );
						newValue[ "ed" ] = App.Utils.roundTime( nextCentury );

					}

					//insert info about time domain
					newValue[ "td" ] = timeDomain;
					
					//initial was number/string so passed by value, need to insert it back to arreay
					if( !that.isDataMultiVariant ) {
						data[ 0 ][ i+1 ] = newValue;
					} else {
						data[ i+1 ][ 1 ] = newValue;
					}
					//massive import version
					//data[ i+1 ][ 1 ] = newValue;

				}

			});

			var $resultNotice;

			//remove any previously attached notifications
			$( ".times-validation-result" ).remove();

			if( $timesCells.filter( ".alert-error" ).length ) {
				
				$resultNotice = $( "<p class='times-validation-result validation-result text-danger'><i class='fa fa-exclamation-circle'></i>Time information in the uploaded file is not in <a href='http://en.wikipedia.org/wiki/ISO_8601' target='_blank'>standardized format (YYYY-MM-DD)</a>! Fix the highlighted time information and reupload CSV.</p>" );
			
			} else {

				$resultNotice = $( "<p class='times-validation-result validation-result text-success'><i class='fa fa-check-circle'></i>Time information in the uploaded file is correct, well done!</p>" );

			}
			$dataTableWrapper.before( $resultNotice );
			
		},

		onDatasetDescription: function( evt ) {

			var $btn = $( evt.currentTarget );
			
			if( this.$newDatasetDescription.is( ":visible" ) ) {
				this.$newDatasetDescription.hide();
				$btn.find( "span" ).text( "Add dataset description." );
				$btn.find( "i" ).removeClass( "fa-minus" );
				$btn.find( "i" ).addClass( "fa-plus" );
			} else {
				this.$newDatasetDescription.show();
				$btn.find( "span" ).text( "Nevermind, no description." );
				$btn.find( "i" ).addClass( "fa-minus" );
				$btn.find( "i" ).removeClass( "fa-plus" );
			}

		},

		onNewDatasetChange: function( evt ) {

			var $input = $( evt.currentTarget );
			if( $input.val() === "0" ) {
				this.$newDatasetSection.hide();
				this.$existingDatasetSection.show();
				//should we appear variable select as well?
				if( !this.$existingDatasetSelect.val() ) {
					this.$existingVariablesWrapper.hide();
				} else {
					this.$existingVariablesWrapper.show();
				}
			} else {
				this.$newDatasetSection.show();
				this.$existingDatasetSection.hide();
			}

		},

		onNewDatasetNameChange: function( evt ) {

			var $input = $( evt.currentTarget );
			this.datasetName = $input.val();

			//check if we have value for variable, enter if not
			var $variableItems = this.$variableSectionList.find( ".variable-item" );
			if( $variableItems.length == 1 && !this.variableNameManual ) {
				//we have just one, check 
				var $variableItem = $variableItems.eq( 0 ),
					$firstInput = $variableItem.find( "input" ).first();
				$firstInput.val( this.datasetName );
				$firstInput.trigger( "input" );
			}

		},

		onExistingDatasetChange: function( evt ) {

			var $input = $( evt.currentTarget );
			this.datasetName = $input.find( 'option:selected' ).text();

			if( $input.val() ) {
				//filter variable select to show variables only from given dataset
				var $options = this.$existingVariablesSelect.find( "option" );
				$options.hide();
				$options.filter( "[data-dataset-id=" + $input.val() + "]" ).show();
				//appear also the first default
				$options.first().show();
				this.$existingVariablesWrapper.show();
			} else {
				this.$existingVariablesWrapper.hide();
			}

		},

		onExistingVariableChange: function( evt ) {

			var $input = $( evt.currentTarget );
			this.existingVariable = $input.find( 'option:selected' );
	
		},

		onRemoveUploadedFile: function( evt ) {

			this.$filePicker.replaceWith( this.$filePicker.clone() );
			//refetch dom
			this.$filePicker = this.$el.find( ".file-picker-wrapper [type=file]" );
			this.$filePicker.prop( "disabled", false);

			//reset related components
			this.$csvImportTableWrapper.empty();
			this.$dataInput.val("");
			//remove notifications
			this.$csvImportResult.find( ".validation-result" ).remove();

			this.initUpload();

		},

		onCategoryChange: function( evt ) {
			
			var $input = $( evt.currentTarget );
			if( $input.val() != "" ) {
				this.$subcategorySelect.show();
				this.$subcategorySelect.css( "display", "block" );
			} else {
				this.$subcategorySelect.hide();
			}

			//filter subcategories select
			this.$subcategorySelect.find( "option" ).hide();
			this.$subcategorySelect.find( "option[data-category-id=" + $input.val() + "]" ).show();

		},

		onDatasourceChange: function( evt ) {

			var $target = $( evt.currentTarget );
			if( $target.val() < 1 ) {
				this.$newDatasourceWrapper.slideDown();
			} else {
				this.$newDatasourceWrapper.slideUp();
			}

		},

		onSubCategoryChange: function( evt ) {
			
		},

		onMultivariantDatasetChange: function( evt ) {

			var $input = $( evt.currentTarget );
			if( $input.val() === "1" ) {
				this.isDataMultiVariant = true;
				//$( ".validation-result" ).remove();
				//$( ".entities-validation-wrapper" ).remove();
			} else {
				this.isDataMultiVariant = false;
			}

			if( this.uploadedData && this.origUploadedData ) {

				//insert original uploadedData into array before processing
				this.uploadedData = $.extend( true, {}, this.origUploadedData);
				//re-validate
				this.validateEntityData( this.uploadedData.rows );
				this.validateTimeData( this.uploadedData.rows );
				this.mapData();

			}
			
		},

		onFormSubmit: function( evt ) {

			evt.preventDefault();

			var $validateEntitiesCheckbox = $( "[name='validate_entities']" ),
				validateEntities = ( $validateEntitiesCheckbox.is( ":checked" ) )? false: true,
				$validationResults = [];

			//display validation results
			//validate entered datasources
			var $sourceDescription = $( "[name='source_description']" ),
				sourceDescriptionValue = $sourceDescription.val(),
				hasValidSource = true;
			if( sourceDescriptionValue.search( "<td>e.g." ) > -1 || sourceDescriptionValue.search( "<p>e.g." ) > -1 ) {
				hasValidSource = false;
			}
			var $sourceValidationNotice = $( ".source-validation-result" );
			if( !hasValidSource ) {
				//invalid
				if( !$sourceValidationNotice.length ) {
					//doens't have notice yet
					$sourceValidationNotice = $( "<p class='source-validation-result validation-result text-danger'><i class='fa fa-exclamation-circle'> Please replace the sample data with real datasource info.</p>" );
					$sourceDescription.before( $sourceValidationNotice );
				} else {
					$sourceValidationNotice.show();
				}
			} else {
				//valid, make sure there's not 
				$sourceValidationNotice.remove();
			}

			//category validation
			var $categoryValidationNotice = $( ".category-validation-result" );
			if( !this.$categorySelect.val() || !this.$subcategorySelect.val() ) {
				if( !$categoryValidationNotice.length ) {
					$categoryValidationNotice = $( "<p class='category-validation-result validation-result text-danger'><i class='fa fa-exclamation-circle'> Please choose category for uploaded data.</p>" );
					this.$categorySelect.before( $categoryValidationNotice );
				} {
					$categoryValidationNotice.show();
				}
			} else {
				//valid, make sure to remove
				$categoryValidationNotice.remove();
			}

			//different scenarios of validation
			if( validateEntities ) {
				//validate both time and entitiye
				$validationResults = $( ".validation-result.text-danger" );
			} else if( !validateEntities ) {
				//validate only time
				$validationResults = $( ".time-domain-validation-result.text-danger, .times-validation-result.text-danger, .source-validation-result, .category-validation-result" );
			} else {
				//do not validate
			}
			
			console.log( "validationResults.length", $validationResults.length );

			if( $validationResults.length ) {
				//do not send form and scroll to error message
				evt.preventDefault();
				$('html, body').animate({
					scrollTop: $validationResults.offset().top - 18
				}, 300);
				return false;
			}
			
			//evt 
			var $btn = $( "[type=submit]" );
			$btn.prop( "disabled", true );
			$btn.css( "opacity", 0.5 );

			$btn.after( "<p class='send-notification'><i class='fa fa-spinner fa-spin'></i>Sending form</p>" );

			//serialize array
			var $form = $( "#import-view > form" );
			
			var importer = new App.Models.Importer( { dispatcher: this.dispatcher } );
			importer.uploadFormData( $form, this.origUploadedData );

			var importProgress = new App.Views.UI.ImportProgressPopup();
			importProgress.init( { dispatcher: this.dispatcher } );
			importProgress.show();

			return false;


		}


	});

	module.exports = App.Views.ImportView;

})();
},{}],8:[function(require,module,exports){
;( function() {
	
	"use strict";

	var ChartModel = require( "./../models/App.Models.ChartModel.js" ),
		FormView = require( "./App.Views.FormView.js" ),
		ChartView = require( "./App.Views.ChartView.js" ),
		ImportView = require( "./App.Views.ImportView.js" ),
		VariableSelects = require( "./ui/App.Views.UI.VariableSelects.js" ),
		Utils = require( "./../App.Utils.js" );

	App.Views.Main = Backbone.View.extend({

		events: {},

		initialize: function() {
			this.$win = $( window );
			this.$win.on( "resize", this.onResize );
			this.onResize();
		},

		start: function() {
			//render everything for the first time
			this.render();
		},

		render: function() {
			
			var dispatcher = _.clone( Backbone.Events );
			this.dispatcher = dispatcher;

			/*if( FormView ) {
				this.formView = new FormView( { dispatcher: dispatcher } );
			}*/
			if( ChartView ) {
				this.chartView = new ChartView( { dispatcher: dispatcher } );
			}
			/*if( ImportView ) {
				this.importView = new ImportView( {dispatcher: dispatcher } );
			}*/

			//variable select
			if( VariableSelects ) {
				var variableSelects = new VariableSelects();
				variableSelects.init();
			}

			//validate 
			var $validateForms = $( ".validate-form" );
			if( $validateForms.length ) {

				$validateForms.on( "submit", function( evt ) {
					var $form = $( evt.currentTarget ),
						valid = Utils.FormHelper.validate( $form );
					if( !valid ) {
						evt.preventDefault();
						evt.stopImmediatePropagation();
					}
				} );
			}

			//delete buttons
			$( ".delete-btn, .btn-danger" ).on( "click", function( evt ) {

				var confirm = window.confirm( "Are you sure?" );
				if( !confirm ) {
					evt.preventDefault();
				}

			});

			//chosen select
			$( ".chosen-select" ).chosen();
			
		},

		onResize: function() {

		}

	});

	module.exports = App.Views.Main;

})();

},{"./../App.Utils.js":1,"./../models/App.Models.ChartModel.js":4,"./App.Views.ChartView.js":5,"./App.Views.FormView.js":6,"./App.Views.ImportView.js":7,"./ui/App.Views.UI.VariableSelects.js":17}],9:[function(require,module,exports){
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
},{"./App.Views.Chart.Legend.js":12}],10:[function(require,module,exports){
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
},{}],11:[function(require,module,exports){
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
},{}],12:[function(require,module,exports){
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
},{}],13:[function(require,module,exports){
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
},{"./map/App.Views.Chart.Map.MapControls.js":16}],14:[function(require,module,exports){
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

},{}],15:[function(require,module,exports){
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
},{}],16:[function(require,module,exports){
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
},{}],17:[function(require,module,exports){
;( function() {

	"use strict";

	var that;

	App.Views.UI.VariableSelects = function() {

		that = this;
		this.$div = null;

	};

	App.Views.UI.VariableSelects.prototype = {

		init: function() {

			this.$el = $( ".form-variable-select-wrapper" );
			this.$categoryWrapper = this.$el.find( ".category-wrapper" );
			this.$categorySelect = this.$el.find( "[name=category-id]" );
			this.$subcategoryWrapper = this.$el.find( ".subcategory-wrapper" );
			this.$subcategorySelect = this.$el.find( "[name=subcategory-id]" );
			this.$variableWrapper = this.$el.find( ".variable-wrapper" );
			this.$chartVariable = this.$el.find( "[name=chart-variable]" );
			
			this.$categorySelect.on( "change", $.proxy( this.onCategoryChange, this ) );
			this.$subcategorySelect.on( "change", $.proxy( this.onSubCategoryChange, this ) );

			this.$subcategoryWrapper.hide();
			this.$variableWrapper.hide();

		},

		onCategoryChange: function( evt ) {
			
			var $input = $( evt.currentTarget );
			if( $input.val() != "" ) {
				this.$subcategoryWrapper.show();
			} else {
				this.$subcategoryWrapper.hide();
				this.$variableWrapper.hide();
			}

			//filter subcategories select
			this.$subcategorySelect.find( "option" ).hide();
			this.$subcategorySelect.find( "option[data-category-id=" + $input.val() + "]" ).show();

		},

		onSubCategoryChange: function( evt ) {

			var $input = $( evt.currentTarget );
			if( $input.val() != "" ) {
				this.$variableWrapper.show();
			} else {
				this.$variableWrapper.hide();
			}
			
			//filter subcategories select
			this.$chartVariable.find( "option:not(:disabled)" ).hide();
			this.$chartVariable.find( "option[data-subcategory-id=" + $input.val() + "]" ).show();

		}

	};

	module.exports = App.Views.UI.VariableSelects;

})();

},{}]},{},[2])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9sYXJhdmVsLWVsaXhpci1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC9BcHAuVXRpbHMuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC9BcHAuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC9tb2RlbHMvQXBwLk1vZGVscy5DaGFydERhdGFNb2RlbC5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL21vZGVscy9BcHAuTW9kZWxzLkNoYXJ0TW9kZWwuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy9BcHAuVmlld3MuQ2hhcnRWaWV3LmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvQXBwLlZpZXdzLkZvcm1WaWV3LmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvQXBwLlZpZXdzLkltcG9ydFZpZXcuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy9BcHAuVmlld3MuTWFpbi5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL2NoYXJ0L0FwcC5WaWV3cy5DaGFydC5DaGFydFRhYi5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL2NoYXJ0L0FwcC5WaWV3cy5DaGFydC5EYXRhVGFiLmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvY2hhcnQvQXBwLlZpZXdzLkNoYXJ0LkhlYWRlci5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL2NoYXJ0L0FwcC5WaWV3cy5DaGFydC5MZWdlbmQuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy9jaGFydC9BcHAuVmlld3MuQ2hhcnQuTWFwVGFiLmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvY2hhcnQvQXBwLlZpZXdzLkNoYXJ0LlNjYWxlU2VsZWN0b3JzLmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvY2hhcnQvQXBwLlZpZXdzLkNoYXJ0LlNvdXJjZXNUYWIuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy9jaGFydC9tYXAvQXBwLlZpZXdzLkNoYXJ0Lk1hcC5NYXBDb250cm9scy5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL3VpL0FwcC5WaWV3cy5VSS5WYXJpYWJsZVNlbGVjdHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbnNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDck1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOWFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0tBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDandCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyV0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiOyggZnVuY3Rpb24oKSB7XG5cblx0XCJ1c2Ugc3RyaWN0XCI7XG5cdFxuXHRBcHAuVXRpbHMubWFwRGF0YSA9IGZ1bmN0aW9uKCByYXdEYXRhLCB0cmFuc3Bvc2VkICkge1xuXG5cdFx0dmFyIGRhdGEgPSBbXSxcblx0XHRcdGRhdGFCeUlkID0gW10sXG5cdFx0XHRjb3VudHJ5SW5kZXggPSAxO1xuXG5cdFx0Ly9kbyB3ZSBoYXZlIGVudGl0aWVzIGluIHJvd3MgYW5kIHRpbWVzIGluIGNvbHVtbnM/XHRcblx0XHRpZiggIXRyYW5zcG9zZWQgKSB7XG5cdFx0XHQvL25vLCB3ZSBoYXZlIHRvIHN3aXRjaCByb3dzIGFuZCBjb2x1bW5zXG5cdFx0XHRyYXdEYXRhID0gQXBwLlV0aWxzLnRyYW5zcG9zZSggcmF3RGF0YSApO1xuXHRcdH1cblx0XHRcblx0XHQvL2V4dHJhY3QgdGltZSBjb2x1bW5cblx0XHR2YXIgdGltZUFyciA9IHJhd0RhdGEuc2hpZnQoKTtcblx0XHQvL2dldCByaWQgb2YgZmlyc3QgaXRlbSAobGFiZWwgb2YgdGltZSBjb2x1bW4pIFxuXHRcdHRpbWVBcnIuc2hpZnQoKTtcblx0XG5cdFx0Zm9yKCB2YXIgaSA9IDAsIGxlbiA9IHJhd0RhdGEubGVuZ3RoOyBpIDwgbGVuOyBpKysgKSB7XG5cblx0XHRcdHZhciBzaW5nbGVSb3cgPSByYXdEYXRhWyBpIF0sXG5cdFx0XHRcdGNvbE5hbWUgPSBzaW5nbGVSb3cuc2hpZnQoKTtcblx0XHRcdFx0XG5cdFx0XHQvL29tbWl0IHJvd3Mgd2l0aCBubyBjb2xObWFlXG5cdFx0XHRpZiggY29sTmFtZSApIHtcblx0XHRcdFx0dmFyIHNpbmdsZURhdGEgPSBbXTtcblx0XHRcdFx0Xy5lYWNoKCBzaW5nbGVSb3csIGZ1bmN0aW9uKCB2YWx1ZSwgaSApIHtcblx0XHRcdFx0XHQvL2NoZWNrIHdlIGhhdmUgdmFsdWVcblx0XHRcdFx0XHRpZiggdmFsdWUgIT09IFwiXCIgKSB7XG5cdFx0XHRcdFx0XHRzaW5nbGVEYXRhLnB1c2goIHsgeDogdGltZUFycltpXSwgeTogKCAhaXNOYU4oIHZhbHVlICkgKT8gK3ZhbHVlOiB2YWx1ZSB9ICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9ICk7XG5cblx0XHRcdFx0Ly9jb25zdHJ1Y3QgZW50aXR5IG9ialxuXHRcdFx0XHR2YXJcdGVudGl0eU9iaiA9IHtcblx0XHRcdFx0XHRpZDogaSxcblx0XHRcdFx0XHRrZXk6IGNvbE5hbWUsXG5cdFx0XHRcdFx0dmFsdWVzOiBzaW5nbGVEYXRhXG5cdFx0XHRcdH07XG5cdFx0XHRcdGRhdGEucHVzaCggZW50aXR5T2JqICk7XG5cdFx0XHR9XG5cblx0XHR9XG5cblx0XHRyZXR1cm4gZGF0YTtcblxuXHR9LFxuXG5cdEFwcC5VdGlscy5tYXBTaW5nbGVWYXJpYW50RGF0YSA9IGZ1bmN0aW9uKCByYXdEYXRhLCB2YXJpYWJsZU5hbWUgKSB7XG5cblx0XHR2YXIgdmFyaWFibGUgPSB7XG5cdFx0XHRuYW1lOiB2YXJpYWJsZU5hbWUsXG5cdFx0XHR2YWx1ZXM6IEFwcC5VdGlscy5tYXBEYXRhKCByYXdEYXRhLCB0cnVlIClcblx0XHR9O1xuXHRcdHJldHVybiBbdmFyaWFibGVdO1xuXG5cdH0sXG5cblx0LypBcHAuVXRpbHMubWFwTXVsdGlWYXJpYW50RGF0YSA9IGZ1bmN0aW9uKCByYXdEYXRhLCBlbnRpdHlOYW1lICkge1xuXHRcdFxuXHRcdC8vdHJhbnNmb3JtIG11bHRpdmFyaWFudCBpbnRvIHN0YW5kYXJkIGZvcm1hdCAoIHRpbWUsIGVudGl0eSApXG5cdFx0dmFyIHZhcmlhYmxlcyA9IFtdLFxuXHRcdFx0dHJhbnNwb3NlZCA9IHJhd0RhdGEsLy9BcHAuVXRpbHMudHJhbnNwb3NlKCByYXdEYXRhICksXG5cdFx0XHR0aW1lQXJyID0gdHJhbnNwb3NlZC5zaGlmdCgpO1xuXG5cdFx0Ly9nZXQgcmlkIG9mIGZpcnN0IGl0ZW0gKGxhYmVsIG9mIHRpbWUgY29sdW1uKSBcblx0XHQvL3RpbWVBcnIuc2hpZnQoKTtcblx0XHRcblx0XHRfLmVhY2goIHRyYW5zcG9zZWQsIGZ1bmN0aW9uKCB2YWx1ZXMsIGtleSwgbGlzdCApIHtcblxuXHRcdFx0Ly9nZXQgdmFyaWFibGUgbmFtZSBmcm9tIGZpcnN0IGNlbGwgb2YgY29sdW1uc1xuXHRcdFx0dmFyIHZhcmlhYmxlTmFtZSA9IHZhbHVlcy5zaGlmdCgpO1xuXHRcdFx0Ly9hZGQgZW50aXR5IG5hbWUgYXMgZmlyc3QgY2VsbFxuXHRcdFx0dmFsdWVzLnVuc2hpZnQoIGVudGl0eU5hbWUgKTtcblx0XHRcdC8vY29uc3RydWN0IGFycmF5IGZvciBtYXBwaW5nLCBuZWVkIHRvIGRlZXAgY29weSB0aW1lQXJyXG5cdFx0XHR2YXIgbG9jYWxUaW1lQXJyID0gJC5leHRlbmQoIHRydWUsIFtdLCB0aW1lQXJyKTtcblx0XHRcdHZhciBkYXRhVG9NYXAgPSBbIGxvY2FsVGltZUFyciwgdmFsdWVzIF07XG5cdFx0XHQvL2NvbnN0cnVjdCBvYmplY3Rcblx0XHRcdHZhciB2YXJpYWJsZSA9IHtcblx0XHRcdFx0bmFtZTogdmFyaWFibGVOYW1lLFxuXHRcdFx0XHR2YWx1ZXM6IEFwcC5VdGlscy5tYXBEYXRhKCBkYXRhVG9NYXAsIHRydWUgKVxuXHRcdFx0fTtcblx0XHRcdHZhcmlhYmxlcy5wdXNoKCB2YXJpYWJsZSApO1xuXG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIHZhcmlhYmxlcztcblxuXHR9LCovXG5cblx0QXBwLlV0aWxzLm1hcE11bHRpVmFyaWFudERhdGEgPSBmdW5jdGlvbiggcmF3RGF0YSApIHtcblx0XHRcblx0XHR2YXIgdmFyaWFibGVzID0gW10sXG5cdFx0XHR0cmFuc3Bvc2VkID0gcmF3RGF0YSxcblx0XHRcdGhlYWRlckFyciA9IHRyYW5zcG9zZWQuc2hpZnQoKTtcblxuXHRcdC8vZ2V0IHJpZCBvZiBlbnRpdHkgYW5kIHllYXIgY29sdW1uIG5hbWVcblx0XHRoZWFkZXJBcnIgPSBoZWFkZXJBcnIuc2xpY2UoIDIgKTtcblxuXHRcdHZhciB2YXJQZXJSb3dEYXRhID0gQXBwLlV0aWxzLnRyYW5zcG9zZSggdHJhbnNwb3NlZCApLFxuXHRcdFx0ZW50aXRpZXNSb3cgPSB2YXJQZXJSb3dEYXRhLnNoaWZ0KCksXG5cdFx0XHR0aW1lc1JvdyA9IHZhclBlclJvd0RhdGEuc2hpZnQoKTtcblxuXHRcdF8uZWFjaCggdmFyUGVyUm93RGF0YSwgZnVuY3Rpb24oIHZhbHVlcywgdmFySW5kZXggKSB7XG5cdFx0XHRcblx0XHRcdHZhciBlbnRpdGllcyA9IHt9O1xuXHRcdFx0Ly9pdGVyYXRlIHRocm91Z2ggYWxsIHZhbHVlcyBmb3IgZ2l2ZW4gdmFyaWFibGVcblx0XHRcdF8uZWFjaCggdmFsdWVzLCBmdW5jdGlvbiggdmFsdWUsIGtleSApIHtcblx0XHRcdFx0dmFyIGVudGl0eSA9IGVudGl0aWVzUm93WyBrZXkgXSxcblx0XHRcdFx0XHR0aW1lID0gdGltZXNSb3dbIGtleSBdO1xuXHRcdFx0XHRpZiggZW50aXR5ICYmIHRpbWUgKSB7XG5cdFx0XHRcdFx0Ly9kbyBoYXZlIGFscmVhZHkgZW50aXR5IGRlZmluZWQ/XG5cdFx0XHRcdFx0aWYoICFlbnRpdGllc1sgZW50aXR5IF0gKSB7XG5cdFx0XHRcdFx0XHRlbnRpdGllc1sgZW50aXR5IF0gPSB7XG5cdFx0XHRcdFx0XHRcdGlkOiBrZXksXG5cdFx0XHRcdFx0XHRcdGtleTogZW50aXR5LFxuXHRcdFx0XHRcdFx0XHR2YWx1ZXM6IFtdXG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbnRpdGllc1sgZW50aXR5IF0udmFsdWVzLnB1c2goIHsgeDogdGltZSwgeTogKCAhaXNOYU4oIHZhbHVlICkgKT8gK3ZhbHVlOiB2YWx1ZSB9ICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblxuXHRcdFx0Ly9oYXZlIGRhdGEgZm9yIGFsbCBlbnRpdGllcywganVzdCBjb252ZXJ0IHRoZW0gdG8gYXJyYXlcblx0XHRcdHZhciB2YXJWYWx1ZXMgPSBfLm1hcCggZW50aXRpZXMsIGZ1bmN0aW9uKCB2YWx1ZSApIHsgcmV0dXJuIHZhbHVlOyB9ICk7XG5cdFx0XHRcblx0XHRcdHZhciB2YXJpYWJsZSA9IHtcblx0XHRcdFx0bmFtZTogaGVhZGVyQXJyWyB2YXJJbmRleCBdLFxuXHRcdFx0XHR2YWx1ZXM6IHZhclZhbHVlc1xuXHRcdFx0fTtcblx0XHRcdHZhcmlhYmxlcy5wdXNoKCB2YXJpYWJsZSApO1xuXG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIHZhcmlhYmxlcztcblxuXHR9LFxuXG5cblx0QXBwLlV0aWxzLnRyYW5zcG9zZSA9IGZ1bmN0aW9uKCBhcnIgKSB7XG5cdFx0dmFyIGtleXMgPSBfLmtleXMoIGFyclswXSApO1xuXHRcdHJldHVybiBfLm1hcCgga2V5cywgZnVuY3Rpb24gKGMpIHtcblx0XHRcdHJldHVybiBfLm1hcCggYXJyLCBmdW5jdGlvbiggciApIHtcblx0XHRcdFx0cmV0dXJuIHJbY107XG5cdFx0XHR9ICk7XG5cdFx0fSk7XG5cdH0sXG5cblx0QXBwLlV0aWxzLnRyYW5zZm9ybSA9IGZ1bmN0aW9uKCkge1xuXG5cdFx0Y29uc29sZS5sb2coIFwiYXBwLnV0aWxzLnRyYW5zZm9ybVwiICk7XG5cblx0fSxcblxuXHRBcHAuVXRpbHMuZW5jb2RlU3ZnVG9QbmcgPSBmdW5jdGlvbiggaHRtbCApIHtcblxuXHRcdGNvbnNvbGUubG9nKCBodG1sICk7XG5cdFx0dmFyIGltZ1NyYyA9IFwiZGF0YTppbWFnZS9zdmcreG1sO2Jhc2U2NCxcIiArIGJ0b2EoaHRtbCksXG5cdFx0XHRpbWcgPSBcIjxpbWcgc3JjPSdcIiArIGltZ1NyYyArIFwiJz5cIjsgXG5cdFx0XG5cdFx0Ly9kMy5zZWxlY3QoIFwiI3N2Z2RhdGF1cmxcIiApLmh0bWwoIGltZyApO1xuXG5cdFx0JCggXCIuY2hhcnQtd3JhcHBlci1pbm5lclwiICkuaHRtbCggaW1nICk7XG5cblx0XHQvKnZhciBjYW52YXMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCBcImNhbnZhc1wiICksXG5cdFx0XHRjb250ZXh0ID0gY2FudmFzLmdldENvbnRleHQoIFwiMmRcIiApO1xuXG5cdFx0dmFyIGltYWdlID0gbmV3IEltYWdlO1xuXHRcdGltYWdlLnNyYyA9IGltZ3NyYztcblx0XHRpbWFnZS5vbmxvYWQgPSBmdW5jdGlvbigpIHtcblx0XHRcdGNvbnRleHQuZHJhd0ltYWdlKGltYWdlLCAwLCAwKTtcblx0XHRcdHZhciBjYW52YXNEYXRhID0gY2FudmFzLnRvRGF0YVVSTCggXCJpbWFnZS9wbmdcIiApO1xuXHRcdFx0dmFyIHBuZ0ltZyA9ICc8aW1nIHNyYz1cIicgKyBjYW52YXNEYXRhICsgJ1wiPic7IFxuXHRcdFx0ZDMuc2VsZWN0KFwiI3BuZ2RhdGF1cmxcIikuaHRtbChwbmdpbWcpO1xuXG5cdFx0XHR2YXIgYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJhXCIpO1xuXHRcdFx0YS5kb3dubG9hZCA9IFwic2FtcGxlLnBuZ1wiO1xuXHRcdFx0YS5ocmVmID0gY2FudmFzZGF0YTtcblx0XHRcdGEuY2xpY2soKTtcblx0XHR9OyovXG5cblxuXHR9O1xuXG5cdC8qKlxuXHQqXHRUSU1FIFJFTEFURUQgRlVOQ1RJT05TXG5cdCoqL1xuXG5cdEFwcC5VdGlscy5udGggPSBmdW5jdGlvbiAoIGQgKSB7XG5cdFx0Ly9jb252ZXIgdG8gbnVtYmVyIGp1c3QgaW4gY2FzZVxuXHRcdGQgPSArZDtcblx0XHRpZiggZCA+IDMgJiYgZCA8IDIxICkgcmV0dXJuICd0aCc7IC8vIHRoYW5rcyBrZW5uZWJlY1xuXHRcdHN3aXRjaCggZCAlIDEwICkge1xuXHRcdFx0Y2FzZSAxOiAgcmV0dXJuIFwic3RcIjtcblx0XHRcdGNhc2UgMjogIHJldHVybiBcIm5kXCI7XG5cdFx0XHRjYXNlIDM6ICByZXR1cm4gXCJyZFwiO1xuXHRcdFx0ZGVmYXVsdDogcmV0dXJuIFwidGhcIjtcblx0XHR9XG5cdH1cblxuXHRBcHAuVXRpbHMuY2VudHVyeVN0cmluZyA9IGZ1bmN0aW9uICggZCApIHtcblx0XHQvL2NvbnZlciB0byBudW1iZXIganVzdCBpbiBjYXNlXG5cdFx0ZCA9ICtkO1xuXHRcdFxuXHRcdHZhciBjZW50dXJ5TnVtID0gTWF0aC5mbG9vcihkIC8gMTAwKSArIDEsXG5cdFx0XHRjZW50dXJ5U3RyaW5nID0gY2VudHVyeU51bS50b1N0cmluZygpLFxuXHRcdFx0bnRoID0gQXBwLlV0aWxzLm50aCggY2VudHVyeVN0cmluZyApO1xuXG5cdFx0cmV0dXJuIGNlbnR1cnlTdHJpbmcgKyBudGggKyBcIiBjZW50dXJ5XCI7XG5cdH1cblxuXHRBcHAuVXRpbHMuYWRkWmVyb3MgPSBmdW5jdGlvbiAoIHZhbHVlICkge1xuXG5cdFx0dmFsdWUgPSB2YWx1ZS50b1N0cmluZygpO1xuXHRcdGlmKCB2YWx1ZS5sZW5ndGggPCA0ICkge1xuXHRcdFx0Ly9pbnNlcnQgbWlzc2luZyB6ZXJvc1xuXHRcdFx0dmFyIHZhbHVlTGVuID0gdmFsdWUubGVuZ3RoO1xuXHRcdFx0Zm9yKCB2YXIgeSA9IDA7IHkgPCA0IC0gdmFsdWVMZW47IHkrKyApIHtcblx0XHRcdFx0dmFsdWUgPSBcIjBcIiArIHZhbHVlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0XG5cdH1cblxuXHRBcHAuVXRpbHMucm91bmRUaW1lID0gZnVuY3Rpb24oIG1vbWVudFRpbWUgKSB7XG5cblx0XHRpZiggdHlwZW9mIG1vbWVudFRpbWUuZm9ybWF0ID09PSBcImZ1bmN0aW9uXCIgKSB7XG5cdFx0XHQvL3VzZSBzaG9ydCBmb3JtYXQgbXlzcWwgZXhwZWN0cyAtIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMTA1MzkxNTQvaW5zZXJ0LWludG8tZGItZGF0ZXRpbWUtc3RyaW5nXG5cdFx0XHRyZXR1cm4gbW9tZW50VGltZS5mb3JtYXQoIFwiWVlZWS1NTS1ERFwiICk7XG5cdFx0fVxuXHRcdHJldHVybiBtb21lbnRUaW1lO1xuXG5cdH1cblxuXHQvKiogXG5cdCogRk9STSBIRUxQRVJcblx0KiovXG5cdEFwcC5VdGlscy5Gb3JtSGVscGVyLnZhbGlkYXRlID0gZnVuY3Rpb24oICRmb3JtICkge1xuXHRcdFxuXHRcdHZhciBtaXNzaW5nRXJyb3JMYWJlbCA9IFwiUGxlYXNlIGVudGVyIHZhbHVlLlwiLFxuXHRcdFx0ZW1haWxFcnJvckxhYmVsID0gIFwiUGxlYXNlIGVudGVyIHZhbGlkZSBlbWFpbC5cIixcblx0XHRcdG51bWJlckVycm9yTGFiZWwgPSBcIlBsZWFzZSBlbnRlIHZhbGlkIG51bWJlci5cIjsgXG5cblx0XHR2YXIgaW52YWxpZElucHV0cyA9IFtdO1xuXHRcdFxuXHRcdC8vZ2F0aGVyIGFsbCBmaWVsZHMgcmVxdWlyaW5nIHZhbGlkYXRpb25cblx0XHR2YXIgJHJlcXVpcmVkSW5wdXRzID0gJGZvcm0uZmluZCggXCIucmVxdWlyZWRcIiApO1xuXHRcdGlmKCAkcmVxdWlyZWRJbnB1dHMubGVuZ3RoICkge1xuXG5cdFx0XHQkLmVhY2goICRyZXF1aXJlZElucHV0cywgZnVuY3Rpb24oIGksIHYgKSB7XG5cblx0XHRcdFx0dmFyICRpbnB1dCA9ICQoIHRoaXMgKTtcblx0XHRcdFx0XG5cdFx0XHRcdC8vZmlsdGVyIG9ubHkgdmlzaWJsZVxuXHRcdFx0XHRpZiggISRpbnB1dC5pcyggXCI6dmlzaWJsZVwiICkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly9jaGVjayBmb3IgZW1wdHlcblx0XHRcdFx0dmFyIGlucHV0VmFsaWQgPSBBcHAuVXRpbHMuRm9ybUhlbHBlci52YWxpZGF0ZVJlcXVpcmVkRmllbGQoICRpbnB1dCApO1xuXHRcdFx0XHRpZiggIWlucHV0VmFsaWQgKSB7XG5cdFx0XHRcdFxuXHRcdFx0XHRcdEFwcC5VdGlscy5Gb3JtSGVscGVyLmFkZEVycm9yKCAkaW5wdXQsIG1pc3NpbmdFcnJvckxhYmVsICk7XG5cdFx0XHRcdFx0aW52YWxpZElucHV0cy5wdXNoKCAkaW5wdXQgKTtcblx0XHRcdFx0XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0QXBwLlV0aWxzLkZvcm1IZWxwZXIucmVtb3ZlRXJyb3IoICRpbnB1dCApO1xuXG5cdFx0XHRcdFx0Ly9jaGVjayBmb3IgZGlnaXRcblx0XHRcdFx0XHRpZiggJGlucHV0Lmhhc0NsYXNzKCBcInJlcXVpcmVkLW51bWJlclwiICkgKSB7XG5cdFx0XHRcdFx0XHRpbnB1dFZhbGlkID0gQXBwLlV0aWxzLkZvcm1IZWxwZXIudmFsaWRhdGVOdW1iZXJGaWVsZCggJGlucHV0ICk7XG5cdFx0XHRcdFx0XHRpZiggIWlucHV0VmFsaWQgKSB7XG5cdFx0XHRcdFx0XHRcdEFwcC5VdGlscy5Gb3JtSGVscGVyLmFkZEVycm9yKCAkaW5wdXQsIG51bWJlckVycm9yTGFiZWwgKTtcblx0XHRcdFx0XHRcdFx0aW52YWxpZElucHV0cy5wdXNoKCAkaW5wdXQgKTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdEFwcC5VdGlscy5Gb3JtSGVscGVyLnJlbW92ZUVycm9yKCAkaW5wdXQgKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvL2NoZWNrIGZvciBtYWlsXG5cdFx0XHRcdFx0aWYoICRpbnB1dC5oYXNDbGFzcyggXCJyZXF1aXJlZC1tYWlsXCIgKSApIHtcblx0XHRcdFx0XHRcdGlucHV0VmFsaWQgPSBGb3JtSGVscGVyLnZhbGlkYXRlRW1haWxGaWVsZCggJGlucHV0ICk7XG5cdFx0XHRcdFx0XHRpZiggIWlucHV0VmFsaWQgKSB7XG5cdFx0XHRcdFx0XHRcdEFwcC5VdGlscy5Gb3JtSGVscGVyLmFkZEVycm9yKCAkaW5wdXQsIGVtYWlsRXJyb3JMYWJlbCApO1xuXHRcdFx0XHRcdFx0XHRpbnZhbGlkSW5wdXRzLnB1c2goICRpbnB1dCApO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0QXBwLlV0aWxzLkZvcm1IZWxwZXIucmVtb3ZlRXJyb3IoICRpbnB1dCApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vY2hlY2sgZm9yIGNoZWNrYm94XG5cdFx0XHRcdFx0aWYoICRpbnB1dC5oYXNDbGFzcyggXCJyZXF1aXJlZC1jaGVja2JveFwiICkgKSB7XG5cblx0XHRcdFx0XHRcdGlucHV0VmFsaWQgPSBGb3JtSGVscGVyLnZhbGlkYXRlQ2hlY2tib3goICRpbnB1dCApO1xuXHRcdFx0XHRcdFx0aWYoICFpbnB1dFZhbGlkICkge1xuXHRcdFx0XHRcdFx0XHRBcHAuVXRpbHMuRm9ybUhlbHBlci5hZGRFcnJvciggJGlucHV0LCBtaXNzaW5nRXJyb3JMYWJlbCApO1xuXHRcdFx0XHRcdFx0XHRpbnZhbGlkSW5wdXRzLnB1c2goICRpbnB1dCApO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0QXBwLlV0aWxzLkZvcm1IZWxwZXIucmVtb3ZlRXJyb3IoICRpbnB1dCApO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdH1cblx0XG5cdFx0XHR9ICk7XG5cblx0XHR9XG5cblxuXHRcdGlmKCBpbnZhbGlkSW5wdXRzLmxlbmd0aCApIHtcblxuXHRcdFx0Ly90YWtlIGZpcnN0IGVsZW1lbnQgYW5kIHNjcm9sbCB0byBpdFxuXHRcdFx0dmFyICRmaXJzdEludmFsaWRJbnB1dCA9IGludmFsaWRJbnB1dHNbMF07XG5cdFx0XHQkKCdodG1sLCBib2R5JykuYW5pbWF0ZSgge1xuXHRcdFx0XHRzY3JvbGxUb3A6ICRmaXJzdEludmFsaWRJbnB1dC5vZmZzZXQoKS50b3AgLSAyNVxuXHRcdFx0fSwgMjUwKTtcblxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7IFxuXG5cdH07XG5cblx0QXBwLlV0aWxzLkZvcm1IZWxwZXIudmFsaWRhdGVSZXF1aXJlZEZpZWxkID0gZnVuY3Rpb24oICRpbnB1dCApIHtcblxuXHRcdHJldHVybiAoICRpbnB1dC52YWwoKSA9PT0gXCJcIiApID8gZmFsc2UgOiB0cnVlO1xuXG5cdH07XG5cblx0QXBwLlV0aWxzLkZvcm1IZWxwZXIudmFsaWRhdGVFbWFpbEZpZWxkID0gZnVuY3Rpb24oICRpbnB1dCApIHtcblxuXHRcdHZhciBlbWFpbCA9ICRpbnB1dC52YWwoKTtcblx0XHR2YXIgcmVnZXggPSAvXihbXFx3LVxcLl0rQChbXFx3LV0rXFwuKStbXFx3LV17Miw2fSk/JC87XG5cdFx0cmV0dXJuIHJlZ2V4LnRlc3QoIGVtYWlsICk7XG5cblx0fTtcblxuXHRBcHAuVXRpbHMuRm9ybUhlbHBlci52YWxpZGF0ZU51bWJlckZpZWxkID0gZnVuY3Rpb24oICRpbnB1dCApIHtcblxuXHRcdHJldHVybiAoIGlzTmFOKCAkaW5wdXQudmFsKCkgKSApID8gZmFsc2UgOiB0cnVlO1xuXG5cdH07XG5cblx0QXBwLlV0aWxzLkZvcm1IZWxwZXIudmFsaWRhdGVDaGVja2JveCA9IGZ1bmN0aW9uKCAkaW5wdXQgKSB7XG5cblx0XHRyZXR1cm4gKCAkaW5wdXQuaXMoJzpjaGVja2VkJykgKSA/IHRydWUgOiBmYWxzZTtcblxuXHR9O1xuXG5cblx0QXBwLlV0aWxzLkZvcm1IZWxwZXIuYWRkRXJyb3IgPSBmdW5jdGlvbiggJGVsLCAkbXNnICkge1xuXG5cdFx0aWYoICRlbCApIHtcblx0XHRcdGlmKCAhJGVsLmhhc0NsYXNzKCBcImVycm9yXCIgKSApIHtcblx0XHRcdFx0JGVsLmFkZENsYXNzKCBcImVycm9yXCIgKTtcblx0XHRcdFx0JGVsLmJlZm9yZSggXCI8cCBjbGFzcz0nZXJyb3ItbGFiZWwnPlwiICsgJG1zZyArIFwiPC9wPlwiICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdH07XG5cblx0QXBwLlV0aWxzLkZvcm1IZWxwZXIucmVtb3ZlRXJyb3IgPSBmdW5jdGlvbiggJGVsICkge1xuXG5cdFx0aWYoICRlbCApIHtcblx0XHRcdCRlbC5yZW1vdmVDbGFzcyggXCJlcnJvclwiICk7XG5cdFx0XHR2YXIgJHBhcmVudCA9ICRlbC5wYXJlbnQoKTtcblx0XHRcdHZhciAkZXJyb3JMYWJlbCA9ICRwYXJlbnQuZmluZCggXCIuZXJyb3ItbGFiZWxcIiApO1xuXHRcdFx0aWYoICRlcnJvckxhYmVsLmxlbmd0aCApIHtcblx0XHRcdFx0JGVycm9yTGFiZWwucmVtb3ZlKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdFxuXHR9O1xuXG5cdEFwcC5VdGlscy53cmFwID0gZnVuY3Rpb24oICRlbCwgd2lkdGggKSB7XG5cdFx0XG5cdFx0Ly9nZXQgcmlkIG9mIHBvdGVudGlhbCB0c3BhbnMgYW5kIGdldCBwdXJlIGNvbnRlbnQgKGluY2x1ZGluZyBoeXBlcmxpbmtzKVxuXHRcdHZhciB0ZXh0Q29udGVudCA9IFwiXCIsXG5cdFx0XHQkdHNwYW5zID0gJGVsLmZpbmQoIFwidHNwYW5cIiApO1xuXHRcdGlmKCAkdHNwYW5zLmxlbmd0aCApIHtcblx0XHRcdCQuZWFjaCggJHRzcGFucywgZnVuY3Rpb24oIGksIHYgKSB7XG5cdFx0XHRcdGlmKCBpID4gMCApIHtcblx0XHRcdFx0XHR0ZXh0Q29udGVudCArPSBcIiBcIjtcblx0XHRcdFx0fVxuXHRcdFx0XHR0ZXh0Q29udGVudCArPSAkKHYpLnRleHQoKTtcblx0XHRcdH0gKTtcdFxuXHRcdH0gZWxzZSB7XG5cdFx0XHQvL2VsZW1lbnQgaGFzIG5vIHRzcGFucywgcG9zc2libHkgZmlyc3QgcnVuXG5cdFx0XHR0ZXh0Q29udGVudCA9ICRlbC50ZXh0KCk7XG5cdFx0fVxuXHRcdFxuXHRcdC8vYXBwZW5kIHRvIGVsZW1lbnRcblx0XHRpZiggdGV4dENvbnRlbnQgKSB7XG5cdFx0XHQkZWwudGV4dCggdGV4dENvbnRlbnQgKTtcblx0XHR9XG5cdFx0XG5cdFx0dmFyIHRleHQgPSBkMy5zZWxlY3QoICRlbC5zZWxlY3RvciApO1xuXHRcdHRleHQuZWFjaCggZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgdGV4dCA9IGQzLnNlbGVjdCh0aGlzKSxcblx0XHRcdFx0cmVnZXggPSAvXFxzKy8sXG5cdFx0XHRcdHdvcmRzID0gdGV4dC50ZXh0KCkuc3BsaXQocmVnZXgpLnJldmVyc2UoKTtcblxuXHRcdFx0dmFyIHdvcmQsXG5cdFx0XHRcdGxpbmUgPSBbXSxcblx0XHRcdFx0bGluZU51bWJlciA9IDAsXG5cdFx0XHRcdGxpbmVIZWlnaHQgPSAxLjQsIC8vIGVtc1xuXHRcdFx0XHR5ID0gdGV4dC5hdHRyKFwieVwiKSxcblx0XHRcdFx0ZHkgPSBwYXJzZUZsb2F0KHRleHQuYXR0cihcImR5XCIpKSxcblx0XHRcdFx0dHNwYW4gPSB0ZXh0LnRleHQobnVsbCkuYXBwZW5kKFwidHNwYW5cIikuYXR0cihcInhcIiwgMCkuYXR0cihcInlcIiwgeSkuYXR0cihcImR5XCIsIGR5ICsgXCJlbVwiKTtcblx0XHRcdFxuXHRcdFx0d2hpbGUoIHdvcmQgPSB3b3Jkcy5wb3AoKSApIHtcblx0XHRcdFx0bGluZS5wdXNoKHdvcmQpO1xuXHRcdFx0XHR0c3Bhbi5odG1sKGxpbmUuam9pbihcIiBcIikpO1xuXHRcdFx0XHRpZiggdHNwYW4ubm9kZSgpLmdldENvbXB1dGVkVGV4dExlbmd0aCgpID4gd2lkdGggKSB7XG5cdFx0XHRcdFx0bGluZS5wb3AoKTtcblx0XHRcdFx0XHR0c3Bhbi50ZXh0KGxpbmUuam9pbihcIiBcIikpO1xuXHRcdFx0XHRcdGxpbmUgPSBbd29yZF07XG5cdFx0XHRcdFx0dHNwYW4gPSB0ZXh0LmFwcGVuZChcInRzcGFuXCIpLmF0dHIoXCJ4XCIsIDApLmF0dHIoXCJ5XCIsIHkpLmF0dHIoXCJkeVwiLCArK2xpbmVOdW1iZXIgKiBsaW5lSGVpZ2h0ICsgZHkgKyBcImVtXCIpLnRleHQod29yZCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdH0gKTtcblxuXHRcdFxuXHR9O1xuXG5cdC8qKlxuXHQqIENvbnZlcnQgYSBzdHJpbmcgdG8gSFRNTCBlbnRpdGllc1xuXHQqL1xuXHRBcHAuVXRpbHMudG9IdG1sRW50aXRpZXMgPSBmdW5jdGlvbihzdHJpbmcpIHtcblx0XHRyZXR1cm4gc3RyaW5nLnJlcGxhY2UoLy4vZ20sIGZ1bmN0aW9uKHMpIHtcblx0XHRcdHJldHVybiBcIiYjXCIgKyBzLmNoYXJDb2RlQXQoMCkgKyBcIjtcIjtcblx0XHR9KTtcblx0fTtcblxuXHQvKipcblx0ICogQ3JlYXRlIHN0cmluZyBmcm9tIEhUTUwgZW50aXRpZXNcblx0ICovXG5cdEFwcC5VdGlscy5mcm9tSHRtbEVudGl0aWVzID0gZnVuY3Rpb24oc3RyaW5nKSB7XG5cdFx0cmV0dXJuIChzdHJpbmcrXCJcIikucmVwbGFjZSgvJiNcXGQrOy9nbSxmdW5jdGlvbihzKSB7XG5cdFx0XHRyZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZShzLm1hdGNoKC9cXGQrL2dtKVswXSk7XG5cdFx0fSlcblx0fTtcblxuXHRBcHAuVXRpbHMuZ2V0UmFuZG9tQ29sb3IgPSBmdW5jdGlvbiAoKSB7XG5cdFx0dmFyIGxldHRlcnMgPSAnMDEyMzQ1Njc4OUFCQ0RFRicuc3BsaXQoJycpO1xuXHRcdHZhciBjb2xvciA9ICcjJztcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IDY7IGkrKyApIHtcblx0XHRcdGNvbG9yICs9IGxldHRlcnNbTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTYpXTtcblx0XHR9XG5cdFx0cmV0dXJuIGNvbG9yO1xuXHR9O1xuXG5cdEFwcC5VdGlscy5nZXRQcm9wZXJ0eUJ5VmFyaWFibGVJZCA9IGZ1bmN0aW9uKCBtb2RlbCwgdmFyaWFibGVJZCApIHtcblxuXHRcdGlmKCBtb2RlbCAmJiBtb2RlbC5nZXQoIFwiY2hhcnQtZGltZW5zaW9uc1wiICkgKSB7XG5cblx0XHRcdHZhciBjaGFydERpbWVuc2lvbnNTdHJpbmcgPSBtb2RlbC5nZXQoIFwiY2hhcnQtZGltZW5zaW9uc1wiICksXG5cdFx0XHRcdGNoYXJ0RGltZW5zaW9ucyA9ICQucGFyc2VKU09OKCBjaGFydERpbWVuc2lvbnNTdHJpbmcgKSxcblx0XHRcdFx0ZGltZW5zaW9uID0gXy53aGVyZSggY2hhcnREaW1lbnNpb25zLCB7IFwidmFyaWFibGVJZFwiOiB2YXJpYWJsZUlkIH0gKTtcblx0XHRcdGlmKCBkaW1lbnNpb24gJiYgZGltZW5zaW9uLmxlbmd0aCApIHtcblx0XHRcdFx0cmV0dXJuIGRpbWVuc2lvblswXS5wcm9wZXJ0eTtcblx0XHRcdH1cblxuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0XHRcblx0fTtcblxuXG5cdEFwcC5VdGlscy5jb250ZW50R2VuZXJhdG9yID0gZnVuY3Rpb24oIGRhdGEsIGlzTWFwUG9wdXAgKSB7XG5cdFx0XHRcblx0XHQvL3NldCBwb3B1cFxuXHRcdHZhciB1bml0c1N0cmluZyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJ1bml0c1wiICksXG5cdFx0XHRjaGFydFR5cGUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdHlwZVwiICksXG5cdFx0XHR1bml0cyA9ICggISQuaXNFbXB0eU9iamVjdCggdW5pdHNTdHJpbmcgKSApPyAkLnBhcnNlSlNPTiggdW5pdHNTdHJpbmcgKToge30sXG5cdFx0XHRzdHJpbmcgPSBcIlwiLFxuXHRcdFx0dmFsdWVzU3RyaW5nID0gXCJcIjtcblxuXHRcdC8vZmluZCByZWxldmFudCB2YWx1ZXMgZm9yIHBvcHVwIGFuZCBkaXNwbGF5IHRoZW1cblx0XHR2YXIgc2VyaWVzID0gZGF0YS5zZXJpZXMsIGtleSA9IFwiXCIsIHRpbWVTdHJpbmcgPSBcIlwiO1xuXHRcdGlmKCBzZXJpZXMgJiYgc2VyaWVzLmxlbmd0aCApIHtcblx0XHRcdFxuXHRcdFx0dmFyIHNlcmllID0gc2VyaWVzWyAwIF07XG5cdFx0XHRrZXkgPSBzZXJpZS5rZXk7XG5cdFx0XHRcblx0XHRcdC8vZ2V0IHNvdXJjZSBvZiBpbmZvcm1hdGlvblxuXHRcdFx0dmFyIHBvaW50ID0gZGF0YS5wb2ludDtcblx0XHRcdC8vYmVnaW4gY29tcG9zdGluZyBzdHJpbmdcblx0XHRcdHN0cmluZyA9IFwiPGgzPlwiICsga2V5ICsgXCI8L2gzPjxwPlwiO1xuXHRcdFx0dmFsdWVzU3RyaW5nID0gXCJcIjtcblxuXHRcdFx0aWYoICFpc01hcFBvcHVwICYmICggQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LXR5cGVcIiApID09PSBcIjRcIiB8fCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdHlwZVwiICkgPT09IFwiNVwiIHx8IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10eXBlXCIgKSA9PT0gXCI2XCIgKSApIHtcblx0XHRcdFx0Ly9tdWx0aWJhcmNoYXJ0IGhhcyB2YWx1ZXMgaW4gZGlmZmVyZW50IGZvcm1hdFxuXHRcdFx0XHRwb2ludCA9IHsgXCJ5XCI6IHNlcmllLnZhbHVlLCBcInRpbWVcIjogZGF0YS5kYXRhLnRpbWUgfTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0JC5lYWNoKCBwb2ludCwgZnVuY3Rpb24oIGksIHYgKSB7XG5cdFx0XHRcdC8vZm9yIGVhY2ggZGF0YSBwb2ludCwgZmluZCBhcHByb3ByaWF0ZSB1bml0LCBhbmQgaWYgd2UgaGF2ZSBpdCwgZGlzcGxheSBpdFxuXHRcdFx0XHR2YXIgdW5pdCA9IF8uZmluZFdoZXJlKCB1bml0cywgeyBwcm9wZXJ0eTogaSB9ICksXG5cdFx0XHRcdFx0dmFsdWUgPSB2LFxuXHRcdFx0XHRcdGlzSGlkZGVuID0gKCB1bml0ICYmIHVuaXQuaGFzT3duUHJvcGVydHkoIFwidmlzaWJsZVwiICkgJiYgIXVuaXQudmlzaWJsZSApPyB0cnVlOiBmYWxzZTtcblxuXHRcdFx0XHQvL2Zvcm1hdCBudW1iZXJcblx0XHRcdFx0aWYoIHVuaXQgJiYgIWlzTmFOKCB1bml0LmZvcm1hdCApICYmIHVuaXQuZm9ybWF0ID49IDAgKSB7XG5cdFx0XHRcdFx0Ly9maXhlZCBmb3JtYXRcblx0XHRcdFx0XHR2YXIgZml4ZWQgPSBNYXRoLm1pbiggMjAsIHBhcnNlSW50KCB1bml0LmZvcm1hdCwgMTAgKSApO1xuXHRcdFx0XHRcdHZhbHVlID0gZDMuZm9ybWF0KCBcIiwuXCIgKyBmaXhlZCArIFwiZlwiICkoIHZhbHVlICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly9hZGQgdGhvdXNhbmRzIHNlcGFyYXRvclxuXHRcdFx0XHRcdHZhbHVlID0gZDMuZm9ybWF0KCBcIixcIiApKCB2YWx1ZSApO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYoIHVuaXQgKSB7XG5cdFx0XHRcdFx0aWYoICFpc0hpZGRlbiApIHtcblx0XHRcdFx0XHRcdC8vdHJ5IHRvIGZvcm1hdCBudW1iZXJcblx0XHRcdFx0XHRcdC8vc2NhdHRlciBwbG90IGhhcyB2YWx1ZXMgZGlzcGxheWVkIGluIHNlcGFyYXRlIHJvd3Ncblx0XHRcdFx0XHRcdGlmKCB2YWx1ZXNTdHJpbmcgIT09IFwiXCIgJiYgY2hhcnRUeXBlICE9IDIgKSB7XG5cdFx0XHRcdFx0XHRcdHZhbHVlc1N0cmluZyArPSBcIiwgXCI7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiggY2hhcnRUeXBlID09IDIgKSB7XG5cdFx0XHRcdFx0XHRcdHZhbHVlc1N0cmluZyArPSBcIjxzcGFuIGNsYXNzPSd2YXItcG9wdXAtdmFsdWUnPlwiO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0dmFsdWVzU3RyaW5nICs9IHZhbHVlICsgXCIgXCIgKyB1bml0LnVuaXQ7XG5cdFx0XHRcdFx0XHRpZiggY2hhcnRUeXBlID09IDIgKSB7XG5cdFx0XHRcdFx0XHRcdHZhbHVlc1N0cmluZyArPSBcIjwvc3Bhbj5cIjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSBpZiggaSA9PT0gXCJ0aW1lXCIgKSB7XG5cdFx0XHRcdFx0dGltZVN0cmluZyA9IHY7XG5cdFx0XHRcdH0gZWxzZSBpZiggaSAhPT0gXCJjb2xvclwiICYmIGkgIT09IFwic2VyaWVzXCIgJiYgKCBpICE9PSBcInhcIiB8fCBjaGFydFR5cGUgIT0gMSApICkge1xuXHRcdFx0XHRcdGlmKCAhaXNIaWRkZW4gKSB7XG5cdFx0XHRcdFx0XHRpZiggdmFsdWVzU3RyaW5nICE9PSBcIlwiICYmIGNoYXJ0VHlwZSAhPSAyICkge1xuXHRcdFx0XHRcdFx0XHR2YWx1ZXNTdHJpbmcgKz0gXCIsIFwiO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYoIGNoYXJ0VHlwZSA9PSAyICkge1xuXHRcdFx0XHRcdFx0XHR2YWx1ZXNTdHJpbmcgKz0gXCI8c3BhbiBjbGFzcz0ndmFyLXBvcHVwLXZhbHVlJz5cIjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdC8vanVzdCBhZGQgcGxhaW4gdmFsdWUsIG9taXRpbmcgeCB2YWx1ZSBmb3IgbGluZWNoYXJ0XG5cdFx0XHRcdFx0XHR2YWx1ZXNTdHJpbmcgKz0gdmFsdWU7XG5cdFx0XHRcdFx0XHRpZiggY2hhcnRUeXBlID09IDIgKSB7XG5cdFx0XHRcdFx0XHRcdHZhbHVlc1N0cmluZyArPSBcIjwvc3Bhbj5cIjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblxuXHRcdFx0aWYoIGlzTWFwUG9wdXAgfHwgKCB0aW1lU3RyaW5nICYmIGNoYXJ0VHlwZSAhPSAyICkgKSB7XG5cdFx0XHRcdHZhbHVlc1N0cmluZyArPSBcIiA8YnIgLz4gaW4gPGJyIC8+IFwiICsgdGltZVN0cmluZztcblx0XHRcdH0gZWxzZSBpZiggdGltZVN0cmluZyAmJiBjaGFydFR5cGUgPT0gMiApIHtcblx0XHRcdFx0dmFsdWVzU3RyaW5nICs9IFwiPHNwYW4gY2xhc3M9J3Zhci1wb3B1cC12YWx1ZSc+aW4gXCIgKyB0aW1lU3RyaW5nICsgXCI8L3NwYW4+XCI7XG5cdFx0XHR9XG5cdFx0XHRzdHJpbmcgKz0gdmFsdWVzU3RyaW5nO1xuXHRcdFx0c3RyaW5nICs9IFwiPC9wPlwiO1xuXG5cdFx0fVxuXG5cdFx0cmV0dXJuIHN0cmluZztcblxuXHR9O1xuXG5cblx0QXBwLlV0aWxzLmZvcm1hdFRpbWVMYWJlbCA9IGZ1bmN0aW9uKCB0eXBlLCBkLCB4QXhpc1ByZWZpeCwgeEF4aXNTdWZmaXgsIGZvcm1hdCApIHtcblx0XHQvL2RlcGVuZGluZyBvbiB0eXBlIGZvcm1hdCBsYWJlbFxuXHRcdHZhciBsYWJlbDtcblx0XHRzd2l0Y2goIHR5cGUgKSB7XG5cdFx0XHRcblx0XHRcdGNhc2UgXCJEZWNhZGVcIjpcblx0XHRcdFx0XG5cdFx0XHRcdHZhciBkZWNhZGVTdHJpbmcgPSBkLnRvU3RyaW5nKCk7XG5cdFx0XHRcdGRlY2FkZVN0cmluZyA9IGRlY2FkZVN0cmluZy5zdWJzdHJpbmcoIDAsIGRlY2FkZVN0cmluZy5sZW5ndGggLSAxKTtcblx0XHRcdFx0ZGVjYWRlU3RyaW5nID0gZGVjYWRlU3RyaW5nICsgXCIwc1wiO1xuXHRcdFx0XHRsYWJlbCA9IGRlY2FkZVN0cmluZztcblxuXHRcdFx0XHRicmVhaztcblxuXHRcdFx0Y2FzZSBcIlF1YXJ0ZXIgQ2VudHVyeVwiOlxuXHRcdFx0XHRcblx0XHRcdFx0dmFyIHF1YXJ0ZXJTdHJpbmcgPSBcIlwiLFxuXHRcdFx0XHRcdHF1YXJ0ZXIgPSBkICUgMTAwO1xuXHRcdFx0XHRcblx0XHRcdFx0aWYoIHF1YXJ0ZXIgPCAyNSApIHtcblx0XHRcdFx0XHRxdWFydGVyU3RyaW5nID0gXCIxc3QgcXVhcnRlciBvZiB0aGVcIjtcblx0XHRcdFx0fSBlbHNlIGlmKCBxdWFydGVyIDwgNTAgKSB7XG5cdFx0XHRcdFx0cXVhcnRlclN0cmluZyA9IFwiaGFsZiBvZiB0aGVcIjtcblx0XHRcdFx0fSBlbHNlIGlmKCBxdWFydGVyIDwgNzUgKSB7XG5cdFx0XHRcdFx0cXVhcnRlclN0cmluZyA9IFwiM3JkIHF1YXJ0ZXIgb2YgdGhlXCI7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cXVhcnRlclN0cmluZyA9IFwiNHRoIHF1YXJ0ZXIgb2YgdGhlXCI7XG5cdFx0XHRcdH1cblx0XHRcdFx0XHRcblx0XHRcdFx0dmFyIGNlbnR1cnlTdHJpbmcgPSBBcHAuVXRpbHMuY2VudHVyeVN0cmluZyggZCApO1xuXG5cdFx0XHRcdGxhYmVsID0gcXVhcnRlclN0cmluZyArIFwiIFwiICsgY2VudHVyeVN0cmluZztcblxuXHRcdFx0XHRicmVhaztcblxuXHRcdFx0Y2FzZSBcIkhhbGYgQ2VudHVyeVwiOlxuXHRcdFx0XHRcblx0XHRcdFx0dmFyIGhhbGZTdHJpbmcgPSBcIlwiLFxuXHRcdFx0XHRcdGhhbGYgPSBkICUgMTAwO1xuXHRcdFx0XHRcblx0XHRcdFx0aWYoIGhhbGYgPCA1MCApIHtcblx0XHRcdFx0XHRoYWxmU3RyaW5nID0gXCIxc3QgaGFsZiBvZiB0aGVcIjtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRoYWxmU3RyaW5nID0gXCIybmQgaGFsZiBvZiB0aGVcIjtcblx0XHRcdFx0fVxuXHRcdFx0XHRcdFxuXHRcdFx0XHR2YXIgY2VudHVyeVN0cmluZyA9IEFwcC5VdGlscy5jZW50dXJ5U3RyaW5nKCBkICk7XG5cblx0XHRcdFx0bGFiZWwgPSBoYWxmU3RyaW5nICsgXCIgXCIgKyBjZW50dXJ5U3RyaW5nO1xuXG5cdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRjYXNlIFwiQ2VudHVyeVwiOlxuXHRcdFx0XHRcblx0XHRcdFx0bGFiZWwgPSBBcHAuVXRpbHMuY2VudHVyeVN0cmluZyggZCApO1xuXG5cdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRkZWZhdWx0OlxuXG5cdFx0XHRcdGxhYmVsID0gQXBwLlV0aWxzLmZvcm1hdFZhbHVlKCBkLCBmb3JtYXQgKTtcblx0XHRcdFx0XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblx0XHRyZXR1cm4geEF4aXNQcmVmaXggKyBsYWJlbCArIHhBeGlzU3VmZml4O1xuXHR9O1xuXG5cdEFwcC5VdGlscy5pbmxpbmVDc3NTdHlsZSA9IGZ1bmN0aW9uKCBydWxlcyApIHtcblx0XHQvL2h0dHA6Ly9kZXZpbnRvcnIuZXMvYmxvZy8yMDEwLzA1LzI2L3R1cm4tY3NzLXJ1bGVzLWludG8taW5saW5lLXN0eWxlLWF0dHJpYnV0ZXMtdXNpbmctanF1ZXJ5L1xuXHRcdGZvciAodmFyIGlkeCA9IDAsIGxlbiA9IHJ1bGVzLmxlbmd0aDsgaWR4IDwgbGVuOyBpZHgrKykge1xuXHRcdFx0JChydWxlc1tpZHhdLnNlbGVjdG9yVGV4dCkuZWFjaChmdW5jdGlvbiAoaSwgZWxlbSkge1xuXHRcdFx0XHRlbGVtLnN0eWxlLmNzc1RleHQgKz0gcnVsZXNbaWR4XS5zdHlsZS5jc3NUZXh0O1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9O1xuXG5cdEFwcC5VdGlscy5jaGVja1ZhbGlkRGltZW5zaW9ucyA9IGZ1bmN0aW9uKCBkaW1lbnNpb25zLCBjaGFydFR5cGUgKSB7XG5cdFx0XHRcblx0XHR2YXIgdmFsaWREaW1lbnNpb25zID0gZmFsc2UsXG5cdFx0XHR4RGltZW5zaW9uLCB5RGltZW5zaW9uO1xuXHRcdFxuXHRcdHN3aXRjaCggY2hhcnRUeXBlICkge1xuXHRcdFx0Y2FzZSBcIjFcIjpcblx0XHRcdGNhc2UgXCI0XCI6XG5cdFx0XHRjYXNlIFwiNVwiOlxuXHRcdFx0Y2FzZSBcIjZcIjpcblx0XHRcdFx0Ly9jaGVjayB0aGF0IGRpbWVuc2lvbnMgaGF2ZSB5IHByb3BlcnR5XG5cdFx0XHRcdHlEaW1lbnNpb24gPSBfLmZpbmQoIGRpbWVuc2lvbnMsIGZ1bmN0aW9uKCBkaW1lbnNpb24gKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGRpbWVuc2lvbi5wcm9wZXJ0eSA9PT0gXCJ5XCI7XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0aWYoIHlEaW1lbnNpb24gKSB7XG5cdFx0XHRcdFx0dmFsaWREaW1lbnNpb25zID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgXCIyXCI6XG5cdFx0XHRcdC8vY2hlY2sgdGhhdCBkaW1lbnNpb25zIGhhdmUgeCBwcm9wZXJ0eVxuXHRcdFx0XHR4RGltZW5zaW9uID0gXy5maW5kKCBkaW1lbnNpb25zLCBmdW5jdGlvbiggZGltZW5zaW9uICkge1xuXHRcdFx0XHRcdHJldHVybiBkaW1lbnNpb24ucHJvcGVydHkgPT09IFwieFwiO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdHlEaW1lbnNpb24gPSBfLmZpbmQoIGRpbWVuc2lvbnMsIGZ1bmN0aW9uKCBkaW1lbnNpb24gKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGRpbWVuc2lvbi5wcm9wZXJ0eSA9PT0gXCJ5XCI7XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0aWYoIHhEaW1lbnNpb24gJiYgeURpbWVuc2lvbiApIHtcblx0XHRcdFx0XHR2YWxpZERpbWVuc2lvbnMgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBcIjNcIjpcblx0XHRcdFx0Ly9jaGVjayB0aGF0IGRpbWVuc2lvbnMgaGF2ZSB5IHByb3BlcnR5XG5cdFx0XHRcdHlEaW1lbnNpb24gPSBfLmZpbmQoIGRpbWVuc2lvbnMsIGZ1bmN0aW9uKCBkaW1lbnNpb24gKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGRpbWVuc2lvbi5wcm9wZXJ0eSA9PT0gXCJ5XCI7XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0aWYoIHlEaW1lbnNpb24gKSB7XG5cdFx0XHRcdFx0dmFsaWREaW1lbnNpb25zID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cdFx0cmV0dXJuIHZhbGlkRGltZW5zaW9ucztcblxuXHR9O1xuXG5cdEFwcC5VdGlscy5mb3JtYXRWYWx1ZSA9IGZ1bmN0aW9uKCB2YWx1ZSwgZm9ybWF0ICkge1xuXHRcdC8vbWFrZSBzdXJlIHdlIGRvIHRoaXMgb24gbnVtYmVyXG5cdFx0aWYoIHZhbHVlICYmICFpc05hTiggdmFsdWUgKSApIHtcblx0XHRcdGlmKCBmb3JtYXQgJiYgIWlzTmFOKCBmb3JtYXQgKSApIHtcblx0XHRcdFx0dmFyIGZpeGVkID0gTWF0aC5taW4oIDIwLCBwYXJzZUludCggZm9ybWF0LCAxMCApICk7XG5cdFx0XHRcdHZhbHVlID0gdmFsdWUudG9GaXhlZCggZml4ZWQgKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vbm8gZm9ybWF0IFxuXHRcdFx0XHR2YWx1ZSA9IHZhbHVlLnRvU3RyaW5nKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB2YWx1ZTtcblx0fTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5VdGlscztcblx0XG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIE1haW4gPSByZXF1aXJlKCBcIi4vdmlld3MvQXBwLlZpZXdzLk1haW4uanNcIiApLFxuXHRcdENoYXJ0RGF0YU1vZGVsID0gcmVxdWlyZSggXCIuL21vZGVscy9BcHAuTW9kZWxzLkNoYXJ0RGF0YU1vZGVsLmpzXCIgKTtcblxuXHQvL3NldHVwIG1vZGVsc1xuXHQvL2lzIG5ldyBjaGFydCBvciBkaXNwbGF5IG9sZCBjaGFydFxuXHR2YXIgJGNoYXJ0U2hvd1dyYXBwZXIgPSAkKCBcIi5jaGFydC1zaG93LXdyYXBwZXIsIC5jaGFydC1lZGl0LXdyYXBwZXJcIiApLFxuXHRcdGNoYXJ0SWQgPSAkY2hhcnRTaG93V3JhcHBlci5hdHRyKCBcImRhdGEtY2hhcnQtaWRcIiApO1xuXG5cdC8vc2V0dXAgdmlld3Ncblx0QXBwLlZpZXcgPSBuZXcgTWFpbigpO1xuXG5cdGlmKCAkY2hhcnRTaG93V3JhcHBlci5sZW5ndGggJiYgY2hhcnRJZCApIHtcblx0XHRcblx0XHQvL3Nob3dpbmcgZXhpc3RpbmcgY2hhcnRcblx0XHRBcHAuQ2hhcnRNb2RlbCA9IG5ldyBBcHAuTW9kZWxzLkNoYXJ0TW9kZWwoIHsgaWQ6IGNoYXJ0SWQgfSApO1xuXHRcdEFwcC5DaGFydE1vZGVsLmZldGNoKCB7XG5cdFx0XHRzdWNjZXNzOiBmdW5jdGlvbiggZGF0YSApIHtcblx0XHRcdFx0QXBwLlZpZXcuc3RhcnQoKTtcblx0XHRcdH0sXG5cdFx0XHRlcnJvcjogZnVuY3Rpb24oIHhociApIHtcblx0XHRcdFx0Y29uc29sZS5lcnJvciggXCJFcnJvciBsb2FkaW5nIGNoYXJ0IG1vZGVsXCIsIHhociApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0XHQvL2ZpbmQgb3V0IGlmIGl0J3MgaW4gY2FjaGVcblx0XHRpZiggISQoIFwiLnN0YW5kYWxvbmUtY2hhcnQtdmlld2VyXCIgKS5sZW5ndGggKSB7XG5cdFx0XHQvL2Rpc2FibGUgY2FjaGluZyBmb3Igdmlld2luZyB3aXRoaW4gYWRtaW5cblx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJjYWNoZVwiLCBmYWxzZSApO1xuXHRcdH1cblx0XHRcblx0fSBlbHNlIHtcblxuXHRcdC8vaXMgbmV3IGNoYXJ0XG5cdFx0QXBwLkNoYXJ0TW9kZWwgPSBuZXcgQXBwLk1vZGVscy5DaGFydE1vZGVsKCk7XG5cdFx0QXBwLlZpZXcuc3RhcnQoKTtcblxuXHR9XG5cblx0XG5cdFxuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHRBcHAuTW9kZWxzLkNoYXJ0RGF0YU1vZGVsID0gQmFja2JvbmUuTW9kZWwuZXh0ZW5kKCB7XG5cblx0XHRkZWZhdWx0czoge30sXG5cblx0XHR1cmxSb290OiBHbG9iYWwucm9vdFVybCArIFwiL2RhdGEvZGltZW5zaW9uc1wiLFxuXHRcdFxuXHRcdC8qdXJsOiBmdW5jdGlvbigpe1xuXG5cdFx0XHR2YXIgYXR0cnMgPSB0aGlzLmF0dHJpYnV0ZXMsXG5cdFx0XHRcdHVybCA9IHRoaXMudXJsUm9vdCArIFwiP1wiO1xuXG5cdFx0XHQvL2FkZCBhbGwgYXR0cmlidXRlcyB0byB1cmxcblx0XHRcdF8uZWFjaCggYXR0cnMsIGZ1bmN0aW9uKCB2LCBpICkge1xuXHRcdFx0XHR1cmwgKz0gaSArIFwiPVwiICsgdjtcblx0XHRcdFx0dXJsICs9IFwiJlwiO1xuXHRcdFx0fSApO1xuXG5cdFx0XHRyZXR1cm4gdXJsO1xuXG5cdFx0fSwqL1xuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24gKCkge1xuXG5cdFx0fSxcblxuXHR9ICk7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuTW9kZWxzLkNoYXJ0RGF0YU1vZGVsO1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHRBcHAuTW9kZWxzLkNoYXJ0TW9kZWwgPSBCYWNrYm9uZS5Nb2RlbC5leHRlbmQoIHtcblxuXHRcdC8vdXJsUm9vdDogR2xvYmFsLnJvb3RVcmwgKyAnL2NoYXJ0cy8nLFxuXHRcdC8vdXJsUm9vdDogR2xvYmFsLnJvb3RVcmwgKyAnL2RhdGEvY29uZmlnLycsXG5cdFx0dXJsOiBmdW5jdGlvbigpIHtcblx0XHRcdGlmKCAkKFwiI2Zvcm0tdmlld1wiKS5sZW5ndGggKSB7XG5cdFx0XHRcdGlmKCB0aGlzLmlkICkge1xuXHRcdFx0XHRcdC8vZWRpdGluZyBleGlzdGluZ1xuXHRcdFx0XHRcdHJldHVybiBHbG9iYWwucm9vdFVybCArIFwiL2NoYXJ0cy9cIiArIHRoaXMuaWQ7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly9zYXZpbmcgbmV3XG5cdFx0XHRcdFx0cmV0dXJuIEdsb2JhbC5yb290VXJsICsgXCIvY2hhcnRzXCI7XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gR2xvYmFsLnJvb3RVcmwgKyBcIi9kYXRhL2NvbmZpZy9cIiArIHRoaXMuaWQ7XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdGRlZmF1bHRzOiB7XG5cdFx0XHRcImNhY2hlXCI6IHRydWUsXG5cdFx0XHRcInNlbGVjdGVkLWNvdW50cmllc1wiOiBbXSxcblx0XHRcdFwidGFic1wiOiBbIFwiY2hhcnRcIiwgXCJkYXRhXCIsIFwic291cmNlc1wiIF0sXG5cdFx0XHRcImxpbmUtdHlwZVwiOiBcIjJcIixcblx0XHRcdFwiY2hhcnQtZGVzY3JpcHRpb25cIjogXCJcIixcblx0XHRcdFwiY2hhcnQtZGltZW5zaW9uc1wiOiBbXSxcblx0XHRcdFwidmFyaWFibGVzXCI6IFtdLFxuXHRcdFx0XCJ5LWF4aXNcIjoge30sXG5cdFx0XHRcIngtYXhpc1wiOiB7fSxcblx0XHRcdFwibWFyZ2luc1wiOiB7IHRvcDogMTAsIGxlZnQ6IDYwLCBib3R0b206IDEwLCByaWdodDogMTAgfSxcblx0XHRcdFwidW5pdHNcIjogXCJcIixcblx0XHRcdFwiaWZyYW1lLXdpZHRoXCI6IFwiMTAwJVwiLFxuXHRcdFx0XCJpZnJhbWUtaGVpZ2h0XCI6IFwiNjYwcHhcIixcblx0XHRcdFwiaGlkZS1sZWdlbmRcIjogZmFsc2UsXG5cdFx0XHRcImdyb3VwLWJ5LXZhcmlhYmxlc1wiOiBmYWxzZSxcblx0XHRcdFwiYWRkLWNvdW50cnktbW9kZVwiOiBcImFkZC1jb3VudHJ5XCIsXG5cdFx0XHRcIngtYXhpcy1zY2FsZS1zZWxlY3RvclwiOiBmYWxzZSxcblx0XHRcdFwieS1heGlzLXNjYWxlLXNlbGVjdG9yXCI6IGZhbHNlLFxuXHRcdFx0XCJtYXAtY29uZmlnXCI6IHtcblx0XHRcdFx0XCJ2YXJpYWJsZUlkXCI6IC0xLFxuXHRcdFx0XHRcIm1pblllYXJcIjogMTk4MCxcblx0XHRcdFx0XCJtYXhZZWFyXCI6IDIwMDAsXG5cdFx0XHRcdFwidGFyZ2V0WWVhclwiOiAxOTgwLFxuXHRcdFx0XHRcIm1vZGVcIjogXCJzcGVjaWZpY1wiLFxuXHRcdFx0XHRcInRpbWVUb2xlcmFuY2VcIjogMTAsXG5cdFx0XHRcdFwidGltZUludGVydmFsXCI6IDEwLFxuXHRcdFx0XHRcImNvbG9yU2NoZW1lTmFtZVwiOiBcIkJ1R25cIixcblx0XHRcdFx0XCJjb2xvclNjaGVtZUludGVydmFsXCI6IDUsXG5cdFx0XHRcdFwicHJvamVjdGlvblwiOiBcIldvcmxkXCIsXG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHR0aGlzLm9uKCBcInN5bmNcIiwgdGhpcy5vblN5bmMsIHRoaXMgKTtcblx0XHRcblx0XHR9LFxuXG5cdFx0b25TeW5jOiBmdW5jdGlvbigpIHtcblxuXHRcdFx0aWYoIHRoaXMuZ2V0KCBcImNoYXJ0LXR5cGVcIiApID09IDIgKSB7XG5cdFx0XHRcdC8vbWFrZSBzdXJlIGZvciBzY2F0dGVyIHBsb3QsIHdlIGhhdmUgY29sb3Igc2V0IGFzIGNvbnRpbmVudHNcblx0XHRcdFx0dmFyIGNoYXJ0RGltZW5zaW9ucyA9ICQucGFyc2VKU09OKCB0aGlzLmdldCggXCJjaGFydC1kaW1lbnNpb25zXCIgKSApO1xuXHRcdFx0XHRpZiggIV8uZmluZFdoZXJlKCBjaGFydERpbWVuc2lvbnMsIHsgXCJwcm9wZXJ0eVwiOiBcImNvbG9yXCIgfSApICkge1xuXHRcdFx0XHRcdC8vdGhpcyBpcyB3aGVyZSB3ZSBhZGQgY29sb3IgcHJvcGVydHlcblx0XHRcdFx0XHR2YXIgY29sb3JQcm9wT2JqID0geyBcInZhcmlhYmxlSWRcIjpcIjEyM1wiLFwicHJvcGVydHlcIjpcImNvbG9yXCIsXCJ1bml0XCI6XCJcIixcIm5hbWVcIjpcIkNvbG9yXCIsXCJwZXJpb2RcIjpcInNpbmdsZVwiLFwibW9kZVwiOlwic3BlY2lmaWNcIixcInRhcmdldFllYXJcIjpcIjIwMDBcIixcInRvbGVyYW5jZVwiOlwiNVwiLFwibWF4aW11bUFnZVwiOlwiNVwifTtcblx0XHRcdFx0XHRjaGFydERpbWVuc2lvbnMucHVzaCggY29sb3JQcm9wT2JqICk7XG5cdFx0XHRcdFx0dmFyIGNoYXJEaW1lbnNpb25zU3RyaW5nID0gSlNPTi5zdHJpbmdpZnkoIGNoYXJ0RGltZW5zaW9ucyApO1xuXHRcdFx0XHRcdHRoaXMuc2V0KCBcImNoYXJ0LWRpbWVuc2lvbnNcIiwgY2hhckRpbWVuc2lvbnNTdHJpbmcgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0XG5cdFx0fSxcblxuXHRcdGFkZFNlbGVjdGVkQ291bnRyeTogZnVuY3Rpb24oIGNvdW50cnkgKSB7XG5cblx0XHRcdC8vbWFrZSBzdXJlIHdlJ3JlIHVzaW5nIG9iamVjdCwgbm90IGFzc29jaWF0aXZlIGFycmF5XG5cdFx0XHQvKmlmKCAkLmlzQXJyYXkoIHRoaXMuZ2V0KCBcInNlbGVjdGVkLWNvdW50cmllc1wiICkgKSApIHtcblx0XHRcdFx0Ly93ZSBnb3QgZW1wdHkgYXJyYXkgZnJvbSBkYiwgY29udmVydCB0byBvYmplY3Rcblx0XHRcdFx0dGhpcy5zZXQoIFwic2VsZWN0ZWQtY291bnRyaWVzXCIsIHt9ICk7XG5cdFx0XHR9Ki9cblx0XHRcdFxuXHRcdFx0dmFyIHNlbGVjdGVkQ291bnRyaWVzID0gdGhpcy5nZXQoIFwic2VsZWN0ZWQtY291bnRyaWVzXCIgKTtcblxuXHRcdFx0Ly9tYWtlIHN1cmUgdGhlIHNlbGVjdGVkIGNvbnRyeSBpcyBub3QgdGhlcmUgXG5cdFx0XHRpZiggIV8uZmluZFdoZXJlKCBzZWxlY3RlZENvdW50cmllcywgeyBpZDogY291bnRyeS5pZCB9ICkgKSB7XG5cdFx0XHRcblx0XHRcdFx0c2VsZWN0ZWRDb3VudHJpZXMucHVzaCggY291bnRyeSApO1xuXHRcdFx0XHQvL3NlbGVjdGVkQ291bnRyaWVzWyBjb3VudHJ5LmlkIF0gPSBjb3VudHJ5O1xuXHRcdFx0XHR0aGlzLnRyaWdnZXIoIFwiY2hhbmdlOnNlbGVjdGVkLWNvdW50cmllc1wiICk7XG5cdFx0XHRcdHRoaXMudHJpZ2dlciggXCJjaGFuZ2VcIiApO1xuXHRcdFx0XG5cdFx0XHR9XG5cdFx0XHRcblx0XHR9LFxuXG5cdFx0dXBkYXRlU2VsZWN0ZWRDb3VudHJ5OiBmdW5jdGlvbiggY291bnRyeUlkLCBjb2xvciApIHtcblxuXHRcdFx0dmFyIGNvdW50cnkgPSB0aGlzLmZpbmRDb3VudHJ5QnlJZCggY291bnRyeUlkICk7XG5cdFx0XHRpZiggY291bnRyeSApIHtcblx0XHRcdFx0Y291bnRyeS5jb2xvciA9IGNvbG9yO1xuXHRcdFx0XHR0aGlzLnRyaWdnZXIoIFwiY2hhbmdlOnNlbGVjdGVkLWNvdW50cmllc1wiICk7XG5cdFx0XHRcdHRoaXMudHJpZ2dlciggXCJjaGFuZ2VcIiApO1xuXHRcdFx0fVxuXG5cdFx0fSxcblxuXHRcdHJlbW92ZVNlbGVjdGVkQ291bnRyeTogZnVuY3Rpb24oIGNvdW50cnlJZCApIHtcblxuXHRcdFx0dmFyIGNvdW50cnkgPSB0aGlzLmZpbmRDb3VudHJ5QnlJZCggY291bnRyeUlkICk7XG5cdFx0XHRpZiggY291bnRyeSApIHtcblx0XHRcdFx0dmFyIHNlbGVjdGVkQ291bnRyaWVzID0gdGhpcy5nZXQoIFwic2VsZWN0ZWQtY291bnRyaWVzXCIgKSxcblx0XHRcdFx0XHRjb3VudHJ5SW5kZXggPSBfLmluZGV4T2YoIHNlbGVjdGVkQ291bnRyaWVzLCBjb3VudHJ5ICk7XG5cdFx0XHRcdHNlbGVjdGVkQ291bnRyaWVzLnNwbGljZSggY291bnRyeUluZGV4LCAxICk7XG5cdFx0XHRcdHRoaXMudHJpZ2dlciggXCJjaGFuZ2U6c2VsZWN0ZWQtY291bnRyaWVzXCIgKTtcblx0XHRcdFx0dGhpcy50cmlnZ2VyKCBcImNoYW5nZVwiICk7XG5cdFx0XHR9XG5cblx0XHR9LFxuXG5cdFx0cmVwbGFjZVNlbGVjdGVkQ291bnRyeTogZnVuY3Rpb24oIGNvdW50cnkgKSB7XG5cdFx0XHRpZiggY291bnRyeSApIHtcblx0XHRcdFx0dGhpcy5zZXQoIFwic2VsZWN0ZWQtY291bnRyaWVzXCIsIFsgY291bnRyeSBdICk7XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdGZpbmRDb3VudHJ5QnlJZDogZnVuY3Rpb24oIGNvdW50cnlJZCApIHtcblxuXHRcdFx0dmFyIHNlbGVjdGVkQ291bnRyaWVzID0gdGhpcy5nZXQoIFwic2VsZWN0ZWQtY291bnRyaWVzXCIgKSxcblx0XHRcdFx0Y291bnRyeSA9IF8uZmluZFdoZXJlKCBzZWxlY3RlZENvdW50cmllcywgeyBpZDogY291bnRyeUlkLnRvU3RyaW5nKCkgfSApO1xuXHRcdFx0cmV0dXJuIGNvdW50cnk7XG5cblx0XHR9LFxuXG5cdFx0c2V0QXhpc0NvbmZpZzogZnVuY3Rpb24oIGF4aXNOYW1lLCBwcm9wLCB2YWx1ZSApIHtcblxuXHRcdFx0aWYoICQuaXNBcnJheSggdGhpcy5nZXQoIFwieS1heGlzXCIgKSApICkge1xuXHRcdFx0XHQvL3dlIGdvdCBlbXB0eSBhcnJheSBmcm9tIGRiLCBjb252ZXJ0IHRvIG9iamVjdFxuXHRcdFx0XHR0aGlzLnNldCggXCJ5LWF4aXNcIiwge30gKTtcblx0XHRcdH1cblx0XHRcdGlmKCAkLmlzQXJyYXkoIHRoaXMuZ2V0KCBcIngtYXhpc1wiICkgKSApIHtcblx0XHRcdFx0Ly93ZSBnb3QgZW1wdHkgYXJyYXkgZnJvbSBkYiwgY29udmVydCB0byBvYmplY3Rcblx0XHRcdFx0dGhpcy5zZXQoIFwieC1heGlzXCIsIHt9ICk7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdHZhciBheGlzID0gdGhpcy5nZXQoIGF4aXNOYW1lICk7XG5cdFx0XHRpZiggYXhpcyApIHtcblx0XHRcdFx0YXhpc1sgcHJvcCBdID0gdmFsdWU7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnRyaWdnZXIoIFwiY2hhbmdlXCIgKTtcblxuXHRcdH0sXG5cblx0XHR1cGRhdGVWYXJpYWJsZXM6IGZ1bmN0aW9uKCBuZXdWYXIgKSB7XG5cdFx0XHQvL2NvcHkgYXJyYXlcblx0XHRcdHZhciB2YXJpYWJsZXMgPSB0aGlzLmdldCggXCJ2YXJpYWJsZXNcIiApLnNsaWNlKCksXG5cdFx0XHRcdHZhckluQXJyID0gXy5maW5kKCB2YXJpYWJsZXMsIGZ1bmN0aW9uKCB2ICl7IHJldHVybiB2LmlkID09IG5ld1Zhci5pZDsgfSApO1xuXG5cdFx0XHRpZiggIXZhckluQXJyICkge1xuXHRcdFx0XHR2YXJpYWJsZXMucHVzaCggbmV3VmFyICk7XG5cdFx0XHRcdHRoaXMuc2V0KCBcInZhcmlhYmxlc1wiLCB2YXJpYWJsZXMgKTtcblx0XHRcdH1cblx0XHR9LFxuXG5cdFx0cmVtb3ZlVmFyaWFibGU6IGZ1bmN0aW9uKCB2YXJJZFRvUmVtb3ZlICkge1xuXHRcdFx0Ly9jb3B5IGFycmF5XG5cdFx0XHR2YXIgdmFyaWFibGVzID0gdGhpcy5nZXQoIFwidmFyaWFibGVzXCIgKS5zbGljZSgpLFxuXHRcdFx0XHR2YXJJbkFyciA9IF8uZmluZCggdmFyaWFibGVzLCBmdW5jdGlvbiggdiApeyByZXR1cm4gdi5pZCA9PSBuZXdWYXIuaWQ7IH0gKTtcblxuXHRcdFx0aWYoICF2YXJJbkFyciApIHtcblx0XHRcdFx0dmFyaWFibGVzLnB1c2goIG5ld1ZhciApO1xuXHRcdFx0XHR0aGlzLnNldCggXCJ2YXJpYWJsZXNcIiwgdmFyaWFibGVzICk7XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdHVwZGF0ZU1hcENvbmZpZzogZnVuY3Rpb24oIHByb3BOYW1lLCBwcm9wVmFsdWUsIHNpbGVudCwgZXZlbnROYW1lICkge1xuXG5cdFx0XHR2YXIgbWFwQ29uZmlnID0gdGhpcy5nZXQoIFwibWFwLWNvbmZpZ1wiICk7XG5cdFx0XHRpZiggbWFwQ29uZmlnLmhhc093blByb3BlcnR5KCBwcm9wTmFtZSApICkge1xuXHRcdFx0XHRtYXBDb25maWdbIHByb3BOYW1lIF0gPSBwcm9wVmFsdWU7XG5cdFx0XHRcdGlmKCAhc2lsZW50ICkge1xuXHRcdFx0XHRcdHZhciBldnQgPSAoIGV2ZW50TmFtZSApPyBldmVudE5hbWU6IFwiY2hhbmdlXCI7XG5cdFx0XHRcdFx0dGhpcy50cmlnZ2VyKCBldnQgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0fVxuXG5cblx0fSApO1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLk1vZGVscy5DaGFydE1vZGVsO1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIEhlYWRlciA9IHJlcXVpcmUoIFwiLi9jaGFydC9BcHAuVmlld3MuQ2hhcnQuSGVhZGVyLmpzXCIgKSxcblx0XHRTY2FsZVNlbGVjdG9ycyA9IHJlcXVpcmUoIFwiLi9jaGFydC9BcHAuVmlld3MuQ2hhcnQuU2NhbGVTZWxlY3RvcnNcIiApLFxuXHRcdENoYXJ0VGFiID0gcmVxdWlyZSggXCIuL2NoYXJ0L0FwcC5WaWV3cy5DaGFydC5DaGFydFRhYi5qc1wiICksXG5cdFx0RGF0YVRhYiA9IHJlcXVpcmUoIFwiLi9jaGFydC9BcHAuVmlld3MuQ2hhcnQuRGF0YVRhYi5qc1wiICksXG5cdFx0U291cmNlc1RhYiA9IHJlcXVpcmUoIFwiLi9jaGFydC9BcHAuVmlld3MuQ2hhcnQuU291cmNlc1RhYi5qc1wiICksXG5cdFx0TWFwVGFiID0gcmVxdWlyZSggXCIuL2NoYXJ0L0FwcC5WaWV3cy5DaGFydC5NYXBUYWIuanNcIiApLFxuXHRcdENoYXJ0RGF0YU1vZGVsID0gcmVxdWlyZSggXCIuLy4uL21vZGVscy9BcHAuTW9kZWxzLkNoYXJ0RGF0YU1vZGVsLmpzXCIgKSxcblx0XHRVdGlscyA9IHJlcXVpcmUoIFwiLi8uLi9BcHAuVXRpbHMuanNcIiApO1xuXG5cdEFwcC5WaWV3cy5DaGFydFZpZXcgPSBCYWNrYm9uZS5WaWV3LmV4dGVuZCh7XG5cblx0XHRlbDogXCIjY2hhcnQtdmlld1wiLFxuXHRcdGV2ZW50czoge1xuXHRcdFx0XCJjbGljayAuY2hhcnQtc2F2ZS1wbmctYnRuXCI6IFwiZXhwb3J0Q29udGVudFwiLFxuXHRcdFx0XCJjbGljayAuY2hhcnQtc2F2ZS1zdmctYnRuXCI6IFwiZXhwb3J0Q29udGVudFwiXG5cdFx0fSxcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0XG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIgPSBvcHRpb25zLmRpc3BhdGNoZXI7XG5cdFx0XHRcblx0XHRcdHZhciBjaGlsZFZpZXdPcHRpb25zID0geyBkaXNwYXRjaGVyOiB0aGlzLmRpc3BhdGNoZXIsIHBhcmVudFZpZXc6IHRoaXMgfTtcblx0XHRcdHRoaXMuaGVhZGVyID0gbmV3IEhlYWRlciggY2hpbGRWaWV3T3B0aW9ucyApO1xuXHRcdFx0dGhpcy5zY2FsZVNlbGVjdG9ycyA9IG5ldyBTY2FsZVNlbGVjdG9ycyggY2hpbGRWaWV3T3B0aW9ucyApO1xuXHRcdFx0Ly90YWJzXG5cdFx0XHR0aGlzLmNoYXJ0VGFiID0gbmV3IENoYXJ0VGFiKCBjaGlsZFZpZXdPcHRpb25zICk7XG5cdFx0XHR0aGlzLmRhdGFUYWIgPSBuZXcgRGF0YVRhYiggY2hpbGRWaWV3T3B0aW9ucyApO1xuXHRcdFx0dGhpcy5zb3VyY2VzVGFiID0gbmV3IFNvdXJjZXNUYWIoIGNoaWxkVmlld09wdGlvbnMgKTtcblx0XHRcdHRoaXMubWFwVGFiID0gbmV3IE1hcFRhYiggY2hpbGRWaWV3T3B0aW9ucyApO1xuXG5cdFx0XHQvL3NldHVwIG1vZGVsIHRoYXQgd2lsbCBmZXRjaCBhbGwgdGhlIGRhdGEgZm9yIHVzXG5cdFx0XHR0aGlzLmRhdGFNb2RlbCA9IG5ldyBDaGFydERhdGFNb2RlbCgpO1xuXHRcdFx0XG5cdFx0XHQvL3NldHVwIGV2ZW50c1xuXHRcdFx0dGhpcy5kYXRhTW9kZWwub24oIFwic3luY1wiLCB0aGlzLm9uRGF0YU1vZGVsU3luYywgdGhpcyApO1xuXHRcdFx0dGhpcy5kYXRhTW9kZWwub24oIFwiZXJyb3JcIiwgdGhpcy5vbkRhdGFNb2RlbEVycm9yLCB0aGlzICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5vbiggXCJjaGFuZ2VcIiwgdGhpcy5vbkNoYXJ0TW9kZWxDaGFuZ2UsIHRoaXMgKTtcblxuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblxuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cblx0XHRcdHRoaXMuJHByZWxvYWRlciA9IHRoaXMuJGVsLmZpbmQoIFwiLmNoYXJ0LXByZWxvYWRlclwiICk7XG5cdFx0XHR0aGlzLiRlcnJvciA9IHRoaXMuJGVsLmZpbmQoIFwiLmNoYXJ0LWVycm9yXCIgKTtcblxuXHRcdFx0Ly9jaGFydCB0YWJcblx0XHRcdHRoaXMuJHN2ZyA9IHRoaXMuJGVsLmZpbmQoIFwiI2NoYXJ0LWNoYXJ0LXRhYiBzdmdcIiApO1xuXHRcdFx0dGhpcy4kdGFiQ29udGVudCA9IHRoaXMuJGVsLmZpbmQoIFwiLnRhYi1jb250ZW50XCIgKTtcblx0XHRcdHRoaXMuJHRhYlBhbmVzID0gdGhpcy4kZWwuZmluZCggXCIudGFiLXBhbmVcIiApO1xuXHRcdFx0dGhpcy4kY2hhcnRIZWFkZXIgPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1oZWFkZXJcIiApO1xuXHRcdFx0dGhpcy4kZW50aXRpZXNTZWxlY3QgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPWF2YWlsYWJsZV9lbnRpdGllc11cIiApO1xuXHRcdFx0dGhpcy4kY2hhcnRGb290ZXIgPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1mb290ZXJcIiApO1xuXHRcdFx0dGhpcy4kY2hhcnROYW1lID0gdGhpcy4kZWwuZmluZCggXCIuY2hhcnQtbmFtZVwiICk7XG5cdFx0XHR0aGlzLiRjaGFydFN1Ym5hbWUgPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1zdWJuYW1lXCIgKTtcblx0XHRcdHRoaXMuJGNoYXJ0RGVzY3JpcHRpb24gPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1kZXNjcmlwdGlvblwiICk7XG5cdFx0XHR0aGlzLiRjaGFydFNvdXJjZXMgPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1zb3VyY2VzXCIgKTtcblx0XHRcdHRoaXMuJGNoYXJ0RnVsbFNjcmVlbiA9IHRoaXMuJGVsLmZpbmQoIFwiLmZhbmN5Ym94LWlmcmFtZVwiICk7XG5cblx0XHRcdHRoaXMuJHhBeGlzU2NhbGVTZWxlY3RvciA9IHRoaXMuJGVsLmZpbmQoIFwiLngtYXhpcy1zY2FsZS1zZWxlY3RvclwiICk7XG5cdFx0XHR0aGlzLiR4QXhpc1NjYWxlID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT14X2F4aXNfc2NhbGVdXCIgKTtcblx0XHRcdHRoaXMuJHlBeGlzU2NhbGVTZWxlY3RvciA9IHRoaXMuJGVsLmZpbmQoIFwiLnktYXhpcy1zY2FsZS1zZWxlY3RvclwiICk7XG5cdFx0XHR0aGlzLiR5QXhpc1NjYWxlID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT15X2F4aXNfc2NhbGVdXCIgKTtcblxuXHRcdFx0dGhpcy4kcmVsb2FkQnRuID0gdGhpcy4kZWwuZmluZCggXCIucmVsb2FkLWJ0blwiICk7XG5cblx0XHRcdHZhciBjaGFydE5hbWUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtbmFtZVwiICksXG5cdFx0XHRcdGFkZENvdW50cnlNb2RlID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImFkZC1jb3VudHJ5LW1vZGVcIiApLFxuXHRcdFx0XHRmb3JtQ29uZmlnID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImZvcm0tY29uZmlnXCIgKSxcblx0XHRcdFx0ZW50aXRpZXMgPSAoIGZvcm1Db25maWcgJiYgZm9ybUNvbmZpZ1sgXCJlbnRpdGllcy1jb2xsZWN0aW9uXCIgXSApPyBmb3JtQ29uZmlnWyBcImVudGl0aWVzLWNvbGxlY3Rpb25cIiBdOiBbXSxcblx0XHRcdFx0c2VsZWN0ZWRDb3VudHJpZXMgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwic2VsZWN0ZWQtY291bnRyaWVzXCIgKSxcblx0XHRcdFx0c2VsZWN0ZWRDb3VudHJpZXNJZHMgPSBfLm1hcCggc2VsZWN0ZWRDb3VudHJpZXMsIGZ1bmN0aW9uKCB2ICkgeyByZXR1cm4gKHYpPyArdi5pZDogXCJcIjsgfSApLFxuXHRcdFx0XHRjaGFydFRpbWUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdGltZVwiICk7XG5cdFx0XHRcdFxuXHRcdFx0Ly9taWdodCBuZWVkIHRvIHJlcGxhY2UgY291bnRyeSBpbiB0aXRsZSwgaWYgXCJjaGFuZ2UgY291bnRyeVwiIG1vZGVcblx0XHRcdGlmKCBhZGRDb3VudHJ5TW9kZSA9PT0gXCJjaGFuZ2UtY291bnRyeVwiICkge1xuXHRcdFx0XHQvL3llcCwgcHJvYmFibHkgbmVlZCByZXBsYWNpbmcgY291bnRyeSBpbiB0aXRsZSAoc2VsZWN0IGZpcnN0IGNvdW50cnkgZm9ybSBzdG9yZWQgb25lKVxuXHRcdFx0XHRpZiggc2VsZWN0ZWRDb3VudHJpZXMgJiYgc2VsZWN0ZWRDb3VudHJpZXMubGVuZ3RoICkge1xuXHRcdFx0XHRcdHZhciBjb3VudHJ5ID0gc2VsZWN0ZWRDb3VudHJpZXNbMF07XG5cdFx0XHRcdFx0Y2hhcnROYW1lID0gY2hhcnROYW1lLnJlcGxhY2UoIFwiKmNvdW50cnkqXCIsIGNvdW50cnkubmFtZSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vdXBkYXRlIHZhbHVlc1xuXHRcdFx0dGhpcy4kY2hhcnROYW1lLnRleHQoIGNoYXJ0TmFtZSApO1xuXHRcdFx0dGhpcy4kY2hhcnRTdWJuYW1lLmh0bWwoIEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC1zdWJuYW1lXCIgKSApO1xuXG5cdFx0XHR2YXIgY2hhcnREZXNjcmlwdGlvbiA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC1kZXNjcmlwdGlvblwiICk7XG5cdFx0XHQvL3RoaXMuJGNoYXJ0RGVzY3JpcHRpb24udGV4dCggQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LWRlc2NyaXB0aW9uXCIgKSApO1xuXG5cdFx0XHQvL3Nob3cvaGlkZSBzY2FsZSBzZWxlY3RvcnNcblx0XHRcdHZhciBzaG93WFNjYWxlU2VsZWN0b3JzID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcIngtYXhpcy1zY2FsZS1zZWxlY3RvclwiICk7XG5cdFx0XHRpZiggc2hvd1hTY2FsZVNlbGVjdG9ycyApIHtcblx0XHRcdFx0dGhpcy4keEF4aXNTY2FsZVNlbGVjdG9yLnNob3coKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuJHhBeGlzU2NhbGVTZWxlY3Rvci5oaWRlKCk7XG5cdFx0XHR9XG5cdFx0XHR2YXIgc2hvd1lTY2FsZVNlbGVjdG9ycyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJ5LWF4aXMtc2NhbGUtc2VsZWN0b3JcIiApO1xuXHRcdFx0aWYoIHNob3dZU2NhbGVTZWxlY3RvcnMgKSB7XG5cdFx0XHRcdHRoaXMuJHlBeGlzU2NhbGVTZWxlY3Rvci5zaG93KCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLiR5QXhpc1NjYWxlU2VsZWN0b3IuaGlkZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHQvL3VwZGF0ZSBjb3VudHJpZXNcblx0XHRcdHRoaXMuJGVudGl0aWVzU2VsZWN0LmVtcHR5KCk7XG5cdFx0XHRpZiggc2VsZWN0ZWRDb3VudHJpZXNJZHMubGVuZ3RoICkge1xuXHRcdFx0XHQvL2FwcGVuZCBlbXB0eSBkZWZhdWx0IG9wdGlvblxuXHRcdFx0XHR0aGF0LiRlbnRpdGllc1NlbGVjdC5hcHBlbmQoIFwiPG9wdGlvbiBkaXNhYmxlZCBzZWxlY3RlZD5TZWxlY3QgY291bnRyeTwvb3B0aW9uPlwiICk7XG5cdFx0XHRcdF8uZWFjaCggZW50aXRpZXMsIGZ1bmN0aW9uKCBkLCBpICkge1xuXHRcdFx0XHRcdC8vYWRkIG9ubHkgdGhvc2UgZW50aXRpZXMsIHdoaWNoIGFyZSBub3Qgc2VsZWN0ZWQgYWxyZWFkeVxuXHRcdFx0XHRcdGlmKCBfLmluZGV4T2YoIHNlbGVjdGVkQ291bnRyaWVzSWRzLCArZC5pZCApID09IC0xICkge1xuXHRcdFx0XHRcdFx0dGhhdC4kZW50aXRpZXNTZWxlY3QuYXBwZW5kKCBcIjxvcHRpb24gdmFsdWU9J1wiICsgZC5pZCArIFwiJz5cIiArIGQubmFtZSArIFwiPC9vcHRpb24+XCIgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gKTtcblx0XHRcdH1cblx0XHRcdC8vbWFrZSBjaG9zZW4gdXBkYXRlLCBtYWtlIHN1cmUgaXQgbG9vc2VzIGJsdXIgYXMgd2VsbFxuXHRcdFx0dGhpcy4kZW50aXRpZXNTZWxlY3QudHJpZ2dlciggXCJjaG9zZW46dXBkYXRlZFwiICk7XG5cblx0XHRcdHRoaXMuJGNoYXJ0RnVsbFNjcmVlbi5vbiggXCJjbGlja1wiLCBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0dmFyICR0aGlzID0gJCggdGhpcyApO1xuXHRcdFx0XHR3aW5kb3cucGFyZW50Lm9wZW5GYW5jeUJveCggJHRoaXMuYXR0ciggXCJocmVmXCIgKSApO1xuXHRcdFx0fSApO1xuXG5cdFx0XHQvL3JlZnJlc2ggYnRuXG5cdFx0XHR0aGlzLiRyZWxvYWRCdG4ub24oIFwiY2xpY2tcIiwgZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKTtcblx0XHRcdH0gKTtcblxuXHRcdFx0Ly9jaGFydCB0YWJcblx0XHRcdHRoaXMuJGNoYXJ0VGFiID0gdGhpcy4kZWwuZmluZCggXCIjY2hhcnQtY2hhcnQtdGFiXCIgKTtcblxuXHRcdFx0dmFyIGRpbWVuc2lvbnNTdHJpbmcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtZGltZW5zaW9uc1wiICksXG5cdFx0XHRcdHZhbGlkRGltZW5zaW9ucyA9IGZhbHNlO1xuXHRcdFx0XG5cdFx0XHQvL2NsaWNraW5nIGFueXRoaW5nIGluIGNoYXJ0IHNvdXJjZSB3aWxsIHRha2UgeW91IHRvIHNvdXJjZXMgdGFiXG5cdFx0XHR0aGlzLiRjaGFydFNvdXJjZXMub24oIFwiY2xpY2tcIiwgZnVuY3Rpb24oZXZ0KSB7XG5cdFx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHR2YXIgJGEgPSAkKCBcIltocmVmPScjc291cmNlcy1jaGFydC10YWInXVwiICk7XG5cdFx0XHRcdCRhLnRyaWdnZXIoIFwiY2xpY2tcIiApO1xuXHRcdFx0fSApO1xuXG5cdFx0XHQvL2NoZWNrIHdlIGhhdmUgYWxsIGRpbWVuc2lvbnMgbmVjZXNzYXJ5IFxuXHRcdFx0aWYoICEkLmlzRW1wdHlPYmplY3QoIGRpbWVuc2lvbnNTdHJpbmcgKSApIHtcblx0XHRcdFx0dmFyIGRpbWVuc2lvbiA9ICQucGFyc2VKU09OKCBkaW1lbnNpb25zU3RyaW5nICk7XG5cdFx0XHRcdHZhbGlkRGltZW5zaW9ucyA9IFV0aWxzLmNoZWNrVmFsaWREaW1lbnNpb25zKCBkaW1lbnNpb24sIEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10eXBlXCIgKSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vbWFrZSBzdXJlIHRvIGFwcGVhciBvbmx5IGZpcnN0IHRhYiB0YWJzIHRoYXQgYXJlIG5lY2Vzc2FyeVxuXHRcdFx0Ly9hcHBlYXIgb25seSBmaXJzdCB0YWIgaWYgbm9uZSB2aXNpYmxlXG5cdFx0XHRpZiggIXRoaXMuJHRhYlBhbmVzLmZpbHRlciggXCIuYWN0aXZlXCIgKS5sZW5ndGggKSB7XG5cdFx0XHRcdHZhciB0YWJzID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcInRhYnNcIiApLFxuXHRcdFx0XHRcdGZpcnN0VGFiTmFtZSA9IHRhYnNbIDAgXSxcblx0XHRcdFx0XHRmaXJzdFRhYlBhbmUgPSB0aGlzLiR0YWJQYW5lcy5maWx0ZXIoIFwiI1wiICsgZmlyc3RUYWJOYW1lICsgXCItY2hhcnQtdGFiXCIgKTtcblx0XHRcdFx0Zmlyc3RUYWJQYW5lLmFkZENsYXNzKCBcImFjdGl2ZVwiICk7XG5cdFx0XHRcdGlmKCBmaXJzdFRhYk5hbWUgPT09IFwibWFwXCIgKSB7XG5cdFx0XHRcdFx0Ly9tYXAgdGFiIG5lZWRzIHNwZWNpYWwgaW5pYWxpdGl6YXRpb25cblx0XHRcdFx0XHR0aGlzLm1hcFRhYi5kaXNwbGF5KCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0aWYoICF2YWxpZERpbWVuc2lvbnMgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0aWYoIGRpbWVuc2lvbnNTdHJpbmcgKSB7XG5cblx0XHRcdFx0dGhpcy4kcHJlbG9hZGVyLnNob3coKTtcblxuXHRcdFx0XHR2YXIgZGF0YVByb3BzID0geyBcImRpbWVuc2lvbnNcIjogZGltZW5zaW9uc1N0cmluZywgXCJjaGFydElkXCI6IEFwcC5DaGFydE1vZGVsLmdldCggXCJpZFwiICksIFwiY2hhcnRUeXBlXCI6IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10eXBlXCIgKSwgXCJzZWxlY3RlZENvdW50cmllc1wiOiBzZWxlY3RlZENvdW50cmllc0lkcywgXCJjaGFydFRpbWVcIjogY2hhcnRUaW1lLCBcImNhY2hlXCI6IEFwcC5DaGFydE1vZGVsLmdldCggXCJjYWNoZVwiICksIFwiZ3JvdXBCeVZhcmlhYmxlc1wiOiBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiZ3JvdXAtYnktdmFyaWFibGVzXCIgKSAgfTtcblx0XHRcdFx0XG5cdFx0XHRcdHRoaXMuZGF0YU1vZGVsLmZldGNoKCB7IGRhdGE6IGRhdGFQcm9wcyB9ICk7XG5cblx0XHRcdH0gZWxzZSB7XG5cblx0XHRcdFx0Ly9jbGVhciBhbnkgcHJldmlvdXMgY2hhcnRcblx0XHRcdFx0JCggXCJzdmdcIiApLmVtcHR5KCk7XG5cblx0XHRcdH1cblxuXHRcdH0sXG5cblx0XHRvbkNoYXJ0TW9kZWxDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdHRoaXMucmVuZGVyKCk7XG5cdFx0XHRcblx0XHR9LFxuXG5cdFx0b25EYXRhTW9kZWxTeW5jOiBmdW5jdGlvbiggbW9kZWwsIHJlc3BvbnNlICkge1xuXHRcdFx0dGhpcy4kZXJyb3IuaGlkZSgpO1xuXHRcdFx0dGhpcy4kcHJlbG9hZGVyLmhpZGUoKTtcblx0XHRcdGlmKCByZXNwb25zZS5kYXRhICkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZUNoYXJ0KCByZXNwb25zZS5kYXRhLCByZXNwb25zZS50aW1lVHlwZSwgcmVzcG9uc2UuZGltZW5zaW9ucyApO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5zb3VyY2VzVGFiLnJlbmRlciggcmVzcG9uc2UgKTtcblx0XHR9LFxuXG5cdFx0b25EYXRhTW9kZWxFcnJvcjogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLiRlcnJvci5zaG93KCk7XG5cdFx0XHR0aGlzLiRwcmVsb2FkZXIuaGlkZSgpO1xuXHRcdH0sXG5cblx0XHRleHBvcnRDb250ZW50OiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0XG5cdFx0XHQvL2h0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMjMyMTgxNzQvaG93LWRvLWktc2F2ZS1leHBvcnQtYW4tc3ZnLWZpbGUtYWZ0ZXItY3JlYXRpbmctYW4tc3ZnLXdpdGgtZDMtanMtaWUtc2FmYXJpLWFuXG5cdFx0XHR2YXIgJGJ0biA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICksXG5cdFx0XHRcdC8vc3RvcmUgcHJlLXByaW50aW5nIHN2Z1xuXHRcdFx0XHQkb2xkRWwgPSB0aGlzLiRlbCxcblx0XHRcdFx0JG5ld0VsID0gJG9sZEVsLmNsb25lKCksXG5cdFx0XHRcdGlzU3ZnID0gKCAkYnRuLmhhc0NsYXNzKCBcImNoYXJ0LXNhdmUtc3ZnLWJ0blwiICkgKT8gdHJ1ZTogZmFsc2U7XG5cdFx0XHRcblx0XHRcdCRvbGRFbC5yZXBsYWNlV2l0aCggJG5ld0VsICk7XG5cblx0XHRcdC8vZ3JhYiBhbGwgc3ZnXG5cdFx0XHR2YXIgJHN2ZyA9ICRuZXdFbC5maW5kKCBcInN2Z1wiICksXG5cdFx0XHRcdHN2ZyA9ICRzdmcuZ2V0KCAwICksXG5cdFx0XHRcdHN2Z1N0cmluZyA9IHN2Zy5vdXRlckhUTUw7XG5cblx0XHRcdC8vYWRkIHByaW50aW5nIHN0eWxlc1xuXHRcdFx0JHN2Zy5hdHRyKCBcImNsYXNzXCIsIFwibnZkMy1zdmcgZXhwb3J0LXN2Z1wiICk7XG5cblx0XHRcdC8vaW5saW5lIHN0eWxlcyBmb3IgdGhlIGV4cG9ydFxuXHRcdFx0dmFyIHN0eWxlU2hlZXRzID0gZG9jdW1lbnQuc3R5bGVTaGVldHM7XG5cdFx0XHRmb3IoIHZhciBpID0gMDsgaSA8IHN0eWxlU2hlZXRzLmxlbmd0aDsgaSsrICkge1xuXHRcdFx0XHRVdGlscy5pbmxpbmVDc3NTdHlsZSggc3R5bGVTaGVldHNbIGkgXS5jc3NSdWxlcyApO1xuXHRcdFx0fVxuXG5cdFx0XHQvL2RlcGVuZGluZyB3aGV0aGVyIHdlJ3JlIGNyZWF0aW5nIHN2ZyBvciBwbmcsIFxuXHRcdFx0aWYoIGlzU3ZnICkge1xuXG5cdFx0XHRcdHZhciBzZXJpYWxpemVyID0gbmV3IFhNTFNlcmlhbGl6ZXIoKSxcblx0XHRcdFx0c291cmNlID0gc2VyaWFsaXplci5zZXJpYWxpemVUb1N0cmluZyhzdmcpO1xuXHRcdFx0XHQvL2FkZCBuYW1lIHNwYWNlcy5cblx0XHRcdFx0aWYoIXNvdXJjZS5tYXRjaCgvXjxzdmdbXj5dK3htbG5zPVwiaHR0cFxcOlxcL1xcL3d3d1xcLnczXFwub3JnXFwvMjAwMFxcL3N2Z1wiLykpe1xuXHRcdFx0XHRcdHNvdXJjZSA9IHNvdXJjZS5yZXBsYWNlKC9ePHN2Zy8sICc8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIicpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmKCFzb3VyY2UubWF0Y2goL148c3ZnW14+XStcImh0dHBcXDpcXC9cXC93d3dcXC53M1xcLm9yZ1xcLzE5OTlcXC94bGlua1wiLykpe1xuXHRcdFx0XHRcdHNvdXJjZSA9IHNvdXJjZS5yZXBsYWNlKC9ePHN2Zy8sICc8c3ZnIHhtbG5zOnhsaW5rPVwiaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGlua1wiJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdC8vYWRkIHhtbCBkZWNsYXJhdGlvblxuXHRcdFx0XHRzb3VyY2UgPSAnPD94bWwgdmVyc2lvbj1cIjEuMFwiIHN0YW5kYWxvbmU9XCJub1wiPz5cXHJcXG4nICsgc291cmNlO1xuXG5cdFx0XHRcdC8vY29udmVydCBzdmcgc291cmNlIHRvIFVSSSBkYXRhIHNjaGVtZS5cblx0XHRcdFx0dmFyIHVybCA9IFwiZGF0YTppbWFnZS9zdmcreG1sO2NoYXJzZXQ9dXRmLTgsXCIrZW5jb2RlVVJJQ29tcG9uZW50KHNvdXJjZSk7XG5cdFx0XHRcdCRidG4uYXR0ciggXCJocmVmXCIsIHVybCApO1xuXG5cdFx0XHR9IGVsc2Uge1xuXG5cdFx0XHRcdHZhciAkc3ZnQ2FudmFzID0gJCggXCIubnZkMy1zdmdcIiApO1xuXHRcdFx0XHRpZiggJHN2Z0NhbnZhcy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0c2F2ZVN2Z0FzUG5nKCAkKCBcIi5udmQzLXN2Z1wiICkuZ2V0KCAwICksIFwiY2hhcnQucG5nXCIpO1xuXG5cdFx0XHRcdFx0Ly90ZW1wIGhhY2sgLSByZW1vdmUgaW1hZ2Ugd2hlbiBleHBvcnRpbmcgdG8gcG5nXG5cdFx0XHRcdFx0Lyp2YXIgJHN2Z0xvZ28gPSAkKCBcIi5jaGFydC1sb2dvLXN2Z1wiICk7XG5cdFx0XHRcdFx0JHN2Z0xvZ28ucmVtb3ZlKCk7XG5cblx0XHRcdFx0XHRzYXZlU3ZnQXNQbmcoICQoIFwiLm52ZDMtc3ZnXCIgKS5nZXQoIDAgKSwgXCJjaGFydC5wbmdcIik7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0JHN2Zy5wcmVwZW5kKCAkc3ZnTG9nbyApOyovXG5cdFx0XHRcdFx0XG5cdFx0XHRcdH1cblxuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHQvL2FkZCBiYWNrIHRoZSBwcmludGVkIHN2Z1xuXHRcdFx0JG5ld0VsLnJlcGxhY2VXaXRoKCAkb2xkRWwgKTtcblx0XHRcdC8vcmVmcmVzaCBsaW5rXG5cdFx0XHQkb2xkRWwuZmluZCggXCIuY2hhcnQtc2F2ZS1zdmctYnRuXCIgKS5vbiggXCJjbGlja1wiLCAkLnByb3h5KCB0aGlzLmV4cG9ydENvbnRlbnQsIHRoaXMgKSApO1xuXG5cdFx0fSxcblxuXHRcdHVwZGF0ZUNoYXJ0OiBmdW5jdGlvbiggZGF0YSwgdGltZVR5cGUsIGRpbWVuc2lvbnMgKSB7XG5cblx0XHRcdHRoaXMuY2hhcnRUYWIucmVuZGVyKCBkYXRhLCB0aW1lVHlwZSwgZGltZW5zaW9ucyApO1xuXHRcdFxuXHRcdH0sXG5cdFxuXHRcdG9uUmVzaXplOiBmdW5jdGlvbigpIHtcblx0XHRcdFxuXHRcdFx0Ly9jb21wdXRlIGhvdyBtdWNoIHNwYWNlIGZvciBjaGFydFxuXHRcdFx0dmFyIHN2Z1dpZHRoID0gdGhpcy4kc3ZnLndpZHRoKCksXG5cdFx0XHRcdHN2Z0hlaWdodCA9IHRoaXMuJHN2Zy5oZWlnaHQoKSxcblx0XHRcdFx0Y2hhcnRUeXBlID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LXR5cGVcIiApLFxuXHRcdFx0XHQkY2hhcnROYW1lU3ZnID0gdGhpcy4kZWwuZmluZCggXCIuY2hhcnQtbmFtZS1zdmdcIiApLFxuXHRcdFx0XHQkY2hhcnRTdWJuYW1lU3ZnID0gdGhpcy4kZWwuZmluZCggXCIuY2hhcnQtc3VibmFtZS1zdmdcIiApLFxuXHRcdFx0XHQkY2hhcnREZXNjcmlwdGlvblN2ZyA9IHRoaXMuJGVsLmZpbmQoIFwiLmNoYXJ0LWRlc2NyaXB0aW9uLXN2Z1wiICksXG5cdFx0XHRcdCRjaGFydFNvdXJjZXNTdmcgPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1zb3VyY2VzLXN2Z1wiICksXG5cdFx0XHRcdGNoYXJ0SGVhZGVySGVpZ2h0ID0gdGhpcy4kY2hhcnRIZWFkZXIuaGVpZ2h0KCksXG5cdFx0XHRcdG1hcmdpbnMgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwibWFyZ2luc1wiICksXG5cdFx0XHRcdHRvcENoYXJ0TWFyZ2luID0gMzAsXG5cdFx0XHRcdGJvdHRvbUNoYXJ0TWFyZ2luID0gNjAsXG5cdFx0XHRcdGN1cnJZLCBmb290ZXJEZXNjcmlwdGlvbkhlaWdodCwgZm9vdGVyU291cmNlc0hlaWdodCwgY2hhcnRIZWlnaHQ7XG5cblx0XHRcdHRoaXMuJHRhYkNvbnRlbnQuaGVpZ2h0KCAkKCBcIi5jaGFydC13cmFwcGVyLWlubmVyXCIgKS5oZWlnaHQoKSAtIHRoaXMuJGNoYXJ0SGVhZGVyLmhlaWdodCgpICk7XG5cblx0XHRcdC8vd3JhcCBoZWFkZXIgdGV4dFxuXHRcdFx0VXRpbHMud3JhcCggJGNoYXJ0TmFtZVN2Zywgc3ZnV2lkdGggKTtcblx0XHRcdGN1cnJZID0gcGFyc2VJbnQoICRjaGFydE5hbWVTdmcuYXR0ciggXCJ5XCIgKSwgMTAgKSArICRjaGFydE5hbWVTdmcub3V0ZXJIZWlnaHQoKSArIDIwO1xuXHRcdFx0JGNoYXJ0U3VibmFtZVN2Zy5hdHRyKCBcInlcIiwgY3VyclkgKTtcblx0XHRcdFxuXHRcdFx0Ly93cmFwIGRlc2NyaXB0aW9uXG5cdFx0XHRVdGlscy53cmFwKCAkY2hhcnRTdWJuYW1lU3ZnLCBzdmdXaWR0aCApO1xuXG5cdFx0XHQvL3N0YXJ0IHBvc2l0aW9uaW5nIHRoZSBncmFwaCwgYWNjb3JkaW5nIFxuXHRcdFx0Y3VyclkgPSBjaGFydEhlYWRlckhlaWdodDtcblxuXHRcdFx0dmFyIHRyYW5zbGF0ZVkgPSBjdXJyWTtcblx0XHRcdFxuXHRcdFx0dGhpcy4kc3ZnLmhlaWdodCggdGhpcy4kdGFiQ29udGVudC5oZWlnaHQoKSArIGN1cnJZICk7XG5cblx0XHRcdC8vdXBkYXRlIHN0b3JlZCBoZWlnaHRcblx0XHRcdHN2Z0hlaWdodCA9IHRoaXMuJHN2Zy5oZWlnaHQoKTtcblxuXHRcdFx0Ly9hZGQgaGVpZ2h0IG9mIGxlZ2VuZFxuXHRcdFx0Ly9jdXJyWSArPSB0aGlzLmNoYXJ0LmxlZ2VuZC5oZWlnaHQoKTtcblx0XHRcdGlmKCAhQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImhpZGUtbGVnZW5kXCIgKSApIHtcblx0XHRcdFx0Y3VyclkgKz0gdGhpcy5jaGFydFRhYi5sZWdlbmQuaGVpZ2h0KCk7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdC8vcG9zaXRpb24gY2hhcnRcblx0XHRcdFV0aWxzLndyYXAoICRjaGFydERlc2NyaXB0aW9uU3ZnLCBzdmdXaWR0aCApO1xuXHRcdFx0Zm9vdGVyRGVzY3JpcHRpb25IZWlnaHQgPSAkY2hhcnREZXNjcmlwdGlvblN2Zy5oZWlnaHQoKTtcblx0XHRcdFV0aWxzLndyYXAoICRjaGFydFNvdXJjZXNTdmcsIHN2Z1dpZHRoICk7XG5cdFx0XHRmb290ZXJTb3VyY2VzSGVpZ2h0ID0gJGNoYXJ0U291cmNlc1N2Zy5oZWlnaHQoKTtcblxuXHRcdFx0dmFyIGZvb3RlckhlaWdodCA9IHRoaXMuJGNoYXJ0Rm9vdGVyLmhlaWdodCgpO1xuXG5cdFx0XHQvL3NldCBjaGFydCBoZWlnaHRcblx0XHRcdGNoYXJ0SGVpZ2h0ID0gc3ZnSGVpZ2h0IC0gdHJhbnNsYXRlWSAtIGZvb3RlckhlaWdodCAtIGJvdHRvbUNoYXJ0TWFyZ2luO1xuXHRcdFx0aWYoICFBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiaGlkZS1sZWdlbmRcIiApICkge1xuXHRcdFx0XHRjaGFydEhlaWdodCAtPSB0aGlzLmNoYXJ0VGFiLmxlZ2VuZC5oZWlnaHQoKTtcblx0XHRcdH1cblxuXHRcdFx0Ly9yZWZsZWN0IG1hcmdpbiB0b3AgYW5kIGRvd24gaW4gY2hhcnRIZWlnaHRcblx0XHRcdGNoYXJ0SGVpZ2h0ID0gY2hhcnRIZWlnaHQgLSBtYXJnaW5zLmJvdHRvbSAtIG1hcmdpbnMudG9wO1xuXG5cdFx0XHQvL3Bvc2l0aW9uIGZvb3RlclxuXHRcdFx0JGNoYXJ0RGVzY3JpcHRpb25TdmcuYXR0ciggXCJ5XCIsIGN1cnJZICsgY2hhcnRIZWlnaHQgKyBib3R0b21DaGFydE1hcmdpbiApO1xuXHRcdFx0VXRpbHMud3JhcCggJGNoYXJ0RGVzY3JpcHRpb25TdmcsIHN2Z1dpZHRoICk7XG5cdFx0XHQkY2hhcnRTb3VyY2VzU3ZnLmF0dHIoIFwieVwiLCBwYXJzZUludCggJGNoYXJ0RGVzY3JpcHRpb25TdmcuYXR0ciggXCJ5XCIgKSwgMTAgKSArICRjaGFydERlc2NyaXB0aW9uU3ZnLmhlaWdodCgpICsgZm9vdGVyRGVzY3JpcHRpb25IZWlnaHQvMyApO1xuXHRcdFx0VXRpbHMud3JhcCggJGNoYXJ0U291cmNlc1N2Zywgc3ZnV2lkdGggKTtcblx0XHRcdFxuXHRcdFx0Ly9jb21wdXRlIGNoYXJ0IHdpZHRoXG5cdFx0XHR2YXIgY2hhcnRXaWR0aCA9IHN2Z1dpZHRoIC0gbWFyZ2lucy5sZWZ0IC0gbWFyZ2lucy5yaWdodDtcblx0XHRcdHRoaXMuY2hhcnRUYWIuY2hhcnQud2lkdGgoIGNoYXJ0V2lkdGggKTtcblx0XHRcdHRoaXMuY2hhcnRUYWIuY2hhcnQuaGVpZ2h0KCBjaGFydEhlaWdodCApO1xuXG5cdFx0XHQvL25lZWQgdG8gY2FsbCBjaGFydCB1cGRhdGUgZm9yIHJlc2l6aW5nIG9mIGVsZW1lbnRzIHdpdGhpbiBjaGFydFxuXHRcdFx0aWYoIHRoaXMuJGNoYXJ0VGFiLmlzKCBcIjp2aXNpYmxlXCIgKSApIHtcblx0XHRcdFx0dGhpcy5jaGFydFRhYi5jaGFydC51cGRhdGUoKTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0aWYoIGNoYXJ0VHlwZSA9PT0gXCIzXCIgKSB7XG5cdFx0XHRcdC8vZm9yIHN0YWNrZWQgYXJlYSBjaGFydCwgbmVlZCB0byBtYW51YWxseSBhZGp1c3QgaGVpZ2h0XG5cdFx0XHRcdHZhciBjdXJySW50TGF5ZXJIZWlnaHQgPSB0aGlzLmNoYXJ0VGFiLmNoYXJ0LmludGVyYWN0aXZlTGF5ZXIuaGVpZ2h0KCksXG5cdFx0XHRcdFx0Ly9UT0RPIC0gZG8gbm90IGhhcmRjb2RlIHRoaXNcblx0XHRcdFx0XHRoZWlnaHRBZGQgPSAxNTA7XG5cdFx0XHRcdHRoaXMuY2hhcnRUYWIuY2hhcnQuaW50ZXJhY3RpdmVMYXllci5oZWlnaHQoIGN1cnJJbnRMYXllckhlaWdodCArIGhlaWdodEFkZCApO1xuXHRcdFx0XHRkMy5zZWxlY3QoXCIubnYtaW50ZXJhY3RpdmVcIikuY2FsbCh0aGlzLmNoYXJ0VGFiLmNoYXJ0LmludGVyYWN0aXZlTGF5ZXIpO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRpZiggIUFwcC5DaGFydE1vZGVsLmdldCggXCJoaWRlLWxlZ2VuZFwiICkgKSB7XG5cdFx0XHRcdC8vcG9zaXRpb24gbGVnZW5kXG5cdFx0XHRcdHZhciBsZWdlbmRNYXJnaW5zID0gdGhpcy5jaGFydFRhYi5sZWdlbmQubWFyZ2luKCk7XG5cdFx0XHRcdGN1cnJZID0gY3VyclkgLSB0aGlzLmNoYXJ0VGFiLmxlZ2VuZC5oZWlnaHQoKTtcblx0XHRcdFx0dGhpcy50cmFuc2xhdGVTdHJpbmcgPSBcInRyYW5zbGF0ZShcIiArIGxlZ2VuZE1hcmdpbnMubGVmdCArIFwiICxcIiArIGN1cnJZICsgXCIpXCI7XG5cdFx0XHRcdHRoaXMuJHN2Zy5maW5kKCBcIj4gLm52ZDMubnYtY3VzdG9tLWxlZ2VuZFwiICkuYXR0ciggXCJ0cmFuc2Zvcm1cIiwgdGhpcy50cmFuc2xhdGVTdHJpbmcgKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy4kc3ZnLmNzcyggXCJ0cmFuc2Zvcm1cIiwgXCJ0cmFuc2xhdGUoMCwtXCIgKyBjaGFydEhlYWRlckhlaWdodCArIFwicHgpXCIgKTtcblxuXHRcdFx0Ly9mb3IgbXVsdGliYXJjaGFydCwgbmVlZCB0byBtb3ZlIGNvbnRyb2xzIGJpdCBoaWdoZXJcblx0XHRcdGlmKCBjaGFydFR5cGUgPT09IFwiNFwiIHx8IGNoYXJ0VHlwZSA9PT0gXCI1XCIgKSB7XG5cdFx0XHRcdGQzLnNlbGVjdCggXCIubnYtY29udHJvbHNXcmFwXCIgKS5hdHRyKCBcInRyYW5zZm9ybVwiLCBcInRyYW5zbGF0ZSgwLC0yNSlcIiApO1xuXHRcdFx0fVxuXG5cdFx0XHQvL3JlZmxlY3QgbWFyZ2luIHRvcCBpbiBjdXJyWVxuXHRcdFx0aWYoICFBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiaGlkZS1sZWdlbmRcIiApICkge1xuXHRcdFx0XHRjdXJyWSArPSArdGhpcy5jaGFydFRhYi5sZWdlbmQuaGVpZ2h0KCk7XG5cdFx0XHR9XG5cdFx0XHRjdXJyWSArPSArbWFyZ2lucy50b3A7XG5cblx0XHRcdHZhciAkd3JhcCA9IHRoaXMuJHN2Zy5maW5kKCBcIj4gLm52ZDMubnYtd3JhcFwiICk7XG5cblx0XHRcdC8vbWFudWFsbHkgcmVwb3NpdGlvbiBjaGFydCBhZnRlciB1cGRhdGVcblx0XHRcdC8vdGhpcy50cmFuc2xhdGVTdHJpbmcgPSBcInRyYW5zbGF0ZShcIiArIG1hcmdpbnMubGVmdCArIFwiLFwiICsgY3VyclkgKyBcIilcIjtcblx0XHRcdHRoaXMudHJhbnNsYXRlU3RyaW5nID0gXCJ0cmFuc2xhdGUoXCIgKyBtYXJnaW5zLmxlZnQgKyBcIixcIiArIGN1cnJZICsgXCIpXCI7XG5cdFx0XHQkd3JhcC5hdHRyKCBcInRyYW5zZm9ybVwiLCB0aGlzLnRyYW5zbGF0ZVN0cmluZyApO1xuXHRcdFx0XG5cdFx0XHQvL3Bvc2l0aW9uIHNjYWxlIGRyb3Bkb3ducyAtIFRPRE8gLSBpc24ndCB0aGVyZSBhIGJldHRlciB3YXkgdGhlbiB3aXRoIHRpbWVvdXQ/XG5cdFx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0XHRzZXRUaW1lb3V0KCBmdW5jdGlvbigpIHtcblx0XHRcdFxuXHRcdFx0XHR2YXIgd3JhcE9mZnNldCA9ICR3cmFwLm9mZnNldCgpLFxuXHRcdFx0XHRcdGNoYXJ0VGFiT2Zmc2V0ID0gdGhhdC4kY2hhcnRUYWIub2Zmc2V0KCksXG5cdFx0XHRcdFx0bWFyZ2luTGVmdCA9IHBhcnNlSW50KCBtYXJnaW5zLmxlZnQsIDEwICksXG5cdFx0XHRcdFx0Ly9kaWcgaW50byBOVkQzIGNoYXJ0IHRvIGZpbmQgYmFja2dyb3VuZCByZWN0IHRoYXQgaGFzIHdpZHRoIG9mIHRoZSBhY3R1YWwgY2hhcnRcblx0XHRcdFx0XHRiYWNrUmVjdFdpZHRoID0gcGFyc2VJbnQoICR3cmFwLmZpbmQoIFwiPiBnID4gcmVjdFwiICkuYXR0ciggXCJ3aWR0aFwiICksIDEwICksXG5cdFx0XHRcdFx0b2Zmc2V0RGlmZiA9IHdyYXBPZmZzZXQudG9wIC0gY2hhcnRUYWJPZmZzZXQudG9wLFxuXHRcdFx0XHRcdC8vZW1waXJpYyBvZmZzZXRcblx0XHRcdFx0XHR4U2NhbGVPZmZzZXQgPSAxMCxcblx0XHRcdFx0XHR5U2NhbGVPZmZzZXQgPSAtNTtcblxuXHRcdFx0XHQvL2ZhbGxiYWNrIGZvciBzY2F0dGVyIHBsb3Qgd2hlcmUgYmFja1JlY3RXaWR0aCBoYXMgbm8gd2lkdGhcblx0XHRcdFx0aWYoIGlzTmFOKCBiYWNrUmVjdFdpZHRoICkgKSB7XG5cdFx0XHRcdFx0YmFja1JlY3RXaWR0aCA9IHBhcnNlSW50KCAkKFwiLm52LXgubnYtYXhpcy5udmQzLXN2Z1wiKS5nZXQoMCkuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkud2lkdGgsIDEwICk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGF0LiR4QXhpc1NjYWxlU2VsZWN0b3IuY3NzKCB7IFwidG9wXCI6IG9mZnNldERpZmYgKyBjaGFydEhlaWdodCwgXCJsZWZ0XCI6IG1hcmdpbkxlZnQgKyBiYWNrUmVjdFdpZHRoICsgeFNjYWxlT2Zmc2V0IH0gKTtcblx0XHRcdFx0dGhhdC4keUF4aXNTY2FsZVNlbGVjdG9yLmNzcyggeyBcInRvcFwiOiBvZmZzZXREaWZmIC0gMTUsIFwibGVmdFwiOiBtYXJnaW5MZWZ0ICsgeVNjYWxlT2Zmc2V0IH0gKTtcblx0XHRcdFx0XG5cdFx0XHR9LCAyNTAgKTtcblx0XHRcdFxuXHRcdH1cblxuXHR9KTtcblx0XG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkNoYXJ0VmlldztcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdEFwcC5WaWV3cy5Gb3JtVmlldyA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblxuXHRcdGVsOiBcIiNmb3JtLXZpZXdcIixcblx0XHRldmVudHM6IHtcblx0XHRcdFwiY2xpY2sgLmZvcm0tY29sbGFwc2UtYnRuXCI6IFwib25Gb3JtQ29sbGFwc2VcIixcblx0XHRcdFwiY2hhbmdlIGlucHV0W25hbWU9Y2hhcnQtbmFtZV1cIjogXCJvbk5hbWVDaGFuZ2VcIixcblx0XHRcdFwiY2hhbmdlIHRleHRhcmVhW25hbWU9Y2hhcnQtc3VibmFtZV1cIjogXCJvblN1Ym5hbWVDaGFuZ2VcIixcblx0XHRcdFwiY2xpY2sgLnJlbW92ZS11cGxvYWRlZC1maWxlLWJ0blwiOiBcIm9uUmVtb3ZlVXBsb2FkZWRGaWxlXCIsXG5cdFx0XHRcInN1Ym1pdCBmb3JtXCI6IFwib25Gb3JtU3VibWl0XCIsXG5cdFx0fSxcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0XG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIgPSBvcHRpb25zLmRpc3BhdGNoZXI7XG5cdFx0XHRcblx0XHRcdHZhciBmb3JtQ29uZmlnID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImZvcm0tY29uZmlnXCIgKTtcblxuXHRcdFx0Ly9jcmVhdGUgcmVsYXRlZCBtb2RlbHMsIGVpdGhlciBlbXB0eSAod2hlbiBjcmVhdGluZyBuZXcgY2hhcnQpLCBvciBwcmVmaWxsZWQgZnJvbSBkYiAod2hlbiBlZGl0aW5nIGV4aXN0aW5nIGNoYXJ0KVxuXHRcdFx0aWYoIGZvcm1Db25maWcgJiYgZm9ybUNvbmZpZ1sgXCJ2YXJpYWJsZXMtY29sbGVjdGlvblwiIF0gKSB7XG5cdFx0XHRcdEFwcC5DaGFydFZhcmlhYmxlc0NvbGxlY3Rpb24gPSBuZXcgQXBwLkNvbGxlY3Rpb25zLkNoYXJ0VmFyaWFibGVzQ29sbGVjdGlvbiggZm9ybUNvbmZpZ1sgXCJ2YXJpYWJsZXMtY29sbGVjdGlvblwiIF0gKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdEFwcC5DaGFydFZhcmlhYmxlc0NvbGxlY3Rpb24gPSBuZXcgQXBwLkNvbGxlY3Rpb25zLkNoYXJ0VmFyaWFibGVzQ29sbGVjdGlvbigpO1xuXHRcdFx0fVxuXHRcdFx0aWYoIGZvcm1Db25maWcgJiYgZm9ybUNvbmZpZ1sgXCJlbnRpdGllcy1jb2xsZWN0aW9uXCIgXSApIHtcblx0XHRcdFx0QXBwLkF2YWlsYWJsZUVudGl0aWVzQ29sbGVjdGlvbiA9IG5ldyBBcHAuQ29sbGVjdGlvbnMuQXZhaWxhYmxlRW50aXRpZXNDb2xsZWN0aW9uKCBmb3JtQ29uZmlnWyBcImVudGl0aWVzLWNvbGxlY3Rpb25cIiBdICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRBcHAuQXZhaWxhYmxlRW50aXRpZXNDb2xsZWN0aW9uID0gbmV3IEFwcC5Db2xsZWN0aW9ucy5BdmFpbGFibGVFbnRpdGllc0NvbGxlY3Rpb24oKTtcblx0XHRcdH1cblx0XHRcdGlmKCBmb3JtQ29uZmlnICYmIGZvcm1Db25maWdbIFwiZGltZW5zaW9uc1wiIF0gKSB7XG5cdFx0XHRcdEFwcC5DaGFydERpbWVuc2lvbnNNb2RlbCA9IG5ldyBBcHAuTW9kZWxzLkNoYXJ0RGltZW5zaW9uc01vZGVsKCk7XG5cdFx0XHRcdC8vQXBwLkNoYXJ0RGltZW5zaW9uc01vZGVsID0gbmV3IEFwcC5Nb2RlbHMuQ2hhcnREaW1lbnNpb25zTW9kZWwoIGZvcm1Db25maWdbIFwiZGltZW5zaW9uc1wiIF0gKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdEFwcC5DaGFydERpbWVuc2lvbnNNb2RlbCA9IG5ldyBBcHAuTW9kZWxzLkNoYXJ0RGltZW5zaW9uc01vZGVsKCk7XG5cdFx0XHR9XG5cdFx0XHRpZiggZm9ybUNvbmZpZyAmJiBmb3JtQ29uZmlnWyBcImF2YWlsYWJsZS10aW1lXCIgXSApIHtcblx0XHRcdFx0QXBwLkF2YWlsYWJsZVRpbWVNb2RlbCA9IG5ldyBBcHAuTW9kZWxzLkF2YWlsYWJsZVRpbWVNb2RlbChmb3JtQ29uZmlnWyBcImF2YWlsYWJsZS10aW1lXCIgXSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRBcHAuQXZhaWxhYmxlVGltZU1vZGVsID0gbmV3IEFwcC5Nb2RlbHMuQXZhaWxhYmxlVGltZU1vZGVsKCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vY3JlYXRlIHNlYXJjaCBjb2xsZWN0aW9uXG5cdFx0XHRBcHAuU2VhcmNoRGF0YUNvbGxlY3Rpb24gPSBuZXcgQXBwLkNvbGxlY3Rpb25zLlNlYXJjaERhdGFDb2xsZWN0aW9uKCk7XG5cdFx0XHRcblx0XHRcdC8vaXMgaXQgbmV3IG9yIGV4aXN0aW5nIGNoYXJ0XG5cdFx0XHRpZiggZm9ybUNvbmZpZyAmJiBmb3JtQ29uZmlnWyBcImRpbWVuc2lvbnNcIiBdICkge1xuXHRcdFx0XHQvL2V4aXN0aW5nIGNoYXJ0LCBuZWVkIHRvIGxvYWQgZnJlc2ggZGltZW5zaW9ucyBmcm9tIGRhdGFiYXNlIChpbiBjYXNlIHdlJ3ZlIGFkZGVkIGRpbWVuc2lvbnMgc2luY2UgY3JlYXRpbmcgY2hhcnQpXG5cdFx0XHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRcdFx0QXBwLkNoYXJ0RGltZW5zaW9uc01vZGVsLmxvYWRDb25maWd1cmF0aW9uKCBmb3JtQ29uZmlnWyBcImRpbWVuc2lvbnNcIiBdLmlkICk7XG5cdFx0XHRcdEFwcC5DaGFydERpbWVuc2lvbnNNb2RlbC5vbiggXCJjaGFuZ2VcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0dGhhdC5yZW5kZXIoKTtcblx0XHRcdFx0fSApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly9uZXcgY2hhcnQsIGNhbiByZW5kZXIgc3RyYWlnaHQgYXdheVxuXHRcdFx0XHR0aGlzLnJlbmRlcigpO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcblx0XHRcdC8vY3JlYXRlIHN1YnZpZXdzXG5cdFx0XHR0aGlzLmJhc2ljVGFiVmlldyA9IG5ldyBBcHAuVmlld3MuRm9ybS5CYXNpY1RhYlZpZXcoIHsgZGlzcGF0Y2hlcjogdGhpcy5kaXNwYXRjaGVyIH0gKTtcblx0XHRcdHRoaXMuYXhpc1RhYlZpZXcgPSBuZXcgQXBwLlZpZXdzLkZvcm0uQXhpc1RhYlZpZXcoIHsgZGlzcGF0Y2hlcjogdGhpcy5kaXNwYXRjaGVyIH0gKTtcblx0XHRcdHRoaXMuZGVzY3JpcHRpb25UYWJWaWV3ID0gbmV3IEFwcC5WaWV3cy5Gb3JtLkRlc2NyaXB0aW9uVGFiVmlldyggeyBkaXNwYXRjaGVyOiB0aGlzLmRpc3BhdGNoZXIgfSApO1xuXHRcdFx0dGhpcy5zdHlsaW5nVGFiVmlldyA9IG5ldyBBcHAuVmlld3MuRm9ybS5TdHlsaW5nVGFiVmlldyggeyBkaXNwYXRjaGVyOiB0aGlzLmRpc3BhdGNoZXIgfSApO1xuXHRcdFx0dGhpcy5leHBvcnRUYWJWaWV3ID0gbmV3IEFwcC5WaWV3cy5Gb3JtLkV4cG9ydFRhYlZpZXcoIHsgZGlzcGF0Y2hlcjogdGhpcy5kaXNwYXRjaGVyIH0gKTtcblx0XHRcdHRoaXMubWFwVGFiVmlldyA9IG5ldyBBcHAuVmlld3MuRm9ybS5NYXBUYWJWaWV3KCB7IGRpc3BhdGNoZXI6IHRoaXMuZGlzcGF0Y2hlciB9ICk7XG5cblx0XHRcdC8vZmV0Y2ggZG9tc1xuXHRcdFx0dGhpcy4kcmVtb3ZlVXBsb2FkZWRGaWxlQnRuID0gdGhpcy4kZWwuZmluZCggXCIucmVtb3ZlLXVwbG9hZGVkLWZpbGUtYnRuXCIgKTtcblx0XHRcdHRoaXMuJGZpbGVQaWNrZXIgPSB0aGlzLiRlbC5maW5kKCBcIi5maWxlLXBpY2tlci13cmFwcGVyIFt0eXBlPWZpbGVdXCIgKTtcblxuXHRcdH0sXG5cblx0XHRvbk5hbWVDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdHZhciAkaW5wdXQgPSAkKCBldnQudGFyZ2V0ICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5zZXQoIFwiY2hhcnQtbmFtZVwiLCAkaW5wdXQudmFsKCkgKTtcblxuXHRcdH0sXG5cblx0XHRvblN1Ym5hbWVDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdHZhciAkdGV4dGFyZWEgPSAkKCBldnQudGFyZ2V0ICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5zZXQoIFwiY2hhcnQtc3VibmFtZVwiLCAkdGV4dGFyZWEudmFsKCkgKTtcblxuXHRcdH0sXG5cblx0XHRvbkNzdlNlbGVjdGVkOiBmdW5jdGlvbiggZXJyLCBkYXRhICkge1xuXG5cdFx0XHRpZiggZXJyICkge1xuXHRcdFx0XHRjb25zb2xlLmVycm9yKCBlcnIgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLiRyZW1vdmVVcGxvYWRlZEZpbGVCdG4uc2hvdygpO1xuXG5cdFx0XHRpZiggZGF0YSAmJiBkYXRhLnJvd3MgKSB7XG5cdFx0XHRcdHZhciBtYXBwZWREYXRhID0gQXBwLlV0aWxzLm1hcERhdGEoIGRhdGEucm93cyApO1xuXHRcdFx0XHRBcHAuQ2hhcnRNb2RlbC5zZXQoIFwiY2hhcnQtZGF0YVwiLCBtYXBwZWREYXRhICk7XG5cdFx0XHR9XG5cblx0XHR9LFxuXG5cdFx0b25SZW1vdmVVcGxvYWRlZEZpbGU6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdHRoaXMuJGZpbGVQaWNrZXIucmVwbGFjZVdpdGgoIHRoaXMuJGZpbGVQaWNrZXIuY2xvbmUoKSApO1xuXHRcdFx0Ly9yZWZldGNoIGRvbVxuXHRcdFx0dGhpcy4kZmlsZVBpY2tlciA9IHRoaXMuJGVsLmZpbmQoIFwiLmZpbGUtcGlja2VyLXdyYXBwZXIgW3R5cGU9ZmlsZV1cIiApO1xuXHRcdFx0dGhpcy4kZmlsZVBpY2tlci5wcm9wKCBcImRpc2FibGVkXCIsIGZhbHNlKTtcblxuXHRcdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdFx0Q1NWLmJlZ2luKCB0aGlzLiRmaWxlUGlja2VyLnNlbGVjdG9yICkuZ28oIGZ1bmN0aW9uKCBlcnIsIGRhdGEgKSB7XG5cdFx0XHRcdFx0dGhhdC5vbkNzdlNlbGVjdGVkKCBlcnIsIGRhdGEgKTtcblx0XHRcdH0gKTtcblxuXHRcdFx0dGhpcy4kcmVtb3ZlVXBsb2FkZWRGaWxlQnRuLmhpZGUoKTtcblxuXHRcdH0sXG5cblxuXHRcdG9uRm9ybUNvbGxhcHNlOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdHZhciAkcGFyZW50ID0gdGhpcy4kZWwucGFyZW50KCk7XG5cdFx0XHQkcGFyZW50LnRvZ2dsZUNsYXNzKCBcImZvcm0tcGFuZWwtY29sbGFwc2VkXCIgKTtcblx0XHRcdFxuXHRcdFx0Ly90cmlnZ2VyIHJlLXJlbmRlcmluZyBvZiBjaGFydFxuXHRcdFx0QXBwLkNoYXJ0TW9kZWwudHJpZ2dlciggXCJjaGFuZ2VcIiApO1xuXHRcdFx0Ly9hbHNvIHRyaWdlciBjdXN0b20gZXZlbnQgc28gdGhhdCBtYXAgY2FuIHJlc2l6ZVxuXHRcdFx0QXBwLkNoYXJ0TW9kZWwudHJpZ2dlciggXCJyZXNpemVcIiApO1xuXG5cdFx0fSxcblxuXHRcdG9uRm9ybVN1Ym1pdDogZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdFxuXHRcdFx0JC5hamF4U2V0dXAoIHtcblx0XHRcdFx0aGVhZGVyczogeyAnWC1DU1JGLVRPS0VOJzogJCgnW25hbWU9XCJfdG9rZW5cIl0nKS52YWwoKSB9XG5cdFx0XHR9ICk7XG5cblx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXG5cdFx0XHQvL3B1dCBhbGwgY2hhbmdlcyB0byBjaGFydCBtb2RlbFxuXHRcdFx0dmFyIGZvcm1Db25maWcgPSB7XG5cdFx0XHRcdFwidmFyaWFibGVzLWNvbGxlY3Rpb25cIjogQXBwLkNoYXJ0VmFyaWFibGVzQ29sbGVjdGlvbi50b0pTT04oKSxcblx0XHRcdFx0XCJlbnRpdGllcy1jb2xsZWN0aW9uXCI6IEFwcC5BdmFpbGFibGVFbnRpdGllc0NvbGxlY3Rpb24udG9KU09OKCksXG5cdFx0XHRcdFwiZGltZW5zaW9uc1wiOiBBcHAuQ2hhcnREaW1lbnNpb25zTW9kZWwudG9KU09OKCksXG5cdFx0XHRcdFwiYXZhaWxhYmxlLXRpbWVcIjogQXBwLkF2YWlsYWJsZVRpbWVNb2RlbC50b0pTT04oKVxuXHRcdFx0fTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJmb3JtLWNvbmZpZ1wiLCBmb3JtQ29uZmlnLCB7IHNpbGVudDogdHJ1ZSB9ICk7XG5cblx0XHRcdHZhciBkaXNwYXRjaGVyID0gdGhpcy5kaXNwYXRjaGVyO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2F2ZSgge30sIHtcblx0XHRcdFx0c3VjY2VzczogZnVuY3Rpb24gKCBtb2RlbCwgcmVzcG9uc2UsIG9wdGlvbnMgKSB7XG5cdFx0XHRcdFx0YWxlcnQoIFwiVGhlIGNoYXJ0IHNhdmVkIHN1Y2Nlc2Z1bGx5XCIgKTtcblx0XHRcdFx0XHRkaXNwYXRjaGVyLnRyaWdnZXIoIFwiY2hhcnQtc2F2ZWRcIiwgcmVzcG9uc2UuZGF0YS5pZCwgcmVzcG9uc2UuZGF0YS52aWV3VXJsICk7XG5cdFx0XHRcdFx0Ly91cGRhdGUgaWQgb2YgYW4gZXhpc3RpbmcgbW9kZWxcblx0XHRcdFx0XHRBcHAuQ2hhcnRNb2RlbC5zZXQoIFwiaWRcIiwgcmVzcG9uc2UuZGF0YS5pZCApO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRlcnJvcjogZnVuY3Rpb24gKG1vZGVsLCB4aHIsIG9wdGlvbnMpIHtcblx0XHRcdFx0XHRjb25zb2xlLmVycm9yKFwiU29tZXRoaW5nIHdlbnQgd3Jvbmcgd2hpbGUgc2F2aW5nIHRoZSBtb2RlbFwiLCB4aHIgKTtcblx0XHRcdFx0XHRhbGVydCggXCJPcHBzLCB0aGVyZSB3YXMgYSBwcm9ibGVtIHNhdmluZyB5b3VyIGNoYXJ0LlwiICk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0fVxuXG5cdH0pO1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkZvcm1WaWV3O1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0QXBwLlZpZXdzLkltcG9ydFZpZXcgPSBCYWNrYm9uZS5WaWV3LmV4dGVuZCh7XG5cblx0XHRkYXRhc2V0TmFtZTogXCJcIixcblx0XHRpc0RhdGFNdWx0aVZhcmlhbnQ6IGZhbHNlLFxuXHRcdG9yaWdVcGxvYWRlZERhdGE6IGZhbHNlLFxuXHRcdHVwbG9hZGVkRGF0YTogZmFsc2UsXG5cdFx0dmFyaWFibGVOYW1lTWFudWFsOiBmYWxzZSxcblxuXHRcdGVsOiBcIiNpbXBvcnQtdmlld1wiLFxuXHRcdGV2ZW50czoge1xuXHRcdFx0XCJzdWJtaXQgZm9ybVwiOiBcIm9uRm9ybVN1Ym1pdFwiLFxuXHRcdFx0XCJpbnB1dCBbbmFtZT1uZXdfZGF0YXNldF9uYW1lXVwiOiBcIm9uTmV3RGF0YXNldE5hbWVDaGFuZ2VcIixcblx0XHRcdFwiY2hhbmdlIFtuYW1lPW5ld19kYXRhc2V0XVwiOiBcIm9uTmV3RGF0YXNldENoYW5nZVwiLFxuXHRcdFx0XCJjbGljayAucmVtb3ZlLXVwbG9hZGVkLWZpbGUtYnRuXCI6IFwib25SZW1vdmVVcGxvYWRlZEZpbGVcIixcblx0XHRcdFwiY2hhbmdlIFtuYW1lPWNhdGVnb3J5X2lkXVwiOiBcIm9uQ2F0ZWdvcnlDaGFuZ2VcIixcblx0XHRcdFwiY2hhbmdlIFtuYW1lPWV4aXN0aW5nX2RhdGFzZXRfaWRdXCI6IFwib25FeGlzdGluZ0RhdGFzZXRDaGFuZ2VcIixcblx0XHRcdFwiY2hhbmdlIFtuYW1lPWRhdGFzb3VyY2VfaWRdXCI6IFwib25EYXRhc291cmNlQ2hhbmdlXCIsXG5cdFx0XHRcImNoYW5nZSBbbmFtZT1leGlzdGluZ192YXJpYWJsZV9pZF1cIjogXCJvbkV4aXN0aW5nVmFyaWFibGVDaGFuZ2VcIixcblx0XHRcdFwiY2hhbmdlIFtuYW1lPXN1YmNhdGVnb3J5X2lkXVwiOiBcIm9uU3ViQ2F0ZWdvcnlDaGFuZ2VcIixcblx0XHRcdFwiY2hhbmdlIFtuYW1lPW11bHRpdmFyaWFudF9kYXRhc2V0XVwiOiBcIm9uTXVsdGl2YXJpYW50RGF0YXNldENoYW5nZVwiLFxuXHRcdFx0XCJjbGljayAubmV3LWRhdGFzZXQtZGVzY3JpcHRpb24tYnRuXCI6IFwib25EYXRhc2V0RGVzY3JpcHRpb25cIlxuXHRcdH0sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdFxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gb3B0aW9ucy5kaXNwYXRjaGVyO1xuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblx0XHRcdHRoaXMuaW5pdFVwbG9hZCgpO1xuXG5cdFx0XHQvKnZhciBpbXBvcnRlciA9IG5ldyBBcHAuTW9kZWxzLkltcG9ydGVyKCk7XG5cdFx0XHRpbXBvcnRlci51cGxvYWRGb3JtRGF0YSgpOyovXG5cblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblxuXHRcdFx0Ly9zZWN0aW9uc1xuXHRcdFx0dGhpcy4kZGF0YXNldFNlY3Rpb24gPSB0aGlzLiRlbC5maW5kKCBcIi5kYXRhc2V0LXNlY3Rpb25cIiApO1xuXHRcdFx0dGhpcy4kZGF0YXNldFR5cGVTZWN0aW9uID0gdGhpcy4kZWwuZmluZCggXCIuZGF0YXNldC10eXBlLXNlY3Rpb25cIiApO1xuXHRcdFx0dGhpcy4kdXBsb2FkU2VjdGlvbiA9IHRoaXMuJGVsLmZpbmQoIFwiLnVwbG9hZC1zZWN0aW9uXCIgKTtcblx0XHRcdHRoaXMuJHZhcmlhYmxlU2VjdGlvbiA9IHRoaXMuJGVsLmZpbmQoIFwiLnZhcmlhYmxlcy1zZWN0aW9uXCIgKTtcblx0XHRcdHRoaXMuJGNhdGVnb3J5U2VjdGlvbiA9IHRoaXMuJGVsLmZpbmQoIFwiLmNhdGVnb3J5LXNlY3Rpb25cIiApO1xuXHRcdFx0dGhpcy4kdmFyaWFibGVUeXBlU2VjdGlvbiA9IHRoaXMuJGVsLmZpbmQoIFwiLnZhcmlhYmxlLXR5cGUtc2VjdGlvblwiICk7XG5cdFx0XHRcdFxuXHRcdFx0Ly9yYW5kb20gZWxzXG5cdFx0XHR0aGlzLiRuZXdEYXRhc2V0RGVzY3JpcHRpb24gPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPW5ld19kYXRhc2V0X2Rlc2NyaXB0aW9uXVwiICk7XG5cdFx0XHR0aGlzLiRleGlzdGluZ0RhdGFzZXRTZWxlY3QgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPWV4aXN0aW5nX2RhdGFzZXRfaWRdXCIgKTtcblx0XHRcdHRoaXMuJGV4aXN0aW5nVmFyaWFibGVzV3JhcHBlciA9IHRoaXMuJGVsLmZpbmQoIFwiLmV4aXN0aW5nLXZhcmlhYmxlLXdyYXBwZXJcIiApO1xuXHRcdFx0dGhpcy4kZXhpc3RpbmdWYXJpYWJsZXNTZWxlY3QgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPWV4aXN0aW5nX3ZhcmlhYmxlX2lkXVwiICk7XG5cdFx0XHR0aGlzLiR2YXJpYWJsZVNlY3Rpb25MaXN0ID0gdGhpcy4kdmFyaWFibGVTZWN0aW9uLmZpbmQoIFwib2xcIiApO1xuXG5cdFx0XHQvL2ltcG9ydCBzZWN0aW9uXG5cdFx0XHR0aGlzLiRmaWxlUGlja2VyID0gdGhpcy4kZWwuZmluZCggXCIuZmlsZS1waWNrZXItd3JhcHBlciBbdHlwZT1maWxlXVwiICk7XG5cdFx0XHR0aGlzLiRkYXRhSW5wdXQgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPWRhdGFdXCIgKTtcblx0XHRcdFxuXHRcdFx0dGhpcy4kY3N2SW1wb3J0UmVzdWx0ID0gdGhpcy4kZWwuZmluZCggXCIuY3N2LWltcG9ydC1yZXN1bHRcIiApO1xuXHRcdFx0dGhpcy4kY3N2SW1wb3J0VGFibGVXcmFwcGVyID0gdGhpcy4kZWwuZmluZCggXCIjY3N2LWltcG9ydC10YWJsZS13cmFwcGVyXCIgKTtcblx0XHRcdFxuXHRcdFx0dGhpcy4kbmV3RGF0YXNldFNlY3Rpb24gPSB0aGlzLiRlbC5maW5kKCBcIi5uZXctZGF0YXNldC1zZWN0aW9uXCIgKTtcblx0XHRcdHRoaXMuJGV4aXN0aW5nRGF0YXNldFNlY3Rpb24gPSB0aGlzLiRlbC5maW5kKCBcIi5leGlzdGluZy1kYXRhc2V0LXNlY3Rpb25cIiApO1xuXHRcdFx0dGhpcy4kcmVtb3ZlVXBsb2FkZWRGaWxlQnRuID0gdGhpcy4kZWwuZmluZCggXCIucmVtb3ZlLXVwbG9hZGVkLWZpbGUtYnRuXCIgKTtcblxuXHRcdFx0Ly9kYXRhc291cmNlIHNlY3Rpb25cblx0XHRcdHRoaXMuJG5ld0RhdGFzb3VyY2VXcmFwcGVyID0gdGhpcy4kZWwuZmluZCggXCIubmV3LWRhdGFzb3VyY2Utd3JhcHBlclwiICk7XG5cdFx0XHR0aGlzLiRzb3VyY2VEZXNjcmlwdGlvbiA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9c291cmNlX2Rlc2NyaXB0aW9uXVwiICk7XG5cblx0XHRcdC8vY2F0ZWdvcnkgc2VjdGlvblxuXHRcdFx0dGhpcy4kY2F0ZWdvcnlTZWxlY3QgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPWNhdGVnb3J5X2lkXVwiICk7XG5cdFx0XHR0aGlzLiRzdWJjYXRlZ29yeVNlbGVjdCA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9c3ViY2F0ZWdvcnlfaWRdXCIgKTtcblxuXHRcdFx0Ly9oaWRlIG9wdGlvbmFsIGVsZW1lbnRzXG5cdFx0XHR0aGlzLiRuZXdEYXRhc2V0RGVzY3JpcHRpb24uaGlkZSgpO1xuXHRcdFx0Ly90aGlzLiR2YXJpYWJsZVNlY3Rpb24uaGlkZSgpO1xuXG5cdFx0fSxcblxuXHRcdGluaXRVcGxvYWQ6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0XHR0aGlzLiRmaWxlUGlja2VyLm9uKCBcImNoYW5nZVwiLCBmdW5jdGlvbiggaSwgdiApIHtcblxuXHRcdFx0XHR2YXIgJHRoaXMgPSAkKCB0aGlzICk7XG5cdFx0XHRcdCR0aGlzLnBhcnNlKCB7XG5cdFx0XHRcdFx0Y29uZmlnOiB7XG5cdFx0XHRcdFx0XHRjb21wbGV0ZTogZnVuY3Rpb24oIG9iaiApIHtcblx0XHRcdFx0XHRcdFx0dmFyIGRhdGEgPSB7IHJvd3M6IG9iai5kYXRhIH07XG5cdFx0XHRcdFx0XHRcdHRoYXQub25Dc3ZTZWxlY3RlZCggbnVsbCwgZGF0YSApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSApO1xuXG5cdFx0XHR9ICk7XG5cblx0XHRcdC8qQ1NWLmJlZ2luKCB0aGlzLiRmaWxlUGlja2VyLnNlbGVjdG9yIClcblx0XHRcdFx0Ly8udGFibGUoIFwiY3N2LWltcG9ydC10YWJsZS13cmFwcGVyXCIsIHsgaGVhZGVyOjEsIGNhcHRpb246IFwiXCIgfSApXG5cdFx0XHRcdC5nbyggZnVuY3Rpb24oIGVyciwgZGF0YSApIHtcblx0XHRcdFx0XHR0aGF0Lm9uQ3N2U2VsZWN0ZWQoIGVyciwgZGF0YSApO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR0aGlzLiRyZW1vdmVVcGxvYWRlZEZpbGVCdG4uaGlkZSgpOyovXG5cblx0XHR9LFxuXG5cdFx0b25Dc3ZTZWxlY3RlZDogZnVuY3Rpb24oIGVyciwgZGF0YSApIHtcblx0XHRcdFxuXHRcdFx0aWYoICFkYXRhICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdC8vdGVzdGluZyBtYXNzaXZlIGltcG9ydCB2ZXJzaW9uIFx0XHRcdFxuXHRcdFx0Lyp0aGlzLnVwbG9hZGVkRGF0YSA9IGRhdGE7XG5cdFx0XHQvL3N0b3JlIGFsc28gb3JpZ2luYWwsIHRoaXMudXBsb2FkZWREYXRhIHdpbGwgYmUgbW9kaWZpZWQgd2hlbiBiZWluZyB2YWxpZGF0ZWRcblx0XHRcdHRoaXMub3JpZ1VwbG9hZGVkRGF0YSA9ICQuZXh0ZW5kKCB0cnVlLCB7fSwgdGhpcy51cGxvYWRlZERhdGEpO1xuXG5cdFx0XHR0aGlzLmNyZWF0ZURhdGFUYWJsZSggZGF0YS5yb3dzICk7XG5cdFx0XHRcblx0XHRcdHRoaXMudmFsaWRhdGVFbnRpdHlEYXRhKCBkYXRhLnJvd3MgKTtcblx0XHRcdHRoaXMudmFsaWRhdGVUaW1lRGF0YSggZGF0YS5yb3dzICk7XG5cdFx0XHRcblx0XHRcdHRoaXMubWFwRGF0YSgpOyovXG5cblx0XHRcdC8vbm9ybWFsIHZlcnNpb25cblxuXHRcdFx0Ly9kbyB3ZSBuZWVkIHRvIHRyYW5zcG9zZSBkYXRhP1xuXHRcdFx0aWYoICF0aGlzLmlzRGF0YU11bHRpVmFyaWFudCApIHtcblx0XHRcdFx0dmFyIGlzT3JpZW50ZWQgPSB0aGlzLmRldGVjdE9yaWVudGF0aW9uKCBkYXRhLnJvd3MgKTtcblx0XHRcdFx0aWYoICFpc09yaWVudGVkICkge1xuXHRcdFx0XHRcdGRhdGEucm93cyA9IEFwcC5VdGlscy50cmFuc3Bvc2UoIGRhdGEucm93cyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdHRoaXMudXBsb2FkZWREYXRhID0gZGF0YTtcblx0XHRcdC8vc3RvcmUgYWxzbyBvcmlnaW5hbCwgdGhpcy51cGxvYWRlZERhdGEgd2lsbCBiZSBtb2RpZmllZCB3aGVuIGJlaW5nIHZhbGlkYXRlZFxuXHRcdFx0dGhpcy5vcmlnVXBsb2FkZWREYXRhID0gJC5leHRlbmQoIHRydWUsIHt9LCB0aGlzLnVwbG9hZGVkRGF0YSk7XG5cdFx0XHRcblx0XHRcdHRoaXMuY3JlYXRlRGF0YVRhYmxlKCBkYXRhLnJvd3MgKTtcblxuXHRcdFx0dGhpcy52YWxpZGF0ZUVudGl0eURhdGEoIGRhdGEucm93cyApO1xuXHRcdFx0dGhpcy52YWxpZGF0ZVRpbWVEYXRhKCBkYXRhLnJvd3MgKTtcblxuXHRcdFx0dGhpcy5tYXBEYXRhKCk7XG5cblx0XHR9LFxuXG5cdFx0ZGV0ZWN0T3JpZW50YXRpb246IGZ1bmN0aW9uKCBkYXRhICkge1xuXG5cdFx0XHR2YXIgaXNPcmllbnRlZCA9IHRydWU7XG5cblx0XHRcdC8vZmlyc3Qgcm93LCBzZWNvbmQgY2VsbCwgc2hvdWxkIGJlIG51bWJlciAodGltZSlcblx0XHRcdGlmKCBkYXRhLmxlbmd0aCA+IDAgJiYgZGF0YVswXS5sZW5ndGggPiAwICkge1xuXHRcdFx0XHR2YXIgc2Vjb25kQ2VsbCA9IGRhdGFbIDAgXVsgMSBdO1xuXHRcdFx0XHRpZiggaXNOYU4oIHNlY29uZENlbGwgKSApIHtcblx0XHRcdFx0XHRpc09yaWVudGVkID0gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGlzT3JpZW50ZWQ7XG5cblx0XHR9LFxuXG5cdFx0Y3JlYXRlRGF0YVRhYmxlOiBmdW5jdGlvbiggZGF0YSApIHtcblxuXHRcdFx0dmFyIHRhYmxlU3RyaW5nID0gXCI8dGFibGU+XCI7XG5cblx0XHRcdF8uZWFjaCggZGF0YSwgZnVuY3Rpb24oIHJvd0RhdGEsIHJvd0luZGV4ICkge1xuXG5cdFx0XHRcdHZhciB0ciA9IFwiPHRyPlwiO1xuXHRcdFx0XHRfLmVhY2goIHJvd0RhdGEsIGZ1bmN0aW9uKCBjZWxsRGF0YSwgY2VsbEluZGV4ICkge1xuXHRcdFx0XHRcdC8vaWYoY2VsbERhdGEpIHtcblx0XHRcdFx0XHRcdHZhciB0ZCA9IChyb3dJbmRleCA+IDApPyBcIjx0ZD5cIiArIGNlbGxEYXRhICsgXCI8L3RkPlwiOiBcIjx0aD5cIiArIGNlbGxEYXRhICsgXCI8L3RoPlwiO1xuXHRcdFx0XHRcdFx0dHIgKz0gdGQ7XG5cdFx0XHRcdFx0Ly99XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0dHIgKz0gXCI8L3RyPlwiO1xuXHRcdFx0XHR0YWJsZVN0cmluZyArPSB0cjtcblxuXHRcdFx0fSApO1xuXG5cdFx0XHR0YWJsZVN0cmluZyArPSBcIjwvdGFibGU+XCI7XG5cblx0XHRcdHZhciAkdGFibGUgPSAkKCB0YWJsZVN0cmluZyApO1xuXHRcdFx0dGhpcy4kY3N2SW1wb3J0VGFibGVXcmFwcGVyLmFwcGVuZCggJHRhYmxlICk7XG5cblx0XHR9LFxuXG5cdFx0dXBkYXRlVmFyaWFibGVMaXN0OiBmdW5jdGlvbiggZGF0YSApIHtcblxuXHRcdFx0dmFyICRsaXN0ID0gdGhpcy4kdmFyaWFibGVTZWN0aW9uTGlzdDtcblx0XHRcdCRsaXN0LmVtcHR5KCk7XG5cdFx0XHRcblx0XHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRcdGlmKCBkYXRhICYmIGRhdGEudmFyaWFibGVzICkge1xuXHRcdFx0XHRfLmVhY2goIGRhdGEudmFyaWFibGVzLCBmdW5jdGlvbiggdiwgayApIHtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHQvL2lmIHdlJ3JlIGNyZWF0aW5nIG5ldyB2YXJpYWJsZXMgaW5qZWN0cyBpbnRvIGRhdGEgb2JqZWN0IGV4aXN0aW5nIHZhcmlhYmxlc1xuXHRcdFx0XHRcdGlmKCB0aGF0LmV4aXN0aW5nVmFyaWFibGUgJiYgdGhhdC5leGlzdGluZ1ZhcmlhYmxlLmF0dHIoIFwiZGF0YS1pZFwiICkgPiAwICkge1xuXHRcdFx0XHRcdFx0di5pZCA9IHRoYXQuZXhpc3RpbmdWYXJpYWJsZS5hdHRyKCBcImRhdGEtaWRcIiApO1xuXHRcdFx0XHRcdFx0di5uYW1lID0gdGhhdC5leGlzdGluZ1ZhcmlhYmxlLmF0dHIoIFwiZGF0YS1uYW1lXCIgKTtcblx0XHRcdFx0XHRcdHYudW5pdCA9IHRoYXQuZXhpc3RpbmdWYXJpYWJsZS5hdHRyKCBcImRhdGEtdW5pdFwiICk7XG5cdFx0XHRcdFx0XHR2LmRlc2NyaXB0aW9uID0gdGhhdC5leGlzdGluZ1ZhcmlhYmxlLmF0dHIoIFwiZGF0YS1kZXNjcmlwdGlvblwiICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHZhciAkbGkgPSB0aGF0LmNyZWF0ZVZhcmlhYmxlRWwoIHYgKTtcblx0XHRcdFx0XHQkbGlzdC5hcHBlbmQoICRsaSApO1xuXHRcdFx0XHRcblx0XHRcdFx0fSApO1xuXHRcdFx0fVxuXG5cdFx0fSxcblxuXHRcdGNyZWF0ZVZhcmlhYmxlRWw6IGZ1bmN0aW9uKCBkYXRhICkge1xuXG5cdFx0XHRpZiggIWRhdGEudW5pdCApIHtcblx0XHRcdFx0ZGF0YS51bml0ID0gXCJcIjtcblx0XHRcdH1cblx0XHRcdGlmKCAhZGF0YS5kZXNjcmlwdGlvbiApIHtcblx0XHRcdFx0ZGF0YS5kZXNjcmlwdGlvbiA9IFwiXCI7XG5cdFx0XHR9XG5cblx0XHRcdHZhciBzdHJpbmdpZmllZCA9IEpTT04uc3RyaW5naWZ5KCBkYXRhICk7XG5cdFx0XHQvL3dlaXJkIGJlaGF2aW91ciB3aGVuIHNpbmdsZSBxdW90ZSBpbnNlcnRlZCBpbnRvIGhpZGRlbiBpbnB1dFxuXHRcdFx0c3RyaW5naWZpZWQgPSBzdHJpbmdpZmllZC5yZXBsYWNlKCBcIidcIiwgXCImI3gwMDAyNztcIiApO1xuXHRcdFx0c3RyaW5naWZpZWQgPSBzdHJpbmdpZmllZC5yZXBsYWNlKCBcIidcIiwgXCImI3gwMDAyNztcIiApO1xuXHRcdFx0XG5cdFx0XHR2YXIgJGxpID0gJCggXCI8bGkgY2xhc3M9J3ZhcmlhYmxlLWl0ZW0gY2xlYXJmaXgnPjwvbGk+XCIgKSxcblx0XHRcdFx0JGlucHV0TmFtZSA9ICQoIFwiPGxhYmVsPk5hbWUqPGlucHV0IGNsYXNzPSdmb3JtLWNvbnRyb2wnIHZhbHVlPSdcIiArIGRhdGEubmFtZSArIFwiJyBwbGFjZWhvbGRlcj0nRW50ZXIgdmFyaWFibGUgbmFtZScvPjwvbGFiZWw+XCIgKSxcblx0XHRcdFx0JGlucHV0VW5pdCA9ICQoIFwiPGxhYmVsPlVuaXQ8aW5wdXQgY2xhc3M9J2Zvcm0tY29udHJvbCcgdmFsdWU9J1wiICsgZGF0YS51bml0ICsgXCInIHBsYWNlaG9sZGVyPSdFbnRlciB2YXJpYWJsZSB1bml0JyAvPjwvbGFiZWw+XCIgKSxcblx0XHRcdFx0JGlucHV0RGVzY3JpcHRpb24gPSAkKCBcIjxsYWJlbD5EZXNjcmlwdGlvbjxpbnB1dCBjbGFzcz0nZm9ybS1jb250cm9sJyB2YWx1ZT0nXCIgKyBkYXRhLmRlc2NyaXB0aW9uICsgXCInIHBsYWNlaG9sZGVyPSdFbnRlciB2YXJpYWJsZSBkZXNjcmlwdGlvbicgLz48L2xhYmVsPlwiICksXG5cdFx0XHRcdCRpbnB1dERhdGEgPSAkKCBcIjxpbnB1dCB0eXBlPSdoaWRkZW4nIG5hbWU9J3ZhcmlhYmxlc1tdJyB2YWx1ZT0nXCIgKyBzdHJpbmdpZmllZCArIFwiJyAvPlwiICk7XG5cdFx0XHRcblx0XHRcdCRsaS5hcHBlbmQoICRpbnB1dE5hbWUgKTtcblx0XHRcdCRsaS5hcHBlbmQoICRpbnB1dFVuaXQgKTtcblx0XHRcdCRsaS5hcHBlbmQoICRpbnB1dERlc2NyaXB0aW9uICk7XG5cdFx0XHQkbGkuYXBwZW5kKCAkaW5wdXREYXRhICk7XG5cdFx0XHRcdFxuXHRcdFx0dmFyIHRoYXQgPSB0aGlzLFxuXHRcdFx0XHQkaW5wdXRzID0gJGxpLmZpbmQoIFwiaW5wdXRcIiApO1xuXHRcdFx0JGlucHV0cy5vbiggXCJpbnB1dFwiLCBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0XHQvL3VwZGF0ZSBzdG9yZWQganNvblxuXHRcdFx0XHR2YXIganNvbiA9ICQucGFyc2VKU09OKCAkaW5wdXREYXRhLnZhbCgpICk7XG5cdFx0XHRcdGpzb24ubmFtZSA9ICRpbnB1dE5hbWUuZmluZCggXCJpbnB1dFwiICkudmFsKCk7XG5cdFx0XHRcdGpzb24udW5pdCA9ICRpbnB1dFVuaXQuZmluZCggXCJpbnB1dFwiICkudmFsKCk7XG5cdFx0XHRcdGpzb24uZGVzY3JpcHRpb24gPSAkaW5wdXREZXNjcmlwdGlvbi5maW5kKCBcImlucHV0XCIgKS52YWwoKTtcblx0XHRcdFx0JGlucHV0RGF0YS52YWwoIEpTT04uc3RyaW5naWZ5KCBqc29uICkgKTtcblx0XHRcdH0gKTtcblx0XHRcdCRpbnB1dHMub24oIFwiZm9jdXNcIiwgZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdFx0Ly9zZXQgZmxhZyBzbyB0aGF0IHZhbHVlcyBpbiBpbnB1dCB3b24ndCBnZXQgb3ZlcndyaXR0ZW4gYnkgY2hhbmdlcyB0byBkYXRhc2V0IG5hbWVcblx0XHRcdFx0dGhhdC52YXJpYWJsZU5hbWVNYW51YWwgPSB0cnVlO1xuXHRcdFx0fSk7XG5cblx0XHRcdHJldHVybiAkbGk7XG5cblx0XHR9LFxuXG5cdFx0bWFwRGF0YTogZnVuY3Rpb24oKSB7XG5cblx0XHRcdFxuXHRcdFx0Ly9tYXNzaXZlIGltcG9ydCB2ZXJzaW9uXG5cdFx0XHQvL3ZhciBtYXBwZWREYXRhID0gQXBwLlV0aWxzLm1hcFBhbmVsRGF0YSggdGhpcy51cGxvYWRlZERhdGEucm93cyApLFxuXHRcdFx0dmFyIG1hcHBlZERhdGEgPSAoICF0aGlzLmlzRGF0YU11bHRpVmFyaWFudCApPyAgQXBwLlV0aWxzLm1hcFNpbmdsZVZhcmlhbnREYXRhKCB0aGlzLnVwbG9hZGVkRGF0YS5yb3dzLCB0aGlzLmRhdGFzZXROYW1lICk6IEFwcC5VdGlscy5tYXBNdWx0aVZhcmlhbnREYXRhKCB0aGlzLnVwbG9hZGVkRGF0YS5yb3dzICksXG5cdFx0XHRcdGpzb24gPSB7IFwidmFyaWFibGVzXCI6IG1hcHBlZERhdGEgfSxcblx0XHRcdFx0anNvblN0cmluZyA9IEpTT04uc3RyaW5naWZ5KCBqc29uICk7XG5cblx0XHRcdHRoaXMuJGRhdGFJbnB1dC52YWwoIGpzb25TdHJpbmcgKTtcblx0XHRcdHRoaXMuJHJlbW92ZVVwbG9hZGVkRmlsZUJ0bi5zaG93KCk7XG5cblx0XHRcdHRoaXMudXBkYXRlVmFyaWFibGVMaXN0KCBqc29uICk7XG5cblx0XHR9LFxuXG5cdFx0dmFsaWRhdGVFbnRpdHlEYXRhOiBmdW5jdGlvbiggZGF0YSApIHtcblxuXHRcdFx0LyppZiggdGhpcy5pc0RhdGFNdWx0aVZhcmlhbnQgKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fSovXG5cblx0XHRcdC8vdmFsaWRhdGVFbnRpdHlEYXRhIGRvZXNuJ3QgbW9kaWZ5IHRoZSBvcmlnaW5hbCBkYXRhXG5cdFx0XHR2YXIgJGRhdGFUYWJsZVdyYXBwZXIgPSAkKCBcIi5jc3YtaW1wb3J0LXRhYmxlLXdyYXBwZXJcIiApLFxuXHRcdFx0XHQkZGF0YVRhYmxlID0gJGRhdGFUYWJsZVdyYXBwZXIuZmluZCggXCJ0YWJsZVwiICksXG5cdFx0XHRcdCRlbnRpdGllc0NlbGxzID0gJGRhdGFUYWJsZS5maW5kKCBcInRkOmZpcnN0LWNoaWxkXCIgKSxcblx0XHRcdFx0Ly8kZW50aXRpZXNDZWxscyA9ICRkYXRhVGFibGUuZmluZCggXCJ0aFwiICksXG5cdFx0XHRcdGVudGl0aWVzID0gXy5tYXAoICRlbnRpdGllc0NlbGxzLCBmdW5jdGlvbiggdiApIHsgcmV0dXJuICQoIHYgKS50ZXh0KCk7IH0gKTtcblxuXHRcdFx0Ly9tYWtlIHN1cmUgd2UncmUgbm90IHZhbGlkYXRpbmcgb25lIGVudGl0eSBtdWx0aXBsZSB0aW1lc1xuXHRcdFx0ZW50aXRpZXMgPSBfLnVuaXEoIGVudGl0aWVzICk7XG5cdFx0XHRcblx0XHRcdC8vZ2V0IHJpZCBvZiBmaXJzdCBvbmUgKHRpbWUgbGFiZWwpXG5cdFx0XHQvL2VudGl0aWVzLnNoaWZ0KCk7XG5cblx0XHRcdCQuYWpheCgge1xuXHRcdFx0XHR1cmw6IEdsb2JhbC5yb290VXJsICsgXCIvZW50aXR5SXNvTmFtZXMvdmFsaWRhdGVEYXRhXCIsXG5cdFx0XHRcdGRhdGE6IHsgXCJlbnRpdGllc1wiOiBKU09OLnN0cmluZ2lmeSggZW50aXRpZXMgKSB9LFxuXHRcdFx0XHRiZWZvcmVTZW5kOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHQkZGF0YVRhYmxlV3JhcHBlci5iZWZvcmUoIFwiPHAgY2xhc3M9J2VudGl0aWVzLWxvYWRpbmctbm90aWNlIGxvYWRpbmctbm90aWNlJz5WYWxpZGF0aW5nIGVudGl0aWVzPC9wPlwiICk7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHN1Y2Nlc3M6IGZ1bmN0aW9uKCByZXNwb25zZSApIHtcblx0XHRcdFx0XHRpZiggcmVzcG9uc2UuZGF0YSApIHtcblx0XHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHR2YXIgdW5tYXRjaGVkID0gcmVzcG9uc2UuZGF0YTtcblx0XHRcdFx0XHRcdCRlbnRpdGllc0NlbGxzLnJlbW92ZUNsYXNzKCBcImFsZXJ0LWVycm9yXCIgKTtcblx0XHRcdFx0XHRcdCQuZWFjaCggJGVudGl0aWVzQ2VsbHMsIGZ1bmN0aW9uKCBpLCB2ICkge1xuXHRcdFx0XHRcdFx0XHR2YXIgJGVudGl0eUNlbGwgPSAkKCB0aGlzICksXG5cdFx0XHRcdFx0XHRcdFx0dmFsdWUgPSAkZW50aXR5Q2VsbC50ZXh0KCk7XG5cdFx0XHRcdFx0XHRcdFx0JGVudGl0eUNlbGwucmVtb3ZlQ2xhc3MoIFwiYWxlcnQtZXJyb3JcIiApO1xuXHRcdFx0XHRcdFx0XHRcdCRlbnRpdHlDZWxsLmFkZENsYXNzKCBcImFsZXJ0LXN1Y2Nlc3NcIiApO1xuXHRcdFx0XHRcdFx0XHRpZiggXy5pbmRleE9mKCB1bm1hdGNoZWQsIHZhbHVlICkgPiAtMSApIHtcblx0XHRcdFx0XHRcdFx0XHQkZW50aXR5Q2VsbC5hZGRDbGFzcyggXCJhbGVydC1lcnJvclwiICk7XG5cdFx0XHRcdFx0XHRcdFx0JGVudGl0eUNlbGwucmVtb3ZlQ2xhc3MoIFwiYWxlcnQtc3VjY2Vzc1wiICk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0gKTtcblxuXHRcdFx0XHRcdFx0Ly9yZW1vdmUgcHJlbG9hZGVyXG5cdFx0XHRcdFx0XHQkKCBcIi5lbnRpdGllcy1sb2FkaW5nLW5vdGljZVwiICkucmVtb3ZlKCk7XG5cdFx0XHRcdFx0XHQvL3Jlc3VsdCBub3RpY2Vcblx0XHRcdFx0XHRcdCQoIFwiLmVudGl0aWVzLXZhbGlkYXRpb24td3JhcHBlclwiICkucmVtb3ZlKCk7XG5cdFx0XHRcdFx0XHR2YXIgJHJlc3VsdE5vdGljZSA9ICh1bm1hdGNoZWQubGVuZ3RoKT8gJCggXCI8ZGl2IGNsYXNzPSdlbnRpdGllcy12YWxpZGF0aW9uLXdyYXBwZXInPjxwIGNsYXNzPSdlbnRpdGllcy12YWxpZGF0aW9uLXJlc3VsdCB2YWxpZGF0aW9uLXJlc3VsdCB0ZXh0LWRhbmdlcic+PGkgY2xhc3M9J2ZhIGZhLWV4Y2xhbWF0aW9uLWNpcmNsZSc+PC9pPlNvbWUgY291bnRyaWVzIGRvIG5vdCBoYXZlIDxhIGhyZWY9J2h0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSVNPXzMxNjYnIHRhcmdldD0nX2JsYW5rJz5zdGFuZGFyZGl6ZWQgbmFtZTwvYT4hIFJlbmFtZSB0aGUgaGlnaGxpZ2h0ZWQgY291bnRyaWVzIGFuZCByZXVwbG9hZCBDU1YuPC9wPjxsYWJlbD48aW5wdXQgdHlwZT0nY2hlY2tib3gnIG5hbWU9J3ZhbGlkYXRlX2VudGl0aWVzJy8+SW1wb3J0IGNvdW50cmllcyBhbnl3YXk8L2xhYmVsPjwvZGl2PlwiICk6ICQoIFwiPHAgY2xhc3M9J2VudGl0aWVzLXZhbGlkYXRpb24tcmVzdWx0IHZhbGlkYXRpb24tcmVzdWx0IHRleHQtc3VjY2Vzcyc+PGkgY2xhc3M9J2ZhIGZhLWNoZWNrLWNpcmNsZSc+PC9pPkFsbCBjb3VudHJpZXMgaGF2ZSBzdGFuZGFyZGl6ZWQgbmFtZSwgd2VsbCBkb25lITwvcD5cIiApO1xuXHRcdFx0XHRcdFx0JGRhdGFUYWJsZVdyYXBwZXIuYmVmb3JlKCAkcmVzdWx0Tm90aWNlICk7XG5cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdFxuXHRcdH0sXG5cblx0XHR2YWxpZGF0ZVRpbWVEYXRhOiBmdW5jdGlvbiggZGF0YSApIHtcblxuXHRcdFx0dmFyICRkYXRhVGFibGVXcmFwcGVyID0gJCggXCIuY3N2LWltcG9ydC10YWJsZS13cmFwcGVyXCIgKSxcblx0XHRcdFx0JGRhdGFUYWJsZSA9ICRkYXRhVGFibGVXcmFwcGVyLmZpbmQoIFwidGFibGVcIiApLFxuXHRcdFx0XHQvL21hc3NpdmUgaW1wb3J0IHZlcnNpb25cblx0XHRcdFx0Ly90aW1lRG9tYWluID0gJGRhdGFUYWJsZS5maW5kKCBcInRoOm50aC1jaGlsZCgyKVwiICkudGV4dCgpLFxuXHRcdFx0XHR0aW1lRG9tYWluID0gKCAhdGhpcy5pc0RhdGFNdWx0aVZhcmlhbnQgKT8gJGRhdGFUYWJsZS5maW5kKCBcInRoOmZpcnN0LWNoaWxkXCIgKS50ZXh0KCk6ICRkYXRhVGFibGUuZmluZCggXCJ0aDpudGgtY2hpbGQoMilcIiApLnRleHQoKSxcblx0XHRcdFx0JHRpbWVzQ2VsbHMgPSAoICF0aGlzLmlzRGF0YU11bHRpVmFyaWFudCApPyAkZGF0YVRhYmxlLmZpbmQoIFwidGhcIiApOiAkZGF0YVRhYmxlLmZpbmQoIFwidGQ6bnRoLWNoaWxkKDIpXCIgKTsvKixcblx0XHRcdFx0Ly9tYXNzaXZlIGltcG9ydCB2ZXJzaW9uXG5cdFx0XHRcdC8vJHRpbWVzQ2VsbHMgPSAkZGF0YVRhYmxlLmZpbmQoIFwidGQ6bnRoLWNoaWxkKDIpXCIgKTsvKixcblx0XHRcdFx0dGltZXMgPSBfLm1hcCggJHRpbWVzQ2VsbHMsIGZ1bmN0aW9uKCB2ICkgeyByZXR1cm4gJCggdiApLnRleHQoKSB9ICk7Ki9cblx0XHRcdC8vZm9ybWF0IHRpbWUgZG9tYWluIG1heWJlXG5cdFx0XHRpZiggdGltZURvbWFpbiApIHtcblx0XHRcdFx0dGltZURvbWFpbiA9IHRpbWVEb21haW4udG9Mb3dlckNhc2UoKTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0Ly90aGUgZmlyc3QgY2VsbCAodGltZURvbWFpbikgc2hvdWxkbid0IGJlIHZhbGlkYXRlZFxuXHRcdFx0Ly9tYXNzaXZlIGltcG9ydCB2ZXJzaW9uIC0gY29tbWVudGVkIG91dCBuZXh0IHJvd1xuXHRcdFx0aWYoICF0aGlzLmlzRGF0YU11bHRpVmFyaWFudCApIHtcblx0XHRcdFx0JHRpbWVzQ2VsbHMgPSAkdGltZXNDZWxscy5zbGljZSggMSApO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHQvL21ha2Ugc3VyZSB0aW1lIGlzIGZyb20gZ2l2ZW4gZG9tYWluXG5cdFx0XHRpZiggXy5pbmRleE9mKCBbIFwiY2VudHVyeVwiLCBcImRlY2FkZVwiLCBcInF1YXJ0ZXIgY2VudHVyeVwiLCBcImhhbGYgY2VudHVyeVwiLCBcInllYXJcIiBdLCB0aW1lRG9tYWluICkgPT0gLTEgKSB7XG5cdFx0XHRcdHZhciAkcmVzdWx0Tm90aWNlID0gJCggXCI8cCBjbGFzcz0ndGltZS1kb21haW4tdmFsaWRhdGlvbi1yZXN1bHQgdmFsaWRhdGlvbi1yZXN1bHQgdGV4dC1kYW5nZXInPjxpIGNsYXNzPSdmYSBmYS1leGNsYW1hdGlvbi1jaXJjbGUnPjwvaT5GaXJzdCB0b3AtbGVmdCBjZWxsIHNob3VsZCBjb250YWluIHRpbWUgZG9tYWluIGluZm9tYXJ0aW9uLiBFaXRoZXIgJ2NlbnR1cnknLCBvcidkZWNhZGUnLCBvciAneWVhcicuPC9wPlwiICk7XG5cdFx0XHRcdCRkYXRhVGFibGVXcmFwcGVyLmJlZm9yZSggJHJlc3VsdE5vdGljZSApO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0XHQkLmVhY2goICR0aW1lc0NlbGxzLCBmdW5jdGlvbiggaSwgdiApIHtcblxuXHRcdFx0XHR2YXIgJHRpbWVDZWxsID0gJCggdiApO1xuXHRcdFx0XHRcblx0XHRcdFx0Ly9maW5kIGNvcnJlc3BvbmRpbmcgdmFsdWUgaW4gbG9hZGVkIGRhdGFcblx0XHRcdFx0dmFyIG5ld1ZhbHVlLFxuXHRcdFx0XHRcdC8vbWFzc2l2ZSBpbXBvcnQgdmVyc2lvblxuXHRcdFx0XHRcdC8vb3JpZ1ZhbHVlID0gZGF0YVsgaSsxIF1bIDEgXTtcblx0XHRcdFx0XHRvcmlnVmFsdWUgPSAoICF0aGF0LmlzRGF0YU11bHRpVmFyaWFudCApPyBkYXRhWyAwIF1bIGkrMSBdOiBkYXRhWyBpKzEgXVsgMSBdO1xuXHRcdFx0XHRcblx0XHRcdFx0Ly9jaGVjayB2YWx1ZSBoYXMgNCBkaWdpdHNcblx0XHRcdFx0b3JpZ1ZhbHVlID0gQXBwLlV0aWxzLmFkZFplcm9zKCBvcmlnVmFsdWUgKTtcblxuXHRcdFx0XHR2YXIgdmFsdWUgPSBvcmlnVmFsdWUsXG5cdFx0XHRcdFx0ZGF0ZSA9IG1vbWVudCggbmV3IERhdGUoIHZhbHVlICkgKTtcblx0XHRcdFx0XG5cdFx0XHRcdGlmKCAhZGF0ZS5pc1ZhbGlkKCkgKSB7XG5cblx0XHRcdFx0XHQkdGltZUNlbGwuYWRkQ2xhc3MoIFwiYWxlcnQtZXJyb3JcIiApO1xuXHRcdFx0XHRcdCR0aW1lQ2VsbC5yZW1vdmVDbGFzcyggXCJhbGVydC1zdWNjZXNzXCIgKTtcblx0XHRcdFx0XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0Ly9jb3JyZWN0IGRhdGVcblx0XHRcdFx0XHQkdGltZUNlbGwuYWRkQ2xhc3MoIFwiYWxlcnQtc3VjY2Vzc1wiICk7XG5cdFx0XHRcdFx0JHRpbWVDZWxsLnJlbW92ZUNsYXNzKCBcImFsZXJ0LWVycm9yXCIgKTtcblx0XHRcdFx0XHQvL2luc2VydCBwb3RlbnRpYWxseSBtb2RpZmllZCB2YWx1ZSBpbnRvIGNlbGxcblx0XHRcdFx0XHQkdGltZUNlbGwudGV4dCggdmFsdWUgKTtcblxuXHRcdFx0XHRcdG5ld1ZhbHVlID0geyBcImRcIjogQXBwLlV0aWxzLnJvdW5kVGltZSggZGF0ZSApLCBcImxcIjogb3JpZ1ZhbHVlIH07XG5cblx0XHRcdFx0XHRpZiggdGltZURvbWFpbiA9PSBcInllYXJcIiApIHtcblx0XHRcdFx0XHRcdFxuXHRcdFx0XHRcdFx0Ly90cnkgdG8gZ3Vlc3MgY2VudHVyeVxuXHRcdFx0XHRcdFx0dmFyIHllYXIgPSBNYXRoLmZsb29yKCBvcmlnVmFsdWUgKSxcblx0XHRcdFx0XHRcdFx0bmV4dFllYXIgPSB5ZWFyICsgMTtcblxuXHRcdFx0XHRcdFx0Ly9hZGQgemVyb3Ncblx0XHRcdFx0XHRcdHllYXIgPSBBcHAuVXRpbHMuYWRkWmVyb3MoIHllYXIgKTtcblx0XHRcdFx0XHRcdG5leHRZZWFyID0gQXBwLlV0aWxzLmFkZFplcm9zKCBuZXh0WWVhciApO1xuXHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHQvL2NvbnZlcnQgaXQgdG8gZGF0ZXRpbWUgdmFsdWVzXG5cdFx0XHRcdFx0XHR5ZWFyID0gbW9tZW50KCBuZXcgRGF0ZSggeWVhci50b1N0cmluZygpICkgKTtcblx0XHRcdFx0XHRcdG5leHRZZWFyID0gbW9tZW50KCBuZXcgRGF0ZSggbmV4dFllYXIudG9TdHJpbmcoKSApICkuc2Vjb25kcygtMSk7XG5cdFx0XHRcdFx0XHQvL21vZGlmeSB0aGUgaW5pdGlhbCB2YWx1ZVxuXHRcdFx0XHRcdFx0bmV3VmFsdWVbIFwic2RcIiBdID0gIEFwcC5VdGlscy5yb3VuZFRpbWUoIHllYXIgKTtcblx0XHRcdFx0XHRcdG5ld1ZhbHVlWyBcImVkXCIgXSA9ICBBcHAuVXRpbHMucm91bmRUaW1lKCBuZXh0WWVhciApO1xuXG5cdFx0XHRcdFx0fSBlbHNlIGlmKCB0aW1lRG9tYWluID09IFwiZGVjYWRlXCIgKSB7XG5cdFx0XHRcdFx0XHRcblx0XHRcdFx0XHRcdC8vdHJ5IHRvIGd1ZXNzIGNlbnR1cnlcblx0XHRcdFx0XHRcdHZhciBkZWNhZGUgPSBNYXRoLmZsb29yKCBvcmlnVmFsdWUgLyAxMCApICogMTAsXG5cdFx0XHRcdFx0XHRcdG5leHREZWNhZGUgPSBkZWNhZGUgKyAxMDtcblx0XHRcdFx0XHRcdFxuXHRcdFx0XHRcdFx0Ly9hZGQgemVyb3Ncblx0XHRcdFx0XHRcdGRlY2FkZSA9IEFwcC5VdGlscy5hZGRaZXJvcyggZGVjYWRlICk7XG5cdFx0XHRcdFx0XHRuZXh0RGVjYWRlID0gQXBwLlV0aWxzLmFkZFplcm9zKCBuZXh0RGVjYWRlICk7XG5cblx0XHRcdFx0XHRcdC8vY29udmVydCBpdCB0byBkYXRldGltZSB2YWx1ZXNcblx0XHRcdFx0XHRcdGRlY2FkZSA9IG1vbWVudCggbmV3IERhdGUoIGRlY2FkZS50b1N0cmluZygpICkgKTtcblx0XHRcdFx0XHRcdG5leHREZWNhZGUgPSBtb21lbnQoIG5ldyBEYXRlKCBuZXh0RGVjYWRlLnRvU3RyaW5nKCkgKSApLnNlY29uZHMoLTEpO1xuXHRcdFx0XHRcdFx0Ly9tb2RpZnkgdGhlIGluaXRpYWwgdmFsdWVcblx0XHRcdFx0XHRcdG5ld1ZhbHVlWyBcInNkXCIgXSA9ICBBcHAuVXRpbHMucm91bmRUaW1lKCBkZWNhZGUgKTtcblx0XHRcdFx0XHRcdG5ld1ZhbHVlWyBcImVkXCIgXSA9ICBBcHAuVXRpbHMucm91bmRUaW1lKCBuZXh0RGVjYWRlICk7XG5cblx0XHRcdFx0XHR9IGVsc2UgaWYoIHRpbWVEb21haW4gPT0gXCJxdWFydGVyIGNlbnR1cnlcIiApIHtcblx0XHRcdFx0XHRcdFxuXHRcdFx0XHRcdFx0Ly90cnkgdG8gZ3Vlc3MgcXVhcnRlciBjZW50dXJ5XG5cdFx0XHRcdFx0XHR2YXIgY2VudHVyeSA9IE1hdGguZmxvb3IoIG9yaWdWYWx1ZSAvIDEwMCApICogMTAwLFxuXHRcdFx0XHRcdFx0XHRtb2R1bG8gPSAoIG9yaWdWYWx1ZSAlIDEwMCApLFxuXHRcdFx0XHRcdFx0XHRxdWFydGVyQ2VudHVyeTtcblx0XHRcdFx0XHRcdFxuXHRcdFx0XHRcdFx0Ly93aGljaCBxdWFydGVyIGlzIGl0XG5cdFx0XHRcdFx0XHRpZiggbW9kdWxvIDwgMjUgKSB7XG5cdFx0XHRcdFx0XHRcdHF1YXJ0ZXJDZW50dXJ5ID0gY2VudHVyeTtcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiggbW9kdWxvIDwgNTAgKSB7XG5cdFx0XHRcdFx0XHRcdHF1YXJ0ZXJDZW50dXJ5ID0gY2VudHVyeSsyNTtcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiggbW9kdWxvIDwgNzUgKSB7XG5cdFx0XHRcdFx0XHRcdHF1YXJ0ZXJDZW50dXJ5ID0gY2VudHVyeSs1MDtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHF1YXJ0ZXJDZW50dXJ5ID0gY2VudHVyeSs3NTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHR2YXIgbmV4dFF1YXJ0ZXJDZW50dXJ5ID0gcXVhcnRlckNlbnR1cnkgKyAyNTtcblxuXHRcdFx0XHRcdFx0Ly9hZGQgemVyb3Ncblx0XHRcdFx0XHRcdHF1YXJ0ZXJDZW50dXJ5ID0gQXBwLlV0aWxzLmFkZFplcm9zKCBxdWFydGVyQ2VudHVyeSApO1xuXHRcdFx0XHRcdFx0bmV4dFF1YXJ0ZXJDZW50dXJ5ID0gQXBwLlV0aWxzLmFkZFplcm9zKCBuZXh0UXVhcnRlckNlbnR1cnkgKTtcblxuXHRcdFx0XHRcdFx0Ly9jb252ZXJ0IGl0IHRvIGRhdGV0aW1lIHZhbHVlc1xuXHRcdFx0XHRcdFx0cXVhcnRlckNlbnR1cnkgPSBtb21lbnQoIG5ldyBEYXRlKCBxdWFydGVyQ2VudHVyeS50b1N0cmluZygpICkgKTtcblx0XHRcdFx0XHRcdG5leHRRdWFydGVyQ2VudHVyeSA9IG1vbWVudCggbmV3IERhdGUoIG5leHRRdWFydGVyQ2VudHVyeS50b1N0cmluZygpICkgKS5zZWNvbmRzKC0xKTtcblx0XHRcdFx0XHRcdC8vbW9kaWZ5IHRoZSBpbml0aWFsIHZhbHVlXG5cdFx0XHRcdFx0XHRuZXdWYWx1ZVsgXCJzZFwiIF0gPSAgQXBwLlV0aWxzLnJvdW5kVGltZSggcXVhcnRlckNlbnR1cnkgKTtcblx0XHRcdFx0XHRcdG5ld1ZhbHVlWyBcImVkXCIgXSA9ICBBcHAuVXRpbHMucm91bmRUaW1lKCBuZXh0UXVhcnRlckNlbnR1cnkgKTtcblxuXHRcdFx0XHRcdH0gZWxzZSBpZiggdGltZURvbWFpbiA9PSBcImhhbGYgY2VudHVyeVwiICkge1xuXHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHQvL3RyeSB0byBndWVzcyBoYWxmIGNlbnR1cnlcblx0XHRcdFx0XHRcdHZhciBjZW50dXJ5ID0gTWF0aC5mbG9vciggb3JpZ1ZhbHVlIC8gMTAwICkgKiAxMDAsXG5cdFx0XHRcdFx0XHRcdC8vaXMgaXQgZmlyc3Qgb3Igc2Vjb25kIGhhbGY/XG5cdFx0XHRcdFx0XHRcdGhhbGZDZW50dXJ5ID0gKCBvcmlnVmFsdWUgJSAxMDAgPCA1MCApPyBjZW50dXJ5OiBjZW50dXJ5KzUwLFxuXHRcdFx0XHRcdFx0XHRuZXh0SGFsZkNlbnR1cnkgPSBoYWxmQ2VudHVyeSArIDUwO1xuXG5cdFx0XHRcdFx0XHQvL2FkZCB6ZXJvc1xuXHRcdFx0XHRcdFx0aGFsZkNlbnR1cnkgPSBBcHAuVXRpbHMuYWRkWmVyb3MoIGhhbGZDZW50dXJ5ICk7XG5cdFx0XHRcdFx0XHRuZXh0SGFsZkNlbnR1cnkgPSBBcHAuVXRpbHMuYWRkWmVyb3MoIG5leHRIYWxmQ2VudHVyeSApO1xuXG5cdFx0XHRcdFx0XHQvL2NvbnZlcnQgaXQgdG8gZGF0ZXRpbWUgdmFsdWVzXG5cdFx0XHRcdFx0XHRoYWxmQ2VudHVyeSA9IG1vbWVudCggbmV3IERhdGUoIGhhbGZDZW50dXJ5LnRvU3RyaW5nKCkgKSApO1xuXHRcdFx0XHRcdFx0bmV4dEhhbGZDZW50dXJ5ID0gbW9tZW50KCBuZXcgRGF0ZSggbmV4dEhhbGZDZW50dXJ5LnRvU3RyaW5nKCkgKSApLnNlY29uZHMoLTEpO1xuXHRcdFx0XHRcdFx0Ly9tb2RpZnkgdGhlIGluaXRpYWwgdmFsdWVcblx0XHRcdFx0XHRcdG5ld1ZhbHVlWyBcInNkXCIgXSA9ICBBcHAuVXRpbHMucm91bmRUaW1lKCBoYWxmQ2VudHVyeSApO1xuXHRcdFx0XHRcdFx0bmV3VmFsdWVbIFwiZWRcIiBdID0gIEFwcC5VdGlscy5yb3VuZFRpbWUoIG5leHRIYWxmQ2VudHVyeSApO1xuXG5cdFx0XHRcdFx0fSBlbHNlIGlmKCB0aW1lRG9tYWluID09IFwiY2VudHVyeVwiICkge1xuXHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHQvL3RyeSB0byBndWVzcyBjZW50dXJ5XG5cdFx0XHRcdFx0XHR2YXIgY2VudHVyeSA9IE1hdGguZmxvb3IoIG9yaWdWYWx1ZSAvIDEwMCApICogMTAwLFxuXHRcdFx0XHRcdFx0XHRuZXh0Q2VudHVyeSA9IGNlbnR1cnkgKyAxMDA7XG5cblx0XHRcdFx0XHRcdC8vYWRkIHplcm9zXG5cdFx0XHRcdFx0XHRjZW50dXJ5ID0gQXBwLlV0aWxzLmFkZFplcm9zKCBjZW50dXJ5ICk7XG5cdFx0XHRcdFx0XHRuZXh0Q2VudHVyeSA9IEFwcC5VdGlscy5hZGRaZXJvcyggbmV4dENlbnR1cnkgKTtcblxuXHRcdFx0XHRcdFx0Ly9jb252ZXJ0IGl0IHRvIGRhdGV0aW1lIHZhbHVlc1xuXHRcdFx0XHRcdFx0Y2VudHVyeSA9IG1vbWVudCggbmV3IERhdGUoIGNlbnR1cnkudG9TdHJpbmcoKSApICk7XG5cdFx0XHRcdFx0XHRuZXh0Q2VudHVyeSA9IG1vbWVudCggbmV3IERhdGUoIG5leHRDZW50dXJ5LnRvU3RyaW5nKCkgKSApLnNlY29uZHMoLTEpO1xuXHRcdFx0XHRcdFx0Ly9tb2RpZnkgdGhlIGluaXRpYWwgdmFsdWVcblx0XHRcdFx0XHRcdG5ld1ZhbHVlWyBcInNkXCIgXSA9IEFwcC5VdGlscy5yb3VuZFRpbWUoIGNlbnR1cnkgKTtcblx0XHRcdFx0XHRcdG5ld1ZhbHVlWyBcImVkXCIgXSA9IEFwcC5VdGlscy5yb3VuZFRpbWUoIG5leHRDZW50dXJ5ICk7XG5cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvL2luc2VydCBpbmZvIGFib3V0IHRpbWUgZG9tYWluXG5cdFx0XHRcdFx0bmV3VmFsdWVbIFwidGRcIiBdID0gdGltZURvbWFpbjtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHQvL2luaXRpYWwgd2FzIG51bWJlci9zdHJpbmcgc28gcGFzc2VkIGJ5IHZhbHVlLCBuZWVkIHRvIGluc2VydCBpdCBiYWNrIHRvIGFycmVheVxuXHRcdFx0XHRcdGlmKCAhdGhhdC5pc0RhdGFNdWx0aVZhcmlhbnQgKSB7XG5cdFx0XHRcdFx0XHRkYXRhWyAwIF1bIGkrMSBdID0gbmV3VmFsdWU7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGRhdGFbIGkrMSBdWyAxIF0gPSBuZXdWYWx1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Ly9tYXNzaXZlIGltcG9ydCB2ZXJzaW9uXG5cdFx0XHRcdFx0Ly9kYXRhWyBpKzEgXVsgMSBdID0gbmV3VmFsdWU7XG5cblx0XHRcdFx0fVxuXG5cdFx0XHR9KTtcblxuXHRcdFx0dmFyICRyZXN1bHROb3RpY2U7XG5cblx0XHRcdC8vcmVtb3ZlIGFueSBwcmV2aW91c2x5IGF0dGFjaGVkIG5vdGlmaWNhdGlvbnNcblx0XHRcdCQoIFwiLnRpbWVzLXZhbGlkYXRpb24tcmVzdWx0XCIgKS5yZW1vdmUoKTtcblxuXHRcdFx0aWYoICR0aW1lc0NlbGxzLmZpbHRlciggXCIuYWxlcnQtZXJyb3JcIiApLmxlbmd0aCApIHtcblx0XHRcdFx0XG5cdFx0XHRcdCRyZXN1bHROb3RpY2UgPSAkKCBcIjxwIGNsYXNzPSd0aW1lcy12YWxpZGF0aW9uLXJlc3VsdCB2YWxpZGF0aW9uLXJlc3VsdCB0ZXh0LWRhbmdlcic+PGkgY2xhc3M9J2ZhIGZhLWV4Y2xhbWF0aW9uLWNpcmNsZSc+PC9pPlRpbWUgaW5mb3JtYXRpb24gaW4gdGhlIHVwbG9hZGVkIGZpbGUgaXMgbm90IGluIDxhIGhyZWY9J2h0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSVNPXzg2MDEnIHRhcmdldD0nX2JsYW5rJz5zdGFuZGFyZGl6ZWQgZm9ybWF0IChZWVlZLU1NLUREKTwvYT4hIEZpeCB0aGUgaGlnaGxpZ2h0ZWQgdGltZSBpbmZvcm1hdGlvbiBhbmQgcmV1cGxvYWQgQ1NWLjwvcD5cIiApO1xuXHRcdFx0XG5cdFx0XHR9IGVsc2Uge1xuXG5cdFx0XHRcdCRyZXN1bHROb3RpY2UgPSAkKCBcIjxwIGNsYXNzPSd0aW1lcy12YWxpZGF0aW9uLXJlc3VsdCB2YWxpZGF0aW9uLXJlc3VsdCB0ZXh0LXN1Y2Nlc3MnPjxpIGNsYXNzPSdmYSBmYS1jaGVjay1jaXJjbGUnPjwvaT5UaW1lIGluZm9ybWF0aW9uIGluIHRoZSB1cGxvYWRlZCBmaWxlIGlzIGNvcnJlY3QsIHdlbGwgZG9uZSE8L3A+XCIgKTtcblxuXHRcdFx0fVxuXHRcdFx0JGRhdGFUYWJsZVdyYXBwZXIuYmVmb3JlKCAkcmVzdWx0Tm90aWNlICk7XG5cdFx0XHRcblx0XHR9LFxuXG5cdFx0b25EYXRhc2V0RGVzY3JpcHRpb246IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdHZhciAkYnRuID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKTtcblx0XHRcdFxuXHRcdFx0aWYoIHRoaXMuJG5ld0RhdGFzZXREZXNjcmlwdGlvbi5pcyggXCI6dmlzaWJsZVwiICkgKSB7XG5cdFx0XHRcdHRoaXMuJG5ld0RhdGFzZXREZXNjcmlwdGlvbi5oaWRlKCk7XG5cdFx0XHRcdCRidG4uZmluZCggXCJzcGFuXCIgKS50ZXh0KCBcIkFkZCBkYXRhc2V0IGRlc2NyaXB0aW9uLlwiICk7XG5cdFx0XHRcdCRidG4uZmluZCggXCJpXCIgKS5yZW1vdmVDbGFzcyggXCJmYS1taW51c1wiICk7XG5cdFx0XHRcdCRidG4uZmluZCggXCJpXCIgKS5hZGRDbGFzcyggXCJmYS1wbHVzXCIgKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuJG5ld0RhdGFzZXREZXNjcmlwdGlvbi5zaG93KCk7XG5cdFx0XHRcdCRidG4uZmluZCggXCJzcGFuXCIgKS50ZXh0KCBcIk5ldmVybWluZCwgbm8gZGVzY3JpcHRpb24uXCIgKTtcblx0XHRcdFx0JGJ0bi5maW5kKCBcImlcIiApLmFkZENsYXNzKCBcImZhLW1pbnVzXCIgKTtcblx0XHRcdFx0JGJ0bi5maW5kKCBcImlcIiApLnJlbW92ZUNsYXNzKCBcImZhLXBsdXNcIiApO1xuXHRcdFx0fVxuXG5cdFx0fSxcblxuXHRcdG9uTmV3RGF0YXNldENoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dmFyICRpbnB1dCA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICk7XG5cdFx0XHRpZiggJGlucHV0LnZhbCgpID09PSBcIjBcIiApIHtcblx0XHRcdFx0dGhpcy4kbmV3RGF0YXNldFNlY3Rpb24uaGlkZSgpO1xuXHRcdFx0XHR0aGlzLiRleGlzdGluZ0RhdGFzZXRTZWN0aW9uLnNob3coKTtcblx0XHRcdFx0Ly9zaG91bGQgd2UgYXBwZWFyIHZhcmlhYmxlIHNlbGVjdCBhcyB3ZWxsP1xuXHRcdFx0XHRpZiggIXRoaXMuJGV4aXN0aW5nRGF0YXNldFNlbGVjdC52YWwoKSApIHtcblx0XHRcdFx0XHR0aGlzLiRleGlzdGluZ1ZhcmlhYmxlc1dyYXBwZXIuaGlkZSgpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMuJGV4aXN0aW5nVmFyaWFibGVzV3JhcHBlci5zaG93KCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuJG5ld0RhdGFzZXRTZWN0aW9uLnNob3coKTtcblx0XHRcdFx0dGhpcy4kZXhpc3RpbmdEYXRhc2V0U2VjdGlvbi5oaWRlKCk7XG5cdFx0XHR9XG5cblx0XHR9LFxuXG5cdFx0b25OZXdEYXRhc2V0TmFtZUNoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dmFyICRpbnB1dCA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICk7XG5cdFx0XHR0aGlzLmRhdGFzZXROYW1lID0gJGlucHV0LnZhbCgpO1xuXG5cdFx0XHQvL2NoZWNrIGlmIHdlIGhhdmUgdmFsdWUgZm9yIHZhcmlhYmxlLCBlbnRlciBpZiBub3Rcblx0XHRcdHZhciAkdmFyaWFibGVJdGVtcyA9IHRoaXMuJHZhcmlhYmxlU2VjdGlvbkxpc3QuZmluZCggXCIudmFyaWFibGUtaXRlbVwiICk7XG5cdFx0XHRpZiggJHZhcmlhYmxlSXRlbXMubGVuZ3RoID09IDEgJiYgIXRoaXMudmFyaWFibGVOYW1lTWFudWFsICkge1xuXHRcdFx0XHQvL3dlIGhhdmUganVzdCBvbmUsIGNoZWNrIFxuXHRcdFx0XHR2YXIgJHZhcmlhYmxlSXRlbSA9ICR2YXJpYWJsZUl0ZW1zLmVxKCAwICksXG5cdFx0XHRcdFx0JGZpcnN0SW5wdXQgPSAkdmFyaWFibGVJdGVtLmZpbmQoIFwiaW5wdXRcIiApLmZpcnN0KCk7XG5cdFx0XHRcdCRmaXJzdElucHV0LnZhbCggdGhpcy5kYXRhc2V0TmFtZSApO1xuXHRcdFx0XHQkZmlyc3RJbnB1dC50cmlnZ2VyKCBcImlucHV0XCIgKTtcblx0XHRcdH1cblxuXHRcdH0sXG5cblx0XHRvbkV4aXN0aW5nRGF0YXNldENoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dmFyICRpbnB1dCA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICk7XG5cdFx0XHR0aGlzLmRhdGFzZXROYW1lID0gJGlucHV0LmZpbmQoICdvcHRpb246c2VsZWN0ZWQnICkudGV4dCgpO1xuXG5cdFx0XHRpZiggJGlucHV0LnZhbCgpICkge1xuXHRcdFx0XHQvL2ZpbHRlciB2YXJpYWJsZSBzZWxlY3QgdG8gc2hvdyB2YXJpYWJsZXMgb25seSBmcm9tIGdpdmVuIGRhdGFzZXRcblx0XHRcdFx0dmFyICRvcHRpb25zID0gdGhpcy4kZXhpc3RpbmdWYXJpYWJsZXNTZWxlY3QuZmluZCggXCJvcHRpb25cIiApO1xuXHRcdFx0XHQkb3B0aW9ucy5oaWRlKCk7XG5cdFx0XHRcdCRvcHRpb25zLmZpbHRlciggXCJbZGF0YS1kYXRhc2V0LWlkPVwiICsgJGlucHV0LnZhbCgpICsgXCJdXCIgKS5zaG93KCk7XG5cdFx0XHRcdC8vYXBwZWFyIGFsc28gdGhlIGZpcnN0IGRlZmF1bHRcblx0XHRcdFx0JG9wdGlvbnMuZmlyc3QoKS5zaG93KCk7XG5cdFx0XHRcdHRoaXMuJGV4aXN0aW5nVmFyaWFibGVzV3JhcHBlci5zaG93KCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLiRleGlzdGluZ1ZhcmlhYmxlc1dyYXBwZXIuaGlkZSgpO1xuXHRcdFx0fVxuXG5cdFx0fSxcblxuXHRcdG9uRXhpc3RpbmdWYXJpYWJsZUNoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dmFyICRpbnB1dCA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICk7XG5cdFx0XHR0aGlzLmV4aXN0aW5nVmFyaWFibGUgPSAkaW5wdXQuZmluZCggJ29wdGlvbjpzZWxlY3RlZCcgKTtcblx0XG5cdFx0fSxcblxuXHRcdG9uUmVtb3ZlVXBsb2FkZWRGaWxlOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHR0aGlzLiRmaWxlUGlja2VyLnJlcGxhY2VXaXRoKCB0aGlzLiRmaWxlUGlja2VyLmNsb25lKCkgKTtcblx0XHRcdC8vcmVmZXRjaCBkb21cblx0XHRcdHRoaXMuJGZpbGVQaWNrZXIgPSB0aGlzLiRlbC5maW5kKCBcIi5maWxlLXBpY2tlci13cmFwcGVyIFt0eXBlPWZpbGVdXCIgKTtcblx0XHRcdHRoaXMuJGZpbGVQaWNrZXIucHJvcCggXCJkaXNhYmxlZFwiLCBmYWxzZSk7XG5cblx0XHRcdC8vcmVzZXQgcmVsYXRlZCBjb21wb25lbnRzXG5cdFx0XHR0aGlzLiRjc3ZJbXBvcnRUYWJsZVdyYXBwZXIuZW1wdHkoKTtcblx0XHRcdHRoaXMuJGRhdGFJbnB1dC52YWwoXCJcIik7XG5cdFx0XHQvL3JlbW92ZSBub3RpZmljYXRpb25zXG5cdFx0XHR0aGlzLiRjc3ZJbXBvcnRSZXN1bHQuZmluZCggXCIudmFsaWRhdGlvbi1yZXN1bHRcIiApLnJlbW92ZSgpO1xuXG5cdFx0XHR0aGlzLmluaXRVcGxvYWQoKTtcblxuXHRcdH0sXG5cblx0XHRvbkNhdGVnb3J5Q2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0XG5cdFx0XHR2YXIgJGlucHV0ID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKTtcblx0XHRcdGlmKCAkaW5wdXQudmFsKCkgIT0gXCJcIiApIHtcblx0XHRcdFx0dGhpcy4kc3ViY2F0ZWdvcnlTZWxlY3Quc2hvdygpO1xuXHRcdFx0XHR0aGlzLiRzdWJjYXRlZ29yeVNlbGVjdC5jc3MoIFwiZGlzcGxheVwiLCBcImJsb2NrXCIgKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuJHN1YmNhdGVnb3J5U2VsZWN0LmhpZGUoKTtcblx0XHRcdH1cblxuXHRcdFx0Ly9maWx0ZXIgc3ViY2F0ZWdvcmllcyBzZWxlY3Rcblx0XHRcdHRoaXMuJHN1YmNhdGVnb3J5U2VsZWN0LmZpbmQoIFwib3B0aW9uXCIgKS5oaWRlKCk7XG5cdFx0XHR0aGlzLiRzdWJjYXRlZ29yeVNlbGVjdC5maW5kKCBcIm9wdGlvbltkYXRhLWNhdGVnb3J5LWlkPVwiICsgJGlucHV0LnZhbCgpICsgXCJdXCIgKS5zaG93KCk7XG5cblx0XHR9LFxuXG5cdFx0b25EYXRhc291cmNlQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHR2YXIgJHRhcmdldCA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICk7XG5cdFx0XHRpZiggJHRhcmdldC52YWwoKSA8IDEgKSB7XG5cdFx0XHRcdHRoaXMuJG5ld0RhdGFzb3VyY2VXcmFwcGVyLnNsaWRlRG93bigpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy4kbmV3RGF0YXNvdXJjZVdyYXBwZXIuc2xpZGVVcCgpO1xuXHRcdFx0fVxuXG5cdFx0fSxcblxuXHRcdG9uU3ViQ2F0ZWdvcnlDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHRcblx0XHR9LFxuXG5cdFx0b25NdWx0aXZhcmlhbnREYXRhc2V0Q2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHR2YXIgJGlucHV0ID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKTtcblx0XHRcdGlmKCAkaW5wdXQudmFsKCkgPT09IFwiMVwiICkge1xuXHRcdFx0XHR0aGlzLmlzRGF0YU11bHRpVmFyaWFudCA9IHRydWU7XG5cdFx0XHRcdC8vJCggXCIudmFsaWRhdGlvbi1yZXN1bHRcIiApLnJlbW92ZSgpO1xuXHRcdFx0XHQvLyQoIFwiLmVudGl0aWVzLXZhbGlkYXRpb24td3JhcHBlclwiICkucmVtb3ZlKCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmlzRGF0YU11bHRpVmFyaWFudCA9IGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiggdGhpcy51cGxvYWRlZERhdGEgJiYgdGhpcy5vcmlnVXBsb2FkZWREYXRhICkge1xuXG5cdFx0XHRcdC8vaW5zZXJ0IG9yaWdpbmFsIHVwbG9hZGVkRGF0YSBpbnRvIGFycmF5IGJlZm9yZSBwcm9jZXNzaW5nXG5cdFx0XHRcdHRoaXMudXBsb2FkZWREYXRhID0gJC5leHRlbmQoIHRydWUsIHt9LCB0aGlzLm9yaWdVcGxvYWRlZERhdGEpO1xuXHRcdFx0XHQvL3JlLXZhbGlkYXRlXG5cdFx0XHRcdHRoaXMudmFsaWRhdGVFbnRpdHlEYXRhKCB0aGlzLnVwbG9hZGVkRGF0YS5yb3dzICk7XG5cdFx0XHRcdHRoaXMudmFsaWRhdGVUaW1lRGF0YSggdGhpcy51cGxvYWRlZERhdGEucm93cyApO1xuXHRcdFx0XHR0aGlzLm1hcERhdGEoKTtcblxuXHRcdFx0fVxuXHRcdFx0XG5cdFx0fSxcblxuXHRcdG9uRm9ybVN1Ym1pdDogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cblx0XHRcdHZhciAkdmFsaWRhdGVFbnRpdGllc0NoZWNrYm94ID0gJCggXCJbbmFtZT0ndmFsaWRhdGVfZW50aXRpZXMnXVwiICksXG5cdFx0XHRcdHZhbGlkYXRlRW50aXRpZXMgPSAoICR2YWxpZGF0ZUVudGl0aWVzQ2hlY2tib3guaXMoIFwiOmNoZWNrZWRcIiApICk/IGZhbHNlOiB0cnVlLFxuXHRcdFx0XHQkdmFsaWRhdGlvblJlc3VsdHMgPSBbXTtcblxuXHRcdFx0Ly9kaXNwbGF5IHZhbGlkYXRpb24gcmVzdWx0c1xuXHRcdFx0Ly92YWxpZGF0ZSBlbnRlcmVkIGRhdGFzb3VyY2VzXG5cdFx0XHR2YXIgJHNvdXJjZURlc2NyaXB0aW9uID0gJCggXCJbbmFtZT0nc291cmNlX2Rlc2NyaXB0aW9uJ11cIiApLFxuXHRcdFx0XHRzb3VyY2VEZXNjcmlwdGlvblZhbHVlID0gJHNvdXJjZURlc2NyaXB0aW9uLnZhbCgpLFxuXHRcdFx0XHRoYXNWYWxpZFNvdXJjZSA9IHRydWU7XG5cdFx0XHRpZiggc291cmNlRGVzY3JpcHRpb25WYWx1ZS5zZWFyY2goIFwiPHRkPmUuZy5cIiApID4gLTEgfHwgc291cmNlRGVzY3JpcHRpb25WYWx1ZS5zZWFyY2goIFwiPHA+ZS5nLlwiICkgPiAtMSApIHtcblx0XHRcdFx0aGFzVmFsaWRTb3VyY2UgPSBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHZhciAkc291cmNlVmFsaWRhdGlvbk5vdGljZSA9ICQoIFwiLnNvdXJjZS12YWxpZGF0aW9uLXJlc3VsdFwiICk7XG5cdFx0XHRpZiggIWhhc1ZhbGlkU291cmNlICkge1xuXHRcdFx0XHQvL2ludmFsaWRcblx0XHRcdFx0aWYoICEkc291cmNlVmFsaWRhdGlvbk5vdGljZS5sZW5ndGggKSB7XG5cdFx0XHRcdFx0Ly9kb2Vucyd0IGhhdmUgbm90aWNlIHlldFxuXHRcdFx0XHRcdCRzb3VyY2VWYWxpZGF0aW9uTm90aWNlID0gJCggXCI8cCBjbGFzcz0nc291cmNlLXZhbGlkYXRpb24tcmVzdWx0IHZhbGlkYXRpb24tcmVzdWx0IHRleHQtZGFuZ2VyJz48aSBjbGFzcz0nZmEgZmEtZXhjbGFtYXRpb24tY2lyY2xlJz4gUGxlYXNlIHJlcGxhY2UgdGhlIHNhbXBsZSBkYXRhIHdpdGggcmVhbCBkYXRhc291cmNlIGluZm8uPC9wPlwiICk7XG5cdFx0XHRcdFx0JHNvdXJjZURlc2NyaXB0aW9uLmJlZm9yZSggJHNvdXJjZVZhbGlkYXRpb25Ob3RpY2UgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQkc291cmNlVmFsaWRhdGlvbk5vdGljZS5zaG93KCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vdmFsaWQsIG1ha2Ugc3VyZSB0aGVyZSdzIG5vdCBcblx0XHRcdFx0JHNvdXJjZVZhbGlkYXRpb25Ob3RpY2UucmVtb3ZlKCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vY2F0ZWdvcnkgdmFsaWRhdGlvblxuXHRcdFx0dmFyICRjYXRlZ29yeVZhbGlkYXRpb25Ob3RpY2UgPSAkKCBcIi5jYXRlZ29yeS12YWxpZGF0aW9uLXJlc3VsdFwiICk7XG5cdFx0XHRpZiggIXRoaXMuJGNhdGVnb3J5U2VsZWN0LnZhbCgpIHx8ICF0aGlzLiRzdWJjYXRlZ29yeVNlbGVjdC52YWwoKSApIHtcblx0XHRcdFx0aWYoICEkY2F0ZWdvcnlWYWxpZGF0aW9uTm90aWNlLmxlbmd0aCApIHtcblx0XHRcdFx0XHQkY2F0ZWdvcnlWYWxpZGF0aW9uTm90aWNlID0gJCggXCI8cCBjbGFzcz0nY2F0ZWdvcnktdmFsaWRhdGlvbi1yZXN1bHQgdmFsaWRhdGlvbi1yZXN1bHQgdGV4dC1kYW5nZXInPjxpIGNsYXNzPSdmYSBmYS1leGNsYW1hdGlvbi1jaXJjbGUnPiBQbGVhc2UgY2hvb3NlIGNhdGVnb3J5IGZvciB1cGxvYWRlZCBkYXRhLjwvcD5cIiApO1xuXHRcdFx0XHRcdHRoaXMuJGNhdGVnb3J5U2VsZWN0LmJlZm9yZSggJGNhdGVnb3J5VmFsaWRhdGlvbk5vdGljZSApO1xuXHRcdFx0XHR9IHtcblx0XHRcdFx0XHQkY2F0ZWdvcnlWYWxpZGF0aW9uTm90aWNlLnNob3coKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly92YWxpZCwgbWFrZSBzdXJlIHRvIHJlbW92ZVxuXHRcdFx0XHQkY2F0ZWdvcnlWYWxpZGF0aW9uTm90aWNlLnJlbW92ZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHQvL2RpZmZlcmVudCBzY2VuYXJpb3Mgb2YgdmFsaWRhdGlvblxuXHRcdFx0aWYoIHZhbGlkYXRlRW50aXRpZXMgKSB7XG5cdFx0XHRcdC8vdmFsaWRhdGUgYm90aCB0aW1lIGFuZCBlbnRpdGl5ZVxuXHRcdFx0XHQkdmFsaWRhdGlvblJlc3VsdHMgPSAkKCBcIi52YWxpZGF0aW9uLXJlc3VsdC50ZXh0LWRhbmdlclwiICk7XG5cdFx0XHR9IGVsc2UgaWYoICF2YWxpZGF0ZUVudGl0aWVzICkge1xuXHRcdFx0XHQvL3ZhbGlkYXRlIG9ubHkgdGltZVxuXHRcdFx0XHQkdmFsaWRhdGlvblJlc3VsdHMgPSAkKCBcIi50aW1lLWRvbWFpbi12YWxpZGF0aW9uLXJlc3VsdC50ZXh0LWRhbmdlciwgLnRpbWVzLXZhbGlkYXRpb24tcmVzdWx0LnRleHQtZGFuZ2VyLCAuc291cmNlLXZhbGlkYXRpb24tcmVzdWx0LCAuY2F0ZWdvcnktdmFsaWRhdGlvbi1yZXN1bHRcIiApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly9kbyBub3QgdmFsaWRhdGVcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0Y29uc29sZS5sb2coIFwidmFsaWRhdGlvblJlc3VsdHMubGVuZ3RoXCIsICR2YWxpZGF0aW9uUmVzdWx0cy5sZW5ndGggKTtcblxuXHRcdFx0aWYoICR2YWxpZGF0aW9uUmVzdWx0cy5sZW5ndGggKSB7XG5cdFx0XHRcdC8vZG8gbm90IHNlbmQgZm9ybSBhbmQgc2Nyb2xsIHRvIGVycm9yIG1lc3NhZ2Vcblx0XHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdCQoJ2h0bWwsIGJvZHknKS5hbmltYXRlKHtcblx0XHRcdFx0XHRzY3JvbGxUb3A6ICR2YWxpZGF0aW9uUmVzdWx0cy5vZmZzZXQoKS50b3AgLSAxOFxuXHRcdFx0XHR9LCAzMDApO1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdC8vZXZ0IFxuXHRcdFx0dmFyICRidG4gPSAkKCBcIlt0eXBlPXN1Ym1pdF1cIiApO1xuXHRcdFx0JGJ0bi5wcm9wKCBcImRpc2FibGVkXCIsIHRydWUgKTtcblx0XHRcdCRidG4uY3NzKCBcIm9wYWNpdHlcIiwgMC41ICk7XG5cblx0XHRcdCRidG4uYWZ0ZXIoIFwiPHAgY2xhc3M9J3NlbmQtbm90aWZpY2F0aW9uJz48aSBjbGFzcz0nZmEgZmEtc3Bpbm5lciBmYS1zcGluJz48L2k+U2VuZGluZyBmb3JtPC9wPlwiICk7XG5cblx0XHRcdC8vc2VyaWFsaXplIGFycmF5XG5cdFx0XHR2YXIgJGZvcm0gPSAkKCBcIiNpbXBvcnQtdmlldyA+IGZvcm1cIiApO1xuXHRcdFx0XG5cdFx0XHR2YXIgaW1wb3J0ZXIgPSBuZXcgQXBwLk1vZGVscy5JbXBvcnRlciggeyBkaXNwYXRjaGVyOiB0aGlzLmRpc3BhdGNoZXIgfSApO1xuXHRcdFx0aW1wb3J0ZXIudXBsb2FkRm9ybURhdGEoICRmb3JtLCB0aGlzLm9yaWdVcGxvYWRlZERhdGEgKTtcblxuXHRcdFx0dmFyIGltcG9ydFByb2dyZXNzID0gbmV3IEFwcC5WaWV3cy5VSS5JbXBvcnRQcm9ncmVzc1BvcHVwKCk7XG5cdFx0XHRpbXBvcnRQcm9ncmVzcy5pbml0KCB7IGRpc3BhdGNoZXI6IHRoaXMuZGlzcGF0Y2hlciB9ICk7XG5cdFx0XHRpbXBvcnRQcm9ncmVzcy5zaG93KCk7XG5cblx0XHRcdHJldHVybiBmYWxzZTtcblxuXG5cdFx0fVxuXG5cblx0fSk7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVmlld3MuSW1wb3J0VmlldztcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBDaGFydE1vZGVsID0gcmVxdWlyZSggXCIuLy4uL21vZGVscy9BcHAuTW9kZWxzLkNoYXJ0TW9kZWwuanNcIiApLFxuXHRcdEZvcm1WaWV3ID0gcmVxdWlyZSggXCIuL0FwcC5WaWV3cy5Gb3JtVmlldy5qc1wiICksXG5cdFx0Q2hhcnRWaWV3ID0gcmVxdWlyZSggXCIuL0FwcC5WaWV3cy5DaGFydFZpZXcuanNcIiApLFxuXHRcdEltcG9ydFZpZXcgPSByZXF1aXJlKCBcIi4vQXBwLlZpZXdzLkltcG9ydFZpZXcuanNcIiApLFxuXHRcdFZhcmlhYmxlU2VsZWN0cyA9IHJlcXVpcmUoIFwiLi91aS9BcHAuVmlld3MuVUkuVmFyaWFibGVTZWxlY3RzLmpzXCIgKSxcblx0XHRVdGlscyA9IHJlcXVpcmUoIFwiLi8uLi9BcHAuVXRpbHMuanNcIiApO1xuXG5cdEFwcC5WaWV3cy5NYWluID0gQmFja2JvbmUuVmlldy5leHRlbmQoe1xuXG5cdFx0ZXZlbnRzOiB7fSxcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy4kd2luID0gJCggd2luZG93ICk7XG5cdFx0XHR0aGlzLiR3aW4ub24oIFwicmVzaXplXCIsIHRoaXMub25SZXNpemUgKTtcblx0XHRcdHRoaXMub25SZXNpemUoKTtcblx0XHR9LFxuXG5cdFx0c3RhcnQ6IGZ1bmN0aW9uKCkge1xuXHRcdFx0Ly9yZW5kZXIgZXZlcnl0aGluZyBmb3IgdGhlIGZpcnN0IHRpbWVcblx0XHRcdHRoaXMucmVuZGVyKCk7XG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcblx0XHRcdHZhciBkaXNwYXRjaGVyID0gXy5jbG9uZSggQmFja2JvbmUuRXZlbnRzICk7XG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIgPSBkaXNwYXRjaGVyO1xuXG5cdFx0XHQvKmlmKCBGb3JtVmlldyApIHtcblx0XHRcdFx0dGhpcy5mb3JtVmlldyA9IG5ldyBGb3JtVmlldyggeyBkaXNwYXRjaGVyOiBkaXNwYXRjaGVyIH0gKTtcblx0XHRcdH0qL1xuXHRcdFx0aWYoIENoYXJ0VmlldyApIHtcblx0XHRcdFx0dGhpcy5jaGFydFZpZXcgPSBuZXcgQ2hhcnRWaWV3KCB7IGRpc3BhdGNoZXI6IGRpc3BhdGNoZXIgfSApO1xuXHRcdFx0fVxuXHRcdFx0LyppZiggSW1wb3J0VmlldyApIHtcblx0XHRcdFx0dGhpcy5pbXBvcnRWaWV3ID0gbmV3IEltcG9ydFZpZXcoIHtkaXNwYXRjaGVyOiBkaXNwYXRjaGVyIH0gKTtcblx0XHRcdH0qL1xuXG5cdFx0XHQvL3ZhcmlhYmxlIHNlbGVjdFxuXHRcdFx0aWYoIFZhcmlhYmxlU2VsZWN0cyApIHtcblx0XHRcdFx0dmFyIHZhcmlhYmxlU2VsZWN0cyA9IG5ldyBWYXJpYWJsZVNlbGVjdHMoKTtcblx0XHRcdFx0dmFyaWFibGVTZWxlY3RzLmluaXQoKTtcblx0XHRcdH1cblxuXHRcdFx0Ly92YWxpZGF0ZSBcblx0XHRcdHZhciAkdmFsaWRhdGVGb3JtcyA9ICQoIFwiLnZhbGlkYXRlLWZvcm1cIiApO1xuXHRcdFx0aWYoICR2YWxpZGF0ZUZvcm1zLmxlbmd0aCApIHtcblxuXHRcdFx0XHQkdmFsaWRhdGVGb3Jtcy5vbiggXCJzdWJtaXRcIiwgZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdFx0XHR2YXIgJGZvcm0gPSAkKCBldnQuY3VycmVudFRhcmdldCApLFxuXHRcdFx0XHRcdFx0dmFsaWQgPSBVdGlscy5Gb3JtSGVscGVyLnZhbGlkYXRlKCAkZm9ybSApO1xuXHRcdFx0XHRcdGlmKCAhdmFsaWQgKSB7XG5cdFx0XHRcdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0XHRcdGV2dC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gKTtcblx0XHRcdH1cblxuXHRcdFx0Ly9kZWxldGUgYnV0dG9uc1xuXHRcdFx0JCggXCIuZGVsZXRlLWJ0biwgLmJ0bi1kYW5nZXJcIiApLm9uKCBcImNsaWNrXCIsIGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdFx0dmFyIGNvbmZpcm0gPSB3aW5kb3cuY29uZmlybSggXCJBcmUgeW91IHN1cmU/XCIgKTtcblx0XHRcdFx0aWYoICFjb25maXJtICkge1xuXHRcdFx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHR9XG5cblx0XHRcdH0pO1xuXG5cdFx0XHQvL2Nob3NlbiBzZWxlY3Rcblx0XHRcdCQoIFwiLmNob3Nlbi1zZWxlY3RcIiApLmNob3NlbigpO1xuXHRcdFx0XG5cdFx0fSxcblxuXHRcdG9uUmVzaXplOiBmdW5jdGlvbigpIHtcblxuXHRcdH1cblxuXHR9KTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5NYWluO1xuXG59KSgpO1xuIiwiOyggZnVuY3Rpb24oKSB7XG5cdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgTGVnZW5kID0gcmVxdWlyZSggXCIuL0FwcC5WaWV3cy5DaGFydC5MZWdlbmQuanNcIiApO1xuXG5cdEFwcC5WaWV3cy5DaGFydC5DaGFydFRhYiA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKCB7XG5cblx0XHRjYWNoZWRDb2xvcnM6IFtdLFxuXHRcdGVsOiBcIiNjaGFydC12aWV3XCIsXG5cdFx0ZXZlbnRzOiB7XG5cdFx0XHRcImNoYW5nZSBbbmFtZT1hdmFpbGFibGVfZW50aXRpZXNdXCI6IFwib25BdmFpbGFibGVDb3VudHJpZXNcIlxuXHRcdH0sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gb3B0aW9ucy5kaXNwYXRjaGVyO1xuXHRcdFx0dGhpcy5wYXJlbnRWaWV3ID0gb3B0aW9ucy5wYXJlbnRWaWV3O1xuXG5cdFx0XHR0aGlzLiRzdmcgPSB0aGlzLiRlbC5maW5kKCBcIiNjaGFydC1jaGFydC10YWIgc3ZnXCIgKTtcblx0XHRcdHRoaXMuJGVudGl0aWVzU2VsZWN0ID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT1hdmFpbGFibGVfZW50aXRpZXNdXCIgKTtcblx0XHRcdFxuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCBkYXRhLCB0aW1lVHlwZSwgZGltZW5zaW9ucyApIHtcblx0XHRcdFxuXHRcdFx0aWYoICFkYXRhICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdHZhciB0aGF0ID0gdGhpcztcblxuXHRcdFx0Ly9tYWtlIGxvY2FsIGNvcHkgb2YgZGF0YSBmb3Igb3VyIGZpbHRlcmluZyBuZWVkc1xuXHRcdFx0dmFyIGxvY2FsRGF0YSA9ICQuZXh0ZW5kKCB0cnVlLCBsb2NhbERhdGEsIGRhdGEgKTtcblxuXHRcdFx0dmFyIGNoYXJ0VHlwZSA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10eXBlXCIgKTtcblxuXHRcdFx0Ly9maWx0ZXIgZGF0YSBmb3Igc2VsZWN0ZWQgY291bnRyaWVzXG5cdFx0XHR2YXIgc2VsZWN0ZWRDb3VudHJpZXMgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwic2VsZWN0ZWQtY291bnRyaWVzXCIgKSxcblx0XHRcdFx0c2VsZWN0ZWRDb3VudHJpZXNCeUlkID0gW10sXG5cdFx0XHRcdHNlbGVjdGVkQ291bnRyaWVzSWRzID0gXy5tYXAoIHNlbGVjdGVkQ291bnRyaWVzLCBmdW5jdGlvbih2KSB7XG5cdFx0XHRcdFx0Ly9zdG9yZSBcblx0XHRcdFx0XHRzZWxlY3RlZENvdW50cmllc0J5SWRbIHYuaWQgXSA9IHY7XG5cdFx0XHRcdFx0cmV0dXJuICt2LmlkO1xuXHRcdFx0XHR9ICk7XG5cblx0XHRcdGlmKCBzZWxlY3RlZENvdW50cmllcyAmJiBzZWxlY3RlZENvdW50cmllc0lkcy5sZW5ndGggJiYgIUFwcC5DaGFydE1vZGVsLmdldCggXCJncm91cC1ieS12YXJpYWJsZXNcIiApICkge1xuXHRcdFx0XHRcblx0XHRcdFx0Ly9zZXQgbG9jYWwgY29weSBvZiBjb3VudHJpZXMgY29sb3IsIHRvIGJlIGFibGUgdG8gY3JlYXRlIGJyaWdodGVyXG5cdFx0XHRcdHZhciBjb3VudHJpZXNDb2xvcnMgPSBbXTtcblx0XHRcdFx0bG9jYWxEYXRhID0gXy5maWx0ZXIoIGxvY2FsRGF0YSwgZnVuY3Rpb24oIHZhbHVlLCBrZXksIGxpc3QgKSB7XG5cdFx0XHRcdFx0Ly9zZXQgY29sb3Igd2hpbGUgaW4gdGhlIGxvb3Bcblx0XHRcdFx0XHR2YXIgaWQgPSB2YWx1ZS5pZDtcblx0XHRcdFx0XHQvL25lZWQgdG8gY2hlY2sgZm9yIHNwZWNpYWwgY2FzZSwgd2hlbiB3ZSBoYXZlIG1vcmUgdmFyaWFibGVzIGZvciB0aGUgc2FtZSBjb3VudHJpZXMgKHRoZSBpZHMgd2lsbCBiZSB0aGVuIDIxLTEsIDIyLTEsIGV0Yy4pXG5cdFx0XHRcdFx0aWYoIGlkLmluZGV4T2YoIFwiLVwiICkgPiAwICkge1xuXHRcdFx0XHRcdFx0aWQgPSBwYXJzZUludCggaWQuc3BsaXQoIFwiLVwiIClbIDAgXSwgMTAgKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0aWQgPSBwYXJzZUludCggaWQsIDEwICk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0dmFyIGNvdW50cnkgPSBzZWxlY3RlZENvdW50cmllc0J5SWRbIGlkIF07XG5cdFx0XHRcdFx0aWYoIGNvdW50cnkgJiYgY291bnRyeS5jb2xvciApIHtcblx0XHRcdFx0XHRcdGlmKCAhY291bnRyaWVzQ29sb3JzWyBpZCBdICkge1xuXHRcdFx0XHRcdFx0XHRjb3VudHJpZXNDb2xvcnNbIGlkIF0gPSBjb3VudHJ5LmNvbG9yO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0Ly90aGVyZSBpcyBhbHJlYWR5IGNvbG9yIGZvciBjb3VudHJ5IChtdWx0aXZhcmlhbnQgZGF0YXNldCkgLSBjcmVhdGUgYnJpZ2h0ZXIgY29sb3Jcblx0XHRcdFx0XHRcdFx0Y291bnRyaWVzQ29sb3JzWyBpZCBdID0gZDMucmdiKCBjb3VudHJpZXNDb2xvcnNbIGlkIF0gKS5icmlnaHRlciggMSApLnRvU3RyaW5nKCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR2YWx1ZS5jb2xvciA9IGNvdW50cmllc0NvbG9yc1sgaWQgXTtcblxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR2YWx1ZSA9IHRoYXQuYXNzaWduQ29sb3JGcm9tQ2FjaGUoIHZhbHVlICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdC8vYWN0dWFsIGZpbHRlcmluZ1xuXHRcdFx0XHRcdHJldHVybiAoIF8uaW5kZXhPZiggc2VsZWN0ZWRDb3VudHJpZXNJZHMsIGlkICkgPiAtMSApO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvL1RPRE8gLSBub25zZW5zZT8gY29udmVydCBhc3NvY2lhdGl2ZSBhcnJheSB0byBhcnJheSwgYXNzaWduIGNvbG9ycyBmcm9tIGNhY2hlXG5cdFx0XHRcdGxvY2FsRGF0YSA9IF8ubWFwKCBsb2NhbERhdGEsIGZ1bmN0aW9uKCB2YWx1ZSApIHtcblx0XHRcdFx0XHR2YWx1ZSA9IHRoYXQuYXNzaWduQ29sb3JGcm9tQ2FjaGUoIHZhbHVlICk7XG5cdFx0XHRcdFx0cmV0dXJuIHZhbHVlO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cblx0XHRcdHZhciBkaXNjcmV0ZURhdGE7XG5cdFx0XHRpZiggY2hhcnRUeXBlID09IFwiNlwiICkge1xuXHRcdFx0XHR2YXIgZmxhdHRlblZhbHVlcyA9IF8ubWFwKCBsb2NhbERhdGEsIGZ1bmN0aW9uKCB2ICkge1xuXHRcdFx0XHRcdGlmKCB2ICYmIHYuY29sb3IgKSB7XG5cdFx0XHRcdFx0XHR2LnZhbHVlc1sgMCBdLmNvbG9yID0gdi5jb2xvcjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHYudmFsdWVzWzBdO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdGRpc2NyZXRlRGF0YSA9IFt7IGtleTogXCJ2YXJpYWJsZVwiLCB2YWx1ZXM6IGZsYXR0ZW5WYWx1ZXMgfV07XG5cdFx0XHRcdGxvY2FsRGF0YSA9IGRpc2NyZXRlRGF0YTtcblx0XHRcdH1cblxuXHRcdFx0Ly9maWx0ZXIgYnkgY2hhcnQgdGltZVxuXHRcdFx0dmFyIGNoYXJ0VGltZSA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10aW1lXCIgKTtcblx0XHRcdGlmKCBjaGFydFRpbWUgJiYgY2hhcnRUaW1lLmxlbmd0aCA9PSAyICkge1xuXHRcdFx0XHRcblx0XHRcdFx0dmFyIHRpbWVGcm9tID0gY2hhcnRUaW1lWyAwIF0sXG5cdFx0XHRcdFx0dGltZVRvID0gY2hhcnRUaW1lWyAxIF07XG5cdFx0XHRcdFxuXHRcdFx0XHRfLmVhY2goIGxvY2FsRGF0YSwgZnVuY3Rpb24oIHNpbmdsZURhdGEsIGtleSwgbGlzdCApIHtcblx0XHRcdFx0XHR2YXIgdmFsdWVzID0gXy5jbG9uZSggc2luZ2xlRGF0YS52YWx1ZXMgKTtcblx0XHRcdFx0XHR2YWx1ZXMgPSBfLmZpbHRlciggdmFsdWVzLCBmdW5jdGlvbiggdmFsdWUgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gKCBwYXJzZUludCggdmFsdWUudGltZSwgMTAgKSA+PSB0aW1lRnJvbSAmJiBwYXJzZUludCggdmFsdWUudGltZSwgMTAgKSA8PSB0aW1lVG8gKTtcblx0XHRcdFx0XHRcdC8vcmV0dXJuICggdmFsdWUueCA+PSB0aW1lRnJvbSAmJiB2YWx1ZS54IDw9IHRpbWVUbyApO1xuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHRzaW5nbGVEYXRhLnZhbHVlcyA9IHZhbHVlcztcblx0XHRcdFx0fSApO1xuXG5cdFx0XHR9XG5cblx0XHRcdC8vaWYgbGVnZW5kIGRpc3BsYXllZCwgc29ydCBkYXRhIG9uIGtleSBhbHBoYWJldGljYWxseSAodXNlZnVsbCB3aGVuIG11bHRpdmFyaWFuIGRhdGFzZXQpXG5cdFx0XHRpZiggIUFwcC5DaGFydE1vZGVsLmdldCggXCJoaWRlLWxlZ2VuZFwiICkgKSB7XG5cdFx0XHRcdGxvY2FsRGF0YSA9IF8uc29ydEJ5KCBsb2NhbERhdGEsIGZ1bmN0aW9uKCBvYmogKSB7IHJldHVybiBvYmoua2V5OyB9ICk7XG5cdFx0XHR9XG5cblx0XHRcdC8vZ2V0IGF4aXMgY29uZmlnc1xuXHRcdFx0dmFyIHhBeGlzID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcIngtYXhpc1wiICksXG5cdFx0XHRcdHlBeGlzID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcInktYXhpc1wiICksXG5cdFx0XHRcdHhBeGlzUHJlZml4ID0gKCB4QXhpc1sgXCJheGlzLXByZWZpeFwiIF0gfHwgXCJcIiApLFxuXHRcdFx0XHR4QXhpc1N1ZmZpeCA9ICggeEF4aXNbIFwiYXhpcy1zdWZmaXhcIiBdIHx8IFwiXCIgKSxcblx0XHRcdFx0eUF4aXNQcmVmaXggPSAoIHlBeGlzWyBcImF4aXMtcHJlZml4XCIgXSB8fCBcIlwiICksXG5cdFx0XHRcdHlBeGlzU3VmZml4ID0gKCB5QXhpc1sgXCJheGlzLXN1ZmZpeFwiIF0gfHwgXCJcIiApLFxuXHRcdFx0XHR4QXhpc0xhYmVsRGlzdGFuY2UgPSAoICt4QXhpc1sgXCJheGlzLWxhYmVsLWRpc3RhbmNlXCIgXSB8fCAwICksXG5cdFx0XHRcdHlBeGlzTGFiZWxEaXN0YW5jZSA9ICggK3lBeGlzWyBcImF4aXMtbGFiZWwtZGlzdGFuY2VcIiBdIHx8IDAgKSxcblx0XHRcdFx0eEF4aXNNaW4gPSAoIHhBeGlzWyBcImF4aXMtbWluXCIgXSB8fCBudWxsICksXG5cdFx0XHRcdHhBeGlzTWF4ID0gKCB4QXhpc1sgXCJheGlzLW1heFwiIF0gfHwgbnVsbCApLFxuXHRcdFx0XHR5QXhpc01pbiA9ICggeUF4aXNbIFwiYXhpcy1taW5cIiBdIHx8IDAgKSxcblx0XHRcdFx0eUF4aXNNYXggPSAoIHlBeGlzWyBcImF4aXMtbWF4XCIgXSB8fCBudWxsICksXG5cdFx0XHRcdHhBeGlzU2NhbGUgPSAoIHhBeGlzWyBcImF4aXMtc2NhbGVcIiBdIHx8IFwibGluZWFyXCIgKSxcblx0XHRcdFx0eUF4aXNTY2FsZSA9ICggeUF4aXNbIFwiYXhpcy1zY2FsZVwiIF0gfHwgXCJsaW5lYXJcIiApLFxuXHRcdFx0XHR4QXhpc0Zvcm1hdCA9ICggeEF4aXNbIFwiYXhpcy1mb3JtYXRcIiBdIHx8IDAgKSxcblx0XHRcdFx0eUF4aXNGb3JtYXQgPSAoIHlBeGlzWyBcImF4aXMtZm9ybWF0XCIgXSB8fCAwICk7XG5cblx0XHRcdG52LmFkZEdyYXBoKGZ1bmN0aW9uKCkge1xuXG5cdFx0XHRcdHZhciBjaGFydE9wdGlvbnMgPSB7XG5cdFx0XHRcdFx0dHJhbnNpdGlvbkR1cmF0aW9uOiAzMDAsXG5cdFx0XHRcdFx0bWFyZ2luOiB7IHRvcDowLCBsZWZ0OjUwLCByaWdodDozMCwgYm90dG9tOjAgfSwvLyBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwibWFyZ2luc1wiICksXG5cdFx0XHRcdFx0c2hvd0xlZ2VuZDogZmFsc2Vcblx0XHRcdFx0fTtcblxuXHRcdFx0XHQvL2xpbmUgdHlwZVxuXHRcdFx0XHR2YXIgbGluZVR5cGUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwibGluZS10eXBlXCIgKTtcblx0XHRcdFx0aWYoIGxpbmVUeXBlID09IDIgKSB7XG5cdFx0XHRcdFx0Y2hhcnRPcHRpb25zLmRlZmluZWQgPSBmdW5jdGlvbiggZCApIHsgcmV0dXJuIGQueSAhPT0gMDsgfTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiggbGluZVR5cGUgPT0gMCApIHtcblx0XHRcdFx0XHR0aGF0LiRlbC5hZGRDbGFzcyggXCJsaW5lLWRvdHNcIiApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoYXQuJGVsLnJlbW92ZUNsYXNzKCBcImxpbmUtZG90c1wiICk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvL2RlcGVuZGluZyBvbiBjaGFydCB0eXBlIGNyZWF0ZSBjaGFydFxuXHRcdFx0XHRpZiggY2hhcnRUeXBlID09IFwiMVwiICkge1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdC8vbGluZSBjaGFydFxuXHRcdFx0XHRcdHRoYXQuY2hhcnQgPSBudi5tb2RlbHMubGluZUNoYXJ0KCkub3B0aW9ucyggY2hhcnRPcHRpb25zICk7XG5cdFx0XHRcdFxuXHRcdFx0XHR9IGVsc2UgaWYoIGNoYXJ0VHlwZSA9PSBcIjJcIiApIHtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHQvL3NjYXR0ZXIgcGxvdFxuXHRcdFx0XHRcdHZhciBwb2ludHMgPSB0aGF0LnNjYXR0ZXJCdWJibGVTaXplKCk7XG5cdFx0XHRcdFx0dGhhdC5jaGFydCA9IG52Lm1vZGVscy5zY2F0dGVyQ2hhcnQoKS5vcHRpb25zKCBjaGFydE9wdGlvbnMgKS5wb2ludFJhbmdlKCBwb2ludHMgKS5zaG93RGlzdFgoIHRydWUgKS5zaG93RGlzdFkoIHRydWUgKTtcblx0XHRcdFx0XHRcblx0XHRcdFx0fSBlbHNlIGlmKCBjaGFydFR5cGUgPT0gXCIzXCIgKSB7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0Ly9zdGFja2VkIGFyZWEgY2hhcnRcblx0XHRcdFx0XHQvL3dlIG5lZWQgdG8gbWFrZSBzdXJlIHdlIGhhdmUgYXMgbXVjaCBkYXRhIGFzIG5lY2Vzc2FyeVxuXHRcdFx0XHRcdGlmKCBsb2NhbERhdGEubGVuZ3RoICkge1xuXHRcdFx0XHRcdFx0dmFyIGJhc2VTZXJpZXMgPSBsb2NhbERhdGFbMF07XG5cdFx0XHRcdFx0XHRfLmVhY2goIGxvY2FsRGF0YSwgZnVuY3Rpb24oIHNlcmllLCBpICkge1xuXHRcdFx0XHRcdFx0XHRpZiggaSA+IDAgKSB7XG5cdFx0XHRcdFx0XHRcdFx0Ly9tYWtlIHN1cmUgd2UgaGF2ZSB2YWx1ZXMgZm9yIGdpdmVuIHNlcmllc1xuXHRcdFx0XHRcdFx0XHRcdGlmKCBzZXJpZS52YWx1ZXMgJiYgIXNlcmllLnZhbHVlcy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHQvL2Nsb25lIGJhc2Ugc2VyaWVzXG5cdFx0XHRcdFx0XHRcdFx0XHR2YXIgY29weVZhbHVlcyA9IFtdO1xuXHRcdFx0XHRcdFx0XHRcdFx0JC5leHRlbmQodHJ1ZSwgY29weVZhbHVlcywgYmFzZVNlcmllcy52YWx1ZXMpO1xuXHRcdFx0XHRcdFx0XHRcdFx0Ly9udWxsaWZ5IHZhbHVlc1xuXHRcdFx0XHRcdFx0XHRcdFx0Xy5lYWNoKCBjb3B5VmFsdWVzLCBmdW5jdGlvbiggdiwgaSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR2LnkgPSAwO1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR2LmZha2UgPSBcInRydWVcIjtcblx0XHRcdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0XHRcdFx0c2VyaWUudmFsdWVzID0gY29weVZhbHVlcztcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0Y2hhcnRPcHRpb25zLnNob3dUb3RhbEluVG9vbHRpcCA9IHRydWU7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0dGhhdC5jaGFydCA9IG52Lm1vZGVscy5zdGFja2VkQXJlYUNoYXJ0KClcblx0XHRcdFx0XHRcdC5vcHRpb25zKCBjaGFydE9wdGlvbnMgKVxuXHRcdFx0XHRcdFx0LmNvbnRyb2xPcHRpb25zKCBbIFwiU3RhY2tlZFwiLCBcIkV4cGFuZGVkXCIgXSApXG5cdFx0XHRcdFx0XHQudXNlSW50ZXJhY3RpdmVHdWlkZWxpbmUoIHRydWUgKVxuXHRcdFx0XHRcdFx0LngoIGZ1bmN0aW9uKCBkICkgeyByZXR1cm4gZFsgXCJ4XCIgXTsgfSApXG5cdFx0XHRcdFx0XHQueSggZnVuY3Rpb24oIGQgKSB7IHJldHVybiBkWyBcInlcIiBdOyB9ICk7XG5cdFx0XHRcblx0XHRcdFx0fSBlbHNlIGlmKCBjaGFydFR5cGUgPT0gXCI0XCIgfHwgY2hhcnRUeXBlID09IFwiNVwiICkge1xuXG5cdFx0XHRcdFx0Ly9tdWx0aWJhciBjaGFydFxuXHRcdFx0XHRcdC8vd2UgbmVlZCB0byBtYWtlIHN1cmUgd2UgaGF2ZSBhcyBtdWNoIGRhdGEgYXMgbmVjZXNzYXJ5XG5cdFx0XHRcdFx0dmFyIGFsbFRpbWVzID0gW10sXG5cdFx0XHRcdFx0XHQvL3N0b3JlIHZhbHVlcyBieSBbZW50aXR5XVt0aW1lXVxuXHRcdFx0XHRcdFx0dmFsdWVzQ2hlY2sgPSBbXTtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHQvL2V4dHJhY3QgYWxsIHRpbWVzXG5cdFx0XHRcdFx0Xy5lYWNoKCBsb2NhbERhdGEsIGZ1bmN0aW9uKCB2LCBpICkge1xuXHRcdFx0XHRcdFx0XHRcblx0XHRcdFx0XHRcdHZhciBlbnRpdHlEYXRhID0gW10sXG5cdFx0XHRcdFx0XHRcdHRpbWVzID0gdi52YWx1ZXMubWFwKCBmdW5jdGlvbiggdjIsIGkgKSB7XG5cdFx0XHRcdFx0XHRcdFx0ZW50aXR5RGF0YVsgdjIueCBdID0gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gdjIueDtcblx0XHRcdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdFx0dmFsdWVzQ2hlY2tbIHYuaWQgXSA9IGVudGl0eURhdGE7XG5cdFx0XHRcdFx0XHRhbGxUaW1lcyA9IGFsbFRpbWVzLmNvbmNhdCggdGltZXMgKTtcblx0XHRcdFx0XHRcdFxuXHRcdFx0XHRcdH0gKTtcblxuXHRcdFx0XHRcdGFsbFRpbWVzID0gXy51bmlxKCBhbGxUaW1lcyApO1xuXHRcdFx0XHRcdGFsbFRpbWVzID0gXy5zb3J0QnkoIGFsbFRpbWVzICk7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0aWYoIGxvY2FsRGF0YS5sZW5ndGggKSB7XG5cdFx0XHRcdFx0XHRfLmVhY2goIGxvY2FsRGF0YSwgZnVuY3Rpb24oIHNlcmllLCBzZXJpZUluZGV4ICkge1xuXHRcdFx0XHRcdFx0XHRcblx0XHRcdFx0XHRcdFx0Ly9tYWtlIHN1cmUgd2UgaGF2ZSB2YWx1ZXMgZm9yIGdpdmVuIHNlcmllc1xuXHRcdFx0XHRcdFx0XHRfLmVhY2goIGFsbFRpbWVzLCBmdW5jdGlvbiggdGltZSwgdGltZUluZGV4ICkge1xuXHRcdFx0XHRcdFx0XHRcdGlmKCB2YWx1ZXNDaGVja1sgc2VyaWUuaWQgXSAmJiAhdmFsdWVzQ2hlY2tbIHNlcmllLmlkIF1bIHRpbWUgXSApIHtcblx0XHRcdFx0XHRcdFx0XHRcdC8vdGltZSBkb2Vzbid0IGV4aXN0aWcgZm9yIGdpdmVuIGVudGl0eSwgaW5zZXJ0IHplcm8gdmFsdWVcblx0XHRcdFx0XHRcdFx0XHRcdHZhciB6ZXJvT2JqID0ge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcImtleVwiOiBzZXJpZS5rZXksXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFwic2VyaWVcIjogc2VyaWVJbmRleCxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XCJ0aW1lXCI6IHRpbWUsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFwieFwiOiB0aW1lLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcInlcIjogMCxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XCJmYWtlXCI6IHRydWVcblx0XHRcdFx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XHRcdFx0XHRzZXJpZS52YWx1ZXMuc3BsaWNlKCB0aW1lSW5kZXgsIDAsIHplcm9PYmogKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYoIGNoYXJ0VHlwZSA9PSBcIjRcIiApIHtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHRcdHRoYXQuY2hhcnQgPSBudi5tb2RlbHMubXVsdGlCYXJDaGFydCgpLm9wdGlvbnMoIGNoYXJ0T3B0aW9ucyApO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdH0gZWxzZSBpZiggIGNoYXJ0VHlwZSA9PSBcIjVcIiApIHtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHRcdHRoYXQuY2hhcnQgPSBudi5tb2RlbHMubXVsdGlCYXJIb3Jpem9udGFsQ2hhcnQoKS5vcHRpb25zKCBjaGFydE9wdGlvbnMgKTsvLy5zaG93VmFsdWVzKCB0cnVlICk7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdH0gZWxzZSBpZiggY2hhcnRUeXBlID09IFwiNlwiICkge1xuXG5cdFx0XHRcdFx0Y2hhcnRPcHRpb25zLnNob3dWYWx1ZXMgPSB0cnVlO1xuXG5cdFx0XHRcdFx0dGhhdC5jaGFydCA9IG52Lm1vZGVscy5kaXNjcmV0ZUJhckNoYXJ0KClcblx0XHRcdFx0XHRcdC54KCBmdW5jdGlvbiggZCApIHsgcmV0dXJuIGQueDsgfSApXG5cdFx0XHRcdFx0XHQueSggZnVuY3Rpb24oIGQgKSB7IHJldHVybiBkLnk7IH0gKVxuXHRcdFx0XHRcdFx0Lm9wdGlvbnMoIGNoYXJ0T3B0aW9ucyApO1xuXG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvL2ZpeGVkIHByb2JhYmx5IGEgYnVnIGluIG52ZDMgd2l0aCBwcmV2aW91cyB0b29sdGlwIG5vdCBiZWluZyByZW1vdmVkXG5cdFx0XHRcdGQzLnNlbGVjdCggXCIueHktdG9vbHRpcFwiICkucmVtb3ZlKCk7XG5cblx0XHRcdFx0dGhhdC5jaGFydC54QXhpc1xuXHRcdFx0XHRcdC5heGlzTGFiZWwoIHhBeGlzWyBcImF4aXMtbGFiZWxcIiBdIClcblx0XHRcdFx0XHQvLy5zdGFnZ2VyTGFiZWxzKCB0cnVlIClcblx0XHRcdFx0XHQuYXhpc0xhYmVsRGlzdGFuY2UoIHhBeGlzTGFiZWxEaXN0YW5jZSApXG5cdFx0XHRcdFx0LnRpY2tGb3JtYXQoIGZ1bmN0aW9uKGQpIHtcblx0XHRcdFx0XHRcdGlmKCBjaGFydFR5cGUgIT0gMiApIHtcblx0XHRcdFx0XHRcdFx0Ly94IGF4aXMgaGFzIHRpbWUgaW5mb3JtYXRpb25cblx0XHRcdFx0XHRcdFx0cmV0dXJuIEFwcC5VdGlscy5mb3JtYXRUaW1lTGFiZWwoIHRpbWVUeXBlLCBkLCB4QXhpc1ByZWZpeCwgeEF4aXNTdWZmaXgsIHhBeGlzRm9ybWF0ICk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHQvL2lzIHNjYXR0ZXIgcGxvdCwgeC1heGlzIGhhcyBzb21lIG90aGVyIGluZm9ybWF0aW9uXG5cdFx0XHRcdFx0XHRcdHJldHVybiB4QXhpc1ByZWZpeCArIGQzLmZvcm1hdCggXCIsXCIgKSggQXBwLlV0aWxzLmZvcm1hdFZhbHVlKCBkLCB4QXhpc0Zvcm1hdCApICkgKyB4QXhpc1N1ZmZpeDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9ICk7XG5cblx0XHRcdFx0aWYoIHRpbWVUeXBlID09IFwiUXVhcnRlciBDZW50dXJ5XCIgKSB7XG5cdFx0XHRcdFx0dGhhdC5jaGFydC54QXhpcy5zdGFnZ2VyTGFiZWxzKCB0cnVlICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdC8vZ2V0IGV4dGVuZFxuXHRcdFx0XHR2YXIgYWxsVmFsdWVzID0gW107XG5cdFx0XHRcdF8uZWFjaCggbG9jYWxEYXRhLCBmdW5jdGlvbiggdiwgaSApIHtcblx0XHRcdFx0XHRpZiggdi52YWx1ZXMgKSB7XG5cdFx0XHRcdFx0XHRhbGxWYWx1ZXMgPSBhbGxWYWx1ZXMuY29uY2F0KCB2LnZhbHVlcyApO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiggJC5pc0FycmF5KCB2ICkgKXtcblx0XHRcdFx0XHRcdC8vc3BlY2lhbCBjYXNlIGZvciBkaXNjcmV0ZSBiYXIgY2hhcnRcblx0XHRcdFx0XHRcdGFsbFZhbHVlcyA9IHY7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9ICk7XG5cblx0XHRcdFx0Ly9kb21haW4gc2V0dXBcblx0XHRcdFx0dmFyIHhEb21haW4gPSBkMy5leHRlbnQoIGFsbFZhbHVlcy5tYXAoIGZ1bmN0aW9uKCBkICkgeyByZXR1cm4gZC54OyB9ICkgKSxcblx0XHRcdFx0XHR5RG9tYWluID0gZDMuZXh0ZW50KCBhbGxWYWx1ZXMubWFwKCBmdW5jdGlvbiggZCApIHsgcmV0dXJuIGQueTsgfSApICksXG5cdFx0XHRcdFx0aXNDbGFtcGVkID0gZmFsc2U7XG5cblx0XHRcdFx0Ly9jb25zb2xlLmxvZyggXCJjaGFydC5zdGFja2VkLnN0eWxlKClcIiwgdGhhdC5jaGFydC5zdGFja2VkLnN0eWxlKCkgKTtcblxuXHRcdFx0XHRpZiggeEF4aXNNaW4gJiYgIWlzTmFOKCB4QXhpc01pbiApICkge1xuXHRcdFx0XHRcdHhEb21haW5bIDAgXSA9IHhBeGlzTWluO1xuXHRcdFx0XHRcdGlzQ2xhbXBlZCA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYoIHhBeGlzTWF4ICYmICFpc05hTiggeEF4aXNNYXggKSApIHtcblx0XHRcdFx0XHR4RG9tYWluWyAxIF0gPSB4QXhpc01heDtcblx0XHRcdFx0XHRpc0NsYW1wZWQgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmKCB5QXhpc01pbiAmJiAhaXNOYU4oIHlBeGlzTWluICkgKSB7XG5cdFx0XHRcdFx0eURvbWFpblsgMCBdID0geUF4aXNNaW47XG5cdFx0XHRcdFx0aXNDbGFtcGVkID0gdHJ1ZTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvL2RlZmF1bHQgaXMgemVybyAoZG9uJ3QgZG8gaXQgZm9yIHN0YWNrIGJhciBjaGFydCwgbWVzc2VzIHVwIHRoaW5ncylcblx0XHRcdFx0XHRpZiggY2hhcnRUeXBlICE9IFwiM1wiICkge1xuXHRcdFx0XHRcdFx0eURvbWFpblsgMCBdID0gMDtcblx0XHRcdFx0XHRcdGlzQ2xhbXBlZCA9IHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGlmKCB5QXhpc01heCAmJiAhaXNOYU4oIHlBeGlzTWF4ICkgKSB7XG5cdFx0XHRcdFx0eURvbWFpblsgMSBdID0geUF4aXNNYXg7XG5cdFx0XHRcdFx0aXNDbGFtcGVkID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0Ly9tYW51YWxseSBjbGFtcCB2YWx1ZXNcblx0XHRcdFx0aWYoIGlzQ2xhbXBlZCApIHtcblxuXHRcdFx0XHRcdGlmKCBjaGFydFR5cGUgIT09IFwiNFwiICYmIGNoYXJ0VHlwZSAhPT0gXCI1XCIgJiYgY2hhcnRUeXBlICE9PSBcIjZcIiApIHtcblx0XHRcdFx0XHRcdHRoYXQuY2hhcnQuZm9yY2VYKCB4RG9tYWluICk7XG5cdFx0XHRcdFx0XHR0aGF0LmNoYXJ0LmZvcmNlWSggeURvbWFpbiApO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8qdGhhdC5jaGFydC54RG9tYWluKCB4RG9tYWluICk7XG5cdFx0XHRcdFx0dGhhdC5jaGFydC55RG9tYWluKCB5RG9tYWluICk7XG5cdFx0XHRcdFx0dGhhdC5jaGFydC54U2NhbGUoKS5jbGFtcCggdHJ1ZSApO1xuXHRcdFx0XHRcdHRoYXQuY2hhcnQueVNjYWxlKCkuY2xhbXAoIHRydWUgKTsqL1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly9zZXQgc2NhbGVzLCBtdWx0aWJhciBjaGFydFxuXHRcdFx0XHRpZiggeUF4aXNTY2FsZSA9PT0gXCJsaW5lYXJcIiApIHtcblx0XHRcdFx0XHR0aGF0LmNoYXJ0LnlTY2FsZSggZDMuc2NhbGUubGluZWFyKCkgKTtcblx0XHRcdFx0fSBlbHNlIGlmKCB5QXhpc1NjYWxlID09PSBcImxvZ1wiICkge1xuXHRcdFx0XHRcdHRoYXQuY2hhcnQueVNjYWxlKCBkMy5zY2FsZS5sb2coKSApO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYoIGNoYXJ0VHlwZSA9PT0gXCI0XCIgfHwgY2hhcnRUeXBlID09PSBcIjVcIiApIHtcblx0XHRcdFx0XHQvL2ZvciBtdWx0aWJhciBjaGFydCwgeCBheGlzIGhhcyBvcmRpbmFsIHNjYWxlLCBzbyBuZWVkIHRvIHNldHVwIGRvbWFpbiBwcm9wZXJseVxuXHRcdFx0XHRcdC8vdGhhdC5jaGFydC54RG9tYWluKCBkMy5yYW5nZSh4RG9tYWluWzBdLCB4RG9tYWluWzFdICsgMSkgKTtcblx0XHRcdFx0XHR0aGF0LmNoYXJ0LnhEb21haW4oIGFsbFRpbWVzICk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGF0LmNoYXJ0LnlBeGlzXG5cdFx0XHRcdFx0LmF4aXNMYWJlbCggeUF4aXNbIFwiYXhpcy1sYWJlbFwiIF0gKVxuXHRcdFx0XHRcdC5heGlzTGFiZWxEaXN0YW5jZSggeUF4aXNMYWJlbERpc3RhbmNlIClcblx0XHRcdFx0XHQudGlja0Zvcm1hdCggZnVuY3Rpb24oZCkgeyByZXR1cm4geUF4aXNQcmVmaXggKyBkMy5mb3JtYXQoIFwiLFwiICkoIEFwcC5VdGlscy5mb3JtYXRWYWx1ZSggZCwgeUF4aXNGb3JtYXQgKSApICsgeUF4aXNTdWZmaXg7IH0pXG5cdFx0XHRcdFx0LnNob3dNYXhNaW4oZmFsc2UpO1xuXHRcdFx0XHRcblx0XHRcdFx0Ly9zY2F0dGVyIHBsb3RzIG5lZWQgbW9yZSB0aWNrc1xuXHRcdFx0XHRpZiggY2hhcnRUeXBlID09PSBcIjJcIiApIHtcblx0XHRcdFx0XHQvL2hhcmRjb2RlXG5cdFx0XHRcdFx0dGhhdC5jaGFydC54QXhpcy50aWNrcyggNyApO1xuXHRcdFx0XHRcdHRoYXQuY2hhcnQueUF4aXMudGlja3MoIDcgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0dmFyIHN2Z1NlbGVjdGlvbiA9IGQzLnNlbGVjdCggdGhhdC4kc3ZnLnNlbGVjdG9yIClcblx0XHRcdFx0XHQuZGF0dW0oIGxvY2FsRGF0YSApXG5cdFx0XHRcdFx0LmNhbGwoIHRoYXQuY2hhcnQgKTtcblx0XHRcdFx0XG5cdFx0XHRcdGlmKCBjaGFydFR5cGUgIT09IFwiM1wiICkge1xuXG5cdFx0XHRcdFx0dGhhdC5jaGFydC50b29sdGlwLmNvbnRlbnRHZW5lcmF0b3IoIEFwcC5VdGlscy5jb250ZW50R2VuZXJhdG9yICk7XG5cblx0XHRcdFx0fSBlbHNlIHtcblxuXHRcdFx0XHRcdC8vc2V0IHBvcHVwXG5cdFx0XHRcdFx0dmFyIHVuaXRzU3RyaW5nID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcInVuaXRzXCIgKSxcblx0XHRcdFx0XHRcdHVuaXRzID0gKCAhJC5pc0VtcHR5T2JqZWN0KCB1bml0c1N0cmluZyApICk/ICQucGFyc2VKU09OKCB1bml0c1N0cmluZyApOiB7fSxcblx0XHRcdFx0XHRcdHN0cmluZyA9IFwiXCIsXG5cdFx0XHRcdFx0XHR2YWx1ZXNTdHJpbmcgPSBcIlwiO1xuXG5cdFx0XHRcdFx0Ly9kMy5mb3JtYXQgd2l0aCBhZGRlZCBwYXJhbXMgdG8gYWRkIGFyYml0cmFyeSBzdHJpbmcgYXQgdGhlIGVuZFxuXHRcdFx0XHRcdHZhciBjdXN0b21Gb3JtYXR0ZXIgPSBmdW5jdGlvbiggZm9ybWF0U3RyaW5nLCBzdWZmaXggKSB7XG5cdFx0XHRcdFx0XHR2YXIgZnVuYyA9IGQzLmZvcm1hdCggZm9ybWF0U3RyaW5nICk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZnVuY3Rpb24oIGQsIGkgKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBmdW5jKCBkICkgKyBzdWZmaXg7XG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdH07XG5cblx0XHRcdFx0XHQvL2RpZmZlcmVudCBwb3B1cCBzZXR1cCBmb3Igc3RhY2tlZCBhcmVhIGNoYXJ0XG5cdFx0XHRcdFx0dmFyIHVuaXQgPSBfLmZpbmRXaGVyZSggdW5pdHMsIHsgcHJvcGVydHk6IFwieVwiIH0gKTtcblx0XHRcdFx0XHRpZiggdW5pdCAmJiB1bml0LmZvcm1hdCApIHtcblx0XHRcdFx0XHRcdHZhciBmaXhlZCA9IE1hdGgubWluKCAyMCwgcGFyc2VJbnQoIHVuaXQuZm9ybWF0LCAxMCApICksXG5cdFx0XHRcdFx0XHRcdHVuaXROYW1lID0gKCB1bml0LnVuaXQgKT8gXCIgXCIgKyB1bml0LnVuaXQ6IFwiXCI7XG5cdFx0XHRcdFx0XHR0aGF0LmNoYXJ0LmludGVyYWN0aXZlTGF5ZXIudG9vbHRpcC52YWx1ZUZvcm1hdHRlciggY3VzdG9tRm9ybWF0dGVyKFwiLlwiICsgZml4ZWQgKyBcImZcIiwgdW5pdE5hbWUgKSApO1xuXHRcdFx0XHRcdFx0Ly90aGF0LmNoYXJ0LmludGVyYWN0aXZlTGF5ZXIudG9vbHRpcC52YWx1ZUZvcm1hdHRlciggZDMuZm9ybWF0KFwiLlwiICsgZml4ZWQgKyBcImZcIiApICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFxuXHRcdFx0XHR9XG5cdFx0XHRcdFxuXHRcdFx0XHQvL3NldCBsZWdlbmRcblx0XHRcdFx0aWYoICFBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiaGlkZS1sZWdlbmRcIiApICkge1xuXHRcdFx0XHRcdC8vbWFrZSBzdXJlIHdyYXBwZXIgaXMgdmlzaWJsZVxuXHRcdFx0XHRcdHRoYXQuJHN2Zy5maW5kKCBcIj4gLm52ZDMubnYtY3VzdG9tLWxlZ2VuZFwiICkuc2hvdygpO1xuXHRcdFx0XHRcdHRoYXQubGVnZW5kID0gbmV3IExlZ2VuZCggdGhhdC5jaGFydC5sZWdlbmQgKS52ZXJzKCBcIm93ZFwiICk7XG5cdFx0XHRcdFx0dGhhdC5sZWdlbmQuZGlzcGF0Y2gub24oIFwicmVtb3ZlRW50aXR5XCIsIGZ1bmN0aW9uKCBpZCApIHtcblx0XHRcdFx0XHRcdHRoYXQub25SZW1vdmVFbnRpdHkoIGlkICk7XG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdHRoYXQubGVnZW5kLmRpc3BhdGNoLm9uKCBcImFkZEVudGl0eVwiLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdGlmKCB0aGF0LiRlbnRpdGllc1NlbGVjdC5kYXRhKCBcImNob3NlblwiICkgKSB7XG5cdFx0XHRcdFx0XHRcdHRoYXQuJGVudGl0aWVzU2VsZWN0LmRhdGEoIFwiY2hvc2VuXCIgKS5hY3RpdmVfZmllbGQgPSBmYWxzZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdC8vdHJpZ2dlciBvcGVuIHRoZSBjaG9zZW4gZHJvcCBkb3duXG5cdFx0XHRcdFx0XHR0aGF0LiRlbnRpdGllc1NlbGVjdC50cmlnZ2VyKCBcImNob3NlbjpvcGVuXCIgKTtcblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0c3ZnU2VsZWN0aW9uLmNhbGwoIHRoYXQubGVnZW5kICk7XG5cdFx0XHRcdFx0Ly9wdXQgbGVnZW5kIGFib3ZlIGNoYXJ0XG5cblxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vbm8gbGVnZW5kLCByZW1vdmUgd2hhdCBtaWdodCBoYXZlIHByZXZpb3VzbHkgYmVlbiB0aGVyZVxuXHRcdFx0XHRcdHRoYXQuJHN2Zy5maW5kKCBcIj4gLm52ZDMubnYtY3VzdG9tLWxlZ2VuZFwiICkuaGlkZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdFxuXHRcdFx0XHR2YXIgb25SZXNpemVDYWxsYmFjayA9IF8uZGVib3VuY2UoIGZ1bmN0aW9uKGUpIHtcblx0XHRcdFx0XHQvL2ludm9rZSByZXNpemUgb2YgbGVnZW5kLCBpZiB0aGVyZSdzIG9uZSwgc2NhdHRlciBwbG90IGRvZXNuJ3QgaGF2ZSBhbnkgYnkgZGVmYXVsdFxuXHRcdFx0XHRcdGlmKCB0aGF0LmxlZ2VuZCApIHtcblx0XHRcdFx0XHRcdHN2Z1NlbGVjdGlvbi5jYWxsKCB0aGF0LmxlZ2VuZCApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGF0LnBhcmVudFZpZXcub25SZXNpemUoKTtcblx0XHRcdFx0fSwgMTUwICk7XG5cdFx0XHRcdG52LnV0aWxzLndpbmRvd1Jlc2l6ZSggb25SZXNpemVDYWxsYmFjayApO1xuXHRcdFx0XHRcdFx0XG5cdFx0XHRcdHRoYXQucGFyZW50Vmlldy5vblJlc2l6ZSgpO1xuXG5cdFx0XHRcdHZhciBzdGF0ZUNoYW5nZUV2ZW50ID0gKCBjaGFydFR5cGUgIT09IFwiNlwiICk/IFwic3RhdGVDaGFuZ2VcIjogXCJyZW5kZXJFbmRcIjtcblx0XHRcdFx0dGhhdC5jaGFydC5kaXNwYXRjaC5vbiggc3RhdGVDaGFuZ2VFdmVudCwgZnVuY3Rpb24oIHN0YXRlICkge1xuXHRcdFx0XHRcdC8vcmVmcmVzaCBsZWdlbmQ7XG5cdFx0XHRcdFx0c3ZnU2VsZWN0aW9uLmNhbGwoIHRoYXQubGVnZW5kICk7XG5cblx0XHRcdFx0XHQvL1xuXHRcdFx0XHRcdGlmKCBjaGFydFR5cGUgPT09IFwiM1wiICkge1xuXHRcdFx0XHRcdFx0dGhhdC5jaGVja1N0YWNrZWRBeGlzKCk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly9UT0RPIC0gdWdseSEgbmVlZHMgdGltZW91dCBhbmQgcmVhY2hpbmcgdG8gY2hhcnR2aWV3ICBcblx0XHRcdFx0XHRzZXRUaW1lb3V0KCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdHRoYXQucGFyZW50Vmlldy5vblJlc2l6ZSgpO1xuXHRcdFx0XHRcdH0sIDEpO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdHRoYXQucGFyZW50Vmlldy5kYXRhVGFiLnJlbmRlciggZGF0YSwgbG9jYWxEYXRhLCBkaW1lbnNpb25zICk7XG5cdFx0XHRcdFxuXHRcdFx0XHRpZiggY2hhcnRUeXBlID09IFwiMlwiICkge1xuXHRcdFx0XHRcdC8vbmVlZCB0byBoYXZlIG93biBzaG93RGlzdCBpbXBsZW1lbnRhdGlvbiwgY2F1c2UgdGhlcmUncyBhIGJ1ZyBpbiBudmQzXG5cdFx0XHRcdFx0dGhhdC5zY2F0dGVyRGlzdCgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdFxuXHRcdFx0XHQvL2lmIHkgYXhpcyBoYXMgemVybywgZGlzcGxheSBzb2xpZCBsaW5lXG5cdFx0XHRcdHZhciAkcGF0aERvbWFpbiA9ICQoIFwiLm52ZDMgLm52LWF4aXMubnYteCBwYXRoLmRvbWFpblwiICk7XG5cdFx0XHRcdGlmKCB5RG9tYWluWyAwIF0gPT09IDAgKSB7XG5cdFx0XHRcdFx0JHBhdGhEb21haW4uY3NzKCBcInN0cm9rZS1vcGFjaXR5XCIsIFwiMVwiICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0JHBhdGhEb21haW4uY3NzKCBcInN0cm9rZS1vcGFjaXR5XCIsIFwiMFwiICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdC8vdGhhdC5zY2FsZVNlbGVjdG9ycy5pbml0RXZlbnRzKCk7XG5cdFx0XHRcdHZhciBjaGFydERpbWVuc2lvbnNTdHJpbmcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtZGltZW5zaW9uc1wiICk7XG5cdFx0XHRcdGlmKCBjaGFydERpbWVuc2lvbnNTdHJpbmcuaW5kZXhPZiggJ1wicHJvcGVydHlcIjpcImNvbG9yXCInICkgPT09IC0xICkge1xuXHRcdFx0XHRcdC8vY2hlY2sgaWYgc3RyaW5nIGRvZXMgbm90IGNvbnRhaW4gXCJwcm9wZXJ0eVwiOlwiY29sb3JcIlxuXHRcdFx0XHRcdHRoYXQuY2FjaGVDb2xvcnMoIGxvY2FsRGF0YSApO1xuXHRcdFx0XHR9XG5cblx0XHRcdH0pO1xuXG5cdFx0fSxcblxuXHRcdHNjYXR0ZXJEaXN0OiBmdW5jdGlvbigpIHtcblxuXHRcdFx0dmFyIHRoYXQgPSB0aGlzLFxuXHRcdFx0XHRtYXJnaW5zID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcIm1hcmdpbnNcIiApLFxuXHRcdFx0XHRudkRpc3RyWCA9ICQoIFwiLm52LWRpc3RyaWJ1dGlvblhcIiApLm9mZnNldCgpLnRvcCxcblx0XHRcdFx0c3ZnU2VsZWN0aW9uID0gZDMuc2VsZWN0KCBcInN2Z1wiICk7XG5cblx0XHRcdHRoYXQuY2hhcnQuc2NhdHRlci5kaXNwYXRjaC5vbignZWxlbWVudE1vdXNlb3Zlci50b29sdGlwJywgZnVuY3Rpb24oZXZ0KSB7XG5cdFx0XHRcdHZhciBzdmdPZmZzZXQgPSB0aGF0LiRzdmcub2Zmc2V0KCksXG5cdFx0XHRcdFx0c3ZnSGVpZ2h0ID0gdGhhdC4kc3ZnLmhlaWdodCgpO1xuXHRcdFx0XHRzdmdTZWxlY3Rpb24uc2VsZWN0KCcubnYtc2VyaWVzLScgKyBldnQuc2VyaWVzSW5kZXggKyAnIC5udi1kaXN0eC0nICsgZXZ0LnBvaW50SW5kZXgpXG5cdFx0XHRcdFx0LmF0dHIoJ3kxJywgZXZ0LnBvcy50b3AgLSBudkRpc3RyWCApO1xuXHRcdFx0XHRzdmdTZWxlY3Rpb24uc2VsZWN0KCcubnYtc2VyaWVzLScgKyBldnQuc2VyaWVzSW5kZXggKyAnIC5udi1kaXN0eS0nICsgZXZ0LnBvaW50SW5kZXgpXG5cdFx0XHRcdFx0LmF0dHIoJ3gyJywgZXZ0LnBvcy5sZWZ0IC0gc3ZnT2Zmc2V0LmxlZnQgLSBtYXJnaW5zLmxlZnQgKTtcblx0XHRcdFx0dmFyIHBvc2l0aW9uID0ge2xlZnQ6IGQzLmV2ZW50LmNsaWVudFgsIHRvcDogZDMuZXZlbnQuY2xpZW50WSB9O1xuXHRcdFx0XHR0aGF0LmNoYXJ0LnRvb2x0aXAucG9zaXRpb24ocG9zaXRpb24pLmRhdGEoZXZ0KS5oaWRkZW4oZmFsc2UpO1xuXHRcdFx0fSk7XG5cblx0XHR9LFxuXG5cdFx0c2NhdHRlckJ1YmJsZVNpemU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0Ly9zZXQgc2l6ZSBvZiB0aGUgYnViYmxlcyBkZXBlbmRpbmcgb24gYnJvd3NlciB3aWR0aFxuXHRcdFx0dmFyIGJyb3dzZXJXaWR0aCA9ICQoIHdpbmRvdyApLndpZHRoKCksXG5cdFx0XHRcdGJyb3dzZXJDb2VmID0gTWF0aC5tYXgoIDEsIGJyb3dzZXJXaWR0aCAvIDExMDAgKSxcblx0XHRcdFx0cG9pbnRNaW4gPSAxMDAgKiBNYXRoLnBvdyggYnJvd3NlckNvZWYsIDIgKSxcblx0XHRcdFx0cG9pbnRNYXggPSAxMDAwICogTWF0aC5wb3coIGJyb3dzZXJDb2VmLCAyICk7XG5cdFx0XHRyZXR1cm4gWyBwb2ludE1pbiwgcG9pbnRNYXggXTtcblx0XHR9LFxuXG5cdFx0Y2hlY2tTdGFja2VkQXhpczogZnVuY3Rpb24oKSB7XG5cblx0XHRcdC8vc2V0dGluZyB5QXhpc01heCBicmVha3MgZXhwYW5kZWQgc3RhY2tlZCBjaGFydCwgbmVlZCB0byBjaGVjayBtYW51YWxseVxuXHRcdFx0dmFyIHN0YWNrZWRTdHlsZSA9IHRoaXMuY2hhcnQuc3RhY2tlZC5zdHlsZSgpLFxuXHRcdFx0XHR5QXhpcyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJ5LWF4aXNcIiApLFxuXHRcdFx0XHR5QXhpc01pbiA9ICggeUF4aXNbIFwiYXhpcy1taW5cIiBdIHx8IDAgKSxcblx0XHRcdFx0eUF4aXNNYXggPSAoIHlBeGlzWyBcImF4aXMtbWF4XCIgXSB8fCBudWxsICksXG5cdFx0XHRcdHlEb21haW4gPSBbIHlBeGlzTWluLCB5QXhpc01heCBdO1xuXHRcdFx0aWYoIHlBeGlzTWF4ICkge1xuXHRcdFx0XHQvL2NoYXJ0IGhhcyBzZXQgeUF4aXMgdG8gbWF4LCBkZXBlbmRpbmcgb24gc3RhY2tlZCBzdHlsZSBzZXQgbWF4XG5cdFx0XHRcdGlmKCBzdGFja2VkU3R5bGUgPT09IFwiZXhwYW5kXCIgKSB7XG5cdFx0XHRcdFx0eURvbWFpbiA9IFsgMCwgMSBdO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuY2hhcnQueURvbWFpbiggeURvbWFpbiApO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0fSxcblxuXHRcdG9uUmVtb3ZlRW50aXR5OiBmdW5jdGlvbiggaWQgKSB7XG5cblx0XHRcdHZhciBzZWxlY3RlZENvdW50cmllcyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiApLFxuXHRcdFx0XHRjb3VudHJpZXNJZHMgPSBfLmtleXMoIHNlbGVjdGVkQ291bnRyaWVzICksXG5cdFx0XHRcdGFkZENvdW50cnlNb2RlID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImFkZC1jb3VudHJ5LW1vZGVcIiApO1xuXG5cdFx0XHRpZiggY291bnRyaWVzSWRzLmxlbmd0aCA9PT0gMCApIHtcblx0XHRcdFx0Ly9yZW1vdmluZyBmcm9tIGVtcHR5IHNlbGVjdGlvbiwgbmVlZCB0byBjb3B5IGFsbCBjb3VudHJpZXMgYXZhaWxhYmxlIGludG8gc2VsZWN0ZWQgY291bnRyaWVzIHNlbGVjdGlvblxuXHRcdFx0XHR2YXIgZW50aXRpZXNDb2xsZWN0aW9uID0gW10sXG5cdFx0XHRcdC8vdmFyIGVudGl0aWVzQ29sbGVjdGlvbiA9IHt9LFxuXHRcdFx0XHRcdGZvcm1Db25maWcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiZm9ybS1jb25maWdcIiApO1xuXHRcdFx0XHRpZiggZm9ybUNvbmZpZyAmJiBmb3JtQ29uZmlnWyBcImVudGl0aWVzLWNvbGxlY3Rpb25cIiBdICkge1xuXHRcdFx0XHRcdF8ubWFwKCBmb3JtQ29uZmlnWyBcImVudGl0aWVzLWNvbGxlY3Rpb25cIiBdLCBmdW5jdGlvbiggZCwgaSApIHsgZW50aXRpZXNDb2xsZWN0aW9uWyBkLmlkIF0gPSBkOyB9ICk7XG5cdFx0XHRcdFx0Ly9kZWVwIGNvcHkgYXJyYXlcblx0XHRcdFx0XHR2YXIgZW50aXRpZXNDb3B5ID0gICQuZXh0ZW5kKCB0cnVlLCBbXSwgZm9ybUNvbmZpZ1sgXCJlbnRpdGllcy1jb2xsZWN0aW9uXCIgXSApO1xuXHRcdFx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiwgZW50aXRpZXNDb3B5ICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdEFwcC5DaGFydE1vZGVsLnJlbW92ZVNlbGVjdGVkQ291bnRyeSggaWQgKTtcblxuXHRcdH0sXG5cblx0XHRvbkF2YWlsYWJsZUNvdW50cmllczogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dmFyICRzZWxlY3QgPSAkKCBldnQuY3VycmVudFRhcmdldCApLFxuXHRcdFx0XHR2YWwgPSAkc2VsZWN0LnZhbCgpLFxuXHRcdFx0XHQkb3B0aW9uID0gJHNlbGVjdC5maW5kKCBcIlt2YWx1ZT1cIiArIHZhbCArIFwiXVwiICksXG5cdFx0XHRcdHRleHQgPSAkb3B0aW9uLnRleHQoKTtcblxuXHRcdFx0aWYoICFBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiZ3JvdXAtYnktdmFyaWFibGVzXCIgKSAmJiBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiYWRkLWNvdW50cnktbW9kZVwiICkgPT09IFwiYWRkLWNvdW50cnlcIiApIHtcblx0XHRcdFx0QXBwLkNoYXJ0TW9kZWwuYWRkU2VsZWN0ZWRDb3VudHJ5KCB7IGlkOiAkc2VsZWN0LnZhbCgpLCBuYW1lOiB0ZXh0IH0gKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdEFwcC5DaGFydE1vZGVsLnJlcGxhY2VTZWxlY3RlZENvdW50cnkoIHsgaWQ6ICRzZWxlY3QudmFsKCksIG5hbWU6IHRleHQgfSApO1xuXHRcdFx0fVxuXG5cdFx0XHQvL2RvdWJsZSBjaGVjayBpZiB3ZSBkb24ndCBoYXZlIGZ1bGwgc2VsZWN0aW9uIG9mIGNvdW50cmllc1xuXHRcdFx0dmFyIGVudGl0aWVzQ29sbGVjdGlvbiA9IHt9LFxuXHRcdFx0XHRmb3JtQ29uZmlnID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImZvcm0tY29uZmlnXCIgKTtcblx0XHRcdGlmKCBmb3JtQ29uZmlnICYmIGZvcm1Db25maWdbIFwiZW50aXRpZXMtY29sbGVjdGlvblwiIF0gKSB7XG5cdFx0XHRcdHZhciBzZWxlY3RlZENvdW50cmllc0lkcyA9IF8ua2V5cyggQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcInNlbGVjdGVkLWNvdW50cmllc1wiICkgKTtcblx0XHRcdFx0aWYoIHNlbGVjdGVkQ291bnRyaWVzSWRzLmxlbmd0aCA9PSBmb3JtQ29uZmlnWyBcImVudGl0aWVzLWNvbGxlY3Rpb25cIiBdLmxlbmd0aCApIHtcblx0XHRcdFx0XHRBcHAuQ2hhcnRNb2RlbC5zZXQoIFwic2VsZWN0ZWQtY291bnRyaWVzXCIsIFtdLCB7c2lsZW50OnRydWV9ICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdH0sXG5cblx0XHRjYWNoZUNvbG9yczogZnVuY3Rpb24oIGRhdGEgKSB7XG5cdFx0XHRpZiggIXRoaXMuY2FjaGVkQ29sb3JzLmxlbmd0aCApIHtcblx0XHRcdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdFx0XHRfLmVhY2goIGRhdGEsIGZ1bmN0aW9uKCB2LCBpICkge1xuXHRcdFx0XHRcdHRoYXQuY2FjaGVkQ29sb3JzWyB2LmlkIF0gPSB2LmNvbG9yO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdGFzc2lnbkNvbG9yRnJvbUNhY2hlOiBmdW5jdGlvbiggdmFsdWUgKSB7XG5cdFx0XHRpZiggdGhpcy5jYWNoZWRDb2xvcnMubGVuZ3RoICkge1xuXHRcdFx0XHQvL2Fzc2luZyBjb2xvciBmcm9tZSBjYWNoZVxuXHRcdFx0XHRpZiggdGhpcy5jYWNoZWRDb2xvcnNbIHZhbHVlLmlkIF0gKSB7XG5cdFx0XHRcdFx0dmFsdWUuY29sb3IgPSB0aGlzLmNhY2hlZENvbG9yc1sgdmFsdWUuaWQgXTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR2YXIgcmFuZG9tQ29sb3IgPSBBcHAuVXRpbHMuZ2V0UmFuZG9tQ29sb3IoKTtcblx0XHRcdFx0XHR2YWx1ZS5jb2xvciA9IHJhbmRvbUNvbG9yO1xuXHRcdFx0XHRcdHRoaXMuY2FjaGVkQ29sb3JzWyB2YWx1ZS5pZCBdID0gcmFuZG9tQ29sb3I7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHR9XG5cdFx0XG5cdH0gKTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5DaGFydC5DaGFydFRhYjtcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdEFwcC5WaWV3cy5DaGFydC5EYXRhVGFiID0gQmFja2JvbmUuVmlldy5leHRlbmQoIHtcblxuXHRcdGVsOiBcIiNjaGFydC12aWV3XCIsXG5cdFx0ZXZlbnRzOiB7fSxcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0XG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIgPSBvcHRpb25zLmRpc3BhdGNoZXI7XG5cblx0XHRcdC8vZGF0YSB0YWJcblx0XHRcdHRoaXMuJGRhdGFUYWIgPSB0aGlzLiRlbC5maW5kKCBcIiNkYXRhLWNoYXJ0LXRhYlwiICk7XG5cdFx0XHR0aGlzLiRkb3dubG9hZEJ0biA9IHRoaXMuJGRhdGFUYWIuZmluZCggXCIuZG93bmxvYWQtZGF0YS1idG5cIiApO1xuXHRcdFx0dGhpcy4kZGF0YVRhYmxlV3JhcHBlciA9IHRoaXMuJGRhdGFUYWIuZmluZCggXCIuZGF0YS10YWJsZS13cmFwcGVyXCIgKTtcblxuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCBkYXRhLCBsb2NhbERhdGEsIGRpbWVuc2lvbnMgKSB7XG5cdFx0XHRcblx0XHRcdHRoaXMuJGRhdGFUYWJsZVdyYXBwZXIuZW1wdHkoKTtcblxuXHRcdFx0Ly91cGRhdGUgbGlua1xuXHRcdFx0dmFyIHRoYXQgPSB0aGlzLFxuXHRcdFx0XHRjaGFydFR5cGUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdHlwZVwiICksXG5cdFx0XHRcdGhhc011bHRpcGxlQ29sdW1ucyA9ICggQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImdyb3VwLWJ5LXZhcmlhYmxlc1wiICkgJiYgY2hhcnRUeXBlICE9PSBcIjNcIiApPyB0cnVlOiBmYWxzZTsvKixcblx0XHRcdFx0YmFzZVVybCA9IHRoaXMuJGRvd25sb2FkQnRuLmF0dHIoIFwiZGF0YS1iYXNlLXVybFwiICksXG5cdFx0XHRcdGRpbWVuc2lvbnNVcmwgPSBlbmNvZGVVUklDb21wb25lbnQoIGRpbWVuc2lvbnNTdHJpbmcgKTsqL1xuXHRcdFx0Ly90aGlzLiRkb3dubG9hZEJ0bi5hdHRyKCBcImhyZWZcIiwgYmFzZVVybCArIFwiP2RpbWVuc2lvbnM9XCIgKyBkaW1lbnNpb25zVXJsICsgXCImY2hhcnRUeXBlPVwiICsgY2hhcnRUeXBlICsgXCImZXhwb3J0PWNzdlwiICk7XG5cdFx0XHR0aGlzLiRkb3dubG9hZEJ0bi5vbiggXCJjbGlja1wiLCBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXG5cdFx0XHRcdHZhciBkYXRhID0gW10sXG5cdFx0XHRcdFx0JHRycyA9IHRoYXQuJGVsLmZpbmQoIFwidHJcIiApO1xuXHRcdFx0XHQkLmVhY2goICR0cnMsIGZ1bmN0aW9uKCBpLCB2ICkge1xuXG5cdFx0XHRcdFx0dmFyIHRyRGF0YSA9IFtdLFxuXHRcdFx0XHRcdFx0JHRyID0gJCggdGhpcyApLFxuXHRcdFx0XHRcdFx0JGNlbGxzID0gJHRyLmZpbmQoIFwidGgsIHRkXCIgKTtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHQkLmVhY2goICRjZWxscywgZnVuY3Rpb24oIGkyLCB2MiApIHtcblx0XHRcdFx0XHRcdHRyRGF0YS5wdXNoKCAkKCB2MiApLnRleHQoKSApO1xuXHRcdFx0XHRcdH0gKTtcblxuXHRcdFx0XHRcdGRhdGEucHVzaCggdHJEYXRhICk7XG5cblx0XHRcdFx0fSApO1xuXG5cdFx0XHRcdHZhciBjc3ZTdHJpbmcgPSBcImRhdGE6dGV4dC9jc3Y7Y2hhcnNldD11dGYtOCxcIjtcblx0XHRcdFx0Xy5lYWNoKCBkYXRhLCBmdW5jdGlvbiggdiwgaSApIHtcblx0XHRcdFx0XHR2YXIgZGF0YVN0cmluZyA9IHYuam9pbihcIixcIik7XG5cdFx0XHRcdFx0Y3N2U3RyaW5nICs9ICggaSA8IGRhdGEubGVuZ3RoICk/IGRhdGFTdHJpbmcrIFwiXFxuXCIgOiBkYXRhU3RyaW5nO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdFxuXHRcdFx0XHR2YXIgZW5jb2RlZFVyaSA9IGVuY29kZVVSSSggY3N2U3RyaW5nICk7XG5cdFx0XHRcdHdpbmRvdy5vcGVuKCBlbmNvZGVkVXJpICk7XG5cblx0XHRcdH0gKTtcblxuXHRcdFx0Ly9nZXQgYWxsIHRpbWVzXG5cdFx0XHR2YXIgdGltZXNPYmogPSBbXSxcblx0XHRcdFx0dGltZXMgPSBbXTtcblx0XHRcdF8uZWFjaCggZGF0YSwgZnVuY3Rpb24oIGVudGl0eURhdGEsIGVudGl0eUlkICkge1xuXG5cdFx0XHRcdHZhciB2YWx1ZXMgPSBlbnRpdHlEYXRhLnZhbHVlcyxcblx0XHRcdFx0XHR2YWx1ZXNCeVRpbWUgPSBbXTtcblxuXHRcdFx0XHRfLmVhY2goIHZhbHVlcywgZnVuY3Rpb24oIHZhbHVlICkge1xuXG5cdFx0XHRcdFx0Ly9zdG9yZSBnaXZlbiB0aW1lIGFzIGV4aXN0aW5nXG5cdFx0XHRcdFx0dmFyIHRpbWUgPSB2YWx1ZS50aW1lO1xuXHRcdFx0XHRcdGlmKCAhdGltZXNPYmpbIHRpbWUgXSApIHtcblx0XHRcdFx0XHRcdHRpbWVzT2JqWyB0aW1lIF0gPSB0cnVlO1xuXHRcdFx0XHRcdFx0dGltZXMucHVzaCggdGltZSApO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vcmUtbWFwIHZhbHVlcyBieSB0aW1lIGtleVxuXHRcdFx0XHRcdHZhbHVlc0J5VGltZVsgdGltZSBdID0gdmFsdWU7XG5cblx0XHRcdFx0fSApO1xuXG5cdFx0XHRcdGVudGl0eURhdGEudmFsdWVzQnlUaW1lID0gdmFsdWVzQnlUaW1lO1xuXG5cdFx0XHR9ICk7XG5cblx0XHRcdC8vc29ydCBnYXRoZXJlZCB0aW1lc1xuXHRcdFx0dGltZXMgPSBfLnNvcnRCeSggdGltZXMsIGZ1bmN0aW9uKCB2ICkgeyByZXR1cm4gK3Y7IH0gKTtcblx0XHRcdFxuXHRcdFx0Ly9jcmVhdGUgZmlyc3Qgcm93XG5cdFx0XHR2YXIgdGFibGVTdHJpbmcgPSBcIjx0YWJsZSBjbGFzcz0nZGF0YS10YWJsZSc+XCIsXG5cdFx0XHRcdHRyID0gXCI8dHI+PHRkPjxzdHJvbmc+IDwvc3Ryb25nPjwvdGQ+XCI7XG5cdFx0XHRfLmVhY2goIHRpbWVzLCBmdW5jdGlvbiggdGltZSApIHtcblxuXHRcdFx0XHQvL2NyZWF0ZSBjb2x1bW4gZm9yIGV2ZXJ5IGRpbWVuc2lvblxuXHRcdFx0XHRfLmVhY2goIGRpbWVuc2lvbnMsIGZ1bmN0aW9uKCBkaW1lbnNpb24sIGkgKSB7XG5cdFx0XHRcdFx0aWYoIGkgPT09IDAgfHwgaGFzTXVsdGlwbGVDb2x1bW5zICkge1xuXHRcdFx0XHRcdFx0dmFyIHRoID0gXCI8dGg+XCI7XG5cdFx0XHRcdFx0XHR0aCArPSB0aW1lO1xuXHRcdFx0XHRcdFx0aWYoIGRpbWVuc2lvbnMubGVuZ3RoID4gMSAmJiBoYXNNdWx0aXBsZUNvbHVtbnMgKSB7XG5cdFx0XHRcdFx0XHRcdC8vd2UgaGF2ZSBtb3JlIHRoYW4gb25lIGRpbWVuc2lvbiwgbmVlZCB0byBkaXN0aW5ndWlzaCB0aGVtIGluIFxuXHRcdFx0XHRcdFx0XHR0aCArPSBcIiAtIFwiICsgZGltZW5zaW9uLnZhcmlhYmxlTmFtZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHRoICs9IFwiPC90aD5cIjtcblx0XHRcdFx0XHRcdHRyICs9IHRoO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cblx0XHRcdH0gKTtcblx0XHRcdHRyICs9IFwiPC90cj5cIjtcblx0XHRcdHRhYmxlU3RyaW5nICs9IHRyO1xuXG5cdFx0XHRfLmVhY2goIGRhdGEsIGZ1bmN0aW9uKCBlbnRpdHlEYXRhLCBlbnRpdHlJZCApIHtcblxuXHRcdFx0XHR2YXIgdHIgPSBcIjx0cj5cIixcblx0XHRcdFx0XHQvL2FkZCBuYW1lIG9mIGVudGl0eVxuXHRcdFx0XHRcdHRkID0gXCI8dGQ+PHN0cm9uZz5cIiArIGVudGl0eURhdGEua2V5ICsgXCI8L3N0cm9uZz48L3RkPlwiO1xuXHRcdFx0XHR0ciArPSB0ZDtcblxuXHRcdFx0XHR2YXIgdmFsdWVzQnlUaW1lID0gZW50aXR5RGF0YS52YWx1ZXNCeVRpbWU7XG5cdFx0XHRcdF8uZWFjaCggdGltZXMsIGZ1bmN0aW9uKCB0aW1lICkge1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdC8vY3JlYXRlIGNvbHVtbiBmb3IgZXZlcnkgZGltZW5zaW9uXG5cdFx0XHRcdFx0Xy5lYWNoKCBkaW1lbnNpb25zLCBmdW5jdGlvbiggZGltZW5zaW9uLCBpICkge1xuXHRcdFx0XHRcdFx0aWYoIGkgPT09IDAgfHwgaGFzTXVsdGlwbGVDb2x1bW5zICkge1xuXHRcdFx0XHRcdFx0XHR2YXIgdGQgPSBcIjx0ZD5cIixcblx0XHRcdFx0XHRcdFx0XHR0ZFZhbHVlID0gXCJcIjtcblx0XHRcdFx0XHRcdFx0Ly9pcyB0aGVyZSB2YWx1ZSBmb3IgZ2l2ZW4gdGltZVxuXHRcdFx0XHRcdFx0XHRpZiggdmFsdWVzQnlUaW1lWyB0aW1lIF0gKSB7XG5cdFx0XHRcdFx0XHRcdFx0aWYoICF2YWx1ZXNCeVRpbWVbIHRpbWUgXS5mYWtlICkge1xuXHRcdFx0XHRcdFx0XHRcdFx0dGRWYWx1ZSA9IHZhbHVlc0J5VGltZVsgdGltZSBdWyBkaW1lbnNpb24ucHJvcGVydHkgXTtcblx0XHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdFx0Ly9qdXN0IGR1bW15IHZhbHVlcyBmb3IgY29ycmVjdCByZW5kZXJpbmcgb2YgY2hhcnQsIGRvbid0IGFkZCBpbnRvIHRhYmxlXG5cdFx0XHRcdFx0XHRcdFx0XHR0ZFZhbHVlID0gXCJcIjtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0dGQgKz0gdGRWYWx1ZTtcblx0XHRcdFx0XHRcdFx0dGQgKz0gXCI8L3RkPlwiO1xuXHRcdFx0XHRcdFx0XHR0ciArPSB0ZDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFxuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdFxuXHRcdFx0XHR0ciArPSBcIjwvdHI+XCI7XG5cdFx0XHRcdHRhYmxlU3RyaW5nICs9IHRyO1xuXG5cdFx0XHR9ICk7XG5cblx0XHRcdHRhYmxlU3RyaW5nICs9IFwiPC90YWJsZT5cIjtcblxuXHRcdFx0dmFyICR0YWJsZSA9ICQoIHRhYmxlU3RyaW5nICk7XG5cdFx0XHR0aGlzLiRkYXRhVGFibGVXcmFwcGVyLmFwcGVuZCggJHRhYmxlICk7XG5cblxuXHRcdH1cblxuXHR9ICk7XG5cdFxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5DaGFydC5EYXRhVGFiO1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0QXBwLlZpZXdzLkNoYXJ0LkhlYWRlciA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblxuXHRcdGVsOiBcIiNjaGFydC12aWV3IC5jaGFydC1oZWFkZXJcIixcblx0XHRldmVudHM6IHt9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHRcblx0XHRcdHRoaXMuZGlzcGF0Y2hlciA9IG9wdGlvbnMuZGlzcGF0Y2hlcjtcblx0XHRcdFxuXHRcdFx0dGhpcy4kdGFicyA9IHRoaXMuJGVsLmZpbmQoIFwiLmhlYWRlci10YWJcIiApO1xuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblxuXHRcdFx0Ly9zZXR1cCBldmVudHNcblx0XHRcdEFwcC5DaGFydE1vZGVsLm9uKCBcImNoYW5nZVwiLCB0aGlzLnJlbmRlciwgdGhpcyApO1xuXG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcblx0XHRcdHZhciB0YWJzID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcInRhYnNcIiApO1xuXHRcdFx0XG5cdFx0XHQvL2hpZGUgZmlyc3QgZXZlcnl0aGluZ1xuXHRcdFx0dGhpcy4kdGFicy5oaWRlKCk7XG5cblx0XHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRcdF8uZWFjaCggdGFicywgZnVuY3Rpb24oIHYsIGkgKSB7XG5cdFx0XHRcdHZhciB0YWIgPSB0aGF0LiR0YWJzLmZpbHRlciggXCIuXCIgKyB2ICsgXCItaGVhZGVyLXRhYlwiICk7XG5cdFx0XHRcdHRhYi5zaG93KCk7XG5cdFx0XHRcdGlmKCBpID09PSAwICkge1xuXHRcdFx0XHRcdHRhYi5hZGRDbGFzcyggXCJhY3RpdmVcIiApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cblx0XHR9XG5cblx0fSk7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVmlld3MuQ2hhcnQuSGVhZGVyO1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cdFxuXHRBcHAuVmlld3MuQ2hhcnQuTGVnZW5kID0gZnVuY3Rpb24oIGNoYXJ0TGVnZW5kICkge1xuXHRcblx0XHQvL2Jhc2VkIG9uIGh0dHBzOi8vZ2l0aHViLmNvbS9ub3Z1cy9udmQzL2Jsb2IvbWFzdGVyL3NyYy9tb2RlbHMvbGVnZW5kLmpzXG5cblx0XHQvLz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXHRcdC8vIFB1YmxpYyBWYXJpYWJsZXMgd2l0aCBEZWZhdWx0IFNldHRpbmdzXG5cdFx0Ly8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuXHRcdHZhciBjaGFydFR5cGUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdHlwZVwiIClcblx0XHRcdCwgbWFyZ2luID0ge3RvcDogNSwgcmlnaHQ6IDUwLCBib3R0b206IDUsIGxlZnQ6IDYyfVxuXHRcdFx0LCB3aWR0aCA9IDgwMFxuXHRcdFx0LCBoZWlnaHQgPSAyMFxuXHRcdFx0LCBnZXRLZXkgPSBmdW5jdGlvbihkKSB7IHJldHVybiBkLmtleSB9XG5cdFx0XHQsIGNvbG9yID0gbnYudXRpbHMuZ2V0Q29sb3IoKVxuXHRcdFx0LCBhbGlnbiA9IHRydWVcblx0XHRcdCwgcGFkZGluZyA9IDQwIC8vZGVmaW5lIGhvdyBtdWNoIHNwYWNlIGJldHdlZW4gbGVnZW5kIGl0ZW1zLiAtIHJlY29tbWVuZCAzMiBmb3IgZnVyaW91cyB2ZXJzaW9uXG5cdFx0XHQsIHJpZ2h0QWxpZ24gPSBmYWxzZVxuXHRcdFx0LCB1cGRhdGVTdGF0ZSA9IHRydWUgICAvL0lmIHRydWUsIGxlZ2VuZCB3aWxsIHVwZGF0ZSBkYXRhLmRpc2FibGVkIGFuZCB0cmlnZ2VyIGEgJ3N0YXRlQ2hhbmdlJyBkaXNwYXRjaC5cblx0XHRcdCwgcmFkaW9CdXR0b25Nb2RlID0gZmFsc2UgICAvL0lmIHRydWUsIGNsaWNraW5nIGxlZ2VuZCBpdGVtcyB3aWxsIGNhdXNlIGl0IHRvIGJlaGF2ZSBsaWtlIGEgcmFkaW8gYnV0dG9uLiAob25seSBvbmUgY2FuIGJlIHNlbGVjdGVkIGF0IGEgdGltZSlcblx0XHRcdCwgZXhwYW5kZWQgPSBmYWxzZVxuXHRcdFx0LCBkaXNwYXRjaCA9IGQzLmRpc3BhdGNoKCdsZWdlbmRDbGljaycsICdsZWdlbmREYmxjbGljaycsICdsZWdlbmRNb3VzZW92ZXInLCAnbGVnZW5kTW91c2VvdXQnLCAnc3RhdGVDaGFuZ2UnLCAncmVtb3ZlRW50aXR5JywgJ2FkZEVudGl0eScpXG5cdFx0XHQsIHZlcnMgPSAnY2xhc3NpYycgLy9PcHRpb25zIGFyZSBcImNsYXNzaWNcIiBhbmQgXCJmdXJpb3VzXCIgYW5kIFwib3dkXCJcblx0XHRcdDtcblxuXHRcdGZ1bmN0aW9uIGNoYXJ0KHNlbGVjdGlvbikge1xuXHRcdFx0XG5cdFx0XHRzZWxlY3Rpb24uZWFjaChmdW5jdGlvbihkYXRhKSB7XG5cdFx0XHRcdFxuXHRcdFx0XHR2YXIgJHN2ZyA9ICQoIFwic3ZnLm52ZDMtc3ZnXCIgKSxcblx0XHRcdFx0XHRhdmFpbGFibGVXaWR0aCA9ICRzdmcud2lkdGgoKSAtIG1hcmdpbi5sZWZ0IC0gbWFyZ2luLnJpZ2h0LFxuXHRcdFx0XHRcdGNvbnRhaW5lciA9IGQzLnNlbGVjdCh0aGlzKTtcblx0XHRcdFx0XG5cdFx0XHRcdG52LnV0aWxzLmluaXRTVkcoY29udGFpbmVyKTtcblxuXHRcdFx0XHR2YXIgYmluZGFibGVEYXRhID0gZGF0YTtcblxuXHRcdFx0XHQvL2Rpc2NyZXRlIGJhciBjaGFydCBuZWVkcyB1bnBhY2sgZGF0YVxuXHRcdFx0XHRpZiggY2hhcnRUeXBlID09PSBcIjZcIiApIHtcblx0XHRcdFx0XHRpZiggZGF0YSAmJiBkYXRhLmxlbmd0aCAmJiBkYXRhWzBdLnZhbHVlcyApIHtcblx0XHRcdFx0XHRcdHZhciBkaXNjcmV0ZURhdGEgPSBfLm1hcCggZGF0YVswXS52YWx1ZXMsIGZ1bmN0aW9uKCB2LCBpICkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4geyBpZDogdi5pZCwga2V5OiB2LngsIGNvbG9yOiB2LmNvbG9yLCB2YWx1ZXM6IHYgfTtcblx0XHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHRcdGJpbmRhYmxlRGF0YSA9IGRpc2NyZXRlRGF0YTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdC8vIFNldHVwIGNvbnRhaW5lcnMgYW5kIHNrZWxldG9uIG9mIGNoYXJ0XG5cdFx0XHRcdHZhciB3cmFwID0gY29udGFpbmVyLnNlbGVjdEFsbCgnZy5udi1jdXN0b20tbGVnZW5kJykuZGF0YShbYmluZGFibGVEYXRhXSksXG5cdFx0XHRcdC8vdmFyIHdyYXAgPSBjb250YWluZXIuc2VsZWN0QWxsKCdnLm52LWN1c3RvbS1sZWdlbmQnKS5kYXRhKFtkYXRhXSksXG5cdFx0XHRcdFx0Z0VudGVyID0gd3JhcC5lbnRlcigpLmFwcGVuZCgnZycpLmF0dHIoJ2NsYXNzJywgJ252ZDMgbnYtY3VzdG9tLWxlZ2VuZCcpLmFwcGVuZCgnZycpLmF0dHIoICdjbGFzcycsICdudi1sZWdlbmQtc2VyaWVzLXdyYXBwZXInICksXG5cdFx0XHRcdFx0ZyA9IHdyYXAuc2VsZWN0KCdnJyk7XG5cblx0XHRcdFx0d3JhcC5hdHRyKCd0cmFuc2Zvcm0nLCAndHJhbnNsYXRlKCcgKyBtYXJnaW4ubGVmdCArICcsJyArIG1hcmdpbi50b3AgKyAnKScpO1xuXG5cdFx0XHRcdHZhciBzZXJpZXMgPSBnLnNlbGVjdEFsbCgnLm52LXNlcmllcycpXG5cdFx0XHRcdFx0LmRhdGEoZnVuY3Rpb24oZCkge1xuXHRcdFx0XHRcdFx0aWYodmVycyAhPSAnZnVyaW91cycpIHJldHVybiBkO1xuXHRcdFx0XHRcdFx0cmV0dXJuIGQuZmlsdGVyKGZ1bmN0aW9uKG4pIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGV4cGFuZGVkID8gdHJ1ZSA6ICFuLmRpc2VuZ2FnZWQ7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XG5cdFx0XHRcdC8vYWRkIGVudGl0eSBsYWJlbFxuXHRcdFx0XHR2YXIgZW50aXR5TGFiZWwgPSB3cmFwLnNlbGVjdCggJy5udi1lbnRpdHktbGFiZWwnICksXG5cdFx0XHRcdFx0ZW50aXR5TGFiZWxUZXh0ID0gZW50aXR5TGFiZWwuc2VsZWN0KCAndGV4dCcgKSxcblx0XHRcdFx0XHRlbnRpdHlMYWJlbFdpZHRoID0gMDtcblx0XHRcdFx0Ly9kaXNwbGF5aW5nIG9mIGVudGl0eSBsYWJlbCBpcyBkaXNhYmxlZFxuXHRcdFx0XHQvKmlmKCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiYWRkLWNvdW50cnktbW9kZVwiICkgPT09IFwiY2hhbmdlLWNvdW50cnlcIiApIHtcblx0XHRcdFx0XHRpZiggZW50aXR5TGFiZWwuZW1wdHkoKSApIHtcblx0XHRcdFx0XHRcdGVudGl0eUxhYmVsID0gd3JhcC5hcHBlbmQoICdnJyApLmF0dHIoJ2NsYXNzJywgJ252LWVudGl0eS1sYWJlbCcpLmF0dHIoICd0cmFuc2Zvcm0nLCAndHJhbnNsYXRlKDAsMTUpJyApO1xuXHRcdFx0XHRcdFx0ZW50aXR5TGFiZWxUZXh0ID0gZW50aXR5TGFiZWwuYXBwZW5kKCAndGV4dCcgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYoIGRhdGEgJiYgZGF0YVswXSAmJiBkYXRhWzBdLmVudGl0eSApIHtcblx0XHRcdFx0XHRcdGVudGl0eUxhYmVsVGV4dC50ZXh0KCBkYXRhWzBdLmVudGl0eSArIFwiOiBcIiApO1xuXHRcdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdFx0ZW50aXR5TGFiZWxXaWR0aCA9IGVudGl0eUxhYmVsVGV4dC5ub2RlKCkuZ2V0Q29tcHV0ZWRUZXh0TGVuZ3RoKCk7XG5cdFx0XHRcdFx0XHRcdC8vIElmIHRoZSBsZWdlbmRUZXh0IGlzIGRpc3BsYXk6bm9uZSdkIChub2RlVGV4dExlbmd0aCA9PSAwKSwgc2ltdWxhdGUgYW4gZXJyb3Igc28gd2UgYXBwcm94aW1hdGUsIGluc3RlYWRcblx0XHRcdFx0XHRcdFx0aWYoIGVudGl0eUxhYmVsV2lkdGggPD0gMCApIHRocm93IG5ldyBFcnJvcigpO1xuXHRcdFx0XHRcdFx0fSBjYXRjaCggZSApIHtcblx0XHRcdFx0XHRcdFx0ZW50aXR5TGFiZWxXaWR0aCA9IG52LnV0aWxzLmNhbGNBcHByb3hUZXh0V2lkdGgoZW50aXR5TGFiZWxUZXh0KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdC8vYWRkIHBhZGRpbmcgZm9yIGxhYmVsXG5cdFx0XHRcdFx0XHRlbnRpdHlMYWJlbFdpZHRoICs9IDMwO1xuXHRcdFx0XHRcdFx0YXZhaWxhYmxlV2lkdGggLT0gZW50aXR5TGFiZWxXaWR0aDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly9tYWtlIHN1cmUgdGhlcmUgaXMgbm90IGxhYmVsIGxlZnRcblx0XHRcdFx0XHRlbnRpdHlMYWJlbC5yZW1vdmUoKTtcblx0XHRcdFx0fSovXG5cdFx0XHRcdFxuXHRcdFx0XHQvL2lmIG5vdCBleGlzdGluZywgYWRkIG52LWFkZC1idG4sIGlmIG5vdCBncm91cGluZyBieSB2YXJpYWJsZXNcblx0XHRcdFx0dmFyIGFkZEVudGl0eUJ0biA9ICB3cmFwLnNlbGVjdCggJ2cubnYtYWRkLWJ0bicgKTtcblx0XHRcdFx0aWYoIGFkZEVudGl0eUJ0bi5lbXB0eSgpICkge1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0biA9IHdyYXAuYXBwZW5kKCdnJykuYXR0cignY2xhc3MnLCAnbnYtYWRkLWJ0bicpO1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5hcHBlbmQoJ3JlY3QnKS5hdHRyKCB7ICdjbGFzcyc6ICdhZGQtYnRuLWJnJywgJ3dpZHRoJzogJzEwMCcsICdoZWlnaHQnOiAnMjUnLCAndHJhbnNmb3JtJzogJ3RyYW5zbGF0ZSgwLC01KScgfSApO1xuXHRcdFx0XHRcdHZhciBhZGRFbnRpdHlCdG5HID0gYWRkRW50aXR5QnRuLmFwcGVuZCgnZycpLmF0dHIoIHsgJ2NsYXNzJzogJ2FkZC1idG4tcGF0aCcgfSApO1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bkcuYXBwZW5kKCdwYXRoJykuYXR0ciggeyAnZCc6ICdNMTUsMCBMMTUsMTQnLCAnY2xhc3MnOiAnbnYtYm94JyB9ICk7XG5cdFx0XHRcdFx0YWRkRW50aXR5QnRuRy5hcHBlbmQoJ3BhdGgnKS5hdHRyKCB7ICdkJzogJ004LDcgTDIyLDcnLCAnY2xhc3MnOiAnbnYtYm94JyB9ICk7XG5cdFx0XHRcdFx0Ly9odHRwOi8vYW5kcm9pZC11aS11dGlscy5nb29nbGVjb2RlLmNvbS9oZy1oaXN0b3J5L2FjOTU1ZTYzNzY0NzBkOTU5OWVhZDA3YjQ1OTllZjkzNzgyNGY5MTkvYXNzZXQtc3R1ZGlvL2Rpc3QvcmVzL2NsaXBhcnQvaWNvbnMvcmVmcmVzaC5zdmc/cj1hYzk1NWU2Mzc2NDcwZDk1OTllYWQwN2I0NTk5ZWY5Mzc4MjRmOTE5XG5cdFx0XHRcdFx0YWRkRW50aXR5QnRuLmFwcGVuZCgncGF0aCcpLmF0dHIoIHsgJ2QnOiAnTTE2MC40NjksMjQyLjE5NGMwLTQ0LjQxNCwzNi4wMjMtODAuNDM4LDgwLjQzOC04MC40MzhjMTkuMTg4LDAsMzYuNzExLDYuODQ0LDUwLjUsMTguMDc4TDI1OS43OCwyMDkuOTNsOTkuOTQ1LDExLjM2NyAgICBsMC44MDUtMTA3LjI0MmwtMzAuNzY2LDI5LjI4OWMtMjMuNTQ2LTIxLjIwMy01NC42MjQtMzQuMTY0LTg4LjgwNC0zNC4xNjRjLTczLjQ2OSwwLTEzMy4wMjMsNTkuNTYyLTEzMy4wMjMsMTMzLjAxNiAgICBjMCwyLjc0MiwwLjI0Mi0yLjI2NiwwLjQxNCwwLjQ0NWw1My42OCw3LjU1NUMxNjEuMDMsMjQ1LjEwOCwxNjAuNDY5LDI0Ny41NjIsMTYwLjQ2OSwyNDIuMTk0eiBNMzcxLjY0NywyMzcuMzc1bC01My42ODEtNy41NTUgICAgYzEuMDE3LDUuMDg2LDEuNTU2LDIuNjE3LDEuNTU2LDcuOTkyYzAsNDQuNDE0LTM2LjAwOCw4MC40MzEtODAuNDMsODAuNDMxYy0xOS4xMzMsMC0zNi42MDItNi43OTgtNTAuMzgzLTE3Ljk3bDMxLjU5NS0zMC4wNzggICAgbC05OS45My0xMS4zNjZsLTAuODEyLDEwNy4yNWwzMC43ODktMjkuMzEyYzIzLjUzMSwyMS4xNDEsNTQuNTcsMzQuMDU1LDg4LjY4OCwzNC4wNTVjNzMuNDY4LDAsMTMzLjAyMy01OS41NTUsMTMzLjAyMy0xMzMuMDA4ICAgIEMzNzIuMDYyLDIzNS4wNzgsMzcxLjgxMiwyNDAuMDg1LDM3MS42NDcsMjM3LjM3NXonLCAnY2xhc3MnOiAnbnYtYm94IGNoYW5nZS1idG4tcGF0aCcsICd0cmFuc2Zvcm0nOiAnc2NhbGUoLjA0KSB0cmFuc2xhdGUoMTUwLC01MCknIH0gKTtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4uYXBwZW5kKCd0ZXh0JykuYXR0ciggeyd4JzoyOCwneSc6MTF9ICkudGV4dCgnQWRkIGNvdW50cnknKTtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4ub24oICdjbGljaycsIGZ1bmN0aW9uKCBkLCBpICkge1xuXHRcdFx0XHRcdFx0Ly9ncm91cCBieSB2YXJpYWJsZXNcblx0XHRcdFx0XHRcdGRpc3BhdGNoLmFkZEVudGl0eSgpO1xuXHRcdFx0XHRcdFx0ZDMuZXZlbnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdC8vYmFzZWQgb24gc2VsZWN0ZWQgY291bnRyaWVzIHNlbGVjdGlvbiBoaWRlIG9yIHNob3cgYWRkRW50aXR5QnRuXG5cdFx0XHRcdGlmKCBfLmlzRW1wdHkoIEFwcC5DaGFydE1vZGVsLmdldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiApICkgKSB7XG5cdFx0XHRcdFx0YWRkRW50aXR5QnRuLmF0dHIoIFwiZGlzcGxheVwiLCBcIm5vbmVcIiApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5hdHRyKCBcImRpc3BsYXlcIiwgXCJibG9ja1wiICk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR2YXIgYWRkQ291bnRyeU1vZGUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiYWRkLWNvdW50cnktbW9kZVwiICk7XG5cdFx0XHRcdGlmKCBhZGRDb3VudHJ5TW9kZSA9PT0gXCJhZGQtY291bnRyeVwiICkge1xuXHRcdFx0XHQvL2lmKCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiZ3JvdXAtYnktdmFyaWFibGVzXCIgKSApIHtcblx0XHRcdFx0XHQvL2lmIGdyb3VwaW5nIGJ5IHZhcmlhYmxlLCBsZWdlbmQgd2lsbCBzaG93IHZhcmlhYmxlcyBpbnN0ZWFkIG9mIGNvdW50cmllcywgc28gYWRkIGNvdW50cnkgYnRuIGRvZXNuJ3QgbWFrZSBzZW5zZVxuXHRcdFx0XHRcdC8vaWYgZW5hYmxpbmcgYWRkaW5nIGNvdW50cmllc1xuXHRcdFx0XHRcdC8vYWRkRW50aXR5QnRuLmF0dHIoIFwiZGlzcGxheVwiLCBcIm5vbmVcIiApO1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5zZWxlY3QoIFwidGV4dFwiICkudGV4dCggXCJBZGQgY291bnRyeVwiICk7XG5cdFx0XHRcdFx0YWRkRW50aXR5QnRuLnNlbGVjdCggXCJyZWN0XCIgKS5hdHRyKCBcIndpZHRoXCIsIFwiMTAwXCIgKTtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4uc2VsZWN0KCBcIi5hZGQtYnRuLXBhdGhcIiApLmF0dHIoIFwiZGlzcGxheVwiLCBcImJsb2NrXCIgKTtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4uc2VsZWN0KCBcIi5jaGFuZ2UtYnRuLXBhdGhcIiApLmF0dHIoIFwiZGlzcGxheVwiLCBcIm5vbmVcIiApO1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5hdHRyKCBcImRpc3BsYXlcIiwgXCJibG9ja1wiICk7XG5cdFx0XHRcdH0gZWxzZSBpZiggYWRkQ291bnRyeU1vZGUgPT09IFwiY2hhbmdlLWNvdW50cnlcIiApIHtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4uc2VsZWN0KCBcIi5hZGQtYnRuLXBhdGhcIiApLmF0dHIoIFwiZGlzcGxheVwiLCBcIm5vbmVcIiApO1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5zZWxlY3QoIFwiLmNoYW5nZS1idG4tcGF0aFwiICkuYXR0ciggXCJkaXNwbGF5XCIsIFwiYmxvY2tcIiApO1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5zZWxlY3QoIFwidGV4dFwiICkudGV4dCggXCJDaGFuZ2UgY291bnRyeVwiICk7XG5cdFx0XHRcdFx0YWRkRW50aXR5QnRuLnNlbGVjdCggXCJyZWN0XCIgKS5hdHRyKCBcIndpZHRoXCIsIFwiMTIwXCIgKTtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4uYXR0ciggXCJkaXNwbGF5XCIsIFwiYmxvY2tcIiApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5hdHRyKCBcImRpc3BsYXlcIiwgXCJub25lXCIgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRcdFxuXHRcdFx0XHR2YXIgc2VyaWVzRW50ZXIgPSBzZXJpZXMuZW50ZXIoKS5hcHBlbmQoJ2cnKS5hdHRyKCdjbGFzcycsICdudi1zZXJpZXMnKSxcblx0XHRcdFx0XHRzZXJpZXNTaGFwZSwgc2VyaWVzUmVtb3ZlO1xuXG5cdFx0XHRcdHZhciB2ZXJzUGFkZGluZyA9IDMwO1xuXHRcdFx0XHRzZXJpZXNFbnRlci5hcHBlbmQoJ3JlY3QnKVxuXHRcdFx0XHRcdC5zdHlsZSgnc3Ryb2tlLXdpZHRoJywgMilcblx0XHRcdFx0XHQuYXR0cignY2xhc3MnLCdudi1sZWdlbmQtc3ltYm9sJyk7XG5cblx0XHRcdFx0Ly9lbmFibGUgcmVtb3ZpbmcgY291bnRyaWVzIG9ubHkgaWYgQWRkL1JlcGxhY2UgY291bnRyeSBidXR0b24gcHJlc2VudFxuXHRcdFx0XHRpZiggYWRkQ291bnRyeU1vZGUgPT0gXCJhZGQtY291bnRyeVwiICYmICFBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiZ3JvdXAtYnktdmFyaWFibGVzXCIgKSApIHtcblx0XHRcdFx0XHR2YXIgcmVtb3ZlQnRucyA9IHNlcmllc0VudGVyLmFwcGVuZCgnZycpXG5cdFx0XHRcdFx0XHQuYXR0cignY2xhc3MnLCAnbnYtcmVtb3ZlLWJ0bicpXG5cdFx0XHRcdFx0XHQuYXR0cigndHJhbnNmb3JtJywgJ3RyYW5zbGF0ZSgxMCwxMCknKTtcblx0XHRcdFx0XHRyZW1vdmVCdG5zLmFwcGVuZCgncGF0aCcpLmF0dHIoIHsgJ2QnOiAnTTAsMCBMNyw3JywgJ2NsYXNzJzogJ252LWJveCcgfSApO1xuXHRcdFx0XHRcdHJlbW92ZUJ0bnMuYXBwZW5kKCdwYXRoJykuYXR0ciggeyAnZCc6ICdNNywwIEwwLDcnLCAnY2xhc3MnOiAnbnYtYm94JyB9ICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdHNlcmllc1NoYXBlID0gc2VyaWVzLnNlbGVjdCgnLm52LWxlZ2VuZC1zeW1ib2wnKTtcblx0XHRcdFx0XG5cdFx0XHRcdHNlcmllc0VudGVyLmFwcGVuZCgndGV4dCcpXG5cdFx0XHRcdFx0LmF0dHIoJ3RleHQtYW5jaG9yJywgJ3N0YXJ0Jylcblx0XHRcdFx0XHQuYXR0cignY2xhc3MnLCdudi1sZWdlbmQtdGV4dCcpXG5cdFx0XHRcdFx0LmF0dHIoJ2R5JywgJy4zMmVtJylcblx0XHRcdFx0XHQuYXR0cignZHgnLCAnMCcpO1xuXG5cdFx0XHRcdHZhciBzZXJpZXNUZXh0ID0gc2VyaWVzLnNlbGVjdCgndGV4dC5udi1sZWdlbmQtdGV4dCcpLFxuXHRcdFx0XHRcdHNlcmllc1JlbW92ZSA9IHNlcmllcy5zZWxlY3QoJy5udi1yZW1vdmUtYnRuJyk7XG5cblx0XHRcdFx0c2VyaWVzXG5cdFx0XHRcdFx0Lm9uKCdtb3VzZW92ZXInLCBmdW5jdGlvbihkLGkpIHtcblx0XHRcdFx0XHRcdGNoYXJ0TGVnZW5kLmRpc3BhdGNoLmxlZ2VuZE1vdXNlb3ZlcihkLGkpOyAgLy9UT0RPOiBNYWtlIGNvbnNpc3RlbnQgd2l0aCBvdGhlciBldmVudCBvYmplY3RzXG5cdFx0XHRcdFx0fSlcblx0XHRcdFx0XHQub24oJ21vdXNlb3V0JywgZnVuY3Rpb24oZCxpKSB7XG5cdFx0XHRcdFx0XHRjaGFydExlZ2VuZC5kaXNwYXRjaC5sZWdlbmRNb3VzZW91dChkLGkpO1xuXHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0Lm9uKCdjbGljaycsIGZ1bmN0aW9uKGQsaSkge1xuXG5cdFx0XHRcdFx0XHRpZiggQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImdyb3VwLWJ5LXZhcmlhYmxlc1wiICkgfHwgYWRkQ291bnRyeU1vZGUgIT09IFwiYWRkLWNvdW50cnlcIiApIHtcblx0XHRcdFx0XHRcdFx0Ly9pZiBkaXNwbGF5aW5nIHZhcmlhYmxlcywgaW5zdGVhZCBvZiByZW1vdmluZywgdXNlIG9yaWdpbmFsIHZlcnNpb24ganVzdCB0byB0dXJuIHN0dWZmIG9mZlxuXHRcdFx0XHRcdFx0XHQvL29yaWdpbmFsIHZlcnNpb24sIHdoZW4gY2xpY2tpbmcgY291bnRyeSBsYWJlbCBqdXN0IGRlYWN0aXZhdGVzIGl0XG5cdFx0XHRcdFx0XHRcdGNoYXJ0TGVnZW5kLmRpc3BhdGNoLmxlZ2VuZENsaWNrKGQsaSk7XG5cdFx0XHRcdFx0XHRcdC8vIG1ha2Ugc3VyZSB3ZSByZS1nZXQgZGF0YSBpbiBjYXNlIGl0IHdhcyBtb2RpZmllZFxuXHRcdFx0XHRcdFx0XHR2YXIgZGF0YSA9IHNlcmllcy5kYXRhKCk7XG5cdFx0XHRcdFx0XHRcdGlmICh1cGRhdGVTdGF0ZSkge1xuXHRcdFx0XHRcdFx0XHRcdGlmKGV4cGFuZGVkKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRkLmRpc2VuZ2FnZWQgPSAhZC5kaXNlbmdhZ2VkO1xuXHRcdFx0XHRcdFx0XHRcdFx0ZC51c2VyRGlzYWJsZWQgPSBkLnVzZXJEaXNhYmxlZCA9PSB1bmRlZmluZWQgPyAhIWQuZGlzYWJsZWQgOiBkLnVzZXJEaXNhYmxlZDtcblx0XHRcdFx0XHRcdFx0XHRcdGQuZGlzYWJsZWQgPSBkLmRpc2VuZ2FnZWQgfHwgZC51c2VyRGlzYWJsZWQ7XG5cdFx0XHRcdFx0XHRcdFx0fSBlbHNlIGlmICghZXhwYW5kZWQpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGQuZGlzYWJsZWQgPSAhZC5kaXNhYmxlZDtcblx0XHRcdFx0XHRcdFx0XHRcdGQudXNlckRpc2FibGVkID0gZC5kaXNhYmxlZDtcblx0XHRcdFx0XHRcdFx0XHRcdHZhciBlbmdhZ2VkID0gZGF0YS5maWx0ZXIoZnVuY3Rpb24oZCkgeyByZXR1cm4gIWQuZGlzZW5nYWdlZDsgfSk7XG5cdFx0XHRcdFx0XHRcdFx0XHRpZiAoZW5nYWdlZC5ldmVyeShmdW5jdGlvbihzZXJpZXMpIHsgcmV0dXJuIHNlcmllcy51c2VyRGlzYWJsZWQgfSkpIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0Ly90aGUgZGVmYXVsdCBiZWhhdmlvciBvZiBOVkQzIGxlZ2VuZHMgaXMsIGlmIGV2ZXJ5IHNpbmdsZSBzZXJpZXNcblx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gaXMgZGlzYWJsZWQsIHR1cm4gYWxsIHNlcmllcycgYmFjayBvbi5cblx0XHRcdFx0XHRcdFx0XHRcdFx0ZGF0YS5mb3JFYWNoKGZ1bmN0aW9uKHNlcmllcykge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHNlcmllcy5kaXNhYmxlZCA9IHNlcmllcy51c2VyRGlzYWJsZWQgPSBmYWxzZTtcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdGNoYXJ0TGVnZW5kLmRpc3BhdGNoLnN0YXRlQ2hhbmdlKHtcblx0XHRcdFx0XHRcdFx0XHRcdGRpc2FibGVkOiBkYXRhLm1hcChmdW5jdGlvbihkKSB7IHJldHVybiAhIWQuZGlzYWJsZWQ7IH0pLFxuXHRcdFx0XHRcdFx0XHRcdFx0ZGlzZW5nYWdlZDogZGF0YS5tYXAoZnVuY3Rpb24oZCkgeyByZXR1cm4gISFkLmRpc2VuZ2FnZWQ7IH0pXG5cdFx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblxuXHRcdFx0XHRcdFx0XHQvL3doZW4gY2xpY2tpbmcgY291bnRyeSBsYWJlbCwgcmVtb3ZlIHRoZSBjb3VudHJ5XG5cdFx0XHRcdFx0XHRcdGQzLmV2ZW50LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHRcdFx0XHQvL3JlbW92ZSBzZXJpZXMgc3RyYWlnaHQgYXdheSwgc28gd2UgZG9uJ3QgaGF2ZSB0byB3YWl0IGZvciByZXNwb25zZSBmcm9tIHNlcnZlclxuXHRcdFx0XHRcdFx0XHRzZXJpZXNbMF1baV0ucmVtb3ZlKCk7XG5cdFx0XHRcdFx0XHRcdFxuXHRcdFx0XHRcdFx0XHR2YXIgaWQgPSBkLmlkO1xuXHRcdFx0XHRcdFx0XHQvL2luIGNhc2Ugb2YgbXVsdGl2YXJpZW50IGNoYXJ0XG5cdFx0XHRcdFx0XHRcdGlmKCBpZC5pbmRleE9mKCBcIi1cIiApID4gMCApIHtcblx0XHRcdFx0XHRcdFx0XHRpZCA9IHBhcnNlSW50KCBpZC5zcGxpdCggXCItXCIgKVsgMCBdLCAxMCApO1xuXHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdGlkID0gcGFyc2VJbnQoIGlkLCAxMCApO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGRpc3BhdGNoLnJlbW92ZUVudGl0eSggaWQgKTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR9KVxuXHRcdFx0XHRcdC5vbignZGJsY2xpY2snLCBmdW5jdGlvbihkLGkpIHtcblx0XHRcdFx0XHRcdGlmKCh2ZXJzID09ICdmdXJpb3VzJyB8fCB2ZXJzID09ICdvd2QnKSAmJiBleHBhbmRlZCkgcmV0dXJuO1xuXHRcdFx0XHRcdFx0Y2hhcnRMZWdlbmQuZGlzcGF0Y2gubGVnZW5kRGJsY2xpY2soZCxpKTtcblx0XHRcdFx0XHRcdGlmICh1cGRhdGVTdGF0ZSkge1xuXHRcdFx0XHRcdFx0XHQvLyBtYWtlIHN1cmUgd2UgcmUtZ2V0IGRhdGEgaW4gY2FzZSBpdCB3YXMgbW9kaWZpZWRcblx0XHRcdFx0XHRcdFx0dmFyIGRhdGEgPSBzZXJpZXMuZGF0YSgpO1xuXHRcdFx0XHRcdFx0XHQvL3RoZSBkZWZhdWx0IGJlaGF2aW9yIG9mIE5WRDMgbGVnZW5kcywgd2hlbiBkb3VibGUgY2xpY2tpbmcgb25lLFxuXHRcdFx0XHRcdFx0XHQvLyBpcyB0byBzZXQgYWxsIG90aGVyIHNlcmllcycgdG8gZmFsc2UsIGFuZCBtYWtlIHRoZSBkb3VibGUgY2xpY2tlZCBzZXJpZXMgZW5hYmxlZC5cblx0XHRcdFx0XHRcdFx0ZGF0YS5mb3JFYWNoKGZ1bmN0aW9uKHNlcmllcykge1xuXHRcdFx0XHRcdFx0XHRcdHNlcmllcy5kaXNhYmxlZCA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdFx0aWYodmVycyA9PSAnZnVyaW91cycgfHwgdmVycyA9PSAnb3dkJykgc2VyaWVzLnVzZXJEaXNhYmxlZCA9IHNlcmllcy5kaXNhYmxlZDtcblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdGQuZGlzYWJsZWQgPSBmYWxzZTtcblx0XHRcdFx0XHRcdFx0aWYodmVycyA9PSAnZnVyaW91cycgfHwgdmVycyA9PSAnb3dkJyApIGQudXNlckRpc2FibGVkID0gZC5kaXNhYmxlZDtcblx0XHRcdFx0XHRcdFx0Y2hhcnRMZWdlbmQuZGlzcGF0Y2guc3RhdGVDaGFuZ2Uoe1xuXHRcdFx0XHRcdFx0XHRcdGRpc2FibGVkOiBkYXRhLm1hcChmdW5jdGlvbihkKSB7IHJldHVybiAhIWQuZGlzYWJsZWQ7IH0pXG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHNlcmllc1JlbW92ZS5vbiggJ2NsaWNrJywgZnVuY3Rpb24oIGQsIGkgKSB7XG5cblx0XHRcdFx0XHRkMy5ldmVudC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcblx0XHRcdFx0XHQvL3JlbW92ZSBzZXJpZXMgc3RyYWlnaHQgYXdheSwgc28gd2UgZG9uJ3QgaGF2ZSB0byB3YWl0IGZvciByZXNwb25zZSBmcm9tIHNlcnZlclxuXHRcdFx0XHRcdHNlcmllc1swXVtpXS5yZW1vdmUoKTtcblx0XHRcdFx0XHRkaXNwYXRjaC5yZW1vdmVFbnRpdHkoIGQuaWQgKTtcblx0XHRcdFx0XHRcblx0XHRcdFx0fSApO1x0XG5cblx0XHRcdFx0c2VyaWVzLmNsYXNzZWQoJ252LWRpc2FibGVkJywgZnVuY3Rpb24oZCkgeyByZXR1cm4gZC51c2VyRGlzYWJsZWQ7IH0pO1xuXHRcdFx0XHRzZXJpZXMuZXhpdCgpLnJlbW92ZSgpO1xuXG5cdFx0XHRcdHNlcmllc1RleHRcblx0XHRcdFx0XHQuYXR0cignZmlsbCcsIHNldFRleHRDb2xvcilcblx0XHRcdFx0XHQudGV4dChnZXRLZXkpO1xuXG5cdFx0XHRcdC8vVE9ETzogaW1wbGVtZW50IGZpeGVkLXdpZHRoIGFuZCBtYXgtd2lkdGggb3B0aW9ucyAobWF4LXdpZHRoIGlzIGVzcGVjaWFsbHkgdXNlZnVsIHdpdGggdGhlIGFsaWduIG9wdGlvbilcblx0XHRcdFx0Ly8gTkVXIEFMSUdOSU5HIENPREUsIFRPRE86IGNsZWFuIHVwXG5cdFx0XHRcdHZhciBsZWdlbmRXaWR0aCA9IDAsXG5cdFx0XHRcdFx0dHJhbnNmb3JtWCwgdHJhbnNmb3JtWTtcblx0XHRcdFx0aWYgKGFsaWduKSB7XG5cblx0XHRcdFx0XHR2YXIgc2VyaWVzV2lkdGhzID0gW107XG5cdFx0XHRcdFx0c2VyaWVzLmVhY2goIGZ1bmN0aW9uKGQsaSkge1xuXHRcdFx0XHRcdFx0dmFyIGxlZ2VuZFRleHQgPSBkMy5zZWxlY3QodGhpcykuc2VsZWN0KCd0ZXh0Jyk7XG5cdFx0XHRcdFx0XHR2YXIgbm9kZVRleHRMZW5ndGg7XG5cdFx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0XHRub2RlVGV4dExlbmd0aCA9IGxlZ2VuZFRleHQubm9kZSgpLmdldENvbXB1dGVkVGV4dExlbmd0aCgpO1xuXHRcdFx0XHRcdFx0XHQvLyBJZiB0aGUgbGVnZW5kVGV4dCBpcyBkaXNwbGF5Om5vbmUnZCAobm9kZVRleHRMZW5ndGggPT0gMCksIHNpbXVsYXRlIGFuIGVycm9yIHNvIHdlIGFwcHJveGltYXRlLCBpbnN0ZWFkXG5cdFx0XHRcdFx0XHRcdGlmKG5vZGVUZXh0TGVuZ3RoIDw9IDApIHRocm93IEVycm9yKCk7XG5cdFx0XHRcdFx0XHR9IGNhdGNoKCBlICkge1xuXHRcdFx0XHRcdFx0XHRub2RlVGV4dExlbmd0aCA9IG52LnV0aWxzLmNhbGNBcHByb3hUZXh0V2lkdGgobGVnZW5kVGV4dCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRzZXJpZXNXaWR0aHMucHVzaChub2RlVGV4dExlbmd0aCArIHBhZGRpbmcpO1xuXHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0dmFyIHNlcmllc1BlclJvdyA9IDA7XG5cdFx0XHRcdFx0dmFyIGNvbHVtbldpZHRocyA9IFtdO1xuXHRcdFx0XHRcdGxlZ2VuZFdpZHRoID0gMDtcblxuXHRcdFx0XHRcdHdoaWxlKCBsZWdlbmRXaWR0aCA8IGF2YWlsYWJsZVdpZHRoICYmIHNlcmllc1BlclJvdyA8IHNlcmllc1dpZHRocy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0XHRjb2x1bW5XaWR0aHNbc2VyaWVzUGVyUm93XSA9IHNlcmllc1dpZHRoc1tzZXJpZXNQZXJSb3ddO1xuXHRcdFx0XHRcdFx0bGVnZW5kV2lkdGggKz0gc2VyaWVzV2lkdGhzW3Nlcmllc1BlclJvdysrXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYoIHNlcmllc1BlclJvdyA9PT0gMCApIHNlcmllc1BlclJvdyA9IDE7IC8vbWluaW11bSBvZiBvbmUgc2VyaWVzIHBlciByb3dcblxuXHRcdFx0XHRcdHdoaWxlKCBsZWdlbmRXaWR0aCA+IGF2YWlsYWJsZVdpZHRoICYmIHNlcmllc1BlclJvdyA+IDEgKSB7XG5cdFx0XHRcdFx0XHRjb2x1bW5XaWR0aHMgPSBbXTtcblx0XHRcdFx0XHRcdHNlcmllc1BlclJvdy0tO1xuXG5cdFx0XHRcdFx0XHRmb3IgKHZhciBrID0gMDsgayA8IHNlcmllc1dpZHRocy5sZW5ndGg7IGsrKykge1xuXHRcdFx0XHRcdFx0XHRpZiAoc2VyaWVzV2lkdGhzW2tdID4gKGNvbHVtbldpZHRoc1trICUgc2VyaWVzUGVyUm93XSB8fCAwKSApXG5cdFx0XHRcdFx0XHRcdFx0Y29sdW1uV2lkdGhzW2sgJSBzZXJpZXNQZXJSb3ddID0gc2VyaWVzV2lkdGhzW2tdO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRsZWdlbmRXaWR0aCA9IGNvbHVtbldpZHRocy5yZWR1Y2UoZnVuY3Rpb24ocHJldiwgY3VyLCBpbmRleCwgYXJyYXkpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHByZXYgKyBjdXI7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR2YXIgeFBvc2l0aW9ucyA9IFtdO1xuXHRcdFx0XHRcdGZvciAodmFyIGkgPSAwLCBjdXJYID0gMDsgaSA8IHNlcmllc1BlclJvdzsgaSsrKSB7XG5cdFx0XHRcdFx0XHR4UG9zaXRpb25zW2ldID0gY3VyWDtcblx0XHRcdFx0XHRcdGN1clggKz0gY29sdW1uV2lkdGhzW2ldO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHNlcmllc1xuXHRcdFx0XHRcdFx0LmF0dHIoJ3RyYW5zZm9ybScsIGZ1bmN0aW9uKGQsIGkpIHtcblx0XHRcdFx0XHRcdFx0dHJhbnNmb3JtWCA9IHhQb3NpdGlvbnNbaSAlIHNlcmllc1BlclJvd107XG5cdFx0XHRcdFx0XHRcdHRyYW5zZm9ybVkgPSAoNSArIE1hdGguZmxvb3IoaSAvIHNlcmllc1BlclJvdykgKiB2ZXJzUGFkZGluZyk7XG5cdFx0XHRcdFx0XHRcdHJldHVybiAndHJhbnNsYXRlKCcgKyB0cmFuc2Zvcm1YICsgJywnICsgdHJhbnNmb3JtWSArICcpJztcblx0XHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0Ly9wb3NpdGlvbiBsZWdlbmQgYXMgZmFyIHJpZ2h0IGFzIHBvc3NpYmxlIHdpdGhpbiB0aGUgdG90YWwgd2lkdGhcblx0XHRcdFx0XHRpZiAocmlnaHRBbGlnbikge1xuXHRcdFx0XHRcdFx0Zy5hdHRyKCd0cmFuc2Zvcm0nLCAndHJhbnNsYXRlKCcgKyAod2lkdGggLSBtYXJnaW4ucmlnaHQgLSBsZWdlbmRXaWR0aCkgKyAnLCcgKyBtYXJnaW4udG9wICsgJyknKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0XHRnLmF0dHIoJ3RyYW5zZm9ybScsICd0cmFuc2xhdGUoJyArIGVudGl0eUxhYmVsV2lkdGggKyAnLCcgKyBtYXJnaW4udG9wICsgJyknKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRoZWlnaHQgPSBtYXJnaW4udG9wICsgbWFyZ2luLmJvdHRvbSArIChNYXRoLmNlaWwoc2VyaWVzV2lkdGhzLmxlbmd0aCAvIHNlcmllc1BlclJvdykgKiB2ZXJzUGFkZGluZyk7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdH0gZWxzZSB7XG5cblx0XHRcdFx0XHR2YXIgeXBvcyA9IDUsXG5cdFx0XHRcdFx0XHRuZXd4cG9zID0gNSxcblx0XHRcdFx0XHRcdG1heHdpZHRoID0gMCxcblx0XHRcdFx0XHRcdHhwb3M7XG5cdFx0XHRcdFx0c2VyaWVzXG5cdFx0XHRcdFx0XHQuYXR0cigndHJhbnNmb3JtJywgZnVuY3Rpb24oZCwgaSkge1xuXHRcdFx0XHRcdFx0XHR2YXIgbGVuZ3RoID0gZDMuc2VsZWN0KHRoaXMpLnNlbGVjdCgndGV4dCcpLm5vZGUoKS5nZXRDb21wdXRlZFRleHRMZW5ndGgoKSArIHBhZGRpbmc7XG5cdFx0XHRcdFx0XHRcdHhwb3MgPSBuZXd4cG9zO1xuXG5cdFx0XHRcdFx0XHRcdGlmICh3aWR0aCA8IG1hcmdpbi5sZWZ0ICsgbWFyZ2luLnJpZ2h0ICsgeHBvcyArIGxlbmd0aCkge1xuXHRcdFx0XHRcdFx0XHRcdG5ld3hwb3MgPSB4cG9zID0gNTtcblx0XHRcdFx0XHRcdFx0XHR5cG9zICs9IHZlcnNQYWRkaW5nO1xuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0bmV3eHBvcyArPSBsZW5ndGg7XG5cdFx0XHRcdFx0XHRcdGlmIChuZXd4cG9zID4gbWF4d2lkdGgpIG1heHdpZHRoID0gbmV3eHBvcztcblxuXHRcdFx0XHRcdFx0XHRpZihsZWdlbmRXaWR0aCA8IHhwb3MgKyBtYXh3aWR0aCkge1xuXHRcdFx0XHRcdFx0XHRcdGxlZ2VuZFdpZHRoID0geHBvcyArIG1heHdpZHRoO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdHJldHVybiAndHJhbnNsYXRlKCcgKyB4cG9zICsgJywnICsgeXBvcyArICcpJztcblx0XHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0Ly9wb3NpdGlvbiBsZWdlbmQgYXMgZmFyIHJpZ2h0IGFzIHBvc3NpYmxlIHdpdGhpbiB0aGUgdG90YWwgd2lkdGhcblx0XHRcdFx0XHRnLmF0dHIoJ3RyYW5zZm9ybScsICd0cmFuc2xhdGUoJyArICh3aWR0aCAtIG1hcmdpbi5yaWdodCAtIG1heHdpZHRoKSArICcsJyArIG1hcmdpbi50b3AgKyAnKScpO1xuXG5cdFx0XHRcdFx0aGVpZ2h0ID0gbWFyZ2luLnRvcCArIG1hcmdpbi5ib3R0b20gKyB5cG9zICsgMTU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBTaXplIHJlY3RhbmdsZXMgYWZ0ZXIgdGV4dCBpcyBwbGFjZWRcblx0XHRcdFx0c2VyaWVzU2hhcGVcblx0XHRcdFx0XHQuYXR0cignd2lkdGgnLCBmdW5jdGlvbihkLGkpIHtcblx0XHRcdFx0XHRcdC8vcG9zaXRpb24gcmVtb3ZlIGJ0blxuXHRcdFx0XHRcdFx0dmFyIHdpZHRoID0gc2VyaWVzVGV4dFswXVtpXS5nZXRDb21wdXRlZFRleHRMZW5ndGgoKSArIDU7XG5cdFx0XHRcdFx0XHRkMy5zZWxlY3QoIHNlcmllc1JlbW92ZVswXVtpXSApLmF0dHIoICd0cmFuc2Zvcm0nLCAndHJhbnNsYXRlKCcgKyB3aWR0aCArICcsLTMpJyApO1xuXHRcdFx0XHRcdFx0cmV0dXJuIHdpZHRoKzI1O1xuXHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0LmF0dHIoJ2hlaWdodCcsIDI0KVxuXHRcdFx0XHRcdC5hdHRyKCd5JywgLTEyKVxuXHRcdFx0XHRcdC5hdHRyKCd4JywgLTEyKTtcblxuXHRcdFx0XHQvLyBUaGUgYmFja2dyb3VuZCBmb3IgdGhlIGV4cGFuZGVkIGxlZ2VuZCAoVUkpXG5cdFx0XHRcdGdFbnRlci5pbnNlcnQoJ3JlY3QnLCc6Zmlyc3QtY2hpbGQnKVxuXHRcdFx0XHRcdC5hdHRyKCdjbGFzcycsICdudi1sZWdlbmQtYmcnKVxuXHRcdFx0XHRcdC5hdHRyKCdmaWxsJywgJyNlZWUnKVxuXHRcdFx0XHRcdC8vIC5hdHRyKCdzdHJva2UnLCAnIzQ0NCcpXG5cdFx0XHRcdFx0LmF0dHIoJ29wYWNpdHknLDApO1xuXG5cdFx0XHRcdHZhciBzZXJpZXNCRyA9IGcuc2VsZWN0KCcubnYtbGVnZW5kLWJnJyk7XG5cblx0XHRcdFx0c2VyaWVzQkdcblx0XHRcdFx0LnRyYW5zaXRpb24oKS5kdXJhdGlvbigzMDApXG5cdFx0XHRcdFx0LmF0dHIoJ3gnLCAtdmVyc1BhZGRpbmcgKVxuXHRcdFx0XHRcdC5hdHRyKCd3aWR0aCcsIGxlZ2VuZFdpZHRoICsgdmVyc1BhZGRpbmcgLSAxMilcblx0XHRcdFx0XHQuYXR0cignaGVpZ2h0JywgaGVpZ2h0IClcblx0XHRcdFx0XHQuYXR0cigneScsIC1tYXJnaW4udG9wIC0gMTApXG5cdFx0XHRcdFx0LmF0dHIoJ29wYWNpdHknLCBleHBhbmRlZCA/IDEgOiAwKTtcblxuXHRcdFx0XHRzZXJpZXNTaGFwZVxuXHRcdFx0XHRcdC5zdHlsZSgnZmlsbCcsIHNldEJHQ29sb3IpXG5cdFx0XHRcdFx0LnN0eWxlKCdmaWxsLW9wYWNpdHknLCBzZXRCR09wYWNpdHkpXG5cdFx0XHRcdFx0LnN0eWxlKCdzdHJva2UnLCBzZXRCR0NvbG9yKTtcblxuXHRcdFx0XHQvL3Bvc2l0aW9uIGFkZCBidG5cblx0XHRcdFx0aWYoIHNlcmllcy5zaXplKCkgKSB7XG5cblx0XHRcdFx0XHR2YXIgc2VyaWVzQXJyID0gc2VyaWVzWzBdO1xuXHRcdFx0XHRcdGlmKCBzZXJpZXNBcnIgJiYgc2VyaWVzQXJyLmxlbmd0aCApIHtcblx0XHRcdFx0XHRcdC8vZmV0Y2ggbGFzdCBlbGVtZW50IHRvIGtub3cgaXRzIHdpZHRoXG5cdFx0XHRcdFx0XHR2YXIgbGFzdEVsID0gc2VyaWVzQXJyWyBzZXJpZXNBcnIubGVuZ3RoLTEgXSxcblx0XHRcdFx0XHRcdFx0Ly9uZWVkIHJlY3QgaW5zaWRlIGVsZW1lbnQgdGhhdCBoYXMgc2V0IHdpZHRoXG5cdFx0XHRcdFx0XHRcdGxhc3RSZWN0ID0gZDMuc2VsZWN0KCBsYXN0RWwgKS5zZWxlY3QoIFwicmVjdFwiICksXG5cdFx0XHRcdFx0XHRcdGxhc3RSZWN0V2lkdGggPSBsYXN0UmVjdC5hdHRyKCBcIndpZHRoXCIgKTtcblx0XHRcdFx0XHRcdC8vcG9zaXRpb24gYWRkIGJ0blxuXHRcdFx0XHRcdFx0dHJhbnNmb3JtWCA9ICt0cmFuc2Zvcm1YICsgcGFyc2VJbnQoIGxhc3RSZWN0V2lkdGgsIDEwICkgLSAzO1xuXHRcdFx0XHRcdFx0dHJhbnNmb3JtWCArPSBlbnRpdHlMYWJlbFdpZHRoO1xuXHRcdFx0XHRcdFx0Ly9jZW50ZXJpbmdcblx0XHRcdFx0XHRcdHRyYW5zZm9ybVkgPSArdHJhbnNmb3JtWSAtIDM7XG5cdFx0XHRcdFx0XHQvL2NoZWNrIGZvciByaWdodCBlZGdlXG5cdFx0XHRcdFx0XHR2YXIgYnV0dG9uV2lkdGggPSAxMjAsIGJ1dHRvbkhlaWdodCA9IDM1O1xuXHRcdFx0XHRcdFx0aWYoICggdHJhbnNmb3JtWCArIGJ1dHRvbldpZHRoICkgPiBhdmFpbGFibGVXaWR0aCApIHtcblx0XHRcdFx0XHRcdFx0Ly9tYWtlIHN1cmUgd2UgaGF2ZSBidXR0b25cblx0XHRcdFx0XHRcdFx0dmFyIGFkZEVudGl0eURpc3BsYXkgPSBhZGRFbnRpdHlCdG4uYXR0ciggXCJkaXNwbGF5XCIgKTtcblx0XHRcdFx0XHRcdFx0aWYoIGFkZEVudGl0eURpc3BsYXkgIT09IFwibm9uZVwiICkge1xuXHRcdFx0XHRcdFx0XHRcdHRyYW5zZm9ybVggPSAwOy8vYXZhaWxhYmxlV2lkdGggLSBidXR0b25XaWR0aDtcblx0XHRcdFx0XHRcdFx0XHR0cmFuc2Zvcm1ZICs9IGJ1dHRvbkhlaWdodDtcblx0XHRcdFx0XHRcdFx0XHQvL3VwZGF0ZSB3aG9sZSBjaGFydCBoZWlnaHQgYXMgd2VsbFxuXHRcdFx0XHRcdFx0XHRcdGhlaWdodCArPSBidXR0b25IZWlnaHQ7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5hdHRyKCBcInRyYW5zZm9ybVwiLCBcInRyYW5zbGF0ZSggXCIgKyB0cmFuc2Zvcm1YICsgXCIsIFwiICsgdHJhbnNmb3JtWSArIFwiKVwiICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XG5cdFx0XHRcdH1cblx0XHRcdFxuXHRcdFx0fSk7XG5cdFx0XHRcblx0XHRcdGZ1bmN0aW9uIHNldFRleHRDb2xvcihkLGkpIHtcblx0XHRcdFx0aWYodmVycyAhPSAnZnVyaW91cycgJiYgdmVycyAhPSAnb3dkJykgcmV0dXJuICcjMDAwJztcblx0XHRcdFx0aWYoZXhwYW5kZWQpIHtcblx0XHRcdFx0XHRyZXR1cm4gZC5kaXNlbmdhZ2VkID8gJyMwMDAnIDogJyNmZmYnO1xuXHRcdFx0XHR9IGVsc2UgaWYgKCFleHBhbmRlZCkge1xuXHRcdFx0XHRcdGlmKCFkLmNvbG9yKSBkLmNvbG9yID0gY29sb3IoZCxpKTtcblx0XHRcdFx0XHRyZXR1cm4gISFkLmRpc2FibGVkID8gJyM2NjYnIDogJyNmZmYnO1xuXHRcdFx0XHRcdC8vcmV0dXJuICEhZC5kaXNhYmxlZCA/IGQuY29sb3IgOiAnI2ZmZic7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0ZnVuY3Rpb24gc2V0QkdDb2xvcihkLGkpIHtcblx0XHRcdFx0aWYoZXhwYW5kZWQgJiYgKHZlcnMgPT0gJ2Z1cmlvdXMnIHx8IHZlcnMgPT0gJ293ZCcpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGQuZGlzZW5nYWdlZCA/ICcjZWVlJyA6IGQuY29sb3IgfHwgY29sb3IoZCxpKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXR1cm4gZC5jb2xvciB8fCBjb2xvcihkLGkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblxuXHRcdFx0ZnVuY3Rpb24gc2V0QkdPcGFjaXR5KGQsaSkge1xuXHRcdFx0XHRpZihleHBhbmRlZCAmJiAodmVycyA9PSAnZnVyaW91cycgfHwgdmVycyA9PSAnb3dkJykpIHtcblx0XHRcdFx0XHRyZXR1cm4gMTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXR1cm4gISFkLmRpc2FibGVkID8gMCA6IDE7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGNoYXJ0O1xuXHRcdH1cblxuXHRcdC8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cdFx0Ly8gRXhwb3NlIFB1YmxpYyBWYXJpYWJsZXNcblx0XHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5cdFx0Y2hhcnQuZGlzcGF0Y2ggPSBkaXNwYXRjaDtcblx0XHRjaGFydC5vcHRpb25zID0gbnYudXRpbHMub3B0aW9uc0Z1bmMuYmluZChjaGFydCk7XG5cblx0XHRjaGFydC5fb3B0aW9ucyA9IE9iamVjdC5jcmVhdGUoe30sIHtcblx0XHRcdC8vIHNpbXBsZSBvcHRpb25zLCBqdXN0IGdldC9zZXQgdGhlIG5lY2Vzc2FyeSB2YWx1ZXNcblx0XHRcdHdpZHRoOiAgICAgIHtnZXQ6IGZ1bmN0aW9uKCl7cmV0dXJuIHdpZHRoO30sIHNldDogZnVuY3Rpb24oXyl7d2lkdGg9Xzt9fSxcblx0XHRcdGhlaWdodDogICAgIHtnZXQ6IGZ1bmN0aW9uKCl7cmV0dXJuIGhlaWdodDt9LCBzZXQ6IGZ1bmN0aW9uKF8pe2hlaWdodD1fO319LFxuXHRcdFx0a2V5OiAgICAgICAge2dldDogZnVuY3Rpb24oKXtyZXR1cm4gZ2V0S2V5O30sIHNldDogZnVuY3Rpb24oXyl7Z2V0S2V5PV87fX0sXG5cdFx0XHRhbGlnbjogICAgICB7Z2V0OiBmdW5jdGlvbigpe3JldHVybiBhbGlnbjt9LCBzZXQ6IGZ1bmN0aW9uKF8pe2FsaWduPV87fX0sXG5cdFx0XHRyaWdodEFsaWduOiAgICB7Z2V0OiBmdW5jdGlvbigpe3JldHVybiByaWdodEFsaWduO30sIHNldDogZnVuY3Rpb24oXyl7cmlnaHRBbGlnbj1fO319LFxuXHRcdFx0cGFkZGluZzogICAgICAge2dldDogZnVuY3Rpb24oKXtyZXR1cm4gcGFkZGluZzt9LCBzZXQ6IGZ1bmN0aW9uKF8pe3BhZGRpbmc9Xzt9fSxcblx0XHRcdHVwZGF0ZVN0YXRlOiAgIHtnZXQ6IGZ1bmN0aW9uKCl7cmV0dXJuIHVwZGF0ZVN0YXRlO30sIHNldDogZnVuY3Rpb24oXyl7dXBkYXRlU3RhdGU9Xzt9fSxcblx0XHRcdHJhZGlvQnV0dG9uTW9kZTogICAge2dldDogZnVuY3Rpb24oKXtyZXR1cm4gcmFkaW9CdXR0b25Nb2RlO30sIHNldDogZnVuY3Rpb24oXyl7cmFkaW9CdXR0b25Nb2RlPV87fX0sXG5cdFx0XHRleHBhbmRlZDogICB7Z2V0OiBmdW5jdGlvbigpe3JldHVybiBleHBhbmRlZDt9LCBzZXQ6IGZ1bmN0aW9uKF8pe2V4cGFuZGVkPV87fX0sXG5cdFx0XHR2ZXJzOiAgIHtnZXQ6IGZ1bmN0aW9uKCl7cmV0dXJuIHZlcnM7fSwgc2V0OiBmdW5jdGlvbihfKXt2ZXJzPV87fX0sXG5cblx0XHRcdC8vIG9wdGlvbnMgdGhhdCByZXF1aXJlIGV4dHJhIGxvZ2ljIGluIHRoZSBzZXR0ZXJcblx0XHRcdG1hcmdpbjoge2dldDogZnVuY3Rpb24oKXtyZXR1cm4gbWFyZ2luO30sIHNldDogZnVuY3Rpb24oXyl7XG5cdFx0XHRcdG1hcmdpbi50b3AgICAgPSBfLnRvcCAgICAhPT0gdW5kZWZpbmVkID8gXy50b3AgICAgOiBtYXJnaW4udG9wO1xuXHRcdFx0XHRtYXJnaW4ucmlnaHQgID0gXy5yaWdodCAgIT09IHVuZGVmaW5lZCA/IF8ucmlnaHQgIDogbWFyZ2luLnJpZ2h0O1xuXHRcdFx0XHRtYXJnaW4uYm90dG9tID0gXy5ib3R0b20gIT09IHVuZGVmaW5lZCA/IF8uYm90dG9tIDogbWFyZ2luLmJvdHRvbTtcblx0XHRcdFx0bWFyZ2luLmxlZnQgICA9IF8ubGVmdCAgICE9PSB1bmRlZmluZWQgPyBfLmxlZnQgICA6IG1hcmdpbi5sZWZ0O1xuXHRcdFx0fX0sXG5cdFx0XHRjb2xvcjogIHtnZXQ6IGZ1bmN0aW9uKCl7cmV0dXJuIGNvbG9yO30sIHNldDogZnVuY3Rpb24oXyl7XG5cdFx0XHRcdGNvbG9yID0gbnYudXRpbHMuZ2V0Q29sb3IoXyk7XG5cdFx0XHR9fVxuXHRcdH0pO1xuXG5cdFx0bnYudXRpbHMuaW5pdE9wdGlvbnMoY2hhcnQpO1xuXG5cdFx0cmV0dXJuIGNoYXJ0O1xuXHR9O1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkNoYXJ0LkxlZ2VuZDtcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBNYXBDb250cm9scyA9IHJlcXVpcmUoIFwiLi9tYXAvQXBwLlZpZXdzLkNoYXJ0Lk1hcC5NYXBDb250cm9scy5qc1wiICk7XG5cblx0QXBwLlZpZXdzLkNoYXJ0Lk1hcFRhYiA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblxuXHRcdCR0YWI6IG51bGwsXG5cdFx0ZGF0YU1hcDogbnVsbCxcblx0XHRtYXBDb250cm9sczogbnVsbCxcblx0XHRsZWdlbmQ6IG51bGwsXG5cblx0XHRldmVudHM6IHt9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHRcblx0XHRcdHRoaXMuZGlzcGF0Y2hlciA9IG9wdGlvbnMuZGlzcGF0Y2hlcjtcblx0XHRcdHRoaXMubWFwQ29udHJvbHMgPSBuZXcgTWFwQ29udHJvbHMoIHsgZGlzcGF0Y2hlcjogb3B0aW9ucy5kaXNwYXRjaGVyIH0gKTtcblxuXHRcdFx0Ly9pbml0IG1hcCBvbmx5IGlmIHRoZSBtYXAgdGFiIGRpc3BsYXllZFxuXHRcdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdFx0JCggXCJbZGF0YS10b2dnbGU9J3RhYiddW2hyZWY9JyNtYXAtY2hhcnQtdGFiJ11cIiApLm9uKCBcInNob3duLmJzLnRhYlwiLCBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0XHR0aGF0LmRpc3BsYXkoKTtcblx0XHRcdH0gKTtcblx0XHRcdFxuXHRcdH0sXG5cblx0XHRkaXNwbGF5OiBmdW5jdGlvbigpIHtcblx0XHRcdC8vcmVuZGVyIG9ubHkgaWYgbm8gbWFwIHlldFxuXHRcdFx0aWYoICF0aGlzLmRhdGFNYXAgKSB7XG5cdFx0XHRcdHRoaXMucmVuZGVyKCk7XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cblx0XHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRcdC8vZmV0Y2ggY3JlYXRlZCBkb21cblx0XHRcdHRoaXMuJHRhYiA9ICQoIFwiI21hcC1jaGFydC10YWJcIiApO1xuXG5cdFx0XHR2YXIgbWFwQ29uZmlnID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcIm1hcC1jb25maWdcIiApLFxuXHRcdFx0XHRkZWZhdWx0UHJvamVjdGlvbiA9IHRoaXMuZ2V0UHJvamVjdGlvbiggbWFwQ29uZmlnLnByb2plY3Rpb24gKTtcblx0XHRcdFxuXHRcdFx0dGhpcy5kYXRhTWFwID0gbmV3IERhdGFtYXAoIHtcblx0XHRcdFx0d2lkdGg6IHRoYXQuJHRhYi53aWR0aCgpLFxuXHRcdFx0XHRoZWlnaHQ6IHRoYXQuJHRhYi5oZWlnaHQoKSxcblx0XHRcdFx0cmVzcG9uc2l2ZTogdHJ1ZSxcblx0XHRcdFx0ZWxlbWVudDogZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIFwibWFwLWNoYXJ0LXRhYlwiICksXG5cdFx0XHRcdGdlb2dyYXBoeUNvbmZpZzoge1xuXHRcdFx0XHRcdGRhdGFVcmw6IEdsb2JhbC5yb290VXJsICsgXCIvanMvZGF0YS93b3JsZC5pZHMuanNvblwiLFxuXHRcdFx0XHRcdGJvcmRlcldpZHRoOiAwLjEsXG5cdFx0XHRcdFx0Ym9yZGVyQ29sb3I6ICcjNEY0RjRGJyxcblx0XHRcdFx0XHRoaWdobGlnaHRCb3JkZXJDb2xvcjogJ2JsYWNrJyxcblx0XHRcdFx0XHRoaWdobGlnaHRCb3JkZXJXaWR0aDogMC4yLFxuXHRcdFx0XHRcdGhpZ2hsaWdodEZpbGxDb2xvcjogJyNGRkVDMzgnLFxuXHRcdFx0XHRcdHBvcHVwVGVtcGxhdGU6IHRoYXQucG9wdXBUZW1wbGF0ZUdlbmVyYXRvclxuXHRcdFx0XHR9LFxuXHRcdFx0XHRmaWxsczoge1xuXHRcdFx0XHRcdGRlZmF1bHRGaWxsOiAnI0ZGRkZGRidcblx0XHRcdFx0XHQvL2RlZmF1bHRGaWxsOiAnI0RERERERCdcblx0XHRcdFx0fSxcblx0XHRcdFx0c2V0UHJvamVjdGlvbjogZGVmYXVsdFByb2plY3Rpb24sXG5cdFx0XHRcdC8vd2FpdCBmb3IganNvbiB0byBsb2FkIGJlZm9yZSBsb2FkaW5nIG1hcCBkYXRhXG5cdFx0XHRcdGRvbmU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdHRoYXQubWFwRGF0YU1vZGVsID0gbmV3IEFwcC5Nb2RlbHMuQ2hhcnREYXRhTW9kZWwoKTtcblx0XHRcdFx0XHR0aGF0Lm1hcERhdGFNb2RlbC5vbiggXCJzeW5jXCIsIGZ1bmN0aW9uKCBtb2RlbCwgcmVzcG9uc2UgKSB7XG5cdFx0XHRcdFx0XHRpZiggcmVzcG9uc2UuZGF0YSApIHtcblx0XHRcdFx0XHRcdFx0dGhhdC5kaXNwbGF5RGF0YSggcmVzcG9uc2UuZGF0YSApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHR0aGF0Lm1hcERhdGFNb2RlbC5vbiggXCJlcnJvclwiLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoIFwiRXJyb3IgbG9hZGluZyBtYXAgZGF0YS5cIiApO1xuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHR0aGF0LnVwZGF0ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cblx0XHRcdHRoaXMubGVnZW5kID0gbmV3IEFwcC5WaWV3cy5DaGFydC5NYXAuTGVnZW5kKCk7XG5cdFx0XHRcblx0XHRcdEFwcC5DaGFydE1vZGVsLm9uKCBcImNoYW5nZVwiLCB0aGlzLm9uQ2hhcnRNb2RlbENoYW5nZSwgdGhpcyApO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwub24oIFwiY2hhbmdlLW1hcFwiLCB0aGlzLm9uQ2hhcnRNb2RlbENoYW5nZSwgdGhpcyApO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwub24oIFwicmVzaXplXCIsIHRoaXMub25DaGFydE1vZGVsUmVzaXplLCB0aGlzICk7XG5cdFx0XHRcblx0XHRcdG52LnV0aWxzLndpbmRvd1Jlc2l6ZSggJC5wcm94eSggdGhpcy5vblJlc2l6ZSwgdGhpcyApICk7XG5cdFx0XHR0aGlzLm9uUmVzaXplKCk7XG5cblx0XHR9LFxuXG5cdFx0b25DaGFydE1vZGVsQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHR0aGlzLnVwZGF0ZSgpO1xuXG5cdFx0fSxcblxuXHRcdHBvcHVwVGVtcGxhdGVHZW5lcmF0b3I6IGZ1bmN0aW9uKCBnZW8sIGRhdGEgKSB7XG5cdFx0XHQvL3RyYW5zZm9ybSBkYXRhbWFwcyBkYXRhIGludG8gZm9ybWF0IGNsb3NlIHRvIG52ZDMgc28gdGhhdCB3ZSBjYW4gcmV1c2UgdGhlIHNhbWUgcG9wdXAgZ2VuZXJhdG9yXG5cdFx0XHR2YXIgbWFwQ29uZmlnID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcIm1hcC1jb25maWdcIiApO1xuXHRcdFx0dmFyIHByb3BlcnR5TmFtZSA9IEFwcC5VdGlscy5nZXRQcm9wZXJ0eUJ5VmFyaWFibGVJZCggQXBwLkNoYXJ0TW9kZWwsIG1hcENvbmZpZy52YXJpYWJsZUlkICk7XG5cdFx0XHRpZiggIXByb3BlcnR5TmFtZSApIHtcblx0XHRcdFx0cHJvcGVydHlOYW1lID0gXCJ5XCI7XG5cdFx0XHR9XG5cdFx0XHR2YXIgb2JqID0ge1xuXHRcdFx0XHRwb2ludDoge1xuXHRcdFx0XHRcdHRpbWU6IG1hcENvbmZpZy50YXJnZXRZZWFyIH0sXG5cdFx0XHRcdHNlcmllczogWyB7XG5cdFx0XHRcdFx0a2V5OiBnZW8ucHJvcGVydGllcy5uYW1lXG5cdFx0XHRcdH0gXVxuXHRcdFx0fTtcblx0XHRcdG9iai5wb2ludFsgcHJvcGVydHlOYW1lIF0gPSBkYXRhLnZhbHVlO1xuXHRcdFx0cmV0dXJuIFsgXCI8ZGl2IGNsYXNzPSdob3ZlcmluZm8gbnZ0b29sdGlwJz5cIiArIEFwcC5VdGlscy5jb250ZW50R2VuZXJhdG9yKCBvYmosIHRydWUgKSArIFwiPC9kaXY+XCIgXTtcblx0XHR9LFxuXG5cdFx0dXBkYXRlOiBmdW5jdGlvbigpIHtcblx0XHRcdFxuXHRcdFx0Ly9jb25zdHJ1Y3QgZGltZW5zaW9uIHN0cmluZ1xuXHRcdFx0dmFyIHRoYXQgPSB0aGlzLFxuXHRcdFx0XHRtYXBDb25maWcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwibWFwLWNvbmZpZ1wiICksXG5cdFx0XHRcdGNoYXJ0VGltZSA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10aW1lXCIgKSxcblx0XHRcdFx0dmFyaWFibGVJZCA9IG1hcENvbmZpZy52YXJpYWJsZUlkLFxuXHRcdFx0XHR0YXJnZXRZZWFyID0gbWFwQ29uZmlnLnRhcmdldFllYXIsXG5cdFx0XHRcdG1vZGUgPSBtYXBDb25maWcubW9kZSxcblx0XHRcdFx0dG9sZXJhbmNlID0gbWFwQ29uZmlnLnRpbWVUb2xlcmFuY2UsXG5cdFx0XHRcdGRpbWVuc2lvbnMgPSBbeyBuYW1lOiBcIk1hcFwiLCBwcm9wZXJ0eTogXCJtYXBcIiwgdmFyaWFibGVJZDogdmFyaWFibGVJZCwgdGFyZ2V0WWVhcjogdGFyZ2V0WWVhciwgbW9kZTogbW9kZSwgdG9sZXJhbmNlOiB0b2xlcmFuY2UgfV0sXG5cdFx0XHRcdGRpbWVuc2lvbnNTdHJpbmcgPSBKU09OLnN0cmluZ2lmeSggZGltZW5zaW9ucyApLFxuXHRcdFx0XHRjaGFydFR5cGUgPSA5OTk5LFxuXHRcdFx0XHRzZWxlY3RlZENvdW50cmllcyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiApLFxuXHRcdFx0XHRzZWxlY3RlZENvdW50cmllc0lkcyA9IF8ubWFwKCBzZWxlY3RlZENvdW50cmllcywgZnVuY3Rpb24oIHYgKSB7IHJldHVybiAodik/ICt2LmlkOiBcIlwiOyB9ICk7XG5cdFx0XHRcblx0XHRcdHZhciBkYXRhUHJvcHMgPSB7IFwiZGltZW5zaW9uc1wiOiBkaW1lbnNpb25zU3RyaW5nLCBcImNoYXJ0SWRcIjogQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImlkXCIgKSwgXCJjaGFydFR5cGVcIjogY2hhcnRUeXBlLCBcInNlbGVjdGVkQ291bnRyaWVzXCI6IHNlbGVjdGVkQ291bnRyaWVzSWRzLCBcImNoYXJ0VGltZVwiOiBjaGFydFRpbWUsIFwiY2FjaGVcIjogQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNhY2hlXCIgKSwgXCJncm91cEJ5VmFyaWFibGVzXCI6IEFwcC5DaGFydE1vZGVsLmdldCggXCJncm91cC1ieS12YXJpYWJsZXNcIiApICB9O1xuXHRcdFx0dGhpcy5tYXBEYXRhTW9kZWwuZmV0Y2goIHsgZGF0YTogZGF0YVByb3BzIH0gKTtcblxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdGRpc3BsYXlEYXRhOiBmdW5jdGlvbiggZGF0YSApIHtcblx0XHRcdFxuXHRcdFx0dmFyIHRoYXQgPSB0aGlzLFxuXHRcdFx0XHRtYXBDb25maWcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwibWFwLWNvbmZpZ1wiICksXG5cdFx0XHRcdGRhdGFNaW4gPSBJbmZpbml0eSxcblx0XHRcdFx0ZGF0YU1heCA9IC1JbmZpbml0eTtcblxuXHRcdFx0Ly9uZWVkIHRvIGV4dHJhY3QgbGF0ZXN0IHRpbWVcblx0XHRcdHZhciBsYXRlc3REYXRhID0gZGF0YS5tYXAoIGZ1bmN0aW9uKCBkLCBpICkge1xuXG5cdFx0XHRcdHZhciB2YWx1ZXMgPSBkLnZhbHVlcyxcblx0XHRcdFx0XHRsYXRlc3RUaW1lVmFsdWUgPSAoIHZhbHVlcyAmJiB2YWx1ZXMubGVuZ3RoICk/IHZhbHVlc1sgdmFsdWVzLmxlbmd0aCAtIDFdOiAwO1xuXG5cdFx0XHRcdC8vYWxzbyBnZXQgbWluIG1heCB2YWx1ZXMsIGNvdWxkIHVzZSBkMy5taW4sIGQzLm1heCBvbmNlIHdlIGhhdmUgYWxsIHZhbHVlcywgYnV0IHRoaXMgcHJvYmFibHkgc2F2ZXMgc29tZSB0aW1lXG5cdFx0XHRcdGRhdGFNaW4gPSBNYXRoLm1pbiggZGF0YU1pbiwgbGF0ZXN0VGltZVZhbHVlICk7XG5cdFx0XHRcdGRhdGFNYXggPSBNYXRoLm1heCggZGF0YU1heCwgbGF0ZXN0VGltZVZhbHVlICk7XG5cblx0XHRcdFx0Ly9pZHMgaW4gd29ybGQganNvbiBhcmUgbmFtZSBjb3VudHJpZXMgd2l0aCB1bmRlcnNjb3JlIChkYXRhbWFwcy5qcyB1c2VzIGlkIGZvciBzZWxlY3Rvciwgc28gY2Fubm90IGhhdmUgd2hpdGVzcGFjZSlcblx0XHRcdFx0cmV0dXJuIHsgXCJrZXlcIjogZC5rZXkucmVwbGFjZSggXCIgXCIsIFwiX1wiICksIFwidmFsdWVcIjogbGF0ZXN0VGltZVZhbHVlIH07XG5cblx0XHRcdH0gKTtcblxuXHRcdFx0dmFyIGNvbG9yU2NoZW1lID0gKCBjb2xvcmJyZXdlclsgbWFwQ29uZmlnLmNvbG9yU2NoZW1lTmFtZSBdICYmIGNvbG9yYnJld2VyWyBtYXBDb25maWcuY29sb3JTY2hlbWVOYW1lIF1bIG1hcENvbmZpZy5jb2xvclNjaGVtZUludGVydmFsIF0gKT8gY29sb3JicmV3ZXJbIG1hcENvbmZpZy5jb2xvclNjaGVtZU5hbWUgXVsgbWFwQ29uZmlnLmNvbG9yU2NoZW1lSW50ZXJ2YWwgXTogW107XG5cdFx0XHRcblx0XHRcdC8vbmVlZCB0byBjcmVhdGUgY29sb3Igc2NoZW1lXG5cdFx0XHR2YXIgY29sb3JTY2FsZSA9IGQzLnNjYWxlLnF1YW50aXplKClcblx0XHRcdFx0LmRvbWFpbiggWyBkYXRhTWluLCBkYXRhTWF4IF0gKVxuXHRcdFx0XHQucmFuZ2UoIGNvbG9yU2NoZW1lICk7XG5cblx0XHRcdC8vbmVlZCB0byBlbmNvZGUgY29sb3JzIHByb3BlcnRpZXNcblx0XHRcdHZhciBtYXBEYXRhID0ge30sXG5cdFx0XHRcdGNvbG9ycyA9IFtdO1xuXHRcdFx0bGF0ZXN0RGF0YS5mb3JFYWNoKCBmdW5jdGlvbiggZCwgaSApIHtcblx0XHRcdFx0dmFyIGNvbG9yID0gY29sb3JTY2FsZSggZC52YWx1ZSApO1xuXHRcdFx0XHRtYXBEYXRhWyBkLmtleSBdID0geyBcImtleVwiOiBkLmtleSwgXCJ2YWx1ZVwiOiBkLnZhbHVlLCBcImNvbG9yXCI6IGNvbG9yIH07XG5cdFx0XHRcdGNvbG9ycy5wdXNoKCBjb2xvciApO1xuXHRcdFx0fSApO1xuXG5cdFx0XHR0aGlzLmxlZ2VuZC5zY2FsZSggY29sb3JTY2FsZSApO1xuXHRcdFx0aWYoIGQzLnNlbGVjdCggXCIubGVnZW5kLXdyYXBwZXJcIiApLmVtcHR5KCkgKSB7XG5cdFx0XHRcdGQzLnNlbGVjdCggXCIuZGF0YW1hcFwiICkuYXBwZW5kKCBcImdcIiApLmF0dHIoIFwiY2xhc3NcIiwgXCJsZWdlbmQtd3JhcHBlclwiICk7XG5cdFx0XHR9XG5cdFx0XHRkMy5zZWxlY3QoIFwiLmxlZ2VuZC13cmFwcGVyXCIgKS5kYXR1bSggY29sb3JTY2hlbWUgKS5jYWxsKCB0aGlzLmxlZ2VuZCApO1xuXHRcdFx0Ly9kMy5zZWxlY3QoIFwiLmRhdGFtYXBcIiApLmRhdHVtKCBjb2xvclNjaGVtZSApLmNhbGwoIHRoaXMubGVnZW5kICk7XG5cblx0XHRcdC8vdXBkYXRlIG1hcFxuXHRcdFx0Ly9hcmUgd2UgY2hhbmdpbmcgcHJvamVjdGlvbnM/XG5cdFx0XHR2YXIgb2xkUHJvamVjdGlvbiA9IHRoaXMuZGF0YU1hcC5vcHRpb25zLnNldFByb2plY3Rpb24sXG5cdFx0XHRcdG5ld1Byb2plY3Rpb24gPSB0aGlzLmdldFByb2plY3Rpb24oIG1hcENvbmZpZy5wcm9qZWN0aW9uICk7XG5cdFx0XHRpZiggb2xkUHJvamVjdGlvbiA9PT0gbmV3UHJvamVjdGlvbiApIHtcblx0XHRcdFx0Ly9wcm9qZWN0aW9uIHN0YXlzIHRoZSBzYW1lLCBubyBuZWVkIHRvIHJlZHJhdyB1bml0c1xuXHRcdFx0XHQvL25lZWQgdG8gc2V0IGFsbCB1bml0cyB0byBkZWZhdWx0IGNvbG9yIGZpcnN0LCBjYXVzZSB1cGRhdGVDaG9wbGV0aCBqdXN0IHVwZGF0ZXMgbmV3IGRhdGEgbGVhdmVzIHRoZSBvbGQgZGF0YSBmb3IgdW5pdHMgbm8gbG9uZ2VyIGluIGRhdGFzZXRcblx0XHRcdFx0ZDMuc2VsZWN0QWxsKCBcInBhdGguZGF0YW1hcHMtc3VidW5pdFwiICkuc3R5bGUoIFwiZmlsbFwiLCB0aGlzLmRhdGFNYXAub3B0aW9ucy5maWxscy5kZWZhdWx0RmlsbCApO1xuXHRcdFx0XHR0aGlzLmRhdGFNYXAudXBkYXRlQ2hvcm9wbGV0aCggbWFwRGF0YSApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly9jaGFuZ2luZyBwcm9qZWN0aW9uLCBuZWVkIHRvIHJlbW92ZSBleGlzdGluZyB1bml0cywgcmVkcmF3IGV2ZXJ5dGhpbmcgYW5kIGFmdGVyIGRvbmUgZHJhd2luZywgdXBkYXRlIGRhdGFcblx0XHRcdFx0ZDMuc2VsZWN0QWxsKCdwYXRoLmRhdGFtYXBzLXN1YnVuaXQnKS5yZW1vdmUoKTtcblx0XHRcdFx0dGhpcy5kYXRhTWFwLm9wdGlvbnMuc2V0UHJvamVjdGlvbiA9IG5ld1Byb2plY3Rpb247XG5cdFx0XHRcdHRoaXMuZGF0YU1hcC5kcmF3KCk7XG5cdFx0XHRcdHRoaXMuZGF0YU1hcC5vcHRpb25zLmRvbmUgPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHR0aGF0LmRhdGFNYXAudXBkYXRlQ2hvcm9wbGV0aCggbWFwRGF0YSApO1xuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0fSxcblxuXHRcdGdldFByb2plY3Rpb246IGZ1bmN0aW9uKCBwcm9qZWN0aW9uTmFtZSApIHtcblxuXHRcdFx0dmFyIHByb2plY3Rpb25zID0gQXBwLlZpZXdzLkNoYXJ0Lk1hcFRhYi5wcm9qZWN0aW9ucyxcblx0XHRcdFx0bmV3UHJvamVjdGlvbiA9ICggcHJvamVjdGlvbnNbIHByb2plY3Rpb25OYW1lIF0gKT8gcHJvamVjdGlvbnNbIHByb2plY3Rpb25OYW1lIF06IHByb2plY3Rpb25zLldvcmxkO1xuXHRcdFx0cmV0dXJuIG5ld1Byb2plY3Rpb247XG5cdFx0XHRcblx0XHR9LFxuXG5cdFx0b25SZXNpemU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYoIHRoaXMuZGF0YU1hcCApIHtcblx0XHRcdFx0Ly9pbnN0ZWFkIG9mIGNhbGxpbmcgZGF0YW1hcHMgcmVzaXplLCB0aGVyZSdzIG1vZGlmaWVkIHZlcnNpb24gb2YgdGhlIHNhbWUgbWV0aG9kXG5cdFx0XHRcdHZhciBvcHRpb25zID0gdGhpcy5kYXRhTWFwLm9wdGlvbnMsXG5cdFx0XHRcdFx0cHJlZml4ID0gJy13ZWJraXQtdHJhbnNmb3JtJyBpbiBkb2N1bWVudC5ib2R5LnN0eWxlID8gJy13ZWJraXQtJyA6ICctbW96LXRyYW5zZm9ybScgaW4gZG9jdW1lbnQuYm9keS5zdHlsZSA/ICctbW96LScgOiAnLW1zLXRyYW5zZm9ybScgaW4gZG9jdW1lbnQuYm9keS5zdHlsZSA/ICctbXMtJyA6ICcnLFxuXHRcdFx0XHRcdG5ld3NpemUgPSBvcHRpb25zLmVsZW1lbnQuY2xpZW50V2lkdGgsXG5cdFx0XHRcdFx0b2xkc2l6ZSA9IGQzLnNlbGVjdCggb3B0aW9ucy5lbGVtZW50KS5zZWxlY3QoJ3N2ZycpLmF0dHIoJ2RhdGEtd2lkdGgnKTtcblx0XHRcdFx0XHQvL2RpZmZlcmVudCBzZWxlY3RvciBmcm9tIGRlZmF1bHQgZGF0YW1hcHMgaW1wbGVtZW50YXRpb24sIGRvZXNuJ3Qgc2NhbGUgbGVnZW5kXG5cdFx0XHRcdFx0ZDMuc2VsZWN0KG9wdGlvbnMuZWxlbWVudCkuc2VsZWN0KCdzdmcnKS5zZWxlY3RBbGwoJ2c6bm90KC5sZWdlbmQtc3RlcCk6bm90KC5sZWdlbmQpJykuc3R5bGUocHJlZml4ICsgJ3RyYW5zZm9ybScsICdzY2FsZSgnICsgKG5ld3NpemUgLyBvbGRzaXplKSArICcpJyk7XG5cdFx0XHRcdC8vdGhpcy5kYXRhTWFwLnJlc2l6ZSgpO1xuXHRcdFx0fVxuXHRcdH0sXG5cblx0XHRvbkNoYXJ0TW9kZWxSZXNpemU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5vblJlc2l6ZSgpO1xuXHRcdH1cblxuXHR9KTtcblxuXHRBcHAuVmlld3MuQ2hhcnQuTWFwVGFiLnByb2plY3Rpb25zID0ge1xuXHRcdFxuXHRcdFwiV29ybGRcIjogZnVuY3Rpb24oZWxlbWVudCkge1xuXHRcdFx0Ly9lbXBpcmljXG5cdFx0XHR2YXIgayA9IDY7XG5cdFx0XHR2YXIgcHJvamVjdGlvbiA9IGQzLmdlby5lY2tlcnQzKClcblx0XHRcdFx0LnNjYWxlKGVsZW1lbnQub2Zmc2V0V2lkdGgvaylcblx0XHRcdFx0LnRyYW5zbGF0ZShbZWxlbWVudC5vZmZzZXRXaWR0aCAvIDIsIGVsZW1lbnQub2Zmc2V0SGVpZ2h0IC8gMl0pXG5cdFx0XHRcdC5wcmVjaXNpb24oLjEpO1xuXHRcdFx0dmFyIHBhdGggPSBkMy5nZW8ucGF0aCgpLnByb2plY3Rpb24ocHJvamVjdGlvbik7XG5cdFx0XHRyZXR1cm4ge3BhdGg6IHBhdGgsIHByb2plY3Rpb246IHByb2plY3Rpb259O1xuXHRcdH0sXG5cdFx0LypcIldvcmxkXCI6IGZ1bmN0aW9uKGVsZW1lbnQpIHtcblx0XHRcdHZhciBwcm9qZWN0aW9uID0gZDMuZ2VvLmVxdWlyZWN0YW5ndWxhcigpXG5cdFx0XHRcdC5zY2FsZSgoZWxlbWVudC5vZmZzZXRXaWR0aCArIDEpIC8gMiAvIE1hdGguUEkpXG5cdFx0XHRcdC50cmFuc2xhdGUoW2VsZW1lbnQub2Zmc2V0V2lkdGggLyAyLCBlbGVtZW50Lm9mZnNldEhlaWdodCAvIDEuOF0pO1xuXHRcdFx0dmFyIHBhdGggPSBkMy5nZW8ucGF0aCgpLnByb2plY3Rpb24ocHJvamVjdGlvbik7XG5cdFx0XHRyZXR1cm4ge3BhdGg6IHBhdGgsIHByb2plY3Rpb246IHByb2plY3Rpb259O1xuXHRcdH0sKi9cblx0XHRcIkFmcmljYVwiOiBmdW5jdGlvbihlbGVtZW50KSB7XG5cdFx0XHQvL2VtcGlyaWNcblx0XHRcdHZhciBrID0gMztcblx0XHRcdHZhciBwcm9qZWN0aW9uID0gZDMuZ2VvLmNvbmljQ29uZm9ybWFsKClcblx0XHRcdFx0LnJvdGF0ZShbLTI1LCAwXSlcblx0XHRcdFx0LmNlbnRlcihbMCwgMF0pXG5cdFx0XHRcdC5wYXJhbGxlbHMoWzMwLCAtMjBdKVxuXHRcdFx0XHQuc2NhbGUoZWxlbWVudC5vZmZzZXRXaWR0aC9rKVxuXHRcdFx0XHQudHJhbnNsYXRlKFtlbGVtZW50Lm9mZnNldFdpZHRoIC8gMiwgZWxlbWVudC5vZmZzZXRIZWlnaHQgLyAyXSk7XG5cdFx0XHR2YXIgcGF0aCA9IGQzLmdlby5wYXRoKCkucHJvamVjdGlvbihwcm9qZWN0aW9uKTtcblx0XHRcdHJldHVybiB7cGF0aDogcGF0aCwgcHJvamVjdGlvbjogcHJvamVjdGlvbn07XG5cdFx0fSxcblx0XHRcIk4uQW1lcmljYVwiOiBmdW5jdGlvbihlbGVtZW50KSB7XG5cdFx0XHQvL2VtcGlyaWNcblx0XHRcdHZhciBrID0gMztcblx0XHRcdHZhciBwcm9qZWN0aW9uID0gZDMuZ2VvLmNvbmljQ29uZm9ybWFsKClcblx0XHRcdFx0LnJvdGF0ZShbOTgsIDBdKVxuXHRcdFx0XHQuY2VudGVyKFswLCAzOF0pXG5cdFx0XHRcdC5wYXJhbGxlbHMoWzI5LjUsIDQ1LjVdKVxuXHRcdFx0XHQuc2NhbGUoZWxlbWVudC5vZmZzZXRXaWR0aC9rKVxuXHRcdFx0XHQudHJhbnNsYXRlKFtlbGVtZW50Lm9mZnNldFdpZHRoIC8gMiwgZWxlbWVudC5vZmZzZXRIZWlnaHQgLyAyXSk7XG5cdFx0XHR2YXIgcGF0aCA9IGQzLmdlby5wYXRoKCkucHJvamVjdGlvbihwcm9qZWN0aW9uKTtcblx0XHRcdHJldHVybiB7cGF0aDogcGF0aCwgcHJvamVjdGlvbjogcHJvamVjdGlvbn07XG5cdFx0fSxcblx0XHRcIlMuQW1lcmljYVwiOiBmdW5jdGlvbihlbGVtZW50KSB7XG5cdFx0XHQvL2VtcGlyaWNcblx0XHRcdHZhciBrID0gMy40O1xuXHRcdFx0dmFyIHByb2plY3Rpb24gPSBkMy5nZW8uY29uaWNDb25mb3JtYWwoKVxuXHRcdFx0XHQucm90YXRlKFs2OCwgMF0pXG5cdFx0XHRcdC5jZW50ZXIoWzAsIC0xNF0pXG5cdFx0XHRcdC5wYXJhbGxlbHMoWzEwLCAtMzBdKVxuXHRcdFx0XHQuc2NhbGUoZWxlbWVudC5vZmZzZXRXaWR0aC9rKVxuXHRcdFx0XHQudHJhbnNsYXRlKFtlbGVtZW50Lm9mZnNldFdpZHRoIC8gMiwgZWxlbWVudC5vZmZzZXRIZWlnaHQgLyAyXSk7XG5cdFx0XHR2YXIgcGF0aCA9IGQzLmdlby5wYXRoKCkucHJvamVjdGlvbihwcm9qZWN0aW9uKTtcblx0XHRcdHJldHVybiB7cGF0aDogcGF0aCwgcHJvamVjdGlvbjogcHJvamVjdGlvbn07XG5cdFx0fSxcblx0XHRcIkFzaWFcIjogZnVuY3Rpb24oZWxlbWVudCkge1xuXHRcdFx0Ly9lbXBpcmljXG5cdFx0XHR2YXIgayA9IDM7XG5cdFx0XHR2YXIgcHJvamVjdGlvbiA9IGQzLmdlby5jb25pY0NvbmZvcm1hbCgpXG5cdFx0XHRcdC5yb3RhdGUoWy0xMDUsIDBdKVxuXHRcdFx0XHQuY2VudGVyKFswLCAzN10pXG5cdFx0XHRcdC5wYXJhbGxlbHMoWzEwLCA2MF0pXG5cdFx0XHRcdC5zY2FsZShlbGVtZW50Lm9mZnNldFdpZHRoL2spXG5cdFx0XHRcdC50cmFuc2xhdGUoW2VsZW1lbnQub2Zmc2V0V2lkdGggLyAyLCBlbGVtZW50Lm9mZnNldEhlaWdodCAvIDJdKTtcblx0XHRcdHZhciBwYXRoID0gZDMuZ2VvLnBhdGgoKS5wcm9qZWN0aW9uKHByb2plY3Rpb24pO1xuXHRcdFx0cmV0dXJuIHtwYXRoOiBwYXRoLCBwcm9qZWN0aW9uOiBwcm9qZWN0aW9ufTtcblx0XHR9LFxuXHRcdFwiRXVyb3BlXCI6IGZ1bmN0aW9uKGVsZW1lbnQpIHtcblx0XHRcdC8vZW1waXJpY1xuXHRcdFx0dmFyIGsgPSAxLjU7XG5cdFx0XHR2YXIgcHJvamVjdGlvbiA9IGQzLmdlby5jb25pY0NvbmZvcm1hbCgpXG5cdFx0XHRcdC5yb3RhdGUoWy0xNSwgMF0pXG5cdFx0XHRcdC5jZW50ZXIoWzAsIDU1XSlcblx0XHRcdFx0LnBhcmFsbGVscyhbNjAsIDQwXSlcblx0XHRcdFx0LnNjYWxlKGVsZW1lbnQub2Zmc2V0V2lkdGgvaylcblx0XHRcdFx0LnRyYW5zbGF0ZShbZWxlbWVudC5vZmZzZXRXaWR0aCAvIDIsIGVsZW1lbnQub2Zmc2V0SGVpZ2h0IC8gMl0pO1xuXHRcdFx0dmFyIHBhdGggPSBkMy5nZW8ucGF0aCgpLnByb2plY3Rpb24ocHJvamVjdGlvbik7XG5cdFx0XHRyZXR1cm4ge3BhdGg6IHBhdGgsIHByb2plY3Rpb246IHByb2plY3Rpb259O1xuXHRcdH0sXG5cdFx0XCJBdXN0cmFsaWFcIjogZnVuY3Rpb24oZWxlbWVudCkge1xuXHRcdFx0Ly9lbXBpcmljXG5cdFx0XHR2YXIgayA9IDM7XG5cdFx0XHR2YXIgcHJvamVjdGlvbiA9IGQzLmdlby5jb25pY0NvbmZvcm1hbCgpXG5cdFx0XHRcdC5yb3RhdGUoWy0xMzUsIDBdKVxuXHRcdFx0XHQuY2VudGVyKFswLCAtMjBdKVxuXHRcdFx0XHQucGFyYWxsZWxzKFstMTAsIC0zMF0pXG5cdFx0XHRcdC5zY2FsZShlbGVtZW50Lm9mZnNldFdpZHRoL2spXG5cdFx0XHRcdC50cmFuc2xhdGUoW2VsZW1lbnQub2Zmc2V0V2lkdGggLyAyLCBlbGVtZW50Lm9mZnNldEhlaWdodCAvIDJdKTtcblx0XHRcdHZhciBwYXRoID0gZDMuZ2VvLnBhdGgoKS5wcm9qZWN0aW9uKHByb2plY3Rpb24pO1xuXHRcdFx0cmV0dXJuIHtwYXRoOiBwYXRoLCBwcm9qZWN0aW9uOiBwcm9qZWN0aW9ufTtcblx0XHR9XG5cblx0fTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5DaGFydC5NYXBUYWI7XG5cbn0pKCk7XG5cbihmdW5jdGlvbigpIHtcblx0dmFyIM61ID0gMWUtNiwgzrUyID0gzrUgKiDOtSwgz4AgPSBNYXRoLlBJLCBoYWxmz4AgPSDPgCAvIDIsIHNxcnTPgCA9IE1hdGguc3FydCjPgCksIHJhZGlhbnMgPSDPgCAvIDE4MCwgZGVncmVlcyA9IDE4MCAvIM+AO1xuXHRmdW5jdGlvbiBzaW5jaSh4KSB7XG5cdFx0cmV0dXJuIHggPyB4IC8gTWF0aC5zaW4oeCkgOiAxO1xuXHR9XG5cdGZ1bmN0aW9uIHNnbih4KSB7XG5cdFx0cmV0dXJuIHggPiAwID8gMSA6IHggPCAwID8gLTEgOiAwO1xuXHR9XG5cdGZ1bmN0aW9uIGFzaW4oeCkge1xuXHRcdHJldHVybiB4ID4gMSA/IGhhbGbPgCA6IHggPCAtMSA/IC1oYWxmz4AgOiBNYXRoLmFzaW4oeCk7XG5cdH1cblx0ZnVuY3Rpb24gYWNvcyh4KSB7XG5cdFx0cmV0dXJuIHggPiAxID8gMCA6IHggPCAtMSA/IM+AIDogTWF0aC5hY29zKHgpO1xuXHR9XG5cdGZ1bmN0aW9uIGFzcXJ0KHgpIHtcblx0XHRyZXR1cm4geCA+IDAgPyBNYXRoLnNxcnQoeCkgOiAwO1xuXHR9XG5cdHZhciBwcm9qZWN0aW9uID0gZDMuZ2VvLnByb2plY3Rpb247XG4gXG5cdGZ1bmN0aW9uIGVja2VydDMozrssIM+GKSB7XG5cdFx0dmFyIGsgPSBNYXRoLnNxcnQoz4AgKiAoNCArIM+AKSk7XG5cdFx0cmV0dXJuIFsgMiAvIGsgKiDOuyAqICgxICsgTWF0aC5zcXJ0KDEgLSA0ICogz4YgKiDPhiAvICjPgCAqIM+AKSkpLCA0IC8gayAqIM+GIF07XG5cdH1cblx0ZWNrZXJ0My5pbnZlcnQgPSBmdW5jdGlvbih4LCB5KSB7XG5cdFx0dmFyIGsgPSBNYXRoLnNxcnQoz4AgKiAoNCArIM+AKSkgLyAyO1xuXHRcdHJldHVybiBbIHggKiBrIC8gKDEgKyBhc3FydCgxIC0geSAqIHkgKiAoNCArIM+AKSAvICg0ICogz4ApKSksIHkgKiBrIC8gMiBdO1xuXHR9O1xuXHQoZDMuZ2VvLmVja2VydDMgPSBmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4gcHJvamVjdGlvbihlY2tlcnQzKTtcblx0fSkucmF3ID0gZWNrZXJ0Mztcblx0XG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0QXBwLlZpZXdzLkNoYXJ0LlNjYWxlU2VsZWN0b3JzID0gQmFja2JvbmUuVmlldy5leHRlbmQoe1xuXG5cdFx0ZWw6IFwiI2NoYXJ0LXZpZXcgLmF4aXMtc2NhbGUtc2VsZWN0b3JzLXdyYXBwZXJcIixcblx0XHRldmVudHM6IHtcblx0XHRcdFwiY2xpY2sgLmF4aXMtc2NhbGUtYnRuXCI6IFwib25BeGlzU2NhbGVCdG5cIixcblx0XHRcdFwiY2hhbmdlIC5heGlzLXNjYWxlIGxpXCI6IFwib25BeGlzU2NhbGVDaGFuZ2VcIlxuXHRcdH0sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdFxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gb3B0aW9ucy5kaXNwYXRjaGVyO1xuXHRcdFx0XG5cdFx0XHR0aGlzLiR0YWJzID0gdGhpcy4kZWwuZmluZCggXCIuaGVhZGVyLXRhYlwiICk7XG5cdFx0XHRcblx0XHRcdHRoaXMuJHhBeGlzU2NhbGUgPSB0aGlzLiRlbC5maW5kKCBcIltkYXRhLW5hbWU9J3gtYXhpcy1zY2FsZSddXCIgKTtcblx0XHRcdHRoaXMuJHlBeGlzU2NhbGUgPSB0aGlzLiRlbC5maW5kKCBcIltkYXRhLW5hbWU9J3ktYXhpcy1zY2FsZSddXCIgKTtcblxuXHRcdFx0dGhpcy5pbml0RHJvcERvd24oIHRoaXMuJHhBeGlzU2NhbGUgKTtcblx0XHRcdHRoaXMuaW5pdERyb3BEb3duKCB0aGlzLiR5QXhpc1NjYWxlICk7XG5cblx0XHRcdHRoaXMucmVuZGVyKCk7XG5cblx0XHRcdC8vc2V0dXAgZXZlbnRzXG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5vbiggXCJjaGFuZ2VcIiwgdGhpcy5yZW5kZXIsIHRoaXMgKTtcblxuXHRcdH0sXG5cblx0XHQvKmluaXRFdmVudHM6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy4kY2hhcnRWaWV3ID0gJCggXCIjY2hhcnQtdmlld1wiICk7XG5cdFx0XHR0aGlzLiR3cmFwID0gdGhpcy4kY2hhcnRWaWV3LmZpbmQoIFwic3ZnID4gLm52LXdyYXBcIiApO1xuXHRcdFx0XG5cdFx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0XHR0aGlzLiR3cmFwLm9uKCBcIm1vdXNlb3ZlclwiLCBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0XHR0aGF0LiRjaGFydFZpZXcuYWRkQ2xhc3MoIFwiY2hhcnQtaG92ZXJlZFwiICk7XG5cdFx0XHR9ICk7XG5cdFx0XHR0aGlzLiR3cmFwLm9uKCBcIm1vdXNlb3V0XCIsIGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKCBldnQuY3VycmVudFRhcmdldCApO1xuXHRcdFx0XHR0aGF0LiRjaGFydFZpZXcucmVtb3ZlQ2xhc3MoIFwiY2hhcnQtaG92ZXJlZFwiICk7XG5cdFx0XHR9ICk7XG5cdFx0fSwqL1xuXG5cdFx0aW5pdERyb3BEb3duOiBmdW5jdGlvbiggJGVsICkge1xuXG5cdFx0XHR2YXIgJGxpc3QgPSAkZWwuZmluZCggXCJ1bFwiICksXG5cdFx0XHRcdCRpdGVtcyA9ICRsaXN0LmZpbmQoIFwibGlcIiApO1xuXG5cdFx0XHQkaXRlbXMub24oIFwiY2xpY2tcIiwgZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdFx0dmFyICR0aGlzID0gJCggdGhpcyApLFxuXHRcdFx0XHRcdHZhbHVlID0gJHRoaXMuYXR0ciggXCJkYXRhLXZhbHVlXCIgKTtcblx0XHRcdFx0JGl0ZW1zLnJlbW92ZUNsYXNzKCBcInNlbGVjdGVkXCIgKTtcblx0XHRcdFx0JHRoaXMuYWRkQ2xhc3MoIFwic2VsZWN0ZWRcIiApO1xuXHRcdFx0XHQkdGhpcy50cmlnZ2VyKCBcImNoYW5nZVwiICk7XG5cdFx0XHR9ICk7XG5cblx0XHR9LFxuXG5cdFx0b25BeGlzU2NhbGVDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdHZhciAkbGkgPSAkKCBldnQuY3VycmVudFRhcmdldCApLFxuXHRcdFx0XHQkcGFyZW50ID0gJGxpLnBhcmVudCgpLnBhcmVudCgpLnBhcmVudCgpLFxuXHRcdFx0XHQkZGl2ID0gJHBhcmVudC5maW5kKCBcImRpdlwiICksXG5cdFx0XHRcdCRidG4gPSAkcGFyZW50LmZpbmQoIFwiLmF4aXMtc2NhbGUtYnRuXCIgKSxcblx0XHRcdFx0JHNlbGVjdCA9ICRwYXJlbnQuZmluZCggXCIuYXhpcy1zY2FsZVwiICksXG5cdFx0XHRcdG5hbWUgPSAkZGl2LmF0dHIoIFwiZGF0YS1uYW1lXCIgKSxcblx0XHRcdFx0YXhpc05hbWUgPSAoIG5hbWUgPT09IFwieC1heGlzLXNjYWxlXCIgKT8gXCJ4LWF4aXNcIjogXCJ5LWF4aXNcIixcblx0XHRcdFx0YXhpc1Byb3AgPSBcImF4aXMtc2NhbGVcIixcblx0XHRcdFx0dmFsdWUgPSAkbGkuYXR0ciggXCJkYXRhLXZhbHVlXCIgKTtcblxuXHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0QXhpc0NvbmZpZyggYXhpc05hbWUsIGF4aXNQcm9wLCB2YWx1ZSApO1xuXHRcdFx0XG5cdFx0XHQkc2VsZWN0LmhpZGUoKTtcblx0XHRcdC8vJGJ0bi5zaG93KCk7XG5cblx0XHR9LFxuXG5cdFx0b25BeGlzU2NhbGVCdG46IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHRcblx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0dmFyICRidG4gPSAkKCBldnQuY3VycmVudFRhcmdldCApLFxuXHRcdFx0XHQkcGFyZW50ID0gJGJ0bi5wYXJlbnQoKSxcblx0XHRcdFx0JHNlbGVjdCA9ICRwYXJlbnQuZmluZCggXCIuYXhpcy1zY2FsZVwiICk7XG5cblx0XHRcdCRzZWxlY3Quc2hvdygpO1xuXHRcdFx0Ly8kYnRuLmhpZGUoKTtcblxuXHRcdH1cblxuXHR9KTtcblx0XG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkNoYXJ0LlNjYWxlU2VsZWN0b3JzO1xuXHRcbn0pKCk7XG4iLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdEFwcC5WaWV3cy5DaGFydC5Tb3VyY2VzVGFiID0gQmFja2JvbmUuVmlldy5leHRlbmQoIHtcblxuXHRcdGVsOiBcIiNjaGFydC12aWV3XCIsXG5cdFx0ZXZlbnRzOiB7fSxcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0XG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIgPSBvcHRpb25zLmRpc3BhdGNoZXI7XG5cblx0XHRcdHRoaXMuJGNoYXJ0RGVzY3JpcHRpb24gPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1kZXNjcmlwdGlvblwiICk7XG5cdFx0XHR0aGlzLiRjaGFydFNvdXJjZXMgPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1zb3VyY2VzXCIgKTtcblx0XHRcdHRoaXMuJHNvdXJjZXNUYWIgPSB0aGlzLiRlbC5maW5kKCBcIiNzb3VyY2VzLWNoYXJ0LXRhYlwiICk7XG5cblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbiggcmVzcG9uc2UgKSB7XG5cblx0XHRcdGlmKCAhcmVzcG9uc2UgfHwgIXJlc3BvbnNlLmRhdGFzb3VyY2VzICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdHZhciBzb3VyY2VzID0gcmVzcG9uc2UuZGF0YXNvdXJjZXMsXG5cdFx0XHRcdGxpY2Vuc2UgPSByZXNwb25zZS5saWNlbnNlLFxuXHRcdFx0XHRmb290ZXJIdG1sID0gXCJcIixcblx0XHRcdFx0dGFiSHRtbCA9IFwiXCIsXG5cdFx0XHRcdGRlc2NyaXB0aW9uSHRtbCA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC1kZXNjcmlwdGlvblwiICksXG5cdFx0XHRcdHNvdXJjZXNTaG9ydEh0bWwgPSBcIkRhdGEgb2J0YWluZWQgZnJvbTogXCIsXG5cdFx0XHRcdHNvdXJjZXNMb25nSHRtbCA9IFwiXCIsXG5cdFx0XHRcdC8vY2hlY2sgdGhhdCB3ZSdyZSBub3QgYWRkaW5nIHNvdXJjZXMgd2l0aCB0aGUgc2FtZSBuYW1lIG1vcmUgdGltZXNcblx0XHRcdFx0c291cmNlc0J5TmFtZSA9IFtdO1xuXHRcdFx0XHRcblx0XHRcdC8vY29uc3RydWN0IHNvdXJjZSBodG1sXG5cdFx0XHRfLmVhY2goIHNvdXJjZXMsIGZ1bmN0aW9uKCBzb3VyY2VEYXRhLCBzb3VyY2VJbmRleCApIHtcblx0XHRcdFx0Ly9tYWtlIHN1cmUgd2UgZG9uJ3QgaGF2ZSBzb3VyY2Ugd2l0aCB0aGUgc2FtZSBuYW1lIGluIHRoZSBzaG9ydCBkZXNjcmlwdGlvbiBhbHJlYWR5XG5cdFx0XHRcdGlmKCAhc291cmNlc0J5TmFtZVsgc291cmNlRGF0YS5uYW1lIF0gKSB7XG5cdFx0XHRcdFx0aWYoIHNvdXJjZUluZGV4ID4gMCApIHtcblx0XHRcdFx0XHRcdHNvdXJjZXNTaG9ydEh0bWwgKz0gXCIsIFwiO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiggc291cmNlRGF0YS5saW5rICkge1xuXHRcdFx0XHRcdFx0c291cmNlc1Nob3J0SHRtbCArPSBcIjxhIGhyZWY9J1wiICsgc291cmNlRGF0YS5saW5rICsgXCInIHRhcmdldD0nX2JsYW5rJz5cIiArIHNvdXJjZURhdGEubmFtZSArIFwiPC9hPlwiO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRzb3VyY2VzU2hvcnRIdG1sICs9IHNvdXJjZURhdGEubmFtZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0c291cmNlc0J5TmFtZVsgc291cmNlRGF0YS5uYW1lIF0gPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdFxuXHRcdFx0XHQvL3NvdXJjZXMgbm93IGNvbnRhaW4gaHRtbCwgc28gbm8gbmVlZCB0byBzZXBhcmF0ZSB3aXRoIGNvbW1hXG5cdFx0XHRcdC8qaWYoIHNvdXJjZUluZGV4ID4gMCAmJiBzb3VyY2VzTG9uZ0h0bWwgIT09IFwiXCIgJiYgc291cmNlRGF0YS5kZXNjcmlwdGlvbiAhPT0gXCJcIiApIHtcblx0XHRcdFx0XHRzb3VyY2VzTG9uZ0h0bWwgKz0gXCIsIFwiO1xuXHRcdFx0XHR9Ki9cblx0XHRcdFx0c291cmNlc0xvbmdIdG1sICs9IHNvdXJjZURhdGEuZGVzY3JpcHRpb247XG5cdFx0XHRcblx0XHRcdH0gKTtcblxuXHRcdFx0Zm9vdGVySHRtbCA9IGRlc2NyaXB0aW9uSHRtbDtcblx0XHRcdHRhYkh0bWwgPSBkZXNjcmlwdGlvbkh0bWwgKyBcIjxiciAvPjxiciAvPlwiICsgc291cmNlc0xvbmdIdG1sO1xuXHRcdFx0XG5cdFx0XHQvL2FkZCBsaWNlbnNlIGluZm9cblx0XHRcdGlmKCBsaWNlbnNlICYmIGxpY2Vuc2UuZGVzY3JpcHRpb24gKSB7XG5cdFx0XHRcdGZvb3Rlckh0bWwgPSBsaWNlbnNlLmRlc2NyaXB0aW9uICsgXCIgXCIgKyBmb290ZXJIdG1sO1xuXHRcdFx0XHR0YWJIdG1sID0gbGljZW5zZS5kZXNjcmlwdGlvbiArIFwiIFwiICsgdGFiSHRtbDtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0Ly9hcHBlbmQgdG8gRE9NXG5cdFx0XHR0aGlzLiRjaGFydERlc2NyaXB0aW9uLmh0bWwoIGZvb3Rlckh0bWwgKTtcblx0XHRcdHRoaXMuJGNoYXJ0U291cmNlcy5odG1sKCBzb3VyY2VzU2hvcnRIdG1sICk7XG5cdFx0XHR0aGlzLiRzb3VyY2VzVGFiLmh0bWwoIHRhYkh0bWwgKTtcblxuXHRcdH1cblxuXHR9ICk7XG5cdFxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5DaGFydC5Tb3VyY2VzVGFiO1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0QXBwLlZpZXdzLkNoYXJ0Lk1hcC5NYXBDb250cm9scyA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblxuXHRcdGVsOiBcIiNtYXAtY2hhcnQtdGFiIC5tYXAtY29udHJvbHMtaGVhZGVyXCIsXG5cdFx0ZXZlbnRzOiB7XG5cdFx0XHRcImlucHV0IC50YXJnZXQteWVhci1jb250cm9sIGlucHV0XCI6IFwib25UYXJnZXRZZWFySW5wdXRcIixcblx0XHRcdFwiY2hhbmdlIC50YXJnZXQteWVhci1jb250cm9sIGlucHV0XCI6IFwib25UYXJnZXRZZWFyQ2hhbmdlXCIsXG5cdFx0XHRcImNsaWNrIC5yZWdpb24tY29udHJvbCBsaVwiOiBcIm9uUmVnaW9uQ2xpY2tcIixcblx0XHRcdFwiY2xpY2sgLnNldHRpbmdzLWNvbnRyb2wgaW5wdXRcIjogXCJvblNldHRpbmdzSW5wdXRcIixcblx0XHR9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cblx0XHRcdHRoaXMuZGlzcGF0Y2hlciA9IG9wdGlvbnMuZGlzcGF0Y2hlcjtcblxuXHRcdFx0dmFyIG1hcENvbmZpZyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJtYXAtY29uZmlnXCIgKTtcblx0XHRcdFxuXHRcdFx0Ly95ZWFyIHNsaWRlclxuXHRcdFx0dGhpcy4kdGFyZ2V0WWVhckNvbnRyb2wgPSB0aGlzLiRlbC5maW5kKCBcIi50YXJnZXQteWVhci1jb250cm9sXCIgKTtcblx0XHRcdHRoaXMuJHRhcmdldFllYXJMYWJlbCA9IHRoaXMuJHRhcmdldFllYXJDb250cm9sLmZpbmQoIFwiLnRhcmdldC15ZWFyLWxhYmVsXCIgKTtcblx0XHRcdHRoaXMuJHRhcmdldFllYXJJbnB1dCA9IHRoaXMuJHRhcmdldFllYXJDb250cm9sLmZpbmQoIFwiaW5wdXRcIiApO1xuXHRcdFx0XG5cdFx0XHQvL3JlZ2lvbiBzZWxlY3RvclxuXHRcdFx0dGhpcy4kcmVnaW9uQ29udHJvbCA9IHRoaXMuJGVsLmZpbmQoIFwiLnJlZ2lvbi1jb250cm9sXCIgKTtcblx0XHRcdHRoaXMuJHJlZ2lvbkNvbnRyb2xMYWJlbCA9IHRoaXMuJHJlZ2lvbkNvbnRyb2wuZmluZCggXCIucmVnaW9uLWxhYmVsXCIgKTtcblx0XHRcdHRoaXMuJHJlZ2lvbkNvbnRyb2xMaXMgPSB0aGlzLiRyZWdpb25Db250cm9sLmZpbmQoIFwibGlcIiApO1xuXG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5vbiggXCJjaGFuZ2VcIiwgdGhpcy5vbkNoYXJ0TW9kZWxDaGFuZ2UsIHRoaXMgKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLm9uKCBcImNoYW5nZS1tYXBcIiwgdGhpcy5vbkNoYXJ0TW9kZWxDaGFuZ2UsIHRoaXMgKTtcblxuXHRcdFx0cmV0dXJuIHRoaXMucmVuZGVyKCk7XG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcblx0XHRcdHZhciBtYXBDb25maWcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwibWFwLWNvbmZpZ1wiICk7XG5cdFx0XHRcblx0XHRcdHRoaXMuJHRhcmdldFllYXJMYWJlbC50ZXh0KCBtYXBDb25maWcudGFyZ2V0WWVhciApO1xuXHRcdFx0dGhpcy4kcmVnaW9uQ29udHJvbExhYmVsLnRleHQoIG1hcENvbmZpZy5wcm9qZWN0aW9uICk7XG5cblx0XHRcdHRoaXMuJHRhcmdldFllYXJJbnB1dC5hdHRyKCBcIm1pblwiLCBtYXBDb25maWcubWluWWVhciApO1xuXHRcdFx0dGhpcy4kdGFyZ2V0WWVhcklucHV0LmF0dHIoIFwibWF4XCIsIG1hcENvbmZpZy5tYXhZZWFyICk7XG5cdFx0XHR0aGlzLiR0YXJnZXRZZWFySW5wdXQuYXR0ciggXCJzdGVwXCIsIG1hcENvbmZpZy50aW1lSW50ZXJ2YWwgKTtcblx0XHRcdHRoaXMuJHRhcmdldFllYXJJbnB1dC52YWwoIHBhcnNlSW50KCBtYXBDb25maWcudGFyZ2V0WWVhciwgMTAgKSApO1xuXG5cdFx0XHR0aGlzLiRyZWdpb25Db250cm9sTGlzLnJlbW92ZUNsYXNzKCBcImhpZ2hsaWdodFwiICk7XG5cdFx0XHR0aGlzLiRyZWdpb25Db250cm9sTGlzLmZpbHRlciggXCIuXCIgKyBtYXBDb25maWcucHJvamVjdGlvbiArIFwiLXByb2plY3Rpb25cIiApLmFkZENsYXNzKCBcImhpZ2hsaWdodFwiICk7XG5cblx0XHR9LFxuXG5cdFx0b25DaGFydE1vZGVsQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblx0XHR9LFxuXHRcdFxuXHRcdG9uVGFyZ2V0WWVhcklucHV0OiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0dmFyICR0aGlzID0gJCggZXZ0LnRhcmdldCApLFxuXHRcdFx0XHR0YXJnZXRZZWFyID0gcGFyc2VJbnQoICR0aGlzLnZhbCgpLCAxMCApO1xuXHRcdFx0dGhpcy4kdGFyZ2V0WWVhckxhYmVsLnRleHQoIHRhcmdldFllYXIsIGZhbHNlLCBcImNoYW5nZS1tYXBcIiApO1xuXHRcdH0sXG5cblx0XHRvblRhcmdldFllYXJDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHR2YXIgJHRoaXMgPSAkKCBldnQudGFyZ2V0ICksXG5cdFx0XHRcdHRhcmdldFllYXIgPSBwYXJzZUludCggJHRoaXMudmFsKCksIDEwICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC51cGRhdGVNYXBDb25maWcoIFwidGFyZ2V0WWVhclwiLCB0YXJnZXRZZWFyLCBmYWxzZSwgXCJjaGFuZ2UtbWFwXCIgKTtcblx0XHRcdHRoaXMucmVuZGVyKCk7XG5cdFx0fSxcblxuXHRcdG9uUmVnaW9uQ2xpY2s6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHR2YXIgJHRoaXMgPSAkKCBldnQudGFyZ2V0ICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC51cGRhdGVNYXBDb25maWcoIFwicHJvamVjdGlvblwiLCAkdGhpcy50ZXh0KCksIGZhbHNlLCBcImNoYW5nZS1tYXBcIiApO1xuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblx0XHR9LFxuXG5cdFx0b25TZXR0aW5nc0lucHV0OiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0dmFyICR0aGlzID0gJCggZXZ0LnRhcmdldCApLFxuXHRcdFx0XHRtb2RlID0gKCAkdGhpcy5pcyggXCI6Y2hlY2tlZFwiICkgKT8gXCJzcGVjaWZpY1wiOiBcIm5vLWludGVycG9sYXRpb25cIjtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnVwZGF0ZU1hcENvbmZpZyggXCJtb2RlXCIsIG1vZGUsIGZhbHNlLCBcImNoYW5nZS1tYXBcIiApO1xuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblx0XHR9XG5cblx0fSk7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVmlld3MuQ2hhcnQuTWFwLk1hcENvbnRyb2xzO1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciB0aGF0O1xuXG5cdEFwcC5WaWV3cy5VSS5WYXJpYWJsZVNlbGVjdHMgPSBmdW5jdGlvbigpIHtcblxuXHRcdHRoYXQgPSB0aGlzO1xuXHRcdHRoaXMuJGRpdiA9IG51bGw7XG5cblx0fTtcblxuXHRBcHAuVmlld3MuVUkuVmFyaWFibGVTZWxlY3RzLnByb3RvdHlwZSA9IHtcblxuXHRcdGluaXQ6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHR0aGlzLiRlbCA9ICQoIFwiLmZvcm0tdmFyaWFibGUtc2VsZWN0LXdyYXBwZXJcIiApO1xuXHRcdFx0dGhpcy4kY2F0ZWdvcnlXcmFwcGVyID0gdGhpcy4kZWwuZmluZCggXCIuY2F0ZWdvcnktd3JhcHBlclwiICk7XG5cdFx0XHR0aGlzLiRjYXRlZ29yeVNlbGVjdCA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9Y2F0ZWdvcnktaWRdXCIgKTtcblx0XHRcdHRoaXMuJHN1YmNhdGVnb3J5V3JhcHBlciA9IHRoaXMuJGVsLmZpbmQoIFwiLnN1YmNhdGVnb3J5LXdyYXBwZXJcIiApO1xuXHRcdFx0dGhpcy4kc3ViY2F0ZWdvcnlTZWxlY3QgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPXN1YmNhdGVnb3J5LWlkXVwiICk7XG5cdFx0XHR0aGlzLiR2YXJpYWJsZVdyYXBwZXIgPSB0aGlzLiRlbC5maW5kKCBcIi52YXJpYWJsZS13cmFwcGVyXCIgKTtcblx0XHRcdHRoaXMuJGNoYXJ0VmFyaWFibGUgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPWNoYXJ0LXZhcmlhYmxlXVwiICk7XG5cdFx0XHRcblx0XHRcdHRoaXMuJGNhdGVnb3J5U2VsZWN0Lm9uKCBcImNoYW5nZVwiLCAkLnByb3h5KCB0aGlzLm9uQ2F0ZWdvcnlDaGFuZ2UsIHRoaXMgKSApO1xuXHRcdFx0dGhpcy4kc3ViY2F0ZWdvcnlTZWxlY3Qub24oIFwiY2hhbmdlXCIsICQucHJveHkoIHRoaXMub25TdWJDYXRlZ29yeUNoYW5nZSwgdGhpcyApICk7XG5cblx0XHRcdHRoaXMuJHN1YmNhdGVnb3J5V3JhcHBlci5oaWRlKCk7XG5cdFx0XHR0aGlzLiR2YXJpYWJsZVdyYXBwZXIuaGlkZSgpO1xuXG5cdFx0fSxcblxuXHRcdG9uQ2F0ZWdvcnlDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHRcblx0XHRcdHZhciAkaW5wdXQgPSAkKCBldnQuY3VycmVudFRhcmdldCApO1xuXHRcdFx0aWYoICRpbnB1dC52YWwoKSAhPSBcIlwiICkge1xuXHRcdFx0XHR0aGlzLiRzdWJjYXRlZ29yeVdyYXBwZXIuc2hvdygpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy4kc3ViY2F0ZWdvcnlXcmFwcGVyLmhpZGUoKTtcblx0XHRcdFx0dGhpcy4kdmFyaWFibGVXcmFwcGVyLmhpZGUoKTtcblx0XHRcdH1cblxuXHRcdFx0Ly9maWx0ZXIgc3ViY2F0ZWdvcmllcyBzZWxlY3Rcblx0XHRcdHRoaXMuJHN1YmNhdGVnb3J5U2VsZWN0LmZpbmQoIFwib3B0aW9uXCIgKS5oaWRlKCk7XG5cdFx0XHR0aGlzLiRzdWJjYXRlZ29yeVNlbGVjdC5maW5kKCBcIm9wdGlvbltkYXRhLWNhdGVnb3J5LWlkPVwiICsgJGlucHV0LnZhbCgpICsgXCJdXCIgKS5zaG93KCk7XG5cblx0XHR9LFxuXG5cdFx0b25TdWJDYXRlZ29yeUNoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dmFyICRpbnB1dCA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICk7XG5cdFx0XHRpZiggJGlucHV0LnZhbCgpICE9IFwiXCIgKSB7XG5cdFx0XHRcdHRoaXMuJHZhcmlhYmxlV3JhcHBlci5zaG93KCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLiR2YXJpYWJsZVdyYXBwZXIuaGlkZSgpO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHQvL2ZpbHRlciBzdWJjYXRlZ29yaWVzIHNlbGVjdFxuXHRcdFx0dGhpcy4kY2hhcnRWYXJpYWJsZS5maW5kKCBcIm9wdGlvbjpub3QoOmRpc2FibGVkKVwiICkuaGlkZSgpO1xuXHRcdFx0dGhpcy4kY2hhcnRWYXJpYWJsZS5maW5kKCBcIm9wdGlvbltkYXRhLXN1YmNhdGVnb3J5LWlkPVwiICsgJGlucHV0LnZhbCgpICsgXCJdXCIgKS5zaG93KCk7XG5cblx0XHR9XG5cblx0fTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5VSS5WYXJpYWJsZVNlbGVjdHM7XG5cbn0pKCk7XG4iXX0=
