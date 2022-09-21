/* ChartEditor.ts
 * ================
 *
 * Mobx store that represents the current editor state and governs non-UI-related operations.
 *
 */

import { observable, computed, runInAction, when, makeObservable } from "mobx"
import { Grapher } from "../grapher/core/Grapher.js"
import { EditorFeatures } from "./EditorFeatures.js"
import { Admin } from "./Admin.js"
import { BAKED_GRAPHER_URL } from "../settings/clientSettings.js"
import { Topic } from "../grapher/core/GrapherConstants.js"
import { GrapherInterface } from "../grapher/core/GrapherInterface.js"

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
    nonRedistributable: boolean
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
    isArchived: boolean
}

// This contains the dataset/variable metadata for the entire database
// Used for variable selector interface

export interface NamespaceData {
    datasets: Dataset[]
}

export class EditorDatabase {
    namespaces: Namespace[]
    variableUsageCounts: Map<number, number> = new Map()
    dataByNamespace: Map<string, NamespaceData> = new Map()

    constructor(json: any) {
        makeObservable(this, {
            namespaces: observable.ref,
            variableUsageCounts: observable.ref,
            dataByNamespace: observable,
        })

        this.namespaces = json.namespaces
    }
}

export interface ChartEditorManager {
    admin: Admin
    grapher: Grapher
    database: EditorDatabase
    logs: Log[]
    references: PostReference[]
    redirects: ChartRedirect[]
    allTopics: Topic[]
    details: GrapherInterface["details"]
    invalidDetailReferences: Record<"subtitle" | "note", [string, string][]>
}

interface VariableIdUsageRecord {
    variableId: number
    usageCount: number
}

export class ChartEditor {
    manager: ChartEditorManager
    // Whether the current chart state is saved or not
    currentRequest: Promise<any> | undefined
    tab: EditorTab = "basic"
    errorMessage?: { title: string; content: string }
    previewMode: "mobile" | "desktop"
    savedGrapherJson: string = ""

    // This gets set when we save a new chart for the first time
    // so the page knows to update the url
    newChartId?: number

    constructor(props: { manager: ChartEditorManager }) {
        makeObservable(this, {
            currentRequest: observable.ref,
            tab: observable.ref,
            errorMessage: observable.ref,
            previewMode: observable.ref,
            savedGrapherJson: observable.ref,
            newChartId: observable.ref,
            isModified: computed,
            grapher: computed,
            database: computed,
            logs: computed,
            references: computed,
            redirects: computed,
            allTopics: computed,
            details: computed,
            availableTabs: computed,
            isNewGrapher: computed,
            features: computed,
        })

        this.manager = props.manager
        this.previewMode =
            localStorage.getItem("editorPreviewMode") === "desktop"
                ? "desktop"
                : "mobile"
        when(
            () => this.grapher.isReady,
            () => (this.savedGrapherJson = JSON.stringify(this.grapher.object))
        )
    }

    get isModified(): boolean {
        return JSON.stringify(this.grapher.object) !== this.savedGrapherJson
    }

    get grapher() {
        return this.manager.grapher
    }

    get database() {
        return this.manager.database
    }

    get logs() {
        return this.manager.logs
    }

    get references() {
        return this.manager.references
    }

    get redirects() {
        return this.manager.redirects
    }

    get allTopics() {
        return this.manager.allTopics
    }

    get details() {
        return this.manager.details
    }

    get availableTabs(): EditorTab[] {
        const tabs: EditorTab[] = ["basic", "data", "text", "customize"]
        if (this.grapher.hasMapTab) tabs.push("map")
        if (this.grapher.isScatter || this.grapher.isTimeScatter)
            tabs.push("scatter")
        if (this.grapher.isMarimekko) tabs.push("marimekko")
        tabs.push("revisions")
        tabs.push("refs")
        return tabs
    }

    get isNewGrapher() {
        return this.grapher.id === undefined
    }

    get features() {
        return new EditorFeatures(this)
    }

    // Load index of datasets and variables for the given namespace
    async loadNamespace(namespace: string): Promise<void> {
        const data = await this.manager.admin.getJSON(
            `/api/editorData/${namespace}.json`
        )
        runInAction(() =>
            this.database.dataByNamespace.set(namespace, data as any)
        )
    }
    async loadVariableUsageCounts(): Promise<void> {
        const data = (await this.manager.admin.getJSON(
            `/api/variables.usages.json`
        )) as VariableIdUsageRecord[]
        const finalData = new Map(
            data.map(({ variableId, usageCount }: VariableIdUsageRecord) => [
                variableId,
                usageCount,
            ])
        )
        runInAction(() => (this.database.variableUsageCounts = finalData))
    }

    async saveGrapher({
        onError,
    }: { onError?: () => void } = {}): Promise<void> {
        const { grapher, isNewGrapher } = this
        const currentGrapherObject = this.grapher.object

        // Chart title and slug may be autocalculated from data, in which case they won't be in props
        // But the server will need to know what we calculated in order to do its job
        if (!currentGrapherObject.title)
            currentGrapherObject.title = grapher.displayTitle

        if (!currentGrapherObject.slug)
            currentGrapherObject.slug = grapher.displaySlug

        // We need to save availableEntities for Algolia search. Todo: remove.
        const availableEntities = grapher.table.availableEntityNames
        if (availableEntities.length)
            (currentGrapherObject as any).data = { availableEntities }

        const targetUrl = isNewGrapher
            ? "/api/charts"
            : `/api/charts/${grapher.id}`

        const json = await this.manager.admin.requestJSON(
            targetUrl,
            currentGrapherObject,
            isNewGrapher ? "POST" : "PUT"
        )

        if (json.success) {
            if (isNewGrapher) {
                this.newChartId = json.chartId
                this.grapher.id = json.chartId
                this.savedGrapherJson = JSON.stringify(this.grapher.object)
            } else {
                runInAction(() => {
                    grapher.version += 1
                    this.logs.unshift(json.newLog)
                    this.savedGrapherJson = JSON.stringify(currentGrapherObject)
                })
            }
        } else onError?.()
    }

    async saveAsNewGrapher(): Promise<void> {
        const currentGrapherObject = this.grapher.object

        const chartJson = { ...currentGrapherObject }
        delete chartJson.id
        delete chartJson.isPublished

        // Need to open intermediary tab before AJAX to avoid popup blockers
        const w = window.open("/", "_blank") as Window

        const json = await this.manager.admin.requestJSON(
            "/api/charts",
            chartJson,
            "POST"
        )
        if (json.success)
            w.location.assign(
                this.manager.admin.url(`charts/${json.chartId}/edit`)
            )
    }

    publishGrapher(): void {
        const url = `${BAKED_GRAPHER_URL}/${this.grapher.displaySlug}`

        if (window.confirm(`Publish chart at ${url}?`)) {
            this.grapher.isPublished = true
            this.saveGrapher({
                onError: () => (this.grapher.isPublished = undefined),
            })
        }
    }

    unpublishGrapher(): void {
        const message =
            this.references && this.references.length > 0
                ? "WARNING: This chart might be referenced from public posts, please double check before unpublishing. Remove chart anyway?"
                : "Are you sure you want to unpublish this chart?"
        if (window.confirm(message)) {
            this.grapher.isPublished = undefined
            this.saveGrapher({
                onError: () => (this.grapher.isPublished = true),
            })
        }
    }
}
