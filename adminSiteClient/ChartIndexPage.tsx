import { Component } from "react"
import { observer } from "mobx-react"
import { observable, computed, action, runInAction } from "mobx"

import { TextField } from "./Forms.js"
import { AdminLayout } from "./AdminLayout.js"
import { ChartList, ChartListItem, SortConfig } from "./ChartList.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import {
    buildSearchWordsFromSearchString,
    filterFunctionForSearchWords,
    highlightFunctionForSearchWords,
    SearchWord,
} from "../adminShared/search.js"
import { sortNumeric, SortOrder } from "@ourworldindata/utils"

@observer
export class ChartIndexPage extends Component {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable searchInput?: string
    @observable maxVisibleCharts = 50
    @observable charts: ChartListItem[] = []
    @observable sortBy: "pageviewsPerDay" | null = null
    @observable sortConfig: SortConfig = null

    @computed get searchWords(): SearchWord[] {
        const { searchInput } = this
        return buildSearchWordsFromSearchString(searchInput)
    }
    @computed get numTotalCharts() {
        return this.charts.length
    }

    @computed get allChartsToShow(): ChartListItem[] {
        const { searchWords, charts, sortConfig } = this
        let filtered = charts
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
            filtered = charts.filter(filterFn)
        }

        // Apply sorting if needed
        if (sortConfig?.field === "pageviewsPerDay") {
            return sortNumeric(
                [...filtered],
                (chart) => chart.pageviewsPerDay,
                sortConfig.direction === "asc" ? SortOrder.asc : SortOrder.desc
            )
        }

        return filtered
    }

    @computed get chartsToShow(): ChartListItem[] {
        return this.allChartsToShow.slice(0, this.maxVisibleCharts)
    }

    @action.bound onSearchInput(input: string) {
        this.searchInput = input
        this.setSearchInputInUrl(input)
    }

    @action.bound onShowMore() {
        this.maxVisibleCharts += 100
    }

    @action.bound onSort(sortConfig: SortConfig) {
        this.sortConfig = sortConfig
    }

    render() {
        const { chartsToShow, searchInput, numTotalCharts, sortConfig } = this

        const highlight = highlightFunctionForSearchWords(this.searchWords)

        return (
            <AdminLayout title="Charts">
                <main className="ChartIndexPage">
                    <div className="topRow">
                        <span>
                            Showing {chartsToShow.length} of {numTotalCharts}{" "}
                            charts
                        </span>
                        <TextField
                            placeholder="Search all charts..."
                            value={searchInput}
                            onValue={this.onSearchInput}
                            autofocus
                        />
                    </div>
                    <ChartList
                        charts={chartsToShow}
                        searchHighlight={highlight}
                        onDelete={action((c: ChartListItem) =>
                            this.charts.splice(this.charts.indexOf(c), 1)
                        )}
                        onSort={this.onSort}
                        sortConfig={sortConfig}
                    />
                    {!searchInput && (
                        <button
                            className="btn btn-secondary"
                            onClick={this.onShowMore}
                        >
                            Show more charts...
                        </button>
                    )}
                </main>
            </AdminLayout>
        )
    }

    async getData() {
        const { admin } = this.context
        const json = await admin.getJSON("/api/charts.json")
        runInAction(() => {
            this.charts = json.charts
        })
    }

    componentDidMount() {
        this.searchInput = this.getSearchInputFromUrl()
        void this.getData()
    }

    getSearchInputFromUrl(): string {
        const params = new URLSearchParams(window.location.search)
        return params.get("search") || ""
    }

    setSearchInputInUrl(searchInput: string) {
        const params = new URLSearchParams(window.location.search)
        if (searchInput) {
            params.set("search", searchInput)
        } else {
            params.delete("search")
        }
        const newUrl = `${window.location.pathname}?${params.toString()}`
        window.history.replaceState({}, "", newUrl)
    }
}
