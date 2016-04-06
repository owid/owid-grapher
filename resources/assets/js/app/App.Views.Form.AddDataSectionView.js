;(function() {	
	"use strict";
	owid.namespace("App.Views.Form.AddDataSectionView");
	
	var	SelectVarPopup = App.Views.UI.SelectVarPopup,
		SettingsVarPopup = App.Views.UI.SettingsVarPopup;

	App.Views.Form.AddDataSectionView = Backbone.View.extend({

		el: "#form-view #data-tab .add-data-section",
		events: {
			"click .add-data-btn": "onAddDataBtn",
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;

			this.selectVarPopup = new SelectVarPopup(options);

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

			this.$el.find( ".form-section-desc" ).removeClass( "hidden" );
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

			if( App.ChartVariablesCollection.models.length == 0 ) {
				this.$el.find( ".form-section-desc" ).addClass( "hidden" );
			}
		}

	});
})();