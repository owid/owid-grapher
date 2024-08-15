/* ChartEditor.ts
 * ================
 *
 * Mobx store that represents the current editor state and governs non-UI-related operations.
 *
 */

import {
    type RawPageview,
    PostReference,
    ChartRedirect,
    Json,
    GrapherInterface,
    getParentVariableIdFromChartConfig,
    mergeGrapherConfigs,
    isEmpty,
} from "@ourworldindata/utils"
import { action, computed, observable, runInAction } from "mobx"
import { BAKED_GRAPHER_URL } from "../settings/clientSettings.js"
import {
    AbstractChartEditor,
    AbstractChartEditorManager,
    EditorTab,
} from "./AbstractChartEditor.js"
import { Admin } from "./Admin.js"

export interface Log {
    userId: number
    userName: string
    config: Json
    createdAt: string
}

export interface References {
    postsWordpress: PostReference[]
    postsGdocs: PostReference[]
    explorers: string[]
}

export const getFullReferencesCount = (references: References): number => {
    return (
        references.postsWordpress.length +
        references.postsGdocs.length +
        references.explorers.length
    )
}

export interface ChartEditorManager extends AbstractChartEditorManager {
    logs: Log[]
    references: References | undefined
    redirects: ChartRedirect[]
    pageviews?: RawPageview
}

export class ChartEditor extends AbstractChartEditor<ChartEditorManager> {
    // This gets set when we save a new chart for the first time
    // so the page knows to update the url
    @observable.ref newChartId?: number

    @computed get logs() {
        return this.manager.logs
    }

    @computed get references() {
        return this.manager.references
    }

    @computed get redirects() {
        return this.manager.redirects
    }

    @computed get pageviews() {
        return this.manager.pageviews
    }

    @computed get availableTabs(): EditorTab[] {
        const tabs: EditorTab[] = ["basic", "data", "text", "customize"]
        if (this.grapher.hasMapTab) tabs.push("map")
        if (this.grapher.isScatter) tabs.push("scatter")
        if (this.grapher.isMarimekko) tabs.push("marimekko")
        tabs.push("revisions")
        tabs.push("refs")
        if (this.parentConfig) tabs.push("inheritance")
        tabs.push("export")
        return tabs
    }

    @computed get isNewGrapher() {
        return this.grapher.id === undefined
    }

    @action.bound async updateParentConfig() {
        const currentParentIndicatorId =
            this.parentConfig?.dimensions?.[0].variableId
        const newParentIndicatorId = getParentVariableIdFromChartConfig(
            this.grapher.object
        )

        // fetch the new parent config if the indicator has changed
        let newParentConfig: GrapherInterface | undefined
        if (
            newParentIndicatorId &&
            (currentParentIndicatorId === undefined ||
                newParentIndicatorId !== currentParentIndicatorId)
        ) {
            newParentConfig = await fetchMergedGrapherConfigByVariableId(
                this.manager.admin,
                newParentIndicatorId
            )
        }

        // if inheritance is enabled, update the live grapher object
        if (this.isInheritanceEnabled) {
            const newConfig = mergeGrapherConfigs(
                newParentConfig ?? {},
                this.patchConfig
            )
            this.updateLiveGrapher(newConfig)
        }

        // update the parent config in any case
        this.parentConfig = newParentConfig

        // disable inheritance if there is no parent config
        if (!this.parentConfig) {
            this.isInheritanceEnabled = false
        }
    }

    async saveGrapher({
        onError,
    }: { onError?: () => void } = {}): Promise<void> {
        const { grapher, isNewGrapher, patchConfig } = this

        // Chart title and slug may be autocalculated from data, in which case they won't be in props
        // But the server will need to know what we calculated in order to do its job
        if (!patchConfig.title) patchConfig.title = grapher.displayTitle
        if (!patchConfig.slug) patchConfig.slug = grapher.displaySlug

        const query = new URLSearchParams({
            inheritance: this.isInheritanceEnabled ? "enable" : "disable",
        })
        const targetUrl = isNewGrapher
            ? `/api/charts?${query}`
            : `/api/charts/${grapher.id}?${query}`

        const json = await this.manager.admin.requestJSON(
            targetUrl,
            patchConfig,
            isNewGrapher ? "POST" : "PUT"
        )

        if (json.success) {
            if (isNewGrapher) {
                this.newChartId = json.chartId
                this.grapher.id = json.chartId
                this.savedPatchConfig = json.savedPatch
            } else {
                runInAction(() => {
                    grapher.version += 1
                    this.logs.unshift(json.newLog)
                    this.savedPatchConfig = json.savedPatch
                })
            }
        } else onError?.()
    }

    async saveAsNewGrapher(): Promise<void> {
        const { patchConfig } = this

        const chartJson = { ...patchConfig }
        delete chartJson.id
        delete chartJson.isPublished

        // Need to open intermediary tab before AJAX to avoid popup blockers
        const w = window.open("/", "_blank") as Window

        const query = new URLSearchParams({
            inheritance: this.isInheritanceEnabled ? "enable" : "disable",
        })
        const targetUrl = `/api/charts?${query}`

        const json = await this.manager.admin.requestJSON(
            targetUrl,
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
            void this.saveGrapher({
                onError: () => (this.grapher.isPublished = undefined),
            })
        }
    }

    unpublishGrapher(): void {
        const message =
            this.references && getFullReferencesCount(this.references) > 0
                ? "WARNING: This chart might be referenced from public posts, please double check before unpublishing. Try to remove the chart anyway?"
                : "Are you sure you want to unpublish this chart?"
        if (window.confirm(message)) {
            this.grapher.isPublished = undefined
            void this.saveGrapher({
                onError: () => (this.grapher.isPublished = true),
            })
        }
    }
}

export async function fetchMergedGrapherConfigByVariableId(
    admin: Admin,
    indicatorId: number
): Promise<GrapherInterface | undefined> {
    const indicatorChart = await admin.getJSON(
        `/api/variables/mergedGrapherConfig/${indicatorId}.json`
    )
    return isEmpty(indicatorChart) ? undefined : indicatorChart
}

export function isChartEditorInstance(
    editor: AbstractChartEditor
): editor is ChartEditor {
    return editor instanceof ChartEditor
}
