import _ from 'underscore'
import $ from 'jquery'
import ChartType from '../charts/ChartType'
import LineType from '../charts/LineType'

owid.namespace("App.Views.Form.StylingTabView");

App.Views.Form.StylingTabView = owid.View.extend({
	el: "#form-view #styling-tab",
	events: {
		"change [name='logo']": "onLogoChange",
		"change [name='second-logo']": "onLogoChange",
		"change [name='line-type']": "onLineTypeChange",
		"change [name='line-tolerance']": "onLineToleranceChange",
		"change [name='hide-legend']": "onHideLegendChange",
		"change [name='hide-toggle']": "onHideToggleChange",
		"change [name='entity-type']": "onEntityTypeChange",
		"change .units-section .form-control[type=input]": "updateUnits",
		"change .units-section [type=checkbox]": "updateUnits"
	},

	initialize: function( options ) {
		//logos
		this.$logo = this.$el.find("[name='logo']");

		this.$lineTypeRadios = this.$el.find( "[name='line-type']" );
		this.$lineTolerance = this.$el.find("[name='line-tolerance']");

		//legend
		this.$hideLegend = this.$el.find( "[name='hide-legend']" );
		this.$hideToggle = this.$el.find("[name='hide-toggle']");
		this.$entityType = this.$el.find("[name='entity-type']");

		//units
		this.$unitsSection = this.$el.find( ".units-section" );
		this.$unitsContent = this.$unitsSection.find(".form-section-content");

		this.listenTo(App.ChartModel, "change:chart-type", this.render.bind(this));
		this.listenTo(App.ChartModel, "change:chart-dimensions", this.render.bind(this));
		this.listenTo(App.ChartModel, "change:line-type", this.renderLineType.bind(this));

		this.render();
	},

	render: function() {
		var logos = App.ChartModel.get('logos');
		this.$logo.val(logos[0]);

		this.renderLineType();

		var hideLegend = ( App.ChartModel.get( "hide-legend" ) )? true: false;
		this.$hideLegend.prop( "checked", hideLegend );
		this.$entityType.val(App.ChartModel.get("entity-type"));

		this.$hideToggle.closest('label').toggle(App.ChartModel.get("chart-type") == ChartType.StackedArea);
		this.$hideToggle.prop("checked", !!App.ChartModel.get("hide-toggle"));

		this.updateUnitsUI();
		this.updateUnits();

		var chartType = App.ChartModel.get("chart-type");
		if (chartType == ChartType.LineChart) {
			if (this.$typeOfLine) {
				this.$el.prepend(this.$typeOfLine);
				this.$typeOfLine = null;
			}
		} else {
			this.$typeOfLine = this.$el.find(".type-of-line-section").remove();
		}
	},

	renderLineType: function() {
		var lineType = App.ChartModel.get( "line-type" );
		this.$lineTypeRadios.filter( "[value='" + lineType + "']" ).prop( "checked", true );
		this.$lineTolerance.val(App.ChartModel.get("line-tolerance"));

		if (lineType == LineType.UnjoinedIfMissing || lineType == LineType.DashedIfMissing)
			this.$lineTolerance.closest("label").show();
		else
			this.$lineTolerance.closest("label").hide();
	},

	onLogoChange: function(evt) {
		App.ChartModel.set("logos", [this.$logo.val()]);
	},

	onLineTypeChange: function(evt) {
		var $radio = $(evt.currentTarget);
		App.ChartModel.set("line-type", $radio.val());
	},

	onLineToleranceChange: function(evt) {
		App.ChartModel.set("line-tolerance", this.$lineTolerance.val());
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

	onHideToggleChange: function() {
		App.ChartModel.set("hide-toggle", this.$hideToggle.prop("checked"));
	},

	onEntityTypeChange: function() {
		App.ChartModel.set("entity-type", this.$entityType.val());
	},

	// TODO: make this work for multiple dimensions with same property
	updateUnitsUI: function( evt ) {
		var dimensions = _.uniq(App.ChartModel.getDimensions(), function(dim) { return dim.property; }),
			unitsString = App.ChartModel.get( "units" ),
			units = ( !$.isEmptyObject( unitsString ) )? $.parseJSON( unitsString ): {};

		//refresh whole unit section
        if (!this.$unitsContent.length) this.$unitsContent = $('<div></div>').appendTo(this.$unitsSection);
		this.$unitsContent.html( "<ul></ul>" );
		var $ul = this.$unitsContent.find("ul");

		_.each(dimensions, function(dimension) {
			if (dimension.property == "color") return;

			var unitObj = _.findWhere(units, { "property": dimension.property }),
				visible = unitObj && unitObj.hasOwnProperty("visible") ? unitObj.visible : true,
				visibleProp = ( visible )? " checked": "",
				title = ( unitObj && unitObj.title ) ? unitObj.title : "",
				unit = ( unitObj && unitObj.unit )? unitObj.unit: "",
				format = ( unitObj && unitObj.format )? unitObj.format: "";

			if (!unitObj && dimension && dimension.unit) {
				//if nothing stored, try to get default units for given variable
				unit = dimension.unit;
			}

			var $li = $("<li data-property='" + dimension.property + "'>" +
				           "<label>" + dimension.property + ":</label>" +
				           "Visible:<input type='checkbox' class='visible-input' " + visibleProp + "/>" +
					           "<input type='input' class='form-control title-input' value='" + title + "' placeholder='Short title' />" +
				           "<input type='input' class='form-control unit-input' value='" + unit + "' placeholder='Unit' />" +
				           "<input type='input' class='form-control format-input' value='" + format + "' placeholder='No of dec. places' />" +
				         "</li>" );
			$ul.append( $li );
		} );
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
				"property": $li.attr("data-property"),
				"visible": $visible.is(":checked"),
				"title": $title.val(),
				"unit": $unit.val(),
				"format": $format.val()
			};

			units.push(unitSettings);
		} );

		var json = JSON.stringify(units);
		App.ChartModel.set("units", json);
	}

});
