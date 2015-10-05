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

		initialize: function() {},

		start: function() {
			//render everything for the first time
			this.render();
		},

		render: function() {
			
			var dispatcher = _.clone( Backbone.Events );
			this.dispatcher = dispatcher;

			if( FormView ) {
				this.formView = new FormView( { dispatcher: dispatcher } );
			}
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9sYXJhdmVsLWVsaXhpci1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC9BcHAuVXRpbHMuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC9BcHAuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC9tb2RlbHMvQXBwLk1vZGVscy5DaGFydERhdGFNb2RlbC5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL21vZGVscy9BcHAuTW9kZWxzLkNoYXJ0TW9kZWwuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy9BcHAuVmlld3MuQ2hhcnRWaWV3LmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvQXBwLlZpZXdzLkZvcm1WaWV3LmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvQXBwLlZpZXdzLkltcG9ydFZpZXcuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy9BcHAuVmlld3MuTWFpbi5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL2NoYXJ0L0FwcC5WaWV3cy5DaGFydC5DaGFydFRhYi5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL2NoYXJ0L0FwcC5WaWV3cy5DaGFydC5EYXRhVGFiLmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvY2hhcnQvQXBwLlZpZXdzLkNoYXJ0LkhlYWRlci5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL2NoYXJ0L0FwcC5WaWV3cy5DaGFydC5MZWdlbmQuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy9jaGFydC9BcHAuVmlld3MuQ2hhcnQuTWFwVGFiLmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvY2hhcnQvQXBwLlZpZXdzLkNoYXJ0LlNjYWxlU2VsZWN0b3JzLmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvY2hhcnQvQXBwLlZpZXdzLkNoYXJ0LlNvdXJjZXNUYWIuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy9jaGFydC9tYXAvQXBwLlZpZXdzLkNoYXJ0Lk1hcC5NYXBDb250cm9scy5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL3VpL0FwcC5WaWV3cy5VSS5WYXJpYWJsZVNlbGVjdHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbnNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDck1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOWFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0tBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDandCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDamZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JXQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCI7KCBmdW5jdGlvbigpIHtcblxuXHRcInVzZSBzdHJpY3RcIjtcblx0XG5cdEFwcC5VdGlscy5tYXBEYXRhID0gZnVuY3Rpb24oIHJhd0RhdGEsIHRyYW5zcG9zZWQgKSB7XG5cblx0XHR2YXIgZGF0YSA9IFtdLFxuXHRcdFx0ZGF0YUJ5SWQgPSBbXSxcblx0XHRcdGNvdW50cnlJbmRleCA9IDE7XG5cblx0XHQvL2RvIHdlIGhhdmUgZW50aXRpZXMgaW4gcm93cyBhbmQgdGltZXMgaW4gY29sdW1ucz9cdFxuXHRcdGlmKCAhdHJhbnNwb3NlZCApIHtcblx0XHRcdC8vbm8sIHdlIGhhdmUgdG8gc3dpdGNoIHJvd3MgYW5kIGNvbHVtbnNcblx0XHRcdHJhd0RhdGEgPSBBcHAuVXRpbHMudHJhbnNwb3NlKCByYXdEYXRhICk7XG5cdFx0fVxuXHRcdFxuXHRcdC8vZXh0cmFjdCB0aW1lIGNvbHVtblxuXHRcdHZhciB0aW1lQXJyID0gcmF3RGF0YS5zaGlmdCgpO1xuXHRcdC8vZ2V0IHJpZCBvZiBmaXJzdCBpdGVtIChsYWJlbCBvZiB0aW1lIGNvbHVtbikgXG5cdFx0dGltZUFyci5zaGlmdCgpO1xuXHRcblx0XHRmb3IoIHZhciBpID0gMCwgbGVuID0gcmF3RGF0YS5sZW5ndGg7IGkgPCBsZW47IGkrKyApIHtcblxuXHRcdFx0dmFyIHNpbmdsZVJvdyA9IHJhd0RhdGFbIGkgXSxcblx0XHRcdFx0Y29sTmFtZSA9IHNpbmdsZVJvdy5zaGlmdCgpO1xuXHRcdFx0XHRcblx0XHRcdC8vb21taXQgcm93cyB3aXRoIG5vIGNvbE5tYWVcblx0XHRcdGlmKCBjb2xOYW1lICkge1xuXHRcdFx0XHR2YXIgc2luZ2xlRGF0YSA9IFtdO1xuXHRcdFx0XHRfLmVhY2goIHNpbmdsZVJvdywgZnVuY3Rpb24oIHZhbHVlLCBpICkge1xuXHRcdFx0XHRcdC8vY2hlY2sgd2UgaGF2ZSB2YWx1ZVxuXHRcdFx0XHRcdGlmKCB2YWx1ZSAhPT0gXCJcIiApIHtcblx0XHRcdFx0XHRcdHNpbmdsZURhdGEucHVzaCggeyB4OiB0aW1lQXJyW2ldLCB5OiAoICFpc05hTiggdmFsdWUgKSApPyArdmFsdWU6IHZhbHVlIH0gKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gKTtcblxuXHRcdFx0XHQvL2NvbnN0cnVjdCBlbnRpdHkgb2JqXG5cdFx0XHRcdHZhclx0ZW50aXR5T2JqID0ge1xuXHRcdFx0XHRcdGlkOiBpLFxuXHRcdFx0XHRcdGtleTogY29sTmFtZSxcblx0XHRcdFx0XHR2YWx1ZXM6IHNpbmdsZURhdGFcblx0XHRcdFx0fTtcblx0XHRcdFx0ZGF0YS5wdXNoKCBlbnRpdHlPYmogKTtcblx0XHRcdH1cblxuXHRcdH1cblxuXHRcdHJldHVybiBkYXRhO1xuXG5cdH0sXG5cblx0QXBwLlV0aWxzLm1hcFNpbmdsZVZhcmlhbnREYXRhID0gZnVuY3Rpb24oIHJhd0RhdGEsIHZhcmlhYmxlTmFtZSApIHtcblxuXHRcdHZhciB2YXJpYWJsZSA9IHtcblx0XHRcdG5hbWU6IHZhcmlhYmxlTmFtZSxcblx0XHRcdHZhbHVlczogQXBwLlV0aWxzLm1hcERhdGEoIHJhd0RhdGEsIHRydWUgKVxuXHRcdH07XG5cdFx0cmV0dXJuIFt2YXJpYWJsZV07XG5cblx0fSxcblxuXHQvKkFwcC5VdGlscy5tYXBNdWx0aVZhcmlhbnREYXRhID0gZnVuY3Rpb24oIHJhd0RhdGEsIGVudGl0eU5hbWUgKSB7XG5cdFx0XG5cdFx0Ly90cmFuc2Zvcm0gbXVsdGl2YXJpYW50IGludG8gc3RhbmRhcmQgZm9ybWF0ICggdGltZSwgZW50aXR5IClcblx0XHR2YXIgdmFyaWFibGVzID0gW10sXG5cdFx0XHR0cmFuc3Bvc2VkID0gcmF3RGF0YSwvL0FwcC5VdGlscy50cmFuc3Bvc2UoIHJhd0RhdGEgKSxcblx0XHRcdHRpbWVBcnIgPSB0cmFuc3Bvc2VkLnNoaWZ0KCk7XG5cblx0XHQvL2dldCByaWQgb2YgZmlyc3QgaXRlbSAobGFiZWwgb2YgdGltZSBjb2x1bW4pIFxuXHRcdC8vdGltZUFyci5zaGlmdCgpO1xuXHRcdFxuXHRcdF8uZWFjaCggdHJhbnNwb3NlZCwgZnVuY3Rpb24oIHZhbHVlcywga2V5LCBsaXN0ICkge1xuXG5cdFx0XHQvL2dldCB2YXJpYWJsZSBuYW1lIGZyb20gZmlyc3QgY2VsbCBvZiBjb2x1bW5zXG5cdFx0XHR2YXIgdmFyaWFibGVOYW1lID0gdmFsdWVzLnNoaWZ0KCk7XG5cdFx0XHQvL2FkZCBlbnRpdHkgbmFtZSBhcyBmaXJzdCBjZWxsXG5cdFx0XHR2YWx1ZXMudW5zaGlmdCggZW50aXR5TmFtZSApO1xuXHRcdFx0Ly9jb25zdHJ1Y3QgYXJyYXkgZm9yIG1hcHBpbmcsIG5lZWQgdG8gZGVlcCBjb3B5IHRpbWVBcnJcblx0XHRcdHZhciBsb2NhbFRpbWVBcnIgPSAkLmV4dGVuZCggdHJ1ZSwgW10sIHRpbWVBcnIpO1xuXHRcdFx0dmFyIGRhdGFUb01hcCA9IFsgbG9jYWxUaW1lQXJyLCB2YWx1ZXMgXTtcblx0XHRcdC8vY29uc3RydWN0IG9iamVjdFxuXHRcdFx0dmFyIHZhcmlhYmxlID0ge1xuXHRcdFx0XHRuYW1lOiB2YXJpYWJsZU5hbWUsXG5cdFx0XHRcdHZhbHVlczogQXBwLlV0aWxzLm1hcERhdGEoIGRhdGFUb01hcCwgdHJ1ZSApXG5cdFx0XHR9O1xuXHRcdFx0dmFyaWFibGVzLnB1c2goIHZhcmlhYmxlICk7XG5cblx0XHR9ICk7XG5cblx0XHRyZXR1cm4gdmFyaWFibGVzO1xuXG5cdH0sKi9cblxuXHRBcHAuVXRpbHMubWFwTXVsdGlWYXJpYW50RGF0YSA9IGZ1bmN0aW9uKCByYXdEYXRhICkge1xuXHRcdFxuXHRcdHZhciB2YXJpYWJsZXMgPSBbXSxcblx0XHRcdHRyYW5zcG9zZWQgPSByYXdEYXRhLFxuXHRcdFx0aGVhZGVyQXJyID0gdHJhbnNwb3NlZC5zaGlmdCgpO1xuXG5cdFx0Ly9nZXQgcmlkIG9mIGVudGl0eSBhbmQgeWVhciBjb2x1bW4gbmFtZVxuXHRcdGhlYWRlckFyciA9IGhlYWRlckFyci5zbGljZSggMiApO1xuXG5cdFx0dmFyIHZhclBlclJvd0RhdGEgPSBBcHAuVXRpbHMudHJhbnNwb3NlKCB0cmFuc3Bvc2VkICksXG5cdFx0XHRlbnRpdGllc1JvdyA9IHZhclBlclJvd0RhdGEuc2hpZnQoKSxcblx0XHRcdHRpbWVzUm93ID0gdmFyUGVyUm93RGF0YS5zaGlmdCgpO1xuXG5cdFx0Xy5lYWNoKCB2YXJQZXJSb3dEYXRhLCBmdW5jdGlvbiggdmFsdWVzLCB2YXJJbmRleCApIHtcblx0XHRcdFxuXHRcdFx0dmFyIGVudGl0aWVzID0ge307XG5cdFx0XHQvL2l0ZXJhdGUgdGhyb3VnaCBhbGwgdmFsdWVzIGZvciBnaXZlbiB2YXJpYWJsZVxuXHRcdFx0Xy5lYWNoKCB2YWx1ZXMsIGZ1bmN0aW9uKCB2YWx1ZSwga2V5ICkge1xuXHRcdFx0XHR2YXIgZW50aXR5ID0gZW50aXRpZXNSb3dbIGtleSBdLFxuXHRcdFx0XHRcdHRpbWUgPSB0aW1lc1Jvd1sga2V5IF07XG5cdFx0XHRcdGlmKCBlbnRpdHkgJiYgdGltZSApIHtcblx0XHRcdFx0XHQvL2RvIGhhdmUgYWxyZWFkeSBlbnRpdHkgZGVmaW5lZD9cblx0XHRcdFx0XHRpZiggIWVudGl0aWVzWyBlbnRpdHkgXSApIHtcblx0XHRcdFx0XHRcdGVudGl0aWVzWyBlbnRpdHkgXSA9IHtcblx0XHRcdFx0XHRcdFx0aWQ6IGtleSxcblx0XHRcdFx0XHRcdFx0a2V5OiBlbnRpdHksXG5cdFx0XHRcdFx0XHRcdHZhbHVlczogW11cblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVudGl0aWVzWyBlbnRpdHkgXS52YWx1ZXMucHVzaCggeyB4OiB0aW1lLCB5OiAoICFpc05hTiggdmFsdWUgKSApPyArdmFsdWU6IHZhbHVlIH0gKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXG5cdFx0XHQvL2hhdmUgZGF0YSBmb3IgYWxsIGVudGl0aWVzLCBqdXN0IGNvbnZlcnQgdGhlbSB0byBhcnJheVxuXHRcdFx0dmFyIHZhclZhbHVlcyA9IF8ubWFwKCBlbnRpdGllcywgZnVuY3Rpb24oIHZhbHVlICkgeyByZXR1cm4gdmFsdWU7IH0gKTtcblx0XHRcdFxuXHRcdFx0dmFyIHZhcmlhYmxlID0ge1xuXHRcdFx0XHRuYW1lOiBoZWFkZXJBcnJbIHZhckluZGV4IF0sXG5cdFx0XHRcdHZhbHVlczogdmFyVmFsdWVzXG5cdFx0XHR9O1xuXHRcdFx0dmFyaWFibGVzLnB1c2goIHZhcmlhYmxlICk7XG5cblx0XHR9ICk7XG5cblx0XHRyZXR1cm4gdmFyaWFibGVzO1xuXG5cdH0sXG5cblxuXHRBcHAuVXRpbHMudHJhbnNwb3NlID0gZnVuY3Rpb24oIGFyciApIHtcblx0XHR2YXIga2V5cyA9IF8ua2V5cyggYXJyWzBdICk7XG5cdFx0cmV0dXJuIF8ubWFwKCBrZXlzLCBmdW5jdGlvbiAoYykge1xuXHRcdFx0cmV0dXJuIF8ubWFwKCBhcnIsIGZ1bmN0aW9uKCByICkge1xuXHRcdFx0XHRyZXR1cm4gcltjXTtcblx0XHRcdH0gKTtcblx0XHR9KTtcblx0fSxcblxuXHRBcHAuVXRpbHMudHJhbnNmb3JtID0gZnVuY3Rpb24oKSB7XG5cblx0XHRjb25zb2xlLmxvZyggXCJhcHAudXRpbHMudHJhbnNmb3JtXCIgKTtcblxuXHR9LFxuXG5cdEFwcC5VdGlscy5lbmNvZGVTdmdUb1BuZyA9IGZ1bmN0aW9uKCBodG1sICkge1xuXG5cdFx0Y29uc29sZS5sb2coIGh0bWwgKTtcblx0XHR2YXIgaW1nU3JjID0gXCJkYXRhOmltYWdlL3N2Zyt4bWw7YmFzZTY0LFwiICsgYnRvYShodG1sKSxcblx0XHRcdGltZyA9IFwiPGltZyBzcmM9J1wiICsgaW1nU3JjICsgXCInPlwiOyBcblx0XHRcblx0XHQvL2QzLnNlbGVjdCggXCIjc3ZnZGF0YXVybFwiICkuaHRtbCggaW1nICk7XG5cblx0XHQkKCBcIi5jaGFydC13cmFwcGVyLWlubmVyXCIgKS5odG1sKCBpbWcgKTtcblxuXHRcdC8qdmFyIGNhbnZhcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoIFwiY2FudmFzXCIgKSxcblx0XHRcdGNvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dCggXCIyZFwiICk7XG5cblx0XHR2YXIgaW1hZ2UgPSBuZXcgSW1hZ2U7XG5cdFx0aW1hZ2Uuc3JjID0gaW1nc3JjO1xuXHRcdGltYWdlLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0Y29udGV4dC5kcmF3SW1hZ2UoaW1hZ2UsIDAsIDApO1xuXHRcdFx0dmFyIGNhbnZhc0RhdGEgPSBjYW52YXMudG9EYXRhVVJMKCBcImltYWdlL3BuZ1wiICk7XG5cdFx0XHR2YXIgcG5nSW1nID0gJzxpbWcgc3JjPVwiJyArIGNhbnZhc0RhdGEgKyAnXCI+JzsgXG5cdFx0XHRkMy5zZWxlY3QoXCIjcG5nZGF0YXVybFwiKS5odG1sKHBuZ2ltZyk7XG5cblx0XHRcdHZhciBhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImFcIik7XG5cdFx0XHRhLmRvd25sb2FkID0gXCJzYW1wbGUucG5nXCI7XG5cdFx0XHRhLmhyZWYgPSBjYW52YXNkYXRhO1xuXHRcdFx0YS5jbGljaygpO1xuXHRcdH07Ki9cblxuXG5cdH07XG5cblx0LyoqXG5cdCpcdFRJTUUgUkVMQVRFRCBGVU5DVElPTlNcblx0KiovXG5cblx0QXBwLlV0aWxzLm50aCA9IGZ1bmN0aW9uICggZCApIHtcblx0XHQvL2NvbnZlciB0byBudW1iZXIganVzdCBpbiBjYXNlXG5cdFx0ZCA9ICtkO1xuXHRcdGlmKCBkID4gMyAmJiBkIDwgMjEgKSByZXR1cm4gJ3RoJzsgLy8gdGhhbmtzIGtlbm5lYmVjXG5cdFx0c3dpdGNoKCBkICUgMTAgKSB7XG5cdFx0XHRjYXNlIDE6ICByZXR1cm4gXCJzdFwiO1xuXHRcdFx0Y2FzZSAyOiAgcmV0dXJuIFwibmRcIjtcblx0XHRcdGNhc2UgMzogIHJldHVybiBcInJkXCI7XG5cdFx0XHRkZWZhdWx0OiByZXR1cm4gXCJ0aFwiO1xuXHRcdH1cblx0fVxuXG5cdEFwcC5VdGlscy5jZW50dXJ5U3RyaW5nID0gZnVuY3Rpb24gKCBkICkge1xuXHRcdC8vY29udmVyIHRvIG51bWJlciBqdXN0IGluIGNhc2Vcblx0XHRkID0gK2Q7XG5cdFx0XG5cdFx0dmFyIGNlbnR1cnlOdW0gPSBNYXRoLmZsb29yKGQgLyAxMDApICsgMSxcblx0XHRcdGNlbnR1cnlTdHJpbmcgPSBjZW50dXJ5TnVtLnRvU3RyaW5nKCksXG5cdFx0XHRudGggPSBBcHAuVXRpbHMubnRoKCBjZW50dXJ5U3RyaW5nICk7XG5cblx0XHRyZXR1cm4gY2VudHVyeVN0cmluZyArIG50aCArIFwiIGNlbnR1cnlcIjtcblx0fVxuXG5cdEFwcC5VdGlscy5hZGRaZXJvcyA9IGZ1bmN0aW9uICggdmFsdWUgKSB7XG5cblx0XHR2YWx1ZSA9IHZhbHVlLnRvU3RyaW5nKCk7XG5cdFx0aWYoIHZhbHVlLmxlbmd0aCA8IDQgKSB7XG5cdFx0XHQvL2luc2VydCBtaXNzaW5nIHplcm9zXG5cdFx0XHR2YXIgdmFsdWVMZW4gPSB2YWx1ZS5sZW5ndGg7XG5cdFx0XHRmb3IoIHZhciB5ID0gMDsgeSA8IDQgLSB2YWx1ZUxlbjsgeSsrICkge1xuXHRcdFx0XHR2YWx1ZSA9IFwiMFwiICsgdmFsdWU7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB2YWx1ZTtcblx0XHRcblx0fVxuXG5cdEFwcC5VdGlscy5yb3VuZFRpbWUgPSBmdW5jdGlvbiggbW9tZW50VGltZSApIHtcblxuXHRcdGlmKCB0eXBlb2YgbW9tZW50VGltZS5mb3JtYXQgPT09IFwiZnVuY3Rpb25cIiApIHtcblx0XHRcdC8vdXNlIHNob3J0IGZvcm1hdCBteXNxbCBleHBlY3RzIC0gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8xMDUzOTE1NC9pbnNlcnQtaW50by1kYi1kYXRldGltZS1zdHJpbmdcblx0XHRcdHJldHVybiBtb21lbnRUaW1lLmZvcm1hdCggXCJZWVlZLU1NLUREXCIgKTtcblx0XHR9XG5cdFx0cmV0dXJuIG1vbWVudFRpbWU7XG5cblx0fVxuXG5cdC8qKiBcblx0KiBGT1JNIEhFTFBFUlxuXHQqKi9cblx0QXBwLlV0aWxzLkZvcm1IZWxwZXIudmFsaWRhdGUgPSBmdW5jdGlvbiggJGZvcm0gKSB7XG5cdFx0XG5cdFx0dmFyIG1pc3NpbmdFcnJvckxhYmVsID0gXCJQbGVhc2UgZW50ZXIgdmFsdWUuXCIsXG5cdFx0XHRlbWFpbEVycm9yTGFiZWwgPSAgXCJQbGVhc2UgZW50ZXIgdmFsaWRlIGVtYWlsLlwiLFxuXHRcdFx0bnVtYmVyRXJyb3JMYWJlbCA9IFwiUGxlYXNlIGVudGUgdmFsaWQgbnVtYmVyLlwiOyBcblxuXHRcdHZhciBpbnZhbGlkSW5wdXRzID0gW107XG5cdFx0XG5cdFx0Ly9nYXRoZXIgYWxsIGZpZWxkcyByZXF1aXJpbmcgdmFsaWRhdGlvblxuXHRcdHZhciAkcmVxdWlyZWRJbnB1dHMgPSAkZm9ybS5maW5kKCBcIi5yZXF1aXJlZFwiICk7XG5cdFx0aWYoICRyZXF1aXJlZElucHV0cy5sZW5ndGggKSB7XG5cblx0XHRcdCQuZWFjaCggJHJlcXVpcmVkSW5wdXRzLCBmdW5jdGlvbiggaSwgdiApIHtcblxuXHRcdFx0XHR2YXIgJGlucHV0ID0gJCggdGhpcyApO1xuXHRcdFx0XHRcblx0XHRcdFx0Ly9maWx0ZXIgb25seSB2aXNpYmxlXG5cdFx0XHRcdGlmKCAhJGlucHV0LmlzKCBcIjp2aXNpYmxlXCIgKSApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvL2NoZWNrIGZvciBlbXB0eVxuXHRcdFx0XHR2YXIgaW5wdXRWYWxpZCA9IEFwcC5VdGlscy5Gb3JtSGVscGVyLnZhbGlkYXRlUmVxdWlyZWRGaWVsZCggJGlucHV0ICk7XG5cdFx0XHRcdGlmKCAhaW5wdXRWYWxpZCApIHtcblx0XHRcdFx0XG5cdFx0XHRcdFx0QXBwLlV0aWxzLkZvcm1IZWxwZXIuYWRkRXJyb3IoICRpbnB1dCwgbWlzc2luZ0Vycm9yTGFiZWwgKTtcblx0XHRcdFx0XHRpbnZhbGlkSW5wdXRzLnB1c2goICRpbnB1dCApO1xuXHRcdFx0XHRcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHRBcHAuVXRpbHMuRm9ybUhlbHBlci5yZW1vdmVFcnJvciggJGlucHV0ICk7XG5cblx0XHRcdFx0XHQvL2NoZWNrIGZvciBkaWdpdFxuXHRcdFx0XHRcdGlmKCAkaW5wdXQuaGFzQ2xhc3MoIFwicmVxdWlyZWQtbnVtYmVyXCIgKSApIHtcblx0XHRcdFx0XHRcdGlucHV0VmFsaWQgPSBBcHAuVXRpbHMuRm9ybUhlbHBlci52YWxpZGF0ZU51bWJlckZpZWxkKCAkaW5wdXQgKTtcblx0XHRcdFx0XHRcdGlmKCAhaW5wdXRWYWxpZCApIHtcblx0XHRcdFx0XHRcdFx0QXBwLlV0aWxzLkZvcm1IZWxwZXIuYWRkRXJyb3IoICRpbnB1dCwgbnVtYmVyRXJyb3JMYWJlbCApO1xuXHRcdFx0XHRcdFx0XHRpbnZhbGlkSW5wdXRzLnB1c2goICRpbnB1dCApO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0QXBwLlV0aWxzLkZvcm1IZWxwZXIucmVtb3ZlRXJyb3IoICRpbnB1dCApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vY2hlY2sgZm9yIG1haWxcblx0XHRcdFx0XHRpZiggJGlucHV0Lmhhc0NsYXNzKCBcInJlcXVpcmVkLW1haWxcIiApICkge1xuXHRcdFx0XHRcdFx0aW5wdXRWYWxpZCA9IEZvcm1IZWxwZXIudmFsaWRhdGVFbWFpbEZpZWxkKCAkaW5wdXQgKTtcblx0XHRcdFx0XHRcdGlmKCAhaW5wdXRWYWxpZCApIHtcblx0XHRcdFx0XHRcdFx0QXBwLlV0aWxzLkZvcm1IZWxwZXIuYWRkRXJyb3IoICRpbnB1dCwgZW1haWxFcnJvckxhYmVsICk7XG5cdFx0XHRcdFx0XHRcdGludmFsaWRJbnB1dHMucHVzaCggJGlucHV0ICk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRBcHAuVXRpbHMuRm9ybUhlbHBlci5yZW1vdmVFcnJvciggJGlucHV0ICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly9jaGVjayBmb3IgY2hlY2tib3hcblx0XHRcdFx0XHRpZiggJGlucHV0Lmhhc0NsYXNzKCBcInJlcXVpcmVkLWNoZWNrYm94XCIgKSApIHtcblxuXHRcdFx0XHRcdFx0aW5wdXRWYWxpZCA9IEZvcm1IZWxwZXIudmFsaWRhdGVDaGVja2JveCggJGlucHV0ICk7XG5cdFx0XHRcdFx0XHRpZiggIWlucHV0VmFsaWQgKSB7XG5cdFx0XHRcdFx0XHRcdEFwcC5VdGlscy5Gb3JtSGVscGVyLmFkZEVycm9yKCAkaW5wdXQsIG1pc3NpbmdFcnJvckxhYmVsICk7XG5cdFx0XHRcdFx0XHRcdGludmFsaWRJbnB1dHMucHVzaCggJGlucHV0ICk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRBcHAuVXRpbHMuRm9ybUhlbHBlci5yZW1vdmVFcnJvciggJGlucHV0ICk7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0fVxuXHRcblx0XHRcdH0gKTtcblxuXHRcdH1cblxuXG5cdFx0aWYoIGludmFsaWRJbnB1dHMubGVuZ3RoICkge1xuXG5cdFx0XHQvL3Rha2UgZmlyc3QgZWxlbWVudCBhbmQgc2Nyb2xsIHRvIGl0XG5cdFx0XHR2YXIgJGZpcnN0SW52YWxpZElucHV0ID0gaW52YWxpZElucHV0c1swXTtcblx0XHRcdCQoJ2h0bWwsIGJvZHknKS5hbmltYXRlKCB7XG5cdFx0XHRcdHNjcm9sbFRvcDogJGZpcnN0SW52YWxpZElucHV0Lm9mZnNldCgpLnRvcCAtIDI1XG5cdFx0XHR9LCAyNTApO1xuXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTsgXG5cblx0fTtcblxuXHRBcHAuVXRpbHMuRm9ybUhlbHBlci52YWxpZGF0ZVJlcXVpcmVkRmllbGQgPSBmdW5jdGlvbiggJGlucHV0ICkge1xuXG5cdFx0cmV0dXJuICggJGlucHV0LnZhbCgpID09PSBcIlwiICkgPyBmYWxzZSA6IHRydWU7XG5cblx0fTtcblxuXHRBcHAuVXRpbHMuRm9ybUhlbHBlci52YWxpZGF0ZUVtYWlsRmllbGQgPSBmdW5jdGlvbiggJGlucHV0ICkge1xuXG5cdFx0dmFyIGVtYWlsID0gJGlucHV0LnZhbCgpO1xuXHRcdHZhciByZWdleCA9IC9eKFtcXHctXFwuXStAKFtcXHctXStcXC4pK1tcXHctXXsyLDZ9KT8kLztcblx0XHRyZXR1cm4gcmVnZXgudGVzdCggZW1haWwgKTtcblxuXHR9O1xuXG5cdEFwcC5VdGlscy5Gb3JtSGVscGVyLnZhbGlkYXRlTnVtYmVyRmllbGQgPSBmdW5jdGlvbiggJGlucHV0ICkge1xuXG5cdFx0cmV0dXJuICggaXNOYU4oICRpbnB1dC52YWwoKSApICkgPyBmYWxzZSA6IHRydWU7XG5cblx0fTtcblxuXHRBcHAuVXRpbHMuRm9ybUhlbHBlci52YWxpZGF0ZUNoZWNrYm94ID0gZnVuY3Rpb24oICRpbnB1dCApIHtcblxuXHRcdHJldHVybiAoICRpbnB1dC5pcygnOmNoZWNrZWQnKSApID8gdHJ1ZSA6IGZhbHNlO1xuXG5cdH07XG5cblxuXHRBcHAuVXRpbHMuRm9ybUhlbHBlci5hZGRFcnJvciA9IGZ1bmN0aW9uKCAkZWwsICRtc2cgKSB7XG5cblx0XHRpZiggJGVsICkge1xuXHRcdFx0aWYoICEkZWwuaGFzQ2xhc3MoIFwiZXJyb3JcIiApICkge1xuXHRcdFx0XHQkZWwuYWRkQ2xhc3MoIFwiZXJyb3JcIiApO1xuXHRcdFx0XHQkZWwuYmVmb3JlKCBcIjxwIGNsYXNzPSdlcnJvci1sYWJlbCc+XCIgKyAkbXNnICsgXCI8L3A+XCIgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0fTtcblxuXHRBcHAuVXRpbHMuRm9ybUhlbHBlci5yZW1vdmVFcnJvciA9IGZ1bmN0aW9uKCAkZWwgKSB7XG5cblx0XHRpZiggJGVsICkge1xuXHRcdFx0JGVsLnJlbW92ZUNsYXNzKCBcImVycm9yXCIgKTtcblx0XHRcdHZhciAkcGFyZW50ID0gJGVsLnBhcmVudCgpO1xuXHRcdFx0dmFyICRlcnJvckxhYmVsID0gJHBhcmVudC5maW5kKCBcIi5lcnJvci1sYWJlbFwiICk7XG5cdFx0XHRpZiggJGVycm9yTGFiZWwubGVuZ3RoICkge1xuXHRcdFx0XHQkZXJyb3JMYWJlbC5yZW1vdmUoKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0XG5cdH07XG5cblx0QXBwLlV0aWxzLndyYXAgPSBmdW5jdGlvbiggJGVsLCB3aWR0aCApIHtcblx0XHRcblx0XHQvL2dldCByaWQgb2YgcG90ZW50aWFsIHRzcGFucyBhbmQgZ2V0IHB1cmUgY29udGVudCAoaW5jbHVkaW5nIGh5cGVybGlua3MpXG5cdFx0dmFyIHRleHRDb250ZW50ID0gXCJcIixcblx0XHRcdCR0c3BhbnMgPSAkZWwuZmluZCggXCJ0c3BhblwiICk7XG5cdFx0aWYoICR0c3BhbnMubGVuZ3RoICkge1xuXHRcdFx0JC5lYWNoKCAkdHNwYW5zLCBmdW5jdGlvbiggaSwgdiApIHtcblx0XHRcdFx0aWYoIGkgPiAwICkge1xuXHRcdFx0XHRcdHRleHRDb250ZW50ICs9IFwiIFwiO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRleHRDb250ZW50ICs9ICQodikudGV4dCgpO1xuXHRcdFx0fSApO1x0XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vZWxlbWVudCBoYXMgbm8gdHNwYW5zLCBwb3NzaWJseSBmaXJzdCBydW5cblx0XHRcdHRleHRDb250ZW50ID0gJGVsLnRleHQoKTtcblx0XHR9XG5cdFx0XG5cdFx0Ly9hcHBlbmQgdG8gZWxlbWVudFxuXHRcdGlmKCB0ZXh0Q29udGVudCApIHtcblx0XHRcdCRlbC50ZXh0KCB0ZXh0Q29udGVudCApO1xuXHRcdH1cblx0XHRcblx0XHR2YXIgdGV4dCA9IGQzLnNlbGVjdCggJGVsLnNlbGVjdG9yICk7XG5cdFx0dGV4dC5lYWNoKCBmdW5jdGlvbigpIHtcblx0XHRcdHZhciB0ZXh0ID0gZDMuc2VsZWN0KHRoaXMpLFxuXHRcdFx0XHRyZWdleCA9IC9cXHMrLyxcblx0XHRcdFx0d29yZHMgPSB0ZXh0LnRleHQoKS5zcGxpdChyZWdleCkucmV2ZXJzZSgpO1xuXG5cdFx0XHR2YXIgd29yZCxcblx0XHRcdFx0bGluZSA9IFtdLFxuXHRcdFx0XHRsaW5lTnVtYmVyID0gMCxcblx0XHRcdFx0bGluZUhlaWdodCA9IDEuNCwgLy8gZW1zXG5cdFx0XHRcdHkgPSB0ZXh0LmF0dHIoXCJ5XCIpLFxuXHRcdFx0XHRkeSA9IHBhcnNlRmxvYXQodGV4dC5hdHRyKFwiZHlcIikpLFxuXHRcdFx0XHR0c3BhbiA9IHRleHQudGV4dChudWxsKS5hcHBlbmQoXCJ0c3BhblwiKS5hdHRyKFwieFwiLCAwKS5hdHRyKFwieVwiLCB5KS5hdHRyKFwiZHlcIiwgZHkgKyBcImVtXCIpO1xuXHRcdFx0XG5cdFx0XHR3aGlsZSggd29yZCA9IHdvcmRzLnBvcCgpICkge1xuXHRcdFx0XHRsaW5lLnB1c2god29yZCk7XG5cdFx0XHRcdHRzcGFuLmh0bWwobGluZS5qb2luKFwiIFwiKSk7XG5cdFx0XHRcdGlmKCB0c3Bhbi5ub2RlKCkuZ2V0Q29tcHV0ZWRUZXh0TGVuZ3RoKCkgPiB3aWR0aCApIHtcblx0XHRcdFx0XHRsaW5lLnBvcCgpO1xuXHRcdFx0XHRcdHRzcGFuLnRleHQobGluZS5qb2luKFwiIFwiKSk7XG5cdFx0XHRcdFx0bGluZSA9IFt3b3JkXTtcblx0XHRcdFx0XHR0c3BhbiA9IHRleHQuYXBwZW5kKFwidHNwYW5cIikuYXR0cihcInhcIiwgMCkuYXR0cihcInlcIiwgeSkuYXR0cihcImR5XCIsICsrbGluZU51bWJlciAqIGxpbmVIZWlnaHQgKyBkeSArIFwiZW1cIikudGV4dCh3b3JkKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0fSApO1xuXG5cdFx0XG5cdH07XG5cblx0LyoqXG5cdCogQ29udmVydCBhIHN0cmluZyB0byBIVE1MIGVudGl0aWVzXG5cdCovXG5cdEFwcC5VdGlscy50b0h0bWxFbnRpdGllcyA9IGZ1bmN0aW9uKHN0cmluZykge1xuXHRcdHJldHVybiBzdHJpbmcucmVwbGFjZSgvLi9nbSwgZnVuY3Rpb24ocykge1xuXHRcdFx0cmV0dXJuIFwiJiNcIiArIHMuY2hhckNvZGVBdCgwKSArIFwiO1wiO1xuXHRcdH0pO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDcmVhdGUgc3RyaW5nIGZyb20gSFRNTCBlbnRpdGllc1xuXHQgKi9cblx0QXBwLlV0aWxzLmZyb21IdG1sRW50aXRpZXMgPSBmdW5jdGlvbihzdHJpbmcpIHtcblx0XHRyZXR1cm4gKHN0cmluZytcIlwiKS5yZXBsYWNlKC8mI1xcZCs7L2dtLGZ1bmN0aW9uKHMpIHtcblx0XHRcdHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKHMubWF0Y2goL1xcZCsvZ20pWzBdKTtcblx0XHR9KVxuXHR9O1xuXG5cdEFwcC5VdGlscy5nZXRSYW5kb21Db2xvciA9IGZ1bmN0aW9uICgpIHtcblx0XHR2YXIgbGV0dGVycyA9ICcwMTIzNDU2Nzg5QUJDREVGJy5zcGxpdCgnJyk7XG5cdFx0dmFyIGNvbG9yID0gJyMnO1xuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgNjsgaSsrICkge1xuXHRcdFx0Y29sb3IgKz0gbGV0dGVyc1tNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAxNildO1xuXHRcdH1cblx0XHRyZXR1cm4gY29sb3I7XG5cdH07XG5cblx0QXBwLlV0aWxzLmdldFByb3BlcnR5QnlWYXJpYWJsZUlkID0gZnVuY3Rpb24oIG1vZGVsLCB2YXJpYWJsZUlkICkge1xuXG5cdFx0aWYoIG1vZGVsICYmIG1vZGVsLmdldCggXCJjaGFydC1kaW1lbnNpb25zXCIgKSApIHtcblxuXHRcdFx0dmFyIGNoYXJ0RGltZW5zaW9uc1N0cmluZyA9IG1vZGVsLmdldCggXCJjaGFydC1kaW1lbnNpb25zXCIgKSxcblx0XHRcdFx0Y2hhcnREaW1lbnNpb25zID0gJC5wYXJzZUpTT04oIGNoYXJ0RGltZW5zaW9uc1N0cmluZyApLFxuXHRcdFx0XHRkaW1lbnNpb24gPSBfLndoZXJlKCBjaGFydERpbWVuc2lvbnMsIHsgXCJ2YXJpYWJsZUlkXCI6IHZhcmlhYmxlSWQgfSApO1xuXHRcdFx0aWYoIGRpbWVuc2lvbiAmJiBkaW1lbnNpb24ubGVuZ3RoICkge1xuXHRcdFx0XHRyZXR1cm4gZGltZW5zaW9uWzBdLnByb3BlcnR5O1xuXHRcdFx0fVxuXG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFxuXHR9O1xuXG5cblx0QXBwLlV0aWxzLmNvbnRlbnRHZW5lcmF0b3IgPSBmdW5jdGlvbiggZGF0YSwgaXNNYXBQb3B1cCApIHtcblx0XHRcdFxuXHRcdC8vc2V0IHBvcHVwXG5cdFx0dmFyIHVuaXRzU3RyaW5nID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcInVuaXRzXCIgKSxcblx0XHRcdGNoYXJ0VHlwZSA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10eXBlXCIgKSxcblx0XHRcdHVuaXRzID0gKCAhJC5pc0VtcHR5T2JqZWN0KCB1bml0c1N0cmluZyApICk/ICQucGFyc2VKU09OKCB1bml0c1N0cmluZyApOiB7fSxcblx0XHRcdHN0cmluZyA9IFwiXCIsXG5cdFx0XHR2YWx1ZXNTdHJpbmcgPSBcIlwiO1xuXG5cdFx0Ly9maW5kIHJlbGV2YW50IHZhbHVlcyBmb3IgcG9wdXAgYW5kIGRpc3BsYXkgdGhlbVxuXHRcdHZhciBzZXJpZXMgPSBkYXRhLnNlcmllcywga2V5ID0gXCJcIiwgdGltZVN0cmluZyA9IFwiXCI7XG5cdFx0aWYoIHNlcmllcyAmJiBzZXJpZXMubGVuZ3RoICkge1xuXHRcdFx0XG5cdFx0XHR2YXIgc2VyaWUgPSBzZXJpZXNbIDAgXTtcblx0XHRcdGtleSA9IHNlcmllLmtleTtcblx0XHRcdFxuXHRcdFx0Ly9nZXQgc291cmNlIG9mIGluZm9ybWF0aW9uXG5cdFx0XHR2YXIgcG9pbnQgPSBkYXRhLnBvaW50O1xuXHRcdFx0Ly9iZWdpbiBjb21wb3N0aW5nIHN0cmluZ1xuXHRcdFx0c3RyaW5nID0gXCI8aDM+XCIgKyBrZXkgKyBcIjwvaDM+PHA+XCI7XG5cdFx0XHR2YWx1ZXNTdHJpbmcgPSBcIlwiO1xuXG5cdFx0XHRpZiggIWlzTWFwUG9wdXAgJiYgKCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdHlwZVwiICkgPT09IFwiNFwiIHx8IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10eXBlXCIgKSA9PT0gXCI1XCIgfHwgQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LXR5cGVcIiApID09PSBcIjZcIiApICkge1xuXHRcdFx0XHQvL211bHRpYmFyY2hhcnQgaGFzIHZhbHVlcyBpbiBkaWZmZXJlbnQgZm9ybWF0XG5cdFx0XHRcdHBvaW50ID0geyBcInlcIjogc2VyaWUudmFsdWUsIFwidGltZVwiOiBkYXRhLmRhdGEudGltZSB9O1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHQkLmVhY2goIHBvaW50LCBmdW5jdGlvbiggaSwgdiApIHtcblx0XHRcdFx0Ly9mb3IgZWFjaCBkYXRhIHBvaW50LCBmaW5kIGFwcHJvcHJpYXRlIHVuaXQsIGFuZCBpZiB3ZSBoYXZlIGl0LCBkaXNwbGF5IGl0XG5cdFx0XHRcdHZhciB1bml0ID0gXy5maW5kV2hlcmUoIHVuaXRzLCB7IHByb3BlcnR5OiBpIH0gKSxcblx0XHRcdFx0XHR2YWx1ZSA9IHYsXG5cdFx0XHRcdFx0aXNIaWRkZW4gPSAoIHVuaXQgJiYgdW5pdC5oYXNPd25Qcm9wZXJ0eSggXCJ2aXNpYmxlXCIgKSAmJiAhdW5pdC52aXNpYmxlICk/IHRydWU6IGZhbHNlO1xuXG5cdFx0XHRcdC8vZm9ybWF0IG51bWJlclxuXHRcdFx0XHRpZiggdW5pdCAmJiAhaXNOYU4oIHVuaXQuZm9ybWF0ICkgJiYgdW5pdC5mb3JtYXQgPj0gMCApIHtcblx0XHRcdFx0XHQvL2ZpeGVkIGZvcm1hdFxuXHRcdFx0XHRcdHZhciBmaXhlZCA9IE1hdGgubWluKCAyMCwgcGFyc2VJbnQoIHVuaXQuZm9ybWF0LCAxMCApICk7XG5cdFx0XHRcdFx0dmFsdWUgPSBkMy5mb3JtYXQoIFwiLC5cIiArIGZpeGVkICsgXCJmXCIgKSggdmFsdWUgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvL2FkZCB0aG91c2FuZHMgc2VwYXJhdG9yXG5cdFx0XHRcdFx0dmFsdWUgPSBkMy5mb3JtYXQoIFwiLFwiICkoIHZhbHVlICk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiggdW5pdCApIHtcblx0XHRcdFx0XHRpZiggIWlzSGlkZGVuICkge1xuXHRcdFx0XHRcdFx0Ly90cnkgdG8gZm9ybWF0IG51bWJlclxuXHRcdFx0XHRcdFx0Ly9zY2F0dGVyIHBsb3QgaGFzIHZhbHVlcyBkaXNwbGF5ZWQgaW4gc2VwYXJhdGUgcm93c1xuXHRcdFx0XHRcdFx0aWYoIHZhbHVlc1N0cmluZyAhPT0gXCJcIiAmJiBjaGFydFR5cGUgIT0gMiApIHtcblx0XHRcdFx0XHRcdFx0dmFsdWVzU3RyaW5nICs9IFwiLCBcIjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmKCBjaGFydFR5cGUgPT0gMiApIHtcblx0XHRcdFx0XHRcdFx0dmFsdWVzU3RyaW5nICs9IFwiPHNwYW4gY2xhc3M9J3Zhci1wb3B1cC12YWx1ZSc+XCI7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR2YWx1ZXNTdHJpbmcgKz0gdmFsdWUgKyBcIiBcIiArIHVuaXQudW5pdDtcblx0XHRcdFx0XHRcdGlmKCBjaGFydFR5cGUgPT0gMiApIHtcblx0XHRcdFx0XHRcdFx0dmFsdWVzU3RyaW5nICs9IFwiPC9zcGFuPlwiO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIGlmKCBpID09PSBcInRpbWVcIiApIHtcblx0XHRcdFx0XHR0aW1lU3RyaW5nID0gdjtcblx0XHRcdFx0fSBlbHNlIGlmKCBpICE9PSBcImNvbG9yXCIgJiYgaSAhPT0gXCJzZXJpZXNcIiAmJiAoIGkgIT09IFwieFwiIHx8IGNoYXJ0VHlwZSAhPSAxICkgKSB7XG5cdFx0XHRcdFx0aWYoICFpc0hpZGRlbiApIHtcblx0XHRcdFx0XHRcdGlmKCB2YWx1ZXNTdHJpbmcgIT09IFwiXCIgJiYgY2hhcnRUeXBlICE9IDIgKSB7XG5cdFx0XHRcdFx0XHRcdHZhbHVlc1N0cmluZyArPSBcIiwgXCI7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiggY2hhcnRUeXBlID09IDIgKSB7XG5cdFx0XHRcdFx0XHRcdHZhbHVlc1N0cmluZyArPSBcIjxzcGFuIGNsYXNzPSd2YXItcG9wdXAtdmFsdWUnPlwiO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Ly9qdXN0IGFkZCBwbGFpbiB2YWx1ZSwgb21pdGluZyB4IHZhbHVlIGZvciBsaW5lY2hhcnRcblx0XHRcdFx0XHRcdHZhbHVlc1N0cmluZyArPSB2YWx1ZTtcblx0XHRcdFx0XHRcdGlmKCBjaGFydFR5cGUgPT0gMiApIHtcblx0XHRcdFx0XHRcdFx0dmFsdWVzU3RyaW5nICs9IFwiPC9zcGFuPlwiO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXG5cdFx0XHRpZiggaXNNYXBQb3B1cCB8fCAoIHRpbWVTdHJpbmcgJiYgY2hhcnRUeXBlICE9IDIgKSApIHtcblx0XHRcdFx0dmFsdWVzU3RyaW5nICs9IFwiIDxiciAvPiBpbiA8YnIgLz4gXCIgKyB0aW1lU3RyaW5nO1xuXHRcdFx0fSBlbHNlIGlmKCB0aW1lU3RyaW5nICYmIGNoYXJ0VHlwZSA9PSAyICkge1xuXHRcdFx0XHR2YWx1ZXNTdHJpbmcgKz0gXCI8c3BhbiBjbGFzcz0ndmFyLXBvcHVwLXZhbHVlJz5pbiBcIiArIHRpbWVTdHJpbmcgKyBcIjwvc3Bhbj5cIjtcblx0XHRcdH1cblx0XHRcdHN0cmluZyArPSB2YWx1ZXNTdHJpbmc7XG5cdFx0XHRzdHJpbmcgKz0gXCI8L3A+XCI7XG5cblx0XHR9XG5cblx0XHRyZXR1cm4gc3RyaW5nO1xuXG5cdH07XG5cblxuXHRBcHAuVXRpbHMuZm9ybWF0VGltZUxhYmVsID0gZnVuY3Rpb24oIHR5cGUsIGQsIHhBeGlzUHJlZml4LCB4QXhpc1N1ZmZpeCwgZm9ybWF0ICkge1xuXHRcdC8vZGVwZW5kaW5nIG9uIHR5cGUgZm9ybWF0IGxhYmVsXG5cdFx0dmFyIGxhYmVsO1xuXHRcdHN3aXRjaCggdHlwZSApIHtcblx0XHRcdFxuXHRcdFx0Y2FzZSBcIkRlY2FkZVwiOlxuXHRcdFx0XHRcblx0XHRcdFx0dmFyIGRlY2FkZVN0cmluZyA9IGQudG9TdHJpbmcoKTtcblx0XHRcdFx0ZGVjYWRlU3RyaW5nID0gZGVjYWRlU3RyaW5nLnN1YnN0cmluZyggMCwgZGVjYWRlU3RyaW5nLmxlbmd0aCAtIDEpO1xuXHRcdFx0XHRkZWNhZGVTdHJpbmcgPSBkZWNhZGVTdHJpbmcgKyBcIjBzXCI7XG5cdFx0XHRcdGxhYmVsID0gZGVjYWRlU3RyaW5nO1xuXG5cdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRjYXNlIFwiUXVhcnRlciBDZW50dXJ5XCI6XG5cdFx0XHRcdFxuXHRcdFx0XHR2YXIgcXVhcnRlclN0cmluZyA9IFwiXCIsXG5cdFx0XHRcdFx0cXVhcnRlciA9IGQgJSAxMDA7XG5cdFx0XHRcdFxuXHRcdFx0XHRpZiggcXVhcnRlciA8IDI1ICkge1xuXHRcdFx0XHRcdHF1YXJ0ZXJTdHJpbmcgPSBcIjFzdCBxdWFydGVyIG9mIHRoZVwiO1xuXHRcdFx0XHR9IGVsc2UgaWYoIHF1YXJ0ZXIgPCA1MCApIHtcblx0XHRcdFx0XHRxdWFydGVyU3RyaW5nID0gXCJoYWxmIG9mIHRoZVwiO1xuXHRcdFx0XHR9IGVsc2UgaWYoIHF1YXJ0ZXIgPCA3NSApIHtcblx0XHRcdFx0XHRxdWFydGVyU3RyaW5nID0gXCIzcmQgcXVhcnRlciBvZiB0aGVcIjtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRxdWFydGVyU3RyaW5nID0gXCI0dGggcXVhcnRlciBvZiB0aGVcIjtcblx0XHRcdFx0fVxuXHRcdFx0XHRcdFxuXHRcdFx0XHR2YXIgY2VudHVyeVN0cmluZyA9IEFwcC5VdGlscy5jZW50dXJ5U3RyaW5nKCBkICk7XG5cblx0XHRcdFx0bGFiZWwgPSBxdWFydGVyU3RyaW5nICsgXCIgXCIgKyBjZW50dXJ5U3RyaW5nO1xuXG5cdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRjYXNlIFwiSGFsZiBDZW50dXJ5XCI6XG5cdFx0XHRcdFxuXHRcdFx0XHR2YXIgaGFsZlN0cmluZyA9IFwiXCIsXG5cdFx0XHRcdFx0aGFsZiA9IGQgJSAxMDA7XG5cdFx0XHRcdFxuXHRcdFx0XHRpZiggaGFsZiA8IDUwICkge1xuXHRcdFx0XHRcdGhhbGZTdHJpbmcgPSBcIjFzdCBoYWxmIG9mIHRoZVwiO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGhhbGZTdHJpbmcgPSBcIjJuZCBoYWxmIG9mIHRoZVwiO1xuXHRcdFx0XHR9XG5cdFx0XHRcdFx0XG5cdFx0XHRcdHZhciBjZW50dXJ5U3RyaW5nID0gQXBwLlV0aWxzLmNlbnR1cnlTdHJpbmcoIGQgKTtcblxuXHRcdFx0XHRsYWJlbCA9IGhhbGZTdHJpbmcgKyBcIiBcIiArIGNlbnR1cnlTdHJpbmc7XG5cblx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdGNhc2UgXCJDZW50dXJ5XCI6XG5cdFx0XHRcdFxuXHRcdFx0XHRsYWJlbCA9IEFwcC5VdGlscy5jZW50dXJ5U3RyaW5nKCBkICk7XG5cblx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdGRlZmF1bHQ6XG5cblx0XHRcdFx0bGFiZWwgPSBBcHAuVXRpbHMuZm9ybWF0VmFsdWUoIGQsIGZvcm1hdCApO1xuXHRcdFx0XHRcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXHRcdHJldHVybiB4QXhpc1ByZWZpeCArIGxhYmVsICsgeEF4aXNTdWZmaXg7XG5cdH07XG5cblx0QXBwLlV0aWxzLmlubGluZUNzc1N0eWxlID0gZnVuY3Rpb24oIHJ1bGVzICkge1xuXHRcdC8vaHR0cDovL2RldmludG9yci5lcy9ibG9nLzIwMTAvMDUvMjYvdHVybi1jc3MtcnVsZXMtaW50by1pbmxpbmUtc3R5bGUtYXR0cmlidXRlcy11c2luZy1qcXVlcnkvXG5cdFx0Zm9yICh2YXIgaWR4ID0gMCwgbGVuID0gcnVsZXMubGVuZ3RoOyBpZHggPCBsZW47IGlkeCsrKSB7XG5cdFx0XHQkKHJ1bGVzW2lkeF0uc2VsZWN0b3JUZXh0KS5lYWNoKGZ1bmN0aW9uIChpLCBlbGVtKSB7XG5cdFx0XHRcdGVsZW0uc3R5bGUuY3NzVGV4dCArPSBydWxlc1tpZHhdLnN0eWxlLmNzc1RleHQ7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH07XG5cblx0QXBwLlV0aWxzLmNoZWNrVmFsaWREaW1lbnNpb25zID0gZnVuY3Rpb24oIGRpbWVuc2lvbnMsIGNoYXJ0VHlwZSApIHtcblx0XHRcdFxuXHRcdHZhciB2YWxpZERpbWVuc2lvbnMgPSBmYWxzZSxcblx0XHRcdHhEaW1lbnNpb24sIHlEaW1lbnNpb247XG5cdFx0XG5cdFx0c3dpdGNoKCBjaGFydFR5cGUgKSB7XG5cdFx0XHRjYXNlIFwiMVwiOlxuXHRcdFx0Y2FzZSBcIjRcIjpcblx0XHRcdGNhc2UgXCI1XCI6XG5cdFx0XHRjYXNlIFwiNlwiOlxuXHRcdFx0XHQvL2NoZWNrIHRoYXQgZGltZW5zaW9ucyBoYXZlIHkgcHJvcGVydHlcblx0XHRcdFx0eURpbWVuc2lvbiA9IF8uZmluZCggZGltZW5zaW9ucywgZnVuY3Rpb24oIGRpbWVuc2lvbiApIHtcblx0XHRcdFx0XHRyZXR1cm4gZGltZW5zaW9uLnByb3BlcnR5ID09PSBcInlcIjtcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRpZiggeURpbWVuc2lvbiApIHtcblx0XHRcdFx0XHR2YWxpZERpbWVuc2lvbnMgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBcIjJcIjpcblx0XHRcdFx0Ly9jaGVjayB0aGF0IGRpbWVuc2lvbnMgaGF2ZSB4IHByb3BlcnR5XG5cdFx0XHRcdHhEaW1lbnNpb24gPSBfLmZpbmQoIGRpbWVuc2lvbnMsIGZ1bmN0aW9uKCBkaW1lbnNpb24gKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGRpbWVuc2lvbi5wcm9wZXJ0eSA9PT0gXCJ4XCI7XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0eURpbWVuc2lvbiA9IF8uZmluZCggZGltZW5zaW9ucywgZnVuY3Rpb24oIGRpbWVuc2lvbiApIHtcblx0XHRcdFx0XHRyZXR1cm4gZGltZW5zaW9uLnByb3BlcnR5ID09PSBcInlcIjtcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRpZiggeERpbWVuc2lvbiAmJiB5RGltZW5zaW9uICkge1xuXHRcdFx0XHRcdHZhbGlkRGltZW5zaW9ucyA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFwiM1wiOlxuXHRcdFx0XHQvL2NoZWNrIHRoYXQgZGltZW5zaW9ucyBoYXZlIHkgcHJvcGVydHlcblx0XHRcdFx0eURpbWVuc2lvbiA9IF8uZmluZCggZGltZW5zaW9ucywgZnVuY3Rpb24oIGRpbWVuc2lvbiApIHtcblx0XHRcdFx0XHRyZXR1cm4gZGltZW5zaW9uLnByb3BlcnR5ID09PSBcInlcIjtcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRpZiggeURpbWVuc2lvbiApIHtcblx0XHRcdFx0XHR2YWxpZERpbWVuc2lvbnMgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblx0XHRyZXR1cm4gdmFsaWREaW1lbnNpb25zO1xuXG5cdH07XG5cblx0QXBwLlV0aWxzLmZvcm1hdFZhbHVlID0gZnVuY3Rpb24oIHZhbHVlLCBmb3JtYXQgKSB7XG5cdFx0Ly9tYWtlIHN1cmUgd2UgZG8gdGhpcyBvbiBudW1iZXJcblx0XHRpZiggdmFsdWUgJiYgIWlzTmFOKCB2YWx1ZSApICkge1xuXHRcdFx0aWYoIGZvcm1hdCAmJiAhaXNOYU4oIGZvcm1hdCApICkge1xuXHRcdFx0XHR2YXIgZml4ZWQgPSBNYXRoLm1pbiggMjAsIHBhcnNlSW50KCBmb3JtYXQsIDEwICkgKTtcblx0XHRcdFx0dmFsdWUgPSB2YWx1ZS50b0ZpeGVkKCBmaXhlZCApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly9ubyBmb3JtYXQgXG5cdFx0XHRcdHZhbHVlID0gdmFsdWUudG9TdHJpbmcoKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHZhbHVlO1xuXHR9O1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlV0aWxzO1xuXHRcbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgTWFpbiA9IHJlcXVpcmUoIFwiLi92aWV3cy9BcHAuVmlld3MuTWFpbi5qc1wiICksXG5cdFx0Q2hhcnREYXRhTW9kZWwgPSByZXF1aXJlKCBcIi4vbW9kZWxzL0FwcC5Nb2RlbHMuQ2hhcnREYXRhTW9kZWwuanNcIiApO1xuXG5cdC8vc2V0dXAgbW9kZWxzXG5cdC8vaXMgbmV3IGNoYXJ0IG9yIGRpc3BsYXkgb2xkIGNoYXJ0XG5cdHZhciAkY2hhcnRTaG93V3JhcHBlciA9ICQoIFwiLmNoYXJ0LXNob3ctd3JhcHBlciwgLmNoYXJ0LWVkaXQtd3JhcHBlclwiICksXG5cdFx0Y2hhcnRJZCA9ICRjaGFydFNob3dXcmFwcGVyLmF0dHIoIFwiZGF0YS1jaGFydC1pZFwiICk7XG5cblx0Ly9zZXR1cCB2aWV3c1xuXHRBcHAuVmlldyA9IG5ldyBNYWluKCk7XG5cblx0aWYoICRjaGFydFNob3dXcmFwcGVyLmxlbmd0aCAmJiBjaGFydElkICkge1xuXHRcdFxuXHRcdC8vc2hvd2luZyBleGlzdGluZyBjaGFydFxuXHRcdEFwcC5DaGFydE1vZGVsID0gbmV3IEFwcC5Nb2RlbHMuQ2hhcnRNb2RlbCggeyBpZDogY2hhcnRJZCB9ICk7XG5cdFx0QXBwLkNoYXJ0TW9kZWwuZmV0Y2goIHtcblx0XHRcdHN1Y2Nlc3M6IGZ1bmN0aW9uKCBkYXRhICkge1xuXHRcdFx0XHRBcHAuVmlldy5zdGFydCgpO1xuXHRcdFx0fSxcblx0XHRcdGVycm9yOiBmdW5jdGlvbiggeGhyICkge1xuXHRcdFx0XHRjb25zb2xlLmVycm9yKCBcIkVycm9yIGxvYWRpbmcgY2hhcnQgbW9kZWxcIiwgeGhyICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHRcdC8vZmluZCBvdXQgaWYgaXQncyBpbiBjYWNoZVxuXHRcdGlmKCAhJCggXCIuc3RhbmRhbG9uZS1jaGFydC12aWV3ZXJcIiApLmxlbmd0aCApIHtcblx0XHRcdC8vZGlzYWJsZSBjYWNoaW5nIGZvciB2aWV3aW5nIHdpdGhpbiBhZG1pblxuXHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0KCBcImNhY2hlXCIsIGZhbHNlICk7XG5cdFx0fVxuXHRcdFxuXHR9IGVsc2Uge1xuXG5cdFx0Ly9pcyBuZXcgY2hhcnRcblx0XHRBcHAuQ2hhcnRNb2RlbCA9IG5ldyBBcHAuTW9kZWxzLkNoYXJ0TW9kZWwoKTtcblx0XHRBcHAuVmlldy5zdGFydCgpO1xuXG5cdH1cblxuXHRcblx0XG5cbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdEFwcC5Nb2RlbHMuQ2hhcnREYXRhTW9kZWwgPSBCYWNrYm9uZS5Nb2RlbC5leHRlbmQoIHtcblxuXHRcdGRlZmF1bHRzOiB7fSxcblxuXHRcdHVybFJvb3Q6IEdsb2JhbC5yb290VXJsICsgXCIvZGF0YS9kaW1lbnNpb25zXCIsXG5cdFx0XG5cdFx0Lyp1cmw6IGZ1bmN0aW9uKCl7XG5cblx0XHRcdHZhciBhdHRycyA9IHRoaXMuYXR0cmlidXRlcyxcblx0XHRcdFx0dXJsID0gdGhpcy51cmxSb290ICsgXCI/XCI7XG5cblx0XHRcdC8vYWRkIGFsbCBhdHRyaWJ1dGVzIHRvIHVybFxuXHRcdFx0Xy5lYWNoKCBhdHRycywgZnVuY3Rpb24oIHYsIGkgKSB7XG5cdFx0XHRcdHVybCArPSBpICsgXCI9XCIgKyB2O1xuXHRcdFx0XHR1cmwgKz0gXCImXCI7XG5cdFx0XHR9ICk7XG5cblx0XHRcdHJldHVybiB1cmw7XG5cblx0XHR9LCovXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiAoKSB7XG5cblx0XHR9LFxuXG5cdH0gKTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5Nb2RlbHMuQ2hhcnREYXRhTW9kZWw7XG5cbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdEFwcC5Nb2RlbHMuQ2hhcnRNb2RlbCA9IEJhY2tib25lLk1vZGVsLmV4dGVuZCgge1xuXG5cdFx0Ly91cmxSb290OiBHbG9iYWwucm9vdFVybCArICcvY2hhcnRzLycsXG5cdFx0Ly91cmxSb290OiBHbG9iYWwucm9vdFVybCArICcvZGF0YS9jb25maWcvJyxcblx0XHR1cmw6IGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYoICQoXCIjZm9ybS12aWV3XCIpLmxlbmd0aCApIHtcblx0XHRcdFx0aWYoIHRoaXMuaWQgKSB7XG5cdFx0XHRcdFx0Ly9lZGl0aW5nIGV4aXN0aW5nXG5cdFx0XHRcdFx0cmV0dXJuIEdsb2JhbC5yb290VXJsICsgXCIvY2hhcnRzL1wiICsgdGhpcy5pZDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvL3NhdmluZyBuZXdcblx0XHRcdFx0XHRyZXR1cm4gR2xvYmFsLnJvb3RVcmwgKyBcIi9jaGFydHNcIjtcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiBHbG9iYWwucm9vdFVybCArIFwiL2RhdGEvY29uZmlnL1wiICsgdGhpcy5pZDtcblx0XHRcdH1cblx0XHR9LFxuXG5cdFx0ZGVmYXVsdHM6IHtcblx0XHRcdFwiY2FjaGVcIjogdHJ1ZSxcblx0XHRcdFwic2VsZWN0ZWQtY291bnRyaWVzXCI6IFtdLFxuXHRcdFx0XCJ0YWJzXCI6IFsgXCJjaGFydFwiLCBcImRhdGFcIiwgXCJzb3VyY2VzXCIgXSxcblx0XHRcdFwibGluZS10eXBlXCI6IFwiMlwiLFxuXHRcdFx0XCJjaGFydC1kZXNjcmlwdGlvblwiOiBcIlwiLFxuXHRcdFx0XCJjaGFydC1kaW1lbnNpb25zXCI6IFtdLFxuXHRcdFx0XCJ2YXJpYWJsZXNcIjogW10sXG5cdFx0XHRcInktYXhpc1wiOiB7fSxcblx0XHRcdFwieC1heGlzXCI6IHt9LFxuXHRcdFx0XCJtYXJnaW5zXCI6IHsgdG9wOiAxMCwgbGVmdDogNjAsIGJvdHRvbTogMTAsIHJpZ2h0OiAxMCB9LFxuXHRcdFx0XCJ1bml0c1wiOiBcIlwiLFxuXHRcdFx0XCJpZnJhbWUtd2lkdGhcIjogXCIxMDAlXCIsXG5cdFx0XHRcImlmcmFtZS1oZWlnaHRcIjogXCI2NjBweFwiLFxuXHRcdFx0XCJoaWRlLWxlZ2VuZFwiOiBmYWxzZSxcblx0XHRcdFwiZ3JvdXAtYnktdmFyaWFibGVzXCI6IGZhbHNlLFxuXHRcdFx0XCJhZGQtY291bnRyeS1tb2RlXCI6IFwiYWRkLWNvdW50cnlcIixcblx0XHRcdFwieC1heGlzLXNjYWxlLXNlbGVjdG9yXCI6IGZhbHNlLFxuXHRcdFx0XCJ5LWF4aXMtc2NhbGUtc2VsZWN0b3JcIjogZmFsc2UsXG5cdFx0XHRcIm1hcC1jb25maWdcIjoge1xuXHRcdFx0XHRcInZhcmlhYmxlSWRcIjogLTEsXG5cdFx0XHRcdFwibWluWWVhclwiOiAxOTgwLFxuXHRcdFx0XHRcIm1heFllYXJcIjogMjAwMCxcblx0XHRcdFx0XCJ0YXJnZXRZZWFyXCI6IDE5ODAsXG5cdFx0XHRcdFwibW9kZVwiOiBcInNwZWNpZmljXCIsXG5cdFx0XHRcdFwidGltZVRvbGVyYW5jZVwiOiAxMCxcblx0XHRcdFx0XCJ0aW1lSW50ZXJ2YWxcIjogMTAsXG5cdFx0XHRcdFwiY29sb3JTY2hlbWVOYW1lXCI6IFwiQnVHblwiLFxuXHRcdFx0XHRcImNvbG9yU2NoZW1lSW50ZXJ2YWxcIjogNSxcblx0XHRcdFx0XCJwcm9qZWN0aW9uXCI6IFwiV29ybGRcIixcblx0XHRcdH1cblx0XHR9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oKSB7XG5cblx0XHRcdHRoaXMub24oIFwic3luY1wiLCB0aGlzLm9uU3luYywgdGhpcyApO1xuXHRcdFxuXHRcdH0sXG5cblx0XHRvblN5bmM6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHRpZiggdGhpcy5nZXQoIFwiY2hhcnQtdHlwZVwiICkgPT0gMiApIHtcblx0XHRcdFx0Ly9tYWtlIHN1cmUgZm9yIHNjYXR0ZXIgcGxvdCwgd2UgaGF2ZSBjb2xvciBzZXQgYXMgY29udGluZW50c1xuXHRcdFx0XHR2YXIgY2hhcnREaW1lbnNpb25zID0gJC5wYXJzZUpTT04oIHRoaXMuZ2V0KCBcImNoYXJ0LWRpbWVuc2lvbnNcIiApICk7XG5cdFx0XHRcdGlmKCAhXy5maW5kV2hlcmUoIGNoYXJ0RGltZW5zaW9ucywgeyBcInByb3BlcnR5XCI6IFwiY29sb3JcIiB9ICkgKSB7XG5cdFx0XHRcdFx0Ly90aGlzIGlzIHdoZXJlIHdlIGFkZCBjb2xvciBwcm9wZXJ0eVxuXHRcdFx0XHRcdHZhciBjb2xvclByb3BPYmogPSB7IFwidmFyaWFibGVJZFwiOlwiMTIzXCIsXCJwcm9wZXJ0eVwiOlwiY29sb3JcIixcInVuaXRcIjpcIlwiLFwibmFtZVwiOlwiQ29sb3JcIixcInBlcmlvZFwiOlwic2luZ2xlXCIsXCJtb2RlXCI6XCJzcGVjaWZpY1wiLFwidGFyZ2V0WWVhclwiOlwiMjAwMFwiLFwidG9sZXJhbmNlXCI6XCI1XCIsXCJtYXhpbXVtQWdlXCI6XCI1XCJ9O1xuXHRcdFx0XHRcdGNoYXJ0RGltZW5zaW9ucy5wdXNoKCBjb2xvclByb3BPYmogKTtcblx0XHRcdFx0XHR2YXIgY2hhckRpbWVuc2lvbnNTdHJpbmcgPSBKU09OLnN0cmluZ2lmeSggY2hhcnREaW1lbnNpb25zICk7XG5cdFx0XHRcdFx0dGhpcy5zZXQoIFwiY2hhcnQtZGltZW5zaW9uc1wiLCBjaGFyRGltZW5zaW9uc1N0cmluZyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRcblx0XHR9LFxuXG5cdFx0YWRkU2VsZWN0ZWRDb3VudHJ5OiBmdW5jdGlvbiggY291bnRyeSApIHtcblxuXHRcdFx0Ly9tYWtlIHN1cmUgd2UncmUgdXNpbmcgb2JqZWN0LCBub3QgYXNzb2NpYXRpdmUgYXJyYXlcblx0XHRcdC8qaWYoICQuaXNBcnJheSggdGhpcy5nZXQoIFwic2VsZWN0ZWQtY291bnRyaWVzXCIgKSApICkge1xuXHRcdFx0XHQvL3dlIGdvdCBlbXB0eSBhcnJheSBmcm9tIGRiLCBjb252ZXJ0IHRvIG9iamVjdFxuXHRcdFx0XHR0aGlzLnNldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiwge30gKTtcblx0XHRcdH0qL1xuXHRcdFx0XG5cdFx0XHR2YXIgc2VsZWN0ZWRDb3VudHJpZXMgPSB0aGlzLmdldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiApO1xuXG5cdFx0XHQvL21ha2Ugc3VyZSB0aGUgc2VsZWN0ZWQgY29udHJ5IGlzIG5vdCB0aGVyZSBcblx0XHRcdGlmKCAhXy5maW5kV2hlcmUoIHNlbGVjdGVkQ291bnRyaWVzLCB7IGlkOiBjb3VudHJ5LmlkIH0gKSApIHtcblx0XHRcdFxuXHRcdFx0XHRzZWxlY3RlZENvdW50cmllcy5wdXNoKCBjb3VudHJ5ICk7XG5cdFx0XHRcdC8vc2VsZWN0ZWRDb3VudHJpZXNbIGNvdW50cnkuaWQgXSA9IGNvdW50cnk7XG5cdFx0XHRcdHRoaXMudHJpZ2dlciggXCJjaGFuZ2U6c2VsZWN0ZWQtY291bnRyaWVzXCIgKTtcblx0XHRcdFx0dGhpcy50cmlnZ2VyKCBcImNoYW5nZVwiICk7XG5cdFx0XHRcblx0XHRcdH1cblx0XHRcdFxuXHRcdH0sXG5cblx0XHR1cGRhdGVTZWxlY3RlZENvdW50cnk6IGZ1bmN0aW9uKCBjb3VudHJ5SWQsIGNvbG9yICkge1xuXG5cdFx0XHR2YXIgY291bnRyeSA9IHRoaXMuZmluZENvdW50cnlCeUlkKCBjb3VudHJ5SWQgKTtcblx0XHRcdGlmKCBjb3VudHJ5ICkge1xuXHRcdFx0XHRjb3VudHJ5LmNvbG9yID0gY29sb3I7XG5cdFx0XHRcdHRoaXMudHJpZ2dlciggXCJjaGFuZ2U6c2VsZWN0ZWQtY291bnRyaWVzXCIgKTtcblx0XHRcdFx0dGhpcy50cmlnZ2VyKCBcImNoYW5nZVwiICk7XG5cdFx0XHR9XG5cblx0XHR9LFxuXG5cdFx0cmVtb3ZlU2VsZWN0ZWRDb3VudHJ5OiBmdW5jdGlvbiggY291bnRyeUlkICkge1xuXG5cdFx0XHR2YXIgY291bnRyeSA9IHRoaXMuZmluZENvdW50cnlCeUlkKCBjb3VudHJ5SWQgKTtcblx0XHRcdGlmKCBjb3VudHJ5ICkge1xuXHRcdFx0XHR2YXIgc2VsZWN0ZWRDb3VudHJpZXMgPSB0aGlzLmdldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiApLFxuXHRcdFx0XHRcdGNvdW50cnlJbmRleCA9IF8uaW5kZXhPZiggc2VsZWN0ZWRDb3VudHJpZXMsIGNvdW50cnkgKTtcblx0XHRcdFx0c2VsZWN0ZWRDb3VudHJpZXMuc3BsaWNlKCBjb3VudHJ5SW5kZXgsIDEgKTtcblx0XHRcdFx0dGhpcy50cmlnZ2VyKCBcImNoYW5nZTpzZWxlY3RlZC1jb3VudHJpZXNcIiApO1xuXHRcdFx0XHR0aGlzLnRyaWdnZXIoIFwiY2hhbmdlXCIgKTtcblx0XHRcdH1cblxuXHRcdH0sXG5cblx0XHRyZXBsYWNlU2VsZWN0ZWRDb3VudHJ5OiBmdW5jdGlvbiggY291bnRyeSApIHtcblx0XHRcdGlmKCBjb3VudHJ5ICkge1xuXHRcdFx0XHR0aGlzLnNldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiwgWyBjb3VudHJ5IF0gKTtcblx0XHRcdH1cblx0XHR9LFxuXG5cdFx0ZmluZENvdW50cnlCeUlkOiBmdW5jdGlvbiggY291bnRyeUlkICkge1xuXG5cdFx0XHR2YXIgc2VsZWN0ZWRDb3VudHJpZXMgPSB0aGlzLmdldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiApLFxuXHRcdFx0XHRjb3VudHJ5ID0gXy5maW5kV2hlcmUoIHNlbGVjdGVkQ291bnRyaWVzLCB7IGlkOiBjb3VudHJ5SWQudG9TdHJpbmcoKSB9ICk7XG5cdFx0XHRyZXR1cm4gY291bnRyeTtcblxuXHRcdH0sXG5cblx0XHRzZXRBeGlzQ29uZmlnOiBmdW5jdGlvbiggYXhpc05hbWUsIHByb3AsIHZhbHVlICkge1xuXG5cdFx0XHRpZiggJC5pc0FycmF5KCB0aGlzLmdldCggXCJ5LWF4aXNcIiApICkgKSB7XG5cdFx0XHRcdC8vd2UgZ290IGVtcHR5IGFycmF5IGZyb20gZGIsIGNvbnZlcnQgdG8gb2JqZWN0XG5cdFx0XHRcdHRoaXMuc2V0KCBcInktYXhpc1wiLCB7fSApO1xuXHRcdFx0fVxuXHRcdFx0aWYoICQuaXNBcnJheSggdGhpcy5nZXQoIFwieC1heGlzXCIgKSApICkge1xuXHRcdFx0XHQvL3dlIGdvdCBlbXB0eSBhcnJheSBmcm9tIGRiLCBjb252ZXJ0IHRvIG9iamVjdFxuXHRcdFx0XHR0aGlzLnNldCggXCJ4LWF4aXNcIiwge30gKTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0dmFyIGF4aXMgPSB0aGlzLmdldCggYXhpc05hbWUgKTtcblx0XHRcdGlmKCBheGlzICkge1xuXHRcdFx0XHRheGlzWyBwcm9wIF0gPSB2YWx1ZTtcblx0XHRcdH1cblx0XHRcdHRoaXMudHJpZ2dlciggXCJjaGFuZ2VcIiApO1xuXG5cdFx0fSxcblxuXHRcdHVwZGF0ZVZhcmlhYmxlczogZnVuY3Rpb24oIG5ld1ZhciApIHtcblx0XHRcdC8vY29weSBhcnJheVxuXHRcdFx0dmFyIHZhcmlhYmxlcyA9IHRoaXMuZ2V0KCBcInZhcmlhYmxlc1wiICkuc2xpY2UoKSxcblx0XHRcdFx0dmFySW5BcnIgPSBfLmZpbmQoIHZhcmlhYmxlcywgZnVuY3Rpb24oIHYgKXsgcmV0dXJuIHYuaWQgPT0gbmV3VmFyLmlkOyB9ICk7XG5cblx0XHRcdGlmKCAhdmFySW5BcnIgKSB7XG5cdFx0XHRcdHZhcmlhYmxlcy5wdXNoKCBuZXdWYXIgKTtcblx0XHRcdFx0dGhpcy5zZXQoIFwidmFyaWFibGVzXCIsIHZhcmlhYmxlcyApO1xuXHRcdFx0fVxuXHRcdH0sXG5cblx0XHRyZW1vdmVWYXJpYWJsZTogZnVuY3Rpb24oIHZhcklkVG9SZW1vdmUgKSB7XG5cdFx0XHQvL2NvcHkgYXJyYXlcblx0XHRcdHZhciB2YXJpYWJsZXMgPSB0aGlzLmdldCggXCJ2YXJpYWJsZXNcIiApLnNsaWNlKCksXG5cdFx0XHRcdHZhckluQXJyID0gXy5maW5kKCB2YXJpYWJsZXMsIGZ1bmN0aW9uKCB2ICl7IHJldHVybiB2LmlkID09IG5ld1Zhci5pZDsgfSApO1xuXG5cdFx0XHRpZiggIXZhckluQXJyICkge1xuXHRcdFx0XHR2YXJpYWJsZXMucHVzaCggbmV3VmFyICk7XG5cdFx0XHRcdHRoaXMuc2V0KCBcInZhcmlhYmxlc1wiLCB2YXJpYWJsZXMgKTtcblx0XHRcdH1cblx0XHR9LFxuXG5cdFx0dXBkYXRlTWFwQ29uZmlnOiBmdW5jdGlvbiggcHJvcE5hbWUsIHByb3BWYWx1ZSwgc2lsZW50LCBldmVudE5hbWUgKSB7XG5cblx0XHRcdHZhciBtYXBDb25maWcgPSB0aGlzLmdldCggXCJtYXAtY29uZmlnXCIgKTtcblx0XHRcdGlmKCBtYXBDb25maWcuaGFzT3duUHJvcGVydHkoIHByb3BOYW1lICkgKSB7XG5cdFx0XHRcdG1hcENvbmZpZ1sgcHJvcE5hbWUgXSA9IHByb3BWYWx1ZTtcblx0XHRcdFx0aWYoICFzaWxlbnQgKSB7XG5cdFx0XHRcdFx0dmFyIGV2dCA9ICggZXZlbnROYW1lICk/IGV2ZW50TmFtZTogXCJjaGFuZ2VcIjtcblx0XHRcdFx0XHR0aGlzLnRyaWdnZXIoIGV2dCApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHR9XG5cblxuXHR9ICk7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuTW9kZWxzLkNoYXJ0TW9kZWw7XG5cbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgSGVhZGVyID0gcmVxdWlyZSggXCIuL2NoYXJ0L0FwcC5WaWV3cy5DaGFydC5IZWFkZXIuanNcIiApLFxuXHRcdFNjYWxlU2VsZWN0b3JzID0gcmVxdWlyZSggXCIuL2NoYXJ0L0FwcC5WaWV3cy5DaGFydC5TY2FsZVNlbGVjdG9yc1wiICksXG5cdFx0Q2hhcnRUYWIgPSByZXF1aXJlKCBcIi4vY2hhcnQvQXBwLlZpZXdzLkNoYXJ0LkNoYXJ0VGFiLmpzXCIgKSxcblx0XHREYXRhVGFiID0gcmVxdWlyZSggXCIuL2NoYXJ0L0FwcC5WaWV3cy5DaGFydC5EYXRhVGFiLmpzXCIgKSxcblx0XHRTb3VyY2VzVGFiID0gcmVxdWlyZSggXCIuL2NoYXJ0L0FwcC5WaWV3cy5DaGFydC5Tb3VyY2VzVGFiLmpzXCIgKSxcblx0XHRNYXBUYWIgPSByZXF1aXJlKCBcIi4vY2hhcnQvQXBwLlZpZXdzLkNoYXJ0Lk1hcFRhYi5qc1wiICksXG5cdFx0Q2hhcnREYXRhTW9kZWwgPSByZXF1aXJlKCBcIi4vLi4vbW9kZWxzL0FwcC5Nb2RlbHMuQ2hhcnREYXRhTW9kZWwuanNcIiApLFxuXHRcdFV0aWxzID0gcmVxdWlyZSggXCIuLy4uL0FwcC5VdGlscy5qc1wiICk7XG5cblx0QXBwLlZpZXdzLkNoYXJ0VmlldyA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblxuXHRcdGVsOiBcIiNjaGFydC12aWV3XCIsXG5cdFx0ZXZlbnRzOiB7XG5cdFx0XHRcImNsaWNrIC5jaGFydC1zYXZlLXBuZy1idG5cIjogXCJleHBvcnRDb250ZW50XCIsXG5cdFx0XHRcImNsaWNrIC5jaGFydC1zYXZlLXN2Zy1idG5cIjogXCJleHBvcnRDb250ZW50XCJcblx0XHR9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHRcblx0XHRcdHRoaXMuZGlzcGF0Y2hlciA9IG9wdGlvbnMuZGlzcGF0Y2hlcjtcblx0XHRcdFxuXHRcdFx0dmFyIGNoaWxkVmlld09wdGlvbnMgPSB7IGRpc3BhdGNoZXI6IHRoaXMuZGlzcGF0Y2hlciwgcGFyZW50VmlldzogdGhpcyB9O1xuXHRcdFx0dGhpcy5oZWFkZXIgPSBuZXcgSGVhZGVyKCBjaGlsZFZpZXdPcHRpb25zICk7XG5cdFx0XHR0aGlzLnNjYWxlU2VsZWN0b3JzID0gbmV3IFNjYWxlU2VsZWN0b3JzKCBjaGlsZFZpZXdPcHRpb25zICk7XG5cdFx0XHQvL3RhYnNcblx0XHRcdHRoaXMuY2hhcnRUYWIgPSBuZXcgQ2hhcnRUYWIoIGNoaWxkVmlld09wdGlvbnMgKTtcblx0XHRcdHRoaXMuZGF0YVRhYiA9IG5ldyBEYXRhVGFiKCBjaGlsZFZpZXdPcHRpb25zICk7XG5cdFx0XHR0aGlzLnNvdXJjZXNUYWIgPSBuZXcgU291cmNlc1RhYiggY2hpbGRWaWV3T3B0aW9ucyApO1xuXHRcdFx0dGhpcy5tYXBUYWIgPSBuZXcgTWFwVGFiKCBjaGlsZFZpZXdPcHRpb25zICk7XG5cblx0XHRcdC8vc2V0dXAgbW9kZWwgdGhhdCB3aWxsIGZldGNoIGFsbCB0aGUgZGF0YSBmb3IgdXNcblx0XHRcdHRoaXMuZGF0YU1vZGVsID0gbmV3IENoYXJ0RGF0YU1vZGVsKCk7XG5cdFx0XHRcblx0XHRcdC8vc2V0dXAgZXZlbnRzXG5cdFx0XHR0aGlzLmRhdGFNb2RlbC5vbiggXCJzeW5jXCIsIHRoaXMub25EYXRhTW9kZWxTeW5jLCB0aGlzICk7XG5cdFx0XHR0aGlzLmRhdGFNb2RlbC5vbiggXCJlcnJvclwiLCB0aGlzLm9uRGF0YU1vZGVsRXJyb3IsIHRoaXMgKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLm9uKCBcImNoYW5nZVwiLCB0aGlzLm9uQ2hhcnRNb2RlbENoYW5nZSwgdGhpcyApO1xuXG5cdFx0XHR0aGlzLnJlbmRlcigpO1xuXG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cblx0XHRcdHZhciB0aGF0ID0gdGhpcztcblxuXHRcdFx0dGhpcy4kcHJlbG9hZGVyID0gdGhpcy4kZWwuZmluZCggXCIuY2hhcnQtcHJlbG9hZGVyXCIgKTtcblx0XHRcdHRoaXMuJGVycm9yID0gdGhpcy4kZWwuZmluZCggXCIuY2hhcnQtZXJyb3JcIiApO1xuXG5cdFx0XHQvL2NoYXJ0IHRhYlxuXHRcdFx0dGhpcy4kc3ZnID0gdGhpcy4kZWwuZmluZCggXCIjY2hhcnQtY2hhcnQtdGFiIHN2Z1wiICk7XG5cdFx0XHR0aGlzLiR0YWJDb250ZW50ID0gdGhpcy4kZWwuZmluZCggXCIudGFiLWNvbnRlbnRcIiApO1xuXHRcdFx0dGhpcy4kdGFiUGFuZXMgPSB0aGlzLiRlbC5maW5kKCBcIi50YWItcGFuZVwiICk7XG5cdFx0XHR0aGlzLiRjaGFydEhlYWRlciA9IHRoaXMuJGVsLmZpbmQoIFwiLmNoYXJ0LWhlYWRlclwiICk7XG5cdFx0XHR0aGlzLiRlbnRpdGllc1NlbGVjdCA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9YXZhaWxhYmxlX2VudGl0aWVzXVwiICk7XG5cdFx0XHR0aGlzLiRjaGFydEZvb3RlciA9IHRoaXMuJGVsLmZpbmQoIFwiLmNoYXJ0LWZvb3RlclwiICk7XG5cdFx0XHR0aGlzLiRjaGFydE5hbWUgPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1uYW1lXCIgKTtcblx0XHRcdHRoaXMuJGNoYXJ0U3VibmFtZSA9IHRoaXMuJGVsLmZpbmQoIFwiLmNoYXJ0LXN1Ym5hbWVcIiApO1xuXHRcdFx0dGhpcy4kY2hhcnREZXNjcmlwdGlvbiA9IHRoaXMuJGVsLmZpbmQoIFwiLmNoYXJ0LWRlc2NyaXB0aW9uXCIgKTtcblx0XHRcdHRoaXMuJGNoYXJ0U291cmNlcyA9IHRoaXMuJGVsLmZpbmQoIFwiLmNoYXJ0LXNvdXJjZXNcIiApO1xuXHRcdFx0dGhpcy4kY2hhcnRGdWxsU2NyZWVuID0gdGhpcy4kZWwuZmluZCggXCIuZmFuY3lib3gtaWZyYW1lXCIgKTtcblxuXHRcdFx0dGhpcy4keEF4aXNTY2FsZVNlbGVjdG9yID0gdGhpcy4kZWwuZmluZCggXCIueC1heGlzLXNjYWxlLXNlbGVjdG9yXCIgKTtcblx0XHRcdHRoaXMuJHhBeGlzU2NhbGUgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPXhfYXhpc19zY2FsZV1cIiApO1xuXHRcdFx0dGhpcy4keUF4aXNTY2FsZVNlbGVjdG9yID0gdGhpcy4kZWwuZmluZCggXCIueS1heGlzLXNjYWxlLXNlbGVjdG9yXCIgKTtcblx0XHRcdHRoaXMuJHlBeGlzU2NhbGUgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPXlfYXhpc19zY2FsZV1cIiApO1xuXG5cdFx0XHR0aGlzLiRyZWxvYWRCdG4gPSB0aGlzLiRlbC5maW5kKCBcIi5yZWxvYWQtYnRuXCIgKTtcblxuXHRcdFx0dmFyIGNoYXJ0TmFtZSA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC1uYW1lXCIgKSxcblx0XHRcdFx0YWRkQ291bnRyeU1vZGUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiYWRkLWNvdW50cnktbW9kZVwiICksXG5cdFx0XHRcdGZvcm1Db25maWcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiZm9ybS1jb25maWdcIiApLFxuXHRcdFx0XHRlbnRpdGllcyA9ICggZm9ybUNvbmZpZyAmJiBmb3JtQ29uZmlnWyBcImVudGl0aWVzLWNvbGxlY3Rpb25cIiBdICk/IGZvcm1Db25maWdbIFwiZW50aXRpZXMtY29sbGVjdGlvblwiIF06IFtdLFxuXHRcdFx0XHRzZWxlY3RlZENvdW50cmllcyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiApLFxuXHRcdFx0XHRzZWxlY3RlZENvdW50cmllc0lkcyA9IF8ubWFwKCBzZWxlY3RlZENvdW50cmllcywgZnVuY3Rpb24oIHYgKSB7IHJldHVybiAodik/ICt2LmlkOiBcIlwiOyB9ICksXG5cdFx0XHRcdGNoYXJ0VGltZSA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10aW1lXCIgKTtcblx0XHRcdFx0XG5cdFx0XHQvL21pZ2h0IG5lZWQgdG8gcmVwbGFjZSBjb3VudHJ5IGluIHRpdGxlLCBpZiBcImNoYW5nZSBjb3VudHJ5XCIgbW9kZVxuXHRcdFx0aWYoIGFkZENvdW50cnlNb2RlID09PSBcImNoYW5nZS1jb3VudHJ5XCIgKSB7XG5cdFx0XHRcdC8veWVwLCBwcm9iYWJseSBuZWVkIHJlcGxhY2luZyBjb3VudHJ5IGluIHRpdGxlIChzZWxlY3QgZmlyc3QgY291bnRyeSBmb3JtIHN0b3JlZCBvbmUpXG5cdFx0XHRcdGlmKCBzZWxlY3RlZENvdW50cmllcyAmJiBzZWxlY3RlZENvdW50cmllcy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0dmFyIGNvdW50cnkgPSBzZWxlY3RlZENvdW50cmllc1swXTtcblx0XHRcdFx0XHRjaGFydE5hbWUgPSBjaGFydE5hbWUucmVwbGFjZSggXCIqY291bnRyeSpcIiwgY291bnRyeS5uYW1lICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly91cGRhdGUgdmFsdWVzXG5cdFx0XHR0aGlzLiRjaGFydE5hbWUudGV4dCggY2hhcnROYW1lICk7XG5cdFx0XHR0aGlzLiRjaGFydFN1Ym5hbWUuaHRtbCggQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LXN1Ym5hbWVcIiApICk7XG5cblx0XHRcdHZhciBjaGFydERlc2NyaXB0aW9uID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LWRlc2NyaXB0aW9uXCIgKTtcblx0XHRcdC8vdGhpcy4kY2hhcnREZXNjcmlwdGlvbi50ZXh0KCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtZGVzY3JpcHRpb25cIiApICk7XG5cblx0XHRcdC8vc2hvdy9oaWRlIHNjYWxlIHNlbGVjdG9yc1xuXHRcdFx0dmFyIHNob3dYU2NhbGVTZWxlY3RvcnMgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwieC1heGlzLXNjYWxlLXNlbGVjdG9yXCIgKTtcblx0XHRcdGlmKCBzaG93WFNjYWxlU2VsZWN0b3JzICkge1xuXHRcdFx0XHR0aGlzLiR4QXhpc1NjYWxlU2VsZWN0b3Iuc2hvdygpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy4keEF4aXNTY2FsZVNlbGVjdG9yLmhpZGUoKTtcblx0XHRcdH1cblx0XHRcdHZhciBzaG93WVNjYWxlU2VsZWN0b3JzID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcInktYXhpcy1zY2FsZS1zZWxlY3RvclwiICk7XG5cdFx0XHRpZiggc2hvd1lTY2FsZVNlbGVjdG9ycyApIHtcblx0XHRcdFx0dGhpcy4keUF4aXNTY2FsZVNlbGVjdG9yLnNob3coKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuJHlBeGlzU2NhbGVTZWxlY3Rvci5oaWRlKCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vdXBkYXRlIGNvdW50cmllc1xuXHRcdFx0dGhpcy4kZW50aXRpZXNTZWxlY3QuZW1wdHkoKTtcblx0XHRcdGlmKCBzZWxlY3RlZENvdW50cmllc0lkcy5sZW5ndGggKSB7XG5cdFx0XHRcdC8vYXBwZW5kIGVtcHR5IGRlZmF1bHQgb3B0aW9uXG5cdFx0XHRcdHRoYXQuJGVudGl0aWVzU2VsZWN0LmFwcGVuZCggXCI8b3B0aW9uIGRpc2FibGVkIHNlbGVjdGVkPlNlbGVjdCBjb3VudHJ5PC9vcHRpb24+XCIgKTtcblx0XHRcdFx0Xy5lYWNoKCBlbnRpdGllcywgZnVuY3Rpb24oIGQsIGkgKSB7XG5cdFx0XHRcdFx0Ly9hZGQgb25seSB0aG9zZSBlbnRpdGllcywgd2hpY2ggYXJlIG5vdCBzZWxlY3RlZCBhbHJlYWR5XG5cdFx0XHRcdFx0aWYoIF8uaW5kZXhPZiggc2VsZWN0ZWRDb3VudHJpZXNJZHMsICtkLmlkICkgPT0gLTEgKSB7XG5cdFx0XHRcdFx0XHR0aGF0LiRlbnRpdGllc1NlbGVjdC5hcHBlbmQoIFwiPG9wdGlvbiB2YWx1ZT0nXCIgKyBkLmlkICsgXCInPlwiICsgZC5uYW1lICsgXCI8L29wdGlvbj5cIiApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSApO1xuXHRcdFx0fVxuXHRcdFx0Ly9tYWtlIGNob3NlbiB1cGRhdGUsIG1ha2Ugc3VyZSBpdCBsb29zZXMgYmx1ciBhcyB3ZWxsXG5cdFx0XHR0aGlzLiRlbnRpdGllc1NlbGVjdC50cmlnZ2VyKCBcImNob3Nlbjp1cGRhdGVkXCIgKTtcblxuXHRcdFx0dGhpcy4kY2hhcnRGdWxsU2NyZWVuLm9uKCBcImNsaWNrXCIsIGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHR2YXIgJHRoaXMgPSAkKCB0aGlzICk7XG5cdFx0XHRcdHdpbmRvdy5wYXJlbnQub3BlbkZhbmN5Qm94KCAkdGhpcy5hdHRyKCBcImhyZWZcIiApICk7XG5cdFx0XHR9ICk7XG5cblx0XHRcdC8vcmVmcmVzaCBidG5cblx0XHRcdHRoaXMuJHJlbG9hZEJ0bi5vbiggXCJjbGlja1wiLCBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0d2luZG93LmxvY2F0aW9uLnJlbG9hZCgpO1xuXHRcdFx0fSApO1xuXG5cdFx0XHQvL2NoYXJ0IHRhYlxuXHRcdFx0dGhpcy4kY2hhcnRUYWIgPSB0aGlzLiRlbC5maW5kKCBcIiNjaGFydC1jaGFydC10YWJcIiApO1xuXG5cdFx0XHR2YXIgZGltZW5zaW9uc1N0cmluZyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC1kaW1lbnNpb25zXCIgKSxcblx0XHRcdFx0dmFsaWREaW1lbnNpb25zID0gZmFsc2U7XG5cdFx0XHRcblx0XHRcdC8vY2xpY2tpbmcgYW55dGhpbmcgaW4gY2hhcnQgc291cmNlIHdpbGwgdGFrZSB5b3UgdG8gc291cmNlcyB0YWJcblx0XHRcdHRoaXMuJGNoYXJ0U291cmNlcy5vbiggXCJjbGlja1wiLCBmdW5jdGlvbihldnQpIHtcblx0XHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdHZhciAkYSA9ICQoIFwiW2hyZWY9JyNzb3VyY2VzLWNoYXJ0LXRhYiddXCIgKTtcblx0XHRcdFx0JGEudHJpZ2dlciggXCJjbGlja1wiICk7XG5cdFx0XHR9ICk7XG5cblx0XHRcdC8vY2hlY2sgd2UgaGF2ZSBhbGwgZGltZW5zaW9ucyBuZWNlc3NhcnkgXG5cdFx0XHRpZiggISQuaXNFbXB0eU9iamVjdCggZGltZW5zaW9uc1N0cmluZyApICkge1xuXHRcdFx0XHR2YXIgZGltZW5zaW9uID0gJC5wYXJzZUpTT04oIGRpbWVuc2lvbnNTdHJpbmcgKTtcblx0XHRcdFx0dmFsaWREaW1lbnNpb25zID0gVXRpbHMuY2hlY2tWYWxpZERpbWVuc2lvbnMoIGRpbWVuc2lvbiwgQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LXR5cGVcIiApKTtcblx0XHRcdH1cblxuXHRcdFx0Ly9tYWtlIHN1cmUgdG8gYXBwZWFyIG9ubHkgZmlyc3QgdGFiIHRhYnMgdGhhdCBhcmUgbmVjZXNzYXJ5XG5cdFx0XHQvL2FwcGVhciBvbmx5IGZpcnN0IHRhYiBpZiBub25lIHZpc2libGVcblx0XHRcdGlmKCAhdGhpcy4kdGFiUGFuZXMuZmlsdGVyKCBcIi5hY3RpdmVcIiApLmxlbmd0aCApIHtcblx0XHRcdFx0dmFyIHRhYnMgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwidGFic1wiICksXG5cdFx0XHRcdFx0Zmlyc3RUYWJOYW1lID0gdGFic1sgMCBdLFxuXHRcdFx0XHRcdGZpcnN0VGFiUGFuZSA9IHRoaXMuJHRhYlBhbmVzLmZpbHRlciggXCIjXCIgKyBmaXJzdFRhYk5hbWUgKyBcIi1jaGFydC10YWJcIiApO1xuXHRcdFx0XHRmaXJzdFRhYlBhbmUuYWRkQ2xhc3MoIFwiYWN0aXZlXCIgKTtcblx0XHRcdFx0aWYoIGZpcnN0VGFiTmFtZSA9PT0gXCJtYXBcIiApIHtcblx0XHRcdFx0XHQvL21hcCB0YWIgbmVlZHMgc3BlY2lhbCBpbmlhbGl0aXphdGlvblxuXHRcdFx0XHRcdHRoaXMubWFwVGFiLmRpc3BsYXkoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRpZiggIXZhbGlkRGltZW5zaW9ucyApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiggZGltZW5zaW9uc1N0cmluZyApIHtcblxuXHRcdFx0XHR0aGlzLiRwcmVsb2FkZXIuc2hvdygpO1xuXG5cdFx0XHRcdHZhciBkYXRhUHJvcHMgPSB7IFwiZGltZW5zaW9uc1wiOiBkaW1lbnNpb25zU3RyaW5nLCBcImNoYXJ0SWRcIjogQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImlkXCIgKSwgXCJjaGFydFR5cGVcIjogQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LXR5cGVcIiApLCBcInNlbGVjdGVkQ291bnRyaWVzXCI6IHNlbGVjdGVkQ291bnRyaWVzSWRzLCBcImNoYXJ0VGltZVwiOiBjaGFydFRpbWUsIFwiY2FjaGVcIjogQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNhY2hlXCIgKSwgXCJncm91cEJ5VmFyaWFibGVzXCI6IEFwcC5DaGFydE1vZGVsLmdldCggXCJncm91cC1ieS12YXJpYWJsZXNcIiApICB9O1xuXHRcdFx0XHRcblx0XHRcdFx0dGhpcy5kYXRhTW9kZWwuZmV0Y2goIHsgZGF0YTogZGF0YVByb3BzIH0gKTtcblxuXHRcdFx0fSBlbHNlIHtcblxuXHRcdFx0XHQvL2NsZWFyIGFueSBwcmV2aW91cyBjaGFydFxuXHRcdFx0XHQkKCBcInN2Z1wiICkuZW1wdHkoKTtcblxuXHRcdFx0fVxuXG5cdFx0fSxcblxuXHRcdG9uQ2hhcnRNb2RlbENoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblx0XHRcdFxuXHRcdH0sXG5cblx0XHRvbkRhdGFNb2RlbFN5bmM6IGZ1bmN0aW9uKCBtb2RlbCwgcmVzcG9uc2UgKSB7XG5cdFx0XHR0aGlzLiRlcnJvci5oaWRlKCk7XG5cdFx0XHR0aGlzLiRwcmVsb2FkZXIuaGlkZSgpO1xuXHRcdFx0aWYoIHJlc3BvbnNlLmRhdGEgKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlQ2hhcnQoIHJlc3BvbnNlLmRhdGEsIHJlc3BvbnNlLnRpbWVUeXBlLCByZXNwb25zZS5kaW1lbnNpb25zICk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnNvdXJjZXNUYWIucmVuZGVyKCByZXNwb25zZSApO1xuXHRcdH0sXG5cblx0XHRvbkRhdGFNb2RlbEVycm9yOiBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuJGVycm9yLnNob3coKTtcblx0XHRcdHRoaXMuJHByZWxvYWRlci5oaWRlKCk7XG5cdFx0fSxcblxuXHRcdGV4cG9ydENvbnRlbnQ6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHRcblx0XHRcdC8vaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8yMzIxODE3NC9ob3ctZG8taS1zYXZlLWV4cG9ydC1hbi1zdmctZmlsZS1hZnRlci1jcmVhdGluZy1hbi1zdmctd2l0aC1kMy1qcy1pZS1zYWZhcmktYW5cblx0XHRcdHZhciAkYnRuID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKSxcblx0XHRcdFx0Ly9zdG9yZSBwcmUtcHJpbnRpbmcgc3ZnXG5cdFx0XHRcdCRvbGRFbCA9IHRoaXMuJGVsLFxuXHRcdFx0XHQkbmV3RWwgPSAkb2xkRWwuY2xvbmUoKSxcblx0XHRcdFx0aXNTdmcgPSAoICRidG4uaGFzQ2xhc3MoIFwiY2hhcnQtc2F2ZS1zdmctYnRuXCIgKSApPyB0cnVlOiBmYWxzZTtcblx0XHRcdFxuXHRcdFx0JG9sZEVsLnJlcGxhY2VXaXRoKCAkbmV3RWwgKTtcblxuXHRcdFx0Ly9ncmFiIGFsbCBzdmdcblx0XHRcdHZhciAkc3ZnID0gJG5ld0VsLmZpbmQoIFwic3ZnXCIgKSxcblx0XHRcdFx0c3ZnID0gJHN2Zy5nZXQoIDAgKSxcblx0XHRcdFx0c3ZnU3RyaW5nID0gc3ZnLm91dGVySFRNTDtcblxuXHRcdFx0Ly9hZGQgcHJpbnRpbmcgc3R5bGVzXG5cdFx0XHQkc3ZnLmF0dHIoIFwiY2xhc3NcIiwgXCJudmQzLXN2ZyBleHBvcnQtc3ZnXCIgKTtcblxuXHRcdFx0Ly9pbmxpbmUgc3R5bGVzIGZvciB0aGUgZXhwb3J0XG5cdFx0XHR2YXIgc3R5bGVTaGVldHMgPSBkb2N1bWVudC5zdHlsZVNoZWV0cztcblx0XHRcdGZvciggdmFyIGkgPSAwOyBpIDwgc3R5bGVTaGVldHMubGVuZ3RoOyBpKysgKSB7XG5cdFx0XHRcdFV0aWxzLmlubGluZUNzc1N0eWxlKCBzdHlsZVNoZWV0c1sgaSBdLmNzc1J1bGVzICk7XG5cdFx0XHR9XG5cblx0XHRcdC8vZGVwZW5kaW5nIHdoZXRoZXIgd2UncmUgY3JlYXRpbmcgc3ZnIG9yIHBuZywgXG5cdFx0XHRpZiggaXNTdmcgKSB7XG5cblx0XHRcdFx0dmFyIHNlcmlhbGl6ZXIgPSBuZXcgWE1MU2VyaWFsaXplcigpLFxuXHRcdFx0XHRzb3VyY2UgPSBzZXJpYWxpemVyLnNlcmlhbGl6ZVRvU3RyaW5nKHN2Zyk7XG5cdFx0XHRcdC8vYWRkIG5hbWUgc3BhY2VzLlxuXHRcdFx0XHRpZighc291cmNlLm1hdGNoKC9ePHN2Z1tePl0reG1sbnM9XCJodHRwXFw6XFwvXFwvd3d3XFwudzNcXC5vcmdcXC8yMDAwXFwvc3ZnXCIvKSl7XG5cdFx0XHRcdFx0c291cmNlID0gc291cmNlLnJlcGxhY2UoL148c3ZnLywgJzxzdmcgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYoIXNvdXJjZS5tYXRjaCgvXjxzdmdbXj5dK1wiaHR0cFxcOlxcL1xcL3d3d1xcLnczXFwub3JnXFwvMTk5OVxcL3hsaW5rXCIvKSl7XG5cdFx0XHRcdFx0c291cmNlID0gc291cmNlLnJlcGxhY2UoL148c3ZnLywgJzxzdmcgeG1sbnM6eGxpbms9XCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rXCInKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0Ly9hZGQgeG1sIGRlY2xhcmF0aW9uXG5cdFx0XHRcdHNvdXJjZSA9ICc8P3htbCB2ZXJzaW9uPVwiMS4wXCIgc3RhbmRhbG9uZT1cIm5vXCI/PlxcclxcbicgKyBzb3VyY2U7XG5cblx0XHRcdFx0Ly9jb252ZXJ0IHN2ZyBzb3VyY2UgdG8gVVJJIGRhdGEgc2NoZW1lLlxuXHRcdFx0XHR2YXIgdXJsID0gXCJkYXRhOmltYWdlL3N2Zyt4bWw7Y2hhcnNldD11dGYtOCxcIitlbmNvZGVVUklDb21wb25lbnQoc291cmNlKTtcblx0XHRcdFx0JGJ0bi5hdHRyKCBcImhyZWZcIiwgdXJsICk7XG5cblx0XHRcdH0gZWxzZSB7XG5cblx0XHRcdFx0dmFyICRzdmdDYW52YXMgPSAkKCBcIi5udmQzLXN2Z1wiICk7XG5cdFx0XHRcdGlmKCAkc3ZnQ2FudmFzLmxlbmd0aCApIHtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHRzYXZlU3ZnQXNQbmcoICQoIFwiLm52ZDMtc3ZnXCIgKS5nZXQoIDAgKSwgXCJjaGFydC5wbmdcIik7XG5cblx0XHRcdFx0XHQvL3RlbXAgaGFjayAtIHJlbW92ZSBpbWFnZSB3aGVuIGV4cG9ydGluZyB0byBwbmdcblx0XHRcdFx0XHQvKnZhciAkc3ZnTG9nbyA9ICQoIFwiLmNoYXJ0LWxvZ28tc3ZnXCIgKTtcblx0XHRcdFx0XHQkc3ZnTG9nby5yZW1vdmUoKTtcblxuXHRcdFx0XHRcdHNhdmVTdmdBc1BuZyggJCggXCIubnZkMy1zdmdcIiApLmdldCggMCApLCBcImNoYXJ0LnBuZ1wiKTtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHQkc3ZnLnByZXBlbmQoICRzdmdMb2dvICk7Ki9cblx0XHRcdFx0XHRcblx0XHRcdFx0fVxuXG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdC8vYWRkIGJhY2sgdGhlIHByaW50ZWQgc3ZnXG5cdFx0XHQkbmV3RWwucmVwbGFjZVdpdGgoICRvbGRFbCApO1xuXHRcdFx0Ly9yZWZyZXNoIGxpbmtcblx0XHRcdCRvbGRFbC5maW5kKCBcIi5jaGFydC1zYXZlLXN2Zy1idG5cIiApLm9uKCBcImNsaWNrXCIsICQucHJveHkoIHRoaXMuZXhwb3J0Q29udGVudCwgdGhpcyApICk7XG5cblx0XHR9LFxuXG5cdFx0dXBkYXRlQ2hhcnQ6IGZ1bmN0aW9uKCBkYXRhLCB0aW1lVHlwZSwgZGltZW5zaW9ucyApIHtcblxuXHRcdFx0dGhpcy5jaGFydFRhYi5yZW5kZXIoIGRhdGEsIHRpbWVUeXBlLCBkaW1lbnNpb25zICk7XG5cdFx0XG5cdFx0fSxcblx0XG5cdFx0b25SZXNpemU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XG5cdFx0XHQvL2NvbXB1dGUgaG93IG11Y2ggc3BhY2UgZm9yIGNoYXJ0XG5cdFx0XHR2YXIgc3ZnV2lkdGggPSB0aGlzLiRzdmcud2lkdGgoKSxcblx0XHRcdFx0c3ZnSGVpZ2h0ID0gdGhpcy4kc3ZnLmhlaWdodCgpLFxuXHRcdFx0XHRjaGFydFR5cGUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdHlwZVwiICksXG5cdFx0XHRcdCRjaGFydE5hbWVTdmcgPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1uYW1lLXN2Z1wiICksXG5cdFx0XHRcdCRjaGFydFN1Ym5hbWVTdmcgPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1zdWJuYW1lLXN2Z1wiICksXG5cdFx0XHRcdCRjaGFydERlc2NyaXB0aW9uU3ZnID0gdGhpcy4kZWwuZmluZCggXCIuY2hhcnQtZGVzY3JpcHRpb24tc3ZnXCIgKSxcblx0XHRcdFx0JGNoYXJ0U291cmNlc1N2ZyA9IHRoaXMuJGVsLmZpbmQoIFwiLmNoYXJ0LXNvdXJjZXMtc3ZnXCIgKSxcblx0XHRcdFx0Y2hhcnRIZWFkZXJIZWlnaHQgPSB0aGlzLiRjaGFydEhlYWRlci5oZWlnaHQoKSxcblx0XHRcdFx0bWFyZ2lucyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJtYXJnaW5zXCIgKSxcblx0XHRcdFx0dG9wQ2hhcnRNYXJnaW4gPSAzMCxcblx0XHRcdFx0Ym90dG9tQ2hhcnRNYXJnaW4gPSA2MCxcblx0XHRcdFx0Y3VyclksIGZvb3RlckRlc2NyaXB0aW9uSGVpZ2h0LCBmb290ZXJTb3VyY2VzSGVpZ2h0LCBjaGFydEhlaWdodDtcblxuXHRcdFx0dGhpcy4kdGFiQ29udGVudC5oZWlnaHQoICQoIFwiLmNoYXJ0LXdyYXBwZXItaW5uZXJcIiApLmhlaWdodCgpIC0gdGhpcy4kY2hhcnRIZWFkZXIuaGVpZ2h0KCkgKTtcblxuXHRcdFx0Ly93cmFwIGhlYWRlciB0ZXh0XG5cdFx0XHRVdGlscy53cmFwKCAkY2hhcnROYW1lU3ZnLCBzdmdXaWR0aCApO1xuXHRcdFx0Y3VyclkgPSBwYXJzZUludCggJGNoYXJ0TmFtZVN2Zy5hdHRyKCBcInlcIiApLCAxMCApICsgJGNoYXJ0TmFtZVN2Zy5vdXRlckhlaWdodCgpICsgMjA7XG5cdFx0XHQkY2hhcnRTdWJuYW1lU3ZnLmF0dHIoIFwieVwiLCBjdXJyWSApO1xuXHRcdFx0XG5cdFx0XHQvL3dyYXAgZGVzY3JpcHRpb25cblx0XHRcdFV0aWxzLndyYXAoICRjaGFydFN1Ym5hbWVTdmcsIHN2Z1dpZHRoICk7XG5cblx0XHRcdC8vc3RhcnQgcG9zaXRpb25pbmcgdGhlIGdyYXBoLCBhY2NvcmRpbmcgXG5cdFx0XHRjdXJyWSA9IGNoYXJ0SGVhZGVySGVpZ2h0O1xuXG5cdFx0XHR2YXIgdHJhbnNsYXRlWSA9IGN1cnJZO1xuXHRcdFx0XG5cdFx0XHR0aGlzLiRzdmcuaGVpZ2h0KCB0aGlzLiR0YWJDb250ZW50LmhlaWdodCgpICsgY3VyclkgKTtcblxuXHRcdFx0Ly91cGRhdGUgc3RvcmVkIGhlaWdodFxuXHRcdFx0c3ZnSGVpZ2h0ID0gdGhpcy4kc3ZnLmhlaWdodCgpO1xuXG5cdFx0XHQvL2FkZCBoZWlnaHQgb2YgbGVnZW5kXG5cdFx0XHQvL2N1cnJZICs9IHRoaXMuY2hhcnQubGVnZW5kLmhlaWdodCgpO1xuXHRcdFx0aWYoICFBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiaGlkZS1sZWdlbmRcIiApICkge1xuXHRcdFx0XHRjdXJyWSArPSB0aGlzLmNoYXJ0VGFiLmxlZ2VuZC5oZWlnaHQoKTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0Ly9wb3NpdGlvbiBjaGFydFxuXHRcdFx0VXRpbHMud3JhcCggJGNoYXJ0RGVzY3JpcHRpb25TdmcsIHN2Z1dpZHRoICk7XG5cdFx0XHRmb290ZXJEZXNjcmlwdGlvbkhlaWdodCA9ICRjaGFydERlc2NyaXB0aW9uU3ZnLmhlaWdodCgpO1xuXHRcdFx0VXRpbHMud3JhcCggJGNoYXJ0U291cmNlc1N2Zywgc3ZnV2lkdGggKTtcblx0XHRcdGZvb3RlclNvdXJjZXNIZWlnaHQgPSAkY2hhcnRTb3VyY2VzU3ZnLmhlaWdodCgpO1xuXG5cdFx0XHR2YXIgZm9vdGVySGVpZ2h0ID0gdGhpcy4kY2hhcnRGb290ZXIuaGVpZ2h0KCk7XG5cblx0XHRcdC8vc2V0IGNoYXJ0IGhlaWdodFxuXHRcdFx0Y2hhcnRIZWlnaHQgPSBzdmdIZWlnaHQgLSB0cmFuc2xhdGVZIC0gZm9vdGVySGVpZ2h0IC0gYm90dG9tQ2hhcnRNYXJnaW47XG5cdFx0XHRpZiggIUFwcC5DaGFydE1vZGVsLmdldCggXCJoaWRlLWxlZ2VuZFwiICkgKSB7XG5cdFx0XHRcdGNoYXJ0SGVpZ2h0IC09IHRoaXMuY2hhcnRUYWIubGVnZW5kLmhlaWdodCgpO1xuXHRcdFx0fVxuXG5cdFx0XHQvL3JlZmxlY3QgbWFyZ2luIHRvcCBhbmQgZG93biBpbiBjaGFydEhlaWdodFxuXHRcdFx0Y2hhcnRIZWlnaHQgPSBjaGFydEhlaWdodCAtIG1hcmdpbnMuYm90dG9tIC0gbWFyZ2lucy50b3A7XG5cblx0XHRcdC8vcG9zaXRpb24gZm9vdGVyXG5cdFx0XHQkY2hhcnREZXNjcmlwdGlvblN2Zy5hdHRyKCBcInlcIiwgY3VyclkgKyBjaGFydEhlaWdodCArIGJvdHRvbUNoYXJ0TWFyZ2luICk7XG5cdFx0XHRVdGlscy53cmFwKCAkY2hhcnREZXNjcmlwdGlvblN2Zywgc3ZnV2lkdGggKTtcblx0XHRcdCRjaGFydFNvdXJjZXNTdmcuYXR0ciggXCJ5XCIsIHBhcnNlSW50KCAkY2hhcnREZXNjcmlwdGlvblN2Zy5hdHRyKCBcInlcIiApLCAxMCApICsgJGNoYXJ0RGVzY3JpcHRpb25TdmcuaGVpZ2h0KCkgKyBmb290ZXJEZXNjcmlwdGlvbkhlaWdodC8zICk7XG5cdFx0XHRVdGlscy53cmFwKCAkY2hhcnRTb3VyY2VzU3ZnLCBzdmdXaWR0aCApO1xuXHRcdFx0XG5cdFx0XHQvL2NvbXB1dGUgY2hhcnQgd2lkdGhcblx0XHRcdHZhciBjaGFydFdpZHRoID0gc3ZnV2lkdGggLSBtYXJnaW5zLmxlZnQgLSBtYXJnaW5zLnJpZ2h0O1xuXHRcdFx0dGhpcy5jaGFydFRhYi5jaGFydC53aWR0aCggY2hhcnRXaWR0aCApO1xuXHRcdFx0dGhpcy5jaGFydFRhYi5jaGFydC5oZWlnaHQoIGNoYXJ0SGVpZ2h0ICk7XG5cblx0XHRcdC8vbmVlZCB0byBjYWxsIGNoYXJ0IHVwZGF0ZSBmb3IgcmVzaXppbmcgb2YgZWxlbWVudHMgd2l0aGluIGNoYXJ0XG5cdFx0XHRpZiggdGhpcy4kY2hhcnRUYWIuaXMoIFwiOnZpc2libGVcIiApICkge1xuXHRcdFx0XHR0aGlzLmNoYXJ0VGFiLmNoYXJ0LnVwZGF0ZSgpO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRpZiggY2hhcnRUeXBlID09PSBcIjNcIiApIHtcblx0XHRcdFx0Ly9mb3Igc3RhY2tlZCBhcmVhIGNoYXJ0LCBuZWVkIHRvIG1hbnVhbGx5IGFkanVzdCBoZWlnaHRcblx0XHRcdFx0dmFyIGN1cnJJbnRMYXllckhlaWdodCA9IHRoaXMuY2hhcnRUYWIuY2hhcnQuaW50ZXJhY3RpdmVMYXllci5oZWlnaHQoKSxcblx0XHRcdFx0XHQvL1RPRE8gLSBkbyBub3QgaGFyZGNvZGUgdGhpc1xuXHRcdFx0XHRcdGhlaWdodEFkZCA9IDE1MDtcblx0XHRcdFx0dGhpcy5jaGFydFRhYi5jaGFydC5pbnRlcmFjdGl2ZUxheWVyLmhlaWdodCggY3VyckludExheWVySGVpZ2h0ICsgaGVpZ2h0QWRkICk7XG5cdFx0XHRcdGQzLnNlbGVjdChcIi5udi1pbnRlcmFjdGl2ZVwiKS5jYWxsKHRoaXMuY2hhcnRUYWIuY2hhcnQuaW50ZXJhY3RpdmVMYXllcik7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdGlmKCAhQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImhpZGUtbGVnZW5kXCIgKSApIHtcblx0XHRcdFx0Ly9wb3NpdGlvbiBsZWdlbmRcblx0XHRcdFx0dmFyIGxlZ2VuZE1hcmdpbnMgPSB0aGlzLmNoYXJ0VGFiLmxlZ2VuZC5tYXJnaW4oKTtcblx0XHRcdFx0Y3VyclkgPSBjdXJyWSAtIHRoaXMuY2hhcnRUYWIubGVnZW5kLmhlaWdodCgpO1xuXHRcdFx0XHR0aGlzLnRyYW5zbGF0ZVN0cmluZyA9IFwidHJhbnNsYXRlKFwiICsgbGVnZW5kTWFyZ2lucy5sZWZ0ICsgXCIgLFwiICsgY3VyclkgKyBcIilcIjtcblx0XHRcdFx0dGhpcy4kc3ZnLmZpbmQoIFwiPiAubnZkMy5udi1jdXN0b20tbGVnZW5kXCIgKS5hdHRyKCBcInRyYW5zZm9ybVwiLCB0aGlzLnRyYW5zbGF0ZVN0cmluZyApO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLiRzdmcuY3NzKCBcInRyYW5zZm9ybVwiLCBcInRyYW5zbGF0ZSgwLC1cIiArIGNoYXJ0SGVhZGVySGVpZ2h0ICsgXCJweClcIiApO1xuXG5cdFx0XHQvL2ZvciBtdWx0aWJhcmNoYXJ0LCBuZWVkIHRvIG1vdmUgY29udHJvbHMgYml0IGhpZ2hlclxuXHRcdFx0aWYoIGNoYXJ0VHlwZSA9PT0gXCI0XCIgfHwgY2hhcnRUeXBlID09PSBcIjVcIiApIHtcblx0XHRcdFx0ZDMuc2VsZWN0KCBcIi5udi1jb250cm9sc1dyYXBcIiApLmF0dHIoIFwidHJhbnNmb3JtXCIsIFwidHJhbnNsYXRlKDAsLTI1KVwiICk7XG5cdFx0XHR9XG5cblx0XHRcdC8vcmVmbGVjdCBtYXJnaW4gdG9wIGluIGN1cnJZXG5cdFx0XHRpZiggIUFwcC5DaGFydE1vZGVsLmdldCggXCJoaWRlLWxlZ2VuZFwiICkgKSB7XG5cdFx0XHRcdGN1cnJZICs9ICt0aGlzLmNoYXJ0VGFiLmxlZ2VuZC5oZWlnaHQoKTtcblx0XHRcdH1cblx0XHRcdGN1cnJZICs9ICttYXJnaW5zLnRvcDtcblxuXHRcdFx0dmFyICR3cmFwID0gdGhpcy4kc3ZnLmZpbmQoIFwiPiAubnZkMy5udi13cmFwXCIgKTtcblxuXHRcdFx0Ly9tYW51YWxseSByZXBvc2l0aW9uIGNoYXJ0IGFmdGVyIHVwZGF0ZVxuXHRcdFx0Ly90aGlzLnRyYW5zbGF0ZVN0cmluZyA9IFwidHJhbnNsYXRlKFwiICsgbWFyZ2lucy5sZWZ0ICsgXCIsXCIgKyBjdXJyWSArIFwiKVwiO1xuXHRcdFx0dGhpcy50cmFuc2xhdGVTdHJpbmcgPSBcInRyYW5zbGF0ZShcIiArIG1hcmdpbnMubGVmdCArIFwiLFwiICsgY3VyclkgKyBcIilcIjtcblx0XHRcdCR3cmFwLmF0dHIoIFwidHJhbnNmb3JtXCIsIHRoaXMudHJhbnNsYXRlU3RyaW5nICk7XG5cdFx0XHRcblx0XHRcdC8vcG9zaXRpb24gc2NhbGUgZHJvcGRvd25zIC0gVE9ETyAtIGlzbid0IHRoZXJlIGEgYmV0dGVyIHdheSB0aGVuIHdpdGggdGltZW91dD9cblx0XHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRcdHNldFRpbWVvdXQoIGZ1bmN0aW9uKCkge1xuXHRcdFx0XG5cdFx0XHRcdHZhciB3cmFwT2Zmc2V0ID0gJHdyYXAub2Zmc2V0KCksXG5cdFx0XHRcdFx0Y2hhcnRUYWJPZmZzZXQgPSB0aGF0LiRjaGFydFRhYi5vZmZzZXQoKSxcblx0XHRcdFx0XHRtYXJnaW5MZWZ0ID0gcGFyc2VJbnQoIG1hcmdpbnMubGVmdCwgMTAgKSxcblx0XHRcdFx0XHQvL2RpZyBpbnRvIE5WRDMgY2hhcnQgdG8gZmluZCBiYWNrZ3JvdW5kIHJlY3QgdGhhdCBoYXMgd2lkdGggb2YgdGhlIGFjdHVhbCBjaGFydFxuXHRcdFx0XHRcdGJhY2tSZWN0V2lkdGggPSBwYXJzZUludCggJHdyYXAuZmluZCggXCI+IGcgPiByZWN0XCIgKS5hdHRyKCBcIndpZHRoXCIgKSwgMTAgKSxcblx0XHRcdFx0XHRvZmZzZXREaWZmID0gd3JhcE9mZnNldC50b3AgLSBjaGFydFRhYk9mZnNldC50b3AsXG5cdFx0XHRcdFx0Ly9lbXBpcmljIG9mZnNldFxuXHRcdFx0XHRcdHhTY2FsZU9mZnNldCA9IDEwLFxuXHRcdFx0XHRcdHlTY2FsZU9mZnNldCA9IC01O1xuXG5cdFx0XHRcdC8vZmFsbGJhY2sgZm9yIHNjYXR0ZXIgcGxvdCB3aGVyZSBiYWNrUmVjdFdpZHRoIGhhcyBubyB3aWR0aFxuXHRcdFx0XHRpZiggaXNOYU4oIGJhY2tSZWN0V2lkdGggKSApIHtcblx0XHRcdFx0XHRiYWNrUmVjdFdpZHRoID0gcGFyc2VJbnQoICQoXCIubnYteC5udi1heGlzLm52ZDMtc3ZnXCIpLmdldCgwKS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS53aWR0aCwgMTAgKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoYXQuJHhBeGlzU2NhbGVTZWxlY3Rvci5jc3MoIHsgXCJ0b3BcIjogb2Zmc2V0RGlmZiArIGNoYXJ0SGVpZ2h0LCBcImxlZnRcIjogbWFyZ2luTGVmdCArIGJhY2tSZWN0V2lkdGggKyB4U2NhbGVPZmZzZXQgfSApO1xuXHRcdFx0XHR0aGF0LiR5QXhpc1NjYWxlU2VsZWN0b3IuY3NzKCB7IFwidG9wXCI6IG9mZnNldERpZmYgLSAxNSwgXCJsZWZ0XCI6IG1hcmdpbkxlZnQgKyB5U2NhbGVPZmZzZXQgfSApO1xuXHRcdFx0XHRcblx0XHRcdH0sIDI1MCApO1xuXHRcdFx0XG5cdFx0fVxuXG5cdH0pO1xuXHRcblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVmlld3MuQ2hhcnRWaWV3O1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0QXBwLlZpZXdzLkZvcm1WaWV3ID0gQmFja2JvbmUuVmlldy5leHRlbmQoe1xuXG5cdFx0ZWw6IFwiI2Zvcm0tdmlld1wiLFxuXHRcdGV2ZW50czoge1xuXHRcdFx0XCJjbGljayAuZm9ybS1jb2xsYXBzZS1idG5cIjogXCJvbkZvcm1Db2xsYXBzZVwiLFxuXHRcdFx0XCJjaGFuZ2UgaW5wdXRbbmFtZT1jaGFydC1uYW1lXVwiOiBcIm9uTmFtZUNoYW5nZVwiLFxuXHRcdFx0XCJjaGFuZ2UgdGV4dGFyZWFbbmFtZT1jaGFydC1zdWJuYW1lXVwiOiBcIm9uU3VibmFtZUNoYW5nZVwiLFxuXHRcdFx0XCJjbGljayAucmVtb3ZlLXVwbG9hZGVkLWZpbGUtYnRuXCI6IFwib25SZW1vdmVVcGxvYWRlZEZpbGVcIixcblx0XHRcdFwic3VibWl0IGZvcm1cIjogXCJvbkZvcm1TdWJtaXRcIixcblx0XHR9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHRcblx0XHRcdHRoaXMuZGlzcGF0Y2hlciA9IG9wdGlvbnMuZGlzcGF0Y2hlcjtcblx0XHRcdFxuXHRcdFx0dmFyIGZvcm1Db25maWcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiZm9ybS1jb25maWdcIiApO1xuXG5cdFx0XHQvL2NyZWF0ZSByZWxhdGVkIG1vZGVscywgZWl0aGVyIGVtcHR5ICh3aGVuIGNyZWF0aW5nIG5ldyBjaGFydCksIG9yIHByZWZpbGxlZCBmcm9tIGRiICh3aGVuIGVkaXRpbmcgZXhpc3RpbmcgY2hhcnQpXG5cdFx0XHRpZiggZm9ybUNvbmZpZyAmJiBmb3JtQ29uZmlnWyBcInZhcmlhYmxlcy1jb2xsZWN0aW9uXCIgXSApIHtcblx0XHRcdFx0QXBwLkNoYXJ0VmFyaWFibGVzQ29sbGVjdGlvbiA9IG5ldyBBcHAuQ29sbGVjdGlvbnMuQ2hhcnRWYXJpYWJsZXNDb2xsZWN0aW9uKCBmb3JtQ29uZmlnWyBcInZhcmlhYmxlcy1jb2xsZWN0aW9uXCIgXSApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0QXBwLkNoYXJ0VmFyaWFibGVzQ29sbGVjdGlvbiA9IG5ldyBBcHAuQ29sbGVjdGlvbnMuQ2hhcnRWYXJpYWJsZXNDb2xsZWN0aW9uKCk7XG5cdFx0XHR9XG5cdFx0XHRpZiggZm9ybUNvbmZpZyAmJiBmb3JtQ29uZmlnWyBcImVudGl0aWVzLWNvbGxlY3Rpb25cIiBdICkge1xuXHRcdFx0XHRBcHAuQXZhaWxhYmxlRW50aXRpZXNDb2xsZWN0aW9uID0gbmV3IEFwcC5Db2xsZWN0aW9ucy5BdmFpbGFibGVFbnRpdGllc0NvbGxlY3Rpb24oIGZvcm1Db25maWdbIFwiZW50aXRpZXMtY29sbGVjdGlvblwiIF0gKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdEFwcC5BdmFpbGFibGVFbnRpdGllc0NvbGxlY3Rpb24gPSBuZXcgQXBwLkNvbGxlY3Rpb25zLkF2YWlsYWJsZUVudGl0aWVzQ29sbGVjdGlvbigpO1xuXHRcdFx0fVxuXHRcdFx0aWYoIGZvcm1Db25maWcgJiYgZm9ybUNvbmZpZ1sgXCJkaW1lbnNpb25zXCIgXSApIHtcblx0XHRcdFx0QXBwLkNoYXJ0RGltZW5zaW9uc01vZGVsID0gbmV3IEFwcC5Nb2RlbHMuQ2hhcnREaW1lbnNpb25zTW9kZWwoKTtcblx0XHRcdFx0Ly9BcHAuQ2hhcnREaW1lbnNpb25zTW9kZWwgPSBuZXcgQXBwLk1vZGVscy5DaGFydERpbWVuc2lvbnNNb2RlbCggZm9ybUNvbmZpZ1sgXCJkaW1lbnNpb25zXCIgXSApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0QXBwLkNoYXJ0RGltZW5zaW9uc01vZGVsID0gbmV3IEFwcC5Nb2RlbHMuQ2hhcnREaW1lbnNpb25zTW9kZWwoKTtcblx0XHRcdH1cblx0XHRcdGlmKCBmb3JtQ29uZmlnICYmIGZvcm1Db25maWdbIFwiYXZhaWxhYmxlLXRpbWVcIiBdICkge1xuXHRcdFx0XHRBcHAuQXZhaWxhYmxlVGltZU1vZGVsID0gbmV3IEFwcC5Nb2RlbHMuQXZhaWxhYmxlVGltZU1vZGVsKGZvcm1Db25maWdbIFwiYXZhaWxhYmxlLXRpbWVcIiBdKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdEFwcC5BdmFpbGFibGVUaW1lTW9kZWwgPSBuZXcgQXBwLk1vZGVscy5BdmFpbGFibGVUaW1lTW9kZWwoKTtcblx0XHRcdH1cblxuXHRcdFx0Ly9jcmVhdGUgc2VhcmNoIGNvbGxlY3Rpb25cblx0XHRcdEFwcC5TZWFyY2hEYXRhQ29sbGVjdGlvbiA9IG5ldyBBcHAuQ29sbGVjdGlvbnMuU2VhcmNoRGF0YUNvbGxlY3Rpb24oKTtcblx0XHRcdFxuXHRcdFx0Ly9pcyBpdCBuZXcgb3IgZXhpc3RpbmcgY2hhcnRcblx0XHRcdGlmKCBmb3JtQ29uZmlnICYmIGZvcm1Db25maWdbIFwiZGltZW5zaW9uc1wiIF0gKSB7XG5cdFx0XHRcdC8vZXhpc3RpbmcgY2hhcnQsIG5lZWQgdG8gbG9hZCBmcmVzaCBkaW1lbnNpb25zIGZyb20gZGF0YWJhc2UgKGluIGNhc2Ugd2UndmUgYWRkZWQgZGltZW5zaW9ucyBzaW5jZSBjcmVhdGluZyBjaGFydClcblx0XHRcdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdFx0XHRBcHAuQ2hhcnREaW1lbnNpb25zTW9kZWwubG9hZENvbmZpZ3VyYXRpb24oIGZvcm1Db25maWdbIFwiZGltZW5zaW9uc1wiIF0uaWQgKTtcblx0XHRcdFx0QXBwLkNoYXJ0RGltZW5zaW9uc01vZGVsLm9uKCBcImNoYW5nZVwiLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHR0aGF0LnJlbmRlcigpO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvL25ldyBjaGFydCwgY2FuIHJlbmRlciBzdHJhaWdodCBhd2F5XG5cdFx0XHRcdHRoaXMucmVuZGVyKCk7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdFxuXHRcdFx0Ly9jcmVhdGUgc3Vidmlld3Ncblx0XHRcdHRoaXMuYmFzaWNUYWJWaWV3ID0gbmV3IEFwcC5WaWV3cy5Gb3JtLkJhc2ljVGFiVmlldyggeyBkaXNwYXRjaGVyOiB0aGlzLmRpc3BhdGNoZXIgfSApO1xuXHRcdFx0dGhpcy5heGlzVGFiVmlldyA9IG5ldyBBcHAuVmlld3MuRm9ybS5BeGlzVGFiVmlldyggeyBkaXNwYXRjaGVyOiB0aGlzLmRpc3BhdGNoZXIgfSApO1xuXHRcdFx0dGhpcy5kZXNjcmlwdGlvblRhYlZpZXcgPSBuZXcgQXBwLlZpZXdzLkZvcm0uRGVzY3JpcHRpb25UYWJWaWV3KCB7IGRpc3BhdGNoZXI6IHRoaXMuZGlzcGF0Y2hlciB9ICk7XG5cdFx0XHR0aGlzLnN0eWxpbmdUYWJWaWV3ID0gbmV3IEFwcC5WaWV3cy5Gb3JtLlN0eWxpbmdUYWJWaWV3KCB7IGRpc3BhdGNoZXI6IHRoaXMuZGlzcGF0Y2hlciB9ICk7XG5cdFx0XHR0aGlzLmV4cG9ydFRhYlZpZXcgPSBuZXcgQXBwLlZpZXdzLkZvcm0uRXhwb3J0VGFiVmlldyggeyBkaXNwYXRjaGVyOiB0aGlzLmRpc3BhdGNoZXIgfSApO1xuXHRcdFx0dGhpcy5tYXBUYWJWaWV3ID0gbmV3IEFwcC5WaWV3cy5Gb3JtLk1hcFRhYlZpZXcoIHsgZGlzcGF0Y2hlcjogdGhpcy5kaXNwYXRjaGVyIH0gKTtcblxuXHRcdFx0Ly9mZXRjaCBkb21zXG5cdFx0XHR0aGlzLiRyZW1vdmVVcGxvYWRlZEZpbGVCdG4gPSB0aGlzLiRlbC5maW5kKCBcIi5yZW1vdmUtdXBsb2FkZWQtZmlsZS1idG5cIiApO1xuXHRcdFx0dGhpcy4kZmlsZVBpY2tlciA9IHRoaXMuJGVsLmZpbmQoIFwiLmZpbGUtcGlja2VyLXdyYXBwZXIgW3R5cGU9ZmlsZV1cIiApO1xuXG5cdFx0fSxcblxuXHRcdG9uTmFtZUNoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dmFyICRpbnB1dCA9ICQoIGV2dC50YXJnZXQgKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJjaGFydC1uYW1lXCIsICRpbnB1dC52YWwoKSApO1xuXG5cdFx0fSxcblxuXHRcdG9uU3VibmFtZUNoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dmFyICR0ZXh0YXJlYSA9ICQoIGV2dC50YXJnZXQgKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJjaGFydC1zdWJuYW1lXCIsICR0ZXh0YXJlYS52YWwoKSApO1xuXG5cdFx0fSxcblxuXHRcdG9uQ3N2U2VsZWN0ZWQ6IGZ1bmN0aW9uKCBlcnIsIGRhdGEgKSB7XG5cblx0XHRcdGlmKCBlcnIgKSB7XG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoIGVyciApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuJHJlbW92ZVVwbG9hZGVkRmlsZUJ0bi5zaG93KCk7XG5cblx0XHRcdGlmKCBkYXRhICYmIGRhdGEucm93cyApIHtcblx0XHRcdFx0dmFyIG1hcHBlZERhdGEgPSBBcHAuVXRpbHMubWFwRGF0YSggZGF0YS5yb3dzICk7XG5cdFx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJjaGFydC1kYXRhXCIsIG1hcHBlZERhdGEgKTtcblx0XHRcdH1cblxuXHRcdH0sXG5cblx0XHRvblJlbW92ZVVwbG9hZGVkRmlsZTogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dGhpcy4kZmlsZVBpY2tlci5yZXBsYWNlV2l0aCggdGhpcy4kZmlsZVBpY2tlci5jbG9uZSgpICk7XG5cdFx0XHQvL3JlZmV0Y2ggZG9tXG5cdFx0XHR0aGlzLiRmaWxlUGlja2VyID0gdGhpcy4kZWwuZmluZCggXCIuZmlsZS1waWNrZXItd3JhcHBlciBbdHlwZT1maWxlXVwiICk7XG5cdFx0XHR0aGlzLiRmaWxlUGlja2VyLnByb3AoIFwiZGlzYWJsZWRcIiwgZmFsc2UpO1xuXG5cdFx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0XHRDU1YuYmVnaW4oIHRoaXMuJGZpbGVQaWNrZXIuc2VsZWN0b3IgKS5nbyggZnVuY3Rpb24oIGVyciwgZGF0YSApIHtcblx0XHRcdFx0XHR0aGF0Lm9uQ3N2U2VsZWN0ZWQoIGVyciwgZGF0YSApO1xuXHRcdFx0fSApO1xuXG5cdFx0XHR0aGlzLiRyZW1vdmVVcGxvYWRlZEZpbGVCdG4uaGlkZSgpO1xuXG5cdFx0fSxcblxuXG5cdFx0b25Gb3JtQ29sbGFwc2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0dmFyICRwYXJlbnQgPSB0aGlzLiRlbC5wYXJlbnQoKTtcblx0XHRcdCRwYXJlbnQudG9nZ2xlQ2xhc3MoIFwiZm9ybS1wYW5lbC1jb2xsYXBzZWRcIiApO1xuXHRcdFx0XG5cdFx0XHQvL3RyaWdnZXIgcmUtcmVuZGVyaW5nIG9mIGNoYXJ0XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC50cmlnZ2VyKCBcImNoYW5nZVwiICk7XG5cdFx0XHQvL2Fsc28gdHJpZ2VyIGN1c3RvbSBldmVudCBzbyB0aGF0IG1hcCBjYW4gcmVzaXplXG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC50cmlnZ2VyKCBcInJlc2l6ZVwiICk7XG5cblx0XHR9LFxuXG5cdFx0b25Gb3JtU3VibWl0OiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0XG5cdFx0XHQkLmFqYXhTZXR1cCgge1xuXHRcdFx0XHRoZWFkZXJzOiB7ICdYLUNTUkYtVE9LRU4nOiAkKCdbbmFtZT1cIl90b2tlblwiXScpLnZhbCgpIH1cblx0XHRcdH0gKTtcblxuXHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cblx0XHRcdC8vcHV0IGFsbCBjaGFuZ2VzIHRvIGNoYXJ0IG1vZGVsXG5cdFx0XHR2YXIgZm9ybUNvbmZpZyA9IHtcblx0XHRcdFx0XCJ2YXJpYWJsZXMtY29sbGVjdGlvblwiOiBBcHAuQ2hhcnRWYXJpYWJsZXNDb2xsZWN0aW9uLnRvSlNPTigpLFxuXHRcdFx0XHRcImVudGl0aWVzLWNvbGxlY3Rpb25cIjogQXBwLkF2YWlsYWJsZUVudGl0aWVzQ29sbGVjdGlvbi50b0pTT04oKSxcblx0XHRcdFx0XCJkaW1lbnNpb25zXCI6IEFwcC5DaGFydERpbWVuc2lvbnNNb2RlbC50b0pTT04oKSxcblx0XHRcdFx0XCJhdmFpbGFibGUtdGltZVwiOiBBcHAuQXZhaWxhYmxlVGltZU1vZGVsLnRvSlNPTigpXG5cdFx0XHR9O1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0KCBcImZvcm0tY29uZmlnXCIsIGZvcm1Db25maWcsIHsgc2lsZW50OiB0cnVlIH0gKTtcblxuXHRcdFx0dmFyIGRpc3BhdGNoZXIgPSB0aGlzLmRpc3BhdGNoZXI7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5zYXZlKCB7fSwge1xuXHRcdFx0XHRzdWNjZXNzOiBmdW5jdGlvbiAoIG1vZGVsLCByZXNwb25zZSwgb3B0aW9ucyApIHtcblx0XHRcdFx0XHRhbGVydCggXCJUaGUgY2hhcnQgc2F2ZWQgc3VjY2VzZnVsbHlcIiApO1xuXHRcdFx0XHRcdGRpc3BhdGNoZXIudHJpZ2dlciggXCJjaGFydC1zYXZlZFwiLCByZXNwb25zZS5kYXRhLmlkLCByZXNwb25zZS5kYXRhLnZpZXdVcmwgKTtcblx0XHRcdFx0XHQvL3VwZGF0ZSBpZCBvZiBhbiBleGlzdGluZyBtb2RlbFxuXHRcdFx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJpZFwiLCByZXNwb25zZS5kYXRhLmlkICk7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGVycm9yOiBmdW5jdGlvbiAobW9kZWwsIHhociwgb3B0aW9ucykge1xuXHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoXCJTb21ldGhpbmcgd2VudCB3cm9uZyB3aGlsZSBzYXZpbmcgdGhlIG1vZGVsXCIsIHhociApO1xuXHRcdFx0XHRcdGFsZXJ0KCBcIk9wcHMsIHRoZXJlIHdhcyBhIHByb2JsZW0gc2F2aW5nIHlvdXIgY2hhcnQuXCIgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHR9XG5cblx0fSk7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVmlld3MuRm9ybVZpZXc7XG5cbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHRBcHAuVmlld3MuSW1wb3J0VmlldyA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblxuXHRcdGRhdGFzZXROYW1lOiBcIlwiLFxuXHRcdGlzRGF0YU11bHRpVmFyaWFudDogZmFsc2UsXG5cdFx0b3JpZ1VwbG9hZGVkRGF0YTogZmFsc2UsXG5cdFx0dXBsb2FkZWREYXRhOiBmYWxzZSxcblx0XHR2YXJpYWJsZU5hbWVNYW51YWw6IGZhbHNlLFxuXG5cdFx0ZWw6IFwiI2ltcG9ydC12aWV3XCIsXG5cdFx0ZXZlbnRzOiB7XG5cdFx0XHRcInN1Ym1pdCBmb3JtXCI6IFwib25Gb3JtU3VibWl0XCIsXG5cdFx0XHRcImlucHV0IFtuYW1lPW5ld19kYXRhc2V0X25hbWVdXCI6IFwib25OZXdEYXRhc2V0TmFtZUNoYW5nZVwiLFxuXHRcdFx0XCJjaGFuZ2UgW25hbWU9bmV3X2RhdGFzZXRdXCI6IFwib25OZXdEYXRhc2V0Q2hhbmdlXCIsXG5cdFx0XHRcImNsaWNrIC5yZW1vdmUtdXBsb2FkZWQtZmlsZS1idG5cIjogXCJvblJlbW92ZVVwbG9hZGVkRmlsZVwiLFxuXHRcdFx0XCJjaGFuZ2UgW25hbWU9Y2F0ZWdvcnlfaWRdXCI6IFwib25DYXRlZ29yeUNoYW5nZVwiLFxuXHRcdFx0XCJjaGFuZ2UgW25hbWU9ZXhpc3RpbmdfZGF0YXNldF9pZF1cIjogXCJvbkV4aXN0aW5nRGF0YXNldENoYW5nZVwiLFxuXHRcdFx0XCJjaGFuZ2UgW25hbWU9ZGF0YXNvdXJjZV9pZF1cIjogXCJvbkRhdGFzb3VyY2VDaGFuZ2VcIixcblx0XHRcdFwiY2hhbmdlIFtuYW1lPWV4aXN0aW5nX3ZhcmlhYmxlX2lkXVwiOiBcIm9uRXhpc3RpbmdWYXJpYWJsZUNoYW5nZVwiLFxuXHRcdFx0XCJjaGFuZ2UgW25hbWU9c3ViY2F0ZWdvcnlfaWRdXCI6IFwib25TdWJDYXRlZ29yeUNoYW5nZVwiLFxuXHRcdFx0XCJjaGFuZ2UgW25hbWU9bXVsdGl2YXJpYW50X2RhdGFzZXRdXCI6IFwib25NdWx0aXZhcmlhbnREYXRhc2V0Q2hhbmdlXCIsXG5cdFx0XHRcImNsaWNrIC5uZXctZGF0YXNldC1kZXNjcmlwdGlvbi1idG5cIjogXCJvbkRhdGFzZXREZXNjcmlwdGlvblwiXG5cdFx0fSxcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0XG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIgPSBvcHRpb25zLmRpc3BhdGNoZXI7XG5cdFx0XHR0aGlzLnJlbmRlcigpO1xuXHRcdFx0dGhpcy5pbml0VXBsb2FkKCk7XG5cblx0XHRcdC8qdmFyIGltcG9ydGVyID0gbmV3IEFwcC5Nb2RlbHMuSW1wb3J0ZXIoKTtcblx0XHRcdGltcG9ydGVyLnVwbG9hZEZvcm1EYXRhKCk7Ki9cblxuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHQvL3NlY3Rpb25zXG5cdFx0XHR0aGlzLiRkYXRhc2V0U2VjdGlvbiA9IHRoaXMuJGVsLmZpbmQoIFwiLmRhdGFzZXQtc2VjdGlvblwiICk7XG5cdFx0XHR0aGlzLiRkYXRhc2V0VHlwZVNlY3Rpb24gPSB0aGlzLiRlbC5maW5kKCBcIi5kYXRhc2V0LXR5cGUtc2VjdGlvblwiICk7XG5cdFx0XHR0aGlzLiR1cGxvYWRTZWN0aW9uID0gdGhpcy4kZWwuZmluZCggXCIudXBsb2FkLXNlY3Rpb25cIiApO1xuXHRcdFx0dGhpcy4kdmFyaWFibGVTZWN0aW9uID0gdGhpcy4kZWwuZmluZCggXCIudmFyaWFibGVzLXNlY3Rpb25cIiApO1xuXHRcdFx0dGhpcy4kY2F0ZWdvcnlTZWN0aW9uID0gdGhpcy4kZWwuZmluZCggXCIuY2F0ZWdvcnktc2VjdGlvblwiICk7XG5cdFx0XHR0aGlzLiR2YXJpYWJsZVR5cGVTZWN0aW9uID0gdGhpcy4kZWwuZmluZCggXCIudmFyaWFibGUtdHlwZS1zZWN0aW9uXCIgKTtcblx0XHRcdFx0XG5cdFx0XHQvL3JhbmRvbSBlbHNcblx0XHRcdHRoaXMuJG5ld0RhdGFzZXREZXNjcmlwdGlvbiA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9bmV3X2RhdGFzZXRfZGVzY3JpcHRpb25dXCIgKTtcblx0XHRcdHRoaXMuJGV4aXN0aW5nRGF0YXNldFNlbGVjdCA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9ZXhpc3RpbmdfZGF0YXNldF9pZF1cIiApO1xuXHRcdFx0dGhpcy4kZXhpc3RpbmdWYXJpYWJsZXNXcmFwcGVyID0gdGhpcy4kZWwuZmluZCggXCIuZXhpc3RpbmctdmFyaWFibGUtd3JhcHBlclwiICk7XG5cdFx0XHR0aGlzLiRleGlzdGluZ1ZhcmlhYmxlc1NlbGVjdCA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9ZXhpc3RpbmdfdmFyaWFibGVfaWRdXCIgKTtcblx0XHRcdHRoaXMuJHZhcmlhYmxlU2VjdGlvbkxpc3QgPSB0aGlzLiR2YXJpYWJsZVNlY3Rpb24uZmluZCggXCJvbFwiICk7XG5cblx0XHRcdC8vaW1wb3J0IHNlY3Rpb25cblx0XHRcdHRoaXMuJGZpbGVQaWNrZXIgPSB0aGlzLiRlbC5maW5kKCBcIi5maWxlLXBpY2tlci13cmFwcGVyIFt0eXBlPWZpbGVdXCIgKTtcblx0XHRcdHRoaXMuJGRhdGFJbnB1dCA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9ZGF0YV1cIiApO1xuXHRcdFx0XG5cdFx0XHR0aGlzLiRjc3ZJbXBvcnRSZXN1bHQgPSB0aGlzLiRlbC5maW5kKCBcIi5jc3YtaW1wb3J0LXJlc3VsdFwiICk7XG5cdFx0XHR0aGlzLiRjc3ZJbXBvcnRUYWJsZVdyYXBwZXIgPSB0aGlzLiRlbC5maW5kKCBcIiNjc3YtaW1wb3J0LXRhYmxlLXdyYXBwZXJcIiApO1xuXHRcdFx0XG5cdFx0XHR0aGlzLiRuZXdEYXRhc2V0U2VjdGlvbiA9IHRoaXMuJGVsLmZpbmQoIFwiLm5ldy1kYXRhc2V0LXNlY3Rpb25cIiApO1xuXHRcdFx0dGhpcy4kZXhpc3RpbmdEYXRhc2V0U2VjdGlvbiA9IHRoaXMuJGVsLmZpbmQoIFwiLmV4aXN0aW5nLWRhdGFzZXQtc2VjdGlvblwiICk7XG5cdFx0XHR0aGlzLiRyZW1vdmVVcGxvYWRlZEZpbGVCdG4gPSB0aGlzLiRlbC5maW5kKCBcIi5yZW1vdmUtdXBsb2FkZWQtZmlsZS1idG5cIiApO1xuXG5cdFx0XHQvL2RhdGFzb3VyY2Ugc2VjdGlvblxuXHRcdFx0dGhpcy4kbmV3RGF0YXNvdXJjZVdyYXBwZXIgPSB0aGlzLiRlbC5maW5kKCBcIi5uZXctZGF0YXNvdXJjZS13cmFwcGVyXCIgKTtcblx0XHRcdHRoaXMuJHNvdXJjZURlc2NyaXB0aW9uID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT1zb3VyY2VfZGVzY3JpcHRpb25dXCIgKTtcblxuXHRcdFx0Ly9jYXRlZ29yeSBzZWN0aW9uXG5cdFx0XHR0aGlzLiRjYXRlZ29yeVNlbGVjdCA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9Y2F0ZWdvcnlfaWRdXCIgKTtcblx0XHRcdHRoaXMuJHN1YmNhdGVnb3J5U2VsZWN0ID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT1zdWJjYXRlZ29yeV9pZF1cIiApO1xuXG5cdFx0XHQvL2hpZGUgb3B0aW9uYWwgZWxlbWVudHNcblx0XHRcdHRoaXMuJG5ld0RhdGFzZXREZXNjcmlwdGlvbi5oaWRlKCk7XG5cdFx0XHQvL3RoaXMuJHZhcmlhYmxlU2VjdGlvbi5oaWRlKCk7XG5cblx0XHR9LFxuXG5cdFx0aW5pdFVwbG9hZDogZnVuY3Rpb24oKSB7XG5cblx0XHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRcdHRoaXMuJGZpbGVQaWNrZXIub24oIFwiY2hhbmdlXCIsIGZ1bmN0aW9uKCBpLCB2ICkge1xuXG5cdFx0XHRcdHZhciAkdGhpcyA9ICQoIHRoaXMgKTtcblx0XHRcdFx0JHRoaXMucGFyc2UoIHtcblx0XHRcdFx0XHRjb25maWc6IHtcblx0XHRcdFx0XHRcdGNvbXBsZXRlOiBmdW5jdGlvbiggb2JqICkge1xuXHRcdFx0XHRcdFx0XHR2YXIgZGF0YSA9IHsgcm93czogb2JqLmRhdGEgfTtcblx0XHRcdFx0XHRcdFx0dGhhdC5vbkNzdlNlbGVjdGVkKCBudWxsLCBkYXRhICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9ICk7XG5cblx0XHRcdH0gKTtcblxuXHRcdFx0LypDU1YuYmVnaW4oIHRoaXMuJGZpbGVQaWNrZXIuc2VsZWN0b3IgKVxuXHRcdFx0XHQvLy50YWJsZSggXCJjc3YtaW1wb3J0LXRhYmxlLXdyYXBwZXJcIiwgeyBoZWFkZXI6MSwgY2FwdGlvbjogXCJcIiB9IClcblx0XHRcdFx0LmdvKCBmdW5jdGlvbiggZXJyLCBkYXRhICkge1xuXHRcdFx0XHRcdHRoYXQub25Dc3ZTZWxlY3RlZCggZXJyLCBkYXRhICk7XG5cdFx0XHRcdH0gKTtcblx0XHRcdHRoaXMuJHJlbW92ZVVwbG9hZGVkRmlsZUJ0bi5oaWRlKCk7Ki9cblxuXHRcdH0sXG5cblx0XHRvbkNzdlNlbGVjdGVkOiBmdW5jdGlvbiggZXJyLCBkYXRhICkge1xuXHRcdFx0XG5cdFx0XHRpZiggIWRhdGEgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0Ly90ZXN0aW5nIG1hc3NpdmUgaW1wb3J0IHZlcnNpb24gXHRcdFx0XG5cdFx0XHQvKnRoaXMudXBsb2FkZWREYXRhID0gZGF0YTtcblx0XHRcdC8vc3RvcmUgYWxzbyBvcmlnaW5hbCwgdGhpcy51cGxvYWRlZERhdGEgd2lsbCBiZSBtb2RpZmllZCB3aGVuIGJlaW5nIHZhbGlkYXRlZFxuXHRcdFx0dGhpcy5vcmlnVXBsb2FkZWREYXRhID0gJC5leHRlbmQoIHRydWUsIHt9LCB0aGlzLnVwbG9hZGVkRGF0YSk7XG5cblx0XHRcdHRoaXMuY3JlYXRlRGF0YVRhYmxlKCBkYXRhLnJvd3MgKTtcblx0XHRcdFxuXHRcdFx0dGhpcy52YWxpZGF0ZUVudGl0eURhdGEoIGRhdGEucm93cyApO1xuXHRcdFx0dGhpcy52YWxpZGF0ZVRpbWVEYXRhKCBkYXRhLnJvd3MgKTtcblx0XHRcdFxuXHRcdFx0dGhpcy5tYXBEYXRhKCk7Ki9cblxuXHRcdFx0Ly9ub3JtYWwgdmVyc2lvblxuXG5cdFx0XHQvL2RvIHdlIG5lZWQgdG8gdHJhbnNwb3NlIGRhdGE/XG5cdFx0XHRpZiggIXRoaXMuaXNEYXRhTXVsdGlWYXJpYW50ICkge1xuXHRcdFx0XHR2YXIgaXNPcmllbnRlZCA9IHRoaXMuZGV0ZWN0T3JpZW50YXRpb24oIGRhdGEucm93cyApO1xuXHRcdFx0XHRpZiggIWlzT3JpZW50ZWQgKSB7XG5cdFx0XHRcdFx0ZGF0YS5yb3dzID0gQXBwLlV0aWxzLnRyYW5zcG9zZSggZGF0YS5yb3dzICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0dGhpcy51cGxvYWRlZERhdGEgPSBkYXRhO1xuXHRcdFx0Ly9zdG9yZSBhbHNvIG9yaWdpbmFsLCB0aGlzLnVwbG9hZGVkRGF0YSB3aWxsIGJlIG1vZGlmaWVkIHdoZW4gYmVpbmcgdmFsaWRhdGVkXG5cdFx0XHR0aGlzLm9yaWdVcGxvYWRlZERhdGEgPSAkLmV4dGVuZCggdHJ1ZSwge30sIHRoaXMudXBsb2FkZWREYXRhKTtcblx0XHRcdFxuXHRcdFx0dGhpcy5jcmVhdGVEYXRhVGFibGUoIGRhdGEucm93cyApO1xuXG5cdFx0XHR0aGlzLnZhbGlkYXRlRW50aXR5RGF0YSggZGF0YS5yb3dzICk7XG5cdFx0XHR0aGlzLnZhbGlkYXRlVGltZURhdGEoIGRhdGEucm93cyApO1xuXG5cdFx0XHR0aGlzLm1hcERhdGEoKTtcblxuXHRcdH0sXG5cblx0XHRkZXRlY3RPcmllbnRhdGlvbjogZnVuY3Rpb24oIGRhdGEgKSB7XG5cblx0XHRcdHZhciBpc09yaWVudGVkID0gdHJ1ZTtcblxuXHRcdFx0Ly9maXJzdCByb3csIHNlY29uZCBjZWxsLCBzaG91bGQgYmUgbnVtYmVyICh0aW1lKVxuXHRcdFx0aWYoIGRhdGEubGVuZ3RoID4gMCAmJiBkYXRhWzBdLmxlbmd0aCA+IDAgKSB7XG5cdFx0XHRcdHZhciBzZWNvbmRDZWxsID0gZGF0YVsgMCBdWyAxIF07XG5cdFx0XHRcdGlmKCBpc05hTiggc2Vjb25kQ2VsbCApICkge1xuXHRcdFx0XHRcdGlzT3JpZW50ZWQgPSBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gaXNPcmllbnRlZDtcblxuXHRcdH0sXG5cblx0XHRjcmVhdGVEYXRhVGFibGU6IGZ1bmN0aW9uKCBkYXRhICkge1xuXG5cdFx0XHR2YXIgdGFibGVTdHJpbmcgPSBcIjx0YWJsZT5cIjtcblxuXHRcdFx0Xy5lYWNoKCBkYXRhLCBmdW5jdGlvbiggcm93RGF0YSwgcm93SW5kZXggKSB7XG5cblx0XHRcdFx0dmFyIHRyID0gXCI8dHI+XCI7XG5cdFx0XHRcdF8uZWFjaCggcm93RGF0YSwgZnVuY3Rpb24oIGNlbGxEYXRhLCBjZWxsSW5kZXggKSB7XG5cdFx0XHRcdFx0Ly9pZihjZWxsRGF0YSkge1xuXHRcdFx0XHRcdFx0dmFyIHRkID0gKHJvd0luZGV4ID4gMCk/IFwiPHRkPlwiICsgY2VsbERhdGEgKyBcIjwvdGQ+XCI6IFwiPHRoPlwiICsgY2VsbERhdGEgKyBcIjwvdGg+XCI7XG5cdFx0XHRcdFx0XHR0ciArPSB0ZDtcblx0XHRcdFx0XHQvL31cblx0XHRcdFx0fSApO1xuXHRcdFx0XHR0ciArPSBcIjwvdHI+XCI7XG5cdFx0XHRcdHRhYmxlU3RyaW5nICs9IHRyO1xuXG5cdFx0XHR9ICk7XG5cblx0XHRcdHRhYmxlU3RyaW5nICs9IFwiPC90YWJsZT5cIjtcblxuXHRcdFx0dmFyICR0YWJsZSA9ICQoIHRhYmxlU3RyaW5nICk7XG5cdFx0XHR0aGlzLiRjc3ZJbXBvcnRUYWJsZVdyYXBwZXIuYXBwZW5kKCAkdGFibGUgKTtcblxuXHRcdH0sXG5cblx0XHR1cGRhdGVWYXJpYWJsZUxpc3Q6IGZ1bmN0aW9uKCBkYXRhICkge1xuXG5cdFx0XHR2YXIgJGxpc3QgPSB0aGlzLiR2YXJpYWJsZVNlY3Rpb25MaXN0O1xuXHRcdFx0JGxpc3QuZW1wdHkoKTtcblx0XHRcdFxuXHRcdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdFx0aWYoIGRhdGEgJiYgZGF0YS52YXJpYWJsZXMgKSB7XG5cdFx0XHRcdF8uZWFjaCggZGF0YS52YXJpYWJsZXMsIGZ1bmN0aW9uKCB2LCBrICkge1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdC8vaWYgd2UncmUgY3JlYXRpbmcgbmV3IHZhcmlhYmxlcyBpbmplY3RzIGludG8gZGF0YSBvYmplY3QgZXhpc3RpbmcgdmFyaWFibGVzXG5cdFx0XHRcdFx0aWYoIHRoYXQuZXhpc3RpbmdWYXJpYWJsZSAmJiB0aGF0LmV4aXN0aW5nVmFyaWFibGUuYXR0ciggXCJkYXRhLWlkXCIgKSA+IDAgKSB7XG5cdFx0XHRcdFx0XHR2LmlkID0gdGhhdC5leGlzdGluZ1ZhcmlhYmxlLmF0dHIoIFwiZGF0YS1pZFwiICk7XG5cdFx0XHRcdFx0XHR2Lm5hbWUgPSB0aGF0LmV4aXN0aW5nVmFyaWFibGUuYXR0ciggXCJkYXRhLW5hbWVcIiApO1xuXHRcdFx0XHRcdFx0di51bml0ID0gdGhhdC5leGlzdGluZ1ZhcmlhYmxlLmF0dHIoIFwiZGF0YS11bml0XCIgKTtcblx0XHRcdFx0XHRcdHYuZGVzY3JpcHRpb24gPSB0aGF0LmV4aXN0aW5nVmFyaWFibGUuYXR0ciggXCJkYXRhLWRlc2NyaXB0aW9uXCIgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dmFyICRsaSA9IHRoYXQuY3JlYXRlVmFyaWFibGVFbCggdiApO1xuXHRcdFx0XHRcdCRsaXN0LmFwcGVuZCggJGxpICk7XG5cdFx0XHRcdFxuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cblx0XHR9LFxuXG5cdFx0Y3JlYXRlVmFyaWFibGVFbDogZnVuY3Rpb24oIGRhdGEgKSB7XG5cblx0XHRcdGlmKCAhZGF0YS51bml0ICkge1xuXHRcdFx0XHRkYXRhLnVuaXQgPSBcIlwiO1xuXHRcdFx0fVxuXHRcdFx0aWYoICFkYXRhLmRlc2NyaXB0aW9uICkge1xuXHRcdFx0XHRkYXRhLmRlc2NyaXB0aW9uID0gXCJcIjtcblx0XHRcdH1cblxuXHRcdFx0dmFyIHN0cmluZ2lmaWVkID0gSlNPTi5zdHJpbmdpZnkoIGRhdGEgKTtcblx0XHRcdC8vd2VpcmQgYmVoYXZpb3VyIHdoZW4gc2luZ2xlIHF1b3RlIGluc2VydGVkIGludG8gaGlkZGVuIGlucHV0XG5cdFx0XHRzdHJpbmdpZmllZCA9IHN0cmluZ2lmaWVkLnJlcGxhY2UoIFwiJ1wiLCBcIiYjeDAwMDI3O1wiICk7XG5cdFx0XHRzdHJpbmdpZmllZCA9IHN0cmluZ2lmaWVkLnJlcGxhY2UoIFwiJ1wiLCBcIiYjeDAwMDI3O1wiICk7XG5cdFx0XHRcblx0XHRcdHZhciAkbGkgPSAkKCBcIjxsaSBjbGFzcz0ndmFyaWFibGUtaXRlbSBjbGVhcmZpeCc+PC9saT5cIiApLFxuXHRcdFx0XHQkaW5wdXROYW1lID0gJCggXCI8bGFiZWw+TmFtZSo8aW5wdXQgY2xhc3M9J2Zvcm0tY29udHJvbCcgdmFsdWU9J1wiICsgZGF0YS5uYW1lICsgXCInIHBsYWNlaG9sZGVyPSdFbnRlciB2YXJpYWJsZSBuYW1lJy8+PC9sYWJlbD5cIiApLFxuXHRcdFx0XHQkaW5wdXRVbml0ID0gJCggXCI8bGFiZWw+VW5pdDxpbnB1dCBjbGFzcz0nZm9ybS1jb250cm9sJyB2YWx1ZT0nXCIgKyBkYXRhLnVuaXQgKyBcIicgcGxhY2Vob2xkZXI9J0VudGVyIHZhcmlhYmxlIHVuaXQnIC8+PC9sYWJlbD5cIiApLFxuXHRcdFx0XHQkaW5wdXREZXNjcmlwdGlvbiA9ICQoIFwiPGxhYmVsPkRlc2NyaXB0aW9uPGlucHV0IGNsYXNzPSdmb3JtLWNvbnRyb2wnIHZhbHVlPSdcIiArIGRhdGEuZGVzY3JpcHRpb24gKyBcIicgcGxhY2Vob2xkZXI9J0VudGVyIHZhcmlhYmxlIGRlc2NyaXB0aW9uJyAvPjwvbGFiZWw+XCIgKSxcblx0XHRcdFx0JGlucHV0RGF0YSA9ICQoIFwiPGlucHV0IHR5cGU9J2hpZGRlbicgbmFtZT0ndmFyaWFibGVzW10nIHZhbHVlPSdcIiArIHN0cmluZ2lmaWVkICsgXCInIC8+XCIgKTtcblx0XHRcdFxuXHRcdFx0JGxpLmFwcGVuZCggJGlucHV0TmFtZSApO1xuXHRcdFx0JGxpLmFwcGVuZCggJGlucHV0VW5pdCApO1xuXHRcdFx0JGxpLmFwcGVuZCggJGlucHV0RGVzY3JpcHRpb24gKTtcblx0XHRcdCRsaS5hcHBlbmQoICRpbnB1dERhdGEgKTtcblx0XHRcdFx0XG5cdFx0XHR2YXIgdGhhdCA9IHRoaXMsXG5cdFx0XHRcdCRpbnB1dHMgPSAkbGkuZmluZCggXCJpbnB1dFwiICk7XG5cdFx0XHQkaW5wdXRzLm9uKCBcImlucHV0XCIsIGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHRcdC8vdXBkYXRlIHN0b3JlZCBqc29uXG5cdFx0XHRcdHZhciBqc29uID0gJC5wYXJzZUpTT04oICRpbnB1dERhdGEudmFsKCkgKTtcblx0XHRcdFx0anNvbi5uYW1lID0gJGlucHV0TmFtZS5maW5kKCBcImlucHV0XCIgKS52YWwoKTtcblx0XHRcdFx0anNvbi51bml0ID0gJGlucHV0VW5pdC5maW5kKCBcImlucHV0XCIgKS52YWwoKTtcblx0XHRcdFx0anNvbi5kZXNjcmlwdGlvbiA9ICRpbnB1dERlc2NyaXB0aW9uLmZpbmQoIFwiaW5wdXRcIiApLnZhbCgpO1xuXHRcdFx0XHQkaW5wdXREYXRhLnZhbCggSlNPTi5zdHJpbmdpZnkoIGpzb24gKSApO1xuXHRcdFx0fSApO1xuXHRcdFx0JGlucHV0cy5vbiggXCJmb2N1c1wiLCBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0XHQvL3NldCBmbGFnIHNvIHRoYXQgdmFsdWVzIGluIGlucHV0IHdvbid0IGdldCBvdmVyd3JpdHRlbiBieSBjaGFuZ2VzIHRvIGRhdGFzZXQgbmFtZVxuXHRcdFx0XHR0aGF0LnZhcmlhYmxlTmFtZU1hbnVhbCA9IHRydWU7XG5cdFx0XHR9KTtcblxuXHRcdFx0cmV0dXJuICRsaTtcblxuXHRcdH0sXG5cblx0XHRtYXBEYXRhOiBmdW5jdGlvbigpIHtcblxuXHRcdFx0XG5cdFx0XHQvL21hc3NpdmUgaW1wb3J0IHZlcnNpb25cblx0XHRcdC8vdmFyIG1hcHBlZERhdGEgPSBBcHAuVXRpbHMubWFwUGFuZWxEYXRhKCB0aGlzLnVwbG9hZGVkRGF0YS5yb3dzICksXG5cdFx0XHR2YXIgbWFwcGVkRGF0YSA9ICggIXRoaXMuaXNEYXRhTXVsdGlWYXJpYW50ICk/ICBBcHAuVXRpbHMubWFwU2luZ2xlVmFyaWFudERhdGEoIHRoaXMudXBsb2FkZWREYXRhLnJvd3MsIHRoaXMuZGF0YXNldE5hbWUgKTogQXBwLlV0aWxzLm1hcE11bHRpVmFyaWFudERhdGEoIHRoaXMudXBsb2FkZWREYXRhLnJvd3MgKSxcblx0XHRcdFx0anNvbiA9IHsgXCJ2YXJpYWJsZXNcIjogbWFwcGVkRGF0YSB9LFxuXHRcdFx0XHRqc29uU3RyaW5nID0gSlNPTi5zdHJpbmdpZnkoIGpzb24gKTtcblxuXHRcdFx0dGhpcy4kZGF0YUlucHV0LnZhbCgganNvblN0cmluZyApO1xuXHRcdFx0dGhpcy4kcmVtb3ZlVXBsb2FkZWRGaWxlQnRuLnNob3coKTtcblxuXHRcdFx0dGhpcy51cGRhdGVWYXJpYWJsZUxpc3QoIGpzb24gKTtcblxuXHRcdH0sXG5cblx0XHR2YWxpZGF0ZUVudGl0eURhdGE6IGZ1bmN0aW9uKCBkYXRhICkge1xuXG5cdFx0XHQvKmlmKCB0aGlzLmlzRGF0YU11bHRpVmFyaWFudCApIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9Ki9cblxuXHRcdFx0Ly92YWxpZGF0ZUVudGl0eURhdGEgZG9lc24ndCBtb2RpZnkgdGhlIG9yaWdpbmFsIGRhdGFcblx0XHRcdHZhciAkZGF0YVRhYmxlV3JhcHBlciA9ICQoIFwiLmNzdi1pbXBvcnQtdGFibGUtd3JhcHBlclwiICksXG5cdFx0XHRcdCRkYXRhVGFibGUgPSAkZGF0YVRhYmxlV3JhcHBlci5maW5kKCBcInRhYmxlXCIgKSxcblx0XHRcdFx0JGVudGl0aWVzQ2VsbHMgPSAkZGF0YVRhYmxlLmZpbmQoIFwidGQ6Zmlyc3QtY2hpbGRcIiApLFxuXHRcdFx0XHQvLyRlbnRpdGllc0NlbGxzID0gJGRhdGFUYWJsZS5maW5kKCBcInRoXCIgKSxcblx0XHRcdFx0ZW50aXRpZXMgPSBfLm1hcCggJGVudGl0aWVzQ2VsbHMsIGZ1bmN0aW9uKCB2ICkgeyByZXR1cm4gJCggdiApLnRleHQoKTsgfSApO1xuXG5cdFx0XHQvL21ha2Ugc3VyZSB3ZSdyZSBub3QgdmFsaWRhdGluZyBvbmUgZW50aXR5IG11bHRpcGxlIHRpbWVzXG5cdFx0XHRlbnRpdGllcyA9IF8udW5pcSggZW50aXRpZXMgKTtcblx0XHRcdFxuXHRcdFx0Ly9nZXQgcmlkIG9mIGZpcnN0IG9uZSAodGltZSBsYWJlbClcblx0XHRcdC8vZW50aXRpZXMuc2hpZnQoKTtcblxuXHRcdFx0JC5hamF4KCB7XG5cdFx0XHRcdHVybDogR2xvYmFsLnJvb3RVcmwgKyBcIi9lbnRpdHlJc29OYW1lcy92YWxpZGF0ZURhdGFcIixcblx0XHRcdFx0ZGF0YTogeyBcImVudGl0aWVzXCI6IEpTT04uc3RyaW5naWZ5KCBlbnRpdGllcyApIH0sXG5cdFx0XHRcdGJlZm9yZVNlbmQ6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdCRkYXRhVGFibGVXcmFwcGVyLmJlZm9yZSggXCI8cCBjbGFzcz0nZW50aXRpZXMtbG9hZGluZy1ub3RpY2UgbG9hZGluZy1ub3RpY2UnPlZhbGlkYXRpbmcgZW50aXRpZXM8L3A+XCIgKTtcblx0XHRcdFx0fSxcblx0XHRcdFx0c3VjY2VzczogZnVuY3Rpb24oIHJlc3BvbnNlICkge1xuXHRcdFx0XHRcdGlmKCByZXNwb25zZS5kYXRhICkge1xuXHRcdFx0XHRcdFx0XHRcblx0XHRcdFx0XHRcdHZhciB1bm1hdGNoZWQgPSByZXNwb25zZS5kYXRhO1xuXHRcdFx0XHRcdFx0JGVudGl0aWVzQ2VsbHMucmVtb3ZlQ2xhc3MoIFwiYWxlcnQtZXJyb3JcIiApO1xuXHRcdFx0XHRcdFx0JC5lYWNoKCAkZW50aXRpZXNDZWxscywgZnVuY3Rpb24oIGksIHYgKSB7XG5cdFx0XHRcdFx0XHRcdHZhciAkZW50aXR5Q2VsbCA9ICQoIHRoaXMgKSxcblx0XHRcdFx0XHRcdFx0XHR2YWx1ZSA9ICRlbnRpdHlDZWxsLnRleHQoKTtcblx0XHRcdFx0XHRcdFx0XHQkZW50aXR5Q2VsbC5yZW1vdmVDbGFzcyggXCJhbGVydC1lcnJvclwiICk7XG5cdFx0XHRcdFx0XHRcdFx0JGVudGl0eUNlbGwuYWRkQ2xhc3MoIFwiYWxlcnQtc3VjY2Vzc1wiICk7XG5cdFx0XHRcdFx0XHRcdGlmKCBfLmluZGV4T2YoIHVubWF0Y2hlZCwgdmFsdWUgKSA+IC0xICkge1xuXHRcdFx0XHRcdFx0XHRcdCRlbnRpdHlDZWxsLmFkZENsYXNzKCBcImFsZXJ0LWVycm9yXCIgKTtcblx0XHRcdFx0XHRcdFx0XHQkZW50aXR5Q2VsbC5yZW1vdmVDbGFzcyggXCJhbGVydC1zdWNjZXNzXCIgKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSApO1xuXG5cdFx0XHRcdFx0XHQvL3JlbW92ZSBwcmVsb2FkZXJcblx0XHRcdFx0XHRcdCQoIFwiLmVudGl0aWVzLWxvYWRpbmctbm90aWNlXCIgKS5yZW1vdmUoKTtcblx0XHRcdFx0XHRcdC8vcmVzdWx0IG5vdGljZVxuXHRcdFx0XHRcdFx0JCggXCIuZW50aXRpZXMtdmFsaWRhdGlvbi13cmFwcGVyXCIgKS5yZW1vdmUoKTtcblx0XHRcdFx0XHRcdHZhciAkcmVzdWx0Tm90aWNlID0gKHVubWF0Y2hlZC5sZW5ndGgpPyAkKCBcIjxkaXYgY2xhc3M9J2VudGl0aWVzLXZhbGlkYXRpb24td3JhcHBlcic+PHAgY2xhc3M9J2VudGl0aWVzLXZhbGlkYXRpb24tcmVzdWx0IHZhbGlkYXRpb24tcmVzdWx0IHRleHQtZGFuZ2VyJz48aSBjbGFzcz0nZmEgZmEtZXhjbGFtYXRpb24tY2lyY2xlJz48L2k+U29tZSBjb3VudHJpZXMgZG8gbm90IGhhdmUgPGEgaHJlZj0naHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9JU09fMzE2NicgdGFyZ2V0PSdfYmxhbmsnPnN0YW5kYXJkaXplZCBuYW1lPC9hPiEgUmVuYW1lIHRoZSBoaWdobGlnaHRlZCBjb3VudHJpZXMgYW5kIHJldXBsb2FkIENTVi48L3A+PGxhYmVsPjxpbnB1dCB0eXBlPSdjaGVja2JveCcgbmFtZT0ndmFsaWRhdGVfZW50aXRpZXMnLz5JbXBvcnQgY291bnRyaWVzIGFueXdheTwvbGFiZWw+PC9kaXY+XCIgKTogJCggXCI8cCBjbGFzcz0nZW50aXRpZXMtdmFsaWRhdGlvbi1yZXN1bHQgdmFsaWRhdGlvbi1yZXN1bHQgdGV4dC1zdWNjZXNzJz48aSBjbGFzcz0nZmEgZmEtY2hlY2stY2lyY2xlJz48L2k+QWxsIGNvdW50cmllcyBoYXZlIHN0YW5kYXJkaXplZCBuYW1lLCB3ZWxsIGRvbmUhPC9wPlwiICk7XG5cdFx0XHRcdFx0XHQkZGF0YVRhYmxlV3JhcHBlci5iZWZvcmUoICRyZXN1bHROb3RpY2UgKTtcblxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0XG5cdFx0fSxcblxuXHRcdHZhbGlkYXRlVGltZURhdGE6IGZ1bmN0aW9uKCBkYXRhICkge1xuXG5cdFx0XHR2YXIgJGRhdGFUYWJsZVdyYXBwZXIgPSAkKCBcIi5jc3YtaW1wb3J0LXRhYmxlLXdyYXBwZXJcIiApLFxuXHRcdFx0XHQkZGF0YVRhYmxlID0gJGRhdGFUYWJsZVdyYXBwZXIuZmluZCggXCJ0YWJsZVwiICksXG5cdFx0XHRcdC8vbWFzc2l2ZSBpbXBvcnQgdmVyc2lvblxuXHRcdFx0XHQvL3RpbWVEb21haW4gPSAkZGF0YVRhYmxlLmZpbmQoIFwidGg6bnRoLWNoaWxkKDIpXCIgKS50ZXh0KCksXG5cdFx0XHRcdHRpbWVEb21haW4gPSAoICF0aGlzLmlzRGF0YU11bHRpVmFyaWFudCApPyAkZGF0YVRhYmxlLmZpbmQoIFwidGg6Zmlyc3QtY2hpbGRcIiApLnRleHQoKTogJGRhdGFUYWJsZS5maW5kKCBcInRoOm50aC1jaGlsZCgyKVwiICkudGV4dCgpLFxuXHRcdFx0XHQkdGltZXNDZWxscyA9ICggIXRoaXMuaXNEYXRhTXVsdGlWYXJpYW50ICk/ICRkYXRhVGFibGUuZmluZCggXCJ0aFwiICk6ICRkYXRhVGFibGUuZmluZCggXCJ0ZDpudGgtY2hpbGQoMilcIiApOy8qLFxuXHRcdFx0XHQvL21hc3NpdmUgaW1wb3J0IHZlcnNpb25cblx0XHRcdFx0Ly8kdGltZXNDZWxscyA9ICRkYXRhVGFibGUuZmluZCggXCJ0ZDpudGgtY2hpbGQoMilcIiApOy8qLFxuXHRcdFx0XHR0aW1lcyA9IF8ubWFwKCAkdGltZXNDZWxscywgZnVuY3Rpb24oIHYgKSB7IHJldHVybiAkKCB2ICkudGV4dCgpIH0gKTsqL1xuXHRcdFx0Ly9mb3JtYXQgdGltZSBkb21haW4gbWF5YmVcblx0XHRcdGlmKCB0aW1lRG9tYWluICkge1xuXHRcdFx0XHR0aW1lRG9tYWluID0gdGltZURvbWFpbi50b0xvd2VyQ2FzZSgpO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHQvL3RoZSBmaXJzdCBjZWxsICh0aW1lRG9tYWluKSBzaG91bGRuJ3QgYmUgdmFsaWRhdGVkXG5cdFx0XHQvL21hc3NpdmUgaW1wb3J0IHZlcnNpb24gLSBjb21tZW50ZWQgb3V0IG5leHQgcm93XG5cdFx0XHRpZiggIXRoaXMuaXNEYXRhTXVsdGlWYXJpYW50ICkge1xuXHRcdFx0XHQkdGltZXNDZWxscyA9ICR0aW1lc0NlbGxzLnNsaWNlKCAxICk7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdC8vbWFrZSBzdXJlIHRpbWUgaXMgZnJvbSBnaXZlbiBkb21haW5cblx0XHRcdGlmKCBfLmluZGV4T2YoIFsgXCJjZW50dXJ5XCIsIFwiZGVjYWRlXCIsIFwicXVhcnRlciBjZW50dXJ5XCIsIFwiaGFsZiBjZW50dXJ5XCIsIFwieWVhclwiIF0sIHRpbWVEb21haW4gKSA9PSAtMSApIHtcblx0XHRcdFx0dmFyICRyZXN1bHROb3RpY2UgPSAkKCBcIjxwIGNsYXNzPSd0aW1lLWRvbWFpbi12YWxpZGF0aW9uLXJlc3VsdCB2YWxpZGF0aW9uLXJlc3VsdCB0ZXh0LWRhbmdlcic+PGkgY2xhc3M9J2ZhIGZhLWV4Y2xhbWF0aW9uLWNpcmNsZSc+PC9pPkZpcnN0IHRvcC1sZWZ0IGNlbGwgc2hvdWxkIGNvbnRhaW4gdGltZSBkb21haW4gaW5mb21hcnRpb24uIEVpdGhlciAnY2VudHVyeScsIG9yJ2RlY2FkZScsIG9yICd5ZWFyJy48L3A+XCIgKTtcblx0XHRcdFx0JGRhdGFUYWJsZVdyYXBwZXIuYmVmb3JlKCAkcmVzdWx0Tm90aWNlICk7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRcdCQuZWFjaCggJHRpbWVzQ2VsbHMsIGZ1bmN0aW9uKCBpLCB2ICkge1xuXG5cdFx0XHRcdHZhciAkdGltZUNlbGwgPSAkKCB2ICk7XG5cdFx0XHRcdFxuXHRcdFx0XHQvL2ZpbmQgY29ycmVzcG9uZGluZyB2YWx1ZSBpbiBsb2FkZWQgZGF0YVxuXHRcdFx0XHR2YXIgbmV3VmFsdWUsXG5cdFx0XHRcdFx0Ly9tYXNzaXZlIGltcG9ydCB2ZXJzaW9uXG5cdFx0XHRcdFx0Ly9vcmlnVmFsdWUgPSBkYXRhWyBpKzEgXVsgMSBdO1xuXHRcdFx0XHRcdG9yaWdWYWx1ZSA9ICggIXRoYXQuaXNEYXRhTXVsdGlWYXJpYW50ICk/IGRhdGFbIDAgXVsgaSsxIF06IGRhdGFbIGkrMSBdWyAxIF07XG5cdFx0XHRcdFxuXHRcdFx0XHQvL2NoZWNrIHZhbHVlIGhhcyA0IGRpZ2l0c1xuXHRcdFx0XHRvcmlnVmFsdWUgPSBBcHAuVXRpbHMuYWRkWmVyb3MoIG9yaWdWYWx1ZSApO1xuXG5cdFx0XHRcdHZhciB2YWx1ZSA9IG9yaWdWYWx1ZSxcblx0XHRcdFx0XHRkYXRlID0gbW9tZW50KCBuZXcgRGF0ZSggdmFsdWUgKSApO1xuXHRcdFx0XHRcblx0XHRcdFx0aWYoICFkYXRlLmlzVmFsaWQoKSApIHtcblxuXHRcdFx0XHRcdCR0aW1lQ2VsbC5hZGRDbGFzcyggXCJhbGVydC1lcnJvclwiICk7XG5cdFx0XHRcdFx0JHRpbWVDZWxsLnJlbW92ZUNsYXNzKCBcImFsZXJ0LXN1Y2Nlc3NcIiApO1xuXHRcdFx0XHRcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHQvL2NvcnJlY3QgZGF0ZVxuXHRcdFx0XHRcdCR0aW1lQ2VsbC5hZGRDbGFzcyggXCJhbGVydC1zdWNjZXNzXCIgKTtcblx0XHRcdFx0XHQkdGltZUNlbGwucmVtb3ZlQ2xhc3MoIFwiYWxlcnQtZXJyb3JcIiApO1xuXHRcdFx0XHRcdC8vaW5zZXJ0IHBvdGVudGlhbGx5IG1vZGlmaWVkIHZhbHVlIGludG8gY2VsbFxuXHRcdFx0XHRcdCR0aW1lQ2VsbC50ZXh0KCB2YWx1ZSApO1xuXG5cdFx0XHRcdFx0bmV3VmFsdWUgPSB7IFwiZFwiOiBBcHAuVXRpbHMucm91bmRUaW1lKCBkYXRlICksIFwibFwiOiBvcmlnVmFsdWUgfTtcblxuXHRcdFx0XHRcdGlmKCB0aW1lRG9tYWluID09IFwieWVhclwiICkge1xuXHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHQvL3RyeSB0byBndWVzcyBjZW50dXJ5XG5cdFx0XHRcdFx0XHR2YXIgeWVhciA9IE1hdGguZmxvb3IoIG9yaWdWYWx1ZSApLFxuXHRcdFx0XHRcdFx0XHRuZXh0WWVhciA9IHllYXIgKyAxO1xuXG5cdFx0XHRcdFx0XHQvL2FkZCB6ZXJvc1xuXHRcdFx0XHRcdFx0eWVhciA9IEFwcC5VdGlscy5hZGRaZXJvcyggeWVhciApO1xuXHRcdFx0XHRcdFx0bmV4dFllYXIgPSBBcHAuVXRpbHMuYWRkWmVyb3MoIG5leHRZZWFyICk7XG5cdFx0XHRcdFx0XHRcblx0XHRcdFx0XHRcdC8vY29udmVydCBpdCB0byBkYXRldGltZSB2YWx1ZXNcblx0XHRcdFx0XHRcdHllYXIgPSBtb21lbnQoIG5ldyBEYXRlKCB5ZWFyLnRvU3RyaW5nKCkgKSApO1xuXHRcdFx0XHRcdFx0bmV4dFllYXIgPSBtb21lbnQoIG5ldyBEYXRlKCBuZXh0WWVhci50b1N0cmluZygpICkgKS5zZWNvbmRzKC0xKTtcblx0XHRcdFx0XHRcdC8vbW9kaWZ5IHRoZSBpbml0aWFsIHZhbHVlXG5cdFx0XHRcdFx0XHRuZXdWYWx1ZVsgXCJzZFwiIF0gPSAgQXBwLlV0aWxzLnJvdW5kVGltZSggeWVhciApO1xuXHRcdFx0XHRcdFx0bmV3VmFsdWVbIFwiZWRcIiBdID0gIEFwcC5VdGlscy5yb3VuZFRpbWUoIG5leHRZZWFyICk7XG5cblx0XHRcdFx0XHR9IGVsc2UgaWYoIHRpbWVEb21haW4gPT0gXCJkZWNhZGVcIiApIHtcblx0XHRcdFx0XHRcdFxuXHRcdFx0XHRcdFx0Ly90cnkgdG8gZ3Vlc3MgY2VudHVyeVxuXHRcdFx0XHRcdFx0dmFyIGRlY2FkZSA9IE1hdGguZmxvb3IoIG9yaWdWYWx1ZSAvIDEwICkgKiAxMCxcblx0XHRcdFx0XHRcdFx0bmV4dERlY2FkZSA9IGRlY2FkZSArIDEwO1xuXHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHQvL2FkZCB6ZXJvc1xuXHRcdFx0XHRcdFx0ZGVjYWRlID0gQXBwLlV0aWxzLmFkZFplcm9zKCBkZWNhZGUgKTtcblx0XHRcdFx0XHRcdG5leHREZWNhZGUgPSBBcHAuVXRpbHMuYWRkWmVyb3MoIG5leHREZWNhZGUgKTtcblxuXHRcdFx0XHRcdFx0Ly9jb252ZXJ0IGl0IHRvIGRhdGV0aW1lIHZhbHVlc1xuXHRcdFx0XHRcdFx0ZGVjYWRlID0gbW9tZW50KCBuZXcgRGF0ZSggZGVjYWRlLnRvU3RyaW5nKCkgKSApO1xuXHRcdFx0XHRcdFx0bmV4dERlY2FkZSA9IG1vbWVudCggbmV3IERhdGUoIG5leHREZWNhZGUudG9TdHJpbmcoKSApICkuc2Vjb25kcygtMSk7XG5cdFx0XHRcdFx0XHQvL21vZGlmeSB0aGUgaW5pdGlhbCB2YWx1ZVxuXHRcdFx0XHRcdFx0bmV3VmFsdWVbIFwic2RcIiBdID0gIEFwcC5VdGlscy5yb3VuZFRpbWUoIGRlY2FkZSApO1xuXHRcdFx0XHRcdFx0bmV3VmFsdWVbIFwiZWRcIiBdID0gIEFwcC5VdGlscy5yb3VuZFRpbWUoIG5leHREZWNhZGUgKTtcblxuXHRcdFx0XHRcdH0gZWxzZSBpZiggdGltZURvbWFpbiA9PSBcInF1YXJ0ZXIgY2VudHVyeVwiICkge1xuXHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHQvL3RyeSB0byBndWVzcyBxdWFydGVyIGNlbnR1cnlcblx0XHRcdFx0XHRcdHZhciBjZW50dXJ5ID0gTWF0aC5mbG9vciggb3JpZ1ZhbHVlIC8gMTAwICkgKiAxMDAsXG5cdFx0XHRcdFx0XHRcdG1vZHVsbyA9ICggb3JpZ1ZhbHVlICUgMTAwICksXG5cdFx0XHRcdFx0XHRcdHF1YXJ0ZXJDZW50dXJ5O1xuXHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHQvL3doaWNoIHF1YXJ0ZXIgaXMgaXRcblx0XHRcdFx0XHRcdGlmKCBtb2R1bG8gPCAyNSApIHtcblx0XHRcdFx0XHRcdFx0cXVhcnRlckNlbnR1cnkgPSBjZW50dXJ5O1xuXHRcdFx0XHRcdFx0fSBlbHNlIGlmKCBtb2R1bG8gPCA1MCApIHtcblx0XHRcdFx0XHRcdFx0cXVhcnRlckNlbnR1cnkgPSBjZW50dXJ5KzI1O1xuXHRcdFx0XHRcdFx0fSBlbHNlIGlmKCBtb2R1bG8gPCA3NSApIHtcblx0XHRcdFx0XHRcdFx0cXVhcnRlckNlbnR1cnkgPSBjZW50dXJ5KzUwO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0cXVhcnRlckNlbnR1cnkgPSBjZW50dXJ5Kzc1O1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcblx0XHRcdFx0XHRcdHZhciBuZXh0UXVhcnRlckNlbnR1cnkgPSBxdWFydGVyQ2VudHVyeSArIDI1O1xuXG5cdFx0XHRcdFx0XHQvL2FkZCB6ZXJvc1xuXHRcdFx0XHRcdFx0cXVhcnRlckNlbnR1cnkgPSBBcHAuVXRpbHMuYWRkWmVyb3MoIHF1YXJ0ZXJDZW50dXJ5ICk7XG5cdFx0XHRcdFx0XHRuZXh0UXVhcnRlckNlbnR1cnkgPSBBcHAuVXRpbHMuYWRkWmVyb3MoIG5leHRRdWFydGVyQ2VudHVyeSApO1xuXG5cdFx0XHRcdFx0XHQvL2NvbnZlcnQgaXQgdG8gZGF0ZXRpbWUgdmFsdWVzXG5cdFx0XHRcdFx0XHRxdWFydGVyQ2VudHVyeSA9IG1vbWVudCggbmV3IERhdGUoIHF1YXJ0ZXJDZW50dXJ5LnRvU3RyaW5nKCkgKSApO1xuXHRcdFx0XHRcdFx0bmV4dFF1YXJ0ZXJDZW50dXJ5ID0gbW9tZW50KCBuZXcgRGF0ZSggbmV4dFF1YXJ0ZXJDZW50dXJ5LnRvU3RyaW5nKCkgKSApLnNlY29uZHMoLTEpO1xuXHRcdFx0XHRcdFx0Ly9tb2RpZnkgdGhlIGluaXRpYWwgdmFsdWVcblx0XHRcdFx0XHRcdG5ld1ZhbHVlWyBcInNkXCIgXSA9ICBBcHAuVXRpbHMucm91bmRUaW1lKCBxdWFydGVyQ2VudHVyeSApO1xuXHRcdFx0XHRcdFx0bmV3VmFsdWVbIFwiZWRcIiBdID0gIEFwcC5VdGlscy5yb3VuZFRpbWUoIG5leHRRdWFydGVyQ2VudHVyeSApO1xuXG5cdFx0XHRcdFx0fSBlbHNlIGlmKCB0aW1lRG9tYWluID09IFwiaGFsZiBjZW50dXJ5XCIgKSB7XG5cdFx0XHRcdFx0XHRcblx0XHRcdFx0XHRcdC8vdHJ5IHRvIGd1ZXNzIGhhbGYgY2VudHVyeVxuXHRcdFx0XHRcdFx0dmFyIGNlbnR1cnkgPSBNYXRoLmZsb29yKCBvcmlnVmFsdWUgLyAxMDAgKSAqIDEwMCxcblx0XHRcdFx0XHRcdFx0Ly9pcyBpdCBmaXJzdCBvciBzZWNvbmQgaGFsZj9cblx0XHRcdFx0XHRcdFx0aGFsZkNlbnR1cnkgPSAoIG9yaWdWYWx1ZSAlIDEwMCA8IDUwICk/IGNlbnR1cnk6IGNlbnR1cnkrNTAsXG5cdFx0XHRcdFx0XHRcdG5leHRIYWxmQ2VudHVyeSA9IGhhbGZDZW50dXJ5ICsgNTA7XG5cblx0XHRcdFx0XHRcdC8vYWRkIHplcm9zXG5cdFx0XHRcdFx0XHRoYWxmQ2VudHVyeSA9IEFwcC5VdGlscy5hZGRaZXJvcyggaGFsZkNlbnR1cnkgKTtcblx0XHRcdFx0XHRcdG5leHRIYWxmQ2VudHVyeSA9IEFwcC5VdGlscy5hZGRaZXJvcyggbmV4dEhhbGZDZW50dXJ5ICk7XG5cblx0XHRcdFx0XHRcdC8vY29udmVydCBpdCB0byBkYXRldGltZSB2YWx1ZXNcblx0XHRcdFx0XHRcdGhhbGZDZW50dXJ5ID0gbW9tZW50KCBuZXcgRGF0ZSggaGFsZkNlbnR1cnkudG9TdHJpbmcoKSApICk7XG5cdFx0XHRcdFx0XHRuZXh0SGFsZkNlbnR1cnkgPSBtb21lbnQoIG5ldyBEYXRlKCBuZXh0SGFsZkNlbnR1cnkudG9TdHJpbmcoKSApICkuc2Vjb25kcygtMSk7XG5cdFx0XHRcdFx0XHQvL21vZGlmeSB0aGUgaW5pdGlhbCB2YWx1ZVxuXHRcdFx0XHRcdFx0bmV3VmFsdWVbIFwic2RcIiBdID0gIEFwcC5VdGlscy5yb3VuZFRpbWUoIGhhbGZDZW50dXJ5ICk7XG5cdFx0XHRcdFx0XHRuZXdWYWx1ZVsgXCJlZFwiIF0gPSAgQXBwLlV0aWxzLnJvdW5kVGltZSggbmV4dEhhbGZDZW50dXJ5ICk7XG5cblx0XHRcdFx0XHR9IGVsc2UgaWYoIHRpbWVEb21haW4gPT0gXCJjZW50dXJ5XCIgKSB7XG5cdFx0XHRcdFx0XHRcblx0XHRcdFx0XHRcdC8vdHJ5IHRvIGd1ZXNzIGNlbnR1cnlcblx0XHRcdFx0XHRcdHZhciBjZW50dXJ5ID0gTWF0aC5mbG9vciggb3JpZ1ZhbHVlIC8gMTAwICkgKiAxMDAsXG5cdFx0XHRcdFx0XHRcdG5leHRDZW50dXJ5ID0gY2VudHVyeSArIDEwMDtcblxuXHRcdFx0XHRcdFx0Ly9hZGQgemVyb3Ncblx0XHRcdFx0XHRcdGNlbnR1cnkgPSBBcHAuVXRpbHMuYWRkWmVyb3MoIGNlbnR1cnkgKTtcblx0XHRcdFx0XHRcdG5leHRDZW50dXJ5ID0gQXBwLlV0aWxzLmFkZFplcm9zKCBuZXh0Q2VudHVyeSApO1xuXG5cdFx0XHRcdFx0XHQvL2NvbnZlcnQgaXQgdG8gZGF0ZXRpbWUgdmFsdWVzXG5cdFx0XHRcdFx0XHRjZW50dXJ5ID0gbW9tZW50KCBuZXcgRGF0ZSggY2VudHVyeS50b1N0cmluZygpICkgKTtcblx0XHRcdFx0XHRcdG5leHRDZW50dXJ5ID0gbW9tZW50KCBuZXcgRGF0ZSggbmV4dENlbnR1cnkudG9TdHJpbmcoKSApICkuc2Vjb25kcygtMSk7XG5cdFx0XHRcdFx0XHQvL21vZGlmeSB0aGUgaW5pdGlhbCB2YWx1ZVxuXHRcdFx0XHRcdFx0bmV3VmFsdWVbIFwic2RcIiBdID0gQXBwLlV0aWxzLnJvdW5kVGltZSggY2VudHVyeSApO1xuXHRcdFx0XHRcdFx0bmV3VmFsdWVbIFwiZWRcIiBdID0gQXBwLlV0aWxzLnJvdW5kVGltZSggbmV4dENlbnR1cnkgKTtcblxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vaW5zZXJ0IGluZm8gYWJvdXQgdGltZSBkb21haW5cblx0XHRcdFx0XHRuZXdWYWx1ZVsgXCJ0ZFwiIF0gPSB0aW1lRG9tYWluO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdC8vaW5pdGlhbCB3YXMgbnVtYmVyL3N0cmluZyBzbyBwYXNzZWQgYnkgdmFsdWUsIG5lZWQgdG8gaW5zZXJ0IGl0IGJhY2sgdG8gYXJyZWF5XG5cdFx0XHRcdFx0aWYoICF0aGF0LmlzRGF0YU11bHRpVmFyaWFudCApIHtcblx0XHRcdFx0XHRcdGRhdGFbIDAgXVsgaSsxIF0gPSBuZXdWYWx1ZTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0ZGF0YVsgaSsxIF1bIDEgXSA9IG5ld1ZhbHVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHQvL21hc3NpdmUgaW1wb3J0IHZlcnNpb25cblx0XHRcdFx0XHQvL2RhdGFbIGkrMSBdWyAxIF0gPSBuZXdWYWx1ZTtcblxuXHRcdFx0XHR9XG5cblx0XHRcdH0pO1xuXG5cdFx0XHR2YXIgJHJlc3VsdE5vdGljZTtcblxuXHRcdFx0Ly9yZW1vdmUgYW55IHByZXZpb3VzbHkgYXR0YWNoZWQgbm90aWZpY2F0aW9uc1xuXHRcdFx0JCggXCIudGltZXMtdmFsaWRhdGlvbi1yZXN1bHRcIiApLnJlbW92ZSgpO1xuXG5cdFx0XHRpZiggJHRpbWVzQ2VsbHMuZmlsdGVyKCBcIi5hbGVydC1lcnJvclwiICkubGVuZ3RoICkge1xuXHRcdFx0XHRcblx0XHRcdFx0JHJlc3VsdE5vdGljZSA9ICQoIFwiPHAgY2xhc3M9J3RpbWVzLXZhbGlkYXRpb24tcmVzdWx0IHZhbGlkYXRpb24tcmVzdWx0IHRleHQtZGFuZ2VyJz48aSBjbGFzcz0nZmEgZmEtZXhjbGFtYXRpb24tY2lyY2xlJz48L2k+VGltZSBpbmZvcm1hdGlvbiBpbiB0aGUgdXBsb2FkZWQgZmlsZSBpcyBub3QgaW4gPGEgaHJlZj0naHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9JU09fODYwMScgdGFyZ2V0PSdfYmxhbmsnPnN0YW5kYXJkaXplZCBmb3JtYXQgKFlZWVktTU0tREQpPC9hPiEgRml4IHRoZSBoaWdobGlnaHRlZCB0aW1lIGluZm9ybWF0aW9uIGFuZCByZXVwbG9hZCBDU1YuPC9wPlwiICk7XG5cdFx0XHRcblx0XHRcdH0gZWxzZSB7XG5cblx0XHRcdFx0JHJlc3VsdE5vdGljZSA9ICQoIFwiPHAgY2xhc3M9J3RpbWVzLXZhbGlkYXRpb24tcmVzdWx0IHZhbGlkYXRpb24tcmVzdWx0IHRleHQtc3VjY2Vzcyc+PGkgY2xhc3M9J2ZhIGZhLWNoZWNrLWNpcmNsZSc+PC9pPlRpbWUgaW5mb3JtYXRpb24gaW4gdGhlIHVwbG9hZGVkIGZpbGUgaXMgY29ycmVjdCwgd2VsbCBkb25lITwvcD5cIiApO1xuXG5cdFx0XHR9XG5cdFx0XHQkZGF0YVRhYmxlV3JhcHBlci5iZWZvcmUoICRyZXN1bHROb3RpY2UgKTtcblx0XHRcdFxuXHRcdH0sXG5cblx0XHRvbkRhdGFzZXREZXNjcmlwdGlvbjogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dmFyICRidG4gPSAkKCBldnQuY3VycmVudFRhcmdldCApO1xuXHRcdFx0XG5cdFx0XHRpZiggdGhpcy4kbmV3RGF0YXNldERlc2NyaXB0aW9uLmlzKCBcIjp2aXNpYmxlXCIgKSApIHtcblx0XHRcdFx0dGhpcy4kbmV3RGF0YXNldERlc2NyaXB0aW9uLmhpZGUoKTtcblx0XHRcdFx0JGJ0bi5maW5kKCBcInNwYW5cIiApLnRleHQoIFwiQWRkIGRhdGFzZXQgZGVzY3JpcHRpb24uXCIgKTtcblx0XHRcdFx0JGJ0bi5maW5kKCBcImlcIiApLnJlbW92ZUNsYXNzKCBcImZhLW1pbnVzXCIgKTtcblx0XHRcdFx0JGJ0bi5maW5kKCBcImlcIiApLmFkZENsYXNzKCBcImZhLXBsdXNcIiApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy4kbmV3RGF0YXNldERlc2NyaXB0aW9uLnNob3coKTtcblx0XHRcdFx0JGJ0bi5maW5kKCBcInNwYW5cIiApLnRleHQoIFwiTmV2ZXJtaW5kLCBubyBkZXNjcmlwdGlvbi5cIiApO1xuXHRcdFx0XHQkYnRuLmZpbmQoIFwiaVwiICkuYWRkQ2xhc3MoIFwiZmEtbWludXNcIiApO1xuXHRcdFx0XHQkYnRuLmZpbmQoIFwiaVwiICkucmVtb3ZlQ2xhc3MoIFwiZmEtcGx1c1wiICk7XG5cdFx0XHR9XG5cblx0XHR9LFxuXG5cdFx0b25OZXdEYXRhc2V0Q2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHR2YXIgJGlucHV0ID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKTtcblx0XHRcdGlmKCAkaW5wdXQudmFsKCkgPT09IFwiMFwiICkge1xuXHRcdFx0XHR0aGlzLiRuZXdEYXRhc2V0U2VjdGlvbi5oaWRlKCk7XG5cdFx0XHRcdHRoaXMuJGV4aXN0aW5nRGF0YXNldFNlY3Rpb24uc2hvdygpO1xuXHRcdFx0XHQvL3Nob3VsZCB3ZSBhcHBlYXIgdmFyaWFibGUgc2VsZWN0IGFzIHdlbGw/XG5cdFx0XHRcdGlmKCAhdGhpcy4kZXhpc3RpbmdEYXRhc2V0U2VsZWN0LnZhbCgpICkge1xuXHRcdFx0XHRcdHRoaXMuJGV4aXN0aW5nVmFyaWFibGVzV3JhcHBlci5oaWRlKCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy4kZXhpc3RpbmdWYXJpYWJsZXNXcmFwcGVyLnNob3coKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy4kbmV3RGF0YXNldFNlY3Rpb24uc2hvdygpO1xuXHRcdFx0XHR0aGlzLiRleGlzdGluZ0RhdGFzZXRTZWN0aW9uLmhpZGUoKTtcblx0XHRcdH1cblxuXHRcdH0sXG5cblx0XHRvbk5ld0RhdGFzZXROYW1lQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHR2YXIgJGlucHV0ID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKTtcblx0XHRcdHRoaXMuZGF0YXNldE5hbWUgPSAkaW5wdXQudmFsKCk7XG5cblx0XHRcdC8vY2hlY2sgaWYgd2UgaGF2ZSB2YWx1ZSBmb3IgdmFyaWFibGUsIGVudGVyIGlmIG5vdFxuXHRcdFx0dmFyICR2YXJpYWJsZUl0ZW1zID0gdGhpcy4kdmFyaWFibGVTZWN0aW9uTGlzdC5maW5kKCBcIi52YXJpYWJsZS1pdGVtXCIgKTtcblx0XHRcdGlmKCAkdmFyaWFibGVJdGVtcy5sZW5ndGggPT0gMSAmJiAhdGhpcy52YXJpYWJsZU5hbWVNYW51YWwgKSB7XG5cdFx0XHRcdC8vd2UgaGF2ZSBqdXN0IG9uZSwgY2hlY2sgXG5cdFx0XHRcdHZhciAkdmFyaWFibGVJdGVtID0gJHZhcmlhYmxlSXRlbXMuZXEoIDAgKSxcblx0XHRcdFx0XHQkZmlyc3RJbnB1dCA9ICR2YXJpYWJsZUl0ZW0uZmluZCggXCJpbnB1dFwiICkuZmlyc3QoKTtcblx0XHRcdFx0JGZpcnN0SW5wdXQudmFsKCB0aGlzLmRhdGFzZXROYW1lICk7XG5cdFx0XHRcdCRmaXJzdElucHV0LnRyaWdnZXIoIFwiaW5wdXRcIiApO1xuXHRcdFx0fVxuXG5cdFx0fSxcblxuXHRcdG9uRXhpc3RpbmdEYXRhc2V0Q2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHR2YXIgJGlucHV0ID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKTtcblx0XHRcdHRoaXMuZGF0YXNldE5hbWUgPSAkaW5wdXQuZmluZCggJ29wdGlvbjpzZWxlY3RlZCcgKS50ZXh0KCk7XG5cblx0XHRcdGlmKCAkaW5wdXQudmFsKCkgKSB7XG5cdFx0XHRcdC8vZmlsdGVyIHZhcmlhYmxlIHNlbGVjdCB0byBzaG93IHZhcmlhYmxlcyBvbmx5IGZyb20gZ2l2ZW4gZGF0YXNldFxuXHRcdFx0XHR2YXIgJG9wdGlvbnMgPSB0aGlzLiRleGlzdGluZ1ZhcmlhYmxlc1NlbGVjdC5maW5kKCBcIm9wdGlvblwiICk7XG5cdFx0XHRcdCRvcHRpb25zLmhpZGUoKTtcblx0XHRcdFx0JG9wdGlvbnMuZmlsdGVyKCBcIltkYXRhLWRhdGFzZXQtaWQ9XCIgKyAkaW5wdXQudmFsKCkgKyBcIl1cIiApLnNob3coKTtcblx0XHRcdFx0Ly9hcHBlYXIgYWxzbyB0aGUgZmlyc3QgZGVmYXVsdFxuXHRcdFx0XHQkb3B0aW9ucy5maXJzdCgpLnNob3coKTtcblx0XHRcdFx0dGhpcy4kZXhpc3RpbmdWYXJpYWJsZXNXcmFwcGVyLnNob3coKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuJGV4aXN0aW5nVmFyaWFibGVzV3JhcHBlci5oaWRlKCk7XG5cdFx0XHR9XG5cblx0XHR9LFxuXG5cdFx0b25FeGlzdGluZ1ZhcmlhYmxlQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHR2YXIgJGlucHV0ID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKTtcblx0XHRcdHRoaXMuZXhpc3RpbmdWYXJpYWJsZSA9ICRpbnB1dC5maW5kKCAnb3B0aW9uOnNlbGVjdGVkJyApO1xuXHRcblx0XHR9LFxuXG5cdFx0b25SZW1vdmVVcGxvYWRlZEZpbGU6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdHRoaXMuJGZpbGVQaWNrZXIucmVwbGFjZVdpdGgoIHRoaXMuJGZpbGVQaWNrZXIuY2xvbmUoKSApO1xuXHRcdFx0Ly9yZWZldGNoIGRvbVxuXHRcdFx0dGhpcy4kZmlsZVBpY2tlciA9IHRoaXMuJGVsLmZpbmQoIFwiLmZpbGUtcGlja2VyLXdyYXBwZXIgW3R5cGU9ZmlsZV1cIiApO1xuXHRcdFx0dGhpcy4kZmlsZVBpY2tlci5wcm9wKCBcImRpc2FibGVkXCIsIGZhbHNlKTtcblxuXHRcdFx0Ly9yZXNldCByZWxhdGVkIGNvbXBvbmVudHNcblx0XHRcdHRoaXMuJGNzdkltcG9ydFRhYmxlV3JhcHBlci5lbXB0eSgpO1xuXHRcdFx0dGhpcy4kZGF0YUlucHV0LnZhbChcIlwiKTtcblx0XHRcdC8vcmVtb3ZlIG5vdGlmaWNhdGlvbnNcblx0XHRcdHRoaXMuJGNzdkltcG9ydFJlc3VsdC5maW5kKCBcIi52YWxpZGF0aW9uLXJlc3VsdFwiICkucmVtb3ZlKCk7XG5cblx0XHRcdHRoaXMuaW5pdFVwbG9hZCgpO1xuXG5cdFx0fSxcblxuXHRcdG9uQ2F0ZWdvcnlDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHRcblx0XHRcdHZhciAkaW5wdXQgPSAkKCBldnQuY3VycmVudFRhcmdldCApO1xuXHRcdFx0aWYoICRpbnB1dC52YWwoKSAhPSBcIlwiICkge1xuXHRcdFx0XHR0aGlzLiRzdWJjYXRlZ29yeVNlbGVjdC5zaG93KCk7XG5cdFx0XHRcdHRoaXMuJHN1YmNhdGVnb3J5U2VsZWN0LmNzcyggXCJkaXNwbGF5XCIsIFwiYmxvY2tcIiApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy4kc3ViY2F0ZWdvcnlTZWxlY3QuaGlkZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHQvL2ZpbHRlciBzdWJjYXRlZ29yaWVzIHNlbGVjdFxuXHRcdFx0dGhpcy4kc3ViY2F0ZWdvcnlTZWxlY3QuZmluZCggXCJvcHRpb25cIiApLmhpZGUoKTtcblx0XHRcdHRoaXMuJHN1YmNhdGVnb3J5U2VsZWN0LmZpbmQoIFwib3B0aW9uW2RhdGEtY2F0ZWdvcnktaWQ9XCIgKyAkaW5wdXQudmFsKCkgKyBcIl1cIiApLnNob3coKTtcblxuXHRcdH0sXG5cblx0XHRvbkRhdGFzb3VyY2VDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdHZhciAkdGFyZ2V0ID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKTtcblx0XHRcdGlmKCAkdGFyZ2V0LnZhbCgpIDwgMSApIHtcblx0XHRcdFx0dGhpcy4kbmV3RGF0YXNvdXJjZVdyYXBwZXIuc2xpZGVEb3duKCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLiRuZXdEYXRhc291cmNlV3JhcHBlci5zbGlkZVVwKCk7XG5cdFx0XHR9XG5cblx0XHR9LFxuXG5cdFx0b25TdWJDYXRlZ29yeUNoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdFxuXHRcdH0sXG5cblx0XHRvbk11bHRpdmFyaWFudERhdGFzZXRDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdHZhciAkaW5wdXQgPSAkKCBldnQuY3VycmVudFRhcmdldCApO1xuXHRcdFx0aWYoICRpbnB1dC52YWwoKSA9PT0gXCIxXCIgKSB7XG5cdFx0XHRcdHRoaXMuaXNEYXRhTXVsdGlWYXJpYW50ID0gdHJ1ZTtcblx0XHRcdFx0Ly8kKCBcIi52YWxpZGF0aW9uLXJlc3VsdFwiICkucmVtb3ZlKCk7XG5cdFx0XHRcdC8vJCggXCIuZW50aXRpZXMtdmFsaWRhdGlvbi13cmFwcGVyXCIgKS5yZW1vdmUoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuaXNEYXRhTXVsdGlWYXJpYW50ID0gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdGlmKCB0aGlzLnVwbG9hZGVkRGF0YSAmJiB0aGlzLm9yaWdVcGxvYWRlZERhdGEgKSB7XG5cblx0XHRcdFx0Ly9pbnNlcnQgb3JpZ2luYWwgdXBsb2FkZWREYXRhIGludG8gYXJyYXkgYmVmb3JlIHByb2Nlc3Npbmdcblx0XHRcdFx0dGhpcy51cGxvYWRlZERhdGEgPSAkLmV4dGVuZCggdHJ1ZSwge30sIHRoaXMub3JpZ1VwbG9hZGVkRGF0YSk7XG5cdFx0XHRcdC8vcmUtdmFsaWRhdGVcblx0XHRcdFx0dGhpcy52YWxpZGF0ZUVudGl0eURhdGEoIHRoaXMudXBsb2FkZWREYXRhLnJvd3MgKTtcblx0XHRcdFx0dGhpcy52YWxpZGF0ZVRpbWVEYXRhKCB0aGlzLnVwbG9hZGVkRGF0YS5yb3dzICk7XG5cdFx0XHRcdHRoaXMubWFwRGF0YSgpO1xuXG5cdFx0XHR9XG5cdFx0XHRcblx0XHR9LFxuXG5cdFx0b25Gb3JtU3VibWl0OiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcblxuXHRcdFx0dmFyICR2YWxpZGF0ZUVudGl0aWVzQ2hlY2tib3ggPSAkKCBcIltuYW1lPSd2YWxpZGF0ZV9lbnRpdGllcyddXCIgKSxcblx0XHRcdFx0dmFsaWRhdGVFbnRpdGllcyA9ICggJHZhbGlkYXRlRW50aXRpZXNDaGVja2JveC5pcyggXCI6Y2hlY2tlZFwiICkgKT8gZmFsc2U6IHRydWUsXG5cdFx0XHRcdCR2YWxpZGF0aW9uUmVzdWx0cyA9IFtdO1xuXG5cdFx0XHQvL2Rpc3BsYXkgdmFsaWRhdGlvbiByZXN1bHRzXG5cdFx0XHQvL3ZhbGlkYXRlIGVudGVyZWQgZGF0YXNvdXJjZXNcblx0XHRcdHZhciAkc291cmNlRGVzY3JpcHRpb24gPSAkKCBcIltuYW1lPSdzb3VyY2VfZGVzY3JpcHRpb24nXVwiICksXG5cdFx0XHRcdHNvdXJjZURlc2NyaXB0aW9uVmFsdWUgPSAkc291cmNlRGVzY3JpcHRpb24udmFsKCksXG5cdFx0XHRcdGhhc1ZhbGlkU291cmNlID0gdHJ1ZTtcblx0XHRcdGlmKCBzb3VyY2VEZXNjcmlwdGlvblZhbHVlLnNlYXJjaCggXCI8dGQ+ZS5nLlwiICkgPiAtMSB8fCBzb3VyY2VEZXNjcmlwdGlvblZhbHVlLnNlYXJjaCggXCI8cD5lLmcuXCIgKSA+IC0xICkge1xuXHRcdFx0XHRoYXNWYWxpZFNvdXJjZSA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0dmFyICRzb3VyY2VWYWxpZGF0aW9uTm90aWNlID0gJCggXCIuc291cmNlLXZhbGlkYXRpb24tcmVzdWx0XCIgKTtcblx0XHRcdGlmKCAhaGFzVmFsaWRTb3VyY2UgKSB7XG5cdFx0XHRcdC8vaW52YWxpZFxuXHRcdFx0XHRpZiggISRzb3VyY2VWYWxpZGF0aW9uTm90aWNlLmxlbmd0aCApIHtcblx0XHRcdFx0XHQvL2RvZW5zJ3QgaGF2ZSBub3RpY2UgeWV0XG5cdFx0XHRcdFx0JHNvdXJjZVZhbGlkYXRpb25Ob3RpY2UgPSAkKCBcIjxwIGNsYXNzPSdzb3VyY2UtdmFsaWRhdGlvbi1yZXN1bHQgdmFsaWRhdGlvbi1yZXN1bHQgdGV4dC1kYW5nZXInPjxpIGNsYXNzPSdmYSBmYS1leGNsYW1hdGlvbi1jaXJjbGUnPiBQbGVhc2UgcmVwbGFjZSB0aGUgc2FtcGxlIGRhdGEgd2l0aCByZWFsIGRhdGFzb3VyY2UgaW5mby48L3A+XCIgKTtcblx0XHRcdFx0XHQkc291cmNlRGVzY3JpcHRpb24uYmVmb3JlKCAkc291cmNlVmFsaWRhdGlvbk5vdGljZSApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdCRzb3VyY2VWYWxpZGF0aW9uTm90aWNlLnNob3coKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly92YWxpZCwgbWFrZSBzdXJlIHRoZXJlJ3Mgbm90IFxuXHRcdFx0XHQkc291cmNlVmFsaWRhdGlvbk5vdGljZS5yZW1vdmUoKTtcblx0XHRcdH1cblxuXHRcdFx0Ly9jYXRlZ29yeSB2YWxpZGF0aW9uXG5cdFx0XHR2YXIgJGNhdGVnb3J5VmFsaWRhdGlvbk5vdGljZSA9ICQoIFwiLmNhdGVnb3J5LXZhbGlkYXRpb24tcmVzdWx0XCIgKTtcblx0XHRcdGlmKCAhdGhpcy4kY2F0ZWdvcnlTZWxlY3QudmFsKCkgfHwgIXRoaXMuJHN1YmNhdGVnb3J5U2VsZWN0LnZhbCgpICkge1xuXHRcdFx0XHRpZiggISRjYXRlZ29yeVZhbGlkYXRpb25Ob3RpY2UubGVuZ3RoICkge1xuXHRcdFx0XHRcdCRjYXRlZ29yeVZhbGlkYXRpb25Ob3RpY2UgPSAkKCBcIjxwIGNsYXNzPSdjYXRlZ29yeS12YWxpZGF0aW9uLXJlc3VsdCB2YWxpZGF0aW9uLXJlc3VsdCB0ZXh0LWRhbmdlcic+PGkgY2xhc3M9J2ZhIGZhLWV4Y2xhbWF0aW9uLWNpcmNsZSc+IFBsZWFzZSBjaG9vc2UgY2F0ZWdvcnkgZm9yIHVwbG9hZGVkIGRhdGEuPC9wPlwiICk7XG5cdFx0XHRcdFx0dGhpcy4kY2F0ZWdvcnlTZWxlY3QuYmVmb3JlKCAkY2F0ZWdvcnlWYWxpZGF0aW9uTm90aWNlICk7XG5cdFx0XHRcdH0ge1xuXHRcdFx0XHRcdCRjYXRlZ29yeVZhbGlkYXRpb25Ob3RpY2Uuc2hvdygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvL3ZhbGlkLCBtYWtlIHN1cmUgdG8gcmVtb3ZlXG5cdFx0XHRcdCRjYXRlZ29yeVZhbGlkYXRpb25Ob3RpY2UucmVtb3ZlKCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vZGlmZmVyZW50IHNjZW5hcmlvcyBvZiB2YWxpZGF0aW9uXG5cdFx0XHRpZiggdmFsaWRhdGVFbnRpdGllcyApIHtcblx0XHRcdFx0Ly92YWxpZGF0ZSBib3RoIHRpbWUgYW5kIGVudGl0aXllXG5cdFx0XHRcdCR2YWxpZGF0aW9uUmVzdWx0cyA9ICQoIFwiLnZhbGlkYXRpb24tcmVzdWx0LnRleHQtZGFuZ2VyXCIgKTtcblx0XHRcdH0gZWxzZSBpZiggIXZhbGlkYXRlRW50aXRpZXMgKSB7XG5cdFx0XHRcdC8vdmFsaWRhdGUgb25seSB0aW1lXG5cdFx0XHRcdCR2YWxpZGF0aW9uUmVzdWx0cyA9ICQoIFwiLnRpbWUtZG9tYWluLXZhbGlkYXRpb24tcmVzdWx0LnRleHQtZGFuZ2VyLCAudGltZXMtdmFsaWRhdGlvbi1yZXN1bHQudGV4dC1kYW5nZXIsIC5zb3VyY2UtdmFsaWRhdGlvbi1yZXN1bHQsIC5jYXRlZ29yeS12YWxpZGF0aW9uLXJlc3VsdFwiICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvL2RvIG5vdCB2YWxpZGF0ZVxuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRjb25zb2xlLmxvZyggXCJ2YWxpZGF0aW9uUmVzdWx0cy5sZW5ndGhcIiwgJHZhbGlkYXRpb25SZXN1bHRzLmxlbmd0aCApO1xuXG5cdFx0XHRpZiggJHZhbGlkYXRpb25SZXN1bHRzLmxlbmd0aCApIHtcblx0XHRcdFx0Ly9kbyBub3Qgc2VuZCBmb3JtIGFuZCBzY3JvbGwgdG8gZXJyb3IgbWVzc2FnZVxuXHRcdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0JCgnaHRtbCwgYm9keScpLmFuaW1hdGUoe1xuXHRcdFx0XHRcdHNjcm9sbFRvcDogJHZhbGlkYXRpb25SZXN1bHRzLm9mZnNldCgpLnRvcCAtIDE4XG5cdFx0XHRcdH0sIDMwMCk7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0Ly9ldnQgXG5cdFx0XHR2YXIgJGJ0biA9ICQoIFwiW3R5cGU9c3VibWl0XVwiICk7XG5cdFx0XHQkYnRuLnByb3AoIFwiZGlzYWJsZWRcIiwgdHJ1ZSApO1xuXHRcdFx0JGJ0bi5jc3MoIFwib3BhY2l0eVwiLCAwLjUgKTtcblxuXHRcdFx0JGJ0bi5hZnRlciggXCI8cCBjbGFzcz0nc2VuZC1ub3RpZmljYXRpb24nPjxpIGNsYXNzPSdmYSBmYS1zcGlubmVyIGZhLXNwaW4nPjwvaT5TZW5kaW5nIGZvcm08L3A+XCIgKTtcblxuXHRcdFx0Ly9zZXJpYWxpemUgYXJyYXlcblx0XHRcdHZhciAkZm9ybSA9ICQoIFwiI2ltcG9ydC12aWV3ID4gZm9ybVwiICk7XG5cdFx0XHRcblx0XHRcdHZhciBpbXBvcnRlciA9IG5ldyBBcHAuTW9kZWxzLkltcG9ydGVyKCB7IGRpc3BhdGNoZXI6IHRoaXMuZGlzcGF0Y2hlciB9ICk7XG5cdFx0XHRpbXBvcnRlci51cGxvYWRGb3JtRGF0YSggJGZvcm0sIHRoaXMub3JpZ1VwbG9hZGVkRGF0YSApO1xuXG5cdFx0XHR2YXIgaW1wb3J0UHJvZ3Jlc3MgPSBuZXcgQXBwLlZpZXdzLlVJLkltcG9ydFByb2dyZXNzUG9wdXAoKTtcblx0XHRcdGltcG9ydFByb2dyZXNzLmluaXQoIHsgZGlzcGF0Y2hlcjogdGhpcy5kaXNwYXRjaGVyIH0gKTtcblx0XHRcdGltcG9ydFByb2dyZXNzLnNob3coKTtcblxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXG5cblx0XHR9XG5cblxuXHR9KTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5JbXBvcnRWaWV3O1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIENoYXJ0TW9kZWwgPSByZXF1aXJlKCBcIi4vLi4vbW9kZWxzL0FwcC5Nb2RlbHMuQ2hhcnRNb2RlbC5qc1wiICksXG5cdFx0Rm9ybVZpZXcgPSByZXF1aXJlKCBcIi4vQXBwLlZpZXdzLkZvcm1WaWV3LmpzXCIgKSxcblx0XHRDaGFydFZpZXcgPSByZXF1aXJlKCBcIi4vQXBwLlZpZXdzLkNoYXJ0Vmlldy5qc1wiICksXG5cdFx0SW1wb3J0VmlldyA9IHJlcXVpcmUoIFwiLi9BcHAuVmlld3MuSW1wb3J0Vmlldy5qc1wiICksXG5cdFx0VmFyaWFibGVTZWxlY3RzID0gcmVxdWlyZSggXCIuL3VpL0FwcC5WaWV3cy5VSS5WYXJpYWJsZVNlbGVjdHMuanNcIiApLFxuXHRcdFV0aWxzID0gcmVxdWlyZSggXCIuLy4uL0FwcC5VdGlscy5qc1wiICk7XG5cblx0QXBwLlZpZXdzLk1haW4gPSBCYWNrYm9uZS5WaWV3LmV4dGVuZCh7XG5cblx0XHRldmVudHM6IHt9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oKSB7fSxcblxuXHRcdHN0YXJ0OiBmdW5jdGlvbigpIHtcblx0XHRcdC8vcmVuZGVyIGV2ZXJ5dGhpbmcgZm9yIHRoZSBmaXJzdCB0aW1lXG5cdFx0XHR0aGlzLnJlbmRlcigpO1xuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XG5cdFx0XHR2YXIgZGlzcGF0Y2hlciA9IF8uY2xvbmUoIEJhY2tib25lLkV2ZW50cyApO1xuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gZGlzcGF0Y2hlcjtcblxuXHRcdFx0aWYoIEZvcm1WaWV3ICkge1xuXHRcdFx0XHR0aGlzLmZvcm1WaWV3ID0gbmV3IEZvcm1WaWV3KCB7IGRpc3BhdGNoZXI6IGRpc3BhdGNoZXIgfSApO1xuXHRcdFx0fVxuXHRcdFx0aWYoIENoYXJ0VmlldyApIHtcblx0XHRcdFx0dGhpcy5jaGFydFZpZXcgPSBuZXcgQ2hhcnRWaWV3KCB7IGRpc3BhdGNoZXI6IGRpc3BhdGNoZXIgfSApO1xuXHRcdFx0fVxuXHRcdFx0LyppZiggSW1wb3J0VmlldyApIHtcblx0XHRcdFx0dGhpcy5pbXBvcnRWaWV3ID0gbmV3IEltcG9ydFZpZXcoIHtkaXNwYXRjaGVyOiBkaXNwYXRjaGVyIH0gKTtcblx0XHRcdH0qL1xuXG5cdFx0XHQvL3ZhcmlhYmxlIHNlbGVjdFxuXHRcdFx0aWYoIFZhcmlhYmxlU2VsZWN0cyApIHtcblx0XHRcdFx0dmFyIHZhcmlhYmxlU2VsZWN0cyA9IG5ldyBWYXJpYWJsZVNlbGVjdHMoKTtcblx0XHRcdFx0dmFyaWFibGVTZWxlY3RzLmluaXQoKTtcblx0XHRcdH1cblxuXHRcdH1cblxuXHR9KTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5NYWluO1xuXG59KSgpO1xuIiwiOyggZnVuY3Rpb24oKSB7XG5cdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgTGVnZW5kID0gcmVxdWlyZSggXCIuL0FwcC5WaWV3cy5DaGFydC5MZWdlbmQuanNcIiApO1xuXG5cdEFwcC5WaWV3cy5DaGFydC5DaGFydFRhYiA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKCB7XG5cblx0XHRjYWNoZWRDb2xvcnM6IFtdLFxuXHRcdGVsOiBcIiNjaGFydC12aWV3XCIsXG5cdFx0ZXZlbnRzOiB7XG5cdFx0XHRcImNoYW5nZSBbbmFtZT1hdmFpbGFibGVfZW50aXRpZXNdXCI6IFwib25BdmFpbGFibGVDb3VudHJpZXNcIlxuXHRcdH0sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gb3B0aW9ucy5kaXNwYXRjaGVyO1xuXHRcdFx0dGhpcy5wYXJlbnRWaWV3ID0gb3B0aW9ucy5wYXJlbnRWaWV3O1xuXG5cdFx0XHR0aGlzLiRzdmcgPSB0aGlzLiRlbC5maW5kKCBcIiNjaGFydC1jaGFydC10YWIgc3ZnXCIgKTtcblx0XHRcdHRoaXMuJGVudGl0aWVzU2VsZWN0ID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT1hdmFpbGFibGVfZW50aXRpZXNdXCIgKTtcblx0XHRcdFxuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCBkYXRhLCB0aW1lVHlwZSwgZGltZW5zaW9ucyApIHtcblx0XHRcdFxuXHRcdFx0aWYoICFkYXRhICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdHZhciB0aGF0ID0gdGhpcztcblxuXHRcdFx0Ly9tYWtlIGxvY2FsIGNvcHkgb2YgZGF0YSBmb3Igb3VyIGZpbHRlcmluZyBuZWVkc1xuXHRcdFx0dmFyIGxvY2FsRGF0YSA9ICQuZXh0ZW5kKCB0cnVlLCBsb2NhbERhdGEsIGRhdGEgKTtcblxuXHRcdFx0dmFyIGNoYXJ0VHlwZSA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10eXBlXCIgKTtcblxuXHRcdFx0Ly9maWx0ZXIgZGF0YSBmb3Igc2VsZWN0ZWQgY291bnRyaWVzXG5cdFx0XHR2YXIgc2VsZWN0ZWRDb3VudHJpZXMgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwic2VsZWN0ZWQtY291bnRyaWVzXCIgKSxcblx0XHRcdFx0c2VsZWN0ZWRDb3VudHJpZXNCeUlkID0gW10sXG5cdFx0XHRcdHNlbGVjdGVkQ291bnRyaWVzSWRzID0gXy5tYXAoIHNlbGVjdGVkQ291bnRyaWVzLCBmdW5jdGlvbih2KSB7XG5cdFx0XHRcdFx0Ly9zdG9yZSBcblx0XHRcdFx0XHRzZWxlY3RlZENvdW50cmllc0J5SWRbIHYuaWQgXSA9IHY7XG5cdFx0XHRcdFx0cmV0dXJuICt2LmlkO1xuXHRcdFx0XHR9ICk7XG5cblx0XHRcdGlmKCBzZWxlY3RlZENvdW50cmllcyAmJiBzZWxlY3RlZENvdW50cmllc0lkcy5sZW5ndGggJiYgIUFwcC5DaGFydE1vZGVsLmdldCggXCJncm91cC1ieS12YXJpYWJsZXNcIiApICkge1xuXHRcdFx0XHRcblx0XHRcdFx0Ly9zZXQgbG9jYWwgY29weSBvZiBjb3VudHJpZXMgY29sb3IsIHRvIGJlIGFibGUgdG8gY3JlYXRlIGJyaWdodGVyXG5cdFx0XHRcdHZhciBjb3VudHJpZXNDb2xvcnMgPSBbXTtcblx0XHRcdFx0bG9jYWxEYXRhID0gXy5maWx0ZXIoIGxvY2FsRGF0YSwgZnVuY3Rpb24oIHZhbHVlLCBrZXksIGxpc3QgKSB7XG5cdFx0XHRcdFx0Ly9zZXQgY29sb3Igd2hpbGUgaW4gdGhlIGxvb3Bcblx0XHRcdFx0XHR2YXIgaWQgPSB2YWx1ZS5pZDtcblx0XHRcdFx0XHQvL25lZWQgdG8gY2hlY2sgZm9yIHNwZWNpYWwgY2FzZSwgd2hlbiB3ZSBoYXZlIG1vcmUgdmFyaWFibGVzIGZvciB0aGUgc2FtZSBjb3VudHJpZXMgKHRoZSBpZHMgd2lsbCBiZSB0aGVuIDIxLTEsIDIyLTEsIGV0Yy4pXG5cdFx0XHRcdFx0aWYoIGlkLmluZGV4T2YoIFwiLVwiICkgPiAwICkge1xuXHRcdFx0XHRcdFx0aWQgPSBwYXJzZUludCggaWQuc3BsaXQoIFwiLVwiIClbIDAgXSwgMTAgKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0aWQgPSBwYXJzZUludCggaWQsIDEwICk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0dmFyIGNvdW50cnkgPSBzZWxlY3RlZENvdW50cmllc0J5SWRbIGlkIF07XG5cdFx0XHRcdFx0aWYoIGNvdW50cnkgJiYgY291bnRyeS5jb2xvciApIHtcblx0XHRcdFx0XHRcdGlmKCAhY291bnRyaWVzQ29sb3JzWyBpZCBdICkge1xuXHRcdFx0XHRcdFx0XHRjb3VudHJpZXNDb2xvcnNbIGlkIF0gPSBjb3VudHJ5LmNvbG9yO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0Ly90aGVyZSBpcyBhbHJlYWR5IGNvbG9yIGZvciBjb3VudHJ5IChtdWx0aXZhcmlhbnQgZGF0YXNldCkgLSBjcmVhdGUgYnJpZ2h0ZXIgY29sb3Jcblx0XHRcdFx0XHRcdFx0Y291bnRyaWVzQ29sb3JzWyBpZCBdID0gZDMucmdiKCBjb3VudHJpZXNDb2xvcnNbIGlkIF0gKS5icmlnaHRlciggMSApLnRvU3RyaW5nKCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR2YWx1ZS5jb2xvciA9IGNvdW50cmllc0NvbG9yc1sgaWQgXTtcblxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR2YWx1ZSA9IHRoYXQuYXNzaWduQ29sb3JGcm9tQ2FjaGUoIHZhbHVlICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdC8vYWN0dWFsIGZpbHRlcmluZ1xuXHRcdFx0XHRcdHJldHVybiAoIF8uaW5kZXhPZiggc2VsZWN0ZWRDb3VudHJpZXNJZHMsIGlkICkgPiAtMSApO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvL1RPRE8gLSBub25zZW5zZT8gY29udmVydCBhc3NvY2lhdGl2ZSBhcnJheSB0byBhcnJheSwgYXNzaWduIGNvbG9ycyBmcm9tIGNhY2hlXG5cdFx0XHRcdGxvY2FsRGF0YSA9IF8ubWFwKCBsb2NhbERhdGEsIGZ1bmN0aW9uKCB2YWx1ZSApIHtcblx0XHRcdFx0XHR2YWx1ZSA9IHRoYXQuYXNzaWduQ29sb3JGcm9tQ2FjaGUoIHZhbHVlICk7XG5cdFx0XHRcdFx0cmV0dXJuIHZhbHVlO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cblx0XHRcdHZhciBkaXNjcmV0ZURhdGE7XG5cdFx0XHRpZiggY2hhcnRUeXBlID09IFwiNlwiICkge1xuXHRcdFx0XHR2YXIgZmxhdHRlblZhbHVlcyA9IF8ubWFwKCBsb2NhbERhdGEsIGZ1bmN0aW9uKCB2ICkge1xuXHRcdFx0XHRcdGlmKCB2ICYmIHYuY29sb3IgKSB7XG5cdFx0XHRcdFx0XHR2LnZhbHVlc1sgMCBdLmNvbG9yID0gdi5jb2xvcjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHYudmFsdWVzWzBdO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdGRpc2NyZXRlRGF0YSA9IFt7IGtleTogXCJ2YXJpYWJsZVwiLCB2YWx1ZXM6IGZsYXR0ZW5WYWx1ZXMgfV07XG5cdFx0XHRcdGxvY2FsRGF0YSA9IGRpc2NyZXRlRGF0YTtcblx0XHRcdH1cblxuXHRcdFx0Ly9maWx0ZXIgYnkgY2hhcnQgdGltZVxuXHRcdFx0dmFyIGNoYXJ0VGltZSA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10aW1lXCIgKTtcblx0XHRcdGlmKCBjaGFydFRpbWUgJiYgY2hhcnRUaW1lLmxlbmd0aCA9PSAyICkge1xuXHRcdFx0XHRcblx0XHRcdFx0dmFyIHRpbWVGcm9tID0gY2hhcnRUaW1lWyAwIF0sXG5cdFx0XHRcdFx0dGltZVRvID0gY2hhcnRUaW1lWyAxIF07XG5cdFx0XHRcdFxuXHRcdFx0XHRfLmVhY2goIGxvY2FsRGF0YSwgZnVuY3Rpb24oIHNpbmdsZURhdGEsIGtleSwgbGlzdCApIHtcblx0XHRcdFx0XHR2YXIgdmFsdWVzID0gXy5jbG9uZSggc2luZ2xlRGF0YS52YWx1ZXMgKTtcblx0XHRcdFx0XHR2YWx1ZXMgPSBfLmZpbHRlciggdmFsdWVzLCBmdW5jdGlvbiggdmFsdWUgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gKCBwYXJzZUludCggdmFsdWUudGltZSwgMTAgKSA+PSB0aW1lRnJvbSAmJiBwYXJzZUludCggdmFsdWUudGltZSwgMTAgKSA8PSB0aW1lVG8gKTtcblx0XHRcdFx0XHRcdC8vcmV0dXJuICggdmFsdWUueCA+PSB0aW1lRnJvbSAmJiB2YWx1ZS54IDw9IHRpbWVUbyApO1xuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHRzaW5nbGVEYXRhLnZhbHVlcyA9IHZhbHVlcztcblx0XHRcdFx0fSApO1xuXG5cdFx0XHR9XG5cblx0XHRcdC8vaWYgbGVnZW5kIGRpc3BsYXllZCwgc29ydCBkYXRhIG9uIGtleSBhbHBoYWJldGljYWxseSAodXNlZnVsbCB3aGVuIG11bHRpdmFyaWFuIGRhdGFzZXQpXG5cdFx0XHRpZiggIUFwcC5DaGFydE1vZGVsLmdldCggXCJoaWRlLWxlZ2VuZFwiICkgKSB7XG5cdFx0XHRcdGxvY2FsRGF0YSA9IF8uc29ydEJ5KCBsb2NhbERhdGEsIGZ1bmN0aW9uKCBvYmogKSB7IHJldHVybiBvYmoua2V5OyB9ICk7XG5cdFx0XHR9XG5cblx0XHRcdC8vZ2V0IGF4aXMgY29uZmlnc1xuXHRcdFx0dmFyIHhBeGlzID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcIngtYXhpc1wiICksXG5cdFx0XHRcdHlBeGlzID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcInktYXhpc1wiICksXG5cdFx0XHRcdHhBeGlzUHJlZml4ID0gKCB4QXhpc1sgXCJheGlzLXByZWZpeFwiIF0gfHwgXCJcIiApLFxuXHRcdFx0XHR4QXhpc1N1ZmZpeCA9ICggeEF4aXNbIFwiYXhpcy1zdWZmaXhcIiBdIHx8IFwiXCIgKSxcblx0XHRcdFx0eUF4aXNQcmVmaXggPSAoIHlBeGlzWyBcImF4aXMtcHJlZml4XCIgXSB8fCBcIlwiICksXG5cdFx0XHRcdHlBeGlzU3VmZml4ID0gKCB5QXhpc1sgXCJheGlzLXN1ZmZpeFwiIF0gfHwgXCJcIiApLFxuXHRcdFx0XHR4QXhpc0xhYmVsRGlzdGFuY2UgPSAoICt4QXhpc1sgXCJheGlzLWxhYmVsLWRpc3RhbmNlXCIgXSB8fCAwICksXG5cdFx0XHRcdHlBeGlzTGFiZWxEaXN0YW5jZSA9ICggK3lBeGlzWyBcImF4aXMtbGFiZWwtZGlzdGFuY2VcIiBdIHx8IDAgKSxcblx0XHRcdFx0eEF4aXNNaW4gPSAoIHhBeGlzWyBcImF4aXMtbWluXCIgXSB8fCBudWxsICksXG5cdFx0XHRcdHhBeGlzTWF4ID0gKCB4QXhpc1sgXCJheGlzLW1heFwiIF0gfHwgbnVsbCApLFxuXHRcdFx0XHR5QXhpc01pbiA9ICggeUF4aXNbIFwiYXhpcy1taW5cIiBdIHx8IDAgKSxcblx0XHRcdFx0eUF4aXNNYXggPSAoIHlBeGlzWyBcImF4aXMtbWF4XCIgXSB8fCBudWxsICksXG5cdFx0XHRcdHhBeGlzU2NhbGUgPSAoIHhBeGlzWyBcImF4aXMtc2NhbGVcIiBdIHx8IFwibGluZWFyXCIgKSxcblx0XHRcdFx0eUF4aXNTY2FsZSA9ICggeUF4aXNbIFwiYXhpcy1zY2FsZVwiIF0gfHwgXCJsaW5lYXJcIiApLFxuXHRcdFx0XHR4QXhpc0Zvcm1hdCA9ICggeEF4aXNbIFwiYXhpcy1mb3JtYXRcIiBdIHx8IDAgKSxcblx0XHRcdFx0eUF4aXNGb3JtYXQgPSAoIHlBeGlzWyBcImF4aXMtZm9ybWF0XCIgXSB8fCAwICk7XG5cblx0XHRcdG52LmFkZEdyYXBoKGZ1bmN0aW9uKCkge1xuXG5cdFx0XHRcdHZhciBjaGFydE9wdGlvbnMgPSB7XG5cdFx0XHRcdFx0dHJhbnNpdGlvbkR1cmF0aW9uOiAzMDAsXG5cdFx0XHRcdFx0bWFyZ2luOiB7IHRvcDowLCBsZWZ0OjUwLCByaWdodDozMCwgYm90dG9tOjAgfSwvLyBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwibWFyZ2luc1wiICksXG5cdFx0XHRcdFx0c2hvd0xlZ2VuZDogZmFsc2Vcblx0XHRcdFx0fTtcblxuXHRcdFx0XHQvL2xpbmUgdHlwZVxuXHRcdFx0XHR2YXIgbGluZVR5cGUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwibGluZS10eXBlXCIgKTtcblx0XHRcdFx0aWYoIGxpbmVUeXBlID09IDIgKSB7XG5cdFx0XHRcdFx0Y2hhcnRPcHRpb25zLmRlZmluZWQgPSBmdW5jdGlvbiggZCApIHsgcmV0dXJuIGQueSAhPT0gMDsgfTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiggbGluZVR5cGUgPT0gMCApIHtcblx0XHRcdFx0XHR0aGF0LiRlbC5hZGRDbGFzcyggXCJsaW5lLWRvdHNcIiApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoYXQuJGVsLnJlbW92ZUNsYXNzKCBcImxpbmUtZG90c1wiICk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvL2RlcGVuZGluZyBvbiBjaGFydCB0eXBlIGNyZWF0ZSBjaGFydFxuXHRcdFx0XHRpZiggY2hhcnRUeXBlID09IFwiMVwiICkge1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdC8vbGluZSBjaGFydFxuXHRcdFx0XHRcdHRoYXQuY2hhcnQgPSBudi5tb2RlbHMubGluZUNoYXJ0KCkub3B0aW9ucyggY2hhcnRPcHRpb25zICk7XG5cdFx0XHRcdFxuXHRcdFx0XHR9IGVsc2UgaWYoIGNoYXJ0VHlwZSA9PSBcIjJcIiApIHtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHQvL3NjYXR0ZXIgcGxvdFxuXHRcdFx0XHRcdHZhciBwb2ludHMgPSB0aGF0LnNjYXR0ZXJCdWJibGVTaXplKCk7XG5cdFx0XHRcdFx0dGhhdC5jaGFydCA9IG52Lm1vZGVscy5zY2F0dGVyQ2hhcnQoKS5vcHRpb25zKCBjaGFydE9wdGlvbnMgKS5wb2ludFJhbmdlKCBwb2ludHMgKS5zaG93RGlzdFgoIHRydWUgKS5zaG93RGlzdFkoIHRydWUgKTtcblx0XHRcdFx0XHRcblx0XHRcdFx0fSBlbHNlIGlmKCBjaGFydFR5cGUgPT0gXCIzXCIgKSB7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0Ly9zdGFja2VkIGFyZWEgY2hhcnRcblx0XHRcdFx0XHQvL3dlIG5lZWQgdG8gbWFrZSBzdXJlIHdlIGhhdmUgYXMgbXVjaCBkYXRhIGFzIG5lY2Vzc2FyeVxuXHRcdFx0XHRcdGlmKCBsb2NhbERhdGEubGVuZ3RoICkge1xuXHRcdFx0XHRcdFx0dmFyIGJhc2VTZXJpZXMgPSBsb2NhbERhdGFbMF07XG5cdFx0XHRcdFx0XHRfLmVhY2goIGxvY2FsRGF0YSwgZnVuY3Rpb24oIHNlcmllLCBpICkge1xuXHRcdFx0XHRcdFx0XHRpZiggaSA+IDAgKSB7XG5cdFx0XHRcdFx0XHRcdFx0Ly9tYWtlIHN1cmUgd2UgaGF2ZSB2YWx1ZXMgZm9yIGdpdmVuIHNlcmllc1xuXHRcdFx0XHRcdFx0XHRcdGlmKCBzZXJpZS52YWx1ZXMgJiYgIXNlcmllLnZhbHVlcy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHQvL2Nsb25lIGJhc2Ugc2VyaWVzXG5cdFx0XHRcdFx0XHRcdFx0XHR2YXIgY29weVZhbHVlcyA9IFtdO1xuXHRcdFx0XHRcdFx0XHRcdFx0JC5leHRlbmQodHJ1ZSwgY29weVZhbHVlcywgYmFzZVNlcmllcy52YWx1ZXMpO1xuXHRcdFx0XHRcdFx0XHRcdFx0Ly9udWxsaWZ5IHZhbHVlc1xuXHRcdFx0XHRcdFx0XHRcdFx0Xy5lYWNoKCBjb3B5VmFsdWVzLCBmdW5jdGlvbiggdiwgaSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR2LnkgPSAwO1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR2LmZha2UgPSBcInRydWVcIjtcblx0XHRcdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0XHRcdFx0c2VyaWUudmFsdWVzID0gY29weVZhbHVlcztcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0Y2hhcnRPcHRpb25zLnNob3dUb3RhbEluVG9vbHRpcCA9IHRydWU7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0dGhhdC5jaGFydCA9IG52Lm1vZGVscy5zdGFja2VkQXJlYUNoYXJ0KClcblx0XHRcdFx0XHRcdC5vcHRpb25zKCBjaGFydE9wdGlvbnMgKVxuXHRcdFx0XHRcdFx0LmNvbnRyb2xPcHRpb25zKCBbIFwiU3RhY2tlZFwiLCBcIkV4cGFuZGVkXCIgXSApXG5cdFx0XHRcdFx0XHQudXNlSW50ZXJhY3RpdmVHdWlkZWxpbmUoIHRydWUgKVxuXHRcdFx0XHRcdFx0LngoIGZ1bmN0aW9uKCBkICkgeyByZXR1cm4gZFsgXCJ4XCIgXTsgfSApXG5cdFx0XHRcdFx0XHQueSggZnVuY3Rpb24oIGQgKSB7IHJldHVybiBkWyBcInlcIiBdOyB9ICk7XG5cdFx0XHRcblx0XHRcdFx0fSBlbHNlIGlmKCBjaGFydFR5cGUgPT0gXCI0XCIgfHwgY2hhcnRUeXBlID09IFwiNVwiICkge1xuXG5cdFx0XHRcdFx0Ly9tdWx0aWJhciBjaGFydFxuXHRcdFx0XHRcdC8vd2UgbmVlZCB0byBtYWtlIHN1cmUgd2UgaGF2ZSBhcyBtdWNoIGRhdGEgYXMgbmVjZXNzYXJ5XG5cdFx0XHRcdFx0dmFyIGFsbFRpbWVzID0gW10sXG5cdFx0XHRcdFx0XHQvL3N0b3JlIHZhbHVlcyBieSBbZW50aXR5XVt0aW1lXVxuXHRcdFx0XHRcdFx0dmFsdWVzQ2hlY2sgPSBbXTtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHQvL2V4dHJhY3QgYWxsIHRpbWVzXG5cdFx0XHRcdFx0Xy5lYWNoKCBsb2NhbERhdGEsIGZ1bmN0aW9uKCB2LCBpICkge1xuXHRcdFx0XHRcdFx0XHRcblx0XHRcdFx0XHRcdHZhciBlbnRpdHlEYXRhID0gW10sXG5cdFx0XHRcdFx0XHRcdHRpbWVzID0gdi52YWx1ZXMubWFwKCBmdW5jdGlvbiggdjIsIGkgKSB7XG5cdFx0XHRcdFx0XHRcdFx0ZW50aXR5RGF0YVsgdjIueCBdID0gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gdjIueDtcblx0XHRcdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdFx0dmFsdWVzQ2hlY2tbIHYuaWQgXSA9IGVudGl0eURhdGE7XG5cdFx0XHRcdFx0XHRhbGxUaW1lcyA9IGFsbFRpbWVzLmNvbmNhdCggdGltZXMgKTtcblx0XHRcdFx0XHRcdFxuXHRcdFx0XHRcdH0gKTtcblxuXHRcdFx0XHRcdGFsbFRpbWVzID0gXy51bmlxKCBhbGxUaW1lcyApO1xuXHRcdFx0XHRcdGFsbFRpbWVzID0gXy5zb3J0QnkoIGFsbFRpbWVzICk7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0aWYoIGxvY2FsRGF0YS5sZW5ndGggKSB7XG5cdFx0XHRcdFx0XHRfLmVhY2goIGxvY2FsRGF0YSwgZnVuY3Rpb24oIHNlcmllLCBzZXJpZUluZGV4ICkge1xuXHRcdFx0XHRcdFx0XHRcblx0XHRcdFx0XHRcdFx0Ly9tYWtlIHN1cmUgd2UgaGF2ZSB2YWx1ZXMgZm9yIGdpdmVuIHNlcmllc1xuXHRcdFx0XHRcdFx0XHRfLmVhY2goIGFsbFRpbWVzLCBmdW5jdGlvbiggdGltZSwgdGltZUluZGV4ICkge1xuXHRcdFx0XHRcdFx0XHRcdGlmKCB2YWx1ZXNDaGVja1sgc2VyaWUuaWQgXSAmJiAhdmFsdWVzQ2hlY2tbIHNlcmllLmlkIF1bIHRpbWUgXSApIHtcblx0XHRcdFx0XHRcdFx0XHRcdC8vdGltZSBkb2Vzbid0IGV4aXN0aWcgZm9yIGdpdmVuIGVudGl0eSwgaW5zZXJ0IHplcm8gdmFsdWVcblx0XHRcdFx0XHRcdFx0XHRcdHZhciB6ZXJvT2JqID0ge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcImtleVwiOiBzZXJpZS5rZXksXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFwic2VyaWVcIjogc2VyaWVJbmRleCxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XCJ0aW1lXCI6IHRpbWUsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFwieFwiOiB0aW1lLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcInlcIjogMCxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XCJmYWtlXCI6IHRydWVcblx0XHRcdFx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XHRcdFx0XHRzZXJpZS52YWx1ZXMuc3BsaWNlKCB0aW1lSW5kZXgsIDAsIHplcm9PYmogKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYoIGNoYXJ0VHlwZSA9PSBcIjRcIiApIHtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHRcdHRoYXQuY2hhcnQgPSBudi5tb2RlbHMubXVsdGlCYXJDaGFydCgpLm9wdGlvbnMoIGNoYXJ0T3B0aW9ucyApO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdH0gZWxzZSBpZiggIGNoYXJ0VHlwZSA9PSBcIjVcIiApIHtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHRcdHRoYXQuY2hhcnQgPSBudi5tb2RlbHMubXVsdGlCYXJIb3Jpem9udGFsQ2hhcnQoKS5vcHRpb25zKCBjaGFydE9wdGlvbnMgKTsvLy5zaG93VmFsdWVzKCB0cnVlICk7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdH0gZWxzZSBpZiggY2hhcnRUeXBlID09IFwiNlwiICkge1xuXG5cdFx0XHRcdFx0Y2hhcnRPcHRpb25zLnNob3dWYWx1ZXMgPSB0cnVlO1xuXG5cdFx0XHRcdFx0dGhhdC5jaGFydCA9IG52Lm1vZGVscy5kaXNjcmV0ZUJhckNoYXJ0KClcblx0XHRcdFx0XHRcdC54KCBmdW5jdGlvbiggZCApIHsgcmV0dXJuIGQueDsgfSApXG5cdFx0XHRcdFx0XHQueSggZnVuY3Rpb24oIGQgKSB7IHJldHVybiBkLnk7IH0gKVxuXHRcdFx0XHRcdFx0Lm9wdGlvbnMoIGNoYXJ0T3B0aW9ucyApO1xuXG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvL2ZpeGVkIHByb2JhYmx5IGEgYnVnIGluIG52ZDMgd2l0aCBwcmV2aW91cyB0b29sdGlwIG5vdCBiZWluZyByZW1vdmVkXG5cdFx0XHRcdGQzLnNlbGVjdCggXCIueHktdG9vbHRpcFwiICkucmVtb3ZlKCk7XG5cblx0XHRcdFx0dGhhdC5jaGFydC54QXhpc1xuXHRcdFx0XHRcdC5heGlzTGFiZWwoIHhBeGlzWyBcImF4aXMtbGFiZWxcIiBdIClcblx0XHRcdFx0XHQvLy5zdGFnZ2VyTGFiZWxzKCB0cnVlIClcblx0XHRcdFx0XHQuYXhpc0xhYmVsRGlzdGFuY2UoIHhBeGlzTGFiZWxEaXN0YW5jZSApXG5cdFx0XHRcdFx0LnRpY2tGb3JtYXQoIGZ1bmN0aW9uKGQpIHtcblx0XHRcdFx0XHRcdGlmKCBjaGFydFR5cGUgIT0gMiApIHtcblx0XHRcdFx0XHRcdFx0Ly94IGF4aXMgaGFzIHRpbWUgaW5mb3JtYXRpb25cblx0XHRcdFx0XHRcdFx0cmV0dXJuIEFwcC5VdGlscy5mb3JtYXRUaW1lTGFiZWwoIHRpbWVUeXBlLCBkLCB4QXhpc1ByZWZpeCwgeEF4aXNTdWZmaXgsIHhBeGlzRm9ybWF0ICk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHQvL2lzIHNjYXR0ZXIgcGxvdCwgeC1heGlzIGhhcyBzb21lIG90aGVyIGluZm9ybWF0aW9uXG5cdFx0XHRcdFx0XHRcdHJldHVybiB4QXhpc1ByZWZpeCArIGQzLmZvcm1hdCggXCIsXCIgKSggQXBwLlV0aWxzLmZvcm1hdFZhbHVlKCBkLCB4QXhpc0Zvcm1hdCApICkgKyB4QXhpc1N1ZmZpeDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9ICk7XG5cblx0XHRcdFx0aWYoIHRpbWVUeXBlID09IFwiUXVhcnRlciBDZW50dXJ5XCIgKSB7XG5cdFx0XHRcdFx0dGhhdC5jaGFydC54QXhpcy5zdGFnZ2VyTGFiZWxzKCB0cnVlICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdC8vZ2V0IGV4dGVuZFxuXHRcdFx0XHR2YXIgYWxsVmFsdWVzID0gW107XG5cdFx0XHRcdF8uZWFjaCggbG9jYWxEYXRhLCBmdW5jdGlvbiggdiwgaSApIHtcblx0XHRcdFx0XHRpZiggdi52YWx1ZXMgKSB7XG5cdFx0XHRcdFx0XHRhbGxWYWx1ZXMgPSBhbGxWYWx1ZXMuY29uY2F0KCB2LnZhbHVlcyApO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiggJC5pc0FycmF5KCB2ICkgKXtcblx0XHRcdFx0XHRcdC8vc3BlY2lhbCBjYXNlIGZvciBkaXNjcmV0ZSBiYXIgY2hhcnRcblx0XHRcdFx0XHRcdGFsbFZhbHVlcyA9IHY7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9ICk7XG5cblx0XHRcdFx0Ly9kb21haW4gc2V0dXBcblx0XHRcdFx0dmFyIHhEb21haW4gPSBkMy5leHRlbnQoIGFsbFZhbHVlcy5tYXAoIGZ1bmN0aW9uKCBkICkgeyByZXR1cm4gZC54OyB9ICkgKSxcblx0XHRcdFx0XHR5RG9tYWluID0gZDMuZXh0ZW50KCBhbGxWYWx1ZXMubWFwKCBmdW5jdGlvbiggZCApIHsgcmV0dXJuIGQueTsgfSApICksXG5cdFx0XHRcdFx0aXNDbGFtcGVkID0gZmFsc2U7XG5cblx0XHRcdFx0Ly9jb25zb2xlLmxvZyggXCJjaGFydC5zdGFja2VkLnN0eWxlKClcIiwgdGhhdC5jaGFydC5zdGFja2VkLnN0eWxlKCkgKTtcblxuXHRcdFx0XHRpZiggeEF4aXNNaW4gJiYgIWlzTmFOKCB4QXhpc01pbiApICkge1xuXHRcdFx0XHRcdHhEb21haW5bIDAgXSA9IHhBeGlzTWluO1xuXHRcdFx0XHRcdGlzQ2xhbXBlZCA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYoIHhBeGlzTWF4ICYmICFpc05hTiggeEF4aXNNYXggKSApIHtcblx0XHRcdFx0XHR4RG9tYWluWyAxIF0gPSB4QXhpc01heDtcblx0XHRcdFx0XHRpc0NsYW1wZWQgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmKCB5QXhpc01pbiAmJiAhaXNOYU4oIHlBeGlzTWluICkgKSB7XG5cdFx0XHRcdFx0eURvbWFpblsgMCBdID0geUF4aXNNaW47XG5cdFx0XHRcdFx0aXNDbGFtcGVkID0gdHJ1ZTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvL2RlZmF1bHQgaXMgemVybyAoZG9uJ3QgZG8gaXQgZm9yIHN0YWNrIGJhciBjaGFydCwgbWVzc2VzIHVwIHRoaW5ncylcblx0XHRcdFx0XHRpZiggY2hhcnRUeXBlICE9IFwiM1wiICkge1xuXHRcdFx0XHRcdFx0eURvbWFpblsgMCBdID0gMDtcblx0XHRcdFx0XHRcdGlzQ2xhbXBlZCA9IHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGlmKCB5QXhpc01heCAmJiAhaXNOYU4oIHlBeGlzTWF4ICkgKSB7XG5cdFx0XHRcdFx0eURvbWFpblsgMSBdID0geUF4aXNNYXg7XG5cdFx0XHRcdFx0aXNDbGFtcGVkID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0Ly9tYW51YWxseSBjbGFtcCB2YWx1ZXNcblx0XHRcdFx0aWYoIGlzQ2xhbXBlZCApIHtcblxuXHRcdFx0XHRcdGlmKCBjaGFydFR5cGUgIT09IFwiNFwiICYmIGNoYXJ0VHlwZSAhPT0gXCI1XCIgJiYgY2hhcnRUeXBlICE9PSBcIjZcIiApIHtcblx0XHRcdFx0XHRcdHRoYXQuY2hhcnQuZm9yY2VYKCB4RG9tYWluICk7XG5cdFx0XHRcdFx0XHR0aGF0LmNoYXJ0LmZvcmNlWSggeURvbWFpbiApO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8qdGhhdC5jaGFydC54RG9tYWluKCB4RG9tYWluICk7XG5cdFx0XHRcdFx0dGhhdC5jaGFydC55RG9tYWluKCB5RG9tYWluICk7XG5cdFx0XHRcdFx0dGhhdC5jaGFydC54U2NhbGUoKS5jbGFtcCggdHJ1ZSApO1xuXHRcdFx0XHRcdHRoYXQuY2hhcnQueVNjYWxlKCkuY2xhbXAoIHRydWUgKTsqL1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly9zZXQgc2NhbGVzLCBtdWx0aWJhciBjaGFydFxuXHRcdFx0XHRpZiggeUF4aXNTY2FsZSA9PT0gXCJsaW5lYXJcIiApIHtcblx0XHRcdFx0XHR0aGF0LmNoYXJ0LnlTY2FsZSggZDMuc2NhbGUubGluZWFyKCkgKTtcblx0XHRcdFx0fSBlbHNlIGlmKCB5QXhpc1NjYWxlID09PSBcImxvZ1wiICkge1xuXHRcdFx0XHRcdHRoYXQuY2hhcnQueVNjYWxlKCBkMy5zY2FsZS5sb2coKSApO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYoIGNoYXJ0VHlwZSA9PT0gXCI0XCIgfHwgY2hhcnRUeXBlID09PSBcIjVcIiApIHtcblx0XHRcdFx0XHQvL2ZvciBtdWx0aWJhciBjaGFydCwgeCBheGlzIGhhcyBvcmRpbmFsIHNjYWxlLCBzbyBuZWVkIHRvIHNldHVwIGRvbWFpbiBwcm9wZXJseVxuXHRcdFx0XHRcdC8vdGhhdC5jaGFydC54RG9tYWluKCBkMy5yYW5nZSh4RG9tYWluWzBdLCB4RG9tYWluWzFdICsgMSkgKTtcblx0XHRcdFx0XHR0aGF0LmNoYXJ0LnhEb21haW4oIGFsbFRpbWVzICk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGF0LmNoYXJ0LnlBeGlzXG5cdFx0XHRcdFx0LmF4aXNMYWJlbCggeUF4aXNbIFwiYXhpcy1sYWJlbFwiIF0gKVxuXHRcdFx0XHRcdC5heGlzTGFiZWxEaXN0YW5jZSggeUF4aXNMYWJlbERpc3RhbmNlIClcblx0XHRcdFx0XHQudGlja0Zvcm1hdCggZnVuY3Rpb24oZCkgeyByZXR1cm4geUF4aXNQcmVmaXggKyBkMy5mb3JtYXQoIFwiLFwiICkoIEFwcC5VdGlscy5mb3JtYXRWYWx1ZSggZCwgeUF4aXNGb3JtYXQgKSApICsgeUF4aXNTdWZmaXg7IH0pXG5cdFx0XHRcdFx0LnNob3dNYXhNaW4oZmFsc2UpO1xuXHRcdFx0XHRcblx0XHRcdFx0Ly9zY2F0dGVyIHBsb3RzIG5lZWQgbW9yZSB0aWNrc1xuXHRcdFx0XHRpZiggY2hhcnRUeXBlID09PSBcIjJcIiApIHtcblx0XHRcdFx0XHQvL2hhcmRjb2RlXG5cdFx0XHRcdFx0dGhhdC5jaGFydC54QXhpcy50aWNrcyggNyApO1xuXHRcdFx0XHRcdHRoYXQuY2hhcnQueUF4aXMudGlja3MoIDcgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0dmFyIHN2Z1NlbGVjdGlvbiA9IGQzLnNlbGVjdCggdGhhdC4kc3ZnLnNlbGVjdG9yIClcblx0XHRcdFx0XHQuZGF0dW0oIGxvY2FsRGF0YSApXG5cdFx0XHRcdFx0LmNhbGwoIHRoYXQuY2hhcnQgKTtcblx0XHRcdFx0XG5cdFx0XHRcdGlmKCBjaGFydFR5cGUgIT09IFwiM1wiICkge1xuXG5cdFx0XHRcdFx0dGhhdC5jaGFydC50b29sdGlwLmNvbnRlbnRHZW5lcmF0b3IoIEFwcC5VdGlscy5jb250ZW50R2VuZXJhdG9yICk7XG5cblx0XHRcdFx0fSBlbHNlIHtcblxuXHRcdFx0XHRcdC8vc2V0IHBvcHVwXG5cdFx0XHRcdFx0dmFyIHVuaXRzU3RyaW5nID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcInVuaXRzXCIgKSxcblx0XHRcdFx0XHRcdHVuaXRzID0gKCAhJC5pc0VtcHR5T2JqZWN0KCB1bml0c1N0cmluZyApICk/ICQucGFyc2VKU09OKCB1bml0c1N0cmluZyApOiB7fSxcblx0XHRcdFx0XHRcdHN0cmluZyA9IFwiXCIsXG5cdFx0XHRcdFx0XHR2YWx1ZXNTdHJpbmcgPSBcIlwiO1xuXG5cdFx0XHRcdFx0Ly9kMy5mb3JtYXQgd2l0aCBhZGRlZCBwYXJhbXMgdG8gYWRkIGFyYml0cmFyeSBzdHJpbmcgYXQgdGhlIGVuZFxuXHRcdFx0XHRcdHZhciBjdXN0b21Gb3JtYXR0ZXIgPSBmdW5jdGlvbiggZm9ybWF0U3RyaW5nLCBzdWZmaXggKSB7XG5cdFx0XHRcdFx0XHR2YXIgZnVuYyA9IGQzLmZvcm1hdCggZm9ybWF0U3RyaW5nICk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZnVuY3Rpb24oIGQsIGkgKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBmdW5jKCBkICkgKyBzdWZmaXg7XG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdH07XG5cblx0XHRcdFx0XHQvL2RpZmZlcmVudCBwb3B1cCBzZXR1cCBmb3Igc3RhY2tlZCBhcmVhIGNoYXJ0XG5cdFx0XHRcdFx0dmFyIHVuaXQgPSBfLmZpbmRXaGVyZSggdW5pdHMsIHsgcHJvcGVydHk6IFwieVwiIH0gKTtcblx0XHRcdFx0XHRpZiggdW5pdCAmJiB1bml0LmZvcm1hdCApIHtcblx0XHRcdFx0XHRcdHZhciBmaXhlZCA9IE1hdGgubWluKCAyMCwgcGFyc2VJbnQoIHVuaXQuZm9ybWF0LCAxMCApICksXG5cdFx0XHRcdFx0XHRcdHVuaXROYW1lID0gKCB1bml0LnVuaXQgKT8gXCIgXCIgKyB1bml0LnVuaXQ6IFwiXCI7XG5cdFx0XHRcdFx0XHR0aGF0LmNoYXJ0LmludGVyYWN0aXZlTGF5ZXIudG9vbHRpcC52YWx1ZUZvcm1hdHRlciggY3VzdG9tRm9ybWF0dGVyKFwiLlwiICsgZml4ZWQgKyBcImZcIiwgdW5pdE5hbWUgKSApO1xuXHRcdFx0XHRcdFx0Ly90aGF0LmNoYXJ0LmludGVyYWN0aXZlTGF5ZXIudG9vbHRpcC52YWx1ZUZvcm1hdHRlciggZDMuZm9ybWF0KFwiLlwiICsgZml4ZWQgKyBcImZcIiApICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFxuXHRcdFx0XHR9XG5cdFx0XHRcdFxuXHRcdFx0XHQvL3NldCBsZWdlbmRcblx0XHRcdFx0aWYoICFBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiaGlkZS1sZWdlbmRcIiApICkge1xuXHRcdFx0XHRcdC8vbWFrZSBzdXJlIHdyYXBwZXIgaXMgdmlzaWJsZVxuXHRcdFx0XHRcdHRoYXQuJHN2Zy5maW5kKCBcIj4gLm52ZDMubnYtY3VzdG9tLWxlZ2VuZFwiICkuc2hvdygpO1xuXHRcdFx0XHRcdHRoYXQubGVnZW5kID0gbmV3IExlZ2VuZCggdGhhdC5jaGFydC5sZWdlbmQgKS52ZXJzKCBcIm93ZFwiICk7XG5cdFx0XHRcdFx0dGhhdC5sZWdlbmQuZGlzcGF0Y2gub24oIFwicmVtb3ZlRW50aXR5XCIsIGZ1bmN0aW9uKCBpZCApIHtcblx0XHRcdFx0XHRcdHRoYXQub25SZW1vdmVFbnRpdHkoIGlkICk7XG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdHRoYXQubGVnZW5kLmRpc3BhdGNoLm9uKCBcImFkZEVudGl0eVwiLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdGlmKCB0aGF0LiRlbnRpdGllc1NlbGVjdC5kYXRhKCBcImNob3NlblwiICkgKSB7XG5cdFx0XHRcdFx0XHRcdHRoYXQuJGVudGl0aWVzU2VsZWN0LmRhdGEoIFwiY2hvc2VuXCIgKS5hY3RpdmVfZmllbGQgPSBmYWxzZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdC8vdHJpZ2dlciBvcGVuIHRoZSBjaG9zZW4gZHJvcCBkb3duXG5cdFx0XHRcdFx0XHR0aGF0LiRlbnRpdGllc1NlbGVjdC50cmlnZ2VyKCBcImNob3NlbjpvcGVuXCIgKTtcblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0c3ZnU2VsZWN0aW9uLmNhbGwoIHRoYXQubGVnZW5kICk7XG5cdFx0XHRcdFx0Ly9wdXQgbGVnZW5kIGFib3ZlIGNoYXJ0XG5cblxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vbm8gbGVnZW5kLCByZW1vdmUgd2hhdCBtaWdodCBoYXZlIHByZXZpb3VzbHkgYmVlbiB0aGVyZVxuXHRcdFx0XHRcdHRoYXQuJHN2Zy5maW5kKCBcIj4gLm52ZDMubnYtY3VzdG9tLWxlZ2VuZFwiICkuaGlkZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdFxuXHRcdFx0XHR2YXIgb25SZXNpemVDYWxsYmFjayA9IF8uZGVib3VuY2UoIGZ1bmN0aW9uKGUpIHtcblx0XHRcdFx0XHQvL2ludm9rZSByZXNpemUgb2YgbGVnZW5kLCBpZiB0aGVyZSdzIG9uZSwgc2NhdHRlciBwbG90IGRvZXNuJ3QgaGF2ZSBhbnkgYnkgZGVmYXVsdFxuXHRcdFx0XHRcdGlmKCB0aGF0LmxlZ2VuZCApIHtcblx0XHRcdFx0XHRcdHN2Z1NlbGVjdGlvbi5jYWxsKCB0aGF0LmxlZ2VuZCApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGF0LnBhcmVudFZpZXcub25SZXNpemUoKTtcblx0XHRcdFx0fSwgMTUwICk7XG5cdFx0XHRcdG52LnV0aWxzLndpbmRvd1Jlc2l6ZSggb25SZXNpemVDYWxsYmFjayApO1xuXHRcdFx0XHRcdFx0XG5cdFx0XHRcdHRoYXQucGFyZW50Vmlldy5vblJlc2l6ZSgpO1xuXG5cdFx0XHRcdHZhciBzdGF0ZUNoYW5nZUV2ZW50ID0gKCBjaGFydFR5cGUgIT09IFwiNlwiICk/IFwic3RhdGVDaGFuZ2VcIjogXCJyZW5kZXJFbmRcIjtcblx0XHRcdFx0dGhhdC5jaGFydC5kaXNwYXRjaC5vbiggc3RhdGVDaGFuZ2VFdmVudCwgZnVuY3Rpb24oIHN0YXRlICkge1xuXHRcdFx0XHRcdC8vcmVmcmVzaCBsZWdlbmQ7XG5cdFx0XHRcdFx0c3ZnU2VsZWN0aW9uLmNhbGwoIHRoYXQubGVnZW5kICk7XG5cblx0XHRcdFx0XHQvL1xuXHRcdFx0XHRcdGlmKCBjaGFydFR5cGUgPT09IFwiM1wiICkge1xuXHRcdFx0XHRcdFx0dGhhdC5jaGVja1N0YWNrZWRBeGlzKCk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly9UT0RPIC0gdWdseSEgbmVlZHMgdGltZW91dCBhbmQgcmVhY2hpbmcgdG8gY2hhcnR2aWV3ICBcblx0XHRcdFx0XHRzZXRUaW1lb3V0KCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdHRoYXQucGFyZW50Vmlldy5vblJlc2l6ZSgpO1xuXHRcdFx0XHRcdH0sIDEpO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdHRoYXQucGFyZW50Vmlldy5kYXRhVGFiLnJlbmRlciggZGF0YSwgbG9jYWxEYXRhLCBkaW1lbnNpb25zICk7XG5cdFx0XHRcdFxuXHRcdFx0XHRpZiggY2hhcnRUeXBlID09IFwiMlwiICkge1xuXHRcdFx0XHRcdC8vbmVlZCB0byBoYXZlIG93biBzaG93RGlzdCBpbXBsZW1lbnRhdGlvbiwgY2F1c2UgdGhlcmUncyBhIGJ1ZyBpbiBudmQzXG5cdFx0XHRcdFx0dGhhdC5zY2F0dGVyRGlzdCgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdFxuXHRcdFx0XHQvL2lmIHkgYXhpcyBoYXMgemVybywgZGlzcGxheSBzb2xpZCBsaW5lXG5cdFx0XHRcdHZhciAkcGF0aERvbWFpbiA9ICQoIFwiLm52ZDMgLm52LWF4aXMubnYteCBwYXRoLmRvbWFpblwiICk7XG5cdFx0XHRcdGlmKCB5RG9tYWluWyAwIF0gPT09IDAgKSB7XG5cdFx0XHRcdFx0JHBhdGhEb21haW4uY3NzKCBcInN0cm9rZS1vcGFjaXR5XCIsIFwiMVwiICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0JHBhdGhEb21haW4uY3NzKCBcInN0cm9rZS1vcGFjaXR5XCIsIFwiMFwiICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdC8vdGhhdC5zY2FsZVNlbGVjdG9ycy5pbml0RXZlbnRzKCk7XG5cdFx0XHRcdHZhciBjaGFydERpbWVuc2lvbnNTdHJpbmcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtZGltZW5zaW9uc1wiICk7XG5cdFx0XHRcdGlmKCBjaGFydERpbWVuc2lvbnNTdHJpbmcuaW5kZXhPZiggJ1wicHJvcGVydHlcIjpcImNvbG9yXCInICkgPT09IC0xICkge1xuXHRcdFx0XHRcdC8vY2hlY2sgaWYgc3RyaW5nIGRvZXMgbm90IGNvbnRhaW4gXCJwcm9wZXJ0eVwiOlwiY29sb3JcIlxuXHRcdFx0XHRcdHRoYXQuY2FjaGVDb2xvcnMoIGxvY2FsRGF0YSApO1xuXHRcdFx0XHR9XG5cblx0XHRcdH0pO1xuXG5cdFx0fSxcblxuXHRcdHNjYXR0ZXJEaXN0OiBmdW5jdGlvbigpIHtcblxuXHRcdFx0dmFyIHRoYXQgPSB0aGlzLFxuXHRcdFx0XHRtYXJnaW5zID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcIm1hcmdpbnNcIiApLFxuXHRcdFx0XHRudkRpc3RyWCA9ICQoIFwiLm52LWRpc3RyaWJ1dGlvblhcIiApLm9mZnNldCgpLnRvcCxcblx0XHRcdFx0c3ZnU2VsZWN0aW9uID0gZDMuc2VsZWN0KCBcInN2Z1wiICk7XG5cblx0XHRcdHRoYXQuY2hhcnQuc2NhdHRlci5kaXNwYXRjaC5vbignZWxlbWVudE1vdXNlb3Zlci50b29sdGlwJywgZnVuY3Rpb24oZXZ0KSB7XG5cdFx0XHRcdHZhciBzdmdPZmZzZXQgPSB0aGF0LiRzdmcub2Zmc2V0KCksXG5cdFx0XHRcdFx0c3ZnSGVpZ2h0ID0gdGhhdC4kc3ZnLmhlaWdodCgpO1xuXHRcdFx0XHRzdmdTZWxlY3Rpb24uc2VsZWN0KCcubnYtc2VyaWVzLScgKyBldnQuc2VyaWVzSW5kZXggKyAnIC5udi1kaXN0eC0nICsgZXZ0LnBvaW50SW5kZXgpXG5cdFx0XHRcdFx0LmF0dHIoJ3kxJywgZXZ0LnBvcy50b3AgLSBudkRpc3RyWCApO1xuXHRcdFx0XHRzdmdTZWxlY3Rpb24uc2VsZWN0KCcubnYtc2VyaWVzLScgKyBldnQuc2VyaWVzSW5kZXggKyAnIC5udi1kaXN0eS0nICsgZXZ0LnBvaW50SW5kZXgpXG5cdFx0XHRcdFx0LmF0dHIoJ3gyJywgZXZ0LnBvcy5sZWZ0IC0gc3ZnT2Zmc2V0LmxlZnQgLSBtYXJnaW5zLmxlZnQgKTtcblx0XHRcdFx0dmFyIHBvc2l0aW9uID0ge2xlZnQ6IGQzLmV2ZW50LmNsaWVudFgsIHRvcDogZDMuZXZlbnQuY2xpZW50WSB9O1xuXHRcdFx0XHR0aGF0LmNoYXJ0LnRvb2x0aXAucG9zaXRpb24ocG9zaXRpb24pLmRhdGEoZXZ0KS5oaWRkZW4oZmFsc2UpO1xuXHRcdFx0fSk7XG5cblx0XHR9LFxuXG5cdFx0c2NhdHRlckJ1YmJsZVNpemU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0Ly9zZXQgc2l6ZSBvZiB0aGUgYnViYmxlcyBkZXBlbmRpbmcgb24gYnJvd3NlciB3aWR0aFxuXHRcdFx0dmFyIGJyb3dzZXJXaWR0aCA9ICQoIHdpbmRvdyApLndpZHRoKCksXG5cdFx0XHRcdGJyb3dzZXJDb2VmID0gTWF0aC5tYXgoIDEsIGJyb3dzZXJXaWR0aCAvIDExMDAgKSxcblx0XHRcdFx0cG9pbnRNaW4gPSAxMDAgKiBNYXRoLnBvdyggYnJvd3NlckNvZWYsIDIgKSxcblx0XHRcdFx0cG9pbnRNYXggPSAxMDAwICogTWF0aC5wb3coIGJyb3dzZXJDb2VmLCAyICk7XG5cdFx0XHRyZXR1cm4gWyBwb2ludE1pbiwgcG9pbnRNYXggXTtcblx0XHR9LFxuXG5cdFx0Y2hlY2tTdGFja2VkQXhpczogZnVuY3Rpb24oKSB7XG5cblx0XHRcdC8vc2V0dGluZyB5QXhpc01heCBicmVha3MgZXhwYW5kZWQgc3RhY2tlZCBjaGFydCwgbmVlZCB0byBjaGVjayBtYW51YWxseVxuXHRcdFx0dmFyIHN0YWNrZWRTdHlsZSA9IHRoaXMuY2hhcnQuc3RhY2tlZC5zdHlsZSgpLFxuXHRcdFx0XHR5QXhpcyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJ5LWF4aXNcIiApLFxuXHRcdFx0XHR5QXhpc01pbiA9ICggeUF4aXNbIFwiYXhpcy1taW5cIiBdIHx8IDAgKSxcblx0XHRcdFx0eUF4aXNNYXggPSAoIHlBeGlzWyBcImF4aXMtbWF4XCIgXSB8fCBudWxsICksXG5cdFx0XHRcdHlEb21haW4gPSBbIHlBeGlzTWluLCB5QXhpc01heCBdO1xuXHRcdFx0aWYoIHlBeGlzTWF4ICkge1xuXHRcdFx0XHQvL2NoYXJ0IGhhcyBzZXQgeUF4aXMgdG8gbWF4LCBkZXBlbmRpbmcgb24gc3RhY2tlZCBzdHlsZSBzZXQgbWF4XG5cdFx0XHRcdGlmKCBzdGFja2VkU3R5bGUgPT09IFwiZXhwYW5kXCIgKSB7XG5cdFx0XHRcdFx0eURvbWFpbiA9IFsgMCwgMSBdO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuY2hhcnQueURvbWFpbiggeURvbWFpbiApO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0fSxcblxuXHRcdG9uUmVtb3ZlRW50aXR5OiBmdW5jdGlvbiggaWQgKSB7XG5cblx0XHRcdHZhciBzZWxlY3RlZENvdW50cmllcyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiApLFxuXHRcdFx0XHRjb3VudHJpZXNJZHMgPSBfLmtleXMoIHNlbGVjdGVkQ291bnRyaWVzICksXG5cdFx0XHRcdGFkZENvdW50cnlNb2RlID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImFkZC1jb3VudHJ5LW1vZGVcIiApO1xuXG5cdFx0XHRpZiggY291bnRyaWVzSWRzLmxlbmd0aCA9PT0gMCApIHtcblx0XHRcdFx0Ly9yZW1vdmluZyBmcm9tIGVtcHR5IHNlbGVjdGlvbiwgbmVlZCB0byBjb3B5IGFsbCBjb3VudHJpZXMgYXZhaWxhYmxlIGludG8gc2VsZWN0ZWQgY291bnRyaWVzIHNlbGVjdGlvblxuXHRcdFx0XHR2YXIgZW50aXRpZXNDb2xsZWN0aW9uID0gW10sXG5cdFx0XHRcdC8vdmFyIGVudGl0aWVzQ29sbGVjdGlvbiA9IHt9LFxuXHRcdFx0XHRcdGZvcm1Db25maWcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiZm9ybS1jb25maWdcIiApO1xuXHRcdFx0XHRpZiggZm9ybUNvbmZpZyAmJiBmb3JtQ29uZmlnWyBcImVudGl0aWVzLWNvbGxlY3Rpb25cIiBdICkge1xuXHRcdFx0XHRcdF8ubWFwKCBmb3JtQ29uZmlnWyBcImVudGl0aWVzLWNvbGxlY3Rpb25cIiBdLCBmdW5jdGlvbiggZCwgaSApIHsgZW50aXRpZXNDb2xsZWN0aW9uWyBkLmlkIF0gPSBkOyB9ICk7XG5cdFx0XHRcdFx0Ly9kZWVwIGNvcHkgYXJyYXlcblx0XHRcdFx0XHR2YXIgZW50aXRpZXNDb3B5ID0gICQuZXh0ZW5kKCB0cnVlLCBbXSwgZm9ybUNvbmZpZ1sgXCJlbnRpdGllcy1jb2xsZWN0aW9uXCIgXSApO1xuXHRcdFx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiwgZW50aXRpZXNDb3B5ICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdEFwcC5DaGFydE1vZGVsLnJlbW92ZVNlbGVjdGVkQ291bnRyeSggaWQgKTtcblxuXHRcdH0sXG5cblx0XHRvbkF2YWlsYWJsZUNvdW50cmllczogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dmFyICRzZWxlY3QgPSAkKCBldnQuY3VycmVudFRhcmdldCApLFxuXHRcdFx0XHR2YWwgPSAkc2VsZWN0LnZhbCgpLFxuXHRcdFx0XHQkb3B0aW9uID0gJHNlbGVjdC5maW5kKCBcIlt2YWx1ZT1cIiArIHZhbCArIFwiXVwiICksXG5cdFx0XHRcdHRleHQgPSAkb3B0aW9uLnRleHQoKTtcblxuXHRcdFx0aWYoICFBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiZ3JvdXAtYnktdmFyaWFibGVzXCIgKSAmJiBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiYWRkLWNvdW50cnktbW9kZVwiICkgPT09IFwiYWRkLWNvdW50cnlcIiApIHtcblx0XHRcdFx0QXBwLkNoYXJ0TW9kZWwuYWRkU2VsZWN0ZWRDb3VudHJ5KCB7IGlkOiAkc2VsZWN0LnZhbCgpLCBuYW1lOiB0ZXh0IH0gKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdEFwcC5DaGFydE1vZGVsLnJlcGxhY2VTZWxlY3RlZENvdW50cnkoIHsgaWQ6ICRzZWxlY3QudmFsKCksIG5hbWU6IHRleHQgfSApO1xuXHRcdFx0fVxuXG5cdFx0XHQvL2RvdWJsZSBjaGVjayBpZiB3ZSBkb24ndCBoYXZlIGZ1bGwgc2VsZWN0aW9uIG9mIGNvdW50cmllc1xuXHRcdFx0dmFyIGVudGl0aWVzQ29sbGVjdGlvbiA9IHt9LFxuXHRcdFx0XHRmb3JtQ29uZmlnID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImZvcm0tY29uZmlnXCIgKTtcblx0XHRcdGlmKCBmb3JtQ29uZmlnICYmIGZvcm1Db25maWdbIFwiZW50aXRpZXMtY29sbGVjdGlvblwiIF0gKSB7XG5cdFx0XHRcdHZhciBzZWxlY3RlZENvdW50cmllc0lkcyA9IF8ua2V5cyggQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcInNlbGVjdGVkLWNvdW50cmllc1wiICkgKTtcblx0XHRcdFx0aWYoIHNlbGVjdGVkQ291bnRyaWVzSWRzLmxlbmd0aCA9PSBmb3JtQ29uZmlnWyBcImVudGl0aWVzLWNvbGxlY3Rpb25cIiBdLmxlbmd0aCApIHtcblx0XHRcdFx0XHRBcHAuQ2hhcnRNb2RlbC5zZXQoIFwic2VsZWN0ZWQtY291bnRyaWVzXCIsIFtdLCB7c2lsZW50OnRydWV9ICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdH0sXG5cblx0XHRjYWNoZUNvbG9yczogZnVuY3Rpb24oIGRhdGEgKSB7XG5cdFx0XHRpZiggIXRoaXMuY2FjaGVkQ29sb3JzLmxlbmd0aCApIHtcblx0XHRcdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdFx0XHRfLmVhY2goIGRhdGEsIGZ1bmN0aW9uKCB2LCBpICkge1xuXHRcdFx0XHRcdHRoYXQuY2FjaGVkQ29sb3JzWyB2LmlkIF0gPSB2LmNvbG9yO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdGFzc2lnbkNvbG9yRnJvbUNhY2hlOiBmdW5jdGlvbiggdmFsdWUgKSB7XG5cdFx0XHRpZiggdGhpcy5jYWNoZWRDb2xvcnMubGVuZ3RoICkge1xuXHRcdFx0XHQvL2Fzc2luZyBjb2xvciBmcm9tZSBjYWNoZVxuXHRcdFx0XHRpZiggdGhpcy5jYWNoZWRDb2xvcnNbIHZhbHVlLmlkIF0gKSB7XG5cdFx0XHRcdFx0dmFsdWUuY29sb3IgPSB0aGlzLmNhY2hlZENvbG9yc1sgdmFsdWUuaWQgXTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR2YXIgcmFuZG9tQ29sb3IgPSBBcHAuVXRpbHMuZ2V0UmFuZG9tQ29sb3IoKTtcblx0XHRcdFx0XHR2YWx1ZS5jb2xvciA9IHJhbmRvbUNvbG9yO1xuXHRcdFx0XHRcdHRoaXMuY2FjaGVkQ29sb3JzWyB2YWx1ZS5pZCBdID0gcmFuZG9tQ29sb3I7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHR9XG5cdFx0XG5cdH0gKTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5DaGFydC5DaGFydFRhYjtcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdEFwcC5WaWV3cy5DaGFydC5EYXRhVGFiID0gQmFja2JvbmUuVmlldy5leHRlbmQoIHtcblxuXHRcdGVsOiBcIiNjaGFydC12aWV3XCIsXG5cdFx0ZXZlbnRzOiB7fSxcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0XG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIgPSBvcHRpb25zLmRpc3BhdGNoZXI7XG5cblx0XHRcdC8vZGF0YSB0YWJcblx0XHRcdHRoaXMuJGRhdGFUYWIgPSB0aGlzLiRlbC5maW5kKCBcIiNkYXRhLWNoYXJ0LXRhYlwiICk7XG5cdFx0XHR0aGlzLiRkb3dubG9hZEJ0biA9IHRoaXMuJGRhdGFUYWIuZmluZCggXCIuZG93bmxvYWQtZGF0YS1idG5cIiApO1xuXHRcdFx0dGhpcy4kZGF0YVRhYmxlV3JhcHBlciA9IHRoaXMuJGRhdGFUYWIuZmluZCggXCIuZGF0YS10YWJsZS13cmFwcGVyXCIgKTtcblxuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCBkYXRhLCBsb2NhbERhdGEsIGRpbWVuc2lvbnMgKSB7XG5cdFx0XHRcblx0XHRcdHRoaXMuJGRhdGFUYWJsZVdyYXBwZXIuZW1wdHkoKTtcblxuXHRcdFx0Ly91cGRhdGUgbGlua1xuXHRcdFx0dmFyIHRoYXQgPSB0aGlzLFxuXHRcdFx0XHRjaGFydFR5cGUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdHlwZVwiICksXG5cdFx0XHRcdGhhc011bHRpcGxlQ29sdW1ucyA9ICggQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImdyb3VwLWJ5LXZhcmlhYmxlc1wiICkgJiYgY2hhcnRUeXBlICE9PSBcIjNcIiApPyB0cnVlOiBmYWxzZTsvKixcblx0XHRcdFx0YmFzZVVybCA9IHRoaXMuJGRvd25sb2FkQnRuLmF0dHIoIFwiZGF0YS1iYXNlLXVybFwiICksXG5cdFx0XHRcdGRpbWVuc2lvbnNVcmwgPSBlbmNvZGVVUklDb21wb25lbnQoIGRpbWVuc2lvbnNTdHJpbmcgKTsqL1xuXHRcdFx0Ly90aGlzLiRkb3dubG9hZEJ0bi5hdHRyKCBcImhyZWZcIiwgYmFzZVVybCArIFwiP2RpbWVuc2lvbnM9XCIgKyBkaW1lbnNpb25zVXJsICsgXCImY2hhcnRUeXBlPVwiICsgY2hhcnRUeXBlICsgXCImZXhwb3J0PWNzdlwiICk7XG5cdFx0XHR0aGlzLiRkb3dubG9hZEJ0bi5vbiggXCJjbGlja1wiLCBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXG5cdFx0XHRcdHZhciBkYXRhID0gW10sXG5cdFx0XHRcdFx0JHRycyA9IHRoYXQuJGVsLmZpbmQoIFwidHJcIiApO1xuXHRcdFx0XHQkLmVhY2goICR0cnMsIGZ1bmN0aW9uKCBpLCB2ICkge1xuXG5cdFx0XHRcdFx0dmFyIHRyRGF0YSA9IFtdLFxuXHRcdFx0XHRcdFx0JHRyID0gJCggdGhpcyApLFxuXHRcdFx0XHRcdFx0JGNlbGxzID0gJHRyLmZpbmQoIFwidGgsIHRkXCIgKTtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHQkLmVhY2goICRjZWxscywgZnVuY3Rpb24oIGkyLCB2MiApIHtcblx0XHRcdFx0XHRcdHRyRGF0YS5wdXNoKCAkKCB2MiApLnRleHQoKSApO1xuXHRcdFx0XHRcdH0gKTtcblxuXHRcdFx0XHRcdGRhdGEucHVzaCggdHJEYXRhICk7XG5cblx0XHRcdFx0fSApO1xuXG5cdFx0XHRcdHZhciBjc3ZTdHJpbmcgPSBcImRhdGE6dGV4dC9jc3Y7Y2hhcnNldD11dGYtOCxcIjtcblx0XHRcdFx0Xy5lYWNoKCBkYXRhLCBmdW5jdGlvbiggdiwgaSApIHtcblx0XHRcdFx0XHR2YXIgZGF0YVN0cmluZyA9IHYuam9pbihcIixcIik7XG5cdFx0XHRcdFx0Y3N2U3RyaW5nICs9ICggaSA8IGRhdGEubGVuZ3RoICk/IGRhdGFTdHJpbmcrIFwiXFxuXCIgOiBkYXRhU3RyaW5nO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdFxuXHRcdFx0XHR2YXIgZW5jb2RlZFVyaSA9IGVuY29kZVVSSSggY3N2U3RyaW5nICk7XG5cdFx0XHRcdHdpbmRvdy5vcGVuKCBlbmNvZGVkVXJpICk7XG5cblx0XHRcdH0gKTtcblxuXHRcdFx0Ly9nZXQgYWxsIHRpbWVzXG5cdFx0XHR2YXIgdGltZXNPYmogPSBbXSxcblx0XHRcdFx0dGltZXMgPSBbXTtcblx0XHRcdF8uZWFjaCggZGF0YSwgZnVuY3Rpb24oIGVudGl0eURhdGEsIGVudGl0eUlkICkge1xuXG5cdFx0XHRcdHZhciB2YWx1ZXMgPSBlbnRpdHlEYXRhLnZhbHVlcyxcblx0XHRcdFx0XHR2YWx1ZXNCeVRpbWUgPSBbXTtcblxuXHRcdFx0XHRfLmVhY2goIHZhbHVlcywgZnVuY3Rpb24oIHZhbHVlICkge1xuXG5cdFx0XHRcdFx0Ly9zdG9yZSBnaXZlbiB0aW1lIGFzIGV4aXN0aW5nXG5cdFx0XHRcdFx0dmFyIHRpbWUgPSB2YWx1ZS50aW1lO1xuXHRcdFx0XHRcdGlmKCAhdGltZXNPYmpbIHRpbWUgXSApIHtcblx0XHRcdFx0XHRcdHRpbWVzT2JqWyB0aW1lIF0gPSB0cnVlO1xuXHRcdFx0XHRcdFx0dGltZXMucHVzaCggdGltZSApO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vcmUtbWFwIHZhbHVlcyBieSB0aW1lIGtleVxuXHRcdFx0XHRcdHZhbHVlc0J5VGltZVsgdGltZSBdID0gdmFsdWU7XG5cblx0XHRcdFx0fSApO1xuXG5cdFx0XHRcdGVudGl0eURhdGEudmFsdWVzQnlUaW1lID0gdmFsdWVzQnlUaW1lO1xuXG5cdFx0XHR9ICk7XG5cblx0XHRcdC8vc29ydCBnYXRoZXJlZCB0aW1lc1xuXHRcdFx0dGltZXMgPSBfLnNvcnRCeSggdGltZXMsIGZ1bmN0aW9uKCB2ICkgeyByZXR1cm4gK3Y7IH0gKTtcblx0XHRcdFxuXHRcdFx0Ly9jcmVhdGUgZmlyc3Qgcm93XG5cdFx0XHR2YXIgdGFibGVTdHJpbmcgPSBcIjx0YWJsZSBjbGFzcz0nZGF0YS10YWJsZSc+XCIsXG5cdFx0XHRcdHRyID0gXCI8dHI+PHRkPjxzdHJvbmc+IDwvc3Ryb25nPjwvdGQ+XCI7XG5cdFx0XHRfLmVhY2goIHRpbWVzLCBmdW5jdGlvbiggdGltZSApIHtcblxuXHRcdFx0XHQvL2NyZWF0ZSBjb2x1bW4gZm9yIGV2ZXJ5IGRpbWVuc2lvblxuXHRcdFx0XHRfLmVhY2goIGRpbWVuc2lvbnMsIGZ1bmN0aW9uKCBkaW1lbnNpb24sIGkgKSB7XG5cdFx0XHRcdFx0aWYoIGkgPT09IDAgfHwgaGFzTXVsdGlwbGVDb2x1bW5zICkge1xuXHRcdFx0XHRcdFx0dmFyIHRoID0gXCI8dGg+XCI7XG5cdFx0XHRcdFx0XHR0aCArPSB0aW1lO1xuXHRcdFx0XHRcdFx0aWYoIGRpbWVuc2lvbnMubGVuZ3RoID4gMSAmJiBoYXNNdWx0aXBsZUNvbHVtbnMgKSB7XG5cdFx0XHRcdFx0XHRcdC8vd2UgaGF2ZSBtb3JlIHRoYW4gb25lIGRpbWVuc2lvbiwgbmVlZCB0byBkaXN0aW5ndWlzaCB0aGVtIGluIFxuXHRcdFx0XHRcdFx0XHR0aCArPSBcIiAtIFwiICsgZGltZW5zaW9uLnZhcmlhYmxlTmFtZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHRoICs9IFwiPC90aD5cIjtcblx0XHRcdFx0XHRcdHRyICs9IHRoO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cblx0XHRcdH0gKTtcblx0XHRcdHRyICs9IFwiPC90cj5cIjtcblx0XHRcdHRhYmxlU3RyaW5nICs9IHRyO1xuXG5cdFx0XHRfLmVhY2goIGRhdGEsIGZ1bmN0aW9uKCBlbnRpdHlEYXRhLCBlbnRpdHlJZCApIHtcblxuXHRcdFx0XHR2YXIgdHIgPSBcIjx0cj5cIixcblx0XHRcdFx0XHQvL2FkZCBuYW1lIG9mIGVudGl0eVxuXHRcdFx0XHRcdHRkID0gXCI8dGQ+PHN0cm9uZz5cIiArIGVudGl0eURhdGEua2V5ICsgXCI8L3N0cm9uZz48L3RkPlwiO1xuXHRcdFx0XHR0ciArPSB0ZDtcblxuXHRcdFx0XHR2YXIgdmFsdWVzQnlUaW1lID0gZW50aXR5RGF0YS52YWx1ZXNCeVRpbWU7XG5cdFx0XHRcdF8uZWFjaCggdGltZXMsIGZ1bmN0aW9uKCB0aW1lICkge1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdC8vY3JlYXRlIGNvbHVtbiBmb3IgZXZlcnkgZGltZW5zaW9uXG5cdFx0XHRcdFx0Xy5lYWNoKCBkaW1lbnNpb25zLCBmdW5jdGlvbiggZGltZW5zaW9uLCBpICkge1xuXHRcdFx0XHRcdFx0aWYoIGkgPT09IDAgfHwgaGFzTXVsdGlwbGVDb2x1bW5zICkge1xuXHRcdFx0XHRcdFx0XHR2YXIgdGQgPSBcIjx0ZD5cIixcblx0XHRcdFx0XHRcdFx0XHR0ZFZhbHVlID0gXCJcIjtcblx0XHRcdFx0XHRcdFx0Ly9pcyB0aGVyZSB2YWx1ZSBmb3IgZ2l2ZW4gdGltZVxuXHRcdFx0XHRcdFx0XHRpZiggdmFsdWVzQnlUaW1lWyB0aW1lIF0gKSB7XG5cdFx0XHRcdFx0XHRcdFx0aWYoICF2YWx1ZXNCeVRpbWVbIHRpbWUgXS5mYWtlICkge1xuXHRcdFx0XHRcdFx0XHRcdFx0dGRWYWx1ZSA9IHZhbHVlc0J5VGltZVsgdGltZSBdWyBkaW1lbnNpb24ucHJvcGVydHkgXTtcblx0XHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdFx0Ly9qdXN0IGR1bW15IHZhbHVlcyBmb3IgY29ycmVjdCByZW5kZXJpbmcgb2YgY2hhcnQsIGRvbid0IGFkZCBpbnRvIHRhYmxlXG5cdFx0XHRcdFx0XHRcdFx0XHR0ZFZhbHVlID0gXCJcIjtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0dGQgKz0gdGRWYWx1ZTtcblx0XHRcdFx0XHRcdFx0dGQgKz0gXCI8L3RkPlwiO1xuXHRcdFx0XHRcdFx0XHR0ciArPSB0ZDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFxuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdFxuXHRcdFx0XHR0ciArPSBcIjwvdHI+XCI7XG5cdFx0XHRcdHRhYmxlU3RyaW5nICs9IHRyO1xuXG5cdFx0XHR9ICk7XG5cblx0XHRcdHRhYmxlU3RyaW5nICs9IFwiPC90YWJsZT5cIjtcblxuXHRcdFx0dmFyICR0YWJsZSA9ICQoIHRhYmxlU3RyaW5nICk7XG5cdFx0XHR0aGlzLiRkYXRhVGFibGVXcmFwcGVyLmFwcGVuZCggJHRhYmxlICk7XG5cblxuXHRcdH1cblxuXHR9ICk7XG5cdFxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5DaGFydC5EYXRhVGFiO1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0QXBwLlZpZXdzLkNoYXJ0LkhlYWRlciA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblxuXHRcdGVsOiBcIiNjaGFydC12aWV3IC5jaGFydC1oZWFkZXJcIixcblx0XHRldmVudHM6IHt9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHRcblx0XHRcdHRoaXMuZGlzcGF0Y2hlciA9IG9wdGlvbnMuZGlzcGF0Y2hlcjtcblx0XHRcdFxuXHRcdFx0dGhpcy4kdGFicyA9IHRoaXMuJGVsLmZpbmQoIFwiLmhlYWRlci10YWJcIiApO1xuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblxuXHRcdFx0Ly9zZXR1cCBldmVudHNcblx0XHRcdEFwcC5DaGFydE1vZGVsLm9uKCBcImNoYW5nZVwiLCB0aGlzLnJlbmRlciwgdGhpcyApO1xuXG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcblx0XHRcdHZhciB0YWJzID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcInRhYnNcIiApO1xuXHRcdFx0XG5cdFx0XHQvL2hpZGUgZmlyc3QgZXZlcnl0aGluZ1xuXHRcdFx0dGhpcy4kdGFicy5oaWRlKCk7XG5cblx0XHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRcdF8uZWFjaCggdGFicywgZnVuY3Rpb24oIHYsIGkgKSB7XG5cdFx0XHRcdHZhciB0YWIgPSB0aGF0LiR0YWJzLmZpbHRlciggXCIuXCIgKyB2ICsgXCItaGVhZGVyLXRhYlwiICk7XG5cdFx0XHRcdHRhYi5zaG93KCk7XG5cdFx0XHRcdGlmKCBpID09PSAwICkge1xuXHRcdFx0XHRcdHRhYi5hZGRDbGFzcyggXCJhY3RpdmVcIiApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cblx0XHR9XG5cblx0fSk7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVmlld3MuQ2hhcnQuSGVhZGVyO1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cdFxuXHRBcHAuVmlld3MuQ2hhcnQuTGVnZW5kID0gZnVuY3Rpb24oIGNoYXJ0TGVnZW5kICkge1xuXHRcblx0XHQvL2Jhc2VkIG9uIGh0dHBzOi8vZ2l0aHViLmNvbS9ub3Z1cy9udmQzL2Jsb2IvbWFzdGVyL3NyYy9tb2RlbHMvbGVnZW5kLmpzXG5cblx0XHQvLz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXHRcdC8vIFB1YmxpYyBWYXJpYWJsZXMgd2l0aCBEZWZhdWx0IFNldHRpbmdzXG5cdFx0Ly8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuXHRcdHZhciBjaGFydFR5cGUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdHlwZVwiIClcblx0XHRcdCwgbWFyZ2luID0ge3RvcDogNSwgcmlnaHQ6IDUwLCBib3R0b206IDUsIGxlZnQ6IDYyfVxuXHRcdFx0LCB3aWR0aCA9IDgwMFxuXHRcdFx0LCBoZWlnaHQgPSAyMFxuXHRcdFx0LCBnZXRLZXkgPSBmdW5jdGlvbihkKSB7IHJldHVybiBkLmtleSB9XG5cdFx0XHQsIGNvbG9yID0gbnYudXRpbHMuZ2V0Q29sb3IoKVxuXHRcdFx0LCBhbGlnbiA9IHRydWVcblx0XHRcdCwgcGFkZGluZyA9IDQwIC8vZGVmaW5lIGhvdyBtdWNoIHNwYWNlIGJldHdlZW4gbGVnZW5kIGl0ZW1zLiAtIHJlY29tbWVuZCAzMiBmb3IgZnVyaW91cyB2ZXJzaW9uXG5cdFx0XHQsIHJpZ2h0QWxpZ24gPSBmYWxzZVxuXHRcdFx0LCB1cGRhdGVTdGF0ZSA9IHRydWUgICAvL0lmIHRydWUsIGxlZ2VuZCB3aWxsIHVwZGF0ZSBkYXRhLmRpc2FibGVkIGFuZCB0cmlnZ2VyIGEgJ3N0YXRlQ2hhbmdlJyBkaXNwYXRjaC5cblx0XHRcdCwgcmFkaW9CdXR0b25Nb2RlID0gZmFsc2UgICAvL0lmIHRydWUsIGNsaWNraW5nIGxlZ2VuZCBpdGVtcyB3aWxsIGNhdXNlIGl0IHRvIGJlaGF2ZSBsaWtlIGEgcmFkaW8gYnV0dG9uLiAob25seSBvbmUgY2FuIGJlIHNlbGVjdGVkIGF0IGEgdGltZSlcblx0XHRcdCwgZXhwYW5kZWQgPSBmYWxzZVxuXHRcdFx0LCBkaXNwYXRjaCA9IGQzLmRpc3BhdGNoKCdsZWdlbmRDbGljaycsICdsZWdlbmREYmxjbGljaycsICdsZWdlbmRNb3VzZW92ZXInLCAnbGVnZW5kTW91c2VvdXQnLCAnc3RhdGVDaGFuZ2UnLCAncmVtb3ZlRW50aXR5JywgJ2FkZEVudGl0eScpXG5cdFx0XHQsIHZlcnMgPSAnY2xhc3NpYycgLy9PcHRpb25zIGFyZSBcImNsYXNzaWNcIiBhbmQgXCJmdXJpb3VzXCIgYW5kIFwib3dkXCJcblx0XHRcdDtcblxuXHRcdGZ1bmN0aW9uIGNoYXJ0KHNlbGVjdGlvbikge1xuXHRcdFx0XG5cdFx0XHRzZWxlY3Rpb24uZWFjaChmdW5jdGlvbihkYXRhKSB7XG5cdFx0XHRcdFxuXHRcdFx0XHR2YXIgJHN2ZyA9ICQoIFwic3ZnLm52ZDMtc3ZnXCIgKSxcblx0XHRcdFx0XHRhdmFpbGFibGVXaWR0aCA9ICRzdmcud2lkdGgoKSAtIG1hcmdpbi5sZWZ0IC0gbWFyZ2luLnJpZ2h0LFxuXHRcdFx0XHRcdGNvbnRhaW5lciA9IGQzLnNlbGVjdCh0aGlzKTtcblx0XHRcdFx0XG5cdFx0XHRcdG52LnV0aWxzLmluaXRTVkcoY29udGFpbmVyKTtcblxuXHRcdFx0XHR2YXIgYmluZGFibGVEYXRhID0gZGF0YTtcblxuXHRcdFx0XHQvL2Rpc2NyZXRlIGJhciBjaGFydCBuZWVkcyB1bnBhY2sgZGF0YVxuXHRcdFx0XHRpZiggY2hhcnRUeXBlID09PSBcIjZcIiApIHtcblx0XHRcdFx0XHRpZiggZGF0YSAmJiBkYXRhLmxlbmd0aCAmJiBkYXRhWzBdLnZhbHVlcyApIHtcblx0XHRcdFx0XHRcdHZhciBkaXNjcmV0ZURhdGEgPSBfLm1hcCggZGF0YVswXS52YWx1ZXMsIGZ1bmN0aW9uKCB2LCBpICkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4geyBpZDogdi5pZCwga2V5OiB2LngsIGNvbG9yOiB2LmNvbG9yLCB2YWx1ZXM6IHYgfTtcblx0XHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHRcdGJpbmRhYmxlRGF0YSA9IGRpc2NyZXRlRGF0YTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdC8vIFNldHVwIGNvbnRhaW5lcnMgYW5kIHNrZWxldG9uIG9mIGNoYXJ0XG5cdFx0XHRcdHZhciB3cmFwID0gY29udGFpbmVyLnNlbGVjdEFsbCgnZy5udi1jdXN0b20tbGVnZW5kJykuZGF0YShbYmluZGFibGVEYXRhXSksXG5cdFx0XHRcdC8vdmFyIHdyYXAgPSBjb250YWluZXIuc2VsZWN0QWxsKCdnLm52LWN1c3RvbS1sZWdlbmQnKS5kYXRhKFtkYXRhXSksXG5cdFx0XHRcdFx0Z0VudGVyID0gd3JhcC5lbnRlcigpLmFwcGVuZCgnZycpLmF0dHIoJ2NsYXNzJywgJ252ZDMgbnYtY3VzdG9tLWxlZ2VuZCcpLmFwcGVuZCgnZycpLmF0dHIoICdjbGFzcycsICdudi1sZWdlbmQtc2VyaWVzLXdyYXBwZXInICksXG5cdFx0XHRcdFx0ZyA9IHdyYXAuc2VsZWN0KCdnJyk7XG5cblx0XHRcdFx0d3JhcC5hdHRyKCd0cmFuc2Zvcm0nLCAndHJhbnNsYXRlKCcgKyBtYXJnaW4ubGVmdCArICcsJyArIG1hcmdpbi50b3AgKyAnKScpO1xuXG5cdFx0XHRcdHZhciBzZXJpZXMgPSBnLnNlbGVjdEFsbCgnLm52LXNlcmllcycpXG5cdFx0XHRcdFx0LmRhdGEoZnVuY3Rpb24oZCkge1xuXHRcdFx0XHRcdFx0aWYodmVycyAhPSAnZnVyaW91cycpIHJldHVybiBkO1xuXHRcdFx0XHRcdFx0cmV0dXJuIGQuZmlsdGVyKGZ1bmN0aW9uKG4pIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGV4cGFuZGVkID8gdHJ1ZSA6ICFuLmRpc2VuZ2FnZWQ7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XG5cdFx0XHRcdC8vYWRkIGVudGl0eSBsYWJlbFxuXHRcdFx0XHR2YXIgZW50aXR5TGFiZWwgPSB3cmFwLnNlbGVjdCggJy5udi1lbnRpdHktbGFiZWwnICksXG5cdFx0XHRcdFx0ZW50aXR5TGFiZWxUZXh0ID0gZW50aXR5TGFiZWwuc2VsZWN0KCAndGV4dCcgKSxcblx0XHRcdFx0XHRlbnRpdHlMYWJlbFdpZHRoID0gMDtcblx0XHRcdFx0Ly9kaXNwbGF5aW5nIG9mIGVudGl0eSBsYWJlbCBpcyBkaXNhYmxlZFxuXHRcdFx0XHQvKmlmKCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiYWRkLWNvdW50cnktbW9kZVwiICkgPT09IFwiY2hhbmdlLWNvdW50cnlcIiApIHtcblx0XHRcdFx0XHRpZiggZW50aXR5TGFiZWwuZW1wdHkoKSApIHtcblx0XHRcdFx0XHRcdGVudGl0eUxhYmVsID0gd3JhcC5hcHBlbmQoICdnJyApLmF0dHIoJ2NsYXNzJywgJ252LWVudGl0eS1sYWJlbCcpLmF0dHIoICd0cmFuc2Zvcm0nLCAndHJhbnNsYXRlKDAsMTUpJyApO1xuXHRcdFx0XHRcdFx0ZW50aXR5TGFiZWxUZXh0ID0gZW50aXR5TGFiZWwuYXBwZW5kKCAndGV4dCcgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYoIGRhdGEgJiYgZGF0YVswXSAmJiBkYXRhWzBdLmVudGl0eSApIHtcblx0XHRcdFx0XHRcdGVudGl0eUxhYmVsVGV4dC50ZXh0KCBkYXRhWzBdLmVudGl0eSArIFwiOiBcIiApO1xuXHRcdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdFx0ZW50aXR5TGFiZWxXaWR0aCA9IGVudGl0eUxhYmVsVGV4dC5ub2RlKCkuZ2V0Q29tcHV0ZWRUZXh0TGVuZ3RoKCk7XG5cdFx0XHRcdFx0XHRcdC8vIElmIHRoZSBsZWdlbmRUZXh0IGlzIGRpc3BsYXk6bm9uZSdkIChub2RlVGV4dExlbmd0aCA9PSAwKSwgc2ltdWxhdGUgYW4gZXJyb3Igc28gd2UgYXBwcm94aW1hdGUsIGluc3RlYWRcblx0XHRcdFx0XHRcdFx0aWYoIGVudGl0eUxhYmVsV2lkdGggPD0gMCApIHRocm93IG5ldyBFcnJvcigpO1xuXHRcdFx0XHRcdFx0fSBjYXRjaCggZSApIHtcblx0XHRcdFx0XHRcdFx0ZW50aXR5TGFiZWxXaWR0aCA9IG52LnV0aWxzLmNhbGNBcHByb3hUZXh0V2lkdGgoZW50aXR5TGFiZWxUZXh0KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdC8vYWRkIHBhZGRpbmcgZm9yIGxhYmVsXG5cdFx0XHRcdFx0XHRlbnRpdHlMYWJlbFdpZHRoICs9IDMwO1xuXHRcdFx0XHRcdFx0YXZhaWxhYmxlV2lkdGggLT0gZW50aXR5TGFiZWxXaWR0aDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly9tYWtlIHN1cmUgdGhlcmUgaXMgbm90IGxhYmVsIGxlZnRcblx0XHRcdFx0XHRlbnRpdHlMYWJlbC5yZW1vdmUoKTtcblx0XHRcdFx0fSovXG5cdFx0XHRcdFxuXHRcdFx0XHQvL2lmIG5vdCBleGlzdGluZywgYWRkIG52LWFkZC1idG4sIGlmIG5vdCBncm91cGluZyBieSB2YXJpYWJsZXNcblx0XHRcdFx0dmFyIGFkZEVudGl0eUJ0biA9ICB3cmFwLnNlbGVjdCggJ2cubnYtYWRkLWJ0bicgKTtcblx0XHRcdFx0aWYoIGFkZEVudGl0eUJ0bi5lbXB0eSgpICkge1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0biA9IHdyYXAuYXBwZW5kKCdnJykuYXR0cignY2xhc3MnLCAnbnYtYWRkLWJ0bicpO1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5hcHBlbmQoJ3JlY3QnKS5hdHRyKCB7ICdjbGFzcyc6ICdhZGQtYnRuLWJnJywgJ3dpZHRoJzogJzEwMCcsICdoZWlnaHQnOiAnMjUnLCAndHJhbnNmb3JtJzogJ3RyYW5zbGF0ZSgwLC01KScgfSApO1xuXHRcdFx0XHRcdHZhciBhZGRFbnRpdHlCdG5HID0gYWRkRW50aXR5QnRuLmFwcGVuZCgnZycpLmF0dHIoIHsgJ2NsYXNzJzogJ2FkZC1idG4tcGF0aCcgfSApO1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bkcuYXBwZW5kKCdwYXRoJykuYXR0ciggeyAnZCc6ICdNMTUsMCBMMTUsMTQnLCAnY2xhc3MnOiAnbnYtYm94JyB9ICk7XG5cdFx0XHRcdFx0YWRkRW50aXR5QnRuRy5hcHBlbmQoJ3BhdGgnKS5hdHRyKCB7ICdkJzogJ004LDcgTDIyLDcnLCAnY2xhc3MnOiAnbnYtYm94JyB9ICk7XG5cdFx0XHRcdFx0Ly9odHRwOi8vYW5kcm9pZC11aS11dGlscy5nb29nbGVjb2RlLmNvbS9oZy1oaXN0b3J5L2FjOTU1ZTYzNzY0NzBkOTU5OWVhZDA3YjQ1OTllZjkzNzgyNGY5MTkvYXNzZXQtc3R1ZGlvL2Rpc3QvcmVzL2NsaXBhcnQvaWNvbnMvcmVmcmVzaC5zdmc/cj1hYzk1NWU2Mzc2NDcwZDk1OTllYWQwN2I0NTk5ZWY5Mzc4MjRmOTE5XG5cdFx0XHRcdFx0YWRkRW50aXR5QnRuLmFwcGVuZCgncGF0aCcpLmF0dHIoIHsgJ2QnOiAnTTE2MC40NjksMjQyLjE5NGMwLTQ0LjQxNCwzNi4wMjMtODAuNDM4LDgwLjQzOC04MC40MzhjMTkuMTg4LDAsMzYuNzExLDYuODQ0LDUwLjUsMTguMDc4TDI1OS43OCwyMDkuOTNsOTkuOTQ1LDExLjM2NyAgICBsMC44MDUtMTA3LjI0MmwtMzAuNzY2LDI5LjI4OWMtMjMuNTQ2LTIxLjIwMy01NC42MjQtMzQuMTY0LTg4LjgwNC0zNC4xNjRjLTczLjQ2OSwwLTEzMy4wMjMsNTkuNTYyLTEzMy4wMjMsMTMzLjAxNiAgICBjMCwyLjc0MiwwLjI0Mi0yLjI2NiwwLjQxNCwwLjQ0NWw1My42OCw3LjU1NUMxNjEuMDMsMjQ1LjEwOCwxNjAuNDY5LDI0Ny41NjIsMTYwLjQ2OSwyNDIuMTk0eiBNMzcxLjY0NywyMzcuMzc1bC01My42ODEtNy41NTUgICAgYzEuMDE3LDUuMDg2LDEuNTU2LDIuNjE3LDEuNTU2LDcuOTkyYzAsNDQuNDE0LTM2LjAwOCw4MC40MzEtODAuNDMsODAuNDMxYy0xOS4xMzMsMC0zNi42MDItNi43OTgtNTAuMzgzLTE3Ljk3bDMxLjU5NS0zMC4wNzggICAgbC05OS45My0xMS4zNjZsLTAuODEyLDEwNy4yNWwzMC43ODktMjkuMzEyYzIzLjUzMSwyMS4xNDEsNTQuNTcsMzQuMDU1LDg4LjY4OCwzNC4wNTVjNzMuNDY4LDAsMTMzLjAyMy01OS41NTUsMTMzLjAyMy0xMzMuMDA4ICAgIEMzNzIuMDYyLDIzNS4wNzgsMzcxLjgxMiwyNDAuMDg1LDM3MS42NDcsMjM3LjM3NXonLCAnY2xhc3MnOiAnbnYtYm94IGNoYW5nZS1idG4tcGF0aCcsICd0cmFuc2Zvcm0nOiAnc2NhbGUoLjA0KSB0cmFuc2xhdGUoMTUwLC01MCknIH0gKTtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4uYXBwZW5kKCd0ZXh0JykuYXR0ciggeyd4JzoyOCwneSc6MTF9ICkudGV4dCgnQWRkIGNvdW50cnknKTtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4ub24oICdjbGljaycsIGZ1bmN0aW9uKCBkLCBpICkge1xuXHRcdFx0XHRcdFx0Ly9ncm91cCBieSB2YXJpYWJsZXNcblx0XHRcdFx0XHRcdGRpc3BhdGNoLmFkZEVudGl0eSgpO1xuXHRcdFx0XHRcdFx0ZDMuZXZlbnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdC8vYmFzZWQgb24gc2VsZWN0ZWQgY291bnRyaWVzIHNlbGVjdGlvbiBoaWRlIG9yIHNob3cgYWRkRW50aXR5QnRuXG5cdFx0XHRcdGlmKCBfLmlzRW1wdHkoIEFwcC5DaGFydE1vZGVsLmdldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiApICkgKSB7XG5cdFx0XHRcdFx0YWRkRW50aXR5QnRuLmF0dHIoIFwiZGlzcGxheVwiLCBcIm5vbmVcIiApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5hdHRyKCBcImRpc3BsYXlcIiwgXCJibG9ja1wiICk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR2YXIgYWRkQ291bnRyeU1vZGUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiYWRkLWNvdW50cnktbW9kZVwiICk7XG5cdFx0XHRcdGlmKCBhZGRDb3VudHJ5TW9kZSA9PT0gXCJhZGQtY291bnRyeVwiICkge1xuXHRcdFx0XHQvL2lmKCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiZ3JvdXAtYnktdmFyaWFibGVzXCIgKSApIHtcblx0XHRcdFx0XHQvL2lmIGdyb3VwaW5nIGJ5IHZhcmlhYmxlLCBsZWdlbmQgd2lsbCBzaG93IHZhcmlhYmxlcyBpbnN0ZWFkIG9mIGNvdW50cmllcywgc28gYWRkIGNvdW50cnkgYnRuIGRvZXNuJ3QgbWFrZSBzZW5zZVxuXHRcdFx0XHRcdC8vaWYgZW5hYmxpbmcgYWRkaW5nIGNvdW50cmllc1xuXHRcdFx0XHRcdC8vYWRkRW50aXR5QnRuLmF0dHIoIFwiZGlzcGxheVwiLCBcIm5vbmVcIiApO1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5zZWxlY3QoIFwidGV4dFwiICkudGV4dCggXCJBZGQgY291bnRyeVwiICk7XG5cdFx0XHRcdFx0YWRkRW50aXR5QnRuLnNlbGVjdCggXCJyZWN0XCIgKS5hdHRyKCBcIndpZHRoXCIsIFwiMTAwXCIgKTtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4uc2VsZWN0KCBcIi5hZGQtYnRuLXBhdGhcIiApLmF0dHIoIFwiZGlzcGxheVwiLCBcImJsb2NrXCIgKTtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4uc2VsZWN0KCBcIi5jaGFuZ2UtYnRuLXBhdGhcIiApLmF0dHIoIFwiZGlzcGxheVwiLCBcIm5vbmVcIiApO1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5hdHRyKCBcImRpc3BsYXlcIiwgXCJibG9ja1wiICk7XG5cdFx0XHRcdH0gZWxzZSBpZiggYWRkQ291bnRyeU1vZGUgPT09IFwiY2hhbmdlLWNvdW50cnlcIiApIHtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4uc2VsZWN0KCBcIi5hZGQtYnRuLXBhdGhcIiApLmF0dHIoIFwiZGlzcGxheVwiLCBcIm5vbmVcIiApO1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5zZWxlY3QoIFwiLmNoYW5nZS1idG4tcGF0aFwiICkuYXR0ciggXCJkaXNwbGF5XCIsIFwiYmxvY2tcIiApO1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5zZWxlY3QoIFwidGV4dFwiICkudGV4dCggXCJDaGFuZ2UgY291bnRyeVwiICk7XG5cdFx0XHRcdFx0YWRkRW50aXR5QnRuLnNlbGVjdCggXCJyZWN0XCIgKS5hdHRyKCBcIndpZHRoXCIsIFwiMTIwXCIgKTtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4uYXR0ciggXCJkaXNwbGF5XCIsIFwiYmxvY2tcIiApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5hdHRyKCBcImRpc3BsYXlcIiwgXCJub25lXCIgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRcdFxuXHRcdFx0XHR2YXIgc2VyaWVzRW50ZXIgPSBzZXJpZXMuZW50ZXIoKS5hcHBlbmQoJ2cnKS5hdHRyKCdjbGFzcycsICdudi1zZXJpZXMnKSxcblx0XHRcdFx0XHRzZXJpZXNTaGFwZSwgc2VyaWVzUmVtb3ZlO1xuXG5cdFx0XHRcdHZhciB2ZXJzUGFkZGluZyA9IDMwO1xuXHRcdFx0XHRzZXJpZXNFbnRlci5hcHBlbmQoJ3JlY3QnKVxuXHRcdFx0XHRcdC5zdHlsZSgnc3Ryb2tlLXdpZHRoJywgMilcblx0XHRcdFx0XHQuYXR0cignY2xhc3MnLCdudi1sZWdlbmQtc3ltYm9sJyk7XG5cblx0XHRcdFx0Ly9lbmFibGUgcmVtb3ZpbmcgY291bnRyaWVzIG9ubHkgaWYgQWRkL1JlcGxhY2UgY291bnRyeSBidXR0b24gcHJlc2VudFxuXHRcdFx0XHRpZiggYWRkQ291bnRyeU1vZGUgPT0gXCJhZGQtY291bnRyeVwiICYmICFBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiZ3JvdXAtYnktdmFyaWFibGVzXCIgKSApIHtcblx0XHRcdFx0XHR2YXIgcmVtb3ZlQnRucyA9IHNlcmllc0VudGVyLmFwcGVuZCgnZycpXG5cdFx0XHRcdFx0XHQuYXR0cignY2xhc3MnLCAnbnYtcmVtb3ZlLWJ0bicpXG5cdFx0XHRcdFx0XHQuYXR0cigndHJhbnNmb3JtJywgJ3RyYW5zbGF0ZSgxMCwxMCknKTtcblx0XHRcdFx0XHRyZW1vdmVCdG5zLmFwcGVuZCgncGF0aCcpLmF0dHIoIHsgJ2QnOiAnTTAsMCBMNyw3JywgJ2NsYXNzJzogJ252LWJveCcgfSApO1xuXHRcdFx0XHRcdHJlbW92ZUJ0bnMuYXBwZW5kKCdwYXRoJykuYXR0ciggeyAnZCc6ICdNNywwIEwwLDcnLCAnY2xhc3MnOiAnbnYtYm94JyB9ICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdHNlcmllc1NoYXBlID0gc2VyaWVzLnNlbGVjdCgnLm52LWxlZ2VuZC1zeW1ib2wnKTtcblx0XHRcdFx0XG5cdFx0XHRcdHNlcmllc0VudGVyLmFwcGVuZCgndGV4dCcpXG5cdFx0XHRcdFx0LmF0dHIoJ3RleHQtYW5jaG9yJywgJ3N0YXJ0Jylcblx0XHRcdFx0XHQuYXR0cignY2xhc3MnLCdudi1sZWdlbmQtdGV4dCcpXG5cdFx0XHRcdFx0LmF0dHIoJ2R5JywgJy4zMmVtJylcblx0XHRcdFx0XHQuYXR0cignZHgnLCAnMCcpO1xuXG5cdFx0XHRcdHZhciBzZXJpZXNUZXh0ID0gc2VyaWVzLnNlbGVjdCgndGV4dC5udi1sZWdlbmQtdGV4dCcpLFxuXHRcdFx0XHRcdHNlcmllc1JlbW92ZSA9IHNlcmllcy5zZWxlY3QoJy5udi1yZW1vdmUtYnRuJyk7XG5cblx0XHRcdFx0c2VyaWVzXG5cdFx0XHRcdFx0Lm9uKCdtb3VzZW92ZXInLCBmdW5jdGlvbihkLGkpIHtcblx0XHRcdFx0XHRcdGNoYXJ0TGVnZW5kLmRpc3BhdGNoLmxlZ2VuZE1vdXNlb3ZlcihkLGkpOyAgLy9UT0RPOiBNYWtlIGNvbnNpc3RlbnQgd2l0aCBvdGhlciBldmVudCBvYmplY3RzXG5cdFx0XHRcdFx0fSlcblx0XHRcdFx0XHQub24oJ21vdXNlb3V0JywgZnVuY3Rpb24oZCxpKSB7XG5cdFx0XHRcdFx0XHRjaGFydExlZ2VuZC5kaXNwYXRjaC5sZWdlbmRNb3VzZW91dChkLGkpO1xuXHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0Lm9uKCdjbGljaycsIGZ1bmN0aW9uKGQsaSkge1xuXG5cdFx0XHRcdFx0XHRpZiggQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImdyb3VwLWJ5LXZhcmlhYmxlc1wiICkgfHwgYWRkQ291bnRyeU1vZGUgIT09IFwiYWRkLWNvdW50cnlcIiApIHtcblx0XHRcdFx0XHRcdFx0Ly9pZiBkaXNwbGF5aW5nIHZhcmlhYmxlcywgaW5zdGVhZCBvZiByZW1vdmluZywgdXNlIG9yaWdpbmFsIHZlcnNpb24ganVzdCB0byB0dXJuIHN0dWZmIG9mZlxuXHRcdFx0XHRcdFx0XHQvL29yaWdpbmFsIHZlcnNpb24sIHdoZW4gY2xpY2tpbmcgY291bnRyeSBsYWJlbCBqdXN0IGRlYWN0aXZhdGVzIGl0XG5cdFx0XHRcdFx0XHRcdGNoYXJ0TGVnZW5kLmRpc3BhdGNoLmxlZ2VuZENsaWNrKGQsaSk7XG5cdFx0XHRcdFx0XHRcdC8vIG1ha2Ugc3VyZSB3ZSByZS1nZXQgZGF0YSBpbiBjYXNlIGl0IHdhcyBtb2RpZmllZFxuXHRcdFx0XHRcdFx0XHR2YXIgZGF0YSA9IHNlcmllcy5kYXRhKCk7XG5cdFx0XHRcdFx0XHRcdGlmICh1cGRhdGVTdGF0ZSkge1xuXHRcdFx0XHRcdFx0XHRcdGlmKGV4cGFuZGVkKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRkLmRpc2VuZ2FnZWQgPSAhZC5kaXNlbmdhZ2VkO1xuXHRcdFx0XHRcdFx0XHRcdFx0ZC51c2VyRGlzYWJsZWQgPSBkLnVzZXJEaXNhYmxlZCA9PSB1bmRlZmluZWQgPyAhIWQuZGlzYWJsZWQgOiBkLnVzZXJEaXNhYmxlZDtcblx0XHRcdFx0XHRcdFx0XHRcdGQuZGlzYWJsZWQgPSBkLmRpc2VuZ2FnZWQgfHwgZC51c2VyRGlzYWJsZWQ7XG5cdFx0XHRcdFx0XHRcdFx0fSBlbHNlIGlmICghZXhwYW5kZWQpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGQuZGlzYWJsZWQgPSAhZC5kaXNhYmxlZDtcblx0XHRcdFx0XHRcdFx0XHRcdGQudXNlckRpc2FibGVkID0gZC5kaXNhYmxlZDtcblx0XHRcdFx0XHRcdFx0XHRcdHZhciBlbmdhZ2VkID0gZGF0YS5maWx0ZXIoZnVuY3Rpb24oZCkgeyByZXR1cm4gIWQuZGlzZW5nYWdlZDsgfSk7XG5cdFx0XHRcdFx0XHRcdFx0XHRpZiAoZW5nYWdlZC5ldmVyeShmdW5jdGlvbihzZXJpZXMpIHsgcmV0dXJuIHNlcmllcy51c2VyRGlzYWJsZWQgfSkpIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0Ly90aGUgZGVmYXVsdCBiZWhhdmlvciBvZiBOVkQzIGxlZ2VuZHMgaXMsIGlmIGV2ZXJ5IHNpbmdsZSBzZXJpZXNcblx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gaXMgZGlzYWJsZWQsIHR1cm4gYWxsIHNlcmllcycgYmFjayBvbi5cblx0XHRcdFx0XHRcdFx0XHRcdFx0ZGF0YS5mb3JFYWNoKGZ1bmN0aW9uKHNlcmllcykge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHNlcmllcy5kaXNhYmxlZCA9IHNlcmllcy51c2VyRGlzYWJsZWQgPSBmYWxzZTtcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdGNoYXJ0TGVnZW5kLmRpc3BhdGNoLnN0YXRlQ2hhbmdlKHtcblx0XHRcdFx0XHRcdFx0XHRcdGRpc2FibGVkOiBkYXRhLm1hcChmdW5jdGlvbihkKSB7IHJldHVybiAhIWQuZGlzYWJsZWQ7IH0pLFxuXHRcdFx0XHRcdFx0XHRcdFx0ZGlzZW5nYWdlZDogZGF0YS5tYXAoZnVuY3Rpb24oZCkgeyByZXR1cm4gISFkLmRpc2VuZ2FnZWQ7IH0pXG5cdFx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblxuXHRcdFx0XHRcdFx0XHQvL3doZW4gY2xpY2tpbmcgY291bnRyeSBsYWJlbCwgcmVtb3ZlIHRoZSBjb3VudHJ5XG5cdFx0XHRcdFx0XHRcdGQzLmV2ZW50LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHRcdFx0XHQvL3JlbW92ZSBzZXJpZXMgc3RyYWlnaHQgYXdheSwgc28gd2UgZG9uJ3QgaGF2ZSB0byB3YWl0IGZvciByZXNwb25zZSBmcm9tIHNlcnZlclxuXHRcdFx0XHRcdFx0XHRzZXJpZXNbMF1baV0ucmVtb3ZlKCk7XG5cdFx0XHRcdFx0XHRcdFxuXHRcdFx0XHRcdFx0XHR2YXIgaWQgPSBkLmlkO1xuXHRcdFx0XHRcdFx0XHQvL2luIGNhc2Ugb2YgbXVsdGl2YXJpZW50IGNoYXJ0XG5cdFx0XHRcdFx0XHRcdGlmKCBpZC5pbmRleE9mKCBcIi1cIiApID4gMCApIHtcblx0XHRcdFx0XHRcdFx0XHRpZCA9IHBhcnNlSW50KCBpZC5zcGxpdCggXCItXCIgKVsgMCBdLCAxMCApO1xuXHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdGlkID0gcGFyc2VJbnQoIGlkLCAxMCApO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGRpc3BhdGNoLnJlbW92ZUVudGl0eSggaWQgKTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR9KVxuXHRcdFx0XHRcdC5vbignZGJsY2xpY2snLCBmdW5jdGlvbihkLGkpIHtcblx0XHRcdFx0XHRcdGlmKCh2ZXJzID09ICdmdXJpb3VzJyB8fCB2ZXJzID09ICdvd2QnKSAmJiBleHBhbmRlZCkgcmV0dXJuO1xuXHRcdFx0XHRcdFx0Y2hhcnRMZWdlbmQuZGlzcGF0Y2gubGVnZW5kRGJsY2xpY2soZCxpKTtcblx0XHRcdFx0XHRcdGlmICh1cGRhdGVTdGF0ZSkge1xuXHRcdFx0XHRcdFx0XHQvLyBtYWtlIHN1cmUgd2UgcmUtZ2V0IGRhdGEgaW4gY2FzZSBpdCB3YXMgbW9kaWZpZWRcblx0XHRcdFx0XHRcdFx0dmFyIGRhdGEgPSBzZXJpZXMuZGF0YSgpO1xuXHRcdFx0XHRcdFx0XHQvL3RoZSBkZWZhdWx0IGJlaGF2aW9yIG9mIE5WRDMgbGVnZW5kcywgd2hlbiBkb3VibGUgY2xpY2tpbmcgb25lLFxuXHRcdFx0XHRcdFx0XHQvLyBpcyB0byBzZXQgYWxsIG90aGVyIHNlcmllcycgdG8gZmFsc2UsIGFuZCBtYWtlIHRoZSBkb3VibGUgY2xpY2tlZCBzZXJpZXMgZW5hYmxlZC5cblx0XHRcdFx0XHRcdFx0ZGF0YS5mb3JFYWNoKGZ1bmN0aW9uKHNlcmllcykge1xuXHRcdFx0XHRcdFx0XHRcdHNlcmllcy5kaXNhYmxlZCA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdFx0aWYodmVycyA9PSAnZnVyaW91cycgfHwgdmVycyA9PSAnb3dkJykgc2VyaWVzLnVzZXJEaXNhYmxlZCA9IHNlcmllcy5kaXNhYmxlZDtcblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdGQuZGlzYWJsZWQgPSBmYWxzZTtcblx0XHRcdFx0XHRcdFx0aWYodmVycyA9PSAnZnVyaW91cycgfHwgdmVycyA9PSAnb3dkJyApIGQudXNlckRpc2FibGVkID0gZC5kaXNhYmxlZDtcblx0XHRcdFx0XHRcdFx0Y2hhcnRMZWdlbmQuZGlzcGF0Y2guc3RhdGVDaGFuZ2Uoe1xuXHRcdFx0XHRcdFx0XHRcdGRpc2FibGVkOiBkYXRhLm1hcChmdW5jdGlvbihkKSB7IHJldHVybiAhIWQuZGlzYWJsZWQ7IH0pXG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHNlcmllc1JlbW92ZS5vbiggJ2NsaWNrJywgZnVuY3Rpb24oIGQsIGkgKSB7XG5cblx0XHRcdFx0XHRkMy5ldmVudC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcblx0XHRcdFx0XHQvL3JlbW92ZSBzZXJpZXMgc3RyYWlnaHQgYXdheSwgc28gd2UgZG9uJ3QgaGF2ZSB0byB3YWl0IGZvciByZXNwb25zZSBmcm9tIHNlcnZlclxuXHRcdFx0XHRcdHNlcmllc1swXVtpXS5yZW1vdmUoKTtcblx0XHRcdFx0XHRkaXNwYXRjaC5yZW1vdmVFbnRpdHkoIGQuaWQgKTtcblx0XHRcdFx0XHRcblx0XHRcdFx0fSApO1x0XG5cblx0XHRcdFx0c2VyaWVzLmNsYXNzZWQoJ252LWRpc2FibGVkJywgZnVuY3Rpb24oZCkgeyByZXR1cm4gZC51c2VyRGlzYWJsZWQ7IH0pO1xuXHRcdFx0XHRzZXJpZXMuZXhpdCgpLnJlbW92ZSgpO1xuXG5cdFx0XHRcdHNlcmllc1RleHRcblx0XHRcdFx0XHQuYXR0cignZmlsbCcsIHNldFRleHRDb2xvcilcblx0XHRcdFx0XHQudGV4dChnZXRLZXkpO1xuXG5cdFx0XHRcdC8vVE9ETzogaW1wbGVtZW50IGZpeGVkLXdpZHRoIGFuZCBtYXgtd2lkdGggb3B0aW9ucyAobWF4LXdpZHRoIGlzIGVzcGVjaWFsbHkgdXNlZnVsIHdpdGggdGhlIGFsaWduIG9wdGlvbilcblx0XHRcdFx0Ly8gTkVXIEFMSUdOSU5HIENPREUsIFRPRE86IGNsZWFuIHVwXG5cdFx0XHRcdHZhciBsZWdlbmRXaWR0aCA9IDAsXG5cdFx0XHRcdFx0dHJhbnNmb3JtWCwgdHJhbnNmb3JtWTtcblx0XHRcdFx0aWYgKGFsaWduKSB7XG5cblx0XHRcdFx0XHR2YXIgc2VyaWVzV2lkdGhzID0gW107XG5cdFx0XHRcdFx0c2VyaWVzLmVhY2goIGZ1bmN0aW9uKGQsaSkge1xuXHRcdFx0XHRcdFx0dmFyIGxlZ2VuZFRleHQgPSBkMy5zZWxlY3QodGhpcykuc2VsZWN0KCd0ZXh0Jyk7XG5cdFx0XHRcdFx0XHR2YXIgbm9kZVRleHRMZW5ndGg7XG5cdFx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0XHRub2RlVGV4dExlbmd0aCA9IGxlZ2VuZFRleHQubm9kZSgpLmdldENvbXB1dGVkVGV4dExlbmd0aCgpO1xuXHRcdFx0XHRcdFx0XHQvLyBJZiB0aGUgbGVnZW5kVGV4dCBpcyBkaXNwbGF5Om5vbmUnZCAobm9kZVRleHRMZW5ndGggPT0gMCksIHNpbXVsYXRlIGFuIGVycm9yIHNvIHdlIGFwcHJveGltYXRlLCBpbnN0ZWFkXG5cdFx0XHRcdFx0XHRcdGlmKG5vZGVUZXh0TGVuZ3RoIDw9IDApIHRocm93IEVycm9yKCk7XG5cdFx0XHRcdFx0XHR9IGNhdGNoKCBlICkge1xuXHRcdFx0XHRcdFx0XHRub2RlVGV4dExlbmd0aCA9IG52LnV0aWxzLmNhbGNBcHByb3hUZXh0V2lkdGgobGVnZW5kVGV4dCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRzZXJpZXNXaWR0aHMucHVzaChub2RlVGV4dExlbmd0aCArIHBhZGRpbmcpO1xuXHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0dmFyIHNlcmllc1BlclJvdyA9IDA7XG5cdFx0XHRcdFx0dmFyIGNvbHVtbldpZHRocyA9IFtdO1xuXHRcdFx0XHRcdGxlZ2VuZFdpZHRoID0gMDtcblxuXHRcdFx0XHRcdHdoaWxlKCBsZWdlbmRXaWR0aCA8IGF2YWlsYWJsZVdpZHRoICYmIHNlcmllc1BlclJvdyA8IHNlcmllc1dpZHRocy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0XHRjb2x1bW5XaWR0aHNbc2VyaWVzUGVyUm93XSA9IHNlcmllc1dpZHRoc1tzZXJpZXNQZXJSb3ddO1xuXHRcdFx0XHRcdFx0bGVnZW5kV2lkdGggKz0gc2VyaWVzV2lkdGhzW3Nlcmllc1BlclJvdysrXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYoIHNlcmllc1BlclJvdyA9PT0gMCApIHNlcmllc1BlclJvdyA9IDE7IC8vbWluaW11bSBvZiBvbmUgc2VyaWVzIHBlciByb3dcblxuXHRcdFx0XHRcdHdoaWxlKCBsZWdlbmRXaWR0aCA+IGF2YWlsYWJsZVdpZHRoICYmIHNlcmllc1BlclJvdyA+IDEgKSB7XG5cdFx0XHRcdFx0XHRjb2x1bW5XaWR0aHMgPSBbXTtcblx0XHRcdFx0XHRcdHNlcmllc1BlclJvdy0tO1xuXG5cdFx0XHRcdFx0XHRmb3IgKHZhciBrID0gMDsgayA8IHNlcmllc1dpZHRocy5sZW5ndGg7IGsrKykge1xuXHRcdFx0XHRcdFx0XHRpZiAoc2VyaWVzV2lkdGhzW2tdID4gKGNvbHVtbldpZHRoc1trICUgc2VyaWVzUGVyUm93XSB8fCAwKSApXG5cdFx0XHRcdFx0XHRcdFx0Y29sdW1uV2lkdGhzW2sgJSBzZXJpZXNQZXJSb3ddID0gc2VyaWVzV2lkdGhzW2tdO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRsZWdlbmRXaWR0aCA9IGNvbHVtbldpZHRocy5yZWR1Y2UoZnVuY3Rpb24ocHJldiwgY3VyLCBpbmRleCwgYXJyYXkpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHByZXYgKyBjdXI7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR2YXIgeFBvc2l0aW9ucyA9IFtdO1xuXHRcdFx0XHRcdGZvciAodmFyIGkgPSAwLCBjdXJYID0gMDsgaSA8IHNlcmllc1BlclJvdzsgaSsrKSB7XG5cdFx0XHRcdFx0XHR4UG9zaXRpb25zW2ldID0gY3VyWDtcblx0XHRcdFx0XHRcdGN1clggKz0gY29sdW1uV2lkdGhzW2ldO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHNlcmllc1xuXHRcdFx0XHRcdFx0LmF0dHIoJ3RyYW5zZm9ybScsIGZ1bmN0aW9uKGQsIGkpIHtcblx0XHRcdFx0XHRcdFx0dHJhbnNmb3JtWCA9IHhQb3NpdGlvbnNbaSAlIHNlcmllc1BlclJvd107XG5cdFx0XHRcdFx0XHRcdHRyYW5zZm9ybVkgPSAoNSArIE1hdGguZmxvb3IoaSAvIHNlcmllc1BlclJvdykgKiB2ZXJzUGFkZGluZyk7XG5cdFx0XHRcdFx0XHRcdHJldHVybiAndHJhbnNsYXRlKCcgKyB0cmFuc2Zvcm1YICsgJywnICsgdHJhbnNmb3JtWSArICcpJztcblx0XHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0Ly9wb3NpdGlvbiBsZWdlbmQgYXMgZmFyIHJpZ2h0IGFzIHBvc3NpYmxlIHdpdGhpbiB0aGUgdG90YWwgd2lkdGhcblx0XHRcdFx0XHRpZiAocmlnaHRBbGlnbikge1xuXHRcdFx0XHRcdFx0Zy5hdHRyKCd0cmFuc2Zvcm0nLCAndHJhbnNsYXRlKCcgKyAod2lkdGggLSBtYXJnaW4ucmlnaHQgLSBsZWdlbmRXaWR0aCkgKyAnLCcgKyBtYXJnaW4udG9wICsgJyknKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0XHRnLmF0dHIoJ3RyYW5zZm9ybScsICd0cmFuc2xhdGUoJyArIGVudGl0eUxhYmVsV2lkdGggKyAnLCcgKyBtYXJnaW4udG9wICsgJyknKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRoZWlnaHQgPSBtYXJnaW4udG9wICsgbWFyZ2luLmJvdHRvbSArIChNYXRoLmNlaWwoc2VyaWVzV2lkdGhzLmxlbmd0aCAvIHNlcmllc1BlclJvdykgKiB2ZXJzUGFkZGluZyk7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdH0gZWxzZSB7XG5cblx0XHRcdFx0XHR2YXIgeXBvcyA9IDUsXG5cdFx0XHRcdFx0XHRuZXd4cG9zID0gNSxcblx0XHRcdFx0XHRcdG1heHdpZHRoID0gMCxcblx0XHRcdFx0XHRcdHhwb3M7XG5cdFx0XHRcdFx0c2VyaWVzXG5cdFx0XHRcdFx0XHQuYXR0cigndHJhbnNmb3JtJywgZnVuY3Rpb24oZCwgaSkge1xuXHRcdFx0XHRcdFx0XHR2YXIgbGVuZ3RoID0gZDMuc2VsZWN0KHRoaXMpLnNlbGVjdCgndGV4dCcpLm5vZGUoKS5nZXRDb21wdXRlZFRleHRMZW5ndGgoKSArIHBhZGRpbmc7XG5cdFx0XHRcdFx0XHRcdHhwb3MgPSBuZXd4cG9zO1xuXG5cdFx0XHRcdFx0XHRcdGlmICh3aWR0aCA8IG1hcmdpbi5sZWZ0ICsgbWFyZ2luLnJpZ2h0ICsgeHBvcyArIGxlbmd0aCkge1xuXHRcdFx0XHRcdFx0XHRcdG5ld3hwb3MgPSB4cG9zID0gNTtcblx0XHRcdFx0XHRcdFx0XHR5cG9zICs9IHZlcnNQYWRkaW5nO1xuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0bmV3eHBvcyArPSBsZW5ndGg7XG5cdFx0XHRcdFx0XHRcdGlmIChuZXd4cG9zID4gbWF4d2lkdGgpIG1heHdpZHRoID0gbmV3eHBvcztcblxuXHRcdFx0XHRcdFx0XHRpZihsZWdlbmRXaWR0aCA8IHhwb3MgKyBtYXh3aWR0aCkge1xuXHRcdFx0XHRcdFx0XHRcdGxlZ2VuZFdpZHRoID0geHBvcyArIG1heHdpZHRoO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdHJldHVybiAndHJhbnNsYXRlKCcgKyB4cG9zICsgJywnICsgeXBvcyArICcpJztcblx0XHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0Ly9wb3NpdGlvbiBsZWdlbmQgYXMgZmFyIHJpZ2h0IGFzIHBvc3NpYmxlIHdpdGhpbiB0aGUgdG90YWwgd2lkdGhcblx0XHRcdFx0XHRnLmF0dHIoJ3RyYW5zZm9ybScsICd0cmFuc2xhdGUoJyArICh3aWR0aCAtIG1hcmdpbi5yaWdodCAtIG1heHdpZHRoKSArICcsJyArIG1hcmdpbi50b3AgKyAnKScpO1xuXG5cdFx0XHRcdFx0aGVpZ2h0ID0gbWFyZ2luLnRvcCArIG1hcmdpbi5ib3R0b20gKyB5cG9zICsgMTU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBTaXplIHJlY3RhbmdsZXMgYWZ0ZXIgdGV4dCBpcyBwbGFjZWRcblx0XHRcdFx0c2VyaWVzU2hhcGVcblx0XHRcdFx0XHQuYXR0cignd2lkdGgnLCBmdW5jdGlvbihkLGkpIHtcblx0XHRcdFx0XHRcdC8vcG9zaXRpb24gcmVtb3ZlIGJ0blxuXHRcdFx0XHRcdFx0dmFyIHdpZHRoID0gc2VyaWVzVGV4dFswXVtpXS5nZXRDb21wdXRlZFRleHRMZW5ndGgoKSArIDU7XG5cdFx0XHRcdFx0XHRkMy5zZWxlY3QoIHNlcmllc1JlbW92ZVswXVtpXSApLmF0dHIoICd0cmFuc2Zvcm0nLCAndHJhbnNsYXRlKCcgKyB3aWR0aCArICcsLTMpJyApO1xuXHRcdFx0XHRcdFx0cmV0dXJuIHdpZHRoKzI1O1xuXHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0LmF0dHIoJ2hlaWdodCcsIDI0KVxuXHRcdFx0XHRcdC5hdHRyKCd5JywgLTEyKVxuXHRcdFx0XHRcdC5hdHRyKCd4JywgLTEyKTtcblxuXHRcdFx0XHQvLyBUaGUgYmFja2dyb3VuZCBmb3IgdGhlIGV4cGFuZGVkIGxlZ2VuZCAoVUkpXG5cdFx0XHRcdGdFbnRlci5pbnNlcnQoJ3JlY3QnLCc6Zmlyc3QtY2hpbGQnKVxuXHRcdFx0XHRcdC5hdHRyKCdjbGFzcycsICdudi1sZWdlbmQtYmcnKVxuXHRcdFx0XHRcdC5hdHRyKCdmaWxsJywgJyNlZWUnKVxuXHRcdFx0XHRcdC8vIC5hdHRyKCdzdHJva2UnLCAnIzQ0NCcpXG5cdFx0XHRcdFx0LmF0dHIoJ29wYWNpdHknLDApO1xuXG5cdFx0XHRcdHZhciBzZXJpZXNCRyA9IGcuc2VsZWN0KCcubnYtbGVnZW5kLWJnJyk7XG5cblx0XHRcdFx0c2VyaWVzQkdcblx0XHRcdFx0LnRyYW5zaXRpb24oKS5kdXJhdGlvbigzMDApXG5cdFx0XHRcdFx0LmF0dHIoJ3gnLCAtdmVyc1BhZGRpbmcgKVxuXHRcdFx0XHRcdC5hdHRyKCd3aWR0aCcsIGxlZ2VuZFdpZHRoICsgdmVyc1BhZGRpbmcgLSAxMilcblx0XHRcdFx0XHQuYXR0cignaGVpZ2h0JywgaGVpZ2h0IClcblx0XHRcdFx0XHQuYXR0cigneScsIC1tYXJnaW4udG9wIC0gMTApXG5cdFx0XHRcdFx0LmF0dHIoJ29wYWNpdHknLCBleHBhbmRlZCA/IDEgOiAwKTtcblxuXHRcdFx0XHRzZXJpZXNTaGFwZVxuXHRcdFx0XHRcdC5zdHlsZSgnZmlsbCcsIHNldEJHQ29sb3IpXG5cdFx0XHRcdFx0LnN0eWxlKCdmaWxsLW9wYWNpdHknLCBzZXRCR09wYWNpdHkpXG5cdFx0XHRcdFx0LnN0eWxlKCdzdHJva2UnLCBzZXRCR0NvbG9yKTtcblxuXHRcdFx0XHQvL3Bvc2l0aW9uIGFkZCBidG5cblx0XHRcdFx0aWYoIHNlcmllcy5zaXplKCkgKSB7XG5cblx0XHRcdFx0XHR2YXIgc2VyaWVzQXJyID0gc2VyaWVzWzBdO1xuXHRcdFx0XHRcdGlmKCBzZXJpZXNBcnIgJiYgc2VyaWVzQXJyLmxlbmd0aCApIHtcblx0XHRcdFx0XHRcdC8vZmV0Y2ggbGFzdCBlbGVtZW50IHRvIGtub3cgaXRzIHdpZHRoXG5cdFx0XHRcdFx0XHR2YXIgbGFzdEVsID0gc2VyaWVzQXJyWyBzZXJpZXNBcnIubGVuZ3RoLTEgXSxcblx0XHRcdFx0XHRcdFx0Ly9uZWVkIHJlY3QgaW5zaWRlIGVsZW1lbnQgdGhhdCBoYXMgc2V0IHdpZHRoXG5cdFx0XHRcdFx0XHRcdGxhc3RSZWN0ID0gZDMuc2VsZWN0KCBsYXN0RWwgKS5zZWxlY3QoIFwicmVjdFwiICksXG5cdFx0XHRcdFx0XHRcdGxhc3RSZWN0V2lkdGggPSBsYXN0UmVjdC5hdHRyKCBcIndpZHRoXCIgKTtcblx0XHRcdFx0XHRcdC8vcG9zaXRpb24gYWRkIGJ0blxuXHRcdFx0XHRcdFx0dHJhbnNmb3JtWCA9ICt0cmFuc2Zvcm1YICsgcGFyc2VJbnQoIGxhc3RSZWN0V2lkdGgsIDEwICkgLSAzO1xuXHRcdFx0XHRcdFx0dHJhbnNmb3JtWCArPSBlbnRpdHlMYWJlbFdpZHRoO1xuXHRcdFx0XHRcdFx0Ly9jZW50ZXJpbmdcblx0XHRcdFx0XHRcdHRyYW5zZm9ybVkgPSArdHJhbnNmb3JtWSAtIDM7XG5cdFx0XHRcdFx0XHQvL2NoZWNrIGZvciByaWdodCBlZGdlXG5cdFx0XHRcdFx0XHR2YXIgYnV0dG9uV2lkdGggPSAxMjAsIGJ1dHRvbkhlaWdodCA9IDM1O1xuXHRcdFx0XHRcdFx0aWYoICggdHJhbnNmb3JtWCArIGJ1dHRvbldpZHRoICkgPiBhdmFpbGFibGVXaWR0aCApIHtcblx0XHRcdFx0XHRcdFx0Ly9tYWtlIHN1cmUgd2UgaGF2ZSBidXR0b25cblx0XHRcdFx0XHRcdFx0dmFyIGFkZEVudGl0eURpc3BsYXkgPSBhZGRFbnRpdHlCdG4uYXR0ciggXCJkaXNwbGF5XCIgKTtcblx0XHRcdFx0XHRcdFx0aWYoIGFkZEVudGl0eURpc3BsYXkgIT09IFwibm9uZVwiICkge1xuXHRcdFx0XHRcdFx0XHRcdHRyYW5zZm9ybVggPSAwOy8vYXZhaWxhYmxlV2lkdGggLSBidXR0b25XaWR0aDtcblx0XHRcdFx0XHRcdFx0XHR0cmFuc2Zvcm1ZICs9IGJ1dHRvbkhlaWdodDtcblx0XHRcdFx0XHRcdFx0XHQvL3VwZGF0ZSB3aG9sZSBjaGFydCBoZWlnaHQgYXMgd2VsbFxuXHRcdFx0XHRcdFx0XHRcdGhlaWdodCArPSBidXR0b25IZWlnaHQ7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5hdHRyKCBcInRyYW5zZm9ybVwiLCBcInRyYW5zbGF0ZSggXCIgKyB0cmFuc2Zvcm1YICsgXCIsIFwiICsgdHJhbnNmb3JtWSArIFwiKVwiICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XG5cdFx0XHRcdH1cblx0XHRcdFxuXHRcdFx0fSk7XG5cdFx0XHRcblx0XHRcdGZ1bmN0aW9uIHNldFRleHRDb2xvcihkLGkpIHtcblx0XHRcdFx0aWYodmVycyAhPSAnZnVyaW91cycgJiYgdmVycyAhPSAnb3dkJykgcmV0dXJuICcjMDAwJztcblx0XHRcdFx0aWYoZXhwYW5kZWQpIHtcblx0XHRcdFx0XHRyZXR1cm4gZC5kaXNlbmdhZ2VkID8gJyMwMDAnIDogJyNmZmYnO1xuXHRcdFx0XHR9IGVsc2UgaWYgKCFleHBhbmRlZCkge1xuXHRcdFx0XHRcdGlmKCFkLmNvbG9yKSBkLmNvbG9yID0gY29sb3IoZCxpKTtcblx0XHRcdFx0XHRyZXR1cm4gISFkLmRpc2FibGVkID8gJyM2NjYnIDogJyNmZmYnO1xuXHRcdFx0XHRcdC8vcmV0dXJuICEhZC5kaXNhYmxlZCA/IGQuY29sb3IgOiAnI2ZmZic7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0ZnVuY3Rpb24gc2V0QkdDb2xvcihkLGkpIHtcblx0XHRcdFx0aWYoZXhwYW5kZWQgJiYgKHZlcnMgPT0gJ2Z1cmlvdXMnIHx8IHZlcnMgPT0gJ293ZCcpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGQuZGlzZW5nYWdlZCA/ICcjZWVlJyA6IGQuY29sb3IgfHwgY29sb3IoZCxpKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXR1cm4gZC5jb2xvciB8fCBjb2xvcihkLGkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblxuXHRcdFx0ZnVuY3Rpb24gc2V0QkdPcGFjaXR5KGQsaSkge1xuXHRcdFx0XHRpZihleHBhbmRlZCAmJiAodmVycyA9PSAnZnVyaW91cycgfHwgdmVycyA9PSAnb3dkJykpIHtcblx0XHRcdFx0XHRyZXR1cm4gMTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXR1cm4gISFkLmRpc2FibGVkID8gMCA6IDE7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGNoYXJ0O1xuXHRcdH1cblxuXHRcdC8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cdFx0Ly8gRXhwb3NlIFB1YmxpYyBWYXJpYWJsZXNcblx0XHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5cdFx0Y2hhcnQuZGlzcGF0Y2ggPSBkaXNwYXRjaDtcblx0XHRjaGFydC5vcHRpb25zID0gbnYudXRpbHMub3B0aW9uc0Z1bmMuYmluZChjaGFydCk7XG5cblx0XHRjaGFydC5fb3B0aW9ucyA9IE9iamVjdC5jcmVhdGUoe30sIHtcblx0XHRcdC8vIHNpbXBsZSBvcHRpb25zLCBqdXN0IGdldC9zZXQgdGhlIG5lY2Vzc2FyeSB2YWx1ZXNcblx0XHRcdHdpZHRoOiAgICAgIHtnZXQ6IGZ1bmN0aW9uKCl7cmV0dXJuIHdpZHRoO30sIHNldDogZnVuY3Rpb24oXyl7d2lkdGg9Xzt9fSxcblx0XHRcdGhlaWdodDogICAgIHtnZXQ6IGZ1bmN0aW9uKCl7cmV0dXJuIGhlaWdodDt9LCBzZXQ6IGZ1bmN0aW9uKF8pe2hlaWdodD1fO319LFxuXHRcdFx0a2V5OiAgICAgICAge2dldDogZnVuY3Rpb24oKXtyZXR1cm4gZ2V0S2V5O30sIHNldDogZnVuY3Rpb24oXyl7Z2V0S2V5PV87fX0sXG5cdFx0XHRhbGlnbjogICAgICB7Z2V0OiBmdW5jdGlvbigpe3JldHVybiBhbGlnbjt9LCBzZXQ6IGZ1bmN0aW9uKF8pe2FsaWduPV87fX0sXG5cdFx0XHRyaWdodEFsaWduOiAgICB7Z2V0OiBmdW5jdGlvbigpe3JldHVybiByaWdodEFsaWduO30sIHNldDogZnVuY3Rpb24oXyl7cmlnaHRBbGlnbj1fO319LFxuXHRcdFx0cGFkZGluZzogICAgICAge2dldDogZnVuY3Rpb24oKXtyZXR1cm4gcGFkZGluZzt9LCBzZXQ6IGZ1bmN0aW9uKF8pe3BhZGRpbmc9Xzt9fSxcblx0XHRcdHVwZGF0ZVN0YXRlOiAgIHtnZXQ6IGZ1bmN0aW9uKCl7cmV0dXJuIHVwZGF0ZVN0YXRlO30sIHNldDogZnVuY3Rpb24oXyl7dXBkYXRlU3RhdGU9Xzt9fSxcblx0XHRcdHJhZGlvQnV0dG9uTW9kZTogICAge2dldDogZnVuY3Rpb24oKXtyZXR1cm4gcmFkaW9CdXR0b25Nb2RlO30sIHNldDogZnVuY3Rpb24oXyl7cmFkaW9CdXR0b25Nb2RlPV87fX0sXG5cdFx0XHRleHBhbmRlZDogICB7Z2V0OiBmdW5jdGlvbigpe3JldHVybiBleHBhbmRlZDt9LCBzZXQ6IGZ1bmN0aW9uKF8pe2V4cGFuZGVkPV87fX0sXG5cdFx0XHR2ZXJzOiAgIHtnZXQ6IGZ1bmN0aW9uKCl7cmV0dXJuIHZlcnM7fSwgc2V0OiBmdW5jdGlvbihfKXt2ZXJzPV87fX0sXG5cblx0XHRcdC8vIG9wdGlvbnMgdGhhdCByZXF1aXJlIGV4dHJhIGxvZ2ljIGluIHRoZSBzZXR0ZXJcblx0XHRcdG1hcmdpbjoge2dldDogZnVuY3Rpb24oKXtyZXR1cm4gbWFyZ2luO30sIHNldDogZnVuY3Rpb24oXyl7XG5cdFx0XHRcdG1hcmdpbi50b3AgICAgPSBfLnRvcCAgICAhPT0gdW5kZWZpbmVkID8gXy50b3AgICAgOiBtYXJnaW4udG9wO1xuXHRcdFx0XHRtYXJnaW4ucmlnaHQgID0gXy5yaWdodCAgIT09IHVuZGVmaW5lZCA/IF8ucmlnaHQgIDogbWFyZ2luLnJpZ2h0O1xuXHRcdFx0XHRtYXJnaW4uYm90dG9tID0gXy5ib3R0b20gIT09IHVuZGVmaW5lZCA/IF8uYm90dG9tIDogbWFyZ2luLmJvdHRvbTtcblx0XHRcdFx0bWFyZ2luLmxlZnQgICA9IF8ubGVmdCAgICE9PSB1bmRlZmluZWQgPyBfLmxlZnQgICA6IG1hcmdpbi5sZWZ0O1xuXHRcdFx0fX0sXG5cdFx0XHRjb2xvcjogIHtnZXQ6IGZ1bmN0aW9uKCl7cmV0dXJuIGNvbG9yO30sIHNldDogZnVuY3Rpb24oXyl7XG5cdFx0XHRcdGNvbG9yID0gbnYudXRpbHMuZ2V0Q29sb3IoXyk7XG5cdFx0XHR9fVxuXHRcdH0pO1xuXG5cdFx0bnYudXRpbHMuaW5pdE9wdGlvbnMoY2hhcnQpO1xuXG5cdFx0cmV0dXJuIGNoYXJ0O1xuXHR9O1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkNoYXJ0LkxlZ2VuZDtcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBNYXBDb250cm9scyA9IHJlcXVpcmUoIFwiLi9tYXAvQXBwLlZpZXdzLkNoYXJ0Lk1hcC5NYXBDb250cm9scy5qc1wiICk7XG5cblx0QXBwLlZpZXdzLkNoYXJ0Lk1hcFRhYiA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblxuXHRcdCR0YWI6IG51bGwsXG5cdFx0ZGF0YU1hcDogbnVsbCxcblx0XHRtYXBDb250cm9sczogbnVsbCxcblx0XHRsZWdlbmQ6IG51bGwsXG5cblx0XHRldmVudHM6IHt9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHRcblx0XHRcdHRoaXMuZGlzcGF0Y2hlciA9IG9wdGlvbnMuZGlzcGF0Y2hlcjtcblx0XHRcdHRoaXMubWFwQ29udHJvbHMgPSBuZXcgTWFwQ29udHJvbHMoIHsgZGlzcGF0Y2hlcjogb3B0aW9ucy5kaXNwYXRjaGVyIH0gKTtcblxuXHRcdFx0Ly9pbml0IG1hcCBvbmx5IGlmIHRoZSBtYXAgdGFiIGRpc3BsYXllZFxuXHRcdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdFx0JCggXCJbZGF0YS10b2dnbGU9J3RhYiddW2hyZWY9JyNtYXAtY2hhcnQtdGFiJ11cIiApLm9uKCBcInNob3duLmJzLnRhYlwiLCBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0XHR0aGF0LmRpc3BsYXkoKTtcblx0XHRcdH0gKTtcblx0XHRcdFxuXHRcdH0sXG5cblx0XHRkaXNwbGF5OiBmdW5jdGlvbigpIHtcblx0XHRcdC8vcmVuZGVyIG9ubHkgaWYgbm8gbWFwIHlldFxuXHRcdFx0aWYoICF0aGlzLmRhdGFNYXAgKSB7XG5cdFx0XHRcdHRoaXMucmVuZGVyKCk7XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cblx0XHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRcdC8vZmV0Y2ggY3JlYXRlZCBkb21cblx0XHRcdHRoaXMuJHRhYiA9ICQoIFwiI21hcC1jaGFydC10YWJcIiApO1xuXG5cdFx0XHR2YXIgbWFwQ29uZmlnID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcIm1hcC1jb25maWdcIiApLFxuXHRcdFx0XHRkZWZhdWx0UHJvamVjdGlvbiA9IHRoaXMuZ2V0UHJvamVjdGlvbiggbWFwQ29uZmlnLnByb2plY3Rpb24gKTtcblx0XHRcdFxuXHRcdFx0dGhpcy5kYXRhTWFwID0gbmV3IERhdGFtYXAoIHtcblx0XHRcdFx0d2lkdGg6IHRoYXQuJHRhYi53aWR0aCgpLFxuXHRcdFx0XHRoZWlnaHQ6IHRoYXQuJHRhYi5oZWlnaHQoKSxcblx0XHRcdFx0cmVzcG9uc2l2ZTogdHJ1ZSxcblx0XHRcdFx0ZWxlbWVudDogZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIFwibWFwLWNoYXJ0LXRhYlwiICksXG5cdFx0XHRcdGdlb2dyYXBoeUNvbmZpZzoge1xuXHRcdFx0XHRcdGRhdGFVcmw6IEdsb2JhbC5yb290VXJsICsgXCIvanMvZGF0YS93b3JsZC5pZHMuanNvblwiLFxuXHRcdFx0XHRcdGJvcmRlcldpZHRoOiAwLjEsXG5cdFx0XHRcdFx0Ym9yZGVyQ29sb3I6ICcjNEY0RjRGJyxcblx0XHRcdFx0XHRoaWdobGlnaHRCb3JkZXJDb2xvcjogJ2JsYWNrJyxcblx0XHRcdFx0XHRoaWdobGlnaHRCb3JkZXJXaWR0aDogMC4yLFxuXHRcdFx0XHRcdGhpZ2hsaWdodEZpbGxDb2xvcjogJyNGRkVDMzgnLFxuXHRcdFx0XHRcdHBvcHVwVGVtcGxhdGU6IHRoYXQucG9wdXBUZW1wbGF0ZUdlbmVyYXRvclxuXHRcdFx0XHR9LFxuXHRcdFx0XHRmaWxsczoge1xuXHRcdFx0XHRcdGRlZmF1bHRGaWxsOiAnI0ZGRkZGRidcblx0XHRcdFx0XHQvL2RlZmF1bHRGaWxsOiAnI0RERERERCdcblx0XHRcdFx0fSxcblx0XHRcdFx0c2V0UHJvamVjdGlvbjogZGVmYXVsdFByb2plY3Rpb24sXG5cdFx0XHRcdC8vd2FpdCBmb3IganNvbiB0byBsb2FkIGJlZm9yZSBsb2FkaW5nIG1hcCBkYXRhXG5cdFx0XHRcdGRvbmU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdHRoYXQubWFwRGF0YU1vZGVsID0gbmV3IEFwcC5Nb2RlbHMuQ2hhcnREYXRhTW9kZWwoKTtcblx0XHRcdFx0XHR0aGF0Lm1hcERhdGFNb2RlbC5vbiggXCJzeW5jXCIsIGZ1bmN0aW9uKCBtb2RlbCwgcmVzcG9uc2UgKSB7XG5cdFx0XHRcdFx0XHRpZiggcmVzcG9uc2UuZGF0YSApIHtcblx0XHRcdFx0XHRcdFx0dGhhdC5kaXNwbGF5RGF0YSggcmVzcG9uc2UuZGF0YSApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHR0aGF0Lm1hcERhdGFNb2RlbC5vbiggXCJlcnJvclwiLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoIFwiRXJyb3IgbG9hZGluZyBtYXAgZGF0YS5cIiApO1xuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHR0aGF0LnVwZGF0ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cblx0XHRcdHRoaXMubGVnZW5kID0gbmV3IEFwcC5WaWV3cy5DaGFydC5NYXAuTGVnZW5kKCk7XG5cdFx0XHRcblx0XHRcdEFwcC5DaGFydE1vZGVsLm9uKCBcImNoYW5nZVwiLCB0aGlzLm9uQ2hhcnRNb2RlbENoYW5nZSwgdGhpcyApO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwub24oIFwiY2hhbmdlLW1hcFwiLCB0aGlzLm9uQ2hhcnRNb2RlbENoYW5nZSwgdGhpcyApO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwub24oIFwicmVzaXplXCIsIHRoaXMub25DaGFydE1vZGVsUmVzaXplLCB0aGlzICk7XG5cdFx0XHRcblx0XHRcdG52LnV0aWxzLndpbmRvd1Jlc2l6ZSggJC5wcm94eSggdGhpcy5vblJlc2l6ZSwgdGhpcyApICk7XG5cdFx0XHR0aGlzLm9uUmVzaXplKCk7XG5cblx0XHR9LFxuXG5cdFx0b25DaGFydE1vZGVsQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHR0aGlzLnVwZGF0ZSgpO1xuXG5cdFx0fSxcblxuXHRcdHBvcHVwVGVtcGxhdGVHZW5lcmF0b3I6IGZ1bmN0aW9uKCBnZW8sIGRhdGEgKSB7XG5cdFx0XHQvL3RyYW5zZm9ybSBkYXRhbWFwcyBkYXRhIGludG8gZm9ybWF0IGNsb3NlIHRvIG52ZDMgc28gdGhhdCB3ZSBjYW4gcmV1c2UgdGhlIHNhbWUgcG9wdXAgZ2VuZXJhdG9yXG5cdFx0XHR2YXIgbWFwQ29uZmlnID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcIm1hcC1jb25maWdcIiApO1xuXHRcdFx0dmFyIHByb3BlcnR5TmFtZSA9IEFwcC5VdGlscy5nZXRQcm9wZXJ0eUJ5VmFyaWFibGVJZCggQXBwLkNoYXJ0TW9kZWwsIG1hcENvbmZpZy52YXJpYWJsZUlkICk7XG5cdFx0XHRpZiggIXByb3BlcnR5TmFtZSApIHtcblx0XHRcdFx0cHJvcGVydHlOYW1lID0gXCJ5XCI7XG5cdFx0XHR9XG5cdFx0XHR2YXIgb2JqID0ge1xuXHRcdFx0XHRwb2ludDoge1xuXHRcdFx0XHRcdHRpbWU6IG1hcENvbmZpZy50YXJnZXRZZWFyIH0sXG5cdFx0XHRcdHNlcmllczogWyB7XG5cdFx0XHRcdFx0a2V5OiBnZW8ucHJvcGVydGllcy5uYW1lXG5cdFx0XHRcdH0gXVxuXHRcdFx0fTtcblx0XHRcdG9iai5wb2ludFsgcHJvcGVydHlOYW1lIF0gPSBkYXRhLnZhbHVlO1xuXHRcdFx0cmV0dXJuIFsgXCI8ZGl2IGNsYXNzPSdob3ZlcmluZm8gbnZ0b29sdGlwJz5cIiArIEFwcC5VdGlscy5jb250ZW50R2VuZXJhdG9yKCBvYmosIHRydWUgKSArIFwiPC9kaXY+XCIgXTtcblx0XHR9LFxuXG5cdFx0dXBkYXRlOiBmdW5jdGlvbigpIHtcblx0XHRcdFxuXHRcdFx0Ly9jb25zdHJ1Y3QgZGltZW5zaW9uIHN0cmluZ1xuXHRcdFx0dmFyIHRoYXQgPSB0aGlzLFxuXHRcdFx0XHRtYXBDb25maWcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwibWFwLWNvbmZpZ1wiICksXG5cdFx0XHRcdGNoYXJ0VGltZSA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10aW1lXCIgKSxcblx0XHRcdFx0dmFyaWFibGVJZCA9IG1hcENvbmZpZy52YXJpYWJsZUlkLFxuXHRcdFx0XHR0YXJnZXRZZWFyID0gbWFwQ29uZmlnLnRhcmdldFllYXIsXG5cdFx0XHRcdG1vZGUgPSBtYXBDb25maWcubW9kZSxcblx0XHRcdFx0dG9sZXJhbmNlID0gbWFwQ29uZmlnLnRpbWVUb2xlcmFuY2UsXG5cdFx0XHRcdGRpbWVuc2lvbnMgPSBbeyBuYW1lOiBcIk1hcFwiLCBwcm9wZXJ0eTogXCJtYXBcIiwgdmFyaWFibGVJZDogdmFyaWFibGVJZCwgdGFyZ2V0WWVhcjogdGFyZ2V0WWVhciwgbW9kZTogbW9kZSwgdG9sZXJhbmNlOiB0b2xlcmFuY2UgfV0sXG5cdFx0XHRcdGRpbWVuc2lvbnNTdHJpbmcgPSBKU09OLnN0cmluZ2lmeSggZGltZW5zaW9ucyApLFxuXHRcdFx0XHRjaGFydFR5cGUgPSA5OTk5LFxuXHRcdFx0XHRzZWxlY3RlZENvdW50cmllcyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiApLFxuXHRcdFx0XHRzZWxlY3RlZENvdW50cmllc0lkcyA9IF8ubWFwKCBzZWxlY3RlZENvdW50cmllcywgZnVuY3Rpb24oIHYgKSB7IHJldHVybiAodik/ICt2LmlkOiBcIlwiOyB9ICk7XG5cdFx0XHRcblx0XHRcdHZhciBkYXRhUHJvcHMgPSB7IFwiZGltZW5zaW9uc1wiOiBkaW1lbnNpb25zU3RyaW5nLCBcImNoYXJ0SWRcIjogQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImlkXCIgKSwgXCJjaGFydFR5cGVcIjogY2hhcnRUeXBlLCBcInNlbGVjdGVkQ291bnRyaWVzXCI6IHNlbGVjdGVkQ291bnRyaWVzSWRzLCBcImNoYXJ0VGltZVwiOiBjaGFydFRpbWUsIFwiY2FjaGVcIjogQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNhY2hlXCIgKSwgXCJncm91cEJ5VmFyaWFibGVzXCI6IEFwcC5DaGFydE1vZGVsLmdldCggXCJncm91cC1ieS12YXJpYWJsZXNcIiApICB9O1xuXHRcdFx0dGhpcy5tYXBEYXRhTW9kZWwuZmV0Y2goIHsgZGF0YTogZGF0YVByb3BzIH0gKTtcblxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdGRpc3BsYXlEYXRhOiBmdW5jdGlvbiggZGF0YSApIHtcblx0XHRcdFxuXHRcdFx0dmFyIHRoYXQgPSB0aGlzLFxuXHRcdFx0XHRtYXBDb25maWcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwibWFwLWNvbmZpZ1wiICksXG5cdFx0XHRcdGRhdGFNaW4gPSBJbmZpbml0eSxcblx0XHRcdFx0ZGF0YU1heCA9IC1JbmZpbml0eTtcblxuXHRcdFx0Ly9uZWVkIHRvIGV4dHJhY3QgbGF0ZXN0IHRpbWVcblx0XHRcdHZhciBsYXRlc3REYXRhID0gZGF0YS5tYXAoIGZ1bmN0aW9uKCBkLCBpICkge1xuXG5cdFx0XHRcdHZhciB2YWx1ZXMgPSBkLnZhbHVlcyxcblx0XHRcdFx0XHRsYXRlc3RUaW1lVmFsdWUgPSAoIHZhbHVlcyAmJiB2YWx1ZXMubGVuZ3RoICk/IHZhbHVlc1sgdmFsdWVzLmxlbmd0aCAtIDFdOiAwO1xuXG5cdFx0XHRcdC8vYWxzbyBnZXQgbWluIG1heCB2YWx1ZXMsIGNvdWxkIHVzZSBkMy5taW4sIGQzLm1heCBvbmNlIHdlIGhhdmUgYWxsIHZhbHVlcywgYnV0IHRoaXMgcHJvYmFibHkgc2F2ZXMgc29tZSB0aW1lXG5cdFx0XHRcdGRhdGFNaW4gPSBNYXRoLm1pbiggZGF0YU1pbiwgbGF0ZXN0VGltZVZhbHVlICk7XG5cdFx0XHRcdGRhdGFNYXggPSBNYXRoLm1heCggZGF0YU1heCwgbGF0ZXN0VGltZVZhbHVlICk7XG5cblx0XHRcdFx0Ly9pZHMgaW4gd29ybGQganNvbiBhcmUgbmFtZSBjb3VudHJpZXMgd2l0aCB1bmRlcnNjb3JlIChkYXRhbWFwcy5qcyB1c2VzIGlkIGZvciBzZWxlY3Rvciwgc28gY2Fubm90IGhhdmUgd2hpdGVzcGFjZSlcblx0XHRcdFx0cmV0dXJuIHsgXCJrZXlcIjogZC5rZXkucmVwbGFjZSggXCIgXCIsIFwiX1wiICksIFwidmFsdWVcIjogbGF0ZXN0VGltZVZhbHVlIH07XG5cblx0XHRcdH0gKTtcblxuXHRcdFx0dmFyIGNvbG9yU2NoZW1lID0gKCBjb2xvcmJyZXdlclsgbWFwQ29uZmlnLmNvbG9yU2NoZW1lTmFtZSBdICYmIGNvbG9yYnJld2VyWyBtYXBDb25maWcuY29sb3JTY2hlbWVOYW1lIF1bIG1hcENvbmZpZy5jb2xvclNjaGVtZUludGVydmFsIF0gKT8gY29sb3JicmV3ZXJbIG1hcENvbmZpZy5jb2xvclNjaGVtZU5hbWUgXVsgbWFwQ29uZmlnLmNvbG9yU2NoZW1lSW50ZXJ2YWwgXTogW107XG5cdFx0XHRcblx0XHRcdC8vbmVlZCB0byBjcmVhdGUgY29sb3Igc2NoZW1lXG5cdFx0XHR2YXIgY29sb3JTY2FsZSA9IGQzLnNjYWxlLnF1YW50aXplKClcblx0XHRcdFx0LmRvbWFpbiggWyBkYXRhTWluLCBkYXRhTWF4IF0gKVxuXHRcdFx0XHQucmFuZ2UoIGNvbG9yU2NoZW1lICk7XG5cblx0XHRcdC8vbmVlZCB0byBlbmNvZGUgY29sb3JzIHByb3BlcnRpZXNcblx0XHRcdHZhciBtYXBEYXRhID0ge30sXG5cdFx0XHRcdGNvbG9ycyA9IFtdO1xuXHRcdFx0bGF0ZXN0RGF0YS5mb3JFYWNoKCBmdW5jdGlvbiggZCwgaSApIHtcblx0XHRcdFx0dmFyIGNvbG9yID0gY29sb3JTY2FsZSggZC52YWx1ZSApO1xuXHRcdFx0XHRtYXBEYXRhWyBkLmtleSBdID0geyBcImtleVwiOiBkLmtleSwgXCJ2YWx1ZVwiOiBkLnZhbHVlLCBcImNvbG9yXCI6IGNvbG9yIH07XG5cdFx0XHRcdGNvbG9ycy5wdXNoKCBjb2xvciApO1xuXHRcdFx0fSApO1xuXG5cdFx0XHR0aGlzLmxlZ2VuZC5zY2FsZSggY29sb3JTY2FsZSApO1xuXHRcdFx0aWYoIGQzLnNlbGVjdCggXCIubGVnZW5kLXdyYXBwZXJcIiApLmVtcHR5KCkgKSB7XG5cdFx0XHRcdGQzLnNlbGVjdCggXCIuZGF0YW1hcFwiICkuYXBwZW5kKCBcImdcIiApLmF0dHIoIFwiY2xhc3NcIiwgXCJsZWdlbmQtd3JhcHBlclwiICk7XG5cdFx0XHR9XG5cdFx0XHRkMy5zZWxlY3QoIFwiLmxlZ2VuZC13cmFwcGVyXCIgKS5kYXR1bSggY29sb3JTY2hlbWUgKS5jYWxsKCB0aGlzLmxlZ2VuZCApO1xuXHRcdFx0Ly9kMy5zZWxlY3QoIFwiLmRhdGFtYXBcIiApLmRhdHVtKCBjb2xvclNjaGVtZSApLmNhbGwoIHRoaXMubGVnZW5kICk7XG5cblx0XHRcdC8vdXBkYXRlIG1hcFxuXHRcdFx0Ly9hcmUgd2UgY2hhbmdpbmcgcHJvamVjdGlvbnM/XG5cdFx0XHR2YXIgb2xkUHJvamVjdGlvbiA9IHRoaXMuZGF0YU1hcC5vcHRpb25zLnNldFByb2plY3Rpb24sXG5cdFx0XHRcdG5ld1Byb2plY3Rpb24gPSB0aGlzLmdldFByb2plY3Rpb24oIG1hcENvbmZpZy5wcm9qZWN0aW9uICk7XG5cdFx0XHRpZiggb2xkUHJvamVjdGlvbiA9PT0gbmV3UHJvamVjdGlvbiApIHtcblx0XHRcdFx0Ly9wcm9qZWN0aW9uIHN0YXlzIHRoZSBzYW1lLCBubyBuZWVkIHRvIHJlZHJhdyB1bml0c1xuXHRcdFx0XHQvL25lZWQgdG8gc2V0IGFsbCB1bml0cyB0byBkZWZhdWx0IGNvbG9yIGZpcnN0LCBjYXVzZSB1cGRhdGVDaG9wbGV0aCBqdXN0IHVwZGF0ZXMgbmV3IGRhdGEgbGVhdmVzIHRoZSBvbGQgZGF0YSBmb3IgdW5pdHMgbm8gbG9uZ2VyIGluIGRhdGFzZXRcblx0XHRcdFx0ZDMuc2VsZWN0QWxsKCBcInBhdGguZGF0YW1hcHMtc3VidW5pdFwiICkuc3R5bGUoIFwiZmlsbFwiLCB0aGlzLmRhdGFNYXAub3B0aW9ucy5maWxscy5kZWZhdWx0RmlsbCApO1xuXHRcdFx0XHR0aGlzLmRhdGFNYXAudXBkYXRlQ2hvcm9wbGV0aCggbWFwRGF0YSApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly9jaGFuZ2luZyBwcm9qZWN0aW9uLCBuZWVkIHRvIHJlbW92ZSBleGlzdGluZyB1bml0cywgcmVkcmF3IGV2ZXJ5dGhpbmcgYW5kIGFmdGVyIGRvbmUgZHJhd2luZywgdXBkYXRlIGRhdGFcblx0XHRcdFx0ZDMuc2VsZWN0QWxsKCdwYXRoLmRhdGFtYXBzLXN1YnVuaXQnKS5yZW1vdmUoKTtcblx0XHRcdFx0dGhpcy5kYXRhTWFwLm9wdGlvbnMuc2V0UHJvamVjdGlvbiA9IG5ld1Byb2plY3Rpb247XG5cdFx0XHRcdHRoaXMuZGF0YU1hcC5kcmF3KCk7XG5cdFx0XHRcdHRoaXMuZGF0YU1hcC5vcHRpb25zLmRvbmUgPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHR0aGF0LmRhdGFNYXAudXBkYXRlQ2hvcm9wbGV0aCggbWFwRGF0YSApO1xuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0fSxcblxuXHRcdGdldFByb2plY3Rpb246IGZ1bmN0aW9uKCBwcm9qZWN0aW9uTmFtZSApIHtcblxuXHRcdFx0dmFyIHByb2plY3Rpb25zID0gQXBwLlZpZXdzLkNoYXJ0Lk1hcFRhYi5wcm9qZWN0aW9ucyxcblx0XHRcdFx0bmV3UHJvamVjdGlvbiA9ICggcHJvamVjdGlvbnNbIHByb2plY3Rpb25OYW1lIF0gKT8gcHJvamVjdGlvbnNbIHByb2plY3Rpb25OYW1lIF06IHByb2plY3Rpb25zLldvcmxkO1xuXHRcdFx0cmV0dXJuIG5ld1Byb2plY3Rpb247XG5cdFx0XHRcblx0XHR9LFxuXG5cdFx0b25SZXNpemU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYoIHRoaXMuZGF0YU1hcCApIHtcblx0XHRcdFx0Ly9pbnN0ZWFkIG9mIGNhbGxpbmcgZGF0YW1hcHMgcmVzaXplLCB0aGVyZSdzIG1vZGlmaWVkIHZlcnNpb24gb2YgdGhlIHNhbWUgbWV0aG9kXG5cdFx0XHRcdHZhciBvcHRpb25zID0gdGhpcy5kYXRhTWFwLm9wdGlvbnMsXG5cdFx0XHRcdFx0cHJlZml4ID0gJy13ZWJraXQtdHJhbnNmb3JtJyBpbiBkb2N1bWVudC5ib2R5LnN0eWxlID8gJy13ZWJraXQtJyA6ICctbW96LXRyYW5zZm9ybScgaW4gZG9jdW1lbnQuYm9keS5zdHlsZSA/ICctbW96LScgOiAnLW1zLXRyYW5zZm9ybScgaW4gZG9jdW1lbnQuYm9keS5zdHlsZSA/ICctbXMtJyA6ICcnLFxuXHRcdFx0XHRcdG5ld3NpemUgPSBvcHRpb25zLmVsZW1lbnQuY2xpZW50V2lkdGgsXG5cdFx0XHRcdFx0b2xkc2l6ZSA9IGQzLnNlbGVjdCggb3B0aW9ucy5lbGVtZW50KS5zZWxlY3QoJ3N2ZycpLmF0dHIoJ2RhdGEtd2lkdGgnKTtcblx0XHRcdFx0XHQvL2RpZmZlcmVudCBzZWxlY3RvciBmcm9tIGRlZmF1bHQgZGF0YW1hcHMgaW1wbGVtZW50YXRpb24sIGRvZXNuJ3Qgc2NhbGUgbGVnZW5kXG5cdFx0XHRcdFx0ZDMuc2VsZWN0KG9wdGlvbnMuZWxlbWVudCkuc2VsZWN0KCdzdmcnKS5zZWxlY3RBbGwoJ2c6bm90KC5sZWdlbmQtc3RlcCk6bm90KC5sZWdlbmQpJykuc3R5bGUocHJlZml4ICsgJ3RyYW5zZm9ybScsICdzY2FsZSgnICsgKG5ld3NpemUgLyBvbGRzaXplKSArICcpJyk7XG5cdFx0XHRcdC8vdGhpcy5kYXRhTWFwLnJlc2l6ZSgpO1xuXHRcdFx0fVxuXHRcdH0sXG5cblx0XHRvbkNoYXJ0TW9kZWxSZXNpemU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5vblJlc2l6ZSgpO1xuXHRcdH1cblxuXHR9KTtcblxuXHRBcHAuVmlld3MuQ2hhcnQuTWFwVGFiLnByb2plY3Rpb25zID0ge1xuXHRcdFxuXHRcdFwiV29ybGRcIjogZnVuY3Rpb24oZWxlbWVudCkge1xuXHRcdFx0Ly9lbXBpcmljXG5cdFx0XHR2YXIgayA9IDY7XG5cdFx0XHR2YXIgcHJvamVjdGlvbiA9IGQzLmdlby5lY2tlcnQzKClcblx0XHRcdFx0LnNjYWxlKGVsZW1lbnQub2Zmc2V0V2lkdGgvaylcblx0XHRcdFx0LnRyYW5zbGF0ZShbZWxlbWVudC5vZmZzZXRXaWR0aCAvIDIsIGVsZW1lbnQub2Zmc2V0SGVpZ2h0IC8gMl0pXG5cdFx0XHRcdC5wcmVjaXNpb24oLjEpO1xuXHRcdFx0dmFyIHBhdGggPSBkMy5nZW8ucGF0aCgpLnByb2plY3Rpb24ocHJvamVjdGlvbik7XG5cdFx0XHRyZXR1cm4ge3BhdGg6IHBhdGgsIHByb2plY3Rpb246IHByb2plY3Rpb259O1xuXHRcdH0sXG5cdFx0LypcIldvcmxkXCI6IGZ1bmN0aW9uKGVsZW1lbnQpIHtcblx0XHRcdHZhciBwcm9qZWN0aW9uID0gZDMuZ2VvLmVxdWlyZWN0YW5ndWxhcigpXG5cdFx0XHRcdC5zY2FsZSgoZWxlbWVudC5vZmZzZXRXaWR0aCArIDEpIC8gMiAvIE1hdGguUEkpXG5cdFx0XHRcdC50cmFuc2xhdGUoW2VsZW1lbnQub2Zmc2V0V2lkdGggLyAyLCBlbGVtZW50Lm9mZnNldEhlaWdodCAvIDEuOF0pO1xuXHRcdFx0dmFyIHBhdGggPSBkMy5nZW8ucGF0aCgpLnByb2plY3Rpb24ocHJvamVjdGlvbik7XG5cdFx0XHRyZXR1cm4ge3BhdGg6IHBhdGgsIHByb2plY3Rpb246IHByb2plY3Rpb259O1xuXHRcdH0sKi9cblx0XHRcIkFmcmljYVwiOiBmdW5jdGlvbihlbGVtZW50KSB7XG5cdFx0XHQvL2VtcGlyaWNcblx0XHRcdHZhciBrID0gMztcblx0XHRcdHZhciBwcm9qZWN0aW9uID0gZDMuZ2VvLmNvbmljQ29uZm9ybWFsKClcblx0XHRcdFx0LnJvdGF0ZShbLTI1LCAwXSlcblx0XHRcdFx0LmNlbnRlcihbMCwgMF0pXG5cdFx0XHRcdC5wYXJhbGxlbHMoWzMwLCAtMjBdKVxuXHRcdFx0XHQuc2NhbGUoZWxlbWVudC5vZmZzZXRXaWR0aC9rKVxuXHRcdFx0XHQudHJhbnNsYXRlKFtlbGVtZW50Lm9mZnNldFdpZHRoIC8gMiwgZWxlbWVudC5vZmZzZXRIZWlnaHQgLyAyXSk7XG5cdFx0XHR2YXIgcGF0aCA9IGQzLmdlby5wYXRoKCkucHJvamVjdGlvbihwcm9qZWN0aW9uKTtcblx0XHRcdHJldHVybiB7cGF0aDogcGF0aCwgcHJvamVjdGlvbjogcHJvamVjdGlvbn07XG5cdFx0fSxcblx0XHRcIk4uQW1lcmljYVwiOiBmdW5jdGlvbihlbGVtZW50KSB7XG5cdFx0XHQvL2VtcGlyaWNcblx0XHRcdHZhciBrID0gMztcblx0XHRcdHZhciBwcm9qZWN0aW9uID0gZDMuZ2VvLmNvbmljQ29uZm9ybWFsKClcblx0XHRcdFx0LnJvdGF0ZShbOTgsIDBdKVxuXHRcdFx0XHQuY2VudGVyKFswLCAzOF0pXG5cdFx0XHRcdC5wYXJhbGxlbHMoWzI5LjUsIDQ1LjVdKVxuXHRcdFx0XHQuc2NhbGUoZWxlbWVudC5vZmZzZXRXaWR0aC9rKVxuXHRcdFx0XHQudHJhbnNsYXRlKFtlbGVtZW50Lm9mZnNldFdpZHRoIC8gMiwgZWxlbWVudC5vZmZzZXRIZWlnaHQgLyAyXSk7XG5cdFx0XHR2YXIgcGF0aCA9IGQzLmdlby5wYXRoKCkucHJvamVjdGlvbihwcm9qZWN0aW9uKTtcblx0XHRcdHJldHVybiB7cGF0aDogcGF0aCwgcHJvamVjdGlvbjogcHJvamVjdGlvbn07XG5cdFx0fSxcblx0XHRcIlMuQW1lcmljYVwiOiBmdW5jdGlvbihlbGVtZW50KSB7XG5cdFx0XHQvL2VtcGlyaWNcblx0XHRcdHZhciBrID0gMy40O1xuXHRcdFx0dmFyIHByb2plY3Rpb24gPSBkMy5nZW8uY29uaWNDb25mb3JtYWwoKVxuXHRcdFx0XHQucm90YXRlKFs2OCwgMF0pXG5cdFx0XHRcdC5jZW50ZXIoWzAsIC0xNF0pXG5cdFx0XHRcdC5wYXJhbGxlbHMoWzEwLCAtMzBdKVxuXHRcdFx0XHQuc2NhbGUoZWxlbWVudC5vZmZzZXRXaWR0aC9rKVxuXHRcdFx0XHQudHJhbnNsYXRlKFtlbGVtZW50Lm9mZnNldFdpZHRoIC8gMiwgZWxlbWVudC5vZmZzZXRIZWlnaHQgLyAyXSk7XG5cdFx0XHR2YXIgcGF0aCA9IGQzLmdlby5wYXRoKCkucHJvamVjdGlvbihwcm9qZWN0aW9uKTtcblx0XHRcdHJldHVybiB7cGF0aDogcGF0aCwgcHJvamVjdGlvbjogcHJvamVjdGlvbn07XG5cdFx0fSxcblx0XHRcIkFzaWFcIjogZnVuY3Rpb24oZWxlbWVudCkge1xuXHRcdFx0Ly9lbXBpcmljXG5cdFx0XHR2YXIgayA9IDM7XG5cdFx0XHR2YXIgcHJvamVjdGlvbiA9IGQzLmdlby5jb25pY0NvbmZvcm1hbCgpXG5cdFx0XHRcdC5yb3RhdGUoWy0xMDUsIDBdKVxuXHRcdFx0XHQuY2VudGVyKFswLCAzN10pXG5cdFx0XHRcdC5wYXJhbGxlbHMoWzEwLCA2MF0pXG5cdFx0XHRcdC5zY2FsZShlbGVtZW50Lm9mZnNldFdpZHRoL2spXG5cdFx0XHRcdC50cmFuc2xhdGUoW2VsZW1lbnQub2Zmc2V0V2lkdGggLyAyLCBlbGVtZW50Lm9mZnNldEhlaWdodCAvIDJdKTtcblx0XHRcdHZhciBwYXRoID0gZDMuZ2VvLnBhdGgoKS5wcm9qZWN0aW9uKHByb2plY3Rpb24pO1xuXHRcdFx0cmV0dXJuIHtwYXRoOiBwYXRoLCBwcm9qZWN0aW9uOiBwcm9qZWN0aW9ufTtcblx0XHR9LFxuXHRcdFwiRXVyb3BlXCI6IGZ1bmN0aW9uKGVsZW1lbnQpIHtcblx0XHRcdC8vZW1waXJpY1xuXHRcdFx0dmFyIGsgPSAxLjU7XG5cdFx0XHR2YXIgcHJvamVjdGlvbiA9IGQzLmdlby5jb25pY0NvbmZvcm1hbCgpXG5cdFx0XHRcdC5yb3RhdGUoWy0xNSwgMF0pXG5cdFx0XHRcdC5jZW50ZXIoWzAsIDU1XSlcblx0XHRcdFx0LnBhcmFsbGVscyhbNjAsIDQwXSlcblx0XHRcdFx0LnNjYWxlKGVsZW1lbnQub2Zmc2V0V2lkdGgvaylcblx0XHRcdFx0LnRyYW5zbGF0ZShbZWxlbWVudC5vZmZzZXRXaWR0aCAvIDIsIGVsZW1lbnQub2Zmc2V0SGVpZ2h0IC8gMl0pO1xuXHRcdFx0dmFyIHBhdGggPSBkMy5nZW8ucGF0aCgpLnByb2plY3Rpb24ocHJvamVjdGlvbik7XG5cdFx0XHRyZXR1cm4ge3BhdGg6IHBhdGgsIHByb2plY3Rpb246IHByb2plY3Rpb259O1xuXHRcdH0sXG5cdFx0XCJBdXN0cmFsaWFcIjogZnVuY3Rpb24oZWxlbWVudCkge1xuXHRcdFx0Ly9lbXBpcmljXG5cdFx0XHR2YXIgayA9IDM7XG5cdFx0XHR2YXIgcHJvamVjdGlvbiA9IGQzLmdlby5jb25pY0NvbmZvcm1hbCgpXG5cdFx0XHRcdC5yb3RhdGUoWy0xMzUsIDBdKVxuXHRcdFx0XHQuY2VudGVyKFswLCAtMjBdKVxuXHRcdFx0XHQucGFyYWxsZWxzKFstMTAsIC0zMF0pXG5cdFx0XHRcdC5zY2FsZShlbGVtZW50Lm9mZnNldFdpZHRoL2spXG5cdFx0XHRcdC50cmFuc2xhdGUoW2VsZW1lbnQub2Zmc2V0V2lkdGggLyAyLCBlbGVtZW50Lm9mZnNldEhlaWdodCAvIDJdKTtcblx0XHRcdHZhciBwYXRoID0gZDMuZ2VvLnBhdGgoKS5wcm9qZWN0aW9uKHByb2plY3Rpb24pO1xuXHRcdFx0cmV0dXJuIHtwYXRoOiBwYXRoLCBwcm9qZWN0aW9uOiBwcm9qZWN0aW9ufTtcblx0XHR9XG5cblx0fTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5DaGFydC5NYXBUYWI7XG5cbn0pKCk7XG5cbihmdW5jdGlvbigpIHtcblx0dmFyIM61ID0gMWUtNiwgzrUyID0gzrUgKiDOtSwgz4AgPSBNYXRoLlBJLCBoYWxmz4AgPSDPgCAvIDIsIHNxcnTPgCA9IE1hdGguc3FydCjPgCksIHJhZGlhbnMgPSDPgCAvIDE4MCwgZGVncmVlcyA9IDE4MCAvIM+AO1xuXHRmdW5jdGlvbiBzaW5jaSh4KSB7XG5cdFx0cmV0dXJuIHggPyB4IC8gTWF0aC5zaW4oeCkgOiAxO1xuXHR9XG5cdGZ1bmN0aW9uIHNnbih4KSB7XG5cdFx0cmV0dXJuIHggPiAwID8gMSA6IHggPCAwID8gLTEgOiAwO1xuXHR9XG5cdGZ1bmN0aW9uIGFzaW4oeCkge1xuXHRcdHJldHVybiB4ID4gMSA/IGhhbGbPgCA6IHggPCAtMSA/IC1oYWxmz4AgOiBNYXRoLmFzaW4oeCk7XG5cdH1cblx0ZnVuY3Rpb24gYWNvcyh4KSB7XG5cdFx0cmV0dXJuIHggPiAxID8gMCA6IHggPCAtMSA/IM+AIDogTWF0aC5hY29zKHgpO1xuXHR9XG5cdGZ1bmN0aW9uIGFzcXJ0KHgpIHtcblx0XHRyZXR1cm4geCA+IDAgPyBNYXRoLnNxcnQoeCkgOiAwO1xuXHR9XG5cdHZhciBwcm9qZWN0aW9uID0gZDMuZ2VvLnByb2plY3Rpb247XG4gXG5cdGZ1bmN0aW9uIGVja2VydDMozrssIM+GKSB7XG5cdFx0dmFyIGsgPSBNYXRoLnNxcnQoz4AgKiAoNCArIM+AKSk7XG5cdFx0cmV0dXJuIFsgMiAvIGsgKiDOuyAqICgxICsgTWF0aC5zcXJ0KDEgLSA0ICogz4YgKiDPhiAvICjPgCAqIM+AKSkpLCA0IC8gayAqIM+GIF07XG5cdH1cblx0ZWNrZXJ0My5pbnZlcnQgPSBmdW5jdGlvbih4LCB5KSB7XG5cdFx0dmFyIGsgPSBNYXRoLnNxcnQoz4AgKiAoNCArIM+AKSkgLyAyO1xuXHRcdHJldHVybiBbIHggKiBrIC8gKDEgKyBhc3FydCgxIC0geSAqIHkgKiAoNCArIM+AKSAvICg0ICogz4ApKSksIHkgKiBrIC8gMiBdO1xuXHR9O1xuXHQoZDMuZ2VvLmVja2VydDMgPSBmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4gcHJvamVjdGlvbihlY2tlcnQzKTtcblx0fSkucmF3ID0gZWNrZXJ0Mztcblx0XG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0QXBwLlZpZXdzLkNoYXJ0LlNjYWxlU2VsZWN0b3JzID0gQmFja2JvbmUuVmlldy5leHRlbmQoe1xuXG5cdFx0ZWw6IFwiI2NoYXJ0LXZpZXcgLmF4aXMtc2NhbGUtc2VsZWN0b3JzLXdyYXBwZXJcIixcblx0XHRldmVudHM6IHtcblx0XHRcdFwiY2xpY2sgLmF4aXMtc2NhbGUtYnRuXCI6IFwib25BeGlzU2NhbGVCdG5cIixcblx0XHRcdFwiY2hhbmdlIC5heGlzLXNjYWxlIGxpXCI6IFwib25BeGlzU2NhbGVDaGFuZ2VcIlxuXHRcdH0sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdFxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gb3B0aW9ucy5kaXNwYXRjaGVyO1xuXHRcdFx0XG5cdFx0XHR0aGlzLiR0YWJzID0gdGhpcy4kZWwuZmluZCggXCIuaGVhZGVyLXRhYlwiICk7XG5cdFx0XHRcblx0XHRcdHRoaXMuJHhBeGlzU2NhbGUgPSB0aGlzLiRlbC5maW5kKCBcIltkYXRhLW5hbWU9J3gtYXhpcy1zY2FsZSddXCIgKTtcblx0XHRcdHRoaXMuJHlBeGlzU2NhbGUgPSB0aGlzLiRlbC5maW5kKCBcIltkYXRhLW5hbWU9J3ktYXhpcy1zY2FsZSddXCIgKTtcblxuXHRcdFx0dGhpcy5pbml0RHJvcERvd24oIHRoaXMuJHhBeGlzU2NhbGUgKTtcblx0XHRcdHRoaXMuaW5pdERyb3BEb3duKCB0aGlzLiR5QXhpc1NjYWxlICk7XG5cblx0XHRcdHRoaXMucmVuZGVyKCk7XG5cblx0XHRcdC8vc2V0dXAgZXZlbnRzXG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5vbiggXCJjaGFuZ2VcIiwgdGhpcy5yZW5kZXIsIHRoaXMgKTtcblxuXHRcdH0sXG5cblx0XHQvKmluaXRFdmVudHM6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy4kY2hhcnRWaWV3ID0gJCggXCIjY2hhcnQtdmlld1wiICk7XG5cdFx0XHR0aGlzLiR3cmFwID0gdGhpcy4kY2hhcnRWaWV3LmZpbmQoIFwic3ZnID4gLm52LXdyYXBcIiApO1xuXHRcdFx0XG5cdFx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0XHR0aGlzLiR3cmFwLm9uKCBcIm1vdXNlb3ZlclwiLCBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0XHR0aGF0LiRjaGFydFZpZXcuYWRkQ2xhc3MoIFwiY2hhcnQtaG92ZXJlZFwiICk7XG5cdFx0XHR9ICk7XG5cdFx0XHR0aGlzLiR3cmFwLm9uKCBcIm1vdXNlb3V0XCIsIGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKCBldnQuY3VycmVudFRhcmdldCApO1xuXHRcdFx0XHR0aGF0LiRjaGFydFZpZXcucmVtb3ZlQ2xhc3MoIFwiY2hhcnQtaG92ZXJlZFwiICk7XG5cdFx0XHR9ICk7XG5cdFx0fSwqL1xuXG5cdFx0aW5pdERyb3BEb3duOiBmdW5jdGlvbiggJGVsICkge1xuXG5cdFx0XHR2YXIgJGxpc3QgPSAkZWwuZmluZCggXCJ1bFwiICksXG5cdFx0XHRcdCRpdGVtcyA9ICRsaXN0LmZpbmQoIFwibGlcIiApO1xuXG5cdFx0XHQkaXRlbXMub24oIFwiY2xpY2tcIiwgZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdFx0dmFyICR0aGlzID0gJCggdGhpcyApLFxuXHRcdFx0XHRcdHZhbHVlID0gJHRoaXMuYXR0ciggXCJkYXRhLXZhbHVlXCIgKTtcblx0XHRcdFx0JGl0ZW1zLnJlbW92ZUNsYXNzKCBcInNlbGVjdGVkXCIgKTtcblx0XHRcdFx0JHRoaXMuYWRkQ2xhc3MoIFwic2VsZWN0ZWRcIiApO1xuXHRcdFx0XHQkdGhpcy50cmlnZ2VyKCBcImNoYW5nZVwiICk7XG5cdFx0XHR9ICk7XG5cblx0XHR9LFxuXG5cdFx0b25BeGlzU2NhbGVDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdHZhciAkbGkgPSAkKCBldnQuY3VycmVudFRhcmdldCApLFxuXHRcdFx0XHQkcGFyZW50ID0gJGxpLnBhcmVudCgpLnBhcmVudCgpLnBhcmVudCgpLFxuXHRcdFx0XHQkZGl2ID0gJHBhcmVudC5maW5kKCBcImRpdlwiICksXG5cdFx0XHRcdCRidG4gPSAkcGFyZW50LmZpbmQoIFwiLmF4aXMtc2NhbGUtYnRuXCIgKSxcblx0XHRcdFx0JHNlbGVjdCA9ICRwYXJlbnQuZmluZCggXCIuYXhpcy1zY2FsZVwiICksXG5cdFx0XHRcdG5hbWUgPSAkZGl2LmF0dHIoIFwiZGF0YS1uYW1lXCIgKSxcblx0XHRcdFx0YXhpc05hbWUgPSAoIG5hbWUgPT09IFwieC1heGlzLXNjYWxlXCIgKT8gXCJ4LWF4aXNcIjogXCJ5LWF4aXNcIixcblx0XHRcdFx0YXhpc1Byb3AgPSBcImF4aXMtc2NhbGVcIixcblx0XHRcdFx0dmFsdWUgPSAkbGkuYXR0ciggXCJkYXRhLXZhbHVlXCIgKTtcblxuXHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0QXhpc0NvbmZpZyggYXhpc05hbWUsIGF4aXNQcm9wLCB2YWx1ZSApO1xuXHRcdFx0XG5cdFx0XHQkc2VsZWN0LmhpZGUoKTtcblx0XHRcdC8vJGJ0bi5zaG93KCk7XG5cblx0XHR9LFxuXG5cdFx0b25BeGlzU2NhbGVCdG46IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHRcblx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0dmFyICRidG4gPSAkKCBldnQuY3VycmVudFRhcmdldCApLFxuXHRcdFx0XHQkcGFyZW50ID0gJGJ0bi5wYXJlbnQoKSxcblx0XHRcdFx0JHNlbGVjdCA9ICRwYXJlbnQuZmluZCggXCIuYXhpcy1zY2FsZVwiICk7XG5cblx0XHRcdCRzZWxlY3Quc2hvdygpO1xuXHRcdFx0Ly8kYnRuLmhpZGUoKTtcblxuXHRcdH1cblxuXHR9KTtcblx0XG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkNoYXJ0LlNjYWxlU2VsZWN0b3JzO1xuXHRcbn0pKCk7XG4iLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdEFwcC5WaWV3cy5DaGFydC5Tb3VyY2VzVGFiID0gQmFja2JvbmUuVmlldy5leHRlbmQoIHtcblxuXHRcdGVsOiBcIiNjaGFydC12aWV3XCIsXG5cdFx0ZXZlbnRzOiB7fSxcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0XG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIgPSBvcHRpb25zLmRpc3BhdGNoZXI7XG5cblx0XHRcdHRoaXMuJGNoYXJ0RGVzY3JpcHRpb24gPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1kZXNjcmlwdGlvblwiICk7XG5cdFx0XHR0aGlzLiRjaGFydFNvdXJjZXMgPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1zb3VyY2VzXCIgKTtcblx0XHRcdHRoaXMuJHNvdXJjZXNUYWIgPSB0aGlzLiRlbC5maW5kKCBcIiNzb3VyY2VzLWNoYXJ0LXRhYlwiICk7XG5cblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbiggcmVzcG9uc2UgKSB7XG5cblx0XHRcdGlmKCAhcmVzcG9uc2UgfHwgIXJlc3BvbnNlLmRhdGFzb3VyY2VzICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdHZhciBzb3VyY2VzID0gcmVzcG9uc2UuZGF0YXNvdXJjZXMsXG5cdFx0XHRcdGxpY2Vuc2UgPSByZXNwb25zZS5saWNlbnNlLFxuXHRcdFx0XHRmb290ZXJIdG1sID0gXCJcIixcblx0XHRcdFx0dGFiSHRtbCA9IFwiXCIsXG5cdFx0XHRcdGRlc2NyaXB0aW9uSHRtbCA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC1kZXNjcmlwdGlvblwiICksXG5cdFx0XHRcdHNvdXJjZXNTaG9ydEh0bWwgPSBcIkRhdGEgb2J0YWluZWQgZnJvbTogXCIsXG5cdFx0XHRcdHNvdXJjZXNMb25nSHRtbCA9IFwiXCIsXG5cdFx0XHRcdC8vY2hlY2sgdGhhdCB3ZSdyZSBub3QgYWRkaW5nIHNvdXJjZXMgd2l0aCB0aGUgc2FtZSBuYW1lIG1vcmUgdGltZXNcblx0XHRcdFx0c291cmNlc0J5TmFtZSA9IFtdO1xuXHRcdFx0XHRcblx0XHRcdC8vY29uc3RydWN0IHNvdXJjZSBodG1sXG5cdFx0XHRfLmVhY2goIHNvdXJjZXMsIGZ1bmN0aW9uKCBzb3VyY2VEYXRhLCBzb3VyY2VJbmRleCApIHtcblx0XHRcdFx0Ly9tYWtlIHN1cmUgd2UgZG9uJ3QgaGF2ZSBzb3VyY2Ugd2l0aCB0aGUgc2FtZSBuYW1lIGluIHRoZSBzaG9ydCBkZXNjcmlwdGlvbiBhbHJlYWR5XG5cdFx0XHRcdGlmKCAhc291cmNlc0J5TmFtZVsgc291cmNlRGF0YS5uYW1lIF0gKSB7XG5cdFx0XHRcdFx0aWYoIHNvdXJjZUluZGV4ID4gMCApIHtcblx0XHRcdFx0XHRcdHNvdXJjZXNTaG9ydEh0bWwgKz0gXCIsIFwiO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiggc291cmNlRGF0YS5saW5rICkge1xuXHRcdFx0XHRcdFx0c291cmNlc1Nob3J0SHRtbCArPSBcIjxhIGhyZWY9J1wiICsgc291cmNlRGF0YS5saW5rICsgXCInIHRhcmdldD0nX2JsYW5rJz5cIiArIHNvdXJjZURhdGEubmFtZSArIFwiPC9hPlwiO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRzb3VyY2VzU2hvcnRIdG1sICs9IHNvdXJjZURhdGEubmFtZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0c291cmNlc0J5TmFtZVsgc291cmNlRGF0YS5uYW1lIF0gPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdFxuXHRcdFx0XHQvL3NvdXJjZXMgbm93IGNvbnRhaW4gaHRtbCwgc28gbm8gbmVlZCB0byBzZXBhcmF0ZSB3aXRoIGNvbW1hXG5cdFx0XHRcdC8qaWYoIHNvdXJjZUluZGV4ID4gMCAmJiBzb3VyY2VzTG9uZ0h0bWwgIT09IFwiXCIgJiYgc291cmNlRGF0YS5kZXNjcmlwdGlvbiAhPT0gXCJcIiApIHtcblx0XHRcdFx0XHRzb3VyY2VzTG9uZ0h0bWwgKz0gXCIsIFwiO1xuXHRcdFx0XHR9Ki9cblx0XHRcdFx0c291cmNlc0xvbmdIdG1sICs9IHNvdXJjZURhdGEuZGVzY3JpcHRpb247XG5cdFx0XHRcblx0XHRcdH0gKTtcblxuXHRcdFx0Zm9vdGVySHRtbCA9IGRlc2NyaXB0aW9uSHRtbDtcblx0XHRcdHRhYkh0bWwgPSBkZXNjcmlwdGlvbkh0bWwgKyBcIjxiciAvPjxiciAvPlwiICsgc291cmNlc0xvbmdIdG1sO1xuXHRcdFx0XG5cdFx0XHQvL2FkZCBsaWNlbnNlIGluZm9cblx0XHRcdGlmKCBsaWNlbnNlICYmIGxpY2Vuc2UuZGVzY3JpcHRpb24gKSB7XG5cdFx0XHRcdGZvb3Rlckh0bWwgPSBsaWNlbnNlLmRlc2NyaXB0aW9uICsgXCIgXCIgKyBmb290ZXJIdG1sO1xuXHRcdFx0XHR0YWJIdG1sID0gbGljZW5zZS5kZXNjcmlwdGlvbiArIFwiIFwiICsgdGFiSHRtbDtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0Ly9hcHBlbmQgdG8gRE9NXG5cdFx0XHR0aGlzLiRjaGFydERlc2NyaXB0aW9uLmh0bWwoIGZvb3Rlckh0bWwgKTtcblx0XHRcdHRoaXMuJGNoYXJ0U291cmNlcy5odG1sKCBzb3VyY2VzU2hvcnRIdG1sICk7XG5cdFx0XHR0aGlzLiRzb3VyY2VzVGFiLmh0bWwoIHRhYkh0bWwgKTtcblxuXHRcdH1cblxuXHR9ICk7XG5cdFxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5DaGFydC5Tb3VyY2VzVGFiO1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0QXBwLlZpZXdzLkNoYXJ0Lk1hcC5NYXBDb250cm9scyA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblxuXHRcdGVsOiBcIiNtYXAtY2hhcnQtdGFiIC5tYXAtY29udHJvbHMtaGVhZGVyXCIsXG5cdFx0ZXZlbnRzOiB7XG5cdFx0XHRcImlucHV0IC50YXJnZXQteWVhci1jb250cm9sIGlucHV0XCI6IFwib25UYXJnZXRZZWFySW5wdXRcIixcblx0XHRcdFwiY2hhbmdlIC50YXJnZXQteWVhci1jb250cm9sIGlucHV0XCI6IFwib25UYXJnZXRZZWFyQ2hhbmdlXCIsXG5cdFx0XHRcImNsaWNrIC5yZWdpb24tY29udHJvbCBsaVwiOiBcIm9uUmVnaW9uQ2xpY2tcIixcblx0XHRcdFwiY2xpY2sgLnNldHRpbmdzLWNvbnRyb2wgaW5wdXRcIjogXCJvblNldHRpbmdzSW5wdXRcIixcblx0XHR9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cblx0XHRcdHRoaXMuZGlzcGF0Y2hlciA9IG9wdGlvbnMuZGlzcGF0Y2hlcjtcblxuXHRcdFx0dmFyIG1hcENvbmZpZyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJtYXAtY29uZmlnXCIgKTtcblx0XHRcdFxuXHRcdFx0Ly95ZWFyIHNsaWRlclxuXHRcdFx0dGhpcy4kdGFyZ2V0WWVhckNvbnRyb2wgPSB0aGlzLiRlbC5maW5kKCBcIi50YXJnZXQteWVhci1jb250cm9sXCIgKTtcblx0XHRcdHRoaXMuJHRhcmdldFllYXJMYWJlbCA9IHRoaXMuJHRhcmdldFllYXJDb250cm9sLmZpbmQoIFwiLnRhcmdldC15ZWFyLWxhYmVsXCIgKTtcblx0XHRcdHRoaXMuJHRhcmdldFllYXJJbnB1dCA9IHRoaXMuJHRhcmdldFllYXJDb250cm9sLmZpbmQoIFwiaW5wdXRcIiApO1xuXHRcdFx0XG5cdFx0XHQvL3JlZ2lvbiBzZWxlY3RvclxuXHRcdFx0dGhpcy4kcmVnaW9uQ29udHJvbCA9IHRoaXMuJGVsLmZpbmQoIFwiLnJlZ2lvbi1jb250cm9sXCIgKTtcblx0XHRcdHRoaXMuJHJlZ2lvbkNvbnRyb2xMYWJlbCA9IHRoaXMuJHJlZ2lvbkNvbnRyb2wuZmluZCggXCIucmVnaW9uLWxhYmVsXCIgKTtcblx0XHRcdHRoaXMuJHJlZ2lvbkNvbnRyb2xMaXMgPSB0aGlzLiRyZWdpb25Db250cm9sLmZpbmQoIFwibGlcIiApO1xuXG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5vbiggXCJjaGFuZ2VcIiwgdGhpcy5vbkNoYXJ0TW9kZWxDaGFuZ2UsIHRoaXMgKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLm9uKCBcImNoYW5nZS1tYXBcIiwgdGhpcy5vbkNoYXJ0TW9kZWxDaGFuZ2UsIHRoaXMgKTtcblxuXHRcdFx0cmV0dXJuIHRoaXMucmVuZGVyKCk7XG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcblx0XHRcdHZhciBtYXBDb25maWcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwibWFwLWNvbmZpZ1wiICk7XG5cdFx0XHRcblx0XHRcdHRoaXMuJHRhcmdldFllYXJMYWJlbC50ZXh0KCBtYXBDb25maWcudGFyZ2V0WWVhciApO1xuXHRcdFx0dGhpcy4kcmVnaW9uQ29udHJvbExhYmVsLnRleHQoIG1hcENvbmZpZy5wcm9qZWN0aW9uICk7XG5cblx0XHRcdHRoaXMuJHRhcmdldFllYXJJbnB1dC5hdHRyKCBcIm1pblwiLCBtYXBDb25maWcubWluWWVhciApO1xuXHRcdFx0dGhpcy4kdGFyZ2V0WWVhcklucHV0LmF0dHIoIFwibWF4XCIsIG1hcENvbmZpZy5tYXhZZWFyICk7XG5cdFx0XHR0aGlzLiR0YXJnZXRZZWFySW5wdXQuYXR0ciggXCJzdGVwXCIsIG1hcENvbmZpZy50aW1lSW50ZXJ2YWwgKTtcblx0XHRcdHRoaXMuJHRhcmdldFllYXJJbnB1dC52YWwoIHBhcnNlSW50KCBtYXBDb25maWcudGFyZ2V0WWVhciwgMTAgKSApO1xuXG5cdFx0XHR0aGlzLiRyZWdpb25Db250cm9sTGlzLnJlbW92ZUNsYXNzKCBcImhpZ2hsaWdodFwiICk7XG5cdFx0XHR0aGlzLiRyZWdpb25Db250cm9sTGlzLmZpbHRlciggXCIuXCIgKyBtYXBDb25maWcucHJvamVjdGlvbiArIFwiLXByb2plY3Rpb25cIiApLmFkZENsYXNzKCBcImhpZ2hsaWdodFwiICk7XG5cblx0XHR9LFxuXG5cdFx0b25DaGFydE1vZGVsQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblx0XHR9LFxuXHRcdFxuXHRcdG9uVGFyZ2V0WWVhcklucHV0OiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0dmFyICR0aGlzID0gJCggZXZ0LnRhcmdldCApLFxuXHRcdFx0XHR0YXJnZXRZZWFyID0gcGFyc2VJbnQoICR0aGlzLnZhbCgpLCAxMCApO1xuXHRcdFx0dGhpcy4kdGFyZ2V0WWVhckxhYmVsLnRleHQoIHRhcmdldFllYXIsIGZhbHNlLCBcImNoYW5nZS1tYXBcIiApO1xuXHRcdH0sXG5cblx0XHRvblRhcmdldFllYXJDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHR2YXIgJHRoaXMgPSAkKCBldnQudGFyZ2V0ICksXG5cdFx0XHRcdHRhcmdldFllYXIgPSBwYXJzZUludCggJHRoaXMudmFsKCksIDEwICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC51cGRhdGVNYXBDb25maWcoIFwidGFyZ2V0WWVhclwiLCB0YXJnZXRZZWFyLCBmYWxzZSwgXCJjaGFuZ2UtbWFwXCIgKTtcblx0XHRcdHRoaXMucmVuZGVyKCk7XG5cdFx0fSxcblxuXHRcdG9uUmVnaW9uQ2xpY2s6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHR2YXIgJHRoaXMgPSAkKCBldnQudGFyZ2V0ICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC51cGRhdGVNYXBDb25maWcoIFwicHJvamVjdGlvblwiLCAkdGhpcy50ZXh0KCksIGZhbHNlLCBcImNoYW5nZS1tYXBcIiApO1xuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblx0XHR9LFxuXG5cdFx0b25TZXR0aW5nc0lucHV0OiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0dmFyICR0aGlzID0gJCggZXZ0LnRhcmdldCApLFxuXHRcdFx0XHRtb2RlID0gKCAkdGhpcy5pcyggXCI6Y2hlY2tlZFwiICkgKT8gXCJzcGVjaWZpY1wiOiBcIm5vLWludGVycG9sYXRpb25cIjtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnVwZGF0ZU1hcENvbmZpZyggXCJtb2RlXCIsIG1vZGUsIGZhbHNlLCBcImNoYW5nZS1tYXBcIiApO1xuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblx0XHR9XG5cblx0fSk7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVmlld3MuQ2hhcnQuTWFwLk1hcENvbnRyb2xzO1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciB0aGF0O1xuXG5cdEFwcC5WaWV3cy5VSS5WYXJpYWJsZVNlbGVjdHMgPSBmdW5jdGlvbigpIHtcblxuXHRcdHRoYXQgPSB0aGlzO1xuXHRcdHRoaXMuJGRpdiA9IG51bGw7XG5cblx0fTtcblxuXHRBcHAuVmlld3MuVUkuVmFyaWFibGVTZWxlY3RzLnByb3RvdHlwZSA9IHtcblxuXHRcdGluaXQ6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHR0aGlzLiRlbCA9ICQoIFwiLmZvcm0tdmFyaWFibGUtc2VsZWN0LXdyYXBwZXJcIiApO1xuXHRcdFx0dGhpcy4kY2F0ZWdvcnlXcmFwcGVyID0gdGhpcy4kZWwuZmluZCggXCIuY2F0ZWdvcnktd3JhcHBlclwiICk7XG5cdFx0XHR0aGlzLiRjYXRlZ29yeVNlbGVjdCA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9Y2F0ZWdvcnktaWRdXCIgKTtcblx0XHRcdHRoaXMuJHN1YmNhdGVnb3J5V3JhcHBlciA9IHRoaXMuJGVsLmZpbmQoIFwiLnN1YmNhdGVnb3J5LXdyYXBwZXJcIiApO1xuXHRcdFx0dGhpcy4kc3ViY2F0ZWdvcnlTZWxlY3QgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPXN1YmNhdGVnb3J5LWlkXVwiICk7XG5cdFx0XHR0aGlzLiR2YXJpYWJsZVdyYXBwZXIgPSB0aGlzLiRlbC5maW5kKCBcIi52YXJpYWJsZS13cmFwcGVyXCIgKTtcblx0XHRcdHRoaXMuJGNoYXJ0VmFyaWFibGUgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPWNoYXJ0LXZhcmlhYmxlXVwiICk7XG5cdFx0XHRcblx0XHRcdHRoaXMuJGNhdGVnb3J5U2VsZWN0Lm9uKCBcImNoYW5nZVwiLCAkLnByb3h5KCB0aGlzLm9uQ2F0ZWdvcnlDaGFuZ2UsIHRoaXMgKSApO1xuXHRcdFx0dGhpcy4kc3ViY2F0ZWdvcnlTZWxlY3Qub24oIFwiY2hhbmdlXCIsICQucHJveHkoIHRoaXMub25TdWJDYXRlZ29yeUNoYW5nZSwgdGhpcyApICk7XG5cblx0XHRcdHRoaXMuJHN1YmNhdGVnb3J5V3JhcHBlci5oaWRlKCk7XG5cdFx0XHR0aGlzLiR2YXJpYWJsZVdyYXBwZXIuaGlkZSgpO1xuXG5cdFx0fSxcblxuXHRcdG9uQ2F0ZWdvcnlDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHRcblx0XHRcdHZhciAkaW5wdXQgPSAkKCBldnQuY3VycmVudFRhcmdldCApO1xuXHRcdFx0aWYoICRpbnB1dC52YWwoKSAhPSBcIlwiICkge1xuXHRcdFx0XHR0aGlzLiRzdWJjYXRlZ29yeVdyYXBwZXIuc2hvdygpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy4kc3ViY2F0ZWdvcnlXcmFwcGVyLmhpZGUoKTtcblx0XHRcdFx0dGhpcy4kdmFyaWFibGVXcmFwcGVyLmhpZGUoKTtcblx0XHRcdH1cblxuXHRcdFx0Ly9maWx0ZXIgc3ViY2F0ZWdvcmllcyBzZWxlY3Rcblx0XHRcdHRoaXMuJHN1YmNhdGVnb3J5U2VsZWN0LmZpbmQoIFwib3B0aW9uXCIgKS5oaWRlKCk7XG5cdFx0XHR0aGlzLiRzdWJjYXRlZ29yeVNlbGVjdC5maW5kKCBcIm9wdGlvbltkYXRhLWNhdGVnb3J5LWlkPVwiICsgJGlucHV0LnZhbCgpICsgXCJdXCIgKS5zaG93KCk7XG5cblx0XHR9LFxuXG5cdFx0b25TdWJDYXRlZ29yeUNoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dmFyICRpbnB1dCA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICk7XG5cdFx0XHRpZiggJGlucHV0LnZhbCgpICE9IFwiXCIgKSB7XG5cdFx0XHRcdHRoaXMuJHZhcmlhYmxlV3JhcHBlci5zaG93KCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLiR2YXJpYWJsZVdyYXBwZXIuaGlkZSgpO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHQvL2ZpbHRlciBzdWJjYXRlZ29yaWVzIHNlbGVjdFxuXHRcdFx0dGhpcy4kY2hhcnRWYXJpYWJsZS5maW5kKCBcIm9wdGlvbjpub3QoOmRpc2FibGVkKVwiICkuaGlkZSgpO1xuXHRcdFx0dGhpcy4kY2hhcnRWYXJpYWJsZS5maW5kKCBcIm9wdGlvbltkYXRhLXN1YmNhdGVnb3J5LWlkPVwiICsgJGlucHV0LnZhbCgpICsgXCJdXCIgKS5zaG93KCk7XG5cblx0XHR9XG5cblx0fTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5VSS5WYXJpYWJsZVNlbGVjdHM7XG5cbn0pKCk7XG4iXX0=
