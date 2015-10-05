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

	var Form = require( "./views/App.Views.Form.js" ),
		ChartModel = require( "./models/App.Models.ChartModel.js" ),
		ChartDataModel = require( "./models/App.Models.ChartDataModel.js" );

	//setup models
	//is new chart or display old chart
	var $chartShowWrapper = $( ".chart-show-wrapper, .chart-edit-wrapper" ),
		chartId = $chartShowWrapper.attr( "data-chart-id" );

	//setup views
	App.View = new Form();

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
},{"./models/App.Models.ChartDataModel.js":7,"./models/App.Models.ChartModel.js":9,"./views/App.Views.Form.js":13}],3:[function(require,module,exports){
;( function() {
		
	"use strict";

	var EntityModel = require( "./../models/App.Models.EntityModel.js" );

	App.Collections.AvailableEntitiesCollection = Backbone.Collection.extend( {

		model: EntityModel,
		urlRoot: Global.rootUrl + '/data/entities',
		
		initialize: function () {

			App.ChartVariablesCollection.on( "add", this.onVariableAdd, this );
			App.ChartVariablesCollection.on( "remove", this.onVariableRemove, this );
			
		},

		parse: function( response ){
			return response.data;
		},

		onVariableAdd: function( model ) {
			this.updateEntities();
		},

		onVariableRemove: function( model ) {
			this.updateEntities();
		},

		updateEntities: function() {

			var ids = this.getVariableIds();
			this.url = this.urlRoot + "?variableIds=" + ids.join(",");

			var that = this;
			this.fetch( {
				success: function( collection, response ) {
					that.trigger( "fetched" );
				}
			});

		},

		getVariableIds: function() {

			var variables = App.ChartVariablesCollection.models,
				ids = _.map( variables, function( v, k ) {
					return v.get( "id" );
				} );
			return ids;

		}


	} );

	module.exports = App.Collections.AvailableEntitiesCollection;
	
})();
},{"./../models/App.Models.EntityModel.js":11}],4:[function(require,module,exports){
;( function() {
		
	"use strict";

	var ChartVariableModel = require( "./../models/App.Models.ChartVariableModel.js" );
	
	App.Collections.ChartVariablesCollection = Backbone.Collection.extend( {

		model: ChartVariableModel,

		initialize: function( models, options ) {
			if( models && models.length ) {
				//have models already
				this.scatterColorCheck( models );
			} else {
				this.on( "sync", this.onSync, this );
			}
		},

		onSync: function() {
			this.scatterColorCheck();
		},

		scatterColorCheck: function( models ) {
			
			if( App.ChartModel.get( "chart-type" ) == 2 ) {
				//make sure for scatter plot, we have color set as continents
				var chartDimensions = $.parseJSON( App.ChartModel.get( "chart-dimensions" ) );
				//if( !_.findWhere( chartDimensions, { "property": "color" } ) ) {
					//this is where we add color property
					var colorPropObj = { "id":"123","unit":"","name":"Color","period":"single","mode":"specific","targetYear":"2000","tolerance":"5","maximumAge":"5"};
					if( models ) {
						models.push( colorPropObj );
					} else {
						this.add( newChartVariableModel( colorPropObj ) );
					}
				//}
			}
		}

	} );

	module.exports = App.Collections.ChartVariablesCollection;
	
})();
},{"./../models/App.Models.ChartVariableModel.js":10}],5:[function(require,module,exports){
;( function() {
		
	"use strict";

	App.Collections.SearchDataCollection = Backbone.Collection.extend( {

		//model: App.Models.EntityModel,
		urlRoot: Global.rootUrl + '/data/search',
		
		initialize: function () {

			//App.ChartVariablesCollection.on( "add", this.onVariableAdd, this );
			//App.ChartVariablesCollection.on( "remove", this.onVariableRemove, this );
				
		},

		parse: function( response ){
			return response.data;
		},

		/*onVariableAdd: function( model ) {
			this.updateEntities();
		},

		onVariableRemove: function( model ) {
			this.updateEntities();
		},*/

		search: function( s ) {

			this.url = this.urlRoot + "?s=" + s;

			var that = this;
			this.fetch( {
				success: function( collection, response ) {
					that.trigger( "fetched" );
				}
			});

		}

	} );

	module.exports = App.Collections.SearchDataCollection;

})();
},{}],6:[function(require,module,exports){
;( function() {
		
	"use strict";

	App.Models.AvailableTimeModel = Backbone.Model.extend( {

		urlRoot: Global.rootUrl + '/data/times',
		
		initialize: function () {

			App.ChartVariablesCollection.on( "add", this.onVariableAdd, this );
			App.ChartVariablesCollection.on( "remove", this.onVariableRemove, this );
			
		},

		parse: function( response ) {

			var max = d3.max( response.data, function(d) { return parseFloat( d.label ); } ),
						min = d3.min( response.data, function(d) { return parseFloat( d.label ); } );
			this.set( { "max": max, "min": min } );
		
		},

		onVariableAdd: function( model ) {
			this.updateTime();
		},

		onVariableRemove: function( model ) {
			this.updateTime();
		},

		updateTime: function( ids ) {

			var ids = this.getVariableIds();
			this.url = this.urlRoot + "?variableIds=" + ids.join(",");
			this.fetch();

		},

		getVariableIds: function() {

			var variables = App.ChartVariablesCollection.models,
				ids = _.map( variables, function( v, k ) {
					return v.get( "id" );
				} );
			return ids;

		}


	} );

	module.exports = App.Models.AvailableTimeModel;

})();
},{}],7:[function(require,module,exports){
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
},{}],8:[function(require,module,exports){
;( function() {
		
	"use strict";

	App.Models.ChartDimensionsModel = Backbone.Model.extend( {

		urlRoot: Global.rootUrl + '/chartTypes/',

		defaults: {},

		loadConfiguration: function( chartTypeId ) {

			this.set( "id", chartTypeId );
			this.fetch( {
				success: function( response ) {
				}
			} );

		}

	} );

	module.exports = App.Models.ChartDimensionsModel;

})();
},{}],9:[function(require,module,exports){
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
},{}],10:[function(require,module,exports){
;( function() {
		
	"use strict";

	App.Models.ChartVariableModel = Backbone.Model.extend( {
		
		defaults: {}

	} );

	module.exports = App.Models.ChartVariableModel;

})();
},{}],11:[function(require,module,exports){
;( function() {
		
	"use strict";

	App.Models.EntityModel = Backbone.Model.extend( {
		
		urlRoot: Global.rootUrl + "/entity/",
		defaults: { "id": "", "name": "", "values": [] },

		import: function() {

			//strip id, so that backbone uses store 
			this.set( "id", null );

			this.url = this.urlRoot + 'import';

			this.save();

		}

	} );

	module.exports = App.Models.EntityModel;

})();
},{}],12:[function(require,module,exports){
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
},{"./../App.Utils.js":1,"./../models/App.Models.ChartDataModel.js":7,"./chart/App.Views.Chart.ChartTab.js":15,"./chart/App.Views.Chart.DataTab.js":16,"./chart/App.Views.Chart.Header.js":17,"./chart/App.Views.Chart.MapTab.js":19,"./chart/App.Views.Chart.ScaleSelectors":20,"./chart/App.Views.Chart.SourcesTab.js":21}],13:[function(require,module,exports){
;( function() {
	
	"use strict";

	var FormView = require( "./App.Views.FormView.js" ),
		ChartView = require( "./App.Views.ChartView.js" ),
		VariableSelects = require( "./ui/App.Views.UI.VariableSelects.js" );

	App.Views.Form = Backbone.View.extend({

		events: {},

		initialize: function() {},

		start: function() {
			//render everything for the first time
			this.render();
		},

		render: function() {
			
			var dispatcher = _.clone( Backbone.Events );
			this.dispatcher = dispatcher;

			this.formView = new FormView( { dispatcher: dispatcher } );
			this.chartView = new ChartView( { dispatcher: dispatcher } );
			
			//variable select
			var variableSelects = new VariableSelects();
			variableSelects.init();
			
		}

	});

	module.exports = App.Views.Form;

})();

},{"./App.Views.ChartView.js":12,"./App.Views.FormView.js":14,"./ui/App.Views.UI.VariableSelects.js":38}],14:[function(require,module,exports){
;( function() {
	
	"use strict";

	var ChartVariablesCollection = require( "./../collections/App.Collections.ChartVariablesCollection.js" ),
		AvailableEntitiesCollection = require( "./../collections/App.Collections.AvailableEntitiesCollection.js" ),
		ChartDimensionsModel = require( "./../models/App.Models.ChartDimensionsModel.js" ),
		AvailableTimeModel = require( "./../models/App.Models.AvailableTimeModel.js" ),
		SearchDataCollection = require( "./../collections/App.Collections.SearchDataCollection.js" ),
		
		BasicTabView = require( "./form/App.Views.Form.BasicTabView.js" ),
		AxisTabView = require( "./form/App.Views.Form.AxisTabView.js" ),
		DescriptionTabView = require( "./form/App.Views.Form.DescriptionTabView.js" ),
		StylingTabView = require( "./form/App.Views.Form.StylingTabView.js" ),
		ExportTabView = require( "./form/App.Views.Form.ExportTabView.js" ),
		MapTabView = require( "./form/App.Views.Form.MapTabView.js" );

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
				App.ChartVariablesCollection = new ChartVariablesCollection( formConfig[ "variables-collection" ] );
			} else {
				App.ChartVariablesCollection = new ChartVariablesCollection();
			}
			if( formConfig && formConfig[ "entities-collection" ] ) {
				App.AvailableEntitiesCollection = new AvailableEntitiesCollection( formConfig[ "entities-collection" ] );
			} else {
				App.AvailableEntitiesCollection = new AvailableEntitiesCollection();
			}
			if( formConfig && formConfig[ "dimensions" ] ) {
				App.ChartDimensionsModel = new ChartDimensionsModel();
				//App.ChartDimensionsModel = new App.Models.ChartDimensionsModel( formConfig[ "dimensions" ] );
			} else {
				App.ChartDimensionsModel = new ChartDimensionsModel();
			}
			if( formConfig && formConfig[ "available-time" ] ) {
				App.AvailableTimeModel = new AvailableTimeModel(formConfig[ "available-time" ]);
			} else {
				App.AvailableTimeModel = new AvailableTimeModel();
			}

			//create search collection
			App.SearchDataCollection = new SearchDataCollection();
			
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
			this.basicTabView = new BasicTabView( { dispatcher: this.dispatcher } );
			this.axisTabView = new AxisTabView( { dispatcher: this.dispatcher } );
			this.descriptionTabView = new DescriptionTabView( { dispatcher: this.dispatcher } );
			this.stylingTabView = new StylingTabView( { dispatcher: this.dispatcher } );
			this.exportTabView = new ExportTabView( { dispatcher: this.dispatcher } );
			this.mapTabView = new MapTabView( { dispatcher: this.dispatcher } );

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
},{"./../collections/App.Collections.AvailableEntitiesCollection.js":3,"./../collections/App.Collections.ChartVariablesCollection.js":4,"./../collections/App.Collections.SearchDataCollection.js":5,"./../models/App.Models.AvailableTimeModel.js":6,"./../models/App.Models.ChartDimensionsModel.js":8,"./form/App.Views.Form.AxisTabView.js":23,"./form/App.Views.Form.BasicTabView.js":24,"./form/App.Views.Form.DescriptionTabView.js":25,"./form/App.Views.Form.ExportTabView.js":26,"./form/App.Views.Form.MapTabView.js":27,"./form/App.Views.Form.StylingTabView.js":28}],15:[function(require,module,exports){
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
},{"./App.Views.Chart.Legend.js":18}],16:[function(require,module,exports){
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
},{}],17:[function(require,module,exports){
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
},{}],18:[function(require,module,exports){
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
},{}],19:[function(require,module,exports){
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
},{"./map/App.Views.Chart.Map.MapControls.js":22}],20:[function(require,module,exports){
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

},{}],21:[function(require,module,exports){
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
},{}],22:[function(require,module,exports){
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
},{}],23:[function(require,module,exports){
;( function() {
	
	"use strict";

	App.Views.Form.AxisTabView = Backbone.View.extend({

		el: "#form-view #axis-tab",
		events: {
			"change input.form-control, select.form-control": "onFormControlChange",
			"change [name='x-axis-scale-selector']": "onXaxisScaleSelector",
			"change [name='y-axis-scale-selector']": "onYaxisScaleSelector"
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			this.render();

		},

		render: function() {

			//setup initial values
			var that = this,
				chartXaxis = App.ChartModel.get( "x-axis" ),
				chartYaxis = App.ChartModel.get( "y-axis" );

			var $xAxisScaleSelector = this.$el.find( "[name='x-axis-scale-selector']" ),
				$yAxisScaleSelector = this.$el.find( "[name='y-axis-scale-selector']" );

			_.each( chartXaxis, function( d, i ) {
				that.$el.find( "[name='chart-x-" + i + "']" ).val( d );
			} );
			_.each( chartYaxis, function( d, i ) {
				that.$el.find( "[name='chart-y-" + i + "']" ).val( d );
			} );

			$xAxisScaleSelector.prop( "checked", App.ChartModel.get( "x-axis-scale-selector" ) );
			$yAxisScaleSelector.prop( "checked", App.ChartModel.get( "y-axis-scale-selector" ) );
			

		},

		onFormControlChange: function( evt ) {

			console.log( "onFormControlChange" );
			var $control = $( evt.currentTarget ),
				controlName = $control.attr( "name" ),
				controlValue = $control.val(),
				axisName = ( controlName.indexOf( "chart-y" ) > -1 )? "y-axis": "x-axis";

			//strip control name prefix
			controlName = controlName.substring( 8 );

			App.ChartModel.setAxisConfig( axisName, controlName, controlValue );

		},

		onXaxisScaleSelector: function( evt ) {
			var $check = $( evt.currentTarget );
			App.ChartModel.set( "x-axis-scale-selector", $check.is( ":checked" ) );
		},

		onYaxisScaleSelector: function( evt ) {
			var $check = $( evt.currentTarget );
			App.ChartModel.set( "y-axis-scale-selector", $check.is( ":checked" ) );
		}


	});
	
	module.exports = App.Views.Form.AxisTabView;

})();
},{}],24:[function(require,module,exports){
;( function() {
	
	"use strict";

	var ChartTypeSectionView = require( "./basicTab/App.Views.Form.ChartTypeSectionView.js" ),
		AddDataSectionView = require( "./dataTab/App.Views.Form.AddDataSectionView.js" ),
		DimensionsSectionView = require( "./dataTab/App.Views.Form.DimensionsSectionView.js" ),
		SelectedCountriesSectionView = require( "./dataTab/App.Views.Form.SelectedCountriesSectionView.js" ),
		EntitiesSectionView = require( "./dataTab/App.Views.Form.EntitiesSectionView.js" ),
		TimeSectionView = require( "./dataTab/App.Views.Form.TimeSectionView.js" );

	App.Views.Form.BasicTabView = Backbone.View.extend({

		el: "#form-view #basic-tab",
		events: {},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;

			this.chartTypeSection = new ChartTypeSectionView( { dispatcher: this.dispatcher } );
			this.addDataSection = new AddDataSectionView( { dispatcher: this.dispatcher } );
			this.dimensionsSection = new DimensionsSectionView( { dispatcher: this.dispatcher } );
			this.selectedCountriesSection = new SelectedCountriesSectionView( { dispatcher: this.dispatcher } );
			this.entitiesSection = new EntitiesSectionView( { dispatcher: this.dispatcher } );
			this.timeSection = new TimeSectionView( { dispatcher: this.dispatcher } );

			this.render();

		},

		render: function() {
			
			this.$el.find( "[name=chart-name]" ).val( App.ChartModel.get( "chart-name" ) );
			this.$el.find( "[name=chart-subname]" ).val( App.ChartModel.get( "chart-subname" ) );

		}

	});

	module.exports = App.Views.Form.BasicTabView;

})();

},{"./basicTab/App.Views.Form.ChartTypeSectionView.js":29,"./dataTab/App.Views.Form.AddDataSectionView.js":30,"./dataTab/App.Views.Form.DimensionsSectionView.js":31,"./dataTab/App.Views.Form.EntitiesSectionView.js":32,"./dataTab/App.Views.Form.SelectedCountriesSectionView.js":33,"./dataTab/App.Views.Form.TimeSectionView.js":34}],25:[function(require,module,exports){
;( function() {
	
	"use strict";

	App.Views.Form.DescriptionTabView = Backbone.View.extend({

		el: "#form-view #sources-tab",
		events: {},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			var that = this;

			this.$textArea = this.$el.find( "textarea" );
			this.$textArea.val( App.ChartModel.get( "chart-description" ) );

			this.$textArea.wysihtml5( {
				"events": {
					"change": function( evt ) {
						that.onFormControlChange( that.$textArea );
					}
				}
			});

			this.render();

		},

		render: function() {

		},

		onFormControlChange: function( evt ) {

			var textAreaValue = this.$textArea.val();
			App.ChartModel.set( "chart-description", textAreaValue );

		}


	});

	module.exports = App.Views.Form.DescriptionTabView;

})();
},{}],26:[function(require,module,exports){
;( function() {
	
	"use strict";

	App.Views.Form.ExportTabView = Backbone.View.extend({

		el: "#form-view #export-tab",
		events: {
			"click [type='checkbox']": "onTabsCheck",
			"change .embed-size-wrapper input": "onEmbedSizeChange"
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			this.dispatcher.on( "chart-saved", this.onChartSaved, this );
			
			this.render();

		},

		render: function() {
			
			this.$checkboxes = this.$el.find( "[type='checkbox']" );
			this.$widthInput = this.$el.find( "[name='iframe-width']" );
			this.$heightInput = this.$el.find( "[name='iframe-height']" );
			this.$iframeTextArea = this.$el.find( "[name='iframe']" );

			this.$mapTab = $( "[href='#map-tab']" );

			//update line-type from model
			var that = this,
				tabs = App.ChartModel.get( "tabs" );
			_.each( tabs, function( v, i ) {
				var $checkbox = that.$checkboxes.filter( "[value='" + v + "']" );
				$checkbox.prop( "checked", true );
				if( v === "map" ) {
					that.$mapTab.css( "display", "block" );
				}
			} );

			//update size from model
			this.$widthInput.val( App.ChartModel.get( "iframe-width" ) );
			this.$heightInput.val( App.ChartModel.get( "iframe-height" ) );

			//update export code from 
			var chartId = App.ChartModel.get( "id" );
			if( chartId ) {
				var viewUrl = this.$iframeTextArea.attr( "data-view-url" );
				this.generateIframeCode( chartId, viewUrl );
			}

		},

		onChartSaved: function( id, viewUrl ) {
			this.generateIframeCode( id, viewUrl );
		},

		onTabsCheck: function( evt ) {

			var that = this,
				checked = [];
			$.each( this.$checkboxes, function( i, v ) {

				var $checkbox = $( this );
				if( $checkbox.is( ":checked" ) ) {
					checked.push( $checkbox.val() );
				}

				if( $checkbox.val() === "map" ) {
					if( $checkbox.is( ":checked" ) ) {
						that.$mapTab.css( "display", "block" );
					} else {
						that.$mapTab.css( "display", "none" );
					}
				}
		
			} );

			App.ChartModel.set( "tabs", checked );

		},

		onEmbedSizeChange: function( evt ) {

			
			var $input = $( evt.currentTarget );
			//unnecessary to update everything just because generated code changed
			App.ChartModel.set( $input.attr( "name" ), $input.val(), {silent:true} );

			//if already generated code, update it
			if( this.$iframeTextArea.text() != "" ) {
				this.generateIframeCode();
			}

		},

		generateIframeCode: function( id, viewUrl ) {
			//store view url
			if( viewUrl ) {
				this.viewUrl = viewUrl;
			}
			this.$iframeTextArea.text( '<iframe src="' + this.viewUrl + '" style="width:' + App.ChartModel.get( "iframe-width" ) + ';height:' + App.ChartModel.get( "iframe-height" ) + '; border: 0px none;"></iframe>' );
		}

	});

	module.exports = App.Views.Form.ExportTabView;

})();
},{}],27:[function(require,module,exports){
;( function() {
	
	"use strict";

	App.Views.Form.MapTabView = Backbone.View.extend({

		el: "#form-view #map-tab",
		events: {
			"change [name='map-variable-id']": "onVariableIdChange",
			"change [name='map-time-tolerance']": "onTimeToleranceChange",
			"change [name='map-time-interval']": "onTimeIntervalChange",
			"change [name='map-color-scheme']": "onColorSchemeChange",
			"change [name='map-color-interval']": "onColorIntervalChange",
			"change [name='map-projections']": "onProjectionChange"
		},

		initialize: function( options ) {
			this.dispatcher = options.dispatcher;

			App.ChartVariablesCollection.on( "add remove change reset", this.onVariablesCollectionChange, this );
			App.AvailableTimeModel.on( "change", this.onAvailableTimeChange, this );
			//App.ChartModel.on( "change", this.onChartModelChange, this );
			
			this.$variableIdSelect = this.$el.find( "[name='map-variable-id']" );
			
			this.$timeToleranceInput = this.$el.find( "[name='map-time-tolerance']" );
			this.$timeIntervalInput = this.$el.find( "[name='map-time-interval']" );
			
			this.$colorSchemeSelect = this.$el.find( "[name='map-color-scheme']" );
			this.$colorIntervalSelect = this.$el.find( "[name='map-color-interval']" );
			
			this.$projectionsSelect = this.$el.find( "[name='map-projections']" );

			//make sure we have current data
			this.updateTargetYear( true );

			this.render();
		},

		render: function() {
					
			//populate variable select with the available ones
			this.$variableIdSelect.empty();

			var mapConfig = App.ChartModel.get( "map-config" );
				
			this.updateVariableSelect();

			this.$timeToleranceInput.val( mapConfig.timeTolerance );
			this.$timeIntervalInput.val( mapConfig.timeInterval );

			this.updateColorSchemeSelect();
			this.updateColorIntervalSelect();
			this.updateProjectionsSelect();

		},

		updateVariableSelect: function() {

			var mapConfig = App.ChartModel.get( "map-config" ),
				models = App.ChartVariablesCollection.models,
				html = "";

			if( models && models.length ) {
				html += "<option selected disabled>Select variable to display on map</option>";
			}

			_.each( models, function( v, i ) {
				//if no variable selected, try to select first
				var selected = ( i == mapConfig.variableId )? " selected": "";
				html += "<option value='" + v.get( "id" ) + "' " + selected + ">" + v.get( "name" ) + "</option>";
			} );

			//check for empty html
			if( !html ) {
				html += "<option selected disabled>Add some variables in 2.Data tab first</option>";
				this.$variableIdSelect.addClass( "disabled" );
			} else {
				this.$variableIdSelect.removeClass( "disabled" );
			}
			this.$variableIdSelect.append( $( html ) );

			//check if we should select first variable
			if( models.length && !this.$variableIdSelect.val() ) {
				var firstOption = this.$variableIdSelect.find( "option" ).eq( 1 ).val();
				this.$variableIdSelect.val( firstOption );
				App.ChartModel.updateMapConfig( "variableId", firstOption );
			}

		},
		
		updateColorSchemeSelect: function() {
			
			var html = "",
				mapConfig = App.ChartModel.get( "map-config" );

			this.$colorSchemeSelect.empty();
			_.each( colorbrewer, function( v, i ) {
				var selected = ( i == mapConfig.colorSchemeName )? " selected": "";
				html += "<option value='" + i + "' " + selected + ">" + i + "</option>";
			} );
			this.$colorSchemeSelect.append( $( html ) );

		},

		updateColorIntervalSelect: function() {
			
			var html = "",
				mapConfig = App.ChartModel.get( "map-config" ),
				hasSelected = false;

			this.$colorIntervalSelect.empty();
			_.each( colorbrewer[  mapConfig.colorSchemeName ], function( v, i ) {
				var selected = ( i == mapConfig.colorSchemeInterval )? " selected": "";
				if( selected === " selected" ) {
					hasSelected = true;
				}
				html += "<option value='" + i + "' " + selected + ">" + i + "</option>";
			} );
			this.$colorIntervalSelect.append( $( html ) );

			if( !hasSelected ) {
				//there's not selected interval that would exist with current color scheme, select that first
				App.ChartModel.updateMapConfig( "colorSchemeInterval", this.$colorIntervalSelect.val() );
			}

		},

		updateProjectionsSelect: function() {
			
			var html = "",
				mapConfig = App.ChartModel.get( "map-config" );

			this.$projectionsSelect.empty();
			_.each( App.Views.Chart.MapTab.projections, function( v, i ) {
				var selected = ( i == mapConfig.projections )? " selected": "";
				html += "<option value='" + i + "' " + selected + ">" + i + "</option>";
			} );
			this.$projectionsSelect.append( $( html ) );

		},

		updateTargetYear: function( silent ) {
			var chartTime = App.ChartModel.get( "chart-time" ),
				targetYear = ( chartTime )? chartTime[0]: App.AvailableTimeModel.get( "min" ),
				minYear = targetYear,
				maxYear = ( chartTime )? chartTime[1]: App.AvailableTimeModel.get( "max" );

			App.ChartModel.updateMapConfig( "minYear", minYear, true );
			App.ChartModel.updateMapConfig( "maxYear", maxYear, true );
			App.ChartModel.updateMapConfig( "targetYear", targetYear, silent );
		},

		onVariablesCollectionChange: function() {
			this.render();
		},

		onVariableIdChange: function( evt ) {
			var $this = $( evt.target );
			App.ChartModel.updateMapConfig( "variableId", $this.val() );
		},

		onTimeToleranceChange: function( evt ) {
			var $this = $( evt.target );
			App.ChartModel.updateMapConfig( "timeTolerance", parseInt( $this.val(), 10 ) );
		},

		onTimeIntervalChange: function( evt ) {
			var $this = $( evt.target );
			App.ChartModel.updateMapConfig( "timeInterval", parseInt( $this.val(), 10 ) );
		},

		onColorSchemeChange: function( evt ) {
			var $this = $( evt.target );
			App.ChartModel.updateMapConfig( "colorSchemeName", $this.val() );
			//need to update number of classes
			this.updateColorIntervalSelect();
		},

		onColorIntervalChange: function( evt ) {
			var $this = $( evt.target );
			App.ChartModel.updateMapConfig( "colorSchemeInterval", parseInt( $this.val(), 10 ) );
		},

		onProjectionChange: function( evt ) {
			var $this = $( evt.target );
			App.ChartModel.updateMapConfig( "projection", $this.val() );
		},

		onChartModelChange: function( evt ) {
			this.updateTargetYear( true );
		},

		onAvailableTimeChange: function( evt ) {
			this.updateTargetYear( false );
		}

	});

	module.exports = App.Views.Form.MapTabView;

})();
},{}],28:[function(require,module,exports){
;( function() {
	
	"use strict";

	App.Views.Form.StylingTabView = Backbone.View.extend({

		el: "#form-view #styling-tab",
		events: {
			"change [name='line-type']": "onLineTypeChange",
			"change [name^='margin-']": "onMarginChange",
			"change [name='hide-legend']": "onHideLegendChange"
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			
			this.$lineTypeRadios = this.$el.find( "[name='line-type']" );
			
			//margins
			this.$marginTop = this.$el.find( "[name='margin-top']" );
			this.$marginLeft = this.$el.find( "[name='margin-left']" );
			this.$marginRight = this.$el.find( "[name='margin-right']" );
			this.$marginBottom = this.$el.find( "[name='margin-bottom']" );
			
			//legend
			this.$hideLegend = this.$el.find( "[name='hide-legend']" );

			//units
			this.$unitsSection = this.$el.find( ".units-section" );
			this.$unitsContent = this.$unitsSection.find( ".form-section-content" );
			
			App.ChartModel.on( "change:chart-type", this.onChartTypeChange, this );
			App.ChartModel.on( "change:chart-dimensions", this.render, this );
			
			this.render();

		},

		render: function() {

			var lineType = App.ChartModel.get( "line-type" );
			this.$lineTypeRadios.filter( "[value='" + lineType + "']" ).prop( "checked", true );

			var margins = App.ChartModel.get( "margins" );
			this.$marginTop.val( margins.top );
			this.$marginLeft.val( margins.left );
			this.$marginRight.val( margins.right );
			this.$marginBottom.val( margins.bottom );

			var hideLegend = ( App.ChartModel.get( "hide-legend" ) )? true: false;
			this.$hideLegend.prop( "checked", hideLegend );

			this.updateUnitsUI();
			$( ".units-section .form-control[type=input], .units-section [type=checkbox]" ).on( "change", $.proxy( this.updateUnits, this ) );
		
		},

		onLineTypeChange: function( evt ) {

			var $radio = $( evt.currentTarget );
			App.ChartModel.set( "line-type", $radio.val() );

		},

		onMarginChange: function( evt ) {

			var $control = $( evt.currentTarget ),
				controlName = $control.attr( "name" ),
				marginsObj = { top: this.$marginTop.val(),
							left: this.$marginLeft.val(),
							right: this.$marginRight.val(),
							bottom: this.$marginBottom.val() };

			App.ChartModel.set( "margins", marginsObj );
			App.ChartModel.trigger( "update" );

		},

		onUnitChange: function( evt ) {
			var $control = $( evt.currentTarget );
			App.ChartModel.set( "unit", $control.val() );
		},

		onHideLegendChange: function( evt ) {

			var $check = $( evt.currentTarget ),
				hideLegend = ( $check.is( ":checked" ) )? true: false;
			App.ChartModel.set( "hide-legend", hideLegend );

		},

		onChartTypeChange: function( evt ) {

			if( App.ChartModel.get( "chart-type" ) === "2" ) {
				//scatter plot has legend hidden by default
				App.ChartModel.set( "hide-legend", true );
			}

		},

		updateUnitsUI: function( evt ) {
			
			var dimensionsString = App.ChartModel.get( "chart-dimensions" ), //App.ChartDimensionsModel.get( "chartDimensions" ),
				dimensions = ( !$.isEmptyObject( dimensionsString ) )? $.parseJSON( dimensionsString ): {},
				unitsString = App.ChartModel.get( "units" ),
				units = ( !$.isEmptyObject( unitsString ) )? $.parseJSON( unitsString ): {};
			
			//refresh whole unit section
			this.$unitsContent.html( "<ul></ul>" );
			var $ul = this.$unitsContent.find( "ul" );

			if( dimensions ) {

				$.each( dimensions, function( i, v ) {

					var dimension = v,
						unitObj = _.findWhere( units, { "property": dimension.property } ),
						//by default visible
						visible = ( unitObj && unitObj.hasOwnProperty( "visible" )  )? unitObj.visible: true,
						visibleProp = ( visible )? " checked": "",
						unit = ( unitObj && unitObj.unit )? unitObj.unit: "",
						format = ( unitObj && unitObj.format )? unitObj.format: "";
					
					if( !unitObj && dimension && dimension.unit ) {
						//if nothing stored, try to get default units for given variable
						unit = dimension.unit;
					}

					var $li = $( "<li data-property='" + dimension.property + "'><label>" + dimension.name + ":</label>Visible:<input type='checkbox' class='visible-input' " + visibleProp + "/><input type='input' class='form-control unit-input' value='" + unit + "' placeholder='Unit' /><input type='input' class='form-control format-input' value='" + format + "' placeholder='No of dec. places' /></li>" );
					$ul.append( $li );

				} );

			}
			
		},

		updateUnits: function() {
			
			var units = [],
				$unitLis = this.$unitsContent.find( "li" );

			$.each( $unitLis, function( i, v ) {
				
				var $li = $( v ),
					$visible = $li.find( ".visible-input" ),
					$unit = $li.find( ".unit-input" ),
					$format = $li.find( ".format-input" );

				//for each li with unit information, construct object with property, unit and format properties
				var unitSettings = {
					"property": $li.attr( "data-property" ),
					"visible": $visible.is( ":checked" ),
					"unit": $unit.val(),
					"format": $format.val()
				};
					
				units.push( unitSettings );

			} );

			var json = JSON.stringify( units );
			App.ChartModel.set( "units", json );
			
		}

	});

	module.exports = App.Views.Form.StylingTabView;

})();
},{}],29:[function(require,module,exports){
;( function() {
	
	"use strict";

	App.Views.Form.ChartTypeSectionView = Backbone.View.extend({

		el: "#form-view #basic-tab .chart-type-section",
		events: {
			"change [name='chart-type']": "onChartTypeChange",
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			App.ChartDimensionsModel.on( "change", this.render, this );
			this.render();

		},

		render: function() {
			var $select = this.$el.find( "[name='chart-type']" ),
				selectedChartType = App.ChartModel.get( "chart-type" );
			if( selectedChartType ) {
				$select.val( selectedChartType );
			}
		},

		onChartTypeChange: function( evt ) {

			//clear uf something previously selected
			App.ChartModel.unset( "variables", {silent:true} );
			App.ChartModel.unset( "chart-dimensions", {silent:true} );

			var $select = $( evt.currentTarget );
			App.ChartModel.set( "chart-type", $select.val() );

			App.ChartDimensionsModel.loadConfiguration( $select.val() );

		}

	});

	module.exports = App.Views.Form.ChartTypeSectionView;

})();
},{}],30:[function(require,module,exports){
;( function() {
	
	"use strict";

	var SelectVarPopup = require( "./../../ui/App.Views.UI.SelectVarPopup.js" ),
		SettingsVarPopup = require( "./../../ui/App.Views.UI.SettingsVarPopup.js" );

	App.Views.Form.AddDataSectionView = Backbone.View.extend({

		el: "#form-view #data-tab .add-data-section",
		events: {
			"click .add-data-btn": "onAddDataBtn",
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;

			this.selectVarPopup = new SelectVarPopup();
			this.selectVarPopup.init( options );

			this.settingsVarPopup = new SettingsVarPopup();
			this.settingsVarPopup.init( options );

			App.ChartVariablesCollection.on( "reset", this.onVariableReset, this );
			App.ChartVariablesCollection.on( "add", this.onVariableAdd, this );
			App.ChartVariablesCollection.on( "remove", this.onVariableRemove, this );

			this.dispatcher.on( "variable-label-moved", this.onVariableLabelMoved, this );
			this.dispatcher.on( "dimension-setting-update", this.onDimensionSettingUpdate, this );

			this.render();

		},

		render: function() {

			this.$dd = this.$el.find( ".dd" );
			this.$ddList = this.$dd.find( ".dd-list" );
			this.$dd.nestable();

			this.onVariableReset();

		},

		refreshHandlers: function() {
			var $removeBtns = this.$ddList.find( ".fa-close" );
			$removeBtns.on( "click", $.proxy( this.onRemoveBtnClick, this ) );
			this.$dd.nestable();
		},

		onAddDataBtn: function() {

			this.selectVarPopup.show();

		},

		onVariableReset: function() {

			var that = this,
				models = App.ChartVariablesCollection.models;
			_.each( models, function( v, i ) {
				that.onVariableAdd( v );
			} );

		},

		onVariableAdd: function( model ) {

			//if there's empty element, remove it
			this.$el.find( ".dd-empty" ).remove();
			//refetch dd-list - needed if there was something removed
			this.$ddList = this.$dd.find( ".dd-list" );

			if( !this.$dd.find( ".dd-list" ).length ) {
				//dd-list has been removed by nestable
				var $ddList = $( "<ol class='dd-list'></ol>" );
				this.$dd.append( $ddList );
				this.$ddList = this.$dd.find( ".dd-list" );
			}

			//have default target year for scatter plot
			var defaultPeriod = ( App.ChartModel.get( "chart-type" ) === "2" )? "single": "all",
				defaultMode = ( App.ChartModel.get( "chart-type" ) === "2" )? "specific": "closest",
				defaultTargetYear = 2000,
				defaultMaxAge = 5,
				defaultTolerance = 5;

			var $li = $( "<li class='variable-label dd-item' data-unit='" + model.get( "unit" ) + "' data-period='" + defaultPeriod + "' data-tolerance='" + defaultTolerance + "' data-maximum-age='" + defaultMaxAge + "' data-mode='" + defaultMode + "' data-target-year='" + defaultTargetYear + "' data-variable-id='" + model.get( "id" ) + "'><div class='dd-handle'><div class='dd-inner-handle'><span class='variable-label-name'>" + model.get( "name" ) + "</span><span class='variable-label-input'><input class='form-control'/><i class='fa fa-check'></i><i class='fa fa-times'></i></div></div><a href='' class='variable-setting-btn'><span class='fa period-icon'></span><span class='number-icon'></span><span class='fa fa-cog' title='Setting variable'></span></a><span class='fa fa-close'></span></li>" ),
				$settings = $li.find( ".variable-setting-btn" );
			this.$ddList.append( $li );
			
			$settings.on( "click", $.proxy( this.onSettingsClick, this ) );
			
			var $variableLabelName = $li.find( ".variable-label-name" ),
				$variableLabelInput = $li.find( ".variable-label-input input" ),
				$confirmNameBtn = $li.find( ".fa-check" ),
				$cancelNameBtn = $li.find( ".fa-times" );

			$variableLabelName.on( "mousedown", $.proxy( this.onVariableNameClick, this ) );
			$confirmNameBtn.on( "mousedown", $.proxy( this.onNameBtnClick, this ) );
			$cancelNameBtn.on( "mousedown", $.proxy( this.onNameBtnClick, this ) );
			$variableLabelInput.on( "mousedown", $.proxy( this.onLabelInput, this ) );

			this.refreshHandlers();
			this.updateVarIcons();

		},

		onRemoveBtnClick: function( evt ) {

			evt.preventDefault();
			var $btn = $( evt.currentTarget ),
				$label = $btn.parents( ".variable-label" ),
				variableId = $label.attr( "data-variable-id" );
			App.ChartVariablesCollection.remove( variableId );

		},

		onVariableLabelMoved: function( ) {

			//check if there's any variable label left, if not insert empty dd placeholder
			if( !this.$el.find( ".variable-label" ).length ) {
				this.$el.find( ".dd-list" ).replaceWith( "<div class='dd-empty'></div>" );
			}

		},

		onSettingsClick: function( evt ) {

			evt.stopImmediatePropagation();
			evt.preventDefault();

			var $btn = $( evt.currentTarget ),
				$parent = $btn.parent();
				
			this.settingsVarPopup.show( $parent );

		},

		onDimensionSettingUpdate: function( data ) {

			//find updated variable
			var $variableLabel = $( ".variable-label[data-variable-id='" + data.variableId + "']" );
			//update all attributes
			for( var i in data ) {
				if( data.hasOwnProperty( i ) && i !== "variableId" ) {
					var attrName = "data-" + i,
						attrValue = data[ i ];
					$variableLabel.attr( attrName, attrValue );
				}
			}

			//if sync period values for all variables 
			var $variableLabels = $( ".variable-label" );
			$variableLabels.attr( "data-period", data.period );

			this.updateVarIcons();

			//hide popup
			this.settingsVarPopup.hide();

			//trigger updating model
			this.dispatcher.trigger( "dimension-update" );

		},

		updateVarIcons: function() {
			
			var $variableLabels = $( ".variable-label" );

			//update icons
			$.each( $variableLabels, function( i, v ) {

				var $label = $( v ),
					$periodIcon = $label.find( ".period-icon" ),
					$modeIcon = $label.find( ".mode-icon" ),
					$numberIcon = $label.find( ".number-icon" );

				//mode
				var period = $label.attr( "data-period" ),
					mode = $label.attr( "data-mode" );
				if( period === "all" ) {
					$periodIcon.addClass( "fa-arrows-h" );
					$periodIcon.removeClass( "fa-circle" );
				} else {
					$periodIcon.removeClass( "fa-arrows-h" );
					$periodIcon.addClass( "fa-circle" );
				}

				if( period === "single" && mode === "specific" ) {
					$numberIcon.html( $label.attr( "data-target-year" ) + "/" + $label.attr( "data-tolerance" ) );
				} else if( period == "single" && mode === "latest" ) {
					$numberIcon.html( "<span class='fa fa-long-arrow-right'></span>/" + $label.attr( "data-maximum-age" ) );
				} else if( period == "all" && mode === "closest" ) {
					$numberIcon.html( $label.attr( "data-tolerance" ) );
				} else if( period == "all" && mode === "latest" ) {
					$numberIcon.html( "<span class='fa fa-long-arrow-right'></span>/" + $label.attr( "data-maximum-age" ) );
				}

				/*$periodIcon.text( $label.attr( "data-period" ) );
				$modeIcon.text( $label.attr( "data-mode" ) );
				$numberIcon.text( $label.attr( "data-target-year" ) );*/

			} );

		},

		onVariableNameClick: function( evt ) {

			var $name = $( evt.currentTarget ),
				$parent = $name.parent(),
				$variableLabelInput = $parent.find( ".variable-label-input" ),
				$input = $variableLabelInput.find( "input" ),
				$cog = $parent.parent().parent().find( ".variable-setting-btn" );
			
			//make sure variable is in dimension section
			if( $parent.parents( ".dimensions-section" ).length ) {

				//stopping propagation not at the top, but here, to enable drag&drop outside of dimension section
				evt.stopImmediatePropagation();
				evt.preventDefault();

				$cog.addClass( "hidden" );
				$name.hide();
				$variableLabelInput.show();
				$input.val( $name.text() );
			}

		},

		onNameBtnClick: function( evt ) {

			evt.stopImmediatePropagation();
			evt.preventDefault();

			var $inputBtn = $( evt.currentTarget ),
				$variableLabelInput = $inputBtn.parent(),
				$parent = $variableLabelInput.parent(),
				$variableLabelName = $parent.find( ".variable-label-name" ),
				$cog = $parent.parent().parent().find( ".variable-setting-btn" );
			
			$cog.removeClass( "hidden" );
 
			if( $inputBtn.hasClass( "fa-check" ) ) {
				//confirmation of change to variable name
				var $input = $variableLabelInput.find( "input" ),
					inputVal = $input.val(),
					$variableLabel = $variableLabelInput.parents( ".variable-label" );
				$variableLabelName.text( inputVal );
				$variableLabel.attr( "data-display-name", inputVal );
				this.dispatcher.trigger( "dimension-update" );
			}

			$variableLabelInput.hide();
			$variableLabelName.show();

		},

		onLabelInput: function( evt ) {

			evt.stopImmediatePropagation();
			evt.preventDefault();

			var $input = $( evt.currentTarget );
			$input.focus();

		},

		onVariableRemove: function( model ) {
			var $liToRemove = $( ".variable-label[data-variable-id='" + model.get( "id" ) + "']" );
			$liToRemove.remove();
		}

	});
	
	module.exports = App.Views.Form.AddDataSectionView;
	
})();
},{"./../../ui/App.Views.UI.SelectVarPopup.js":36,"./../../ui/App.Views.UI.SettingsVarPopup.js":37}],31:[function(require,module,exports){
;( function() {
	
	"use strict";

	App.Views.Form.DimensionsSectionView = Backbone.View.extend({

		el: "#form-view #data-tab .dimensions-section",
		events: {
			"change [name='chart-type']": "onChartTypeChange",
			"change [name='group-by-variable']": "onGroupByVariableChange",
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			App.ChartDimensionsModel.on( "reset change", this.render, this );

			this.dispatcher.on( "dimension-update", this.onDimensionUpdate, this );
			
			this.render();

		},

		inited: false,

		render: function() {

			this.$formSectionContent = this.$el.find( ".form-section-content" );
			this.$dimensionsInput = this.$el.find( "[name='chart-dimensions']" );
			this.$groupByVariable = this.$el.find( ".group-by-variable-wrapper" );
			this.$groupByVariableInput = this.$groupByVariable.find( "[name='group-by-variable']" );

			//get rid of old content
			this.$formSectionContent.empty();

			//construct html
			var chartType = App.ChartDimensionsModel.id,
				dimensions = App.ChartDimensionsModel.get( "chartDimensions" ),
				htmlString = "<ol class='dimensions-list chart-type-" + chartType + "'>";

			_.each( dimensions, function( v, k ) {
				htmlString += "<li data-property='" + v.property + "' class='dimension-box'><h4>" + v.name + "</h4><div class='dd-wrapper'><div class='dd'><div class='dd-empty'></div></div></div></li>";
			} );

			htmlString += "</ol>";

			var $html = $( htmlString );
			this.$formSectionContent.append( $html );

			//init nestable 
			this.$dd = this.$el.find( ".dd" );
			//nestable destroy
			this.$dd.nestable();
						
			//fetch remaing dom
			this.$dimensionBoxes = this.$el.find( ".dimension-box" );

			var that = this;
			this.$dd.on('change', function() {
				that.updateInput();
			});

			//if editing chart - assign possible chart dimensions to available dimensions
			var chartDimensions = App.ChartModel.get( "chart-dimensions" );
			this.setInputs( chartDimensions );

			//handle group by variable checkbox
			if( App.ChartModel.get( "chart-type" ) == 1 || App.ChartModel.get( "chart-type" ) == 3 ) {
				//is linechart, so this checkbox is relevant
				var groupByVariables = App.ChartModel.get( "group-by-variables" );
				this.$groupByVariableInput.prop( "checked", groupByVariables );
				this.$groupByVariable.show();
			} else {
				//is not linechart, make sure grouping of variables is off and hide input
				App.ChartModel.set( "group-by-variables", false );
				this.$groupByVariable.hide();
			}
			
			//if scatter plot, only entity match
			/*var $onlyEntityMatchCheck = $( "<div class='only-entity-check-wrapper'><label><input type='checkbox' name='only-entity-check' />Match variables only by countries, not years.</label></div>" ),
				$onlyEntityInput = $onlyEntityMatchCheck.find( "input" );
			$onlyEntityInput.on( "change", function( evt ) {
				var $this = $( this );
				App.ChartModel.set( "only-entity-match", $this.prop( "checked" ) );
			} );
			//set default value
			$onlyEntityInput.prop( "checked", App.ChartModel.get( "only-entity-match" ) );
			this.$formSectionContent.append( $onlyEntityMatchCheck );*/
			
		},

		updateInput: function() {
			
			var dimensions = [];
			$.each( this.$dimensionBoxes, function( i, v ) {
				var $box = $( v ),
					$droppedVariables = $box.find( ".variable-label" );
				if( $droppedVariables.length ) {
					//just in case there were more variables
					$.each( $droppedVariables, function( i, v ) {
						var $droppedVariable = $( v ),
							dimension = { variableId: $droppedVariable.attr( "data-variable-id" ), displayName: $droppedVariable.attr( "data-display-name" ), property: $box.attr( "data-property" ), unit: $droppedVariable.attr( "data-unit" ), name: $box.find( "h4" ).text(), period: $droppedVariable.attr( "data-period" ), mode: $droppedVariable.attr( "data-mode" ), targetYear: $droppedVariable.attr( "data-target-year" ), tolerance: $droppedVariable.attr( "data-tolerance" ), maximumAge: $droppedVariable.attr( "data-maximum-age" ) };
						dimensions.push( dimension );
					} );
				}
			} );

			var json = JSON.stringify( dimensions );
			this.$dimensionsInput.val( json );
			App.ChartModel.set( "chart-dimensions", json );

		},

		setInputs: function( chartDimensions ) {

			if( !chartDimensions || !chartDimensions.length ) {
				return;
			}

			//convert to json
			chartDimensions = $.parseJSON( chartDimensions );

			var that = this;
			_.each( chartDimensions, function( chartDimension, i ) {

				//find variable label box from available variables
				var $variableLabel = $( ".variable-label[data-variable-id=" + chartDimension.variableId + "]" );

				//copy variables attributes
				if( chartDimension.period ) {
					$variableLabel.attr( "data-period", chartDimension.period );
				}
				if( chartDimension.mode ) {
					$variableLabel.attr( "data-mode", chartDimension.mode );
				}
				if( chartDimension.targetYear ) {
					$variableLabel.attr( "data-target-year", chartDimension.targetYear );
				}
				if( chartDimension.tolerance ) {
					$variableLabel.attr( "data-tolerance", chartDimension.tolerance );
				}
				if( chartDimension.maximumAge ) {
					$variableLabel.attr( "data-maximum-age", chartDimension.maximumAge );
				}
				if( chartDimension.displayName ) {
					$variableLabel.find( ".variable-label-name" ).text( chartDimension.displayName );
				}

				//find appropriate dimension box for it by data-property
				var $dimensionBox = that.$el.find( ".dimension-box[data-property=" + chartDimension.property + "]" );
				//remove empty and add variable box
				$dimensionBox.find( ".dd-empty" ).remove();
				var $ddList = $( "<ol class='dd-list'></ol>" );
				$ddList.append( $variableLabel );
				$dimensionBox.find( ".dd" ).append( $ddList );
				that.dispatcher.trigger( "variable-label-moved" );

			} );
	
		},

		onChartTypeChange: function( evt ) {

			var $select = $( evt.currentTarget );
			App.ChartDimensionsModel.loadConfiguration( $select.val() );

		},

		onDimensionUpdate: function() {
			this.updateInput();
		},

		onGroupByVariableChange: function( evt ) {

			var $input = $( evt.currentTarget );
			App.ChartModel.set( "group-by-variables", $input.is( ":checked" ) );

		}

	});
	
	module.exports = App.Views.Form.DimensionsSectionView;
	
})();
},{}],32:[function(require,module,exports){
;( function() {
	
	"use strict";

	App.Views.Form.EntitiesSectionView = Backbone.View.extend({

		el: "#form-view #data-tab .entities-section",
		events: {
			"change .countries-select": "onCountriesSelect",
			"change [name='add-country-mode']": "onAddCountryModeChange"
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			//App.AvailableEntitiesCollection.on( "change add remove reset", this.render, this );
			//available entities are changing just on fetch so listen just for that
			App.AvailableEntitiesCollection.on( "reset fetched", this.render, this );
			
			this.$entitiesSelect = this.$el.find( ".countries-select" );
			this.$addCountryControlInput = this.$el.find( "[name='add-country-control']" );

			this.render();

		},

		render: function() {

			var $entitiesSelect = this.$entitiesSelect;
			$entitiesSelect.empty();
			
			//append default 
			$entitiesSelect.append( $( "<option selected disabled>Select entity</option>" ) );

			App.AvailableEntitiesCollection.each( function( model ) {
				$entitiesSelect.append( $( "<option value='" + model.get( "id" ) + "'>" + model.get( "name" ) + "</option>" ) );
			});

			var addCountryControl = App.ChartModel.get( "add-country-control" );
			this.$addCountryControlInput.prop( "checked", addCountryControl );

			//based on stored add-country-mode
			var addCountryMode = App.ChartModel.get( "add-country-mode" );
			this.$el.find( "[name='add-country-mode']" ).filter( "[value='" + addCountryMode + "']" ).prop( "checked", true );

		},

		onCountriesSelect: function( evt ) {

			var $select = $( evt.target ),
				val = $select.val(),
				$option = $select.find( "option[value=" + val + "]" ),
				text = $option.text();

			App.ChartModel.addSelectedCountry( { id: val, name: text } );

		},

		onAddCountryModeChange: function( evt ) {

			var $input = $( "[name='add-country-mode']:checked" );
			App.ChartModel.set( "add-country-mode", $input.val() );

		}


	});
	
	module.exports = App.Views.Form.EntitiesSectionView;

})();
},{}],33:[function(require,module,exports){
;( function() {
	
	"use strict";

	var ColorPicker = require( "./../../ui/App.Views.UI.ColorPicker.js" );

	App.Views.Form.SelectedCountriesSectionView = Backbone.View.extend({

		el: "#form-view #data-tab .selected-countries-box",
		events: {},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			
			App.ChartModel.on( "change:selected-countries", this.render, this );

			this.render();

		},

		render: function() {

			//remove everything
			this.$el.empty();

			var that = this,
				selectedCountries = App.ChartModel.get( "selected-countries" );

			_.each( selectedCountries, function( v, i ) {
				var $li = $( "<li class='country-label' data-id='" + v.id + "' data-name='" + v.name + "'>" + v.name + "<span class='fa fa-remove'></span></li>" );
				that.$el.append( $li );
				if( v.color ) {
					$li.css( "background-color", v.color );
				}
			} );

			var $lis = this.$el.find( ".country-label" ),
				$lisRemoveBtns = $lis.find( ".fa-remove" ),
				colorPicker = null;

			$lis.on( "click", function( evt ) {

				evt.preventDefault();

				var $countryLabel = $( evt.currentTarget );
				if( colorPicker ) {
					colorPicker.close();
				}
				colorPicker = new ColorPicker( $countryLabel );
				colorPicker.init( $countryLabel );
				colorPicker.onSelected = function( value ) {
					$countryLabel.css( "background-color", value );
					$countryLabel.attr( "data-color", value );
					App.ChartModel.updateSelectedCountry( $countryLabel.attr( "data-id" ), value );
					colorPicker.close();
					//that.$el.trigger( "change" );
				};

			} );	

			$lisRemoveBtns.on( "click", function( evt ) {

				evt.stopImmediatePropagation();
				
				var $this = $( this ),
					$parent = $this.parent(),
					countryId = $parent.attr( "data-id" );
				App.ChartModel.removeSelectedCountry( countryId );

			})	
			
		}

	});
	
	module.exports = App.Views.Form.SelectedCountriesSectionView;

})();
},{"./../../ui/App.Views.UI.ColorPicker.js":35}],34:[function(require,module,exports){
;( function() {
	
	"use strict";

	App.Views.Form.TimeSectionView = Backbone.View.extend({

		el: "#form-view #data-tab .time-section",
		events: {
			"change [name='dynamic-time']": "onDynamicTime",
			"change [name='chart-time-from']": "onChartTimeChange",
			"change [name='chart-time-to']": "onChartTimeChange"
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			this.dispatcher.on( "dimension-update", this.onDimensionUpdate, this );
			
			App.AvailableTimeModel.on( "change", this.onAvailableTimeChange, this );

			this.render();

		},

		render: function() {

			var that = this;

			this.$entitiesSelect = this.$el.find( ".countries-select" );
			this.$chartTime = this.$el.find( "[name='chart-time']" );
			this.$dynamicTime = this.$el.find( "[name='dynamic-time']" );
			this.$irs = this.$el.find( ".irs" );

			this.$chartTimeFrom = this.$el.find( "[name='chart-time-from']" );
			this.$chartTimeTo = this.$el.find( "[name='chart-time-to']" );

			this.$chartTime.ionRangeSlider({
				type: "double",
				min: 0,
				max: 2015,
				from: 1000,
				to: 1500,
				grid: true,
				onChange: function( data ) {
					that.$chartTimeFrom.val(data.from);
					that.$chartTimeTo.val(data.to);
					App.ChartModel.set( "chart-time", [data.from, data.to] );
				}
			});
			setTimeout( function() {
				if( hasDynamicTime ) {
					that.$irs.addClass( "disabled" );
				}
			}, 250 );

			var hasDynamicTime = ( App.ChartModel.get( "chart-time" ) )? false: true;
			if( !hasDynamicTime ) {
				var chartTime = App.ChartModel.get( "chart-time" );
				this.updateTime( chartTime[ 0 ], chartTime[ 1 ] );
			} else if( App.AvailableTimeModel.get( "min" ) && App.AvailableTimeModel.get( "max" ) ) {
				this.updateTime( App.AvailableTimeModel.get( "min" ), App.AvailableTimeModel.get( "max" ) );
				if( hasDynamicTime ) {
					this.$dynamicTime.prop( "checked", true );
					this.$chartTimeFrom.prop( "readonly", true);
					this.$chartTimeTo.prop( "readonly", true);
				}
			}
			
		},

		onAvailableTimeChange: function() {
			this.updateTime( App.AvailableTimeModel.get( "min" ), App.AvailableTimeModel.get( "max" ) );
		},

		onDimensionUpdate: function() {

			var dimensionString = App.ChartModel.get( "chart-dimensions" ),
				timeFrom = Infinity,
				timeTo = -Infinity,
				limitTime = true;

			if( !$.isEmptyObject( dimensionString ) ) {

				var dimensions = $.parseJSON( dimensionString );
				$.each( dimensions, function( i, v ) {
					if( v.period === "single" && v.mode === "specific" ) {
						//get min/max local
						var year = parseInt( v.targetYear, 10 ),
							localFrom = year - parseInt( v.tolerance, 10 ),
							localTo = year + parseInt( v.tolerance, 10 );
						timeFrom = Math.min( localFrom, timeFrom );
						timeTo = Math.max( localTo, timeTo );
					} else {
						//set flag that there is some dimension that cannot be limited automaticaly
						limitTime = false;
					}
				} );

			}

			//if something has changed, set time interval only to necessary
			if( limitTime && timeFrom < Infinity && timeTo > -Infinity ) {
				this.updateTime( timeFrom, timeTo );
				App.ChartModel.set( "chart-time", [ timeFrom, timeTo ] );
			}

		},

		updateTime: function( from, to ) {

			var slider = $( "[name=chart-time]" ).data( "ionRangeSlider" );
			slider.update( {from: from, to: to } );
			//updating slider, so have some set values and disabling dynamic table
			this.$dynamicTime.prop( "checked", false );
			this.$irs.removeClass( "disabled" );
			this.$chartTimeFrom.val(from);
			this.$chartTimeTo.val(to);

		},

		onDynamicTime: function() {

			if( this.$dynamicTime.is( ":checked" ) ) {
				this.$irs.addClass( "disabled" );
				this.$chartTimeFrom.prop( "readonly", true);
				this.$chartTimeTo.prop( "readonly", true);
			} else {
				this.$irs.removeClass( "disabled" );
				this.$chartTimeFrom.prop( "readonly", false);
				this.$chartTimeTo.prop( "readonly", false);
			}
		
		},

		onChartTimeChange: function( evt ) {
			evt.preventDefault();
			var slider = $( "[name=chart-time]" ).data( "ionRangeSlider" ),
				from = this.$chartTimeFrom.val(),
				to = this.$chartTimeTo.val();
			App.ChartModel.set( "chart-time", [from, to] );
			slider.update( {from: from, to: to } );
		}


	});

	module.exports = App.Views.Form.TimeSectionView;

})();
},{}],35:[function(require,module,exports){
;( function() {

	"use strict";

	var that;

	App.Views.UI.ColorPicker = function() {
		that = this;
		this.$div = null;
	
		this.init = function( $el, data ) {

			var lisString = "",
				$lis;

			if( !data ) {
				data = App.Views.UI.ColorPicker.COLOR_ARRAY;
			}

			//DOM stuff			
			$.each( data, function( i, d ) {
				lisString += "<li data-value='" + d + "' style='background-color:" + d + "'></li>";
			} );
			this.$div = $( "<div class='" + App.Views.UI.ColorPicker.WRAPPER_CLASS + "'><ul class='no-bullets'>" + lisString + "</ul></div>" );
			$el.append( this.$div );
			$lis = this.$div.find( "li" );

			//prevent movement
			this.$div.on( "mousedown", function( evt ) {
				evt.stopImmediatePropagation();
			} );
			$lis.on( "mousedown", this.onMouseDown );
		};

		this.onMouseDown = function( evt ) {
			evt.stopImmediatePropagation();
			var value = $( this ).attr( "data-value" );
			if( that.onSelected ) {
				that.onSelected.apply( that, [ value ] );
			}
		};

		this.close = function() {
			this.$div.remove();
		};

	};

	//App.Views.UI.ColorPicker.COLOR_ARRAY = [ "#A52A2A", "#FF4040", "#EE3B3B", "#CD3333", "#5F9EA0", "#98F5FF", "#8EE5EE", "#7AC5CD", "#53868B", "#FFD700", "#EEC900", "#CDAD00", "#8B7500"  ];
	App.Views.UI.ColorPicker.COLOR_ARRAY = [ "#B0171F", "#DC143C", "#FF3E96", "#EE3A8C", "#DA70D6", "#FF83FA", "#8A2BE2", "#9B30FF", "#6959CD", "#473C8B", "#436EEE", "#3A5FCD", "#5CACEE", "#4F94CD", "#7AC5CD", "#53868B", "#66CDAA", "#458B74", "#43CD80", "#2E8B57", "#66CD00", "#CDCD00", "#FFEC8B", "#FFD700", "#FFC125", "#FFA500", "#FF7F50", "#FF4500", "#5B5B5B", "#8E8E8E" ];
	App.Views.UI.ColorPicker.WRAPPER_CLASS = "popup-picker-wrapper";
	
	module.exports = App.Views.UI.ColorPicker;

})();
},{}],36:[function(require,module,exports){
;( function() {

	"use strict";

	var that;

	App.Views.UI.SelectVarPopup = function() {

		that = this;
		this.$div = null;

	};

	App.Views.UI.SelectVarPopup.prototype = {

		init: function( options ) {

			this.dispatcher = options.dispatcher;

			this.$win = $( window );
			this.$el = $( ".select-var-popup" );
			this.$closeBtn = this.$el.find( ".close" );
			this.$saveBtn = this.$el.find( ".btn-primary" );
			this.$cancelBtn = this.$el.find( ".btn-default" );
			
			this.$variableWrapper = this.$el.find( ".variable-wrapper" );
			this.$categorySelect = this.$el.find( "[name=category-id]" );
			this.$subcategorySelect = this.$el.find( "[name=subcategory-id]" );
				
			this.$selectWrapper = this.$el.find( ".search-input-wrapper" );
			this.$selectVarSearch = this.$el.find( "[name=select_var_search]" );
			this.$selectResults = this.$el.find( ".search-results" );
			this.$searchIcon = this.$selectWrapper.find( ".fa-search" );
			this.$preloaderIcon = this.$selectWrapper.find( ".fa-spinner" );
			this.$clearIcon = this.$selectWrapper.find( ".fa-times" );
			this.$preloaderIcon.hide();
			this.$clearIcon.hide();

			this.$chartVariable = this.$el.find( "[name=chart-variable]" );
			
			this.$closeBtn.on( "click", $.proxy( this.onCloseBtn, this ) );
			this.$saveBtn.on( "click", $.proxy( this.onSaveBtn, this ) );
			this.$cancelBtn.on( "click", $.proxy( this.onCancelBtn, this ) );
			
			this.$selectVarSearch.on( "input", $.proxy( this.onSearchInput, this ) );
			this.$selectVarSearch.on( "focusin", $.proxy( this.onSearchFocusIn, this ) );
			this.$selectVarSearch.on( "focusout", $.proxy( this.onSearchFocusOut, this ) );

			this.$clearIcon.on( "click", $.proxy( this.onClearBtn, this ) );

			App.SearchDataCollection.on( "fetched", $.proxy( this.onSearchFetched, this ) );

		},

		show: function() {

			this.$el.show();

		},

		hide: function() {

			this.$el.hide();

		},

		onCloseBtn: function( evt ) {

			evt.preventDefault();
			this.hide();

		},

		onSaveBtn: function( evt ) {

			evt.preventDefault();
			
			//trigger event only if something selected
			if( this.$chartVariable.val() > 0 ) {
				
				var varId = this.$chartVariable.val(),
					varUnit = this.$chartVariable.find( "option:selected" ).attr( "data-unit" ),
					varName = this.$chartVariable.find( "option:selected" ).text();

				var variable = new App.Models.ChartVariableModel( { id:varId, name: varName, unit: varUnit } );
				App.ChartVariablesCollection.add( variable );
				//App.ChartModel.updateVariables( { id:varId, name: varName } );
				
				this.hide();

			}

		},

		onCancelBtn: function( evt ) {

			evt.preventDefault();
			this.hide();

		},

		onSearchInput: function( evt ) {
			
			var $input = $( evt.currentTarget ),
				searchTerm = $input.val();

			if( searchTerm.length >= 2 ) {
				
				this.$clearIcon.hide();
				this.$searchIcon.hide();
				this.$preloaderIcon.show();

				App.SearchDataCollection.search( searchTerm );

			} else {

				//clear selection
				this.$selectResults.empty();
				this.$selectResults.hide();
				
				this.$clearIcon.hide();
				this.$searchIcon.show();

			}

		},

		onSearchFetched: function( evt ) {

			this.$clearIcon.show();
			this.$searchIcon.hide();
			this.$preloaderIcon.hide();

			this.$selectResults.empty();
			this.$selectResults.show();
			
			var results = App.SearchDataCollection.models,
				htmlString = "";
			_.each( results, function( result ) {
				htmlString += "<li data-cat-id='" + result.get( "fk_dst_cat_id" ) + "' data-subcat-id='" + result.get( "fk_dst_subcat_id" ) + "' data-var-id='" + result.get( "id" ) + "'>" + result.get( "name" ) + "</li>";
			} );

			this.$selectResults.append( $( htmlString ) );
			this.$lis = this.$selectResults.find( "li" );
			
			var that = this;
			this.$lis.on( "mousedown", function( evt ) {

				that.selectItem( $( evt.currentTarget ) );
				
			} );

		},

		selectItem: function( $li ) {

			var that = this,
				varId = $li.attr( "data-var-id" ),
				catId = $li.attr( "data-cat-id" ),
				subcatId = $li.attr( "data-subcat-id" );

			that.$categorySelect.find( "option[value=" + catId + "]" ).prop( "selected", true );
			that.$categorySelect.trigger( "change" );
			that.$subcategorySelect.find( "option[value=" + subcatId + "]" ).prop( "selected", true );
			that.$subcategorySelect.trigger( "change" );

			that.$variableWrapper.show();
			that.$chartVariable.find( "option[value=" + varId + "]" ).prop( "selected", true );

		},

		onSearchFocusIn: function() {
			//show select only if some results
			if( this.$selectResults.find( "li" ).length ) {
				this.$selectResults.show();
			}
			this.$keyDownHandler = $.proxy( this.onKeyDown, this );
			this.$win.on( "keydown", this.$keyDownHandler );
		},

		onSearchFocusOut: function( evt ) {
			that.$selectResults.hide();
			this.$win.off( "keydown", this.$keyDownHandler );
		},

		onKeyDown: function( evt ) {

			if( !this.$lis || !this.$lis.length ) {
				return;
			}

			var selectedIndex = this.$lis.filter( ".selected" ).index(),
				keyCode = evt.keyCode;
			
			if( keyCode === 40 || keyCode === 38 ) {

				if( keyCode === 40 ) {
					selectedIndex++;
					if( selectedIndex >= this.$lis.length ) {
						selectedIndex = 0;
					}
				} else if( keyCode === 38 ) {
					selectedIndex--;
				}

				this.$lis.removeClass( "selected" );
				this.$lis.eq( selectedIndex ).addClass( "selected" );
			
			} else if( keyCode === 13 ) {

				this.selectItem( this.$lis.eq( selectedIndex ) );
				this.$selectResults.hide();

			}

		},

		onClearBtn: function() {
			this.$selectVarSearch.val( "" );
			this.$selectVarSearch.trigger( "input" );
		}

	};

	module.exports = App.Views.UI.SelectVarPopup;

})();

},{}],37:[function(require,module,exports){
;( function() {

	"use strict";

	var that;

	App.Views.UI.SettingsVarPopup = function() {

		that = this;
		this.$div = null;

	};

	App.Views.UI.SettingsVarPopup.prototype = {

		init: function( options ) {

			this.dispatcher = options.dispatcher;

			//will be filled when opening popup
			this.variableId = -1;

			//flag for 
			this.valid = true;

			this.$el = $( ".settings-var-popup" );
			this.$closeBtn = this.$el.find( ".close" );
			this.$saveBtn = this.$el.find( ".btn-primary" );
			this.$cancelBtn = this.$el.find( ".btn-default" );

			this.$digitInputs = this.$el.find( ".digit-input" );
			this.$periodInputs = this.$el.find( "[name=period]" );
			this.$singleInputs = this.$el.find( "[name=single]" );
			this.$allInputs = this.$el.find( "[name=all]" );
			this.$contentAll = this.$el.find( ".settings-var-content-all" );
			this.$contentSingle = this.$el.find( ".settings-var-content-single" );
				
			this.$contentSingleSpecific = this.$el.find( ".settings-var-single-specific-content" );
			this.$contentSingleLatest = this.$el.find( ".settings-var-single-latest-content" );

			this.$contentAllClosest = this.$el.find( ".settings-var-all-closest-content" );
			this.$contentAllLatest = this.$el.find( ".settings-var-all-latest-content" );

			this.$closeBtn.on( "click", $.proxy( this.onCloseBtn, this ) );
			this.$saveBtn.on( "click", $.proxy( this.onSaveBtn, this ) );
			this.$cancelBtn.on( "click", $.proxy( this.onCancelBtn, this ) );
			
			this.$digitInputs.on( "change", $.proxy( this.onDigitInputs, this ) );
			this.$periodInputs.on( "change", $.proxy( this.onPeriodInputs, this ) );
			this.$singleInputs.on( "change", $.proxy( this.onSingleInputs, this ) );
			this.$allInputs.on( "change", $.proxy( this.onAllInputs, this ) );

		},

		onDigitInputs: function( evt ) {

			evt.preventDefault();

			var $input = $( evt.currentTarget ),
				value = $input.val();

			if( isNaN( value ) ) {
				$input.parent().addClass( "has-error" );
			} else {
				$input.parent().removeClass( "has-error" );
			}

		},

		onPeriodInputs: function( evt ) {

			var $input = $( evt.currentTarget );
			if( $input.val() === "all" ) {
				this.$contentAll.show();
				this.$contentSingle.hide();
			} else if( $input.val() === "single" ) {
				this.$contentAll.hide();
				this.$contentSingle.show();
			}

		},

		onSingleInputs: function( evt ) {

			var $input = $( evt.currentTarget );
			if( $input.val() === "specific" ) {
				this.$contentSingleSpecific.show();
				this.$contentSingleLatest.hide();
			} else if( $input.val() === "latest" ) {
				this.$contentSingleSpecific.hide();
				this.$contentSingleLatest.show();
			}

		},

		onAllInputs: function( evt ) {

			var $input = $( evt.currentTarget );
			if( $input.val() === "closest" ) {
				this.$contentAllClosest.show();
				this.$contentAllLatest.hide();
			} else if( $input.val() === "latest" ) {
				this.$contentAllClosest.hide();
				this.$contentAllLatest.show();
			}

		},

		show: function( $variableLabel ) {

			this.variableId = $variableLabel.attr( "data-variable-id" );
			
			//repopulate from element
			var period = $variableLabel.attr( "data-period" ),
				mode = $variableLabel.attr( "data-mode" ),
				targetYear = $variableLabel.attr( "data-target-year" ),
				tolerance = $variableLabel.attr( "data-tolerance" ),
				maximumAge = $variableLabel.attr( "data-maximum-age" );

			//prefill values (regardless of what is selected)
			this.$el.find( "[name=single-year]" ).val( targetYear );
			this.$el.find( "[name=single-tolerance]" ).val( tolerance );
			this.$el.find( "[name=single-maximum-age]" ).val( maximumAge );
			this.$el.find( "[name=all-tolerance]" ).val( tolerance );
			this.$el.find( "[name=all-maximum-age]" ).val( maximumAge );

			//remove all validation errors
			this.$el.find( ".has-error" ).removeClass( "has-error" );

			//based on set values, appear correct values
			if( period ) {
				
				if( period === "single" ) {

					this.$periodInputs.filter( "[value=single]" ).prop( "checked", true );

					this.$contentAll.hide();
					this.$contentSingle.show();

					if( mode === "specific" ) {

						this.$singleInputs.filter( "[value=specific]" ).prop( "checked", true );
						this.$contentSingleSpecific.show();
						this.$contentSingleLatest.hide();
						
					} else if( mode === "latest" ) {

						this.$singleInputs.filter( "[value=latest]" ).prop( "checked", true );
						this.$contentSingleSpecific.hide();
						this.$contentSingleLatest.show();
						
					}

				} else if( period === "all" ) {
					
					this.$periodInputs.filter( "[value=all]" ).prop( "checked", true );

					this.$contentAll.show();
					this.$contentSingle.hide();

					if( mode === "closest" ) {
						
						this.$allInputs.filter( "[value=closest]" ).prop( "checked", true );
						this.$contentAllClosest.show();
						this.$contentAllLatest.hide();
					
					} else if( mode === "latest" ) {
						
						this.$allInputs.filter( "[value=latest]" ).prop( "checked", true );
						this.$contentAllClosest.hide();
						this.$contentAllLatest.show();
						
					}

				}

			}

			this.$el.show();

		},

		hide: function() {

			this.$el.hide();

		},

		onCloseBtn: function( evt ) {

			evt.preventDefault();
			this.hide();

		},

		onSaveBtn: function( evt ) {

			evt.preventDefault();
			
			//validate
			var $invalidInputs = this.$el.find( ".has-error" );
			if( $invalidInputs.length ) {
				alert( "Please input numbers!" );
				return false;
			}

			// structure
			// - period
			//		- single 
			//			- specific
			//				- year
			//				- tolerance
			//			- latest
			//				- maximum age				
			//		- all
			//			- closest
			//				- tolerance
			//			- latest
			//				- maximum age  

			//  attributes
			//	- data-period [single|all] 
			//	- data-mode [specific|latest|closest] 
			//	- data-target-year [number] 
			//	- data-tolerance [number] 
			//	- data-maximum-age [number] 

			var data = { variableId: this.variableId };
			data.period = this.$periodInputs.filter( ":checked" ).val();

			if( data.period === "single" ) {

				data.mode = this.$singleInputs.filter( ":checked" ).val();

				if( data.mode === "specific" ) {
					data[ "target-year" ] = this.$el.find( "[name=single-year]" ).val();
					data.tolerance = this.$el.find( "[name=single-tolerance]" ).val();
				} else if( data.mode === "latest" ) {
					data[ "maximum-age" ] = this.$el.find( "[name=single-maximum-age]" ).val();
				}


			} else if( data.period === "all" ) {

				data.mode = this.$allInputs.filter( ":checked" ).val();

				if( data.mode === "closest" ) {
					data.tolerance = this.$el.find( "[name=all-tolerance]" ).val();
				} else if( data.mode === "latest" ) {
					data[ "maximum-age" ] = this.$el.find( "[name=all-maximum-age]" ).val();
				}

			}

			this.dispatcher.trigger( "dimension-setting-update", data );

		},

		onCancelBtn: function( evt ) {

			evt.preventDefault();
			this.hide();

		}

	};

	module.exports = App.Views.UI.SettingsVarPopup;

})();

},{}],38:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9sYXJhdmVsLWVsaXhpci1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC9BcHAuVXRpbHMuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC9Gb3JtQXBwLmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvY29sbGVjdGlvbnMvQXBwLkNvbGxlY3Rpb25zLkF2YWlsYWJsZUVudGl0aWVzQ29sbGVjdGlvbi5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL2NvbGxlY3Rpb25zL0FwcC5Db2xsZWN0aW9ucy5DaGFydFZhcmlhYmxlc0NvbGxlY3Rpb24uanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC9jb2xsZWN0aW9ucy9BcHAuQ29sbGVjdGlvbnMuU2VhcmNoRGF0YUNvbGxlY3Rpb24uanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC9tb2RlbHMvQXBwLk1vZGVscy5BdmFpbGFibGVUaW1lTW9kZWwuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC9tb2RlbHMvQXBwLk1vZGVscy5DaGFydERhdGFNb2RlbC5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL21vZGVscy9BcHAuTW9kZWxzLkNoYXJ0RGltZW5zaW9uc01vZGVsLmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvbW9kZWxzL0FwcC5Nb2RlbHMuQ2hhcnRNb2RlbC5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL21vZGVscy9BcHAuTW9kZWxzLkNoYXJ0VmFyaWFibGVNb2RlbC5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL21vZGVscy9BcHAuTW9kZWxzLkVudGl0eU1vZGVsLmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvQXBwLlZpZXdzLkNoYXJ0Vmlldy5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL0FwcC5WaWV3cy5Gb3JtLmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvQXBwLlZpZXdzLkZvcm1WaWV3LmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvY2hhcnQvQXBwLlZpZXdzLkNoYXJ0LkNoYXJ0VGFiLmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvY2hhcnQvQXBwLlZpZXdzLkNoYXJ0LkRhdGFUYWIuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy9jaGFydC9BcHAuVmlld3MuQ2hhcnQuSGVhZGVyLmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvY2hhcnQvQXBwLlZpZXdzLkNoYXJ0LkxlZ2VuZC5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL2NoYXJ0L0FwcC5WaWV3cy5DaGFydC5NYXBUYWIuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy9jaGFydC9BcHAuVmlld3MuQ2hhcnQuU2NhbGVTZWxlY3RvcnMuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy9jaGFydC9BcHAuVmlld3MuQ2hhcnQuU291cmNlc1RhYi5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL2NoYXJ0L21hcC9BcHAuVmlld3MuQ2hhcnQuTWFwLk1hcENvbnRyb2xzLmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvZm9ybS9BcHAuVmlld3MuRm9ybS5BeGlzVGFiVmlldy5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL2Zvcm0vQXBwLlZpZXdzLkZvcm0uQmFzaWNUYWJWaWV3LmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvZm9ybS9BcHAuVmlld3MuRm9ybS5EZXNjcmlwdGlvblRhYlZpZXcuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy9mb3JtL0FwcC5WaWV3cy5Gb3JtLkV4cG9ydFRhYlZpZXcuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy9mb3JtL0FwcC5WaWV3cy5Gb3JtLk1hcFRhYlZpZXcuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy9mb3JtL0FwcC5WaWV3cy5Gb3JtLlN0eWxpbmdUYWJWaWV3LmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvZm9ybS9iYXNpY1RhYi9BcHAuVmlld3MuRm9ybS5DaGFydFR5cGVTZWN0aW9uVmlldy5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL2Zvcm0vZGF0YVRhYi9BcHAuVmlld3MuRm9ybS5BZGREYXRhU2VjdGlvblZpZXcuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy9mb3JtL2RhdGFUYWIvQXBwLlZpZXdzLkZvcm0uRGltZW5zaW9uc1NlY3Rpb25WaWV3LmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvZm9ybS9kYXRhVGFiL0FwcC5WaWV3cy5Gb3JtLkVudGl0aWVzU2VjdGlvblZpZXcuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy9mb3JtL2RhdGFUYWIvQXBwLlZpZXdzLkZvcm0uU2VsZWN0ZWRDb3VudHJpZXNTZWN0aW9uVmlldy5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL2Zvcm0vZGF0YVRhYi9BcHAuVmlld3MuRm9ybS5UaW1lU2VjdGlvblZpZXcuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy91aS9BcHAuVmlld3MuVUkuQ29sb3JQaWNrZXIuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy91aS9BcHAuVmlld3MuVUkuU2VsZWN0VmFyUG9wdXAuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy91aS9BcHAuVmlld3MuVUkuU2V0dGluZ3NWYXJQb3B1cC5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL3VpL0FwcC5WaWV3cy5VSS5WYXJpYWJsZVNlbGVjdHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbnNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDck1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlhQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM2xCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcldBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6TUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0tBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3REQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbk9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCI7KCBmdW5jdGlvbigpIHtcblxuXHRcInVzZSBzdHJpY3RcIjtcblx0XG5cdEFwcC5VdGlscy5tYXBEYXRhID0gZnVuY3Rpb24oIHJhd0RhdGEsIHRyYW5zcG9zZWQgKSB7XG5cblx0XHR2YXIgZGF0YSA9IFtdLFxuXHRcdFx0ZGF0YUJ5SWQgPSBbXSxcblx0XHRcdGNvdW50cnlJbmRleCA9IDE7XG5cblx0XHQvL2RvIHdlIGhhdmUgZW50aXRpZXMgaW4gcm93cyBhbmQgdGltZXMgaW4gY29sdW1ucz9cdFxuXHRcdGlmKCAhdHJhbnNwb3NlZCApIHtcblx0XHRcdC8vbm8sIHdlIGhhdmUgdG8gc3dpdGNoIHJvd3MgYW5kIGNvbHVtbnNcblx0XHRcdHJhd0RhdGEgPSBBcHAuVXRpbHMudHJhbnNwb3NlKCByYXdEYXRhICk7XG5cdFx0fVxuXHRcdFxuXHRcdC8vZXh0cmFjdCB0aW1lIGNvbHVtblxuXHRcdHZhciB0aW1lQXJyID0gcmF3RGF0YS5zaGlmdCgpO1xuXHRcdC8vZ2V0IHJpZCBvZiBmaXJzdCBpdGVtIChsYWJlbCBvZiB0aW1lIGNvbHVtbikgXG5cdFx0dGltZUFyci5zaGlmdCgpO1xuXHRcblx0XHRmb3IoIHZhciBpID0gMCwgbGVuID0gcmF3RGF0YS5sZW5ndGg7IGkgPCBsZW47IGkrKyApIHtcblxuXHRcdFx0dmFyIHNpbmdsZVJvdyA9IHJhd0RhdGFbIGkgXSxcblx0XHRcdFx0Y29sTmFtZSA9IHNpbmdsZVJvdy5zaGlmdCgpO1xuXHRcdFx0XHRcblx0XHRcdC8vb21taXQgcm93cyB3aXRoIG5vIGNvbE5tYWVcblx0XHRcdGlmKCBjb2xOYW1lICkge1xuXHRcdFx0XHR2YXIgc2luZ2xlRGF0YSA9IFtdO1xuXHRcdFx0XHRfLmVhY2goIHNpbmdsZVJvdywgZnVuY3Rpb24oIHZhbHVlLCBpICkge1xuXHRcdFx0XHRcdC8vY2hlY2sgd2UgaGF2ZSB2YWx1ZVxuXHRcdFx0XHRcdGlmKCB2YWx1ZSAhPT0gXCJcIiApIHtcblx0XHRcdFx0XHRcdHNpbmdsZURhdGEucHVzaCggeyB4OiB0aW1lQXJyW2ldLCB5OiAoICFpc05hTiggdmFsdWUgKSApPyArdmFsdWU6IHZhbHVlIH0gKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gKTtcblxuXHRcdFx0XHQvL2NvbnN0cnVjdCBlbnRpdHkgb2JqXG5cdFx0XHRcdHZhclx0ZW50aXR5T2JqID0ge1xuXHRcdFx0XHRcdGlkOiBpLFxuXHRcdFx0XHRcdGtleTogY29sTmFtZSxcblx0XHRcdFx0XHR2YWx1ZXM6IHNpbmdsZURhdGFcblx0XHRcdFx0fTtcblx0XHRcdFx0ZGF0YS5wdXNoKCBlbnRpdHlPYmogKTtcblx0XHRcdH1cblxuXHRcdH1cblxuXHRcdHJldHVybiBkYXRhO1xuXG5cdH0sXG5cblx0QXBwLlV0aWxzLm1hcFNpbmdsZVZhcmlhbnREYXRhID0gZnVuY3Rpb24oIHJhd0RhdGEsIHZhcmlhYmxlTmFtZSApIHtcblxuXHRcdHZhciB2YXJpYWJsZSA9IHtcblx0XHRcdG5hbWU6IHZhcmlhYmxlTmFtZSxcblx0XHRcdHZhbHVlczogQXBwLlV0aWxzLm1hcERhdGEoIHJhd0RhdGEsIHRydWUgKVxuXHRcdH07XG5cdFx0cmV0dXJuIFt2YXJpYWJsZV07XG5cblx0fSxcblxuXHQvKkFwcC5VdGlscy5tYXBNdWx0aVZhcmlhbnREYXRhID0gZnVuY3Rpb24oIHJhd0RhdGEsIGVudGl0eU5hbWUgKSB7XG5cdFx0XG5cdFx0Ly90cmFuc2Zvcm0gbXVsdGl2YXJpYW50IGludG8gc3RhbmRhcmQgZm9ybWF0ICggdGltZSwgZW50aXR5IClcblx0XHR2YXIgdmFyaWFibGVzID0gW10sXG5cdFx0XHR0cmFuc3Bvc2VkID0gcmF3RGF0YSwvL0FwcC5VdGlscy50cmFuc3Bvc2UoIHJhd0RhdGEgKSxcblx0XHRcdHRpbWVBcnIgPSB0cmFuc3Bvc2VkLnNoaWZ0KCk7XG5cblx0XHQvL2dldCByaWQgb2YgZmlyc3QgaXRlbSAobGFiZWwgb2YgdGltZSBjb2x1bW4pIFxuXHRcdC8vdGltZUFyci5zaGlmdCgpO1xuXHRcdFxuXHRcdF8uZWFjaCggdHJhbnNwb3NlZCwgZnVuY3Rpb24oIHZhbHVlcywga2V5LCBsaXN0ICkge1xuXG5cdFx0XHQvL2dldCB2YXJpYWJsZSBuYW1lIGZyb20gZmlyc3QgY2VsbCBvZiBjb2x1bW5zXG5cdFx0XHR2YXIgdmFyaWFibGVOYW1lID0gdmFsdWVzLnNoaWZ0KCk7XG5cdFx0XHQvL2FkZCBlbnRpdHkgbmFtZSBhcyBmaXJzdCBjZWxsXG5cdFx0XHR2YWx1ZXMudW5zaGlmdCggZW50aXR5TmFtZSApO1xuXHRcdFx0Ly9jb25zdHJ1Y3QgYXJyYXkgZm9yIG1hcHBpbmcsIG5lZWQgdG8gZGVlcCBjb3B5IHRpbWVBcnJcblx0XHRcdHZhciBsb2NhbFRpbWVBcnIgPSAkLmV4dGVuZCggdHJ1ZSwgW10sIHRpbWVBcnIpO1xuXHRcdFx0dmFyIGRhdGFUb01hcCA9IFsgbG9jYWxUaW1lQXJyLCB2YWx1ZXMgXTtcblx0XHRcdC8vY29uc3RydWN0IG9iamVjdFxuXHRcdFx0dmFyIHZhcmlhYmxlID0ge1xuXHRcdFx0XHRuYW1lOiB2YXJpYWJsZU5hbWUsXG5cdFx0XHRcdHZhbHVlczogQXBwLlV0aWxzLm1hcERhdGEoIGRhdGFUb01hcCwgdHJ1ZSApXG5cdFx0XHR9O1xuXHRcdFx0dmFyaWFibGVzLnB1c2goIHZhcmlhYmxlICk7XG5cblx0XHR9ICk7XG5cblx0XHRyZXR1cm4gdmFyaWFibGVzO1xuXG5cdH0sKi9cblxuXHRBcHAuVXRpbHMubWFwTXVsdGlWYXJpYW50RGF0YSA9IGZ1bmN0aW9uKCByYXdEYXRhICkge1xuXHRcdFxuXHRcdHZhciB2YXJpYWJsZXMgPSBbXSxcblx0XHRcdHRyYW5zcG9zZWQgPSByYXdEYXRhLFxuXHRcdFx0aGVhZGVyQXJyID0gdHJhbnNwb3NlZC5zaGlmdCgpO1xuXG5cdFx0Ly9nZXQgcmlkIG9mIGVudGl0eSBhbmQgeWVhciBjb2x1bW4gbmFtZVxuXHRcdGhlYWRlckFyciA9IGhlYWRlckFyci5zbGljZSggMiApO1xuXG5cdFx0dmFyIHZhclBlclJvd0RhdGEgPSBBcHAuVXRpbHMudHJhbnNwb3NlKCB0cmFuc3Bvc2VkICksXG5cdFx0XHRlbnRpdGllc1JvdyA9IHZhclBlclJvd0RhdGEuc2hpZnQoKSxcblx0XHRcdHRpbWVzUm93ID0gdmFyUGVyUm93RGF0YS5zaGlmdCgpO1xuXG5cdFx0Xy5lYWNoKCB2YXJQZXJSb3dEYXRhLCBmdW5jdGlvbiggdmFsdWVzLCB2YXJJbmRleCApIHtcblx0XHRcdFxuXHRcdFx0dmFyIGVudGl0aWVzID0ge307XG5cdFx0XHQvL2l0ZXJhdGUgdGhyb3VnaCBhbGwgdmFsdWVzIGZvciBnaXZlbiB2YXJpYWJsZVxuXHRcdFx0Xy5lYWNoKCB2YWx1ZXMsIGZ1bmN0aW9uKCB2YWx1ZSwga2V5ICkge1xuXHRcdFx0XHR2YXIgZW50aXR5ID0gZW50aXRpZXNSb3dbIGtleSBdLFxuXHRcdFx0XHRcdHRpbWUgPSB0aW1lc1Jvd1sga2V5IF07XG5cdFx0XHRcdGlmKCBlbnRpdHkgJiYgdGltZSApIHtcblx0XHRcdFx0XHQvL2RvIGhhdmUgYWxyZWFkeSBlbnRpdHkgZGVmaW5lZD9cblx0XHRcdFx0XHRpZiggIWVudGl0aWVzWyBlbnRpdHkgXSApIHtcblx0XHRcdFx0XHRcdGVudGl0aWVzWyBlbnRpdHkgXSA9IHtcblx0XHRcdFx0XHRcdFx0aWQ6IGtleSxcblx0XHRcdFx0XHRcdFx0a2V5OiBlbnRpdHksXG5cdFx0XHRcdFx0XHRcdHZhbHVlczogW11cblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVudGl0aWVzWyBlbnRpdHkgXS52YWx1ZXMucHVzaCggeyB4OiB0aW1lLCB5OiAoICFpc05hTiggdmFsdWUgKSApPyArdmFsdWU6IHZhbHVlIH0gKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXG5cdFx0XHQvL2hhdmUgZGF0YSBmb3IgYWxsIGVudGl0aWVzLCBqdXN0IGNvbnZlcnQgdGhlbSB0byBhcnJheVxuXHRcdFx0dmFyIHZhclZhbHVlcyA9IF8ubWFwKCBlbnRpdGllcywgZnVuY3Rpb24oIHZhbHVlICkgeyByZXR1cm4gdmFsdWU7IH0gKTtcblx0XHRcdFxuXHRcdFx0dmFyIHZhcmlhYmxlID0ge1xuXHRcdFx0XHRuYW1lOiBoZWFkZXJBcnJbIHZhckluZGV4IF0sXG5cdFx0XHRcdHZhbHVlczogdmFyVmFsdWVzXG5cdFx0XHR9O1xuXHRcdFx0dmFyaWFibGVzLnB1c2goIHZhcmlhYmxlICk7XG5cblx0XHR9ICk7XG5cblx0XHRyZXR1cm4gdmFyaWFibGVzO1xuXG5cdH0sXG5cblxuXHRBcHAuVXRpbHMudHJhbnNwb3NlID0gZnVuY3Rpb24oIGFyciApIHtcblx0XHR2YXIga2V5cyA9IF8ua2V5cyggYXJyWzBdICk7XG5cdFx0cmV0dXJuIF8ubWFwKCBrZXlzLCBmdW5jdGlvbiAoYykge1xuXHRcdFx0cmV0dXJuIF8ubWFwKCBhcnIsIGZ1bmN0aW9uKCByICkge1xuXHRcdFx0XHRyZXR1cm4gcltjXTtcblx0XHRcdH0gKTtcblx0XHR9KTtcblx0fSxcblxuXHRBcHAuVXRpbHMudHJhbnNmb3JtID0gZnVuY3Rpb24oKSB7XG5cblx0XHRjb25zb2xlLmxvZyggXCJhcHAudXRpbHMudHJhbnNmb3JtXCIgKTtcblxuXHR9LFxuXG5cdEFwcC5VdGlscy5lbmNvZGVTdmdUb1BuZyA9IGZ1bmN0aW9uKCBodG1sICkge1xuXG5cdFx0Y29uc29sZS5sb2coIGh0bWwgKTtcblx0XHR2YXIgaW1nU3JjID0gXCJkYXRhOmltYWdlL3N2Zyt4bWw7YmFzZTY0LFwiICsgYnRvYShodG1sKSxcblx0XHRcdGltZyA9IFwiPGltZyBzcmM9J1wiICsgaW1nU3JjICsgXCInPlwiOyBcblx0XHRcblx0XHQvL2QzLnNlbGVjdCggXCIjc3ZnZGF0YXVybFwiICkuaHRtbCggaW1nICk7XG5cblx0XHQkKCBcIi5jaGFydC13cmFwcGVyLWlubmVyXCIgKS5odG1sKCBpbWcgKTtcblxuXHRcdC8qdmFyIGNhbnZhcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoIFwiY2FudmFzXCIgKSxcblx0XHRcdGNvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dCggXCIyZFwiICk7XG5cblx0XHR2YXIgaW1hZ2UgPSBuZXcgSW1hZ2U7XG5cdFx0aW1hZ2Uuc3JjID0gaW1nc3JjO1xuXHRcdGltYWdlLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0Y29udGV4dC5kcmF3SW1hZ2UoaW1hZ2UsIDAsIDApO1xuXHRcdFx0dmFyIGNhbnZhc0RhdGEgPSBjYW52YXMudG9EYXRhVVJMKCBcImltYWdlL3BuZ1wiICk7XG5cdFx0XHR2YXIgcG5nSW1nID0gJzxpbWcgc3JjPVwiJyArIGNhbnZhc0RhdGEgKyAnXCI+JzsgXG5cdFx0XHRkMy5zZWxlY3QoXCIjcG5nZGF0YXVybFwiKS5odG1sKHBuZ2ltZyk7XG5cblx0XHRcdHZhciBhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImFcIik7XG5cdFx0XHRhLmRvd25sb2FkID0gXCJzYW1wbGUucG5nXCI7XG5cdFx0XHRhLmhyZWYgPSBjYW52YXNkYXRhO1xuXHRcdFx0YS5jbGljaygpO1xuXHRcdH07Ki9cblxuXG5cdH07XG5cblx0LyoqXG5cdCpcdFRJTUUgUkVMQVRFRCBGVU5DVElPTlNcblx0KiovXG5cblx0QXBwLlV0aWxzLm50aCA9IGZ1bmN0aW9uICggZCApIHtcblx0XHQvL2NvbnZlciB0byBudW1iZXIganVzdCBpbiBjYXNlXG5cdFx0ZCA9ICtkO1xuXHRcdGlmKCBkID4gMyAmJiBkIDwgMjEgKSByZXR1cm4gJ3RoJzsgLy8gdGhhbmtzIGtlbm5lYmVjXG5cdFx0c3dpdGNoKCBkICUgMTAgKSB7XG5cdFx0XHRjYXNlIDE6ICByZXR1cm4gXCJzdFwiO1xuXHRcdFx0Y2FzZSAyOiAgcmV0dXJuIFwibmRcIjtcblx0XHRcdGNhc2UgMzogIHJldHVybiBcInJkXCI7XG5cdFx0XHRkZWZhdWx0OiByZXR1cm4gXCJ0aFwiO1xuXHRcdH1cblx0fVxuXG5cdEFwcC5VdGlscy5jZW50dXJ5U3RyaW5nID0gZnVuY3Rpb24gKCBkICkge1xuXHRcdC8vY29udmVyIHRvIG51bWJlciBqdXN0IGluIGNhc2Vcblx0XHRkID0gK2Q7XG5cdFx0XG5cdFx0dmFyIGNlbnR1cnlOdW0gPSBNYXRoLmZsb29yKGQgLyAxMDApICsgMSxcblx0XHRcdGNlbnR1cnlTdHJpbmcgPSBjZW50dXJ5TnVtLnRvU3RyaW5nKCksXG5cdFx0XHRudGggPSBBcHAuVXRpbHMubnRoKCBjZW50dXJ5U3RyaW5nICk7XG5cblx0XHRyZXR1cm4gY2VudHVyeVN0cmluZyArIG50aCArIFwiIGNlbnR1cnlcIjtcblx0fVxuXG5cdEFwcC5VdGlscy5hZGRaZXJvcyA9IGZ1bmN0aW9uICggdmFsdWUgKSB7XG5cblx0XHR2YWx1ZSA9IHZhbHVlLnRvU3RyaW5nKCk7XG5cdFx0aWYoIHZhbHVlLmxlbmd0aCA8IDQgKSB7XG5cdFx0XHQvL2luc2VydCBtaXNzaW5nIHplcm9zXG5cdFx0XHR2YXIgdmFsdWVMZW4gPSB2YWx1ZS5sZW5ndGg7XG5cdFx0XHRmb3IoIHZhciB5ID0gMDsgeSA8IDQgLSB2YWx1ZUxlbjsgeSsrICkge1xuXHRcdFx0XHR2YWx1ZSA9IFwiMFwiICsgdmFsdWU7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB2YWx1ZTtcblx0XHRcblx0fVxuXG5cdEFwcC5VdGlscy5yb3VuZFRpbWUgPSBmdW5jdGlvbiggbW9tZW50VGltZSApIHtcblxuXHRcdGlmKCB0eXBlb2YgbW9tZW50VGltZS5mb3JtYXQgPT09IFwiZnVuY3Rpb25cIiApIHtcblx0XHRcdC8vdXNlIHNob3J0IGZvcm1hdCBteXNxbCBleHBlY3RzIC0gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8xMDUzOTE1NC9pbnNlcnQtaW50by1kYi1kYXRldGltZS1zdHJpbmdcblx0XHRcdHJldHVybiBtb21lbnRUaW1lLmZvcm1hdCggXCJZWVlZLU1NLUREXCIgKTtcblx0XHR9XG5cdFx0cmV0dXJuIG1vbWVudFRpbWU7XG5cblx0fVxuXG5cdC8qKiBcblx0KiBGT1JNIEhFTFBFUlxuXHQqKi9cblx0QXBwLlV0aWxzLkZvcm1IZWxwZXIudmFsaWRhdGUgPSBmdW5jdGlvbiggJGZvcm0gKSB7XG5cdFx0XG5cdFx0dmFyIG1pc3NpbmdFcnJvckxhYmVsID0gXCJQbGVhc2UgZW50ZXIgdmFsdWUuXCIsXG5cdFx0XHRlbWFpbEVycm9yTGFiZWwgPSAgXCJQbGVhc2UgZW50ZXIgdmFsaWRlIGVtYWlsLlwiLFxuXHRcdFx0bnVtYmVyRXJyb3JMYWJlbCA9IFwiUGxlYXNlIGVudGUgdmFsaWQgbnVtYmVyLlwiOyBcblxuXHRcdHZhciBpbnZhbGlkSW5wdXRzID0gW107XG5cdFx0XG5cdFx0Ly9nYXRoZXIgYWxsIGZpZWxkcyByZXF1aXJpbmcgdmFsaWRhdGlvblxuXHRcdHZhciAkcmVxdWlyZWRJbnB1dHMgPSAkZm9ybS5maW5kKCBcIi5yZXF1aXJlZFwiICk7XG5cdFx0aWYoICRyZXF1aXJlZElucHV0cy5sZW5ndGggKSB7XG5cblx0XHRcdCQuZWFjaCggJHJlcXVpcmVkSW5wdXRzLCBmdW5jdGlvbiggaSwgdiApIHtcblxuXHRcdFx0XHR2YXIgJGlucHV0ID0gJCggdGhpcyApO1xuXHRcdFx0XHRcblx0XHRcdFx0Ly9maWx0ZXIgb25seSB2aXNpYmxlXG5cdFx0XHRcdGlmKCAhJGlucHV0LmlzKCBcIjp2aXNpYmxlXCIgKSApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvL2NoZWNrIGZvciBlbXB0eVxuXHRcdFx0XHR2YXIgaW5wdXRWYWxpZCA9IEFwcC5VdGlscy5Gb3JtSGVscGVyLnZhbGlkYXRlUmVxdWlyZWRGaWVsZCggJGlucHV0ICk7XG5cdFx0XHRcdGlmKCAhaW5wdXRWYWxpZCApIHtcblx0XHRcdFx0XG5cdFx0XHRcdFx0QXBwLlV0aWxzLkZvcm1IZWxwZXIuYWRkRXJyb3IoICRpbnB1dCwgbWlzc2luZ0Vycm9yTGFiZWwgKTtcblx0XHRcdFx0XHRpbnZhbGlkSW5wdXRzLnB1c2goICRpbnB1dCApO1xuXHRcdFx0XHRcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHRBcHAuVXRpbHMuRm9ybUhlbHBlci5yZW1vdmVFcnJvciggJGlucHV0ICk7XG5cblx0XHRcdFx0XHQvL2NoZWNrIGZvciBkaWdpdFxuXHRcdFx0XHRcdGlmKCAkaW5wdXQuaGFzQ2xhc3MoIFwicmVxdWlyZWQtbnVtYmVyXCIgKSApIHtcblx0XHRcdFx0XHRcdGlucHV0VmFsaWQgPSBBcHAuVXRpbHMuRm9ybUhlbHBlci52YWxpZGF0ZU51bWJlckZpZWxkKCAkaW5wdXQgKTtcblx0XHRcdFx0XHRcdGlmKCAhaW5wdXRWYWxpZCApIHtcblx0XHRcdFx0XHRcdFx0QXBwLlV0aWxzLkZvcm1IZWxwZXIuYWRkRXJyb3IoICRpbnB1dCwgbnVtYmVyRXJyb3JMYWJlbCApO1xuXHRcdFx0XHRcdFx0XHRpbnZhbGlkSW5wdXRzLnB1c2goICRpbnB1dCApO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0QXBwLlV0aWxzLkZvcm1IZWxwZXIucmVtb3ZlRXJyb3IoICRpbnB1dCApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vY2hlY2sgZm9yIG1haWxcblx0XHRcdFx0XHRpZiggJGlucHV0Lmhhc0NsYXNzKCBcInJlcXVpcmVkLW1haWxcIiApICkge1xuXHRcdFx0XHRcdFx0aW5wdXRWYWxpZCA9IEZvcm1IZWxwZXIudmFsaWRhdGVFbWFpbEZpZWxkKCAkaW5wdXQgKTtcblx0XHRcdFx0XHRcdGlmKCAhaW5wdXRWYWxpZCApIHtcblx0XHRcdFx0XHRcdFx0QXBwLlV0aWxzLkZvcm1IZWxwZXIuYWRkRXJyb3IoICRpbnB1dCwgZW1haWxFcnJvckxhYmVsICk7XG5cdFx0XHRcdFx0XHRcdGludmFsaWRJbnB1dHMucHVzaCggJGlucHV0ICk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRBcHAuVXRpbHMuRm9ybUhlbHBlci5yZW1vdmVFcnJvciggJGlucHV0ICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly9jaGVjayBmb3IgY2hlY2tib3hcblx0XHRcdFx0XHRpZiggJGlucHV0Lmhhc0NsYXNzKCBcInJlcXVpcmVkLWNoZWNrYm94XCIgKSApIHtcblxuXHRcdFx0XHRcdFx0aW5wdXRWYWxpZCA9IEZvcm1IZWxwZXIudmFsaWRhdGVDaGVja2JveCggJGlucHV0ICk7XG5cdFx0XHRcdFx0XHRpZiggIWlucHV0VmFsaWQgKSB7XG5cdFx0XHRcdFx0XHRcdEFwcC5VdGlscy5Gb3JtSGVscGVyLmFkZEVycm9yKCAkaW5wdXQsIG1pc3NpbmdFcnJvckxhYmVsICk7XG5cdFx0XHRcdFx0XHRcdGludmFsaWRJbnB1dHMucHVzaCggJGlucHV0ICk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRBcHAuVXRpbHMuRm9ybUhlbHBlci5yZW1vdmVFcnJvciggJGlucHV0ICk7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0fVxuXHRcblx0XHRcdH0gKTtcblxuXHRcdH1cblxuXG5cdFx0aWYoIGludmFsaWRJbnB1dHMubGVuZ3RoICkge1xuXG5cdFx0XHQvL3Rha2UgZmlyc3QgZWxlbWVudCBhbmQgc2Nyb2xsIHRvIGl0XG5cdFx0XHR2YXIgJGZpcnN0SW52YWxpZElucHV0ID0gaW52YWxpZElucHV0c1swXTtcblx0XHRcdCQoJ2h0bWwsIGJvZHknKS5hbmltYXRlKCB7XG5cdFx0XHRcdHNjcm9sbFRvcDogJGZpcnN0SW52YWxpZElucHV0Lm9mZnNldCgpLnRvcCAtIDI1XG5cdFx0XHR9LCAyNTApO1xuXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTsgXG5cblx0fTtcblxuXHRBcHAuVXRpbHMuRm9ybUhlbHBlci52YWxpZGF0ZVJlcXVpcmVkRmllbGQgPSBmdW5jdGlvbiggJGlucHV0ICkge1xuXG5cdFx0cmV0dXJuICggJGlucHV0LnZhbCgpID09PSBcIlwiICkgPyBmYWxzZSA6IHRydWU7XG5cblx0fTtcblxuXHRBcHAuVXRpbHMuRm9ybUhlbHBlci52YWxpZGF0ZUVtYWlsRmllbGQgPSBmdW5jdGlvbiggJGlucHV0ICkge1xuXG5cdFx0dmFyIGVtYWlsID0gJGlucHV0LnZhbCgpO1xuXHRcdHZhciByZWdleCA9IC9eKFtcXHctXFwuXStAKFtcXHctXStcXC4pK1tcXHctXXsyLDZ9KT8kLztcblx0XHRyZXR1cm4gcmVnZXgudGVzdCggZW1haWwgKTtcblxuXHR9O1xuXG5cdEFwcC5VdGlscy5Gb3JtSGVscGVyLnZhbGlkYXRlTnVtYmVyRmllbGQgPSBmdW5jdGlvbiggJGlucHV0ICkge1xuXG5cdFx0cmV0dXJuICggaXNOYU4oICRpbnB1dC52YWwoKSApICkgPyBmYWxzZSA6IHRydWU7XG5cblx0fTtcblxuXHRBcHAuVXRpbHMuRm9ybUhlbHBlci52YWxpZGF0ZUNoZWNrYm94ID0gZnVuY3Rpb24oICRpbnB1dCApIHtcblxuXHRcdHJldHVybiAoICRpbnB1dC5pcygnOmNoZWNrZWQnKSApID8gdHJ1ZSA6IGZhbHNlO1xuXG5cdH07XG5cblxuXHRBcHAuVXRpbHMuRm9ybUhlbHBlci5hZGRFcnJvciA9IGZ1bmN0aW9uKCAkZWwsICRtc2cgKSB7XG5cblx0XHRpZiggJGVsICkge1xuXHRcdFx0aWYoICEkZWwuaGFzQ2xhc3MoIFwiZXJyb3JcIiApICkge1xuXHRcdFx0XHQkZWwuYWRkQ2xhc3MoIFwiZXJyb3JcIiApO1xuXHRcdFx0XHQkZWwuYmVmb3JlKCBcIjxwIGNsYXNzPSdlcnJvci1sYWJlbCc+XCIgKyAkbXNnICsgXCI8L3A+XCIgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0fTtcblxuXHRBcHAuVXRpbHMuRm9ybUhlbHBlci5yZW1vdmVFcnJvciA9IGZ1bmN0aW9uKCAkZWwgKSB7XG5cblx0XHRpZiggJGVsICkge1xuXHRcdFx0JGVsLnJlbW92ZUNsYXNzKCBcImVycm9yXCIgKTtcblx0XHRcdHZhciAkcGFyZW50ID0gJGVsLnBhcmVudCgpO1xuXHRcdFx0dmFyICRlcnJvckxhYmVsID0gJHBhcmVudC5maW5kKCBcIi5lcnJvci1sYWJlbFwiICk7XG5cdFx0XHRpZiggJGVycm9yTGFiZWwubGVuZ3RoICkge1xuXHRcdFx0XHQkZXJyb3JMYWJlbC5yZW1vdmUoKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0XG5cdH07XG5cblx0QXBwLlV0aWxzLndyYXAgPSBmdW5jdGlvbiggJGVsLCB3aWR0aCApIHtcblx0XHRcblx0XHQvL2dldCByaWQgb2YgcG90ZW50aWFsIHRzcGFucyBhbmQgZ2V0IHB1cmUgY29udGVudCAoaW5jbHVkaW5nIGh5cGVybGlua3MpXG5cdFx0dmFyIHRleHRDb250ZW50ID0gXCJcIixcblx0XHRcdCR0c3BhbnMgPSAkZWwuZmluZCggXCJ0c3BhblwiICk7XG5cdFx0aWYoICR0c3BhbnMubGVuZ3RoICkge1xuXHRcdFx0JC5lYWNoKCAkdHNwYW5zLCBmdW5jdGlvbiggaSwgdiApIHtcblx0XHRcdFx0aWYoIGkgPiAwICkge1xuXHRcdFx0XHRcdHRleHRDb250ZW50ICs9IFwiIFwiO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRleHRDb250ZW50ICs9ICQodikudGV4dCgpO1xuXHRcdFx0fSApO1x0XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vZWxlbWVudCBoYXMgbm8gdHNwYW5zLCBwb3NzaWJseSBmaXJzdCBydW5cblx0XHRcdHRleHRDb250ZW50ID0gJGVsLnRleHQoKTtcblx0XHR9XG5cdFx0XG5cdFx0Ly9hcHBlbmQgdG8gZWxlbWVudFxuXHRcdGlmKCB0ZXh0Q29udGVudCApIHtcblx0XHRcdCRlbC50ZXh0KCB0ZXh0Q29udGVudCApO1xuXHRcdH1cblx0XHRcblx0XHR2YXIgdGV4dCA9IGQzLnNlbGVjdCggJGVsLnNlbGVjdG9yICk7XG5cdFx0dGV4dC5lYWNoKCBmdW5jdGlvbigpIHtcblx0XHRcdHZhciB0ZXh0ID0gZDMuc2VsZWN0KHRoaXMpLFxuXHRcdFx0XHRyZWdleCA9IC9cXHMrLyxcblx0XHRcdFx0d29yZHMgPSB0ZXh0LnRleHQoKS5zcGxpdChyZWdleCkucmV2ZXJzZSgpO1xuXG5cdFx0XHR2YXIgd29yZCxcblx0XHRcdFx0bGluZSA9IFtdLFxuXHRcdFx0XHRsaW5lTnVtYmVyID0gMCxcblx0XHRcdFx0bGluZUhlaWdodCA9IDEuNCwgLy8gZW1zXG5cdFx0XHRcdHkgPSB0ZXh0LmF0dHIoXCJ5XCIpLFxuXHRcdFx0XHRkeSA9IHBhcnNlRmxvYXQodGV4dC5hdHRyKFwiZHlcIikpLFxuXHRcdFx0XHR0c3BhbiA9IHRleHQudGV4dChudWxsKS5hcHBlbmQoXCJ0c3BhblwiKS5hdHRyKFwieFwiLCAwKS5hdHRyKFwieVwiLCB5KS5hdHRyKFwiZHlcIiwgZHkgKyBcImVtXCIpO1xuXHRcdFx0XG5cdFx0XHR3aGlsZSggd29yZCA9IHdvcmRzLnBvcCgpICkge1xuXHRcdFx0XHRsaW5lLnB1c2god29yZCk7XG5cdFx0XHRcdHRzcGFuLmh0bWwobGluZS5qb2luKFwiIFwiKSk7XG5cdFx0XHRcdGlmKCB0c3Bhbi5ub2RlKCkuZ2V0Q29tcHV0ZWRUZXh0TGVuZ3RoKCkgPiB3aWR0aCApIHtcblx0XHRcdFx0XHRsaW5lLnBvcCgpO1xuXHRcdFx0XHRcdHRzcGFuLnRleHQobGluZS5qb2luKFwiIFwiKSk7XG5cdFx0XHRcdFx0bGluZSA9IFt3b3JkXTtcblx0XHRcdFx0XHR0c3BhbiA9IHRleHQuYXBwZW5kKFwidHNwYW5cIikuYXR0cihcInhcIiwgMCkuYXR0cihcInlcIiwgeSkuYXR0cihcImR5XCIsICsrbGluZU51bWJlciAqIGxpbmVIZWlnaHQgKyBkeSArIFwiZW1cIikudGV4dCh3b3JkKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0fSApO1xuXG5cdFx0XG5cdH07XG5cblx0LyoqXG5cdCogQ29udmVydCBhIHN0cmluZyB0byBIVE1MIGVudGl0aWVzXG5cdCovXG5cdEFwcC5VdGlscy50b0h0bWxFbnRpdGllcyA9IGZ1bmN0aW9uKHN0cmluZykge1xuXHRcdHJldHVybiBzdHJpbmcucmVwbGFjZSgvLi9nbSwgZnVuY3Rpb24ocykge1xuXHRcdFx0cmV0dXJuIFwiJiNcIiArIHMuY2hhckNvZGVBdCgwKSArIFwiO1wiO1xuXHRcdH0pO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDcmVhdGUgc3RyaW5nIGZyb20gSFRNTCBlbnRpdGllc1xuXHQgKi9cblx0QXBwLlV0aWxzLmZyb21IdG1sRW50aXRpZXMgPSBmdW5jdGlvbihzdHJpbmcpIHtcblx0XHRyZXR1cm4gKHN0cmluZytcIlwiKS5yZXBsYWNlKC8mI1xcZCs7L2dtLGZ1bmN0aW9uKHMpIHtcblx0XHRcdHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKHMubWF0Y2goL1xcZCsvZ20pWzBdKTtcblx0XHR9KVxuXHR9O1xuXG5cdEFwcC5VdGlscy5nZXRSYW5kb21Db2xvciA9IGZ1bmN0aW9uICgpIHtcblx0XHR2YXIgbGV0dGVycyA9ICcwMTIzNDU2Nzg5QUJDREVGJy5zcGxpdCgnJyk7XG5cdFx0dmFyIGNvbG9yID0gJyMnO1xuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgNjsgaSsrICkge1xuXHRcdFx0Y29sb3IgKz0gbGV0dGVyc1tNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAxNildO1xuXHRcdH1cblx0XHRyZXR1cm4gY29sb3I7XG5cdH07XG5cblx0QXBwLlV0aWxzLmdldFByb3BlcnR5QnlWYXJpYWJsZUlkID0gZnVuY3Rpb24oIG1vZGVsLCB2YXJpYWJsZUlkICkge1xuXG5cdFx0aWYoIG1vZGVsICYmIG1vZGVsLmdldCggXCJjaGFydC1kaW1lbnNpb25zXCIgKSApIHtcblxuXHRcdFx0dmFyIGNoYXJ0RGltZW5zaW9uc1N0cmluZyA9IG1vZGVsLmdldCggXCJjaGFydC1kaW1lbnNpb25zXCIgKSxcblx0XHRcdFx0Y2hhcnREaW1lbnNpb25zID0gJC5wYXJzZUpTT04oIGNoYXJ0RGltZW5zaW9uc1N0cmluZyApLFxuXHRcdFx0XHRkaW1lbnNpb24gPSBfLndoZXJlKCBjaGFydERpbWVuc2lvbnMsIHsgXCJ2YXJpYWJsZUlkXCI6IHZhcmlhYmxlSWQgfSApO1xuXHRcdFx0aWYoIGRpbWVuc2lvbiAmJiBkaW1lbnNpb24ubGVuZ3RoICkge1xuXHRcdFx0XHRyZXR1cm4gZGltZW5zaW9uWzBdLnByb3BlcnR5O1xuXHRcdFx0fVxuXG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFxuXHR9O1xuXG5cblx0QXBwLlV0aWxzLmNvbnRlbnRHZW5lcmF0b3IgPSBmdW5jdGlvbiggZGF0YSwgaXNNYXBQb3B1cCApIHtcblx0XHRcdFxuXHRcdC8vc2V0IHBvcHVwXG5cdFx0dmFyIHVuaXRzU3RyaW5nID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcInVuaXRzXCIgKSxcblx0XHRcdGNoYXJ0VHlwZSA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10eXBlXCIgKSxcblx0XHRcdHVuaXRzID0gKCAhJC5pc0VtcHR5T2JqZWN0KCB1bml0c1N0cmluZyApICk/ICQucGFyc2VKU09OKCB1bml0c1N0cmluZyApOiB7fSxcblx0XHRcdHN0cmluZyA9IFwiXCIsXG5cdFx0XHR2YWx1ZXNTdHJpbmcgPSBcIlwiO1xuXG5cdFx0Ly9maW5kIHJlbGV2YW50IHZhbHVlcyBmb3IgcG9wdXAgYW5kIGRpc3BsYXkgdGhlbVxuXHRcdHZhciBzZXJpZXMgPSBkYXRhLnNlcmllcywga2V5ID0gXCJcIiwgdGltZVN0cmluZyA9IFwiXCI7XG5cdFx0aWYoIHNlcmllcyAmJiBzZXJpZXMubGVuZ3RoICkge1xuXHRcdFx0XG5cdFx0XHR2YXIgc2VyaWUgPSBzZXJpZXNbIDAgXTtcblx0XHRcdGtleSA9IHNlcmllLmtleTtcblx0XHRcdFxuXHRcdFx0Ly9nZXQgc291cmNlIG9mIGluZm9ybWF0aW9uXG5cdFx0XHR2YXIgcG9pbnQgPSBkYXRhLnBvaW50O1xuXHRcdFx0Ly9iZWdpbiBjb21wb3N0aW5nIHN0cmluZ1xuXHRcdFx0c3RyaW5nID0gXCI8aDM+XCIgKyBrZXkgKyBcIjwvaDM+PHA+XCI7XG5cdFx0XHR2YWx1ZXNTdHJpbmcgPSBcIlwiO1xuXG5cdFx0XHRpZiggIWlzTWFwUG9wdXAgJiYgKCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdHlwZVwiICkgPT09IFwiNFwiIHx8IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10eXBlXCIgKSA9PT0gXCI1XCIgfHwgQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LXR5cGVcIiApID09PSBcIjZcIiApICkge1xuXHRcdFx0XHQvL211bHRpYmFyY2hhcnQgaGFzIHZhbHVlcyBpbiBkaWZmZXJlbnQgZm9ybWF0XG5cdFx0XHRcdHBvaW50ID0geyBcInlcIjogc2VyaWUudmFsdWUsIFwidGltZVwiOiBkYXRhLmRhdGEudGltZSB9O1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHQkLmVhY2goIHBvaW50LCBmdW5jdGlvbiggaSwgdiApIHtcblx0XHRcdFx0Ly9mb3IgZWFjaCBkYXRhIHBvaW50LCBmaW5kIGFwcHJvcHJpYXRlIHVuaXQsIGFuZCBpZiB3ZSBoYXZlIGl0LCBkaXNwbGF5IGl0XG5cdFx0XHRcdHZhciB1bml0ID0gXy5maW5kV2hlcmUoIHVuaXRzLCB7IHByb3BlcnR5OiBpIH0gKSxcblx0XHRcdFx0XHR2YWx1ZSA9IHYsXG5cdFx0XHRcdFx0aXNIaWRkZW4gPSAoIHVuaXQgJiYgdW5pdC5oYXNPd25Qcm9wZXJ0eSggXCJ2aXNpYmxlXCIgKSAmJiAhdW5pdC52aXNpYmxlICk/IHRydWU6IGZhbHNlO1xuXG5cdFx0XHRcdC8vZm9ybWF0IG51bWJlclxuXHRcdFx0XHRpZiggdW5pdCAmJiAhaXNOYU4oIHVuaXQuZm9ybWF0ICkgJiYgdW5pdC5mb3JtYXQgPj0gMCApIHtcblx0XHRcdFx0XHQvL2ZpeGVkIGZvcm1hdFxuXHRcdFx0XHRcdHZhciBmaXhlZCA9IE1hdGgubWluKCAyMCwgcGFyc2VJbnQoIHVuaXQuZm9ybWF0LCAxMCApICk7XG5cdFx0XHRcdFx0dmFsdWUgPSBkMy5mb3JtYXQoIFwiLC5cIiArIGZpeGVkICsgXCJmXCIgKSggdmFsdWUgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvL2FkZCB0aG91c2FuZHMgc2VwYXJhdG9yXG5cdFx0XHRcdFx0dmFsdWUgPSBkMy5mb3JtYXQoIFwiLFwiICkoIHZhbHVlICk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiggdW5pdCApIHtcblx0XHRcdFx0XHRpZiggIWlzSGlkZGVuICkge1xuXHRcdFx0XHRcdFx0Ly90cnkgdG8gZm9ybWF0IG51bWJlclxuXHRcdFx0XHRcdFx0Ly9zY2F0dGVyIHBsb3QgaGFzIHZhbHVlcyBkaXNwbGF5ZWQgaW4gc2VwYXJhdGUgcm93c1xuXHRcdFx0XHRcdFx0aWYoIHZhbHVlc1N0cmluZyAhPT0gXCJcIiAmJiBjaGFydFR5cGUgIT0gMiApIHtcblx0XHRcdFx0XHRcdFx0dmFsdWVzU3RyaW5nICs9IFwiLCBcIjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmKCBjaGFydFR5cGUgPT0gMiApIHtcblx0XHRcdFx0XHRcdFx0dmFsdWVzU3RyaW5nICs9IFwiPHNwYW4gY2xhc3M9J3Zhci1wb3B1cC12YWx1ZSc+XCI7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR2YWx1ZXNTdHJpbmcgKz0gdmFsdWUgKyBcIiBcIiArIHVuaXQudW5pdDtcblx0XHRcdFx0XHRcdGlmKCBjaGFydFR5cGUgPT0gMiApIHtcblx0XHRcdFx0XHRcdFx0dmFsdWVzU3RyaW5nICs9IFwiPC9zcGFuPlwiO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIGlmKCBpID09PSBcInRpbWVcIiApIHtcblx0XHRcdFx0XHR0aW1lU3RyaW5nID0gdjtcblx0XHRcdFx0fSBlbHNlIGlmKCBpICE9PSBcImNvbG9yXCIgJiYgaSAhPT0gXCJzZXJpZXNcIiAmJiAoIGkgIT09IFwieFwiIHx8IGNoYXJ0VHlwZSAhPSAxICkgKSB7XG5cdFx0XHRcdFx0aWYoICFpc0hpZGRlbiApIHtcblx0XHRcdFx0XHRcdGlmKCB2YWx1ZXNTdHJpbmcgIT09IFwiXCIgJiYgY2hhcnRUeXBlICE9IDIgKSB7XG5cdFx0XHRcdFx0XHRcdHZhbHVlc1N0cmluZyArPSBcIiwgXCI7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiggY2hhcnRUeXBlID09IDIgKSB7XG5cdFx0XHRcdFx0XHRcdHZhbHVlc1N0cmluZyArPSBcIjxzcGFuIGNsYXNzPSd2YXItcG9wdXAtdmFsdWUnPlwiO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Ly9qdXN0IGFkZCBwbGFpbiB2YWx1ZSwgb21pdGluZyB4IHZhbHVlIGZvciBsaW5lY2hhcnRcblx0XHRcdFx0XHRcdHZhbHVlc1N0cmluZyArPSB2YWx1ZTtcblx0XHRcdFx0XHRcdGlmKCBjaGFydFR5cGUgPT0gMiApIHtcblx0XHRcdFx0XHRcdFx0dmFsdWVzU3RyaW5nICs9IFwiPC9zcGFuPlwiO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXG5cdFx0XHRpZiggaXNNYXBQb3B1cCB8fCAoIHRpbWVTdHJpbmcgJiYgY2hhcnRUeXBlICE9IDIgKSApIHtcblx0XHRcdFx0dmFsdWVzU3RyaW5nICs9IFwiIDxiciAvPiBpbiA8YnIgLz4gXCIgKyB0aW1lU3RyaW5nO1xuXHRcdFx0fSBlbHNlIGlmKCB0aW1lU3RyaW5nICYmIGNoYXJ0VHlwZSA9PSAyICkge1xuXHRcdFx0XHR2YWx1ZXNTdHJpbmcgKz0gXCI8c3BhbiBjbGFzcz0ndmFyLXBvcHVwLXZhbHVlJz5pbiBcIiArIHRpbWVTdHJpbmcgKyBcIjwvc3Bhbj5cIjtcblx0XHRcdH1cblx0XHRcdHN0cmluZyArPSB2YWx1ZXNTdHJpbmc7XG5cdFx0XHRzdHJpbmcgKz0gXCI8L3A+XCI7XG5cblx0XHR9XG5cblx0XHRyZXR1cm4gc3RyaW5nO1xuXG5cdH07XG5cblxuXHRBcHAuVXRpbHMuZm9ybWF0VGltZUxhYmVsID0gZnVuY3Rpb24oIHR5cGUsIGQsIHhBeGlzUHJlZml4LCB4QXhpc1N1ZmZpeCwgZm9ybWF0ICkge1xuXHRcdC8vZGVwZW5kaW5nIG9uIHR5cGUgZm9ybWF0IGxhYmVsXG5cdFx0dmFyIGxhYmVsO1xuXHRcdHN3aXRjaCggdHlwZSApIHtcblx0XHRcdFxuXHRcdFx0Y2FzZSBcIkRlY2FkZVwiOlxuXHRcdFx0XHRcblx0XHRcdFx0dmFyIGRlY2FkZVN0cmluZyA9IGQudG9TdHJpbmcoKTtcblx0XHRcdFx0ZGVjYWRlU3RyaW5nID0gZGVjYWRlU3RyaW5nLnN1YnN0cmluZyggMCwgZGVjYWRlU3RyaW5nLmxlbmd0aCAtIDEpO1xuXHRcdFx0XHRkZWNhZGVTdHJpbmcgPSBkZWNhZGVTdHJpbmcgKyBcIjBzXCI7XG5cdFx0XHRcdGxhYmVsID0gZGVjYWRlU3RyaW5nO1xuXG5cdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRjYXNlIFwiUXVhcnRlciBDZW50dXJ5XCI6XG5cdFx0XHRcdFxuXHRcdFx0XHR2YXIgcXVhcnRlclN0cmluZyA9IFwiXCIsXG5cdFx0XHRcdFx0cXVhcnRlciA9IGQgJSAxMDA7XG5cdFx0XHRcdFxuXHRcdFx0XHRpZiggcXVhcnRlciA8IDI1ICkge1xuXHRcdFx0XHRcdHF1YXJ0ZXJTdHJpbmcgPSBcIjFzdCBxdWFydGVyIG9mIHRoZVwiO1xuXHRcdFx0XHR9IGVsc2UgaWYoIHF1YXJ0ZXIgPCA1MCApIHtcblx0XHRcdFx0XHRxdWFydGVyU3RyaW5nID0gXCJoYWxmIG9mIHRoZVwiO1xuXHRcdFx0XHR9IGVsc2UgaWYoIHF1YXJ0ZXIgPCA3NSApIHtcblx0XHRcdFx0XHRxdWFydGVyU3RyaW5nID0gXCIzcmQgcXVhcnRlciBvZiB0aGVcIjtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRxdWFydGVyU3RyaW5nID0gXCI0dGggcXVhcnRlciBvZiB0aGVcIjtcblx0XHRcdFx0fVxuXHRcdFx0XHRcdFxuXHRcdFx0XHR2YXIgY2VudHVyeVN0cmluZyA9IEFwcC5VdGlscy5jZW50dXJ5U3RyaW5nKCBkICk7XG5cblx0XHRcdFx0bGFiZWwgPSBxdWFydGVyU3RyaW5nICsgXCIgXCIgKyBjZW50dXJ5U3RyaW5nO1xuXG5cdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRjYXNlIFwiSGFsZiBDZW50dXJ5XCI6XG5cdFx0XHRcdFxuXHRcdFx0XHR2YXIgaGFsZlN0cmluZyA9IFwiXCIsXG5cdFx0XHRcdFx0aGFsZiA9IGQgJSAxMDA7XG5cdFx0XHRcdFxuXHRcdFx0XHRpZiggaGFsZiA8IDUwICkge1xuXHRcdFx0XHRcdGhhbGZTdHJpbmcgPSBcIjFzdCBoYWxmIG9mIHRoZVwiO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGhhbGZTdHJpbmcgPSBcIjJuZCBoYWxmIG9mIHRoZVwiO1xuXHRcdFx0XHR9XG5cdFx0XHRcdFx0XG5cdFx0XHRcdHZhciBjZW50dXJ5U3RyaW5nID0gQXBwLlV0aWxzLmNlbnR1cnlTdHJpbmcoIGQgKTtcblxuXHRcdFx0XHRsYWJlbCA9IGhhbGZTdHJpbmcgKyBcIiBcIiArIGNlbnR1cnlTdHJpbmc7XG5cblx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdGNhc2UgXCJDZW50dXJ5XCI6XG5cdFx0XHRcdFxuXHRcdFx0XHRsYWJlbCA9IEFwcC5VdGlscy5jZW50dXJ5U3RyaW5nKCBkICk7XG5cblx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdGRlZmF1bHQ6XG5cblx0XHRcdFx0bGFiZWwgPSBBcHAuVXRpbHMuZm9ybWF0VmFsdWUoIGQsIGZvcm1hdCApO1xuXHRcdFx0XHRcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXHRcdHJldHVybiB4QXhpc1ByZWZpeCArIGxhYmVsICsgeEF4aXNTdWZmaXg7XG5cdH07XG5cblx0QXBwLlV0aWxzLmlubGluZUNzc1N0eWxlID0gZnVuY3Rpb24oIHJ1bGVzICkge1xuXHRcdC8vaHR0cDovL2RldmludG9yci5lcy9ibG9nLzIwMTAvMDUvMjYvdHVybi1jc3MtcnVsZXMtaW50by1pbmxpbmUtc3R5bGUtYXR0cmlidXRlcy11c2luZy1qcXVlcnkvXG5cdFx0Zm9yICh2YXIgaWR4ID0gMCwgbGVuID0gcnVsZXMubGVuZ3RoOyBpZHggPCBsZW47IGlkeCsrKSB7XG5cdFx0XHQkKHJ1bGVzW2lkeF0uc2VsZWN0b3JUZXh0KS5lYWNoKGZ1bmN0aW9uIChpLCBlbGVtKSB7XG5cdFx0XHRcdGVsZW0uc3R5bGUuY3NzVGV4dCArPSBydWxlc1tpZHhdLnN0eWxlLmNzc1RleHQ7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH07XG5cblx0QXBwLlV0aWxzLmNoZWNrVmFsaWREaW1lbnNpb25zID0gZnVuY3Rpb24oIGRpbWVuc2lvbnMsIGNoYXJ0VHlwZSApIHtcblx0XHRcdFxuXHRcdHZhciB2YWxpZERpbWVuc2lvbnMgPSBmYWxzZSxcblx0XHRcdHhEaW1lbnNpb24sIHlEaW1lbnNpb247XG5cdFx0XG5cdFx0c3dpdGNoKCBjaGFydFR5cGUgKSB7XG5cdFx0XHRjYXNlIFwiMVwiOlxuXHRcdFx0Y2FzZSBcIjRcIjpcblx0XHRcdGNhc2UgXCI1XCI6XG5cdFx0XHRjYXNlIFwiNlwiOlxuXHRcdFx0XHQvL2NoZWNrIHRoYXQgZGltZW5zaW9ucyBoYXZlIHkgcHJvcGVydHlcblx0XHRcdFx0eURpbWVuc2lvbiA9IF8uZmluZCggZGltZW5zaW9ucywgZnVuY3Rpb24oIGRpbWVuc2lvbiApIHtcblx0XHRcdFx0XHRyZXR1cm4gZGltZW5zaW9uLnByb3BlcnR5ID09PSBcInlcIjtcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRpZiggeURpbWVuc2lvbiApIHtcblx0XHRcdFx0XHR2YWxpZERpbWVuc2lvbnMgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBcIjJcIjpcblx0XHRcdFx0Ly9jaGVjayB0aGF0IGRpbWVuc2lvbnMgaGF2ZSB4IHByb3BlcnR5XG5cdFx0XHRcdHhEaW1lbnNpb24gPSBfLmZpbmQoIGRpbWVuc2lvbnMsIGZ1bmN0aW9uKCBkaW1lbnNpb24gKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGRpbWVuc2lvbi5wcm9wZXJ0eSA9PT0gXCJ4XCI7XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0eURpbWVuc2lvbiA9IF8uZmluZCggZGltZW5zaW9ucywgZnVuY3Rpb24oIGRpbWVuc2lvbiApIHtcblx0XHRcdFx0XHRyZXR1cm4gZGltZW5zaW9uLnByb3BlcnR5ID09PSBcInlcIjtcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRpZiggeERpbWVuc2lvbiAmJiB5RGltZW5zaW9uICkge1xuXHRcdFx0XHRcdHZhbGlkRGltZW5zaW9ucyA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFwiM1wiOlxuXHRcdFx0XHQvL2NoZWNrIHRoYXQgZGltZW5zaW9ucyBoYXZlIHkgcHJvcGVydHlcblx0XHRcdFx0eURpbWVuc2lvbiA9IF8uZmluZCggZGltZW5zaW9ucywgZnVuY3Rpb24oIGRpbWVuc2lvbiApIHtcblx0XHRcdFx0XHRyZXR1cm4gZGltZW5zaW9uLnByb3BlcnR5ID09PSBcInlcIjtcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRpZiggeURpbWVuc2lvbiApIHtcblx0XHRcdFx0XHR2YWxpZERpbWVuc2lvbnMgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblx0XHRyZXR1cm4gdmFsaWREaW1lbnNpb25zO1xuXG5cdH07XG5cblx0QXBwLlV0aWxzLmZvcm1hdFZhbHVlID0gZnVuY3Rpb24oIHZhbHVlLCBmb3JtYXQgKSB7XG5cdFx0Ly9tYWtlIHN1cmUgd2UgZG8gdGhpcyBvbiBudW1iZXJcblx0XHRpZiggdmFsdWUgJiYgIWlzTmFOKCB2YWx1ZSApICkge1xuXHRcdFx0aWYoIGZvcm1hdCAmJiAhaXNOYU4oIGZvcm1hdCApICkge1xuXHRcdFx0XHR2YXIgZml4ZWQgPSBNYXRoLm1pbiggMjAsIHBhcnNlSW50KCBmb3JtYXQsIDEwICkgKTtcblx0XHRcdFx0dmFsdWUgPSB2YWx1ZS50b0ZpeGVkKCBmaXhlZCApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly9ubyBmb3JtYXQgXG5cdFx0XHRcdHZhbHVlID0gdmFsdWUudG9TdHJpbmcoKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHZhbHVlO1xuXHR9O1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlV0aWxzO1xuXHRcbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgRm9ybSA9IHJlcXVpcmUoIFwiLi92aWV3cy9BcHAuVmlld3MuRm9ybS5qc1wiICksXG5cdFx0Q2hhcnRNb2RlbCA9IHJlcXVpcmUoIFwiLi9tb2RlbHMvQXBwLk1vZGVscy5DaGFydE1vZGVsLmpzXCIgKSxcblx0XHRDaGFydERhdGFNb2RlbCA9IHJlcXVpcmUoIFwiLi9tb2RlbHMvQXBwLk1vZGVscy5DaGFydERhdGFNb2RlbC5qc1wiICk7XG5cblx0Ly9zZXR1cCBtb2RlbHNcblx0Ly9pcyBuZXcgY2hhcnQgb3IgZGlzcGxheSBvbGQgY2hhcnRcblx0dmFyICRjaGFydFNob3dXcmFwcGVyID0gJCggXCIuY2hhcnQtc2hvdy13cmFwcGVyLCAuY2hhcnQtZWRpdC13cmFwcGVyXCIgKSxcblx0XHRjaGFydElkID0gJGNoYXJ0U2hvd1dyYXBwZXIuYXR0ciggXCJkYXRhLWNoYXJ0LWlkXCIgKTtcblxuXHQvL3NldHVwIHZpZXdzXG5cdEFwcC5WaWV3ID0gbmV3IEZvcm0oKTtcblxuXHRpZiggJGNoYXJ0U2hvd1dyYXBwZXIubGVuZ3RoICYmIGNoYXJ0SWQgKSB7XG5cdFx0XG5cdFx0Ly9zaG93aW5nIGV4aXN0aW5nIGNoYXJ0XG5cdFx0QXBwLkNoYXJ0TW9kZWwgPSBuZXcgQ2hhcnRNb2RlbCggeyBpZDogY2hhcnRJZCB9ICk7XG5cdFx0QXBwLkNoYXJ0TW9kZWwuZmV0Y2goIHtcblx0XHRcdHN1Y2Nlc3M6IGZ1bmN0aW9uKCBkYXRhICkge1xuXHRcdFx0XHRBcHAuVmlldy5zdGFydCgpO1xuXHRcdFx0fSxcblx0XHRcdGVycm9yOiBmdW5jdGlvbiggeGhyICkge1xuXHRcdFx0XHRjb25zb2xlLmVycm9yKCBcIkVycm9yIGxvYWRpbmcgY2hhcnQgbW9kZWxcIiwgeGhyICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHRcdC8vZmluZCBvdXQgaWYgaXQncyBpbiBjYWNoZVxuXHRcdGlmKCAhJCggXCIuc3RhbmRhbG9uZS1jaGFydC12aWV3ZXJcIiApLmxlbmd0aCApIHtcblx0XHRcdC8vZGlzYWJsZSBjYWNoaW5nIGZvciB2aWV3aW5nIHdpdGhpbiBhZG1pblxuXHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0KCBcImNhY2hlXCIsIGZhbHNlICk7XG5cdFx0fVxuXHRcdFxuXHR9IGVsc2Uge1xuXG5cdFx0Ly9pcyBuZXcgY2hhcnRcblx0XHRBcHAuQ2hhcnRNb2RlbCA9IG5ldyBDaGFydE1vZGVsKCk7XG5cdFx0QXBwLlZpZXcuc3RhcnQoKTtcblxuXHR9XG5cblx0XG5cdFxuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgRW50aXR5TW9kZWwgPSByZXF1aXJlKCBcIi4vLi4vbW9kZWxzL0FwcC5Nb2RlbHMuRW50aXR5TW9kZWwuanNcIiApO1xuXG5cdEFwcC5Db2xsZWN0aW9ucy5BdmFpbGFibGVFbnRpdGllc0NvbGxlY3Rpb24gPSBCYWNrYm9uZS5Db2xsZWN0aW9uLmV4dGVuZCgge1xuXG5cdFx0bW9kZWw6IEVudGl0eU1vZGVsLFxuXHRcdHVybFJvb3Q6IEdsb2JhbC5yb290VXJsICsgJy9kYXRhL2VudGl0aWVzJyxcblx0XHRcblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiAoKSB7XG5cblx0XHRcdEFwcC5DaGFydFZhcmlhYmxlc0NvbGxlY3Rpb24ub24oIFwiYWRkXCIsIHRoaXMub25WYXJpYWJsZUFkZCwgdGhpcyApO1xuXHRcdFx0QXBwLkNoYXJ0VmFyaWFibGVzQ29sbGVjdGlvbi5vbiggXCJyZW1vdmVcIiwgdGhpcy5vblZhcmlhYmxlUmVtb3ZlLCB0aGlzICk7XG5cdFx0XHRcblx0XHR9LFxuXG5cdFx0cGFyc2U6IGZ1bmN0aW9uKCByZXNwb25zZSApe1xuXHRcdFx0cmV0dXJuIHJlc3BvbnNlLmRhdGE7XG5cdFx0fSxcblxuXHRcdG9uVmFyaWFibGVBZGQ6IGZ1bmN0aW9uKCBtb2RlbCApIHtcblx0XHRcdHRoaXMudXBkYXRlRW50aXRpZXMoKTtcblx0XHR9LFxuXG5cdFx0b25WYXJpYWJsZVJlbW92ZTogZnVuY3Rpb24oIG1vZGVsICkge1xuXHRcdFx0dGhpcy51cGRhdGVFbnRpdGllcygpO1xuXHRcdH0sXG5cblx0XHR1cGRhdGVFbnRpdGllczogZnVuY3Rpb24oKSB7XG5cblx0XHRcdHZhciBpZHMgPSB0aGlzLmdldFZhcmlhYmxlSWRzKCk7XG5cdFx0XHR0aGlzLnVybCA9IHRoaXMudXJsUm9vdCArIFwiP3ZhcmlhYmxlSWRzPVwiICsgaWRzLmpvaW4oXCIsXCIpO1xuXG5cdFx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0XHR0aGlzLmZldGNoKCB7XG5cdFx0XHRcdHN1Y2Nlc3M6IGZ1bmN0aW9uKCBjb2xsZWN0aW9uLCByZXNwb25zZSApIHtcblx0XHRcdFx0XHR0aGF0LnRyaWdnZXIoIFwiZmV0Y2hlZFwiICk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0fSxcblxuXHRcdGdldFZhcmlhYmxlSWRzOiBmdW5jdGlvbigpIHtcblxuXHRcdFx0dmFyIHZhcmlhYmxlcyA9IEFwcC5DaGFydFZhcmlhYmxlc0NvbGxlY3Rpb24ubW9kZWxzLFxuXHRcdFx0XHRpZHMgPSBfLm1hcCggdmFyaWFibGVzLCBmdW5jdGlvbiggdiwgayApIHtcblx0XHRcdFx0XHRyZXR1cm4gdi5nZXQoIFwiaWRcIiApO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHRyZXR1cm4gaWRzO1xuXG5cdFx0fVxuXG5cblx0fSApO1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLkNvbGxlY3Rpb25zLkF2YWlsYWJsZUVudGl0aWVzQ29sbGVjdGlvbjtcblx0XG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgQ2hhcnRWYXJpYWJsZU1vZGVsID0gcmVxdWlyZSggXCIuLy4uL21vZGVscy9BcHAuTW9kZWxzLkNoYXJ0VmFyaWFibGVNb2RlbC5qc1wiICk7XG5cdFxuXHRBcHAuQ29sbGVjdGlvbnMuQ2hhcnRWYXJpYWJsZXNDb2xsZWN0aW9uID0gQmFja2JvbmUuQ29sbGVjdGlvbi5leHRlbmQoIHtcblxuXHRcdG1vZGVsOiBDaGFydFZhcmlhYmxlTW9kZWwsXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiggbW9kZWxzLCBvcHRpb25zICkge1xuXHRcdFx0aWYoIG1vZGVscyAmJiBtb2RlbHMubGVuZ3RoICkge1xuXHRcdFx0XHQvL2hhdmUgbW9kZWxzIGFscmVhZHlcblx0XHRcdFx0dGhpcy5zY2F0dGVyQ29sb3JDaGVjayggbW9kZWxzICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLm9uKCBcInN5bmNcIiwgdGhpcy5vblN5bmMsIHRoaXMgKTtcblx0XHRcdH1cblx0XHR9LFxuXG5cdFx0b25TeW5jOiBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuc2NhdHRlckNvbG9yQ2hlY2soKTtcblx0XHR9LFxuXG5cdFx0c2NhdHRlckNvbG9yQ2hlY2s6IGZ1bmN0aW9uKCBtb2RlbHMgKSB7XG5cdFx0XHRcblx0XHRcdGlmKCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdHlwZVwiICkgPT0gMiApIHtcblx0XHRcdFx0Ly9tYWtlIHN1cmUgZm9yIHNjYXR0ZXIgcGxvdCwgd2UgaGF2ZSBjb2xvciBzZXQgYXMgY29udGluZW50c1xuXHRcdFx0XHR2YXIgY2hhcnREaW1lbnNpb25zID0gJC5wYXJzZUpTT04oIEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC1kaW1lbnNpb25zXCIgKSApO1xuXHRcdFx0XHQvL2lmKCAhXy5maW5kV2hlcmUoIGNoYXJ0RGltZW5zaW9ucywgeyBcInByb3BlcnR5XCI6IFwiY29sb3JcIiB9ICkgKSB7XG5cdFx0XHRcdFx0Ly90aGlzIGlzIHdoZXJlIHdlIGFkZCBjb2xvciBwcm9wZXJ0eVxuXHRcdFx0XHRcdHZhciBjb2xvclByb3BPYmogPSB7IFwiaWRcIjpcIjEyM1wiLFwidW5pdFwiOlwiXCIsXCJuYW1lXCI6XCJDb2xvclwiLFwicGVyaW9kXCI6XCJzaW5nbGVcIixcIm1vZGVcIjpcInNwZWNpZmljXCIsXCJ0YXJnZXRZZWFyXCI6XCIyMDAwXCIsXCJ0b2xlcmFuY2VcIjpcIjVcIixcIm1heGltdW1BZ2VcIjpcIjVcIn07XG5cdFx0XHRcdFx0aWYoIG1vZGVscyApIHtcblx0XHRcdFx0XHRcdG1vZGVscy5wdXNoKCBjb2xvclByb3BPYmogKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dGhpcy5hZGQoIG5ld0NoYXJ0VmFyaWFibGVNb2RlbCggY29sb3JQcm9wT2JqICkgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdC8vfVxuXHRcdFx0fVxuXHRcdH1cblxuXHR9ICk7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuQ29sbGVjdGlvbnMuQ2hhcnRWYXJpYWJsZXNDb2xsZWN0aW9uO1xuXHRcbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdEFwcC5Db2xsZWN0aW9ucy5TZWFyY2hEYXRhQ29sbGVjdGlvbiA9IEJhY2tib25lLkNvbGxlY3Rpb24uZXh0ZW5kKCB7XG5cblx0XHQvL21vZGVsOiBBcHAuTW9kZWxzLkVudGl0eU1vZGVsLFxuXHRcdHVybFJvb3Q6IEdsb2JhbC5yb290VXJsICsgJy9kYXRhL3NlYXJjaCcsXG5cdFx0XG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24gKCkge1xuXG5cdFx0XHQvL0FwcC5DaGFydFZhcmlhYmxlc0NvbGxlY3Rpb24ub24oIFwiYWRkXCIsIHRoaXMub25WYXJpYWJsZUFkZCwgdGhpcyApO1xuXHRcdFx0Ly9BcHAuQ2hhcnRWYXJpYWJsZXNDb2xsZWN0aW9uLm9uKCBcInJlbW92ZVwiLCB0aGlzLm9uVmFyaWFibGVSZW1vdmUsIHRoaXMgKTtcblx0XHRcdFx0XG5cdFx0fSxcblxuXHRcdHBhcnNlOiBmdW5jdGlvbiggcmVzcG9uc2UgKXtcblx0XHRcdHJldHVybiByZXNwb25zZS5kYXRhO1xuXHRcdH0sXG5cblx0XHQvKm9uVmFyaWFibGVBZGQ6IGZ1bmN0aW9uKCBtb2RlbCApIHtcblx0XHRcdHRoaXMudXBkYXRlRW50aXRpZXMoKTtcblx0XHR9LFxuXG5cdFx0b25WYXJpYWJsZVJlbW92ZTogZnVuY3Rpb24oIG1vZGVsICkge1xuXHRcdFx0dGhpcy51cGRhdGVFbnRpdGllcygpO1xuXHRcdH0sKi9cblxuXHRcdHNlYXJjaDogZnVuY3Rpb24oIHMgKSB7XG5cblx0XHRcdHRoaXMudXJsID0gdGhpcy51cmxSb290ICsgXCI/cz1cIiArIHM7XG5cblx0XHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRcdHRoaXMuZmV0Y2goIHtcblx0XHRcdFx0c3VjY2VzczogZnVuY3Rpb24oIGNvbGxlY3Rpb24sIHJlc3BvbnNlICkge1xuXHRcdFx0XHRcdHRoYXQudHJpZ2dlciggXCJmZXRjaGVkXCIgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHR9XG5cblx0fSApO1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLkNvbGxlY3Rpb25zLlNlYXJjaERhdGFDb2xsZWN0aW9uO1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHRBcHAuTW9kZWxzLkF2YWlsYWJsZVRpbWVNb2RlbCA9IEJhY2tib25lLk1vZGVsLmV4dGVuZCgge1xuXG5cdFx0dXJsUm9vdDogR2xvYmFsLnJvb3RVcmwgKyAnL2RhdGEvdGltZXMnLFxuXHRcdFxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uICgpIHtcblxuXHRcdFx0QXBwLkNoYXJ0VmFyaWFibGVzQ29sbGVjdGlvbi5vbiggXCJhZGRcIiwgdGhpcy5vblZhcmlhYmxlQWRkLCB0aGlzICk7XG5cdFx0XHRBcHAuQ2hhcnRWYXJpYWJsZXNDb2xsZWN0aW9uLm9uKCBcInJlbW92ZVwiLCB0aGlzLm9uVmFyaWFibGVSZW1vdmUsIHRoaXMgKTtcblx0XHRcdFxuXHRcdH0sXG5cblx0XHRwYXJzZTogZnVuY3Rpb24oIHJlc3BvbnNlICkge1xuXG5cdFx0XHR2YXIgbWF4ID0gZDMubWF4KCByZXNwb25zZS5kYXRhLCBmdW5jdGlvbihkKSB7IHJldHVybiBwYXJzZUZsb2F0KCBkLmxhYmVsICk7IH0gKSxcblx0XHRcdFx0XHRcdG1pbiA9IGQzLm1pbiggcmVzcG9uc2UuZGF0YSwgZnVuY3Rpb24oZCkgeyByZXR1cm4gcGFyc2VGbG9hdCggZC5sYWJlbCApOyB9ICk7XG5cdFx0XHR0aGlzLnNldCggeyBcIm1heFwiOiBtYXgsIFwibWluXCI6IG1pbiB9ICk7XG5cdFx0XG5cdFx0fSxcblxuXHRcdG9uVmFyaWFibGVBZGQ6IGZ1bmN0aW9uKCBtb2RlbCApIHtcblx0XHRcdHRoaXMudXBkYXRlVGltZSgpO1xuXHRcdH0sXG5cblx0XHRvblZhcmlhYmxlUmVtb3ZlOiBmdW5jdGlvbiggbW9kZWwgKSB7XG5cdFx0XHR0aGlzLnVwZGF0ZVRpbWUoKTtcblx0XHR9LFxuXG5cdFx0dXBkYXRlVGltZTogZnVuY3Rpb24oIGlkcyApIHtcblxuXHRcdFx0dmFyIGlkcyA9IHRoaXMuZ2V0VmFyaWFibGVJZHMoKTtcblx0XHRcdHRoaXMudXJsID0gdGhpcy51cmxSb290ICsgXCI/dmFyaWFibGVJZHM9XCIgKyBpZHMuam9pbihcIixcIik7XG5cdFx0XHR0aGlzLmZldGNoKCk7XG5cblx0XHR9LFxuXG5cdFx0Z2V0VmFyaWFibGVJZHM6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHR2YXIgdmFyaWFibGVzID0gQXBwLkNoYXJ0VmFyaWFibGVzQ29sbGVjdGlvbi5tb2RlbHMsXG5cdFx0XHRcdGlkcyA9IF8ubWFwKCB2YXJpYWJsZXMsIGZ1bmN0aW9uKCB2LCBrICkge1xuXHRcdFx0XHRcdHJldHVybiB2LmdldCggXCJpZFwiICk7XG5cdFx0XHRcdH0gKTtcblx0XHRcdHJldHVybiBpZHM7XG5cblx0XHR9XG5cblxuXHR9ICk7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuTW9kZWxzLkF2YWlsYWJsZVRpbWVNb2RlbDtcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0QXBwLk1vZGVscy5DaGFydERhdGFNb2RlbCA9IEJhY2tib25lLk1vZGVsLmV4dGVuZCgge1xuXG5cdFx0ZGVmYXVsdHM6IHt9LFxuXG5cdFx0dXJsUm9vdDogR2xvYmFsLnJvb3RVcmwgKyBcIi9kYXRhL2RpbWVuc2lvbnNcIixcblx0XHRcblx0XHQvKnVybDogZnVuY3Rpb24oKXtcblxuXHRcdFx0dmFyIGF0dHJzID0gdGhpcy5hdHRyaWJ1dGVzLFxuXHRcdFx0XHR1cmwgPSB0aGlzLnVybFJvb3QgKyBcIj9cIjtcblxuXHRcdFx0Ly9hZGQgYWxsIGF0dHJpYnV0ZXMgdG8gdXJsXG5cdFx0XHRfLmVhY2goIGF0dHJzLCBmdW5jdGlvbiggdiwgaSApIHtcblx0XHRcdFx0dXJsICs9IGkgKyBcIj1cIiArIHY7XG5cdFx0XHRcdHVybCArPSBcIiZcIjtcblx0XHRcdH0gKTtcblxuXHRcdFx0cmV0dXJuIHVybDtcblxuXHRcdH0sKi9cblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uICgpIHtcblxuXHRcdH0sXG5cblx0fSApO1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLk1vZGVscy5DaGFydERhdGFNb2RlbDtcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0QXBwLk1vZGVscy5DaGFydERpbWVuc2lvbnNNb2RlbCA9IEJhY2tib25lLk1vZGVsLmV4dGVuZCgge1xuXG5cdFx0dXJsUm9vdDogR2xvYmFsLnJvb3RVcmwgKyAnL2NoYXJ0VHlwZXMvJyxcblxuXHRcdGRlZmF1bHRzOiB7fSxcblxuXHRcdGxvYWRDb25maWd1cmF0aW9uOiBmdW5jdGlvbiggY2hhcnRUeXBlSWQgKSB7XG5cblx0XHRcdHRoaXMuc2V0KCBcImlkXCIsIGNoYXJ0VHlwZUlkICk7XG5cdFx0XHR0aGlzLmZldGNoKCB7XG5cdFx0XHRcdHN1Y2Nlc3M6IGZ1bmN0aW9uKCByZXNwb25zZSApIHtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXG5cdFx0fVxuXG5cdH0gKTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5Nb2RlbHMuQ2hhcnREaW1lbnNpb25zTW9kZWw7XG5cbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdEFwcC5Nb2RlbHMuQ2hhcnRNb2RlbCA9IEJhY2tib25lLk1vZGVsLmV4dGVuZCgge1xuXG5cdFx0Ly91cmxSb290OiBHbG9iYWwucm9vdFVybCArICcvY2hhcnRzLycsXG5cdFx0Ly91cmxSb290OiBHbG9iYWwucm9vdFVybCArICcvZGF0YS9jb25maWcvJyxcblx0XHR1cmw6IGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYoICQoXCIjZm9ybS12aWV3XCIpLmxlbmd0aCApIHtcblx0XHRcdFx0aWYoIHRoaXMuaWQgKSB7XG5cdFx0XHRcdFx0Ly9lZGl0aW5nIGV4aXN0aW5nXG5cdFx0XHRcdFx0cmV0dXJuIEdsb2JhbC5yb290VXJsICsgXCIvY2hhcnRzL1wiICsgdGhpcy5pZDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvL3NhdmluZyBuZXdcblx0XHRcdFx0XHRyZXR1cm4gR2xvYmFsLnJvb3RVcmwgKyBcIi9jaGFydHNcIjtcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiBHbG9iYWwucm9vdFVybCArIFwiL2RhdGEvY29uZmlnL1wiICsgdGhpcy5pZDtcblx0XHRcdH1cblx0XHR9LFxuXG5cdFx0ZGVmYXVsdHM6IHtcblx0XHRcdFwiY2FjaGVcIjogdHJ1ZSxcblx0XHRcdFwic2VsZWN0ZWQtY291bnRyaWVzXCI6IFtdLFxuXHRcdFx0XCJ0YWJzXCI6IFsgXCJjaGFydFwiLCBcImRhdGFcIiwgXCJzb3VyY2VzXCIgXSxcblx0XHRcdFwibGluZS10eXBlXCI6IFwiMlwiLFxuXHRcdFx0XCJjaGFydC1kZXNjcmlwdGlvblwiOiBcIlwiLFxuXHRcdFx0XCJjaGFydC1kaW1lbnNpb25zXCI6IFtdLFxuXHRcdFx0XCJ2YXJpYWJsZXNcIjogW10sXG5cdFx0XHRcInktYXhpc1wiOiB7fSxcblx0XHRcdFwieC1heGlzXCI6IHt9LFxuXHRcdFx0XCJtYXJnaW5zXCI6IHsgdG9wOiAxMCwgbGVmdDogNjAsIGJvdHRvbTogMTAsIHJpZ2h0OiAxMCB9LFxuXHRcdFx0XCJ1bml0c1wiOiBcIlwiLFxuXHRcdFx0XCJpZnJhbWUtd2lkdGhcIjogXCIxMDAlXCIsXG5cdFx0XHRcImlmcmFtZS1oZWlnaHRcIjogXCI2NjBweFwiLFxuXHRcdFx0XCJoaWRlLWxlZ2VuZFwiOiBmYWxzZSxcblx0XHRcdFwiZ3JvdXAtYnktdmFyaWFibGVzXCI6IGZhbHNlLFxuXHRcdFx0XCJhZGQtY291bnRyeS1tb2RlXCI6IFwiYWRkLWNvdW50cnlcIixcblx0XHRcdFwieC1heGlzLXNjYWxlLXNlbGVjdG9yXCI6IGZhbHNlLFxuXHRcdFx0XCJ5LWF4aXMtc2NhbGUtc2VsZWN0b3JcIjogZmFsc2UsXG5cdFx0XHRcIm1hcC1jb25maWdcIjoge1xuXHRcdFx0XHRcInZhcmlhYmxlSWRcIjogLTEsXG5cdFx0XHRcdFwibWluWWVhclwiOiAxOTgwLFxuXHRcdFx0XHRcIm1heFllYXJcIjogMjAwMCxcblx0XHRcdFx0XCJ0YXJnZXRZZWFyXCI6IDE5ODAsXG5cdFx0XHRcdFwibW9kZVwiOiBcInNwZWNpZmljXCIsXG5cdFx0XHRcdFwidGltZVRvbGVyYW5jZVwiOiAxMCxcblx0XHRcdFx0XCJ0aW1lSW50ZXJ2YWxcIjogMTAsXG5cdFx0XHRcdFwiY29sb3JTY2hlbWVOYW1lXCI6IFwiQnVHblwiLFxuXHRcdFx0XHRcImNvbG9yU2NoZW1lSW50ZXJ2YWxcIjogNSxcblx0XHRcdFx0XCJwcm9qZWN0aW9uXCI6IFwiV29ybGRcIixcblx0XHRcdH1cblx0XHR9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oKSB7XG5cblx0XHRcdHRoaXMub24oIFwic3luY1wiLCB0aGlzLm9uU3luYywgdGhpcyApO1xuXHRcdFxuXHRcdH0sXG5cblx0XHRvblN5bmM6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHRpZiggdGhpcy5nZXQoIFwiY2hhcnQtdHlwZVwiICkgPT0gMiApIHtcblx0XHRcdFx0Ly9tYWtlIHN1cmUgZm9yIHNjYXR0ZXIgcGxvdCwgd2UgaGF2ZSBjb2xvciBzZXQgYXMgY29udGluZW50c1xuXHRcdFx0XHR2YXIgY2hhcnREaW1lbnNpb25zID0gJC5wYXJzZUpTT04oIHRoaXMuZ2V0KCBcImNoYXJ0LWRpbWVuc2lvbnNcIiApICk7XG5cdFx0XHRcdGlmKCAhXy5maW5kV2hlcmUoIGNoYXJ0RGltZW5zaW9ucywgeyBcInByb3BlcnR5XCI6IFwiY29sb3JcIiB9ICkgKSB7XG5cdFx0XHRcdFx0Ly90aGlzIGlzIHdoZXJlIHdlIGFkZCBjb2xvciBwcm9wZXJ0eVxuXHRcdFx0XHRcdHZhciBjb2xvclByb3BPYmogPSB7IFwidmFyaWFibGVJZFwiOlwiMTIzXCIsXCJwcm9wZXJ0eVwiOlwiY29sb3JcIixcInVuaXRcIjpcIlwiLFwibmFtZVwiOlwiQ29sb3JcIixcInBlcmlvZFwiOlwic2luZ2xlXCIsXCJtb2RlXCI6XCJzcGVjaWZpY1wiLFwidGFyZ2V0WWVhclwiOlwiMjAwMFwiLFwidG9sZXJhbmNlXCI6XCI1XCIsXCJtYXhpbXVtQWdlXCI6XCI1XCJ9O1xuXHRcdFx0XHRcdGNoYXJ0RGltZW5zaW9ucy5wdXNoKCBjb2xvclByb3BPYmogKTtcblx0XHRcdFx0XHR2YXIgY2hhckRpbWVuc2lvbnNTdHJpbmcgPSBKU09OLnN0cmluZ2lmeSggY2hhcnREaW1lbnNpb25zICk7XG5cdFx0XHRcdFx0dGhpcy5zZXQoIFwiY2hhcnQtZGltZW5zaW9uc1wiLCBjaGFyRGltZW5zaW9uc1N0cmluZyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRcblx0XHR9LFxuXG5cdFx0YWRkU2VsZWN0ZWRDb3VudHJ5OiBmdW5jdGlvbiggY291bnRyeSApIHtcblxuXHRcdFx0Ly9tYWtlIHN1cmUgd2UncmUgdXNpbmcgb2JqZWN0LCBub3QgYXNzb2NpYXRpdmUgYXJyYXlcblx0XHRcdC8qaWYoICQuaXNBcnJheSggdGhpcy5nZXQoIFwic2VsZWN0ZWQtY291bnRyaWVzXCIgKSApICkge1xuXHRcdFx0XHQvL3dlIGdvdCBlbXB0eSBhcnJheSBmcm9tIGRiLCBjb252ZXJ0IHRvIG9iamVjdFxuXHRcdFx0XHR0aGlzLnNldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiwge30gKTtcblx0XHRcdH0qL1xuXHRcdFx0XG5cdFx0XHR2YXIgc2VsZWN0ZWRDb3VudHJpZXMgPSB0aGlzLmdldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiApO1xuXG5cdFx0XHQvL21ha2Ugc3VyZSB0aGUgc2VsZWN0ZWQgY29udHJ5IGlzIG5vdCB0aGVyZSBcblx0XHRcdGlmKCAhXy5maW5kV2hlcmUoIHNlbGVjdGVkQ291bnRyaWVzLCB7IGlkOiBjb3VudHJ5LmlkIH0gKSApIHtcblx0XHRcdFxuXHRcdFx0XHRzZWxlY3RlZENvdW50cmllcy5wdXNoKCBjb3VudHJ5ICk7XG5cdFx0XHRcdC8vc2VsZWN0ZWRDb3VudHJpZXNbIGNvdW50cnkuaWQgXSA9IGNvdW50cnk7XG5cdFx0XHRcdHRoaXMudHJpZ2dlciggXCJjaGFuZ2U6c2VsZWN0ZWQtY291bnRyaWVzXCIgKTtcblx0XHRcdFx0dGhpcy50cmlnZ2VyKCBcImNoYW5nZVwiICk7XG5cdFx0XHRcblx0XHRcdH1cblx0XHRcdFxuXHRcdH0sXG5cblx0XHR1cGRhdGVTZWxlY3RlZENvdW50cnk6IGZ1bmN0aW9uKCBjb3VudHJ5SWQsIGNvbG9yICkge1xuXG5cdFx0XHR2YXIgY291bnRyeSA9IHRoaXMuZmluZENvdW50cnlCeUlkKCBjb3VudHJ5SWQgKTtcblx0XHRcdGlmKCBjb3VudHJ5ICkge1xuXHRcdFx0XHRjb3VudHJ5LmNvbG9yID0gY29sb3I7XG5cdFx0XHRcdHRoaXMudHJpZ2dlciggXCJjaGFuZ2U6c2VsZWN0ZWQtY291bnRyaWVzXCIgKTtcblx0XHRcdFx0dGhpcy50cmlnZ2VyKCBcImNoYW5nZVwiICk7XG5cdFx0XHR9XG5cblx0XHR9LFxuXG5cdFx0cmVtb3ZlU2VsZWN0ZWRDb3VudHJ5OiBmdW5jdGlvbiggY291bnRyeUlkICkge1xuXG5cdFx0XHR2YXIgY291bnRyeSA9IHRoaXMuZmluZENvdW50cnlCeUlkKCBjb3VudHJ5SWQgKTtcblx0XHRcdGlmKCBjb3VudHJ5ICkge1xuXHRcdFx0XHR2YXIgc2VsZWN0ZWRDb3VudHJpZXMgPSB0aGlzLmdldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiApLFxuXHRcdFx0XHRcdGNvdW50cnlJbmRleCA9IF8uaW5kZXhPZiggc2VsZWN0ZWRDb3VudHJpZXMsIGNvdW50cnkgKTtcblx0XHRcdFx0c2VsZWN0ZWRDb3VudHJpZXMuc3BsaWNlKCBjb3VudHJ5SW5kZXgsIDEgKTtcblx0XHRcdFx0dGhpcy50cmlnZ2VyKCBcImNoYW5nZTpzZWxlY3RlZC1jb3VudHJpZXNcIiApO1xuXHRcdFx0XHR0aGlzLnRyaWdnZXIoIFwiY2hhbmdlXCIgKTtcblx0XHRcdH1cblxuXHRcdH0sXG5cblx0XHRyZXBsYWNlU2VsZWN0ZWRDb3VudHJ5OiBmdW5jdGlvbiggY291bnRyeSApIHtcblx0XHRcdGlmKCBjb3VudHJ5ICkge1xuXHRcdFx0XHR0aGlzLnNldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiwgWyBjb3VudHJ5IF0gKTtcblx0XHRcdH1cblx0XHR9LFxuXG5cdFx0ZmluZENvdW50cnlCeUlkOiBmdW5jdGlvbiggY291bnRyeUlkICkge1xuXG5cdFx0XHR2YXIgc2VsZWN0ZWRDb3VudHJpZXMgPSB0aGlzLmdldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiApLFxuXHRcdFx0XHRjb3VudHJ5ID0gXy5maW5kV2hlcmUoIHNlbGVjdGVkQ291bnRyaWVzLCB7IGlkOiBjb3VudHJ5SWQudG9TdHJpbmcoKSB9ICk7XG5cdFx0XHRyZXR1cm4gY291bnRyeTtcblxuXHRcdH0sXG5cblx0XHRzZXRBeGlzQ29uZmlnOiBmdW5jdGlvbiggYXhpc05hbWUsIHByb3AsIHZhbHVlICkge1xuXG5cdFx0XHRpZiggJC5pc0FycmF5KCB0aGlzLmdldCggXCJ5LWF4aXNcIiApICkgKSB7XG5cdFx0XHRcdC8vd2UgZ290IGVtcHR5IGFycmF5IGZyb20gZGIsIGNvbnZlcnQgdG8gb2JqZWN0XG5cdFx0XHRcdHRoaXMuc2V0KCBcInktYXhpc1wiLCB7fSApO1xuXHRcdFx0fVxuXHRcdFx0aWYoICQuaXNBcnJheSggdGhpcy5nZXQoIFwieC1heGlzXCIgKSApICkge1xuXHRcdFx0XHQvL3dlIGdvdCBlbXB0eSBhcnJheSBmcm9tIGRiLCBjb252ZXJ0IHRvIG9iamVjdFxuXHRcdFx0XHR0aGlzLnNldCggXCJ4LWF4aXNcIiwge30gKTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0dmFyIGF4aXMgPSB0aGlzLmdldCggYXhpc05hbWUgKTtcblx0XHRcdGlmKCBheGlzICkge1xuXHRcdFx0XHRheGlzWyBwcm9wIF0gPSB2YWx1ZTtcblx0XHRcdH1cblx0XHRcdHRoaXMudHJpZ2dlciggXCJjaGFuZ2VcIiApO1xuXG5cdFx0fSxcblxuXHRcdHVwZGF0ZVZhcmlhYmxlczogZnVuY3Rpb24oIG5ld1ZhciApIHtcblx0XHRcdC8vY29weSBhcnJheVxuXHRcdFx0dmFyIHZhcmlhYmxlcyA9IHRoaXMuZ2V0KCBcInZhcmlhYmxlc1wiICkuc2xpY2UoKSxcblx0XHRcdFx0dmFySW5BcnIgPSBfLmZpbmQoIHZhcmlhYmxlcywgZnVuY3Rpb24oIHYgKXsgcmV0dXJuIHYuaWQgPT0gbmV3VmFyLmlkOyB9ICk7XG5cblx0XHRcdGlmKCAhdmFySW5BcnIgKSB7XG5cdFx0XHRcdHZhcmlhYmxlcy5wdXNoKCBuZXdWYXIgKTtcblx0XHRcdFx0dGhpcy5zZXQoIFwidmFyaWFibGVzXCIsIHZhcmlhYmxlcyApO1xuXHRcdFx0fVxuXHRcdH0sXG5cblx0XHRyZW1vdmVWYXJpYWJsZTogZnVuY3Rpb24oIHZhcklkVG9SZW1vdmUgKSB7XG5cdFx0XHQvL2NvcHkgYXJyYXlcblx0XHRcdHZhciB2YXJpYWJsZXMgPSB0aGlzLmdldCggXCJ2YXJpYWJsZXNcIiApLnNsaWNlKCksXG5cdFx0XHRcdHZhckluQXJyID0gXy5maW5kKCB2YXJpYWJsZXMsIGZ1bmN0aW9uKCB2ICl7IHJldHVybiB2LmlkID09IG5ld1Zhci5pZDsgfSApO1xuXG5cdFx0XHRpZiggIXZhckluQXJyICkge1xuXHRcdFx0XHR2YXJpYWJsZXMucHVzaCggbmV3VmFyICk7XG5cdFx0XHRcdHRoaXMuc2V0KCBcInZhcmlhYmxlc1wiLCB2YXJpYWJsZXMgKTtcblx0XHRcdH1cblx0XHR9LFxuXG5cdFx0dXBkYXRlTWFwQ29uZmlnOiBmdW5jdGlvbiggcHJvcE5hbWUsIHByb3BWYWx1ZSwgc2lsZW50LCBldmVudE5hbWUgKSB7XG5cblx0XHRcdHZhciBtYXBDb25maWcgPSB0aGlzLmdldCggXCJtYXAtY29uZmlnXCIgKTtcblx0XHRcdGlmKCBtYXBDb25maWcuaGFzT3duUHJvcGVydHkoIHByb3BOYW1lICkgKSB7XG5cdFx0XHRcdG1hcENvbmZpZ1sgcHJvcE5hbWUgXSA9IHByb3BWYWx1ZTtcblx0XHRcdFx0aWYoICFzaWxlbnQgKSB7XG5cdFx0XHRcdFx0dmFyIGV2dCA9ICggZXZlbnROYW1lICk/IGV2ZW50TmFtZTogXCJjaGFuZ2VcIjtcblx0XHRcdFx0XHR0aGlzLnRyaWdnZXIoIGV2dCApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHR9XG5cblxuXHR9ICk7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuTW9kZWxzLkNoYXJ0TW9kZWw7XG5cbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdEFwcC5Nb2RlbHMuQ2hhcnRWYXJpYWJsZU1vZGVsID0gQmFja2JvbmUuTW9kZWwuZXh0ZW5kKCB7XG5cdFx0XG5cdFx0ZGVmYXVsdHM6IHt9XG5cblx0fSApO1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLk1vZGVscy5DaGFydFZhcmlhYmxlTW9kZWw7XG5cbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdEFwcC5Nb2RlbHMuRW50aXR5TW9kZWwgPSBCYWNrYm9uZS5Nb2RlbC5leHRlbmQoIHtcblx0XHRcblx0XHR1cmxSb290OiBHbG9iYWwucm9vdFVybCArIFwiL2VudGl0eS9cIixcblx0XHRkZWZhdWx0czogeyBcImlkXCI6IFwiXCIsIFwibmFtZVwiOiBcIlwiLCBcInZhbHVlc1wiOiBbXSB9LFxuXG5cdFx0aW1wb3J0OiBmdW5jdGlvbigpIHtcblxuXHRcdFx0Ly9zdHJpcCBpZCwgc28gdGhhdCBiYWNrYm9uZSB1c2VzIHN0b3JlIFxuXHRcdFx0dGhpcy5zZXQoIFwiaWRcIiwgbnVsbCApO1xuXG5cdFx0XHR0aGlzLnVybCA9IHRoaXMudXJsUm9vdCArICdpbXBvcnQnO1xuXG5cdFx0XHR0aGlzLnNhdmUoKTtcblxuXHRcdH1cblxuXHR9ICk7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuTW9kZWxzLkVudGl0eU1vZGVsO1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIEhlYWRlciA9IHJlcXVpcmUoIFwiLi9jaGFydC9BcHAuVmlld3MuQ2hhcnQuSGVhZGVyLmpzXCIgKSxcblx0XHRTY2FsZVNlbGVjdG9ycyA9IHJlcXVpcmUoIFwiLi9jaGFydC9BcHAuVmlld3MuQ2hhcnQuU2NhbGVTZWxlY3RvcnNcIiApLFxuXHRcdENoYXJ0VGFiID0gcmVxdWlyZSggXCIuL2NoYXJ0L0FwcC5WaWV3cy5DaGFydC5DaGFydFRhYi5qc1wiICksXG5cdFx0RGF0YVRhYiA9IHJlcXVpcmUoIFwiLi9jaGFydC9BcHAuVmlld3MuQ2hhcnQuRGF0YVRhYi5qc1wiICksXG5cdFx0U291cmNlc1RhYiA9IHJlcXVpcmUoIFwiLi9jaGFydC9BcHAuVmlld3MuQ2hhcnQuU291cmNlc1RhYi5qc1wiICksXG5cdFx0TWFwVGFiID0gcmVxdWlyZSggXCIuL2NoYXJ0L0FwcC5WaWV3cy5DaGFydC5NYXBUYWIuanNcIiApLFxuXHRcdENoYXJ0RGF0YU1vZGVsID0gcmVxdWlyZSggXCIuLy4uL21vZGVscy9BcHAuTW9kZWxzLkNoYXJ0RGF0YU1vZGVsLmpzXCIgKSxcblx0XHRVdGlscyA9IHJlcXVpcmUoIFwiLi8uLi9BcHAuVXRpbHMuanNcIiApO1xuXG5cdEFwcC5WaWV3cy5DaGFydFZpZXcgPSBCYWNrYm9uZS5WaWV3LmV4dGVuZCh7XG5cblx0XHRlbDogXCIjY2hhcnQtdmlld1wiLFxuXHRcdGV2ZW50czoge1xuXHRcdFx0XCJjbGljayAuY2hhcnQtc2F2ZS1wbmctYnRuXCI6IFwiZXhwb3J0Q29udGVudFwiLFxuXHRcdFx0XCJjbGljayAuY2hhcnQtc2F2ZS1zdmctYnRuXCI6IFwiZXhwb3J0Q29udGVudFwiXG5cdFx0fSxcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0XG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIgPSBvcHRpb25zLmRpc3BhdGNoZXI7XG5cdFx0XHRcblx0XHRcdHZhciBjaGlsZFZpZXdPcHRpb25zID0geyBkaXNwYXRjaGVyOiB0aGlzLmRpc3BhdGNoZXIsIHBhcmVudFZpZXc6IHRoaXMgfTtcblx0XHRcdHRoaXMuaGVhZGVyID0gbmV3IEhlYWRlciggY2hpbGRWaWV3T3B0aW9ucyApO1xuXHRcdFx0dGhpcy5zY2FsZVNlbGVjdG9ycyA9IG5ldyBTY2FsZVNlbGVjdG9ycyggY2hpbGRWaWV3T3B0aW9ucyApO1xuXHRcdFx0Ly90YWJzXG5cdFx0XHR0aGlzLmNoYXJ0VGFiID0gbmV3IENoYXJ0VGFiKCBjaGlsZFZpZXdPcHRpb25zICk7XG5cdFx0XHR0aGlzLmRhdGFUYWIgPSBuZXcgRGF0YVRhYiggY2hpbGRWaWV3T3B0aW9ucyApO1xuXHRcdFx0dGhpcy5zb3VyY2VzVGFiID0gbmV3IFNvdXJjZXNUYWIoIGNoaWxkVmlld09wdGlvbnMgKTtcblx0XHRcdHRoaXMubWFwVGFiID0gbmV3IE1hcFRhYiggY2hpbGRWaWV3T3B0aW9ucyApO1xuXG5cdFx0XHQvL3NldHVwIG1vZGVsIHRoYXQgd2lsbCBmZXRjaCBhbGwgdGhlIGRhdGEgZm9yIHVzXG5cdFx0XHR0aGlzLmRhdGFNb2RlbCA9IG5ldyBDaGFydERhdGFNb2RlbCgpO1xuXHRcdFx0XG5cdFx0XHQvL3NldHVwIGV2ZW50c1xuXHRcdFx0dGhpcy5kYXRhTW9kZWwub24oIFwic3luY1wiLCB0aGlzLm9uRGF0YU1vZGVsU3luYywgdGhpcyApO1xuXHRcdFx0dGhpcy5kYXRhTW9kZWwub24oIFwiZXJyb3JcIiwgdGhpcy5vbkRhdGFNb2RlbEVycm9yLCB0aGlzICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5vbiggXCJjaGFuZ2VcIiwgdGhpcy5vbkNoYXJ0TW9kZWxDaGFuZ2UsIHRoaXMgKTtcblxuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblxuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cblx0XHRcdHRoaXMuJHByZWxvYWRlciA9IHRoaXMuJGVsLmZpbmQoIFwiLmNoYXJ0LXByZWxvYWRlclwiICk7XG5cdFx0XHR0aGlzLiRlcnJvciA9IHRoaXMuJGVsLmZpbmQoIFwiLmNoYXJ0LWVycm9yXCIgKTtcblxuXHRcdFx0Ly9jaGFydCB0YWJcblx0XHRcdHRoaXMuJHN2ZyA9IHRoaXMuJGVsLmZpbmQoIFwiI2NoYXJ0LWNoYXJ0LXRhYiBzdmdcIiApO1xuXHRcdFx0dGhpcy4kdGFiQ29udGVudCA9IHRoaXMuJGVsLmZpbmQoIFwiLnRhYi1jb250ZW50XCIgKTtcblx0XHRcdHRoaXMuJHRhYlBhbmVzID0gdGhpcy4kZWwuZmluZCggXCIudGFiLXBhbmVcIiApO1xuXHRcdFx0dGhpcy4kY2hhcnRIZWFkZXIgPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1oZWFkZXJcIiApO1xuXHRcdFx0dGhpcy4kZW50aXRpZXNTZWxlY3QgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPWF2YWlsYWJsZV9lbnRpdGllc11cIiApO1xuXHRcdFx0dGhpcy4kY2hhcnRGb290ZXIgPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1mb290ZXJcIiApO1xuXHRcdFx0dGhpcy4kY2hhcnROYW1lID0gdGhpcy4kZWwuZmluZCggXCIuY2hhcnQtbmFtZVwiICk7XG5cdFx0XHR0aGlzLiRjaGFydFN1Ym5hbWUgPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1zdWJuYW1lXCIgKTtcblx0XHRcdHRoaXMuJGNoYXJ0RGVzY3JpcHRpb24gPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1kZXNjcmlwdGlvblwiICk7XG5cdFx0XHR0aGlzLiRjaGFydFNvdXJjZXMgPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1zb3VyY2VzXCIgKTtcblx0XHRcdHRoaXMuJGNoYXJ0RnVsbFNjcmVlbiA9IHRoaXMuJGVsLmZpbmQoIFwiLmZhbmN5Ym94LWlmcmFtZVwiICk7XG5cblx0XHRcdHRoaXMuJHhBeGlzU2NhbGVTZWxlY3RvciA9IHRoaXMuJGVsLmZpbmQoIFwiLngtYXhpcy1zY2FsZS1zZWxlY3RvclwiICk7XG5cdFx0XHR0aGlzLiR4QXhpc1NjYWxlID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT14X2F4aXNfc2NhbGVdXCIgKTtcblx0XHRcdHRoaXMuJHlBeGlzU2NhbGVTZWxlY3RvciA9IHRoaXMuJGVsLmZpbmQoIFwiLnktYXhpcy1zY2FsZS1zZWxlY3RvclwiICk7XG5cdFx0XHR0aGlzLiR5QXhpc1NjYWxlID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT15X2F4aXNfc2NhbGVdXCIgKTtcblxuXHRcdFx0dGhpcy4kcmVsb2FkQnRuID0gdGhpcy4kZWwuZmluZCggXCIucmVsb2FkLWJ0blwiICk7XG5cblx0XHRcdHZhciBjaGFydE5hbWUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtbmFtZVwiICksXG5cdFx0XHRcdGFkZENvdW50cnlNb2RlID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImFkZC1jb3VudHJ5LW1vZGVcIiApLFxuXHRcdFx0XHRmb3JtQ29uZmlnID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImZvcm0tY29uZmlnXCIgKSxcblx0XHRcdFx0ZW50aXRpZXMgPSAoIGZvcm1Db25maWcgJiYgZm9ybUNvbmZpZ1sgXCJlbnRpdGllcy1jb2xsZWN0aW9uXCIgXSApPyBmb3JtQ29uZmlnWyBcImVudGl0aWVzLWNvbGxlY3Rpb25cIiBdOiBbXSxcblx0XHRcdFx0c2VsZWN0ZWRDb3VudHJpZXMgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwic2VsZWN0ZWQtY291bnRyaWVzXCIgKSxcblx0XHRcdFx0c2VsZWN0ZWRDb3VudHJpZXNJZHMgPSBfLm1hcCggc2VsZWN0ZWRDb3VudHJpZXMsIGZ1bmN0aW9uKCB2ICkgeyByZXR1cm4gKHYpPyArdi5pZDogXCJcIjsgfSApLFxuXHRcdFx0XHRjaGFydFRpbWUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdGltZVwiICk7XG5cdFx0XHRcdFxuXHRcdFx0Ly9taWdodCBuZWVkIHRvIHJlcGxhY2UgY291bnRyeSBpbiB0aXRsZSwgaWYgXCJjaGFuZ2UgY291bnRyeVwiIG1vZGVcblx0XHRcdGlmKCBhZGRDb3VudHJ5TW9kZSA9PT0gXCJjaGFuZ2UtY291bnRyeVwiICkge1xuXHRcdFx0XHQvL3llcCwgcHJvYmFibHkgbmVlZCByZXBsYWNpbmcgY291bnRyeSBpbiB0aXRsZSAoc2VsZWN0IGZpcnN0IGNvdW50cnkgZm9ybSBzdG9yZWQgb25lKVxuXHRcdFx0XHRpZiggc2VsZWN0ZWRDb3VudHJpZXMgJiYgc2VsZWN0ZWRDb3VudHJpZXMubGVuZ3RoICkge1xuXHRcdFx0XHRcdHZhciBjb3VudHJ5ID0gc2VsZWN0ZWRDb3VudHJpZXNbMF07XG5cdFx0XHRcdFx0Y2hhcnROYW1lID0gY2hhcnROYW1lLnJlcGxhY2UoIFwiKmNvdW50cnkqXCIsIGNvdW50cnkubmFtZSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vdXBkYXRlIHZhbHVlc1xuXHRcdFx0dGhpcy4kY2hhcnROYW1lLnRleHQoIGNoYXJ0TmFtZSApO1xuXHRcdFx0dGhpcy4kY2hhcnRTdWJuYW1lLmh0bWwoIEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC1zdWJuYW1lXCIgKSApO1xuXG5cdFx0XHR2YXIgY2hhcnREZXNjcmlwdGlvbiA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC1kZXNjcmlwdGlvblwiICk7XG5cdFx0XHQvL3RoaXMuJGNoYXJ0RGVzY3JpcHRpb24udGV4dCggQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LWRlc2NyaXB0aW9uXCIgKSApO1xuXG5cdFx0XHQvL3Nob3cvaGlkZSBzY2FsZSBzZWxlY3RvcnNcblx0XHRcdHZhciBzaG93WFNjYWxlU2VsZWN0b3JzID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcIngtYXhpcy1zY2FsZS1zZWxlY3RvclwiICk7XG5cdFx0XHRpZiggc2hvd1hTY2FsZVNlbGVjdG9ycyApIHtcblx0XHRcdFx0dGhpcy4keEF4aXNTY2FsZVNlbGVjdG9yLnNob3coKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuJHhBeGlzU2NhbGVTZWxlY3Rvci5oaWRlKCk7XG5cdFx0XHR9XG5cdFx0XHR2YXIgc2hvd1lTY2FsZVNlbGVjdG9ycyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJ5LWF4aXMtc2NhbGUtc2VsZWN0b3JcIiApO1xuXHRcdFx0aWYoIHNob3dZU2NhbGVTZWxlY3RvcnMgKSB7XG5cdFx0XHRcdHRoaXMuJHlBeGlzU2NhbGVTZWxlY3Rvci5zaG93KCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLiR5QXhpc1NjYWxlU2VsZWN0b3IuaGlkZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHQvL3VwZGF0ZSBjb3VudHJpZXNcblx0XHRcdHRoaXMuJGVudGl0aWVzU2VsZWN0LmVtcHR5KCk7XG5cdFx0XHRpZiggc2VsZWN0ZWRDb3VudHJpZXNJZHMubGVuZ3RoICkge1xuXHRcdFx0XHQvL2FwcGVuZCBlbXB0eSBkZWZhdWx0IG9wdGlvblxuXHRcdFx0XHR0aGF0LiRlbnRpdGllc1NlbGVjdC5hcHBlbmQoIFwiPG9wdGlvbiBkaXNhYmxlZCBzZWxlY3RlZD5TZWxlY3QgY291bnRyeTwvb3B0aW9uPlwiICk7XG5cdFx0XHRcdF8uZWFjaCggZW50aXRpZXMsIGZ1bmN0aW9uKCBkLCBpICkge1xuXHRcdFx0XHRcdC8vYWRkIG9ubHkgdGhvc2UgZW50aXRpZXMsIHdoaWNoIGFyZSBub3Qgc2VsZWN0ZWQgYWxyZWFkeVxuXHRcdFx0XHRcdGlmKCBfLmluZGV4T2YoIHNlbGVjdGVkQ291bnRyaWVzSWRzLCArZC5pZCApID09IC0xICkge1xuXHRcdFx0XHRcdFx0dGhhdC4kZW50aXRpZXNTZWxlY3QuYXBwZW5kKCBcIjxvcHRpb24gdmFsdWU9J1wiICsgZC5pZCArIFwiJz5cIiArIGQubmFtZSArIFwiPC9vcHRpb24+XCIgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gKTtcblx0XHRcdH1cblx0XHRcdC8vbWFrZSBjaG9zZW4gdXBkYXRlLCBtYWtlIHN1cmUgaXQgbG9vc2VzIGJsdXIgYXMgd2VsbFxuXHRcdFx0dGhpcy4kZW50aXRpZXNTZWxlY3QudHJpZ2dlciggXCJjaG9zZW46dXBkYXRlZFwiICk7XG5cblx0XHRcdHRoaXMuJGNoYXJ0RnVsbFNjcmVlbi5vbiggXCJjbGlja1wiLCBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0dmFyICR0aGlzID0gJCggdGhpcyApO1xuXHRcdFx0XHR3aW5kb3cucGFyZW50Lm9wZW5GYW5jeUJveCggJHRoaXMuYXR0ciggXCJocmVmXCIgKSApO1xuXHRcdFx0fSApO1xuXG5cdFx0XHQvL3JlZnJlc2ggYnRuXG5cdFx0XHR0aGlzLiRyZWxvYWRCdG4ub24oIFwiY2xpY2tcIiwgZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKTtcblx0XHRcdH0gKTtcblxuXHRcdFx0Ly9jaGFydCB0YWJcblx0XHRcdHRoaXMuJGNoYXJ0VGFiID0gdGhpcy4kZWwuZmluZCggXCIjY2hhcnQtY2hhcnQtdGFiXCIgKTtcblxuXHRcdFx0dmFyIGRpbWVuc2lvbnNTdHJpbmcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtZGltZW5zaW9uc1wiICksXG5cdFx0XHRcdHZhbGlkRGltZW5zaW9ucyA9IGZhbHNlO1xuXHRcdFx0XG5cdFx0XHQvL2NsaWNraW5nIGFueXRoaW5nIGluIGNoYXJ0IHNvdXJjZSB3aWxsIHRha2UgeW91IHRvIHNvdXJjZXMgdGFiXG5cdFx0XHR0aGlzLiRjaGFydFNvdXJjZXMub24oIFwiY2xpY2tcIiwgZnVuY3Rpb24oZXZ0KSB7XG5cdFx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHR2YXIgJGEgPSAkKCBcIltocmVmPScjc291cmNlcy1jaGFydC10YWInXVwiICk7XG5cdFx0XHRcdCRhLnRyaWdnZXIoIFwiY2xpY2tcIiApO1xuXHRcdFx0fSApO1xuXG5cdFx0XHQvL2NoZWNrIHdlIGhhdmUgYWxsIGRpbWVuc2lvbnMgbmVjZXNzYXJ5IFxuXHRcdFx0aWYoICEkLmlzRW1wdHlPYmplY3QoIGRpbWVuc2lvbnNTdHJpbmcgKSApIHtcblx0XHRcdFx0dmFyIGRpbWVuc2lvbiA9ICQucGFyc2VKU09OKCBkaW1lbnNpb25zU3RyaW5nICk7XG5cdFx0XHRcdHZhbGlkRGltZW5zaW9ucyA9IFV0aWxzLmNoZWNrVmFsaWREaW1lbnNpb25zKCBkaW1lbnNpb24sIEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10eXBlXCIgKSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vbWFrZSBzdXJlIHRvIGFwcGVhciBvbmx5IGZpcnN0IHRhYiB0YWJzIHRoYXQgYXJlIG5lY2Vzc2FyeVxuXHRcdFx0Ly9hcHBlYXIgb25seSBmaXJzdCB0YWIgaWYgbm9uZSB2aXNpYmxlXG5cdFx0XHRpZiggIXRoaXMuJHRhYlBhbmVzLmZpbHRlciggXCIuYWN0aXZlXCIgKS5sZW5ndGggKSB7XG5cdFx0XHRcdHZhciB0YWJzID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcInRhYnNcIiApLFxuXHRcdFx0XHRcdGZpcnN0VGFiTmFtZSA9IHRhYnNbIDAgXSxcblx0XHRcdFx0XHRmaXJzdFRhYlBhbmUgPSB0aGlzLiR0YWJQYW5lcy5maWx0ZXIoIFwiI1wiICsgZmlyc3RUYWJOYW1lICsgXCItY2hhcnQtdGFiXCIgKTtcblx0XHRcdFx0Zmlyc3RUYWJQYW5lLmFkZENsYXNzKCBcImFjdGl2ZVwiICk7XG5cdFx0XHRcdGlmKCBmaXJzdFRhYk5hbWUgPT09IFwibWFwXCIgKSB7XG5cdFx0XHRcdFx0Ly9tYXAgdGFiIG5lZWRzIHNwZWNpYWwgaW5pYWxpdGl6YXRpb25cblx0XHRcdFx0XHR0aGlzLm1hcFRhYi5kaXNwbGF5KCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0aWYoICF2YWxpZERpbWVuc2lvbnMgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0aWYoIGRpbWVuc2lvbnNTdHJpbmcgKSB7XG5cblx0XHRcdFx0dGhpcy4kcHJlbG9hZGVyLnNob3coKTtcblxuXHRcdFx0XHR2YXIgZGF0YVByb3BzID0geyBcImRpbWVuc2lvbnNcIjogZGltZW5zaW9uc1N0cmluZywgXCJjaGFydElkXCI6IEFwcC5DaGFydE1vZGVsLmdldCggXCJpZFwiICksIFwiY2hhcnRUeXBlXCI6IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10eXBlXCIgKSwgXCJzZWxlY3RlZENvdW50cmllc1wiOiBzZWxlY3RlZENvdW50cmllc0lkcywgXCJjaGFydFRpbWVcIjogY2hhcnRUaW1lLCBcImNhY2hlXCI6IEFwcC5DaGFydE1vZGVsLmdldCggXCJjYWNoZVwiICksIFwiZ3JvdXBCeVZhcmlhYmxlc1wiOiBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiZ3JvdXAtYnktdmFyaWFibGVzXCIgKSAgfTtcblx0XHRcdFx0XG5cdFx0XHRcdHRoaXMuZGF0YU1vZGVsLmZldGNoKCB7IGRhdGE6IGRhdGFQcm9wcyB9ICk7XG5cblx0XHRcdH0gZWxzZSB7XG5cblx0XHRcdFx0Ly9jbGVhciBhbnkgcHJldmlvdXMgY2hhcnRcblx0XHRcdFx0JCggXCJzdmdcIiApLmVtcHR5KCk7XG5cblx0XHRcdH1cblxuXHRcdH0sXG5cblx0XHRvbkNoYXJ0TW9kZWxDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdHRoaXMucmVuZGVyKCk7XG5cdFx0XHRcblx0XHR9LFxuXG5cdFx0b25EYXRhTW9kZWxTeW5jOiBmdW5jdGlvbiggbW9kZWwsIHJlc3BvbnNlICkge1xuXHRcdFx0dGhpcy4kZXJyb3IuaGlkZSgpO1xuXHRcdFx0dGhpcy4kcHJlbG9hZGVyLmhpZGUoKTtcblx0XHRcdGlmKCByZXNwb25zZS5kYXRhICkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZUNoYXJ0KCByZXNwb25zZS5kYXRhLCByZXNwb25zZS50aW1lVHlwZSwgcmVzcG9uc2UuZGltZW5zaW9ucyApO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5zb3VyY2VzVGFiLnJlbmRlciggcmVzcG9uc2UgKTtcblx0XHR9LFxuXG5cdFx0b25EYXRhTW9kZWxFcnJvcjogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLiRlcnJvci5zaG93KCk7XG5cdFx0XHR0aGlzLiRwcmVsb2FkZXIuaGlkZSgpO1xuXHRcdH0sXG5cblx0XHRleHBvcnRDb250ZW50OiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0XG5cdFx0XHQvL2h0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMjMyMTgxNzQvaG93LWRvLWktc2F2ZS1leHBvcnQtYW4tc3ZnLWZpbGUtYWZ0ZXItY3JlYXRpbmctYW4tc3ZnLXdpdGgtZDMtanMtaWUtc2FmYXJpLWFuXG5cdFx0XHR2YXIgJGJ0biA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICksXG5cdFx0XHRcdC8vc3RvcmUgcHJlLXByaW50aW5nIHN2Z1xuXHRcdFx0XHQkb2xkRWwgPSB0aGlzLiRlbCxcblx0XHRcdFx0JG5ld0VsID0gJG9sZEVsLmNsb25lKCksXG5cdFx0XHRcdGlzU3ZnID0gKCAkYnRuLmhhc0NsYXNzKCBcImNoYXJ0LXNhdmUtc3ZnLWJ0blwiICkgKT8gdHJ1ZTogZmFsc2U7XG5cdFx0XHRcblx0XHRcdCRvbGRFbC5yZXBsYWNlV2l0aCggJG5ld0VsICk7XG5cblx0XHRcdC8vZ3JhYiBhbGwgc3ZnXG5cdFx0XHR2YXIgJHN2ZyA9ICRuZXdFbC5maW5kKCBcInN2Z1wiICksXG5cdFx0XHRcdHN2ZyA9ICRzdmcuZ2V0KCAwICksXG5cdFx0XHRcdHN2Z1N0cmluZyA9IHN2Zy5vdXRlckhUTUw7XG5cblx0XHRcdC8vYWRkIHByaW50aW5nIHN0eWxlc1xuXHRcdFx0JHN2Zy5hdHRyKCBcImNsYXNzXCIsIFwibnZkMy1zdmcgZXhwb3J0LXN2Z1wiICk7XG5cblx0XHRcdC8vaW5saW5lIHN0eWxlcyBmb3IgdGhlIGV4cG9ydFxuXHRcdFx0dmFyIHN0eWxlU2hlZXRzID0gZG9jdW1lbnQuc3R5bGVTaGVldHM7XG5cdFx0XHRmb3IoIHZhciBpID0gMDsgaSA8IHN0eWxlU2hlZXRzLmxlbmd0aDsgaSsrICkge1xuXHRcdFx0XHRVdGlscy5pbmxpbmVDc3NTdHlsZSggc3R5bGVTaGVldHNbIGkgXS5jc3NSdWxlcyApO1xuXHRcdFx0fVxuXG5cdFx0XHQvL2RlcGVuZGluZyB3aGV0aGVyIHdlJ3JlIGNyZWF0aW5nIHN2ZyBvciBwbmcsIFxuXHRcdFx0aWYoIGlzU3ZnICkge1xuXG5cdFx0XHRcdHZhciBzZXJpYWxpemVyID0gbmV3IFhNTFNlcmlhbGl6ZXIoKSxcblx0XHRcdFx0c291cmNlID0gc2VyaWFsaXplci5zZXJpYWxpemVUb1N0cmluZyhzdmcpO1xuXHRcdFx0XHQvL2FkZCBuYW1lIHNwYWNlcy5cblx0XHRcdFx0aWYoIXNvdXJjZS5tYXRjaCgvXjxzdmdbXj5dK3htbG5zPVwiaHR0cFxcOlxcL1xcL3d3d1xcLnczXFwub3JnXFwvMjAwMFxcL3N2Z1wiLykpe1xuXHRcdFx0XHRcdHNvdXJjZSA9IHNvdXJjZS5yZXBsYWNlKC9ePHN2Zy8sICc8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIicpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmKCFzb3VyY2UubWF0Y2goL148c3ZnW14+XStcImh0dHBcXDpcXC9cXC93d3dcXC53M1xcLm9yZ1xcLzE5OTlcXC94bGlua1wiLykpe1xuXHRcdFx0XHRcdHNvdXJjZSA9IHNvdXJjZS5yZXBsYWNlKC9ePHN2Zy8sICc8c3ZnIHhtbG5zOnhsaW5rPVwiaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGlua1wiJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdC8vYWRkIHhtbCBkZWNsYXJhdGlvblxuXHRcdFx0XHRzb3VyY2UgPSAnPD94bWwgdmVyc2lvbj1cIjEuMFwiIHN0YW5kYWxvbmU9XCJub1wiPz5cXHJcXG4nICsgc291cmNlO1xuXG5cdFx0XHRcdC8vY29udmVydCBzdmcgc291cmNlIHRvIFVSSSBkYXRhIHNjaGVtZS5cblx0XHRcdFx0dmFyIHVybCA9IFwiZGF0YTppbWFnZS9zdmcreG1sO2NoYXJzZXQ9dXRmLTgsXCIrZW5jb2RlVVJJQ29tcG9uZW50KHNvdXJjZSk7XG5cdFx0XHRcdCRidG4uYXR0ciggXCJocmVmXCIsIHVybCApO1xuXG5cdFx0XHR9IGVsc2Uge1xuXG5cdFx0XHRcdHZhciAkc3ZnQ2FudmFzID0gJCggXCIubnZkMy1zdmdcIiApO1xuXHRcdFx0XHRpZiggJHN2Z0NhbnZhcy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0c2F2ZVN2Z0FzUG5nKCAkKCBcIi5udmQzLXN2Z1wiICkuZ2V0KCAwICksIFwiY2hhcnQucG5nXCIpO1xuXG5cdFx0XHRcdFx0Ly90ZW1wIGhhY2sgLSByZW1vdmUgaW1hZ2Ugd2hlbiBleHBvcnRpbmcgdG8gcG5nXG5cdFx0XHRcdFx0Lyp2YXIgJHN2Z0xvZ28gPSAkKCBcIi5jaGFydC1sb2dvLXN2Z1wiICk7XG5cdFx0XHRcdFx0JHN2Z0xvZ28ucmVtb3ZlKCk7XG5cblx0XHRcdFx0XHRzYXZlU3ZnQXNQbmcoICQoIFwiLm52ZDMtc3ZnXCIgKS5nZXQoIDAgKSwgXCJjaGFydC5wbmdcIik7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0JHN2Zy5wcmVwZW5kKCAkc3ZnTG9nbyApOyovXG5cdFx0XHRcdFx0XG5cdFx0XHRcdH1cblxuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHQvL2FkZCBiYWNrIHRoZSBwcmludGVkIHN2Z1xuXHRcdFx0JG5ld0VsLnJlcGxhY2VXaXRoKCAkb2xkRWwgKTtcblx0XHRcdC8vcmVmcmVzaCBsaW5rXG5cdFx0XHQkb2xkRWwuZmluZCggXCIuY2hhcnQtc2F2ZS1zdmctYnRuXCIgKS5vbiggXCJjbGlja1wiLCAkLnByb3h5KCB0aGlzLmV4cG9ydENvbnRlbnQsIHRoaXMgKSApO1xuXG5cdFx0fSxcblxuXHRcdHVwZGF0ZUNoYXJ0OiBmdW5jdGlvbiggZGF0YSwgdGltZVR5cGUsIGRpbWVuc2lvbnMgKSB7XG5cblx0XHRcdHRoaXMuY2hhcnRUYWIucmVuZGVyKCBkYXRhLCB0aW1lVHlwZSwgZGltZW5zaW9ucyApO1xuXHRcdFxuXHRcdH0sXG5cdFxuXHRcdG9uUmVzaXplOiBmdW5jdGlvbigpIHtcblx0XHRcdFxuXHRcdFx0Ly9jb21wdXRlIGhvdyBtdWNoIHNwYWNlIGZvciBjaGFydFxuXHRcdFx0dmFyIHN2Z1dpZHRoID0gdGhpcy4kc3ZnLndpZHRoKCksXG5cdFx0XHRcdHN2Z0hlaWdodCA9IHRoaXMuJHN2Zy5oZWlnaHQoKSxcblx0XHRcdFx0Y2hhcnRUeXBlID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LXR5cGVcIiApLFxuXHRcdFx0XHQkY2hhcnROYW1lU3ZnID0gdGhpcy4kZWwuZmluZCggXCIuY2hhcnQtbmFtZS1zdmdcIiApLFxuXHRcdFx0XHQkY2hhcnRTdWJuYW1lU3ZnID0gdGhpcy4kZWwuZmluZCggXCIuY2hhcnQtc3VibmFtZS1zdmdcIiApLFxuXHRcdFx0XHQkY2hhcnREZXNjcmlwdGlvblN2ZyA9IHRoaXMuJGVsLmZpbmQoIFwiLmNoYXJ0LWRlc2NyaXB0aW9uLXN2Z1wiICksXG5cdFx0XHRcdCRjaGFydFNvdXJjZXNTdmcgPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1zb3VyY2VzLXN2Z1wiICksXG5cdFx0XHRcdGNoYXJ0SGVhZGVySGVpZ2h0ID0gdGhpcy4kY2hhcnRIZWFkZXIuaGVpZ2h0KCksXG5cdFx0XHRcdG1hcmdpbnMgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwibWFyZ2luc1wiICksXG5cdFx0XHRcdHRvcENoYXJ0TWFyZ2luID0gMzAsXG5cdFx0XHRcdGJvdHRvbUNoYXJ0TWFyZ2luID0gNjAsXG5cdFx0XHRcdGN1cnJZLCBmb290ZXJEZXNjcmlwdGlvbkhlaWdodCwgZm9vdGVyU291cmNlc0hlaWdodCwgY2hhcnRIZWlnaHQ7XG5cblx0XHRcdHRoaXMuJHRhYkNvbnRlbnQuaGVpZ2h0KCAkKCBcIi5jaGFydC13cmFwcGVyLWlubmVyXCIgKS5oZWlnaHQoKSAtIHRoaXMuJGNoYXJ0SGVhZGVyLmhlaWdodCgpICk7XG5cblx0XHRcdC8vd3JhcCBoZWFkZXIgdGV4dFxuXHRcdFx0VXRpbHMud3JhcCggJGNoYXJ0TmFtZVN2Zywgc3ZnV2lkdGggKTtcblx0XHRcdGN1cnJZID0gcGFyc2VJbnQoICRjaGFydE5hbWVTdmcuYXR0ciggXCJ5XCIgKSwgMTAgKSArICRjaGFydE5hbWVTdmcub3V0ZXJIZWlnaHQoKSArIDIwO1xuXHRcdFx0JGNoYXJ0U3VibmFtZVN2Zy5hdHRyKCBcInlcIiwgY3VyclkgKTtcblx0XHRcdFxuXHRcdFx0Ly93cmFwIGRlc2NyaXB0aW9uXG5cdFx0XHRVdGlscy53cmFwKCAkY2hhcnRTdWJuYW1lU3ZnLCBzdmdXaWR0aCApO1xuXG5cdFx0XHQvL3N0YXJ0IHBvc2l0aW9uaW5nIHRoZSBncmFwaCwgYWNjb3JkaW5nIFxuXHRcdFx0Y3VyclkgPSBjaGFydEhlYWRlckhlaWdodDtcblxuXHRcdFx0dmFyIHRyYW5zbGF0ZVkgPSBjdXJyWTtcblx0XHRcdFxuXHRcdFx0dGhpcy4kc3ZnLmhlaWdodCggdGhpcy4kdGFiQ29udGVudC5oZWlnaHQoKSArIGN1cnJZICk7XG5cblx0XHRcdC8vdXBkYXRlIHN0b3JlZCBoZWlnaHRcblx0XHRcdHN2Z0hlaWdodCA9IHRoaXMuJHN2Zy5oZWlnaHQoKTtcblxuXHRcdFx0Ly9hZGQgaGVpZ2h0IG9mIGxlZ2VuZFxuXHRcdFx0Ly9jdXJyWSArPSB0aGlzLmNoYXJ0LmxlZ2VuZC5oZWlnaHQoKTtcblx0XHRcdGlmKCAhQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImhpZGUtbGVnZW5kXCIgKSApIHtcblx0XHRcdFx0Y3VyclkgKz0gdGhpcy5jaGFydFRhYi5sZWdlbmQuaGVpZ2h0KCk7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdC8vcG9zaXRpb24gY2hhcnRcblx0XHRcdFV0aWxzLndyYXAoICRjaGFydERlc2NyaXB0aW9uU3ZnLCBzdmdXaWR0aCApO1xuXHRcdFx0Zm9vdGVyRGVzY3JpcHRpb25IZWlnaHQgPSAkY2hhcnREZXNjcmlwdGlvblN2Zy5oZWlnaHQoKTtcblx0XHRcdFV0aWxzLndyYXAoICRjaGFydFNvdXJjZXNTdmcsIHN2Z1dpZHRoICk7XG5cdFx0XHRmb290ZXJTb3VyY2VzSGVpZ2h0ID0gJGNoYXJ0U291cmNlc1N2Zy5oZWlnaHQoKTtcblxuXHRcdFx0dmFyIGZvb3RlckhlaWdodCA9IHRoaXMuJGNoYXJ0Rm9vdGVyLmhlaWdodCgpO1xuXG5cdFx0XHQvL3NldCBjaGFydCBoZWlnaHRcblx0XHRcdGNoYXJ0SGVpZ2h0ID0gc3ZnSGVpZ2h0IC0gdHJhbnNsYXRlWSAtIGZvb3RlckhlaWdodCAtIGJvdHRvbUNoYXJ0TWFyZ2luO1xuXHRcdFx0aWYoICFBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiaGlkZS1sZWdlbmRcIiApICkge1xuXHRcdFx0XHRjaGFydEhlaWdodCAtPSB0aGlzLmNoYXJ0VGFiLmxlZ2VuZC5oZWlnaHQoKTtcblx0XHRcdH1cblxuXHRcdFx0Ly9yZWZsZWN0IG1hcmdpbiB0b3AgYW5kIGRvd24gaW4gY2hhcnRIZWlnaHRcblx0XHRcdGNoYXJ0SGVpZ2h0ID0gY2hhcnRIZWlnaHQgLSBtYXJnaW5zLmJvdHRvbSAtIG1hcmdpbnMudG9wO1xuXG5cdFx0XHQvL3Bvc2l0aW9uIGZvb3RlclxuXHRcdFx0JGNoYXJ0RGVzY3JpcHRpb25TdmcuYXR0ciggXCJ5XCIsIGN1cnJZICsgY2hhcnRIZWlnaHQgKyBib3R0b21DaGFydE1hcmdpbiApO1xuXHRcdFx0VXRpbHMud3JhcCggJGNoYXJ0RGVzY3JpcHRpb25TdmcsIHN2Z1dpZHRoICk7XG5cdFx0XHQkY2hhcnRTb3VyY2VzU3ZnLmF0dHIoIFwieVwiLCBwYXJzZUludCggJGNoYXJ0RGVzY3JpcHRpb25TdmcuYXR0ciggXCJ5XCIgKSwgMTAgKSArICRjaGFydERlc2NyaXB0aW9uU3ZnLmhlaWdodCgpICsgZm9vdGVyRGVzY3JpcHRpb25IZWlnaHQvMyApO1xuXHRcdFx0VXRpbHMud3JhcCggJGNoYXJ0U291cmNlc1N2Zywgc3ZnV2lkdGggKTtcblx0XHRcdFxuXHRcdFx0Ly9jb21wdXRlIGNoYXJ0IHdpZHRoXG5cdFx0XHR2YXIgY2hhcnRXaWR0aCA9IHN2Z1dpZHRoIC0gbWFyZ2lucy5sZWZ0IC0gbWFyZ2lucy5yaWdodDtcblx0XHRcdHRoaXMuY2hhcnRUYWIuY2hhcnQud2lkdGgoIGNoYXJ0V2lkdGggKTtcblx0XHRcdHRoaXMuY2hhcnRUYWIuY2hhcnQuaGVpZ2h0KCBjaGFydEhlaWdodCApO1xuXG5cdFx0XHQvL25lZWQgdG8gY2FsbCBjaGFydCB1cGRhdGUgZm9yIHJlc2l6aW5nIG9mIGVsZW1lbnRzIHdpdGhpbiBjaGFydFxuXHRcdFx0aWYoIHRoaXMuJGNoYXJ0VGFiLmlzKCBcIjp2aXNpYmxlXCIgKSApIHtcblx0XHRcdFx0dGhpcy5jaGFydFRhYi5jaGFydC51cGRhdGUoKTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0aWYoIGNoYXJ0VHlwZSA9PT0gXCIzXCIgKSB7XG5cdFx0XHRcdC8vZm9yIHN0YWNrZWQgYXJlYSBjaGFydCwgbmVlZCB0byBtYW51YWxseSBhZGp1c3QgaGVpZ2h0XG5cdFx0XHRcdHZhciBjdXJySW50TGF5ZXJIZWlnaHQgPSB0aGlzLmNoYXJ0VGFiLmNoYXJ0LmludGVyYWN0aXZlTGF5ZXIuaGVpZ2h0KCksXG5cdFx0XHRcdFx0Ly9UT0RPIC0gZG8gbm90IGhhcmRjb2RlIHRoaXNcblx0XHRcdFx0XHRoZWlnaHRBZGQgPSAxNTA7XG5cdFx0XHRcdHRoaXMuY2hhcnRUYWIuY2hhcnQuaW50ZXJhY3RpdmVMYXllci5oZWlnaHQoIGN1cnJJbnRMYXllckhlaWdodCArIGhlaWdodEFkZCApO1xuXHRcdFx0XHRkMy5zZWxlY3QoXCIubnYtaW50ZXJhY3RpdmVcIikuY2FsbCh0aGlzLmNoYXJ0VGFiLmNoYXJ0LmludGVyYWN0aXZlTGF5ZXIpO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRpZiggIUFwcC5DaGFydE1vZGVsLmdldCggXCJoaWRlLWxlZ2VuZFwiICkgKSB7XG5cdFx0XHRcdC8vcG9zaXRpb24gbGVnZW5kXG5cdFx0XHRcdHZhciBsZWdlbmRNYXJnaW5zID0gdGhpcy5jaGFydFRhYi5sZWdlbmQubWFyZ2luKCk7XG5cdFx0XHRcdGN1cnJZID0gY3VyclkgLSB0aGlzLmNoYXJ0VGFiLmxlZ2VuZC5oZWlnaHQoKTtcblx0XHRcdFx0dGhpcy50cmFuc2xhdGVTdHJpbmcgPSBcInRyYW5zbGF0ZShcIiArIGxlZ2VuZE1hcmdpbnMubGVmdCArIFwiICxcIiArIGN1cnJZICsgXCIpXCI7XG5cdFx0XHRcdHRoaXMuJHN2Zy5maW5kKCBcIj4gLm52ZDMubnYtY3VzdG9tLWxlZ2VuZFwiICkuYXR0ciggXCJ0cmFuc2Zvcm1cIiwgdGhpcy50cmFuc2xhdGVTdHJpbmcgKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy4kc3ZnLmNzcyggXCJ0cmFuc2Zvcm1cIiwgXCJ0cmFuc2xhdGUoMCwtXCIgKyBjaGFydEhlYWRlckhlaWdodCArIFwicHgpXCIgKTtcblxuXHRcdFx0Ly9mb3IgbXVsdGliYXJjaGFydCwgbmVlZCB0byBtb3ZlIGNvbnRyb2xzIGJpdCBoaWdoZXJcblx0XHRcdGlmKCBjaGFydFR5cGUgPT09IFwiNFwiIHx8IGNoYXJ0VHlwZSA9PT0gXCI1XCIgKSB7XG5cdFx0XHRcdGQzLnNlbGVjdCggXCIubnYtY29udHJvbHNXcmFwXCIgKS5hdHRyKCBcInRyYW5zZm9ybVwiLCBcInRyYW5zbGF0ZSgwLC0yNSlcIiApO1xuXHRcdFx0fVxuXG5cdFx0XHQvL3JlZmxlY3QgbWFyZ2luIHRvcCBpbiBjdXJyWVxuXHRcdFx0aWYoICFBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiaGlkZS1sZWdlbmRcIiApICkge1xuXHRcdFx0XHRjdXJyWSArPSArdGhpcy5jaGFydFRhYi5sZWdlbmQuaGVpZ2h0KCk7XG5cdFx0XHR9XG5cdFx0XHRjdXJyWSArPSArbWFyZ2lucy50b3A7XG5cblx0XHRcdHZhciAkd3JhcCA9IHRoaXMuJHN2Zy5maW5kKCBcIj4gLm52ZDMubnYtd3JhcFwiICk7XG5cblx0XHRcdC8vbWFudWFsbHkgcmVwb3NpdGlvbiBjaGFydCBhZnRlciB1cGRhdGVcblx0XHRcdC8vdGhpcy50cmFuc2xhdGVTdHJpbmcgPSBcInRyYW5zbGF0ZShcIiArIG1hcmdpbnMubGVmdCArIFwiLFwiICsgY3VyclkgKyBcIilcIjtcblx0XHRcdHRoaXMudHJhbnNsYXRlU3RyaW5nID0gXCJ0cmFuc2xhdGUoXCIgKyBtYXJnaW5zLmxlZnQgKyBcIixcIiArIGN1cnJZICsgXCIpXCI7XG5cdFx0XHQkd3JhcC5hdHRyKCBcInRyYW5zZm9ybVwiLCB0aGlzLnRyYW5zbGF0ZVN0cmluZyApO1xuXHRcdFx0XG5cdFx0XHQvL3Bvc2l0aW9uIHNjYWxlIGRyb3Bkb3ducyAtIFRPRE8gLSBpc24ndCB0aGVyZSBhIGJldHRlciB3YXkgdGhlbiB3aXRoIHRpbWVvdXQ/XG5cdFx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0XHRzZXRUaW1lb3V0KCBmdW5jdGlvbigpIHtcblx0XHRcdFxuXHRcdFx0XHR2YXIgd3JhcE9mZnNldCA9ICR3cmFwLm9mZnNldCgpLFxuXHRcdFx0XHRcdGNoYXJ0VGFiT2Zmc2V0ID0gdGhhdC4kY2hhcnRUYWIub2Zmc2V0KCksXG5cdFx0XHRcdFx0bWFyZ2luTGVmdCA9IHBhcnNlSW50KCBtYXJnaW5zLmxlZnQsIDEwICksXG5cdFx0XHRcdFx0Ly9kaWcgaW50byBOVkQzIGNoYXJ0IHRvIGZpbmQgYmFja2dyb3VuZCByZWN0IHRoYXQgaGFzIHdpZHRoIG9mIHRoZSBhY3R1YWwgY2hhcnRcblx0XHRcdFx0XHRiYWNrUmVjdFdpZHRoID0gcGFyc2VJbnQoICR3cmFwLmZpbmQoIFwiPiBnID4gcmVjdFwiICkuYXR0ciggXCJ3aWR0aFwiICksIDEwICksXG5cdFx0XHRcdFx0b2Zmc2V0RGlmZiA9IHdyYXBPZmZzZXQudG9wIC0gY2hhcnRUYWJPZmZzZXQudG9wLFxuXHRcdFx0XHRcdC8vZW1waXJpYyBvZmZzZXRcblx0XHRcdFx0XHR4U2NhbGVPZmZzZXQgPSAxMCxcblx0XHRcdFx0XHR5U2NhbGVPZmZzZXQgPSAtNTtcblxuXHRcdFx0XHQvL2ZhbGxiYWNrIGZvciBzY2F0dGVyIHBsb3Qgd2hlcmUgYmFja1JlY3RXaWR0aCBoYXMgbm8gd2lkdGhcblx0XHRcdFx0aWYoIGlzTmFOKCBiYWNrUmVjdFdpZHRoICkgKSB7XG5cdFx0XHRcdFx0YmFja1JlY3RXaWR0aCA9IHBhcnNlSW50KCAkKFwiLm52LXgubnYtYXhpcy5udmQzLXN2Z1wiKS5nZXQoMCkuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkud2lkdGgsIDEwICk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGF0LiR4QXhpc1NjYWxlU2VsZWN0b3IuY3NzKCB7IFwidG9wXCI6IG9mZnNldERpZmYgKyBjaGFydEhlaWdodCwgXCJsZWZ0XCI6IG1hcmdpbkxlZnQgKyBiYWNrUmVjdFdpZHRoICsgeFNjYWxlT2Zmc2V0IH0gKTtcblx0XHRcdFx0dGhhdC4keUF4aXNTY2FsZVNlbGVjdG9yLmNzcyggeyBcInRvcFwiOiBvZmZzZXREaWZmIC0gMTUsIFwibGVmdFwiOiBtYXJnaW5MZWZ0ICsgeVNjYWxlT2Zmc2V0IH0gKTtcblx0XHRcdFx0XG5cdFx0XHR9LCAyNTAgKTtcblx0XHRcdFxuXHRcdH1cblxuXHR9KTtcblx0XG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkNoYXJ0VmlldztcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBGb3JtVmlldyA9IHJlcXVpcmUoIFwiLi9BcHAuVmlld3MuRm9ybVZpZXcuanNcIiApLFxuXHRcdENoYXJ0VmlldyA9IHJlcXVpcmUoIFwiLi9BcHAuVmlld3MuQ2hhcnRWaWV3LmpzXCIgKSxcblx0XHRWYXJpYWJsZVNlbGVjdHMgPSByZXF1aXJlKCBcIi4vdWkvQXBwLlZpZXdzLlVJLlZhcmlhYmxlU2VsZWN0cy5qc1wiICk7XG5cblx0QXBwLlZpZXdzLkZvcm0gPSBCYWNrYm9uZS5WaWV3LmV4dGVuZCh7XG5cblx0XHRldmVudHM6IHt9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oKSB7fSxcblxuXHRcdHN0YXJ0OiBmdW5jdGlvbigpIHtcblx0XHRcdC8vcmVuZGVyIGV2ZXJ5dGhpbmcgZm9yIHRoZSBmaXJzdCB0aW1lXG5cdFx0XHR0aGlzLnJlbmRlcigpO1xuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XG5cdFx0XHR2YXIgZGlzcGF0Y2hlciA9IF8uY2xvbmUoIEJhY2tib25lLkV2ZW50cyApO1xuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gZGlzcGF0Y2hlcjtcblxuXHRcdFx0dGhpcy5mb3JtVmlldyA9IG5ldyBGb3JtVmlldyggeyBkaXNwYXRjaGVyOiBkaXNwYXRjaGVyIH0gKTtcblx0XHRcdHRoaXMuY2hhcnRWaWV3ID0gbmV3IENoYXJ0VmlldyggeyBkaXNwYXRjaGVyOiBkaXNwYXRjaGVyIH0gKTtcblx0XHRcdFxuXHRcdFx0Ly92YXJpYWJsZSBzZWxlY3Rcblx0XHRcdHZhciB2YXJpYWJsZVNlbGVjdHMgPSBuZXcgVmFyaWFibGVTZWxlY3RzKCk7XG5cdFx0XHR2YXJpYWJsZVNlbGVjdHMuaW5pdCgpO1xuXHRcdFx0XG5cdFx0fVxuXG5cdH0pO1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkZvcm07XG5cbn0pKCk7XG4iLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBDaGFydFZhcmlhYmxlc0NvbGxlY3Rpb24gPSByZXF1aXJlKCBcIi4vLi4vY29sbGVjdGlvbnMvQXBwLkNvbGxlY3Rpb25zLkNoYXJ0VmFyaWFibGVzQ29sbGVjdGlvbi5qc1wiICksXG5cdFx0QXZhaWxhYmxlRW50aXRpZXNDb2xsZWN0aW9uID0gcmVxdWlyZSggXCIuLy4uL2NvbGxlY3Rpb25zL0FwcC5Db2xsZWN0aW9ucy5BdmFpbGFibGVFbnRpdGllc0NvbGxlY3Rpb24uanNcIiApLFxuXHRcdENoYXJ0RGltZW5zaW9uc01vZGVsID0gcmVxdWlyZSggXCIuLy4uL21vZGVscy9BcHAuTW9kZWxzLkNoYXJ0RGltZW5zaW9uc01vZGVsLmpzXCIgKSxcblx0XHRBdmFpbGFibGVUaW1lTW9kZWwgPSByZXF1aXJlKCBcIi4vLi4vbW9kZWxzL0FwcC5Nb2RlbHMuQXZhaWxhYmxlVGltZU1vZGVsLmpzXCIgKSxcblx0XHRTZWFyY2hEYXRhQ29sbGVjdGlvbiA9IHJlcXVpcmUoIFwiLi8uLi9jb2xsZWN0aW9ucy9BcHAuQ29sbGVjdGlvbnMuU2VhcmNoRGF0YUNvbGxlY3Rpb24uanNcIiApLFxuXHRcdFxuXHRcdEJhc2ljVGFiVmlldyA9IHJlcXVpcmUoIFwiLi9mb3JtL0FwcC5WaWV3cy5Gb3JtLkJhc2ljVGFiVmlldy5qc1wiICksXG5cdFx0QXhpc1RhYlZpZXcgPSByZXF1aXJlKCBcIi4vZm9ybS9BcHAuVmlld3MuRm9ybS5BeGlzVGFiVmlldy5qc1wiICksXG5cdFx0RGVzY3JpcHRpb25UYWJWaWV3ID0gcmVxdWlyZSggXCIuL2Zvcm0vQXBwLlZpZXdzLkZvcm0uRGVzY3JpcHRpb25UYWJWaWV3LmpzXCIgKSxcblx0XHRTdHlsaW5nVGFiVmlldyA9IHJlcXVpcmUoIFwiLi9mb3JtL0FwcC5WaWV3cy5Gb3JtLlN0eWxpbmdUYWJWaWV3LmpzXCIgKSxcblx0XHRFeHBvcnRUYWJWaWV3ID0gcmVxdWlyZSggXCIuL2Zvcm0vQXBwLlZpZXdzLkZvcm0uRXhwb3J0VGFiVmlldy5qc1wiICksXG5cdFx0TWFwVGFiVmlldyA9IHJlcXVpcmUoIFwiLi9mb3JtL0FwcC5WaWV3cy5Gb3JtLk1hcFRhYlZpZXcuanNcIiApO1xuXG5cdEFwcC5WaWV3cy5Gb3JtVmlldyA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblxuXHRcdGVsOiBcIiNmb3JtLXZpZXdcIixcblx0XHRldmVudHM6IHtcblx0XHRcdFwiY2xpY2sgLmZvcm0tY29sbGFwc2UtYnRuXCI6IFwib25Gb3JtQ29sbGFwc2VcIixcblx0XHRcdFwiY2hhbmdlIGlucHV0W25hbWU9Y2hhcnQtbmFtZV1cIjogXCJvbk5hbWVDaGFuZ2VcIixcblx0XHRcdFwiY2hhbmdlIHRleHRhcmVhW25hbWU9Y2hhcnQtc3VibmFtZV1cIjogXCJvblN1Ym5hbWVDaGFuZ2VcIixcblx0XHRcdFwiY2xpY2sgLnJlbW92ZS11cGxvYWRlZC1maWxlLWJ0blwiOiBcIm9uUmVtb3ZlVXBsb2FkZWRGaWxlXCIsXG5cdFx0XHRcInN1Ym1pdCBmb3JtXCI6IFwib25Gb3JtU3VibWl0XCIsXG5cdFx0fSxcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0XG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIgPSBvcHRpb25zLmRpc3BhdGNoZXI7XG5cdFx0XHRcblx0XHRcdHZhciBmb3JtQ29uZmlnID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImZvcm0tY29uZmlnXCIgKTtcblxuXHRcdFx0Ly9jcmVhdGUgcmVsYXRlZCBtb2RlbHMsIGVpdGhlciBlbXB0eSAod2hlbiBjcmVhdGluZyBuZXcgY2hhcnQpLCBvciBwcmVmaWxsZWQgZnJvbSBkYiAod2hlbiBlZGl0aW5nIGV4aXN0aW5nIGNoYXJ0KVxuXHRcdFx0aWYoIGZvcm1Db25maWcgJiYgZm9ybUNvbmZpZ1sgXCJ2YXJpYWJsZXMtY29sbGVjdGlvblwiIF0gKSB7XG5cdFx0XHRcdEFwcC5DaGFydFZhcmlhYmxlc0NvbGxlY3Rpb24gPSBuZXcgQ2hhcnRWYXJpYWJsZXNDb2xsZWN0aW9uKCBmb3JtQ29uZmlnWyBcInZhcmlhYmxlcy1jb2xsZWN0aW9uXCIgXSApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0QXBwLkNoYXJ0VmFyaWFibGVzQ29sbGVjdGlvbiA9IG5ldyBDaGFydFZhcmlhYmxlc0NvbGxlY3Rpb24oKTtcblx0XHRcdH1cblx0XHRcdGlmKCBmb3JtQ29uZmlnICYmIGZvcm1Db25maWdbIFwiZW50aXRpZXMtY29sbGVjdGlvblwiIF0gKSB7XG5cdFx0XHRcdEFwcC5BdmFpbGFibGVFbnRpdGllc0NvbGxlY3Rpb24gPSBuZXcgQXZhaWxhYmxlRW50aXRpZXNDb2xsZWN0aW9uKCBmb3JtQ29uZmlnWyBcImVudGl0aWVzLWNvbGxlY3Rpb25cIiBdICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRBcHAuQXZhaWxhYmxlRW50aXRpZXNDb2xsZWN0aW9uID0gbmV3IEF2YWlsYWJsZUVudGl0aWVzQ29sbGVjdGlvbigpO1xuXHRcdFx0fVxuXHRcdFx0aWYoIGZvcm1Db25maWcgJiYgZm9ybUNvbmZpZ1sgXCJkaW1lbnNpb25zXCIgXSApIHtcblx0XHRcdFx0QXBwLkNoYXJ0RGltZW5zaW9uc01vZGVsID0gbmV3IENoYXJ0RGltZW5zaW9uc01vZGVsKCk7XG5cdFx0XHRcdC8vQXBwLkNoYXJ0RGltZW5zaW9uc01vZGVsID0gbmV3IEFwcC5Nb2RlbHMuQ2hhcnREaW1lbnNpb25zTW9kZWwoIGZvcm1Db25maWdbIFwiZGltZW5zaW9uc1wiIF0gKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdEFwcC5DaGFydERpbWVuc2lvbnNNb2RlbCA9IG5ldyBDaGFydERpbWVuc2lvbnNNb2RlbCgpO1xuXHRcdFx0fVxuXHRcdFx0aWYoIGZvcm1Db25maWcgJiYgZm9ybUNvbmZpZ1sgXCJhdmFpbGFibGUtdGltZVwiIF0gKSB7XG5cdFx0XHRcdEFwcC5BdmFpbGFibGVUaW1lTW9kZWwgPSBuZXcgQXZhaWxhYmxlVGltZU1vZGVsKGZvcm1Db25maWdbIFwiYXZhaWxhYmxlLXRpbWVcIiBdKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdEFwcC5BdmFpbGFibGVUaW1lTW9kZWwgPSBuZXcgQXZhaWxhYmxlVGltZU1vZGVsKCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vY3JlYXRlIHNlYXJjaCBjb2xsZWN0aW9uXG5cdFx0XHRBcHAuU2VhcmNoRGF0YUNvbGxlY3Rpb24gPSBuZXcgU2VhcmNoRGF0YUNvbGxlY3Rpb24oKTtcblx0XHRcdFxuXHRcdFx0Ly9pcyBpdCBuZXcgb3IgZXhpc3RpbmcgY2hhcnRcblx0XHRcdGlmKCBmb3JtQ29uZmlnICYmIGZvcm1Db25maWdbIFwiZGltZW5zaW9uc1wiIF0gKSB7XG5cdFx0XHRcdC8vZXhpc3RpbmcgY2hhcnQsIG5lZWQgdG8gbG9hZCBmcmVzaCBkaW1lbnNpb25zIGZyb20gZGF0YWJhc2UgKGluIGNhc2Ugd2UndmUgYWRkZWQgZGltZW5zaW9ucyBzaW5jZSBjcmVhdGluZyBjaGFydClcblx0XHRcdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdFx0XHRBcHAuQ2hhcnREaW1lbnNpb25zTW9kZWwubG9hZENvbmZpZ3VyYXRpb24oIGZvcm1Db25maWdbIFwiZGltZW5zaW9uc1wiIF0uaWQgKTtcblx0XHRcdFx0QXBwLkNoYXJ0RGltZW5zaW9uc01vZGVsLm9uKCBcImNoYW5nZVwiLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHR0aGF0LnJlbmRlcigpO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvL25ldyBjaGFydCwgY2FuIHJlbmRlciBzdHJhaWdodCBhd2F5XG5cdFx0XHRcdHRoaXMucmVuZGVyKCk7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdFxuXHRcdFx0Ly9jcmVhdGUgc3Vidmlld3Ncblx0XHRcdHRoaXMuYmFzaWNUYWJWaWV3ID0gbmV3IEJhc2ljVGFiVmlldyggeyBkaXNwYXRjaGVyOiB0aGlzLmRpc3BhdGNoZXIgfSApO1xuXHRcdFx0dGhpcy5heGlzVGFiVmlldyA9IG5ldyBBeGlzVGFiVmlldyggeyBkaXNwYXRjaGVyOiB0aGlzLmRpc3BhdGNoZXIgfSApO1xuXHRcdFx0dGhpcy5kZXNjcmlwdGlvblRhYlZpZXcgPSBuZXcgRGVzY3JpcHRpb25UYWJWaWV3KCB7IGRpc3BhdGNoZXI6IHRoaXMuZGlzcGF0Y2hlciB9ICk7XG5cdFx0XHR0aGlzLnN0eWxpbmdUYWJWaWV3ID0gbmV3IFN0eWxpbmdUYWJWaWV3KCB7IGRpc3BhdGNoZXI6IHRoaXMuZGlzcGF0Y2hlciB9ICk7XG5cdFx0XHR0aGlzLmV4cG9ydFRhYlZpZXcgPSBuZXcgRXhwb3J0VGFiVmlldyggeyBkaXNwYXRjaGVyOiB0aGlzLmRpc3BhdGNoZXIgfSApO1xuXHRcdFx0dGhpcy5tYXBUYWJWaWV3ID0gbmV3IE1hcFRhYlZpZXcoIHsgZGlzcGF0Y2hlcjogdGhpcy5kaXNwYXRjaGVyIH0gKTtcblxuXHRcdFx0Ly9mZXRjaCBkb21zXG5cdFx0XHR0aGlzLiRyZW1vdmVVcGxvYWRlZEZpbGVCdG4gPSB0aGlzLiRlbC5maW5kKCBcIi5yZW1vdmUtdXBsb2FkZWQtZmlsZS1idG5cIiApO1xuXHRcdFx0dGhpcy4kZmlsZVBpY2tlciA9IHRoaXMuJGVsLmZpbmQoIFwiLmZpbGUtcGlja2VyLXdyYXBwZXIgW3R5cGU9ZmlsZV1cIiApO1xuXG5cdFx0fSxcblxuXHRcdG9uTmFtZUNoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dmFyICRpbnB1dCA9ICQoIGV2dC50YXJnZXQgKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJjaGFydC1uYW1lXCIsICRpbnB1dC52YWwoKSApO1xuXG5cdFx0fSxcblxuXHRcdG9uU3VibmFtZUNoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dmFyICR0ZXh0YXJlYSA9ICQoIGV2dC50YXJnZXQgKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJjaGFydC1zdWJuYW1lXCIsICR0ZXh0YXJlYS52YWwoKSApO1xuXG5cdFx0fSxcblxuXHRcdG9uQ3N2U2VsZWN0ZWQ6IGZ1bmN0aW9uKCBlcnIsIGRhdGEgKSB7XG5cblx0XHRcdGlmKCBlcnIgKSB7XG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoIGVyciApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuJHJlbW92ZVVwbG9hZGVkRmlsZUJ0bi5zaG93KCk7XG5cblx0XHRcdGlmKCBkYXRhICYmIGRhdGEucm93cyApIHtcblx0XHRcdFx0dmFyIG1hcHBlZERhdGEgPSBBcHAuVXRpbHMubWFwRGF0YSggZGF0YS5yb3dzICk7XG5cdFx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJjaGFydC1kYXRhXCIsIG1hcHBlZERhdGEgKTtcblx0XHRcdH1cblxuXHRcdH0sXG5cblx0XHRvblJlbW92ZVVwbG9hZGVkRmlsZTogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dGhpcy4kZmlsZVBpY2tlci5yZXBsYWNlV2l0aCggdGhpcy4kZmlsZVBpY2tlci5jbG9uZSgpICk7XG5cdFx0XHQvL3JlZmV0Y2ggZG9tXG5cdFx0XHR0aGlzLiRmaWxlUGlja2VyID0gdGhpcy4kZWwuZmluZCggXCIuZmlsZS1waWNrZXItd3JhcHBlciBbdHlwZT1maWxlXVwiICk7XG5cdFx0XHR0aGlzLiRmaWxlUGlja2VyLnByb3AoIFwiZGlzYWJsZWRcIiwgZmFsc2UpO1xuXG5cdFx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0XHRDU1YuYmVnaW4oIHRoaXMuJGZpbGVQaWNrZXIuc2VsZWN0b3IgKS5nbyggZnVuY3Rpb24oIGVyciwgZGF0YSApIHtcblx0XHRcdFx0XHR0aGF0Lm9uQ3N2U2VsZWN0ZWQoIGVyciwgZGF0YSApO1xuXHRcdFx0fSApO1xuXG5cdFx0XHR0aGlzLiRyZW1vdmVVcGxvYWRlZEZpbGVCdG4uaGlkZSgpO1xuXG5cdFx0fSxcblxuXG5cdFx0b25Gb3JtQ29sbGFwc2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0dmFyICRwYXJlbnQgPSB0aGlzLiRlbC5wYXJlbnQoKTtcblx0XHRcdCRwYXJlbnQudG9nZ2xlQ2xhc3MoIFwiZm9ybS1wYW5lbC1jb2xsYXBzZWRcIiApO1xuXHRcdFx0XG5cdFx0XHQvL3RyaWdnZXIgcmUtcmVuZGVyaW5nIG9mIGNoYXJ0XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC50cmlnZ2VyKCBcImNoYW5nZVwiICk7XG5cdFx0XHQvL2Fsc28gdHJpZ2VyIGN1c3RvbSBldmVudCBzbyB0aGF0IG1hcCBjYW4gcmVzaXplXG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC50cmlnZ2VyKCBcInJlc2l6ZVwiICk7XG5cblx0XHR9LFxuXG5cdFx0b25Gb3JtU3VibWl0OiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0XG5cdFx0XHQkLmFqYXhTZXR1cCgge1xuXHRcdFx0XHRoZWFkZXJzOiB7ICdYLUNTUkYtVE9LRU4nOiAkKCdbbmFtZT1cIl90b2tlblwiXScpLnZhbCgpIH1cblx0XHRcdH0gKTtcblxuXHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cblx0XHRcdC8vcHV0IGFsbCBjaGFuZ2VzIHRvIGNoYXJ0IG1vZGVsXG5cdFx0XHR2YXIgZm9ybUNvbmZpZyA9IHtcblx0XHRcdFx0XCJ2YXJpYWJsZXMtY29sbGVjdGlvblwiOiBBcHAuQ2hhcnRWYXJpYWJsZXNDb2xsZWN0aW9uLnRvSlNPTigpLFxuXHRcdFx0XHRcImVudGl0aWVzLWNvbGxlY3Rpb25cIjogQXBwLkF2YWlsYWJsZUVudGl0aWVzQ29sbGVjdGlvbi50b0pTT04oKSxcblx0XHRcdFx0XCJkaW1lbnNpb25zXCI6IEFwcC5DaGFydERpbWVuc2lvbnNNb2RlbC50b0pTT04oKSxcblx0XHRcdFx0XCJhdmFpbGFibGUtdGltZVwiOiBBcHAuQXZhaWxhYmxlVGltZU1vZGVsLnRvSlNPTigpXG5cdFx0XHR9O1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0KCBcImZvcm0tY29uZmlnXCIsIGZvcm1Db25maWcsIHsgc2lsZW50OiB0cnVlIH0gKTtcblxuXHRcdFx0dmFyIGRpc3BhdGNoZXIgPSB0aGlzLmRpc3BhdGNoZXI7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5zYXZlKCB7fSwge1xuXHRcdFx0XHRzdWNjZXNzOiBmdW5jdGlvbiAoIG1vZGVsLCByZXNwb25zZSwgb3B0aW9ucyApIHtcblx0XHRcdFx0XHRhbGVydCggXCJUaGUgY2hhcnQgc2F2ZWQgc3VjY2VzZnVsbHlcIiApO1xuXHRcdFx0XHRcdGRpc3BhdGNoZXIudHJpZ2dlciggXCJjaGFydC1zYXZlZFwiLCByZXNwb25zZS5kYXRhLmlkLCByZXNwb25zZS5kYXRhLnZpZXdVcmwgKTtcblx0XHRcdFx0XHQvL3VwZGF0ZSBpZCBvZiBhbiBleGlzdGluZyBtb2RlbFxuXHRcdFx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJpZFwiLCByZXNwb25zZS5kYXRhLmlkICk7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGVycm9yOiBmdW5jdGlvbiAobW9kZWwsIHhociwgb3B0aW9ucykge1xuXHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoXCJTb21ldGhpbmcgd2VudCB3cm9uZyB3aGlsZSBzYXZpbmcgdGhlIG1vZGVsXCIsIHhociApO1xuXHRcdFx0XHRcdGFsZXJ0KCBcIk9wcHMsIHRoZXJlIHdhcyBhIHByb2JsZW0gc2F2aW5nIHlvdXIgY2hhcnQuXCIgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHR9XG5cblx0fSk7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVmlld3MuRm9ybVZpZXc7XG5cbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgTGVnZW5kID0gcmVxdWlyZSggXCIuL0FwcC5WaWV3cy5DaGFydC5MZWdlbmQuanNcIiApO1xuXG5cdEFwcC5WaWV3cy5DaGFydC5DaGFydFRhYiA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKCB7XG5cblx0XHRjYWNoZWRDb2xvcnM6IFtdLFxuXHRcdGVsOiBcIiNjaGFydC12aWV3XCIsXG5cdFx0ZXZlbnRzOiB7XG5cdFx0XHRcImNoYW5nZSBbbmFtZT1hdmFpbGFibGVfZW50aXRpZXNdXCI6IFwib25BdmFpbGFibGVDb3VudHJpZXNcIlxuXHRcdH0sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gb3B0aW9ucy5kaXNwYXRjaGVyO1xuXHRcdFx0dGhpcy5wYXJlbnRWaWV3ID0gb3B0aW9ucy5wYXJlbnRWaWV3O1xuXG5cdFx0XHR0aGlzLiRzdmcgPSB0aGlzLiRlbC5maW5kKCBcIiNjaGFydC1jaGFydC10YWIgc3ZnXCIgKTtcblx0XHRcdHRoaXMuJGVudGl0aWVzU2VsZWN0ID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT1hdmFpbGFibGVfZW50aXRpZXNdXCIgKTtcblx0XHRcdFxuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCBkYXRhLCB0aW1lVHlwZSwgZGltZW5zaW9ucyApIHtcblx0XHRcdFxuXHRcdFx0aWYoICFkYXRhICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdHZhciB0aGF0ID0gdGhpcztcblxuXHRcdFx0Ly9tYWtlIGxvY2FsIGNvcHkgb2YgZGF0YSBmb3Igb3VyIGZpbHRlcmluZyBuZWVkc1xuXHRcdFx0dmFyIGxvY2FsRGF0YSA9ICQuZXh0ZW5kKCB0cnVlLCBsb2NhbERhdGEsIGRhdGEgKTtcblxuXHRcdFx0dmFyIGNoYXJ0VHlwZSA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10eXBlXCIgKTtcblxuXHRcdFx0Ly9maWx0ZXIgZGF0YSBmb3Igc2VsZWN0ZWQgY291bnRyaWVzXG5cdFx0XHR2YXIgc2VsZWN0ZWRDb3VudHJpZXMgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwic2VsZWN0ZWQtY291bnRyaWVzXCIgKSxcblx0XHRcdFx0c2VsZWN0ZWRDb3VudHJpZXNCeUlkID0gW10sXG5cdFx0XHRcdHNlbGVjdGVkQ291bnRyaWVzSWRzID0gXy5tYXAoIHNlbGVjdGVkQ291bnRyaWVzLCBmdW5jdGlvbih2KSB7XG5cdFx0XHRcdFx0Ly9zdG9yZSBcblx0XHRcdFx0XHRzZWxlY3RlZENvdW50cmllc0J5SWRbIHYuaWQgXSA9IHY7XG5cdFx0XHRcdFx0cmV0dXJuICt2LmlkO1xuXHRcdFx0XHR9ICk7XG5cblx0XHRcdGlmKCBzZWxlY3RlZENvdW50cmllcyAmJiBzZWxlY3RlZENvdW50cmllc0lkcy5sZW5ndGggJiYgIUFwcC5DaGFydE1vZGVsLmdldCggXCJncm91cC1ieS12YXJpYWJsZXNcIiApICkge1xuXHRcdFx0XHRcblx0XHRcdFx0Ly9zZXQgbG9jYWwgY29weSBvZiBjb3VudHJpZXMgY29sb3IsIHRvIGJlIGFibGUgdG8gY3JlYXRlIGJyaWdodGVyXG5cdFx0XHRcdHZhciBjb3VudHJpZXNDb2xvcnMgPSBbXTtcblx0XHRcdFx0bG9jYWxEYXRhID0gXy5maWx0ZXIoIGxvY2FsRGF0YSwgZnVuY3Rpb24oIHZhbHVlLCBrZXksIGxpc3QgKSB7XG5cdFx0XHRcdFx0Ly9zZXQgY29sb3Igd2hpbGUgaW4gdGhlIGxvb3Bcblx0XHRcdFx0XHR2YXIgaWQgPSB2YWx1ZS5pZDtcblx0XHRcdFx0XHQvL25lZWQgdG8gY2hlY2sgZm9yIHNwZWNpYWwgY2FzZSwgd2hlbiB3ZSBoYXZlIG1vcmUgdmFyaWFibGVzIGZvciB0aGUgc2FtZSBjb3VudHJpZXMgKHRoZSBpZHMgd2lsbCBiZSB0aGVuIDIxLTEsIDIyLTEsIGV0Yy4pXG5cdFx0XHRcdFx0aWYoIGlkLmluZGV4T2YoIFwiLVwiICkgPiAwICkge1xuXHRcdFx0XHRcdFx0aWQgPSBwYXJzZUludCggaWQuc3BsaXQoIFwiLVwiIClbIDAgXSwgMTAgKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0aWQgPSBwYXJzZUludCggaWQsIDEwICk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0dmFyIGNvdW50cnkgPSBzZWxlY3RlZENvdW50cmllc0J5SWRbIGlkIF07XG5cdFx0XHRcdFx0aWYoIGNvdW50cnkgJiYgY291bnRyeS5jb2xvciApIHtcblx0XHRcdFx0XHRcdGlmKCAhY291bnRyaWVzQ29sb3JzWyBpZCBdICkge1xuXHRcdFx0XHRcdFx0XHRjb3VudHJpZXNDb2xvcnNbIGlkIF0gPSBjb3VudHJ5LmNvbG9yO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0Ly90aGVyZSBpcyBhbHJlYWR5IGNvbG9yIGZvciBjb3VudHJ5IChtdWx0aXZhcmlhbnQgZGF0YXNldCkgLSBjcmVhdGUgYnJpZ2h0ZXIgY29sb3Jcblx0XHRcdFx0XHRcdFx0Y291bnRyaWVzQ29sb3JzWyBpZCBdID0gZDMucmdiKCBjb3VudHJpZXNDb2xvcnNbIGlkIF0gKS5icmlnaHRlciggMSApLnRvU3RyaW5nKCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR2YWx1ZS5jb2xvciA9IGNvdW50cmllc0NvbG9yc1sgaWQgXTtcblxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR2YWx1ZSA9IHRoYXQuYXNzaWduQ29sb3JGcm9tQ2FjaGUoIHZhbHVlICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdC8vYWN0dWFsIGZpbHRlcmluZ1xuXHRcdFx0XHRcdHJldHVybiAoIF8uaW5kZXhPZiggc2VsZWN0ZWRDb3VudHJpZXNJZHMsIGlkICkgPiAtMSApO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvL1RPRE8gLSBub25zZW5zZT8gY29udmVydCBhc3NvY2lhdGl2ZSBhcnJheSB0byBhcnJheSwgYXNzaWduIGNvbG9ycyBmcm9tIGNhY2hlXG5cdFx0XHRcdGxvY2FsRGF0YSA9IF8ubWFwKCBsb2NhbERhdGEsIGZ1bmN0aW9uKCB2YWx1ZSApIHtcblx0XHRcdFx0XHR2YWx1ZSA9IHRoYXQuYXNzaWduQ29sb3JGcm9tQ2FjaGUoIHZhbHVlICk7XG5cdFx0XHRcdFx0cmV0dXJuIHZhbHVlO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cblx0XHRcdHZhciBkaXNjcmV0ZURhdGE7XG5cdFx0XHRpZiggY2hhcnRUeXBlID09IFwiNlwiICkge1xuXHRcdFx0XHR2YXIgZmxhdHRlblZhbHVlcyA9IF8ubWFwKCBsb2NhbERhdGEsIGZ1bmN0aW9uKCB2ICkge1xuXHRcdFx0XHRcdGlmKCB2ICYmIHYuY29sb3IgKSB7XG5cdFx0XHRcdFx0XHR2LnZhbHVlc1sgMCBdLmNvbG9yID0gdi5jb2xvcjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHYudmFsdWVzWzBdO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdGRpc2NyZXRlRGF0YSA9IFt7IGtleTogXCJ2YXJpYWJsZVwiLCB2YWx1ZXM6IGZsYXR0ZW5WYWx1ZXMgfV07XG5cdFx0XHRcdGxvY2FsRGF0YSA9IGRpc2NyZXRlRGF0YTtcblx0XHRcdH1cblxuXHRcdFx0Ly9maWx0ZXIgYnkgY2hhcnQgdGltZVxuXHRcdFx0dmFyIGNoYXJ0VGltZSA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10aW1lXCIgKTtcblx0XHRcdGlmKCBjaGFydFRpbWUgJiYgY2hhcnRUaW1lLmxlbmd0aCA9PSAyICkge1xuXHRcdFx0XHRcblx0XHRcdFx0dmFyIHRpbWVGcm9tID0gY2hhcnRUaW1lWyAwIF0sXG5cdFx0XHRcdFx0dGltZVRvID0gY2hhcnRUaW1lWyAxIF07XG5cdFx0XHRcdFxuXHRcdFx0XHRfLmVhY2goIGxvY2FsRGF0YSwgZnVuY3Rpb24oIHNpbmdsZURhdGEsIGtleSwgbGlzdCApIHtcblx0XHRcdFx0XHR2YXIgdmFsdWVzID0gXy5jbG9uZSggc2luZ2xlRGF0YS52YWx1ZXMgKTtcblx0XHRcdFx0XHR2YWx1ZXMgPSBfLmZpbHRlciggdmFsdWVzLCBmdW5jdGlvbiggdmFsdWUgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gKCBwYXJzZUludCggdmFsdWUudGltZSwgMTAgKSA+PSB0aW1lRnJvbSAmJiBwYXJzZUludCggdmFsdWUudGltZSwgMTAgKSA8PSB0aW1lVG8gKTtcblx0XHRcdFx0XHRcdC8vcmV0dXJuICggdmFsdWUueCA+PSB0aW1lRnJvbSAmJiB2YWx1ZS54IDw9IHRpbWVUbyApO1xuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHRzaW5nbGVEYXRhLnZhbHVlcyA9IHZhbHVlcztcblx0XHRcdFx0fSApO1xuXG5cdFx0XHR9XG5cblx0XHRcdC8vaWYgbGVnZW5kIGRpc3BsYXllZCwgc29ydCBkYXRhIG9uIGtleSBhbHBoYWJldGljYWxseSAodXNlZnVsbCB3aGVuIG11bHRpdmFyaWFuIGRhdGFzZXQpXG5cdFx0XHRpZiggIUFwcC5DaGFydE1vZGVsLmdldCggXCJoaWRlLWxlZ2VuZFwiICkgKSB7XG5cdFx0XHRcdGxvY2FsRGF0YSA9IF8uc29ydEJ5KCBsb2NhbERhdGEsIGZ1bmN0aW9uKCBvYmogKSB7IHJldHVybiBvYmoua2V5OyB9ICk7XG5cdFx0XHR9XG5cblx0XHRcdC8vZ2V0IGF4aXMgY29uZmlnc1xuXHRcdFx0dmFyIHhBeGlzID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcIngtYXhpc1wiICksXG5cdFx0XHRcdHlBeGlzID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcInktYXhpc1wiICksXG5cdFx0XHRcdHhBeGlzUHJlZml4ID0gKCB4QXhpc1sgXCJheGlzLXByZWZpeFwiIF0gfHwgXCJcIiApLFxuXHRcdFx0XHR4QXhpc1N1ZmZpeCA9ICggeEF4aXNbIFwiYXhpcy1zdWZmaXhcIiBdIHx8IFwiXCIgKSxcblx0XHRcdFx0eUF4aXNQcmVmaXggPSAoIHlBeGlzWyBcImF4aXMtcHJlZml4XCIgXSB8fCBcIlwiICksXG5cdFx0XHRcdHlBeGlzU3VmZml4ID0gKCB5QXhpc1sgXCJheGlzLXN1ZmZpeFwiIF0gfHwgXCJcIiApLFxuXHRcdFx0XHR4QXhpc0xhYmVsRGlzdGFuY2UgPSAoICt4QXhpc1sgXCJheGlzLWxhYmVsLWRpc3RhbmNlXCIgXSB8fCAwICksXG5cdFx0XHRcdHlBeGlzTGFiZWxEaXN0YW5jZSA9ICggK3lBeGlzWyBcImF4aXMtbGFiZWwtZGlzdGFuY2VcIiBdIHx8IDAgKSxcblx0XHRcdFx0eEF4aXNNaW4gPSAoIHhBeGlzWyBcImF4aXMtbWluXCIgXSB8fCBudWxsICksXG5cdFx0XHRcdHhBeGlzTWF4ID0gKCB4QXhpc1sgXCJheGlzLW1heFwiIF0gfHwgbnVsbCApLFxuXHRcdFx0XHR5QXhpc01pbiA9ICggeUF4aXNbIFwiYXhpcy1taW5cIiBdIHx8IDAgKSxcblx0XHRcdFx0eUF4aXNNYXggPSAoIHlBeGlzWyBcImF4aXMtbWF4XCIgXSB8fCBudWxsICksXG5cdFx0XHRcdHhBeGlzU2NhbGUgPSAoIHhBeGlzWyBcImF4aXMtc2NhbGVcIiBdIHx8IFwibGluZWFyXCIgKSxcblx0XHRcdFx0eUF4aXNTY2FsZSA9ICggeUF4aXNbIFwiYXhpcy1zY2FsZVwiIF0gfHwgXCJsaW5lYXJcIiApLFxuXHRcdFx0XHR4QXhpc0Zvcm1hdCA9ICggeEF4aXNbIFwiYXhpcy1mb3JtYXRcIiBdIHx8IDAgKSxcblx0XHRcdFx0eUF4aXNGb3JtYXQgPSAoIHlBeGlzWyBcImF4aXMtZm9ybWF0XCIgXSB8fCAwICk7XG5cblx0XHRcdG52LmFkZEdyYXBoKGZ1bmN0aW9uKCkge1xuXG5cdFx0XHRcdHZhciBjaGFydE9wdGlvbnMgPSB7XG5cdFx0XHRcdFx0dHJhbnNpdGlvbkR1cmF0aW9uOiAzMDAsXG5cdFx0XHRcdFx0bWFyZ2luOiB7IHRvcDowLCBsZWZ0OjUwLCByaWdodDozMCwgYm90dG9tOjAgfSwvLyBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwibWFyZ2luc1wiICksXG5cdFx0XHRcdFx0c2hvd0xlZ2VuZDogZmFsc2Vcblx0XHRcdFx0fTtcblxuXHRcdFx0XHQvL2xpbmUgdHlwZVxuXHRcdFx0XHR2YXIgbGluZVR5cGUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwibGluZS10eXBlXCIgKTtcblx0XHRcdFx0aWYoIGxpbmVUeXBlID09IDIgKSB7XG5cdFx0XHRcdFx0Y2hhcnRPcHRpb25zLmRlZmluZWQgPSBmdW5jdGlvbiggZCApIHsgcmV0dXJuIGQueSAhPT0gMDsgfTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiggbGluZVR5cGUgPT0gMCApIHtcblx0XHRcdFx0XHR0aGF0LiRlbC5hZGRDbGFzcyggXCJsaW5lLWRvdHNcIiApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoYXQuJGVsLnJlbW92ZUNsYXNzKCBcImxpbmUtZG90c1wiICk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvL2RlcGVuZGluZyBvbiBjaGFydCB0eXBlIGNyZWF0ZSBjaGFydFxuXHRcdFx0XHRpZiggY2hhcnRUeXBlID09IFwiMVwiICkge1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdC8vbGluZSBjaGFydFxuXHRcdFx0XHRcdHRoYXQuY2hhcnQgPSBudi5tb2RlbHMubGluZUNoYXJ0KCkub3B0aW9ucyggY2hhcnRPcHRpb25zICk7XG5cdFx0XHRcdFxuXHRcdFx0XHR9IGVsc2UgaWYoIGNoYXJ0VHlwZSA9PSBcIjJcIiApIHtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHQvL3NjYXR0ZXIgcGxvdFxuXHRcdFx0XHRcdHZhciBwb2ludHMgPSB0aGF0LnNjYXR0ZXJCdWJibGVTaXplKCk7XG5cdFx0XHRcdFx0dGhhdC5jaGFydCA9IG52Lm1vZGVscy5zY2F0dGVyQ2hhcnQoKS5vcHRpb25zKCBjaGFydE9wdGlvbnMgKS5wb2ludFJhbmdlKCBwb2ludHMgKS5zaG93RGlzdFgoIHRydWUgKS5zaG93RGlzdFkoIHRydWUgKTtcblx0XHRcdFx0XHRcblx0XHRcdFx0fSBlbHNlIGlmKCBjaGFydFR5cGUgPT0gXCIzXCIgKSB7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0Ly9zdGFja2VkIGFyZWEgY2hhcnRcblx0XHRcdFx0XHQvL3dlIG5lZWQgdG8gbWFrZSBzdXJlIHdlIGhhdmUgYXMgbXVjaCBkYXRhIGFzIG5lY2Vzc2FyeVxuXHRcdFx0XHRcdGlmKCBsb2NhbERhdGEubGVuZ3RoICkge1xuXHRcdFx0XHRcdFx0dmFyIGJhc2VTZXJpZXMgPSBsb2NhbERhdGFbMF07XG5cdFx0XHRcdFx0XHRfLmVhY2goIGxvY2FsRGF0YSwgZnVuY3Rpb24oIHNlcmllLCBpICkge1xuXHRcdFx0XHRcdFx0XHRpZiggaSA+IDAgKSB7XG5cdFx0XHRcdFx0XHRcdFx0Ly9tYWtlIHN1cmUgd2UgaGF2ZSB2YWx1ZXMgZm9yIGdpdmVuIHNlcmllc1xuXHRcdFx0XHRcdFx0XHRcdGlmKCBzZXJpZS52YWx1ZXMgJiYgIXNlcmllLnZhbHVlcy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHQvL2Nsb25lIGJhc2Ugc2VyaWVzXG5cdFx0XHRcdFx0XHRcdFx0XHR2YXIgY29weVZhbHVlcyA9IFtdO1xuXHRcdFx0XHRcdFx0XHRcdFx0JC5leHRlbmQodHJ1ZSwgY29weVZhbHVlcywgYmFzZVNlcmllcy52YWx1ZXMpO1xuXHRcdFx0XHRcdFx0XHRcdFx0Ly9udWxsaWZ5IHZhbHVlc1xuXHRcdFx0XHRcdFx0XHRcdFx0Xy5lYWNoKCBjb3B5VmFsdWVzLCBmdW5jdGlvbiggdiwgaSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR2LnkgPSAwO1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR2LmZha2UgPSBcInRydWVcIjtcblx0XHRcdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0XHRcdFx0c2VyaWUudmFsdWVzID0gY29weVZhbHVlcztcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0Y2hhcnRPcHRpb25zLnNob3dUb3RhbEluVG9vbHRpcCA9IHRydWU7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0dGhhdC5jaGFydCA9IG52Lm1vZGVscy5zdGFja2VkQXJlYUNoYXJ0KClcblx0XHRcdFx0XHRcdC5vcHRpb25zKCBjaGFydE9wdGlvbnMgKVxuXHRcdFx0XHRcdFx0LmNvbnRyb2xPcHRpb25zKCBbIFwiU3RhY2tlZFwiLCBcIkV4cGFuZGVkXCIgXSApXG5cdFx0XHRcdFx0XHQudXNlSW50ZXJhY3RpdmVHdWlkZWxpbmUoIHRydWUgKVxuXHRcdFx0XHRcdFx0LngoIGZ1bmN0aW9uKCBkICkgeyByZXR1cm4gZFsgXCJ4XCIgXTsgfSApXG5cdFx0XHRcdFx0XHQueSggZnVuY3Rpb24oIGQgKSB7IHJldHVybiBkWyBcInlcIiBdOyB9ICk7XG5cdFx0XHRcblx0XHRcdFx0fSBlbHNlIGlmKCBjaGFydFR5cGUgPT0gXCI0XCIgfHwgY2hhcnRUeXBlID09IFwiNVwiICkge1xuXG5cdFx0XHRcdFx0Ly9tdWx0aWJhciBjaGFydFxuXHRcdFx0XHRcdC8vd2UgbmVlZCB0byBtYWtlIHN1cmUgd2UgaGF2ZSBhcyBtdWNoIGRhdGEgYXMgbmVjZXNzYXJ5XG5cdFx0XHRcdFx0dmFyIGFsbFRpbWVzID0gW10sXG5cdFx0XHRcdFx0XHQvL3N0b3JlIHZhbHVlcyBieSBbZW50aXR5XVt0aW1lXVxuXHRcdFx0XHRcdFx0dmFsdWVzQ2hlY2sgPSBbXTtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHQvL2V4dHJhY3QgYWxsIHRpbWVzXG5cdFx0XHRcdFx0Xy5lYWNoKCBsb2NhbERhdGEsIGZ1bmN0aW9uKCB2LCBpICkge1xuXHRcdFx0XHRcdFx0XHRcblx0XHRcdFx0XHRcdHZhciBlbnRpdHlEYXRhID0gW10sXG5cdFx0XHRcdFx0XHRcdHRpbWVzID0gdi52YWx1ZXMubWFwKCBmdW5jdGlvbiggdjIsIGkgKSB7XG5cdFx0XHRcdFx0XHRcdFx0ZW50aXR5RGF0YVsgdjIueCBdID0gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gdjIueDtcblx0XHRcdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdFx0dmFsdWVzQ2hlY2tbIHYuaWQgXSA9IGVudGl0eURhdGE7XG5cdFx0XHRcdFx0XHRhbGxUaW1lcyA9IGFsbFRpbWVzLmNvbmNhdCggdGltZXMgKTtcblx0XHRcdFx0XHRcdFxuXHRcdFx0XHRcdH0gKTtcblxuXHRcdFx0XHRcdGFsbFRpbWVzID0gXy51bmlxKCBhbGxUaW1lcyApO1xuXHRcdFx0XHRcdGFsbFRpbWVzID0gXy5zb3J0QnkoIGFsbFRpbWVzICk7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0aWYoIGxvY2FsRGF0YS5sZW5ndGggKSB7XG5cdFx0XHRcdFx0XHRfLmVhY2goIGxvY2FsRGF0YSwgZnVuY3Rpb24oIHNlcmllLCBzZXJpZUluZGV4ICkge1xuXHRcdFx0XHRcdFx0XHRcblx0XHRcdFx0XHRcdFx0Ly9tYWtlIHN1cmUgd2UgaGF2ZSB2YWx1ZXMgZm9yIGdpdmVuIHNlcmllc1xuXHRcdFx0XHRcdFx0XHRfLmVhY2goIGFsbFRpbWVzLCBmdW5jdGlvbiggdGltZSwgdGltZUluZGV4ICkge1xuXHRcdFx0XHRcdFx0XHRcdGlmKCB2YWx1ZXNDaGVja1sgc2VyaWUuaWQgXSAmJiAhdmFsdWVzQ2hlY2tbIHNlcmllLmlkIF1bIHRpbWUgXSApIHtcblx0XHRcdFx0XHRcdFx0XHRcdC8vdGltZSBkb2Vzbid0IGV4aXN0aWcgZm9yIGdpdmVuIGVudGl0eSwgaW5zZXJ0IHplcm8gdmFsdWVcblx0XHRcdFx0XHRcdFx0XHRcdHZhciB6ZXJvT2JqID0ge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcImtleVwiOiBzZXJpZS5rZXksXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFwic2VyaWVcIjogc2VyaWVJbmRleCxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XCJ0aW1lXCI6IHRpbWUsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFwieFwiOiB0aW1lLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcInlcIjogMCxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XCJmYWtlXCI6IHRydWVcblx0XHRcdFx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XHRcdFx0XHRzZXJpZS52YWx1ZXMuc3BsaWNlKCB0aW1lSW5kZXgsIDAsIHplcm9PYmogKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYoIGNoYXJ0VHlwZSA9PSBcIjRcIiApIHtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHRcdHRoYXQuY2hhcnQgPSBudi5tb2RlbHMubXVsdGlCYXJDaGFydCgpLm9wdGlvbnMoIGNoYXJ0T3B0aW9ucyApO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdH0gZWxzZSBpZiggIGNoYXJ0VHlwZSA9PSBcIjVcIiApIHtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHRcdHRoYXQuY2hhcnQgPSBudi5tb2RlbHMubXVsdGlCYXJIb3Jpem9udGFsQ2hhcnQoKS5vcHRpb25zKCBjaGFydE9wdGlvbnMgKTsvLy5zaG93VmFsdWVzKCB0cnVlICk7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdH0gZWxzZSBpZiggY2hhcnRUeXBlID09IFwiNlwiICkge1xuXG5cdFx0XHRcdFx0Y2hhcnRPcHRpb25zLnNob3dWYWx1ZXMgPSB0cnVlO1xuXG5cdFx0XHRcdFx0dGhhdC5jaGFydCA9IG52Lm1vZGVscy5kaXNjcmV0ZUJhckNoYXJ0KClcblx0XHRcdFx0XHRcdC54KCBmdW5jdGlvbiggZCApIHsgcmV0dXJuIGQueDsgfSApXG5cdFx0XHRcdFx0XHQueSggZnVuY3Rpb24oIGQgKSB7IHJldHVybiBkLnk7IH0gKVxuXHRcdFx0XHRcdFx0Lm9wdGlvbnMoIGNoYXJ0T3B0aW9ucyApO1xuXG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvL2ZpeGVkIHByb2JhYmx5IGEgYnVnIGluIG52ZDMgd2l0aCBwcmV2aW91cyB0b29sdGlwIG5vdCBiZWluZyByZW1vdmVkXG5cdFx0XHRcdGQzLnNlbGVjdCggXCIueHktdG9vbHRpcFwiICkucmVtb3ZlKCk7XG5cblx0XHRcdFx0dGhhdC5jaGFydC54QXhpc1xuXHRcdFx0XHRcdC5heGlzTGFiZWwoIHhBeGlzWyBcImF4aXMtbGFiZWxcIiBdIClcblx0XHRcdFx0XHQvLy5zdGFnZ2VyTGFiZWxzKCB0cnVlIClcblx0XHRcdFx0XHQuYXhpc0xhYmVsRGlzdGFuY2UoIHhBeGlzTGFiZWxEaXN0YW5jZSApXG5cdFx0XHRcdFx0LnRpY2tGb3JtYXQoIGZ1bmN0aW9uKGQpIHtcblx0XHRcdFx0XHRcdGlmKCBjaGFydFR5cGUgIT0gMiApIHtcblx0XHRcdFx0XHRcdFx0Ly94IGF4aXMgaGFzIHRpbWUgaW5mb3JtYXRpb25cblx0XHRcdFx0XHRcdFx0cmV0dXJuIEFwcC5VdGlscy5mb3JtYXRUaW1lTGFiZWwoIHRpbWVUeXBlLCBkLCB4QXhpc1ByZWZpeCwgeEF4aXNTdWZmaXgsIHhBeGlzRm9ybWF0ICk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHQvL2lzIHNjYXR0ZXIgcGxvdCwgeC1heGlzIGhhcyBzb21lIG90aGVyIGluZm9ybWF0aW9uXG5cdFx0XHRcdFx0XHRcdHJldHVybiB4QXhpc1ByZWZpeCArIGQzLmZvcm1hdCggXCIsXCIgKSggQXBwLlV0aWxzLmZvcm1hdFZhbHVlKCBkLCB4QXhpc0Zvcm1hdCApICkgKyB4QXhpc1N1ZmZpeDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9ICk7XG5cblx0XHRcdFx0aWYoIHRpbWVUeXBlID09IFwiUXVhcnRlciBDZW50dXJ5XCIgKSB7XG5cdFx0XHRcdFx0dGhhdC5jaGFydC54QXhpcy5zdGFnZ2VyTGFiZWxzKCB0cnVlICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdC8vZ2V0IGV4dGVuZFxuXHRcdFx0XHR2YXIgYWxsVmFsdWVzID0gW107XG5cdFx0XHRcdF8uZWFjaCggbG9jYWxEYXRhLCBmdW5jdGlvbiggdiwgaSApIHtcblx0XHRcdFx0XHRpZiggdi52YWx1ZXMgKSB7XG5cdFx0XHRcdFx0XHRhbGxWYWx1ZXMgPSBhbGxWYWx1ZXMuY29uY2F0KCB2LnZhbHVlcyApO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiggJC5pc0FycmF5KCB2ICkgKXtcblx0XHRcdFx0XHRcdC8vc3BlY2lhbCBjYXNlIGZvciBkaXNjcmV0ZSBiYXIgY2hhcnRcblx0XHRcdFx0XHRcdGFsbFZhbHVlcyA9IHY7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9ICk7XG5cblx0XHRcdFx0Ly9kb21haW4gc2V0dXBcblx0XHRcdFx0dmFyIHhEb21haW4gPSBkMy5leHRlbnQoIGFsbFZhbHVlcy5tYXAoIGZ1bmN0aW9uKCBkICkgeyByZXR1cm4gZC54OyB9ICkgKSxcblx0XHRcdFx0XHR5RG9tYWluID0gZDMuZXh0ZW50KCBhbGxWYWx1ZXMubWFwKCBmdW5jdGlvbiggZCApIHsgcmV0dXJuIGQueTsgfSApICksXG5cdFx0XHRcdFx0aXNDbGFtcGVkID0gZmFsc2U7XG5cblx0XHRcdFx0Ly9jb25zb2xlLmxvZyggXCJjaGFydC5zdGFja2VkLnN0eWxlKClcIiwgdGhhdC5jaGFydC5zdGFja2VkLnN0eWxlKCkgKTtcblxuXHRcdFx0XHRpZiggeEF4aXNNaW4gJiYgIWlzTmFOKCB4QXhpc01pbiApICkge1xuXHRcdFx0XHRcdHhEb21haW5bIDAgXSA9IHhBeGlzTWluO1xuXHRcdFx0XHRcdGlzQ2xhbXBlZCA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYoIHhBeGlzTWF4ICYmICFpc05hTiggeEF4aXNNYXggKSApIHtcblx0XHRcdFx0XHR4RG9tYWluWyAxIF0gPSB4QXhpc01heDtcblx0XHRcdFx0XHRpc0NsYW1wZWQgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmKCB5QXhpc01pbiAmJiAhaXNOYU4oIHlBeGlzTWluICkgKSB7XG5cdFx0XHRcdFx0eURvbWFpblsgMCBdID0geUF4aXNNaW47XG5cdFx0XHRcdFx0aXNDbGFtcGVkID0gdHJ1ZTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvL2RlZmF1bHQgaXMgemVybyAoZG9uJ3QgZG8gaXQgZm9yIHN0YWNrIGJhciBjaGFydCwgbWVzc2VzIHVwIHRoaW5ncylcblx0XHRcdFx0XHRpZiggY2hhcnRUeXBlICE9IFwiM1wiICkge1xuXHRcdFx0XHRcdFx0eURvbWFpblsgMCBdID0gMDtcblx0XHRcdFx0XHRcdGlzQ2xhbXBlZCA9IHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGlmKCB5QXhpc01heCAmJiAhaXNOYU4oIHlBeGlzTWF4ICkgKSB7XG5cdFx0XHRcdFx0eURvbWFpblsgMSBdID0geUF4aXNNYXg7XG5cdFx0XHRcdFx0aXNDbGFtcGVkID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0Ly9tYW51YWxseSBjbGFtcCB2YWx1ZXNcblx0XHRcdFx0aWYoIGlzQ2xhbXBlZCApIHtcblxuXHRcdFx0XHRcdGlmKCBjaGFydFR5cGUgIT09IFwiNFwiICYmIGNoYXJ0VHlwZSAhPT0gXCI1XCIgJiYgY2hhcnRUeXBlICE9PSBcIjZcIiApIHtcblx0XHRcdFx0XHRcdHRoYXQuY2hhcnQuZm9yY2VYKCB4RG9tYWluICk7XG5cdFx0XHRcdFx0XHR0aGF0LmNoYXJ0LmZvcmNlWSggeURvbWFpbiApO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8qdGhhdC5jaGFydC54RG9tYWluKCB4RG9tYWluICk7XG5cdFx0XHRcdFx0dGhhdC5jaGFydC55RG9tYWluKCB5RG9tYWluICk7XG5cdFx0XHRcdFx0dGhhdC5jaGFydC54U2NhbGUoKS5jbGFtcCggdHJ1ZSApO1xuXHRcdFx0XHRcdHRoYXQuY2hhcnQueVNjYWxlKCkuY2xhbXAoIHRydWUgKTsqL1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly9zZXQgc2NhbGVzLCBtdWx0aWJhciBjaGFydFxuXHRcdFx0XHRpZiggeUF4aXNTY2FsZSA9PT0gXCJsaW5lYXJcIiApIHtcblx0XHRcdFx0XHR0aGF0LmNoYXJ0LnlTY2FsZSggZDMuc2NhbGUubGluZWFyKCkgKTtcblx0XHRcdFx0fSBlbHNlIGlmKCB5QXhpc1NjYWxlID09PSBcImxvZ1wiICkge1xuXHRcdFx0XHRcdHRoYXQuY2hhcnQueVNjYWxlKCBkMy5zY2FsZS5sb2coKSApO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYoIGNoYXJ0VHlwZSA9PT0gXCI0XCIgfHwgY2hhcnRUeXBlID09PSBcIjVcIiApIHtcblx0XHRcdFx0XHQvL2ZvciBtdWx0aWJhciBjaGFydCwgeCBheGlzIGhhcyBvcmRpbmFsIHNjYWxlLCBzbyBuZWVkIHRvIHNldHVwIGRvbWFpbiBwcm9wZXJseVxuXHRcdFx0XHRcdC8vdGhhdC5jaGFydC54RG9tYWluKCBkMy5yYW5nZSh4RG9tYWluWzBdLCB4RG9tYWluWzFdICsgMSkgKTtcblx0XHRcdFx0XHR0aGF0LmNoYXJ0LnhEb21haW4oIGFsbFRpbWVzICk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGF0LmNoYXJ0LnlBeGlzXG5cdFx0XHRcdFx0LmF4aXNMYWJlbCggeUF4aXNbIFwiYXhpcy1sYWJlbFwiIF0gKVxuXHRcdFx0XHRcdC5heGlzTGFiZWxEaXN0YW5jZSggeUF4aXNMYWJlbERpc3RhbmNlIClcblx0XHRcdFx0XHQudGlja0Zvcm1hdCggZnVuY3Rpb24oZCkgeyByZXR1cm4geUF4aXNQcmVmaXggKyBkMy5mb3JtYXQoIFwiLFwiICkoIEFwcC5VdGlscy5mb3JtYXRWYWx1ZSggZCwgeUF4aXNGb3JtYXQgKSApICsgeUF4aXNTdWZmaXg7IH0pXG5cdFx0XHRcdFx0LnNob3dNYXhNaW4oZmFsc2UpO1xuXHRcdFx0XHRcblx0XHRcdFx0Ly9zY2F0dGVyIHBsb3RzIG5lZWQgbW9yZSB0aWNrc1xuXHRcdFx0XHRpZiggY2hhcnRUeXBlID09PSBcIjJcIiApIHtcblx0XHRcdFx0XHQvL2hhcmRjb2RlXG5cdFx0XHRcdFx0dGhhdC5jaGFydC54QXhpcy50aWNrcyggNyApO1xuXHRcdFx0XHRcdHRoYXQuY2hhcnQueUF4aXMudGlja3MoIDcgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0dmFyIHN2Z1NlbGVjdGlvbiA9IGQzLnNlbGVjdCggdGhhdC4kc3ZnLnNlbGVjdG9yIClcblx0XHRcdFx0XHQuZGF0dW0oIGxvY2FsRGF0YSApXG5cdFx0XHRcdFx0LmNhbGwoIHRoYXQuY2hhcnQgKTtcblx0XHRcdFx0XG5cdFx0XHRcdGlmKCBjaGFydFR5cGUgIT09IFwiM1wiICkge1xuXG5cdFx0XHRcdFx0dGhhdC5jaGFydC50b29sdGlwLmNvbnRlbnRHZW5lcmF0b3IoIEFwcC5VdGlscy5jb250ZW50R2VuZXJhdG9yICk7XG5cblx0XHRcdFx0fSBlbHNlIHtcblxuXHRcdFx0XHRcdC8vc2V0IHBvcHVwXG5cdFx0XHRcdFx0dmFyIHVuaXRzU3RyaW5nID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcInVuaXRzXCIgKSxcblx0XHRcdFx0XHRcdHVuaXRzID0gKCAhJC5pc0VtcHR5T2JqZWN0KCB1bml0c1N0cmluZyApICk/ICQucGFyc2VKU09OKCB1bml0c1N0cmluZyApOiB7fSxcblx0XHRcdFx0XHRcdHN0cmluZyA9IFwiXCIsXG5cdFx0XHRcdFx0XHR2YWx1ZXNTdHJpbmcgPSBcIlwiO1xuXG5cdFx0XHRcdFx0Ly9kMy5mb3JtYXQgd2l0aCBhZGRlZCBwYXJhbXMgdG8gYWRkIGFyYml0cmFyeSBzdHJpbmcgYXQgdGhlIGVuZFxuXHRcdFx0XHRcdHZhciBjdXN0b21Gb3JtYXR0ZXIgPSBmdW5jdGlvbiggZm9ybWF0U3RyaW5nLCBzdWZmaXggKSB7XG5cdFx0XHRcdFx0XHR2YXIgZnVuYyA9IGQzLmZvcm1hdCggZm9ybWF0U3RyaW5nICk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZnVuY3Rpb24oIGQsIGkgKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBmdW5jKCBkICkgKyBzdWZmaXg7XG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdH07XG5cblx0XHRcdFx0XHQvL2RpZmZlcmVudCBwb3B1cCBzZXR1cCBmb3Igc3RhY2tlZCBhcmVhIGNoYXJ0XG5cdFx0XHRcdFx0dmFyIHVuaXQgPSBfLmZpbmRXaGVyZSggdW5pdHMsIHsgcHJvcGVydHk6IFwieVwiIH0gKTtcblx0XHRcdFx0XHRpZiggdW5pdCAmJiB1bml0LmZvcm1hdCApIHtcblx0XHRcdFx0XHRcdHZhciBmaXhlZCA9IE1hdGgubWluKCAyMCwgcGFyc2VJbnQoIHVuaXQuZm9ybWF0LCAxMCApICksXG5cdFx0XHRcdFx0XHRcdHVuaXROYW1lID0gKCB1bml0LnVuaXQgKT8gXCIgXCIgKyB1bml0LnVuaXQ6IFwiXCI7XG5cdFx0XHRcdFx0XHR0aGF0LmNoYXJ0LmludGVyYWN0aXZlTGF5ZXIudG9vbHRpcC52YWx1ZUZvcm1hdHRlciggY3VzdG9tRm9ybWF0dGVyKFwiLlwiICsgZml4ZWQgKyBcImZcIiwgdW5pdE5hbWUgKSApO1xuXHRcdFx0XHRcdFx0Ly90aGF0LmNoYXJ0LmludGVyYWN0aXZlTGF5ZXIudG9vbHRpcC52YWx1ZUZvcm1hdHRlciggZDMuZm9ybWF0KFwiLlwiICsgZml4ZWQgKyBcImZcIiApICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFxuXHRcdFx0XHR9XG5cdFx0XHRcdFxuXHRcdFx0XHQvL3NldCBsZWdlbmRcblx0XHRcdFx0aWYoICFBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiaGlkZS1sZWdlbmRcIiApICkge1xuXHRcdFx0XHRcdC8vbWFrZSBzdXJlIHdyYXBwZXIgaXMgdmlzaWJsZVxuXHRcdFx0XHRcdHRoYXQuJHN2Zy5maW5kKCBcIj4gLm52ZDMubnYtY3VzdG9tLWxlZ2VuZFwiICkuc2hvdygpO1xuXHRcdFx0XHRcdHRoYXQubGVnZW5kID0gbmV3IExlZ2VuZCggdGhhdC5jaGFydC5sZWdlbmQgKS52ZXJzKCBcIm93ZFwiICk7XG5cdFx0XHRcdFx0dGhhdC5sZWdlbmQuZGlzcGF0Y2gub24oIFwicmVtb3ZlRW50aXR5XCIsIGZ1bmN0aW9uKCBpZCApIHtcblx0XHRcdFx0XHRcdHRoYXQub25SZW1vdmVFbnRpdHkoIGlkICk7XG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdHRoYXQubGVnZW5kLmRpc3BhdGNoLm9uKCBcImFkZEVudGl0eVwiLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdGlmKCB0aGF0LiRlbnRpdGllc1NlbGVjdC5kYXRhKCBcImNob3NlblwiICkgKSB7XG5cdFx0XHRcdFx0XHRcdHRoYXQuJGVudGl0aWVzU2VsZWN0LmRhdGEoIFwiY2hvc2VuXCIgKS5hY3RpdmVfZmllbGQgPSBmYWxzZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdC8vdHJpZ2dlciBvcGVuIHRoZSBjaG9zZW4gZHJvcCBkb3duXG5cdFx0XHRcdFx0XHR0aGF0LiRlbnRpdGllc1NlbGVjdC50cmlnZ2VyKCBcImNob3NlbjpvcGVuXCIgKTtcblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0c3ZnU2VsZWN0aW9uLmNhbGwoIHRoYXQubGVnZW5kICk7XG5cdFx0XHRcdFx0Ly9wdXQgbGVnZW5kIGFib3ZlIGNoYXJ0XG5cblxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vbm8gbGVnZW5kLCByZW1vdmUgd2hhdCBtaWdodCBoYXZlIHByZXZpb3VzbHkgYmVlbiB0aGVyZVxuXHRcdFx0XHRcdHRoYXQuJHN2Zy5maW5kKCBcIj4gLm52ZDMubnYtY3VzdG9tLWxlZ2VuZFwiICkuaGlkZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdFxuXHRcdFx0XHR2YXIgb25SZXNpemVDYWxsYmFjayA9IF8uZGVib3VuY2UoIGZ1bmN0aW9uKGUpIHtcblx0XHRcdFx0XHQvL2ludm9rZSByZXNpemUgb2YgbGVnZW5kLCBpZiB0aGVyZSdzIG9uZSwgc2NhdHRlciBwbG90IGRvZXNuJ3QgaGF2ZSBhbnkgYnkgZGVmYXVsdFxuXHRcdFx0XHRcdGlmKCB0aGF0LmxlZ2VuZCApIHtcblx0XHRcdFx0XHRcdHN2Z1NlbGVjdGlvbi5jYWxsKCB0aGF0LmxlZ2VuZCApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGF0LnBhcmVudFZpZXcub25SZXNpemUoKTtcblx0XHRcdFx0fSwgMTUwICk7XG5cdFx0XHRcdG52LnV0aWxzLndpbmRvd1Jlc2l6ZSggb25SZXNpemVDYWxsYmFjayApO1xuXHRcdFx0XHRcdFx0XG5cdFx0XHRcdHRoYXQucGFyZW50Vmlldy5vblJlc2l6ZSgpO1xuXG5cdFx0XHRcdHZhciBzdGF0ZUNoYW5nZUV2ZW50ID0gKCBjaGFydFR5cGUgIT09IFwiNlwiICk/IFwic3RhdGVDaGFuZ2VcIjogXCJyZW5kZXJFbmRcIjtcblx0XHRcdFx0dGhhdC5jaGFydC5kaXNwYXRjaC5vbiggc3RhdGVDaGFuZ2VFdmVudCwgZnVuY3Rpb24oIHN0YXRlICkge1xuXHRcdFx0XHRcdC8vcmVmcmVzaCBsZWdlbmQ7XG5cdFx0XHRcdFx0c3ZnU2VsZWN0aW9uLmNhbGwoIHRoYXQubGVnZW5kICk7XG5cblx0XHRcdFx0XHQvL1xuXHRcdFx0XHRcdGlmKCBjaGFydFR5cGUgPT09IFwiM1wiICkge1xuXHRcdFx0XHRcdFx0dGhhdC5jaGVja1N0YWNrZWRBeGlzKCk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly9UT0RPIC0gdWdseSEgbmVlZHMgdGltZW91dCBhbmQgcmVhY2hpbmcgdG8gY2hhcnR2aWV3ICBcblx0XHRcdFx0XHRzZXRUaW1lb3V0KCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdHRoYXQucGFyZW50Vmlldy5vblJlc2l6ZSgpO1xuXHRcdFx0XHRcdH0sIDEpO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdHRoYXQucGFyZW50Vmlldy5kYXRhVGFiLnJlbmRlciggZGF0YSwgbG9jYWxEYXRhLCBkaW1lbnNpb25zICk7XG5cdFx0XHRcdFxuXHRcdFx0XHRpZiggY2hhcnRUeXBlID09IFwiMlwiICkge1xuXHRcdFx0XHRcdC8vbmVlZCB0byBoYXZlIG93biBzaG93RGlzdCBpbXBsZW1lbnRhdGlvbiwgY2F1c2UgdGhlcmUncyBhIGJ1ZyBpbiBudmQzXG5cdFx0XHRcdFx0dGhhdC5zY2F0dGVyRGlzdCgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdFxuXHRcdFx0XHQvL2lmIHkgYXhpcyBoYXMgemVybywgZGlzcGxheSBzb2xpZCBsaW5lXG5cdFx0XHRcdHZhciAkcGF0aERvbWFpbiA9ICQoIFwiLm52ZDMgLm52LWF4aXMubnYteCBwYXRoLmRvbWFpblwiICk7XG5cdFx0XHRcdGlmKCB5RG9tYWluWyAwIF0gPT09IDAgKSB7XG5cdFx0XHRcdFx0JHBhdGhEb21haW4uY3NzKCBcInN0cm9rZS1vcGFjaXR5XCIsIFwiMVwiICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0JHBhdGhEb21haW4uY3NzKCBcInN0cm9rZS1vcGFjaXR5XCIsIFwiMFwiICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdC8vdGhhdC5zY2FsZVNlbGVjdG9ycy5pbml0RXZlbnRzKCk7XG5cdFx0XHRcdHZhciBjaGFydERpbWVuc2lvbnNTdHJpbmcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtZGltZW5zaW9uc1wiICk7XG5cdFx0XHRcdGlmKCBjaGFydERpbWVuc2lvbnNTdHJpbmcuaW5kZXhPZiggJ1wicHJvcGVydHlcIjpcImNvbG9yXCInICkgPT09IC0xICkge1xuXHRcdFx0XHRcdC8vY2hlY2sgaWYgc3RyaW5nIGRvZXMgbm90IGNvbnRhaW4gXCJwcm9wZXJ0eVwiOlwiY29sb3JcIlxuXHRcdFx0XHRcdHRoYXQuY2FjaGVDb2xvcnMoIGxvY2FsRGF0YSApO1xuXHRcdFx0XHR9XG5cblx0XHRcdH0pO1xuXG5cdFx0fSxcblxuXHRcdHNjYXR0ZXJEaXN0OiBmdW5jdGlvbigpIHtcblxuXHRcdFx0dmFyIHRoYXQgPSB0aGlzLFxuXHRcdFx0XHRtYXJnaW5zID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcIm1hcmdpbnNcIiApLFxuXHRcdFx0XHRudkRpc3RyWCA9ICQoIFwiLm52LWRpc3RyaWJ1dGlvblhcIiApLm9mZnNldCgpLnRvcCxcblx0XHRcdFx0c3ZnU2VsZWN0aW9uID0gZDMuc2VsZWN0KCBcInN2Z1wiICk7XG5cblx0XHRcdHRoYXQuY2hhcnQuc2NhdHRlci5kaXNwYXRjaC5vbignZWxlbWVudE1vdXNlb3Zlci50b29sdGlwJywgZnVuY3Rpb24oZXZ0KSB7XG5cdFx0XHRcdHZhciBzdmdPZmZzZXQgPSB0aGF0LiRzdmcub2Zmc2V0KCksXG5cdFx0XHRcdFx0c3ZnSGVpZ2h0ID0gdGhhdC4kc3ZnLmhlaWdodCgpO1xuXHRcdFx0XHRzdmdTZWxlY3Rpb24uc2VsZWN0KCcubnYtc2VyaWVzLScgKyBldnQuc2VyaWVzSW5kZXggKyAnIC5udi1kaXN0eC0nICsgZXZ0LnBvaW50SW5kZXgpXG5cdFx0XHRcdFx0LmF0dHIoJ3kxJywgZXZ0LnBvcy50b3AgLSBudkRpc3RyWCApO1xuXHRcdFx0XHRzdmdTZWxlY3Rpb24uc2VsZWN0KCcubnYtc2VyaWVzLScgKyBldnQuc2VyaWVzSW5kZXggKyAnIC5udi1kaXN0eS0nICsgZXZ0LnBvaW50SW5kZXgpXG5cdFx0XHRcdFx0LmF0dHIoJ3gyJywgZXZ0LnBvcy5sZWZ0IC0gc3ZnT2Zmc2V0LmxlZnQgLSBtYXJnaW5zLmxlZnQgKTtcblx0XHRcdFx0dmFyIHBvc2l0aW9uID0ge2xlZnQ6IGQzLmV2ZW50LmNsaWVudFgsIHRvcDogZDMuZXZlbnQuY2xpZW50WSB9O1xuXHRcdFx0XHR0aGF0LmNoYXJ0LnRvb2x0aXAucG9zaXRpb24ocG9zaXRpb24pLmRhdGEoZXZ0KS5oaWRkZW4oZmFsc2UpO1xuXHRcdFx0fSk7XG5cblx0XHR9LFxuXG5cdFx0c2NhdHRlckJ1YmJsZVNpemU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0Ly9zZXQgc2l6ZSBvZiB0aGUgYnViYmxlcyBkZXBlbmRpbmcgb24gYnJvd3NlciB3aWR0aFxuXHRcdFx0dmFyIGJyb3dzZXJXaWR0aCA9ICQoIHdpbmRvdyApLndpZHRoKCksXG5cdFx0XHRcdGJyb3dzZXJDb2VmID0gTWF0aC5tYXgoIDEsIGJyb3dzZXJXaWR0aCAvIDExMDAgKSxcblx0XHRcdFx0cG9pbnRNaW4gPSAxMDAgKiBNYXRoLnBvdyggYnJvd3NlckNvZWYsIDIgKSxcblx0XHRcdFx0cG9pbnRNYXggPSAxMDAwICogTWF0aC5wb3coIGJyb3dzZXJDb2VmLCAyICk7XG5cdFx0XHRyZXR1cm4gWyBwb2ludE1pbiwgcG9pbnRNYXggXTtcblx0XHR9LFxuXG5cdFx0Y2hlY2tTdGFja2VkQXhpczogZnVuY3Rpb24oKSB7XG5cblx0XHRcdC8vc2V0dGluZyB5QXhpc01heCBicmVha3MgZXhwYW5kZWQgc3RhY2tlZCBjaGFydCwgbmVlZCB0byBjaGVjayBtYW51YWxseVxuXHRcdFx0dmFyIHN0YWNrZWRTdHlsZSA9IHRoaXMuY2hhcnQuc3RhY2tlZC5zdHlsZSgpLFxuXHRcdFx0XHR5QXhpcyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJ5LWF4aXNcIiApLFxuXHRcdFx0XHR5QXhpc01pbiA9ICggeUF4aXNbIFwiYXhpcy1taW5cIiBdIHx8IDAgKSxcblx0XHRcdFx0eUF4aXNNYXggPSAoIHlBeGlzWyBcImF4aXMtbWF4XCIgXSB8fCBudWxsICksXG5cdFx0XHRcdHlEb21haW4gPSBbIHlBeGlzTWluLCB5QXhpc01heCBdO1xuXHRcdFx0aWYoIHlBeGlzTWF4ICkge1xuXHRcdFx0XHQvL2NoYXJ0IGhhcyBzZXQgeUF4aXMgdG8gbWF4LCBkZXBlbmRpbmcgb24gc3RhY2tlZCBzdHlsZSBzZXQgbWF4XG5cdFx0XHRcdGlmKCBzdGFja2VkU3R5bGUgPT09IFwiZXhwYW5kXCIgKSB7XG5cdFx0XHRcdFx0eURvbWFpbiA9IFsgMCwgMSBdO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuY2hhcnQueURvbWFpbiggeURvbWFpbiApO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0fSxcblxuXHRcdG9uUmVtb3ZlRW50aXR5OiBmdW5jdGlvbiggaWQgKSB7XG5cblx0XHRcdHZhciBzZWxlY3RlZENvdW50cmllcyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiApLFxuXHRcdFx0XHRjb3VudHJpZXNJZHMgPSBfLmtleXMoIHNlbGVjdGVkQ291bnRyaWVzICksXG5cdFx0XHRcdGFkZENvdW50cnlNb2RlID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImFkZC1jb3VudHJ5LW1vZGVcIiApO1xuXG5cdFx0XHRpZiggY291bnRyaWVzSWRzLmxlbmd0aCA9PT0gMCApIHtcblx0XHRcdFx0Ly9yZW1vdmluZyBmcm9tIGVtcHR5IHNlbGVjdGlvbiwgbmVlZCB0byBjb3B5IGFsbCBjb3VudHJpZXMgYXZhaWxhYmxlIGludG8gc2VsZWN0ZWQgY291bnRyaWVzIHNlbGVjdGlvblxuXHRcdFx0XHR2YXIgZW50aXRpZXNDb2xsZWN0aW9uID0gW10sXG5cdFx0XHRcdC8vdmFyIGVudGl0aWVzQ29sbGVjdGlvbiA9IHt9LFxuXHRcdFx0XHRcdGZvcm1Db25maWcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiZm9ybS1jb25maWdcIiApO1xuXHRcdFx0XHRpZiggZm9ybUNvbmZpZyAmJiBmb3JtQ29uZmlnWyBcImVudGl0aWVzLWNvbGxlY3Rpb25cIiBdICkge1xuXHRcdFx0XHRcdF8ubWFwKCBmb3JtQ29uZmlnWyBcImVudGl0aWVzLWNvbGxlY3Rpb25cIiBdLCBmdW5jdGlvbiggZCwgaSApIHsgZW50aXRpZXNDb2xsZWN0aW9uWyBkLmlkIF0gPSBkOyB9ICk7XG5cdFx0XHRcdFx0Ly9kZWVwIGNvcHkgYXJyYXlcblx0XHRcdFx0XHR2YXIgZW50aXRpZXNDb3B5ID0gICQuZXh0ZW5kKCB0cnVlLCBbXSwgZm9ybUNvbmZpZ1sgXCJlbnRpdGllcy1jb2xsZWN0aW9uXCIgXSApO1xuXHRcdFx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiwgZW50aXRpZXNDb3B5ICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdEFwcC5DaGFydE1vZGVsLnJlbW92ZVNlbGVjdGVkQ291bnRyeSggaWQgKTtcblxuXHRcdH0sXG5cblx0XHRvbkF2YWlsYWJsZUNvdW50cmllczogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dmFyICRzZWxlY3QgPSAkKCBldnQuY3VycmVudFRhcmdldCApLFxuXHRcdFx0XHR2YWwgPSAkc2VsZWN0LnZhbCgpLFxuXHRcdFx0XHQkb3B0aW9uID0gJHNlbGVjdC5maW5kKCBcIlt2YWx1ZT1cIiArIHZhbCArIFwiXVwiICksXG5cdFx0XHRcdHRleHQgPSAkb3B0aW9uLnRleHQoKTtcblxuXHRcdFx0aWYoICFBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiZ3JvdXAtYnktdmFyaWFibGVzXCIgKSAmJiBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiYWRkLWNvdW50cnktbW9kZVwiICkgPT09IFwiYWRkLWNvdW50cnlcIiApIHtcblx0XHRcdFx0QXBwLkNoYXJ0TW9kZWwuYWRkU2VsZWN0ZWRDb3VudHJ5KCB7IGlkOiAkc2VsZWN0LnZhbCgpLCBuYW1lOiB0ZXh0IH0gKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdEFwcC5DaGFydE1vZGVsLnJlcGxhY2VTZWxlY3RlZENvdW50cnkoIHsgaWQ6ICRzZWxlY3QudmFsKCksIG5hbWU6IHRleHQgfSApO1xuXHRcdFx0fVxuXG5cdFx0XHQvL2RvdWJsZSBjaGVjayBpZiB3ZSBkb24ndCBoYXZlIGZ1bGwgc2VsZWN0aW9uIG9mIGNvdW50cmllc1xuXHRcdFx0dmFyIGVudGl0aWVzQ29sbGVjdGlvbiA9IHt9LFxuXHRcdFx0XHRmb3JtQ29uZmlnID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImZvcm0tY29uZmlnXCIgKTtcblx0XHRcdGlmKCBmb3JtQ29uZmlnICYmIGZvcm1Db25maWdbIFwiZW50aXRpZXMtY29sbGVjdGlvblwiIF0gKSB7XG5cdFx0XHRcdHZhciBzZWxlY3RlZENvdW50cmllc0lkcyA9IF8ua2V5cyggQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcInNlbGVjdGVkLWNvdW50cmllc1wiICkgKTtcblx0XHRcdFx0aWYoIHNlbGVjdGVkQ291bnRyaWVzSWRzLmxlbmd0aCA9PSBmb3JtQ29uZmlnWyBcImVudGl0aWVzLWNvbGxlY3Rpb25cIiBdLmxlbmd0aCApIHtcblx0XHRcdFx0XHRBcHAuQ2hhcnRNb2RlbC5zZXQoIFwic2VsZWN0ZWQtY291bnRyaWVzXCIsIFtdLCB7c2lsZW50OnRydWV9ICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdH0sXG5cblx0XHRjYWNoZUNvbG9yczogZnVuY3Rpb24oIGRhdGEgKSB7XG5cdFx0XHRpZiggIXRoaXMuY2FjaGVkQ29sb3JzLmxlbmd0aCApIHtcblx0XHRcdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdFx0XHRfLmVhY2goIGRhdGEsIGZ1bmN0aW9uKCB2LCBpICkge1xuXHRcdFx0XHRcdHRoYXQuY2FjaGVkQ29sb3JzWyB2LmlkIF0gPSB2LmNvbG9yO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdGFzc2lnbkNvbG9yRnJvbUNhY2hlOiBmdW5jdGlvbiggdmFsdWUgKSB7XG5cdFx0XHRpZiggdGhpcy5jYWNoZWRDb2xvcnMubGVuZ3RoICkge1xuXHRcdFx0XHQvL2Fzc2luZyBjb2xvciBmcm9tZSBjYWNoZVxuXHRcdFx0XHRpZiggdGhpcy5jYWNoZWRDb2xvcnNbIHZhbHVlLmlkIF0gKSB7XG5cdFx0XHRcdFx0dmFsdWUuY29sb3IgPSB0aGlzLmNhY2hlZENvbG9yc1sgdmFsdWUuaWQgXTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR2YXIgcmFuZG9tQ29sb3IgPSBBcHAuVXRpbHMuZ2V0UmFuZG9tQ29sb3IoKTtcblx0XHRcdFx0XHR2YWx1ZS5jb2xvciA9IHJhbmRvbUNvbG9yO1xuXHRcdFx0XHRcdHRoaXMuY2FjaGVkQ29sb3JzWyB2YWx1ZS5pZCBdID0gcmFuZG9tQ29sb3I7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHR9XG5cdFx0XG5cdH0gKTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5DaGFydC5DaGFydFRhYjtcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdEFwcC5WaWV3cy5DaGFydC5EYXRhVGFiID0gQmFja2JvbmUuVmlldy5leHRlbmQoIHtcblxuXHRcdGVsOiBcIiNjaGFydC12aWV3XCIsXG5cdFx0ZXZlbnRzOiB7fSxcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0XG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIgPSBvcHRpb25zLmRpc3BhdGNoZXI7XG5cblx0XHRcdC8vZGF0YSB0YWJcblx0XHRcdHRoaXMuJGRhdGFUYWIgPSB0aGlzLiRlbC5maW5kKCBcIiNkYXRhLWNoYXJ0LXRhYlwiICk7XG5cdFx0XHR0aGlzLiRkb3dubG9hZEJ0biA9IHRoaXMuJGRhdGFUYWIuZmluZCggXCIuZG93bmxvYWQtZGF0YS1idG5cIiApO1xuXHRcdFx0dGhpcy4kZGF0YVRhYmxlV3JhcHBlciA9IHRoaXMuJGRhdGFUYWIuZmluZCggXCIuZGF0YS10YWJsZS13cmFwcGVyXCIgKTtcblxuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCBkYXRhLCBsb2NhbERhdGEsIGRpbWVuc2lvbnMgKSB7XG5cdFx0XHRcblx0XHRcdHRoaXMuJGRhdGFUYWJsZVdyYXBwZXIuZW1wdHkoKTtcblxuXHRcdFx0Ly91cGRhdGUgbGlua1xuXHRcdFx0dmFyIHRoYXQgPSB0aGlzLFxuXHRcdFx0XHRjaGFydFR5cGUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdHlwZVwiICksXG5cdFx0XHRcdGhhc011bHRpcGxlQ29sdW1ucyA9ICggQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImdyb3VwLWJ5LXZhcmlhYmxlc1wiICkgJiYgY2hhcnRUeXBlICE9PSBcIjNcIiApPyB0cnVlOiBmYWxzZTsvKixcblx0XHRcdFx0YmFzZVVybCA9IHRoaXMuJGRvd25sb2FkQnRuLmF0dHIoIFwiZGF0YS1iYXNlLXVybFwiICksXG5cdFx0XHRcdGRpbWVuc2lvbnNVcmwgPSBlbmNvZGVVUklDb21wb25lbnQoIGRpbWVuc2lvbnNTdHJpbmcgKTsqL1xuXHRcdFx0Ly90aGlzLiRkb3dubG9hZEJ0bi5hdHRyKCBcImhyZWZcIiwgYmFzZVVybCArIFwiP2RpbWVuc2lvbnM9XCIgKyBkaW1lbnNpb25zVXJsICsgXCImY2hhcnRUeXBlPVwiICsgY2hhcnRUeXBlICsgXCImZXhwb3J0PWNzdlwiICk7XG5cdFx0XHR0aGlzLiRkb3dubG9hZEJ0bi5vbiggXCJjbGlja1wiLCBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXG5cdFx0XHRcdHZhciBkYXRhID0gW10sXG5cdFx0XHRcdFx0JHRycyA9IHRoYXQuJGVsLmZpbmQoIFwidHJcIiApO1xuXHRcdFx0XHQkLmVhY2goICR0cnMsIGZ1bmN0aW9uKCBpLCB2ICkge1xuXG5cdFx0XHRcdFx0dmFyIHRyRGF0YSA9IFtdLFxuXHRcdFx0XHRcdFx0JHRyID0gJCggdGhpcyApLFxuXHRcdFx0XHRcdFx0JGNlbGxzID0gJHRyLmZpbmQoIFwidGgsIHRkXCIgKTtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHQkLmVhY2goICRjZWxscywgZnVuY3Rpb24oIGkyLCB2MiApIHtcblx0XHRcdFx0XHRcdHRyRGF0YS5wdXNoKCAkKCB2MiApLnRleHQoKSApO1xuXHRcdFx0XHRcdH0gKTtcblxuXHRcdFx0XHRcdGRhdGEucHVzaCggdHJEYXRhICk7XG5cblx0XHRcdFx0fSApO1xuXG5cdFx0XHRcdHZhciBjc3ZTdHJpbmcgPSBcImRhdGE6dGV4dC9jc3Y7Y2hhcnNldD11dGYtOCxcIjtcblx0XHRcdFx0Xy5lYWNoKCBkYXRhLCBmdW5jdGlvbiggdiwgaSApIHtcblx0XHRcdFx0XHR2YXIgZGF0YVN0cmluZyA9IHYuam9pbihcIixcIik7XG5cdFx0XHRcdFx0Y3N2U3RyaW5nICs9ICggaSA8IGRhdGEubGVuZ3RoICk/IGRhdGFTdHJpbmcrIFwiXFxuXCIgOiBkYXRhU3RyaW5nO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdFxuXHRcdFx0XHR2YXIgZW5jb2RlZFVyaSA9IGVuY29kZVVSSSggY3N2U3RyaW5nICk7XG5cdFx0XHRcdHdpbmRvdy5vcGVuKCBlbmNvZGVkVXJpICk7XG5cblx0XHRcdH0gKTtcblxuXHRcdFx0Ly9nZXQgYWxsIHRpbWVzXG5cdFx0XHR2YXIgdGltZXNPYmogPSBbXSxcblx0XHRcdFx0dGltZXMgPSBbXTtcblx0XHRcdF8uZWFjaCggZGF0YSwgZnVuY3Rpb24oIGVudGl0eURhdGEsIGVudGl0eUlkICkge1xuXG5cdFx0XHRcdHZhciB2YWx1ZXMgPSBlbnRpdHlEYXRhLnZhbHVlcyxcblx0XHRcdFx0XHR2YWx1ZXNCeVRpbWUgPSBbXTtcblxuXHRcdFx0XHRfLmVhY2goIHZhbHVlcywgZnVuY3Rpb24oIHZhbHVlICkge1xuXG5cdFx0XHRcdFx0Ly9zdG9yZSBnaXZlbiB0aW1lIGFzIGV4aXN0aW5nXG5cdFx0XHRcdFx0dmFyIHRpbWUgPSB2YWx1ZS50aW1lO1xuXHRcdFx0XHRcdGlmKCAhdGltZXNPYmpbIHRpbWUgXSApIHtcblx0XHRcdFx0XHRcdHRpbWVzT2JqWyB0aW1lIF0gPSB0cnVlO1xuXHRcdFx0XHRcdFx0dGltZXMucHVzaCggdGltZSApO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vcmUtbWFwIHZhbHVlcyBieSB0aW1lIGtleVxuXHRcdFx0XHRcdHZhbHVlc0J5VGltZVsgdGltZSBdID0gdmFsdWU7XG5cblx0XHRcdFx0fSApO1xuXG5cdFx0XHRcdGVudGl0eURhdGEudmFsdWVzQnlUaW1lID0gdmFsdWVzQnlUaW1lO1xuXG5cdFx0XHR9ICk7XG5cblx0XHRcdC8vc29ydCBnYXRoZXJlZCB0aW1lc1xuXHRcdFx0dGltZXMgPSBfLnNvcnRCeSggdGltZXMsIGZ1bmN0aW9uKCB2ICkgeyByZXR1cm4gK3Y7IH0gKTtcblx0XHRcdFxuXHRcdFx0Ly9jcmVhdGUgZmlyc3Qgcm93XG5cdFx0XHR2YXIgdGFibGVTdHJpbmcgPSBcIjx0YWJsZSBjbGFzcz0nZGF0YS10YWJsZSc+XCIsXG5cdFx0XHRcdHRyID0gXCI8dHI+PHRkPjxzdHJvbmc+IDwvc3Ryb25nPjwvdGQ+XCI7XG5cdFx0XHRfLmVhY2goIHRpbWVzLCBmdW5jdGlvbiggdGltZSApIHtcblxuXHRcdFx0XHQvL2NyZWF0ZSBjb2x1bW4gZm9yIGV2ZXJ5IGRpbWVuc2lvblxuXHRcdFx0XHRfLmVhY2goIGRpbWVuc2lvbnMsIGZ1bmN0aW9uKCBkaW1lbnNpb24sIGkgKSB7XG5cdFx0XHRcdFx0aWYoIGkgPT09IDAgfHwgaGFzTXVsdGlwbGVDb2x1bW5zICkge1xuXHRcdFx0XHRcdFx0dmFyIHRoID0gXCI8dGg+XCI7XG5cdFx0XHRcdFx0XHR0aCArPSB0aW1lO1xuXHRcdFx0XHRcdFx0aWYoIGRpbWVuc2lvbnMubGVuZ3RoID4gMSAmJiBoYXNNdWx0aXBsZUNvbHVtbnMgKSB7XG5cdFx0XHRcdFx0XHRcdC8vd2UgaGF2ZSBtb3JlIHRoYW4gb25lIGRpbWVuc2lvbiwgbmVlZCB0byBkaXN0aW5ndWlzaCB0aGVtIGluIFxuXHRcdFx0XHRcdFx0XHR0aCArPSBcIiAtIFwiICsgZGltZW5zaW9uLnZhcmlhYmxlTmFtZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHRoICs9IFwiPC90aD5cIjtcblx0XHRcdFx0XHRcdHRyICs9IHRoO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cblx0XHRcdH0gKTtcblx0XHRcdHRyICs9IFwiPC90cj5cIjtcblx0XHRcdHRhYmxlU3RyaW5nICs9IHRyO1xuXG5cdFx0XHRfLmVhY2goIGRhdGEsIGZ1bmN0aW9uKCBlbnRpdHlEYXRhLCBlbnRpdHlJZCApIHtcblxuXHRcdFx0XHR2YXIgdHIgPSBcIjx0cj5cIixcblx0XHRcdFx0XHQvL2FkZCBuYW1lIG9mIGVudGl0eVxuXHRcdFx0XHRcdHRkID0gXCI8dGQ+PHN0cm9uZz5cIiArIGVudGl0eURhdGEua2V5ICsgXCI8L3N0cm9uZz48L3RkPlwiO1xuXHRcdFx0XHR0ciArPSB0ZDtcblxuXHRcdFx0XHR2YXIgdmFsdWVzQnlUaW1lID0gZW50aXR5RGF0YS52YWx1ZXNCeVRpbWU7XG5cdFx0XHRcdF8uZWFjaCggdGltZXMsIGZ1bmN0aW9uKCB0aW1lICkge1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdC8vY3JlYXRlIGNvbHVtbiBmb3IgZXZlcnkgZGltZW5zaW9uXG5cdFx0XHRcdFx0Xy5lYWNoKCBkaW1lbnNpb25zLCBmdW5jdGlvbiggZGltZW5zaW9uLCBpICkge1xuXHRcdFx0XHRcdFx0aWYoIGkgPT09IDAgfHwgaGFzTXVsdGlwbGVDb2x1bW5zICkge1xuXHRcdFx0XHRcdFx0XHR2YXIgdGQgPSBcIjx0ZD5cIixcblx0XHRcdFx0XHRcdFx0XHR0ZFZhbHVlID0gXCJcIjtcblx0XHRcdFx0XHRcdFx0Ly9pcyB0aGVyZSB2YWx1ZSBmb3IgZ2l2ZW4gdGltZVxuXHRcdFx0XHRcdFx0XHRpZiggdmFsdWVzQnlUaW1lWyB0aW1lIF0gKSB7XG5cdFx0XHRcdFx0XHRcdFx0aWYoICF2YWx1ZXNCeVRpbWVbIHRpbWUgXS5mYWtlICkge1xuXHRcdFx0XHRcdFx0XHRcdFx0dGRWYWx1ZSA9IHZhbHVlc0J5VGltZVsgdGltZSBdWyBkaW1lbnNpb24ucHJvcGVydHkgXTtcblx0XHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdFx0Ly9qdXN0IGR1bW15IHZhbHVlcyBmb3IgY29ycmVjdCByZW5kZXJpbmcgb2YgY2hhcnQsIGRvbid0IGFkZCBpbnRvIHRhYmxlXG5cdFx0XHRcdFx0XHRcdFx0XHR0ZFZhbHVlID0gXCJcIjtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0dGQgKz0gdGRWYWx1ZTtcblx0XHRcdFx0XHRcdFx0dGQgKz0gXCI8L3RkPlwiO1xuXHRcdFx0XHRcdFx0XHR0ciArPSB0ZDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFxuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdFxuXHRcdFx0XHR0ciArPSBcIjwvdHI+XCI7XG5cdFx0XHRcdHRhYmxlU3RyaW5nICs9IHRyO1xuXG5cdFx0XHR9ICk7XG5cblx0XHRcdHRhYmxlU3RyaW5nICs9IFwiPC90YWJsZT5cIjtcblxuXHRcdFx0dmFyICR0YWJsZSA9ICQoIHRhYmxlU3RyaW5nICk7XG5cdFx0XHR0aGlzLiRkYXRhVGFibGVXcmFwcGVyLmFwcGVuZCggJHRhYmxlICk7XG5cblxuXHRcdH1cblxuXHR9ICk7XG5cdFxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5DaGFydC5EYXRhVGFiO1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0QXBwLlZpZXdzLkNoYXJ0LkhlYWRlciA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblxuXHRcdGVsOiBcIiNjaGFydC12aWV3IC5jaGFydC1oZWFkZXJcIixcblx0XHRldmVudHM6IHt9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHRcblx0XHRcdHRoaXMuZGlzcGF0Y2hlciA9IG9wdGlvbnMuZGlzcGF0Y2hlcjtcblx0XHRcdFxuXHRcdFx0dGhpcy4kdGFicyA9IHRoaXMuJGVsLmZpbmQoIFwiLmhlYWRlci10YWJcIiApO1xuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblxuXHRcdFx0Ly9zZXR1cCBldmVudHNcblx0XHRcdEFwcC5DaGFydE1vZGVsLm9uKCBcImNoYW5nZVwiLCB0aGlzLnJlbmRlciwgdGhpcyApO1xuXG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcblx0XHRcdHZhciB0YWJzID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcInRhYnNcIiApO1xuXHRcdFx0XG5cdFx0XHQvL2hpZGUgZmlyc3QgZXZlcnl0aGluZ1xuXHRcdFx0dGhpcy4kdGFicy5oaWRlKCk7XG5cblx0XHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRcdF8uZWFjaCggdGFicywgZnVuY3Rpb24oIHYsIGkgKSB7XG5cdFx0XHRcdHZhciB0YWIgPSB0aGF0LiR0YWJzLmZpbHRlciggXCIuXCIgKyB2ICsgXCItaGVhZGVyLXRhYlwiICk7XG5cdFx0XHRcdHRhYi5zaG93KCk7XG5cdFx0XHRcdGlmKCBpID09PSAwICkge1xuXHRcdFx0XHRcdHRhYi5hZGRDbGFzcyggXCJhY3RpdmVcIiApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cblx0XHR9XG5cblx0fSk7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVmlld3MuQ2hhcnQuSGVhZGVyO1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cdFxuXHRBcHAuVmlld3MuQ2hhcnQuTGVnZW5kID0gZnVuY3Rpb24oIGNoYXJ0TGVnZW5kICkge1xuXHRcblx0XHQvL2Jhc2VkIG9uIGh0dHBzOi8vZ2l0aHViLmNvbS9ub3Z1cy9udmQzL2Jsb2IvbWFzdGVyL3NyYy9tb2RlbHMvbGVnZW5kLmpzXG5cblx0XHQvLz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXHRcdC8vIFB1YmxpYyBWYXJpYWJsZXMgd2l0aCBEZWZhdWx0IFNldHRpbmdzXG5cdFx0Ly8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuXHRcdHZhciBjaGFydFR5cGUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdHlwZVwiIClcblx0XHRcdCwgbWFyZ2luID0ge3RvcDogNSwgcmlnaHQ6IDUwLCBib3R0b206IDUsIGxlZnQ6IDYyfVxuXHRcdFx0LCB3aWR0aCA9IDgwMFxuXHRcdFx0LCBoZWlnaHQgPSAyMFxuXHRcdFx0LCBnZXRLZXkgPSBmdW5jdGlvbihkKSB7IHJldHVybiBkLmtleSB9XG5cdFx0XHQsIGNvbG9yID0gbnYudXRpbHMuZ2V0Q29sb3IoKVxuXHRcdFx0LCBhbGlnbiA9IHRydWVcblx0XHRcdCwgcGFkZGluZyA9IDQwIC8vZGVmaW5lIGhvdyBtdWNoIHNwYWNlIGJldHdlZW4gbGVnZW5kIGl0ZW1zLiAtIHJlY29tbWVuZCAzMiBmb3IgZnVyaW91cyB2ZXJzaW9uXG5cdFx0XHQsIHJpZ2h0QWxpZ24gPSBmYWxzZVxuXHRcdFx0LCB1cGRhdGVTdGF0ZSA9IHRydWUgICAvL0lmIHRydWUsIGxlZ2VuZCB3aWxsIHVwZGF0ZSBkYXRhLmRpc2FibGVkIGFuZCB0cmlnZ2VyIGEgJ3N0YXRlQ2hhbmdlJyBkaXNwYXRjaC5cblx0XHRcdCwgcmFkaW9CdXR0b25Nb2RlID0gZmFsc2UgICAvL0lmIHRydWUsIGNsaWNraW5nIGxlZ2VuZCBpdGVtcyB3aWxsIGNhdXNlIGl0IHRvIGJlaGF2ZSBsaWtlIGEgcmFkaW8gYnV0dG9uLiAob25seSBvbmUgY2FuIGJlIHNlbGVjdGVkIGF0IGEgdGltZSlcblx0XHRcdCwgZXhwYW5kZWQgPSBmYWxzZVxuXHRcdFx0LCBkaXNwYXRjaCA9IGQzLmRpc3BhdGNoKCdsZWdlbmRDbGljaycsICdsZWdlbmREYmxjbGljaycsICdsZWdlbmRNb3VzZW92ZXInLCAnbGVnZW5kTW91c2VvdXQnLCAnc3RhdGVDaGFuZ2UnLCAncmVtb3ZlRW50aXR5JywgJ2FkZEVudGl0eScpXG5cdFx0XHQsIHZlcnMgPSAnY2xhc3NpYycgLy9PcHRpb25zIGFyZSBcImNsYXNzaWNcIiBhbmQgXCJmdXJpb3VzXCIgYW5kIFwib3dkXCJcblx0XHRcdDtcblxuXHRcdGZ1bmN0aW9uIGNoYXJ0KHNlbGVjdGlvbikge1xuXHRcdFx0XG5cdFx0XHRzZWxlY3Rpb24uZWFjaChmdW5jdGlvbihkYXRhKSB7XG5cdFx0XHRcdFxuXHRcdFx0XHR2YXIgJHN2ZyA9ICQoIFwic3ZnLm52ZDMtc3ZnXCIgKSxcblx0XHRcdFx0XHRhdmFpbGFibGVXaWR0aCA9ICRzdmcud2lkdGgoKSAtIG1hcmdpbi5sZWZ0IC0gbWFyZ2luLnJpZ2h0LFxuXHRcdFx0XHRcdGNvbnRhaW5lciA9IGQzLnNlbGVjdCh0aGlzKTtcblx0XHRcdFx0XG5cdFx0XHRcdG52LnV0aWxzLmluaXRTVkcoY29udGFpbmVyKTtcblxuXHRcdFx0XHR2YXIgYmluZGFibGVEYXRhID0gZGF0YTtcblxuXHRcdFx0XHQvL2Rpc2NyZXRlIGJhciBjaGFydCBuZWVkcyB1bnBhY2sgZGF0YVxuXHRcdFx0XHRpZiggY2hhcnRUeXBlID09PSBcIjZcIiApIHtcblx0XHRcdFx0XHRpZiggZGF0YSAmJiBkYXRhLmxlbmd0aCAmJiBkYXRhWzBdLnZhbHVlcyApIHtcblx0XHRcdFx0XHRcdHZhciBkaXNjcmV0ZURhdGEgPSBfLm1hcCggZGF0YVswXS52YWx1ZXMsIGZ1bmN0aW9uKCB2LCBpICkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4geyBpZDogdi5pZCwga2V5OiB2LngsIGNvbG9yOiB2LmNvbG9yLCB2YWx1ZXM6IHYgfTtcblx0XHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHRcdGJpbmRhYmxlRGF0YSA9IGRpc2NyZXRlRGF0YTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdC8vIFNldHVwIGNvbnRhaW5lcnMgYW5kIHNrZWxldG9uIG9mIGNoYXJ0XG5cdFx0XHRcdHZhciB3cmFwID0gY29udGFpbmVyLnNlbGVjdEFsbCgnZy5udi1jdXN0b20tbGVnZW5kJykuZGF0YShbYmluZGFibGVEYXRhXSksXG5cdFx0XHRcdC8vdmFyIHdyYXAgPSBjb250YWluZXIuc2VsZWN0QWxsKCdnLm52LWN1c3RvbS1sZWdlbmQnKS5kYXRhKFtkYXRhXSksXG5cdFx0XHRcdFx0Z0VudGVyID0gd3JhcC5lbnRlcigpLmFwcGVuZCgnZycpLmF0dHIoJ2NsYXNzJywgJ252ZDMgbnYtY3VzdG9tLWxlZ2VuZCcpLmFwcGVuZCgnZycpLmF0dHIoICdjbGFzcycsICdudi1sZWdlbmQtc2VyaWVzLXdyYXBwZXInICksXG5cdFx0XHRcdFx0ZyA9IHdyYXAuc2VsZWN0KCdnJyk7XG5cblx0XHRcdFx0d3JhcC5hdHRyKCd0cmFuc2Zvcm0nLCAndHJhbnNsYXRlKCcgKyBtYXJnaW4ubGVmdCArICcsJyArIG1hcmdpbi50b3AgKyAnKScpO1xuXG5cdFx0XHRcdHZhciBzZXJpZXMgPSBnLnNlbGVjdEFsbCgnLm52LXNlcmllcycpXG5cdFx0XHRcdFx0LmRhdGEoZnVuY3Rpb24oZCkge1xuXHRcdFx0XHRcdFx0aWYodmVycyAhPSAnZnVyaW91cycpIHJldHVybiBkO1xuXHRcdFx0XHRcdFx0cmV0dXJuIGQuZmlsdGVyKGZ1bmN0aW9uKG4pIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGV4cGFuZGVkID8gdHJ1ZSA6ICFuLmRpc2VuZ2FnZWQ7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XG5cdFx0XHRcdC8vYWRkIGVudGl0eSBsYWJlbFxuXHRcdFx0XHR2YXIgZW50aXR5TGFiZWwgPSB3cmFwLnNlbGVjdCggJy5udi1lbnRpdHktbGFiZWwnICksXG5cdFx0XHRcdFx0ZW50aXR5TGFiZWxUZXh0ID0gZW50aXR5TGFiZWwuc2VsZWN0KCAndGV4dCcgKSxcblx0XHRcdFx0XHRlbnRpdHlMYWJlbFdpZHRoID0gMDtcblx0XHRcdFx0Ly9kaXNwbGF5aW5nIG9mIGVudGl0eSBsYWJlbCBpcyBkaXNhYmxlZFxuXHRcdFx0XHQvKmlmKCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiYWRkLWNvdW50cnktbW9kZVwiICkgPT09IFwiY2hhbmdlLWNvdW50cnlcIiApIHtcblx0XHRcdFx0XHRpZiggZW50aXR5TGFiZWwuZW1wdHkoKSApIHtcblx0XHRcdFx0XHRcdGVudGl0eUxhYmVsID0gd3JhcC5hcHBlbmQoICdnJyApLmF0dHIoJ2NsYXNzJywgJ252LWVudGl0eS1sYWJlbCcpLmF0dHIoICd0cmFuc2Zvcm0nLCAndHJhbnNsYXRlKDAsMTUpJyApO1xuXHRcdFx0XHRcdFx0ZW50aXR5TGFiZWxUZXh0ID0gZW50aXR5TGFiZWwuYXBwZW5kKCAndGV4dCcgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYoIGRhdGEgJiYgZGF0YVswXSAmJiBkYXRhWzBdLmVudGl0eSApIHtcblx0XHRcdFx0XHRcdGVudGl0eUxhYmVsVGV4dC50ZXh0KCBkYXRhWzBdLmVudGl0eSArIFwiOiBcIiApO1xuXHRcdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdFx0ZW50aXR5TGFiZWxXaWR0aCA9IGVudGl0eUxhYmVsVGV4dC5ub2RlKCkuZ2V0Q29tcHV0ZWRUZXh0TGVuZ3RoKCk7XG5cdFx0XHRcdFx0XHRcdC8vIElmIHRoZSBsZWdlbmRUZXh0IGlzIGRpc3BsYXk6bm9uZSdkIChub2RlVGV4dExlbmd0aCA9PSAwKSwgc2ltdWxhdGUgYW4gZXJyb3Igc28gd2UgYXBwcm94aW1hdGUsIGluc3RlYWRcblx0XHRcdFx0XHRcdFx0aWYoIGVudGl0eUxhYmVsV2lkdGggPD0gMCApIHRocm93IG5ldyBFcnJvcigpO1xuXHRcdFx0XHRcdFx0fSBjYXRjaCggZSApIHtcblx0XHRcdFx0XHRcdFx0ZW50aXR5TGFiZWxXaWR0aCA9IG52LnV0aWxzLmNhbGNBcHByb3hUZXh0V2lkdGgoZW50aXR5TGFiZWxUZXh0KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdC8vYWRkIHBhZGRpbmcgZm9yIGxhYmVsXG5cdFx0XHRcdFx0XHRlbnRpdHlMYWJlbFdpZHRoICs9IDMwO1xuXHRcdFx0XHRcdFx0YXZhaWxhYmxlV2lkdGggLT0gZW50aXR5TGFiZWxXaWR0aDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly9tYWtlIHN1cmUgdGhlcmUgaXMgbm90IGxhYmVsIGxlZnRcblx0XHRcdFx0XHRlbnRpdHlMYWJlbC5yZW1vdmUoKTtcblx0XHRcdFx0fSovXG5cdFx0XHRcdFxuXHRcdFx0XHQvL2lmIG5vdCBleGlzdGluZywgYWRkIG52LWFkZC1idG4sIGlmIG5vdCBncm91cGluZyBieSB2YXJpYWJsZXNcblx0XHRcdFx0dmFyIGFkZEVudGl0eUJ0biA9ICB3cmFwLnNlbGVjdCggJ2cubnYtYWRkLWJ0bicgKTtcblx0XHRcdFx0aWYoIGFkZEVudGl0eUJ0bi5lbXB0eSgpICkge1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0biA9IHdyYXAuYXBwZW5kKCdnJykuYXR0cignY2xhc3MnLCAnbnYtYWRkLWJ0bicpO1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5hcHBlbmQoJ3JlY3QnKS5hdHRyKCB7ICdjbGFzcyc6ICdhZGQtYnRuLWJnJywgJ3dpZHRoJzogJzEwMCcsICdoZWlnaHQnOiAnMjUnLCAndHJhbnNmb3JtJzogJ3RyYW5zbGF0ZSgwLC01KScgfSApO1xuXHRcdFx0XHRcdHZhciBhZGRFbnRpdHlCdG5HID0gYWRkRW50aXR5QnRuLmFwcGVuZCgnZycpLmF0dHIoIHsgJ2NsYXNzJzogJ2FkZC1idG4tcGF0aCcgfSApO1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bkcuYXBwZW5kKCdwYXRoJykuYXR0ciggeyAnZCc6ICdNMTUsMCBMMTUsMTQnLCAnY2xhc3MnOiAnbnYtYm94JyB9ICk7XG5cdFx0XHRcdFx0YWRkRW50aXR5QnRuRy5hcHBlbmQoJ3BhdGgnKS5hdHRyKCB7ICdkJzogJ004LDcgTDIyLDcnLCAnY2xhc3MnOiAnbnYtYm94JyB9ICk7XG5cdFx0XHRcdFx0Ly9odHRwOi8vYW5kcm9pZC11aS11dGlscy5nb29nbGVjb2RlLmNvbS9oZy1oaXN0b3J5L2FjOTU1ZTYzNzY0NzBkOTU5OWVhZDA3YjQ1OTllZjkzNzgyNGY5MTkvYXNzZXQtc3R1ZGlvL2Rpc3QvcmVzL2NsaXBhcnQvaWNvbnMvcmVmcmVzaC5zdmc/cj1hYzk1NWU2Mzc2NDcwZDk1OTllYWQwN2I0NTk5ZWY5Mzc4MjRmOTE5XG5cdFx0XHRcdFx0YWRkRW50aXR5QnRuLmFwcGVuZCgncGF0aCcpLmF0dHIoIHsgJ2QnOiAnTTE2MC40NjksMjQyLjE5NGMwLTQ0LjQxNCwzNi4wMjMtODAuNDM4LDgwLjQzOC04MC40MzhjMTkuMTg4LDAsMzYuNzExLDYuODQ0LDUwLjUsMTguMDc4TDI1OS43OCwyMDkuOTNsOTkuOTQ1LDExLjM2NyAgICBsMC44MDUtMTA3LjI0MmwtMzAuNzY2LDI5LjI4OWMtMjMuNTQ2LTIxLjIwMy01NC42MjQtMzQuMTY0LTg4LjgwNC0zNC4xNjRjLTczLjQ2OSwwLTEzMy4wMjMsNTkuNTYyLTEzMy4wMjMsMTMzLjAxNiAgICBjMCwyLjc0MiwwLjI0Mi0yLjI2NiwwLjQxNCwwLjQ0NWw1My42OCw3LjU1NUMxNjEuMDMsMjQ1LjEwOCwxNjAuNDY5LDI0Ny41NjIsMTYwLjQ2OSwyNDIuMTk0eiBNMzcxLjY0NywyMzcuMzc1bC01My42ODEtNy41NTUgICAgYzEuMDE3LDUuMDg2LDEuNTU2LDIuNjE3LDEuNTU2LDcuOTkyYzAsNDQuNDE0LTM2LjAwOCw4MC40MzEtODAuNDMsODAuNDMxYy0xOS4xMzMsMC0zNi42MDItNi43OTgtNTAuMzgzLTE3Ljk3bDMxLjU5NS0zMC4wNzggICAgbC05OS45My0xMS4zNjZsLTAuODEyLDEwNy4yNWwzMC43ODktMjkuMzEyYzIzLjUzMSwyMS4xNDEsNTQuNTcsMzQuMDU1LDg4LjY4OCwzNC4wNTVjNzMuNDY4LDAsMTMzLjAyMy01OS41NTUsMTMzLjAyMy0xMzMuMDA4ICAgIEMzNzIuMDYyLDIzNS4wNzgsMzcxLjgxMiwyNDAuMDg1LDM3MS42NDcsMjM3LjM3NXonLCAnY2xhc3MnOiAnbnYtYm94IGNoYW5nZS1idG4tcGF0aCcsICd0cmFuc2Zvcm0nOiAnc2NhbGUoLjA0KSB0cmFuc2xhdGUoMTUwLC01MCknIH0gKTtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4uYXBwZW5kKCd0ZXh0JykuYXR0ciggeyd4JzoyOCwneSc6MTF9ICkudGV4dCgnQWRkIGNvdW50cnknKTtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4ub24oICdjbGljaycsIGZ1bmN0aW9uKCBkLCBpICkge1xuXHRcdFx0XHRcdFx0Ly9ncm91cCBieSB2YXJpYWJsZXNcblx0XHRcdFx0XHRcdGRpc3BhdGNoLmFkZEVudGl0eSgpO1xuXHRcdFx0XHRcdFx0ZDMuZXZlbnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdC8vYmFzZWQgb24gc2VsZWN0ZWQgY291bnRyaWVzIHNlbGVjdGlvbiBoaWRlIG9yIHNob3cgYWRkRW50aXR5QnRuXG5cdFx0XHRcdGlmKCBfLmlzRW1wdHkoIEFwcC5DaGFydE1vZGVsLmdldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiApICkgKSB7XG5cdFx0XHRcdFx0YWRkRW50aXR5QnRuLmF0dHIoIFwiZGlzcGxheVwiLCBcIm5vbmVcIiApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5hdHRyKCBcImRpc3BsYXlcIiwgXCJibG9ja1wiICk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR2YXIgYWRkQ291bnRyeU1vZGUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiYWRkLWNvdW50cnktbW9kZVwiICk7XG5cdFx0XHRcdGlmKCBhZGRDb3VudHJ5TW9kZSA9PT0gXCJhZGQtY291bnRyeVwiICkge1xuXHRcdFx0XHQvL2lmKCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiZ3JvdXAtYnktdmFyaWFibGVzXCIgKSApIHtcblx0XHRcdFx0XHQvL2lmIGdyb3VwaW5nIGJ5IHZhcmlhYmxlLCBsZWdlbmQgd2lsbCBzaG93IHZhcmlhYmxlcyBpbnN0ZWFkIG9mIGNvdW50cmllcywgc28gYWRkIGNvdW50cnkgYnRuIGRvZXNuJ3QgbWFrZSBzZW5zZVxuXHRcdFx0XHRcdC8vaWYgZW5hYmxpbmcgYWRkaW5nIGNvdW50cmllc1xuXHRcdFx0XHRcdC8vYWRkRW50aXR5QnRuLmF0dHIoIFwiZGlzcGxheVwiLCBcIm5vbmVcIiApO1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5zZWxlY3QoIFwidGV4dFwiICkudGV4dCggXCJBZGQgY291bnRyeVwiICk7XG5cdFx0XHRcdFx0YWRkRW50aXR5QnRuLnNlbGVjdCggXCJyZWN0XCIgKS5hdHRyKCBcIndpZHRoXCIsIFwiMTAwXCIgKTtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4uc2VsZWN0KCBcIi5hZGQtYnRuLXBhdGhcIiApLmF0dHIoIFwiZGlzcGxheVwiLCBcImJsb2NrXCIgKTtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4uc2VsZWN0KCBcIi5jaGFuZ2UtYnRuLXBhdGhcIiApLmF0dHIoIFwiZGlzcGxheVwiLCBcIm5vbmVcIiApO1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5hdHRyKCBcImRpc3BsYXlcIiwgXCJibG9ja1wiICk7XG5cdFx0XHRcdH0gZWxzZSBpZiggYWRkQ291bnRyeU1vZGUgPT09IFwiY2hhbmdlLWNvdW50cnlcIiApIHtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4uc2VsZWN0KCBcIi5hZGQtYnRuLXBhdGhcIiApLmF0dHIoIFwiZGlzcGxheVwiLCBcIm5vbmVcIiApO1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5zZWxlY3QoIFwiLmNoYW5nZS1idG4tcGF0aFwiICkuYXR0ciggXCJkaXNwbGF5XCIsIFwiYmxvY2tcIiApO1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5zZWxlY3QoIFwidGV4dFwiICkudGV4dCggXCJDaGFuZ2UgY291bnRyeVwiICk7XG5cdFx0XHRcdFx0YWRkRW50aXR5QnRuLnNlbGVjdCggXCJyZWN0XCIgKS5hdHRyKCBcIndpZHRoXCIsIFwiMTIwXCIgKTtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4uYXR0ciggXCJkaXNwbGF5XCIsIFwiYmxvY2tcIiApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5hdHRyKCBcImRpc3BsYXlcIiwgXCJub25lXCIgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRcdFxuXHRcdFx0XHR2YXIgc2VyaWVzRW50ZXIgPSBzZXJpZXMuZW50ZXIoKS5hcHBlbmQoJ2cnKS5hdHRyKCdjbGFzcycsICdudi1zZXJpZXMnKSxcblx0XHRcdFx0XHRzZXJpZXNTaGFwZSwgc2VyaWVzUmVtb3ZlO1xuXG5cdFx0XHRcdHZhciB2ZXJzUGFkZGluZyA9IDMwO1xuXHRcdFx0XHRzZXJpZXNFbnRlci5hcHBlbmQoJ3JlY3QnKVxuXHRcdFx0XHRcdC5zdHlsZSgnc3Ryb2tlLXdpZHRoJywgMilcblx0XHRcdFx0XHQuYXR0cignY2xhc3MnLCdudi1sZWdlbmQtc3ltYm9sJyk7XG5cblx0XHRcdFx0Ly9lbmFibGUgcmVtb3ZpbmcgY291bnRyaWVzIG9ubHkgaWYgQWRkL1JlcGxhY2UgY291bnRyeSBidXR0b24gcHJlc2VudFxuXHRcdFx0XHRpZiggYWRkQ291bnRyeU1vZGUgPT0gXCJhZGQtY291bnRyeVwiICYmICFBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiZ3JvdXAtYnktdmFyaWFibGVzXCIgKSApIHtcblx0XHRcdFx0XHR2YXIgcmVtb3ZlQnRucyA9IHNlcmllc0VudGVyLmFwcGVuZCgnZycpXG5cdFx0XHRcdFx0XHQuYXR0cignY2xhc3MnLCAnbnYtcmVtb3ZlLWJ0bicpXG5cdFx0XHRcdFx0XHQuYXR0cigndHJhbnNmb3JtJywgJ3RyYW5zbGF0ZSgxMCwxMCknKTtcblx0XHRcdFx0XHRyZW1vdmVCdG5zLmFwcGVuZCgncGF0aCcpLmF0dHIoIHsgJ2QnOiAnTTAsMCBMNyw3JywgJ2NsYXNzJzogJ252LWJveCcgfSApO1xuXHRcdFx0XHRcdHJlbW92ZUJ0bnMuYXBwZW5kKCdwYXRoJykuYXR0ciggeyAnZCc6ICdNNywwIEwwLDcnLCAnY2xhc3MnOiAnbnYtYm94JyB9ICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdHNlcmllc1NoYXBlID0gc2VyaWVzLnNlbGVjdCgnLm52LWxlZ2VuZC1zeW1ib2wnKTtcblx0XHRcdFx0XG5cdFx0XHRcdHNlcmllc0VudGVyLmFwcGVuZCgndGV4dCcpXG5cdFx0XHRcdFx0LmF0dHIoJ3RleHQtYW5jaG9yJywgJ3N0YXJ0Jylcblx0XHRcdFx0XHQuYXR0cignY2xhc3MnLCdudi1sZWdlbmQtdGV4dCcpXG5cdFx0XHRcdFx0LmF0dHIoJ2R5JywgJy4zMmVtJylcblx0XHRcdFx0XHQuYXR0cignZHgnLCAnMCcpO1xuXG5cdFx0XHRcdHZhciBzZXJpZXNUZXh0ID0gc2VyaWVzLnNlbGVjdCgndGV4dC5udi1sZWdlbmQtdGV4dCcpLFxuXHRcdFx0XHRcdHNlcmllc1JlbW92ZSA9IHNlcmllcy5zZWxlY3QoJy5udi1yZW1vdmUtYnRuJyk7XG5cblx0XHRcdFx0c2VyaWVzXG5cdFx0XHRcdFx0Lm9uKCdtb3VzZW92ZXInLCBmdW5jdGlvbihkLGkpIHtcblx0XHRcdFx0XHRcdGNoYXJ0TGVnZW5kLmRpc3BhdGNoLmxlZ2VuZE1vdXNlb3ZlcihkLGkpOyAgLy9UT0RPOiBNYWtlIGNvbnNpc3RlbnQgd2l0aCBvdGhlciBldmVudCBvYmplY3RzXG5cdFx0XHRcdFx0fSlcblx0XHRcdFx0XHQub24oJ21vdXNlb3V0JywgZnVuY3Rpb24oZCxpKSB7XG5cdFx0XHRcdFx0XHRjaGFydExlZ2VuZC5kaXNwYXRjaC5sZWdlbmRNb3VzZW91dChkLGkpO1xuXHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0Lm9uKCdjbGljaycsIGZ1bmN0aW9uKGQsaSkge1xuXG5cdFx0XHRcdFx0XHRpZiggQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImdyb3VwLWJ5LXZhcmlhYmxlc1wiICkgfHwgYWRkQ291bnRyeU1vZGUgIT09IFwiYWRkLWNvdW50cnlcIiApIHtcblx0XHRcdFx0XHRcdFx0Ly9pZiBkaXNwbGF5aW5nIHZhcmlhYmxlcywgaW5zdGVhZCBvZiByZW1vdmluZywgdXNlIG9yaWdpbmFsIHZlcnNpb24ganVzdCB0byB0dXJuIHN0dWZmIG9mZlxuXHRcdFx0XHRcdFx0XHQvL29yaWdpbmFsIHZlcnNpb24sIHdoZW4gY2xpY2tpbmcgY291bnRyeSBsYWJlbCBqdXN0IGRlYWN0aXZhdGVzIGl0XG5cdFx0XHRcdFx0XHRcdGNoYXJ0TGVnZW5kLmRpc3BhdGNoLmxlZ2VuZENsaWNrKGQsaSk7XG5cdFx0XHRcdFx0XHRcdC8vIG1ha2Ugc3VyZSB3ZSByZS1nZXQgZGF0YSBpbiBjYXNlIGl0IHdhcyBtb2RpZmllZFxuXHRcdFx0XHRcdFx0XHR2YXIgZGF0YSA9IHNlcmllcy5kYXRhKCk7XG5cdFx0XHRcdFx0XHRcdGlmICh1cGRhdGVTdGF0ZSkge1xuXHRcdFx0XHRcdFx0XHRcdGlmKGV4cGFuZGVkKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRkLmRpc2VuZ2FnZWQgPSAhZC5kaXNlbmdhZ2VkO1xuXHRcdFx0XHRcdFx0XHRcdFx0ZC51c2VyRGlzYWJsZWQgPSBkLnVzZXJEaXNhYmxlZCA9PSB1bmRlZmluZWQgPyAhIWQuZGlzYWJsZWQgOiBkLnVzZXJEaXNhYmxlZDtcblx0XHRcdFx0XHRcdFx0XHRcdGQuZGlzYWJsZWQgPSBkLmRpc2VuZ2FnZWQgfHwgZC51c2VyRGlzYWJsZWQ7XG5cdFx0XHRcdFx0XHRcdFx0fSBlbHNlIGlmICghZXhwYW5kZWQpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGQuZGlzYWJsZWQgPSAhZC5kaXNhYmxlZDtcblx0XHRcdFx0XHRcdFx0XHRcdGQudXNlckRpc2FibGVkID0gZC5kaXNhYmxlZDtcblx0XHRcdFx0XHRcdFx0XHRcdHZhciBlbmdhZ2VkID0gZGF0YS5maWx0ZXIoZnVuY3Rpb24oZCkgeyByZXR1cm4gIWQuZGlzZW5nYWdlZDsgfSk7XG5cdFx0XHRcdFx0XHRcdFx0XHRpZiAoZW5nYWdlZC5ldmVyeShmdW5jdGlvbihzZXJpZXMpIHsgcmV0dXJuIHNlcmllcy51c2VyRGlzYWJsZWQgfSkpIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0Ly90aGUgZGVmYXVsdCBiZWhhdmlvciBvZiBOVkQzIGxlZ2VuZHMgaXMsIGlmIGV2ZXJ5IHNpbmdsZSBzZXJpZXNcblx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gaXMgZGlzYWJsZWQsIHR1cm4gYWxsIHNlcmllcycgYmFjayBvbi5cblx0XHRcdFx0XHRcdFx0XHRcdFx0ZGF0YS5mb3JFYWNoKGZ1bmN0aW9uKHNlcmllcykge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHNlcmllcy5kaXNhYmxlZCA9IHNlcmllcy51c2VyRGlzYWJsZWQgPSBmYWxzZTtcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdGNoYXJ0TGVnZW5kLmRpc3BhdGNoLnN0YXRlQ2hhbmdlKHtcblx0XHRcdFx0XHRcdFx0XHRcdGRpc2FibGVkOiBkYXRhLm1hcChmdW5jdGlvbihkKSB7IHJldHVybiAhIWQuZGlzYWJsZWQ7IH0pLFxuXHRcdFx0XHRcdFx0XHRcdFx0ZGlzZW5nYWdlZDogZGF0YS5tYXAoZnVuY3Rpb24oZCkgeyByZXR1cm4gISFkLmRpc2VuZ2FnZWQ7IH0pXG5cdFx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblxuXHRcdFx0XHRcdFx0XHQvL3doZW4gY2xpY2tpbmcgY291bnRyeSBsYWJlbCwgcmVtb3ZlIHRoZSBjb3VudHJ5XG5cdFx0XHRcdFx0XHRcdGQzLmV2ZW50LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHRcdFx0XHQvL3JlbW92ZSBzZXJpZXMgc3RyYWlnaHQgYXdheSwgc28gd2UgZG9uJ3QgaGF2ZSB0byB3YWl0IGZvciByZXNwb25zZSBmcm9tIHNlcnZlclxuXHRcdFx0XHRcdFx0XHRzZXJpZXNbMF1baV0ucmVtb3ZlKCk7XG5cdFx0XHRcdFx0XHRcdFxuXHRcdFx0XHRcdFx0XHR2YXIgaWQgPSBkLmlkO1xuXHRcdFx0XHRcdFx0XHQvL2luIGNhc2Ugb2YgbXVsdGl2YXJpZW50IGNoYXJ0XG5cdFx0XHRcdFx0XHRcdGlmKCBpZC5pbmRleE9mKCBcIi1cIiApID4gMCApIHtcblx0XHRcdFx0XHRcdFx0XHRpZCA9IHBhcnNlSW50KCBpZC5zcGxpdCggXCItXCIgKVsgMCBdLCAxMCApO1xuXHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdGlkID0gcGFyc2VJbnQoIGlkLCAxMCApO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGRpc3BhdGNoLnJlbW92ZUVudGl0eSggaWQgKTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR9KVxuXHRcdFx0XHRcdC5vbignZGJsY2xpY2snLCBmdW5jdGlvbihkLGkpIHtcblx0XHRcdFx0XHRcdGlmKCh2ZXJzID09ICdmdXJpb3VzJyB8fCB2ZXJzID09ICdvd2QnKSAmJiBleHBhbmRlZCkgcmV0dXJuO1xuXHRcdFx0XHRcdFx0Y2hhcnRMZWdlbmQuZGlzcGF0Y2gubGVnZW5kRGJsY2xpY2soZCxpKTtcblx0XHRcdFx0XHRcdGlmICh1cGRhdGVTdGF0ZSkge1xuXHRcdFx0XHRcdFx0XHQvLyBtYWtlIHN1cmUgd2UgcmUtZ2V0IGRhdGEgaW4gY2FzZSBpdCB3YXMgbW9kaWZpZWRcblx0XHRcdFx0XHRcdFx0dmFyIGRhdGEgPSBzZXJpZXMuZGF0YSgpO1xuXHRcdFx0XHRcdFx0XHQvL3RoZSBkZWZhdWx0IGJlaGF2aW9yIG9mIE5WRDMgbGVnZW5kcywgd2hlbiBkb3VibGUgY2xpY2tpbmcgb25lLFxuXHRcdFx0XHRcdFx0XHQvLyBpcyB0byBzZXQgYWxsIG90aGVyIHNlcmllcycgdG8gZmFsc2UsIGFuZCBtYWtlIHRoZSBkb3VibGUgY2xpY2tlZCBzZXJpZXMgZW5hYmxlZC5cblx0XHRcdFx0XHRcdFx0ZGF0YS5mb3JFYWNoKGZ1bmN0aW9uKHNlcmllcykge1xuXHRcdFx0XHRcdFx0XHRcdHNlcmllcy5kaXNhYmxlZCA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdFx0aWYodmVycyA9PSAnZnVyaW91cycgfHwgdmVycyA9PSAnb3dkJykgc2VyaWVzLnVzZXJEaXNhYmxlZCA9IHNlcmllcy5kaXNhYmxlZDtcblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdGQuZGlzYWJsZWQgPSBmYWxzZTtcblx0XHRcdFx0XHRcdFx0aWYodmVycyA9PSAnZnVyaW91cycgfHwgdmVycyA9PSAnb3dkJyApIGQudXNlckRpc2FibGVkID0gZC5kaXNhYmxlZDtcblx0XHRcdFx0XHRcdFx0Y2hhcnRMZWdlbmQuZGlzcGF0Y2guc3RhdGVDaGFuZ2Uoe1xuXHRcdFx0XHRcdFx0XHRcdGRpc2FibGVkOiBkYXRhLm1hcChmdW5jdGlvbihkKSB7IHJldHVybiAhIWQuZGlzYWJsZWQ7IH0pXG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHNlcmllc1JlbW92ZS5vbiggJ2NsaWNrJywgZnVuY3Rpb24oIGQsIGkgKSB7XG5cblx0XHRcdFx0XHRkMy5ldmVudC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcblx0XHRcdFx0XHQvL3JlbW92ZSBzZXJpZXMgc3RyYWlnaHQgYXdheSwgc28gd2UgZG9uJ3QgaGF2ZSB0byB3YWl0IGZvciByZXNwb25zZSBmcm9tIHNlcnZlclxuXHRcdFx0XHRcdHNlcmllc1swXVtpXS5yZW1vdmUoKTtcblx0XHRcdFx0XHRkaXNwYXRjaC5yZW1vdmVFbnRpdHkoIGQuaWQgKTtcblx0XHRcdFx0XHRcblx0XHRcdFx0fSApO1x0XG5cblx0XHRcdFx0c2VyaWVzLmNsYXNzZWQoJ252LWRpc2FibGVkJywgZnVuY3Rpb24oZCkgeyByZXR1cm4gZC51c2VyRGlzYWJsZWQ7IH0pO1xuXHRcdFx0XHRzZXJpZXMuZXhpdCgpLnJlbW92ZSgpO1xuXG5cdFx0XHRcdHNlcmllc1RleHRcblx0XHRcdFx0XHQuYXR0cignZmlsbCcsIHNldFRleHRDb2xvcilcblx0XHRcdFx0XHQudGV4dChnZXRLZXkpO1xuXG5cdFx0XHRcdC8vVE9ETzogaW1wbGVtZW50IGZpeGVkLXdpZHRoIGFuZCBtYXgtd2lkdGggb3B0aW9ucyAobWF4LXdpZHRoIGlzIGVzcGVjaWFsbHkgdXNlZnVsIHdpdGggdGhlIGFsaWduIG9wdGlvbilcblx0XHRcdFx0Ly8gTkVXIEFMSUdOSU5HIENPREUsIFRPRE86IGNsZWFuIHVwXG5cdFx0XHRcdHZhciBsZWdlbmRXaWR0aCA9IDAsXG5cdFx0XHRcdFx0dHJhbnNmb3JtWCwgdHJhbnNmb3JtWTtcblx0XHRcdFx0aWYgKGFsaWduKSB7XG5cblx0XHRcdFx0XHR2YXIgc2VyaWVzV2lkdGhzID0gW107XG5cdFx0XHRcdFx0c2VyaWVzLmVhY2goIGZ1bmN0aW9uKGQsaSkge1xuXHRcdFx0XHRcdFx0dmFyIGxlZ2VuZFRleHQgPSBkMy5zZWxlY3QodGhpcykuc2VsZWN0KCd0ZXh0Jyk7XG5cdFx0XHRcdFx0XHR2YXIgbm9kZVRleHRMZW5ndGg7XG5cdFx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0XHRub2RlVGV4dExlbmd0aCA9IGxlZ2VuZFRleHQubm9kZSgpLmdldENvbXB1dGVkVGV4dExlbmd0aCgpO1xuXHRcdFx0XHRcdFx0XHQvLyBJZiB0aGUgbGVnZW5kVGV4dCBpcyBkaXNwbGF5Om5vbmUnZCAobm9kZVRleHRMZW5ndGggPT0gMCksIHNpbXVsYXRlIGFuIGVycm9yIHNvIHdlIGFwcHJveGltYXRlLCBpbnN0ZWFkXG5cdFx0XHRcdFx0XHRcdGlmKG5vZGVUZXh0TGVuZ3RoIDw9IDApIHRocm93IEVycm9yKCk7XG5cdFx0XHRcdFx0XHR9IGNhdGNoKCBlICkge1xuXHRcdFx0XHRcdFx0XHRub2RlVGV4dExlbmd0aCA9IG52LnV0aWxzLmNhbGNBcHByb3hUZXh0V2lkdGgobGVnZW5kVGV4dCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRzZXJpZXNXaWR0aHMucHVzaChub2RlVGV4dExlbmd0aCArIHBhZGRpbmcpO1xuXHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0dmFyIHNlcmllc1BlclJvdyA9IDA7XG5cdFx0XHRcdFx0dmFyIGNvbHVtbldpZHRocyA9IFtdO1xuXHRcdFx0XHRcdGxlZ2VuZFdpZHRoID0gMDtcblxuXHRcdFx0XHRcdHdoaWxlKCBsZWdlbmRXaWR0aCA8IGF2YWlsYWJsZVdpZHRoICYmIHNlcmllc1BlclJvdyA8IHNlcmllc1dpZHRocy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0XHRjb2x1bW5XaWR0aHNbc2VyaWVzUGVyUm93XSA9IHNlcmllc1dpZHRoc1tzZXJpZXNQZXJSb3ddO1xuXHRcdFx0XHRcdFx0bGVnZW5kV2lkdGggKz0gc2VyaWVzV2lkdGhzW3Nlcmllc1BlclJvdysrXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYoIHNlcmllc1BlclJvdyA9PT0gMCApIHNlcmllc1BlclJvdyA9IDE7IC8vbWluaW11bSBvZiBvbmUgc2VyaWVzIHBlciByb3dcblxuXHRcdFx0XHRcdHdoaWxlKCBsZWdlbmRXaWR0aCA+IGF2YWlsYWJsZVdpZHRoICYmIHNlcmllc1BlclJvdyA+IDEgKSB7XG5cdFx0XHRcdFx0XHRjb2x1bW5XaWR0aHMgPSBbXTtcblx0XHRcdFx0XHRcdHNlcmllc1BlclJvdy0tO1xuXG5cdFx0XHRcdFx0XHRmb3IgKHZhciBrID0gMDsgayA8IHNlcmllc1dpZHRocy5sZW5ndGg7IGsrKykge1xuXHRcdFx0XHRcdFx0XHRpZiAoc2VyaWVzV2lkdGhzW2tdID4gKGNvbHVtbldpZHRoc1trICUgc2VyaWVzUGVyUm93XSB8fCAwKSApXG5cdFx0XHRcdFx0XHRcdFx0Y29sdW1uV2lkdGhzW2sgJSBzZXJpZXNQZXJSb3ddID0gc2VyaWVzV2lkdGhzW2tdO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRsZWdlbmRXaWR0aCA9IGNvbHVtbldpZHRocy5yZWR1Y2UoZnVuY3Rpb24ocHJldiwgY3VyLCBpbmRleCwgYXJyYXkpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHByZXYgKyBjdXI7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR2YXIgeFBvc2l0aW9ucyA9IFtdO1xuXHRcdFx0XHRcdGZvciAodmFyIGkgPSAwLCBjdXJYID0gMDsgaSA8IHNlcmllc1BlclJvdzsgaSsrKSB7XG5cdFx0XHRcdFx0XHR4UG9zaXRpb25zW2ldID0gY3VyWDtcblx0XHRcdFx0XHRcdGN1clggKz0gY29sdW1uV2lkdGhzW2ldO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHNlcmllc1xuXHRcdFx0XHRcdFx0LmF0dHIoJ3RyYW5zZm9ybScsIGZ1bmN0aW9uKGQsIGkpIHtcblx0XHRcdFx0XHRcdFx0dHJhbnNmb3JtWCA9IHhQb3NpdGlvbnNbaSAlIHNlcmllc1BlclJvd107XG5cdFx0XHRcdFx0XHRcdHRyYW5zZm9ybVkgPSAoNSArIE1hdGguZmxvb3IoaSAvIHNlcmllc1BlclJvdykgKiB2ZXJzUGFkZGluZyk7XG5cdFx0XHRcdFx0XHRcdHJldHVybiAndHJhbnNsYXRlKCcgKyB0cmFuc2Zvcm1YICsgJywnICsgdHJhbnNmb3JtWSArICcpJztcblx0XHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0Ly9wb3NpdGlvbiBsZWdlbmQgYXMgZmFyIHJpZ2h0IGFzIHBvc3NpYmxlIHdpdGhpbiB0aGUgdG90YWwgd2lkdGhcblx0XHRcdFx0XHRpZiAocmlnaHRBbGlnbikge1xuXHRcdFx0XHRcdFx0Zy5hdHRyKCd0cmFuc2Zvcm0nLCAndHJhbnNsYXRlKCcgKyAod2lkdGggLSBtYXJnaW4ucmlnaHQgLSBsZWdlbmRXaWR0aCkgKyAnLCcgKyBtYXJnaW4udG9wICsgJyknKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0XHRnLmF0dHIoJ3RyYW5zZm9ybScsICd0cmFuc2xhdGUoJyArIGVudGl0eUxhYmVsV2lkdGggKyAnLCcgKyBtYXJnaW4udG9wICsgJyknKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRoZWlnaHQgPSBtYXJnaW4udG9wICsgbWFyZ2luLmJvdHRvbSArIChNYXRoLmNlaWwoc2VyaWVzV2lkdGhzLmxlbmd0aCAvIHNlcmllc1BlclJvdykgKiB2ZXJzUGFkZGluZyk7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdH0gZWxzZSB7XG5cblx0XHRcdFx0XHR2YXIgeXBvcyA9IDUsXG5cdFx0XHRcdFx0XHRuZXd4cG9zID0gNSxcblx0XHRcdFx0XHRcdG1heHdpZHRoID0gMCxcblx0XHRcdFx0XHRcdHhwb3M7XG5cdFx0XHRcdFx0c2VyaWVzXG5cdFx0XHRcdFx0XHQuYXR0cigndHJhbnNmb3JtJywgZnVuY3Rpb24oZCwgaSkge1xuXHRcdFx0XHRcdFx0XHR2YXIgbGVuZ3RoID0gZDMuc2VsZWN0KHRoaXMpLnNlbGVjdCgndGV4dCcpLm5vZGUoKS5nZXRDb21wdXRlZFRleHRMZW5ndGgoKSArIHBhZGRpbmc7XG5cdFx0XHRcdFx0XHRcdHhwb3MgPSBuZXd4cG9zO1xuXG5cdFx0XHRcdFx0XHRcdGlmICh3aWR0aCA8IG1hcmdpbi5sZWZ0ICsgbWFyZ2luLnJpZ2h0ICsgeHBvcyArIGxlbmd0aCkge1xuXHRcdFx0XHRcdFx0XHRcdG5ld3hwb3MgPSB4cG9zID0gNTtcblx0XHRcdFx0XHRcdFx0XHR5cG9zICs9IHZlcnNQYWRkaW5nO1xuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0bmV3eHBvcyArPSBsZW5ndGg7XG5cdFx0XHRcdFx0XHRcdGlmIChuZXd4cG9zID4gbWF4d2lkdGgpIG1heHdpZHRoID0gbmV3eHBvcztcblxuXHRcdFx0XHRcdFx0XHRpZihsZWdlbmRXaWR0aCA8IHhwb3MgKyBtYXh3aWR0aCkge1xuXHRcdFx0XHRcdFx0XHRcdGxlZ2VuZFdpZHRoID0geHBvcyArIG1heHdpZHRoO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdHJldHVybiAndHJhbnNsYXRlKCcgKyB4cG9zICsgJywnICsgeXBvcyArICcpJztcblx0XHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0Ly9wb3NpdGlvbiBsZWdlbmQgYXMgZmFyIHJpZ2h0IGFzIHBvc3NpYmxlIHdpdGhpbiB0aGUgdG90YWwgd2lkdGhcblx0XHRcdFx0XHRnLmF0dHIoJ3RyYW5zZm9ybScsICd0cmFuc2xhdGUoJyArICh3aWR0aCAtIG1hcmdpbi5yaWdodCAtIG1heHdpZHRoKSArICcsJyArIG1hcmdpbi50b3AgKyAnKScpO1xuXG5cdFx0XHRcdFx0aGVpZ2h0ID0gbWFyZ2luLnRvcCArIG1hcmdpbi5ib3R0b20gKyB5cG9zICsgMTU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBTaXplIHJlY3RhbmdsZXMgYWZ0ZXIgdGV4dCBpcyBwbGFjZWRcblx0XHRcdFx0c2VyaWVzU2hhcGVcblx0XHRcdFx0XHQuYXR0cignd2lkdGgnLCBmdW5jdGlvbihkLGkpIHtcblx0XHRcdFx0XHRcdC8vcG9zaXRpb24gcmVtb3ZlIGJ0blxuXHRcdFx0XHRcdFx0dmFyIHdpZHRoID0gc2VyaWVzVGV4dFswXVtpXS5nZXRDb21wdXRlZFRleHRMZW5ndGgoKSArIDU7XG5cdFx0XHRcdFx0XHRkMy5zZWxlY3QoIHNlcmllc1JlbW92ZVswXVtpXSApLmF0dHIoICd0cmFuc2Zvcm0nLCAndHJhbnNsYXRlKCcgKyB3aWR0aCArICcsLTMpJyApO1xuXHRcdFx0XHRcdFx0cmV0dXJuIHdpZHRoKzI1O1xuXHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0LmF0dHIoJ2hlaWdodCcsIDI0KVxuXHRcdFx0XHRcdC5hdHRyKCd5JywgLTEyKVxuXHRcdFx0XHRcdC5hdHRyKCd4JywgLTEyKTtcblxuXHRcdFx0XHQvLyBUaGUgYmFja2dyb3VuZCBmb3IgdGhlIGV4cGFuZGVkIGxlZ2VuZCAoVUkpXG5cdFx0XHRcdGdFbnRlci5pbnNlcnQoJ3JlY3QnLCc6Zmlyc3QtY2hpbGQnKVxuXHRcdFx0XHRcdC5hdHRyKCdjbGFzcycsICdudi1sZWdlbmQtYmcnKVxuXHRcdFx0XHRcdC5hdHRyKCdmaWxsJywgJyNlZWUnKVxuXHRcdFx0XHRcdC8vIC5hdHRyKCdzdHJva2UnLCAnIzQ0NCcpXG5cdFx0XHRcdFx0LmF0dHIoJ29wYWNpdHknLDApO1xuXG5cdFx0XHRcdHZhciBzZXJpZXNCRyA9IGcuc2VsZWN0KCcubnYtbGVnZW5kLWJnJyk7XG5cblx0XHRcdFx0c2VyaWVzQkdcblx0XHRcdFx0LnRyYW5zaXRpb24oKS5kdXJhdGlvbigzMDApXG5cdFx0XHRcdFx0LmF0dHIoJ3gnLCAtdmVyc1BhZGRpbmcgKVxuXHRcdFx0XHRcdC5hdHRyKCd3aWR0aCcsIGxlZ2VuZFdpZHRoICsgdmVyc1BhZGRpbmcgLSAxMilcblx0XHRcdFx0XHQuYXR0cignaGVpZ2h0JywgaGVpZ2h0IClcblx0XHRcdFx0XHQuYXR0cigneScsIC1tYXJnaW4udG9wIC0gMTApXG5cdFx0XHRcdFx0LmF0dHIoJ29wYWNpdHknLCBleHBhbmRlZCA/IDEgOiAwKTtcblxuXHRcdFx0XHRzZXJpZXNTaGFwZVxuXHRcdFx0XHRcdC5zdHlsZSgnZmlsbCcsIHNldEJHQ29sb3IpXG5cdFx0XHRcdFx0LnN0eWxlKCdmaWxsLW9wYWNpdHknLCBzZXRCR09wYWNpdHkpXG5cdFx0XHRcdFx0LnN0eWxlKCdzdHJva2UnLCBzZXRCR0NvbG9yKTtcblxuXHRcdFx0XHQvL3Bvc2l0aW9uIGFkZCBidG5cblx0XHRcdFx0aWYoIHNlcmllcy5zaXplKCkgKSB7XG5cblx0XHRcdFx0XHR2YXIgc2VyaWVzQXJyID0gc2VyaWVzWzBdO1xuXHRcdFx0XHRcdGlmKCBzZXJpZXNBcnIgJiYgc2VyaWVzQXJyLmxlbmd0aCApIHtcblx0XHRcdFx0XHRcdC8vZmV0Y2ggbGFzdCBlbGVtZW50IHRvIGtub3cgaXRzIHdpZHRoXG5cdFx0XHRcdFx0XHR2YXIgbGFzdEVsID0gc2VyaWVzQXJyWyBzZXJpZXNBcnIubGVuZ3RoLTEgXSxcblx0XHRcdFx0XHRcdFx0Ly9uZWVkIHJlY3QgaW5zaWRlIGVsZW1lbnQgdGhhdCBoYXMgc2V0IHdpZHRoXG5cdFx0XHRcdFx0XHRcdGxhc3RSZWN0ID0gZDMuc2VsZWN0KCBsYXN0RWwgKS5zZWxlY3QoIFwicmVjdFwiICksXG5cdFx0XHRcdFx0XHRcdGxhc3RSZWN0V2lkdGggPSBsYXN0UmVjdC5hdHRyKCBcIndpZHRoXCIgKTtcblx0XHRcdFx0XHRcdC8vcG9zaXRpb24gYWRkIGJ0blxuXHRcdFx0XHRcdFx0dHJhbnNmb3JtWCA9ICt0cmFuc2Zvcm1YICsgcGFyc2VJbnQoIGxhc3RSZWN0V2lkdGgsIDEwICkgLSAzO1xuXHRcdFx0XHRcdFx0dHJhbnNmb3JtWCArPSBlbnRpdHlMYWJlbFdpZHRoO1xuXHRcdFx0XHRcdFx0Ly9jZW50ZXJpbmdcblx0XHRcdFx0XHRcdHRyYW5zZm9ybVkgPSArdHJhbnNmb3JtWSAtIDM7XG5cdFx0XHRcdFx0XHQvL2NoZWNrIGZvciByaWdodCBlZGdlXG5cdFx0XHRcdFx0XHR2YXIgYnV0dG9uV2lkdGggPSAxMjAsIGJ1dHRvbkhlaWdodCA9IDM1O1xuXHRcdFx0XHRcdFx0aWYoICggdHJhbnNmb3JtWCArIGJ1dHRvbldpZHRoICkgPiBhdmFpbGFibGVXaWR0aCApIHtcblx0XHRcdFx0XHRcdFx0Ly9tYWtlIHN1cmUgd2UgaGF2ZSBidXR0b25cblx0XHRcdFx0XHRcdFx0dmFyIGFkZEVudGl0eURpc3BsYXkgPSBhZGRFbnRpdHlCdG4uYXR0ciggXCJkaXNwbGF5XCIgKTtcblx0XHRcdFx0XHRcdFx0aWYoIGFkZEVudGl0eURpc3BsYXkgIT09IFwibm9uZVwiICkge1xuXHRcdFx0XHRcdFx0XHRcdHRyYW5zZm9ybVggPSAwOy8vYXZhaWxhYmxlV2lkdGggLSBidXR0b25XaWR0aDtcblx0XHRcdFx0XHRcdFx0XHR0cmFuc2Zvcm1ZICs9IGJ1dHRvbkhlaWdodDtcblx0XHRcdFx0XHRcdFx0XHQvL3VwZGF0ZSB3aG9sZSBjaGFydCBoZWlnaHQgYXMgd2VsbFxuXHRcdFx0XHRcdFx0XHRcdGhlaWdodCArPSBidXR0b25IZWlnaHQ7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5hdHRyKCBcInRyYW5zZm9ybVwiLCBcInRyYW5zbGF0ZSggXCIgKyB0cmFuc2Zvcm1YICsgXCIsIFwiICsgdHJhbnNmb3JtWSArIFwiKVwiICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XG5cdFx0XHRcdH1cblx0XHRcdFxuXHRcdFx0fSk7XG5cdFx0XHRcblx0XHRcdGZ1bmN0aW9uIHNldFRleHRDb2xvcihkLGkpIHtcblx0XHRcdFx0aWYodmVycyAhPSAnZnVyaW91cycgJiYgdmVycyAhPSAnb3dkJykgcmV0dXJuICcjMDAwJztcblx0XHRcdFx0aWYoZXhwYW5kZWQpIHtcblx0XHRcdFx0XHRyZXR1cm4gZC5kaXNlbmdhZ2VkID8gJyMwMDAnIDogJyNmZmYnO1xuXHRcdFx0XHR9IGVsc2UgaWYgKCFleHBhbmRlZCkge1xuXHRcdFx0XHRcdGlmKCFkLmNvbG9yKSBkLmNvbG9yID0gY29sb3IoZCxpKTtcblx0XHRcdFx0XHRyZXR1cm4gISFkLmRpc2FibGVkID8gJyM2NjYnIDogJyNmZmYnO1xuXHRcdFx0XHRcdC8vcmV0dXJuICEhZC5kaXNhYmxlZCA/IGQuY29sb3IgOiAnI2ZmZic7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0ZnVuY3Rpb24gc2V0QkdDb2xvcihkLGkpIHtcblx0XHRcdFx0aWYoZXhwYW5kZWQgJiYgKHZlcnMgPT0gJ2Z1cmlvdXMnIHx8IHZlcnMgPT0gJ293ZCcpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGQuZGlzZW5nYWdlZCA/ICcjZWVlJyA6IGQuY29sb3IgfHwgY29sb3IoZCxpKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXR1cm4gZC5jb2xvciB8fCBjb2xvcihkLGkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblxuXHRcdFx0ZnVuY3Rpb24gc2V0QkdPcGFjaXR5KGQsaSkge1xuXHRcdFx0XHRpZihleHBhbmRlZCAmJiAodmVycyA9PSAnZnVyaW91cycgfHwgdmVycyA9PSAnb3dkJykpIHtcblx0XHRcdFx0XHRyZXR1cm4gMTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXR1cm4gISFkLmRpc2FibGVkID8gMCA6IDE7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGNoYXJ0O1xuXHRcdH1cblxuXHRcdC8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cdFx0Ly8gRXhwb3NlIFB1YmxpYyBWYXJpYWJsZXNcblx0XHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5cdFx0Y2hhcnQuZGlzcGF0Y2ggPSBkaXNwYXRjaDtcblx0XHRjaGFydC5vcHRpb25zID0gbnYudXRpbHMub3B0aW9uc0Z1bmMuYmluZChjaGFydCk7XG5cblx0XHRjaGFydC5fb3B0aW9ucyA9IE9iamVjdC5jcmVhdGUoe30sIHtcblx0XHRcdC8vIHNpbXBsZSBvcHRpb25zLCBqdXN0IGdldC9zZXQgdGhlIG5lY2Vzc2FyeSB2YWx1ZXNcblx0XHRcdHdpZHRoOiAgICAgIHtnZXQ6IGZ1bmN0aW9uKCl7cmV0dXJuIHdpZHRoO30sIHNldDogZnVuY3Rpb24oXyl7d2lkdGg9Xzt9fSxcblx0XHRcdGhlaWdodDogICAgIHtnZXQ6IGZ1bmN0aW9uKCl7cmV0dXJuIGhlaWdodDt9LCBzZXQ6IGZ1bmN0aW9uKF8pe2hlaWdodD1fO319LFxuXHRcdFx0a2V5OiAgICAgICAge2dldDogZnVuY3Rpb24oKXtyZXR1cm4gZ2V0S2V5O30sIHNldDogZnVuY3Rpb24oXyl7Z2V0S2V5PV87fX0sXG5cdFx0XHRhbGlnbjogICAgICB7Z2V0OiBmdW5jdGlvbigpe3JldHVybiBhbGlnbjt9LCBzZXQ6IGZ1bmN0aW9uKF8pe2FsaWduPV87fX0sXG5cdFx0XHRyaWdodEFsaWduOiAgICB7Z2V0OiBmdW5jdGlvbigpe3JldHVybiByaWdodEFsaWduO30sIHNldDogZnVuY3Rpb24oXyl7cmlnaHRBbGlnbj1fO319LFxuXHRcdFx0cGFkZGluZzogICAgICAge2dldDogZnVuY3Rpb24oKXtyZXR1cm4gcGFkZGluZzt9LCBzZXQ6IGZ1bmN0aW9uKF8pe3BhZGRpbmc9Xzt9fSxcblx0XHRcdHVwZGF0ZVN0YXRlOiAgIHtnZXQ6IGZ1bmN0aW9uKCl7cmV0dXJuIHVwZGF0ZVN0YXRlO30sIHNldDogZnVuY3Rpb24oXyl7dXBkYXRlU3RhdGU9Xzt9fSxcblx0XHRcdHJhZGlvQnV0dG9uTW9kZTogICAge2dldDogZnVuY3Rpb24oKXtyZXR1cm4gcmFkaW9CdXR0b25Nb2RlO30sIHNldDogZnVuY3Rpb24oXyl7cmFkaW9CdXR0b25Nb2RlPV87fX0sXG5cdFx0XHRleHBhbmRlZDogICB7Z2V0OiBmdW5jdGlvbigpe3JldHVybiBleHBhbmRlZDt9LCBzZXQ6IGZ1bmN0aW9uKF8pe2V4cGFuZGVkPV87fX0sXG5cdFx0XHR2ZXJzOiAgIHtnZXQ6IGZ1bmN0aW9uKCl7cmV0dXJuIHZlcnM7fSwgc2V0OiBmdW5jdGlvbihfKXt2ZXJzPV87fX0sXG5cblx0XHRcdC8vIG9wdGlvbnMgdGhhdCByZXF1aXJlIGV4dHJhIGxvZ2ljIGluIHRoZSBzZXR0ZXJcblx0XHRcdG1hcmdpbjoge2dldDogZnVuY3Rpb24oKXtyZXR1cm4gbWFyZ2luO30sIHNldDogZnVuY3Rpb24oXyl7XG5cdFx0XHRcdG1hcmdpbi50b3AgICAgPSBfLnRvcCAgICAhPT0gdW5kZWZpbmVkID8gXy50b3AgICAgOiBtYXJnaW4udG9wO1xuXHRcdFx0XHRtYXJnaW4ucmlnaHQgID0gXy5yaWdodCAgIT09IHVuZGVmaW5lZCA/IF8ucmlnaHQgIDogbWFyZ2luLnJpZ2h0O1xuXHRcdFx0XHRtYXJnaW4uYm90dG9tID0gXy5ib3R0b20gIT09IHVuZGVmaW5lZCA/IF8uYm90dG9tIDogbWFyZ2luLmJvdHRvbTtcblx0XHRcdFx0bWFyZ2luLmxlZnQgICA9IF8ubGVmdCAgICE9PSB1bmRlZmluZWQgPyBfLmxlZnQgICA6IG1hcmdpbi5sZWZ0O1xuXHRcdFx0fX0sXG5cdFx0XHRjb2xvcjogIHtnZXQ6IGZ1bmN0aW9uKCl7cmV0dXJuIGNvbG9yO30sIHNldDogZnVuY3Rpb24oXyl7XG5cdFx0XHRcdGNvbG9yID0gbnYudXRpbHMuZ2V0Q29sb3IoXyk7XG5cdFx0XHR9fVxuXHRcdH0pO1xuXG5cdFx0bnYudXRpbHMuaW5pdE9wdGlvbnMoY2hhcnQpO1xuXG5cdFx0cmV0dXJuIGNoYXJ0O1xuXHR9O1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkNoYXJ0LkxlZ2VuZDtcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBNYXBDb250cm9scyA9IHJlcXVpcmUoIFwiLi9tYXAvQXBwLlZpZXdzLkNoYXJ0Lk1hcC5NYXBDb250cm9scy5qc1wiICk7XG5cblx0QXBwLlZpZXdzLkNoYXJ0Lk1hcFRhYiA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblxuXHRcdCR0YWI6IG51bGwsXG5cdFx0ZGF0YU1hcDogbnVsbCxcblx0XHRtYXBDb250cm9sczogbnVsbCxcblx0XHRsZWdlbmQ6IG51bGwsXG5cblx0XHRldmVudHM6IHt9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHRcblx0XHRcdHRoaXMuZGlzcGF0Y2hlciA9IG9wdGlvbnMuZGlzcGF0Y2hlcjtcblx0XHRcdHRoaXMubWFwQ29udHJvbHMgPSBuZXcgTWFwQ29udHJvbHMoIHsgZGlzcGF0Y2hlcjogb3B0aW9ucy5kaXNwYXRjaGVyIH0gKTtcblxuXHRcdFx0Ly9pbml0IG1hcCBvbmx5IGlmIHRoZSBtYXAgdGFiIGRpc3BsYXllZFxuXHRcdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdFx0JCggXCJbZGF0YS10b2dnbGU9J3RhYiddW2hyZWY9JyNtYXAtY2hhcnQtdGFiJ11cIiApLm9uKCBcInNob3duLmJzLnRhYlwiLCBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0XHR0aGF0LmRpc3BsYXkoKTtcblx0XHRcdH0gKTtcblx0XHRcdFxuXHRcdH0sXG5cblx0XHRkaXNwbGF5OiBmdW5jdGlvbigpIHtcblx0XHRcdC8vcmVuZGVyIG9ubHkgaWYgbm8gbWFwIHlldFxuXHRcdFx0aWYoICF0aGlzLmRhdGFNYXAgKSB7XG5cdFx0XHRcdHRoaXMucmVuZGVyKCk7XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cblx0XHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRcdC8vZmV0Y2ggY3JlYXRlZCBkb21cblx0XHRcdHRoaXMuJHRhYiA9ICQoIFwiI21hcC1jaGFydC10YWJcIiApO1xuXG5cdFx0XHR2YXIgbWFwQ29uZmlnID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcIm1hcC1jb25maWdcIiApLFxuXHRcdFx0XHRkZWZhdWx0UHJvamVjdGlvbiA9IHRoaXMuZ2V0UHJvamVjdGlvbiggbWFwQ29uZmlnLnByb2plY3Rpb24gKTtcblx0XHRcdFxuXHRcdFx0dGhpcy5kYXRhTWFwID0gbmV3IERhdGFtYXAoIHtcblx0XHRcdFx0d2lkdGg6IHRoYXQuJHRhYi53aWR0aCgpLFxuXHRcdFx0XHRoZWlnaHQ6IHRoYXQuJHRhYi5oZWlnaHQoKSxcblx0XHRcdFx0cmVzcG9uc2l2ZTogdHJ1ZSxcblx0XHRcdFx0ZWxlbWVudDogZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIFwibWFwLWNoYXJ0LXRhYlwiICksXG5cdFx0XHRcdGdlb2dyYXBoeUNvbmZpZzoge1xuXHRcdFx0XHRcdGRhdGFVcmw6IEdsb2JhbC5yb290VXJsICsgXCIvanMvZGF0YS93b3JsZC5pZHMuanNvblwiLFxuXHRcdFx0XHRcdGJvcmRlcldpZHRoOiAwLjEsXG5cdFx0XHRcdFx0Ym9yZGVyQ29sb3I6ICcjNEY0RjRGJyxcblx0XHRcdFx0XHRoaWdobGlnaHRCb3JkZXJDb2xvcjogJ2JsYWNrJyxcblx0XHRcdFx0XHRoaWdobGlnaHRCb3JkZXJXaWR0aDogMC4yLFxuXHRcdFx0XHRcdGhpZ2hsaWdodEZpbGxDb2xvcjogJyNGRkVDMzgnLFxuXHRcdFx0XHRcdHBvcHVwVGVtcGxhdGU6IHRoYXQucG9wdXBUZW1wbGF0ZUdlbmVyYXRvclxuXHRcdFx0XHR9LFxuXHRcdFx0XHRmaWxsczoge1xuXHRcdFx0XHRcdGRlZmF1bHRGaWxsOiAnI0ZGRkZGRidcblx0XHRcdFx0XHQvL2RlZmF1bHRGaWxsOiAnI0RERERERCdcblx0XHRcdFx0fSxcblx0XHRcdFx0c2V0UHJvamVjdGlvbjogZGVmYXVsdFByb2plY3Rpb24sXG5cdFx0XHRcdC8vd2FpdCBmb3IganNvbiB0byBsb2FkIGJlZm9yZSBsb2FkaW5nIG1hcCBkYXRhXG5cdFx0XHRcdGRvbmU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdHRoYXQubWFwRGF0YU1vZGVsID0gbmV3IEFwcC5Nb2RlbHMuQ2hhcnREYXRhTW9kZWwoKTtcblx0XHRcdFx0XHR0aGF0Lm1hcERhdGFNb2RlbC5vbiggXCJzeW5jXCIsIGZ1bmN0aW9uKCBtb2RlbCwgcmVzcG9uc2UgKSB7XG5cdFx0XHRcdFx0XHRpZiggcmVzcG9uc2UuZGF0YSApIHtcblx0XHRcdFx0XHRcdFx0dGhhdC5kaXNwbGF5RGF0YSggcmVzcG9uc2UuZGF0YSApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHR0aGF0Lm1hcERhdGFNb2RlbC5vbiggXCJlcnJvclwiLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoIFwiRXJyb3IgbG9hZGluZyBtYXAgZGF0YS5cIiApO1xuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHR0aGF0LnVwZGF0ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cblx0XHRcdHRoaXMubGVnZW5kID0gbmV3IEFwcC5WaWV3cy5DaGFydC5NYXAuTGVnZW5kKCk7XG5cdFx0XHRcblx0XHRcdEFwcC5DaGFydE1vZGVsLm9uKCBcImNoYW5nZVwiLCB0aGlzLm9uQ2hhcnRNb2RlbENoYW5nZSwgdGhpcyApO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwub24oIFwiY2hhbmdlLW1hcFwiLCB0aGlzLm9uQ2hhcnRNb2RlbENoYW5nZSwgdGhpcyApO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwub24oIFwicmVzaXplXCIsIHRoaXMub25DaGFydE1vZGVsUmVzaXplLCB0aGlzICk7XG5cdFx0XHRcblx0XHRcdG52LnV0aWxzLndpbmRvd1Jlc2l6ZSggJC5wcm94eSggdGhpcy5vblJlc2l6ZSwgdGhpcyApICk7XG5cdFx0XHR0aGlzLm9uUmVzaXplKCk7XG5cblx0XHR9LFxuXG5cdFx0b25DaGFydE1vZGVsQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHR0aGlzLnVwZGF0ZSgpO1xuXG5cdFx0fSxcblxuXHRcdHBvcHVwVGVtcGxhdGVHZW5lcmF0b3I6IGZ1bmN0aW9uKCBnZW8sIGRhdGEgKSB7XG5cdFx0XHQvL3RyYW5zZm9ybSBkYXRhbWFwcyBkYXRhIGludG8gZm9ybWF0IGNsb3NlIHRvIG52ZDMgc28gdGhhdCB3ZSBjYW4gcmV1c2UgdGhlIHNhbWUgcG9wdXAgZ2VuZXJhdG9yXG5cdFx0XHR2YXIgbWFwQ29uZmlnID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcIm1hcC1jb25maWdcIiApO1xuXHRcdFx0dmFyIHByb3BlcnR5TmFtZSA9IEFwcC5VdGlscy5nZXRQcm9wZXJ0eUJ5VmFyaWFibGVJZCggQXBwLkNoYXJ0TW9kZWwsIG1hcENvbmZpZy52YXJpYWJsZUlkICk7XG5cdFx0XHRpZiggIXByb3BlcnR5TmFtZSApIHtcblx0XHRcdFx0cHJvcGVydHlOYW1lID0gXCJ5XCI7XG5cdFx0XHR9XG5cdFx0XHR2YXIgb2JqID0ge1xuXHRcdFx0XHRwb2ludDoge1xuXHRcdFx0XHRcdHRpbWU6IG1hcENvbmZpZy50YXJnZXRZZWFyIH0sXG5cdFx0XHRcdHNlcmllczogWyB7XG5cdFx0XHRcdFx0a2V5OiBnZW8ucHJvcGVydGllcy5uYW1lXG5cdFx0XHRcdH0gXVxuXHRcdFx0fTtcblx0XHRcdG9iai5wb2ludFsgcHJvcGVydHlOYW1lIF0gPSBkYXRhLnZhbHVlO1xuXHRcdFx0cmV0dXJuIFsgXCI8ZGl2IGNsYXNzPSdob3ZlcmluZm8gbnZ0b29sdGlwJz5cIiArIEFwcC5VdGlscy5jb250ZW50R2VuZXJhdG9yKCBvYmosIHRydWUgKSArIFwiPC9kaXY+XCIgXTtcblx0XHR9LFxuXG5cdFx0dXBkYXRlOiBmdW5jdGlvbigpIHtcblx0XHRcdFxuXHRcdFx0Ly9jb25zdHJ1Y3QgZGltZW5zaW9uIHN0cmluZ1xuXHRcdFx0dmFyIHRoYXQgPSB0aGlzLFxuXHRcdFx0XHRtYXBDb25maWcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwibWFwLWNvbmZpZ1wiICksXG5cdFx0XHRcdGNoYXJ0VGltZSA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10aW1lXCIgKSxcblx0XHRcdFx0dmFyaWFibGVJZCA9IG1hcENvbmZpZy52YXJpYWJsZUlkLFxuXHRcdFx0XHR0YXJnZXRZZWFyID0gbWFwQ29uZmlnLnRhcmdldFllYXIsXG5cdFx0XHRcdG1vZGUgPSBtYXBDb25maWcubW9kZSxcblx0XHRcdFx0dG9sZXJhbmNlID0gbWFwQ29uZmlnLnRpbWVUb2xlcmFuY2UsXG5cdFx0XHRcdGRpbWVuc2lvbnMgPSBbeyBuYW1lOiBcIk1hcFwiLCBwcm9wZXJ0eTogXCJtYXBcIiwgdmFyaWFibGVJZDogdmFyaWFibGVJZCwgdGFyZ2V0WWVhcjogdGFyZ2V0WWVhciwgbW9kZTogbW9kZSwgdG9sZXJhbmNlOiB0b2xlcmFuY2UgfV0sXG5cdFx0XHRcdGRpbWVuc2lvbnNTdHJpbmcgPSBKU09OLnN0cmluZ2lmeSggZGltZW5zaW9ucyApLFxuXHRcdFx0XHRjaGFydFR5cGUgPSA5OTk5LFxuXHRcdFx0XHRzZWxlY3RlZENvdW50cmllcyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiApLFxuXHRcdFx0XHRzZWxlY3RlZENvdW50cmllc0lkcyA9IF8ubWFwKCBzZWxlY3RlZENvdW50cmllcywgZnVuY3Rpb24oIHYgKSB7IHJldHVybiAodik/ICt2LmlkOiBcIlwiOyB9ICk7XG5cdFx0XHRcblx0XHRcdHZhciBkYXRhUHJvcHMgPSB7IFwiZGltZW5zaW9uc1wiOiBkaW1lbnNpb25zU3RyaW5nLCBcImNoYXJ0SWRcIjogQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImlkXCIgKSwgXCJjaGFydFR5cGVcIjogY2hhcnRUeXBlLCBcInNlbGVjdGVkQ291bnRyaWVzXCI6IHNlbGVjdGVkQ291bnRyaWVzSWRzLCBcImNoYXJ0VGltZVwiOiBjaGFydFRpbWUsIFwiY2FjaGVcIjogQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNhY2hlXCIgKSwgXCJncm91cEJ5VmFyaWFibGVzXCI6IEFwcC5DaGFydE1vZGVsLmdldCggXCJncm91cC1ieS12YXJpYWJsZXNcIiApICB9O1xuXHRcdFx0dGhpcy5tYXBEYXRhTW9kZWwuZmV0Y2goIHsgZGF0YTogZGF0YVByb3BzIH0gKTtcblxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdGRpc3BsYXlEYXRhOiBmdW5jdGlvbiggZGF0YSApIHtcblx0XHRcdFxuXHRcdFx0dmFyIHRoYXQgPSB0aGlzLFxuXHRcdFx0XHRtYXBDb25maWcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwibWFwLWNvbmZpZ1wiICksXG5cdFx0XHRcdGRhdGFNaW4gPSBJbmZpbml0eSxcblx0XHRcdFx0ZGF0YU1heCA9IC1JbmZpbml0eTtcblxuXHRcdFx0Ly9uZWVkIHRvIGV4dHJhY3QgbGF0ZXN0IHRpbWVcblx0XHRcdHZhciBsYXRlc3REYXRhID0gZGF0YS5tYXAoIGZ1bmN0aW9uKCBkLCBpICkge1xuXG5cdFx0XHRcdHZhciB2YWx1ZXMgPSBkLnZhbHVlcyxcblx0XHRcdFx0XHRsYXRlc3RUaW1lVmFsdWUgPSAoIHZhbHVlcyAmJiB2YWx1ZXMubGVuZ3RoICk/IHZhbHVlc1sgdmFsdWVzLmxlbmd0aCAtIDFdOiAwO1xuXG5cdFx0XHRcdC8vYWxzbyBnZXQgbWluIG1heCB2YWx1ZXMsIGNvdWxkIHVzZSBkMy5taW4sIGQzLm1heCBvbmNlIHdlIGhhdmUgYWxsIHZhbHVlcywgYnV0IHRoaXMgcHJvYmFibHkgc2F2ZXMgc29tZSB0aW1lXG5cdFx0XHRcdGRhdGFNaW4gPSBNYXRoLm1pbiggZGF0YU1pbiwgbGF0ZXN0VGltZVZhbHVlICk7XG5cdFx0XHRcdGRhdGFNYXggPSBNYXRoLm1heCggZGF0YU1heCwgbGF0ZXN0VGltZVZhbHVlICk7XG5cblx0XHRcdFx0Ly9pZHMgaW4gd29ybGQganNvbiBhcmUgbmFtZSBjb3VudHJpZXMgd2l0aCB1bmRlcnNjb3JlIChkYXRhbWFwcy5qcyB1c2VzIGlkIGZvciBzZWxlY3Rvciwgc28gY2Fubm90IGhhdmUgd2hpdGVzcGFjZSlcblx0XHRcdFx0cmV0dXJuIHsgXCJrZXlcIjogZC5rZXkucmVwbGFjZSggXCIgXCIsIFwiX1wiICksIFwidmFsdWVcIjogbGF0ZXN0VGltZVZhbHVlIH07XG5cblx0XHRcdH0gKTtcblxuXHRcdFx0dmFyIGNvbG9yU2NoZW1lID0gKCBjb2xvcmJyZXdlclsgbWFwQ29uZmlnLmNvbG9yU2NoZW1lTmFtZSBdICYmIGNvbG9yYnJld2VyWyBtYXBDb25maWcuY29sb3JTY2hlbWVOYW1lIF1bIG1hcENvbmZpZy5jb2xvclNjaGVtZUludGVydmFsIF0gKT8gY29sb3JicmV3ZXJbIG1hcENvbmZpZy5jb2xvclNjaGVtZU5hbWUgXVsgbWFwQ29uZmlnLmNvbG9yU2NoZW1lSW50ZXJ2YWwgXTogW107XG5cdFx0XHRcblx0XHRcdC8vbmVlZCB0byBjcmVhdGUgY29sb3Igc2NoZW1lXG5cdFx0XHR2YXIgY29sb3JTY2FsZSA9IGQzLnNjYWxlLnF1YW50aXplKClcblx0XHRcdFx0LmRvbWFpbiggWyBkYXRhTWluLCBkYXRhTWF4IF0gKVxuXHRcdFx0XHQucmFuZ2UoIGNvbG9yU2NoZW1lICk7XG5cblx0XHRcdC8vbmVlZCB0byBlbmNvZGUgY29sb3JzIHByb3BlcnRpZXNcblx0XHRcdHZhciBtYXBEYXRhID0ge30sXG5cdFx0XHRcdGNvbG9ycyA9IFtdO1xuXHRcdFx0bGF0ZXN0RGF0YS5mb3JFYWNoKCBmdW5jdGlvbiggZCwgaSApIHtcblx0XHRcdFx0dmFyIGNvbG9yID0gY29sb3JTY2FsZSggZC52YWx1ZSApO1xuXHRcdFx0XHRtYXBEYXRhWyBkLmtleSBdID0geyBcImtleVwiOiBkLmtleSwgXCJ2YWx1ZVwiOiBkLnZhbHVlLCBcImNvbG9yXCI6IGNvbG9yIH07XG5cdFx0XHRcdGNvbG9ycy5wdXNoKCBjb2xvciApO1xuXHRcdFx0fSApO1xuXG5cdFx0XHR0aGlzLmxlZ2VuZC5zY2FsZSggY29sb3JTY2FsZSApO1xuXHRcdFx0aWYoIGQzLnNlbGVjdCggXCIubGVnZW5kLXdyYXBwZXJcIiApLmVtcHR5KCkgKSB7XG5cdFx0XHRcdGQzLnNlbGVjdCggXCIuZGF0YW1hcFwiICkuYXBwZW5kKCBcImdcIiApLmF0dHIoIFwiY2xhc3NcIiwgXCJsZWdlbmQtd3JhcHBlclwiICk7XG5cdFx0XHR9XG5cdFx0XHRkMy5zZWxlY3QoIFwiLmxlZ2VuZC13cmFwcGVyXCIgKS5kYXR1bSggY29sb3JTY2hlbWUgKS5jYWxsKCB0aGlzLmxlZ2VuZCApO1xuXHRcdFx0Ly9kMy5zZWxlY3QoIFwiLmRhdGFtYXBcIiApLmRhdHVtKCBjb2xvclNjaGVtZSApLmNhbGwoIHRoaXMubGVnZW5kICk7XG5cblx0XHRcdC8vdXBkYXRlIG1hcFxuXHRcdFx0Ly9hcmUgd2UgY2hhbmdpbmcgcHJvamVjdGlvbnM/XG5cdFx0XHR2YXIgb2xkUHJvamVjdGlvbiA9IHRoaXMuZGF0YU1hcC5vcHRpb25zLnNldFByb2plY3Rpb24sXG5cdFx0XHRcdG5ld1Byb2plY3Rpb24gPSB0aGlzLmdldFByb2plY3Rpb24oIG1hcENvbmZpZy5wcm9qZWN0aW9uICk7XG5cdFx0XHRpZiggb2xkUHJvamVjdGlvbiA9PT0gbmV3UHJvamVjdGlvbiApIHtcblx0XHRcdFx0Ly9wcm9qZWN0aW9uIHN0YXlzIHRoZSBzYW1lLCBubyBuZWVkIHRvIHJlZHJhdyB1bml0c1xuXHRcdFx0XHQvL25lZWQgdG8gc2V0IGFsbCB1bml0cyB0byBkZWZhdWx0IGNvbG9yIGZpcnN0LCBjYXVzZSB1cGRhdGVDaG9wbGV0aCBqdXN0IHVwZGF0ZXMgbmV3IGRhdGEgbGVhdmVzIHRoZSBvbGQgZGF0YSBmb3IgdW5pdHMgbm8gbG9uZ2VyIGluIGRhdGFzZXRcblx0XHRcdFx0ZDMuc2VsZWN0QWxsKCBcInBhdGguZGF0YW1hcHMtc3VidW5pdFwiICkuc3R5bGUoIFwiZmlsbFwiLCB0aGlzLmRhdGFNYXAub3B0aW9ucy5maWxscy5kZWZhdWx0RmlsbCApO1xuXHRcdFx0XHR0aGlzLmRhdGFNYXAudXBkYXRlQ2hvcm9wbGV0aCggbWFwRGF0YSApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly9jaGFuZ2luZyBwcm9qZWN0aW9uLCBuZWVkIHRvIHJlbW92ZSBleGlzdGluZyB1bml0cywgcmVkcmF3IGV2ZXJ5dGhpbmcgYW5kIGFmdGVyIGRvbmUgZHJhd2luZywgdXBkYXRlIGRhdGFcblx0XHRcdFx0ZDMuc2VsZWN0QWxsKCdwYXRoLmRhdGFtYXBzLXN1YnVuaXQnKS5yZW1vdmUoKTtcblx0XHRcdFx0dGhpcy5kYXRhTWFwLm9wdGlvbnMuc2V0UHJvamVjdGlvbiA9IG5ld1Byb2plY3Rpb247XG5cdFx0XHRcdHRoaXMuZGF0YU1hcC5kcmF3KCk7XG5cdFx0XHRcdHRoaXMuZGF0YU1hcC5vcHRpb25zLmRvbmUgPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHR0aGF0LmRhdGFNYXAudXBkYXRlQ2hvcm9wbGV0aCggbWFwRGF0YSApO1xuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0fSxcblxuXHRcdGdldFByb2plY3Rpb246IGZ1bmN0aW9uKCBwcm9qZWN0aW9uTmFtZSApIHtcblxuXHRcdFx0dmFyIHByb2plY3Rpb25zID0gQXBwLlZpZXdzLkNoYXJ0Lk1hcFRhYi5wcm9qZWN0aW9ucyxcblx0XHRcdFx0bmV3UHJvamVjdGlvbiA9ICggcHJvamVjdGlvbnNbIHByb2plY3Rpb25OYW1lIF0gKT8gcHJvamVjdGlvbnNbIHByb2plY3Rpb25OYW1lIF06IHByb2plY3Rpb25zLldvcmxkO1xuXHRcdFx0cmV0dXJuIG5ld1Byb2plY3Rpb247XG5cdFx0XHRcblx0XHR9LFxuXG5cdFx0b25SZXNpemU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYoIHRoaXMuZGF0YU1hcCApIHtcblx0XHRcdFx0Ly9pbnN0ZWFkIG9mIGNhbGxpbmcgZGF0YW1hcHMgcmVzaXplLCB0aGVyZSdzIG1vZGlmaWVkIHZlcnNpb24gb2YgdGhlIHNhbWUgbWV0aG9kXG5cdFx0XHRcdHZhciBvcHRpb25zID0gdGhpcy5kYXRhTWFwLm9wdGlvbnMsXG5cdFx0XHRcdFx0cHJlZml4ID0gJy13ZWJraXQtdHJhbnNmb3JtJyBpbiBkb2N1bWVudC5ib2R5LnN0eWxlID8gJy13ZWJraXQtJyA6ICctbW96LXRyYW5zZm9ybScgaW4gZG9jdW1lbnQuYm9keS5zdHlsZSA/ICctbW96LScgOiAnLW1zLXRyYW5zZm9ybScgaW4gZG9jdW1lbnQuYm9keS5zdHlsZSA/ICctbXMtJyA6ICcnLFxuXHRcdFx0XHRcdG5ld3NpemUgPSBvcHRpb25zLmVsZW1lbnQuY2xpZW50V2lkdGgsXG5cdFx0XHRcdFx0b2xkc2l6ZSA9IGQzLnNlbGVjdCggb3B0aW9ucy5lbGVtZW50KS5zZWxlY3QoJ3N2ZycpLmF0dHIoJ2RhdGEtd2lkdGgnKTtcblx0XHRcdFx0XHQvL2RpZmZlcmVudCBzZWxlY3RvciBmcm9tIGRlZmF1bHQgZGF0YW1hcHMgaW1wbGVtZW50YXRpb24sIGRvZXNuJ3Qgc2NhbGUgbGVnZW5kXG5cdFx0XHRcdFx0ZDMuc2VsZWN0KG9wdGlvbnMuZWxlbWVudCkuc2VsZWN0KCdzdmcnKS5zZWxlY3RBbGwoJ2c6bm90KC5sZWdlbmQtc3RlcCk6bm90KC5sZWdlbmQpJykuc3R5bGUocHJlZml4ICsgJ3RyYW5zZm9ybScsICdzY2FsZSgnICsgKG5ld3NpemUgLyBvbGRzaXplKSArICcpJyk7XG5cdFx0XHRcdC8vdGhpcy5kYXRhTWFwLnJlc2l6ZSgpO1xuXHRcdFx0fVxuXHRcdH0sXG5cblx0XHRvbkNoYXJ0TW9kZWxSZXNpemU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5vblJlc2l6ZSgpO1xuXHRcdH1cblxuXHR9KTtcblxuXHRBcHAuVmlld3MuQ2hhcnQuTWFwVGFiLnByb2plY3Rpb25zID0ge1xuXHRcdFxuXHRcdFwiV29ybGRcIjogZnVuY3Rpb24oZWxlbWVudCkge1xuXHRcdFx0Ly9lbXBpcmljXG5cdFx0XHR2YXIgayA9IDY7XG5cdFx0XHR2YXIgcHJvamVjdGlvbiA9IGQzLmdlby5lY2tlcnQzKClcblx0XHRcdFx0LnNjYWxlKGVsZW1lbnQub2Zmc2V0V2lkdGgvaylcblx0XHRcdFx0LnRyYW5zbGF0ZShbZWxlbWVudC5vZmZzZXRXaWR0aCAvIDIsIGVsZW1lbnQub2Zmc2V0SGVpZ2h0IC8gMl0pXG5cdFx0XHRcdC5wcmVjaXNpb24oLjEpO1xuXHRcdFx0dmFyIHBhdGggPSBkMy5nZW8ucGF0aCgpLnByb2plY3Rpb24ocHJvamVjdGlvbik7XG5cdFx0XHRyZXR1cm4ge3BhdGg6IHBhdGgsIHByb2plY3Rpb246IHByb2plY3Rpb259O1xuXHRcdH0sXG5cdFx0LypcIldvcmxkXCI6IGZ1bmN0aW9uKGVsZW1lbnQpIHtcblx0XHRcdHZhciBwcm9qZWN0aW9uID0gZDMuZ2VvLmVxdWlyZWN0YW5ndWxhcigpXG5cdFx0XHRcdC5zY2FsZSgoZWxlbWVudC5vZmZzZXRXaWR0aCArIDEpIC8gMiAvIE1hdGguUEkpXG5cdFx0XHRcdC50cmFuc2xhdGUoW2VsZW1lbnQub2Zmc2V0V2lkdGggLyAyLCBlbGVtZW50Lm9mZnNldEhlaWdodCAvIDEuOF0pO1xuXHRcdFx0dmFyIHBhdGggPSBkMy5nZW8ucGF0aCgpLnByb2plY3Rpb24ocHJvamVjdGlvbik7XG5cdFx0XHRyZXR1cm4ge3BhdGg6IHBhdGgsIHByb2plY3Rpb246IHByb2plY3Rpb259O1xuXHRcdH0sKi9cblx0XHRcIkFmcmljYVwiOiBmdW5jdGlvbihlbGVtZW50KSB7XG5cdFx0XHQvL2VtcGlyaWNcblx0XHRcdHZhciBrID0gMztcblx0XHRcdHZhciBwcm9qZWN0aW9uID0gZDMuZ2VvLmNvbmljQ29uZm9ybWFsKClcblx0XHRcdFx0LnJvdGF0ZShbLTI1LCAwXSlcblx0XHRcdFx0LmNlbnRlcihbMCwgMF0pXG5cdFx0XHRcdC5wYXJhbGxlbHMoWzMwLCAtMjBdKVxuXHRcdFx0XHQuc2NhbGUoZWxlbWVudC5vZmZzZXRXaWR0aC9rKVxuXHRcdFx0XHQudHJhbnNsYXRlKFtlbGVtZW50Lm9mZnNldFdpZHRoIC8gMiwgZWxlbWVudC5vZmZzZXRIZWlnaHQgLyAyXSk7XG5cdFx0XHR2YXIgcGF0aCA9IGQzLmdlby5wYXRoKCkucHJvamVjdGlvbihwcm9qZWN0aW9uKTtcblx0XHRcdHJldHVybiB7cGF0aDogcGF0aCwgcHJvamVjdGlvbjogcHJvamVjdGlvbn07XG5cdFx0fSxcblx0XHRcIk4uQW1lcmljYVwiOiBmdW5jdGlvbihlbGVtZW50KSB7XG5cdFx0XHQvL2VtcGlyaWNcblx0XHRcdHZhciBrID0gMztcblx0XHRcdHZhciBwcm9qZWN0aW9uID0gZDMuZ2VvLmNvbmljQ29uZm9ybWFsKClcblx0XHRcdFx0LnJvdGF0ZShbOTgsIDBdKVxuXHRcdFx0XHQuY2VudGVyKFswLCAzOF0pXG5cdFx0XHRcdC5wYXJhbGxlbHMoWzI5LjUsIDQ1LjVdKVxuXHRcdFx0XHQuc2NhbGUoZWxlbWVudC5vZmZzZXRXaWR0aC9rKVxuXHRcdFx0XHQudHJhbnNsYXRlKFtlbGVtZW50Lm9mZnNldFdpZHRoIC8gMiwgZWxlbWVudC5vZmZzZXRIZWlnaHQgLyAyXSk7XG5cdFx0XHR2YXIgcGF0aCA9IGQzLmdlby5wYXRoKCkucHJvamVjdGlvbihwcm9qZWN0aW9uKTtcblx0XHRcdHJldHVybiB7cGF0aDogcGF0aCwgcHJvamVjdGlvbjogcHJvamVjdGlvbn07XG5cdFx0fSxcblx0XHRcIlMuQW1lcmljYVwiOiBmdW5jdGlvbihlbGVtZW50KSB7XG5cdFx0XHQvL2VtcGlyaWNcblx0XHRcdHZhciBrID0gMy40O1xuXHRcdFx0dmFyIHByb2plY3Rpb24gPSBkMy5nZW8uY29uaWNDb25mb3JtYWwoKVxuXHRcdFx0XHQucm90YXRlKFs2OCwgMF0pXG5cdFx0XHRcdC5jZW50ZXIoWzAsIC0xNF0pXG5cdFx0XHRcdC5wYXJhbGxlbHMoWzEwLCAtMzBdKVxuXHRcdFx0XHQuc2NhbGUoZWxlbWVudC5vZmZzZXRXaWR0aC9rKVxuXHRcdFx0XHQudHJhbnNsYXRlKFtlbGVtZW50Lm9mZnNldFdpZHRoIC8gMiwgZWxlbWVudC5vZmZzZXRIZWlnaHQgLyAyXSk7XG5cdFx0XHR2YXIgcGF0aCA9IGQzLmdlby5wYXRoKCkucHJvamVjdGlvbihwcm9qZWN0aW9uKTtcblx0XHRcdHJldHVybiB7cGF0aDogcGF0aCwgcHJvamVjdGlvbjogcHJvamVjdGlvbn07XG5cdFx0fSxcblx0XHRcIkFzaWFcIjogZnVuY3Rpb24oZWxlbWVudCkge1xuXHRcdFx0Ly9lbXBpcmljXG5cdFx0XHR2YXIgayA9IDM7XG5cdFx0XHR2YXIgcHJvamVjdGlvbiA9IGQzLmdlby5jb25pY0NvbmZvcm1hbCgpXG5cdFx0XHRcdC5yb3RhdGUoWy0xMDUsIDBdKVxuXHRcdFx0XHQuY2VudGVyKFswLCAzN10pXG5cdFx0XHRcdC5wYXJhbGxlbHMoWzEwLCA2MF0pXG5cdFx0XHRcdC5zY2FsZShlbGVtZW50Lm9mZnNldFdpZHRoL2spXG5cdFx0XHRcdC50cmFuc2xhdGUoW2VsZW1lbnQub2Zmc2V0V2lkdGggLyAyLCBlbGVtZW50Lm9mZnNldEhlaWdodCAvIDJdKTtcblx0XHRcdHZhciBwYXRoID0gZDMuZ2VvLnBhdGgoKS5wcm9qZWN0aW9uKHByb2plY3Rpb24pO1xuXHRcdFx0cmV0dXJuIHtwYXRoOiBwYXRoLCBwcm9qZWN0aW9uOiBwcm9qZWN0aW9ufTtcblx0XHR9LFxuXHRcdFwiRXVyb3BlXCI6IGZ1bmN0aW9uKGVsZW1lbnQpIHtcblx0XHRcdC8vZW1waXJpY1xuXHRcdFx0dmFyIGsgPSAxLjU7XG5cdFx0XHR2YXIgcHJvamVjdGlvbiA9IGQzLmdlby5jb25pY0NvbmZvcm1hbCgpXG5cdFx0XHRcdC5yb3RhdGUoWy0xNSwgMF0pXG5cdFx0XHRcdC5jZW50ZXIoWzAsIDU1XSlcblx0XHRcdFx0LnBhcmFsbGVscyhbNjAsIDQwXSlcblx0XHRcdFx0LnNjYWxlKGVsZW1lbnQub2Zmc2V0V2lkdGgvaylcblx0XHRcdFx0LnRyYW5zbGF0ZShbZWxlbWVudC5vZmZzZXRXaWR0aCAvIDIsIGVsZW1lbnQub2Zmc2V0SGVpZ2h0IC8gMl0pO1xuXHRcdFx0dmFyIHBhdGggPSBkMy5nZW8ucGF0aCgpLnByb2plY3Rpb24ocHJvamVjdGlvbik7XG5cdFx0XHRyZXR1cm4ge3BhdGg6IHBhdGgsIHByb2plY3Rpb246IHByb2plY3Rpb259O1xuXHRcdH0sXG5cdFx0XCJBdXN0cmFsaWFcIjogZnVuY3Rpb24oZWxlbWVudCkge1xuXHRcdFx0Ly9lbXBpcmljXG5cdFx0XHR2YXIgayA9IDM7XG5cdFx0XHR2YXIgcHJvamVjdGlvbiA9IGQzLmdlby5jb25pY0NvbmZvcm1hbCgpXG5cdFx0XHRcdC5yb3RhdGUoWy0xMzUsIDBdKVxuXHRcdFx0XHQuY2VudGVyKFswLCAtMjBdKVxuXHRcdFx0XHQucGFyYWxsZWxzKFstMTAsIC0zMF0pXG5cdFx0XHRcdC5zY2FsZShlbGVtZW50Lm9mZnNldFdpZHRoL2spXG5cdFx0XHRcdC50cmFuc2xhdGUoW2VsZW1lbnQub2Zmc2V0V2lkdGggLyAyLCBlbGVtZW50Lm9mZnNldEhlaWdodCAvIDJdKTtcblx0XHRcdHZhciBwYXRoID0gZDMuZ2VvLnBhdGgoKS5wcm9qZWN0aW9uKHByb2plY3Rpb24pO1xuXHRcdFx0cmV0dXJuIHtwYXRoOiBwYXRoLCBwcm9qZWN0aW9uOiBwcm9qZWN0aW9ufTtcblx0XHR9XG5cblx0fTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5DaGFydC5NYXBUYWI7XG5cbn0pKCk7XG5cbihmdW5jdGlvbigpIHtcblx0dmFyIM61ID0gMWUtNiwgzrUyID0gzrUgKiDOtSwgz4AgPSBNYXRoLlBJLCBoYWxmz4AgPSDPgCAvIDIsIHNxcnTPgCA9IE1hdGguc3FydCjPgCksIHJhZGlhbnMgPSDPgCAvIDE4MCwgZGVncmVlcyA9IDE4MCAvIM+AO1xuXHRmdW5jdGlvbiBzaW5jaSh4KSB7XG5cdFx0cmV0dXJuIHggPyB4IC8gTWF0aC5zaW4oeCkgOiAxO1xuXHR9XG5cdGZ1bmN0aW9uIHNnbih4KSB7XG5cdFx0cmV0dXJuIHggPiAwID8gMSA6IHggPCAwID8gLTEgOiAwO1xuXHR9XG5cdGZ1bmN0aW9uIGFzaW4oeCkge1xuXHRcdHJldHVybiB4ID4gMSA/IGhhbGbPgCA6IHggPCAtMSA/IC1oYWxmz4AgOiBNYXRoLmFzaW4oeCk7XG5cdH1cblx0ZnVuY3Rpb24gYWNvcyh4KSB7XG5cdFx0cmV0dXJuIHggPiAxID8gMCA6IHggPCAtMSA/IM+AIDogTWF0aC5hY29zKHgpO1xuXHR9XG5cdGZ1bmN0aW9uIGFzcXJ0KHgpIHtcblx0XHRyZXR1cm4geCA+IDAgPyBNYXRoLnNxcnQoeCkgOiAwO1xuXHR9XG5cdHZhciBwcm9qZWN0aW9uID0gZDMuZ2VvLnByb2plY3Rpb247XG4gXG5cdGZ1bmN0aW9uIGVja2VydDMozrssIM+GKSB7XG5cdFx0dmFyIGsgPSBNYXRoLnNxcnQoz4AgKiAoNCArIM+AKSk7XG5cdFx0cmV0dXJuIFsgMiAvIGsgKiDOuyAqICgxICsgTWF0aC5zcXJ0KDEgLSA0ICogz4YgKiDPhiAvICjPgCAqIM+AKSkpLCA0IC8gayAqIM+GIF07XG5cdH1cblx0ZWNrZXJ0My5pbnZlcnQgPSBmdW5jdGlvbih4LCB5KSB7XG5cdFx0dmFyIGsgPSBNYXRoLnNxcnQoz4AgKiAoNCArIM+AKSkgLyAyO1xuXHRcdHJldHVybiBbIHggKiBrIC8gKDEgKyBhc3FydCgxIC0geSAqIHkgKiAoNCArIM+AKSAvICg0ICogz4ApKSksIHkgKiBrIC8gMiBdO1xuXHR9O1xuXHQoZDMuZ2VvLmVja2VydDMgPSBmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4gcHJvamVjdGlvbihlY2tlcnQzKTtcblx0fSkucmF3ID0gZWNrZXJ0Mztcblx0XG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0QXBwLlZpZXdzLkNoYXJ0LlNjYWxlU2VsZWN0b3JzID0gQmFja2JvbmUuVmlldy5leHRlbmQoe1xuXG5cdFx0ZWw6IFwiI2NoYXJ0LXZpZXcgLmF4aXMtc2NhbGUtc2VsZWN0b3JzLXdyYXBwZXJcIixcblx0XHRldmVudHM6IHtcblx0XHRcdFwiY2xpY2sgLmF4aXMtc2NhbGUtYnRuXCI6IFwib25BeGlzU2NhbGVCdG5cIixcblx0XHRcdFwiY2hhbmdlIC5heGlzLXNjYWxlIGxpXCI6IFwib25BeGlzU2NhbGVDaGFuZ2VcIlxuXHRcdH0sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdFxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gb3B0aW9ucy5kaXNwYXRjaGVyO1xuXHRcdFx0XG5cdFx0XHR0aGlzLiR0YWJzID0gdGhpcy4kZWwuZmluZCggXCIuaGVhZGVyLXRhYlwiICk7XG5cdFx0XHRcblx0XHRcdHRoaXMuJHhBeGlzU2NhbGUgPSB0aGlzLiRlbC5maW5kKCBcIltkYXRhLW5hbWU9J3gtYXhpcy1zY2FsZSddXCIgKTtcblx0XHRcdHRoaXMuJHlBeGlzU2NhbGUgPSB0aGlzLiRlbC5maW5kKCBcIltkYXRhLW5hbWU9J3ktYXhpcy1zY2FsZSddXCIgKTtcblxuXHRcdFx0dGhpcy5pbml0RHJvcERvd24oIHRoaXMuJHhBeGlzU2NhbGUgKTtcblx0XHRcdHRoaXMuaW5pdERyb3BEb3duKCB0aGlzLiR5QXhpc1NjYWxlICk7XG5cblx0XHRcdHRoaXMucmVuZGVyKCk7XG5cblx0XHRcdC8vc2V0dXAgZXZlbnRzXG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5vbiggXCJjaGFuZ2VcIiwgdGhpcy5yZW5kZXIsIHRoaXMgKTtcblxuXHRcdH0sXG5cblx0XHQvKmluaXRFdmVudHM6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy4kY2hhcnRWaWV3ID0gJCggXCIjY2hhcnQtdmlld1wiICk7XG5cdFx0XHR0aGlzLiR3cmFwID0gdGhpcy4kY2hhcnRWaWV3LmZpbmQoIFwic3ZnID4gLm52LXdyYXBcIiApO1xuXHRcdFx0XG5cdFx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0XHR0aGlzLiR3cmFwLm9uKCBcIm1vdXNlb3ZlclwiLCBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0XHR0aGF0LiRjaGFydFZpZXcuYWRkQ2xhc3MoIFwiY2hhcnQtaG92ZXJlZFwiICk7XG5cdFx0XHR9ICk7XG5cdFx0XHR0aGlzLiR3cmFwLm9uKCBcIm1vdXNlb3V0XCIsIGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKCBldnQuY3VycmVudFRhcmdldCApO1xuXHRcdFx0XHR0aGF0LiRjaGFydFZpZXcucmVtb3ZlQ2xhc3MoIFwiY2hhcnQtaG92ZXJlZFwiICk7XG5cdFx0XHR9ICk7XG5cdFx0fSwqL1xuXG5cdFx0aW5pdERyb3BEb3duOiBmdW5jdGlvbiggJGVsICkge1xuXG5cdFx0XHR2YXIgJGxpc3QgPSAkZWwuZmluZCggXCJ1bFwiICksXG5cdFx0XHRcdCRpdGVtcyA9ICRsaXN0LmZpbmQoIFwibGlcIiApO1xuXG5cdFx0XHQkaXRlbXMub24oIFwiY2xpY2tcIiwgZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdFx0dmFyICR0aGlzID0gJCggdGhpcyApLFxuXHRcdFx0XHRcdHZhbHVlID0gJHRoaXMuYXR0ciggXCJkYXRhLXZhbHVlXCIgKTtcblx0XHRcdFx0JGl0ZW1zLnJlbW92ZUNsYXNzKCBcInNlbGVjdGVkXCIgKTtcblx0XHRcdFx0JHRoaXMuYWRkQ2xhc3MoIFwic2VsZWN0ZWRcIiApO1xuXHRcdFx0XHQkdGhpcy50cmlnZ2VyKCBcImNoYW5nZVwiICk7XG5cdFx0XHR9ICk7XG5cblx0XHR9LFxuXG5cdFx0b25BeGlzU2NhbGVDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdHZhciAkbGkgPSAkKCBldnQuY3VycmVudFRhcmdldCApLFxuXHRcdFx0XHQkcGFyZW50ID0gJGxpLnBhcmVudCgpLnBhcmVudCgpLnBhcmVudCgpLFxuXHRcdFx0XHQkZGl2ID0gJHBhcmVudC5maW5kKCBcImRpdlwiICksXG5cdFx0XHRcdCRidG4gPSAkcGFyZW50LmZpbmQoIFwiLmF4aXMtc2NhbGUtYnRuXCIgKSxcblx0XHRcdFx0JHNlbGVjdCA9ICRwYXJlbnQuZmluZCggXCIuYXhpcy1zY2FsZVwiICksXG5cdFx0XHRcdG5hbWUgPSAkZGl2LmF0dHIoIFwiZGF0YS1uYW1lXCIgKSxcblx0XHRcdFx0YXhpc05hbWUgPSAoIG5hbWUgPT09IFwieC1heGlzLXNjYWxlXCIgKT8gXCJ4LWF4aXNcIjogXCJ5LWF4aXNcIixcblx0XHRcdFx0YXhpc1Byb3AgPSBcImF4aXMtc2NhbGVcIixcblx0XHRcdFx0dmFsdWUgPSAkbGkuYXR0ciggXCJkYXRhLXZhbHVlXCIgKTtcblxuXHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0QXhpc0NvbmZpZyggYXhpc05hbWUsIGF4aXNQcm9wLCB2YWx1ZSApO1xuXHRcdFx0XG5cdFx0XHQkc2VsZWN0LmhpZGUoKTtcblx0XHRcdC8vJGJ0bi5zaG93KCk7XG5cblx0XHR9LFxuXG5cdFx0b25BeGlzU2NhbGVCdG46IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHRcblx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0dmFyICRidG4gPSAkKCBldnQuY3VycmVudFRhcmdldCApLFxuXHRcdFx0XHQkcGFyZW50ID0gJGJ0bi5wYXJlbnQoKSxcblx0XHRcdFx0JHNlbGVjdCA9ICRwYXJlbnQuZmluZCggXCIuYXhpcy1zY2FsZVwiICk7XG5cblx0XHRcdCRzZWxlY3Quc2hvdygpO1xuXHRcdFx0Ly8kYnRuLmhpZGUoKTtcblxuXHRcdH1cblxuXHR9KTtcblx0XG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkNoYXJ0LlNjYWxlU2VsZWN0b3JzO1xuXHRcbn0pKCk7XG4iLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdEFwcC5WaWV3cy5DaGFydC5Tb3VyY2VzVGFiID0gQmFja2JvbmUuVmlldy5leHRlbmQoIHtcblxuXHRcdGVsOiBcIiNjaGFydC12aWV3XCIsXG5cdFx0ZXZlbnRzOiB7fSxcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0XG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIgPSBvcHRpb25zLmRpc3BhdGNoZXI7XG5cblx0XHRcdHRoaXMuJGNoYXJ0RGVzY3JpcHRpb24gPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1kZXNjcmlwdGlvblwiICk7XG5cdFx0XHR0aGlzLiRjaGFydFNvdXJjZXMgPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1zb3VyY2VzXCIgKTtcblx0XHRcdHRoaXMuJHNvdXJjZXNUYWIgPSB0aGlzLiRlbC5maW5kKCBcIiNzb3VyY2VzLWNoYXJ0LXRhYlwiICk7XG5cblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbiggcmVzcG9uc2UgKSB7XG5cblx0XHRcdGlmKCAhcmVzcG9uc2UgfHwgIXJlc3BvbnNlLmRhdGFzb3VyY2VzICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdHZhciBzb3VyY2VzID0gcmVzcG9uc2UuZGF0YXNvdXJjZXMsXG5cdFx0XHRcdGxpY2Vuc2UgPSByZXNwb25zZS5saWNlbnNlLFxuXHRcdFx0XHRmb290ZXJIdG1sID0gXCJcIixcblx0XHRcdFx0dGFiSHRtbCA9IFwiXCIsXG5cdFx0XHRcdGRlc2NyaXB0aW9uSHRtbCA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC1kZXNjcmlwdGlvblwiICksXG5cdFx0XHRcdHNvdXJjZXNTaG9ydEh0bWwgPSBcIkRhdGEgb2J0YWluZWQgZnJvbTogXCIsXG5cdFx0XHRcdHNvdXJjZXNMb25nSHRtbCA9IFwiXCIsXG5cdFx0XHRcdC8vY2hlY2sgdGhhdCB3ZSdyZSBub3QgYWRkaW5nIHNvdXJjZXMgd2l0aCB0aGUgc2FtZSBuYW1lIG1vcmUgdGltZXNcblx0XHRcdFx0c291cmNlc0J5TmFtZSA9IFtdO1xuXHRcdFx0XHRcblx0XHRcdC8vY29uc3RydWN0IHNvdXJjZSBodG1sXG5cdFx0XHRfLmVhY2goIHNvdXJjZXMsIGZ1bmN0aW9uKCBzb3VyY2VEYXRhLCBzb3VyY2VJbmRleCApIHtcblx0XHRcdFx0Ly9tYWtlIHN1cmUgd2UgZG9uJ3QgaGF2ZSBzb3VyY2Ugd2l0aCB0aGUgc2FtZSBuYW1lIGluIHRoZSBzaG9ydCBkZXNjcmlwdGlvbiBhbHJlYWR5XG5cdFx0XHRcdGlmKCAhc291cmNlc0J5TmFtZVsgc291cmNlRGF0YS5uYW1lIF0gKSB7XG5cdFx0XHRcdFx0aWYoIHNvdXJjZUluZGV4ID4gMCApIHtcblx0XHRcdFx0XHRcdHNvdXJjZXNTaG9ydEh0bWwgKz0gXCIsIFwiO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiggc291cmNlRGF0YS5saW5rICkge1xuXHRcdFx0XHRcdFx0c291cmNlc1Nob3J0SHRtbCArPSBcIjxhIGhyZWY9J1wiICsgc291cmNlRGF0YS5saW5rICsgXCInIHRhcmdldD0nX2JsYW5rJz5cIiArIHNvdXJjZURhdGEubmFtZSArIFwiPC9hPlwiO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRzb3VyY2VzU2hvcnRIdG1sICs9IHNvdXJjZURhdGEubmFtZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0c291cmNlc0J5TmFtZVsgc291cmNlRGF0YS5uYW1lIF0gPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdFxuXHRcdFx0XHQvL3NvdXJjZXMgbm93IGNvbnRhaW4gaHRtbCwgc28gbm8gbmVlZCB0byBzZXBhcmF0ZSB3aXRoIGNvbW1hXG5cdFx0XHRcdC8qaWYoIHNvdXJjZUluZGV4ID4gMCAmJiBzb3VyY2VzTG9uZ0h0bWwgIT09IFwiXCIgJiYgc291cmNlRGF0YS5kZXNjcmlwdGlvbiAhPT0gXCJcIiApIHtcblx0XHRcdFx0XHRzb3VyY2VzTG9uZ0h0bWwgKz0gXCIsIFwiO1xuXHRcdFx0XHR9Ki9cblx0XHRcdFx0c291cmNlc0xvbmdIdG1sICs9IHNvdXJjZURhdGEuZGVzY3JpcHRpb247XG5cdFx0XHRcblx0XHRcdH0gKTtcblxuXHRcdFx0Zm9vdGVySHRtbCA9IGRlc2NyaXB0aW9uSHRtbDtcblx0XHRcdHRhYkh0bWwgPSBkZXNjcmlwdGlvbkh0bWwgKyBcIjxiciAvPjxiciAvPlwiICsgc291cmNlc0xvbmdIdG1sO1xuXHRcdFx0XG5cdFx0XHQvL2FkZCBsaWNlbnNlIGluZm9cblx0XHRcdGlmKCBsaWNlbnNlICYmIGxpY2Vuc2UuZGVzY3JpcHRpb24gKSB7XG5cdFx0XHRcdGZvb3Rlckh0bWwgPSBsaWNlbnNlLmRlc2NyaXB0aW9uICsgXCIgXCIgKyBmb290ZXJIdG1sO1xuXHRcdFx0XHR0YWJIdG1sID0gbGljZW5zZS5kZXNjcmlwdGlvbiArIFwiIFwiICsgdGFiSHRtbDtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0Ly9hcHBlbmQgdG8gRE9NXG5cdFx0XHR0aGlzLiRjaGFydERlc2NyaXB0aW9uLmh0bWwoIGZvb3Rlckh0bWwgKTtcblx0XHRcdHRoaXMuJGNoYXJ0U291cmNlcy5odG1sKCBzb3VyY2VzU2hvcnRIdG1sICk7XG5cdFx0XHR0aGlzLiRzb3VyY2VzVGFiLmh0bWwoIHRhYkh0bWwgKTtcblxuXHRcdH1cblxuXHR9ICk7XG5cdFxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5DaGFydC5Tb3VyY2VzVGFiO1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0QXBwLlZpZXdzLkNoYXJ0Lk1hcC5NYXBDb250cm9scyA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblxuXHRcdGVsOiBcIiNtYXAtY2hhcnQtdGFiIC5tYXAtY29udHJvbHMtaGVhZGVyXCIsXG5cdFx0ZXZlbnRzOiB7XG5cdFx0XHRcImlucHV0IC50YXJnZXQteWVhci1jb250cm9sIGlucHV0XCI6IFwib25UYXJnZXRZZWFySW5wdXRcIixcblx0XHRcdFwiY2hhbmdlIC50YXJnZXQteWVhci1jb250cm9sIGlucHV0XCI6IFwib25UYXJnZXRZZWFyQ2hhbmdlXCIsXG5cdFx0XHRcImNsaWNrIC5yZWdpb24tY29udHJvbCBsaVwiOiBcIm9uUmVnaW9uQ2xpY2tcIixcblx0XHRcdFwiY2xpY2sgLnNldHRpbmdzLWNvbnRyb2wgaW5wdXRcIjogXCJvblNldHRpbmdzSW5wdXRcIixcblx0XHR9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cblx0XHRcdHRoaXMuZGlzcGF0Y2hlciA9IG9wdGlvbnMuZGlzcGF0Y2hlcjtcblxuXHRcdFx0dmFyIG1hcENvbmZpZyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJtYXAtY29uZmlnXCIgKTtcblx0XHRcdFxuXHRcdFx0Ly95ZWFyIHNsaWRlclxuXHRcdFx0dGhpcy4kdGFyZ2V0WWVhckNvbnRyb2wgPSB0aGlzLiRlbC5maW5kKCBcIi50YXJnZXQteWVhci1jb250cm9sXCIgKTtcblx0XHRcdHRoaXMuJHRhcmdldFllYXJMYWJlbCA9IHRoaXMuJHRhcmdldFllYXJDb250cm9sLmZpbmQoIFwiLnRhcmdldC15ZWFyLWxhYmVsXCIgKTtcblx0XHRcdHRoaXMuJHRhcmdldFllYXJJbnB1dCA9IHRoaXMuJHRhcmdldFllYXJDb250cm9sLmZpbmQoIFwiaW5wdXRcIiApO1xuXHRcdFx0XG5cdFx0XHQvL3JlZ2lvbiBzZWxlY3RvclxuXHRcdFx0dGhpcy4kcmVnaW9uQ29udHJvbCA9IHRoaXMuJGVsLmZpbmQoIFwiLnJlZ2lvbi1jb250cm9sXCIgKTtcblx0XHRcdHRoaXMuJHJlZ2lvbkNvbnRyb2xMYWJlbCA9IHRoaXMuJHJlZ2lvbkNvbnRyb2wuZmluZCggXCIucmVnaW9uLWxhYmVsXCIgKTtcblx0XHRcdHRoaXMuJHJlZ2lvbkNvbnRyb2xMaXMgPSB0aGlzLiRyZWdpb25Db250cm9sLmZpbmQoIFwibGlcIiApO1xuXG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5vbiggXCJjaGFuZ2VcIiwgdGhpcy5vbkNoYXJ0TW9kZWxDaGFuZ2UsIHRoaXMgKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLm9uKCBcImNoYW5nZS1tYXBcIiwgdGhpcy5vbkNoYXJ0TW9kZWxDaGFuZ2UsIHRoaXMgKTtcblxuXHRcdFx0cmV0dXJuIHRoaXMucmVuZGVyKCk7XG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcblx0XHRcdHZhciBtYXBDb25maWcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwibWFwLWNvbmZpZ1wiICk7XG5cdFx0XHRcblx0XHRcdHRoaXMuJHRhcmdldFllYXJMYWJlbC50ZXh0KCBtYXBDb25maWcudGFyZ2V0WWVhciApO1xuXHRcdFx0dGhpcy4kcmVnaW9uQ29udHJvbExhYmVsLnRleHQoIG1hcENvbmZpZy5wcm9qZWN0aW9uICk7XG5cblx0XHRcdHRoaXMuJHRhcmdldFllYXJJbnB1dC5hdHRyKCBcIm1pblwiLCBtYXBDb25maWcubWluWWVhciApO1xuXHRcdFx0dGhpcy4kdGFyZ2V0WWVhcklucHV0LmF0dHIoIFwibWF4XCIsIG1hcENvbmZpZy5tYXhZZWFyICk7XG5cdFx0XHR0aGlzLiR0YXJnZXRZZWFySW5wdXQuYXR0ciggXCJzdGVwXCIsIG1hcENvbmZpZy50aW1lSW50ZXJ2YWwgKTtcblx0XHRcdHRoaXMuJHRhcmdldFllYXJJbnB1dC52YWwoIHBhcnNlSW50KCBtYXBDb25maWcudGFyZ2V0WWVhciwgMTAgKSApO1xuXG5cdFx0XHR0aGlzLiRyZWdpb25Db250cm9sTGlzLnJlbW92ZUNsYXNzKCBcImhpZ2hsaWdodFwiICk7XG5cdFx0XHR0aGlzLiRyZWdpb25Db250cm9sTGlzLmZpbHRlciggXCIuXCIgKyBtYXBDb25maWcucHJvamVjdGlvbiArIFwiLXByb2plY3Rpb25cIiApLmFkZENsYXNzKCBcImhpZ2hsaWdodFwiICk7XG5cblx0XHR9LFxuXG5cdFx0b25DaGFydE1vZGVsQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblx0XHR9LFxuXHRcdFxuXHRcdG9uVGFyZ2V0WWVhcklucHV0OiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0dmFyICR0aGlzID0gJCggZXZ0LnRhcmdldCApLFxuXHRcdFx0XHR0YXJnZXRZZWFyID0gcGFyc2VJbnQoICR0aGlzLnZhbCgpLCAxMCApO1xuXHRcdFx0dGhpcy4kdGFyZ2V0WWVhckxhYmVsLnRleHQoIHRhcmdldFllYXIsIGZhbHNlLCBcImNoYW5nZS1tYXBcIiApO1xuXHRcdH0sXG5cblx0XHRvblRhcmdldFllYXJDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHR2YXIgJHRoaXMgPSAkKCBldnQudGFyZ2V0ICksXG5cdFx0XHRcdHRhcmdldFllYXIgPSBwYXJzZUludCggJHRoaXMudmFsKCksIDEwICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC51cGRhdGVNYXBDb25maWcoIFwidGFyZ2V0WWVhclwiLCB0YXJnZXRZZWFyLCBmYWxzZSwgXCJjaGFuZ2UtbWFwXCIgKTtcblx0XHRcdHRoaXMucmVuZGVyKCk7XG5cdFx0fSxcblxuXHRcdG9uUmVnaW9uQ2xpY2s6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHR2YXIgJHRoaXMgPSAkKCBldnQudGFyZ2V0ICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC51cGRhdGVNYXBDb25maWcoIFwicHJvamVjdGlvblwiLCAkdGhpcy50ZXh0KCksIGZhbHNlLCBcImNoYW5nZS1tYXBcIiApO1xuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblx0XHR9LFxuXG5cdFx0b25TZXR0aW5nc0lucHV0OiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0dmFyICR0aGlzID0gJCggZXZ0LnRhcmdldCApLFxuXHRcdFx0XHRtb2RlID0gKCAkdGhpcy5pcyggXCI6Y2hlY2tlZFwiICkgKT8gXCJzcGVjaWZpY1wiOiBcIm5vLWludGVycG9sYXRpb25cIjtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnVwZGF0ZU1hcENvbmZpZyggXCJtb2RlXCIsIG1vZGUsIGZhbHNlLCBcImNoYW5nZS1tYXBcIiApO1xuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblx0XHR9XG5cblx0fSk7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVmlld3MuQ2hhcnQuTWFwLk1hcENvbnRyb2xzO1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0QXBwLlZpZXdzLkZvcm0uQXhpc1RhYlZpZXcgPSBCYWNrYm9uZS5WaWV3LmV4dGVuZCh7XG5cblx0XHRlbDogXCIjZm9ybS12aWV3ICNheGlzLXRhYlwiLFxuXHRcdGV2ZW50czoge1xuXHRcdFx0XCJjaGFuZ2UgaW5wdXQuZm9ybS1jb250cm9sLCBzZWxlY3QuZm9ybS1jb250cm9sXCI6IFwib25Gb3JtQ29udHJvbENoYW5nZVwiLFxuXHRcdFx0XCJjaGFuZ2UgW25hbWU9J3gtYXhpcy1zY2FsZS1zZWxlY3RvciddXCI6IFwib25YYXhpc1NjYWxlU2VsZWN0b3JcIixcblx0XHRcdFwiY2hhbmdlIFtuYW1lPSd5LWF4aXMtc2NhbGUtc2VsZWN0b3InXVwiOiBcIm9uWWF4aXNTY2FsZVNlbGVjdG9yXCJcblx0XHR9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHRcblx0XHRcdHRoaXMuZGlzcGF0Y2hlciA9IG9wdGlvbnMuZGlzcGF0Y2hlcjtcblx0XHRcdHRoaXMucmVuZGVyKCk7XG5cblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblxuXHRcdFx0Ly9zZXR1cCBpbml0aWFsIHZhbHVlc1xuXHRcdFx0dmFyIHRoYXQgPSB0aGlzLFxuXHRcdFx0XHRjaGFydFhheGlzID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcIngtYXhpc1wiICksXG5cdFx0XHRcdGNoYXJ0WWF4aXMgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwieS1heGlzXCIgKTtcblxuXHRcdFx0dmFyICR4QXhpc1NjYWxlU2VsZWN0b3IgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPSd4LWF4aXMtc2NhbGUtc2VsZWN0b3InXVwiICksXG5cdFx0XHRcdCR5QXhpc1NjYWxlU2VsZWN0b3IgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPSd5LWF4aXMtc2NhbGUtc2VsZWN0b3InXVwiICk7XG5cblx0XHRcdF8uZWFjaCggY2hhcnRYYXhpcywgZnVuY3Rpb24oIGQsIGkgKSB7XG5cdFx0XHRcdHRoYXQuJGVsLmZpbmQoIFwiW25hbWU9J2NoYXJ0LXgtXCIgKyBpICsgXCInXVwiICkudmFsKCBkICk7XG5cdFx0XHR9ICk7XG5cdFx0XHRfLmVhY2goIGNoYXJ0WWF4aXMsIGZ1bmN0aW9uKCBkLCBpICkge1xuXHRcdFx0XHR0aGF0LiRlbC5maW5kKCBcIltuYW1lPSdjaGFydC15LVwiICsgaSArIFwiJ11cIiApLnZhbCggZCApO1xuXHRcdFx0fSApO1xuXG5cdFx0XHQkeEF4aXNTY2FsZVNlbGVjdG9yLnByb3AoIFwiY2hlY2tlZFwiLCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwieC1heGlzLXNjYWxlLXNlbGVjdG9yXCIgKSApO1xuXHRcdFx0JHlBeGlzU2NhbGVTZWxlY3Rvci5wcm9wKCBcImNoZWNrZWRcIiwgQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcInktYXhpcy1zY2FsZS1zZWxlY3RvclwiICkgKTtcblx0XHRcdFxuXG5cdFx0fSxcblxuXHRcdG9uRm9ybUNvbnRyb2xDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdGNvbnNvbGUubG9nKCBcIm9uRm9ybUNvbnRyb2xDaGFuZ2VcIiApO1xuXHRcdFx0dmFyICRjb250cm9sID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKSxcblx0XHRcdFx0Y29udHJvbE5hbWUgPSAkY29udHJvbC5hdHRyKCBcIm5hbWVcIiApLFxuXHRcdFx0XHRjb250cm9sVmFsdWUgPSAkY29udHJvbC52YWwoKSxcblx0XHRcdFx0YXhpc05hbWUgPSAoIGNvbnRyb2xOYW1lLmluZGV4T2YoIFwiY2hhcnQteVwiICkgPiAtMSApPyBcInktYXhpc1wiOiBcIngtYXhpc1wiO1xuXG5cdFx0XHQvL3N0cmlwIGNvbnRyb2wgbmFtZSBwcmVmaXhcblx0XHRcdGNvbnRyb2xOYW1lID0gY29udHJvbE5hbWUuc3Vic3RyaW5nKCA4ICk7XG5cblx0XHRcdEFwcC5DaGFydE1vZGVsLnNldEF4aXNDb25maWcoIGF4aXNOYW1lLCBjb250cm9sTmFtZSwgY29udHJvbFZhbHVlICk7XG5cblx0XHR9LFxuXG5cdFx0b25YYXhpc1NjYWxlU2VsZWN0b3I6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHR2YXIgJGNoZWNrID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJ4LWF4aXMtc2NhbGUtc2VsZWN0b3JcIiwgJGNoZWNrLmlzKCBcIjpjaGVja2VkXCIgKSApO1xuXHRcdH0sXG5cblx0XHRvbllheGlzU2NhbGVTZWxlY3RvcjogZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdHZhciAkY2hlY2sgPSAkKCBldnQuY3VycmVudFRhcmdldCApO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0KCBcInktYXhpcy1zY2FsZS1zZWxlY3RvclwiLCAkY2hlY2suaXMoIFwiOmNoZWNrZWRcIiApICk7XG5cdFx0fVxuXG5cblx0fSk7XG5cdFxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5Gb3JtLkF4aXNUYWJWaWV3O1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIENoYXJ0VHlwZVNlY3Rpb25WaWV3ID0gcmVxdWlyZSggXCIuL2Jhc2ljVGFiL0FwcC5WaWV3cy5Gb3JtLkNoYXJ0VHlwZVNlY3Rpb25WaWV3LmpzXCIgKSxcblx0XHRBZGREYXRhU2VjdGlvblZpZXcgPSByZXF1aXJlKCBcIi4vZGF0YVRhYi9BcHAuVmlld3MuRm9ybS5BZGREYXRhU2VjdGlvblZpZXcuanNcIiApLFxuXHRcdERpbWVuc2lvbnNTZWN0aW9uVmlldyA9IHJlcXVpcmUoIFwiLi9kYXRhVGFiL0FwcC5WaWV3cy5Gb3JtLkRpbWVuc2lvbnNTZWN0aW9uVmlldy5qc1wiICksXG5cdFx0U2VsZWN0ZWRDb3VudHJpZXNTZWN0aW9uVmlldyA9IHJlcXVpcmUoIFwiLi9kYXRhVGFiL0FwcC5WaWV3cy5Gb3JtLlNlbGVjdGVkQ291bnRyaWVzU2VjdGlvblZpZXcuanNcIiApLFxuXHRcdEVudGl0aWVzU2VjdGlvblZpZXcgPSByZXF1aXJlKCBcIi4vZGF0YVRhYi9BcHAuVmlld3MuRm9ybS5FbnRpdGllc1NlY3Rpb25WaWV3LmpzXCIgKSxcblx0XHRUaW1lU2VjdGlvblZpZXcgPSByZXF1aXJlKCBcIi4vZGF0YVRhYi9BcHAuVmlld3MuRm9ybS5UaW1lU2VjdGlvblZpZXcuanNcIiApO1xuXG5cdEFwcC5WaWV3cy5Gb3JtLkJhc2ljVGFiVmlldyA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblxuXHRcdGVsOiBcIiNmb3JtLXZpZXcgI2Jhc2ljLXRhYlwiLFxuXHRcdGV2ZW50czoge30sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdFxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gb3B0aW9ucy5kaXNwYXRjaGVyO1xuXG5cdFx0XHR0aGlzLmNoYXJ0VHlwZVNlY3Rpb24gPSBuZXcgQ2hhcnRUeXBlU2VjdGlvblZpZXcoIHsgZGlzcGF0Y2hlcjogdGhpcy5kaXNwYXRjaGVyIH0gKTtcblx0XHRcdHRoaXMuYWRkRGF0YVNlY3Rpb24gPSBuZXcgQWRkRGF0YVNlY3Rpb25WaWV3KCB7IGRpc3BhdGNoZXI6IHRoaXMuZGlzcGF0Y2hlciB9ICk7XG5cdFx0XHR0aGlzLmRpbWVuc2lvbnNTZWN0aW9uID0gbmV3IERpbWVuc2lvbnNTZWN0aW9uVmlldyggeyBkaXNwYXRjaGVyOiB0aGlzLmRpc3BhdGNoZXIgfSApO1xuXHRcdFx0dGhpcy5zZWxlY3RlZENvdW50cmllc1NlY3Rpb24gPSBuZXcgU2VsZWN0ZWRDb3VudHJpZXNTZWN0aW9uVmlldyggeyBkaXNwYXRjaGVyOiB0aGlzLmRpc3BhdGNoZXIgfSApO1xuXHRcdFx0dGhpcy5lbnRpdGllc1NlY3Rpb24gPSBuZXcgRW50aXRpZXNTZWN0aW9uVmlldyggeyBkaXNwYXRjaGVyOiB0aGlzLmRpc3BhdGNoZXIgfSApO1xuXHRcdFx0dGhpcy50aW1lU2VjdGlvbiA9IG5ldyBUaW1lU2VjdGlvblZpZXcoIHsgZGlzcGF0Y2hlcjogdGhpcy5kaXNwYXRjaGVyIH0gKTtcblxuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblxuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XG5cdFx0XHR0aGlzLiRlbC5maW5kKCBcIltuYW1lPWNoYXJ0LW5hbWVdXCIgKS52YWwoIEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC1uYW1lXCIgKSApO1xuXHRcdFx0dGhpcy4kZWwuZmluZCggXCJbbmFtZT1jaGFydC1zdWJuYW1lXVwiICkudmFsKCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtc3VibmFtZVwiICkgKTtcblxuXHRcdH1cblxuXHR9KTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5Gb3JtLkJhc2ljVGFiVmlldztcblxufSkoKTtcbiIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0QXBwLlZpZXdzLkZvcm0uRGVzY3JpcHRpb25UYWJWaWV3ID0gQmFja2JvbmUuVmlldy5leHRlbmQoe1xuXG5cdFx0ZWw6IFwiI2Zvcm0tdmlldyAjc291cmNlcy10YWJcIixcblx0XHRldmVudHM6IHt9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHRcblx0XHRcdHRoaXMuZGlzcGF0Y2hlciA9IG9wdGlvbnMuZGlzcGF0Y2hlcjtcblx0XHRcdHZhciB0aGF0ID0gdGhpcztcblxuXHRcdFx0dGhpcy4kdGV4dEFyZWEgPSB0aGlzLiRlbC5maW5kKCBcInRleHRhcmVhXCIgKTtcblx0XHRcdHRoaXMuJHRleHRBcmVhLnZhbCggQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LWRlc2NyaXB0aW9uXCIgKSApO1xuXG5cdFx0XHR0aGlzLiR0ZXh0QXJlYS53eXNpaHRtbDUoIHtcblx0XHRcdFx0XCJldmVudHNcIjoge1xuXHRcdFx0XHRcdFwiY2hhbmdlXCI6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHRcdFx0XHR0aGF0Lm9uRm9ybUNvbnRyb2xDaGFuZ2UoIHRoYXQuJHRleHRBcmVhICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblxuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXG5cdFx0fSxcblxuXHRcdG9uRm9ybUNvbnRyb2xDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdHZhciB0ZXh0QXJlYVZhbHVlID0gdGhpcy4kdGV4dEFyZWEudmFsKCk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5zZXQoIFwiY2hhcnQtZGVzY3JpcHRpb25cIiwgdGV4dEFyZWFWYWx1ZSApO1xuXG5cdFx0fVxuXG5cblx0fSk7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVmlld3MuRm9ybS5EZXNjcmlwdGlvblRhYlZpZXc7XG5cbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHRBcHAuVmlld3MuRm9ybS5FeHBvcnRUYWJWaWV3ID0gQmFja2JvbmUuVmlldy5leHRlbmQoe1xuXG5cdFx0ZWw6IFwiI2Zvcm0tdmlldyAjZXhwb3J0LXRhYlwiLFxuXHRcdGV2ZW50czoge1xuXHRcdFx0XCJjbGljayBbdHlwZT0nY2hlY2tib3gnXVwiOiBcIm9uVGFic0NoZWNrXCIsXG5cdFx0XHRcImNoYW5nZSAuZW1iZWQtc2l6ZS13cmFwcGVyIGlucHV0XCI6IFwib25FbWJlZFNpemVDaGFuZ2VcIlxuXHRcdH0sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdFxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gb3B0aW9ucy5kaXNwYXRjaGVyO1xuXHRcdFx0dGhpcy5kaXNwYXRjaGVyLm9uKCBcImNoYXJ0LXNhdmVkXCIsIHRoaXMub25DaGFydFNhdmVkLCB0aGlzICk7XG5cdFx0XHRcblx0XHRcdHRoaXMucmVuZGVyKCk7XG5cblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdFxuXHRcdFx0dGhpcy4kY2hlY2tib3hlcyA9IHRoaXMuJGVsLmZpbmQoIFwiW3R5cGU9J2NoZWNrYm94J11cIiApO1xuXHRcdFx0dGhpcy4kd2lkdGhJbnB1dCA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9J2lmcmFtZS13aWR0aCddXCIgKTtcblx0XHRcdHRoaXMuJGhlaWdodElucHV0ID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT0naWZyYW1lLWhlaWdodCddXCIgKTtcblx0XHRcdHRoaXMuJGlmcmFtZVRleHRBcmVhID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT0naWZyYW1lJ11cIiApO1xuXG5cdFx0XHR0aGlzLiRtYXBUYWIgPSAkKCBcIltocmVmPScjbWFwLXRhYiddXCIgKTtcblxuXHRcdFx0Ly91cGRhdGUgbGluZS10eXBlIGZyb20gbW9kZWxcblx0XHRcdHZhciB0aGF0ID0gdGhpcyxcblx0XHRcdFx0dGFicyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJ0YWJzXCIgKTtcblx0XHRcdF8uZWFjaCggdGFicywgZnVuY3Rpb24oIHYsIGkgKSB7XG5cdFx0XHRcdHZhciAkY2hlY2tib3ggPSB0aGF0LiRjaGVja2JveGVzLmZpbHRlciggXCJbdmFsdWU9J1wiICsgdiArIFwiJ11cIiApO1xuXHRcdFx0XHQkY2hlY2tib3gucHJvcCggXCJjaGVja2VkXCIsIHRydWUgKTtcblx0XHRcdFx0aWYoIHYgPT09IFwibWFwXCIgKSB7XG5cdFx0XHRcdFx0dGhhdC4kbWFwVGFiLmNzcyggXCJkaXNwbGF5XCIsIFwiYmxvY2tcIiApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cblx0XHRcdC8vdXBkYXRlIHNpemUgZnJvbSBtb2RlbFxuXHRcdFx0dGhpcy4kd2lkdGhJbnB1dC52YWwoIEFwcC5DaGFydE1vZGVsLmdldCggXCJpZnJhbWUtd2lkdGhcIiApICk7XG5cdFx0XHR0aGlzLiRoZWlnaHRJbnB1dC52YWwoIEFwcC5DaGFydE1vZGVsLmdldCggXCJpZnJhbWUtaGVpZ2h0XCIgKSApO1xuXG5cdFx0XHQvL3VwZGF0ZSBleHBvcnQgY29kZSBmcm9tIFxuXHRcdFx0dmFyIGNoYXJ0SWQgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiaWRcIiApO1xuXHRcdFx0aWYoIGNoYXJ0SWQgKSB7XG5cdFx0XHRcdHZhciB2aWV3VXJsID0gdGhpcy4kaWZyYW1lVGV4dEFyZWEuYXR0ciggXCJkYXRhLXZpZXctdXJsXCIgKTtcblx0XHRcdFx0dGhpcy5nZW5lcmF0ZUlmcmFtZUNvZGUoIGNoYXJ0SWQsIHZpZXdVcmwgKTtcblx0XHRcdH1cblxuXHRcdH0sXG5cblx0XHRvbkNoYXJ0U2F2ZWQ6IGZ1bmN0aW9uKCBpZCwgdmlld1VybCApIHtcblx0XHRcdHRoaXMuZ2VuZXJhdGVJZnJhbWVDb2RlKCBpZCwgdmlld1VybCApO1xuXHRcdH0sXG5cblx0XHRvblRhYnNDaGVjazogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dmFyIHRoYXQgPSB0aGlzLFxuXHRcdFx0XHRjaGVja2VkID0gW107XG5cdFx0XHQkLmVhY2goIHRoaXMuJGNoZWNrYm94ZXMsIGZ1bmN0aW9uKCBpLCB2ICkge1xuXG5cdFx0XHRcdHZhciAkY2hlY2tib3ggPSAkKCB0aGlzICk7XG5cdFx0XHRcdGlmKCAkY2hlY2tib3guaXMoIFwiOmNoZWNrZWRcIiApICkge1xuXHRcdFx0XHRcdGNoZWNrZWQucHVzaCggJGNoZWNrYm94LnZhbCgpICk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiggJGNoZWNrYm94LnZhbCgpID09PSBcIm1hcFwiICkge1xuXHRcdFx0XHRcdGlmKCAkY2hlY2tib3guaXMoIFwiOmNoZWNrZWRcIiApICkge1xuXHRcdFx0XHRcdFx0dGhhdC4kbWFwVGFiLmNzcyggXCJkaXNwbGF5XCIsIFwiYmxvY2tcIiApO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0aGF0LiRtYXBUYWIuY3NzKCBcImRpc3BsYXlcIiwgXCJub25lXCIgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcblx0XHRcdH0gKTtcblxuXHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0KCBcInRhYnNcIiwgY2hlY2tlZCApO1xuXG5cdFx0fSxcblxuXHRcdG9uRW1iZWRTaXplQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHRcblx0XHRcdHZhciAkaW5wdXQgPSAkKCBldnQuY3VycmVudFRhcmdldCApO1xuXHRcdFx0Ly91bm5lY2Vzc2FyeSB0byB1cGRhdGUgZXZlcnl0aGluZyBqdXN0IGJlY2F1c2UgZ2VuZXJhdGVkIGNvZGUgY2hhbmdlZFxuXHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0KCAkaW5wdXQuYXR0ciggXCJuYW1lXCIgKSwgJGlucHV0LnZhbCgpLCB7c2lsZW50OnRydWV9ICk7XG5cblx0XHRcdC8vaWYgYWxyZWFkeSBnZW5lcmF0ZWQgY29kZSwgdXBkYXRlIGl0XG5cdFx0XHRpZiggdGhpcy4kaWZyYW1lVGV4dEFyZWEudGV4dCgpICE9IFwiXCIgKSB7XG5cdFx0XHRcdHRoaXMuZ2VuZXJhdGVJZnJhbWVDb2RlKCk7XG5cdFx0XHR9XG5cblx0XHR9LFxuXG5cdFx0Z2VuZXJhdGVJZnJhbWVDb2RlOiBmdW5jdGlvbiggaWQsIHZpZXdVcmwgKSB7XG5cdFx0XHQvL3N0b3JlIHZpZXcgdXJsXG5cdFx0XHRpZiggdmlld1VybCApIHtcblx0XHRcdFx0dGhpcy52aWV3VXJsID0gdmlld1VybDtcblx0XHRcdH1cblx0XHRcdHRoaXMuJGlmcmFtZVRleHRBcmVhLnRleHQoICc8aWZyYW1lIHNyYz1cIicgKyB0aGlzLnZpZXdVcmwgKyAnXCIgc3R5bGU9XCJ3aWR0aDonICsgQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImlmcmFtZS13aWR0aFwiICkgKyAnO2hlaWdodDonICsgQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImlmcmFtZS1oZWlnaHRcIiApICsgJzsgYm9yZGVyOiAwcHggbm9uZTtcIj48L2lmcmFtZT4nICk7XG5cdFx0fVxuXG5cdH0pO1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkZvcm0uRXhwb3J0VGFiVmlldztcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdEFwcC5WaWV3cy5Gb3JtLk1hcFRhYlZpZXcgPSBCYWNrYm9uZS5WaWV3LmV4dGVuZCh7XG5cblx0XHRlbDogXCIjZm9ybS12aWV3ICNtYXAtdGFiXCIsXG5cdFx0ZXZlbnRzOiB7XG5cdFx0XHRcImNoYW5nZSBbbmFtZT0nbWFwLXZhcmlhYmxlLWlkJ11cIjogXCJvblZhcmlhYmxlSWRDaGFuZ2VcIixcblx0XHRcdFwiY2hhbmdlIFtuYW1lPSdtYXAtdGltZS10b2xlcmFuY2UnXVwiOiBcIm9uVGltZVRvbGVyYW5jZUNoYW5nZVwiLFxuXHRcdFx0XCJjaGFuZ2UgW25hbWU9J21hcC10aW1lLWludGVydmFsJ11cIjogXCJvblRpbWVJbnRlcnZhbENoYW5nZVwiLFxuXHRcdFx0XCJjaGFuZ2UgW25hbWU9J21hcC1jb2xvci1zY2hlbWUnXVwiOiBcIm9uQ29sb3JTY2hlbWVDaGFuZ2VcIixcblx0XHRcdFwiY2hhbmdlIFtuYW1lPSdtYXAtY29sb3ItaW50ZXJ2YWwnXVwiOiBcIm9uQ29sb3JJbnRlcnZhbENoYW5nZVwiLFxuXHRcdFx0XCJjaGFuZ2UgW25hbWU9J21hcC1wcm9qZWN0aW9ucyddXCI6IFwib25Qcm9qZWN0aW9uQ2hhbmdlXCJcblx0XHR9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIgPSBvcHRpb25zLmRpc3BhdGNoZXI7XG5cblx0XHRcdEFwcC5DaGFydFZhcmlhYmxlc0NvbGxlY3Rpb24ub24oIFwiYWRkIHJlbW92ZSBjaGFuZ2UgcmVzZXRcIiwgdGhpcy5vblZhcmlhYmxlc0NvbGxlY3Rpb25DaGFuZ2UsIHRoaXMgKTtcblx0XHRcdEFwcC5BdmFpbGFibGVUaW1lTW9kZWwub24oIFwiY2hhbmdlXCIsIHRoaXMub25BdmFpbGFibGVUaW1lQ2hhbmdlLCB0aGlzICk7XG5cdFx0XHQvL0FwcC5DaGFydE1vZGVsLm9uKCBcImNoYW5nZVwiLCB0aGlzLm9uQ2hhcnRNb2RlbENoYW5nZSwgdGhpcyApO1xuXHRcdFx0XG5cdFx0XHR0aGlzLiR2YXJpYWJsZUlkU2VsZWN0ID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT0nbWFwLXZhcmlhYmxlLWlkJ11cIiApO1xuXHRcdFx0XG5cdFx0XHR0aGlzLiR0aW1lVG9sZXJhbmNlSW5wdXQgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPSdtYXAtdGltZS10b2xlcmFuY2UnXVwiICk7XG5cdFx0XHR0aGlzLiR0aW1lSW50ZXJ2YWxJbnB1dCA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9J21hcC10aW1lLWludGVydmFsJ11cIiApO1xuXHRcdFx0XG5cdFx0XHR0aGlzLiRjb2xvclNjaGVtZVNlbGVjdCA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9J21hcC1jb2xvci1zY2hlbWUnXVwiICk7XG5cdFx0XHR0aGlzLiRjb2xvckludGVydmFsU2VsZWN0ID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT0nbWFwLWNvbG9yLWludGVydmFsJ11cIiApO1xuXHRcdFx0XG5cdFx0XHR0aGlzLiRwcm9qZWN0aW9uc1NlbGVjdCA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9J21hcC1wcm9qZWN0aW9ucyddXCIgKTtcblxuXHRcdFx0Ly9tYWtlIHN1cmUgd2UgaGF2ZSBjdXJyZW50IGRhdGFcblx0XHRcdHRoaXMudXBkYXRlVGFyZ2V0WWVhciggdHJ1ZSApO1xuXG5cdFx0XHR0aGlzLnJlbmRlcigpO1xuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFxuXHRcdFx0Ly9wb3B1bGF0ZSB2YXJpYWJsZSBzZWxlY3Qgd2l0aCB0aGUgYXZhaWxhYmxlIG9uZXNcblx0XHRcdHRoaXMuJHZhcmlhYmxlSWRTZWxlY3QuZW1wdHkoKTtcblxuXHRcdFx0dmFyIG1hcENvbmZpZyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJtYXAtY29uZmlnXCIgKTtcblx0XHRcdFx0XG5cdFx0XHR0aGlzLnVwZGF0ZVZhcmlhYmxlU2VsZWN0KCk7XG5cblx0XHRcdHRoaXMuJHRpbWVUb2xlcmFuY2VJbnB1dC52YWwoIG1hcENvbmZpZy50aW1lVG9sZXJhbmNlICk7XG5cdFx0XHR0aGlzLiR0aW1lSW50ZXJ2YWxJbnB1dC52YWwoIG1hcENvbmZpZy50aW1lSW50ZXJ2YWwgKTtcblxuXHRcdFx0dGhpcy51cGRhdGVDb2xvclNjaGVtZVNlbGVjdCgpO1xuXHRcdFx0dGhpcy51cGRhdGVDb2xvckludGVydmFsU2VsZWN0KCk7XG5cdFx0XHR0aGlzLnVwZGF0ZVByb2plY3Rpb25zU2VsZWN0KCk7XG5cblx0XHR9LFxuXG5cdFx0dXBkYXRlVmFyaWFibGVTZWxlY3Q6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHR2YXIgbWFwQ29uZmlnID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcIm1hcC1jb25maWdcIiApLFxuXHRcdFx0XHRtb2RlbHMgPSBBcHAuQ2hhcnRWYXJpYWJsZXNDb2xsZWN0aW9uLm1vZGVscyxcblx0XHRcdFx0aHRtbCA9IFwiXCI7XG5cblx0XHRcdGlmKCBtb2RlbHMgJiYgbW9kZWxzLmxlbmd0aCApIHtcblx0XHRcdFx0aHRtbCArPSBcIjxvcHRpb24gc2VsZWN0ZWQgZGlzYWJsZWQ+U2VsZWN0IHZhcmlhYmxlIHRvIGRpc3BsYXkgb24gbWFwPC9vcHRpb24+XCI7XG5cdFx0XHR9XG5cblx0XHRcdF8uZWFjaCggbW9kZWxzLCBmdW5jdGlvbiggdiwgaSApIHtcblx0XHRcdFx0Ly9pZiBubyB2YXJpYWJsZSBzZWxlY3RlZCwgdHJ5IHRvIHNlbGVjdCBmaXJzdFxuXHRcdFx0XHR2YXIgc2VsZWN0ZWQgPSAoIGkgPT0gbWFwQ29uZmlnLnZhcmlhYmxlSWQgKT8gXCIgc2VsZWN0ZWRcIjogXCJcIjtcblx0XHRcdFx0aHRtbCArPSBcIjxvcHRpb24gdmFsdWU9J1wiICsgdi5nZXQoIFwiaWRcIiApICsgXCInIFwiICsgc2VsZWN0ZWQgKyBcIj5cIiArIHYuZ2V0KCBcIm5hbWVcIiApICsgXCI8L29wdGlvbj5cIjtcblx0XHRcdH0gKTtcblxuXHRcdFx0Ly9jaGVjayBmb3IgZW1wdHkgaHRtbFxuXHRcdFx0aWYoICFodG1sICkge1xuXHRcdFx0XHRodG1sICs9IFwiPG9wdGlvbiBzZWxlY3RlZCBkaXNhYmxlZD5BZGQgc29tZSB2YXJpYWJsZXMgaW4gMi5EYXRhIHRhYiBmaXJzdDwvb3B0aW9uPlwiO1xuXHRcdFx0XHR0aGlzLiR2YXJpYWJsZUlkU2VsZWN0LmFkZENsYXNzKCBcImRpc2FibGVkXCIgKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuJHZhcmlhYmxlSWRTZWxlY3QucmVtb3ZlQ2xhc3MoIFwiZGlzYWJsZWRcIiApO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy4kdmFyaWFibGVJZFNlbGVjdC5hcHBlbmQoICQoIGh0bWwgKSApO1xuXG5cdFx0XHQvL2NoZWNrIGlmIHdlIHNob3VsZCBzZWxlY3QgZmlyc3QgdmFyaWFibGVcblx0XHRcdGlmKCBtb2RlbHMubGVuZ3RoICYmICF0aGlzLiR2YXJpYWJsZUlkU2VsZWN0LnZhbCgpICkge1xuXHRcdFx0XHR2YXIgZmlyc3RPcHRpb24gPSB0aGlzLiR2YXJpYWJsZUlkU2VsZWN0LmZpbmQoIFwib3B0aW9uXCIgKS5lcSggMSApLnZhbCgpO1xuXHRcdFx0XHR0aGlzLiR2YXJpYWJsZUlkU2VsZWN0LnZhbCggZmlyc3RPcHRpb24gKTtcblx0XHRcdFx0QXBwLkNoYXJ0TW9kZWwudXBkYXRlTWFwQ29uZmlnKCBcInZhcmlhYmxlSWRcIiwgZmlyc3RPcHRpb24gKTtcblx0XHRcdH1cblxuXHRcdH0sXG5cdFx0XG5cdFx0dXBkYXRlQ29sb3JTY2hlbWVTZWxlY3Q6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XG5cdFx0XHR2YXIgaHRtbCA9IFwiXCIsXG5cdFx0XHRcdG1hcENvbmZpZyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJtYXAtY29uZmlnXCIgKTtcblxuXHRcdFx0dGhpcy4kY29sb3JTY2hlbWVTZWxlY3QuZW1wdHkoKTtcblx0XHRcdF8uZWFjaCggY29sb3JicmV3ZXIsIGZ1bmN0aW9uKCB2LCBpICkge1xuXHRcdFx0XHR2YXIgc2VsZWN0ZWQgPSAoIGkgPT0gbWFwQ29uZmlnLmNvbG9yU2NoZW1lTmFtZSApPyBcIiBzZWxlY3RlZFwiOiBcIlwiO1xuXHRcdFx0XHRodG1sICs9IFwiPG9wdGlvbiB2YWx1ZT0nXCIgKyBpICsgXCInIFwiICsgc2VsZWN0ZWQgKyBcIj5cIiArIGkgKyBcIjwvb3B0aW9uPlwiO1xuXHRcdFx0fSApO1xuXHRcdFx0dGhpcy4kY29sb3JTY2hlbWVTZWxlY3QuYXBwZW5kKCAkKCBodG1sICkgKTtcblxuXHRcdH0sXG5cblx0XHR1cGRhdGVDb2xvckludGVydmFsU2VsZWN0OiBmdW5jdGlvbigpIHtcblx0XHRcdFxuXHRcdFx0dmFyIGh0bWwgPSBcIlwiLFxuXHRcdFx0XHRtYXBDb25maWcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwibWFwLWNvbmZpZ1wiICksXG5cdFx0XHRcdGhhc1NlbGVjdGVkID0gZmFsc2U7XG5cblx0XHRcdHRoaXMuJGNvbG9ySW50ZXJ2YWxTZWxlY3QuZW1wdHkoKTtcblx0XHRcdF8uZWFjaCggY29sb3JicmV3ZXJbICBtYXBDb25maWcuY29sb3JTY2hlbWVOYW1lIF0sIGZ1bmN0aW9uKCB2LCBpICkge1xuXHRcdFx0XHR2YXIgc2VsZWN0ZWQgPSAoIGkgPT0gbWFwQ29uZmlnLmNvbG9yU2NoZW1lSW50ZXJ2YWwgKT8gXCIgc2VsZWN0ZWRcIjogXCJcIjtcblx0XHRcdFx0aWYoIHNlbGVjdGVkID09PSBcIiBzZWxlY3RlZFwiICkge1xuXHRcdFx0XHRcdGhhc1NlbGVjdGVkID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRodG1sICs9IFwiPG9wdGlvbiB2YWx1ZT0nXCIgKyBpICsgXCInIFwiICsgc2VsZWN0ZWQgKyBcIj5cIiArIGkgKyBcIjwvb3B0aW9uPlwiO1xuXHRcdFx0fSApO1xuXHRcdFx0dGhpcy4kY29sb3JJbnRlcnZhbFNlbGVjdC5hcHBlbmQoICQoIGh0bWwgKSApO1xuXG5cdFx0XHRpZiggIWhhc1NlbGVjdGVkICkge1xuXHRcdFx0XHQvL3RoZXJlJ3Mgbm90IHNlbGVjdGVkIGludGVydmFsIHRoYXQgd291bGQgZXhpc3Qgd2l0aCBjdXJyZW50IGNvbG9yIHNjaGVtZSwgc2VsZWN0IHRoYXQgZmlyc3Rcblx0XHRcdFx0QXBwLkNoYXJ0TW9kZWwudXBkYXRlTWFwQ29uZmlnKCBcImNvbG9yU2NoZW1lSW50ZXJ2YWxcIiwgdGhpcy4kY29sb3JJbnRlcnZhbFNlbGVjdC52YWwoKSApO1xuXHRcdFx0fVxuXG5cdFx0fSxcblxuXHRcdHVwZGF0ZVByb2plY3Rpb25zU2VsZWN0OiBmdW5jdGlvbigpIHtcblx0XHRcdFxuXHRcdFx0dmFyIGh0bWwgPSBcIlwiLFxuXHRcdFx0XHRtYXBDb25maWcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwibWFwLWNvbmZpZ1wiICk7XG5cblx0XHRcdHRoaXMuJHByb2plY3Rpb25zU2VsZWN0LmVtcHR5KCk7XG5cdFx0XHRfLmVhY2goIEFwcC5WaWV3cy5DaGFydC5NYXBUYWIucHJvamVjdGlvbnMsIGZ1bmN0aW9uKCB2LCBpICkge1xuXHRcdFx0XHR2YXIgc2VsZWN0ZWQgPSAoIGkgPT0gbWFwQ29uZmlnLnByb2plY3Rpb25zICk/IFwiIHNlbGVjdGVkXCI6IFwiXCI7XG5cdFx0XHRcdGh0bWwgKz0gXCI8b3B0aW9uIHZhbHVlPSdcIiArIGkgKyBcIicgXCIgKyBzZWxlY3RlZCArIFwiPlwiICsgaSArIFwiPC9vcHRpb24+XCI7XG5cdFx0XHR9ICk7XG5cdFx0XHR0aGlzLiRwcm9qZWN0aW9uc1NlbGVjdC5hcHBlbmQoICQoIGh0bWwgKSApO1xuXG5cdFx0fSxcblxuXHRcdHVwZGF0ZVRhcmdldFllYXI6IGZ1bmN0aW9uKCBzaWxlbnQgKSB7XG5cdFx0XHR2YXIgY2hhcnRUaW1lID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LXRpbWVcIiApLFxuXHRcdFx0XHR0YXJnZXRZZWFyID0gKCBjaGFydFRpbWUgKT8gY2hhcnRUaW1lWzBdOiBBcHAuQXZhaWxhYmxlVGltZU1vZGVsLmdldCggXCJtaW5cIiApLFxuXHRcdFx0XHRtaW5ZZWFyID0gdGFyZ2V0WWVhcixcblx0XHRcdFx0bWF4WWVhciA9ICggY2hhcnRUaW1lICk/IGNoYXJ0VGltZVsxXTogQXBwLkF2YWlsYWJsZVRpbWVNb2RlbC5nZXQoIFwibWF4XCIgKTtcblxuXHRcdFx0QXBwLkNoYXJ0TW9kZWwudXBkYXRlTWFwQ29uZmlnKCBcIm1pblllYXJcIiwgbWluWWVhciwgdHJ1ZSApO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwudXBkYXRlTWFwQ29uZmlnKCBcIm1heFllYXJcIiwgbWF4WWVhciwgdHJ1ZSApO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwudXBkYXRlTWFwQ29uZmlnKCBcInRhcmdldFllYXJcIiwgdGFyZ2V0WWVhciwgc2lsZW50ICk7XG5cdFx0fSxcblxuXHRcdG9uVmFyaWFibGVzQ29sbGVjdGlvbkNoYW5nZTogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLnJlbmRlcigpO1xuXHRcdH0sXG5cblx0XHRvblZhcmlhYmxlSWRDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHR2YXIgJHRoaXMgPSAkKCBldnQudGFyZ2V0ICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC51cGRhdGVNYXBDb25maWcoIFwidmFyaWFibGVJZFwiLCAkdGhpcy52YWwoKSApO1xuXHRcdH0sXG5cblx0XHRvblRpbWVUb2xlcmFuY2VDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHR2YXIgJHRoaXMgPSAkKCBldnQudGFyZ2V0ICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC51cGRhdGVNYXBDb25maWcoIFwidGltZVRvbGVyYW5jZVwiLCBwYXJzZUludCggJHRoaXMudmFsKCksIDEwICkgKTtcblx0XHR9LFxuXG5cdFx0b25UaW1lSW50ZXJ2YWxDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHR2YXIgJHRoaXMgPSAkKCBldnQudGFyZ2V0ICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC51cGRhdGVNYXBDb25maWcoIFwidGltZUludGVydmFsXCIsIHBhcnNlSW50KCAkdGhpcy52YWwoKSwgMTAgKSApO1xuXHRcdH0sXG5cblx0XHRvbkNvbG9yU2NoZW1lQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0dmFyICR0aGlzID0gJCggZXZ0LnRhcmdldCApO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwudXBkYXRlTWFwQ29uZmlnKCBcImNvbG9yU2NoZW1lTmFtZVwiLCAkdGhpcy52YWwoKSApO1xuXHRcdFx0Ly9uZWVkIHRvIHVwZGF0ZSBudW1iZXIgb2YgY2xhc3Nlc1xuXHRcdFx0dGhpcy51cGRhdGVDb2xvckludGVydmFsU2VsZWN0KCk7XG5cdFx0fSxcblxuXHRcdG9uQ29sb3JJbnRlcnZhbENoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdHZhciAkdGhpcyA9ICQoIGV2dC50YXJnZXQgKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnVwZGF0ZU1hcENvbmZpZyggXCJjb2xvclNjaGVtZUludGVydmFsXCIsIHBhcnNlSW50KCAkdGhpcy52YWwoKSwgMTAgKSApO1xuXHRcdH0sXG5cblx0XHRvblByb2plY3Rpb25DaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHR2YXIgJHRoaXMgPSAkKCBldnQudGFyZ2V0ICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC51cGRhdGVNYXBDb25maWcoIFwicHJvamVjdGlvblwiLCAkdGhpcy52YWwoKSApO1xuXHRcdH0sXG5cblx0XHRvbkNoYXJ0TW9kZWxDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHR0aGlzLnVwZGF0ZVRhcmdldFllYXIoIHRydWUgKTtcblx0XHR9LFxuXG5cdFx0b25BdmFpbGFibGVUaW1lQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0dGhpcy51cGRhdGVUYXJnZXRZZWFyKCBmYWxzZSApO1xuXHRcdH1cblxuXHR9KTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5Gb3JtLk1hcFRhYlZpZXc7XG5cbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHRBcHAuVmlld3MuRm9ybS5TdHlsaW5nVGFiVmlldyA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblxuXHRcdGVsOiBcIiNmb3JtLXZpZXcgI3N0eWxpbmctdGFiXCIsXG5cdFx0ZXZlbnRzOiB7XG5cdFx0XHRcImNoYW5nZSBbbmFtZT0nbGluZS10eXBlJ11cIjogXCJvbkxpbmVUeXBlQ2hhbmdlXCIsXG5cdFx0XHRcImNoYW5nZSBbbmFtZV49J21hcmdpbi0nXVwiOiBcIm9uTWFyZ2luQ2hhbmdlXCIsXG5cdFx0XHRcImNoYW5nZSBbbmFtZT0naGlkZS1sZWdlbmQnXVwiOiBcIm9uSGlkZUxlZ2VuZENoYW5nZVwiXG5cdFx0fSxcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0XG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIgPSBvcHRpb25zLmRpc3BhdGNoZXI7XG5cdFx0XHRcblx0XHRcdHRoaXMuJGxpbmVUeXBlUmFkaW9zID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT0nbGluZS10eXBlJ11cIiApO1xuXHRcdFx0XG5cdFx0XHQvL21hcmdpbnNcblx0XHRcdHRoaXMuJG1hcmdpblRvcCA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9J21hcmdpbi10b3AnXVwiICk7XG5cdFx0XHR0aGlzLiRtYXJnaW5MZWZ0ID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT0nbWFyZ2luLWxlZnQnXVwiICk7XG5cdFx0XHR0aGlzLiRtYXJnaW5SaWdodCA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9J21hcmdpbi1yaWdodCddXCIgKTtcblx0XHRcdHRoaXMuJG1hcmdpbkJvdHRvbSA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9J21hcmdpbi1ib3R0b20nXVwiICk7XG5cdFx0XHRcblx0XHRcdC8vbGVnZW5kXG5cdFx0XHR0aGlzLiRoaWRlTGVnZW5kID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT0naGlkZS1sZWdlbmQnXVwiICk7XG5cblx0XHRcdC8vdW5pdHNcblx0XHRcdHRoaXMuJHVuaXRzU2VjdGlvbiA9IHRoaXMuJGVsLmZpbmQoIFwiLnVuaXRzLXNlY3Rpb25cIiApO1xuXHRcdFx0dGhpcy4kdW5pdHNDb250ZW50ID0gdGhpcy4kdW5pdHNTZWN0aW9uLmZpbmQoIFwiLmZvcm0tc2VjdGlvbi1jb250ZW50XCIgKTtcblx0XHRcdFxuXHRcdFx0QXBwLkNoYXJ0TW9kZWwub24oIFwiY2hhbmdlOmNoYXJ0LXR5cGVcIiwgdGhpcy5vbkNoYXJ0VHlwZUNoYW5nZSwgdGhpcyApO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwub24oIFwiY2hhbmdlOmNoYXJ0LWRpbWVuc2lvbnNcIiwgdGhpcy5yZW5kZXIsIHRoaXMgKTtcblx0XHRcdFxuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblxuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHR2YXIgbGluZVR5cGUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwibGluZS10eXBlXCIgKTtcblx0XHRcdHRoaXMuJGxpbmVUeXBlUmFkaW9zLmZpbHRlciggXCJbdmFsdWU9J1wiICsgbGluZVR5cGUgKyBcIiddXCIgKS5wcm9wKCBcImNoZWNrZWRcIiwgdHJ1ZSApO1xuXG5cdFx0XHR2YXIgbWFyZ2lucyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJtYXJnaW5zXCIgKTtcblx0XHRcdHRoaXMuJG1hcmdpblRvcC52YWwoIG1hcmdpbnMudG9wICk7XG5cdFx0XHR0aGlzLiRtYXJnaW5MZWZ0LnZhbCggbWFyZ2lucy5sZWZ0ICk7XG5cdFx0XHR0aGlzLiRtYXJnaW5SaWdodC52YWwoIG1hcmdpbnMucmlnaHQgKTtcblx0XHRcdHRoaXMuJG1hcmdpbkJvdHRvbS52YWwoIG1hcmdpbnMuYm90dG9tICk7XG5cblx0XHRcdHZhciBoaWRlTGVnZW5kID0gKCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiaGlkZS1sZWdlbmRcIiApICk/IHRydWU6IGZhbHNlO1xuXHRcdFx0dGhpcy4kaGlkZUxlZ2VuZC5wcm9wKCBcImNoZWNrZWRcIiwgaGlkZUxlZ2VuZCApO1xuXG5cdFx0XHR0aGlzLnVwZGF0ZVVuaXRzVUkoKTtcblx0XHRcdCQoIFwiLnVuaXRzLXNlY3Rpb24gLmZvcm0tY29udHJvbFt0eXBlPWlucHV0XSwgLnVuaXRzLXNlY3Rpb24gW3R5cGU9Y2hlY2tib3hdXCIgKS5vbiggXCJjaGFuZ2VcIiwgJC5wcm94eSggdGhpcy51cGRhdGVVbml0cywgdGhpcyApICk7XG5cdFx0XG5cdFx0fSxcblxuXHRcdG9uTGluZVR5cGVDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdHZhciAkcmFkaW8gPSAkKCBldnQuY3VycmVudFRhcmdldCApO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0KCBcImxpbmUtdHlwZVwiLCAkcmFkaW8udmFsKCkgKTtcblxuXHRcdH0sXG5cblx0XHRvbk1hcmdpbkNoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dmFyICRjb250cm9sID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKSxcblx0XHRcdFx0Y29udHJvbE5hbWUgPSAkY29udHJvbC5hdHRyKCBcIm5hbWVcIiApLFxuXHRcdFx0XHRtYXJnaW5zT2JqID0geyB0b3A6IHRoaXMuJG1hcmdpblRvcC52YWwoKSxcblx0XHRcdFx0XHRcdFx0bGVmdDogdGhpcy4kbWFyZ2luTGVmdC52YWwoKSxcblx0XHRcdFx0XHRcdFx0cmlnaHQ6IHRoaXMuJG1hcmdpblJpZ2h0LnZhbCgpLFxuXHRcdFx0XHRcdFx0XHRib3R0b206IHRoaXMuJG1hcmdpbkJvdHRvbS52YWwoKSB9O1xuXG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5zZXQoIFwibWFyZ2luc1wiLCBtYXJnaW5zT2JqICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC50cmlnZ2VyKCBcInVwZGF0ZVwiICk7XG5cblx0XHR9LFxuXG5cdFx0b25Vbml0Q2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0dmFyICRjb250cm9sID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJ1bml0XCIsICRjb250cm9sLnZhbCgpICk7XG5cdFx0fSxcblxuXHRcdG9uSGlkZUxlZ2VuZENoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dmFyICRjaGVjayA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICksXG5cdFx0XHRcdGhpZGVMZWdlbmQgPSAoICRjaGVjay5pcyggXCI6Y2hlY2tlZFwiICkgKT8gdHJ1ZTogZmFsc2U7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5zZXQoIFwiaGlkZS1sZWdlbmRcIiwgaGlkZUxlZ2VuZCApO1xuXG5cdFx0fSxcblxuXHRcdG9uQ2hhcnRUeXBlQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHRpZiggQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LXR5cGVcIiApID09PSBcIjJcIiApIHtcblx0XHRcdFx0Ly9zY2F0dGVyIHBsb3QgaGFzIGxlZ2VuZCBoaWRkZW4gYnkgZGVmYXVsdFxuXHRcdFx0XHRBcHAuQ2hhcnRNb2RlbC5zZXQoIFwiaGlkZS1sZWdlbmRcIiwgdHJ1ZSApO1xuXHRcdFx0fVxuXG5cdFx0fSxcblxuXHRcdHVwZGF0ZVVuaXRzVUk6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHRcblx0XHRcdHZhciBkaW1lbnNpb25zU3RyaW5nID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LWRpbWVuc2lvbnNcIiApLCAvL0FwcC5DaGFydERpbWVuc2lvbnNNb2RlbC5nZXQoIFwiY2hhcnREaW1lbnNpb25zXCIgKSxcblx0XHRcdFx0ZGltZW5zaW9ucyA9ICggISQuaXNFbXB0eU9iamVjdCggZGltZW5zaW9uc1N0cmluZyApICk/ICQucGFyc2VKU09OKCBkaW1lbnNpb25zU3RyaW5nICk6IHt9LFxuXHRcdFx0XHR1bml0c1N0cmluZyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJ1bml0c1wiICksXG5cdFx0XHRcdHVuaXRzID0gKCAhJC5pc0VtcHR5T2JqZWN0KCB1bml0c1N0cmluZyApICk/ICQucGFyc2VKU09OKCB1bml0c1N0cmluZyApOiB7fTtcblx0XHRcdFxuXHRcdFx0Ly9yZWZyZXNoIHdob2xlIHVuaXQgc2VjdGlvblxuXHRcdFx0dGhpcy4kdW5pdHNDb250ZW50Lmh0bWwoIFwiPHVsPjwvdWw+XCIgKTtcblx0XHRcdHZhciAkdWwgPSB0aGlzLiR1bml0c0NvbnRlbnQuZmluZCggXCJ1bFwiICk7XG5cblx0XHRcdGlmKCBkaW1lbnNpb25zICkge1xuXG5cdFx0XHRcdCQuZWFjaCggZGltZW5zaW9ucywgZnVuY3Rpb24oIGksIHYgKSB7XG5cblx0XHRcdFx0XHR2YXIgZGltZW5zaW9uID0gdixcblx0XHRcdFx0XHRcdHVuaXRPYmogPSBfLmZpbmRXaGVyZSggdW5pdHMsIHsgXCJwcm9wZXJ0eVwiOiBkaW1lbnNpb24ucHJvcGVydHkgfSApLFxuXHRcdFx0XHRcdFx0Ly9ieSBkZWZhdWx0IHZpc2libGVcblx0XHRcdFx0XHRcdHZpc2libGUgPSAoIHVuaXRPYmogJiYgdW5pdE9iai5oYXNPd25Qcm9wZXJ0eSggXCJ2aXNpYmxlXCIgKSAgKT8gdW5pdE9iai52aXNpYmxlOiB0cnVlLFxuXHRcdFx0XHRcdFx0dmlzaWJsZVByb3AgPSAoIHZpc2libGUgKT8gXCIgY2hlY2tlZFwiOiBcIlwiLFxuXHRcdFx0XHRcdFx0dW5pdCA9ICggdW5pdE9iaiAmJiB1bml0T2JqLnVuaXQgKT8gdW5pdE9iai51bml0OiBcIlwiLFxuXHRcdFx0XHRcdFx0Zm9ybWF0ID0gKCB1bml0T2JqICYmIHVuaXRPYmouZm9ybWF0ICk/IHVuaXRPYmouZm9ybWF0OiBcIlwiO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdGlmKCAhdW5pdE9iaiAmJiBkaW1lbnNpb24gJiYgZGltZW5zaW9uLnVuaXQgKSB7XG5cdFx0XHRcdFx0XHQvL2lmIG5vdGhpbmcgc3RvcmVkLCB0cnkgdG8gZ2V0IGRlZmF1bHQgdW5pdHMgZm9yIGdpdmVuIHZhcmlhYmxlXG5cdFx0XHRcdFx0XHR1bml0ID0gZGltZW5zaW9uLnVuaXQ7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0dmFyICRsaSA9ICQoIFwiPGxpIGRhdGEtcHJvcGVydHk9J1wiICsgZGltZW5zaW9uLnByb3BlcnR5ICsgXCInPjxsYWJlbD5cIiArIGRpbWVuc2lvbi5uYW1lICsgXCI6PC9sYWJlbD5WaXNpYmxlOjxpbnB1dCB0eXBlPSdjaGVja2JveCcgY2xhc3M9J3Zpc2libGUtaW5wdXQnIFwiICsgdmlzaWJsZVByb3AgKyBcIi8+PGlucHV0IHR5cGU9J2lucHV0JyBjbGFzcz0nZm9ybS1jb250cm9sIHVuaXQtaW5wdXQnIHZhbHVlPSdcIiArIHVuaXQgKyBcIicgcGxhY2Vob2xkZXI9J1VuaXQnIC8+PGlucHV0IHR5cGU9J2lucHV0JyBjbGFzcz0nZm9ybS1jb250cm9sIGZvcm1hdC1pbnB1dCcgdmFsdWU9J1wiICsgZm9ybWF0ICsgXCInIHBsYWNlaG9sZGVyPSdObyBvZiBkZWMuIHBsYWNlcycgLz48L2xpPlwiICk7XG5cdFx0XHRcdFx0JHVsLmFwcGVuZCggJGxpICk7XG5cblx0XHRcdFx0fSApO1xuXG5cdFx0XHR9XG5cdFx0XHRcblx0XHR9LFxuXG5cdFx0dXBkYXRlVW5pdHM6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XG5cdFx0XHR2YXIgdW5pdHMgPSBbXSxcblx0XHRcdFx0JHVuaXRMaXMgPSB0aGlzLiR1bml0c0NvbnRlbnQuZmluZCggXCJsaVwiICk7XG5cblx0XHRcdCQuZWFjaCggJHVuaXRMaXMsIGZ1bmN0aW9uKCBpLCB2ICkge1xuXHRcdFx0XHRcblx0XHRcdFx0dmFyICRsaSA9ICQoIHYgKSxcblx0XHRcdFx0XHQkdmlzaWJsZSA9ICRsaS5maW5kKCBcIi52aXNpYmxlLWlucHV0XCIgKSxcblx0XHRcdFx0XHQkdW5pdCA9ICRsaS5maW5kKCBcIi51bml0LWlucHV0XCIgKSxcblx0XHRcdFx0XHQkZm9ybWF0ID0gJGxpLmZpbmQoIFwiLmZvcm1hdC1pbnB1dFwiICk7XG5cblx0XHRcdFx0Ly9mb3IgZWFjaCBsaSB3aXRoIHVuaXQgaW5mb3JtYXRpb24sIGNvbnN0cnVjdCBvYmplY3Qgd2l0aCBwcm9wZXJ0eSwgdW5pdCBhbmQgZm9ybWF0IHByb3BlcnRpZXNcblx0XHRcdFx0dmFyIHVuaXRTZXR0aW5ncyA9IHtcblx0XHRcdFx0XHRcInByb3BlcnR5XCI6ICRsaS5hdHRyKCBcImRhdGEtcHJvcGVydHlcIiApLFxuXHRcdFx0XHRcdFwidmlzaWJsZVwiOiAkdmlzaWJsZS5pcyggXCI6Y2hlY2tlZFwiICksXG5cdFx0XHRcdFx0XCJ1bml0XCI6ICR1bml0LnZhbCgpLFxuXHRcdFx0XHRcdFwiZm9ybWF0XCI6ICRmb3JtYXQudmFsKClcblx0XHRcdFx0fTtcblx0XHRcdFx0XHRcblx0XHRcdFx0dW5pdHMucHVzaCggdW5pdFNldHRpbmdzICk7XG5cblx0XHRcdH0gKTtcblxuXHRcdFx0dmFyIGpzb24gPSBKU09OLnN0cmluZ2lmeSggdW5pdHMgKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJ1bml0c1wiLCBqc29uICk7XG5cdFx0XHRcblx0XHR9XG5cblx0fSk7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVmlld3MuRm9ybS5TdHlsaW5nVGFiVmlldztcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdEFwcC5WaWV3cy5Gb3JtLkNoYXJ0VHlwZVNlY3Rpb25WaWV3ID0gQmFja2JvbmUuVmlldy5leHRlbmQoe1xuXG5cdFx0ZWw6IFwiI2Zvcm0tdmlldyAjYmFzaWMtdGFiIC5jaGFydC10eXBlLXNlY3Rpb25cIixcblx0XHRldmVudHM6IHtcblx0XHRcdFwiY2hhbmdlIFtuYW1lPSdjaGFydC10eXBlJ11cIjogXCJvbkNoYXJ0VHlwZUNoYW5nZVwiLFxuXHRcdH0sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdFxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gb3B0aW9ucy5kaXNwYXRjaGVyO1xuXHRcdFx0QXBwLkNoYXJ0RGltZW5zaW9uc01vZGVsLm9uKCBcImNoYW5nZVwiLCB0aGlzLnJlbmRlciwgdGhpcyApO1xuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblxuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyICRzZWxlY3QgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPSdjaGFydC10eXBlJ11cIiApLFxuXHRcdFx0XHRzZWxlY3RlZENoYXJ0VHlwZSA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10eXBlXCIgKTtcblx0XHRcdGlmKCBzZWxlY3RlZENoYXJ0VHlwZSApIHtcblx0XHRcdFx0JHNlbGVjdC52YWwoIHNlbGVjdGVkQ2hhcnRUeXBlICk7XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdG9uQ2hhcnRUeXBlQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHQvL2NsZWFyIHVmIHNvbWV0aGluZyBwcmV2aW91c2x5IHNlbGVjdGVkXG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC51bnNldCggXCJ2YXJpYWJsZXNcIiwge3NpbGVudDp0cnVlfSApO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwudW5zZXQoIFwiY2hhcnQtZGltZW5zaW9uc1wiLCB7c2lsZW50OnRydWV9ICk7XG5cblx0XHRcdHZhciAkc2VsZWN0ID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJjaGFydC10eXBlXCIsICRzZWxlY3QudmFsKCkgKTtcblxuXHRcdFx0QXBwLkNoYXJ0RGltZW5zaW9uc01vZGVsLmxvYWRDb25maWd1cmF0aW9uKCAkc2VsZWN0LnZhbCgpICk7XG5cblx0XHR9XG5cblx0fSk7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVmlld3MuRm9ybS5DaGFydFR5cGVTZWN0aW9uVmlldztcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBTZWxlY3RWYXJQb3B1cCA9IHJlcXVpcmUoIFwiLi8uLi8uLi91aS9BcHAuVmlld3MuVUkuU2VsZWN0VmFyUG9wdXAuanNcIiApLFxuXHRcdFNldHRpbmdzVmFyUG9wdXAgPSByZXF1aXJlKCBcIi4vLi4vLi4vdWkvQXBwLlZpZXdzLlVJLlNldHRpbmdzVmFyUG9wdXAuanNcIiApO1xuXG5cdEFwcC5WaWV3cy5Gb3JtLkFkZERhdGFTZWN0aW9uVmlldyA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblxuXHRcdGVsOiBcIiNmb3JtLXZpZXcgI2RhdGEtdGFiIC5hZGQtZGF0YS1zZWN0aW9uXCIsXG5cdFx0ZXZlbnRzOiB7XG5cdFx0XHRcImNsaWNrIC5hZGQtZGF0YS1idG5cIjogXCJvbkFkZERhdGFCdG5cIixcblx0XHR9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHRcblx0XHRcdHRoaXMuZGlzcGF0Y2hlciA9IG9wdGlvbnMuZGlzcGF0Y2hlcjtcblxuXHRcdFx0dGhpcy5zZWxlY3RWYXJQb3B1cCA9IG5ldyBTZWxlY3RWYXJQb3B1cCgpO1xuXHRcdFx0dGhpcy5zZWxlY3RWYXJQb3B1cC5pbml0KCBvcHRpb25zICk7XG5cblx0XHRcdHRoaXMuc2V0dGluZ3NWYXJQb3B1cCA9IG5ldyBTZXR0aW5nc1ZhclBvcHVwKCk7XG5cdFx0XHR0aGlzLnNldHRpbmdzVmFyUG9wdXAuaW5pdCggb3B0aW9ucyApO1xuXG5cdFx0XHRBcHAuQ2hhcnRWYXJpYWJsZXNDb2xsZWN0aW9uLm9uKCBcInJlc2V0XCIsIHRoaXMub25WYXJpYWJsZVJlc2V0LCB0aGlzICk7XG5cdFx0XHRBcHAuQ2hhcnRWYXJpYWJsZXNDb2xsZWN0aW9uLm9uKCBcImFkZFwiLCB0aGlzLm9uVmFyaWFibGVBZGQsIHRoaXMgKTtcblx0XHRcdEFwcC5DaGFydFZhcmlhYmxlc0NvbGxlY3Rpb24ub24oIFwicmVtb3ZlXCIsIHRoaXMub25WYXJpYWJsZVJlbW92ZSwgdGhpcyApO1xuXG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIub24oIFwidmFyaWFibGUtbGFiZWwtbW92ZWRcIiwgdGhpcy5vblZhcmlhYmxlTGFiZWxNb3ZlZCwgdGhpcyApO1xuXHRcdFx0dGhpcy5kaXNwYXRjaGVyLm9uKCBcImRpbWVuc2lvbi1zZXR0aW5nLXVwZGF0ZVwiLCB0aGlzLm9uRGltZW5zaW9uU2V0dGluZ1VwZGF0ZSwgdGhpcyApO1xuXG5cdFx0XHR0aGlzLnJlbmRlcigpO1xuXG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cblx0XHRcdHRoaXMuJGRkID0gdGhpcy4kZWwuZmluZCggXCIuZGRcIiApO1xuXHRcdFx0dGhpcy4kZGRMaXN0ID0gdGhpcy4kZGQuZmluZCggXCIuZGQtbGlzdFwiICk7XG5cdFx0XHR0aGlzLiRkZC5uZXN0YWJsZSgpO1xuXG5cdFx0XHR0aGlzLm9uVmFyaWFibGVSZXNldCgpO1xuXG5cdFx0fSxcblxuXHRcdHJlZnJlc2hIYW5kbGVyczogZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgJHJlbW92ZUJ0bnMgPSB0aGlzLiRkZExpc3QuZmluZCggXCIuZmEtY2xvc2VcIiApO1xuXHRcdFx0JHJlbW92ZUJ0bnMub24oIFwiY2xpY2tcIiwgJC5wcm94eSggdGhpcy5vblJlbW92ZUJ0bkNsaWNrLCB0aGlzICkgKTtcblx0XHRcdHRoaXMuJGRkLm5lc3RhYmxlKCk7XG5cdFx0fSxcblxuXHRcdG9uQWRkRGF0YUJ0bjogZnVuY3Rpb24oKSB7XG5cblx0XHRcdHRoaXMuc2VsZWN0VmFyUG9wdXAuc2hvdygpO1xuXG5cdFx0fSxcblxuXHRcdG9uVmFyaWFibGVSZXNldDogZnVuY3Rpb24oKSB7XG5cblx0XHRcdHZhciB0aGF0ID0gdGhpcyxcblx0XHRcdFx0bW9kZWxzID0gQXBwLkNoYXJ0VmFyaWFibGVzQ29sbGVjdGlvbi5tb2RlbHM7XG5cdFx0XHRfLmVhY2goIG1vZGVscywgZnVuY3Rpb24oIHYsIGkgKSB7XG5cdFx0XHRcdHRoYXQub25WYXJpYWJsZUFkZCggdiApO1xuXHRcdFx0fSApO1xuXG5cdFx0fSxcblxuXHRcdG9uVmFyaWFibGVBZGQ6IGZ1bmN0aW9uKCBtb2RlbCApIHtcblxuXHRcdFx0Ly9pZiB0aGVyZSdzIGVtcHR5IGVsZW1lbnQsIHJlbW92ZSBpdFxuXHRcdFx0dGhpcy4kZWwuZmluZCggXCIuZGQtZW1wdHlcIiApLnJlbW92ZSgpO1xuXHRcdFx0Ly9yZWZldGNoIGRkLWxpc3QgLSBuZWVkZWQgaWYgdGhlcmUgd2FzIHNvbWV0aGluZyByZW1vdmVkXG5cdFx0XHR0aGlzLiRkZExpc3QgPSB0aGlzLiRkZC5maW5kKCBcIi5kZC1saXN0XCIgKTtcblxuXHRcdFx0aWYoICF0aGlzLiRkZC5maW5kKCBcIi5kZC1saXN0XCIgKS5sZW5ndGggKSB7XG5cdFx0XHRcdC8vZGQtbGlzdCBoYXMgYmVlbiByZW1vdmVkIGJ5IG5lc3RhYmxlXG5cdFx0XHRcdHZhciAkZGRMaXN0ID0gJCggXCI8b2wgY2xhc3M9J2RkLWxpc3QnPjwvb2w+XCIgKTtcblx0XHRcdFx0dGhpcy4kZGQuYXBwZW5kKCAkZGRMaXN0ICk7XG5cdFx0XHRcdHRoaXMuJGRkTGlzdCA9IHRoaXMuJGRkLmZpbmQoIFwiLmRkLWxpc3RcIiApO1xuXHRcdFx0fVxuXG5cdFx0XHQvL2hhdmUgZGVmYXVsdCB0YXJnZXQgeWVhciBmb3Igc2NhdHRlciBwbG90XG5cdFx0XHR2YXIgZGVmYXVsdFBlcmlvZCA9ICggQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LXR5cGVcIiApID09PSBcIjJcIiApPyBcInNpbmdsZVwiOiBcImFsbFwiLFxuXHRcdFx0XHRkZWZhdWx0TW9kZSA9ICggQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LXR5cGVcIiApID09PSBcIjJcIiApPyBcInNwZWNpZmljXCI6IFwiY2xvc2VzdFwiLFxuXHRcdFx0XHRkZWZhdWx0VGFyZ2V0WWVhciA9IDIwMDAsXG5cdFx0XHRcdGRlZmF1bHRNYXhBZ2UgPSA1LFxuXHRcdFx0XHRkZWZhdWx0VG9sZXJhbmNlID0gNTtcblxuXHRcdFx0dmFyICRsaSA9ICQoIFwiPGxpIGNsYXNzPSd2YXJpYWJsZS1sYWJlbCBkZC1pdGVtJyBkYXRhLXVuaXQ9J1wiICsgbW9kZWwuZ2V0KCBcInVuaXRcIiApICsgXCInIGRhdGEtcGVyaW9kPSdcIiArIGRlZmF1bHRQZXJpb2QgKyBcIicgZGF0YS10b2xlcmFuY2U9J1wiICsgZGVmYXVsdFRvbGVyYW5jZSArIFwiJyBkYXRhLW1heGltdW0tYWdlPSdcIiArIGRlZmF1bHRNYXhBZ2UgKyBcIicgZGF0YS1tb2RlPSdcIiArIGRlZmF1bHRNb2RlICsgXCInIGRhdGEtdGFyZ2V0LXllYXI9J1wiICsgZGVmYXVsdFRhcmdldFllYXIgKyBcIicgZGF0YS12YXJpYWJsZS1pZD0nXCIgKyBtb2RlbC5nZXQoIFwiaWRcIiApICsgXCInPjxkaXYgY2xhc3M9J2RkLWhhbmRsZSc+PGRpdiBjbGFzcz0nZGQtaW5uZXItaGFuZGxlJz48c3BhbiBjbGFzcz0ndmFyaWFibGUtbGFiZWwtbmFtZSc+XCIgKyBtb2RlbC5nZXQoIFwibmFtZVwiICkgKyBcIjwvc3Bhbj48c3BhbiBjbGFzcz0ndmFyaWFibGUtbGFiZWwtaW5wdXQnPjxpbnB1dCBjbGFzcz0nZm9ybS1jb250cm9sJy8+PGkgY2xhc3M9J2ZhIGZhLWNoZWNrJz48L2k+PGkgY2xhc3M9J2ZhIGZhLXRpbWVzJz48L2k+PC9kaXY+PC9kaXY+PGEgaHJlZj0nJyBjbGFzcz0ndmFyaWFibGUtc2V0dGluZy1idG4nPjxzcGFuIGNsYXNzPSdmYSBwZXJpb2QtaWNvbic+PC9zcGFuPjxzcGFuIGNsYXNzPSdudW1iZXItaWNvbic+PC9zcGFuPjxzcGFuIGNsYXNzPSdmYSBmYS1jb2cnIHRpdGxlPSdTZXR0aW5nIHZhcmlhYmxlJz48L3NwYW4+PC9hPjxzcGFuIGNsYXNzPSdmYSBmYS1jbG9zZSc+PC9zcGFuPjwvbGk+XCIgKSxcblx0XHRcdFx0JHNldHRpbmdzID0gJGxpLmZpbmQoIFwiLnZhcmlhYmxlLXNldHRpbmctYnRuXCIgKTtcblx0XHRcdHRoaXMuJGRkTGlzdC5hcHBlbmQoICRsaSApO1xuXHRcdFx0XG5cdFx0XHQkc2V0dGluZ3Mub24oIFwiY2xpY2tcIiwgJC5wcm94eSggdGhpcy5vblNldHRpbmdzQ2xpY2ssIHRoaXMgKSApO1xuXHRcdFx0XG5cdFx0XHR2YXIgJHZhcmlhYmxlTGFiZWxOYW1lID0gJGxpLmZpbmQoIFwiLnZhcmlhYmxlLWxhYmVsLW5hbWVcIiApLFxuXHRcdFx0XHQkdmFyaWFibGVMYWJlbElucHV0ID0gJGxpLmZpbmQoIFwiLnZhcmlhYmxlLWxhYmVsLWlucHV0IGlucHV0XCIgKSxcblx0XHRcdFx0JGNvbmZpcm1OYW1lQnRuID0gJGxpLmZpbmQoIFwiLmZhLWNoZWNrXCIgKSxcblx0XHRcdFx0JGNhbmNlbE5hbWVCdG4gPSAkbGkuZmluZCggXCIuZmEtdGltZXNcIiApO1xuXG5cdFx0XHQkdmFyaWFibGVMYWJlbE5hbWUub24oIFwibW91c2Vkb3duXCIsICQucHJveHkoIHRoaXMub25WYXJpYWJsZU5hbWVDbGljaywgdGhpcyApICk7XG5cdFx0XHQkY29uZmlybU5hbWVCdG4ub24oIFwibW91c2Vkb3duXCIsICQucHJveHkoIHRoaXMub25OYW1lQnRuQ2xpY2ssIHRoaXMgKSApO1xuXHRcdFx0JGNhbmNlbE5hbWVCdG4ub24oIFwibW91c2Vkb3duXCIsICQucHJveHkoIHRoaXMub25OYW1lQnRuQ2xpY2ssIHRoaXMgKSApO1xuXHRcdFx0JHZhcmlhYmxlTGFiZWxJbnB1dC5vbiggXCJtb3VzZWRvd25cIiwgJC5wcm94eSggdGhpcy5vbkxhYmVsSW5wdXQsIHRoaXMgKSApO1xuXG5cdFx0XHR0aGlzLnJlZnJlc2hIYW5kbGVycygpO1xuXHRcdFx0dGhpcy51cGRhdGVWYXJJY29ucygpO1xuXG5cdFx0fSxcblxuXHRcdG9uUmVtb3ZlQnRuQ2xpY2s6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0dmFyICRidG4gPSAkKCBldnQuY3VycmVudFRhcmdldCApLFxuXHRcdFx0XHQkbGFiZWwgPSAkYnRuLnBhcmVudHMoIFwiLnZhcmlhYmxlLWxhYmVsXCIgKSxcblx0XHRcdFx0dmFyaWFibGVJZCA9ICRsYWJlbC5hdHRyKCBcImRhdGEtdmFyaWFibGUtaWRcIiApO1xuXHRcdFx0QXBwLkNoYXJ0VmFyaWFibGVzQ29sbGVjdGlvbi5yZW1vdmUoIHZhcmlhYmxlSWQgKTtcblxuXHRcdH0sXG5cblx0XHRvblZhcmlhYmxlTGFiZWxNb3ZlZDogZnVuY3Rpb24oICkge1xuXG5cdFx0XHQvL2NoZWNrIGlmIHRoZXJlJ3MgYW55IHZhcmlhYmxlIGxhYmVsIGxlZnQsIGlmIG5vdCBpbnNlcnQgZW1wdHkgZGQgcGxhY2Vob2xkZXJcblx0XHRcdGlmKCAhdGhpcy4kZWwuZmluZCggXCIudmFyaWFibGUtbGFiZWxcIiApLmxlbmd0aCApIHtcblx0XHRcdFx0dGhpcy4kZWwuZmluZCggXCIuZGQtbGlzdFwiICkucmVwbGFjZVdpdGgoIFwiPGRpdiBjbGFzcz0nZGQtZW1wdHknPjwvZGl2PlwiICk7XG5cdFx0XHR9XG5cblx0XHR9LFxuXG5cdFx0b25TZXR0aW5nc0NsaWNrOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHRldnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG5cdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcblxuXHRcdFx0dmFyICRidG4gPSAkKCBldnQuY3VycmVudFRhcmdldCApLFxuXHRcdFx0XHQkcGFyZW50ID0gJGJ0bi5wYXJlbnQoKTtcblx0XHRcdFx0XG5cdFx0XHR0aGlzLnNldHRpbmdzVmFyUG9wdXAuc2hvdyggJHBhcmVudCApO1xuXG5cdFx0fSxcblxuXHRcdG9uRGltZW5zaW9uU2V0dGluZ1VwZGF0ZTogZnVuY3Rpb24oIGRhdGEgKSB7XG5cblx0XHRcdC8vZmluZCB1cGRhdGVkIHZhcmlhYmxlXG5cdFx0XHR2YXIgJHZhcmlhYmxlTGFiZWwgPSAkKCBcIi52YXJpYWJsZS1sYWJlbFtkYXRhLXZhcmlhYmxlLWlkPSdcIiArIGRhdGEudmFyaWFibGVJZCArIFwiJ11cIiApO1xuXHRcdFx0Ly91cGRhdGUgYWxsIGF0dHJpYnV0ZXNcblx0XHRcdGZvciggdmFyIGkgaW4gZGF0YSApIHtcblx0XHRcdFx0aWYoIGRhdGEuaGFzT3duUHJvcGVydHkoIGkgKSAmJiBpICE9PSBcInZhcmlhYmxlSWRcIiApIHtcblx0XHRcdFx0XHR2YXIgYXR0ck5hbWUgPSBcImRhdGEtXCIgKyBpLFxuXHRcdFx0XHRcdFx0YXR0clZhbHVlID0gZGF0YVsgaSBdO1xuXHRcdFx0XHRcdCR2YXJpYWJsZUxhYmVsLmF0dHIoIGF0dHJOYW1lLCBhdHRyVmFsdWUgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvL2lmIHN5bmMgcGVyaW9kIHZhbHVlcyBmb3IgYWxsIHZhcmlhYmxlcyBcblx0XHRcdHZhciAkdmFyaWFibGVMYWJlbHMgPSAkKCBcIi52YXJpYWJsZS1sYWJlbFwiICk7XG5cdFx0XHQkdmFyaWFibGVMYWJlbHMuYXR0ciggXCJkYXRhLXBlcmlvZFwiLCBkYXRhLnBlcmlvZCApO1xuXG5cdFx0XHR0aGlzLnVwZGF0ZVZhckljb25zKCk7XG5cblx0XHRcdC8vaGlkZSBwb3B1cFxuXHRcdFx0dGhpcy5zZXR0aW5nc1ZhclBvcHVwLmhpZGUoKTtcblxuXHRcdFx0Ly90cmlnZ2VyIHVwZGF0aW5nIG1vZGVsXG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIudHJpZ2dlciggXCJkaW1lbnNpb24tdXBkYXRlXCIgKTtcblxuXHRcdH0sXG5cblx0XHR1cGRhdGVWYXJJY29uczogZnVuY3Rpb24oKSB7XG5cdFx0XHRcblx0XHRcdHZhciAkdmFyaWFibGVMYWJlbHMgPSAkKCBcIi52YXJpYWJsZS1sYWJlbFwiICk7XG5cblx0XHRcdC8vdXBkYXRlIGljb25zXG5cdFx0XHQkLmVhY2goICR2YXJpYWJsZUxhYmVscywgZnVuY3Rpb24oIGksIHYgKSB7XG5cblx0XHRcdFx0dmFyICRsYWJlbCA9ICQoIHYgKSxcblx0XHRcdFx0XHQkcGVyaW9kSWNvbiA9ICRsYWJlbC5maW5kKCBcIi5wZXJpb2QtaWNvblwiICksXG5cdFx0XHRcdFx0JG1vZGVJY29uID0gJGxhYmVsLmZpbmQoIFwiLm1vZGUtaWNvblwiICksXG5cdFx0XHRcdFx0JG51bWJlckljb24gPSAkbGFiZWwuZmluZCggXCIubnVtYmVyLWljb25cIiApO1xuXG5cdFx0XHRcdC8vbW9kZVxuXHRcdFx0XHR2YXIgcGVyaW9kID0gJGxhYmVsLmF0dHIoIFwiZGF0YS1wZXJpb2RcIiApLFxuXHRcdFx0XHRcdG1vZGUgPSAkbGFiZWwuYXR0ciggXCJkYXRhLW1vZGVcIiApO1xuXHRcdFx0XHRpZiggcGVyaW9kID09PSBcImFsbFwiICkge1xuXHRcdFx0XHRcdCRwZXJpb2RJY29uLmFkZENsYXNzKCBcImZhLWFycm93cy1oXCIgKTtcblx0XHRcdFx0XHQkcGVyaW9kSWNvbi5yZW1vdmVDbGFzcyggXCJmYS1jaXJjbGVcIiApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdCRwZXJpb2RJY29uLnJlbW92ZUNsYXNzKCBcImZhLWFycm93cy1oXCIgKTtcblx0XHRcdFx0XHQkcGVyaW9kSWNvbi5hZGRDbGFzcyggXCJmYS1jaXJjbGVcIiApO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYoIHBlcmlvZCA9PT0gXCJzaW5nbGVcIiAmJiBtb2RlID09PSBcInNwZWNpZmljXCIgKSB7XG5cdFx0XHRcdFx0JG51bWJlckljb24uaHRtbCggJGxhYmVsLmF0dHIoIFwiZGF0YS10YXJnZXQteWVhclwiICkgKyBcIi9cIiArICRsYWJlbC5hdHRyKCBcImRhdGEtdG9sZXJhbmNlXCIgKSApO1xuXHRcdFx0XHR9IGVsc2UgaWYoIHBlcmlvZCA9PSBcInNpbmdsZVwiICYmIG1vZGUgPT09IFwibGF0ZXN0XCIgKSB7XG5cdFx0XHRcdFx0JG51bWJlckljb24uaHRtbCggXCI8c3BhbiBjbGFzcz0nZmEgZmEtbG9uZy1hcnJvdy1yaWdodCc+PC9zcGFuPi9cIiArICRsYWJlbC5hdHRyKCBcImRhdGEtbWF4aW11bS1hZ2VcIiApICk7XG5cdFx0XHRcdH0gZWxzZSBpZiggcGVyaW9kID09IFwiYWxsXCIgJiYgbW9kZSA9PT0gXCJjbG9zZXN0XCIgKSB7XG5cdFx0XHRcdFx0JG51bWJlckljb24uaHRtbCggJGxhYmVsLmF0dHIoIFwiZGF0YS10b2xlcmFuY2VcIiApICk7XG5cdFx0XHRcdH0gZWxzZSBpZiggcGVyaW9kID09IFwiYWxsXCIgJiYgbW9kZSA9PT0gXCJsYXRlc3RcIiApIHtcblx0XHRcdFx0XHQkbnVtYmVySWNvbi5odG1sKCBcIjxzcGFuIGNsYXNzPSdmYSBmYS1sb25nLWFycm93LXJpZ2h0Jz48L3NwYW4+L1wiICsgJGxhYmVsLmF0dHIoIFwiZGF0YS1tYXhpbXVtLWFnZVwiICkgKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8qJHBlcmlvZEljb24udGV4dCggJGxhYmVsLmF0dHIoIFwiZGF0YS1wZXJpb2RcIiApICk7XG5cdFx0XHRcdCRtb2RlSWNvbi50ZXh0KCAkbGFiZWwuYXR0ciggXCJkYXRhLW1vZGVcIiApICk7XG5cdFx0XHRcdCRudW1iZXJJY29uLnRleHQoICRsYWJlbC5hdHRyKCBcImRhdGEtdGFyZ2V0LXllYXJcIiApICk7Ki9cblxuXHRcdFx0fSApO1xuXG5cdFx0fSxcblxuXHRcdG9uVmFyaWFibGVOYW1lQ2xpY2s6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdHZhciAkbmFtZSA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICksXG5cdFx0XHRcdCRwYXJlbnQgPSAkbmFtZS5wYXJlbnQoKSxcblx0XHRcdFx0JHZhcmlhYmxlTGFiZWxJbnB1dCA9ICRwYXJlbnQuZmluZCggXCIudmFyaWFibGUtbGFiZWwtaW5wdXRcIiApLFxuXHRcdFx0XHQkaW5wdXQgPSAkdmFyaWFibGVMYWJlbElucHV0LmZpbmQoIFwiaW5wdXRcIiApLFxuXHRcdFx0XHQkY29nID0gJHBhcmVudC5wYXJlbnQoKS5wYXJlbnQoKS5maW5kKCBcIi52YXJpYWJsZS1zZXR0aW5nLWJ0blwiICk7XG5cdFx0XHRcblx0XHRcdC8vbWFrZSBzdXJlIHZhcmlhYmxlIGlzIGluIGRpbWVuc2lvbiBzZWN0aW9uXG5cdFx0XHRpZiggJHBhcmVudC5wYXJlbnRzKCBcIi5kaW1lbnNpb25zLXNlY3Rpb25cIiApLmxlbmd0aCApIHtcblxuXHRcdFx0XHQvL3N0b3BwaW5nIHByb3BhZ2F0aW9uIG5vdCBhdCB0aGUgdG9wLCBidXQgaGVyZSwgdG8gZW5hYmxlIGRyYWcmZHJvcCBvdXRzaWRlIG9mIGRpbWVuc2lvbiBzZWN0aW9uXG5cdFx0XHRcdGV2dC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcblx0XHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cblx0XHRcdFx0JGNvZy5hZGRDbGFzcyggXCJoaWRkZW5cIiApO1xuXHRcdFx0XHQkbmFtZS5oaWRlKCk7XG5cdFx0XHRcdCR2YXJpYWJsZUxhYmVsSW5wdXQuc2hvdygpO1xuXHRcdFx0XHQkaW5wdXQudmFsKCAkbmFtZS50ZXh0KCkgKTtcblx0XHRcdH1cblxuXHRcdH0sXG5cblx0XHRvbk5hbWVCdG5DbGljazogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0ZXZ0LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuXHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cblx0XHRcdHZhciAkaW5wdXRCdG4gPSAkKCBldnQuY3VycmVudFRhcmdldCApLFxuXHRcdFx0XHQkdmFyaWFibGVMYWJlbElucHV0ID0gJGlucHV0QnRuLnBhcmVudCgpLFxuXHRcdFx0XHQkcGFyZW50ID0gJHZhcmlhYmxlTGFiZWxJbnB1dC5wYXJlbnQoKSxcblx0XHRcdFx0JHZhcmlhYmxlTGFiZWxOYW1lID0gJHBhcmVudC5maW5kKCBcIi52YXJpYWJsZS1sYWJlbC1uYW1lXCIgKSxcblx0XHRcdFx0JGNvZyA9ICRwYXJlbnQucGFyZW50KCkucGFyZW50KCkuZmluZCggXCIudmFyaWFibGUtc2V0dGluZy1idG5cIiApO1xuXHRcdFx0XG5cdFx0XHQkY29nLnJlbW92ZUNsYXNzKCBcImhpZGRlblwiICk7XG4gXG5cdFx0XHRpZiggJGlucHV0QnRuLmhhc0NsYXNzKCBcImZhLWNoZWNrXCIgKSApIHtcblx0XHRcdFx0Ly9jb25maXJtYXRpb24gb2YgY2hhbmdlIHRvIHZhcmlhYmxlIG5hbWVcblx0XHRcdFx0dmFyICRpbnB1dCA9ICR2YXJpYWJsZUxhYmVsSW5wdXQuZmluZCggXCJpbnB1dFwiICksXG5cdFx0XHRcdFx0aW5wdXRWYWwgPSAkaW5wdXQudmFsKCksXG5cdFx0XHRcdFx0JHZhcmlhYmxlTGFiZWwgPSAkdmFyaWFibGVMYWJlbElucHV0LnBhcmVudHMoIFwiLnZhcmlhYmxlLWxhYmVsXCIgKTtcblx0XHRcdFx0JHZhcmlhYmxlTGFiZWxOYW1lLnRleHQoIGlucHV0VmFsICk7XG5cdFx0XHRcdCR2YXJpYWJsZUxhYmVsLmF0dHIoIFwiZGF0YS1kaXNwbGF5LW5hbWVcIiwgaW5wdXRWYWwgKTtcblx0XHRcdFx0dGhpcy5kaXNwYXRjaGVyLnRyaWdnZXIoIFwiZGltZW5zaW9uLXVwZGF0ZVwiICk7XG5cdFx0XHR9XG5cblx0XHRcdCR2YXJpYWJsZUxhYmVsSW5wdXQuaGlkZSgpO1xuXHRcdFx0JHZhcmlhYmxlTGFiZWxOYW1lLnNob3coKTtcblxuXHRcdH0sXG5cblx0XHRvbkxhYmVsSW5wdXQ6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdGV2dC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcblx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXG5cdFx0XHR2YXIgJGlucHV0ID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKTtcblx0XHRcdCRpbnB1dC5mb2N1cygpO1xuXG5cdFx0fSxcblxuXHRcdG9uVmFyaWFibGVSZW1vdmU6IGZ1bmN0aW9uKCBtb2RlbCApIHtcblx0XHRcdHZhciAkbGlUb1JlbW92ZSA9ICQoIFwiLnZhcmlhYmxlLWxhYmVsW2RhdGEtdmFyaWFibGUtaWQ9J1wiICsgbW9kZWwuZ2V0KCBcImlkXCIgKSArIFwiJ11cIiApO1xuXHRcdFx0JGxpVG9SZW1vdmUucmVtb3ZlKCk7XG5cdFx0fVxuXG5cdH0pO1xuXHRcblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVmlld3MuRm9ybS5BZGREYXRhU2VjdGlvblZpZXc7XG5cdFxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdEFwcC5WaWV3cy5Gb3JtLkRpbWVuc2lvbnNTZWN0aW9uVmlldyA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblxuXHRcdGVsOiBcIiNmb3JtLXZpZXcgI2RhdGEtdGFiIC5kaW1lbnNpb25zLXNlY3Rpb25cIixcblx0XHRldmVudHM6IHtcblx0XHRcdFwiY2hhbmdlIFtuYW1lPSdjaGFydC10eXBlJ11cIjogXCJvbkNoYXJ0VHlwZUNoYW5nZVwiLFxuXHRcdFx0XCJjaGFuZ2UgW25hbWU9J2dyb3VwLWJ5LXZhcmlhYmxlJ11cIjogXCJvbkdyb3VwQnlWYXJpYWJsZUNoYW5nZVwiLFxuXHRcdH0sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdFxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gb3B0aW9ucy5kaXNwYXRjaGVyO1xuXHRcdFx0QXBwLkNoYXJ0RGltZW5zaW9uc01vZGVsLm9uKCBcInJlc2V0IGNoYW5nZVwiLCB0aGlzLnJlbmRlciwgdGhpcyApO1xuXG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIub24oIFwiZGltZW5zaW9uLXVwZGF0ZVwiLCB0aGlzLm9uRGltZW5zaW9uVXBkYXRlLCB0aGlzICk7XG5cdFx0XHRcblx0XHRcdHRoaXMucmVuZGVyKCk7XG5cblx0XHR9LFxuXG5cdFx0aW5pdGVkOiBmYWxzZSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cblx0XHRcdHRoaXMuJGZvcm1TZWN0aW9uQ29udGVudCA9IHRoaXMuJGVsLmZpbmQoIFwiLmZvcm0tc2VjdGlvbi1jb250ZW50XCIgKTtcblx0XHRcdHRoaXMuJGRpbWVuc2lvbnNJbnB1dCA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9J2NoYXJ0LWRpbWVuc2lvbnMnXVwiICk7XG5cdFx0XHR0aGlzLiRncm91cEJ5VmFyaWFibGUgPSB0aGlzLiRlbC5maW5kKCBcIi5ncm91cC1ieS12YXJpYWJsZS13cmFwcGVyXCIgKTtcblx0XHRcdHRoaXMuJGdyb3VwQnlWYXJpYWJsZUlucHV0ID0gdGhpcy4kZ3JvdXBCeVZhcmlhYmxlLmZpbmQoIFwiW25hbWU9J2dyb3VwLWJ5LXZhcmlhYmxlJ11cIiApO1xuXG5cdFx0XHQvL2dldCByaWQgb2Ygb2xkIGNvbnRlbnRcblx0XHRcdHRoaXMuJGZvcm1TZWN0aW9uQ29udGVudC5lbXB0eSgpO1xuXG5cdFx0XHQvL2NvbnN0cnVjdCBodG1sXG5cdFx0XHR2YXIgY2hhcnRUeXBlID0gQXBwLkNoYXJ0RGltZW5zaW9uc01vZGVsLmlkLFxuXHRcdFx0XHRkaW1lbnNpb25zID0gQXBwLkNoYXJ0RGltZW5zaW9uc01vZGVsLmdldCggXCJjaGFydERpbWVuc2lvbnNcIiApLFxuXHRcdFx0XHRodG1sU3RyaW5nID0gXCI8b2wgY2xhc3M9J2RpbWVuc2lvbnMtbGlzdCBjaGFydC10eXBlLVwiICsgY2hhcnRUeXBlICsgXCInPlwiO1xuXG5cdFx0XHRfLmVhY2goIGRpbWVuc2lvbnMsIGZ1bmN0aW9uKCB2LCBrICkge1xuXHRcdFx0XHRodG1sU3RyaW5nICs9IFwiPGxpIGRhdGEtcHJvcGVydHk9J1wiICsgdi5wcm9wZXJ0eSArIFwiJyBjbGFzcz0nZGltZW5zaW9uLWJveCc+PGg0PlwiICsgdi5uYW1lICsgXCI8L2g0PjxkaXYgY2xhc3M9J2RkLXdyYXBwZXInPjxkaXYgY2xhc3M9J2RkJz48ZGl2IGNsYXNzPSdkZC1lbXB0eSc+PC9kaXY+PC9kaXY+PC9kaXY+PC9saT5cIjtcblx0XHRcdH0gKTtcblxuXHRcdFx0aHRtbFN0cmluZyArPSBcIjwvb2w+XCI7XG5cblx0XHRcdHZhciAkaHRtbCA9ICQoIGh0bWxTdHJpbmcgKTtcblx0XHRcdHRoaXMuJGZvcm1TZWN0aW9uQ29udGVudC5hcHBlbmQoICRodG1sICk7XG5cblx0XHRcdC8vaW5pdCBuZXN0YWJsZSBcblx0XHRcdHRoaXMuJGRkID0gdGhpcy4kZWwuZmluZCggXCIuZGRcIiApO1xuXHRcdFx0Ly9uZXN0YWJsZSBkZXN0cm95XG5cdFx0XHR0aGlzLiRkZC5uZXN0YWJsZSgpO1xuXHRcdFx0XHRcdFx0XG5cdFx0XHQvL2ZldGNoIHJlbWFpbmcgZG9tXG5cdFx0XHR0aGlzLiRkaW1lbnNpb25Cb3hlcyA9IHRoaXMuJGVsLmZpbmQoIFwiLmRpbWVuc2lvbi1ib3hcIiApO1xuXG5cdFx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0XHR0aGlzLiRkZC5vbignY2hhbmdlJywgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHRoYXQudXBkYXRlSW5wdXQoKTtcblx0XHRcdH0pO1xuXG5cdFx0XHQvL2lmIGVkaXRpbmcgY2hhcnQgLSBhc3NpZ24gcG9zc2libGUgY2hhcnQgZGltZW5zaW9ucyB0byBhdmFpbGFibGUgZGltZW5zaW9uc1xuXHRcdFx0dmFyIGNoYXJ0RGltZW5zaW9ucyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC1kaW1lbnNpb25zXCIgKTtcblx0XHRcdHRoaXMuc2V0SW5wdXRzKCBjaGFydERpbWVuc2lvbnMgKTtcblxuXHRcdFx0Ly9oYW5kbGUgZ3JvdXAgYnkgdmFyaWFibGUgY2hlY2tib3hcblx0XHRcdGlmKCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdHlwZVwiICkgPT0gMSB8fCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdHlwZVwiICkgPT0gMyApIHtcblx0XHRcdFx0Ly9pcyBsaW5lY2hhcnQsIHNvIHRoaXMgY2hlY2tib3ggaXMgcmVsZXZhbnRcblx0XHRcdFx0dmFyIGdyb3VwQnlWYXJpYWJsZXMgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiZ3JvdXAtYnktdmFyaWFibGVzXCIgKTtcblx0XHRcdFx0dGhpcy4kZ3JvdXBCeVZhcmlhYmxlSW5wdXQucHJvcCggXCJjaGVja2VkXCIsIGdyb3VwQnlWYXJpYWJsZXMgKTtcblx0XHRcdFx0dGhpcy4kZ3JvdXBCeVZhcmlhYmxlLnNob3coKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vaXMgbm90IGxpbmVjaGFydCwgbWFrZSBzdXJlIGdyb3VwaW5nIG9mIHZhcmlhYmxlcyBpcyBvZmYgYW5kIGhpZGUgaW5wdXRcblx0XHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0KCBcImdyb3VwLWJ5LXZhcmlhYmxlc1wiLCBmYWxzZSApO1xuXHRcdFx0XHR0aGlzLiRncm91cEJ5VmFyaWFibGUuaGlkZSgpO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHQvL2lmIHNjYXR0ZXIgcGxvdCwgb25seSBlbnRpdHkgbWF0Y2hcblx0XHRcdC8qdmFyICRvbmx5RW50aXR5TWF0Y2hDaGVjayA9ICQoIFwiPGRpdiBjbGFzcz0nb25seS1lbnRpdHktY2hlY2std3JhcHBlcic+PGxhYmVsPjxpbnB1dCB0eXBlPSdjaGVja2JveCcgbmFtZT0nb25seS1lbnRpdHktY2hlY2snIC8+TWF0Y2ggdmFyaWFibGVzIG9ubHkgYnkgY291bnRyaWVzLCBub3QgeWVhcnMuPC9sYWJlbD48L2Rpdj5cIiApLFxuXHRcdFx0XHQkb25seUVudGl0eUlucHV0ID0gJG9ubHlFbnRpdHlNYXRjaENoZWNrLmZpbmQoIFwiaW5wdXRcIiApO1xuXHRcdFx0JG9ubHlFbnRpdHlJbnB1dC5vbiggXCJjaGFuZ2VcIiwgZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdFx0dmFyICR0aGlzID0gJCggdGhpcyApO1xuXHRcdFx0XHRBcHAuQ2hhcnRNb2RlbC5zZXQoIFwib25seS1lbnRpdHktbWF0Y2hcIiwgJHRoaXMucHJvcCggXCJjaGVja2VkXCIgKSApO1xuXHRcdFx0fSApO1xuXHRcdFx0Ly9zZXQgZGVmYXVsdCB2YWx1ZVxuXHRcdFx0JG9ubHlFbnRpdHlJbnB1dC5wcm9wKCBcImNoZWNrZWRcIiwgQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcIm9ubHktZW50aXR5LW1hdGNoXCIgKSApO1xuXHRcdFx0dGhpcy4kZm9ybVNlY3Rpb25Db250ZW50LmFwcGVuZCggJG9ubHlFbnRpdHlNYXRjaENoZWNrICk7Ki9cblx0XHRcdFxuXHRcdH0sXG5cblx0XHR1cGRhdGVJbnB1dDogZnVuY3Rpb24oKSB7XG5cdFx0XHRcblx0XHRcdHZhciBkaW1lbnNpb25zID0gW107XG5cdFx0XHQkLmVhY2goIHRoaXMuJGRpbWVuc2lvbkJveGVzLCBmdW5jdGlvbiggaSwgdiApIHtcblx0XHRcdFx0dmFyICRib3ggPSAkKCB2ICksXG5cdFx0XHRcdFx0JGRyb3BwZWRWYXJpYWJsZXMgPSAkYm94LmZpbmQoIFwiLnZhcmlhYmxlLWxhYmVsXCIgKTtcblx0XHRcdFx0aWYoICRkcm9wcGVkVmFyaWFibGVzLmxlbmd0aCApIHtcblx0XHRcdFx0XHQvL2p1c3QgaW4gY2FzZSB0aGVyZSB3ZXJlIG1vcmUgdmFyaWFibGVzXG5cdFx0XHRcdFx0JC5lYWNoKCAkZHJvcHBlZFZhcmlhYmxlcywgZnVuY3Rpb24oIGksIHYgKSB7XG5cdFx0XHRcdFx0XHR2YXIgJGRyb3BwZWRWYXJpYWJsZSA9ICQoIHYgKSxcblx0XHRcdFx0XHRcdFx0ZGltZW5zaW9uID0geyB2YXJpYWJsZUlkOiAkZHJvcHBlZFZhcmlhYmxlLmF0dHIoIFwiZGF0YS12YXJpYWJsZS1pZFwiICksIGRpc3BsYXlOYW1lOiAkZHJvcHBlZFZhcmlhYmxlLmF0dHIoIFwiZGF0YS1kaXNwbGF5LW5hbWVcIiApLCBwcm9wZXJ0eTogJGJveC5hdHRyKCBcImRhdGEtcHJvcGVydHlcIiApLCB1bml0OiAkZHJvcHBlZFZhcmlhYmxlLmF0dHIoIFwiZGF0YS11bml0XCIgKSwgbmFtZTogJGJveC5maW5kKCBcImg0XCIgKS50ZXh0KCksIHBlcmlvZDogJGRyb3BwZWRWYXJpYWJsZS5hdHRyKCBcImRhdGEtcGVyaW9kXCIgKSwgbW9kZTogJGRyb3BwZWRWYXJpYWJsZS5hdHRyKCBcImRhdGEtbW9kZVwiICksIHRhcmdldFllYXI6ICRkcm9wcGVkVmFyaWFibGUuYXR0ciggXCJkYXRhLXRhcmdldC15ZWFyXCIgKSwgdG9sZXJhbmNlOiAkZHJvcHBlZFZhcmlhYmxlLmF0dHIoIFwiZGF0YS10b2xlcmFuY2VcIiApLCBtYXhpbXVtQWdlOiAkZHJvcHBlZFZhcmlhYmxlLmF0dHIoIFwiZGF0YS1tYXhpbXVtLWFnZVwiICkgfTtcblx0XHRcdFx0XHRcdGRpbWVuc2lvbnMucHVzaCggZGltZW5zaW9uICk7XG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cblx0XHRcdHZhciBqc29uID0gSlNPTi5zdHJpbmdpZnkoIGRpbWVuc2lvbnMgKTtcblx0XHRcdHRoaXMuJGRpbWVuc2lvbnNJbnB1dC52YWwoIGpzb24gKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJjaGFydC1kaW1lbnNpb25zXCIsIGpzb24gKTtcblxuXHRcdH0sXG5cblx0XHRzZXRJbnB1dHM6IGZ1bmN0aW9uKCBjaGFydERpbWVuc2lvbnMgKSB7XG5cblx0XHRcdGlmKCAhY2hhcnREaW1lbnNpb25zIHx8ICFjaGFydERpbWVuc2lvbnMubGVuZ3RoICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vY29udmVydCB0byBqc29uXG5cdFx0XHRjaGFydERpbWVuc2lvbnMgPSAkLnBhcnNlSlNPTiggY2hhcnREaW1lbnNpb25zICk7XG5cblx0XHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRcdF8uZWFjaCggY2hhcnREaW1lbnNpb25zLCBmdW5jdGlvbiggY2hhcnREaW1lbnNpb24sIGkgKSB7XG5cblx0XHRcdFx0Ly9maW5kIHZhcmlhYmxlIGxhYmVsIGJveCBmcm9tIGF2YWlsYWJsZSB2YXJpYWJsZXNcblx0XHRcdFx0dmFyICR2YXJpYWJsZUxhYmVsID0gJCggXCIudmFyaWFibGUtbGFiZWxbZGF0YS12YXJpYWJsZS1pZD1cIiArIGNoYXJ0RGltZW5zaW9uLnZhcmlhYmxlSWQgKyBcIl1cIiApO1xuXG5cdFx0XHRcdC8vY29weSB2YXJpYWJsZXMgYXR0cmlidXRlc1xuXHRcdFx0XHRpZiggY2hhcnREaW1lbnNpb24ucGVyaW9kICkge1xuXHRcdFx0XHRcdCR2YXJpYWJsZUxhYmVsLmF0dHIoIFwiZGF0YS1wZXJpb2RcIiwgY2hhcnREaW1lbnNpb24ucGVyaW9kICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYoIGNoYXJ0RGltZW5zaW9uLm1vZGUgKSB7XG5cdFx0XHRcdFx0JHZhcmlhYmxlTGFiZWwuYXR0ciggXCJkYXRhLW1vZGVcIiwgY2hhcnREaW1lbnNpb24ubW9kZSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmKCBjaGFydERpbWVuc2lvbi50YXJnZXRZZWFyICkge1xuXHRcdFx0XHRcdCR2YXJpYWJsZUxhYmVsLmF0dHIoIFwiZGF0YS10YXJnZXQteWVhclwiLCBjaGFydERpbWVuc2lvbi50YXJnZXRZZWFyICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYoIGNoYXJ0RGltZW5zaW9uLnRvbGVyYW5jZSApIHtcblx0XHRcdFx0XHQkdmFyaWFibGVMYWJlbC5hdHRyKCBcImRhdGEtdG9sZXJhbmNlXCIsIGNoYXJ0RGltZW5zaW9uLnRvbGVyYW5jZSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmKCBjaGFydERpbWVuc2lvbi5tYXhpbXVtQWdlICkge1xuXHRcdFx0XHRcdCR2YXJpYWJsZUxhYmVsLmF0dHIoIFwiZGF0YS1tYXhpbXVtLWFnZVwiLCBjaGFydERpbWVuc2lvbi5tYXhpbXVtQWdlICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYoIGNoYXJ0RGltZW5zaW9uLmRpc3BsYXlOYW1lICkge1xuXHRcdFx0XHRcdCR2YXJpYWJsZUxhYmVsLmZpbmQoIFwiLnZhcmlhYmxlLWxhYmVsLW5hbWVcIiApLnRleHQoIGNoYXJ0RGltZW5zaW9uLmRpc3BsYXlOYW1lICk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvL2ZpbmQgYXBwcm9wcmlhdGUgZGltZW5zaW9uIGJveCBmb3IgaXQgYnkgZGF0YS1wcm9wZXJ0eVxuXHRcdFx0XHR2YXIgJGRpbWVuc2lvbkJveCA9IHRoYXQuJGVsLmZpbmQoIFwiLmRpbWVuc2lvbi1ib3hbZGF0YS1wcm9wZXJ0eT1cIiArIGNoYXJ0RGltZW5zaW9uLnByb3BlcnR5ICsgXCJdXCIgKTtcblx0XHRcdFx0Ly9yZW1vdmUgZW1wdHkgYW5kIGFkZCB2YXJpYWJsZSBib3hcblx0XHRcdFx0JGRpbWVuc2lvbkJveC5maW5kKCBcIi5kZC1lbXB0eVwiICkucmVtb3ZlKCk7XG5cdFx0XHRcdHZhciAkZGRMaXN0ID0gJCggXCI8b2wgY2xhc3M9J2RkLWxpc3QnPjwvb2w+XCIgKTtcblx0XHRcdFx0JGRkTGlzdC5hcHBlbmQoICR2YXJpYWJsZUxhYmVsICk7XG5cdFx0XHRcdCRkaW1lbnNpb25Cb3guZmluZCggXCIuZGRcIiApLmFwcGVuZCggJGRkTGlzdCApO1xuXHRcdFx0XHR0aGF0LmRpc3BhdGNoZXIudHJpZ2dlciggXCJ2YXJpYWJsZS1sYWJlbC1tb3ZlZFwiICk7XG5cblx0XHRcdH0gKTtcblx0XG5cdFx0fSxcblxuXHRcdG9uQ2hhcnRUeXBlQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHR2YXIgJHNlbGVjdCA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICk7XG5cdFx0XHRBcHAuQ2hhcnREaW1lbnNpb25zTW9kZWwubG9hZENvbmZpZ3VyYXRpb24oICRzZWxlY3QudmFsKCkgKTtcblxuXHRcdH0sXG5cblx0XHRvbkRpbWVuc2lvblVwZGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLnVwZGF0ZUlucHV0KCk7XG5cdFx0fSxcblxuXHRcdG9uR3JvdXBCeVZhcmlhYmxlQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHR2YXIgJGlucHV0ID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJncm91cC1ieS12YXJpYWJsZXNcIiwgJGlucHV0LmlzKCBcIjpjaGVja2VkXCIgKSApO1xuXG5cdFx0fVxuXG5cdH0pO1xuXHRcblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVmlld3MuRm9ybS5EaW1lbnNpb25zU2VjdGlvblZpZXc7XG5cdFxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdEFwcC5WaWV3cy5Gb3JtLkVudGl0aWVzU2VjdGlvblZpZXcgPSBCYWNrYm9uZS5WaWV3LmV4dGVuZCh7XG5cblx0XHRlbDogXCIjZm9ybS12aWV3ICNkYXRhLXRhYiAuZW50aXRpZXMtc2VjdGlvblwiLFxuXHRcdGV2ZW50czoge1xuXHRcdFx0XCJjaGFuZ2UgLmNvdW50cmllcy1zZWxlY3RcIjogXCJvbkNvdW50cmllc1NlbGVjdFwiLFxuXHRcdFx0XCJjaGFuZ2UgW25hbWU9J2FkZC1jb3VudHJ5LW1vZGUnXVwiOiBcIm9uQWRkQ291bnRyeU1vZGVDaGFuZ2VcIlxuXHRcdH0sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdFxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gb3B0aW9ucy5kaXNwYXRjaGVyO1xuXHRcdFx0Ly9BcHAuQXZhaWxhYmxlRW50aXRpZXNDb2xsZWN0aW9uLm9uKCBcImNoYW5nZSBhZGQgcmVtb3ZlIHJlc2V0XCIsIHRoaXMucmVuZGVyLCB0aGlzICk7XG5cdFx0XHQvL2F2YWlsYWJsZSBlbnRpdGllcyBhcmUgY2hhbmdpbmcganVzdCBvbiBmZXRjaCBzbyBsaXN0ZW4ganVzdCBmb3IgdGhhdFxuXHRcdFx0QXBwLkF2YWlsYWJsZUVudGl0aWVzQ29sbGVjdGlvbi5vbiggXCJyZXNldCBmZXRjaGVkXCIsIHRoaXMucmVuZGVyLCB0aGlzICk7XG5cdFx0XHRcblx0XHRcdHRoaXMuJGVudGl0aWVzU2VsZWN0ID0gdGhpcy4kZWwuZmluZCggXCIuY291bnRyaWVzLXNlbGVjdFwiICk7XG5cdFx0XHR0aGlzLiRhZGRDb3VudHJ5Q29udHJvbElucHV0ID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT0nYWRkLWNvdW50cnktY29udHJvbCddXCIgKTtcblxuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblxuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHR2YXIgJGVudGl0aWVzU2VsZWN0ID0gdGhpcy4kZW50aXRpZXNTZWxlY3Q7XG5cdFx0XHQkZW50aXRpZXNTZWxlY3QuZW1wdHkoKTtcblx0XHRcdFxuXHRcdFx0Ly9hcHBlbmQgZGVmYXVsdCBcblx0XHRcdCRlbnRpdGllc1NlbGVjdC5hcHBlbmQoICQoIFwiPG9wdGlvbiBzZWxlY3RlZCBkaXNhYmxlZD5TZWxlY3QgZW50aXR5PC9vcHRpb24+XCIgKSApO1xuXG5cdFx0XHRBcHAuQXZhaWxhYmxlRW50aXRpZXNDb2xsZWN0aW9uLmVhY2goIGZ1bmN0aW9uKCBtb2RlbCApIHtcblx0XHRcdFx0JGVudGl0aWVzU2VsZWN0LmFwcGVuZCggJCggXCI8b3B0aW9uIHZhbHVlPSdcIiArIG1vZGVsLmdldCggXCJpZFwiICkgKyBcIic+XCIgKyBtb2RlbC5nZXQoIFwibmFtZVwiICkgKyBcIjwvb3B0aW9uPlwiICkgKTtcblx0XHRcdH0pO1xuXG5cdFx0XHR2YXIgYWRkQ291bnRyeUNvbnRyb2wgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiYWRkLWNvdW50cnktY29udHJvbFwiICk7XG5cdFx0XHR0aGlzLiRhZGRDb3VudHJ5Q29udHJvbElucHV0LnByb3AoIFwiY2hlY2tlZFwiLCBhZGRDb3VudHJ5Q29udHJvbCApO1xuXG5cdFx0XHQvL2Jhc2VkIG9uIHN0b3JlZCBhZGQtY291bnRyeS1tb2RlXG5cdFx0XHR2YXIgYWRkQ291bnRyeU1vZGUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiYWRkLWNvdW50cnktbW9kZVwiICk7XG5cdFx0XHR0aGlzLiRlbC5maW5kKCBcIltuYW1lPSdhZGQtY291bnRyeS1tb2RlJ11cIiApLmZpbHRlciggXCJbdmFsdWU9J1wiICsgYWRkQ291bnRyeU1vZGUgKyBcIiddXCIgKS5wcm9wKCBcImNoZWNrZWRcIiwgdHJ1ZSApO1xuXG5cdFx0fSxcblxuXHRcdG9uQ291bnRyaWVzU2VsZWN0OiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHR2YXIgJHNlbGVjdCA9ICQoIGV2dC50YXJnZXQgKSxcblx0XHRcdFx0dmFsID0gJHNlbGVjdC52YWwoKSxcblx0XHRcdFx0JG9wdGlvbiA9ICRzZWxlY3QuZmluZCggXCJvcHRpb25bdmFsdWU9XCIgKyB2YWwgKyBcIl1cIiApLFxuXHRcdFx0XHR0ZXh0ID0gJG9wdGlvbi50ZXh0KCk7XG5cblx0XHRcdEFwcC5DaGFydE1vZGVsLmFkZFNlbGVjdGVkQ291bnRyeSggeyBpZDogdmFsLCBuYW1lOiB0ZXh0IH0gKTtcblxuXHRcdH0sXG5cblx0XHRvbkFkZENvdW50cnlNb2RlQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHR2YXIgJGlucHV0ID0gJCggXCJbbmFtZT0nYWRkLWNvdW50cnktbW9kZSddOmNoZWNrZWRcIiApO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0KCBcImFkZC1jb3VudHJ5LW1vZGVcIiwgJGlucHV0LnZhbCgpICk7XG5cblx0XHR9XG5cblxuXHR9KTtcblx0XG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkZvcm0uRW50aXRpZXNTZWN0aW9uVmlldztcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBDb2xvclBpY2tlciA9IHJlcXVpcmUoIFwiLi8uLi8uLi91aS9BcHAuVmlld3MuVUkuQ29sb3JQaWNrZXIuanNcIiApO1xuXG5cdEFwcC5WaWV3cy5Gb3JtLlNlbGVjdGVkQ291bnRyaWVzU2VjdGlvblZpZXcgPSBCYWNrYm9uZS5WaWV3LmV4dGVuZCh7XG5cblx0XHRlbDogXCIjZm9ybS12aWV3ICNkYXRhLXRhYiAuc2VsZWN0ZWQtY291bnRyaWVzLWJveFwiLFxuXHRcdGV2ZW50czoge30sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdFxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gb3B0aW9ucy5kaXNwYXRjaGVyO1xuXHRcdFx0XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5vbiggXCJjaGFuZ2U6c2VsZWN0ZWQtY291bnRyaWVzXCIsIHRoaXMucmVuZGVyLCB0aGlzICk7XG5cblx0XHRcdHRoaXMucmVuZGVyKCk7XG5cblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblxuXHRcdFx0Ly9yZW1vdmUgZXZlcnl0aGluZ1xuXHRcdFx0dGhpcy4kZWwuZW1wdHkoKTtcblxuXHRcdFx0dmFyIHRoYXQgPSB0aGlzLFxuXHRcdFx0XHRzZWxlY3RlZENvdW50cmllcyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiApO1xuXG5cdFx0XHRfLmVhY2goIHNlbGVjdGVkQ291bnRyaWVzLCBmdW5jdGlvbiggdiwgaSApIHtcblx0XHRcdFx0dmFyICRsaSA9ICQoIFwiPGxpIGNsYXNzPSdjb3VudHJ5LWxhYmVsJyBkYXRhLWlkPSdcIiArIHYuaWQgKyBcIicgZGF0YS1uYW1lPSdcIiArIHYubmFtZSArIFwiJz5cIiArIHYubmFtZSArIFwiPHNwYW4gY2xhc3M9J2ZhIGZhLXJlbW92ZSc+PC9zcGFuPjwvbGk+XCIgKTtcblx0XHRcdFx0dGhhdC4kZWwuYXBwZW5kKCAkbGkgKTtcblx0XHRcdFx0aWYoIHYuY29sb3IgKSB7XG5cdFx0XHRcdFx0JGxpLmNzcyggXCJiYWNrZ3JvdW5kLWNvbG9yXCIsIHYuY29sb3IgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXG5cdFx0XHR2YXIgJGxpcyA9IHRoaXMuJGVsLmZpbmQoIFwiLmNvdW50cnktbGFiZWxcIiApLFxuXHRcdFx0XHQkbGlzUmVtb3ZlQnRucyA9ICRsaXMuZmluZCggXCIuZmEtcmVtb3ZlXCIgKSxcblx0XHRcdFx0Y29sb3JQaWNrZXIgPSBudWxsO1xuXG5cdFx0XHQkbGlzLm9uKCBcImNsaWNrXCIsIGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cblx0XHRcdFx0dmFyICRjb3VudHJ5TGFiZWwgPSAkKCBldnQuY3VycmVudFRhcmdldCApO1xuXHRcdFx0XHRpZiggY29sb3JQaWNrZXIgKSB7XG5cdFx0XHRcdFx0Y29sb3JQaWNrZXIuY2xvc2UoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb2xvclBpY2tlciA9IG5ldyBDb2xvclBpY2tlciggJGNvdW50cnlMYWJlbCApO1xuXHRcdFx0XHRjb2xvclBpY2tlci5pbml0KCAkY291bnRyeUxhYmVsICk7XG5cdFx0XHRcdGNvbG9yUGlja2VyLm9uU2VsZWN0ZWQgPSBmdW5jdGlvbiggdmFsdWUgKSB7XG5cdFx0XHRcdFx0JGNvdW50cnlMYWJlbC5jc3MoIFwiYmFja2dyb3VuZC1jb2xvclwiLCB2YWx1ZSApO1xuXHRcdFx0XHRcdCRjb3VudHJ5TGFiZWwuYXR0ciggXCJkYXRhLWNvbG9yXCIsIHZhbHVlICk7XG5cdFx0XHRcdFx0QXBwLkNoYXJ0TW9kZWwudXBkYXRlU2VsZWN0ZWRDb3VudHJ5KCAkY291bnRyeUxhYmVsLmF0dHIoIFwiZGF0YS1pZFwiICksIHZhbHVlICk7XG5cdFx0XHRcdFx0Y29sb3JQaWNrZXIuY2xvc2UoKTtcblx0XHRcdFx0XHQvL3RoYXQuJGVsLnRyaWdnZXIoIFwiY2hhbmdlXCIgKTtcblx0XHRcdFx0fTtcblxuXHRcdFx0fSApO1x0XG5cblx0XHRcdCRsaXNSZW1vdmVCdG5zLm9uKCBcImNsaWNrXCIsIGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdFx0ZXZ0LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHRcblx0XHRcdFx0dmFyICR0aGlzID0gJCggdGhpcyApLFxuXHRcdFx0XHRcdCRwYXJlbnQgPSAkdGhpcy5wYXJlbnQoKSxcblx0XHRcdFx0XHRjb3VudHJ5SWQgPSAkcGFyZW50LmF0dHIoIFwiZGF0YS1pZFwiICk7XG5cdFx0XHRcdEFwcC5DaGFydE1vZGVsLnJlbW92ZVNlbGVjdGVkQ291bnRyeSggY291bnRyeUlkICk7XG5cblx0XHRcdH0pXHRcblx0XHRcdFxuXHRcdH1cblxuXHR9KTtcblx0XG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkZvcm0uU2VsZWN0ZWRDb3VudHJpZXNTZWN0aW9uVmlldztcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdEFwcC5WaWV3cy5Gb3JtLlRpbWVTZWN0aW9uVmlldyA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblxuXHRcdGVsOiBcIiNmb3JtLXZpZXcgI2RhdGEtdGFiIC50aW1lLXNlY3Rpb25cIixcblx0XHRldmVudHM6IHtcblx0XHRcdFwiY2hhbmdlIFtuYW1lPSdkeW5hbWljLXRpbWUnXVwiOiBcIm9uRHluYW1pY1RpbWVcIixcblx0XHRcdFwiY2hhbmdlIFtuYW1lPSdjaGFydC10aW1lLWZyb20nXVwiOiBcIm9uQ2hhcnRUaW1lQ2hhbmdlXCIsXG5cdFx0XHRcImNoYW5nZSBbbmFtZT0nY2hhcnQtdGltZS10byddXCI6IFwib25DaGFydFRpbWVDaGFuZ2VcIlxuXHRcdH0sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdFxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gb3B0aW9ucy5kaXNwYXRjaGVyO1xuXHRcdFx0dGhpcy5kaXNwYXRjaGVyLm9uKCBcImRpbWVuc2lvbi11cGRhdGVcIiwgdGhpcy5vbkRpbWVuc2lvblVwZGF0ZSwgdGhpcyApO1xuXHRcdFx0XG5cdFx0XHRBcHAuQXZhaWxhYmxlVGltZU1vZGVsLm9uKCBcImNoYW5nZVwiLCB0aGlzLm9uQXZhaWxhYmxlVGltZUNoYW5nZSwgdGhpcyApO1xuXG5cdFx0XHR0aGlzLnJlbmRlcigpO1xuXG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cblx0XHRcdHZhciB0aGF0ID0gdGhpcztcblxuXHRcdFx0dGhpcy4kZW50aXRpZXNTZWxlY3QgPSB0aGlzLiRlbC5maW5kKCBcIi5jb3VudHJpZXMtc2VsZWN0XCIgKTtcblx0XHRcdHRoaXMuJGNoYXJ0VGltZSA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9J2NoYXJ0LXRpbWUnXVwiICk7XG5cdFx0XHR0aGlzLiRkeW5hbWljVGltZSA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9J2R5bmFtaWMtdGltZSddXCIgKTtcblx0XHRcdHRoaXMuJGlycyA9IHRoaXMuJGVsLmZpbmQoIFwiLmlyc1wiICk7XG5cblx0XHRcdHRoaXMuJGNoYXJ0VGltZUZyb20gPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPSdjaGFydC10aW1lLWZyb20nXVwiICk7XG5cdFx0XHR0aGlzLiRjaGFydFRpbWVUbyA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9J2NoYXJ0LXRpbWUtdG8nXVwiICk7XG5cblx0XHRcdHRoaXMuJGNoYXJ0VGltZS5pb25SYW5nZVNsaWRlcih7XG5cdFx0XHRcdHR5cGU6IFwiZG91YmxlXCIsXG5cdFx0XHRcdG1pbjogMCxcblx0XHRcdFx0bWF4OiAyMDE1LFxuXHRcdFx0XHRmcm9tOiAxMDAwLFxuXHRcdFx0XHR0bzogMTUwMCxcblx0XHRcdFx0Z3JpZDogdHJ1ZSxcblx0XHRcdFx0b25DaGFuZ2U6IGZ1bmN0aW9uKCBkYXRhICkge1xuXHRcdFx0XHRcdHRoYXQuJGNoYXJ0VGltZUZyb20udmFsKGRhdGEuZnJvbSk7XG5cdFx0XHRcdFx0dGhhdC4kY2hhcnRUaW1lVG8udmFsKGRhdGEudG8pO1xuXHRcdFx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJjaGFydC10aW1lXCIsIFtkYXRhLmZyb20sIGRhdGEudG9dICk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0c2V0VGltZW91dCggZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGlmKCBoYXNEeW5hbWljVGltZSApIHtcblx0XHRcdFx0XHR0aGF0LiRpcnMuYWRkQ2xhc3MoIFwiZGlzYWJsZWRcIiApO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCAyNTAgKTtcblxuXHRcdFx0dmFyIGhhc0R5bmFtaWNUaW1lID0gKCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdGltZVwiICkgKT8gZmFsc2U6IHRydWU7XG5cdFx0XHRpZiggIWhhc0R5bmFtaWNUaW1lICkge1xuXHRcdFx0XHR2YXIgY2hhcnRUaW1lID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LXRpbWVcIiApO1xuXHRcdFx0XHR0aGlzLnVwZGF0ZVRpbWUoIGNoYXJ0VGltZVsgMCBdLCBjaGFydFRpbWVbIDEgXSApO1xuXHRcdFx0fSBlbHNlIGlmKCBBcHAuQXZhaWxhYmxlVGltZU1vZGVsLmdldCggXCJtaW5cIiApICYmIEFwcC5BdmFpbGFibGVUaW1lTW9kZWwuZ2V0KCBcIm1heFwiICkgKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlVGltZSggQXBwLkF2YWlsYWJsZVRpbWVNb2RlbC5nZXQoIFwibWluXCIgKSwgQXBwLkF2YWlsYWJsZVRpbWVNb2RlbC5nZXQoIFwibWF4XCIgKSApO1xuXHRcdFx0XHRpZiggaGFzRHluYW1pY1RpbWUgKSB7XG5cdFx0XHRcdFx0dGhpcy4kZHluYW1pY1RpbWUucHJvcCggXCJjaGVja2VkXCIsIHRydWUgKTtcblx0XHRcdFx0XHR0aGlzLiRjaGFydFRpbWVGcm9tLnByb3AoIFwicmVhZG9ubHlcIiwgdHJ1ZSk7XG5cdFx0XHRcdFx0dGhpcy4kY2hhcnRUaW1lVG8ucHJvcCggXCJyZWFkb25seVwiLCB0cnVlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0XG5cdFx0fSxcblxuXHRcdG9uQXZhaWxhYmxlVGltZUNoYW5nZTogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLnVwZGF0ZVRpbWUoIEFwcC5BdmFpbGFibGVUaW1lTW9kZWwuZ2V0KCBcIm1pblwiICksIEFwcC5BdmFpbGFibGVUaW1lTW9kZWwuZ2V0KCBcIm1heFwiICkgKTtcblx0XHR9LFxuXG5cdFx0b25EaW1lbnNpb25VcGRhdGU6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHR2YXIgZGltZW5zaW9uU3RyaW5nID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LWRpbWVuc2lvbnNcIiApLFxuXHRcdFx0XHR0aW1lRnJvbSA9IEluZmluaXR5LFxuXHRcdFx0XHR0aW1lVG8gPSAtSW5maW5pdHksXG5cdFx0XHRcdGxpbWl0VGltZSA9IHRydWU7XG5cblx0XHRcdGlmKCAhJC5pc0VtcHR5T2JqZWN0KCBkaW1lbnNpb25TdHJpbmcgKSApIHtcblxuXHRcdFx0XHR2YXIgZGltZW5zaW9ucyA9ICQucGFyc2VKU09OKCBkaW1lbnNpb25TdHJpbmcgKTtcblx0XHRcdFx0JC5lYWNoKCBkaW1lbnNpb25zLCBmdW5jdGlvbiggaSwgdiApIHtcblx0XHRcdFx0XHRpZiggdi5wZXJpb2QgPT09IFwic2luZ2xlXCIgJiYgdi5tb2RlID09PSBcInNwZWNpZmljXCIgKSB7XG5cdFx0XHRcdFx0XHQvL2dldCBtaW4vbWF4IGxvY2FsXG5cdFx0XHRcdFx0XHR2YXIgeWVhciA9IHBhcnNlSW50KCB2LnRhcmdldFllYXIsIDEwICksXG5cdFx0XHRcdFx0XHRcdGxvY2FsRnJvbSA9IHllYXIgLSBwYXJzZUludCggdi50b2xlcmFuY2UsIDEwICksXG5cdFx0XHRcdFx0XHRcdGxvY2FsVG8gPSB5ZWFyICsgcGFyc2VJbnQoIHYudG9sZXJhbmNlLCAxMCApO1xuXHRcdFx0XHRcdFx0dGltZUZyb20gPSBNYXRoLm1pbiggbG9jYWxGcm9tLCB0aW1lRnJvbSApO1xuXHRcdFx0XHRcdFx0dGltZVRvID0gTWF0aC5tYXgoIGxvY2FsVG8sIHRpbWVUbyApO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHQvL3NldCBmbGFnIHRoYXQgdGhlcmUgaXMgc29tZSBkaW1lbnNpb24gdGhhdCBjYW5ub3QgYmUgbGltaXRlZCBhdXRvbWF0aWNhbHlcblx0XHRcdFx0XHRcdGxpbWl0VGltZSA9IGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSApO1xuXG5cdFx0XHR9XG5cblx0XHRcdC8vaWYgc29tZXRoaW5nIGhhcyBjaGFuZ2VkLCBzZXQgdGltZSBpbnRlcnZhbCBvbmx5IHRvIG5lY2Vzc2FyeVxuXHRcdFx0aWYoIGxpbWl0VGltZSAmJiB0aW1lRnJvbSA8IEluZmluaXR5ICYmIHRpbWVUbyA+IC1JbmZpbml0eSApIHtcblx0XHRcdFx0dGhpcy51cGRhdGVUaW1lKCB0aW1lRnJvbSwgdGltZVRvICk7XG5cdFx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJjaGFydC10aW1lXCIsIFsgdGltZUZyb20sIHRpbWVUbyBdICk7XG5cdFx0XHR9XG5cblx0XHR9LFxuXG5cdFx0dXBkYXRlVGltZTogZnVuY3Rpb24oIGZyb20sIHRvICkge1xuXG5cdFx0XHR2YXIgc2xpZGVyID0gJCggXCJbbmFtZT1jaGFydC10aW1lXVwiICkuZGF0YSggXCJpb25SYW5nZVNsaWRlclwiICk7XG5cdFx0XHRzbGlkZXIudXBkYXRlKCB7ZnJvbTogZnJvbSwgdG86IHRvIH0gKTtcblx0XHRcdC8vdXBkYXRpbmcgc2xpZGVyLCBzbyBoYXZlIHNvbWUgc2V0IHZhbHVlcyBhbmQgZGlzYWJsaW5nIGR5bmFtaWMgdGFibGVcblx0XHRcdHRoaXMuJGR5bmFtaWNUaW1lLnByb3AoIFwiY2hlY2tlZFwiLCBmYWxzZSApO1xuXHRcdFx0dGhpcy4kaXJzLnJlbW92ZUNsYXNzKCBcImRpc2FibGVkXCIgKTtcblx0XHRcdHRoaXMuJGNoYXJ0VGltZUZyb20udmFsKGZyb20pO1xuXHRcdFx0dGhpcy4kY2hhcnRUaW1lVG8udmFsKHRvKTtcblxuXHRcdH0sXG5cblx0XHRvbkR5bmFtaWNUaW1lOiBmdW5jdGlvbigpIHtcblxuXHRcdFx0aWYoIHRoaXMuJGR5bmFtaWNUaW1lLmlzKCBcIjpjaGVja2VkXCIgKSApIHtcblx0XHRcdFx0dGhpcy4kaXJzLmFkZENsYXNzKCBcImRpc2FibGVkXCIgKTtcblx0XHRcdFx0dGhpcy4kY2hhcnRUaW1lRnJvbS5wcm9wKCBcInJlYWRvbmx5XCIsIHRydWUpO1xuXHRcdFx0XHR0aGlzLiRjaGFydFRpbWVUby5wcm9wKCBcInJlYWRvbmx5XCIsIHRydWUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy4kaXJzLnJlbW92ZUNsYXNzKCBcImRpc2FibGVkXCIgKTtcblx0XHRcdFx0dGhpcy4kY2hhcnRUaW1lRnJvbS5wcm9wKCBcInJlYWRvbmx5XCIsIGZhbHNlKTtcblx0XHRcdFx0dGhpcy4kY2hhcnRUaW1lVG8ucHJvcCggXCJyZWFkb25seVwiLCBmYWxzZSk7XG5cdFx0XHR9XG5cdFx0XG5cdFx0fSxcblxuXHRcdG9uQ2hhcnRUaW1lQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHR2YXIgc2xpZGVyID0gJCggXCJbbmFtZT1jaGFydC10aW1lXVwiICkuZGF0YSggXCJpb25SYW5nZVNsaWRlclwiICksXG5cdFx0XHRcdGZyb20gPSB0aGlzLiRjaGFydFRpbWVGcm9tLnZhbCgpLFxuXHRcdFx0XHR0byA9IHRoaXMuJGNoYXJ0VGltZVRvLnZhbCgpO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0KCBcImNoYXJ0LXRpbWVcIiwgW2Zyb20sIHRvXSApO1xuXHRcdFx0c2xpZGVyLnVwZGF0ZSgge2Zyb206IGZyb20sIHRvOiB0byB9ICk7XG5cdFx0fVxuXG5cblx0fSk7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVmlld3MuRm9ybS5UaW1lU2VjdGlvblZpZXc7XG5cbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIHRoYXQ7XG5cblx0QXBwLlZpZXdzLlVJLkNvbG9yUGlja2VyID0gZnVuY3Rpb24oKSB7XG5cdFx0dGhhdCA9IHRoaXM7XG5cdFx0dGhpcy4kZGl2ID0gbnVsbDtcblx0XG5cdFx0dGhpcy5pbml0ID0gZnVuY3Rpb24oICRlbCwgZGF0YSApIHtcblxuXHRcdFx0dmFyIGxpc1N0cmluZyA9IFwiXCIsXG5cdFx0XHRcdCRsaXM7XG5cblx0XHRcdGlmKCAhZGF0YSApIHtcblx0XHRcdFx0ZGF0YSA9IEFwcC5WaWV3cy5VSS5Db2xvclBpY2tlci5DT0xPUl9BUlJBWTtcblx0XHRcdH1cblxuXHRcdFx0Ly9ET00gc3R1ZmZcdFx0XHRcblx0XHRcdCQuZWFjaCggZGF0YSwgZnVuY3Rpb24oIGksIGQgKSB7XG5cdFx0XHRcdGxpc1N0cmluZyArPSBcIjxsaSBkYXRhLXZhbHVlPSdcIiArIGQgKyBcIicgc3R5bGU9J2JhY2tncm91bmQtY29sb3I6XCIgKyBkICsgXCInPjwvbGk+XCI7XG5cdFx0XHR9ICk7XG5cdFx0XHR0aGlzLiRkaXYgPSAkKCBcIjxkaXYgY2xhc3M9J1wiICsgQXBwLlZpZXdzLlVJLkNvbG9yUGlja2VyLldSQVBQRVJfQ0xBU1MgKyBcIic+PHVsIGNsYXNzPSduby1idWxsZXRzJz5cIiArIGxpc1N0cmluZyArIFwiPC91bD48L2Rpdj5cIiApO1xuXHRcdFx0JGVsLmFwcGVuZCggdGhpcy4kZGl2ICk7XG5cdFx0XHQkbGlzID0gdGhpcy4kZGl2LmZpbmQoIFwibGlcIiApO1xuXG5cdFx0XHQvL3ByZXZlbnQgbW92ZW1lbnRcblx0XHRcdHRoaXMuJGRpdi5vbiggXCJtb3VzZWRvd25cIiwgZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdFx0ZXZ0LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuXHRcdFx0fSApO1xuXHRcdFx0JGxpcy5vbiggXCJtb3VzZWRvd25cIiwgdGhpcy5vbk1vdXNlRG93biApO1xuXHRcdH07XG5cblx0XHR0aGlzLm9uTW91c2VEb3duID0gZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdGV2dC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcblx0XHRcdHZhciB2YWx1ZSA9ICQoIHRoaXMgKS5hdHRyKCBcImRhdGEtdmFsdWVcIiApO1xuXHRcdFx0aWYoIHRoYXQub25TZWxlY3RlZCApIHtcblx0XHRcdFx0dGhhdC5vblNlbGVjdGVkLmFwcGx5KCB0aGF0LCBbIHZhbHVlIF0gKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0dGhpcy5jbG9zZSA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy4kZGl2LnJlbW92ZSgpO1xuXHRcdH07XG5cblx0fTtcblxuXHQvL0FwcC5WaWV3cy5VSS5Db2xvclBpY2tlci5DT0xPUl9BUlJBWSA9IFsgXCIjQTUyQTJBXCIsIFwiI0ZGNDA0MFwiLCBcIiNFRTNCM0JcIiwgXCIjQ0QzMzMzXCIsIFwiIzVGOUVBMFwiLCBcIiM5OEY1RkZcIiwgXCIjOEVFNUVFXCIsIFwiIzdBQzVDRFwiLCBcIiM1Mzg2OEJcIiwgXCIjRkZENzAwXCIsIFwiI0VFQzkwMFwiLCBcIiNDREFEMDBcIiwgXCIjOEI3NTAwXCIgIF07XG5cdEFwcC5WaWV3cy5VSS5Db2xvclBpY2tlci5DT0xPUl9BUlJBWSA9IFsgXCIjQjAxNzFGXCIsIFwiI0RDMTQzQ1wiLCBcIiNGRjNFOTZcIiwgXCIjRUUzQThDXCIsIFwiI0RBNzBENlwiLCBcIiNGRjgzRkFcIiwgXCIjOEEyQkUyXCIsIFwiIzlCMzBGRlwiLCBcIiM2OTU5Q0RcIiwgXCIjNDczQzhCXCIsIFwiIzQzNkVFRVwiLCBcIiMzQTVGQ0RcIiwgXCIjNUNBQ0VFXCIsIFwiIzRGOTRDRFwiLCBcIiM3QUM1Q0RcIiwgXCIjNTM4NjhCXCIsIFwiIzY2Q0RBQVwiLCBcIiM0NThCNzRcIiwgXCIjNDNDRDgwXCIsIFwiIzJFOEI1N1wiLCBcIiM2NkNEMDBcIiwgXCIjQ0RDRDAwXCIsIFwiI0ZGRUM4QlwiLCBcIiNGRkQ3MDBcIiwgXCIjRkZDMTI1XCIsIFwiI0ZGQTUwMFwiLCBcIiNGRjdGNTBcIiwgXCIjRkY0NTAwXCIsIFwiIzVCNUI1QlwiLCBcIiM4RThFOEVcIiBdO1xuXHRBcHAuVmlld3MuVUkuQ29sb3JQaWNrZXIuV1JBUFBFUl9DTEFTUyA9IFwicG9wdXAtcGlja2VyLXdyYXBwZXJcIjtcblx0XG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLlVJLkNvbG9yUGlja2VyO1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciB0aGF0O1xuXG5cdEFwcC5WaWV3cy5VSS5TZWxlY3RWYXJQb3B1cCA9IGZ1bmN0aW9uKCkge1xuXG5cdFx0dGhhdCA9IHRoaXM7XG5cdFx0dGhpcy4kZGl2ID0gbnVsbDtcblxuXHR9O1xuXG5cdEFwcC5WaWV3cy5VSS5TZWxlY3RWYXJQb3B1cC5wcm90b3R5cGUgPSB7XG5cblx0XHRpbml0OiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gb3B0aW9ucy5kaXNwYXRjaGVyO1xuXG5cdFx0XHR0aGlzLiR3aW4gPSAkKCB3aW5kb3cgKTtcblx0XHRcdHRoaXMuJGVsID0gJCggXCIuc2VsZWN0LXZhci1wb3B1cFwiICk7XG5cdFx0XHR0aGlzLiRjbG9zZUJ0biA9IHRoaXMuJGVsLmZpbmQoIFwiLmNsb3NlXCIgKTtcblx0XHRcdHRoaXMuJHNhdmVCdG4gPSB0aGlzLiRlbC5maW5kKCBcIi5idG4tcHJpbWFyeVwiICk7XG5cdFx0XHR0aGlzLiRjYW5jZWxCdG4gPSB0aGlzLiRlbC5maW5kKCBcIi5idG4tZGVmYXVsdFwiICk7XG5cdFx0XHRcblx0XHRcdHRoaXMuJHZhcmlhYmxlV3JhcHBlciA9IHRoaXMuJGVsLmZpbmQoIFwiLnZhcmlhYmxlLXdyYXBwZXJcIiApO1xuXHRcdFx0dGhpcy4kY2F0ZWdvcnlTZWxlY3QgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPWNhdGVnb3J5LWlkXVwiICk7XG5cdFx0XHR0aGlzLiRzdWJjYXRlZ29yeVNlbGVjdCA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9c3ViY2F0ZWdvcnktaWRdXCIgKTtcblx0XHRcdFx0XG5cdFx0XHR0aGlzLiRzZWxlY3RXcmFwcGVyID0gdGhpcy4kZWwuZmluZCggXCIuc2VhcmNoLWlucHV0LXdyYXBwZXJcIiApO1xuXHRcdFx0dGhpcy4kc2VsZWN0VmFyU2VhcmNoID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT1zZWxlY3RfdmFyX3NlYXJjaF1cIiApO1xuXHRcdFx0dGhpcy4kc2VsZWN0UmVzdWx0cyA9IHRoaXMuJGVsLmZpbmQoIFwiLnNlYXJjaC1yZXN1bHRzXCIgKTtcblx0XHRcdHRoaXMuJHNlYXJjaEljb24gPSB0aGlzLiRzZWxlY3RXcmFwcGVyLmZpbmQoIFwiLmZhLXNlYXJjaFwiICk7XG5cdFx0XHR0aGlzLiRwcmVsb2FkZXJJY29uID0gdGhpcy4kc2VsZWN0V3JhcHBlci5maW5kKCBcIi5mYS1zcGlubmVyXCIgKTtcblx0XHRcdHRoaXMuJGNsZWFySWNvbiA9IHRoaXMuJHNlbGVjdFdyYXBwZXIuZmluZCggXCIuZmEtdGltZXNcIiApO1xuXHRcdFx0dGhpcy4kcHJlbG9hZGVySWNvbi5oaWRlKCk7XG5cdFx0XHR0aGlzLiRjbGVhckljb24uaGlkZSgpO1xuXG5cdFx0XHR0aGlzLiRjaGFydFZhcmlhYmxlID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT1jaGFydC12YXJpYWJsZV1cIiApO1xuXHRcdFx0XG5cdFx0XHR0aGlzLiRjbG9zZUJ0bi5vbiggXCJjbGlja1wiLCAkLnByb3h5KCB0aGlzLm9uQ2xvc2VCdG4sIHRoaXMgKSApO1xuXHRcdFx0dGhpcy4kc2F2ZUJ0bi5vbiggXCJjbGlja1wiLCAkLnByb3h5KCB0aGlzLm9uU2F2ZUJ0biwgdGhpcyApICk7XG5cdFx0XHR0aGlzLiRjYW5jZWxCdG4ub24oIFwiY2xpY2tcIiwgJC5wcm94eSggdGhpcy5vbkNhbmNlbEJ0biwgdGhpcyApICk7XG5cdFx0XHRcblx0XHRcdHRoaXMuJHNlbGVjdFZhclNlYXJjaC5vbiggXCJpbnB1dFwiLCAkLnByb3h5KCB0aGlzLm9uU2VhcmNoSW5wdXQsIHRoaXMgKSApO1xuXHRcdFx0dGhpcy4kc2VsZWN0VmFyU2VhcmNoLm9uKCBcImZvY3VzaW5cIiwgJC5wcm94eSggdGhpcy5vblNlYXJjaEZvY3VzSW4sIHRoaXMgKSApO1xuXHRcdFx0dGhpcy4kc2VsZWN0VmFyU2VhcmNoLm9uKCBcImZvY3Vzb3V0XCIsICQucHJveHkoIHRoaXMub25TZWFyY2hGb2N1c091dCwgdGhpcyApICk7XG5cblx0XHRcdHRoaXMuJGNsZWFySWNvbi5vbiggXCJjbGlja1wiLCAkLnByb3h5KCB0aGlzLm9uQ2xlYXJCdG4sIHRoaXMgKSApO1xuXG5cdFx0XHRBcHAuU2VhcmNoRGF0YUNvbGxlY3Rpb24ub24oIFwiZmV0Y2hlZFwiLCAkLnByb3h5KCB0aGlzLm9uU2VhcmNoRmV0Y2hlZCwgdGhpcyApICk7XG5cblx0XHR9LFxuXG5cdFx0c2hvdzogZnVuY3Rpb24oKSB7XG5cblx0XHRcdHRoaXMuJGVsLnNob3coKTtcblxuXHRcdH0sXG5cblx0XHRoaWRlOiBmdW5jdGlvbigpIHtcblxuXHRcdFx0dGhpcy4kZWwuaGlkZSgpO1xuXG5cdFx0fSxcblxuXHRcdG9uQ2xvc2VCdG46IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0dGhpcy5oaWRlKCk7XG5cblx0XHR9LFxuXG5cdFx0b25TYXZlQnRuOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFxuXHRcdFx0Ly90cmlnZ2VyIGV2ZW50IG9ubHkgaWYgc29tZXRoaW5nIHNlbGVjdGVkXG5cdFx0XHRpZiggdGhpcy4kY2hhcnRWYXJpYWJsZS52YWwoKSA+IDAgKSB7XG5cdFx0XHRcdFxuXHRcdFx0XHR2YXIgdmFySWQgPSB0aGlzLiRjaGFydFZhcmlhYmxlLnZhbCgpLFxuXHRcdFx0XHRcdHZhclVuaXQgPSB0aGlzLiRjaGFydFZhcmlhYmxlLmZpbmQoIFwib3B0aW9uOnNlbGVjdGVkXCIgKS5hdHRyKCBcImRhdGEtdW5pdFwiICksXG5cdFx0XHRcdFx0dmFyTmFtZSA9IHRoaXMuJGNoYXJ0VmFyaWFibGUuZmluZCggXCJvcHRpb246c2VsZWN0ZWRcIiApLnRleHQoKTtcblxuXHRcdFx0XHR2YXIgdmFyaWFibGUgPSBuZXcgQXBwLk1vZGVscy5DaGFydFZhcmlhYmxlTW9kZWwoIHsgaWQ6dmFySWQsIG5hbWU6IHZhck5hbWUsIHVuaXQ6IHZhclVuaXQgfSApO1xuXHRcdFx0XHRBcHAuQ2hhcnRWYXJpYWJsZXNDb2xsZWN0aW9uLmFkZCggdmFyaWFibGUgKTtcblx0XHRcdFx0Ly9BcHAuQ2hhcnRNb2RlbC51cGRhdGVWYXJpYWJsZXMoIHsgaWQ6dmFySWQsIG5hbWU6IHZhck5hbWUgfSApO1xuXHRcdFx0XHRcblx0XHRcdFx0dGhpcy5oaWRlKCk7XG5cblx0XHRcdH1cblxuXHRcdH0sXG5cblx0XHRvbkNhbmNlbEJ0bjogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHR0aGlzLmhpZGUoKTtcblxuXHRcdH0sXG5cblx0XHRvblNlYXJjaElucHV0OiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0XG5cdFx0XHR2YXIgJGlucHV0ID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKSxcblx0XHRcdFx0c2VhcmNoVGVybSA9ICRpbnB1dC52YWwoKTtcblxuXHRcdFx0aWYoIHNlYXJjaFRlcm0ubGVuZ3RoID49IDIgKSB7XG5cdFx0XHRcdFxuXHRcdFx0XHR0aGlzLiRjbGVhckljb24uaGlkZSgpO1xuXHRcdFx0XHR0aGlzLiRzZWFyY2hJY29uLmhpZGUoKTtcblx0XHRcdFx0dGhpcy4kcHJlbG9hZGVySWNvbi5zaG93KCk7XG5cblx0XHRcdFx0QXBwLlNlYXJjaERhdGFDb2xsZWN0aW9uLnNlYXJjaCggc2VhcmNoVGVybSApO1xuXG5cdFx0XHR9IGVsc2Uge1xuXG5cdFx0XHRcdC8vY2xlYXIgc2VsZWN0aW9uXG5cdFx0XHRcdHRoaXMuJHNlbGVjdFJlc3VsdHMuZW1wdHkoKTtcblx0XHRcdFx0dGhpcy4kc2VsZWN0UmVzdWx0cy5oaWRlKCk7XG5cdFx0XHRcdFxuXHRcdFx0XHR0aGlzLiRjbGVhckljb24uaGlkZSgpO1xuXHRcdFx0XHR0aGlzLiRzZWFyY2hJY29uLnNob3coKTtcblxuXHRcdFx0fVxuXG5cdFx0fSxcblxuXHRcdG9uU2VhcmNoRmV0Y2hlZDogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dGhpcy4kY2xlYXJJY29uLnNob3coKTtcblx0XHRcdHRoaXMuJHNlYXJjaEljb24uaGlkZSgpO1xuXHRcdFx0dGhpcy4kcHJlbG9hZGVySWNvbi5oaWRlKCk7XG5cblx0XHRcdHRoaXMuJHNlbGVjdFJlc3VsdHMuZW1wdHkoKTtcblx0XHRcdHRoaXMuJHNlbGVjdFJlc3VsdHMuc2hvdygpO1xuXHRcdFx0XG5cdFx0XHR2YXIgcmVzdWx0cyA9IEFwcC5TZWFyY2hEYXRhQ29sbGVjdGlvbi5tb2RlbHMsXG5cdFx0XHRcdGh0bWxTdHJpbmcgPSBcIlwiO1xuXHRcdFx0Xy5lYWNoKCByZXN1bHRzLCBmdW5jdGlvbiggcmVzdWx0ICkge1xuXHRcdFx0XHRodG1sU3RyaW5nICs9IFwiPGxpIGRhdGEtY2F0LWlkPSdcIiArIHJlc3VsdC5nZXQoIFwiZmtfZHN0X2NhdF9pZFwiICkgKyBcIicgZGF0YS1zdWJjYXQtaWQ9J1wiICsgcmVzdWx0LmdldCggXCJma19kc3Rfc3ViY2F0X2lkXCIgKSArIFwiJyBkYXRhLXZhci1pZD0nXCIgKyByZXN1bHQuZ2V0KCBcImlkXCIgKSArIFwiJz5cIiArIHJlc3VsdC5nZXQoIFwibmFtZVwiICkgKyBcIjwvbGk+XCI7XG5cdFx0XHR9ICk7XG5cblx0XHRcdHRoaXMuJHNlbGVjdFJlc3VsdHMuYXBwZW5kKCAkKCBodG1sU3RyaW5nICkgKTtcblx0XHRcdHRoaXMuJGxpcyA9IHRoaXMuJHNlbGVjdFJlc3VsdHMuZmluZCggXCJsaVwiICk7XG5cdFx0XHRcblx0XHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRcdHRoaXMuJGxpcy5vbiggXCJtb3VzZWRvd25cIiwgZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0XHR0aGF0LnNlbGVjdEl0ZW0oICQoIGV2dC5jdXJyZW50VGFyZ2V0ICkgKTtcblx0XHRcdFx0XG5cdFx0XHR9ICk7XG5cblx0XHR9LFxuXG5cdFx0c2VsZWN0SXRlbTogZnVuY3Rpb24oICRsaSApIHtcblxuXHRcdFx0dmFyIHRoYXQgPSB0aGlzLFxuXHRcdFx0XHR2YXJJZCA9ICRsaS5hdHRyKCBcImRhdGEtdmFyLWlkXCIgKSxcblx0XHRcdFx0Y2F0SWQgPSAkbGkuYXR0ciggXCJkYXRhLWNhdC1pZFwiICksXG5cdFx0XHRcdHN1YmNhdElkID0gJGxpLmF0dHIoIFwiZGF0YS1zdWJjYXQtaWRcIiApO1xuXG5cdFx0XHR0aGF0LiRjYXRlZ29yeVNlbGVjdC5maW5kKCBcIm9wdGlvblt2YWx1ZT1cIiArIGNhdElkICsgXCJdXCIgKS5wcm9wKCBcInNlbGVjdGVkXCIsIHRydWUgKTtcblx0XHRcdHRoYXQuJGNhdGVnb3J5U2VsZWN0LnRyaWdnZXIoIFwiY2hhbmdlXCIgKTtcblx0XHRcdHRoYXQuJHN1YmNhdGVnb3J5U2VsZWN0LmZpbmQoIFwib3B0aW9uW3ZhbHVlPVwiICsgc3ViY2F0SWQgKyBcIl1cIiApLnByb3AoIFwic2VsZWN0ZWRcIiwgdHJ1ZSApO1xuXHRcdFx0dGhhdC4kc3ViY2F0ZWdvcnlTZWxlY3QudHJpZ2dlciggXCJjaGFuZ2VcIiApO1xuXG5cdFx0XHR0aGF0LiR2YXJpYWJsZVdyYXBwZXIuc2hvdygpO1xuXHRcdFx0dGhhdC4kY2hhcnRWYXJpYWJsZS5maW5kKCBcIm9wdGlvblt2YWx1ZT1cIiArIHZhcklkICsgXCJdXCIgKS5wcm9wKCBcInNlbGVjdGVkXCIsIHRydWUgKTtcblxuXHRcdH0sXG5cblx0XHRvblNlYXJjaEZvY3VzSW46IGZ1bmN0aW9uKCkge1xuXHRcdFx0Ly9zaG93IHNlbGVjdCBvbmx5IGlmIHNvbWUgcmVzdWx0c1xuXHRcdFx0aWYoIHRoaXMuJHNlbGVjdFJlc3VsdHMuZmluZCggXCJsaVwiICkubGVuZ3RoICkge1xuXHRcdFx0XHR0aGlzLiRzZWxlY3RSZXN1bHRzLnNob3coKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuJGtleURvd25IYW5kbGVyID0gJC5wcm94eSggdGhpcy5vbktleURvd24sIHRoaXMgKTtcblx0XHRcdHRoaXMuJHdpbi5vbiggXCJrZXlkb3duXCIsIHRoaXMuJGtleURvd25IYW5kbGVyICk7XG5cdFx0fSxcblxuXHRcdG9uU2VhcmNoRm9jdXNPdXQ6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHR0aGF0LiRzZWxlY3RSZXN1bHRzLmhpZGUoKTtcblx0XHRcdHRoaXMuJHdpbi5vZmYoIFwia2V5ZG93blwiLCB0aGlzLiRrZXlEb3duSGFuZGxlciApO1xuXHRcdH0sXG5cblx0XHRvbktleURvd246IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdGlmKCAhdGhpcy4kbGlzIHx8ICF0aGlzLiRsaXMubGVuZ3RoICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHZhciBzZWxlY3RlZEluZGV4ID0gdGhpcy4kbGlzLmZpbHRlciggXCIuc2VsZWN0ZWRcIiApLmluZGV4KCksXG5cdFx0XHRcdGtleUNvZGUgPSBldnQua2V5Q29kZTtcblx0XHRcdFxuXHRcdFx0aWYoIGtleUNvZGUgPT09IDQwIHx8IGtleUNvZGUgPT09IDM4ICkge1xuXG5cdFx0XHRcdGlmKCBrZXlDb2RlID09PSA0MCApIHtcblx0XHRcdFx0XHRzZWxlY3RlZEluZGV4Kys7XG5cdFx0XHRcdFx0aWYoIHNlbGVjdGVkSW5kZXggPj0gdGhpcy4kbGlzLmxlbmd0aCApIHtcblx0XHRcdFx0XHRcdHNlbGVjdGVkSW5kZXggPSAwO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIGlmKCBrZXlDb2RlID09PSAzOCApIHtcblx0XHRcdFx0XHRzZWxlY3RlZEluZGV4LS07XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLiRsaXMucmVtb3ZlQ2xhc3MoIFwic2VsZWN0ZWRcIiApO1xuXHRcdFx0XHR0aGlzLiRsaXMuZXEoIHNlbGVjdGVkSW5kZXggKS5hZGRDbGFzcyggXCJzZWxlY3RlZFwiICk7XG5cdFx0XHRcblx0XHRcdH0gZWxzZSBpZigga2V5Q29kZSA9PT0gMTMgKSB7XG5cblx0XHRcdFx0dGhpcy5zZWxlY3RJdGVtKCB0aGlzLiRsaXMuZXEoIHNlbGVjdGVkSW5kZXggKSApO1xuXHRcdFx0XHR0aGlzLiRzZWxlY3RSZXN1bHRzLmhpZGUoKTtcblxuXHRcdFx0fVxuXG5cdFx0fSxcblxuXHRcdG9uQ2xlYXJCdG46IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy4kc2VsZWN0VmFyU2VhcmNoLnZhbCggXCJcIiApO1xuXHRcdFx0dGhpcy4kc2VsZWN0VmFyU2VhcmNoLnRyaWdnZXIoIFwiaW5wdXRcIiApO1xuXHRcdH1cblxuXHR9O1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLlVJLlNlbGVjdFZhclBvcHVwO1xuXG59KSgpO1xuIiwiOyggZnVuY3Rpb24oKSB7XG5cblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIHRoYXQ7XG5cblx0QXBwLlZpZXdzLlVJLlNldHRpbmdzVmFyUG9wdXAgPSBmdW5jdGlvbigpIHtcblxuXHRcdHRoYXQgPSB0aGlzO1xuXHRcdHRoaXMuJGRpdiA9IG51bGw7XG5cblx0fTtcblxuXHRBcHAuVmlld3MuVUkuU2V0dGluZ3NWYXJQb3B1cC5wcm90b3R5cGUgPSB7XG5cblx0XHRpbml0OiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gb3B0aW9ucy5kaXNwYXRjaGVyO1xuXG5cdFx0XHQvL3dpbGwgYmUgZmlsbGVkIHdoZW4gb3BlbmluZyBwb3B1cFxuXHRcdFx0dGhpcy52YXJpYWJsZUlkID0gLTE7XG5cblx0XHRcdC8vZmxhZyBmb3IgXG5cdFx0XHR0aGlzLnZhbGlkID0gdHJ1ZTtcblxuXHRcdFx0dGhpcy4kZWwgPSAkKCBcIi5zZXR0aW5ncy12YXItcG9wdXBcIiApO1xuXHRcdFx0dGhpcy4kY2xvc2VCdG4gPSB0aGlzLiRlbC5maW5kKCBcIi5jbG9zZVwiICk7XG5cdFx0XHR0aGlzLiRzYXZlQnRuID0gdGhpcy4kZWwuZmluZCggXCIuYnRuLXByaW1hcnlcIiApO1xuXHRcdFx0dGhpcy4kY2FuY2VsQnRuID0gdGhpcy4kZWwuZmluZCggXCIuYnRuLWRlZmF1bHRcIiApO1xuXG5cdFx0XHR0aGlzLiRkaWdpdElucHV0cyA9IHRoaXMuJGVsLmZpbmQoIFwiLmRpZ2l0LWlucHV0XCIgKTtcblx0XHRcdHRoaXMuJHBlcmlvZElucHV0cyA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9cGVyaW9kXVwiICk7XG5cdFx0XHR0aGlzLiRzaW5nbGVJbnB1dHMgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPXNpbmdsZV1cIiApO1xuXHRcdFx0dGhpcy4kYWxsSW5wdXRzID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT1hbGxdXCIgKTtcblx0XHRcdHRoaXMuJGNvbnRlbnRBbGwgPSB0aGlzLiRlbC5maW5kKCBcIi5zZXR0aW5ncy12YXItY29udGVudC1hbGxcIiApO1xuXHRcdFx0dGhpcy4kY29udGVudFNpbmdsZSA9IHRoaXMuJGVsLmZpbmQoIFwiLnNldHRpbmdzLXZhci1jb250ZW50LXNpbmdsZVwiICk7XG5cdFx0XHRcdFxuXHRcdFx0dGhpcy4kY29udGVudFNpbmdsZVNwZWNpZmljID0gdGhpcy4kZWwuZmluZCggXCIuc2V0dGluZ3MtdmFyLXNpbmdsZS1zcGVjaWZpYy1jb250ZW50XCIgKTtcblx0XHRcdHRoaXMuJGNvbnRlbnRTaW5nbGVMYXRlc3QgPSB0aGlzLiRlbC5maW5kKCBcIi5zZXR0aW5ncy12YXItc2luZ2xlLWxhdGVzdC1jb250ZW50XCIgKTtcblxuXHRcdFx0dGhpcy4kY29udGVudEFsbENsb3Nlc3QgPSB0aGlzLiRlbC5maW5kKCBcIi5zZXR0aW5ncy12YXItYWxsLWNsb3Nlc3QtY29udGVudFwiICk7XG5cdFx0XHR0aGlzLiRjb250ZW50QWxsTGF0ZXN0ID0gdGhpcy4kZWwuZmluZCggXCIuc2V0dGluZ3MtdmFyLWFsbC1sYXRlc3QtY29udGVudFwiICk7XG5cblx0XHRcdHRoaXMuJGNsb3NlQnRuLm9uKCBcImNsaWNrXCIsICQucHJveHkoIHRoaXMub25DbG9zZUJ0biwgdGhpcyApICk7XG5cdFx0XHR0aGlzLiRzYXZlQnRuLm9uKCBcImNsaWNrXCIsICQucHJveHkoIHRoaXMub25TYXZlQnRuLCB0aGlzICkgKTtcblx0XHRcdHRoaXMuJGNhbmNlbEJ0bi5vbiggXCJjbGlja1wiLCAkLnByb3h5KCB0aGlzLm9uQ2FuY2VsQnRuLCB0aGlzICkgKTtcblx0XHRcdFxuXHRcdFx0dGhpcy4kZGlnaXRJbnB1dHMub24oIFwiY2hhbmdlXCIsICQucHJveHkoIHRoaXMub25EaWdpdElucHV0cywgdGhpcyApICk7XG5cdFx0XHR0aGlzLiRwZXJpb2RJbnB1dHMub24oIFwiY2hhbmdlXCIsICQucHJveHkoIHRoaXMub25QZXJpb2RJbnB1dHMsIHRoaXMgKSApO1xuXHRcdFx0dGhpcy4kc2luZ2xlSW5wdXRzLm9uKCBcImNoYW5nZVwiLCAkLnByb3h5KCB0aGlzLm9uU2luZ2xlSW5wdXRzLCB0aGlzICkgKTtcblx0XHRcdHRoaXMuJGFsbElucHV0cy5vbiggXCJjaGFuZ2VcIiwgJC5wcm94eSggdGhpcy5vbkFsbElucHV0cywgdGhpcyApICk7XG5cblx0XHR9LFxuXG5cdFx0b25EaWdpdElucHV0czogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cblx0XHRcdHZhciAkaW5wdXQgPSAkKCBldnQuY3VycmVudFRhcmdldCApLFxuXHRcdFx0XHR2YWx1ZSA9ICRpbnB1dC52YWwoKTtcblxuXHRcdFx0aWYoIGlzTmFOKCB2YWx1ZSApICkge1xuXHRcdFx0XHQkaW5wdXQucGFyZW50KCkuYWRkQ2xhc3MoIFwiaGFzLWVycm9yXCIgKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdCRpbnB1dC5wYXJlbnQoKS5yZW1vdmVDbGFzcyggXCJoYXMtZXJyb3JcIiApO1xuXHRcdFx0fVxuXG5cdFx0fSxcblxuXHRcdG9uUGVyaW9kSW5wdXRzOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHR2YXIgJGlucHV0ID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKTtcblx0XHRcdGlmKCAkaW5wdXQudmFsKCkgPT09IFwiYWxsXCIgKSB7XG5cdFx0XHRcdHRoaXMuJGNvbnRlbnRBbGwuc2hvdygpO1xuXHRcdFx0XHR0aGlzLiRjb250ZW50U2luZ2xlLmhpZGUoKTtcblx0XHRcdH0gZWxzZSBpZiggJGlucHV0LnZhbCgpID09PSBcInNpbmdsZVwiICkge1xuXHRcdFx0XHR0aGlzLiRjb250ZW50QWxsLmhpZGUoKTtcblx0XHRcdFx0dGhpcy4kY29udGVudFNpbmdsZS5zaG93KCk7XG5cdFx0XHR9XG5cblx0XHR9LFxuXG5cdFx0b25TaW5nbGVJbnB1dHM6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdHZhciAkaW5wdXQgPSAkKCBldnQuY3VycmVudFRhcmdldCApO1xuXHRcdFx0aWYoICRpbnB1dC52YWwoKSA9PT0gXCJzcGVjaWZpY1wiICkge1xuXHRcdFx0XHR0aGlzLiRjb250ZW50U2luZ2xlU3BlY2lmaWMuc2hvdygpO1xuXHRcdFx0XHR0aGlzLiRjb250ZW50U2luZ2xlTGF0ZXN0LmhpZGUoKTtcblx0XHRcdH0gZWxzZSBpZiggJGlucHV0LnZhbCgpID09PSBcImxhdGVzdFwiICkge1xuXHRcdFx0XHR0aGlzLiRjb250ZW50U2luZ2xlU3BlY2lmaWMuaGlkZSgpO1xuXHRcdFx0XHR0aGlzLiRjb250ZW50U2luZ2xlTGF0ZXN0LnNob3coKTtcblx0XHRcdH1cblxuXHRcdH0sXG5cblx0XHRvbkFsbElucHV0czogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dmFyICRpbnB1dCA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICk7XG5cdFx0XHRpZiggJGlucHV0LnZhbCgpID09PSBcImNsb3Nlc3RcIiApIHtcblx0XHRcdFx0dGhpcy4kY29udGVudEFsbENsb3Nlc3Quc2hvdygpO1xuXHRcdFx0XHR0aGlzLiRjb250ZW50QWxsTGF0ZXN0LmhpZGUoKTtcblx0XHRcdH0gZWxzZSBpZiggJGlucHV0LnZhbCgpID09PSBcImxhdGVzdFwiICkge1xuXHRcdFx0XHR0aGlzLiRjb250ZW50QWxsQ2xvc2VzdC5oaWRlKCk7XG5cdFx0XHRcdHRoaXMuJGNvbnRlbnRBbGxMYXRlc3Quc2hvdygpO1xuXHRcdFx0fVxuXG5cdFx0fSxcblxuXHRcdHNob3c6IGZ1bmN0aW9uKCAkdmFyaWFibGVMYWJlbCApIHtcblxuXHRcdFx0dGhpcy52YXJpYWJsZUlkID0gJHZhcmlhYmxlTGFiZWwuYXR0ciggXCJkYXRhLXZhcmlhYmxlLWlkXCIgKTtcblx0XHRcdFxuXHRcdFx0Ly9yZXBvcHVsYXRlIGZyb20gZWxlbWVudFxuXHRcdFx0dmFyIHBlcmlvZCA9ICR2YXJpYWJsZUxhYmVsLmF0dHIoIFwiZGF0YS1wZXJpb2RcIiApLFxuXHRcdFx0XHRtb2RlID0gJHZhcmlhYmxlTGFiZWwuYXR0ciggXCJkYXRhLW1vZGVcIiApLFxuXHRcdFx0XHR0YXJnZXRZZWFyID0gJHZhcmlhYmxlTGFiZWwuYXR0ciggXCJkYXRhLXRhcmdldC15ZWFyXCIgKSxcblx0XHRcdFx0dG9sZXJhbmNlID0gJHZhcmlhYmxlTGFiZWwuYXR0ciggXCJkYXRhLXRvbGVyYW5jZVwiICksXG5cdFx0XHRcdG1heGltdW1BZ2UgPSAkdmFyaWFibGVMYWJlbC5hdHRyKCBcImRhdGEtbWF4aW11bS1hZ2VcIiApO1xuXG5cdFx0XHQvL3ByZWZpbGwgdmFsdWVzIChyZWdhcmRsZXNzIG9mIHdoYXQgaXMgc2VsZWN0ZWQpXG5cdFx0XHR0aGlzLiRlbC5maW5kKCBcIltuYW1lPXNpbmdsZS15ZWFyXVwiICkudmFsKCB0YXJnZXRZZWFyICk7XG5cdFx0XHR0aGlzLiRlbC5maW5kKCBcIltuYW1lPXNpbmdsZS10b2xlcmFuY2VdXCIgKS52YWwoIHRvbGVyYW5jZSApO1xuXHRcdFx0dGhpcy4kZWwuZmluZCggXCJbbmFtZT1zaW5nbGUtbWF4aW11bS1hZ2VdXCIgKS52YWwoIG1heGltdW1BZ2UgKTtcblx0XHRcdHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9YWxsLXRvbGVyYW5jZV1cIiApLnZhbCggdG9sZXJhbmNlICk7XG5cdFx0XHR0aGlzLiRlbC5maW5kKCBcIltuYW1lPWFsbC1tYXhpbXVtLWFnZV1cIiApLnZhbCggbWF4aW11bUFnZSApO1xuXG5cdFx0XHQvL3JlbW92ZSBhbGwgdmFsaWRhdGlvbiBlcnJvcnNcblx0XHRcdHRoaXMuJGVsLmZpbmQoIFwiLmhhcy1lcnJvclwiICkucmVtb3ZlQ2xhc3MoIFwiaGFzLWVycm9yXCIgKTtcblxuXHRcdFx0Ly9iYXNlZCBvbiBzZXQgdmFsdWVzLCBhcHBlYXIgY29ycmVjdCB2YWx1ZXNcblx0XHRcdGlmKCBwZXJpb2QgKSB7XG5cdFx0XHRcdFxuXHRcdFx0XHRpZiggcGVyaW9kID09PSBcInNpbmdsZVwiICkge1xuXG5cdFx0XHRcdFx0dGhpcy4kcGVyaW9kSW5wdXRzLmZpbHRlciggXCJbdmFsdWU9c2luZ2xlXVwiICkucHJvcCggXCJjaGVja2VkXCIsIHRydWUgKTtcblxuXHRcdFx0XHRcdHRoaXMuJGNvbnRlbnRBbGwuaGlkZSgpO1xuXHRcdFx0XHRcdHRoaXMuJGNvbnRlbnRTaW5nbGUuc2hvdygpO1xuXG5cdFx0XHRcdFx0aWYoIG1vZGUgPT09IFwic3BlY2lmaWNcIiApIHtcblxuXHRcdFx0XHRcdFx0dGhpcy4kc2luZ2xlSW5wdXRzLmZpbHRlciggXCJbdmFsdWU9c3BlY2lmaWNdXCIgKS5wcm9wKCBcImNoZWNrZWRcIiwgdHJ1ZSApO1xuXHRcdFx0XHRcdFx0dGhpcy4kY29udGVudFNpbmdsZVNwZWNpZmljLnNob3coKTtcblx0XHRcdFx0XHRcdHRoaXMuJGNvbnRlbnRTaW5nbGVMYXRlc3QuaGlkZSgpO1xuXHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0fSBlbHNlIGlmKCBtb2RlID09PSBcImxhdGVzdFwiICkge1xuXG5cdFx0XHRcdFx0XHR0aGlzLiRzaW5nbGVJbnB1dHMuZmlsdGVyKCBcIlt2YWx1ZT1sYXRlc3RdXCIgKS5wcm9wKCBcImNoZWNrZWRcIiwgdHJ1ZSApO1xuXHRcdFx0XHRcdFx0dGhpcy4kY29udGVudFNpbmdsZVNwZWNpZmljLmhpZGUoKTtcblx0XHRcdFx0XHRcdHRoaXMuJGNvbnRlbnRTaW5nbGVMYXRlc3Quc2hvdygpO1xuXHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdH0gZWxzZSBpZiggcGVyaW9kID09PSBcImFsbFwiICkge1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdHRoaXMuJHBlcmlvZElucHV0cy5maWx0ZXIoIFwiW3ZhbHVlPWFsbF1cIiApLnByb3AoIFwiY2hlY2tlZFwiLCB0cnVlICk7XG5cblx0XHRcdFx0XHR0aGlzLiRjb250ZW50QWxsLnNob3coKTtcblx0XHRcdFx0XHR0aGlzLiRjb250ZW50U2luZ2xlLmhpZGUoKTtcblxuXHRcdFx0XHRcdGlmKCBtb2RlID09PSBcImNsb3Nlc3RcIiApIHtcblx0XHRcdFx0XHRcdFxuXHRcdFx0XHRcdFx0dGhpcy4kYWxsSW5wdXRzLmZpbHRlciggXCJbdmFsdWU9Y2xvc2VzdF1cIiApLnByb3AoIFwiY2hlY2tlZFwiLCB0cnVlICk7XG5cdFx0XHRcdFx0XHR0aGlzLiRjb250ZW50QWxsQ2xvc2VzdC5zaG93KCk7XG5cdFx0XHRcdFx0XHR0aGlzLiRjb250ZW50QWxsTGF0ZXN0LmhpZGUoKTtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHR9IGVsc2UgaWYoIG1vZGUgPT09IFwibGF0ZXN0XCIgKSB7XG5cdFx0XHRcdFx0XHRcblx0XHRcdFx0XHRcdHRoaXMuJGFsbElucHV0cy5maWx0ZXIoIFwiW3ZhbHVlPWxhdGVzdF1cIiApLnByb3AoIFwiY2hlY2tlZFwiLCB0cnVlICk7XG5cdFx0XHRcdFx0XHR0aGlzLiRjb250ZW50QWxsQ2xvc2VzdC5oaWRlKCk7XG5cdFx0XHRcdFx0XHR0aGlzLiRjb250ZW50QWxsTGF0ZXN0LnNob3coKTtcblx0XHRcdFx0XHRcdFxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHR9XG5cblx0XHRcdH1cblxuXHRcdFx0dGhpcy4kZWwuc2hvdygpO1xuXG5cdFx0fSxcblxuXHRcdGhpZGU6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHR0aGlzLiRlbC5oaWRlKCk7XG5cblx0XHR9LFxuXG5cdFx0b25DbG9zZUJ0bjogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHR0aGlzLmhpZGUoKTtcblxuXHRcdH0sXG5cblx0XHRvblNhdmVCdG46IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XG5cdFx0XHQvL3ZhbGlkYXRlXG5cdFx0XHR2YXIgJGludmFsaWRJbnB1dHMgPSB0aGlzLiRlbC5maW5kKCBcIi5oYXMtZXJyb3JcIiApO1xuXHRcdFx0aWYoICRpbnZhbGlkSW5wdXRzLmxlbmd0aCApIHtcblx0XHRcdFx0YWxlcnQoIFwiUGxlYXNlIGlucHV0IG51bWJlcnMhXCIgKTtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBzdHJ1Y3R1cmVcblx0XHRcdC8vIC0gcGVyaW9kXG5cdFx0XHQvL1x0XHQtIHNpbmdsZSBcblx0XHRcdC8vXHRcdFx0LSBzcGVjaWZpY1xuXHRcdFx0Ly9cdFx0XHRcdC0geWVhclxuXHRcdFx0Ly9cdFx0XHRcdC0gdG9sZXJhbmNlXG5cdFx0XHQvL1x0XHRcdC0gbGF0ZXN0XG5cdFx0XHQvL1x0XHRcdFx0LSBtYXhpbXVtIGFnZVx0XHRcdFx0XG5cdFx0XHQvL1x0XHQtIGFsbFxuXHRcdFx0Ly9cdFx0XHQtIGNsb3Nlc3Rcblx0XHRcdC8vXHRcdFx0XHQtIHRvbGVyYW5jZVxuXHRcdFx0Ly9cdFx0XHQtIGxhdGVzdFxuXHRcdFx0Ly9cdFx0XHRcdC0gbWF4aW11bSBhZ2UgIFxuXG5cdFx0XHQvLyAgYXR0cmlidXRlc1xuXHRcdFx0Ly9cdC0gZGF0YS1wZXJpb2QgW3NpbmdsZXxhbGxdIFxuXHRcdFx0Ly9cdC0gZGF0YS1tb2RlIFtzcGVjaWZpY3xsYXRlc3R8Y2xvc2VzdF0gXG5cdFx0XHQvL1x0LSBkYXRhLXRhcmdldC15ZWFyIFtudW1iZXJdIFxuXHRcdFx0Ly9cdC0gZGF0YS10b2xlcmFuY2UgW251bWJlcl0gXG5cdFx0XHQvL1x0LSBkYXRhLW1heGltdW0tYWdlIFtudW1iZXJdIFxuXG5cdFx0XHR2YXIgZGF0YSA9IHsgdmFyaWFibGVJZDogdGhpcy52YXJpYWJsZUlkIH07XG5cdFx0XHRkYXRhLnBlcmlvZCA9IHRoaXMuJHBlcmlvZElucHV0cy5maWx0ZXIoIFwiOmNoZWNrZWRcIiApLnZhbCgpO1xuXG5cdFx0XHRpZiggZGF0YS5wZXJpb2QgPT09IFwic2luZ2xlXCIgKSB7XG5cblx0XHRcdFx0ZGF0YS5tb2RlID0gdGhpcy4kc2luZ2xlSW5wdXRzLmZpbHRlciggXCI6Y2hlY2tlZFwiICkudmFsKCk7XG5cblx0XHRcdFx0aWYoIGRhdGEubW9kZSA9PT0gXCJzcGVjaWZpY1wiICkge1xuXHRcdFx0XHRcdGRhdGFbIFwidGFyZ2V0LXllYXJcIiBdID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT1zaW5nbGUteWVhcl1cIiApLnZhbCgpO1xuXHRcdFx0XHRcdGRhdGEudG9sZXJhbmNlID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT1zaW5nbGUtdG9sZXJhbmNlXVwiICkudmFsKCk7XG5cdFx0XHRcdH0gZWxzZSBpZiggZGF0YS5tb2RlID09PSBcImxhdGVzdFwiICkge1xuXHRcdFx0XHRcdGRhdGFbIFwibWF4aW11bS1hZ2VcIiBdID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT1zaW5nbGUtbWF4aW11bS1hZ2VdXCIgKS52YWwoKTtcblx0XHRcdFx0fVxuXG5cblx0XHRcdH0gZWxzZSBpZiggZGF0YS5wZXJpb2QgPT09IFwiYWxsXCIgKSB7XG5cblx0XHRcdFx0ZGF0YS5tb2RlID0gdGhpcy4kYWxsSW5wdXRzLmZpbHRlciggXCI6Y2hlY2tlZFwiICkudmFsKCk7XG5cblx0XHRcdFx0aWYoIGRhdGEubW9kZSA9PT0gXCJjbG9zZXN0XCIgKSB7XG5cdFx0XHRcdFx0ZGF0YS50b2xlcmFuY2UgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPWFsbC10b2xlcmFuY2VdXCIgKS52YWwoKTtcblx0XHRcdFx0fSBlbHNlIGlmKCBkYXRhLm1vZGUgPT09IFwibGF0ZXN0XCIgKSB7XG5cdFx0XHRcdFx0ZGF0YVsgXCJtYXhpbXVtLWFnZVwiIF0gPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPWFsbC1tYXhpbXVtLWFnZV1cIiApLnZhbCgpO1xuXHRcdFx0XHR9XG5cblx0XHRcdH1cblxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyLnRyaWdnZXIoIFwiZGltZW5zaW9uLXNldHRpbmctdXBkYXRlXCIsIGRhdGEgKTtcblxuXHRcdH0sXG5cblx0XHRvbkNhbmNlbEJ0bjogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHR0aGlzLmhpZGUoKTtcblxuXHRcdH1cblxuXHR9O1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLlVJLlNldHRpbmdzVmFyUG9wdXA7XG5cbn0pKCk7XG4iLCI7KCBmdW5jdGlvbigpIHtcblxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgdGhhdDtcblxuXHRBcHAuVmlld3MuVUkuVmFyaWFibGVTZWxlY3RzID0gZnVuY3Rpb24oKSB7XG5cblx0XHR0aGF0ID0gdGhpcztcblx0XHR0aGlzLiRkaXYgPSBudWxsO1xuXG5cdH07XG5cblx0QXBwLlZpZXdzLlVJLlZhcmlhYmxlU2VsZWN0cy5wcm90b3R5cGUgPSB7XG5cblx0XHRpbml0OiBmdW5jdGlvbigpIHtcblxuXHRcdFx0dGhpcy4kZWwgPSAkKCBcIi5mb3JtLXZhcmlhYmxlLXNlbGVjdC13cmFwcGVyXCIgKTtcblx0XHRcdHRoaXMuJGNhdGVnb3J5V3JhcHBlciA9IHRoaXMuJGVsLmZpbmQoIFwiLmNhdGVnb3J5LXdyYXBwZXJcIiApO1xuXHRcdFx0dGhpcy4kY2F0ZWdvcnlTZWxlY3QgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPWNhdGVnb3J5LWlkXVwiICk7XG5cdFx0XHR0aGlzLiRzdWJjYXRlZ29yeVdyYXBwZXIgPSB0aGlzLiRlbC5maW5kKCBcIi5zdWJjYXRlZ29yeS13cmFwcGVyXCIgKTtcblx0XHRcdHRoaXMuJHN1YmNhdGVnb3J5U2VsZWN0ID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT1zdWJjYXRlZ29yeS1pZF1cIiApO1xuXHRcdFx0dGhpcy4kdmFyaWFibGVXcmFwcGVyID0gdGhpcy4kZWwuZmluZCggXCIudmFyaWFibGUtd3JhcHBlclwiICk7XG5cdFx0XHR0aGlzLiRjaGFydFZhcmlhYmxlID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT1jaGFydC12YXJpYWJsZV1cIiApO1xuXHRcdFx0XG5cdFx0XHR0aGlzLiRjYXRlZ29yeVNlbGVjdC5vbiggXCJjaGFuZ2VcIiwgJC5wcm94eSggdGhpcy5vbkNhdGVnb3J5Q2hhbmdlLCB0aGlzICkgKTtcblx0XHRcdHRoaXMuJHN1YmNhdGVnb3J5U2VsZWN0Lm9uKCBcImNoYW5nZVwiLCAkLnByb3h5KCB0aGlzLm9uU3ViQ2F0ZWdvcnlDaGFuZ2UsIHRoaXMgKSApO1xuXG5cdFx0XHR0aGlzLiRzdWJjYXRlZ29yeVdyYXBwZXIuaGlkZSgpO1xuXHRcdFx0dGhpcy4kdmFyaWFibGVXcmFwcGVyLmhpZGUoKTtcblxuXHRcdH0sXG5cblx0XHRvbkNhdGVnb3J5Q2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0XG5cdFx0XHR2YXIgJGlucHV0ID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKTtcblx0XHRcdGlmKCAkaW5wdXQudmFsKCkgIT0gXCJcIiApIHtcblx0XHRcdFx0dGhpcy4kc3ViY2F0ZWdvcnlXcmFwcGVyLnNob3coKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuJHN1YmNhdGVnb3J5V3JhcHBlci5oaWRlKCk7XG5cdFx0XHRcdHRoaXMuJHZhcmlhYmxlV3JhcHBlci5oaWRlKCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vZmlsdGVyIHN1YmNhdGVnb3JpZXMgc2VsZWN0XG5cdFx0XHR0aGlzLiRzdWJjYXRlZ29yeVNlbGVjdC5maW5kKCBcIm9wdGlvblwiICkuaGlkZSgpO1xuXHRcdFx0dGhpcy4kc3ViY2F0ZWdvcnlTZWxlY3QuZmluZCggXCJvcHRpb25bZGF0YS1jYXRlZ29yeS1pZD1cIiArICRpbnB1dC52YWwoKSArIFwiXVwiICkuc2hvdygpO1xuXG5cdFx0fSxcblxuXHRcdG9uU3ViQ2F0ZWdvcnlDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdHZhciAkaW5wdXQgPSAkKCBldnQuY3VycmVudFRhcmdldCApO1xuXHRcdFx0aWYoICRpbnB1dC52YWwoKSAhPSBcIlwiICkge1xuXHRcdFx0XHR0aGlzLiR2YXJpYWJsZVdyYXBwZXIuc2hvdygpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy4kdmFyaWFibGVXcmFwcGVyLmhpZGUoKTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0Ly9maWx0ZXIgc3ViY2F0ZWdvcmllcyBzZWxlY3Rcblx0XHRcdHRoaXMuJGNoYXJ0VmFyaWFibGUuZmluZCggXCJvcHRpb246bm90KDpkaXNhYmxlZClcIiApLmhpZGUoKTtcblx0XHRcdHRoaXMuJGNoYXJ0VmFyaWFibGUuZmluZCggXCJvcHRpb25bZGF0YS1zdWJjYXRlZ29yeS1pZD1cIiArICRpbnB1dC52YWwoKSArIFwiXVwiICkuc2hvdygpO1xuXG5cdFx0fVxuXG5cdH07XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVmlld3MuVUkuVmFyaWFibGVTZWxlY3RzO1xuXG59KSgpO1xuIl19
