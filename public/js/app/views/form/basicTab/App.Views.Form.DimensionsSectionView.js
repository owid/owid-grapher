;( function() {
	
	"use strict";

	App.Views.Form.DimensionsSectionView = Backbone.View.extend({

		el: "#form-view #data-tab .dimensions-section",
		events: {
			"change [name='chart-type']": "onChartTypeChange",
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			App.ChartDimensionsModel.on( "change", this.render, this );

			this.render();

		},

		render: function() {

			this.$formSectionContent = this.$el.find( ".form-section-content" ); 
			this.$dimensionsInput = this.$el.find( "[name='chart-dimensions']" );

			//get rid of old content
			this.$formSectionContent.empty();

			//construct html
			var dimensions = App.ChartDimensionsModel.get( "chartDimensions" ),
				htmlString = "<ol class='dimensions-list'>";

			_.each( dimensions, function( v, k ) {
				htmlString += "<li data-property='" + v.property + "' class='dimension-box dd'><h4>" + v.name + "</h4><div class='dd-wrapper'><div class='dd'><div class='dd-empty'></div></div></div></li>";
			} );

			htmlString += "</ol>";

			var $html = $( htmlString );
			this.$formSectionContent.append( $html );

			//init nestable 
			this.$dd = this.$el.find( ".dd" );
			this.$dd.nestable();

			//fetch remaing dom
			this.$dimensionBoxes = this.$el.find( ".dimension-box" );

			var that = this;
			this.$dd.on('change', function() {
				that.updateInput();
			});

		},

		updateInput: function() {
			
			var dimensions = [];
			$.each( this.$dimensionBoxes, function( i, v ) {
				
				var $box = $( v ),
					$droppedVariables = $box.find( ".variable-label" );
				if( $droppedVariables.length ) {
					//just in case there were more variables
					$.each( $droppedVariables, function( i, v ) {
						var $droppedVariable = $( v ),
							dimension = { variableId: $droppedVariable.attr( "data-variable-id" ), property: $box.attr( "data-property" ), name: $box.find( "h4" ).text() };
						dimensions.push( dimension );
					} );
				}

			} );

			var json = JSON.stringify( dimensions );
			this.$dimensionsInput.val( json );
			App.ChartModel.set( "chart-dimensions", json );

		},

		onChartTypeChange: function( evt ) {

			var $select = $( evt.currentTarget );
			App.ChartDimensionsModel.loadConfiguration( $select.val() );

		}

	});

})();