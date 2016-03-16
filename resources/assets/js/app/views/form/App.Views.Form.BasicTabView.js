;( function() {
	
	"use strict";

	var App = require( "./../../namespaces.js" );

	App.Views.Form.BasicTabView = Backbone.View.extend({

		el: "#form-view #basic-tab",
		events: {
			"input input[name=chart-name]": "onNameInput",
			"change input[name=chart-name]": "onNameChange",
			"change input[name=chart-slug]": "onSlugChange",
			"change textarea[name=chart-subname]": "onSubnameChange",			
			"change textarea[name=chart-notes]": "onNotesChange"
		},

		initialize: function( options ) {
			if (window.location.hash === "")
				window.location.hash = "#basic-tab";

			this.dispatcher = options.dispatcher;
			this.render();
		},

		render: function() {
			this.$chartName = this.$el.find("[name=chart-name]");
			this.$chartSlug = this.$el.find("[name=chart-slug]");
			this.$chartSubname = this.$el.find("[name=chart-subname]");
			this.$chartNotes = this.$el.find("[name=chart-notes]");

			this.$chartName.val(App.ChartModel.get("chart-name"));
			this.$chartSlug.val(App.ChartModel.get("chart-slug"));
			this.$chartSubname.val(App.ChartModel.get("chart-subname"));
			this.$chartNotes.val(App.ChartModel.get("chart-notes"));
		},

		convertToSlug: function(s) {
			s = s.toLowerCase().replace(/\s*\*.+\*/, '').replace(/[^\w- ]+/g,'');
			return $.trim(s).replace(/ +/g,'-');
		},

		onNameInput: function() {
			var currentName = this.lastChartName || App.ChartModel.get("chart-name") || "";
			var currentExpectedSlug = this.convertToSlug(currentName);
			var currentSlug = this.$chartSlug.val();
			console.log(currentName, currentExpectedSlug, currentSlug);

			if (_.isEmpty(currentSlug) || currentExpectedSlug == currentSlug) {
				var slug = this.convertToSlug(this.$chartName.val());
				this.$chartSlug.val(slug);
				this.onSlugChange();				
			}

			this.lastChartName = this.$chartName.val();
		},

		onNameChange: function() {
			App.ChartModel.set("chart-name", this.$chartName.val());
		},

		onSlugChange: function() {
			App.ChartModel.set("chart-slug", this.$chartSlug.val());
		},

		onSubnameChange: function() {
			App.ChartModel.set("chart-subname", this.$chartSubname.val());
		},

		onNotesChange: function() {
			App.ChartModel.set("chart-notes", this.$chartNotes.val());
		}

	});

	module.exports = App.Views.Form.BasicTabView;

})();
