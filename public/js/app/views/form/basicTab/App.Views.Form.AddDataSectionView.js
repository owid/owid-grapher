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

			App.ChartVariablesCollection.on( "reset", this.onVariableReset, this );
			App.ChartVariablesCollection.on( "add", this.onVariableAdd, this );
			App.ChartVariablesCollection.on( "remove", this.onVariableRemove, this );

			this.dispatcher.on( "variable-label-moved", this.onVariableLabelMoved, this );

			//App.ChartModel.on( "change:variables", this.onVariablesChange, this );

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
			if( !this.$dd.find( ".dd-list" ).length ) {
				//dd-list has been removed by nestable
				var $ddList = $( "<ol class='dd-list'></ol>" );
				this.$dd.append( $ddList );
				this.$ddList = this.$dd.find( ".dd-list" );
			}

			var $li = "<li class='variable-label dd-item' data-variable-id='" + model.get( "id" ) + "'><div class='dd-handle'>" + model.get( "name" ) + "</div><span class='fa fa-close'></span></li>";
			this.$ddList.append( $li );
			this.refreshHandlers();

		},

		onVariableRemove: function( model ) {
			var $liToRemove = this.$ddList.find( "[data-variable-id='" + model.get( "id" ) + "']" ); 
			console.log( "onVariableRemove", $liToRemove );
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

		}

		
		/*onChartVariableChange: function() {

			console.log( "on chart onChartVariableChange" ); 
			App.ChartModel.set( "chart-variable", this.$chartVariable.val() );

		}*/


	});

})();