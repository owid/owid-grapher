import React from "react"
import { observer } from "mobx-react"
import { observable, computed, action, makeObservable } from "mobx"
import fuzzysort from "fuzzysort"
import { Link } from "react-router-dom"

import { TextField } from "./Forms.js"
import { AdminLayout } from "./AdminLayout.js"
import { uniq } from "../clientUtils/Util.js"
import { SortOrder } from "../clientUtils/owidTypes.js"
import Select from "react-select"
import { getStylesForTargetHeight } from "../clientUtils/react-select.js"
import { highlight as fuzzyHighlight } from "../grapher/controls/FuzzySearch.js"
import {
    SuggestedChartRevisionList,
    SuggestedChartRevisionListItem,
} from "./SuggestedChartRevisionList.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faSortAlphaDown } from "@fortawesome/free-solid-svg-icons/faSortAlphaDown"
import { faSortAlphaUpAlt } from "@fortawesome/free-solid-svg-icons/faSortAlphaUpAlt"

interface Searchable {
    suggestedChartRevision: SuggestedChartRevisionListItem
    term?: Fuzzysort.Prepared
}

export const SuggestedChartRevisionListPage = observer(
    class SuggestedChartRevisionListPage extends React.Component {
        static contextType = AdminAppContext
        context!: AdminAppContextType

        searchInput?: string
        maxVisibleCharts = 50
        suggestedChartRevisions: SuggestedChartRevisionListItem[] = []
        numTotalRows?: number

        sortBy: string = "updatedAt"
        sortOrder: SortOrder = SortOrder.desc

        constructor(props) {
            super(props)

            makeObservable(this, {
                searchInput: observable,
                maxVisibleCharts: observable,
                suggestedChartRevisions: observable,
                numTotalRows: observable,
                sortBy: observable,
                sortOrder: observable,
                searchIndex: computed,
                suggestedChartRevisionsToShow: computed,
                getData: action.bound,
                onSearchInput: action.bound,
                onShowMore: action.bound,
                onSortByChange: action.bound,
                onSortOrderChange: action.bound,
            })
        }

        get searchIndex(): Searchable[] {
            const searchIndex: Searchable[] = []
            for (const suggestedChartRevision of this.suggestedChartRevisions) {
                const originalConfig = suggestedChartRevision.originalConfig
                searchIndex.push({
                    suggestedChartRevision: suggestedChartRevision,
                    term: fuzzysort.prepare(`
                    ${suggestedChartRevision.status || ""}
                    ${originalConfig.title}
                    ${originalConfig.variantName || ""}
                    ${originalConfig.internalNotes || ""}
                `),
                })
            }

            return searchIndex
        }

        get suggestedChartRevisionsToShow(): SuggestedChartRevisionListItem[] {
            const { searchInput, searchIndex, maxVisibleCharts } = this
            if (searchInput) {
                const results = fuzzysort.go(searchInput, searchIndex, {
                    limit: 50,
                    key: "term",
                })
                return uniq(
                    results.map(
                        (result: any) => result.obj.suggestedChartRevision
                    )
                )
            } else {
                return this.suggestedChartRevisions.slice(0, maxVisibleCharts)
            }
        }

        async getData() {
            const { admin } = this.context
            const json = await admin.getJSON("/api/suggested-chart-revisions", {
                sortBy: this.sortBy,
                sortOrder: this.sortOrder,
            })
            this.suggestedChartRevisions = json.suggestedChartRevisions
            this.numTotalRows = json.numTotalRows
        }

        onSearchInput(input: string) {
            this.searchInput = input
        }

        onShowMore() {
            this.maxVisibleCharts += 50
        }

        onSortByChange(selected: any) {
            this.sortBy = selected.value
            this.getData()
        }

        onSortOrderChange(value: SortOrder) {
            this.sortOrder = value
            this.getData()
        }

        componentDidMount() {
            this.getData()
        }

        render() {
            const { suggestedChartRevisionsToShow, searchInput, numTotalRows } =
                this

            const highlight = (text: string) => {
                if (this.searchInput) {
                    const html =
                        fuzzyHighlight(
                            fuzzysort.single(this.searchInput, text)
                        ) ?? text
                    return <span dangerouslySetInnerHTML={{ __html: html }} />
                } else return text
            }

            return (
                <AdminLayout title="Suggested chart revisions">
                    <main className="SuggestedChartRevisionListPage">
                        <div className="topRow">
                            <div>
                                <span>
                                    Showing{" "}
                                    {suggestedChartRevisionsToShow.length} of{" "}
                                    {numTotalRows} suggested revisions
                                </span>
                                <Link
                                    className="btn btn-outline-primary"
                                    to="/suggested-chart-revisions/review"
                                    style={{ marginLeft: "10px" }}
                                >
                                    Go to approval tool
                                </Link>
                                <Link
                                    className="btn btn-outline-primary"
                                    to="/suggested-chart-revisions/import"
                                    style={{ marginLeft: "10px" }}
                                >
                                    Upload revisions
                                </Link>
                            </div>
                            <TextField
                                placeholder="Search all suggested revisions..."
                                value={searchInput}
                                onValue={this.onSearchInput}
                                autofocus
                            />
                        </div>
                        <div className="settings">
                            <div style={{ width: 250 }}>
                                Sort by:{" "}
                                <Select
                                    options={[
                                        {
                                            value: "id",
                                            label: "Suggestion ID",
                                        },
                                        {
                                            value: "updatedAt",
                                            label: "Date suggestion last updated",
                                        },
                                        {
                                            value: "createdAt",
                                            label: "Date suggestion created",
                                        },
                                        {
                                            value: "status",
                                            label: "Suggestion status",
                                        },
                                        {
                                            value: "suggestedReason",
                                            label: "Reason suggested",
                                        },
                                        {
                                            value: "chartUpdatedAt",
                                            label: "Date chart last updated",
                                        },
                                        {
                                            value: "chartCreatedAt",
                                            label: "Date chart created",
                                        },
                                        {
                                            value: "chartId",
                                            label: "Chart ID",
                                        },
                                        {
                                            value: "variableId",
                                            label: "Variable ID",
                                        },
                                    ]}
                                    onChange={this.onSortByChange}
                                    defaultValue={{
                                        value: "updatedAt",
                                        label: "Date suggestion last updated",
                                    }}
                                    menuPlacement="top"
                                    styles={getStylesForTargetHeight(30)}
                                />
                            </div>
                            <div>
                                Sort order:
                                <br />
                                <div
                                    className="btn-group"
                                    data-toggle="buttons"
                                    style={{ whiteSpace: "nowrap" }}
                                >
                                    <label
                                        className={
                                            "btn btn-light" +
                                            (this.sortOrder === SortOrder.asc
                                                ? " active"
                                                : "")
                                        }
                                        title="Sort ascending"
                                    >
                                        <input
                                            type="radio"
                                            onChange={() =>
                                                this.onSortOrderChange(
                                                    SortOrder.asc
                                                )
                                            }
                                            name="sortOrder"
                                            id="asc"
                                            checked={
                                                this.sortOrder === SortOrder.asc
                                            }
                                        />{" "}
                                        <FontAwesomeIcon
                                            icon={faSortAlphaDown}
                                        />
                                    </label>
                                    <label
                                        className={
                                            "btn btn-light" +
                                            (this.sortOrder === SortOrder.desc
                                                ? " active"
                                                : "")
                                        }
                                        title="Sort descending"
                                    >
                                        <input
                                            onChange={() =>
                                                this.onSortOrderChange(
                                                    SortOrder.desc
                                                )
                                            }
                                            type="radio"
                                            name="sortOrder"
                                            id="desc"
                                            checked={
                                                this.sortOrder ===
                                                SortOrder.desc
                                            }
                                        />{" "}
                                        <FontAwesomeIcon
                                            icon={faSortAlphaUpAlt}
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>
                        <SuggestedChartRevisionList
                            suggestedChartRevisions={
                                suggestedChartRevisionsToShow
                            }
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
)
