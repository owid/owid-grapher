;(function() {	
	"use strict";
	owid.namespace("App.Views.Form.AddDataSectionView");
	
	var	SelectVarPopup = App.Views.UI.SelectVarPopup,
		SettingsVarPopup = App.Views.UI.SettingsVarPopup;

	// Handles the somewhat fiddly work of adding variables to a chart and then
	// assigning them to be displayed in a particular "dimension" slot
	App.Views.Form.AddDataSectionView = owid.View.extend({
		el: "#form-view #data-tab",
		events: {
			"click .add-data-btn": "onAddDataBtn",
			"click .fa-close": "onVariableRemoveBtn",
			"click .fa-cog": "onVariableSettingsBtn",
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
			this.$dimensionsContent = this.$el.find(".dimensions-section .form-section-content");
			this.$groupByVariableWrapper = this.$el.find(".group-by-variable-wrapper");			
			this.$groupByVariable = this.$el.find("[name='group-by-variable']");

			var update = function() {
				App.DataModel.ready(this.render.bind(this));
			}.bind(this);

			this.listenTo(App.ChartModel, "change:chart-type", update);
			update();
		},

		onAddDataBtn: function() {
			this.selectVarPopup.show();
		},

		// When a variable is added via "Add variable", assign it to a reserve slot
		onNewVariable: function(variable) {
			var $li = this.makeVariableItem(variable);
			this.assignToSlot(this.$reserveSection, $li);
			this.$el.find(".form-section-desc.hidden").removeClass("hidden");
		},

		onVariableRemoveBtn: function(evt) {
			$(evt.currentTarget).closest('.variable-item').remove();
		},

		onVariableSettingsBtn: function(evt) {
			this.settingsVarPopup.show($(evt.target).closest('.variable-item'));		
		},

		onVariableSettingsUpdate: function(settings) {
			var $li = $(".variable-item[data-variable-id='" + settings.variableId + "']");
			this.applySettingsToItem($li, settings);

			// settings already come back in the form e.g. 'target-year'
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

		onGroupByVariableChange: function() {
			var groupByVariable = this.$groupByVariableInput.is(":checked");
			App.ChartModel.set("group-by-variables", groupByVariable);
		},

		saveDimensions: function() {
			var dimensions = [];
			_.each(this.$dimensionsContent.find("li.dimension-box"), function(el) {
				var $box = $(el);
				_.each($box.find(".variable-item"), function(el) {
					var $item = $(el);
					dimensions.push({
						property: $box.attr("data-property"),
						variableId: $item.attr("data-variable-id"),
						displayName: $item.attr("data-display-name"),
						unit: $item.attr("data-unit"),
						period: $item.attr("data-period"),
						mode: $item.attr("data-mode"),
						targetYear: $item.attr("data-target-year"),
						tolerance: $item.attr("data-tolerance"),
						maximumAge: $item.attr("data-maximum-age")
					});
				});
			});

			App.ChartModel.set("chart-dimensions", JSON.stringify(dimensions));
		},

		render: function() {
			// Create slots for the variables to go in by what dimensions the chart has available
			var html = '<ol class="dimensions-list">';
			var emptyDimensions = this.getDimensionsForChartType();
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
			var dimensions = JSON.parse(App.ChartModel.get("chart-dimensions"));
			_.each(dimensions, function(dimension) {
				var variable = App.DataModel.get("variableData").variables[dimension.variableId],
					$slot = this.$el.find('[data-property='+dimension.property+']'),
					$li = this.makeVariableItem(_.extend({}, dimension, { variableName: variable.name }));

				this.assignToSlot($slot, $li);
			}.bind(this));

			// For line and stacked area charts, give an option to group by variable
			var chartType = App.ChartModel.get("chart-type");
			if (chartType == App.ChartType.LineChart || chartType == App.ChartType.StackedArea) {
				var groupByVariables = App.ChartModel.get("group-by-variables");
				this.$groupByVariable.prop("checked", groupByVariables);
				this.$groupByVariableWrapper.show();
			} else {
				App.ChartModel.set("group-by-variables", false);
				this.$groupByVariableWrapper.hide();
			}

			this.$el.find(".dd").nestable();
		},

		getDimensionsForChartType: function() {
			var chartType = App.ChartModel.get("chart-type");

			var xAxis = { property: 'x', name: 'X axis', },
				yAxis = { property: 'y', name: 'Y axis', },
				color = { property: 'color', name: 'Color' },
				shape = { property: 'shape', name: 'Shape' },
				size = { property: 'size', name: 'size' };

			if (chartType == App.ChartType.ScatterPlot)
				return [xAxis, yAxis, size, shape, color];
			else
				return [yAxis, color];
		},

		makeVariableItem: function(dimensionSettings) {
			if (!dimensionSettings.variableId || !dimensionSettings.variableName)
				throw "Can't make a variable dd item without a variable";

			var defaults = {
				unit: '',
				period: App.ChartModel.get("chart-type") == App.ChartType.ScatterPlot ? "single" : "all",
				mode: App.ChartModel.get("chart-type") == App.ChartType.ScatterPlot ? "specific" : "closest",
				targetYear: 2000,
				tolerance: 5,				
				maxAge: 5
			};

			var settings = _.extend({}, defaults, dimensionSettings);

			var $li = $('<li class="variable-item dd-item">' +
						'	<div class="dd-handle">' +
						'		<div class="dd-inner-handle">' +
						'			<span class="variable-item-name">' + settings.variableName + '</span>' +
						'		</div>' +
						'	</div>' +
						'	<span class="fa fa-cog" title="Variable settings"></span>' +
						'	<span class="fa fa-close"></span>' +
						'</li>');

			this.applySettingsToItem($li, settings);
			return $li;
		},

		applySettingsToItem: function($li, settings) {
			$li.attr("data-variable-id", settings.variableId);
			$li.attr("data-unit", settings.unit);
			$li.attr("data-period", settings.period);
			$li.attr("data-mode", settings.mode);
			$li.attr("data-target-year", settings.targetYear);
			$li.attr("data-tolerance", settings.tolerance);
			$li.attr("data-maximum-age", settings.maxAge);			
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
})();