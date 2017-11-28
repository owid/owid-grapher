/* ChartEditor.ts
 * ================
 *
 * Mobx store that represents the current editor state and governs non-UI-related operations.
 *
 */

import { observable, computed, reaction, action } from 'mobx'
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
export class EditorDatabase {
    @observable.ref datasets: Dataset[]

    @computed get namespaces(): string[] {
        return uniq(this.datasets.map(d => d.namespace))
    }

    constructor(json: any) {
        this.datasets = json.datasets
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

    // Track whether we're currently loading something
    load<T>(promise: Promise<T>) {
        this.currentRequest = promise
        promise.then(() => this.currentRequest = undefined).catch(() => this.currentRequest = undefined)
        return promise
    }

    async saveChart({ onError }: { onError?: () => void } = {}) {
        const { chart, isNewChart } = this

        const targetUrl = isNewChart ? "/admin/charts" : `/admin/charts/${chart.props.id}`

        const handleError = action((err: string) => {
            this.errorMessage = { title: "Error saving chart", content: toString(err) }
            if (onError) onError()
        })

        try {
            const response = await this.load(this.props.admin.request(targetUrl, chart.json, isNewChart ? 'POST' : 'PUT'))
            if (!response.ok)
                return handleError(await response.text())

            const json = await response.json()

            if (isNewChart) {
                window.location.assign(this.props.admin.url(`/admin/charts/${json.data.id}/edit`))
            } else {
                this.isSaved = true
            }
        } catch (err) {
            handleError(err)
        }
    }

    async saveAsNewChart() {
        const { chart } = this

        const chartJson = extend({}, chart.json)
        delete chartJson.id
        delete chartJson.published

        // Need to open intermediary tab before AJAX to avoid popup blockers
        const w = window.open("/", "_blank")

        const handleError = action((err: string) => {
            this.errorMessage = { title: "Error saving as new chart", content: toString(err) }
        })

        try {
            const response = await this.load(this.props.admin.request("/admin/charts", chartJson, 'POST'))
            if (!response.ok)
                return handleError(await response.text())

            const json = await response.json()

            w.location.assign(this.props.admin.url(`/admin/charts/${json.data.id}/edit`))
        } catch (err) {
            handleError(err)
        }
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
