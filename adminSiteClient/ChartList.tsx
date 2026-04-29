/* eslint-disable react-refresh/only-export-components */
import * as _ from "lodash-es"
import * as React from "react"
import { observer } from "mobx-react"
import { runInAction, observable, computed, action, makeObservable } from "mobx"
import {
    bind,
    DbChartTagJoin,
    sortNumeric,
    queryParamsToStr,
} from "@ourworldindata/utils"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import {
    GrapherChartType,
    GrapherInterface,
    GRAPHER_CHART_TYPES,
    GRAPHER_TAB_CONFIG_OPTIONS,
    SortOrder,
} from "@ourworldindata/types"
import { ChartRow } from "./ChartRow.js"
import { References } from "./AbstractChartEditor.js"
import {
    SearchWord,
    buildSearchWordsFromSearchString,
    filterFunctionForSearchWords,
    highlightFunctionForSearchWords,
} from "../adminShared/search.js"
import { TextField } from "./Forms.js"
import {
    Badge,
    Button,
    DatePicker,
    InputNumber,
    Popover,
    Select,
    Tooltip,
} from "antd"
import dayjs, { Dayjs } from "dayjs"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faFilter, faInfoCircle } from "@fortawesome/free-solid-svg-icons"
import { deleteChart } from "./ChartEditor.js"

const MAP_FILTER_VALUE = "__map__"
type ChartTypeFilterValue = GrapherChartType | typeof MAP_FILTER_VALUE
type DateRange = [Dayjs | null, Dayjs | null] | null

// These properties are coming from OldChart.ts
export interface ChartListItem {
    // the first few entries mirror GrapherInterface, so take the types from there
    id: GrapherInterface["id"]
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
}

export type SortField =
    | "id"
    | "type"
    | "isPublished"
    | "lastEditedAt"
    | "publishedAt"
    | "grapherViewsPerDay"
    | "narrativeChartsCount"
    | "referencesCount"

export type SortConfig = {
    field: SortField
    direction: "asc" | "desc"
} | null

export type PublishedFilter = "all" | "published" | "drafts"

interface ChartListProps {
    charts: ChartListItem[]
    autofocusSearchInput?: boolean
    onDelete?: (chart: ChartListItem) => void
}

@observer
export class ChartList extends React.Component<ChartListProps> {
    static override contextType = AdminAppContext
    declare context: AdminAppContextType

    searchInput: string | undefined = undefined
    maxVisibleCharts = 50
    sortConfig: SortConfig | undefined = undefined
    availableTags: DbChartTagJoin[] = []
    publishedFilter: PublishedFilter = "all"
    chartTypes: ChartTypeFilterValue[] = []
    publishedDateRange: DateRange = null
    lastEditedDateRange: DateRange = null
    referencesMin: number | null = null
    referencesMax: number | null = null
    narrativeChartsMin: number | null = null
    narrativeChartsMax: number | null = null

    constructor(props: ChartListProps) {
        super(props)

        makeObservable(this, {
            searchInput: observable,
            maxVisibleCharts: observable,
            sortConfig: observable,
            availableTags: observable,
            publishedFilter: observable,
            chartTypes: observable,
            publishedDateRange: observable,
            lastEditedDateRange: observable,
            referencesMin: observable,
            referencesMax: observable,
            narrativeChartsMin: observable,
            narrativeChartsMax: observable,
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

    setSearchInputInUrl(searchInput: string) {
        const params = queryParamsToStr({
            chartSearch: searchInput || undefined,
        })
        const pathname = window.location.pathname
        const newUrl = `${pathname}${params}`
        window.history.replaceState({}, "", newUrl)
    }

    override componentDidMount() {
        this.searchInput = this.getSearchInputFromUrl()
        void this.getTags()
    }

    @action.bound onSort(sortConfig: SortConfig) {
        this.sortConfig = sortConfig
    }

    @computed get searchWords(): SearchWord[] {
        const { searchInput } = this
        return buildSearchWordsFromSearchString(searchInput)
    }

    @computed get numTotalCharts() {
        return this.chartsFiltered.length
    }

    @computed get chartsFiltered(): ChartListItem[] {
        const {
            searchWords,
            publishedFilter,
            chartTypes,
            publishedDateRange,
            lastEditedDateRange,
            referencesMin,
            referencesMax,
            narrativeChartsMin,
            narrativeChartsMax,
        } = this
        let result = this.props.charts

        if (publishedFilter === "published") {
            result = result.filter((chart) => !!chart.isPublished)
        } else if (publishedFilter === "drafts") {
            result = result.filter((chart) => !chart.isPublished)
        }

        if (chartTypes.length > 0) {
            result = result.filter((chart) =>
                chartTypes.some((selected) => {
                    if (selected === MAP_FILTER_VALUE)
                        return !!chart.hasMapTab || !chart.type
                    return chart.type === selected
                })
            )
        }

        result = filterByDateRange(
            result,
            (chart) => chart.publishedAt,
            publishedDateRange
        )
        result = filterByDateRange(
            result,
            (chart) => chart.lastEditedAt,
            lastEditedDateRange
        )

        if (referencesMin !== null)
            result = result.filter(
                (chart) => (chart.referencesCount ?? 0) >= referencesMin
            )
        if (referencesMax !== null)
            result = result.filter(
                (chart) => (chart.referencesCount ?? 0) <= referencesMax
            )
        if (narrativeChartsMin !== null)
            result = result.filter(
                (chart) =>
                    (chart.narrativeChartsCount ?? 0) >= narrativeChartsMin
            )
        if (narrativeChartsMax !== null)
            result = result.filter(
                (chart) =>
                    (chart.narrativeChartsCount ?? 0) <= narrativeChartsMax
            )

        if (searchWords.length > 0) {
            const filterFn = filterFunctionForSearchWords(
                searchWords,
                (chart: ChartListItem) => [
                    chart.title,
                    chart.variantName,
                    chart.internalNotes,
                    chart.publishedBy,
                    chart.lastEditedBy,
                    `${chart.id}`,
                    chart.slug,
                    chart.hasChartTab !== false ? chart.type : undefined,
                    chart.hasMapTab ? "Map" : undefined,
                    ...chart.tags.map((tag) => tag.name),
                ]
            )
            result = result.filter(filterFn)
        }

        return result
    }

    @computed get advancedFilterCount(): number {
        let count = 0
        if (
            this.publishedDateRange &&
            (this.publishedDateRange[0] || this.publishedDateRange[1])
        )
            count++
        if (
            this.lastEditedDateRange &&
            (this.lastEditedDateRange[0] || this.lastEditedDateRange[1])
        )
            count++
        if (this.referencesMin !== null || this.referencesMax !== null) count++
        if (
            this.narrativeChartsMin !== null ||
            this.narrativeChartsMax !== null
        )
            count++
        return count
    }

    @computed get chartsSorted(): ChartListItem[] {
        const { chartsFiltered } = this
        if (!this.sortConfig) return chartsFiltered

        const { direction, field } = this.sortConfig

        const numericFields: SortField[] = [
            "id",
            "grapherViewsPerDay",
            "narrativeChartsCount",
            "referencesCount",
        ]
        if (numericFields.includes(field)) {
            const getValue = (chart: ChartListItem) =>
                (chart[field as keyof ChartListItem] as number | undefined) ?? 0
            return sortNumeric(
                [...chartsFiltered],
                getValue,
                direction === "asc" ? SortOrder.asc : SortOrder.desc
            )
        }

        if (field === "type") {
            return _.orderBy(
                chartsFiltered,
                [(chart) => showChartType(chart).toLowerCase()],
                [direction]
            )
        }

        if (field === "isPublished") {
            return _.orderBy(
                chartsFiltered,
                [(chart) => !!chart.isPublished],
                [direction]
            )
        }

        // Date fields stored as ISO strings sort lexicographically.
        return _.orderBy(
            chartsFiltered,
            [(chart) => chart[field] || ""],
            [direction]
        )
    }

    @computed get chartsToShow(): ChartListItem[] {
        return this.chartsSorted.slice(0, this.maxVisibleCharts)
    }

    @action.bound onSearchInput(input: string) {
        this.searchInput = input
        this.setSearchInputInUrl(input)
    }

    @action.bound onPublishedFilterChange(filter: PublishedFilter) {
        this.publishedFilter = filter
    }

    @action.bound onChartTypesChange(types: ChartTypeFilterValue[]) {
        this.chartTypes = types
    }

    @action.bound onPublishedDateRangeChange(range: DateRange) {
        this.publishedDateRange = range
    }

    @action.bound onLastEditedDateRangeChange(range: DateRange) {
        this.lastEditedDateRange = range
    }

    @action.bound onReferencesMinChange(value: number | null) {
        this.referencesMin = value
    }

    @action.bound onReferencesMaxChange(value: number | null) {
        this.referencesMax = value
    }

    @action.bound onNarrativeChartsMinChange(value: number | null) {
        this.narrativeChartsMin = value
    }

    @action.bound onNarrativeChartsMaxChange(value: number | null) {
        this.narrativeChartsMax = value
    }

    @action.bound onClearAdvancedFilters() {
        this.publishedDateRange = null
        this.lastEditedDateRange = null
        this.referencesMin = null
        this.referencesMax = null
        this.narrativeChartsMin = null
        this.narrativeChartsMax = null
    }

    @action.bound onShowMore() {
        this.maxVisibleCharts += 100
    }

    override render() {
        const {
            sortConfig,
            onSort,
            chartsToShow,
            numTotalCharts,
            searchInput,
            publishedFilter,
            chartTypes,
            publishedDateRange,
            lastEditedDateRange,
            referencesMin,
            referencesMax,
            narrativeChartsMin,
            narrativeChartsMax,
            advancedFilterCount,
        } = this
        const { availableTags } = this

        const chartTypeOptions: {
            label: string
            value: ChartTypeFilterValue
        }[] = [
            ...Object.values(GRAPHER_CHART_TYPES).map((value) => ({
                label: _.startCase(value),
                value,
            })),
            { label: "Map", value: MAP_FILTER_VALUE },
        ]

        const advancedFiltersContent = (
            <div className="ChartList__advancedFilters">
                <label>
                    <span>Published</span>
                    <DatePicker.RangePicker
                        value={publishedDateRange ?? undefined}
                        onChange={this.onPublishedDateRangeChange}
                        allowEmpty={[true, true]}
                    />
                </label>
                <label>
                    <span>Last edited</span>
                    <DatePicker.RangePicker
                        value={lastEditedDateRange ?? undefined}
                        onChange={this.onLastEditedDateRangeChange}
                        allowEmpty={[true, true]}
                    />
                </label>
                <label>
                    <span>References</span>
                    <span className="ChartList__rangeInputs">
                        <InputNumber
                            placeholder="Min"
                            min={0}
                            value={referencesMin}
                            onChange={this.onReferencesMinChange}
                        />
                        <InputNumber
                            placeholder="Max"
                            min={0}
                            value={referencesMax}
                            onChange={this.onReferencesMaxChange}
                        />
                    </span>
                </label>
                <label>
                    <span>Narrative charts</span>
                    <span className="ChartList__rangeInputs">
                        <InputNumber
                            placeholder="Min"
                            min={0}
                            value={narrativeChartsMin}
                            onChange={this.onNarrativeChartsMinChange}
                        />
                        <InputNumber
                            placeholder="Max"
                            min={0}
                            value={narrativeChartsMax}
                            onChange={this.onNarrativeChartsMaxChange}
                        />
                    </span>
                </label>
                <div className="ChartList__advancedFiltersFooter">
                    <Button
                        size="small"
                        onClick={this.onClearAdvancedFilters}
                        disabled={advancedFilterCount === 0}
                    >
                        Clear
                    </Button>
                </div>
            </div>
        )

        const highlight = highlightFunctionForSearchWords(this.searchWords)
        const hasMoreCharts = this.chartsFiltered.length > this.maxVisibleCharts

        const getSortIndicator = (field: SortField) => {
            if (!sortConfig || sortConfig.field !== field) return ""
            return sortConfig.direction === "desc" ? " ↓" : " ↑"
        }

        const handleSortClick = (field: SortField) => {
            if (!sortConfig || sortConfig.field !== field) {
                onSort({ field, direction: "desc" })
            } else if (sortConfig.direction === "desc") {
                onSort({ field, direction: "asc" })
            } else {
                onSort(null)
            }
        }

        const sortableHeader = (label: React.ReactNode, field: SortField) => (
            <th
                style={{ cursor: "pointer" }}
                onClick={() => handleSortClick(field)}
            >
                {label}
                {getSortIndicator(field)}
            </th>
        )

        // if the first chart has inheritance information, we assume all charts have it
        const showInheritanceColumn =
            chartsToShow[0]?.isInheritanceEnabled !== undefined

        return (
            <div className="ChartList">
                <div className="topRow">
                    <TextField
                        placeholder="Search all charts..."
                        value={searchInput}
                        onValue={this.onSearchInput}
                        autofocus={this.props.autofocusSearchInput}
                    />
                    <div className="filters">
                        <FontAwesomeIcon icon={faFilter} aria-hidden="true" />
                        <select
                            className="form-control"
                            value={publishedFilter}
                            onChange={(e) =>
                                this.onPublishedFilterChange(
                                    e.target.value as PublishedFilter
                                )
                            }
                            aria-label="Filter by publication status"
                        >
                            <option value="all">All charts</option>
                            <option value="published">Public only</option>
                            <option value="drafts">Drafts only</option>
                        </select>
                        <Select
                            className="ChartList__chartTypeSelect"
                            mode="multiple"
                            allowClear
                            placeholder="Chart type"
                            value={chartTypes}
                            onChange={this.onChartTypesChange}
                            options={chartTypeOptions}
                            maxTagCount="responsive"
                            aria-label="Filter by chart type"
                        />
                        <Popover
                            trigger="click"
                            placement="bottomRight"
                            content={advancedFiltersContent}
                            title="More filters"
                        >
                            <Badge
                                count={advancedFilterCount}
                                size="small"
                                offset={[-4, 4]}
                            >
                                <Button>More filters</Button>
                            </Badge>
                        </Popover>
                    </div>
                </div>
                <div className="resultsCount">
                    Showing {chartsToShow.length} of {numTotalCharts} charts
                    {searchInput && (
                        <>
                            {" "}
                            for "{searchInput}" ({this.props.charts.length}{" "}
                            total)
                        </>
                    )}
                </div>
                <table className="table table-bordered">
                    <thead>
                        <tr>
                            <th></th>
                            <th>Chart</th>
                            {sortableHeader("Id", "id")}
                            {sortableHeader("Type", "type")}
                            {showInheritanceColumn && <th>Inheritance</th>}
                            <th>Tags</th>
                            {sortableHeader("Published", "isPublished")}
                            {sortableHeader("Last Updated", "lastEditedAt")}
                            {sortableHeader(
                                "Grapher views/day",
                                "grapherViewsPerDay"
                            )}
                            {sortableHeader(
                                "narrative charts",
                                "narrativeChartsCount"
                            )}
                            <th
                                style={{ cursor: "pointer" }}
                                onClick={() =>
                                    handleSortClick("referencesCount")
                                }
                            >
                                references{getSortIndicator("referencesCount")}
                                <Tooltip title="Only considers published content. This number might differ from the chart editor count, which includes unpublished data insights.">
                                    <FontAwesomeIcon icon={faInfoCircle} />
                                </Tooltip>
                            </th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {chartsToShow.map((chart) => (
                            <ChartRow
                                chart={chart}
                                key={chart.id}
                                availableTags={availableTags}
                                searchHighlight={highlight}
                                onDelete={this.onDeleteChart}
                                showInheritanceColumn={showInheritanceColumn}
                            />
                        ))}
                    </tbody>
                </table>
                {hasMoreCharts && (
                    <button
                        className="btn btn-secondary"
                        onClick={this.onShowMore}
                    >
                        Show more charts...
                    </button>
                )}
            </div>
        )
    }
}

function filterByDateRange(
    charts: ChartListItem[],
    getDate: (chart: ChartListItem) => string | null | undefined,
    range: DateRange
): ChartListItem[] {
    if (!range || (!range[0] && !range[1])) return charts
    const [start, end] = range
    return charts.filter((chart) => {
        const raw = getDate(chart)
        if (!raw) return false
        const date = dayjs(raw)
        if (start && date.isBefore(start, "day")) return false
        if (end && date.isAfter(end, "day")) return false
        return true
    })
}

export function showChartType(chart: ChartListItem): string {
    const chartType = chart.type

    if (!chartType) return "Map"

    const displayType = GRAPHER_CHART_TYPES[chartType]
        ? _.startCase(GRAPHER_CHART_TYPES[chartType])
        : "Unknown"

    if (chart.tab === GRAPHER_TAB_CONFIG_OPTIONS.map) {
        if (chart.hasChartTab) return `Map + ${displayType}`
        else return "Map"
    } else {
        if (chart.hasMapTab) return `${displayType} + Map`
        else return displayType
    }
}
