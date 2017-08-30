import _ from 'underscore'
import $ from 'jquery'
import ChartType from '../charts/ChartType'

owid.namespace("App.Views.Form.AddDataSectionView");

var	SelectVarPopup = App.Views.UI.SelectVarPopup,
	SettingsVarPopup = App.Views.UI.SettingsVarPopup,
	ColorPicker = App.Views.UI.ColorPicker;

// Handles the somewhat fiddly work of adding variables to a chart and then
// assigning them to be displayed in a particular "dimension" slot
App.Views.Form.AddDataSectionView = owid.View.extend({
	el: "#form-view #data-tab",
	events: {
		"click .add-data-btn": "onAddDataBtn",
		"click .fa-close": "onVariableRemoveBtn",
		"click .fa-cog": "onVariableSettingsBtn",
		"click .fa-paint-brush": "onVariableColorpicker",
		"change [name='group-by-variable']": "onGroupByVariableChange",
		"change .dd": "saveDimensions"
	},

	initialize: function(options) {
		this.selectVarPopup = this.addChild(SelectVarPopup, options);	
		this.settingsVarPopup = this.addChild(SettingsVarPopup, options);
		this.settingsVarPopup.init(options);

		this.listenTo(this.selectVarPopup, "new-variable", this.onNewVariable.bind(this));
		this.listenTo(this.settingsVarPopup, "variable-settings", this.onVariableSettingsUpdate.bind(this));

		this.$reserveSection = this.$el.find(".add-data-section");
		this.$dimensionsContent = $("<div></div>").appendTo(this.$el.find(".dimensions-section"));
		this.$groupByVariableWrapper = this.$el.find(".group-by-variable-wrapper");			
		this.$groupByVariable = this.$el.find("[name='group-by-variable']");

		var update = function() {
			App.ChartData.ready(this.render.bind(this));
		}.bind(this);

		this.listenTo(App.ChartModel, "change:chart-type", update);
		update();
	},

	onAddDataBtn: function(evt) {
		this.selectVarPopup.show();
	},

	// When a variable is added via "Add variable", assign it to a reserve slot
	onNewVariable: function(variable) {
		var $li = this.makeVariableItem(variable);
		this.assignToSlot(this.$reserveSection, $li);
		this.$el.find(".form-section-desc.hidden").removeClass("hidden");
	},

	onVariableRemoveBtn: function(evt) {
		var $label = $(evt.target).closest(".variable-label"),
			$dd = $(evt.target).closest(".dd");

		$(evt.currentTarget).closest('.variable-label').remove();
		if ($dd.find(".dd-list").is(":empty")) {
			$dd.find(".dd-list").replaceWith('<div class="dd-empty"></div>');
		}
	},

	onVariableSettingsBtn: function(evt) {
		this.settingsVarPopup.show($(evt.target).closest('.variable-label'));		
	},

	onVariableSettingsUpdate: function($li, settings) {
		this.applySettingsToItem($li, settings);

		// settings already come back in the form e.g. 'targetYear'
        for (var i in settings) {
            if (settings.hasOwnProperty(i) && i !== "variableId") {
                var attrName = "data-" + i,
                    attrValue = settings[i];

                $li.attr(attrName, attrValue);
            }
        } 

		this.settingsVarPopup.hide();
		this.saveDimensions();
	},

	onVariableColorpicker: function(evt) {
		var $li = $(evt.target).closest(".variable-label");
		if (this.colorPicker) this.colorPicker.onClose();
		this.colorPicker = new ColorPicker({ target: $li, currentColor: $li.attr("data-color") });
		this.colorPicker.onSelected = function(value) {
			$li.css("background-color", value);
			if (!value)
				$li.removeAttr("data-color")
			else
				$li.attr("data-color", value);
			this.saveDimensions();
		}.bind(this);
	},

	onGroupByVariableChange: function() {
		var groupByVariable = this.$groupByVariableInput.is(":checked");
		App.ChartModel.set("group-by-variables", groupByVariable);
	},

	saveDimensions: function() {
		var dimensions = [];
		_.each(this.$dimensionsContent.find("li.dimension-box"), function(el) {
			var $box = $(el);
			_.each($box.find(".variable-label"), function(el) {
				var $item = $(el);
				dimensions.push({
					property: $box.attr("data-property"),
					variableId: $item.attr("data-variable-id"),
					displayName: $item.attr("data-display-name"),
					unit: $item.attr("data-unit"),
					targetYear: _.isNumber(parseInt($item.attr("data-targetYear"))) ? parseInt($item.attr("data-targetYear")) : null,
					tolerance: $item.attr("data-tolerance"),
					color: $item.attr("data-color"),
					isProjection: $item.attr("data-isProjection") == "true"
				});
			});
		});

		App.ChartModel.set("chart-dimensions", dimensions);
	},

	render: function() {
		// Create slots for the variables to go in by what dimensions the chart has available
		var html = '<ol class="dimensions-list">';
		var emptyDimensions = App.ChartModel.getEmptyDimensions();
		_.each(emptyDimensions, function(dimension) {
			html += '<li data-property="' + dimension.property + '" class="dimension-box">' +
				        '<h4>' + dimension.name + '</h4>' +
				        '<div class="dd-wrapper">' + 
				             '<div class="dd">' +
				                  '<div class="dd-empty"></div>' +
				             '</div>' +
				        '</div>' +
				    '</li>';
		});
		this.$dimensionsContent.html(html);

		// Now assign any current variables to the appropriate slots
		var dimensions = App.ChartModel.getDimensions();
		_.each(dimensions, function(dimension) {
			// Except the default scatterplot dimension
			if (dimension.property == 'color' && dimension.variableId == 123)
				return;

			var variable = App.VariableData.get("variables")[dimension.variableId],
				$slot = this.$el.find('[data-property='+dimension.property+']'),
				$li = this.makeVariableItem(_.extend({}, dimension, { variableName: variable.name }));

			this.assignToSlot($slot, $li);
		}.bind(this));

		// For line and stacked area charts, give an option to group by variable
		var chartType = App.ChartModel.get("chart-type");
		if (chartType == ChartType.LineChart || chartType == ChartType.StackedArea) {
			var groupByVariables = App.ChartModel.get("group-by-variables");
			this.$groupByVariable.prop("checked", groupByVariables);
			this.$groupByVariableWrapper.show();
		} else {
			App.ChartModel.set("group-by-variables", false);
			this.$groupByVariableWrapper.hide();
		}

		this.$el.find(".dd").nestable();
	},

	makeVariableItem: function(dimensionSettings) {
		if (!dimensionSettings.variableId || !dimensionSettings.variableName)
			throw "Can't make a variable dd item without a variable";

		var defaults = {
			unit: '',
			targetYear: '',
			tolerance: 5,	
			isProjection: false			
		};

		var settings = _.extend({}, defaults, dimensionSettings);

		var $li = $('<li class="variable-label dd-item">' +
					'	<div class="dd-handle">' +
					'		<div class="dd-inner-handle">' +
					'			<span class="variable-label-name">' + settings.variableName + '</span>' +
					'		</div>' +
					'	</div>' +
					'	<span class="buttons">' +
					'		<span class="fa fa-paint-brush clickable" title="Set color"></span>' +
					'		<span class="fa fa-cog clickable" title="Variable settings"></span>' +
					'		<span class="fa fa-close clickable"></span>' +
					'	</span>' +
					'</li>');			

		this.applySettingsToItem($li, settings);
		return $li;
	},

	applySettingsToItem: function($li, settings) {
		$li.attr("data-variable-id", settings.variableId);
		$li.attr("data-display-name", settings.displayName);
		$li.attr("data-unit", settings.unit);
		$li.attr("data-targetYear", settings.targetYear);
		$li.attr("data-tolerance", settings.tolerance);
		$li.attr("data-color", settings.color);
		$li.attr("data-isProjection", settings.isProjection);
		if (settings.color) $li.css("background-color", settings.color);
	},

	assignToSlot: function($slot, $li) {
		$slot.find(".dd-empty").remove();

		if (!$slot.find(".dd-list").length) {
			var $ddList = $("<ol class='dd-list'></ol>");
			$slot.find(".dd").append($ddList);
		}
		$slot.find(".dd-list").append($li);
	},
});