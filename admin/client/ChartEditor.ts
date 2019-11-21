/* ChartEditor.ts
 * ================
 *
 * Mobx store that represents the current editor state and governs non-UI-related operations.
 *
 */

import { observable, computed, runInAction, when } from "mobx"
import { extend } from "charts/Util"
import { ChartConfig } from "charts/ChartConfig"
import { EditorFeatures } from "./EditorFeatures"
import { Admin } from "./Admin"
import { BAKED_GRAPHER_URL } from "settings"
import _ = require("lodash")

export type EditorTab = string

export interface Variable {
    id: number
    name: string
}

export interface Dataset {
    name: string
    namespace: string
    variables: Variable[]
    isPrivate: boolean
}

export interface Log {
    userId: number
    userName: string
    config: string
    createdAt: string
}

export interface PostReference {
    id: number
    title: string
    slug: string
    url: string
}

export interface ChartRedirect {
    id: number
    slug: string
    chartId: number
}

export interface Namespace {
    name: string
    description?: string
}

// This contains the dataset/variable metadata for the entire database
// Used for variable selector interface

interface NamespaceData {
    datasets: Dataset[]
}

export class EditorDatabase {
    @observable.ref namespaces: Namespace[]
    @observable dataByNamespace: Map<string, NamespaceData> = new Map()

    constructor(json: any) {
        this.namespaces = json.namespaces
    }
}

export interface ChartEditorProps {
    admin: Admin
    chart: ChartConfig
    database: EditorDatabase
    logs: Log[]
    references: PostReference[]
    redirects: ChartRedirect[]
}

export class ChartEditor {
    props: ChartEditorProps
    // Whether the current chart state is saved or not
    @observable.ref currentRequest: Promise<any> | undefined
    @observable.ref tab: EditorTab = "basic"
    @observable.ref errorMessage?: { title: string; content: string }
    @observable.ref previewMode: "mobile" | "desktop"
    @observable.ref savedChartConfig: string = ""

    // This gets set when we save a new chart for the first time
    // so the page knows to update the url
    @observable.ref newChartId?: number

    constructor(props: ChartEditorProps) {
        this.props = props
        this.previewMode =
            localStorage.getItem("editorPreviewMode") === "desktop"
                ? "desktop"
                : "mobile"
        when(
            () => this.chart.data.isReady,
            () =>
                (this.savedChartConfig = JSON.stringify(this.currentChartJson))
        )
    }

    @computed get currentChartJson() {
        return this.chart.json
    }

    @computed get isModified(): boolean {
        return JSON.stringify(this.currentChartJson) !== this.savedChartConfig
    }

    @computed get chart(): ChartConfig {
        return this.props.chart
    }

    @computed get database(): EditorDatabase {
        return this.props.database
    }

    @computed get logs(): Log[] {
        return this.props.logs
    }

    @computed get references(): PostReference[] {
        return this.props.references
    }

    @computed get redirects(): ChartRedirect[] {
        return this.props.redirects
    }

    @computed get availableTabs(): EditorTab[] {
        if (!this.chart.activeTransform.isValidConfig) {
            return ["basic"]
        } else {
            const tabs: EditorTab[] = ["basic", "data", "text", "customize"]
            if (this.chart.hasMapTab) tabs.push("map")
            if (this.chart.isScatter || this.chart.isTimeScatter)
                tabs.push("scatter")
            tabs.push("revisions")
            tabs.push("refs")
            return tabs
        }
    }

    @computed get isNewChart() {
        return this.chart.props.id === undefined
    }

    @computed get features() {
        return new EditorFeatures(this)
    }

    async applyConfig(config: any) {
        this.props.chart.update(JSON.parse(config))
    }

    // Load index of datasets and variables for the given namespace
    async loadNamespace(namespace: string) {
        const data = await this.props.admin.getJSON(
            `/api/editorData/${namespace}.json`
        )
        runInAction(() =>
            this.database.dataByNamespace.set(namespace, data as any)
        )
    }

    async saveChart({ onError }: { onError?: () => void } = {}) {
        const { chart, isNewChart, currentChartJson } = this

        const targetUrl = isNewChart
            ? "/api/charts"
            : `/api/charts/${chart.props.id}`

        const json = await this.props.admin.requestJSON(
            targetUrl,
            currentChartJson,
            isNewChart ? "POST" : "PUT"
        )

        if (json.success) {
            if (isNewChart) {
                this.newChartId = json.chartId
            } else {
                runInAction(() => {
                    chart.props.version += 1
                    this.logs.unshift(json.newLog)
                    this.savedChartConfig = JSON.stringify(currentChartJson)
                })
            }
        } else {
            if (onError) onError()
        }
    }

    async saveAsNewChart() {
        const { currentChartJson } = this

        const chartJson = extend({}, currentChartJson)
        delete chartJson.id
        delete chartJson.isPublished

        // Need to open intermediary tab before AJAX to avoid popup blockers
        const w = window.open("/", "_blank") as Window

        const json = await this.props.admin.requestJSON(
            "/api/charts",
            chartJson,
            "POST"
        )
        if (json.success)
            w.location.assign(
                this.props.admin.url(`charts/${json.chartId}/edit`)
            )
    }

    publishChart() {
        const url = `${BAKED_GRAPHER_URL}/${this.chart.data.slug}`

        if (window.confirm(`Publish chart at ${url}?`)) {
            this.chart.props.isPublished = true
            this.saveChart({
                onError: () => (this.chart.props.isPublished = undefined)
            })
        }
    }

    unpublishChart() {
        const message =
            this.references && this.references.length > 0
                ? "WARNING: This chart might be referenced from public posts, please double check before unpublishing. Remove chart anyway?"
                : "Are you sure you want to unpublish this chart?"
        if (window.confirm(message)) {
            this.chart.props.isPublished = undefined
            this.saveChart({
                onError: () => (this.chart.props.isPublished = true)
            })
        }
    }
}
