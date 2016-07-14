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
			"click .fa-close": "onRemoveBtn",
			"change [name='group-by-variable']": "onGroupByVariableChange",
			"change .dd": "saveDimensions"
		},

		initialize: function(options) {
			this.selectVarPopup = this.addChild(SelectVarPopup, options);	
			this.listenTo(this.selectVarPopup, "new-variable", this.onNewVariable.bind(this));

			this.$reserveSection = this.$el.find(".add-data-section");
			this.$dimensionsContent = this.$el.find(".dimensions-section .form-section-content");
			this.$groupByVariableWrapper = this.$el.find(".group-by-variable-wrapper");			
			this.$groupByVariable = this.$el.find("[name='group-by-variable']");

			this.listenTo(App.ChartModel, "change:chart-type", this.render);

			App.DataModel.ready(function() {
				this.render();
			}.bind(this));	
		},

		onAddDataBtn: function() {
			this.selectVarPopup.show();
		},

		onRemoveBtn: function() {
			var $li = $(evt.currentTarget).closest('.variable-item'),
				variableId = $li.attr("data-variable-id");
			$li.remove();
		},

		onNewVariable: function(variable) {
			var $li = this.makeVariableItem(variable);
			this.assignToSlot(this.$reserveSection, $li);
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
					})
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
						'			<span class="fa fa-cog" title="Variable settings"></span>' +
						'			<span class="fa fa-close"></span>' +
						'		</div>' +
						'	</div>' +
						'</li>');

			$li.attr("data-variable-id", settings.variableId);
			$li.attr("data-unit", settings.unit);
			$li.attr("data-period", settings.period);
			$li.attr("data-mode", settings.mode);
			$li.attr("data-target-year", settings.targetYear);
			$li.attr("data-tolerance", settings.tolerance);
			$li.attr("data-maximum-age", settings.maxAge);

			return $li;
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

	App.Views.Form.OldAddDataSectionView = owid.View.extend({
		el: "#form-view #data-tab",
		events: {
			"click .add-data-btn": "onAddDataBtn",
		},

		initialize: function(options) {
			this.dispatcher = options.dispatcher;
			this.selectVarPopup = this.addChild(SelectVarPopup, options);
			this.settingsVarPopup = this.addChild(SettingsVarPopup, options);
			this.settingsVarPopup.init(options);

			this.listenTo(App.ChartVariablesCollection, "reset", this.onVariableReset.bind(this));
			this.listenTo(App.ChartVariablesCollection, "add", this.onVariableAdd.bind(this));
			this.listenTo(App.ChartVariablesCollection, "remove", this.onVariableRemove.bind(this));

			this.listenTo(this.dispatcher, "variable-label-moved", this.onVariableLabelMoved.bind(this));
			this.listenTo(this.dispatcher, "dimension-setting-update", this.onDimensionSettingUpdate.bind(this));

			this.render();
		},

		onAddDataBtn: function() {
			this.selectVarPopup.show();
		},

		refreshHandlers: function() {
			var $removeBtns = this.$ddList.find(".fa-close");
			$removeBtns.on( "click", $.proxy( this.onRemoveBtnClick, this ) );
			this.$dd.nestable();
		},


		onVariableReset: function() {
			var models = App.ChartVariablesCollection.models;
			_.each(models, function(v, i) {
				this.onVariableAdd(v);
			}.bind(this));
		},

		onVariableAdd: function( model ) {
			//if there's empty element, remove it
			this.$el.find( ".dd-empty" ).remove();
			//refetch dd-list - needed if there was something removed
			this.$ddList = this.$dd.find( ".dd-list" );

			if(!this.$dd.find(".dd-list").length) {
				//dd-list has been removed by nestable
				var $ddList = $("<ol class='dd-list'></ol>");
				this.$dd.append($ddList);
				this.$ddList = this.$dd.find(".dd-list");
			}

			//have default target year for scatter plot
			var defaultPeriod = App.ChartModel.get("chart-type") == App.ChartType.ScatterPlot ? "single" : "all",
				defaultMode = App.ChartModel.get("chart-type") == App.ChartType.ScatterPlot ? "specific" : "closest",
				defaultTargetYear = 2000,
				defaultMaxAge = 5,
				defaultTolerance = 5;

			var $li = $("<li class='variable-label dd-item' data-unit='" + model.get("unit") + "' data-period='" + defaultPeriod + "' data-tolerance='" + defaultTolerance + "' data-maximum-age='" + defaultMaxAge + "' data-mode='" + defaultMode + "' data-target-year='" + defaultTargetYear + "' data-variable-id='" + model.get("id") + "'><div class='dd-handle'><div class='dd-inner-handle'><span class='variable-label-name'>" + model.get("name") + "</span><span class='variable-label-input'><input class='form-control'/><i class='fa fa-check'></i><i class='fa fa-times'></i></div></div><a href='' class='variable-setting-btn'><span class='fa fa-cog' title='Setting variable'></span></a><span class='fa fa-close'></span></li>"),
				$settings = $li.find(".variable-setting-btn");
			this.$ddList.append($li);

			$settings.on("click", $.proxy(this.onSettingsClick, this));

			this.refreshHandlers();
			this.updateVarIcons();

			this.$el.find(".form-section-desc").removeClass( "hidden" );
		},

		onVariableLabelMoved: function() {
			//check if there's any variable label left, if not insert empty dd placeholder
			if( !this.$el.find( ".variable-label" ).length ) {
				this.$el.find( ".dd-list" ).replaceWith( "<div class='dd-empty'></div>" );
			}
		},

		onSettingsClick: function(evt) {
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
			for (var i in data) {
				if (i == "name") {
					$variableLabel.find(".variable-label-name").text(data[i]);
				} else if (data.hasOwnProperty(i) && i !== "variableId") {
					var attrName = "data-" + i,
						attrValue = data[i];
					$variableLabel.attr(attrName, attrValue);
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
					$periodIcon.addClass( "fa-arrows-h");
					$periodIcon.removeClass( "fa-circle");
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
			} );

		},

		onVariableRemove: function( model ) {
			console.log("variable removed");
			var $liToRemove = $( ".variable-label[data-variable-id='" + model.get( "id" ) + "']" );
			$liToRemove.remove();

			if (App.ChartVariablesCollection.models.length == 0) {
				this.$el.find( ".form-section-desc" ).addClass( "hidden" );
			}
		}

	});
})();