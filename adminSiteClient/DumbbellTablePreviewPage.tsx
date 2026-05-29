import { Component } from "react"
import { RouteComponentProps } from "react-router-dom"
import { observable, action, makeObservable, runInAction } from "mobx"
import { observer } from "mobx-react"
import {
    Grapher,
    GrapherState,
    DumbbellChartState,
    DumbbellMode,
    fetchInputTableForConfig,
    loadCatalogData,
    mapGrapherTabNameToQueryParam,
    GRAPHER_THUMBNAIL_WIDTH,
    GRAPHER_THUMBNAIL_HEIGHT,
} from "@ourworldindata/grapher"
import {
    GRAPHER_TAB_NAMES,
    GrapherInterface,
    GrapherQueryParams,
    GrapherVariant,
    SearchChartHitDataTableProps,
} from "@ourworldindata/types"
import { Bounds, queryParamsToStr } from "@ourworldindata/utils"
import {
    BAKED_GRAPHER_URL,
    CATALOG_URL,
    DATA_API_URL,
} from "../settings/clientSettings.js"
import { constructSearchResultDataTableContent } from "../functions/_common/search/constructSearchResultDataTableContent.js"
import {
    constructSearchResultJson,
    getSortedGrapherTabsForChartHit,
    pickDisplayEntities,
    configureGrapherStateTab,
    RichDataVariant,
} from "../functions/_common/search/constructSearchResultJson.js"
import { SearchChartHitDataTable } from "../site/search/SearchChartHitDataTable.js"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"

// Local dumbbell charts to preview by default
// (life-expectancy has a Dumbbell tab; test-wdi is Dumbbell-only)
const DEFAULT_CHART_IDS = "64, 9115"

// Query param that holds the comma-separated chart IDs
const CHART_IDS_PARAM = "chartIds"

// Matches the medium-variant value in SearchChartHitRichData.tsx
const NUM_DATA_TABLE_ROWS_PER_COLUMN = 4

const THUMBNAIL_BOUNDS = new Bounds(
    0,
    0,
    GRAPHER_THUMBNAIL_WIDTH,
    GRAPHER_THUMBNAIL_HEIGHT
)

// One chart's loading state. We run the same pipeline search uses
// (`constructSearchResultJson`) to obtain the faithful query params, render the
// Dumbbell tab thumbnail locally (exactly the way the dynamic-thumbnail service
// would, via a static Grapher), and show the Dumbbell search data table next to
// it — all without re-indexing Algolia.
class DumbbellPreview {
    id: number
    slug?: string
    chartUrl?: string
    mode?: DumbbellMode
    dataTable?: SearchChartHitDataTableProps
    thumbnailState?: GrapherState
    minimalThumbnailState?: GrapherState
    error?: string

    constructor(id: number) {
        this.id = id
        makeObservable(this, {
            slug: observable,
            chartUrl: observable,
            mode: observable,
            dataTable: observable.ref,
            thumbnailState: observable.ref,
            minimalThumbnailState: observable.ref,
            error: observable,
        })
    }
}

@observer
export class DumbbellTablePreviewPage extends Component<RouteComponentProps> {
    static override contextType = AdminAppContext
    declare context: AdminAppContextType

    chartIdsInput = DEFAULT_CHART_IDS
    previews: DumbbellPreview[] = []

    constructor(props: RouteComponentProps) {
        super(props)
        // Initialize the input from the query param if present
        const paramValue = new URLSearchParams(props.location.search).get(
            CHART_IDS_PARAM
        )
        if (paramValue) this.chartIdsInput = paramValue
        makeObservable(this, {
            chartIdsInput: observable,
            previews: observable,
        })
    }

    override componentDidMount(): void {
        void this.loadAll()
    }

    // Reflect the current input in the URL so the view is shareable
    syncQueryParam(): void {
        const params = new URLSearchParams(this.props.location.search)
        params.set(CHART_IDS_PARAM, this.chartIdsInput)
        this.props.history.replace({ search: params.toString() })
    }

    @action.bound async loadAll(): Promise<void> {
        this.syncQueryParam()
        const ids = this.chartIdsInput
            .split(",")
            .map((part) => parseInt(part.trim(), 10))
            .filter((id) => !isNaN(id))

        this.previews = ids.map((id) => new DumbbellPreview(id))
        await Promise.all(this.previews.map((preview) => this.loadOne(preview)))
    }

    async loadOne(preview: DumbbellPreview): Promise<void> {
        try {
            const config = (await this.context.admin.getJSON(
                `/api/charts/${preview.id}.config.json`
            )) as GrapherInterface
            const slug = config.slug ?? ""

            const grapherState = new GrapherState({
                ...config,
                additionalDataLoaderFn: (catalogKey) =>
                    loadCatalogData(catalogKey, { baseUrl: CATALOG_URL }),
            })

            const inputTable = await fetchInputTableForConfig({
                dimensions: grapherState.dimensions,
                selectedEntityColors: grapherState.selectedEntityColors,
                dataApiUrl: DATA_API_URL,
            })
            if (inputTable) grapherState.inputTable = inputTable

            // Run the exact same pipeline search uses, so entity selection,
            // focus, time bounds and per-tab preview params all match search.
            const args = {
                variant: RichDataVariant.Medium,
                pickedEntities: [],
                numDataTableRowsPerColumn: NUM_DATA_TABLE_ROWS_PER_COLUMN,
                catalogUrl: CATALOG_URL,
            }
            const sortedTabs = getSortedGrapherTabsForChartHit(grapherState)
            configureGrapherStateTab(grapherState, { tab: sortedTabs[0] })
            const displayEntities = await pickDisplayEntities(
                grapherState,
                args
            )
            const searchResult = await constructSearchResultJson(grapherState, {
                ...args,
                sortedTabs,
                displayEntities,
            })

            // Build the Dumbbell tab query params search would use
            // (search query params + any preview params for the Dumbbell slot)
            const dumbbellSlot = searchResult?.layout.find(
                (slot) => slot.grapherTab === GRAPHER_TAB_NAMES.Dumbbell
            )
            const grapherParams: GrapherQueryParams = {
                ...(searchResult?.grapherQueryParams ?? {}),
                ...(dumbbellSlot?.previewParams ?? {}),
                tab: mapGrapherTabNameToQueryParam(GRAPHER_TAB_NAMES.Dumbbell),
            }

            // Link to the live chart showing the same view as the thumbnail
            const chartUrl = `${BAKED_GRAPHER_URL}/${slug}${queryParamsToStr(grapherParams)}`

            // Build a separate static GrapherState to render the thumbnail
            // locally, mirroring the dynamic-thumbnail service's options for
            // imType=thumbnail (see functions/_common/imageOptions.ts).
            const makeThumbnailState = (
                useMinimalLabeling: boolean
            ): GrapherState => {
                const state = new GrapherState({
                    ...config,
                    queryStr: queryParamsToStr(grapherParams),
                    bounds: THUMBNAIL_BOUNDS,
                    staticBounds: THUMBNAIL_BOUNDS,
                    baseFontSize: 14,
                    variant: GrapherVariant.Thumbnail,
                    additionalDataLoaderFn: (catalogKey) =>
                        loadCatalogData(catalogKey, { baseUrl: CATALOG_URL }),
                })
                if (inputTable) state.inputTable = inputTable
                state.isExportingToSvgOrPng = true
                // Mirrors imMinimal=1 → useMinimalLabeling in the dynamic
                // thumbnail service (see functions/_common/imageOptions.ts)
                state.useMinimalLabeling = useMinimalLabeling
                return state
            }

            const thumbnailState = makeThumbnailState(false)
            const minimalThumbnailState = makeThumbnailState(true)

            // Force the Dumbbell tab and build its search data table (using the
            // search-configured selection/focus from the pipeline above)
            configureGrapherStateTab(grapherState, {
                tab: GRAPHER_TAB_NAMES.Dumbbell,
            })
            const dataTable = constructSearchResultDataTableContent({
                grapherState,
            })

            runInAction(() => {
                preview.slug = slug
                preview.chartUrl = chartUrl
                preview.mode = (
                    grapherState.chartState as DumbbellChartState
                ).mode
                preview.thumbnailState = thumbnailState
                preview.minimalThumbnailState = minimalThumbnailState
                preview.dataTable = dataTable
            })
        } catch (error) {
            runInAction(() => {
                preview.error =
                    error instanceof Error ? error.message : String(error)
            })
        }
    }

    override render(): React.ReactElement {
        return (
            <AdminLayout title="Dumbbell table preview">
                <main className="DumbbellTablePreviewPage">
                    <p>
                        Renders the search data table (
                        <code>constructSearchResultDataTableContent</code>) next
                        to a locally-rendered Dumbbell thumbnail, using the same
                        pipeline as search (
                        <code>constructSearchResultJson</code>) so the view and
                        query params match exactly — no Algolia indexing or
                        thumbnail service required.
                    </p>
                    <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
                        <input
                            type="text"
                            className="form-control"
                            style={{ maxWidth: 320 }}
                            value={this.chartIdsInput}
                            placeholder="Comma-separated chart IDs"
                            onChange={action(
                                (e) =>
                                    (this.chartIdsInput = e.currentTarget.value)
                            )}
                        />
                        <button
                            className="btn btn-primary"
                            onClick={() => void this.loadAll()}
                        >
                            Render
                        </button>
                    </div>
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 24,
                        }}
                    >
                        {this.previews.map((preview) => (
                            <DumbbellPreviewCard
                                key={preview.id}
                                preview={preview}
                            />
                        ))}
                    </div>
                </main>
            </AdminLayout>
        )
    }
}

function ThumbnailBox({
    label,
    state,
}: {
    label: string
    state?: GrapherState
}): React.ReactElement {
    return (
        <div>
            <div style={{ color: "#787878", fontSize: 12, marginBottom: 4 }}>
                {label}
            </div>
            <div
                style={{
                    width: GRAPHER_THUMBNAIL_WIDTH,
                    height: GRAPHER_THUMBNAIL_HEIGHT,
                    border: "1px solid #ddd",
                    borderRadius: 4,
                    overflow: "hidden",
                }}
            >
                {state && <Grapher grapherState={state} />}
            </div>
        </div>
    )
}

const DumbbellPreviewCard = observer(function DumbbellPreviewCard({
    preview,
}: {
    preview: DumbbellPreview
}): React.ReactElement {
    const {
        id,
        slug,
        chartUrl,
        mode,
        dataTable,
        thumbnailState,
        minimalThumbnailState,
        error,
    } = preview

    let body: React.ReactElement
    let caption: string | undefined

    if (error) {
        body = <div style={{ color: "#cc3b55" }}>Error: {error}</div>
    } else if (!dataTable) {
        body = <div style={{ color: "#787878" }}>Loading…</div>
    } else {
        caption =
            mode === DumbbellMode.TwoColumn
                ? "Two-column mode (two columns compared)"
                : "Time-range mode (one column across two times)"

        body = (
            <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
                {/* Locally-rendered Dumbbell thumbnails (static Grapher):
                    the normal variant and the minimal variant search uses for
                    primary-tab previews (useMinimalLabeling, no top legend) */}
                <div
                    style={{
                        flex: `0 0 ${GRAPHER_THUMBNAIL_WIDTH}px`,
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                    }}
                >
                    <ThumbnailBox
                        label="Minimal (next to table)"
                        state={minimalThumbnailState}
                    />
                    <ThumbnailBox label="Normal" state={thumbnailState} />
                </div>

                {/* Search data table */}
                <div style={{ flex: "1 1 340px", minWidth: 320 }}>
                    <div
                        style={{
                            // Give the table grid room to lay out its rows
                            height: Math.max(160, dataTable.rows.length * 28),
                            border: "1px solid #ddd",
                            borderRadius: 4,
                            padding: 12,
                        }}
                    >
                        <SearchChartHitDataTable {...dataTable} />
                    </div>
                    <details style={{ marginTop: 12 }}>
                        <summary
                            style={{ cursor: "pointer", color: "#787878" }}
                        >
                            Raw JSON
                        </summary>
                        <pre style={{ fontSize: 11, whiteSpace: "pre-wrap" }}>
                            {JSON.stringify(dataTable, null, 2)}
                        </pre>
                    </details>
                </div>
            </div>
        )
    }

    return (
        <div
            style={{
                padding: 16,
                border: "1px solid #ddd",
                borderRadius: 4,
                background: "#fff",
            }}
        >
            <h4 style={{ marginTop: 0, marginBottom: 4 }}>
                {chartUrl ? (
                    <a href={chartUrl} target="_blank" rel="noreferrer">
                        {slug ?? `chart ${id}`}
                    </a>
                ) : (
                    (slug ?? `chart ${id}`)
                )}{" "}
                <span style={{ color: "#787878", fontWeight: 400 }}>
                    (#{id})
                </span>
            </h4>
            {caption && (
                <div
                    style={{
                        color: "#787878",
                        fontSize: 12,
                        marginBottom: 12,
                    }}
                >
                    {caption}
                </div>
            )}
            {body}
        </div>
    )
})
