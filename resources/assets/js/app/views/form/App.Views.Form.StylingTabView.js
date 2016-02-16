;( function() {
	
	"use strict";

	var App = require( "./../../namespaces.js" );

	App.Views.Form.StylingTabView = Backbone.View.extend({

		el: "#form-view #styling-tab",
		events: {
			"change [name='logo']": "onLogoChange",
			"change [name='line-type']": "onLineTypeChange",
			"input [name^='margin-']": "onMarginChange",
			"change [name='hide-legend']": "onHideLegendChange"
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			
			//logos
			this.$logo = this.$el.find( "[name='logo']" );

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
			
			var logoId = App.ChartModel.get( "logo" );
			this.$logo.val( logoId );

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
			this.updateUnitsDebounced = _.debounce( this.updateUnits, 250 );
			$( ".units-section [type=checkbox]" ).on( "change", $.proxy( this.updateUnits, this ) );
			$( ".units-section .form-control[type=input]" ).on( "input", $.proxy( this.updateUnitsDebounced, this ) );
		},

		onLogoChange: function( evt ) {

			var $select = $( evt.currentTarget ),
				logoId = $select.val();
			App.ChartModel.set( "logo", logoId );

		},

		onLineTypeChange: function( evt ) {

			var $radio = $( evt.currentTarget );
			App.ChartModel.set( "line-type", $radio.val() );

		},

		onMarginChange: _.debounce( function( evt ) {

			var $control = $( evt.currentTarget ),
				controlName = $control.attr( "name" ),
				marginsObj = { top: this.$marginTop.val(),
							left: this.$marginLeft.val(),
							right: this.$marginRight.val(),
							bottom: this.$marginBottom.val() };

			App.ChartModel.set( "margins", marginsObj );
			App.ChartModel.trigger( "update" );

		}, 250 ),

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