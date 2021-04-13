import * as React from "react"
import { observer } from "mobx-react"
import { observable, computed, action } from "mobx"
import fuzzysort from "fuzzysort"
import { Link } from "react-router-dom"

import { TextField } from "./Forms"
import { AdminLayout } from "./AdminLayout"
import { uniq } from "../clientUtils/Util"
import { highlight as fuzzyHighlight } from "../grapher/controls/FuzzySearch"
import {
    SuggestedRevisionList,
    SuggestedRevisionListItem,
} from "./SuggestedChartRevisionList"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext"

interface Searchable {
    suggestedRevision: SuggestedRevisionListItem
    term?: Fuzzysort.Prepared
}

@observer
export class SuggestedChartRevisionListPage extends React.Component {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable searchInput?: string
    @observable maxVisibleCharts = 50
    @observable suggestedRevisions: SuggestedRevisionListItem[] = []
    @observable numTotalRows?: number

    @computed get searchIndex(): Searchable[] {
        const searchIndex: Searchable[] = []
        for (const suggestedRevision of this.suggestedRevisions) {
            const existingConfig = suggestedRevision.existingConfig
            searchIndex.push({
                suggestedRevision: suggestedRevision,
                term: fuzzysort.prepare(`
                    ${suggestedRevision.status || ""} 
                    ${existingConfig.title} 
                    ${existingConfig.variantName || ""} 
                    ${existingConfig.internalNotes || ""} 
                `),
            })
        }

        return searchIndex
    }

    @computed get suggestedRevisionsToShow(): SuggestedRevisionListItem[] {
        const { searchInput, searchIndex, maxVisibleCharts } = this
        if (searchInput) {
            const results = fuzzysort.go(searchInput, searchIndex, {
                limit: 50,
                key: "term",
            })
            return uniq(
                results.map((result: any) => result.obj.suggestedRevision)
            )
        } else {
            return this.suggestedRevisions.slice(0, maxVisibleCharts)
        }
    }

    @action.bound async getData() {
        const { admin } = this.context
        const json = await admin.getJSON("/api/suggested-chart-revisions")
        this.suggestedRevisions = json.suggestedRevisions
        this.numTotalRows = json.numTotalRows
    }

    @action.bound onSearchInput(input: string) {
        this.searchInput = input
    }

    @action.bound onShowMore() {
        this.maxVisibleCharts += 50
    }

    componentDidMount() {
        this.getData()
    }

    render() {
        const { suggestedRevisionsToShow, searchInput, numTotalRows } = this

        const highlight = (text: string) => {
            if (this.searchInput) {
                const html =
                    fuzzyHighlight(fuzzysort.single(this.searchInput, text)) ??
                    text
                return <span dangerouslySetInnerHTML={{ __html: html }} />
            } else return text
        }

        return (
            <AdminLayout title="Suggested chart revisions">
                <main className="SuggestedChartRevisionListPage">
                    <div className="topRow">
                        <div>
                            <span>
                                Showing {suggestedRevisionsToShow.length} of{" "}
                                {numTotalRows} suggested revisions
                            </span>
                            <Link
                                className="btn btn-primary"
                                to="/suggested-chart-revisions/approve"
                                style={{ marginLeft: "10px" }}
                            >
                                Go to approval tool
                            </Link>
                        </div>
                        <TextField
                            placeholder="Search all suggested revisions..."
                            value={searchInput}
                            onValue={this.onSearchInput}
                            autofocus
                        />
                    </div>
                    <SuggestedRevisionList
                        suggestedRevisions={suggestedRevisionsToShow}
                        searchHighlight={highlight}
                    />
                    {!searchInput && (
                        <button
                            className="btn btn-secondary"
                            onClick={this.onShowMore}
                        >
                            Show more suggested revisions...
                        </button>
                    )}
                </main>
            </AdminLayout>
        )
    }
}
