/**
 * The admin's chart editor: `GrapherEditor` (the config-only editor) plus
 * everything a chart has because it is a row in our database — revision
 * logs, references, redirects, pageviews, tags, publishing, inheritance from
 * its indicator. The page owns all of that and plugs it in through the
 * editor's extension props; the editor itself never sees a chart id.
 */
import React from "react"
import { observer } from "mobx-react"
import { observable, computed, runInAction, action, makeObservable } from "mobx"
import { Redirect } from "react-router-dom"
import {
    getParentIndicatorIdFromChartConfig,
    mergeGrapherConfigs,
} from "@ourworldindata/utils"
import {
    type AnalyticsGrapherViewWithRank,
    GrapherInterface,
    ChartRedirect,
    MinimalTagWithMetadata,
    DbChartTagJoin,
} from "@ourworldindata/types"
import {
    BAKED_BASE_URL,
    BAKED_GRAPHER_URL,
} from "../settings/clientSettings.js"
import { Admin } from "./Admin.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { AdminLayout } from "./AdminLayout.js"
import { LoadingBlocker, Section, Toggle } from "./Forms.js"
import { GrapherEditor } from "./GrapherEditor.js"
import {
    ConfigEditor,
    EditorExtensions,
    EditorExtraTab,
} from "./ConfigEditor.js"
import { References } from "./AbstractChartEditor.js"
import { ChartSaveActions, ChartSaveButtons } from "./ChartSaveButtons.js"
import { EditorHistoryTab } from "./EditorHistoryTab.js"
import { EditorReferencesTabForChart } from "./EditorReferencesTab.js"
import { TagsSection } from "./EditorBasicTab.js"
import {
    deleteChart,
    fetchChartConfigByIndicatorId,
    getFullReferencesCount,
    Log,
} from "./adminChartApi.js"
import {
    adminDetailsProvider,
    adminIndicatorCatalog,
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

    // The config and the layers it sits on; the editor mounts once these are
    // in, so it never sees a half-loaded chart. The editor only knows one
    // "base config"; the two layers and the toggle are the admin's affair.
    isLoaded = false
    patchConfig: GrapherInterface = {}
    /** The grapher config of the chart's first y indicator, if it has one. */
    indicatorConfig: GrapherInterface | undefined = undefined
    indicatorId: number | undefined = undefined
    /** The chart's own ETL-authored layer; always applied. */
    etlConfig: GrapherInterface | undefined = undefined
    /** Whether `indicatorConfig` is applied. */
    isInheritanceEnabled = true

    // The chart record around the config.
    logs: Log[] = []
    references: References | undefined = undefined
    redirects: ChartRedirect[] = []
    views: AnalyticsGrapherViewWithRank | undefined = undefined
    tags: DbChartTagJoin[] | undefined = undefined
    availableTags: MinimalTagWithMetadata[] | undefined = undefined
    forceDatapage = false
    variableIdsByCatalogPath: Record<string, number | null> | undefined =
        undefined

    // Set when a new chart was created, so the page can move to its URL.
    newChartId: number | undefined = undefined

    @computed get admin(): Admin {
        return this.context.admin
    }

    @computed get isNewChart(): boolean {
        return this.props.grapherId === undefined
    }

    /** OWID's indicator store: the Data API for data, the admin for the
     *  picker's catalog and the population/GDP shortcuts. */
    @computed get store(): IndicatorStore {
        return dataApiIndicatorStore({
            dataApiUrl: defaultEditorEnvironment.dataApiUrl,
            catalog: adminIndicatorCatalog(this.admin),
            variableIdsByCatalogPath: this.variableIdsByCatalogPath,
        })
    }

    /** What the editor treats the patch as sitting on: the indicator's
     *  config if inheritance is on, with the ETL layer merged on top. */
    @computed get baseConfig(): GrapherInterface | undefined {
        const base = mergeGrapherConfigs(
            this.isInheritanceEnabled ? (this.indicatorConfig ?? {}) : {},
            this.etlConfig ?? {}
        )
        return Object.keys(base).length ? base : undefined
    }

    // --- Loading the chart record --------------------------------------------

    async fetchConfigAndLayers(): Promise<void> {
        const { grapherId, grapherConfig } = this.props
        if (grapherId !== undefined) {
            const [patch, parent, settings] = await Promise.all([
                this.admin.getJSON(`/api/charts/${grapherId}.patchConfig.json`),
                this.admin.getJSON(`/api/charts/${grapherId}.parent.json`),
                this.admin.getJSON(`/api/charts/${grapherId}.settings.json`),
            ])
            // The parent endpoint returns the two layers above the admin's
            // patch separately: the indicator's grapher_config and the
            // chart's own etlConfig. They are merged on the editor side.
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
        // The store is built with these, so they have to be in before mount.
        await this.fetchVariableIdsByCatalogPath()
        runInAction(() => (this.isLoaded = true))
    }

    /**
     * The chart's first y indicator changed (added, removed or swapped):
     * fetch the new indicator's config so the base the editor shows follows.
     */
    @action.bound onEditorChange(
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
                // ignore a late answer for an indicator that was swapped again
                if (this.indicatorId === newId) this.indicatorConfig = config
            })
        )
    }

    private async fetchChartJson<T>(
        suffix: string,
        pick: (json: any) => T,
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

    // --- Saving --------------------------------------------------------------

    /** What the save endpoints want to know besides the config. */
    private saveQuery(): URLSearchParams {
        // it only makes sense to enable inheritance if the chart has a parent
        const shouldEnableInheritance =
            !!this.indicatorId && this.isInheritanceEnabled
        return new URLSearchParams({
            inheritance: shouldEnableInheritance ? "enable" : "disable",
            forceDatapage: String(this.forceDatapage),
        })
    }

    /** PUT/POST the patch; returns the patch as the server stored it. */
    @action.bound async onSave(
        patch: GrapherInterface,
        editor: ConfigEditor
    ): Promise<GrapherInterface | void> {
        const { grapherState } = editor
        const isNew = grapherState.id === undefined

        // Chart title and slug may be autocalculated from data, in which case
        // they won't be in the patch, but the server needs to know what we
        // calculated in order to do its job. Only auto-generate the slug when
        // publishing: drafts may have empty slugs to avoid slug collisions.
        const body: GrapherInterface = {
            ...patch,
            title: patch.title || grapherState.effectiveTitle,
            ...(grapherState.isPublished && !patch.slug
                ? { slug: grapherState.displaySlug }
                : {}),
        }

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
                // Mark the editor saved *before* `newChartId` triggers the
                // redirect, or the unsaved-changes prompt fires on our own
                // navigation. The editor sets the same baseline again from
                // the return value below.
                editor.savedPatchConfig = editor.store.toEditorConfig(
                    json.savedPatch
                )
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
                // Start from what the source chart actually renders — the
                // whole parent stack plus the admin patch — and let the save
                // diff the inherited layers back out against the new chart's
                // own parent. Copying the patch alone would silently drop
                // everything an ETL-managed chart keeps in its ETL layer.
                const chartJson = { ...editor.fullConfig }
                delete chartJson.id
                delete chartJson.isPublished
                delete chartJson.slug

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
                        // Redirect to the charts index page after successful deletion
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
                            editor.activeParentConfigWithDefaults
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

    // --- What the admin adds to the generic editor ---------------------------

    @computed get extraTabs(): EditorExtraTab[] {
        const refsCount = this.references
            ? getFullReferencesCount(this.references)
            : undefined
        return [
            {
                key: "revisions",
                label: "Revisions",
                render: () => <EditorHistoryTab logs={this.logs} />,
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
        ]
    }

    @computed get extensions(): EditorExtensions {
        const referencedPosts = [
            ...(this.references?.postsWordpress ?? []),
            ...(this.references?.postsGdocs ?? []),
        ]
        return {
            basicTabFooter: (editor) => (
                <>
                    {this.indicatorId && (
                        <Section name="Inheritance">
                            <Toggle
                                label="Inherit settings from the indicator"
                                secondaryLabel="Only your changes are saved; the rest follows the indicator's own config."
                                value={this.isInheritanceEnabled}
                                onValue={action(
                                    (value: boolean) =>
                                        (this.isInheritanceEnabled = value)
                                )}
                            />
                            <small className="form-text text-muted">
                                Indicator:{" "}
                                <a
                                    href={`/admin/variables/${this.indicatorId}`}
                                    target="_blank"
                                    rel="noopener"
                                >
                                    {editor.grapherState.inputTable.get(
                                        String(this.indicatorId)
                                    )?.name ?? this.indicatorId}
                                </a>
                                {this.indicatorConfig
                                    ? ""
                                    : " (has no config of its own yet)"}
                            </small>
                        </Section>
                    )}
                    <TagsSection
                        chartId={editor.grapherState.id}
                        tags={this.tags}
                        availableTags={this.availableTags}
                        onSaveTags={this.saveTags}
                    />
                </>
            ),
            textTabFooter: () => (
                <Toggle
                    label="Force to be a data page"
                    secondaryLabel="Use metadata from the first Y indicator (same behavior as multi-dimensional data pages)."
                    value={this.forceDatapage}
                    onValue={action(
                        (value: boolean) => (this.forceDatapage = value)
                    )}
                />
            ),
            originUrlSuggestions: referencedPosts.map((post) => {
                const relativeUrl = post.url.replace(BAKED_BASE_URL, "")
                return {
                    value: relativeUrl,
                    label: relativeUrl,
                    suffix: "(referenced by this chart)",
                }
            }),
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
                        details={adminDetailsProvider(this.admin)}
                        baseConfig={this.baseConfig}
                        extraTabs={this.extraTabs}
                        extensions={this.extensions}
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
                        onChange={this.onEditorChange}
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
