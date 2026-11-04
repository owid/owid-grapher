import { useContext, useEffect, useState } from "react"

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

export function DatasetsIndexPage() {
    const { admin } = useContext(AdminAppContext)
    const [datasets, setDatasets] = useState<DatasetListItem[]>([])
    const [maxVisibleRows, setMaxVisibleRows] = useState(50)
    const { searchValue, setSearchValue, filtered, highlight } = useListSearch(
        datasets,
        searchedText
    )

    useEffect(() => {
        void admin
            .getJSON<{ datasets: DatasetListItem[] }>("/api/datasets.json")
            .then((json) => setDatasets(json.datasets))
    }, [admin])

    const datasetsToShow = filtered.slice(0, maxVisibleRows)

    return (
        <AdminLayout title="Datasets">
            <main className="DatasetsIndexPage">
                <FieldsRow>
                    <span>
                        Showing {datasetsToShow.length} of {datasets.length}{" "}
                        datasets
                    </span>
                    <TextField
                        placeholder="Search all datasets..."
                        value={searchValue}
                        onValue={setSearchValue}
                        autofocus
                    />
                </FieldsRow>
                <DatasetList
                    datasets={datasetsToShow}
                    searchHighlight={highlight}
                />
                {!searchValue && (
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
