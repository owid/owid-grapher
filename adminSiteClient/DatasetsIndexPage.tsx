import React from "react"
import { observer } from "mobx-react"
import { observable, computed, action, runInAction } from "mobx"
import * as lodash from "lodash-es"

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

@observer
export class DatasetsIndexPage extends React.Component {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable datasets: DatasetListItem[] = []
    @observable maxVisibleRows = 50
    @observable searchInput?: string

    @computed get searchWords(): SearchWord[] {
        const { searchInput } = this
        return buildSearchWordsFromSearchString(searchInput)
    }

    @computed get allDatasetsToShow(): DatasetListItem[] {
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

    @computed get datasetsToShow(): DatasetListItem[] {
        return this.allDatasetsToShow.slice(0, this.maxVisibleRows)
    }

    @computed get namespaces() {
        return lodash.uniq(this.datasets.map((d) => d.namespace))
    }

    @computed get numTotalRows(): number {
        return this.datasets.length
    }

    @action.bound onSearchInput(input: string) {
        this.searchInput = input
    }

    @action.bound onShowMore() {
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
                            Showing {datasetsToShow.length} of {numTotalRows}{" "}
                            datasets
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
