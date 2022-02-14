import * as React from "react"
import { observer } from "mobx-react"
import { observable, computed, action, runInAction } from "mobx"

import { TextField } from "./Forms.js"
import { AdminLayout } from "./AdminLayout.js"
import { uniq } from "../clientUtils/Util.js"
import { highlight as fuzzyHighlight } from "../grapher/controls/FuzzySearch.js"
import { ChartList, ChartListItem } from "./ChartList.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import {
    buildSearchWordsFromSearchString,
    filterFunctionForSearchWords,
    highlightFunctionForSearchWords,
    SearchWord,
} from "../clientUtils/search.js"

@observer
export class ChartIndexPage extends React.Component {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable searchInput?: string
    @observable maxVisibleCharts = 50
    @observable charts: ChartListItem[] = []

    @computed get searchWords(): SearchWord[] {
        const { searchInput } = this
        return buildSearchWordsFromSearchString(searchInput)
    }
    @computed get numTotalCharts() {
        return this.charts.length
    }

    @computed get allChartsToShow(): ChartListItem[] {
        const { searchWords, charts } = this
        if (searchWords.length > 0) {
            const filterFn = filterFunctionForSearchWords(
                searchWords,
                (chart: ChartListItem) => [
                    chart.title,
                    chart.variantName,
                    chart.internalNotes,
                    chart.publishedBy,
                    chart.lastEditedBy,
                    ...chart.tags.map((tag) => tag.name),
                ]
            )
            return charts.filter(filterFn)
        } else {
            return this.charts
        }
    }

    @computed get chartsToShow(): ChartListItem[] {
        return this.allChartsToShow.slice(0, this.maxVisibleCharts)
    }

    @action.bound onSearchInput(input: string) {
        this.searchInput = input
    }

    @action.bound onShowMore() {
        this.maxVisibleCharts += 100
    }

    render() {
        const { chartsToShow, searchInput, numTotalCharts } = this

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
        this.getData()
    }
}
