;( function() {
		
	"use strict";

	App.Collections.ChartVariablesCollection = Backbone.Collection.extend( {

		model: App.Models.ChartVariableModel,

		initialize: function( models, options ) {
			if( models && models.length ) {
				//have models already
				this.scatterColorCheck( models );
			} else {
				this.on( "sync", this.onSync, this );
			}
		},

		onSync: function() {
			this.scatterColorCheck();
		},

		scatterColorCheck: function( models ) {
			
			if( App.ChartModel.get( "chart-type" ) == 2 ) {
				//make sure for scatter plot, we have color set as continents
				var chartDimensions = $.parseJSON( App.ChartModel.get( "chart-dimensions" ) );
				//if( !_.findWhere( chartDimensions, { "property": "color" } ) ) {
					//this is where we add color property
					var colorPropObj = { "id":"123","unit":"","name":"Color","period":"single","mode":"specific","targetYear":"2000","tolerance":"5","maximumAge":"5"};
					if( models ) {
						models.push( colorPropObj );
					} else {
						this.add( new App.Models.ChartVariableModel( colorPropObj ) );
					}
				//}
			}
		}

	} );

})();