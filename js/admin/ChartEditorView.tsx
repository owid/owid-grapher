import * as React from 'react'
import * as ReactDOM from 'react-dom'
import EditorBasicTab from './EditorBasicTab'
import EditorDataTab from './EditorDataTab'
import EditorAxisTab from './EditorAxisTab'
import EditorScatterTab from './EditorScatterTab'
import EditorStylingTab from './EditorStylingTab'
import EditorMapTab from './EditorMapTab'
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
						{chart.type == ChartType.ScatterPlot && <li className="nav-item">
							<a className="nav-link" href="#scatter-tab" data-toggle="tab" aria-expanded="false">Scatter</a>
						</li>}
						{chart.hasMapTab && <li className="nav-item">
							<a className="nav-link" href="#map-tab" data-toggle="tab" aria-expanded="false">Map</a>
						</li>}
					</ul>
				</div>
				<div className="tab-content">
					<EditorBasicTab chart={chart}/>
					<EditorDataTab editor={editor}/>
					<EditorAxisTab chart={chart}/>
					<EditorStylingTab chart={chart}/>
					{chart.type == ChartType.ScatterPlot && <EditorScatterTab chart={chart}/>}
					{chart.hasMapTab && <EditorMapTab editor={editor}/>}
				</div>
				<SaveButtons editor={editor}/>
			</form>
		</div>
	}
}