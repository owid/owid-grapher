;(function() {	
	"use strict";
	owid.namespace("App.Views.Form.StylingTabView");

	App.Views.Form.StylingTabView = owid.View.extend({
		el: "#form-view #styling-tab",
		events: {
			"change [name='logo']": "onLogoChange",
			"change [name='second-logo']": "onLogoChange",
			"change [name='line-type']": "onLineTypeChange",
			"change [name='line-tolerance']": "onLineToleranceChange",
			"change [name^='margin-']": "onMarginChange",
			"change [name='hide-legend']": "onHideLegendChange",
			"change [name='entity-type']": "onEntityTypeChange",
			"change .units-section .form-control[type=input]": "updateUnits",
			"change .units-section [type=checkbox]": "updateUnits"
		},

		initialize: function( options ) {
			this.dispatcher = options.dispatcher;
			
			//logos
			this.$logo = this.$el.find( "[name='logo']" );
			this.$secondLogo = this.$el.find("[name='second-logo']");

			this.$lineTypeRadios = this.$el.find( "[name='line-type']" );
			this.$lineTolerance = this.$el.find("[name='line-tolerance']");
			
			//margins
			this.$marginTop = this.$el.find( "[name='margin-top']" );
			this.$marginLeft = this.$el.find( "[name='margin-left']" );
			this.$marginRight = this.$el.find( "[name='margin-right']" );
			this.$marginBottom = this.$el.find( "[name='margin-bottom']" );
			
			//legend
			this.$hideLegend = this.$el.find( "[name='hide-legend']" );
			this.$entityType = this.$el.find("[name='entity-type']");

			//units
			this.$unitsSection = this.$el.find( ".units-section" );
			this.$unitsContent = this.$unitsSection.find( ".form-section-content" );
			
			this.listenTo(App.ChartModel, "change:chart-type", this.onChartTypeChange.bind(this));
			this.listenTo(App.ChartModel, "change:chart-dimensions", this.render.bind(this));
			this.listenTo(App.ChartModel, "change:line-type", this.renderLineType.bind(this));
			
			this.render();
		},

		render: function() {
			var logoId = App.ChartModel.get("logo");
			this.$logo.val(logoId);
			var secondLogoId = App.ChartModel.get("second-logo");
			this.$secondLogo.val(secondLogoId);

			this.renderLineType();

			var margins = App.ChartModel.get( "margins" );
			this.$marginTop.val( margins.top );
			this.$marginLeft.val( margins.left );
			this.$marginRight.val( margins.right );
			this.$marginBottom.val( margins.bottom );

			var hideLegend = ( App.ChartModel.get( "hide-legend" ) )? true: false;
			this.$hideLegend.prop( "checked", hideLegend );
			this.$entityType.val(App.ChartModel.get("entity-type"));
			
			this.updateUnitsUI();
			this.updateUnits();
		},

		renderLineType: function() {
			var lineType = App.ChartModel.get( "line-type" );
			this.$lineTypeRadios.filter( "[value='" + lineType + "']" ).prop( "checked", true );
			this.$lineTolerance.val(App.ChartModel.get("line-tolerance"));

			if (lineType == App.LineType.UnjoinedIfMissing || lineType == App.LineType.DashedIfMissing)
				this.$lineTolerance.closest("label").show();
			else
				this.$lineTolerance.closest("label").hide();
		},

		onLogoChange: function(evt) {
			App.ChartModel.set("logo", this.$logo.val());
			App.ChartModel.set("second-logo", this.$secondLogo.val());
		},

		onLineTypeChange: function(evt) {
			var $radio = $(evt.currentTarget);
			App.ChartModel.set("line-type", $radio.val());
		},

		onLineToleranceChange: function(evt) {
			App.ChartModel.set("line-tolerance", this.$lineTolerance.val());
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

		onEntityTypeChange: function() {
			App.ChartModel.set("entity-type", this.$entityType.val());
		},

		onChartTypeChange: function( evt ) {

			if( App.ChartModel.get( "chart-type" ) === "2" ) {
				//scatter plot has legend hidden by default
				App.ChartModel.set( "hide-legend", true );
			}

		},

		updateUnitsUI: function( evt ) {
			var dimensionsString = App.ChartModel.get( "chart-dimensions" ),
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
						title = ( unitObj && unitObj.title ) ? unitObj.title : "",
						unit = ( unitObj && unitObj.unit )? unitObj.unit: "",
						format = ( unitObj && unitObj.format )? unitObj.format: "";

					if( !unitObj && dimension && dimension.unit ) {
						//if nothing stored, try to get default units for given variable
						unit = dimension.unit;
					}

					var $li = $("<li data-property='" + dimension.property + "'>" +
						           "<label>" + dimension.name + ":</label>" +
						           "Visible:<input type='checkbox' class='visible-input' " + visibleProp + "/>" +
   						           "<input type='input' class='form-control title-input' value='" + title + "' placeholder='Short title' />" +
						           "<input type='input' class='form-control unit-input' value='" + unit + "' placeholder='Unit' />" +
						           "<input type='input' class='form-control format-input' value='" + format + "' placeholder='No of dec. places' />" +
						         "</li>" );
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
					$title = $li.find( ".title-input" ),
					$unit = $li.find( ".unit-input" ),
					$format = $li.find( ".format-input" );

				//for each li with unit information, construct object with property, unit and format properties
				var unitSettings = {
					"property": $li.attr( "data-property" ),
					"visible": $visible.is( ":checked" ),
					"title": $title.val(),
					"unit": $unit.val(),
					"format": $format.val()
				};

				units.push( unitSettings );
			} );

			var json = JSON.stringify( units );
			App.ChartModel.set( "units", json );
		}

	});
})();