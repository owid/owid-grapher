;(function() {	
	"use strict";
	owid.namespace("App.Views.Form.DimensionsSectionsView");

	App.Views.Form.DimensionsSectionView = Backbone.View.extend({
		el: "#form-view #data-tab .dimensions-section",
		events: {
			"change [name='group-by-variable']": "onGroupByVariableChange"
		},

		initialize: function(options) {
			this.dispatcher = options.dispatcher;
			App.ChartDimensionsModel.on("change", this.render, this);
			this.dispatcher.on( "dimension-update", this.onDimensionUpdate, this );
			this.render();
		},

		render: function() {
			this.$formSectionContent = this.$el.find( ".form-section-content" );
			this.$dimensionsInput = this.$el.find( "[name='chart-dimensions']" );
			this.$groupByVariable = this.$el.find( ".group-by-variable-wrapper" );
			this.$groupByVariableInput = this.$groupByVariable.find( "[name='group-by-variable']" );

			//get rid of old content
			this.$formSectionContent.empty();

			//construct html
			var chartType = App.ChartModel.get("chart-type"),
				dimensions = App.ChartDimensionsModel.get("chartDimensions"),
				htmlString = "<ol class='dimensions-list chart-type-" + chartType + "'>";

			_.each(dimensions, function(v, k) {
				htmlString += "<li data-property='" + v.property + "' class='dimension-box'><h4>" + v.name + "</h4><div class='dd-wrapper'><div class='dd'><div class='dd-empty'></div></div></div></li>";
			});

			htmlString += "</ol>";

			var $html = $(htmlString);
			this.$formSectionContent.append($html);

			this.$dd = this.$el.find(".dd");
			this.$dd.nestable();
			this.$dimensionBoxes = this.$el.find(".dimension-box");
			this.$dd.on('change', function() {
				this.updateInput();
			}.bind(this));

			//if editing chart - assign possible chart dimensions to available dimensions
			var chartDimensions = App.ChartModel.get("chart-dimensions");
			this.setInputs(chartDimensions);

			// For line and stacked area charts, allow optional grouping by variable
			if (chartType == App.ChartType.LineChart || chartType == App.ChartType.StackedArea) {
				var groupByVariables = App.ChartModel.get("group-by-variables");
				this.$groupByVariableInput.prop("checked", groupByVariables);
				this.$groupByVariable.show();
			} else {
				App.ChartModel.set("group-by-variables", false);
				this.$groupByVariable.hide();
			}
		},

		updateInput: function() {
			var dimensions = [];
			$.each(this.$dimensionBoxes, function(i, v) {
				var $box = $(v),
					$droppedVariables = $box.find( ".variable-label" );
				if( $droppedVariables.length ) {
					//just in case there were more variables
					$.each( $droppedVariables, function( i, v ) {
						var $droppedVariable = $( v ),
							dimension = { variableId: $droppedVariable.attr( "data-variable-id" ), displayName: $droppedVariable.find(".variable-label-name").text(), property: $box.attr( "data-property" ), unit: $droppedVariable.attr( "data-unit" ), name: $box.find( "h4" ).text(), period: $droppedVariable.attr( "data-period" ), mode: $droppedVariable.attr( "data-mode" ), targetYear: $droppedVariable.attr( "data-target-year" ), tolerance: $droppedVariable.attr( "data-tolerance" ), maximumAge: $droppedVariable.attr( "data-maximum-age" ) };
						dimensions.push( dimension );
					} );
				}
			} );

			var json = JSON.stringify(dimensions);
			this.$dimensionsInput.val(json);
			App.ChartModel.set("chart-dimensions", json);
		},

		setInputs: function(chartDimensions) {
			if( !chartDimensions || !chartDimensions.length ) {
				return;
			}

			//convert to json
			chartDimensions = $.parseJSON( chartDimensions );

			var that = this;
			_.each(chartDimensions, function(chartDimension, i) {
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
			});	
		},

		onDimensionUpdate: function() {
			this.updateInput();
		},

		onGroupByVariableChange: function() {
			var groupByVariable = this.$groupByVariableInput.is(":checked");
			App.ChartModel.set("group-by-variables", groupByVariable);
		}
	});
})();