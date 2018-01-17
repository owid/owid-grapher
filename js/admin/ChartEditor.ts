/* ChartEditor.ts
 * ================
 *
 * Mobx store that represents the current editor state and governs non-UI-related operations.
 *
 */

import { observable, computed, reaction, action, runInAction } from 'mobx'
import { extend, toString, uniq } from '../charts/Util'
import ChartConfig from '../charts/ChartConfig'
import EditorFeatures from './EditorFeatures'
import Admin from './Admin'

declare const Global: { rootUrl: string }

export type EditorTab = string

export interface Variable {
    id: number
    name: string
}

export interface Dataset {
    name: string
    namespace: string
    variables: Variable[]
}

// This contains the dataset/variable metadata for the entire database
// Used for variable selector interface

interface NamespaceData {
    datasets: Dataset[]
}

export class EditorDatabase {
    @observable.ref namespaces: string[]
    @observable dataByNamespace: Map<string, NamespaceData> = new Map()

    constructor(json: any) {
        this.namespaces = json.namespaces
    }
}

export interface ChartEditorProps {
    admin: Admin
    chart: ChartConfig
    database: EditorDatabase
}

export default class ChartEditor {
    props: ChartEditorProps
    // Whether the current chart state is saved or not
    @observable.ref isSaved: boolean = true
    @observable.ref currentRequest: Promise<any> | undefined
    @observable.ref tab: EditorTab = 'basic'
    @observable.ref errorMessage?: { title: string, content: string }
    @observable.ref previewMode: 'mobile'|'desktop' = 'mobile'

    constructor(props: ChartEditorProps) {
        this.props = props
        reaction(
            () => this.chart && this.chart.json,
            () => this.isSaved = false
        )
    }

    @computed get chart(): ChartConfig {
        return this.props.chart
    }

    @computed get database(): EditorDatabase {
        return this.props.database
    }

    @computed get availableTabs(): EditorTab[] {
        if (!this.chart.activeTransform.isValidConfig) {
            return ['basic']
        } else {
            const tabs: EditorTab[] = ['basic', 'data', 'text', 'customize']
            if (this.chart.hasMapTab) tabs.push('map')
            if (this.chart.isScatter) tabs.push('scatter')
            return tabs
        }
    }

    @computed get isNewChart() {
        return this.chart.props.id === undefined
    }

    @computed get features() {
        return new EditorFeatures(this)
    }

    // Load index of datasets and variables for the given namespace
    async loadNamespace(namespace: string) {
        const data = await this.props.admin.getJSON(`editorData/${namespace}.${this.props.admin.cacheTag}.json`)
        runInAction(() => this.database.dataByNamespace.set(namespace, data))
    }

    async saveChart({ onError }: { onError?: () => void } = {}) {
        const { chart, isNewChart } = this

        const targetUrl = isNewChart ? "charts" : `charts/${chart.props.id}`

        const json = await this.props.admin.requestJSON(targetUrl, chart.json, isNewChart ? 'POST' : 'PUT')

        if (json.success) {
            if (isNewChart) {
                window.location.assign(this.props.admin.url(`charts/${json.data.id}/edit`))
            } else {
                this.isSaved = true
                chart.props.version += 1
            }
        } else {
            if (onError) onError()
        }
    }

    async saveAsNewChart() {
        const { chart } = this

        const chartJson = extend({}, chart.json)
        delete chartJson.id
        delete chartJson.isPublished

        // Need to open intermediary tab before AJAX to avoid popup blockers
        const w = window.open("/", "_blank") as Window

        const json = await this.props.admin.requestJSON("charts", chartJson, 'POST')
        if (json.success)
            w.location.assign(this.props.admin.url(`charts/${json.data.id}/edit`))
    }

    publishChart() {
        const url = Global.rootUrl + "/" + this.chart.data.slug

        if (window.confirm(`Publish chart at ${url}?`)) {
            this.chart.props.isPublished = true
            this.saveChart({ onError: () => this.chart.props.isPublished = undefined })
        }
    }

    unpublishChart() {
        if (window.confirm("Really unpublish chart?")) {
            this.chart.props.isPublished = undefined
            this.saveChart({ onError: () => this.chart.props.isPublished = true })
        }
    }
}
