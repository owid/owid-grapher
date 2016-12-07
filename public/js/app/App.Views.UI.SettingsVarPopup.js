;(function() {
	"use strict";
	owid.namespace("App.Views.UI.SettingsVarPopup");

	App.Views.UI.SettingsVarPopup = owid.View.extend({
		init: function(options) {
			this.dispatcher = options.dispatcher;

			//will be filled when opening popup
			this.variableId = -1;

			//flag for 
			this.valid = true;

			this.$el = $(".settings-var-popup");
			this.$closeBtn = this.$el.find(".close");
			this.$saveBtn = this.$el.find(".btn-primary");
			this.$cancelBtn = this.$el.find(".btn-default");

			this.$nameInput = this.$el.find(".settings-var-name input");
			this.$advancedSettings = this.$el.find(".advanced-settings");
			this.$digitInputs = this.$el.find(".digit-input");
			this.$singleInputs = this.$el.find("[name=single]");
			this.$allInputs = this.$el.find("[name=all]");
			this.$contentSingle = this.$el.find(".settings-var-content-single");
				
			this.$contentSingleSpecific = this.$el.find(".settings-var-single-specific-content");
			this.$contentSingleLatest = this.$el.find(".settings-var-single-latest-content");

			this.$closeBtn.on("click", $.proxy(this.onCloseBtn, this));
			this.$el.find("form").on("submit", $.proxy(this.onSaveBtn, this));
			this.$saveBtn.on("click", $.proxy(this.onSaveBtn, this));
			this.$cancelBtn.on("click", $.proxy(this.onCancelBtn, this));
			
			this.$digitInputs.on("change", $.proxy(this.onDigitInputs, this));
			this.$singleInputs.on("change", $.proxy(this.onSingleInputs, this));
			this.$allInputs.on("change", $.proxy(this.onAllInputs, this));
		},

		onDigitInputs: function(evt) {
			evt.preventDefault();

			var $input = $( evt.currentTarget ),
				value = $input.val();

			if( isNaN( value ) ) {
				$input.parent().addClass( "has-error" );
			} else {
				$input.parent().removeClass( "has-error" );
			}
		},

		onSingleInputs: function(evt) {
			var $input = $( evt.currentTarget );
			if( $input.val() === "specific" ) {
				this.$contentSingleSpecific.show();
				this.$contentSingleLatest.hide();
			} else if( $input.val() === "latest" ) {
				this.$contentSingleSpecific.hide();
				this.$contentSingleLatest.show();
			}
		},

		show: function($variableLabel) {
			this.variableId = $variableLabel.attr("data-variable-id");
			
			//repopulate from element
			var name = $variableLabel.attr("data-display-name"),
				mode = $variableLabel.attr("data-mode"),
				targetYear = $variableLabel.attr("data-target-year"),
				tolerance = $variableLabel.attr("data-tolerance"),
				maximumAge = $variableLabel.attr("data-maximum-age");

			var chartType = App.ChartModel.get("chart-type");
			if (chartType == App.ChartType.ScatterPlot) {
				this.$advancedSettings.show();
			} else {
				this.$advancedSettings.hide();
			}

			//prefill values (regardless of what is selected)
			this.$nameInput.val(name);
			this.$el.find("[name=single-year]").val(targetYear);
			this.$el.find("[name=single-tolerance]").val(tolerance);
			this.$el.find("[name=single-maximum-age]").val(maximumAge);
			this.$el.find("[name=all-tolerance]").val(tolerance);
			this.$el.find("[name=all-maximum-age]").val(maximumAge);

			//remove all validation errors
			this.$el.find( ".has-error" ).removeClass( "has-error" );

			//based on set values, appear correct values
			this.$contentSingle.show();

			if (mode === "specific") {
				this.$singleInputs.filter("[value=specific]").prop("checked", true);
				this.$contentSingleSpecific.show();
				this.$contentSingleLatest.hide();
			} else if (mode === "latest") {
				this.$singleInputs.filter("[value=latest]").prop("checked", true);
				this.$contentSingleSpecific.hide();
				this.$contentSingleLatest.show();
			}


			this.$el.show();
		},

		hide: function() {
			this.$el.hide();
		},

		onCloseBtn: function( evt) {
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
			//  attributes
			//	- data-mode [specific|latest|closest] 
			//	- data-target-year [number] 
			//	- data-tolerance [number] 
			//	- data-maximum-age [number] 

			var data = { variableId: this.variableId };
			data["display-name"] = this.$nameInput.val();

			data.mode = this.$singleInputs.filter(":checked").val();

			if (data.mode === "specific") {
				data[ "target-year" ] = this.$el.find("[name=single-year]").val();
				data.tolerance = this.$el.find("[name=single-tolerance]").val();
			} else if (data.mode === "latest") {
				data[ "maximum-age" ] = this.$el.find("[name=single-maximum-age]").val();
			}

			this.trigger("variable-settings", data);
		},

		onCancelBtn: function(evt) {
			evt.preventDefault();
			this.hide();
		}
	});
})();
