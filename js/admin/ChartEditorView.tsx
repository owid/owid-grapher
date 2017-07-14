import * as React from 'react'
import * as ReactDOM from 'react-dom'
import EditorBasicTab from './EditorBasicTab'
import EditorDataTab from './EditorDataTab'
import EditorAxisTab from './EditorAxisTab'
import EditorScatterTab from './EditorScatterTab'
import EditorStylingTab from './EditorStylingTab'
import EditorMapTab from './EditorMapTab'
import ChartConfig from '../charts/ChartConfig'
import * as _ from 'lodash'
import * as $ from 'jquery'
import ChartType from '../charts/ChartType'
import ChartView from '../charts/ChartView'
import ChartEditor, {ChartEditorProps, EditorTab} from './ChartEditor'
import SaveButtons from './SaveButtons'
import {observer} from 'mobx-react'
import {observable, computed, action, autorun} from 'mobx'

declare const App: any

class LoadingBlocker extends React.Component<{}, undefined> {
	render() {
		const style: any = {
			position: 'fixed',
			top: 0,
			left: 0,
			bottom: 0,
			right: 0,
			backgroundColor: 'black',
			opacity: 0.5,
			zIndex: 2100,
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			fontSize: '36px',
			color: 'white'
		}
        return <div style={style}>
			<i className="fa fa-spinner fa-spin"/>
		</div>		
	}
}

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
		window.addEventListener("hashchange", this.onHashChange)
		this.onHashChange()

		autorun(() => {
			const tab = this.props.editor.tab
			setTimeout(() => window.location.hash = `#${tab}-tab`, 100)
		})
	}

	componentDidUnmount() {
		window.removeEventListener("hashchange", this.onHashChange)
	}

	@action.bound onHashChange() {
		const match = window.location.hash.match(/#(.+?)-tab/)
		if (match)
			this.props.editor.tab = (match[1] as EditorTab)
	}
	
	render() {
		const {editor} = this.props
		const {chart, availableTabs} = editor

		return <div className="form-wrapper-inner">
			{editor.currentRequest && <LoadingBlocker/>}
			<form>
				<div className="nav-tabs-custom">
					<ul className="nav nav-tabs no-bullets">
						{_.map(availableTabs, tab => 
							<li className={tab == editor.tab ? "nav-item active" : "nav-item"}>
								<a className="nav-link" onClick={() => editor.tab = tab}>{_.capitalize(tab)}</a>
							</li>
						)}
					</ul>
				</div>
				<div>
					{editor.tab == 'basic' && <EditorBasicTab chart={chart}/>}
					{editor.tab == 'data' && <EditorDataTab editor={editor}/>}
					{editor.tab == 'axis' && <EditorAxisTab chart={chart}/>}
					{editor.tab == 'styling' && <EditorStylingTab chart={chart}/>}
					{editor.tab == 'scatter' && <EditorScatterTab chart={chart}/>}
					{editor.tab == 'map' && <EditorMapTab editor={editor}/>}
				</div>
				<SaveButtons editor={editor}/>
			</form>
		</div>
	}
}