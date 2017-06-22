/* ChartEditorState.ts
 * ================
 *
 * Mobx store that represents the current editor state and governs non-UI-related operations.
 *
 */

import {observable, computed} from 'mobx'
import ChartConfig from '../charts/ChartConfig'

export interface ChartEditorProps {
    chart: ChartConfig
}

export default class ChartEditorState {
    @observable.ref chart: ChartConfig

    // Whether the current chart state is saved or not
    @observable.ref isSaved: boolean = true

    // XXX refactor all of this
	// @param newAttrs Attributes which will only be set on the model if the save is successful.
	saveChart(newAttrs?: any) {
		var formConfig = {
			"entities-collection": App.AvailableEntitiesCollection.toJSON()
		};

		var isNew = App.ChartModel.isNew();

		var prevAttrs = App.ChartModel.toJSON();
		var attrs = _.extend({}, prevAttrs, newAttrs);
		attrs["form-config"] = formConfig;
		App.ChartModel.set(attrs, { silent: true });

		App.ChartModel.save({}, {
			success: function (model, response, options) {
				if (isNew) {
					// New chart saved, switch to edit mode
					window.location = App.ChartModel.url(response.data.id) + '/edit';
				} else {
					for (var key in newAttrs) {
						App.ChartModel.trigger("change:" + key);
					}
					App.ChartModel.trigger("change");
				}
                this.isSaved = true
			}.bind(this),
			error: function (model, xhr, options) {
				var $modal = owid.modal({ title: "Error saving chart", content: xhr.responseText });
				$modal.addClass("error");
				App.ChartModel.set(prevAttrs, { silent: true });
			}
		});
	}

    saveAsNewChart() {
		var formConfig = {
			"entities-collection": App.AvailableEntitiesCollection.toJSON()
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
				App.ChartModel.set({ id: origId, published: origPublished });
			},
			error: function (model, xhr, options) {
				w.close();
				App.ChartModel.set({ id: origId, published: origPublished });
				var $modal = owid.modal({ title: "Error saving chart", content: xhr.responseText });
				$modal.addClass("error");
			}
		});        
    }

	publishChart() {
		var url = Global.rootUrl + "/" + App.ChartModel.get("slug");
		
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
	}

	unpublishChart() {
		owid.confirm({ text: "Really unpublish chart?" }, function() {
			this.saveChart({ published: false });
		}.bind(this));
	}

    constructor(props: ChartEditorProps) {
        this.chart = props.chart

        App.ChartModel.on("change", e => this.isSaved = false)
    }
}