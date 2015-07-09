;( function() {
	
	"use strict";

	App.Views.Form.AddDataSectionView = Backbone.View.extend({

		el: "#form-view #data-tab .add-data-section",
		events: {
			"click .add-data-btn": "onAddDataBtn",
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;

			this.selectVarPopup = new App.Views.UI.SelectVarPopup();
			this.selectVarPopup.init( options );

			this.settingsVarPopup = new App.Views.UI.SettingsVarPopup();
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
			this.$el.find( ".dd" ).nestable({});

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

			var defaultLookAround = 5;

			var $li = $( "<li class='variable-label dd-item' data-variable-id='" + model.get( "id" ) + "'><div class='dd-handle'>" + model.get( "name" ) + "</div><span class='fa fa-cog' title='Set varialbe'></span><span class='fa fa-close'></span></li>" ),
				$settings = $li.find( ".fa-cog" );
			//var $li = $( "<li class='variable-label dd-item' data-variable-id='" + model.get( "id" ) + "'><div class='dd-handle'>" + model.get( "name" ) + "</div><span class='look-around' title='Number of years to look around'>" + defaultLookAround + "</span><span class='fa fa-bullseye' title='Use only latest available year for this variable'></span><span class='fa fa-close'></span></li>" ),
				//$latestYear = $li.find( ".fa-bullseye" ),
				//$lookAround = $li.find( ".look-around" );
			this.$ddList.append( $li );
			
			//$latestYear.on( "click", $.proxy( this.onLatestYearClick, this ) );
			//$lookAround.on( "click", $.proxy( this.onLookAroundClick, this ) );

			$settings.on( "click", $.proxy( this.onSettingsClick, this ) );

			this.refreshHandlers();

		},

		onVariableRemove: function( model ) {
			var $liToRemove = $( ".variable-label[data-variable-id='" + model.get( "id" ) + "']" );
			console.log( "$liToRemove", this.$ddList,  $liToRemove );
			$liToRemove.remove();
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

			//hide popup
			this.settingsVarPopup.hide();

			//trigger updating model
			this.dispatcher.trigger( "dimension-update" );

		}

	});

})();