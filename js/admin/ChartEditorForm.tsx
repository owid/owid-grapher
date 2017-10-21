import * as React from 'react'
import { capitalize, includes } from '../charts/Util'
import EditorBasicTab from './EditorBasicTab'
import EditorDataTab from './EditorDataTab'
import EditorTextTab from './EditorTextTab'
import EditorCustomizeTab from './EditorCustomizeTab'
import EditorScatterTab from './EditorScatterTab'
import EditorMapTab from './EditorMapTab'
import ChartEditor from './ChartEditor'
import SaveButtons from './SaveButtons'
import ChartView from '../charts/ChartView'
import Bounds from '../charts/Bounds'
import { observer } from 'mobx-react'
import { action, autorun } from 'mobx'
import LoadingBlocker from './LoadingBlocker'

declare const window: any

// The tabbed widget containing all the chart editor options
@observer
export default class ChartEditorForm extends React.Component<{ editor: ChartEditor }> {
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
            if (this.props.editor.chart && includes(this.props.editor.availableTabs, tab))
                this.props.editor.tab = tab
        }
    }

    renderReady() {
        const {editor} = this.props
        const {chart, availableTabs} = editor

        return [
            <ChartView chart={chart} bounds={new Bounds(0, 0, 400, 850)}/>,
            <form onSubmit={e => e.preventDefault()}>
                <div className="nav-tabs-custom">
                    <ul className="nav nav-tabs no-bullets">
                        {availableTabs.map(tab =>
                            <li className={tab === editor.tab ? "nav-item active" : "nav-item"}>
                                <a className="nav-link clickable" onClick={() => editor.tab = tab}>{capitalize(tab)}</a>
                            </li>
                        )}
                    </ul>
                </div>
                <div>
                    {editor.tab === 'basic' && <EditorBasicTab editor={editor} />}
                    {editor.tab === 'text' && <EditorTextTab editor={editor} />}
                    {editor.tab === 'data' && <EditorDataTab editor={editor} />}
                    {editor.tab === 'customize' && <EditorCustomizeTab editor={editor} />}
                    {editor.tab === 'scatter' && <EditorScatterTab chart={chart} />}
                    {editor.tab === 'map' && <EditorMapTab editor={editor} />}
                </div>
                <SaveButtons editor={editor} />
            </form>
        ]
    }

    render() {
        const { editor } = this.props
        const { chart } = editor

        window.editor = editor
        return <div className="form-wrapper-inner">
            {(editor.currentRequest || !chart.data.isReady) && <LoadingBlocker />}
            {chart && chart.data.isReady && this.renderReady()}
        </div>
    }
}
