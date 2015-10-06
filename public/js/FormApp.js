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

					//if stacked area chart
					if( chartType === "3" ) {
						that.chart.stacked.dispatch.on( "areaMouseover", function( evt ) {
							that.legend.highlightPoint( evt );
						} );
						that.chart.stacked.dispatch.on( "areaMouseout", function( evt ) {
							that.legend.clearHighlight();
						} );
					}


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

				//special styling for stacked area chart legend
				if( chartType === "3" ) {
					container.selectAll('g.nv-custom-legend').classed( "transparent", true );
				}
				
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9sYXJhdmVsLWVsaXhpci1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC9BcHAuVXRpbHMuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC9Gb3JtQXBwLmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvY29sbGVjdGlvbnMvQXBwLkNvbGxlY3Rpb25zLkF2YWlsYWJsZUVudGl0aWVzQ29sbGVjdGlvbi5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL2NvbGxlY3Rpb25zL0FwcC5Db2xsZWN0aW9ucy5DaGFydFZhcmlhYmxlc0NvbGxlY3Rpb24uanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC9jb2xsZWN0aW9ucy9BcHAuQ29sbGVjdGlvbnMuU2VhcmNoRGF0YUNvbGxlY3Rpb24uanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC9tb2RlbHMvQXBwLk1vZGVscy5BdmFpbGFibGVUaW1lTW9kZWwuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC9tb2RlbHMvQXBwLk1vZGVscy5DaGFydERhdGFNb2RlbC5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL21vZGVscy9BcHAuTW9kZWxzLkNoYXJ0RGltZW5zaW9uc01vZGVsLmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvbW9kZWxzL0FwcC5Nb2RlbHMuQ2hhcnRNb2RlbC5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL21vZGVscy9BcHAuTW9kZWxzLkNoYXJ0VmFyaWFibGVNb2RlbC5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL21vZGVscy9BcHAuTW9kZWxzLkVudGl0eU1vZGVsLmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvbmFtZXNwYWNlcy5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL0FwcC5WaWV3cy5DaGFydFZpZXcuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy9BcHAuVmlld3MuRm9ybS5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL0FwcC5WaWV3cy5Gb3JtVmlldy5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL2NoYXJ0L0FwcC5WaWV3cy5DaGFydC5DaGFydFRhYi5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL2NoYXJ0L0FwcC5WaWV3cy5DaGFydC5EYXRhVGFiLmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvY2hhcnQvQXBwLlZpZXdzLkNoYXJ0LkhlYWRlci5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL2NoYXJ0L0FwcC5WaWV3cy5DaGFydC5MZWdlbmQuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy9jaGFydC9BcHAuVmlld3MuQ2hhcnQuTWFwVGFiLmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvY2hhcnQvQXBwLlZpZXdzLkNoYXJ0LlNjYWxlU2VsZWN0b3JzLmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvY2hhcnQvQXBwLlZpZXdzLkNoYXJ0LlNvdXJjZXNUYWIuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy9jaGFydC9tYXAvQXBwLlZpZXdzLkNoYXJ0Lk1hcC5MZWdlbmQuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy9jaGFydC9tYXAvQXBwLlZpZXdzLkNoYXJ0Lk1hcC5NYXBDb250cm9scy5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL2Zvcm0vQXBwLlZpZXdzLkZvcm0uQXhpc1RhYlZpZXcuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy9mb3JtL0FwcC5WaWV3cy5Gb3JtLkJhc2ljVGFiVmlldy5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL2Zvcm0vQXBwLlZpZXdzLkZvcm0uRGVzY3JpcHRpb25UYWJWaWV3LmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvZm9ybS9BcHAuVmlld3MuRm9ybS5FeHBvcnRUYWJWaWV3LmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvZm9ybS9BcHAuVmlld3MuRm9ybS5NYXBUYWJWaWV3LmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvZm9ybS9BcHAuVmlld3MuRm9ybS5TdHlsaW5nVGFiVmlldy5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL2Zvcm0vYmFzaWNUYWIvQXBwLlZpZXdzLkZvcm0uQ2hhcnRUeXBlU2VjdGlvblZpZXcuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy9mb3JtL2RhdGFUYWIvQXBwLlZpZXdzLkZvcm0uQWRkRGF0YVNlY3Rpb25WaWV3LmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvZm9ybS9kYXRhVGFiL0FwcC5WaWV3cy5Gb3JtLkRpbWVuc2lvbnNTZWN0aW9uVmlldy5qcyIsInJlc291cmNlcy9hc3NldHMvanMvYXBwL3ZpZXdzL2Zvcm0vZGF0YVRhYi9BcHAuVmlld3MuRm9ybS5FbnRpdGllc1NlY3Rpb25WaWV3LmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvZm9ybS9kYXRhVGFiL0FwcC5WaWV3cy5Gb3JtLlNlbGVjdGVkQ291bnRyaWVzU2VjdGlvblZpZXcuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy9mb3JtL2RhdGFUYWIvQXBwLlZpZXdzLkZvcm0uVGltZVNlY3Rpb25WaWV3LmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvdWkvQXBwLlZpZXdzLlVJLkNvbG9yUGlja2VyLmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvdWkvQXBwLlZpZXdzLlVJLlNlbGVjdFZhclBvcHVwLmpzIiwicmVzb3VyY2VzL2Fzc2V0cy9qcy9hcHAvdmlld3MvdWkvQXBwLlZpZXdzLlVJLlNldHRpbmdzVmFyUG9wdXAuanMiLCJyZXNvdXJjZXMvYXNzZXRzL2pzL2FwcC92aWV3cy91aS9BcHAuVmlld3MuVUkuVmFyaWFibGVTZWxlY3RzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdk1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL2FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RtQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuZ0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5VkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9HQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM01BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdlJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDck9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIjsoIGZ1bmN0aW9uKCkge1xuXG5cdFwidXNlIHN0cmljdFwiO1xuXHRcblx0dmFyIEFwcCA9IHJlcXVpcmUoIFwiLi9uYW1lc3BhY2VzLmpzXCIgKTtcblxuXHRBcHAuVXRpbHMubWFwRGF0YSA9IGZ1bmN0aW9uKCByYXdEYXRhLCB0cmFuc3Bvc2VkICkge1xuXG5cdFx0dmFyIGRhdGEgPSBbXSxcblx0XHRcdGRhdGFCeUlkID0gW10sXG5cdFx0XHRjb3VudHJ5SW5kZXggPSAxO1xuXG5cdFx0Ly9kbyB3ZSBoYXZlIGVudGl0aWVzIGluIHJvd3MgYW5kIHRpbWVzIGluIGNvbHVtbnM/XHRcblx0XHRpZiggIXRyYW5zcG9zZWQgKSB7XG5cdFx0XHQvL25vLCB3ZSBoYXZlIHRvIHN3aXRjaCByb3dzIGFuZCBjb2x1bW5zXG5cdFx0XHRyYXdEYXRhID0gQXBwLlV0aWxzLnRyYW5zcG9zZSggcmF3RGF0YSApO1xuXHRcdH1cblx0XHRcblx0XHQvL2V4dHJhY3QgdGltZSBjb2x1bW5cblx0XHR2YXIgdGltZUFyciA9IHJhd0RhdGEuc2hpZnQoKTtcblx0XHQvL2dldCByaWQgb2YgZmlyc3QgaXRlbSAobGFiZWwgb2YgdGltZSBjb2x1bW4pIFxuXHRcdHRpbWVBcnIuc2hpZnQoKTtcblx0XG5cdFx0Zm9yKCB2YXIgaSA9IDAsIGxlbiA9IHJhd0RhdGEubGVuZ3RoOyBpIDwgbGVuOyBpKysgKSB7XG5cblx0XHRcdHZhciBzaW5nbGVSb3cgPSByYXdEYXRhWyBpIF0sXG5cdFx0XHRcdGNvbE5hbWUgPSBzaW5nbGVSb3cuc2hpZnQoKTtcblx0XHRcdFx0XG5cdFx0XHQvL29tbWl0IHJvd3Mgd2l0aCBubyBjb2xObWFlXG5cdFx0XHRpZiggY29sTmFtZSApIHtcblx0XHRcdFx0dmFyIHNpbmdsZURhdGEgPSBbXTtcblx0XHRcdFx0Xy5lYWNoKCBzaW5nbGVSb3csIGZ1bmN0aW9uKCB2YWx1ZSwgaSApIHtcblx0XHRcdFx0XHQvL2NoZWNrIHdlIGhhdmUgdmFsdWVcblx0XHRcdFx0XHRpZiggdmFsdWUgIT09IFwiXCIgKSB7XG5cdFx0XHRcdFx0XHRzaW5nbGVEYXRhLnB1c2goIHsgeDogdGltZUFycltpXSwgeTogKCAhaXNOYU4oIHZhbHVlICkgKT8gK3ZhbHVlOiB2YWx1ZSB9ICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9ICk7XG5cblx0XHRcdFx0Ly9jb25zdHJ1Y3QgZW50aXR5IG9ialxuXHRcdFx0XHR2YXJcdGVudGl0eU9iaiA9IHtcblx0XHRcdFx0XHRpZDogaSxcblx0XHRcdFx0XHRrZXk6IGNvbE5hbWUsXG5cdFx0XHRcdFx0dmFsdWVzOiBzaW5nbGVEYXRhXG5cdFx0XHRcdH07XG5cdFx0XHRcdGRhdGEucHVzaCggZW50aXR5T2JqICk7XG5cdFx0XHR9XG5cblx0XHR9XG5cblx0XHRyZXR1cm4gZGF0YTtcblxuXHR9LFxuXG5cdEFwcC5VdGlscy5tYXBTaW5nbGVWYXJpYW50RGF0YSA9IGZ1bmN0aW9uKCByYXdEYXRhLCB2YXJpYWJsZU5hbWUgKSB7XG5cblx0XHR2YXIgdmFyaWFibGUgPSB7XG5cdFx0XHRuYW1lOiB2YXJpYWJsZU5hbWUsXG5cdFx0XHR2YWx1ZXM6IEFwcC5VdGlscy5tYXBEYXRhKCByYXdEYXRhLCB0cnVlIClcblx0XHR9O1xuXHRcdHJldHVybiBbdmFyaWFibGVdO1xuXG5cdH0sXG5cblx0LypBcHAuVXRpbHMubWFwTXVsdGlWYXJpYW50RGF0YSA9IGZ1bmN0aW9uKCByYXdEYXRhLCBlbnRpdHlOYW1lICkge1xuXHRcdFxuXHRcdC8vdHJhbnNmb3JtIG11bHRpdmFyaWFudCBpbnRvIHN0YW5kYXJkIGZvcm1hdCAoIHRpbWUsIGVudGl0eSApXG5cdFx0dmFyIHZhcmlhYmxlcyA9IFtdLFxuXHRcdFx0dHJhbnNwb3NlZCA9IHJhd0RhdGEsLy9BcHAuVXRpbHMudHJhbnNwb3NlKCByYXdEYXRhICksXG5cdFx0XHR0aW1lQXJyID0gdHJhbnNwb3NlZC5zaGlmdCgpO1xuXG5cdFx0Ly9nZXQgcmlkIG9mIGZpcnN0IGl0ZW0gKGxhYmVsIG9mIHRpbWUgY29sdW1uKSBcblx0XHQvL3RpbWVBcnIuc2hpZnQoKTtcblx0XHRcblx0XHRfLmVhY2goIHRyYW5zcG9zZWQsIGZ1bmN0aW9uKCB2YWx1ZXMsIGtleSwgbGlzdCApIHtcblxuXHRcdFx0Ly9nZXQgdmFyaWFibGUgbmFtZSBmcm9tIGZpcnN0IGNlbGwgb2YgY29sdW1uc1xuXHRcdFx0dmFyIHZhcmlhYmxlTmFtZSA9IHZhbHVlcy5zaGlmdCgpO1xuXHRcdFx0Ly9hZGQgZW50aXR5IG5hbWUgYXMgZmlyc3QgY2VsbFxuXHRcdFx0dmFsdWVzLnVuc2hpZnQoIGVudGl0eU5hbWUgKTtcblx0XHRcdC8vY29uc3RydWN0IGFycmF5IGZvciBtYXBwaW5nLCBuZWVkIHRvIGRlZXAgY29weSB0aW1lQXJyXG5cdFx0XHR2YXIgbG9jYWxUaW1lQXJyID0gJC5leHRlbmQoIHRydWUsIFtdLCB0aW1lQXJyKTtcblx0XHRcdHZhciBkYXRhVG9NYXAgPSBbIGxvY2FsVGltZUFyciwgdmFsdWVzIF07XG5cdFx0XHQvL2NvbnN0cnVjdCBvYmplY3Rcblx0XHRcdHZhciB2YXJpYWJsZSA9IHtcblx0XHRcdFx0bmFtZTogdmFyaWFibGVOYW1lLFxuXHRcdFx0XHR2YWx1ZXM6IEFwcC5VdGlscy5tYXBEYXRhKCBkYXRhVG9NYXAsIHRydWUgKVxuXHRcdFx0fTtcblx0XHRcdHZhcmlhYmxlcy5wdXNoKCB2YXJpYWJsZSApO1xuXG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIHZhcmlhYmxlcztcblxuXHR9LCovXG5cblx0QXBwLlV0aWxzLm1hcE11bHRpVmFyaWFudERhdGEgPSBmdW5jdGlvbiggcmF3RGF0YSApIHtcblx0XHRcblx0XHR2YXIgdmFyaWFibGVzID0gW10sXG5cdFx0XHR0cmFuc3Bvc2VkID0gcmF3RGF0YSxcblx0XHRcdGhlYWRlckFyciA9IHRyYW5zcG9zZWQuc2hpZnQoKTtcblxuXHRcdC8vZ2V0IHJpZCBvZiBlbnRpdHkgYW5kIHllYXIgY29sdW1uIG5hbWVcblx0XHRoZWFkZXJBcnIgPSBoZWFkZXJBcnIuc2xpY2UoIDIgKTtcblxuXHRcdHZhciB2YXJQZXJSb3dEYXRhID0gQXBwLlV0aWxzLnRyYW5zcG9zZSggdHJhbnNwb3NlZCApLFxuXHRcdFx0ZW50aXRpZXNSb3cgPSB2YXJQZXJSb3dEYXRhLnNoaWZ0KCksXG5cdFx0XHR0aW1lc1JvdyA9IHZhclBlclJvd0RhdGEuc2hpZnQoKTtcblxuXHRcdF8uZWFjaCggdmFyUGVyUm93RGF0YSwgZnVuY3Rpb24oIHZhbHVlcywgdmFySW5kZXggKSB7XG5cdFx0XHRcblx0XHRcdHZhciBlbnRpdGllcyA9IHt9O1xuXHRcdFx0Ly9pdGVyYXRlIHRocm91Z2ggYWxsIHZhbHVlcyBmb3IgZ2l2ZW4gdmFyaWFibGVcblx0XHRcdF8uZWFjaCggdmFsdWVzLCBmdW5jdGlvbiggdmFsdWUsIGtleSApIHtcblx0XHRcdFx0dmFyIGVudGl0eSA9IGVudGl0aWVzUm93WyBrZXkgXSxcblx0XHRcdFx0XHR0aW1lID0gdGltZXNSb3dbIGtleSBdO1xuXHRcdFx0XHRpZiggZW50aXR5ICYmIHRpbWUgKSB7XG5cdFx0XHRcdFx0Ly9kbyBoYXZlIGFscmVhZHkgZW50aXR5IGRlZmluZWQ/XG5cdFx0XHRcdFx0aWYoICFlbnRpdGllc1sgZW50aXR5IF0gKSB7XG5cdFx0XHRcdFx0XHRlbnRpdGllc1sgZW50aXR5IF0gPSB7XG5cdFx0XHRcdFx0XHRcdGlkOiBrZXksXG5cdFx0XHRcdFx0XHRcdGtleTogZW50aXR5LFxuXHRcdFx0XHRcdFx0XHR2YWx1ZXM6IFtdXG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbnRpdGllc1sgZW50aXR5IF0udmFsdWVzLnB1c2goIHsgeDogdGltZSwgeTogKCAhaXNOYU4oIHZhbHVlICkgKT8gK3ZhbHVlOiB2YWx1ZSB9ICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblxuXHRcdFx0Ly9oYXZlIGRhdGEgZm9yIGFsbCBlbnRpdGllcywganVzdCBjb252ZXJ0IHRoZW0gdG8gYXJyYXlcblx0XHRcdHZhciB2YXJWYWx1ZXMgPSBfLm1hcCggZW50aXRpZXMsIGZ1bmN0aW9uKCB2YWx1ZSApIHsgcmV0dXJuIHZhbHVlOyB9ICk7XG5cdFx0XHRcblx0XHRcdHZhciB2YXJpYWJsZSA9IHtcblx0XHRcdFx0bmFtZTogaGVhZGVyQXJyWyB2YXJJbmRleCBdLFxuXHRcdFx0XHR2YWx1ZXM6IHZhclZhbHVlc1xuXHRcdFx0fTtcblx0XHRcdHZhcmlhYmxlcy5wdXNoKCB2YXJpYWJsZSApO1xuXG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIHZhcmlhYmxlcztcblxuXHR9LFxuXG5cblx0QXBwLlV0aWxzLnRyYW5zcG9zZSA9IGZ1bmN0aW9uKCBhcnIgKSB7XG5cdFx0dmFyIGtleXMgPSBfLmtleXMoIGFyclswXSApO1xuXHRcdHJldHVybiBfLm1hcCgga2V5cywgZnVuY3Rpb24gKGMpIHtcblx0XHRcdHJldHVybiBfLm1hcCggYXJyLCBmdW5jdGlvbiggciApIHtcblx0XHRcdFx0cmV0dXJuIHJbY107XG5cdFx0XHR9ICk7XG5cdFx0fSk7XG5cdH0sXG5cblx0QXBwLlV0aWxzLnRyYW5zZm9ybSA9IGZ1bmN0aW9uKCkge1xuXG5cdFx0Y29uc29sZS5sb2coIFwiYXBwLnV0aWxzLnRyYW5zZm9ybVwiICk7XG5cblx0fSxcblxuXHRBcHAuVXRpbHMuZW5jb2RlU3ZnVG9QbmcgPSBmdW5jdGlvbiggaHRtbCApIHtcblxuXHRcdGNvbnNvbGUubG9nKCBodG1sICk7XG5cdFx0dmFyIGltZ1NyYyA9IFwiZGF0YTppbWFnZS9zdmcreG1sO2Jhc2U2NCxcIiArIGJ0b2EoaHRtbCksXG5cdFx0XHRpbWcgPSBcIjxpbWcgc3JjPSdcIiArIGltZ1NyYyArIFwiJz5cIjsgXG5cdFx0XG5cdFx0Ly9kMy5zZWxlY3QoIFwiI3N2Z2RhdGF1cmxcIiApLmh0bWwoIGltZyApO1xuXG5cdFx0JCggXCIuY2hhcnQtd3JhcHBlci1pbm5lclwiICkuaHRtbCggaW1nICk7XG5cblx0XHQvKnZhciBjYW52YXMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCBcImNhbnZhc1wiICksXG5cdFx0XHRjb250ZXh0ID0gY2FudmFzLmdldENvbnRleHQoIFwiMmRcIiApO1xuXG5cdFx0dmFyIGltYWdlID0gbmV3IEltYWdlO1xuXHRcdGltYWdlLnNyYyA9IGltZ3NyYztcblx0XHRpbWFnZS5vbmxvYWQgPSBmdW5jdGlvbigpIHtcblx0XHRcdGNvbnRleHQuZHJhd0ltYWdlKGltYWdlLCAwLCAwKTtcblx0XHRcdHZhciBjYW52YXNEYXRhID0gY2FudmFzLnRvRGF0YVVSTCggXCJpbWFnZS9wbmdcIiApO1xuXHRcdFx0dmFyIHBuZ0ltZyA9ICc8aW1nIHNyYz1cIicgKyBjYW52YXNEYXRhICsgJ1wiPic7IFxuXHRcdFx0ZDMuc2VsZWN0KFwiI3BuZ2RhdGF1cmxcIikuaHRtbChwbmdpbWcpO1xuXG5cdFx0XHR2YXIgYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJhXCIpO1xuXHRcdFx0YS5kb3dubG9hZCA9IFwic2FtcGxlLnBuZ1wiO1xuXHRcdFx0YS5ocmVmID0gY2FudmFzZGF0YTtcblx0XHRcdGEuY2xpY2soKTtcblx0XHR9OyovXG5cblxuXHR9O1xuXG5cdC8qKlxuXHQqXHRUSU1FIFJFTEFURUQgRlVOQ1RJT05TXG5cdCoqL1xuXG5cdEFwcC5VdGlscy5udGggPSBmdW5jdGlvbiAoIGQgKSB7XG5cdFx0Ly9jb252ZXIgdG8gbnVtYmVyIGp1c3QgaW4gY2FzZVxuXHRcdGQgPSArZDtcblx0XHRpZiggZCA+IDMgJiYgZCA8IDIxICkgcmV0dXJuICd0aCc7IC8vIHRoYW5rcyBrZW5uZWJlY1xuXHRcdHN3aXRjaCggZCAlIDEwICkge1xuXHRcdFx0Y2FzZSAxOiAgcmV0dXJuIFwic3RcIjtcblx0XHRcdGNhc2UgMjogIHJldHVybiBcIm5kXCI7XG5cdFx0XHRjYXNlIDM6ICByZXR1cm4gXCJyZFwiO1xuXHRcdFx0ZGVmYXVsdDogcmV0dXJuIFwidGhcIjtcblx0XHR9XG5cdH1cblxuXHRBcHAuVXRpbHMuY2VudHVyeVN0cmluZyA9IGZ1bmN0aW9uICggZCApIHtcblx0XHQvL2NvbnZlciB0byBudW1iZXIganVzdCBpbiBjYXNlXG5cdFx0ZCA9ICtkO1xuXHRcdFxuXHRcdHZhciBjZW50dXJ5TnVtID0gTWF0aC5mbG9vcihkIC8gMTAwKSArIDEsXG5cdFx0XHRjZW50dXJ5U3RyaW5nID0gY2VudHVyeU51bS50b1N0cmluZygpLFxuXHRcdFx0bnRoID0gQXBwLlV0aWxzLm50aCggY2VudHVyeVN0cmluZyApO1xuXG5cdFx0cmV0dXJuIGNlbnR1cnlTdHJpbmcgKyBudGggKyBcIiBjZW50dXJ5XCI7XG5cdH1cblxuXHRBcHAuVXRpbHMuYWRkWmVyb3MgPSBmdW5jdGlvbiAoIHZhbHVlICkge1xuXG5cdFx0dmFsdWUgPSB2YWx1ZS50b1N0cmluZygpO1xuXHRcdGlmKCB2YWx1ZS5sZW5ndGggPCA0ICkge1xuXHRcdFx0Ly9pbnNlcnQgbWlzc2luZyB6ZXJvc1xuXHRcdFx0dmFyIHZhbHVlTGVuID0gdmFsdWUubGVuZ3RoO1xuXHRcdFx0Zm9yKCB2YXIgeSA9IDA7IHkgPCA0IC0gdmFsdWVMZW47IHkrKyApIHtcblx0XHRcdFx0dmFsdWUgPSBcIjBcIiArIHZhbHVlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0XG5cdH1cblxuXHRBcHAuVXRpbHMucm91bmRUaW1lID0gZnVuY3Rpb24oIG1vbWVudFRpbWUgKSB7XG5cblx0XHRpZiggdHlwZW9mIG1vbWVudFRpbWUuZm9ybWF0ID09PSBcImZ1bmN0aW9uXCIgKSB7XG5cdFx0XHQvL3VzZSBzaG9ydCBmb3JtYXQgbXlzcWwgZXhwZWN0cyAtIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMTA1MzkxNTQvaW5zZXJ0LWludG8tZGItZGF0ZXRpbWUtc3RyaW5nXG5cdFx0XHRyZXR1cm4gbW9tZW50VGltZS5mb3JtYXQoIFwiWVlZWS1NTS1ERFwiICk7XG5cdFx0fVxuXHRcdHJldHVybiBtb21lbnRUaW1lO1xuXG5cdH1cblxuXHQvKiogXG5cdCogRk9STSBIRUxQRVJcblx0KiovXG5cdEFwcC5VdGlscy5Gb3JtSGVscGVyLnZhbGlkYXRlID0gZnVuY3Rpb24oICRmb3JtICkge1xuXHRcdFxuXHRcdHZhciBtaXNzaW5nRXJyb3JMYWJlbCA9IFwiUGxlYXNlIGVudGVyIHZhbHVlLlwiLFxuXHRcdFx0ZW1haWxFcnJvckxhYmVsID0gIFwiUGxlYXNlIGVudGVyIHZhbGlkZSBlbWFpbC5cIixcblx0XHRcdG51bWJlckVycm9yTGFiZWwgPSBcIlBsZWFzZSBlbnRlIHZhbGlkIG51bWJlci5cIjsgXG5cblx0XHR2YXIgaW52YWxpZElucHV0cyA9IFtdO1xuXHRcdFxuXHRcdC8vZ2F0aGVyIGFsbCBmaWVsZHMgcmVxdWlyaW5nIHZhbGlkYXRpb25cblx0XHR2YXIgJHJlcXVpcmVkSW5wdXRzID0gJGZvcm0uZmluZCggXCIucmVxdWlyZWRcIiApO1xuXHRcdGlmKCAkcmVxdWlyZWRJbnB1dHMubGVuZ3RoICkge1xuXG5cdFx0XHQkLmVhY2goICRyZXF1aXJlZElucHV0cywgZnVuY3Rpb24oIGksIHYgKSB7XG5cblx0XHRcdFx0dmFyICRpbnB1dCA9ICQoIHRoaXMgKTtcblx0XHRcdFx0XG5cdFx0XHRcdC8vZmlsdGVyIG9ubHkgdmlzaWJsZVxuXHRcdFx0XHRpZiggISRpbnB1dC5pcyggXCI6dmlzaWJsZVwiICkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly9jaGVjayBmb3IgZW1wdHlcblx0XHRcdFx0dmFyIGlucHV0VmFsaWQgPSBBcHAuVXRpbHMuRm9ybUhlbHBlci52YWxpZGF0ZVJlcXVpcmVkRmllbGQoICRpbnB1dCApO1xuXHRcdFx0XHRpZiggIWlucHV0VmFsaWQgKSB7XG5cdFx0XHRcdFxuXHRcdFx0XHRcdEFwcC5VdGlscy5Gb3JtSGVscGVyLmFkZEVycm9yKCAkaW5wdXQsIG1pc3NpbmdFcnJvckxhYmVsICk7XG5cdFx0XHRcdFx0aW52YWxpZElucHV0cy5wdXNoKCAkaW5wdXQgKTtcblx0XHRcdFx0XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0QXBwLlV0aWxzLkZvcm1IZWxwZXIucmVtb3ZlRXJyb3IoICRpbnB1dCApO1xuXG5cdFx0XHRcdFx0Ly9jaGVjayBmb3IgZGlnaXRcblx0XHRcdFx0XHRpZiggJGlucHV0Lmhhc0NsYXNzKCBcInJlcXVpcmVkLW51bWJlclwiICkgKSB7XG5cdFx0XHRcdFx0XHRpbnB1dFZhbGlkID0gQXBwLlV0aWxzLkZvcm1IZWxwZXIudmFsaWRhdGVOdW1iZXJGaWVsZCggJGlucHV0ICk7XG5cdFx0XHRcdFx0XHRpZiggIWlucHV0VmFsaWQgKSB7XG5cdFx0XHRcdFx0XHRcdEFwcC5VdGlscy5Gb3JtSGVscGVyLmFkZEVycm9yKCAkaW5wdXQsIG51bWJlckVycm9yTGFiZWwgKTtcblx0XHRcdFx0XHRcdFx0aW52YWxpZElucHV0cy5wdXNoKCAkaW5wdXQgKTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdEFwcC5VdGlscy5Gb3JtSGVscGVyLnJlbW92ZUVycm9yKCAkaW5wdXQgKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvL2NoZWNrIGZvciBtYWlsXG5cdFx0XHRcdFx0aWYoICRpbnB1dC5oYXNDbGFzcyggXCJyZXF1aXJlZC1tYWlsXCIgKSApIHtcblx0XHRcdFx0XHRcdGlucHV0VmFsaWQgPSBGb3JtSGVscGVyLnZhbGlkYXRlRW1haWxGaWVsZCggJGlucHV0ICk7XG5cdFx0XHRcdFx0XHRpZiggIWlucHV0VmFsaWQgKSB7XG5cdFx0XHRcdFx0XHRcdEFwcC5VdGlscy5Gb3JtSGVscGVyLmFkZEVycm9yKCAkaW5wdXQsIGVtYWlsRXJyb3JMYWJlbCApO1xuXHRcdFx0XHRcdFx0XHRpbnZhbGlkSW5wdXRzLnB1c2goICRpbnB1dCApO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0QXBwLlV0aWxzLkZvcm1IZWxwZXIucmVtb3ZlRXJyb3IoICRpbnB1dCApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vY2hlY2sgZm9yIGNoZWNrYm94XG5cdFx0XHRcdFx0aWYoICRpbnB1dC5oYXNDbGFzcyggXCJyZXF1aXJlZC1jaGVja2JveFwiICkgKSB7XG5cblx0XHRcdFx0XHRcdGlucHV0VmFsaWQgPSBGb3JtSGVscGVyLnZhbGlkYXRlQ2hlY2tib3goICRpbnB1dCApO1xuXHRcdFx0XHRcdFx0aWYoICFpbnB1dFZhbGlkICkge1xuXHRcdFx0XHRcdFx0XHRBcHAuVXRpbHMuRm9ybUhlbHBlci5hZGRFcnJvciggJGlucHV0LCBtaXNzaW5nRXJyb3JMYWJlbCApO1xuXHRcdFx0XHRcdFx0XHRpbnZhbGlkSW5wdXRzLnB1c2goICRpbnB1dCApO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0QXBwLlV0aWxzLkZvcm1IZWxwZXIucmVtb3ZlRXJyb3IoICRpbnB1dCApO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdH1cblx0XG5cdFx0XHR9ICk7XG5cblx0XHR9XG5cblxuXHRcdGlmKCBpbnZhbGlkSW5wdXRzLmxlbmd0aCApIHtcblxuXHRcdFx0Ly90YWtlIGZpcnN0IGVsZW1lbnQgYW5kIHNjcm9sbCB0byBpdFxuXHRcdFx0dmFyICRmaXJzdEludmFsaWRJbnB1dCA9IGludmFsaWRJbnB1dHNbMF07XG5cdFx0XHQkKCdodG1sLCBib2R5JykuYW5pbWF0ZSgge1xuXHRcdFx0XHRzY3JvbGxUb3A6ICRmaXJzdEludmFsaWRJbnB1dC5vZmZzZXQoKS50b3AgLSAyNVxuXHRcdFx0fSwgMjUwKTtcblxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7IFxuXG5cdH07XG5cblx0QXBwLlV0aWxzLkZvcm1IZWxwZXIudmFsaWRhdGVSZXF1aXJlZEZpZWxkID0gZnVuY3Rpb24oICRpbnB1dCApIHtcblxuXHRcdHJldHVybiAoICRpbnB1dC52YWwoKSA9PT0gXCJcIiApID8gZmFsc2UgOiB0cnVlO1xuXG5cdH07XG5cblx0QXBwLlV0aWxzLkZvcm1IZWxwZXIudmFsaWRhdGVFbWFpbEZpZWxkID0gZnVuY3Rpb24oICRpbnB1dCApIHtcblxuXHRcdHZhciBlbWFpbCA9ICRpbnB1dC52YWwoKTtcblx0XHR2YXIgcmVnZXggPSAvXihbXFx3LVxcLl0rQChbXFx3LV0rXFwuKStbXFx3LV17Miw2fSk/JC87XG5cdFx0cmV0dXJuIHJlZ2V4LnRlc3QoIGVtYWlsICk7XG5cblx0fTtcblxuXHRBcHAuVXRpbHMuRm9ybUhlbHBlci52YWxpZGF0ZU51bWJlckZpZWxkID0gZnVuY3Rpb24oICRpbnB1dCApIHtcblxuXHRcdHJldHVybiAoIGlzTmFOKCAkaW5wdXQudmFsKCkgKSApID8gZmFsc2UgOiB0cnVlO1xuXG5cdH07XG5cblx0QXBwLlV0aWxzLkZvcm1IZWxwZXIudmFsaWRhdGVDaGVja2JveCA9IGZ1bmN0aW9uKCAkaW5wdXQgKSB7XG5cblx0XHRyZXR1cm4gKCAkaW5wdXQuaXMoJzpjaGVja2VkJykgKSA/IHRydWUgOiBmYWxzZTtcblxuXHR9O1xuXG5cblx0QXBwLlV0aWxzLkZvcm1IZWxwZXIuYWRkRXJyb3IgPSBmdW5jdGlvbiggJGVsLCAkbXNnICkge1xuXG5cdFx0aWYoICRlbCApIHtcblx0XHRcdGlmKCAhJGVsLmhhc0NsYXNzKCBcImVycm9yXCIgKSApIHtcblx0XHRcdFx0JGVsLmFkZENsYXNzKCBcImVycm9yXCIgKTtcblx0XHRcdFx0JGVsLmJlZm9yZSggXCI8cCBjbGFzcz0nZXJyb3ItbGFiZWwnPlwiICsgJG1zZyArIFwiPC9wPlwiICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdH07XG5cblx0QXBwLlV0aWxzLkZvcm1IZWxwZXIucmVtb3ZlRXJyb3IgPSBmdW5jdGlvbiggJGVsICkge1xuXG5cdFx0aWYoICRlbCApIHtcblx0XHRcdCRlbC5yZW1vdmVDbGFzcyggXCJlcnJvclwiICk7XG5cdFx0XHR2YXIgJHBhcmVudCA9ICRlbC5wYXJlbnQoKTtcblx0XHRcdHZhciAkZXJyb3JMYWJlbCA9ICRwYXJlbnQuZmluZCggXCIuZXJyb3ItbGFiZWxcIiApO1xuXHRcdFx0aWYoICRlcnJvckxhYmVsLmxlbmd0aCApIHtcblx0XHRcdFx0JGVycm9yTGFiZWwucmVtb3ZlKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdFxuXHR9O1xuXG5cdEFwcC5VdGlscy53cmFwID0gZnVuY3Rpb24oICRlbCwgd2lkdGggKSB7XG5cdFx0XG5cdFx0Ly9nZXQgcmlkIG9mIHBvdGVudGlhbCB0c3BhbnMgYW5kIGdldCBwdXJlIGNvbnRlbnQgKGluY2x1ZGluZyBoeXBlcmxpbmtzKVxuXHRcdHZhciB0ZXh0Q29udGVudCA9IFwiXCIsXG5cdFx0XHQkdHNwYW5zID0gJGVsLmZpbmQoIFwidHNwYW5cIiApO1xuXHRcdGlmKCAkdHNwYW5zLmxlbmd0aCApIHtcblx0XHRcdCQuZWFjaCggJHRzcGFucywgZnVuY3Rpb24oIGksIHYgKSB7XG5cdFx0XHRcdGlmKCBpID4gMCApIHtcblx0XHRcdFx0XHR0ZXh0Q29udGVudCArPSBcIiBcIjtcblx0XHRcdFx0fVxuXHRcdFx0XHR0ZXh0Q29udGVudCArPSAkKHYpLnRleHQoKTtcblx0XHRcdH0gKTtcdFxuXHRcdH0gZWxzZSB7XG5cdFx0XHQvL2VsZW1lbnQgaGFzIG5vIHRzcGFucywgcG9zc2libHkgZmlyc3QgcnVuXG5cdFx0XHR0ZXh0Q29udGVudCA9ICRlbC50ZXh0KCk7XG5cdFx0fVxuXHRcdFxuXHRcdC8vYXBwZW5kIHRvIGVsZW1lbnRcblx0XHRpZiggdGV4dENvbnRlbnQgKSB7XG5cdFx0XHQkZWwudGV4dCggdGV4dENvbnRlbnQgKTtcblx0XHR9XG5cdFx0XG5cdFx0dmFyIHRleHQgPSBkMy5zZWxlY3QoICRlbC5zZWxlY3RvciApO1xuXHRcdHRleHQuZWFjaCggZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgdGV4dCA9IGQzLnNlbGVjdCh0aGlzKSxcblx0XHRcdFx0c3RyaW5nID0gJC50cmltKHRleHQudGV4dCgpKSxcblx0XHRcdFx0cmVnZXggPSAvXFxzKy8sXG5cdFx0XHRcdHdvcmRzID0gc3RyaW5nLnNwbGl0KHJlZ2V4KS5yZXZlcnNlKCk7XG5cblx0XHRcdHZhciB3b3JkLFxuXHRcdFx0XHRsaW5lID0gW10sXG5cdFx0XHRcdGxpbmVOdW1iZXIgPSAwLFxuXHRcdFx0XHRsaW5lSGVpZ2h0ID0gMS40LCAvLyBlbXNcblx0XHRcdFx0eSA9IHRleHQuYXR0cihcInlcIiksXG5cdFx0XHRcdGR5ID0gcGFyc2VGbG9hdCh0ZXh0LmF0dHIoXCJkeVwiKSksXG5cdFx0XHRcdHRzcGFuID0gdGV4dC50ZXh0KG51bGwpLmFwcGVuZChcInRzcGFuXCIpLmF0dHIoXCJ4XCIsIDApLmF0dHIoXCJ5XCIsIHkpLmF0dHIoXCJkeVwiLCBkeSArIFwiZW1cIik7XG5cdFx0XHRcblx0XHRcdHdoaWxlKCB3b3JkID0gd29yZHMucG9wKCkgKSB7XG5cdFx0XHRcdGxpbmUucHVzaCh3b3JkKTtcblx0XHRcdFx0dHNwYW4uaHRtbChsaW5lLmpvaW4oXCIgXCIpKTtcblx0XHRcdFx0aWYoIHRzcGFuLm5vZGUoKS5nZXRDb21wdXRlZFRleHRMZW5ndGgoKSA+IHdpZHRoICkge1xuXHRcdFx0XHRcdGxpbmUucG9wKCk7XG5cdFx0XHRcdFx0dHNwYW4udGV4dChsaW5lLmpvaW4oXCIgXCIpKTtcblx0XHRcdFx0XHRsaW5lID0gW3dvcmRdO1xuXHRcdFx0XHRcdHRzcGFuID0gdGV4dC5hcHBlbmQoXCJ0c3BhblwiKS5hdHRyKFwieFwiLCAwKS5hdHRyKFwieVwiLCB5KS5hdHRyKFwiZHlcIiwgKytsaW5lTnVtYmVyICogbGluZUhlaWdodCArIGR5ICsgXCJlbVwiKS50ZXh0KHdvcmQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHR9ICk7XG5cblx0XHRcblx0fTtcblxuXHQvKipcblx0KiBDb252ZXJ0IGEgc3RyaW5nIHRvIEhUTUwgZW50aXRpZXNcblx0Ki9cblx0QXBwLlV0aWxzLnRvSHRtbEVudGl0aWVzID0gZnVuY3Rpb24oc3RyaW5nKSB7XG5cdFx0cmV0dXJuIHN0cmluZy5yZXBsYWNlKC8uL2dtLCBmdW5jdGlvbihzKSB7XG5cdFx0XHRyZXR1cm4gXCImI1wiICsgcy5jaGFyQ29kZUF0KDApICsgXCI7XCI7XG5cdFx0fSk7XG5cdH07XG5cblx0LyoqXG5cdCAqIENyZWF0ZSBzdHJpbmcgZnJvbSBIVE1MIGVudGl0aWVzXG5cdCAqL1xuXHRBcHAuVXRpbHMuZnJvbUh0bWxFbnRpdGllcyA9IGZ1bmN0aW9uKHN0cmluZykge1xuXHRcdHJldHVybiAoc3RyaW5nK1wiXCIpLnJlcGxhY2UoLyYjXFxkKzsvZ20sZnVuY3Rpb24ocykge1xuXHRcdFx0cmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUocy5tYXRjaCgvXFxkKy9nbSlbMF0pO1xuXHRcdH0pXG5cdH07XG5cblx0QXBwLlV0aWxzLmdldFJhbmRvbUNvbG9yID0gZnVuY3Rpb24gKCkge1xuXHRcdHZhciBsZXR0ZXJzID0gJzAxMjM0NTY3ODlBQkNERUYnLnNwbGl0KCcnKTtcblx0XHR2YXIgY29sb3IgPSAnIyc7XG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCA2OyBpKysgKSB7XG5cdFx0XHRjb2xvciArPSBsZXR0ZXJzW01hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDE2KV07XG5cdFx0fVxuXHRcdHJldHVybiBjb2xvcjtcblx0fTtcblxuXHRBcHAuVXRpbHMuZ2V0UHJvcGVydHlCeVZhcmlhYmxlSWQgPSBmdW5jdGlvbiggbW9kZWwsIHZhcmlhYmxlSWQgKSB7XG5cblx0XHRpZiggbW9kZWwgJiYgbW9kZWwuZ2V0KCBcImNoYXJ0LWRpbWVuc2lvbnNcIiApICkge1xuXG5cdFx0XHR2YXIgY2hhcnREaW1lbnNpb25zU3RyaW5nID0gbW9kZWwuZ2V0KCBcImNoYXJ0LWRpbWVuc2lvbnNcIiApLFxuXHRcdFx0XHRjaGFydERpbWVuc2lvbnMgPSAkLnBhcnNlSlNPTiggY2hhcnREaW1lbnNpb25zU3RyaW5nICksXG5cdFx0XHRcdGRpbWVuc2lvbiA9IF8ud2hlcmUoIGNoYXJ0RGltZW5zaW9ucywgeyBcInZhcmlhYmxlSWRcIjogdmFyaWFibGVJZCB9ICk7XG5cdFx0XHRpZiggZGltZW5zaW9uICYmIGRpbWVuc2lvbi5sZW5ndGggKSB7XG5cdFx0XHRcdHJldHVybiBkaW1lbnNpb25bMF0ucHJvcGVydHk7XG5cdFx0XHR9XG5cblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XG5cdH07XG5cblxuXHRBcHAuVXRpbHMuY29udGVudEdlbmVyYXRvciA9IGZ1bmN0aW9uKCBkYXRhLCBpc01hcFBvcHVwICkge1xuXHRcdFx0XG5cdFx0Ly9zZXQgcG9wdXBcblx0XHR2YXIgdW5pdHNTdHJpbmcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwidW5pdHNcIiApLFxuXHRcdFx0Y2hhcnRUeXBlID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LXR5cGVcIiApLFxuXHRcdFx0dW5pdHMgPSAoICEkLmlzRW1wdHlPYmplY3QoIHVuaXRzU3RyaW5nICkgKT8gJC5wYXJzZUpTT04oIHVuaXRzU3RyaW5nICk6IHt9LFxuXHRcdFx0c3RyaW5nID0gXCJcIixcblx0XHRcdHZhbHVlc1N0cmluZyA9IFwiXCI7XG5cblx0XHQvL2ZpbmQgcmVsZXZhbnQgdmFsdWVzIGZvciBwb3B1cCBhbmQgZGlzcGxheSB0aGVtXG5cdFx0dmFyIHNlcmllcyA9IGRhdGEuc2VyaWVzLCBrZXkgPSBcIlwiLCB0aW1lU3RyaW5nID0gXCJcIjtcblx0XHRpZiggc2VyaWVzICYmIHNlcmllcy5sZW5ndGggKSB7XG5cdFx0XHRcblx0XHRcdHZhciBzZXJpZSA9IHNlcmllc1sgMCBdO1xuXHRcdFx0a2V5ID0gc2VyaWUua2V5O1xuXHRcdFx0XG5cdFx0XHQvL2dldCBzb3VyY2Ugb2YgaW5mb3JtYXRpb25cblx0XHRcdHZhciBwb2ludCA9IGRhdGEucG9pbnQ7XG5cdFx0XHQvL2JlZ2luIGNvbXBvc3Rpbmcgc3RyaW5nXG5cdFx0XHRzdHJpbmcgPSBcIjxoMz5cIiArIGtleSArIFwiPC9oMz48cD5cIjtcblx0XHRcdHZhbHVlc1N0cmluZyA9IFwiXCI7XG5cblx0XHRcdGlmKCAhaXNNYXBQb3B1cCAmJiAoIEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10eXBlXCIgKSA9PT0gXCI0XCIgfHwgQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LXR5cGVcIiApID09PSBcIjVcIiB8fCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdHlwZVwiICkgPT09IFwiNlwiICkgKSB7XG5cdFx0XHRcdC8vbXVsdGliYXJjaGFydCBoYXMgdmFsdWVzIGluIGRpZmZlcmVudCBmb3JtYXRcblx0XHRcdFx0cG9pbnQgPSB7IFwieVwiOiBzZXJpZS52YWx1ZSwgXCJ0aW1lXCI6IGRhdGEuZGF0YS50aW1lIH07XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdCQuZWFjaCggcG9pbnQsIGZ1bmN0aW9uKCBpLCB2ICkge1xuXHRcdFx0XHQvL2ZvciBlYWNoIGRhdGEgcG9pbnQsIGZpbmQgYXBwcm9wcmlhdGUgdW5pdCwgYW5kIGlmIHdlIGhhdmUgaXQsIGRpc3BsYXkgaXRcblx0XHRcdFx0dmFyIHVuaXQgPSBfLmZpbmRXaGVyZSggdW5pdHMsIHsgcHJvcGVydHk6IGkgfSApLFxuXHRcdFx0XHRcdHZhbHVlID0gdixcblx0XHRcdFx0XHRpc0hpZGRlbiA9ICggdW5pdCAmJiB1bml0Lmhhc093blByb3BlcnR5KCBcInZpc2libGVcIiApICYmICF1bml0LnZpc2libGUgKT8gdHJ1ZTogZmFsc2U7XG5cblx0XHRcdFx0Ly9mb3JtYXQgbnVtYmVyXG5cdFx0XHRcdGlmKCB1bml0ICYmICFpc05hTiggdW5pdC5mb3JtYXQgKSAmJiB1bml0LmZvcm1hdCA+PSAwICkge1xuXHRcdFx0XHRcdC8vZml4ZWQgZm9ybWF0XG5cdFx0XHRcdFx0dmFyIGZpeGVkID0gTWF0aC5taW4oIDIwLCBwYXJzZUludCggdW5pdC5mb3JtYXQsIDEwICkgKTtcblx0XHRcdFx0XHR2YWx1ZSA9IGQzLmZvcm1hdCggXCIsLlwiICsgZml4ZWQgKyBcImZcIiApKCB2YWx1ZSApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vYWRkIHRob3VzYW5kcyBzZXBhcmF0b3Jcblx0XHRcdFx0XHR2YWx1ZSA9IGQzLmZvcm1hdCggXCIsXCIgKSggdmFsdWUgKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmKCB1bml0ICkge1xuXHRcdFx0XHRcdGlmKCAhaXNIaWRkZW4gKSB7XG5cdFx0XHRcdFx0XHQvL3RyeSB0byBmb3JtYXQgbnVtYmVyXG5cdFx0XHRcdFx0XHQvL3NjYXR0ZXIgcGxvdCBoYXMgdmFsdWVzIGRpc3BsYXllZCBpbiBzZXBhcmF0ZSByb3dzXG5cdFx0XHRcdFx0XHRpZiggdmFsdWVzU3RyaW5nICE9PSBcIlwiICYmIGNoYXJ0VHlwZSAhPSAyICkge1xuXHRcdFx0XHRcdFx0XHR2YWx1ZXNTdHJpbmcgKz0gXCIsIFwiO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYoIGNoYXJ0VHlwZSA9PSAyICkge1xuXHRcdFx0XHRcdFx0XHR2YWx1ZXNTdHJpbmcgKz0gXCI8c3BhbiBjbGFzcz0ndmFyLXBvcHVwLXZhbHVlJz5cIjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHZhbHVlc1N0cmluZyArPSB2YWx1ZSArIFwiIFwiICsgdW5pdC51bml0O1xuXHRcdFx0XHRcdFx0aWYoIGNoYXJ0VHlwZSA9PSAyICkge1xuXHRcdFx0XHRcdFx0XHR2YWx1ZXNTdHJpbmcgKz0gXCI8L3NwYW4+XCI7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2UgaWYoIGkgPT09IFwidGltZVwiICkge1xuXHRcdFx0XHRcdHRpbWVTdHJpbmcgPSB2O1xuXHRcdFx0XHR9IGVsc2UgaWYoIGkgIT09IFwiY29sb3JcIiAmJiBpICE9PSBcInNlcmllc1wiICYmICggaSAhPT0gXCJ4XCIgfHwgY2hhcnRUeXBlICE9IDEgKSApIHtcblx0XHRcdFx0XHRpZiggIWlzSGlkZGVuICkge1xuXHRcdFx0XHRcdFx0aWYoIHZhbHVlc1N0cmluZyAhPT0gXCJcIiAmJiBjaGFydFR5cGUgIT0gMiApIHtcblx0XHRcdFx0XHRcdFx0dmFsdWVzU3RyaW5nICs9IFwiLCBcIjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmKCBjaGFydFR5cGUgPT0gMiApIHtcblx0XHRcdFx0XHRcdFx0dmFsdWVzU3RyaW5nICs9IFwiPHNwYW4gY2xhc3M9J3Zhci1wb3B1cC12YWx1ZSc+XCI7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHQvL2p1c3QgYWRkIHBsYWluIHZhbHVlLCBvbWl0aW5nIHggdmFsdWUgZm9yIGxpbmVjaGFydFxuXHRcdFx0XHRcdFx0dmFsdWVzU3RyaW5nICs9IHZhbHVlO1xuXHRcdFx0XHRcdFx0aWYoIGNoYXJ0VHlwZSA9PSAyICkge1xuXHRcdFx0XHRcdFx0XHR2YWx1ZXNTdHJpbmcgKz0gXCI8L3NwYW4+XCI7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cblx0XHRcdGlmKCBpc01hcFBvcHVwIHx8ICggdGltZVN0cmluZyAmJiBjaGFydFR5cGUgIT0gMiApICkge1xuXHRcdFx0XHR2YWx1ZXNTdHJpbmcgKz0gXCIgPGJyIC8+IGluIDxiciAvPiBcIiArIHRpbWVTdHJpbmc7XG5cdFx0XHR9IGVsc2UgaWYoIHRpbWVTdHJpbmcgJiYgY2hhcnRUeXBlID09IDIgKSB7XG5cdFx0XHRcdHZhbHVlc1N0cmluZyArPSBcIjxzcGFuIGNsYXNzPSd2YXItcG9wdXAtdmFsdWUnPmluIFwiICsgdGltZVN0cmluZyArIFwiPC9zcGFuPlwiO1xuXHRcdFx0fVxuXHRcdFx0c3RyaW5nICs9IHZhbHVlc1N0cmluZztcblx0XHRcdHN0cmluZyArPSBcIjwvcD5cIjtcblxuXHRcdH1cblxuXHRcdHJldHVybiBzdHJpbmc7XG5cblx0fTtcblxuXG5cdEFwcC5VdGlscy5mb3JtYXRUaW1lTGFiZWwgPSBmdW5jdGlvbiggdHlwZSwgZCwgeEF4aXNQcmVmaXgsIHhBeGlzU3VmZml4LCBmb3JtYXQgKSB7XG5cdFx0Ly9kZXBlbmRpbmcgb24gdHlwZSBmb3JtYXQgbGFiZWxcblx0XHR2YXIgbGFiZWw7XG5cdFx0c3dpdGNoKCB0eXBlICkge1xuXHRcdFx0XG5cdFx0XHRjYXNlIFwiRGVjYWRlXCI6XG5cdFx0XHRcdFxuXHRcdFx0XHR2YXIgZGVjYWRlU3RyaW5nID0gZC50b1N0cmluZygpO1xuXHRcdFx0XHRkZWNhZGVTdHJpbmcgPSBkZWNhZGVTdHJpbmcuc3Vic3RyaW5nKCAwLCBkZWNhZGVTdHJpbmcubGVuZ3RoIC0gMSk7XG5cdFx0XHRcdGRlY2FkZVN0cmluZyA9IGRlY2FkZVN0cmluZyArIFwiMHNcIjtcblx0XHRcdFx0bGFiZWwgPSBkZWNhZGVTdHJpbmc7XG5cblx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdGNhc2UgXCJRdWFydGVyIENlbnR1cnlcIjpcblx0XHRcdFx0XG5cdFx0XHRcdHZhciBxdWFydGVyU3RyaW5nID0gXCJcIixcblx0XHRcdFx0XHRxdWFydGVyID0gZCAlIDEwMDtcblx0XHRcdFx0XG5cdFx0XHRcdGlmKCBxdWFydGVyIDwgMjUgKSB7XG5cdFx0XHRcdFx0cXVhcnRlclN0cmluZyA9IFwiMXN0IHF1YXJ0ZXIgb2YgdGhlXCI7XG5cdFx0XHRcdH0gZWxzZSBpZiggcXVhcnRlciA8IDUwICkge1xuXHRcdFx0XHRcdHF1YXJ0ZXJTdHJpbmcgPSBcImhhbGYgb2YgdGhlXCI7XG5cdFx0XHRcdH0gZWxzZSBpZiggcXVhcnRlciA8IDc1ICkge1xuXHRcdFx0XHRcdHF1YXJ0ZXJTdHJpbmcgPSBcIjNyZCBxdWFydGVyIG9mIHRoZVwiO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHF1YXJ0ZXJTdHJpbmcgPSBcIjR0aCBxdWFydGVyIG9mIHRoZVwiO1xuXHRcdFx0XHR9XG5cdFx0XHRcdFx0XG5cdFx0XHRcdHZhciBjZW50dXJ5U3RyaW5nID0gQXBwLlV0aWxzLmNlbnR1cnlTdHJpbmcoIGQgKTtcblxuXHRcdFx0XHRsYWJlbCA9IHF1YXJ0ZXJTdHJpbmcgKyBcIiBcIiArIGNlbnR1cnlTdHJpbmc7XG5cblx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdGNhc2UgXCJIYWxmIENlbnR1cnlcIjpcblx0XHRcdFx0XG5cdFx0XHRcdHZhciBoYWxmU3RyaW5nID0gXCJcIixcblx0XHRcdFx0XHRoYWxmID0gZCAlIDEwMDtcblx0XHRcdFx0XG5cdFx0XHRcdGlmKCBoYWxmIDwgNTAgKSB7XG5cdFx0XHRcdFx0aGFsZlN0cmluZyA9IFwiMXN0IGhhbGYgb2YgdGhlXCI7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aGFsZlN0cmluZyA9IFwiMm5kIGhhbGYgb2YgdGhlXCI7XG5cdFx0XHRcdH1cblx0XHRcdFx0XHRcblx0XHRcdFx0dmFyIGNlbnR1cnlTdHJpbmcgPSBBcHAuVXRpbHMuY2VudHVyeVN0cmluZyggZCApO1xuXG5cdFx0XHRcdGxhYmVsID0gaGFsZlN0cmluZyArIFwiIFwiICsgY2VudHVyeVN0cmluZztcblxuXHRcdFx0XHRicmVhaztcblxuXHRcdFx0Y2FzZSBcIkNlbnR1cnlcIjpcblx0XHRcdFx0XG5cdFx0XHRcdGxhYmVsID0gQXBwLlV0aWxzLmNlbnR1cnlTdHJpbmcoIGQgKTtcblxuXHRcdFx0XHRicmVhaztcblxuXHRcdFx0ZGVmYXVsdDpcblxuXHRcdFx0XHRsYWJlbCA9IEFwcC5VdGlscy5mb3JtYXRWYWx1ZSggZCwgZm9ybWF0ICk7XG5cdFx0XHRcdFxuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cdFx0cmV0dXJuIHhBeGlzUHJlZml4ICsgbGFiZWwgKyB4QXhpc1N1ZmZpeDtcblx0fTtcblxuXHRBcHAuVXRpbHMuaW5saW5lQ3NzU3R5bGUgPSBmdW5jdGlvbiggcnVsZXMgKSB7XG5cdFx0Ly9odHRwOi8vZGV2aW50b3JyLmVzL2Jsb2cvMjAxMC8wNS8yNi90dXJuLWNzcy1ydWxlcy1pbnRvLWlubGluZS1zdHlsZS1hdHRyaWJ1dGVzLXVzaW5nLWpxdWVyeS9cblx0XHRmb3IgKHZhciBpZHggPSAwLCBsZW4gPSBydWxlcy5sZW5ndGg7IGlkeCA8IGxlbjsgaWR4KyspIHtcblx0XHRcdCQocnVsZXNbaWR4XS5zZWxlY3RvclRleHQpLmVhY2goZnVuY3Rpb24gKGksIGVsZW0pIHtcblx0XHRcdFx0ZWxlbS5zdHlsZS5jc3NUZXh0ICs9IHJ1bGVzW2lkeF0uc3R5bGUuY3NzVGV4dDtcblx0XHRcdH0pO1xuXHRcdH1cblx0fTtcblxuXHRBcHAuVXRpbHMuY2hlY2tWYWxpZERpbWVuc2lvbnMgPSBmdW5jdGlvbiggZGltZW5zaW9ucywgY2hhcnRUeXBlICkge1xuXHRcdFx0XG5cdFx0dmFyIHZhbGlkRGltZW5zaW9ucyA9IGZhbHNlLFxuXHRcdFx0eERpbWVuc2lvbiwgeURpbWVuc2lvbjtcblx0XHRcblx0XHRzd2l0Y2goIGNoYXJ0VHlwZSApIHtcblx0XHRcdGNhc2UgXCIxXCI6XG5cdFx0XHRjYXNlIFwiNFwiOlxuXHRcdFx0Y2FzZSBcIjVcIjpcblx0XHRcdGNhc2UgXCI2XCI6XG5cdFx0XHRcdC8vY2hlY2sgdGhhdCBkaW1lbnNpb25zIGhhdmUgeSBwcm9wZXJ0eVxuXHRcdFx0XHR5RGltZW5zaW9uID0gXy5maW5kKCBkaW1lbnNpb25zLCBmdW5jdGlvbiggZGltZW5zaW9uICkge1xuXHRcdFx0XHRcdHJldHVybiBkaW1lbnNpb24ucHJvcGVydHkgPT09IFwieVwiO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdGlmKCB5RGltZW5zaW9uICkge1xuXHRcdFx0XHRcdHZhbGlkRGltZW5zaW9ucyA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFwiMlwiOlxuXHRcdFx0XHQvL2NoZWNrIHRoYXQgZGltZW5zaW9ucyBoYXZlIHggcHJvcGVydHlcblx0XHRcdFx0eERpbWVuc2lvbiA9IF8uZmluZCggZGltZW5zaW9ucywgZnVuY3Rpb24oIGRpbWVuc2lvbiApIHtcblx0XHRcdFx0XHRyZXR1cm4gZGltZW5zaW9uLnByb3BlcnR5ID09PSBcInhcIjtcblx0XHRcdFx0fSApO1xuXHRcdFx0XHR5RGltZW5zaW9uID0gXy5maW5kKCBkaW1lbnNpb25zLCBmdW5jdGlvbiggZGltZW5zaW9uICkge1xuXHRcdFx0XHRcdHJldHVybiBkaW1lbnNpb24ucHJvcGVydHkgPT09IFwieVwiO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdGlmKCB4RGltZW5zaW9uICYmIHlEaW1lbnNpb24gKSB7XG5cdFx0XHRcdFx0dmFsaWREaW1lbnNpb25zID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgXCIzXCI6XG5cdFx0XHRcdC8vY2hlY2sgdGhhdCBkaW1lbnNpb25zIGhhdmUgeSBwcm9wZXJ0eVxuXHRcdFx0XHR5RGltZW5zaW9uID0gXy5maW5kKCBkaW1lbnNpb25zLCBmdW5jdGlvbiggZGltZW5zaW9uICkge1xuXHRcdFx0XHRcdHJldHVybiBkaW1lbnNpb24ucHJvcGVydHkgPT09IFwieVwiO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdGlmKCB5RGltZW5zaW9uICkge1xuXHRcdFx0XHRcdHZhbGlkRGltZW5zaW9ucyA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXHRcdHJldHVybiB2YWxpZERpbWVuc2lvbnM7XG5cblx0fTtcblxuXHRBcHAuVXRpbHMuZm9ybWF0VmFsdWUgPSBmdW5jdGlvbiggdmFsdWUsIGZvcm1hdCApIHtcblx0XHQvL21ha2Ugc3VyZSB3ZSBkbyB0aGlzIG9uIG51bWJlclxuXHRcdGlmKCB2YWx1ZSAmJiAhaXNOYU4oIHZhbHVlICkgKSB7XG5cdFx0XHRpZiggZm9ybWF0ICYmICFpc05hTiggZm9ybWF0ICkgKSB7XG5cdFx0XHRcdHZhciBmaXhlZCA9IE1hdGgubWluKCAyMCwgcGFyc2VJbnQoIGZvcm1hdCwgMTAgKSApO1xuXHRcdFx0XHR2YWx1ZSA9IHZhbHVlLnRvRml4ZWQoIGZpeGVkICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvL25vIGZvcm1hdCBcblx0XHRcdFx0dmFsdWUgPSB2YWx1ZS50b1N0cmluZygpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdmFsdWU7XG5cdH07XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVXRpbHM7XG5cdFxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBBcHAgPSByZXF1aXJlKCBcIi4vbmFtZXNwYWNlcy5qc1wiICksXG5cdFx0Rm9ybSA9IHJlcXVpcmUoIFwiLi92aWV3cy9BcHAuVmlld3MuRm9ybS5qc1wiICksXG5cdFx0Q2hhcnRNb2RlbCA9IHJlcXVpcmUoIFwiLi9tb2RlbHMvQXBwLk1vZGVscy5DaGFydE1vZGVsLmpzXCIgKSxcblx0XHRDaGFydERhdGFNb2RlbCA9IHJlcXVpcmUoIFwiLi9tb2RlbHMvQXBwLk1vZGVscy5DaGFydERhdGFNb2RlbC5qc1wiICk7XG5cblx0Ly9zZXR1cCBtb2RlbHNcblx0Ly9pcyBuZXcgY2hhcnQgb3IgZGlzcGxheSBvbGQgY2hhcnRcblx0dmFyICRjaGFydFNob3dXcmFwcGVyID0gJCggXCIuY2hhcnQtc2hvdy13cmFwcGVyLCAuY2hhcnQtZWRpdC13cmFwcGVyXCIgKSxcblx0XHRjaGFydElkID0gJGNoYXJ0U2hvd1dyYXBwZXIuYXR0ciggXCJkYXRhLWNoYXJ0LWlkXCIgKTtcblxuXHQvL3NldHVwIHZpZXdzXG5cdEFwcC5WaWV3ID0gbmV3IEZvcm0oKTtcblxuXHRpZiggJGNoYXJ0U2hvd1dyYXBwZXIubGVuZ3RoICYmIGNoYXJ0SWQgKSB7XG5cdFx0XG5cdFx0Ly9zaG93aW5nIGV4aXN0aW5nIGNoYXJ0XG5cdFx0QXBwLkNoYXJ0TW9kZWwgPSBuZXcgQ2hhcnRNb2RlbCggeyBpZDogY2hhcnRJZCB9ICk7XG5cdFx0QXBwLkNoYXJ0TW9kZWwuZmV0Y2goIHtcblx0XHRcdHN1Y2Nlc3M6IGZ1bmN0aW9uKCBkYXRhICkge1xuXHRcdFx0XHRBcHAuVmlldy5zdGFydCgpO1xuXHRcdFx0fSxcblx0XHRcdGVycm9yOiBmdW5jdGlvbiggeGhyICkge1xuXHRcdFx0XHRjb25zb2xlLmVycm9yKCBcIkVycm9yIGxvYWRpbmcgY2hhcnQgbW9kZWxcIiwgeGhyICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHRcdC8vZmluZCBvdXQgaWYgaXQncyBpbiBjYWNoZVxuXHRcdGlmKCAhJCggXCIuc3RhbmRhbG9uZS1jaGFydC12aWV3ZXJcIiApLmxlbmd0aCApIHtcblx0XHRcdC8vZGlzYWJsZSBjYWNoaW5nIGZvciB2aWV3aW5nIHdpdGhpbiBhZG1pblxuXHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0KCBcImNhY2hlXCIsIGZhbHNlICk7XG5cdFx0fVxuXHRcdFxuXHR9IGVsc2Uge1xuXG5cdFx0Ly9pcyBuZXcgY2hhcnRcblx0XHRBcHAuQ2hhcnRNb2RlbCA9IG5ldyBDaGFydE1vZGVsKCk7XG5cdFx0QXBwLlZpZXcuc3RhcnQoKTtcblxuXHR9XG5cblx0XG5cdFxuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgQXBwID0gcmVxdWlyZSggXCIuLy4uL25hbWVzcGFjZXMuanNcIiApLFxuXHRcdEVudGl0eU1vZGVsID0gcmVxdWlyZSggXCIuLy4uL21vZGVscy9BcHAuTW9kZWxzLkVudGl0eU1vZGVsLmpzXCIgKTtcblxuXHRBcHAuQ29sbGVjdGlvbnMuQXZhaWxhYmxlRW50aXRpZXNDb2xsZWN0aW9uID0gQmFja2JvbmUuQ29sbGVjdGlvbi5leHRlbmQoIHtcblxuXHRcdG1vZGVsOiBFbnRpdHlNb2RlbCxcblx0XHR1cmxSb290OiBHbG9iYWwucm9vdFVybCArICcvZGF0YS9lbnRpdGllcycsXG5cdFx0XG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24gKCkge1xuXG5cdFx0XHRBcHAuQ2hhcnRWYXJpYWJsZXNDb2xsZWN0aW9uLm9uKCBcImFkZFwiLCB0aGlzLm9uVmFyaWFibGVBZGQsIHRoaXMgKTtcblx0XHRcdEFwcC5DaGFydFZhcmlhYmxlc0NvbGxlY3Rpb24ub24oIFwicmVtb3ZlXCIsIHRoaXMub25WYXJpYWJsZVJlbW92ZSwgdGhpcyApO1xuXHRcdFx0XG5cdFx0fSxcblxuXHRcdHBhcnNlOiBmdW5jdGlvbiggcmVzcG9uc2UgKXtcblx0XHRcdHJldHVybiByZXNwb25zZS5kYXRhO1xuXHRcdH0sXG5cblx0XHRvblZhcmlhYmxlQWRkOiBmdW5jdGlvbiggbW9kZWwgKSB7XG5cdFx0XHR0aGlzLnVwZGF0ZUVudGl0aWVzKCk7XG5cdFx0fSxcblxuXHRcdG9uVmFyaWFibGVSZW1vdmU6IGZ1bmN0aW9uKCBtb2RlbCApIHtcblx0XHRcdHRoaXMudXBkYXRlRW50aXRpZXMoKTtcblx0XHR9LFxuXG5cdFx0dXBkYXRlRW50aXRpZXM6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHR2YXIgaWRzID0gdGhpcy5nZXRWYXJpYWJsZUlkcygpO1xuXHRcdFx0dGhpcy51cmwgPSB0aGlzLnVybFJvb3QgKyBcIj92YXJpYWJsZUlkcz1cIiArIGlkcy5qb2luKFwiLFwiKTtcblxuXHRcdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdFx0dGhpcy5mZXRjaCgge1xuXHRcdFx0XHRzdWNjZXNzOiBmdW5jdGlvbiggY29sbGVjdGlvbiwgcmVzcG9uc2UgKSB7XG5cdFx0XHRcdFx0dGhhdC50cmlnZ2VyKCBcImZldGNoZWRcIiApO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdH0sXG5cblx0XHRnZXRWYXJpYWJsZUlkczogZnVuY3Rpb24oKSB7XG5cblx0XHRcdHZhciB2YXJpYWJsZXMgPSBBcHAuQ2hhcnRWYXJpYWJsZXNDb2xsZWN0aW9uLm1vZGVscyxcblx0XHRcdFx0aWRzID0gXy5tYXAoIHZhcmlhYmxlcywgZnVuY3Rpb24oIHYsIGsgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHYuZ2V0KCBcImlkXCIgKTtcblx0XHRcdFx0fSApO1xuXHRcdFx0cmV0dXJuIGlkcztcblxuXHRcdH1cblxuXG5cdH0gKTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5Db2xsZWN0aW9ucy5BdmFpbGFibGVFbnRpdGllc0NvbGxlY3Rpb247XG5cdFxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIEFwcCA9IHJlcXVpcmUoIFwiLi8uLi9uYW1lc3BhY2VzLmpzXCIgKSxcblx0XHRDaGFydFZhcmlhYmxlTW9kZWwgPSByZXF1aXJlKCBcIi4vLi4vbW9kZWxzL0FwcC5Nb2RlbHMuQ2hhcnRWYXJpYWJsZU1vZGVsLmpzXCIgKTtcblx0XG5cdEFwcC5Db2xsZWN0aW9ucy5DaGFydFZhcmlhYmxlc0NvbGxlY3Rpb24gPSBCYWNrYm9uZS5Db2xsZWN0aW9uLmV4dGVuZCgge1xuXG5cdFx0bW9kZWw6IENoYXJ0VmFyaWFibGVNb2RlbCxcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKCBtb2RlbHMsIG9wdGlvbnMgKSB7XG5cdFx0XHRpZiggbW9kZWxzICYmIG1vZGVscy5sZW5ndGggKSB7XG5cdFx0XHRcdC8vaGF2ZSBtb2RlbHMgYWxyZWFkeVxuXHRcdFx0XHR0aGlzLnNjYXR0ZXJDb2xvckNoZWNrKCBtb2RlbHMgKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMub24oIFwic3luY1wiLCB0aGlzLm9uU3luYywgdGhpcyApO1xuXHRcdFx0fVxuXHRcdH0sXG5cblx0XHRvblN5bmM6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5zY2F0dGVyQ29sb3JDaGVjaygpO1xuXHRcdH0sXG5cblx0XHRzY2F0dGVyQ29sb3JDaGVjazogZnVuY3Rpb24oIG1vZGVscyApIHtcblx0XHRcdFxuXHRcdFx0aWYoIEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10eXBlXCIgKSA9PSAyICkge1xuXHRcdFx0XHQvL21ha2Ugc3VyZSBmb3Igc2NhdHRlciBwbG90LCB3ZSBoYXZlIGNvbG9yIHNldCBhcyBjb250aW5lbnRzXG5cdFx0XHRcdHZhciBjaGFydERpbWVuc2lvbnMgPSAkLnBhcnNlSlNPTiggQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LWRpbWVuc2lvbnNcIiApICk7XG5cdFx0XHRcdC8vaWYoICFfLmZpbmRXaGVyZSggY2hhcnREaW1lbnNpb25zLCB7IFwicHJvcGVydHlcIjogXCJjb2xvclwiIH0gKSApIHtcblx0XHRcdFx0XHQvL3RoaXMgaXMgd2hlcmUgd2UgYWRkIGNvbG9yIHByb3BlcnR5XG5cdFx0XHRcdFx0dmFyIGNvbG9yUHJvcE9iaiA9IHsgXCJpZFwiOlwiMTIzXCIsXCJ1bml0XCI6XCJcIixcIm5hbWVcIjpcIkNvbG9yXCIsXCJwZXJpb2RcIjpcInNpbmdsZVwiLFwibW9kZVwiOlwic3BlY2lmaWNcIixcInRhcmdldFllYXJcIjpcIjIwMDBcIixcInRvbGVyYW5jZVwiOlwiNVwiLFwibWF4aW11bUFnZVwiOlwiNVwifTtcblx0XHRcdFx0XHRpZiggbW9kZWxzICkge1xuXHRcdFx0XHRcdFx0bW9kZWxzLnB1c2goIGNvbG9yUHJvcE9iaiApO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0aGlzLmFkZCggbmV3Q2hhcnRWYXJpYWJsZU1vZGVsKCBjb2xvclByb3BPYmogKSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0Ly99XG5cdFx0XHR9XG5cdFx0fVxuXG5cdH0gKTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5Db2xsZWN0aW9ucy5DaGFydFZhcmlhYmxlc0NvbGxlY3Rpb247XG5cdFxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIEFwcCA9IHJlcXVpcmUoIFwiLi8uLi9uYW1lc3BhY2VzLmpzXCIgKTtcblxuXHRBcHAuQ29sbGVjdGlvbnMuU2VhcmNoRGF0YUNvbGxlY3Rpb24gPSBCYWNrYm9uZS5Db2xsZWN0aW9uLmV4dGVuZCgge1xuXG5cdFx0Ly9tb2RlbDogQXBwLk1vZGVscy5FbnRpdHlNb2RlbCxcblx0XHR1cmxSb290OiBHbG9iYWwucm9vdFVybCArICcvZGF0YS9zZWFyY2gnLFxuXHRcdFxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uICgpIHtcblxuXHRcdFx0Ly9BcHAuQ2hhcnRWYXJpYWJsZXNDb2xsZWN0aW9uLm9uKCBcImFkZFwiLCB0aGlzLm9uVmFyaWFibGVBZGQsIHRoaXMgKTtcblx0XHRcdC8vQXBwLkNoYXJ0VmFyaWFibGVzQ29sbGVjdGlvbi5vbiggXCJyZW1vdmVcIiwgdGhpcy5vblZhcmlhYmxlUmVtb3ZlLCB0aGlzICk7XG5cdFx0XHRcdFxuXHRcdH0sXG5cblx0XHRwYXJzZTogZnVuY3Rpb24oIHJlc3BvbnNlICl7XG5cdFx0XHRyZXR1cm4gcmVzcG9uc2UuZGF0YTtcblx0XHR9LFxuXG5cdFx0LypvblZhcmlhYmxlQWRkOiBmdW5jdGlvbiggbW9kZWwgKSB7XG5cdFx0XHR0aGlzLnVwZGF0ZUVudGl0aWVzKCk7XG5cdFx0fSxcblxuXHRcdG9uVmFyaWFibGVSZW1vdmU6IGZ1bmN0aW9uKCBtb2RlbCApIHtcblx0XHRcdHRoaXMudXBkYXRlRW50aXRpZXMoKTtcblx0XHR9LCovXG5cblx0XHRzZWFyY2g6IGZ1bmN0aW9uKCBzICkge1xuXG5cdFx0XHR0aGlzLnVybCA9IHRoaXMudXJsUm9vdCArIFwiP3M9XCIgKyBzO1xuXG5cdFx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0XHR0aGlzLmZldGNoKCB7XG5cdFx0XHRcdHN1Y2Nlc3M6IGZ1bmN0aW9uKCBjb2xsZWN0aW9uLCByZXNwb25zZSApIHtcblx0XHRcdFx0XHR0aGF0LnRyaWdnZXIoIFwiZmV0Y2hlZFwiICk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0fVxuXG5cdH0gKTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5Db2xsZWN0aW9ucy5TZWFyY2hEYXRhQ29sbGVjdGlvbjtcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIEFwcCA9IHJlcXVpcmUoIFwiLi8uLi9uYW1lc3BhY2VzLmpzXCIgKTtcblxuXHRBcHAuTW9kZWxzLkF2YWlsYWJsZVRpbWVNb2RlbCA9IEJhY2tib25lLk1vZGVsLmV4dGVuZCgge1xuXG5cdFx0dXJsUm9vdDogR2xvYmFsLnJvb3RVcmwgKyAnL2RhdGEvdGltZXMnLFxuXHRcdFxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uICgpIHtcblxuXHRcdFx0QXBwLkNoYXJ0VmFyaWFibGVzQ29sbGVjdGlvbi5vbiggXCJhZGRcIiwgdGhpcy5vblZhcmlhYmxlQWRkLCB0aGlzICk7XG5cdFx0XHRBcHAuQ2hhcnRWYXJpYWJsZXNDb2xsZWN0aW9uLm9uKCBcInJlbW92ZVwiLCB0aGlzLm9uVmFyaWFibGVSZW1vdmUsIHRoaXMgKTtcblx0XHRcdFxuXHRcdH0sXG5cblx0XHRwYXJzZTogZnVuY3Rpb24oIHJlc3BvbnNlICkge1xuXG5cdFx0XHR2YXIgbWF4ID0gZDMubWF4KCByZXNwb25zZS5kYXRhLCBmdW5jdGlvbihkKSB7IHJldHVybiBwYXJzZUZsb2F0KCBkLmxhYmVsICk7IH0gKSxcblx0XHRcdFx0XHRcdG1pbiA9IGQzLm1pbiggcmVzcG9uc2UuZGF0YSwgZnVuY3Rpb24oZCkgeyByZXR1cm4gcGFyc2VGbG9hdCggZC5sYWJlbCApOyB9ICk7XG5cdFx0XHR0aGlzLnNldCggeyBcIm1heFwiOiBtYXgsIFwibWluXCI6IG1pbiB9ICk7XG5cdFx0XG5cdFx0fSxcblxuXHRcdG9uVmFyaWFibGVBZGQ6IGZ1bmN0aW9uKCBtb2RlbCApIHtcblx0XHRcdHRoaXMudXBkYXRlVGltZSgpO1xuXHRcdH0sXG5cblx0XHRvblZhcmlhYmxlUmVtb3ZlOiBmdW5jdGlvbiggbW9kZWwgKSB7XG5cdFx0XHR0aGlzLnVwZGF0ZVRpbWUoKTtcblx0XHR9LFxuXG5cdFx0dXBkYXRlVGltZTogZnVuY3Rpb24oIGlkcyApIHtcblxuXHRcdFx0dmFyIGlkcyA9IHRoaXMuZ2V0VmFyaWFibGVJZHMoKTtcblx0XHRcdHRoaXMudXJsID0gdGhpcy51cmxSb290ICsgXCI/dmFyaWFibGVJZHM9XCIgKyBpZHMuam9pbihcIixcIik7XG5cdFx0XHR0aGlzLmZldGNoKCk7XG5cblx0XHR9LFxuXG5cdFx0Z2V0VmFyaWFibGVJZHM6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHR2YXIgdmFyaWFibGVzID0gQXBwLkNoYXJ0VmFyaWFibGVzQ29sbGVjdGlvbi5tb2RlbHMsXG5cdFx0XHRcdGlkcyA9IF8ubWFwKCB2YXJpYWJsZXMsIGZ1bmN0aW9uKCB2LCBrICkge1xuXHRcdFx0XHRcdHJldHVybiB2LmdldCggXCJpZFwiICk7XG5cdFx0XHRcdH0gKTtcblx0XHRcdHJldHVybiBpZHM7XG5cblx0XHR9XG5cblxuXHR9ICk7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuTW9kZWxzLkF2YWlsYWJsZVRpbWVNb2RlbDtcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIEFwcCA9IHJlcXVpcmUoIFwiLi8uLi9uYW1lc3BhY2VzLmpzXCIgKTtcblx0XG5cdEFwcC5Nb2RlbHMuQ2hhcnREYXRhTW9kZWwgPSBCYWNrYm9uZS5Nb2RlbC5leHRlbmQoIHtcblxuXHRcdGRlZmF1bHRzOiB7fSxcblxuXHRcdHVybFJvb3Q6IEdsb2JhbC5yb290VXJsICsgXCIvZGF0YS9kaW1lbnNpb25zXCIsXG5cdFx0XG5cdFx0Lyp1cmw6IGZ1bmN0aW9uKCl7XG5cblx0XHRcdHZhciBhdHRycyA9IHRoaXMuYXR0cmlidXRlcyxcblx0XHRcdFx0dXJsID0gdGhpcy51cmxSb290ICsgXCI/XCI7XG5cblx0XHRcdC8vYWRkIGFsbCBhdHRyaWJ1dGVzIHRvIHVybFxuXHRcdFx0Xy5lYWNoKCBhdHRycywgZnVuY3Rpb24oIHYsIGkgKSB7XG5cdFx0XHRcdHVybCArPSBpICsgXCI9XCIgKyB2O1xuXHRcdFx0XHR1cmwgKz0gXCImXCI7XG5cdFx0XHR9ICk7XG5cblx0XHRcdHJldHVybiB1cmw7XG5cblx0XHR9LCovXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiAoKSB7XG5cblx0XHR9LFxuXG5cdH0gKTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5Nb2RlbHMuQ2hhcnREYXRhTW9kZWw7XG5cbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBBcHAgPSByZXF1aXJlKCBcIi4vLi4vbmFtZXNwYWNlcy5qc1wiICk7XG5cdFxuXHRBcHAuTW9kZWxzLkNoYXJ0RGltZW5zaW9uc01vZGVsID0gQmFja2JvbmUuTW9kZWwuZXh0ZW5kKCB7XG5cblx0XHR1cmxSb290OiBHbG9iYWwucm9vdFVybCArICcvY2hhcnRUeXBlcy8nLFxuXG5cdFx0ZGVmYXVsdHM6IHt9LFxuXG5cdFx0bG9hZENvbmZpZ3VyYXRpb246IGZ1bmN0aW9uKCBjaGFydFR5cGVJZCApIHtcblxuXHRcdFx0dGhpcy5zZXQoIFwiaWRcIiwgY2hhcnRUeXBlSWQgKTtcblx0XHRcdHRoaXMuZmV0Y2goIHtcblx0XHRcdFx0c3VjY2VzczogZnVuY3Rpb24oIHJlc3BvbnNlICkge1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cblx0XHR9XG5cblx0fSApO1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLk1vZGVscy5DaGFydERpbWVuc2lvbnNNb2RlbDtcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIEFwcCA9IHJlcXVpcmUoIFwiLi8uLi9uYW1lc3BhY2VzLmpzXCIgKTtcblx0XG5cdEFwcC5Nb2RlbHMuQ2hhcnRNb2RlbCA9IEJhY2tib25lLk1vZGVsLmV4dGVuZCgge1xuXG5cdFx0Ly91cmxSb290OiBHbG9iYWwucm9vdFVybCArICcvY2hhcnRzLycsXG5cdFx0Ly91cmxSb290OiBHbG9iYWwucm9vdFVybCArICcvZGF0YS9jb25maWcvJyxcblx0XHR1cmw6IGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYoICQoXCIjZm9ybS12aWV3XCIpLmxlbmd0aCApIHtcblx0XHRcdFx0aWYoIHRoaXMuaWQgKSB7XG5cdFx0XHRcdFx0Ly9lZGl0aW5nIGV4aXN0aW5nXG5cdFx0XHRcdFx0cmV0dXJuIEdsb2JhbC5yb290VXJsICsgXCIvY2hhcnRzL1wiICsgdGhpcy5pZDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvL3NhdmluZyBuZXdcblx0XHRcdFx0XHRyZXR1cm4gR2xvYmFsLnJvb3RVcmwgKyBcIi9jaGFydHNcIjtcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiBHbG9iYWwucm9vdFVybCArIFwiL2RhdGEvY29uZmlnL1wiICsgdGhpcy5pZDtcblx0XHRcdH1cblx0XHR9LFxuXG5cdFx0ZGVmYXVsdHM6IHtcblx0XHRcdFwiY2FjaGVcIjogdHJ1ZSxcblx0XHRcdFwic2VsZWN0ZWQtY291bnRyaWVzXCI6IFtdLFxuXHRcdFx0XCJ0YWJzXCI6IFsgXCJjaGFydFwiLCBcImRhdGFcIiwgXCJzb3VyY2VzXCIgXSxcblx0XHRcdFwibGluZS10eXBlXCI6IFwiMlwiLFxuXHRcdFx0XCJjaGFydC1kZXNjcmlwdGlvblwiOiBcIlwiLFxuXHRcdFx0XCJjaGFydC1kaW1lbnNpb25zXCI6IFtdLFxuXHRcdFx0XCJ2YXJpYWJsZXNcIjogW10sXG5cdFx0XHRcInktYXhpc1wiOiB7fSxcblx0XHRcdFwieC1heGlzXCI6IHt9LFxuXHRcdFx0XCJtYXJnaW5zXCI6IHsgdG9wOiAxMCwgbGVmdDogNjAsIGJvdHRvbTogMTAsIHJpZ2h0OiAxMCB9LFxuXHRcdFx0XCJ1bml0c1wiOiBcIlwiLFxuXHRcdFx0XCJpZnJhbWUtd2lkdGhcIjogXCIxMDAlXCIsXG5cdFx0XHRcImlmcmFtZS1oZWlnaHRcIjogXCI2NjBweFwiLFxuXHRcdFx0XCJoaWRlLWxlZ2VuZFwiOiBmYWxzZSxcblx0XHRcdFwiZ3JvdXAtYnktdmFyaWFibGVzXCI6IGZhbHNlLFxuXHRcdFx0XCJhZGQtY291bnRyeS1tb2RlXCI6IFwiYWRkLWNvdW50cnlcIixcblx0XHRcdFwieC1heGlzLXNjYWxlLXNlbGVjdG9yXCI6IGZhbHNlLFxuXHRcdFx0XCJ5LWF4aXMtc2NhbGUtc2VsZWN0b3JcIjogZmFsc2UsXG5cdFx0XHRcIm1hcC1jb25maWdcIjoge1xuXHRcdFx0XHRcInZhcmlhYmxlSWRcIjogLTEsXG5cdFx0XHRcdFwibWluWWVhclwiOiAxOTgwLFxuXHRcdFx0XHRcIm1heFllYXJcIjogMjAwMCxcblx0XHRcdFx0XCJ0YXJnZXRZZWFyXCI6IDE5ODAsXG5cdFx0XHRcdFwibW9kZVwiOiBcInNwZWNpZmljXCIsXG5cdFx0XHRcdFwidGltZVRvbGVyYW5jZVwiOiAxMCxcblx0XHRcdFx0XCJ0aW1lSW50ZXJ2YWxcIjogMTAsXG5cdFx0XHRcdFwiY29sb3JTY2hlbWVOYW1lXCI6IFwiQnVHblwiLFxuXHRcdFx0XHRcImNvbG9yU2NoZW1lSW50ZXJ2YWxcIjogNSxcblx0XHRcdFx0XCJwcm9qZWN0aW9uXCI6IFwiV29ybGRcIixcblx0XHRcdH1cblx0XHR9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oKSB7XG5cblx0XHRcdHRoaXMub24oIFwic3luY1wiLCB0aGlzLm9uU3luYywgdGhpcyApO1xuXHRcdFxuXHRcdH0sXG5cblx0XHRvblN5bmM6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHRpZiggdGhpcy5nZXQoIFwiY2hhcnQtdHlwZVwiICkgPT0gMiApIHtcblx0XHRcdFx0Ly9tYWtlIHN1cmUgZm9yIHNjYXR0ZXIgcGxvdCwgd2UgaGF2ZSBjb2xvciBzZXQgYXMgY29udGluZW50c1xuXHRcdFx0XHR2YXIgY2hhcnREaW1lbnNpb25zID0gJC5wYXJzZUpTT04oIHRoaXMuZ2V0KCBcImNoYXJ0LWRpbWVuc2lvbnNcIiApICk7XG5cdFx0XHRcdGlmKCAhXy5maW5kV2hlcmUoIGNoYXJ0RGltZW5zaW9ucywgeyBcInByb3BlcnR5XCI6IFwiY29sb3JcIiB9ICkgKSB7XG5cdFx0XHRcdFx0Ly90aGlzIGlzIHdoZXJlIHdlIGFkZCBjb2xvciBwcm9wZXJ0eVxuXHRcdFx0XHRcdHZhciBjb2xvclByb3BPYmogPSB7IFwidmFyaWFibGVJZFwiOlwiMTIzXCIsXCJwcm9wZXJ0eVwiOlwiY29sb3JcIixcInVuaXRcIjpcIlwiLFwibmFtZVwiOlwiQ29sb3JcIixcInBlcmlvZFwiOlwic2luZ2xlXCIsXCJtb2RlXCI6XCJzcGVjaWZpY1wiLFwidGFyZ2V0WWVhclwiOlwiMjAwMFwiLFwidG9sZXJhbmNlXCI6XCI1XCIsXCJtYXhpbXVtQWdlXCI6XCI1XCJ9O1xuXHRcdFx0XHRcdGNoYXJ0RGltZW5zaW9ucy5wdXNoKCBjb2xvclByb3BPYmogKTtcblx0XHRcdFx0XHR2YXIgY2hhckRpbWVuc2lvbnNTdHJpbmcgPSBKU09OLnN0cmluZ2lmeSggY2hhcnREaW1lbnNpb25zICk7XG5cdFx0XHRcdFx0dGhpcy5zZXQoIFwiY2hhcnQtZGltZW5zaW9uc1wiLCBjaGFyRGltZW5zaW9uc1N0cmluZyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRcblx0XHR9LFxuXG5cdFx0YWRkU2VsZWN0ZWRDb3VudHJ5OiBmdW5jdGlvbiggY291bnRyeSApIHtcblxuXHRcdFx0Ly9tYWtlIHN1cmUgd2UncmUgdXNpbmcgb2JqZWN0LCBub3QgYXNzb2NpYXRpdmUgYXJyYXlcblx0XHRcdC8qaWYoICQuaXNBcnJheSggdGhpcy5nZXQoIFwic2VsZWN0ZWQtY291bnRyaWVzXCIgKSApICkge1xuXHRcdFx0XHQvL3dlIGdvdCBlbXB0eSBhcnJheSBmcm9tIGRiLCBjb252ZXJ0IHRvIG9iamVjdFxuXHRcdFx0XHR0aGlzLnNldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiwge30gKTtcblx0XHRcdH0qL1xuXHRcdFx0XG5cdFx0XHR2YXIgc2VsZWN0ZWRDb3VudHJpZXMgPSB0aGlzLmdldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiApO1xuXG5cdFx0XHQvL21ha2Ugc3VyZSB0aGUgc2VsZWN0ZWQgY29udHJ5IGlzIG5vdCB0aGVyZSBcblx0XHRcdGlmKCAhXy5maW5kV2hlcmUoIHNlbGVjdGVkQ291bnRyaWVzLCB7IGlkOiBjb3VudHJ5LmlkIH0gKSApIHtcblx0XHRcdFxuXHRcdFx0XHRzZWxlY3RlZENvdW50cmllcy5wdXNoKCBjb3VudHJ5ICk7XG5cdFx0XHRcdC8vc2VsZWN0ZWRDb3VudHJpZXNbIGNvdW50cnkuaWQgXSA9IGNvdW50cnk7XG5cdFx0XHRcdHRoaXMudHJpZ2dlciggXCJjaGFuZ2U6c2VsZWN0ZWQtY291bnRyaWVzXCIgKTtcblx0XHRcdFx0dGhpcy50cmlnZ2VyKCBcImNoYW5nZVwiICk7XG5cdFx0XHRcblx0XHRcdH1cblx0XHRcdFxuXHRcdH0sXG5cblx0XHR1cGRhdGVTZWxlY3RlZENvdW50cnk6IGZ1bmN0aW9uKCBjb3VudHJ5SWQsIGNvbG9yICkge1xuXG5cdFx0XHR2YXIgY291bnRyeSA9IHRoaXMuZmluZENvdW50cnlCeUlkKCBjb3VudHJ5SWQgKTtcblx0XHRcdGlmKCBjb3VudHJ5ICkge1xuXHRcdFx0XHRjb3VudHJ5LmNvbG9yID0gY29sb3I7XG5cdFx0XHRcdHRoaXMudHJpZ2dlciggXCJjaGFuZ2U6c2VsZWN0ZWQtY291bnRyaWVzXCIgKTtcblx0XHRcdFx0dGhpcy50cmlnZ2VyKCBcImNoYW5nZVwiICk7XG5cdFx0XHR9XG5cblx0XHR9LFxuXG5cdFx0cmVtb3ZlU2VsZWN0ZWRDb3VudHJ5OiBmdW5jdGlvbiggY291bnRyeUlkICkge1xuXG5cdFx0XHR2YXIgY291bnRyeSA9IHRoaXMuZmluZENvdW50cnlCeUlkKCBjb3VudHJ5SWQgKTtcblx0XHRcdGlmKCBjb3VudHJ5ICkge1xuXHRcdFx0XHR2YXIgc2VsZWN0ZWRDb3VudHJpZXMgPSB0aGlzLmdldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiApLFxuXHRcdFx0XHRcdGNvdW50cnlJbmRleCA9IF8uaW5kZXhPZiggc2VsZWN0ZWRDb3VudHJpZXMsIGNvdW50cnkgKTtcblx0XHRcdFx0c2VsZWN0ZWRDb3VudHJpZXMuc3BsaWNlKCBjb3VudHJ5SW5kZXgsIDEgKTtcblx0XHRcdFx0dGhpcy50cmlnZ2VyKCBcImNoYW5nZTpzZWxlY3RlZC1jb3VudHJpZXNcIiApO1xuXHRcdFx0XHR0aGlzLnRyaWdnZXIoIFwiY2hhbmdlXCIgKTtcblx0XHRcdH1cblxuXHRcdH0sXG5cblx0XHRyZXBsYWNlU2VsZWN0ZWRDb3VudHJ5OiBmdW5jdGlvbiggY291bnRyeSApIHtcblx0XHRcdGlmKCBjb3VudHJ5ICkge1xuXHRcdFx0XHR0aGlzLnNldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiwgWyBjb3VudHJ5IF0gKTtcblx0XHRcdH1cblx0XHR9LFxuXG5cdFx0ZmluZENvdW50cnlCeUlkOiBmdW5jdGlvbiggY291bnRyeUlkICkge1xuXG5cdFx0XHR2YXIgc2VsZWN0ZWRDb3VudHJpZXMgPSB0aGlzLmdldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiApLFxuXHRcdFx0XHRjb3VudHJ5ID0gXy5maW5kV2hlcmUoIHNlbGVjdGVkQ291bnRyaWVzLCB7IGlkOiBjb3VudHJ5SWQudG9TdHJpbmcoKSB9ICk7XG5cdFx0XHRyZXR1cm4gY291bnRyeTtcblxuXHRcdH0sXG5cblx0XHRzZXRBeGlzQ29uZmlnOiBmdW5jdGlvbiggYXhpc05hbWUsIHByb3AsIHZhbHVlICkge1xuXG5cdFx0XHRpZiggJC5pc0FycmF5KCB0aGlzLmdldCggXCJ5LWF4aXNcIiApICkgKSB7XG5cdFx0XHRcdC8vd2UgZ290IGVtcHR5IGFycmF5IGZyb20gZGIsIGNvbnZlcnQgdG8gb2JqZWN0XG5cdFx0XHRcdHRoaXMuc2V0KCBcInktYXhpc1wiLCB7fSApO1xuXHRcdFx0fVxuXHRcdFx0aWYoICQuaXNBcnJheSggdGhpcy5nZXQoIFwieC1heGlzXCIgKSApICkge1xuXHRcdFx0XHQvL3dlIGdvdCBlbXB0eSBhcnJheSBmcm9tIGRiLCBjb252ZXJ0IHRvIG9iamVjdFxuXHRcdFx0XHR0aGlzLnNldCggXCJ4LWF4aXNcIiwge30gKTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0dmFyIGF4aXMgPSB0aGlzLmdldCggYXhpc05hbWUgKTtcblx0XHRcdGlmKCBheGlzICkge1xuXHRcdFx0XHRheGlzWyBwcm9wIF0gPSB2YWx1ZTtcblx0XHRcdH1cblx0XHRcdHRoaXMudHJpZ2dlciggXCJjaGFuZ2VcIiApO1xuXG5cdFx0fSxcblxuXHRcdHVwZGF0ZVZhcmlhYmxlczogZnVuY3Rpb24oIG5ld1ZhciApIHtcblx0XHRcdC8vY29weSBhcnJheVxuXHRcdFx0dmFyIHZhcmlhYmxlcyA9IHRoaXMuZ2V0KCBcInZhcmlhYmxlc1wiICkuc2xpY2UoKSxcblx0XHRcdFx0dmFySW5BcnIgPSBfLmZpbmQoIHZhcmlhYmxlcywgZnVuY3Rpb24oIHYgKXsgcmV0dXJuIHYuaWQgPT0gbmV3VmFyLmlkOyB9ICk7XG5cblx0XHRcdGlmKCAhdmFySW5BcnIgKSB7XG5cdFx0XHRcdHZhcmlhYmxlcy5wdXNoKCBuZXdWYXIgKTtcblx0XHRcdFx0dGhpcy5zZXQoIFwidmFyaWFibGVzXCIsIHZhcmlhYmxlcyApO1xuXHRcdFx0fVxuXHRcdH0sXG5cblx0XHRyZW1vdmVWYXJpYWJsZTogZnVuY3Rpb24oIHZhcklkVG9SZW1vdmUgKSB7XG5cdFx0XHQvL2NvcHkgYXJyYXlcblx0XHRcdHZhciB2YXJpYWJsZXMgPSB0aGlzLmdldCggXCJ2YXJpYWJsZXNcIiApLnNsaWNlKCksXG5cdFx0XHRcdHZhckluQXJyID0gXy5maW5kKCB2YXJpYWJsZXMsIGZ1bmN0aW9uKCB2ICl7IHJldHVybiB2LmlkID09IG5ld1Zhci5pZDsgfSApO1xuXG5cdFx0XHRpZiggIXZhckluQXJyICkge1xuXHRcdFx0XHR2YXJpYWJsZXMucHVzaCggbmV3VmFyICk7XG5cdFx0XHRcdHRoaXMuc2V0KCBcInZhcmlhYmxlc1wiLCB2YXJpYWJsZXMgKTtcblx0XHRcdH1cblx0XHR9LFxuXG5cdFx0dXBkYXRlTWFwQ29uZmlnOiBmdW5jdGlvbiggcHJvcE5hbWUsIHByb3BWYWx1ZSwgc2lsZW50LCBldmVudE5hbWUgKSB7XG5cblx0XHRcdHZhciBtYXBDb25maWcgPSB0aGlzLmdldCggXCJtYXAtY29uZmlnXCIgKTtcblx0XHRcdGlmKCBtYXBDb25maWcuaGFzT3duUHJvcGVydHkoIHByb3BOYW1lICkgKSB7XG5cdFx0XHRcdG1hcENvbmZpZ1sgcHJvcE5hbWUgXSA9IHByb3BWYWx1ZTtcblx0XHRcdFx0aWYoICFzaWxlbnQgKSB7XG5cdFx0XHRcdFx0dmFyIGV2dCA9ICggZXZlbnROYW1lICk/IGV2ZW50TmFtZTogXCJjaGFuZ2VcIjtcblx0XHRcdFx0XHR0aGlzLnRyaWdnZXIoIGV2dCApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHR9XG5cblxuXHR9ICk7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuTW9kZWxzLkNoYXJ0TW9kZWw7XG5cbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBBcHAgPSByZXF1aXJlKCBcIi4vLi4vbmFtZXNwYWNlcy5qc1wiICk7XG5cblx0QXBwLk1vZGVscy5DaGFydFZhcmlhYmxlTW9kZWwgPSBCYWNrYm9uZS5Nb2RlbC5leHRlbmQoIHtcblx0XHRcblx0XHRkZWZhdWx0czoge31cblxuXHR9ICk7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuTW9kZWxzLkNoYXJ0VmFyaWFibGVNb2RlbDtcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIEFwcCA9IHJlcXVpcmUoIFwiLi8uLi9uYW1lc3BhY2VzLmpzXCIgKTtcblx0XG5cdEFwcC5Nb2RlbHMuRW50aXR5TW9kZWwgPSBCYWNrYm9uZS5Nb2RlbC5leHRlbmQoIHtcblx0XHRcblx0XHR1cmxSb290OiBHbG9iYWwucm9vdFVybCArIFwiL2VudGl0eS9cIixcblx0XHRkZWZhdWx0czogeyBcImlkXCI6IFwiXCIsIFwibmFtZVwiOiBcIlwiLCBcInZhbHVlc1wiOiBbXSB9LFxuXG5cdFx0aW1wb3J0OiBmdW5jdGlvbigpIHtcblxuXHRcdFx0Ly9zdHJpcCBpZCwgc28gdGhhdCBiYWNrYm9uZSB1c2VzIHN0b3JlIFxuXHRcdFx0dGhpcy5zZXQoIFwiaWRcIiwgbnVsbCApO1xuXG5cdFx0XHR0aGlzLnVybCA9IHRoaXMudXJsUm9vdCArICdpbXBvcnQnO1xuXG5cdFx0XHR0aGlzLnNhdmUoKTtcblxuXHRcdH1cblxuXHR9ICk7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuTW9kZWxzLkVudGl0eU1vZGVsO1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0Ly9uYW1lc3BhY2VzXG5cdHZhciBBcHAgPSB7fTtcblx0QXBwLlZpZXdzID0ge307XG5cdEFwcC5WaWV3cy5DaGFydCA9IHt9O1xuXHRBcHAuVmlld3MuQ2hhcnQuTWFwID0ge307XG5cdEFwcC5WaWV3cy5Gb3JtID0ge307XG5cdEFwcC5WaWV3cy5VSSA9IHt9O1xuXHRBcHAuTW9kZWxzID0ge307XG5cdEFwcC5Nb2RlbHMuSW1wb3J0ID0ge307XG5cdEFwcC5Db2xsZWN0aW9ucyA9IHt9O1xuXHRBcHAuVXRpbHMgPSB7fTtcblx0QXBwLlV0aWxzLkZvcm1IZWxwZXIgPSB7fTtcblxuXHQvL2V4cG9ydCBmb3IgaWZyYW1lXG5cdHdpbmRvdy4kID0galF1ZXJ5O1xuXG5cdC8vZXhwb3J0XG5cdC8vd2luZG93LkFwcCA9IEFwcDtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcDtcblxufSkoKTtcblxuIiwiOyggZnVuY3Rpb24oKSB7XG5cdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgQXBwID0gcmVxdWlyZSggXCIuLy4uL25hbWVzcGFjZXMuanNcIiApLFxuXHRcdEhlYWRlciA9IHJlcXVpcmUoIFwiLi9jaGFydC9BcHAuVmlld3MuQ2hhcnQuSGVhZGVyLmpzXCIgKSxcblx0XHRTY2FsZVNlbGVjdG9ycyA9IHJlcXVpcmUoIFwiLi9jaGFydC9BcHAuVmlld3MuQ2hhcnQuU2NhbGVTZWxlY3RvcnNcIiApLFxuXHRcdENoYXJ0VGFiID0gcmVxdWlyZSggXCIuL2NoYXJ0L0FwcC5WaWV3cy5DaGFydC5DaGFydFRhYi5qc1wiICksXG5cdFx0RGF0YVRhYiA9IHJlcXVpcmUoIFwiLi9jaGFydC9BcHAuVmlld3MuQ2hhcnQuRGF0YVRhYi5qc1wiICksXG5cdFx0U291cmNlc1RhYiA9IHJlcXVpcmUoIFwiLi9jaGFydC9BcHAuVmlld3MuQ2hhcnQuU291cmNlc1RhYi5qc1wiICksXG5cdFx0TWFwVGFiID0gcmVxdWlyZSggXCIuL2NoYXJ0L0FwcC5WaWV3cy5DaGFydC5NYXBUYWIuanNcIiApLFxuXHRcdENoYXJ0RGF0YU1vZGVsID0gcmVxdWlyZSggXCIuLy4uL21vZGVscy9BcHAuTW9kZWxzLkNoYXJ0RGF0YU1vZGVsLmpzXCIgKSxcblx0XHRVdGlscyA9IHJlcXVpcmUoIFwiLi8uLi9BcHAuVXRpbHMuanNcIiApO1xuXG5cdEFwcC5WaWV3cy5DaGFydFZpZXcgPSBCYWNrYm9uZS5WaWV3LmV4dGVuZCh7XG5cblx0XHRlbDogXCIjY2hhcnQtdmlld1wiLFxuXHRcdGV2ZW50czoge1xuXHRcdFx0XCJjbGljayAuY2hhcnQtc2F2ZS1wbmctYnRuXCI6IFwiZXhwb3J0Q29udGVudFwiLFxuXHRcdFx0XCJjbGljayAuY2hhcnQtc2F2ZS1zdmctYnRuXCI6IFwiZXhwb3J0Q29udGVudFwiXG5cdFx0fSxcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0XG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIgPSBvcHRpb25zLmRpc3BhdGNoZXI7XG5cdFx0XHRcblx0XHRcdHZhciBjaGlsZFZpZXdPcHRpb25zID0geyBkaXNwYXRjaGVyOiB0aGlzLmRpc3BhdGNoZXIsIHBhcmVudFZpZXc6IHRoaXMgfTtcblx0XHRcdHRoaXMuaGVhZGVyID0gbmV3IEhlYWRlciggY2hpbGRWaWV3T3B0aW9ucyApO1xuXHRcdFx0dGhpcy5zY2FsZVNlbGVjdG9ycyA9IG5ldyBTY2FsZVNlbGVjdG9ycyggY2hpbGRWaWV3T3B0aW9ucyApO1xuXHRcdFx0Ly90YWJzXG5cdFx0XHR0aGlzLmNoYXJ0VGFiID0gbmV3IENoYXJ0VGFiKCBjaGlsZFZpZXdPcHRpb25zICk7XG5cdFx0XHR0aGlzLmRhdGFUYWIgPSBuZXcgRGF0YVRhYiggY2hpbGRWaWV3T3B0aW9ucyApO1xuXHRcdFx0dGhpcy5zb3VyY2VzVGFiID0gbmV3IFNvdXJjZXNUYWIoIGNoaWxkVmlld09wdGlvbnMgKTtcblx0XHRcdHRoaXMubWFwVGFiID0gbmV3IE1hcFRhYiggY2hpbGRWaWV3T3B0aW9ucyApO1xuXG5cdFx0XHQvL3NldHVwIG1vZGVsIHRoYXQgd2lsbCBmZXRjaCBhbGwgdGhlIGRhdGEgZm9yIHVzXG5cdFx0XHR0aGlzLmRhdGFNb2RlbCA9IG5ldyBDaGFydERhdGFNb2RlbCgpO1xuXHRcdFx0XG5cdFx0XHQvL3NldHVwIGV2ZW50c1xuXHRcdFx0dGhpcy5kYXRhTW9kZWwub24oIFwic3luY1wiLCB0aGlzLm9uRGF0YU1vZGVsU3luYywgdGhpcyApO1xuXHRcdFx0dGhpcy5kYXRhTW9kZWwub24oIFwiZXJyb3JcIiwgdGhpcy5vbkRhdGFNb2RlbEVycm9yLCB0aGlzICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5vbiggXCJjaGFuZ2VcIiwgdGhpcy5vbkNoYXJ0TW9kZWxDaGFuZ2UsIHRoaXMgKTtcblxuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblxuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cblx0XHRcdHRoaXMuJHByZWxvYWRlciA9IHRoaXMuJGVsLmZpbmQoIFwiLmNoYXJ0LXByZWxvYWRlclwiICk7XG5cdFx0XHR0aGlzLiRlcnJvciA9IHRoaXMuJGVsLmZpbmQoIFwiLmNoYXJ0LWVycm9yXCIgKTtcblxuXHRcdFx0Ly9jaGFydCB0YWJcblx0XHRcdHRoaXMuJHN2ZyA9IHRoaXMuJGVsLmZpbmQoIFwiI2NoYXJ0LWNoYXJ0LXRhYiBzdmdcIiApO1xuXHRcdFx0dGhpcy4kdGFiQ29udGVudCA9IHRoaXMuJGVsLmZpbmQoIFwiLnRhYi1jb250ZW50XCIgKTtcblx0XHRcdHRoaXMuJHRhYlBhbmVzID0gdGhpcy4kZWwuZmluZCggXCIudGFiLXBhbmVcIiApO1xuXHRcdFx0dGhpcy4kY2hhcnRIZWFkZXIgPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1oZWFkZXJcIiApO1xuXHRcdFx0dGhpcy4kZW50aXRpZXNTZWxlY3QgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPWF2YWlsYWJsZV9lbnRpdGllc11cIiApO1xuXHRcdFx0dGhpcy4kY2hhcnRGb290ZXIgPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1mb290ZXJcIiApO1xuXHRcdFx0dGhpcy4kY2hhcnROYW1lID0gdGhpcy4kZWwuZmluZCggXCIuY2hhcnQtbmFtZVwiICk7XG5cdFx0XHR0aGlzLiRjaGFydFN1Ym5hbWUgPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1zdWJuYW1lXCIgKTtcblx0XHRcdHRoaXMuJGNoYXJ0RGVzY3JpcHRpb24gPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1kZXNjcmlwdGlvblwiICk7XG5cdFx0XHR0aGlzLiRjaGFydFNvdXJjZXMgPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1zb3VyY2VzXCIgKTtcblx0XHRcdHRoaXMuJGNoYXJ0RnVsbFNjcmVlbiA9IHRoaXMuJGVsLmZpbmQoIFwiLmZhbmN5Ym94LWlmcmFtZVwiICk7XG5cblx0XHRcdHRoaXMuJHhBeGlzU2NhbGVTZWxlY3RvciA9IHRoaXMuJGVsLmZpbmQoIFwiLngtYXhpcy1zY2FsZS1zZWxlY3RvclwiICk7XG5cdFx0XHR0aGlzLiR4QXhpc1NjYWxlID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT14X2F4aXNfc2NhbGVdXCIgKTtcblx0XHRcdHRoaXMuJHlBeGlzU2NhbGVTZWxlY3RvciA9IHRoaXMuJGVsLmZpbmQoIFwiLnktYXhpcy1zY2FsZS1zZWxlY3RvclwiICk7XG5cdFx0XHR0aGlzLiR5QXhpc1NjYWxlID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT15X2F4aXNfc2NhbGVdXCIgKTtcblxuXHRcdFx0dGhpcy4kcmVsb2FkQnRuID0gdGhpcy4kZWwuZmluZCggXCIucmVsb2FkLWJ0blwiICk7XG5cblx0XHRcdHZhciBjaGFydE5hbWUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtbmFtZVwiICksXG5cdFx0XHRcdGFkZENvdW50cnlNb2RlID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImFkZC1jb3VudHJ5LW1vZGVcIiApLFxuXHRcdFx0XHRmb3JtQ29uZmlnID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImZvcm0tY29uZmlnXCIgKSxcblx0XHRcdFx0ZW50aXRpZXMgPSAoIGZvcm1Db25maWcgJiYgZm9ybUNvbmZpZ1sgXCJlbnRpdGllcy1jb2xsZWN0aW9uXCIgXSApPyBmb3JtQ29uZmlnWyBcImVudGl0aWVzLWNvbGxlY3Rpb25cIiBdOiBbXSxcblx0XHRcdFx0c2VsZWN0ZWRDb3VudHJpZXMgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwic2VsZWN0ZWQtY291bnRyaWVzXCIgKSxcblx0XHRcdFx0c2VsZWN0ZWRDb3VudHJpZXNJZHMgPSBfLm1hcCggc2VsZWN0ZWRDb3VudHJpZXMsIGZ1bmN0aW9uKCB2ICkgeyByZXR1cm4gKHYpPyArdi5pZDogXCJcIjsgfSApLFxuXHRcdFx0XHRjaGFydFRpbWUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdGltZVwiICk7XG5cdFx0XHRcdFxuXHRcdFx0Ly9taWdodCBuZWVkIHRvIHJlcGxhY2UgY291bnRyeSBpbiB0aXRsZSwgaWYgXCJjaGFuZ2UgY291bnRyeVwiIG1vZGVcblx0XHRcdGlmKCBhZGRDb3VudHJ5TW9kZSA9PT0gXCJjaGFuZ2UtY291bnRyeVwiICkge1xuXHRcdFx0XHQvL3llcCwgcHJvYmFibHkgbmVlZCByZXBsYWNpbmcgY291bnRyeSBpbiB0aXRsZSAoc2VsZWN0IGZpcnN0IGNvdW50cnkgZm9ybSBzdG9yZWQgb25lKVxuXHRcdFx0XHRpZiggc2VsZWN0ZWRDb3VudHJpZXMgJiYgc2VsZWN0ZWRDb3VudHJpZXMubGVuZ3RoICkge1xuXHRcdFx0XHRcdHZhciBjb3VudHJ5ID0gc2VsZWN0ZWRDb3VudHJpZXNbMF07XG5cdFx0XHRcdFx0Y2hhcnROYW1lID0gY2hhcnROYW1lLnJlcGxhY2UoIFwiKmNvdW50cnkqXCIsIGNvdW50cnkubmFtZSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vdXBkYXRlIHZhbHVlc1xuXHRcdFx0dGhpcy4kY2hhcnROYW1lLnRleHQoIGNoYXJ0TmFtZSApO1xuXHRcdFx0dGhpcy4kY2hhcnRTdWJuYW1lLmh0bWwoIEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC1zdWJuYW1lXCIgKSApO1xuXG5cdFx0XHR2YXIgY2hhcnREZXNjcmlwdGlvbiA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC1kZXNjcmlwdGlvblwiICk7XG5cdFx0XHQvL3RoaXMuJGNoYXJ0RGVzY3JpcHRpb24udGV4dCggQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LWRlc2NyaXB0aW9uXCIgKSApO1xuXG5cdFx0XHQvL3Nob3cvaGlkZSBzY2FsZSBzZWxlY3RvcnNcblx0XHRcdHZhciBzaG93WFNjYWxlU2VsZWN0b3JzID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcIngtYXhpcy1zY2FsZS1zZWxlY3RvclwiICk7XG5cdFx0XHRpZiggc2hvd1hTY2FsZVNlbGVjdG9ycyApIHtcblx0XHRcdFx0dGhpcy4keEF4aXNTY2FsZVNlbGVjdG9yLnNob3coKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuJHhBeGlzU2NhbGVTZWxlY3Rvci5oaWRlKCk7XG5cdFx0XHR9XG5cdFx0XHR2YXIgc2hvd1lTY2FsZVNlbGVjdG9ycyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJ5LWF4aXMtc2NhbGUtc2VsZWN0b3JcIiApO1xuXHRcdFx0aWYoIHNob3dZU2NhbGVTZWxlY3RvcnMgKSB7XG5cdFx0XHRcdHRoaXMuJHlBeGlzU2NhbGVTZWxlY3Rvci5zaG93KCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLiR5QXhpc1NjYWxlU2VsZWN0b3IuaGlkZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHQvL3VwZGF0ZSBjb3VudHJpZXNcblx0XHRcdHRoaXMuJGVudGl0aWVzU2VsZWN0LmVtcHR5KCk7XG5cdFx0XHRpZiggc2VsZWN0ZWRDb3VudHJpZXNJZHMubGVuZ3RoICkge1xuXHRcdFx0XHQvL2FwcGVuZCBlbXB0eSBkZWZhdWx0IG9wdGlvblxuXHRcdFx0XHR0aGF0LiRlbnRpdGllc1NlbGVjdC5hcHBlbmQoIFwiPG9wdGlvbiBkaXNhYmxlZCBzZWxlY3RlZD5TZWxlY3QgY291bnRyeTwvb3B0aW9uPlwiICk7XG5cdFx0XHRcdF8uZWFjaCggZW50aXRpZXMsIGZ1bmN0aW9uKCBkLCBpICkge1xuXHRcdFx0XHRcdC8vYWRkIG9ubHkgdGhvc2UgZW50aXRpZXMsIHdoaWNoIGFyZSBub3Qgc2VsZWN0ZWQgYWxyZWFkeVxuXHRcdFx0XHRcdGlmKCBfLmluZGV4T2YoIHNlbGVjdGVkQ291bnRyaWVzSWRzLCArZC5pZCApID09IC0xICkge1xuXHRcdFx0XHRcdFx0dGhhdC4kZW50aXRpZXNTZWxlY3QuYXBwZW5kKCBcIjxvcHRpb24gdmFsdWU9J1wiICsgZC5pZCArIFwiJz5cIiArIGQubmFtZSArIFwiPC9vcHRpb24+XCIgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gKTtcblx0XHRcdH1cblx0XHRcdC8vbWFrZSBjaG9zZW4gdXBkYXRlLCBtYWtlIHN1cmUgaXQgbG9vc2VzIGJsdXIgYXMgd2VsbFxuXHRcdFx0dGhpcy4kZW50aXRpZXNTZWxlY3QudHJpZ2dlciggXCJjaG9zZW46dXBkYXRlZFwiICk7XG5cblx0XHRcdHRoaXMuJGNoYXJ0RnVsbFNjcmVlbi5vbiggXCJjbGlja1wiLCBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0dmFyICR0aGlzID0gJCggdGhpcyApO1xuXHRcdFx0XHR3aW5kb3cucGFyZW50Lm9wZW5GYW5jeUJveCggJHRoaXMuYXR0ciggXCJocmVmXCIgKSApO1xuXHRcdFx0fSApO1xuXG5cdFx0XHQvL3JlZnJlc2ggYnRuXG5cdFx0XHR0aGlzLiRyZWxvYWRCdG4ub24oIFwiY2xpY2tcIiwgZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKTtcblx0XHRcdH0gKTtcblxuXHRcdFx0Ly9jaGFydCB0YWJcblx0XHRcdHRoaXMuJGNoYXJ0VGFiID0gdGhpcy4kZWwuZmluZCggXCIjY2hhcnQtY2hhcnQtdGFiXCIgKTtcblxuXHRcdFx0dmFyIGRpbWVuc2lvbnNTdHJpbmcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtZGltZW5zaW9uc1wiICksXG5cdFx0XHRcdHZhbGlkRGltZW5zaW9ucyA9IGZhbHNlO1xuXHRcdFx0XG5cdFx0XHQvL2NsaWNraW5nIGFueXRoaW5nIGluIGNoYXJ0IHNvdXJjZSB3aWxsIHRha2UgeW91IHRvIHNvdXJjZXMgdGFiXG5cdFx0XHR0aGlzLiRjaGFydFNvdXJjZXMub24oIFwiY2xpY2tcIiwgZnVuY3Rpb24oZXZ0KSB7XG5cdFx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHR2YXIgJGEgPSAkKCBcIltocmVmPScjc291cmNlcy1jaGFydC10YWInXVwiICk7XG5cdFx0XHRcdCRhLnRyaWdnZXIoIFwiY2xpY2tcIiApO1xuXHRcdFx0fSApO1xuXG5cdFx0XHQvL2NoZWNrIHdlIGhhdmUgYWxsIGRpbWVuc2lvbnMgbmVjZXNzYXJ5IFxuXHRcdFx0aWYoICEkLmlzRW1wdHlPYmplY3QoIGRpbWVuc2lvbnNTdHJpbmcgKSApIHtcblx0XHRcdFx0dmFyIGRpbWVuc2lvbiA9ICQucGFyc2VKU09OKCBkaW1lbnNpb25zU3RyaW5nICk7XG5cdFx0XHRcdHZhbGlkRGltZW5zaW9ucyA9IFV0aWxzLmNoZWNrVmFsaWREaW1lbnNpb25zKCBkaW1lbnNpb24sIEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10eXBlXCIgKSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vbWFrZSBzdXJlIHRvIGFwcGVhciBvbmx5IGZpcnN0IHRhYiB0YWJzIHRoYXQgYXJlIG5lY2Vzc2FyeVxuXHRcdFx0Ly9hcHBlYXIgb25seSBmaXJzdCB0YWIgaWYgbm9uZSB2aXNpYmxlXG5cdFx0XHRpZiggIXRoaXMuJHRhYlBhbmVzLmZpbHRlciggXCIuYWN0aXZlXCIgKS5sZW5ndGggKSB7XG5cdFx0XHRcdHZhciB0YWJzID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcInRhYnNcIiApLFxuXHRcdFx0XHRcdGZpcnN0VGFiTmFtZSA9IHRhYnNbIDAgXSxcblx0XHRcdFx0XHRmaXJzdFRhYlBhbmUgPSB0aGlzLiR0YWJQYW5lcy5maWx0ZXIoIFwiI1wiICsgZmlyc3RUYWJOYW1lICsgXCItY2hhcnQtdGFiXCIgKTtcblx0XHRcdFx0Zmlyc3RUYWJQYW5lLmFkZENsYXNzKCBcImFjdGl2ZVwiICk7XG5cdFx0XHRcdGlmKCBmaXJzdFRhYk5hbWUgPT09IFwibWFwXCIgKSB7XG5cdFx0XHRcdFx0Ly9tYXAgdGFiIG5lZWRzIHNwZWNpYWwgaW5pYWxpdGl6YXRpb25cblx0XHRcdFx0XHR0aGlzLm1hcFRhYi5kaXNwbGF5KCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0aWYoICF2YWxpZERpbWVuc2lvbnMgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0aWYoIGRpbWVuc2lvbnNTdHJpbmcgKSB7XG5cblx0XHRcdFx0dGhpcy4kcHJlbG9hZGVyLnNob3coKTtcblxuXHRcdFx0XHR2YXIgZGF0YVByb3BzID0geyBcImRpbWVuc2lvbnNcIjogZGltZW5zaW9uc1N0cmluZywgXCJjaGFydElkXCI6IEFwcC5DaGFydE1vZGVsLmdldCggXCJpZFwiICksIFwiY2hhcnRUeXBlXCI6IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10eXBlXCIgKSwgXCJzZWxlY3RlZENvdW50cmllc1wiOiBzZWxlY3RlZENvdW50cmllc0lkcywgXCJjaGFydFRpbWVcIjogY2hhcnRUaW1lLCBcImNhY2hlXCI6IEFwcC5DaGFydE1vZGVsLmdldCggXCJjYWNoZVwiICksIFwiZ3JvdXBCeVZhcmlhYmxlc1wiOiBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiZ3JvdXAtYnktdmFyaWFibGVzXCIgKSAgfTtcblx0XHRcdFx0XG5cdFx0XHRcdHRoaXMuZGF0YU1vZGVsLmZldGNoKCB7IGRhdGE6IGRhdGFQcm9wcyB9ICk7XG5cblx0XHRcdH0gZWxzZSB7XG5cblx0XHRcdFx0Ly9jbGVhciBhbnkgcHJldmlvdXMgY2hhcnRcblx0XHRcdFx0JCggXCJzdmdcIiApLmVtcHR5KCk7XG5cblx0XHRcdH1cblxuXHRcdH0sXG5cblx0XHRvbkNoYXJ0TW9kZWxDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdHRoaXMucmVuZGVyKCk7XG5cdFx0XHRcblx0XHR9LFxuXG5cdFx0b25EYXRhTW9kZWxTeW5jOiBmdW5jdGlvbiggbW9kZWwsIHJlc3BvbnNlICkge1xuXHRcdFx0dGhpcy4kZXJyb3IuaGlkZSgpO1xuXHRcdFx0dGhpcy4kcHJlbG9hZGVyLmhpZGUoKTtcblx0XHRcdGlmKCByZXNwb25zZS5kYXRhICkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZUNoYXJ0KCByZXNwb25zZS5kYXRhLCByZXNwb25zZS50aW1lVHlwZSwgcmVzcG9uc2UuZGltZW5zaW9ucyApO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5zb3VyY2VzVGFiLnJlbmRlciggcmVzcG9uc2UgKTtcblx0XHR9LFxuXG5cdFx0b25EYXRhTW9kZWxFcnJvcjogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLiRlcnJvci5zaG93KCk7XG5cdFx0XHR0aGlzLiRwcmVsb2FkZXIuaGlkZSgpO1xuXHRcdH0sXG5cblx0XHRleHBvcnRDb250ZW50OiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0XG5cdFx0XHQvL2h0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMjMyMTgxNzQvaG93LWRvLWktc2F2ZS1leHBvcnQtYW4tc3ZnLWZpbGUtYWZ0ZXItY3JlYXRpbmctYW4tc3ZnLXdpdGgtZDMtanMtaWUtc2FmYXJpLWFuXG5cdFx0XHR2YXIgJGJ0biA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICksXG5cdFx0XHRcdC8vc3RvcmUgcHJlLXByaW50aW5nIHN2Z1xuXHRcdFx0XHQkb2xkRWwgPSB0aGlzLiRlbCxcblx0XHRcdFx0JG5ld0VsID0gJG9sZEVsLmNsb25lKCksXG5cdFx0XHRcdGlzU3ZnID0gKCAkYnRuLmhhc0NsYXNzKCBcImNoYXJ0LXNhdmUtc3ZnLWJ0blwiICkgKT8gdHJ1ZTogZmFsc2U7XG5cdFx0XHRcblx0XHRcdCRvbGRFbC5yZXBsYWNlV2l0aCggJG5ld0VsICk7XG5cblx0XHRcdC8vZ3JhYiBhbGwgc3ZnXG5cdFx0XHR2YXIgJHN2ZyA9ICRuZXdFbC5maW5kKCBcInN2Z1wiICksXG5cdFx0XHRcdHN2ZyA9ICRzdmcuZ2V0KCAwICksXG5cdFx0XHRcdHN2Z1N0cmluZyA9IHN2Zy5vdXRlckhUTUw7XG5cblx0XHRcdC8vYWRkIHByaW50aW5nIHN0eWxlc1xuXHRcdFx0JHN2Zy5hdHRyKCBcImNsYXNzXCIsIFwibnZkMy1zdmcgZXhwb3J0LXN2Z1wiICk7XG5cblx0XHRcdC8vaW5saW5lIHN0eWxlcyBmb3IgdGhlIGV4cG9ydFxuXHRcdFx0dmFyIHN0eWxlU2hlZXRzID0gZG9jdW1lbnQuc3R5bGVTaGVldHM7XG5cdFx0XHRmb3IoIHZhciBpID0gMDsgaSA8IHN0eWxlU2hlZXRzLmxlbmd0aDsgaSsrICkge1xuXHRcdFx0XHRVdGlscy5pbmxpbmVDc3NTdHlsZSggc3R5bGVTaGVldHNbIGkgXS5jc3NSdWxlcyApO1xuXHRcdFx0fVxuXG5cdFx0XHQvL2RlcGVuZGluZyB3aGV0aGVyIHdlJ3JlIGNyZWF0aW5nIHN2ZyBvciBwbmcsIFxuXHRcdFx0aWYoIGlzU3ZnICkge1xuXG5cdFx0XHRcdHZhciBzZXJpYWxpemVyID0gbmV3IFhNTFNlcmlhbGl6ZXIoKSxcblx0XHRcdFx0c291cmNlID0gc2VyaWFsaXplci5zZXJpYWxpemVUb1N0cmluZyhzdmcpO1xuXHRcdFx0XHQvL2FkZCBuYW1lIHNwYWNlcy5cblx0XHRcdFx0aWYoIXNvdXJjZS5tYXRjaCgvXjxzdmdbXj5dK3htbG5zPVwiaHR0cFxcOlxcL1xcL3d3d1xcLnczXFwub3JnXFwvMjAwMFxcL3N2Z1wiLykpe1xuXHRcdFx0XHRcdHNvdXJjZSA9IHNvdXJjZS5yZXBsYWNlKC9ePHN2Zy8sICc8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIicpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmKCFzb3VyY2UubWF0Y2goL148c3ZnW14+XStcImh0dHBcXDpcXC9cXC93d3dcXC53M1xcLm9yZ1xcLzE5OTlcXC94bGlua1wiLykpe1xuXHRcdFx0XHRcdHNvdXJjZSA9IHNvdXJjZS5yZXBsYWNlKC9ePHN2Zy8sICc8c3ZnIHhtbG5zOnhsaW5rPVwiaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGlua1wiJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdC8vYWRkIHhtbCBkZWNsYXJhdGlvblxuXHRcdFx0XHRzb3VyY2UgPSAnPD94bWwgdmVyc2lvbj1cIjEuMFwiIHN0YW5kYWxvbmU9XCJub1wiPz5cXHJcXG4nICsgc291cmNlO1xuXG5cdFx0XHRcdC8vY29udmVydCBzdmcgc291cmNlIHRvIFVSSSBkYXRhIHNjaGVtZS5cblx0XHRcdFx0dmFyIHVybCA9IFwiZGF0YTppbWFnZS9zdmcreG1sO2NoYXJzZXQ9dXRmLTgsXCIrZW5jb2RlVVJJQ29tcG9uZW50KHNvdXJjZSk7XG5cdFx0XHRcdCRidG4uYXR0ciggXCJocmVmXCIsIHVybCApO1xuXG5cdFx0XHR9IGVsc2Uge1xuXG5cdFx0XHRcdHZhciAkc3ZnQ2FudmFzID0gJCggXCIubnZkMy1zdmdcIiApO1xuXHRcdFx0XHRpZiggJHN2Z0NhbnZhcy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0c2F2ZVN2Z0FzUG5nKCAkKCBcIi5udmQzLXN2Z1wiICkuZ2V0KCAwICksIFwiY2hhcnQucG5nXCIpO1xuXG5cdFx0XHRcdFx0Ly90ZW1wIGhhY2sgLSByZW1vdmUgaW1hZ2Ugd2hlbiBleHBvcnRpbmcgdG8gcG5nXG5cdFx0XHRcdFx0Lyp2YXIgJHN2Z0xvZ28gPSAkKCBcIi5jaGFydC1sb2dvLXN2Z1wiICk7XG5cdFx0XHRcdFx0JHN2Z0xvZ28ucmVtb3ZlKCk7XG5cblx0XHRcdFx0XHRzYXZlU3ZnQXNQbmcoICQoIFwiLm52ZDMtc3ZnXCIgKS5nZXQoIDAgKSwgXCJjaGFydC5wbmdcIik7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0JHN2Zy5wcmVwZW5kKCAkc3ZnTG9nbyApOyovXG5cdFx0XHRcdFx0XG5cdFx0XHRcdH1cblxuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHQvL2FkZCBiYWNrIHRoZSBwcmludGVkIHN2Z1xuXHRcdFx0JG5ld0VsLnJlcGxhY2VXaXRoKCAkb2xkRWwgKTtcblx0XHRcdC8vcmVmcmVzaCBsaW5rXG5cdFx0XHQkb2xkRWwuZmluZCggXCIuY2hhcnQtc2F2ZS1zdmctYnRuXCIgKS5vbiggXCJjbGlja1wiLCAkLnByb3h5KCB0aGlzLmV4cG9ydENvbnRlbnQsIHRoaXMgKSApO1xuXG5cdFx0fSxcblxuXHRcdHVwZGF0ZUNoYXJ0OiBmdW5jdGlvbiggZGF0YSwgdGltZVR5cGUsIGRpbWVuc2lvbnMgKSB7XG5cblx0XHRcdHRoaXMuY2hhcnRUYWIucmVuZGVyKCBkYXRhLCB0aW1lVHlwZSwgZGltZW5zaW9ucyApO1xuXHRcdFxuXHRcdH0sXG5cdFxuXHRcdG9uUmVzaXplOiBmdW5jdGlvbigpIHtcblx0XHRcdFxuXHRcdFx0Ly9jb21wdXRlIGhvdyBtdWNoIHNwYWNlIGZvciBjaGFydFxuXHRcdFx0dmFyIHN2Z1dpZHRoID0gdGhpcy4kc3ZnLndpZHRoKCksXG5cdFx0XHRcdHN2Z0hlaWdodCA9IHRoaXMuJHN2Zy5oZWlnaHQoKSxcblx0XHRcdFx0Y2hhcnRUeXBlID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LXR5cGVcIiApLFxuXHRcdFx0XHQkY2hhcnROYW1lU3ZnID0gdGhpcy4kZWwuZmluZCggXCIuY2hhcnQtbmFtZS1zdmdcIiApLFxuXHRcdFx0XHQkY2hhcnRTdWJuYW1lU3ZnID0gdGhpcy4kZWwuZmluZCggXCIuY2hhcnQtc3VibmFtZS1zdmdcIiApLFxuXHRcdFx0XHQkY2hhcnREZXNjcmlwdGlvblN2ZyA9IHRoaXMuJGVsLmZpbmQoIFwiLmNoYXJ0LWRlc2NyaXB0aW9uLXN2Z1wiICksXG5cdFx0XHRcdCRjaGFydFNvdXJjZXNTdmcgPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1zb3VyY2VzLXN2Z1wiICksXG5cdFx0XHRcdGNoYXJ0SGVhZGVySGVpZ2h0ID0gdGhpcy4kY2hhcnRIZWFkZXIuaGVpZ2h0KCksXG5cdFx0XHRcdG1hcmdpbnMgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwibWFyZ2luc1wiICksXG5cdFx0XHRcdHRvcENoYXJ0TWFyZ2luID0gMzAsXG5cdFx0XHRcdGJvdHRvbUNoYXJ0TWFyZ2luID0gNjAsXG5cdFx0XHRcdGN1cnJZLCBmb290ZXJEZXNjcmlwdGlvbkhlaWdodCwgZm9vdGVyU291cmNlc0hlaWdodCwgY2hhcnRIZWlnaHQ7XG5cblx0XHRcdHRoaXMuJHRhYkNvbnRlbnQuaGVpZ2h0KCAkKCBcIi5jaGFydC13cmFwcGVyLWlubmVyXCIgKS5oZWlnaHQoKSAtIHRoaXMuJGNoYXJ0SGVhZGVyLmhlaWdodCgpICk7XG5cdFx0XHRcblx0XHRcdC8vd3JhcCBoZWFkZXIgdGV4dFxuXHRcdFx0VXRpbHMud3JhcCggJGNoYXJ0TmFtZVN2Zywgc3ZnV2lkdGggKTtcblx0XHRcdGN1cnJZID0gcGFyc2VJbnQoICRjaGFydE5hbWVTdmcuYXR0ciggXCJ5XCIgKSwgMTAgKSArICRjaGFydE5hbWVTdmcub3V0ZXJIZWlnaHQoKSArIDIwO1xuXHRcdFx0JGNoYXJ0U3VibmFtZVN2Zy5hdHRyKCBcInlcIiwgY3VyclkgKTtcblx0XHRcdFxuXHRcdFx0Ly93cmFwIGRlc2NyaXB0aW9uXG5cdFx0XHRVdGlscy53cmFwKCAkY2hhcnRTdWJuYW1lU3ZnLCBzdmdXaWR0aCApO1xuXG5cdFx0XHQvL3N0YXJ0IHBvc2l0aW9uaW5nIHRoZSBncmFwaCwgYWNjb3JkaW5nIFxuXHRcdFx0Y3VyclkgPSBjaGFydEhlYWRlckhlaWdodDtcblxuXHRcdFx0dmFyIHRyYW5zbGF0ZVkgPSBjdXJyWTtcblx0XHRcdFxuXHRcdFx0dGhpcy4kc3ZnLmhlaWdodCggdGhpcy4kdGFiQ29udGVudC5oZWlnaHQoKSArIGN1cnJZICk7XG5cblx0XHRcdC8vdXBkYXRlIHN0b3JlZCBoZWlnaHRcblx0XHRcdHN2Z0hlaWdodCA9IHRoaXMuJHN2Zy5oZWlnaHQoKTtcblxuXHRcdFx0Ly9hZGQgaGVpZ2h0IG9mIGxlZ2VuZFxuXHRcdFx0Ly9jdXJyWSArPSB0aGlzLmNoYXJ0LmxlZ2VuZC5oZWlnaHQoKTtcblx0XHRcdGlmKCAhQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImhpZGUtbGVnZW5kXCIgKSApIHtcblx0XHRcdFx0Y3VyclkgKz0gdGhpcy5jaGFydFRhYi5sZWdlbmQuaGVpZ2h0KCk7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdC8vcG9zaXRpb24gY2hhcnRcblx0XHRcdFV0aWxzLndyYXAoICRjaGFydERlc2NyaXB0aW9uU3ZnLCBzdmdXaWR0aCApO1xuXHRcdFx0Zm9vdGVyRGVzY3JpcHRpb25IZWlnaHQgPSAkY2hhcnREZXNjcmlwdGlvblN2Zy5oZWlnaHQoKTtcblx0XHRcdFV0aWxzLndyYXAoICRjaGFydFNvdXJjZXNTdmcsIHN2Z1dpZHRoICk7XG5cdFx0XHRmb290ZXJTb3VyY2VzSGVpZ2h0ID0gJGNoYXJ0U291cmNlc1N2Zy5oZWlnaHQoKTtcblxuXHRcdFx0dmFyIGZvb3RlckhlaWdodCA9IHRoaXMuJGNoYXJ0Rm9vdGVyLmhlaWdodCgpO1xuXG5cdFx0XHQvL3NldCBjaGFydCBoZWlnaHRcblx0XHRcdGNoYXJ0SGVpZ2h0ID0gc3ZnSGVpZ2h0IC0gdHJhbnNsYXRlWSAtIGZvb3RlckhlaWdodCAtIGJvdHRvbUNoYXJ0TWFyZ2luO1xuXHRcdFx0aWYoICFBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiaGlkZS1sZWdlbmRcIiApICkge1xuXHRcdFx0XHRjaGFydEhlaWdodCAtPSB0aGlzLmNoYXJ0VGFiLmxlZ2VuZC5oZWlnaHQoKTtcblx0XHRcdH1cblxuXHRcdFx0Ly9yZWZsZWN0IG1hcmdpbiB0b3AgYW5kIGRvd24gaW4gY2hhcnRIZWlnaHRcblx0XHRcdGNoYXJ0SGVpZ2h0ID0gY2hhcnRIZWlnaHQgLSBtYXJnaW5zLmJvdHRvbSAtIG1hcmdpbnMudG9wO1xuXG5cdFx0XHQvL3Bvc2l0aW9uIGZvb3RlclxuXHRcdFx0JGNoYXJ0RGVzY3JpcHRpb25TdmcuYXR0ciggXCJ5XCIsIGN1cnJZICsgY2hhcnRIZWlnaHQgKyBib3R0b21DaGFydE1hcmdpbiApO1xuXHRcdFx0VXRpbHMud3JhcCggJGNoYXJ0RGVzY3JpcHRpb25TdmcsIHN2Z1dpZHRoICk7XG5cdFx0XHQkY2hhcnRTb3VyY2VzU3ZnLmF0dHIoIFwieVwiLCBwYXJzZUludCggJGNoYXJ0RGVzY3JpcHRpb25TdmcuYXR0ciggXCJ5XCIgKSwgMTAgKSArICRjaGFydERlc2NyaXB0aW9uU3ZnLmhlaWdodCgpICsgZm9vdGVyRGVzY3JpcHRpb25IZWlnaHQvMyApO1xuXHRcdFx0VXRpbHMud3JhcCggJGNoYXJ0U291cmNlc1N2Zywgc3ZnV2lkdGggKTtcblx0XHRcdFxuXHRcdFx0Ly9jb21wdXRlIGNoYXJ0IHdpZHRoXG5cdFx0XHR2YXIgY2hhcnRXaWR0aCA9IHN2Z1dpZHRoIC0gbWFyZ2lucy5sZWZ0IC0gbWFyZ2lucy5yaWdodDtcblx0XHRcdHRoaXMuY2hhcnRUYWIuY2hhcnQud2lkdGgoIGNoYXJ0V2lkdGggKTtcblx0XHRcdHRoaXMuY2hhcnRUYWIuY2hhcnQuaGVpZ2h0KCBjaGFydEhlaWdodCApO1xuXG5cdFx0XHQvL25lZWQgdG8gY2FsbCBjaGFydCB1cGRhdGUgZm9yIHJlc2l6aW5nIG9mIGVsZW1lbnRzIHdpdGhpbiBjaGFydFxuXHRcdFx0aWYoIHRoaXMuJGNoYXJ0VGFiLmlzKCBcIjp2aXNpYmxlXCIgKSApIHtcblx0XHRcdFx0dGhpcy5jaGFydFRhYi5jaGFydC51cGRhdGUoKTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0aWYoIGNoYXJ0VHlwZSA9PT0gXCIzXCIgKSB7XG5cdFx0XHRcdC8vZm9yIHN0YWNrZWQgYXJlYSBjaGFydCwgbmVlZCB0byBtYW51YWxseSBhZGp1c3QgaGVpZ2h0XG5cdFx0XHRcdHZhciBjdXJySW50TGF5ZXJIZWlnaHQgPSB0aGlzLmNoYXJ0VGFiLmNoYXJ0LmludGVyYWN0aXZlTGF5ZXIuaGVpZ2h0KCksXG5cdFx0XHRcdFx0Ly9UT0RPIC0gZG8gbm90IGhhcmRjb2RlIHRoaXNcblx0XHRcdFx0XHRoZWlnaHRBZGQgPSAxNTA7XG5cdFx0XHRcdHRoaXMuY2hhcnRUYWIuY2hhcnQuaW50ZXJhY3RpdmVMYXllci5oZWlnaHQoIGN1cnJJbnRMYXllckhlaWdodCArIGhlaWdodEFkZCApO1xuXHRcdFx0XHRkMy5zZWxlY3QoXCIubnYtaW50ZXJhY3RpdmVcIikuY2FsbCh0aGlzLmNoYXJ0VGFiLmNoYXJ0LmludGVyYWN0aXZlTGF5ZXIpO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRpZiggIUFwcC5DaGFydE1vZGVsLmdldCggXCJoaWRlLWxlZ2VuZFwiICkgKSB7XG5cdFx0XHRcdC8vcG9zaXRpb24gbGVnZW5kXG5cdFx0XHRcdHZhciBsZWdlbmRNYXJnaW5zID0gdGhpcy5jaGFydFRhYi5sZWdlbmQubWFyZ2luKCk7XG5cdFx0XHRcdGN1cnJZID0gY3VyclkgLSB0aGlzLmNoYXJ0VGFiLmxlZ2VuZC5oZWlnaHQoKTtcblx0XHRcdFx0dGhpcy50cmFuc2xhdGVTdHJpbmcgPSBcInRyYW5zbGF0ZShcIiArIGxlZ2VuZE1hcmdpbnMubGVmdCArIFwiICxcIiArIGN1cnJZICsgXCIpXCI7XG5cdFx0XHRcdHRoaXMuJHN2Zy5maW5kKCBcIj4gLm52ZDMubnYtY3VzdG9tLWxlZ2VuZFwiICkuYXR0ciggXCJ0cmFuc2Zvcm1cIiwgdGhpcy50cmFuc2xhdGVTdHJpbmcgKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy4kc3ZnLmNzcyggXCJ0cmFuc2Zvcm1cIiwgXCJ0cmFuc2xhdGUoMCwtXCIgKyBjaGFydEhlYWRlckhlaWdodCArIFwicHgpXCIgKTtcblxuXHRcdFx0Ly9mb3IgbXVsdGliYXJjaGFydCwgbmVlZCB0byBtb3ZlIGNvbnRyb2xzIGJpdCBoaWdoZXJcblx0XHRcdGlmKCBjaGFydFR5cGUgPT09IFwiNFwiIHx8IGNoYXJ0VHlwZSA9PT0gXCI1XCIgKSB7XG5cdFx0XHRcdGQzLnNlbGVjdCggXCIubnYtY29udHJvbHNXcmFwXCIgKS5hdHRyKCBcInRyYW5zZm9ybVwiLCBcInRyYW5zbGF0ZSgwLC0yNSlcIiApO1xuXHRcdFx0fVxuXG5cdFx0XHQvL3JlZmxlY3QgbWFyZ2luIHRvcCBpbiBjdXJyWVxuXHRcdFx0aWYoICFBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiaGlkZS1sZWdlbmRcIiApICkge1xuXHRcdFx0XHRjdXJyWSArPSArdGhpcy5jaGFydFRhYi5sZWdlbmQuaGVpZ2h0KCk7XG5cdFx0XHR9XG5cdFx0XHRjdXJyWSArPSArbWFyZ2lucy50b3A7XG5cblx0XHRcdHZhciAkd3JhcCA9IHRoaXMuJHN2Zy5maW5kKCBcIj4gLm52ZDMubnYtd3JhcFwiICk7XG5cblx0XHRcdC8vbWFudWFsbHkgcmVwb3NpdGlvbiBjaGFydCBhZnRlciB1cGRhdGVcblx0XHRcdC8vdGhpcy50cmFuc2xhdGVTdHJpbmcgPSBcInRyYW5zbGF0ZShcIiArIG1hcmdpbnMubGVmdCArIFwiLFwiICsgY3VyclkgKyBcIilcIjtcblx0XHRcdHRoaXMudHJhbnNsYXRlU3RyaW5nID0gXCJ0cmFuc2xhdGUoXCIgKyBtYXJnaW5zLmxlZnQgKyBcIixcIiArIGN1cnJZICsgXCIpXCI7XG5cdFx0XHQkd3JhcC5hdHRyKCBcInRyYW5zZm9ybVwiLCB0aGlzLnRyYW5zbGF0ZVN0cmluZyApO1xuXHRcdFx0XG5cdFx0XHQvL3Bvc2l0aW9uIHNjYWxlIGRyb3Bkb3ducyAtIFRPRE8gLSBpc24ndCB0aGVyZSBhIGJldHRlciB3YXkgdGhlbiB3aXRoIHRpbWVvdXQ/XG5cdFx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0XHRzZXRUaW1lb3V0KCBmdW5jdGlvbigpIHtcblx0XHRcdFxuXHRcdFx0XHR2YXIgd3JhcE9mZnNldCA9ICR3cmFwLm9mZnNldCgpLFxuXHRcdFx0XHRcdGNoYXJ0VGFiT2Zmc2V0ID0gdGhhdC4kY2hhcnRUYWIub2Zmc2V0KCksXG5cdFx0XHRcdFx0bWFyZ2luTGVmdCA9IHBhcnNlSW50KCBtYXJnaW5zLmxlZnQsIDEwICksXG5cdFx0XHRcdFx0Ly9kaWcgaW50byBOVkQzIGNoYXJ0IHRvIGZpbmQgYmFja2dyb3VuZCByZWN0IHRoYXQgaGFzIHdpZHRoIG9mIHRoZSBhY3R1YWwgY2hhcnRcblx0XHRcdFx0XHRiYWNrUmVjdFdpZHRoID0gcGFyc2VJbnQoICR3cmFwLmZpbmQoIFwiPiBnID4gcmVjdFwiICkuYXR0ciggXCJ3aWR0aFwiICksIDEwICksXG5cdFx0XHRcdFx0b2Zmc2V0RGlmZiA9IHdyYXBPZmZzZXQudG9wIC0gY2hhcnRUYWJPZmZzZXQudG9wLFxuXHRcdFx0XHRcdC8vZW1waXJpYyBvZmZzZXRcblx0XHRcdFx0XHR4U2NhbGVPZmZzZXQgPSAxMCxcblx0XHRcdFx0XHR5U2NhbGVPZmZzZXQgPSAtNTtcblxuXHRcdFx0XHQvL2ZhbGxiYWNrIGZvciBzY2F0dGVyIHBsb3Qgd2hlcmUgYmFja1JlY3RXaWR0aCBoYXMgbm8gd2lkdGhcblx0XHRcdFx0aWYoIGlzTmFOKCBiYWNrUmVjdFdpZHRoICkgKSB7XG5cdFx0XHRcdFx0YmFja1JlY3RXaWR0aCA9IHBhcnNlSW50KCAkKFwiLm52LXgubnYtYXhpcy5udmQzLXN2Z1wiKS5nZXQoMCkuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkud2lkdGgsIDEwICk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGF0LiR4QXhpc1NjYWxlU2VsZWN0b3IuY3NzKCB7IFwidG9wXCI6IG9mZnNldERpZmYgKyBjaGFydEhlaWdodCwgXCJsZWZ0XCI6IG1hcmdpbkxlZnQgKyBiYWNrUmVjdFdpZHRoICsgeFNjYWxlT2Zmc2V0IH0gKTtcblx0XHRcdFx0dGhhdC4keUF4aXNTY2FsZVNlbGVjdG9yLmNzcyggeyBcInRvcFwiOiBvZmZzZXREaWZmIC0gMTUsIFwibGVmdFwiOiBtYXJnaW5MZWZ0ICsgeVNjYWxlT2Zmc2V0IH0gKTtcblx0XHRcdFx0XG5cdFx0XHR9LCAyNTAgKTtcblx0XHRcdFxuXHRcdH1cblxuXHR9KTtcblx0XG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkNoYXJ0VmlldztcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBBcHAgPSByZXF1aXJlKCBcIi4vLi4vbmFtZXNwYWNlcy5qc1wiICksXG5cdFx0Rm9ybVZpZXcgPSByZXF1aXJlKCBcIi4vQXBwLlZpZXdzLkZvcm1WaWV3LmpzXCIgKSxcblx0XHRDaGFydFZpZXcgPSByZXF1aXJlKCBcIi4vQXBwLlZpZXdzLkNoYXJ0Vmlldy5qc1wiICksXG5cdFx0VmFyaWFibGVTZWxlY3RzID0gcmVxdWlyZSggXCIuL3VpL0FwcC5WaWV3cy5VSS5WYXJpYWJsZVNlbGVjdHMuanNcIiApO1xuXG5cdEFwcC5WaWV3cy5Gb3JtID0gQmFja2JvbmUuVmlldy5leHRlbmQoe1xuXG5cdFx0ZXZlbnRzOiB7fSxcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKCkge30sXG5cblx0XHRzdGFydDogZnVuY3Rpb24oKSB7XG5cdFx0XHQvL3JlbmRlciBldmVyeXRoaW5nIGZvciB0aGUgZmlyc3QgdGltZVxuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdFxuXHRcdFx0dmFyIGRpc3BhdGNoZXIgPSBfLmNsb25lKCBCYWNrYm9uZS5FdmVudHMgKTtcblx0XHRcdHRoaXMuZGlzcGF0Y2hlciA9IGRpc3BhdGNoZXI7XG5cblx0XHRcdHRoaXMuZm9ybVZpZXcgPSBuZXcgRm9ybVZpZXcoIHsgZGlzcGF0Y2hlcjogZGlzcGF0Y2hlciB9ICk7XG5cdFx0XHR0aGlzLmNoYXJ0VmlldyA9IG5ldyBDaGFydFZpZXcoIHsgZGlzcGF0Y2hlcjogZGlzcGF0Y2hlciB9ICk7XG5cdFx0XHRcblx0XHRcdC8vdmFyaWFibGUgc2VsZWN0XG5cdFx0XHR2YXIgdmFyaWFibGVTZWxlY3RzID0gbmV3IFZhcmlhYmxlU2VsZWN0cygpO1xuXHRcdFx0dmFyaWFibGVTZWxlY3RzLmluaXQoKTtcblx0XHRcdFxuXHRcdH1cblxuXHR9KTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5Gb3JtO1xuXG59KSgpO1xuIiwiOyggZnVuY3Rpb24oKSB7XG5cdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgQXBwID0gcmVxdWlyZSggXCIuLy4uL25hbWVzcGFjZXMuanNcIiApLFxuXHRcdENoYXJ0VmFyaWFibGVzQ29sbGVjdGlvbiA9IHJlcXVpcmUoIFwiLi8uLi9jb2xsZWN0aW9ucy9BcHAuQ29sbGVjdGlvbnMuQ2hhcnRWYXJpYWJsZXNDb2xsZWN0aW9uLmpzXCIgKSxcblx0XHRBdmFpbGFibGVFbnRpdGllc0NvbGxlY3Rpb24gPSByZXF1aXJlKCBcIi4vLi4vY29sbGVjdGlvbnMvQXBwLkNvbGxlY3Rpb25zLkF2YWlsYWJsZUVudGl0aWVzQ29sbGVjdGlvbi5qc1wiICksXG5cdFx0Q2hhcnREaW1lbnNpb25zTW9kZWwgPSByZXF1aXJlKCBcIi4vLi4vbW9kZWxzL0FwcC5Nb2RlbHMuQ2hhcnREaW1lbnNpb25zTW9kZWwuanNcIiApLFxuXHRcdEF2YWlsYWJsZVRpbWVNb2RlbCA9IHJlcXVpcmUoIFwiLi8uLi9tb2RlbHMvQXBwLk1vZGVscy5BdmFpbGFibGVUaW1lTW9kZWwuanNcIiApLFxuXHRcdFNlYXJjaERhdGFDb2xsZWN0aW9uID0gcmVxdWlyZSggXCIuLy4uL2NvbGxlY3Rpb25zL0FwcC5Db2xsZWN0aW9ucy5TZWFyY2hEYXRhQ29sbGVjdGlvbi5qc1wiICksXG5cdFx0XG5cdFx0QmFzaWNUYWJWaWV3ID0gcmVxdWlyZSggXCIuL2Zvcm0vQXBwLlZpZXdzLkZvcm0uQmFzaWNUYWJWaWV3LmpzXCIgKSxcblx0XHRBeGlzVGFiVmlldyA9IHJlcXVpcmUoIFwiLi9mb3JtL0FwcC5WaWV3cy5Gb3JtLkF4aXNUYWJWaWV3LmpzXCIgKSxcblx0XHREZXNjcmlwdGlvblRhYlZpZXcgPSByZXF1aXJlKCBcIi4vZm9ybS9BcHAuVmlld3MuRm9ybS5EZXNjcmlwdGlvblRhYlZpZXcuanNcIiApLFxuXHRcdFN0eWxpbmdUYWJWaWV3ID0gcmVxdWlyZSggXCIuL2Zvcm0vQXBwLlZpZXdzLkZvcm0uU3R5bGluZ1RhYlZpZXcuanNcIiApLFxuXHRcdEV4cG9ydFRhYlZpZXcgPSByZXF1aXJlKCBcIi4vZm9ybS9BcHAuVmlld3MuRm9ybS5FeHBvcnRUYWJWaWV3LmpzXCIgKSxcblx0XHRNYXBUYWJWaWV3ID0gcmVxdWlyZSggXCIuL2Zvcm0vQXBwLlZpZXdzLkZvcm0uTWFwVGFiVmlldy5qc1wiICk7XG5cblx0QXBwLlZpZXdzLkZvcm1WaWV3ID0gQmFja2JvbmUuVmlldy5leHRlbmQoe1xuXG5cdFx0ZWw6IFwiI2Zvcm0tdmlld1wiLFxuXHRcdGV2ZW50czoge1xuXHRcdFx0XCJjbGljayAuZm9ybS1jb2xsYXBzZS1idG5cIjogXCJvbkZvcm1Db2xsYXBzZVwiLFxuXHRcdFx0XCJjaGFuZ2UgaW5wdXRbbmFtZT1jaGFydC1uYW1lXVwiOiBcIm9uTmFtZUNoYW5nZVwiLFxuXHRcdFx0XCJjaGFuZ2UgdGV4dGFyZWFbbmFtZT1jaGFydC1zdWJuYW1lXVwiOiBcIm9uU3VibmFtZUNoYW5nZVwiLFxuXHRcdFx0XCJjbGljayAucmVtb3ZlLXVwbG9hZGVkLWZpbGUtYnRuXCI6IFwib25SZW1vdmVVcGxvYWRlZEZpbGVcIixcblx0XHRcdFwic3VibWl0IGZvcm1cIjogXCJvbkZvcm1TdWJtaXRcIixcblx0XHR9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHRcblx0XHRcdHRoaXMuZGlzcGF0Y2hlciA9IG9wdGlvbnMuZGlzcGF0Y2hlcjtcblx0XHRcdFxuXHRcdFx0dmFyIGZvcm1Db25maWcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiZm9ybS1jb25maWdcIiApO1xuXG5cdFx0XHQvL2NyZWF0ZSByZWxhdGVkIG1vZGVscywgZWl0aGVyIGVtcHR5ICh3aGVuIGNyZWF0aW5nIG5ldyBjaGFydCksIG9yIHByZWZpbGxlZCBmcm9tIGRiICh3aGVuIGVkaXRpbmcgZXhpc3RpbmcgY2hhcnQpXG5cdFx0XHRpZiggZm9ybUNvbmZpZyAmJiBmb3JtQ29uZmlnWyBcInZhcmlhYmxlcy1jb2xsZWN0aW9uXCIgXSApIHtcblx0XHRcdFx0QXBwLkNoYXJ0VmFyaWFibGVzQ29sbGVjdGlvbiA9IG5ldyBDaGFydFZhcmlhYmxlc0NvbGxlY3Rpb24oIGZvcm1Db25maWdbIFwidmFyaWFibGVzLWNvbGxlY3Rpb25cIiBdICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRBcHAuQ2hhcnRWYXJpYWJsZXNDb2xsZWN0aW9uID0gbmV3IENoYXJ0VmFyaWFibGVzQ29sbGVjdGlvbigpO1xuXHRcdFx0fVxuXHRcdFx0aWYoIGZvcm1Db25maWcgJiYgZm9ybUNvbmZpZ1sgXCJlbnRpdGllcy1jb2xsZWN0aW9uXCIgXSApIHtcblx0XHRcdFx0QXBwLkF2YWlsYWJsZUVudGl0aWVzQ29sbGVjdGlvbiA9IG5ldyBBdmFpbGFibGVFbnRpdGllc0NvbGxlY3Rpb24oIGZvcm1Db25maWdbIFwiZW50aXRpZXMtY29sbGVjdGlvblwiIF0gKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdEFwcC5BdmFpbGFibGVFbnRpdGllc0NvbGxlY3Rpb24gPSBuZXcgQXZhaWxhYmxlRW50aXRpZXNDb2xsZWN0aW9uKCk7XG5cdFx0XHR9XG5cdFx0XHRpZiggZm9ybUNvbmZpZyAmJiBmb3JtQ29uZmlnWyBcImRpbWVuc2lvbnNcIiBdICkge1xuXHRcdFx0XHRBcHAuQ2hhcnREaW1lbnNpb25zTW9kZWwgPSBuZXcgQ2hhcnREaW1lbnNpb25zTW9kZWwoKTtcblx0XHRcdFx0Ly9BcHAuQ2hhcnREaW1lbnNpb25zTW9kZWwgPSBuZXcgQXBwLk1vZGVscy5DaGFydERpbWVuc2lvbnNNb2RlbCggZm9ybUNvbmZpZ1sgXCJkaW1lbnNpb25zXCIgXSApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0QXBwLkNoYXJ0RGltZW5zaW9uc01vZGVsID0gbmV3IENoYXJ0RGltZW5zaW9uc01vZGVsKCk7XG5cdFx0XHR9XG5cdFx0XHRpZiggZm9ybUNvbmZpZyAmJiBmb3JtQ29uZmlnWyBcImF2YWlsYWJsZS10aW1lXCIgXSApIHtcblx0XHRcdFx0QXBwLkF2YWlsYWJsZVRpbWVNb2RlbCA9IG5ldyBBdmFpbGFibGVUaW1lTW9kZWwoZm9ybUNvbmZpZ1sgXCJhdmFpbGFibGUtdGltZVwiIF0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0QXBwLkF2YWlsYWJsZVRpbWVNb2RlbCA9IG5ldyBBdmFpbGFibGVUaW1lTW9kZWwoKTtcblx0XHRcdH1cblxuXHRcdFx0Ly9jcmVhdGUgc2VhcmNoIGNvbGxlY3Rpb25cblx0XHRcdEFwcC5TZWFyY2hEYXRhQ29sbGVjdGlvbiA9IG5ldyBTZWFyY2hEYXRhQ29sbGVjdGlvbigpO1xuXHRcdFx0XG5cdFx0XHQvL2lzIGl0IG5ldyBvciBleGlzdGluZyBjaGFydFxuXHRcdFx0aWYoIGZvcm1Db25maWcgJiYgZm9ybUNvbmZpZ1sgXCJkaW1lbnNpb25zXCIgXSApIHtcblx0XHRcdFx0Ly9leGlzdGluZyBjaGFydCwgbmVlZCB0byBsb2FkIGZyZXNoIGRpbWVuc2lvbnMgZnJvbSBkYXRhYmFzZSAoaW4gY2FzZSB3ZSd2ZSBhZGRlZCBkaW1lbnNpb25zIHNpbmNlIGNyZWF0aW5nIGNoYXJ0KVxuXHRcdFx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0XHRcdEFwcC5DaGFydERpbWVuc2lvbnNNb2RlbC5sb2FkQ29uZmlndXJhdGlvbiggZm9ybUNvbmZpZ1sgXCJkaW1lbnNpb25zXCIgXS5pZCApO1xuXHRcdFx0XHRBcHAuQ2hhcnREaW1lbnNpb25zTW9kZWwub24oIFwiY2hhbmdlXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdHRoYXQucmVuZGVyKCk7XG5cdFx0XHRcdH0gKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vbmV3IGNoYXJ0LCBjYW4gcmVuZGVyIHN0cmFpZ2h0IGF3YXlcblx0XHRcdFx0dGhpcy5yZW5kZXIoKTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XG5cdFx0XHQvL2NyZWF0ZSBzdWJ2aWV3c1xuXHRcdFx0dGhpcy5iYXNpY1RhYlZpZXcgPSBuZXcgQmFzaWNUYWJWaWV3KCB7IGRpc3BhdGNoZXI6IHRoaXMuZGlzcGF0Y2hlciB9ICk7XG5cdFx0XHR0aGlzLmF4aXNUYWJWaWV3ID0gbmV3IEF4aXNUYWJWaWV3KCB7IGRpc3BhdGNoZXI6IHRoaXMuZGlzcGF0Y2hlciB9ICk7XG5cdFx0XHR0aGlzLmRlc2NyaXB0aW9uVGFiVmlldyA9IG5ldyBEZXNjcmlwdGlvblRhYlZpZXcoIHsgZGlzcGF0Y2hlcjogdGhpcy5kaXNwYXRjaGVyIH0gKTtcblx0XHRcdHRoaXMuc3R5bGluZ1RhYlZpZXcgPSBuZXcgU3R5bGluZ1RhYlZpZXcoIHsgZGlzcGF0Y2hlcjogdGhpcy5kaXNwYXRjaGVyIH0gKTtcblx0XHRcdHRoaXMuZXhwb3J0VGFiVmlldyA9IG5ldyBFeHBvcnRUYWJWaWV3KCB7IGRpc3BhdGNoZXI6IHRoaXMuZGlzcGF0Y2hlciB9ICk7XG5cdFx0XHR0aGlzLm1hcFRhYlZpZXcgPSBuZXcgTWFwVGFiVmlldyggeyBkaXNwYXRjaGVyOiB0aGlzLmRpc3BhdGNoZXIgfSApO1xuXG5cdFx0XHQvL2ZldGNoIGRvbXNcblx0XHRcdHRoaXMuJHJlbW92ZVVwbG9hZGVkRmlsZUJ0biA9IHRoaXMuJGVsLmZpbmQoIFwiLnJlbW92ZS11cGxvYWRlZC1maWxlLWJ0blwiICk7XG5cdFx0XHR0aGlzLiRmaWxlUGlja2VyID0gdGhpcy4kZWwuZmluZCggXCIuZmlsZS1waWNrZXItd3JhcHBlciBbdHlwZT1maWxlXVwiICk7XG5cblx0XHR9LFxuXG5cdFx0b25OYW1lQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHR2YXIgJGlucHV0ID0gJCggZXZ0LnRhcmdldCApO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0KCBcImNoYXJ0LW5hbWVcIiwgJGlucHV0LnZhbCgpICk7XG5cblx0XHR9LFxuXG5cdFx0b25TdWJuYW1lQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHR2YXIgJHRleHRhcmVhID0gJCggZXZ0LnRhcmdldCApO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0KCBcImNoYXJ0LXN1Ym5hbWVcIiwgJHRleHRhcmVhLnZhbCgpICk7XG5cblx0XHR9LFxuXG5cdFx0b25Dc3ZTZWxlY3RlZDogZnVuY3Rpb24oIGVyciwgZGF0YSApIHtcblxuXHRcdFx0aWYoIGVyciApIHtcblx0XHRcdFx0Y29uc29sZS5lcnJvciggZXJyICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy4kcmVtb3ZlVXBsb2FkZWRGaWxlQnRuLnNob3coKTtcblxuXHRcdFx0aWYoIGRhdGEgJiYgZGF0YS5yb3dzICkge1xuXHRcdFx0XHR2YXIgbWFwcGVkRGF0YSA9IEFwcC5VdGlscy5tYXBEYXRhKCBkYXRhLnJvd3MgKTtcblx0XHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0KCBcImNoYXJ0LWRhdGFcIiwgbWFwcGVkRGF0YSApO1xuXHRcdFx0fVxuXG5cdFx0fSxcblxuXHRcdG9uUmVtb3ZlVXBsb2FkZWRGaWxlOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHR0aGlzLiRmaWxlUGlja2VyLnJlcGxhY2VXaXRoKCB0aGlzLiRmaWxlUGlja2VyLmNsb25lKCkgKTtcblx0XHRcdC8vcmVmZXRjaCBkb21cblx0XHRcdHRoaXMuJGZpbGVQaWNrZXIgPSB0aGlzLiRlbC5maW5kKCBcIi5maWxlLXBpY2tlci13cmFwcGVyIFt0eXBlPWZpbGVdXCIgKTtcblx0XHRcdHRoaXMuJGZpbGVQaWNrZXIucHJvcCggXCJkaXNhYmxlZFwiLCBmYWxzZSk7XG5cblx0XHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRcdENTVi5iZWdpbiggdGhpcy4kZmlsZVBpY2tlci5zZWxlY3RvciApLmdvKCBmdW5jdGlvbiggZXJyLCBkYXRhICkge1xuXHRcdFx0XHRcdHRoYXQub25Dc3ZTZWxlY3RlZCggZXJyLCBkYXRhICk7XG5cdFx0XHR9ICk7XG5cblx0XHRcdHRoaXMuJHJlbW92ZVVwbG9hZGVkRmlsZUJ0bi5oaWRlKCk7XG5cblx0XHR9LFxuXG5cblx0XHRvbkZvcm1Db2xsYXBzZTogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHR2YXIgJHBhcmVudCA9IHRoaXMuJGVsLnBhcmVudCgpO1xuXHRcdFx0JHBhcmVudC50b2dnbGVDbGFzcyggXCJmb3JtLXBhbmVsLWNvbGxhcHNlZFwiICk7XG5cdFx0XHRcblx0XHRcdC8vdHJpZ2dlciByZS1yZW5kZXJpbmcgb2YgY2hhcnRcblx0XHRcdEFwcC5DaGFydE1vZGVsLnRyaWdnZXIoIFwiY2hhbmdlXCIgKTtcblx0XHRcdC8vYWxzbyB0cmlnZXIgY3VzdG9tIGV2ZW50IHNvIHRoYXQgbWFwIGNhbiByZXNpemVcblx0XHRcdEFwcC5DaGFydE1vZGVsLnRyaWdnZXIoIFwicmVzaXplXCIgKTtcblxuXHRcdH0sXG5cblx0XHRvbkZvcm1TdWJtaXQ6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHRcblx0XHRcdCQuYWpheFNldHVwKCB7XG5cdFx0XHRcdGhlYWRlcnM6IHsgJ1gtQ1NSRi1UT0tFTic6ICQoJ1tuYW1lPVwiX3Rva2VuXCJdJykudmFsKCkgfVxuXHRcdFx0fSApO1xuXG5cdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcblxuXHRcdFx0Ly9wdXQgYWxsIGNoYW5nZXMgdG8gY2hhcnQgbW9kZWxcblx0XHRcdHZhciBmb3JtQ29uZmlnID0ge1xuXHRcdFx0XHRcInZhcmlhYmxlcy1jb2xsZWN0aW9uXCI6IEFwcC5DaGFydFZhcmlhYmxlc0NvbGxlY3Rpb24udG9KU09OKCksXG5cdFx0XHRcdFwiZW50aXRpZXMtY29sbGVjdGlvblwiOiBBcHAuQXZhaWxhYmxlRW50aXRpZXNDb2xsZWN0aW9uLnRvSlNPTigpLFxuXHRcdFx0XHRcImRpbWVuc2lvbnNcIjogQXBwLkNoYXJ0RGltZW5zaW9uc01vZGVsLnRvSlNPTigpLFxuXHRcdFx0XHRcImF2YWlsYWJsZS10aW1lXCI6IEFwcC5BdmFpbGFibGVUaW1lTW9kZWwudG9KU09OKClcblx0XHRcdH07XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5zZXQoIFwiZm9ybS1jb25maWdcIiwgZm9ybUNvbmZpZywgeyBzaWxlbnQ6IHRydWUgfSApO1xuXG5cdFx0XHR2YXIgZGlzcGF0Y2hlciA9IHRoaXMuZGlzcGF0Y2hlcjtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnNhdmUoIHt9LCB7XG5cdFx0XHRcdHN1Y2Nlc3M6IGZ1bmN0aW9uICggbW9kZWwsIHJlc3BvbnNlLCBvcHRpb25zICkge1xuXHRcdFx0XHRcdGFsZXJ0KCBcIlRoZSBjaGFydCBzYXZlZCBzdWNjZXNmdWxseVwiICk7XG5cdFx0XHRcdFx0ZGlzcGF0Y2hlci50cmlnZ2VyKCBcImNoYXJ0LXNhdmVkXCIsIHJlc3BvbnNlLmRhdGEuaWQsIHJlc3BvbnNlLmRhdGEudmlld1VybCApO1xuXHRcdFx0XHRcdC8vdXBkYXRlIGlkIG9mIGFuIGV4aXN0aW5nIG1vZGVsXG5cdFx0XHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0KCBcImlkXCIsIHJlc3BvbnNlLmRhdGEuaWQgKTtcblx0XHRcdFx0fSxcblx0XHRcdFx0ZXJyb3I6IGZ1bmN0aW9uIChtb2RlbCwgeGhyLCBvcHRpb25zKSB7XG5cdFx0XHRcdFx0Y29uc29sZS5lcnJvcihcIlNvbWV0aGluZyB3ZW50IHdyb25nIHdoaWxlIHNhdmluZyB0aGUgbW9kZWxcIiwgeGhyICk7XG5cdFx0XHRcdFx0YWxlcnQoIFwiT3BwcywgdGhlcmUgd2FzIGEgcHJvYmxlbSBzYXZpbmcgeW91ciBjaGFydC5cIiApO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdH1cblxuXHR9KTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5Gb3JtVmlldztcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBBcHAgPSByZXF1aXJlKCBcIi4vLi4vLi4vbmFtZXNwYWNlcy5qc1wiICksXG5cdFx0TGVnZW5kID0gcmVxdWlyZSggXCIuL0FwcC5WaWV3cy5DaGFydC5MZWdlbmRcIiApO1xuXG5cdEFwcC5WaWV3cy5DaGFydC5DaGFydFRhYiA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKCB7XG5cblx0XHRjYWNoZWRDb2xvcnM6IFtdLFxuXHRcdGVsOiBcIiNjaGFydC12aWV3XCIsXG5cdFx0ZXZlbnRzOiB7XG5cdFx0XHRcImNoYW5nZSBbbmFtZT1hdmFpbGFibGVfZW50aXRpZXNdXCI6IFwib25BdmFpbGFibGVDb3VudHJpZXNcIlxuXHRcdH0sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gb3B0aW9ucy5kaXNwYXRjaGVyO1xuXHRcdFx0dGhpcy5wYXJlbnRWaWV3ID0gb3B0aW9ucy5wYXJlbnRWaWV3O1xuXG5cdFx0XHR0aGlzLiRzdmcgPSB0aGlzLiRlbC5maW5kKCBcIiNjaGFydC1jaGFydC10YWIgc3ZnXCIgKTtcblx0XHRcdHRoaXMuJGVudGl0aWVzU2VsZWN0ID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT1hdmFpbGFibGVfZW50aXRpZXNdXCIgKTtcblx0XHRcdFxuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCBkYXRhLCB0aW1lVHlwZSwgZGltZW5zaW9ucyApIHtcblx0XHRcdFxuXHRcdFx0aWYoICFkYXRhICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdHZhciB0aGF0ID0gdGhpcztcblxuXHRcdFx0Ly9tYWtlIGxvY2FsIGNvcHkgb2YgZGF0YSBmb3Igb3VyIGZpbHRlcmluZyBuZWVkc1xuXHRcdFx0dmFyIGxvY2FsRGF0YSA9ICQuZXh0ZW5kKCB0cnVlLCBsb2NhbERhdGEsIGRhdGEgKTtcblxuXHRcdFx0dmFyIGNoYXJ0VHlwZSA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10eXBlXCIgKTtcblxuXHRcdFx0Ly9maWx0ZXIgZGF0YSBmb3Igc2VsZWN0ZWQgY291bnRyaWVzXG5cdFx0XHR2YXIgc2VsZWN0ZWRDb3VudHJpZXMgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwic2VsZWN0ZWQtY291bnRyaWVzXCIgKSxcblx0XHRcdFx0c2VsZWN0ZWRDb3VudHJpZXNCeUlkID0gW10sXG5cdFx0XHRcdHNlbGVjdGVkQ291bnRyaWVzSWRzID0gXy5tYXAoIHNlbGVjdGVkQ291bnRyaWVzLCBmdW5jdGlvbih2KSB7XG5cdFx0XHRcdFx0Ly9zdG9yZSBcblx0XHRcdFx0XHRzZWxlY3RlZENvdW50cmllc0J5SWRbIHYuaWQgXSA9IHY7XG5cdFx0XHRcdFx0cmV0dXJuICt2LmlkO1xuXHRcdFx0XHR9ICk7XG5cblx0XHRcdGlmKCBzZWxlY3RlZENvdW50cmllcyAmJiBzZWxlY3RlZENvdW50cmllc0lkcy5sZW5ndGggJiYgIUFwcC5DaGFydE1vZGVsLmdldCggXCJncm91cC1ieS12YXJpYWJsZXNcIiApICkge1xuXHRcdFx0XHRcblx0XHRcdFx0Ly9zZXQgbG9jYWwgY29weSBvZiBjb3VudHJpZXMgY29sb3IsIHRvIGJlIGFibGUgdG8gY3JlYXRlIGJyaWdodGVyXG5cdFx0XHRcdHZhciBjb3VudHJpZXNDb2xvcnMgPSBbXTtcblx0XHRcdFx0bG9jYWxEYXRhID0gXy5maWx0ZXIoIGxvY2FsRGF0YSwgZnVuY3Rpb24oIHZhbHVlLCBrZXksIGxpc3QgKSB7XG5cdFx0XHRcdFx0Ly9zZXQgY29sb3Igd2hpbGUgaW4gdGhlIGxvb3Bcblx0XHRcdFx0XHR2YXIgaWQgPSB2YWx1ZS5pZDtcblx0XHRcdFx0XHQvL25lZWQgdG8gY2hlY2sgZm9yIHNwZWNpYWwgY2FzZSwgd2hlbiB3ZSBoYXZlIG1vcmUgdmFyaWFibGVzIGZvciB0aGUgc2FtZSBjb3VudHJpZXMgKHRoZSBpZHMgd2lsbCBiZSB0aGVuIDIxLTEsIDIyLTEsIGV0Yy4pXG5cdFx0XHRcdFx0aWYoIGlkLmluZGV4T2YoIFwiLVwiICkgPiAwICkge1xuXHRcdFx0XHRcdFx0aWQgPSBwYXJzZUludCggaWQuc3BsaXQoIFwiLVwiIClbIDAgXSwgMTAgKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0aWQgPSBwYXJzZUludCggaWQsIDEwICk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0dmFyIGNvdW50cnkgPSBzZWxlY3RlZENvdW50cmllc0J5SWRbIGlkIF07XG5cdFx0XHRcdFx0aWYoIGNvdW50cnkgJiYgY291bnRyeS5jb2xvciApIHtcblx0XHRcdFx0XHRcdGlmKCAhY291bnRyaWVzQ29sb3JzWyBpZCBdICkge1xuXHRcdFx0XHRcdFx0XHRjb3VudHJpZXNDb2xvcnNbIGlkIF0gPSBjb3VudHJ5LmNvbG9yO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0Ly90aGVyZSBpcyBhbHJlYWR5IGNvbG9yIGZvciBjb3VudHJ5IChtdWx0aXZhcmlhbnQgZGF0YXNldCkgLSBjcmVhdGUgYnJpZ2h0ZXIgY29sb3Jcblx0XHRcdFx0XHRcdFx0Y291bnRyaWVzQ29sb3JzWyBpZCBdID0gZDMucmdiKCBjb3VudHJpZXNDb2xvcnNbIGlkIF0gKS5icmlnaHRlciggMSApLnRvU3RyaW5nKCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR2YWx1ZS5jb2xvciA9IGNvdW50cmllc0NvbG9yc1sgaWQgXTtcblxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR2YWx1ZSA9IHRoYXQuYXNzaWduQ29sb3JGcm9tQ2FjaGUoIHZhbHVlICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdC8vYWN0dWFsIGZpbHRlcmluZ1xuXHRcdFx0XHRcdHJldHVybiAoIF8uaW5kZXhPZiggc2VsZWN0ZWRDb3VudHJpZXNJZHMsIGlkICkgPiAtMSApO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvL1RPRE8gLSBub25zZW5zZT8gY29udmVydCBhc3NvY2lhdGl2ZSBhcnJheSB0byBhcnJheSwgYXNzaWduIGNvbG9ycyBmcm9tIGNhY2hlXG5cdFx0XHRcdGxvY2FsRGF0YSA9IF8ubWFwKCBsb2NhbERhdGEsIGZ1bmN0aW9uKCB2YWx1ZSApIHtcblx0XHRcdFx0XHR2YWx1ZSA9IHRoYXQuYXNzaWduQ29sb3JGcm9tQ2FjaGUoIHZhbHVlICk7XG5cdFx0XHRcdFx0cmV0dXJuIHZhbHVlO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cblx0XHRcdHZhciBkaXNjcmV0ZURhdGE7XG5cdFx0XHRpZiggY2hhcnRUeXBlID09IFwiNlwiICkge1xuXHRcdFx0XHR2YXIgZmxhdHRlblZhbHVlcyA9IF8ubWFwKCBsb2NhbERhdGEsIGZ1bmN0aW9uKCB2ICkge1xuXHRcdFx0XHRcdGlmKCB2ICYmIHYuY29sb3IgKSB7XG5cdFx0XHRcdFx0XHR2LnZhbHVlc1sgMCBdLmNvbG9yID0gdi5jb2xvcjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHYudmFsdWVzWzBdO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdGRpc2NyZXRlRGF0YSA9IFt7IGtleTogXCJ2YXJpYWJsZVwiLCB2YWx1ZXM6IGZsYXR0ZW5WYWx1ZXMgfV07XG5cdFx0XHRcdGxvY2FsRGF0YSA9IGRpc2NyZXRlRGF0YTtcblx0XHRcdH1cblxuXHRcdFx0Ly9maWx0ZXIgYnkgY2hhcnQgdGltZVxuXHRcdFx0dmFyIGNoYXJ0VGltZSA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10aW1lXCIgKTtcblx0XHRcdGlmKCBjaGFydFRpbWUgJiYgY2hhcnRUaW1lLmxlbmd0aCA9PSAyICkge1xuXHRcdFx0XHRcblx0XHRcdFx0dmFyIHRpbWVGcm9tID0gY2hhcnRUaW1lWyAwIF0sXG5cdFx0XHRcdFx0dGltZVRvID0gY2hhcnRUaW1lWyAxIF07XG5cdFx0XHRcdFxuXHRcdFx0XHRfLmVhY2goIGxvY2FsRGF0YSwgZnVuY3Rpb24oIHNpbmdsZURhdGEsIGtleSwgbGlzdCApIHtcblx0XHRcdFx0XHR2YXIgdmFsdWVzID0gXy5jbG9uZSggc2luZ2xlRGF0YS52YWx1ZXMgKTtcblx0XHRcdFx0XHR2YWx1ZXMgPSBfLmZpbHRlciggdmFsdWVzLCBmdW5jdGlvbiggdmFsdWUgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gKCBwYXJzZUludCggdmFsdWUudGltZSwgMTAgKSA+PSB0aW1lRnJvbSAmJiBwYXJzZUludCggdmFsdWUudGltZSwgMTAgKSA8PSB0aW1lVG8gKTtcblx0XHRcdFx0XHRcdC8vcmV0dXJuICggdmFsdWUueCA+PSB0aW1lRnJvbSAmJiB2YWx1ZS54IDw9IHRpbWVUbyApO1xuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHRzaW5nbGVEYXRhLnZhbHVlcyA9IHZhbHVlcztcblx0XHRcdFx0fSApO1xuXG5cdFx0XHR9XG5cblx0XHRcdC8vaWYgbGVnZW5kIGRpc3BsYXllZCwgc29ydCBkYXRhIG9uIGtleSBhbHBoYWJldGljYWxseSAodXNlZnVsbCB3aGVuIG11bHRpdmFyaWFuIGRhdGFzZXQpXG5cdFx0XHRpZiggIUFwcC5DaGFydE1vZGVsLmdldCggXCJoaWRlLWxlZ2VuZFwiICkgKSB7XG5cdFx0XHRcdGxvY2FsRGF0YSA9IF8uc29ydEJ5KCBsb2NhbERhdGEsIGZ1bmN0aW9uKCBvYmogKSB7IHJldHVybiBvYmoua2V5OyB9ICk7XG5cdFx0XHR9XG5cblx0XHRcdC8vZ2V0IGF4aXMgY29uZmlnc1xuXHRcdFx0dmFyIHhBeGlzID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcIngtYXhpc1wiICksXG5cdFx0XHRcdHlBeGlzID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcInktYXhpc1wiICksXG5cdFx0XHRcdHhBeGlzUHJlZml4ID0gKCB4QXhpc1sgXCJheGlzLXByZWZpeFwiIF0gfHwgXCJcIiApLFxuXHRcdFx0XHR4QXhpc1N1ZmZpeCA9ICggeEF4aXNbIFwiYXhpcy1zdWZmaXhcIiBdIHx8IFwiXCIgKSxcblx0XHRcdFx0eUF4aXNQcmVmaXggPSAoIHlBeGlzWyBcImF4aXMtcHJlZml4XCIgXSB8fCBcIlwiICksXG5cdFx0XHRcdHlBeGlzU3VmZml4ID0gKCB5QXhpc1sgXCJheGlzLXN1ZmZpeFwiIF0gfHwgXCJcIiApLFxuXHRcdFx0XHR4QXhpc0xhYmVsRGlzdGFuY2UgPSAoICt4QXhpc1sgXCJheGlzLWxhYmVsLWRpc3RhbmNlXCIgXSB8fCAwICksXG5cdFx0XHRcdHlBeGlzTGFiZWxEaXN0YW5jZSA9ICggK3lBeGlzWyBcImF4aXMtbGFiZWwtZGlzdGFuY2VcIiBdIHx8IDAgKSxcblx0XHRcdFx0eEF4aXNNaW4gPSAoIHhBeGlzWyBcImF4aXMtbWluXCIgXSB8fCBudWxsICksXG5cdFx0XHRcdHhBeGlzTWF4ID0gKCB4QXhpc1sgXCJheGlzLW1heFwiIF0gfHwgbnVsbCApLFxuXHRcdFx0XHR5QXhpc01pbiA9ICggeUF4aXNbIFwiYXhpcy1taW5cIiBdIHx8IDAgKSxcblx0XHRcdFx0eUF4aXNNYXggPSAoIHlBeGlzWyBcImF4aXMtbWF4XCIgXSB8fCBudWxsICksXG5cdFx0XHRcdHhBeGlzU2NhbGUgPSAoIHhBeGlzWyBcImF4aXMtc2NhbGVcIiBdIHx8IFwibGluZWFyXCIgKSxcblx0XHRcdFx0eUF4aXNTY2FsZSA9ICggeUF4aXNbIFwiYXhpcy1zY2FsZVwiIF0gfHwgXCJsaW5lYXJcIiApLFxuXHRcdFx0XHR4QXhpc0Zvcm1hdCA9ICggeEF4aXNbIFwiYXhpcy1mb3JtYXRcIiBdIHx8IDAgKSxcblx0XHRcdFx0eUF4aXNGb3JtYXQgPSAoIHlBeGlzWyBcImF4aXMtZm9ybWF0XCIgXSB8fCAwICk7XG5cblx0XHRcdG52LmFkZEdyYXBoKGZ1bmN0aW9uKCkge1xuXG5cdFx0XHRcdHZhciBjaGFydE9wdGlvbnMgPSB7XG5cdFx0XHRcdFx0dHJhbnNpdGlvbkR1cmF0aW9uOiAzMDAsXG5cdFx0XHRcdFx0bWFyZ2luOiB7IHRvcDowLCBsZWZ0OjUwLCByaWdodDozMCwgYm90dG9tOjAgfSwvLyBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwibWFyZ2luc1wiICksXG5cdFx0XHRcdFx0c2hvd0xlZ2VuZDogZmFsc2Vcblx0XHRcdFx0fTtcblxuXHRcdFx0XHQvL2xpbmUgdHlwZVxuXHRcdFx0XHR2YXIgbGluZVR5cGUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwibGluZS10eXBlXCIgKTtcblx0XHRcdFx0aWYoIGxpbmVUeXBlID09IDIgKSB7XG5cdFx0XHRcdFx0Y2hhcnRPcHRpb25zLmRlZmluZWQgPSBmdW5jdGlvbiggZCApIHsgcmV0dXJuIGQueSAhPT0gMDsgfTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiggbGluZVR5cGUgPT0gMCApIHtcblx0XHRcdFx0XHR0aGF0LiRlbC5hZGRDbGFzcyggXCJsaW5lLWRvdHNcIiApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoYXQuJGVsLnJlbW92ZUNsYXNzKCBcImxpbmUtZG90c1wiICk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvL2RlcGVuZGluZyBvbiBjaGFydCB0eXBlIGNyZWF0ZSBjaGFydFxuXHRcdFx0XHRpZiggY2hhcnRUeXBlID09IFwiMVwiICkge1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdC8vbGluZSBjaGFydFxuXHRcdFx0XHRcdHRoYXQuY2hhcnQgPSBudi5tb2RlbHMubGluZUNoYXJ0KCkub3B0aW9ucyggY2hhcnRPcHRpb25zICk7XG5cdFx0XHRcdFxuXHRcdFx0XHR9IGVsc2UgaWYoIGNoYXJ0VHlwZSA9PSBcIjJcIiApIHtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHQvL3NjYXR0ZXIgcGxvdFxuXHRcdFx0XHRcdHZhciBwb2ludHMgPSB0aGF0LnNjYXR0ZXJCdWJibGVTaXplKCk7XG5cdFx0XHRcdFx0dGhhdC5jaGFydCA9IG52Lm1vZGVscy5zY2F0dGVyQ2hhcnQoKS5vcHRpb25zKCBjaGFydE9wdGlvbnMgKS5wb2ludFJhbmdlKCBwb2ludHMgKS5zaG93RGlzdFgoIHRydWUgKS5zaG93RGlzdFkoIHRydWUgKTtcblx0XHRcdFx0XHRcblx0XHRcdFx0fSBlbHNlIGlmKCBjaGFydFR5cGUgPT0gXCIzXCIgKSB7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0Ly9zdGFja2VkIGFyZWEgY2hhcnRcblx0XHRcdFx0XHQvL3dlIG5lZWQgdG8gbWFrZSBzdXJlIHdlIGhhdmUgYXMgbXVjaCBkYXRhIGFzIG5lY2Vzc2FyeVxuXHRcdFx0XHRcdGlmKCBsb2NhbERhdGEubGVuZ3RoICkge1xuXHRcdFx0XHRcdFx0dmFyIGJhc2VTZXJpZXMgPSBsb2NhbERhdGFbMF07XG5cdFx0XHRcdFx0XHRfLmVhY2goIGxvY2FsRGF0YSwgZnVuY3Rpb24oIHNlcmllLCBpICkge1xuXHRcdFx0XHRcdFx0XHRpZiggaSA+IDAgKSB7XG5cdFx0XHRcdFx0XHRcdFx0Ly9tYWtlIHN1cmUgd2UgaGF2ZSB2YWx1ZXMgZm9yIGdpdmVuIHNlcmllc1xuXHRcdFx0XHRcdFx0XHRcdGlmKCBzZXJpZS52YWx1ZXMgJiYgIXNlcmllLnZhbHVlcy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHQvL2Nsb25lIGJhc2Ugc2VyaWVzXG5cdFx0XHRcdFx0XHRcdFx0XHR2YXIgY29weVZhbHVlcyA9IFtdO1xuXHRcdFx0XHRcdFx0XHRcdFx0JC5leHRlbmQodHJ1ZSwgY29weVZhbHVlcywgYmFzZVNlcmllcy52YWx1ZXMpO1xuXHRcdFx0XHRcdFx0XHRcdFx0Ly9udWxsaWZ5IHZhbHVlc1xuXHRcdFx0XHRcdFx0XHRcdFx0Xy5lYWNoKCBjb3B5VmFsdWVzLCBmdW5jdGlvbiggdiwgaSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR2LnkgPSAwO1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR2LmZha2UgPSBcInRydWVcIjtcblx0XHRcdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0XHRcdFx0c2VyaWUudmFsdWVzID0gY29weVZhbHVlcztcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0Y2hhcnRPcHRpb25zLnNob3dUb3RhbEluVG9vbHRpcCA9IHRydWU7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0dGhhdC5jaGFydCA9IG52Lm1vZGVscy5zdGFja2VkQXJlYUNoYXJ0KClcblx0XHRcdFx0XHRcdC5vcHRpb25zKCBjaGFydE9wdGlvbnMgKVxuXHRcdFx0XHRcdFx0LmNvbnRyb2xPcHRpb25zKCBbIFwiU3RhY2tlZFwiLCBcIkV4cGFuZGVkXCIgXSApXG5cdFx0XHRcdFx0XHQudXNlSW50ZXJhY3RpdmVHdWlkZWxpbmUoIHRydWUgKVxuXHRcdFx0XHRcdFx0LngoIGZ1bmN0aW9uKCBkICkgeyByZXR1cm4gZFsgXCJ4XCIgXTsgfSApXG5cdFx0XHRcdFx0XHQueSggZnVuY3Rpb24oIGQgKSB7IHJldHVybiBkWyBcInlcIiBdOyB9ICk7XG5cdFx0XHRcblx0XHRcdFx0fSBlbHNlIGlmKCBjaGFydFR5cGUgPT0gXCI0XCIgfHwgY2hhcnRUeXBlID09IFwiNVwiICkge1xuXG5cdFx0XHRcdFx0Ly9tdWx0aWJhciBjaGFydFxuXHRcdFx0XHRcdC8vd2UgbmVlZCB0byBtYWtlIHN1cmUgd2UgaGF2ZSBhcyBtdWNoIGRhdGEgYXMgbmVjZXNzYXJ5XG5cdFx0XHRcdFx0dmFyIGFsbFRpbWVzID0gW10sXG5cdFx0XHRcdFx0XHQvL3N0b3JlIHZhbHVlcyBieSBbZW50aXR5XVt0aW1lXVxuXHRcdFx0XHRcdFx0dmFsdWVzQ2hlY2sgPSBbXTtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHQvL2V4dHJhY3QgYWxsIHRpbWVzXG5cdFx0XHRcdFx0Xy5lYWNoKCBsb2NhbERhdGEsIGZ1bmN0aW9uKCB2LCBpICkge1xuXHRcdFx0XHRcdFx0XHRcblx0XHRcdFx0XHRcdHZhciBlbnRpdHlEYXRhID0gW10sXG5cdFx0XHRcdFx0XHRcdHRpbWVzID0gdi52YWx1ZXMubWFwKCBmdW5jdGlvbiggdjIsIGkgKSB7XG5cdFx0XHRcdFx0XHRcdFx0ZW50aXR5RGF0YVsgdjIueCBdID0gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gdjIueDtcblx0XHRcdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdFx0dmFsdWVzQ2hlY2tbIHYuaWQgXSA9IGVudGl0eURhdGE7XG5cdFx0XHRcdFx0XHRhbGxUaW1lcyA9IGFsbFRpbWVzLmNvbmNhdCggdGltZXMgKTtcblx0XHRcdFx0XHRcdFxuXHRcdFx0XHRcdH0gKTtcblxuXHRcdFx0XHRcdGFsbFRpbWVzID0gXy51bmlxKCBhbGxUaW1lcyApO1xuXHRcdFx0XHRcdGFsbFRpbWVzID0gXy5zb3J0QnkoIGFsbFRpbWVzICk7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0aWYoIGxvY2FsRGF0YS5sZW5ndGggKSB7XG5cdFx0XHRcdFx0XHRfLmVhY2goIGxvY2FsRGF0YSwgZnVuY3Rpb24oIHNlcmllLCBzZXJpZUluZGV4ICkge1xuXHRcdFx0XHRcdFx0XHRcblx0XHRcdFx0XHRcdFx0Ly9tYWtlIHN1cmUgd2UgaGF2ZSB2YWx1ZXMgZm9yIGdpdmVuIHNlcmllc1xuXHRcdFx0XHRcdFx0XHRfLmVhY2goIGFsbFRpbWVzLCBmdW5jdGlvbiggdGltZSwgdGltZUluZGV4ICkge1xuXHRcdFx0XHRcdFx0XHRcdGlmKCB2YWx1ZXNDaGVja1sgc2VyaWUuaWQgXSAmJiAhdmFsdWVzQ2hlY2tbIHNlcmllLmlkIF1bIHRpbWUgXSApIHtcblx0XHRcdFx0XHRcdFx0XHRcdC8vdGltZSBkb2Vzbid0IGV4aXN0aWcgZm9yIGdpdmVuIGVudGl0eSwgaW5zZXJ0IHplcm8gdmFsdWVcblx0XHRcdFx0XHRcdFx0XHRcdHZhciB6ZXJvT2JqID0ge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcImtleVwiOiBzZXJpZS5rZXksXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFwic2VyaWVcIjogc2VyaWVJbmRleCxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XCJ0aW1lXCI6IHRpbWUsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFwieFwiOiB0aW1lLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcInlcIjogMCxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XCJmYWtlXCI6IHRydWVcblx0XHRcdFx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XHRcdFx0XHRzZXJpZS52YWx1ZXMuc3BsaWNlKCB0aW1lSW5kZXgsIDAsIHplcm9PYmogKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYoIGNoYXJ0VHlwZSA9PSBcIjRcIiApIHtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHRcdHRoYXQuY2hhcnQgPSBudi5tb2RlbHMubXVsdGlCYXJDaGFydCgpLm9wdGlvbnMoIGNoYXJ0T3B0aW9ucyApO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdH0gZWxzZSBpZiggIGNoYXJ0VHlwZSA9PSBcIjVcIiApIHtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHRcdHRoYXQuY2hhcnQgPSBudi5tb2RlbHMubXVsdGlCYXJIb3Jpem9udGFsQ2hhcnQoKS5vcHRpb25zKCBjaGFydE9wdGlvbnMgKTsvLy5zaG93VmFsdWVzKCB0cnVlICk7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdH0gZWxzZSBpZiggY2hhcnRUeXBlID09IFwiNlwiICkge1xuXG5cdFx0XHRcdFx0Y2hhcnRPcHRpb25zLnNob3dWYWx1ZXMgPSB0cnVlO1xuXG5cdFx0XHRcdFx0dGhhdC5jaGFydCA9IG52Lm1vZGVscy5kaXNjcmV0ZUJhckNoYXJ0KClcblx0XHRcdFx0XHRcdC54KCBmdW5jdGlvbiggZCApIHsgcmV0dXJuIGQueDsgfSApXG5cdFx0XHRcdFx0XHQueSggZnVuY3Rpb24oIGQgKSB7IHJldHVybiBkLnk7IH0gKVxuXHRcdFx0XHRcdFx0Lm9wdGlvbnMoIGNoYXJ0T3B0aW9ucyApO1xuXG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvL2ZpeGVkIHByb2JhYmx5IGEgYnVnIGluIG52ZDMgd2l0aCBwcmV2aW91cyB0b29sdGlwIG5vdCBiZWluZyByZW1vdmVkXG5cdFx0XHRcdGQzLnNlbGVjdCggXCIueHktdG9vbHRpcFwiICkucmVtb3ZlKCk7XG5cblx0XHRcdFx0dGhhdC5jaGFydC54QXhpc1xuXHRcdFx0XHRcdC5heGlzTGFiZWwoIHhBeGlzWyBcImF4aXMtbGFiZWxcIiBdIClcblx0XHRcdFx0XHQvLy5zdGFnZ2VyTGFiZWxzKCB0cnVlIClcblx0XHRcdFx0XHQuYXhpc0xhYmVsRGlzdGFuY2UoIHhBeGlzTGFiZWxEaXN0YW5jZSApXG5cdFx0XHRcdFx0LnRpY2tGb3JtYXQoIGZ1bmN0aW9uKGQpIHtcblx0XHRcdFx0XHRcdGlmKCBjaGFydFR5cGUgIT0gMiApIHtcblx0XHRcdFx0XHRcdFx0Ly94IGF4aXMgaGFzIHRpbWUgaW5mb3JtYXRpb25cblx0XHRcdFx0XHRcdFx0cmV0dXJuIEFwcC5VdGlscy5mb3JtYXRUaW1lTGFiZWwoIHRpbWVUeXBlLCBkLCB4QXhpc1ByZWZpeCwgeEF4aXNTdWZmaXgsIHhBeGlzRm9ybWF0ICk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHQvL2lzIHNjYXR0ZXIgcGxvdCwgeC1heGlzIGhhcyBzb21lIG90aGVyIGluZm9ybWF0aW9uXG5cdFx0XHRcdFx0XHRcdHJldHVybiB4QXhpc1ByZWZpeCArIGQzLmZvcm1hdCggXCIsXCIgKSggQXBwLlV0aWxzLmZvcm1hdFZhbHVlKCBkLCB4QXhpc0Zvcm1hdCApICkgKyB4QXhpc1N1ZmZpeDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9ICk7XG5cblx0XHRcdFx0aWYoIHRpbWVUeXBlID09IFwiUXVhcnRlciBDZW50dXJ5XCIgKSB7XG5cdFx0XHRcdFx0dGhhdC5jaGFydC54QXhpcy5zdGFnZ2VyTGFiZWxzKCB0cnVlICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdC8vZ2V0IGV4dGVuZFxuXHRcdFx0XHR2YXIgYWxsVmFsdWVzID0gW107XG5cdFx0XHRcdF8uZWFjaCggbG9jYWxEYXRhLCBmdW5jdGlvbiggdiwgaSApIHtcblx0XHRcdFx0XHRpZiggdi52YWx1ZXMgKSB7XG5cdFx0XHRcdFx0XHRhbGxWYWx1ZXMgPSBhbGxWYWx1ZXMuY29uY2F0KCB2LnZhbHVlcyApO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiggJC5pc0FycmF5KCB2ICkgKXtcblx0XHRcdFx0XHRcdC8vc3BlY2lhbCBjYXNlIGZvciBkaXNjcmV0ZSBiYXIgY2hhcnRcblx0XHRcdFx0XHRcdGFsbFZhbHVlcyA9IHY7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9ICk7XG5cblx0XHRcdFx0Ly9kb21haW4gc2V0dXBcblx0XHRcdFx0dmFyIHhEb21haW4gPSBkMy5leHRlbnQoIGFsbFZhbHVlcy5tYXAoIGZ1bmN0aW9uKCBkICkgeyByZXR1cm4gZC54OyB9ICkgKSxcblx0XHRcdFx0XHR5RG9tYWluID0gZDMuZXh0ZW50KCBhbGxWYWx1ZXMubWFwKCBmdW5jdGlvbiggZCApIHsgcmV0dXJuIGQueTsgfSApICksXG5cdFx0XHRcdFx0aXNDbGFtcGVkID0gZmFsc2U7XG5cblx0XHRcdFx0Ly9jb25zb2xlLmxvZyggXCJjaGFydC5zdGFja2VkLnN0eWxlKClcIiwgdGhhdC5jaGFydC5zdGFja2VkLnN0eWxlKCkgKTtcblxuXHRcdFx0XHRpZiggeEF4aXNNaW4gJiYgIWlzTmFOKCB4QXhpc01pbiApICkge1xuXHRcdFx0XHRcdHhEb21haW5bIDAgXSA9IHhBeGlzTWluO1xuXHRcdFx0XHRcdGlzQ2xhbXBlZCA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYoIHhBeGlzTWF4ICYmICFpc05hTiggeEF4aXNNYXggKSApIHtcblx0XHRcdFx0XHR4RG9tYWluWyAxIF0gPSB4QXhpc01heDtcblx0XHRcdFx0XHRpc0NsYW1wZWQgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmKCB5QXhpc01pbiAmJiAhaXNOYU4oIHlBeGlzTWluICkgKSB7XG5cdFx0XHRcdFx0eURvbWFpblsgMCBdID0geUF4aXNNaW47XG5cdFx0XHRcdFx0aXNDbGFtcGVkID0gdHJ1ZTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvL2RlZmF1bHQgaXMgemVybyAoZG9uJ3QgZG8gaXQgZm9yIHN0YWNrIGJhciBjaGFydCwgbWVzc2VzIHVwIHRoaW5ncylcblx0XHRcdFx0XHRpZiggY2hhcnRUeXBlICE9IFwiM1wiICkge1xuXHRcdFx0XHRcdFx0eURvbWFpblsgMCBdID0gMDtcblx0XHRcdFx0XHRcdGlzQ2xhbXBlZCA9IHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGlmKCB5QXhpc01heCAmJiAhaXNOYU4oIHlBeGlzTWF4ICkgKSB7XG5cdFx0XHRcdFx0eURvbWFpblsgMSBdID0geUF4aXNNYXg7XG5cdFx0XHRcdFx0aXNDbGFtcGVkID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0Ly9tYW51YWxseSBjbGFtcCB2YWx1ZXNcblx0XHRcdFx0aWYoIGlzQ2xhbXBlZCApIHtcblxuXHRcdFx0XHRcdGlmKCBjaGFydFR5cGUgIT09IFwiNFwiICYmIGNoYXJ0VHlwZSAhPT0gXCI1XCIgJiYgY2hhcnRUeXBlICE9PSBcIjZcIiApIHtcblx0XHRcdFx0XHRcdHRoYXQuY2hhcnQuZm9yY2VYKCB4RG9tYWluICk7XG5cdFx0XHRcdFx0XHR0aGF0LmNoYXJ0LmZvcmNlWSggeURvbWFpbiApO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8qdGhhdC5jaGFydC54RG9tYWluKCB4RG9tYWluICk7XG5cdFx0XHRcdFx0dGhhdC5jaGFydC55RG9tYWluKCB5RG9tYWluICk7XG5cdFx0XHRcdFx0dGhhdC5jaGFydC54U2NhbGUoKS5jbGFtcCggdHJ1ZSApO1xuXHRcdFx0XHRcdHRoYXQuY2hhcnQueVNjYWxlKCkuY2xhbXAoIHRydWUgKTsqL1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly9zZXQgc2NhbGVzLCBtdWx0aWJhciBjaGFydFxuXHRcdFx0XHRpZiggeUF4aXNTY2FsZSA9PT0gXCJsaW5lYXJcIiApIHtcblx0XHRcdFx0XHR0aGF0LmNoYXJ0LnlTY2FsZSggZDMuc2NhbGUubGluZWFyKCkgKTtcblx0XHRcdFx0fSBlbHNlIGlmKCB5QXhpc1NjYWxlID09PSBcImxvZ1wiICkge1xuXHRcdFx0XHRcdHRoYXQuY2hhcnQueVNjYWxlKCBkMy5zY2FsZS5sb2coKSApO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYoIGNoYXJ0VHlwZSA9PT0gXCI0XCIgfHwgY2hhcnRUeXBlID09PSBcIjVcIiApIHtcblx0XHRcdFx0XHQvL2ZvciBtdWx0aWJhciBjaGFydCwgeCBheGlzIGhhcyBvcmRpbmFsIHNjYWxlLCBzbyBuZWVkIHRvIHNldHVwIGRvbWFpbiBwcm9wZXJseVxuXHRcdFx0XHRcdC8vdGhhdC5jaGFydC54RG9tYWluKCBkMy5yYW5nZSh4RG9tYWluWzBdLCB4RG9tYWluWzFdICsgMSkgKTtcblx0XHRcdFx0XHR0aGF0LmNoYXJ0LnhEb21haW4oIGFsbFRpbWVzICk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGF0LmNoYXJ0LnlBeGlzXG5cdFx0XHRcdFx0LmF4aXNMYWJlbCggeUF4aXNbIFwiYXhpcy1sYWJlbFwiIF0gKVxuXHRcdFx0XHRcdC5heGlzTGFiZWxEaXN0YW5jZSggeUF4aXNMYWJlbERpc3RhbmNlIClcblx0XHRcdFx0XHQudGlja0Zvcm1hdCggZnVuY3Rpb24oZCkgeyByZXR1cm4geUF4aXNQcmVmaXggKyBkMy5mb3JtYXQoIFwiLFwiICkoIEFwcC5VdGlscy5mb3JtYXRWYWx1ZSggZCwgeUF4aXNGb3JtYXQgKSApICsgeUF4aXNTdWZmaXg7IH0pXG5cdFx0XHRcdFx0LnNob3dNYXhNaW4oZmFsc2UpO1xuXHRcdFx0XHRcblx0XHRcdFx0Ly9zY2F0dGVyIHBsb3RzIG5lZWQgbW9yZSB0aWNrc1xuXHRcdFx0XHRpZiggY2hhcnRUeXBlID09PSBcIjJcIiApIHtcblx0XHRcdFx0XHQvL2hhcmRjb2RlXG5cdFx0XHRcdFx0dGhhdC5jaGFydC54QXhpcy50aWNrcyggNyApO1xuXHRcdFx0XHRcdHRoYXQuY2hhcnQueUF4aXMudGlja3MoIDcgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0dmFyIHN2Z1NlbGVjdGlvbiA9IGQzLnNlbGVjdCggdGhhdC4kc3ZnLnNlbGVjdG9yIClcblx0XHRcdFx0XHQuZGF0dW0oIGxvY2FsRGF0YSApXG5cdFx0XHRcdFx0LmNhbGwoIHRoYXQuY2hhcnQgKTtcblxuXHRcdFx0XHRpZiggY2hhcnRUeXBlICE9PSBcIjNcIiApIHtcblxuXHRcdFx0XHRcdHRoYXQuY2hhcnQudG9vbHRpcC5jb250ZW50R2VuZXJhdG9yKCBBcHAuVXRpbHMuY29udGVudEdlbmVyYXRvciApO1xuXG5cdFx0XHRcdH0gZWxzZSB7XG5cblx0XHRcdFx0XHQvL3NldCBwb3B1cFxuXHRcdFx0XHRcdHZhciB1bml0c1N0cmluZyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJ1bml0c1wiICksXG5cdFx0XHRcdFx0XHR1bml0cyA9ICggISQuaXNFbXB0eU9iamVjdCggdW5pdHNTdHJpbmcgKSApPyAkLnBhcnNlSlNPTiggdW5pdHNTdHJpbmcgKToge30sXG5cdFx0XHRcdFx0XHRzdHJpbmcgPSBcIlwiLFxuXHRcdFx0XHRcdFx0dmFsdWVzU3RyaW5nID0gXCJcIjtcblxuXHRcdFx0XHRcdC8vZDMuZm9ybWF0IHdpdGggYWRkZWQgcGFyYW1zIHRvIGFkZCBhcmJpdHJhcnkgc3RyaW5nIGF0IHRoZSBlbmRcblx0XHRcdFx0XHR2YXIgY3VzdG9tRm9ybWF0dGVyID0gZnVuY3Rpb24oIGZvcm1hdFN0cmluZywgc3VmZml4ICkge1xuXHRcdFx0XHRcdFx0dmFyIGZ1bmMgPSBkMy5mb3JtYXQoIGZvcm1hdFN0cmluZyApO1xuXHRcdFx0XHRcdFx0cmV0dXJuIGZ1bmN0aW9uKCBkLCBpICkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZnVuYyggZCApICsgc3VmZml4O1xuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR9O1xuXG5cdFx0XHRcdFx0Ly9kaWZmZXJlbnQgcG9wdXAgc2V0dXAgZm9yIHN0YWNrZWQgYXJlYSBjaGFydFxuXHRcdFx0XHRcdHZhciB1bml0ID0gXy5maW5kV2hlcmUoIHVuaXRzLCB7IHByb3BlcnR5OiBcInlcIiB9ICk7XG5cdFx0XHRcdFx0aWYoIHVuaXQgJiYgdW5pdC5mb3JtYXQgKSB7XG5cdFx0XHRcdFx0XHR2YXIgZml4ZWQgPSBNYXRoLm1pbiggMjAsIHBhcnNlSW50KCB1bml0LmZvcm1hdCwgMTAgKSApLFxuXHRcdFx0XHRcdFx0XHR1bml0TmFtZSA9ICggdW5pdC51bml0ICk/IFwiIFwiICsgdW5pdC51bml0OiBcIlwiO1xuXHRcdFx0XHRcdFx0dGhhdC5jaGFydC5pbnRlcmFjdGl2ZUxheWVyLnRvb2x0aXAudmFsdWVGb3JtYXR0ZXIoIGN1c3RvbUZvcm1hdHRlcihcIi5cIiArIGZpeGVkICsgXCJmXCIsIHVuaXROYW1lICkgKTtcblx0XHRcdFx0XHRcdC8vdGhhdC5jaGFydC5pbnRlcmFjdGl2ZUxheWVyLnRvb2x0aXAudmFsdWVGb3JtYXR0ZXIoIGQzLmZvcm1hdChcIi5cIiArIGZpeGVkICsgXCJmXCIgKSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0Ly9zZXQgbGVnZW5kXG5cdFx0XHRcdGlmKCAhQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImhpZGUtbGVnZW5kXCIgKSApIHtcblx0XHRcdFx0XHQvL21ha2Ugc3VyZSB3cmFwcGVyIGlzIHZpc2libGVcblx0XHRcdFx0XHR0aGF0LiRzdmcuZmluZCggXCI+IC5udmQzLm52LWN1c3RvbS1sZWdlbmRcIiApLnNob3coKTtcblx0XHRcdFx0XHR0aGF0LmxlZ2VuZCA9IG5ldyBMZWdlbmQoIHRoYXQuY2hhcnQubGVnZW5kICkudmVycyggXCJvd2RcIiApO1xuXHRcdFx0XHRcdHRoYXQubGVnZW5kLmRpc3BhdGNoLm9uKCBcInJlbW92ZUVudGl0eVwiLCBmdW5jdGlvbiggaWQgKSB7XG5cdFx0XHRcdFx0XHR0aGF0Lm9uUmVtb3ZlRW50aXR5KCBpZCApO1xuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHR0aGF0LmxlZ2VuZC5kaXNwYXRjaC5vbiggXCJhZGRFbnRpdHlcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRpZiggdGhhdC4kZW50aXRpZXNTZWxlY3QuZGF0YSggXCJjaG9zZW5cIiApICkge1xuXHRcdFx0XHRcdFx0XHR0aGF0LiRlbnRpdGllc1NlbGVjdC5kYXRhKCBcImNob3NlblwiICkuYWN0aXZlX2ZpZWxkID0gZmFsc2U7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHQvL3RyaWdnZXIgb3BlbiB0aGUgY2hvc2VuIGRyb3AgZG93blxuXHRcdFx0XHRcdFx0dGhhdC4kZW50aXRpZXNTZWxlY3QudHJpZ2dlciggXCJjaG9zZW46b3BlblwiICk7XG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdHN2Z1NlbGVjdGlvbi5jYWxsKCB0aGF0LmxlZ2VuZCApO1xuXHRcdFx0XHRcdC8vcHV0IGxlZ2VuZCBhYm92ZSBjaGFydFxuXG5cdFx0XHRcdFx0Ly9pZiBzdGFja2VkIGFyZWEgY2hhcnRcblx0XHRcdFx0XHRpZiggY2hhcnRUeXBlID09PSBcIjNcIiApIHtcblx0XHRcdFx0XHRcdHRoYXQuY2hhcnQuc3RhY2tlZC5kaXNwYXRjaC5vbiggXCJhcmVhTW91c2VvdmVyXCIsIGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHRcdFx0XHRcdHRoYXQubGVnZW5kLmhpZ2hsaWdodFBvaW50KCBldnQgKTtcblx0XHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHRcdHRoYXQuY2hhcnQuc3RhY2tlZC5kaXNwYXRjaC5vbiggXCJhcmVhTW91c2VvdXRcIiwgZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdFx0XHRcdFx0dGhhdC5sZWdlbmQuY2xlYXJIaWdobGlnaHQoKTtcblx0XHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHR9XG5cblxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vbm8gbGVnZW5kLCByZW1vdmUgd2hhdCBtaWdodCBoYXZlIHByZXZpb3VzbHkgYmVlbiB0aGVyZVxuXHRcdFx0XHRcdHRoYXQuJHN2Zy5maW5kKCBcIj4gLm52ZDMubnYtY3VzdG9tLWxlZ2VuZFwiICkuaGlkZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdFxuXHRcdFx0XHR2YXIgb25SZXNpemVDYWxsYmFjayA9IF8uZGVib3VuY2UoIGZ1bmN0aW9uKGUpIHtcblx0XHRcdFx0XHQvL2ludm9rZSByZXNpemUgb2YgbGVnZW5kLCBpZiB0aGVyZSdzIG9uZSwgc2NhdHRlciBwbG90IGRvZXNuJ3QgaGF2ZSBhbnkgYnkgZGVmYXVsdFxuXHRcdFx0XHRcdGlmKCB0aGF0LmxlZ2VuZCApIHtcblx0XHRcdFx0XHRcdHN2Z1NlbGVjdGlvbi5jYWxsKCB0aGF0LmxlZ2VuZCApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGF0LnBhcmVudFZpZXcub25SZXNpemUoKTtcblx0XHRcdFx0fSwgMTUwICk7XG5cdFx0XHRcdG52LnV0aWxzLndpbmRvd1Jlc2l6ZSggb25SZXNpemVDYWxsYmFjayApO1xuXHRcdFx0XHRcdFx0XG5cdFx0XHRcdHRoYXQucGFyZW50Vmlldy5vblJlc2l6ZSgpO1xuXG5cdFx0XHRcdHZhciBzdGF0ZUNoYW5nZUV2ZW50ID0gKCBjaGFydFR5cGUgIT09IFwiNlwiICk/IFwic3RhdGVDaGFuZ2VcIjogXCJyZW5kZXJFbmRcIjtcblx0XHRcdFx0dGhhdC5jaGFydC5kaXNwYXRjaC5vbiggc3RhdGVDaGFuZ2VFdmVudCwgZnVuY3Rpb24oIHN0YXRlICkge1xuXHRcdFx0XHRcdC8vcmVmcmVzaCBsZWdlbmQ7XG5cdFx0XHRcdFx0c3ZnU2VsZWN0aW9uLmNhbGwoIHRoYXQubGVnZW5kICk7XG5cblx0XHRcdFx0XHQvL1xuXHRcdFx0XHRcdGlmKCBjaGFydFR5cGUgPT09IFwiM1wiICkge1xuXHRcdFx0XHRcdFx0dGhhdC5jaGVja1N0YWNrZWRBeGlzKCk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly9UT0RPIC0gdWdseSEgbmVlZHMgdGltZW91dCBhbmQgcmVhY2hpbmcgdG8gY2hhcnR2aWV3ICBcblx0XHRcdFx0XHRzZXRUaW1lb3V0KCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdHRoYXQucGFyZW50Vmlldy5vblJlc2l6ZSgpO1xuXHRcdFx0XHRcdH0sIDEpO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdHRoYXQucGFyZW50Vmlldy5kYXRhVGFiLnJlbmRlciggZGF0YSwgbG9jYWxEYXRhLCBkaW1lbnNpb25zICk7XG5cdFx0XHRcdFxuXHRcdFx0XHRpZiggY2hhcnRUeXBlID09IFwiMlwiICkge1xuXHRcdFx0XHRcdC8vbmVlZCB0byBoYXZlIG93biBzaG93RGlzdCBpbXBsZW1lbnRhdGlvbiwgY2F1c2UgdGhlcmUncyBhIGJ1ZyBpbiBudmQzXG5cdFx0XHRcdFx0dGhhdC5zY2F0dGVyRGlzdCgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdFxuXHRcdFx0XHQvL2lmIHkgYXhpcyBoYXMgemVybywgZGlzcGxheSBzb2xpZCBsaW5lXG5cdFx0XHRcdHZhciAkcGF0aERvbWFpbiA9ICQoIFwiLm52ZDMgLm52LWF4aXMubnYteCBwYXRoLmRvbWFpblwiICk7XG5cdFx0XHRcdGlmKCB5RG9tYWluWyAwIF0gPT09IDAgKSB7XG5cdFx0XHRcdFx0JHBhdGhEb21haW4uY3NzKCBcInN0cm9rZS1vcGFjaXR5XCIsIFwiMVwiICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0JHBhdGhEb21haW4uY3NzKCBcInN0cm9rZS1vcGFjaXR5XCIsIFwiMFwiICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdC8vdGhhdC5zY2FsZVNlbGVjdG9ycy5pbml0RXZlbnRzKCk7XG5cdFx0XHRcdHZhciBjaGFydERpbWVuc2lvbnNTdHJpbmcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtZGltZW5zaW9uc1wiICk7XG5cdFx0XHRcdGlmKCBjaGFydERpbWVuc2lvbnNTdHJpbmcuaW5kZXhPZiggJ1wicHJvcGVydHlcIjpcImNvbG9yXCInICkgPT09IC0xICkge1xuXHRcdFx0XHRcdC8vY2hlY2sgaWYgc3RyaW5nIGRvZXMgbm90IGNvbnRhaW4gXCJwcm9wZXJ0eVwiOlwiY29sb3JcIlxuXHRcdFx0XHRcdHRoYXQuY2FjaGVDb2xvcnMoIGxvY2FsRGF0YSApO1xuXHRcdFx0XHR9XG5cblx0XHRcdH0pO1xuXG5cdFx0fSxcblxuXHRcdHNjYXR0ZXJEaXN0OiBmdW5jdGlvbigpIHtcblxuXHRcdFx0dmFyIHRoYXQgPSB0aGlzLFxuXHRcdFx0XHRtYXJnaW5zID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcIm1hcmdpbnNcIiApLFxuXHRcdFx0XHRudkRpc3RyWCA9ICQoIFwiLm52LWRpc3RyaWJ1dGlvblhcIiApLm9mZnNldCgpLnRvcCxcblx0XHRcdFx0c3ZnU2VsZWN0aW9uID0gZDMuc2VsZWN0KCBcInN2Z1wiICk7XG5cblx0XHRcdHRoYXQuY2hhcnQuc2NhdHRlci5kaXNwYXRjaC5vbignZWxlbWVudE1vdXNlb3Zlci50b29sdGlwJywgZnVuY3Rpb24oZXZ0KSB7XG5cdFx0XHRcdHZhciBzdmdPZmZzZXQgPSB0aGF0LiRzdmcub2Zmc2V0KCksXG5cdFx0XHRcdFx0c3ZnSGVpZ2h0ID0gdGhhdC4kc3ZnLmhlaWdodCgpO1xuXHRcdFx0XHRzdmdTZWxlY3Rpb24uc2VsZWN0KCcubnYtc2VyaWVzLScgKyBldnQuc2VyaWVzSW5kZXggKyAnIC5udi1kaXN0eC0nICsgZXZ0LnBvaW50SW5kZXgpXG5cdFx0XHRcdFx0LmF0dHIoJ3kxJywgZXZ0LnBvcy50b3AgLSBudkRpc3RyWCApO1xuXHRcdFx0XHRzdmdTZWxlY3Rpb24uc2VsZWN0KCcubnYtc2VyaWVzLScgKyBldnQuc2VyaWVzSW5kZXggKyAnIC5udi1kaXN0eS0nICsgZXZ0LnBvaW50SW5kZXgpXG5cdFx0XHRcdFx0LmF0dHIoJ3gyJywgZXZ0LnBvcy5sZWZ0IC0gc3ZnT2Zmc2V0LmxlZnQgLSBtYXJnaW5zLmxlZnQgKTtcblx0XHRcdFx0dmFyIHBvc2l0aW9uID0ge2xlZnQ6IGQzLmV2ZW50LmNsaWVudFgsIHRvcDogZDMuZXZlbnQuY2xpZW50WSB9O1xuXHRcdFx0XHR0aGF0LmNoYXJ0LnRvb2x0aXAucG9zaXRpb24ocG9zaXRpb24pLmRhdGEoZXZ0KS5oaWRkZW4oZmFsc2UpO1xuXHRcdFx0fSk7XG5cblx0XHR9LFxuXG5cdFx0c2NhdHRlckJ1YmJsZVNpemU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0Ly9zZXQgc2l6ZSBvZiB0aGUgYnViYmxlcyBkZXBlbmRpbmcgb24gYnJvd3NlciB3aWR0aFxuXHRcdFx0dmFyIGJyb3dzZXJXaWR0aCA9ICQoIHdpbmRvdyApLndpZHRoKCksXG5cdFx0XHRcdGJyb3dzZXJDb2VmID0gTWF0aC5tYXgoIDEsIGJyb3dzZXJXaWR0aCAvIDExMDAgKSxcblx0XHRcdFx0cG9pbnRNaW4gPSAxMDAgKiBNYXRoLnBvdyggYnJvd3NlckNvZWYsIDIgKSxcblx0XHRcdFx0cG9pbnRNYXggPSAxMDAwICogTWF0aC5wb3coIGJyb3dzZXJDb2VmLCAyICk7XG5cdFx0XHRyZXR1cm4gWyBwb2ludE1pbiwgcG9pbnRNYXggXTtcblx0XHR9LFxuXG5cdFx0Y2hlY2tTdGFja2VkQXhpczogZnVuY3Rpb24oKSB7XG5cblx0XHRcdC8vc2V0dGluZyB5QXhpc01heCBicmVha3MgZXhwYW5kZWQgc3RhY2tlZCBjaGFydCwgbmVlZCB0byBjaGVjayBtYW51YWxseVxuXHRcdFx0dmFyIHN0YWNrZWRTdHlsZSA9IHRoaXMuY2hhcnQuc3RhY2tlZC5zdHlsZSgpLFxuXHRcdFx0XHR5QXhpcyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJ5LWF4aXNcIiApLFxuXHRcdFx0XHR5QXhpc01pbiA9ICggeUF4aXNbIFwiYXhpcy1taW5cIiBdIHx8IDAgKSxcblx0XHRcdFx0eUF4aXNNYXggPSAoIHlBeGlzWyBcImF4aXMtbWF4XCIgXSB8fCBudWxsICksXG5cdFx0XHRcdHlEb21haW4gPSBbIHlBeGlzTWluLCB5QXhpc01heCBdO1xuXHRcdFx0aWYoIHlBeGlzTWF4ICkge1xuXHRcdFx0XHQvL2NoYXJ0IGhhcyBzZXQgeUF4aXMgdG8gbWF4LCBkZXBlbmRpbmcgb24gc3RhY2tlZCBzdHlsZSBzZXQgbWF4XG5cdFx0XHRcdGlmKCBzdGFja2VkU3R5bGUgPT09IFwiZXhwYW5kXCIgKSB7XG5cdFx0XHRcdFx0eURvbWFpbiA9IFsgMCwgMSBdO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuY2hhcnQueURvbWFpbiggeURvbWFpbiApO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0fSxcblxuXHRcdG9uUmVtb3ZlRW50aXR5OiBmdW5jdGlvbiggaWQgKSB7XG5cblx0XHRcdHZhciBzZWxlY3RlZENvdW50cmllcyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiApLFxuXHRcdFx0XHRjb3VudHJpZXNJZHMgPSBfLmtleXMoIHNlbGVjdGVkQ291bnRyaWVzICksXG5cdFx0XHRcdGFkZENvdW50cnlNb2RlID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImFkZC1jb3VudHJ5LW1vZGVcIiApO1xuXG5cdFx0XHRpZiggY291bnRyaWVzSWRzLmxlbmd0aCA9PT0gMCApIHtcblx0XHRcdFx0Ly9yZW1vdmluZyBmcm9tIGVtcHR5IHNlbGVjdGlvbiwgbmVlZCB0byBjb3B5IGFsbCBjb3VudHJpZXMgYXZhaWxhYmxlIGludG8gc2VsZWN0ZWQgY291bnRyaWVzIHNlbGVjdGlvblxuXHRcdFx0XHR2YXIgZW50aXRpZXNDb2xsZWN0aW9uID0gW10sXG5cdFx0XHRcdC8vdmFyIGVudGl0aWVzQ29sbGVjdGlvbiA9IHt9LFxuXHRcdFx0XHRcdGZvcm1Db25maWcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiZm9ybS1jb25maWdcIiApO1xuXHRcdFx0XHRpZiggZm9ybUNvbmZpZyAmJiBmb3JtQ29uZmlnWyBcImVudGl0aWVzLWNvbGxlY3Rpb25cIiBdICkge1xuXHRcdFx0XHRcdF8ubWFwKCBmb3JtQ29uZmlnWyBcImVudGl0aWVzLWNvbGxlY3Rpb25cIiBdLCBmdW5jdGlvbiggZCwgaSApIHsgZW50aXRpZXNDb2xsZWN0aW9uWyBkLmlkIF0gPSBkOyB9ICk7XG5cdFx0XHRcdFx0Ly9kZWVwIGNvcHkgYXJyYXlcblx0XHRcdFx0XHR2YXIgZW50aXRpZXNDb3B5ID0gICQuZXh0ZW5kKCB0cnVlLCBbXSwgZm9ybUNvbmZpZ1sgXCJlbnRpdGllcy1jb2xsZWN0aW9uXCIgXSApO1xuXHRcdFx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiwgZW50aXRpZXNDb3B5ICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdEFwcC5DaGFydE1vZGVsLnJlbW92ZVNlbGVjdGVkQ291bnRyeSggaWQgKTtcblxuXHRcdH0sXG5cblx0XHRvbkF2YWlsYWJsZUNvdW50cmllczogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dmFyICRzZWxlY3QgPSAkKCBldnQuY3VycmVudFRhcmdldCApLFxuXHRcdFx0XHR2YWwgPSAkc2VsZWN0LnZhbCgpLFxuXHRcdFx0XHQkb3B0aW9uID0gJHNlbGVjdC5maW5kKCBcIlt2YWx1ZT1cIiArIHZhbCArIFwiXVwiICksXG5cdFx0XHRcdHRleHQgPSAkb3B0aW9uLnRleHQoKTtcblxuXHRcdFx0aWYoICFBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiZ3JvdXAtYnktdmFyaWFibGVzXCIgKSAmJiBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiYWRkLWNvdW50cnktbW9kZVwiICkgPT09IFwiYWRkLWNvdW50cnlcIiApIHtcblx0XHRcdFx0QXBwLkNoYXJ0TW9kZWwuYWRkU2VsZWN0ZWRDb3VudHJ5KCB7IGlkOiAkc2VsZWN0LnZhbCgpLCBuYW1lOiB0ZXh0IH0gKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdEFwcC5DaGFydE1vZGVsLnJlcGxhY2VTZWxlY3RlZENvdW50cnkoIHsgaWQ6ICRzZWxlY3QudmFsKCksIG5hbWU6IHRleHQgfSApO1xuXHRcdFx0fVxuXG5cdFx0XHQvL2RvdWJsZSBjaGVjayBpZiB3ZSBkb24ndCBoYXZlIGZ1bGwgc2VsZWN0aW9uIG9mIGNvdW50cmllc1xuXHRcdFx0dmFyIGVudGl0aWVzQ29sbGVjdGlvbiA9IHt9LFxuXHRcdFx0XHRmb3JtQ29uZmlnID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImZvcm0tY29uZmlnXCIgKTtcblx0XHRcdGlmKCBmb3JtQ29uZmlnICYmIGZvcm1Db25maWdbIFwiZW50aXRpZXMtY29sbGVjdGlvblwiIF0gKSB7XG5cdFx0XHRcdHZhciBzZWxlY3RlZENvdW50cmllc0lkcyA9IF8ua2V5cyggQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcInNlbGVjdGVkLWNvdW50cmllc1wiICkgKTtcblx0XHRcdFx0aWYoIHNlbGVjdGVkQ291bnRyaWVzSWRzLmxlbmd0aCA9PSBmb3JtQ29uZmlnWyBcImVudGl0aWVzLWNvbGxlY3Rpb25cIiBdLmxlbmd0aCApIHtcblx0XHRcdFx0XHRBcHAuQ2hhcnRNb2RlbC5zZXQoIFwic2VsZWN0ZWQtY291bnRyaWVzXCIsIFtdLCB7c2lsZW50OnRydWV9ICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdH0sXG5cblx0XHRjYWNoZUNvbG9yczogZnVuY3Rpb24oIGRhdGEgKSB7XG5cdFx0XHRpZiggIXRoaXMuY2FjaGVkQ29sb3JzLmxlbmd0aCApIHtcblx0XHRcdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdFx0XHRfLmVhY2goIGRhdGEsIGZ1bmN0aW9uKCB2LCBpICkge1xuXHRcdFx0XHRcdHRoYXQuY2FjaGVkQ29sb3JzWyB2LmlkIF0gPSB2LmNvbG9yO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdGFzc2lnbkNvbG9yRnJvbUNhY2hlOiBmdW5jdGlvbiggdmFsdWUgKSB7XG5cdFx0XHRpZiggdGhpcy5jYWNoZWRDb2xvcnMubGVuZ3RoICkge1xuXHRcdFx0XHQvL2Fzc2luZyBjb2xvciBmcm9tZSBjYWNoZVxuXHRcdFx0XHRpZiggdGhpcy5jYWNoZWRDb2xvcnNbIHZhbHVlLmlkIF0gKSB7XG5cdFx0XHRcdFx0dmFsdWUuY29sb3IgPSB0aGlzLmNhY2hlZENvbG9yc1sgdmFsdWUuaWQgXTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR2YXIgcmFuZG9tQ29sb3IgPSBBcHAuVXRpbHMuZ2V0UmFuZG9tQ29sb3IoKTtcblx0XHRcdFx0XHR2YWx1ZS5jb2xvciA9IHJhbmRvbUNvbG9yO1xuXHRcdFx0XHRcdHRoaXMuY2FjaGVkQ29sb3JzWyB2YWx1ZS5pZCBdID0gcmFuZG9tQ29sb3I7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHR9XG5cdFx0XG5cdH0gKTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5DaGFydC5DaGFydFRhYjtcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBBcHAgPSByZXF1aXJlKCBcIi4vLi4vLi4vbmFtZXNwYWNlcy5qc1wiICk7XG5cblx0QXBwLlZpZXdzLkNoYXJ0LkRhdGFUYWIgPSBCYWNrYm9uZS5WaWV3LmV4dGVuZCgge1xuXG5cdFx0ZWw6IFwiI2NoYXJ0LXZpZXdcIixcblx0XHRldmVudHM6IHt9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHRcblx0XHRcdHRoaXMuZGlzcGF0Y2hlciA9IG9wdGlvbnMuZGlzcGF0Y2hlcjtcblxuXHRcdFx0Ly9kYXRhIHRhYlxuXHRcdFx0dGhpcy4kZGF0YVRhYiA9IHRoaXMuJGVsLmZpbmQoIFwiI2RhdGEtY2hhcnQtdGFiXCIgKTtcblx0XHRcdHRoaXMuJGRvd25sb2FkQnRuID0gdGhpcy4kZGF0YVRhYi5maW5kKCBcIi5kb3dubG9hZC1kYXRhLWJ0blwiICk7XG5cdFx0XHR0aGlzLiRkYXRhVGFibGVXcmFwcGVyID0gdGhpcy4kZGF0YVRhYi5maW5kKCBcIi5kYXRhLXRhYmxlLXdyYXBwZXJcIiApO1xuXG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oIGRhdGEsIGxvY2FsRGF0YSwgZGltZW5zaW9ucyApIHtcblx0XHRcdFxuXHRcdFx0dGhpcy4kZGF0YVRhYmxlV3JhcHBlci5lbXB0eSgpO1xuXG5cdFx0XHQvL3VwZGF0ZSBsaW5rXG5cdFx0XHR2YXIgdGhhdCA9IHRoaXMsXG5cdFx0XHRcdGNoYXJ0VHlwZSA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10eXBlXCIgKSxcblx0XHRcdFx0aGFzTXVsdGlwbGVDb2x1bW5zID0gKCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiZ3JvdXAtYnktdmFyaWFibGVzXCIgKSAmJiBjaGFydFR5cGUgIT09IFwiM1wiICk/IHRydWU6IGZhbHNlOy8qLFxuXHRcdFx0XHRiYXNlVXJsID0gdGhpcy4kZG93bmxvYWRCdG4uYXR0ciggXCJkYXRhLWJhc2UtdXJsXCIgKSxcblx0XHRcdFx0ZGltZW5zaW9uc1VybCA9IGVuY29kZVVSSUNvbXBvbmVudCggZGltZW5zaW9uc1N0cmluZyApOyovXG5cdFx0XHQvL3RoaXMuJGRvd25sb2FkQnRuLmF0dHIoIFwiaHJlZlwiLCBiYXNlVXJsICsgXCI/ZGltZW5zaW9ucz1cIiArIGRpbWVuc2lvbnNVcmwgKyBcIiZjaGFydFR5cGU9XCIgKyBjaGFydFR5cGUgKyBcIiZleHBvcnQ9Y3N2XCIgKTtcblx0XHRcdHRoaXMuJGRvd25sb2FkQnRuLm9uKCBcImNsaWNrXCIsIGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cblx0XHRcdFx0dmFyIGRhdGEgPSBbXSxcblx0XHRcdFx0XHQkdHJzID0gdGhhdC4kZWwuZmluZCggXCJ0clwiICk7XG5cdFx0XHRcdCQuZWFjaCggJHRycywgZnVuY3Rpb24oIGksIHYgKSB7XG5cblx0XHRcdFx0XHR2YXIgdHJEYXRhID0gW10sXG5cdFx0XHRcdFx0XHQkdHIgPSAkKCB0aGlzICksXG5cdFx0XHRcdFx0XHQkY2VsbHMgPSAkdHIuZmluZCggXCJ0aCwgdGRcIiApO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdCQuZWFjaCggJGNlbGxzLCBmdW5jdGlvbiggaTIsIHYyICkge1xuXHRcdFx0XHRcdFx0dHJEYXRhLnB1c2goICQoIHYyICkudGV4dCgpICk7XG5cdFx0XHRcdFx0fSApO1xuXG5cdFx0XHRcdFx0ZGF0YS5wdXNoKCB0ckRhdGEgKTtcblxuXHRcdFx0XHR9ICk7XG5cblx0XHRcdFx0dmFyIGNzdlN0cmluZyA9IFwiZGF0YTp0ZXh0L2NzdjtjaGFyc2V0PXV0Zi04LFwiO1xuXHRcdFx0XHRfLmVhY2goIGRhdGEsIGZ1bmN0aW9uKCB2LCBpICkge1xuXHRcdFx0XHRcdHZhciBkYXRhU3RyaW5nID0gdi5qb2luKFwiLFwiKTtcblx0XHRcdFx0XHRjc3ZTdHJpbmcgKz0gKCBpIDwgZGF0YS5sZW5ndGggKT8gZGF0YVN0cmluZysgXCJcXG5cIiA6IGRhdGFTdHJpbmc7XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0XG5cdFx0XHRcdHZhciBlbmNvZGVkVXJpID0gZW5jb2RlVVJJKCBjc3ZTdHJpbmcgKTtcblx0XHRcdFx0d2luZG93Lm9wZW4oIGVuY29kZWRVcmkgKTtcblxuXHRcdFx0fSApO1xuXG5cdFx0XHQvL2dldCBhbGwgdGltZXNcblx0XHRcdHZhciB0aW1lc09iaiA9IFtdLFxuXHRcdFx0XHR0aW1lcyA9IFtdO1xuXHRcdFx0Xy5lYWNoKCBkYXRhLCBmdW5jdGlvbiggZW50aXR5RGF0YSwgZW50aXR5SWQgKSB7XG5cblx0XHRcdFx0dmFyIHZhbHVlcyA9IGVudGl0eURhdGEudmFsdWVzLFxuXHRcdFx0XHRcdHZhbHVlc0J5VGltZSA9IFtdO1xuXG5cdFx0XHRcdF8uZWFjaCggdmFsdWVzLCBmdW5jdGlvbiggdmFsdWUgKSB7XG5cblx0XHRcdFx0XHQvL3N0b3JlIGdpdmVuIHRpbWUgYXMgZXhpc3Rpbmdcblx0XHRcdFx0XHR2YXIgdGltZSA9IHZhbHVlLnRpbWU7XG5cdFx0XHRcdFx0aWYoICF0aW1lc09ialsgdGltZSBdICkge1xuXHRcdFx0XHRcdFx0dGltZXNPYmpbIHRpbWUgXSA9IHRydWU7XG5cdFx0XHRcdFx0XHR0aW1lcy5wdXNoKCB0aW1lICk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly9yZS1tYXAgdmFsdWVzIGJ5IHRpbWUga2V5XG5cdFx0XHRcdFx0dmFsdWVzQnlUaW1lWyB0aW1lIF0gPSB2YWx1ZTtcblxuXHRcdFx0XHR9ICk7XG5cblx0XHRcdFx0ZW50aXR5RGF0YS52YWx1ZXNCeVRpbWUgPSB2YWx1ZXNCeVRpbWU7XG5cblx0XHRcdH0gKTtcblxuXHRcdFx0Ly9zb3J0IGdhdGhlcmVkIHRpbWVzXG5cdFx0XHR0aW1lcyA9IF8uc29ydEJ5KCB0aW1lcywgZnVuY3Rpb24oIHYgKSB7IHJldHVybiArdjsgfSApO1xuXHRcdFx0XG5cdFx0XHQvL2NyZWF0ZSBmaXJzdCByb3dcblx0XHRcdHZhciB0YWJsZVN0cmluZyA9IFwiPHRhYmxlIGNsYXNzPSdkYXRhLXRhYmxlJz5cIixcblx0XHRcdFx0dHIgPSBcIjx0cj48dGQ+PHN0cm9uZz4gPC9zdHJvbmc+PC90ZD5cIjtcblx0XHRcdF8uZWFjaCggdGltZXMsIGZ1bmN0aW9uKCB0aW1lICkge1xuXG5cdFx0XHRcdC8vY3JlYXRlIGNvbHVtbiBmb3IgZXZlcnkgZGltZW5zaW9uXG5cdFx0XHRcdF8uZWFjaCggZGltZW5zaW9ucywgZnVuY3Rpb24oIGRpbWVuc2lvbiwgaSApIHtcblx0XHRcdFx0XHRpZiggaSA9PT0gMCB8fCBoYXNNdWx0aXBsZUNvbHVtbnMgKSB7XG5cdFx0XHRcdFx0XHR2YXIgdGggPSBcIjx0aD5cIjtcblx0XHRcdFx0XHRcdHRoICs9IHRpbWU7XG5cdFx0XHRcdFx0XHRpZiggZGltZW5zaW9ucy5sZW5ndGggPiAxICYmIGhhc011bHRpcGxlQ29sdW1ucyApIHtcblx0XHRcdFx0XHRcdFx0Ly93ZSBoYXZlIG1vcmUgdGhhbiBvbmUgZGltZW5zaW9uLCBuZWVkIHRvIGRpc3Rpbmd1aXNoIHRoZW0gaW4gXG5cdFx0XHRcdFx0XHRcdHRoICs9IFwiIC0gXCIgKyBkaW1lbnNpb24udmFyaWFibGVOYW1lO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0dGggKz0gXCI8L3RoPlwiO1xuXHRcdFx0XHRcdFx0dHIgKz0gdGg7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblxuXHRcdFx0fSApO1xuXHRcdFx0dHIgKz0gXCI8L3RyPlwiO1xuXHRcdFx0dGFibGVTdHJpbmcgKz0gdHI7XG5cblx0XHRcdF8uZWFjaCggZGF0YSwgZnVuY3Rpb24oIGVudGl0eURhdGEsIGVudGl0eUlkICkge1xuXG5cdFx0XHRcdHZhciB0ciA9IFwiPHRyPlwiLFxuXHRcdFx0XHRcdC8vYWRkIG5hbWUgb2YgZW50aXR5XG5cdFx0XHRcdFx0dGQgPSBcIjx0ZD48c3Ryb25nPlwiICsgZW50aXR5RGF0YS5rZXkgKyBcIjwvc3Ryb25nPjwvdGQ+XCI7XG5cdFx0XHRcdHRyICs9IHRkO1xuXG5cdFx0XHRcdHZhciB2YWx1ZXNCeVRpbWUgPSBlbnRpdHlEYXRhLnZhbHVlc0J5VGltZTtcblx0XHRcdFx0Xy5lYWNoKCB0aW1lcywgZnVuY3Rpb24oIHRpbWUgKSB7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0Ly9jcmVhdGUgY29sdW1uIGZvciBldmVyeSBkaW1lbnNpb25cblx0XHRcdFx0XHRfLmVhY2goIGRpbWVuc2lvbnMsIGZ1bmN0aW9uKCBkaW1lbnNpb24sIGkgKSB7XG5cdFx0XHRcdFx0XHRpZiggaSA9PT0gMCB8fCBoYXNNdWx0aXBsZUNvbHVtbnMgKSB7XG5cdFx0XHRcdFx0XHRcdHZhciB0ZCA9IFwiPHRkPlwiLFxuXHRcdFx0XHRcdFx0XHRcdHRkVmFsdWUgPSBcIlwiO1xuXHRcdFx0XHRcdFx0XHQvL2lzIHRoZXJlIHZhbHVlIGZvciBnaXZlbiB0aW1lXG5cdFx0XHRcdFx0XHRcdGlmKCB2YWx1ZXNCeVRpbWVbIHRpbWUgXSApIHtcblx0XHRcdFx0XHRcdFx0XHRpZiggIXZhbHVlc0J5VGltZVsgdGltZSBdLmZha2UgKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHR0ZFZhbHVlID0gdmFsdWVzQnlUaW1lWyB0aW1lIF1bIGRpbWVuc2lvbi5wcm9wZXJ0eSBdO1xuXHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0XHQvL2p1c3QgZHVtbXkgdmFsdWVzIGZvciBjb3JyZWN0IHJlbmRlcmluZyBvZiBjaGFydCwgZG9uJ3QgYWRkIGludG8gdGFibGVcblx0XHRcdFx0XHRcdFx0XHRcdHRkVmFsdWUgPSBcIlwiO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR0ZCArPSB0ZFZhbHVlO1xuXHRcdFx0XHRcdFx0XHR0ZCArPSBcIjwvdGQ+XCI7XG5cdFx0XHRcdFx0XHRcdHRyICs9IHRkO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0XG5cdFx0XHRcdHRyICs9IFwiPC90cj5cIjtcblx0XHRcdFx0dGFibGVTdHJpbmcgKz0gdHI7XG5cblx0XHRcdH0gKTtcblxuXHRcdFx0dGFibGVTdHJpbmcgKz0gXCI8L3RhYmxlPlwiO1xuXG5cdFx0XHR2YXIgJHRhYmxlID0gJCggdGFibGVTdHJpbmcgKTtcblx0XHRcdHRoaXMuJGRhdGFUYWJsZVdyYXBwZXIuYXBwZW5kKCAkdGFibGUgKTtcblxuXG5cdFx0fVxuXG5cdH0gKTtcblx0XG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkNoYXJ0LkRhdGFUYWI7XG5cbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFxuXHRcInVzZSBzdHJpY3RcIjtcblx0XG5cdHZhciBBcHAgPSByZXF1aXJlKCBcIi4vLi4vLi4vbmFtZXNwYWNlcy5qc1wiICk7XG5cblx0QXBwLlZpZXdzLkNoYXJ0LkhlYWRlciA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblxuXHRcdGVsOiBcIiNjaGFydC12aWV3IC5jaGFydC1oZWFkZXJcIixcblx0XHRldmVudHM6IHt9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHRcblx0XHRcdHRoaXMuZGlzcGF0Y2hlciA9IG9wdGlvbnMuZGlzcGF0Y2hlcjtcblx0XHRcdFxuXHRcdFx0dGhpcy4kdGFicyA9IHRoaXMuJGVsLmZpbmQoIFwiLmhlYWRlci10YWJcIiApO1xuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblxuXHRcdFx0Ly9zZXR1cCBldmVudHNcblx0XHRcdEFwcC5DaGFydE1vZGVsLm9uKCBcImNoYW5nZVwiLCB0aGlzLnJlbmRlciwgdGhpcyApO1xuXG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcblx0XHRcdHZhciB0YWJzID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcInRhYnNcIiApO1xuXHRcdFx0XG5cdFx0XHQvL2hpZGUgZmlyc3QgZXZlcnl0aGluZ1xuXHRcdFx0dGhpcy4kdGFicy5oaWRlKCk7XG5cblx0XHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRcdF8uZWFjaCggdGFicywgZnVuY3Rpb24oIHYsIGkgKSB7XG5cdFx0XHRcdHZhciB0YWIgPSB0aGF0LiR0YWJzLmZpbHRlciggXCIuXCIgKyB2ICsgXCItaGVhZGVyLXRhYlwiICk7XG5cdFx0XHRcdHRhYi5zaG93KCk7XG5cdFx0XHRcdGlmKCBpID09PSAwICkge1xuXHRcdFx0XHRcdHRhYi5hZGRDbGFzcyggXCJhY3RpdmVcIiApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cblx0XHR9XG5cblx0fSk7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVmlld3MuQ2hhcnQuSGVhZGVyO1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cdFxuXHR2YXIgQXBwID0gcmVxdWlyZSggXCIuLy4uLy4uL25hbWVzcGFjZXMuanNcIiApO1xuXG5cdEFwcC5WaWV3cy5DaGFydC5MZWdlbmQgPSBmdW5jdGlvbiggY2hhcnRMZWdlbmQgKSB7XG5cdFxuXHRcdC8vYmFzZWQgb24gaHR0cHM6Ly9naXRodWIuY29tL25vdnVzL252ZDMvYmxvYi9tYXN0ZXIvc3JjL21vZGVscy9sZWdlbmQuanNcblxuXHRcdC8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cdFx0Ly8gUHVibGljIFZhcmlhYmxlcyB3aXRoIERlZmF1bHQgU2V0dGluZ3Ncblx0XHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5cdFx0dmFyIGNoYXJ0VHlwZSA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10eXBlXCIgKVxuXHRcdFx0LCBtYXJnaW4gPSB7dG9wOiA1LCByaWdodDogNTAsIGJvdHRvbTogNSwgbGVmdDogNjJ9XG5cdFx0XHQsIHdpZHRoID0gODAwXG5cdFx0XHQsIGhlaWdodCA9IDIwXG5cdFx0XHQsIGdldEtleSA9IGZ1bmN0aW9uKGQpIHsgcmV0dXJuIGQua2V5IH1cblx0XHRcdCwgY29sb3IgPSBudi51dGlscy5nZXRDb2xvcigpXG5cdFx0XHQsIGFsaWduID0gdHJ1ZVxuXHRcdFx0LCBwYWRkaW5nID0gNDAgLy9kZWZpbmUgaG93IG11Y2ggc3BhY2UgYmV0d2VlbiBsZWdlbmQgaXRlbXMuIC0gcmVjb21tZW5kIDMyIGZvciBmdXJpb3VzIHZlcnNpb25cblx0XHRcdCwgcmlnaHRBbGlnbiA9IGZhbHNlXG5cdFx0XHQsIHVwZGF0ZVN0YXRlID0gdHJ1ZSAgIC8vSWYgdHJ1ZSwgbGVnZW5kIHdpbGwgdXBkYXRlIGRhdGEuZGlzYWJsZWQgYW5kIHRyaWdnZXIgYSAnc3RhdGVDaGFuZ2UnIGRpc3BhdGNoLlxuXHRcdFx0LCByYWRpb0J1dHRvbk1vZGUgPSBmYWxzZSAgIC8vSWYgdHJ1ZSwgY2xpY2tpbmcgbGVnZW5kIGl0ZW1zIHdpbGwgY2F1c2UgaXQgdG8gYmVoYXZlIGxpa2UgYSByYWRpbyBidXR0b24uIChvbmx5IG9uZSBjYW4gYmUgc2VsZWN0ZWQgYXQgYSB0aW1lKVxuXHRcdFx0LCBleHBhbmRlZCA9IGZhbHNlXG5cdFx0XHQsIGRpc3BhdGNoID0gZDMuZGlzcGF0Y2goJ2xlZ2VuZENsaWNrJywgJ2xlZ2VuZERibGNsaWNrJywgJ2xlZ2VuZE1vdXNlb3ZlcicsICdsZWdlbmRNb3VzZW91dCcsICdzdGF0ZUNoYW5nZScsICdyZW1vdmVFbnRpdHknLCAnYWRkRW50aXR5Jylcblx0XHRcdCwgdmVycyA9ICdjbGFzc2ljJyAvL09wdGlvbnMgYXJlIFwiY2xhc3NpY1wiIGFuZCBcImZ1cmlvdXNcIiBhbmQgXCJvd2RcIlxuXHRcdFx0O1xuXG5cdFx0ZnVuY3Rpb24gY2hhcnQoc2VsZWN0aW9uKSB7XG5cdFx0XHRcblx0XHRcdHNlbGVjdGlvbi5lYWNoKGZ1bmN0aW9uKGRhdGEpIHtcblx0XHRcdFx0XG5cdFx0XHRcdHZhciAkc3ZnID0gJCggXCJzdmcubnZkMy1zdmdcIiApLFxuXHRcdFx0XHRcdGF2YWlsYWJsZVdpZHRoID0gJHN2Zy53aWR0aCgpIC0gbWFyZ2luLmxlZnQgLSBtYXJnaW4ucmlnaHQsXG5cdFx0XHRcdFx0Y29udGFpbmVyID0gZDMuc2VsZWN0KHRoaXMpO1xuXHRcdFx0XHRcblx0XHRcdFx0bnYudXRpbHMuaW5pdFNWRyhjb250YWluZXIpO1xuXG5cdFx0XHRcdHZhciBiaW5kYWJsZURhdGEgPSBkYXRhO1xuXG5cdFx0XHRcdC8vZGlzY3JldGUgYmFyIGNoYXJ0IG5lZWRzIHVucGFjayBkYXRhXG5cdFx0XHRcdGlmKCBjaGFydFR5cGUgPT09IFwiNlwiICkge1xuXHRcdFx0XHRcdGlmKCBkYXRhICYmIGRhdGEubGVuZ3RoICYmIGRhdGFbMF0udmFsdWVzICkge1xuXHRcdFx0XHRcdFx0dmFyIGRpc2NyZXRlRGF0YSA9IF8ubWFwKCBkYXRhWzBdLnZhbHVlcywgZnVuY3Rpb24oIHYsIGkgKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiB7IGlkOiB2LmlkLCBrZXk6IHYueCwgY29sb3I6IHYuY29sb3IsIHZhbHVlczogdiB9O1xuXHRcdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdFx0YmluZGFibGVEYXRhID0gZGlzY3JldGVEYXRhO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0Ly8gU2V0dXAgY29udGFpbmVycyBhbmQgc2tlbGV0b24gb2YgY2hhcnRcblx0XHRcdFx0dmFyIHdyYXAgPSBjb250YWluZXIuc2VsZWN0QWxsKCdnLm52LWN1c3RvbS1sZWdlbmQnKS5kYXRhKFtiaW5kYWJsZURhdGFdKSxcblx0XHRcdFx0Ly92YXIgd3JhcCA9IGNvbnRhaW5lci5zZWxlY3RBbGwoJ2cubnYtY3VzdG9tLWxlZ2VuZCcpLmRhdGEoW2RhdGFdKSxcblx0XHRcdFx0XHRnRW50ZXIgPSB3cmFwLmVudGVyKCkuYXBwZW5kKCdnJykuYXR0cignY2xhc3MnLCAnbnZkMyBudi1jdXN0b20tbGVnZW5kJykuYXBwZW5kKCdnJykuYXR0ciggJ2NsYXNzJywgJ252LWxlZ2VuZC1zZXJpZXMtd3JhcHBlcicgKSxcblx0XHRcdFx0XHRnID0gd3JhcC5zZWxlY3QoJ2cnKTtcblxuXHRcdFx0XHR3cmFwLmF0dHIoJ3RyYW5zZm9ybScsICd0cmFuc2xhdGUoJyArIG1hcmdpbi5sZWZ0ICsgJywnICsgbWFyZ2luLnRvcCArICcpJyk7XG5cblx0XHRcdFx0dmFyIHNlcmllcyA9IGcuc2VsZWN0QWxsKCcubnYtc2VyaWVzJylcblx0XHRcdFx0XHQuZGF0YShmdW5jdGlvbihkKSB7XG5cdFx0XHRcdFx0XHRpZih2ZXJzICE9ICdmdXJpb3VzJykgcmV0dXJuIGQ7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZC5maWx0ZXIoZnVuY3Rpb24obikge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZXhwYW5kZWQgPyB0cnVlIDogIW4uZGlzZW5nYWdlZDtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdC8vc3BlY2lhbCBzdHlsaW5nIGZvciBzdGFja2VkIGFyZWEgY2hhcnQgbGVnZW5kXG5cdFx0XHRcdGlmKCBjaGFydFR5cGUgPT09IFwiM1wiICkge1xuXHRcdFx0XHRcdGNvbnRhaW5lci5zZWxlY3RBbGwoJ2cubnYtY3VzdG9tLWxlZ2VuZCcpLmNsYXNzZWQoIFwidHJhbnNwYXJlbnRcIiwgdHJ1ZSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdFxuXHRcdFx0XHQvL2FkZCBlbnRpdHkgbGFiZWxcblx0XHRcdFx0dmFyIGVudGl0eUxhYmVsID0gd3JhcC5zZWxlY3QoICcubnYtZW50aXR5LWxhYmVsJyApLFxuXHRcdFx0XHRcdGVudGl0eUxhYmVsVGV4dCA9IGVudGl0eUxhYmVsLnNlbGVjdCggJ3RleHQnICksXG5cdFx0XHRcdFx0ZW50aXR5TGFiZWxXaWR0aCA9IDA7XG5cdFx0XHRcdC8vZGlzcGxheWluZyBvZiBlbnRpdHkgbGFiZWwgaXMgZGlzYWJsZWRcblx0XHRcdFx0LyppZiggQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImFkZC1jb3VudHJ5LW1vZGVcIiApID09PSBcImNoYW5nZS1jb3VudHJ5XCIgKSB7XG5cdFx0XHRcdFx0aWYoIGVudGl0eUxhYmVsLmVtcHR5KCkgKSB7XG5cdFx0XHRcdFx0XHRlbnRpdHlMYWJlbCA9IHdyYXAuYXBwZW5kKCAnZycgKS5hdHRyKCdjbGFzcycsICdudi1lbnRpdHktbGFiZWwnKS5hdHRyKCAndHJhbnNmb3JtJywgJ3RyYW5zbGF0ZSgwLDE1KScgKTtcblx0XHRcdFx0XHRcdGVudGl0eUxhYmVsVGV4dCA9IGVudGl0eUxhYmVsLmFwcGVuZCggJ3RleHQnICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmKCBkYXRhICYmIGRhdGFbMF0gJiYgZGF0YVswXS5lbnRpdHkgKSB7XG5cdFx0XHRcdFx0XHRlbnRpdHlMYWJlbFRleHQudGV4dCggZGF0YVswXS5lbnRpdHkgKyBcIjogXCIgKTtcblx0XHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRcdGVudGl0eUxhYmVsV2lkdGggPSBlbnRpdHlMYWJlbFRleHQubm9kZSgpLmdldENvbXB1dGVkVGV4dExlbmd0aCgpO1xuXHRcdFx0XHRcdFx0XHQvLyBJZiB0aGUgbGVnZW5kVGV4dCBpcyBkaXNwbGF5Om5vbmUnZCAobm9kZVRleHRMZW5ndGggPT0gMCksIHNpbXVsYXRlIGFuIGVycm9yIHNvIHdlIGFwcHJveGltYXRlLCBpbnN0ZWFkXG5cdFx0XHRcdFx0XHRcdGlmKCBlbnRpdHlMYWJlbFdpZHRoIDw9IDAgKSB0aHJvdyBuZXcgRXJyb3IoKTtcblx0XHRcdFx0XHRcdH0gY2F0Y2goIGUgKSB7XG5cdFx0XHRcdFx0XHRcdGVudGl0eUxhYmVsV2lkdGggPSBudi51dGlscy5jYWxjQXBwcm94VGV4dFdpZHRoKGVudGl0eUxhYmVsVGV4dCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHQvL2FkZCBwYWRkaW5nIGZvciBsYWJlbFxuXHRcdFx0XHRcdFx0ZW50aXR5TGFiZWxXaWR0aCArPSAzMDtcblx0XHRcdFx0XHRcdGF2YWlsYWJsZVdpZHRoIC09IGVudGl0eUxhYmVsV2lkdGg7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vbWFrZSBzdXJlIHRoZXJlIGlzIG5vdCBsYWJlbCBsZWZ0XG5cdFx0XHRcdFx0ZW50aXR5TGFiZWwucmVtb3ZlKCk7XG5cdFx0XHRcdH0qL1xuXHRcdFx0XHRcblx0XHRcdFx0Ly9pZiBub3QgZXhpc3RpbmcsIGFkZCBudi1hZGQtYnRuLCBpZiBub3QgZ3JvdXBpbmcgYnkgdmFyaWFibGVzXG5cdFx0XHRcdHZhciBhZGRFbnRpdHlCdG4gPSAgd3JhcC5zZWxlY3QoICdnLm52LWFkZC1idG4nICk7XG5cdFx0XHRcdGlmKCBhZGRFbnRpdHlCdG4uZW1wdHkoKSApIHtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4gPSB3cmFwLmFwcGVuZCgnZycpLmF0dHIoJ2NsYXNzJywgJ252LWFkZC1idG4nKTtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4uYXBwZW5kKCdyZWN0JykuYXR0ciggeyAnY2xhc3MnOiAnYWRkLWJ0bi1iZycsICd3aWR0aCc6ICcxMDAnLCAnaGVpZ2h0JzogJzI1JywgJ3RyYW5zZm9ybSc6ICd0cmFuc2xhdGUoMCwtNSknIH0gKTtcblx0XHRcdFx0XHR2YXIgYWRkRW50aXR5QnRuRyA9IGFkZEVudGl0eUJ0bi5hcHBlbmQoJ2cnKS5hdHRyKCB7ICdjbGFzcyc6ICdhZGQtYnRuLXBhdGgnIH0gKTtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG5HLmFwcGVuZCgncGF0aCcpLmF0dHIoIHsgJ2QnOiAnTTE1LDAgTDE1LDE0JywgJ2NsYXNzJzogJ252LWJveCcgfSApO1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bkcuYXBwZW5kKCdwYXRoJykuYXR0ciggeyAnZCc6ICdNOCw3IEwyMiw3JywgJ2NsYXNzJzogJ252LWJveCcgfSApO1xuXHRcdFx0XHRcdC8vaHR0cDovL2FuZHJvaWQtdWktdXRpbHMuZ29vZ2xlY29kZS5jb20vaGctaGlzdG9yeS9hYzk1NWU2Mzc2NDcwZDk1OTllYWQwN2I0NTk5ZWY5Mzc4MjRmOTE5L2Fzc2V0LXN0dWRpby9kaXN0L3Jlcy9jbGlwYXJ0L2ljb25zL3JlZnJlc2guc3ZnP3I9YWM5NTVlNjM3NjQ3MGQ5NTk5ZWFkMDdiNDU5OWVmOTM3ODI0ZjkxOVxuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5hcHBlbmQoJ3BhdGgnKS5hdHRyKCB7ICdkJzogJ00xNjAuNDY5LDI0Mi4xOTRjMC00NC40MTQsMzYuMDIzLTgwLjQzOCw4MC40MzgtODAuNDM4YzE5LjE4OCwwLDM2LjcxMSw2Ljg0NCw1MC41LDE4LjA3OEwyNTkuNzgsMjA5LjkzbDk5Ljk0NSwxMS4zNjcgICAgbDAuODA1LTEwNy4yNDJsLTMwLjc2NiwyOS4yODljLTIzLjU0Ni0yMS4yMDMtNTQuNjI0LTM0LjE2NC04OC44MDQtMzQuMTY0Yy03My40NjksMC0xMzMuMDIzLDU5LjU2Mi0xMzMuMDIzLDEzMy4wMTYgICAgYzAsMi43NDIsMC4yNDItMi4yNjYsMC40MTQsMC40NDVsNTMuNjgsNy41NTVDMTYxLjAzLDI0NS4xMDgsMTYwLjQ2OSwyNDcuNTYyLDE2MC40NjksMjQyLjE5NHogTTM3MS42NDcsMjM3LjM3NWwtNTMuNjgxLTcuNTU1ICAgIGMxLjAxNyw1LjA4NiwxLjU1NiwyLjYxNywxLjU1Niw3Ljk5MmMwLDQ0LjQxNC0zNi4wMDgsODAuNDMxLTgwLjQzLDgwLjQzMWMtMTkuMTMzLDAtMzYuNjAyLTYuNzk4LTUwLjM4My0xNy45N2wzMS41OTUtMzAuMDc4ICAgIGwtOTkuOTMtMTEuMzY2bC0wLjgxMiwxMDcuMjVsMzAuNzg5LTI5LjMxMmMyMy41MzEsMjEuMTQxLDU0LjU3LDM0LjA1NSw4OC42ODgsMzQuMDU1YzczLjQ2OCwwLDEzMy4wMjMtNTkuNTU1LDEzMy4wMjMtMTMzLjAwOCAgICBDMzcyLjA2MiwyMzUuMDc4LDM3MS44MTIsMjQwLjA4NSwzNzEuNjQ3LDIzNy4zNzV6JywgJ2NsYXNzJzogJ252LWJveCBjaGFuZ2UtYnRuLXBhdGgnLCAndHJhbnNmb3JtJzogJ3NjYWxlKC4wNCkgdHJhbnNsYXRlKDE1MCwtNTApJyB9ICk7XG5cdFx0XHRcdFx0YWRkRW50aXR5QnRuLmFwcGVuZCgndGV4dCcpLmF0dHIoIHsneCc6MjgsJ3knOjExfSApLnRleHQoJ0FkZCBjb3VudHJ5Jyk7XG5cdFx0XHRcdFx0YWRkRW50aXR5QnRuLm9uKCAnY2xpY2snLCBmdW5jdGlvbiggZCwgaSApIHtcblx0XHRcdFx0XHRcdC8vZ3JvdXAgYnkgdmFyaWFibGVzXG5cdFx0XHRcdFx0XHRkaXNwYXRjaC5hZGRFbnRpdHkoKTtcblx0XHRcdFx0XHRcdGQzLmV2ZW50LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0fVxuXHRcdFx0XHQvL2Jhc2VkIG9uIHNlbGVjdGVkIGNvdW50cmllcyBzZWxlY3Rpb24gaGlkZSBvciBzaG93IGFkZEVudGl0eUJ0blxuXHRcdFx0XHRpZiggXy5pc0VtcHR5KCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwic2VsZWN0ZWQtY291bnRyaWVzXCIgKSApICkge1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5hdHRyKCBcImRpc3BsYXlcIiwgXCJub25lXCIgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4uYXR0ciggXCJkaXNwbGF5XCIsIFwiYmxvY2tcIiApO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dmFyIGFkZENvdW50cnlNb2RlID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImFkZC1jb3VudHJ5LW1vZGVcIiApO1xuXHRcdFx0XHRpZiggYWRkQ291bnRyeU1vZGUgPT09IFwiYWRkLWNvdW50cnlcIiApIHtcblx0XHRcdFx0Ly9pZiggQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImdyb3VwLWJ5LXZhcmlhYmxlc1wiICkgKSB7XG5cdFx0XHRcdFx0Ly9pZiBncm91cGluZyBieSB2YXJpYWJsZSwgbGVnZW5kIHdpbGwgc2hvdyB2YXJpYWJsZXMgaW5zdGVhZCBvZiBjb3VudHJpZXMsIHNvIGFkZCBjb3VudHJ5IGJ0biBkb2Vzbid0IG1ha2Ugc2Vuc2Vcblx0XHRcdFx0XHQvL2lmIGVuYWJsaW5nIGFkZGluZyBjb3VudHJpZXNcblx0XHRcdFx0XHQvL2FkZEVudGl0eUJ0bi5hdHRyKCBcImRpc3BsYXlcIiwgXCJub25lXCIgKTtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4uc2VsZWN0KCBcInRleHRcIiApLnRleHQoIFwiQWRkIGNvdW50cnlcIiApO1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5zZWxlY3QoIFwicmVjdFwiICkuYXR0ciggXCJ3aWR0aFwiLCBcIjEwMFwiICk7XG5cdFx0XHRcdFx0YWRkRW50aXR5QnRuLnNlbGVjdCggXCIuYWRkLWJ0bi1wYXRoXCIgKS5hdHRyKCBcImRpc3BsYXlcIiwgXCJibG9ja1wiICk7XG5cdFx0XHRcdFx0YWRkRW50aXR5QnRuLnNlbGVjdCggXCIuY2hhbmdlLWJ0bi1wYXRoXCIgKS5hdHRyKCBcImRpc3BsYXlcIiwgXCJub25lXCIgKTtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4uYXR0ciggXCJkaXNwbGF5XCIsIFwiYmxvY2tcIiApO1xuXHRcdFx0XHR9IGVsc2UgaWYoIGFkZENvdW50cnlNb2RlID09PSBcImNoYW5nZS1jb3VudHJ5XCIgKSB7XG5cdFx0XHRcdFx0YWRkRW50aXR5QnRuLnNlbGVjdCggXCIuYWRkLWJ0bi1wYXRoXCIgKS5hdHRyKCBcImRpc3BsYXlcIiwgXCJub25lXCIgKTtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4uc2VsZWN0KCBcIi5jaGFuZ2UtYnRuLXBhdGhcIiApLmF0dHIoIFwiZGlzcGxheVwiLCBcImJsb2NrXCIgKTtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4uc2VsZWN0KCBcInRleHRcIiApLnRleHQoIFwiQ2hhbmdlIGNvdW50cnlcIiApO1xuXHRcdFx0XHRcdGFkZEVudGl0eUJ0bi5zZWxlY3QoIFwicmVjdFwiICkuYXR0ciggXCJ3aWR0aFwiLCBcIjEyMFwiICk7XG5cdFx0XHRcdFx0YWRkRW50aXR5QnRuLmF0dHIoIFwiZGlzcGxheVwiLCBcImJsb2NrXCIgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRhZGRFbnRpdHlCdG4uYXR0ciggXCJkaXNwbGF5XCIsIFwibm9uZVwiICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0XHRcblx0XHRcdFx0dmFyIHNlcmllc0VudGVyID0gc2VyaWVzLmVudGVyKCkuYXBwZW5kKCdnJykuYXR0cignY2xhc3MnLCBmdW5jdGlvbihkKSB7IHJldHVybiAnbnYtc2VyaWVzIG52LXNlcmllcy0nICsgZC5pZDsgfSApLFxuXHRcdFx0XHRcdHNlcmllc1NoYXBlLCBzZXJpZXNSZW1vdmU7XG5cblx0XHRcdFx0dmFyIHZlcnNQYWRkaW5nID0gMzA7XG5cdFx0XHRcdHNlcmllc0VudGVyLmFwcGVuZCgncmVjdCcpXG5cdFx0XHRcdFx0LnN0eWxlKCdzdHJva2Utd2lkdGgnLCAyKVxuXHRcdFx0XHRcdC5hdHRyKCdjbGFzcycsJ252LWxlZ2VuZC1zeW1ib2wnKTtcblxuXHRcdFx0XHQvL2VuYWJsZSByZW1vdmluZyBjb3VudHJpZXMgb25seSBpZiBBZGQvUmVwbGFjZSBjb3VudHJ5IGJ1dHRvbiBwcmVzZW50XG5cdFx0XHRcdGlmKCBhZGRDb3VudHJ5TW9kZSA9PSBcImFkZC1jb3VudHJ5XCIgJiYgIUFwcC5DaGFydE1vZGVsLmdldCggXCJncm91cC1ieS12YXJpYWJsZXNcIiApICkge1xuXHRcdFx0XHRcdHZhciByZW1vdmVCdG5zID0gc2VyaWVzRW50ZXIuYXBwZW5kKCdnJylcblx0XHRcdFx0XHRcdC5hdHRyKCdjbGFzcycsICdudi1yZW1vdmUtYnRuJylcblx0XHRcdFx0XHRcdC5hdHRyKCd0cmFuc2Zvcm0nLCAndHJhbnNsYXRlKDEwLDEwKScpO1xuXHRcdFx0XHRcdHJlbW92ZUJ0bnMuYXBwZW5kKCdwYXRoJykuYXR0ciggeyAnZCc6ICdNMCwwIEw3LDcnLCAnY2xhc3MnOiAnbnYtYm94JyB9ICk7XG5cdFx0XHRcdFx0cmVtb3ZlQnRucy5hcHBlbmQoJ3BhdGgnKS5hdHRyKCB7ICdkJzogJ003LDAgTDAsNycsICdjbGFzcyc6ICdudi1ib3gnIH0gKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0c2VyaWVzU2hhcGUgPSBzZXJpZXMuc2VsZWN0KCcubnYtbGVnZW5kLXN5bWJvbCcpO1xuXHRcdFx0XHRcblx0XHRcdFx0c2VyaWVzRW50ZXIuYXBwZW5kKCd0ZXh0Jylcblx0XHRcdFx0XHQuYXR0cigndGV4dC1hbmNob3InLCAnc3RhcnQnKVxuXHRcdFx0XHRcdC5hdHRyKCdjbGFzcycsJ252LWxlZ2VuZC10ZXh0Jylcblx0XHRcdFx0XHQuYXR0cignZHknLCAnLjMyZW0nKVxuXHRcdFx0XHRcdC5hdHRyKCdkeCcsICcwJyk7XG5cblx0XHRcdFx0dmFyIHNlcmllc1RleHQgPSBzZXJpZXMuc2VsZWN0KCd0ZXh0Lm52LWxlZ2VuZC10ZXh0JyksXG5cdFx0XHRcdFx0c2VyaWVzUmVtb3ZlID0gc2VyaWVzLnNlbGVjdCgnLm52LXJlbW92ZS1idG4nKTtcblxuXHRcdFx0XHRzZXJpZXNcblx0XHRcdFx0XHQub24oJ21vdXNlb3ZlcicsIGZ1bmN0aW9uKGQsaSkge1xuXHRcdFx0XHRcdFx0Y2hhcnRMZWdlbmQuZGlzcGF0Y2gubGVnZW5kTW91c2VvdmVyKGQsaSk7ICAvL1RPRE86IE1ha2UgY29uc2lzdGVudCB3aXRoIG90aGVyIGV2ZW50IG9iamVjdHNcblx0XHRcdFx0XHR9KVxuXHRcdFx0XHRcdC5vbignbW91c2VvdXQnLCBmdW5jdGlvbihkLGkpIHtcblx0XHRcdFx0XHRcdGNoYXJ0TGVnZW5kLmRpc3BhdGNoLmxlZ2VuZE1vdXNlb3V0KGQsaSk7XG5cdFx0XHRcdFx0fSlcblx0XHRcdFx0XHQub24oJ2NsaWNrJywgZnVuY3Rpb24oZCxpKSB7XG5cblx0XHRcdFx0XHRcdGlmKCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiZ3JvdXAtYnktdmFyaWFibGVzXCIgKSB8fCBhZGRDb3VudHJ5TW9kZSAhPT0gXCJhZGQtY291bnRyeVwiICkge1xuXHRcdFx0XHRcdFx0XHQvL2lmIGRpc3BsYXlpbmcgdmFyaWFibGVzLCBpbnN0ZWFkIG9mIHJlbW92aW5nLCB1c2Ugb3JpZ2luYWwgdmVyc2lvbiBqdXN0IHRvIHR1cm4gc3R1ZmYgb2ZmXG5cdFx0XHRcdFx0XHRcdC8vb3JpZ2luYWwgdmVyc2lvbiwgd2hlbiBjbGlja2luZyBjb3VudHJ5IGxhYmVsIGp1c3QgZGVhY3RpdmF0ZXMgaXRcblx0XHRcdFx0XHRcdFx0Y2hhcnRMZWdlbmQuZGlzcGF0Y2gubGVnZW5kQ2xpY2soZCxpKTtcblx0XHRcdFx0XHRcdFx0Ly8gbWFrZSBzdXJlIHdlIHJlLWdldCBkYXRhIGluIGNhc2UgaXQgd2FzIG1vZGlmaWVkXG5cdFx0XHRcdFx0XHRcdHZhciBkYXRhID0gc2VyaWVzLmRhdGEoKTtcblx0XHRcdFx0XHRcdFx0aWYgKHVwZGF0ZVN0YXRlKSB7XG5cdFx0XHRcdFx0XHRcdFx0aWYoZXhwYW5kZWQpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGQuZGlzZW5nYWdlZCA9ICFkLmRpc2VuZ2FnZWQ7XG5cdFx0XHRcdFx0XHRcdFx0XHRkLnVzZXJEaXNhYmxlZCA9IGQudXNlckRpc2FibGVkID09IHVuZGVmaW5lZCA/ICEhZC5kaXNhYmxlZCA6IGQudXNlckRpc2FibGVkO1xuXHRcdFx0XHRcdFx0XHRcdFx0ZC5kaXNhYmxlZCA9IGQuZGlzZW5nYWdlZCB8fCBkLnVzZXJEaXNhYmxlZDtcblx0XHRcdFx0XHRcdFx0XHR9IGVsc2UgaWYgKCFleHBhbmRlZCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0ZC5kaXNhYmxlZCA9ICFkLmRpc2FibGVkO1xuXHRcdFx0XHRcdFx0XHRcdFx0ZC51c2VyRGlzYWJsZWQgPSBkLmRpc2FibGVkO1xuXHRcdFx0XHRcdFx0XHRcdFx0dmFyIGVuZ2FnZWQgPSBkYXRhLmZpbHRlcihmdW5jdGlvbihkKSB7IHJldHVybiAhZC5kaXNlbmdhZ2VkOyB9KTtcblx0XHRcdFx0XHRcdFx0XHRcdGlmIChlbmdhZ2VkLmV2ZXJ5KGZ1bmN0aW9uKHNlcmllcykgeyByZXR1cm4gc2VyaWVzLnVzZXJEaXNhYmxlZCB9KSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHQvL3RoZSBkZWZhdWx0IGJlaGF2aW9yIG9mIE5WRDMgbGVnZW5kcyBpcywgaWYgZXZlcnkgc2luZ2xlIHNlcmllc1xuXHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBpcyBkaXNhYmxlZCwgdHVybiBhbGwgc2VyaWVzJyBiYWNrIG9uLlxuXHRcdFx0XHRcdFx0XHRcdFx0XHRkYXRhLmZvckVhY2goZnVuY3Rpb24oc2VyaWVzKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0c2VyaWVzLmRpc2FibGVkID0gc2VyaWVzLnVzZXJEaXNhYmxlZCA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0Y2hhcnRMZWdlbmQuZGlzcGF0Y2guc3RhdGVDaGFuZ2Uoe1xuXHRcdFx0XHRcdFx0XHRcdFx0ZGlzYWJsZWQ6IGRhdGEubWFwKGZ1bmN0aW9uKGQpIHsgcmV0dXJuICEhZC5kaXNhYmxlZDsgfSksXG5cdFx0XHRcdFx0XHRcdFx0XHRkaXNlbmdhZ2VkOiBkYXRhLm1hcChmdW5jdGlvbihkKSB7IHJldHVybiAhIWQuZGlzZW5nYWdlZDsgfSlcblx0XHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXG5cdFx0XHRcdFx0XHRcdC8vd2hlbiBjbGlja2luZyBjb3VudHJ5IGxhYmVsLCByZW1vdmUgdGhlIGNvdW50cnlcblx0XHRcdFx0XHRcdFx0ZDMuZXZlbnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG5cdFx0XHRcdFx0XHRcdC8vcmVtb3ZlIHNlcmllcyBzdHJhaWdodCBhd2F5LCBzbyB3ZSBkb24ndCBoYXZlIHRvIHdhaXQgZm9yIHJlc3BvbnNlIGZyb20gc2VydmVyXG5cdFx0XHRcdFx0XHRcdHNlcmllc1swXVtpXS5yZW1vdmUoKTtcblx0XHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHRcdHZhciBpZCA9IGQuaWQ7XG5cdFx0XHRcdFx0XHRcdC8vaW4gY2FzZSBvZiBtdWx0aXZhcmllbnQgY2hhcnRcblx0XHRcdFx0XHRcdFx0aWYoIGlkLmluZGV4T2YoIFwiLVwiICkgPiAwICkge1xuXHRcdFx0XHRcdFx0XHRcdGlkID0gcGFyc2VJbnQoIGlkLnNwbGl0KCBcIi1cIiApWyAwIF0sIDEwICk7XG5cdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0aWQgPSBwYXJzZUludCggaWQsIDEwICk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0ZGlzcGF0Y2gucmVtb3ZlRW50aXR5KCBpZCApO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0Lm9uKCdkYmxjbGljaycsIGZ1bmN0aW9uKGQsaSkge1xuXHRcdFx0XHRcdFx0aWYoKHZlcnMgPT0gJ2Z1cmlvdXMnIHx8IHZlcnMgPT0gJ293ZCcpICYmIGV4cGFuZGVkKSByZXR1cm47XG5cdFx0XHRcdFx0XHRjaGFydExlZ2VuZC5kaXNwYXRjaC5sZWdlbmREYmxjbGljayhkLGkpO1xuXHRcdFx0XHRcdFx0aWYgKHVwZGF0ZVN0YXRlKSB7XG5cdFx0XHRcdFx0XHRcdC8vIG1ha2Ugc3VyZSB3ZSByZS1nZXQgZGF0YSBpbiBjYXNlIGl0IHdhcyBtb2RpZmllZFxuXHRcdFx0XHRcdFx0XHR2YXIgZGF0YSA9IHNlcmllcy5kYXRhKCk7XG5cdFx0XHRcdFx0XHRcdC8vdGhlIGRlZmF1bHQgYmVoYXZpb3Igb2YgTlZEMyBsZWdlbmRzLCB3aGVuIGRvdWJsZSBjbGlja2luZyBvbmUsXG5cdFx0XHRcdFx0XHRcdC8vIGlzIHRvIHNldCBhbGwgb3RoZXIgc2VyaWVzJyB0byBmYWxzZSwgYW5kIG1ha2UgdGhlIGRvdWJsZSBjbGlja2VkIHNlcmllcyBlbmFibGVkLlxuXHRcdFx0XHRcdFx0XHRkYXRhLmZvckVhY2goZnVuY3Rpb24oc2VyaWVzKSB7XG5cdFx0XHRcdFx0XHRcdFx0c2VyaWVzLmRpc2FibGVkID0gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0XHRpZih2ZXJzID09ICdmdXJpb3VzJyB8fCB2ZXJzID09ICdvd2QnKSBzZXJpZXMudXNlckRpc2FibGVkID0gc2VyaWVzLmRpc2FibGVkO1xuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdFx0ZC5kaXNhYmxlZCA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0XHRpZih2ZXJzID09ICdmdXJpb3VzJyB8fCB2ZXJzID09ICdvd2QnICkgZC51c2VyRGlzYWJsZWQgPSBkLmRpc2FibGVkO1xuXHRcdFx0XHRcdFx0XHRjaGFydExlZ2VuZC5kaXNwYXRjaC5zdGF0ZUNoYW5nZSh7XG5cdFx0XHRcdFx0XHRcdFx0ZGlzYWJsZWQ6IGRhdGEubWFwKGZ1bmN0aW9uKGQpIHsgcmV0dXJuICEhZC5kaXNhYmxlZDsgfSlcblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0c2VyaWVzUmVtb3ZlLm9uKCAnY2xpY2snLCBmdW5jdGlvbiggZCwgaSApIHtcblxuXHRcdFx0XHRcdGQzLmV2ZW50LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHRcdC8vcmVtb3ZlIHNlcmllcyBzdHJhaWdodCBhd2F5LCBzbyB3ZSBkb24ndCBoYXZlIHRvIHdhaXQgZm9yIHJlc3BvbnNlIGZyb20gc2VydmVyXG5cdFx0XHRcdFx0c2VyaWVzWzBdW2ldLnJlbW92ZSgpO1xuXHRcdFx0XHRcdGRpc3BhdGNoLnJlbW92ZUVudGl0eSggZC5pZCApO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHR9ICk7XHRcblxuXHRcdFx0XHRzZXJpZXMuY2xhc3NlZCgnbnYtZGlzYWJsZWQnLCBmdW5jdGlvbihkKSB7IHJldHVybiBkLnVzZXJEaXNhYmxlZDsgfSk7XG5cdFx0XHRcdHNlcmllcy5leGl0KCkucmVtb3ZlKCk7XG5cblx0XHRcdFx0c2VyaWVzVGV4dFxuXHRcdFx0XHRcdC5hdHRyKCdmaWxsJywgc2V0VGV4dENvbG9yKVxuXHRcdFx0XHRcdC50ZXh0KGdldEtleSk7XG5cblx0XHRcdFx0Ly9UT0RPOiBpbXBsZW1lbnQgZml4ZWQtd2lkdGggYW5kIG1heC13aWR0aCBvcHRpb25zIChtYXgtd2lkdGggaXMgZXNwZWNpYWxseSB1c2VmdWwgd2l0aCB0aGUgYWxpZ24gb3B0aW9uKVxuXHRcdFx0XHQvLyBORVcgQUxJR05JTkcgQ09ERSwgVE9ETzogY2xlYW4gdXBcblx0XHRcdFx0dmFyIGxlZ2VuZFdpZHRoID0gMCxcblx0XHRcdFx0XHR0cmFuc2Zvcm1YLCB0cmFuc2Zvcm1ZO1xuXHRcdFx0XHRpZiAoYWxpZ24pIHtcblxuXHRcdFx0XHRcdHZhciBzZXJpZXNXaWR0aHMgPSBbXTtcblx0XHRcdFx0XHRzZXJpZXMuZWFjaCggZnVuY3Rpb24oZCxpKSB7XG5cdFx0XHRcdFx0XHR2YXIgbGVnZW5kVGV4dCA9IGQzLnNlbGVjdCh0aGlzKS5zZWxlY3QoJ3RleHQnKTtcblx0XHRcdFx0XHRcdHZhciBub2RlVGV4dExlbmd0aDtcblx0XHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRcdG5vZGVUZXh0TGVuZ3RoID0gbGVnZW5kVGV4dC5ub2RlKCkuZ2V0Q29tcHV0ZWRUZXh0TGVuZ3RoKCk7XG5cdFx0XHRcdFx0XHRcdC8vIElmIHRoZSBsZWdlbmRUZXh0IGlzIGRpc3BsYXk6bm9uZSdkIChub2RlVGV4dExlbmd0aCA9PSAwKSwgc2ltdWxhdGUgYW4gZXJyb3Igc28gd2UgYXBwcm94aW1hdGUsIGluc3RlYWRcblx0XHRcdFx0XHRcdFx0aWYobm9kZVRleHRMZW5ndGggPD0gMCkgdGhyb3cgRXJyb3IoKTtcblx0XHRcdFx0XHRcdH0gY2F0Y2goIGUgKSB7XG5cdFx0XHRcdFx0XHRcdG5vZGVUZXh0TGVuZ3RoID0gbnYudXRpbHMuY2FsY0FwcHJveFRleHRXaWR0aChsZWdlbmRUZXh0KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHNlcmllc1dpZHRocy5wdXNoKG5vZGVUZXh0TGVuZ3RoICsgcGFkZGluZyk7XG5cdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHR2YXIgc2VyaWVzUGVyUm93ID0gMDtcblx0XHRcdFx0XHR2YXIgY29sdW1uV2lkdGhzID0gW107XG5cdFx0XHRcdFx0bGVnZW5kV2lkdGggPSAwO1xuXG5cdFx0XHRcdFx0d2hpbGUoIGxlZ2VuZFdpZHRoIDwgYXZhaWxhYmxlV2lkdGggJiYgc2VyaWVzUGVyUm93IDwgc2VyaWVzV2lkdGhzLmxlbmd0aCApIHtcblx0XHRcdFx0XHRcdGNvbHVtbldpZHRoc1tzZXJpZXNQZXJSb3ddID0gc2VyaWVzV2lkdGhzW3Nlcmllc1BlclJvd107XG5cdFx0XHRcdFx0XHRsZWdlbmRXaWR0aCArPSBzZXJpZXNXaWR0aHNbc2VyaWVzUGVyUm93KytdO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiggc2VyaWVzUGVyUm93ID09PSAwICkgc2VyaWVzUGVyUm93ID0gMTsgLy9taW5pbXVtIG9mIG9uZSBzZXJpZXMgcGVyIHJvd1xuXG5cdFx0XHRcdFx0d2hpbGUoIGxlZ2VuZFdpZHRoID4gYXZhaWxhYmxlV2lkdGggJiYgc2VyaWVzUGVyUm93ID4gMSApIHtcblx0XHRcdFx0XHRcdGNvbHVtbldpZHRocyA9IFtdO1xuXHRcdFx0XHRcdFx0c2VyaWVzUGVyUm93LS07XG5cblx0XHRcdFx0XHRcdGZvciAodmFyIGsgPSAwOyBrIDwgc2VyaWVzV2lkdGhzLmxlbmd0aDsgaysrKSB7XG5cdFx0XHRcdFx0XHRcdGlmIChzZXJpZXNXaWR0aHNba10gPiAoY29sdW1uV2lkdGhzW2sgJSBzZXJpZXNQZXJSb3ddIHx8IDApIClcblx0XHRcdFx0XHRcdFx0XHRjb2x1bW5XaWR0aHNbayAlIHNlcmllc1BlclJvd10gPSBzZXJpZXNXaWR0aHNba107XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdGxlZ2VuZFdpZHRoID0gY29sdW1uV2lkdGhzLnJlZHVjZShmdW5jdGlvbihwcmV2LCBjdXIsIGluZGV4LCBhcnJheSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gcHJldiArIGN1cjtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHZhciB4UG9zaXRpb25zID0gW107XG5cdFx0XHRcdFx0Zm9yICh2YXIgaSA9IDAsIGN1clggPSAwOyBpIDwgc2VyaWVzUGVyUm93OyBpKyspIHtcblx0XHRcdFx0XHRcdHhQb3NpdGlvbnNbaV0gPSBjdXJYO1xuXHRcdFx0XHRcdFx0Y3VyWCArPSBjb2x1bW5XaWR0aHNbaV07XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0c2VyaWVzXG5cdFx0XHRcdFx0XHQuYXR0cigndHJhbnNmb3JtJywgZnVuY3Rpb24oZCwgaSkge1xuXHRcdFx0XHRcdFx0XHR0cmFuc2Zvcm1YID0geFBvc2l0aW9uc1tpICUgc2VyaWVzUGVyUm93XTtcblx0XHRcdFx0XHRcdFx0dHJhbnNmb3JtWSA9ICg1ICsgTWF0aC5mbG9vcihpIC8gc2VyaWVzUGVyUm93KSAqIHZlcnNQYWRkaW5nKTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuICd0cmFuc2xhdGUoJyArIHRyYW5zZm9ybVggKyAnLCcgKyB0cmFuc2Zvcm1ZICsgJyknO1xuXHRcdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHQvL3Bvc2l0aW9uIGxlZ2VuZCBhcyBmYXIgcmlnaHQgYXMgcG9zc2libGUgd2l0aGluIHRoZSB0b3RhbCB3aWR0aFxuXHRcdFx0XHRcdGlmIChyaWdodEFsaWduKSB7XG5cdFx0XHRcdFx0XHRnLmF0dHIoJ3RyYW5zZm9ybScsICd0cmFuc2xhdGUoJyArICh3aWR0aCAtIG1hcmdpbi5yaWdodCAtIGxlZ2VuZFdpZHRoKSArICcsJyArIG1hcmdpbi50b3AgKyAnKScpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRcdGcuYXR0cigndHJhbnNmb3JtJywgJ3RyYW5zbGF0ZSgnICsgZW50aXR5TGFiZWxXaWR0aCArICcsJyArIG1hcmdpbi50b3AgKyAnKScpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGhlaWdodCA9IG1hcmdpbi50b3AgKyBtYXJnaW4uYm90dG9tICsgKE1hdGguY2VpbChzZXJpZXNXaWR0aHMubGVuZ3RoIC8gc2VyaWVzUGVyUm93KSAqIHZlcnNQYWRkaW5nKTtcblx0XHRcdFx0XHRcblx0XHRcdFx0fSBlbHNlIHtcblxuXHRcdFx0XHRcdHZhciB5cG9zID0gNSxcblx0XHRcdFx0XHRcdG5ld3hwb3MgPSA1LFxuXHRcdFx0XHRcdFx0bWF4d2lkdGggPSAwLFxuXHRcdFx0XHRcdFx0eHBvcztcblx0XHRcdFx0XHRzZXJpZXNcblx0XHRcdFx0XHRcdC5hdHRyKCd0cmFuc2Zvcm0nLCBmdW5jdGlvbihkLCBpKSB7XG5cdFx0XHRcdFx0XHRcdHZhciBsZW5ndGggPSBkMy5zZWxlY3QodGhpcykuc2VsZWN0KCd0ZXh0Jykubm9kZSgpLmdldENvbXB1dGVkVGV4dExlbmd0aCgpICsgcGFkZGluZztcblx0XHRcdFx0XHRcdFx0eHBvcyA9IG5ld3hwb3M7XG5cblx0XHRcdFx0XHRcdFx0aWYgKHdpZHRoIDwgbWFyZ2luLmxlZnQgKyBtYXJnaW4ucmlnaHQgKyB4cG9zICsgbGVuZ3RoKSB7XG5cdFx0XHRcdFx0XHRcdFx0bmV3eHBvcyA9IHhwb3MgPSA1O1xuXHRcdFx0XHRcdFx0XHRcdHlwb3MgKz0gdmVyc1BhZGRpbmc7XG5cdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRuZXd4cG9zICs9IGxlbmd0aDtcblx0XHRcdFx0XHRcdFx0aWYgKG5ld3hwb3MgPiBtYXh3aWR0aCkgbWF4d2lkdGggPSBuZXd4cG9zO1xuXG5cdFx0XHRcdFx0XHRcdGlmKGxlZ2VuZFdpZHRoIDwgeHBvcyArIG1heHdpZHRoKSB7XG5cdFx0XHRcdFx0XHRcdFx0bGVnZW5kV2lkdGggPSB4cG9zICsgbWF4d2lkdGg7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0cmV0dXJuICd0cmFuc2xhdGUoJyArIHhwb3MgKyAnLCcgKyB5cG9zICsgJyknO1xuXHRcdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHQvL3Bvc2l0aW9uIGxlZ2VuZCBhcyBmYXIgcmlnaHQgYXMgcG9zc2libGUgd2l0aGluIHRoZSB0b3RhbCB3aWR0aFxuXHRcdFx0XHRcdGcuYXR0cigndHJhbnNmb3JtJywgJ3RyYW5zbGF0ZSgnICsgKHdpZHRoIC0gbWFyZ2luLnJpZ2h0IC0gbWF4d2lkdGgpICsgJywnICsgbWFyZ2luLnRvcCArICcpJyk7XG5cblx0XHRcdFx0XHRoZWlnaHQgPSBtYXJnaW4udG9wICsgbWFyZ2luLmJvdHRvbSArIHlwb3MgKyAxNTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFNpemUgcmVjdGFuZ2xlcyBhZnRlciB0ZXh0IGlzIHBsYWNlZFxuXHRcdFx0XHRzZXJpZXNTaGFwZVxuXHRcdFx0XHRcdC5hdHRyKCd3aWR0aCcsIGZ1bmN0aW9uKGQsaSkge1xuXHRcdFx0XHRcdFx0Ly9wb3NpdGlvbiByZW1vdmUgYnRuXG5cdFx0XHRcdFx0XHR2YXIgd2lkdGggPSBzZXJpZXNUZXh0WzBdW2ldLmdldENvbXB1dGVkVGV4dExlbmd0aCgpICsgNTtcblx0XHRcdFx0XHRcdGQzLnNlbGVjdCggc2VyaWVzUmVtb3ZlWzBdW2ldICkuYXR0ciggJ3RyYW5zZm9ybScsICd0cmFuc2xhdGUoJyArIHdpZHRoICsgJywtMyknICk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gd2lkdGgrMjU7XG5cdFx0XHRcdFx0fSlcblx0XHRcdFx0XHQuYXR0cignaGVpZ2h0JywgMjQpXG5cdFx0XHRcdFx0LmF0dHIoJ3knLCAtMTIpXG5cdFx0XHRcdFx0LmF0dHIoJ3gnLCAtMTIpO1xuXG5cdFx0XHRcdC8vIFRoZSBiYWNrZ3JvdW5kIGZvciB0aGUgZXhwYW5kZWQgbGVnZW5kIChVSSlcblx0XHRcdFx0Z0VudGVyLmluc2VydCgncmVjdCcsJzpmaXJzdC1jaGlsZCcpXG5cdFx0XHRcdFx0LmF0dHIoJ2NsYXNzJywgJ252LWxlZ2VuZC1iZycpXG5cdFx0XHRcdFx0LmF0dHIoJ2ZpbGwnLCAnI2VlZScpXG5cdFx0XHRcdFx0Ly8gLmF0dHIoJ3N0cm9rZScsICcjNDQ0Jylcblx0XHRcdFx0XHQuYXR0cignb3BhY2l0eScsMCk7XG5cblx0XHRcdFx0dmFyIHNlcmllc0JHID0gZy5zZWxlY3QoJy5udi1sZWdlbmQtYmcnKTtcblxuXHRcdFx0XHRzZXJpZXNCR1xuXHRcdFx0XHQudHJhbnNpdGlvbigpLmR1cmF0aW9uKDMwMClcblx0XHRcdFx0XHQuYXR0cigneCcsIC12ZXJzUGFkZGluZyApXG5cdFx0XHRcdFx0LmF0dHIoJ3dpZHRoJywgbGVnZW5kV2lkdGggKyB2ZXJzUGFkZGluZyAtIDEyKVxuXHRcdFx0XHRcdC5hdHRyKCdoZWlnaHQnLCBoZWlnaHQgKVxuXHRcdFx0XHRcdC5hdHRyKCd5JywgLW1hcmdpbi50b3AgLSAxMClcblx0XHRcdFx0XHQuYXR0cignb3BhY2l0eScsIGV4cGFuZGVkID8gMSA6IDApO1xuXG5cdFx0XHRcdHNlcmllc1NoYXBlXG5cdFx0XHRcdFx0LnN0eWxlKCdmaWxsJywgc2V0QkdDb2xvcilcblx0XHRcdFx0XHQuc3R5bGUoJ2ZpbGwtb3BhY2l0eScsIHNldEJHT3BhY2l0eSlcblx0XHRcdFx0XHQuc3R5bGUoJ3N0cm9rZScsIHNldEJHQ29sb3IpO1xuXG5cdFx0XHRcdC8vcG9zaXRpb24gYWRkIGJ0blxuXHRcdFx0XHRpZiggc2VyaWVzLnNpemUoKSApIHtcblxuXHRcdFx0XHRcdHZhciBzZXJpZXNBcnIgPSBzZXJpZXNbMF07XG5cdFx0XHRcdFx0aWYoIHNlcmllc0FyciAmJiBzZXJpZXNBcnIubGVuZ3RoICkge1xuXHRcdFx0XHRcdFx0Ly9mZXRjaCBsYXN0IGVsZW1lbnQgdG8ga25vdyBpdHMgd2lkdGhcblx0XHRcdFx0XHRcdHZhciBsYXN0RWwgPSBzZXJpZXNBcnJbIHNlcmllc0Fyci5sZW5ndGgtMSBdLFxuXHRcdFx0XHRcdFx0XHQvL25lZWQgcmVjdCBpbnNpZGUgZWxlbWVudCB0aGF0IGhhcyBzZXQgd2lkdGhcblx0XHRcdFx0XHRcdFx0bGFzdFJlY3QgPSBkMy5zZWxlY3QoIGxhc3RFbCApLnNlbGVjdCggXCJyZWN0XCIgKSxcblx0XHRcdFx0XHRcdFx0bGFzdFJlY3RXaWR0aCA9IGxhc3RSZWN0LmF0dHIoIFwid2lkdGhcIiApO1xuXHRcdFx0XHRcdFx0Ly9wb3NpdGlvbiBhZGQgYnRuXG5cdFx0XHRcdFx0XHR0cmFuc2Zvcm1YID0gK3RyYW5zZm9ybVggKyBwYXJzZUludCggbGFzdFJlY3RXaWR0aCwgMTAgKSAtIDM7XG5cdFx0XHRcdFx0XHR0cmFuc2Zvcm1YICs9IGVudGl0eUxhYmVsV2lkdGg7XG5cdFx0XHRcdFx0XHQvL2NlbnRlcmluZ1xuXHRcdFx0XHRcdFx0dHJhbnNmb3JtWSA9ICt0cmFuc2Zvcm1ZIC0gMztcblx0XHRcdFx0XHRcdC8vY2hlY2sgZm9yIHJpZ2h0IGVkZ2Vcblx0XHRcdFx0XHRcdHZhciBidXR0b25XaWR0aCA9IDEyMCwgYnV0dG9uSGVpZ2h0ID0gMzU7XG5cdFx0XHRcdFx0XHRpZiggKCB0cmFuc2Zvcm1YICsgYnV0dG9uV2lkdGggKSA+IGF2YWlsYWJsZVdpZHRoICkge1xuXHRcdFx0XHRcdFx0XHQvL21ha2Ugc3VyZSB3ZSBoYXZlIGJ1dHRvblxuXHRcdFx0XHRcdFx0XHR2YXIgYWRkRW50aXR5RGlzcGxheSA9IGFkZEVudGl0eUJ0bi5hdHRyKCBcImRpc3BsYXlcIiApO1xuXHRcdFx0XHRcdFx0XHRpZiggYWRkRW50aXR5RGlzcGxheSAhPT0gXCJub25lXCIgKSB7XG5cdFx0XHRcdFx0XHRcdFx0dHJhbnNmb3JtWCA9IDA7Ly9hdmFpbGFibGVXaWR0aCAtIGJ1dHRvbldpZHRoO1xuXHRcdFx0XHRcdFx0XHRcdHRyYW5zZm9ybVkgKz0gYnV0dG9uSGVpZ2h0O1xuXHRcdFx0XHRcdFx0XHRcdC8vdXBkYXRlIHdob2xlIGNoYXJ0IGhlaWdodCBhcyB3ZWxsXG5cdFx0XHRcdFx0XHRcdFx0aGVpZ2h0ICs9IGJ1dHRvbkhlaWdodDtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0YWRkRW50aXR5QnRuLmF0dHIoIFwidHJhbnNmb3JtXCIsIFwidHJhbnNsYXRlKCBcIiArIHRyYW5zZm9ybVggKyBcIiwgXCIgKyB0cmFuc2Zvcm1ZICsgXCIpXCIgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcblx0XHRcdFx0fVxuXHRcdFx0XG5cdFx0XHR9KTtcblx0XHRcdFxuXHRcdFx0ZnVuY3Rpb24gc2V0VGV4dENvbG9yKGQsaSkge1xuXHRcdFx0XHRpZih2ZXJzICE9ICdmdXJpb3VzJyAmJiB2ZXJzICE9ICdvd2QnKSByZXR1cm4gJyMwMDAnO1xuXHRcdFx0XHRpZihleHBhbmRlZCkge1xuXHRcdFx0XHRcdHJldHVybiBkLmRpc2VuZ2FnZWQgPyAnIzAwMCcgOiAnI2ZmZic7XG5cdFx0XHRcdH0gZWxzZSBpZiAoIWV4cGFuZGVkKSB7XG5cdFx0XHRcdFx0aWYoIWQuY29sb3IpIGQuY29sb3IgPSBjb2xvcihkLGkpO1xuXHRcdFx0XHRcdHJldHVybiAhIWQuZGlzYWJsZWQgPyAnIzY2NicgOiAnI2ZmZic7XG5cdFx0XHRcdFx0Ly9yZXR1cm4gISFkLmRpc2FibGVkID8gZC5jb2xvciA6ICcjZmZmJztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRmdW5jdGlvbiBzZXRCR0NvbG9yKGQsaSkge1xuXHRcdFx0XHRpZihleHBhbmRlZCAmJiAodmVycyA9PSAnZnVyaW91cycgfHwgdmVycyA9PSAnb3dkJykpIHtcblx0XHRcdFx0XHRyZXR1cm4gZC5kaXNlbmdhZ2VkID8gJyNlZWUnIDogZC5jb2xvciB8fCBjb2xvcihkLGkpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybiBkLmNvbG9yIHx8IGNvbG9yKGQsaSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXG5cdFx0XHRmdW5jdGlvbiBzZXRCR09wYWNpdHkoZCxpKSB7XG5cdFx0XHRcdGlmKGV4cGFuZGVkICYmICh2ZXJzID09ICdmdXJpb3VzJyB8fCB2ZXJzID09ICdvd2QnKSkge1xuXHRcdFx0XHRcdHJldHVybiAxO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybiAhIWQuZGlzYWJsZWQgPyAwIDogMTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gY2hhcnQ7XG5cdFx0fVxuXG5cdFx0Ly89PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblx0XHQvLyBFeHBvc2UgUHVibGljIFZhcmlhYmxlc1xuXHRcdC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cblx0XHRjaGFydC5kaXNwYXRjaCA9IGRpc3BhdGNoO1xuXHRcdGNoYXJ0Lm9wdGlvbnMgPSBudi51dGlscy5vcHRpb25zRnVuYy5iaW5kKGNoYXJ0KTtcblxuXHRcdGNoYXJ0Ll9vcHRpb25zID0gT2JqZWN0LmNyZWF0ZSh7fSwge1xuXHRcdFx0Ly8gc2ltcGxlIG9wdGlvbnMsIGp1c3QgZ2V0L3NldCB0aGUgbmVjZXNzYXJ5IHZhbHVlc1xuXHRcdFx0d2lkdGg6ICAgICAge2dldDogZnVuY3Rpb24oKXtyZXR1cm4gd2lkdGg7fSwgc2V0OiBmdW5jdGlvbihfKXt3aWR0aD1fO319LFxuXHRcdFx0aGVpZ2h0OiAgICAge2dldDogZnVuY3Rpb24oKXtyZXR1cm4gaGVpZ2h0O30sIHNldDogZnVuY3Rpb24oXyl7aGVpZ2h0PV87fX0sXG5cdFx0XHRrZXk6ICAgICAgICB7Z2V0OiBmdW5jdGlvbigpe3JldHVybiBnZXRLZXk7fSwgc2V0OiBmdW5jdGlvbihfKXtnZXRLZXk9Xzt9fSxcblx0XHRcdGFsaWduOiAgICAgIHtnZXQ6IGZ1bmN0aW9uKCl7cmV0dXJuIGFsaWduO30sIHNldDogZnVuY3Rpb24oXyl7YWxpZ249Xzt9fSxcblx0XHRcdHJpZ2h0QWxpZ246ICAgIHtnZXQ6IGZ1bmN0aW9uKCl7cmV0dXJuIHJpZ2h0QWxpZ247fSwgc2V0OiBmdW5jdGlvbihfKXtyaWdodEFsaWduPV87fX0sXG5cdFx0XHRwYWRkaW5nOiAgICAgICB7Z2V0OiBmdW5jdGlvbigpe3JldHVybiBwYWRkaW5nO30sIHNldDogZnVuY3Rpb24oXyl7cGFkZGluZz1fO319LFxuXHRcdFx0dXBkYXRlU3RhdGU6ICAge2dldDogZnVuY3Rpb24oKXtyZXR1cm4gdXBkYXRlU3RhdGU7fSwgc2V0OiBmdW5jdGlvbihfKXt1cGRhdGVTdGF0ZT1fO319LFxuXHRcdFx0cmFkaW9CdXR0b25Nb2RlOiAgICB7Z2V0OiBmdW5jdGlvbigpe3JldHVybiByYWRpb0J1dHRvbk1vZGU7fSwgc2V0OiBmdW5jdGlvbihfKXtyYWRpb0J1dHRvbk1vZGU9Xzt9fSxcblx0XHRcdGV4cGFuZGVkOiAgIHtnZXQ6IGZ1bmN0aW9uKCl7cmV0dXJuIGV4cGFuZGVkO30sIHNldDogZnVuY3Rpb24oXyl7ZXhwYW5kZWQ9Xzt9fSxcblx0XHRcdHZlcnM6ICAge2dldDogZnVuY3Rpb24oKXtyZXR1cm4gdmVyczt9LCBzZXQ6IGZ1bmN0aW9uKF8pe3ZlcnM9Xzt9fSxcblxuXHRcdFx0Ly8gb3B0aW9ucyB0aGF0IHJlcXVpcmUgZXh0cmEgbG9naWMgaW4gdGhlIHNldHRlclxuXHRcdFx0bWFyZ2luOiB7Z2V0OiBmdW5jdGlvbigpe3JldHVybiBtYXJnaW47fSwgc2V0OiBmdW5jdGlvbihfKXtcblx0XHRcdFx0bWFyZ2luLnRvcCAgICA9IF8udG9wICAgICE9PSB1bmRlZmluZWQgPyBfLnRvcCAgICA6IG1hcmdpbi50b3A7XG5cdFx0XHRcdG1hcmdpbi5yaWdodCAgPSBfLnJpZ2h0ICAhPT0gdW5kZWZpbmVkID8gXy5yaWdodCAgOiBtYXJnaW4ucmlnaHQ7XG5cdFx0XHRcdG1hcmdpbi5ib3R0b20gPSBfLmJvdHRvbSAhPT0gdW5kZWZpbmVkID8gXy5ib3R0b20gOiBtYXJnaW4uYm90dG9tO1xuXHRcdFx0XHRtYXJnaW4ubGVmdCAgID0gXy5sZWZ0ICAgIT09IHVuZGVmaW5lZCA/IF8ubGVmdCAgIDogbWFyZ2luLmxlZnQ7XG5cdFx0XHR9fSxcblx0XHRcdGNvbG9yOiAge2dldDogZnVuY3Rpb24oKXtyZXR1cm4gY29sb3I7fSwgc2V0OiBmdW5jdGlvbihfKXtcblx0XHRcdFx0Y29sb3IgPSBudi51dGlscy5nZXRDb2xvcihfKTtcblx0XHRcdH19XG5cdFx0fSk7XG5cblx0XHRjaGFydC5oaWdobGlnaHRQb2ludCA9IGZ1bmN0aW9uKGV2dCkge1xuXHRcdFx0Y2hhcnQuY2xlYXJIaWdobGlnaHQoKTtcblx0XHRcdHZhciBpZCA9ICggZXZ0ICYmIGV2dC5wb2ludCApPyBldnQucG9pbnQuaWQ6IFwiXCI7XG5cdFx0XHRpZiggaWQgKSB7XG5cdFx0XHRcdGQzLnNlbGVjdEFsbCggXCIubnYtY3VzdG9tLWxlZ2VuZCAubnYtc2VyaWVzLVwiICsgaWQgKS5jbGFzc2VkKCBcImhpZ2hsaWdodFwiLCB0cnVlICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRjaGFydC5jbGVhckhpZ2hsaWdodCA9IGZ1bmN0aW9uKGV2dCkge1xuXHRcdFx0ZDMuc2VsZWN0QWxsKCBcIi5udi1jdXN0b20tbGVnZW5kIC5udi1zZXJpZXNcIiApLmNsYXNzZWQoIFwiaGlnaGxpZ2h0XCIsIGZhbHNlICk7XG5cdFx0fTtcblxuXHRcdG52LnV0aWxzLmluaXRPcHRpb25zKGNoYXJ0KTtcblxuXHRcdHJldHVybiBjaGFydDtcblx0fTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5DaGFydC5MZWdlbmQ7XG5cbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgQXBwID0gcmVxdWlyZSggXCIuLy4uLy4uL25hbWVzcGFjZXMuanNcIiApLFxuXHRcdE1hcENvbnRyb2xzID0gcmVxdWlyZSggXCIuL21hcC9BcHAuVmlld3MuQ2hhcnQuTWFwLk1hcENvbnRyb2xzLmpzXCIgKSxcblx0XHRMZWdlbmQgPSByZXF1aXJlKCBcIi4vbWFwL0FwcC5WaWV3cy5DaGFydC5NYXAuTGVnZW5kLmpzXCIgKSxcblx0XHRDaGFydERhdGFNb2RlbCA9IHJlcXVpcmUoIFwiLi8uLi8uLi9tb2RlbHMvQXBwLk1vZGVscy5DaGFydERhdGFNb2RlbC5qc1wiICk7XG5cblx0QXBwLlZpZXdzLkNoYXJ0Lk1hcFRhYiA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblxuXHRcdCR0YWI6IG51bGwsXG5cdFx0ZGF0YU1hcDogbnVsbCxcblx0XHRtYXBDb250cm9sczogbnVsbCxcblx0XHRsZWdlbmQ6IG51bGwsXG5cblx0XHRldmVudHM6IHt9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHRcblx0XHRcdHRoaXMuZGlzcGF0Y2hlciA9IG9wdGlvbnMuZGlzcGF0Y2hlcjtcblx0XHRcdHRoaXMubWFwQ29udHJvbHMgPSBuZXcgTWFwQ29udHJvbHMoIHsgZGlzcGF0Y2hlcjogb3B0aW9ucy5kaXNwYXRjaGVyIH0gKTtcblxuXHRcdFx0Ly9pbml0IG1hcCBvbmx5IGlmIHRoZSBtYXAgdGFiIGRpc3BsYXllZFxuXHRcdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdFx0JCggXCJbZGF0YS10b2dnbGU9J3RhYiddW2hyZWY9JyNtYXAtY2hhcnQtdGFiJ11cIiApLm9uKCBcInNob3duLmJzLnRhYlwiLCBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0XHR0aGF0LmRpc3BsYXkoKTtcblx0XHRcdH0gKTtcblx0XHRcdFxuXHRcdH0sXG5cblx0XHRkaXNwbGF5OiBmdW5jdGlvbigpIHtcblx0XHRcdC8vcmVuZGVyIG9ubHkgaWYgbm8gbWFwIHlldFxuXHRcdFx0aWYoICF0aGlzLmRhdGFNYXAgKSB7XG5cdFx0XHRcdHRoaXMucmVuZGVyKCk7XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cblx0XHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRcdC8vZmV0Y2ggY3JlYXRlZCBkb21cblx0XHRcdHRoaXMuJHRhYiA9ICQoIFwiI21hcC1jaGFydC10YWJcIiApO1xuXG5cdFx0XHR2YXIgbWFwQ29uZmlnID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcIm1hcC1jb25maWdcIiApLFxuXHRcdFx0XHRkZWZhdWx0UHJvamVjdGlvbiA9IHRoaXMuZ2V0UHJvamVjdGlvbiggbWFwQ29uZmlnLnByb2plY3Rpb24gKTtcblx0XHRcdFxuXHRcdFx0dGhpcy5kYXRhTWFwID0gbmV3IERhdGFtYXAoIHtcblx0XHRcdFx0d2lkdGg6IHRoYXQuJHRhYi53aWR0aCgpLFxuXHRcdFx0XHRoZWlnaHQ6IHRoYXQuJHRhYi5oZWlnaHQoKSxcblx0XHRcdFx0cmVzcG9uc2l2ZTogdHJ1ZSxcblx0XHRcdFx0ZWxlbWVudDogZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIFwibWFwLWNoYXJ0LXRhYlwiICksXG5cdFx0XHRcdGdlb2dyYXBoeUNvbmZpZzoge1xuXHRcdFx0XHRcdGRhdGFVcmw6IEdsb2JhbC5yb290VXJsICsgXCIvYnVpbGQvanMvZGF0YS93b3JsZC5pZHMuanNvblwiLFxuXHRcdFx0XHRcdGJvcmRlcldpZHRoOiAwLjEsXG5cdFx0XHRcdFx0Ym9yZGVyQ29sb3I6ICcjNEY0RjRGJyxcblx0XHRcdFx0XHRoaWdobGlnaHRCb3JkZXJDb2xvcjogJ2JsYWNrJyxcblx0XHRcdFx0XHRoaWdobGlnaHRCb3JkZXJXaWR0aDogMC4yLFxuXHRcdFx0XHRcdGhpZ2hsaWdodEZpbGxDb2xvcjogJyNGRkVDMzgnLFxuXHRcdFx0XHRcdHBvcHVwVGVtcGxhdGU6IHRoYXQucG9wdXBUZW1wbGF0ZUdlbmVyYXRvclxuXHRcdFx0XHR9LFxuXHRcdFx0XHRmaWxsczoge1xuXHRcdFx0XHRcdGRlZmF1bHRGaWxsOiAnI0ZGRkZGRidcblx0XHRcdFx0XHQvL2RlZmF1bHRGaWxsOiAnI0RERERERCdcblx0XHRcdFx0fSxcblx0XHRcdFx0c2V0UHJvamVjdGlvbjogZGVmYXVsdFByb2plY3Rpb24sXG5cdFx0XHRcdC8vd2FpdCBmb3IganNvbiB0byBsb2FkIGJlZm9yZSBsb2FkaW5nIG1hcCBkYXRhXG5cdFx0XHRcdGRvbmU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdHRoYXQubWFwRGF0YU1vZGVsID0gbmV3IENoYXJ0RGF0YU1vZGVsKCk7XG5cdFx0XHRcdFx0dGhhdC5tYXBEYXRhTW9kZWwub24oIFwic3luY1wiLCBmdW5jdGlvbiggbW9kZWwsIHJlc3BvbnNlICkge1xuXHRcdFx0XHRcdFx0aWYoIHJlc3BvbnNlLmRhdGEgKSB7XG5cdFx0XHRcdFx0XHRcdHRoYXQuZGlzcGxheURhdGEoIHJlc3BvbnNlLmRhdGEgKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0dGhhdC5tYXBEYXRhTW9kZWwub24oIFwiZXJyb3JcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRjb25zb2xlLmVycm9yKCBcIkVycm9yIGxvYWRpbmcgbWFwIGRhdGEuXCIgKTtcblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0dGhhdC51cGRhdGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXG5cdFx0XHR0aGlzLmxlZ2VuZCA9IG5ldyBMZWdlbmQoKTtcblx0XHRcdFxuXHRcdFx0QXBwLkNoYXJ0TW9kZWwub24oIFwiY2hhbmdlXCIsIHRoaXMub25DaGFydE1vZGVsQ2hhbmdlLCB0aGlzICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5vbiggXCJjaGFuZ2UtbWFwXCIsIHRoaXMub25DaGFydE1vZGVsQ2hhbmdlLCB0aGlzICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5vbiggXCJyZXNpemVcIiwgdGhpcy5vbkNoYXJ0TW9kZWxSZXNpemUsIHRoaXMgKTtcblx0XHRcdFxuXHRcdFx0bnYudXRpbHMud2luZG93UmVzaXplKCAkLnByb3h5KCB0aGlzLm9uUmVzaXplLCB0aGlzICkgKTtcblx0XHRcdHRoaXMub25SZXNpemUoKTtcblxuXHRcdH0sXG5cblx0XHRvbkNoYXJ0TW9kZWxDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdHRoaXMudXBkYXRlKCk7XG5cblx0XHR9LFxuXG5cdFx0cG9wdXBUZW1wbGF0ZUdlbmVyYXRvcjogZnVuY3Rpb24oIGdlbywgZGF0YSApIHtcblx0XHRcdC8vdHJhbnNmb3JtIGRhdGFtYXBzIGRhdGEgaW50byBmb3JtYXQgY2xvc2UgdG8gbnZkMyBzbyB0aGF0IHdlIGNhbiByZXVzZSB0aGUgc2FtZSBwb3B1cCBnZW5lcmF0b3Jcblx0XHRcdHZhciBtYXBDb25maWcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwibWFwLWNvbmZpZ1wiICk7XG5cdFx0XHR2YXIgcHJvcGVydHlOYW1lID0gQXBwLlV0aWxzLmdldFByb3BlcnR5QnlWYXJpYWJsZUlkKCBBcHAuQ2hhcnRNb2RlbCwgbWFwQ29uZmlnLnZhcmlhYmxlSWQgKTtcblx0XHRcdGlmKCAhcHJvcGVydHlOYW1lICkge1xuXHRcdFx0XHRwcm9wZXJ0eU5hbWUgPSBcInlcIjtcblx0XHRcdH1cblx0XHRcdHZhciBvYmogPSB7XG5cdFx0XHRcdHBvaW50OiB7XG5cdFx0XHRcdFx0dGltZTogbWFwQ29uZmlnLnRhcmdldFllYXIgfSxcblx0XHRcdFx0c2VyaWVzOiBbIHtcblx0XHRcdFx0XHRrZXk6IGdlby5wcm9wZXJ0aWVzLm5hbWVcblx0XHRcdFx0fSBdXG5cdFx0XHR9O1xuXHRcdFx0b2JqLnBvaW50WyBwcm9wZXJ0eU5hbWUgXSA9IGRhdGEudmFsdWU7XG5cdFx0XHRyZXR1cm4gWyBcIjxkaXYgY2xhc3M9J2hvdmVyaW5mbyBudnRvb2x0aXAnPlwiICsgQXBwLlV0aWxzLmNvbnRlbnRHZW5lcmF0b3IoIG9iaiwgdHJ1ZSApICsgXCI8L2Rpdj5cIiBdO1xuXHRcdH0sXG5cblx0XHR1cGRhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XG5cdFx0XHQvL2NvbnN0cnVjdCBkaW1lbnNpb24gc3RyaW5nXG5cdFx0XHR2YXIgdGhhdCA9IHRoaXMsXG5cdFx0XHRcdG1hcENvbmZpZyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJtYXAtY29uZmlnXCIgKSxcblx0XHRcdFx0Y2hhcnRUaW1lID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LXRpbWVcIiApLFxuXHRcdFx0XHR2YXJpYWJsZUlkID0gbWFwQ29uZmlnLnZhcmlhYmxlSWQsXG5cdFx0XHRcdHRhcmdldFllYXIgPSBtYXBDb25maWcudGFyZ2V0WWVhcixcblx0XHRcdFx0bW9kZSA9IG1hcENvbmZpZy5tb2RlLFxuXHRcdFx0XHR0b2xlcmFuY2UgPSBtYXBDb25maWcudGltZVRvbGVyYW5jZSxcblx0XHRcdFx0ZGltZW5zaW9ucyA9IFt7IG5hbWU6IFwiTWFwXCIsIHByb3BlcnR5OiBcIm1hcFwiLCB2YXJpYWJsZUlkOiB2YXJpYWJsZUlkLCB0YXJnZXRZZWFyOiB0YXJnZXRZZWFyLCBtb2RlOiBtb2RlLCB0b2xlcmFuY2U6IHRvbGVyYW5jZSB9XSxcblx0XHRcdFx0ZGltZW5zaW9uc1N0cmluZyA9IEpTT04uc3RyaW5naWZ5KCBkaW1lbnNpb25zICksXG5cdFx0XHRcdGNoYXJ0VHlwZSA9IDk5OTksXG5cdFx0XHRcdHNlbGVjdGVkQ291bnRyaWVzID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcInNlbGVjdGVkLWNvdW50cmllc1wiICksXG5cdFx0XHRcdHNlbGVjdGVkQ291bnRyaWVzSWRzID0gXy5tYXAoIHNlbGVjdGVkQ291bnRyaWVzLCBmdW5jdGlvbiggdiApIHsgcmV0dXJuICh2KT8gK3YuaWQ6IFwiXCI7IH0gKTtcblx0XHRcdFxuXHRcdFx0dmFyIGRhdGFQcm9wcyA9IHsgXCJkaW1lbnNpb25zXCI6IGRpbWVuc2lvbnNTdHJpbmcsIFwiY2hhcnRJZFwiOiBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiaWRcIiApLCBcImNoYXJ0VHlwZVwiOiBjaGFydFR5cGUsIFwic2VsZWN0ZWRDb3VudHJpZXNcIjogc2VsZWN0ZWRDb3VudHJpZXNJZHMsIFwiY2hhcnRUaW1lXCI6IGNoYXJ0VGltZSwgXCJjYWNoZVwiOiBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2FjaGVcIiApLCBcImdyb3VwQnlWYXJpYWJsZXNcIjogQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImdyb3VwLWJ5LXZhcmlhYmxlc1wiICkgIH07XG5cdFx0XHR0aGlzLm1hcERhdGFNb2RlbC5mZXRjaCggeyBkYXRhOiBkYXRhUHJvcHMgfSApO1xuXG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXG5cdFx0ZGlzcGxheURhdGE6IGZ1bmN0aW9uKCBkYXRhICkge1xuXHRcdFx0XG5cdFx0XHR2YXIgdGhhdCA9IHRoaXMsXG5cdFx0XHRcdG1hcENvbmZpZyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJtYXAtY29uZmlnXCIgKSxcblx0XHRcdFx0ZGF0YU1pbiA9IEluZmluaXR5LFxuXHRcdFx0XHRkYXRhTWF4ID0gLUluZmluaXR5O1xuXG5cdFx0XHQvL25lZWQgdG8gZXh0cmFjdCBsYXRlc3QgdGltZVxuXHRcdFx0dmFyIGxhdGVzdERhdGEgPSBkYXRhLm1hcCggZnVuY3Rpb24oIGQsIGkgKSB7XG5cblx0XHRcdFx0dmFyIHZhbHVlcyA9IGQudmFsdWVzLFxuXHRcdFx0XHRcdGxhdGVzdFRpbWVWYWx1ZSA9ICggdmFsdWVzICYmIHZhbHVlcy5sZW5ndGggKT8gdmFsdWVzWyB2YWx1ZXMubGVuZ3RoIC0gMV06IDA7XG5cblx0XHRcdFx0Ly9hbHNvIGdldCBtaW4gbWF4IHZhbHVlcywgY291bGQgdXNlIGQzLm1pbiwgZDMubWF4IG9uY2Ugd2UgaGF2ZSBhbGwgdmFsdWVzLCBidXQgdGhpcyBwcm9iYWJseSBzYXZlcyBzb21lIHRpbWVcblx0XHRcdFx0ZGF0YU1pbiA9IE1hdGgubWluKCBkYXRhTWluLCBsYXRlc3RUaW1lVmFsdWUgKTtcblx0XHRcdFx0ZGF0YU1heCA9IE1hdGgubWF4KCBkYXRhTWF4LCBsYXRlc3RUaW1lVmFsdWUgKTtcblxuXHRcdFx0XHQvL2lkcyBpbiB3b3JsZCBqc29uIGFyZSBuYW1lIGNvdW50cmllcyB3aXRoIHVuZGVyc2NvcmUgKGRhdGFtYXBzLmpzIHVzZXMgaWQgZm9yIHNlbGVjdG9yLCBzbyBjYW5ub3QgaGF2ZSB3aGl0ZXNwYWNlKVxuXHRcdFx0XHRyZXR1cm4geyBcImtleVwiOiBkLmtleS5yZXBsYWNlKCBcIiBcIiwgXCJfXCIgKSwgXCJ2YWx1ZVwiOiBsYXRlc3RUaW1lVmFsdWUgfTtcblxuXHRcdFx0fSApO1xuXG5cdFx0XHR2YXIgY29sb3JTY2hlbWUgPSAoIGNvbG9yYnJld2VyWyBtYXBDb25maWcuY29sb3JTY2hlbWVOYW1lIF0gJiYgY29sb3JicmV3ZXJbIG1hcENvbmZpZy5jb2xvclNjaGVtZU5hbWUgXVsgbWFwQ29uZmlnLmNvbG9yU2NoZW1lSW50ZXJ2YWwgXSApPyBjb2xvcmJyZXdlclsgbWFwQ29uZmlnLmNvbG9yU2NoZW1lTmFtZSBdWyBtYXBDb25maWcuY29sb3JTY2hlbWVJbnRlcnZhbCBdOiBbXTtcblx0XHRcdFxuXHRcdFx0Ly9uZWVkIHRvIGNyZWF0ZSBjb2xvciBzY2hlbWVcblx0XHRcdHZhciBjb2xvclNjYWxlID0gZDMuc2NhbGUucXVhbnRpemUoKVxuXHRcdFx0XHQuZG9tYWluKCBbIGRhdGFNaW4sIGRhdGFNYXggXSApXG5cdFx0XHRcdC5yYW5nZSggY29sb3JTY2hlbWUgKTtcblxuXHRcdFx0Ly9uZWVkIHRvIGVuY29kZSBjb2xvcnMgcHJvcGVydGllc1xuXHRcdFx0dmFyIG1hcERhdGEgPSB7fSxcblx0XHRcdFx0Y29sb3JzID0gW107XG5cdFx0XHRsYXRlc3REYXRhLmZvckVhY2goIGZ1bmN0aW9uKCBkLCBpICkge1xuXHRcdFx0XHR2YXIgY29sb3IgPSBjb2xvclNjYWxlKCBkLnZhbHVlICk7XG5cdFx0XHRcdG1hcERhdGFbIGQua2V5IF0gPSB7IFwia2V5XCI6IGQua2V5LCBcInZhbHVlXCI6IGQudmFsdWUsIFwiY29sb3JcIjogY29sb3IgfTtcblx0XHRcdFx0Y29sb3JzLnB1c2goIGNvbG9yICk7XG5cdFx0XHR9ICk7XG5cblx0XHRcdHRoaXMubGVnZW5kLnNjYWxlKCBjb2xvclNjYWxlICk7XG5cdFx0XHRpZiggZDMuc2VsZWN0KCBcIi5sZWdlbmQtd3JhcHBlclwiICkuZW1wdHkoKSApIHtcblx0XHRcdFx0ZDMuc2VsZWN0KCBcIi5kYXRhbWFwXCIgKS5hcHBlbmQoIFwiZ1wiICkuYXR0ciggXCJjbGFzc1wiLCBcImxlZ2VuZC13cmFwcGVyXCIgKTtcblx0XHRcdH1cblx0XHRcdGQzLnNlbGVjdCggXCIubGVnZW5kLXdyYXBwZXJcIiApLmRhdHVtKCBjb2xvclNjaGVtZSApLmNhbGwoIHRoaXMubGVnZW5kICk7XG5cdFx0XHQvL2QzLnNlbGVjdCggXCIuZGF0YW1hcFwiICkuZGF0dW0oIGNvbG9yU2NoZW1lICkuY2FsbCggdGhpcy5sZWdlbmQgKTtcblxuXHRcdFx0Ly91cGRhdGUgbWFwXG5cdFx0XHQvL2FyZSB3ZSBjaGFuZ2luZyBwcm9qZWN0aW9ucz9cblx0XHRcdHZhciBvbGRQcm9qZWN0aW9uID0gdGhpcy5kYXRhTWFwLm9wdGlvbnMuc2V0UHJvamVjdGlvbixcblx0XHRcdFx0bmV3UHJvamVjdGlvbiA9IHRoaXMuZ2V0UHJvamVjdGlvbiggbWFwQ29uZmlnLnByb2plY3Rpb24gKTtcblx0XHRcdGlmKCBvbGRQcm9qZWN0aW9uID09PSBuZXdQcm9qZWN0aW9uICkge1xuXHRcdFx0XHQvL3Byb2plY3Rpb24gc3RheXMgdGhlIHNhbWUsIG5vIG5lZWQgdG8gcmVkcmF3IHVuaXRzXG5cdFx0XHRcdC8vbmVlZCB0byBzZXQgYWxsIHVuaXRzIHRvIGRlZmF1bHQgY29sb3IgZmlyc3QsIGNhdXNlIHVwZGF0ZUNob3BsZXRoIGp1c3QgdXBkYXRlcyBuZXcgZGF0YSBsZWF2ZXMgdGhlIG9sZCBkYXRhIGZvciB1bml0cyBubyBsb25nZXIgaW4gZGF0YXNldFxuXHRcdFx0XHRkMy5zZWxlY3RBbGwoIFwicGF0aC5kYXRhbWFwcy1zdWJ1bml0XCIgKS5zdHlsZSggXCJmaWxsXCIsIHRoaXMuZGF0YU1hcC5vcHRpb25zLmZpbGxzLmRlZmF1bHRGaWxsICk7XG5cdFx0XHRcdHRoaXMuZGF0YU1hcC51cGRhdGVDaG9yb3BsZXRoKCBtYXBEYXRhICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvL2NoYW5naW5nIHByb2plY3Rpb24sIG5lZWQgdG8gcmVtb3ZlIGV4aXN0aW5nIHVuaXRzLCByZWRyYXcgZXZlcnl0aGluZyBhbmQgYWZ0ZXIgZG9uZSBkcmF3aW5nLCB1cGRhdGUgZGF0YVxuXHRcdFx0XHRkMy5zZWxlY3RBbGwoJ3BhdGguZGF0YW1hcHMtc3VidW5pdCcpLnJlbW92ZSgpO1xuXHRcdFx0XHR0aGlzLmRhdGFNYXAub3B0aW9ucy5zZXRQcm9qZWN0aW9uID0gbmV3UHJvamVjdGlvbjtcblx0XHRcdFx0dGhpcy5kYXRhTWFwLmRyYXcoKTtcblx0XHRcdFx0dGhpcy5kYXRhTWFwLm9wdGlvbnMuZG9uZSA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdHRoYXQuZGF0YU1hcC51cGRhdGVDaG9yb3BsZXRoKCBtYXBEYXRhICk7XG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0XHRcblx0XHR9LFxuXG5cdFx0Z2V0UHJvamVjdGlvbjogZnVuY3Rpb24oIHByb2plY3Rpb25OYW1lICkge1xuXHRcdFx0dmFyIHByb2plY3Rpb25zID0gdGhpcy5wcm9qZWN0aW9ucyxcblx0XHRcdFx0bmV3UHJvamVjdGlvbiA9ICggcHJvamVjdGlvbnNbIHByb2plY3Rpb25OYW1lIF0gKT8gcHJvamVjdGlvbnNbIHByb2plY3Rpb25OYW1lIF06IHByb2plY3Rpb25zLldvcmxkO1xuXHRcdFx0cmV0dXJuIG5ld1Byb2plY3Rpb247XG5cdFx0XHRcblx0XHR9LFxuXG5cdFx0b25SZXNpemU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYoIHRoaXMuZGF0YU1hcCApIHtcblx0XHRcdFx0Ly9pbnN0ZWFkIG9mIGNhbGxpbmcgZGF0YW1hcHMgcmVzaXplLCB0aGVyZSdzIG1vZGlmaWVkIHZlcnNpb24gb2YgdGhlIHNhbWUgbWV0aG9kXG5cdFx0XHRcdHZhciBvcHRpb25zID0gdGhpcy5kYXRhTWFwLm9wdGlvbnMsXG5cdFx0XHRcdFx0cHJlZml4ID0gJy13ZWJraXQtdHJhbnNmb3JtJyBpbiBkb2N1bWVudC5ib2R5LnN0eWxlID8gJy13ZWJraXQtJyA6ICctbW96LXRyYW5zZm9ybScgaW4gZG9jdW1lbnQuYm9keS5zdHlsZSA/ICctbW96LScgOiAnLW1zLXRyYW5zZm9ybScgaW4gZG9jdW1lbnQuYm9keS5zdHlsZSA/ICctbXMtJyA6ICcnLFxuXHRcdFx0XHRcdG5ld3NpemUgPSBvcHRpb25zLmVsZW1lbnQuY2xpZW50V2lkdGgsXG5cdFx0XHRcdFx0b2xkc2l6ZSA9IGQzLnNlbGVjdCggb3B0aW9ucy5lbGVtZW50KS5zZWxlY3QoJ3N2ZycpLmF0dHIoJ2RhdGEtd2lkdGgnKTtcblx0XHRcdFx0XHQvL2RpZmZlcmVudCBzZWxlY3RvciBmcm9tIGRlZmF1bHQgZGF0YW1hcHMgaW1wbGVtZW50YXRpb24sIGRvZXNuJ3Qgc2NhbGUgbGVnZW5kXG5cdFx0XHRcdFx0ZDMuc2VsZWN0KG9wdGlvbnMuZWxlbWVudCkuc2VsZWN0KCdzdmcnKS5zZWxlY3RBbGwoJ2c6bm90KC5sZWdlbmQtc3RlcCk6bm90KC5sZWdlbmQpJykuc3R5bGUocHJlZml4ICsgJ3RyYW5zZm9ybScsICdzY2FsZSgnICsgKG5ld3NpemUgLyBvbGRzaXplKSArICcpJyk7XG5cdFx0XHRcdC8vdGhpcy5kYXRhTWFwLnJlc2l6ZSgpO1xuXHRcdFx0fVxuXHRcdH0sXG5cblx0XHRvbkNoYXJ0TW9kZWxSZXNpemU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5vblJlc2l6ZSgpO1xuXHRcdH0sXG5cdFxuXHRcdHByb2plY3Rpb25zOiB7IFxuXHRcdFx0XCJXb3JsZFwiOiBmdW5jdGlvbihlbGVtZW50KSB7XG5cdFx0XHRcdC8vZW1waXJpY1xuXHRcdFx0XHR2YXIgayA9IDY7XG5cdFx0XHRcdHZhciBwcm9qZWN0aW9uID0gZDMuZ2VvLmVja2VydDMoKVxuXHRcdFx0XHRcdC5zY2FsZShlbGVtZW50Lm9mZnNldFdpZHRoL2spXG5cdFx0XHRcdFx0LnRyYW5zbGF0ZShbZWxlbWVudC5vZmZzZXRXaWR0aCAvIDIsIGVsZW1lbnQub2Zmc2V0SGVpZ2h0IC8gMl0pXG5cdFx0XHRcdFx0LnByZWNpc2lvbiguMSk7XG5cdFx0XHRcdHZhciBwYXRoID0gZDMuZ2VvLnBhdGgoKS5wcm9qZWN0aW9uKHByb2plY3Rpb24pO1xuXHRcdFx0XHRyZXR1cm4ge3BhdGg6IHBhdGgsIHByb2plY3Rpb246IHByb2plY3Rpb259O1xuXHRcdFx0fSxcblx0XHRcdFwiQWZyaWNhXCI6IGZ1bmN0aW9uKGVsZW1lbnQpIHtcblx0XHRcdFx0Ly9lbXBpcmljXG5cdFx0XHRcdHZhciBrID0gMztcblx0XHRcdFx0dmFyIHByb2plY3Rpb24gPSBkMy5nZW8uY29uaWNDb25mb3JtYWwoKVxuXHRcdFx0XHRcdC5yb3RhdGUoWy0yNSwgMF0pXG5cdFx0XHRcdFx0LmNlbnRlcihbMCwgMF0pXG5cdFx0XHRcdFx0LnBhcmFsbGVscyhbMzAsIC0yMF0pXG5cdFx0XHRcdFx0LnNjYWxlKGVsZW1lbnQub2Zmc2V0V2lkdGgvaylcblx0XHRcdFx0XHQudHJhbnNsYXRlKFtlbGVtZW50Lm9mZnNldFdpZHRoIC8gMiwgZWxlbWVudC5vZmZzZXRIZWlnaHQgLyAyXSk7XG5cdFx0XHRcdHZhciBwYXRoID0gZDMuZ2VvLnBhdGgoKS5wcm9qZWN0aW9uKHByb2plY3Rpb24pO1xuXHRcdFx0XHRyZXR1cm4ge3BhdGg6IHBhdGgsIHByb2plY3Rpb246IHByb2plY3Rpb259O1xuXHRcdFx0fSxcblx0XHRcdFwiTi5BbWVyaWNhXCI6IGZ1bmN0aW9uKGVsZW1lbnQpIHtcblx0XHRcdFx0Ly9lbXBpcmljXG5cdFx0XHRcdHZhciBrID0gMztcblx0XHRcdFx0dmFyIHByb2plY3Rpb24gPSBkMy5nZW8uY29uaWNDb25mb3JtYWwoKVxuXHRcdFx0XHRcdC5yb3RhdGUoWzk4LCAwXSlcblx0XHRcdFx0XHQuY2VudGVyKFswLCAzOF0pXG5cdFx0XHRcdFx0LnBhcmFsbGVscyhbMjkuNSwgNDUuNV0pXG5cdFx0XHRcdFx0LnNjYWxlKGVsZW1lbnQub2Zmc2V0V2lkdGgvaylcblx0XHRcdFx0XHQudHJhbnNsYXRlKFtlbGVtZW50Lm9mZnNldFdpZHRoIC8gMiwgZWxlbWVudC5vZmZzZXRIZWlnaHQgLyAyXSk7XG5cdFx0XHRcdHZhciBwYXRoID0gZDMuZ2VvLnBhdGgoKS5wcm9qZWN0aW9uKHByb2plY3Rpb24pO1xuXHRcdFx0XHRyZXR1cm4ge3BhdGg6IHBhdGgsIHByb2plY3Rpb246IHByb2plY3Rpb259O1xuXHRcdFx0fSxcblx0XHRcdFwiUy5BbWVyaWNhXCI6IGZ1bmN0aW9uKGVsZW1lbnQpIHtcblx0XHRcdFx0Ly9lbXBpcmljXG5cdFx0XHRcdHZhciBrID0gMy40O1xuXHRcdFx0XHR2YXIgcHJvamVjdGlvbiA9IGQzLmdlby5jb25pY0NvbmZvcm1hbCgpXG5cdFx0XHRcdFx0LnJvdGF0ZShbNjgsIDBdKVxuXHRcdFx0XHRcdC5jZW50ZXIoWzAsIC0xNF0pXG5cdFx0XHRcdFx0LnBhcmFsbGVscyhbMTAsIC0zMF0pXG5cdFx0XHRcdFx0LnNjYWxlKGVsZW1lbnQub2Zmc2V0V2lkdGgvaylcblx0XHRcdFx0XHQudHJhbnNsYXRlKFtlbGVtZW50Lm9mZnNldFdpZHRoIC8gMiwgZWxlbWVudC5vZmZzZXRIZWlnaHQgLyAyXSk7XG5cdFx0XHRcdHZhciBwYXRoID0gZDMuZ2VvLnBhdGgoKS5wcm9qZWN0aW9uKHByb2plY3Rpb24pO1xuXHRcdFx0XHRyZXR1cm4ge3BhdGg6IHBhdGgsIHByb2plY3Rpb246IHByb2plY3Rpb259O1xuXHRcdFx0fSxcblx0XHRcdFwiQXNpYVwiOiBmdW5jdGlvbihlbGVtZW50KSB7XG5cdFx0XHRcdC8vZW1waXJpY1xuXHRcdFx0XHR2YXIgayA9IDM7XG5cdFx0XHRcdHZhciBwcm9qZWN0aW9uID0gZDMuZ2VvLmNvbmljQ29uZm9ybWFsKClcblx0XHRcdFx0XHQucm90YXRlKFstMTA1LCAwXSlcblx0XHRcdFx0XHQuY2VudGVyKFswLCAzN10pXG5cdFx0XHRcdFx0LnBhcmFsbGVscyhbMTAsIDYwXSlcblx0XHRcdFx0XHQuc2NhbGUoZWxlbWVudC5vZmZzZXRXaWR0aC9rKVxuXHRcdFx0XHRcdC50cmFuc2xhdGUoW2VsZW1lbnQub2Zmc2V0V2lkdGggLyAyLCBlbGVtZW50Lm9mZnNldEhlaWdodCAvIDJdKTtcblx0XHRcdFx0dmFyIHBhdGggPSBkMy5nZW8ucGF0aCgpLnByb2plY3Rpb24ocHJvamVjdGlvbik7XG5cdFx0XHRcdHJldHVybiB7cGF0aDogcGF0aCwgcHJvamVjdGlvbjogcHJvamVjdGlvbn07XG5cdFx0XHR9LFxuXHRcdFx0XCJFdXJvcGVcIjogZnVuY3Rpb24oZWxlbWVudCkge1xuXHRcdFx0XHQvL2VtcGlyaWNcblx0XHRcdFx0dmFyIGsgPSAxLjU7XG5cdFx0XHRcdHZhciBwcm9qZWN0aW9uID0gZDMuZ2VvLmNvbmljQ29uZm9ybWFsKClcblx0XHRcdFx0XHQucm90YXRlKFstMTUsIDBdKVxuXHRcdFx0XHRcdC5jZW50ZXIoWzAsIDU1XSlcblx0XHRcdFx0XHQucGFyYWxsZWxzKFs2MCwgNDBdKVxuXHRcdFx0XHRcdC5zY2FsZShlbGVtZW50Lm9mZnNldFdpZHRoL2spXG5cdFx0XHRcdFx0LnRyYW5zbGF0ZShbZWxlbWVudC5vZmZzZXRXaWR0aCAvIDIsIGVsZW1lbnQub2Zmc2V0SGVpZ2h0IC8gMl0pO1xuXHRcdFx0XHR2YXIgcGF0aCA9IGQzLmdlby5wYXRoKCkucHJvamVjdGlvbihwcm9qZWN0aW9uKTtcblx0XHRcdFx0cmV0dXJuIHtwYXRoOiBwYXRoLCBwcm9qZWN0aW9uOiBwcm9qZWN0aW9ufTtcblx0XHRcdH0sXG5cdFx0XHRcIkF1c3RyYWxpYVwiOiBmdW5jdGlvbihlbGVtZW50KSB7XG5cdFx0XHRcdC8vZW1waXJpY1xuXHRcdFx0XHR2YXIgayA9IDM7XG5cdFx0XHRcdHZhciBwcm9qZWN0aW9uID0gZDMuZ2VvLmNvbmljQ29uZm9ybWFsKClcblx0XHRcdFx0XHQucm90YXRlKFstMTM1LCAwXSlcblx0XHRcdFx0XHQuY2VudGVyKFswLCAtMjBdKVxuXHRcdFx0XHRcdC5wYXJhbGxlbHMoWy0xMCwgLTMwXSlcblx0XHRcdFx0XHQuc2NhbGUoZWxlbWVudC5vZmZzZXRXaWR0aC9rKVxuXHRcdFx0XHRcdC50cmFuc2xhdGUoW2VsZW1lbnQub2Zmc2V0V2lkdGggLyAyLCBlbGVtZW50Lm9mZnNldEhlaWdodCAvIDJdKTtcblx0XHRcdFx0dmFyIHBhdGggPSBkMy5nZW8ucGF0aCgpLnByb2plY3Rpb24ocHJvamVjdGlvbik7XG5cdFx0XHRcdHJldHVybiB7cGF0aDogcGF0aCwgcHJvamVjdGlvbjogcHJvamVjdGlvbn07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdH0pO1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkNoYXJ0Lk1hcFRhYjtcblxufSkoKTtcblxuKGZ1bmN0aW9uKCkge1xuXHR2YXIgzrUgPSAxZS02LCDOtTIgPSDOtSAqIM61LCDPgCA9IE1hdGguUEksIGhhbGbPgCA9IM+AIC8gMiwgc3FydM+AID0gTWF0aC5zcXJ0KM+AKSwgcmFkaWFucyA9IM+AIC8gMTgwLCBkZWdyZWVzID0gMTgwIC8gz4A7XG5cdGZ1bmN0aW9uIHNpbmNpKHgpIHtcblx0XHRyZXR1cm4geCA/IHggLyBNYXRoLnNpbih4KSA6IDE7XG5cdH1cblx0ZnVuY3Rpb24gc2duKHgpIHtcblx0XHRyZXR1cm4geCA+IDAgPyAxIDogeCA8IDAgPyAtMSA6IDA7XG5cdH1cblx0ZnVuY3Rpb24gYXNpbih4KSB7XG5cdFx0cmV0dXJuIHggPiAxID8gaGFsZs+AIDogeCA8IC0xID8gLWhhbGbPgCA6IE1hdGguYXNpbih4KTtcblx0fVxuXHRmdW5jdGlvbiBhY29zKHgpIHtcblx0XHRyZXR1cm4geCA+IDEgPyAwIDogeCA8IC0xID8gz4AgOiBNYXRoLmFjb3MoeCk7XG5cdH1cblx0ZnVuY3Rpb24gYXNxcnQoeCkge1xuXHRcdHJldHVybiB4ID4gMCA/IE1hdGguc3FydCh4KSA6IDA7XG5cdH1cblx0dmFyIHByb2plY3Rpb24gPSBkMy5nZW8ucHJvamVjdGlvbjtcbiBcblx0ZnVuY3Rpb24gZWNrZXJ0MyjOuywgz4YpIHtcblx0XHR2YXIgayA9IE1hdGguc3FydCjPgCAqICg0ICsgz4ApKTtcblx0XHRyZXR1cm4gWyAyIC8gayAqIM67ICogKDEgKyBNYXRoLnNxcnQoMSAtIDQgKiDPhiAqIM+GIC8gKM+AICogz4ApKSksIDQgLyBrICogz4YgXTtcblx0fVxuXHRlY2tlcnQzLmludmVydCA9IGZ1bmN0aW9uKHgsIHkpIHtcblx0XHR2YXIgayA9IE1hdGguc3FydCjPgCAqICg0ICsgz4ApKSAvIDI7XG5cdFx0cmV0dXJuIFsgeCAqIGsgLyAoMSArIGFzcXJ0KDEgLSB5ICogeSAqICg0ICsgz4ApIC8gKDQgKiDPgCkpKSwgeSAqIGsgLyAyIF07XG5cdH07XG5cdChkMy5nZW8uZWNrZXJ0MyA9IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiBwcm9qZWN0aW9uKGVja2VydDMpO1xuXHR9KS5yYXcgPSBlY2tlcnQzO1xuXHRcbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgQXBwID0gcmVxdWlyZSggXCIuLy4uLy4uL25hbWVzcGFjZXMuanNcIiApO1xuXG5cdEFwcC5WaWV3cy5DaGFydC5TY2FsZVNlbGVjdG9ycyA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblxuXHRcdGVsOiBcIiNjaGFydC12aWV3IC5heGlzLXNjYWxlLXNlbGVjdG9ycy13cmFwcGVyXCIsXG5cdFx0ZXZlbnRzOiB7XG5cdFx0XHRcImNsaWNrIC5heGlzLXNjYWxlLWJ0blwiOiBcIm9uQXhpc1NjYWxlQnRuXCIsXG5cdFx0XHRcImNoYW5nZSAuYXhpcy1zY2FsZSBsaVwiOiBcIm9uQXhpc1NjYWxlQ2hhbmdlXCJcblx0XHR9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHRcblx0XHRcdHRoaXMuZGlzcGF0Y2hlciA9IG9wdGlvbnMuZGlzcGF0Y2hlcjtcblx0XHRcdFxuXHRcdFx0dGhpcy4kdGFicyA9IHRoaXMuJGVsLmZpbmQoIFwiLmhlYWRlci10YWJcIiApO1xuXHRcdFx0XG5cdFx0XHR0aGlzLiR4QXhpc1NjYWxlID0gdGhpcy4kZWwuZmluZCggXCJbZGF0YS1uYW1lPSd4LWF4aXMtc2NhbGUnXVwiICk7XG5cdFx0XHR0aGlzLiR5QXhpc1NjYWxlID0gdGhpcy4kZWwuZmluZCggXCJbZGF0YS1uYW1lPSd5LWF4aXMtc2NhbGUnXVwiICk7XG5cblx0XHRcdHRoaXMuaW5pdERyb3BEb3duKCB0aGlzLiR4QXhpc1NjYWxlICk7XG5cdFx0XHR0aGlzLmluaXREcm9wRG93biggdGhpcy4keUF4aXNTY2FsZSApO1xuXG5cdFx0XHR0aGlzLnJlbmRlcigpO1xuXG5cdFx0XHQvL3NldHVwIGV2ZW50c1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwub24oIFwiY2hhbmdlXCIsIHRoaXMucmVuZGVyLCB0aGlzICk7XG5cblx0XHR9LFxuXG5cdFx0Lyppbml0RXZlbnRzOiBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuJGNoYXJ0VmlldyA9ICQoIFwiI2NoYXJ0LXZpZXdcIiApO1xuXHRcdFx0dGhpcy4kd3JhcCA9IHRoaXMuJGNoYXJ0Vmlldy5maW5kKCBcInN2ZyA+IC5udi13cmFwXCIgKTtcblx0XHRcdFxuXHRcdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdFx0dGhpcy4kd3JhcC5vbiggXCJtb3VzZW92ZXJcIiwgZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdFx0dGhhdC4kY2hhcnRWaWV3LmFkZENsYXNzKCBcImNoYXJ0LWhvdmVyZWRcIiApO1xuXHRcdFx0fSApO1xuXHRcdFx0dGhpcy4kd3JhcC5vbiggXCJtb3VzZW91dFwiLCBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0XHRjb25zb2xlLmxvZyggZXZ0LmN1cnJlbnRUYXJnZXQgKTtcblx0XHRcdFx0dGhhdC4kY2hhcnRWaWV3LnJlbW92ZUNsYXNzKCBcImNoYXJ0LWhvdmVyZWRcIiApO1xuXHRcdFx0fSApO1xuXHRcdH0sKi9cblxuXHRcdGluaXREcm9wRG93bjogZnVuY3Rpb24oICRlbCApIHtcblxuXHRcdFx0dmFyICRsaXN0ID0gJGVsLmZpbmQoIFwidWxcIiApLFxuXHRcdFx0XHQkaXRlbXMgPSAkbGlzdC5maW5kKCBcImxpXCIgKTtcblxuXHRcdFx0JGl0ZW1zLm9uKCBcImNsaWNrXCIsIGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHRcdHZhciAkdGhpcyA9ICQoIHRoaXMgKSxcblx0XHRcdFx0XHR2YWx1ZSA9ICR0aGlzLmF0dHIoIFwiZGF0YS12YWx1ZVwiICk7XG5cdFx0XHRcdCRpdGVtcy5yZW1vdmVDbGFzcyggXCJzZWxlY3RlZFwiICk7XG5cdFx0XHRcdCR0aGlzLmFkZENsYXNzKCBcInNlbGVjdGVkXCIgKTtcblx0XHRcdFx0JHRoaXMudHJpZ2dlciggXCJjaGFuZ2VcIiApO1xuXHRcdFx0fSApO1xuXG5cdFx0fSxcblxuXHRcdG9uQXhpc1NjYWxlQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHR2YXIgJGxpID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKSxcblx0XHRcdFx0JHBhcmVudCA9ICRsaS5wYXJlbnQoKS5wYXJlbnQoKS5wYXJlbnQoKSxcblx0XHRcdFx0JGRpdiA9ICRwYXJlbnQuZmluZCggXCJkaXZcIiApLFxuXHRcdFx0XHQkYnRuID0gJHBhcmVudC5maW5kKCBcIi5heGlzLXNjYWxlLWJ0blwiICksXG5cdFx0XHRcdCRzZWxlY3QgPSAkcGFyZW50LmZpbmQoIFwiLmF4aXMtc2NhbGVcIiApLFxuXHRcdFx0XHRuYW1lID0gJGRpdi5hdHRyKCBcImRhdGEtbmFtZVwiICksXG5cdFx0XHRcdGF4aXNOYW1lID0gKCBuYW1lID09PSBcIngtYXhpcy1zY2FsZVwiICk/IFwieC1heGlzXCI6IFwieS1heGlzXCIsXG5cdFx0XHRcdGF4aXNQcm9wID0gXCJheGlzLXNjYWxlXCIsXG5cdFx0XHRcdHZhbHVlID0gJGxpLmF0dHIoIFwiZGF0YS12YWx1ZVwiICk7XG5cblx0XHRcdEFwcC5DaGFydE1vZGVsLnNldEF4aXNDb25maWcoIGF4aXNOYW1lLCBheGlzUHJvcCwgdmFsdWUgKTtcblx0XHRcdFxuXHRcdFx0JHNlbGVjdC5oaWRlKCk7XG5cdFx0XHQvLyRidG4uc2hvdygpO1xuXG5cdFx0fSxcblxuXHRcdG9uQXhpc1NjYWxlQnRuOiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0XG5cdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdHZhciAkYnRuID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKSxcblx0XHRcdFx0JHBhcmVudCA9ICRidG4ucGFyZW50KCksXG5cdFx0XHRcdCRzZWxlY3QgPSAkcGFyZW50LmZpbmQoIFwiLmF4aXMtc2NhbGVcIiApO1xuXG5cdFx0XHQkc2VsZWN0LnNob3coKTtcblx0XHRcdC8vJGJ0bi5oaWRlKCk7XG5cblx0XHR9XG5cblx0fSk7XG5cdFxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5DaGFydC5TY2FsZVNlbGVjdG9ycztcblx0XG59KSgpO1xuIiwiOyggZnVuY3Rpb24oKSB7XG5cdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgQXBwID0gcmVxdWlyZSggXCIuLy4uLy4uL25hbWVzcGFjZXMuanNcIiApO1xuXG5cdEFwcC5WaWV3cy5DaGFydC5Tb3VyY2VzVGFiID0gQmFja2JvbmUuVmlldy5leHRlbmQoIHtcblxuXHRcdGVsOiBcIiNjaGFydC12aWV3XCIsXG5cdFx0ZXZlbnRzOiB7fSxcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0XG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIgPSBvcHRpb25zLmRpc3BhdGNoZXI7XG5cblx0XHRcdHRoaXMuJGNoYXJ0RGVzY3JpcHRpb24gPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1kZXNjcmlwdGlvblwiICk7XG5cdFx0XHR0aGlzLiRjaGFydFNvdXJjZXMgPSB0aGlzLiRlbC5maW5kKCBcIi5jaGFydC1zb3VyY2VzXCIgKTtcblx0XHRcdHRoaXMuJHNvdXJjZXNUYWIgPSB0aGlzLiRlbC5maW5kKCBcIiNzb3VyY2VzLWNoYXJ0LXRhYlwiICk7XG5cblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbiggcmVzcG9uc2UgKSB7XG5cblx0XHRcdGlmKCAhcmVzcG9uc2UgfHwgIXJlc3BvbnNlLmRhdGFzb3VyY2VzICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdHZhciBzb3VyY2VzID0gcmVzcG9uc2UuZGF0YXNvdXJjZXMsXG5cdFx0XHRcdGxpY2Vuc2UgPSByZXNwb25zZS5saWNlbnNlLFxuXHRcdFx0XHRmb290ZXJIdG1sID0gXCJcIixcblx0XHRcdFx0dGFiSHRtbCA9IFwiXCIsXG5cdFx0XHRcdGRlc2NyaXB0aW9uSHRtbCA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC1kZXNjcmlwdGlvblwiICksXG5cdFx0XHRcdHNvdXJjZXNTaG9ydEh0bWwgPSBcIkRhdGEgb2J0YWluZWQgZnJvbTogXCIsXG5cdFx0XHRcdHNvdXJjZXNMb25nSHRtbCA9IFwiXCIsXG5cdFx0XHRcdC8vY2hlY2sgdGhhdCB3ZSdyZSBub3QgYWRkaW5nIHNvdXJjZXMgd2l0aCB0aGUgc2FtZSBuYW1lIG1vcmUgdGltZXNcblx0XHRcdFx0c291cmNlc0J5TmFtZSA9IFtdO1xuXHRcdFx0XHRcblx0XHRcdC8vY29uc3RydWN0IHNvdXJjZSBodG1sXG5cdFx0XHRfLmVhY2goIHNvdXJjZXMsIGZ1bmN0aW9uKCBzb3VyY2VEYXRhLCBzb3VyY2VJbmRleCApIHtcblx0XHRcdFx0Ly9tYWtlIHN1cmUgd2UgZG9uJ3QgaGF2ZSBzb3VyY2Ugd2l0aCB0aGUgc2FtZSBuYW1lIGluIHRoZSBzaG9ydCBkZXNjcmlwdGlvbiBhbHJlYWR5XG5cdFx0XHRcdGlmKCAhc291cmNlc0J5TmFtZVsgc291cmNlRGF0YS5uYW1lIF0gKSB7XG5cdFx0XHRcdFx0aWYoIHNvdXJjZUluZGV4ID4gMCApIHtcblx0XHRcdFx0XHRcdHNvdXJjZXNTaG9ydEh0bWwgKz0gXCIsIFwiO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiggc291cmNlRGF0YS5saW5rICkge1xuXHRcdFx0XHRcdFx0c291cmNlc1Nob3J0SHRtbCArPSBcIjxhIGhyZWY9J1wiICsgc291cmNlRGF0YS5saW5rICsgXCInIHRhcmdldD0nX2JsYW5rJz5cIiArIHNvdXJjZURhdGEubmFtZSArIFwiPC9hPlwiO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRzb3VyY2VzU2hvcnRIdG1sICs9IHNvdXJjZURhdGEubmFtZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0c291cmNlc0J5TmFtZVsgc291cmNlRGF0YS5uYW1lIF0gPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdFxuXHRcdFx0XHQvL3NvdXJjZXMgbm93IGNvbnRhaW4gaHRtbCwgc28gbm8gbmVlZCB0byBzZXBhcmF0ZSB3aXRoIGNvbW1hXG5cdFx0XHRcdC8qaWYoIHNvdXJjZUluZGV4ID4gMCAmJiBzb3VyY2VzTG9uZ0h0bWwgIT09IFwiXCIgJiYgc291cmNlRGF0YS5kZXNjcmlwdGlvbiAhPT0gXCJcIiApIHtcblx0XHRcdFx0XHRzb3VyY2VzTG9uZ0h0bWwgKz0gXCIsIFwiO1xuXHRcdFx0XHR9Ki9cblx0XHRcdFx0c291cmNlc0xvbmdIdG1sICs9IHNvdXJjZURhdGEuZGVzY3JpcHRpb247XG5cdFx0XHRcblx0XHRcdH0gKTtcblxuXHRcdFx0Zm9vdGVySHRtbCA9IGRlc2NyaXB0aW9uSHRtbDtcblx0XHRcdHRhYkh0bWwgPSBkZXNjcmlwdGlvbkh0bWwgKyBcIjxiciAvPjxiciAvPlwiICsgc291cmNlc0xvbmdIdG1sO1xuXHRcdFx0XG5cdFx0XHQvL2FkZCBsaWNlbnNlIGluZm9cblx0XHRcdGlmKCBsaWNlbnNlICYmIGxpY2Vuc2UuZGVzY3JpcHRpb24gKSB7XG5cdFx0XHRcdGZvb3Rlckh0bWwgPSBsaWNlbnNlLmRlc2NyaXB0aW9uICsgXCIgXCIgKyBmb290ZXJIdG1sO1xuXHRcdFx0XHR0YWJIdG1sID0gbGljZW5zZS5kZXNjcmlwdGlvbiArIFwiIFwiICsgdGFiSHRtbDtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0Ly9hcHBlbmQgdG8gRE9NXG5cdFx0XHR0aGlzLiRjaGFydERlc2NyaXB0aW9uLmh0bWwoIGZvb3Rlckh0bWwgKTtcblx0XHRcdHRoaXMuJGNoYXJ0U291cmNlcy5odG1sKCBzb3VyY2VzU2hvcnRIdG1sICk7XG5cdFx0XHR0aGlzLiRzb3VyY2VzVGFiLmh0bWwoIHRhYkh0bWwgKTtcblxuXHRcdH1cblxuXHR9ICk7XG5cdFxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5DaGFydC5Tb3VyY2VzVGFiO1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIEFwcCA9IHJlcXVpcmUoIFwiLi8uLi8uLi8uLi9uYW1lc3BhY2VzLmpzXCIgKTtcblxuXHRBcHAuVmlld3MuQ2hhcnQuTWFwLkxlZ2VuZCA9IGZ1bmN0aW9uKCkge1xuXG5cdFx0Ly9wcml2YXRlXG5cdFx0dmFyIHN0ZXBTaXplID0gMjAsXG5cdFx0XHRzdGVwQ2xhc3MgPSBcImxlZ2VuZC1zdGVwXCIsXG5cdFx0XHRzY2FsZTtcblxuXHRcdHZhciBmb3JtYXRMZWdlbmRMYWJlbCA9IGZ1bmN0aW9uKCB2YWx1ZUFyciwgaSwgbGVuZ3RoICkge1xuXHRcdFx0XG5cdFx0XHR2YWx1ZUFyciA9IHZhbHVlQXJyLm1hcCggZnVuY3Rpb24oIGQgKSB7XG5cdFx0XHRcdHZhciBsZW4gPSBkLnRvU3RyaW5nKCkubGVuZ3RoLFxuXHRcdFx0XHRcdGZvcm1hdHRlZE51bWJlciA9IGQ7XG5cdFx0XHRcdGlmKCBsZW4gPiAzICkge1xuXHRcdFx0XHRcdGZvcm1hdHRlZE51bWJlciA9IGQzLmZvcm1hdCggXCIuM3JcIiApKCBkICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGZvcm1hdHRlZE51bWJlcjtcblx0XHRcdH0gKTtcblx0XHRcdGlmKCBpIDwgKGxlbmd0aCAtIDEpICkge1xuXHRcdFx0XHRyZXR1cm4gdmFsdWVBcnJbIDAgXTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiB2YWx1ZUFyci5qb2luKCBcIiAmbmJzcDsgXCIgKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0ZnVuY3Rpb24gbGVnZW5kKCBzZWxlY3Rpb24gKSB7XG5cblx0XHRcdHNlbGVjdGlvbi5lYWNoKCBmdW5jdGlvbiggZGF0YSApIHtcblxuXHRcdFx0XHR2YXIgZGF0YW1hcCA9IGQzLnNlbGVjdCggXCIuZGF0YW1hcFwiICksXG5cdFx0XHRcdFx0Y29udGFpbmVyID0gZDMuc2VsZWN0KCB0aGlzICksXG5cdFx0XHRcdFx0Y29udGFpbmVySGVpZ2h0ID0gZGF0YW1hcC5ub2RlKCkuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkuaGVpZ2h0LFxuXHRcdFx0XHRcdGxlZ2VuZE9mZnNldCA9IDEwLFxuXHRcdFx0XHRcdHN0ZXBHYXAgPSAyLFxuXHRcdFx0XHRcdGcgPSBjb250YWluZXIuc2VsZWN0KCBcIi5sZWdlbmRcIiApO1xuXG5cdFx0XHRcdGlmKCBnLmVtcHR5KCkgKSB7XG5cdFx0XHRcdFx0ZyA9IHNlbGVjdGlvbi5hcHBlbmQoIFwiZ1wiIClcblx0XHRcdFx0XHRcdFx0LmF0dHIoIFwiaWRcIiwgXCJsZWdlbmRcIiApXG5cdFx0XHRcdFx0XHRcdC5hdHRyKCBcImNsYXNzXCIsIFwibGVnZW5kXCIgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0Ly9zdGFydCB3aXRoIGhpZ2hlc3QgdmFsdWVcblx0XHRcdFx0Ly9kYXRhLnJldmVyc2UoKTtcblxuXHRcdFx0XHQvL2RhdGEgam9pblxuXHRcdFx0XHR2YXIgbGVnZW5kU3RlcHMgPSBnLnNlbGVjdEFsbCggXCIuXCIgKyBzdGVwQ2xhc3MgKS5kYXRhKCBkYXRhICk7XG5cdFx0XHRcdFxuXHRcdFx0XHQvL2VudGVyXG5cdFx0XHRcdHZhciBsZWdlbmRTdGVwc0VudGVyID0gbGVnZW5kU3RlcHMuZW50ZXIoKVxuXHRcdFx0XHRcdC5hcHBlbmQoIFwiZ1wiIClcblx0XHRcdFx0XHRcdC5hdHRyKCBcImNsYXNzXCIsIHN0ZXBDbGFzcyApXG5cdFx0XHRcdFx0XHQuYXR0ciggXCJ0cmFuc2Zvcm1cIiwgZnVuY3Rpb24oIGQsIGkgKSB7IHZhciB0cmFuc2xhdGVYID0gbGVnZW5kT2Zmc2V0ICsgKGkqKHN0ZXBTaXplK3N0ZXBHYXApKSwgdHJhbnNsYXRlWSA9IGNvbnRhaW5lckhlaWdodCAtIGxlZ2VuZE9mZnNldCAtIHN0ZXBTaXplOyByZXR1cm4gXCJ0cmFuc2xhdGUoXCIgKyB0cmFuc2xhdGVYICsgXCIsXCIgKyB0cmFuc2xhdGVZICsgXCIpXCI7IH0gKTtcblx0XHRcdFx0XHRcdC8vLmF0dHIoIFwidHJhbnNmb3JtXCIsIGZ1bmN0aW9uKCBkLCBpICkgeyB2YXIgdHJhbnNsYXRlWSA9IGNvbnRhaW5lckhlaWdodCAtIGxlZ2VuZE9mZnNldCAtIHN0ZXBTaXplIC0gKCBpKihzdGVwU2l6ZStzdGVwR2FwKSApOyByZXR1cm4gXCJ0cmFuc2xhdGUoXCIgKyBsZWdlbmRPZmZzZXQgKyBcIixcIiArIHRyYW5zbGF0ZVkgKyBcIilcIjsgfSApO1xuXHRcdFx0XHRsZWdlbmRTdGVwc0VudGVyLmFwcGVuZCggXCJyZWN0XCIgKVxuXHRcdFx0XHRcdC5hdHRyKCBcIndpZHRoXCIsIHN0ZXBTaXplICsgXCJweFwiIClcblx0XHRcdFx0XHQuYXR0ciggXCJoZWlnaHRcIiwgc3RlcFNpemUgKyBcInB4XCIgKTtcblx0XHRcdFx0bGVnZW5kU3RlcHNFbnRlci5hcHBlbmQoIFwidGV4dFwiIClcblx0XHRcdFx0XHQvLy5hdHRyKCBcInRyYW5zZm9ybVwiLCBmdW5jdGlvbiggZCwgaSApIHsgcmV0dXJuIFwidHJhbnNsYXRlKCBcIiArIChwYXJzZUludCggc3RlcFNpemUvMS40LCAxMCApICsgMTApICsgXCIsIFwiICsgcGFyc2VJbnQoIHN0ZXBTaXplLzEuNCwgMTAgKSArIFwiIClcIjsgfSApO1xuXHRcdFx0XHRcdC5hdHRyKCBcInRyYW5zZm9ybVwiLCBmdW5jdGlvbiggZCwgaSApIHsgcmV0dXJuIFwidHJhbnNsYXRlKC0yLC01KVwiOyB9ICk7XG5cblx0XHRcdFx0Ly91cGRhdGVcblx0XHRcdFx0bGVnZW5kU3RlcHMuc2VsZWN0KCBcInJlY3RcIiApXG5cdFx0XHRcdFx0LnN0eWxlKCBcImZpbGxcIiwgZnVuY3Rpb24oIGQsIGkgKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBkO1xuXHRcdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRsZWdlbmRTdGVwcy5zZWxlY3QoIFwidGV4dFwiIClcblx0XHRcdFx0XHQuaHRtbCggZnVuY3Rpb24oIGQsIGkgKSB7IHJldHVybiBmb3JtYXRMZWdlbmRMYWJlbCggc2NhbGUuaW52ZXJ0RXh0ZW50KCBkICksIGksIGRhdGEubGVuZ3RoICk7IH0gKTtcblxuXHRcdFx0XHQvL2V4aXRcblx0XHRcdFx0bGVnZW5kU3RlcHMuZXhpdCgpLnJlbW92ZSgpO1xuXG5cdFx0XHR9ICk7XG5cblx0XHRcdHJldHVybiBsZWdlbmQ7XG5cblx0XHR9XG5cblx0XHQvL3B1YmxpYyBtZXRob2RzXG5cdFx0bGVnZW5kLnNjYWxlID0gZnVuY3Rpb24oIHZhbHVlICkge1xuXHRcdFx0aWYoICFhcmd1bWVudHMubGVuZ3RoICkge1xuXHRcdFx0XHRyZXR1cm4gc2NhbGU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRzY2FsZSA9IHZhbHVlO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRyZXR1cm4gbGVnZW5kO1xuXG5cdH07XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVmlld3MuQ2hhcnQuTWFwLkxlZ2VuZDtcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBBcHAgPSByZXF1aXJlKCBcIi4vLi4vLi4vLi4vbmFtZXNwYWNlcy5qc1wiICk7XG5cblx0QXBwLlZpZXdzLkNoYXJ0Lk1hcC5NYXBDb250cm9scyA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblxuXHRcdGVsOiBcIiNtYXAtY2hhcnQtdGFiIC5tYXAtY29udHJvbHMtaGVhZGVyXCIsXG5cdFx0ZXZlbnRzOiB7XG5cdFx0XHRcImlucHV0IC50YXJnZXQteWVhci1jb250cm9sIGlucHV0XCI6IFwib25UYXJnZXRZZWFySW5wdXRcIixcblx0XHRcdFwiY2hhbmdlIC50YXJnZXQteWVhci1jb250cm9sIGlucHV0XCI6IFwib25UYXJnZXRZZWFyQ2hhbmdlXCIsXG5cdFx0XHRcImNsaWNrIC5yZWdpb24tY29udHJvbCBsaVwiOiBcIm9uUmVnaW9uQ2xpY2tcIixcblx0XHRcdFwiY2xpY2sgLnNldHRpbmdzLWNvbnRyb2wgaW5wdXRcIjogXCJvblNldHRpbmdzSW5wdXRcIixcblx0XHR9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cblx0XHRcdHRoaXMuZGlzcGF0Y2hlciA9IG9wdGlvbnMuZGlzcGF0Y2hlcjtcblxuXHRcdFx0dmFyIG1hcENvbmZpZyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJtYXAtY29uZmlnXCIgKTtcblx0XHRcdFxuXHRcdFx0Ly95ZWFyIHNsaWRlclxuXHRcdFx0dGhpcy4kdGFyZ2V0WWVhckNvbnRyb2wgPSB0aGlzLiRlbC5maW5kKCBcIi50YXJnZXQteWVhci1jb250cm9sXCIgKTtcblx0XHRcdHRoaXMuJHRhcmdldFllYXJMYWJlbCA9IHRoaXMuJHRhcmdldFllYXJDb250cm9sLmZpbmQoIFwiLnRhcmdldC15ZWFyLWxhYmVsXCIgKTtcblx0XHRcdHRoaXMuJHRhcmdldFllYXJJbnB1dCA9IHRoaXMuJHRhcmdldFllYXJDb250cm9sLmZpbmQoIFwiaW5wdXRcIiApO1xuXHRcdFx0XG5cdFx0XHQvL3JlZ2lvbiBzZWxlY3RvclxuXHRcdFx0dGhpcy4kcmVnaW9uQ29udHJvbCA9IHRoaXMuJGVsLmZpbmQoIFwiLnJlZ2lvbi1jb250cm9sXCIgKTtcblx0XHRcdHRoaXMuJHJlZ2lvbkNvbnRyb2xMYWJlbCA9IHRoaXMuJHJlZ2lvbkNvbnRyb2wuZmluZCggXCIucmVnaW9uLWxhYmVsXCIgKTtcblx0XHRcdHRoaXMuJHJlZ2lvbkNvbnRyb2xMaXMgPSB0aGlzLiRyZWdpb25Db250cm9sLmZpbmQoIFwibGlcIiApO1xuXG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5vbiggXCJjaGFuZ2VcIiwgdGhpcy5vbkNoYXJ0TW9kZWxDaGFuZ2UsIHRoaXMgKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLm9uKCBcImNoYW5nZS1tYXBcIiwgdGhpcy5vbkNoYXJ0TW9kZWxDaGFuZ2UsIHRoaXMgKTtcblxuXHRcdFx0cmV0dXJuIHRoaXMucmVuZGVyKCk7XG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcblx0XHRcdHZhciBtYXBDb25maWcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwibWFwLWNvbmZpZ1wiICk7XG5cdFx0XHRcblx0XHRcdHRoaXMuJHRhcmdldFllYXJMYWJlbC50ZXh0KCBtYXBDb25maWcudGFyZ2V0WWVhciApO1xuXHRcdFx0dGhpcy4kcmVnaW9uQ29udHJvbExhYmVsLnRleHQoIG1hcENvbmZpZy5wcm9qZWN0aW9uICk7XG5cblx0XHRcdHRoaXMuJHRhcmdldFllYXJJbnB1dC5hdHRyKCBcIm1pblwiLCBtYXBDb25maWcubWluWWVhciApO1xuXHRcdFx0dGhpcy4kdGFyZ2V0WWVhcklucHV0LmF0dHIoIFwibWF4XCIsIG1hcENvbmZpZy5tYXhZZWFyICk7XG5cdFx0XHR0aGlzLiR0YXJnZXRZZWFySW5wdXQuYXR0ciggXCJzdGVwXCIsIG1hcENvbmZpZy50aW1lSW50ZXJ2YWwgKTtcblx0XHRcdHRoaXMuJHRhcmdldFllYXJJbnB1dC52YWwoIHBhcnNlSW50KCBtYXBDb25maWcudGFyZ2V0WWVhciwgMTAgKSApO1xuXG5cdFx0XHR0aGlzLiRyZWdpb25Db250cm9sTGlzLnJlbW92ZUNsYXNzKCBcImhpZ2hsaWdodFwiICk7XG5cdFx0XHR0aGlzLiRyZWdpb25Db250cm9sTGlzLmZpbHRlciggXCIuXCIgKyBtYXBDb25maWcucHJvamVjdGlvbiArIFwiLXByb2plY3Rpb25cIiApLmFkZENsYXNzKCBcImhpZ2hsaWdodFwiICk7XG5cblx0XHR9LFxuXG5cdFx0b25DaGFydE1vZGVsQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblx0XHR9LFxuXHRcdFxuXHRcdG9uVGFyZ2V0WWVhcklucHV0OiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0dmFyICR0aGlzID0gJCggZXZ0LnRhcmdldCApLFxuXHRcdFx0XHR0YXJnZXRZZWFyID0gcGFyc2VJbnQoICR0aGlzLnZhbCgpLCAxMCApO1xuXHRcdFx0dGhpcy4kdGFyZ2V0WWVhckxhYmVsLnRleHQoIHRhcmdldFllYXIsIGZhbHNlLCBcImNoYW5nZS1tYXBcIiApO1xuXHRcdH0sXG5cblx0XHRvblRhcmdldFllYXJDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHR2YXIgJHRoaXMgPSAkKCBldnQudGFyZ2V0ICksXG5cdFx0XHRcdHRhcmdldFllYXIgPSBwYXJzZUludCggJHRoaXMudmFsKCksIDEwICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC51cGRhdGVNYXBDb25maWcoIFwidGFyZ2V0WWVhclwiLCB0YXJnZXRZZWFyLCBmYWxzZSwgXCJjaGFuZ2UtbWFwXCIgKTtcblx0XHRcdHRoaXMucmVuZGVyKCk7XG5cdFx0fSxcblxuXHRcdG9uUmVnaW9uQ2xpY2s6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHR2YXIgJHRoaXMgPSAkKCBldnQudGFyZ2V0ICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC51cGRhdGVNYXBDb25maWcoIFwicHJvamVjdGlvblwiLCAkdGhpcy50ZXh0KCksIGZhbHNlLCBcImNoYW5nZS1tYXBcIiApO1xuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblx0XHR9LFxuXG5cdFx0b25TZXR0aW5nc0lucHV0OiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0dmFyICR0aGlzID0gJCggZXZ0LnRhcmdldCApLFxuXHRcdFx0XHRtb2RlID0gKCAkdGhpcy5pcyggXCI6Y2hlY2tlZFwiICkgKT8gXCJzcGVjaWZpY1wiOiBcIm5vLWludGVycG9sYXRpb25cIjtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnVwZGF0ZU1hcENvbmZpZyggXCJtb2RlXCIsIG1vZGUsIGZhbHNlLCBcImNoYW5nZS1tYXBcIiApO1xuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblx0XHR9XG5cblx0fSk7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVmlld3MuQ2hhcnQuTWFwLk1hcENvbnRyb2xzO1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIEFwcCA9IHJlcXVpcmUoIFwiLi8uLi8uLi9uYW1lc3BhY2VzLmpzXCIgKTtcblxuXHRBcHAuVmlld3MuRm9ybS5BeGlzVGFiVmlldyA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblxuXHRcdGVsOiBcIiNmb3JtLXZpZXcgI2F4aXMtdGFiXCIsXG5cdFx0ZXZlbnRzOiB7XG5cdFx0XHRcImNoYW5nZSBpbnB1dC5mb3JtLWNvbnRyb2wsIHNlbGVjdC5mb3JtLWNvbnRyb2xcIjogXCJvbkZvcm1Db250cm9sQ2hhbmdlXCIsXG5cdFx0XHRcImNoYW5nZSBbbmFtZT0neC1heGlzLXNjYWxlLXNlbGVjdG9yJ11cIjogXCJvblhheGlzU2NhbGVTZWxlY3RvclwiLFxuXHRcdFx0XCJjaGFuZ2UgW25hbWU9J3ktYXhpcy1zY2FsZS1zZWxlY3RvciddXCI6IFwib25ZYXhpc1NjYWxlU2VsZWN0b3JcIlxuXHRcdH0sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdFxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gb3B0aW9ucy5kaXNwYXRjaGVyO1xuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblxuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHQvL3NldHVwIGluaXRpYWwgdmFsdWVzXG5cdFx0XHR2YXIgdGhhdCA9IHRoaXMsXG5cdFx0XHRcdGNoYXJ0WGF4aXMgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwieC1heGlzXCIgKSxcblx0XHRcdFx0Y2hhcnRZYXhpcyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJ5LWF4aXNcIiApO1xuXG5cdFx0XHR2YXIgJHhBeGlzU2NhbGVTZWxlY3RvciA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9J3gtYXhpcy1zY2FsZS1zZWxlY3RvciddXCIgKSxcblx0XHRcdFx0JHlBeGlzU2NhbGVTZWxlY3RvciA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9J3ktYXhpcy1zY2FsZS1zZWxlY3RvciddXCIgKTtcblxuXHRcdFx0Xy5lYWNoKCBjaGFydFhheGlzLCBmdW5jdGlvbiggZCwgaSApIHtcblx0XHRcdFx0dGhhdC4kZWwuZmluZCggXCJbbmFtZT0nY2hhcnQteC1cIiArIGkgKyBcIiddXCIgKS52YWwoIGQgKTtcblx0XHRcdH0gKTtcblx0XHRcdF8uZWFjaCggY2hhcnRZYXhpcywgZnVuY3Rpb24oIGQsIGkgKSB7XG5cdFx0XHRcdHRoYXQuJGVsLmZpbmQoIFwiW25hbWU9J2NoYXJ0LXktXCIgKyBpICsgXCInXVwiICkudmFsKCBkICk7XG5cdFx0XHR9ICk7XG5cblx0XHRcdCR4QXhpc1NjYWxlU2VsZWN0b3IucHJvcCggXCJjaGVja2VkXCIsIEFwcC5DaGFydE1vZGVsLmdldCggXCJ4LWF4aXMtc2NhbGUtc2VsZWN0b3JcIiApICk7XG5cdFx0XHQkeUF4aXNTY2FsZVNlbGVjdG9yLnByb3AoIFwiY2hlY2tlZFwiLCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwieS1heGlzLXNjYWxlLXNlbGVjdG9yXCIgKSApO1xuXHRcdFx0XG5cblx0XHR9LFxuXG5cdFx0b25Gb3JtQ29udHJvbENoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0Y29uc29sZS5sb2coIFwib25Gb3JtQ29udHJvbENoYW5nZVwiICk7XG5cdFx0XHR2YXIgJGNvbnRyb2wgPSAkKCBldnQuY3VycmVudFRhcmdldCApLFxuXHRcdFx0XHRjb250cm9sTmFtZSA9ICRjb250cm9sLmF0dHIoIFwibmFtZVwiICksXG5cdFx0XHRcdGNvbnRyb2xWYWx1ZSA9ICRjb250cm9sLnZhbCgpLFxuXHRcdFx0XHRheGlzTmFtZSA9ICggY29udHJvbE5hbWUuaW5kZXhPZiggXCJjaGFydC15XCIgKSA+IC0xICk/IFwieS1heGlzXCI6IFwieC1heGlzXCI7XG5cblx0XHRcdC8vc3RyaXAgY29udHJvbCBuYW1lIHByZWZpeFxuXHRcdFx0Y29udHJvbE5hbWUgPSBjb250cm9sTmFtZS5zdWJzdHJpbmcoIDggKTtcblxuXHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0QXhpc0NvbmZpZyggYXhpc05hbWUsIGNvbnRyb2xOYW1lLCBjb250cm9sVmFsdWUgKTtcblxuXHRcdH0sXG5cblx0XHRvblhheGlzU2NhbGVTZWxlY3RvcjogZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdHZhciAkY2hlY2sgPSAkKCBldnQuY3VycmVudFRhcmdldCApO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0KCBcIngtYXhpcy1zY2FsZS1zZWxlY3RvclwiLCAkY2hlY2suaXMoIFwiOmNoZWNrZWRcIiApICk7XG5cdFx0fSxcblxuXHRcdG9uWWF4aXNTY2FsZVNlbGVjdG9yOiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0dmFyICRjaGVjayA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5zZXQoIFwieS1heGlzLXNjYWxlLXNlbGVjdG9yXCIsICRjaGVjay5pcyggXCI6Y2hlY2tlZFwiICkgKTtcblx0XHR9XG5cblxuXHR9KTtcblx0XG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkZvcm0uQXhpc1RhYlZpZXc7XG5cbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgQXBwID0gcmVxdWlyZSggXCIuLy4uLy4uL25hbWVzcGFjZXMuanNcIiApLFxuXHRcdENoYXJ0VHlwZVNlY3Rpb25WaWV3ID0gcmVxdWlyZSggXCIuL2Jhc2ljVGFiL0FwcC5WaWV3cy5Gb3JtLkNoYXJ0VHlwZVNlY3Rpb25WaWV3LmpzXCIgKSxcblx0XHRBZGREYXRhU2VjdGlvblZpZXcgPSByZXF1aXJlKCBcIi4vZGF0YVRhYi9BcHAuVmlld3MuRm9ybS5BZGREYXRhU2VjdGlvblZpZXcuanNcIiApLFxuXHRcdERpbWVuc2lvbnNTZWN0aW9uVmlldyA9IHJlcXVpcmUoIFwiLi9kYXRhVGFiL0FwcC5WaWV3cy5Gb3JtLkRpbWVuc2lvbnNTZWN0aW9uVmlldy5qc1wiICksXG5cdFx0U2VsZWN0ZWRDb3VudHJpZXNTZWN0aW9uVmlldyA9IHJlcXVpcmUoIFwiLi9kYXRhVGFiL0FwcC5WaWV3cy5Gb3JtLlNlbGVjdGVkQ291bnRyaWVzU2VjdGlvblZpZXcuanNcIiApLFxuXHRcdEVudGl0aWVzU2VjdGlvblZpZXcgPSByZXF1aXJlKCBcIi4vZGF0YVRhYi9BcHAuVmlld3MuRm9ybS5FbnRpdGllc1NlY3Rpb25WaWV3LmpzXCIgKSxcblx0XHRUaW1lU2VjdGlvblZpZXcgPSByZXF1aXJlKCBcIi4vZGF0YVRhYi9BcHAuVmlld3MuRm9ybS5UaW1lU2VjdGlvblZpZXcuanNcIiApO1xuXG5cdEFwcC5WaWV3cy5Gb3JtLkJhc2ljVGFiVmlldyA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblxuXHRcdGVsOiBcIiNmb3JtLXZpZXcgI2Jhc2ljLXRhYlwiLFxuXHRcdGV2ZW50czoge30sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdFxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gb3B0aW9ucy5kaXNwYXRjaGVyO1xuXG5cdFx0XHR0aGlzLmNoYXJ0VHlwZVNlY3Rpb24gPSBuZXcgQ2hhcnRUeXBlU2VjdGlvblZpZXcoIHsgZGlzcGF0Y2hlcjogdGhpcy5kaXNwYXRjaGVyIH0gKTtcblx0XHRcdHRoaXMuYWRkRGF0YVNlY3Rpb24gPSBuZXcgQWRkRGF0YVNlY3Rpb25WaWV3KCB7IGRpc3BhdGNoZXI6IHRoaXMuZGlzcGF0Y2hlciB9ICk7XG5cdFx0XHR0aGlzLmRpbWVuc2lvbnNTZWN0aW9uID0gbmV3IERpbWVuc2lvbnNTZWN0aW9uVmlldyggeyBkaXNwYXRjaGVyOiB0aGlzLmRpc3BhdGNoZXIgfSApO1xuXHRcdFx0dGhpcy5zZWxlY3RlZENvdW50cmllc1NlY3Rpb24gPSBuZXcgU2VsZWN0ZWRDb3VudHJpZXNTZWN0aW9uVmlldyggeyBkaXNwYXRjaGVyOiB0aGlzLmRpc3BhdGNoZXIgfSApO1xuXHRcdFx0dGhpcy5lbnRpdGllc1NlY3Rpb24gPSBuZXcgRW50aXRpZXNTZWN0aW9uVmlldyggeyBkaXNwYXRjaGVyOiB0aGlzLmRpc3BhdGNoZXIgfSApO1xuXHRcdFx0dGhpcy50aW1lU2VjdGlvbiA9IG5ldyBUaW1lU2VjdGlvblZpZXcoIHsgZGlzcGF0Y2hlcjogdGhpcy5kaXNwYXRjaGVyIH0gKTtcblxuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblxuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XG5cdFx0XHR0aGlzLiRlbC5maW5kKCBcIltuYW1lPWNoYXJ0LW5hbWVdXCIgKS52YWwoIEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC1uYW1lXCIgKSApO1xuXHRcdFx0dGhpcy4kZWwuZmluZCggXCJbbmFtZT1jaGFydC1zdWJuYW1lXVwiICkudmFsKCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtc3VibmFtZVwiICkgKTtcblxuXHRcdH1cblxuXHR9KTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5Gb3JtLkJhc2ljVGFiVmlldztcblxufSkoKTtcbiIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIEFwcCA9IHJlcXVpcmUoIFwiLi8uLi8uLi9uYW1lc3BhY2VzLmpzXCIgKTtcblxuXHRBcHAuVmlld3MuRm9ybS5EZXNjcmlwdGlvblRhYlZpZXcgPSBCYWNrYm9uZS5WaWV3LmV4dGVuZCh7XG5cblx0XHRlbDogXCIjZm9ybS12aWV3ICNzb3VyY2VzLXRhYlwiLFxuXHRcdGV2ZW50czoge30sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdFxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gb3B0aW9ucy5kaXNwYXRjaGVyO1xuXHRcdFx0dmFyIHRoYXQgPSB0aGlzO1xuXG5cdFx0XHR0aGlzLiR0ZXh0QXJlYSA9IHRoaXMuJGVsLmZpbmQoIFwidGV4dGFyZWFcIiApO1xuXHRcdFx0dGhpcy4kdGV4dEFyZWEudmFsKCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtZGVzY3JpcHRpb25cIiApICk7XG5cblx0XHRcdHRoaXMuJHRleHRBcmVhLnd5c2lodG1sNSgge1xuXHRcdFx0XHRcImV2ZW50c1wiOiB7XG5cdFx0XHRcdFx0XCJjaGFuZ2VcIjogZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdFx0XHRcdHRoYXQub25Gb3JtQ29udHJvbENoYW5nZSggdGhhdC4kdGV4dEFyZWEgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHR0aGlzLnJlbmRlcigpO1xuXG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cblx0XHR9LFxuXG5cdFx0b25Gb3JtQ29udHJvbENoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dmFyIHRleHRBcmVhVmFsdWUgPSB0aGlzLiR0ZXh0QXJlYS52YWwoKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJjaGFydC1kZXNjcmlwdGlvblwiLCB0ZXh0QXJlYVZhbHVlICk7XG5cblx0XHR9XG5cblxuXHR9KTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5Gb3JtLkRlc2NyaXB0aW9uVGFiVmlldztcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBBcHAgPSByZXF1aXJlKCBcIi4vLi4vLi4vbmFtZXNwYWNlcy5qc1wiICk7XG5cblx0QXBwLlZpZXdzLkZvcm0uRXhwb3J0VGFiVmlldyA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblxuXHRcdGVsOiBcIiNmb3JtLXZpZXcgI2V4cG9ydC10YWJcIixcblx0XHRldmVudHM6IHtcblx0XHRcdFwiY2xpY2sgW3R5cGU9J2NoZWNrYm94J11cIjogXCJvblRhYnNDaGVja1wiLFxuXHRcdFx0XCJjaGFuZ2UgLmVtYmVkLXNpemUtd3JhcHBlciBpbnB1dFwiOiBcIm9uRW1iZWRTaXplQ2hhbmdlXCJcblx0XHR9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHRcblx0XHRcdHRoaXMuZGlzcGF0Y2hlciA9IG9wdGlvbnMuZGlzcGF0Y2hlcjtcblx0XHRcdHRoaXMuZGlzcGF0Y2hlci5vbiggXCJjaGFydC1zYXZlZFwiLCB0aGlzLm9uQ2hhcnRTYXZlZCwgdGhpcyApO1xuXHRcdFx0XG5cdFx0XHR0aGlzLnJlbmRlcigpO1xuXG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcblx0XHRcdHRoaXMuJGNoZWNrYm94ZXMgPSB0aGlzLiRlbC5maW5kKCBcIlt0eXBlPSdjaGVja2JveCddXCIgKTtcblx0XHRcdHRoaXMuJHdpZHRoSW5wdXQgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPSdpZnJhbWUtd2lkdGgnXVwiICk7XG5cdFx0XHR0aGlzLiRoZWlnaHRJbnB1dCA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9J2lmcmFtZS1oZWlnaHQnXVwiICk7XG5cdFx0XHR0aGlzLiRpZnJhbWVUZXh0QXJlYSA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9J2lmcmFtZSddXCIgKTtcblxuXHRcdFx0dGhpcy4kbWFwVGFiID0gJCggXCJbaHJlZj0nI21hcC10YWInXVwiICk7XG5cblx0XHRcdC8vdXBkYXRlIGxpbmUtdHlwZSBmcm9tIG1vZGVsXG5cdFx0XHR2YXIgdGhhdCA9IHRoaXMsXG5cdFx0XHRcdHRhYnMgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwidGFic1wiICk7XG5cdFx0XHRfLmVhY2goIHRhYnMsIGZ1bmN0aW9uKCB2LCBpICkge1xuXHRcdFx0XHR2YXIgJGNoZWNrYm94ID0gdGhhdC4kY2hlY2tib3hlcy5maWx0ZXIoIFwiW3ZhbHVlPSdcIiArIHYgKyBcIiddXCIgKTtcblx0XHRcdFx0JGNoZWNrYm94LnByb3AoIFwiY2hlY2tlZFwiLCB0cnVlICk7XG5cdFx0XHRcdGlmKCB2ID09PSBcIm1hcFwiICkge1xuXHRcdFx0XHRcdHRoYXQuJG1hcFRhYi5jc3MoIFwiZGlzcGxheVwiLCBcImJsb2NrXCIgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXG5cdFx0XHQvL3VwZGF0ZSBzaXplIGZyb20gbW9kZWxcblx0XHRcdHRoaXMuJHdpZHRoSW5wdXQudmFsKCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiaWZyYW1lLXdpZHRoXCIgKSApO1xuXHRcdFx0dGhpcy4kaGVpZ2h0SW5wdXQudmFsKCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiaWZyYW1lLWhlaWdodFwiICkgKTtcblxuXHRcdFx0Ly91cGRhdGUgZXhwb3J0IGNvZGUgZnJvbSBcblx0XHRcdHZhciBjaGFydElkID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImlkXCIgKTtcblx0XHRcdGlmKCBjaGFydElkICkge1xuXHRcdFx0XHR2YXIgdmlld1VybCA9IHRoaXMuJGlmcmFtZVRleHRBcmVhLmF0dHIoIFwiZGF0YS12aWV3LXVybFwiICk7XG5cdFx0XHRcdHRoaXMuZ2VuZXJhdGVJZnJhbWVDb2RlKCBjaGFydElkLCB2aWV3VXJsICk7XG5cdFx0XHR9XG5cblx0XHR9LFxuXG5cdFx0b25DaGFydFNhdmVkOiBmdW5jdGlvbiggaWQsIHZpZXdVcmwgKSB7XG5cdFx0XHR0aGlzLmdlbmVyYXRlSWZyYW1lQ29kZSggaWQsIHZpZXdVcmwgKTtcblx0XHR9LFxuXG5cdFx0b25UYWJzQ2hlY2s6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdHZhciB0aGF0ID0gdGhpcyxcblx0XHRcdFx0Y2hlY2tlZCA9IFtdO1xuXHRcdFx0JC5lYWNoKCB0aGlzLiRjaGVja2JveGVzLCBmdW5jdGlvbiggaSwgdiApIHtcblxuXHRcdFx0XHR2YXIgJGNoZWNrYm94ID0gJCggdGhpcyApO1xuXHRcdFx0XHRpZiggJGNoZWNrYm94LmlzKCBcIjpjaGVja2VkXCIgKSApIHtcblx0XHRcdFx0XHRjaGVja2VkLnB1c2goICRjaGVja2JveC52YWwoKSApO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYoICRjaGVja2JveC52YWwoKSA9PT0gXCJtYXBcIiApIHtcblx0XHRcdFx0XHRpZiggJGNoZWNrYm94LmlzKCBcIjpjaGVja2VkXCIgKSApIHtcblx0XHRcdFx0XHRcdHRoYXQuJG1hcFRhYi5jc3MoIFwiZGlzcGxheVwiLCBcImJsb2NrXCIgKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dGhhdC4kbWFwVGFiLmNzcyggXCJkaXNwbGF5XCIsIFwibm9uZVwiICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XG5cdFx0XHR9ICk7XG5cblx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJ0YWJzXCIsIGNoZWNrZWQgKTtcblxuXHRcdH0sXG5cblx0XHRvbkVtYmVkU2l6ZUNoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0XG5cdFx0XHR2YXIgJGlucHV0ID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKTtcblx0XHRcdC8vdW5uZWNlc3NhcnkgdG8gdXBkYXRlIGV2ZXJ5dGhpbmcganVzdCBiZWNhdXNlIGdlbmVyYXRlZCBjb2RlIGNoYW5nZWRcblx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggJGlucHV0LmF0dHIoIFwibmFtZVwiICksICRpbnB1dC52YWwoKSwge3NpbGVudDp0cnVlfSApO1xuXG5cdFx0XHQvL2lmIGFscmVhZHkgZ2VuZXJhdGVkIGNvZGUsIHVwZGF0ZSBpdFxuXHRcdFx0aWYoIHRoaXMuJGlmcmFtZVRleHRBcmVhLnRleHQoKSAhPSBcIlwiICkge1xuXHRcdFx0XHR0aGlzLmdlbmVyYXRlSWZyYW1lQ29kZSgpO1xuXHRcdFx0fVxuXG5cdFx0fSxcblxuXHRcdGdlbmVyYXRlSWZyYW1lQ29kZTogZnVuY3Rpb24oIGlkLCB2aWV3VXJsICkge1xuXHRcdFx0Ly9zdG9yZSB2aWV3IHVybFxuXHRcdFx0aWYoIHZpZXdVcmwgKSB7XG5cdFx0XHRcdHRoaXMudmlld1VybCA9IHZpZXdVcmw7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLiRpZnJhbWVUZXh0QXJlYS50ZXh0KCAnPGlmcmFtZSBzcmM9XCInICsgdGhpcy52aWV3VXJsICsgJ1wiIHN0eWxlPVwid2lkdGg6JyArIEFwcC5DaGFydE1vZGVsLmdldCggXCJpZnJhbWUtd2lkdGhcIiApICsgJztoZWlnaHQ6JyArIEFwcC5DaGFydE1vZGVsLmdldCggXCJpZnJhbWUtaGVpZ2h0XCIgKSArICc7IGJvcmRlcjogMHB4IG5vbmU7XCI+PC9pZnJhbWU+JyApO1xuXHRcdH1cblxuXHR9KTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5Gb3JtLkV4cG9ydFRhYlZpZXc7XG5cbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgQXBwID0gcmVxdWlyZSggXCIuLy4uLy4uL25hbWVzcGFjZXMuanNcIiApO1xuXG5cdEFwcC5WaWV3cy5Gb3JtLk1hcFRhYlZpZXcgPSBCYWNrYm9uZS5WaWV3LmV4dGVuZCh7XG5cblx0XHRlbDogXCIjZm9ybS12aWV3ICNtYXAtdGFiXCIsXG5cdFx0ZXZlbnRzOiB7XG5cdFx0XHRcImNoYW5nZSBbbmFtZT0nbWFwLXZhcmlhYmxlLWlkJ11cIjogXCJvblZhcmlhYmxlSWRDaGFuZ2VcIixcblx0XHRcdFwiY2hhbmdlIFtuYW1lPSdtYXAtdGltZS10b2xlcmFuY2UnXVwiOiBcIm9uVGltZVRvbGVyYW5jZUNoYW5nZVwiLFxuXHRcdFx0XCJjaGFuZ2UgW25hbWU9J21hcC10aW1lLWludGVydmFsJ11cIjogXCJvblRpbWVJbnRlcnZhbENoYW5nZVwiLFxuXHRcdFx0XCJjaGFuZ2UgW25hbWU9J21hcC1jb2xvci1zY2hlbWUnXVwiOiBcIm9uQ29sb3JTY2hlbWVDaGFuZ2VcIixcblx0XHRcdFwiY2hhbmdlIFtuYW1lPSdtYXAtY29sb3ItaW50ZXJ2YWwnXVwiOiBcIm9uQ29sb3JJbnRlcnZhbENoYW5nZVwiLFxuXHRcdFx0XCJjaGFuZ2UgW25hbWU9J21hcC1wcm9qZWN0aW9ucyddXCI6IFwib25Qcm9qZWN0aW9uQ2hhbmdlXCJcblx0XHR9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIgPSBvcHRpb25zLmRpc3BhdGNoZXI7XG5cblx0XHRcdEFwcC5DaGFydFZhcmlhYmxlc0NvbGxlY3Rpb24ub24oIFwiYWRkIHJlbW92ZSBjaGFuZ2UgcmVzZXRcIiwgdGhpcy5vblZhcmlhYmxlc0NvbGxlY3Rpb25DaGFuZ2UsIHRoaXMgKTtcblx0XHRcdEFwcC5BdmFpbGFibGVUaW1lTW9kZWwub24oIFwiY2hhbmdlXCIsIHRoaXMub25BdmFpbGFibGVUaW1lQ2hhbmdlLCB0aGlzICk7XG5cdFx0XHQvL0FwcC5DaGFydE1vZGVsLm9uKCBcImNoYW5nZVwiLCB0aGlzLm9uQ2hhcnRNb2RlbENoYW5nZSwgdGhpcyApO1xuXHRcdFx0XG5cdFx0XHR0aGlzLiR2YXJpYWJsZUlkU2VsZWN0ID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT0nbWFwLXZhcmlhYmxlLWlkJ11cIiApO1xuXHRcdFx0XG5cdFx0XHR0aGlzLiR0aW1lVG9sZXJhbmNlSW5wdXQgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPSdtYXAtdGltZS10b2xlcmFuY2UnXVwiICk7XG5cdFx0XHR0aGlzLiR0aW1lSW50ZXJ2YWxJbnB1dCA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9J21hcC10aW1lLWludGVydmFsJ11cIiApO1xuXHRcdFx0XG5cdFx0XHR0aGlzLiRjb2xvclNjaGVtZVNlbGVjdCA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9J21hcC1jb2xvci1zY2hlbWUnXVwiICk7XG5cdFx0XHR0aGlzLiRjb2xvckludGVydmFsU2VsZWN0ID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT0nbWFwLWNvbG9yLWludGVydmFsJ11cIiApO1xuXHRcdFx0XG5cdFx0XHR0aGlzLiRwcm9qZWN0aW9uc1NlbGVjdCA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9J21hcC1wcm9qZWN0aW9ucyddXCIgKTtcblxuXHRcdFx0Ly9tYWtlIHN1cmUgd2UgaGF2ZSBjdXJyZW50IGRhdGFcblx0XHRcdHRoaXMudXBkYXRlVGFyZ2V0WWVhciggdHJ1ZSApO1xuXG5cdFx0XHR0aGlzLnJlbmRlcigpO1xuXHRcdH0sXG5cblx0XHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFxuXHRcdFx0Ly9wb3B1bGF0ZSB2YXJpYWJsZSBzZWxlY3Qgd2l0aCB0aGUgYXZhaWxhYmxlIG9uZXNcblx0XHRcdHRoaXMuJHZhcmlhYmxlSWRTZWxlY3QuZW1wdHkoKTtcblxuXHRcdFx0dmFyIG1hcENvbmZpZyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJtYXAtY29uZmlnXCIgKTtcblx0XHRcdFx0XG5cdFx0XHR0aGlzLnVwZGF0ZVZhcmlhYmxlU2VsZWN0KCk7XG5cblx0XHRcdHRoaXMuJHRpbWVUb2xlcmFuY2VJbnB1dC52YWwoIG1hcENvbmZpZy50aW1lVG9sZXJhbmNlICk7XG5cdFx0XHR0aGlzLiR0aW1lSW50ZXJ2YWxJbnB1dC52YWwoIG1hcENvbmZpZy50aW1lSW50ZXJ2YWwgKTtcblxuXHRcdFx0dGhpcy51cGRhdGVDb2xvclNjaGVtZVNlbGVjdCgpO1xuXHRcdFx0dGhpcy51cGRhdGVDb2xvckludGVydmFsU2VsZWN0KCk7XG5cdFx0XHR0aGlzLnVwZGF0ZVByb2plY3Rpb25zU2VsZWN0KCk7XG5cblx0XHR9LFxuXG5cdFx0dXBkYXRlVmFyaWFibGVTZWxlY3Q6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHR2YXIgbWFwQ29uZmlnID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcIm1hcC1jb25maWdcIiApLFxuXHRcdFx0XHRtb2RlbHMgPSBBcHAuQ2hhcnRWYXJpYWJsZXNDb2xsZWN0aW9uLm1vZGVscyxcblx0XHRcdFx0aHRtbCA9IFwiXCI7XG5cblx0XHRcdGlmKCBtb2RlbHMgJiYgbW9kZWxzLmxlbmd0aCApIHtcblx0XHRcdFx0aHRtbCArPSBcIjxvcHRpb24gc2VsZWN0ZWQgZGlzYWJsZWQ+U2VsZWN0IHZhcmlhYmxlIHRvIGRpc3BsYXkgb24gbWFwPC9vcHRpb24+XCI7XG5cdFx0XHR9XG5cblx0XHRcdF8uZWFjaCggbW9kZWxzLCBmdW5jdGlvbiggdiwgaSApIHtcblx0XHRcdFx0Ly9pZiBubyB2YXJpYWJsZSBzZWxlY3RlZCwgdHJ5IHRvIHNlbGVjdCBmaXJzdFxuXHRcdFx0XHR2YXIgc2VsZWN0ZWQgPSAoIGkgPT0gbWFwQ29uZmlnLnZhcmlhYmxlSWQgKT8gXCIgc2VsZWN0ZWRcIjogXCJcIjtcblx0XHRcdFx0aHRtbCArPSBcIjxvcHRpb24gdmFsdWU9J1wiICsgdi5nZXQoIFwiaWRcIiApICsgXCInIFwiICsgc2VsZWN0ZWQgKyBcIj5cIiArIHYuZ2V0KCBcIm5hbWVcIiApICsgXCI8L29wdGlvbj5cIjtcblx0XHRcdH0gKTtcblxuXHRcdFx0Ly9jaGVjayBmb3IgZW1wdHkgaHRtbFxuXHRcdFx0aWYoICFodG1sICkge1xuXHRcdFx0XHRodG1sICs9IFwiPG9wdGlvbiBzZWxlY3RlZCBkaXNhYmxlZD5BZGQgc29tZSB2YXJpYWJsZXMgaW4gMi5EYXRhIHRhYiBmaXJzdDwvb3B0aW9uPlwiO1xuXHRcdFx0XHR0aGlzLiR2YXJpYWJsZUlkU2VsZWN0LmFkZENsYXNzKCBcImRpc2FibGVkXCIgKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuJHZhcmlhYmxlSWRTZWxlY3QucmVtb3ZlQ2xhc3MoIFwiZGlzYWJsZWRcIiApO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy4kdmFyaWFibGVJZFNlbGVjdC5hcHBlbmQoICQoIGh0bWwgKSApO1xuXG5cdFx0XHQvL2NoZWNrIGlmIHdlIHNob3VsZCBzZWxlY3QgZmlyc3QgdmFyaWFibGVcblx0XHRcdGlmKCBtb2RlbHMubGVuZ3RoICYmICF0aGlzLiR2YXJpYWJsZUlkU2VsZWN0LnZhbCgpICkge1xuXHRcdFx0XHR2YXIgZmlyc3RPcHRpb24gPSB0aGlzLiR2YXJpYWJsZUlkU2VsZWN0LmZpbmQoIFwib3B0aW9uXCIgKS5lcSggMSApLnZhbCgpO1xuXHRcdFx0XHR0aGlzLiR2YXJpYWJsZUlkU2VsZWN0LnZhbCggZmlyc3RPcHRpb24gKTtcblx0XHRcdFx0QXBwLkNoYXJ0TW9kZWwudXBkYXRlTWFwQ29uZmlnKCBcInZhcmlhYmxlSWRcIiwgZmlyc3RPcHRpb24gKTtcblx0XHRcdH1cblxuXHRcdH0sXG5cdFx0XG5cdFx0dXBkYXRlQ29sb3JTY2hlbWVTZWxlY3Q6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XG5cdFx0XHR2YXIgaHRtbCA9IFwiXCIsXG5cdFx0XHRcdG1hcENvbmZpZyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJtYXAtY29uZmlnXCIgKTtcblxuXHRcdFx0dGhpcy4kY29sb3JTY2hlbWVTZWxlY3QuZW1wdHkoKTtcblx0XHRcdF8uZWFjaCggY29sb3JicmV3ZXIsIGZ1bmN0aW9uKCB2LCBpICkge1xuXHRcdFx0XHR2YXIgc2VsZWN0ZWQgPSAoIGkgPT0gbWFwQ29uZmlnLmNvbG9yU2NoZW1lTmFtZSApPyBcIiBzZWxlY3RlZFwiOiBcIlwiO1xuXHRcdFx0XHRodG1sICs9IFwiPG9wdGlvbiB2YWx1ZT0nXCIgKyBpICsgXCInIFwiICsgc2VsZWN0ZWQgKyBcIj5cIiArIGkgKyBcIjwvb3B0aW9uPlwiO1xuXHRcdFx0fSApO1xuXHRcdFx0dGhpcy4kY29sb3JTY2hlbWVTZWxlY3QuYXBwZW5kKCAkKCBodG1sICkgKTtcblxuXHRcdH0sXG5cblx0XHR1cGRhdGVDb2xvckludGVydmFsU2VsZWN0OiBmdW5jdGlvbigpIHtcblx0XHRcdFxuXHRcdFx0dmFyIGh0bWwgPSBcIlwiLFxuXHRcdFx0XHRtYXBDb25maWcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwibWFwLWNvbmZpZ1wiICksXG5cdFx0XHRcdGhhc1NlbGVjdGVkID0gZmFsc2U7XG5cblx0XHRcdHRoaXMuJGNvbG9ySW50ZXJ2YWxTZWxlY3QuZW1wdHkoKTtcblx0XHRcdF8uZWFjaCggY29sb3JicmV3ZXJbICBtYXBDb25maWcuY29sb3JTY2hlbWVOYW1lIF0sIGZ1bmN0aW9uKCB2LCBpICkge1xuXHRcdFx0XHR2YXIgc2VsZWN0ZWQgPSAoIGkgPT0gbWFwQ29uZmlnLmNvbG9yU2NoZW1lSW50ZXJ2YWwgKT8gXCIgc2VsZWN0ZWRcIjogXCJcIjtcblx0XHRcdFx0aWYoIHNlbGVjdGVkID09PSBcIiBzZWxlY3RlZFwiICkge1xuXHRcdFx0XHRcdGhhc1NlbGVjdGVkID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRodG1sICs9IFwiPG9wdGlvbiB2YWx1ZT0nXCIgKyBpICsgXCInIFwiICsgc2VsZWN0ZWQgKyBcIj5cIiArIGkgKyBcIjwvb3B0aW9uPlwiO1xuXHRcdFx0fSApO1xuXHRcdFx0dGhpcy4kY29sb3JJbnRlcnZhbFNlbGVjdC5hcHBlbmQoICQoIGh0bWwgKSApO1xuXG5cdFx0XHRpZiggIWhhc1NlbGVjdGVkICkge1xuXHRcdFx0XHQvL3RoZXJlJ3Mgbm90IHNlbGVjdGVkIGludGVydmFsIHRoYXQgd291bGQgZXhpc3Qgd2l0aCBjdXJyZW50IGNvbG9yIHNjaGVtZSwgc2VsZWN0IHRoYXQgZmlyc3Rcblx0XHRcdFx0QXBwLkNoYXJ0TW9kZWwudXBkYXRlTWFwQ29uZmlnKCBcImNvbG9yU2NoZW1lSW50ZXJ2YWxcIiwgdGhpcy4kY29sb3JJbnRlcnZhbFNlbGVjdC52YWwoKSApO1xuXHRcdFx0fVxuXG5cdFx0fSxcblxuXHRcdHVwZGF0ZVByb2plY3Rpb25zU2VsZWN0OiBmdW5jdGlvbigpIHtcblx0XHRcdFxuXHRcdFx0dmFyIGh0bWwgPSBcIlwiLFxuXHRcdFx0XHRtYXBDb25maWcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwibWFwLWNvbmZpZ1wiICk7XG5cblx0XHRcdHRoaXMuJHByb2plY3Rpb25zU2VsZWN0LmVtcHR5KCk7XG5cdFx0XHRfLmVhY2goIEFwcC5WaWV3cy5DaGFydC5NYXBUYWIucHJvamVjdGlvbnMsIGZ1bmN0aW9uKCB2LCBpICkge1xuXHRcdFx0XHR2YXIgc2VsZWN0ZWQgPSAoIGkgPT0gbWFwQ29uZmlnLnByb2plY3Rpb25zICk/IFwiIHNlbGVjdGVkXCI6IFwiXCI7XG5cdFx0XHRcdGh0bWwgKz0gXCI8b3B0aW9uIHZhbHVlPSdcIiArIGkgKyBcIicgXCIgKyBzZWxlY3RlZCArIFwiPlwiICsgaSArIFwiPC9vcHRpb24+XCI7XG5cdFx0XHR9ICk7XG5cdFx0XHR0aGlzLiRwcm9qZWN0aW9uc1NlbGVjdC5hcHBlbmQoICQoIGh0bWwgKSApO1xuXG5cdFx0fSxcblxuXHRcdHVwZGF0ZVRhcmdldFllYXI6IGZ1bmN0aW9uKCBzaWxlbnQgKSB7XG5cdFx0XHR2YXIgY2hhcnRUaW1lID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcImNoYXJ0LXRpbWVcIiApLFxuXHRcdFx0XHR0YXJnZXRZZWFyID0gKCBjaGFydFRpbWUgKT8gY2hhcnRUaW1lWzBdOiBBcHAuQXZhaWxhYmxlVGltZU1vZGVsLmdldCggXCJtaW5cIiApLFxuXHRcdFx0XHRtaW5ZZWFyID0gdGFyZ2V0WWVhcixcblx0XHRcdFx0bWF4WWVhciA9ICggY2hhcnRUaW1lICk/IGNoYXJ0VGltZVsxXTogQXBwLkF2YWlsYWJsZVRpbWVNb2RlbC5nZXQoIFwibWF4XCIgKTtcblxuXHRcdFx0QXBwLkNoYXJ0TW9kZWwudXBkYXRlTWFwQ29uZmlnKCBcIm1pblllYXJcIiwgbWluWWVhciwgdHJ1ZSApO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwudXBkYXRlTWFwQ29uZmlnKCBcIm1heFllYXJcIiwgbWF4WWVhciwgdHJ1ZSApO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwudXBkYXRlTWFwQ29uZmlnKCBcInRhcmdldFllYXJcIiwgdGFyZ2V0WWVhciwgc2lsZW50ICk7XG5cdFx0fSxcblxuXHRcdG9uVmFyaWFibGVzQ29sbGVjdGlvbkNoYW5nZTogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLnJlbmRlcigpO1xuXHRcdH0sXG5cblx0XHRvblZhcmlhYmxlSWRDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHR2YXIgJHRoaXMgPSAkKCBldnQudGFyZ2V0ICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC51cGRhdGVNYXBDb25maWcoIFwidmFyaWFibGVJZFwiLCAkdGhpcy52YWwoKSApO1xuXHRcdH0sXG5cblx0XHRvblRpbWVUb2xlcmFuY2VDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHR2YXIgJHRoaXMgPSAkKCBldnQudGFyZ2V0ICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC51cGRhdGVNYXBDb25maWcoIFwidGltZVRvbGVyYW5jZVwiLCBwYXJzZUludCggJHRoaXMudmFsKCksIDEwICkgKTtcblx0XHR9LFxuXG5cdFx0b25UaW1lSW50ZXJ2YWxDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHR2YXIgJHRoaXMgPSAkKCBldnQudGFyZ2V0ICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC51cGRhdGVNYXBDb25maWcoIFwidGltZUludGVydmFsXCIsIHBhcnNlSW50KCAkdGhpcy52YWwoKSwgMTAgKSApO1xuXHRcdH0sXG5cblx0XHRvbkNvbG9yU2NoZW1lQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0dmFyICR0aGlzID0gJCggZXZ0LnRhcmdldCApO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwudXBkYXRlTWFwQ29uZmlnKCBcImNvbG9yU2NoZW1lTmFtZVwiLCAkdGhpcy52YWwoKSApO1xuXHRcdFx0Ly9uZWVkIHRvIHVwZGF0ZSBudW1iZXIgb2YgY2xhc3Nlc1xuXHRcdFx0dGhpcy51cGRhdGVDb2xvckludGVydmFsU2VsZWN0KCk7XG5cdFx0fSxcblxuXHRcdG9uQ29sb3JJbnRlcnZhbENoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdHZhciAkdGhpcyA9ICQoIGV2dC50YXJnZXQgKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnVwZGF0ZU1hcENvbmZpZyggXCJjb2xvclNjaGVtZUludGVydmFsXCIsIHBhcnNlSW50KCAkdGhpcy52YWwoKSwgMTAgKSApO1xuXHRcdH0sXG5cblx0XHRvblByb2plY3Rpb25DaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHR2YXIgJHRoaXMgPSAkKCBldnQudGFyZ2V0ICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC51cGRhdGVNYXBDb25maWcoIFwicHJvamVjdGlvblwiLCAkdGhpcy52YWwoKSApO1xuXHRcdH0sXG5cblx0XHRvbkNoYXJ0TW9kZWxDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHR0aGlzLnVwZGF0ZVRhcmdldFllYXIoIHRydWUgKTtcblx0XHR9LFxuXG5cdFx0b25BdmFpbGFibGVUaW1lQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXHRcdFx0dGhpcy51cGRhdGVUYXJnZXRZZWFyKCBmYWxzZSApO1xuXHRcdH1cblxuXHR9KTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5Gb3JtLk1hcFRhYlZpZXc7XG5cbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgQXBwID0gcmVxdWlyZSggXCIuLy4uLy4uL25hbWVzcGFjZXMuanNcIiApO1xuXG5cdEFwcC5WaWV3cy5Gb3JtLlN0eWxpbmdUYWJWaWV3ID0gQmFja2JvbmUuVmlldy5leHRlbmQoe1xuXG5cdFx0ZWw6IFwiI2Zvcm0tdmlldyAjc3R5bGluZy10YWJcIixcblx0XHRldmVudHM6IHtcblx0XHRcdFwiY2hhbmdlIFtuYW1lPSdsaW5lLXR5cGUnXVwiOiBcIm9uTGluZVR5cGVDaGFuZ2VcIixcblx0XHRcdFwiY2hhbmdlIFtuYW1lXj0nbWFyZ2luLSddXCI6IFwib25NYXJnaW5DaGFuZ2VcIixcblx0XHRcdFwiY2hhbmdlIFtuYW1lPSdoaWRlLWxlZ2VuZCddXCI6IFwib25IaWRlTGVnZW5kQ2hhbmdlXCJcblx0XHR9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHRcblx0XHRcdHRoaXMuZGlzcGF0Y2hlciA9IG9wdGlvbnMuZGlzcGF0Y2hlcjtcblx0XHRcdFxuXHRcdFx0dGhpcy4kbGluZVR5cGVSYWRpb3MgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPSdsaW5lLXR5cGUnXVwiICk7XG5cdFx0XHRcblx0XHRcdC8vbWFyZ2luc1xuXHRcdFx0dGhpcy4kbWFyZ2luVG9wID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT0nbWFyZ2luLXRvcCddXCIgKTtcblx0XHRcdHRoaXMuJG1hcmdpbkxlZnQgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPSdtYXJnaW4tbGVmdCddXCIgKTtcblx0XHRcdHRoaXMuJG1hcmdpblJpZ2h0ID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT0nbWFyZ2luLXJpZ2h0J11cIiApO1xuXHRcdFx0dGhpcy4kbWFyZ2luQm90dG9tID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT0nbWFyZ2luLWJvdHRvbSddXCIgKTtcblx0XHRcdFxuXHRcdFx0Ly9sZWdlbmRcblx0XHRcdHRoaXMuJGhpZGVMZWdlbmQgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPSdoaWRlLWxlZ2VuZCddXCIgKTtcblxuXHRcdFx0Ly91bml0c1xuXHRcdFx0dGhpcy4kdW5pdHNTZWN0aW9uID0gdGhpcy4kZWwuZmluZCggXCIudW5pdHMtc2VjdGlvblwiICk7XG5cdFx0XHR0aGlzLiR1bml0c0NvbnRlbnQgPSB0aGlzLiR1bml0c1NlY3Rpb24uZmluZCggXCIuZm9ybS1zZWN0aW9uLWNvbnRlbnRcIiApO1xuXHRcdFx0XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5vbiggXCJjaGFuZ2U6Y2hhcnQtdHlwZVwiLCB0aGlzLm9uQ2hhcnRUeXBlQ2hhbmdlLCB0aGlzICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5vbiggXCJjaGFuZ2U6Y2hhcnQtZGltZW5zaW9uc1wiLCB0aGlzLnJlbmRlciwgdGhpcyApO1xuXHRcdFx0XG5cdFx0XHR0aGlzLnJlbmRlcigpO1xuXG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cblx0XHRcdHZhciBsaW5lVHlwZSA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJsaW5lLXR5cGVcIiApO1xuXHRcdFx0dGhpcy4kbGluZVR5cGVSYWRpb3MuZmlsdGVyKCBcIlt2YWx1ZT0nXCIgKyBsaW5lVHlwZSArIFwiJ11cIiApLnByb3AoIFwiY2hlY2tlZFwiLCB0cnVlICk7XG5cblx0XHRcdHZhciBtYXJnaW5zID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcIm1hcmdpbnNcIiApO1xuXHRcdFx0dGhpcy4kbWFyZ2luVG9wLnZhbCggbWFyZ2lucy50b3AgKTtcblx0XHRcdHRoaXMuJG1hcmdpbkxlZnQudmFsKCBtYXJnaW5zLmxlZnQgKTtcblx0XHRcdHRoaXMuJG1hcmdpblJpZ2h0LnZhbCggbWFyZ2lucy5yaWdodCApO1xuXHRcdFx0dGhpcy4kbWFyZ2luQm90dG9tLnZhbCggbWFyZ2lucy5ib3R0b20gKTtcblxuXHRcdFx0dmFyIGhpZGVMZWdlbmQgPSAoIEFwcC5DaGFydE1vZGVsLmdldCggXCJoaWRlLWxlZ2VuZFwiICkgKT8gdHJ1ZTogZmFsc2U7XG5cdFx0XHR0aGlzLiRoaWRlTGVnZW5kLnByb3AoIFwiY2hlY2tlZFwiLCBoaWRlTGVnZW5kICk7XG5cblx0XHRcdHRoaXMudXBkYXRlVW5pdHNVSSgpO1xuXHRcdFx0JCggXCIudW5pdHMtc2VjdGlvbiAuZm9ybS1jb250cm9sW3R5cGU9aW5wdXRdLCAudW5pdHMtc2VjdGlvbiBbdHlwZT1jaGVja2JveF1cIiApLm9uKCBcImNoYW5nZVwiLCAkLnByb3h5KCB0aGlzLnVwZGF0ZVVuaXRzLCB0aGlzICkgKTtcblx0XHRcblx0XHR9LFxuXG5cdFx0b25MaW5lVHlwZUNoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dmFyICRyYWRpbyA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5zZXQoIFwibGluZS10eXBlXCIsICRyYWRpby52YWwoKSApO1xuXG5cdFx0fSxcblxuXHRcdG9uTWFyZ2luQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHR2YXIgJGNvbnRyb2wgPSAkKCBldnQuY3VycmVudFRhcmdldCApLFxuXHRcdFx0XHRjb250cm9sTmFtZSA9ICRjb250cm9sLmF0dHIoIFwibmFtZVwiICksXG5cdFx0XHRcdG1hcmdpbnNPYmogPSB7IHRvcDogdGhpcy4kbWFyZ2luVG9wLnZhbCgpLFxuXHRcdFx0XHRcdFx0XHRsZWZ0OiB0aGlzLiRtYXJnaW5MZWZ0LnZhbCgpLFxuXHRcdFx0XHRcdFx0XHRyaWdodDogdGhpcy4kbWFyZ2luUmlnaHQudmFsKCksXG5cdFx0XHRcdFx0XHRcdGJvdHRvbTogdGhpcy4kbWFyZ2luQm90dG9tLnZhbCgpIH07XG5cblx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJtYXJnaW5zXCIsIG1hcmdpbnNPYmogKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnRyaWdnZXIoIFwidXBkYXRlXCIgKTtcblxuXHRcdH0sXG5cblx0XHRvblVuaXRDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHR2YXIgJGNvbnRyb2wgPSAkKCBldnQuY3VycmVudFRhcmdldCApO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0KCBcInVuaXRcIiwgJGNvbnRyb2wudmFsKCkgKTtcblx0XHR9LFxuXG5cdFx0b25IaWRlTGVnZW5kQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHR2YXIgJGNoZWNrID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKSxcblx0XHRcdFx0aGlkZUxlZ2VuZCA9ICggJGNoZWNrLmlzKCBcIjpjaGVja2VkXCIgKSApPyB0cnVlOiBmYWxzZTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJoaWRlLWxlZ2VuZFwiLCBoaWRlTGVnZW5kICk7XG5cblx0XHR9LFxuXG5cdFx0b25DaGFydFR5cGVDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdGlmKCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdHlwZVwiICkgPT09IFwiMlwiICkge1xuXHRcdFx0XHQvL3NjYXR0ZXIgcGxvdCBoYXMgbGVnZW5kIGhpZGRlbiBieSBkZWZhdWx0XG5cdFx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJoaWRlLWxlZ2VuZFwiLCB0cnVlICk7XG5cdFx0XHR9XG5cblx0XHR9LFxuXG5cdFx0dXBkYXRlVW5pdHNVSTogZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdFxuXHRcdFx0dmFyIGRpbWVuc2lvbnNTdHJpbmcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtZGltZW5zaW9uc1wiICksIC8vQXBwLkNoYXJ0RGltZW5zaW9uc01vZGVsLmdldCggXCJjaGFydERpbWVuc2lvbnNcIiApLFxuXHRcdFx0XHRkaW1lbnNpb25zID0gKCAhJC5pc0VtcHR5T2JqZWN0KCBkaW1lbnNpb25zU3RyaW5nICkgKT8gJC5wYXJzZUpTT04oIGRpbWVuc2lvbnNTdHJpbmcgKToge30sXG5cdFx0XHRcdHVuaXRzU3RyaW5nID0gQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcInVuaXRzXCIgKSxcblx0XHRcdFx0dW5pdHMgPSAoICEkLmlzRW1wdHlPYmplY3QoIHVuaXRzU3RyaW5nICkgKT8gJC5wYXJzZUpTT04oIHVuaXRzU3RyaW5nICk6IHt9O1xuXHRcdFx0XG5cdFx0XHQvL3JlZnJlc2ggd2hvbGUgdW5pdCBzZWN0aW9uXG5cdFx0XHR0aGlzLiR1bml0c0NvbnRlbnQuaHRtbCggXCI8dWw+PC91bD5cIiApO1xuXHRcdFx0dmFyICR1bCA9IHRoaXMuJHVuaXRzQ29udGVudC5maW5kKCBcInVsXCIgKTtcblxuXHRcdFx0aWYoIGRpbWVuc2lvbnMgKSB7XG5cblx0XHRcdFx0JC5lYWNoKCBkaW1lbnNpb25zLCBmdW5jdGlvbiggaSwgdiApIHtcblxuXHRcdFx0XHRcdHZhciBkaW1lbnNpb24gPSB2LFxuXHRcdFx0XHRcdFx0dW5pdE9iaiA9IF8uZmluZFdoZXJlKCB1bml0cywgeyBcInByb3BlcnR5XCI6IGRpbWVuc2lvbi5wcm9wZXJ0eSB9ICksXG5cdFx0XHRcdFx0XHQvL2J5IGRlZmF1bHQgdmlzaWJsZVxuXHRcdFx0XHRcdFx0dmlzaWJsZSA9ICggdW5pdE9iaiAmJiB1bml0T2JqLmhhc093blByb3BlcnR5KCBcInZpc2libGVcIiApICApPyB1bml0T2JqLnZpc2libGU6IHRydWUsXG5cdFx0XHRcdFx0XHR2aXNpYmxlUHJvcCA9ICggdmlzaWJsZSApPyBcIiBjaGVja2VkXCI6IFwiXCIsXG5cdFx0XHRcdFx0XHR1bml0ID0gKCB1bml0T2JqICYmIHVuaXRPYmoudW5pdCApPyB1bml0T2JqLnVuaXQ6IFwiXCIsXG5cdFx0XHRcdFx0XHRmb3JtYXQgPSAoIHVuaXRPYmogJiYgdW5pdE9iai5mb3JtYXQgKT8gdW5pdE9iai5mb3JtYXQ6IFwiXCI7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0aWYoICF1bml0T2JqICYmIGRpbWVuc2lvbiAmJiBkaW1lbnNpb24udW5pdCApIHtcblx0XHRcdFx0XHRcdC8vaWYgbm90aGluZyBzdG9yZWQsIHRyeSB0byBnZXQgZGVmYXVsdCB1bml0cyBmb3IgZ2l2ZW4gdmFyaWFibGVcblx0XHRcdFx0XHRcdHVuaXQgPSBkaW1lbnNpb24udW5pdDtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR2YXIgJGxpID0gJCggXCI8bGkgZGF0YS1wcm9wZXJ0eT0nXCIgKyBkaW1lbnNpb24ucHJvcGVydHkgKyBcIic+PGxhYmVsPlwiICsgZGltZW5zaW9uLm5hbWUgKyBcIjo8L2xhYmVsPlZpc2libGU6PGlucHV0IHR5cGU9J2NoZWNrYm94JyBjbGFzcz0ndmlzaWJsZS1pbnB1dCcgXCIgKyB2aXNpYmxlUHJvcCArIFwiLz48aW5wdXQgdHlwZT0naW5wdXQnIGNsYXNzPSdmb3JtLWNvbnRyb2wgdW5pdC1pbnB1dCcgdmFsdWU9J1wiICsgdW5pdCArIFwiJyBwbGFjZWhvbGRlcj0nVW5pdCcgLz48aW5wdXQgdHlwZT0naW5wdXQnIGNsYXNzPSdmb3JtLWNvbnRyb2wgZm9ybWF0LWlucHV0JyB2YWx1ZT0nXCIgKyBmb3JtYXQgKyBcIicgcGxhY2Vob2xkZXI9J05vIG9mIGRlYy4gcGxhY2VzJyAvPjwvbGk+XCIgKTtcblx0XHRcdFx0XHQkdWwuYXBwZW5kKCAkbGkgKTtcblxuXHRcdFx0XHR9ICk7XG5cblx0XHRcdH1cblx0XHRcdFxuXHRcdH0sXG5cblx0XHR1cGRhdGVVbml0czogZnVuY3Rpb24oKSB7XG5cdFx0XHRcblx0XHRcdHZhciB1bml0cyA9IFtdLFxuXHRcdFx0XHQkdW5pdExpcyA9IHRoaXMuJHVuaXRzQ29udGVudC5maW5kKCBcImxpXCIgKTtcblxuXHRcdFx0JC5lYWNoKCAkdW5pdExpcywgZnVuY3Rpb24oIGksIHYgKSB7XG5cdFx0XHRcdFxuXHRcdFx0XHR2YXIgJGxpID0gJCggdiApLFxuXHRcdFx0XHRcdCR2aXNpYmxlID0gJGxpLmZpbmQoIFwiLnZpc2libGUtaW5wdXRcIiApLFxuXHRcdFx0XHRcdCR1bml0ID0gJGxpLmZpbmQoIFwiLnVuaXQtaW5wdXRcIiApLFxuXHRcdFx0XHRcdCRmb3JtYXQgPSAkbGkuZmluZCggXCIuZm9ybWF0LWlucHV0XCIgKTtcblxuXHRcdFx0XHQvL2ZvciBlYWNoIGxpIHdpdGggdW5pdCBpbmZvcm1hdGlvbiwgY29uc3RydWN0IG9iamVjdCB3aXRoIHByb3BlcnR5LCB1bml0IGFuZCBmb3JtYXQgcHJvcGVydGllc1xuXHRcdFx0XHR2YXIgdW5pdFNldHRpbmdzID0ge1xuXHRcdFx0XHRcdFwicHJvcGVydHlcIjogJGxpLmF0dHIoIFwiZGF0YS1wcm9wZXJ0eVwiICksXG5cdFx0XHRcdFx0XCJ2aXNpYmxlXCI6ICR2aXNpYmxlLmlzKCBcIjpjaGVja2VkXCIgKSxcblx0XHRcdFx0XHRcInVuaXRcIjogJHVuaXQudmFsKCksXG5cdFx0XHRcdFx0XCJmb3JtYXRcIjogJGZvcm1hdC52YWwoKVxuXHRcdFx0XHR9O1xuXHRcdFx0XHRcdFxuXHRcdFx0XHR1bml0cy5wdXNoKCB1bml0U2V0dGluZ3MgKTtcblxuXHRcdFx0fSApO1xuXG5cdFx0XHR2YXIganNvbiA9IEpTT04uc3RyaW5naWZ5KCB1bml0cyApO1xuXHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0KCBcInVuaXRzXCIsIGpzb24gKTtcblx0XHRcdFxuXHRcdH1cblxuXHR9KTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5Gb3JtLlN0eWxpbmdUYWJWaWV3O1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIEFwcCA9IHJlcXVpcmUoIFwiLi8uLi8uLi8uLi9uYW1lc3BhY2VzLmpzXCIgKTtcblxuXHRBcHAuVmlld3MuRm9ybS5DaGFydFR5cGVTZWN0aW9uVmlldyA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblxuXHRcdGVsOiBcIiNmb3JtLXZpZXcgI2Jhc2ljLXRhYiAuY2hhcnQtdHlwZS1zZWN0aW9uXCIsXG5cdFx0ZXZlbnRzOiB7XG5cdFx0XHRcImNoYW5nZSBbbmFtZT0nY2hhcnQtdHlwZSddXCI6IFwib25DaGFydFR5cGVDaGFuZ2VcIixcblx0XHR9LFxuXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHRcblx0XHRcdHRoaXMuZGlzcGF0Y2hlciA9IG9wdGlvbnMuZGlzcGF0Y2hlcjtcblx0XHRcdEFwcC5DaGFydERpbWVuc2lvbnNNb2RlbC5vbiggXCJjaGFuZ2VcIiwgdGhpcy5yZW5kZXIsIHRoaXMgKTtcblx0XHRcdHRoaXMucmVuZGVyKCk7XG5cblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdHZhciAkc2VsZWN0ID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT0nY2hhcnQtdHlwZSddXCIgKSxcblx0XHRcdFx0c2VsZWN0ZWRDaGFydFR5cGUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdHlwZVwiICk7XG5cdFx0XHRpZiggc2VsZWN0ZWRDaGFydFR5cGUgKSB7XG5cdFx0XHRcdCRzZWxlY3QudmFsKCBzZWxlY3RlZENoYXJ0VHlwZSApO1xuXHRcdFx0fVxuXHRcdH0sXG5cblx0XHRvbkNoYXJ0VHlwZUNoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0Ly9jbGVhciB1ZiBzb21ldGhpbmcgcHJldmlvdXNseSBzZWxlY3RlZFxuXHRcdFx0QXBwLkNoYXJ0TW9kZWwudW5zZXQoIFwidmFyaWFibGVzXCIsIHtzaWxlbnQ6dHJ1ZX0gKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnVuc2V0KCBcImNoYXJ0LWRpbWVuc2lvbnNcIiwge3NpbGVudDp0cnVlfSApO1xuXG5cdFx0XHR2YXIgJHNlbGVjdCA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5zZXQoIFwiY2hhcnQtdHlwZVwiLCAkc2VsZWN0LnZhbCgpICk7XG5cblx0XHRcdEFwcC5DaGFydERpbWVuc2lvbnNNb2RlbC5sb2FkQ29uZmlndXJhdGlvbiggJHNlbGVjdC52YWwoKSApO1xuXG5cdFx0fVxuXG5cdH0pO1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkZvcm0uQ2hhcnRUeXBlU2VjdGlvblZpZXc7XG5cbn0pKCk7IiwiOyggZnVuY3Rpb24oKSB7XG5cdFxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgQXBwID0gcmVxdWlyZSggXCIuLy4uLy4uLy4uL25hbWVzcGFjZXMuanNcIiApLFxuXHRcdFNlbGVjdFZhclBvcHVwID0gcmVxdWlyZSggXCIuLy4uLy4uL3VpL0FwcC5WaWV3cy5VSS5TZWxlY3RWYXJQb3B1cC5qc1wiICksXG5cdFx0U2V0dGluZ3NWYXJQb3B1cCA9IHJlcXVpcmUoIFwiLi8uLi8uLi91aS9BcHAuVmlld3MuVUkuU2V0dGluZ3NWYXJQb3B1cC5qc1wiICk7XG5cblx0QXBwLlZpZXdzLkZvcm0uQWRkRGF0YVNlY3Rpb25WaWV3ID0gQmFja2JvbmUuVmlldy5leHRlbmQoe1xuXG5cdFx0ZWw6IFwiI2Zvcm0tdmlldyAjZGF0YS10YWIgLmFkZC1kYXRhLXNlY3Rpb25cIixcblx0XHRldmVudHM6IHtcblx0XHRcdFwiY2xpY2sgLmFkZC1kYXRhLWJ0blwiOiBcIm9uQWRkRGF0YUJ0blwiLFxuXHRcdH0sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdFxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gb3B0aW9ucy5kaXNwYXRjaGVyO1xuXG5cdFx0XHR0aGlzLnNlbGVjdFZhclBvcHVwID0gbmV3IFNlbGVjdFZhclBvcHVwKCk7XG5cdFx0XHR0aGlzLnNlbGVjdFZhclBvcHVwLmluaXQoIG9wdGlvbnMgKTtcblxuXHRcdFx0dGhpcy5zZXR0aW5nc1ZhclBvcHVwID0gbmV3IFNldHRpbmdzVmFyUG9wdXAoKTtcblx0XHRcdHRoaXMuc2V0dGluZ3NWYXJQb3B1cC5pbml0KCBvcHRpb25zICk7XG5cblx0XHRcdEFwcC5DaGFydFZhcmlhYmxlc0NvbGxlY3Rpb24ub24oIFwicmVzZXRcIiwgdGhpcy5vblZhcmlhYmxlUmVzZXQsIHRoaXMgKTtcblx0XHRcdEFwcC5DaGFydFZhcmlhYmxlc0NvbGxlY3Rpb24ub24oIFwiYWRkXCIsIHRoaXMub25WYXJpYWJsZUFkZCwgdGhpcyApO1xuXHRcdFx0QXBwLkNoYXJ0VmFyaWFibGVzQ29sbGVjdGlvbi5vbiggXCJyZW1vdmVcIiwgdGhpcy5vblZhcmlhYmxlUmVtb3ZlLCB0aGlzICk7XG5cblx0XHRcdHRoaXMuZGlzcGF0Y2hlci5vbiggXCJ2YXJpYWJsZS1sYWJlbC1tb3ZlZFwiLCB0aGlzLm9uVmFyaWFibGVMYWJlbE1vdmVkLCB0aGlzICk7XG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIub24oIFwiZGltZW5zaW9uLXNldHRpbmctdXBkYXRlXCIsIHRoaXMub25EaW1lbnNpb25TZXR0aW5nVXBkYXRlLCB0aGlzICk7XG5cblx0XHRcdHRoaXMucmVuZGVyKCk7XG5cblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblxuXHRcdFx0dGhpcy4kZGQgPSB0aGlzLiRlbC5maW5kKCBcIi5kZFwiICk7XG5cdFx0XHR0aGlzLiRkZExpc3QgPSB0aGlzLiRkZC5maW5kKCBcIi5kZC1saXN0XCIgKTtcblx0XHRcdHRoaXMuJGRkLm5lc3RhYmxlKCk7XG5cblx0XHRcdHRoaXMub25WYXJpYWJsZVJlc2V0KCk7XG5cblx0XHR9LFxuXG5cdFx0cmVmcmVzaEhhbmRsZXJzOiBmdW5jdGlvbigpIHtcblx0XHRcdHZhciAkcmVtb3ZlQnRucyA9IHRoaXMuJGRkTGlzdC5maW5kKCBcIi5mYS1jbG9zZVwiICk7XG5cdFx0XHQkcmVtb3ZlQnRucy5vbiggXCJjbGlja1wiLCAkLnByb3h5KCB0aGlzLm9uUmVtb3ZlQnRuQ2xpY2ssIHRoaXMgKSApO1xuXHRcdFx0dGhpcy4kZGQubmVzdGFibGUoKTtcblx0XHR9LFxuXG5cdFx0b25BZGREYXRhQnRuOiBmdW5jdGlvbigpIHtcblxuXHRcdFx0dGhpcy5zZWxlY3RWYXJQb3B1cC5zaG93KCk7XG5cblx0XHR9LFxuXG5cdFx0b25WYXJpYWJsZVJlc2V0OiBmdW5jdGlvbigpIHtcblxuXHRcdFx0dmFyIHRoYXQgPSB0aGlzLFxuXHRcdFx0XHRtb2RlbHMgPSBBcHAuQ2hhcnRWYXJpYWJsZXNDb2xsZWN0aW9uLm1vZGVscztcblx0XHRcdF8uZWFjaCggbW9kZWxzLCBmdW5jdGlvbiggdiwgaSApIHtcblx0XHRcdFx0dGhhdC5vblZhcmlhYmxlQWRkKCB2ICk7XG5cdFx0XHR9ICk7XG5cblx0XHR9LFxuXG5cdFx0b25WYXJpYWJsZUFkZDogZnVuY3Rpb24oIG1vZGVsICkge1xuXG5cdFx0XHQvL2lmIHRoZXJlJ3MgZW1wdHkgZWxlbWVudCwgcmVtb3ZlIGl0XG5cdFx0XHR0aGlzLiRlbC5maW5kKCBcIi5kZC1lbXB0eVwiICkucmVtb3ZlKCk7XG5cdFx0XHQvL3JlZmV0Y2ggZGQtbGlzdCAtIG5lZWRlZCBpZiB0aGVyZSB3YXMgc29tZXRoaW5nIHJlbW92ZWRcblx0XHRcdHRoaXMuJGRkTGlzdCA9IHRoaXMuJGRkLmZpbmQoIFwiLmRkLWxpc3RcIiApO1xuXG5cdFx0XHRpZiggIXRoaXMuJGRkLmZpbmQoIFwiLmRkLWxpc3RcIiApLmxlbmd0aCApIHtcblx0XHRcdFx0Ly9kZC1saXN0IGhhcyBiZWVuIHJlbW92ZWQgYnkgbmVzdGFibGVcblx0XHRcdFx0dmFyICRkZExpc3QgPSAkKCBcIjxvbCBjbGFzcz0nZGQtbGlzdCc+PC9vbD5cIiApO1xuXHRcdFx0XHR0aGlzLiRkZC5hcHBlbmQoICRkZExpc3QgKTtcblx0XHRcdFx0dGhpcy4kZGRMaXN0ID0gdGhpcy4kZGQuZmluZCggXCIuZGQtbGlzdFwiICk7XG5cdFx0XHR9XG5cblx0XHRcdC8vaGF2ZSBkZWZhdWx0IHRhcmdldCB5ZWFyIGZvciBzY2F0dGVyIHBsb3Rcblx0XHRcdHZhciBkZWZhdWx0UGVyaW9kID0gKCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdHlwZVwiICkgPT09IFwiMlwiICk/IFwic2luZ2xlXCI6IFwiYWxsXCIsXG5cdFx0XHRcdGRlZmF1bHRNb2RlID0gKCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdHlwZVwiICkgPT09IFwiMlwiICk/IFwic3BlY2lmaWNcIjogXCJjbG9zZXN0XCIsXG5cdFx0XHRcdGRlZmF1bHRUYXJnZXRZZWFyID0gMjAwMCxcblx0XHRcdFx0ZGVmYXVsdE1heEFnZSA9IDUsXG5cdFx0XHRcdGRlZmF1bHRUb2xlcmFuY2UgPSA1O1xuXG5cdFx0XHR2YXIgJGxpID0gJCggXCI8bGkgY2xhc3M9J3ZhcmlhYmxlLWxhYmVsIGRkLWl0ZW0nIGRhdGEtdW5pdD0nXCIgKyBtb2RlbC5nZXQoIFwidW5pdFwiICkgKyBcIicgZGF0YS1wZXJpb2Q9J1wiICsgZGVmYXVsdFBlcmlvZCArIFwiJyBkYXRhLXRvbGVyYW5jZT0nXCIgKyBkZWZhdWx0VG9sZXJhbmNlICsgXCInIGRhdGEtbWF4aW11bS1hZ2U9J1wiICsgZGVmYXVsdE1heEFnZSArIFwiJyBkYXRhLW1vZGU9J1wiICsgZGVmYXVsdE1vZGUgKyBcIicgZGF0YS10YXJnZXQteWVhcj0nXCIgKyBkZWZhdWx0VGFyZ2V0WWVhciArIFwiJyBkYXRhLXZhcmlhYmxlLWlkPSdcIiArIG1vZGVsLmdldCggXCJpZFwiICkgKyBcIic+PGRpdiBjbGFzcz0nZGQtaGFuZGxlJz48ZGl2IGNsYXNzPSdkZC1pbm5lci1oYW5kbGUnPjxzcGFuIGNsYXNzPSd2YXJpYWJsZS1sYWJlbC1uYW1lJz5cIiArIG1vZGVsLmdldCggXCJuYW1lXCIgKSArIFwiPC9zcGFuPjxzcGFuIGNsYXNzPSd2YXJpYWJsZS1sYWJlbC1pbnB1dCc+PGlucHV0IGNsYXNzPSdmb3JtLWNvbnRyb2wnLz48aSBjbGFzcz0nZmEgZmEtY2hlY2snPjwvaT48aSBjbGFzcz0nZmEgZmEtdGltZXMnPjwvaT48L2Rpdj48L2Rpdj48YSBocmVmPScnIGNsYXNzPSd2YXJpYWJsZS1zZXR0aW5nLWJ0bic+PHNwYW4gY2xhc3M9J2ZhIHBlcmlvZC1pY29uJz48L3NwYW4+PHNwYW4gY2xhc3M9J251bWJlci1pY29uJz48L3NwYW4+PHNwYW4gY2xhc3M9J2ZhIGZhLWNvZycgdGl0bGU9J1NldHRpbmcgdmFyaWFibGUnPjwvc3Bhbj48L2E+PHNwYW4gY2xhc3M9J2ZhIGZhLWNsb3NlJz48L3NwYW4+PC9saT5cIiApLFxuXHRcdFx0XHQkc2V0dGluZ3MgPSAkbGkuZmluZCggXCIudmFyaWFibGUtc2V0dGluZy1idG5cIiApO1xuXHRcdFx0dGhpcy4kZGRMaXN0LmFwcGVuZCggJGxpICk7XG5cdFx0XHRcblx0XHRcdCRzZXR0aW5ncy5vbiggXCJjbGlja1wiLCAkLnByb3h5KCB0aGlzLm9uU2V0dGluZ3NDbGljaywgdGhpcyApICk7XG5cdFx0XHRcblx0XHRcdHZhciAkdmFyaWFibGVMYWJlbE5hbWUgPSAkbGkuZmluZCggXCIudmFyaWFibGUtbGFiZWwtbmFtZVwiICksXG5cdFx0XHRcdCR2YXJpYWJsZUxhYmVsSW5wdXQgPSAkbGkuZmluZCggXCIudmFyaWFibGUtbGFiZWwtaW5wdXQgaW5wdXRcIiApLFxuXHRcdFx0XHQkY29uZmlybU5hbWVCdG4gPSAkbGkuZmluZCggXCIuZmEtY2hlY2tcIiApLFxuXHRcdFx0XHQkY2FuY2VsTmFtZUJ0biA9ICRsaS5maW5kKCBcIi5mYS10aW1lc1wiICk7XG5cblx0XHRcdCR2YXJpYWJsZUxhYmVsTmFtZS5vbiggXCJtb3VzZWRvd25cIiwgJC5wcm94eSggdGhpcy5vblZhcmlhYmxlTmFtZUNsaWNrLCB0aGlzICkgKTtcblx0XHRcdCRjb25maXJtTmFtZUJ0bi5vbiggXCJtb3VzZWRvd25cIiwgJC5wcm94eSggdGhpcy5vbk5hbWVCdG5DbGljaywgdGhpcyApICk7XG5cdFx0XHQkY2FuY2VsTmFtZUJ0bi5vbiggXCJtb3VzZWRvd25cIiwgJC5wcm94eSggdGhpcy5vbk5hbWVCdG5DbGljaywgdGhpcyApICk7XG5cdFx0XHQkdmFyaWFibGVMYWJlbElucHV0Lm9uKCBcIm1vdXNlZG93blwiLCAkLnByb3h5KCB0aGlzLm9uTGFiZWxJbnB1dCwgdGhpcyApICk7XG5cblx0XHRcdHRoaXMucmVmcmVzaEhhbmRsZXJzKCk7XG5cdFx0XHR0aGlzLnVwZGF0ZVZhckljb25zKCk7XG5cblx0XHR9LFxuXG5cdFx0b25SZW1vdmVCdG5DbGljazogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHR2YXIgJGJ0biA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICksXG5cdFx0XHRcdCRsYWJlbCA9ICRidG4ucGFyZW50cyggXCIudmFyaWFibGUtbGFiZWxcIiApLFxuXHRcdFx0XHR2YXJpYWJsZUlkID0gJGxhYmVsLmF0dHIoIFwiZGF0YS12YXJpYWJsZS1pZFwiICk7XG5cdFx0XHRBcHAuQ2hhcnRWYXJpYWJsZXNDb2xsZWN0aW9uLnJlbW92ZSggdmFyaWFibGVJZCApO1xuXG5cdFx0fSxcblxuXHRcdG9uVmFyaWFibGVMYWJlbE1vdmVkOiBmdW5jdGlvbiggKSB7XG5cblx0XHRcdC8vY2hlY2sgaWYgdGhlcmUncyBhbnkgdmFyaWFibGUgbGFiZWwgbGVmdCwgaWYgbm90IGluc2VydCBlbXB0eSBkZCBwbGFjZWhvbGRlclxuXHRcdFx0aWYoICF0aGlzLiRlbC5maW5kKCBcIi52YXJpYWJsZS1sYWJlbFwiICkubGVuZ3RoICkge1xuXHRcdFx0XHR0aGlzLiRlbC5maW5kKCBcIi5kZC1saXN0XCIgKS5yZXBsYWNlV2l0aCggXCI8ZGl2IGNsYXNzPSdkZC1lbXB0eSc+PC9kaXY+XCIgKTtcblx0XHRcdH1cblxuXHRcdH0sXG5cblx0XHRvblNldHRpbmdzQ2xpY2s6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdGV2dC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcblx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXG5cdFx0XHR2YXIgJGJ0biA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICksXG5cdFx0XHRcdCRwYXJlbnQgPSAkYnRuLnBhcmVudCgpO1xuXHRcdFx0XHRcblx0XHRcdHRoaXMuc2V0dGluZ3NWYXJQb3B1cC5zaG93KCAkcGFyZW50ICk7XG5cblx0XHR9LFxuXG5cdFx0b25EaW1lbnNpb25TZXR0aW5nVXBkYXRlOiBmdW5jdGlvbiggZGF0YSApIHtcblxuXHRcdFx0Ly9maW5kIHVwZGF0ZWQgdmFyaWFibGVcblx0XHRcdHZhciAkdmFyaWFibGVMYWJlbCA9ICQoIFwiLnZhcmlhYmxlLWxhYmVsW2RhdGEtdmFyaWFibGUtaWQ9J1wiICsgZGF0YS52YXJpYWJsZUlkICsgXCInXVwiICk7XG5cdFx0XHQvL3VwZGF0ZSBhbGwgYXR0cmlidXRlc1xuXHRcdFx0Zm9yKCB2YXIgaSBpbiBkYXRhICkge1xuXHRcdFx0XHRpZiggZGF0YS5oYXNPd25Qcm9wZXJ0eSggaSApICYmIGkgIT09IFwidmFyaWFibGVJZFwiICkge1xuXHRcdFx0XHRcdHZhciBhdHRyTmFtZSA9IFwiZGF0YS1cIiArIGksXG5cdFx0XHRcdFx0XHRhdHRyVmFsdWUgPSBkYXRhWyBpIF07XG5cdFx0XHRcdFx0JHZhcmlhYmxlTGFiZWwuYXR0ciggYXR0ck5hbWUsIGF0dHJWYWx1ZSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vaWYgc3luYyBwZXJpb2QgdmFsdWVzIGZvciBhbGwgdmFyaWFibGVzIFxuXHRcdFx0dmFyICR2YXJpYWJsZUxhYmVscyA9ICQoIFwiLnZhcmlhYmxlLWxhYmVsXCIgKTtcblx0XHRcdCR2YXJpYWJsZUxhYmVscy5hdHRyKCBcImRhdGEtcGVyaW9kXCIsIGRhdGEucGVyaW9kICk7XG5cblx0XHRcdHRoaXMudXBkYXRlVmFySWNvbnMoKTtcblxuXHRcdFx0Ly9oaWRlIHBvcHVwXG5cdFx0XHR0aGlzLnNldHRpbmdzVmFyUG9wdXAuaGlkZSgpO1xuXG5cdFx0XHQvL3RyaWdnZXIgdXBkYXRpbmcgbW9kZWxcblx0XHRcdHRoaXMuZGlzcGF0Y2hlci50cmlnZ2VyKCBcImRpbWVuc2lvbi11cGRhdGVcIiApO1xuXG5cdFx0fSxcblxuXHRcdHVwZGF0ZVZhckljb25zOiBmdW5jdGlvbigpIHtcblx0XHRcdFxuXHRcdFx0dmFyICR2YXJpYWJsZUxhYmVscyA9ICQoIFwiLnZhcmlhYmxlLWxhYmVsXCIgKTtcblxuXHRcdFx0Ly91cGRhdGUgaWNvbnNcblx0XHRcdCQuZWFjaCggJHZhcmlhYmxlTGFiZWxzLCBmdW5jdGlvbiggaSwgdiApIHtcblxuXHRcdFx0XHR2YXIgJGxhYmVsID0gJCggdiApLFxuXHRcdFx0XHRcdCRwZXJpb2RJY29uID0gJGxhYmVsLmZpbmQoIFwiLnBlcmlvZC1pY29uXCIgKSxcblx0XHRcdFx0XHQkbW9kZUljb24gPSAkbGFiZWwuZmluZCggXCIubW9kZS1pY29uXCIgKSxcblx0XHRcdFx0XHQkbnVtYmVySWNvbiA9ICRsYWJlbC5maW5kKCBcIi5udW1iZXItaWNvblwiICk7XG5cblx0XHRcdFx0Ly9tb2RlXG5cdFx0XHRcdHZhciBwZXJpb2QgPSAkbGFiZWwuYXR0ciggXCJkYXRhLXBlcmlvZFwiICksXG5cdFx0XHRcdFx0bW9kZSA9ICRsYWJlbC5hdHRyKCBcImRhdGEtbW9kZVwiICk7XG5cdFx0XHRcdGlmKCBwZXJpb2QgPT09IFwiYWxsXCIgKSB7XG5cdFx0XHRcdFx0JHBlcmlvZEljb24uYWRkQ2xhc3MoIFwiZmEtYXJyb3dzLWhcIiApO1xuXHRcdFx0XHRcdCRwZXJpb2RJY29uLnJlbW92ZUNsYXNzKCBcImZhLWNpcmNsZVwiICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0JHBlcmlvZEljb24ucmVtb3ZlQ2xhc3MoIFwiZmEtYXJyb3dzLWhcIiApO1xuXHRcdFx0XHRcdCRwZXJpb2RJY29uLmFkZENsYXNzKCBcImZhLWNpcmNsZVwiICk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiggcGVyaW9kID09PSBcInNpbmdsZVwiICYmIG1vZGUgPT09IFwic3BlY2lmaWNcIiApIHtcblx0XHRcdFx0XHQkbnVtYmVySWNvbi5odG1sKCAkbGFiZWwuYXR0ciggXCJkYXRhLXRhcmdldC15ZWFyXCIgKSArIFwiL1wiICsgJGxhYmVsLmF0dHIoIFwiZGF0YS10b2xlcmFuY2VcIiApICk7XG5cdFx0XHRcdH0gZWxzZSBpZiggcGVyaW9kID09IFwic2luZ2xlXCIgJiYgbW9kZSA9PT0gXCJsYXRlc3RcIiApIHtcblx0XHRcdFx0XHQkbnVtYmVySWNvbi5odG1sKCBcIjxzcGFuIGNsYXNzPSdmYSBmYS1sb25nLWFycm93LXJpZ2h0Jz48L3NwYW4+L1wiICsgJGxhYmVsLmF0dHIoIFwiZGF0YS1tYXhpbXVtLWFnZVwiICkgKTtcblx0XHRcdFx0fSBlbHNlIGlmKCBwZXJpb2QgPT0gXCJhbGxcIiAmJiBtb2RlID09PSBcImNsb3Nlc3RcIiApIHtcblx0XHRcdFx0XHQkbnVtYmVySWNvbi5odG1sKCAkbGFiZWwuYXR0ciggXCJkYXRhLXRvbGVyYW5jZVwiICkgKTtcblx0XHRcdFx0fSBlbHNlIGlmKCBwZXJpb2QgPT0gXCJhbGxcIiAmJiBtb2RlID09PSBcImxhdGVzdFwiICkge1xuXHRcdFx0XHRcdCRudW1iZXJJY29uLmh0bWwoIFwiPHNwYW4gY2xhc3M9J2ZhIGZhLWxvbmctYXJyb3ctcmlnaHQnPjwvc3Bhbj4vXCIgKyAkbGFiZWwuYXR0ciggXCJkYXRhLW1heGltdW0tYWdlXCIgKSApO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0LyokcGVyaW9kSWNvbi50ZXh0KCAkbGFiZWwuYXR0ciggXCJkYXRhLXBlcmlvZFwiICkgKTtcblx0XHRcdFx0JG1vZGVJY29uLnRleHQoICRsYWJlbC5hdHRyKCBcImRhdGEtbW9kZVwiICkgKTtcblx0XHRcdFx0JG51bWJlckljb24udGV4dCggJGxhYmVsLmF0dHIoIFwiZGF0YS10YXJnZXQteWVhclwiICkgKTsqL1xuXG5cdFx0XHR9ICk7XG5cblx0XHR9LFxuXG5cdFx0b25WYXJpYWJsZU5hbWVDbGljazogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dmFyICRuYW1lID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKSxcblx0XHRcdFx0JHBhcmVudCA9ICRuYW1lLnBhcmVudCgpLFxuXHRcdFx0XHQkdmFyaWFibGVMYWJlbElucHV0ID0gJHBhcmVudC5maW5kKCBcIi52YXJpYWJsZS1sYWJlbC1pbnB1dFwiICksXG5cdFx0XHRcdCRpbnB1dCA9ICR2YXJpYWJsZUxhYmVsSW5wdXQuZmluZCggXCJpbnB1dFwiICksXG5cdFx0XHRcdCRjb2cgPSAkcGFyZW50LnBhcmVudCgpLnBhcmVudCgpLmZpbmQoIFwiLnZhcmlhYmxlLXNldHRpbmctYnRuXCIgKTtcblx0XHRcdFxuXHRcdFx0Ly9tYWtlIHN1cmUgdmFyaWFibGUgaXMgaW4gZGltZW5zaW9uIHNlY3Rpb25cblx0XHRcdGlmKCAkcGFyZW50LnBhcmVudHMoIFwiLmRpbWVuc2lvbnMtc2VjdGlvblwiICkubGVuZ3RoICkge1xuXG5cdFx0XHRcdC8vc3RvcHBpbmcgcHJvcGFnYXRpb24gbm90IGF0IHRoZSB0b3AsIGJ1dCBoZXJlLCB0byBlbmFibGUgZHJhZyZkcm9wIG91dHNpZGUgb2YgZGltZW5zaW9uIHNlY3Rpb25cblx0XHRcdFx0ZXZ0LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcblxuXHRcdFx0XHQkY29nLmFkZENsYXNzKCBcImhpZGRlblwiICk7XG5cdFx0XHRcdCRuYW1lLmhpZGUoKTtcblx0XHRcdFx0JHZhcmlhYmxlTGFiZWxJbnB1dC5zaG93KCk7XG5cdFx0XHRcdCRpbnB1dC52YWwoICRuYW1lLnRleHQoKSApO1xuXHRcdFx0fVxuXG5cdFx0fSxcblxuXHRcdG9uTmFtZUJ0bkNsaWNrOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHRldnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG5cdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcblxuXHRcdFx0dmFyICRpbnB1dEJ0biA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICksXG5cdFx0XHRcdCR2YXJpYWJsZUxhYmVsSW5wdXQgPSAkaW5wdXRCdG4ucGFyZW50KCksXG5cdFx0XHRcdCRwYXJlbnQgPSAkdmFyaWFibGVMYWJlbElucHV0LnBhcmVudCgpLFxuXHRcdFx0XHQkdmFyaWFibGVMYWJlbE5hbWUgPSAkcGFyZW50LmZpbmQoIFwiLnZhcmlhYmxlLWxhYmVsLW5hbWVcIiApLFxuXHRcdFx0XHQkY29nID0gJHBhcmVudC5wYXJlbnQoKS5wYXJlbnQoKS5maW5kKCBcIi52YXJpYWJsZS1zZXR0aW5nLWJ0blwiICk7XG5cdFx0XHRcblx0XHRcdCRjb2cucmVtb3ZlQ2xhc3MoIFwiaGlkZGVuXCIgKTtcbiBcblx0XHRcdGlmKCAkaW5wdXRCdG4uaGFzQ2xhc3MoIFwiZmEtY2hlY2tcIiApICkge1xuXHRcdFx0XHQvL2NvbmZpcm1hdGlvbiBvZiBjaGFuZ2UgdG8gdmFyaWFibGUgbmFtZVxuXHRcdFx0XHR2YXIgJGlucHV0ID0gJHZhcmlhYmxlTGFiZWxJbnB1dC5maW5kKCBcImlucHV0XCIgKSxcblx0XHRcdFx0XHRpbnB1dFZhbCA9ICRpbnB1dC52YWwoKSxcblx0XHRcdFx0XHQkdmFyaWFibGVMYWJlbCA9ICR2YXJpYWJsZUxhYmVsSW5wdXQucGFyZW50cyggXCIudmFyaWFibGUtbGFiZWxcIiApO1xuXHRcdFx0XHQkdmFyaWFibGVMYWJlbE5hbWUudGV4dCggaW5wdXRWYWwgKTtcblx0XHRcdFx0JHZhcmlhYmxlTGFiZWwuYXR0ciggXCJkYXRhLWRpc3BsYXktbmFtZVwiLCBpbnB1dFZhbCApO1xuXHRcdFx0XHR0aGlzLmRpc3BhdGNoZXIudHJpZ2dlciggXCJkaW1lbnNpb24tdXBkYXRlXCIgKTtcblx0XHRcdH1cblxuXHRcdFx0JHZhcmlhYmxlTGFiZWxJbnB1dC5oaWRlKCk7XG5cdFx0XHQkdmFyaWFibGVMYWJlbE5hbWUuc2hvdygpO1xuXG5cdFx0fSxcblxuXHRcdG9uTGFiZWxJbnB1dDogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0ZXZ0LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuXHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cblx0XHRcdHZhciAkaW5wdXQgPSAkKCBldnQuY3VycmVudFRhcmdldCApO1xuXHRcdFx0JGlucHV0LmZvY3VzKCk7XG5cblx0XHR9LFxuXG5cdFx0b25WYXJpYWJsZVJlbW92ZTogZnVuY3Rpb24oIG1vZGVsICkge1xuXHRcdFx0dmFyICRsaVRvUmVtb3ZlID0gJCggXCIudmFyaWFibGUtbGFiZWxbZGF0YS12YXJpYWJsZS1pZD0nXCIgKyBtb2RlbC5nZXQoIFwiaWRcIiApICsgXCInXVwiICk7XG5cdFx0XHQkbGlUb1JlbW92ZS5yZW1vdmUoKTtcblx0XHR9XG5cblx0fSk7XG5cdFxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5Gb3JtLkFkZERhdGFTZWN0aW9uVmlldztcblx0XG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cdFxuXHR2YXIgQXBwID0gcmVxdWlyZSggXCIuLy4uLy4uLy4uL25hbWVzcGFjZXMuanNcIiApO1xuXG5cdEFwcC5WaWV3cy5Gb3JtLkRpbWVuc2lvbnNTZWN0aW9uVmlldyA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblxuXHRcdGVsOiBcIiNmb3JtLXZpZXcgI2RhdGEtdGFiIC5kaW1lbnNpb25zLXNlY3Rpb25cIixcblx0XHRldmVudHM6IHtcblx0XHRcdFwiY2hhbmdlIFtuYW1lPSdjaGFydC10eXBlJ11cIjogXCJvbkNoYXJ0VHlwZUNoYW5nZVwiLFxuXHRcdFx0XCJjaGFuZ2UgW25hbWU9J2dyb3VwLWJ5LXZhcmlhYmxlJ11cIjogXCJvbkdyb3VwQnlWYXJpYWJsZUNoYW5nZVwiLFxuXHRcdH0sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdFxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gb3B0aW9ucy5kaXNwYXRjaGVyO1xuXHRcdFx0QXBwLkNoYXJ0RGltZW5zaW9uc01vZGVsLm9uKCBcInJlc2V0IGNoYW5nZVwiLCB0aGlzLnJlbmRlciwgdGhpcyApO1xuXG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIub24oIFwiZGltZW5zaW9uLXVwZGF0ZVwiLCB0aGlzLm9uRGltZW5zaW9uVXBkYXRlLCB0aGlzICk7XG5cdFx0XHRcblx0XHRcdHRoaXMucmVuZGVyKCk7XG5cblx0XHR9LFxuXG5cdFx0aW5pdGVkOiBmYWxzZSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cblx0XHRcdHRoaXMuJGZvcm1TZWN0aW9uQ29udGVudCA9IHRoaXMuJGVsLmZpbmQoIFwiLmZvcm0tc2VjdGlvbi1jb250ZW50XCIgKTtcblx0XHRcdHRoaXMuJGRpbWVuc2lvbnNJbnB1dCA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9J2NoYXJ0LWRpbWVuc2lvbnMnXVwiICk7XG5cdFx0XHR0aGlzLiRncm91cEJ5VmFyaWFibGUgPSB0aGlzLiRlbC5maW5kKCBcIi5ncm91cC1ieS12YXJpYWJsZS13cmFwcGVyXCIgKTtcblx0XHRcdHRoaXMuJGdyb3VwQnlWYXJpYWJsZUlucHV0ID0gdGhpcy4kZ3JvdXBCeVZhcmlhYmxlLmZpbmQoIFwiW25hbWU9J2dyb3VwLWJ5LXZhcmlhYmxlJ11cIiApO1xuXG5cdFx0XHQvL2dldCByaWQgb2Ygb2xkIGNvbnRlbnRcblx0XHRcdHRoaXMuJGZvcm1TZWN0aW9uQ29udGVudC5lbXB0eSgpO1xuXG5cdFx0XHQvL2NvbnN0cnVjdCBodG1sXG5cdFx0XHR2YXIgY2hhcnRUeXBlID0gQXBwLkNoYXJ0RGltZW5zaW9uc01vZGVsLmlkLFxuXHRcdFx0XHRkaW1lbnNpb25zID0gQXBwLkNoYXJ0RGltZW5zaW9uc01vZGVsLmdldCggXCJjaGFydERpbWVuc2lvbnNcIiApLFxuXHRcdFx0XHRodG1sU3RyaW5nID0gXCI8b2wgY2xhc3M9J2RpbWVuc2lvbnMtbGlzdCBjaGFydC10eXBlLVwiICsgY2hhcnRUeXBlICsgXCInPlwiO1xuXG5cdFx0XHRfLmVhY2goIGRpbWVuc2lvbnMsIGZ1bmN0aW9uKCB2LCBrICkge1xuXHRcdFx0XHRodG1sU3RyaW5nICs9IFwiPGxpIGRhdGEtcHJvcGVydHk9J1wiICsgdi5wcm9wZXJ0eSArIFwiJyBjbGFzcz0nZGltZW5zaW9uLWJveCc+PGg0PlwiICsgdi5uYW1lICsgXCI8L2g0PjxkaXYgY2xhc3M9J2RkLXdyYXBwZXInPjxkaXYgY2xhc3M9J2RkJz48ZGl2IGNsYXNzPSdkZC1lbXB0eSc+PC9kaXY+PC9kaXY+PC9kaXY+PC9saT5cIjtcblx0XHRcdH0gKTtcblxuXHRcdFx0aHRtbFN0cmluZyArPSBcIjwvb2w+XCI7XG5cblx0XHRcdHZhciAkaHRtbCA9ICQoIGh0bWxTdHJpbmcgKTtcblx0XHRcdHRoaXMuJGZvcm1TZWN0aW9uQ29udGVudC5hcHBlbmQoICRodG1sICk7XG5cblx0XHRcdC8vaW5pdCBuZXN0YWJsZSBcblx0XHRcdHRoaXMuJGRkID0gdGhpcy4kZWwuZmluZCggXCIuZGRcIiApO1xuXHRcdFx0Ly9uZXN0YWJsZSBkZXN0cm95XG5cdFx0XHR0aGlzLiRkZC5uZXN0YWJsZSgpO1xuXHRcdFx0XHRcdFx0XG5cdFx0XHQvL2ZldGNoIHJlbWFpbmcgZG9tXG5cdFx0XHR0aGlzLiRkaW1lbnNpb25Cb3hlcyA9IHRoaXMuJGVsLmZpbmQoIFwiLmRpbWVuc2lvbi1ib3hcIiApO1xuXG5cdFx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cdFx0XHR0aGlzLiRkZC5vbignY2hhbmdlJywgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHRoYXQudXBkYXRlSW5wdXQoKTtcblx0XHRcdH0pO1xuXG5cdFx0XHQvL2lmIGVkaXRpbmcgY2hhcnQgLSBhc3NpZ24gcG9zc2libGUgY2hhcnQgZGltZW5zaW9ucyB0byBhdmFpbGFibGUgZGltZW5zaW9uc1xuXHRcdFx0dmFyIGNoYXJ0RGltZW5zaW9ucyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC1kaW1lbnNpb25zXCIgKTtcblx0XHRcdHRoaXMuc2V0SW5wdXRzKCBjaGFydERpbWVuc2lvbnMgKTtcblxuXHRcdFx0Ly9oYW5kbGUgZ3JvdXAgYnkgdmFyaWFibGUgY2hlY2tib3hcblx0XHRcdGlmKCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdHlwZVwiICkgPT0gMSB8fCBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdHlwZVwiICkgPT0gMyApIHtcblx0XHRcdFx0Ly9pcyBsaW5lY2hhcnQsIHNvIHRoaXMgY2hlY2tib3ggaXMgcmVsZXZhbnRcblx0XHRcdFx0dmFyIGdyb3VwQnlWYXJpYWJsZXMgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiZ3JvdXAtYnktdmFyaWFibGVzXCIgKTtcblx0XHRcdFx0dGhpcy4kZ3JvdXBCeVZhcmlhYmxlSW5wdXQucHJvcCggXCJjaGVja2VkXCIsIGdyb3VwQnlWYXJpYWJsZXMgKTtcblx0XHRcdFx0dGhpcy4kZ3JvdXBCeVZhcmlhYmxlLnNob3coKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vaXMgbm90IGxpbmVjaGFydCwgbWFrZSBzdXJlIGdyb3VwaW5nIG9mIHZhcmlhYmxlcyBpcyBvZmYgYW5kIGhpZGUgaW5wdXRcblx0XHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0KCBcImdyb3VwLWJ5LXZhcmlhYmxlc1wiLCBmYWxzZSApO1xuXHRcdFx0XHR0aGlzLiRncm91cEJ5VmFyaWFibGUuaGlkZSgpO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHQvL2lmIHNjYXR0ZXIgcGxvdCwgb25seSBlbnRpdHkgbWF0Y2hcblx0XHRcdC8qdmFyICRvbmx5RW50aXR5TWF0Y2hDaGVjayA9ICQoIFwiPGRpdiBjbGFzcz0nb25seS1lbnRpdHktY2hlY2std3JhcHBlcic+PGxhYmVsPjxpbnB1dCB0eXBlPSdjaGVja2JveCcgbmFtZT0nb25seS1lbnRpdHktY2hlY2snIC8+TWF0Y2ggdmFyaWFibGVzIG9ubHkgYnkgY291bnRyaWVzLCBub3QgeWVhcnMuPC9sYWJlbD48L2Rpdj5cIiApLFxuXHRcdFx0XHQkb25seUVudGl0eUlucHV0ID0gJG9ubHlFbnRpdHlNYXRjaENoZWNrLmZpbmQoIFwiaW5wdXRcIiApO1xuXHRcdFx0JG9ubHlFbnRpdHlJbnB1dC5vbiggXCJjaGFuZ2VcIiwgZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdFx0dmFyICR0aGlzID0gJCggdGhpcyApO1xuXHRcdFx0XHRBcHAuQ2hhcnRNb2RlbC5zZXQoIFwib25seS1lbnRpdHktbWF0Y2hcIiwgJHRoaXMucHJvcCggXCJjaGVja2VkXCIgKSApO1xuXHRcdFx0fSApO1xuXHRcdFx0Ly9zZXQgZGVmYXVsdCB2YWx1ZVxuXHRcdFx0JG9ubHlFbnRpdHlJbnB1dC5wcm9wKCBcImNoZWNrZWRcIiwgQXBwLkNoYXJ0TW9kZWwuZ2V0KCBcIm9ubHktZW50aXR5LW1hdGNoXCIgKSApO1xuXHRcdFx0dGhpcy4kZm9ybVNlY3Rpb25Db250ZW50LmFwcGVuZCggJG9ubHlFbnRpdHlNYXRjaENoZWNrICk7Ki9cblx0XHRcdFxuXHRcdH0sXG5cblx0XHR1cGRhdGVJbnB1dDogZnVuY3Rpb24oKSB7XG5cdFx0XHRcblx0XHRcdHZhciBkaW1lbnNpb25zID0gW107XG5cdFx0XHQkLmVhY2goIHRoaXMuJGRpbWVuc2lvbkJveGVzLCBmdW5jdGlvbiggaSwgdiApIHtcblx0XHRcdFx0dmFyICRib3ggPSAkKCB2ICksXG5cdFx0XHRcdFx0JGRyb3BwZWRWYXJpYWJsZXMgPSAkYm94LmZpbmQoIFwiLnZhcmlhYmxlLWxhYmVsXCIgKTtcblx0XHRcdFx0aWYoICRkcm9wcGVkVmFyaWFibGVzLmxlbmd0aCApIHtcblx0XHRcdFx0XHQvL2p1c3QgaW4gY2FzZSB0aGVyZSB3ZXJlIG1vcmUgdmFyaWFibGVzXG5cdFx0XHRcdFx0JC5lYWNoKCAkZHJvcHBlZFZhcmlhYmxlcywgZnVuY3Rpb24oIGksIHYgKSB7XG5cdFx0XHRcdFx0XHR2YXIgJGRyb3BwZWRWYXJpYWJsZSA9ICQoIHYgKSxcblx0XHRcdFx0XHRcdFx0ZGltZW5zaW9uID0geyB2YXJpYWJsZUlkOiAkZHJvcHBlZFZhcmlhYmxlLmF0dHIoIFwiZGF0YS12YXJpYWJsZS1pZFwiICksIGRpc3BsYXlOYW1lOiAkZHJvcHBlZFZhcmlhYmxlLmF0dHIoIFwiZGF0YS1kaXNwbGF5LW5hbWVcIiApLCBwcm9wZXJ0eTogJGJveC5hdHRyKCBcImRhdGEtcHJvcGVydHlcIiApLCB1bml0OiAkZHJvcHBlZFZhcmlhYmxlLmF0dHIoIFwiZGF0YS11bml0XCIgKSwgbmFtZTogJGJveC5maW5kKCBcImg0XCIgKS50ZXh0KCksIHBlcmlvZDogJGRyb3BwZWRWYXJpYWJsZS5hdHRyKCBcImRhdGEtcGVyaW9kXCIgKSwgbW9kZTogJGRyb3BwZWRWYXJpYWJsZS5hdHRyKCBcImRhdGEtbW9kZVwiICksIHRhcmdldFllYXI6ICRkcm9wcGVkVmFyaWFibGUuYXR0ciggXCJkYXRhLXRhcmdldC15ZWFyXCIgKSwgdG9sZXJhbmNlOiAkZHJvcHBlZFZhcmlhYmxlLmF0dHIoIFwiZGF0YS10b2xlcmFuY2VcIiApLCBtYXhpbXVtQWdlOiAkZHJvcHBlZFZhcmlhYmxlLmF0dHIoIFwiZGF0YS1tYXhpbXVtLWFnZVwiICkgfTtcblx0XHRcdFx0XHRcdGRpbWVuc2lvbnMucHVzaCggZGltZW5zaW9uICk7XG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cblx0XHRcdHZhciBqc29uID0gSlNPTi5zdHJpbmdpZnkoIGRpbWVuc2lvbnMgKTtcblx0XHRcdHRoaXMuJGRpbWVuc2lvbnNJbnB1dC52YWwoIGpzb24gKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJjaGFydC1kaW1lbnNpb25zXCIsIGpzb24gKTtcblxuXHRcdH0sXG5cblx0XHRzZXRJbnB1dHM6IGZ1bmN0aW9uKCBjaGFydERpbWVuc2lvbnMgKSB7XG5cblx0XHRcdGlmKCAhY2hhcnREaW1lbnNpb25zIHx8ICFjaGFydERpbWVuc2lvbnMubGVuZ3RoICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vY29udmVydCB0byBqc29uXG5cdFx0XHRjaGFydERpbWVuc2lvbnMgPSAkLnBhcnNlSlNPTiggY2hhcnREaW1lbnNpb25zICk7XG5cblx0XHRcdHZhciB0aGF0ID0gdGhpcztcblx0XHRcdF8uZWFjaCggY2hhcnREaW1lbnNpb25zLCBmdW5jdGlvbiggY2hhcnREaW1lbnNpb24sIGkgKSB7XG5cblx0XHRcdFx0Ly9maW5kIHZhcmlhYmxlIGxhYmVsIGJveCBmcm9tIGF2YWlsYWJsZSB2YXJpYWJsZXNcblx0XHRcdFx0dmFyICR2YXJpYWJsZUxhYmVsID0gJCggXCIudmFyaWFibGUtbGFiZWxbZGF0YS12YXJpYWJsZS1pZD1cIiArIGNoYXJ0RGltZW5zaW9uLnZhcmlhYmxlSWQgKyBcIl1cIiApO1xuXG5cdFx0XHRcdC8vY29weSB2YXJpYWJsZXMgYXR0cmlidXRlc1xuXHRcdFx0XHRpZiggY2hhcnREaW1lbnNpb24ucGVyaW9kICkge1xuXHRcdFx0XHRcdCR2YXJpYWJsZUxhYmVsLmF0dHIoIFwiZGF0YS1wZXJpb2RcIiwgY2hhcnREaW1lbnNpb24ucGVyaW9kICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYoIGNoYXJ0RGltZW5zaW9uLm1vZGUgKSB7XG5cdFx0XHRcdFx0JHZhcmlhYmxlTGFiZWwuYXR0ciggXCJkYXRhLW1vZGVcIiwgY2hhcnREaW1lbnNpb24ubW9kZSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmKCBjaGFydERpbWVuc2lvbi50YXJnZXRZZWFyICkge1xuXHRcdFx0XHRcdCR2YXJpYWJsZUxhYmVsLmF0dHIoIFwiZGF0YS10YXJnZXQteWVhclwiLCBjaGFydERpbWVuc2lvbi50YXJnZXRZZWFyICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYoIGNoYXJ0RGltZW5zaW9uLnRvbGVyYW5jZSApIHtcblx0XHRcdFx0XHQkdmFyaWFibGVMYWJlbC5hdHRyKCBcImRhdGEtdG9sZXJhbmNlXCIsIGNoYXJ0RGltZW5zaW9uLnRvbGVyYW5jZSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmKCBjaGFydERpbWVuc2lvbi5tYXhpbXVtQWdlICkge1xuXHRcdFx0XHRcdCR2YXJpYWJsZUxhYmVsLmF0dHIoIFwiZGF0YS1tYXhpbXVtLWFnZVwiLCBjaGFydERpbWVuc2lvbi5tYXhpbXVtQWdlICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYoIGNoYXJ0RGltZW5zaW9uLmRpc3BsYXlOYW1lICkge1xuXHRcdFx0XHRcdCR2YXJpYWJsZUxhYmVsLmZpbmQoIFwiLnZhcmlhYmxlLWxhYmVsLW5hbWVcIiApLnRleHQoIGNoYXJ0RGltZW5zaW9uLmRpc3BsYXlOYW1lICk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvL2ZpbmQgYXBwcm9wcmlhdGUgZGltZW5zaW9uIGJveCBmb3IgaXQgYnkgZGF0YS1wcm9wZXJ0eVxuXHRcdFx0XHR2YXIgJGRpbWVuc2lvbkJveCA9IHRoYXQuJGVsLmZpbmQoIFwiLmRpbWVuc2lvbi1ib3hbZGF0YS1wcm9wZXJ0eT1cIiArIGNoYXJ0RGltZW5zaW9uLnByb3BlcnR5ICsgXCJdXCIgKTtcblx0XHRcdFx0Ly9yZW1vdmUgZW1wdHkgYW5kIGFkZCB2YXJpYWJsZSBib3hcblx0XHRcdFx0JGRpbWVuc2lvbkJveC5maW5kKCBcIi5kZC1lbXB0eVwiICkucmVtb3ZlKCk7XG5cdFx0XHRcdHZhciAkZGRMaXN0ID0gJCggXCI8b2wgY2xhc3M9J2RkLWxpc3QnPjwvb2w+XCIgKTtcblx0XHRcdFx0JGRkTGlzdC5hcHBlbmQoICR2YXJpYWJsZUxhYmVsICk7XG5cdFx0XHRcdCRkaW1lbnNpb25Cb3guZmluZCggXCIuZGRcIiApLmFwcGVuZCggJGRkTGlzdCApO1xuXHRcdFx0XHR0aGF0LmRpc3BhdGNoZXIudHJpZ2dlciggXCJ2YXJpYWJsZS1sYWJlbC1tb3ZlZFwiICk7XG5cblx0XHRcdH0gKTtcblx0XG5cdFx0fSxcblxuXHRcdG9uQ2hhcnRUeXBlQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHR2YXIgJHNlbGVjdCA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICk7XG5cdFx0XHRBcHAuQ2hhcnREaW1lbnNpb25zTW9kZWwubG9hZENvbmZpZ3VyYXRpb24oICRzZWxlY3QudmFsKCkgKTtcblxuXHRcdH0sXG5cblx0XHRvbkRpbWVuc2lvblVwZGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLnVwZGF0ZUlucHV0KCk7XG5cdFx0fSxcblxuXHRcdG9uR3JvdXBCeVZhcmlhYmxlQ2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHR2YXIgJGlucHV0ID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKTtcblx0XHRcdEFwcC5DaGFydE1vZGVsLnNldCggXCJncm91cC1ieS12YXJpYWJsZXNcIiwgJGlucHV0LmlzKCBcIjpjaGVja2VkXCIgKSApO1xuXG5cdFx0fVxuXG5cdH0pO1xuXHRcblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVmlld3MuRm9ybS5EaW1lbnNpb25zU2VjdGlvblZpZXc7XG5cdFxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBBcHAgPSByZXF1aXJlKCBcIi4vLi4vLi4vLi4vbmFtZXNwYWNlcy5qc1wiICk7XG5cblx0QXBwLlZpZXdzLkZvcm0uRW50aXRpZXNTZWN0aW9uVmlldyA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblxuXHRcdGVsOiBcIiNmb3JtLXZpZXcgI2RhdGEtdGFiIC5lbnRpdGllcy1zZWN0aW9uXCIsXG5cdFx0ZXZlbnRzOiB7XG5cdFx0XHRcImNoYW5nZSAuY291bnRyaWVzLXNlbGVjdFwiOiBcIm9uQ291bnRyaWVzU2VsZWN0XCIsXG5cdFx0XHRcImNoYW5nZSBbbmFtZT0nYWRkLWNvdW50cnktbW9kZSddXCI6IFwib25BZGRDb3VudHJ5TW9kZUNoYW5nZVwiXG5cdFx0fSxcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0XG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIgPSBvcHRpb25zLmRpc3BhdGNoZXI7XG5cdFx0XHQvL0FwcC5BdmFpbGFibGVFbnRpdGllc0NvbGxlY3Rpb24ub24oIFwiY2hhbmdlIGFkZCByZW1vdmUgcmVzZXRcIiwgdGhpcy5yZW5kZXIsIHRoaXMgKTtcblx0XHRcdC8vYXZhaWxhYmxlIGVudGl0aWVzIGFyZSBjaGFuZ2luZyBqdXN0IG9uIGZldGNoIHNvIGxpc3RlbiBqdXN0IGZvciB0aGF0XG5cdFx0XHRBcHAuQXZhaWxhYmxlRW50aXRpZXNDb2xsZWN0aW9uLm9uKCBcInJlc2V0IGZldGNoZWRcIiwgdGhpcy5yZW5kZXIsIHRoaXMgKTtcblx0XHRcdFxuXHRcdFx0dGhpcy4kZW50aXRpZXNTZWxlY3QgPSB0aGlzLiRlbC5maW5kKCBcIi5jb3VudHJpZXMtc2VsZWN0XCIgKTtcblx0XHRcdHRoaXMuJGFkZENvdW50cnlDb250cm9sSW5wdXQgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPSdhZGQtY291bnRyeS1jb250cm9sJ11cIiApO1xuXG5cdFx0XHR0aGlzLnJlbmRlcigpO1xuXG5cdFx0fSxcblxuXHRcdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cblx0XHRcdHZhciAkZW50aXRpZXNTZWxlY3QgPSB0aGlzLiRlbnRpdGllc1NlbGVjdDtcblx0XHRcdCRlbnRpdGllc1NlbGVjdC5lbXB0eSgpO1xuXHRcdFx0XG5cdFx0XHQvL2FwcGVuZCBkZWZhdWx0IFxuXHRcdFx0JGVudGl0aWVzU2VsZWN0LmFwcGVuZCggJCggXCI8b3B0aW9uIHNlbGVjdGVkIGRpc2FibGVkPlNlbGVjdCBlbnRpdHk8L29wdGlvbj5cIiApICk7XG5cblx0XHRcdEFwcC5BdmFpbGFibGVFbnRpdGllc0NvbGxlY3Rpb24uZWFjaCggZnVuY3Rpb24oIG1vZGVsICkge1xuXHRcdFx0XHQkZW50aXRpZXNTZWxlY3QuYXBwZW5kKCAkKCBcIjxvcHRpb24gdmFsdWU9J1wiICsgbW9kZWwuZ2V0KCBcImlkXCIgKSArIFwiJz5cIiArIG1vZGVsLmdldCggXCJuYW1lXCIgKSArIFwiPC9vcHRpb24+XCIgKSApO1xuXHRcdFx0fSk7XG5cblx0XHRcdHZhciBhZGRDb3VudHJ5Q29udHJvbCA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJhZGQtY291bnRyeS1jb250cm9sXCIgKTtcblx0XHRcdHRoaXMuJGFkZENvdW50cnlDb250cm9sSW5wdXQucHJvcCggXCJjaGVja2VkXCIsIGFkZENvdW50cnlDb250cm9sICk7XG5cblx0XHRcdC8vYmFzZWQgb24gc3RvcmVkIGFkZC1jb3VudHJ5LW1vZGVcblx0XHRcdHZhciBhZGRDb3VudHJ5TW9kZSA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJhZGQtY291bnRyeS1tb2RlXCIgKTtcblx0XHRcdHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9J2FkZC1jb3VudHJ5LW1vZGUnXVwiICkuZmlsdGVyKCBcIlt2YWx1ZT0nXCIgKyBhZGRDb3VudHJ5TW9kZSArIFwiJ11cIiApLnByb3AoIFwiY2hlY2tlZFwiLCB0cnVlICk7XG5cblx0XHR9LFxuXG5cdFx0b25Db3VudHJpZXNTZWxlY3Q6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdHZhciAkc2VsZWN0ID0gJCggZXZ0LnRhcmdldCApLFxuXHRcdFx0XHR2YWwgPSAkc2VsZWN0LnZhbCgpLFxuXHRcdFx0XHQkb3B0aW9uID0gJHNlbGVjdC5maW5kKCBcIm9wdGlvblt2YWx1ZT1cIiArIHZhbCArIFwiXVwiICksXG5cdFx0XHRcdHRleHQgPSAkb3B0aW9uLnRleHQoKTtcblxuXHRcdFx0QXBwLkNoYXJ0TW9kZWwuYWRkU2VsZWN0ZWRDb3VudHJ5KCB7IGlkOiB2YWwsIG5hbWU6IHRleHQgfSApO1xuXG5cdFx0fSxcblxuXHRcdG9uQWRkQ291bnRyeU1vZGVDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdHZhciAkaW5wdXQgPSAkKCBcIltuYW1lPSdhZGQtY291bnRyeS1tb2RlJ106Y2hlY2tlZFwiICk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5zZXQoIFwiYWRkLWNvdW50cnktbW9kZVwiLCAkaW5wdXQudmFsKCkgKTtcblxuXHRcdH1cblxuXG5cdH0pO1xuXHRcblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVmlld3MuRm9ybS5FbnRpdGllc1NlY3Rpb25WaWV3O1xuXG59KSgpOyIsIjsoIGZ1bmN0aW9uKCkge1xuXHRcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIEFwcCA9IHJlcXVpcmUoIFwiLi8uLi8uLi8uLi9uYW1lc3BhY2VzLmpzXCIgKSxcblx0XHRDb2xvclBpY2tlciA9IHJlcXVpcmUoIFwiLi8uLi8uLi91aS9BcHAuVmlld3MuVUkuQ29sb3JQaWNrZXIuanNcIiApO1xuXG5cdEFwcC5WaWV3cy5Gb3JtLlNlbGVjdGVkQ291bnRyaWVzU2VjdGlvblZpZXcgPSBCYWNrYm9uZS5WaWV3LmV4dGVuZCh7XG5cblx0XHRlbDogXCIjZm9ybS12aWV3ICNkYXRhLXRhYiAuc2VsZWN0ZWQtY291bnRyaWVzLWJveFwiLFxuXHRcdGV2ZW50czoge30sXG5cblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdFxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gb3B0aW9ucy5kaXNwYXRjaGVyO1xuXHRcdFx0XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5vbiggXCJjaGFuZ2U6c2VsZWN0ZWQtY291bnRyaWVzXCIsIHRoaXMucmVuZGVyLCB0aGlzICk7XG5cblx0XHRcdHRoaXMucmVuZGVyKCk7XG5cblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblxuXHRcdFx0Ly9yZW1vdmUgZXZlcnl0aGluZ1xuXHRcdFx0dGhpcy4kZWwuZW1wdHkoKTtcblxuXHRcdFx0dmFyIHRoYXQgPSB0aGlzLFxuXHRcdFx0XHRzZWxlY3RlZENvdW50cmllcyA9IEFwcC5DaGFydE1vZGVsLmdldCggXCJzZWxlY3RlZC1jb3VudHJpZXNcIiApO1xuXG5cdFx0XHRfLmVhY2goIHNlbGVjdGVkQ291bnRyaWVzLCBmdW5jdGlvbiggdiwgaSApIHtcblx0XHRcdFx0dmFyICRsaSA9ICQoIFwiPGxpIGNsYXNzPSdjb3VudHJ5LWxhYmVsJyBkYXRhLWlkPSdcIiArIHYuaWQgKyBcIicgZGF0YS1uYW1lPSdcIiArIHYubmFtZSArIFwiJz5cIiArIHYubmFtZSArIFwiPHNwYW4gY2xhc3M9J2ZhIGZhLXJlbW92ZSc+PC9zcGFuPjwvbGk+XCIgKTtcblx0XHRcdFx0dGhhdC4kZWwuYXBwZW5kKCAkbGkgKTtcblx0XHRcdFx0aWYoIHYuY29sb3IgKSB7XG5cdFx0XHRcdFx0JGxpLmNzcyggXCJiYWNrZ3JvdW5kLWNvbG9yXCIsIHYuY29sb3IgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXG5cdFx0XHR2YXIgJGxpcyA9IHRoaXMuJGVsLmZpbmQoIFwiLmNvdW50cnktbGFiZWxcIiApLFxuXHRcdFx0XHQkbGlzUmVtb3ZlQnRucyA9ICRsaXMuZmluZCggXCIuZmEtcmVtb3ZlXCIgKSxcblx0XHRcdFx0Y29sb3JQaWNrZXIgPSBudWxsO1xuXG5cdFx0XHQkbGlzLm9uKCBcImNsaWNrXCIsIGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cblx0XHRcdFx0dmFyICRjb3VudHJ5TGFiZWwgPSAkKCBldnQuY3VycmVudFRhcmdldCApO1xuXHRcdFx0XHRpZiggY29sb3JQaWNrZXIgKSB7XG5cdFx0XHRcdFx0Y29sb3JQaWNrZXIuY2xvc2UoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb2xvclBpY2tlciA9IG5ldyBDb2xvclBpY2tlciggJGNvdW50cnlMYWJlbCApO1xuXHRcdFx0XHRjb2xvclBpY2tlci5pbml0KCAkY291bnRyeUxhYmVsICk7XG5cdFx0XHRcdGNvbG9yUGlja2VyLm9uU2VsZWN0ZWQgPSBmdW5jdGlvbiggdmFsdWUgKSB7XG5cdFx0XHRcdFx0JGNvdW50cnlMYWJlbC5jc3MoIFwiYmFja2dyb3VuZC1jb2xvclwiLCB2YWx1ZSApO1xuXHRcdFx0XHRcdCRjb3VudHJ5TGFiZWwuYXR0ciggXCJkYXRhLWNvbG9yXCIsIHZhbHVlICk7XG5cdFx0XHRcdFx0QXBwLkNoYXJ0TW9kZWwudXBkYXRlU2VsZWN0ZWRDb3VudHJ5KCAkY291bnRyeUxhYmVsLmF0dHIoIFwiZGF0YS1pZFwiICksIHZhbHVlICk7XG5cdFx0XHRcdFx0Y29sb3JQaWNrZXIuY2xvc2UoKTtcblx0XHRcdFx0XHQvL3RoYXQuJGVsLnRyaWdnZXIoIFwiY2hhbmdlXCIgKTtcblx0XHRcdFx0fTtcblxuXHRcdFx0fSApO1x0XG5cblx0XHRcdCRsaXNSZW1vdmVCdG5zLm9uKCBcImNsaWNrXCIsIGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdFx0ZXZ0LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHRcblx0XHRcdFx0dmFyICR0aGlzID0gJCggdGhpcyApLFxuXHRcdFx0XHRcdCRwYXJlbnQgPSAkdGhpcy5wYXJlbnQoKSxcblx0XHRcdFx0XHRjb3VudHJ5SWQgPSAkcGFyZW50LmF0dHIoIFwiZGF0YS1pZFwiICk7XG5cdFx0XHRcdEFwcC5DaGFydE1vZGVsLnJlbW92ZVNlbGVjdGVkQ291bnRyeSggY291bnRyeUlkICk7XG5cblx0XHRcdH0pXHRcblx0XHRcdFxuXHRcdH1cblxuXHR9KTtcblx0XG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLkZvcm0uU2VsZWN0ZWRDb3VudHJpZXNTZWN0aW9uVmlldztcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblx0XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBBcHAgPSByZXF1aXJlKCBcIi4vLi4vLi4vLi4vbmFtZXNwYWNlcy5qc1wiICk7XG5cblx0QXBwLlZpZXdzLkZvcm0uVGltZVNlY3Rpb25WaWV3ID0gQmFja2JvbmUuVmlldy5leHRlbmQoe1xuXG5cdFx0ZWw6IFwiI2Zvcm0tdmlldyAjZGF0YS10YWIgLnRpbWUtc2VjdGlvblwiLFxuXHRcdGV2ZW50czoge1xuXHRcdFx0XCJjaGFuZ2UgW25hbWU9J2R5bmFtaWMtdGltZSddXCI6IFwib25EeW5hbWljVGltZVwiLFxuXHRcdFx0XCJjaGFuZ2UgW25hbWU9J2NoYXJ0LXRpbWUtZnJvbSddXCI6IFwib25DaGFydFRpbWVDaGFuZ2VcIixcblx0XHRcdFwiY2hhbmdlIFtuYW1lPSdjaGFydC10aW1lLXRvJ11cIjogXCJvbkNoYXJ0VGltZUNoYW5nZVwiXG5cdFx0fSxcblxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0XG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIgPSBvcHRpb25zLmRpc3BhdGNoZXI7XG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIub24oIFwiZGltZW5zaW9uLXVwZGF0ZVwiLCB0aGlzLm9uRGltZW5zaW9uVXBkYXRlLCB0aGlzICk7XG5cdFx0XHRcblx0XHRcdEFwcC5BdmFpbGFibGVUaW1lTW9kZWwub24oIFwiY2hhbmdlXCIsIHRoaXMub25BdmFpbGFibGVUaW1lQ2hhbmdlLCB0aGlzICk7XG5cblx0XHRcdHRoaXMucmVuZGVyKCk7XG5cblx0XHR9LFxuXG5cdFx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblxuXHRcdFx0dmFyIHRoYXQgPSB0aGlzO1xuXG5cdFx0XHR0aGlzLiRlbnRpdGllc1NlbGVjdCA9IHRoaXMuJGVsLmZpbmQoIFwiLmNvdW50cmllcy1zZWxlY3RcIiApO1xuXHRcdFx0dGhpcy4kY2hhcnRUaW1lID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT0nY2hhcnQtdGltZSddXCIgKTtcblx0XHRcdHRoaXMuJGR5bmFtaWNUaW1lID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT0nZHluYW1pYy10aW1lJ11cIiApO1xuXHRcdFx0dGhpcy4kaXJzID0gdGhpcy4kZWwuZmluZCggXCIuaXJzXCIgKTtcblxuXHRcdFx0dGhpcy4kY2hhcnRUaW1lRnJvbSA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9J2NoYXJ0LXRpbWUtZnJvbSddXCIgKTtcblx0XHRcdHRoaXMuJGNoYXJ0VGltZVRvID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT0nY2hhcnQtdGltZS10byddXCIgKTtcblxuXHRcdFx0dGhpcy4kY2hhcnRUaW1lLmlvblJhbmdlU2xpZGVyKHtcblx0XHRcdFx0dHlwZTogXCJkb3VibGVcIixcblx0XHRcdFx0bWluOiAwLFxuXHRcdFx0XHRtYXg6IDIwMTUsXG5cdFx0XHRcdGZyb206IDEwMDAsXG5cdFx0XHRcdHRvOiAxNTAwLFxuXHRcdFx0XHRncmlkOiB0cnVlLFxuXHRcdFx0XHRvbkNoYW5nZTogZnVuY3Rpb24oIGRhdGEgKSB7XG5cdFx0XHRcdFx0dGhhdC4kY2hhcnRUaW1lRnJvbS52YWwoZGF0YS5mcm9tKTtcblx0XHRcdFx0XHR0aGF0LiRjaGFydFRpbWVUby52YWwoZGF0YS50byk7XG5cdFx0XHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0KCBcImNoYXJ0LXRpbWVcIiwgW2RhdGEuZnJvbSwgZGF0YS50b10gKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHRzZXRUaW1lb3V0KCBmdW5jdGlvbigpIHtcblx0XHRcdFx0aWYoIGhhc0R5bmFtaWNUaW1lICkge1xuXHRcdFx0XHRcdHRoYXQuJGlycy5hZGRDbGFzcyggXCJkaXNhYmxlZFwiICk7XG5cdFx0XHRcdH1cblx0XHRcdH0sIDI1MCApO1xuXG5cdFx0XHR2YXIgaGFzRHluYW1pY1RpbWUgPSAoIEFwcC5DaGFydE1vZGVsLmdldCggXCJjaGFydC10aW1lXCIgKSApPyBmYWxzZTogdHJ1ZTtcblx0XHRcdGlmKCAhaGFzRHluYW1pY1RpbWUgKSB7XG5cdFx0XHRcdHZhciBjaGFydFRpbWUgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtdGltZVwiICk7XG5cdFx0XHRcdHRoaXMudXBkYXRlVGltZSggY2hhcnRUaW1lWyAwIF0sIGNoYXJ0VGltZVsgMSBdICk7XG5cdFx0XHR9IGVsc2UgaWYoIEFwcC5BdmFpbGFibGVUaW1lTW9kZWwuZ2V0KCBcIm1pblwiICkgJiYgQXBwLkF2YWlsYWJsZVRpbWVNb2RlbC5nZXQoIFwibWF4XCIgKSApIHtcblx0XHRcdFx0dGhpcy51cGRhdGVUaW1lKCBBcHAuQXZhaWxhYmxlVGltZU1vZGVsLmdldCggXCJtaW5cIiApLCBBcHAuQXZhaWxhYmxlVGltZU1vZGVsLmdldCggXCJtYXhcIiApICk7XG5cdFx0XHRcdGlmKCBoYXNEeW5hbWljVGltZSApIHtcblx0XHRcdFx0XHR0aGlzLiRkeW5hbWljVGltZS5wcm9wKCBcImNoZWNrZWRcIiwgdHJ1ZSApO1xuXHRcdFx0XHRcdHRoaXMuJGNoYXJ0VGltZUZyb20ucHJvcCggXCJyZWFkb25seVwiLCB0cnVlKTtcblx0XHRcdFx0XHR0aGlzLiRjaGFydFRpbWVUby5wcm9wKCBcInJlYWRvbmx5XCIsIHRydWUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRcblx0XHR9LFxuXG5cdFx0b25BdmFpbGFibGVUaW1lQ2hhbmdlOiBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMudXBkYXRlVGltZSggQXBwLkF2YWlsYWJsZVRpbWVNb2RlbC5nZXQoIFwibWluXCIgKSwgQXBwLkF2YWlsYWJsZVRpbWVNb2RlbC5nZXQoIFwibWF4XCIgKSApO1xuXHRcdH0sXG5cblx0XHRvbkRpbWVuc2lvblVwZGF0ZTogZnVuY3Rpb24oKSB7XG5cblx0XHRcdHZhciBkaW1lbnNpb25TdHJpbmcgPSBBcHAuQ2hhcnRNb2RlbC5nZXQoIFwiY2hhcnQtZGltZW5zaW9uc1wiICksXG5cdFx0XHRcdHRpbWVGcm9tID0gSW5maW5pdHksXG5cdFx0XHRcdHRpbWVUbyA9IC1JbmZpbml0eSxcblx0XHRcdFx0bGltaXRUaW1lID0gdHJ1ZTtcblxuXHRcdFx0aWYoICEkLmlzRW1wdHlPYmplY3QoIGRpbWVuc2lvblN0cmluZyApICkge1xuXG5cdFx0XHRcdHZhciBkaW1lbnNpb25zID0gJC5wYXJzZUpTT04oIGRpbWVuc2lvblN0cmluZyApO1xuXHRcdFx0XHQkLmVhY2goIGRpbWVuc2lvbnMsIGZ1bmN0aW9uKCBpLCB2ICkge1xuXHRcdFx0XHRcdGlmKCB2LnBlcmlvZCA9PT0gXCJzaW5nbGVcIiAmJiB2Lm1vZGUgPT09IFwic3BlY2lmaWNcIiApIHtcblx0XHRcdFx0XHRcdC8vZ2V0IG1pbi9tYXggbG9jYWxcblx0XHRcdFx0XHRcdHZhciB5ZWFyID0gcGFyc2VJbnQoIHYudGFyZ2V0WWVhciwgMTAgKSxcblx0XHRcdFx0XHRcdFx0bG9jYWxGcm9tID0geWVhciAtIHBhcnNlSW50KCB2LnRvbGVyYW5jZSwgMTAgKSxcblx0XHRcdFx0XHRcdFx0bG9jYWxUbyA9IHllYXIgKyBwYXJzZUludCggdi50b2xlcmFuY2UsIDEwICk7XG5cdFx0XHRcdFx0XHR0aW1lRnJvbSA9IE1hdGgubWluKCBsb2NhbEZyb20sIHRpbWVGcm9tICk7XG5cdFx0XHRcdFx0XHR0aW1lVG8gPSBNYXRoLm1heCggbG9jYWxUbywgdGltZVRvICk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdC8vc2V0IGZsYWcgdGhhdCB0aGVyZSBpcyBzb21lIGRpbWVuc2lvbiB0aGF0IGNhbm5vdCBiZSBsaW1pdGVkIGF1dG9tYXRpY2FseVxuXHRcdFx0XHRcdFx0bGltaXRUaW1lID0gZmFsc2U7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9ICk7XG5cblx0XHRcdH1cblxuXHRcdFx0Ly9pZiBzb21ldGhpbmcgaGFzIGNoYW5nZWQsIHNldCB0aW1lIGludGVydmFsIG9ubHkgdG8gbmVjZXNzYXJ5XG5cdFx0XHRpZiggbGltaXRUaW1lICYmIHRpbWVGcm9tIDwgSW5maW5pdHkgJiYgdGltZVRvID4gLUluZmluaXR5ICkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZVRpbWUoIHRpbWVGcm9tLCB0aW1lVG8gKTtcblx0XHRcdFx0QXBwLkNoYXJ0TW9kZWwuc2V0KCBcImNoYXJ0LXRpbWVcIiwgWyB0aW1lRnJvbSwgdGltZVRvIF0gKTtcblx0XHRcdH1cblxuXHRcdH0sXG5cblx0XHR1cGRhdGVUaW1lOiBmdW5jdGlvbiggZnJvbSwgdG8gKSB7XG5cblx0XHRcdHZhciBzbGlkZXIgPSAkKCBcIltuYW1lPWNoYXJ0LXRpbWVdXCIgKS5kYXRhKCBcImlvblJhbmdlU2xpZGVyXCIgKTtcblx0XHRcdHNsaWRlci51cGRhdGUoIHtmcm9tOiBmcm9tLCB0bzogdG8gfSApO1xuXHRcdFx0Ly91cGRhdGluZyBzbGlkZXIsIHNvIGhhdmUgc29tZSBzZXQgdmFsdWVzIGFuZCBkaXNhYmxpbmcgZHluYW1pYyB0YWJsZVxuXHRcdFx0dGhpcy4kZHluYW1pY1RpbWUucHJvcCggXCJjaGVja2VkXCIsIGZhbHNlICk7XG5cdFx0XHR0aGlzLiRpcnMucmVtb3ZlQ2xhc3MoIFwiZGlzYWJsZWRcIiApO1xuXHRcdFx0dGhpcy4kY2hhcnRUaW1lRnJvbS52YWwoZnJvbSk7XG5cdFx0XHR0aGlzLiRjaGFydFRpbWVUby52YWwodG8pO1xuXG5cdFx0fSxcblxuXHRcdG9uRHluYW1pY1RpbWU6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHRpZiggdGhpcy4kZHluYW1pY1RpbWUuaXMoIFwiOmNoZWNrZWRcIiApICkge1xuXHRcdFx0XHR0aGlzLiRpcnMuYWRkQ2xhc3MoIFwiZGlzYWJsZWRcIiApO1xuXHRcdFx0XHR0aGlzLiRjaGFydFRpbWVGcm9tLnByb3AoIFwicmVhZG9ubHlcIiwgdHJ1ZSk7XG5cdFx0XHRcdHRoaXMuJGNoYXJ0VGltZVRvLnByb3AoIFwicmVhZG9ubHlcIiwgdHJ1ZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLiRpcnMucmVtb3ZlQ2xhc3MoIFwiZGlzYWJsZWRcIiApO1xuXHRcdFx0XHR0aGlzLiRjaGFydFRpbWVGcm9tLnByb3AoIFwicmVhZG9ubHlcIiwgZmFsc2UpO1xuXHRcdFx0XHR0aGlzLiRjaGFydFRpbWVUby5wcm9wKCBcInJlYWRvbmx5XCIsIGZhbHNlKTtcblx0XHRcdH1cblx0XHRcblx0XHR9LFxuXG5cdFx0b25DaGFydFRpbWVDaGFuZ2U6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdHZhciBzbGlkZXIgPSAkKCBcIltuYW1lPWNoYXJ0LXRpbWVdXCIgKS5kYXRhKCBcImlvblJhbmdlU2xpZGVyXCIgKSxcblx0XHRcdFx0ZnJvbSA9IHRoaXMuJGNoYXJ0VGltZUZyb20udmFsKCksXG5cdFx0XHRcdHRvID0gdGhpcy4kY2hhcnRUaW1lVG8udmFsKCk7XG5cdFx0XHRBcHAuQ2hhcnRNb2RlbC5zZXQoIFwiY2hhcnQtdGltZVwiLCBbZnJvbSwgdG9dICk7XG5cdFx0XHRzbGlkZXIudXBkYXRlKCB7ZnJvbTogZnJvbSwgdG86IHRvIH0gKTtcblx0XHR9XG5cblxuXHR9KTtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5Gb3JtLlRpbWVTZWN0aW9uVmlldztcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgQXBwID0gcmVxdWlyZSggXCIuLy4uLy4uL25hbWVzcGFjZXMuanNcIiApO1xuXG5cdHZhciB0aGF0O1xuXG5cdEFwcC5WaWV3cy5VSS5Db2xvclBpY2tlciA9IGZ1bmN0aW9uKCkge1xuXHRcdHRoYXQgPSB0aGlzO1xuXHRcdHRoaXMuJGRpdiA9IG51bGw7XG5cdFxuXHRcdHRoaXMuaW5pdCA9IGZ1bmN0aW9uKCAkZWwsIGRhdGEgKSB7XG5cblx0XHRcdHZhciBsaXNTdHJpbmcgPSBcIlwiLFxuXHRcdFx0XHQkbGlzO1xuXG5cdFx0XHRpZiggIWRhdGEgKSB7XG5cdFx0XHRcdGRhdGEgPSBBcHAuVmlld3MuVUkuQ29sb3JQaWNrZXIuQ09MT1JfQVJSQVk7XG5cdFx0XHR9XG5cblx0XHRcdC8vRE9NIHN0dWZmXHRcdFx0XG5cdFx0XHQkLmVhY2goIGRhdGEsIGZ1bmN0aW9uKCBpLCBkICkge1xuXHRcdFx0XHRsaXNTdHJpbmcgKz0gXCI8bGkgZGF0YS12YWx1ZT0nXCIgKyBkICsgXCInIHN0eWxlPSdiYWNrZ3JvdW5kLWNvbG9yOlwiICsgZCArIFwiJz48L2xpPlwiO1xuXHRcdFx0fSApO1xuXHRcdFx0dGhpcy4kZGl2ID0gJCggXCI8ZGl2IGNsYXNzPSdcIiArIEFwcC5WaWV3cy5VSS5Db2xvclBpY2tlci5XUkFQUEVSX0NMQVNTICsgXCInPjx1bCBjbGFzcz0nbm8tYnVsbGV0cyc+XCIgKyBsaXNTdHJpbmcgKyBcIjwvdWw+PC9kaXY+XCIgKTtcblx0XHRcdCRlbC5hcHBlbmQoIHRoaXMuJGRpdiApO1xuXHRcdFx0JGxpcyA9IHRoaXMuJGRpdi5maW5kKCBcImxpXCIgKTtcblxuXHRcdFx0Ly9wcmV2ZW50IG1vdmVtZW50XG5cdFx0XHR0aGlzLiRkaXYub24oIFwibW91c2Vkb3duXCIsIGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHRcdGV2dC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcblx0XHRcdH0gKTtcblx0XHRcdCRsaXMub24oIFwibW91c2Vkb3duXCIsIHRoaXMub25Nb3VzZURvd24gKTtcblx0XHR9O1xuXG5cdFx0dGhpcy5vbk1vdXNlRG93biA9IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHRldnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG5cdFx0XHR2YXIgdmFsdWUgPSAkKCB0aGlzICkuYXR0ciggXCJkYXRhLXZhbHVlXCIgKTtcblx0XHRcdGlmKCB0aGF0Lm9uU2VsZWN0ZWQgKSB7XG5cdFx0XHRcdHRoYXQub25TZWxlY3RlZC5hcHBseSggdGhhdCwgWyB2YWx1ZSBdICk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHRoaXMuY2xvc2UgPSBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuJGRpdi5yZW1vdmUoKTtcblx0XHR9O1xuXG5cdH07XG5cblx0Ly9BcHAuVmlld3MuVUkuQ29sb3JQaWNrZXIuQ09MT1JfQVJSQVkgPSBbIFwiI0E1MkEyQVwiLCBcIiNGRjQwNDBcIiwgXCIjRUUzQjNCXCIsIFwiI0NEMzMzM1wiLCBcIiM1RjlFQTBcIiwgXCIjOThGNUZGXCIsIFwiIzhFRTVFRVwiLCBcIiM3QUM1Q0RcIiwgXCIjNTM4NjhCXCIsIFwiI0ZGRDcwMFwiLCBcIiNFRUM5MDBcIiwgXCIjQ0RBRDAwXCIsIFwiIzhCNzUwMFwiICBdO1xuXHRBcHAuVmlld3MuVUkuQ29sb3JQaWNrZXIuQ09MT1JfQVJSQVkgPSBbIFwiI0IwMTcxRlwiLCBcIiNEQzE0M0NcIiwgXCIjRkYzRTk2XCIsIFwiI0VFM0E4Q1wiLCBcIiNEQTcwRDZcIiwgXCIjRkY4M0ZBXCIsIFwiIzhBMkJFMlwiLCBcIiM5QjMwRkZcIiwgXCIjNjk1OUNEXCIsIFwiIzQ3M0M4QlwiLCBcIiM0MzZFRUVcIiwgXCIjM0E1RkNEXCIsIFwiIzVDQUNFRVwiLCBcIiM0Rjk0Q0RcIiwgXCIjN0FDNUNEXCIsIFwiIzUzODY4QlwiLCBcIiM2NkNEQUFcIiwgXCIjNDU4Qjc0XCIsIFwiIzQzQ0Q4MFwiLCBcIiMyRThCNTdcIiwgXCIjNjZDRDAwXCIsIFwiI0NEQ0QwMFwiLCBcIiNGRkVDOEJcIiwgXCIjRkZENzAwXCIsIFwiI0ZGQzEyNVwiLCBcIiNGRkE1MDBcIiwgXCIjRkY3RjUwXCIsIFwiI0ZGNDUwMFwiLCBcIiM1QjVCNUJcIiwgXCIjOEU4RThFXCIgXTtcblx0QXBwLlZpZXdzLlVJLkNvbG9yUGlja2VyLldSQVBQRVJfQ0xBU1MgPSBcInBvcHVwLXBpY2tlci13cmFwcGVyXCI7XG5cdFxuXHRtb2R1bGUuZXhwb3J0cyA9IEFwcC5WaWV3cy5VSS5Db2xvclBpY2tlcjtcblxufSkoKTsiLCI7KCBmdW5jdGlvbigpIHtcblxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgQXBwID0gcmVxdWlyZSggXCIuLy4uLy4uL25hbWVzcGFjZXMuanNcIiApO1xuXHRcblx0dmFyIHRoYXQ7XG5cblx0QXBwLlZpZXdzLlVJLlNlbGVjdFZhclBvcHVwID0gZnVuY3Rpb24oKSB7XG5cblx0XHR0aGF0ID0gdGhpcztcblx0XHR0aGlzLiRkaXYgPSBudWxsO1xuXG5cdH07XG5cblx0QXBwLlZpZXdzLlVJLlNlbGVjdFZhclBvcHVwLnByb3RvdHlwZSA9IHtcblxuXHRcdGluaXQ6IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXG5cdFx0XHR0aGlzLmRpc3BhdGNoZXIgPSBvcHRpb25zLmRpc3BhdGNoZXI7XG5cblx0XHRcdHRoaXMuJHdpbiA9ICQoIHdpbmRvdyApO1xuXHRcdFx0dGhpcy4kZWwgPSAkKCBcIi5zZWxlY3QtdmFyLXBvcHVwXCIgKTtcblx0XHRcdHRoaXMuJGNsb3NlQnRuID0gdGhpcy4kZWwuZmluZCggXCIuY2xvc2VcIiApO1xuXHRcdFx0dGhpcy4kc2F2ZUJ0biA9IHRoaXMuJGVsLmZpbmQoIFwiLmJ0bi1wcmltYXJ5XCIgKTtcblx0XHRcdHRoaXMuJGNhbmNlbEJ0biA9IHRoaXMuJGVsLmZpbmQoIFwiLmJ0bi1kZWZhdWx0XCIgKTtcblx0XHRcdFxuXHRcdFx0dGhpcy4kdmFyaWFibGVXcmFwcGVyID0gdGhpcy4kZWwuZmluZCggXCIudmFyaWFibGUtd3JhcHBlclwiICk7XG5cdFx0XHR0aGlzLiRjYXRlZ29yeVNlbGVjdCA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9Y2F0ZWdvcnktaWRdXCIgKTtcblx0XHRcdHRoaXMuJHN1YmNhdGVnb3J5U2VsZWN0ID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT1zdWJjYXRlZ29yeS1pZF1cIiApO1xuXHRcdFx0XHRcblx0XHRcdHRoaXMuJHNlbGVjdFdyYXBwZXIgPSB0aGlzLiRlbC5maW5kKCBcIi5zZWFyY2gtaW5wdXQtd3JhcHBlclwiICk7XG5cdFx0XHR0aGlzLiRzZWxlY3RWYXJTZWFyY2ggPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPXNlbGVjdF92YXJfc2VhcmNoXVwiICk7XG5cdFx0XHR0aGlzLiRzZWxlY3RSZXN1bHRzID0gdGhpcy4kZWwuZmluZCggXCIuc2VhcmNoLXJlc3VsdHNcIiApO1xuXHRcdFx0dGhpcy4kc2VhcmNoSWNvbiA9IHRoaXMuJHNlbGVjdFdyYXBwZXIuZmluZCggXCIuZmEtc2VhcmNoXCIgKTtcblx0XHRcdHRoaXMuJHByZWxvYWRlckljb24gPSB0aGlzLiRzZWxlY3RXcmFwcGVyLmZpbmQoIFwiLmZhLXNwaW5uZXJcIiApO1xuXHRcdFx0dGhpcy4kY2xlYXJJY29uID0gdGhpcy4kc2VsZWN0V3JhcHBlci5maW5kKCBcIi5mYS10aW1lc1wiICk7XG5cdFx0XHR0aGlzLiRwcmVsb2FkZXJJY29uLmhpZGUoKTtcblx0XHRcdHRoaXMuJGNsZWFySWNvbi5oaWRlKCk7XG5cblx0XHRcdHRoaXMuJGNoYXJ0VmFyaWFibGUgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPWNoYXJ0LXZhcmlhYmxlXVwiICk7XG5cdFx0XHRcblx0XHRcdHRoaXMuJGNsb3NlQnRuLm9uKCBcImNsaWNrXCIsICQucHJveHkoIHRoaXMub25DbG9zZUJ0biwgdGhpcyApICk7XG5cdFx0XHR0aGlzLiRzYXZlQnRuLm9uKCBcImNsaWNrXCIsICQucHJveHkoIHRoaXMub25TYXZlQnRuLCB0aGlzICkgKTtcblx0XHRcdHRoaXMuJGNhbmNlbEJ0bi5vbiggXCJjbGlja1wiLCAkLnByb3h5KCB0aGlzLm9uQ2FuY2VsQnRuLCB0aGlzICkgKTtcblx0XHRcdFxuXHRcdFx0dGhpcy4kc2VsZWN0VmFyU2VhcmNoLm9uKCBcImlucHV0XCIsICQucHJveHkoIHRoaXMub25TZWFyY2hJbnB1dCwgdGhpcyApICk7XG5cdFx0XHR0aGlzLiRzZWxlY3RWYXJTZWFyY2gub24oIFwiZm9jdXNpblwiLCAkLnByb3h5KCB0aGlzLm9uU2VhcmNoRm9jdXNJbiwgdGhpcyApICk7XG5cdFx0XHR0aGlzLiRzZWxlY3RWYXJTZWFyY2gub24oIFwiZm9jdXNvdXRcIiwgJC5wcm94eSggdGhpcy5vblNlYXJjaEZvY3VzT3V0LCB0aGlzICkgKTtcblxuXHRcdFx0dGhpcy4kY2xlYXJJY29uLm9uKCBcImNsaWNrXCIsICQucHJveHkoIHRoaXMub25DbGVhckJ0biwgdGhpcyApICk7XG5cblx0XHRcdEFwcC5TZWFyY2hEYXRhQ29sbGVjdGlvbi5vbiggXCJmZXRjaGVkXCIsICQucHJveHkoIHRoaXMub25TZWFyY2hGZXRjaGVkLCB0aGlzICkgKTtcblxuXHRcdH0sXG5cblx0XHRzaG93OiBmdW5jdGlvbigpIHtcblxuXHRcdFx0dGhpcy4kZWwuc2hvdygpO1xuXG5cdFx0fSxcblxuXHRcdGhpZGU6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHR0aGlzLiRlbC5oaWRlKCk7XG5cblx0XHR9LFxuXG5cdFx0b25DbG9zZUJ0bjogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHR0aGlzLmhpZGUoKTtcblxuXHRcdH0sXG5cblx0XHRvblNhdmVCdG46IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XG5cdFx0XHQvL3RyaWdnZXIgZXZlbnQgb25seSBpZiBzb21ldGhpbmcgc2VsZWN0ZWRcblx0XHRcdGlmKCB0aGlzLiRjaGFydFZhcmlhYmxlLnZhbCgpID4gMCApIHtcblx0XHRcdFx0XG5cdFx0XHRcdHZhciB2YXJJZCA9IHRoaXMuJGNoYXJ0VmFyaWFibGUudmFsKCksXG5cdFx0XHRcdFx0dmFyVW5pdCA9IHRoaXMuJGNoYXJ0VmFyaWFibGUuZmluZCggXCJvcHRpb246c2VsZWN0ZWRcIiApLmF0dHIoIFwiZGF0YS11bml0XCIgKSxcblx0XHRcdFx0XHR2YXJOYW1lID0gdGhpcy4kY2hhcnRWYXJpYWJsZS5maW5kKCBcIm9wdGlvbjpzZWxlY3RlZFwiICkudGV4dCgpO1xuXG5cdFx0XHRcdHZhciB2YXJpYWJsZSA9IG5ldyBBcHAuTW9kZWxzLkNoYXJ0VmFyaWFibGVNb2RlbCggeyBpZDp2YXJJZCwgbmFtZTogdmFyTmFtZSwgdW5pdDogdmFyVW5pdCB9ICk7XG5cdFx0XHRcdEFwcC5DaGFydFZhcmlhYmxlc0NvbGxlY3Rpb24uYWRkKCB2YXJpYWJsZSApO1xuXHRcdFx0XHQvL0FwcC5DaGFydE1vZGVsLnVwZGF0ZVZhcmlhYmxlcyggeyBpZDp2YXJJZCwgbmFtZTogdmFyTmFtZSB9ICk7XG5cdFx0XHRcdFxuXHRcdFx0XHR0aGlzLmhpZGUoKTtcblxuXHRcdFx0fVxuXG5cdFx0fSxcblxuXHRcdG9uQ2FuY2VsQnRuOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdHRoaXMuaGlkZSgpO1xuXG5cdFx0fSxcblxuXHRcdG9uU2VhcmNoSW5wdXQ6IGZ1bmN0aW9uKCBldnQgKSB7XG5cdFx0XHRcblx0XHRcdHZhciAkaW5wdXQgPSAkKCBldnQuY3VycmVudFRhcmdldCApLFxuXHRcdFx0XHRzZWFyY2hUZXJtID0gJGlucHV0LnZhbCgpO1xuXG5cdFx0XHRpZiggc2VhcmNoVGVybS5sZW5ndGggPj0gMiApIHtcblx0XHRcdFx0XG5cdFx0XHRcdHRoaXMuJGNsZWFySWNvbi5oaWRlKCk7XG5cdFx0XHRcdHRoaXMuJHNlYXJjaEljb24uaGlkZSgpO1xuXHRcdFx0XHR0aGlzLiRwcmVsb2FkZXJJY29uLnNob3coKTtcblxuXHRcdFx0XHRBcHAuU2VhcmNoRGF0YUNvbGxlY3Rpb24uc2VhcmNoKCBzZWFyY2hUZXJtICk7XG5cblx0XHRcdH0gZWxzZSB7XG5cblx0XHRcdFx0Ly9jbGVhciBzZWxlY3Rpb25cblx0XHRcdFx0dGhpcy4kc2VsZWN0UmVzdWx0cy5lbXB0eSgpO1xuXHRcdFx0XHR0aGlzLiRzZWxlY3RSZXN1bHRzLmhpZGUoKTtcblx0XHRcdFx0XG5cdFx0XHRcdHRoaXMuJGNsZWFySWNvbi5oaWRlKCk7XG5cdFx0XHRcdHRoaXMuJHNlYXJjaEljb24uc2hvdygpO1xuXG5cdFx0XHR9XG5cblx0XHR9LFxuXG5cdFx0b25TZWFyY2hGZXRjaGVkOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHR0aGlzLiRjbGVhckljb24uc2hvdygpO1xuXHRcdFx0dGhpcy4kc2VhcmNoSWNvbi5oaWRlKCk7XG5cdFx0XHR0aGlzLiRwcmVsb2FkZXJJY29uLmhpZGUoKTtcblxuXHRcdFx0dGhpcy4kc2VsZWN0UmVzdWx0cy5lbXB0eSgpO1xuXHRcdFx0dGhpcy4kc2VsZWN0UmVzdWx0cy5zaG93KCk7XG5cdFx0XHRcblx0XHRcdHZhciByZXN1bHRzID0gQXBwLlNlYXJjaERhdGFDb2xsZWN0aW9uLm1vZGVscyxcblx0XHRcdFx0aHRtbFN0cmluZyA9IFwiXCI7XG5cdFx0XHRfLmVhY2goIHJlc3VsdHMsIGZ1bmN0aW9uKCByZXN1bHQgKSB7XG5cdFx0XHRcdGh0bWxTdHJpbmcgKz0gXCI8bGkgZGF0YS1jYXQtaWQ9J1wiICsgcmVzdWx0LmdldCggXCJma19kc3RfY2F0X2lkXCIgKSArIFwiJyBkYXRhLXN1YmNhdC1pZD0nXCIgKyByZXN1bHQuZ2V0KCBcImZrX2RzdF9zdWJjYXRfaWRcIiApICsgXCInIGRhdGEtdmFyLWlkPSdcIiArIHJlc3VsdC5nZXQoIFwiaWRcIiApICsgXCInPlwiICsgcmVzdWx0LmdldCggXCJuYW1lXCIgKSArIFwiPC9saT5cIjtcblx0XHRcdH0gKTtcblxuXHRcdFx0dGhpcy4kc2VsZWN0UmVzdWx0cy5hcHBlbmQoICQoIGh0bWxTdHJpbmcgKSApO1xuXHRcdFx0dGhpcy4kbGlzID0gdGhpcy4kc2VsZWN0UmVzdWx0cy5maW5kKCBcImxpXCIgKTtcblx0XHRcdFxuXHRcdFx0dmFyIHRoYXQgPSB0aGlzO1xuXHRcdFx0dGhpcy4kbGlzLm9uKCBcIm1vdXNlZG93blwiLCBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHRcdHRoYXQuc2VsZWN0SXRlbSggJCggZXZ0LmN1cnJlbnRUYXJnZXQgKSApO1xuXHRcdFx0XHRcblx0XHRcdH0gKTtcblxuXHRcdH0sXG5cblx0XHRzZWxlY3RJdGVtOiBmdW5jdGlvbiggJGxpICkge1xuXG5cdFx0XHR2YXIgdGhhdCA9IHRoaXMsXG5cdFx0XHRcdHZhcklkID0gJGxpLmF0dHIoIFwiZGF0YS12YXItaWRcIiApLFxuXHRcdFx0XHRjYXRJZCA9ICRsaS5hdHRyKCBcImRhdGEtY2F0LWlkXCIgKSxcblx0XHRcdFx0c3ViY2F0SWQgPSAkbGkuYXR0ciggXCJkYXRhLXN1YmNhdC1pZFwiICk7XG5cblx0XHRcdHRoYXQuJGNhdGVnb3J5U2VsZWN0LmZpbmQoIFwib3B0aW9uW3ZhbHVlPVwiICsgY2F0SWQgKyBcIl1cIiApLnByb3AoIFwic2VsZWN0ZWRcIiwgdHJ1ZSApO1xuXHRcdFx0dGhhdC4kY2F0ZWdvcnlTZWxlY3QudHJpZ2dlciggXCJjaGFuZ2VcIiApO1xuXHRcdFx0dGhhdC4kc3ViY2F0ZWdvcnlTZWxlY3QuZmluZCggXCJvcHRpb25bdmFsdWU9XCIgKyBzdWJjYXRJZCArIFwiXVwiICkucHJvcCggXCJzZWxlY3RlZFwiLCB0cnVlICk7XG5cdFx0XHR0aGF0LiRzdWJjYXRlZ29yeVNlbGVjdC50cmlnZ2VyKCBcImNoYW5nZVwiICk7XG5cblx0XHRcdHRoYXQuJHZhcmlhYmxlV3JhcHBlci5zaG93KCk7XG5cdFx0XHR0aGF0LiRjaGFydFZhcmlhYmxlLmZpbmQoIFwib3B0aW9uW3ZhbHVlPVwiICsgdmFySWQgKyBcIl1cIiApLnByb3AoIFwic2VsZWN0ZWRcIiwgdHJ1ZSApO1xuXG5cdFx0fSxcblxuXHRcdG9uU2VhcmNoRm9jdXNJbjogZnVuY3Rpb24oKSB7XG5cdFx0XHQvL3Nob3cgc2VsZWN0IG9ubHkgaWYgc29tZSByZXN1bHRzXG5cdFx0XHRpZiggdGhpcy4kc2VsZWN0UmVzdWx0cy5maW5kKCBcImxpXCIgKS5sZW5ndGggKSB7XG5cdFx0XHRcdHRoaXMuJHNlbGVjdFJlc3VsdHMuc2hvdygpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy4ka2V5RG93bkhhbmRsZXIgPSAkLnByb3h5KCB0aGlzLm9uS2V5RG93biwgdGhpcyApO1xuXHRcdFx0dGhpcy4kd2luLm9uKCBcImtleWRvd25cIiwgdGhpcy4ka2V5RG93bkhhbmRsZXIgKTtcblx0XHR9LFxuXG5cdFx0b25TZWFyY2hGb2N1c091dDogZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdHRoYXQuJHNlbGVjdFJlc3VsdHMuaGlkZSgpO1xuXHRcdFx0dGhpcy4kd2luLm9mZiggXCJrZXlkb3duXCIsIHRoaXMuJGtleURvd25IYW5kbGVyICk7XG5cdFx0fSxcblxuXHRcdG9uS2V5RG93bjogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0aWYoICF0aGlzLiRsaXMgfHwgIXRoaXMuJGxpcy5sZW5ndGggKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dmFyIHNlbGVjdGVkSW5kZXggPSB0aGlzLiRsaXMuZmlsdGVyKCBcIi5zZWxlY3RlZFwiICkuaW5kZXgoKSxcblx0XHRcdFx0a2V5Q29kZSA9IGV2dC5rZXlDb2RlO1xuXHRcdFx0XG5cdFx0XHRpZigga2V5Q29kZSA9PT0gNDAgfHwga2V5Q29kZSA9PT0gMzggKSB7XG5cblx0XHRcdFx0aWYoIGtleUNvZGUgPT09IDQwICkge1xuXHRcdFx0XHRcdHNlbGVjdGVkSW5kZXgrKztcblx0XHRcdFx0XHRpZiggc2VsZWN0ZWRJbmRleCA+PSB0aGlzLiRsaXMubGVuZ3RoICkge1xuXHRcdFx0XHRcdFx0c2VsZWN0ZWRJbmRleCA9IDA7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2UgaWYoIGtleUNvZGUgPT09IDM4ICkge1xuXHRcdFx0XHRcdHNlbGVjdGVkSW5kZXgtLTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMuJGxpcy5yZW1vdmVDbGFzcyggXCJzZWxlY3RlZFwiICk7XG5cdFx0XHRcdHRoaXMuJGxpcy5lcSggc2VsZWN0ZWRJbmRleCApLmFkZENsYXNzKCBcInNlbGVjdGVkXCIgKTtcblx0XHRcdFxuXHRcdFx0fSBlbHNlIGlmKCBrZXlDb2RlID09PSAxMyApIHtcblxuXHRcdFx0XHR0aGlzLnNlbGVjdEl0ZW0oIHRoaXMuJGxpcy5lcSggc2VsZWN0ZWRJbmRleCApICk7XG5cdFx0XHRcdHRoaXMuJHNlbGVjdFJlc3VsdHMuaGlkZSgpO1xuXG5cdFx0XHR9XG5cblx0XHR9LFxuXG5cdFx0b25DbGVhckJ0bjogZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLiRzZWxlY3RWYXJTZWFyY2gudmFsKCBcIlwiICk7XG5cdFx0XHR0aGlzLiRzZWxlY3RWYXJTZWFyY2gudHJpZ2dlciggXCJpbnB1dFwiICk7XG5cdFx0fVxuXG5cdH07XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBBcHAuVmlld3MuVUkuU2VsZWN0VmFyUG9wdXA7XG5cbn0pKCk7XG4iLCI7KCBmdW5jdGlvbigpIHtcblxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgQXBwID0gcmVxdWlyZSggXCIuLy4uLy4uL25hbWVzcGFjZXMuanNcIiApO1xuXHRcblx0dmFyIHRoYXQ7XG5cblx0QXBwLlZpZXdzLlVJLlNldHRpbmdzVmFyUG9wdXAgPSBmdW5jdGlvbigpIHtcblxuXHRcdHRoYXQgPSB0aGlzO1xuXHRcdHRoaXMuJGRpdiA9IG51bGw7XG5cblx0fTtcblxuXHRBcHAuVmlld3MuVUkuU2V0dGluZ3NWYXJQb3B1cC5wcm90b3R5cGUgPSB7XG5cblx0XHRpbml0OiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyID0gb3B0aW9ucy5kaXNwYXRjaGVyO1xuXG5cdFx0XHQvL3dpbGwgYmUgZmlsbGVkIHdoZW4gb3BlbmluZyBwb3B1cFxuXHRcdFx0dGhpcy52YXJpYWJsZUlkID0gLTE7XG5cblx0XHRcdC8vZmxhZyBmb3IgXG5cdFx0XHR0aGlzLnZhbGlkID0gdHJ1ZTtcblxuXHRcdFx0dGhpcy4kZWwgPSAkKCBcIi5zZXR0aW5ncy12YXItcG9wdXBcIiApO1xuXHRcdFx0dGhpcy4kY2xvc2VCdG4gPSB0aGlzLiRlbC5maW5kKCBcIi5jbG9zZVwiICk7XG5cdFx0XHR0aGlzLiRzYXZlQnRuID0gdGhpcy4kZWwuZmluZCggXCIuYnRuLXByaW1hcnlcIiApO1xuXHRcdFx0dGhpcy4kY2FuY2VsQnRuID0gdGhpcy4kZWwuZmluZCggXCIuYnRuLWRlZmF1bHRcIiApO1xuXG5cdFx0XHR0aGlzLiRkaWdpdElucHV0cyA9IHRoaXMuJGVsLmZpbmQoIFwiLmRpZ2l0LWlucHV0XCIgKTtcblx0XHRcdHRoaXMuJHBlcmlvZElucHV0cyA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9cGVyaW9kXVwiICk7XG5cdFx0XHR0aGlzLiRzaW5nbGVJbnB1dHMgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPXNpbmdsZV1cIiApO1xuXHRcdFx0dGhpcy4kYWxsSW5wdXRzID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT1hbGxdXCIgKTtcblx0XHRcdHRoaXMuJGNvbnRlbnRBbGwgPSB0aGlzLiRlbC5maW5kKCBcIi5zZXR0aW5ncy12YXItY29udGVudC1hbGxcIiApO1xuXHRcdFx0dGhpcy4kY29udGVudFNpbmdsZSA9IHRoaXMuJGVsLmZpbmQoIFwiLnNldHRpbmdzLXZhci1jb250ZW50LXNpbmdsZVwiICk7XG5cdFx0XHRcdFxuXHRcdFx0dGhpcy4kY29udGVudFNpbmdsZVNwZWNpZmljID0gdGhpcy4kZWwuZmluZCggXCIuc2V0dGluZ3MtdmFyLXNpbmdsZS1zcGVjaWZpYy1jb250ZW50XCIgKTtcblx0XHRcdHRoaXMuJGNvbnRlbnRTaW5nbGVMYXRlc3QgPSB0aGlzLiRlbC5maW5kKCBcIi5zZXR0aW5ncy12YXItc2luZ2xlLWxhdGVzdC1jb250ZW50XCIgKTtcblxuXHRcdFx0dGhpcy4kY29udGVudEFsbENsb3Nlc3QgPSB0aGlzLiRlbC5maW5kKCBcIi5zZXR0aW5ncy12YXItYWxsLWNsb3Nlc3QtY29udGVudFwiICk7XG5cdFx0XHR0aGlzLiRjb250ZW50QWxsTGF0ZXN0ID0gdGhpcy4kZWwuZmluZCggXCIuc2V0dGluZ3MtdmFyLWFsbC1sYXRlc3QtY29udGVudFwiICk7XG5cblx0XHRcdHRoaXMuJGNsb3NlQnRuLm9uKCBcImNsaWNrXCIsICQucHJveHkoIHRoaXMub25DbG9zZUJ0biwgdGhpcyApICk7XG5cdFx0XHR0aGlzLiRzYXZlQnRuLm9uKCBcImNsaWNrXCIsICQucHJveHkoIHRoaXMub25TYXZlQnRuLCB0aGlzICkgKTtcblx0XHRcdHRoaXMuJGNhbmNlbEJ0bi5vbiggXCJjbGlja1wiLCAkLnByb3h5KCB0aGlzLm9uQ2FuY2VsQnRuLCB0aGlzICkgKTtcblx0XHRcdFxuXHRcdFx0dGhpcy4kZGlnaXRJbnB1dHMub24oIFwiY2hhbmdlXCIsICQucHJveHkoIHRoaXMub25EaWdpdElucHV0cywgdGhpcyApICk7XG5cdFx0XHR0aGlzLiRwZXJpb2RJbnB1dHMub24oIFwiY2hhbmdlXCIsICQucHJveHkoIHRoaXMub25QZXJpb2RJbnB1dHMsIHRoaXMgKSApO1xuXHRcdFx0dGhpcy4kc2luZ2xlSW5wdXRzLm9uKCBcImNoYW5nZVwiLCAkLnByb3h5KCB0aGlzLm9uU2luZ2xlSW5wdXRzLCB0aGlzICkgKTtcblx0XHRcdHRoaXMuJGFsbElucHV0cy5vbiggXCJjaGFuZ2VcIiwgJC5wcm94eSggdGhpcy5vbkFsbElucHV0cywgdGhpcyApICk7XG5cblx0XHR9LFxuXG5cdFx0b25EaWdpdElucHV0czogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cblx0XHRcdHZhciAkaW5wdXQgPSAkKCBldnQuY3VycmVudFRhcmdldCApLFxuXHRcdFx0XHR2YWx1ZSA9ICRpbnB1dC52YWwoKTtcblxuXHRcdFx0aWYoIGlzTmFOKCB2YWx1ZSApICkge1xuXHRcdFx0XHQkaW5wdXQucGFyZW50KCkuYWRkQ2xhc3MoIFwiaGFzLWVycm9yXCIgKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdCRpbnB1dC5wYXJlbnQoKS5yZW1vdmVDbGFzcyggXCJoYXMtZXJyb3JcIiApO1xuXHRcdFx0fVxuXG5cdFx0fSxcblxuXHRcdG9uUGVyaW9kSW5wdXRzOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHR2YXIgJGlucHV0ID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKTtcblx0XHRcdGlmKCAkaW5wdXQudmFsKCkgPT09IFwiYWxsXCIgKSB7XG5cdFx0XHRcdHRoaXMuJGNvbnRlbnRBbGwuc2hvdygpO1xuXHRcdFx0XHR0aGlzLiRjb250ZW50U2luZ2xlLmhpZGUoKTtcblx0XHRcdH0gZWxzZSBpZiggJGlucHV0LnZhbCgpID09PSBcInNpbmdsZVwiICkge1xuXHRcdFx0XHR0aGlzLiRjb250ZW50QWxsLmhpZGUoKTtcblx0XHRcdFx0dGhpcy4kY29udGVudFNpbmdsZS5zaG93KCk7XG5cdFx0XHR9XG5cblx0XHR9LFxuXG5cdFx0b25TaW5nbGVJbnB1dHM6IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdHZhciAkaW5wdXQgPSAkKCBldnQuY3VycmVudFRhcmdldCApO1xuXHRcdFx0aWYoICRpbnB1dC52YWwoKSA9PT0gXCJzcGVjaWZpY1wiICkge1xuXHRcdFx0XHR0aGlzLiRjb250ZW50U2luZ2xlU3BlY2lmaWMuc2hvdygpO1xuXHRcdFx0XHR0aGlzLiRjb250ZW50U2luZ2xlTGF0ZXN0LmhpZGUoKTtcblx0XHRcdH0gZWxzZSBpZiggJGlucHV0LnZhbCgpID09PSBcImxhdGVzdFwiICkge1xuXHRcdFx0XHR0aGlzLiRjb250ZW50U2luZ2xlU3BlY2lmaWMuaGlkZSgpO1xuXHRcdFx0XHR0aGlzLiRjb250ZW50U2luZ2xlTGF0ZXN0LnNob3coKTtcblx0XHRcdH1cblxuXHRcdH0sXG5cblx0XHRvbkFsbElucHV0czogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0dmFyICRpbnB1dCA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICk7XG5cdFx0XHRpZiggJGlucHV0LnZhbCgpID09PSBcImNsb3Nlc3RcIiApIHtcblx0XHRcdFx0dGhpcy4kY29udGVudEFsbENsb3Nlc3Quc2hvdygpO1xuXHRcdFx0XHR0aGlzLiRjb250ZW50QWxsTGF0ZXN0LmhpZGUoKTtcblx0XHRcdH0gZWxzZSBpZiggJGlucHV0LnZhbCgpID09PSBcImxhdGVzdFwiICkge1xuXHRcdFx0XHR0aGlzLiRjb250ZW50QWxsQ2xvc2VzdC5oaWRlKCk7XG5cdFx0XHRcdHRoaXMuJGNvbnRlbnRBbGxMYXRlc3Quc2hvdygpO1xuXHRcdFx0fVxuXG5cdFx0fSxcblxuXHRcdHNob3c6IGZ1bmN0aW9uKCAkdmFyaWFibGVMYWJlbCApIHtcblxuXHRcdFx0dGhpcy52YXJpYWJsZUlkID0gJHZhcmlhYmxlTGFiZWwuYXR0ciggXCJkYXRhLXZhcmlhYmxlLWlkXCIgKTtcblx0XHRcdFxuXHRcdFx0Ly9yZXBvcHVsYXRlIGZyb20gZWxlbWVudFxuXHRcdFx0dmFyIHBlcmlvZCA9ICR2YXJpYWJsZUxhYmVsLmF0dHIoIFwiZGF0YS1wZXJpb2RcIiApLFxuXHRcdFx0XHRtb2RlID0gJHZhcmlhYmxlTGFiZWwuYXR0ciggXCJkYXRhLW1vZGVcIiApLFxuXHRcdFx0XHR0YXJnZXRZZWFyID0gJHZhcmlhYmxlTGFiZWwuYXR0ciggXCJkYXRhLXRhcmdldC15ZWFyXCIgKSxcblx0XHRcdFx0dG9sZXJhbmNlID0gJHZhcmlhYmxlTGFiZWwuYXR0ciggXCJkYXRhLXRvbGVyYW5jZVwiICksXG5cdFx0XHRcdG1heGltdW1BZ2UgPSAkdmFyaWFibGVMYWJlbC5hdHRyKCBcImRhdGEtbWF4aW11bS1hZ2VcIiApO1xuXG5cdFx0XHQvL3ByZWZpbGwgdmFsdWVzIChyZWdhcmRsZXNzIG9mIHdoYXQgaXMgc2VsZWN0ZWQpXG5cdFx0XHR0aGlzLiRlbC5maW5kKCBcIltuYW1lPXNpbmdsZS15ZWFyXVwiICkudmFsKCB0YXJnZXRZZWFyICk7XG5cdFx0XHR0aGlzLiRlbC5maW5kKCBcIltuYW1lPXNpbmdsZS10b2xlcmFuY2VdXCIgKS52YWwoIHRvbGVyYW5jZSApO1xuXHRcdFx0dGhpcy4kZWwuZmluZCggXCJbbmFtZT1zaW5nbGUtbWF4aW11bS1hZ2VdXCIgKS52YWwoIG1heGltdW1BZ2UgKTtcblx0XHRcdHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9YWxsLXRvbGVyYW5jZV1cIiApLnZhbCggdG9sZXJhbmNlICk7XG5cdFx0XHR0aGlzLiRlbC5maW5kKCBcIltuYW1lPWFsbC1tYXhpbXVtLWFnZV1cIiApLnZhbCggbWF4aW11bUFnZSApO1xuXG5cdFx0XHQvL3JlbW92ZSBhbGwgdmFsaWRhdGlvbiBlcnJvcnNcblx0XHRcdHRoaXMuJGVsLmZpbmQoIFwiLmhhcy1lcnJvclwiICkucmVtb3ZlQ2xhc3MoIFwiaGFzLWVycm9yXCIgKTtcblxuXHRcdFx0Ly9iYXNlZCBvbiBzZXQgdmFsdWVzLCBhcHBlYXIgY29ycmVjdCB2YWx1ZXNcblx0XHRcdGlmKCBwZXJpb2QgKSB7XG5cdFx0XHRcdFxuXHRcdFx0XHRpZiggcGVyaW9kID09PSBcInNpbmdsZVwiICkge1xuXG5cdFx0XHRcdFx0dGhpcy4kcGVyaW9kSW5wdXRzLmZpbHRlciggXCJbdmFsdWU9c2luZ2xlXVwiICkucHJvcCggXCJjaGVja2VkXCIsIHRydWUgKTtcblxuXHRcdFx0XHRcdHRoaXMuJGNvbnRlbnRBbGwuaGlkZSgpO1xuXHRcdFx0XHRcdHRoaXMuJGNvbnRlbnRTaW5nbGUuc2hvdygpO1xuXG5cdFx0XHRcdFx0aWYoIG1vZGUgPT09IFwic3BlY2lmaWNcIiApIHtcblxuXHRcdFx0XHRcdFx0dGhpcy4kc2luZ2xlSW5wdXRzLmZpbHRlciggXCJbdmFsdWU9c3BlY2lmaWNdXCIgKS5wcm9wKCBcImNoZWNrZWRcIiwgdHJ1ZSApO1xuXHRcdFx0XHRcdFx0dGhpcy4kY29udGVudFNpbmdsZVNwZWNpZmljLnNob3coKTtcblx0XHRcdFx0XHRcdHRoaXMuJGNvbnRlbnRTaW5nbGVMYXRlc3QuaGlkZSgpO1xuXHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0fSBlbHNlIGlmKCBtb2RlID09PSBcImxhdGVzdFwiICkge1xuXG5cdFx0XHRcdFx0XHR0aGlzLiRzaW5nbGVJbnB1dHMuZmlsdGVyKCBcIlt2YWx1ZT1sYXRlc3RdXCIgKS5wcm9wKCBcImNoZWNrZWRcIiwgdHJ1ZSApO1xuXHRcdFx0XHRcdFx0dGhpcy4kY29udGVudFNpbmdsZVNwZWNpZmljLmhpZGUoKTtcblx0XHRcdFx0XHRcdHRoaXMuJGNvbnRlbnRTaW5nbGVMYXRlc3Quc2hvdygpO1xuXHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdH0gZWxzZSBpZiggcGVyaW9kID09PSBcImFsbFwiICkge1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdHRoaXMuJHBlcmlvZElucHV0cy5maWx0ZXIoIFwiW3ZhbHVlPWFsbF1cIiApLnByb3AoIFwiY2hlY2tlZFwiLCB0cnVlICk7XG5cblx0XHRcdFx0XHR0aGlzLiRjb250ZW50QWxsLnNob3coKTtcblx0XHRcdFx0XHR0aGlzLiRjb250ZW50U2luZ2xlLmhpZGUoKTtcblxuXHRcdFx0XHRcdGlmKCBtb2RlID09PSBcImNsb3Nlc3RcIiApIHtcblx0XHRcdFx0XHRcdFxuXHRcdFx0XHRcdFx0dGhpcy4kYWxsSW5wdXRzLmZpbHRlciggXCJbdmFsdWU9Y2xvc2VzdF1cIiApLnByb3AoIFwiY2hlY2tlZFwiLCB0cnVlICk7XG5cdFx0XHRcdFx0XHR0aGlzLiRjb250ZW50QWxsQ2xvc2VzdC5zaG93KCk7XG5cdFx0XHRcdFx0XHR0aGlzLiRjb250ZW50QWxsTGF0ZXN0LmhpZGUoKTtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHR9IGVsc2UgaWYoIG1vZGUgPT09IFwibGF0ZXN0XCIgKSB7XG5cdFx0XHRcdFx0XHRcblx0XHRcdFx0XHRcdHRoaXMuJGFsbElucHV0cy5maWx0ZXIoIFwiW3ZhbHVlPWxhdGVzdF1cIiApLnByb3AoIFwiY2hlY2tlZFwiLCB0cnVlICk7XG5cdFx0XHRcdFx0XHR0aGlzLiRjb250ZW50QWxsQ2xvc2VzdC5oaWRlKCk7XG5cdFx0XHRcdFx0XHR0aGlzLiRjb250ZW50QWxsTGF0ZXN0LnNob3coKTtcblx0XHRcdFx0XHRcdFxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHR9XG5cblx0XHRcdH1cblxuXHRcdFx0dGhpcy4kZWwuc2hvdygpO1xuXG5cdFx0fSxcblxuXHRcdGhpZGU6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHR0aGlzLiRlbC5oaWRlKCk7XG5cblx0XHR9LFxuXG5cdFx0b25DbG9zZUJ0bjogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHR0aGlzLmhpZGUoKTtcblxuXHRcdH0sXG5cblx0XHRvblNhdmVCdG46IGZ1bmN0aW9uKCBldnQgKSB7XG5cblx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XG5cdFx0XHQvL3ZhbGlkYXRlXG5cdFx0XHR2YXIgJGludmFsaWRJbnB1dHMgPSB0aGlzLiRlbC5maW5kKCBcIi5oYXMtZXJyb3JcIiApO1xuXHRcdFx0aWYoICRpbnZhbGlkSW5wdXRzLmxlbmd0aCApIHtcblx0XHRcdFx0YWxlcnQoIFwiUGxlYXNlIGlucHV0IG51bWJlcnMhXCIgKTtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBzdHJ1Y3R1cmVcblx0XHRcdC8vIC0gcGVyaW9kXG5cdFx0XHQvL1x0XHQtIHNpbmdsZSBcblx0XHRcdC8vXHRcdFx0LSBzcGVjaWZpY1xuXHRcdFx0Ly9cdFx0XHRcdC0geWVhclxuXHRcdFx0Ly9cdFx0XHRcdC0gdG9sZXJhbmNlXG5cdFx0XHQvL1x0XHRcdC0gbGF0ZXN0XG5cdFx0XHQvL1x0XHRcdFx0LSBtYXhpbXVtIGFnZVx0XHRcdFx0XG5cdFx0XHQvL1x0XHQtIGFsbFxuXHRcdFx0Ly9cdFx0XHQtIGNsb3Nlc3Rcblx0XHRcdC8vXHRcdFx0XHQtIHRvbGVyYW5jZVxuXHRcdFx0Ly9cdFx0XHQtIGxhdGVzdFxuXHRcdFx0Ly9cdFx0XHRcdC0gbWF4aW11bSBhZ2UgIFxuXG5cdFx0XHQvLyAgYXR0cmlidXRlc1xuXHRcdFx0Ly9cdC0gZGF0YS1wZXJpb2QgW3NpbmdsZXxhbGxdIFxuXHRcdFx0Ly9cdC0gZGF0YS1tb2RlIFtzcGVjaWZpY3xsYXRlc3R8Y2xvc2VzdF0gXG5cdFx0XHQvL1x0LSBkYXRhLXRhcmdldC15ZWFyIFtudW1iZXJdIFxuXHRcdFx0Ly9cdC0gZGF0YS10b2xlcmFuY2UgW251bWJlcl0gXG5cdFx0XHQvL1x0LSBkYXRhLW1heGltdW0tYWdlIFtudW1iZXJdIFxuXG5cdFx0XHR2YXIgZGF0YSA9IHsgdmFyaWFibGVJZDogdGhpcy52YXJpYWJsZUlkIH07XG5cdFx0XHRkYXRhLnBlcmlvZCA9IHRoaXMuJHBlcmlvZElucHV0cy5maWx0ZXIoIFwiOmNoZWNrZWRcIiApLnZhbCgpO1xuXG5cdFx0XHRpZiggZGF0YS5wZXJpb2QgPT09IFwic2luZ2xlXCIgKSB7XG5cblx0XHRcdFx0ZGF0YS5tb2RlID0gdGhpcy4kc2luZ2xlSW5wdXRzLmZpbHRlciggXCI6Y2hlY2tlZFwiICkudmFsKCk7XG5cblx0XHRcdFx0aWYoIGRhdGEubW9kZSA9PT0gXCJzcGVjaWZpY1wiICkge1xuXHRcdFx0XHRcdGRhdGFbIFwidGFyZ2V0LXllYXJcIiBdID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT1zaW5nbGUteWVhcl1cIiApLnZhbCgpO1xuXHRcdFx0XHRcdGRhdGEudG9sZXJhbmNlID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT1zaW5nbGUtdG9sZXJhbmNlXVwiICkudmFsKCk7XG5cdFx0XHRcdH0gZWxzZSBpZiggZGF0YS5tb2RlID09PSBcImxhdGVzdFwiICkge1xuXHRcdFx0XHRcdGRhdGFbIFwibWF4aW11bS1hZ2VcIiBdID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT1zaW5nbGUtbWF4aW11bS1hZ2VdXCIgKS52YWwoKTtcblx0XHRcdFx0fVxuXG5cblx0XHRcdH0gZWxzZSBpZiggZGF0YS5wZXJpb2QgPT09IFwiYWxsXCIgKSB7XG5cblx0XHRcdFx0ZGF0YS5tb2RlID0gdGhpcy4kYWxsSW5wdXRzLmZpbHRlciggXCI6Y2hlY2tlZFwiICkudmFsKCk7XG5cblx0XHRcdFx0aWYoIGRhdGEubW9kZSA9PT0gXCJjbG9zZXN0XCIgKSB7XG5cdFx0XHRcdFx0ZGF0YS50b2xlcmFuY2UgPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPWFsbC10b2xlcmFuY2VdXCIgKS52YWwoKTtcblx0XHRcdFx0fSBlbHNlIGlmKCBkYXRhLm1vZGUgPT09IFwibGF0ZXN0XCIgKSB7XG5cdFx0XHRcdFx0ZGF0YVsgXCJtYXhpbXVtLWFnZVwiIF0gPSB0aGlzLiRlbC5maW5kKCBcIltuYW1lPWFsbC1tYXhpbXVtLWFnZV1cIiApLnZhbCgpO1xuXHRcdFx0XHR9XG5cblx0XHRcdH1cblxuXHRcdFx0dGhpcy5kaXNwYXRjaGVyLnRyaWdnZXIoIFwiZGltZW5zaW9uLXNldHRpbmctdXBkYXRlXCIsIGRhdGEgKTtcblxuXHRcdH0sXG5cblx0XHRvbkNhbmNlbEJ0bjogZnVuY3Rpb24oIGV2dCApIHtcblxuXHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHR0aGlzLmhpZGUoKTtcblxuXHRcdH1cblxuXHR9O1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLlVJLlNldHRpbmdzVmFyUG9wdXA7XG5cbn0pKCk7XG4iLCI7KCBmdW5jdGlvbigpIHtcblxuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgQXBwID0gcmVxdWlyZSggXCIuLy4uLy4uL25hbWVzcGFjZXMuanNcIiApO1xuXHRcblx0dmFyIHRoYXQ7XG5cblx0QXBwLlZpZXdzLlVJLlZhcmlhYmxlU2VsZWN0cyA9IGZ1bmN0aW9uKCkge1xuXG5cdFx0dGhhdCA9IHRoaXM7XG5cdFx0dGhpcy4kZGl2ID0gbnVsbDtcblxuXHR9O1xuXG5cdEFwcC5WaWV3cy5VSS5WYXJpYWJsZVNlbGVjdHMucHJvdG90eXBlID0ge1xuXG5cdFx0aW5pdDogZnVuY3Rpb24oKSB7XG5cblx0XHRcdHRoaXMuJGVsID0gJCggXCIuZm9ybS12YXJpYWJsZS1zZWxlY3Qtd3JhcHBlclwiICk7XG5cdFx0XHR0aGlzLiRjYXRlZ29yeVdyYXBwZXIgPSB0aGlzLiRlbC5maW5kKCBcIi5jYXRlZ29yeS13cmFwcGVyXCIgKTtcblx0XHRcdHRoaXMuJGNhdGVnb3J5U2VsZWN0ID0gdGhpcy4kZWwuZmluZCggXCJbbmFtZT1jYXRlZ29yeS1pZF1cIiApO1xuXHRcdFx0dGhpcy4kc3ViY2F0ZWdvcnlXcmFwcGVyID0gdGhpcy4kZWwuZmluZCggXCIuc3ViY2F0ZWdvcnktd3JhcHBlclwiICk7XG5cdFx0XHR0aGlzLiRzdWJjYXRlZ29yeVNlbGVjdCA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9c3ViY2F0ZWdvcnktaWRdXCIgKTtcblx0XHRcdHRoaXMuJHZhcmlhYmxlV3JhcHBlciA9IHRoaXMuJGVsLmZpbmQoIFwiLnZhcmlhYmxlLXdyYXBwZXJcIiApO1xuXHRcdFx0dGhpcy4kY2hhcnRWYXJpYWJsZSA9IHRoaXMuJGVsLmZpbmQoIFwiW25hbWU9Y2hhcnQtdmFyaWFibGVdXCIgKTtcblx0XHRcdFxuXHRcdFx0dGhpcy4kY2F0ZWdvcnlTZWxlY3Qub24oIFwiY2hhbmdlXCIsICQucHJveHkoIHRoaXMub25DYXRlZ29yeUNoYW5nZSwgdGhpcyApICk7XG5cdFx0XHR0aGlzLiRzdWJjYXRlZ29yeVNlbGVjdC5vbiggXCJjaGFuZ2VcIiwgJC5wcm94eSggdGhpcy5vblN1YkNhdGVnb3J5Q2hhbmdlLCB0aGlzICkgKTtcblxuXHRcdFx0dGhpcy4kc3ViY2F0ZWdvcnlXcmFwcGVyLmhpZGUoKTtcblx0XHRcdHRoaXMuJHZhcmlhYmxlV3JhcHBlci5oaWRlKCk7XG5cblx0XHR9LFxuXG5cdFx0b25DYXRlZ29yeUNoYW5nZTogZnVuY3Rpb24oIGV2dCApIHtcblx0XHRcdFxuXHRcdFx0dmFyICRpbnB1dCA9ICQoIGV2dC5jdXJyZW50VGFyZ2V0ICk7XG5cdFx0XHRpZiggJGlucHV0LnZhbCgpICE9IFwiXCIgKSB7XG5cdFx0XHRcdHRoaXMuJHN1YmNhdGVnb3J5V3JhcHBlci5zaG93KCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLiRzdWJjYXRlZ29yeVdyYXBwZXIuaGlkZSgpO1xuXHRcdFx0XHR0aGlzLiR2YXJpYWJsZVdyYXBwZXIuaGlkZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHQvL2ZpbHRlciBzdWJjYXRlZ29yaWVzIHNlbGVjdFxuXHRcdFx0dGhpcy4kc3ViY2F0ZWdvcnlTZWxlY3QuZmluZCggXCJvcHRpb25cIiApLmhpZGUoKTtcblx0XHRcdHRoaXMuJHN1YmNhdGVnb3J5U2VsZWN0LmZpbmQoIFwib3B0aW9uW2RhdGEtY2F0ZWdvcnktaWQ9XCIgKyAkaW5wdXQudmFsKCkgKyBcIl1cIiApLnNob3coKTtcblxuXHRcdH0sXG5cblx0XHRvblN1YkNhdGVnb3J5Q2hhbmdlOiBmdW5jdGlvbiggZXZ0ICkge1xuXG5cdFx0XHR2YXIgJGlucHV0ID0gJCggZXZ0LmN1cnJlbnRUYXJnZXQgKTtcblx0XHRcdGlmKCAkaW5wdXQudmFsKCkgIT0gXCJcIiApIHtcblx0XHRcdFx0dGhpcy4kdmFyaWFibGVXcmFwcGVyLnNob3coKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuJHZhcmlhYmxlV3JhcHBlci5oaWRlKCk7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdC8vZmlsdGVyIHN1YmNhdGVnb3JpZXMgc2VsZWN0XG5cdFx0XHR0aGlzLiRjaGFydFZhcmlhYmxlLmZpbmQoIFwib3B0aW9uOm5vdCg6ZGlzYWJsZWQpXCIgKS5oaWRlKCk7XG5cdFx0XHR0aGlzLiRjaGFydFZhcmlhYmxlLmZpbmQoIFwib3B0aW9uW2RhdGEtc3ViY2F0ZWdvcnktaWQ9XCIgKyAkaW5wdXQudmFsKCkgKyBcIl1cIiApLnNob3coKTtcblxuXHRcdH1cblxuXHR9O1xuXG5cdG1vZHVsZS5leHBvcnRzID0gQXBwLlZpZXdzLlVJLlZhcmlhYmxlU2VsZWN0cztcblxufSkoKTtcbiJdfQ==
