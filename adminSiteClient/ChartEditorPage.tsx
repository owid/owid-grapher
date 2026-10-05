import React from "react"
import * as _ from "lodash-es"
import { observer } from "mobx-react"
import { observable, computed, runInAction, action, makeObservable } from "mobx"
import { Redirect } from "react-router-dom"
import {
    getParentIndicatorIdFromChartConfig,
    Json,
    mergeGrapherConfigs,
} from "@ourworldindata/utils"
import {
    type AnalyticsGrapherViewWithRank,
    GrapherInterface,
    ChartRedirect,
    MinimalTagWithMetadata,
    DbChartTagJoin,
} from "@ourworldindata/types"
import { GrapherState } from "@ourworldindata/grapher"
import { BAKED_GRAPHER_URL } from "../settings/clientSettings.mjs"
import { Admin } from "./Admin.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { AdminLayout } from "./AdminLayout.js"
import { LoadingBlocker, Timeago } from "./Forms.js"
import { GrapherEditor } from "./GrapherEditor.js"
import { ConfigEditor, EditorExtraTab, EditorNoteSlot } from "./ConfigEditor.js"
import { ChartSaveActions, ChartSaveButtons } from "./ChartSaveButtons.js"
import { EditorHistoryTab } from "./EditorHistoryTab.js"
import { EditorReferencesTabForChart } from "./EditorReferencesTab.js"
import { EditorPublishingTab } from "./EditorPublishingTab.js"
import {
    adminOriginUrlSuggestions,
    deleteChart,
    fetchChartConfigByIndicatorId,
    findLastMapColorScaleEdit,
    getFullReferencesCount,
    Log,
    References,
} from "./adminChartApi.js"
import {
    adminDetailsProvider,
    adminIndicatorCatalog,
    adminScatterDefaults,
    defaultEditorEnvironment,
} from "./editorProviders.js"
import { dataApiIndicatorStore, IndicatorStore } from "./indicatorStores.js"
import { makeNarrativeChartPatchConfig } from "./narrativeChartConfig.js"
import {
    GDP_PER_CAPITA_CATALOG_PATH,
    POPULATION_CATALOG_PATH,
} from "./constants.js"

interface ChartEditorPageProps {
    grapherId?: number
    grapherConfig?: GrapherInterface
}

@observer
export class ChartEditorPage extends React.Component<ChartEditorPageProps> {
    static override contextType = AdminAppContext
    declare context: AdminAppContextType

    constructor(props: ChartEditorPageProps) {
        super(props)

        makeObservable(this, {
            isLoaded: observable,
            patchConfig: observable.ref,
            indicatorConfig: observable.ref,
            indicatorId: observable.ref,
            etlConfig: observable.ref,
            isInheritanceEnabled: observable.ref,
            logs: observable,
            references: observable,
            redirects: observable,
            views: observable,
            tags: observable,
            availableTags: observable,
            forceDatapage: observable.ref,
            variableIdsByCatalogPath: observable.ref,
            newChartId: observable.ref,
        })
    }

    isLoaded = false
    patchConfig: GrapherInterface = {}
    indicatorConfig: GrapherInterface | undefined = undefined
    indicatorId: number | undefined = undefined
    etlConfig: GrapherInterface | undefined = undefined
    isInheritanceEnabled = true

    logs: Log[] = []
    references: References | undefined = undefined
    redirects: ChartRedirect[] = []
    views: AnalyticsGrapherViewWithRank | undefined = undefined
    tags: DbChartTagJoin[] | undefined = undefined
    availableTags: MinimalTagWithMetadata[] | undefined = undefined
    forceDatapage = false
    variableIdsByCatalogPath: Record<string, number | null> | undefined =
        undefined

    newChartId: number | undefined = undefined

    @computed get admin(): Admin {
        return this.context.admin
    }

    @computed get isNewChart(): boolean {
        return this.props.grapherId === undefined
    }

    @computed get store(): IndicatorStore {
        return dataApiIndicatorStore({
            dataApiUrl: defaultEditorEnvironment.dataApiUrl,
            catalog: adminIndicatorCatalog(this.admin),
        })
    }

    @computed get baseConfig(): GrapherInterface | undefined {
        return this.makeBaseConfig(this.indicatorConfig)
    }

    private makeBaseConfig(
        indicatorConfig: GrapherInterface | undefined
    ): GrapherInterface | undefined {
        const base = mergeGrapherConfigs(
            this.isInheritanceEnabled ? (indicatorConfig ?? {}) : {},
            this.etlConfig ?? {}
        )
        return Object.keys(base).length ? base : undefined
    }

    async fetchConfigAndLayers(): Promise<void> {
        const { grapherId, grapherConfig } = this.props
        if (grapherId !== undefined) {
            const [patch, parent, settings] = await Promise.all([
                this.admin.getJSON(`/api/charts/${grapherId}.patchConfig.json`),
                this.admin.getJSON(`/api/charts/${grapherId}.parent.json`),
                this.admin.getJSON(`/api/charts/${grapherId}.settings.json`),
            ])
            runInAction(() => {
                this.patchConfig = patch
                this.indicatorConfig = parent?.variableConfig
                this.indicatorId = parent?.variableId
                this.etlConfig = parent?.etlConfig
                this.isInheritanceEnabled = parent?.isInheritanceEnabled ?? true
                this.forceDatapage = settings?.forceDatapage ?? false
            })
        } else if (grapherConfig) {
            const parentIndicatorId =
                getParentIndicatorIdFromChartConfig(grapherConfig)
            const parentConfig = parentIndicatorId
                ? await fetchChartConfigByIndicatorId(
                      this.admin,
                      parentIndicatorId
                  )
                : undefined
            runInAction(() => {
                this.patchConfig = grapherConfig
                this.indicatorConfig = parentConfig
                this.indicatorId = parentIndicatorId
            })
        }
        await this.fetchVariableIdsByCatalogPath().catch(() => undefined)
        runInAction(() => (this.isLoaded = true))
    }

    @action.bound syncIndicatorConfig(
        _config: GrapherInterface,
        editor: ConfigEditor
    ): void {
        const newId = getParentIndicatorIdFromChartConfig(editor.liveConfig)
        if (newId === this.indicatorId) return
        this.indicatorId = newId
        this.indicatorConfig = undefined
        if (!newId) return
        void fetchChartConfigByIndicatorId(this.admin, newId).then((config) =>
            runInAction(() => {
                if (this.indicatorId === newId) this.indicatorConfig = config
            })
        )
    }

    @action.bound async loadPatchConfig(
        editor: ConfigEditor,
        patchConfig: GrapherInterface
    ): Promise<void> {
        const indicatorId = getParentIndicatorIdFromChartConfig(
            mergeGrapherConfigs(this.etlConfig ?? {}, patchConfig)
        )
        const indicatorConfig =
            indicatorId === this.indicatorId
                ? this.indicatorConfig
                : indicatorId
                  ? await fetchChartConfigByIndicatorId(this.admin, indicatorId)
                  : undefined
        const baseConfig = this.makeBaseConfig(indicatorConfig)
        runInAction(() => {
            this.indicatorId = indicatorId
            this.indicatorConfig = indicatorConfig
        })
        await editor.loadPatchConfig(patchConfig, baseConfig)
    }

    private async fetchChartJson<T>(
        suffix: string,
        pick: (json: Json) => T,
        apply: (value: T) => void
    ): Promise<void> {
        const { grapherId } = this.props
        if (grapherId === undefined) return
        const json = await this.admin.getJSON(
            `/api/charts/${grapherId}${suffix}`
        )
        runInAction(() => apply(pick(json)))
    }

    fetchLogs(): Promise<void> {
        return this.fetchChartJson(
            ".logs.json",
            (json) => json.logs as Log[],
            (logs) => (this.logs = logs)
        )
    }

    fetchRefs(): Promise<void> {
        return this.fetchChartJson(
            ".references.json",
            (json) => json.references as References,
            (references) => (this.references = references)
        )
    }

    fetchRedirects(): Promise<void> {
        return this.fetchChartJson(
            ".redirects.json",
            (json) => json.redirects as ChartRedirect[],
            (redirects) => (this.redirects = redirects)
        )
    }

    fetchViews(): Promise<void> {
        return this.fetchChartJson(
            ".views.json",
            (json) => json.views as AnalyticsGrapherViewWithRank,
            (views) => (this.views = views)
        )
    }

    fetchTags(): Promise<void> {
        return this.fetchChartJson(
            ".tags.json",
            (json) => json.tags as DbChartTagJoin[],
            (tags) => (this.tags = tags)
        )
    }

    async fetchAvailableTags(): Promise<void> {
        const json = (await this.admin.getJSON("/api/tags.json")) as any
        runInAction(() => (this.availableTags = json.tags))
    }

    async fetchVariableIdsByCatalogPath(): Promise<void> {
        const json = await this.admin.getJSON<Record<string, number | null>>(
            "/api/variables.latestByCatalogPath.json",
            {
                catalogPaths: [
                    GDP_PER_CAPITA_CATALOG_PATH,
                    POPULATION_CATALOG_PATH,
                ].join(","),
            }
        )
        runInAction(() => (this.variableIdsByCatalogPath = json))
    }

    @action.bound refresh(): void {
        void this.fetchConfigAndLayers()
        void this.fetchLogs()
        void this.fetchRefs()
        void this.fetchRedirects()
        void this.fetchViews()
        void this.fetchTags()
        void this.fetchAvailableTags()
    }

    override componentDidMount(): void {
        this.refresh()
    }

    override componentDidUpdate(
        prevProps: Readonly<ChartEditorPageProps>
    ): void {
        if (prevProps.grapherId !== this.props.grapherId) {
            void this.fetchTags()
        }
    }

    private saveQuery(): URLSearchParams {
        const shouldEnableInheritance =
            !!this.indicatorId && this.isInheritanceEnabled
        return new URLSearchParams({
            inheritance: shouldEnableInheritance ? "enable" : "disable",
            forceDatapage: String(this.forceDatapage),
        })
    }

    @action.bound async onSave(
        patch: GrapherInterface,
        editor: ConfigEditor
    ): Promise<GrapherInterface | void> {
        const { grapherState } = editor
        const isNew = grapherState.id === undefined

        const body = withDerivedTitleAndSlug(patch, grapherState)

        const query = this.saveQuery()
        const shouldEnableInheritance = query.get("inheritance") === "enable"
        const json = await this.admin.requestJSON(
            isNew
                ? `/api/charts?${query}`
                : `/api/charts/${grapherState.id}?${query}`,
            body,
            isNew ? "POST" : "PUT"
        )
        if (!json.success) throw new Error(json.errorMsg ?? "Saving failed")

        runInAction(() => {
            this.isInheritanceEnabled = shouldEnableInheritance
            if (isNew) {
                grapherState.id = json.chartId
                editor.markAsSaved(patch)
                this.newChartId = json.chartId
            } else {
                grapherState.version += 1
                this.logs.unshift(json.newLog)
            }
        })
        return json.savedPatch
    }

    private saveActions(editor: ConfigEditor): ChartSaveActions {
        return {
            saveAsNew: async () => {
                const chartJson = configForDuplicate(editor.fullConfig)

                // Need to open intermediary tab before AJAX to avoid popup blockers
                const w = window.open("/", "_blank") as Window

                const json = await this.admin.requestJSON(
                    `/api/charts?${this.saveQuery()}`,
                    chartJson,
                    "POST"
                )
                if (json.success)
                    w.location.assign(
                        this.admin.url(`charts/${json.chartId}/edit`)
                    )
            },

            togglePublished: () => {
                const { grapherState } = editor
                if (grapherState.isPublished) {
                    const message =
                        this.references &&
                        getFullReferencesCount(this.references) > 0
                            ? "WARNING: This chart might be referenced from public posts, please double check before unpublishing. Try to remove the chart anyway?"
                            : "Are you sure you want to unpublish this chart?"
                    if (!window.confirm(message)) return
                    runInAction(() => (grapherState.isPublished = undefined))
                    void editor.saveGrapher({
                        onError: action(
                            () => (grapherState.isPublished = true)
                        ),
                    })
                } else {
                    const url = `${BAKED_GRAPHER_URL}/${grapherState.displaySlug}`
                    if (!window.confirm(`Publish chart at ${url}?`)) return
                    runInAction(() => (grapherState.isPublished = true))
                    void editor.saveGrapher({
                        onError: action(
                            () => (grapherState.isPublished = undefined)
                        ),
                    })
                }
            },

            delete: () =>
                deleteChart({
                    admin: this.admin,
                    chartId: editor.grapherState.id,
                    chartSlug: editor.grapherState.slug,
                    references: this.references,
                    onSuccess: () => {
                        window.location.href = "/admin/charts"
                    },
                }),

            saveAsNarrativeChart: async (name: string) => {
                const json = await this.admin.requestJSON(
                    "/api/narrative-charts",
                    {
                        type: "chart",
                        name,
                        parentChartId: editor.grapherState.id,
                        config: makeNarrativeChartPatchConfig(
                            editor.liveConfigWithDefaults,
                            editor.baseConfigWithDefaults
                        ),
                    },
                    "POST"
                )
                if (json.success) {
                    window.open(
                        this.admin.url(
                            `narrative-charts/${json.narrativeChartId}/edit`
                        )
                    )
                    return { success: true }
                }
                return { success: false, errorMsg: json.errorMsg }
            },
        }
    }

    @action.bound async saveTags(tags: DbChartTagJoin[]): Promise<void> {
        await this.admin.requestJSON(
            `/api/charts/${this.props.grapherId}/setTags`,
            { tags },
            "POST"
        )
        runInAction(() => (this.tags = tags))
    }

    @computed get extraTabs(): EditorExtraTab[] {
        const refsCount = this.references
            ? getFullReferencesCount(this.references)
            : undefined
        return [
            {
                key: "revisions",
                label: "Revisions",
                render: (editor) => (
                    <EditorHistoryTab
                        logs={this.logs}
                        editor={editor}
                        loadPatchConfig={(patchConfig) =>
                            this.loadPatchConfig(editor, patchConfig)
                        }
                    />
                ),
            },
            {
                key: "refs",
                label: refsCount !== undefined ? `Refs (${refsCount})` : "Refs",
                render: (editor) => (
                    <EditorReferencesTabForChart
                        editor={editor}
                        references={this.references}
                        redirects={this.redirects}
                        views={this.views}
                        onRedirectAdded={action((redirect: ChartRedirect) =>
                            this.redirects.push(redirect)
                        )}
                    />
                ),
            },
            {
                key: "publishing",
                label: "Publishing",
                render: (editor) => (
                    <EditorPublishingTab
                        editor={editor}
                        indicatorId={this.indicatorId}
                        indicatorConfig={this.indicatorConfig}
                        isInheritanceEnabled={this.isInheritanceEnabled}
                        onInheritanceChange={action(
                            (isEnabled: boolean) =>
                                (this.isInheritanceEnabled = isEnabled)
                        )}
                        tags={this.tags}
                        availableTags={this.availableTags}
                        onSaveTags={this.saveTags}
                        forceDatapage={this.forceDatapage}
                        onForceDatapageChange={action(
                            (forceDatapage: boolean) =>
                                (this.forceDatapage = forceDatapage)
                        )}
                    />
                ),
            },
        ]
    }

    private renderNote(slot: EditorNoteSlot): React.ReactNode {
        switch (slot) {
            case "map.colorScale": {
                const edit = findLastMapColorScaleEdit(this.logs)
                if (!edit) return undefined
                return (
                    <>
                        Last edited{" "}
                        <Timeago time={edit.createdAt} by={edit.userName} />
                    </>
                )
            }
        }
    }

    override render(): React.ReactElement {
        return (
            <AdminLayout noSidebar>
                {this.newChartId && (
                    <Redirect to={`/charts/${this.newChartId}/edit`} />
                )}
                {this.isLoaded ? (
                    <GrapherEditor
                        key={this.props.grapherId ?? "new"}
                        config={this.patchConfig}
                        store={this.store}
                        scatterDefaults={adminScatterDefaults(
                            this.variableIdsByCatalogPath
                        )}
                        details={adminDetailsProvider(this.admin)}
                        baseConfig={this.baseConfig}
                        previewUrl={
                            this.props.grapherId !== undefined
                                ? `/admin/charts/${this.props.grapherId}/preview${this.forceDatapage ? "?forceDatapage=true" : ""}`
                                : undefined
                        }
                        extraTabs={this.extraTabs}
                        renderNote={(slot) => this.renderNote(slot)}
                        originUrlSuggestions={() =>
                            adminOriginUrlSuggestions(
                                this.admin,
                                this.references
                            )
                        }
                        renderSaveButtons={(editor, editingErrors) => (
                            <ChartSaveButtons
                                editor={editor}
                                editingErrors={editingErrors}
                                isNewChart={
                                    editor.grapherState.id === undefined
                                }
                                actions={this.saveActions(editor)}
                            />
                        )}
                        onChange={this.syncIndicatorConfig}
                        onSave={this.onSave}
                    />
                ) : (
                    <main className="ChartEditorPage">
                        <LoadingBlocker isLoading />
                    </main>
                )}
            </AdminLayout>
        )
    }
}

/** The patch plus the title and slug grapher derives, which the server requires */
function withDerivedTitleAndSlug(
    patch: GrapherInterface,
    grapherState: GrapherState
): GrapherInterface {
    return {
        ...patch,
        title: patch.title || grapherState.effectiveTitle,
        ...(grapherState.isPublished && !patch.slug
            ? { slug: grapherState.displaySlug }
            : {}),
    }
}

/**
 * The config of an unpublished copy. Takes the full config because the copy
 * has no ETL layer to inherit from; the server diffs the indicator layer out.
 */
function configForDuplicate(fullConfig: GrapherInterface): GrapherInterface {
    return _.omit(fullConfig, ["id", "isPublished", "slug"])
}
