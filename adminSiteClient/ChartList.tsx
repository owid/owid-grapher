import * as React from "react"
import { useDeferredValue } from "react"
import { observer } from "mobx-react"
import {
    runInAction,
    observable,
    computed,
    action,
    makeObservable,
    IComputedValue,
} from "mobx"
import * as lodash from "lodash-es"
import cx from "clsx"
import {
    bind,
    dayjs,
    DbChartTagJoin,
    TaggableType,
    copyToClipboard,
    excludeUndefined,
    getWindowUrl,
    setWindowUrl,
} from "@ourworldindata/utils"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import {
    GRAPHER_CHART_TYPES,
    GRAPHER_TAB_CONFIG_OPTIONS,
    GrapherChartType,
    GrapherInterface,
} from "@ourworldindata/types"
import {
    getTagGraphRolesById,
    MinimalTagWithMetadata,
} from "./TagGraphMetadata.js"
import { highlightFunctionForSearchWords } from "../adminShared/search.js"
import {
    chartSearchFilter,
    chartSearchWordsToHighlight,
    countNames,
    getFacetValues,
    setFacetValues,
} from "./chartSearchQuery.js"
import { ChartSearchToolbar } from "./ChartSearchToolbar.js"
import {
    Button,
    Dropdown,
    Table,
    TableColumnsType,
    Tooltip,
    message,
} from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCopy, faPen, faTrashCan } from "@fortawesome/free-solid-svg-icons"
import { Link } from "./Link.js"
import { EditableTags } from "./EditableTags.js"
import { ChartSourceBadge } from "./ChartSourceBadge.js"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
    GRAPHER_DYNAMIC_THUMBNAIL_URL,
} from "../settings/clientSettings.mjs"
import { deleteChart, References } from "./adminChartApi.js"
import { getChartListItemEtlSource } from "./etlChartSync.js"

// These properties are coming from OldChart.ts
export interface ChartListItem {
    // the first few entries mirror GrapherInterface, so take the types from there
    id: GrapherInterface["id"]
    configId: string
    title: GrapherInterface["title"]
    slug: GrapherInterface["slug"]
    internalNotes: GrapherInterface["internalNotes"]
    variantName: GrapherInterface["variantName"]
    isPublished: GrapherInterface["isPublished"]
    tab: GrapherInterface["tab"]
    hasMapTab: GrapherInterface["hasMapTab"]

    type?: GrapherChartType
    hasChartTab: boolean

    lastEditedAt: string
    lastEditedBy: string
    publishedAt: string
    publishedBy: string

    hasParentIndicator?: boolean
    isInheritanceEnabled?: boolean

    tags: DbChartTagJoin[]
    grapherViewsPerDay: number
    narrativeChartsCount: number
    referencesCount: number

    etlConfigCatalogPath: string | null
    isEtlManaged: boolean
    // The remaining etl* fields are null unless the chart is ETL-managed.
    // JSON array of the top-level fields the admin patch overrides
    etlOverriddenFields: string | null
    etlSlug: string | null
}

const DEFAULT_PAGE_SIZE = 50

type Highlighter = (
    text: string | null | undefined
) => string | React.ReactElement

function showChartType(chart: ChartListItem): string {
    const chartType = chart.type

    if (!chartType) return "Map"

    const displayType = GRAPHER_CHART_TYPES[chartType]
        ? lodash.startCase(GRAPHER_CHART_TYPES[chartType])
        : "Unknown"

    if (chart.tab === GRAPHER_TAB_CONFIG_OPTIONS.map) {
        if (chart.hasChartTab) return `Map + ${displayType}`
        else return "Map"
    } else {
        if (chart.hasMapTab) return `${displayType} + Map`
        else return displayType
    }
}

function compareTimes(a: string | undefined, b: string | undefined): number {
    return new Date(a ?? 0).getTime() - new Date(b ?? 0).getTime()
}

/**
 * Title with the draft flag, then id, ETL badge and type, notes and tags. The
 * slug isn't shown, to save room, but is there on hovering the title.
 * Drafts are greyed out, so the eye goes to the published charts first.
 */
function ChartCell({
    chart,
    highlight,
    tags,
}: {
    chart: ChartListItem
    highlight: Highlighter
    tags: React.ReactNode
}): React.ReactElement {
    const etlSource = getChartListItemEtlSource(chart)
    const title = highlight(chart.title ?? "")
    return (
        <div
            className={cx("chart-list__chart", {
                "chart-list__chart--draft": !chart.isPublished,
            })}
        >
            <div className="chart-list__title">
                {!chart.isPublished && (
                    <span className="chart-list__draft-label">Draft</span>
                )}
                {chart.isPublished ? (
                    <a
                        href={`${BAKED_GRAPHER_URL}/${chart.slug}`}
                        title={chart.slug}
                    >
                        {title}
                    </a>
                ) : (
                    <span title={chart.slug}>{title}</span>
                )}
                {chart.variantName && (
                    <span className="chart-list__variant">
                        {" "}
                        ({highlight(chart.variantName)})
                    </span>
                )}
            </div>
            <div className="chart-list__meta">
                <span>#{highlight(`${chart.id}`)}</span>
                {/* Admin is the default, so only ETL charts are flagged */}
                {etlSource && (
                    <span className="chart-list__source">
                        <ChartSourceBadge etl={etlSource} />
                    </span>
                )}
                <span className="chart-list__meta-separator">·</span>
                <span>{showChartType(chart)}</span>
            </div>
            {chart.internalNotes && (
                <div className="chart-list__notes">
                    {highlight(chart.internalNotes)}
                </div>
            )}
            <div className="chart-list__tags">{tags}</div>
        </div>
    )
}

/**
 * A published chart's thumbnail comes by slug, as on the public site. A draft
 * has no public slug, but every saved config is in R2 by its uuid, so its
 * thumbnail comes from there.
 */
function PreviewCell({ chart }: { chart: ChartListItem }): React.ReactElement {
    if (chart.isPublished)
        return (
            <a href={`${BAKED_GRAPHER_URL}/${chart.slug}`}>
                <img
                    src={`${GRAPHER_DYNAMIC_THUMBNAIL_URL}/${chart.slug}.png`}
                    height={600}
                    width={850}
                    loading="lazy"
                    className="chart-list__preview"
                />
            </a>
        )
    return (
        <Link to={`/charts/${chart.id}/edit`}>
            <img
                src={`${GRAPHER_DYNAMIC_THUMBNAIL_URL}/by-uuid/${chart.configId}.png`}
                height={600}
                width={850}
                loading="lazy"
                className="chart-list__preview chart-list__preview--draft"
            />
        </Link>
    )
}

/** "1 year ago" rather than dayjs's "a year ago", so the times line up as numbers */
function timeAgo(time: string): string {
    return dayjs(time)
        .fromNow()
        .replace(/^an? (minute|hour|day|month|year) ago$/, "1 $1 ago")
}

/**
 * "7 hours ago" over the author's name, with the exact time on hover. Clicking
 * the name lists only that person's charts, as on GitHub.
 */
function TimestampCell({
    time,
    by,
    highlight,
    onAuthorClick,
}: {
    time: string | undefined
    by: string | undefined
    highlight: Highlighter
    onAuthorClick: (author: string) => void
}): React.ReactElement {
    if (!time) return <span className="text-muted">—</span>
    return (
        <div className="chart-list__timestamp">
            <Tooltip title={dayjs(time).format("D MMM YYYY, HH:mm")}>
                <span className="chart-list__time">{timeAgo(time)}</span>
            </Tooltip>
            {by && (
                <div>
                    <button
                        type="button"
                        className="chart-list__author"
                        title={`Only charts by ${by}`}
                        onClick={() => onAuthorClick(by)}
                    >
                        {highlight(by)}
                    </button>
                </div>
            )}
        </div>
    )
}

function CountCell({ count }: { count: number | null }): React.ReactElement {
    if (!count) return <span className="text-muted">0</span>
    return <>{count.toLocaleString()}</>
}

/** Saving tags mutates `chart.tags`, so this cell observes it on its own */
@observer
class TagsCell extends React.Component<{
    chart: ChartListItem
    availableTags: MinimalTagWithMetadata[]
    tagGraphRolesById: ReturnType<typeof getTagGraphRolesById>
}> {
    static override contextType = AdminAppContext
    declare context: AdminAppContextType

    @bind async onSaveTags(tags: DbChartTagJoin[]): Promise<void> {
        const { chart } = this.props
        const json = await this.context.admin.requestJSON(
            `/api/charts/${chart.id}/setTags`,
            { tags },
            "POST"
        )
        if (json.success) runInAction(() => (chart.tags = tags))
    }

    override render() {
        const { chart, availableTags, tagGraphRolesById } = this.props
        return (
            <EditableTags
                tags={chart.tags}
                suggestions={availableTags}
                tagGraphRolesById={tagGraphRolesById}
                onSave={this.onSaveTags}
                hasKeyChartSupport
                hasSuggestionsSupport
                taggable={{ type: TaggableType.Charts, id: chart.id }}
                iconOnlyActions
            />
        )
    }
}

type CopyOptionKey = "admin-url" | "grapher-url"

function makeMarkdownLink(chart: ChartListItem, key: CopyOptionKey): string {
    switch (key) {
        case "admin-url":
            return `[${chart.title}](${ADMIN_BASE_URL}/admin/charts/${chart.id}/edit)`
        case "grapher-url":
            return `[${chart.title}](${BAKED_GRAPHER_URL}/${chart.slug})`
    }
}

async function copyMarkdownLink(
    chart: ChartListItem,
    key: CopyOptionKey
): Promise<void> {
    const ok = await copyToClipboard(makeMarkdownLink(chart, key))
    if (ok) void message.success("Copied Markdown link")
    else void message.error("Couldn't copy to the clipboard")
}

function ActionsCell({
    chart,
    onDelete,
}: {
    chart: ChartListItem
    onDelete: (chart: ChartListItem) => void
}): React.ReactElement {
    const copyOptions: { key: CopyOptionKey; label: string }[] =
        excludeUndefined([
            { key: "admin-url", label: "Admin URL" },
            chart.isPublished
                ? { key: "grapher-url", label: "Grapher URL" }
                : undefined,
        ])

    return (
        <div className="chart-list__actions">
            <Link to={`/charts/${chart.id}/edit`}>
                <Button
                    type="primary"
                    size="small"
                    block
                    icon={<FontAwesomeIcon icon={faPen} />}
                >
                    Edit
                </Button>
            </Link>
            {/* The rarer actions, as icons, so they don't crowd every row */}
            <div className="chart-list__secondary-actions">
                <Dropdown
                    trigger={["click"]}
                    menu={{
                        items: [
                            {
                                type: "group",
                                label: "Copy as Markdown link",
                                children: copyOptions,
                            },
                        ],
                        onClick: (e) => {
                            void copyMarkdownLink(chart, e.key as CopyOptionKey)
                        },
                    }}
                >
                    <Tooltip title="Copy link">
                        <Button
                            size="small"
                            aria-label="Copy link"
                            icon={<FontAwesomeIcon icon={faCopy} />}
                        />
                    </Tooltip>
                </Dropdown>
                <Tooltip title="Delete">
                    <Button
                        size="small"
                        danger
                        aria-label="Delete"
                        icon={<FontAwesomeIcon icon={faTrashCan} />}
                        onClick={() => onDelete(chart)}
                    />
                </Tooltip>
            </div>
        </div>
    )
}

function inheritanceStatus(chart: ChartListItem): string {
    if (
        chart.hasParentIndicator === undefined ||
        chart.isInheritanceEnabled === undefined
    )
        return ""
    // if the chart doesn't have a parent, inheritance doesn't apply
    if (!chart.hasParentIndicator) return "n/a"
    return chart.isInheritanceEnabled ? "enabled" : "disabled"
}

/** A header whose explanation shows on hovering its dotted-underlined text */
function HeaderWithHelp({
    title,
    help,
}: {
    title: string
    help: string
}): React.ReactElement {
    return (
        <Tooltip title={help}>
            <span className="chart-list__header-help">{title}</span>
        </Tooltip>
    )
}

function createColumns({
    highlight,
    availableTags,
    tagGraphRolesById,
    showInheritanceColumn,
    onDelete,
    onAuthorClick,
}: {
    highlight: Highlighter
    availableTags: MinimalTagWithMetadata[]
    tagGraphRolesById: ReturnType<typeof getTagGraphRolesById>
    showInheritanceColumn: boolean
    onDelete: (chart: ChartListItem) => void
    onAuthorClick: (author: string) => void
}): TableColumnsType<ChartListItem> {
    // Counts are most useful largest first
    const descendFirst: ("descend" | "ascend")[] = ["descend", "ascend"]

    return excludeUndefined([
        {
            key: "preview",
            width: 112,
            render: (_, chart) => <PreviewCell chart={chart} />,
        },
        {
            title: "Chart",
            key: "chart",
            render: (_, chart) => (
                <ChartCell
                    chart={chart}
                    highlight={highlight}
                    tags={
                        <TagsCell
                            chart={chart}
                            availableTags={availableTags}
                            tagGraphRolesById={tagGraphRolesById}
                        />
                    }
                />
            ),
        },
        // Next to the chart rather than at the far right: Edit is what most
        // visits to this list end in
        {
            key: "actions",
            width: 100,
            render: (_, chart) => (
                <ActionsCell chart={chart} onDelete={onDelete} />
            ),
        },
        showInheritanceColumn
            ? {
                  title: "Inheritance",
                  key: "inheritance",
                  width: 100,
                  render: (_, chart) => inheritanceStatus(chart),
              }
            : undefined,
        {
            title: "Last updated",
            key: "lastEditedAt",
            sorter: (a, b) => compareTimes(a.lastEditedAt, b.lastEditedAt),
            sortDirections: descendFirst,
            // the API lists charts most recently edited first
            defaultSortOrder: "descend",
            render: (_, chart) => (
                <TimestampCell
                    time={chart.lastEditedAt}
                    by={chart.lastEditedBy}
                    highlight={highlight}
                    onAuthorClick={onAuthorClick}
                />
            ),
        },
        {
            title: "Published",
            key: "publishedAt",
            sorter: (a, b) => compareTimes(a.publishedAt, b.publishedAt),
            sortDirections: descendFirst,
            render: (_, chart) => (
                <TimestampCell
                    time={chart.publishedAt}
                    by={chart.publishedBy}
                    highlight={highlight}
                    onAuthorClick={onAuthorClick}
                />
            ),
        },
        {
            title: (
                <HeaderWithHelp
                    title="Views/day"
                    help="Average daily views of the chart's grapher page over the last 365 days"
                />
            ),
            key: "grapherViewsPerDay",
            align: "right",
            sorter: (a, b) =>
                (a.grapherViewsPerDay ?? 0) - (b.grapherViewsPerDay ?? 0),
            sortDirections: descendFirst,
            render: (_, chart) => (
                <CountCell count={chart.grapherViewsPerDay} />
            ),
        },
        {
            title: "Narrative charts",
            key: "narrativeChartsCount",
            align: "right",
            sorter: (a, b) =>
                (a.narrativeChartsCount ?? 0) - (b.narrativeChartsCount ?? 0),
            sortDirections: descendFirst,
            render: (_, chart) => (
                <CountCell count={chart.narrativeChartsCount} />
            ),
        },
        {
            title: (
                <HeaderWithHelp
                    title="References"
                    help="Only considers published content. This number might differ from the chart editor count, which includes unpublished data insights."
                />
            ),
            key: "referencesCount",
            align: "right",
            sorter: (a, b) =>
                (a.referencesCount ?? 0) - (b.referencesCount ?? 0),
            sortDirections: descendFirst,
            render: (_, chart) => <CountCell count={chart.referencesCount} />,
        },
    ])
}

interface ChartListProps {
    charts: ChartListItem[]
    autofocusSearchInput?: boolean
    loading?: boolean
    onDelete?: (chart: ChartListItem) => void
}

@observer
export class ChartList extends React.Component<ChartListProps> {
    static override contextType = AdminAppContext
    declare context: AdminAppContextType

    searchInput: string = ""
    currentPage = 1
    pageSize = DEFAULT_PAGE_SIZE
    availableTags: MinimalTagWithMetadata[] | undefined = undefined

    constructor(props: ChartListProps) {
        super(props)

        makeObservable(this, {
            searchInput: observable,
            currentPage: observable,
            pageSize: observable,
            availableTags: observable,
        })
    }

    async fetchRefs(grapherId: number | undefined): Promise<References> {
        const { admin } = this.context
        const json =
            grapherId === undefined
                ? {}
                : await admin.getJSON(
                      `/api/charts/${grapherId}.references.json`
                  )
        return json.references
    }

    @bind async onDeleteChart(chart: ChartListItem) {
        const refs = await this.fetchRefs(chart.id)

        await deleteChart({
            admin: this.context.admin,
            chartId: chart.id,
            chartSlug: chart.slug,
            references: refs,
            onSuccess: () => {
                if (this.props.onDelete) this.props.onDelete(chart)
                else
                    runInAction(() =>
                        this.props.charts.splice(
                            this.props.charts.indexOf(chart),
                            1
                        )
                    )
            },
        })
    }

    @bind async getTags() {
        const json = await this.context.admin.getJSON("/api/tags.json")
        runInAction(() => (this.availableTags = json.tags))
    }

    getSearchInputFromUrl(): string {
        const params = new URLSearchParams(window.location.search)
        return params.get("chartSearch") || ""
    }

    // The search holds every filter too, so a filtered list can be shared.
    // Other query params, like a page's tab, are kept.
    setSearchInputInUrl(searchInput: string) {
        setWindowUrl(
            getWindowUrl().updateQueryParams({
                chartSearch: searchInput || undefined,
            })
        )
    }

    override componentDidMount() {
        runInAction(() => (this.searchInput = this.getSearchInputFromUrl()))
        void this.getTags()
    }

    @computed get tagCounts() {
        return countNames(this.props.charts, (chart) =>
            chart.tags.map((tag) => tag.name)
        )
    }

    @computed get authorCounts() {
        return countNames(this.props.charts, (chart) => [
            chart.lastEditedBy,
            chart.publishedBy,
        ])
    }

    @action.bound onSearchInput(input: string) {
        this.searchInput = input
        this.currentPage = 1
        this.setSearchInputInUrl(input)
    }

    /** Lists only this person's charts; clicking them again lifts the filter. */
    @action.bound onAuthorClick(author: string) {
        const current = getFacetValues(this.searchInput, "author")
        const isOnlyAuthor =
            current.length === 1 &&
            current[0].toLowerCase() === author.toLowerCase()
        this.onSearchInput(
            setFacetValues(
                this.searchInput,
                "author",
                isOnlyAuthor ? [] : [author]
            )
        )
    }

    @action.bound onPageChange(page: number, pageSize: number) {
        this.currentPage = page
        this.pageSize = pageSize
    }

    override render() {
        const { searchInput, availableTags } = this

        return (
            <div className="chart-list">
                <ChartSearchToolbar
                    query={searchInput}
                    onQueryChange={this.onSearchInput}
                    tags={this.tagCounts}
                    authors={this.authorCounts}
                    autoFocus={this.props.autofocusSearchInput}
                />
                <DeferredChartTable
                    query={searchInput}
                    charts={this.props.charts}
                    availableTags={availableTags}
                    loading={this.props.loading}
                    currentPage={this.currentPage}
                    pageSize={this.pageSize}
                    onPageChange={this.onPageChange}
                    onDelete={this.onDeleteChart}
                    onAuthorClick={this.onAuthorClick}
                />
            </div>
        )
    }
}

interface ChartTableProps {
    query: string
    charts: ChartListItem[]
    availableTags: MinimalTagWithMetadata[] | undefined
    loading?: boolean
    currentPage: number
    pageSize: number
    onPageChange: (page: number, pageSize: number) => void
    onDelete: (chart: ChartListItem) => void
    onAuthorClick: (author: string) => void
}

/**
 * The table, a step behind the search box. Rendering a page of rows takes far
 * longer than a keystroke, so the box shows each character at once, and the
 * table follows with the latest query, skipping the ones typed meanwhile.
 * `ChartTable` is an observer, so it is only rendered again once the deferred
 * query has changed.
 */
function DeferredChartTable(props: ChartTableProps): React.ReactElement {
    const query = useDeferredValue(props.query)
    return <ChartTable {...props} query={query} />
}

@observer
class ChartTable extends React.Component<ChartTableProps> {
    private filtered?: {
        query: string
        charts: ChartListItem[]
        result: IComputedValue<ChartListItem[]>
    }

    /**
     * The charts the query finds. Paging renders the table again without
     * filtering again; deleting a chart or editing its tags filters again.
     */
    private chartsFiltered(): ChartListItem[] {
        const { query, charts } = this.props
        if (this.filtered?.query !== query || this.filtered.charts !== charts)
            this.filtered = {
                query,
                charts,
                // always a fresh array, so the table notices when a chart is deleted
                result: computed(() =>
                    query.trim()
                        ? charts.filter(chartSearchFilter(query, charts))
                        : [...charts]
                ),
            }
        return this.filtered.result.get()
    }

    override render() {
        const { query, charts, availableTags } = this.props
        const chartsFiltered = this.chartsFiltered()

        // if the first chart has inheritance information, we assume all charts have it
        const showInheritanceColumn =
            charts[0]?.isInheritanceEnabled !== undefined

        const columns = createColumns({
            highlight: highlightFunctionForSearchWords(
                chartSearchWordsToHighlight(query)
            ),
            availableTags: availableTags ?? [],
            tagGraphRolesById: getTagGraphRolesById(availableTags ?? []),
            showInheritanceColumn,
            onDelete: this.props.onDelete,
            onAuthorClick: this.props.onAuthorClick,
        })

        return (
            <Table<ChartListItem>
                size="small"
                // sized to the content, so the chart column gets the room
                // the narrow ones don't need, however wide the page is.
                // Not sticky: a sticky header is a table of its own, which
                // falls out of line with content-sized columns
                tableLayout="auto"
                scroll={{ x: true }}
                rowKey="id"
                columns={columns}
                // tag cells need the tag graph roles, which come with the tags
                dataSource={availableTags ? chartsFiltered : []}
                loading={this.props.loading || !availableTags}
                pagination={{
                    current: this.props.currentPage,
                    pageSize: this.props.pageSize,
                    onChange: this.props.onPageChange,
                    showSizeChanger: true,
                    pageSizeOptions: [25, 50, 100, 200],
                    // above the table too, so how many charts the search
                    // finds is in view while typing
                    placement: ["topStart", "bottomEnd"],
                    showTotal: (total, [from, to]) =>
                        `${from}–${to} of ${total.toLocaleString()} ${total === 1 ? "chart" : "charts"}` +
                        (query.trim()
                            ? ` (${charts.length.toLocaleString()} total)`
                            : ""),
                }}
            />
        )
    }
}
