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
});
