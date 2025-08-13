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
import { getFullReferencesCount } from "./ChartEditor.js"
import { ChartRow } from "./ChartRow.js"
import { References } from "./AbstractChartEditor.js"
import {
    SearchWord,
    buildSearchWordsFromSearchString,
    filterFunctionForSearchWords,
    highlightFunctionForSearchWords,
} from "../adminShared/search.js"
import { TextField } from "./Forms.js"
import { ENV } from "../settings/clientSettings.js"

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
    pageviewsPerDay: number
    narrativeChartsCount: number
    referencesCount: number
}

export type SortConfig = {
    field: "pageviewsPerDay" | "narrativeChartsCount" | "referencesCount"
    direction: "asc" | "desc"
} | null

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

    constructor(props: ChartListProps) {
        super(props)

        makeObservable(this, {
            searchInput: observable,
            maxVisibleCharts: observable,
            sortConfig: observable,
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
        if (getFullReferencesCount(refs) > 0) {
            window.alert(
                `Cannot delete chart ${
                    chart.slug
                } because it is used in ${getFullReferencesCount(
                    refs
                )} places. See the references tab in the chart editor for details.`
            )
            return
        }
        // Create the confirmation message with staging warning if applicable
        let confirmMessage = `Delete the chart ${chart.slug}? This action cannot be undone!`

        if (ENV === "staging") {
            confirmMessage +=
                "\n\n⚠️ WARNING: You are on a staging server. Deleted charts are NOT synced to production servers. If this chart exists on production, it will remain there even after deletion here."
        }

        if (!window.confirm(confirmMessage)) return

        const json = await this.context.admin.requestJSON(
            `/api/charts/${chart.id}`,
            {},
            "DELETE"
        )

        if (json.success) {
            if (this.props.onDelete) this.props.onDelete(chart)
            else
                runInAction(() =>
                    this.props.charts.splice(
                        this.props.charts.indexOf(chart),
                        1
                    )
                )
        }
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
        const { searchWords } = this
        const { charts } = this.props
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
            return charts.filter(filterFn)
        } else return charts
    }

    @computed get chartsSorted(): ChartListItem[] {
        const { chartsFiltered } = this
        if (!this.sortConfig) return chartsFiltered

        const { direction, field } = this.sortConfig
        const getValue =
            field === "pageviewsPerDay"
                ? (chart: ChartListItem) => chart.pageviewsPerDay
                : field === "narrativeChartsCount"
                  ? (chart: ChartListItem) => chart.narrativeChartsCount
                  : (chart: ChartListItem) => chart.referencesCount

        return sortNumeric(
            [...chartsFiltered],
            getValue,
            direction === "asc" ? SortOrder.asc : SortOrder.desc
        )
    }

    @computed get chartsToShow(): ChartListItem[] {
        return this.chartsSorted.slice(0, this.maxVisibleCharts)
    }

    @action.bound onSearchInput(input: string) {
        this.searchInput = input
        this.setSearchInputInUrl(input)
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
        } = this
        const { availableTags } = this

        const highlight = highlightFunctionForSearchWords(this.searchWords)
        const hasMoreCharts = this.chartsFiltered.length > this.maxVisibleCharts

        const getSortIndicator = () => {
            if (!sortConfig || sortConfig.field !== "pageviewsPerDay") return ""
            return sortConfig.direction === "desc" ? " ↓" : " ↑"
        }

        const handleSortClick = () => {
            if (!sortConfig || sortConfig.field !== "pageviewsPerDay") {
                onSort({ field: "pageviewsPerDay", direction: "desc" })
            } else if (sortConfig.direction === "desc") {
                onSort({ field: "pageviewsPerDay", direction: "asc" })
            } else {
                onSort(null)
            }
        }

        const getNarrativeChartsSortIndicator = () => {
            if (!sortConfig || sortConfig.field !== "narrativeChartsCount")
                return ""
            return sortConfig.direction === "desc" ? " ↓" : " ↑"
        }

        const handleNarrativeChartsSortClick = () => {
            if (!sortConfig || sortConfig.field !== "narrativeChartsCount") {
                onSort({ field: "narrativeChartsCount", direction: "desc" })
            } else if (sortConfig.direction === "desc") {
                onSort({ field: "narrativeChartsCount", direction: "asc" })
            } else {
                onSort(null)
            }
        }

        const getReferencesCountSortIndicator = () => {
            if (!sortConfig || sortConfig.field !== "referencesCount") return ""
            return sortConfig.direction === "desc" ? " ↓" : " ↑"
        }

        const handleReferencesCountSortClick = () => {
            if (!sortConfig || sortConfig.field !== "referencesCount") {
                onSort({ field: "referencesCount", direction: "desc" })
            } else if (sortConfig.direction === "desc") {
                onSort({ field: "referencesCount", direction: "asc" })
            } else {
                onSort(null)
            }
        }

        // if the first chart has inheritance information, we assume all charts have it
        const showInheritanceColumn =
            chartsToShow[0]?.isInheritanceEnabled !== undefined

        return (
            <div className="ChartList">
                <div className="topRow">
                    <span>
                        Showing {chartsToShow.length} of {numTotalCharts} charts
                        {searchInput && (
                            <>
                                {" "}
                                for "{searchInput}" ({this.props.charts.length}{" "}
                                total)
                            </>
                        )}
                    </span>
                    <TextField
                        placeholder="Search all charts..."
                        value={searchInput}
                        onValue={this.onSearchInput}
                        autofocus={this.props.autofocusSearchInput}
                    />
                </div>
                <table className="table table-bordered">
                    <thead>
                        <tr>
                            <th></th>
                            <th>Chart</th>
                            <th>Id</th>
                            <th>Type</th>
                            {showInheritanceColumn && <th>Inheritance</th>}
                            <th>Tags</th>
                            <th>Published</th>
                            <th>Last Updated</th>
                            <th
                                style={{ cursor: "pointer" }}
                                onClick={handleSortClick}
                            >
                                views/day{getSortIndicator()}
                            </th>
                            <th
                                style={{ cursor: "pointer" }}
                                onClick={handleNarrativeChartsSortClick}
                            >
                                narrative charts
                                {getNarrativeChartsSortIndicator()}
                            </th>
                            <th
                                style={{ cursor: "pointer" }}
                                onClick={handleReferencesCountSortClick}
                            >
                                references{getReferencesCountSortIndicator()}
                            </th>
                            <th></th>
                            <th></th>
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
