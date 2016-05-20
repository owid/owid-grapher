;( function() {	
	"use strict";

	window.App = window.App || {};
	App.Views = App.Views || {};
	App.Views.Chart = App.Views.Chart || {};	

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

			this.updateTime();

			chartName = this.replaceContextPlaceholders(chartName);
			chartSubname = this.replaceContextPlaceholders(chartSubname);
			if (this.mapDisclaimer) chartSubname += this.mapDisclaimer;
			
			this.$chartName.html(chartName);
			this.$chartSubname.html(chartSubname);

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

			// HACK (Mispy): Since bootstrap sets list-item on these directly
			// our css has to use !important to make them table-cell, but that
			// means we can't just hide them normally.
			this.$tabs.attr("style", "display: none !important;");

			_.each(tabs, function( v, i ) {
				var tab = that.$tabs.filter("." + v + "-header-tab");
				tab.show();
			});

			//for first visible tab, add class for border-left, cannot be done in pure css http://stackoverflow.com/questions/18765814/targeting-first-visible-element-with-pure-css
			this.$tabs.removeClass( "first" );
			this.$tabs.filter( ":visible:first" ).addClass( "first" );

			this.updateTime();
			this.dispatcher.trigger("header-rendered");
		},

		// Replaces things like *time* and *country* with the actual time and
		// country displayed by the current chart context
		replaceContextPlaceholders: function(text) {
			if (s.contains(text, "*country*")) {
				var selectedCountries = App.ChartModel.get("selected-countries");
				text = text.replace("*country*", _.pluck(selectedCountries, "name").join(", "));
			}


			if (s.contains(text, "*time")) {
				var latestAvailable = this.timeGoesToLatest,
					timeFrom = owid.displayYear(this.selectedTimeFrom),
					timeTo = latestAvailable ? "latest available data" : owid.displayYear(this.selectedTimeTo),
					time = this.targetYear || (timeFrom === timeTo ? timeFrom : timeFrom + " to " + timeTo);

				text = text.replace("*time*", time);
				text = text.replace("*timeFrom*", timeFrom);
				text = text.replace("*timeTo*", timeTo);
			}

			return text;
		},

		updateTime: function() {
			var tabs =	App.ChartModel.get( "tabs" ),
				activeTab = _.find(tabs, function(tab) { return this.$tabs.filter("." + tab + "-header-tab.active").length > 0}.bind(this));

			if (activeTab == "map") {
				if (this.parentView.mapTab.mapConfig)
					this.updateTimeFromMap(this.parentView.mapTab);
			} else {
				if (this.parentView.chartTab && this.parentView.chartTab.localData)
					this.updateTimeFromChart(this.parentView.chartTab.localData);
			}
		},

		updateTimeFromChart: function( data ) {
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
					timeFrom = Math.min(timeFrom, dimMin);
					timeTo = Math.max(timeTo, dimMax);
				} else if (dimension.mode === "latest") {
					latestAvailable = true;
				}
			});

			this.selectedTimeFrom = timeFrom;
			this.selectedTimeTo = timeTo;
			this.timeGoesToLatest = latestAvailable;
			this.mapDisclaimer = null;
			this.targetYear = null;
		},

		updateTimeFromMap: function(map) {			
			var timeFrom = map.minToleranceYear || map.mapConfig.targetYear,
				timeTo = map.maxToleranceYear || map.mapConfig.targetYear,
				targetYear = map.mapConfig.targetYear,
				hasTargetYear = _.find(map.mapData, function(d) { return d.year == targetYear; }),
				d = owid.displayYear;

			if (hasTargetYear && timeFrom != timeTo) {
				// The target year is in the data but we're displaying a range, meaning not available for all countries
				this.mapDisclaimer = " Since some observations for " + d(targetYear) + " are not available the map displays the closest available data (" + d(timeFrom) + " to " + d(timeTo) + ").";
			} else if (!hasTargetYear && timeFrom != timeTo) {
				// The target year isn't in the data at all and we're displaying a range of other nearby values
				this.mapDisclaimer = " Since observations for " + d(targetYear) + " are not available the map displays the closest available data (" + d(timeFrom) + " to " + d(timeTo) + ").";
			} else if (!hasTargetYear && timeFrom == timeTo && timeFrom != targetYear) {
				// The target year isn't in the data and we're displaying some other single year
				this.mapDisclaimer = " Since observations for " + d(targetYear) + " are not available the map displays the closest available data (from " + d(timeFrom) + ").";
			} else if (!hasTargetYear) {
				this.mapDisclaimer = " No observations are available for this year.";
			} else {
				this.mapDisclaimer = "<span style='visibility: hidden;'>A rather long placeholder to ensure that the text flow remains the same when changing between various years.</span>";
			}

			this.selectedTimeFrom = timeFrom;
			this.selectedTimeTo = timeTo;
			this.timeGoesToLatest = false;
			this.targetYear = targetYear;
		},

		replaceTimePlaceholder: function( string, timeFrom, timeTo, latestAvailable ) {			

			return string;
		}

	});

})();