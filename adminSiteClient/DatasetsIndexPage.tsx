import { useContext, useEffect, useState } from "react"
import { observable } from "mobx"

import { AdminLayout } from "./AdminLayout.js"
import { TextField, FieldsRow } from "./Forms.js"
import { DatasetList, DatasetListItem } from "./DatasetList.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { useListSearch } from "./useListSearch.js"

const searchedText = (dataset: DatasetListItem) => [
    dataset.name,
    dataset.shortName,
    ...dataset.tags.map((t) => t.name),
    dataset.namespace,
    dataset.dataEditedByUserName,
    dataset.description,
]

const PAGE_SIZE = 50

export function DatasetsIndexPage() {
    const { admin } = useContext(AdminAppContext)
    const [datasets, setDatasets] = useState<DatasetListItem[]>([])
    const [maxVisibleRows, setMaxVisibleRows] = useState(PAGE_SIZE)
    const { searchValue, setSearchValue, filtered, highlight } = useListSearch(
        datasets,
        searchedText
    )

    useEffect(() => {
        void admin
            .getJSON<{ datasets: DatasetListItem[] }>("/api/datasets.json")
            // Observable, because a row saves its tags by setting
            // `dataset.tags`, and its observer has to see that to re-render
            .then((json) => setDatasets(observable(json.datasets)))
    }, [admin])

    const datasetsToShow = filtered.slice(0, maxVisibleRows)

    return (
        <AdminLayout title="Datasets">
            <main className="DatasetsIndexPage">
                <FieldsRow>
                    <span>
                        Showing {datasetsToShow.length} of {filtered.length}{" "}
                        datasets
                    </span>
                    <TextField
                        placeholder="Search all datasets..."
                        value={searchValue}
                        onValue={(value) => {
                            setSearchValue(value)
                            setMaxVisibleRows(PAGE_SIZE)
                        }}
                        autofocus
                    />
                </FieldsRow>
                <DatasetList
                    datasets={datasetsToShow}
                    searchHighlight={highlight}
                />
                {filtered.length > maxVisibleRows && (
                    <button
                        className="btn btn-secondary"
                        onClick={() => setMaxVisibleRows((rows) => rows + 100)}
                    >
                        Show more datasets...
                    </button>
                )}
            </main>
        </AdminLayout>
    )
}
