import React from "react"
import { observer } from "mobx-react"
import { observable, computed, action, runInAction, makeObservable } from "mobx"
import * as lodash from "lodash"

import { AdminLayout } from "./AdminLayout.js"
import { SearchField, FieldsRow } from "./Forms.js"
import { DatasetList, DatasetListItem } from "./DatasetList.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import {
    buildSearchWordsFromSearchString,
    filterFunctionForSearchWords,
    highlightFunctionForSearchWords,
    SearchWord,
} from "../clientUtils/search.js"

export const DatasetsIndexPage = observer(
    class DatasetsIndexPage extends React.Component {
        static contextType = AdminAppContext
        context!: AdminAppContextType

        datasets: DatasetListItem[] = []
        maxVisibleRows = 50
        searchInput?: string

        constructor(props) {
            super(props)

            makeObservable(this, {
                datasets: observable,
                maxVisibleRows: observable,
                searchInput: observable,
                searchWords: computed,
                allDatasetsToShow: computed,
                datasetsToShow: computed,
                namespaces: computed,
                numTotalRows: computed,
                onSearchInput: action.bound,
                onShowMore: action.bound,
            })
        }

        get searchWords(): SearchWord[] {
            const { searchInput } = this
            return buildSearchWordsFromSearchString(searchInput)
        }

        get allDatasetsToShow(): DatasetListItem[] {
            const { searchWords, datasets, maxVisibleRows } = this
            if (searchWords.length > 0) {
                const filterFn = filterFunctionForSearchWords(
                    searchWords,
                    (dataset: DatasetListItem) => [
                        dataset.name,
                        ...dataset.tags.map((t) => t.name),
                        dataset.namespace,
                        dataset.dataEditedByUserName,
                        dataset.description,
                    ]
                )
                return datasets.filter(filterFn)
            } else {
                return this.datasets.slice(0, maxVisibleRows)
            }
        }

        get datasetsToShow(): DatasetListItem[] {
            return this.allDatasetsToShow.slice(0, this.maxVisibleRows)
        }

        get namespaces() {
            return lodash.uniq(this.datasets.map((d) => d.namespace))
        }

        get numTotalRows(): number {
            return this.datasets.length
        }

        onSearchInput(input: string) {
            this.searchInput = input
        }

        onShowMore() {
            this.maxVisibleRows += 100
        }

        render() {
            const { datasetsToShow, searchInput, numTotalRows } = this

            const highlight = highlightFunctionForSearchWords(this.searchWords)

            return (
                <AdminLayout title="Datasets">
                    <main className="DatasetsIndexPage">
                        <FieldsRow>
                            <span>
                                Showing {datasetsToShow.length} of{" "}
                                {numTotalRows} datasets
                            </span>
                            <SearchField
                                placeholder="Search all datasets..."
                                value={searchInput}
                                onValue={this.onSearchInput}
                                autofocus
                            />
                        </FieldsRow>
                        <DatasetList
                            datasets={datasetsToShow}
                            searchHighlight={highlight}
                        />
                        {!searchInput && (
                            <button
                                className="btn btn-secondary"
                                onClick={this.onShowMore}
                            >
                                Show more datasets...
                            </button>
                        )}
                    </main>
                </AdminLayout>
            )
        }

        async getData() {
            const { admin } = this.context
            const json = await admin.getJSON("/api/datasets.json")
            runInAction(() => {
                this.datasets = json.datasets
            })
        }

        componentDidMount() {
            this.getData()
        }
    }
)
