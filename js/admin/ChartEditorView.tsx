import * as React from 'react'
import * as ReactDOM from 'react-dom'
import {capitalize, includes} from '../charts/Util'
import EditorBasicTab from './EditorBasicTab'
import EditorDataTab from './EditorDataTab'
import EditorTextTab from './EditorTextTab'
import EditorCustomizeTab from './EditorCustomizeTab'
import EditorScatterTab from './EditorScatterTab'
import EditorMapTab from './EditorMapTab'
import ChartView from '../charts/ChartView'
import ChartEditor from './ChartEditor'
import SaveButtons from './SaveButtons'
import {observer} from 'mobx-react'
import {action, autorun} from 'mobx'

class LoadingBlocker extends React.Component {
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

declare const window: any

@observer
export default class ChartEditorView extends React.Component<{ editor: ChartEditor }> {
    static bootstrap({ chartView, cacheTag }: { chartView: ChartView, cacheTag: string }) {
		const editor = new ChartEditor({ chart: chartView.chart, cacheTag: cacheTag })
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
		if (match) {
			const tab = match[1]
			if (includes(this.props.editor.availableTabs, tab))
				this.props.editor.tab = tab
		}
	}
	
	render() {
		const {editor} = this.props
		const {chart, availableTabs} = editor

		return <div className="form-wrapper-inner">
			{(editor.currentRequest || !chart.data.isReady) && <LoadingBlocker/>}
			<form onSubmit={e => e.preventDefault()}>
				<div className="nav-tabs-custom">
					<ul className="nav nav-tabs no-bullets">
						{availableTabs.map(tab => 
							<li className={tab == editor.tab ? "nav-item active" : "nav-item"}>
								<a className="nav-link clickable" onClick={() => editor.tab = tab}>{capitalize(tab)}</a>
							</li>
						)}
					</ul>
				</div>
				<div>
					{editor.tab == 'basic' && <EditorBasicTab editor={editor}/>}
					{editor.tab == 'text' && <EditorTextTab editor={editor}/>}
					{editor.tab == 'data' && <EditorDataTab editor={editor}/>}
					{editor.tab == 'customize' && <EditorCustomizeTab editor={editor}/>}
					{editor.tab == 'scatter' && <EditorScatterTab chart={chart}/>}
					{editor.tab == 'map' && <EditorMapTab editor={editor}/>}
				</div>
				<SaveButtons editor={editor}/>
			</form>
		</div>
	}
}