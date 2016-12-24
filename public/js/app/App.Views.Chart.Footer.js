;(function() {	
	"use strict";
	owid.namespace("App.Views.Chart.Footer");

	App.Views.Chart.Footer = owid.View.extend({
		el: "#chart .footer-btns",
		events: {
			"click .embed-btn": "onEmbed"
		},

		initialize: function(chart) {
			this.chart = chart;
			this.changes = owid.changes();
			this.changes.track(chart.model, 'chart-dimensions chart-description');
			this.changes.track(chart, 'renderWidth renderHeight');
		},

		render: function(bounds) {
			if (!this.changes.start()) return;

			this.renderSVG(bounds);
			this.changes.done();
		},

		renderSVG: function(bounds, callback) {
			var sources = App.ChartData.transformDataForSources(),
				sourceNames = _.uniq(_.pluck(sources, "name")),
 				chartDesc = App.ChartModel.get("chart-description"),
				footerSource = "", footerNote = "", footerLicense = "";

			// Add the Source line
			footerSource += 'Data source: ';
				
			_.each(sourceNames, function(sourceName, i) {
				if (i > 0) footerSource += ", ";
				footerSource += "<a class='source-link'>" + sourceName + "</a>";
			});

			// Add Note, if any
			if (chartDesc) {
				footerNote += '<a class="bold">Note: </a>' + chartDesc;
			}

			footerLicense = '*data-entry* • <a class="licence-link" href="http://creativecommons.org/licenses/by-sa/4.0/deed.en_US" target="_blank">CC BY-SA</a>';

			var originUrl = App.ChartModel.get("data-entry-url");

			// Make sure the link back to OWID is consistent
			if (originUrl && s.contains(originUrl, "ourworldindata.org")) {
				var a = document.createElement('a');
				a.href = originUrl;
				var path = a.pathname[0] == "/" ? a.pathname : "/" + a.pathname; // MISPY: cross-browser compat (Internet Explorer doesn't have a slash)
				var finalUrl = "https://ourworldindata.org" + path + a.search;
				footerLicense = footerLicense.replace(/\*data-entry\*/, "<a class='origin-link' target='_blank' href='" + finalUrl + "'>" + "OurWorldInData.org" + path + a.search + "</a>");					
			} else {
				footerLicense = footerLicense.replace(/\*data-entry\*/, 
					"<a class='origin-link' target='_blank' href='http://ourworldindata.org'>OurWorldInData.org</a>");					
			}

			var svg = d3.select("svg");

			svg.selectAll(".footer").remove();
			var g = svg.append("g").attr("class", "footer");

			var footerSourceEl = g.append("text")
				.attr('dominant-baseline', 'hanging')
				.attr("x", 0)
				.attr("y", 0)
				.attr("dy", 0);

			owid.svgSetWrappedText(footerSourceEl, footerSource, bounds.width, { lineHeight: 1.1 });

			if (footerNote) {
				var sourceBBox = footerSourceEl.node().getBBox();

				var footerNoteEl = g.append("text")
						.attr("class", "footer-note-svg")
						.attr("x", 0)
						.attr("y", sourceBBox.y+sourceBBox.height)
						.attr("dy", "1.5em");

				owid.svgSetWrappedText(footerNoteEl, footerNote, bounds.width, { lineHeight: 1.1 });				
			}

			var bbox = (footerNote ? footerNoteEl : footerSourceEl).node().getBBox();
			var footerLicenseEl = g.append("text")
					.attr("class", "footer-license-svg")
					.attr("x", 0)
					.attr("y", bbox.y+bbox.height)
					.attr("dy", "1.5em");

			owid.svgSetWrappedText(footerLicenseEl, footerLicense, bounds.width, { lineHeight: 1.1 });

			var sourceBBox = footerSourceEl.node().getBBox(),
				licenseBBox = footerLicenseEl.node().getBBox();

			// Move the license stuff over to the right if there is space to do so

			if (bounds.width - sourceBBox.width > licenseBBox.width+10) {
				footerLicenseEl
					.attr('x', bounds.width)
					.attr('y', 0)
					.attr('dy', 0)
					.attr('text-anchor', 'end')
					.attr('dominant-baseline', 'hanging');
			}

			$(".footer .source-link").click(function(ev) {
				ev.preventDefault();
				chart.update({ activeTabName: 'sources' });
			});

			var footerHeight = g.node().getBBox().height;
			g.insert("rect", "*")
				.attr("x", 0).attr("y", 0)			
				.attr("width", bounds.width)
				.attr("height", footerHeight)
				.style("fill", "#fff");

			var footerOffsetY = bounds.top + bounds.height - footerHeight;
			g.attr("transform", "translate(" + bounds.left + ", " + footerOffsetY + ")");

			this.height = footerHeight;
			if (callback) callback();
		},

		onResize: function(callback) {
			this.renderSVG(callback);
		},

		onEmbed: function() {
			this.$embedModal.modal();
		},
	});
})();