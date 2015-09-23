;( function() {
	
	"use strict";

	App.Views.Form.MapTabView = Backbone.View.extend({

		el: "#form-view #map-tab",
		events: {
			"change [name='map-variable-id']": "onVariableIdChange",
			"change [name='map-color-scheme']": "onColorSchemeChange",
			"change [name='map-color-interval']": "onColorIntervalChange"
		},

		initialize: function( options ) {
			this.dispatcher = options.dispatcher;

			App.ChartVariablesCollection.on( "change", this.onVariablesCollectionChange, this );

			this.$variableIdSelect = this.$el.find( "[name='map-variable-id']" );
			this.$colorSchemeSelect = this.$el.find( "[name='map-color-scheme']" );
			this.$colorIntervalSelect = this.$el.find( "[name='map-color-interval']" );

			this.render();
		},

		render: function() {
					
			//populate variable select with the available ones
			this.$variableIdSelect.empty();

			var mapConfig = App.ChartModel.get( "map-config" ),
				models = App.ChartVariablesCollection.models,
				html = "";
			_.each( models, function( v, i ) {
				var model = v;
				html += "<option value='" + v.get( "id" ) + "'>" + v.get( "name" ) + "</option>";
			} );
			this.$variableIdSelect.append( $( html ) );

			this.updateColorSchemeSelect();
			this.updateColorIntervalSelect();

		},

		updateColorSchemeSelect: function() {
			
			var html = "",
				mapConfig = App.ChartModel.get( "map-config" );

			this.$colorSchemeSelect.empty();
			_.each( colorbrewer, function( v, i ) {
				var selected = ( i == mapConfig.colorSchemeName )? " selected": "";
				html += "<option value='" + i + "' " + selected + ">" + i + "</option>";
			} );
			this.$colorSchemeSelect.append( $( html ) );

		},

		updateColorIntervalSelect: function() {
			
			var html = "",
				mapConfig = App.ChartModel.get( "map-config" ),
				hasSelected = false;

			this.$colorIntervalSelect.empty();
			_.each( colorbrewer[  mapConfig.colorSchemeName ], function( v, i ) {
				var selected = ( i == mapConfig.colorSchemeInterval )? " selected": "";
				if( selected === " selected" ) {
					hasSelected = true;
				}
				html += "<option value='" + i + "' " + selected + ">" + i + "</option>";
			} );
			this.$colorIntervalSelect.append( $( html ) );

			if( !hasSelected ) {
				//there's not selected interval that would exist with current color scheme, select that first
				App.ChartModel.updateMapConfig( "colorSchemeInterval", this.$colorIntervalSelect.val() );
			}

		},

		onVariablesCollectionChange: function() {
			this.render();
		},

		onVariableIdChange: function( evt ) {
			var $this = $( evt.target );
			App.ChartModel.updateMapConfig( "variableId", $this.val() );
		},

		onColorSchemeChange: function( evt ) {
			var $this = $( evt.target );
			App.ChartModel.updateMapConfig( "colorSchemeName", $this.val() );
			//need to update number of classes
			this.updateColorIntervalSelect();
		},

		onColorIntervalChange: function( evt ) {
			var $this = $( evt.target );
			App.ChartModel.updateMapConfig( "colorSchemeInterval", $this.val() );
		}

	});

})();