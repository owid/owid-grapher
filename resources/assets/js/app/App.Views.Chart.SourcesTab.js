;(function() {	
	"use strict";
	owid.namespace("App.Views.Chart.SourcesTab");

	App.Views.Chart.SourcesTab = Backbone.View.extend( {

		el: "#chart-view",
		events: {},

		initialize: function( options ) {
			this.parentView = options.parentView;
			this.dispatcher = options.dispatcher;
			this.vardataModel = options.vardataModel;

			this.$chartDescription = this.$el.find( ".chart-description" );
			this.$chartSources = this.$el.find( ".chart-sources" );
			this.$tab = this.$el.find( "#sources-chart-tab" );

			//this.vardataModel.on("change:variableData", this.render.bind(this));			
		},

		activate: function() {
			this.parentView.chartTab.activate();
			this.trigger("tab-ready");
		},

		render: function() {
			var variableData = this.vardataModel.get("variableData"),
				sources = this.vardataModel.transformDataForSources(),
				license = variableData && variableData.license,
				footerHtml = "",
				tabHtml = "",
				descriptionHtml = App.ChartModel.get( "chart-description" ),
				sourcesShortHtml = "Data obtained from: ",
				sourcesLongHtml = "",
				//check that we're not adding sources with the same name more times
				sourcesByName = [];
				
			//construct source html
			_.each( sources, function( sourceData, sourceIndex ) {
				//make sure we don't have source with the same name in the short description already
				if( !sourcesByName[ sourceData.name ] ) {
					if( sourceIndex > 0 ) {
						sourcesShortHtml += ", ";
					}
					sourcesShortHtml += "<a href='#'>" + sourceData.name + "</a>";
					sourcesByName[ sourceData.name ] = true;
				}
				
				//sources now contain html, so no need to separate with comma
				/*if( sourceIndex > 0 && sourcesLongHtml !== "" && sourceData.description !== "" ) {
					sourcesLongHtml += ", ";
				}*/
				sourcesLongHtml += sourceData.description;
			
			} );

			footerHtml = descriptionHtml;
			//do not display description at sources tab
			/*if (descriptionHtml) {
				tabHtml = descriptionHtml + "<br /><br />";
			}*/
			tabHtml += sourcesLongHtml;
			
			if( license && license.description ) {
				var desc = license.description,
					dataUrl = App.ChartModel.get("data-entry-url");

				// Link to the blog post that is the canonical embed location for this chart
				if (dataUrl && dataUrl.indexOf("ourworldindata.org") != -1) {
					var a = document.createElement('a');
					a.href = dataUrl;
					var finalUrl = "https://ourworldindata.org" + a.pathname + a.search + a.hash;
					desc = desc.replace(/\*data-entry\*/, "<a class='source-link' target='_blank' href='" + finalUrl + "'>" + finalUrl + "</a>");
				} else
					desc = desc.replace(/\*data-entry\*/, 
						"<a class='source-link' target='_blank' href='http://ourworldindata.org'>https://ourworldindata.org</a>");
				footerHtml = desc + " " + footerHtml;								
				//tabHtml = license.description + " " + tabHtml;
			}
			
			//append to DOM
			this.$chartDescription.html( footerHtml );
			this.$chartSources.html( sourcesShortHtml );
			this.$tab.html( tabHtml );
			this.trigger("tab-ready");
		},

		show: function() {
			this.$el.show();
		},

		hide: function() {
			this.$el.hide();
		}

	} );
})();