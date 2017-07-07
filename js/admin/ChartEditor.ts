/* ChartEditor.ts
 * ================
 *
 * Mobx store that represents the current editor state and governs non-UI-related operations.
 *
 */

import {observable, computed, reaction} from 'mobx'
import ChartConfig from '../charts/ChartConfig'

export interface ChartEditorProps {
    chart: ChartConfig
}

   /*url: function(id) {
        id = id || this.id;
        if( $("#form-view").length ) {
            if( id ) {
                //editing existing
                return Global.adminRootUrl + "/charts/" + id;
            } else {
                //saving new
                return Global.adminRootUrl + "/charts";
            }

        } else {
            // Pass any query parameters on to config
            return Global.rootUrl + "/data/config/" + id + window.location.search;
        }
    },*/

export default class ChartEditor {
    @observable.ref chart: ChartConfig

    // Whether the current chart state is saved or not
    @observable.ref isSaved: boolean = true

    // XXX refactor all of this
	// @param newAttrs Attributes which will only be set on the model if the save is successful.
	saveChart() {
		const {chart} = this
		var isNew = chart.model.isNew();

		var prevAttrs = chart.model.toJSON();
		var attrs = _.extend({}, prevAttrs, newAttrs);
		attrs["form-config"] = formConfig;
		chart.model.set(attrs, { silent: true });

		const targetUrl = isNew ? "/admin/charts" : `/admin/charts/${chart.id}`


		App.postJSON(targetUrl, {
			success: function (model, response, options) {
				if (isNew) {
					// New chart saved, switch to edit mode
					window.location = chart.model.url(response.data.id) + '/edit';
				} else {
					for (var key in newAttrs) {
						chart.model.trigger("change:" + key);
					}
					chart.model.trigger("change");
				}
                this.isSaved = true
			}.bind(this),
			error: function (model, xhr, options) {
				var $modal = owid.modal({ title: "Error saving chart", content: xhr.responseText });
				$modal.addClass("error");
				chart.model.set(prevAttrs, { silent: true });
			}
		});
	}

    saveAsNewChart() {
		const {chart} = this

		var formConfig = {
			"entities-collection": App.AvailableEntitiesCollection.toJSON()
		};

		chart.model.set( "form-config", formConfig, { silent: true } );			
		var origId = chart.model.get('id'),
			origPublished = chart.model.get("published");
		chart.model.set({ id: null, published: null }, { silent: true });

		// Need to open intermediary tab before AJAX to avoid popup blockers
		var w = window.open("/", "_blank");

		chart.model.save({}, {
			success: function (model, response, options) {
				w.location = chart.model.url(response.data.id) + "/edit";
				chart.model.set({ id: origId, published: origPublished });
			},
			error: function (model, xhr, options) {
				w.close();
				chart.model.set({ id: origId, published: origPublished });
				var $modal = owid.modal({ title: "Error saving chart", content: xhr.responseText });
				$modal.addClass("error");
			}
		});        
    }

	publishChart() {
		var url = Global.rootUrl + "/" + chart.model.get("slug");
		
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
		const {chart} = props
        this.chart = chart

		reaction(
			() => chart.json,
			() => this.isSaved = false
		)
    }
}