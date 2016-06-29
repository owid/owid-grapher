;(function() {	
	"use strict";
	owid.namespace("App.Views.Form.SaveButtons");

	App.Views.Form.SaveButtons = owid.View.extend({
		el: "#form-view .form-section-submit",
		events: {
			"click #save-chart": "onSaveChart",
			"click #save-as-new": "onSaveAsNew",
			"click #publish-toggle": "onPublishToggle"
		},

		initialize: function(options) {
			this.dispatcher = options.dispatcher;
			this.$saveBtn = this.$("#save-chart");
			this.$saveNewBtn = this.$("#save-as-new");
			this.$publishBtn = this.$("#publish-toggle");

			this.listenTo(App.ChartModel, "change", this.render.bind(this));
			this.render();
		},

		render: function() {
			var published = App.ChartModel.get("published");
			if (published) {
				this.$publishBtn.text("Unpublish");
				this.$saveBtn.text("Update chart");
			} else {
				this.$publishBtn.text("Publish");
				this.$saveBtn.text("Save draft");
			}
		},

		onSaveChart: function(ev) {
			if (ev) ev.preventDefault();

			this.saveChart();
		},

		// @param newAttrs Attributes which will only be set on the model if the save is successful.
		saveChart: function(newAttrs) {
			var formConfig = {
				"variables-collection": App.ChartVariablesCollection.toJSON(),
				"entities-collection": App.AvailableEntitiesCollection.toJSON(),
				"dimensions": App.ChartDimensionsModel.toJSON(),
			};

			var isNew = App.ChartModel.isNew();

			var prevAttrs = _.clone(App.ChartModel.attributes);
			var attrs = _.extend({}, prevAttrs, newAttrs);
			attrs["form-config"] = formConfig;
			App.ChartModel.set(attrs, { silent: true });


			App.ChartModel.save({}, {
				success: function (model, response, options) {
					if (isNew) {
						// New chart saved, switch to edit mode
						window.location = App.ChartModel.url(response.data.id) + '/edit';
					} else {
						this.dispatcher.trigger("chart-saved", response.data.id, response.data.viewUrl);						
						for (var key in newAttrs) {
							App.ChartModel.trigger("change:" + key);
						}
						App.ChartModel.trigger("change");

						this.$saveBtn.text("Saved");
					}
				}.bind(this),
				error: function (model, xhr, options) {
					var $modal = owid.modal({ title: "Error saving chart", content: xhr.responseText });
					$modal.addClass("error");
					App.ChartModel.set(prevAttrs, { silent: true });
				}
			});
		},

		onSaveAsNew: function(ev) {
			ev.preventDefault();

			var formConfig = {
				"variables-collection": App.ChartVariablesCollection.toJSON(),
				"entities-collection": App.AvailableEntitiesCollection.toJSON(),
				"dimensions": App.ChartDimensionsModel.toJSON()
			};

			App.ChartModel.set( "form-config", formConfig, { silent: true } );			
			var origId = App.ChartModel.get('id'),
				origPublished = App.ChartModel.get("published");
			App.ChartModel.set({ id: null, published: null }, { silent: true });

			// Need to open intermediary tab before AJAX to avoid popup blockers
			var w = window.open("/", "_blank");

			App.ChartModel.save({}, {
				success: function (model, response, options) {
					w.location = App.ChartModel.url(response.data.id) + "/edit";
					App.ChartModel.set({ id: origId, published: origPublished }, { silent: true });
				},
				error: function (model, xhr, options) {
					w.close();
					App.ChartModel.set({ id: origId, published: origPublished }, { silent: true });
					var $modal = owid.modal({ title: "Error saving chart", content: xhr.responseText });
					$modal.addClass("error");
				}
			});
		},		

		onPublishToggle: function(ev) {
			ev.preventDefault();

			if (App.ChartModel.get("published"))
				this.unpublish();
			else
				this.publish();
		},

		publish: function() {
			var url = Global.rootUrl + "/" + App.ChartModel.get("chart-slug");
			
			var $modal = owid.modal();
			$modal.find(".modal-title").html("Publish chart");
			$modal.find(".modal-body").html(
				'<p>This chart will be available at:</p>' +
				'<p><a href="' + url + '" target="_blank">' + url + '</a></p>' +
				'<p>Proceed?</p>'
			);
			$modal.find(".modal-footer").html(
				'<button class="btn btn-danger">Publish chart</button>' +
				'<button class="btn btn-cancel" data-dismiss="modal">Cancel</button>'
			);

			$modal.find(".btn-danger").on("click", function() {
				$modal.modal('hide');
				this.saveChart({ published: true });
			}.bind(this));
		},

		unpublish: function() {
			owid.confirm({ text: "Really unpublish chart?" }, function() {
				this.saveChart({ published: false });
			}.bind(this));
		}
	});
})();