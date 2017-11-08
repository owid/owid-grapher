import ChartEditor, {EditorDatabase} from './ChartEditor'
import Admin from './Admin'
import * as React from 'react'
import {extend, toString} from '../charts/Util'
import * as $ from 'jquery'
import ChartConfig from '../charts/ChartConfig'
import {observer} from 'mobx-react'
import {observable, computed, runInAction} from 'mobx'
import LoadingBlocker from './LoadingBlocker'
import EditorBasicTab from './EditorBasicTab'
import EditorDataTab from './EditorDataTab'
import EditorTextTab from './EditorTextTab'
import EditorCustomizeTab from './EditorCustomizeTab'
import EditorScatterTab from './EditorScatterTab'
import EditorMapTab from './EditorMapTab'
import ChartView from '../charts/ChartView'
import Bounds from '../charts/Bounds'
import SaveButtons from './SaveButtons'
import { capitalize } from '../charts/Util'

const Button = require('preact-material-components/Button').default
const Tabs = require('preact-material-components/Tabs').default

@observer
export default class ChartEditorPage extends React.Component<{ admin: Admin, chartId: number }> {
    @observable.ref chart?: ChartConfig
    @observable.ref database?: EditorDatabase

    reportError(err: string) {
        const $modal = modal({ title: "Error fetching editor json", content: toString(err) })
        $modal.addClass("error")
    }

    async fetchChart() {
        const {chartId, admin} = this.props

        try {
            const response = await admin.get(`/admin/charts/${chartId}.config.json`)
            if (!response.ok) {
                return this.reportError(await response.text())
            }

            const json = await response.json()
            runInAction(() => this.chart = new ChartConfig(json))
        } catch (err) {
            this.reportError(err)
            throw err
        }
    }

    async fetchData() {
        const {admin} = this.props

        try {
            const response = await admin.get(`/admin/editorData.${admin.cacheTag}.json`)
            if (!response.ok) {
                return this.reportError(await response.text())
            }

            const json = await response.json()
            runInAction(() => this.database = new EditorDatabase(json))
        } catch (err) {
            this.reportError(err)
            throw err
        }
    }

    @computed get editor(): ChartEditor|undefined {
        if (this.chart === undefined || this.database === undefined) {
            return undefined
        } else {
            const that = this
            return new ChartEditor({
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
        return <div className="ChartEditorPage">
            {this.editor === undefined && <LoadingBlocker/>}
            {this.editor !== undefined && this.renderReady(this.editor)}
        </div>
    }

    renderReady(editor: ChartEditor) {
        const {chart, availableTabs} = editor

        return [
            <form onSubmit={e => e.preventDefault()}>
                <div>
                    <Tabs>
                        {availableTabs.map(tab =>
                            <Tabs.Tab active={tab === editor.tab} onClick={() => editor.tab = tab}>{capitalize(tab)}</Tabs.Tab>
                        )}
                    </Tabs>
                </div>
                <div className="innerForm">
                    {editor.tab === 'basic' && <EditorBasicTab editor={editor} />}
                    {editor.tab === 'text' && <EditorTextTab editor={editor} />}
                    {editor.tab === 'data' && <EditorDataTab editor={editor} />}
                    {editor.tab === 'customize' && <EditorCustomizeTab editor={editor} />}
                    {editor.tab === 'scatter' && <EditorScatterTab chart={chart} />}
                    {editor.tab === 'map' && <EditorMapTab editor={editor} />}
                </div>
                <SaveButtons editor={editor} />
            </form>,
            <figure data-grapher-src>
                <ChartView chart={chart} bounds={new Bounds(0, 0, 400, 850)}/>
            </figure>
        ]

    }
}

// XXX this is old stuff
function modal(options?: any) {
    options = extend({}, options)
    $(".owidModal").remove()

    const html = '<div class="modal owidModal fade" role="dialog">' +
        '<div class="modal-dialog modal-lg">' +
        '<div class="modal-content">' +
        '<div class="modal-header">' +
        '<button type="button" class="close" data-dismiss="modal" aria-label="Close">' +
        '<span aria-hidden="true">&times;</span>' +
        '</button>' +
        '<h4 class="modal-title"></h4>' +
        '</div>' +
        '<div class="modal-body">' +
        '</div>' +
        '<div class="modal-footer">' +
        '</div>' +
        '</div>' +
        '</div>' +
        '</div>'

    $("body").prepend(html)
    const $modal = $(".owidModal") as any
    $modal.find(".modal-title").html(options.title)
    $modal.find(".modal-body").html(options.content)
    $modal.modal("show")
    return $modal
}
