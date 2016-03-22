;( function() {
	
	"use strict";
	
	var App = require( "./../../namespaces.js" );

	App.Views.Chart.Header = Backbone.View.extend({

		DEFAULT_LOGO_URL: "uploads/26538.png",

		el: "#chart-view .chart-header",
		events: {},

		initialize: function( options ) {
			this.dispatcher = options.dispatcher;
			this.parentView = options.parentView;

			this.$chartName = this.$el.find( ".chart-name" );
			this.$chartSubname = this.$el.find( ".chart-subname" );

			this.$logo = this.$el.find( ".logo" );
			this.$secondLogo = this.$el.find(".second-logo");
			this.$logoSvg = d3.select( ".chart-logo-svg" );
			this.$logoSvgImage = this.$logoSvg.select( ".chart-logo-svg-image" );
			this.$logoSvgVector = this.$logoSvg.select( ".chart-logo-svg-vector" );

			this.$tabs = this.$el.find( ".header-tab" );

			App.ChartModel.on( "change", this.render, this );
		},

		render: function( data ) {
			var that = this,
				chartName = App.ChartModel.get( "chart-name" ),
				chartSubname = App.ChartModel.get( "chart-subname" ) || "",
				addCountryMode = App.ChartModel.get( "add-country-mode" ),
				selectedCountries = App.ChartModel.get( "selected-countries" ),
				logo = App.ChartModel.get("logo"),
				secondLogo = App.ChartModel.get("second-logo"),
				tabs = App.ChartModel.get( "tabs" );

			//might need to replace country in title, if "change country" mode
			if( addCountryMode === "change-country" ) {
				console.log( "addCountryMode", selectedCountries );
				//yep, probably need replacing country in title (select first country form stored one)
				if( selectedCountries && selectedCountries.length ) {
					var country = selectedCountries[0];
					chartName = chartName.replace( "*country*", country.name );
				}
			}

			//update name
			this.$chartName.text( chartName );
			//if there's time placeholder - time
			if( chartName ) {
				if( chartName.indexOf( "*time*" ) > -1 || chartName.indexOf( "*timeFrom*" ) > -1 || chartName.indexOf( "*timeTo*" ) > -1 ) {
					this.$chartName.css( "visibility", "hidden" );
				}
			}
			//update subname
			this.$chartSubname.html(chartSubname);
			//setup image for header
			if( logo ) {
				var fullUrl = Global.rootUrl + "/" + logo;
				this.$logo.attr( "src", fullUrl );
				this.$logo.css( "visibility", "visible" );
				this.$logoSvgImage.attr( "xlink:href", fullUrl );

				//after logo is loaded, resize svg image to the same 
				this.$logo.on( "load", function() {
					that.$logoSvgImage.attr( { "width": this.width, "height": this.height } );
				} );
			}

			if( secondLogo ) {
				var fullUrl = Global.rootUrl + "/" + secondLogo;
				this.$secondLogo.attr( "src", fullUrl );
				this.$secondLogo.show();
			} else {
				this.$secondLogo.hide();
			}

			//should be displayed
			if( logo === this.DEFAULT_LOGO_URL ) {
				this.$logoSvg.attr( "class", "chart-logo-svg default-logo" );
			} else {
				this.$logoSvg.attr( "class", "chart-logo-svg" );
			}

			//hide first everything
			this.$tabs.hide();

			_.each(tabs, function( v, i ) {
				var tab = that.$tabs.filter("." + v + "-header-tab");
				tab.show();
			});

			//for first visible tab, add class for border-left, cannot be done in pure css http://stackoverflow.com/questions/18765814/targeting-first-visible-element-with-pure-css
			this.$tabs.removeClass( "first" );
			this.$tabs.filter( ":visible:first" ).addClass( "first" );

			this.updateTime();
		},

		updateTime: function() {
			// Replace *time* and similar in the chart title, but only if we need to
			var chartName = this.$chartName.text();
			if (chartName.indexOf("*time*") == -1 && chartName.indexOf("*timeFrom*") == -1 && chartName.indexOf("*timeTo*") == -1)
				return;

			var that = this;
			var tabs =	App.ChartModel.get( "tabs" ),
				activeTab = _.find(tabs, function(tab) { return that.$tabs.filter("." + tab + "-header-tab.active").length > 0});

			if (activeTab == "map") {
				this.updateTimeFromMap(this.parentView.mapTab);
			} else {
				if (this.parentView.chartTab && this.parentView.chartTab.localData)
					this.updateTimeFromChart(this.parentView.chartTab.localData);
			}
		},

		updateTimeFromChart: function( data ) {
			//is there any time placeholder to update at all?
			var chartName = this.$chartName.text();
			//find minimum and maximum in all displayed data
			var dimsString = App.ChartModel.get("chart-dimensions"),
				dims = $.parseJSON( dimsString ),
				latestAvailable = false,
				timeFrom = d3.min( data, function( entityData ) {
					return d3.min( entityData.values, function( d ) { return parseInt( d.time, 10 ); } );
				} ),
				timeTo = d3.max( data, function( entityData ) {
					return d3.max( entityData.values, function( d ) { return parseInt( d.time, 10 ); } );
				} );

			_.each( dims, function( dimension ) {
				if( dimension.mode === "specific" && dimension.period === "single" ) {
					var tolerance = +dimension.tolerance,
						dimMax = +dimension.targetYear + tolerance,
						dimMin = +dimension.targetYear - tolerance;
					//possibly set new timeFrom/timeTo values based on dimension settings
					timeFrom = Math.min( timeFrom, dimMin );
					timeTo = Math.max( timeTo, dimMax );
				} else if( dimension.mode === "latest" ) {
					latestAvailable = true;
				}

			} );

			chartName = this.replaceTimePlaceholder( chartName, timeFrom, timeTo, latestAvailable );
			this.$chartName.text( chartName );
			this.$chartName.css( "visibility", "visible" );
		},

		updateTimeFromMap: function(map) {			
			var timeFrom = map.minYear || map.mapConfig.targetYear,
				timeTo = map.maxYear || map.mapConfig.targetYear,
				targetYear = map.mapConfig.targetYear,
				hasTargetYear = _.find(map.mapData, function(d) { return d.year == targetYear; });

			var chartName = this.$chartName.text();
			var chartSubname = this.$chartSubname.html();
			chartName = this.replaceTimePlaceholder( chartName, targetYear, targetYear, false );
			if (hasTargetYear && timeFrom != timeTo) {
				// The target year is in the data but we're displaying a range, meaning not available for all countries
				chartSubname += " Since some observations for " + targetYear + " are not available the map displays the closest available data (" + timeFrom + " to " + timeTo + ").";
			} else if (!hasTargetYear && timeFrom != timeTo) {
				// The target year isn't in the data at all and we're displaying a range of other nearby values
				chartSubname += " Since observations for " + targetYear + " are not available the map displays the closest available data (" + timeFrom + " to " + timeTo + ").";
			} else if (!hasTargetYear && timeFrom == timeTo) {
				// The target year isn't in the data and we're displaying some other single year
				chartSubname += " Since observations for " + targetYear + " are not available the map displays the closest available data (from " + timeFrom + ").";
			}
			this.$chartName.text( chartName );
			this.$chartName.css( "visibility", "visible" );
			this.$chartSubname.html(chartSubname);
		},

		replaceTimePlaceholder: function( string, timeFrom, timeTo, latestAvailable ) {			
			timeFrom = owid.displayYear(timeFrom);
			timeTo = owid.displayYear(timeTo);
						
			var time = (!latestAvailable) ? (timeFrom !== timeTo) ? timeFrom + " to " + timeTo : timeFrom : " latest available data";

			string = string.replace( "*time*", time );
			string = string.replace( "*timeFrom*", timeFrom );
			string = string.replace( "*timeTo*", timeTo );

			return string;
		}

	});

	module.exports = App.Views.Chart.Header;

})();