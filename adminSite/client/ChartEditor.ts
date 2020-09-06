/* ChartEditor.ts
 * ================
 *
 * Mobx store that represents the current editor state and governs non-UI-related operations.
 *
 */

import { observable, computed, runInAction, when } from "mobx"
import { Grapher } from "charts/core/Grapher"
import { EditorFeatures } from "./EditorFeatures"
import { Admin } from "./Admin"
import { BAKED_GRAPHER_URL } from "settings"

type EditorTab = string

interface Variable {
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

interface ChartEditorProps {
    admin: Admin
    grapher: Grapher
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
    @observable.ref savedGrapherJson: string = ""

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
            () => this.grapher.isReady,
            () =>
                (this.savedGrapherJson = JSON.stringify(
                    this.currentGrapherObject
                ))
        )
    }

    @computed get currentGrapherObject() {
        return this.grapher.object
    }

    @computed get isModified(): boolean {
        return (
            JSON.stringify(this.currentGrapherObject) !== this.savedGrapherJson
        )
    }

    @computed get grapher(): Grapher {
        return this.props.grapher
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
        if (!this.grapher.isValidConfig) {
            return ["basic"]
        } else {
            const tabs: EditorTab[] = ["basic", "data", "text", "customize"]
            if (this.grapher.hasMapTab) tabs.push("map")
            if (this.grapher.isScatter || this.grapher.isTimeScatter)
                tabs.push("scatter")
            tabs.push("revisions")
            tabs.push("refs")
            return tabs
        }
    }

    @computed get isNewGrapher() {
        return this.grapher.id === undefined
    }

    @computed get features() {
        return new EditorFeatures(this)
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

    async saveGrapher({ onError }: { onError?: () => void } = {}) {
        const { grapher, isNewGrapher, currentGrapherObject } = this

        // Chart title and slug may be autocalculated from data, in which case they won't be in props
        // But the server will need to know what we calculated in order to do its job
        if (!currentGrapherObject.title)
            currentGrapherObject.title = grapher.displayTitle

        if (!currentGrapherObject.slug) {
            currentGrapherObject.slug = grapher.displaySlug


        const targetUrl = isNewGrapher
            ? "/api/charts"
            : `/api/charts/${grapher.id}`

        const json = await this.props.admin.requestJSON(
            targetUrl,
            currentGrapherObject,
            isNewGrapher ? "POST" : "PUT"
        )

        if (json.success) {
            if (isNewGrapher) {
                this.newChartId = json.chartId
            } else {
                runInAction(() => {
                    grapher.version += 1
                    this.logs.unshift(json.newLog)
                    this.savedGrapherJson = JSON.stringify(currentGrapherObject)
                })
            }
        } else {
            if (onError) onError()
        }
    }

    async saveAsNewGrapher() {
        const { currentGrapherObject } = this

        const chartJson = { ...currentGrapherObject }
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

    publishGrapher() {
        const url = `${BAKED_GRAPHER_URL}/${this.grapher.displaySlug}`

        if (window.confirm(`Publish chart at ${url}?`)) {
            this.grapher.isPublished = true
            this.saveGrapher({
                onError: () => (this.grapher.isPublished = undefined)
            })
        }
    }

    unpublishGrapher() {
        const message =
            this.references && this.references.length > 0
                ? "WARNING: This chart might be referenced from public posts, please double check before unpublishing. Remove chart anyway?"
                : "Are you sure you want to unpublish this chart?"
        if (window.confirm(message)) {
            this.grapher.isPublished = undefined
            this.saveGrapher({
                onError: () => (this.grapher.isPublished = true)
            })
        }
    }
}
