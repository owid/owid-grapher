import * as React from 'react'
import * as ReactDOM from 'react-dom'
import EditorBasicTab from './EditorBasicTab'
import EditorDataTab from './EditorDataTab'
import EditorAxisTab from './EditorAxisTab'
import EditorScatterTab from './EditorScatterTab'
import EditorStylingTab from './EditorStylingTab'
import ChartConfig from '../charts/ChartConfig'
import {clone} from 'lodash'
import * as $ from 'jquery'
import ChartType from '../charts/ChartType'
import ChartView from '../charts/ChartView'
import ChartEditor, {ChartEditorProps} from './ChartEditor'
import SaveButtons from './SaveButtons'
import {observer} from 'mobx-react'

declare const App: any

@observer
export default class ChartEditorView extends React.Component<{ editor: ChartEditor }, undefined> {
    static bootstrap({ chartView, editorData }: { chartView: ChartView, editorData: any }) {
		const editor = new ChartEditor({ chart: chartView.chart, data: editorData })
		window.editor = editor
		ReactDOM.render(<ChartEditorView editor={editor}/>, document.getElementById("form-view"))
    }

    constructor(props: any) {
        super(props)
	}
	
	getChildContext() {
		return {
			editor: this.props.editor
		}
	}

	componentDidMount() {
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
					<EditorDataTab editor={editor}/>
					<EditorAxisTab chart={chart}/>
					<EditorStylingTab chart={chart}/>
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