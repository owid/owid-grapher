import * as React from 'react'
import * as ReactDOM from 'react-dom'
import EditorBasicTab from './EditorBasicTab'
import EditorAxisTab from './EditorAxisTab'
import EditorScatterTab from './EditorScatterTab'
import ChartConfig from '../charts/ChartConfig'
import {clone} from 'lodash'
import * as $ from 'jquery'
import ChartType from '../charts/ChartType'
import ChartView from '../charts/ChartView'
import ChartEditorState, {ChartEditorStateProps} from './ChartEditorState'
import SaveButtons from './SaveButtons'

declare const App: any

var	AvailableEntitiesCollection = App.Collections.AvailableEntitiesCollection,
	SearchDataCollection = App.Collections.SearchDataCollection,
	DataTabView = App.Views.Form.DataTabView,
	StylingTabView = App.Views.Form.StylingTabView,
	MapTabView = App.Views.Form.MapTabView;

export default class ChartEditorView extends React.Component<{ editor: ChartEditorState }, undefined> {
    static bootstrap({ chartView }: { chartView: ChartView }) {
		const editor = new ChartEditorState({ chart: chartView.chart })
		window.editor = editor
		ReactDOM.render(<ChartEditorView editor={editor}/>, document.getElementById("form-view"))
    }

    constructor(props: any) {
        super(props)

		var formConfig = App.ChartModel.get("form-config");

		//create related models, either empty (when creating new chart), or prefilled from db (when editing existing chart)
		if (formConfig && formConfig["entities-collection"]) {
			App.AvailableEntitiesCollection = new AvailableEntitiesCollection(formConfig["entities-collection"]);
		} else {
			App.AvailableEntitiesCollection = new AvailableEntitiesCollection();
		}

		//create search collection
		App.SearchDataCollection = new SearchDataCollection();
	}

	componentDidMount() {
		this.dataTabView = new DataTabView()
		this.stylingTabView = new StylingTabView()
		this.mapTabView = new MapTabView()
		$('.nav-tabs').stickyTabs();
	}

	render() {
		const {editor} = this.props
		const {chart} = editor

		return <div className="form-wrapper-inner">
			<form method="POST" accept-charset="UTF-8"><input name="_method" type="hidden" value="PUT"/>
				<div className="nav-tabs-custom">
					<ul className="nav nav-tabs no-bullets">
						<li className="nav-item active">
							<a className="nav-link" href="#basic-tab" data-toggle="tab" aria-expanded="false">Basic</a>
						</li>
						<li className="nav-item">
							<a className="nav-link" href="#data-tab" data-toggle="tab" aria-expanded="false">Data</a>
						</li>
						<li className="nav-item">
							<a className="nav-link" href="#axis-tab" data-toggle="tab" aria-expanded="false">Axis</a>
						</li>
						<li className="nav-item">
							<a className="nav-link" href="#styling-tab" data-toggle="tab" aria-expanded="false">Styling</a>
						</li>
						<li className="nav-item">
							<a className="nav-link" href="#map-tab" data-toggle="tab" aria-expanded="false">Map</a>
						</li>
					</ul>
				</div>
				<div className="tab-content">
					<EditorBasicTab chart={chart}/>					
					<div id="data-tab" className="tab-pane">
						<section className="add-data-section">
								<a className="add-data-btn"><i className="fa fa-plus"/>Add variable</a>
								<div className="dd">
									<div className="dd-empty"></div>
								</div>
							<p className="form-section-desc hidden">Assign variables to the graph dimensions below by dragging them.</p>
						</section>
						<section className="dimensions-section">
							<input type="hidden" name="chart-dimensions" value="" />
						</section>
						<section className="entities-section">

								<h2>Pick your countries</h2>

								<p className="form-section-desc">Select countries from drop down below. You can set country colors by clicking on the country label itself.</p>
								<ul className="selected-countries-box no-bullets">

								</ul>
								<select className="form-control countries-select" data-placeholder="Choose a Country...">
									<option value=""></option>
								</select>
								<div className="add-country-control-wrapper">
									<h4>Can user add/change countries?</h4>
									<radiogroup>
										<label>
											<input type="radio" name="add-country-mode" value="add-country" checked={true}/>
											User can add and remove countries
										</label>
										<label>
											<input type="radio" name="add-country-mode" value="change-country" selected={true}/>
											User can change country
										</label>
										<label>
											<input type="radio" name="add-country-mode" value="disabled" selected={true}/>
											User cannot change/add country
										</label>
									</radiogroup>
								</div>
						</section>
						<section className="time-section">
							<h2>Define your time</h2>
							<label>
								<input type="checkbox" name="dynamic-time" checked={true}/>
								Use entire time period of the selected data
							</label>
							<input type="text" name="chart-time" value=""/>
							<div className="chart-time-inputs-wrapper">
								<label>
									Time from:
									<input type="text" name="chart-time-from" className="form-control" value="" />
								</label>
								<label>
									Time to:
									<input type="text" name="chart-time-to" className="form-control" value="" />
								</label>
							</div>
						</section>
					</div>
					<EditorAxisTab chart={chart}/>
					<div id="styling-tab" className="tab-pane">
						<section className="logo-section">
								<h2>Logos</h2>
								<select name="logo" className="form-control logo-select">
									<option value="" disabled selected>Select type</option>
									{/*% for each in data.logos %}
										<option value="{{ each }}">{{ each }}</option>
									{% endfor %*/}
								</select>
						</section>
						<section className="type-of-line-section">
							<h2>Choose Type of Line</h2>
							<label>
								<input type="radio" name="line-type" value="0"/>
								Line with dots
							</label>
							<label>
								<input type="radio" name="line-type" value="1"/>
								Line without dots
							</label>
							<label>
								<input type="radio" name="line-type" value="3"/>
								Dotted with dashed line for missing observations
							</label>
							<br/>
							<label style={{display: "none"}}>
								Maximum year gap to tolerate
								<input type="input" className="form-control" name="line-tolerance" value=""/>
							</label>
						</section>
						<section className="legend-section">
							<h2>Legend</h2>
							<label className="clickable">
								<input type="checkbox" name="hide-toggle" />
								Hide absolute/relative toggle
							</label>
						</section>
					</div>
					{chart.type == ChartType.ScatterPlot && <EditorScatterTab chart={chart}/>}
					<div id="map-tab" className="tab-pane">
						<section className="map-variable-section">
							<h2>Which variable on map</h2>
							<select name="map-variable-id" className="form-control"></select>
						</section>
						<section className="map-timeline-section">
							<h2>Timeline</h2>
							<label>
								<i className="fa fa-info-circle" data-toggle="tooltip" title="Specify a range of years from which to pull data. For example, if the map shows 1990 and tolerance is set to 1, then data from 1989 or 1991 will be shown if no data is available for 1990."></i>
								Tolerance of data:
								<input name="map-time-tolerance" className="form-control" placeholder="Tolerance of data" />
							</label>
							<div className="form-group">
								<i className="fa fa-info-circle" data-toggle="tooltip" title="Various ranges can be specified. For example: <br/>&quot;1990 to 2000 every 5; 2003; 2009&quot;<br/>Will show the years 1990, 1995, 2000, 2003 and 2009."></i>&nbsp;<label>Years to show:</label>
								<input name="map-time-ranges" className="form-control" data-toggle="tooltip" placeholder="first to last every 1" />
							</div>
							<label>
								Default year to show:
								<select name="map-default-year" className="form-control"></select>
							</label>
						</section>
						<section className="map-colors-section">
							<h2>Colors</h2>
							<label>
								<a href="http://www.datavis.ca/sasmac/brewerpal.html" title="Color brewer schemes" target="_blank"><i className="fa fa-info-circle"></i></a> Color scheme:
								<select name="map-color-scheme" className="form-control"></select>
							</label>
							<label>
								Number of intervals:
								<input name="map-color-interval" type="number" className="form-control" min="0" max="99" />
							</label>
							<label>
								<input name="map-color-invert" type="checkbox"/>
								Invert colors
							</label>
							<label>
								<input name="map-color-automatic-classification" type="checkbox" checked={true}/>
								Automatically classify data
							</label>
							<ul className="map-color-scheme-preview clearfix automatic-values">

							</ul>
						</section>
						<section className="map-regions-section">
							<h2>Displayed map section</h2>

							<label>
								Which region map should be focused on:
								<select name="map-default-projection" className="form-control"></select>
							</label>
						</section>
						<section className="map-legend-section">
							<h2>Legend</h2>
							<label>
								Legend description:
								<input type="text" name="map-legend-description" className="form-control"/>
							</label>
						</section>
					</div>
				</div>
				<SaveButtons editor={editor}/>
			</form>
		</div>
	}
}