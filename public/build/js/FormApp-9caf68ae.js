(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
},{"./namespaces.js":12}],2:[function(require,module,exports){
;( function() {
	
	"use strict";

	var App = require( "./namespaces.js" ),
		Form = require( "./views/App.Views.Form.js" ),
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
},{"./models/App.Models.ChartDataModel.js":7,"./models/App.Models.ChartModel.js":9,"./namespaces.js":12,"./views/App.Views.Form.js":14}],3:[function(require,module,exports){
;( function() {
		
	"use strict";

	var App = require( "./../namespaces.js" ),
		EntityModel = require( "./../models/App.Models.EntityModel.js" );

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
},{"./../models/App.Models.EntityModel.js":11,"./../namespaces.js":12}],4:[function(require,module,exports){
;( function() {
		
	"use strict";

	var App = require( "./../namespaces.js" ),
		ChartVariableModel = require( "./../models/App.Models.ChartVariableModel.js" );
	
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
},{"./../models/App.Models.ChartVariableModel.js":10,"./../namespaces.js":12}],5:[function(require,module,exports){
;( function() {
		
	"use strict";

	var App = require( "./../namespaces.js" );

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
},{"./../namespaces.js":12}],6:[function(require,module,exports){
;( function() {
		
	"use strict";

	var App = require( "./../namespaces.js" );

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
},{"./../namespaces.js":12}],7:[function(require,module,exports){
;( function() {
		
	"use strict";

	var App = require( "./../namespaces.js" );
	
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
},{"./../namespaces.js":12}],8:[function(require,module,exports){
;( function() {
		
	"use strict";

	var App = require( "./../namespaces.js" );
	
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
},{"./../namespaces.js":12}],9:[function(require,module,exports){
;( function() {
		
	"use strict";

	var App = require( "./../namespaces.js" );
	
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
},{"./../namespaces.js":12}],10:[function(require,module,exports){
;( function() {
		
	"use strict";

	var App = require( "./../namespaces.js" );

	App.Models.ChartVariableModel = Backbone.Model.extend( {
		
		defaults: {}

	} );

	module.exports = App.Models.ChartVariableModel;

})();
},{"./../namespaces.js":12}],11:[function(require,module,exports){
;( function() {
		
	"use strict";

	var App = require( "./../namespaces.js" );
	
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
},{"./../namespaces.js":12}],12:[function(require,module,exports){
;( function() {
	
	"use strict";

	//namespaces
	var App = {};
	App.Views = {};
	App.Views.Chart = {};
	App.Views.Chart.Map = {};
	App.Views.Form = {};
	App.Views.UI = {};
	App.Models = {};
	App.Models.Import = {};
	App.Collections = {};
	App.Utils = {};
	App.Utils.FormHelper = {};

	//export for iframe
	window.$ = jQuery;

	//export
	//window.App = App;

	module.exports = App;

})();


},{}],13:[function(require,module,exports){
;( function() {
	
	"use strict";

	var App = require( "./../namespaces.js" ),
		Header = require( "./chart/App.Views.Chart.Header.js" ),
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
},{"./../App.Utils.js":1,"./../models/App.Models.ChartDataModel.js":7,"./../namespaces.js":12,"./chart/App.Views.Chart.ChartTab.js":16,"./chart/App.Views.Chart.DataTab.js":17,"./chart/App.Views.Chart.Header.js":18,"./chart/App.Views.Chart.MapTab.js":20,"./chart/App.Views.Chart.ScaleSelectors":21,"./chart/App.Views.Chart.SourcesTab.js":22}],14:[function(require,module,exports){
;( function() {
	
	"use strict";

	var App = require( "./../namespaces.js" ),
		FormView = require( "./App.Views.FormView.js" ),
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

},{"./../namespaces.js":12,"./App.Views.ChartView.js":13,"./App.Views.FormView.js":15,"./ui/App.Views.UI.VariableSelects.js":40}],15:[function(require,module,exports){
;( function() {
	
	"use strict";

	var App = require( "./../namespaces.js" ),
		ChartVariablesCollection = require( "./../collections/App.Collections.ChartVariablesCollection.js" ),
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
},{"./../collections/App.Collections.AvailableEntitiesCollection.js":3,"./../collections/App.Collections.ChartVariablesCollection.js":4,"./../collections/App.Collections.SearchDataCollection.js":5,"./../models/App.Models.AvailableTimeModel.js":6,"./../models/App.Models.ChartDimensionsModel.js":8,"./../namespaces.js":12,"./form/App.Views.Form.AxisTabView.js":25,"./form/App.Views.Form.BasicTabView.js":26,"./form/App.Views.Form.DescriptionTabView.js":27,"./form/App.Views.Form.ExportTabView.js":28,"./form/App.Views.Form.MapTabView.js":29,"./form/App.Views.Form.StylingTabView.js":30}],16:[function(require,module,exports){
;( function() {
	
	"use strict";

	var App = require( "./../../namespaces.js" ),
		Legend = require( "./App.Views.Chart.Legend" );

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
},{"./../../namespaces.js":12,"./App.Views.Chart.Legend":19}],17:[function(require,module,exports){
;( function() {
	
	"use strict";

	var App = require( "./../../namespaces.js" );

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
},{"./../../namespaces.js":12}],18:[function(require,module,exports){
;( function() {
	
	"use strict";
	
	var App = require( "./../../namespaces.js" );

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
},{"./../../namespaces.js":12}],19:[function(require,module,exports){
;( function() {
	
	"use strict";
	
	var App = require( "./../../namespaces.js" );

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
},{"./../../namespaces.js":12}],20:[function(require,module,exports){
;( function() {
	
	"use strict";

	var App = require( "./../../namespaces.js" ),
		MapControls = require( "./map/App.Views.Chart.Map.MapControls.js" ),
		Legend = require( "./map/App.Views.Chart.Map.Legend.js" ),
		ChartDataModel = require( "./../../models/App.Models.ChartDataModel.js" );

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
					dataUrl: Global.rootUrl + "/build/js/data/world.ids.json",
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
					that.mapDataModel = new ChartDataModel();
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

			this.legend = new Legend();
			
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
			var projections = this.projections,
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
		},
	
		projections: { 
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
		}

	});

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
},{"./../../models/App.Models.ChartDataModel.js":7,"./../../namespaces.js":12,"./map/App.Views.Chart.Map.Legend.js":23,"./map/App.Views.Chart.Map.MapControls.js":24}],21:[function(require,module,exports){
;( function() {
	
	"use strict";

	var App = require( "./../../namespaces.js" );

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

},{"./../../namespaces.js":12}],22:[function(require,module,exports){
;( function() {
	
	"use strict";

	var App = require( "./../../namespaces.js" );

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
},{"./../../namespaces.js":12}],23:[function(require,module,exports){
;( function() {
	
	"use strict";

	var App = require( "./../../../namespaces.js" );

	App.Views.Chart.Map.Legend = function() {

		//private
		var stepSize = 20,
			stepClass = "legend-step",
			scale;

		var formatLegendLabel = function( valueArr, i, length ) {
			
			valueArr = valueArr.map( function( d ) {
				var len = d.toString().length,
					formattedNumber = d;
				if( len > 3 ) {
					formattedNumber = d3.format( ".3r" )( d );
				}
				return formattedNumber;
			} );
			if( i < (length - 1) ) {
				return valueArr[ 0 ];
			} else {
				return valueArr.join( " &nbsp; " );
			}
		};

		function legend( selection ) {

			selection.each( function( data ) {

				var datamap = d3.select( ".datamap" ),
					container = d3.select( this ),
					containerHeight = datamap.node().getBoundingClientRect().height,
					legendOffset = 10,
					stepGap = 2,
					g = container.select( ".legend" );

				if( g.empty() ) {
					g = selection.append( "g" )
							.attr( "id", "legend" )
							.attr( "class", "legend" );
				}
				
				//start with highest value
				//data.reverse();

				//data join
				var legendSteps = g.selectAll( "." + stepClass ).data( data );
				
				//enter
				var legendStepsEnter = legendSteps.enter()
					.append( "g" )
						.attr( "class", stepClass )
						.attr( "transform", function( d, i ) { var translateX = legendOffset + (i*(stepSize+stepGap)), translateY = containerHeight - legendOffset - stepSize; return "translate(" + translateX + "," + translateY + ")"; } );
						//.attr( "transform", function( d, i ) { var translateY = containerHeight - legendOffset - stepSize - ( i*(stepSize+stepGap) ); return "translate(" + legendOffset + "," + translateY + ")"; } );
				legendStepsEnter.append( "rect" )
					.attr( "width", stepSize + "px" )
					.attr( "height", stepSize + "px" );
				legendStepsEnter.append( "text" )
					//.attr( "transform", function( d, i ) { return "translate( " + (parseInt( stepSize/1.4, 10 ) + 10) + ", " + parseInt( stepSize/1.4, 10 ) + " )"; } );
					.attr( "transform", function( d, i ) { return "translate(-2,-5)"; } );

				//update
				legendSteps.select( "rect" )
					.style( "fill", function( d, i ) {
							return d;
						} );
				legendSteps.select( "text" )
					.html( function( d, i ) { return formatLegendLabel( scale.invertExtent( d ), i, data.length ); } );

				//exit
				legendSteps.exit().remove();

			} );

			return legend;

		}

		//public methods
		legend.scale = function( value ) {
			if( !arguments.length ) {
				return scale;
			} else {
				scale = value;
			}
		};

		return legend;

	};

	module.exports = App.Views.Chart.Map.Legend;

})();
},{"./../../../namespaces.js":12}],24:[function(require,module,exports){
;( function() {
	
	"use strict";

	var App = require( "./../../../namespaces.js" );

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
},{"./../../../namespaces.js":12}],25:[function(require,module,exports){
;( function() {
	
	"use strict";

	var App = require( "./../../namespaces.js" );

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
},{"./../../namespaces.js":12}],26:[function(require,module,exports){
;( function() {
	
	"use strict";

	var App = require( "./../../namespaces.js" ),
		ChartTypeSectionView = require( "./basicTab/App.Views.Form.ChartTypeSectionView.js" ),
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

},{"./../../namespaces.js":12,"./basicTab/App.Views.Form.ChartTypeSectionView.js":31,"./dataTab/App.Views.Form.AddDataSectionView.js":32,"./dataTab/App.Views.Form.DimensionsSectionView.js":33,"./dataTab/App.Views.Form.EntitiesSectionView.js":34,"./dataTab/App.Views.Form.SelectedCountriesSectionView.js":35,"./dataTab/App.Views.Form.TimeSectionView.js":36}],27:[function(require,module,exports){
;( function() {
	
	"use strict";

	var App = require( "./../../namespaces.js" );

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
},{"./../../namespaces.js":12}],28:[function(require,module,exports){
;( function() {
	
	"use strict";

	var App = require( "./../../namespaces.js" );

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
},{"./../../namespaces.js":12}],29:[function(require,module,exports){
;( function() {
	
	"use strict";

	var App = require( "./../../namespaces.js" );

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
},{"./../../namespaces.js":12}],30:[function(require,module,exports){
;( function() {
	
	"use strict";

	var App = require( "./../../namespaces.js" );

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
},{"./../../namespaces.js":12}],31:[function(require,module,exports){
;( function() {
	
	"use strict";

	var App = require( "./../../../namespaces.js" );

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
},{"./../../../namespaces.js":12}],32:[function(require,module,exports){
;( function() {
	
	"use strict";

	var App = require( "./../../../namespaces.js" ),
		SelectVarPopup = require( "./../../ui/App.Views.UI.SelectVarPopup.js" ),
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
},{"./../../../namespaces.js":12,"./../../ui/App.Views.UI.SelectVarPopup.js":38,"./../../ui/App.Views.UI.SettingsVarPopup.js":39}],33:[function(require,module,exports){
;( function() {
	
	"use strict";
	
	var App = require( "./../../../namespaces.js" );

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
},{"./../../../namespaces.js":12}],34:[function(require,module,exports){
;( function() {
	
	"use strict";

	var App = require( "./../../../namespaces.js" );

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
},{"./../../../namespaces.js":12}],35:[function(require,module,exports){
;( function() {
	
	"use strict";

	var App = require( "./../../../namespaces.js" ),
		ColorPicker = require( "./../../ui/App.Views.UI.ColorPicker.js" );

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
},{"./../../../namespaces.js":12,"./../../ui/App.Views.UI.ColorPicker.js":37}],36:[function(require,module,exports){
;( function() {
	
	"use strict";

	var App = require( "./../../../namespaces.js" );

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
},{"./../../../namespaces.js":12}],37:[function(require,module,exports){
;( function() {

	"use strict";

	var App = require( "./../../namespaces.js" );

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
},{"./../../namespaces.js":12}],38:[function(require,module,exports){
;( function() {

	"use strict";

	var App = require( "./../../namespaces.js" );
	
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

},{"./../../namespaces.js":12}],39:[function(require,module,exports){
;( function() {

	"use strict";

	var App = require( "./../../namespaces.js" );
	
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

},{"./../../namespaces.js":12}],40:[function(require,module,exports){
;( function() {

	"use strict";

	var App = require( "./../../namespaces.js" );
	
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

},{"./../../namespaces.js":12}]},{},[2])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9sYXJhdmVsLWVsaXhpci1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC9BcHAuVXRpbHMuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC9Gb3JtQXBwLmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvY29sbGVjdGlvbnMvQXBwLkNvbGxlY3Rpb25zLkF2YWlsYWJsZUVudGl0aWVzQ29sbGVjdGlvbi5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL2NvbGxlY3Rpb25zL0FwcC5Db2xsZWN0aW9ucy5DaGFydFZhcmlhYmxlc0NvbGxlY3Rpb24uanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC9jb2xsZWN0aW9ucy9BcHAuQ29sbGVjdGlvbnMuU2VhcmNoRGF0YUNvbGxlY3Rpb24uanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC9tb2RlbHMvQXBwLk1vZGVscy5BdmFpbGFibGVUaW1lTW9kZWwuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC9tb2RlbHMvQXBwLk1vZGVscy5DaGFydERhdGFNb2RlbC5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL21vZGVscy9BcHAuTW9kZWxzLkNoYXJ0RGltZW5zaW9uc01vZGVsLmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvbW9kZWxzL0FwcC5Nb2RlbHMuQ2hhcnRNb2RlbC5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL21vZGVscy9BcHAuTW9kZWxzLkNoYXJ0VmFyaWFibGVNb2RlbC5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL21vZGVscy9BcHAuTW9kZWxzLkVudGl0eU1vZGVsLmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvbmFtZXNwYWNlcy5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL0FwcC5WaWV3cy5DaGFydFZpZXcuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy9BcHAuVmlld3MuRm9ybS5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL0FwcC5WaWV3cy5Gb3JtVmlldy5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL2NoYXJ0L0FwcC5WaWV3cy5DaGFydC5DaGFydFRhYi5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL2NoYXJ0L0FwcC5WaWV3cy5DaGFydC5EYXRhVGFiLmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvY2hhcnQvQXBwLlZpZXdzLkNoYXJ0LkhlYWRlci5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL2NoYXJ0L0FwcC5WaWV3cy5DaGFydC5MZWdlbmQuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy9jaGFydC9BcHAuVmlld3MuQ2hhcnQuTWFwVGFiLmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvY2hhcnQvQXBwLlZpZXdzLkNoYXJ0LlNjYWxlU2VsZWN0b3JzLmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvY2hhcnQvQXBwLlZpZXdzLkNoYXJ0LlNvdXJjZXNUYWIuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy9jaGFydC9tYXAvQXBwLlZpZXdzLkNoYXJ0Lk1hcC5MZWdlbmQuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy9jaGFydC9tYXAvQXBwLlZpZXdzLkNoYXJ0Lk1hcC5NYXBDb250cm9scy5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL2Zvcm0vQXBwLlZpZXdzLkZvcm0uQXhpc1RhYlZpZXcuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy9mb3JtL0FwcC5WaWV3cy5Gb3JtLkJhc2ljVGFiVmlldy5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL2Zvcm0vQXBwLlZpZXdzLkZvcm0uRGVzY3JpcHRpb25UYWJWaWV3LmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvZm9ybS9BcHAuVmlld3MuRm9ybS5FeHBvcnRUYWJWaWV3LmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvZm9ybS9BcHAuVmlld3MuRm9ybS5NYXBUYWJWaWV3LmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvZm9ybS9BcHAuVmlld3MuRm9ybS5TdHlsaW5nVGFiVmlldy5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL2Zvcm0vYmFzaWNUYWIvQXBwLlZpZXdzLkZvcm0uQ2hhcnRUeXBlU2VjdGlvblZpZXcuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy9mb3JtL2RhdGFUYWIvQXBwLlZpZXdzLkZvcm0uQWRkRGF0YVNlY3Rpb25WaWV3LmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvZm9ybS9kYXRhVGFiL0FwcC5WaWV3cy5Gb3JtLkRpbWVuc2lvbnNTZWN0aW9uVmlldy5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL2Zvcm0vZGF0YVRhYi9BcHAuVmlld3MuRm9ybS5FbnRpdGllc1NlY3Rpb25WaWV3LmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvZm9ybS9kYXRhVGFiL0FwcC5WaWV3cy5Gb3JtLlNlbGVjdGVkQ291bnRyaWVzU2VjdGlvblZpZXcuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy9mb3JtL2RhdGFUYWIvQXBwLlZpZXdzLkZvcm0uVGltZVNlY3Rpb25WaWV3LmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvdWkvQXBwLlZpZXdzLlVJLkNvbG9yUGlja2VyLmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvdWkvQXBwLlZpZXdzLlVJLlNlbGVjdFZhclBvcHVwLmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvdWkvQXBwLlZpZXdzLlVJLlNldHRpbmdzVmFyUG9wdXAuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy91aS9BcHAuVmlld3MuVUkuVmFyaWFibGVTZWxlY3RzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyc0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9hQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNWxCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2UkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyT0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiOyggZnVuY3Rpb24oKSB7XG5cblx0XCJ1c2Ugc3RyaWN0XCI7XG5cdFxuXHR2YXIgQXBwID0gcmVxdWlyZSggXCIuL25hbWVzcGFjZXMuanNcIiApO1xuXG5cdEFwcC5VdGlscy5tYXBEYXRhID0gZnVuY3Rpb24oIHJhd0RhdGEsIHRyYW5zcG9zZWQgKSB7XG5cblx0XHR2YXIgZGF0YSA9IFtdLFxuXHRcdFx0ZGF0YUJ5SWQgPSBbXSxcblx0XHRcdGNvdW50cnlJbmRleCA9IDE7XG5cblx0XHQvL2RvIHdlIGhhdmUgZW50aXRpZXMgaW4gcm93cyBhbmQgdGltZXMgaW4gY29sdW1ucz9cdFxuXHRcdGlmKCAhdHJhbnNwb3NlZCApIHtcblx0XHRcdC8vbm8sIHdlIGhhdmUgdG8gc3dpdGNoIHJvd3MgYW5kIGNvbHVtbnNcblx0XHRcdHJhd0RhdGEgPSBBcHAuVXRpbHMudHJhbnNwb3NlKCByYXdEYXRhICk7XG5cdFx0fVxuXHRcdFxuXHRcdC8vZXh0cmFjdCB0aW1lIGNvbHVtblxuXHRcdHZhciB0aW1lQXJyID0gcmF3RGF0YS5zaGlmdCgpO1xuXHRcdC8vZ2V0IHJpZCBvZiBmaXJzdCBpdGVtIChsYWJlbCBvZiB0aW1lIGNvbHVtbikgXG5cdFx0dGltZUFyci5zaGlmdCgpO1xuXHRcblx0XHRmb3IoIHZhciBpID0gMCwgbGVuID0gcmF3RGF0YS5sZW5ndGg7IGkgPCBsZW47IGkrKyApIHtcblxuXHRcdFx0dmFyIHNpbmdsZVJvdyA9IHJhd0RhdGFbIGkgXSxcblx0XHRcdFx0Y29sTmFtZSA9IHNpbmdsZVJvdy5zaGlmdCgpO1xuXHRcdFx0XHRcblx0XHRcdC8vb21taXQgcm93cyB3aXRoIG5vIGNvbE5tYWVcblx0XHRcdGlmKCBjb2xOYW1lICkge1xuXHRcdFx0XHR2YXIgc2luZ2xlRGF0YSA9IFtdO1xuXHRcdFx0XHRfLmVhY2goIHNpbmdsZVJvdywgZnVuY3Rpb24oIHZhbHVlLCBpICkge1xuXHRcdFx0XHRcdC8vY2hlY2sgd2UgaGF2ZSB2YWx1ZVxuXHRcdFx0XHRcdGlmKCB2YWx1ZSAhPT0gXCJcIiApIHtcblx0XHRcdFx0XHRcdHNpbmdsZURhdGEucHVzaCggeyB4OiB0aW1lQXJyW2ldLCB5OiAoICFpc05hTiggdmFsdWUgKSApPyArdmFsdWU6IHZhbHVlIH0gKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gKTtcblxuXHRcdFx0XHQvL2NvbnN0cnVjdCBlbnRpdHkgb2JqXG5cdFx0XHRcdHZhclx0ZW50aXR5T2JqID0ge1xuXHRcdFx0XHRcdGlkOiBpLFxuXHRcdFx0XHRcdGtleTogY29sTmFtZSxcblx0XHRcdFx0XHR2YWx1ZXM6IHNpbmdsZURhdGFcblx0XHRcdFx0fTtcblx0XHRcdFx0ZGF0YS5wdXNoKCBlbnRpdHlPYmogKTtcblx0XHRcdH1cblxuXHRcdH1cblxuXHRcdHJldHVybiBkYXRhO1xuXG5cdH0sXG5cblx0QXBwLlV0aWxzLm1hcFNpbmdsZVZhcmlhbnREYXRhID0gZnVuY3Rpb24oIHJhd0RhdGEsIHZhcmlhYmxlTmFtZSApIHtcblxuXHRcdHZhciB2YXJpYWJsZSA9IHtcblx0XHRcdG5hbWU6IHZhcmlhYmxlTmFtZSxcblx0XHRcdHZhbHVlczogQXBwLlV0aWxzLm1hcERhdGEoIHJhd0RhdGEsIHRydWUgKVxuXHRcdH07XG5cdFx0cmV0dXJuIFt2YXJpYWJsZV07XG5cblx0fSxcblxuXHQvKkFwcC5VdGlscy5tYXBNdWx0aVZhcmlhbnREYXRhID0gZnVuY3Rpb24oIHJhd0RhdGEsIGVudGl0eU5hbWUgKSB7XG5cdFx0XG5cdFx0Ly90cmFuc2Zvcm0gbXVsdGl2YXJpYW50IGludG8gc3RhbmRhcmQgZm9ybWF0ICggdGltZSwgZW50aXR5IClcblx0XHR2YXIgdmFyaWFibGVzID0gW10sXG5cdFx0XHR0cmFuc3Bvc2VkID0gcmF3RGF0YSwvL0FwcC5VdGlscy50cmFuc3Bvc2UoIHJhd0RhdGEgKSxcblx0XHRcdHRpbWVBcnIgPSB0cmFuc3Bvc2VkLnNoaWZ0KCk7XG5cblx0XHQvL2dldCByaWQgb2YgZmlyc3QgaXRlbSAobGFiZWwgb2YgdGltZSBjb2x1bW4pIFxuXHRcdC8vdGltZUFyci5zaGlmdCgpO1xuXHRcdFxuXHRcdF8uZWFjaCggdHJhbnNwb3NlZCwgZnVuY3Rpb24oIHZhbHVlcywga2V5LCBsaXN0ICkge1xuXG5cdFx0XHQvL2dldCB2YXJpYWJsZSBuYW1lIGZyb20gZmlyc3QgY2VsbCBvZiBjb2x1bW5zXG5cdFx0XHR2YXIgdmFyaWFibGVOYW1lID0gdmFsdWVzLnNoaWZ0KCk7XG5cdFx0XHQvL2FkZCBlbnRpdHkgbmFtZSBhcyBmaXJzdCBjZWxsXG5cdFx0XHR2YWx1ZXMudW5zaGlmdCggZW50aXR5TmFtZSApO1xuXHRcdFx0Ly9jb25zdHJ1Y3QgYXJyYXkgZm9yIG1hcHBpbmcsIG5lZWQgdG8gZGVlcCBjb3B5IHRpbWVBcnJcblx0XHRcdHZhciBsb2NhbFRpbWVBcnIgPSAkLmV4dGVuZCggdHJ1ZSwgW10sIHRpbWVBcnIpO1xuXHRcdFx0dmFyIGRhdGFUb01hcCA9IFsgbG9jYWxUaW1lQXJyLCB2YWx1ZXMgXTtcblx0XHRcdC8vY29uc3RydWN0IG9iamVjdFxuXHRcdFx0dmFyIHZhcmlhYmxlID0ge1xuXHRcdFx0XHRuYW1lOiB2YXJpYWJsZU5hbWUsXG5cdFx0XHRcdHZhbHVlczogQXBwLlV0aWxzLm1hcERhdGEoIGRhdGFUb01hcCwgdHJ1ZSApXG5cdFx0XHR9O1xuXHRcdFx0dmFyaWFibGVzLnB1c2goIHZhcmlhYmxlICk7XG5cblx0XHR9ICk7XG5cblx0XHRyZXR1cm4gdmFyaWFibGVzO1xuXG5cdH0sKi9cblxuXHRBcHAuVXRpbHMubWFwTXVsdGlWYXJpYW50RGF0YSA9IGZ1bmN0aW9uKCByYXdEYXRhICkge1xuXHRcdFxuXHRcdHZhciB2YXJpYWJsZXMgPSBbXSxcblx0XHRcdHRyYW5zcG9zZWQgPSByYXdEYXRhLFxuXHRcdFx0aGVhZGVyQXJyID0gdHJhbnNwb3NlZC5zaGlmdCgpO1xuXG5cdFx0Ly9nZXQgcmlkIG9mIGVudGl0eSBhbmQgeWVhciBjb2x1bW4gbmFtZVxuXHRcdGhlYWRlckFyciA9IGhlYWRlckFyci5zbGljZSggMiApO1xuXG5cdFx0dmFyIHZhclBlclJvd0RhdGEgPSBBcHAuVXRpbHMudHJhbnNwb3NlKCB0cmFuc3Bvc2VkICksXG5cdFx0XHRlbnRpdGllc1JvdyA9IHZhclBlclJvd0RhdGEuc2hpZnQoKSxcblx0XHRcdHRpbWVzUm93ID0gdmFyUGVyUm93RGF0YS5zaGlmdCgpO1xuXG5cdFx0Xy5lYWNoKCB2YXJQZXJSb3dEYXRhLCBmdW5jdGlvbiggdmFsdWVzLCB2YXJJbmRleCApIHtcblx0XHRcdFxuXHRcdFx0dmFyIGVudGl0aWVzID0ge307XG5cdFx0XHQvL2l0ZXJhdGUgdGhyb3VnaCBhbGwgdmFsdWVzIGZvciBnaXZlbiB2YXJpYWJsZVxuXHRcdFx0Xy5lYWNoKCB2YWx1ZXMsIGZ1bmN0aW9uKCB2YWx1ZSwga2V5ICkge1xuXHRcdFx0XHR2YXIgZW50aXR5ID0gZW50aXRpZXNSb3dbIGtleSBdLFxuXHRcdFx0XHRcdHRpbWUgPSB0aW1lc1Jvd1sga2V5IF07XG5cdFx0XHRcdGlmKCBlbnRpdHkgJiYgdGltZSApIHtcblx0XHRcdFx0XHQvL2RvIGhhdmUgYWxyZWFkeSBlbnRpdHkgZGVmaW5lZD9cblx0XHRcdFx0XHRpZiggIWVudGl0aWVzWyBlbnRpdHkgXSApIHtcblx0XHRcdFx0XHRcdGVudGl0aWVzWyBlbnRpdHkgXSA9IHtcblx0XHRcdFx0XHRcdFx0aWQ6IGtleSxcblx0XHRcdFx0XHRcdFx0a2V5OiBlbnRpdHksXG5cdFx0XHRcdFx0XHRcdHZhbHVlczogW11cblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVudGl0aWVzWyBlbnRpdHkgXS52YWx1ZXMucHVzaCggeyB4OiB0aW1lLCB5OiAoICFpc05hTiggdmFsdWUgKSApPyArdmFsdWU6IHZhbHVlIH0gKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXG5cdFx0XHQvL2hhdmUgZGF0YSBmb3IgYWxsIGVudGl0aWVzLCBqdXN0IGNvbnZlcnQgdGhlbSB0byBhcnJheVxuXHRcdFx0dmFyIHZhclZhbHVlcyA9IF8ubWFwKCBlbnRpdGllcywgZnVuY3Rpb24oIHZhbHVlICkgeyByZXR1cm4gdmFsdWU7IH0gKTtcblx0XHRcdFxuXHRcdFx0dmFyIHZhcmlhYmxlID0ge1xuXHRcdFx0XHRuYW1lOiBoZWFkZXJBcnJbIHZhckluZGV4IF0sXG5cdFx0XHRcdHZhbHVlczogdmFyVmFsdWVzXG5cdFx0XHR9O1xuXHRcdFx0dmFyaWFibGVzLnB1c2goIHZhcmlhYmxlICk7XG5cblx0XHR9ICk7XG5cblx0XHRyZXR1cm4gdmFyaWFibGVzO1xuXG5cdH0sXG5cblxuXHRBcHAuVXRpbHMudHJhbnNwb3NlID0gZnVuY3Rpb24oIGFyciApIHtcblx0XHR2YXIga2V5cyA9IF8ua2V5cyggYXJyWzBdICk7XG5cdFx0cmV0dXJuIF8ubWFwKCBrZXlzLCBmdW5jdGlvbiAoYykge1xuXHRcdFx0cmV0dXJuIF8ubWFwKCBhcnIsIGZ1bmN0aW9uKCByICkge1xuXHRcdFx0XHRyZXR1cm4gcltjXTtcblx0XHRcdH0gKTtcblx0XHR9KTtcblx0fSxcblxuXHRBcHAuVXRpbHMudHJhbnNmb3JtID0gZnVuY3Rpb24oKSB7XG5cblx0XHRjb25zb2xlLmxvZyggXCJhcHAudXRpbHMudHJhbnNmb3JtXCIgKTtcblxuXHR9LFxuXG5cdEFwcC5VdGlscy5lbmNvZGVTdmdUb1BuZyA9IGZ1bmN0aW9uKCBodG1sICkge1xuXG5cdFx0Y29uc29sZS5sb2coIGh0bWwgKTtcblx0XHR2YXIgaW1nU3JjID0gXCJkYXRhOmltYWdlL3N2Zyt4bWw7YmFzZTY0LFwiICsgYnRvYShodG1sKSxcblx0XHRcdGltZyA9IFwiPGltZyBzcmM9J1wiICsgaW1nU3JjICsgXCInPlwiOyBcblx0XHRcblx0XHQvL2QzLnNlbGVjdCggXCIjc3ZnZGF0YXVybFwiICkuaHRtbCggaW1nICk7XG5cblx0XHQkKCBcIi5jaGFydC13cmFwcGVyLWlubmVyXCIgKS5odG1sKCBpbWcgKTtcblxuXHRcdC8qdmFyIGNhbnZhcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoIFwiY2FudmFzXCIgKSxcblx0XHRcdGNvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dCggXCIyZFwiICk7XG5cblx0XHR2YXIgaW1hZ2UgPSBuZXcgSW1hZ2U7XG5cdFx0aW1hZ2Uuc3JjID0gaW1nc3JjO1xuXHRcdGltYWdlLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0Y29udGV4dC5kcmF3SW1hZ2UoaW1hZ2UsIDAsIDApO1xuXHRcdFx0dmFyIGNhbnZhc0RhdGEgPSBjYW52YXMudG9EYXRhVVJMKCBcImltYWdlL3BuZ1wiICk7XG5cdFx0XHR2YXIgcG5nSW1nID0gJzxpbWcgc3JjPVwiJyArIGNhbnZhc0RhdGEgKyAnXCI+JzsgXG5cdFx0XHRkMy5zZWxlY3QoXCIjcG5nZGF0YXVybFwiKS5odG1sKHBuZ2ltZyk7XG5cblx0XHRcdHZhciBhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImFcIik7XG5cdFx0XHRhLmRvd25sb2FkID0gXCJzYW1wbGUucG5nXCI7XG5cdFx0XHRhLmhyZWYgPSBjYW52YXNkYXRhO1xuXHRcdFx0YS5jbGljaygpO1xuXHRcdH07Ki9cblxuXG5cdH07XG5cblx0LyoqXG5cdCpcdFRJTUUgUkVMQVRFRCBGVU5DVElPTlNcblx0KiovXG5cblx0QXBwLlV0aWxzLm50aCA9IGZ1bmN0aW9uICggZCApIHtcblx0XHQvL2NvbnZlciB0byBudW1iZXIganVzdCBpbiBjYXNlXG5cdFx0ZCA9ICtkO1xuXHRcdGlmKCBkID4gMyAmJiBkIDwgMjEgKSByZXR1cm4gJ3RoJzsgLy8gdGhhbmtzIGtlbm5lYmVjXG5cdFx0c3dpdGNoKCBkICUgMTAgKSB7XG5cdFx0XHRjYXNlIDE6ICByZXR1cm4gXCJzdFwiO1xuXHRcdFx0Y2FzZSAyOiAgcmV0dXJuIFwibmRcIjtcblx0XHRcdGNhc2UgMzogIHJldHVybiBcInJkXCI7XG5cdFx0XHRkZWZhdWx0OiByZXR1cm4gXCJ0aFwiO1xuXHRcdH1cblx0fVxuXG5cdEFwcC5VdGlscy5jZW50dXJ5U3RyaW5nID0gZnVuY3Rpb24gKCBkICkge1xuXHRcdC8vY29udmVyIHRvIG51bWJlciBqdXN0IGluIGNhc2Vcblx0XHRkID0gK2Q7XG5cdFx0XG5cdFx0dmFyIGNlbnR1cnlOdW0gPSBNYXRoLmZsb29yKGQgLyAxMDApICsgMSxcblx0XHRcdGNlbnR1cnlTdHJpbmcgPSBjZW50dXJ5TnVtLnRvU3RyaW5nKCksXG5cdFx0XHRudGggPSBBcHAuVXRpbHMubnRoKCBjZW50dXJ5U3RyaW5nICk7XG5cblx0XHRyZXR1cm4gY2VudHVyeVN0cmluZyArIG50aCArIFwiIGNlbnR1cnlcIjtcblx0fVxuXG5cdEFwcC5VdGlscy5hZGRaZXJvcyA9IGZ1bmN0aW9uICggdmFsdWUgKSB7XG5cblx0XHR2YWx1ZSA9IHZhbHVlLnRvU3RyaW5nKCk7XG5cdFx0aWYoIHZhbHVlLmxlbmd0aCA8IDQgKSB7XG5cdFx0XHQvL2luc2VydCBtaXNzaW5nIHplcm9zXG5cdFx0XHR2YXIgdmFsdWVMZW4gPSB2YWx1ZS5sZW5ndGg7XG5cdFx0XHRmb3IoIHZhciB5ID0gMDsgeSA8IDQgLSB2YWx1ZUxlbjsgeSsrICkge1xuXHRcdFx0XHR2YWx1ZSA9IFwiMFwiICsgdmFsdWU7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB2YWx1ZTtcblx0XHRcblx0fVxuXG5cdEFwcC5VdGlscy5yb3VuZFRpbWUgPSBmdW5jdGlvbiggbW9tZW50VGltZSApIHtcblxuXHRcdGlmKCB0eXBlb2YgbW9tZW50VGltZS5mb3JtYXQgPT09IFwiZnVuY3Rpb25cIiApIHtcblx0XHRcdC8vdXNlIHNob3J0IGZvcm1hdCBteXNxbCBleHBlY3RzIC0gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8xMDUzOTE1NC9pbnNlcnQtaW50by1kYi1kYXRldGltZS1zdHJpbmdcblx0XHRcdHJldHVybiBtb21lbnRUaW1lLmZvcm1hdCggXCJZWVlZLU1NLUREXCIgKTtcblx0XHR9XG5cdFx0cmV0dXJuIG1vbWVudFRpbWU7XG5cblx0fVxuXG5cdC8qKiBcblx0KiBGT1JNIEhFTFBFUlxuXHQqKi9cblx0QXBwLlV0aWxzLkZvcm1IZWxwZXIudmFsaWRhdGUgPSBmdW5jdGlvbiggJGZvcm0gKSB7XG5cdFx0XG5cdFx0dmFyIG1pc3NpbmdFcnJvckxhYmVsID0gXCJQbGVhc2UgZW50ZXIgdmFsdWUuXCIsXG5cdFx0XHRlbWFpbEVycm9yTGFiZWwgPSAgXCJQbGVhc2UgZW50ZXIgdmFsaWRlIGVtYWlsLlwiLFxuXHRcdFx0bnVtYmVyRXJyb3JMYWJlbCA9IFwiUGxlYXNlIGVudGUgdmFsaWQgbnVtYmVyLlwiOyBcblxuXHRcdHZhciBpbnZhbGlkSW5wdXRzID0gW107XG5cdFx0XG5cdFx0Ly9nYXRoZXIgYWxsIGZpZWxkcyByZXF1aXJpbmcgdmFsaWRhdGlvblxuXHRcdHZhciAkcmVxdWlyZWRJbnB1dHMgPSAkZm9ybS5maW5kKCBcIi5yZXF1aXJlZFwiICk7XG5cdFx0aWYoICRyZXF1aXJlZElucHV0cy5sZW5ndGggKSB7XG5cblx0XHRcdCQuZWFjaCggJHJlcXVpcmVkSW5wdXRzLCBmdW5jdGlvbiggaSwgdiApIHtcblxuXHRcdFx0XHR2YXIgJGlucHV0ID0gJCggdGhpcyApO1xuXHRcdFx0XHRcblx0XHRcdFx0Ly9maWx0ZXIgb25seSB2aXNpYmxlXG5cdFx0XHRcdGlmKCAhJGlucHV0LmlzKCBcIjp2aXNpYmxlXCIgKSApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvL2NoZWNrIGZvciBlbXB0eVxuXHRcdFx0XHR2YXIgaW5wdXRWYWxpZCA9IEFwcC5VdGlscy5Gb3JtSGVscGVyLnZhbGlkYXRlUmVxdWlyZWRGaWVsZCggJGlucHV0ICk7XG5cdFx0XHRcdGlmKCAhaW5wdXRWYWxpZCApIHtcblx0XHRcdFx0XG5cdFx0XHRcdFx0QXBwLlV0aWxzLkZvcm1IZWxwZXIuYWRkRXJyb3IoICRpbnB1dCwgbWlzc2luZ0Vycm9yTGFiZWwgKTtcblx0XHRcdFx0XHRpbnZhbGlkSW5wdXRzLnB1c2goICRpbnB1dCApO1xuXHRcdFx0XHRcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHRBcHAuVXRpbHMuRm9ybUhlbHBlci5yZW1vdmVFcnJvciggJGlucHV0ICk7XG5cblx0XHRcdFx0XHQvL2NoZWNrIGZvciBkaWdpdFxuXHRcdFx0XHRcdGlmKCAkaW5wdXQuaGFzQ2xhc3MoIFwicmVxdWlyZWQtbnVtYmVyXCIgKSApIHtcblx0XHRcdFx0XHRcdGlucHV0VmFsaWQgPSBBcHAuVXRpbHMuRm9ybUhlbHBlci52YWxpZGF0ZU51bWJlckZpZWxkKCAkaW5wdXQgKTtcblx0XHRcdFx0XHRcdGlmKCAhaW5wdXRWYWxpZCApIHtcblx0XHRcdFx0XHRcdFx0QXBwLlV0aWxzLkZvcm1IZWxwZXIuYWRkRXJyb3IoICRpbnB1dCwgbnVtYmVyRXJyb3JMYWJlbCApO1xuXHRcdFx0XHRcdFx0XHRpbnZhbGlkSW5wdXRzLnB1c2goICRpbnB1dCApO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0QXBwLlV0aWxzLkZvcm1IZWxwZXIucmVtb3ZlRXJyb3IoICRpbnB1dCApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vY2hlY2sgZm9yIG1haWxcblx0XHRcdFx0XHRpZiggJGlucHV0Lmhhc0NsYXNzKCBcInJlcXVpcmVkLW1haWxcIiApICkge1xuXHRcdFx0XHRcdFx0aW5wdXRWYWxpZCA9IEZvcm1IZWxwZXIudmFsaWRhdGVFbWFpbEZpZWxkKCAkaW5wdXQgKTtcblx0XHRcdFx0XHRcdGlmKCAhaW5wdXRWYWxpZCApIHtcblx0XHRcdFx0XHRcdFx0QXBwLlV0aWxzLkZvcm1IZWxwZXIuYWRkRXJyb3IoICRpbnB1dCwgZW1haWxFcnJvckxhYmVsICk7XG5cdFx0XHRcdFx0XHRcdGludmFsaWRJbnB1dHMucHVzaCggJGlucHV0ICk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRBcHAuVXRpbHMuRm9ybUhlbHBlci5yZW1vdmVFcnJvciggJGlucHV0ICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly9jaGVjayBmb3IgY2hlY2tib3hcblx0XHRcdFx0XHRpZiggJGlucHV0Lmhhc0NsYXNzKCBcInJlcXVpcmVkLWNoZWNrYm94XCIgKSApIHtcblxuXHRcdFx0XHRcdFx0aW5wdXRWYWxpZCA9IEZvcm1IZWxwZXIudmFsaWRhdGVDaGVja2JveCggJGlucHV0ICk7XG5cdFx0XHRcdFx0XHRpZiggIWlucHV0VmFsaWQgKSB7XG5cdFx0XHRcdFx0XHRcdEFwcC5VdGlscy5Gb3JtSGVscGVyLmFkZEVycm9yKCAkaW5wdXQsIG1pc3NpbmdFcnJvckxhYmVsICk7XG5cdFx0XHRcdFx0XHRcdGludmFsaWRJbnB1dHMucHVzaCggJGlucHV0ICk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRBcHAuVXRpbHMuRm9ybUhlbHBlci5yZW1vdmVFcnJvciggJGlucHV0ICk7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0fVxuXHRcblx0XHRcdH0gKTtcblxuXHRcdH1cblxuXG5cdFx0aWYoIGludmFsaWRJbnB1dHMubGVuZ3RoICkge1xuXG5cdFx0XHQvL3Rha2UgZmlyc3QgZWxlbWVudCBhbmQgc2Nyb2xsIHRvIGl0XG5cdFx0XHR2YXIgJGZpcnN0SW52YWxpZElucHV0ID0gaW52YWxpZElucHV0c1swXTtcblx0XHRcdCQoJ2h0bWwsIGJvZHknKS5hbmltYXRlKCB7XG5cdFx0XHRcdHNjcm9sbFRvcDogJGZpcnN0SW52YWxpZElucHV0Lm9mZnNldCgpLnRvcCAtIDI1XG5cdFx0XHR9LCAyNTApO1xuXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTsgXG5cblx0fTtcblxuXHRBcHAuVXRpbHMuRm9ybUhlbHBlci52YWxpZGF0ZVJlcXVpcmVkRmllbGQgPSBmdW5jdGlvbiggJGlucHV0ICkge1xuXG5cdFx0cmV0dXJuICggJGlucHV0LnZhbCgpID09PSBcIlwiICkgPyBmYWxzZSA6IHRydWU7XG5cblx0fTtcblxuXHRBcHAuVXRpbHMuRm9ybUhlbHBlci52YWxpZGF0ZUVtYWlsRmllbGQgPSBmdW5jdGlvbiggJGlucHV0ICkge1xuXG5cdFx0dmFyIGVtYWlsID0gJGlucHV0LnZhbCgpO1xuXHRcdHZhciByZWdleCA9IC9eKFtcXHctXFwuXStAKFtcXHctXStcXC4pK1tcXHctXXsyLDZ9KT8kLztcblx0XHRyZXR1cm4gcmVnZXgudGVzdCggZW1haWwgKTtcblxuXHR9O1xuXG5cdEFwcC5VdGlscy5Gb3JtSGVscGVyLnZhbGlkYXRlTnVtYmVyRmllbGQgPSBmdW5jdGlvbiggJGlucHV0ICkge1xuXG5cdFx0cmV0dXJuICggaXNOYU4oICRpbnB1dC52YWwoKSApICkgPyBmYWxzZSA6IHRydWU7XG5cblx0fTtcblxuXHRBcHAuVXRpbHMuRm9ybUhlbHBlci52YWxpZGF0ZUNoZWNrYm94ID0gZnVuY3Rpb24oICRpbnB1dCApIHtcblxuXHRcdHJldHVybiAoICRpbnB1dC5pcygnOmNoZWNrZWQnKSApID8gdHJ1ZSA6IGZhbHNlO1xuXG5cdH07XG5cblxuXHRBcHAuVXRpbHMuRm9ybUhlbHBlci5hZGRFcnJvciA9IGZ1bmN0aW9uKCAkZWwsICRtc2cgKSB7XG5cblx0XHRpZiggJGVsICkge1xuXHRcdFx0aWYoICEkZWwuaGFzQ2xhc3MoIFwiZXJyb3JcIiApICkge1xuXHRcdFx0XHQkZWwuYWRkQ2xhc3MoIFwiZXJyb3JcIiApO1xuXHRcdFx0XHQkZWwuYmVmb3JlKCBcIjxwIGNsYXNzPSdlcnJvci1sYWJlbCc+XCIgKyAkbXNnICsgXCI8L3A+XCIgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0fTtcblxuXHRBcHAuVXRpbHMuRm9ybUhlbHBlci5yZW1vdmVFcnJvciA9IGZ1bmN0aW9uKCAkZWwgKSB7XG5cblx0XHRpZiggJGVsICkge1xuXHRcdFx0JGVsLnJlbW92ZUNsYXNzKCBcImVycm9yXCIgKTtcblx0XHRcdHZhciAkcGFyZW50ID0gJGVsLnBhcmVudCgpO1xuXHRcdFx0dmFyICRlcnJvckxhYmVsID0gJHBhcmVudC5maW5kKCBcIi5lcnJvci1sYWJlbFwiICk7XG5cdFx0XHRpZiggJGVycm9yTGFiZWwubGVuZ3RoICkge1xuXHRcdFx0XHQkZXJyb3JMYWJlbC5yZW1vdmUoKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0XG5cdH07XG5cblx0QXBwLlV0aWxzLndyYXAgPSBmdW5jdGlvbiggJGVsLCB3aWR0aCApIHtcblx0XHRcblx0XHQvL2dldCByaWQgb2YgcG90ZW50aWFsIHRzcGFucyBhbmQgZ2V0IHB1cmUgY29udGVudCAoaW5jbHVkaW5nIGh5cGVybGlua3MpXG5cdFx0dmFyIHRleHRDb250ZW50ID0gXCJcIixcblx0XHRcdCR0c3BhbnMgPSAkZWwuZmluZCggXCJ0c3BhblwiICk7XG5cdFx0aWYoICR0c3BhbnMubGVuZ3RoICkge1xuXHRcdFx0JC5lYWNoKCAkdHNwYW5zLCBmdW5jdGlvbiggaSwgdiApIHtcblx0XHRcdFx0aWYoIGkgPiAwICkge1xuXHRcdFx0XHRcdHRleHRDb250ZW50ICs9IFwiIFwiO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRleHRDb250ZW50ICs9ICQodikudGV4dCgpO1xuXHRcdFx0fSApO1x0XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vZWxlbWVudCBoYXMgbm8gdHNwYW5zLCBwb3NzaWJseSBmaXJzdCBydW5cblx0XHRcdHRleHRDb250ZW50ID0gJGVsLnRleHQoKTtcblx0XHR9XG5cdFx0XG5cdFx0Ly9hcHBlbmQgdG8gZWxlbWVudFxuXHRcdGlmKCB0ZXh0Q29udGVudCApIHtcblx0XHRcdCRlbC50ZXh0KCB0ZXh0Q29udGVudCApO1xuXHRcdH1cblx0XHRcblx0XHR2YXIgdGV4dCA9IGQzLnNlbGVjdCggJGVsLnNlbGVjdG9yICk7XG5cdFx0dGV4dC5lYWNoKCBmdW5jdGlvbigpIHtcblx0XHRcdHZhciB0ZXh0ID0gZDMuc2VsZWN0KHRoaXMpLFxuXHRcdFx0XHRyZWdleCA9IC9cXHMrLyxcblx0XHRcdFx0d29yZHMgPSB0ZXh0LnRleHQoKS5zcGxpdChyZWdleCkucmV2ZXJzZSgpO1xuXG5cdFx0XHR2YXIgd29yZCxcblx0XHRcdFx0bGluZSA9IFtdLFxuXHRcdFx0XHRsaW5lTnVtYmVyID0gMCxcblx0XHRcdFx0bGluZUhlaWdodCA9IDEuNCwgLy8gZW1zXG5cdFx0XHRcdHkgPSB0ZXh0LmF0dHIoXCJ5XCIpLFxuXHRcdFx0XHRkeSA9IHBhcnNlRmxvYXQodGV4dC5hdHRyKFwiZHlcIikpLFxuXHRcdFx0XHR0c3BhbiA9IHRleHQudGV4dChudWxsKS5hcHBlbmQoXCJ0c3BhblwiKS5hdHRyKFwieFwiLCAwKS5hdHRyKFwieVwiLCB5KS5hdHRyKFwiZHlcIiwgZHkgKyBcImVtXCIpO1xuXHRcdFx0XG5cdFx0XHR3aGlsZSggd29yZCA9IHdvcmRzLnBvcCgpICkge1xuXHRcdFx0XHRsaW5lLnB1c2god29yZCk7XG5cdFx0XHRcdHRzcGFuLmh0bWwobGluZS5qb2luKFwiIFwiKSk7XG5cdFx0XHRcdGlmKCB0c3Bhbi5ub2RlKCkuZ2V0Q29tcHV0ZWRUZXh0TGVuZ3RoKCkgPiB3aWR0aCApIHtcblx0XHRcdFx0XHRsaW5lLnBvcCgpO1xuXHRcdFx0XHRcdHRzcGFuLnRleHQobGluZS5qb2luKFwiIFwiKSk7XG5cdFx0XHRcdFx0bGluZSA9IFt3b3JkXTtcblx0XHRcdFx0XHR0c3BhbiA9IHRleHQuYXBwZW5kKFwidHNwYW5cIikuYXR0cihcInhcIiwgMCkuYXR0cihcInlcIiwgeSkuYXR0cihcImR5XCIsICsrbGluZU51bWJlciAqIGxpbmVIZWlnaHQgKyBkeSArIFwiZW1cIikudGV4dCh3b3JkKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0fSApO1xuXG5cdFx0XG5cdH07XG5cblx0LyoqXG5cdCogQ29udmVydCBhIHN0cmluZyB0byBIVE1MIGVudGl0aWVzXG5cdCovXG5cdEFwcC5VdGlscy50b0h0bWxFbnRpdGllcyA9IGZ1bmN0aW9uKHN0cmluZykge1xuXHRcdHJldHVybiBzdHJpbmcucmVwbGFjZSgvLi9nbSwgZnVuY3Rpb24ocykge1xuXHRcdFx0cmV0dXJuIFwiJiNcIiArIHMuY2hhckNvZGVBdCgwKSArIFwiO1wiO1xuXHRcdH0pO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDcmVhdGUgc3RyaW5nIGZyb20gSFRNTCBlbnRpdGllc1xuXHQgKi9cblx0QXBwLlV0aWxzLmZyb21IdG1sRW50aXRpZXMgPSBmdW5jdGlvbihzdHJpbmcpIHtcblx0XHRyZXR1cm4gKHN0cmluZytcIlwiKS5yZXBsYWNlKC8mI1xcZCs7L2dtLGZ1bmN0aW9uKHMpIHtcblx0XHRcdHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKHMubWF0Y2goL1xcZCsvZ20pWzBdKTtcblx0XHR9KVxuXHR9O1xuXG5cdEFwcC5VdGlscy5nZXRSYW5kb21Db2xvciA9IGZ1bmN0aW9uICgpIHtcblx0XHR2YXIgbGV0dGVycyA9ICcwMTIzNDU2Nzg5QUJDREVGJy5zcGxpdCgnJyk7XG5cdFx0dmFyIGNvbG9yID0gJyMnO1xuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgNjsgaSsrICkge1xuXHRcdFx0Y29sb3IgKz0gbGV0dGVyc1tNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAxNildO1xuXHRcdH1cblx0XHRyZXR1cm4gY29sb3I7XG5cdH07XG5cblx0QXBwLlV0aWxzLmdldFByb3BlcnR5QnlWYXJpYWJsZUlkID0gZnVuY3Rpb24oIG1vZGVsLCB2YXJpYWJsZUlkICkge1xuXG5cdFx0aWYoIG1vZGVsICYmIG1vZGVsLmdldCggXCJjaGFydC1kaW1lbnNpb25zXCIgKSApIHtcblxuXHRcdFx0dmFyIGNoYXJ0RGltZW5zaW9uc1N0cmluZyA9IG1vZGVsLmdldCggXCJjaGFydC1kaW1lbnNpb25zXCIgKSxcblx0XHRcdFx0Y2hhcnREaW1lbnNpb25zID0gJC5wYXJzZUpTT04oIGNoYXJ0RGltZW5zaW9uc1N0cmluZyApLFxuXHRcdFx0XHRkaW1lbnNpb24gPSBfLndoZXJlKCBjaGFydERpbWVuc2lvbnMsIHsgXCJ2YXJpYWJsZUlkXCI6IHZhcmlhYmxlSWQgfSApO1xuXHRcdFx0aWYoIGRpbWVuc2lvbiAmJiBkaW1lbnNpb24ubGVuZ3RoICkge1xuXHRcdFx0XHRyZXR1cm4gZGltZW5zaW9uWzBdLnByb3BlcnR5O1xuXHRcdFx0fVxuXG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFxuXHR9O1xuXG5cblx0QXBwLlV0aWxzLmNvbnRlbnRHZW5lcmF0b3IgPSBmdW5jdGlvbiggZGF0YSwgaXNNYXBQb3B1cCApIHtcblx0XHRcdFxuXHRcdC8vc2V0IHBvcHVwXG5cdFx0dmFyIHVuaXRzU3RyaW5nID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcInVuaXRzXCIgKSxcblx0XHRcdGNoYXJ0VHlwZSA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10eXBlXCIgKSxcblx0XHRcdHVuaXRzID0gKCAhJC5pc0VtcHR5T2JqZWN0KCB1bml0c1N0cmluZyApICk/ICQucGFyc2VKU09OKCB1bml0c1N0cmluZyApOiB7fSxcblx0XHRcdHN0cmluZyA9IFwiXCIsXG5cdFx0XHR2YWx1ZXNTdHJpbmcgPSBcIlwiO1xuXG5cdFx0Ly9maW5kIHJlbGV2YW50IHZhbHVlcyBmb3IgcG9wdXAgYW5kIGRpc3BsYXkgdGhlbVxuXHRcdHZhciBzZXJpZXMgPSBkYXRhLnNlcmllcywga2V5ID0gXCJcIiwgdGltZVN0cmluZyA9IFwiXCI7XG5cdFx0aWYoIHNlcmllcyAmJiBzZXJpZXMubGVuZ3RoICkge1xuXHRcdFx0XG5cdFx0XHR2YXIgc2VyaWUgPSBzZXJpZXNbIDAgXTtcblx0XHRcdGtleSA9IHNlcmllLmtleTtcblx0XHRcdFxuXHRcdFx0Ly9nZXQgc291cmNlIG9mIGluZm9ybWF0aW9uXG5cdFx0XHR2YXIgcG9pbnQgPSBkYXRhLnBvaW50O1xuXHRcdFx0Ly9iZWdpbiBjb21wb3N0aW5nIHN0cmluZ1xuXHRcdFx0c3RyaW5nID0gXCI8aDM+XCIgKyBrZXkgKyBcIjwvaDM+PHA+XCI7XG5cdFx0XHR2YWx1ZXNTdHJpbmcgPSBcIlwiO1xuXG5cdFx0XHRpZiggIWlzTWFwUG9wdXAgJiYgKCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdHlwZVwiICkgPT09IFwiNFwiIHx8IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10eXBlXCIgKSA9PT0gXCI1XCIgfHwgQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LXR5cGVcIiApID09PSBcIjZcIiApICkge1xuXHRcdFx0XHQvL211bHRpYmFyY2hhcnQgaGFzIHZhbHVlcyBpbiBkaWZmZXJlbnQgZm9ybWF0XG5cdFx0XHRcdHBvaW50ID0geyBcInlcIjogc2VyaWUudmFsdWUsIFwidGltZVwiOiBkYXRhLmRhdGEudGltZSB9O1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHQkLmVhY2goIHBvaW50LCBmdW5jdGlvbiggaSwgdiApIHtcblx0XHRcdFx0Ly9mb3IgZWFjaCBkYXRhIHBvaW50LCBmaW5kIGFwcHJvcHJpYXRlIHVuaXQsIGFuZCBpZiB3ZSBoYXZlIGl0LCBkaXNwbGF5IGl0XG5cdFx0XHRcdHZhciB1bml0ID0gXy5maW5kV2hlcmUoIHVuaXRzLCB7IHByb3BlcnR5OiBpIH0gKSxcblx0XHRcdFx0XHR2YWx1ZSA9IHYsXG5cdFx0XHRcdFx0aXNIaWRkZW4gPSAoIHVuaXQgJiYgdW5pdC5oYXNPd25Qcm9wZXJ0eSggXCJ2aXNpYmxlXCIgKSAmJiAhdW5pdC52aXNpYmxlICk/IHRydWU6IGZhbHNlO1xuXG5cdFx0XHRcdC8vZm9ybWF0IG51bWJlclxuXHRcdFx0XHRpZiggdW5pdCAmJiAhaXNOYU4oIHVuaXQuZm9ybWF0ICkgJiYgdW5pdC5mb3JtYXQgPj0gMCApIHtcblx0XHRcdFx0XHQvL2ZpeGVkIGZvcm1hdFxuXHRcdFx0XHRcdHZhciBmaXhlZCA9IE1hdGgubWluKCAyMCwgcGFyc2VJbnQoIHVuaXQuZm9ybWF0LCAxMCApICk7XG5cdFx0XHRcdFx0dmFsdWUgPSBkMy5mb3JtYXQoIFwiLC5cIiArIGZpeGVkICsgXCJmXCIgKSggdmFsdWUgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvL2FkZCB0aG91c2FuZHMgc2VwYXJhdG9yXG5cdFx0XHRcdFx0dmFsdWUgPSBkMy5mb3JtYXQoIFwiLFwiICkoIHZhbHVlICk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiggdW5pdCApIHtcblx0XHRcdFx0XHRpZiggIWlzSGlkZGVuICkge1xuXHRcdFx0XHRcdFx0Ly90cnkgdG8gZm9ybWF0IG51bWJlclxuXHRcdFx0XHRcdFx0Ly9zY2F0dGVyIHBsb3QgaGFzIHZhbHVlcyBkaXNwbGF5ZWQgaW4gc2VwYXJhdGUgcm93c1xuXHRcdFx0XHRcdFx0aWYoIHZhbHVlc1N0cmluZyAhPT0gXCJcIiAmJiBjaGFydFR5cGUgIT0gMiApIHtcblx0XHRcdFx0XHRcdFx0dmFsdWVzU3RyaW5nICs9IFwiLCBcIjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmKCBjaGFydFR5cGUgPT0gMiApIHtcblx0XHRcdFx0XHRcdFx0dmFsdWVzU3RyaW5nICs9IFwiPHNwYW4gY2xhc3M9J3Zhci1wb3B1cC12YWx1ZSc+XCI7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR2YWx1ZXNTdHJpbmcgKz0gdmFsdWUgKyBcIiBcIiArIHVuaXQudW5pdDtcblx0XHRcdFx0XHRcdGlmKCBjaGFydFR5cGUgPT0gMiApIHtcblx0XHRcdFx0XHRcdFx0dmFsdWVzU3RyaW5nICs9IFwiPC9zcGFuPlwiO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIGlmKCBpID09PSBcInRpbWVcIiApIHtcblx0XHRcdFx0XHR0aW1lU3RyaW5nID0gdjtcblx0XHRcdFx0fSBlbHNlIGlmKCBpICE9PSBcImNvbG9yXCIgJiYgaSAhPT0gXCJzZXJpZXNcIiAmJiAoIGkgIT09IFwieFwiIHx8IGNoYXJ0VHlwZSAhPSAxICkgKSB7XG5cdFx0XHRcdFx0aWYoICFpc0hpZGRlbiApIHtcblx0XHRcdFx0XHRcdGlmKCB2YWx1ZXNTdHJpbmcgIT09IFwiXCIgJiYgY2hhcnRUeXBlICE9IDIgKSB7XG5cdFx0XHRcdFx0XHRcdHZhbHVlc1N0cmluZyArPSBcIiwgXCI7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiggY2hhcnRUeXBlID09IDIgKSB7XG5cdFx0XHRcdFx0XHRcdHZhbHVlc1N0cmluZyArPSBcIjxzcGFuIGNsYXNzPSd2YXItcG9wdXAtdmFsdWUnPlwiO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Ly9qdXN0IGFkZCBwbGFpbiB2YWx1ZSwgb21pdGluZyB4IHZhbHVlIGZvciBsaW5lY2hhcnRcblx0XHRcdFx0XHRcdHZhbHVlc1N0cmluZyArPSB2YWx1ZTtcblx0XHRcdFx0XHRcdGlmKCBjaGFydFR5cGUgPT0gMiApIHtcblx0XHRcdFx0XHRcdFx0dmFsdWVzU3RyaW5nICs9IFwiPC9zcGFuPlwiO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXG5cdFx0XHRpZiggaXNNYXBQb3B1cCB8fCAoIHRpbWVTdHJpbmcgJiYgY2hhcnRUeXBlICE9IDIgKSApIHtcblx0XHRcdFx0dmFsdWVzU3RyaW5nICs9IFwiIDxiciAvPiBpbiA8YnIgLz4gXCIgKyB0aW1lU3RyaW5nO1xuXHRcdFx0fSBlbHNlIGlmKCB0aW1lU3RyaW5nICYmIGNoYXJ0VHlwZSA9PSAyICkge1xuXHRcdFx0XHR2YWx1ZXNTdHJpbmcgKz0gXCI8c3BhbiBjbGFzcz0ndmFyLXBvcHVwLXZhbHVlJz5pbiBcIiArIHRpbWVTdHJpbmcgKyBcIjwvc3Bhbj5cIjtcblx0XHRcdH1cblx0XHRcdHN0cmluZyArPSB2YWx1ZXNTdHJpbmc7XG5cdFx0XHRzdHJpbmcgKz0gXCI8L3A+XCI7XG5cblx0XHR9XG5cblx0XHRyZXR1cm4gc3RyaW5nO1xuXG5cdH07XG5cblxuXHRBcHAuVXRpbHMuZm9ybWF0VGltZUxhYmVsID0gZnVuY3Rpb24oIHR5cGUsIGQsIHhBeGlzUHJlZml4LCB4QXhpc1N1ZmZpeCwgZm9ybWF0ICkge1xuXHRcdC8vZGVwZW5kaW5nIG9uIHR5cGUgZm9ybWF0IGxhYmVsXG5cdFx0dmFyIGxhYmVsO1xuXHRcdHN3aXRjaCggdHlwZSApIHtcblx0XHRcdFxuXHRcdFx0Y2FzZSBcIkRlY2FkZVwiOlxuXHRcdFx0XHRcblx0XHRcdFx0dmFyIGRlY2FkZVN0cmluZyA9IGQudG9TdHJpbmcoKTtcblx0XHRcdFx0ZGVjYWRlU3RyaW5nID0gZGVjYWRlU3RyaW5nLnN1YnN0cmluZyggMCwgZGVjYWRlU3RyaW5nLmxlbmd0aCAtIDEpO1xuXHRcdFx0XHRkZWNhZGVTdHJpbmcgPSBkZWNhZGVTdHJpbmcgKyBcIjBzXCI7XG5cdFx0XHRcdGxhYmVsID0gZGVjYWRlU3RyaW5nO1xuXG5cdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRjYXNlIFwiUXVhcnRlciBDZW50dXJ5XCI6XG5cdFx0XHRcdFxuXHRcdFx0XHR2YXIgcXVhcnRlclN0cmluZyA9IFwiXCIsXG5cdFx0XHRcdFx0cXVhcnRlciA9IGQgJSAxMDA7XG5cdFx0XHRcdFxuXHRcdFx0XHRpZiggcXVhcnRlciA8IDI1ICkge1xuXHRcdFx0XHRcdHF1YXJ0ZXJTdHJpbmcgPSBcIjFzdCBxdWFydGVyIG9mIHRoZVwiO1xuXHRcdFx0XHR9IGVsc2UgaWYoIHF1YXJ0ZXIgPCA1MCApIHtcblx0XHRcdFx0XHRxdWFydGVyU3RyaW5nID0gXCJoYWxmIG9mIHRoZVwiO1xuXHRcdFx0XHR9IGVsc2UgaWYoIHF1YXJ0ZXIgPCA3NSApIHtcblx0XHRcdFx0XHRxdWFydGVyU3RyaW5nID0gXCIzcmQgcXVhcnRlciBvZiB0aGVcIjtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRxdWFydGVyU3RyaW5nID0gXCI0dGggcXVhcnRlciBvZiB0aGVcIjtcblx0XHRcdFx0fVxuXHRcdFx0XHRcdFxuXHRcdFx0XHR2YXIgY2VudHVyeVN0cmluZyA9IEFwcC5VdGlscy5jZW50dXJ5U3RyaW5nKCBkICk7XG5cblx0XHRcdFx0bGFiZWwgPSBxdWFydGVyU3RyaW5nICsgXCIgXCIgKyBjZW50dXJ5U3RyaW5nO1xuXG5cdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRjYXNlIFwiSGFsZiBDZW50dXJ5XCI6XG5cdFx0XHRcdFxuXHRcdFx0XHR2YXIgaGFsZlN0cmluZyA9IFwiXCIsXG5cdFx0XHRcdFx0aGFsZiA9IGQgJSAxMDA7XG5cdFx0XHRcdFxuXHRcdFx0XHRpZiggaGFsZiA8IDUwICkge1xuXHRcdFx0XHRcdGhhbGZTdHJpbmcgPSBcIjFzdCBoYWxmIG9mIHRoZVwiO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGhhbGZTdHJpbmcgPSBcIjJuZCBoYWxmIG9mIHRoZVwiO1xuXHRcdFx0XHR9XG5cdFx0XHRcdFx0XG5cdFx0XHRcdHZhciBjZW50dXJ5U3RyaW5nID0gQXBwLlV0aWxzLmNlbnR1cnlTdHJpbmcoIGQgKTtcblxuXHRcdFx0XHRsYWJlbCA9IGhhbGZTdHJpbmcgKyBcIiBcIiArIGNlbnR1cnlTdHJpbmc7XG5cblx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdGNhc2UgXCJDZW50dXJ5XCI6XG5cdFx0XHRcdFxuXHRcdFx0XHRsYWJlbCA9IEFwcC5VdGlscy5jZW50dXJ5U3RyaW5nKCBkICk7XG5cblx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdGRlZmF1bHQ6XG5cblx0XHRcdFx0bGFiZWwgPSBBcHAuVXRpbHMuZm9ybWF0VmFsdWUoIGQsIGZvcm1hdCApO1xuXHRcdFx0XHRcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXHRcdHJldHVybiB4QXhpc1ByZWZpeCArIGxhYmVsICsgeEF4aXNTdWZmaXg7XG5cdH07XG5cblx0QXBwLlV0aWxzLmlubGluZUNzc1N0eWxlID0gZnVuY3Rpb24oIHJ1bGVzICkge1xuXHRcdC8vaHR0cDovL2RldmludG9yci5lcy9ibG9nLzIwMTAvMDUvMjYvdHVybi1jc3MtcnVsZXMtaW50by1pbmxpbmUtc3R5bGUtYXR0cmlidXRlcy11c2luZy1qcXVlcnkvXG5cdFx0Zm9yICh2YXIgaWR4ID0gMCwgbGVuID0gcnVsZXMubGVuZ3RoOyBpZHggPCBsZW47IGlkeCsrKSB7XG5cdFx0XHQkKHJ1bGVzW2lkeF0uc2VsZWN0b3JUZXh0KS5lYWNoKGZ1bmN0aW9uIChpLCBlbGVtKSB7XG5cdFx0XHRcdGVsZW0uc3R5bGUuY3NzVGV4dCArPSBydWxlc1tpZHhdLnN0eWxlLmNzc1RleHQ7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH07XG5cblx0QXBwLlV0aWxzLmNoZWNrVmFsaWREaW1lbnNpb25zID0gZnVuY3Rpb24oIGRpbWVuc2lvbnMsIGNoYXJ0VHlwZSApIHtcblx0XHRcdFxuXHRcdHZhciB2YWxpZERpbWVuc2lvbnMgPSBmYWxzZSxcblx0XHRcdHhEaW1lbnNpb24sIHlEaW1lbnNpb247XG5cdFx0XG5cdFx0c3dpdGNoKCBjaGFydFR5cGUgKSB7XG5cdFx0XHRjYXNlIFwiMVwiOlxuXHRcdFx0Y2FzZSBcIjRcIjpcblx0XHRcdGNhc2UgXCI1XCI6XG5cdFx0XHRjYXNlIFwiNlwiOlxuXHRcdFx0XHQvL2NoZWNrIHRoYXQgZGltZW5zaW9ucyBoYXZlIHkgcHJvcGVydHlcblx0XHRcdFx0eURpbWVuc2lvbiA9IF8uZmluZCggZGltZW5zaW9ucywgZnVuY3Rpb24oIGRpbWVuc2lvbiApIHtcblx0XHRcdFx0XHRyZXR1cm4gZGltZW5zaW9uLnByb3BlcnR5ID09PSBcInlcIjtcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRpZiggeURpbWVuc2lvbiApIHtcblx0XHRcdFx0XHR2YWxpZERpbWVuc2lvbnMgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBcIjJcIjpcblx0XHRcdFx0Ly9jaGVjayB0aGF0IGRpbWVuc2lvbnMgaGF2ZSB4IHByb3BlcnR5XG5cdFx0XHRcdHhEaW1lbnNpb24gPSBfLmZpbmQoIGRpbWVuc2lvbnMsIGZ1bmN0aW9uKCBkaW1lbnNpb24gKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGRpbWVuc2lvbi5wcm9wZXJ0eSA9PT0gXCJ4XCI7XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0eURpbWVuc2lvbiA9IF8uZmluZCggZGltZW5zaW9ucywgZnVuY3Rpb24oIGRpbWVuc2lvbiApIHtcblx0XHRcdFx0XHRyZXR1cm4gZGltZW5zaW9uLnByb3BlcnR5ID09PSBcInlcIjtcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRpZiggeERpbWVuc2lvbiAmJiB5RGltZW5zaW9uICkge1xuXHRcdFx0XHRcdHZhbGlkRGltZW5zaW9ucyA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFwiM1wiOlxuXHRcdFx0XHQvL2NoZWNrIHRoYXQgZGltZW5zaW9ucyBoYXZlIHkgcHJvcGVydHlcblx0XHRcdFx0eURpbWVuc2lvbiA9IF8uZmluZCggZGltZW5zaW9ucywgZnVuY3Rpb24oIGRpbWVuc2lvbiApIHtcblx0XHRcdFx0XHRyZXR1cm4gZGltZW5zaW9uLnByb3BlcnR5ID09PSBcInlcIjtcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRpZiggeURpbWVuc2lvbiApIHtcblx0XHRcdFx0XHR2YWxpZERpbWVuc2lvbnMgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblx0XHRyZXR1cm4gdmFsaWREaW1lbnNpb25zO1xuXG5cdH07XG5cblx0QXBwLlV0aWxzLmZvcm1hdFZhbHVlID0gZnVuY3Rpb24oIHZhbHVlLCBmb3JtYXQgKSB7XG5cdFx0Ly9tYWtlIHN1cmUgd2UgZG8gdGhpcyBvbiBudW1iZXJcblx0XHRpZiggdmFsdWUgJiYgIWlzTmFOKCB2YWx1ZSApICkge1xuXHRcdFx0aWYoIGZvcm1hdCAmJiAhaXNOYU4oIGZvcm1hdCApICkge1xuXHRcdFx0XHR2YXIgZml4ZWQgPSBNYXRoLm1pbiggMjAsIHBhcnNlSW50KCBmb3JtYXQsIDEwICkgKTtcblx0XHRcdFx0dmFsdWUgPSB2YWx1ZS50b0ZpeGVkKCBmaXhlZCApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly9ubyBmb3JtYXQgXG5cdFx0XHRcdHZhbHVlID0gdmFsdWUudG9TdHJpbmcoKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHZhbHVlO1xuXHR9O1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlV0aWxzO1xuXHRcbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgQXBwID0gcmVxdWlyZSggXCIuL25hbWVzcGFjZXMuanNcIiApLFxuXHRcdEZvcm0gPSByZXF1aXJlKCBcIi4vdmlld3MvQXBwLlZpZXdzLkZvcm0uanNcIiApLFxuXHRcdENoYXJ0TW9kZWwgPSByZXF1aXJlKCBcIi4vbW9kZWxzL0FwcC5Nb2RlbHMuQ2hhcnRNb2RlbC5qc1wiICksXG5cdFx0Q2hhcnREYXRhTW9kZWwgPSByZXF1aXJlKCBcIi4vbW9kZWxzL0FwcC5Nb2RlbHMuQ2hhcnREYXRhTW9kZWwuanNcIiApO1xuXG5cdC8vc2V0dXAgbW9kZWxzXG5cdC8vaXMgbmV3IGNoYXJ0IG9yIGRpc3BsYXkgb2xkIGNoYXJ0XG5cdHZhciAkY2hhcnRTaG93V3JhcHBlciA9ICQoIFwiLmNoYXJ0LXNob3ctd3JhcHBlciwgLmNoYXJ0LWVkaXQtd3JhcHBlclwiICksXG5cdFx0Y2hhcnRJZCA9ICRjaGFydFNob3dXcmFwcGVyLmF0dHIoIFwiZGF0YS1jaGFydC1pZFwiICk7XG5cblx0Ly9zZXR1cCB2aWV3c1xuXHRBcHAuVmlldyA9IG5ldyBGb3JtKCk7XG5cblx0aWYoICRjaGFydFNob3dXcmFwcGVyLmxlbmd0aCAmJiBjaGFydElkICkge1xuXHRcdFxuXHRcdC8vc2hvd2luZyBleGlzdGluZyBjaGFydFxuXHRcdEFwcC5DaGFydE1vZGVsID0gbmV3IENoYXJ0TW9kZWwoIHsgaWQ6IGNoYXJ0SWQgfSApO1xuXHRcdEFwcC5DaGFydE1vZGVsLmZldGNoKCB7XG5cdFx0XHRzdWNjZXNzOiBmdW5jdGlvbiggZGF0YSApIHtcblx0XHRcdFx0QXBwLlZpZXcuc3RhcnQoKTtcblx0XHRcdH0sXG5cdFx0XHRlcnJvcjogZnVuY3Rpb24oIHhociApIHtcblx0XHRcdFx0Y29uc29sZS5lcnJvciggXCJFcnJvciBsb2FkaW5nIGNoYXJ0IG1vZGVsXCIsIHhociApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0XHQvL2ZpbmQgb3V0IGlmIGl0J3MgaW4gY2FjaGVcblx0XHRpZiggISQoIFwiLnN0YW5kYWxvbmUtY2hhcnQtdmlld2VyXCIgKS5sZW5ndGggKSB7XG5cdFx0XHQvL2Rpc2FibGUgY2FjaGluZyBmb3Igdmlld2luZyB3aXRoaW4gYWRtaW5cblx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJjYWNoZVwiLCBmYWxzZSApO1xuXHRcdH1cblx0XHRcblx0fSBlbHNlIHtcblxuXHRcdC8vaXMgbmV3IGNoYXJ0XG5cdFx0QXBwLkNoYXJ0TW9kZWwgPSBuZXcgQ2hhcnRNb2RlbCgpO1xuXHRcdEFwcC5WaWV3LnN0YXJ0KCk7XG5cblx0fVxuXG5cdFxuXHRcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIEFwcCA9IHJlcXVpcmUoIFwiLi8uLi9uYW1lc3BhY2VzLmpzXCIgKSxcblx0XHRFbnRpdHlNb2RlbCA9IHJlcXVpcmUoIFwiLi8uLi9tb2RlbHMvQXBwLk1vZGVscy5FbnRpdHlNb2RlbC5qc1wiICk7XG5cblx0QXBwLkNvbGxlY3Rpb25zLkF2YWlsYWJsZUVudGl0aWVzQ29sbGVjdGlvbiA9IEJhY2tib25lLkNvbGxlY3Rpb24uZXh0ZW5kKCB7XG5cblx0XHRtb2RlbDogRW50aXR5TW9kZWwsXG5cdFx0dXJsUm9vdDogR2xvYmFsLnJvb3RVcmwgKyAnL2RhdGEvZW50aXRpZXMnLFxuXHRcdFxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uICgpIHtcblxuXHRcdFx0QXBwLkNoYXJ0VmFyaWFibGVzQ29sbGVjdGlvbi5vbiggXCJhZGRcIiwgdGhpcy5vblZhcmlhYmxlQWRkLCB0aGlzICk7XG5cdFx0XHRBcHAuQ2hhcnRWYXJpYWJsZXNDb2xsZWN0aW9uLm9uKCBcInJlbW92ZVwiLCB0aGlzLm9uVmFyaWFibGVSZW1vdmUsIHRoaXMgKTtcblx0XHRcdFxuXHRcdH0sXG5cblx0XHRwYXJzZTogZnVuY3Rpb24oIHJlc3BvbnNlICl7XG5cdFx0XHRyZXR1cm4gcmVzcG9uc2UuZGF0YTtcblx0XHR9LFxuXG5cdFx0b25WYXJpYWJsZUFkZDogZnVuY3Rpb24oIG1vZGVsICkge1xuXHRcdFx0dGhpcy51cGRhdGVFbnRpdGllcygpO1xuXHRcdH0sXG5cblx0XHRvblZhcmlhYmxlUmVtb3ZlOiBmdW5jdGlvbiggbW9kZWwgKSB7XG5cdFx0XHR0aGlzLnVwZGF0ZUVudGl0aWVzKCk7XG5cdFx0fSxcblxuXHRcdHVwZGF0ZUVudGl0aWVzOiBmdW5jdGlvbigpIHtcblxuXHRcdFx0dmFyIGlkcyA9IHRoaXMuZ2V0VmFyaWFibGVJZHMoKTtcblx0XHRcdHRoaXMudXJsID0gdGhpcy51cmxSb290ICsgXCI/dmFyaWFibGVJZHM9XCIgKyBpZHMuam9pbihcIixcIik7XG5cblx0XHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRcdHRoaXMuZmV0Y2goIHtcblx0XHRcdFx0c3VjY2VzczogZnVuY3Rpb24oIGNvbGxlY3Rpb24sIHJlc3BvbnNlICkge1xuXHRcdFx0XHRcdHRoYXQudHJpZ2dlciggXCJmZXRjaGVkXCIgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHR9LFxuXG5cdFx0Z2V0VmFyaWFibGVJZHM6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHR2YXIgdmFyaWFibGVzID0gQXBwLkNoYXJ0VmFyaWFibGVzQ29sbGVjdGlvbi5tb2RlbHMsXG5cdFx0XHRcdGlkcyA9IF8ubWFwKCB2YXJpYWJsZXMsIGZ1bmN0aW9uKCB2LCBrICkge1xuXHRcdFx0XHRcdHJldHVybiB2LmdldCggXCJpZFwiICk7XG5cdFx0XHRcdH0gKTtcblx0XHRcdHJldHVybiBpZHM7XG5cblx0XHR9XG5cblxuXHR9ICk7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuQ29sbGVjdGlvbnMuQXZhaWxhYmxlRW50aXRpZXNDb2xsZWN0aW9uO1xuXHRcbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBBcHAgPSByZXF1aXJlKCBcIi4vLi4vbmFtZXNwYWNlcy5qc1wiICksXG5cdFx0Q2hhcnRWYXJpYWJsZU1vZGVsID0gcmVxdWlyZSggXCIuLy4uL21vZGVscy9BcHAuTW9kZWxzLkNoYXJ0VmFyaWFibGVNb2RlbC5qc1wiICk7XG5cdFxuXHRBcHAuQ29sbGVjdGlvbnMuQ2hhcnRWYXJpYWJsZXNDb2xsZWN0aW9uID0gQmFja2JvbmUuQ29sbGVjdGlvbi5leHRlbmQoIHtcblxuXHRcdG1vZGVsOiBDaGFydFZhcmlhYmxlTW9kZWwsXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiggbW9kZWxzLCBvcHRpb25zICkge1xuXHRcdFx0aWYoIG1vZGVscyAmJiBtb2RlbHMubGVuZ3RoICkge1xuXHRcdFx0XHQvL2hhdmUgbW9kZWxzIGFscmVhZHlcblx0XHRcdFx0dGhpcy5zY2F0dGVyQ29sb3JDaGVjayggbW9kZWxzICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLm9uKCBcInN5bmNcIiwgdGhpcy5vblN5bmMsIHRoaXMgKTtcblx0XHRcdH1cblx0XHR9LFxuXG5cdFx0b25TeW5jOiBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuc2NhdHRlckNvbG9yQ2hlY2soKTtcblx0XHR9LFxuXG5cdFx0c2NhdHRlckNvbG9yQ2hlY2s6IGZ1bmN0aW9uKCBtb2RlbHMgKSB7XG5cdFx0XHRcblx0XHRcdGlmKCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdHlwZVwiICkgPT0gMiApIHtcblx0XHRcdFx0Ly9tYWtlIHN1cmUgZm9yIHNjYXR0ZXIgcGxvdCwgd2UgaGF2ZSBjb2xvciBzZXQgYXMgY29udGluZW50c1xuXHRcdFx0XHR2YXIgY2hhcnREaW1lbnNpb25zID0gJC5wYXJzZUpTT04oIEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC1kaW1lbnNpb25zXCIgKSApO1xuXHRcdFx0XHQvL2lmKCAhXy5maW5kV2hlcmUoIGNoYXJ0RGltZW5zaW9ucywgeyBcInByb3BlcnR5XCI6IFwiY29sb3JcIiB9ICkgKSB7XG5cdFx0XHRcdFx0Ly90aGlzIGlzIHdoZXJlIHdlIGFkZCBjb2xvciBwcm9wZXJ0eVxuXHRcdFx0XHRcdHZhciBjb2xvclByb3BPYmogPSB7IFwiaWRcIjpcIjEyM1wiLFwidW5pdFwiOlwiXCIsXCJuYW1lXCI6XCJDb2xvclwiLFwicGVyaW9kXCI6XCJzaW5nbGVcIixcIm1vZGVcIjpcInNwZWNpZmljXCIsXCJ0YXJnZXRZZWFyXCI6XCIyMDAwXCIsXCJ0b2xlcmFuY2VcIjpcIjVcIixcIm1heGltdW1BZ2VcIjpcIjVcIn07XG5cdFx0XHRcdFx0aWYoIG1vZGVscyApIHtcblx0XHRcdFx0XHRcdG1vZGVscy5wdXNoKCBjb2xvclByb3BPYmogKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dGhpcy5hZGQoIG5ld0NoYXJ0VmFyaWFibGVNb2RlbCggY29sb3JQcm9wT2JqICkgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdC8vfVxuXHRcdFx0fVxuXHRcdH1cblxuXHR9ICk7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuQ29sbGVjdGlvbnMuQ2hhcnRWYXJpYWJsZXNDb2xsZWN0aW9uO1xuXHRcbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBBcHAgPSByZXF1aXJlKCBcIi4vLi4vbmFtZXNwYWNlcy5qc1wiICk7XG5cblx0QXBwLkNvbGxlY3Rpb25zLlNlYXJjaERhdGFDb2xsZWN0aW9uID0gQmFja2JvbmUuQ29sbGVjdGlvbi5leHRlbmQoIHtcblxuXHRcdC8vbW9kZWw6IEFwcC5Nb2RlbHMuRW50aXR5TW9kZWwsXG5cdFx0dXJsUm9vdDogR2xvYmFsLnJvb3RVcmwgKyAnL2RhdGEvc2VhcmNoJyxcblx0XHRcblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiAoKSB7XG5cblx0XHRcdC8vQXBwLkNoYXJ0VmFyaWFibGVzQ29sbGVjdGlvbi5vbiggXCJhZGRcIiwgdGhpcy5vblZhcmlhYmxlQWRkLCB0aGlzICk7XG5cdFx0XHQvL0FwcC5DaGFydFZhcmlhYmxlc0NvbGxlY3Rpb24ub24oIFwicmVtb3ZlXCIsIHRoaXMub25WYXJpYWJsZVJlbW92ZSwgdGhpcyApO1xuXHRcdFx0XHRcblx0XHR9LFxuXG5cdFx0cGFyc2U6IGZ1bmN0aW9uKCByZXNwb25zZSApe1xuXHRcdFx0cmV0dXJuIHJlc3BvbnNlLmRhdGE7XG5cdFx0fSxcblxuXHRcdC8qb25WYXJpYWJsZUFkZDogZnVuY3Rpb24oIG1vZGVsICkge1xuXHRcdFx0dGhpcy51cGRhdGVFbnRpdGllcygpO1xuXHRcdH0sXG5cblx0XHRvblZhcmlhYmxlUmVtb3ZlOiBmdW5jdGlvbiggbW9kZWwgKSB7XG5cdFx0XHR0aGlzLnVwZGF0ZUVudGl0aWVzKCk7XG5cdFx0fSwqL1xuXG5cdFx0c2VhcmNoOiBmdW5jdGlvbiggcyApIHtcblxuXHRcdFx0dGhpcy51cmwgPSB0aGlzLnVybFJvb3QgKyBcIj9zPVwiICsgcztcblxuXHRcdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdFx0dGhpcy5mZXRjaCgge1xuXHRcdFx0XHRzdWNjZXNzOiBmdW5jdGlvbiggY29sbGVjdGlvbiwgcmVzcG9uc2UgKSB7XG5cdFx0XHRcdFx0dGhhdC50cmlnZ2VyKCBcImZldGNoZWRcIiApO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdH1cblxuXHR9ICk7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuQ29sbGVjdGlvbnMuU2VhcmNoRGF0YUNvbGxlY3Rpb247XG5cbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBBcHAgPSByZXF1aXJlKCBcIi4vLi4vbmFtZXNwYWNlcy5qc1wiICk7XG5cblx0QXBwLk1vZGVscy5BdmFpbGFibGVUaW1lTW9kZWwgPSBCYWNrYm9uZS5Nb2RlbC5leHRlbmQoIHtcblxuXHRcdHVybFJvb3Q6IEdsb2JhbC5yb290VXJsICsgJy9kYXRhL3RpbWVzJyxcblx0XHRcblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiAoKSB7XG5cblx0XHRcdEFwcC5DaGFydFZhcmlhYmxlc0NvbGxlY3Rpb24ub24oIFwiYWRkXCIsIHRoaXMub25WYXJpYWJsZUFkZCwgdGhpcyApO1xuXHRcdFx0QXBwLkNoYXJ0VmFyaWFibGVzQ29sbGVjdGlvbi5vbiggXCJyZW1vdmVcIiwgdGhpcy5vblZhcmlhYmxlUmVtb3ZlLCB0aGlzICk7XG5cdFx0XHRcblx0XHR9LFxuXG5cdFx0cGFyc2U6IGZ1bmN0aW9uKCByZXNwb25zZSApIHtcblxuXHRcdFx0dmFyIG1heCA9IGQzLm1heCggcmVzcG9uc2UuZGF0YSwgZnVuY3Rpb24oZCkgeyByZXR1cm4gcGFyc2VGbG9hdCggZC5sYWJlbCApOyB9ICksXG5cdFx0XHRcdFx0XHRtaW4gPSBkMy5taW4oIHJlc3BvbnNlLmRhdGEsIGZ1bmN0aW9uKGQpIHsgcmV0dXJuIHBhcnNlRmxvYXQoIGQubGFiZWwgKTsgfSApO1xuXHRcdFx0dGhpcy5zZXQoIHsgXCJtYXhcIjogbWF4LCBcIm1pblwiOiBtaW4gfSApO1xuXHRcdFxuXHRcdH0sXG5cblx0XHRvblZhcmlhYmxlQWRkOiBmdW5jdGlvbiggbW9kZWwgKSB7XG5cdFx0XHR0aGlzLnVwZGF0ZVRpbWUoKTtcblx0XHR9LFxuXG5cdFx0b25WYXJpYWJsZVJlbW92ZTogZnVuY3Rpb24oIG1vZGVsICkge1xuXHRcdFx0dGhpcy51cGRhdGVUaW1lKCk7XG5cdFx0fSxcblxuXHRcdHVwZGF0ZVRpbWU6IGZ1bmN0aW9uKCBpZHMgKSB7XG5cblx0XHRcdHZhciBpZHMgPSB0aGlzLmdldFZhcmlhYmxlSWRzKCk7XG5cdFx0XHR0aGlzLnVybCA9IHRoaXMudXJsUm9vdCArIFwiP3ZhcmlhYmxlSWRzPVwiICsgaWRzLmpvaW4oXCIsXCIpO1xuXHRcdFx0dGhpcy5mZXRjaCgpO1xuXG5cdFx0fSxcblxuXHRcdGdldFZhcmlhYmxlSWRzOiBmdW5jdGlvbigpIHtcblxuXHRcdFx0dmFyIHZhcmlhYmxlcyA9IEFwcC5DaGFydFZhcmlhYmxlc0NvbGxlY3Rpb24ubW9kZWxzLFxuXHRcdFx0XHRpZHMgPSBfLm1hcCggdmFyaWFibGVzLCBmdW5jdGlvbiggdiwgayApIHtcblx0XHRcdFx0XHRyZXR1cm4gdi5nZXQoIFwiaWRcIiApO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHRyZXR1cm4gaWRzO1xuXG5cdFx0fVxuXG5cblx0fSApO1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLk1vZGVscy5BdmFpbGFibGVUaW1lTW9kZWw7XG5cbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBBcHAgPSByZXF1aXJlKCBcIi4vLi4vbmFtZXNwYWNlcy5qc1wiICk7XG5cdFxuXHRBcHAuTW9kZWxzLkNoYXJ0RGF0YU1vZGVsID0gQmFja2JvbmUuTW9kZWwuZXh0ZW5kKCB7XG5cblx0XHRkZWZhdWx0czoge30sXG5cblx0XHR1cmxSb290OiBHbG9iYWwucm9vdFVybCArIFwiL2RhdGEvZGltZW5zaW9uc1wiLFxuXHRcdFxuXHRcdC8qdXJsOiBmdW5jdGlvbigpe1xuXG5cdFx0XHR2YXIgYXR0cnMgPSB0aGlzLmF0dHJpYnV0ZXMsXG5cdFx0XHRcdHVybCA9IHRoaXMudXJsUm9vdCArIFwiP1wiO1xuXG5cdFx0XHQvL2FkZCBhbGwgYXR0cmlidXRlcyB0byB1cmxcblx0XHRcdF8uZWFjaCggYXR0cnMsIGZ1bmN0aW9uKCB2LCBpICkge1xuXHRcdFx0XHR1cmwgKz0gaSArIFwiPVwiICsgdjtcblx0XHRcdFx0dXJsICs9IFwiJlwiO1xuXHRcdFx0fSApO1xuXG5cdFx0XHRyZXR1cm4gdXJsO1xuXG5cdFx0fSwqL1xuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24gKCkge1xuXG5cdFx0fSxcblxuXHR9ICk7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuTW9kZWxzLkNoYXJ0RGF0YU1vZGVsO1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgQXBwID0gcmVxdWlyZSggXCIuLy4uL25hbWVzcGFjZXMuanNcIiApO1xuXHRcblx0QXBwLk1vZGVscy5DaGFydERpbWVuc2lvbnNNb2RlbCA9IEJhY2tib25lLk1vZGVsLmV4dGVuZCgge1xuXG5cdFx0dXJsUm9vdDogR2xvYmFsLnJvb3RVcmwgKyAnL2NoYXJ0VHlwZXMvJyxcblxuXHRcdGRlZmF1bHRzOiB7fSxcblxuXHRcdGxvYWRDb25maWd1cmF0aW9uOiBmdW5jdGlvbiggY2hhcnRUeXBlSWQgKSB7XG5cblx0XHRcdHRoaXMuc2V0KCBcImlkXCIsIGNoYXJ0VHlwZUlkICk7XG5cdFx0XHR0aGlzLmZldGNoKCB7XG5cdFx0XHRcdHN1Y2Nlc3M6IGZ1bmN0aW9uKCByZXNwb25zZSApIHtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXG5cdFx0fVxuXG5cdH0gKTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5Nb2RlbHMuQ2hhcnREaW1lbnNpb25zTW9kZWw7XG5cbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBBcHAgPSByZXF1aXJlKCBcIi4vLi4vbmFtZXNwYWNlcy5qc1wiICk7XG5cdFxuXHRBcHAuTW9kZWxzLkNoYXJ0TW9kZWwgPSBCYWNrYm9uZS5Nb2RlbC5leHRlbmQoIHtcblxuXHRcdC8vdXJsUm9vdDogR2xvYmFsLnJvb3RVcmwgKyAnL2NoYXJ0cy8nLFxuXHRcdC8vdXJsUm9vdDogR2xvYmFsLnJvb3RVcmwgKyAnL2RhdGEvY29uZmlnLycsXG5cdFx0dXJsOiBmdW5jdGlvbigpIHtcblx0XHRcdGlmKCAkKFwiI2Zvcm0tdmlld1wiKS5sZW5ndGggKSB7XG5cdFx0XHRcdGlmKCB0aGlzLmlkICkge1xuXHRcdFx0XHRcdC8vZWRpdGluZyBleGlzdGluZ1xuXHRcdFx0XHRcdHJldHVybiBHbG9iYWwucm9vdFVybCArIFwiL2NoYXJ0cy9cIiArIHRoaXMuaWQ7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly9zYXZpbmcgbmV3XG5cdFx0XHRcdFx0cmV0dXJuIEdsb2JhbC5yb290VXJsICsgXCIvY2hhcnRzXCI7XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gR2xvYmFsLnJvb3RVcmwgKyBcIi9kYXRhL2NvbmZpZy9cIiArIHRoaXMuaWQ7XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdGRlZmF1bHRzOiB7XG5cdFx0XHRcImNhY2hlXCI6IHRydWUsXG5cdFx0XHRcInNlbGVjdGVkLWNvdW50cmllc1wiOiBbXSxcblx0XHRcdFwidGFic1wiOiBbIFwiY2hhcnRcIiwgXCJkYXRhXCIsIFwic291cmNlc1wiIF0sXG5cdFx0XHRcImxpbmUtdHlwZVwiOiBcIjJcIixcblx0XHRcdFwiY2hhcnQtZGVzY3JpcHRpb25cIjogXCJcIixcblx0XHRcdFwiY2hhcnQtZGltZW5zaW9uc1wiOiBbXSxcblx0XHRcdFwidmFyaWFibGVzXCI6IFtdLFxuXHRcdFx0XCJ5LWF4aXNcIjoge30sXG5cdFx0XHRcIngtYXhpc1wiOiB7fSxcblx0XHRcdFwibWFyZ2luc1wiOiB7IHRvcDogMTAsIGxlZnQ6IDYwLCBib3R0b206IDEwLCByaWdodDogMTAgfSxcblx0XHRcdFwidW5pdHNcIjogXCJcIixcblx0XHRcdFwiaWZyYW1lLXdpZHRoXCI6IFwiMTAwJVwiLFxuXHRcdFx0XCJpZnJhbWUtaGVpZ2h0XCI6IFwiNjYwcHhcIixcblx0XHRcdFwiaGlkZS1sZWdlbmRcIjogZmFsc2UsXG5cdFx0XHRcImdyb3VwLWJ5LXZhcmlhYmxlc1wiOiBmYWxzZSxcblx0XHRcdFwiYWRkLWNvdW50cnktbW9kZVwiOiBcImFkZC1jb3VudHJ5XCIsXG5cdFx0XHRcIngtYXhpcy1zY2FsZS1zZWxlY3RvclwiOiBmYWxzZSxcblx0XHRcdFwieS1heGlzLXNjYWxlLXNlbGVjdG9yXCI6IGZhbHNlLFxuXHRcdFx0XCJtYXAtY29uZmlnXCI6IHtcblx0XHRcdFx0XCJ2YXJpYWJsZUlkXCI6IC0xLFxuXHRcdFx0XHRcIm1pblllYXJcIjogMTk4MCxcblx0XHRcdFx0XCJtYXhZZWFyXCI6IDIwMDAsXG5cdFx0XHRcdFwidGFyZ2V0WWVhclwiOiAxOTgwLFxuXHRcdFx0XHRcIm1vZGVcIjogXCJzcGVjaWZpY1wiLFxuXHRcdFx0XHRcInRpbWVUb2xlcmFuY2VcIjogMTAsXG5cdFx0XHRcdFwidGltZUludGVydmFsXCI6IDEwLFxuXHRcdFx0XHRcImNvbG9yU2NoZW1lTmFtZVwiOiBcIkJ1R25cIixcblx0XHRcdFx0XCJjb2xvclNjaGVtZUludGVydmFsXCI6IDUsXG5cdFx0XHRcdFwicHJvamVjdGlvblwiOiBcIldvcmxkXCIsXG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHR0aGlzLm9uKCBcInN5bmNcIiwgdGhpcy5vblN5bmMsIHRoaXMgKTtcblx0XHRcblx0XHR9LFxuXG5cdFx0b25TeW5jOiBmdW5jdGlvbigpIHtcblxuXHRcdFx0aWYoIHRoaXMuZ2V0KCBcImNoYXJ0LXR5cGVcIiApID09IDIgKSB7XG5cdFx0XHRcdC8vbWFrZSBzdXJlIGZvciBzY2F0dGVyIHBsb3QsIHdlIGhhdmUgY29sb3Igc2V0IGFzIGNvbnRpbmVudHNcblx0XHRcdFx0dmFyIGNoYXJ0RGltZW5zaW9ucyA9ICQucGFyc2VKU09OKCB0aGlzLmdldCggXCJjaGFydC1kaW1lbnNpb25zXCIgKSApO1xuXHRcdFx0XHRpZiggIV8uZmluZFdoZXJlKCBjaGFydERpbWVuc2lvbnMsIHsgXCJwcm9wZXJ0eVwiOiBcImNvbG9yXCIgfSApICkge1xuXHRcdFx0XHRcdC8vdGhpcyBpcyB3aGVyZSB3ZSBhZGQgY29sb3IgcHJvcGVydHlcblx0XHRcdFx0XHR2YXIgY29sb3JQcm9wT2JqID0geyBcInZhcmlhYmxlSWRcIjpcIjEyM1wiLFwicHJvcGVydHlcIjpcImNvbG9yXCIsXCJ1bml0XCI6XCJcIixcIm5hbWVcIjpcIkNvbG9yXCIsXCJwZXJpb2RcIjpcInNpbmdsZVwiLFwibW9kZVwiOlwic3BlY2lmaWNcIixcInRhcmdldFllYXJcIjpcIjIwMDBcIixcInRvbGVyYW5jZVwiOlwiNVwiLFwibWF4aW11bUFnZVwiOlwiNVwifTtcblx0XHRcdFx0XHRjaGFydERpbWVuc2lvbnMucHVzaCggY29sb3JQcm9wT2JqICk7XG5cdFx0XHRcdFx0dmFyIGNoYXJEaW1lbnNpb25zU3RyaW5nID0gSlNPTi5zdHJpbmdpZnkoIGNoYXJ0RGltZW5zaW9ucyApO1xuXHRcdFx0XHRcdHRoaXMuc2V0KCBcImNoYXJ0LWRpbWVuc2lvbnNcIiwgY2hhckRpbWVuc2lvbnNTdHJpbmcgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0XG5cdFx0fSxcblxuXHRcdGFkZFNlbGVjdGVkQ291bnRyeTogZnVuY3Rpb24oIGNvdW50cnkgKSB7XG5cblx0XHRcdC8vbWFrZSBzdXJlIHdlJ3JlIHVzaW5nIG9iamVjdCwgbm90IGFzc29jaWF0aXZlIGFycmF5XG5cdFx0XHQvKmlmKCAkLmlzQXJyYXkoIHRoaXMuZ2V0KCBcInNlbGVjdGVkLWNvdW50cmllc1wiICkgKSApIHtcblx0XHRcdFx0Ly93ZSBnb3QgZW1wdHkgYXJyYXkgZnJvbSBkYiwgY29udmVydCB0byBvYmplY3Rcblx0XHRcdFx0dGhpcy5zZXQoIFwic2VsZWN0ZWQtY291bnRyaWVzXCIsIHt9ICk7XG5cdFx0XHR9Ki9cblx0XHRcdFxuXHRcdFx0dmFyIHNlbGVjdGVkQ291bnRyaWVzID0gdGhpcy5nZXQoIFwic2VsZWN0ZWQtY291bnRyaWVzXCIgKTtcblxuXHRcdFx0Ly9tYWtlIHN1cmUgdGhlIHNlbGVjdGVkIGNvbnRyeSBpcyBub3QgdGhlcmUgXG5cdFx0XHRpZiggIV8uZmluZFdoZXJlKCBzZWxlY3RlZENvdW50cmllcywgeyBpZDogY291bnRyeS5pZCB9ICkgKSB7XG5cdFx0XHRcblx0XHRcdFx0c2VsZWN0ZWRDb3VudHJpZXMucHVzaCggY291bnRyeSApO1xuXHRcdFx0XHQvL3NlbGVjdGVkQ291bnRyaWVzWyBjb3VudHJ5LmlkIF0gPSBjb3VudHJ5O1xuXHRcdFx0XHR0aGlzLnRyaWdnZXIoIFwiY2hhbmdlOnNlbGVjdGVkLWNvdW50cmllc1wiICk7XG5cdFx0XHRcdHRoaXMudHJpZ2dlciggXCJjaGFuZ2VcIiApO1xuXHRcdFx0XG5cdFx0XHR9XG5cdFx0XHRcblx0XHR9LFxuXG5cdFx0dXBkYXRlU2VsZWN0ZWRDb3VudHJ5OiBmdW5jdGlvbiggY291bnRyeUlkLCBjb2xvciApIHtcblxuXHRcdFx0dmFyIGNvdW50cnkgPSB0aGlzLmZpbmRDb3VudHJ5QnlJZCggY291bnRyeUlkICk7XG5cdFx0XHRpZiggY291bnRyeSApIHtcblx0XHRcdFx0Y291bnRyeS5jb2xvciA9IGNvbG9yO1xuXHRcdFx0XHR0aGlzLnRyaWdnZXIoIFwiY2hhbmdlOnNlbGVjdGVkLWNvdW50cmllc1wiICk7XG5cdFx0XHRcdHRoaXMudHJpZ2dlciggXCJjaGFuZ2VcIiApO1xuXHRcdFx0fVxuXG5cdFx0fSxcblxuXHRcdHJlbW92ZVNlbGVjdGVkQ291bnRyeTogZnVuY3Rpb24oIGNvdW50cnlJZCApIHtcblxuXHRcdFx0dmFyIGNvdW50cnkgPSB0aGlzLmZpbmRDb3VudHJ5QnlJZCggY291bnRyeUlkICk7XG5cdFx0XHRpZiggY291bnRyeSApIHtcblx0XHRcdFx0dmFyIHNlbGVjdGVkQ291bnRyaWVzID0gdGhpcy5nZXQoIFwic2VsZWN0ZWQtY291bnRyaWVzXCIgKSxcblx0XHRcdFx0XHRjb3VudHJ5SW5kZXggPSBfLmluZGV4T2YoIHNlbGVjdGVkQ291bnRyaWVzLCBjb3VudHJ5ICk7XG5cdFx0XHRcdHNlbGVjdGVkQ291bnRyaWVzLnNwbGljZSggY291bnRyeUluZGV4LCAxICk7XG5cdFx0XHRcdHRoaXMudHJpZ2dlciggXCJjaGFuZ2U6c2VsZWN0ZWQtY291bnRyaWVzXCIgKTtcblx0XHRcdFx0dGhpcy50cmlnZ2VyKCBcImNoYW5nZVwiICk7XG5cdFx0XHR9XG5cblx0XHR9LFxuXG5cdFx0cmVwbGFjZVNlbGVjdGVkQ291bnRyeTogZnVuY3Rpb24oIGNvdW50cnkgKSB7XG5cdFx0XHRpZiggY291bnRyeSApIHtcblx0XHRcdFx0dGhpcy5zZXQoIFwic2VsZWN0ZWQtY291bnRyaWVzXCIsIFsgY291bnRyeSBdICk7XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdGZpbmRDb3VudHJ5QnlJZDogZnVuY3Rpb24oIGNvdW50cnlJZCApIHtcblxuXHRcdFx0dmFyIHNlbGVjdGVkQ291bnRyaWVzID0gdGhpcy5nZXQoIFwic2VsZWN0ZWQtY291bnRyaWVzXCIgKSxcblx0XHRcdFx0Y291bnRyeSA9IF8uZmluZFdoZXJlKCBzZWxlY3RlZENvdW50cmllcywgeyBpZDogY291bnRyeUlkLnRvU3RyaW5nKCkgfSApO1xuXHRcdFx0cmV0dXJuIGNvdW50cnk7XG5cblx0XHR9LFxuXG5cdFx0c2V0QXhpc0NvbmZpZzogZnVuY3Rpb24oIGF4aXNOYW1lLCBwcm9wLCB2YWx1ZSApIHtcblxuXHRcdFx0aWYoICQuaXNBcnJheSggdGhpcy5nZXQoIFwieS1heGlzXCIgKSApICkge1xuXHRcdFx0XHQvL3dlIGdvdCBlbXB0eSBhcnJheSBmcm9tIGRiLCBjb252ZXJ0IHRvIG9iamVjdFxuXHRcdFx0XHR0aGlzLnNldCggXCJ5LWF4aXNcIiwge30gKTtcblx0XHRcdH1cblx0XHRcdGlmKCAkLmlzQXJyYXkoIHRoaXMuZ2V0KCBcIngtYXhpc1wiICkgKSApIHtcblx0XHRcdFx0Ly93ZSBnb3QgZW1wdHkgYXJyYXkgZnJvbSBkYiwgY29udmVydCB0byBvYmplY3Rcblx0XHRcdFx0dGhpcy5zZXQoIFwieC1heGlzXCIsIHt9ICk7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdHZhciBheGlzID0gdGhpcy5nZXQoIGF4aXNOYW1lICk7XG5cdFx0XHRpZiggYXhpcyApIHtcblx0XHRcdFx0YXhpc1sgcHJvcCBdID0gdmFsdWU7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnRyaWdnZXIoIFwiY2hhbmdlXCIgKTtcblxuXHRcdH0sXG5cblx0XHR1cGRhdGVWYXJpYWJsZXM6IGZ1bmN0aW9uKCBuZXdWYXIgKSB7XG5cdFx0XHQvL2NvcHkgYXJyYXlcblx0XHRcdHZhciB2YXJpYWJsZXMgPSB0aGlzLmdldCggXCJ2YXJpYWJsZXNcIiApLnNsaWNlKCksXG5cdFx0XHRcdHZhckluQXJyID0gXy5maW5kKCB2YXJpYWJsZXMsIGZ1bmN0aW9uKCB2ICl7IHJldHVybiB2LmlkID09IG5ld1Zhci5pZDsgfSApO1xuXG5cdFx0XHRpZiggIXZhckluQXJyICkge1xuXHRcdFx0XHR2YXJpYWJsZXMucHVzaCggbmV3VmFyICk7XG5cdFx0XHRcdHRoaXMuc2V0KCBcInZhcmlhYmxlc1wiLCB2YXJpYWJsZXMgKTtcblx0XHRcdH1cblx0XHR9LFxuXG5cdFx0cmVtb3ZlVmFyaWFibGU6IGZ1bmN0aW9uKCB2YXJJZFRvUmVtb3ZlICkge1xuXHRcdFx0Ly9jb3B5IGFycmF5XG5cdFx0XHR2YXIgdmFyaWFibGVzID0gdGhpcy5nZXQoIFwidmFyaWFibGVzXCIgKS5zbGljZSgpLFxuXHRcdFx0XHR2YXJJbkFyciA9IF8uZmluZCggdmFyaWFibGVzLCBmdW5jdGlvbiggdiApeyByZXR1cm4gdi5pZCA9PSBuZXdWYXIuaWQ7IH0gKTtcblxuXHRcdFx0aWYoICF2YXJJbkFyciApIHtcblx0XHRcdFx0dmFyaWFibGVzLnB1c2goIG5ld1ZhciApO1xuXHRcdFx0XHR0aGlzLnNldCggXCJ2YXJpYWJsZXNcIiwgdmFyaWFibGVzICk7XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdHVwZGF0ZU1hcENvbmZpZzogZnVuY3Rpb24oIHByb3BOYW1lLCBwcm9wVmFsdWUsIHNpbGVudCwgZXZlbnROYW1lICkge1xuXG5cdFx0XHR2YXIgbWFwQ29uZmlnID0gdGhpcy5nZXQoIFwibWFwLWNvbmZpZ1wiICk7XG5cdFx0XHRpZiggbWFwQ29uZmlnLmhhc093blByb3BlcnR5KCBwcm9wTmFtZSApICkge1xuXHRcdFx0XHRtYXBDb25maWdbIHByb3BOYW1lIF0gPSBwcm9wVmFsdWU7XG5cdFx0XHRcdGlmKCAhc2lsZW50ICkge1xuXHRcdFx0XHRcdHZhciBldnQgPSAoIGV2ZW50TmFtZSApPyBldmVudE5hbWU6IFwiY2hhbmdlXCI7XG5cdFx0XHRcdFx0dGhpcy50cmlnZ2VyKCBldnQgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0fVxuXG5cblx0fSApO1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLk1vZGVscy5DaGFydE1vZGVsO1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgQXBwID0gcmVxdWlyZSggXCIuLy4uL25hbWVzcGFjZXMuanNcIiApO1xuXG5cdEFwcC5Nb2RlbHMuQ2hhcnRWYXJpYWJsZU1vZGVsID0gQmFja2JvbmUuTW9kZWwuZXh0ZW5kKCB7XG5cdFx0XG5cdFx0ZGVmYXVsdHM6IHt9XG5cblx0fSApO1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLk1vZGVscy5DaGFydFZhcmlhYmxlTW9kZWw7XG5cbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBBcHAgPSByZXF1aXJlKCBcIi4vLi4vbmFtZXNwYWNlcy5qc1wiICk7XG5cdFxuXHRBcHAuTW9kZWxzLkVudGl0eU1vZGVsID0gQmFja2JvbmUuTW9kZWwuZXh0ZW5kKCB7XG5cdFx0XG5cdFx0dXJsUm9vdDogR2xvYmFsLnJvb3RVcmwgKyBcIi9lbnRpdHkvXCIsXG5cdFx0ZGVmYXVsdHM6IHsgXCJpZFwiOiBcIlwiLCBcIm5hbWVcIjogXCJcIiwgXCJ2YWx1ZXNcIjogW10gfSxcblxuXHRcdGltcG9ydDogZnVuY3Rpb24oKSB7XG5cblx0XHRcdC8vc3RyaXAgaWQsIHNvIHRoYXQgYmFja2JvbmUgdXNlcyBzdG9yZSBcblx0XHRcdHRoaXMuc2V0KCBcImlkXCIsIG51bGwgKTtcblxuXHRcdFx0dGhpcy51cmwgPSB0aGlzLnVybFJvb3QgKyAnaW1wb3J0JztcblxuXHRcdFx0dGhpcy5zYXZlKCk7XG5cblx0XHR9XG5cblx0fSApO1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLk1vZGVscy5FbnRpdHlNb2RlbDtcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdC8vbmFtZXNwYWNlc1xuXHR2YXIgQXBwID0ge307XG5cdEFwcC5WaWV3cyA9IHt9O1xuXHRBcHAuVmlld3MuQ2hhcnQgPSB7fTtcblx0QXBwLlZpZXdzLkNoYXJ0Lk1hcCA9IHt9O1xuXHRBcHAuVmlld3MuRm9ybSA9IHt9O1xuXHRBcHAuVmlld3MuVUkgPSB7fTtcblx0QXBwLk1vZGVscyA9IHt9O1xuXHRBcHAuTW9kZWxzLkltcG9ydCA9IHt9O1xuXHRBcHAuQ29sbGVjdGlvbnMgPSB7fTtcblx0QXBwLlV0aWxzID0ge307XG5cdEFwcC5VdGlscy5Gb3JtSGVscGVyID0ge307XG5cblx0Ly9leHBvcnQgZm9yIGlmcmFtZVxuXHR3aW5kb3cuJCA9IGpRdWVyeTtcblxuXHQvL2V4cG9ydFxuXHQvL3dpbmRvdy5BcHAgPSBBcHA7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHA7XG5cbn0pKCk7XG5cbiIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIEFwcCA9IHJlcXVpcmUoIFwiLi8uLi9uYW1lc3BhY2VzLmpzXCIgKSxcblx0XHRIZWFkZXIgPSByZXF1aXJlKCBcIi4vY2hhcnQvQXBwLlZpZXdzLkNoYXJ0LkhlYWRlci5qc1wiICksXG5cdFx0U2NhbGVTZWxlY3RvcnMgPSByZXF1aXJlKCBcIi4vY2hhcnQvQXBwLlZpZXdzLkNoYXJ0LlNjYWxlU2VsZWN0b3JzXCIgKSxcblx0XHRDaGFydFRhYiA9IHJlcXVpcmUoIFwiLi9jaGFydC9BcHAuVmlld3MuQ2hhcnQuQ2hhcnRUYWIuanNcIiApLFxuXHRcdERhdGFUYWIgPSByZXF1aXJlKCBcIi4vY2hhcnQvQXBwLlZpZXdzLkNoYXJ0LkRhdGFUYWIuanNcIiApLFxuXHRcdFNvdXJjZXNUYWIgPSByZXF1aXJlKCBcIi4vY2hhcnQvQXBwLlZpZXdzLkNoYXJ0LlNvdXJjZXNUYWIuanNcIiApLFxuXHRcdE1hcFRhYiA9IHJlcXVpcmUoIFwiLi9jaGFydC9BcHAuVmlld3MuQ2hhcnQuTWFwVGFiLmpzXCIgKSxcblx0XHRDaGFydERhdGFNb2RlbCA9IHJlcXVpcmUoIFwiLi8uLi9tb2RlbHMvQXBwLk1vZGVscy5DaGFydERhdGFNb2RlbC5qc1wiICksXG5cdFx0VXRpbHMgPSByZXF1aXJlKCBcIi4vLi4vQXBwLlV0aWxzLmpzXCIgKTtcblxuXHRBcHAuVmlld3MuQ2hhcnRWaWV3ID0gQmFja2JvbmUuVmlldy5leHRlbmQoe1xuXG5cdFx0ZWw6IFwiI2NoYXJ0LXZpZXdcIixcblx0XHRldmVudHM6IHtcblx0XHRcdFwiY2xpY2sgLmNoYXJ0LXNhdmUtcG5nLWJ0blwiOiBcImV4cG9ydENvbnRlbnRcIixcblx0XHRcdFwiY2xpY2sgLmNoYXJ0LXNhdmUtc3ZnLWJ0blwiOiBcImV4cG9ydENvbnRlbnRcIlxuXHRcdH0sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdFxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gb3B0aW9ucy5kaXNwYXRjaGVyO1xuXHRcdFx0XG5cdFx0XHR2YXIgY2hpbGRWaWV3T3B0aW9ucyA9IHsgZGlzcGF0Y2hlcjogdGhpcy5kaXNwYXRjaGVyLCBwYXJlbnRWaWV3OiB0aGlzIH07XG5cdFx0XHR0aGlzLmhlYWRlciA9IG5ldyBIZWFkZXIoIGNoaWxkVmlld09wdGlvbnMgKTtcblx0XHRcdHRoaXMuc2NhbGVTZWxlY3RvcnMgPSBuZXcgU2NhbGVTZWxlY3RvcnMoIGNoaWxkVmlld09wdGlvbnMgKTtcblx0XHRcdC8vdGFic1xuXHRcdFx0dGhpcy5jaGFydFRhYiA9IG5ldyBDaGFydFRhYiggY2hpbGRWaWV3T3B0aW9ucyApO1xuXHRcdFx0dGhpcy5kYXRhVGFiID0gbmV3IERhdGFUYWIoIGNoaWxkVmlld09wdGlvbnMgKTtcblx0XHRcdHRoaXMuc291cmNlc1RhYiA9IG5ldyBTb3VyY2VzVGFiKCBjaGlsZFZpZXdPcHRpb25zICk7XG5cdFx0XHR0aGlzLm1hcFRhYiA9IG5ldyBNYXBUYWIoIGNoaWxkVmlld09wdGlvbnMgKTtcblxuXHRcdFx0Ly9zZXR1cCBtb2RlbCB0aGF0IHdpbGwgZmV0Y2ggYWxsIHRoZSBkYXRhIGZvciB1c1xuXHRcdFx0dGhpcy5kYXRhTW9kZWwgPSBuZXcgQ2hhcnREYXRhTW9kZWwoKTtcblx0XHRcdFxuXHRcdFx0Ly9zZXR1cCBldmVudHNcblx0XHRcdHRoaXMuZGF0YU1vZGVsLm9uKCBcInN5bmNcIiwgdGhpcy5vbkRhdGFNb2RlbFN5bmMsIHRoaXMgKTtcblx0XHRcdHRoaXMuZGF0YU1vZGVsLm9uKCBcImVycm9yXCIsIHRoaXMub25EYXRhTW9kZWxFcnJvciwgdGhpcyApO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwub24oIFwiY2hhbmdlXCIsIHRoaXMub25DaGFydE1vZGVsQ2hhbmdlLCB0aGlzICk7XG5cblx0XHRcdHRoaXMucmVuZGVyKCk7XG5cblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblxuXHRcdFx0dmFyIHRoYXQgPSB0aGlzO1xuXG5cdFx0XHR0aGlzLiRwcmVsb2FkZXIgPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1wcmVsb2FkZXJcIiApO1xuXHRcdFx0dGhpcy4kZXJyb3IgPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1lcnJvclwiICk7XG5cblx0XHRcdC8vY2hhcnQgdGFiXG5cdFx0XHR0aGlzLiRzdmcgPSB0aGlzLiRlbC5maW5kKCBcIiNjaGFydC1jaGFydC10YWIgc3ZnXCIgKTtcblx0XHRcdHRoaXMuJHRhYkNvbnRlbnQgPSB0aGlzLiRlbC5maW5kKCBcIi50YWItY29udGVudFwiICk7XG5cdFx0XHR0aGlzLiR0YWJQYW5lcyA9IHRoaXMuJGVsLmZpbmQoIFwiLnRhYi1wYW5lXCIgKTtcblx0XHRcdHRoaXMuJGNoYXJ0SGVhZGVyID0gdGhpcy4kZWwuZmluZCggXCIuY2hhcnQtaGVhZGVyXCIgKTtcblx0XHRcdHRoaXMuJGVudGl0aWVzU2VsZWN0ID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT1hdmFpbGFibGVfZW50aXRpZXNdXCIgKTtcblx0XHRcdHRoaXMuJGNoYXJ0Rm9vdGVyID0gdGhpcy4kZWwuZmluZCggXCIuY2hhcnQtZm9vdGVyXCIgKTtcblx0XHRcdHRoaXMuJGNoYXJ0TmFtZSA9IHRoaXMuJGVsLmZpbmQoIFwiLmNoYXJ0LW5hbWVcIiApO1xuXHRcdFx0dGhpcy4kY2hhcnRTdWJuYW1lID0gdGhpcy4kZWwuZmluZCggXCIuY2hhcnQtc3VibmFtZVwiICk7XG5cdFx0XHR0aGlzLiRjaGFydERlc2NyaXB0aW9uID0gdGhpcy4kZWwuZmluZCggXCIuY2hhcnQtZGVzY3JpcHRpb25cIiApO1xuXHRcdFx0dGhpcy4kY2hhcnRTb3VyY2VzID0gdGhpcy4kZWwuZmluZCggXCIuY2hhcnQtc291cmNlc1wiICk7XG5cdFx0XHR0aGlzLiRjaGFydEZ1bGxTY3JlZW4gPSB0aGlzLiRlbC5maW5kKCBcIi5mYW5jeWJveC1pZnJhbWVcIiApO1xuXG5cdFx0XHR0aGlzLiR4QXhpc1NjYWxlU2VsZWN0b3IgPSB0aGlzLiRlbC5maW5kKCBcIi54LWF4aXMtc2NhbGUtc2VsZWN0b3JcIiApO1xuXHRcdFx0dGhpcy4keEF4aXNTY2FsZSA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9eF9heGlzX3NjYWxlXVwiICk7XG5cdFx0XHR0aGlzLiR5QXhpc1NjYWxlU2VsZWN0b3IgPSB0aGlzLiRlbC5maW5kKCBcIi55LWF4aXMtc2NhbGUtc2VsZWN0b3JcIiApO1xuXHRcdFx0dGhpcy4keUF4aXNTY2FsZSA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9eV9heGlzX3NjYWxlXVwiICk7XG5cblx0XHRcdHRoaXMuJHJlbG9hZEJ0biA9IHRoaXMuJGVsLmZpbmQoIFwiLnJlbG9hZC1idG5cIiApO1xuXG5cdFx0XHR2YXIgY2hhcnROYW1lID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LW5hbWVcIiApLFxuXHRcdFx0XHRhZGRDb3VudHJ5TW9kZSA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJhZGQtY291bnRyeS1tb2RlXCIgKSxcblx0XHRcdFx0Zm9ybUNvbmZpZyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJmb3JtLWNvbmZpZ1wiICksXG5cdFx0XHRcdGVudGl0aWVzID0gKCBmb3JtQ29uZmlnICYmIGZvcm1Db25maWdbIFwiZW50aXRpZXMtY29sbGVjdGlvblwiIF0gKT8gZm9ybUNvbmZpZ1sgXCJlbnRpdGllcy1jb2xsZWN0aW9uXCIgXTogW10sXG5cdFx0XHRcdHNlbGVjdGVkQ291bnRyaWVzID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcInNlbGVjdGVkLWNvdW50cmllc1wiICksXG5cdFx0XHRcdHNlbGVjdGVkQ291bnRyaWVzSWRzID0gXy5tYXAoIHNlbGVjdGVkQ291bnRyaWVzLCBmdW5jdGlvbiggdiApIHsgcmV0dXJuICh2KT8gK3YuaWQ6IFwiXCI7IH0gKSxcblx0XHRcdFx0Y2hhcnRUaW1lID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LXRpbWVcIiApO1xuXHRcdFx0XHRcblx0XHRcdC8vbWlnaHQgbmVlZCB0byByZXBsYWNlIGNvdW50cnkgaW4gdGl0bGUsIGlmIFwiY2hhbmdlIGNvdW50cnlcIiBtb2RlXG5cdFx0XHRpZiggYWRkQ291bnRyeU1vZGUgPT09IFwiY2hhbmdlLWNvdW50cnlcIiApIHtcblx0XHRcdFx0Ly95ZXAsIHByb2JhYmx5IG5lZWQgcmVwbGFjaW5nIGNvdW50cnkgaW4gdGl0bGUgKHNlbGVjdCBmaXJzdCBjb3VudHJ5IGZvcm0gc3RvcmVkIG9uZSlcblx0XHRcdFx0aWYoIHNlbGVjdGVkQ291bnRyaWVzICYmIHNlbGVjdGVkQ291bnRyaWVzLmxlbmd0aCApIHtcblx0XHRcdFx0XHR2YXIgY291bnRyeSA9IHNlbGVjdGVkQ291bnRyaWVzWzBdO1xuXHRcdFx0XHRcdGNoYXJ0TmFtZSA9IGNoYXJ0TmFtZS5yZXBsYWNlKCBcIipjb3VudHJ5KlwiLCBjb3VudHJ5Lm5hbWUgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvL3VwZGF0ZSB2YWx1ZXNcblx0XHRcdHRoaXMuJGNoYXJ0TmFtZS50ZXh0KCBjaGFydE5hbWUgKTtcblx0XHRcdHRoaXMuJGNoYXJ0U3VibmFtZS5odG1sKCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtc3VibmFtZVwiICkgKTtcblxuXHRcdFx0dmFyIGNoYXJ0RGVzY3JpcHRpb24gPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtZGVzY3JpcHRpb25cIiApO1xuXHRcdFx0Ly90aGlzLiRjaGFydERlc2NyaXB0aW9uLnRleHQoIEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC1kZXNjcmlwdGlvblwiICkgKTtcblxuXHRcdFx0Ly9zaG93L2hpZGUgc2NhbGUgc2VsZWN0b3JzXG5cdFx0XHR2YXIgc2hvd1hTY2FsZVNlbGVjdG9ycyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJ4LWF4aXMtc2NhbGUtc2VsZWN0b3JcIiApO1xuXHRcdFx0aWYoIHNob3dYU2NhbGVTZWxlY3RvcnMgKSB7XG5cdFx0XHRcdHRoaXMuJHhBeGlzU2NhbGVTZWxlY3Rvci5zaG93KCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLiR4QXhpc1NjYWxlU2VsZWN0b3IuaGlkZSgpO1xuXHRcdFx0fVxuXHRcdFx0dmFyIHNob3dZU2NhbGVTZWxlY3RvcnMgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwieS1heGlzLXNjYWxlLXNlbGVjdG9yXCIgKTtcblx0XHRcdGlmKCBzaG93WVNjYWxlU2VsZWN0b3JzICkge1xuXHRcdFx0XHR0aGlzLiR5QXhpc1NjYWxlU2VsZWN0b3Iuc2hvdygpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy4keUF4aXNTY2FsZVNlbGVjdG9yLmhpZGUoKTtcblx0XHRcdH1cblxuXHRcdFx0Ly91cGRhdGUgY291bnRyaWVzXG5cdFx0XHR0aGlzLiRlbnRpdGllc1NlbGVjdC5lbXB0eSgpO1xuXHRcdFx0aWYoIHNlbGVjdGVkQ291bnRyaWVzSWRzLmxlbmd0aCApIHtcblx0XHRcdFx0Ly9hcHBlbmQgZW1wdHkgZGVmYXVsdCBvcHRpb25cblx0XHRcdFx0dGhhdC4kZW50aXRpZXNTZWxlY3QuYXBwZW5kKCBcIjxvcHRpb24gZGlzYWJsZWQgc2VsZWN0ZWQ+U2VsZWN0IGNvdW50cnk8L29wdGlvbj5cIiApO1xuXHRcdFx0XHRfLmVhY2goIGVudGl0aWVzLCBmdW5jdGlvbiggZCwgaSApIHtcblx0XHRcdFx0XHQvL2FkZCBvbmx5IHRob3NlIGVudGl0aWVzLCB3aGljaCBhcmUgbm90IHNlbGVjdGVkIGFscmVhZHlcblx0XHRcdFx0XHRpZiggXy5pbmRleE9mKCBzZWxlY3RlZENvdW50cmllc0lkcywgK2QuaWQgKSA9PSAtMSApIHtcblx0XHRcdFx0XHRcdHRoYXQuJGVudGl0aWVzU2VsZWN0LmFwcGVuZCggXCI8b3B0aW9uIHZhbHVlPSdcIiArIGQuaWQgKyBcIic+XCIgKyBkLm5hbWUgKyBcIjwvb3B0aW9uPlwiICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cdFx0XHQvL21ha2UgY2hvc2VuIHVwZGF0ZSwgbWFrZSBzdXJlIGl0IGxvb3NlcyBibHVyIGFzIHdlbGxcblx0XHRcdHRoaXMuJGVudGl0aWVzU2VsZWN0LnRyaWdnZXIoIFwiY2hvc2VuOnVwZGF0ZWRcIiApO1xuXG5cdFx0XHR0aGlzLiRjaGFydEZ1bGxTY3JlZW4ub24oIFwiY2xpY2tcIiwgZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdHZhciAkdGhpcyA9ICQoIHRoaXMgKTtcblx0XHRcdFx0d2luZG93LnBhcmVudC5vcGVuRmFuY3lCb3goICR0aGlzLmF0dHIoIFwiaHJlZlwiICkgKTtcblx0XHRcdH0gKTtcblxuXHRcdFx0Ly9yZWZyZXNoIGJ0blxuXHRcdFx0dGhpcy4kcmVsb2FkQnRuLm9uKCBcImNsaWNrXCIsIGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHR3aW5kb3cubG9jYXRpb24ucmVsb2FkKCk7XG5cdFx0XHR9ICk7XG5cblx0XHRcdC8vY2hhcnQgdGFiXG5cdFx0XHR0aGlzLiRjaGFydFRhYiA9IHRoaXMuJGVsLmZpbmQoIFwiI2NoYXJ0LWNoYXJ0LXRhYlwiICk7XG5cblx0XHRcdHZhciBkaW1lbnNpb25zU3RyaW5nID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LWRpbWVuc2lvbnNcIiApLFxuXHRcdFx0XHR2YWxpZERpbWVuc2lvbnMgPSBmYWxzZTtcblx0XHRcdFxuXHRcdFx0Ly9jbGlja2luZyBhbnl0aGluZyBpbiBjaGFydCBzb3VyY2Ugd2lsbCB0YWtlIHlvdSB0byBzb3VyY2VzIHRhYlxuXHRcdFx0dGhpcy4kY2hhcnRTb3VyY2VzLm9uKCBcImNsaWNrXCIsIGZ1bmN0aW9uKGV2dCkge1xuXHRcdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0dmFyICRhID0gJCggXCJbaHJlZj0nI3NvdXJjZXMtY2hhcnQtdGFiJ11cIiApO1xuXHRcdFx0XHQkYS50cmlnZ2VyKCBcImNsaWNrXCIgKTtcblx0XHRcdH0gKTtcblxuXHRcdFx0Ly9jaGVjayB3ZSBoYXZlIGFsbCBkaW1lbnNpb25zIG5lY2Vzc2FyeSBcblx0XHRcdGlmKCAhJC5pc0VtcHR5T2JqZWN0KCBkaW1lbnNpb25zU3RyaW5nICkgKSB7XG5cdFx0XHRcdHZhciBkaW1lbnNpb24gPSAkLnBhcnNlSlNPTiggZGltZW5zaW9uc1N0cmluZyApO1xuXHRcdFx0XHR2YWxpZERpbWVuc2lvbnMgPSBVdGlscy5jaGVja1ZhbGlkRGltZW5zaW9ucyggZGltZW5zaW9uLCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdHlwZVwiICkpO1xuXHRcdFx0fVxuXG5cdFx0XHQvL21ha2Ugc3VyZSB0byBhcHBlYXIgb25seSBmaXJzdCB0YWIgdGFicyB0aGF0IGFyZSBuZWNlc3Nhcnlcblx0XHRcdC8vYXBwZWFyIG9ubHkgZmlyc3QgdGFiIGlmIG5vbmUgdmlzaWJsZVxuXHRcdFx0aWYoICF0aGlzLiR0YWJQYW5lcy5maWx0ZXIoIFwiLmFjdGl2ZVwiICkubGVuZ3RoICkge1xuXHRcdFx0XHR2YXIgdGFicyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJ0YWJzXCIgKSxcblx0XHRcdFx0XHRmaXJzdFRhYk5hbWUgPSB0YWJzWyAwIF0sXG5cdFx0XHRcdFx0Zmlyc3RUYWJQYW5lID0gdGhpcy4kdGFiUGFuZXMuZmlsdGVyKCBcIiNcIiArIGZpcnN0VGFiTmFtZSArIFwiLWNoYXJ0LXRhYlwiICk7XG5cdFx0XHRcdGZpcnN0VGFiUGFuZS5hZGRDbGFzcyggXCJhY3RpdmVcIiApO1xuXHRcdFx0XHRpZiggZmlyc3RUYWJOYW1lID09PSBcIm1hcFwiICkge1xuXHRcdFx0XHRcdC8vbWFwIHRhYiBuZWVkcyBzcGVjaWFsIGluaWFsaXRpemF0aW9uXG5cdFx0XHRcdFx0dGhpcy5tYXBUYWIuZGlzcGxheSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdGlmKCAhdmFsaWREaW1lbnNpb25zICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdGlmKCBkaW1lbnNpb25zU3RyaW5nICkge1xuXG5cdFx0XHRcdHRoaXMuJHByZWxvYWRlci5zaG93KCk7XG5cblx0XHRcdFx0dmFyIGRhdGFQcm9wcyA9IHsgXCJkaW1lbnNpb25zXCI6IGRpbWVuc2lvbnNTdHJpbmcsIFwiY2hhcnRJZFwiOiBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiaWRcIiApLCBcImNoYXJ0VHlwZVwiOiBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdHlwZVwiICksIFwic2VsZWN0ZWRDb3VudHJpZXNcIjogc2VsZWN0ZWRDb3VudHJpZXNJZHMsIFwiY2hhcnRUaW1lXCI6IGNoYXJ0VGltZSwgXCJjYWNoZVwiOiBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2FjaGVcIiApLCBcImdyb3VwQnlWYXJpYWJsZXNcIjogQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImdyb3VwLWJ5LXZhcmlhYmxlc1wiICkgIH07XG5cdFx0XHRcdFxuXHRcdFx0XHR0aGlzLmRhdGFNb2RlbC5mZXRjaCggeyBkYXRhOiBkYXRhUHJvcHMgfSApO1xuXG5cdFx0XHR9IGVsc2Uge1xuXG5cdFx0XHRcdC8vY2xlYXIgYW55IHByZXZpb3VzIGNoYXJ0XG5cdFx0XHRcdCQoIFwic3ZnXCIgKS5lbXB0eSgpO1xuXG5cdFx0XHR9XG5cblx0XHR9LFxuXG5cdFx0b25DaGFydE1vZGVsQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHR0aGlzLnJlbmRlcigpO1xuXHRcdFx0XG5cdFx0fSxcblxuXHRcdG9uRGF0YU1vZGVsU3luYzogZnVuY3Rpb24oIG1vZGVsLCByZXNwb25zZSApIHtcblx0XHRcdHRoaXMuJGVycm9yLmhpZGUoKTtcblx0XHRcdHRoaXMuJHByZWxvYWRlci5oaWRlKCk7XG5cdFx0XHRpZiggcmVzcG9uc2UuZGF0YSApIHtcblx0XHRcdFx0dGhpcy51cGRhdGVDaGFydCggcmVzcG9uc2UuZGF0YSwgcmVzcG9uc2UudGltZVR5cGUsIHJlc3BvbnNlLmRpbWVuc2lvbnMgKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuc291cmNlc1RhYi5yZW5kZXIoIHJlc3BvbnNlICk7XG5cdFx0fSxcblxuXHRcdG9uRGF0YU1vZGVsRXJyb3I6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy4kZXJyb3Iuc2hvdygpO1xuXHRcdFx0dGhpcy4kcHJlbG9hZGVyLmhpZGUoKTtcblx0XHR9LFxuXG5cdFx0ZXhwb3J0Q29udGVudDogZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdFxuXHRcdFx0Ly9odHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzIzMjE4MTc0L2hvdy1kby1pLXNhdmUtZXhwb3J0LWFuLXN2Zy1maWxlLWFmdGVyLWNyZWF0aW5nLWFuLXN2Zy13aXRoLWQzLWpzLWllLXNhZmFyaS1hblxuXHRcdFx0dmFyICRidG4gPSAkKCBldnQuY3VycmVudFRhcmdldCApLFxuXHRcdFx0XHQvL3N0b3JlIHByZS1wcmludGluZyBzdmdcblx0XHRcdFx0JG9sZEVsID0gdGhpcy4kZWwsXG5cdFx0XHRcdCRuZXdFbCA9ICRvbGRFbC5jbG9uZSgpLFxuXHRcdFx0XHRpc1N2ZyA9ICggJGJ0bi5oYXNDbGFzcyggXCJjaGFydC1zYXZlLXN2Zy1idG5cIiApICk/IHRydWU6IGZhbHNlO1xuXHRcdFx0XG5cdFx0XHQkb2xkRWwucmVwbGFjZVdpdGgoICRuZXdFbCApO1xuXG5cdFx0XHQvL2dyYWIgYWxsIHN2Z1xuXHRcdFx0dmFyICRzdmcgPSAkbmV3RWwuZmluZCggXCJzdmdcIiApLFxuXHRcdFx0XHRzdmcgPSAkc3ZnLmdldCggMCApLFxuXHRcdFx0XHRzdmdTdHJpbmcgPSBzdmcub3V0ZXJIVE1MO1xuXG5cdFx0XHQvL2FkZCBwcmludGluZyBzdHlsZXNcblx0XHRcdCRzdmcuYXR0ciggXCJjbGFzc1wiLCBcIm52ZDMtc3ZnIGV4cG9ydC1zdmdcIiApO1xuXG5cdFx0XHQvL2lubGluZSBzdHlsZXMgZm9yIHRoZSBleHBvcnRcblx0XHRcdHZhciBzdHlsZVNoZWV0cyA9IGRvY3VtZW50LnN0eWxlU2hlZXRzO1xuXHRcdFx0Zm9yKCB2YXIgaSA9IDA7IGkgPCBzdHlsZVNoZWV0cy5sZW5ndGg7IGkrKyApIHtcblx0XHRcdFx0VXRpbHMuaW5saW5lQ3NzU3R5bGUoIHN0eWxlU2hlZXRzWyBpIF0uY3NzUnVsZXMgKTtcblx0XHRcdH1cblxuXHRcdFx0Ly9kZXBlbmRpbmcgd2hldGhlciB3ZSdyZSBjcmVhdGluZyBzdmcgb3IgcG5nLCBcblx0XHRcdGlmKCBpc1N2ZyApIHtcblxuXHRcdFx0XHR2YXIgc2VyaWFsaXplciA9IG5ldyBYTUxTZXJpYWxpemVyKCksXG5cdFx0XHRcdHNvdXJjZSA9IHNlcmlhbGl6ZXIuc2VyaWFsaXplVG9TdHJpbmcoc3ZnKTtcblx0XHRcdFx0Ly9hZGQgbmFtZSBzcGFjZXMuXG5cdFx0XHRcdGlmKCFzb3VyY2UubWF0Y2goL148c3ZnW14+XSt4bWxucz1cImh0dHBcXDpcXC9cXC93d3dcXC53M1xcLm9yZ1xcLzIwMDBcXC9zdmdcIi8pKXtcblx0XHRcdFx0XHRzb3VyY2UgPSBzb3VyY2UucmVwbGFjZSgvXjxzdmcvLCAnPHN2ZyB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCInKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZighc291cmNlLm1hdGNoKC9ePHN2Z1tePl0rXCJodHRwXFw6XFwvXFwvd3d3XFwudzNcXC5vcmdcXC8xOTk5XFwveGxpbmtcIi8pKXtcblx0XHRcdFx0XHRzb3VyY2UgPSBzb3VyY2UucmVwbGFjZSgvXjxzdmcvLCAnPHN2ZyB4bWxuczp4bGluaz1cImh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmtcIicpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdFxuXHRcdFx0XHQvL2FkZCB4bWwgZGVjbGFyYXRpb25cblx0XHRcdFx0c291cmNlID0gJzw/eG1sIHZlcnNpb249XCIxLjBcIiBzdGFuZGFsb25lPVwibm9cIj8+XFxyXFxuJyArIHNvdXJjZTtcblxuXHRcdFx0XHQvL2NvbnZlcnQgc3ZnIHNvdXJjZSB0byBVUkkgZGF0YSBzY2hlbWUuXG5cdFx0XHRcdHZhciB1cmwgPSBcImRhdGE6aW1hZ2Uvc3ZnK3htbDtjaGFyc2V0PXV0Zi04LFwiK2VuY29kZVVSSUNvbXBvbmVudChzb3VyY2UpO1xuXHRcdFx0XHQkYnRuLmF0dHIoIFwiaHJlZlwiLCB1cmwgKTtcblxuXHRcdFx0fSBlbHNlIHtcblxuXHRcdFx0XHR2YXIgJHN2Z0NhbnZhcyA9ICQoIFwiLm52ZDMtc3ZnXCIgKTtcblx0XHRcdFx0aWYoICRzdmdDYW52YXMubGVuZ3RoICkge1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdHNhdmVTdmdBc1BuZyggJCggXCIubnZkMy1zdmdcIiApLmdldCggMCApLCBcImNoYXJ0LnBuZ1wiKTtcblxuXHRcdFx0XHRcdC8vdGVtcCBoYWNrIC0gcmVtb3ZlIGltYWdlIHdoZW4gZXhwb3J0aW5nIHRvIHBuZ1xuXHRcdFx0XHRcdC8qdmFyICRzdmdMb2dvID0gJCggXCIuY2hhcnQtbG9nby1zdmdcIiApO1xuXHRcdFx0XHRcdCRzdmdMb2dvLnJlbW92ZSgpO1xuXG5cdFx0XHRcdFx0c2F2ZVN2Z0FzUG5nKCAkKCBcIi5udmQzLXN2Z1wiICkuZ2V0KCAwICksIFwiY2hhcnQucG5nXCIpO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdCRzdmcucHJlcGVuZCggJHN2Z0xvZ28gKTsqL1xuXHRcdFx0XHRcdFxuXHRcdFx0XHR9XG5cblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0Ly9hZGQgYmFjayB0aGUgcHJpbnRlZCBzdmdcblx0XHRcdCRuZXdFbC5yZXBsYWNlV2l0aCggJG9sZEVsICk7XG5cdFx0XHQvL3JlZnJlc2ggbGlua1xuXHRcdFx0JG9sZEVsLmZpbmQoIFwiLmNoYXJ0LXNhdmUtc3ZnLWJ0blwiICkub24oIFwiY2xpY2tcIiwgJC5wcm94eSggdGhpcy5leHBvcnRDb250ZW50LCB0aGlzICkgKTtcblxuXHRcdH0sXG5cblx0XHR1cGRhdGVDaGFydDogZnVuY3Rpb24oIGRhdGEsIHRpbWVUeXBlLCBkaW1lbnNpb25zICkge1xuXG5cdFx0XHR0aGlzLmNoYXJ0VGFiLnJlbmRlciggZGF0YSwgdGltZVR5cGUsIGRpbWVuc2lvbnMgKTtcblx0XHRcblx0XHR9LFxuXHRcblx0XHRvblJlc2l6ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcblx0XHRcdC8vY29tcHV0ZSBob3cgbXVjaCBzcGFjZSBmb3IgY2hhcnRcblx0XHRcdHZhciBzdmdXaWR0aCA9IHRoaXMuJHN2Zy53aWR0aCgpLFxuXHRcdFx0XHRzdmdIZWlnaHQgPSB0aGlzLiRzdmcuaGVpZ2h0KCksXG5cdFx0XHRcdGNoYXJ0VHlwZSA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10eXBlXCIgKSxcblx0XHRcdFx0JGNoYXJ0TmFtZVN2ZyA9IHRoaXMuJGVsLmZpbmQoIFwiLmNoYXJ0LW5hbWUtc3ZnXCIgKSxcblx0XHRcdFx0JGNoYXJ0U3VibmFtZVN2ZyA9IHRoaXMuJGVsLmZpbmQoIFwiLmNoYXJ0LXN1Ym5hbWUtc3ZnXCIgKSxcblx0XHRcdFx0JGNoYXJ0RGVzY3JpcHRpb25TdmcgPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1kZXNjcmlwdGlvbi1zdmdcIiApLFxuXHRcdFx0XHQkY2hhcnRTb3VyY2VzU3ZnID0gdGhpcy4kZWwuZmluZCggXCIuY2hhcnQtc291cmNlcy1zdmdcIiApLFxuXHRcdFx0XHRjaGFydEhlYWRlckhlaWdodCA9IHRoaXMuJGNoYXJ0SGVhZGVyLmhlaWdodCgpLFxuXHRcdFx0XHRtYXJnaW5zID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcIm1hcmdpbnNcIiApLFxuXHRcdFx0XHR0b3BDaGFydE1hcmdpbiA9IDMwLFxuXHRcdFx0XHRib3R0b21DaGFydE1hcmdpbiA9IDYwLFxuXHRcdFx0XHRjdXJyWSwgZm9vdGVyRGVzY3JpcHRpb25IZWlnaHQsIGZvb3RlclNvdXJjZXNIZWlnaHQsIGNoYXJ0SGVpZ2h0O1xuXG5cdFx0XHR0aGlzLiR0YWJDb250ZW50LmhlaWdodCggJCggXCIuY2hhcnQtd3JhcHBlci1pbm5lclwiICkuaGVpZ2h0KCkgLSB0aGlzLiRjaGFydEhlYWRlci5oZWlnaHQoKSApO1xuXG5cdFx0XHQvL3dyYXAgaGVhZGVyIHRleHRcblx0XHRcdFV0aWxzLndyYXAoICRjaGFydE5hbWVTdmcsIHN2Z1dpZHRoICk7XG5cdFx0XHRjdXJyWSA9IHBhcnNlSW50KCAkY2hhcnROYW1lU3ZnLmF0dHIoIFwieVwiICksIDEwICkgKyAkY2hhcnROYW1lU3ZnLm91dGVySGVpZ2h0KCkgKyAyMDtcblx0XHRcdCRjaGFydFN1Ym5hbWVTdmcuYXR0ciggXCJ5XCIsIGN1cnJZICk7XG5cdFx0XHRcblx0XHRcdC8vd3JhcCBkZXNjcmlwdGlvblxuXHRcdFx0VXRpbHMud3JhcCggJGNoYXJ0U3VibmFtZVN2Zywgc3ZnV2lkdGggKTtcblxuXHRcdFx0Ly9zdGFydCBwb3NpdGlvbmluZyB0aGUgZ3JhcGgsIGFjY29yZGluZyBcblx0XHRcdGN1cnJZID0gY2hhcnRIZWFkZXJIZWlnaHQ7XG5cblx0XHRcdHZhciB0cmFuc2xhdGVZID0gY3Vyclk7XG5cdFx0XHRcblx0XHRcdHRoaXMuJHN2Zy5oZWlnaHQoIHRoaXMuJHRhYkNvbnRlbnQuaGVpZ2h0KCkgKyBjdXJyWSApO1xuXG5cdFx0XHQvL3VwZGF0ZSBzdG9yZWQgaGVpZ2h0XG5cdFx0XHRzdmdIZWlnaHQgPSB0aGlzLiRzdmcuaGVpZ2h0KCk7XG5cblx0XHRcdC8vYWRkIGhlaWdodCBvZiBsZWdlbmRcblx0XHRcdC8vY3VyclkgKz0gdGhpcy5jaGFydC5sZWdlbmQuaGVpZ2h0KCk7XG5cdFx0XHRpZiggIUFwcC5DaGFydE1vZGVsLmdldCggXCJoaWRlLWxlZ2VuZFwiICkgKSB7XG5cdFx0XHRcdGN1cnJZICs9IHRoaXMuY2hhcnRUYWIubGVnZW5kLmhlaWdodCgpO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHQvL3Bvc2l0aW9uIGNoYXJ0XG5cdFx0XHRVdGlscy53cmFwKCAkY2hhcnREZXNjcmlwdGlvblN2Zywgc3ZnV2lkdGggKTtcblx0XHRcdGZvb3RlckRlc2NyaXB0aW9uSGVpZ2h0ID0gJGNoYXJ0RGVzY3JpcHRpb25TdmcuaGVpZ2h0KCk7XG5cdFx0XHRVdGlscy53cmFwKCAkY2hhcnRTb3VyY2VzU3ZnLCBzdmdXaWR0aCApO1xuXHRcdFx0Zm9vdGVyU291cmNlc0hlaWdodCA9ICRjaGFydFNvdXJjZXNTdmcuaGVpZ2h0KCk7XG5cblx0XHRcdHZhciBmb290ZXJIZWlnaHQgPSB0aGlzLiRjaGFydEZvb3Rlci5oZWlnaHQoKTtcblxuXHRcdFx0Ly9zZXQgY2hhcnQgaGVpZ2h0XG5cdFx0XHRjaGFydEhlaWdodCA9IHN2Z0hlaWdodCAtIHRyYW5zbGF0ZVkgLSBmb290ZXJIZWlnaHQgLSBib3R0b21DaGFydE1hcmdpbjtcblx0XHRcdGlmKCAhQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImhpZGUtbGVnZW5kXCIgKSApIHtcblx0XHRcdFx0Y2hhcnRIZWlnaHQgLT0gdGhpcy5jaGFydFRhYi5sZWdlbmQuaGVpZ2h0KCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vcmVmbGVjdCBtYXJnaW4gdG9wIGFuZCBkb3duIGluIGNoYXJ0SGVpZ2h0XG5cdFx0XHRjaGFydEhlaWdodCA9IGNoYXJ0SGVpZ2h0IC0gbWFyZ2lucy5ib3R0b20gLSBtYXJnaW5zLnRvcDtcblxuXHRcdFx0Ly9wb3NpdGlvbiBmb290ZXJcblx0XHRcdCRjaGFydERlc2NyaXB0aW9uU3ZnLmF0dHIoIFwieVwiLCBjdXJyWSArIGNoYXJ0SGVpZ2h0ICsgYm90dG9tQ2hhcnRNYXJnaW4gKTtcblx0XHRcdFV0aWxzLndyYXAoICRjaGFydERlc2NyaXB0aW9uU3ZnLCBzdmdXaWR0aCApO1xuXHRcdFx0JGNoYXJ0U291cmNlc1N2Zy5hdHRyKCBcInlcIiwgcGFyc2VJbnQoICRjaGFydERlc2NyaXB0aW9uU3ZnLmF0dHIoIFwieVwiICksIDEwICkgKyAkY2hhcnREZXNjcmlwdGlvblN2Zy5oZWlnaHQoKSArIGZvb3RlckRlc2NyaXB0aW9uSGVpZ2h0LzMgKTtcblx0XHRcdFV0aWxzLndyYXAoICRjaGFydFNvdXJjZXNTdmcsIHN2Z1dpZHRoICk7XG5cdFx0XHRcblx0XHRcdC8vY29tcHV0ZSBjaGFydCB3aWR0aFxuXHRcdFx0dmFyIGNoYXJ0V2lkdGggPSBzdmdXaWR0aCAtIG1hcmdpbnMubGVmdCAtIG1hcmdpbnMucmlnaHQ7XG5cdFx0XHR0aGlzLmNoYXJ0VGFiLmNoYXJ0LndpZHRoKCBjaGFydFdpZHRoICk7XG5cdFx0XHR0aGlzLmNoYXJ0VGFiLmNoYXJ0LmhlaWdodCggY2hhcnRIZWlnaHQgKTtcblxuXHRcdFx0Ly9uZWVkIHRvIGNhbGwgY2hhcnQgdXBkYXRlIGZvciByZXNpemluZyBvZiBlbGVtZW50cyB3aXRoaW4gY2hhcnRcblx0XHRcdGlmKCB0aGlzLiRjaGFydFRhYi5pcyggXCI6dmlzaWJsZVwiICkgKSB7XG5cdFx0XHRcdHRoaXMuY2hhcnRUYWIuY2hhcnQudXBkYXRlKCk7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdGlmKCBjaGFydFR5cGUgPT09IFwiM1wiICkge1xuXHRcdFx0XHQvL2ZvciBzdGFja2VkIGFyZWEgY2hhcnQsIG5lZWQgdG8gbWFudWFsbHkgYWRqdXN0IGhlaWdodFxuXHRcdFx0XHR2YXIgY3VyckludExheWVySGVpZ2h0ID0gdGhpcy5jaGFydFRhYi5jaGFydC5pbnRlcmFjdGl2ZUxheWVyLmhlaWdodCgpLFxuXHRcdFx0XHRcdC8vVE9ETyAtIGRvIG5vdCBoYXJkY29kZSB0aGlzXG5cdFx0XHRcdFx0aGVpZ2h0QWRkID0gMTUwO1xuXHRcdFx0XHR0aGlzLmNoYXJ0VGFiLmNoYXJ0LmludGVyYWN0aXZlTGF5ZXIuaGVpZ2h0KCBjdXJySW50TGF5ZXJIZWlnaHQgKyBoZWlnaHRBZGQgKTtcblx0XHRcdFx0ZDMuc2VsZWN0KFwiLm52LWludGVyYWN0aXZlXCIpLmNhbGwodGhpcy5jaGFydFRhYi5jaGFydC5pbnRlcmFjdGl2ZUxheWVyKTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0aWYoICFBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiaGlkZS1sZWdlbmRcIiApICkge1xuXHRcdFx0XHQvL3Bvc2l0aW9uIGxlZ2VuZFxuXHRcdFx0XHR2YXIgbGVnZW5kTWFyZ2lucyA9IHRoaXMuY2hhcnRUYWIubGVnZW5kLm1hcmdpbigpO1xuXHRcdFx0XHRjdXJyWSA9IGN1cnJZIC0gdGhpcy5jaGFydFRhYi5sZWdlbmQuaGVpZ2h0KCk7XG5cdFx0XHRcdHRoaXMudHJhbnNsYXRlU3RyaW5nID0gXCJ0cmFuc2xhdGUoXCIgKyBsZWdlbmRNYXJnaW5zLmxlZnQgKyBcIiAsXCIgKyBjdXJyWSArIFwiKVwiO1xuXHRcdFx0XHR0aGlzLiRzdmcuZmluZCggXCI+IC5udmQzLm52LWN1c3RvbS1sZWdlbmRcIiApLmF0dHIoIFwidHJhbnNmb3JtXCIsIHRoaXMudHJhbnNsYXRlU3RyaW5nICk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuJHN2Zy5jc3MoIFwidHJhbnNmb3JtXCIsIFwidHJhbnNsYXRlKDAsLVwiICsgY2hhcnRIZWFkZXJIZWlnaHQgKyBcInB4KVwiICk7XG5cblx0XHRcdC8vZm9yIG11bHRpYmFyY2hhcnQsIG5lZWQgdG8gbW92ZSBjb250cm9scyBiaXQgaGlnaGVyXG5cdFx0XHRpZiggY2hhcnRUeXBlID09PSBcIjRcIiB8fCBjaGFydFR5cGUgPT09IFwiNVwiICkge1xuXHRcdFx0XHRkMy5zZWxlY3QoIFwiLm52LWNvbnRyb2xzV3JhcFwiICkuYXR0ciggXCJ0cmFuc2Zvcm1cIiwgXCJ0cmFuc2xhdGUoMCwtMjUpXCIgKTtcblx0XHRcdH1cblxuXHRcdFx0Ly9yZWZsZWN0IG1hcmdpbiB0b3AgaW4gY3Vycllcblx0XHRcdGlmKCAhQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImhpZGUtbGVnZW5kXCIgKSApIHtcblx0XHRcdFx0Y3VyclkgKz0gK3RoaXMuY2hhcnRUYWIubGVnZW5kLmhlaWdodCgpO1xuXHRcdFx0fVxuXHRcdFx0Y3VyclkgKz0gK21hcmdpbnMudG9wO1xuXG5cdFx0XHR2YXIgJHdyYXAgPSB0aGlzLiRzdmcuZmluZCggXCI+IC5udmQzLm52LXdyYXBcIiApO1xuXG5cdFx0XHQvL21hbnVhbGx5IHJlcG9zaXRpb24gY2hhcnQgYWZ0ZXIgdXBkYXRlXG5cdFx0XHQvL3RoaXMudHJhbnNsYXRlU3RyaW5nID0gXCJ0cmFuc2xhdGUoXCIgKyBtYXJnaW5zLmxlZnQgKyBcIixcIiArIGN1cnJZICsgXCIpXCI7XG5cdFx0XHR0aGlzLnRyYW5zbGF0ZVN0cmluZyA9IFwidHJhbnNsYXRlKFwiICsgbWFyZ2lucy5sZWZ0ICsgXCIsXCIgKyBjdXJyWSArIFwiKVwiO1xuXHRcdFx0JHdyYXAuYXR0ciggXCJ0cmFuc2Zvcm1cIiwgdGhpcy50cmFuc2xhdGVTdHJpbmcgKTtcblx0XHRcdFxuXHRcdFx0Ly9wb3NpdGlvbiBzY2FsZSBkcm9wZG93bnMgLSBUT0RPIC0gaXNuJ3QgdGhlcmUgYSBiZXR0ZXIgd2F5IHRoZW4gd2l0aCB0aW1lb3V0P1xuXHRcdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdFx0c2V0VGltZW91dCggZnVuY3Rpb24oKSB7XG5cdFx0XHRcblx0XHRcdFx0dmFyIHdyYXBPZmZzZXQgPSAkd3JhcC5vZmZzZXQoKSxcblx0XHRcdFx0XHRjaGFydFRhYk9mZnNldCA9IHRoYXQuJGNoYXJ0VGFiLm9mZnNldCgpLFxuXHRcdFx0XHRcdG1hcmdpbkxlZnQgPSBwYXJzZUludCggbWFyZ2lucy5sZWZ0LCAxMCApLFxuXHRcdFx0XHRcdC8vZGlnIGludG8gTlZEMyBjaGFydCB0byBmaW5kIGJhY2tncm91bmQgcmVjdCB0aGF0IGhhcyB3aWR0aCBvZiB0aGUgYWN0dWFsIGNoYXJ0XG5cdFx0XHRcdFx0YmFja1JlY3RXaWR0aCA9IHBhcnNlSW50KCAkd3JhcC5maW5kKCBcIj4gZyA+IHJlY3RcIiApLmF0dHIoIFwid2lkdGhcIiApLCAxMCApLFxuXHRcdFx0XHRcdG9mZnNldERpZmYgPSB3cmFwT2Zmc2V0LnRvcCAtIGNoYXJ0VGFiT2Zmc2V0LnRvcCxcblx0XHRcdFx0XHQvL2VtcGlyaWMgb2Zmc2V0XG5cdFx0XHRcdFx0eFNjYWxlT2Zmc2V0ID0gMTAsXG5cdFx0XHRcdFx0eVNjYWxlT2Zmc2V0ID0gLTU7XG5cblx0XHRcdFx0Ly9mYWxsYmFjayBmb3Igc2NhdHRlciBwbG90IHdoZXJlIGJhY2tSZWN0V2lkdGggaGFzIG5vIHdpZHRoXG5cdFx0XHRcdGlmKCBpc05hTiggYmFja1JlY3RXaWR0aCApICkge1xuXHRcdFx0XHRcdGJhY2tSZWN0V2lkdGggPSBwYXJzZUludCggJChcIi5udi14Lm52LWF4aXMubnZkMy1zdmdcIikuZ2V0KDApLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLndpZHRoLCAxMCApO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhhdC4keEF4aXNTY2FsZVNlbGVjdG9yLmNzcyggeyBcInRvcFwiOiBvZmZzZXREaWZmICsgY2hhcnRIZWlnaHQsIFwibGVmdFwiOiBtYXJnaW5MZWZ0ICsgYmFja1JlY3RXaWR0aCArIHhTY2FsZU9mZnNldCB9ICk7XG5cdFx0XHRcdHRoYXQuJHlBeGlzU2NhbGVTZWxlY3Rvci5jc3MoIHsgXCJ0b3BcIjogb2Zmc2V0RGlmZiAtIDE1LCBcImxlZnRcIjogbWFyZ2luTGVmdCArIHlTY2FsZU9mZnNldCB9ICk7XG5cdFx0XHRcdFxuXHRcdFx0fSwgMjUwICk7XG5cdFx0XHRcblx0XHR9XG5cblx0fSk7XG5cdFxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5DaGFydFZpZXc7XG5cbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgQXBwID0gcmVxdWlyZSggXCIuLy4uL25hbWVzcGFjZXMuanNcIiApLFxuXHRcdEZvcm1WaWV3ID0gcmVxdWlyZSggXCIuL0FwcC5WaWV3cy5Gb3JtVmlldy5qc1wiICksXG5cdFx0Q2hhcnRWaWV3ID0gcmVxdWlyZSggXCIuL0FwcC5WaWV3cy5DaGFydFZpZXcuanNcIiApLFxuXHRcdFZhcmlhYmxlU2VsZWN0cyA9IHJlcXVpcmUoIFwiLi91aS9BcHAuVmlld3MuVUkuVmFyaWFibGVTZWxlY3RzLmpzXCIgKTtcblxuXHRBcHAuVmlld3MuRm9ybSA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblxuXHRcdGV2ZW50czoge30sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbigpIHt9LFxuXG5cdFx0c3RhcnQ6IGZ1bmN0aW9uKCkge1xuXHRcdFx0Ly9yZW5kZXIgZXZlcnl0aGluZyBmb3IgdGhlIGZpcnN0IHRpbWVcblx0XHRcdHRoaXMucmVuZGVyKCk7XG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcblx0XHRcdHZhciBkaXNwYXRjaGVyID0gXy5jbG9uZSggQmFja2JvbmUuRXZlbnRzICk7XG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIgPSBkaXNwYXRjaGVyO1xuXG5cdFx0XHR0aGlzLmZvcm1WaWV3ID0gbmV3IEZvcm1WaWV3KCB7IGRpc3BhdGNoZXI6IGRpc3BhdGNoZXIgfSApO1xuXHRcdFx0dGhpcy5jaGFydFZpZXcgPSBuZXcgQ2hhcnRWaWV3KCB7IGRpc3BhdGNoZXI6IGRpc3BhdGNoZXIgfSApO1xuXHRcdFx0XG5cdFx0XHQvL3ZhcmlhYmxlIHNlbGVjdFxuXHRcdFx0dmFyIHZhcmlhYmxlU2VsZWN0cyA9IG5ldyBWYXJpYWJsZVNlbGVjdHMoKTtcblx0XHRcdHZhcmlhYmxlU2VsZWN0cy5pbml0KCk7XG5cdFx0XHRcblx0XHR9XG5cblx0fSk7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVmlld3MuRm9ybTtcblxufSkoKTtcbiIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIEFwcCA9IHJlcXVpcmUoIFwiLi8uLi9uYW1lc3BhY2VzLmpzXCIgKSxcblx0XHRDaGFydFZhcmlhYmxlc0NvbGxlY3Rpb24gPSByZXF1aXJlKCBcIi4vLi4vY29sbGVjdGlvbnMvQXBwLkNvbGxlY3Rpb25zLkNoYXJ0VmFyaWFibGVzQ29sbGVjdGlvbi5qc1wiICksXG5cdFx0QXZhaWxhYmxlRW50aXRpZXNDb2xsZWN0aW9uID0gcmVxdWlyZSggXCIuLy4uL2NvbGxlY3Rpb25zL0FwcC5Db2xsZWN0aW9ucy5BdmFpbGFibGVFbnRpdGllc0NvbGxlY3Rpb24uanNcIiApLFxuXHRcdENoYXJ0RGltZW5zaW9uc01vZGVsID0gcmVxdWlyZSggXCIuLy4uL21vZGVscy9BcHAuTW9kZWxzLkNoYXJ0RGltZW5zaW9uc01vZGVsLmpzXCIgKSxcblx0XHRBdmFpbGFibGVUaW1lTW9kZWwgPSByZXF1aXJlKCBcIi4vLi4vbW9kZWxzL0FwcC5Nb2RlbHMuQXZhaWxhYmxlVGltZU1vZGVsLmpzXCIgKSxcblx0XHRTZWFyY2hEYXRhQ29sbGVjdGlvbiA9IHJlcXVpcmUoIFwiLi8uLi9jb2xsZWN0aW9ucy9BcHAuQ29sbGVjdGlvbnMuU2VhcmNoRGF0YUNvbGxlY3Rpb24uanNcIiApLFxuXHRcdFxuXHRcdEJhc2ljVGFiVmlldyA9IHJlcXVpcmUoIFwiLi9mb3JtL0FwcC5WaWV3cy5Gb3JtLkJhc2ljVGFiVmlldy5qc1wiICksXG5cdFx0QXhpc1RhYlZpZXcgPSByZXF1aXJlKCBcIi4vZm9ybS9BcHAuVmlld3MuRm9ybS5BeGlzVGFiVmlldy5qc1wiICksXG5cdFx0RGVzY3JpcHRpb25UYWJWaWV3ID0gcmVxdWlyZSggXCIuL2Zvcm0vQXBwLlZpZXdzLkZvcm0uRGVzY3JpcHRpb25UYWJWaWV3LmpzXCIgKSxcblx0XHRTdHlsaW5nVGFiVmlldyA9IHJlcXVpcmUoIFwiLi9mb3JtL0FwcC5WaWV3cy5Gb3JtLlN0eWxpbmdUYWJWaWV3LmpzXCIgKSxcblx0XHRFeHBvcnRUYWJWaWV3ID0gcmVxdWlyZSggXCIuL2Zvcm0vQXBwLlZpZXdzLkZvcm0uRXhwb3J0VGFiVmlldy5qc1wiICksXG5cdFx0TWFwVGFiVmlldyA9IHJlcXVpcmUoIFwiLi9mb3JtL0FwcC5WaWV3cy5Gb3JtLk1hcFRhYlZpZXcuanNcIiApO1xuXG5cdEFwcC5WaWV3cy5Gb3JtVmlldyA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblxuXHRcdGVsOiBcIiNmb3JtLXZpZXdcIixcblx0XHRldmVudHM6IHtcblx0XHRcdFwiY2xpY2sgLmZvcm0tY29sbGFwc2UtYnRuXCI6IFwib25Gb3JtQ29sbGFwc2VcIixcblx0XHRcdFwiY2hhbmdlIGlucHV0W25hbWU9Y2hhcnQtbmFtZV1cIjogXCJvbk5hbWVDaGFuZ2VcIixcblx0XHRcdFwiY2hhbmdlIHRleHRhcmVhW25hbWU9Y2hhcnQtc3VibmFtZV1cIjogXCJvblN1Ym5hbWVDaGFuZ2VcIixcblx0XHRcdFwiY2xpY2sgLnJlbW92ZS11cGxvYWRlZC1maWxlLWJ0blwiOiBcIm9uUmVtb3ZlVXBsb2FkZWRGaWxlXCIsXG5cdFx0XHRcInN1Ym1pdCBmb3JtXCI6IFwib25Gb3JtU3VibWl0XCIsXG5cdFx0fSxcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0XG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIgPSBvcHRpb25zLmRpc3BhdGNoZXI7XG5cdFx0XHRcblx0XHRcdHZhciBmb3JtQ29uZmlnID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImZvcm0tY29uZmlnXCIgKTtcblxuXHRcdFx0Ly9jcmVhdGUgcmVsYXRlZCBtb2RlbHMsIGVpdGhlciBlbXB0eSAod2hlbiBjcmVhdGluZyBuZXcgY2hhcnQpLCBvciBwcmVmaWxsZWQgZnJvbSBkYiAod2hlbiBlZGl0aW5nIGV4aXN0aW5nIGNoYXJ0KVxuXHRcdFx0aWYoIGZvcm1Db25maWcgJiYgZm9ybUNvbmZpZ1sgXCJ2YXJpYWJsZXMtY29sbGVjdGlvblwiIF0gKSB7XG5cdFx0XHRcdEFwcC5DaGFydFZhcmlhYmxlc0NvbGxlY3Rpb24gPSBuZXcgQ2hhcnRWYXJpYWJsZXNDb2xsZWN0aW9uKCBmb3JtQ29uZmlnWyBcInZhcmlhYmxlcy1jb2xsZWN0aW9uXCIgXSApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0QXBwLkNoYXJ0VmFyaWFibGVzQ29sbGVjdGlvbiA9IG5ldyBDaGFydFZhcmlhYmxlc0NvbGxlY3Rpb24oKTtcblx0XHRcdH1cblx0XHRcdGlmKCBmb3JtQ29uZmlnICYmIGZvcm1Db25maWdbIFwiZW50aXRpZXMtY29sbGVjdGlvblwiIF0gKSB7XG5cdFx0XHRcdEFwcC5BdmFpbGFibGVFbnRpdGllc0NvbGxlY3Rpb24gPSBuZXcgQXZhaWxhYmxlRW50aXRpZXNDb2xsZWN0aW9uKCBmb3JtQ29uZmlnWyBcImVudGl0aWVzLWNvbGxlY3Rpb25cIiBdICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRBcHAuQXZhaWxhYmxlRW50aXRpZXNDb2xsZWN0aW9uID0gbmV3IEF2YWlsYWJsZUVudGl0aWVzQ29sbGVjdGlvbigpO1xuXHRcdFx0fVxuXHRcdFx0aWYoIGZvcm1Db25maWcgJiYgZm9ybUNvbmZpZ1sgXCJkaW1lbnNpb25zXCIgXSApIHtcblx0XHRcdFx0QXBwLkNoYXJ0RGltZW5zaW9uc01vZGVsID0gbmV3IENoYXJ0RGltZW5zaW9uc01vZGVsKCk7XG5cdFx0XHRcdC8vQXBwLkNoYXJ0RGltZW5zaW9uc01vZGVsID0gbmV3IEFwcC5Nb2RlbHMuQ2hhcnREaW1lbnNpb25zTW9kZWwoIGZvcm1Db25maWdbIFwiZGltZW5zaW9uc1wiIF0gKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdEFwcC5DaGFydERpbWVuc2lvbnNNb2RlbCA9IG5ldyBDaGFydERpbWVuc2lvbnNNb2RlbCgpO1xuXHRcdFx0fVxuXHRcdFx0aWYoIGZvcm1Db25maWcgJiYgZm9ybUNvbmZpZ1sgXCJhdmFpbGFibGUtdGltZVwiIF0gKSB7XG5cdFx0XHRcdEFwcC5BdmFpbGFibGVUaW1lTW9kZWwgPSBuZXcgQXZhaWxhYmxlVGltZU1vZGVsKGZvcm1Db25maWdbIFwiYXZhaWxhYmxlLXRpbWVcIiBdKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdEFwcC5BdmFpbGFibGVUaW1lTW9kZWwgPSBuZXcgQXZhaWxhYmxlVGltZU1vZGVsKCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vY3JlYXRlIHNlYXJjaCBjb2xsZWN0aW9uXG5cdFx0XHRBcHAuU2VhcmNoRGF0YUNvbGxlY3Rpb24gPSBuZXcgU2VhcmNoRGF0YUNvbGxlY3Rpb24oKTtcblx0XHRcdFxuXHRcdFx0Ly9pcyBpdCBuZXcgb3IgZXhpc3RpbmcgY2hhcnRcblx0XHRcdGlmKCBmb3JtQ29uZmlnICYmIGZvcm1Db25maWdbIFwiZGltZW5zaW9uc1wiIF0gKSB7XG5cdFx0XHRcdC8vZXhpc3RpbmcgY2hhcnQsIG5lZWQgdG8gbG9hZCBmcmVzaCBkaW1lbnNpb25zIGZyb20gZGF0YWJhc2UgKGluIGNhc2Ugd2UndmUgYWRkZWQgZGltZW5zaW9ucyBzaW5jZSBjcmVhdGluZyBjaGFydClcblx0XHRcdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdFx0XHRBcHAuQ2hhcnREaW1lbnNpb25zTW9kZWwubG9hZENvbmZpZ3VyYXRpb24oIGZvcm1Db25maWdbIFwiZGltZW5zaW9uc1wiIF0uaWQgKTtcblx0XHRcdFx0QXBwLkNoYXJ0RGltZW5zaW9uc01vZGVsLm9uKCBcImNoYW5nZVwiLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHR0aGF0LnJlbmRlcigpO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvL25ldyBjaGFydCwgY2FuIHJlbmRlciBzdHJhaWdodCBhd2F5XG5cdFx0XHRcdHRoaXMucmVuZGVyKCk7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdFxuXHRcdFx0Ly9jcmVhdGUgc3Vidmlld3Ncblx0XHRcdHRoaXMuYmFzaWNUYWJWaWV3ID0gbmV3IEJhc2ljVGFiVmlldyggeyBkaXNwYXRjaGVyOiB0aGlzLmRpc3BhdGNoZXIgfSApO1xuXHRcdFx0dGhpcy5heGlzVGFiVmlldyA9IG5ldyBBeGlzVGFiVmlldyggeyBkaXNwYXRjaGVyOiB0aGlzLmRpc3BhdGNoZXIgfSApO1xuXHRcdFx0dGhpcy5kZXNjcmlwdGlvblRhYlZpZXcgPSBuZXcgRGVzY3JpcHRpb25UYWJWaWV3KCB7IGRpc3BhdGNoZXI6IHRoaXMuZGlzcGF0Y2hlciB9ICk7XG5cdFx0XHR0aGlzLnN0eWxpbmdUYWJWaWV3ID0gbmV3IFN0eWxpbmdUYWJWaWV3KCB7IGRpc3BhdGNoZXI6IHRoaXMuZGlzcGF0Y2hlciB9ICk7XG5cdFx0XHR0aGlzLmV4cG9ydFRhYlZpZXcgPSBuZXcgRXhwb3J0VGFiVmlldyggeyBkaXNwYXRjaGVyOiB0aGlzLmRpc3BhdGNoZXIgfSApO1xuXHRcdFx0dGhpcy5tYXBUYWJWaWV3ID0gbmV3IE1hcFRhYlZpZXcoIHsgZGlzcGF0Y2hlcjogdGhpcy5kaXNwYXRjaGVyIH0gKTtcblxuXHRcdFx0Ly9mZXRjaCBkb21zXG5cdFx0XHR0aGlzLiRyZW1vdmVVcGxvYWRlZEZpbGVCdG4gPSB0aGlzLiRlbC5maW5kKCBcIi5yZW1vdmUtdXBsb2FkZWQtZmlsZS1idG5cIiApO1xuXHRcdFx0dGhpcy4kZmlsZVBpY2tlciA9IHRoaXMuJGVsLmZpbmQoIFwiLmZpbGUtcGlja2VyLXdyYXBwZXIgW3R5cGU9ZmlsZV1cIiApO1xuXG5cdFx0fSxcblxuXHRcdG9uTmFtZUNoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dmFyICRpbnB1dCA9ICQoIGV2dC50YXJnZXQgKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJjaGFydC1uYW1lXCIsICRpbnB1dC52YWwoKSApO1xuXG5cdFx0fSxcblxuXHRcdG9uU3VibmFtZUNoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dmFyICR0ZXh0YXJlYSA9ICQoIGV2dC50YXJnZXQgKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJjaGFydC1zdWJuYW1lXCIsICR0ZXh0YXJlYS52YWwoKSApO1xuXG5cdFx0fSxcblxuXHRcdG9uQ3N2U2VsZWN0ZWQ6IGZ1bmN0aW9uKCBlcnIsIGRhdGEgKSB7XG5cblx0XHRcdGlmKCBlcnIgKSB7XG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoIGVyciApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuJHJlbW92ZVVwbG9hZGVkRmlsZUJ0bi5zaG93KCk7XG5cblx0XHRcdGlmKCBkYXRhICYmIGRhdGEucm93cyApIHtcblx0XHRcdFx0dmFyIG1hcHBlZERhdGEgPSBBcHAuVXRpbHMubWFwRGF0YSggZGF0YS5yb3dzICk7XG5cdFx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJjaGFydC1kYXRhXCIsIG1hcHBlZERhdGEgKTtcblx0XHRcdH1cblxuXHRcdH0sXG5cblx0XHRvblJlbW92ZVVwbG9hZGVkRmlsZTogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dGhpcy4kZmlsZVBpY2tlci5yZXBsYWNlV2l0aCggdGhpcy4kZmlsZVBpY2tlci5jbG9uZSgpICk7XG5cdFx0XHQvL3JlZmV0Y2ggZG9tXG5cdFx0XHR0aGlzLiRmaWxlUGlja2VyID0gdGhpcy4kZWwuZmluZCggXCIuZmlsZS1waWNrZXItd3JhcHBlciBbdHlwZT1maWxlXVwiICk7XG5cdFx0XHR0aGlzLiRmaWxlUGlja2VyLnByb3AoIFwiZGlzYWJsZWRcIiwgZmFsc2UpO1xuXG5cdFx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0XHRDU1YuYmVnaW4oIHRoaXMuJGZpbGVQaWNrZXIuc2VsZWN0b3IgKS5nbyggZnVuY3Rpb24oIGVyciwgZGF0YSApIHtcblx0XHRcdFx0XHR0aGF0Lm9uQ3N2U2VsZWN0ZWQoIGVyciwgZGF0YSApO1xuXHRcdFx0fSApO1xuXG5cdFx0XHR0aGlzLiRyZW1vdmVVcGxvYWRlZEZpbGVCdG4uaGlkZSgpO1xuXG5cdFx0fSxcblxuXG5cdFx0b25Gb3JtQ29sbGFwc2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0dmFyICRwYXJlbnQgPSB0aGlzLiRlbC5wYXJlbnQoKTtcblx0XHRcdCRwYXJlbnQudG9nZ2xlQ2xhc3MoIFwiZm9ybS1wYW5lbC1jb2xsYXBzZWRcIiApO1xuXHRcdFx0XG5cdFx0XHQvL3RyaWdnZXIgcmUtcmVuZGVyaW5nIG9mIGNoYXJ0XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC50cmlnZ2VyKCBcImNoYW5nZVwiICk7XG5cdFx0XHQvL2Fsc28gdHJpZ2VyIGN1c3RvbSBldmVudCBzbyB0aGF0IG1hcCBjYW4gcmVzaXplXG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC50cmlnZ2VyKCBcInJlc2l6ZVwiICk7XG5cblx0XHR9LFxuXG5cdFx0b25Gb3JtU3VibWl0OiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0XG5cdFx0XHQkLmFqYXhTZXR1cCgge1xuXHRcdFx0XHRoZWFkZXJzOiB7ICdYLUNTUkYtVE9LRU4nOiAkKCdbbmFtZT1cIl90b2tlblwiXScpLnZhbCgpIH1cblx0XHRcdH0gKTtcblxuXHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cblx0XHRcdC8vcHV0IGFsbCBjaGFuZ2VzIHRvIGNoYXJ0IG1vZGVsXG5cdFx0XHR2YXIgZm9ybUNvbmZpZyA9IHtcblx0XHRcdFx0XCJ2YXJpYWJsZXMtY29sbGVjdGlvblwiOiBBcHAuQ2hhcnRWYXJpYWJsZXNDb2xsZWN0aW9uLnRvSlNPTigpLFxuXHRcdFx0XHRcImVudGl0aWVzLWNvbGxlY3Rpb25cIjogQXBwLkF2YWlsYWJsZUVudGl0aWVzQ29sbGVjdGlvbi50b0pTT04oKSxcblx0XHRcdFx0XCJkaW1lbnNpb25zXCI6IEFwcC5DaGFydERpbWVuc2lvbnNNb2RlbC50b0pTT04oKSxcblx0XHRcdFx0XCJhdmFpbGFibGUtdGltZVwiOiBBcHAuQXZhaWxhYmxlVGltZU1vZGVsLnRvSlNPTigpXG5cdFx0XHR9O1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0KCBcImZvcm0tY29uZmlnXCIsIGZvcm1Db25maWcsIHsgc2lsZW50OiB0cnVlIH0gKTtcblxuXHRcdFx0dmFyIGRpc3BhdGNoZXIgPSB0aGlzLmRpc3BhdGNoZXI7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5zYXZlKCB7fSwge1xuXHRcdFx0XHRzdWNjZXNzOiBmdW5jdGlvbiAoIG1vZGVsLCByZXNwb25zZSwgb3B0aW9ucyApIHtcblx0XHRcdFx0XHRhbGVydCggXCJUaGUgY2hhcnQgc2F2ZWQgc3VjY2VzZnVsbHlcIiApO1xuXHRcdFx0XHRcdGRpc3BhdGNoZXIudHJpZ2dlciggXCJjaGFydC1zYXZlZFwiLCByZXNwb25zZS5kYXRhLmlkLCByZXNwb25zZS5kYXRhLnZpZXdVcmwgKTtcblx0XHRcdFx0XHQvL3VwZGF0ZSBpZCBvZiBhbiBleGlzdGluZyBtb2RlbFxuXHRcdFx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJpZFwiLCByZXNwb25zZS5kYXRhLmlkICk7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGVycm9yOiBmdW5jdGlvbiAobW9kZWwsIHhociwgb3B0aW9ucykge1xuXHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoXCJTb21ldGhpbmcgd2VudCB3cm9uZyB3aGlsZSBzYXZpbmcgdGhlIG1vZGVsXCIsIHhociApO1xuXHRcdFx0XHRcdGFsZXJ0KCBcIk9wcHMsIHRoZXJlIHdhcyBhIHByb2JsZW0gc2F2aW5nIHlvdXIgY2hhcnQuXCIgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHR9XG5cblx0fSk7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVmlld3MuRm9ybVZpZXc7XG5cbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgQXBwID0gcmVxdWlyZSggXCIuLy4uLy4uL25hbWVzcGFjZXMuanNcIiApLFxuXHRcdExlZ2VuZCA9IHJlcXVpcmUoIFwiLi9BcHAuVmlld3MuQ2hhcnQuTGVnZW5kXCIgKTtcblxuXHRBcHAuVmlld3MuQ2hhcnQuQ2hhcnRUYWIgPSBCYWNrYm9uZS5WaWV3LmV4dGVuZCgge1xuXG5cdFx0Y2FjaGVkQ29sb3JzOiBbXSxcblx0XHRlbDogXCIjY2hhcnQtdmlld1wiLFxuXHRcdGV2ZW50czoge1xuXHRcdFx0XCJjaGFuZ2UgW25hbWU9YXZhaWxhYmxlX2VudGl0aWVzXVwiOiBcIm9uQXZhaWxhYmxlQ291bnRyaWVzXCJcblx0XHR9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cblx0XHRcdHRoaXMuZGlzcGF0Y2hlciA9IG9wdGlvbnMuZGlzcGF0Y2hlcjtcblx0XHRcdHRoaXMucGFyZW50VmlldyA9IG9wdGlvbnMucGFyZW50VmlldztcblxuXHRcdFx0dGhpcy4kc3ZnID0gdGhpcy4kZWwuZmluZCggXCIjY2hhcnQtY2hhcnQtdGFiIHN2Z1wiICk7XG5cdFx0XHR0aGlzLiRlbnRpdGllc1NlbGVjdCA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9YXZhaWxhYmxlX2VudGl0aWVzXVwiICk7XG5cdFx0XHRcblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbiggZGF0YSwgdGltZVR5cGUsIGRpbWVuc2lvbnMgKSB7XG5cdFx0XHRcblx0XHRcdGlmKCAhZGF0YSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cblx0XHRcdC8vbWFrZSBsb2NhbCBjb3B5IG9mIGRhdGEgZm9yIG91ciBmaWx0ZXJpbmcgbmVlZHNcblx0XHRcdHZhciBsb2NhbERhdGEgPSAkLmV4dGVuZCggdHJ1ZSwgbG9jYWxEYXRhLCBkYXRhICk7XG5cblx0XHRcdHZhciBjaGFydFR5cGUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdHlwZVwiICk7XG5cblx0XHRcdC8vZmlsdGVyIGRhdGEgZm9yIHNlbGVjdGVkIGNvdW50cmllc1xuXHRcdFx0dmFyIHNlbGVjdGVkQ291bnRyaWVzID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcInNlbGVjdGVkLWNvdW50cmllc1wiICksXG5cdFx0XHRcdHNlbGVjdGVkQ291bnRyaWVzQnlJZCA9IFtdLFxuXHRcdFx0XHRzZWxlY3RlZENvdW50cmllc0lkcyA9IF8ubWFwKCBzZWxlY3RlZENvdW50cmllcywgZnVuY3Rpb24odikge1xuXHRcdFx0XHRcdC8vc3RvcmUgXG5cdFx0XHRcdFx0c2VsZWN0ZWRDb3VudHJpZXNCeUlkWyB2LmlkIF0gPSB2O1xuXHRcdFx0XHRcdHJldHVybiArdi5pZDtcblx0XHRcdFx0fSApO1xuXG5cdFx0XHRpZiggc2VsZWN0ZWRDb3VudHJpZXMgJiYgc2VsZWN0ZWRDb3VudHJpZXNJZHMubGVuZ3RoICYmICFBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiZ3JvdXAtYnktdmFyaWFibGVzXCIgKSApIHtcblx0XHRcdFx0XG5cdFx0XHRcdC8vc2V0IGxvY2FsIGNvcHkgb2YgY291bnRyaWVzIGNvbG9yLCB0byBiZSBhYmxlIHRvIGNyZWF0ZSBicmlnaHRlclxuXHRcdFx0XHR2YXIgY291bnRyaWVzQ29sb3JzID0gW107XG5cdFx0XHRcdGxvY2FsRGF0YSA9IF8uZmlsdGVyKCBsb2NhbERhdGEsIGZ1bmN0aW9uKCB2YWx1ZSwga2V5LCBsaXN0ICkge1xuXHRcdFx0XHRcdC8vc2V0IGNvbG9yIHdoaWxlIGluIHRoZSBsb29wXG5cdFx0XHRcdFx0dmFyIGlkID0gdmFsdWUuaWQ7XG5cdFx0XHRcdFx0Ly9uZWVkIHRvIGNoZWNrIGZvciBzcGVjaWFsIGNhc2UsIHdoZW4gd2UgaGF2ZSBtb3JlIHZhcmlhYmxlcyBmb3IgdGhlIHNhbWUgY291bnRyaWVzICh0aGUgaWRzIHdpbGwgYmUgdGhlbiAyMS0xLCAyMi0xLCBldGMuKVxuXHRcdFx0XHRcdGlmKCBpZC5pbmRleE9mKCBcIi1cIiApID4gMCApIHtcblx0XHRcdFx0XHRcdGlkID0gcGFyc2VJbnQoIGlkLnNwbGl0KCBcIi1cIiApWyAwIF0sIDEwICk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGlkID0gcGFyc2VJbnQoIGlkLCAxMCApO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHZhciBjb3VudHJ5ID0gc2VsZWN0ZWRDb3VudHJpZXNCeUlkWyBpZCBdO1xuXHRcdFx0XHRcdGlmKCBjb3VudHJ5ICYmIGNvdW50cnkuY29sb3IgKSB7XG5cdFx0XHRcdFx0XHRpZiggIWNvdW50cmllc0NvbG9yc1sgaWQgXSApIHtcblx0XHRcdFx0XHRcdFx0Y291bnRyaWVzQ29sb3JzWyBpZCBdID0gY291bnRyeS5jb2xvcjtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdC8vdGhlcmUgaXMgYWxyZWFkeSBjb2xvciBmb3IgY291bnRyeSAobXVsdGl2YXJpYW50IGRhdGFzZXQpIC0gY3JlYXRlIGJyaWdodGVyIGNvbG9yXG5cdFx0XHRcdFx0XHRcdGNvdW50cmllc0NvbG9yc1sgaWQgXSA9IGQzLnJnYiggY291bnRyaWVzQ29sb3JzWyBpZCBdICkuYnJpZ2h0ZXIoIDEgKS50b1N0cmluZygpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0dmFsdWUuY29sb3IgPSBjb3VudHJpZXNDb2xvcnNbIGlkIF07XG5cblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dmFsdWUgPSB0aGF0LmFzc2lnbkNvbG9yRnJvbUNhY2hlKCB2YWx1ZSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcblx0XHRcdFx0XHQvL2FjdHVhbCBmaWx0ZXJpbmdcblx0XHRcdFx0XHRyZXR1cm4gKCBfLmluZGV4T2YoIHNlbGVjdGVkQ291bnRyaWVzSWRzLCBpZCApID4gLTEgKTtcblx0XHRcdFx0fSApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly9UT0RPIC0gbm9uc2Vuc2U/IGNvbnZlcnQgYXNzb2NpYXRpdmUgYXJyYXkgdG8gYXJyYXksIGFzc2lnbiBjb2xvcnMgZnJvbSBjYWNoZVxuXHRcdFx0XHRsb2NhbERhdGEgPSBfLm1hcCggbG9jYWxEYXRhLCBmdW5jdGlvbiggdmFsdWUgKSB7XG5cdFx0XHRcdFx0dmFsdWUgPSB0aGF0LmFzc2lnbkNvbG9yRnJvbUNhY2hlKCB2YWx1ZSApO1xuXHRcdFx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHRcdFx0fSApO1xuXHRcdFx0fVxuXG5cdFx0XHR2YXIgZGlzY3JldGVEYXRhO1xuXHRcdFx0aWYoIGNoYXJ0VHlwZSA9PSBcIjZcIiApIHtcblx0XHRcdFx0dmFyIGZsYXR0ZW5WYWx1ZXMgPSBfLm1hcCggbG9jYWxEYXRhLCBmdW5jdGlvbiggdiApIHtcblx0XHRcdFx0XHRpZiggdiAmJiB2LmNvbG9yICkge1xuXHRcdFx0XHRcdFx0di52YWx1ZXNbIDAgXS5jb2xvciA9IHYuY29sb3I7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiB2LnZhbHVlc1swXTtcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRkaXNjcmV0ZURhdGEgPSBbeyBrZXk6IFwidmFyaWFibGVcIiwgdmFsdWVzOiBmbGF0dGVuVmFsdWVzIH1dO1xuXHRcdFx0XHRsb2NhbERhdGEgPSBkaXNjcmV0ZURhdGE7XG5cdFx0XHR9XG5cblx0XHRcdC8vZmlsdGVyIGJ5IGNoYXJ0IHRpbWVcblx0XHRcdHZhciBjaGFydFRpbWUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdGltZVwiICk7XG5cdFx0XHRpZiggY2hhcnRUaW1lICYmIGNoYXJ0VGltZS5sZW5ndGggPT0gMiApIHtcblx0XHRcdFx0XG5cdFx0XHRcdHZhciB0aW1lRnJvbSA9IGNoYXJ0VGltZVsgMCBdLFxuXHRcdFx0XHRcdHRpbWVUbyA9IGNoYXJ0VGltZVsgMSBdO1xuXHRcdFx0XHRcblx0XHRcdFx0Xy5lYWNoKCBsb2NhbERhdGEsIGZ1bmN0aW9uKCBzaW5nbGVEYXRhLCBrZXksIGxpc3QgKSB7XG5cdFx0XHRcdFx0dmFyIHZhbHVlcyA9IF8uY2xvbmUoIHNpbmdsZURhdGEudmFsdWVzICk7XG5cdFx0XHRcdFx0dmFsdWVzID0gXy5maWx0ZXIoIHZhbHVlcywgZnVuY3Rpb24oIHZhbHVlICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuICggcGFyc2VJbnQoIHZhbHVlLnRpbWUsIDEwICkgPj0gdGltZUZyb20gJiYgcGFyc2VJbnQoIHZhbHVlLnRpbWUsIDEwICkgPD0gdGltZVRvICk7XG5cdFx0XHRcdFx0XHQvL3JldHVybiAoIHZhbHVlLnggPj0gdGltZUZyb20gJiYgdmFsdWUueCA8PSB0aW1lVG8gKTtcblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0c2luZ2xlRGF0YS52YWx1ZXMgPSB2YWx1ZXM7XG5cdFx0XHRcdH0gKTtcblxuXHRcdFx0fVxuXG5cdFx0XHQvL2lmIGxlZ2VuZCBkaXNwbGF5ZWQsIHNvcnQgZGF0YSBvbiBrZXkgYWxwaGFiZXRpY2FsbHkgKHVzZWZ1bGwgd2hlbiBtdWx0aXZhcmlhbiBkYXRhc2V0KVxuXHRcdFx0aWYoICFBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiaGlkZS1sZWdlbmRcIiApICkge1xuXHRcdFx0XHRsb2NhbERhdGEgPSBfLnNvcnRCeSggbG9jYWxEYXRhLCBmdW5jdGlvbiggb2JqICkgeyByZXR1cm4gb2JqLmtleTsgfSApO1xuXHRcdFx0fVxuXG5cdFx0XHQvL2dldCBheGlzIGNvbmZpZ3Ncblx0XHRcdHZhciB4QXhpcyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJ4LWF4aXNcIiApLFxuXHRcdFx0XHR5QXhpcyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJ5LWF4aXNcIiApLFxuXHRcdFx0XHR4QXhpc1ByZWZpeCA9ICggeEF4aXNbIFwiYXhpcy1wcmVmaXhcIiBdIHx8IFwiXCIgKSxcblx0XHRcdFx0eEF4aXNTdWZmaXggPSAoIHhBeGlzWyBcImF4aXMtc3VmZml4XCIgXSB8fCBcIlwiICksXG5cdFx0XHRcdHlBeGlzUHJlZml4ID0gKCB5QXhpc1sgXCJheGlzLXByZWZpeFwiIF0gfHwgXCJcIiApLFxuXHRcdFx0XHR5QXhpc1N1ZmZpeCA9ICggeUF4aXNbIFwiYXhpcy1zdWZmaXhcIiBdIHx8IFwiXCIgKSxcblx0XHRcdFx0eEF4aXNMYWJlbERpc3RhbmNlID0gKCAreEF4aXNbIFwiYXhpcy1sYWJlbC1kaXN0YW5jZVwiIF0gfHwgMCApLFxuXHRcdFx0XHR5QXhpc0xhYmVsRGlzdGFuY2UgPSAoICt5QXhpc1sgXCJheGlzLWxhYmVsLWRpc3RhbmNlXCIgXSB8fCAwICksXG5cdFx0XHRcdHhBeGlzTWluID0gKCB4QXhpc1sgXCJheGlzLW1pblwiIF0gfHwgbnVsbCApLFxuXHRcdFx0XHR4QXhpc01heCA9ICggeEF4aXNbIFwiYXhpcy1tYXhcIiBdIHx8IG51bGwgKSxcblx0XHRcdFx0eUF4aXNNaW4gPSAoIHlBeGlzWyBcImF4aXMtbWluXCIgXSB8fCAwICksXG5cdFx0XHRcdHlBeGlzTWF4ID0gKCB5QXhpc1sgXCJheGlzLW1heFwiIF0gfHwgbnVsbCApLFxuXHRcdFx0XHR4QXhpc1NjYWxlID0gKCB4QXhpc1sgXCJheGlzLXNjYWxlXCIgXSB8fCBcImxpbmVhclwiICksXG5cdFx0XHRcdHlBeGlzU2NhbGUgPSAoIHlBeGlzWyBcImF4aXMtc2NhbGVcIiBdIHx8IFwibGluZWFyXCIgKSxcblx0XHRcdFx0eEF4aXNGb3JtYXQgPSAoIHhBeGlzWyBcImF4aXMtZm9ybWF0XCIgXSB8fCAwICksXG5cdFx0XHRcdHlBeGlzRm9ybWF0ID0gKCB5QXhpc1sgXCJheGlzLWZvcm1hdFwiIF0gfHwgMCApO1xuXG5cdFx0XHRudi5hZGRHcmFwaChmdW5jdGlvbigpIHtcblxuXHRcdFx0XHR2YXIgY2hhcnRPcHRpb25zID0ge1xuXHRcdFx0XHRcdHRyYW5zaXRpb25EdXJhdGlvbjogMzAwLFxuXHRcdFx0XHRcdG1hcmdpbjogeyB0b3A6MCwgbGVmdDo1MCwgcmlnaHQ6MzAsIGJvdHRvbTowIH0sLy8gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcIm1hcmdpbnNcIiApLFxuXHRcdFx0XHRcdHNob3dMZWdlbmQ6IGZhbHNlXG5cdFx0XHRcdH07XG5cblx0XHRcdFx0Ly9saW5lIHR5cGVcblx0XHRcdFx0dmFyIGxpbmVUeXBlID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImxpbmUtdHlwZVwiICk7XG5cdFx0XHRcdGlmKCBsaW5lVHlwZSA9PSAyICkge1xuXHRcdFx0XHRcdGNoYXJ0T3B0aW9ucy5kZWZpbmVkID0gZnVuY3Rpb24oIGQgKSB7IHJldHVybiBkLnkgIT09IDA7IH07XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYoIGxpbmVUeXBlID09IDAgKSB7XG5cdFx0XHRcdFx0dGhhdC4kZWwuYWRkQ2xhc3MoIFwibGluZS1kb3RzXCIgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGF0LiRlbC5yZW1vdmVDbGFzcyggXCJsaW5lLWRvdHNcIiApO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly9kZXBlbmRpbmcgb24gY2hhcnQgdHlwZSBjcmVhdGUgY2hhcnRcblx0XHRcdFx0aWYoIGNoYXJ0VHlwZSA9PSBcIjFcIiApIHtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHQvL2xpbmUgY2hhcnRcblx0XHRcdFx0XHR0aGF0LmNoYXJ0ID0gbnYubW9kZWxzLmxpbmVDaGFydCgpLm9wdGlvbnMoIGNoYXJ0T3B0aW9ucyApO1xuXHRcdFx0XHRcblx0XHRcdFx0fSBlbHNlIGlmKCBjaGFydFR5cGUgPT0gXCIyXCIgKSB7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0Ly9zY2F0dGVyIHBsb3Rcblx0XHRcdFx0XHR2YXIgcG9pbnRzID0gdGhhdC5zY2F0dGVyQnViYmxlU2l6ZSgpO1xuXHRcdFx0XHRcdHRoYXQuY2hhcnQgPSBudi5tb2RlbHMuc2NhdHRlckNoYXJ0KCkub3B0aW9ucyggY2hhcnRPcHRpb25zICkucG9pbnRSYW5nZSggcG9pbnRzICkuc2hvd0Rpc3RYKCB0cnVlICkuc2hvd0Rpc3RZKCB0cnVlICk7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdH0gZWxzZSBpZiggY2hhcnRUeXBlID09IFwiM1wiICkge1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdC8vc3RhY2tlZCBhcmVhIGNoYXJ0XG5cdFx0XHRcdFx0Ly93ZSBuZWVkIHRvIG1ha2Ugc3VyZSB3ZSBoYXZlIGFzIG11Y2ggZGF0YSBhcyBuZWNlc3Nhcnlcblx0XHRcdFx0XHRpZiggbG9jYWxEYXRhLmxlbmd0aCApIHtcblx0XHRcdFx0XHRcdHZhciBiYXNlU2VyaWVzID0gbG9jYWxEYXRhWzBdO1xuXHRcdFx0XHRcdFx0Xy5lYWNoKCBsb2NhbERhdGEsIGZ1bmN0aW9uKCBzZXJpZSwgaSApIHtcblx0XHRcdFx0XHRcdFx0aWYoIGkgPiAwICkge1xuXHRcdFx0XHRcdFx0XHRcdC8vbWFrZSBzdXJlIHdlIGhhdmUgdmFsdWVzIGZvciBnaXZlbiBzZXJpZXNcblx0XHRcdFx0XHRcdFx0XHRpZiggc2VyaWUudmFsdWVzICYmICFzZXJpZS52YWx1ZXMubGVuZ3RoICkge1xuXHRcdFx0XHRcdFx0XHRcdFx0Ly9jbG9uZSBiYXNlIHNlcmllc1xuXHRcdFx0XHRcdFx0XHRcdFx0dmFyIGNvcHlWYWx1ZXMgPSBbXTtcblx0XHRcdFx0XHRcdFx0XHRcdCQuZXh0ZW5kKHRydWUsIGNvcHlWYWx1ZXMsIGJhc2VTZXJpZXMudmFsdWVzKTtcblx0XHRcdFx0XHRcdFx0XHRcdC8vbnVsbGlmeSB2YWx1ZXNcblx0XHRcdFx0XHRcdFx0XHRcdF8uZWFjaCggY29weVZhbHVlcywgZnVuY3Rpb24oIHYsIGkpIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0di55ID0gMDtcblx0XHRcdFx0XHRcdFx0XHRcdFx0di5mYWtlID0gXCJ0cnVlXCI7XG5cdFx0XHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdFx0XHRcdHNlcmllLnZhbHVlcyA9IGNvcHlWYWx1ZXM7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdGNoYXJ0T3B0aW9ucy5zaG93VG90YWxJblRvb2x0aXAgPSB0cnVlO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdHRoYXQuY2hhcnQgPSBudi5tb2RlbHMuc3RhY2tlZEFyZWFDaGFydCgpXG5cdFx0XHRcdFx0XHQub3B0aW9ucyggY2hhcnRPcHRpb25zIClcblx0XHRcdFx0XHRcdC5jb250cm9sT3B0aW9ucyggWyBcIlN0YWNrZWRcIiwgXCJFeHBhbmRlZFwiIF0gKVxuXHRcdFx0XHRcdFx0LnVzZUludGVyYWN0aXZlR3VpZGVsaW5lKCB0cnVlIClcblx0XHRcdFx0XHRcdC54KCBmdW5jdGlvbiggZCApIHsgcmV0dXJuIGRbIFwieFwiIF07IH0gKVxuXHRcdFx0XHRcdFx0LnkoIGZ1bmN0aW9uKCBkICkgeyByZXR1cm4gZFsgXCJ5XCIgXTsgfSApO1xuXHRcdFx0XG5cdFx0XHRcdH0gZWxzZSBpZiggY2hhcnRUeXBlID09IFwiNFwiIHx8IGNoYXJ0VHlwZSA9PSBcIjVcIiApIHtcblxuXHRcdFx0XHRcdC8vbXVsdGliYXIgY2hhcnRcblx0XHRcdFx0XHQvL3dlIG5lZWQgdG8gbWFrZSBzdXJlIHdlIGhhdmUgYXMgbXVjaCBkYXRhIGFzIG5lY2Vzc2FyeVxuXHRcdFx0XHRcdHZhciBhbGxUaW1lcyA9IFtdLFxuXHRcdFx0XHRcdFx0Ly9zdG9yZSB2YWx1ZXMgYnkgW2VudGl0eV1bdGltZV1cblx0XHRcdFx0XHRcdHZhbHVlc0NoZWNrID0gW107XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0Ly9leHRyYWN0IGFsbCB0aW1lc1xuXHRcdFx0XHRcdF8uZWFjaCggbG9jYWxEYXRhLCBmdW5jdGlvbiggdiwgaSApIHtcblx0XHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHR2YXIgZW50aXR5RGF0YSA9IFtdLFxuXHRcdFx0XHRcdFx0XHR0aW1lcyA9IHYudmFsdWVzLm1hcCggZnVuY3Rpb24oIHYyLCBpICkge1xuXHRcdFx0XHRcdFx0XHRcdGVudGl0eURhdGFbIHYyLnggXSA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHYyLng7XG5cdFx0XHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHRcdHZhbHVlc0NoZWNrWyB2LmlkIF0gPSBlbnRpdHlEYXRhO1xuXHRcdFx0XHRcdFx0YWxsVGltZXMgPSBhbGxUaW1lcy5jb25jYXQoIHRpbWVzICk7XG5cdFx0XHRcdFx0XHRcblx0XHRcdFx0XHR9ICk7XG5cblx0XHRcdFx0XHRhbGxUaW1lcyA9IF8udW5pcSggYWxsVGltZXMgKTtcblx0XHRcdFx0XHRhbGxUaW1lcyA9IF8uc29ydEJ5KCBhbGxUaW1lcyApO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdGlmKCBsb2NhbERhdGEubGVuZ3RoICkge1xuXHRcdFx0XHRcdFx0Xy5lYWNoKCBsb2NhbERhdGEsIGZ1bmN0aW9uKCBzZXJpZSwgc2VyaWVJbmRleCApIHtcblx0XHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHRcdC8vbWFrZSBzdXJlIHdlIGhhdmUgdmFsdWVzIGZvciBnaXZlbiBzZXJpZXNcblx0XHRcdFx0XHRcdFx0Xy5lYWNoKCBhbGxUaW1lcywgZnVuY3Rpb24oIHRpbWUsIHRpbWVJbmRleCApIHtcblx0XHRcdFx0XHRcdFx0XHRpZiggdmFsdWVzQ2hlY2tbIHNlcmllLmlkIF0gJiYgIXZhbHVlc0NoZWNrWyBzZXJpZS5pZCBdWyB0aW1lIF0gKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHQvL3RpbWUgZG9lc24ndCBleGlzdGlnIGZvciBnaXZlbiBlbnRpdHksIGluc2VydCB6ZXJvIHZhbHVlXG5cdFx0XHRcdFx0XHRcdFx0XHR2YXIgemVyb09iaiA9IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XCJrZXlcIjogc2VyaWUua2V5LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcInNlcmllXCI6IHNlcmllSW5kZXgsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFwidGltZVwiOiB0aW1lLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcInhcIjogdGltZSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XCJ5XCI6IDAsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFwiZmFrZVwiOiB0cnVlXG5cdFx0XHRcdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdFx0XHRcdFx0c2VyaWUudmFsdWVzLnNwbGljZSggdGltZUluZGV4LCAwLCB6ZXJvT2JqICk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0XHRcdFxuXHRcdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmKCBjaGFydFR5cGUgPT0gXCI0XCIgKSB7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHR0aGF0LmNoYXJ0ID0gbnYubW9kZWxzLm11bHRpQmFyQ2hhcnQoKS5vcHRpb25zKCBjaGFydE9wdGlvbnMgKTtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHR9IGVsc2UgaWYoICBjaGFydFR5cGUgPT0gXCI1XCIgKSB7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHR0aGF0LmNoYXJ0ID0gbnYubW9kZWxzLm11bHRpQmFySG9yaXpvbnRhbENoYXJ0KCkub3B0aW9ucyggY2hhcnRPcHRpb25zICk7Ly8uc2hvd1ZhbHVlcyggdHJ1ZSApO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHR9IGVsc2UgaWYoIGNoYXJ0VHlwZSA9PSBcIjZcIiApIHtcblxuXHRcdFx0XHRcdGNoYXJ0T3B0aW9ucy5zaG93VmFsdWVzID0gdHJ1ZTtcblxuXHRcdFx0XHRcdHRoYXQuY2hhcnQgPSBudi5tb2RlbHMuZGlzY3JldGVCYXJDaGFydCgpXG5cdFx0XHRcdFx0XHQueCggZnVuY3Rpb24oIGQgKSB7IHJldHVybiBkLng7IH0gKVxuXHRcdFx0XHRcdFx0LnkoIGZ1bmN0aW9uKCBkICkgeyByZXR1cm4gZC55OyB9IClcblx0XHRcdFx0XHRcdC5vcHRpb25zKCBjaGFydE9wdGlvbnMgKTtcblxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly9maXhlZCBwcm9iYWJseSBhIGJ1ZyBpbiBudmQzIHdpdGggcHJldmlvdXMgdG9vbHRpcCBub3QgYmVpbmcgcmVtb3ZlZFxuXHRcdFx0XHRkMy5zZWxlY3QoIFwiLnh5LXRvb2x0aXBcIiApLnJlbW92ZSgpO1xuXG5cdFx0XHRcdHRoYXQuY2hhcnQueEF4aXNcblx0XHRcdFx0XHQuYXhpc0xhYmVsKCB4QXhpc1sgXCJheGlzLWxhYmVsXCIgXSApXG5cdFx0XHRcdFx0Ly8uc3RhZ2dlckxhYmVscyggdHJ1ZSApXG5cdFx0XHRcdFx0LmF4aXNMYWJlbERpc3RhbmNlKCB4QXhpc0xhYmVsRGlzdGFuY2UgKVxuXHRcdFx0XHRcdC50aWNrRm9ybWF0KCBmdW5jdGlvbihkKSB7XG5cdFx0XHRcdFx0XHRpZiggY2hhcnRUeXBlICE9IDIgKSB7XG5cdFx0XHRcdFx0XHRcdC8veCBheGlzIGhhcyB0aW1lIGluZm9ybWF0aW9uXG5cdFx0XHRcdFx0XHRcdHJldHVybiBBcHAuVXRpbHMuZm9ybWF0VGltZUxhYmVsKCB0aW1lVHlwZSwgZCwgeEF4aXNQcmVmaXgsIHhBeGlzU3VmZml4LCB4QXhpc0Zvcm1hdCApO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0Ly9pcyBzY2F0dGVyIHBsb3QsIHgtYXhpcyBoYXMgc29tZSBvdGhlciBpbmZvcm1hdGlvblxuXHRcdFx0XHRcdFx0XHRyZXR1cm4geEF4aXNQcmVmaXggKyBkMy5mb3JtYXQoIFwiLFwiICkoIEFwcC5VdGlscy5mb3JtYXRWYWx1ZSggZCwgeEF4aXNGb3JtYXQgKSApICsgeEF4aXNTdWZmaXg7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSApO1xuXG5cdFx0XHRcdGlmKCB0aW1lVHlwZSA9PSBcIlF1YXJ0ZXIgQ2VudHVyeVwiICkge1xuXHRcdFx0XHRcdHRoYXQuY2hhcnQueEF4aXMuc3RhZ2dlckxhYmVscyggdHJ1ZSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdFxuXHRcdFx0XHQvL2dldCBleHRlbmRcblx0XHRcdFx0dmFyIGFsbFZhbHVlcyA9IFtdO1xuXHRcdFx0XHRfLmVhY2goIGxvY2FsRGF0YSwgZnVuY3Rpb24oIHYsIGkgKSB7XG5cdFx0XHRcdFx0aWYoIHYudmFsdWVzICkge1xuXHRcdFx0XHRcdFx0YWxsVmFsdWVzID0gYWxsVmFsdWVzLmNvbmNhdCggdi52YWx1ZXMgKTtcblx0XHRcdFx0XHR9IGVsc2UgaWYoICQuaXNBcnJheSggdiApICl7XG5cdFx0XHRcdFx0XHQvL3NwZWNpYWwgY2FzZSBmb3IgZGlzY3JldGUgYmFyIGNoYXJ0XG5cdFx0XHRcdFx0XHRhbGxWYWx1ZXMgPSB2O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSApO1xuXG5cdFx0XHRcdC8vZG9tYWluIHNldHVwXG5cdFx0XHRcdHZhciB4RG9tYWluID0gZDMuZXh0ZW50KCBhbGxWYWx1ZXMubWFwKCBmdW5jdGlvbiggZCApIHsgcmV0dXJuIGQueDsgfSApICksXG5cdFx0XHRcdFx0eURvbWFpbiA9IGQzLmV4dGVudCggYWxsVmFsdWVzLm1hcCggZnVuY3Rpb24oIGQgKSB7IHJldHVybiBkLnk7IH0gKSApLFxuXHRcdFx0XHRcdGlzQ2xhbXBlZCA9IGZhbHNlO1xuXG5cdFx0XHRcdC8vY29uc29sZS5sb2coIFwiY2hhcnQuc3RhY2tlZC5zdHlsZSgpXCIsIHRoYXQuY2hhcnQuc3RhY2tlZC5zdHlsZSgpICk7XG5cblx0XHRcdFx0aWYoIHhBeGlzTWluICYmICFpc05hTiggeEF4aXNNaW4gKSApIHtcblx0XHRcdFx0XHR4RG9tYWluWyAwIF0gPSB4QXhpc01pbjtcblx0XHRcdFx0XHRpc0NsYW1wZWQgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmKCB4QXhpc01heCAmJiAhaXNOYU4oIHhBeGlzTWF4ICkgKSB7XG5cdFx0XHRcdFx0eERvbWFpblsgMSBdID0geEF4aXNNYXg7XG5cdFx0XHRcdFx0aXNDbGFtcGVkID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiggeUF4aXNNaW4gJiYgIWlzTmFOKCB5QXhpc01pbiApICkge1xuXHRcdFx0XHRcdHlEb21haW5bIDAgXSA9IHlBeGlzTWluO1xuXHRcdFx0XHRcdGlzQ2xhbXBlZCA9IHRydWU7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly9kZWZhdWx0IGlzIHplcm8gKGRvbid0IGRvIGl0IGZvciBzdGFjayBiYXIgY2hhcnQsIG1lc3NlcyB1cCB0aGluZ3MpXG5cdFx0XHRcdFx0aWYoIGNoYXJ0VHlwZSAhPSBcIjNcIiApIHtcblx0XHRcdFx0XHRcdHlEb21haW5bIDAgXSA9IDA7XG5cdFx0XHRcdFx0XHRpc0NsYW1wZWQgPSB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiggeUF4aXNNYXggJiYgIWlzTmFOKCB5QXhpc01heCApICkge1xuXHRcdFx0XHRcdHlEb21haW5bIDEgXSA9IHlBeGlzTWF4O1xuXHRcdFx0XHRcdGlzQ2xhbXBlZCA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdC8vbWFudWFsbHkgY2xhbXAgdmFsdWVzXG5cdFx0XHRcdGlmKCBpc0NsYW1wZWQgKSB7XG5cblx0XHRcdFx0XHRpZiggY2hhcnRUeXBlICE9PSBcIjRcIiAmJiBjaGFydFR5cGUgIT09IFwiNVwiICYmIGNoYXJ0VHlwZSAhPT0gXCI2XCIgKSB7XG5cdFx0XHRcdFx0XHR0aGF0LmNoYXJ0LmZvcmNlWCggeERvbWFpbiApO1xuXHRcdFx0XHRcdFx0dGhhdC5jaGFydC5mb3JjZVkoIHlEb21haW4gKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvKnRoYXQuY2hhcnQueERvbWFpbiggeERvbWFpbiApO1xuXHRcdFx0XHRcdHRoYXQuY2hhcnQueURvbWFpbiggeURvbWFpbiApO1xuXHRcdFx0XHRcdHRoYXQuY2hhcnQueFNjYWxlKCkuY2xhbXAoIHRydWUgKTtcblx0XHRcdFx0XHR0aGF0LmNoYXJ0LnlTY2FsZSgpLmNsYW1wKCB0cnVlICk7Ki9cblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vc2V0IHNjYWxlcywgbXVsdGliYXIgY2hhcnRcblx0XHRcdFx0aWYoIHlBeGlzU2NhbGUgPT09IFwibGluZWFyXCIgKSB7XG5cdFx0XHRcdFx0dGhhdC5jaGFydC55U2NhbGUoIGQzLnNjYWxlLmxpbmVhcigpICk7XG5cdFx0XHRcdH0gZWxzZSBpZiggeUF4aXNTY2FsZSA9PT0gXCJsb2dcIiApIHtcblx0XHRcdFx0XHR0aGF0LmNoYXJ0LnlTY2FsZSggZDMuc2NhbGUubG9nKCkgKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmKCBjaGFydFR5cGUgPT09IFwiNFwiIHx8IGNoYXJ0VHlwZSA9PT0gXCI1XCIgKSB7XG5cdFx0XHRcdFx0Ly9mb3IgbXVsdGliYXIgY2hhcnQsIHggYXhpcyBoYXMgb3JkaW5hbCBzY2FsZSwgc28gbmVlZCB0byBzZXR1cCBkb21haW4gcHJvcGVybHlcblx0XHRcdFx0XHQvL3RoYXQuY2hhcnQueERvbWFpbiggZDMucmFuZ2UoeERvbWFpblswXSwgeERvbWFpblsxXSArIDEpICk7XG5cdFx0XHRcdFx0dGhhdC5jaGFydC54RG9tYWluKCBhbGxUaW1lcyApO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhhdC5jaGFydC55QXhpc1xuXHRcdFx0XHRcdC5heGlzTGFiZWwoIHlBeGlzWyBcImF4aXMtbGFiZWxcIiBdIClcblx0XHRcdFx0XHQuYXhpc0xhYmVsRGlzdGFuY2UoIHlBeGlzTGFiZWxEaXN0YW5jZSApXG5cdFx0XHRcdFx0LnRpY2tGb3JtYXQoIGZ1bmN0aW9uKGQpIHsgcmV0dXJuIHlBeGlzUHJlZml4ICsgZDMuZm9ybWF0KCBcIixcIiApKCBBcHAuVXRpbHMuZm9ybWF0VmFsdWUoIGQsIHlBeGlzRm9ybWF0ICkgKSArIHlBeGlzU3VmZml4OyB9KVxuXHRcdFx0XHRcdC5zaG93TWF4TWluKGZhbHNlKTtcblx0XHRcdFx0XG5cdFx0XHRcdC8vc2NhdHRlciBwbG90cyBuZWVkIG1vcmUgdGlja3Ncblx0XHRcdFx0aWYoIGNoYXJ0VHlwZSA9PT0gXCIyXCIgKSB7XG5cdFx0XHRcdFx0Ly9oYXJkY29kZVxuXHRcdFx0XHRcdHRoYXQuY2hhcnQueEF4aXMudGlja3MoIDcgKTtcblx0XHRcdFx0XHR0aGF0LmNoYXJ0LnlBeGlzLnRpY2tzKCA3ICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdHZhciBzdmdTZWxlY3Rpb24gPSBkMy5zZWxlY3QoIHRoYXQuJHN2Zy5zZWxlY3RvciApXG5cdFx0XHRcdFx0LmRhdHVtKCBsb2NhbERhdGEgKVxuXHRcdFx0XHRcdC5jYWxsKCB0aGF0LmNoYXJ0ICk7XG5cdFx0XHRcdFxuXHRcdFx0XHRpZiggY2hhcnRUeXBlICE9PSBcIjNcIiApIHtcblxuXHRcdFx0XHRcdHRoYXQuY2hhcnQudG9vbHRpcC5jb250ZW50R2VuZXJhdG9yKCBBcHAuVXRpbHMuY29udGVudEdlbmVyYXRvciApO1xuXG5cdFx0XHRcdH0gZWxzZSB7XG5cblx0XHRcdFx0XHQvL3NldCBwb3B1cFxuXHRcdFx0XHRcdHZhciB1bml0c1N0cmluZyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJ1bml0c1wiICksXG5cdFx0XHRcdFx0XHR1bml0cyA9ICggISQuaXNFbXB0eU9iamVjdCggdW5pdHNTdHJpbmcgKSApPyAkLnBhcnNlSlNPTiggdW5pdHNTdHJpbmcgKToge30sXG5cdFx0XHRcdFx0XHRzdHJpbmcgPSBcIlwiLFxuXHRcdFx0XHRcdFx0dmFsdWVzU3RyaW5nID0gXCJcIjtcblxuXHRcdFx0XHRcdC8vZDMuZm9ybWF0IHdpdGggYWRkZWQgcGFyYW1zIHRvIGFkZCBhcmJpdHJhcnkgc3RyaW5nIGF0IHRoZSBlbmRcblx0XHRcdFx0XHR2YXIgY3VzdG9tRm9ybWF0dGVyID0gZnVuY3Rpb24oIGZvcm1hdFN0cmluZywgc3VmZml4ICkge1xuXHRcdFx0XHRcdFx0dmFyIGZ1bmMgPSBkMy5mb3JtYXQoIGZvcm1hdFN0cmluZyApO1xuXHRcdFx0XHRcdFx0cmV0dXJuIGZ1bmN0aW9uKCBkLCBpICkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZnVuYyggZCApICsgc3VmZml4O1xuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR9O1xuXG5cdFx0XHRcdFx0Ly9kaWZmZXJlbnQgcG9wdXAgc2V0dXAgZm9yIHN0YWNrZWQgYXJlYSBjaGFydFxuXHRcdFx0XHRcdHZhciB1bml0ID0gXy5maW5kV2hlcmUoIHVuaXRzLCB7IHByb3BlcnR5OiBcInlcIiB9ICk7XG5cdFx0XHRcdFx0aWYoIHVuaXQgJiYgdW5pdC5mb3JtYXQgKSB7XG5cdFx0XHRcdFx0XHR2YXIgZml4ZWQgPSBNYXRoLm1pbiggMjAsIHBhcnNlSW50KCB1bml0LmZvcm1hdCwgMTAgKSApLFxuXHRcdFx0XHRcdFx0XHR1bml0TmFtZSA9ICggdW5pdC51bml0ICk/IFwiIFwiICsgdW5pdC51bml0OiBcIlwiO1xuXHRcdFx0XHRcdFx0dGhhdC5jaGFydC5pbnRlcmFjdGl2ZUxheWVyLnRvb2x0aXAudmFsdWVGb3JtYXR0ZXIoIGN1c3RvbUZvcm1hdHRlcihcIi5cIiArIGZpeGVkICsgXCJmXCIsIHVuaXROYW1lICkgKTtcblx0XHRcdFx0XHRcdC8vdGhhdC5jaGFydC5pbnRlcmFjdGl2ZUxheWVyLnRvb2x0aXAudmFsdWVGb3JtYXR0ZXIoIGQzLmZvcm1hdChcIi5cIiArIGZpeGVkICsgXCJmXCIgKSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0Ly9zZXQgbGVnZW5kXG5cdFx0XHRcdGlmKCAhQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImhpZGUtbGVnZW5kXCIgKSApIHtcblx0XHRcdFx0XHQvL21ha2Ugc3VyZSB3cmFwcGVyIGlzIHZpc2libGVcblx0XHRcdFx0XHR0aGF0LiRzdmcuZmluZCggXCI+IC5udmQzLm52LWN1c3RvbS1sZWdlbmRcIiApLnNob3coKTtcblx0XHRcdFx0XHR0aGF0LmxlZ2VuZCA9IG5ldyBMZWdlbmQoIHRoYXQuY2hhcnQubGVnZW5kICkudmVycyggXCJvd2RcIiApO1xuXHRcdFx0XHRcdHRoYXQubGVnZW5kLmRpc3BhdGNoLm9uKCBcInJlbW92ZUVudGl0eVwiLCBmdW5jdGlvbiggaWQgKSB7XG5cdFx0XHRcdFx0XHR0aGF0Lm9uUmVtb3ZlRW50aXR5KCBpZCApO1xuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHR0aGF0LmxlZ2VuZC5kaXNwYXRjaC5vbiggXCJhZGRFbnRpdHlcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRpZiggdGhhdC4kZW50aXRpZXNTZWxlY3QuZGF0YSggXCJjaG9zZW5cIiApICkge1xuXHRcdFx0XHRcdFx0XHR0aGF0LiRlbnRpdGllc1NlbGVjdC5kYXRhKCBcImNob3NlblwiICkuYWN0aXZlX2ZpZWxkID0gZmFsc2U7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHQvL3RyaWdnZXIgb3BlbiB0aGUgY2hvc2VuIGRyb3AgZG93blxuXHRcdFx0XHRcdFx0dGhhdC4kZW50aXRpZXNTZWxlY3QudHJpZ2dlciggXCJjaG9zZW46b3BlblwiICk7XG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdHN2Z1NlbGVjdGlvbi5jYWxsKCB0aGF0LmxlZ2VuZCApO1xuXHRcdFx0XHRcdC8vcHV0IGxlZ2VuZCBhYm92ZSBjaGFydFxuXG5cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvL25vIGxlZ2VuZCwgcmVtb3ZlIHdoYXQgbWlnaHQgaGF2ZSBwcmV2aW91c2x5IGJlZW4gdGhlcmVcblx0XHRcdFx0XHR0aGF0LiRzdmcuZmluZCggXCI+IC5udmQzLm52LWN1c3RvbS1sZWdlbmRcIiApLmhpZGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0dmFyIG9uUmVzaXplQ2FsbGJhY2sgPSBfLmRlYm91bmNlKCBmdW5jdGlvbihlKSB7XG5cdFx0XHRcdFx0Ly9pbnZva2UgcmVzaXplIG9mIGxlZ2VuZCwgaWYgdGhlcmUncyBvbmUsIHNjYXR0ZXIgcGxvdCBkb2Vzbid0IGhhdmUgYW55IGJ5IGRlZmF1bHRcblx0XHRcdFx0XHRpZiggdGhhdC5sZWdlbmQgKSB7XG5cdFx0XHRcdFx0XHRzdmdTZWxlY3Rpb24uY2FsbCggdGhhdC5sZWdlbmQgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dGhhdC5wYXJlbnRWaWV3Lm9uUmVzaXplKCk7XG5cdFx0XHRcdH0sIDE1MCApO1xuXHRcdFx0XHRudi51dGlscy53aW5kb3dSZXNpemUoIG9uUmVzaXplQ2FsbGJhY2sgKTtcblx0XHRcdFx0XHRcdFxuXHRcdFx0XHR0aGF0LnBhcmVudFZpZXcub25SZXNpemUoKTtcblxuXHRcdFx0XHR2YXIgc3RhdGVDaGFuZ2VFdmVudCA9ICggY2hhcnRUeXBlICE9PSBcIjZcIiApPyBcInN0YXRlQ2hhbmdlXCI6IFwicmVuZGVyRW5kXCI7XG5cdFx0XHRcdHRoYXQuY2hhcnQuZGlzcGF0Y2gub24oIHN0YXRlQ2hhbmdlRXZlbnQsIGZ1bmN0aW9uKCBzdGF0ZSApIHtcblx0XHRcdFx0XHQvL3JlZnJlc2ggbGVnZW5kO1xuXHRcdFx0XHRcdHN2Z1NlbGVjdGlvbi5jYWxsKCB0aGF0LmxlZ2VuZCApO1xuXG5cdFx0XHRcdFx0Ly9cblx0XHRcdFx0XHRpZiggY2hhcnRUeXBlID09PSBcIjNcIiApIHtcblx0XHRcdFx0XHRcdHRoYXQuY2hlY2tTdGFja2VkQXhpcygpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vVE9ETyAtIHVnbHkhIG5lZWRzIHRpbWVvdXQgYW5kIHJlYWNoaW5nIHRvIGNoYXJ0dmlldyAgXG5cdFx0XHRcdFx0c2V0VGltZW91dCggZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHR0aGF0LnBhcmVudFZpZXcub25SZXNpemUoKTtcblx0XHRcdFx0XHR9LCAxKTtcblx0XHRcdFx0fSApO1xuXHRcdFx0XHR0aGF0LnBhcmVudFZpZXcuZGF0YVRhYi5yZW5kZXIoIGRhdGEsIGxvY2FsRGF0YSwgZGltZW5zaW9ucyApO1xuXHRcdFx0XHRcblx0XHRcdFx0aWYoIGNoYXJ0VHlwZSA9PSBcIjJcIiApIHtcblx0XHRcdFx0XHQvL25lZWQgdG8gaGF2ZSBvd24gc2hvd0Rpc3QgaW1wbGVtZW50YXRpb24sIGNhdXNlIHRoZXJlJ3MgYSBidWcgaW4gbnZkM1xuXHRcdFx0XHRcdHRoYXQuc2NhdHRlckRpc3QoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0Ly9pZiB5IGF4aXMgaGFzIHplcm8sIGRpc3BsYXkgc29saWQgbGluZVxuXHRcdFx0XHR2YXIgJHBhdGhEb21haW4gPSAkKCBcIi5udmQzIC5udi1heGlzLm52LXggcGF0aC5kb21haW5cIiApO1xuXHRcdFx0XHRpZiggeURvbWFpblsgMCBdID09PSAwICkge1xuXHRcdFx0XHRcdCRwYXRoRG9tYWluLmNzcyggXCJzdHJva2Utb3BhY2l0eVwiLCBcIjFcIiApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdCRwYXRoRG9tYWluLmNzcyggXCJzdHJva2Utb3BhY2l0eVwiLCBcIjBcIiApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdFxuXHRcdFx0XHQvL3RoYXQuc2NhbGVTZWxlY3RvcnMuaW5pdEV2ZW50cygpO1xuXHRcdFx0XHR2YXIgY2hhcnREaW1lbnNpb25zU3RyaW5nID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LWRpbWVuc2lvbnNcIiApO1xuXHRcdFx0XHRpZiggY2hhcnREaW1lbnNpb25zU3RyaW5nLmluZGV4T2YoICdcInByb3BlcnR5XCI6XCJjb2xvclwiJyApID09PSAtMSApIHtcblx0XHRcdFx0XHQvL2NoZWNrIGlmIHN0cmluZyBkb2VzIG5vdCBjb250YWluIFwicHJvcGVydHlcIjpcImNvbG9yXCJcblx0XHRcdFx0XHR0aGF0LmNhY2hlQ29sb3JzKCBsb2NhbERhdGEgKTtcblx0XHRcdFx0fVxuXG5cdFx0XHR9KTtcblxuXHRcdH0sXG5cblx0XHRzY2F0dGVyRGlzdDogZnVuY3Rpb24oKSB7XG5cblx0XHRcdHZhciB0aGF0ID0gdGhpcyxcblx0XHRcdFx0bWFyZ2lucyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJtYXJnaW5zXCIgKSxcblx0XHRcdFx0bnZEaXN0clggPSAkKCBcIi5udi1kaXN0cmlidXRpb25YXCIgKS5vZmZzZXQoKS50b3AsXG5cdFx0XHRcdHN2Z1NlbGVjdGlvbiA9IGQzLnNlbGVjdCggXCJzdmdcIiApO1xuXG5cdFx0XHR0aGF0LmNoYXJ0LnNjYXR0ZXIuZGlzcGF0Y2gub24oJ2VsZW1lbnRNb3VzZW92ZXIudG9vbHRpcCcsIGZ1bmN0aW9uKGV2dCkge1xuXHRcdFx0XHR2YXIgc3ZnT2Zmc2V0ID0gdGhhdC4kc3ZnLm9mZnNldCgpLFxuXHRcdFx0XHRcdHN2Z0hlaWdodCA9IHRoYXQuJHN2Zy5oZWlnaHQoKTtcblx0XHRcdFx0c3ZnU2VsZWN0aW9uLnNlbGVjdCgnLm52LXNlcmllcy0nICsgZXZ0LnNlcmllc0luZGV4ICsgJyAubnYtZGlzdHgtJyArIGV2dC5wb2ludEluZGV4KVxuXHRcdFx0XHRcdC5hdHRyKCd5MScsIGV2dC5wb3MudG9wIC0gbnZEaXN0clggKTtcblx0XHRcdFx0c3ZnU2VsZWN0aW9uLnNlbGVjdCgnLm52LXNlcmllcy0nICsgZXZ0LnNlcmllc0luZGV4ICsgJyAubnYtZGlzdHktJyArIGV2dC5wb2ludEluZGV4KVxuXHRcdFx0XHRcdC5hdHRyKCd4MicsIGV2dC5wb3MubGVmdCAtIHN2Z09mZnNldC5sZWZ0IC0gbWFyZ2lucy5sZWZ0ICk7XG5cdFx0XHRcdHZhciBwb3NpdGlvbiA9IHtsZWZ0OiBkMy5ldmVudC5jbGllbnRYLCB0b3A6IGQzLmV2ZW50LmNsaWVudFkgfTtcblx0XHRcdFx0dGhhdC5jaGFydC50b29sdGlwLnBvc2l0aW9uKHBvc2l0aW9uKS5kYXRhKGV2dCkuaGlkZGVuKGZhbHNlKTtcblx0XHRcdH0pO1xuXG5cdFx0fSxcblxuXHRcdHNjYXR0ZXJCdWJibGVTaXplOiBmdW5jdGlvbigpIHtcblx0XHRcdC8vc2V0IHNpemUgb2YgdGhlIGJ1YmJsZXMgZGVwZW5kaW5nIG9uIGJyb3dzZXIgd2lkdGhcblx0XHRcdHZhciBicm93c2VyV2lkdGggPSAkKCB3aW5kb3cgKS53aWR0aCgpLFxuXHRcdFx0XHRicm93c2VyQ29lZiA9IE1hdGgubWF4KCAxLCBicm93c2VyV2lkdGggLyAxMTAwICksXG5cdFx0XHRcdHBvaW50TWluID0gMTAwICogTWF0aC5wb3coIGJyb3dzZXJDb2VmLCAyICksXG5cdFx0XHRcdHBvaW50TWF4ID0gMTAwMCAqIE1hdGgucG93KCBicm93c2VyQ29lZiwgMiApO1xuXHRcdFx0cmV0dXJuIFsgcG9pbnRNaW4sIHBvaW50TWF4IF07XG5cdFx0fSxcblxuXHRcdGNoZWNrU3RhY2tlZEF4aXM6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHQvL3NldHRpbmcgeUF4aXNNYXggYnJlYWtzIGV4cGFuZGVkIHN0YWNrZWQgY2hhcnQsIG5lZWQgdG8gY2hlY2sgbWFudWFsbHlcblx0XHRcdHZhciBzdGFja2VkU3R5bGUgPSB0aGlzLmNoYXJ0LnN0YWNrZWQuc3R5bGUoKSxcblx0XHRcdFx0eUF4aXMgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwieS1heGlzXCIgKSxcblx0XHRcdFx0eUF4aXNNaW4gPSAoIHlBeGlzWyBcImF4aXMtbWluXCIgXSB8fCAwICksXG5cdFx0XHRcdHlBeGlzTWF4ID0gKCB5QXhpc1sgXCJheGlzLW1heFwiIF0gfHwgbnVsbCApLFxuXHRcdFx0XHR5RG9tYWluID0gWyB5QXhpc01pbiwgeUF4aXNNYXggXTtcblx0XHRcdGlmKCB5QXhpc01heCApIHtcblx0XHRcdFx0Ly9jaGFydCBoYXMgc2V0IHlBeGlzIHRvIG1heCwgZGVwZW5kaW5nIG9uIHN0YWNrZWQgc3R5bGUgc2V0IG1heFxuXHRcdFx0XHRpZiggc3RhY2tlZFN0eWxlID09PSBcImV4cGFuZFwiICkge1xuXHRcdFx0XHRcdHlEb21haW4gPSBbIDAsIDEgXTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLmNoYXJ0LnlEb21haW4oIHlEb21haW4gKTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdH0sXG5cblx0XHRvblJlbW92ZUVudGl0eTogZnVuY3Rpb24oIGlkICkge1xuXG5cdFx0XHR2YXIgc2VsZWN0ZWRDb3VudHJpZXMgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwic2VsZWN0ZWQtY291bnRyaWVzXCIgKSxcblx0XHRcdFx0Y291bnRyaWVzSWRzID0gXy5rZXlzKCBzZWxlY3RlZENvdW50cmllcyApLFxuXHRcdFx0XHRhZGRDb3VudHJ5TW9kZSA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJhZGQtY291bnRyeS1tb2RlXCIgKTtcblxuXHRcdFx0aWYoIGNvdW50cmllc0lkcy5sZW5ndGggPT09IDAgKSB7XG5cdFx0XHRcdC8vcmVtb3ZpbmcgZnJvbSBlbXB0eSBzZWxlY3Rpb24sIG5lZWQgdG8gY29weSBhbGwgY291bnRyaWVzIGF2YWlsYWJsZSBpbnRvIHNlbGVjdGVkIGNvdW50cmllcyBzZWxlY3Rpb25cblx0XHRcdFx0dmFyIGVudGl0aWVzQ29sbGVjdGlvbiA9IFtdLFxuXHRcdFx0XHQvL3ZhciBlbnRpdGllc0NvbGxlY3Rpb24gPSB7fSxcblx0XHRcdFx0XHRmb3JtQ29uZmlnID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImZvcm0tY29uZmlnXCIgKTtcblx0XHRcdFx0aWYoIGZvcm1Db25maWcgJiYgZm9ybUNvbmZpZ1sgXCJlbnRpdGllcy1jb2xsZWN0aW9uXCIgXSApIHtcblx0XHRcdFx0XHRfLm1hcCggZm9ybUNvbmZpZ1sgXCJlbnRpdGllcy1jb2xsZWN0aW9uXCIgXSwgZnVuY3Rpb24oIGQsIGkgKSB7IGVudGl0aWVzQ29sbGVjdGlvblsgZC5pZCBdID0gZDsgfSApO1xuXHRcdFx0XHRcdC8vZGVlcCBjb3B5IGFycmF5XG5cdFx0XHRcdFx0dmFyIGVudGl0aWVzQ29weSA9ICAkLmV4dGVuZCggdHJ1ZSwgW10sIGZvcm1Db25maWdbIFwiZW50aXRpZXMtY29sbGVjdGlvblwiIF0gKTtcblx0XHRcdFx0XHRBcHAuQ2hhcnRNb2RlbC5zZXQoIFwic2VsZWN0ZWQtY291bnRyaWVzXCIsIGVudGl0aWVzQ29weSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5yZW1vdmVTZWxlY3RlZENvdW50cnkoIGlkICk7XG5cblx0XHR9LFxuXG5cdFx0b25BdmFpbGFibGVDb3VudHJpZXM6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdHZhciAkc2VsZWN0ID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKSxcblx0XHRcdFx0dmFsID0gJHNlbGVjdC52YWwoKSxcblx0XHRcdFx0JG9wdGlvbiA9ICRzZWxlY3QuZmluZCggXCJbdmFsdWU9XCIgKyB2YWwgKyBcIl1cIiApLFxuXHRcdFx0XHR0ZXh0ID0gJG9wdGlvbi50ZXh0KCk7XG5cblx0XHRcdGlmKCAhQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImdyb3VwLWJ5LXZhcmlhYmxlc1wiICkgJiYgQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImFkZC1jb3VudHJ5LW1vZGVcIiApID09PSBcImFkZC1jb3VudHJ5XCIgKSB7XG5cdFx0XHRcdEFwcC5DaGFydE1vZGVsLmFkZFNlbGVjdGVkQ291bnRyeSggeyBpZDogJHNlbGVjdC52YWwoKSwgbmFtZTogdGV4dCB9ICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRBcHAuQ2hhcnRNb2RlbC5yZXBsYWNlU2VsZWN0ZWRDb3VudHJ5KCB7IGlkOiAkc2VsZWN0LnZhbCgpLCBuYW1lOiB0ZXh0IH0gKTtcblx0XHRcdH1cblxuXHRcdFx0Ly9kb3VibGUgY2hlY2sgaWYgd2UgZG9uJ3QgaGF2ZSBmdWxsIHNlbGVjdGlvbiBvZiBjb3VudHJpZXNcblx0XHRcdHZhciBlbnRpdGllc0NvbGxlY3Rpb24gPSB7fSxcblx0XHRcdFx0Zm9ybUNvbmZpZyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJmb3JtLWNvbmZpZ1wiICk7XG5cdFx0XHRpZiggZm9ybUNvbmZpZyAmJiBmb3JtQ29uZmlnWyBcImVudGl0aWVzLWNvbGxlY3Rpb25cIiBdICkge1xuXHRcdFx0XHR2YXIgc2VsZWN0ZWRDb3VudHJpZXNJZHMgPSBfLmtleXMoIEFwcC5DaGFydE1vZGVsLmdldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiApICk7XG5cdFx0XHRcdGlmKCBzZWxlY3RlZENvdW50cmllc0lkcy5sZW5ndGggPT0gZm9ybUNvbmZpZ1sgXCJlbnRpdGllcy1jb2xsZWN0aW9uXCIgXS5sZW5ndGggKSB7XG5cdFx0XHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0KCBcInNlbGVjdGVkLWNvdW50cmllc1wiLCBbXSwge3NpbGVudDp0cnVlfSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHR9LFxuXG5cdFx0Y2FjaGVDb2xvcnM6IGZ1bmN0aW9uKCBkYXRhICkge1xuXHRcdFx0aWYoICF0aGlzLmNhY2hlZENvbG9ycy5sZW5ndGggKSB7XG5cdFx0XHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRcdFx0Xy5lYWNoKCBkYXRhLCBmdW5jdGlvbiggdiwgaSApIHtcblx0XHRcdFx0XHR0aGF0LmNhY2hlZENvbG9yc1sgdi5pZCBdID0gdi5jb2xvcjtcblx0XHRcdFx0fSApO1xuXHRcdFx0fVxuXHRcdH0sXG5cblx0XHRhc3NpZ25Db2xvckZyb21DYWNoZTogZnVuY3Rpb24oIHZhbHVlICkge1xuXHRcdFx0aWYoIHRoaXMuY2FjaGVkQ29sb3JzLmxlbmd0aCApIHtcblx0XHRcdFx0Ly9hc3NpbmcgY29sb3IgZnJvbWUgY2FjaGVcblx0XHRcdFx0aWYoIHRoaXMuY2FjaGVkQ29sb3JzWyB2YWx1ZS5pZCBdICkge1xuXHRcdFx0XHRcdHZhbHVlLmNvbG9yID0gdGhpcy5jYWNoZWRDb2xvcnNbIHZhbHVlLmlkIF07XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dmFyIHJhbmRvbUNvbG9yID0gQXBwLlV0aWxzLmdldFJhbmRvbUNvbG9yKCk7XG5cdFx0XHRcdFx0dmFsdWUuY29sb3IgPSByYW5kb21Db2xvcjtcblx0XHRcdFx0XHR0aGlzLmNhY2hlZENvbG9yc1sgdmFsdWUuaWQgXSA9IHJhbmRvbUNvbG9yO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0fVxuXHRcdFxuXHR9ICk7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVmlld3MuQ2hhcnQuQ2hhcnRUYWI7XG5cbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgQXBwID0gcmVxdWlyZSggXCIuLy4uLy4uL25hbWVzcGFjZXMuanNcIiApO1xuXG5cdEFwcC5WaWV3cy5DaGFydC5EYXRhVGFiID0gQmFja2JvbmUuVmlldy5leHRlbmQoIHtcblxuXHRcdGVsOiBcIiNjaGFydC12aWV3XCIsXG5cdFx0ZXZlbnRzOiB7fSxcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0XG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIgPSBvcHRpb25zLmRpc3BhdGNoZXI7XG5cblx0XHRcdC8vZGF0YSB0YWJcblx0XHRcdHRoaXMuJGRhdGFUYWIgPSB0aGlzLiRlbC5maW5kKCBcIiNkYXRhLWNoYXJ0LXRhYlwiICk7XG5cdFx0XHR0aGlzLiRkb3dubG9hZEJ0biA9IHRoaXMuJGRhdGFUYWIuZmluZCggXCIuZG93bmxvYWQtZGF0YS1idG5cIiApO1xuXHRcdFx0dGhpcy4kZGF0YVRhYmxlV3JhcHBlciA9IHRoaXMuJGRhdGFUYWIuZmluZCggXCIuZGF0YS10YWJsZS13cmFwcGVyXCIgKTtcblxuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCBkYXRhLCBsb2NhbERhdGEsIGRpbWVuc2lvbnMgKSB7XG5cdFx0XHRcblx0XHRcdHRoaXMuJGRhdGFUYWJsZVdyYXBwZXIuZW1wdHkoKTtcblxuXHRcdFx0Ly91cGRhdGUgbGlua1xuXHRcdFx0dmFyIHRoYXQgPSB0aGlzLFxuXHRcdFx0XHRjaGFydFR5cGUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdHlwZVwiICksXG5cdFx0XHRcdGhhc011bHRpcGxlQ29sdW1ucyA9ICggQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImdyb3VwLWJ5LXZhcmlhYmxlc1wiICkgJiYgY2hhcnRUeXBlICE9PSBcIjNcIiApPyB0cnVlOiBmYWxzZTsvKixcblx0XHRcdFx0YmFzZVVybCA9IHRoaXMuJGRvd25sb2FkQnRuLmF0dHIoIFwiZGF0YS1iYXNlLXVybFwiICksXG5cdFx0XHRcdGRpbWVuc2lvbnNVcmwgPSBlbmNvZGVVUklDb21wb25lbnQoIGRpbWVuc2lvbnNTdHJpbmcgKTsqL1xuXHRcdFx0Ly90aGlzLiRkb3dubG9hZEJ0bi5hdHRyKCBcImhyZWZcIiwgYmFzZVVybCArIFwiP2RpbWVuc2lvbnM9XCIgKyBkaW1lbnNpb25zVXJsICsgXCImY2hhcnRUeXBlPVwiICsgY2hhcnRUeXBlICsgXCImZXhwb3J0PWNzdlwiICk7XG5cdFx0XHR0aGlzLiRkb3dubG9hZEJ0bi5vbiggXCJjbGlja1wiLCBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXG5cdFx0XHRcdHZhciBkYXRhID0gW10sXG5cdFx0XHRcdFx0JHRycyA9IHRoYXQuJGVsLmZpbmQoIFwidHJcIiApO1xuXHRcdFx0XHQkLmVhY2goICR0cnMsIGZ1bmN0aW9uKCBpLCB2ICkge1xuXG5cdFx0XHRcdFx0dmFyIHRyRGF0YSA9IFtdLFxuXHRcdFx0XHRcdFx0JHRyID0gJCggdGhpcyApLFxuXHRcdFx0XHRcdFx0JGNlbGxzID0gJHRyLmZpbmQoIFwidGgsIHRkXCIgKTtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHQkLmVhY2goICRjZWxscywgZnVuY3Rpb24oIGkyLCB2MiApIHtcblx0XHRcdFx0XHRcdHRyRGF0YS5wdXNoKCAkKCB2MiApLnRleHQoKSApO1xuXHRcdFx0XHRcdH0gKTtcblxuXHRcdFx0XHRcdGRhdGEucHVzaCggdHJEYXRhICk7XG5cblx0XHRcdFx0fSApO1xuXG5cdFx0XHRcdHZhciBjc3ZTdHJpbmcgPSBcImRhdGE6dGV4dC9jc3Y7Y2hhcnNldD11dGYtOCxcIjtcblx0XHRcdFx0Xy5lYWNoKCBkYXRhLCBmdW5jdGlvbiggdiwgaSApIHtcblx0XHRcdFx0XHR2YXIgZGF0YVN0cmluZyA9IHYuam9pbihcIixcIik7XG5cdFx0XHRcdFx0Y3N2U3RyaW5nICs9ICggaSA8IGRhdGEubGVuZ3RoICk/IGRhdGFTdHJpbmcrIFwiXFxuXCIgOiBkYXRhU3RyaW5nO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdFxuXHRcdFx0XHR2YXIgZW5jb2RlZFVyaSA9IGVuY29kZVVSSSggY3N2U3RyaW5nICk7XG5cdFx0XHRcdHdpbmRvdy5vcGVuKCBlbmNvZGVkVXJpICk7XG5cblx0XHRcdH0gKTtcblxuXHRcdFx0Ly9nZXQgYWxsIHRpbWVzXG5cdFx0XHR2YXIgdGltZXNPYmogPSBbXSxcblx0XHRcdFx0dGltZXMgPSBbXTtcblx0XHRcdF8uZWFjaCggZGF0YSwgZnVuY3Rpb24oIGVudGl0eURhdGEsIGVudGl0eUlkICkge1xuXG5cdFx0XHRcdHZhciB2YWx1ZXMgPSBlbnRpdHlEYXRhLnZhbHVlcyxcblx0XHRcdFx0XHR2YWx1ZXNCeVRpbWUgPSBbXTtcblxuXHRcdFx0XHRfLmVhY2goIHZhbHVlcywgZnVuY3Rpb24oIHZhbHVlICkge1xuXG5cdFx0XHRcdFx0Ly9zdG9yZSBnaXZlbiB0aW1lIGFzIGV4aXN0aW5nXG5cdFx0XHRcdFx0dmFyIHRpbWUgPSB2YWx1ZS50aW1lO1xuXHRcdFx0XHRcdGlmKCAhdGltZXNPYmpbIHRpbWUgXSApIHtcblx0XHRcdFx0XHRcdHRpbWVzT2JqWyB0aW1lIF0gPSB0cnVlO1xuXHRcdFx0XHRcdFx0dGltZXMucHVzaCggdGltZSApO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vcmUtbWFwIHZhbHVlcyBieSB0aW1lIGtleVxuXHRcdFx0XHRcdHZhbHVlc0J5VGltZVsgdGltZSBdID0gdmFsdWU7XG5cblx0XHRcdFx0fSApO1xuXG5cdFx0XHRcdGVudGl0eURhdGEudmFsdWVzQnlUaW1lID0gdmFsdWVzQnlUaW1lO1xuXG5cdFx0XHR9ICk7XG5cblx0XHRcdC8vc29ydCBnYXRoZXJlZCB0aW1lc1xuXHRcdFx0dGltZXMgPSBfLnNvcnRCeSggdGltZXMsIGZ1bmN0aW9uKCB2ICkgeyByZXR1cm4gK3Y7IH0gKTtcblx0XHRcdFxuXHRcdFx0Ly9jcmVhdGUgZmlyc3Qgcm93XG5cdFx0XHR2YXIgdGFibGVTdHJpbmcgPSBcIjx0YWJsZSBjbGFzcz0nZGF0YS10YWJsZSc+XCIsXG5cdFx0XHRcdHRyID0gXCI8dHI+PHRkPjxzdHJvbmc+IDwvc3Ryb25nPjwvdGQ+XCI7XG5cdFx0XHRfLmVhY2goIHRpbWVzLCBmdW5jdGlvbiggdGltZSApIHtcblxuXHRcdFx0XHQvL2NyZWF0ZSBjb2x1bW4gZm9yIGV2ZXJ5IGRpbWVuc2lvblxuXHRcdFx0XHRfLmVhY2goIGRpbWVuc2lvbnMsIGZ1bmN0aW9uKCBkaW1lbnNpb24sIGkgKSB7XG5cdFx0XHRcdFx0aWYoIGkgPT09IDAgfHwgaGFzTXVsdGlwbGVDb2x1bW5zICkge1xuXHRcdFx0XHRcdFx0dmFyIHRoID0gXCI8dGg+XCI7XG5cdFx0XHRcdFx0XHR0aCArPSB0aW1lO1xuXHRcdFx0XHRcdFx0aWYoIGRpbWVuc2lvbnMubGVuZ3RoID4gMSAmJiBoYXNNdWx0aXBsZUNvbHVtbnMgKSB7XG5cdFx0XHRcdFx0XHRcdC8vd2UgaGF2ZSBtb3JlIHRoYW4gb25lIGRpbWVuc2lvbiwgbmVlZCB0byBkaXN0aW5ndWlzaCB0aGVtIGluIFxuXHRcdFx0XHRcdFx0XHR0aCArPSBcIiAtIFwiICsgZGltZW5zaW9uLnZhcmlhYmxlTmFtZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHRoICs9IFwiPC90aD5cIjtcblx0XHRcdFx0XHRcdHRyICs9IHRoO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cblx0XHRcdH0gKTtcblx0XHRcdHRyICs9IFwiPC90cj5cIjtcblx0XHRcdHRhYmxlU3RyaW5nICs9IHRyO1xuXG5cdFx0XHRfLmVhY2goIGRhdGEsIGZ1bmN0aW9uKCBlbnRpdHlEYXRhLCBlbnRpdHlJZCApIHtcblxuXHRcdFx0XHR2YXIgdHIgPSBcIjx0cj5cIixcblx0XHRcdFx0XHQvL2FkZCBuYW1lIG9mIGVudGl0eVxuXHRcdFx0XHRcdHRkID0gXCI8dGQ+PHN0cm9uZz5cIiArIGVudGl0eURhdGEua2V5ICsgXCI8L3N0cm9uZz48L3RkPlwiO1xuXHRcdFx0XHR0ciArPSB0ZDtcblxuXHRcdFx0XHR2YXIgdmFsdWVzQnlUaW1lID0gZW50aXR5RGF0YS52YWx1ZXNCeVRpbWU7XG5cdFx0XHRcdF8uZWFjaCggdGltZXMsIGZ1bmN0aW9uKCB0aW1lICkge1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdC8vY3JlYXRlIGNvbHVtbiBmb3IgZXZlcnkgZGltZW5zaW9uXG5cdFx0XHRcdFx0Xy5lYWNoKCBkaW1lbnNpb25zLCBmdW5jdGlvbiggZGltZW5zaW9uLCBpICkge1xuXHRcdFx0XHRcdFx0aWYoIGkgPT09IDAgfHwgaGFzTXVsdGlwbGVDb2x1bW5zICkge1xuXHRcdFx0XHRcdFx0XHR2YXIgdGQgPSBcIjx0ZD5cIixcblx0XHRcdFx0XHRcdFx0XHR0ZFZhbHVlID0gXCJcIjtcblx0XHRcdFx0XHRcdFx0Ly9pcyB0aGVyZSB2YWx1ZSBmb3IgZ2l2ZW4gdGltZVxuXHRcdFx0XHRcdFx0XHRpZiggdmFsdWVzQnlUaW1lWyB0aW1lIF0gKSB7XG5cdFx0XHRcdFx0XHRcdFx0aWYoICF2YWx1ZXNCeVRpbWVbIHRpbWUgXS5mYWtlICkge1xuXHRcdFx0XHRcdFx0XHRcdFx0dGRWYWx1ZSA9IHZhbHVlc0J5VGltZVsgdGltZSBdWyBkaW1lbnNpb24ucHJvcGVydHkgXTtcblx0XHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdFx0Ly9qdXN0IGR1bW15IHZhbHVlcyBmb3IgY29ycmVjdCByZW5kZXJpbmcgb2YgY2hhcnQsIGRvbid0IGFkZCBpbnRvIHRhYmxlXG5cdFx0XHRcdFx0XHRcdFx0XHR0ZFZhbHVlID0gXCJcIjtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0dGQgKz0gdGRWYWx1ZTtcblx0XHRcdFx0XHRcdFx0dGQgKz0gXCI8L3RkPlwiO1xuXHRcdFx0XHRcdFx0XHR0ciArPSB0ZDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFxuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdFxuXHRcdFx0XHR0ciArPSBcIjwvdHI+XCI7XG5cdFx0XHRcdHRhYmxlU3RyaW5nICs9IHRyO1xuXG5cdFx0XHR9ICk7XG5cblx0XHRcdHRhYmxlU3RyaW5nICs9IFwiPC90YWJsZT5cIjtcblxuXHRcdFx0dmFyICR0YWJsZSA9ICQoIHRhYmxlU3RyaW5nICk7XG5cdFx0XHR0aGlzLiRkYXRhVGFibGVXcmFwcGVyLmFwcGVuZCggJHRhYmxlICk7XG5cblxuXHRcdH1cblxuXHR9ICk7XG5cdFxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5DaGFydC5EYXRhVGFiO1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cdFxuXHR2YXIgQXBwID0gcmVxdWlyZSggXCIuLy4uLy4uL25hbWVzcGFjZXMuanNcIiApO1xuXG5cdEFwcC5WaWV3cy5DaGFydC5IZWFkZXIgPSBCYWNrYm9uZS5WaWV3LmV4dGVuZCh7XG5cblx0XHRlbDogXCIjY2hhcnQtdmlldyAuY2hhcnQtaGVhZGVyXCIsXG5cdFx0ZXZlbnRzOiB7fSxcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0XG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIgPSBvcHRpb25zLmRpc3BhdGNoZXI7XG5cdFx0XHRcblx0XHRcdHRoaXMuJHRhYnMgPSB0aGlzLiRlbC5maW5kKCBcIi5oZWFkZXItdGFiXCIgKTtcblx0XHRcdHRoaXMucmVuZGVyKCk7XG5cblx0XHRcdC8vc2V0dXAgZXZlbnRzXG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5vbiggXCJjaGFuZ2VcIiwgdGhpcy5yZW5kZXIsIHRoaXMgKTtcblxuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XG5cdFx0XHR2YXIgdGFicyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJ0YWJzXCIgKTtcblx0XHRcdFxuXHRcdFx0Ly9oaWRlIGZpcnN0IGV2ZXJ5dGhpbmdcblx0XHRcdHRoaXMuJHRhYnMuaGlkZSgpO1xuXG5cdFx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0XHRfLmVhY2goIHRhYnMsIGZ1bmN0aW9uKCB2LCBpICkge1xuXHRcdFx0XHR2YXIgdGFiID0gdGhhdC4kdGFicy5maWx0ZXIoIFwiLlwiICsgdiArIFwiLWhlYWRlci10YWJcIiApO1xuXHRcdFx0XHR0YWIuc2hvdygpO1xuXHRcdFx0XHRpZiggaSA9PT0gMCApIHtcblx0XHRcdFx0XHR0YWIuYWRkQ2xhc3MoIFwiYWN0aXZlXCIgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXG5cdFx0fVxuXG5cdH0pO1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkNoYXJ0LkhlYWRlcjtcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXHRcblx0dmFyIEFwcCA9IHJlcXVpcmUoIFwiLi8uLi8uLi9uYW1lc3BhY2VzLmpzXCIgKTtcblxuXHRBcHAuVmlld3MuQ2hhcnQuTGVnZW5kID0gZnVuY3Rpb24oIGNoYXJ0TGVnZW5kICkge1xuXHRcblx0XHQvL2Jhc2VkIG9uIGh0dHBzOi8vZ2l0aHViLmNvbS9ub3Z1cy9udmQzL2Jsb2IvbWFzdGVyL3NyYy9tb2RlbHMvbGVnZW5kLmpzXG5cblx0XHQvLz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXHRcdC8vIFB1YmxpYyBWYXJpYWJsZXMgd2l0aCBEZWZhdWx0IFNldHRpbmdzXG5cdFx0Ly8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuXHRcdHZhciBjaGFydFR5cGUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdHlwZVwiIClcblx0XHRcdCwgbWFyZ2luID0ge3RvcDogNSwgcmlnaHQ6IDUwLCBib3R0b206IDUsIGxlZnQ6IDYyfVxuXHRcdFx0LCB3aWR0aCA9IDgwMFxuXHRcdFx0LCBoZWlnaHQgPSAyMFxuXHRcdFx0LCBnZXRLZXkgPSBmdW5jdGlvbihkKSB7IHJldHVybiBkLmtleSB9XG5cdFx0XHQsIGNvbG9yID0gbnYudXRpbHMuZ2V0Q29sb3IoKVxuXHRcdFx0LCBhbGlnbiA9IHRydWVcblx0XHRcdCwgcGFkZGluZyA9IDQwIC8vZGVmaW5lIGhvdyBtdWNoIHNwYWNlIGJldHdlZW4gbGVnZW5kIGl0ZW1zLiAtIHJlY29tbWVuZCAzMiBmb3IgZnVyaW91cyB2ZXJzaW9uXG5cdFx0XHQsIHJpZ2h0QWxpZ24gPSBmYWxzZVxuXHRcdFx0LCB1cGRhdGVTdGF0ZSA9IHRydWUgICAvL0lmIHRydWUsIGxlZ2VuZCB3aWxsIHVwZGF0ZSBkYXRhLmRpc2FibGVkIGFuZCB0cmlnZ2VyIGEgJ3N0YXRlQ2hhbmdlJyBkaXNwYXRjaC5cblx0XHRcdCwgcmFkaW9CdXR0b25Nb2RlID0gZmFsc2UgICAvL0lmIHRydWUsIGNsaWNraW5nIGxlZ2VuZCBpdGVtcyB3aWxsIGNhdXNlIGl0IHRvIGJlaGF2ZSBsaWtlIGEgcmFkaW8gYnV0dG9uLiAob25seSBvbmUgY2FuIGJlIHNlbGVjdGVkIGF0IGEgdGltZSlcblx0XHRcdCwgZXhwYW5kZWQgPSBmYWxzZVxuXHRcdFx0LCBkaXNwYXRjaCA9IGQzLmRpc3BhdGNoKCdsZWdlbmRDbGljaycsICdsZWdlbmREYmxjbGljaycsICdsZWdlbmRNb3VzZW92ZXInLCAnbGVnZW5kTW91c2VvdXQnLCAnc3RhdGVDaGFuZ2UnLCAncmVtb3ZlRW50aXR5JywgJ2FkZEVudGl0eScpXG5cdFx0XHQsIHZlcnMgPSAnY2xhc3NpYycgLy9PcHRpb25zIGFyZSBcImNsYXNzaWNcIiBhbmQgXCJmdXJpb3VzXCIgYW5kIFwib3dkXCJcblx0XHRcdDtcblxuXHRcdGZ1bmN0aW9uIGNoYXJ0KHNlbGVjdGlvbikge1xuXHRcdFx0XG5cdFx0XHRzZWxlY3Rpb24uZWFjaChmdW5jdGlvbihkYXRhKSB7XG5cdFx0XHRcdFxuXHRcdFx0XHR2YXIgJHN2ZyA9ICQoIFwic3ZnLm52ZDMtc3ZnXCIgKSxcblx0XHRcdFx0XHRhdmFpbGFibGVXaWR0aCA9ICRzdmcud2lkdGgoKSAtIG1hcmdpbi5sZWZ0IC0gbWFyZ2luLnJpZ2h0LFxuXHRcdFx0XHRcdGNvbnRhaW5lciA9IGQzLnNlbGVjdCh0aGlzKTtcblx0XHRcdFx0XG5cdFx0XHRcdG52LnV0aWxzLmluaXRTVkcoY29udGFpbmVyKTtcblxuXHRcdFx0XHR2YXIgYmluZGFibGVEYXRhID0gZGF0YTtcblxuXHRcdFx0XHQvL2Rpc2NyZXRlIGJhciBjaGFydCBuZWVkcyB1bnBhY2sgZGF0YVxuXHRcdFx0XHRpZiggY2hhcnRUeXBlID09PSBcIjZcIiApIHtcblx0XHRcdFx0XHRpZiggZGF0YSAmJiBkYXRhLmxlbmd0aCAmJiBkYXRhWzBdLnZhbHVlcyApIHtcblx0XHRcdFx0XHRcdHZhciBkaXNjcmV0ZURhdGEgPSBfLm1hcCggZGF0YVswXS52YWx1ZXMsIGZ1bmN0aW9uKCB2LCBpICkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4geyBpZDogdi5pZCwga2V5OiB2LngsIGNvbG9yOiB2LmNvbG9yLCB2YWx1ZXM6IHYgfTtcblx0XHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHRcdGJpbmRhYmxlRGF0YSA9IGRpc2NyZXRlRGF0YTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdC8vIFNldHVwIGNvbnRhaW5lcnMgYW5kIHNrZWxldG9uIG9mIGNoYXJ0XG5cdFx0XHRcdHZhciB3cmFwID0gY29udGFpbmVyLnNlbGVjdEFsbCgnZy5udi1jdXN0b20tbGVnZW5kJykuZGF0YShbYmluZGFibGVEYXRhXSksXG5cdFx0XHRcdC8vdmFyIHdyYXAgPSBjb250YWluZXIuc2VsZWN0QWxsKCdnLm52LWN1c3RvbS1sZWdlbmQnKS5kYXRhKFtkYXRhXSksXG5cdFx0XHRcdFx0Z0VudGVyID0gd3JhcC5lbnRlcigpLmFwcGVuZCgnZycpLmF0dHIoJ2NsYXNzJywgJ252ZDMgbnYtY3VzdG9tLWxlZ2VuZCcpLmFwcGVuZCgnZycpLmF0dHIoICdjbGFzcycsICdudi1sZWdlbmQtc2VyaWVzLXdyYXBwZXInICksXG5cdFx0XHRcdFx0ZyA9IHdyYXAuc2VsZWN0KCdnJyk7XG5cblx0XHRcdFx0d3JhcC5hdHRyKCd0cmFuc2Zvcm0nLCAndHJhbnNsYXRlKCcgKyBtYXJnaW4ubGVmdCArICcsJyArIG1hcmdpbi50b3AgKyAnKScpO1xuXG5cdFx0XHRcdHZhciBzZXJpZXMgPSBnLnNlbGVjdEFsbCgnLm52LXNlcmllcycpXG5cdFx0XHRcdFx0LmRhdGEoZnVuY3Rpb24oZCkge1xuXHRcdFx0XHRcdFx0aWYodmVycyAhPSAnZnVyaW91cycpIHJldHVybiBkO1xuXHRcdFx0XHRcdFx0cmV0dXJuIGQuZmlsdGVyKGZ1bmN0aW9uKG4pIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGV4cGFuZGVkID8gdHJ1ZSA6ICFuLmRpc2VuZ2FnZWQ7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XG5cdFx0XHRcdC8vYWRkIGVudGl0eSBsYWJlbFxuXHRcdFx0XHR2YXIgZW50aXR5TGFiZWwgPSB3cmFwLnNlbGVjdCggJy5udi1lbnRpdHktbGFiZWwnICksXG5cdFx0XHRcdFx0ZW50aXR5TGFiZWxUZXh0ID0gZW50aXR5TGFiZWwuc2VsZWN0KCAndGV4dCcgKSxcblx0XHRcdFx0XHRlbnRpdHlMYWJlbFdpZHRoID0gMDtcblx0XHRcdFx0Ly9kaXNwbGF5aW5nIG9mIGVudGl0eSBsYWJlbCBpcyBkaXNhYmxlZFxuXHRcdFx0XHQvKmlmKCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiYWRkLWNvdW50cnktbW9kZVwiICkgPT09IFwiY2hhbmdlLWNvdW50cnlcIiApIHtcblx0XHRcdFx0XHRpZiggZW50aXR5TGFiZWwuZW1wdHkoKSApIHtcblx0XHRcdFx0XHRcdGVudGl0eUxhYmVsID0gd3JhcC5hcHBlbmQoICdnJyApLmF0dHIoJ2NsYXNzJywgJ252LWVudGl0eS1sYWJlbCcpLmF0dHIoICd0cmFuc2Zvcm0nLCAndHJhbnNsYXRlKDAsMTUpJyApO1xuXHRcdFx0XHRcdFx0ZW50aXR5TGFiZWxUZXh0ID0gZW50aXR5TGFiZWwuYXBwZW5kKCAndGV4dCcgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYoIGRhdGEgJiYgZGF0YVswXSAmJiBkYXRhWzBdLmVudGl0eSApIHtcblx0XHRcdFx0XHRcdGVudGl0eUxhYmVsVGV4dC50ZXh0KCBkYXRhWzBdLmVudGl0eSArIFwiOiBcIiApO1xuXHRcdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdFx0ZW50aXR5TGFiZWxXaWR0aCA9IGVudGl0eUxhYmVsVGV4dC5ub2RlKCkuZ2V0Q29tcHV0ZWRUZXh0TGVuZ3RoKCk7XG5cdFx0XHRcdFx0XHRcdC8vIElmIHRoZSBsZWdlbmRUZXh0IGlzIGRpc3BsYXk6bm9uZSdkIChub2RlVGV4dExlbmd0aCA9PSAwKSwgc2ltdWxhdGUgYW4gZXJyb3Igc28gd2UgYXBwcm94aW1hdGUsIGluc3RlYWRcblx0XHRcdFx0XHRcdFx0aWYoIGVudGl0eUxhYmVsV2lkdGggPD0gMCApIHRocm93IG5ldyBFcnJvcigpO1xuXHRcdFx0XHRcdFx0fSBjYXRjaCggZSApIHtcblx0XHRcdFx0XHRcdFx0ZW50aXR5TGFiZWxXaWR0aCA9IG52LnV0aWxzLmNhbGNBcHByb3hUZXh0V2lkdGgoZW50aXR5TGFiZWxUZXh0KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdC8vYWRkIHBhZGRpbmcgZm9yIGxhYmVsXG5cdFx0XHRcdFx0XHRlbnRpdHlMYWJlbFdpZHRoICs9IDMwO1xuXHRcdFx0XHRcdFx0YXZhaWxhYmxlV2lkdGggLT0gZW50aXR5TGFiZWxXaWR0aDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly9tYWtlIHN1cmUgdGhlcmUgaXMgbm90IGxhYmVsIGxlZnRcblx0XHRcdFx0XHRlbnRpdHlMYWJlbC5yZW1vdmUoKTtcblx0XHRcdFx0fSovXG5cdFx0XHRcdFxuXHRcdFx0XHQvL2lmIG5vdCBleGlzdGluZywgYWRkIG52LWFkZC1idG4sIGlmIG5vdCBncm91cGluZyBieSB2YXJpYWJsZXNcblx0XHRcdFx0dmFyIGFkZEVudGl0eUJ0biA9ICB3cmFwLnNlbGVjdCggJ2cubnYtYWRkLWJ0bicgKTtcblx0XHRcdFx0aWYoIGFkZEVudGl0eUJ0bi5lbXB0eSgpICkge1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0biA9IHdyYXAuYXBwZW5kKCdnJykuYXR0cignY2xhc3MnLCAnbnYtYWRkLWJ0bicpO1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5hcHBlbmQoJ3JlY3QnKS5hdHRyKCB7ICdjbGFzcyc6ICdhZGQtYnRuLWJnJywgJ3dpZHRoJzogJzEwMCcsICdoZWlnaHQnOiAnMjUnLCAndHJhbnNmb3JtJzogJ3RyYW5zbGF0ZSgwLC01KScgfSApO1xuXHRcdFx0XHRcdHZhciBhZGRFbnRpdHlCdG5HID0gYWRkRW50aXR5QnRuLmFwcGVuZCgnZycpLmF0dHIoIHsgJ2NsYXNzJzogJ2FkZC1idG4tcGF0aCcgfSApO1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bkcuYXBwZW5kKCdwYXRoJykuYXR0ciggeyAnZCc6ICdNMTUsMCBMMTUsMTQnLCAnY2xhc3MnOiAnbnYtYm94JyB9ICk7XG5cdFx0XHRcdFx0YWRkRW50aXR5QnRuRy5hcHBlbmQoJ3BhdGgnKS5hdHRyKCB7ICdkJzogJ004LDcgTDIyLDcnLCAnY2xhc3MnOiAnbnYtYm94JyB9ICk7XG5cdFx0XHRcdFx0Ly9odHRwOi8vYW5kcm9pZC11aS11dGlscy5nb29nbGVjb2RlLmNvbS9oZy1oaXN0b3J5L2FjOTU1ZTYzNzY0NzBkOTU5OWVhZDA3YjQ1OTllZjkzNzgyNGY5MTkvYXNzZXQtc3R1ZGlvL2Rpc3QvcmVzL2NsaXBhcnQvaWNvbnMvcmVmcmVzaC5zdmc/cj1hYzk1NWU2Mzc2NDcwZDk1OTllYWQwN2I0NTk5ZWY5Mzc4MjRmOTE5XG5cdFx0XHRcdFx0YWRkRW50aXR5QnRuLmFwcGVuZCgncGF0aCcpLmF0dHIoIHsgJ2QnOiAnTTE2MC40NjksMjQyLjE5NGMwLTQ0LjQxNCwzNi4wMjMtODAuNDM4LDgwLjQzOC04MC40MzhjMTkuMTg4LDAsMzYuNzExLDYuODQ0LDUwLjUsMTguMDc4TDI1OS43OCwyMDkuOTNsOTkuOTQ1LDExLjM2NyAgICBsMC44MDUtMTA3LjI0MmwtMzAuNzY2LDI5LjI4OWMtMjMuNTQ2LTIxLjIwMy01NC42MjQtMzQuMTY0LTg4LjgwNC0zNC4xNjRjLTczLjQ2OSwwLTEzMy4wMjMsNTkuNTYyLTEzMy4wMjMsMTMzLjAxNiAgICBjMCwyLjc0MiwwLjI0Mi0yLjI2NiwwLjQxNCwwLjQ0NWw1My42OCw3LjU1NUMxNjEuMDMsMjQ1LjEwOCwxNjAuNDY5LDI0Ny41NjIsMTYwLjQ2OSwyNDIuMTk0eiBNMzcxLjY0NywyMzcuMzc1bC01My42ODEtNy41NTUgICAgYzEuMDE3LDUuMDg2LDEuNTU2LDIuNjE3LDEuNTU2LDcuOTkyYzAsNDQuNDE0LTM2LjAwOCw4MC40MzEtODAuNDMsODAuNDMxYy0xOS4xMzMsMC0zNi42MDItNi43OTgtNTAuMzgzLTE3Ljk3bDMxLjU5NS0zMC4wNzggICAgbC05OS45My0xMS4zNjZsLTAuODEyLDEwNy4yNWwzMC43ODktMjkuMzEyYzIzLjUzMSwyMS4xNDEsNTQuNTcsMzQuMDU1LDg4LjY4OCwzNC4wNTVjNzMuNDY4LDAsMTMzLjAyMy01OS41NTUsMTMzLjAyMy0xMzMuMDA4ICAgIEMzNzIuMDYyLDIzNS4wNzgsMzcxLjgxMiwyNDAuMDg1LDM3MS42NDcsMjM3LjM3NXonLCAnY2xhc3MnOiAnbnYtYm94IGNoYW5nZS1idG4tcGF0aCcsICd0cmFuc2Zvcm0nOiAnc2NhbGUoLjA0KSB0cmFuc2xhdGUoMTUwLC01MCknIH0gKTtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4uYXBwZW5kKCd0ZXh0JykuYXR0ciggeyd4JzoyOCwneSc6MTF9ICkudGV4dCgnQWRkIGNvdW50cnknKTtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4ub24oICdjbGljaycsIGZ1bmN0aW9uKCBkLCBpICkge1xuXHRcdFx0XHRcdFx0Ly9ncm91cCBieSB2YXJpYWJsZXNcblx0XHRcdFx0XHRcdGRpc3BhdGNoLmFkZEVudGl0eSgpO1xuXHRcdFx0XHRcdFx0ZDMuZXZlbnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdC8vYmFzZWQgb24gc2VsZWN0ZWQgY291bnRyaWVzIHNlbGVjdGlvbiBoaWRlIG9yIHNob3cgYWRkRW50aXR5QnRuXG5cdFx0XHRcdGlmKCBfLmlzRW1wdHkoIEFwcC5DaGFydE1vZGVsLmdldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiApICkgKSB7XG5cdFx0XHRcdFx0YWRkRW50aXR5QnRuLmF0dHIoIFwiZGlzcGxheVwiLCBcIm5vbmVcIiApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5hdHRyKCBcImRpc3BsYXlcIiwgXCJibG9ja1wiICk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR2YXIgYWRkQ291bnRyeU1vZGUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiYWRkLWNvdW50cnktbW9kZVwiICk7XG5cdFx0XHRcdGlmKCBhZGRDb3VudHJ5TW9kZSA9PT0gXCJhZGQtY291bnRyeVwiICkge1xuXHRcdFx0XHQvL2lmKCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiZ3JvdXAtYnktdmFyaWFibGVzXCIgKSApIHtcblx0XHRcdFx0XHQvL2lmIGdyb3VwaW5nIGJ5IHZhcmlhYmxlLCBsZWdlbmQgd2lsbCBzaG93IHZhcmlhYmxlcyBpbnN0ZWFkIG9mIGNvdW50cmllcywgc28gYWRkIGNvdW50cnkgYnRuIGRvZXNuJ3QgbWFrZSBzZW5zZVxuXHRcdFx0XHRcdC8vaWYgZW5hYmxpbmcgYWRkaW5nIGNvdW50cmllc1xuXHRcdFx0XHRcdC8vYWRkRW50aXR5QnRuLmF0dHIoIFwiZGlzcGxheVwiLCBcIm5vbmVcIiApO1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5zZWxlY3QoIFwidGV4dFwiICkudGV4dCggXCJBZGQgY291bnRyeVwiICk7XG5cdFx0XHRcdFx0YWRkRW50aXR5QnRuLnNlbGVjdCggXCJyZWN0XCIgKS5hdHRyKCBcIndpZHRoXCIsIFwiMTAwXCIgKTtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4uc2VsZWN0KCBcIi5hZGQtYnRuLXBhdGhcIiApLmF0dHIoIFwiZGlzcGxheVwiLCBcImJsb2NrXCIgKTtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4uc2VsZWN0KCBcIi5jaGFuZ2UtYnRuLXBhdGhcIiApLmF0dHIoIFwiZGlzcGxheVwiLCBcIm5vbmVcIiApO1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5hdHRyKCBcImRpc3BsYXlcIiwgXCJibG9ja1wiICk7XG5cdFx0XHRcdH0gZWxzZSBpZiggYWRkQ291bnRyeU1vZGUgPT09IFwiY2hhbmdlLWNvdW50cnlcIiApIHtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4uc2VsZWN0KCBcIi5hZGQtYnRuLXBhdGhcIiApLmF0dHIoIFwiZGlzcGxheVwiLCBcIm5vbmVcIiApO1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5zZWxlY3QoIFwiLmNoYW5nZS1idG4tcGF0aFwiICkuYXR0ciggXCJkaXNwbGF5XCIsIFwiYmxvY2tcIiApO1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5zZWxlY3QoIFwidGV4dFwiICkudGV4dCggXCJDaGFuZ2UgY291bnRyeVwiICk7XG5cdFx0XHRcdFx0YWRkRW50aXR5QnRuLnNlbGVjdCggXCJyZWN0XCIgKS5hdHRyKCBcIndpZHRoXCIsIFwiMTIwXCIgKTtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4uYXR0ciggXCJkaXNwbGF5XCIsIFwiYmxvY2tcIiApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5hdHRyKCBcImRpc3BsYXlcIiwgXCJub25lXCIgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRcdFxuXHRcdFx0XHR2YXIgc2VyaWVzRW50ZXIgPSBzZXJpZXMuZW50ZXIoKS5hcHBlbmQoJ2cnKS5hdHRyKCdjbGFzcycsICdudi1zZXJpZXMnKSxcblx0XHRcdFx0XHRzZXJpZXNTaGFwZSwgc2VyaWVzUmVtb3ZlO1xuXG5cdFx0XHRcdHZhciB2ZXJzUGFkZGluZyA9IDMwO1xuXHRcdFx0XHRzZXJpZXNFbnRlci5hcHBlbmQoJ3JlY3QnKVxuXHRcdFx0XHRcdC5zdHlsZSgnc3Ryb2tlLXdpZHRoJywgMilcblx0XHRcdFx0XHQuYXR0cignY2xhc3MnLCdudi1sZWdlbmQtc3ltYm9sJyk7XG5cblx0XHRcdFx0Ly9lbmFibGUgcmVtb3ZpbmcgY291bnRyaWVzIG9ubHkgaWYgQWRkL1JlcGxhY2UgY291bnRyeSBidXR0b24gcHJlc2VudFxuXHRcdFx0XHRpZiggYWRkQ291bnRyeU1vZGUgPT0gXCJhZGQtY291bnRyeVwiICYmICFBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiZ3JvdXAtYnktdmFyaWFibGVzXCIgKSApIHtcblx0XHRcdFx0XHR2YXIgcmVtb3ZlQnRucyA9IHNlcmllc0VudGVyLmFwcGVuZCgnZycpXG5cdFx0XHRcdFx0XHQuYXR0cignY2xhc3MnLCAnbnYtcmVtb3ZlLWJ0bicpXG5cdFx0XHRcdFx0XHQuYXR0cigndHJhbnNmb3JtJywgJ3RyYW5zbGF0ZSgxMCwxMCknKTtcblx0XHRcdFx0XHRyZW1vdmVCdG5zLmFwcGVuZCgncGF0aCcpLmF0dHIoIHsgJ2QnOiAnTTAsMCBMNyw3JywgJ2NsYXNzJzogJ252LWJveCcgfSApO1xuXHRcdFx0XHRcdHJlbW92ZUJ0bnMuYXBwZW5kKCdwYXRoJykuYXR0ciggeyAnZCc6ICdNNywwIEwwLDcnLCAnY2xhc3MnOiAnbnYtYm94JyB9ICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdHNlcmllc1NoYXBlID0gc2VyaWVzLnNlbGVjdCgnLm52LWxlZ2VuZC1zeW1ib2wnKTtcblx0XHRcdFx0XG5cdFx0XHRcdHNlcmllc0VudGVyLmFwcGVuZCgndGV4dCcpXG5cdFx0XHRcdFx0LmF0dHIoJ3RleHQtYW5jaG9yJywgJ3N0YXJ0Jylcblx0XHRcdFx0XHQuYXR0cignY2xhc3MnLCdudi1sZWdlbmQtdGV4dCcpXG5cdFx0XHRcdFx0LmF0dHIoJ2R5JywgJy4zMmVtJylcblx0XHRcdFx0XHQuYXR0cignZHgnLCAnMCcpO1xuXG5cdFx0XHRcdHZhciBzZXJpZXNUZXh0ID0gc2VyaWVzLnNlbGVjdCgndGV4dC5udi1sZWdlbmQtdGV4dCcpLFxuXHRcdFx0XHRcdHNlcmllc1JlbW92ZSA9IHNlcmllcy5zZWxlY3QoJy5udi1yZW1vdmUtYnRuJyk7XG5cblx0XHRcdFx0c2VyaWVzXG5cdFx0XHRcdFx0Lm9uKCdtb3VzZW92ZXInLCBmdW5jdGlvbihkLGkpIHtcblx0XHRcdFx0XHRcdGNoYXJ0TGVnZW5kLmRpc3BhdGNoLmxlZ2VuZE1vdXNlb3ZlcihkLGkpOyAgLy9UT0RPOiBNYWtlIGNvbnNpc3RlbnQgd2l0aCBvdGhlciBldmVudCBvYmplY3RzXG5cdFx0XHRcdFx0fSlcblx0XHRcdFx0XHQub24oJ21vdXNlb3V0JywgZnVuY3Rpb24oZCxpKSB7XG5cdFx0XHRcdFx0XHRjaGFydExlZ2VuZC5kaXNwYXRjaC5sZWdlbmRNb3VzZW91dChkLGkpO1xuXHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0Lm9uKCdjbGljaycsIGZ1bmN0aW9uKGQsaSkge1xuXG5cdFx0XHRcdFx0XHRpZiggQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImdyb3VwLWJ5LXZhcmlhYmxlc1wiICkgfHwgYWRkQ291bnRyeU1vZGUgIT09IFwiYWRkLWNvdW50cnlcIiApIHtcblx0XHRcdFx0XHRcdFx0Ly9pZiBkaXNwbGF5aW5nIHZhcmlhYmxlcywgaW5zdGVhZCBvZiByZW1vdmluZywgdXNlIG9yaWdpbmFsIHZlcnNpb24ganVzdCB0byB0dXJuIHN0dWZmIG9mZlxuXHRcdFx0XHRcdFx0XHQvL29yaWdpbmFsIHZlcnNpb24sIHdoZW4gY2xpY2tpbmcgY291bnRyeSBsYWJlbCBqdXN0IGRlYWN0aXZhdGVzIGl0XG5cdFx0XHRcdFx0XHRcdGNoYXJ0TGVnZW5kLmRpc3BhdGNoLmxlZ2VuZENsaWNrKGQsaSk7XG5cdFx0XHRcdFx0XHRcdC8vIG1ha2Ugc3VyZSB3ZSByZS1nZXQgZGF0YSBpbiBjYXNlIGl0IHdhcyBtb2RpZmllZFxuXHRcdFx0XHRcdFx0XHR2YXIgZGF0YSA9IHNlcmllcy5kYXRhKCk7XG5cdFx0XHRcdFx0XHRcdGlmICh1cGRhdGVTdGF0ZSkge1xuXHRcdFx0XHRcdFx0XHRcdGlmKGV4cGFuZGVkKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRkLmRpc2VuZ2FnZWQgPSAhZC5kaXNlbmdhZ2VkO1xuXHRcdFx0XHRcdFx0XHRcdFx0ZC51c2VyRGlzYWJsZWQgPSBkLnVzZXJEaXNhYmxlZCA9PSB1bmRlZmluZWQgPyAhIWQuZGlzYWJsZWQgOiBkLnVzZXJEaXNhYmxlZDtcblx0XHRcdFx0XHRcdFx0XHRcdGQuZGlzYWJsZWQgPSBkLmRpc2VuZ2FnZWQgfHwgZC51c2VyRGlzYWJsZWQ7XG5cdFx0XHRcdFx0XHRcdFx0fSBlbHNlIGlmICghZXhwYW5kZWQpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGQuZGlzYWJsZWQgPSAhZC5kaXNhYmxlZDtcblx0XHRcdFx0XHRcdFx0XHRcdGQudXNlckRpc2FibGVkID0gZC5kaXNhYmxlZDtcblx0XHRcdFx0XHRcdFx0XHRcdHZhciBlbmdhZ2VkID0gZGF0YS5maWx0ZXIoZnVuY3Rpb24oZCkgeyByZXR1cm4gIWQuZGlzZW5nYWdlZDsgfSk7XG5cdFx0XHRcdFx0XHRcdFx0XHRpZiAoZW5nYWdlZC5ldmVyeShmdW5jdGlvbihzZXJpZXMpIHsgcmV0dXJuIHNlcmllcy51c2VyRGlzYWJsZWQgfSkpIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0Ly90aGUgZGVmYXVsdCBiZWhhdmlvciBvZiBOVkQzIGxlZ2VuZHMgaXMsIGlmIGV2ZXJ5IHNpbmdsZSBzZXJpZXNcblx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gaXMgZGlzYWJsZWQsIHR1cm4gYWxsIHNlcmllcycgYmFjayBvbi5cblx0XHRcdFx0XHRcdFx0XHRcdFx0ZGF0YS5mb3JFYWNoKGZ1bmN0aW9uKHNlcmllcykge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHNlcmllcy5kaXNhYmxlZCA9IHNlcmllcy51c2VyRGlzYWJsZWQgPSBmYWxzZTtcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdGNoYXJ0TGVnZW5kLmRpc3BhdGNoLnN0YXRlQ2hhbmdlKHtcblx0XHRcdFx0XHRcdFx0XHRcdGRpc2FibGVkOiBkYXRhLm1hcChmdW5jdGlvbihkKSB7IHJldHVybiAhIWQuZGlzYWJsZWQ7IH0pLFxuXHRcdFx0XHRcdFx0XHRcdFx0ZGlzZW5nYWdlZDogZGF0YS5tYXAoZnVuY3Rpb24oZCkgeyByZXR1cm4gISFkLmRpc2VuZ2FnZWQ7IH0pXG5cdFx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblxuXHRcdFx0XHRcdFx0XHQvL3doZW4gY2xpY2tpbmcgY291bnRyeSBsYWJlbCwgcmVtb3ZlIHRoZSBjb3VudHJ5XG5cdFx0XHRcdFx0XHRcdGQzLmV2ZW50LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHRcdFx0XHQvL3JlbW92ZSBzZXJpZXMgc3RyYWlnaHQgYXdheSwgc28gd2UgZG9uJ3QgaGF2ZSB0byB3YWl0IGZvciByZXNwb25zZSBmcm9tIHNlcnZlclxuXHRcdFx0XHRcdFx0XHRzZXJpZXNbMF1baV0ucmVtb3ZlKCk7XG5cdFx0XHRcdFx0XHRcdFxuXHRcdFx0XHRcdFx0XHR2YXIgaWQgPSBkLmlkO1xuXHRcdFx0XHRcdFx0XHQvL2luIGNhc2Ugb2YgbXVsdGl2YXJpZW50IGNoYXJ0XG5cdFx0XHRcdFx0XHRcdGlmKCBpZC5pbmRleE9mKCBcIi1cIiApID4gMCApIHtcblx0XHRcdFx0XHRcdFx0XHRpZCA9IHBhcnNlSW50KCBpZC5zcGxpdCggXCItXCIgKVsgMCBdLCAxMCApO1xuXHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdGlkID0gcGFyc2VJbnQoIGlkLCAxMCApO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGRpc3BhdGNoLnJlbW92ZUVudGl0eSggaWQgKTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR9KVxuXHRcdFx0XHRcdC5vbignZGJsY2xpY2snLCBmdW5jdGlvbihkLGkpIHtcblx0XHRcdFx0XHRcdGlmKCh2ZXJzID09ICdmdXJpb3VzJyB8fCB2ZXJzID09ICdvd2QnKSAmJiBleHBhbmRlZCkgcmV0dXJuO1xuXHRcdFx0XHRcdFx0Y2hhcnRMZWdlbmQuZGlzcGF0Y2gubGVnZW5kRGJsY2xpY2soZCxpKTtcblx0XHRcdFx0XHRcdGlmICh1cGRhdGVTdGF0ZSkge1xuXHRcdFx0XHRcdFx0XHQvLyBtYWtlIHN1cmUgd2UgcmUtZ2V0IGRhdGEgaW4gY2FzZSBpdCB3YXMgbW9kaWZpZWRcblx0XHRcdFx0XHRcdFx0dmFyIGRhdGEgPSBzZXJpZXMuZGF0YSgpO1xuXHRcdFx0XHRcdFx0XHQvL3RoZSBkZWZhdWx0IGJlaGF2aW9yIG9mIE5WRDMgbGVnZW5kcywgd2hlbiBkb3VibGUgY2xpY2tpbmcgb25lLFxuXHRcdFx0XHRcdFx0XHQvLyBpcyB0byBzZXQgYWxsIG90aGVyIHNlcmllcycgdG8gZmFsc2UsIGFuZCBtYWtlIHRoZSBkb3VibGUgY2xpY2tlZCBzZXJpZXMgZW5hYmxlZC5cblx0XHRcdFx0XHRcdFx0ZGF0YS5mb3JFYWNoKGZ1bmN0aW9uKHNlcmllcykge1xuXHRcdFx0XHRcdFx0XHRcdHNlcmllcy5kaXNhYmxlZCA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdFx0aWYodmVycyA9PSAnZnVyaW91cycgfHwgdmVycyA9PSAnb3dkJykgc2VyaWVzLnVzZXJEaXNhYmxlZCA9IHNlcmllcy5kaXNhYmxlZDtcblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdGQuZGlzYWJsZWQgPSBmYWxzZTtcblx0XHRcdFx0XHRcdFx0aWYodmVycyA9PSAnZnVyaW91cycgfHwgdmVycyA9PSAnb3dkJyApIGQudXNlckRpc2FibGVkID0gZC5kaXNhYmxlZDtcblx0XHRcdFx0XHRcdFx0Y2hhcnRMZWdlbmQuZGlzcGF0Y2guc3RhdGVDaGFuZ2Uoe1xuXHRcdFx0XHRcdFx0XHRcdGRpc2FibGVkOiBkYXRhLm1hcChmdW5jdGlvbihkKSB7IHJldHVybiAhIWQuZGlzYWJsZWQ7IH0pXG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHNlcmllc1JlbW92ZS5vbiggJ2NsaWNrJywgZnVuY3Rpb24oIGQsIGkgKSB7XG5cblx0XHRcdFx0XHRkMy5ldmVudC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcblx0XHRcdFx0XHQvL3JlbW92ZSBzZXJpZXMgc3RyYWlnaHQgYXdheSwgc28gd2UgZG9uJ3QgaGF2ZSB0byB3YWl0IGZvciByZXNwb25zZSBmcm9tIHNlcnZlclxuXHRcdFx0XHRcdHNlcmllc1swXVtpXS5yZW1vdmUoKTtcblx0XHRcdFx0XHRkaXNwYXRjaC5yZW1vdmVFbnRpdHkoIGQuaWQgKTtcblx0XHRcdFx0XHRcblx0XHRcdFx0fSApO1x0XG5cblx0XHRcdFx0c2VyaWVzLmNsYXNzZWQoJ252LWRpc2FibGVkJywgZnVuY3Rpb24oZCkgeyByZXR1cm4gZC51c2VyRGlzYWJsZWQ7IH0pO1xuXHRcdFx0XHRzZXJpZXMuZXhpdCgpLnJlbW92ZSgpO1xuXG5cdFx0XHRcdHNlcmllc1RleHRcblx0XHRcdFx0XHQuYXR0cignZmlsbCcsIHNldFRleHRDb2xvcilcblx0XHRcdFx0XHQudGV4dChnZXRLZXkpO1xuXG5cdFx0XHRcdC8vVE9ETzogaW1wbGVtZW50IGZpeGVkLXdpZHRoIGFuZCBtYXgtd2lkdGggb3B0aW9ucyAobWF4LXdpZHRoIGlzIGVzcGVjaWFsbHkgdXNlZnVsIHdpdGggdGhlIGFsaWduIG9wdGlvbilcblx0XHRcdFx0Ly8gTkVXIEFMSUdOSU5HIENPREUsIFRPRE86IGNsZWFuIHVwXG5cdFx0XHRcdHZhciBsZWdlbmRXaWR0aCA9IDAsXG5cdFx0XHRcdFx0dHJhbnNmb3JtWCwgdHJhbnNmb3JtWTtcblx0XHRcdFx0aWYgKGFsaWduKSB7XG5cblx0XHRcdFx0XHR2YXIgc2VyaWVzV2lkdGhzID0gW107XG5cdFx0XHRcdFx0c2VyaWVzLmVhY2goIGZ1bmN0aW9uKGQsaSkge1xuXHRcdFx0XHRcdFx0dmFyIGxlZ2VuZFRleHQgPSBkMy5zZWxlY3QodGhpcykuc2VsZWN0KCd0ZXh0Jyk7XG5cdFx0XHRcdFx0XHR2YXIgbm9kZVRleHRMZW5ndGg7XG5cdFx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0XHRub2RlVGV4dExlbmd0aCA9IGxlZ2VuZFRleHQubm9kZSgpLmdldENvbXB1dGVkVGV4dExlbmd0aCgpO1xuXHRcdFx0XHRcdFx0XHQvLyBJZiB0aGUgbGVnZW5kVGV4dCBpcyBkaXNwbGF5Om5vbmUnZCAobm9kZVRleHRMZW5ndGggPT0gMCksIHNpbXVsYXRlIGFuIGVycm9yIHNvIHdlIGFwcHJveGltYXRlLCBpbnN0ZWFkXG5cdFx0XHRcdFx0XHRcdGlmKG5vZGVUZXh0TGVuZ3RoIDw9IDApIHRocm93IEVycm9yKCk7XG5cdFx0XHRcdFx0XHR9IGNhdGNoKCBlICkge1xuXHRcdFx0XHRcdFx0XHRub2RlVGV4dExlbmd0aCA9IG52LnV0aWxzLmNhbGNBcHByb3hUZXh0V2lkdGgobGVnZW5kVGV4dCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRzZXJpZXNXaWR0aHMucHVzaChub2RlVGV4dExlbmd0aCArIHBhZGRpbmcpO1xuXHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0dmFyIHNlcmllc1BlclJvdyA9IDA7XG5cdFx0XHRcdFx0dmFyIGNvbHVtbldpZHRocyA9IFtdO1xuXHRcdFx0XHRcdGxlZ2VuZFdpZHRoID0gMDtcblxuXHRcdFx0XHRcdHdoaWxlKCBsZWdlbmRXaWR0aCA8IGF2YWlsYWJsZVdpZHRoICYmIHNlcmllc1BlclJvdyA8IHNlcmllc1dpZHRocy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0XHRjb2x1bW5XaWR0aHNbc2VyaWVzUGVyUm93XSA9IHNlcmllc1dpZHRoc1tzZXJpZXNQZXJSb3ddO1xuXHRcdFx0XHRcdFx0bGVnZW5kV2lkdGggKz0gc2VyaWVzV2lkdGhzW3Nlcmllc1BlclJvdysrXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYoIHNlcmllc1BlclJvdyA9PT0gMCApIHNlcmllc1BlclJvdyA9IDE7IC8vbWluaW11bSBvZiBvbmUgc2VyaWVzIHBlciByb3dcblxuXHRcdFx0XHRcdHdoaWxlKCBsZWdlbmRXaWR0aCA+IGF2YWlsYWJsZVdpZHRoICYmIHNlcmllc1BlclJvdyA+IDEgKSB7XG5cdFx0XHRcdFx0XHRjb2x1bW5XaWR0aHMgPSBbXTtcblx0XHRcdFx0XHRcdHNlcmllc1BlclJvdy0tO1xuXG5cdFx0XHRcdFx0XHRmb3IgKHZhciBrID0gMDsgayA8IHNlcmllc1dpZHRocy5sZW5ndGg7IGsrKykge1xuXHRcdFx0XHRcdFx0XHRpZiAoc2VyaWVzV2lkdGhzW2tdID4gKGNvbHVtbldpZHRoc1trICUgc2VyaWVzUGVyUm93XSB8fCAwKSApXG5cdFx0XHRcdFx0XHRcdFx0Y29sdW1uV2lkdGhzW2sgJSBzZXJpZXNQZXJSb3ddID0gc2VyaWVzV2lkdGhzW2tdO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRsZWdlbmRXaWR0aCA9IGNvbHVtbldpZHRocy5yZWR1Y2UoZnVuY3Rpb24ocHJldiwgY3VyLCBpbmRleCwgYXJyYXkpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHByZXYgKyBjdXI7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR2YXIgeFBvc2l0aW9ucyA9IFtdO1xuXHRcdFx0XHRcdGZvciAodmFyIGkgPSAwLCBjdXJYID0gMDsgaSA8IHNlcmllc1BlclJvdzsgaSsrKSB7XG5cdFx0XHRcdFx0XHR4UG9zaXRpb25zW2ldID0gY3VyWDtcblx0XHRcdFx0XHRcdGN1clggKz0gY29sdW1uV2lkdGhzW2ldO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHNlcmllc1xuXHRcdFx0XHRcdFx0LmF0dHIoJ3RyYW5zZm9ybScsIGZ1bmN0aW9uKGQsIGkpIHtcblx0XHRcdFx0XHRcdFx0dHJhbnNmb3JtWCA9IHhQb3NpdGlvbnNbaSAlIHNlcmllc1BlclJvd107XG5cdFx0XHRcdFx0XHRcdHRyYW5zZm9ybVkgPSAoNSArIE1hdGguZmxvb3IoaSAvIHNlcmllc1BlclJvdykgKiB2ZXJzUGFkZGluZyk7XG5cdFx0XHRcdFx0XHRcdHJldHVybiAndHJhbnNsYXRlKCcgKyB0cmFuc2Zvcm1YICsgJywnICsgdHJhbnNmb3JtWSArICcpJztcblx0XHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0Ly9wb3NpdGlvbiBsZWdlbmQgYXMgZmFyIHJpZ2h0IGFzIHBvc3NpYmxlIHdpdGhpbiB0aGUgdG90YWwgd2lkdGhcblx0XHRcdFx0XHRpZiAocmlnaHRBbGlnbikge1xuXHRcdFx0XHRcdFx0Zy5hdHRyKCd0cmFuc2Zvcm0nLCAndHJhbnNsYXRlKCcgKyAod2lkdGggLSBtYXJnaW4ucmlnaHQgLSBsZWdlbmRXaWR0aCkgKyAnLCcgKyBtYXJnaW4udG9wICsgJyknKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0XHRnLmF0dHIoJ3RyYW5zZm9ybScsICd0cmFuc2xhdGUoJyArIGVudGl0eUxhYmVsV2lkdGggKyAnLCcgKyBtYXJnaW4udG9wICsgJyknKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRoZWlnaHQgPSBtYXJnaW4udG9wICsgbWFyZ2luLmJvdHRvbSArIChNYXRoLmNlaWwoc2VyaWVzV2lkdGhzLmxlbmd0aCAvIHNlcmllc1BlclJvdykgKiB2ZXJzUGFkZGluZyk7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdH0gZWxzZSB7XG5cblx0XHRcdFx0XHR2YXIgeXBvcyA9IDUsXG5cdFx0XHRcdFx0XHRuZXd4cG9zID0gNSxcblx0XHRcdFx0XHRcdG1heHdpZHRoID0gMCxcblx0XHRcdFx0XHRcdHhwb3M7XG5cdFx0XHRcdFx0c2VyaWVzXG5cdFx0XHRcdFx0XHQuYXR0cigndHJhbnNmb3JtJywgZnVuY3Rpb24oZCwgaSkge1xuXHRcdFx0XHRcdFx0XHR2YXIgbGVuZ3RoID0gZDMuc2VsZWN0KHRoaXMpLnNlbGVjdCgndGV4dCcpLm5vZGUoKS5nZXRDb21wdXRlZFRleHRMZW5ndGgoKSArIHBhZGRpbmc7XG5cdFx0XHRcdFx0XHRcdHhwb3MgPSBuZXd4cG9zO1xuXG5cdFx0XHRcdFx0XHRcdGlmICh3aWR0aCA8IG1hcmdpbi5sZWZ0ICsgbWFyZ2luLnJpZ2h0ICsgeHBvcyArIGxlbmd0aCkge1xuXHRcdFx0XHRcdFx0XHRcdG5ld3hwb3MgPSB4cG9zID0gNTtcblx0XHRcdFx0XHRcdFx0XHR5cG9zICs9IHZlcnNQYWRkaW5nO1xuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0bmV3eHBvcyArPSBsZW5ndGg7XG5cdFx0XHRcdFx0XHRcdGlmIChuZXd4cG9zID4gbWF4d2lkdGgpIG1heHdpZHRoID0gbmV3eHBvcztcblxuXHRcdFx0XHRcdFx0XHRpZihsZWdlbmRXaWR0aCA8IHhwb3MgKyBtYXh3aWR0aCkge1xuXHRcdFx0XHRcdFx0XHRcdGxlZ2VuZFdpZHRoID0geHBvcyArIG1heHdpZHRoO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdHJldHVybiAndHJhbnNsYXRlKCcgKyB4cG9zICsgJywnICsgeXBvcyArICcpJztcblx0XHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0Ly9wb3NpdGlvbiBsZWdlbmQgYXMgZmFyIHJpZ2h0IGFzIHBvc3NpYmxlIHdpdGhpbiB0aGUgdG90YWwgd2lkdGhcblx0XHRcdFx0XHRnLmF0dHIoJ3RyYW5zZm9ybScsICd0cmFuc2xhdGUoJyArICh3aWR0aCAtIG1hcmdpbi5yaWdodCAtIG1heHdpZHRoKSArICcsJyArIG1hcmdpbi50b3AgKyAnKScpO1xuXG5cdFx0XHRcdFx0aGVpZ2h0ID0gbWFyZ2luLnRvcCArIG1hcmdpbi5ib3R0b20gKyB5cG9zICsgMTU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBTaXplIHJlY3RhbmdsZXMgYWZ0ZXIgdGV4dCBpcyBwbGFjZWRcblx0XHRcdFx0c2VyaWVzU2hhcGVcblx0XHRcdFx0XHQuYXR0cignd2lkdGgnLCBmdW5jdGlvbihkLGkpIHtcblx0XHRcdFx0XHRcdC8vcG9zaXRpb24gcmVtb3ZlIGJ0blxuXHRcdFx0XHRcdFx0dmFyIHdpZHRoID0gc2VyaWVzVGV4dFswXVtpXS5nZXRDb21wdXRlZFRleHRMZW5ndGgoKSArIDU7XG5cdFx0XHRcdFx0XHRkMy5zZWxlY3QoIHNlcmllc1JlbW92ZVswXVtpXSApLmF0dHIoICd0cmFuc2Zvcm0nLCAndHJhbnNsYXRlKCcgKyB3aWR0aCArICcsLTMpJyApO1xuXHRcdFx0XHRcdFx0cmV0dXJuIHdpZHRoKzI1O1xuXHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0LmF0dHIoJ2hlaWdodCcsIDI0KVxuXHRcdFx0XHRcdC5hdHRyKCd5JywgLTEyKVxuXHRcdFx0XHRcdC5hdHRyKCd4JywgLTEyKTtcblxuXHRcdFx0XHQvLyBUaGUgYmFja2dyb3VuZCBmb3IgdGhlIGV4cGFuZGVkIGxlZ2VuZCAoVUkpXG5cdFx0XHRcdGdFbnRlci5pbnNlcnQoJ3JlY3QnLCc6Zmlyc3QtY2hpbGQnKVxuXHRcdFx0XHRcdC5hdHRyKCdjbGFzcycsICdudi1sZWdlbmQtYmcnKVxuXHRcdFx0XHRcdC5hdHRyKCdmaWxsJywgJyNlZWUnKVxuXHRcdFx0XHRcdC8vIC5hdHRyKCdzdHJva2UnLCAnIzQ0NCcpXG5cdFx0XHRcdFx0LmF0dHIoJ29wYWNpdHknLDApO1xuXG5cdFx0XHRcdHZhciBzZXJpZXNCRyA9IGcuc2VsZWN0KCcubnYtbGVnZW5kLWJnJyk7XG5cblx0XHRcdFx0c2VyaWVzQkdcblx0XHRcdFx0LnRyYW5zaXRpb24oKS5kdXJhdGlvbigzMDApXG5cdFx0XHRcdFx0LmF0dHIoJ3gnLCAtdmVyc1BhZGRpbmcgKVxuXHRcdFx0XHRcdC5hdHRyKCd3aWR0aCcsIGxlZ2VuZFdpZHRoICsgdmVyc1BhZGRpbmcgLSAxMilcblx0XHRcdFx0XHQuYXR0cignaGVpZ2h0JywgaGVpZ2h0IClcblx0XHRcdFx0XHQuYXR0cigneScsIC1tYXJnaW4udG9wIC0gMTApXG5cdFx0XHRcdFx0LmF0dHIoJ29wYWNpdHknLCBleHBhbmRlZCA/IDEgOiAwKTtcblxuXHRcdFx0XHRzZXJpZXNTaGFwZVxuXHRcdFx0XHRcdC5zdHlsZSgnZmlsbCcsIHNldEJHQ29sb3IpXG5cdFx0XHRcdFx0LnN0eWxlKCdmaWxsLW9wYWNpdHknLCBzZXRCR09wYWNpdHkpXG5cdFx0XHRcdFx0LnN0eWxlKCdzdHJva2UnLCBzZXRCR0NvbG9yKTtcblxuXHRcdFx0XHQvL3Bvc2l0aW9uIGFkZCBidG5cblx0XHRcdFx0aWYoIHNlcmllcy5zaXplKCkgKSB7XG5cblx0XHRcdFx0XHR2YXIgc2VyaWVzQXJyID0gc2VyaWVzWzBdO1xuXHRcdFx0XHRcdGlmKCBzZXJpZXNBcnIgJiYgc2VyaWVzQXJyLmxlbmd0aCApIHtcblx0XHRcdFx0XHRcdC8vZmV0Y2ggbGFzdCBlbGVtZW50IHRvIGtub3cgaXRzIHdpZHRoXG5cdFx0XHRcdFx0XHR2YXIgbGFzdEVsID0gc2VyaWVzQXJyWyBzZXJpZXNBcnIubGVuZ3RoLTEgXSxcblx0XHRcdFx0XHRcdFx0Ly9uZWVkIHJlY3QgaW5zaWRlIGVsZW1lbnQgdGhhdCBoYXMgc2V0IHdpZHRoXG5cdFx0XHRcdFx0XHRcdGxhc3RSZWN0ID0gZDMuc2VsZWN0KCBsYXN0RWwgKS5zZWxlY3QoIFwicmVjdFwiICksXG5cdFx0XHRcdFx0XHRcdGxhc3RSZWN0V2lkdGggPSBsYXN0UmVjdC5hdHRyKCBcIndpZHRoXCIgKTtcblx0XHRcdFx0XHRcdC8vcG9zaXRpb24gYWRkIGJ0blxuXHRcdFx0XHRcdFx0dHJhbnNmb3JtWCA9ICt0cmFuc2Zvcm1YICsgcGFyc2VJbnQoIGxhc3RSZWN0V2lkdGgsIDEwICkgLSAzO1xuXHRcdFx0XHRcdFx0dHJhbnNmb3JtWCArPSBlbnRpdHlMYWJlbFdpZHRoO1xuXHRcdFx0XHRcdFx0Ly9jZW50ZXJpbmdcblx0XHRcdFx0XHRcdHRyYW5zZm9ybVkgPSArdHJhbnNmb3JtWSAtIDM7XG5cdFx0XHRcdFx0XHQvL2NoZWNrIGZvciByaWdodCBlZGdlXG5cdFx0XHRcdFx0XHR2YXIgYnV0dG9uV2lkdGggPSAxMjAsIGJ1dHRvbkhlaWdodCA9IDM1O1xuXHRcdFx0XHRcdFx0aWYoICggdHJhbnNmb3JtWCArIGJ1dHRvbldpZHRoICkgPiBhdmFpbGFibGVXaWR0aCApIHtcblx0XHRcdFx0XHRcdFx0Ly9tYWtlIHN1cmUgd2UgaGF2ZSBidXR0b25cblx0XHRcdFx0XHRcdFx0dmFyIGFkZEVudGl0eURpc3BsYXkgPSBhZGRFbnRpdHlCdG4uYXR0ciggXCJkaXNwbGF5XCIgKTtcblx0XHRcdFx0XHRcdFx0aWYoIGFkZEVudGl0eURpc3BsYXkgIT09IFwibm9uZVwiICkge1xuXHRcdFx0XHRcdFx0XHRcdHRyYW5zZm9ybVggPSAwOy8vYXZhaWxhYmxlV2lkdGggLSBidXR0b25XaWR0aDtcblx0XHRcdFx0XHRcdFx0XHR0cmFuc2Zvcm1ZICs9IGJ1dHRvbkhlaWdodDtcblx0XHRcdFx0XHRcdFx0XHQvL3VwZGF0ZSB3aG9sZSBjaGFydCBoZWlnaHQgYXMgd2VsbFxuXHRcdFx0XHRcdFx0XHRcdGhlaWdodCArPSBidXR0b25IZWlnaHQ7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5hdHRyKCBcInRyYW5zZm9ybVwiLCBcInRyYW5zbGF0ZSggXCIgKyB0cmFuc2Zvcm1YICsgXCIsIFwiICsgdHJhbnNmb3JtWSArIFwiKVwiICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XG5cdFx0XHRcdH1cblx0XHRcdFxuXHRcdFx0fSk7XG5cdFx0XHRcblx0XHRcdGZ1bmN0aW9uIHNldFRleHRDb2xvcihkLGkpIHtcblx0XHRcdFx0aWYodmVycyAhPSAnZnVyaW91cycgJiYgdmVycyAhPSAnb3dkJykgcmV0dXJuICcjMDAwJztcblx0XHRcdFx0aWYoZXhwYW5kZWQpIHtcblx0XHRcdFx0XHRyZXR1cm4gZC5kaXNlbmdhZ2VkID8gJyMwMDAnIDogJyNmZmYnO1xuXHRcdFx0XHR9IGVsc2UgaWYgKCFleHBhbmRlZCkge1xuXHRcdFx0XHRcdGlmKCFkLmNvbG9yKSBkLmNvbG9yID0gY29sb3IoZCxpKTtcblx0XHRcdFx0XHRyZXR1cm4gISFkLmRpc2FibGVkID8gJyM2NjYnIDogJyNmZmYnO1xuXHRcdFx0XHRcdC8vcmV0dXJuICEhZC5kaXNhYmxlZCA/IGQuY29sb3IgOiAnI2ZmZic7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0ZnVuY3Rpb24gc2V0QkdDb2xvcihkLGkpIHtcblx0XHRcdFx0aWYoZXhwYW5kZWQgJiYgKHZlcnMgPT0gJ2Z1cmlvdXMnIHx8IHZlcnMgPT0gJ293ZCcpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGQuZGlzZW5nYWdlZCA/ICcjZWVlJyA6IGQuY29sb3IgfHwgY29sb3IoZCxpKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXR1cm4gZC5jb2xvciB8fCBjb2xvcihkLGkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblxuXHRcdFx0ZnVuY3Rpb24gc2V0QkdPcGFjaXR5KGQsaSkge1xuXHRcdFx0XHRpZihleHBhbmRlZCAmJiAodmVycyA9PSAnZnVyaW91cycgfHwgdmVycyA9PSAnb3dkJykpIHtcblx0XHRcdFx0XHRyZXR1cm4gMTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXR1cm4gISFkLmRpc2FibGVkID8gMCA6IDE7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGNoYXJ0O1xuXHRcdH1cblxuXHRcdC8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cdFx0Ly8gRXhwb3NlIFB1YmxpYyBWYXJpYWJsZXNcblx0XHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5cdFx0Y2hhcnQuZGlzcGF0Y2ggPSBkaXNwYXRjaDtcblx0XHRjaGFydC5vcHRpb25zID0gbnYudXRpbHMub3B0aW9uc0Z1bmMuYmluZChjaGFydCk7XG5cblx0XHRjaGFydC5fb3B0aW9ucyA9IE9iamVjdC5jcmVhdGUoe30sIHtcblx0XHRcdC8vIHNpbXBsZSBvcHRpb25zLCBqdXN0IGdldC9zZXQgdGhlIG5lY2Vzc2FyeSB2YWx1ZXNcblx0XHRcdHdpZHRoOiAgICAgIHtnZXQ6IGZ1bmN0aW9uKCl7cmV0dXJuIHdpZHRoO30sIHNldDogZnVuY3Rpb24oXyl7d2lkdGg9Xzt9fSxcblx0XHRcdGhlaWdodDogICAgIHtnZXQ6IGZ1bmN0aW9uKCl7cmV0dXJuIGhlaWdodDt9LCBzZXQ6IGZ1bmN0aW9uKF8pe2hlaWdodD1fO319LFxuXHRcdFx0a2V5OiAgICAgICAge2dldDogZnVuY3Rpb24oKXtyZXR1cm4gZ2V0S2V5O30sIHNldDogZnVuY3Rpb24oXyl7Z2V0S2V5PV87fX0sXG5cdFx0XHRhbGlnbjogICAgICB7Z2V0OiBmdW5jdGlvbigpe3JldHVybiBhbGlnbjt9LCBzZXQ6IGZ1bmN0aW9uKF8pe2FsaWduPV87fX0sXG5cdFx0XHRyaWdodEFsaWduOiAgICB7Z2V0OiBmdW5jdGlvbigpe3JldHVybiByaWdodEFsaWduO30sIHNldDogZnVuY3Rpb24oXyl7cmlnaHRBbGlnbj1fO319LFxuXHRcdFx0cGFkZGluZzogICAgICAge2dldDogZnVuY3Rpb24oKXtyZXR1cm4gcGFkZGluZzt9LCBzZXQ6IGZ1bmN0aW9uKF8pe3BhZGRpbmc9Xzt9fSxcblx0XHRcdHVwZGF0ZVN0YXRlOiAgIHtnZXQ6IGZ1bmN0aW9uKCl7cmV0dXJuIHVwZGF0ZVN0YXRlO30sIHNldDogZnVuY3Rpb24oXyl7dXBkYXRlU3RhdGU9Xzt9fSxcblx0XHRcdHJhZGlvQnV0dG9uTW9kZTogICAge2dldDogZnVuY3Rpb24oKXtyZXR1cm4gcmFkaW9CdXR0b25Nb2RlO30sIHNldDogZnVuY3Rpb24oXyl7cmFkaW9CdXR0b25Nb2RlPV87fX0sXG5cdFx0XHRleHBhbmRlZDogICB7Z2V0OiBmdW5jdGlvbigpe3JldHVybiBleHBhbmRlZDt9LCBzZXQ6IGZ1bmN0aW9uKF8pe2V4cGFuZGVkPV87fX0sXG5cdFx0XHR2ZXJzOiAgIHtnZXQ6IGZ1bmN0aW9uKCl7cmV0dXJuIHZlcnM7fSwgc2V0OiBmdW5jdGlvbihfKXt2ZXJzPV87fX0sXG5cblx0XHRcdC8vIG9wdGlvbnMgdGhhdCByZXF1aXJlIGV4dHJhIGxvZ2ljIGluIHRoZSBzZXR0ZXJcblx0XHRcdG1hcmdpbjoge2dldDogZnVuY3Rpb24oKXtyZXR1cm4gbWFyZ2luO30sIHNldDogZnVuY3Rpb24oXyl7XG5cdFx0XHRcdG1hcmdpbi50b3AgICAgPSBfLnRvcCAgICAhPT0gdW5kZWZpbmVkID8gXy50b3AgICAgOiBtYXJnaW4udG9wO1xuXHRcdFx0XHRtYXJnaW4ucmlnaHQgID0gXy5yaWdodCAgIT09IHVuZGVmaW5lZCA/IF8ucmlnaHQgIDogbWFyZ2luLnJpZ2h0O1xuXHRcdFx0XHRtYXJnaW4uYm90dG9tID0gXy5ib3R0b20gIT09IHVuZGVmaW5lZCA/IF8uYm90dG9tIDogbWFyZ2luLmJvdHRvbTtcblx0XHRcdFx0bWFyZ2luLmxlZnQgICA9IF8ubGVmdCAgICE9PSB1bmRlZmluZWQgPyBfLmxlZnQgICA6IG1hcmdpbi5sZWZ0O1xuXHRcdFx0fX0sXG5cdFx0XHRjb2xvcjogIHtnZXQ6IGZ1bmN0aW9uKCl7cmV0dXJuIGNvbG9yO30sIHNldDogZnVuY3Rpb24oXyl7XG5cdFx0XHRcdGNvbG9yID0gbnYudXRpbHMuZ2V0Q29sb3IoXyk7XG5cdFx0XHR9fVxuXHRcdH0pO1xuXG5cdFx0bnYudXRpbHMuaW5pdE9wdGlvbnMoY2hhcnQpO1xuXG5cdFx0cmV0dXJuIGNoYXJ0O1xuXHR9O1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkNoYXJ0LkxlZ2VuZDtcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBBcHAgPSByZXF1aXJlKCBcIi4vLi4vLi4vbmFtZXNwYWNlcy5qc1wiICksXG5cdFx0TWFwQ29udHJvbHMgPSByZXF1aXJlKCBcIi4vbWFwL0FwcC5WaWV3cy5DaGFydC5NYXAuTWFwQ29udHJvbHMuanNcIiApLFxuXHRcdExlZ2VuZCA9IHJlcXVpcmUoIFwiLi9tYXAvQXBwLlZpZXdzLkNoYXJ0Lk1hcC5MZWdlbmQuanNcIiApLFxuXHRcdENoYXJ0RGF0YU1vZGVsID0gcmVxdWlyZSggXCIuLy4uLy4uL21vZGVscy9BcHAuTW9kZWxzLkNoYXJ0RGF0YU1vZGVsLmpzXCIgKTtcblxuXHRBcHAuVmlld3MuQ2hhcnQuTWFwVGFiID0gQmFja2JvbmUuVmlldy5leHRlbmQoe1xuXG5cdFx0JHRhYjogbnVsbCxcblx0XHRkYXRhTWFwOiBudWxsLFxuXHRcdG1hcENvbnRyb2xzOiBudWxsLFxuXHRcdGxlZ2VuZDogbnVsbCxcblxuXHRcdGV2ZW50czoge30sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdFxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gb3B0aW9ucy5kaXNwYXRjaGVyO1xuXHRcdFx0dGhpcy5tYXBDb250cm9scyA9IG5ldyBNYXBDb250cm9scyggeyBkaXNwYXRjaGVyOiBvcHRpb25zLmRpc3BhdGNoZXIgfSApO1xuXG5cdFx0XHQvL2luaXQgbWFwIG9ubHkgaWYgdGhlIG1hcCB0YWIgZGlzcGxheWVkXG5cdFx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0XHQkKCBcIltkYXRhLXRvZ2dsZT0ndGFiJ11baHJlZj0nI21hcC1jaGFydC10YWInXVwiICkub24oIFwic2hvd24uYnMudGFiXCIsIGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHRcdHRoYXQuZGlzcGxheSgpO1xuXHRcdFx0fSApO1xuXHRcdFx0XG5cdFx0fSxcblxuXHRcdGRpc3BsYXk6IGZ1bmN0aW9uKCkge1xuXHRcdFx0Ly9yZW5kZXIgb25seSBpZiBubyBtYXAgeWV0XG5cdFx0XHRpZiggIXRoaXMuZGF0YU1hcCApIHtcblx0XHRcdFx0dGhpcy5yZW5kZXIoKTtcblx0XHRcdH1cblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblxuXHRcdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdFx0Ly9mZXRjaCBjcmVhdGVkIGRvbVxuXHRcdFx0dGhpcy4kdGFiID0gJCggXCIjbWFwLWNoYXJ0LXRhYlwiICk7XG5cblx0XHRcdHZhciBtYXBDb25maWcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwibWFwLWNvbmZpZ1wiICksXG5cdFx0XHRcdGRlZmF1bHRQcm9qZWN0aW9uID0gdGhpcy5nZXRQcm9qZWN0aW9uKCBtYXBDb25maWcucHJvamVjdGlvbiApO1xuXHRcdFx0XG5cdFx0XHR0aGlzLmRhdGFNYXAgPSBuZXcgRGF0YW1hcCgge1xuXHRcdFx0XHR3aWR0aDogdGhhdC4kdGFiLndpZHRoKCksXG5cdFx0XHRcdGhlaWdodDogdGhhdC4kdGFiLmhlaWdodCgpLFxuXHRcdFx0XHRyZXNwb25zaXZlOiB0cnVlLFxuXHRcdFx0XHRlbGVtZW50OiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggXCJtYXAtY2hhcnQtdGFiXCIgKSxcblx0XHRcdFx0Z2VvZ3JhcGh5Q29uZmlnOiB7XG5cdFx0XHRcdFx0ZGF0YVVybDogR2xvYmFsLnJvb3RVcmwgKyBcIi9idWlsZC9qcy9kYXRhL3dvcmxkLmlkcy5qc29uXCIsXG5cdFx0XHRcdFx0Ym9yZGVyV2lkdGg6IDAuMSxcblx0XHRcdFx0XHRib3JkZXJDb2xvcjogJyM0RjRGNEYnLFxuXHRcdFx0XHRcdGhpZ2hsaWdodEJvcmRlckNvbG9yOiAnYmxhY2snLFxuXHRcdFx0XHRcdGhpZ2hsaWdodEJvcmRlcldpZHRoOiAwLjIsXG5cdFx0XHRcdFx0aGlnaGxpZ2h0RmlsbENvbG9yOiAnI0ZGRUMzOCcsXG5cdFx0XHRcdFx0cG9wdXBUZW1wbGF0ZTogdGhhdC5wb3B1cFRlbXBsYXRlR2VuZXJhdG9yXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGZpbGxzOiB7XG5cdFx0XHRcdFx0ZGVmYXVsdEZpbGw6ICcjRkZGRkZGJ1xuXHRcdFx0XHRcdC8vZGVmYXVsdEZpbGw6ICcjREREREREJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRzZXRQcm9qZWN0aW9uOiBkZWZhdWx0UHJvamVjdGlvbixcblx0XHRcdFx0Ly93YWl0IGZvciBqc29uIHRvIGxvYWQgYmVmb3JlIGxvYWRpbmcgbWFwIGRhdGFcblx0XHRcdFx0ZG9uZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0dGhhdC5tYXBEYXRhTW9kZWwgPSBuZXcgQ2hhcnREYXRhTW9kZWwoKTtcblx0XHRcdFx0XHR0aGF0Lm1hcERhdGFNb2RlbC5vbiggXCJzeW5jXCIsIGZ1bmN0aW9uKCBtb2RlbCwgcmVzcG9uc2UgKSB7XG5cdFx0XHRcdFx0XHRpZiggcmVzcG9uc2UuZGF0YSApIHtcblx0XHRcdFx0XHRcdFx0dGhhdC5kaXNwbGF5RGF0YSggcmVzcG9uc2UuZGF0YSApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHR0aGF0Lm1hcERhdGFNb2RlbC5vbiggXCJlcnJvclwiLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoIFwiRXJyb3IgbG9hZGluZyBtYXAgZGF0YS5cIiApO1xuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHR0aGF0LnVwZGF0ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cblx0XHRcdHRoaXMubGVnZW5kID0gbmV3IExlZ2VuZCgpO1xuXHRcdFx0XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5vbiggXCJjaGFuZ2VcIiwgdGhpcy5vbkNoYXJ0TW9kZWxDaGFuZ2UsIHRoaXMgKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLm9uKCBcImNoYW5nZS1tYXBcIiwgdGhpcy5vbkNoYXJ0TW9kZWxDaGFuZ2UsIHRoaXMgKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLm9uKCBcInJlc2l6ZVwiLCB0aGlzLm9uQ2hhcnRNb2RlbFJlc2l6ZSwgdGhpcyApO1xuXHRcdFx0XG5cdFx0XHRudi51dGlscy53aW5kb3dSZXNpemUoICQucHJveHkoIHRoaXMub25SZXNpemUsIHRoaXMgKSApO1xuXHRcdFx0dGhpcy5vblJlc2l6ZSgpO1xuXG5cdFx0fSxcblxuXHRcdG9uQ2hhcnRNb2RlbENoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dGhpcy51cGRhdGUoKTtcblxuXHRcdH0sXG5cblx0XHRwb3B1cFRlbXBsYXRlR2VuZXJhdG9yOiBmdW5jdGlvbiggZ2VvLCBkYXRhICkge1xuXHRcdFx0Ly90cmFuc2Zvcm0gZGF0YW1hcHMgZGF0YSBpbnRvIGZvcm1hdCBjbG9zZSB0byBudmQzIHNvIHRoYXQgd2UgY2FuIHJldXNlIHRoZSBzYW1lIHBvcHVwIGdlbmVyYXRvclxuXHRcdFx0dmFyIG1hcENvbmZpZyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJtYXAtY29uZmlnXCIgKTtcblx0XHRcdHZhciBwcm9wZXJ0eU5hbWUgPSBBcHAuVXRpbHMuZ2V0UHJvcGVydHlCeVZhcmlhYmxlSWQoIEFwcC5DaGFydE1vZGVsLCBtYXBDb25maWcudmFyaWFibGVJZCApO1xuXHRcdFx0aWYoICFwcm9wZXJ0eU5hbWUgKSB7XG5cdFx0XHRcdHByb3BlcnR5TmFtZSA9IFwieVwiO1xuXHRcdFx0fVxuXHRcdFx0dmFyIG9iaiA9IHtcblx0XHRcdFx0cG9pbnQ6IHtcblx0XHRcdFx0XHR0aW1lOiBtYXBDb25maWcudGFyZ2V0WWVhciB9LFxuXHRcdFx0XHRzZXJpZXM6IFsge1xuXHRcdFx0XHRcdGtleTogZ2VvLnByb3BlcnRpZXMubmFtZVxuXHRcdFx0XHR9IF1cblx0XHRcdH07XG5cdFx0XHRvYmoucG9pbnRbIHByb3BlcnR5TmFtZSBdID0gZGF0YS52YWx1ZTtcblx0XHRcdHJldHVybiBbIFwiPGRpdiBjbGFzcz0naG92ZXJpbmZvIG52dG9vbHRpcCc+XCIgKyBBcHAuVXRpbHMuY29udGVudEdlbmVyYXRvciggb2JqLCB0cnVlICkgKyBcIjwvZGl2PlwiIF07XG5cdFx0fSxcblxuXHRcdHVwZGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcblx0XHRcdC8vY29uc3RydWN0IGRpbWVuc2lvbiBzdHJpbmdcblx0XHRcdHZhciB0aGF0ID0gdGhpcyxcblx0XHRcdFx0bWFwQ29uZmlnID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcIm1hcC1jb25maWdcIiApLFxuXHRcdFx0XHRjaGFydFRpbWUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdGltZVwiICksXG5cdFx0XHRcdHZhcmlhYmxlSWQgPSBtYXBDb25maWcudmFyaWFibGVJZCxcblx0XHRcdFx0dGFyZ2V0WWVhciA9IG1hcENvbmZpZy50YXJnZXRZZWFyLFxuXHRcdFx0XHRtb2RlID0gbWFwQ29uZmlnLm1vZGUsXG5cdFx0XHRcdHRvbGVyYW5jZSA9IG1hcENvbmZpZy50aW1lVG9sZXJhbmNlLFxuXHRcdFx0XHRkaW1lbnNpb25zID0gW3sgbmFtZTogXCJNYXBcIiwgcHJvcGVydHk6IFwibWFwXCIsIHZhcmlhYmxlSWQ6IHZhcmlhYmxlSWQsIHRhcmdldFllYXI6IHRhcmdldFllYXIsIG1vZGU6IG1vZGUsIHRvbGVyYW5jZTogdG9sZXJhbmNlIH1dLFxuXHRcdFx0XHRkaW1lbnNpb25zU3RyaW5nID0gSlNPTi5zdHJpbmdpZnkoIGRpbWVuc2lvbnMgKSxcblx0XHRcdFx0Y2hhcnRUeXBlID0gOTk5OSxcblx0XHRcdFx0c2VsZWN0ZWRDb3VudHJpZXMgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwic2VsZWN0ZWQtY291bnRyaWVzXCIgKSxcblx0XHRcdFx0c2VsZWN0ZWRDb3VudHJpZXNJZHMgPSBfLm1hcCggc2VsZWN0ZWRDb3VudHJpZXMsIGZ1bmN0aW9uKCB2ICkgeyByZXR1cm4gKHYpPyArdi5pZDogXCJcIjsgfSApO1xuXHRcdFx0XG5cdFx0XHR2YXIgZGF0YVByb3BzID0geyBcImRpbWVuc2lvbnNcIjogZGltZW5zaW9uc1N0cmluZywgXCJjaGFydElkXCI6IEFwcC5DaGFydE1vZGVsLmdldCggXCJpZFwiICksIFwiY2hhcnRUeXBlXCI6IGNoYXJ0VHlwZSwgXCJzZWxlY3RlZENvdW50cmllc1wiOiBzZWxlY3RlZENvdW50cmllc0lkcywgXCJjaGFydFRpbWVcIjogY2hhcnRUaW1lLCBcImNhY2hlXCI6IEFwcC5DaGFydE1vZGVsLmdldCggXCJjYWNoZVwiICksIFwiZ3JvdXBCeVZhcmlhYmxlc1wiOiBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiZ3JvdXAtYnktdmFyaWFibGVzXCIgKSAgfTtcblx0XHRcdHRoaXMubWFwRGF0YU1vZGVsLmZldGNoKCB7IGRhdGE6IGRhdGFQcm9wcyB9ICk7XG5cblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cblx0XHRkaXNwbGF5RGF0YTogZnVuY3Rpb24oIGRhdGEgKSB7XG5cdFx0XHRcblx0XHRcdHZhciB0aGF0ID0gdGhpcyxcblx0XHRcdFx0bWFwQ29uZmlnID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcIm1hcC1jb25maWdcIiApLFxuXHRcdFx0XHRkYXRhTWluID0gSW5maW5pdHksXG5cdFx0XHRcdGRhdGFNYXggPSAtSW5maW5pdHk7XG5cblx0XHRcdC8vbmVlZCB0byBleHRyYWN0IGxhdGVzdCB0aW1lXG5cdFx0XHR2YXIgbGF0ZXN0RGF0YSA9IGRhdGEubWFwKCBmdW5jdGlvbiggZCwgaSApIHtcblxuXHRcdFx0XHR2YXIgdmFsdWVzID0gZC52YWx1ZXMsXG5cdFx0XHRcdFx0bGF0ZXN0VGltZVZhbHVlID0gKCB2YWx1ZXMgJiYgdmFsdWVzLmxlbmd0aCApPyB2YWx1ZXNbIHZhbHVlcy5sZW5ndGggLSAxXTogMDtcblxuXHRcdFx0XHQvL2Fsc28gZ2V0IG1pbiBtYXggdmFsdWVzLCBjb3VsZCB1c2UgZDMubWluLCBkMy5tYXggb25jZSB3ZSBoYXZlIGFsbCB2YWx1ZXMsIGJ1dCB0aGlzIHByb2JhYmx5IHNhdmVzIHNvbWUgdGltZVxuXHRcdFx0XHRkYXRhTWluID0gTWF0aC5taW4oIGRhdGFNaW4sIGxhdGVzdFRpbWVWYWx1ZSApO1xuXHRcdFx0XHRkYXRhTWF4ID0gTWF0aC5tYXgoIGRhdGFNYXgsIGxhdGVzdFRpbWVWYWx1ZSApO1xuXG5cdFx0XHRcdC8vaWRzIGluIHdvcmxkIGpzb24gYXJlIG5hbWUgY291bnRyaWVzIHdpdGggdW5kZXJzY29yZSAoZGF0YW1hcHMuanMgdXNlcyBpZCBmb3Igc2VsZWN0b3IsIHNvIGNhbm5vdCBoYXZlIHdoaXRlc3BhY2UpXG5cdFx0XHRcdHJldHVybiB7IFwia2V5XCI6IGQua2V5LnJlcGxhY2UoIFwiIFwiLCBcIl9cIiApLCBcInZhbHVlXCI6IGxhdGVzdFRpbWVWYWx1ZSB9O1xuXG5cdFx0XHR9ICk7XG5cblx0XHRcdHZhciBjb2xvclNjaGVtZSA9ICggY29sb3JicmV3ZXJbIG1hcENvbmZpZy5jb2xvclNjaGVtZU5hbWUgXSAmJiBjb2xvcmJyZXdlclsgbWFwQ29uZmlnLmNvbG9yU2NoZW1lTmFtZSBdWyBtYXBDb25maWcuY29sb3JTY2hlbWVJbnRlcnZhbCBdICk/IGNvbG9yYnJld2VyWyBtYXBDb25maWcuY29sb3JTY2hlbWVOYW1lIF1bIG1hcENvbmZpZy5jb2xvclNjaGVtZUludGVydmFsIF06IFtdO1xuXHRcdFx0XG5cdFx0XHQvL25lZWQgdG8gY3JlYXRlIGNvbG9yIHNjaGVtZVxuXHRcdFx0dmFyIGNvbG9yU2NhbGUgPSBkMy5zY2FsZS5xdWFudGl6ZSgpXG5cdFx0XHRcdC5kb21haW4oIFsgZGF0YU1pbiwgZGF0YU1heCBdIClcblx0XHRcdFx0LnJhbmdlKCBjb2xvclNjaGVtZSApO1xuXG5cdFx0XHQvL25lZWQgdG8gZW5jb2RlIGNvbG9ycyBwcm9wZXJ0aWVzXG5cdFx0XHR2YXIgbWFwRGF0YSA9IHt9LFxuXHRcdFx0XHRjb2xvcnMgPSBbXTtcblx0XHRcdGxhdGVzdERhdGEuZm9yRWFjaCggZnVuY3Rpb24oIGQsIGkgKSB7XG5cdFx0XHRcdHZhciBjb2xvciA9IGNvbG9yU2NhbGUoIGQudmFsdWUgKTtcblx0XHRcdFx0bWFwRGF0YVsgZC5rZXkgXSA9IHsgXCJrZXlcIjogZC5rZXksIFwidmFsdWVcIjogZC52YWx1ZSwgXCJjb2xvclwiOiBjb2xvciB9O1xuXHRcdFx0XHRjb2xvcnMucHVzaCggY29sb3IgKTtcblx0XHRcdH0gKTtcblxuXHRcdFx0dGhpcy5sZWdlbmQuc2NhbGUoIGNvbG9yU2NhbGUgKTtcblx0XHRcdGlmKCBkMy5zZWxlY3QoIFwiLmxlZ2VuZC13cmFwcGVyXCIgKS5lbXB0eSgpICkge1xuXHRcdFx0XHRkMy5zZWxlY3QoIFwiLmRhdGFtYXBcIiApLmFwcGVuZCggXCJnXCIgKS5hdHRyKCBcImNsYXNzXCIsIFwibGVnZW5kLXdyYXBwZXJcIiApO1xuXHRcdFx0fVxuXHRcdFx0ZDMuc2VsZWN0KCBcIi5sZWdlbmQtd3JhcHBlclwiICkuZGF0dW0oIGNvbG9yU2NoZW1lICkuY2FsbCggdGhpcy5sZWdlbmQgKTtcblx0XHRcdC8vZDMuc2VsZWN0KCBcIi5kYXRhbWFwXCIgKS5kYXR1bSggY29sb3JTY2hlbWUgKS5jYWxsKCB0aGlzLmxlZ2VuZCApO1xuXG5cdFx0XHQvL3VwZGF0ZSBtYXBcblx0XHRcdC8vYXJlIHdlIGNoYW5naW5nIHByb2plY3Rpb25zP1xuXHRcdFx0dmFyIG9sZFByb2plY3Rpb24gPSB0aGlzLmRhdGFNYXAub3B0aW9ucy5zZXRQcm9qZWN0aW9uLFxuXHRcdFx0XHRuZXdQcm9qZWN0aW9uID0gdGhpcy5nZXRQcm9qZWN0aW9uKCBtYXBDb25maWcucHJvamVjdGlvbiApO1xuXHRcdFx0aWYoIG9sZFByb2plY3Rpb24gPT09IG5ld1Byb2plY3Rpb24gKSB7XG5cdFx0XHRcdC8vcHJvamVjdGlvbiBzdGF5cyB0aGUgc2FtZSwgbm8gbmVlZCB0byByZWRyYXcgdW5pdHNcblx0XHRcdFx0Ly9uZWVkIHRvIHNldCBhbGwgdW5pdHMgdG8gZGVmYXVsdCBjb2xvciBmaXJzdCwgY2F1c2UgdXBkYXRlQ2hvcGxldGgganVzdCB1cGRhdGVzIG5ldyBkYXRhIGxlYXZlcyB0aGUgb2xkIGRhdGEgZm9yIHVuaXRzIG5vIGxvbmdlciBpbiBkYXRhc2V0XG5cdFx0XHRcdGQzLnNlbGVjdEFsbCggXCJwYXRoLmRhdGFtYXBzLXN1YnVuaXRcIiApLnN0eWxlKCBcImZpbGxcIiwgdGhpcy5kYXRhTWFwLm9wdGlvbnMuZmlsbHMuZGVmYXVsdEZpbGwgKTtcblx0XHRcdFx0dGhpcy5kYXRhTWFwLnVwZGF0ZUNob3JvcGxldGgoIG1hcERhdGEgKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vY2hhbmdpbmcgcHJvamVjdGlvbiwgbmVlZCB0byByZW1vdmUgZXhpc3RpbmcgdW5pdHMsIHJlZHJhdyBldmVyeXRoaW5nIGFuZCBhZnRlciBkb25lIGRyYXdpbmcsIHVwZGF0ZSBkYXRhXG5cdFx0XHRcdGQzLnNlbGVjdEFsbCgncGF0aC5kYXRhbWFwcy1zdWJ1bml0JykucmVtb3ZlKCk7XG5cdFx0XHRcdHRoaXMuZGF0YU1hcC5vcHRpb25zLnNldFByb2plY3Rpb24gPSBuZXdQcm9qZWN0aW9uO1xuXHRcdFx0XHR0aGlzLmRhdGFNYXAuZHJhdygpO1xuXHRcdFx0XHR0aGlzLmRhdGFNYXAub3B0aW9ucy5kb25lID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0dGhhdC5kYXRhTWFwLnVwZGF0ZUNob3JvcGxldGgoIG1hcERhdGEgKTtcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdH0sXG5cblx0XHRnZXRQcm9qZWN0aW9uOiBmdW5jdGlvbiggcHJvamVjdGlvbk5hbWUgKSB7XG5cdFx0XHR2YXIgcHJvamVjdGlvbnMgPSB0aGlzLnByb2plY3Rpb25zLFxuXHRcdFx0XHRuZXdQcm9qZWN0aW9uID0gKCBwcm9qZWN0aW9uc1sgcHJvamVjdGlvbk5hbWUgXSApPyBwcm9qZWN0aW9uc1sgcHJvamVjdGlvbk5hbWUgXTogcHJvamVjdGlvbnMuV29ybGQ7XG5cdFx0XHRyZXR1cm4gbmV3UHJvamVjdGlvbjtcblx0XHRcdFxuXHRcdH0sXG5cblx0XHRvblJlc2l6ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRpZiggdGhpcy5kYXRhTWFwICkge1xuXHRcdFx0XHQvL2luc3RlYWQgb2YgY2FsbGluZyBkYXRhbWFwcyByZXNpemUsIHRoZXJlJ3MgbW9kaWZpZWQgdmVyc2lvbiBvZiB0aGUgc2FtZSBtZXRob2Rcblx0XHRcdFx0dmFyIG9wdGlvbnMgPSB0aGlzLmRhdGFNYXAub3B0aW9ucyxcblx0XHRcdFx0XHRwcmVmaXggPSAnLXdlYmtpdC10cmFuc2Zvcm0nIGluIGRvY3VtZW50LmJvZHkuc3R5bGUgPyAnLXdlYmtpdC0nIDogJy1tb3otdHJhbnNmb3JtJyBpbiBkb2N1bWVudC5ib2R5LnN0eWxlID8gJy1tb3otJyA6ICctbXMtdHJhbnNmb3JtJyBpbiBkb2N1bWVudC5ib2R5LnN0eWxlID8gJy1tcy0nIDogJycsXG5cdFx0XHRcdFx0bmV3c2l6ZSA9IG9wdGlvbnMuZWxlbWVudC5jbGllbnRXaWR0aCxcblx0XHRcdFx0XHRvbGRzaXplID0gZDMuc2VsZWN0KCBvcHRpb25zLmVsZW1lbnQpLnNlbGVjdCgnc3ZnJykuYXR0cignZGF0YS13aWR0aCcpO1xuXHRcdFx0XHRcdC8vZGlmZmVyZW50IHNlbGVjdG9yIGZyb20gZGVmYXVsdCBkYXRhbWFwcyBpbXBsZW1lbnRhdGlvbiwgZG9lc24ndCBzY2FsZSBsZWdlbmRcblx0XHRcdFx0XHRkMy5zZWxlY3Qob3B0aW9ucy5lbGVtZW50KS5zZWxlY3QoJ3N2ZycpLnNlbGVjdEFsbCgnZzpub3QoLmxlZ2VuZC1zdGVwKTpub3QoLmxlZ2VuZCknKS5zdHlsZShwcmVmaXggKyAndHJhbnNmb3JtJywgJ3NjYWxlKCcgKyAobmV3c2l6ZSAvIG9sZHNpemUpICsgJyknKTtcblx0XHRcdFx0Ly90aGlzLmRhdGFNYXAucmVzaXplKCk7XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdG9uQ2hhcnRNb2RlbFJlc2l6ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLm9uUmVzaXplKCk7XG5cdFx0fSxcblx0XG5cdFx0cHJvamVjdGlvbnM6IHsgXG5cdFx0XHRcIldvcmxkXCI6IGZ1bmN0aW9uKGVsZW1lbnQpIHtcblx0XHRcdFx0Ly9lbXBpcmljXG5cdFx0XHRcdHZhciBrID0gNjtcblx0XHRcdFx0dmFyIHByb2plY3Rpb24gPSBkMy5nZW8uZWNrZXJ0MygpXG5cdFx0XHRcdFx0LnNjYWxlKGVsZW1lbnQub2Zmc2V0V2lkdGgvaylcblx0XHRcdFx0XHQudHJhbnNsYXRlKFtlbGVtZW50Lm9mZnNldFdpZHRoIC8gMiwgZWxlbWVudC5vZmZzZXRIZWlnaHQgLyAyXSlcblx0XHRcdFx0XHQucHJlY2lzaW9uKC4xKTtcblx0XHRcdFx0dmFyIHBhdGggPSBkMy5nZW8ucGF0aCgpLnByb2plY3Rpb24ocHJvamVjdGlvbik7XG5cdFx0XHRcdHJldHVybiB7cGF0aDogcGF0aCwgcHJvamVjdGlvbjogcHJvamVjdGlvbn07XG5cdFx0XHR9LFxuXHRcdFx0XCJBZnJpY2FcIjogZnVuY3Rpb24oZWxlbWVudCkge1xuXHRcdFx0XHQvL2VtcGlyaWNcblx0XHRcdFx0dmFyIGsgPSAzO1xuXHRcdFx0XHR2YXIgcHJvamVjdGlvbiA9IGQzLmdlby5jb25pY0NvbmZvcm1hbCgpXG5cdFx0XHRcdFx0LnJvdGF0ZShbLTI1LCAwXSlcblx0XHRcdFx0XHQuY2VudGVyKFswLCAwXSlcblx0XHRcdFx0XHQucGFyYWxsZWxzKFszMCwgLTIwXSlcblx0XHRcdFx0XHQuc2NhbGUoZWxlbWVudC5vZmZzZXRXaWR0aC9rKVxuXHRcdFx0XHRcdC50cmFuc2xhdGUoW2VsZW1lbnQub2Zmc2V0V2lkdGggLyAyLCBlbGVtZW50Lm9mZnNldEhlaWdodCAvIDJdKTtcblx0XHRcdFx0dmFyIHBhdGggPSBkMy5nZW8ucGF0aCgpLnByb2plY3Rpb24ocHJvamVjdGlvbik7XG5cdFx0XHRcdHJldHVybiB7cGF0aDogcGF0aCwgcHJvamVjdGlvbjogcHJvamVjdGlvbn07XG5cdFx0XHR9LFxuXHRcdFx0XCJOLkFtZXJpY2FcIjogZnVuY3Rpb24oZWxlbWVudCkge1xuXHRcdFx0XHQvL2VtcGlyaWNcblx0XHRcdFx0dmFyIGsgPSAzO1xuXHRcdFx0XHR2YXIgcHJvamVjdGlvbiA9IGQzLmdlby5jb25pY0NvbmZvcm1hbCgpXG5cdFx0XHRcdFx0LnJvdGF0ZShbOTgsIDBdKVxuXHRcdFx0XHRcdC5jZW50ZXIoWzAsIDM4XSlcblx0XHRcdFx0XHQucGFyYWxsZWxzKFsyOS41LCA0NS41XSlcblx0XHRcdFx0XHQuc2NhbGUoZWxlbWVudC5vZmZzZXRXaWR0aC9rKVxuXHRcdFx0XHRcdC50cmFuc2xhdGUoW2VsZW1lbnQub2Zmc2V0V2lkdGggLyAyLCBlbGVtZW50Lm9mZnNldEhlaWdodCAvIDJdKTtcblx0XHRcdFx0dmFyIHBhdGggPSBkMy5nZW8ucGF0aCgpLnByb2plY3Rpb24ocHJvamVjdGlvbik7XG5cdFx0XHRcdHJldHVybiB7cGF0aDogcGF0aCwgcHJvamVjdGlvbjogcHJvamVjdGlvbn07XG5cdFx0XHR9LFxuXHRcdFx0XCJTLkFtZXJpY2FcIjogZnVuY3Rpb24oZWxlbWVudCkge1xuXHRcdFx0XHQvL2VtcGlyaWNcblx0XHRcdFx0dmFyIGsgPSAzLjQ7XG5cdFx0XHRcdHZhciBwcm9qZWN0aW9uID0gZDMuZ2VvLmNvbmljQ29uZm9ybWFsKClcblx0XHRcdFx0XHQucm90YXRlKFs2OCwgMF0pXG5cdFx0XHRcdFx0LmNlbnRlcihbMCwgLTE0XSlcblx0XHRcdFx0XHQucGFyYWxsZWxzKFsxMCwgLTMwXSlcblx0XHRcdFx0XHQuc2NhbGUoZWxlbWVudC5vZmZzZXRXaWR0aC9rKVxuXHRcdFx0XHRcdC50cmFuc2xhdGUoW2VsZW1lbnQub2Zmc2V0V2lkdGggLyAyLCBlbGVtZW50Lm9mZnNldEhlaWdodCAvIDJdKTtcblx0XHRcdFx0dmFyIHBhdGggPSBkMy5nZW8ucGF0aCgpLnByb2plY3Rpb24ocHJvamVjdGlvbik7XG5cdFx0XHRcdHJldHVybiB7cGF0aDogcGF0aCwgcHJvamVjdGlvbjogcHJvamVjdGlvbn07XG5cdFx0XHR9LFxuXHRcdFx0XCJBc2lhXCI6IGZ1bmN0aW9uKGVsZW1lbnQpIHtcblx0XHRcdFx0Ly9lbXBpcmljXG5cdFx0XHRcdHZhciBrID0gMztcblx0XHRcdFx0dmFyIHByb2plY3Rpb24gPSBkMy5nZW8uY29uaWNDb25mb3JtYWwoKVxuXHRcdFx0XHRcdC5yb3RhdGUoWy0xMDUsIDBdKVxuXHRcdFx0XHRcdC5jZW50ZXIoWzAsIDM3XSlcblx0XHRcdFx0XHQucGFyYWxsZWxzKFsxMCwgNjBdKVxuXHRcdFx0XHRcdC5zY2FsZShlbGVtZW50Lm9mZnNldFdpZHRoL2spXG5cdFx0XHRcdFx0LnRyYW5zbGF0ZShbZWxlbWVudC5vZmZzZXRXaWR0aCAvIDIsIGVsZW1lbnQub2Zmc2V0SGVpZ2h0IC8gMl0pO1xuXHRcdFx0XHR2YXIgcGF0aCA9IGQzLmdlby5wYXRoKCkucHJvamVjdGlvbihwcm9qZWN0aW9uKTtcblx0XHRcdFx0cmV0dXJuIHtwYXRoOiBwYXRoLCBwcm9qZWN0aW9uOiBwcm9qZWN0aW9ufTtcblx0XHRcdH0sXG5cdFx0XHRcIkV1cm9wZVwiOiBmdW5jdGlvbihlbGVtZW50KSB7XG5cdFx0XHRcdC8vZW1waXJpY1xuXHRcdFx0XHR2YXIgayA9IDEuNTtcblx0XHRcdFx0dmFyIHByb2plY3Rpb24gPSBkMy5nZW8uY29uaWNDb25mb3JtYWwoKVxuXHRcdFx0XHRcdC5yb3RhdGUoWy0xNSwgMF0pXG5cdFx0XHRcdFx0LmNlbnRlcihbMCwgNTVdKVxuXHRcdFx0XHRcdC5wYXJhbGxlbHMoWzYwLCA0MF0pXG5cdFx0XHRcdFx0LnNjYWxlKGVsZW1lbnQub2Zmc2V0V2lkdGgvaylcblx0XHRcdFx0XHQudHJhbnNsYXRlKFtlbGVtZW50Lm9mZnNldFdpZHRoIC8gMiwgZWxlbWVudC5vZmZzZXRIZWlnaHQgLyAyXSk7XG5cdFx0XHRcdHZhciBwYXRoID0gZDMuZ2VvLnBhdGgoKS5wcm9qZWN0aW9uKHByb2plY3Rpb24pO1xuXHRcdFx0XHRyZXR1cm4ge3BhdGg6IHBhdGgsIHByb2plY3Rpb246IHByb2plY3Rpb259O1xuXHRcdFx0fSxcblx0XHRcdFwiQXVzdHJhbGlhXCI6IGZ1bmN0aW9uKGVsZW1lbnQpIHtcblx0XHRcdFx0Ly9lbXBpcmljXG5cdFx0XHRcdHZhciBrID0gMztcblx0XHRcdFx0dmFyIHByb2plY3Rpb24gPSBkMy5nZW8uY29uaWNDb25mb3JtYWwoKVxuXHRcdFx0XHRcdC5yb3RhdGUoWy0xMzUsIDBdKVxuXHRcdFx0XHRcdC5jZW50ZXIoWzAsIC0yMF0pXG5cdFx0XHRcdFx0LnBhcmFsbGVscyhbLTEwLCAtMzBdKVxuXHRcdFx0XHRcdC5zY2FsZShlbGVtZW50Lm9mZnNldFdpZHRoL2spXG5cdFx0XHRcdFx0LnRyYW5zbGF0ZShbZWxlbWVudC5vZmZzZXRXaWR0aCAvIDIsIGVsZW1lbnQub2Zmc2V0SGVpZ2h0IC8gMl0pO1xuXHRcdFx0XHR2YXIgcGF0aCA9IGQzLmdlby5wYXRoKCkucHJvamVjdGlvbihwcm9qZWN0aW9uKTtcblx0XHRcdFx0cmV0dXJuIHtwYXRoOiBwYXRoLCBwcm9qZWN0aW9uOiBwcm9qZWN0aW9ufTtcblx0XHRcdH1cblx0XHR9XG5cblx0fSk7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVmlld3MuQ2hhcnQuTWFwVGFiO1xuXG59KSgpO1xuXG4oZnVuY3Rpb24oKSB7XG5cdHZhciDOtSA9IDFlLTYsIM61MiA9IM61ICogzrUsIM+AID0gTWF0aC5QSSwgaGFsZs+AID0gz4AgLyAyLCBzcXJ0z4AgPSBNYXRoLnNxcnQoz4ApLCByYWRpYW5zID0gz4AgLyAxODAsIGRlZ3JlZXMgPSAxODAgLyDPgDtcblx0ZnVuY3Rpb24gc2luY2koeCkge1xuXHRcdHJldHVybiB4ID8geCAvIE1hdGguc2luKHgpIDogMTtcblx0fVxuXHRmdW5jdGlvbiBzZ24oeCkge1xuXHRcdHJldHVybiB4ID4gMCA/IDEgOiB4IDwgMCA/IC0xIDogMDtcblx0fVxuXHRmdW5jdGlvbiBhc2luKHgpIHtcblx0XHRyZXR1cm4geCA+IDEgPyBoYWxmz4AgOiB4IDwgLTEgPyAtaGFsZs+AIDogTWF0aC5hc2luKHgpO1xuXHR9XG5cdGZ1bmN0aW9uIGFjb3MoeCkge1xuXHRcdHJldHVybiB4ID4gMSA/IDAgOiB4IDwgLTEgPyDPgCA6IE1hdGguYWNvcyh4KTtcblx0fVxuXHRmdW5jdGlvbiBhc3FydCh4KSB7XG5cdFx0cmV0dXJuIHggPiAwID8gTWF0aC5zcXJ0KHgpIDogMDtcblx0fVxuXHR2YXIgcHJvamVjdGlvbiA9IGQzLmdlby5wcm9qZWN0aW9uO1xuIFxuXHRmdW5jdGlvbiBlY2tlcnQzKM67LCDPhikge1xuXHRcdHZhciBrID0gTWF0aC5zcXJ0KM+AICogKDQgKyDPgCkpO1xuXHRcdHJldHVybiBbIDIgLyBrICogzrsgKiAoMSArIE1hdGguc3FydCgxIC0gNCAqIM+GICogz4YgLyAoz4AgKiDPgCkpKSwgNCAvIGsgKiDPhiBdO1xuXHR9XG5cdGVja2VydDMuaW52ZXJ0ID0gZnVuY3Rpb24oeCwgeSkge1xuXHRcdHZhciBrID0gTWF0aC5zcXJ0KM+AICogKDQgKyDPgCkpIC8gMjtcblx0XHRyZXR1cm4gWyB4ICogayAvICgxICsgYXNxcnQoMSAtIHkgKiB5ICogKDQgKyDPgCkgLyAoNCAqIM+AKSkpLCB5ICogayAvIDIgXTtcblx0fTtcblx0KGQzLmdlby5lY2tlcnQzID0gZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuIHByb2plY3Rpb24oZWNrZXJ0Myk7XG5cdH0pLnJhdyA9IGVja2VydDM7XG5cdFxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBBcHAgPSByZXF1aXJlKCBcIi4vLi4vLi4vbmFtZXNwYWNlcy5qc1wiICk7XG5cblx0QXBwLlZpZXdzLkNoYXJ0LlNjYWxlU2VsZWN0b3JzID0gQmFja2JvbmUuVmlldy5leHRlbmQoe1xuXG5cdFx0ZWw6IFwiI2NoYXJ0LXZpZXcgLmF4aXMtc2NhbGUtc2VsZWN0b3JzLXdyYXBwZXJcIixcblx0XHRldmVudHM6IHtcblx0XHRcdFwiY2xpY2sgLmF4aXMtc2NhbGUtYnRuXCI6IFwib25BeGlzU2NhbGVCdG5cIixcblx0XHRcdFwiY2hhbmdlIC5heGlzLXNjYWxlIGxpXCI6IFwib25BeGlzU2NhbGVDaGFuZ2VcIlxuXHRcdH0sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdFxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gb3B0aW9ucy5kaXNwYXRjaGVyO1xuXHRcdFx0XG5cdFx0XHR0aGlzLiR0YWJzID0gdGhpcy4kZWwuZmluZCggXCIuaGVhZGVyLXRhYlwiICk7XG5cdFx0XHRcblx0XHRcdHRoaXMuJHhBeGlzU2NhbGUgPSB0aGlzLiRlbC5maW5kKCBcIltkYXRhLW5hbWU9J3gtYXhpcy1zY2FsZSddXCIgKTtcblx0XHRcdHRoaXMuJHlBeGlzU2NhbGUgPSB0aGlzLiRlbC5maW5kKCBcIltkYXRhLW5hbWU9J3ktYXhpcy1zY2FsZSddXCIgKTtcblxuXHRcdFx0dGhpcy5pbml0RHJvcERvd24oIHRoaXMuJHhBeGlzU2NhbGUgKTtcblx0XHRcdHRoaXMuaW5pdERyb3BEb3duKCB0aGlzLiR5QXhpc1NjYWxlICk7XG5cblx0XHRcdHRoaXMucmVuZGVyKCk7XG5cblx0XHRcdC8vc2V0dXAgZXZlbnRzXG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5vbiggXCJjaGFuZ2VcIiwgdGhpcy5yZW5kZXIsIHRoaXMgKTtcblxuXHRcdH0sXG5cblx0XHQvKmluaXRFdmVudHM6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy4kY2hhcnRWaWV3ID0gJCggXCIjY2hhcnQtdmlld1wiICk7XG5cdFx0XHR0aGlzLiR3cmFwID0gdGhpcy4kY2hhcnRWaWV3LmZpbmQoIFwic3ZnID4gLm52LXdyYXBcIiApO1xuXHRcdFx0XG5cdFx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0XHR0aGlzLiR3cmFwLm9uKCBcIm1vdXNlb3ZlclwiLCBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0XHR0aGF0LiRjaGFydFZpZXcuYWRkQ2xhc3MoIFwiY2hhcnQtaG92ZXJlZFwiICk7XG5cdFx0XHR9ICk7XG5cdFx0XHR0aGlzLiR3cmFwLm9uKCBcIm1vdXNlb3V0XCIsIGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKCBldnQuY3VycmVudFRhcmdldCApO1xuXHRcdFx0XHR0aGF0LiRjaGFydFZpZXcucmVtb3ZlQ2xhc3MoIFwiY2hhcnQtaG92ZXJlZFwiICk7XG5cdFx0XHR9ICk7XG5cdFx0fSwqL1xuXG5cdFx0aW5pdERyb3BEb3duOiBmdW5jdGlvbiggJGVsICkge1xuXG5cdFx0XHR2YXIgJGxpc3QgPSAkZWwuZmluZCggXCJ1bFwiICksXG5cdFx0XHRcdCRpdGVtcyA9ICRsaXN0LmZpbmQoIFwibGlcIiApO1xuXG5cdFx0XHQkaXRlbXMub24oIFwiY2xpY2tcIiwgZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdFx0dmFyICR0aGlzID0gJCggdGhpcyApLFxuXHRcdFx0XHRcdHZhbHVlID0gJHRoaXMuYXR0ciggXCJkYXRhLXZhbHVlXCIgKTtcblx0XHRcdFx0JGl0ZW1zLnJlbW92ZUNsYXNzKCBcInNlbGVjdGVkXCIgKTtcblx0XHRcdFx0JHRoaXMuYWRkQ2xhc3MoIFwic2VsZWN0ZWRcIiApO1xuXHRcdFx0XHQkdGhpcy50cmlnZ2VyKCBcImNoYW5nZVwiICk7XG5cdFx0XHR9ICk7XG5cblx0XHR9LFxuXG5cdFx0b25BeGlzU2NhbGVDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdHZhciAkbGkgPSAkKCBldnQuY3VycmVudFRhcmdldCApLFxuXHRcdFx0XHQkcGFyZW50ID0gJGxpLnBhcmVudCgpLnBhcmVudCgpLnBhcmVudCgpLFxuXHRcdFx0XHQkZGl2ID0gJHBhcmVudC5maW5kKCBcImRpdlwiICksXG5cdFx0XHRcdCRidG4gPSAkcGFyZW50LmZpbmQoIFwiLmF4aXMtc2NhbGUtYnRuXCIgKSxcblx0XHRcdFx0JHNlbGVjdCA9ICRwYXJlbnQuZmluZCggXCIuYXhpcy1zY2FsZVwiICksXG5cdFx0XHRcdG5hbWUgPSAkZGl2LmF0dHIoIFwiZGF0YS1uYW1lXCIgKSxcblx0XHRcdFx0YXhpc05hbWUgPSAoIG5hbWUgPT09IFwieC1heGlzLXNjYWxlXCIgKT8gXCJ4LWF4aXNcIjogXCJ5LWF4aXNcIixcblx0XHRcdFx0YXhpc1Byb3AgPSBcImF4aXMtc2NhbGVcIixcblx0XHRcdFx0dmFsdWUgPSAkbGkuYXR0ciggXCJkYXRhLXZhbHVlXCIgKTtcblxuXHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0QXhpc0NvbmZpZyggYXhpc05hbWUsIGF4aXNQcm9wLCB2YWx1ZSApO1xuXHRcdFx0XG5cdFx0XHQkc2VsZWN0LmhpZGUoKTtcblx0XHRcdC8vJGJ0bi5zaG93KCk7XG5cblx0XHR9LFxuXG5cdFx0b25BeGlzU2NhbGVCdG46IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHRcblx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0dmFyICRidG4gPSAkKCBldnQuY3VycmVudFRhcmdldCApLFxuXHRcdFx0XHQkcGFyZW50ID0gJGJ0bi5wYXJlbnQoKSxcblx0XHRcdFx0JHNlbGVjdCA9ICRwYXJlbnQuZmluZCggXCIuYXhpcy1zY2FsZVwiICk7XG5cblx0XHRcdCRzZWxlY3Quc2hvdygpO1xuXHRcdFx0Ly8kYnRuLmhpZGUoKTtcblxuXHRcdH1cblxuXHR9KTtcblx0XG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkNoYXJ0LlNjYWxlU2VsZWN0b3JzO1xuXHRcbn0pKCk7XG4iLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBBcHAgPSByZXF1aXJlKCBcIi4vLi4vLi4vbmFtZXNwYWNlcy5qc1wiICk7XG5cblx0QXBwLlZpZXdzLkNoYXJ0LlNvdXJjZXNUYWIgPSBCYWNrYm9uZS5WaWV3LmV4dGVuZCgge1xuXG5cdFx0ZWw6IFwiI2NoYXJ0LXZpZXdcIixcblx0XHRldmVudHM6IHt9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHRcblx0XHRcdHRoaXMuZGlzcGF0Y2hlciA9IG9wdGlvbnMuZGlzcGF0Y2hlcjtcblxuXHRcdFx0dGhpcy4kY2hhcnREZXNjcmlwdGlvbiA9IHRoaXMuJGVsLmZpbmQoIFwiLmNoYXJ0LWRlc2NyaXB0aW9uXCIgKTtcblx0XHRcdHRoaXMuJGNoYXJ0U291cmNlcyA9IHRoaXMuJGVsLmZpbmQoIFwiLmNoYXJ0LXNvdXJjZXNcIiApO1xuXHRcdFx0dGhpcy4kc291cmNlc1RhYiA9IHRoaXMuJGVsLmZpbmQoIFwiI3NvdXJjZXMtY2hhcnQtdGFiXCIgKTtcblxuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCByZXNwb25zZSApIHtcblxuXHRcdFx0aWYoICFyZXNwb25zZSB8fCAhcmVzcG9uc2UuZGF0YXNvdXJjZXMgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0dmFyIHNvdXJjZXMgPSByZXNwb25zZS5kYXRhc291cmNlcyxcblx0XHRcdFx0bGljZW5zZSA9IHJlc3BvbnNlLmxpY2Vuc2UsXG5cdFx0XHRcdGZvb3Rlckh0bWwgPSBcIlwiLFxuXHRcdFx0XHR0YWJIdG1sID0gXCJcIixcblx0XHRcdFx0ZGVzY3JpcHRpb25IdG1sID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LWRlc2NyaXB0aW9uXCIgKSxcblx0XHRcdFx0c291cmNlc1Nob3J0SHRtbCA9IFwiRGF0YSBvYnRhaW5lZCBmcm9tOiBcIixcblx0XHRcdFx0c291cmNlc0xvbmdIdG1sID0gXCJcIixcblx0XHRcdFx0Ly9jaGVjayB0aGF0IHdlJ3JlIG5vdCBhZGRpbmcgc291cmNlcyB3aXRoIHRoZSBzYW1lIG5hbWUgbW9yZSB0aW1lc1xuXHRcdFx0XHRzb3VyY2VzQnlOYW1lID0gW107XG5cdFx0XHRcdFxuXHRcdFx0Ly9jb25zdHJ1Y3Qgc291cmNlIGh0bWxcblx0XHRcdF8uZWFjaCggc291cmNlcywgZnVuY3Rpb24oIHNvdXJjZURhdGEsIHNvdXJjZUluZGV4ICkge1xuXHRcdFx0XHQvL21ha2Ugc3VyZSB3ZSBkb24ndCBoYXZlIHNvdXJjZSB3aXRoIHRoZSBzYW1lIG5hbWUgaW4gdGhlIHNob3J0IGRlc2NyaXB0aW9uIGFscmVhZHlcblx0XHRcdFx0aWYoICFzb3VyY2VzQnlOYW1lWyBzb3VyY2VEYXRhLm5hbWUgXSApIHtcblx0XHRcdFx0XHRpZiggc291cmNlSW5kZXggPiAwICkge1xuXHRcdFx0XHRcdFx0c291cmNlc1Nob3J0SHRtbCArPSBcIiwgXCI7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmKCBzb3VyY2VEYXRhLmxpbmsgKSB7XG5cdFx0XHRcdFx0XHRzb3VyY2VzU2hvcnRIdG1sICs9IFwiPGEgaHJlZj0nXCIgKyBzb3VyY2VEYXRhLmxpbmsgKyBcIicgdGFyZ2V0PSdfYmxhbmsnPlwiICsgc291cmNlRGF0YS5uYW1lICsgXCI8L2E+XCI7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHNvdXJjZXNTaG9ydEh0bWwgKz0gc291cmNlRGF0YS5uYW1lO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRzb3VyY2VzQnlOYW1lWyBzb3VyY2VEYXRhLm5hbWUgXSA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdC8vc291cmNlcyBub3cgY29udGFpbiBodG1sLCBzbyBubyBuZWVkIHRvIHNlcGFyYXRlIHdpdGggY29tbWFcblx0XHRcdFx0LyppZiggc291cmNlSW5kZXggPiAwICYmIHNvdXJjZXNMb25nSHRtbCAhPT0gXCJcIiAmJiBzb3VyY2VEYXRhLmRlc2NyaXB0aW9uICE9PSBcIlwiICkge1xuXHRcdFx0XHRcdHNvdXJjZXNMb25nSHRtbCArPSBcIiwgXCI7XG5cdFx0XHRcdH0qL1xuXHRcdFx0XHRzb3VyY2VzTG9uZ0h0bWwgKz0gc291cmNlRGF0YS5kZXNjcmlwdGlvbjtcblx0XHRcdFxuXHRcdFx0fSApO1xuXG5cdFx0XHRmb290ZXJIdG1sID0gZGVzY3JpcHRpb25IdG1sO1xuXHRcdFx0dGFiSHRtbCA9IGRlc2NyaXB0aW9uSHRtbCArIFwiPGJyIC8+PGJyIC8+XCIgKyBzb3VyY2VzTG9uZ0h0bWw7XG5cdFx0XHRcblx0XHRcdC8vYWRkIGxpY2Vuc2UgaW5mb1xuXHRcdFx0aWYoIGxpY2Vuc2UgJiYgbGljZW5zZS5kZXNjcmlwdGlvbiApIHtcblx0XHRcdFx0Zm9vdGVySHRtbCA9IGxpY2Vuc2UuZGVzY3JpcHRpb24gKyBcIiBcIiArIGZvb3Rlckh0bWw7XG5cdFx0XHRcdHRhYkh0bWwgPSBsaWNlbnNlLmRlc2NyaXB0aW9uICsgXCIgXCIgKyB0YWJIdG1sO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHQvL2FwcGVuZCB0byBET01cblx0XHRcdHRoaXMuJGNoYXJ0RGVzY3JpcHRpb24uaHRtbCggZm9vdGVySHRtbCApO1xuXHRcdFx0dGhpcy4kY2hhcnRTb3VyY2VzLmh0bWwoIHNvdXJjZXNTaG9ydEh0bWwgKTtcblx0XHRcdHRoaXMuJHNvdXJjZXNUYWIuaHRtbCggdGFiSHRtbCApO1xuXG5cdFx0fVxuXG5cdH0gKTtcblx0XG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkNoYXJ0LlNvdXJjZXNUYWI7XG5cbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgQXBwID0gcmVxdWlyZSggXCIuLy4uLy4uLy4uL25hbWVzcGFjZXMuanNcIiApO1xuXG5cdEFwcC5WaWV3cy5DaGFydC5NYXAuTGVnZW5kID0gZnVuY3Rpb24oKSB7XG5cblx0XHQvL3ByaXZhdGVcblx0XHR2YXIgc3RlcFNpemUgPSAyMCxcblx0XHRcdHN0ZXBDbGFzcyA9IFwibGVnZW5kLXN0ZXBcIixcblx0XHRcdHNjYWxlO1xuXG5cdFx0dmFyIGZvcm1hdExlZ2VuZExhYmVsID0gZnVuY3Rpb24oIHZhbHVlQXJyLCBpLCBsZW5ndGggKSB7XG5cdFx0XHRcblx0XHRcdHZhbHVlQXJyID0gdmFsdWVBcnIubWFwKCBmdW5jdGlvbiggZCApIHtcblx0XHRcdFx0dmFyIGxlbiA9IGQudG9TdHJpbmcoKS5sZW5ndGgsXG5cdFx0XHRcdFx0Zm9ybWF0dGVkTnVtYmVyID0gZDtcblx0XHRcdFx0aWYoIGxlbiA+IDMgKSB7XG5cdFx0XHRcdFx0Zm9ybWF0dGVkTnVtYmVyID0gZDMuZm9ybWF0KCBcIi4zclwiICkoIGQgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZm9ybWF0dGVkTnVtYmVyO1xuXHRcdFx0fSApO1xuXHRcdFx0aWYoIGkgPCAobGVuZ3RoIC0gMSkgKSB7XG5cdFx0XHRcdHJldHVybiB2YWx1ZUFyclsgMCBdO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIHZhbHVlQXJyLmpvaW4oIFwiICZuYnNwOyBcIiApO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRmdW5jdGlvbiBsZWdlbmQoIHNlbGVjdGlvbiApIHtcblxuXHRcdFx0c2VsZWN0aW9uLmVhY2goIGZ1bmN0aW9uKCBkYXRhICkge1xuXG5cdFx0XHRcdHZhciBkYXRhbWFwID0gZDMuc2VsZWN0KCBcIi5kYXRhbWFwXCIgKSxcblx0XHRcdFx0XHRjb250YWluZXIgPSBkMy5zZWxlY3QoIHRoaXMgKSxcblx0XHRcdFx0XHRjb250YWluZXJIZWlnaHQgPSBkYXRhbWFwLm5vZGUoKS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5oZWlnaHQsXG5cdFx0XHRcdFx0bGVnZW5kT2Zmc2V0ID0gMTAsXG5cdFx0XHRcdFx0c3RlcEdhcCA9IDIsXG5cdFx0XHRcdFx0ZyA9IGNvbnRhaW5lci5zZWxlY3QoIFwiLmxlZ2VuZFwiICk7XG5cblx0XHRcdFx0aWYoIGcuZW1wdHkoKSApIHtcblx0XHRcdFx0XHRnID0gc2VsZWN0aW9uLmFwcGVuZCggXCJnXCIgKVxuXHRcdFx0XHRcdFx0XHQuYXR0ciggXCJpZFwiLCBcImxlZ2VuZFwiIClcblx0XHRcdFx0XHRcdFx0LmF0dHIoIFwiY2xhc3NcIiwgXCJsZWdlbmRcIiApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdFxuXHRcdFx0XHQvL3N0YXJ0IHdpdGggaGlnaGVzdCB2YWx1ZVxuXHRcdFx0XHQvL2RhdGEucmV2ZXJzZSgpO1xuXG5cdFx0XHRcdC8vZGF0YSBqb2luXG5cdFx0XHRcdHZhciBsZWdlbmRTdGVwcyA9IGcuc2VsZWN0QWxsKCBcIi5cIiArIHN0ZXBDbGFzcyApLmRhdGEoIGRhdGEgKTtcblx0XHRcdFx0XG5cdFx0XHRcdC8vZW50ZXJcblx0XHRcdFx0dmFyIGxlZ2VuZFN0ZXBzRW50ZXIgPSBsZWdlbmRTdGVwcy5lbnRlcigpXG5cdFx0XHRcdFx0LmFwcGVuZCggXCJnXCIgKVxuXHRcdFx0XHRcdFx0LmF0dHIoIFwiY2xhc3NcIiwgc3RlcENsYXNzIClcblx0XHRcdFx0XHRcdC5hdHRyKCBcInRyYW5zZm9ybVwiLCBmdW5jdGlvbiggZCwgaSApIHsgdmFyIHRyYW5zbGF0ZVggPSBsZWdlbmRPZmZzZXQgKyAoaSooc3RlcFNpemUrc3RlcEdhcCkpLCB0cmFuc2xhdGVZID0gY29udGFpbmVySGVpZ2h0IC0gbGVnZW5kT2Zmc2V0IC0gc3RlcFNpemU7IHJldHVybiBcInRyYW5zbGF0ZShcIiArIHRyYW5zbGF0ZVggKyBcIixcIiArIHRyYW5zbGF0ZVkgKyBcIilcIjsgfSApO1xuXHRcdFx0XHRcdFx0Ly8uYXR0ciggXCJ0cmFuc2Zvcm1cIiwgZnVuY3Rpb24oIGQsIGkgKSB7IHZhciB0cmFuc2xhdGVZID0gY29udGFpbmVySGVpZ2h0IC0gbGVnZW5kT2Zmc2V0IC0gc3RlcFNpemUgLSAoIGkqKHN0ZXBTaXplK3N0ZXBHYXApICk7IHJldHVybiBcInRyYW5zbGF0ZShcIiArIGxlZ2VuZE9mZnNldCArIFwiLFwiICsgdHJhbnNsYXRlWSArIFwiKVwiOyB9ICk7XG5cdFx0XHRcdGxlZ2VuZFN0ZXBzRW50ZXIuYXBwZW5kKCBcInJlY3RcIiApXG5cdFx0XHRcdFx0LmF0dHIoIFwid2lkdGhcIiwgc3RlcFNpemUgKyBcInB4XCIgKVxuXHRcdFx0XHRcdC5hdHRyKCBcImhlaWdodFwiLCBzdGVwU2l6ZSArIFwicHhcIiApO1xuXHRcdFx0XHRsZWdlbmRTdGVwc0VudGVyLmFwcGVuZCggXCJ0ZXh0XCIgKVxuXHRcdFx0XHRcdC8vLmF0dHIoIFwidHJhbnNmb3JtXCIsIGZ1bmN0aW9uKCBkLCBpICkgeyByZXR1cm4gXCJ0cmFuc2xhdGUoIFwiICsgKHBhcnNlSW50KCBzdGVwU2l6ZS8xLjQsIDEwICkgKyAxMCkgKyBcIiwgXCIgKyBwYXJzZUludCggc3RlcFNpemUvMS40LCAxMCApICsgXCIgKVwiOyB9ICk7XG5cdFx0XHRcdFx0LmF0dHIoIFwidHJhbnNmb3JtXCIsIGZ1bmN0aW9uKCBkLCBpICkgeyByZXR1cm4gXCJ0cmFuc2xhdGUoLTIsLTUpXCI7IH0gKTtcblxuXHRcdFx0XHQvL3VwZGF0ZVxuXHRcdFx0XHRsZWdlbmRTdGVwcy5zZWxlY3QoIFwicmVjdFwiIClcblx0XHRcdFx0XHQuc3R5bGUoIFwiZmlsbFwiLCBmdW5jdGlvbiggZCwgaSApIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGQ7XG5cdFx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdGxlZ2VuZFN0ZXBzLnNlbGVjdCggXCJ0ZXh0XCIgKVxuXHRcdFx0XHRcdC5odG1sKCBmdW5jdGlvbiggZCwgaSApIHsgcmV0dXJuIGZvcm1hdExlZ2VuZExhYmVsKCBzY2FsZS5pbnZlcnRFeHRlbnQoIGQgKSwgaSwgZGF0YS5sZW5ndGggKTsgfSApO1xuXG5cdFx0XHRcdC8vZXhpdFxuXHRcdFx0XHRsZWdlbmRTdGVwcy5leGl0KCkucmVtb3ZlKCk7XG5cblx0XHRcdH0gKTtcblxuXHRcdFx0cmV0dXJuIGxlZ2VuZDtcblxuXHRcdH1cblxuXHRcdC8vcHVibGljIG1ldGhvZHNcblx0XHRsZWdlbmQuc2NhbGUgPSBmdW5jdGlvbiggdmFsdWUgKSB7XG5cdFx0XHRpZiggIWFyZ3VtZW50cy5sZW5ndGggKSB7XG5cdFx0XHRcdHJldHVybiBzY2FsZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHNjYWxlID0gdmFsdWU7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHJldHVybiBsZWdlbmQ7XG5cblx0fTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5DaGFydC5NYXAuTGVnZW5kO1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIEFwcCA9IHJlcXVpcmUoIFwiLi8uLi8uLi8uLi9uYW1lc3BhY2VzLmpzXCIgKTtcblxuXHRBcHAuVmlld3MuQ2hhcnQuTWFwLk1hcENvbnRyb2xzID0gQmFja2JvbmUuVmlldy5leHRlbmQoe1xuXG5cdFx0ZWw6IFwiI21hcC1jaGFydC10YWIgLm1hcC1jb250cm9scy1oZWFkZXJcIixcblx0XHRldmVudHM6IHtcblx0XHRcdFwiaW5wdXQgLnRhcmdldC15ZWFyLWNvbnRyb2wgaW5wdXRcIjogXCJvblRhcmdldFllYXJJbnB1dFwiLFxuXHRcdFx0XCJjaGFuZ2UgLnRhcmdldC15ZWFyLWNvbnRyb2wgaW5wdXRcIjogXCJvblRhcmdldFllYXJDaGFuZ2VcIixcblx0XHRcdFwiY2xpY2sgLnJlZ2lvbi1jb250cm9sIGxpXCI6IFwib25SZWdpb25DbGlja1wiLFxuXHRcdFx0XCJjbGljayAuc2V0dGluZ3MtY29udHJvbCBpbnB1dFwiOiBcIm9uU2V0dGluZ3NJbnB1dFwiLFxuXHRcdH0sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gb3B0aW9ucy5kaXNwYXRjaGVyO1xuXG5cdFx0XHR2YXIgbWFwQ29uZmlnID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcIm1hcC1jb25maWdcIiApO1xuXHRcdFx0XG5cdFx0XHQvL3llYXIgc2xpZGVyXG5cdFx0XHR0aGlzLiR0YXJnZXRZZWFyQ29udHJvbCA9IHRoaXMuJGVsLmZpbmQoIFwiLnRhcmdldC15ZWFyLWNvbnRyb2xcIiApO1xuXHRcdFx0dGhpcy4kdGFyZ2V0WWVhckxhYmVsID0gdGhpcy4kdGFyZ2V0WWVhckNvbnRyb2wuZmluZCggXCIudGFyZ2V0LXllYXItbGFiZWxcIiApO1xuXHRcdFx0dGhpcy4kdGFyZ2V0WWVhcklucHV0ID0gdGhpcy4kdGFyZ2V0WWVhckNvbnRyb2wuZmluZCggXCJpbnB1dFwiICk7XG5cdFx0XHRcblx0XHRcdC8vcmVnaW9uIHNlbGVjdG9yXG5cdFx0XHR0aGlzLiRyZWdpb25Db250cm9sID0gdGhpcy4kZWwuZmluZCggXCIucmVnaW9uLWNvbnRyb2xcIiApO1xuXHRcdFx0dGhpcy4kcmVnaW9uQ29udHJvbExhYmVsID0gdGhpcy4kcmVnaW9uQ29udHJvbC5maW5kKCBcIi5yZWdpb24tbGFiZWxcIiApO1xuXHRcdFx0dGhpcy4kcmVnaW9uQ29udHJvbExpcyA9IHRoaXMuJHJlZ2lvbkNvbnRyb2wuZmluZCggXCJsaVwiICk7XG5cblx0XHRcdEFwcC5DaGFydE1vZGVsLm9uKCBcImNoYW5nZVwiLCB0aGlzLm9uQ2hhcnRNb2RlbENoYW5nZSwgdGhpcyApO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwub24oIFwiY2hhbmdlLW1hcFwiLCB0aGlzLm9uQ2hhcnRNb2RlbENoYW5nZSwgdGhpcyApO1xuXG5cdFx0XHRyZXR1cm4gdGhpcy5yZW5kZXIoKTtcblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdFxuXHRcdFx0dmFyIG1hcENvbmZpZyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJtYXAtY29uZmlnXCIgKTtcblx0XHRcdFxuXHRcdFx0dGhpcy4kdGFyZ2V0WWVhckxhYmVsLnRleHQoIG1hcENvbmZpZy50YXJnZXRZZWFyICk7XG5cdFx0XHR0aGlzLiRyZWdpb25Db250cm9sTGFiZWwudGV4dCggbWFwQ29uZmlnLnByb2plY3Rpb24gKTtcblxuXHRcdFx0dGhpcy4kdGFyZ2V0WWVhcklucHV0LmF0dHIoIFwibWluXCIsIG1hcENvbmZpZy5taW5ZZWFyICk7XG5cdFx0XHR0aGlzLiR0YXJnZXRZZWFySW5wdXQuYXR0ciggXCJtYXhcIiwgbWFwQ29uZmlnLm1heFllYXIgKTtcblx0XHRcdHRoaXMuJHRhcmdldFllYXJJbnB1dC5hdHRyKCBcInN0ZXBcIiwgbWFwQ29uZmlnLnRpbWVJbnRlcnZhbCApO1xuXHRcdFx0dGhpcy4kdGFyZ2V0WWVhcklucHV0LnZhbCggcGFyc2VJbnQoIG1hcENvbmZpZy50YXJnZXRZZWFyLCAxMCApICk7XG5cblx0XHRcdHRoaXMuJHJlZ2lvbkNvbnRyb2xMaXMucmVtb3ZlQ2xhc3MoIFwiaGlnaGxpZ2h0XCIgKTtcblx0XHRcdHRoaXMuJHJlZ2lvbkNvbnRyb2xMaXMuZmlsdGVyKCBcIi5cIiArIG1hcENvbmZpZy5wcm9qZWN0aW9uICsgXCItcHJvamVjdGlvblwiICkuYWRkQ2xhc3MoIFwiaGlnaGxpZ2h0XCIgKTtcblxuXHRcdH0sXG5cblx0XHRvbkNoYXJ0TW9kZWxDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHR0aGlzLnJlbmRlcigpO1xuXHRcdH0sXG5cdFx0XG5cdFx0b25UYXJnZXRZZWFySW5wdXQ6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHR2YXIgJHRoaXMgPSAkKCBldnQudGFyZ2V0ICksXG5cdFx0XHRcdHRhcmdldFllYXIgPSBwYXJzZUludCggJHRoaXMudmFsKCksIDEwICk7XG5cdFx0XHR0aGlzLiR0YXJnZXRZZWFyTGFiZWwudGV4dCggdGFyZ2V0WWVhciwgZmFsc2UsIFwiY2hhbmdlLW1hcFwiICk7XG5cdFx0fSxcblxuXHRcdG9uVGFyZ2V0WWVhckNoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdHZhciAkdGhpcyA9ICQoIGV2dC50YXJnZXQgKSxcblx0XHRcdFx0dGFyZ2V0WWVhciA9IHBhcnNlSW50KCAkdGhpcy52YWwoKSwgMTAgKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnVwZGF0ZU1hcENvbmZpZyggXCJ0YXJnZXRZZWFyXCIsIHRhcmdldFllYXIsIGZhbHNlLCBcImNoYW5nZS1tYXBcIiApO1xuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblx0XHR9LFxuXG5cdFx0b25SZWdpb25DbGljazogZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdHZhciAkdGhpcyA9ICQoIGV2dC50YXJnZXQgKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnVwZGF0ZU1hcENvbmZpZyggXCJwcm9qZWN0aW9uXCIsICR0aGlzLnRleHQoKSwgZmFsc2UsIFwiY2hhbmdlLW1hcFwiICk7XG5cdFx0XHR0aGlzLnJlbmRlcigpO1xuXHRcdH0sXG5cblx0XHRvblNldHRpbmdzSW5wdXQ6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHR2YXIgJHRoaXMgPSAkKCBldnQudGFyZ2V0ICksXG5cdFx0XHRcdG1vZGUgPSAoICR0aGlzLmlzKCBcIjpjaGVja2VkXCIgKSApPyBcInNwZWNpZmljXCI6IFwibm8taW50ZXJwb2xhdGlvblwiO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwudXBkYXRlTWFwQ29uZmlnKCBcIm1vZGVcIiwgbW9kZSwgZmFsc2UsIFwiY2hhbmdlLW1hcFwiICk7XG5cdFx0XHR0aGlzLnJlbmRlcigpO1xuXHRcdH1cblxuXHR9KTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5DaGFydC5NYXAuTWFwQ29udHJvbHM7XG5cbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgQXBwID0gcmVxdWlyZSggXCIuLy4uLy4uL25hbWVzcGFjZXMuanNcIiApO1xuXG5cdEFwcC5WaWV3cy5Gb3JtLkF4aXNUYWJWaWV3ID0gQmFja2JvbmUuVmlldy5leHRlbmQoe1xuXG5cdFx0ZWw6IFwiI2Zvcm0tdmlldyAjYXhpcy10YWJcIixcblx0XHRldmVudHM6IHtcblx0XHRcdFwiY2hhbmdlIGlucHV0LmZvcm0tY29udHJvbCwgc2VsZWN0LmZvcm0tY29udHJvbFwiOiBcIm9uRm9ybUNvbnRyb2xDaGFuZ2VcIixcblx0XHRcdFwiY2hhbmdlIFtuYW1lPSd4LWF4aXMtc2NhbGUtc2VsZWN0b3InXVwiOiBcIm9uWGF4aXNTY2FsZVNlbGVjdG9yXCIsXG5cdFx0XHRcImNoYW5nZSBbbmFtZT0neS1heGlzLXNjYWxlLXNlbGVjdG9yJ11cIjogXCJvbllheGlzU2NhbGVTZWxlY3RvclwiXG5cdFx0fSxcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0XG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIgPSBvcHRpb25zLmRpc3BhdGNoZXI7XG5cdFx0XHR0aGlzLnJlbmRlcigpO1xuXG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cblx0XHRcdC8vc2V0dXAgaW5pdGlhbCB2YWx1ZXNcblx0XHRcdHZhciB0aGF0ID0gdGhpcyxcblx0XHRcdFx0Y2hhcnRYYXhpcyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJ4LWF4aXNcIiApLFxuXHRcdFx0XHRjaGFydFlheGlzID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcInktYXhpc1wiICk7XG5cblx0XHRcdHZhciAkeEF4aXNTY2FsZVNlbGVjdG9yID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT0neC1heGlzLXNjYWxlLXNlbGVjdG9yJ11cIiApLFxuXHRcdFx0XHQkeUF4aXNTY2FsZVNlbGVjdG9yID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT0neS1heGlzLXNjYWxlLXNlbGVjdG9yJ11cIiApO1xuXG5cdFx0XHRfLmVhY2goIGNoYXJ0WGF4aXMsIGZ1bmN0aW9uKCBkLCBpICkge1xuXHRcdFx0XHR0aGF0LiRlbC5maW5kKCBcIltuYW1lPSdjaGFydC14LVwiICsgaSArIFwiJ11cIiApLnZhbCggZCApO1xuXHRcdFx0fSApO1xuXHRcdFx0Xy5lYWNoKCBjaGFydFlheGlzLCBmdW5jdGlvbiggZCwgaSApIHtcblx0XHRcdFx0dGhhdC4kZWwuZmluZCggXCJbbmFtZT0nY2hhcnQteS1cIiArIGkgKyBcIiddXCIgKS52YWwoIGQgKTtcblx0XHRcdH0gKTtcblxuXHRcdFx0JHhBeGlzU2NhbGVTZWxlY3Rvci5wcm9wKCBcImNoZWNrZWRcIiwgQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcIngtYXhpcy1zY2FsZS1zZWxlY3RvclwiICkgKTtcblx0XHRcdCR5QXhpc1NjYWxlU2VsZWN0b3IucHJvcCggXCJjaGVja2VkXCIsIEFwcC5DaGFydE1vZGVsLmdldCggXCJ5LWF4aXMtc2NhbGUtc2VsZWN0b3JcIiApICk7XG5cdFx0XHRcblxuXHRcdH0sXG5cblx0XHRvbkZvcm1Db250cm9sQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHRjb25zb2xlLmxvZyggXCJvbkZvcm1Db250cm9sQ2hhbmdlXCIgKTtcblx0XHRcdHZhciAkY29udHJvbCA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICksXG5cdFx0XHRcdGNvbnRyb2xOYW1lID0gJGNvbnRyb2wuYXR0ciggXCJuYW1lXCIgKSxcblx0XHRcdFx0Y29udHJvbFZhbHVlID0gJGNvbnRyb2wudmFsKCksXG5cdFx0XHRcdGF4aXNOYW1lID0gKCBjb250cm9sTmFtZS5pbmRleE9mKCBcImNoYXJ0LXlcIiApID4gLTEgKT8gXCJ5LWF4aXNcIjogXCJ4LWF4aXNcIjtcblxuXHRcdFx0Ly9zdHJpcCBjb250cm9sIG5hbWUgcHJlZml4XG5cdFx0XHRjb250cm9sTmFtZSA9IGNvbnRyb2xOYW1lLnN1YnN0cmluZyggOCApO1xuXG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5zZXRBeGlzQ29uZmlnKCBheGlzTmFtZSwgY29udHJvbE5hbWUsIGNvbnRyb2xWYWx1ZSApO1xuXG5cdFx0fSxcblxuXHRcdG9uWGF4aXNTY2FsZVNlbGVjdG9yOiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0dmFyICRjaGVjayA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5zZXQoIFwieC1heGlzLXNjYWxlLXNlbGVjdG9yXCIsICRjaGVjay5pcyggXCI6Y2hlY2tlZFwiICkgKTtcblx0XHR9LFxuXG5cdFx0b25ZYXhpc1NjYWxlU2VsZWN0b3I6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHR2YXIgJGNoZWNrID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJ5LWF4aXMtc2NhbGUtc2VsZWN0b3JcIiwgJGNoZWNrLmlzKCBcIjpjaGVja2VkXCIgKSApO1xuXHRcdH1cblxuXG5cdH0pO1xuXHRcblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVmlld3MuRm9ybS5BeGlzVGFiVmlldztcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBBcHAgPSByZXF1aXJlKCBcIi4vLi4vLi4vbmFtZXNwYWNlcy5qc1wiICksXG5cdFx0Q2hhcnRUeXBlU2VjdGlvblZpZXcgPSByZXF1aXJlKCBcIi4vYmFzaWNUYWIvQXBwLlZpZXdzLkZvcm0uQ2hhcnRUeXBlU2VjdGlvblZpZXcuanNcIiApLFxuXHRcdEFkZERhdGFTZWN0aW9uVmlldyA9IHJlcXVpcmUoIFwiLi9kYXRhVGFiL0FwcC5WaWV3cy5Gb3JtLkFkZERhdGFTZWN0aW9uVmlldy5qc1wiICksXG5cdFx0RGltZW5zaW9uc1NlY3Rpb25WaWV3ID0gcmVxdWlyZSggXCIuL2RhdGFUYWIvQXBwLlZpZXdzLkZvcm0uRGltZW5zaW9uc1NlY3Rpb25WaWV3LmpzXCIgKSxcblx0XHRTZWxlY3RlZENvdW50cmllc1NlY3Rpb25WaWV3ID0gcmVxdWlyZSggXCIuL2RhdGFUYWIvQXBwLlZpZXdzLkZvcm0uU2VsZWN0ZWRDb3VudHJpZXNTZWN0aW9uVmlldy5qc1wiICksXG5cdFx0RW50aXRpZXNTZWN0aW9uVmlldyA9IHJlcXVpcmUoIFwiLi9kYXRhVGFiL0FwcC5WaWV3cy5Gb3JtLkVudGl0aWVzU2VjdGlvblZpZXcuanNcIiApLFxuXHRcdFRpbWVTZWN0aW9uVmlldyA9IHJlcXVpcmUoIFwiLi9kYXRhVGFiL0FwcC5WaWV3cy5Gb3JtLlRpbWVTZWN0aW9uVmlldy5qc1wiICk7XG5cblx0QXBwLlZpZXdzLkZvcm0uQmFzaWNUYWJWaWV3ID0gQmFja2JvbmUuVmlldy5leHRlbmQoe1xuXG5cdFx0ZWw6IFwiI2Zvcm0tdmlldyAjYmFzaWMtdGFiXCIsXG5cdFx0ZXZlbnRzOiB7fSxcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0XG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIgPSBvcHRpb25zLmRpc3BhdGNoZXI7XG5cblx0XHRcdHRoaXMuY2hhcnRUeXBlU2VjdGlvbiA9IG5ldyBDaGFydFR5cGVTZWN0aW9uVmlldyggeyBkaXNwYXRjaGVyOiB0aGlzLmRpc3BhdGNoZXIgfSApO1xuXHRcdFx0dGhpcy5hZGREYXRhU2VjdGlvbiA9IG5ldyBBZGREYXRhU2VjdGlvblZpZXcoIHsgZGlzcGF0Y2hlcjogdGhpcy5kaXNwYXRjaGVyIH0gKTtcblx0XHRcdHRoaXMuZGltZW5zaW9uc1NlY3Rpb24gPSBuZXcgRGltZW5zaW9uc1NlY3Rpb25WaWV3KCB7IGRpc3BhdGNoZXI6IHRoaXMuZGlzcGF0Y2hlciB9ICk7XG5cdFx0XHR0aGlzLnNlbGVjdGVkQ291bnRyaWVzU2VjdGlvbiA9IG5ldyBTZWxlY3RlZENvdW50cmllc1NlY3Rpb25WaWV3KCB7IGRpc3BhdGNoZXI6IHRoaXMuZGlzcGF0Y2hlciB9ICk7XG5cdFx0XHR0aGlzLmVudGl0aWVzU2VjdGlvbiA9IG5ldyBFbnRpdGllc1NlY3Rpb25WaWV3KCB7IGRpc3BhdGNoZXI6IHRoaXMuZGlzcGF0Y2hlciB9ICk7XG5cdFx0XHR0aGlzLnRpbWVTZWN0aW9uID0gbmV3IFRpbWVTZWN0aW9uVmlldyggeyBkaXNwYXRjaGVyOiB0aGlzLmRpc3BhdGNoZXIgfSApO1xuXG5cdFx0XHR0aGlzLnJlbmRlcigpO1xuXG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcblx0XHRcdHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9Y2hhcnQtbmFtZV1cIiApLnZhbCggQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LW5hbWVcIiApICk7XG5cdFx0XHR0aGlzLiRlbC5maW5kKCBcIltuYW1lPWNoYXJ0LXN1Ym5hbWVdXCIgKS52YWwoIEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC1zdWJuYW1lXCIgKSApO1xuXG5cdFx0fVxuXG5cdH0pO1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkZvcm0uQmFzaWNUYWJWaWV3O1xuXG59KSgpO1xuIiwiOyggZnVuY3Rpb24oKSB7XG5cdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgQXBwID0gcmVxdWlyZSggXCIuLy4uLy4uL25hbWVzcGFjZXMuanNcIiApO1xuXG5cdEFwcC5WaWV3cy5Gb3JtLkRlc2NyaXB0aW9uVGFiVmlldyA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblxuXHRcdGVsOiBcIiNmb3JtLXZpZXcgI3NvdXJjZXMtdGFiXCIsXG5cdFx0ZXZlbnRzOiB7fSxcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0XG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIgPSBvcHRpb25zLmRpc3BhdGNoZXI7XG5cdFx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cblx0XHRcdHRoaXMuJHRleHRBcmVhID0gdGhpcy4kZWwuZmluZCggXCJ0ZXh0YXJlYVwiICk7XG5cdFx0XHR0aGlzLiR0ZXh0QXJlYS52YWwoIEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC1kZXNjcmlwdGlvblwiICkgKTtcblxuXHRcdFx0dGhpcy4kdGV4dEFyZWEud3lzaWh0bWw1KCB7XG5cdFx0XHRcdFwiZXZlbnRzXCI6IHtcblx0XHRcdFx0XHRcImNoYW5nZVwiOiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0XHRcdFx0dGhhdC5vbkZvcm1Db250cm9sQ2hhbmdlKCB0aGF0LiR0ZXh0QXJlYSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdHRoaXMucmVuZGVyKCk7XG5cblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblxuXHRcdH0sXG5cblx0XHRvbkZvcm1Db250cm9sQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHR2YXIgdGV4dEFyZWFWYWx1ZSA9IHRoaXMuJHRleHRBcmVhLnZhbCgpO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0KCBcImNoYXJ0LWRlc2NyaXB0aW9uXCIsIHRleHRBcmVhVmFsdWUgKTtcblxuXHRcdH1cblxuXG5cdH0pO1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkZvcm0uRGVzY3JpcHRpb25UYWJWaWV3O1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIEFwcCA9IHJlcXVpcmUoIFwiLi8uLi8uLi9uYW1lc3BhY2VzLmpzXCIgKTtcblxuXHRBcHAuVmlld3MuRm9ybS5FeHBvcnRUYWJWaWV3ID0gQmFja2JvbmUuVmlldy5leHRlbmQoe1xuXG5cdFx0ZWw6IFwiI2Zvcm0tdmlldyAjZXhwb3J0LXRhYlwiLFxuXHRcdGV2ZW50czoge1xuXHRcdFx0XCJjbGljayBbdHlwZT0nY2hlY2tib3gnXVwiOiBcIm9uVGFic0NoZWNrXCIsXG5cdFx0XHRcImNoYW5nZSAuZW1iZWQtc2l6ZS13cmFwcGVyIGlucHV0XCI6IFwib25FbWJlZFNpemVDaGFuZ2VcIlxuXHRcdH0sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdFxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gb3B0aW9ucy5kaXNwYXRjaGVyO1xuXHRcdFx0dGhpcy5kaXNwYXRjaGVyLm9uKCBcImNoYXJ0LXNhdmVkXCIsIHRoaXMub25DaGFydFNhdmVkLCB0aGlzICk7XG5cdFx0XHRcblx0XHRcdHRoaXMucmVuZGVyKCk7XG5cblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdFxuXHRcdFx0dGhpcy4kY2hlY2tib3hlcyA9IHRoaXMuJGVsLmZpbmQoIFwiW3R5cGU9J2NoZWNrYm94J11cIiApO1xuXHRcdFx0dGhpcy4kd2lkdGhJbnB1dCA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9J2lmcmFtZS13aWR0aCddXCIgKTtcblx0XHRcdHRoaXMuJGhlaWdodElucHV0ID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT0naWZyYW1lLWhlaWdodCddXCIgKTtcblx0XHRcdHRoaXMuJGlmcmFtZVRleHRBcmVhID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT0naWZyYW1lJ11cIiApO1xuXG5cdFx0XHR0aGlzLiRtYXBUYWIgPSAkKCBcIltocmVmPScjbWFwLXRhYiddXCIgKTtcblxuXHRcdFx0Ly91cGRhdGUgbGluZS10eXBlIGZyb20gbW9kZWxcblx0XHRcdHZhciB0aGF0ID0gdGhpcyxcblx0XHRcdFx0dGFicyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJ0YWJzXCIgKTtcblx0XHRcdF8uZWFjaCggdGFicywgZnVuY3Rpb24oIHYsIGkgKSB7XG5cdFx0XHRcdHZhciAkY2hlY2tib3ggPSB0aGF0LiRjaGVja2JveGVzLmZpbHRlciggXCJbdmFsdWU9J1wiICsgdiArIFwiJ11cIiApO1xuXHRcdFx0XHQkY2hlY2tib3gucHJvcCggXCJjaGVja2VkXCIsIHRydWUgKTtcblx0XHRcdFx0aWYoIHYgPT09IFwibWFwXCIgKSB7XG5cdFx0XHRcdFx0dGhhdC4kbWFwVGFiLmNzcyggXCJkaXNwbGF5XCIsIFwiYmxvY2tcIiApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cblx0XHRcdC8vdXBkYXRlIHNpemUgZnJvbSBtb2RlbFxuXHRcdFx0dGhpcy4kd2lkdGhJbnB1dC52YWwoIEFwcC5DaGFydE1vZGVsLmdldCggXCJpZnJhbWUtd2lkdGhcIiApICk7XG5cdFx0XHR0aGlzLiRoZWlnaHRJbnB1dC52YWwoIEFwcC5DaGFydE1vZGVsLmdldCggXCJpZnJhbWUtaGVpZ2h0XCIgKSApO1xuXG5cdFx0XHQvL3VwZGF0ZSBleHBvcnQgY29kZSBmcm9tIFxuXHRcdFx0dmFyIGNoYXJ0SWQgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiaWRcIiApO1xuXHRcdFx0aWYoIGNoYXJ0SWQgKSB7XG5cdFx0XHRcdHZhciB2aWV3VXJsID0gdGhpcy4kaWZyYW1lVGV4dEFyZWEuYXR0ciggXCJkYXRhLXZpZXctdXJsXCIgKTtcblx0XHRcdFx0dGhpcy5nZW5lcmF0ZUlmcmFtZUNvZGUoIGNoYXJ0SWQsIHZpZXdVcmwgKTtcblx0XHRcdH1cblxuXHRcdH0sXG5cblx0XHRvbkNoYXJ0U2F2ZWQ6IGZ1bmN0aW9uKCBpZCwgdmlld1VybCApIHtcblx0XHRcdHRoaXMuZ2VuZXJhdGVJZnJhbWVDb2RlKCBpZCwgdmlld1VybCApO1xuXHRcdH0sXG5cblx0XHRvblRhYnNDaGVjazogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dmFyIHRoYXQgPSB0aGlzLFxuXHRcdFx0XHRjaGVja2VkID0gW107XG5cdFx0XHQkLmVhY2goIHRoaXMuJGNoZWNrYm94ZXMsIGZ1bmN0aW9uKCBpLCB2ICkge1xuXG5cdFx0XHRcdHZhciAkY2hlY2tib3ggPSAkKCB0aGlzICk7XG5cdFx0XHRcdGlmKCAkY2hlY2tib3guaXMoIFwiOmNoZWNrZWRcIiApICkge1xuXHRcdFx0XHRcdGNoZWNrZWQucHVzaCggJGNoZWNrYm94LnZhbCgpICk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiggJGNoZWNrYm94LnZhbCgpID09PSBcIm1hcFwiICkge1xuXHRcdFx0XHRcdGlmKCAkY2hlY2tib3guaXMoIFwiOmNoZWNrZWRcIiApICkge1xuXHRcdFx0XHRcdFx0dGhhdC4kbWFwVGFiLmNzcyggXCJkaXNwbGF5XCIsIFwiYmxvY2tcIiApO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0aGF0LiRtYXBUYWIuY3NzKCBcImRpc3BsYXlcIiwgXCJub25lXCIgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcblx0XHRcdH0gKTtcblxuXHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0KCBcInRhYnNcIiwgY2hlY2tlZCApO1xuXG5cdFx0fSxcblxuXHRcdG9uRW1iZWRTaXplQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHRcblx0XHRcdHZhciAkaW5wdXQgPSAkKCBldnQuY3VycmVudFRhcmdldCApO1xuXHRcdFx0Ly91bm5lY2Vzc2FyeSB0byB1cGRhdGUgZXZlcnl0aGluZyBqdXN0IGJlY2F1c2UgZ2VuZXJhdGVkIGNvZGUgY2hhbmdlZFxuXHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0KCAkaW5wdXQuYXR0ciggXCJuYW1lXCIgKSwgJGlucHV0LnZhbCgpLCB7c2lsZW50OnRydWV9ICk7XG5cblx0XHRcdC8vaWYgYWxyZWFkeSBnZW5lcmF0ZWQgY29kZSwgdXBkYXRlIGl0XG5cdFx0XHRpZiggdGhpcy4kaWZyYW1lVGV4dEFyZWEudGV4dCgpICE9IFwiXCIgKSB7XG5cdFx0XHRcdHRoaXMuZ2VuZXJhdGVJZnJhbWVDb2RlKCk7XG5cdFx0XHR9XG5cblx0XHR9LFxuXG5cdFx0Z2VuZXJhdGVJZnJhbWVDb2RlOiBmdW5jdGlvbiggaWQsIHZpZXdVcmwgKSB7XG5cdFx0XHQvL3N0b3JlIHZpZXcgdXJsXG5cdFx0XHRpZiggdmlld1VybCApIHtcblx0XHRcdFx0dGhpcy52aWV3VXJsID0gdmlld1VybDtcblx0XHRcdH1cblx0XHRcdHRoaXMuJGlmcmFtZVRleHRBcmVhLnRleHQoICc8aWZyYW1lIHNyYz1cIicgKyB0aGlzLnZpZXdVcmwgKyAnXCIgc3R5bGU9XCJ3aWR0aDonICsgQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImlmcmFtZS13aWR0aFwiICkgKyAnO2hlaWdodDonICsgQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImlmcmFtZS1oZWlnaHRcIiApICsgJzsgYm9yZGVyOiAwcHggbm9uZTtcIj48L2lmcmFtZT4nICk7XG5cdFx0fVxuXG5cdH0pO1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkZvcm0uRXhwb3J0VGFiVmlldztcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBBcHAgPSByZXF1aXJlKCBcIi4vLi4vLi4vbmFtZXNwYWNlcy5qc1wiICk7XG5cblx0QXBwLlZpZXdzLkZvcm0uTWFwVGFiVmlldyA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblxuXHRcdGVsOiBcIiNmb3JtLXZpZXcgI21hcC10YWJcIixcblx0XHRldmVudHM6IHtcblx0XHRcdFwiY2hhbmdlIFtuYW1lPSdtYXAtdmFyaWFibGUtaWQnXVwiOiBcIm9uVmFyaWFibGVJZENoYW5nZVwiLFxuXHRcdFx0XCJjaGFuZ2UgW25hbWU9J21hcC10aW1lLXRvbGVyYW5jZSddXCI6IFwib25UaW1lVG9sZXJhbmNlQ2hhbmdlXCIsXG5cdFx0XHRcImNoYW5nZSBbbmFtZT0nbWFwLXRpbWUtaW50ZXJ2YWwnXVwiOiBcIm9uVGltZUludGVydmFsQ2hhbmdlXCIsXG5cdFx0XHRcImNoYW5nZSBbbmFtZT0nbWFwLWNvbG9yLXNjaGVtZSddXCI6IFwib25Db2xvclNjaGVtZUNoYW5nZVwiLFxuXHRcdFx0XCJjaGFuZ2UgW25hbWU9J21hcC1jb2xvci1pbnRlcnZhbCddXCI6IFwib25Db2xvckludGVydmFsQ2hhbmdlXCIsXG5cdFx0XHRcImNoYW5nZSBbbmFtZT0nbWFwLXByb2plY3Rpb25zJ11cIjogXCJvblByb2plY3Rpb25DaGFuZ2VcIlxuXHRcdH0sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdHRoaXMuZGlzcGF0Y2hlciA9IG9wdGlvbnMuZGlzcGF0Y2hlcjtcblxuXHRcdFx0QXBwLkNoYXJ0VmFyaWFibGVzQ29sbGVjdGlvbi5vbiggXCJhZGQgcmVtb3ZlIGNoYW5nZSByZXNldFwiLCB0aGlzLm9uVmFyaWFibGVzQ29sbGVjdGlvbkNoYW5nZSwgdGhpcyApO1xuXHRcdFx0QXBwLkF2YWlsYWJsZVRpbWVNb2RlbC5vbiggXCJjaGFuZ2VcIiwgdGhpcy5vbkF2YWlsYWJsZVRpbWVDaGFuZ2UsIHRoaXMgKTtcblx0XHRcdC8vQXBwLkNoYXJ0TW9kZWwub24oIFwiY2hhbmdlXCIsIHRoaXMub25DaGFydE1vZGVsQ2hhbmdlLCB0aGlzICk7XG5cdFx0XHRcblx0XHRcdHRoaXMuJHZhcmlhYmxlSWRTZWxlY3QgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPSdtYXAtdmFyaWFibGUtaWQnXVwiICk7XG5cdFx0XHRcblx0XHRcdHRoaXMuJHRpbWVUb2xlcmFuY2VJbnB1dCA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9J21hcC10aW1lLXRvbGVyYW5jZSddXCIgKTtcblx0XHRcdHRoaXMuJHRpbWVJbnRlcnZhbElucHV0ID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT0nbWFwLXRpbWUtaW50ZXJ2YWwnXVwiICk7XG5cdFx0XHRcblx0XHRcdHRoaXMuJGNvbG9yU2NoZW1lU2VsZWN0ID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT0nbWFwLWNvbG9yLXNjaGVtZSddXCIgKTtcblx0XHRcdHRoaXMuJGNvbG9ySW50ZXJ2YWxTZWxlY3QgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPSdtYXAtY29sb3ItaW50ZXJ2YWwnXVwiICk7XG5cdFx0XHRcblx0XHRcdHRoaXMuJHByb2plY3Rpb25zU2VsZWN0ID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT0nbWFwLXByb2plY3Rpb25zJ11cIiApO1xuXG5cdFx0XHQvL21ha2Ugc3VyZSB3ZSBoYXZlIGN1cnJlbnQgZGF0YVxuXHRcdFx0dGhpcy51cGRhdGVUYXJnZXRZZWFyKCB0cnVlICk7XG5cblx0XHRcdHRoaXMucmVuZGVyKCk7XG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XG5cdFx0XHQvL3BvcHVsYXRlIHZhcmlhYmxlIHNlbGVjdCB3aXRoIHRoZSBhdmFpbGFibGUgb25lc1xuXHRcdFx0dGhpcy4kdmFyaWFibGVJZFNlbGVjdC5lbXB0eSgpO1xuXG5cdFx0XHR2YXIgbWFwQ29uZmlnID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcIm1hcC1jb25maWdcIiApO1xuXHRcdFx0XHRcblx0XHRcdHRoaXMudXBkYXRlVmFyaWFibGVTZWxlY3QoKTtcblxuXHRcdFx0dGhpcy4kdGltZVRvbGVyYW5jZUlucHV0LnZhbCggbWFwQ29uZmlnLnRpbWVUb2xlcmFuY2UgKTtcblx0XHRcdHRoaXMuJHRpbWVJbnRlcnZhbElucHV0LnZhbCggbWFwQ29uZmlnLnRpbWVJbnRlcnZhbCApO1xuXG5cdFx0XHR0aGlzLnVwZGF0ZUNvbG9yU2NoZW1lU2VsZWN0KCk7XG5cdFx0XHR0aGlzLnVwZGF0ZUNvbG9ySW50ZXJ2YWxTZWxlY3QoKTtcblx0XHRcdHRoaXMudXBkYXRlUHJvamVjdGlvbnNTZWxlY3QoKTtcblxuXHRcdH0sXG5cblx0XHR1cGRhdGVWYXJpYWJsZVNlbGVjdDogZnVuY3Rpb24oKSB7XG5cblx0XHRcdHZhciBtYXBDb25maWcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwibWFwLWNvbmZpZ1wiICksXG5cdFx0XHRcdG1vZGVscyA9IEFwcC5DaGFydFZhcmlhYmxlc0NvbGxlY3Rpb24ubW9kZWxzLFxuXHRcdFx0XHRodG1sID0gXCJcIjtcblxuXHRcdFx0aWYoIG1vZGVscyAmJiBtb2RlbHMubGVuZ3RoICkge1xuXHRcdFx0XHRodG1sICs9IFwiPG9wdGlvbiBzZWxlY3RlZCBkaXNhYmxlZD5TZWxlY3QgdmFyaWFibGUgdG8gZGlzcGxheSBvbiBtYXA8L29wdGlvbj5cIjtcblx0XHRcdH1cblxuXHRcdFx0Xy5lYWNoKCBtb2RlbHMsIGZ1bmN0aW9uKCB2LCBpICkge1xuXHRcdFx0XHQvL2lmIG5vIHZhcmlhYmxlIHNlbGVjdGVkLCB0cnkgdG8gc2VsZWN0IGZpcnN0XG5cdFx0XHRcdHZhciBzZWxlY3RlZCA9ICggaSA9PSBtYXBDb25maWcudmFyaWFibGVJZCApPyBcIiBzZWxlY3RlZFwiOiBcIlwiO1xuXHRcdFx0XHRodG1sICs9IFwiPG9wdGlvbiB2YWx1ZT0nXCIgKyB2LmdldCggXCJpZFwiICkgKyBcIicgXCIgKyBzZWxlY3RlZCArIFwiPlwiICsgdi5nZXQoIFwibmFtZVwiICkgKyBcIjwvb3B0aW9uPlwiO1xuXHRcdFx0fSApO1xuXG5cdFx0XHQvL2NoZWNrIGZvciBlbXB0eSBodG1sXG5cdFx0XHRpZiggIWh0bWwgKSB7XG5cdFx0XHRcdGh0bWwgKz0gXCI8b3B0aW9uIHNlbGVjdGVkIGRpc2FibGVkPkFkZCBzb21lIHZhcmlhYmxlcyBpbiAyLkRhdGEgdGFiIGZpcnN0PC9vcHRpb24+XCI7XG5cdFx0XHRcdHRoaXMuJHZhcmlhYmxlSWRTZWxlY3QuYWRkQ2xhc3MoIFwiZGlzYWJsZWRcIiApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy4kdmFyaWFibGVJZFNlbGVjdC5yZW1vdmVDbGFzcyggXCJkaXNhYmxlZFwiICk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLiR2YXJpYWJsZUlkU2VsZWN0LmFwcGVuZCggJCggaHRtbCApICk7XG5cblx0XHRcdC8vY2hlY2sgaWYgd2Ugc2hvdWxkIHNlbGVjdCBmaXJzdCB2YXJpYWJsZVxuXHRcdFx0aWYoIG1vZGVscy5sZW5ndGggJiYgIXRoaXMuJHZhcmlhYmxlSWRTZWxlY3QudmFsKCkgKSB7XG5cdFx0XHRcdHZhciBmaXJzdE9wdGlvbiA9IHRoaXMuJHZhcmlhYmxlSWRTZWxlY3QuZmluZCggXCJvcHRpb25cIiApLmVxKCAxICkudmFsKCk7XG5cdFx0XHRcdHRoaXMuJHZhcmlhYmxlSWRTZWxlY3QudmFsKCBmaXJzdE9wdGlvbiApO1xuXHRcdFx0XHRBcHAuQ2hhcnRNb2RlbC51cGRhdGVNYXBDb25maWcoIFwidmFyaWFibGVJZFwiLCBmaXJzdE9wdGlvbiApO1xuXHRcdFx0fVxuXG5cdFx0fSxcblx0XHRcblx0XHR1cGRhdGVDb2xvclNjaGVtZVNlbGVjdDogZnVuY3Rpb24oKSB7XG5cdFx0XHRcblx0XHRcdHZhciBodG1sID0gXCJcIixcblx0XHRcdFx0bWFwQ29uZmlnID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcIm1hcC1jb25maWdcIiApO1xuXG5cdFx0XHR0aGlzLiRjb2xvclNjaGVtZVNlbGVjdC5lbXB0eSgpO1xuXHRcdFx0Xy5lYWNoKCBjb2xvcmJyZXdlciwgZnVuY3Rpb24oIHYsIGkgKSB7XG5cdFx0XHRcdHZhciBzZWxlY3RlZCA9ICggaSA9PSBtYXBDb25maWcuY29sb3JTY2hlbWVOYW1lICk/IFwiIHNlbGVjdGVkXCI6IFwiXCI7XG5cdFx0XHRcdGh0bWwgKz0gXCI8b3B0aW9uIHZhbHVlPSdcIiArIGkgKyBcIicgXCIgKyBzZWxlY3RlZCArIFwiPlwiICsgaSArIFwiPC9vcHRpb24+XCI7XG5cdFx0XHR9ICk7XG5cdFx0XHR0aGlzLiRjb2xvclNjaGVtZVNlbGVjdC5hcHBlbmQoICQoIGh0bWwgKSApO1xuXG5cdFx0fSxcblxuXHRcdHVwZGF0ZUNvbG9ySW50ZXJ2YWxTZWxlY3Q6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XG5cdFx0XHR2YXIgaHRtbCA9IFwiXCIsXG5cdFx0XHRcdG1hcENvbmZpZyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJtYXAtY29uZmlnXCIgKSxcblx0XHRcdFx0aGFzU2VsZWN0ZWQgPSBmYWxzZTtcblxuXHRcdFx0dGhpcy4kY29sb3JJbnRlcnZhbFNlbGVjdC5lbXB0eSgpO1xuXHRcdFx0Xy5lYWNoKCBjb2xvcmJyZXdlclsgIG1hcENvbmZpZy5jb2xvclNjaGVtZU5hbWUgXSwgZnVuY3Rpb24oIHYsIGkgKSB7XG5cdFx0XHRcdHZhciBzZWxlY3RlZCA9ICggaSA9PSBtYXBDb25maWcuY29sb3JTY2hlbWVJbnRlcnZhbCApPyBcIiBzZWxlY3RlZFwiOiBcIlwiO1xuXHRcdFx0XHRpZiggc2VsZWN0ZWQgPT09IFwiIHNlbGVjdGVkXCIgKSB7XG5cdFx0XHRcdFx0aGFzU2VsZWN0ZWQgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGh0bWwgKz0gXCI8b3B0aW9uIHZhbHVlPSdcIiArIGkgKyBcIicgXCIgKyBzZWxlY3RlZCArIFwiPlwiICsgaSArIFwiPC9vcHRpb24+XCI7XG5cdFx0XHR9ICk7XG5cdFx0XHR0aGlzLiRjb2xvckludGVydmFsU2VsZWN0LmFwcGVuZCggJCggaHRtbCApICk7XG5cblx0XHRcdGlmKCAhaGFzU2VsZWN0ZWQgKSB7XG5cdFx0XHRcdC8vdGhlcmUncyBub3Qgc2VsZWN0ZWQgaW50ZXJ2YWwgdGhhdCB3b3VsZCBleGlzdCB3aXRoIGN1cnJlbnQgY29sb3Igc2NoZW1lLCBzZWxlY3QgdGhhdCBmaXJzdFxuXHRcdFx0XHRBcHAuQ2hhcnRNb2RlbC51cGRhdGVNYXBDb25maWcoIFwiY29sb3JTY2hlbWVJbnRlcnZhbFwiLCB0aGlzLiRjb2xvckludGVydmFsU2VsZWN0LnZhbCgpICk7XG5cdFx0XHR9XG5cblx0XHR9LFxuXG5cdFx0dXBkYXRlUHJvamVjdGlvbnNTZWxlY3Q6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XG5cdFx0XHR2YXIgaHRtbCA9IFwiXCIsXG5cdFx0XHRcdG1hcENvbmZpZyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJtYXAtY29uZmlnXCIgKTtcblxuXHRcdFx0dGhpcy4kcHJvamVjdGlvbnNTZWxlY3QuZW1wdHkoKTtcblx0XHRcdF8uZWFjaCggQXBwLlZpZXdzLkNoYXJ0Lk1hcFRhYi5wcm9qZWN0aW9ucywgZnVuY3Rpb24oIHYsIGkgKSB7XG5cdFx0XHRcdHZhciBzZWxlY3RlZCA9ICggaSA9PSBtYXBDb25maWcucHJvamVjdGlvbnMgKT8gXCIgc2VsZWN0ZWRcIjogXCJcIjtcblx0XHRcdFx0aHRtbCArPSBcIjxvcHRpb24gdmFsdWU9J1wiICsgaSArIFwiJyBcIiArIHNlbGVjdGVkICsgXCI+XCIgKyBpICsgXCI8L29wdGlvbj5cIjtcblx0XHRcdH0gKTtcblx0XHRcdHRoaXMuJHByb2plY3Rpb25zU2VsZWN0LmFwcGVuZCggJCggaHRtbCApICk7XG5cblx0XHR9LFxuXG5cdFx0dXBkYXRlVGFyZ2V0WWVhcjogZnVuY3Rpb24oIHNpbGVudCApIHtcblx0XHRcdHZhciBjaGFydFRpbWUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdGltZVwiICksXG5cdFx0XHRcdHRhcmdldFllYXIgPSAoIGNoYXJ0VGltZSApPyBjaGFydFRpbWVbMF06IEFwcC5BdmFpbGFibGVUaW1lTW9kZWwuZ2V0KCBcIm1pblwiICksXG5cdFx0XHRcdG1pblllYXIgPSB0YXJnZXRZZWFyLFxuXHRcdFx0XHRtYXhZZWFyID0gKCBjaGFydFRpbWUgKT8gY2hhcnRUaW1lWzFdOiBBcHAuQXZhaWxhYmxlVGltZU1vZGVsLmdldCggXCJtYXhcIiApO1xuXG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC51cGRhdGVNYXBDb25maWcoIFwibWluWWVhclwiLCBtaW5ZZWFyLCB0cnVlICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC51cGRhdGVNYXBDb25maWcoIFwibWF4WWVhclwiLCBtYXhZZWFyLCB0cnVlICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC51cGRhdGVNYXBDb25maWcoIFwidGFyZ2V0WWVhclwiLCB0YXJnZXRZZWFyLCBzaWxlbnQgKTtcblx0XHR9LFxuXG5cdFx0b25WYXJpYWJsZXNDb2xsZWN0aW9uQ2hhbmdlOiBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMucmVuZGVyKCk7XG5cdFx0fSxcblxuXHRcdG9uVmFyaWFibGVJZENoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdHZhciAkdGhpcyA9ICQoIGV2dC50YXJnZXQgKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnVwZGF0ZU1hcENvbmZpZyggXCJ2YXJpYWJsZUlkXCIsICR0aGlzLnZhbCgpICk7XG5cdFx0fSxcblxuXHRcdG9uVGltZVRvbGVyYW5jZUNoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdHZhciAkdGhpcyA9ICQoIGV2dC50YXJnZXQgKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnVwZGF0ZU1hcENvbmZpZyggXCJ0aW1lVG9sZXJhbmNlXCIsIHBhcnNlSW50KCAkdGhpcy52YWwoKSwgMTAgKSApO1xuXHRcdH0sXG5cblx0XHRvblRpbWVJbnRlcnZhbENoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdHZhciAkdGhpcyA9ICQoIGV2dC50YXJnZXQgKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnVwZGF0ZU1hcENvbmZpZyggXCJ0aW1lSW50ZXJ2YWxcIiwgcGFyc2VJbnQoICR0aGlzLnZhbCgpLCAxMCApICk7XG5cdFx0fSxcblxuXHRcdG9uQ29sb3JTY2hlbWVDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHR2YXIgJHRoaXMgPSAkKCBldnQudGFyZ2V0ICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC51cGRhdGVNYXBDb25maWcoIFwiY29sb3JTY2hlbWVOYW1lXCIsICR0aGlzLnZhbCgpICk7XG5cdFx0XHQvL25lZWQgdG8gdXBkYXRlIG51bWJlciBvZiBjbGFzc2VzXG5cdFx0XHR0aGlzLnVwZGF0ZUNvbG9ySW50ZXJ2YWxTZWxlY3QoKTtcblx0XHR9LFxuXG5cdFx0b25Db2xvckludGVydmFsQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0dmFyICR0aGlzID0gJCggZXZ0LnRhcmdldCApO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwudXBkYXRlTWFwQ29uZmlnKCBcImNvbG9yU2NoZW1lSW50ZXJ2YWxcIiwgcGFyc2VJbnQoICR0aGlzLnZhbCgpLCAxMCApICk7XG5cdFx0fSxcblxuXHRcdG9uUHJvamVjdGlvbkNoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdHZhciAkdGhpcyA9ICQoIGV2dC50YXJnZXQgKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnVwZGF0ZU1hcENvbmZpZyggXCJwcm9qZWN0aW9uXCIsICR0aGlzLnZhbCgpICk7XG5cdFx0fSxcblxuXHRcdG9uQ2hhcnRNb2RlbENoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdHRoaXMudXBkYXRlVGFyZ2V0WWVhciggdHJ1ZSApO1xuXHRcdH0sXG5cblx0XHRvbkF2YWlsYWJsZVRpbWVDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHR0aGlzLnVwZGF0ZVRhcmdldFllYXIoIGZhbHNlICk7XG5cdFx0fVxuXG5cdH0pO1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkZvcm0uTWFwVGFiVmlldztcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBBcHAgPSByZXF1aXJlKCBcIi4vLi4vLi4vbmFtZXNwYWNlcy5qc1wiICk7XG5cblx0QXBwLlZpZXdzLkZvcm0uU3R5bGluZ1RhYlZpZXcgPSBCYWNrYm9uZS5WaWV3LmV4dGVuZCh7XG5cblx0XHRlbDogXCIjZm9ybS12aWV3ICNzdHlsaW5nLXRhYlwiLFxuXHRcdGV2ZW50czoge1xuXHRcdFx0XCJjaGFuZ2UgW25hbWU9J2xpbmUtdHlwZSddXCI6IFwib25MaW5lVHlwZUNoYW5nZVwiLFxuXHRcdFx0XCJjaGFuZ2UgW25hbWVePSdtYXJnaW4tJ11cIjogXCJvbk1hcmdpbkNoYW5nZVwiLFxuXHRcdFx0XCJjaGFuZ2UgW25hbWU9J2hpZGUtbGVnZW5kJ11cIjogXCJvbkhpZGVMZWdlbmRDaGFuZ2VcIlxuXHRcdH0sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdFxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gb3B0aW9ucy5kaXNwYXRjaGVyO1xuXHRcdFx0XG5cdFx0XHR0aGlzLiRsaW5lVHlwZVJhZGlvcyA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9J2xpbmUtdHlwZSddXCIgKTtcblx0XHRcdFxuXHRcdFx0Ly9tYXJnaW5zXG5cdFx0XHR0aGlzLiRtYXJnaW5Ub3AgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPSdtYXJnaW4tdG9wJ11cIiApO1xuXHRcdFx0dGhpcy4kbWFyZ2luTGVmdCA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9J21hcmdpbi1sZWZ0J11cIiApO1xuXHRcdFx0dGhpcy4kbWFyZ2luUmlnaHQgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPSdtYXJnaW4tcmlnaHQnXVwiICk7XG5cdFx0XHR0aGlzLiRtYXJnaW5Cb3R0b20gPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPSdtYXJnaW4tYm90dG9tJ11cIiApO1xuXHRcdFx0XG5cdFx0XHQvL2xlZ2VuZFxuXHRcdFx0dGhpcy4kaGlkZUxlZ2VuZCA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9J2hpZGUtbGVnZW5kJ11cIiApO1xuXG5cdFx0XHQvL3VuaXRzXG5cdFx0XHR0aGlzLiR1bml0c1NlY3Rpb24gPSB0aGlzLiRlbC5maW5kKCBcIi51bml0cy1zZWN0aW9uXCIgKTtcblx0XHRcdHRoaXMuJHVuaXRzQ29udGVudCA9IHRoaXMuJHVuaXRzU2VjdGlvbi5maW5kKCBcIi5mb3JtLXNlY3Rpb24tY29udGVudFwiICk7XG5cdFx0XHRcblx0XHRcdEFwcC5DaGFydE1vZGVsLm9uKCBcImNoYW5nZTpjaGFydC10eXBlXCIsIHRoaXMub25DaGFydFR5cGVDaGFuZ2UsIHRoaXMgKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLm9uKCBcImNoYW5nZTpjaGFydC1kaW1lbnNpb25zXCIsIHRoaXMucmVuZGVyLCB0aGlzICk7XG5cdFx0XHRcblx0XHRcdHRoaXMucmVuZGVyKCk7XG5cblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblxuXHRcdFx0dmFyIGxpbmVUeXBlID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImxpbmUtdHlwZVwiICk7XG5cdFx0XHR0aGlzLiRsaW5lVHlwZVJhZGlvcy5maWx0ZXIoIFwiW3ZhbHVlPSdcIiArIGxpbmVUeXBlICsgXCInXVwiICkucHJvcCggXCJjaGVja2VkXCIsIHRydWUgKTtcblxuXHRcdFx0dmFyIG1hcmdpbnMgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwibWFyZ2luc1wiICk7XG5cdFx0XHR0aGlzLiRtYXJnaW5Ub3AudmFsKCBtYXJnaW5zLnRvcCApO1xuXHRcdFx0dGhpcy4kbWFyZ2luTGVmdC52YWwoIG1hcmdpbnMubGVmdCApO1xuXHRcdFx0dGhpcy4kbWFyZ2luUmlnaHQudmFsKCBtYXJnaW5zLnJpZ2h0ICk7XG5cdFx0XHR0aGlzLiRtYXJnaW5Cb3R0b20udmFsKCBtYXJnaW5zLmJvdHRvbSApO1xuXG5cdFx0XHR2YXIgaGlkZUxlZ2VuZCA9ICggQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImhpZGUtbGVnZW5kXCIgKSApPyB0cnVlOiBmYWxzZTtcblx0XHRcdHRoaXMuJGhpZGVMZWdlbmQucHJvcCggXCJjaGVja2VkXCIsIGhpZGVMZWdlbmQgKTtcblxuXHRcdFx0dGhpcy51cGRhdGVVbml0c1VJKCk7XG5cdFx0XHQkKCBcIi51bml0cy1zZWN0aW9uIC5mb3JtLWNvbnRyb2xbdHlwZT1pbnB1dF0sIC51bml0cy1zZWN0aW9uIFt0eXBlPWNoZWNrYm94XVwiICkub24oIFwiY2hhbmdlXCIsICQucHJveHkoIHRoaXMudXBkYXRlVW5pdHMsIHRoaXMgKSApO1xuXHRcdFxuXHRcdH0sXG5cblx0XHRvbkxpbmVUeXBlQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHR2YXIgJHJhZGlvID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJsaW5lLXR5cGVcIiwgJHJhZGlvLnZhbCgpICk7XG5cblx0XHR9LFxuXG5cdFx0b25NYXJnaW5DaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdHZhciAkY29udHJvbCA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICksXG5cdFx0XHRcdGNvbnRyb2xOYW1lID0gJGNvbnRyb2wuYXR0ciggXCJuYW1lXCIgKSxcblx0XHRcdFx0bWFyZ2luc09iaiA9IHsgdG9wOiB0aGlzLiRtYXJnaW5Ub3AudmFsKCksXG5cdFx0XHRcdFx0XHRcdGxlZnQ6IHRoaXMuJG1hcmdpbkxlZnQudmFsKCksXG5cdFx0XHRcdFx0XHRcdHJpZ2h0OiB0aGlzLiRtYXJnaW5SaWdodC52YWwoKSxcblx0XHRcdFx0XHRcdFx0Ym90dG9tOiB0aGlzLiRtYXJnaW5Cb3R0b20udmFsKCkgfTtcblxuXHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0KCBcIm1hcmdpbnNcIiwgbWFyZ2luc09iaiApO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwudHJpZ2dlciggXCJ1cGRhdGVcIiApO1xuXG5cdFx0fSxcblxuXHRcdG9uVW5pdENoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdHZhciAkY29udHJvbCA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5zZXQoIFwidW5pdFwiLCAkY29udHJvbC52YWwoKSApO1xuXHRcdH0sXG5cblx0XHRvbkhpZGVMZWdlbmRDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdHZhciAkY2hlY2sgPSAkKCBldnQuY3VycmVudFRhcmdldCApLFxuXHRcdFx0XHRoaWRlTGVnZW5kID0gKCAkY2hlY2suaXMoIFwiOmNoZWNrZWRcIiApICk/IHRydWU6IGZhbHNlO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0KCBcImhpZGUtbGVnZW5kXCIsIGhpZGVMZWdlbmQgKTtcblxuXHRcdH0sXG5cblx0XHRvbkNoYXJ0VHlwZUNoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0aWYoIEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10eXBlXCIgKSA9PT0gXCIyXCIgKSB7XG5cdFx0XHRcdC8vc2NhdHRlciBwbG90IGhhcyBsZWdlbmQgaGlkZGVuIGJ5IGRlZmF1bHRcblx0XHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0KCBcImhpZGUtbGVnZW5kXCIsIHRydWUgKTtcblx0XHRcdH1cblxuXHRcdH0sXG5cblx0XHR1cGRhdGVVbml0c1VJOiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0XG5cdFx0XHR2YXIgZGltZW5zaW9uc1N0cmluZyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC1kaW1lbnNpb25zXCIgKSwgLy9BcHAuQ2hhcnREaW1lbnNpb25zTW9kZWwuZ2V0KCBcImNoYXJ0RGltZW5zaW9uc1wiICksXG5cdFx0XHRcdGRpbWVuc2lvbnMgPSAoICEkLmlzRW1wdHlPYmplY3QoIGRpbWVuc2lvbnNTdHJpbmcgKSApPyAkLnBhcnNlSlNPTiggZGltZW5zaW9uc1N0cmluZyApOiB7fSxcblx0XHRcdFx0dW5pdHNTdHJpbmcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwidW5pdHNcIiApLFxuXHRcdFx0XHR1bml0cyA9ICggISQuaXNFbXB0eU9iamVjdCggdW5pdHNTdHJpbmcgKSApPyAkLnBhcnNlSlNPTiggdW5pdHNTdHJpbmcgKToge307XG5cdFx0XHRcblx0XHRcdC8vcmVmcmVzaCB3aG9sZSB1bml0IHNlY3Rpb25cblx0XHRcdHRoaXMuJHVuaXRzQ29udGVudC5odG1sKCBcIjx1bD48L3VsPlwiICk7XG5cdFx0XHR2YXIgJHVsID0gdGhpcy4kdW5pdHNDb250ZW50LmZpbmQoIFwidWxcIiApO1xuXG5cdFx0XHRpZiggZGltZW5zaW9ucyApIHtcblxuXHRcdFx0XHQkLmVhY2goIGRpbWVuc2lvbnMsIGZ1bmN0aW9uKCBpLCB2ICkge1xuXG5cdFx0XHRcdFx0dmFyIGRpbWVuc2lvbiA9IHYsXG5cdFx0XHRcdFx0XHR1bml0T2JqID0gXy5maW5kV2hlcmUoIHVuaXRzLCB7IFwicHJvcGVydHlcIjogZGltZW5zaW9uLnByb3BlcnR5IH0gKSxcblx0XHRcdFx0XHRcdC8vYnkgZGVmYXVsdCB2aXNpYmxlXG5cdFx0XHRcdFx0XHR2aXNpYmxlID0gKCB1bml0T2JqICYmIHVuaXRPYmouaGFzT3duUHJvcGVydHkoIFwidmlzaWJsZVwiICkgICk/IHVuaXRPYmoudmlzaWJsZTogdHJ1ZSxcblx0XHRcdFx0XHRcdHZpc2libGVQcm9wID0gKCB2aXNpYmxlICk/IFwiIGNoZWNrZWRcIjogXCJcIixcblx0XHRcdFx0XHRcdHVuaXQgPSAoIHVuaXRPYmogJiYgdW5pdE9iai51bml0ICk/IHVuaXRPYmoudW5pdDogXCJcIixcblx0XHRcdFx0XHRcdGZvcm1hdCA9ICggdW5pdE9iaiAmJiB1bml0T2JqLmZvcm1hdCApPyB1bml0T2JqLmZvcm1hdDogXCJcIjtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHRpZiggIXVuaXRPYmogJiYgZGltZW5zaW9uICYmIGRpbWVuc2lvbi51bml0ICkge1xuXHRcdFx0XHRcdFx0Ly9pZiBub3RoaW5nIHN0b3JlZCwgdHJ5IHRvIGdldCBkZWZhdWx0IHVuaXRzIGZvciBnaXZlbiB2YXJpYWJsZVxuXHRcdFx0XHRcdFx0dW5pdCA9IGRpbWVuc2lvbi51bml0O1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHZhciAkbGkgPSAkKCBcIjxsaSBkYXRhLXByb3BlcnR5PSdcIiArIGRpbWVuc2lvbi5wcm9wZXJ0eSArIFwiJz48bGFiZWw+XCIgKyBkaW1lbnNpb24ubmFtZSArIFwiOjwvbGFiZWw+VmlzaWJsZTo8aW5wdXQgdHlwZT0nY2hlY2tib3gnIGNsYXNzPSd2aXNpYmxlLWlucHV0JyBcIiArIHZpc2libGVQcm9wICsgXCIvPjxpbnB1dCB0eXBlPSdpbnB1dCcgY2xhc3M9J2Zvcm0tY29udHJvbCB1bml0LWlucHV0JyB2YWx1ZT0nXCIgKyB1bml0ICsgXCInIHBsYWNlaG9sZGVyPSdVbml0JyAvPjxpbnB1dCB0eXBlPSdpbnB1dCcgY2xhc3M9J2Zvcm0tY29udHJvbCBmb3JtYXQtaW5wdXQnIHZhbHVlPSdcIiArIGZvcm1hdCArIFwiJyBwbGFjZWhvbGRlcj0nTm8gb2YgZGVjLiBwbGFjZXMnIC8+PC9saT5cIiApO1xuXHRcdFx0XHRcdCR1bC5hcHBlbmQoICRsaSApO1xuXG5cdFx0XHRcdH0gKTtcblxuXHRcdFx0fVxuXHRcdFx0XG5cdFx0fSxcblxuXHRcdHVwZGF0ZVVuaXRzOiBmdW5jdGlvbigpIHtcblx0XHRcdFxuXHRcdFx0dmFyIHVuaXRzID0gW10sXG5cdFx0XHRcdCR1bml0TGlzID0gdGhpcy4kdW5pdHNDb250ZW50LmZpbmQoIFwibGlcIiApO1xuXG5cdFx0XHQkLmVhY2goICR1bml0TGlzLCBmdW5jdGlvbiggaSwgdiApIHtcblx0XHRcdFx0XG5cdFx0XHRcdHZhciAkbGkgPSAkKCB2ICksXG5cdFx0XHRcdFx0JHZpc2libGUgPSAkbGkuZmluZCggXCIudmlzaWJsZS1pbnB1dFwiICksXG5cdFx0XHRcdFx0JHVuaXQgPSAkbGkuZmluZCggXCIudW5pdC1pbnB1dFwiICksXG5cdFx0XHRcdFx0JGZvcm1hdCA9ICRsaS5maW5kKCBcIi5mb3JtYXQtaW5wdXRcIiApO1xuXG5cdFx0XHRcdC8vZm9yIGVhY2ggbGkgd2l0aCB1bml0IGluZm9ybWF0aW9uLCBjb25zdHJ1Y3Qgb2JqZWN0IHdpdGggcHJvcGVydHksIHVuaXQgYW5kIGZvcm1hdCBwcm9wZXJ0aWVzXG5cdFx0XHRcdHZhciB1bml0U2V0dGluZ3MgPSB7XG5cdFx0XHRcdFx0XCJwcm9wZXJ0eVwiOiAkbGkuYXR0ciggXCJkYXRhLXByb3BlcnR5XCIgKSxcblx0XHRcdFx0XHRcInZpc2libGVcIjogJHZpc2libGUuaXMoIFwiOmNoZWNrZWRcIiApLFxuXHRcdFx0XHRcdFwidW5pdFwiOiAkdW5pdC52YWwoKSxcblx0XHRcdFx0XHRcImZvcm1hdFwiOiAkZm9ybWF0LnZhbCgpXG5cdFx0XHRcdH07XG5cdFx0XHRcdFx0XG5cdFx0XHRcdHVuaXRzLnB1c2goIHVuaXRTZXR0aW5ncyApO1xuXG5cdFx0XHR9ICk7XG5cblx0XHRcdHZhciBqc29uID0gSlNPTi5zdHJpbmdpZnkoIHVuaXRzICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5zZXQoIFwidW5pdHNcIiwganNvbiApO1xuXHRcdFx0XG5cdFx0fVxuXG5cdH0pO1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkZvcm0uU3R5bGluZ1RhYlZpZXc7XG5cbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgQXBwID0gcmVxdWlyZSggXCIuLy4uLy4uLy4uL25hbWVzcGFjZXMuanNcIiApO1xuXG5cdEFwcC5WaWV3cy5Gb3JtLkNoYXJ0VHlwZVNlY3Rpb25WaWV3ID0gQmFja2JvbmUuVmlldy5leHRlbmQoe1xuXG5cdFx0ZWw6IFwiI2Zvcm0tdmlldyAjYmFzaWMtdGFiIC5jaGFydC10eXBlLXNlY3Rpb25cIixcblx0XHRldmVudHM6IHtcblx0XHRcdFwiY2hhbmdlIFtuYW1lPSdjaGFydC10eXBlJ11cIjogXCJvbkNoYXJ0VHlwZUNoYW5nZVwiLFxuXHRcdH0sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdFxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gb3B0aW9ucy5kaXNwYXRjaGVyO1xuXHRcdFx0QXBwLkNoYXJ0RGltZW5zaW9uc01vZGVsLm9uKCBcImNoYW5nZVwiLCB0aGlzLnJlbmRlciwgdGhpcyApO1xuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblxuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyICRzZWxlY3QgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPSdjaGFydC10eXBlJ11cIiApLFxuXHRcdFx0XHRzZWxlY3RlZENoYXJ0VHlwZSA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10eXBlXCIgKTtcblx0XHRcdGlmKCBzZWxlY3RlZENoYXJ0VHlwZSApIHtcblx0XHRcdFx0JHNlbGVjdC52YWwoIHNlbGVjdGVkQ2hhcnRUeXBlICk7XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdG9uQ2hhcnRUeXBlQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHQvL2NsZWFyIHVmIHNvbWV0aGluZyBwcmV2aW91c2x5IHNlbGVjdGVkXG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC51bnNldCggXCJ2YXJpYWJsZXNcIiwge3NpbGVudDp0cnVlfSApO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwudW5zZXQoIFwiY2hhcnQtZGltZW5zaW9uc1wiLCB7c2lsZW50OnRydWV9ICk7XG5cblx0XHRcdHZhciAkc2VsZWN0ID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJjaGFydC10eXBlXCIsICRzZWxlY3QudmFsKCkgKTtcblxuXHRcdFx0QXBwLkNoYXJ0RGltZW5zaW9uc01vZGVsLmxvYWRDb25maWd1cmF0aW9uKCAkc2VsZWN0LnZhbCgpICk7XG5cblx0XHR9XG5cblx0fSk7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVmlld3MuRm9ybS5DaGFydFR5cGVTZWN0aW9uVmlldztcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBBcHAgPSByZXF1aXJlKCBcIi4vLi4vLi4vLi4vbmFtZXNwYWNlcy5qc1wiICksXG5cdFx0U2VsZWN0VmFyUG9wdXAgPSByZXF1aXJlKCBcIi4vLi4vLi4vdWkvQXBwLlZpZXdzLlVJLlNlbGVjdFZhclBvcHVwLmpzXCIgKSxcblx0XHRTZXR0aW5nc1ZhclBvcHVwID0gcmVxdWlyZSggXCIuLy4uLy4uL3VpL0FwcC5WaWV3cy5VSS5TZXR0aW5nc1ZhclBvcHVwLmpzXCIgKTtcblxuXHRBcHAuVmlld3MuRm9ybS5BZGREYXRhU2VjdGlvblZpZXcgPSBCYWNrYm9uZS5WaWV3LmV4dGVuZCh7XG5cblx0XHRlbDogXCIjZm9ybS12aWV3ICNkYXRhLXRhYiAuYWRkLWRhdGEtc2VjdGlvblwiLFxuXHRcdGV2ZW50czoge1xuXHRcdFx0XCJjbGljayAuYWRkLWRhdGEtYnRuXCI6IFwib25BZGREYXRhQnRuXCIsXG5cdFx0fSxcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0XG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIgPSBvcHRpb25zLmRpc3BhdGNoZXI7XG5cblx0XHRcdHRoaXMuc2VsZWN0VmFyUG9wdXAgPSBuZXcgU2VsZWN0VmFyUG9wdXAoKTtcblx0XHRcdHRoaXMuc2VsZWN0VmFyUG9wdXAuaW5pdCggb3B0aW9ucyApO1xuXG5cdFx0XHR0aGlzLnNldHRpbmdzVmFyUG9wdXAgPSBuZXcgU2V0dGluZ3NWYXJQb3B1cCgpO1xuXHRcdFx0dGhpcy5zZXR0aW5nc1ZhclBvcHVwLmluaXQoIG9wdGlvbnMgKTtcblxuXHRcdFx0QXBwLkNoYXJ0VmFyaWFibGVzQ29sbGVjdGlvbi5vbiggXCJyZXNldFwiLCB0aGlzLm9uVmFyaWFibGVSZXNldCwgdGhpcyApO1xuXHRcdFx0QXBwLkNoYXJ0VmFyaWFibGVzQ29sbGVjdGlvbi5vbiggXCJhZGRcIiwgdGhpcy5vblZhcmlhYmxlQWRkLCB0aGlzICk7XG5cdFx0XHRBcHAuQ2hhcnRWYXJpYWJsZXNDb2xsZWN0aW9uLm9uKCBcInJlbW92ZVwiLCB0aGlzLm9uVmFyaWFibGVSZW1vdmUsIHRoaXMgKTtcblxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyLm9uKCBcInZhcmlhYmxlLWxhYmVsLW1vdmVkXCIsIHRoaXMub25WYXJpYWJsZUxhYmVsTW92ZWQsIHRoaXMgKTtcblx0XHRcdHRoaXMuZGlzcGF0Y2hlci5vbiggXCJkaW1lbnNpb24tc2V0dGluZy11cGRhdGVcIiwgdGhpcy5vbkRpbWVuc2lvblNldHRpbmdVcGRhdGUsIHRoaXMgKTtcblxuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblxuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHR0aGlzLiRkZCA9IHRoaXMuJGVsLmZpbmQoIFwiLmRkXCIgKTtcblx0XHRcdHRoaXMuJGRkTGlzdCA9IHRoaXMuJGRkLmZpbmQoIFwiLmRkLWxpc3RcIiApO1xuXHRcdFx0dGhpcy4kZGQubmVzdGFibGUoKTtcblxuXHRcdFx0dGhpcy5vblZhcmlhYmxlUmVzZXQoKTtcblxuXHRcdH0sXG5cblx0XHRyZWZyZXNoSGFuZGxlcnM6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyICRyZW1vdmVCdG5zID0gdGhpcy4kZGRMaXN0LmZpbmQoIFwiLmZhLWNsb3NlXCIgKTtcblx0XHRcdCRyZW1vdmVCdG5zLm9uKCBcImNsaWNrXCIsICQucHJveHkoIHRoaXMub25SZW1vdmVCdG5DbGljaywgdGhpcyApICk7XG5cdFx0XHR0aGlzLiRkZC5uZXN0YWJsZSgpO1xuXHRcdH0sXG5cblx0XHRvbkFkZERhdGFCdG46IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHR0aGlzLnNlbGVjdFZhclBvcHVwLnNob3coKTtcblxuXHRcdH0sXG5cblx0XHRvblZhcmlhYmxlUmVzZXQ6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHR2YXIgdGhhdCA9IHRoaXMsXG5cdFx0XHRcdG1vZGVscyA9IEFwcC5DaGFydFZhcmlhYmxlc0NvbGxlY3Rpb24ubW9kZWxzO1xuXHRcdFx0Xy5lYWNoKCBtb2RlbHMsIGZ1bmN0aW9uKCB2LCBpICkge1xuXHRcdFx0XHR0aGF0Lm9uVmFyaWFibGVBZGQoIHYgKTtcblx0XHRcdH0gKTtcblxuXHRcdH0sXG5cblx0XHRvblZhcmlhYmxlQWRkOiBmdW5jdGlvbiggbW9kZWwgKSB7XG5cblx0XHRcdC8vaWYgdGhlcmUncyBlbXB0eSBlbGVtZW50LCByZW1vdmUgaXRcblx0XHRcdHRoaXMuJGVsLmZpbmQoIFwiLmRkLWVtcHR5XCIgKS5yZW1vdmUoKTtcblx0XHRcdC8vcmVmZXRjaCBkZC1saXN0IC0gbmVlZGVkIGlmIHRoZXJlIHdhcyBzb21ldGhpbmcgcmVtb3ZlZFxuXHRcdFx0dGhpcy4kZGRMaXN0ID0gdGhpcy4kZGQuZmluZCggXCIuZGQtbGlzdFwiICk7XG5cblx0XHRcdGlmKCAhdGhpcy4kZGQuZmluZCggXCIuZGQtbGlzdFwiICkubGVuZ3RoICkge1xuXHRcdFx0XHQvL2RkLWxpc3QgaGFzIGJlZW4gcmVtb3ZlZCBieSBuZXN0YWJsZVxuXHRcdFx0XHR2YXIgJGRkTGlzdCA9ICQoIFwiPG9sIGNsYXNzPSdkZC1saXN0Jz48L29sPlwiICk7XG5cdFx0XHRcdHRoaXMuJGRkLmFwcGVuZCggJGRkTGlzdCApO1xuXHRcdFx0XHR0aGlzLiRkZExpc3QgPSB0aGlzLiRkZC5maW5kKCBcIi5kZC1saXN0XCIgKTtcblx0XHRcdH1cblxuXHRcdFx0Ly9oYXZlIGRlZmF1bHQgdGFyZ2V0IHllYXIgZm9yIHNjYXR0ZXIgcGxvdFxuXHRcdFx0dmFyIGRlZmF1bHRQZXJpb2QgPSAoIEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10eXBlXCIgKSA9PT0gXCIyXCIgKT8gXCJzaW5nbGVcIjogXCJhbGxcIixcblx0XHRcdFx0ZGVmYXVsdE1vZGUgPSAoIEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10eXBlXCIgKSA9PT0gXCIyXCIgKT8gXCJzcGVjaWZpY1wiOiBcImNsb3Nlc3RcIixcblx0XHRcdFx0ZGVmYXVsdFRhcmdldFllYXIgPSAyMDAwLFxuXHRcdFx0XHRkZWZhdWx0TWF4QWdlID0gNSxcblx0XHRcdFx0ZGVmYXVsdFRvbGVyYW5jZSA9IDU7XG5cblx0XHRcdHZhciAkbGkgPSAkKCBcIjxsaSBjbGFzcz0ndmFyaWFibGUtbGFiZWwgZGQtaXRlbScgZGF0YS11bml0PSdcIiArIG1vZGVsLmdldCggXCJ1bml0XCIgKSArIFwiJyBkYXRhLXBlcmlvZD0nXCIgKyBkZWZhdWx0UGVyaW9kICsgXCInIGRhdGEtdG9sZXJhbmNlPSdcIiArIGRlZmF1bHRUb2xlcmFuY2UgKyBcIicgZGF0YS1tYXhpbXVtLWFnZT0nXCIgKyBkZWZhdWx0TWF4QWdlICsgXCInIGRhdGEtbW9kZT0nXCIgKyBkZWZhdWx0TW9kZSArIFwiJyBkYXRhLXRhcmdldC15ZWFyPSdcIiArIGRlZmF1bHRUYXJnZXRZZWFyICsgXCInIGRhdGEtdmFyaWFibGUtaWQ9J1wiICsgbW9kZWwuZ2V0KCBcImlkXCIgKSArIFwiJz48ZGl2IGNsYXNzPSdkZC1oYW5kbGUnPjxkaXYgY2xhc3M9J2RkLWlubmVyLWhhbmRsZSc+PHNwYW4gY2xhc3M9J3ZhcmlhYmxlLWxhYmVsLW5hbWUnPlwiICsgbW9kZWwuZ2V0KCBcIm5hbWVcIiApICsgXCI8L3NwYW4+PHNwYW4gY2xhc3M9J3ZhcmlhYmxlLWxhYmVsLWlucHV0Jz48aW5wdXQgY2xhc3M9J2Zvcm0tY29udHJvbCcvPjxpIGNsYXNzPSdmYSBmYS1jaGVjayc+PC9pPjxpIGNsYXNzPSdmYSBmYS10aW1lcyc+PC9pPjwvZGl2PjwvZGl2PjxhIGhyZWY9JycgY2xhc3M9J3ZhcmlhYmxlLXNldHRpbmctYnRuJz48c3BhbiBjbGFzcz0nZmEgcGVyaW9kLWljb24nPjwvc3Bhbj48c3BhbiBjbGFzcz0nbnVtYmVyLWljb24nPjwvc3Bhbj48c3BhbiBjbGFzcz0nZmEgZmEtY29nJyB0aXRsZT0nU2V0dGluZyB2YXJpYWJsZSc+PC9zcGFuPjwvYT48c3BhbiBjbGFzcz0nZmEgZmEtY2xvc2UnPjwvc3Bhbj48L2xpPlwiICksXG5cdFx0XHRcdCRzZXR0aW5ncyA9ICRsaS5maW5kKCBcIi52YXJpYWJsZS1zZXR0aW5nLWJ0blwiICk7XG5cdFx0XHR0aGlzLiRkZExpc3QuYXBwZW5kKCAkbGkgKTtcblx0XHRcdFxuXHRcdFx0JHNldHRpbmdzLm9uKCBcImNsaWNrXCIsICQucHJveHkoIHRoaXMub25TZXR0aW5nc0NsaWNrLCB0aGlzICkgKTtcblx0XHRcdFxuXHRcdFx0dmFyICR2YXJpYWJsZUxhYmVsTmFtZSA9ICRsaS5maW5kKCBcIi52YXJpYWJsZS1sYWJlbC1uYW1lXCIgKSxcblx0XHRcdFx0JHZhcmlhYmxlTGFiZWxJbnB1dCA9ICRsaS5maW5kKCBcIi52YXJpYWJsZS1sYWJlbC1pbnB1dCBpbnB1dFwiICksXG5cdFx0XHRcdCRjb25maXJtTmFtZUJ0biA9ICRsaS5maW5kKCBcIi5mYS1jaGVja1wiICksXG5cdFx0XHRcdCRjYW5jZWxOYW1lQnRuID0gJGxpLmZpbmQoIFwiLmZhLXRpbWVzXCIgKTtcblxuXHRcdFx0JHZhcmlhYmxlTGFiZWxOYW1lLm9uKCBcIm1vdXNlZG93blwiLCAkLnByb3h5KCB0aGlzLm9uVmFyaWFibGVOYW1lQ2xpY2ssIHRoaXMgKSApO1xuXHRcdFx0JGNvbmZpcm1OYW1lQnRuLm9uKCBcIm1vdXNlZG93blwiLCAkLnByb3h5KCB0aGlzLm9uTmFtZUJ0bkNsaWNrLCB0aGlzICkgKTtcblx0XHRcdCRjYW5jZWxOYW1lQnRuLm9uKCBcIm1vdXNlZG93blwiLCAkLnByb3h5KCB0aGlzLm9uTmFtZUJ0bkNsaWNrLCB0aGlzICkgKTtcblx0XHRcdCR2YXJpYWJsZUxhYmVsSW5wdXQub24oIFwibW91c2Vkb3duXCIsICQucHJveHkoIHRoaXMub25MYWJlbElucHV0LCB0aGlzICkgKTtcblxuXHRcdFx0dGhpcy5yZWZyZXNoSGFuZGxlcnMoKTtcblx0XHRcdHRoaXMudXBkYXRlVmFySWNvbnMoKTtcblxuXHRcdH0sXG5cblx0XHRvblJlbW92ZUJ0bkNsaWNrOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdHZhciAkYnRuID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKSxcblx0XHRcdFx0JGxhYmVsID0gJGJ0bi5wYXJlbnRzKCBcIi52YXJpYWJsZS1sYWJlbFwiICksXG5cdFx0XHRcdHZhcmlhYmxlSWQgPSAkbGFiZWwuYXR0ciggXCJkYXRhLXZhcmlhYmxlLWlkXCIgKTtcblx0XHRcdEFwcC5DaGFydFZhcmlhYmxlc0NvbGxlY3Rpb24ucmVtb3ZlKCB2YXJpYWJsZUlkICk7XG5cblx0XHR9LFxuXG5cdFx0b25WYXJpYWJsZUxhYmVsTW92ZWQ6IGZ1bmN0aW9uKCApIHtcblxuXHRcdFx0Ly9jaGVjayBpZiB0aGVyZSdzIGFueSB2YXJpYWJsZSBsYWJlbCBsZWZ0LCBpZiBub3QgaW5zZXJ0IGVtcHR5IGRkIHBsYWNlaG9sZGVyXG5cdFx0XHRpZiggIXRoaXMuJGVsLmZpbmQoIFwiLnZhcmlhYmxlLWxhYmVsXCIgKS5sZW5ndGggKSB7XG5cdFx0XHRcdHRoaXMuJGVsLmZpbmQoIFwiLmRkLWxpc3RcIiApLnJlcGxhY2VXaXRoKCBcIjxkaXYgY2xhc3M9J2RkLWVtcHR5Jz48L2Rpdj5cIiApO1xuXHRcdFx0fVxuXG5cdFx0fSxcblxuXHRcdG9uU2V0dGluZ3NDbGljazogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0ZXZ0LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuXHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cblx0XHRcdHZhciAkYnRuID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKSxcblx0XHRcdFx0JHBhcmVudCA9ICRidG4ucGFyZW50KCk7XG5cdFx0XHRcdFxuXHRcdFx0dGhpcy5zZXR0aW5nc1ZhclBvcHVwLnNob3coICRwYXJlbnQgKTtcblxuXHRcdH0sXG5cblx0XHRvbkRpbWVuc2lvblNldHRpbmdVcGRhdGU6IGZ1bmN0aW9uKCBkYXRhICkge1xuXG5cdFx0XHQvL2ZpbmQgdXBkYXRlZCB2YXJpYWJsZVxuXHRcdFx0dmFyICR2YXJpYWJsZUxhYmVsID0gJCggXCIudmFyaWFibGUtbGFiZWxbZGF0YS12YXJpYWJsZS1pZD0nXCIgKyBkYXRhLnZhcmlhYmxlSWQgKyBcIiddXCIgKTtcblx0XHRcdC8vdXBkYXRlIGFsbCBhdHRyaWJ1dGVzXG5cdFx0XHRmb3IoIHZhciBpIGluIGRhdGEgKSB7XG5cdFx0XHRcdGlmKCBkYXRhLmhhc093blByb3BlcnR5KCBpICkgJiYgaSAhPT0gXCJ2YXJpYWJsZUlkXCIgKSB7XG5cdFx0XHRcdFx0dmFyIGF0dHJOYW1lID0gXCJkYXRhLVwiICsgaSxcblx0XHRcdFx0XHRcdGF0dHJWYWx1ZSA9IGRhdGFbIGkgXTtcblx0XHRcdFx0XHQkdmFyaWFibGVMYWJlbC5hdHRyKCBhdHRyTmFtZSwgYXR0clZhbHVlICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly9pZiBzeW5jIHBlcmlvZCB2YWx1ZXMgZm9yIGFsbCB2YXJpYWJsZXMgXG5cdFx0XHR2YXIgJHZhcmlhYmxlTGFiZWxzID0gJCggXCIudmFyaWFibGUtbGFiZWxcIiApO1xuXHRcdFx0JHZhcmlhYmxlTGFiZWxzLmF0dHIoIFwiZGF0YS1wZXJpb2RcIiwgZGF0YS5wZXJpb2QgKTtcblxuXHRcdFx0dGhpcy51cGRhdGVWYXJJY29ucygpO1xuXG5cdFx0XHQvL2hpZGUgcG9wdXBcblx0XHRcdHRoaXMuc2V0dGluZ3NWYXJQb3B1cC5oaWRlKCk7XG5cblx0XHRcdC8vdHJpZ2dlciB1cGRhdGluZyBtb2RlbFxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyLnRyaWdnZXIoIFwiZGltZW5zaW9uLXVwZGF0ZVwiICk7XG5cblx0XHR9LFxuXG5cdFx0dXBkYXRlVmFySWNvbnM6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XG5cdFx0XHR2YXIgJHZhcmlhYmxlTGFiZWxzID0gJCggXCIudmFyaWFibGUtbGFiZWxcIiApO1xuXG5cdFx0XHQvL3VwZGF0ZSBpY29uc1xuXHRcdFx0JC5lYWNoKCAkdmFyaWFibGVMYWJlbHMsIGZ1bmN0aW9uKCBpLCB2ICkge1xuXG5cdFx0XHRcdHZhciAkbGFiZWwgPSAkKCB2ICksXG5cdFx0XHRcdFx0JHBlcmlvZEljb24gPSAkbGFiZWwuZmluZCggXCIucGVyaW9kLWljb25cIiApLFxuXHRcdFx0XHRcdCRtb2RlSWNvbiA9ICRsYWJlbC5maW5kKCBcIi5tb2RlLWljb25cIiApLFxuXHRcdFx0XHRcdCRudW1iZXJJY29uID0gJGxhYmVsLmZpbmQoIFwiLm51bWJlci1pY29uXCIgKTtcblxuXHRcdFx0XHQvL21vZGVcblx0XHRcdFx0dmFyIHBlcmlvZCA9ICRsYWJlbC5hdHRyKCBcImRhdGEtcGVyaW9kXCIgKSxcblx0XHRcdFx0XHRtb2RlID0gJGxhYmVsLmF0dHIoIFwiZGF0YS1tb2RlXCIgKTtcblx0XHRcdFx0aWYoIHBlcmlvZCA9PT0gXCJhbGxcIiApIHtcblx0XHRcdFx0XHQkcGVyaW9kSWNvbi5hZGRDbGFzcyggXCJmYS1hcnJvd3MtaFwiICk7XG5cdFx0XHRcdFx0JHBlcmlvZEljb24ucmVtb3ZlQ2xhc3MoIFwiZmEtY2lyY2xlXCIgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQkcGVyaW9kSWNvbi5yZW1vdmVDbGFzcyggXCJmYS1hcnJvd3MtaFwiICk7XG5cdFx0XHRcdFx0JHBlcmlvZEljb24uYWRkQ2xhc3MoIFwiZmEtY2lyY2xlXCIgKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmKCBwZXJpb2QgPT09IFwic2luZ2xlXCIgJiYgbW9kZSA9PT0gXCJzcGVjaWZpY1wiICkge1xuXHRcdFx0XHRcdCRudW1iZXJJY29uLmh0bWwoICRsYWJlbC5hdHRyKCBcImRhdGEtdGFyZ2V0LXllYXJcIiApICsgXCIvXCIgKyAkbGFiZWwuYXR0ciggXCJkYXRhLXRvbGVyYW5jZVwiICkgKTtcblx0XHRcdFx0fSBlbHNlIGlmKCBwZXJpb2QgPT0gXCJzaW5nbGVcIiAmJiBtb2RlID09PSBcImxhdGVzdFwiICkge1xuXHRcdFx0XHRcdCRudW1iZXJJY29uLmh0bWwoIFwiPHNwYW4gY2xhc3M9J2ZhIGZhLWxvbmctYXJyb3ctcmlnaHQnPjwvc3Bhbj4vXCIgKyAkbGFiZWwuYXR0ciggXCJkYXRhLW1heGltdW0tYWdlXCIgKSApO1xuXHRcdFx0XHR9IGVsc2UgaWYoIHBlcmlvZCA9PSBcImFsbFwiICYmIG1vZGUgPT09IFwiY2xvc2VzdFwiICkge1xuXHRcdFx0XHRcdCRudW1iZXJJY29uLmh0bWwoICRsYWJlbC5hdHRyKCBcImRhdGEtdG9sZXJhbmNlXCIgKSApO1xuXHRcdFx0XHR9IGVsc2UgaWYoIHBlcmlvZCA9PSBcImFsbFwiICYmIG1vZGUgPT09IFwibGF0ZXN0XCIgKSB7XG5cdFx0XHRcdFx0JG51bWJlckljb24uaHRtbCggXCI8c3BhbiBjbGFzcz0nZmEgZmEtbG9uZy1hcnJvdy1yaWdodCc+PC9zcGFuPi9cIiArICRsYWJlbC5hdHRyKCBcImRhdGEtbWF4aW11bS1hZ2VcIiApICk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvKiRwZXJpb2RJY29uLnRleHQoICRsYWJlbC5hdHRyKCBcImRhdGEtcGVyaW9kXCIgKSApO1xuXHRcdFx0XHQkbW9kZUljb24udGV4dCggJGxhYmVsLmF0dHIoIFwiZGF0YS1tb2RlXCIgKSApO1xuXHRcdFx0XHQkbnVtYmVySWNvbi50ZXh0KCAkbGFiZWwuYXR0ciggXCJkYXRhLXRhcmdldC15ZWFyXCIgKSApOyovXG5cblx0XHRcdH0gKTtcblxuXHRcdH0sXG5cblx0XHRvblZhcmlhYmxlTmFtZUNsaWNrOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHR2YXIgJG5hbWUgPSAkKCBldnQuY3VycmVudFRhcmdldCApLFxuXHRcdFx0XHQkcGFyZW50ID0gJG5hbWUucGFyZW50KCksXG5cdFx0XHRcdCR2YXJpYWJsZUxhYmVsSW5wdXQgPSAkcGFyZW50LmZpbmQoIFwiLnZhcmlhYmxlLWxhYmVsLWlucHV0XCIgKSxcblx0XHRcdFx0JGlucHV0ID0gJHZhcmlhYmxlTGFiZWxJbnB1dC5maW5kKCBcImlucHV0XCIgKSxcblx0XHRcdFx0JGNvZyA9ICRwYXJlbnQucGFyZW50KCkucGFyZW50KCkuZmluZCggXCIudmFyaWFibGUtc2V0dGluZy1idG5cIiApO1xuXHRcdFx0XG5cdFx0XHQvL21ha2Ugc3VyZSB2YXJpYWJsZSBpcyBpbiBkaW1lbnNpb24gc2VjdGlvblxuXHRcdFx0aWYoICRwYXJlbnQucGFyZW50cyggXCIuZGltZW5zaW9ucy1zZWN0aW9uXCIgKS5sZW5ndGggKSB7XG5cblx0XHRcdFx0Ly9zdG9wcGluZyBwcm9wYWdhdGlvbiBub3QgYXQgdGhlIHRvcCwgYnV0IGhlcmUsIHRvIGVuYWJsZSBkcmFnJmRyb3Agb3V0c2lkZSBvZiBkaW1lbnNpb24gc2VjdGlvblxuXHRcdFx0XHRldnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG5cdFx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXG5cdFx0XHRcdCRjb2cuYWRkQ2xhc3MoIFwiaGlkZGVuXCIgKTtcblx0XHRcdFx0JG5hbWUuaGlkZSgpO1xuXHRcdFx0XHQkdmFyaWFibGVMYWJlbElucHV0LnNob3coKTtcblx0XHRcdFx0JGlucHV0LnZhbCggJG5hbWUudGV4dCgpICk7XG5cdFx0XHR9XG5cblx0XHR9LFxuXG5cdFx0b25OYW1lQnRuQ2xpY2s6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdGV2dC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcblx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXG5cdFx0XHR2YXIgJGlucHV0QnRuID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKSxcblx0XHRcdFx0JHZhcmlhYmxlTGFiZWxJbnB1dCA9ICRpbnB1dEJ0bi5wYXJlbnQoKSxcblx0XHRcdFx0JHBhcmVudCA9ICR2YXJpYWJsZUxhYmVsSW5wdXQucGFyZW50KCksXG5cdFx0XHRcdCR2YXJpYWJsZUxhYmVsTmFtZSA9ICRwYXJlbnQuZmluZCggXCIudmFyaWFibGUtbGFiZWwtbmFtZVwiICksXG5cdFx0XHRcdCRjb2cgPSAkcGFyZW50LnBhcmVudCgpLnBhcmVudCgpLmZpbmQoIFwiLnZhcmlhYmxlLXNldHRpbmctYnRuXCIgKTtcblx0XHRcdFxuXHRcdFx0JGNvZy5yZW1vdmVDbGFzcyggXCJoaWRkZW5cIiApO1xuIFxuXHRcdFx0aWYoICRpbnB1dEJ0bi5oYXNDbGFzcyggXCJmYS1jaGVja1wiICkgKSB7XG5cdFx0XHRcdC8vY29uZmlybWF0aW9uIG9mIGNoYW5nZSB0byB2YXJpYWJsZSBuYW1lXG5cdFx0XHRcdHZhciAkaW5wdXQgPSAkdmFyaWFibGVMYWJlbElucHV0LmZpbmQoIFwiaW5wdXRcIiApLFxuXHRcdFx0XHRcdGlucHV0VmFsID0gJGlucHV0LnZhbCgpLFxuXHRcdFx0XHRcdCR2YXJpYWJsZUxhYmVsID0gJHZhcmlhYmxlTGFiZWxJbnB1dC5wYXJlbnRzKCBcIi52YXJpYWJsZS1sYWJlbFwiICk7XG5cdFx0XHRcdCR2YXJpYWJsZUxhYmVsTmFtZS50ZXh0KCBpbnB1dFZhbCApO1xuXHRcdFx0XHQkdmFyaWFibGVMYWJlbC5hdHRyKCBcImRhdGEtZGlzcGxheS1uYW1lXCIsIGlucHV0VmFsICk7XG5cdFx0XHRcdHRoaXMuZGlzcGF0Y2hlci50cmlnZ2VyKCBcImRpbWVuc2lvbi11cGRhdGVcIiApO1xuXHRcdFx0fVxuXG5cdFx0XHQkdmFyaWFibGVMYWJlbElucHV0LmhpZGUoKTtcblx0XHRcdCR2YXJpYWJsZUxhYmVsTmFtZS5zaG93KCk7XG5cblx0XHR9LFxuXG5cdFx0b25MYWJlbElucHV0OiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHRldnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG5cdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcblxuXHRcdFx0dmFyICRpbnB1dCA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICk7XG5cdFx0XHQkaW5wdXQuZm9jdXMoKTtcblxuXHRcdH0sXG5cblx0XHRvblZhcmlhYmxlUmVtb3ZlOiBmdW5jdGlvbiggbW9kZWwgKSB7XG5cdFx0XHR2YXIgJGxpVG9SZW1vdmUgPSAkKCBcIi52YXJpYWJsZS1sYWJlbFtkYXRhLXZhcmlhYmxlLWlkPSdcIiArIG1vZGVsLmdldCggXCJpZFwiICkgKyBcIiddXCIgKTtcblx0XHRcdCRsaVRvUmVtb3ZlLnJlbW92ZSgpO1xuXHRcdH1cblxuXHR9KTtcblx0XG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkZvcm0uQWRkRGF0YVNlY3Rpb25WaWV3O1xuXHRcbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFxuXHRcInVzZSBzdHJpY3RcIjtcblx0XG5cdHZhciBBcHAgPSByZXF1aXJlKCBcIi4vLi4vLi4vLi4vbmFtZXNwYWNlcy5qc1wiICk7XG5cblx0QXBwLlZpZXdzLkZvcm0uRGltZW5zaW9uc1NlY3Rpb25WaWV3ID0gQmFja2JvbmUuVmlldy5leHRlbmQoe1xuXG5cdFx0ZWw6IFwiI2Zvcm0tdmlldyAjZGF0YS10YWIgLmRpbWVuc2lvbnMtc2VjdGlvblwiLFxuXHRcdGV2ZW50czoge1xuXHRcdFx0XCJjaGFuZ2UgW25hbWU9J2NoYXJ0LXR5cGUnXVwiOiBcIm9uQ2hhcnRUeXBlQ2hhbmdlXCIsXG5cdFx0XHRcImNoYW5nZSBbbmFtZT0nZ3JvdXAtYnktdmFyaWFibGUnXVwiOiBcIm9uR3JvdXBCeVZhcmlhYmxlQ2hhbmdlXCIsXG5cdFx0fSxcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0XG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIgPSBvcHRpb25zLmRpc3BhdGNoZXI7XG5cdFx0XHRBcHAuQ2hhcnREaW1lbnNpb25zTW9kZWwub24oIFwicmVzZXQgY2hhbmdlXCIsIHRoaXMucmVuZGVyLCB0aGlzICk7XG5cblx0XHRcdHRoaXMuZGlzcGF0Y2hlci5vbiggXCJkaW1lbnNpb24tdXBkYXRlXCIsIHRoaXMub25EaW1lbnNpb25VcGRhdGUsIHRoaXMgKTtcblx0XHRcdFxuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblxuXHRcdH0sXG5cblx0XHRpbml0ZWQ6IGZhbHNlLFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblxuXHRcdFx0dGhpcy4kZm9ybVNlY3Rpb25Db250ZW50ID0gdGhpcy4kZWwuZmluZCggXCIuZm9ybS1zZWN0aW9uLWNvbnRlbnRcIiApO1xuXHRcdFx0dGhpcy4kZGltZW5zaW9uc0lucHV0ID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT0nY2hhcnQtZGltZW5zaW9ucyddXCIgKTtcblx0XHRcdHRoaXMuJGdyb3VwQnlWYXJpYWJsZSA9IHRoaXMuJGVsLmZpbmQoIFwiLmdyb3VwLWJ5LXZhcmlhYmxlLXdyYXBwZXJcIiApO1xuXHRcdFx0dGhpcy4kZ3JvdXBCeVZhcmlhYmxlSW5wdXQgPSB0aGlzLiRncm91cEJ5VmFyaWFibGUuZmluZCggXCJbbmFtZT0nZ3JvdXAtYnktdmFyaWFibGUnXVwiICk7XG5cblx0XHRcdC8vZ2V0IHJpZCBvZiBvbGQgY29udGVudFxuXHRcdFx0dGhpcy4kZm9ybVNlY3Rpb25Db250ZW50LmVtcHR5KCk7XG5cblx0XHRcdC8vY29uc3RydWN0IGh0bWxcblx0XHRcdHZhciBjaGFydFR5cGUgPSBBcHAuQ2hhcnREaW1lbnNpb25zTW9kZWwuaWQsXG5cdFx0XHRcdGRpbWVuc2lvbnMgPSBBcHAuQ2hhcnREaW1lbnNpb25zTW9kZWwuZ2V0KCBcImNoYXJ0RGltZW5zaW9uc1wiICksXG5cdFx0XHRcdGh0bWxTdHJpbmcgPSBcIjxvbCBjbGFzcz0nZGltZW5zaW9ucy1saXN0IGNoYXJ0LXR5cGUtXCIgKyBjaGFydFR5cGUgKyBcIic+XCI7XG5cblx0XHRcdF8uZWFjaCggZGltZW5zaW9ucywgZnVuY3Rpb24oIHYsIGsgKSB7XG5cdFx0XHRcdGh0bWxTdHJpbmcgKz0gXCI8bGkgZGF0YS1wcm9wZXJ0eT0nXCIgKyB2LnByb3BlcnR5ICsgXCInIGNsYXNzPSdkaW1lbnNpb24tYm94Jz48aDQ+XCIgKyB2Lm5hbWUgKyBcIjwvaDQ+PGRpdiBjbGFzcz0nZGQtd3JhcHBlcic+PGRpdiBjbGFzcz0nZGQnPjxkaXYgY2xhc3M9J2RkLWVtcHR5Jz48L2Rpdj48L2Rpdj48L2Rpdj48L2xpPlwiO1xuXHRcdFx0fSApO1xuXG5cdFx0XHRodG1sU3RyaW5nICs9IFwiPC9vbD5cIjtcblxuXHRcdFx0dmFyICRodG1sID0gJCggaHRtbFN0cmluZyApO1xuXHRcdFx0dGhpcy4kZm9ybVNlY3Rpb25Db250ZW50LmFwcGVuZCggJGh0bWwgKTtcblxuXHRcdFx0Ly9pbml0IG5lc3RhYmxlIFxuXHRcdFx0dGhpcy4kZGQgPSB0aGlzLiRlbC5maW5kKCBcIi5kZFwiICk7XG5cdFx0XHQvL25lc3RhYmxlIGRlc3Ryb3lcblx0XHRcdHRoaXMuJGRkLm5lc3RhYmxlKCk7XG5cdFx0XHRcdFx0XHRcblx0XHRcdC8vZmV0Y2ggcmVtYWluZyBkb21cblx0XHRcdHRoaXMuJGRpbWVuc2lvbkJveGVzID0gdGhpcy4kZWwuZmluZCggXCIuZGltZW5zaW9uLWJveFwiICk7XG5cblx0XHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRcdHRoaXMuJGRkLm9uKCdjaGFuZ2UnLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0dGhhdC51cGRhdGVJbnB1dCgpO1xuXHRcdFx0fSk7XG5cblx0XHRcdC8vaWYgZWRpdGluZyBjaGFydCAtIGFzc2lnbiBwb3NzaWJsZSBjaGFydCBkaW1lbnNpb25zIHRvIGF2YWlsYWJsZSBkaW1lbnNpb25zXG5cdFx0XHR2YXIgY2hhcnREaW1lbnNpb25zID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LWRpbWVuc2lvbnNcIiApO1xuXHRcdFx0dGhpcy5zZXRJbnB1dHMoIGNoYXJ0RGltZW5zaW9ucyApO1xuXG5cdFx0XHQvL2hhbmRsZSBncm91cCBieSB2YXJpYWJsZSBjaGVja2JveFxuXHRcdFx0aWYoIEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10eXBlXCIgKSA9PSAxIHx8IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10eXBlXCIgKSA9PSAzICkge1xuXHRcdFx0XHQvL2lzIGxpbmVjaGFydCwgc28gdGhpcyBjaGVja2JveCBpcyByZWxldmFudFxuXHRcdFx0XHR2YXIgZ3JvdXBCeVZhcmlhYmxlcyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJncm91cC1ieS12YXJpYWJsZXNcIiApO1xuXHRcdFx0XHR0aGlzLiRncm91cEJ5VmFyaWFibGVJbnB1dC5wcm9wKCBcImNoZWNrZWRcIiwgZ3JvdXBCeVZhcmlhYmxlcyApO1xuXHRcdFx0XHR0aGlzLiRncm91cEJ5VmFyaWFibGUuc2hvdygpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly9pcyBub3QgbGluZWNoYXJ0LCBtYWtlIHN1cmUgZ3JvdXBpbmcgb2YgdmFyaWFibGVzIGlzIG9mZiBhbmQgaGlkZSBpbnB1dFxuXHRcdFx0XHRBcHAuQ2hhcnRNb2RlbC5zZXQoIFwiZ3JvdXAtYnktdmFyaWFibGVzXCIsIGZhbHNlICk7XG5cdFx0XHRcdHRoaXMuJGdyb3VwQnlWYXJpYWJsZS5oaWRlKCk7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdC8vaWYgc2NhdHRlciBwbG90LCBvbmx5IGVudGl0eSBtYXRjaFxuXHRcdFx0Lyp2YXIgJG9ubHlFbnRpdHlNYXRjaENoZWNrID0gJCggXCI8ZGl2IGNsYXNzPSdvbmx5LWVudGl0eS1jaGVjay13cmFwcGVyJz48bGFiZWw+PGlucHV0IHR5cGU9J2NoZWNrYm94JyBuYW1lPSdvbmx5LWVudGl0eS1jaGVjaycgLz5NYXRjaCB2YXJpYWJsZXMgb25seSBieSBjb3VudHJpZXMsIG5vdCB5ZWFycy48L2xhYmVsPjwvZGl2PlwiICksXG5cdFx0XHRcdCRvbmx5RW50aXR5SW5wdXQgPSAkb25seUVudGl0eU1hdGNoQ2hlY2suZmluZCggXCJpbnB1dFwiICk7XG5cdFx0XHQkb25seUVudGl0eUlucHV0Lm9uKCBcImNoYW5nZVwiLCBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0XHR2YXIgJHRoaXMgPSAkKCB0aGlzICk7XG5cdFx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJvbmx5LWVudGl0eS1tYXRjaFwiLCAkdGhpcy5wcm9wKCBcImNoZWNrZWRcIiApICk7XG5cdFx0XHR9ICk7XG5cdFx0XHQvL3NldCBkZWZhdWx0IHZhbHVlXG5cdFx0XHQkb25seUVudGl0eUlucHV0LnByb3AoIFwiY2hlY2tlZFwiLCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwib25seS1lbnRpdHktbWF0Y2hcIiApICk7XG5cdFx0XHR0aGlzLiRmb3JtU2VjdGlvbkNvbnRlbnQuYXBwZW5kKCAkb25seUVudGl0eU1hdGNoQ2hlY2sgKTsqL1xuXHRcdFx0XG5cdFx0fSxcblxuXHRcdHVwZGF0ZUlucHV0OiBmdW5jdGlvbigpIHtcblx0XHRcdFxuXHRcdFx0dmFyIGRpbWVuc2lvbnMgPSBbXTtcblx0XHRcdCQuZWFjaCggdGhpcy4kZGltZW5zaW9uQm94ZXMsIGZ1bmN0aW9uKCBpLCB2ICkge1xuXHRcdFx0XHR2YXIgJGJveCA9ICQoIHYgKSxcblx0XHRcdFx0XHQkZHJvcHBlZFZhcmlhYmxlcyA9ICRib3guZmluZCggXCIudmFyaWFibGUtbGFiZWxcIiApO1xuXHRcdFx0XHRpZiggJGRyb3BwZWRWYXJpYWJsZXMubGVuZ3RoICkge1xuXHRcdFx0XHRcdC8vanVzdCBpbiBjYXNlIHRoZXJlIHdlcmUgbW9yZSB2YXJpYWJsZXNcblx0XHRcdFx0XHQkLmVhY2goICRkcm9wcGVkVmFyaWFibGVzLCBmdW5jdGlvbiggaSwgdiApIHtcblx0XHRcdFx0XHRcdHZhciAkZHJvcHBlZFZhcmlhYmxlID0gJCggdiApLFxuXHRcdFx0XHRcdFx0XHRkaW1lbnNpb24gPSB7IHZhcmlhYmxlSWQ6ICRkcm9wcGVkVmFyaWFibGUuYXR0ciggXCJkYXRhLXZhcmlhYmxlLWlkXCIgKSwgZGlzcGxheU5hbWU6ICRkcm9wcGVkVmFyaWFibGUuYXR0ciggXCJkYXRhLWRpc3BsYXktbmFtZVwiICksIHByb3BlcnR5OiAkYm94LmF0dHIoIFwiZGF0YS1wcm9wZXJ0eVwiICksIHVuaXQ6ICRkcm9wcGVkVmFyaWFibGUuYXR0ciggXCJkYXRhLXVuaXRcIiApLCBuYW1lOiAkYm94LmZpbmQoIFwiaDRcIiApLnRleHQoKSwgcGVyaW9kOiAkZHJvcHBlZFZhcmlhYmxlLmF0dHIoIFwiZGF0YS1wZXJpb2RcIiApLCBtb2RlOiAkZHJvcHBlZFZhcmlhYmxlLmF0dHIoIFwiZGF0YS1tb2RlXCIgKSwgdGFyZ2V0WWVhcjogJGRyb3BwZWRWYXJpYWJsZS5hdHRyKCBcImRhdGEtdGFyZ2V0LXllYXJcIiApLCB0b2xlcmFuY2U6ICRkcm9wcGVkVmFyaWFibGUuYXR0ciggXCJkYXRhLXRvbGVyYW5jZVwiICksIG1heGltdW1BZ2U6ICRkcm9wcGVkVmFyaWFibGUuYXR0ciggXCJkYXRhLW1heGltdW0tYWdlXCIgKSB9O1xuXHRcdFx0XHRcdFx0ZGltZW5zaW9ucy5wdXNoKCBkaW1lbnNpb24gKTtcblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblxuXHRcdFx0dmFyIGpzb24gPSBKU09OLnN0cmluZ2lmeSggZGltZW5zaW9ucyApO1xuXHRcdFx0dGhpcy4kZGltZW5zaW9uc0lucHV0LnZhbCgganNvbiApO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0KCBcImNoYXJ0LWRpbWVuc2lvbnNcIiwganNvbiApO1xuXG5cdFx0fSxcblxuXHRcdHNldElucHV0czogZnVuY3Rpb24oIGNoYXJ0RGltZW5zaW9ucyApIHtcblxuXHRcdFx0aWYoICFjaGFydERpbWVuc2lvbnMgfHwgIWNoYXJ0RGltZW5zaW9ucy5sZW5ndGggKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Ly9jb252ZXJ0IHRvIGpzb25cblx0XHRcdGNoYXJ0RGltZW5zaW9ucyA9ICQucGFyc2VKU09OKCBjaGFydERpbWVuc2lvbnMgKTtcblxuXHRcdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdFx0Xy5lYWNoKCBjaGFydERpbWVuc2lvbnMsIGZ1bmN0aW9uKCBjaGFydERpbWVuc2lvbiwgaSApIHtcblxuXHRcdFx0XHQvL2ZpbmQgdmFyaWFibGUgbGFiZWwgYm94IGZyb20gYXZhaWxhYmxlIHZhcmlhYmxlc1xuXHRcdFx0XHR2YXIgJHZhcmlhYmxlTGFiZWwgPSAkKCBcIi52YXJpYWJsZS1sYWJlbFtkYXRhLXZhcmlhYmxlLWlkPVwiICsgY2hhcnREaW1lbnNpb24udmFyaWFibGVJZCArIFwiXVwiICk7XG5cblx0XHRcdFx0Ly9jb3B5IHZhcmlhYmxlcyBhdHRyaWJ1dGVzXG5cdFx0XHRcdGlmKCBjaGFydERpbWVuc2lvbi5wZXJpb2QgKSB7XG5cdFx0XHRcdFx0JHZhcmlhYmxlTGFiZWwuYXR0ciggXCJkYXRhLXBlcmlvZFwiLCBjaGFydERpbWVuc2lvbi5wZXJpb2QgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiggY2hhcnREaW1lbnNpb24ubW9kZSApIHtcblx0XHRcdFx0XHQkdmFyaWFibGVMYWJlbC5hdHRyKCBcImRhdGEtbW9kZVwiLCBjaGFydERpbWVuc2lvbi5tb2RlICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYoIGNoYXJ0RGltZW5zaW9uLnRhcmdldFllYXIgKSB7XG5cdFx0XHRcdFx0JHZhcmlhYmxlTGFiZWwuYXR0ciggXCJkYXRhLXRhcmdldC15ZWFyXCIsIGNoYXJ0RGltZW5zaW9uLnRhcmdldFllYXIgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiggY2hhcnREaW1lbnNpb24udG9sZXJhbmNlICkge1xuXHRcdFx0XHRcdCR2YXJpYWJsZUxhYmVsLmF0dHIoIFwiZGF0YS10b2xlcmFuY2VcIiwgY2hhcnREaW1lbnNpb24udG9sZXJhbmNlICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYoIGNoYXJ0RGltZW5zaW9uLm1heGltdW1BZ2UgKSB7XG5cdFx0XHRcdFx0JHZhcmlhYmxlTGFiZWwuYXR0ciggXCJkYXRhLW1heGltdW0tYWdlXCIsIGNoYXJ0RGltZW5zaW9uLm1heGltdW1BZ2UgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiggY2hhcnREaW1lbnNpb24uZGlzcGxheU5hbWUgKSB7XG5cdFx0XHRcdFx0JHZhcmlhYmxlTGFiZWwuZmluZCggXCIudmFyaWFibGUtbGFiZWwtbmFtZVwiICkudGV4dCggY2hhcnREaW1lbnNpb24uZGlzcGxheU5hbWUgKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vZmluZCBhcHByb3ByaWF0ZSBkaW1lbnNpb24gYm94IGZvciBpdCBieSBkYXRhLXByb3BlcnR5XG5cdFx0XHRcdHZhciAkZGltZW5zaW9uQm94ID0gdGhhdC4kZWwuZmluZCggXCIuZGltZW5zaW9uLWJveFtkYXRhLXByb3BlcnR5PVwiICsgY2hhcnREaW1lbnNpb24ucHJvcGVydHkgKyBcIl1cIiApO1xuXHRcdFx0XHQvL3JlbW92ZSBlbXB0eSBhbmQgYWRkIHZhcmlhYmxlIGJveFxuXHRcdFx0XHQkZGltZW5zaW9uQm94LmZpbmQoIFwiLmRkLWVtcHR5XCIgKS5yZW1vdmUoKTtcblx0XHRcdFx0dmFyICRkZExpc3QgPSAkKCBcIjxvbCBjbGFzcz0nZGQtbGlzdCc+PC9vbD5cIiApO1xuXHRcdFx0XHQkZGRMaXN0LmFwcGVuZCggJHZhcmlhYmxlTGFiZWwgKTtcblx0XHRcdFx0JGRpbWVuc2lvbkJveC5maW5kKCBcIi5kZFwiICkuYXBwZW5kKCAkZGRMaXN0ICk7XG5cdFx0XHRcdHRoYXQuZGlzcGF0Y2hlci50cmlnZ2VyKCBcInZhcmlhYmxlLWxhYmVsLW1vdmVkXCIgKTtcblxuXHRcdFx0fSApO1xuXHRcblx0XHR9LFxuXG5cdFx0b25DaGFydFR5cGVDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdHZhciAkc2VsZWN0ID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKTtcblx0XHRcdEFwcC5DaGFydERpbWVuc2lvbnNNb2RlbC5sb2FkQ29uZmlndXJhdGlvbiggJHNlbGVjdC52YWwoKSApO1xuXG5cdFx0fSxcblxuXHRcdG9uRGltZW5zaW9uVXBkYXRlOiBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMudXBkYXRlSW5wdXQoKTtcblx0XHR9LFxuXG5cdFx0b25Hcm91cEJ5VmFyaWFibGVDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdHZhciAkaW5wdXQgPSAkKCBldnQuY3VycmVudFRhcmdldCApO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0KCBcImdyb3VwLWJ5LXZhcmlhYmxlc1wiLCAkaW5wdXQuaXMoIFwiOmNoZWNrZWRcIiApICk7XG5cblx0XHR9XG5cblx0fSk7XG5cdFxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5Gb3JtLkRpbWVuc2lvbnNTZWN0aW9uVmlldztcblx0XG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIEFwcCA9IHJlcXVpcmUoIFwiLi8uLi8uLi8uLi9uYW1lc3BhY2VzLmpzXCIgKTtcblxuXHRBcHAuVmlld3MuRm9ybS5FbnRpdGllc1NlY3Rpb25WaWV3ID0gQmFja2JvbmUuVmlldy5leHRlbmQoe1xuXG5cdFx0ZWw6IFwiI2Zvcm0tdmlldyAjZGF0YS10YWIgLmVudGl0aWVzLXNlY3Rpb25cIixcblx0XHRldmVudHM6IHtcblx0XHRcdFwiY2hhbmdlIC5jb3VudHJpZXMtc2VsZWN0XCI6IFwib25Db3VudHJpZXNTZWxlY3RcIixcblx0XHRcdFwiY2hhbmdlIFtuYW1lPSdhZGQtY291bnRyeS1tb2RlJ11cIjogXCJvbkFkZENvdW50cnlNb2RlQ2hhbmdlXCJcblx0XHR9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHRcblx0XHRcdHRoaXMuZGlzcGF0Y2hlciA9IG9wdGlvbnMuZGlzcGF0Y2hlcjtcblx0XHRcdC8vQXBwLkF2YWlsYWJsZUVudGl0aWVzQ29sbGVjdGlvbi5vbiggXCJjaGFuZ2UgYWRkIHJlbW92ZSByZXNldFwiLCB0aGlzLnJlbmRlciwgdGhpcyApO1xuXHRcdFx0Ly9hdmFpbGFibGUgZW50aXRpZXMgYXJlIGNoYW5naW5nIGp1c3Qgb24gZmV0Y2ggc28gbGlzdGVuIGp1c3QgZm9yIHRoYXRcblx0XHRcdEFwcC5BdmFpbGFibGVFbnRpdGllc0NvbGxlY3Rpb24ub24oIFwicmVzZXQgZmV0Y2hlZFwiLCB0aGlzLnJlbmRlciwgdGhpcyApO1xuXHRcdFx0XG5cdFx0XHR0aGlzLiRlbnRpdGllc1NlbGVjdCA9IHRoaXMuJGVsLmZpbmQoIFwiLmNvdW50cmllcy1zZWxlY3RcIiApO1xuXHRcdFx0dGhpcy4kYWRkQ291bnRyeUNvbnRyb2xJbnB1dCA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9J2FkZC1jb3VudHJ5LWNvbnRyb2wnXVwiICk7XG5cblx0XHRcdHRoaXMucmVuZGVyKCk7XG5cblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblxuXHRcdFx0dmFyICRlbnRpdGllc1NlbGVjdCA9IHRoaXMuJGVudGl0aWVzU2VsZWN0O1xuXHRcdFx0JGVudGl0aWVzU2VsZWN0LmVtcHR5KCk7XG5cdFx0XHRcblx0XHRcdC8vYXBwZW5kIGRlZmF1bHQgXG5cdFx0XHQkZW50aXRpZXNTZWxlY3QuYXBwZW5kKCAkKCBcIjxvcHRpb24gc2VsZWN0ZWQgZGlzYWJsZWQ+U2VsZWN0IGVudGl0eTwvb3B0aW9uPlwiICkgKTtcblxuXHRcdFx0QXBwLkF2YWlsYWJsZUVudGl0aWVzQ29sbGVjdGlvbi5lYWNoKCBmdW5jdGlvbiggbW9kZWwgKSB7XG5cdFx0XHRcdCRlbnRpdGllc1NlbGVjdC5hcHBlbmQoICQoIFwiPG9wdGlvbiB2YWx1ZT0nXCIgKyBtb2RlbC5nZXQoIFwiaWRcIiApICsgXCInPlwiICsgbW9kZWwuZ2V0KCBcIm5hbWVcIiApICsgXCI8L29wdGlvbj5cIiApICk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dmFyIGFkZENvdW50cnlDb250cm9sID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImFkZC1jb3VudHJ5LWNvbnRyb2xcIiApO1xuXHRcdFx0dGhpcy4kYWRkQ291bnRyeUNvbnRyb2xJbnB1dC5wcm9wKCBcImNoZWNrZWRcIiwgYWRkQ291bnRyeUNvbnRyb2wgKTtcblxuXHRcdFx0Ly9iYXNlZCBvbiBzdG9yZWQgYWRkLWNvdW50cnktbW9kZVxuXHRcdFx0dmFyIGFkZENvdW50cnlNb2RlID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImFkZC1jb3VudHJ5LW1vZGVcIiApO1xuXHRcdFx0dGhpcy4kZWwuZmluZCggXCJbbmFtZT0nYWRkLWNvdW50cnktbW9kZSddXCIgKS5maWx0ZXIoIFwiW3ZhbHVlPSdcIiArIGFkZENvdW50cnlNb2RlICsgXCInXVwiICkucHJvcCggXCJjaGVja2VkXCIsIHRydWUgKTtcblxuXHRcdH0sXG5cblx0XHRvbkNvdW50cmllc1NlbGVjdDogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dmFyICRzZWxlY3QgPSAkKCBldnQudGFyZ2V0ICksXG5cdFx0XHRcdHZhbCA9ICRzZWxlY3QudmFsKCksXG5cdFx0XHRcdCRvcHRpb24gPSAkc2VsZWN0LmZpbmQoIFwib3B0aW9uW3ZhbHVlPVwiICsgdmFsICsgXCJdXCIgKSxcblx0XHRcdFx0dGV4dCA9ICRvcHRpb24udGV4dCgpO1xuXG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5hZGRTZWxlY3RlZENvdW50cnkoIHsgaWQ6IHZhbCwgbmFtZTogdGV4dCB9ICk7XG5cblx0XHR9LFxuXG5cdFx0b25BZGRDb3VudHJ5TW9kZUNoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dmFyICRpbnB1dCA9ICQoIFwiW25hbWU9J2FkZC1jb3VudHJ5LW1vZGUnXTpjaGVja2VkXCIgKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJhZGQtY291bnRyeS1tb2RlXCIsICRpbnB1dC52YWwoKSApO1xuXG5cdFx0fVxuXG5cblx0fSk7XG5cdFxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5Gb3JtLkVudGl0aWVzU2VjdGlvblZpZXc7XG5cbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgQXBwID0gcmVxdWlyZSggXCIuLy4uLy4uLy4uL25hbWVzcGFjZXMuanNcIiApLFxuXHRcdENvbG9yUGlja2VyID0gcmVxdWlyZSggXCIuLy4uLy4uL3VpL0FwcC5WaWV3cy5VSS5Db2xvclBpY2tlci5qc1wiICk7XG5cblx0QXBwLlZpZXdzLkZvcm0uU2VsZWN0ZWRDb3VudHJpZXNTZWN0aW9uVmlldyA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblxuXHRcdGVsOiBcIiNmb3JtLXZpZXcgI2RhdGEtdGFiIC5zZWxlY3RlZC1jb3VudHJpZXMtYm94XCIsXG5cdFx0ZXZlbnRzOiB7fSxcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0XG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIgPSBvcHRpb25zLmRpc3BhdGNoZXI7XG5cdFx0XHRcblx0XHRcdEFwcC5DaGFydE1vZGVsLm9uKCBcImNoYW5nZTpzZWxlY3RlZC1jb3VudHJpZXNcIiwgdGhpcy5yZW5kZXIsIHRoaXMgKTtcblxuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblxuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHQvL3JlbW92ZSBldmVyeXRoaW5nXG5cdFx0XHR0aGlzLiRlbC5lbXB0eSgpO1xuXG5cdFx0XHR2YXIgdGhhdCA9IHRoaXMsXG5cdFx0XHRcdHNlbGVjdGVkQ291bnRyaWVzID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcInNlbGVjdGVkLWNvdW50cmllc1wiICk7XG5cblx0XHRcdF8uZWFjaCggc2VsZWN0ZWRDb3VudHJpZXMsIGZ1bmN0aW9uKCB2LCBpICkge1xuXHRcdFx0XHR2YXIgJGxpID0gJCggXCI8bGkgY2xhc3M9J2NvdW50cnktbGFiZWwnIGRhdGEtaWQ9J1wiICsgdi5pZCArIFwiJyBkYXRhLW5hbWU9J1wiICsgdi5uYW1lICsgXCInPlwiICsgdi5uYW1lICsgXCI8c3BhbiBjbGFzcz0nZmEgZmEtcmVtb3ZlJz48L3NwYW4+PC9saT5cIiApO1xuXHRcdFx0XHR0aGF0LiRlbC5hcHBlbmQoICRsaSApO1xuXHRcdFx0XHRpZiggdi5jb2xvciApIHtcblx0XHRcdFx0XHQkbGkuY3NzKCBcImJhY2tncm91bmQtY29sb3JcIiwgdi5jb2xvciApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cblx0XHRcdHZhciAkbGlzID0gdGhpcy4kZWwuZmluZCggXCIuY291bnRyeS1sYWJlbFwiICksXG5cdFx0XHRcdCRsaXNSZW1vdmVCdG5zID0gJGxpcy5maW5kKCBcIi5mYS1yZW1vdmVcIiApLFxuXHRcdFx0XHRjb2xvclBpY2tlciA9IG51bGw7XG5cblx0XHRcdCRsaXMub24oIFwiY2xpY2tcIiwgZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcblxuXHRcdFx0XHR2YXIgJGNvdW50cnlMYWJlbCA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICk7XG5cdFx0XHRcdGlmKCBjb2xvclBpY2tlciApIHtcblx0XHRcdFx0XHRjb2xvclBpY2tlci5jbG9zZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbG9yUGlja2VyID0gbmV3IENvbG9yUGlja2VyKCAkY291bnRyeUxhYmVsICk7XG5cdFx0XHRcdGNvbG9yUGlja2VyLmluaXQoICRjb3VudHJ5TGFiZWwgKTtcblx0XHRcdFx0Y29sb3JQaWNrZXIub25TZWxlY3RlZCA9IGZ1bmN0aW9uKCB2YWx1ZSApIHtcblx0XHRcdFx0XHQkY291bnRyeUxhYmVsLmNzcyggXCJiYWNrZ3JvdW5kLWNvbG9yXCIsIHZhbHVlICk7XG5cdFx0XHRcdFx0JGNvdW50cnlMYWJlbC5hdHRyKCBcImRhdGEtY29sb3JcIiwgdmFsdWUgKTtcblx0XHRcdFx0XHRBcHAuQ2hhcnRNb2RlbC51cGRhdGVTZWxlY3RlZENvdW50cnkoICRjb3VudHJ5TGFiZWwuYXR0ciggXCJkYXRhLWlkXCIgKSwgdmFsdWUgKTtcblx0XHRcdFx0XHRjb2xvclBpY2tlci5jbG9zZSgpO1xuXHRcdFx0XHRcdC8vdGhhdC4kZWwudHJpZ2dlciggXCJjaGFuZ2VcIiApO1xuXHRcdFx0XHR9O1xuXG5cdFx0XHR9ICk7XHRcblxuXHRcdFx0JGxpc1JlbW92ZUJ0bnMub24oIFwiY2xpY2tcIiwgZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0XHRldnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG5cdFx0XHRcdFxuXHRcdFx0XHR2YXIgJHRoaXMgPSAkKCB0aGlzICksXG5cdFx0XHRcdFx0JHBhcmVudCA9ICR0aGlzLnBhcmVudCgpLFxuXHRcdFx0XHRcdGNvdW50cnlJZCA9ICRwYXJlbnQuYXR0ciggXCJkYXRhLWlkXCIgKTtcblx0XHRcdFx0QXBwLkNoYXJ0TW9kZWwucmVtb3ZlU2VsZWN0ZWRDb3VudHJ5KCBjb3VudHJ5SWQgKTtcblxuXHRcdFx0fSlcdFxuXHRcdFx0XG5cdFx0fVxuXG5cdH0pO1xuXHRcblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVmlld3MuRm9ybS5TZWxlY3RlZENvdW50cmllc1NlY3Rpb25WaWV3O1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIEFwcCA9IHJlcXVpcmUoIFwiLi8uLi8uLi8uLi9uYW1lc3BhY2VzLmpzXCIgKTtcblxuXHRBcHAuVmlld3MuRm9ybS5UaW1lU2VjdGlvblZpZXcgPSBCYWNrYm9uZS5WaWV3LmV4dGVuZCh7XG5cblx0XHRlbDogXCIjZm9ybS12aWV3ICNkYXRhLXRhYiAudGltZS1zZWN0aW9uXCIsXG5cdFx0ZXZlbnRzOiB7XG5cdFx0XHRcImNoYW5nZSBbbmFtZT0nZHluYW1pYy10aW1lJ11cIjogXCJvbkR5bmFtaWNUaW1lXCIsXG5cdFx0XHRcImNoYW5nZSBbbmFtZT0nY2hhcnQtdGltZS1mcm9tJ11cIjogXCJvbkNoYXJ0VGltZUNoYW5nZVwiLFxuXHRcdFx0XCJjaGFuZ2UgW25hbWU9J2NoYXJ0LXRpbWUtdG8nXVwiOiBcIm9uQ2hhcnRUaW1lQ2hhbmdlXCJcblx0XHR9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHRcblx0XHRcdHRoaXMuZGlzcGF0Y2hlciA9IG9wdGlvbnMuZGlzcGF0Y2hlcjtcblx0XHRcdHRoaXMuZGlzcGF0Y2hlci5vbiggXCJkaW1lbnNpb24tdXBkYXRlXCIsIHRoaXMub25EaW1lbnNpb25VcGRhdGUsIHRoaXMgKTtcblx0XHRcdFxuXHRcdFx0QXBwLkF2YWlsYWJsZVRpbWVNb2RlbC5vbiggXCJjaGFuZ2VcIiwgdGhpcy5vbkF2YWlsYWJsZVRpbWVDaGFuZ2UsIHRoaXMgKTtcblxuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblxuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cblx0XHRcdHRoaXMuJGVudGl0aWVzU2VsZWN0ID0gdGhpcy4kZWwuZmluZCggXCIuY291bnRyaWVzLXNlbGVjdFwiICk7XG5cdFx0XHR0aGlzLiRjaGFydFRpbWUgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPSdjaGFydC10aW1lJ11cIiApO1xuXHRcdFx0dGhpcy4kZHluYW1pY1RpbWUgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPSdkeW5hbWljLXRpbWUnXVwiICk7XG5cdFx0XHR0aGlzLiRpcnMgPSB0aGlzLiRlbC5maW5kKCBcIi5pcnNcIiApO1xuXG5cdFx0XHR0aGlzLiRjaGFydFRpbWVGcm9tID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT0nY2hhcnQtdGltZS1mcm9tJ11cIiApO1xuXHRcdFx0dGhpcy4kY2hhcnRUaW1lVG8gPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPSdjaGFydC10aW1lLXRvJ11cIiApO1xuXG5cdFx0XHR0aGlzLiRjaGFydFRpbWUuaW9uUmFuZ2VTbGlkZXIoe1xuXHRcdFx0XHR0eXBlOiBcImRvdWJsZVwiLFxuXHRcdFx0XHRtaW46IDAsXG5cdFx0XHRcdG1heDogMjAxNSxcblx0XHRcdFx0ZnJvbTogMTAwMCxcblx0XHRcdFx0dG86IDE1MDAsXG5cdFx0XHRcdGdyaWQ6IHRydWUsXG5cdFx0XHRcdG9uQ2hhbmdlOiBmdW5jdGlvbiggZGF0YSApIHtcblx0XHRcdFx0XHR0aGF0LiRjaGFydFRpbWVGcm9tLnZhbChkYXRhLmZyb20pO1xuXHRcdFx0XHRcdHRoYXQuJGNoYXJ0VGltZVRvLnZhbChkYXRhLnRvKTtcblx0XHRcdFx0XHRBcHAuQ2hhcnRNb2RlbC5zZXQoIFwiY2hhcnQtdGltZVwiLCBbZGF0YS5mcm9tLCBkYXRhLnRvXSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdHNldFRpbWVvdXQoIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRpZiggaGFzRHluYW1pY1RpbWUgKSB7XG5cdFx0XHRcdFx0dGhhdC4kaXJzLmFkZENsYXNzKCBcImRpc2FibGVkXCIgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgMjUwICk7XG5cblx0XHRcdHZhciBoYXNEeW5hbWljVGltZSA9ICggQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LXRpbWVcIiApICk/IGZhbHNlOiB0cnVlO1xuXHRcdFx0aWYoICFoYXNEeW5hbWljVGltZSApIHtcblx0XHRcdFx0dmFyIGNoYXJ0VGltZSA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10aW1lXCIgKTtcblx0XHRcdFx0dGhpcy51cGRhdGVUaW1lKCBjaGFydFRpbWVbIDAgXSwgY2hhcnRUaW1lWyAxIF0gKTtcblx0XHRcdH0gZWxzZSBpZiggQXBwLkF2YWlsYWJsZVRpbWVNb2RlbC5nZXQoIFwibWluXCIgKSAmJiBBcHAuQXZhaWxhYmxlVGltZU1vZGVsLmdldCggXCJtYXhcIiApICkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZVRpbWUoIEFwcC5BdmFpbGFibGVUaW1lTW9kZWwuZ2V0KCBcIm1pblwiICksIEFwcC5BdmFpbGFibGVUaW1lTW9kZWwuZ2V0KCBcIm1heFwiICkgKTtcblx0XHRcdFx0aWYoIGhhc0R5bmFtaWNUaW1lICkge1xuXHRcdFx0XHRcdHRoaXMuJGR5bmFtaWNUaW1lLnByb3AoIFwiY2hlY2tlZFwiLCB0cnVlICk7XG5cdFx0XHRcdFx0dGhpcy4kY2hhcnRUaW1lRnJvbS5wcm9wKCBcInJlYWRvbmx5XCIsIHRydWUpO1xuXHRcdFx0XHRcdHRoaXMuJGNoYXJ0VGltZVRvLnByb3AoIFwicmVhZG9ubHlcIiwgdHJ1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdFxuXHRcdH0sXG5cblx0XHRvbkF2YWlsYWJsZVRpbWVDaGFuZ2U6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy51cGRhdGVUaW1lKCBBcHAuQXZhaWxhYmxlVGltZU1vZGVsLmdldCggXCJtaW5cIiApLCBBcHAuQXZhaWxhYmxlVGltZU1vZGVsLmdldCggXCJtYXhcIiApICk7XG5cdFx0fSxcblxuXHRcdG9uRGltZW5zaW9uVXBkYXRlOiBmdW5jdGlvbigpIHtcblxuXHRcdFx0dmFyIGRpbWVuc2lvblN0cmluZyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC1kaW1lbnNpb25zXCIgKSxcblx0XHRcdFx0dGltZUZyb20gPSBJbmZpbml0eSxcblx0XHRcdFx0dGltZVRvID0gLUluZmluaXR5LFxuXHRcdFx0XHRsaW1pdFRpbWUgPSB0cnVlO1xuXG5cdFx0XHRpZiggISQuaXNFbXB0eU9iamVjdCggZGltZW5zaW9uU3RyaW5nICkgKSB7XG5cblx0XHRcdFx0dmFyIGRpbWVuc2lvbnMgPSAkLnBhcnNlSlNPTiggZGltZW5zaW9uU3RyaW5nICk7XG5cdFx0XHRcdCQuZWFjaCggZGltZW5zaW9ucywgZnVuY3Rpb24oIGksIHYgKSB7XG5cdFx0XHRcdFx0aWYoIHYucGVyaW9kID09PSBcInNpbmdsZVwiICYmIHYubW9kZSA9PT0gXCJzcGVjaWZpY1wiICkge1xuXHRcdFx0XHRcdFx0Ly9nZXQgbWluL21heCBsb2NhbFxuXHRcdFx0XHRcdFx0dmFyIHllYXIgPSBwYXJzZUludCggdi50YXJnZXRZZWFyLCAxMCApLFxuXHRcdFx0XHRcdFx0XHRsb2NhbEZyb20gPSB5ZWFyIC0gcGFyc2VJbnQoIHYudG9sZXJhbmNlLCAxMCApLFxuXHRcdFx0XHRcdFx0XHRsb2NhbFRvID0geWVhciArIHBhcnNlSW50KCB2LnRvbGVyYW5jZSwgMTAgKTtcblx0XHRcdFx0XHRcdHRpbWVGcm9tID0gTWF0aC5taW4oIGxvY2FsRnJvbSwgdGltZUZyb20gKTtcblx0XHRcdFx0XHRcdHRpbWVUbyA9IE1hdGgubWF4KCBsb2NhbFRvLCB0aW1lVG8gKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Ly9zZXQgZmxhZyB0aGF0IHRoZXJlIGlzIHNvbWUgZGltZW5zaW9uIHRoYXQgY2Fubm90IGJlIGxpbWl0ZWQgYXV0b21hdGljYWx5XG5cdFx0XHRcdFx0XHRsaW1pdFRpbWUgPSBmYWxzZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gKTtcblxuXHRcdFx0fVxuXG5cdFx0XHQvL2lmIHNvbWV0aGluZyBoYXMgY2hhbmdlZCwgc2V0IHRpbWUgaW50ZXJ2YWwgb25seSB0byBuZWNlc3Nhcnlcblx0XHRcdGlmKCBsaW1pdFRpbWUgJiYgdGltZUZyb20gPCBJbmZpbml0eSAmJiB0aW1lVG8gPiAtSW5maW5pdHkgKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlVGltZSggdGltZUZyb20sIHRpbWVUbyApO1xuXHRcdFx0XHRBcHAuQ2hhcnRNb2RlbC5zZXQoIFwiY2hhcnQtdGltZVwiLCBbIHRpbWVGcm9tLCB0aW1lVG8gXSApO1xuXHRcdFx0fVxuXG5cdFx0fSxcblxuXHRcdHVwZGF0ZVRpbWU6IGZ1bmN0aW9uKCBmcm9tLCB0byApIHtcblxuXHRcdFx0dmFyIHNsaWRlciA9ICQoIFwiW25hbWU9Y2hhcnQtdGltZV1cIiApLmRhdGEoIFwiaW9uUmFuZ2VTbGlkZXJcIiApO1xuXHRcdFx0c2xpZGVyLnVwZGF0ZSgge2Zyb206IGZyb20sIHRvOiB0byB9ICk7XG5cdFx0XHQvL3VwZGF0aW5nIHNsaWRlciwgc28gaGF2ZSBzb21lIHNldCB2YWx1ZXMgYW5kIGRpc2FibGluZyBkeW5hbWljIHRhYmxlXG5cdFx0XHR0aGlzLiRkeW5hbWljVGltZS5wcm9wKCBcImNoZWNrZWRcIiwgZmFsc2UgKTtcblx0XHRcdHRoaXMuJGlycy5yZW1vdmVDbGFzcyggXCJkaXNhYmxlZFwiICk7XG5cdFx0XHR0aGlzLiRjaGFydFRpbWVGcm9tLnZhbChmcm9tKTtcblx0XHRcdHRoaXMuJGNoYXJ0VGltZVRvLnZhbCh0byk7XG5cblx0XHR9LFxuXG5cdFx0b25EeW5hbWljVGltZTogZnVuY3Rpb24oKSB7XG5cblx0XHRcdGlmKCB0aGlzLiRkeW5hbWljVGltZS5pcyggXCI6Y2hlY2tlZFwiICkgKSB7XG5cdFx0XHRcdHRoaXMuJGlycy5hZGRDbGFzcyggXCJkaXNhYmxlZFwiICk7XG5cdFx0XHRcdHRoaXMuJGNoYXJ0VGltZUZyb20ucHJvcCggXCJyZWFkb25seVwiLCB0cnVlKTtcblx0XHRcdFx0dGhpcy4kY2hhcnRUaW1lVG8ucHJvcCggXCJyZWFkb25seVwiLCB0cnVlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuJGlycy5yZW1vdmVDbGFzcyggXCJkaXNhYmxlZFwiICk7XG5cdFx0XHRcdHRoaXMuJGNoYXJ0VGltZUZyb20ucHJvcCggXCJyZWFkb25seVwiLCBmYWxzZSk7XG5cdFx0XHRcdHRoaXMuJGNoYXJ0VGltZVRvLnByb3AoIFwicmVhZG9ubHlcIiwgZmFsc2UpO1xuXHRcdFx0fVxuXHRcdFxuXHRcdH0sXG5cblx0XHRvbkNoYXJ0VGltZUNoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0dmFyIHNsaWRlciA9ICQoIFwiW25hbWU9Y2hhcnQtdGltZV1cIiApLmRhdGEoIFwiaW9uUmFuZ2VTbGlkZXJcIiApLFxuXHRcdFx0XHRmcm9tID0gdGhpcy4kY2hhcnRUaW1lRnJvbS52YWwoKSxcblx0XHRcdFx0dG8gPSB0aGlzLiRjaGFydFRpbWVUby52YWwoKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJjaGFydC10aW1lXCIsIFtmcm9tLCB0b10gKTtcblx0XHRcdHNsaWRlci51cGRhdGUoIHtmcm9tOiBmcm9tLCB0bzogdG8gfSApO1xuXHRcdH1cblxuXG5cdH0pO1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkZvcm0uVGltZVNlY3Rpb25WaWV3O1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBBcHAgPSByZXF1aXJlKCBcIi4vLi4vLi4vbmFtZXNwYWNlcy5qc1wiICk7XG5cblx0dmFyIHRoYXQ7XG5cblx0QXBwLlZpZXdzLlVJLkNvbG9yUGlja2VyID0gZnVuY3Rpb24oKSB7XG5cdFx0dGhhdCA9IHRoaXM7XG5cdFx0dGhpcy4kZGl2ID0gbnVsbDtcblx0XG5cdFx0dGhpcy5pbml0ID0gZnVuY3Rpb24oICRlbCwgZGF0YSApIHtcblxuXHRcdFx0dmFyIGxpc1N0cmluZyA9IFwiXCIsXG5cdFx0XHRcdCRsaXM7XG5cblx0XHRcdGlmKCAhZGF0YSApIHtcblx0XHRcdFx0ZGF0YSA9IEFwcC5WaWV3cy5VSS5Db2xvclBpY2tlci5DT0xPUl9BUlJBWTtcblx0XHRcdH1cblxuXHRcdFx0Ly9ET00gc3R1ZmZcdFx0XHRcblx0XHRcdCQuZWFjaCggZGF0YSwgZnVuY3Rpb24oIGksIGQgKSB7XG5cdFx0XHRcdGxpc1N0cmluZyArPSBcIjxsaSBkYXRhLXZhbHVlPSdcIiArIGQgKyBcIicgc3R5bGU9J2JhY2tncm91bmQtY29sb3I6XCIgKyBkICsgXCInPjwvbGk+XCI7XG5cdFx0XHR9ICk7XG5cdFx0XHR0aGlzLiRkaXYgPSAkKCBcIjxkaXYgY2xhc3M9J1wiICsgQXBwLlZpZXdzLlVJLkNvbG9yUGlja2VyLldSQVBQRVJfQ0xBU1MgKyBcIic+PHVsIGNsYXNzPSduby1idWxsZXRzJz5cIiArIGxpc1N0cmluZyArIFwiPC91bD48L2Rpdj5cIiApO1xuXHRcdFx0JGVsLmFwcGVuZCggdGhpcy4kZGl2ICk7XG5cdFx0XHQkbGlzID0gdGhpcy4kZGl2LmZpbmQoIFwibGlcIiApO1xuXG5cdFx0XHQvL3ByZXZlbnQgbW92ZW1lbnRcblx0XHRcdHRoaXMuJGRpdi5vbiggXCJtb3VzZWRvd25cIiwgZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdFx0ZXZ0LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuXHRcdFx0fSApO1xuXHRcdFx0JGxpcy5vbiggXCJtb3VzZWRvd25cIiwgdGhpcy5vbk1vdXNlRG93biApO1xuXHRcdH07XG5cblx0XHR0aGlzLm9uTW91c2VEb3duID0gZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdGV2dC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcblx0XHRcdHZhciB2YWx1ZSA9ICQoIHRoaXMgKS5hdHRyKCBcImRhdGEtdmFsdWVcIiApO1xuXHRcdFx0aWYoIHRoYXQub25TZWxlY3RlZCApIHtcblx0XHRcdFx0dGhhdC5vblNlbGVjdGVkLmFwcGx5KCB0aGF0LCBbIHZhbHVlIF0gKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0dGhpcy5jbG9zZSA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy4kZGl2LnJlbW92ZSgpO1xuXHRcdH07XG5cblx0fTtcblxuXHQvL0FwcC5WaWV3cy5VSS5Db2xvclBpY2tlci5DT0xPUl9BUlJBWSA9IFsgXCIjQTUyQTJBXCIsIFwiI0ZGNDA0MFwiLCBcIiNFRTNCM0JcIiwgXCIjQ0QzMzMzXCIsIFwiIzVGOUVBMFwiLCBcIiM5OEY1RkZcIiwgXCIjOEVFNUVFXCIsIFwiIzdBQzVDRFwiLCBcIiM1Mzg2OEJcIiwgXCIjRkZENzAwXCIsIFwiI0VFQzkwMFwiLCBcIiNDREFEMDBcIiwgXCIjOEI3NTAwXCIgIF07XG5cdEFwcC5WaWV3cy5VSS5Db2xvclBpY2tlci5DT0xPUl9BUlJBWSA9IFsgXCIjQjAxNzFGXCIsIFwiI0RDMTQzQ1wiLCBcIiNGRjNFOTZcIiwgXCIjRUUzQThDXCIsIFwiI0RBNzBENlwiLCBcIiNGRjgzRkFcIiwgXCIjOEEyQkUyXCIsIFwiIzlCMzBGRlwiLCBcIiM2OTU5Q0RcIiwgXCIjNDczQzhCXCIsIFwiIzQzNkVFRVwiLCBcIiMzQTVGQ0RcIiwgXCIjNUNBQ0VFXCIsIFwiIzRGOTRDRFwiLCBcIiM3QUM1Q0RcIiwgXCIjNTM4NjhCXCIsIFwiIzY2Q0RBQVwiLCBcIiM0NThCNzRcIiwgXCIjNDNDRDgwXCIsIFwiIzJFOEI1N1wiLCBcIiM2NkNEMDBcIiwgXCIjQ0RDRDAwXCIsIFwiI0ZGRUM4QlwiLCBcIiNGRkQ3MDBcIiwgXCIjRkZDMTI1XCIsIFwiI0ZGQTUwMFwiLCBcIiNGRjdGNTBcIiwgXCIjRkY0NTAwXCIsIFwiIzVCNUI1QlwiLCBcIiM4RThFOEVcIiBdO1xuXHRBcHAuVmlld3MuVUkuQ29sb3JQaWNrZXIuV1JBUFBFUl9DTEFTUyA9IFwicG9wdXAtcGlja2VyLXdyYXBwZXJcIjtcblx0XG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLlVJLkNvbG9yUGlja2VyO1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBBcHAgPSByZXF1aXJlKCBcIi4vLi4vLi4vbmFtZXNwYWNlcy5qc1wiICk7XG5cdFxuXHR2YXIgdGhhdDtcblxuXHRBcHAuVmlld3MuVUkuU2VsZWN0VmFyUG9wdXAgPSBmdW5jdGlvbigpIHtcblxuXHRcdHRoYXQgPSB0aGlzO1xuXHRcdHRoaXMuJGRpdiA9IG51bGw7XG5cblx0fTtcblxuXHRBcHAuVmlld3MuVUkuU2VsZWN0VmFyUG9wdXAucHJvdG90eXBlID0ge1xuXG5cdFx0aW5pdDogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cblx0XHRcdHRoaXMuZGlzcGF0Y2hlciA9IG9wdGlvbnMuZGlzcGF0Y2hlcjtcblxuXHRcdFx0dGhpcy4kd2luID0gJCggd2luZG93ICk7XG5cdFx0XHR0aGlzLiRlbCA9ICQoIFwiLnNlbGVjdC12YXItcG9wdXBcIiApO1xuXHRcdFx0dGhpcy4kY2xvc2VCdG4gPSB0aGlzLiRlbC5maW5kKCBcIi5jbG9zZVwiICk7XG5cdFx0XHR0aGlzLiRzYXZlQnRuID0gdGhpcy4kZWwuZmluZCggXCIuYnRuLXByaW1hcnlcIiApO1xuXHRcdFx0dGhpcy4kY2FuY2VsQnRuID0gdGhpcy4kZWwuZmluZCggXCIuYnRuLWRlZmF1bHRcIiApO1xuXHRcdFx0XG5cdFx0XHR0aGlzLiR2YXJpYWJsZVdyYXBwZXIgPSB0aGlzLiRlbC5maW5kKCBcIi52YXJpYWJsZS13cmFwcGVyXCIgKTtcblx0XHRcdHRoaXMuJGNhdGVnb3J5U2VsZWN0ID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT1jYXRlZ29yeS1pZF1cIiApO1xuXHRcdFx0dGhpcy4kc3ViY2F0ZWdvcnlTZWxlY3QgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPXN1YmNhdGVnb3J5LWlkXVwiICk7XG5cdFx0XHRcdFxuXHRcdFx0dGhpcy4kc2VsZWN0V3JhcHBlciA9IHRoaXMuJGVsLmZpbmQoIFwiLnNlYXJjaC1pbnB1dC13cmFwcGVyXCIgKTtcblx0XHRcdHRoaXMuJHNlbGVjdFZhclNlYXJjaCA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9c2VsZWN0X3Zhcl9zZWFyY2hdXCIgKTtcblx0XHRcdHRoaXMuJHNlbGVjdFJlc3VsdHMgPSB0aGlzLiRlbC5maW5kKCBcIi5zZWFyY2gtcmVzdWx0c1wiICk7XG5cdFx0XHR0aGlzLiRzZWFyY2hJY29uID0gdGhpcy4kc2VsZWN0V3JhcHBlci5maW5kKCBcIi5mYS1zZWFyY2hcIiApO1xuXHRcdFx0dGhpcy4kcHJlbG9hZGVySWNvbiA9IHRoaXMuJHNlbGVjdFdyYXBwZXIuZmluZCggXCIuZmEtc3Bpbm5lclwiICk7XG5cdFx0XHR0aGlzLiRjbGVhckljb24gPSB0aGlzLiRzZWxlY3RXcmFwcGVyLmZpbmQoIFwiLmZhLXRpbWVzXCIgKTtcblx0XHRcdHRoaXMuJHByZWxvYWRlckljb24uaGlkZSgpO1xuXHRcdFx0dGhpcy4kY2xlYXJJY29uLmhpZGUoKTtcblxuXHRcdFx0dGhpcy4kY2hhcnRWYXJpYWJsZSA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9Y2hhcnQtdmFyaWFibGVdXCIgKTtcblx0XHRcdFxuXHRcdFx0dGhpcy4kY2xvc2VCdG4ub24oIFwiY2xpY2tcIiwgJC5wcm94eSggdGhpcy5vbkNsb3NlQnRuLCB0aGlzICkgKTtcblx0XHRcdHRoaXMuJHNhdmVCdG4ub24oIFwiY2xpY2tcIiwgJC5wcm94eSggdGhpcy5vblNhdmVCdG4sIHRoaXMgKSApO1xuXHRcdFx0dGhpcy4kY2FuY2VsQnRuLm9uKCBcImNsaWNrXCIsICQucHJveHkoIHRoaXMub25DYW5jZWxCdG4sIHRoaXMgKSApO1xuXHRcdFx0XG5cdFx0XHR0aGlzLiRzZWxlY3RWYXJTZWFyY2gub24oIFwiaW5wdXRcIiwgJC5wcm94eSggdGhpcy5vblNlYXJjaElucHV0LCB0aGlzICkgKTtcblx0XHRcdHRoaXMuJHNlbGVjdFZhclNlYXJjaC5vbiggXCJmb2N1c2luXCIsICQucHJveHkoIHRoaXMub25TZWFyY2hGb2N1c0luLCB0aGlzICkgKTtcblx0XHRcdHRoaXMuJHNlbGVjdFZhclNlYXJjaC5vbiggXCJmb2N1c291dFwiLCAkLnByb3h5KCB0aGlzLm9uU2VhcmNoRm9jdXNPdXQsIHRoaXMgKSApO1xuXG5cdFx0XHR0aGlzLiRjbGVhckljb24ub24oIFwiY2xpY2tcIiwgJC5wcm94eSggdGhpcy5vbkNsZWFyQnRuLCB0aGlzICkgKTtcblxuXHRcdFx0QXBwLlNlYXJjaERhdGFDb2xsZWN0aW9uLm9uKCBcImZldGNoZWRcIiwgJC5wcm94eSggdGhpcy5vblNlYXJjaEZldGNoZWQsIHRoaXMgKSApO1xuXG5cdFx0fSxcblxuXHRcdHNob3c6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHR0aGlzLiRlbC5zaG93KCk7XG5cblx0XHR9LFxuXG5cdFx0aGlkZTogZnVuY3Rpb24oKSB7XG5cblx0XHRcdHRoaXMuJGVsLmhpZGUoKTtcblxuXHRcdH0sXG5cblx0XHRvbkNsb3NlQnRuOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdHRoaXMuaGlkZSgpO1xuXG5cdFx0fSxcblxuXHRcdG9uU2F2ZUJ0bjogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcblx0XHRcdC8vdHJpZ2dlciBldmVudCBvbmx5IGlmIHNvbWV0aGluZyBzZWxlY3RlZFxuXHRcdFx0aWYoIHRoaXMuJGNoYXJ0VmFyaWFibGUudmFsKCkgPiAwICkge1xuXHRcdFx0XHRcblx0XHRcdFx0dmFyIHZhcklkID0gdGhpcy4kY2hhcnRWYXJpYWJsZS52YWwoKSxcblx0XHRcdFx0XHR2YXJVbml0ID0gdGhpcy4kY2hhcnRWYXJpYWJsZS5maW5kKCBcIm9wdGlvbjpzZWxlY3RlZFwiICkuYXR0ciggXCJkYXRhLXVuaXRcIiApLFxuXHRcdFx0XHRcdHZhck5hbWUgPSB0aGlzLiRjaGFydFZhcmlhYmxlLmZpbmQoIFwib3B0aW9uOnNlbGVjdGVkXCIgKS50ZXh0KCk7XG5cblx0XHRcdFx0dmFyIHZhcmlhYmxlID0gbmV3IEFwcC5Nb2RlbHMuQ2hhcnRWYXJpYWJsZU1vZGVsKCB7IGlkOnZhcklkLCBuYW1lOiB2YXJOYW1lLCB1bml0OiB2YXJVbml0IH0gKTtcblx0XHRcdFx0QXBwLkNoYXJ0VmFyaWFibGVzQ29sbGVjdGlvbi5hZGQoIHZhcmlhYmxlICk7XG5cdFx0XHRcdC8vQXBwLkNoYXJ0TW9kZWwudXBkYXRlVmFyaWFibGVzKCB7IGlkOnZhcklkLCBuYW1lOiB2YXJOYW1lIH0gKTtcblx0XHRcdFx0XG5cdFx0XHRcdHRoaXMuaGlkZSgpO1xuXG5cdFx0XHR9XG5cblx0XHR9LFxuXG5cdFx0b25DYW5jZWxCdG46IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0dGhpcy5oaWRlKCk7XG5cblx0XHR9LFxuXG5cdFx0b25TZWFyY2hJbnB1dDogZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdFxuXHRcdFx0dmFyICRpbnB1dCA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICksXG5cdFx0XHRcdHNlYXJjaFRlcm0gPSAkaW5wdXQudmFsKCk7XG5cblx0XHRcdGlmKCBzZWFyY2hUZXJtLmxlbmd0aCA+PSAyICkge1xuXHRcdFx0XHRcblx0XHRcdFx0dGhpcy4kY2xlYXJJY29uLmhpZGUoKTtcblx0XHRcdFx0dGhpcy4kc2VhcmNoSWNvbi5oaWRlKCk7XG5cdFx0XHRcdHRoaXMuJHByZWxvYWRlckljb24uc2hvdygpO1xuXG5cdFx0XHRcdEFwcC5TZWFyY2hEYXRhQ29sbGVjdGlvbi5zZWFyY2goIHNlYXJjaFRlcm0gKTtcblxuXHRcdFx0fSBlbHNlIHtcblxuXHRcdFx0XHQvL2NsZWFyIHNlbGVjdGlvblxuXHRcdFx0XHR0aGlzLiRzZWxlY3RSZXN1bHRzLmVtcHR5KCk7XG5cdFx0XHRcdHRoaXMuJHNlbGVjdFJlc3VsdHMuaGlkZSgpO1xuXHRcdFx0XHRcblx0XHRcdFx0dGhpcy4kY2xlYXJJY29uLmhpZGUoKTtcblx0XHRcdFx0dGhpcy4kc2VhcmNoSWNvbi5zaG93KCk7XG5cblx0XHRcdH1cblxuXHRcdH0sXG5cblx0XHRvblNlYXJjaEZldGNoZWQ6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdHRoaXMuJGNsZWFySWNvbi5zaG93KCk7XG5cdFx0XHR0aGlzLiRzZWFyY2hJY29uLmhpZGUoKTtcblx0XHRcdHRoaXMuJHByZWxvYWRlckljb24uaGlkZSgpO1xuXG5cdFx0XHR0aGlzLiRzZWxlY3RSZXN1bHRzLmVtcHR5KCk7XG5cdFx0XHR0aGlzLiRzZWxlY3RSZXN1bHRzLnNob3coKTtcblx0XHRcdFxuXHRcdFx0dmFyIHJlc3VsdHMgPSBBcHAuU2VhcmNoRGF0YUNvbGxlY3Rpb24ubW9kZWxzLFxuXHRcdFx0XHRodG1sU3RyaW5nID0gXCJcIjtcblx0XHRcdF8uZWFjaCggcmVzdWx0cywgZnVuY3Rpb24oIHJlc3VsdCApIHtcblx0XHRcdFx0aHRtbFN0cmluZyArPSBcIjxsaSBkYXRhLWNhdC1pZD0nXCIgKyByZXN1bHQuZ2V0KCBcImZrX2RzdF9jYXRfaWRcIiApICsgXCInIGRhdGEtc3ViY2F0LWlkPSdcIiArIHJlc3VsdC5nZXQoIFwiZmtfZHN0X3N1YmNhdF9pZFwiICkgKyBcIicgZGF0YS12YXItaWQ9J1wiICsgcmVzdWx0LmdldCggXCJpZFwiICkgKyBcIic+XCIgKyByZXN1bHQuZ2V0KCBcIm5hbWVcIiApICsgXCI8L2xpPlwiO1xuXHRcdFx0fSApO1xuXG5cdFx0XHR0aGlzLiRzZWxlY3RSZXN1bHRzLmFwcGVuZCggJCggaHRtbFN0cmluZyApICk7XG5cdFx0XHR0aGlzLiRsaXMgPSB0aGlzLiRzZWxlY3RSZXN1bHRzLmZpbmQoIFwibGlcIiApO1xuXHRcdFx0XG5cdFx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0XHR0aGlzLiRsaXMub24oIFwibW91c2Vkb3duXCIsIGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdFx0dGhhdC5zZWxlY3RJdGVtKCAkKCBldnQuY3VycmVudFRhcmdldCApICk7XG5cdFx0XHRcdFxuXHRcdFx0fSApO1xuXG5cdFx0fSxcblxuXHRcdHNlbGVjdEl0ZW06IGZ1bmN0aW9uKCAkbGkgKSB7XG5cblx0XHRcdHZhciB0aGF0ID0gdGhpcyxcblx0XHRcdFx0dmFySWQgPSAkbGkuYXR0ciggXCJkYXRhLXZhci1pZFwiICksXG5cdFx0XHRcdGNhdElkID0gJGxpLmF0dHIoIFwiZGF0YS1jYXQtaWRcIiApLFxuXHRcdFx0XHRzdWJjYXRJZCA9ICRsaS5hdHRyKCBcImRhdGEtc3ViY2F0LWlkXCIgKTtcblxuXHRcdFx0dGhhdC4kY2F0ZWdvcnlTZWxlY3QuZmluZCggXCJvcHRpb25bdmFsdWU9XCIgKyBjYXRJZCArIFwiXVwiICkucHJvcCggXCJzZWxlY3RlZFwiLCB0cnVlICk7XG5cdFx0XHR0aGF0LiRjYXRlZ29yeVNlbGVjdC50cmlnZ2VyKCBcImNoYW5nZVwiICk7XG5cdFx0XHR0aGF0LiRzdWJjYXRlZ29yeVNlbGVjdC5maW5kKCBcIm9wdGlvblt2YWx1ZT1cIiArIHN1YmNhdElkICsgXCJdXCIgKS5wcm9wKCBcInNlbGVjdGVkXCIsIHRydWUgKTtcblx0XHRcdHRoYXQuJHN1YmNhdGVnb3J5U2VsZWN0LnRyaWdnZXIoIFwiY2hhbmdlXCIgKTtcblxuXHRcdFx0dGhhdC4kdmFyaWFibGVXcmFwcGVyLnNob3coKTtcblx0XHRcdHRoYXQuJGNoYXJ0VmFyaWFibGUuZmluZCggXCJvcHRpb25bdmFsdWU9XCIgKyB2YXJJZCArIFwiXVwiICkucHJvcCggXCJzZWxlY3RlZFwiLCB0cnVlICk7XG5cblx0XHR9LFxuXG5cdFx0b25TZWFyY2hGb2N1c0luOiBmdW5jdGlvbigpIHtcblx0XHRcdC8vc2hvdyBzZWxlY3Qgb25seSBpZiBzb21lIHJlc3VsdHNcblx0XHRcdGlmKCB0aGlzLiRzZWxlY3RSZXN1bHRzLmZpbmQoIFwibGlcIiApLmxlbmd0aCApIHtcblx0XHRcdFx0dGhpcy4kc2VsZWN0UmVzdWx0cy5zaG93KCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLiRrZXlEb3duSGFuZGxlciA9ICQucHJveHkoIHRoaXMub25LZXlEb3duLCB0aGlzICk7XG5cdFx0XHR0aGlzLiR3aW4ub24oIFwia2V5ZG93blwiLCB0aGlzLiRrZXlEb3duSGFuZGxlciApO1xuXHRcdH0sXG5cblx0XHRvblNlYXJjaEZvY3VzT3V0OiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0dGhhdC4kc2VsZWN0UmVzdWx0cy5oaWRlKCk7XG5cdFx0XHR0aGlzLiR3aW4ub2ZmKCBcImtleWRvd25cIiwgdGhpcy4ka2V5RG93bkhhbmRsZXIgKTtcblx0XHR9LFxuXG5cdFx0b25LZXlEb3duOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHRpZiggIXRoaXMuJGxpcyB8fCAhdGhpcy4kbGlzLmxlbmd0aCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR2YXIgc2VsZWN0ZWRJbmRleCA9IHRoaXMuJGxpcy5maWx0ZXIoIFwiLnNlbGVjdGVkXCIgKS5pbmRleCgpLFxuXHRcdFx0XHRrZXlDb2RlID0gZXZ0LmtleUNvZGU7XG5cdFx0XHRcblx0XHRcdGlmKCBrZXlDb2RlID09PSA0MCB8fCBrZXlDb2RlID09PSAzOCApIHtcblxuXHRcdFx0XHRpZigga2V5Q29kZSA9PT0gNDAgKSB7XG5cdFx0XHRcdFx0c2VsZWN0ZWRJbmRleCsrO1xuXHRcdFx0XHRcdGlmKCBzZWxlY3RlZEluZGV4ID49IHRoaXMuJGxpcy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0XHRzZWxlY3RlZEluZGV4ID0gMDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSBpZigga2V5Q29kZSA9PT0gMzggKSB7XG5cdFx0XHRcdFx0c2VsZWN0ZWRJbmRleC0tO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy4kbGlzLnJlbW92ZUNsYXNzKCBcInNlbGVjdGVkXCIgKTtcblx0XHRcdFx0dGhpcy4kbGlzLmVxKCBzZWxlY3RlZEluZGV4ICkuYWRkQ2xhc3MoIFwic2VsZWN0ZWRcIiApO1xuXHRcdFx0XG5cdFx0XHR9IGVsc2UgaWYoIGtleUNvZGUgPT09IDEzICkge1xuXG5cdFx0XHRcdHRoaXMuc2VsZWN0SXRlbSggdGhpcy4kbGlzLmVxKCBzZWxlY3RlZEluZGV4ICkgKTtcblx0XHRcdFx0dGhpcy4kc2VsZWN0UmVzdWx0cy5oaWRlKCk7XG5cblx0XHRcdH1cblxuXHRcdH0sXG5cblx0XHRvbkNsZWFyQnRuOiBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuJHNlbGVjdFZhclNlYXJjaC52YWwoIFwiXCIgKTtcblx0XHRcdHRoaXMuJHNlbGVjdFZhclNlYXJjaC50cmlnZ2VyKCBcImlucHV0XCIgKTtcblx0XHR9XG5cblx0fTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5VSS5TZWxlY3RWYXJQb3B1cDtcblxufSkoKTtcbiIsIjsoIGZ1bmN0aW9uKCkge1xuXG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBBcHAgPSByZXF1aXJlKCBcIi4vLi4vLi4vbmFtZXNwYWNlcy5qc1wiICk7XG5cdFxuXHR2YXIgdGhhdDtcblxuXHRBcHAuVmlld3MuVUkuU2V0dGluZ3NWYXJQb3B1cCA9IGZ1bmN0aW9uKCkge1xuXG5cdFx0dGhhdCA9IHRoaXM7XG5cdFx0dGhpcy4kZGl2ID0gbnVsbDtcblxuXHR9O1xuXG5cdEFwcC5WaWV3cy5VSS5TZXR0aW5nc1ZhclBvcHVwLnByb3RvdHlwZSA9IHtcblxuXHRcdGluaXQ6IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIgPSBvcHRpb25zLmRpc3BhdGNoZXI7XG5cblx0XHRcdC8vd2lsbCBiZSBmaWxsZWQgd2hlbiBvcGVuaW5nIHBvcHVwXG5cdFx0XHR0aGlzLnZhcmlhYmxlSWQgPSAtMTtcblxuXHRcdFx0Ly9mbGFnIGZvciBcblx0XHRcdHRoaXMudmFsaWQgPSB0cnVlO1xuXG5cdFx0XHR0aGlzLiRlbCA9ICQoIFwiLnNldHRpbmdzLXZhci1wb3B1cFwiICk7XG5cdFx0XHR0aGlzLiRjbG9zZUJ0biA9IHRoaXMuJGVsLmZpbmQoIFwiLmNsb3NlXCIgKTtcblx0XHRcdHRoaXMuJHNhdmVCdG4gPSB0aGlzLiRlbC5maW5kKCBcIi5idG4tcHJpbWFyeVwiICk7XG5cdFx0XHR0aGlzLiRjYW5jZWxCdG4gPSB0aGlzLiRlbC5maW5kKCBcIi5idG4tZGVmYXVsdFwiICk7XG5cblx0XHRcdHRoaXMuJGRpZ2l0SW5wdXRzID0gdGhpcy4kZWwuZmluZCggXCIuZGlnaXQtaW5wdXRcIiApO1xuXHRcdFx0dGhpcy4kcGVyaW9kSW5wdXRzID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT1wZXJpb2RdXCIgKTtcblx0XHRcdHRoaXMuJHNpbmdsZUlucHV0cyA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9c2luZ2xlXVwiICk7XG5cdFx0XHR0aGlzLiRhbGxJbnB1dHMgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPWFsbF1cIiApO1xuXHRcdFx0dGhpcy4kY29udGVudEFsbCA9IHRoaXMuJGVsLmZpbmQoIFwiLnNldHRpbmdzLXZhci1jb250ZW50LWFsbFwiICk7XG5cdFx0XHR0aGlzLiRjb250ZW50U2luZ2xlID0gdGhpcy4kZWwuZmluZCggXCIuc2V0dGluZ3MtdmFyLWNvbnRlbnQtc2luZ2xlXCIgKTtcblx0XHRcdFx0XG5cdFx0XHR0aGlzLiRjb250ZW50U2luZ2xlU3BlY2lmaWMgPSB0aGlzLiRlbC5maW5kKCBcIi5zZXR0aW5ncy12YXItc2luZ2xlLXNwZWNpZmljLWNvbnRlbnRcIiApO1xuXHRcdFx0dGhpcy4kY29udGVudFNpbmdsZUxhdGVzdCA9IHRoaXMuJGVsLmZpbmQoIFwiLnNldHRpbmdzLXZhci1zaW5nbGUtbGF0ZXN0LWNvbnRlbnRcIiApO1xuXG5cdFx0XHR0aGlzLiRjb250ZW50QWxsQ2xvc2VzdCA9IHRoaXMuJGVsLmZpbmQoIFwiLnNldHRpbmdzLXZhci1hbGwtY2xvc2VzdC1jb250ZW50XCIgKTtcblx0XHRcdHRoaXMuJGNvbnRlbnRBbGxMYXRlc3QgPSB0aGlzLiRlbC5maW5kKCBcIi5zZXR0aW5ncy12YXItYWxsLWxhdGVzdC1jb250ZW50XCIgKTtcblxuXHRcdFx0dGhpcy4kY2xvc2VCdG4ub24oIFwiY2xpY2tcIiwgJC5wcm94eSggdGhpcy5vbkNsb3NlQnRuLCB0aGlzICkgKTtcblx0XHRcdHRoaXMuJHNhdmVCdG4ub24oIFwiY2xpY2tcIiwgJC5wcm94eSggdGhpcy5vblNhdmVCdG4sIHRoaXMgKSApO1xuXHRcdFx0dGhpcy4kY2FuY2VsQnRuLm9uKCBcImNsaWNrXCIsICQucHJveHkoIHRoaXMub25DYW5jZWxCdG4sIHRoaXMgKSApO1xuXHRcdFx0XG5cdFx0XHR0aGlzLiRkaWdpdElucHV0cy5vbiggXCJjaGFuZ2VcIiwgJC5wcm94eSggdGhpcy5vbkRpZ2l0SW5wdXRzLCB0aGlzICkgKTtcblx0XHRcdHRoaXMuJHBlcmlvZElucHV0cy5vbiggXCJjaGFuZ2VcIiwgJC5wcm94eSggdGhpcy5vblBlcmlvZElucHV0cywgdGhpcyApICk7XG5cdFx0XHR0aGlzLiRzaW5nbGVJbnB1dHMub24oIFwiY2hhbmdlXCIsICQucHJveHkoIHRoaXMub25TaW5nbGVJbnB1dHMsIHRoaXMgKSApO1xuXHRcdFx0dGhpcy4kYWxsSW5wdXRzLm9uKCBcImNoYW5nZVwiLCAkLnByb3h5KCB0aGlzLm9uQWxsSW5wdXRzLCB0aGlzICkgKTtcblxuXHRcdH0sXG5cblx0XHRvbkRpZ2l0SW5wdXRzOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcblxuXHRcdFx0dmFyICRpbnB1dCA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICksXG5cdFx0XHRcdHZhbHVlID0gJGlucHV0LnZhbCgpO1xuXG5cdFx0XHRpZiggaXNOYU4oIHZhbHVlICkgKSB7XG5cdFx0XHRcdCRpbnB1dC5wYXJlbnQoKS5hZGRDbGFzcyggXCJoYXMtZXJyb3JcIiApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0JGlucHV0LnBhcmVudCgpLnJlbW92ZUNsYXNzKCBcImhhcy1lcnJvclwiICk7XG5cdFx0XHR9XG5cblx0XHR9LFxuXG5cdFx0b25QZXJpb2RJbnB1dHM6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdHZhciAkaW5wdXQgPSAkKCBldnQuY3VycmVudFRhcmdldCApO1xuXHRcdFx0aWYoICRpbnB1dC52YWwoKSA9PT0gXCJhbGxcIiApIHtcblx0XHRcdFx0dGhpcy4kY29udGVudEFsbC5zaG93KCk7XG5cdFx0XHRcdHRoaXMuJGNvbnRlbnRTaW5nbGUuaGlkZSgpO1xuXHRcdFx0fSBlbHNlIGlmKCAkaW5wdXQudmFsKCkgPT09IFwic2luZ2xlXCIgKSB7XG5cdFx0XHRcdHRoaXMuJGNvbnRlbnRBbGwuaGlkZSgpO1xuXHRcdFx0XHR0aGlzLiRjb250ZW50U2luZ2xlLnNob3coKTtcblx0XHRcdH1cblxuXHRcdH0sXG5cblx0XHRvblNpbmdsZUlucHV0czogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dmFyICRpbnB1dCA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICk7XG5cdFx0XHRpZiggJGlucHV0LnZhbCgpID09PSBcInNwZWNpZmljXCIgKSB7XG5cdFx0XHRcdHRoaXMuJGNvbnRlbnRTaW5nbGVTcGVjaWZpYy5zaG93KCk7XG5cdFx0XHRcdHRoaXMuJGNvbnRlbnRTaW5nbGVMYXRlc3QuaGlkZSgpO1xuXHRcdFx0fSBlbHNlIGlmKCAkaW5wdXQudmFsKCkgPT09IFwibGF0ZXN0XCIgKSB7XG5cdFx0XHRcdHRoaXMuJGNvbnRlbnRTaW5nbGVTcGVjaWZpYy5oaWRlKCk7XG5cdFx0XHRcdHRoaXMuJGNvbnRlbnRTaW5nbGVMYXRlc3Quc2hvdygpO1xuXHRcdFx0fVxuXG5cdFx0fSxcblxuXHRcdG9uQWxsSW5wdXRzOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHR2YXIgJGlucHV0ID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKTtcblx0XHRcdGlmKCAkaW5wdXQudmFsKCkgPT09IFwiY2xvc2VzdFwiICkge1xuXHRcdFx0XHR0aGlzLiRjb250ZW50QWxsQ2xvc2VzdC5zaG93KCk7XG5cdFx0XHRcdHRoaXMuJGNvbnRlbnRBbGxMYXRlc3QuaGlkZSgpO1xuXHRcdFx0fSBlbHNlIGlmKCAkaW5wdXQudmFsKCkgPT09IFwibGF0ZXN0XCIgKSB7XG5cdFx0XHRcdHRoaXMuJGNvbnRlbnRBbGxDbG9zZXN0LmhpZGUoKTtcblx0XHRcdFx0dGhpcy4kY29udGVudEFsbExhdGVzdC5zaG93KCk7XG5cdFx0XHR9XG5cblx0XHR9LFxuXG5cdFx0c2hvdzogZnVuY3Rpb24oICR2YXJpYWJsZUxhYmVsICkge1xuXG5cdFx0XHR0aGlzLnZhcmlhYmxlSWQgPSAkdmFyaWFibGVMYWJlbC5hdHRyKCBcImRhdGEtdmFyaWFibGUtaWRcIiApO1xuXHRcdFx0XG5cdFx0XHQvL3JlcG9wdWxhdGUgZnJvbSBlbGVtZW50XG5cdFx0XHR2YXIgcGVyaW9kID0gJHZhcmlhYmxlTGFiZWwuYXR0ciggXCJkYXRhLXBlcmlvZFwiICksXG5cdFx0XHRcdG1vZGUgPSAkdmFyaWFibGVMYWJlbC5hdHRyKCBcImRhdGEtbW9kZVwiICksXG5cdFx0XHRcdHRhcmdldFllYXIgPSAkdmFyaWFibGVMYWJlbC5hdHRyKCBcImRhdGEtdGFyZ2V0LXllYXJcIiApLFxuXHRcdFx0XHR0b2xlcmFuY2UgPSAkdmFyaWFibGVMYWJlbC5hdHRyKCBcImRhdGEtdG9sZXJhbmNlXCIgKSxcblx0XHRcdFx0bWF4aW11bUFnZSA9ICR2YXJpYWJsZUxhYmVsLmF0dHIoIFwiZGF0YS1tYXhpbXVtLWFnZVwiICk7XG5cblx0XHRcdC8vcHJlZmlsbCB2YWx1ZXMgKHJlZ2FyZGxlc3Mgb2Ygd2hhdCBpcyBzZWxlY3RlZClcblx0XHRcdHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9c2luZ2xlLXllYXJdXCIgKS52YWwoIHRhcmdldFllYXIgKTtcblx0XHRcdHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9c2luZ2xlLXRvbGVyYW5jZV1cIiApLnZhbCggdG9sZXJhbmNlICk7XG5cdFx0XHR0aGlzLiRlbC5maW5kKCBcIltuYW1lPXNpbmdsZS1tYXhpbXVtLWFnZV1cIiApLnZhbCggbWF4aW11bUFnZSApO1xuXHRcdFx0dGhpcy4kZWwuZmluZCggXCJbbmFtZT1hbGwtdG9sZXJhbmNlXVwiICkudmFsKCB0b2xlcmFuY2UgKTtcblx0XHRcdHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9YWxsLW1heGltdW0tYWdlXVwiICkudmFsKCBtYXhpbXVtQWdlICk7XG5cblx0XHRcdC8vcmVtb3ZlIGFsbCB2YWxpZGF0aW9uIGVycm9yc1xuXHRcdFx0dGhpcy4kZWwuZmluZCggXCIuaGFzLWVycm9yXCIgKS5yZW1vdmVDbGFzcyggXCJoYXMtZXJyb3JcIiApO1xuXG5cdFx0XHQvL2Jhc2VkIG9uIHNldCB2YWx1ZXMsIGFwcGVhciBjb3JyZWN0IHZhbHVlc1xuXHRcdFx0aWYoIHBlcmlvZCApIHtcblx0XHRcdFx0XG5cdFx0XHRcdGlmKCBwZXJpb2QgPT09IFwic2luZ2xlXCIgKSB7XG5cblx0XHRcdFx0XHR0aGlzLiRwZXJpb2RJbnB1dHMuZmlsdGVyKCBcIlt2YWx1ZT1zaW5nbGVdXCIgKS5wcm9wKCBcImNoZWNrZWRcIiwgdHJ1ZSApO1xuXG5cdFx0XHRcdFx0dGhpcy4kY29udGVudEFsbC5oaWRlKCk7XG5cdFx0XHRcdFx0dGhpcy4kY29udGVudFNpbmdsZS5zaG93KCk7XG5cblx0XHRcdFx0XHRpZiggbW9kZSA9PT0gXCJzcGVjaWZpY1wiICkge1xuXG5cdFx0XHRcdFx0XHR0aGlzLiRzaW5nbGVJbnB1dHMuZmlsdGVyKCBcIlt2YWx1ZT1zcGVjaWZpY11cIiApLnByb3AoIFwiY2hlY2tlZFwiLCB0cnVlICk7XG5cdFx0XHRcdFx0XHR0aGlzLiRjb250ZW50U2luZ2xlU3BlY2lmaWMuc2hvdygpO1xuXHRcdFx0XHRcdFx0dGhpcy4kY29udGVudFNpbmdsZUxhdGVzdC5oaWRlKCk7XG5cdFx0XHRcdFx0XHRcblx0XHRcdFx0XHR9IGVsc2UgaWYoIG1vZGUgPT09IFwibGF0ZXN0XCIgKSB7XG5cblx0XHRcdFx0XHRcdHRoaXMuJHNpbmdsZUlucHV0cy5maWx0ZXIoIFwiW3ZhbHVlPWxhdGVzdF1cIiApLnByb3AoIFwiY2hlY2tlZFwiLCB0cnVlICk7XG5cdFx0XHRcdFx0XHR0aGlzLiRjb250ZW50U2luZ2xlU3BlY2lmaWMuaGlkZSgpO1xuXHRcdFx0XHRcdFx0dGhpcy4kY29udGVudFNpbmdsZUxhdGVzdC5zaG93KCk7XG5cdFx0XHRcdFx0XHRcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0fSBlbHNlIGlmKCBwZXJpb2QgPT09IFwiYWxsXCIgKSB7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0dGhpcy4kcGVyaW9kSW5wdXRzLmZpbHRlciggXCJbdmFsdWU9YWxsXVwiICkucHJvcCggXCJjaGVja2VkXCIsIHRydWUgKTtcblxuXHRcdFx0XHRcdHRoaXMuJGNvbnRlbnRBbGwuc2hvdygpO1xuXHRcdFx0XHRcdHRoaXMuJGNvbnRlbnRTaW5nbGUuaGlkZSgpO1xuXG5cdFx0XHRcdFx0aWYoIG1vZGUgPT09IFwiY2xvc2VzdFwiICkge1xuXHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHR0aGlzLiRhbGxJbnB1dHMuZmlsdGVyKCBcIlt2YWx1ZT1jbG9zZXN0XVwiICkucHJvcCggXCJjaGVja2VkXCIsIHRydWUgKTtcblx0XHRcdFx0XHRcdHRoaXMuJGNvbnRlbnRBbGxDbG9zZXN0LnNob3coKTtcblx0XHRcdFx0XHRcdHRoaXMuJGNvbnRlbnRBbGxMYXRlc3QuaGlkZSgpO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdH0gZWxzZSBpZiggbW9kZSA9PT0gXCJsYXRlc3RcIiApIHtcblx0XHRcdFx0XHRcdFxuXHRcdFx0XHRcdFx0dGhpcy4kYWxsSW5wdXRzLmZpbHRlciggXCJbdmFsdWU9bGF0ZXN0XVwiICkucHJvcCggXCJjaGVja2VkXCIsIHRydWUgKTtcblx0XHRcdFx0XHRcdHRoaXMuJGNvbnRlbnRBbGxDbG9zZXN0LmhpZGUoKTtcblx0XHRcdFx0XHRcdHRoaXMuJGNvbnRlbnRBbGxMYXRlc3Quc2hvdygpO1xuXHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdH1cblxuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLiRlbC5zaG93KCk7XG5cblx0XHR9LFxuXG5cdFx0aGlkZTogZnVuY3Rpb24oKSB7XG5cblx0XHRcdHRoaXMuJGVsLmhpZGUoKTtcblxuXHRcdH0sXG5cblx0XHRvbkNsb3NlQnRuOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdHRoaXMuaGlkZSgpO1xuXG5cdFx0fSxcblxuXHRcdG9uU2F2ZUJ0bjogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcblx0XHRcdC8vdmFsaWRhdGVcblx0XHRcdHZhciAkaW52YWxpZElucHV0cyA9IHRoaXMuJGVsLmZpbmQoIFwiLmhhcy1lcnJvclwiICk7XG5cdFx0XHRpZiggJGludmFsaWRJbnB1dHMubGVuZ3RoICkge1xuXHRcdFx0XHRhbGVydCggXCJQbGVhc2UgaW5wdXQgbnVtYmVycyFcIiApO1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdC8vIHN0cnVjdHVyZVxuXHRcdFx0Ly8gLSBwZXJpb2Rcblx0XHRcdC8vXHRcdC0gc2luZ2xlIFxuXHRcdFx0Ly9cdFx0XHQtIHNwZWNpZmljXG5cdFx0XHQvL1x0XHRcdFx0LSB5ZWFyXG5cdFx0XHQvL1x0XHRcdFx0LSB0b2xlcmFuY2Vcblx0XHRcdC8vXHRcdFx0LSBsYXRlc3Rcblx0XHRcdC8vXHRcdFx0XHQtIG1heGltdW0gYWdlXHRcdFx0XHRcblx0XHRcdC8vXHRcdC0gYWxsXG5cdFx0XHQvL1x0XHRcdC0gY2xvc2VzdFxuXHRcdFx0Ly9cdFx0XHRcdC0gdG9sZXJhbmNlXG5cdFx0XHQvL1x0XHRcdC0gbGF0ZXN0XG5cdFx0XHQvL1x0XHRcdFx0LSBtYXhpbXVtIGFnZSAgXG5cblx0XHRcdC8vICBhdHRyaWJ1dGVzXG5cdFx0XHQvL1x0LSBkYXRhLXBlcmlvZCBbc2luZ2xlfGFsbF0gXG5cdFx0XHQvL1x0LSBkYXRhLW1vZGUgW3NwZWNpZmljfGxhdGVzdHxjbG9zZXN0XSBcblx0XHRcdC8vXHQtIGRhdGEtdGFyZ2V0LXllYXIgW251bWJlcl0gXG5cdFx0XHQvL1x0LSBkYXRhLXRvbGVyYW5jZSBbbnVtYmVyXSBcblx0XHRcdC8vXHQtIGRhdGEtbWF4aW11bS1hZ2UgW251bWJlcl0gXG5cblx0XHRcdHZhciBkYXRhID0geyB2YXJpYWJsZUlkOiB0aGlzLnZhcmlhYmxlSWQgfTtcblx0XHRcdGRhdGEucGVyaW9kID0gdGhpcy4kcGVyaW9kSW5wdXRzLmZpbHRlciggXCI6Y2hlY2tlZFwiICkudmFsKCk7XG5cblx0XHRcdGlmKCBkYXRhLnBlcmlvZCA9PT0gXCJzaW5nbGVcIiApIHtcblxuXHRcdFx0XHRkYXRhLm1vZGUgPSB0aGlzLiRzaW5nbGVJbnB1dHMuZmlsdGVyKCBcIjpjaGVja2VkXCIgKS52YWwoKTtcblxuXHRcdFx0XHRpZiggZGF0YS5tb2RlID09PSBcInNwZWNpZmljXCIgKSB7XG5cdFx0XHRcdFx0ZGF0YVsgXCJ0YXJnZXQteWVhclwiIF0gPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPXNpbmdsZS15ZWFyXVwiICkudmFsKCk7XG5cdFx0XHRcdFx0ZGF0YS50b2xlcmFuY2UgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPXNpbmdsZS10b2xlcmFuY2VdXCIgKS52YWwoKTtcblx0XHRcdFx0fSBlbHNlIGlmKCBkYXRhLm1vZGUgPT09IFwibGF0ZXN0XCIgKSB7XG5cdFx0XHRcdFx0ZGF0YVsgXCJtYXhpbXVtLWFnZVwiIF0gPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPXNpbmdsZS1tYXhpbXVtLWFnZV1cIiApLnZhbCgpO1xuXHRcdFx0XHR9XG5cblxuXHRcdFx0fSBlbHNlIGlmKCBkYXRhLnBlcmlvZCA9PT0gXCJhbGxcIiApIHtcblxuXHRcdFx0XHRkYXRhLm1vZGUgPSB0aGlzLiRhbGxJbnB1dHMuZmlsdGVyKCBcIjpjaGVja2VkXCIgKS52YWwoKTtcblxuXHRcdFx0XHRpZiggZGF0YS5tb2RlID09PSBcImNsb3Nlc3RcIiApIHtcblx0XHRcdFx0XHRkYXRhLnRvbGVyYW5jZSA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9YWxsLXRvbGVyYW5jZV1cIiApLnZhbCgpO1xuXHRcdFx0XHR9IGVsc2UgaWYoIGRhdGEubW9kZSA9PT0gXCJsYXRlc3RcIiApIHtcblx0XHRcdFx0XHRkYXRhWyBcIm1heGltdW0tYWdlXCIgXSA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9YWxsLW1heGltdW0tYWdlXVwiICkudmFsKCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIudHJpZ2dlciggXCJkaW1lbnNpb24tc2V0dGluZy11cGRhdGVcIiwgZGF0YSApO1xuXG5cdFx0fSxcblxuXHRcdG9uQ2FuY2VsQnRuOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdHRoaXMuaGlkZSgpO1xuXG5cdFx0fVxuXG5cdH07XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVmlld3MuVUkuU2V0dGluZ3NWYXJQb3B1cDtcblxufSkoKTtcbiIsIjsoIGZ1bmN0aW9uKCkge1xuXG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBBcHAgPSByZXF1aXJlKCBcIi4vLi4vLi4vbmFtZXNwYWNlcy5qc1wiICk7XG5cdFxuXHR2YXIgdGhhdDtcblxuXHRBcHAuVmlld3MuVUkuVmFyaWFibGVTZWxlY3RzID0gZnVuY3Rpb24oKSB7XG5cblx0XHR0aGF0ID0gdGhpcztcblx0XHR0aGlzLiRkaXYgPSBudWxsO1xuXG5cdH07XG5cblx0QXBwLlZpZXdzLlVJLlZhcmlhYmxlU2VsZWN0cy5wcm90b3R5cGUgPSB7XG5cblx0XHRpbml0OiBmdW5jdGlvbigpIHtcblxuXHRcdFx0dGhpcy4kZWwgPSAkKCBcIi5mb3JtLXZhcmlhYmxlLXNlbGVjdC13cmFwcGVyXCIgKTtcblx0XHRcdHRoaXMuJGNhdGVnb3J5V3JhcHBlciA9IHRoaXMuJGVsLmZpbmQoIFwiLmNhdGVnb3J5LXdyYXBwZXJcIiApO1xuXHRcdFx0dGhpcy4kY2F0ZWdvcnlTZWxlY3QgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPWNhdGVnb3J5LWlkXVwiICk7XG5cdFx0XHR0aGlzLiRzdWJjYXRlZ29yeVdyYXBwZXIgPSB0aGlzLiRlbC5maW5kKCBcIi5zdWJjYXRlZ29yeS13cmFwcGVyXCIgKTtcblx0XHRcdHRoaXMuJHN1YmNhdGVnb3J5U2VsZWN0ID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT1zdWJjYXRlZ29yeS1pZF1cIiApO1xuXHRcdFx0dGhpcy4kdmFyaWFibGVXcmFwcGVyID0gdGhpcy4kZWwuZmluZCggXCIudmFyaWFibGUtd3JhcHBlclwiICk7XG5cdFx0XHR0aGlzLiRjaGFydFZhcmlhYmxlID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT1jaGFydC12YXJpYWJsZV1cIiApO1xuXHRcdFx0XG5cdFx0XHR0aGlzLiRjYXRlZ29yeVNlbGVjdC5vbiggXCJjaGFuZ2VcIiwgJC5wcm94eSggdGhpcy5vbkNhdGVnb3J5Q2hhbmdlLCB0aGlzICkgKTtcblx0XHRcdHRoaXMuJHN1YmNhdGVnb3J5U2VsZWN0Lm9uKCBcImNoYW5nZVwiLCAkLnByb3h5KCB0aGlzLm9uU3ViQ2F0ZWdvcnlDaGFuZ2UsIHRoaXMgKSApO1xuXG5cdFx0XHR0aGlzLiRzdWJjYXRlZ29yeVdyYXBwZXIuaGlkZSgpO1xuXHRcdFx0dGhpcy4kdmFyaWFibGVXcmFwcGVyLmhpZGUoKTtcblxuXHRcdH0sXG5cblx0XHRvbkNhdGVnb3J5Q2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0XG5cdFx0XHR2YXIgJGlucHV0ID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKTtcblx0XHRcdGlmKCAkaW5wdXQudmFsKCkgIT0gXCJcIiApIHtcblx0XHRcdFx0dGhpcy4kc3ViY2F0ZWdvcnlXcmFwcGVyLnNob3coKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuJHN1YmNhdGVnb3J5V3JhcHBlci5oaWRlKCk7XG5cdFx0XHRcdHRoaXMuJHZhcmlhYmxlV3JhcHBlci5oaWRlKCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vZmlsdGVyIHN1YmNhdGVnb3JpZXMgc2VsZWN0XG5cdFx0XHR0aGlzLiRzdWJjYXRlZ29yeVNlbGVjdC5maW5kKCBcIm9wdGlvblwiICkuaGlkZSgpO1xuXHRcdFx0dGhpcy4kc3ViY2F0ZWdvcnlTZWxlY3QuZmluZCggXCJvcHRpb25bZGF0YS1jYXRlZ29yeS1pZD1cIiArICRpbnB1dC52YWwoKSArIFwiXVwiICkuc2hvdygpO1xuXG5cdFx0fSxcblxuXHRcdG9uU3ViQ2F0ZWdvcnlDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdHZhciAkaW5wdXQgPSAkKCBldnQuY3VycmVudFRhcmdldCApO1xuXHRcdFx0aWYoICRpbnB1dC52YWwoKSAhPSBcIlwiICkge1xuXHRcdFx0XHR0aGlzLiR2YXJpYWJsZVdyYXBwZXIuc2hvdygpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy4kdmFyaWFibGVXcmFwcGVyLmhpZGUoKTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0Ly9maWx0ZXIgc3ViY2F0ZWdvcmllcyBzZWxlY3Rcblx0XHRcdHRoaXMuJGNoYXJ0VmFyaWFibGUuZmluZCggXCJvcHRpb246bm90KDpkaXNhYmxlZClcIiApLmhpZGUoKTtcblx0XHRcdHRoaXMuJGNoYXJ0VmFyaWFibGUuZmluZCggXCJvcHRpb25bZGF0YS1zdWJjYXRlZ29yeS1pZD1cIiArICRpbnB1dC52YWwoKSArIFwiXVwiICkuc2hvdygpO1xuXG5cdFx0fVxuXG5cdH07XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVmlld3MuVUkuVmFyaWFibGVTZWxlY3RzO1xuXG59KSgpO1xuIl19
