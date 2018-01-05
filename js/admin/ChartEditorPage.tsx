import ChartEditor, {EditorDatabase} from './ChartEditor'
import Admin from './Admin'
import * as React from 'react'
import {includes, capitalize} from '../charts/Util'
import ChartConfig from '../charts/ChartConfig'
import {observer} from 'mobx-react'
import {observable, computed, runInAction, autorun, action, reaction, IReactionDisposer} from 'mobx'
import EditorBasicTab from './EditorBasicTab'
import EditorDataTab from './EditorDataTab'
import EditorTextTab from './EditorTextTab'
import EditorCustomizeTab from './EditorCustomizeTab'
import EditorScatterTab from './EditorScatterTab'
import EditorMapTab from './EditorMapTab'
import ChartView from '../charts/ChartView'
import Bounds from '../charts/Bounds'
import SaveButtons from './SaveButtons'
import { Modal, LoadingBlocker } from './Forms'

@observer
class TabBinder extends React.Component<{ editor: ChartEditor }> {
    dispose: IReactionDisposer
    componentDidMount() {
        //window.addEventListener("hashchange", this.onHashChange)
        this.onHashChange()

        this.dispose = autorun(() => {
            const tab = this.props.editor.tab
            //setTimeout(() => window.location.hash = `#${tab}-tab`, 100)
        })
    }

    componentDidUnmount() {
        //window.removeEventListener("hashchange", this.onHashChange)
        this.dispose()
    }

    @action.bound onHashChange() {
        const match = window.location.hash.match(/#(.+?)-tab/)
        if (match) {
            const tab = match[1]
            if (this.props.editor.chart && includes(this.props.editor.availableTabs, tab))
                this.props.editor.tab = tab
        }
    }
}

@observer
export default class ChartEditorPage extends React.Component<{ chartId?: number }> {
    @observable.ref chart?: ChartConfig
    @observable.ref database?: EditorDatabase
    context: { admin: Admin }

    async fetchChart() {
        const {chartId} = this.props
        const {admin} = this.context
        const json = chartId === undefined ? { yAxis: { min: 0 }} : await admin.getJSON(`charts/${chartId}.config.json`)
        runInAction(() => this.chart = new ChartConfig(json))
    }

    async fetchData() {
        const {admin} = this.context
        const json = await admin.getJSON(`editorData/namespaces.${admin.cacheTag}.json`)
        runInAction(() => this.database = new EditorDatabase(json))
    }

    @computed get editor(): ChartEditor|undefined {
        if (this.chart === undefined || this.database === undefined) {
            return undefined
        } else {
            const that = this
            return new ChartEditor({
                get admin() { return that.context.admin },
                get chart() { return that.chart as ChartConfig },
                get database() { return that.database as EditorDatabase }
            })
        }
    }

    @action.bound refresh() {
        this.fetchChart()
        this.fetchData()
    }

    dispose: IReactionDisposer
    componentDidMount() {
        this.dispose = reaction(
            () => this.props.chartId,
            this.refresh
        )

        this.refresh()
    }

    componentDidUnmount() {
        this.dispose()
    }

    render() {
        return <div className="ChartEditorPage">
            {(this.editor === undefined || this.editor.currentRequest) && <LoadingBlocker/>}
            {this.editor !== undefined && this.renderReady(this.editor)}
        </div>
    }

    renderReady(editor: ChartEditor) {
        const {chart, availableTabs, previewMode} = editor

        return [
            <TabBinder editor={editor}/>,
            <form onSubmit={e => e.preventDefault()}>
                <div className="p-2">
                    <ul className="nav nav-tabs">
                        {availableTabs.map(tab =>
                            <li className="nav-item">
                                <a className={"nav-link" + (tab === editor.tab ? " active" : "")} onClick={() => editor.tab = tab}>{capitalize(tab)}</a>
                            </li>
                        )}
                    </ul>
                </div>
                <div className="innerForm container">
                    {editor.tab === 'basic' && <EditorBasicTab editor={editor} />}
                    {editor.tab === 'text' && <EditorTextTab editor={editor} />}
                    {editor.tab === 'data' && <EditorDataTab editor={editor} />}
                    {editor.tab === 'customize' && <EditorCustomizeTab editor={editor} />}
                    {editor.tab === 'scatter' && <EditorScatterTab chart={chart} />}
                    {editor.tab === 'map' && <EditorMapTab editor={editor} />}
                </div>
                <SaveButtons editor={editor} />
            </form>,
            <div>
                <figure data-grapher-src>
                    {<ChartView chart={chart} bounds={previewMode === "mobile" ? new Bounds(0, 0, 360, 500) : new Bounds(0, 0, 800, 600)}/>}
                    {/*<ChartView chart={chart} bounds={new Bounds(0, 0, 800, 600)}/>*/}
                </figure>
                <div className="btn-group" data-toggle="buttons">
                    <label className={"btn btn-light" + (previewMode === "mobile" ? " active" : "")} title="Mobile preview" onClick={action(_ => editor.previewMode = 'mobile')}>
                        <input type="radio" name="previewSize" id="mobile" checked={previewMode === "mobile"}/>
                        <i className="fa fa-mobile"/>
                    </label>
                    <label className={"btn btn-light" + (previewMode === "desktop" ? " active" : "")} title="Desktop preview" onClick={action(_ => editor.previewMode = 'desktop')}>
                        <input type="radio" name="previewSize" id="desktop" checked={previewMode === "desktop"}/>
                        <i className="fa fa-desktop"/>
                    </label>
                </div>
            </div>
        ]

    }
}
