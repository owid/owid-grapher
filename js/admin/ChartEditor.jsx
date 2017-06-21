import React from 'react'
import {render, h} from 'preact'
import EditorBasicTab from './EditorBasicTab'
import EditorAxisTab from './EditorAxisTab'
import ScatterTab from './ScatterTab'
import ChartConfig from '../charts/ChartConfig'
import _ from 'lodash'
import $ from 'jquery'
import ChartType from '../charts/ChartType'

owid.namespace("App.Views.FormView");

var	AvailableEntitiesCollection = App.Collections.AvailableEntitiesCollection,
	SearchDataCollection = App.Collections.SearchDataCollection,
	DataTabView = App.Views.Form.DataTabView,
	StylingTabView = App.Views.Form.StylingTabView,
	ExportTabView = App.Views.Form.ExportTabView,
	MapTabView = App.Views.Form.MapTabView,
	SaveButtonsView = App.Views.Form.SaveButtons;

App.Views.FormView = owid.View.extend({
	el: "#form-view",
	initialize: function() {
		this.dispatcher = _.clone(Backbone.Events);

		var formConfig = App.ChartModel.get("form-config");

		//create related models, either empty (when creating new chart), or prefilled from db (when editing existing chart)
		if (formConfig && formConfig["entities-collection"]) {
			App.AvailableEntitiesCollection = new AvailableEntitiesCollection(formConfig["entities-collection"]);
		} else {
			App.AvailableEntitiesCollection = new AvailableEntitiesCollection();
		}

		//create search collection
		App.SearchDataCollection = new SearchDataCollection();

		this.render();
	},

	render: function() {
        const chart = window.chart.chart
		render(<EditorBasicTab chart={chart} />, d3.select('.tab-content').node())
		render(<EditorAxisTab chart={chart} />, d3.select('.tab-content').node())

		//create subviews
		this.dataTabView = this.addChild(DataTabView, { dispatcher: this.dispatcher });
		this.stylingTabView = this.addChild(StylingTabView, { dispatcher: this.dispatcher });
		this.exportTabView = this.addChild(ExportTabView, { dispatcher: this.dispatcher });
		this.mapTabView = this.addChild(MapTabView, { dispatcher: this.dispatcher });
		this.saveButtons = this.addChild(SaveButtonsView, { dispatcher: this.dispatcher });

		if (chart.type == ChartType.ScatterPlot)
			render(<ScatterTab chart={chart}/>, d3.select('.tab-content').node())

		$('.nav-tabs').stickyTabs();
	},
});
