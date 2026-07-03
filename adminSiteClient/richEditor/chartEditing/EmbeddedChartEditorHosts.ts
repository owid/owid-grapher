import { observable, runInAction, makeObservable } from "mobx"
import type { History } from "history"
import {
    GrapherInterface,
    ChartRedirect,
    DbChartTagJoin,
    type AnalyticsGrapherViewWithRank,
} from "@ourworldindata/types"
import { Admin } from "../../Admin.js"
import { ChartEditor, ChartEditorManager, Log } from "../../ChartEditor.js"
import {
    NarrativeChartEditor,
    NarrativeChartEditorManager,
} from "../../NarrativeChartEditor.js"
import { References } from "../../AbstractChartEditor.js"
import {
    GDP_PER_CAPITA_CATALOG_PATH,
    POPULATION_CATALOG_PATH,
} from "../../constants.js"

// Managers for chart editors embedded in the rich editor's right rail.
// Unlike the standalone editor pages (which fetch piecemeal while the page
// shows a loading blocker), a host fetches everything in init() and only
// constructs its editor once the data is there — an editing session is
// handed to React fully initialized.

export class EmbeddedChartEditorHost implements ChartEditorManager {
    readonly embedded = true
    admin: Admin
    chartId: number

    patchConfig: GrapherInterface = {}
    parentConfig: GrapherInterface | undefined = undefined
    isInheritanceEnabled: boolean | undefined = undefined
    variableIdsByCatalogPath: Record<string, number | null> | undefined =
        undefined

    // saveGrapher unshifts into logs, and EditorReferencesTab pushes into
    // redirects, so both must be observable arrays
    logs: Log[] = []
    references: References | undefined = undefined
    redirects: ChartRedirect[] = []
    views: AnalyticsGrapherViewWithRank | undefined = undefined
    tags: DbChartTagJoin[] | undefined = undefined
    availableTags: DbChartTagJoin[] | undefined = undefined
    forceDatapage: boolean | undefined = undefined

    editor: ChartEditor | undefined = undefined

    constructor(admin: Admin, chartId: number) {
        makeObservable(this, {
            patchConfig: observable.ref,
            parentConfig: observable.ref,
            isInheritanceEnabled: observable.ref,
            variableIdsByCatalogPath: observable.ref,
            logs: observable,
            references: observable,
            redirects: observable,
            views: observable,
            tags: observable,
            availableTags: observable,
            forceDatapage: observable.ref,
            editor: observable.ref,
        })
        this.admin = admin
        this.chartId = chartId
    }

    /** fetch everything the editor's tabs need, then construct the editor */
    async init(): Promise<void> {
        const { admin, chartId } = this
        const [
            patchConfig,
            parent,
            settings,
            logs,
            refs,
            redirects,
            views,
            tags,
            availableTags,
            variableIdsByCatalogPath,
        ] = await Promise.all([
            admin.getJSON(`/api/charts/${chartId}.patchConfig.json`),
            admin.getJSON(`/api/charts/${chartId}.parent.json`),
            admin.getJSON(`/api/charts/${chartId}.settings.json`),
            admin.getJSON(`/api/charts/${chartId}.logs.json`),
            admin.getJSON(`/api/charts/${chartId}.references.json`),
            admin.getJSON(`/api/charts/${chartId}.redirects.json`),
            admin.getJSON(`/api/charts/${chartId}.views.json`),
            admin.getJSON(`/api/charts/${chartId}.tags.json`),
            admin.getJSON(`/api/tags.json`),
            admin.getJSON<Record<string, number | null>>(
                "/api/variables.latestByCatalogPath.json",
                {
                    catalogPaths: [
                        GDP_PER_CAPITA_CATALOG_PATH,
                        POPULATION_CATALOG_PATH,
                    ].join(","),
                }
            ),
        ])
        runInAction(() => {
            this.patchConfig = patchConfig
            this.parentConfig = parent?.config
            this.isInheritanceEnabled = parent?.isActive ?? true
            this.forceDatapage = settings?.forceDatapage ?? false
            this.logs = logs?.logs ?? []
            this.references = refs?.references
            this.redirects = redirects?.redirects ?? []
            this.views = views?.views
            this.tags = tags?.tags
            this.availableTags = availableTags?.tags
            this.variableIdsByCatalogPath = variableIdsByCatalogPath
            this.editor = new ChartEditor({ manager: this })
        })
    }
}

export class EmbeddedNarrativeChartEditorHost
    implements NarrativeChartEditorManager
{
    readonly embedded = true
    admin: Admin
    history: History
    narrativeChartId: number

    name: string | undefined = undefined
    nameError: string | undefined = undefined
    configId: string | undefined = undefined
    parentChartConfigId: string | undefined = undefined
    parentUrl: string | null = null
    references: References | undefined = undefined

    patchConfig: GrapherInterface = {}
    parentConfig: GrapherInterface = {}
    isInheritanceEnabled: boolean | undefined = true

    editor: NarrativeChartEditor | undefined = undefined

    constructor(admin: Admin, narrativeChartId: number, history: History) {
        makeObservable(this, {
            name: observable.ref,
            configId: observable.ref,
            parentUrl: observable.ref,
            references: observable,
            patchConfig: observable.ref,
            parentConfig: observable.ref,
            editor: observable.ref,
        })
        this.admin = admin
        this.narrativeChartId = narrativeChartId
        this.history = history
    }

    onNameChange(_value: string): void {
        // the name is not editable once the narrative chart is created
        return undefined
    }

    /** fetch the narrative chart's configs, then construct the editor */
    async init(): Promise<void> {
        const { admin, narrativeChartId } = this
        const [data, refs] = await Promise.all([
            admin.getJSON(
                `/api/narrative-charts/${narrativeChartId}.config.json`
            ),
            admin.getJSON(
                `/api/narrative-charts/${narrativeChartId}.references.json`
            ),
        ])
        runInAction(() => {
            this.name = data.name
            this.configId = data.chartConfigId
            this.patchConfig = data.configPatch
            this.parentConfig = data.parentConfigFull
            this.parentUrl = data.parentUrl
            this.references = refs?.references
            this.editor = new NarrativeChartEditor({ manager: this })
        })
    }
}

export type EmbeddedEditorHost =
    | EmbeddedChartEditorHost
    | EmbeddedNarrativeChartEditorHost
