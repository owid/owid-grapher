import ChartEditor, {EditorDatabase} from './ChartEditor'
import Admin from './Admin'
import * as React from 'react'
import {extend, toString, includes} from '../charts/Util'
import * as $ from 'jquery'
import ChartConfig from '../charts/ChartConfig'
import {observer} from 'mobx-react'
import {observable, computed, runInAction, autorun, action, IReactionDisposer} from 'mobx'
import EditorBasicTab from './EditorBasicTab'
import EditorDataTab from './EditorDataTab'
import EditorTextTab from './EditorTextTab'
import EditorCustomizeTab from './EditorCustomizeTab'
import EditorScatterTab from './EditorScatterTab'
import EditorMapTab from './EditorMapTab'
import ChartView from '../charts/ChartView'
import Bounds from '../charts/Bounds'
import SaveButtons from './SaveButtons'

import { Menu, Form, Dimmer, Loader, Grid, Modal } from 'semantic-ui-react'

@observer
class TabBinder extends React.Component<{ editor: ChartEditor }> {
    dispose: IReactionDisposer
    componentDidMount() {
        window.addEventListener("hashchange", this.onHashChange)
        this.onHashChange()

        this.dispose = autorun(() => {
            const tab = this.props.editor.tab
            setTimeout(() => window.location.hash = `#${tab}-tab`, 100)
        })
    }

    componentDidUnmount() {
        window.removeEventListener("hashchange", this.onHashChange)
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
export default class ChartEditorPage extends React.Component<{ admin: Admin, chartId: number|undefined }> {
    @observable.ref chart?: ChartConfig
    @observable.ref database?: EditorDatabase
    @observable.ref errorMessage?: { title: string, content: string }

    async fetchChart() {
        const {chartId, admin} = this.props

        const handleError = action((err: string) => {
            this.errorMessage = { title: "Error fetching chart json", content: err }
        })

        try {
            const response = await admin.get(`/admin/charts/${chartId === undefined ? "newChart" : chartId}.config.json`)
            if (!response.ok) {
                return handleError(await response.text())
            }

            const json = await response.json()
            runInAction(() => this.chart = new ChartConfig(json))
        } catch (err) {
            handleError(err)
            throw err
        }
    }

    async fetchData() {
        const {admin} = this.props

        const handleError = action((err: string) => {
            this.errorMessage = { title: "Error fetching editorData json", content: err }
        })

        try {
            const response = await admin.get(`/admin/editorData.${admin.cacheTag}.json`)
            if (!response.ok) {
                return handleError(await response.text())
            }

            const json = await response.json()
            runInAction(() => this.database = new EditorDatabase(json))
        } catch (err) {
            handleError(err)
            throw err
        }
    }

    @computed get editor(): ChartEditor|undefined {
        if (this.chart === undefined || this.database === undefined) {
            return undefined
        } else {
            const that = this
            return new ChartEditor({
                get admin() { return that.props.admin },
                get chart() { return that.chart as ChartConfig },
                get database() { return that.database as EditorDatabase }
            })
        }
    }

    componentDidMount() {
        this.fetchChart()
        this.fetchData()
    }

    render() {
        const errorMessage = this.errorMessage || (this.editor && this.editor.errorMessage)

        return <div className="ChartEditorPage">
            {errorMessage && <Modal open={true} onClose={action(() => { this.errorMessage = undefined; if (this.editor) this.editor.errorMessage = undefined })}>
                <Modal.Header>
                    {errorMessage.title}
                </Modal.Header>
                <Modal.Content>
                    {errorMessage.content}
                </Modal.Content>
            </Modal>}
            {(this.editor === undefined || this.editor.currentRequest) && <Dimmer active>
                <Loader/>
            </Dimmer>}
            {this.editor !== undefined && this.renderReady(this.editor)}
        </div>
    }

    renderReady(editor: ChartEditor) {
        const {chart, availableTabs, previewMode} = editor

        return [
            <TabBinder editor={editor}/>,
            <Form onSubmit={e => e.preventDefault()}>
                <div>
                    <Menu tabular>
                        {availableTabs.map(tab =>
                            <Menu.Item name={tab} active={tab === editor.tab} onClick={() => editor.tab = tab}/>
                        )}
                    </Menu>
                </div>
                <Grid padded={true} columns={1} className="innerForm">
                    <Grid.Column>
                        {editor.tab === 'basic' && <EditorBasicTab editor={editor} />}
                        {editor.tab === 'text' && <EditorTextTab editor={editor} />}
                        {editor.tab === 'data' && <EditorDataTab editor={editor} />}
                        {editor.tab === 'customize' && <EditorCustomizeTab editor={editor} />}
                        {editor.tab === 'scatter' && <EditorScatterTab chart={chart} />}
                        {editor.tab === 'map' && <EditorMapTab editor={editor} />}
                    </Grid.Column>
                </Grid>
                <SaveButtons editor={editor} />
            </Form>,
            <div>
                <figure data-grapher-src>
                    {<ChartView chart={chart} bounds={previewMode === "mobile" ? new Bounds(0, 0, 400, 600) : new Bounds(0, 0, 800, 600)}/>}
                    {/*<ChartView chart={chart} bounds={new Bounds(0, 0, 800, 600)}/>*/}
                </figure>
                <div className="ui menu">
                    <a className={"item" + (previewMode === "mobile" ? " active" : "")} title="Mobile preview" onClick={action(_ => editor.previewMode = 'mobile')}><i className="fa fa-mobile"/></a>
                    <a className={"item" + (previewMode === "desktop" ? " active" : "")} title="Desktop preview" onClick={action(_ => editor.previewMode = 'desktop')}><i className="fa fa-desktop"/></a>
                </div>
            </div>
        ]

    }
}